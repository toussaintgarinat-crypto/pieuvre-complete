// ====================================================================
// PIEUVRE API - Routes Sessions d'Impression
// Gestion du ruban continu avec reprise
// ====================================================================

const express = require('express');
const router = express.Router();
const { query, transaction } = require('../db/postgres');

// ====================================================================
// POST /api/impression/sessions - Démarrer une nouvelle session
// ====================================================================
router.post('/sessions', async (req, res) => {
  try {
    const { 
      id_calcul, 
      utilisateur, 
      filtre_type,      // 'chantier', 'logement', 'boite'
      filtre_valeur,    // 'Lg1', 'Bx5', etc.
      etiquettes,       // Array des étiquettes à imprimer (filtrées)
      etiquettes_totales 
    } = req.body;
    
    if (!id_calcul || !utilisateur || !etiquettes) {
      return res.status(400).json({
        success: false,
        error: 'id_calcul, utilisateur et etiquettes requis'
      });
    }
    
    const result = await query(
      `INSERT INTO impression_sessions 
       (id_calcul, utilisateur, filtre_type, filtre_valeur, etiquettes_totales)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id_calcul, utilisateur, filtre_type || 'chantier', filtre_valeur, etiquettes_totales || etiquettes.length]
    );
    
    // Enregistrer chaque étiquette dans l'historique
    const session = result.rows[0];
    
    await query(
      `INSERT INTO impression_historique (id_session, etiquette_code, action, utilisateur)
       SELECT $1, unnest($2::varchar[]), 'imprimee', $3`,
      [session.id, etiquettes, utilisateur]
    );
    
    res.status(201).json({
      success: true,
      message: 'Session créée',
      data: session
    });
    
  } catch (error) {
    console.error('Erreur POST /sessions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// GET /api/impression/sessions - Liste des sessions actives
router.get('/sessions', async (req, res) => {
  try {
    const { id_calcul, statut, limit = 50 } = req.query;
    
    let sql = `
      SELECT s.*, ch.nom as chantier_nom, cl.nom as client_nom
      FROM impression_sessions s
      LEFT JOIN calculs c ON s.id_calcul = c.id
      LEFT JOIN chantiers ch ON c.id_chantier = ch.id
      LEFT JOIN clients cl ON ch.id_client = cl.id
      WHERE 1=1
    `;
    
    const params = [];
    if (id_calcul) {
      params.push(id_calcul);
      sql += ` AND s.id_calcul = $${params.length}`;
    }
    if (statut) {
      params.push(statut);
      sql += ` AND s.statut = $${params.length}`;
    }
    
    sql += ` ORDER BY s.created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));
    
    const result = await query(sql, params);
    
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
    
  } catch (error) {
    console.error('Erreur GET /sessions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// GET /api/impression/sessions/actives - Sessions en cours
router.get('/sessions/actives', async (req, res) => {
  try {
    const result = await query(
      `SELECT s.*, ch.nom as chantier_nom, cl.nom as client_nom
       FROM impression_sessions s
       LEFT JOIN calculs c ON s.id_calcul = c.id
       LEFT JOIN chantiers ch ON c.id_chantier = ch.id
       LEFT JOIN clients cl ON ch.id_client = cl.id
       WHERE s.statut = 'en_cours'
       ORDER BY s.updated_at DESC`
    );

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });

  } catch (error) {
    console.error('Erreur GET /sessions/actives:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// GET /api/impression/sessions/:id - Détails d'une session
router.get('/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Session
    const session = await query(
      `SELECT s.*, ch.nom as chantier_nom, cl.nom as client_nom
       FROM impression_sessions s
       LEFT JOIN calculs c ON s.id_calcul = c.id
       LEFT JOIN chantiers ch ON c.id_chantier = ch.id
       LEFT JOIN clients cl ON ch.id_client = cl.id
       WHERE s.id = $1`,
      [id]
    );
    
    if (session.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session non trouvée' });
    }
    
    // Historique
    const historique = await query(
      `SELECT * FROM impression_historique 
       WHERE id_session = $1 
       ORDER BY timestamp ASC`,
      [id]
    );
    
    // Calculer progression
    const total = session.rows[0].etiquettes_totales;
    const imprimees = session.rows[0].etiquettes_imprimees;
    const restant = total - imprimees;
    
    res.json({
      success: true,
      data: {
        ...session.rows[0],
        progression: {
          total,
          imprimees,
          restant,
          pourcentage: Math.round((imprimees / total) * 100)
        },
        historique: historique.rows
      }
    });
    
  } catch (error) {
    console.error('Erreur GET /sessions/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// PUT /api/impression/sessions/:id/marquer - Marquer des étiquettes comme faites
// ====================================================================
router.put('/sessions/:id/marquer', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      etiquettes_code,  // Array des codes à marquer ('L-1', 'P-2')
      action,            // 'imprimee', 'decoupee', 'ignoree'
      utilisateur 
    } = req.body;
    
    if (!etiquettes_code || !action) {
      return res.status(400).json({
        success: false,
        error: 'etiquettes_code et action requis'
      });
    }
    
    // Récupérer la session
    const session = await query(
      'SELECT * FROM impression_sessions WHERE id = $1',
      [id]
    );
    
    if (session.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session non trouvée' });
    }
    
    const sessionData = session.rows[0];
    const nbEtqs = etiquettes_code.length;
    
    // Mettre à jour la progression
    const newImprimees = sessionData.etiquettes_imprimees + nbEtqs;
    const newDerniere = etiquettes_code[etiquettes_code.length - 1];
    const newStatut = newImprimees >= sessionData.etiquettes_totales ? 'termine' : 'en_cours';
    
    await query(
      `UPDATE impression_sessions SET 
         etiquettes_imprimees = $1,
         derniere_etiquette = $2,
         statut = $3
       WHERE id = $4`,
      [newImprimees, newDerniere, newStatut, id]
    );
    
    // Enregistrer dans l'historique
    await query(
      `INSERT INTO impression_historique (id_session, etiquette_code, action, utilisateur)
       SELECT $1, unnest($2::varchar[]), $3, $4`,
      [id, etiquettes_code, action, utilisateur || 'system']
    );
    
    res.json({
      success: true,
      message: `${nbEtqs} étiquette(s) marquée(s) comme ${action}`,
      data: {
        session_id: parseInt(id),
        nouvelles_imprimees: newImprimees,
        restant: sessionData.etiquettes_totales - newImprimees,
        statut: newStatut
      }
    });
    
  } catch (error) {
    console.error('Erreur PUT /sessions/:id/marquer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// PUT /api/impression/sessions/:id/annuler - Annuler une session
// ====================================================================
router.put('/sessions/:id/annuler', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      `UPDATE impression_sessions SET statut = 'annule'
       WHERE id = $1 RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session non trouvée' });
    }
    
    res.json({
      success: true,
      message: 'Session annulée'
    });
    
  } catch (error) {
    console.error('Erreur PUT /sessions/:id/annuler:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// GET /api/impression/calcul/:id/etiquettes - Lister les étiquettes d'un calcul
// ====================================================================
router.get('/calcul/:id/etiquettes', async (req, res) => {
  try {
    const { id } = req.params;
    const { filtre_type, filtre_valeur } = req.query;
    
    // Récupérer le calcul
    const calcul = await query(
      `SELECT c.*, ch.nom as chantier_nom, ch.batiment, ch.etage, ch.appartement,
              ch.contact_nom, ch.responsable_chantier,
              cl.nom as client_nom
       FROM calculs c
       JOIN chantiers ch ON c.id_chantier = ch.id
       JOIN clients cl ON ch.id_client = cl.id
       WHERE c.id = $1`,
      [id]
    );
    
    if (calcul.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Calcul non trouvé' });
    }
    
    const data = calcul.rows[0];
    const bonDeCoupe = data.bon_de_coupe;
    
    // Extraire et organiser les étiquettes par critère
    const etiquettes = [];
    
    if (bonDeCoupe.circuits) {
      bonDeCoupe.circuits.forEach((circuit, index) => {
        const typeCode = circuit.type_circuit_code || circuit.type || 'L';
        const numBoite = circuit.numero_boite || index + 1;
        
        const etiquette = {
          code: `${typeCode}-${numBoite}`,
          type: typeCode,
          type_label: getTypeLabel(typeCode),
          longueur: circuit.longueur || circuit.longueur_finale || 0,
          gaine: circuit.gaine_diametre || 20,
          // Localisation
         batiment: circuit.batiment || data.batiment,
          etage: circuit.etage || data.etage,
          logement: circuit.logement || data.appartement,
          numero_boite: numBoite,
          // Fils
          fils: circuit.fils || [],
          // Métadonnées
          circuit_id: circuit.id
        };
        
        // Appliquer le filtre
        if (filtre_type === 'logement' && filtre_valeur) {
          if (etiquette.logement !== filtre_valeur) return;
        } else if (filtre_type === 'boite' && filtre_valeur) {
          if (String(etiquette.numero_boite) !== String(filtre_valeur)) return;
        }
        
        etiquettes.push(etiquette);
      });
    }
    
    // Organiser par groupe
    const parLogement = {};
    const parBoite = {};
    
    etiquettes.forEach(eq => {
      const lg = eq.logement || 'Sans logement';
      if (!parLogement[lg]) parLogement[lg] = [];
      parLogement[lg].push(eq);
      
      parBoite[eq.code] = eq;
    });
    
    res.json({
      success: true,
      data: {
        calcul: {
          id: data.id,
          client: data.client_nom,
          chantier: data.chantier_nom,
          date: data.date_calcul
        },
        etiquettes,
        filtres: {
          par_logement: parLogement,
          count_logements: Object.keys(parLogement).length,
          count_boites: Object.keys(parBoite).length
        }
      }
    });
    
  } catch (error) {
    console.error('Erreur GET /calcul/:id/etiquettes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// POST /api/impression/imprimer - Imprimer une sélection d'étiquettes
// ====================================================================
router.post('/imprimer', async (req, res) => {
  try {
    const {
      id_calcul,
      utilisateur,
      etiquette_codes,      // Codes à imprimer (L-1, P-2, VR-1...)
      filtre_type,
      filtre_valeur,
      start_index,         // Pour reprendre à partir de X
      duplicate = 1,
      mode_etiquetage = 'atelier',
      regroupement
    } = req.body;

    if (!id_calcul || !etiquette_codes) {
      return res.status(400).json({
        success: false,
        error: 'id_calcul et etiquette_codes requis'
      });
    }

    // Récupérer les données du calcul
    const calcul = await query(
      `SELECT c.*, ch.nom as chantier_nom, cl.nom as client_nom
       FROM calculs c
       JOIN chantiers ch ON c.id_chantier = ch.id
       JOIN clients cl ON ch.id_client = cl.id
       WHERE c.id = $1`,
      [id_calcul]
    );

    if (calcul.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Calcul non trouvé' });
    }

    // Créer la session
    const sessionResult = await query(
      `INSERT INTO impression_sessions
       (id_calcul, utilisateur, filtre_type, filtre_valeur, etiquettes_totales,
        mode_etiquetage, regroupement)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        id_calcul,
        utilisateur,
        filtre_type || 'boites',
        filtre_valeur,
        etiquette_codes.length * duplicate,
        mode_etiquetage,
        regroupement ? JSON.stringify(regroupement) : null
      ]
    );

    const session = sessionResult.rows[0];

    // Enregistrer les étiquettes dans l'historique comme "imprimées"
    await query(
      `INSERT INTO impression_historique (id_session, etiquette_code, action, utilisateur)
       SELECT $1, unnest($2::varchar[]), 'imprimee', $3`,
      [session.id, etiquette_codes, utilisateur || 'system']
    );

    res.json({
      success: true,
      message: 'Session créée - PDF prêt',
      data: {
        session_id: session.id,
        etiquettes_count: etiquette_codes.length,
        duplicate,
        start_index,
        pdf_url: `/api/etiquettes/impression/${session.id}`
      }
    });

  } catch (error) {
    console.error('Erreur POST /imprimer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// Fonction helper
// ====================================================================
function getTypeLabel(code) {
  const labels = {
    'L': 'ÉCLAIRAGE',
    'P': 'PRISES 16A',
    'VR': 'VOLET ROULANT',
    'VMC': 'VMC',
    'VD': 'VA-ET-VIENT',
    'CUIS': 'CUISINIÈRE',
    'LL': 'LAVE-LINGE',
    'LV': 'LAVE-VAISSELLE',
    'BS': 'BLOC SECOURS'
  };
  return labels[code] || code;
}

module.exports = router;