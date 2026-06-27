// ====================================================================
// PIEUVRE API - Service de mapping OCR -> types de circuits
// Gère la correspondance entre les dispositifs détectés par OCR
// et les types de circuits utilisés par le calculateur.
// Supporte la mémoire hiérarchique : global -> client -> chantier.
// ====================================================================

const { query } = require('../db/postgres');

/**
 * Récupère les mappings bruts selon un filtre de portée.
 */
async function getAllMappings(options = {}) {
  const { actif = true, id_client, id_chantier } = options;
  const params = [actif];
  const conditions = ['m.actif = $1'];

  if (id_client !== undefined) {
    params.push(id_client);
    conditions.push(`m.id_client = $${params.length}`);
  }
  if (id_chantier !== undefined) {
    params.push(id_chantier);
    conditions.push(`m.id_chantier = $${params.length}`);
  }

  const result = await query(`
    SELECT m.*, tc.libelle AS circuit_libelle, tc.categorie AS circuit_categorie, tc.type_calcul
    FROM ocr_type_mappings m
    JOIN types_circuits tc ON tc.code = m.circuit_type_code
    WHERE ${conditions.join(' AND ')}
    ORDER BY m.priority DESC, m.ocr_code_symbol NULLS LAST, m.ocr_type_element
  `, params);
  return result.rows;
}

/**
 * Construit la liste effective de mappings pour un contexte donné.
 * Héritage : chantier > client > global.
 * Pour chaque couple (ocr_type_element, ocr_code_symbol), le mapping le plus
 * spécifique (ayant id_chantier, puis id_client, puis global) l'emporte.
 *
 * Si id_chantier est fourni sans id_client, le client du chantier est
 * automatiquement résolu pour appliquer l'héritage complet.
 */
async function getEffectiveMappings(id_client, id_chantier) {
  let resolvedClientId = id_client ? parseInt(id_client, 10) : null;
  const resolvedChantierId = id_chantier ? parseInt(id_chantier, 10) : null;

  // Robustesse : résoudre le client depuis le chantier si nécessaire
  if (resolvedChantierId && !resolvedClientId) {
    const chantierResult = await query(
      `SELECT id_client FROM chantiers WHERE id = $1`,
      [resolvedChantierId]
    );
    if (chantierResult.rows.length > 0) {
      resolvedClientId = chantierResult.rows[0].id_client;
    }
  }

  const scopes = [{ global: true }];
  if (resolvedClientId) scopes.push({ id_client: resolvedClientId });
  if (resolvedChantierId) scopes.push({ id_chantier: resolvedChantierId });

  const all = [];
  for (const scope of scopes) {
    const rows = await getAllMappings({ actif: true, ...scope });
    for (const row of rows) {
      row._scopeLevel = scope.id_chantier ? 3 : scope.id_client ? 2 : 1;
      all.push(row);
    }
  }

  // Conserver le mapping le plus spécifique par clé (type, code)
  const byKey = new Map();
  for (const mapping of all) {
    const key = `${mapping.ocr_type_element || '*'}|${mapping.ocr_code_symbol || '*'}`;
    const existing = byKey.get(key);
    if (!existing || mapping._scopeLevel > existing._scopeLevel) {
      byKey.set(key, mapping);
    }
  }

  // Trier par priorité décroissante comme avant
  return Array.from(byKey.values()).sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return (b.ocr_code_symbol ? 1 : 0) - (a.ocr_code_symbol ? 1 : 0);
  });
}

/**
 * Récupère un mapping par son ID.
 */
async function getMappingById(id) {
  const result = await query(`
    SELECT m.*, tc.libelle AS circuit_libelle, tc.type_calcul
    FROM ocr_type_mappings m
    JOIN types_circuits tc ON tc.code = m.circuit_type_code
    WHERE m.id = $1
  `, [id]);
  return result.rows[0] || null;
}

/**
 * Crée un nouveau mapping.
 */
async function createMapping({
  id_client,
  id_chantier,
  ocr_type_element,
  ocr_code_symbol,
  circuit_type_code,
  description,
  conditions,
  priority = 0,
  actif = true
}) {
  const result = await query(`
    INSERT INTO ocr_type_mappings
      (id_client, id_chantier, ocr_type_element, ocr_code_symbol, circuit_type_code, description, conditions, priority, actif)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `, [
    id_client || null,
    id_chantier || null,
    ocr_type_element || null,
    ocr_code_symbol || null,
    circuit_type_code,
    description || null,
    conditions ? JSON.stringify(conditions) : '{}',
    priority,
    actif
  ]);
  return result.rows[0];
}

/**
 * Met à jour un mapping.
 */
async function updateMapping(id, updates) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  const allowedFields = [
    'id_client',
    'id_chantier',
    'ocr_type_element',
    'ocr_code_symbol',
    'circuit_type_code',
    'description',
    'conditions',
    'priority',
    'actif'
  ];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      fields.push(`${field} = $${paramIndex++}`);
      if (field === 'conditions') {
        values.push(updates[field] ? JSON.stringify(updates[field]) : '{}');
      } else {
        values.push(updates[field]);
      }
    }
  }

  if (fields.length === 0) {
    throw new Error('Aucun champ à mettre à jour');
  }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query(`
    UPDATE ocr_type_mappings
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `, values);

  return result.rows[0] || null;
}

/**
 * Supprime un mapping.
 */
async function deleteMapping(id) {
  await query(`DELETE FROM ocr_type_mappings WHERE id = $1`, [id]);
  return { deleted: true };
}

/**
 * Détermine le type de circuit pour un groupe de dispositifs.
 * Prend en compte le code_symbol, le type_element et les conditions.
 * Le contexte client/chantier permet d'utiliser la mémoire hiérarchique.
 */
async function determineCircuitTypeFromMappings(devices, context = {}) {
  const resolved = await resolveMappingForDevices(devices, context);
  if (!resolved) return null;
  return resolved.type_calcul || resolved.circuit_type_code.toLowerCase();
}

/**
 * Résout le mapping effectif pour un groupe de dispositifs.
 * Retourne le mapping complet (incluant origine client/chantier/global),
 * utile pour les prévisualisations et l'audit.
 */
async function resolveMappingForDevices(devices, context = {}) {
  if (!Array.isArray(devices) || devices.length === 0) {
    return null;
  }

  const mappings = await getEffectiveMappings(context.id_client, context.id_chantier);

  for (const mapping of mappings) {
    const matchedDevices = devices.filter(d => matchDeviceToMapping(d, mapping));
    if (matchedDevices.length === 0) continue;

    const conditions = mapping.conditions || {};

    // Si requires_code est true, au moins un dispositif doit avoir le bon code_symbol
    if (conditions.requires_code && !matchedDevices.some(d => d.code_symbol === mapping.ocr_code_symbol)) {
      continue;
    }

    // Vérifier min_count / max_count
    const count = matchedDevices.length;
    if (conditions.min_count !== undefined && count < conditions.min_count) continue;
    if (conditions.max_count !== undefined && count > conditions.max_count) continue;

    // Vérifier nearby_types (présence d'autres types à proximité)
    if (conditions.nearby_types && Array.isArray(conditions.nearby_types)) {
      const hasNearby = devices.some(d =>
        conditions.nearby_types.includes(d.type_element) &&
        !matchedDevices.includes(d)
      );
      if (!hasNearby) continue;
    }

    return mapping;
  }

  return null;
}

/**
 * Vérifie si un dispositif correspond à un mapping.
 */
function matchDeviceToMapping(device, mapping) {
  const typeMatches = !mapping.ocr_type_element || device.type_element === mapping.ocr_type_element;
  const codeMatches = !mapping.ocr_code_symbol || device.code_symbol === mapping.ocr_code_symbol;
  return typeMatches && codeMatches;
}

/**
 * Duplique tous les mappings d'un client vers un chantier.
 * Ignore les mappings globaux et ceux déjà existants pour ce chantier.
 */
async function duplicateClientMappingsToChantier(id_client, id_chantier) {
  const clientMappings = await getAllMappings({ id_client, actif: true });
  const duplicated = [];

  for (const mapping of clientMappings) {
    try {
      const copy = await createMapping({
        id_chantier,
        ocr_type_element: mapping.ocr_type_element,
        ocr_code_symbol: mapping.ocr_code_symbol,
        circuit_type_code: mapping.circuit_type_code,
        description: mapping.description
          ? `${mapping.description} (copié du client)`.replace(/ \(copié du client\)\(copié du client\)/g, ' (copié du client)')
          : 'Copié depuis les mappings client',
        conditions: mapping.conditions || {},
        priority: mapping.priority,
        actif: mapping.actif
      });
      duplicated.push(copy);
    } catch (err) {
      // Ignorer les doublons éventuels (unicité chantier/type/code)
      if (!err.message || !err.message.includes('unique constraint')) {
        throw err;
      }
    }
  }

  return duplicated;
}

/**
 * Récupère les types de circuits disponibles pour peupler les selecteurs.
 */
async function getCircuitTypes() {
  const result = await query(`
    SELECT code, libelle, categorie, section_par_defaut, style
    FROM types_circuits
    WHERE actif = true
    ORDER BY ordre_affichage, libelle
  `);
  return result.rows;
}

module.exports = {
  getAllMappings,
  getEffectiveMappings,
  getMappingById,
  createMapping,
  updateMapping,
  deleteMapping,
  determineCircuitTypeFromMappings,
  resolveMappingForDevices,
  duplicateClientMappingsToChantier,
  getCircuitTypes
};
