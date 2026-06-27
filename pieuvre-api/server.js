// ====================================================================
// PIEUVRE API - Serveur Principal
// ====================================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool } = require('./db/postgres');

// Import des routes
const clientsRoutes = require('./routes/clients');
const chantiersRoutes = require('./routes/chantiers');
const stockRoutes = require('./routes/stock');
const calculsRoutes = require('./routes/calculs');
const utilisateursRoutes = require('./routes/utilisateurs');
const entreprisesRoutes = require('./routes/entreprises');
const rappelsRoutes = require('./routes/rappels');
const webhooksRoutes = require('./routes/webhooks');
const templatesRoutes = require('./routes/templates');
const analyticsRoutes = require('./routes/analytics');
const exportRoutes = require('./routes/export');
const etiquettesRoutes = require('./routes/etiquettes');
const configRoutes = require('./routes/config');
const scansRoutes = require('./routes/scans');
const impressionRoutes = require('./routes/impression');
const ragRoutes = require('./routes/rag');
const ocrMappingsRoutes = require('./routes/ocrMappings');

// Initialisation de l'application
const app = express();
const PORT = process.env.PORT || 3001;

// ====================================================================
// MIDDLEWARES
// ====================================================================

// CORS - Autoriser les requêtes depuis l'interface web
const allowedOrigins = [
  process.env.WEB_URL || 'http://localhost:3000',
  'http://localhost',
  'http://localhost:80',
];
app.use(cors({
  origin: (origin, callback) => {
    // Autoriser les requêtes sans origin (ex: même domaine via nginx)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS non autorisé'));
    }
  },
  credentials: true
}));

// Parser JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logger simple
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ====================================================================
// ROUTES
// ====================================================================

// Health check
app.get('/health', async (req, res) => {
  try {
    // Test connexion DB
    await pool.query('SELECT NOW()');
    
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
});

// Routes API
app.use('/api/clients', clientsRoutes);
app.use('/api/chantiers', chantiersRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/calculs', calculsRoutes);
app.use('/api/utilisateurs', utilisateursRoutes);
app.use('/api/entreprises', entreprisesRoutes);
app.use('/api/rappels', rappelsRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/etiquettes', etiquettesRoutes);
app.use('/api', configRoutes);
app.use('/api/scans', scansRoutes);
app.use('/api/impression', impressionRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/ocr-mappings', ocrMappingsRoutes);

// Route par défaut
app.get('/', (req, res) => {
  res.json({
    app: 'Pieuvre API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      clients: '/api/clients',
      chantiers: '/api/chantiers',
      stock: '/api/stock',
      calculs: '/api/calculs',
      utilisateurs: '/api/utilisateurs',
      entreprises: '/api/entreprises',
      rappels: '/api/rappels',
      webhooks: '/api/webhooks',
      templates: '/api/templates',
      analytics: '/api/analytics',
      rag: '/api/rag',
      ocrMappings: '/api/ocr-mappings'
    }
  });
});

// ====================================================================
// GESTION DES ERREURS
// ====================================================================

// 404 - Route non trouvée
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route non trouvée',
    path: req.path
  });
});

// Erreur globale
app.use((err, req, res, next) => {
  console.error('Erreur serveur:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Erreur interne du serveur',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ====================================================================
// DÉMARRAGE DU SERVEUR
// ====================================================================

app.listen(PORT, () => {
  console.log('═══════════════════════════════════════════════');
  console.log('🚀 PIEUVRE API - Serveur démarré');
  console.log('═══════════════════════════════════════════════');
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`🗄️  Base de données: ${process.env.DB_NAME || 'pieuvre_db'}`);
  console.log(`⏰ Démarré le: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════');
});

// Gestion propre de l'arrêt
process.on('SIGTERM', () => {
  console.log('SIGTERM reçu, fermeture propre...');
  pool.end(() => {
    console.log('Pool PostgreSQL fermé');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT reçu, fermeture propre...');
  pool.end(() => {
    console.log('Pool PostgreSQL fermé');
    process.exit(0);
  });
});

module.exports = app;
