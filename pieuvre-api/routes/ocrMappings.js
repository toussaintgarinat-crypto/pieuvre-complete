// ====================================================================
// PIEUVRE API - Routes de gestion des mappings OCR -> types de circuits
// ====================================================================

const express = require('express');
const router = express.Router();
const { query } = require('../db/postgres');
const {
  getAllMappings,
  getEffectiveMappings,
  getMappingById,
  createMapping,
  updateMapping,
  deleteMapping,
  getCircuitTypes
} = require('../services/ocrMappings');

/**
 * Vérifie l'existence d'un client.
 */
async function assertClientExists(id_client) {
  const parsed = parseInt(id_client, 10);
  if (Number.isNaN(parsed)) {
    const err = new Error('id_client invalide');
    err.status = 400;
    throw err;
  }
  const result = await query(`SELECT id FROM clients WHERE id = $1`, [parsed]);
  if (result.rows.length === 0) {
    const err = new Error(`Client ${parsed} introuvable`);
    err.status = 400;
    throw err;
  }
}

/**
 * Vérifie l'existence d'un chantier et retourne son client.
 * Si id_client est fourni, vérifie que le chantier appartient bien à ce client.
 */
async function assertChantierExists(id_chantier, id_client = null) {
  const parsedChantier = parseInt(id_chantier, 10);
  if (Number.isNaN(parsedChantier)) {
    const err = new Error('id_chantier invalide');
    err.status = 400;
    throw err;
  }
  const result = await query(`SELECT id, id_client FROM chantiers WHERE id = $1`, [parsedChantier]);
  if (result.rows.length === 0) {
    const err = new Error(`Chantier ${parsedChantier} introuvable`);
    err.status = 400;
    throw err;
  }
  const chantier = result.rows[0];
  if (id_client != null && parseInt(id_client, 10) !== chantier.id_client) {
    const err = new Error(`Le chantier ${parsedChantier} n'appartient pas au client ${id_client}`);
    err.status = 403;
    throw err;
  }
  return chantier;
}

// ====================================================================
// GET /api/ocr-mappings - Liste des mappings
// Query params:
//   ?actif=true|false
//   ?id_client=X      → mappings globaux + mappings du client X
//   ?id_chantier=Y    → mappings effectifs globaux/client/chantier Y
// ====================================================================
router.get('/', async (req, res) => {
  try {
    const { actif, id_client, id_chantier } = req.query;

    let mappings;
    if (id_client || id_chantier) {
      mappings = await getEffectiveMappings(
        id_client ? parseInt(id_client) : null,
        id_chantier ? parseInt(id_chantier) : null
      );
    } else {
      mappings = await getAllMappings({
        actif: actif !== undefined ? actif === 'true' : true
      });
    }

    res.json({ success: true, data: mappings });
  } catch (error) {
    console.error('Erreur GET /ocr-mappings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// GET /api/ocr-mappings/types-circuits - Types de circuits disponibles
// ====================================================================
router.get('/types-circuits', async (req, res) => {
  try {
    const types = await getCircuitTypes();
    res.json({ success: true, data: types });
  } catch (error) {
    console.error('Erreur GET /ocr-mappings/types-circuits:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// GET /api/ocr-mappings/:id - Détail d'un mapping
// ====================================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const mapping = await getMappingById(id);

    if (!mapping) {
      return res.status(404).json({ success: false, error: 'Mapping non trouvé' });
    }

    res.json({ success: true, data: mapping });
  } catch (error) {
    console.error('Erreur GET /ocr-mappings/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// POST /api/ocr-mappings - Créer un mapping
// ====================================================================
router.post('/', async (req, res) => {
  try {
    const {
      id_client,
      id_chantier,
      ocr_type_element,
      ocr_code_symbol,
      circuit_type_code,
      description,
      conditions,
      priority,
      actif
    } = req.body;

    if (!circuit_type_code) {
      return res.status(400).json({
        success: false,
        error: 'circuit_type_code est requis'
      });
    }

    if (!ocr_type_element && !ocr_code_symbol) {
      return res.status(400).json({
        success: false,
        error: 'ocr_type_element ou ocr_code_symbol est requis'
      });
    }

    // Un mapping ne peut appartenir qu'à un seul niveau : global, client ou chantier
    if (id_client && id_chantier) {
      return res.status(400).json({
        success: false,
        error: 'Un mapping ne peut être lié simultanément à un client et à un chantier'
      });
    }

    // Validation métier : existence et cohérence client/chantier
    if (id_client) {
      await assertClientExists(id_client);
    }
    let chantierClientId = null;
    if (id_chantier) {
      const chantier = await assertChantierExists(id_chantier);
      chantierClientId = chantier.id_client;
    }

    const mapping = await createMapping({
      id_client,
      id_chantier,
      ocr_type_element,
      ocr_code_symbol,
      circuit_type_code,
      description,
      conditions,
      priority,
      actif
    });

    res.status(201).json({
      success: true,
      data: {
        ...mapping,
        // Information de cohérence : si mapping chantier, on expose son client
        id_client_resolved: id_client || chantierClientId || null
      }
    });
  } catch (error) {
    console.error('Erreur POST /ocr-mappings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// PUT /api/ocr-mappings/:id - Modifier un mapping
// ====================================================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Validation métier lors du changement de portée
    if (updates.id_client !== undefined && updates.id_client) {
      await assertClientExists(updates.id_client);
    }
    let chantierClientId = null;
    if (updates.id_chantier !== undefined && updates.id_chantier) {
      const chantier = await assertChantierExists(updates.id_chantier);
      chantierClientId = chantier.id_client;
    }

    // Empêcher un mapping simultanément client et chantier
    if (updates.id_client && updates.id_chantier) {
      return res.status(400).json({
        success: false,
        error: 'Un mapping ne peut être lié simultanément à un client et à un chantier'
      });
    }

    const mapping = await updateMapping(id, updates);

    if (!mapping) {
      return res.status(404).json({ success: false, error: 'Mapping non trouvé' });
    }

    res.json({
      success: true,
      data: {
        ...mapping,
        id_client_resolved: mapping.id_client || chantierClientId || null
      }
    });
  } catch (error) {
    console.error('Erreur PUT /ocr-mappings/:id:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

// ====================================================================
// DELETE /api/ocr-mappings/:id - Supprimer un mapping
// ====================================================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await deleteMapping(id);
    res.json({ success: true, message: 'Mapping supprimé' });
  } catch (error) {
    console.error('Erreur DELETE /ocr-mappings/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// POST /api/ocr-mappings/duplicate - Dupliquer mappings client -> chantier
// Body: { id_client, id_chantier }
// ====================================================================
router.post('/duplicate', async (req, res) => {
  try {
    const { id_client, id_chantier } = req.body;

    if (!id_client || !id_chantier) {
      return res.status(400).json({
        success: false,
        error: 'id_client et id_chantier sont requis'
      });
    }

    await assertClientExists(id_client);
    await assertChantierExists(id_chantier, id_client);

    const { duplicateClientMappingsToChantier } = require('../services/ocrMappings');
    const duplicated = await duplicateClientMappingsToChantier(
      parseInt(id_client, 10),
      parseInt(id_chantier, 10)
    );

    res.json({
      success: true,
      message: `${duplicated.length} mapping(s) dupliqué(s)`,
      data: duplicated
    });
  } catch (error) {
    console.error('Erreur POST /ocr-mappings/duplicate:', error);
    const status = error.status || 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

// ====================================================================
// POST /api/ocr-mappings/preview - Prévisualiser la résolution OCR
// Body: { devices: [{type_element, code_symbol}], context: {id_client, id_chantier} }
// ====================================================================
router.post('/preview', async (req, res) => {
  try {
    const { devices = [], context = {} } = req.body;

    if (!Array.isArray(devices) || devices.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'devices (tableau) est requis'
      });
    }

    const { resolveMappingForDevices } = require('../services/ocrMappings');
    const mapping = await resolveMappingForDevices(devices, {
      id_client: context.id_client ? parseInt(context.id_client, 10) : null,
      id_chantier: context.id_chantier ? parseInt(context.id_chantier, 10) : null
    });

    const type_resolu = mapping
      ? (mapping.type_calcul || mapping.circuit_type_code.toLowerCase())
      : null;

    res.json({
      success: true,
      data: {
        type_resolu,
        mapping: mapping
          ? {
              id: mapping.id,
              id_client: mapping.id_client,
              id_chantier: mapping.id_chantier,
              ocr_type_element: mapping.ocr_type_element,
              ocr_code_symbol: mapping.ocr_code_symbol,
              circuit_type_code: mapping.circuit_type_code,
              circuit_libelle: mapping.circuit_libelle,
              type_calcul: mapping.type_calcul,
              priority: mapping.priority,
              origin: mapping.id_chantier ? 'chantier' : mapping.id_client ? 'client' : 'global'
            }
          : null,
        devices
      }
    });
  } catch (error) {
    console.error('Erreur POST /ocr-mappings/preview:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
