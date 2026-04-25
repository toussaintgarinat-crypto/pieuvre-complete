// ====================================================================
// PIEUVRE API - Gestion des Normes et Paramètres
// ====================================================================

const express = require('express');
const router = express.Router();
const { query } = require('../db/postgres');

// GET /api/normes - Liste des normes
router.get('/normes', async (req, res) => {
  try {
    const result = await query(`SELECT * FROM normes WHERE actif = true ORDER BY nom`);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/normes/:nom - Get norme par nom
router.get('/normes/:nom', async (req, res) => {
  try {
    const result = await query(`SELECT * FROM normes WHERE nom = $1 AND actif = true`, [req.params.nom]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Norme non trouvée' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/normes/:nom - Modifier une norme
router.put('/normes/:nom', async (req, res) => {
  try {
    const { valeur, description } = req.body;
    const { nom } = req.params;
    
    const result = await query(
      `UPDATE normes SET valeur = COALESCE($1, valeur), description = COALESCE($2, description), updated_at = NOW()
       WHERE nom = $3 RETURNING *`,
      [valeur, description, nom]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Norme non trouvée' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/parametres - Liste des paramètres
router.get('/parametres', async (req, res) => {
  try {
    const { categorie } = req.query;
    let sql = `SELECT * FROM parametres`;
    const params = [];
    
    if (categorie) {
      sql += ` WHERE categorie = $1`;
      params.push(categorie);
    }
    
    sql += ` ORDER BY cle`;
    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/parametres/:cle - Get paramètre par clé
router.get('/parametres/:cle', async (req, res) => {
  try {
    const result = await query(`SELECT * FROM parametres WHERE cle = $1`, [req.params.cle]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Paramètre non trouvé' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/parametres/:cle - Modifier un paramètre
router.put('/parametres/:cle', async (req, res) => {
  try {
    const { valeur, description } = req.body;
    const { cle } = req.params;
    
    const result = await query(
      `UPDATE parametres SET valeur = COALESCE($1, valeur), description = COALESCE($2, description), updated_at = NOW()
       WHERE cle = $3 RETURNING *`,
      [valeur, description, cle]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Paramètre non trouvé' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/config - Get config combinée (normes +paramètres)
router.get('/config', async (req, res) => {
  try {
    const normes = await query(`SELECT nom, valeur, unite FROM normes WHERE actif = true`);
    const parametres = await query(`SELECT cle, valeur FROM parametres`);
    
    res.json({
      success: true,
      data: {
        normes: normes.rows,
        parametres: parametres.rows
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;