#!/usr/bin/env node
// ====================================================================
// PIEUVRE AUTO - Script de Test Complet
// Simule une maison 标准测试 et génère un bon de coupe
// ====================================================================

const { generateBonDeCoupe } = require('./utils/algorithms');

// Données de test : circuits d'une maison 标准测试
const circuitsMaisonTest = [
  // === ÉCLAIRAGE (1.5mm²) ===
  {
    id: 'L1',
    type: 'eclairage',
    longueur: 8.5,
    phase_required: true,
    neutre_required: true,
    terre_required: true,
    terre_section: 1.5,
    phase_couleur: 'Rouge',
    phase_section: 1.5
  },
  {
    id: 'L2',
    type: 'eclairage',
    longueur: 12.3,
    phase_required: true,
    neutre_required: true,
    terre_required: true,
    terre_section: 1.5,
    phase_couleur: 'Rouge',
    phase_section: 1.5
  },
  {
    id: 'L3',
    type: 'eclairage',
    longueur: 15.7,
    phase_required: true,
    neutre_required: true,
    terre_required: true,
    terre_section: 1.5,
    phase_couleur: 'Rouge',
    phase_section: 1.5
  },
  {
    id: 'L4',
    type: 'eclairage',
    longueur: 9.2,
    phase_required: true,
    neutre_required: true,
    terre_required: true,
    terre_section: 1.5,
    phase_couleur: 'Rouge',
    phase_section: 1.5
  },

  // === PRISES (2.5mm²) - 12 prises = 2 circuits (NF C 15-100: max 8/circuit)
  {
    id: 'P1',
    type: 'prise',
    longueur: 25.5,
    nb_prises: 6,
    phase_required: true,
    neutre_required: true,
    terre_required: true,
    terre_section: 2.5,  // Prises: terre en 2.5mm²
    phase_couleur: 'Rouge',
    phase_section: 2.5
  },
  {
    id: 'P2',
    type: 'prise',
    longueur: 32.8,
    nb_prises: 6,
    phase_required: true,
    neutre_required: true,
    terre_required: true,
    terre_section: 2.5,
    phase_couleur: 'Rouge',
    phase_section: 2.5
  },

  // === VOLETS ROULANTS (1.5mm²)
  {
    id: 'VR1',
    type: 'volet',
    longueur: 7.5,
    phase_required: true,
    neutre_required: false,
    terre_required: true,
    terre_section: 1.5,
    navettes: [
      { couleur: 'Violet', section: 1.5 },  // Violet = RUPTURE, sera substitué
      { couleur: 'Orange', section: 1.5 }
    ],
    phase_couleur: 'Rouge',
    phase_section: 1.5
  },
  {
    id: 'VR2',
    type: 'volet',
    longueur: 8.2,
    phase_required: true,
    neutre_required: false,
    terre_required: true,
    terre_section: 1.5,
    navettes: [
      { couleur: 'Violet', section: 1.5 },
      { couleur: 'Orange', section: 1.5 }
    ],
    phase_couleur: 'Rouge',
    phase_section: 1.5
  },
  {
    id: 'VR3',
    type: 'volet',
    longueur: 6.9,
    phase_required: true,
    neutre_required: false,
    terre_required: true,
    terre_section: 1.5,
    navettes: [
      { couleur: 'Violet', section: 1.5 },
      { couleur: 'Orange', section: 1.5 }
    ],
    phase_couleur: 'Rouge',
    phase_section: 1.5
  },

  // === VMC (1.5mm²)
  {
    id: 'VMC1',
    type: 'vmc',
    longueur: 18.5,
    phase_required: true,
    neutre_required: true,
    terre_required: true,
    terre_section: 1.5,
    phase_couleur: 'Rouge',
    phase_section: 1.5
  }
];

// Stock de test (avec quelques couleurs en rupture pour tester les substitutions)
const stockCouleursTest = [
  // Section 1.5mm² - OK
  { couleur: 'Rouge', section: 1.5, quantite_metres: 500, seuil_alerte: 100 },
  { couleur: 'Bleu', section: 1.5, quantite_metres: 400, seuil_alerte: 100 },
  { couleur: 'Vert/Jaune', section: 1.5, quantite_metres: 300, seuil_alerte: 100 },
  { couleur: 'Orange', section: 1.5, quantite_metres: 50, seuil_alerte: 100 },  // Stock bas
  { couleur: 'Violet', section: 1.5, quantite_metres: 0, seuil_alerte: 100 },   // RUPTURE
  { couleur: 'Noir', section: 1.5, quantite_metres: 200, seuil_alerte: 100 },
  { couleur: 'Marron', section: 1.5, quantite_metres: 150, seuil_alerte: 100 },

  // Section 2.5mm²
  { couleur: 'Rouge', section: 2.5, quantite_metres: 300, seuil_alerte: 100 },
  { couleur: 'Bleu', section: 2.5, quantite_metres: 350, seuil_alerte: 100 },
  { couleur: 'Vert/Jaune', section: 2.5, quantite_metres: 400, seuil_alerte: 100 },
  { couleur: 'Orange', section: 2.5, quantite_metres: 100, seuil_alerte: 100 },
  { couleur: 'Noir', section: 2.5, quantite_metres: 0, seuil_alerte: 100 },     // RUPTURE
  { couleur: 'Violet', section: 2.5, quantite_metres: 80, seuil_alerte: 100 },
  { couleur: 'Marron', section: 2.5, quantite_metres: 120, seuil_alerte: 100 }
];

// Stock gaines de test
const stockGainesTest = [
  { diametre: 16, quantite_metres: 500, seuil_alerte: 50 },
  { diametre: 20, quantite_metres: 400, seuil_alerte: 50 },
  { diametre: 25, quantite_metres: 300, seuil_alerte: 50 },
  { diametre: 32, quantite_metres: 150, seuil_alerte: 30 }
];

// Profil chantier (hérite du client Maison Test)
const profilChantier = {
  prises_section: 2.5,
  eclairage_section: 1.5,
  volets_section: 1.5,
  gaines_disponibles: [16, 20, 25, 32],
  marge_fils: 10,
  marge_gaines: 10
};

// ====================================================================
// EXÉCUTION DU TEST
// ====================================================================

console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║                    PIEUVRE AUTO - TEST COMPLET                      ║
║                 Génération Bon de Coupe Maison 测试                   ║
╚══════════════════════════════════════════════════════════════════════╝
`);

// Afficher les circuits de test
console.log('📋 CIRCUITS DÉTECTÉS:');
console.log('─'.repeat(60));
circuitsMaisonTest.forEach(c => {
  const nb = c.nb_prises ? ` (${c.nb_prises} prises)` : '';
  const nav = c.navettes ? ` + ${c.navettes.length} navettes` : '';
  console.log(`  ${c.id.padEnd(6)} | ${c.type.padEnd(10)} | ${c.longueur}m${nb}${nav}`);
});
console.log('');

// Afficher le stock
console.log('📦 STOCK INITIAL:');
console.log('─'.repeat(60));
stockCouleursTest.forEach(s => {
  const etat = s.quantite_metres === 0 ? '🚫 RUPTURE' : 
               s.quantite_metres < s.seuil_alerte ? '⚠️  BAS' : '✓ OK';
  console.log(`  ${s.couleur.padEnd(12)} ${s.section}mm² | ${String(s.quantite_metres).padStart(4)}m | ${etat}`);
});
console.log('');

// Exécuter l'algorithme
console.log('⚙️  CALCUL EN COURS...');
console.log('');

const bonDeCoupe = generateBonDeCoupe(
  circuitsMaisonTest,
  stockCouleursTest,
  profilChantier,
  stockGainesTest
);

// Afficher le résultat
console.log(`
═══════════════════════════════════════════════════════════════════════
                         BON DE Coupe
═══════════════════════════════════════════════════════════════════════

📍 CHANTIER: Maison 测试标准测试
📅 DATE: ${new Date().toLocaleString('fr-FR')}
`);

// FILS
console.log('═══════════════════════════════════════════════════════════════');
console.log('                          FILS');
console.log('═══════════════════════════════════════════════════════════════');

// Regroupement par section
const filsParSection = {};
bonDeCoupe.fils.forEach(f => {
  if (!filsParSection[f.section]) {
    filsParSection[f.section] = [];
  }
  filsParSection[f.section].push(f);
});

Object.keys(filsParSection).sort().forEach(section => {
  console.log(`\n  📌 Section ${section}mm²`);
  console.log('  ─────────────────────────────────────');
  filsParSection[section].forEach(fil => {
    const subst = fil.substituee ? ' → SUBSTITUÉ' : '';
    const mut = fil.mutualisee ? ' (mutualisée)' : '';
    console.log(`    ${fil.couleur.padEnd(12)} ${fil.longueur.toFixed(1).padStart(7)}m${subst}${mut}`);
  });
});

// GAINES
console.log('\n\n═══════════════════════════════════════════════════════════════');
console.log('                         GAINES');
console.log('═══════════════════════════════════════════════════════════════');

bonDeCoupe.gaines.forEach(g => {
  console.log(`  Ø${g.diametre}mm  | ${g.longueur.toFixed(1)}m | Circuits: ${g.circuits.join(', ')}`);
});

// ALERTES
if (bonDeCoupe.alertes.length > 0) {
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('                         ALERTES');
  console.log('═══════════════════════════════════════════════════════════════');
  
  bonDeCoupe.alertes.forEach(alerte => {
    const emoji = alerte.severite === 'error' ? '🚫' : 
                  alerte.severite === 'warning' ? '⚠️' : 'ℹ️';
    console.log(`  ${emoji} [${alerte.severite.toUpperCase()}] ${alerte.message}`);
  });
}

// STATISTIQUES
console.log('\n\n═══════════════════════════════════════════════════════════════');
console.log('                      STATISTIQUES');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  📊 Circuits analysés:     ${bonDeCoupe.circuits.length}`);
console.log(`  📏 Longueur totale fils:  ${bonDeCoupe.stats.longueur_totale_fils.toFixed(1)}m`);
console.log(`  📏 Longueur totale gaines: ${bonDeCoupe.stats.longueur_totale_gaines.toFixed(1)}m`);
console.log(`  🔄 Substitutions:        ${bonDeCoupe.stats.nb_substitutions}`);
console.log(`  ⚡ Doublages pris es:    ${bonDeCoupe.stats.nb_doublages}`);

console.log('\n═══════════════════════════════════════════════════════════════\n');

// Résultat JSON pour debug
console.log('📄 RÉSULTAT JSON (pour insertion en base):');
console.log('─'.repeat(60));
console.log(JSON.stringify(bonDeCoupe, null, 2).substring(0, 500) + '...');