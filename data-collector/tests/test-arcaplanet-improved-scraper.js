/**
 * Test dello scraper Arcaplanet migliorato
 * Questo script testa il nuovo scraper Arcaplanet con l'approccio ibrido
 * (intercettazione GraphQL + raggruppamento prodotti)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const logger = require('./src/utils/logger');
const ArcaplanetScraper = require('./src/scrapers/arcaplanet-scraper');

// Configurazione
const config = {
  category: 'cane/cibo-secco',    // Categoria da analizzare
  debug: true,                    // Attiva output di debug
  maxPages: 2,                    // Massimo numero di pagine
  productsLimit: 40,              // Massimo numero di prodotti
  headless: 'new',                // 'new' per headless, false per vedere il browser
  saveResults: true               // Salva risultati su file
};

/**
 * Funzione per salvare i dati in formato JSON
 */
function saveJsonData(filename, data) {
  if (!config.saveResults) return;
  
  const filePath = path.join(__dirname, filename);
  const jsonData = JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, jsonData, 'utf8');
  logger.info(`Dati salvati in ${filePath} (${(jsonData.length / 1024).toFixed(2)} KB)`);
}

/**
 * Test dello scraper con impostazioni standard
 */
async function testStandardScraper() {
  logger.info('=== TEST SCRAPER ARCAPLANET STANDARD ===');
  
  const scraper = new ArcaplanetScraper({
    debug: config.debug,
    maxPages: config.maxPages,
    headless: config.headless,
    usePuppeteer: true  // Usiamo Puppeteer per l'approccio ibrido
  });
  
  try {
    // Esegui lo scraping della categoria
    logger.info(`Scraping della categoria ${config.category} con limitazione a ${config.productsLimit} prodotti`);
    
    const startTime = Date.now();
    const products = await scraper.scrapeCategory(config.category, 1, config.productsLimit);
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    logger.info(`Test completato in ${elapsedTime} secondi`);
    logger.info(`Recuperati ${products.length} prodotti standard`);
    
    // Salva i risultati
    if (config.saveResults) {
      saveJsonData('arcaplanet-improved-products.json', products);
    }
    
    // Mostra esempio di un prodotto
    if (products.length > 0) {
      logger.info('\nESEMPIO PRODOTTO:');
      logger.info(`Titolo: ${products[0].title}`);
      logger.info(`Brand: ${products[0].brand}`);
      logger.info(`Prezzo: ${products[0].price.current} (Originale: ${products[0].price.original})`);
      logger.info(`URL: ${products[0].url}`);
      logger.info(`Immagini: ${products[0].images.length}`);
      logger.info(`Varianti: ${products[0].variants.length}`);
    }
    
    return { success: true, products };
  } catch (error) {
    logger.error(`Test fallito: ${error.message}`);
    console.error(error);
    return { success: false, error };
  } finally {
    // Chiudi il browser
    await scraper.closeBrowser();
  }
}

/**
 * Funzione principale
 */
async function main() {
  logger.info('=== INIZIO TEST SCRAPER ARCAPLANET MIGLIORATO ===');
  
  try {
    // Test standard dello scraper
    await testStandardScraper();
    
    logger.info('\n=== TEST COMPLETATO ===');
  } catch (error) {
    logger.error(`Errore durante l'esecuzione dei test: ${error.message}`);
    console.error(error);
  }
}

// Esegui test
main(); 