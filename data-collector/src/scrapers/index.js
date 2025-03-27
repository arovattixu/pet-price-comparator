const ArcaplanetScraper = require('./arcaplanet-scraper');
const ZooplusScraper = require('./zooplus-scraper');
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
    
    logger.info('Inizializzazione degli scraper migliorati...');
    
    // Opzioni comuni per gli scraper
    const scraperOptions = {
      debug: process.env.DEBUG === 'true' || false,
      headless: process.env.HEADLESS !== 'false',
      maxPages: parseInt(process.env.MAX_PAGES) || 5,
      proxy: proxy,
      usePuppeteer: true
    };
    
    // Inizializza gli scraper
    const arcaplanetScraper = new ArcaplanetScraper(scraperOptions);
    const zooplusScraper = new ZooplusScraper(scraperOptions);
    
    // Aggiungi gli scraper alle code
    if (queue && queue.scrapingQueue) {
      // Registra gli scraper nella coda di scraping
      queue.scrapingQueue.process('arcaplanet', async (job) => {
        const { category, limit } = job.data;
        logger.info(`Esecuzione job di scraping Arcaplanet per categoria: ${category}`);
        return await arcaplanetScraper.scrapeCategory(category, 1, limit || 100);
      });
      
      queue.scrapingQueue.process('zooplus', async (job) => {
        const { category, limit } = job.data;
        logger.info(`Esecuzione job di scraping Zooplus per categoria: ${category}`);
        return await zooplusScraper.scrapeCategory(category, 1, limit || 100);
      });
    }
    
    logger.info('Scraper migliorati configurati con successo');
    
    return {
      arcaplanetScraper,
      zooplusScraper
    };
  } catch (error) {
    logger.error(`Errore durante la configurazione degli scraper: ${error.message}`);
    throw error;
  }
}

module.exports = { 
  setupScrapers,
  ArcaplanetScraper,
  ZooplusScraper
};