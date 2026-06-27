// ====================================================================
// PIEUVRE API - Service de construction de circuits depuis OCR
// Transforme les dispositifs extraits en circuits prêts pour le calcul
// ====================================================================

const { searchForCircuitContext } = require('./rag');
const { determineCircuitTypeFromMappings } = require('./ocrMappings');

const DEFAULT_LENGTH_M = 10;
const SCALE_FACTOR = 0.05; // 1 unité de plan = 5 cm (à calibrer selon les plans)

/**
 * Calcule une longueur estimée à partir des positions des dispositifs.
 * Prend la distance entre le point le plus éloigné et une origine hypothétique (0,0 = tableau).
 */
function estimateLength(positions) {
  if (!positions || positions.length === 0) return DEFAULT_LENGTH_M;

  const maxDistance = positions.reduce((max, p) => {
    const dx = p.x || 0;
    const dy = p.y || 0;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return Math.max(max, dist);
  }, 0);

  return Math.max(1, Math.round(maxDistance * SCALE_FACTOR));
}

/**
 * Détermine le type de circuit principal à partir d'un groupe de dispositifs.
 * Utilise les mappings configurables en base (avec mémoire client/chantier),
 * avec fallback sur l'heuristique.
 */
async function determineCircuitType(devices, context = {}) {
  // 1. Essayer les mappings configurables en base
  const mappedType = await determineCircuitTypeFromMappings(devices, context);
  if (mappedType) {
    return mappedType;
  }

  // 2. Fallback heuristique simple
  const typeCounts = {};
  for (const d of devices) {
    const t = d.type_element || 'autre';
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }

  const sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
  const dominant = sorted[0]?.[0] || 'prise';

  // Heuristique va-et-vient : lumière + plusieurs interrupteurs
  if (dominant === 'lumiere') {
    const interrupteurs = devices.filter(d => d.type_element === 'interrupteur').length;
    if (interrupteurs >= 2) return 'va-et-vient';
  }

  return dominant;
}

/**
 * Interroge le RAG pour obtenir les paramètres d'un circuit.
 */
async function enrichCircuitWithRAG(type, count) {
  const query = `circuit électrique ${type} avec ${count} point${count > 1 ? 's' : ''} : section conducteurs, nombre de fils, diamètre de gaine`;

  try {
    const context = await searchForCircuitContext(query, 2);
    return context;
  } catch (err) {
    console.warn('Erreur enrichissement RAG:', err.message);
    return [];
  }
}

/**
 * Construit une liste de circuits à partir de dispositifs OCR.
 * @param {Array} dispositifs - Liste des dispositifs extraits
 * @param {Object} options
 * @param {number} options.maxPrisesParCircuit - Maximum de prises regroupées (défaut 8)
 * @param {boolean} options.useRAG - Active l'enrichissement par RAG (défaut true)
 */
async function buildCircuitsFromDevices(dispositifs, options = {}) {
  const {
    maxPrisesParCircuit = 8,
    useRAG = true,
    context = {}
  } = options;

  if (!Array.isArray(dispositifs) || dispositifs.length === 0) {
    return [];
  }

  // Regroupement par type et proximité spatiale
  const groups = groupDevicesByTypeAndProximity(dispositifs, maxPrisesParCircuit);
  const circuits = [];

  for (const group of groups) {
    const type = await determineCircuitType(group, context);
    const count = group.length;
    const positions = group.map(d => ({ x: d.position_x, y: d.position_y }));
    const length = estimateLength(positions);

    let ragContext = [];
    if (useRAG) {
      ragContext = await enrichCircuitWithRAG(type, count);
    }

    const circuit = {
      type,
      longueur: length,
      nb_prises: type === 'prise' ? count : 1,
      nb_points: count,
      label: group.map(d => d.label).filter(Boolean).join(', ').substring(0, 100),
      rag_context: ragContext
    };

    circuits.push(circuit);
  }

  return circuits;
}

/**
 * Regroupe les dispositifs par type et par proximité spatiale.
 * Les prises sont regroupées par lots de maxPrisesParCircuit.
 */
function groupDevicesByTypeAndProximity(devices, maxPrisesParCircuit) {
  // D'abord regrouper par type
  const byType = {};
  for (const d of devices) {
    const type = d.type_element || 'autre';
    if (!byType[type]) byType[type] = [];
    byType[type].push(d);
  }

  const groups = [];

  for (const [type, items] of Object.entries(byType)) {
    // Trier par position Y puis X pour regrouper les proches
    const sorted = [...items].sort((a, b) => {
      const dy = (a.position_y || 0) - (b.position_y || 0);
      if (Math.abs(dy) > 50) return dy;
      return (a.position_x || 0) - (b.position_x || 0);
    });

    if (type === 'prise') {
      // Découper en circuits de maxPrisesParCircuit maximum
      for (let i = 0; i < sorted.length; i += maxPrisesParCircuit) {
        groups.push(sorted.slice(i, i + maxPrisesParCircuit));
      }
    } else {
      // Un circuit par point lumineux / commande, ou regrouper les très proches
      const processed = new Set();
      for (const d of sorted) {
        if (processed.has(d)) continue;

        const nearby = [d];
        processed.add(d);

        for (const other of sorted) {
          if (processed.has(other)) continue;
          const dist = Math.sqrt(
            Math.pow((d.position_x || 0) - (other.position_x || 0), 2) +
            Math.pow((d.position_y || 0) - (other.position_y || 0), 2)
          );
          if (dist < 80) {
            nearby.push(other);
            processed.add(other);
          }
        }

        groups.push(nearby);
      }
    }
  }

  return groups;
}

module.exports = {
  buildCircuitsFromDevices,
  estimateLength,
  determineCircuitType,
  enrichCircuitWithRAG,
  groupDevicesByTypeAndProximity
};
