// ====================================================================
// PIEUVRE API - Export PDF
// ====================================================================

const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const { query } = require('../db/postgres');

// ====================================================================
// GET /api/export/bon-coupe/:id - Exporter un calcul en PDF
// ====================================================================
router.get('/bon-coupe/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const calcul = await query(
      `SELECT c.*, ch.nom as chantier_nom, ch.adresse, cl.nom as client_nom
       FROM calculs c
       JOIN ${'chantiers'} ch ON c.id_chantier = ch.id
       JOIN clients cl ON ch.id_client = cl.id
       WHERE c.id = $1`,
      [id]
    );
    
    if (calcul.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Calcul non trouvé' });
    }
    
    const data = calcul.rows[0];
    const bonDeCoupe = data.bon_de_coupe;
    
    // Créer le PDF
    const doc = new PDFDocument({ margin: 50 });
    
    // En-têtes HTTP pour téléchargement
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=bon_coupe_${id}.pdf`);
    
    doc.pipe(res);
    
    // Titre
    doc.fontSize(20).text('BON DE COUPE', { align: 'center' });
    doc.moveDown();
    
    // Infos chantier
    doc.fontSize(12);
    doc.text(`Chantier: ${data.chantier_nom}`, { continued: false });
    doc.text(`Client: ${data.client_nom}`);
    doc.text(`Adresse: ${data.adresse || 'Non spécifiée'}`);
    doc.text(`Date: ${new Date(data.date_calcul).toLocaleString('fr-FR')}`);
    doc.text(`Utilisateur: ${data.utilisateur}`);
    doc.moveDown();
    
    // Ligne de séparation
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();
    
    // Fils
    doc.fontSize(14).text('FILS', { underline: true });
    doc.moveDown();
    doc.fontSize(10);
    
    if (bonDeCoupe.fils && bonDeCoupe.fils.length > 0) {
      bonDeCoupe.fils.forEach(fil => {
        const substitute = fil.substituee ? ` (SUBSTITUÉ: ${fil.couleur_originale})` : '';
        doc.text(`• ${fil.couleur} ${fil.section}mm² - ${fil.longueur.toFixed(1)}m${substitute}`);
      });
    } else {
      doc.text('Aucun fil');
    }
    doc.moveDown();
    
    // Gaines
    doc.fontSize(14).text('GAINES', { underline: true });
    doc.moveDown();
    doc.fontSize(10);
    
    if (bonDeCoupe.gaines && bonDeCoupe.gaines.length > 0) {
      bonDeCoupe.gaines.forEach(gaine => {
        doc.text(`• Ø${gaine.diametre}mm - ${gaine.longueur.toFixed(1)}m`);
      });
    } else {
      doc.text('Aucune gaine');
    }
    doc.moveDown();
    
    // Substitutions
    if (bonDeCoupe.substitutions && Object.keys(bonDeCoupe.substitutions).length > 0) {
      doc.fontSize(14).text('SUBSTITUTIONS', { underline: true });
      doc.moveDown();
      doc.fontSize(10);
      Object.entries(bonDeCoupe.substitutions).forEach(([original, replacement]) => {
        doc.text(`• ${original} → ${replacement}`);
      });
      doc.moveDown();
    }
    
    // Alertes
    if (bonDeCoupe.alertes && bonDeCoupe.alertes.length > 0) {
      doc.fontSize(14).text('ALERTES', { underline: true });
      doc.moveDown();
      doc.fontSize(10);
      bonDeCoupe.alertes.forEach(alerte => {
        doc.text(`⚠ ${alerte.message}`);
      });
    }
    
    // Stats
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();
    doc.fontSize(10);
    doc.text(`Longueur totale fils: ${bonDeCoupe.stats?.longueur_totale_fils?.toFixed(1) || 0}m`);
    doc.text(`Longueur totale gaines: ${bonDeCoupe.stats?.longueur_totale_gaines?.toFixed(1) || 0}m`);
    doc.text(`Nombre de substitutions: ${bonDeCoupe.stats?.nb_substitutions || 0}`);
    if (bonDeCoupe.stats?.nb_doublages) {
      doc.text(`Nombre de doublages: ${bonDeCoupe.stats.nb_doublages}`);
    }
    
    // Commentaire
    if (data.commentaire) {
      doc.moveDown();
      doc.fontSize(12).text(`Commentaire: ${data.commentaire}`);
    }
    
    // Pied de page
    doc.moveDown(2);
    doc.fontSize(8).text('Généré par Pieuvre Auto', { align: 'center' });
    
    doc.end();
  } catch (error) {
    console.error('Erreur GET /export/bon-coupe/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// GET /api/export/excel/:id - Exporter en CSV (pour Excel)
// ====================================================================
router.get('/excel/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const calcul = await query(
      `SELECT c.*, ch.nom as chantier_nom, cl.nom as client_nom
       FROM calculs c
       JOIN ${'chantiers'} ch ON c.id_chantier = ch.id
       JOIN clients cl ON ch.id_client = cl.id
       WHERE c.id = $1`,
      [id]
    );
    
    if (calcul.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Calcul non trouvé' });
    }
    
    const data = calcul.rows[0];
    const bonDeCoupe = data.bon_de_coupe;
    
    let csv = 'Type,Couleur,Section,Longueur,Fonction,Notes\n';
    
    // Fils
    bonDeCoupe.fils.forEach(fil => {
      const notes = fil.substituee ? `Substitué: ${fil.couleur_originale}` : '';
      csv += `Fil,${fil.couleur},${fil.section},${fil.longueur.toFixed(2)},${fil.fonction || ''},${notes}\n`;
    });
    
    // Gaines
    bonDeCoupe.gaines.forEach(gaine => {
      csv += `Gaine,Ø${gaine.diametre},-,${gaine.longueur.toFixed(2)},,-\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=bon_coupe_${id}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Erreur GET /export/excel/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;