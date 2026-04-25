// ====================================================================
// PIEUVRE API - Routes Stock
// ====================================================================

const express = require('express');
const router = express.Router();
const { query } = require('../db/postgres');

// ====================================================================
// GET /api/stock/couleurs - Liste stock couleurs
// ====================================================================
router.get('/couleurs', async (req, res) => {
  try {
    const { section, sous_seuil } = req.query;
    
    let sql = 'SELECT * FROM stock_couleurs WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (section) {
      sql += ` AND section = $${paramIndex++}`;
      params.push(parseFloat(section));
    }
    
    if (sous_seuil === 'true') {
      sql += ' AND quantite_metres < seuil_alerte';
    }
    
    sql += ' ORDER BY couleur ASC, section ASC';
    
    const result = await query(sql, params);
    
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Erreur GET /stock/couleurs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================================================
// GET /api/stock/gaines - Liste stock gaines
// ====================================================================
router.get('/gaines', async (req, res) => {
  try {
    const { sous_seuil } = req.query;
    
    let sql = 'SELECT * FROM stock_gaines WHERE 1=1';
    
    if (sous_seuil === 'true') {
      sql += ' AND quantite_metres < seuil_alerte';
    }
    
    sql += ' ORDER BY diametre ASC';
    
    const result = await query(sql);
    
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Erreur GET /stock/gaines:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================================================
// GET /api/stock/alertes - Liste des alertes stock
// ====================================================================
router.get('/alertes', async (req, res) => {
  try {
    const result = await query('SELECT * FROM v_alertes_stock');
    
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Erreur GET /stock/alertes:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================================================
// PUT /api/stock/couleurs/:id - Mise à jour quantité couleur
// ====================================================================
router.put('/couleurs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { quantite_metres, updated_by, seuil_alerte } = req.body;
    
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    if (quantite_metres !== undefined) {
      fields.push(`quantite_metres = $${paramIndex++}`);
      values.push(quantite_metres);
    }
    
    if (seuil_alerte !== undefined) {
      fields.push(`seuil_alerte = $${paramIndex++}`);
      values.push(seuil_alerte);
    }
    
    if (updated_by) {
      fields.push(`updated_by = $${paramIndex++}`);
      values.push(updated_by);
    }
    
    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Aucun champ à modifier'
      });
    }
    
    values.push(id);
    
    const result = await query(
      `UPDATE stock_couleurs 
       SET ${fields.join(', ')} 
       WHERE id = $${paramIndex} 
       RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Stock non trouvé'
      });
    }
    
    res.json({
      success: true,
      message: 'Stock mis à jour avec succès',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur PUT /stock/couleurs/:id:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================================================
// PUT /api/stock/gaines/:id - Mise à jour quantité gaine
// ====================================================================
router.put('/gaines/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { quantite_metres, updated_by, seuil_alerte } = req.body;
    
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    if (quantite_metres !== undefined) {
      fields.push(`quantite_metres = $${paramIndex++}`);
      values.push(quantite_metres);
    }
    
    if (seuil_alerte !== undefined) {
      fields.push(`seuil_alerte = $${paramIndex++}`);
      values.push(seuil_alerte);
    }
    
    if (updated_by) {
      fields.push(`updated_by = $${paramIndex++}`);
      values.push(updated_by);
    }
    
    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Aucun champ à modifier'
      });
    }
    
    values.push(id);
    
    const result = await query(
      `UPDATE stock_gaines 
       SET ${fields.join(', ')} 
       WHERE id = $${paramIndex} 
       RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Stock non trouvé'
      });
    }
    
    res.json({
      success: true,
      message: 'Stock mis à jour avec succès',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur PUT /stock/gaines/:id:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================================================
// POST /api/stock/couleurs/batch - Mise à jour en masse
// ====================================================================
router.post('/couleurs/batch', async (req, res) => {
  try {
    const { updates, updated_by } = req.body;
    
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Le tableau updates est requis'
      });
    }
    
    const results = [];
    
    for (const update of updates) {
      const { couleur, section, quantite_metres } = update;
      
      const result = await query(
        `UPDATE stock_couleurs 
         SET quantite_metres = $1, updated_by = $2 
         WHERE couleur = $3 AND section = $4 
         RETURNING *`,
        [quantite_metres, updated_by || 'batch', couleur, section]
      );
      
      if (result.rows.length > 0) {
        results.push(result.rows[0]);
      }
    }
    
    res.json({
      success: true,
      message: `${results.length} lignes mises à jour`,
      data: results
    });
  } catch (error) {
    console.error('Erreur POST /stock/couleurs/batch:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================================================
// POST /api/stock/gaines/batch - Mise à jour en masse
// ====================================================================
router.post('/gaines/batch', async (req, res) => {
  try {
    const { updates, updated_by } = req.body;
    
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Le tableau updates est requis'
      });
    }
    
    const results = [];
    
    for (const update of updates) {
      const { diametre, quantite_metres } = update;
      
      const result = await query(
        `UPDATE stock_gaines 
         SET quantite_metres = $1, updated_by = $2 
         WHERE diametre = $3 
         RETURNING *`,
        [quantite_metres, updated_by || 'batch', diametre]
      );
      
      if (result.rows.length > 0) {
        results.push(result.rows[0]);
      }
    }
    
    res.json({
      success: true,
      message: `${results.length} lignes mises à jour`,
      data: results
    });
  } catch (error) {
    console.error('Erreur POST /stock/gaines/batch:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================================================
// GET /api/stock/historique - Historique des modifications
// ====================================================================
router.get('/historique', async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    
    const result = await query(
      `SELECT * FROM historique_stock 
       ORDER BY timestamp DESC 
       LIMIT $1`,
      [parseInt(limit)]
    );
    
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Erreur GET /stock/historique:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================================================
// POST /api/stock/check - Vérifier disponibilité
// ====================================================================
router.post('/check', async (req, res) => {
  try {
    const { items } = req.body;
    // items = [{couleur, section, longueur_requise}, ...]
    
    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: 'items doit être un tableau'
      });
    }
    
    const checks = [];
    
    for (const item of items) {
      const { couleur, section, longueur_requise } = item;
      
      const result = await query(
        `SELECT check_stock_disponible($1, $2, $3) as disponible`,
        [couleur, section, longueur_requise]
      );
      
      const stockResult = await query(
        'SELECT quantite_metres FROM stock_couleurs WHERE couleur = $1 AND section = $2',
        [couleur, section]
      );
      
      checks.push({
        ...item,
        disponible: result.rows[0].disponible,
        stock_actuel: stockResult.rows[0]?.quantite_metres || 0
      });
    }
    
    res.json({
      success: true,
      data: checks
    });
  } catch (error) {
    console.error('Erreur POST /stock/check:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
