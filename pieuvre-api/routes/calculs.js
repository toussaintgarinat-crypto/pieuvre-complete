// ====================================================================
// PIEUVRE API - Routes Calculs
// ====================================================================

const express = require('express');
const router = express.Router();
const { query } = require('../db/postgres');
const { generateBonDeCoupe } = require('../utils/algorithms');

const { computeBonDeCoupe } = require('../services/calculService');

// ====================================================================
// POST /api/calculs/compute - Calculer un bon de coupe (sans sauvegarder)
// ====================================================================
router.post('/compute', async (req, res) => {
  try {
    const { id_chantier, circuits, mode_production, mode_etiquetage, regroupement } = req.body;

    if (!id_chantier || !Array.isArray(circuits) || circuits.length === 0) {
      return res.status(400).json({ success: false, error: 'id_chantier et circuits[] sont requis' });
    }

    const bonDeCoupe = await computeBonDeCoupe(id_chantier, circuits, {
      mode_production,
      mode_etiquetage,
      regroupement
    });

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
      commentaire,
      mode_production,
      mode_etiquetage,
      regroupement
    } = req.body;
    
    if (!id_chantier || !utilisateur || !bon_de_coupe) {
      return res.status(400).json({
        success: false,
        error: 'id_chantier, utilisateur et bon_de_coupe sont requis'
      });
    }
    
    const result = await query(
      `INSERT INTO calculs (
        id_chantier, utilisateur, bon_de_coupe, fichier_dwg_path, commentaire,
        mode_production, mode_etiquetage, regroupement
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        id_chantier,
        utilisateur,
        JSON.stringify(bon_de_coupe),
        fichier_dwg_path,
        commentaire,
        mode_production || bon_de_coupe.mode_production || 'direct',
        mode_etiquetage || bon_de_coupe.mode_etiquetage || 'atelier',
        regroupement ? JSON.stringify(regroupement) : JSON.stringify(bon_de_coupe.regroupement || { ordre: ['logement', 'boite'], grouper_par: [] })
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
