const mongoose = require('mongoose');
const ZooplusScraper = require('./zooplus-scraper');
const Product = require('../models/product');
const logger = require('../utils/logger');
const { zooplusCategoryPaths } = require('../../config/categories');

/**
 * Imposta lo scraper di Zooplus e registra i job nella coda
 * @param {Object} queue - La coda Bull per gestire i job
 * @param {string|null} proxy - Proxy da utilizzare (opzionale)
 * @param {number} interval - Intervallo di esecuzione in millisecondi
 * @param {Object} options - Opzioni aggiuntive per lo scraper
 */
async function setupZooplusScraper(queue, proxy = null, interval = 3600000, options = {}) {
  logger.info('Setting up Zooplus scraper');
  
  // Merge default options per l'ambiente di produzione
  const scraperOptions = {
    enablePagination: true,         // Abilita di default la paginazione
    maxPages: 10,                    // Imposta 10 pagine per categoria (circa 240 prodotti)
    retryAttempts: 3,                // Numero di tentativi in caso di errore
    retryDelay: 5000,                // Pausa tra i tentativi (5 secondi)
    pauseBetweenCategories: 2000,    // Pausa tra categorie per non sovraccaricare l'API
    ...options
  };
  
  logger.info(`Configurazione scraper Zooplus: 
    - Paginazione: ${scraperOptions.enablePagination ? 'abilitata' : 'disabilitata'}
    - Max pagine: ${scraperOptions.maxPages}
    - Tentativi: ${scraperOptions.retryAttempts}
    - Pausa tra tentativi: ${scraperOptions.retryDelay}ms
  `);
  
  // Registra il processor per i job Zooplus
  queue.process('scrape-zooplus', async (job) => {
    return await processZooplusJob(job.data, proxy, scraperOptions);
  });
  
  // Imposta un timer per il prossimo job
  queue.add('scrape-zooplus', { options: scraperOptions }, { 
    repeat: { 
      every: interval 
    },
    removeOnComplete: true,
    attempts: scraperOptions.retryAttempts,
    backoff: {
      type: 'exponential',
      delay: scraperOptions.retryDelay
    }
  });

  // Esegui immediatamente il primo job (con stesse opzioni)
  return await processZooplusJob({ options: scraperOptions }, proxy, scraperOptions);
}

/**
 * Elabora un job di scraping per Zooplus
 * @param {Object} jobData - Dati del job
 * @param {string|null} proxy - Proxy da utilizzare (opzionale)
 * @param {Object} options - Opzioni aggiuntive per lo scraper
 */
async function processZooplusJob(jobData, proxy = null, options = {}) {
  try {
    const jobId = jobData.id || 'manual';
    const startTime = new Date();
    
    logger.info(`Avvio job Zooplus #${jobId} - ${startTime.toISOString()}`);
    logger.info(`Opzioni scraper: ${JSON.stringify(options)}`);
    
    const results = await scrapeZooplus(proxy, options);
    
    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;
    
    logger.info(`Completato job Zooplus #${jobId} in ${duration}s. Categorie processate: ${results.categoriesProcessed}, prodotti trovati: ${results.totalProducts}, salvati: ${results.savedProducts}, aggiornati: ${results.updatedProducts}`);
    
    return {
      ...results,
      jobId,
      startTime,
      endTime,
      duration
    };
  } catch (error) {
    logger.error(`Errore fatale nell'elaborazione del job Zooplus: ${error.message}`);
    logger.error(error.stack);
    throw error; // Rilancia l'errore per permettere alla coda di gestirlo
  }
}

/**
 * Esegue lo scraping dei prodotti da Zooplus tramite API diretta
 * @param {string|null} proxy - Proxy da utilizzare (opzionale)
 * @param {Object} options - Opzioni aggiuntive per lo scraper
 */
async function scrapeZooplus(proxy = null, options = {}) {
  // Merge default options con impostazioni etiche
  const scraperOptions = {
    enablePagination: true,
    maxPages: 10,
    retryAttempts: 3,
    retryDelay: 5000,
    pauseBetweenCategories: 2000,
    // Nuove opzioni etiche
    pauseBetweenPages: 2000,    // Pausa tra pagine di una categoria
    requestDelay: 1000,         // Pausa tra singole richieste API
    ...options
  };
  
  // Log delle opzioni configurate
  logger.info(`Configurazione scraper con impostazioni etiche:
    - Paginazione: ${scraperOptions.enablePagination ? 'abilitata' : 'disabilitata'}
    - Max pagine: ${scraperOptions.maxPages}
    - Tentativi: ${scraperOptions.retryAttempts}
    - Pausa tra categorie: ${scraperOptions.pauseBetweenCategories}ms
    - Pausa tra pagine: ${scraperOptions.pauseBetweenPages}ms
    - Pausa tra richieste: ${scraperOptions.requestDelay}ms
  `);
  
  // Inizializza le statistiche
  const stats = {
    totalProducts: 0,
    savedProducts: 0,
    updatedProducts: 0,
    failedProducts: 0,
    skippedProducts: 0,
    categoriesProcessed: 0,
    categoriesSucceeded: 0,
    categoriesFailed: 0,
    startTime: Date.now(),
    endTime: null,
    executionTime: null,
    categoryResults: []
  };
  
  // Crea lo scraper con tutte le opzioni specificate
  const scraper = new ZooplusScraper({ 
    ...(proxy ? { proxy } : {}), // Aggiungi proxy solo se definito
    enablePagination: scraperOptions.enablePagination,
    maxPages: scraperOptions.maxPages,
    retryAttempts: scraperOptions.retryAttempts,
    retryDelay: scraperOptions.retryDelay,
    pauseBetweenPages: scraperOptions.pauseBetweenPages,
    requestDelay: scraperOptions.requestDelay
  });
  
  // Ottieni le categorie da processare
  logger.info(`Avvio scraping Zooplus per ${zooplusCategoryPaths.length} categorie via API diretta`);
  logger.info(`Paginazione: ${scraperOptions.enablePagination ? 'abilitata' : 'disabilitata'}, max pagine: ${scraperOptions.maxPages}`);
  
  // Elaborazione sequenziale delle categorie (per evitare sovraccarichi)
  for (const categoryPath of zooplusCategoryPaths) {
    const categoryStartTime = Date.now();
    let categorySuccess = false;
    let categoryError = null;
    let productsInCategory = 0;
    
    logger.info(`Processing category: ${categoryPath}`);
    
    // Implementa la logica di retry per ogni categoria
    for (let attempt = 1; attempt <= scraperOptions.retryAttempts; attempt++) {
      try {
        // Log dei tentativi successivi al primo
        if (attempt > 1) {
          logger.info(`Retry attempt ${attempt}/${scraperOptions.retryAttempts} for category: ${categoryPath}`);
        }
        
        // Recupera i prodotti tramite API (nuovo metodo semplificato)
        const products = await scraper.fetchCategoryProducts(categoryPath);
        productsInCategory = products.length;
        
        logger.info(`Trovati ${productsInCategory} prodotti mappati per categoria ${categoryPath}`);
        
        // Salta il salvataggio se non ci sono prodotti
        if (products.length === 0) {
          logger.warn(`No products found for category: ${categoryPath}`);
          categorySuccess = true; // Segna come successo ma con 0 prodotti
          break;
        }
        
        // Verifica finale che tutti i prodotti abbiano source e sourceId
        const validProducts = products.filter(product => {
          if (!product.source || !product.sourceId) {
            logger.warn(`Filtro prodotto senza campi obbligatori: ${product.name}`);
            stats.skippedProducts++;
            return false;
          }
          return true;
        });
        
        logger.info(`${validProducts.length} prodotti validi pronti per il salvataggio`);
        
        // Salva i prodotti nel database
        const saveResults = await saveProducts(validProducts);
        
        // Aggiorna le statistiche
        stats.totalProducts += productsInCategory;
        stats.savedProducts += saveResults.saved;
        stats.updatedProducts += saveResults.updated;
        stats.failedProducts += saveResults.failed;
        stats.skippedProducts += saveResults.skipped;
        
        // Segna come completato con successo e interrompi il ciclo di retry
        categorySuccess = true;
        break;
      } catch (error) {
        categoryError = error;
        logger.error(`Error processing category ${categoryPath} (attempt ${attempt}/${scraperOptions.retryAttempts}):`, error);
        
        // Se non è l'ultimo tentativo, aspetta prima di riprovare
        if (attempt < scraperOptions.retryAttempts) {
          // Backoff esponenziale con jitter
          const delay = scraperOptions.retryDelay * Math.pow(1.5, attempt - 1) * (0.9 + Math.random() * 0.2);
          logger.info(`Waiting ${Math.round(delay)}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // Aggiorna i risultati della categoria
    const categoryExecutionTime = (Date.now() - categoryStartTime) / 1000;
    stats.categoryResults.push({
      category: categoryPath,
      success: categorySuccess,
      productsFound: productsInCategory,
      error: categoryError ? categoryError.message : null,
      executionTime: categoryExecutionTime
    });
    
    // Aggiorna i contatori delle categorie
    stats.categoriesProcessed++;
    if (categorySuccess) {
      stats.categoriesSucceeded++;
    } else {
      stats.categoriesFailed++;
    }
    
    logger.info(`Category ${categoryPath} processed in ${categoryExecutionTime.toFixed(2)} seconds. Success: ${categorySuccess}`);
    
    // Pausa tra categorie per non sovraccaricare l'API
    if (categoryPath !== zooplusCategoryPaths[zooplusCategoryPaths.length - 1]) {
      logger.debug(`Pausing for ${scraperOptions.pauseBetweenCategories}ms before next category`);
      await new Promise(resolve => setTimeout(resolve, scraperOptions.pauseBetweenCategories));
    }
  }
  
  // Aggiorna le statistiche finali
  stats.endTime = Date.now();
  stats.executionTime = (stats.endTime - stats.startTime) / 1000;
  
  logger.info(`Zooplus scraping completed in ${stats.executionTime.toFixed(2)} seconds.`);
  logger.info(`Processed ${stats.categoriesProcessed} categories: ${stats.categoriesSucceeded} succeeded, ${stats.categoriesFailed} failed.`);
  logger.info(`Found ${stats.totalProducts} products: ${stats.savedProducts} new, ${stats.updatedProducts} updated, ${stats.skippedProducts} skipped, ${stats.failedProducts} failed.`);
  
  return stats;
}

/**
 * Salva i prodotti nel database
 * @param {Array} products - Array di prodotti da salvare
 * @returns {Object} - Statistiche sui prodotti salvati, aggiornati, falliti e saltati
 */
async function saveProducts(products) {
  const stats = {
    saved: 0,
    updated: 0,
    failed: 0,
    skipped: 0
  };
  
  logger.info(`Saving ${products.length} products to database...`);
  
  for (const product of products) {
    try {
      // Verifica che i campi critici siano presenti
      if (!product.sourceId || !product.source) {
        logger.warn(`Skipping product: Missing required fields (sourceId: ${product.sourceId}, source: ${product.source})`);
        stats.skipped++;
        continue;
      }
      
      // Imposta sempre source a 'zooplus' se mancante
      if (!product.source) {
        product.source = 'zooplus';
      }
      
      // Verifica se il prodotto esiste già
      const existingProduct = await Product.findOne({
        source: product.source,
        sourceId: product.sourceId
      });
      
      if (existingProduct) {
        // Aggiorna prodotto esistente
        const updatedProduct = await Product.findOneAndUpdate(
          { source: product.source, sourceId: product.sourceId },
          { $set: product },
          { new: true }
        );
        
        logger.debug(`Updated product: ${updatedProduct.name} (${updatedProduct.sourceId})`);
        stats.updated++;
      } else {
        // Crea nuovo prodotto
        const newProduct = new Product(product);
        await newProduct.save();
        
        logger.debug(`Saved new product: ${newProduct.name} (${newProduct.sourceId})`);
        stats.saved++;
      }
    } catch (error) {
      logger.error(`Error saving product: ${error.message}`, {
        product: {
          name: product.name,
          sourceId: product.sourceId,
          source: product.source
        },
        error: error.message
      });
      stats.failed++;
    }
  }
  
  logger.info(`Database save complete: ${stats.saved} saved, ${stats.updated} updated, ${stats.skipped} skipped, ${stats.failed} failed`);
  return stats;
}

module.exports = {
  setupZooplusScraper,
  processZooplusJob,
  scrapeZooplus,
  saveProducts
};