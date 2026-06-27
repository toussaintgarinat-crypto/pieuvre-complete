// ====================================================================
// PIEUVRE API - Routes RAG
// Recherche sémantique et gestion des documents de référence
// ====================================================================

const express = require('express');
const router = express.Router();
const {
  searchSimilarChunks,
  searchForCircuitContext,
  seedChunks,
  addDocument,
  listDocuments,
  deleteDocument
} = require('../services/rag');

// ====================================================================
// POST /api/rag/search - Recherche sémantique
// ====================================================================
router.post('/search', async (req, res) => {
  try {
    const { query, limit = 5, minScore = 0 } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'query est requis' });
    }

    const results = await searchSimilarChunks(query, { limit, minScore });

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Erreur POST /rag/search:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// POST /api/rag/circuit-context - Recherche contextuelle pour un circuit
// ====================================================================
router.post('/circuit-context', async (req, res) => {
  try {
    const { query, limit = 3 } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'query est requis' });
    }

    const results = await searchForCircuitContext(query, limit);

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Erreur POST /rag/circuit-context:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// POST /api/rag/seed - Vectoriser tous les chunks non vectorisés
// ====================================================================
router.post('/seed', async (req, res) => {
  try {
    const updated = await seedChunks();

    res.json({
      success: true,
      message: `${updated.length} chunks vectorisés`,
      data: { updatedIds: updated }
    });
  } catch (error) {
    console.error('Erreur POST /rag/seed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// GET /api/rag/documents - Liste des documents
// ====================================================================
router.get('/documents', async (req, res) => {
  try {
    const docs = await listDocuments();
    res.json({ success: true, data: docs });
  } catch (error) {
    console.error('Erreur GET /rag/documents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// POST /api/rag/documents - Ajouter un document avec chunks
// ====================================================================
router.post('/documents', async (req, res) => {
  try {
    const { titre, source, description, type_document, chunks } = req.body;

    if (!titre || !Array.isArray(chunks) || chunks.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'titre et chunks[] sont requis'
      });
    }

    const result = await addDocument({ titre, source, description, type_document, chunks });

    res.status(201).json({
      success: true,
      message: 'Document ajouté',
      data: result
    });
  } catch (error) {
    console.error('Erreur POST /rag/documents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================================================
// DELETE /api/rag/documents/:id - Supprimer un document
// ====================================================================
router.delete('/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await deleteDocument(id);
    res.json({ success: true, message: 'Document supprimé' });
  } catch (error) {
    console.error('Erreur DELETE /rag/documents/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
