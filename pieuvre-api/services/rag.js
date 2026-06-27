// ====================================================================
// PIEUVRE API - Service RAG (Retrieval Augmented Generation)
// Recherche sémantique dans la norme NF C 15-100 et guides métier
// ====================================================================

const { query } = require('../db/postgres');

// Configuration du fournisseur d'embeddings
const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER || 'openai';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const OPENAI_API_BASE = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_BASE = process.env.OPENROUTER_API_BASE || 'https://openrouter.ai/api/v1';
const OPENROUTER_EMBEDDING_MODEL = process.env.OPENROUTER_EMBEDDING_MODEL || 'openai/text-embedding-3-small';
const OPENROUTER_SITE_URL = process.env.OPENROUTER_SITE_URL || 'http://localhost';
const OPENROUTER_APP_NAME = process.env.OPENROUTER_APP_NAME || 'Pieuvre Auto';
const EMBEDDING_DIMENSION = 1536;
const RAG_MOCK_MODE = process.env.RAG_MOCK_MODE === 'true';

/**
 * Génère un embedding pour un texte donné.
 * En mode mock, retourne un vecteur aléatoire normalisé.
 */
async function generateEmbedding(text) {
  if (RAG_MOCK_MODE) {
    return generateMockEmbedding();
  }

  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY manquant. Définissez la clé ou activez RAG_MOCK_MODE=true.');
  }

  if (EMBEDDING_PROVIDER === 'openai') {
    return generateOpenAIEmbedding(text);
  }

  if (EMBEDDING_PROVIDER === 'openrouter') {
    return generateOpenRouterEmbedding(text);
  }

  throw new Error(`Fournisseur d'embeddings non supporté: ${EMBEDDING_PROVIDER}`);
}

/**
 * Mock : vecteur aléatoire normalisé (pour tests sans clé API)
 */
function generateMockEmbedding() {
  const vec = Array.from({ length: EMBEDDING_DIMENSION }, () => Math.random() - 0.5);
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return vec.map(v => v / norm);
}

/**
 * Appel API OpenAI pour les embeddings
 */
async function generateOpenAIEmbedding(text) {
  const response = await fetch(`${OPENAI_API_BASE}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      input: text,
      model: OPENAI_EMBEDDING_MODEL
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erreur OpenAI embeddings: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Appel API OpenRouter pour les embeddings (compatible OpenAI)
 */
async function generateOpenRouterEmbedding(text) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY manquant.');
  }

  const response = await fetch(`${OPENROUTER_API_BASE}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': OPENROUTER_SITE_URL,
      'X-Title': OPENROUTER_APP_NAME
    },
    body: JSON.stringify({
      input: text,
      model: OPENROUTER_EMBEDDING_MODEL
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erreur OpenRouter embeddings: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Recherche les chunks les plus similaires à une requête.
 * @param {string} searchText - Texte de la requête
 * @param {Object} options
 * @param {number} options.limit - Nombre de résultats (défaut 5)
 * @param {number} options.minScore - Score minimum de similarité (défaut 0)
 * @returns {Promise<Array>}
 */
async function searchSimilarChunks(searchText, options = {}) {
  const { limit = 5, minScore = 0 } = options;
  const embedding = await generateEmbedding(searchText);
  const embeddingLiteral = `[${embedding.map(v => Number(v).toFixed(8)).join(',')}]`;

  // Injection safe : embedding ne contient que des nombres flottants
  const result = await query(`
    SELECT
      nc.id,
      nc.contenu,
      nc.chunk_index,
      nc.metadata,
      nc.id_document,
      nd.titre AS document_titre,
      nd.source AS document_source,
      1 - (nc.embedding <=> '${embeddingLiteral}'::vector) AS score
    FROM normes_chunks nc
    JOIN normes_documents nd ON nd.id = nc.id_document
    WHERE nd.actif = true
      AND nc.embedding IS NOT NULL
    ORDER BY nc.embedding <=> '${embeddingLiteral}'::vector
    LIMIT ${parseInt(limit)}
  `);

  return result.rows.filter(r => r.score >= minScore);
}

/**
 * Recherche sémantique avec contexte enrichi (pour déterminer un circuit).
 * @param {string} queryText - Description du dispositif / situation
 * @param {number} limit - Nombre de chunks
 */
async function searchForCircuitContext(queryText, limit = 3) {
  const chunks = await searchSimilarChunks(queryText, { limit, minScore: 0.3 });
  return chunks.map(c => ({
    content: c.contenu,
    source: c.document_source,
    title: c.document_titre,
    score: c.score,
    metadata: c.metadata
  }));
}

/**
 * Génère les embeddings pour tous les chunks qui n'en ont pas encore.
 */
async function seedChunks() {
  const result = await query(`
    SELECT id, contenu FROM normes_chunks WHERE embedding IS NULL ORDER BY id
  `);

  const updated = [];
  for (const chunk of result.rows) {
    const embedding = await generateEmbedding(chunk.contenu);
    const embeddingLiteral = `[${embedding.join(',')}]`;

    await query(`
      UPDATE normes_chunks SET embedding = $1::vector WHERE id = $2
    `, [embeddingLiteral, chunk.id]);

    updated.push(chunk.id);
  }

  return updated;
}

/**
 * Ajoute un document avec ses chunks et génère les embeddings.
 */
async function addDocument({ titre, source, description, type_document = 'guide', chunks = [] }) {
  const docResult = await query(`
    INSERT INTO normes_documents (titre, source, description, type_document)
    VALUES ($1, $2, $3, $4)
    RETURNING id
  `, [titre, source, description, type_document]);

  const idDocument = docResult.rows[0].id;
  const insertedChunks = [];

  for (let i = 0; i < chunks.length; i++) {
    const { contenu, metadata = {} } = chunks[i];
    const embedding = await generateEmbedding(contenu);
    const embeddingLiteral = `[${embedding.join(',')}]`;

    const chunkResult = await query(`
      INSERT INTO normes_chunks (id_document, contenu, embedding, chunk_index, metadata)
      VALUES ($1, $2, $3::vector, $4, $5)
      RETURNING id
    `, [idDocument, contenu, embeddingLiteral, i, JSON.stringify(metadata)]);

    insertedChunks.push(chunkResult.rows[0].id);
  }

  return { idDocument, chunksCount: insertedChunks.length };
}

/**
 * Liste les documents avec nombre de chunks.
 */
async function listDocuments() {
  const result = await query(`
    SELECT
      nd.*,
      COUNT(nc.id) AS nb_chunks,
      COUNT(nc.embedding) AS nb_vectorises
    FROM normes_documents nd
    LEFT JOIN normes_chunks nc ON nc.id_document = nd.id
    GROUP BY nd.id
    ORDER BY nd.created_at DESC
  `);
  return result.rows;
}

/**
 * Supprime un document et ses chunks.
 */
async function deleteDocument(id) {
  await query(`DELETE FROM normes_documents WHERE id = $1`, [id]);
  return { deleted: true };
}

module.exports = {
  generateEmbedding,
  searchSimilarChunks,
  searchForCircuitContext,
  seedChunks,
  addDocument,
  listDocuments,
  deleteDocument,
  EMBEDDING_DIMENSION
};
