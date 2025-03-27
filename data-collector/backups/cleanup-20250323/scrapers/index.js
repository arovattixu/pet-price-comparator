const { setupZooplusScraper } = require('./zooplus');
const { setupArcaplanetScraper } = require('./arcaplanet');
const { setupProxy } = require('../proxy');
const logger = require('../utils/logger');

/**
 * Configura e avvia tutti gli scraper
 * @param {Object} queue - Le code di elaborazione
 * @returns {Promise<void>}
 */
async function setupScrapers(queue) {
  try {
    // Configura il proxy se necessario
    const proxy = await setupProxy();
    
    // Intervallo di scraping in millisecondi
    const scrapeInterval = parseInt(process.env.SCRAPE_INTERVAL) || 3600000; // Default: 1 ora
    
    // Configura gli scraper
    await setupZooplusScraper(queue.scrapingQueue, proxy, scrapeInterval);
    await setupArcaplanetScraper(queue.scrapingQueue, proxy, scrapeInterval);
    
    logger.info('Scraper configurati con successo');
  } catch (error) {
    logger.error(`Errore durante la configurazione degli scraper: ${error.message}`);
    throw error;
  }
}

module.exports = { setupScrapers };