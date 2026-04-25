// ====================================================================
// PIEUVRE API - Configuration PostgreSQL
// ====================================================================

const { Pool } = require('pg');

// Configuration de la connexion à la base de données
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'pieuvre_db',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT) || 5432,
  
  // Configuration du pool de connexions
  max: 20, // Nombre max de connexions simultanées
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test de connexion au démarrage
pool.on('connect', () => {
  console.log('✅ Connexion PostgreSQL établie');
});

pool.on('error', (err) => {
  console.error('❌ Erreur PostgreSQL:', err);
  process.exit(-1);
});

// Fonction helper pour exécuter des requêtes
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Requête exécutée:', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Erreur requête SQL:', error);
    throw error;
  }
};

// Fonction pour transactions
const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Export des fonctions
module.exports = {
  pool,
  query,
  transaction,
};
