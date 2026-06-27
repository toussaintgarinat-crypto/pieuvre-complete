// ====================================================================
// PIEUVRE OCR - Microservice d'extraction de dispositifs
// ====================================================================

require('dotenv').config();
const express = require('express');
const path = require('path');

// Le service OCR est partagé avec l'API via montage de volume
const ocr = require('./services/ocr');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json({ limit: '10mb' }));

// Logger simple
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'pieuvre-ocr' });
});

app.post('/detect/image', async (req, res) => {
  try {
    const { filePath } = req.body;
    if (!filePath) return res.status(400).json({ success: false, error: 'filePath requis' });
    const result = await ocr.detectFromImage(filePath);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/detect/pdf', async (req, res) => {
  try {
    const { filePath } = req.body;
    if (!filePath) return res.status(400).json({ success: false, error: 'filePath requis' });
    const result = await ocr.detectFromPDF(filePath);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/detect/cad', async (req, res) => {
  try {
    const { filePath } = req.body;
    if (!filePath) return res.status(400).json({ success: false, error: 'filePath requis' });
    const result = await ocr.detectFromCAD(filePath);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🔍 PIEUVRE OCR démarré sur le port ${PORT}`);
});
