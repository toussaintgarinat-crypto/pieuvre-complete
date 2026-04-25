// ====================================================================
// PIEUVRE API - Routes Webhooks
// ====================================================================

const express = require('express');
const router = express.Router();
const { query } = require('../db/postgres');

// ====================================================================
// GET /api/webhooks - Liste des webhooks
// ====================================================================
router.get('/', async (req, res) => {
  try {
    const { actif } = req.query;
    let sql = 'SELECT * FROM webhooks WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (actif !== undefined) {
      sql += ` AND actif = $${paramIndex++}`;
      params.push(actif === 'true');
    }
    
    sql += ' ORDER BY nom';
    const result = await query(sql, params);
    
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    console.error('Erreur GET /webhooks:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// POST /api/webhooks - Créer un webhook
// ====================================================================
router.post('/', async (req, res) => {
  try {
    const { nom, description, url, methode, evenements, headers, secret_signature } = req.body;
    
    if (!nom || !url) {
      return res.status(400).json({ success: false, error: 'nom et url requis' });
    }
    
    const result = await query(
      `INSERT INTO webhooks (nom, description, url, methode, evenements, headers, secret_signature)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [nom, description, url, methode || 'POST', JSON.stringify(evenements || []), JSON.stringify(headers || {}), secret_signature]
    );
    
    res.status(201).json({ success: true, message: 'Webhook créé', data: result.rows[0] });
  } catch (error) {
    console.error('Erreur POST /webhooks:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// PUT /api/webhooks/:id - Modifier un webhook
// ====================================================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, description, url, methode, evenements, headers, secret_signature, actif } = req.body;
    
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    if (nom) { fields.push(`nom = $${paramIndex++}`); values.push(nom); }
    if (description) { fields.push(`description = $${paramIndex++}`); values.push(description); }
    if (url) { fields.push(`url = $${paramIndex++}`); values.push(url); }
    if (methode) { fields.push(`methode = $${paramIndex++}`); values.push(methode); }
    if (evenements) { fields.push(`evenements = $${paramIndex++}`); values.push(JSON.stringify(evenements)); }
    if (headers) { fields.push(`headers = $${paramIndex++}`); values.push(JSON.stringify(headers)); }
    if (secret_signature) { fields.push(`secret_signature = $${paramIndex++}`); values.push(secret_signature); }
    if (actif !== undefined) { fields.push(`actif = $${paramIndex++}`); values.push(actif); }
    
    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'Aucun champ à modifier' });
    }
    
    values.push(id);
    const result = await query(`UPDATE webhooks SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Webhook non trouvé' });
    }
    
    res.json({ success: true, message: 'Webhook modifié', data: result.rows[0] });
  } catch (error) {
    console.error('Erreur PUT /webhooks/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// DELETE /api/webhooks/:id - Supprimer un webhook
// ====================================================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM webhooks WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Webhook non trouvé' });
    }
    
    res.json({ success: true, message: 'Webhook supprimé' });
  } catch (error) {
    console.error('Erreur DELETE /webhooks/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// POST /api/webhooks/:id/test - Tester un webhook
// ====================================================================
router.post('/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    
    const webhook = await query('SELECT * FROM webhooks WHERE id = $1', [id]);
    if (webhook.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Webhook non trouvé' });
    }
    
    const wh = webhook.rows[0];
    
    // Simuler l'appel (en production, faire le vrai fetch)
    const testPayload = { event: 'test', timestamp: new Date().toISOString() };
    
    // Mettre à jour les stats
    await query(
      'UPDATE webhooks SET nb_appels_reussis = nb_appels_reussis + 1, dernier_appel = NOW() WHERE id = $1',
      [id]
    );
    
    res.json({ success: true, message: 'Test envoyé', payload: testPayload });
  } catch (error) {
    console.error('Erreur POST /webhooks/:id/test:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// Fonction utilitaire pour déclencher les webhooks
// ====================================================================
async function triggerWebhooks(evenement, donnees) {
  try {
    const webhooks = await query(
      'SELECT * FROM webhooks WHERE actif = true AND $1 = ANY(evenements)',
      [evenement]
    );
    
    for (const wh of webhooks.rows) {
      // En production: faire un fetch vers wh.url avec le payload
      console.log(`Webhook ${wh.nom} triggered: ${evenement}`);
    }
  } catch (error) {
    console.error('Erreur triggerWebhooks:', error);
  }
}

module.exports = router;