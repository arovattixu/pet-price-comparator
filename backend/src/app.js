require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Importa le routes
const productRoutes = require('./api/routes/productRoutes');
const priceRoutes = require('./api/routes/priceRoutes');
const compareRoutes = require('./api/routes/compareRoutes');
const dealsRoutes = require('./api/routes/dealsRoutes');
const trendsRoutes = require('./api/routes/trendsRoutes');
const priceAlertRoutes = require('./api/routes/priceAlertRoutes');
const advancedCompareRoutes = require('./api/routes/advancedCompareRoutes');

// Configurazione del logger
const logger = require('./utils/logger');

// Inizializza Redis per il caching
const cache = require('./utils/cache');
cache.initRedisClient().catch(err => {
  logger.warn(`Redis cache non disponibile: ${err.message}. Il caching sarà disabilitato.`);
});

// Inizializza express
const app = express();

// Middleware di base
app.use(helmet()); // Sicurezza HTTP
app.use(cors());   // Abilita CORS
app.use(express.json()); // Parsing JSON
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } })); // Logging

// Configura Swagger direttamente qui
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Pet Price Comparator API',
      version: '1.0.0',
      description: 'API per il comparatore di prezzi di prodotti per animali domestici',
      contact: {
        name: 'Pet Price Comparator Team',
        url: 'https://www.petpricecomparator.it',
        email: 'info@petpricecomparator.it'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: '/',
        description: 'API Server'
      }
    ],
    tags: [
      {
        name: 'Prodotti',
        description: 'Operazioni sui prodotti'
      },
      {
        name: 'Prezzi',
        description: 'Operazioni sui prezzi'
      },
      {
        name: 'Confronto',
        description: 'Confronto tra prodotti e prezzi'
      },
      {
        name: 'Offerte',
        description: 'Migliori offerte e risparmio'
      },
      {
        name: 'Trend',
        description: 'Analisi degli andamenti dei prezzi'
      },
      {
        name: 'Notifiche',
        description: 'Notifiche e alert sui prezzi'
      }
    ],
    components: {
      schemas: {
        Product: {
          type: 'object',
          required: ['name', 'source', 'sourceId'],
          properties: {
            _id: {
              type: 'string',
              description: 'ID univoco del prodotto'
            },
            name: {
              type: 'string',
              description: 'Nome del prodotto'
            },
            description: {
              type: 'string',
              description: 'Descrizione del prodotto'
            },
            brand: {
              type: 'string',
              description: 'Marca del prodotto'
            },
            category: {
              type: 'string',
              description: 'Categoria del prodotto'
            },
            petType: {
              type: 'string',
              enum: ['cane', 'gatto'],
              description: 'Tipo di animale a cui è destinato il prodotto'
            }
          }
        },
        PricePoint: {
          type: 'object',
          properties: {
            productId: {
              type: 'string',
              description: 'ID del prodotto'
            },
            price: {
              type: 'number',
              description: 'Prezzo del prodotto'
            },
            source: {
              type: 'string',
              description: 'Fonte del prezzo'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Data di rilevazione del prezzo'
            }
          }
        }
      }
    }
  },
  apis: [
    './src/api/routes/*.js',
    './src/api/models/*.js'
  ]
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Middleware per verificare lo stato della connessione al database
app.use((req, res, next) => {
  // Verifica solo per le richieste API che necessitano accesso al db
  if (req.path.startsWith('/api/') && 
      !req.path.startsWith('/api/health') && 
      !req.path.startsWith('/api/docs')) {
    if (mongoose.connection.readyState !== 1) {
      logger.warn(`Richiesta API con database disconnesso: ${req.method} ${req.path} - Stato: ${mongoose.connection.readyState}`);
      
      return res.status(503).json({
        success: false,
        error: 'Il database è temporaneamente non disponibile. Riprova tra qualche secondo.',
        readyState: mongoose.connection.readyState,
        readyStateText: ['disconnesso', 'connesso', 'in connessione', 'in disconnessione'][mongoose.connection.readyState] || 'sconosciuto'
      });
    }
  }
  next();
});

// Rate limiter
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minuti di default
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // limite per IP
  message: 'Troppe richieste, riprova più tardi'
});
app.use('/api/', limiter);

// Impostazione routes
app.use('/api/products', productRoutes);
app.use('/api/prices', priceRoutes);
app.use('/api/compare', compareRoutes);
app.use('/api/advanced-compare', advancedCompareRoutes);
app.use('/api/deals', dealsRoutes);
app.use('/api/trends', trendsRoutes);
app.use('/api/alerts', priceAlertRoutes);

// Rotta health check
app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  const status = dbState === 1 ? 'healthy' : 'degraded';
  
  res.json({
    status,
    uptime: process.uptime(),
    timestamp: new Date(),
    database: {
      state: dbStates[dbState],
      readyState: dbState
    }
  });
});

// Rotta base
app.get('/', (req, res) => {
  res.json({ 
    message: 'API del Pet Price Comparator',
    documentation: '/api-docs',
    healthCheck: '/health'
  });
});

// Middleware per gestione errori MongoDB
app.use((err, req, res, next) => {
  // Cattura errori specifici di MongoDB
  if (err.name === 'MongoError' || err.name === 'MongooseError' || err.name === 'MongoServerError') {
    logger.error(`Errore MongoDB: ${err.message} - ${req.originalUrl}`);
    return res.status(503).json({
      error: {
        message: 'Problemi di connessione al database, riprova più tardi',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      }
    });
  }
  
  // Gestisce gli errori di timeout MongoDB
  if (err.message && (
      err.message.includes('timed out') || 
      err.message.includes('buffering timed out') ||
      err.message.includes('operation exceeded time limit')
    )) {
    logger.error(`Timeout MongoDB: ${err.message} - ${req.originalUrl}`);
    return res.status(503).json({
      error: {
        message: 'La richiesta al database è scaduta, riprova più tardi',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      }
    });
  }
  
  next(err);
});

// Middleware per gestione errori generici
app.use((err, req, res, next) => {
  logger.error(`${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  
  res.status(err.status || 500).json({
    error: {
      message: process.env.NODE_ENV === 'production' ? 'Errore del server' : err.message,
    }
  });
});

// 404 handler
app.use((req, res) => {
  logger.warn(`404 - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  res.status(404).json({ error: { message: 'Risorsa non trovata' } });
});

// Esporta l'app per l'utilizzo in index.js
module.exports = app;