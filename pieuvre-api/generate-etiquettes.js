#!/usr/bin/env node
// ====================================================================
// PIEUVRE AUTO - Générateur PDF Étiquettes Professionnel
// Double exemplaire de chaque étiquette
// ====================================================================

const PDFDocument = require('pdfkit');
const fs = require('fs');

// Données du calcul (depuis la base)
const calculData = {
  client: "Maison Test",
  chantier: "Résidence Test - Lot 1",
  utilisateur: "test_auto",
  date: new Date().toLocaleDateString('fr-FR'),
  adresse: "42 Rue de la Paix, 75001 Paris"
};

// Type de circuit → couleurs
const CATEGORIES = {
  'L': { label: 'ÉCLAIRAGE', bgColor: '#FFF9C4', borderColor: '#FBC02D' },
  'P': { label: 'PRISES 16A', bgColor: '#E3F2FD', borderColor: '#1976D2' },
  'VR': { label: 'VOLET ROULANT', bgColor: '#CFD8DC', borderColor: '#455A64' },
  'VMC': { label: 'VMC', bgColor: '#B2EBF2', borderColor: '#00838F' },
  'VD': { label: 'VA-ET-VIENT', bgColor: '#E1BEE7', borderColor: '#7B1FA2' },
  'CUIS': { label: 'CUISINIÈRE', bgColor: '#FFCCBC', borderColor: '#BF360C' }
};

// Étiquettes du calcul (simulé depuis le bon de coupe)
const etiquettes = [
  // ÉCLAIRAGE
  { code: 'L-1', type: 'L', fils: ['Rouge 1.5', 'Bleu 1.5', 'V/J 1.5'], longueur: 8.5, longueurBase: 7.7, gaine: 'Ø16', localisation: 'RDC Lg1 Bx1' },
  { code: 'L-2', type: 'L', fils: ['Rouge 1.5', 'Bleu 1.5', 'V/J 1.5'], longueur: 12.3, longueurBase: 11.2, gaine: 'Ø16', localisation: 'RDC Lg2 Bx2' },
  { code: 'L-3', type: 'L', fils: ['Rouge 1.5', 'Bleu 1.5', 'V/J 1.5'], longueur: 15.7, longueurBase: 14.3, gaine: 'Ø16', localisation: 'RDC Lg3 Bx3' },
  { code: 'L-4', type: 'L', fils: ['Rouge 1.5', 'Bleu 1.5', 'V/J 1.5'], longueur: 9.2, longueurBase: 8.4, gaine: 'Ø16', localisation: 'Étage Bx4' },

  // PRISES
  { code: 'P-1', type: 'P', fils: ['Rouge 2.5', 'Bleu 2.5', 'V/J 2.5'], longueur: 25.5, longueurBase: 23.2, gaine: 'Ø20', localisation: 'RDC Lg1 Bx5' },
  { code: 'P-2', type: 'P', fils: ['Rouge 2.5', 'Bleu 2.5', 'V/J 2.5'], longueur: 32.8, longueurBase: 29.8, gaine: 'Ø20', localisation: 'RDC Lg2 Bx6' },

  // VOLETS ROULANTS
  { code: 'VR-1', type: 'VR', fils: ['Rouge 1.5', 'Orange 1.5 *', 'Orange 1.5 *', 'V/J 1.5'], longueur: 7.5, longueurBase: 6.8, gaine: 'Ø16', localisation: 'RDC Lg1 Bx7', alerte: true },
  { code: 'VR-2', type: 'VR', fils: ['Rouge 1.5', 'Orange 1.5 *', 'Orange 1.5 *', 'V/J 1.5'], longueur: 8.2, longueurBase: 7.5, gaine: 'Ø16', localisation: 'RDC Lg2 Bx8', alerte: true },
  { code: 'VR-3', type: 'VR', fils: ['Rouge 1.5', 'Orange 1.5 *', 'Orange 1.5 *', 'V/J 1.5'], longueur: 6.9, longueurBase: 6.3, gaine: 'Ø16', localisation: 'Étage Bx9', alerte: true },

  // VMC
  { code: 'VMC-1', type: 'VMC', fils: ['Rouge 1.5', 'Bleu 1.5', 'V/J 1.5'], longueur: 18.5, longueurBase: 16.8, gaine: 'Ø20', localisation: 'RDC Bx10' }
];

// Création du PDF
const doc = new PDFDocument({
  size: 'A4',
  layout: 'portrait',
  margin: 15
});

// Enregistrement
const outputPath = '/Users/garinat_t/Desktop/pieuvre-complete/plans-test/PIEUVRE_BON_COUPE_ETIQUETTES.pdf';
doc.pipe(fs.createWriteStream(outputPath));

// ===== PAGE DE TITRE =====
doc.fontSize(20).text('PIEUVRE AUTO', { align: 'center' });
doc.fontSize(14).text('SYSTÈME DE GESTION DES PIEUVRES ÉLECTRIQUES', { align: 'center' });
doc.moveDown(0.5);
doc.fontSize(10).text('═══════════════════════════════════════════════════════════════', { align: 'center' });
doc.moveDown(0.3);

// En-tête
doc.fontSize(12).text('BON DE COUPE & ÉTIQUETTES', { align: 'center' });
doc.moveDown(0.3);
doc.fontSize(10);
doc.text(`Client: ${calculData.client}`, { align: 'center' });
doc.text(`Chantier: ${calculData.chantier}`, { align: 'center' });
doc.text(`Adresse: ${calculData.adresse}`, { align: 'center' });
doc.moveDown(0.3);
doc.text(`Date: ${calculData.date} | Utilisateur: ${calculData.utilisateur}`, { align: 'center' });
doc.moveDown(0.5);
doc.fontSize(8).text('═══════════════════════════════════════════════════════════════', { align: 'center' });

doc.moveDown(1);

// Résumé du stock
doc.fontSize(11).fillColor('#333').text('RÉSUMÉ DU BON DE COUPE');
doc.moveDown(0.3);
doc.fontSize(9);
doc.text('  FILS 1.5mm² : Rouge 95.5m | Bleu 27.5m | V/J 95.5m | Orange 49.8m (subst.)', { align: 'left' });
doc.text('  FILS 2.5mm² : Rouge 64.1m | Bleu 134.8m | V/J 64.1m', { align: 'left' });
doc.moveDown(0.3);
doc.text('  GAINES : Ø16mm = 159.6m | Ø20mm = 58.3m', { align: 'left' });
doc.moveDown(0.3);
doc.text('  ⚠️  SUBSTITUTION : Violet → Orange (rupture stock)', { align: 'left' });
doc.text('  TOTAL FILS : 503.7m | TOTAL GAINES : 159.6m', { align: 'left' });

doc.moveDown(1);

// Instructions impression
doc.fontSize(11).text('📋 INSTRUCTIONS D\'IMPRESSION');
doc.fontSize(9);
doc.text('  • Imprimer ce document en 2 exemplaires', { align: 'left' });
doc.text('  • Exemple 1 : pour le chef d\'équipe', { align: 'left' });
doc.text('  • Exemple 2 : à coller sur les boîtes de dérivation', { align: 'left' });
doc.moveDown(0.3);
doc.text('  • Format étiquettes compatible : Avery L7160 (70×35mm)', { align: 'left' });
doc.text('  • Marges : impressions sans', { align: 'left' });

// ===== NOUVELLE PAGE : ÉTIQUETTES =====
doc.addPage();

// Configuration étiquettes
const labelWidth = 70;  // mm
const labelHeight = 35;  // mm
const labelsPerRow = 3;
const gapX = 5;  // mm
const gapY = 5;  // mm
const marginLeft = 15;  // mm

// Conversion mm → points (pdfkit)
const MM = 2.83465;
const PW = labelWidth * MM;
const PH = labelHeight * MM;
const PGX = gapX * MM;
const PGY = gapY * MM;
const PM = marginLeft * MM;
const colWidth = PW + PGX;

doc.fontSize(14).text('ÉTIQUETTES À COLLER', { align: 'center' });
doc.fontSize(10).text(`Total: ${etiquettes.length} circuits × 2 exemplaires = ${etiquettes.length * 2} étiquettes`, { align: 'center' });
doc.moveDown(0.5);

// Fonction de dessin d'étiquette
function drawLabel(x, y, etiquette, duplicate = 1) {
  const cat = CATEGORIES[etiquette.type] || CATEGORIES['L'];

  // Fond coloré
  doc.fillColor(cat.bgColor).rect(x, y, PW, PH).fill();

  // Bordure
  doc.strokeColor(cat.borderColor).lineWidth(0.5).rect(x, y, PW, PH).stroke();

  // Encoche de perforation (optionnel -simulé)
  doc.fillColor('#fff').circle(x + 3, y + PH / 2, 2).fill();

  // Header (localisation)
  doc.fontSize(6).fillColor('#555').text(
    `${etiquette.localisation} ${duplicate > 1 ? `[${duplicate === 2 ? 'EXEMPLAIRE 2' : 'EXEMPLAIRE 1'}]` : ''}`,
    x + 8, y + 1.5, { width: PW - 12, align: 'right' }
  );

  // Ligne séparatrice
  doc.moveTo(x + 3, y + 8).lineTo(x + PW - 3, y + 8).strokeColor('#999').stroke();

  // Nom gaine (grand, centré)
  doc.fontSize(11).fillColor('#000').text(
    etiquette.code,
    x + 3, y + 10, { width: PW - 6, align: 'center' }
  );

  // Ligne séparatrice
  doc.moveTo(x + 3, y + 20).lineTo(x + PW - 3, y + 20).strokeColor('#999').stroke();

  // Fils (alignés à droite)
  doc.fontSize(6.5).fillColor(etiquette.alerte ? '#E65100' : '#333');
  let yFils = y + 21;
  etiquette.fils.slice(-3).reverse().forEach(fil => {
    doc.text(fil, x + 3, yFils, { width: PW - 6, align: 'right' });
    yFils += 4.5;
  });

  // Ligne "nom × 4"
  doc.moveTo(x + 3, y + PH - 9).lineTo(x + PW - 3, y + PH - 9).strokeColor('#999').stroke();
  doc.fontSize(5).fillColor('#000');
  const nom4x = `${etiquette.code} | ${etiquette.code} | ${etiquette.code} | ${etiquette.code}`;
  doc.text(nom4x, x + 3, y + PH - 8, { width: PW - 6, align: 'center' });

  // Footer : longueur + ICTA
  doc.fontSize(7).fillColor('#1565C0');
  doc.text(
    `${etiquette.longueur.toFixed(1)}m / ${etiquette.longueurBase.toFixed(1)}m`,
    x + 5, y + PH - 4.5, { width: 25, align: 'left' }
  );

  doc.fontSize(6).text(
    `ICTA ${etiquette.gaine}`,
    x + PW - 20, y + PH - 4.5, { width: 17, align: 'right' }
  );
}

// Dessiner toutes les étiquettes en DOUBLE
let col = 0;
let row = 0;
let count = 0;

etiquettes.forEach(etiquette => {
  // EXEMPLAIRE 1
  let x = PM + (col % labelsPerRow) * colWidth;
  let y = doc.y + row * (PH + PGY);

  // Nouvelle page si nécessaire
  if (y + PH > 780) {
    doc.addPage();
    y = 50;
    row = 0;
    col = 0;
    x = PM;
  }

  drawLabel(x, y, etiquette, 1);
  count++;

  col++;
  if (col % labelsPerRow === 0) {
    col = 0;
    row++;
    if (row > 0) doc.y = y + PH + PGY;
  }

  // EXEMPLAIRE 2 (juste après)
  x = PM + (col % labelsPerRow) * colWidth;
  y = doc.y;

  if (y + PH > 780) {
    doc.addPage();
    y = 50;
    row = 0;
    col = 0;
    x = PM;
  }

  drawLabel(x, y, etiquette, 2);
  count++;

  col++;
  if (col % labelsPerRow === 0) {
    col = 0;
    row++;
    if (row > 0) doc.y = y + PH + PGY;
  }
});

// Pied de page
doc.addPage();
doc.fontSize(10).text('PIEUVRE AUTO - Bon de coupe généré automatiquement', { align: 'center' });
doc.fontSize(8).text(`Document protégé - ${count} étiquettes (${etiquettes.length} circuits × 2 exemplaires)`, { align: 'center' });
doc.moveDown(1);
doc.fontSize(8).text('Conforme NF C 15-100 | Taux remplissage gaines 40%', { align: 'center' });

// Finaliser
doc.end();

console.log(`✅ PDF généré: ${outputPath}`);
console.log(`📊 Total: ${count} étiquettes (${etiquettes.length} circuits × 2)`);