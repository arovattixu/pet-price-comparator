const Bull = require('bull');
const logger = require('../utils/logger');

/**
 * Configura le code di elaborazione utilizzando Bull e Redis
 * @returns {Object} Le code configurate
 */
async function setupQueue() {
  try {
    // Crea la coda per lo scraping
    const scrapingQueue = new Bull('scraping-queue', process.env.REDIS_URL);
    
    // Configura gli eventi della coda
    scrapingQueue.on('completed', (job) => {
      logger.info(`Job ${job.id} completato`);
    });
    
    scrapingQueue.on('failed', (job, err) => {
      logger.error(`Job ${job.id} fallito: ${err.message}`);
    });
    
    // Restituisci le code configurate
    return {
      scrapingQueue
    };
  } catch (error) {
    logger.error(`Errore durante la configurazione delle code: ${error.message}`);
    throw error;
  }
}

module.exports = { setupQueue };