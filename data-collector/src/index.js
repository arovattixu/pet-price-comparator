require('dotenv').config();
const mongoose = require('mongoose');
const { connectToDatabase } = require('./services/database');
const { setupCronJobs } = require('./services/cron-scheduler');
const ProxyManager = require('./proxy/proxy-manager');
const logger = require('./utils/logger');
const cron = require('node-cron');
const db = require('./services/database');
const { startZooplusScraping } = require('./services/zooplus-scheduler');
const { startArcaplanetScraping } = require('./services/arcaplanet-scheduler');
const { cleanupArcaplanetProducts } = require('./utils/db-cleanup');

// Gestione degli errori non catturati
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // Non terminiamo il processo in produzione
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Non terminiamo il processo in produzione
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

// Funzione di avvio dell'applicazione
async function startApp() {
  try {
    // Connessione al database
    await db.connect();
    logger.info('Database connesso');
    
    // Inizializza il gestore proxy
    const proxyManager = new ProxyManager();
    await proxyManager.init();
    logger.info('Proxy manager inizializzato');
    
    // Pianificazione dei job
    
    // Zooplus alle 00:00 ogni giorno
    cron.schedule('0 0 * * *', async () => {
      logger.info('Avvio job schedulato di scraping Zooplus');
      await startZooplusScraping();
    });
    
    // Arcaplanet alle 02:00 ogni giorno (2 ore dopo Zooplus)
    cron.schedule('0 2 * * *', async () => {
      logger.info('Avvio job schedulato di scraping Arcaplanet');
      await startArcaplanetScraping();
    });
    
    // Pulizia database alle 04:00 ogni giorno (dopo entrambi gli scraping)
    cron.schedule('0 4 * * *', async () => {
      logger.info('Avvio job schedulato di pulizia database');
      await cleanupArcaplanetProducts();
    });
    
    logger.info('Job di scraping configurato per esecuzione giornaliera alle 00:00 (Zooplus) e 02:00 (Arcaplanet)');
    logger.info('Job di pulizia database configurato per esecuzione giornaliera alle 04:00');
    
    // Primo avvio (opzionale, per test)
    if (process.env.RUN_ON_START === 'true') {
      logger.info('Avvio immediato test di scraping...');
      
      // Esegui prima Zooplus
      if (process.env.RUN_ZOOPLUS !== 'false') {
        logger.info('Avvio scraping Zooplus in modalità test');
        await startZooplusScraping();
      }
      
      // Poi Arcaplanet
      if (process.env.RUN_ARCAPLANET !== 'false') {
        logger.info('Avvio scraping Arcaplanet in modalità test');
        await startArcaplanetScraping();
      }
      
      // Infine, pulizia database
      if (process.env.RUN_CLEANUP !== 'false') {
        logger.info('Avvio pulizia database in modalità test');
        await cleanupArcaplanetProducts();
      }
    }
  } catch (error) {
    logger.error(`Errore nell'avvio dell'applicazione: ${error.message}`);
    process.exit(1);
  }
}

startApp();