/**
 * Configurazione principale dell'applicazione
 */

require('dotenv').config();
const Joi = require('joi');

const config = {
  // Configurazione del server
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
    corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:8080']
  },
  
  // Configurazione del database
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/pet-price-comparator',
    options: {
      // Opzioni mongoose (senza opzioni deprecate)
    }
  },
  
  // Configurazione della sicurezza
  security: {
    apiKey: process.env.API_KEY,
    rateLimitWindow: 15 * 60 * 1000, // 15 minuti
    rateLimitMax: 100 // 100 richieste per finestra
  },
  
  // Configurazione dei servizi
  services: {
    // Pianificazione aggiornamenti
    scheduler: {
      updateStatsInterval: '0 0 * * *'
    }
  },

  // Configurazione del logger
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'app.log',
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    maxFiles: process.env.LOG_MAX_FILES || '14d'
  },

  // Configurazione API
  api: {
    basePath: '/api',
    version: '1.0',
    docsPath: '/api-docs'
  }
};

// Validazione configurazione con Joi
const schema = Joi.object({
  server: Joi.object({
    port: Joi.number().required(),
    env: Joi.string().valid('development', 'production', 'test').required(),
    corsOrigins: Joi.array().items(Joi.string())
  }).required(),
  database: Joi.object({
    uri: Joi.string().uri().required(),
    options: Joi.object({
      useNewUrlParser: Joi.boolean(),
      useUnifiedTopology: Joi.boolean(),
      authSource: Joi.string(),
      user: Joi.string(),
      pass: Joi.string()
    })
  }).required(),
  security: Joi.object({
    apiKey: Joi.string(),
    rateLimitWindow: Joi.number(),
    rateLimitMax: Joi.number()
  }),
  services: Joi.object({
    scheduler: Joi.object({
      updateStatsInterval: Joi.string()
    })
  }),
  logger: Joi.object({
    level: Joi.string(),
    file: Joi.string(),
    maxSize: Joi.string(),
    maxFiles: Joi.string()
  }),
  api: Joi.object({
    basePath: Joi.string(),
    version: Joi.string(),
    docsPath: Joi.string()
  })
});

const { error } = schema.validate(config);
if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

module.exports = config;