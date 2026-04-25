// ====================================================================
// PIEUVRE API - Routes Templates
// ====================================================================

const express = require('express');
const router = express.Router();
const { query } = require('../db/postgres');

// ====================================================================
// GET /api/templates - Liste des templates
// ====================================================================
router.get('/', async (req, res) => {
  try {
    const { id_entreprise, id_client, actif } = req.query;
    let sql = `SELECT t.*, u.nom as createur_nom, c.nom as client_nom 
               FROM templates t 
               LEFT JOIN utilisateurs u ON t.utilisateur_id = u.id
               LEFT JOIN clients c ON t.id_client = c.id
               WHERE 1=1`;
    const params = [];
    let paramIndex = 1;
    
    if (id_entreprise) { sql += ` AND t.id_entreprise = $${paramIndex++}`; params.push(id_entreprise); }
    if (id_client) { sql += ` AND t.id_client = $${paramIndex++}`; params.push(id_client); }
    if (actif !== undefined) { sql += ` AND t.actif = $${paramIndex++}`; params.push(actif === 'true'); }
    
    sql += ' ORDER BY t.nom';
    const result = await query(sql, params);
    
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    console.error('Erreur GET /templates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// GET /api/templates/:id - Détails template
// ====================================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT t.*, u.nom as createur_nom, c.nom as client_nom, e.nom as entreprise_nom
       FROM templates t 
       LEFT JOIN utilisateurs u ON t.utilisateur_id = u.id
       LEFT JOIN clients c ON t.id_client = c.id
       LEFT JOIN entreprises e ON t.id_entreprise = e.id
       WHERE t.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Template non trouvé' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Erreur GET /templates/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// POST /api/templates - Créer un template
// ====================================================================
router.post('/', async (req, res) => {
  try {
    const { nom, description, circuits, id_entreprise, id_client, utilisateur_id } = req.body;
    
    if (!nom || !circuits) {
      return res.status(400).json({ success: false, error: 'nom et circuits requis' });
    }
    
    const result = await query(
      `INSERT INTO templates (nom, description, circuits, id_entreprise, id_client, utilisateur_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nom, description, JSON.stringify(circuits), id_entreprise, id_client, utilisateur_id]
    );
    
    res.status(201).json({ success: true, message: 'Template créé', data: result.rows[0] });
  } catch (error) {
    console.error('Erreur POST /templates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// PUT /api/templates/:id - Modifier un template
// ====================================================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, description, circuits, actif } = req.body;
    
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    if (nom) { fields.push(`nom = $${paramIndex++}`); values.push(nom); }
    if (description) { fields.push(`description = $${paramIndex++}`); values.push(description); }
    if (circuits) { fields.push(`circuits = $${paramIndex++}`); values.push(JSON.stringify(circuits)); }
    if (actif !== undefined) { fields.push(`actif = $${paramIndex++}`); values.push(actif); }
    
    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'Aucun champ à modifier' });
    }
    
    values.push(id);
    const result = await query(`UPDATE templates SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Template non trouvé' });
    }
    
    res.json({ success: true, message: 'Template modifié', data: result.rows[0] });
  } catch (error) {
    console.error('Erreur PUT /templates/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// DELETE /api/templates/:id - Supprimer un template
// ====================================================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM templates WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Template non trouvé' });
    }
    
    res.json({ success: true, message: 'Template supprimé' });
  } catch (error) {
    console.error('Erreur DELETE /templates/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// POST /api/templates/:id/utiliser - Utiliser un template pour un calcul
// ====================================================================
router.post('/:id/utiliser', async (req, res) => {
  try {
    const { id } = req.params;
    const { id_chantier, multiplicateur = 1 } = req.body;
    
    const template = await query('SELECT * FROM templates WHERE id = $1', [id]);
    if (template.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Template non trouvé' });
    }
    
    const circuits = template.rows[0].circuits.map(c => ({
      ...c,
      nb_prises: (c.nb_prises || 1) * multiplicateur,
      nb_points: (c.nb_points || 1) * multiplicateur,
      longueur: (c.longueur || 10) * multiplicateur
    }));
    
    res.json({ success: true, data: { circuits, template_nom: template.rows[0].nom } });
  } catch (error) {
    console.error('Erreur POST /templates/:id/utiliser:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;