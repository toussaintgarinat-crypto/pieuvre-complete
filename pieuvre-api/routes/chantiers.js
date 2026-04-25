// ====================================================================
// PIEUVRE API - Routes Chantiers
// ====================================================================

const express = require('express');
const router = express.Router();
const { query } = require('../db/postgres');

// ====================================================================
// GET /api/chantiers - Liste tous les chantiers
// ====================================================================
router.get('/', async (req, res) => {
  try {
    const { id_client, statut } = req.query;
    
    let sql = `
      SELECT 
        c.*,
        cl.nom as client_nom,
        cl.gaines_disponibles as client_gaines_disponibles,
        COALESCE(c.prises_section, cl.prises_section) as prises_section_effective,
        COALESCE(c.eclairage_section, cl.eclairage_section) as eclairage_section_effective,
        COALESCE(c.volets_section, cl.volets_section) as volets_section_effective,
        COALESCE(c.gaines_disponibles, cl.gaines_disponibles) as gaines_disponibles_effective
      FROM chantiers c
      JOIN clients cl ON c.id_client = cl.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (id_client) {
      sql += ` AND c.id_client = $${paramIndex++}`;
      params.push(id_client);
    }
    
    if (statut) {
      sql += ` AND c.statut = $${paramIndex++}`;
      params.push(statut);
    }
    
    sql += ' ORDER BY c.created_at DESC';
    
    const result = await query(sql, params);
    
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Erreur GET /chantiers:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================================================
// GET /api/chantiers/:id - Détails d'un chantier avec profil complet
// ====================================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      `SELECT * FROM get_chantier_profil($1)`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Chantier non trouvé'
      });
    }
    
    // Récupération des données brutes du chantier aussi
    const chantierResult = await query(
      `SELECT c.*, cl.nom as client_nom, cl.couleurs_preferees
       FROM chantiers c
       JOIN clients cl ON c.id_client = cl.id
       WHERE c.id = $1`,
      [id]
    );
    
    res.json({
      success: true,
      data: {
        ...chantierResult.rows[0],
        profil: result.rows[0]
      }
    });
  } catch (error) {
    console.error('Erreur GET /chantiers/:id:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================================================
// POST /api/chantiers - Créer un nouveau chantier
// ====================================================================
router.post('/', async (req, res) => {
  try {
    const {
      id_client,
      nom,
      adresse,
      prises_section,
      eclairage_section,
      volets_section,
      cuisson_section,
      vmc_section,
      chauffage_section,
      gaines_disponibles,
      statut,
      date_debut,
      date_fin_prevue,
      notes,
      contact_nom,
      contact_email,
      contact_telephone,
      responsable_chantier
    } = req.body;
    
    if (!id_client || !nom) {
      return res.status(400).json({
        success: false,
        error: 'Le client et le nom du chantier sont requis'
      });
    }
    
const result = await query(
      `INSERT INTO chantiers (
        id_client, nom, adresse,
        prises_section, eclairage_section, volets_section,
        cuisson_section, vmc_section, chauffage_section,
        gaines_disponibles,
        date_debut, date_fin_prevue, notes,
        contact_nom, contact_email, contact_telephone, responsable_chantier
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        id_client, nom, adresse,
        prises_section, eclairage_section, volets_section,
        cuisson_section, vmc_section, chauffage_section,
        gaines_disponibles,
        date_debut, date_fin_prevue, notes,
        contact_nom, contact_email, contact_telephone, responsable_chantier
      ]
    );
    
    res.status(201).json({
      success: true,
      message: 'Chantier créé avec succès',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur POST /chantiers:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================================================
// PUT /api/chantiers/:id - Modifier un chantier
// ====================================================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nom,
      adresse,
      prises_section,
      eclairage_section,
      volets_section,
      cuisson_section,
      vmc_section,
      chauffage_section,
      gaines_disponibles,
      statut,
      date_debut,
      date_fin_prevue,
      date_fin_reelle,
      notes,
      contact_nom,
      contact_email,
      contact_telephone,
      responsable_chantier
    } = req.body;
    
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    if (nom !== undefined) {
      fields.push(`nom = $${paramIndex++}`);
      values.push(nom);
    }
    if (adresse !== undefined) {
      fields.push(`adresse = $${paramIndex++}`);
      values.push(adresse);
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
    if (gaines_disponibles !== undefined) {
      fields.push(`gaines_disponibles = $${paramIndex++}`);
      values.push(JSON.stringify(gaines_disponibles));
    }
    if (statut !== undefined) {
      fields.push(`statut = $${paramIndex++}`);
      values.push(statut);
    }
    if (date_debut !== undefined) {
      fields.push(`date_debut = $${paramIndex++}`);
      values.push(date_debut);
    }
    if (date_fin_prevue !== undefined) {
      fields.push(`date_fin_prevue = $${paramIndex++}`);
      values.push(date_fin_prevue);
    }
    if (date_fin_reelle !== undefined) {
      fields.push(`date_fin_reelle = $${paramIndex++}`);
      values.push(date_fin_reelle);
    }
    if (notes !== undefined) {
      fields.push(`notes = $${paramIndex++}`);
      values.push(JSON.stringify(notes));
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
    if (responsable_chantier !== undefined) {
      fields.push(`responsable_chantier = $${paramIndex++}`);
      values.push(responsable_chantier);
    }
    
    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Aucun champ à modifier'
      });
    }
    
    values.push(id);
    
    const result = await query(
      `UPDATE chantiers SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Chantier non trouvé'
      });
    }
    
    res.json({
      success: true,
      message: 'Chantier modifié avec succès',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur PUT /chantiers/:id:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================================================
// DELETE /api/chantiers/:id - Supprimer un chantier
// ====================================================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Vérifier qu'il n'y a pas de calculs associés
    const calculResult = await query(
      'SELECT COUNT(*) as count FROM calculs WHERE id_chantier = $1',
      [id]
    );
    
    if (parseInt(calculResult.rows[0].count) > 0) {
      return res.status(409).json({
        success: false,
        error: 'Impossible de supprimer un chantier avec des calculs existants'
      });
    }
    
    const result = await query(
      'DELETE FROM chantiers WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Chantier non trouvé'
      });
    }
    
    res.json({
      success: true,
      message: 'Chantier supprimé avec succès'
    });
  } catch (error) {
    console.error('Erreur DELETE /chantiers/:id:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================================================
// GET /api/chantiers/:id/stats - Statistiques d'un chantier
// ====================================================================
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      `SELECT * FROM v_stats_chantiers WHERE id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Chantier non trouvé'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur GET /chantiers/:id/stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ====================================================================
// POST /api/chantiers/:id/notes - Ajouter une note à un chantier
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
      'SELECT ajouter_note_chantier($1, $2, $3, $4)',
      [id, texte, auteur, type]
    );
    
    res.json({
      success: true,
      message: 'Note ajoutée avec succès'
    });
  } catch (error) {
    console.error('Erreur POST /chantiers/:id/notes:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
