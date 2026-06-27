// ====================================================================
// PIEUVRE API - Scan de Plans
// ====================================================================

const express = require('express');
const router = express.Router();
const { query } = require('../db/postgres');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ocr = require('../services/ocr');
const { searchForCircuitContext } = require('../services/rag');

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads/scans';
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.tif', '.dwg', '.dxf'];
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Format non supporte'));
    }
  }
});

const SUPPORTED_FORMATS = {
  '.pdf': 'pdf',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.tiff': 'image',
  '.tif': 'image',
  '.dwg': 'cad',
  '.dxf': 'cad'
};

function getSymbolesForClient(idClient) {
  return query(`
    SELECT ms.*, cs.client_code 
    FROM modeles_symboles ms
    LEFT JOIN client_symboles cs ON cs.id_modele_symboles = ms.id AND cs.id_client = $1
    WHERE ms.actif = true
    ORDER BY ms.categorie, ms.nom
  `, [idClient]);
}

function detectSymbolsFromText(text, symboles) {
  const elements = [];
  const textLines = text.split('\n').map(l => l.trim()).filter(l => l);
  
  symboles.forEach(sym => {
    const clientCode = sym.client_code || sym.code;
    textLines.forEach((line, idx) => {
      if (line.includes(clientCode) || line.match(new RegExp(clientCode, 'i'))) {
        elements.push({
          type_element: sym.type_element,
          code_symbol: clientCode,
          label: line,
          confiance: 0.9,
          source_detection: 'text',
          position: idx
        });
      }
    });
  });
  
  return elements;
}

function mapElementsToCircuits(elements) {
  const circuits = {};
  
  elements.forEach(el => {
    const key = el.code_symbol || el.type_element;
    if (!circuits[key]) {
      circuits[key] = {
        code_circuit: key,
        type_element: el.type_element,
        nombre_elements: 0,
        positions: []
      };
    }
    circuits[key].nombre_elements++;
    circuits[key].positions.push({ x: el.position_x, y: el.position_y });
  });
  
  return Object.values(circuits);
}

function calculateCircuitType(typeElement, count) {
  const mapping = {
    'prise': count <= 8 ? 'P' : `P_${Math.ceil(count / 8)}`,
    'lumiere': count === 1 ? 'L' : 'DA',
    'interrupteur': 'I',
    'communication': 'TEL',
    'securite': 'BS',
    'ventilation': 'VMC',
    'appareil': 'CUIS',
    'exterieur': 'PG'
  };
  return mapping[typeElement] || 'L';
}

// ====================================================================
// UPLOAD - Telecharger un fichier
// ====================================================================
router.post('/upload', upload.single('fichier'), async (req, res) => {
  try {
    const { id_chantier, id_client, methode_scan } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Aucun fichier' });
    }
    
    const typeFichier = SUPPORTED_FORMATS[path.extname(req.file.originalname).toLowerCase()];
    const hash = crypto.createHash('sha256').update(req.file.filename).digest('hex');
    
    const result = await query(`
      INSERT INTO scans (id_chantier, id_client, nom_fichier, stored_filename, type_fichier, taille_fichier, hash_fichier, methode_scan, statut)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'en_attente')
      RETURNING id
    `, [
      id_chantier || null,
      id_client || null,
      req.file.originalname,
      req.file.filename,
      typeFichier,
      req.file.size,
      hash,
      methode_scan || 'local'
    ]);

    res.json({
      success: true,
      data: {
        id: result.rows[0].id,
        nom_fichier: req.file.originalname,
        stored_filename: req.file.filename,
        type_fichier: typeFichier,
        taille: req.file.size
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// PROCESS - Lancer le traitement
// ====================================================================
router.post('/process/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { methode } = req.body;
    
    const scan = await query(`SELECT * FROM scans WHERE id = $1`, [id]);
    if (scan.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Scan non trouve' });
    }
    
    const scanData = scan.rows[0];
    
    await query(`UPDATE scans SET statut = 'en_cours' WHERE id = $1`, [id]);
    
    let elements = [];
    let circuits = [];
    let erreurs = null;
    
    try {
      const clientId = scanData.id_client;
      const symboles = await getSymbolesForClient(clientId);
      const filePath = path.join(UPLOAD_DIR, scanData.stored_filename || scanData.nom_fichier);

      let ocrResult = { dispositifs: [], notes: '' };

      if (scanData.type_fichier === 'image') {
        ocrResult = await detectFromImage(filePath);
      } else if (scanData.type_fichier === 'pdf') {
        ocrResult = await detectFromPDF(filePath);
      } else if (scanData.type_fichier === 'cad') {
        ocrResult = await detectFromCAD(filePath);
      }

      // Conversion des dispositifs OCR en éléments de scan
      elements = (ocrResult.dispositifs || []).map(d => ({
        type_element: d.type_element || 'autre',
        code_symbol: d.code_symbol || d.type_element,
        position_x: d.position_x || 0,
        position_y: d.position_y || 0,
        label: d.label || '',
        confiance: d.confiance || 0.5,
        source_detection: 'vision'
      }));

      // Fallback sur la détection texte si la vision ne retourne rien
      if (elements.length === 0 && symboles.rows.length > 0) {
        let fallbackText = '';
        if (scanData.type_fichier === 'image') {
          fallbackText = await detectFromImageFallback(filePath);
        } else if (scanData.type_fichier === 'pdf') {
          fallbackText = await detectFromPDFFallback(filePath);
        } else if (scanData.type_fichier === 'cad') {
          fallbackText = await detectFromCADFallback(filePath);
        }
        if (fallbackText) {
          elements = detectSymbolsFromText(fallbackText, symboles.rows);
        }
      }

      if (methode === 'api_externe') {
        const apiElements = await detectFromAPI(scanData, methode);
        elements = [...elements, ...apiElements];
      }

      circuits = mapElementsToCircuits(elements);

      for (const circuit of circuits) {
        circuit.type_element = calculateCircuitType(circuit.type_element, circuit.nombre_elements);
      }

    } catch (err) {
      erreurs = err.message;
    }

    // Nettoyer les anciens résultats avant de réinsérer
    await query(`DELETE FROM scan_elements WHERE id_scan = $1`, [id]);
    await query(`DELETE FROM scan_circuits WHERE id_scan = $1`, [id]);

    await query(`UPDATE scans SET nb_elements_detectes = $1, statut = $2, erreurs = $3, processed_at = NOW() WHERE id = $4`,
      [elements.length, erreurs ? 'erreur' : 'termine', erreurs, id]);

    for (const el of elements) {
      await query(`
        INSERT INTO scan_elements (id_scan, type_element, code_symbol, position_x, position_y, label, confiance, source_detection)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [id, el.type_element, el.code_symbol, el.position_x, el.position_y, el.label, el.confiance, el.source_detection]);
    }
    
    for (const circuit of circuits) {
      await query(`
        INSERT INTO scan_circuits (id_scan, code_circuit, type_element, nombre_elements, positions, circuit)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [id, circuit.code_circuit, circuit.type_element, circuit.nombre_elements, JSON.stringify(circuit.positions), JSON.stringify(circuit)]);
    }
    
    await query(`UPDATE scans SET nb_circuits_genérés = $1 WHERE id = $2`, [circuits.length, id]);
    
    res.json({
      success: true,
      data: {
        id,
        statut: erreurs ? 'erreur' : 'termine',
        nb_elements: elements.length,
        nb_circuits: circuits.length,
        circuits,
        erreurs
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

async function detectFromImage(filePath) {
  return ocr.detectFromImage(filePath);
}

async function detectFromPDF(filePath) {
  return ocr.detectFromPDF(filePath);
}

async function detectFromCAD(filePath) {
  return ocr.detectFromCAD(filePath);
}

async function detectFromImageFallback(filePath) {
  // Pas de fallback OCR texte natif sur une image brute
  return '';
}

async function detectFromPDFFallback(filePath) {
  try {
    const pdfParse = require('pdf-parse');
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (err) {
    return '';
  }
}

async function detectFromCADFallback(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    return extractStrings(buffer);
  } catch (err) {
    return '';
  }
}

function extractStrings(buffer) {
  const minLength = 4;
  const strings = [];
  let current = '';
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    if (byte >= 32 && byte <= 126) {
      current += String.fromCharCode(byte);
    } else {
      if (current.length >= minLength) strings.push(current);
      current = '';
    }
  }
  if (current.length >= minLength) strings.push(current);
  return strings.join('\n').substring(0, 5000);
}

async function detectFromAPI(scanData, methode) {
  return [];
}

// ====================================================================
// GET - Resultats du scan
// ====================================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const scan = await query(`SELECT * FROM scans WHERE id = $1`, [id]);
    if (scan.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Scan non trouve' });
    }
    
    const elements = await query(`SELECT * FROM scan_elements WHERE id_scan = $1 ORDER BY id`, [id]);
    const circuits = await query(`SELECT * FROM scan_circuits WHERE id_scan = $1 ORDER BY id`, [id]);
    
    res.json({
      success: true,
      data: {
        ...scan.rows[0],
        elements: elements.rows,
        circuits: circuits.rows
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// LIST - Tous les scans
// ====================================================================
router.get('/', async (req, res) => {
  try {
    const { id_chantier, statut } = req.query;
    let sql = `SELECT s.*, ch.nom as chantier_nom, c.nom as client_nom 
               FROM scans s 
               LEFT JOIN chantiers ch ON s.id_chantier = ch.id 
               LEFT JOIN clients c ON s.id_client = c.id`;
    const params = [];
    const conditions = [];
    
    if (id_chantier) {
      conditions.push(`s.id_chantier = $${params.length + 1}`);
      params.push(id_chantier);
    }
    if (statut) {
      conditions.push(`s.statut = $${params.length + 1}`);
      params.push(statut);
    }
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY s.scanned_at DESC';
    
    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// CONFIG - Symboles disponibles
// ====================================================================
router.get('/symboles', async (req, res) => {
  try {
    const { id_client, categorie } = req.query;
    
    let sql = `SELECT ms.*, cs.client_code FROM modeles_symboles ms`;
    const params = [];
    
    if (id_client) {
      sql += ` LEFT JOIN client_symboles cs ON cs.id_modele_symboles = ms.id AND cs.id_client = $1`;
      params.push(id_client);
    }
    sql += ` WHERE ms.actif = true`;
    
    if (categorie) {
      sql += ` AND ms.categorie = $${params.length + 1}`;
      params.push(categorie);
    }
    sql += ` ORDER BY ms.categorie, ms.nom`;
    
    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// CONFIG - Mapping client -> symboles
// ====================================================================
router.post('/symboles/mapping', async (req, res) => {
  try {
    const { id_client, mappings } = req.body;
    
    if (!id_client || !mappings || !Array.isArray(mappings)) {
      return res.status(400).json({ success: false, error: 'id_client et mappings requis' });
    }
    
    for (const map of mappings) {
      await query(`
        INSERT INTO client_symboles (id_client, id_modele_symboles, client_code)
        VALUES ($1, $2, $3)
        ON CONFLICT (id_client, id_modele_symboles)
        DO UPDATE SET client_code = $3
      `, [id_client, map.id_modele_symboles, map.client_code]);
    }
    
    res.json({ success: true, message: 'Mapping enregistre' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// IMPORT - Importer circuits vers un calcul
// ====================================================================
router.post('/import/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { id_calcul } = req.body;

    const scanCircuits = await query(`SELECT * FROM scan_circuits WHERE id_scan = $1 AND imported = false`, [id]);

    if (scanCircuits.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Aucun circuit a importer' });
    }

    const circuitsASuivre = scanCircuits.rows.map(c => {
      const data = typeof c.circuit === 'string' ? JSON.parse(c.circuit) : c.circuit;
      return {
        type: c.type_element,
        code_circuit: c.code_circuit,
        nb_prises: data.nombre_elements || 1,
        length: 0,
        etage: '',
        logement: ''
      };
    });

    res.json({
      success: true,
      data: circuitsASuivre,
      message: `${circuitsASuivre.length} circuits prets pour import`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// CALCULER - Calculer un bon de coupe depuis un scan (via RAG + OCR)
// ====================================================================
router.post('/:id/calculer', async (req, res) => {
  try {
    const { id } = req.params;
    const { id_chantier, options = {} } = req.body;

    if (!id_chantier) {
      return res.status(400).json({ success: false, error: 'id_chantier est requis' });
    }

    const scan = await query(`SELECT * FROM scans WHERE id = $1`, [id]);
    if (scan.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Scan non trouve' });
    }

    const scanData = scan.rows[0];

    // Si le scan n'a pas encore été traité, le traiter automatiquement
    if (scanData.statut === 'en_attente') {
      await fetch(`http://localhost:${process.env.PORT || 3001}/api/scans/process/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
    }

    const elementsResult = await query(`
      SELECT type_element, code_symbol, position_x, position_y, label, confiance
      FROM scan_elements WHERE id_scan = $1
    `, [id]);

    if (elementsResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Aucun element detecte dans ce scan' });
    }

    const { buildCircuitsFromDevices } = require('../services/circuitBuilder');
    const { computeBonDeCoupe } = require('../services/calculService');

    const circuits = await buildCircuitsFromDevices(elementsResult.rows, {
      maxPrisesParCircuit: options.maxPrisesParCircuit || 8,
      useRAG: options.useRAG !== false,
      context: {
        id_client: scanData.id_client,
        id_chantier: parseInt(id_chantier)
      }
    });

    if (circuits.length === 0) {
      return res.status(400).json({ success: false, error: 'Aucun circuit constructible depuis les elements detectes' });
    }

    const bonDeCoupe = await computeBonDeCoupe(id_chantier, circuits);

    res.json({
      success: true,
      data: {
        scan_id: parseInt(id),
        chantier_id: id_chantier,
        nb_circuits: circuits.length,
        circuits,
        bon_de_coupe: bonDeCoupe
      }
    });
  } catch (error) {
    console.error('Erreur POST /scans/:id/calculer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;