// ====================================================================
// PIEUVRE API - Routes Clients
// ====================================================================

const express = require('express');
const router = express.Router();
const { query } = require('../db/postgres');

// ====================================================================
// GET /api/clients - Liste tous les clients
// ====================================================================
router.get('/', async (req, res) => {
  try {
    const { actif } = req.query;
    
    let sql = 'SELECT * FROM clients';
    const params = [];
    
    if (actif !== undefined) {
      sql += ' WHERE actif = $1';
      params.push(actif === 'true');
    }
    
    sql += ' ORDER BY nom ASC';
    
    const result = await query(sql, params);
    
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Erreur GET /clients:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================================================
// GET /api/clients/:id - Détails d'un client
// ====================================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'SELECT * FROM clients WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Client non trouvé'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur GET /clients/:id:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================================================
// POST /api/clients - Créer un nouveau client
// ====================================================================
router.post('/', async (req, res) => {
  try {
    const {
      nom,
      prises_section = 2.5,
      eclairage_section = 1.5,
      volets_section = 1.5,
      cuisson_section = 6.0,
      vmc_section = 1.5,
      chauffage_section = 2.5,
      couleurs_preferees = ["Rouge", "Bleu", "Vert/Jaune", "Orange", "Noir", "Violet", "Marron"],
      gaines_disponibles = [16, 20, 25, 32, 40, 50, 63],
      contact_nom,
      contact_email,
      contact_telephone,
      responsable_compte,
      particularites = null
    } = req.body;
    
    if (!nom) {
      return res.status(400).json({
        success: false,
        error: 'Le nom du client est requis'
      });
    }
    
    const result = await query(
      `INSERT INTO clients (
        nom, prises_section, eclairage_section, volets_section,
        cuisson_section, vmc_section, chauffage_section,
        couleurs_preferees, gaines_disponibles,
        contact_nom, contact_email, contact_telephone, responsable_compte,
        particularites
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        nom, prises_section, eclairage_section, volets_section,
        cuisson_section, vmc_section, chauffage_section,
        JSON.stringify(couleurs_preferees), JSON.stringify(gaines_disponibles),
        contact_nom, contact_email, contact_telephone, responsable_compte,
        particularites
      ]
    );
    
    res.status(201).json({
      success: true,
      message: 'Client créé avec succès',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur POST /clients:', error);
    
    if (error.code === '23505') { // Violation de contrainte unique
      return res.status(409).json({
        success: false,
        error: 'Un client avec ce nom existe déjà'
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================================================
// PUT /api/clients/:id - Modifier un client
// ====================================================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nom,
      prises_section,
      eclairage_section,
      volets_section,
      cuisson_section,
      vmc_section,
      chauffage_section,
      couleurs_preferees,
      gaines_disponibles,
      contact_nom,
      contact_email,
      contact_telephone,
      responsable_compte,
      notes,
      particularites,
      actif
    } = req.body;
    
    // Construction dynamique de la requête UPDATE
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    if (nom !== undefined) {
      fields.push(`nom = $${paramIndex++}`);
      values.push(nom);
    }
    if (prises_section !== undefined) {
      fields.push(`prises_section = $${paramIndex++}`);
      values.push(prises_section);
    }
    if (eclairage_section !== undefined) {
      fields.push(`eclairage_section = $${paramIndex++}`);
      values.push(eclairage_section);
    }
    if (volets_section !== undefined) {
      fields.push(`volets_section = $${paramIndex++}`);
      values.push(volets_section);
    }
    if (cuisson_section !== undefined) {
      fields.push(`cuisson_section = $${paramIndex++}`);
      values.push(cuisson_section);
    }
    if (vmc_section !== undefined) {
      fields.push(`vmc_section = $${paramIndex++}`);
      values.push(vmc_section);
    }
    if (chauffage_section !== undefined) {
      fields.push(`chauffage_section = $${paramIndex++}`);
      values.push(chauffage_section);
    }
    if (couleurs_preferees !== undefined) {
      fields.push(`couleurs_preferees = $${paramIndex++}`);
      values.push(JSON.stringify(couleurs_preferees));
    }
    if (gaines_disponibles !== undefined) {
      fields.push(`gaines_disponibles = $${paramIndex++}`);
      values.push(JSON.stringify(gaines_disponibles));
    }
    if (particularites !== undefined) {
      fields.push(`particularites = $${paramIndex++}`);
      values.push(particularites);
    }
    if (contact_nom !== undefined) {
      fields.push(`contact_nom = $${paramIndex++}`);
      values.push(contact_nom);
    }
    if (contact_email !== undefined) {
      fields.push(`contact_email = $${paramIndex++}`);
      values.push(contact_email);
    }
    if (contact_telephone !== undefined) {
      fields.push(`contact_telephone = $${paramIndex++}`);
      values.push(contact_telephone);
    }
    if (responsable_compte !== undefined) {
      fields.push(`responsable_compte = $${paramIndex++}`);
      values.push(responsable_compte);
    }
    if (notes !== undefined) {
      fields.push(`notes = $${paramIndex++}`);
      values.push(JSON.stringify(notes));
    }
    if (actif !== undefined) {
      fields.push(`actif = $${paramIndex++}`);
      values.push(actif);
    }
    
    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Aucun champ à modifier'
      });
    }
    
    values.push(id);
    
    const result = await query(
      `UPDATE clients SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Client non trouvé'
      });
    }
    
    res.json({
      success: true,
      message: 'Client modifié avec succès',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur PUT /clients/:id:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================================================
// DELETE /api/clients/:id - Supprimer un client (soft delete)
// ====================================================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Soft delete: on met juste actif = false
    const result = await query(
      'UPDATE clients SET actif = false WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Client non trouvé'
      });
    }
    
    res.json({
      success: true,
      message: 'Client désactivé avec succès',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur DELETE /clients/:id:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================================================
// GET /api/clients/search/:term - Recherche de clients
// ====================================================================
router.get('/search/:term', async (req, res) => {
  try {
    const { term } = req.params;
    
    const result = await query(
      `SELECT * FROM clients 
       WHERE actif = true AND nom ILIKE $1 
       ORDER BY nom ASC 
       LIMIT 20`,
      [`%${term}%`]
    );
    
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Erreur GET /clients/search:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================================================
// GET /api/clients/suivi - Suivi complet client-chantier
// ====================================================================
router.get('/suivi', async (req, res) => {
  try {
    const { id_client, id_chantier } = req.query;
    
    let sql = 'SELECT * FROM v_suivi_client_chantier WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (id_client) {
      sql += ` AND client_id = $${paramIndex++}`;
      params.push(id_client);
    }
    
    if (id_chantier) {
      sql += ` AND chantier_id = $${paramIndex++}`;
      params.push(id_chantier);
    }
    
    sql += ' ORDER BY client_nom, chantier_nom';
    
    const result = await query(sql, params);
    
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Erreur GET /clients/suivi:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================================================
// POST /api/clients/:id/notes - Ajouter une note à un client
// ====================================================================
router.post('/:id/notes', async (req, res) => {
  try {
    const { id } = req.params;
    const { texte, auteur, type = 'info' } = req.body;
    
    if (!texte || !auteur) {
      return res.status(400).json({
        success: false,
        error: 'texte et auteur sont requis'
      });
    }
    
    await query(
      'SELECT ajouter_note_client($1, $2, $3, $4)',
      [id, texte, auteur, type]
    );
    
    res.json({
      success: true,
      message: 'Note ajoutée avec succès'
    });
  } catch (error) {
    console.error('Erreur POST /clients/:id/notes:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
