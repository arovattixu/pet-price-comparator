/**
 * Script per avviare lo scraping completo di Arcaplanet
 * Utilizza lo scraper migliorato e lo scheduler per eseguire lo scraping di tutte le categorie configurate
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const logger = require('../src/utils/logger');
const ArcaplanetScraper = require('../src/scrapers/arcaplanet-scraper');
const { startArcaplanetScraping } = require('../src/services/arcaplanet-scheduler');
const { arcaplanetCategoryPaths } = require('../config/categories');

// Configurazione
const config = {
  debug: process.env.DEBUG === 'true' || false,
  saveRawData: process.env.SAVE_RAW_DATA === 'true' || true,
  resultsDir: process.env.RESULTS_DIR || path.join(__dirname, '../results/arcaplanet'),
  maxPages: parseInt(process.env.MAX_PAGES) || 5,
  headless: process.env.HEADLESS !== 'false', // Headless per default
  timeout: parseInt(process.env.TIMEOUT) || 60000,
  // Utilizziamo le categorie dal file di configurazione
  categories: arcaplanetCategoryPaths,
  // Limita le categorie per test veloci (da commentare per uno scraping completo)
  // testCategories: [
  //   'cane/cibo-secco', 
  //   'cane/cibo-umido',
  //   'gatto/cibo-secco',
  //   'gatto/cibo-umido',
  //   'piccoli-animali/rettili/accessori'
  // ]
};

// Seleziona un sottoinsieme di categorie da scrapare se specificato in linea di comando
// Utilizzo: node run-arcaplanet-scraper.js manual 5
// Questo selezionerà 5 categorie random dalla lista completa
if (process.argv[3] && !isNaN(parseInt(process.argv[3]))) {
  const limit = parseInt(process.argv[3]);
  if (limit > 0 && limit < config.categories.length) {
    // Seleziona un sottoinsieme casuale di categorie
    const shuffled = [...config.categories].sort(() => 0.5 - Math.random());
    config.categories = shuffled.slice(0, limit);
    logger.info(`Limitate a ${config.categories.length} categorie random per test veloce`);
  }
}

/**
 * Funzione per salvare i dati in formato JSON
 */
function saveJsonData(filename, data) {
  // Assicurati che la directory esista
  if (!fs.existsSync(config.resultsDir)) {
    fs.mkdirSync(config.resultsDir, { recursive: true });
  }
  
  const filePath = path.join(config.resultsDir, filename);
  const jsonData = JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, jsonData, 'utf8');
  logger.info(`Dati salvati in ${filePath} (${(jsonData.length / 1024).toFixed(2)} KB)`);
}

/**
 * Esegue lo scraping manuale di una singola categoria
 */
async function scrapeSingleCategory(category, productsLimit = 50) {
  logger.info(`Avvio scraping manuale della categoria: ${category}`);
  
  const scraper = new ArcaplanetScraper({
    debug: config.debug,
    maxPages: config.maxPages,
    headless: config.headless,
    usePuppeteer: true,
    browserTimeout: config.timeout
  });
  
  try {
    const startTime = Date.now();
    const products = await scraper.scrapeCategory(category, 1, productsLimit);
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    logger.info(`Scraping completato in ${elapsedTime} secondi`);
    logger.info(`Recuperati ${products.length} prodotti dalla categoria ${category}`);
    
    // Salva i risultati
    if (config.saveRawData) {
      const filename = `${category.replace(/\//g, '-')}-products.json`;
      saveJsonData(filename, products);
    }
    
    return { success: true, products };
  } catch (error) {
    logger.error(`Scraping fallito per la categoria ${category}: ${error.message}`);
    return { success: false, error };
  } finally {
    await scraper.closeBrowser();
  }
}

/**
 * Esegue lo scraping di tutte le categorie configurate
 */
async function scrapeAllCategories() {
  logger.info(`Avvio scraping di ${config.categories.length} categorie`);
  
  const results = {
    totalProducts: 0,
    categories: {},
    startTime: new Date().toISOString(),
    endTime: null,
    elapsedSeconds: 0
  };
  
  const startTime = Date.now();
  
  for (const category of config.categories) {
    logger.info(`Elaborazione categoria: ${category}`);
    
    try {
      const result = await scrapeSingleCategory(category, 100); // 100 prodotti per categoria
      
      if (result.success) {
        results.categories[category] = {
          status: 'success',
          productsCount: result.products.length
        };
        results.totalProducts += result.products.length;
      } else {
        results.categories[category] = {
          status: 'failed',
          error: result.error.message
        };
      }
    } catch (error) {
      logger.error(`Errore durante lo scraping della categoria ${category}: ${error.message}`);
      results.categories[category] = {
        status: 'error',
        error: error.message
      };
    }
    
    // Piccola pausa tra le categorie
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  const endTime = Date.now();
  const elapsedSeconds = Math.round((endTime - startTime) / 1000);
  
  results.endTime = new Date().toISOString();
  results.elapsedSeconds = elapsedSeconds;
  
  logger.info(`Scraping completato in ${elapsedSeconds} secondi`);
  logger.info(`Recuperati ${results.totalProducts} prodotti totali da ${config.categories.length} categorie`);
  
  // Salva il report
  saveJsonData('scraping-report.json', results);
  
  return results;
}

/**
 * Avvia lo scheduler per lo scraping automatico
 */
async function startScheduledScraping() {
  logger.info('Avvio dello scraping schedulato con lo scheduler');
  
  try {
    await startArcaplanetScraping();
    logger.info('Scheduler avviato con successo');
  } catch (error) {
    logger.error(`Errore durante l'avvio dello scheduler: ${error.message}`);
  }
}

/**
 * Funzione principale
 */
async function main() {
  const mode = process.argv[2] || 'manual';
  
  logger.info(`=== AVVIO SCRAPING ARCAPLANET (Modalità: ${mode}) ===`);
  logger.info(`Configurato per scrapare ${config.categories.length} categorie`);
  
  try {
    if (mode === 'scheduled') {
      // Modalità schedulata usando lo scheduler
      await startScheduledScraping();
    } else if (mode === 'single' && process.argv[3] && isNaN(parseInt(process.argv[3]))) {
      // Modalità singola categoria - si assicura che il parametro non sia un numero (per evitare conflitti)
      const category = process.argv[3];
      await scrapeSingleCategory(category, 100);
    } else {
      // Modalità manuale per tutte le categorie
      await scrapeAllCategories();
    }
  } catch (error) {
    logger.error(`Errore durante l'esecuzione: ${error.message}`);
    console.error(error);
  }
}

// Verifica se lo script è stato eseguito direttamente
if (require.main === module) {
  main();
}

module.exports = {
  scrapeSingleCategory,
  scrapeAllCategories,
  startScheduledScraping
}; 