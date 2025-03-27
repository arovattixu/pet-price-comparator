/**
 * Script per eseguire lo scraping solo delle categorie precedentemente fallite
 * Usa i path corretti aggiornati nel file di configurazione
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const logger = require('../src/utils/logger');
const ArcaplanetScraper = require('../src/scrapers/arcaplanet-scraper');

// Configurazione
const config = {
  debug: process.env.DEBUG === 'true' || false,
  saveRawData: process.env.SAVE_RAW_DATA === 'true' || true,
  resultsDir: process.env.RESULTS_DIR || path.join(__dirname, '../results/arcaplanet'),
  maxPages: parseInt(process.env.MAX_PAGES) || 5,
  headless: process.env.HEADLESS !== 'false', // Headless per default
  timeout: parseInt(process.env.TIMEOUT) || 60000,
  // Categorie fallite con i path corretti
  categories: [
    'cane/accessori/ciotole-e-dispenser',        // era cane/accessori/contenitori-cibo
    'cane/igiene/manto-e-cute',                  // era cane/igiene/igiene-manto-e-cute
    'cane/igiene/orale',                         // era cane/igiene/igiene-orale
    'cane/igiene/portasacchetti',                // era cane/igiene/porta-sacchettini
    'cane/antiparassitari-e-curativi/integratori', // era cane/antiparassitari-e-curativi/alimenti-complementari
    'gatto/sabbie/agglomerante',                 // era gatto/lettiere/agglomerante
    'gatto/sabbie/assorbente',                   // era gatto/lettiere/assorbente
    'gatto/sabbie/vegetale',                     // era gatto/lettiere/sabbie/vegetale
    'gatto/sabbie/silicio',                      // era gatto/lettiere/sabbie/silicio
    'gatto/accessori/ciotole-e-dispenser',       // era gatto/accessori/contenitori-cibo
    'gatto/accessori/cucce-e-lettini',           // era gatto/accessori/cucce-e-tappetini
    'gatto/toilette-e-accessori/palette',        // era gatto/toilette-e-accessori/palette-toilette
    'gatto/antiparassitari-e-curativi/integratori', // era gatto/antiparassitari-e-curativi/alimenti-complementari
    'piccoli-animali/rettili/mangime'            // invariato
  ]
};

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
  logger.info(`Avvio scraping della categoria fallita: ${category}`);
  
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
 * Esegue lo scraping di tutte le categorie fallite
 */
async function scrapeFailedCategories() {
  logger.info(`=== AVVIO SCRAPING DI ${config.categories.length} CATEGORIE FALLITE ===`);
  
  const results = {
    totalProducts: 0,
    categories: {},
    startTime: new Date().toISOString(),
    endTime: null,
    elapsedSeconds: 0
  };
  
  const startTime = Date.now();
  
  for (const category of config.categories) {
    logger.info(`Elaborazione categoria fallita: ${category}`);
    
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
  
  logger.info(`Scraping delle categorie fallite completato in ${elapsedSeconds} secondi`);
  logger.info(`Recuperati ${results.totalProducts} prodotti totali da ${Object.keys(results.categories).filter(k => results.categories[k].status === 'success').length} categorie`);
  
  // Salva il report
  saveJsonData('scraping-failed-categories-report.json', results);
  
  return results;
}

// Verifica se lo script è stato eseguito direttamente
if (require.main === module) {
  scrapeFailedCategories();
}

module.exports = { scrapeFailedCategories }; 