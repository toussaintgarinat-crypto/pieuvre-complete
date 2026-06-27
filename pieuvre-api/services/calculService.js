// ====================================================================
// PIEUVRE API - Service de calcul de bon de coupe
// Logique métier partagée entre /api/calculs/compute et les scans OCR
// ====================================================================

const { query } = require('../db/postgres');
const { generateBonDeCoupe } = require('../utils/algorithms');

// Types de circuits : conducteurs requis selon type
function expandCircuit(circuit, profil) {
  const type = (circuit.type || '').toLowerCase();
  const couleursPreferees = profil.couleurs_preferees || ['Rouge', 'Bleu', 'Vert/Jaune', 'Orange', 'Noir', 'Violet', 'Marron'];
  const couleurPhase = couleursPreferees.find(c => c !== 'Bleu' && c !== 'Vert/Jaune') || 'Rouge';

  const base = {
    id: circuit.id || `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    longueur: parseFloat(circuit.longueur) || 0,
    nb_prises: parseInt(circuit.nb_prises) || 1,
    nb_points: parseInt(circuit.nb_points) || parseInt(circuit.nb_prises) || 1,
    phase_required: true,
    neutre_required: true,
    terre_required: true,
    phase_couleur: couleurPhase,
    navettes: [],
    // Localisation pour étiquetage
    etage: circuit.etage || '',
    appartement: circuit.appartement || circuit.logement || '',
    logement: circuit.logement || circuit.appartement || '',
    numero_boite: circuit.numero_boite || circuit.boite || null,
    batiment: circuit.batiment || '',
    // Mode dérivation
    mode_production: circuit.mode_production || 'direct',
    longueur_derivation_m: parseFloat(circuit.longueur_derivation_m) || null
  };

  switch (type) {
    case 'prise':
    case 'p': {
      const s = parseFloat(profil.prises_section) || 2.5;
      return { ...base, phase_section: s, neutre_section: s, terre_section: s };
    }
    case 'lumiere':
    case 'l': {
      const s = parseFloat(profil.eclairage_section) || 1.5;
      return { ...base, phase_section: s, neutre_section: s, terre_section: s };
    }
    case 'va-et-vient':
    case 'vd': {
      const s = parseFloat(profil.eclairage_section) || 1.5;
      const nav = couleursPreferees.filter(c => c !== 'Bleu' && c !== 'Vert/Jaune' && c !== couleurPhase);
      return {
        ...base, phase_section: s, neutre_section: s, terre_section: s,
        navettes: [
          { couleur: nav[0] || 'Orange', section: s },
          { couleur: nav[1] || 'Violet', section: s }
        ]
      };
    }
    case 'double-allumage':
    case 'da': {
      const s = parseFloat(profil.eclairage_section) || 1.5;
      const nav = couleursPreferees.filter(c => c !== 'Bleu' && c !== 'Vert/Jaune' && c !== couleurPhase);
      return {
        ...base, phase_section: s, neutre_section: s, terre_section: s,
        navettes: [
          { couleur: nav[0] || 'Orange', section: s },
          { couleur: nav[1] || 'Violet', section: s },
          { couleur: nav[2] || 'Marron', section: s }
        ]
      };
    }
    case 'telerupteur':
    case 'tel': {
      const s = parseFloat(profil.eclairage_section) || 1.5;
      const nav = couleursPreferees.filter(c => c !== 'Bleu' && c !== 'Vert/Jaune' && c !== couleurPhase);
      return {
        ...base, phase_section: s, neutre_section: s, terre_section: s,
        navettes: [{ couleur: nav[0] || 'Orange', section: s }]
      };
    }
    case 'volet':
    case 'vr': {
      const s = 1.5;
      const nav = couleursPreferees.filter(c => c !== 'Bleu' && c !== 'Vert/Jaune' && c !== couleurPhase);
      return {
        ...base, phase_section: s, neutre_section: s, terre_section: s,
        navettes: [
          { couleur: nav[0] || 'Orange', section: s },
          { couleur: nav[1] || 'Violet', section: s }
        ]
      };
    }
    case 'cuisiniere':
    case 'cuis': {
      const s = parseFloat(profil.cuisson_section) || 6.0;
      return { ...base, phase_section: s, neutre_section: s, terre_section: s };
    }
    case 'vmc': {
      const s = 1.5;
      return { ...base, phase_section: s, neutre_section: s, terre_section: s };
    }
    case 'bs': {
      const s = 1.5;
      return { ...base, phase_section: s, neutre_section: s, terre_section: s };
    }
    default: {
      const s = parseFloat(profil.prises_section) || 2.5;
      return { ...base, phase_section: s, neutre_section: s, terre_section: s };
    }
  }
}

/**
 * Récupère le profil complet d'un chantier.
 */
async function getChantierProfil(id_chantier) {
  const profilResult = await query(`
    SELECT
      ch.id AS chantier_id,
      cl.id AS client_id,
      COALESCE(ch.prises_section, cl.prises_section) AS prises_section,
      COALESCE(ch.eclairage_section, cl.eclairage_section) AS eclairage_section,
      COALESCE(ch.volets_section, cl.volets_section) AS volets_section,
      COALESCE(ch.cuisson_section, cl.cuisson_section) AS cuisson_section,
      COALESCE(ch.marge_fils, cl.marge_fils, 10) AS marge_fils,
      COALESCE(ch.marge_gaines, cl.marge_gaines, 10) AS marge_gaines,
      COALESCE(ch.longueur_min_fils, cl.longueur_min_fils, 1) AS longueur_min_fils,
      COALESCE(ch.longueur_min_gaines, cl.longueur_min_gaines, 1) AS longueur_min_gaines,
      COALESCE(ch.gaines_disponibles, cl.gaines_disponibles) AS gaines_disponibles,
      cl.couleurs_preferees,
      cl.preferences_etiquettes as client_preferences_etiquettes,
      ch.preferences_etiquettes as chantier_preferences_etiquettes,
      ch.type_support,
      ch.hauteur_plafond_m,
      ch.hauteur_prise_m,
      ch.hauteur_interrupteur_m,
      ch.besoin_pots,
      ch.types_pots,
      ch.mode_production,
      ch.longueur_derivation_m
    FROM chantiers ch
    JOIN clients cl ON ch.id_client = cl.id
    WHERE ch.id = $1
  `, [id_chantier]);

  if (profilResult.rows.length === 0) {
    throw new Error('Chantier non trouvé');
  }

  const profil = profilResult.rows[0];
  if (profil.gaines_disponibles && typeof profil.gaines_disponibles === 'string') {
    profil.gaines_disponibles = JSON.parse(profil.gaines_disponibles);
  }
  if (profil.couleurs_preferees && typeof profil.couleurs_preferees === 'string') {
    profil.couleurs_preferees = JSON.parse(profil.couleurs_preferees);
  }

  return profil;
}

/**
 * Calcule un bon de coupe à partir de circuits simplifiés.
 * @param {number} id_chantier
 * @param {Array} circuits - Circuits simplifiés [{ type, longueur, nb_prises, nb_points }]
 */
async function computeBonDeCoupe(id_chantier, circuits, options = {}) {
  if (!id_chantier || !Array.isArray(circuits) || circuits.length === 0) {
    throw new Error('id_chantier et circuits[] sont requis');
  }

  const profil = await getChantierProfil(id_chantier);

  // Permettre d'override le mode de production/étiquetage depuis la requête
  if (options.mode_production) {
    profil.mode_production = options.mode_production;
  }
  if (options.mode_etiquetage) {
    profil.mode_etiquetage = options.mode_etiquetage;
  }
  if (options.regroupement) {
    profil.regroupement = options.regroupement;
  }

  const stockCouleursResult = await query('SELECT couleur, section, quantite_metres, seuil_alerte FROM stock_couleurs');
  const stockGainesResult = await query('SELECT diametre, quantite_metres, seuil_alerte FROM stock_gaines');

  const circuitsComplets = circuits.map(c => expandCircuit(c, profil));

  return generateBonDeCoupe(
    circuitsComplets,
    stockCouleursResult.rows,
    profil,
    stockGainesResult.rows,
    profil.mode_production || 'direct'
  );
}

module.exports = {
  computeBonDeCoupe,
  expandCircuit,
  getChantierProfil
};
