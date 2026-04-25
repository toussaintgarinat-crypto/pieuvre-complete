// ====================================================================
// PIEUVRE API - Routes Rappels
// ====================================================================

const express = require('express');
const router = express.Router();
const { query } = require('../db/postgres');

// ====================================================================
// GET /api/rappels - Liste des rappels
// ====================================================================
router.get('/', async (req, res) => {
  try {
    const { actif, type } = req.query;
    let sql = 'SELECT r.*, u.nom as utilisateur_nom FROM rappels r LEFT JOIN utilisateurs u ON r.utilisateur_id = u.id WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (actif !== undefined) {
      sql += ` AND r.actif = $${paramIndex++}`;
      params.push(actif === 'true');
    }
    if (type) {
      sql += ` AND r.type = $${paramIndex++}`;
      params.push(type);
    }
    
    sql += ' ORDER BY r.prochain_envoi';
    const result = await query(sql, params);
    
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    console.error('Erreur GET /rappels:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// POST /api/rappels - Créer un rappel
// ====================================================================
router.post('/', async (req, res) => {
  try {
    const { type, titre, message, jours_avant, produit_type, produit_id, seuil_stock, utilisateur_id, groupe, frequence } = req.body;
    
    if (!type || !titre) {
      return res.status(400).json({ success: false, error: 'type et titre requis' });
    }
    
    let prochain_envoi = null;
    if (type === 'fin_chantier' && jours_avant) {
      prochain_envoi = new Date(Date.now() + jours_avant * 24 * 60 * 60 * 1000);
    }
    
    const result = await query(
      `INSERT INTO rappels (type, titre, message, jours_avant, produit_type, produit_id, seuil_stock, utilisateur_id, groupe, frequence, prochain_envoi)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [type, titre, message, jours_avant, produit_type, produit_id, seuil_stock, utilisateur_id, groupe, frequence || 'une_fois', prochain_envoi]
    );
    
    res.status(201).json({ success: true, message: 'Rappel créé', data: result.rows[0] });
  } catch (error) {
    console.error('Erreur POST /rappels:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// PUT /api/rappels/:id - Modifier un rappel
// ====================================================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { titre, message, actif, frequence } = req.body;
    
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    if (titre) { fields.push(`titre = $${paramIndex++}`); values.push(titre); }
    if (message) { fields.push(`message = $${paramIndex++}`); values.push(message); }
    if (actif !== undefined) { fields.push(`actif = $${paramIndex++}`); values.push(actif); }
    if (frequence) { fields.push(`frequence = $${paramIndex++}`); values.push(frequence); }
    
    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'Aucun champ à modifier' });
    }
    
    values.push(id);
    const result = await query(`UPDATE rappels SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Rappel non trouvé' });
    }
    
    res.json({ success: true, message: 'Rappel modifié', data: result.rows[0] });
  } catch (error) {
    console.error('Erreur PUT /rappels/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// DELETE /api/rappels/:id - Supprimer un rappel
// ====================================================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM rappels WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Rappel non trouvé' });
    }
    
    res.json({ success: true, message: 'Rappel supprimé' });
  } catch (error) {
    console.error('Erreur DELETE /rappels/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// POST /api/rappels/:id/trigger - Déclencher un rappel manuellement
// ====================================================================
router.post('/:id/trigger', async (req, res) => {
  try {
    const { id } = req.params;
    
    const rappel = await query('SELECT * FROM rappels WHERE id = $1', [id]);
    if (rappel.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Rappel non trouvé' });
    }
    
    // Ici on déclencherait l'envoi (notification, email, etc.)
    // Pour l'exemple, on met à jour le champ dernier_envoi
    await query(
      'UPDATE rappels SET dernier_envoi = NOW(), dernier_envoi = NOW() + CASE WHEN frequence = \'quotidien\' THEN \'1 day\'::interval WHEN frequence = \'hebdomadaire\' THEN \'1 week\'::interval ELSE NULL END WHERE id = $1',
      [id]
    );
    
    res.json({ success: true, message: 'Rappel déclenché' });
  } catch (error) {
    console.error('Erreur POST /rappels/:id/trigger:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;