/**
 * Script master per avviare lo scraping di tutti i siti
 * Utilizza gli script individuali per eseguire lo scraping di tutti i siti supportati
 */

require('dotenv').config();
const path = require('path');
const logger = require('../src/utils/logger');
const { arcaplanetCategoryPaths, zooplusCategoryPaths } = require('../config/categories');
const arcaplanetScraper = require('./run-arcaplanet-scraper');
const zooplusScraper = require('./run-zooplus-scraper');

// Configurazione
const config = {
  debug: process.env.DEBUG === 'true' || false,
  arcaplanetCategories: process.env.ARCAPLANET_ENABLED !== 'false' ? arcaplanetCategoryPaths : [],
  zooplusCategories: process.env.ZOOPLUS_ENABLED !== 'false' ? zooplusCategoryPaths : [],
  limitCategories: parseInt(process.env.LIMIT_CATEGORIES) || 0 // 0 = tutte le categorie
};

// Seleziona un sottoinsieme di categorie se specificato
if (config.limitCategories > 0) {
  if (config.limitCategories < config.arcaplanetCategories.length) {
    const shuffled = [...config.arcaplanetCategories].sort(() => 0.5 - Math.random());
    config.arcaplanetCategories = shuffled.slice(0, config.limitCategories);
  }
  
  if (config.limitCategories < config.zooplusCategories.length) {
    const shuffled = [...config.zooplusCategories].sort(() => 0.5 - Math.random());
    config.zooplusCategories = shuffled.slice(0, config.limitCategories);
  }
}

/**
 * Avvia lo scraping di Arcaplanet
 */
async function runArcaplanetScraping() {
  if (config.arcaplanetCategories.length === 0) {
    logger.info('Scraping di Arcaplanet disabilitato');
    return { success: true, skipped: true };
  }
  
  logger.info(`Avvio scraping Arcaplanet per ${config.arcaplanetCategories.length} categorie`);
  try {
    const result = await arcaplanetScraper.scrapeAllCategories();
    logger.info(`Scraping Arcaplanet completato, raccolti ${result.totalProducts} prodotti`);
    return { success: true, result };
  } catch (error) {
    logger.error(`Errore durante lo scraping di Arcaplanet: ${error.message}`);
    return { success: false, error };
  }
}

/**
 * Avvia lo scraping di Zooplus
 */
async function runZooplusScraping() {
  if (config.zooplusCategories.length === 0) {
    logger.info('Scraping di Zooplus disabilitato');
    return { success: true, skipped: true };
  }
  
  logger.info(`Avvio scraping Zooplus per ${config.zooplusCategories.length} categorie`);
  try {
    const result = await zooplusScraper.scrapeAllCategories();
    logger.info(`Scraping Zooplus completato, raccolti ${result.totalProducts} prodotti`);
    return { success: true, result };
  } catch (error) {
    logger.error(`Errore durante lo scraping di Zooplus: ${error.message}`);
    return { success: false, error };
  }
}

/**
 * Funzione principale
 */
async function main() {
  const startTime = Date.now();
  
  logger.info('=== AVVIO SCRAPING COMPLETO ===');
  logger.info(`Arcaplanet: ${config.arcaplanetCategories.length} categorie`);
  logger.info(`Zooplus: ${config.zooplusCategories.length} categorie`);
  
  const results = {
    arcaplanet: null,
    zooplus: null
  };
  
  try {
    // Eseguiamo lo scraping in sequenza per non sovraccaricare la macchina
    logger.info('Iniziamo con Arcaplanet...');
    results.arcaplanet = await runArcaplanetScraping();
    
    logger.info('Continuiamo con Zooplus...');
    results.zooplus = await runZooplusScraping();
    
    const elapsedMinutes = ((Date.now() - startTime) / 60000).toFixed(2);
    logger.info(`=== SCRAPING COMPLETO TERMINATO IN ${elapsedMinutes} MINUTI ===`);
    
    let totalProducts = 0;
    if (results.arcaplanet && results.arcaplanet.result) totalProducts += results.arcaplanet.result.totalProducts;
    if (results.zooplus && results.zooplus.result) totalProducts += results.zooplus.result.totalProducts;
    
    logger.info(`Prodotti totali raccolti: ${totalProducts}`);
    
  } catch (error) {
    logger.error(`Errore durante il processo di scraping completo: ${error.message}`);
    console.error(error);
  }
}

// Verifica se lo script è stato eseguito direttamente
if (require.main === module) {
  main();
}

module.exports = {
  runArcaplanetScraping,
  runZooplusScraping,
  main
}; 