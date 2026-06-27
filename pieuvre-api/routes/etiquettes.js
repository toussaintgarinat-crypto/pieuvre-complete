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

function parseJson(value, defaultValue = {}) {
  if (!value) return defaultValue;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return defaultValue;
  }
}

function safeParseJson(value, defaultValue = {}) {
  try {
    return value ? JSON.parse(value) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

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

/**
 * Construit la liste des étiquettes à partir du bon de coupe.
 * En mode 'atelier' : une étiquette par boîte regroupant les circuits passant par là.
 * En mode 'machine' : une étiquette par (type, section, gaine) pour optimisation découpe.
 */
function buildEtiquettes(calculRow, bonDeCoupe) {
  const data = calculRow;
  const circuits = bonDeCoupe.circuits || [];
  const gaines = bonDeCoupe.gaines || [];
  const etiquettes = [];
  let counter = 1;

  const gaineByCircuit = {};
  gaines.forEach(gaine => {
    (gaine.circuits || []).forEach(cid => {
      gaineByCircuit[cid] = gaine;
    });
  });

  circuits.forEach(circuit => {
    const typeCode = (circuit.type_code || circuit.type || 'L').toUpperCase();
    const gaine = gaineByCircuit[circuit.id] || { diametre: 20 };
    const nbPoints = circuit.nb_points || 1;

    // En mode atelier on regroupe par boîte. Si plusieurs points sur le même circuit,
    // on crée une étiquette par point (boîte d'encastrement).
    const nombreEtiquettes = nbPoints;

    for (let i = 0; i < nombreEtiquettes; i++) {
      etiquettes.push({
        id: `${typeCode}-${counter++}`,
        code: `${typeCode}-${circuit.numero_boite || counter}`,
        type: typeCode,
        nomGaine: `${typeCode}-${circuit.numero_boite || i + 1}`,
        fils: formatFilsForEtiquette(circuit.conducteurs || []),
        gaine: gaine.diametre,
        longueur: circuit.longueur_totale || circuit.longueur || 0,
        longueurBase: circuit.longueur || 0,
        section: (circuit.conducteurs || []).map(c => c.section).filter(Boolean).join(','),
        // Localisation
        batiment: circuit.batiment || data.batiment || '',
        etage: circuit.etage || data.chantier_etage || data.etage || '',
        logement: circuit.logement || circuit.appartement || data.chantier_appart || data.appartement || '',
        numeroBoite: circuit.numero_boite || i + 1,
        client: data.client_nom,
        chantier: (data.chantier_nom || '').substring(0, 12),
        circuit_id: circuit.id,
        est_alimentation: circuit.est_alimentation || false,
        est_derivation: circuit.est_derivation || false
      });
    }
  });

  return etiquettes;
}

/**
 * Regroupe les étiquettes selon le mode et l'ordre demandé.
 * - mode 'atelier' : regroupement par boîte (logement + boite)
 * - mode 'machine' : regroupement par type / section / gaine
 * L'ordre définit la priorité de tri.
 */
function groupEtiquettes(etiquettes, mode, ordre = ['logement', 'boite']) {
  const modeEff = mode === 'machine' ? 'machine' : 'atelier';

  // Clé de regroupement
  function groupKey(etq) {
    if (modeEff === 'machine') {
      return `${etq.type}|${etq.section}|${etq.gaine}`;
    }
    // Atelier : par boîte (logement + boite)
    return `${etq.logement || 'Sans logement'}|${etq.numeroBoite || 0}`;
  }

  // Fonction de tri selon l'ordre demandé
  function sortKey(etq) {
    return ordre.map(critere => {
      switch (critere) {
        case 'logement': return etq.logement || 'Sans logement';
        case 'boite': return String(etq.numeroBoite || 0).padStart(4, '0');
        case 'type': return etq.type;
        case 'section': return etq.section || '';
        case 'gaine': return String(etq.gaine || 0).padStart(3, '0');
        default: return '';
      }
    }).join('|');
  }

  // Grouper
  const groups = {};
  etiquettes.forEach(etq => {
    const key = groupKey(etq);
    if (!groups[key]) {
      groups[key] = {
        key,
        type: etq.type,
        nomGaine: modeEff === 'machine'
          ? `${etq.type}-${etq.section}-${etq.gaine}`
          : etq.nomGaine,
        fils: etq.fils,
        gaine: etq.gaine,
        longueur: 0,
        longueurBase: 0,
        count: 0,
        batiment: etq.batiment,
        etage: etq.etage,
        logement: etq.logement,
        numeroBoite: etq.numeroBoite,
        client: etq.client,
        chantier: etq.chantier,
        items: []
      };
    }
    const g = groups[key];
    g.longueur += etq.longueur;
    g.longueurBase += etq.longueurBase;
    g.count += 1;
    g.items.push(etq);
  });

  // En mode atelier, on garde le nom de la première étiquette comme référence
  // et on met à jour la longueur totale
  return Object.values(groups).map(g => ({
    ...g,
    longueur: g.longueur,
    longueurBase: g.longueurBase,
    // Nom de gaine 4x utilisé dans le rendu
    nomGaine4x: `${g.nomGaine} | ${g.nomGaine} | ${g.nomGaine} | ${g.nomGaine}`
  })).sort((a, b) => {
    const ka = sortKey(a);
    const kb = sortKey(b);
    return ka.localeCompare(kb, undefined, { numeric: true });
  });
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
// Query params :
//   config_id        : id de la config étiquette
//   mode_etiquetage  : 'atelier' (par boîte) ou 'machine' (par type/section/gaine)
//   regroupement     : JSON { ordre: ['logement','boite'] }
router.get('/generer/:calculId', async (req, res) => {
  try {
    const { calculId } = req.params;
    const { config_id, mode_etiquetage, regroupement: regroupementRaw } = req.query;

    const calcul = await query(
      `SELECT c.*, ch.nom as chantier_nom, ch.batiment, ch.etage as chantier_etage,
              ch.appartement as chantier_appart, ch.preferences_etiquettes as chantier_preferences,
              cl.nom as client_nom, cl.preferences_etiquettes as client_preferences
       FROM calculs c
       JOIN chantiers ch ON c.id_chantier = ch.id
       JOIN clients cl ON ch.id_client = cl.id
       WHERE c.id = $1`,
      [calculId]
    );

    if (calcul.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Calcul non trouvé' });
    }

    const data = calcul.rows[0];
    const bonDeCoupe = data.bon_de_coupe;

    // Résoudre les préférences d'étiquetage : requête > chantier > client > défaut
    const clientPrefs = parseJson(data.client_preferences, {});
    const chantierPrefs = parseJson(data.chantier_preferences, {});

    const prefs = {
      mode_etiquetage: mode_etiquetage || chantierPrefs.mode_etiquetage || clientPrefs.mode_etiquetage || data.mode_etiquetage || 'atelier',
      config_id: config_id || chantierPrefs.config_id || clientPrefs.config_id || null,
      ordre: regroupementRaw
        ? safeParseJson(regroupementRaw, { ordre: ['logement', 'boite'] }).ordre
        : chantierPrefs.regroupement?.ordre || clientPrefs.regroupement?.ordre || data.regroupement?.ordre || ['logement', 'boite']
    };

    // Récupérer la configuration
    let config = DEFAULT_CONFIG;
    const finalConfigId = prefs.config_id || config_id;
    if (finalConfigId) {
      const cfg = await query(`SELECT * FROM config_etiquette WHERE id = $1 AND actif = true`, [finalConfigId]);
      if (cfg.rows.length > 0) config = cfg.rows[0];
    } else {
      const cfg = await query(`SELECT * FROM config_etiquette WHERE est_defaut = true AND actif = true LIMIT 1`);
      if (cfg.rows.length > 0) config = cfg.rows[0];
    }

    let mode = prefs.mode_etiquetage.toLowerCase();
    if (!['atelier', 'machine'].includes(mode)) mode = 'atelier';

    const ordre = Array.isArray(prefs.ordre) ? prefs.ordre : ['logement', 'boite'];

    // Conversion mm en points (1mm = 2.83465 points)
    const MM_TO_PT = 2.83465;
    const labelWidth = config.largeur_mm * MM_TO_PT;
    const labelHeight = config.hauteur_mm * MM_TO_PT;
    const marge = (config.marge_mm || 2) * MM_TO_PT;
    const labelsPerRow = config.impressions_par_ligne || 3;

    const doc = new PDFDocument({
      size: 'A4',
      margin: 10,
      layout: config.orientation === 'paysage' ? 'landscape' : 'portrait'
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=etiquettes_${calculId}_${mode}.pdf`);
    doc.pipe(res);

    doc.fontSize(14).text('ÉTIQUETTES DE GAINES', { align: 'center' });
    doc.fontSize(9).text(`${data.client_nom} - ${data.chantier_nom}`, { align: 'center' });
    doc.fontSize(8).text(
      `Date: ${new Date(data.date_calcul).toLocaleDateString('fr-FR')} | ${data.utilisateur} | Mode: ${mode === 'machine' ? 'Machine' : 'Atelier'}`,
      { align: 'center' }
    );
    doc.moveDown(0.3);

    const colWidth = labelWidth + marge;

    function drawEtiquette(x, y, info) {
      const typeKey = (info.type || 'L').toUpperCase();
      const cat = CATEGORIES_CIRCUIT[typeKey] || { libelle: typeKey, bgColor: '#F5F5F5', borderColor: '#757575' };
      const contentWidth = labelWidth - 6;

      doc.fillColor(cat.bgColor).rect(x, y, labelWidth, labelHeight).fill();
      doc.strokeColor(cat.borderColor).lineWidth(1).rect(x, y, labelWidth, labelHeight).stroke();

      // LIGNE 1: CHANTIER + LOCALISATION + NUMÉRO BOÎTE (tout à droite)
      doc.fontSize(config.police_pied || 7).font('Helvetica').fillColor('#333');
      let ligne1 = '';
      if (info.chantier) ligne1 += `${info.chantier.substring(0, 8)} `;
      if (info.batiment) ligne1 += `Bt${info.batiment} `;
      if (info.etage) ligne1 += `E${info.etage} `;
      if (info.logement) ligne1 += `Lg${info.logement} `;
      if (info.numeroBoite && mode === 'atelier') ligne1 += `Bx${info.numeroBoite}`;
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
      const nom4x = info.nomGaine4x || `${info.nomGaine} | ${info.nomGaine} | ${info.nomGaine} | ${info.nomGaine}`;
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

    // Construire et regrouper les étiquettes
    const etiquettes = buildEtiquettes(data, bonDeCoupe);
    const groupes = groupEtiquettes(etiquettes, mode, ordre);

    let col = 0, row = 0, pageY = doc.y;

    groupes.forEach((info, index) => {
      if (pageY + labelHeight + 10 > 780) { doc.addPage(); pageY = 30; col = 0; row = 0; }

      const x = marge + (col % labelsPerRow) * colWidth;
      const y = pageY + row * (labelHeight + marge);

      drawEtiquette(x, y, info);

      col++;
      if (col % labelsPerRow === 0) { col = 0; row++; }
      if (col === 0 && index < groupes.length - 1) pageY = y + labelHeight + marge;
    });

    doc.fontSize(8);
    doc.moveDown(1);
    doc.text(`Total: ${groupes.length} étiquette(s) | Mode: ${mode} | Config: ${config.nom || 'Standard'}`, { align: 'center' });
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

// GET /api/etiquettes/impression/:sessionId
// Génère le PDF d'une session d'impression existante
router.get('/impression/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const sessionResult = await query(
      `SELECT * FROM impression_sessions WHERE id = $1`,
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session non trouvée' });
    }

    const session = sessionResult.rows[0];

    // Rediriger vers le générateur PDF avec les paramètres de la session
    const params = new URLSearchParams();
    if (session.mode_etiquetage) params.set('mode_etiquetage', session.mode_etiquetage);
    if (session.regroupement) params.set('regroupement', JSON.stringify(session.regroupement));

    const redirectUrl = `/api/etiquettes/generer/${session.id_calcul}?${params.toString()}`;
    res.redirect(redirectUrl);

  } catch (error) {
    console.error('Erreur GET /etiquettes/impression/:sessionId:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
module.exports.buildEtiquettes = buildEtiquettes;
module.exports.groupEtiquettes = groupEtiquettes;
module.exports.formatFilsForEtiquette = formatFilsForEtiquette;