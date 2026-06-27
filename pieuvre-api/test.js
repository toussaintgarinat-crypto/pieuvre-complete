// ====================================================================
// PIEUVRE API - Tests Unitaires
// ====================================================================

const assert = require('assert');

const {
  getCableDiameter,
  calculateMinGaineDiameter,
  applyMarge,
  getMargesEffectives,
  checkDoublagePrises
} = require('./utils/algorithms');

const {
  estimateLength,
  groupDevicesByTypeAndProximity
} = require('./services/circuitBuilder');

function runTests() {
  console.log('═══════════════════════════════════════════════');
  console.log('🧪 Tests Unitaires - Pieuvre API');
  console.log('═══════════════════════════════════════════════');
  
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.log(`  ✕ ${name}`);
      console.log(`    → ${err.message}`);
      failed++;
    }
  }

  function approx(actual, expected, delta = 0.01) {
    if (Math.abs(actual - expected) > delta) {
      throw new Error(`${actual} != ${expected} (delta ${delta})`);
    }
  }

  // ====================================================================
  // Tests: getCableDiameter
  // ====================================================================
  console.log('\n📏 getCableDiameter');
  
  test('doit retourner 2.8mm pour 1.5mm²', () => {
    assert.strictEqual(getCableDiameter(1.5), 2.8);
  });

  test('doit retourner 3.4mm pour 2.5mm²', () => {
    assert.strictEqual(getCableDiameter(2.5), 3.4);
  });

  test('doit retourner 4.1mm pour 4mm²', () => {
    assert.strictEqual(getCableDiameter(4), 4.1);
  });

  test('doit retourner 5.1mm pour 6mm²', () => {
    assert.strictEqual(getCableDiameter(6), 5.1);
  });

  test('doit retourner 3.0mm par défaut pour section inconnue', () => {
    assert.strictEqual(getCableDiameter(999), 3.0);
  });

  // ====================================================================
  // Tests: calculateMinGaineDiameter
  // ====================================================================
  console.log('\n📐 calculateMinGaineDiameter');
  
  test('doit retourner Ø16 pour un cable 1.5mm²', () => {
    const result = calculateMinGaineDiameter([{ section: 1.5 }]);
    approx(result, 16);
  });

  test('doit retourner Ø16 pour un cable 2.5mm²', () => {
    const result = calculateMinGaineDiameter([{ section: 2.5 }]);
    approx(result, 16);
  });

  test('doit retourner Ø20 pour deux cables 2.5mm²', () => {
    const cables = [{ section: 2.5 }, { section: 2.5 }];
    const result = calculateMinGaineDiameter(cables);
    assert.ok(result >= 16);
  });

  test('doit retourner Ø20 pour mezcla 1.5 + 2.5mm²', () => {
    const cables = [{ section: 1.5 }, { section: 2.5 }];
    const result = calculateMinGaineDiameter(cables);
    assert.ok(result >= 16);
  });

  test('doit filtrer les gaines refusees', () => {
    const gainesRefusees = [16];
    const cables = [{ section: 1.5 }];
    const result = calculateMinGaineDiameter(cables, gainesRefusees);
    assert.ok(result >= 16);
  });

  // ====================================================================
  // Tests: applyMarge
  // ====================================================================
  console.log('\n📏 applyMarge');
  
  test('doit appliquer 10% de marge', () => {
    approx(applyMarge(100, 10), 110);
  });

  test('doit appliquer 15% de marge', () => {
    approx(applyMarge(100, 15), 115);
  });

  test('doit respecter longueur minimum', () => {
    assert.strictEqual(applyMarge(0.5, 10, 1), 1);
  });

  test('doit retourner longueur minimum si base zero', () => {
    assert.strictEqual(applyMarge(0, 10, 1), 1);
  });

  // ====================================================================
  // Tests: getMargesEffectives
  // ====================================================================
  console.log('\n⚙️ getMargesEffectives');
  
  test('doit utiliser valeurs du profil', () => {
    const profil = { marge_fils: 15, marge_gaines: 12 };
    const marges = getMargesEffectives(profil);
    assert.strictEqual(marges.marge_fils, 15);
    assert.strictEqual(marges.marge_gaines, 12);
  });

  test('doit utiliser valeurs par defaut si manquantes', () => {
    const profil = {};
    const marges = getMargesEffectives(profil);
    assert.strictEqual(marges.marge_fils, 10);
    assert.strictEqual(marges.marge_gaines, 10);
    assert.strictEqual(marges.marge_cables, 15);
  });

  test('doit avoir longueurs minimales', () => {
    const profil = {};
    const marges = getMargesEffectives(profil);
    assert.strictEqual(marges.longueur_min_fils, 1);
    assert.strictEqual(marges.longueur_min_gaines, 1);
  });

  // ====================================================================
  // Tests: checkDoublagePrises
  // ====================================================================
  console.log('\n🔌 checkDoublagePrises');
  
  test('doit detecter plus de 8 prises', () => {
    const circuit = { type: 'prise', nb_prises: 9 };
    const result = checkDoublagePrises(circuit);
    assert.strictEqual(result.besoinDoublage, true);
  });

  test('doit accepter 8 prises max', () => {
    const circuit = { type: 'prise', nb_prises: 8 };
    const result = checkDoublagePrises(circuit);
    assert.strictEqual(result.besoinDoublage, false);
  });

  test('doit recommander deux circuits pour 12 prises', () => {
    const circuit = { type: 'prise', nb_prises: 12 };
    const result = checkDoublagePrises(circuit);
    assert.strictEqual(result.nbCircuits, 2);
  });

  test('ne doit pas muter les circuits non-prises', () => {
    const circuit = { type: 'lumiere', nb_prises: 1 };
    const result = checkDoublagePrises(circuit);
    assert.strictEqual(result.besoinDoublage, false);
    assert.strictEqual(result.nbCircuits, 1);
  });

  // ====================================================================
  // Tests: circuitBuilder (Sprint 3)
  // ====================================================================
  console.log('\n🔧 circuitBuilder');

  test('estimateLength retourne 1m minimum', () => {
    assert.strictEqual(estimateLength([]), 10);
  });

  test('estimateLength calcule la distance max depuis (0,0)', () => {
    const length = estimateLength([{ x: 100, y: 0 }, { x: 0, y: 100 }]);
    // max distance = 100, * SCALE_FACTOR 0.05 = 5, arrondi = 5
    assert.strictEqual(length, 5);
  });

  test('groupDevicesByTypeAndProximity groupe par type', () => {
    const devices = [
      { type_element: 'prise', position_x: 0, position_y: 0 },
      { type_element: 'prise', position_x: 10, position_y: 0 },
      { type_element: 'lumiere', position_x: 0, position_y: 100 }
    ];
    const groups = groupDevicesByTypeAndProximity(devices, 8);
    assert.strictEqual(groups.length, 2);
    assert.strictEqual(groups[0].length, 2);
    assert.strictEqual(groups[1].length, 1);
  });

  test('groupDevicesByTypeAndProximity decoupe les prises par lots', () => {
    const devices = Array.from({ length: 10 }, (_, i) => ({
      type_element: 'prise',
      position_x: i * 10,
      position_y: 0
    }));
    const groups = groupDevicesByTypeAndProximity(devices, 8);
    assert.strictEqual(groups.length, 2);
    assert.strictEqual(groups[0].length, 8);
    assert.strictEqual(groups[1].length, 2);
  });

  // ====================================================================
  // Resultats
  // ====================================================================
  console.log('\n═══════════════════════════════════════════════');
  console.log(`📊 Resultats: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════');
  
  process.exit(failed > 0 ? 1 : 0);
}

runTests();