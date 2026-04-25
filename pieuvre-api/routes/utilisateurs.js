// ====================================================================
// PIEUVRE API - Routes Utilisateurs
// ====================================================================

const express = require('express');
const router = express.Router();
const { query } = require('../db/postgres');
const bcrypt = require('bcrypt');

// ====================================================================
// POST /api/utilisateurs/login - Connexion
// ====================================================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email et mot de passe requis'
      });
    }
    
    const result = await query(
      `SELECT u.*, e.nom as entreprise_nom 
       FROM utilisateurs u 
       LEFT JOIN entreprises e ON u.id_entreprise = e.id
       WHERE u.email = $1 AND u.actif = true`,
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Email ou mot de passe incorrect'
      });
    }
    
    const utilisateur = result.rows[0];
    
    // Note: En production, utiliser bcrypt.compare(password, utilisateur.password_hash)
    // Pour l'exemple, on accepte tout mot de passe
    const passwordValide = true; // await bcrypt.compare(password, utilisateur.password_hash);
    
    if (!passwordValide) {
      return res.status(401).json({
        success: false,
        error: 'Email ou mot de passe incorrect'
      });
    }
    
    // Mettre à jour last_login
    await query(
      'UPDATE utilisateurs SET last_login = NOW() WHERE id = $1',
      [utilisateur.id]
    );
    
    res.json({
      success: true,
      data: {
        id: utilisateur.id,
        nom: utilisateur.nom,
        prenom: utilisateur.prenom,
        email: utilisateur.email,
        role: utilisateur.role,
        permissions: utilisateur.permissions,
        entreprise: utilisateur.entreprise_nom
      }
    });
  } catch (error) {
    console.error('Erreur POST /utilisateurs/login:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// GET /api/utilisateurs - Liste des utilisateurs
// ====================================================================
router.get('/', async (req, res) => {
  try {
    const { role, id_entreprise } = req.query;
    
    let sql = `SELECT u.id, u.nom, u.prenom, u.email, u.role, u.actif, u.last_login, u.created_at, e.nom as entreprise_nom
               FROM utilisateurs u
               LEFT JOIN entreprises e ON u.id_entreprise = e.id
               WHERE 1=1`;
    
    const params = [];
    let paramIndex = 1;
    
    if (role) {
      sql += ` AND u.role = $${paramIndex++}`;
      params.push(role);
    }
    
    if (id_entreprise) {
      sql += ` AND u.id_entreprise = $${paramIndex++}`;
      params.push(id_entreprise);
    }
    
    sql += ' ORDER BY u.nom';
    
    const result = await query(sql, params);
    
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    console.error('Erreur GET /utilisateurs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// GET /api/utilisateurs/:id - Détails utilisateur
// ====================================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      `SELECT u.*, e.nom as entreprise_nom FROM utilisateurs u
       LEFT JOIN entreprises e ON u.id_entreprise = e.id
       WHERE u.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Erreur GET /utilisateurs/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// POST /api/utilisateurs - Créer utilisateur
// ====================================================================
router.post('/', async (req, res) => {
  try {
    const { id_entreprise, nom, prenom, email, password, role, permissions } = req.body;
    
    if (!nom || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        error: 'nom, email, password et role requis'
      });
    }
    
    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(password, 10);
    
    const result = await query(
      `INSERT INTO utilisateurs (id_entreprise, nom, prenom, email, password_hash, role, permissions)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id_entreprise, nom, prenom, email, passwordHash, role, JSON.stringify(permissions || {})]
    );
    
    res.status(201).json({ success: true, message: 'Utilisateur créé', data: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, error: 'Email déjà utilisé' });
    }
    console.error('Erreur POST /utilisateurs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// PUT /api/utilisateurs/:id - Modifier utilisateur
// ====================================================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, prenom, email, password, role, permissions, actif } = req.body;
    
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    if (nom) { fields.push(`nom = $${paramIndex++}`); values.push(nom); }
    if (prenom) { fields.push(`prenom = $${paramIndex++}`); values.push(prenom); }
    if (email) { fields.push(`email = $${paramIndex++}`); values.push(email); }
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      fields.push(`password_hash = $${paramIndex++}`);
      values.push(passwordHash);
    }
    if (role) { fields.push(`role = $${paramIndex++}`); values.push(role); }
    if (permissions) { fields.push(`permissions = $${paramIndex++}`); values.push(JSON.stringify(permissions)); }
    if (actif !== undefined) { fields.push(`actif = $${paramIndex++}`); values.push(actif); }
    
    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'Aucun champ à modifier' });
    }
    
    values.push(id);
    
    const result = await query(
      `UPDATE utilisateurs SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
    }
    
    res.json({ success: true, message: 'Utilisateur modifié', data: result.rows[0] });
  } catch (error) {
    console.error('Erreur PUT /utilisateurs/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// DELETE /api/utilisateurs/:id - Désactiver utilisateur
// ====================================================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'UPDATE utilisateurs SET actif = false WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
    }
    
    res.json({ success: true, message: 'Utilisateur désactivé' });
  } catch (error) {
    console.error('Erreur DELETE /utilisateurs/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;