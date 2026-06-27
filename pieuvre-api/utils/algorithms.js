// ====================================================================
// PIEUVRE API - Algorithmes d'optimisation
// ====================================================================

/**
 * Calcule le diamètre d'un câble en fonction de sa section
 * Valeurs approximatives pour câbles rigides R2V
 */
function getCableDiameter(section) {
  const diameters = {
    1.5: 2.8,   // mm
    2.5: 3.4,
    4: 4.1,
    6: 5.1,
    10: 6.6,
    16: 8.4
  };
  return diameters[section] || 3.0;
}

/**
 * Calcule le diamètre minimal de gaine nécessaire
 * Selon NF C 15-100 : taux de remplissage ~40%
 * @param {Array} cables - Array de {section}
 * @param {Array} gainesDisponibles - Tableau des Ø disponibles (ex: [20, 25, 32])
 */
function calculateMinGaineDiameter(cables, gainesDisponibles = null) {
  // Surface totale des câbles
  const totalSurface = cables.reduce((sum, cable) => {
    const diameter = getCableDiameter(cable.section);
    const radius = diameter / 2;
    const surface = Math.PI * radius * radius;
    return sum + surface;
  }, 0);
  
  // Surface nécessaire de gaine (40% de remplissage = 1/3 environ)
  const requiredGaineSurface = totalSurface / 0.4;
  
  // Diamètre correspondant
  const requiredDiameter = 2 * Math.sqrt(requiredGaineSurface / Math.PI);
  
  // Liste des diamètres standards
  const standardDiameters = gainesDisponibles || [16, 20, 25, 32, 40, 50, 63];
  
  // Trier et trouver le premier diamètre >= nécessaire
  const sortedDiameters = [...standardDiameters].sort((a, b) => a - b);
  return sortedDiameters.find(d => d >= requiredDiameter) || 63;
}

/**
 * Applique une marge à une longueur
 * @param {number} longueur - Longueur de base en mètres
 * @param {number} marge - Pourcentage de marge (ex: 10 pour 10%)
 * @param {number} longueurMin - Longueur minimale après marge
 * @returns {number} Longueur avec marge appliquée
 */
function applyMarge(longueur, marge, longueurMin = 1) {
  const avecMarge = longueur * (1 + marge / 100);
  return Math.max(avecMarge, longueurMin);
}

/**
 * Calcule les profils de marge effective
 * @param {Object} profil - Profil client/chantier avec marges
 * @returns {Object} Marges effectives (fallback sur valeurs par défaut)
 */
function getMargesEffectives(profil) {
  return {
    marge_fils: profil.marge_fils ?? 10,
    marge_gaines: profil.marge_gaines ?? 10,
    marge_cables: profil.marge_cables ?? 15,
    longueur_min_fils: profil.longueur_min_fils ?? 1,
    longueur_min_gaines: profil.longueur_min_gaines ?? 1
  };
}

/**
 * Détermine la hauteur d'installation d'un appareil selon son type
 * @param {string} type - Type de circuit/appareil
 * @param {Object} profil - Profil chantier avec hauteurs
 * @returns {number} Hauteur en mètres
 */
function getHauteurAppareil(type, profil) {
  const typeLower = (type || '').toLowerCase();
  const hPrise = profil.hauteur_prise_m ?? 0.30;
  const hInter = profil.hauteur_interrupteur_m ?? 1.10;
  
  if (['prise', 'p', 'p20', 'p_etanche', 'p_pmr', 'pg'].includes(typeLower)) {
    return hPrise;
  }
  if (['lumiere', 'l', 'lum', 'l_enc', 'vmc', 'bs'].includes(typeLower)) {
    return 0; // au plafond, pas de descente depuis le plafond
  }
  if (['interrupteur', 'i', 'vd', 'da', 'tel'].includes(typeLower)) {
    return hInter;
  }
  if (['cuisiniere', 'cuis', 'll', 'lv'].includes(typeLower)) {
    return hPrise + 0.20; // appareils de cuisine légèrement plus haut
  }
  return hPrise;
}

/**
 * Calcule la longueur de descente depuis le plafond jusqu'à l'appareil
 * @param {string} type - Type de circuit/appareil
 * @param {Object} profil - Profil chantier avec hauteur_plafond_m
 * @returns {number} Longueur de descente en mètres
 */
function calculateDescente(type, profil) {
  const hPlafond = profil.hauteur_plafond_m ?? 2.50;
  const hAppareil = getHauteurAppareil(type, profil);
  return Math.max(0, hPlafond - hAppareil);
}

/**
 * Calcule les pots / boîtiers nécessaires selon le support et les circuits
 * @param {Array} circuits - Circuits optimisés
 * @param {Object} profil - Profil chantier
 * @returns {Array} Liste des pots avec quantité
 */
function calculatePots(circuits, profil) {
  if (!profil.besoin_pots) return [];
  
  const typeSupport = profil.type_support || 'planchette';
  const pots = [];
  let totalPoints = 0;
  
  circuits.forEach(circuit => {
    const nbPoints = circuit.nb_points || circuit.nb_prises || 1;
    totalPoints += nbPoints;
  });
  
  // 1 pot par point d'appareil (prise, lumière, interrupteur...)
  pots.push({
    type: 'boite_encastrement',
    quantite: totalPoints,
    unite: 'pcs',
    justificatif: `${totalPoints} point(s) d'appareil`
  });
  
  // En dalle plein, on ajoute des boîtes de dérivation (pas de passage dans le plafond)
  if (typeSupport === 'dalle_plein') {
    pots.push({
      type: 'boite_derivation',
      quantite: circuits.length,
      unite: 'pcs',
      justificatif: '1 boîte de dérivation par circuit en dalle plein'
    });
  }
  
  // Faux-plafond / planchette : gaines annulaires si besoin
  if (typeSupport === 'planchette' || typeSupport === 'mixte') {
    pots.push({
      type: 'manchon_annulaire',
      quantite: Math.ceil(totalPoints / 2),
      unite: 'pcs',
      justificatif: 'Manchons pour passage étanche dans planchette'
    });
  }
  
  return pots;
}

/**
 * Mutualise les conductores de terre entre circuits partageant la même gaine
 * Règle: utiliser la section max de terre nécessaire
 */
function mutualizeConductors(circuits) {
  // Grouper les circuits par gaine (même point de départ)
  const gaineGroups = {};
  
  circuits.forEach(circuit => {
    const gaineId = circuit.gaine_id || circuit.id;
    if (!gaineGroups[gaineId]) {
      gaineGroups[gaineId] = [];
    }
    gaineGroups[gaineId].push(circuit);
  });
  
  // Pour chaque groupe, trouver la section max de terre
  Object.values(gaineGroups).forEach(groupe => {
    const maxTerreSection = Math.max(...groupe.map(c => c.terre_section || 0));
    
    // Appliquer à tous les circuits du groupe
    groupe.forEach(circuit => {
      circuit.terre_section_mutualisee = maxTerreSection;
      circuit.terre_mutualisee = groupe.length > 1;
    });
  });
  
  return circuits;
}

/**
 * Vérifie si le circuit nécessite un doublage (circuit prise > 8 prises)
 * Selon NF C 15-100: max 8 prises par circuit
 * @returns {Object} { besoinDoublage: boolean, nbCircuits: number, raison: string }
 */
function checkDoublagePrises(circuit) {
  if (circuit.type !== 'prise') {
    return { besoinDoublage: false, nbCircuits: 1, raison: null };
  }
  
  const nbPrises = circuit.nb_prises || 1;
  const MAX_PRISES_PAR_CIRCUIT = 8;
  
  if (nbPrises > MAX_PRISES_PAR_CIRCUIT) {
    const nbCircuits = Math.ceil(nbPrises / MAX_PRISES_PAR_CIRCUIT);
    return {
      besoinDoublage: true,
      nbCircuits: nbCircuits,
      raison: `${nbPrises} prises > ${MAX_PRISES_PAR_CIRCUIT} → ${nbCircuits} circuits d'alimentation`
    };
  }
  
  return { besoinDoublage: false, nbCircuits: 1, raison: null };
}

/**
 * Trouve une couleur de remplacement si stock insuffisant
 * Respecte les contraintes normatives (Phase, Neutre, Terre)
 */
function findCouleurAlternative(couleurOriginale, fonction, section, stock) {
  // Contraintes strictes
  const NEUTRE_OBLIGATOIRE = 'Bleu';
  const TERRE_OBLIGATOIRE = 'Vert/Jaune';
  
  // Le neutre et la terre ne peuvent pas être substitués
  if (fonction === 'Neutre' || couleurOriginale === NEUTRE_OBLIGATOIRE) {
    return null; // Pas de substitution possible
  }
  
  if (fonction === 'Terre' || couleurOriginale === TERRE_OBLIGATOIRE) {
    return null; // Pas de substitution possible
  }
  
  // Pour Phase et Navettes, chercher parmi les couleurs disponibles
  const couleursPhaseAutorisees = ['Rouge', 'Noir', 'Marron'];
  const couleursNavetteAutorisees = ['Orange', 'Violet', 'Marron', 'Gris', 'Blanc'];
  
  let couleursPermises = [];
  
  if (fonction === 'Phase') {
    couleursPermises = couleursPhaseAutorisees;
  } else if (fonction === 'Navette' || fonction === 'Retour') {
    couleursPermises = couleursNavetteAutorisees;
  } else {
    // Autres fonctions: toutes sauf Bleu et V/J
    couleursPermises = ['Rouge', 'Noir', 'Orange', 'Violet', 'Marron', 'Gris', 'Blanc'];
  }
  
  // Chercher dans le stock
  for (const couleur of couleursPermises) {
    if (couleur === couleurOriginale) continue; // Déjà essayé
    
    const stockItem = stock.find(s => s.couleur === couleur && s.section === section);
    if (stockItem && stockItem.quantite_metres > 0) {
      return couleur;
    }
  }
  
  return null; // Aucune alternative trouvée
}

/**
 * Construit les circuits en mode alimentation + dérivation.
 * Chaque circuit original génère un circuit d'alimentation tableau → boîte de dérivation
 * puis un circuit de dérivation par point d'appareil (boîte → appareil).
 */
function buildDerivationCircuits(circuits, longueurDerivationDefault = 2.5) {
  const result = [];

  circuits.forEach(circuit => {
    const nbPoints = circuit.nb_points || circuit.nb_prises || 1;
    const longueurDerivation = parseFloat(circuit.longueur_derivation_m) || longueurDerivationDefault;
    const longueurOriginale = parseFloat(circuit.longueur) || 0;

    // Longueur du tronçon commun (alimentation) = longueur totale - portion moyenne dérivation
    const longueurAlim = Math.max(0, longueurOriginale - longueurDerivation);

    // Circuit d'alimentation (phase/neutre/terre uniquement, pas de navettes)
    result.push({
      ...circuit,
      id: `${circuit.id}-alim`,
      type: 'alimentation',
      type_code: 'ALIM',
      longueur: longueurAlim,
      nb_prises: nbPoints,
      nb_points: nbPoints,
      navettes: [],
      est_alimentation: true,
      circuit_source: circuit.id,
      info: 'Alimentation tableau → boîte de dérivation'
    });

    // Circuits de dérivation (un par point)
    for (let i = 0; i < nbPoints; i++) {
      result.push({
        ...circuit,
        id: `${circuit.id}-deriv-${i + 1}`,
        type: circuit.type,
        longueur: longueurDerivation,
        nb_prises: 1,
        nb_points: 1,
        est_derivation: true,
        circuit_source: circuit.id,
        derivation_index: i + 1,
        info: `Dérivation boîte → appareil ${i + 1}`
      });
    }
  });

  return result;
}

/**
 * Génère un bon de coupe optimisé
 * @param {Array} circuits - Circuits à calculer
 * @param {Array} stock - Stock disponible {couleur, section, quantite_metres}
 * @param {Object} profilChantier - Profil du chantier {prises_section, eclairage_section, gaines_disponibles}
 * @param {Array} stockGaines - Stock gaines {diametre, quantite_metres}
 * @param {string} modeProduction - 'direct' ou 'derivation'
 */
function generateBonDeCoupe(circuits, stock, profilChantier, stockGaines = null, modeProduction = 'direct') {
  const bonDeCoupe = {
    fils: [],
    gaines: [],
    circuits: [],
    substitutions: {},
    alertes: [],
    stats: {
      longueur_totale_fils: 0,
      longueur_totale_gaines: 0,
      nb_substitutions: 0,
      nb_doublages: 0
    }
  };
  
  // Récupérer les gaines disponibles (par défaut toutes)
  const gainesDisponibles = profilChantier.gaines_disponibles || [16, 20, 25, 32, 40, 50, 63];

  // Récupérer les marges (pour fils et gaines)
  const marges = getMargesEffectives(profilChantier);

  // Déterminer le mode de production effectif
  const modeProductionEffectif = modeProduction === 'derivation' ? 'derivation' : 'direct';
  const longueurDerivationDefault = parseFloat(profilChantier.longueur_derivation_m) || 2.5;

  // Transformer les circuits selon le mode de production
  let circuitsEnEntree = circuits;
  if (modeProductionEffectif === 'derivation') {
    circuitsEnEntree = buildDerivationCircuits(circuits, longueurDerivationDefault);
    bonDeCoupe.alertes.push({
      type: 'mode_production',
      message: `Mode de production : alimentation + dérivation (longueur dérivation ${longueurDerivationDefault}m)`,
      severite: 'info'
    });
  }

  // 1. Traiter le doublage des prises (NF C 15-100: max 8 prises/circuit)
  const circuitsTraites = [];

  circuitsEnEntree.forEach(circuit => {
    const doublage = checkDoublagePrises(circuit);
    
    if (doublage.besoinDoublage) {
      bonDeCoupe.stats.nb_doublages += doublage.nbCircuits - 1;
      bonDeCoupe.alertes.push({
        type: 'doublage',
        message: doublage.raison,
        severite: 'info'
      });
      
      // Créer plusieurs circuits d'alimentation
      const prisesParCircuit = Math.ceil(circuit.nb_prises / doublage.nbCircuits);
      
      for (let i = 0; i < doublage.nbCircuits; i++) {
        circuitsTraites.push({
          ...circuit,
          id: `${circuit.id}_${i + 1}`,
          nb_prises: Math.min(prisesParCircuit, circuit.nb_prises - (i * prisesParCircuit)),
          circuit_source: circuit.id,
          est_doublage: true,
          numero_circuit: i + 1
        });
      }
    } else {
      circuitsTraites.push(circuit);
    }
  });
  
  // 2. Mutualiser les terres
  const circuitsOptimises = mutualizeConductors(circuitsTraites);
  
  // 2. Pour chaque circuit, calculer les besoins
  circuitsOptimises.forEach(circuit => {
    const nbPoints = circuit.nb_points || circuit.nb_prises || 1;
    const descente = calculateDescente(circuit.type, profilChantier);
    const longueurTotale = circuit.longueur + (descente * nbPoints);
    
    const circuitDetail = {
      id: circuit.id,
      type: circuit.type,
      type_code: circuit.type_code || circuit.type,
      longueur: circuit.longueur,
      nb_points: nbPoints,
      descente_par_point: descente,
      longueur_totale: longueurTotale,
      // Localisation pour étiquetage
      etage: circuit.etage || '',
      appartement: circuit.appartement || '',
      logement: circuit.logement || circuit.appartement || '',
      numero_boite: circuit.numero_boite || null,
      batiment: circuit.batiment || '',
      // Mode production
      est_alimentation: circuit.est_alimentation || false,
      est_derivation: circuit.est_derivation || false,
      circuit_source: circuit.circuit_source || null,
      conducteurs: []
    };
    
    // Phase
    if (circuit.phase_required) {
      circuitDetail.conducteurs.push({
        fonction: 'Phase',
        couleur: circuit.phase_couleur || 'Rouge',
        section: circuit.phase_section || profilChantier.prises_section,
        longueur: longueurTotale
      });
    }
    
    // Neutre
    if (circuit.neutre_required) {
      circuitDetail.conducteurs.push({
        fonction: 'Neutre',
        couleur: 'Bleu',
        section: circuit.neutre_section || profilChantier.prises_section,
        longueur: longueurTotale
      });
    }
    
    // Terre (mutualisée ou non)
    if (circuit.terre_required) {
      circuitDetail.conducteurs.push({
        fonction: 'Terre',
        couleur: 'Vert/Jaune',
        section: circuit.terre_section_mutualisee || circuit.terre_section,
        longueur: longueurTotale,
        mutualisee: circuit.terre_mutualisee
      });
    }
    
    // Navettes (va-et-vient, télérupteurs, etc.)
    if (circuit.navettes && circuit.navettes.length > 0) {
      circuit.navettes.forEach((navette, index) => {
        circuitDetail.conducteurs.push({
          fonction: 'Navette',
          couleur: navette.couleur || 'Orange',
          section: navette.section || 1.5,
          longueur: longueurTotale
        });
      });
    }
    
    bonDeCoupe.circuits.push(circuitDetail);
  });
  
  // 3. Agréger les fils par couleur et section
  const filsMap = new Map();
  
  bonDeCoupe.circuits.forEach(circuit => {
    circuit.conducteurs.forEach(conducteur => {
      const key = `${conducteur.couleur}_${conducteur.section}`;
      
      if (!filsMap.has(key)) {
        filsMap.set(key, {
          couleur: conducteur.couleur,
          section: conducteur.section,
          fonction: conducteur.fonction,
          longueur: 0,
          longueur_base: 0,
          marge_appliquee: 0,
          circuits: []
        });
      }
      
      const fil = filsMap.get(key);
      fil.longueur_base += conducteur.longueur;
      fil.circuits.push(circuit.id);
    });
  });
  
  // Appliquer les marges aux fils
  bonDeCoupe.fils = Array.from(filsMap.values()).map(fil => {
    fil.marge_appliquee = marges.marge_fils;
    fil.longueur = applyMarge(fil.longueur_base, marges.marge_fils, marges.longueur_min_fils);
    return fil;
  });
  
  // 4. Vérifier le stock et substituer si nécessaire (sur longueur avec marge)
  bonDeCoupe.fils.forEach(fil => {
    const stockItem = stock.find(s => 
      s.couleur === fil.couleur && 
      s.section === fil.section
    );
    
    if (!stockItem || stockItem.quantite_metres < fil.longueur) {
      // Stock insuffisant, chercher alternative
      const alternative = findCouleurAlternative(
        fil.couleur,
        fil.fonction,
        fil.section,
        stock
      );
      
      if (alternative) {
        bonDeCoupe.substitutions[fil.couleur] = alternative;
        fil.couleur_originale = fil.couleur;
        fil.couleur = alternative;
        fil.substituee = true;
        bonDeCoupe.stats.nb_substitutions++;
        
        bonDeCoupe.alertes.push({
          type: 'substitution',
          message: `${fil.couleur_originale} ${fil.section}mm² remplacé par ${alternative}`,
          severite: 'warning'
        });
      } else {
        bonDeCoupe.alertes.push({
          type: 'rupture',
          message: `Stock insuffisant: ${fil.couleur} ${fil.section}mm² (besoin: ${fil.longueur}m, dispo: ${stockItem?.quantite_metres || 0}m)`,
          severite: 'error'
        });
      }
    }
    
    // Alerte si stock devient faible après utilisation
    if (stockItem) {
      const stockRestant = stockItem.quantite_metres - fil.longueur;
      if (stockRestant < stockItem.seuil_alerte && stockRestant >= 0) {
        bonDeCoupe.alertes.push({
          type: 'stock_bas',
          message: `Stock ${fil.couleur} ${fil.section}mm² sera bas après utilisation: ${stockRestant}m`,
          severite: 'info'
        });
      }
    }
  });
  
  // 5. Calculer les gaines nécessaires
  const gainesMap = new Map();
  
  bonDeCoupe.circuits.forEach(circuit => {
    const cables = circuit.conducteurs.map(c => ({
      section: c.section
    }));
    
    const diametreMin = calculateMinGaineDiameter(cables, gainesDisponibles);
    const key = `gaine_${diametreMin}`;
    
    if (!gainesMap.has(key)) {
      gainesMap.set(key, {
        diametre: diametreMin,
        longueur: 0,
        longueur_base: 0,
        marge_appliquee: marges.marge_gaines,
        circuits: []
      });
    }
    
    const gaine = gainesMap.get(key);
    gaine.longueur_base += circuit.longueur_totale;
    gaine.longueur = applyMarge(gaine.longueur_base, marges.marge_gaines, marges.longueur_min_gaines);
    gaine.circuits.push(circuit.id);
  });
  
  bonDeCoupe.gaines = Array.from(gainesMap.values());
  
  // 6. Vérifier le stock de gaines et alerter si problème
  if (stockGaines) {
bonDeCoupe.gaines.forEach(gaine => {
      const stockGaine = stockGaines.find(sg => sg.diametre === gaine.diametre);
      if (!stockGaine || stockGaine.quantite_metres < gaine.longueur) {
        bonDeCoupe.alertes.push({
          type: 'stock_gaine',
          message: `Stock insuffisant gaine Ø${gaine.diametre}: besoin ${gaine.longueur}m, dispo ${stockGaine?.quantite_metres || 0}m`,
          severite: 'error'
        });
      }
    });
  }
  
  // 7. Calculer les pots / boîtiers nécessaires
  bonDeCoupe.pots = calculatePots(circuitsOptimises, profilChantier);
  if (bonDeCoupe.pots.length > 0) {
    bonDeCoupe.stats.nb_pots = bonDeCoupe.pots.reduce((sum, p) => sum + p.quantite, 0);
  }
  
  // 8. Calculer les stats
  bonDeCoupe.stats.longueur_totale_fils = bonDeCoupe.fils.reduce((sum, f) => sum + f.longueur, 0);
  bonDeCoupe.stats.longueur_totale_gaines = bonDeCoupe.gaines.reduce((sum, g) => sum + g.longueur, 0);
  
  return bonDeCoupe;
}

module.exports = {
  getCableDiameter,
  calculateMinGaineDiameter,
  applyMarge,
  getMargesEffectives,
  mutualizeConductors,
  checkDoublagePrises,
  findCouleurAlternative,
  getHauteurAppareil,
  calculateDescente,
  calculatePots,
  generateBonDeCoupe
};
