// ====================================================================
// PIEUVRE API - Routes Entreprises
// ====================================================================

const express = require('express');
const router = express.Router();
const { query } = require('../db/postgres');

// ====================================================================
// GET /api/entreprises - Liste des entreprises
// ====================================================================
router.get('/', async (req, res) => {
  try {
    const { actif } = req.query;
    let sql = 'SELECT * FROM entreprises';
    const params = [];
    
    if (actif !== undefined) {
      sql += ' WHERE actif = $1';
      params.push(actif === 'true');
    }
    
    sql += ' ORDER BY nom';
    const result = await query(sql, params);
    
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    console.error('Erreur GET /entreprises:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// GET /api/entreprises/:id - Détails entreprise
// ====================================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM entreprises WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Entreprise non trouvée' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Erreur GET /entreprises/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// POST /api/entreprises - Créer entreprise
// ====================================================================
router.post('/', async (req, res) => {
  try {
    const { nom, siret, adresse, telephone, email } = req.body;
    
    if (!nom) {
      return res.status(400).json({ success: false, error: 'Nom requis' });
    }
    
    const result = await query(
      `INSERT INTO entreprises (nom, siret, adresse, telephone, email) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nom, siret, adresse, telephone, email]
    );
    
    res.status(201).json({ success: true, message: 'Entreprise créée', data: result.rows[0] });
  } catch (error) {
    console.error('Erreur POST /entreprises:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// PUT /api/entreprises/:id - Modifier entreprise
// ====================================================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, siret, adresse, telephone, email, actif } = req.body;
    
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    if (nom) { fields.push(`nom = $${paramIndex++}`); values.push(nom); }
    if (siret) { fields.push(`siret = $${paramIndex++}`); values.push(siret); }
    if (adresse) { fields.push(`adresse = $${paramIndex++}`); values.push(adresse); }
    if (telephone) { fields.push(`telephone = $${paramIndex++}`); values.push(telephone); }
    if (email) { fields.push(`email = $${paramIndex++}`); values.push(email); }
    if (actif !== undefined) { fields.push(`actif = $${paramIndex++}`); values.push(actif); }
    
    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'Aucun champ à modifier' });
    }
    
    values.push(id);
    
    const result = await query(
      `UPDATE entreprises SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Entreprise non trouvée' });
    }
    
    res.json({ success: true, message: 'Entreprise modifiée', data: result.rows[0] });
  } catch (error) {
    console.error('Erreur PUT /entreprises/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;