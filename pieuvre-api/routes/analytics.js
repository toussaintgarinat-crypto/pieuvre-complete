// ====================================================================
// PIEUVRE API - Routes Analytics (Dashboard)
// ====================================================================

const express = require('express');
const router = express.Router();
const { query } = require('../db/postgres');

const CHANTIERS_TABLE = 'chantiers';

// ====================================================================
// GET /api/analytics/dashboard - Stats globales pour dashboard
// ====================================================================
router.get('/dashboard', async (req, res) => {
  try {
    const { id_entreprise, date_debut, date_fin } = req.query;
    
    const defaults = {
      date_debut: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      date_fin: new Date().toISOString()
    };
    
    const debut = date_debut || defaults.date_debut;
    const fin = date_fin || defaults.date_fin;
    
    // Stats globales
    const stats = await query(`
      SELECT 
        (SELECT COUNT(*) FROM clients WHERE actif = true) as nb_clients,
        (SELECT COUNT(*) FROM chantiers WHERE statut = 'actif') as nb_chantiers_actifs,
        (SELECT COUNT(*) FROM calculs WHERE date_calcul BETWEEN $1 AND $2) as nb_calculs_periode,
        (SELECT COALESCE(SUM((bon_de_coupe->'stats')->>'longueur_totale_fils'), 0)::numeric 
         FROM calculs WHERE date_calcul BETWEEN $1 AND $2) as longueur_totale
    `, [debut, fin]);
    
    // Stats stock bas
    const stockBas = await query(`
      SELECT 'couleur' as type, couleur || ' ' || section || 'mm²' as nom, quantite_metres, seuil_alerte
      FROM stock_cleurs WHERE quantite_metres < seuil_alerte
      UNION ALL
      SELECT 'gaine' as type, 'Ø' || diametre as nom, quantite_metres, seuil_alerte
      FROM stock_gaines WHERE quantite_metres < seuil_alerte
    `);
    
    // Chantiers actifs récents
    const chantiersRecents = await query(`
      SELECT ch.id, ch.nom, cl.nom as client, ch.date_debut, ch.date_fin_prevue,
             COUNT(ca.id) as nb_calculs
      FROM ${CHANTIERS_TABLE} ch
      JOIN clients cl ON ch.id_client = cl.id
      LEFT JOIN calculs ca ON ca.id_chantier = ch.id
      WHERE ch.statut = 'actif'
      GROUP BY ch.id, ch.nom, cl.nom, ch.date_debut, ch.date_fin_prevue
      ORDER BY ch.date_debut DESC
      LIMIT 10
    `);
    
    // Top clients par volume
    const topClients = await query(`
      SELECT cl.nom, COUNT(ca.id) as nb_calculs,
             COALESCE(SUM((ca.bon_de_coupe->'stats')->>'longueur_totale_fils'), 0)::numeric as longueur
      FROM clients cl
      JOIN chantierS ch ON ch.id_client = cl.id
      JOIN calculs ca ON ca.id_chantier = ch.id
      WHERE ca.date_calcul BETWEEN $1 AND $2
      GROUP BY cl.nom
      ORDER BY longueur DESC
      LIMIT 5
    `, [debut, fin]);
    
    // Évolution quotidienne des calculs
    const evolution = await query(`
      SELECT DATE(date_calcul) as date, COUNT(*) as nb_calculs
      FROM calculs
      WHERE date_calcul BETWEEN $1 AND $2
      GROUP BY DATE(date_calcul)
      ORDER BY date
    `, [debut, fin]);
    
    // Répartition par type de circuit
    const repartition = await query(`
      SELECT 
        jsonb_array_elements(bon_de_coupe->'circuits')->>'type' as type,
        COUNT(*) as nb
      FROM calculs
      WHERE date_calcul BETWEEN $1 AND $2
      GROUP BY type
    `, [debut, fin]);
    
    res.json({
      success: true,
      data: {
        stats: stats.rows[0],
        stock_bas: stockBas.rows,
        chantiersRecents: chantierSRecents.rows,
        top_clients: topClients.rows,
        evolution: evolution.rows,
        repartition: repartition.rows
      }
    });
  } catch (error) {
    console.error('Erreur GET /analytics/dashboard:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// GET /api/analytics/chantier/:id - Stats d'un chantier
// ====================================================================
router.get('/chantier/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Infos chantier
    const chantier = await query(`
      SELECT ch.*, cl.nom as client_nom
      FROM ${CHANTIERS_TABLE} ch
      JOIN clients cl ON ch.id_client = cl.id
      WHERE ch.id = $1
    `, [id]);
    
    if (chantier.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Chantier non trouvé' });
    }
    
    // Stats calculs
    const stats = await query(`
      SELECT 
        COUNT(*) as nb_calculs,
        MIN(date_calcul) as premier_calcul,
        MAX(date_calcul) as dernier_calcul,
        COALESCE(SUM((bon_de_coupe->'stats')->>'longueur_totale_fils'), 0)::numeric as longueur_fils,
        COALESCE(SUM((bon_de_coupe->'stats')->>'longueur_totale_gaines'), 0)::numeric as longueur_gaines,
        COALESCE(SUM((bon_de_coupe->'stats')->>'nb_substitutions'), 0)::integer as nb_substitutions
      FROM calculs
      WHERE id_chantier = $1
    `, [id]);
    
    // Historique des calculs
    const historique = await query(`
      SELECT id, date_calcul, utilisateur, commentaire,
             (bon_de_coupe->'stats')->>'longueur_totale_fils' as longueur
      FROM calculs
      WHERE id_chantier = $1
      ORDER BY date_calcul DESC
    `, [id]);
    
    // Détail du dernier calcul
    const dernier = await query(`
      SELECT bon_de_coupe
      FROM calculs
      WHERE id_chantier = $1
      ORDER BY date_calcul DESC
      LIMIT 1
    `, [id]);
    
    res.json({
      success: true,
      data: {
        chantier: chantier.rows[0],
        stats: stats.rows[0],
        historique: historique.rows,
        dernier_calcul: dernier.rows[0]?.bon_de_coupe
      }
    });
  } catch (error) {
    console.error('Erreur GET /analytics/chantier/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// GET /api/analytics/utilisateurs - Stats par utilisateur
// ====================================================================
router.get('/utilisateurs', async (req, res) => {
  try {
    const { date_debut, date_fin } = req.query;
    
    const debut = date_debut || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const fin = date_fin || new Date().toISOString();
    
    const result = await query(`
      SELECT 
        utilisateur as nom,
        COUNT(*) as nb_calculs,
        COALESCE(SUM((bon_de_coupe->'stats')->>'longueur_totale_fils'), 0)::numeric as longueur_fils,
        COUNT(DISTINCT id_chantier) as nb_chantiers
      FROM calculs
      WHERE date_calcul BETWEEN $1 AND $2
      GROUP BY utilisateur
      ORDER BY nb_calculs DESC
    `, [debut, fin]);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Erreur GET /analytics/utilisateurs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;