require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const logger = require('./src/utils/logger');

// URI del database MongoDB
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  logger.error('MONGODB_URI non definito nelle variabili d\'ambiente');
  process.exit(1);
}

// Semplici schemi di Mongoose
const productSchema = new mongoose.Schema({}, { strict: false });
const pricePointSchema = new mongoose.Schema({}, { strict: false });

// Definizione dei modelli
const Product = mongoose.model('Product', productSchema, 'products');
const PricePoint = mongoose.model('PricePoint', pricePointSchema, 'pricepoints');

// Inizializza express
const app = express();

// Middleware di base
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rotta base
app.get('/', (req, res) => {
  res.json({ 
    message: 'API del Pet Price Comparator (Simple Server)',
    endpoints: [
      '/health - Stato della connessione al database',
      '/api/products - Lista di prodotti',
      '/api/products/count - Numero di prodotti',
      '/api/prices/recent - Prezzi recenti'
    ]
  });
});

// Rotta health check
app.get('/health', async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    const dbStates = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    // Conta i documenti nelle collezioni principali
    let stats = { products: 0, pricepoints: 0 };
    
    if (dbState === 1) {
      stats.products = await Product.countDocuments();
      stats.pricepoints = await PricePoint.countDocuments();
    }
    
    res.json({
      status: dbState === 1 ? 'healthy' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date(),
      database: {
        state: dbStates[dbState],
        readyState: dbState,
        stats
      }
    });
  } catch (error) {
    logger.error(`Errore nella rotta health: ${error.message}`);
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// API per i prodotti
app.get('/api/products', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const products = await Product.find()
      .sort({ _id: -1 })
      .limit(limit);
    
    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    logger.error(`Errore nel recuperare i prodotti: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API per contare i prodotti
app.get('/api/products/count', async (req, res) => {
  try {
    const count = await Product.countDocuments();
    
    res.json({
      success: true,
      count
    });
  } catch (error) {
    logger.error(`Errore nel contare i prodotti: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API per i prezzi recenti
app.get('/api/prices/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const recentPricePoints = await PricePoint.find()
      .sort({ recordedAt: -1 })
      .limit(limit);
    
    res.json({
      success: true,
      data: recentPricePoints
    });
  } catch (error) {
    logger.error(`Errore nel recuperare i prezzi recenti: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Middleware di gestione errori
app.use((err, req, res, next) => {
  logger.error(`${err.status || 500} - ${err.message} - ${req.originalUrl}`);
  
  res.status(err.status || 500).json({
    error: {
      message: process.env.NODE_ENV === 'production' ? 'Errore del server' : err.message,
    }
  });
});

// 404 handler
app.use((req, res) => {
  logger.warn(`404 - ${req.originalUrl}`);
  res.status(404).json({ error: { message: 'Risorsa non trovata' } });
});

// Funzione per connettersi a MongoDB
const connectToMongoDB = async () => {
  try {
    logger.info(`Tentativo di connessione a MongoDB: ${MONGODB_URI.substring(0, MONGODB_URI.indexOf('@') + 1)}[rimanente nascosto]`);
    
    // Opzioni di connessione corrette (senza le opzioni deprecate)
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 50
    });
    
    logger.info('Connessione a MongoDB riuscita!');
    return true;
  } catch (error) {
    logger.error(`Errore di connessione a MongoDB: ${error.message}`);
    return false;
  }
};

// Avvia il server
const startServer = async () => {
  // Connessione al database
  const dbConnected = await connectToMongoDB();
  
  // Avvia il server anche se la connessione fallisce
  const PORT = process.env.PORT || 5001;
  app.listen(PORT, () => {
    logger.info(`Server semplificato in esecuzione su http://localhost:${PORT}`);
    logger.info(`Stato connessione DB: ${dbConnected ? 'Connesso' : 'Non connesso'}`);
  });
  
  // Imposta un handler per la chiusura
  process.on('SIGINT', async () => {
    logger.info('Chiusura server in corso...');
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      logger.info('Connessione al database chiusa.');
    }
    process.exit(0);
  });
};

// Avvia il server
startServer(); 