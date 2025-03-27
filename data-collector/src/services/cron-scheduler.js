const cron = require('node-cron');
const { runScrapingTask } = require('./scheduler');
const logger = require('../utils/logger');

/**
 * Configura i job cron per lo scraping periodico
 * @param {Object} options - Opzioni di configurazione
 * @returns {Object} - I job cron configurati
 */
async function setupCronJobs(options = {}) {
  const interval = options.interval || process.env.SCRAPING_INTERVAL || 86400; // Default 24 ore in secondi
  let cronExpression;
  let description;
  
  // Converti l'intervallo da secondi a espressione cron
  if (interval >= 86400) {
    // Se è giornaliero o più, esegui alla mezzanotte
    cronExpression = '0 0 * * *';
    description = 'ogni giorno a mezzanotte';
  } else {
    // Altrimenti, esegui ogni X ore
    const hours = Math.max(1, Math.floor(interval / 3600));
    cronExpression = `0 */${hours} * * *`;
    description = `ogni ${hours} ore`;
  }
  
  logger.info(`Configurazione job di scraping: ${description} (${cronExpression})`);
  
  // Crea il job cron
  const scrapingJob = cron.schedule(cronExpression, async () => {
    logger.info(`Avvio job di scraping programmato (${description})`);
    try {
      await runScrapingTask();
      logger.info('Job di scraping completato con successo');
    } catch (error) {
      logger.error(`Errore durante l'esecuzione del job di scraping: ${error.message}`);
    }
  }, {
    scheduled: true,
    timezone: process.env.TIMEZONE || 'Europe/Rome'
  });
  
  // Esegui immediatamente per test se in modalità sviluppo
  if (options.runImmediately || process.env.NODE_ENV === 'development') {
    logger.info('Esecuzione immediata del task di scraping per test');
    setTimeout(async () => {
      try {
        await runScrapingTask();
        logger.info('Task di scraping iniziale completato con successo');
      } catch (error) {
        logger.error(`Errore durante l'esecuzione del task di scraping iniziale: ${error.message}`);
      }
    }, 1000); // Piccolo ritardo per permettere all'applicazione di inizializzarsi completamente
  }
  
  return {
    scrapingJob
  };
}

module.exports = { setupCronJobs };