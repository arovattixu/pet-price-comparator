require('dotenv').config();
const fs = require('fs');
const path = require('path');
const logger = require('./src/utils/logger');
const ArcaplanetScraper = require('./src/scrapers/arcaplanet-scraper');
const { arcaplanet } = require('./config/scraping-policies');
const { arcaplanetCategoryPaths } = require('./config/categories');

/**
 * Funzione per estrarre prodotti da tutte le categorie di Arcaplanet
 */
async function extractAllArcaplanetCategories() {
  logger.info('=== ESTRAZIONE PRODOTTI DA TUTTE LE CATEGORIE ARCAPLANET ===');
  logger.info(`Numero totale di categorie da elaborare: ${arcaplanetCategoryPaths.length}`);
  
  // Configura opzioni dello scraper
  const options = {
    debug: true,
    baseUrl: arcaplanet.baseUrl,
    apiBaseUrl: arcaplanet.apiBaseUrl,
    graphqlEndpoint: arcaplanet.graphqlEndpoint,
    enablePagination: true,
    maxPages: 3, // Limitato a 3 pagine per categoria (60 prodotti) per non sovraccaricare
    pauseBetweenPages: 3000,
    requestDelay: 2000,
    usePuppeteer: true,
    headless: true,
    productsPerPage: 20,
    browserTimeout: 60000,
    retryAttempts: 3
  };
  
  logger.info(`Configurazione scraper:
  - Paginazione: ${options.enablePagination ? 'abilitata' : 'disabilitata'}
  - Pagine per categoria: ${options.maxPages}
  - Prodotti per pagina: ${options.productsPerPage}
  - Modalità headless: ${options.headless ? 'attivata' : 'disattivata'}
  - Pausa tra pagine: ${options.pauseBetweenPages}ms
  - Pausa tra richieste: ${options.requestDelay}ms`);
  
  // Crea la directory per i risultati se non esiste
  const resultsDir = path.join(__dirname, 'results', 'arcaplanet');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
    logger.info(`Creata directory per i risultati: ${resultsDir}`);
  }
  
  // Inizializza lo scraper
  const scraper = new ArcaplanetScraper(options);
  
  // Statistiche globali
  let totalProducts = 0;
  let successfulCategories = 0;
  let failedCategories = 0;
  const startTimeGlobal = Date.now();
  
  try {
    // Itera attraverso tutte le categorie
    for (let i = 0; i < arcaplanetCategoryPaths.length; i++) {
      const categoryPath = arcaplanetCategoryPaths[i];
      logger.info(`\n[${i + 1}/${arcaplanetCategoryPaths.length}] Elaborazione categoria: ${categoryPath}`);
      
      try {
        // Registra il tempo di inizio per questa categoria
        const startTime = Date.now();
        
        // Recupera i prodotti
        logger.info(`Avvio recupero prodotti per ${categoryPath}...`);
        const products = await scraper.fetchCategoryProducts(categoryPath);
        
        // Calcola il tempo trascorso
        const endTime = Date.now();
        const elapsedTime = (endTime - startTime) / 1000;
        
        // Log dei risultati
        logger.info(`Categoria ${categoryPath} completata in ${elapsedTime.toFixed(2)} secondi`);
        logger.info(`Trovati ${products.length} prodotti per ${categoryPath}`);
        
        // Aggiorna le statistiche
        totalProducts += products.length;
        successfulCategories++;
        
        // Salva i risultati in un file JSON
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const sanitizedCategory = categoryPath.replace(/\//g, '_');
        const filename = path.join(resultsDir, `arcaplanet_${sanitizedCategory}_${timestamp}.json`);
        
        fs.writeFileSync(filename, JSON.stringify(products, null, 2));
        logger.info(`Risultati salvati in: ${filename}`);
        
        // Breve pausa tra le categorie per non sovraccaricare
        if (i < arcaplanetCategoryPaths.length - 1) {
          const pauseTime = 5000; // 5 secondi di pausa tra le categorie
          logger.info(`Pausa di ${pauseTime/1000} secondi prima della prossima categoria...`);
          await new Promise(resolve => setTimeout(resolve, pauseTime));
        }
      } catch (error) {
        logger.error(`Errore durante l'elaborazione della categoria ${categoryPath}: ${error.message}`);
        failedCategories++;
        
        // Se c'è un errore, continua con la categoria successiva
        continue;
      }
    }
    
    // Calcola il tempo totale di esecuzione
    const endTimeGlobal = Date.now();
    const totalElapsedTime = (endTimeGlobal - startTimeGlobal) / 1000;
    
    // Log delle statistiche finali
    logger.info('\n=== RIEPILOGO ESTRAZIONE ARCAPLANET ===');
    logger.info(`Tempo totale di esecuzione: ${totalElapsedTime.toFixed(2)} secondi`);
    logger.info(`Categorie elaborate con successo: ${successfulCategories}/${arcaplanetCategoryPaths.length}`);
    logger.info(`Categorie con errori: ${failedCategories}`);
    logger.info(`Prodotti totali estratti: ${totalProducts}`);
    logger.info('=======================================');
  } catch (error) {
    logger.error(`Errore generale durante l'estrazione: ${error.message}`);
    logger.error(error.stack);
  } finally {
    // Cleanup delle risorse
    await scraper.cleanup();
    logger.info('Pulizia risorse completata.');
  }
}

// Avvia l'estrazione
extractAllArcaplanetCategories().then(() => {
  logger.info('Processo di estrazione terminato.');
}).catch(error => {
  logger.error(`Errore durante l'esecuzione: ${error.message}`);
  logger.error(error.stack);
  process.exit(1);
}); 