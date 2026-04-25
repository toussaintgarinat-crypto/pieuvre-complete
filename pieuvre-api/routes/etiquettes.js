// ====================================================================
// PIEUVRE API - Générateur d'étiquettes
// ====================================================================

const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const { query } = require('../db/postgres');

const CATEGORIES_CIRCUIT = {
  'P': { libelle: 'PRISE', bgColor: '#E3F2FD', borderColor: '#1976D2' },
  'P15': { libelle: 'PRISE 1.5', bgColor: '#E3F2FD', borderColor: '#1976D2' },
  'L': { libelle: 'LUMIÈRE', bgColor: '#FFF9C4', borderColor: '#FBC02D' },
  'L15': { libelle: 'LUMIÈRE', bgColor: '#FFF9C4', borderColor: '#FBC02D' },
  'VD': { libelle: 'VA-ET-VIENT', bgColor: '#E1BEE7', borderColor: '#7B1FA2' },
  'DA': { libelle: 'DOUBLE ALLUM.', bgColor: '#E1BEE7', borderColor: '#7B1FA2' },
  'TEL': { libelle: 'TÉLÉRUPEUR', bgColor: '#D1C4E9', borderColor: '#512DA8' },
  'TE': { libelle: 'TÉLÉRUPEUR', bgColor: '#D1C4E9', borderColor: '#512DA8' },
  'BS': { libelle: 'BLOC SECOURS', bgColor: '#FFCDD2', borderColor: '#C62828' },
  'DA_S': { libelle: 'DOUBLE ALLUM. SEC.', bgColor: '#FFCDD2', borderColor: '#C62828' },
  'VMC': { libelle: 'VMC', bgColor: '#B2EBF2', borderColor: '#00838F' },
  'VR': { libelle: 'VOLET ROULANT', bgColor: '#CFD8DC', borderColor: '#455A64' },
  'CUIS': { libelle: 'CUISINIÈRE', bgColor: '#FFCCBC', borderColor: '#BF360C' },
  'LL': { libelle: 'LAVE-LINGE', bgColor: '#FFCCBC', borderColor: '#BF360C' },
  'LV': { libelle: 'LAVE-VAISSELLE', bgColor: '#FFCCBC', borderColor: '#BF360C' },
  'PG': { libelle: 'PRISE EXTÉRIEUR', bgColor: '#C8E6C9', borderColor: '#2E7D32' },
  'ALIM': { libelle: 'ALIMENTATION', bgColor: '#FFECB3', borderColor: '#FF8F00' }
};

// Configuration par défaut si pas en base
const DEFAULT_CONFIG = {
  largeur_mm: 70,
  hauteur_mm: 35,
  impressions_par_ligne: 3,
  police_titre: 10,
  police_corps: 8,
  police_pied: 7,
  marge_mm: 2
};

function formatFilsForEtiquette(fils) {
  const sections = {};
  fils.forEach(fil => {
    const section = fil.section;
    if (!sections[section]) sections[section] = [];
    let couleurAbrev = fil.couleur || '';
    if (couleurAbrev === 'Vert/Jaune') couleurAbrev = 'V/J';
    sections[section].push(couleurAbrev);
  });
  const lignes = [];
  Object.keys(sections).sort((a, b) => b - a).forEach(section => {
    const couleurs = sections[section].join(' ');
    lignes.push(`${couleurs} ${section}mm²`);
  });
  return lignes;
}

// GET /api/etiquettes/config - Liste des configurations
router.get('/config', async (req, res) => {
  try {
    const configs = await query(`SELECT * FROM config_etiquette WHERE actif = true ORDER BY est_defaut DESC, nom`);
    const types = await query(`SELECT code, libelle FROM types_circuits WHERE actif = true ORDER BY ordre_affichage`);
    res.json({ success: true, data: { configurations: configs.rows, types_circuit: types.rows } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/etiquettes/config - Créer/modifier configuration
router.post('/config', async (req, res) => {
  try {
    const { nom, description, largeur_mm, hauteur_mm, impressions_par_ligne, est_defaut } = req.body;
    if (!nom) return res.status(400).json({ success: false, error: 'nom requis' });
    
    if (est_defaut) {
      await query(`UPDATE config_etiquette SET est_defaut = false WHERE est_defaut = true`);
    }
    
    const result = await query(
      `INSERT INTO config_etiquette (nom, description, largeur_mm, hauteur_mm, impressions_par_ligne, est_defaut)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nom, description, largeur_mm || 70, hauteur_mm || 35, impressions_par_ligne || 3, est_defaut || false]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ success: false, error: 'Configuration déjà existante' });
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/etiquettes/generer/:calculId
router.get('/generer/:calculId', async (req, res) => {
  try {
    const { calculId } = req.params;
    const { config_id } = req.query;
    
    // Récupérer la configuration
    let config = DEFAULT_CONFIG;
    if (config_id) {
      const cfg = await query(`SELECT * FROM config_etiquette WHERE id = $1 AND actif = true`, [config_id]);
      if (cfg.rows.length > 0) config = cfg.rows[0];
    } else {
      const cfg = await query(`SELECT * FROM config_etiquette WHERE est_defaut = true AND actif = true LIMIT 1`);
      if (cfg.rows.length > 0) config = cfg.rows[0];
    }
    
    const calcul = await query(
      `SELECT c.*, ch.nom as chantier_nom, ch.batiment, ch.etage as chantier_etage, 
              ch.appartement as chantier_appart, cl.nom as client_nom
       FROM calculs c
       JOIN ${'chantiers'} ch ON c.id_chantier = ch.id
       JOIN clients cl ON ch.id_client = cl.id
       WHERE c.id = $1`,
      [calculId]
    );
    
    if (calcul.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Calcul non trouvé' });
    }
    
    const data = calcul.rows[0];
    const bonDeCoupe = data.bon_de_coupe;
    
    // Conversion mm en points (1mm = 2.83465 points)
    const MM_TO_PT = 2.83465;
    const labelWidth = config.largeur_mm * MM_TO_PT;
    const labelHeight = config.hauteur_mm * MM_TO_PT;
    const marge = (config.marge_mm || 2) * MM_TO_PT;
    const labelsPerRow = config.impressions_par_ligne || 3;
    
    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 10, 
      layout: config.orientation === 'portrait' ? 'portrait' : 'portrait' 
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=etiquettes_${calculId}.pdf`);
    doc.pipe(res);
    
    doc.fontSize(14).text('ÉTIQUETTES DE GAINES', { align: 'center' });
    doc.fontSize(9).text(`${data.client_nom} - ${data.chantier_nom}`, { align: 'center' });
    doc.fontSize(8).text(`Date: ${new Date(data.date_calcul).toLocaleDateString('fr-FR')} | ${data.utilisateur}`, { align: 'center' });
    doc.moveDown(0.3);
    
    const colWidth = labelWidth + marge;
    
    function drawEtiquette(x, y, info) {
      const cat = CATEGORIES_CIRCUIT[info.type] || { libelle: info.type, bgColor: '#F5F5F5', borderColor: '#757575' };
      const contentWidth = labelWidth - 6;
      
      doc.fillColor(cat.bgColor).rect(x, y, labelWidth, labelHeight).fill();
      doc.strokeColor(cat.borderColor).lineWidth(1).rect(x, y, labelWidth, labelHeight).stroke();
      
      // LIGNE 1: CHANTIER + LOCALISATION + NUMÉRO BOÎTE (tout à droite)
      doc.fontSize(config.police_pied || 7).font('Helvetica').fillColor('#333');
      let ligne1 = '';
      if (info.chantier) ligne1 += `${info.chantier.substring(0,8)} `;
      if (info.batiment) ligne1 += `Bt${info.batiment} `;
      if (info.etage) ligne1 += `E${info.etage} `;
      if (info.logement) ligne1 += `Lg${info.logement} `;
      if (info.numeroBoite) ligne1 += `Bx${info.numeroBoite}`;
      doc.text(ligne1, x + 3, y + 2, { width: contentWidth, align: 'right' });
      
      // LIGNE 2: NOM GAINE (centré, grand)
      doc.moveTo(x + 3, y + 10).lineTo(x + labelWidth - 3, y + 10).stroke('#666');
      doc.fontSize(config.police_titre || 10).font('Helvetica-Bold').fillColor('#000');
      doc.text(info.nomGaine, x + 3, y + 12, { width: contentWidth, align: 'center' });
      
      // LIGNES 3-4: FILS (à droite)
      doc.fontSize(config.police_corps || 8).font('Helvetica').fillColor('#000');
      let yFils = y + 32;
      const filsAffiche = info.fils.slice(-2).reverse();
      filsAffiche.forEach(ligne => {
        doc.text(ligne.substring(0, 18), x + 3, yFils - 6, { width: contentWidth, align: 'right' });
        yFils -= 6;
      });
      
      // LIGNE 5: NOM GAINE 4× (centré)
      doc.moveTo(x + 3, y + 44).lineTo(x + labelWidth - 3, y + 44).stroke('#666');
      const nom4x = `${info.nomGaine} | ${info.nomGaine} | ${info.nomGaine} | ${info.nomGaine}`;
      doc.fontSize(config.police_pied || 7).font('Helvetica-Bold').fillColor('#000');
      doc.text(nom4x, x + 3, y + 46, { width: contentWidth, align: 'center' });
      
      // LIGNE 6: CLIENT | LONGUEUR | ICTA
      doc.fontSize(config.police_corps || 8).font('Helvetica-Bold').fillColor('#1565C0');
      const longueurBase = info.longueurBase || info.longueur;
      const texteLong = `${info.longueur.toFixed(1)}m / ${longueurBase.toFixed(1)}m`;
      doc.text(texteLong, x + labelWidth / 2 - 15, y + 60, { width: 35, align: 'center' });
      
      doc.fontSize(config.police_pied || 7).font('Helvetica').fillColor('#666');
      if (info.client) doc.text(info.client.substring(0, 10), x + 3, y + 62, { width: 40, align: 'left' });
      
      doc.fontSize(config.police_corps || 8).font('Helvetica-Bold').fillColor('#1565C0');
      doc.text(`ICTA ${info.gaine}`, x + labelWidth - 25, y + 60, { width: 22, align: 'right' });
    }
    
    // Collecter les circuits
    const circuitsMap = new Map();
    let numeroF = 1;
    
    if (bonDeCoupe.circuits) {
      bonDeCoupe.circuits.forEach(circuit => {
        const typeCode = circuit.type_code || circuit.type || 'L';
        const key = `${typeCode}-${circuit.etage || ''}-${circuit.logement || ''}-${circuit.numero_boite || ''}`;
        
        if (!circuitsMap.has(key)) {
          circuitsMap.set(key, {
            type: typeCode,
            nomGaine: `${typeCode}-${numeroF++}`,
            fils: formatFilsForEtiquette(circuit.conducteurs || []),
            gaine: 20,
            longueur: 0,
            longueurBase: 0,
            etage: circuit.etage,
            logement: circuit.logement,
            numeroBoite: circuit.numero_boite,
            batiment: circuit.batiment,
            client: data.client_nom,
            chantier: data.chantier_nom.substring(0, 12)
          });
        } else {
          const c = circuitsMap.get(key);
          c.longueur += circuit.longueur || 0;
          c.longueurBase += circuit.longueur_base || circuit.longueur || 0;
        }
        
        if (bonDeCoupe.gaines) {
          const gasso = bonDeCoupe.gaines.find(g => g.circuits && g.circuits.some(c => c.includes(circuit.id)));
          if (gasso) circuitsMap.get(key).gaine = gasso.diametre;
        }
      });
    }
    
    const tousCircuits = Array.from(circuitsMap.values());
    tousCircuits.sort((a, b) => a.nomGaine.localeCompare(b.nomGaine, undefined, { numeric: true }));
    
    let col = 0, row = 0, pageY = doc.y;
    
    tousCircuits.forEach((info, index) => {
      if (pageY + labelHeight + 10 > 780) { doc.addPage(); pageY = 30; col = 0; row = 0; }
      
      const x = marge + (col % labelsPerRow) * colWidth;
      const y = pageY + row * (labelHeight + marge);
      
      drawEtiquette(x, y, info);
      
      col++;
      if (col % labelsPerRow === 0) { col = 0; row++; }
      if (col === 0 && index < tousCircuits.length - 1) pageY = y + labelHeight + marge;
    });
    
    doc.fontSize(8);
    doc.moveDown(1);
    doc.text(`Total: ${tousCircuits.length} étiquettes | Config: ${config.nom || 'Standard'}`, { align: 'center' });
    doc.text('Généré par Pieuvre Auto', { align: 'center' });
    
    doc.end();
  } catch (error) {
    console.error('Erreur GET /etiquettes/generer/:calculId:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/types-circuits', async (req, res) => {
  try {
    const result = await query(`SELECT * FROM types_circuits WHERE actif = true ORDER BY ordre_affichage`);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/types-circuits', async (req, res) => {
  try {
    const { code, libelle, description, categorie, section_par_defaut, ordre_affichage } = req.body;
    if (!code || !libelle) return res.status(400).json({ success: false, error: 'code et libelle requis' });
    
    const result = await query(
      `INSERT INTO types_circuits (code, libelle, description, categorie, section_par_defaut, ordre_affichage, style)
       VALUES ($1, $2, $3, $4, $5, $6, '{}'::jsonb) RETURNING *`,
      [code, libelle, description, categorie, section_par_defaut, ordre_affichage || 99]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ success: false, error: 'Code déjà existant' });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;