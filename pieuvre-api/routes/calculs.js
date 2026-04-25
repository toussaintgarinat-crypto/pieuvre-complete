// ====================================================================
// PIEUVRE API - Routes Calculs
// ====================================================================

const express = require('express');
const router = express.Router();
const { query } = require('../db/postgres');
const { generateBonDeCoupe } = require('../utils/algorithms');

// Types de circuits : conducteurs requis selon type
function expandCircuit(circuit, profil) {
  const type = (circuit.type || '').toLowerCase();
  const couleursPreferees = profil.couleurs_preferees || ['Rouge', 'Bleu', 'Vert/Jaune', 'Orange', 'Noir', 'Violet', 'Marron'];
  const couleurPhase = couleursPreferees.find(c => c !== 'Bleu' && c !== 'Vert/Jaune') || 'Rouge';

  const base = {
    id: circuit.id,
    type,
    longueur: parseFloat(circuit.longueur) || 0,
    phase_required: true,
    neutre_required: true,
    terre_required: true,
    phase_couleur: couleurPhase,
    navettes: []
  };

  switch (type) {
    case 'prise':
    case 'p': {
      const s = parseFloat(profil.prises_section) || 2.5;
      return { ...base, phase_section: s, neutre_section: s, terre_section: s };
    }
    case 'lumiere':
    case 'l': {
      const s = parseFloat(profil.eclairage_section) || 1.5;
      return { ...base, phase_section: s, neutre_section: s, terre_section: s };
    }
    case 'va-et-vient':
    case 'vd': {
      const s = parseFloat(profil.eclairage_section) || 1.5;
      const nav = couleursPreferees.filter(c => c !== 'Bleu' && c !== 'Vert/Jaune' && c !== couleurPhase);
      return {
        ...base, phase_section: s, neutre_section: s, terre_section: s,
        navettes: [
          { couleur: nav[0] || 'Orange', section: s },
          { couleur: nav[1] || 'Violet', section: s }
        ]
      };
    }
    case 'double-allumage':
    case 'da': {
      const s = parseFloat(profil.eclairage_section) || 1.5;
      const nav = couleursPreferees.filter(c => c !== 'Bleu' && c !== 'Vert/Jaune' && c !== couleurPhase);
      return {
        ...base, phase_section: s, neutre_section: s, terre_section: s,
        navettes: [
          { couleur: nav[0] || 'Orange', section: s },
          { couleur: nav[1] || 'Violet', section: s },
          { couleur: nav[2] || 'Marron', section: s }
        ]
      };
    }
    case 'telerupteur':
    case 'tel': {
      const s = parseFloat(profil.eclairage_section) || 1.5;
      const nav = couleursPreferees.filter(c => c !== 'Bleu' && c !== 'Vert/Jaune' && c !== couleurPhase);
      return {
        ...base, phase_section: s, neutre_section: s, terre_section: s,
        navettes: [{ couleur: nav[0] || 'Orange', section: s }]
      };
    }
    case 'volet':
    case 'vr': {
      const s = 1.5;
      const nav = couleursPreferees.filter(c => c !== 'Bleu' && c !== 'Vert/Jaune' && c !== couleurPhase);
      return {
        ...base, phase_section: s, neutre_section: s, terre_section: s,
        navettes: [
          { couleur: nav[0] || 'Orange', section: s },
          { couleur: nav[1] || 'Violet', section: s }
        ]
      };
    }
    case 'cuisiniere':
    case 'cuis': {
      const s = parseFloat(profil.cuisson_section) || 6.0;
      return { ...base, phase_section: s, neutre_section: s, terre_section: s };
    }
    case 'vmc': {
      const s = 1.5;
      return { ...base, phase_section: s, neutre_section: s, terre_section: s };
    }
    case 'bs': {
      const s = 1.5;
      return { ...base, phase_section: s, neutre_section: s, terre_section: s };
    }
    default: {
      const s = parseFloat(profil.prises_section) || 2.5;
      return { ...base, phase_section: s, neutre_section: s, terre_section: s };
    }
  }
}

// ====================================================================
// POST /api/calculs/compute - Calculer un bon de coupe (sans sauvegarder)
// ====================================================================
router.post('/compute', async (req, res) => {
  try {
    const { id_chantier, circuits } = req.body;

    if (!id_chantier || !Array.isArray(circuits) || circuits.length === 0) {
      return res.status(400).json({ success: false, error: 'id_chantier et circuits[] sont requis' });
    }

    // Récupérer le profil du chantier (sections, marges, couleurs)
    const profilResult = await query(`
      SELECT
        COALESCE(ch.prises_section, cl.prises_section) AS prises_section,
        COALESCE(ch.eclairage_section, cl.eclairage_section) AS eclairage_section,
        COALESCE(ch.volets_section, cl.volets_section) AS volets_section,
        COALESCE(ch.cuisson_section, cl.cuisson_section) AS cuisson_section,
        COALESCE(ch.marge_fils, cl.marge_fils, 10) AS marge_fils,
        COALESCE(ch.marge_gaines, cl.marge_gaines, 10) AS marge_gaines,
        COALESCE(ch.longueur_min_fils, cl.longueur_min_fils, 1) AS longueur_min_fils,
        COALESCE(ch.longueur_min_gaines, cl.longueur_min_gaines, 1) AS longueur_min_gaines,
        COALESCE(ch.gaines_disponibles, cl.gaines_disponibles) AS gaines_disponibles,
        cl.couleurs_preferees
      FROM chantiers ch
      JOIN clients cl ON ch.id_client = cl.id
      WHERE ch.id = $1
    `, [id_chantier]);

    if (profilResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Chantier non trouvé' });
    }

    const profil = profilResult.rows[0];
    if (profil.gaines_disponibles && typeof profil.gaines_disponibles === 'string') {
      profil.gaines_disponibles = JSON.parse(profil.gaines_disponibles);
    }
    if (profil.couleurs_preferees && typeof profil.couleurs_preferees === 'string') {
      profil.couleurs_preferees = JSON.parse(profil.couleurs_preferees);
    }

    // Récupérer le stock
    const stockCouleursResult = await query('SELECT couleur, section, quantite_metres, seuil_alerte FROM stock_couleurs');
    const stockGainesResult = await query('SELECT diametre, quantite_metres, seuil_alerte FROM stock_gaines');

    // Convertir les circuits simplifiés en circuits complets
    const circuitsComplets = circuits.map(c => expandCircuit(c, profil));

    // Générer le bon de coupe
    const bonDeCoupe = generateBonDeCoupe(
      circuitsComplets,
      stockCouleursResult.rows,
      profil,
      stockGainesResult.rows
    );

    res.json({ success: true, data: bonDeCoupe });
  } catch (error) {
    console.error('Erreur POST /calculs/compute:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// POST /api/calculs - Créer un nouveau calcul
// ====================================================================
router.post('/', async (req, res) => {
  try {
    const {
      id_chantier,
      utilisateur,
      bon_de_coupe,
      fichier_dwg_path,
      commentaire
    } = req.body;
    
    if (!id_chantier || !utilisateur || !bon_de_coupe) {
      return res.status(400).json({
        success: false,
        error: 'id_chantier, utilisateur et bon_de_coupe sont requis'
      });
    }
    
    const result = await query(
      `INSERT INTO calculs (
        id_chantier, utilisateur, bon_de_coupe, fichier_dwg_path, commentaire
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        id_chantier,
        utilisateur,
        JSON.stringify(bon_de_coupe),
        fichier_dwg_path,
        commentaire
      ]
    );
    
    res.status(201).json({
      success: true,
      message: 'Calcul enregistré avec succès',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur POST /calculs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================================================
// GET /api/calculs/chantier/:id - Historique d'un chantier
// ====================================================================
router.get('/chantier/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;
    
    const result = await query(
      `SELECT * FROM calculs 
       WHERE id_chantier = $1 
       ORDER BY date_calcul DESC 
       LIMIT $2`,
      [id, parseInt(limit)]
    );
    
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Erreur GET /calculs/chantier/:id:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================================================
// GET /api/calculs/:id - Détails d'un calcul
// ====================================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      `SELECT 
        c.*,
        ch.nom as chantier_nom,
        cl.nom as client_nom
       FROM calculs c
       JOIN chantiers ch ON c.id_chantier = ch.id
       JOIN clients cl ON ch.id_client = cl.id
       WHERE c.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Calcul non trouvé'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur GET /calculs/:id:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================================================
// GET /api/calculs - Liste tous les calculs (avec filtres)
// ====================================================================
router.get('/', async (req, res) => {
  try {
    const { utilisateur, limit = 100, offset = 0 } = req.query;
    
    let sql = `
      SELECT 
        c.*,
        ch.nom as chantier_nom,
        cl.nom as client_nom
      FROM calculs c
      JOIN chantiers ch ON c.id_chantier = ch.id
      JOIN clients cl ON ch.id_client = cl.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (utilisateur) {
      sql += ` AND c.utilisateur = $${paramIndex++}`;
      params.push(utilisateur);
    }
    
    sql += ` ORDER BY c.date_calcul DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await query(sql, params);
    
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Erreur GET /calculs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================================================
// DELETE /api/calculs/:id - Supprimer un calcul
// ====================================================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'DELETE FROM calculs WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Calcul non trouvé'
      });
    }
    
    res.json({
      success: true,
      message: 'Calcul supprimé avec succès'
    });
  } catch (error) {
    console.error('Erreur DELETE /calculs/:id:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================================================
// GET /api/calculs/stats/global - Statistiques globales
// ====================================================================
router.get('/stats/global', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        COUNT(*) as total_calculs,
        COUNT(DISTINCT id_chantier) as chantiers_couverts,
        COUNT(DISTINCT utilisateur) as utilisateurs_actifs,
        MAX(date_calcul) as dernier_calcul
      FROM calculs
    `);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur GET /calculs/stats/global:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
