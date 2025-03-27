/**
 * Main entry point for Pet Price Comparator backend
 */
require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const logger = require('./utils/logger');
const { setupScheduledJobs } = require('./jobs');
const cron = require('node-cron');
const Product = require('./models/Product');
const PricePoint = require('./models/PricePoint');

// Importa i job
let checkPriceAlerts;
try {
  checkPriceAlerts = require('./jobs/check-price-alerts');
} catch (error) {
  logger.warn(`Impossibile caricare il job check-price-alerts: ${error.message}`);
}

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  logger.error('Please define the MONGODB_URI environment variable');
  process.exit(1);
}

// Configurazione delle opzioni avanzate di connessione MongoDB
const mongooseOptions = {
  serverSelectionTimeoutMS: 60000,  // 60 secondi
  connectTimeoutMS: 60000,          // 60 secondi
  socketTimeoutMS: 90000,           // 90 secondi
  maxPoolSize: 50                   // Aumentare il numero di connessioni nel pool
};

// Setup global mongoose options
mongoose.set('bufferCommands', true);
mongoose.set('bufferTimeoutMS', 60000); // 60 secondi

// Connect to MongoDB con retry
const connectWithRetry = (retryCount = 0) => {
  const maxRetries = 5;
  const retryDelay = 5000; // 5 secondi
  
  logger.info(`Tentativo di connessione a MongoDB (${retryCount + 1}/${maxRetries})...`);
  
  return mongoose.connect(MONGODB_URI, mongooseOptions)
    .then(() => {
      logger.info('Connessione a MongoDB riuscita!');
      
      // Start server once DB connection is established
      startServer();
      
      // Verifica iniziale dello stato del database
      setTimeout(async () => {
        try {
          const productCount = await Product.countDocuments();
          logger.info(`Database verificato correttamente. ${productCount} prodotti trovati.`);
        } catch (err) {
          logger.error(`Errore nella verifica iniziale del database: ${err.message}`);
        }
      }, 5000);
    })
    .catch(err => {
      logger.error(`Errore di connessione a MongoDB: ${err.message}`);
      
      if (retryCount < maxRetries) {
        logger.info(`Nuovo tentativo di connessione tra ${retryDelay/1000} secondi...`);
        setTimeout(() => connectWithRetry(retryCount + 1), retryDelay);
      } else {
        logger.error(`Raggiunto il numero massimo di tentativi (${maxRetries}). Impossibile connettersi al database.`);
        process.exit(1);
      }
    });
};

// Funzione per avviare il server una volta stabilita la connessione al DB
const startServer = () => {
  // Start server
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`API documentation available at http://localhost:${PORT}/api-docs`);
  });
  
  // Avvio dei job schedulati
  setupScheduledJobs();
  
  // Configura job aggiuntivi
  setupAdditionalJobs();
};

// Inizia la connessione al database
connectWithRetry();

// Monitora lo stato della connessione
mongoose.connection.on('connected', () => {
  logger.info('Mongoose connesso al database');
});

mongoose.connection.on('error', (err) => {
  logger.error(`Errore nella connessione Mongoose: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('Mongoose disconnesso dal database');
});

/**
 * Configura job schedulati aggiuntivi
 */
function setupAdditionalJobs() {
  // Controllo avvisi prezzi ogni 3 ore
  if (typeof checkPriceAlerts === 'function') {
    cron.schedule('0 */3 * * *', async () => {
      logger.info('Avvio job di controllo avvisi prezzi...');
      const startTime = new Date();
      
      try {
        await checkPriceAlerts();
        const endTime = new Date();
        const durationMinutes = ((endTime - startTime) / 1000 / 60).toFixed(2);
        
        logger.info(`Job di controllo avvisi prezzi completato in ${durationMinutes} minuti`);
      } catch (error) {
        const endTime = new Date();
        const durationMinutes = ((endTime - startTime) / 1000 / 60).toFixed(2);
        
        logger.error(`Errore nel job di controllo avvisi prezzi dopo ${durationMinutes} minuti: ${error.message}`);
        logger.error(error.stack);
      }
    });
    logger.info('Job di controllo avvisi prezzi schedulato ogni 3 ore');
  } else {
    logger.warn('Job di controllo avvisi prezzi non schedulato: funzione non disponibile');
  }
  
  // Aggiunta di un job per verificare lo stato del database
  cron.schedule('0 */12 * * *', async () => {
    logger.info('Verifica dello stato del database...');
    try {
      const productCount = await Product.countDocuments();
      const zooplusCount = await Product.countDocuments({ source: 'zooplus' });
      const arcaplanetCount = await Product.countDocuments({ source: 'arcaplanet' });
      const pricePointCount = await PricePoint.countDocuments();
      
      logger.info(`Stato database: ${productCount} prodotti totali (${zooplusCount} Zooplus, ${arcaplanetCount} Arcaplanet), ${pricePointCount} punti prezzo`);
    } catch (error) {
      logger.error(`Errore nella verifica dello stato del database: ${error.message}`);
    }
  });
  
  // Esegui job di ping al database ogni ora per mantenere attiva la connessione
  cron.schedule('0 * * * *', async () => {
    logger.info('Esecuzione ping al database per mantenere la connessione...');
    try {
      await mongoose.connection.db.admin().ping();
      logger.info('Ping al database completato con successo');
    } catch (error) {
      logger.error(`Errore nel ping al database: ${error.message}`);
    }
  });
  
  logger.info('Configurazione dei job aggiuntivi completata');
}

/**
 * Gestione shutdown graceful
 */
process.on('SIGINT', async () => {
  logger.info('Segnale di interruzione ricevuto, chiusura in corso...');
  try {
    await mongoose.connection.close();
    logger.info('Connessione al database chiusa');
    process.exit(0);
  } catch (error) {
    logger.error(`Errore durante la chiusura del database: ${error.message}`);
    process.exit(1);
  }
});

// Gestione degli errori non catturati
process.on('uncaughtException', (error) => {
  logger.error(`Eccezione non catturata: ${error.message}`);
  logger.error(error.stack);
  // Non terminiamo il processo per garantire la disponibilità
  // ma registriamo l'errore dettagliato
});

process.on('unhandledRejection', (error) => {
  logger.error(`Promise rejection non gestita: ${error.message}`);
  logger.error(error.stack);
  // Non terminiamo il processo per garantire la disponibilità
  // ma registriamo l'errore dettagliato
});