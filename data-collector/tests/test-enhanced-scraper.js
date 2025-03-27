/**
 * Test delle nuove funzionalità dello scraper Arcaplanet
 * 
 * Questo script testa l'estrazione dei dati migliorati:
 * 1. Informazioni prezzi (prezzo unitario, sconti)
 * 2. Informazioni logistiche (disponibilità, spedizione)
 * 3. Categorizzazione normalizzata
 */

const ArcaplanetScraper = require('./src/scrapers/arcaplanet-scraper');
const fs = require('fs');
const path = require('path');
const logger = require('./src/utils/logger');

// Categoria di test
const TEST_CATEGORY = 'cane/cibo-secco';
const OUTPUT_FILE = path.join(__dirname, 'results', 'test-enhanced-scraper-results.json');

// Crea directory se non esiste
if (!fs.existsSync(path.dirname(OUTPUT_FILE))) {
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
}

/**
 * Funzione principale di test
 */
async function testEnhancedScraper() {
  logger.info('Avvio test delle funzionalità migliorate dello scraper Arcaplanet');
  
  try {
    // Inizializza lo scraper
    const scraper = new ArcaplanetScraper({
      maxPages: 1, // Limita a una pagina per velocizzare il test
      productsPerPage: 20,
      debug: true,
      headless: true
    });
    
    logger.info(`Scraping della categoria test: ${TEST_CATEGORY}`);
    
    // Esegui lo scraping
    const products = await scraper.scrapeCategory(TEST_CATEGORY, 1, 20);
    
    // Analizza i dati estratti
    logger.info(`Recuperati ${products.length} prodotti`);
    
    // Verifica e mostra i dati migliorati
    analyzeEnhancedData(products);
    
    // Salva i risultati in un file JSON
    fs.writeFileSync(
      OUTPUT_FILE,
      JSON.stringify(products, null, 2),
      'utf8'
    );
    
    logger.info(`Risultati salvati in ${OUTPUT_FILE}`);
    
    // Chiudi lo scraper
    await scraper.cleanup();
    logger.info('Test completato con successo');
    
    return {
      success: true,
      productCount: products.length,
      outputFile: OUTPUT_FILE
    };
  } catch (error) {
    logger.error(`Errore durante il test: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Analizza i dati estratti per verificare le funzionalità migliorate
 * @param {Array} products - Prodotti estratti
 */
function analyzeEnhancedData(products) {
  if (products.length === 0) {
    logger.warn('Nessun prodotto da analizzare');
    return;
  }

  // Statistiche
  let stats = {
    productsWithPricePerUnit: 0,
    productsWithDiscount: 0,
    totalCategories: 0,
    productsWithDeliveryInfo: 0,
    productsWithVariants: 0,
    totalVariants: 0,
    productsWithBadges: 0,
    productsWithAdditionalProperties: 0
  };

  // Analizza ciascun prodotto
  products.forEach(product => {
    // 1. Verifica dati sui prezzi
    if (product.price && product.price.pricePerUnit) {
      stats.productsWithPricePerUnit++;
    }
    
    if (product.price && product.price.discountPercentage > 0) {
      stats.productsWithDiscount++;
    }
    
    // 2. Verifica categorizzazione
    if (product.categories && product.categories.length > 0) {
      stats.totalCategories += product.categories.length;
    }
    
    // 3. Verifica info logistiche
    if (product.deliveryInfo && product.deliveryInfo.status) {
      stats.productsWithDeliveryInfo++;
    }
    
    // 4. Verifica varianti
    if (product.variants && product.variants.length > 0) {
      stats.productsWithVariants++;
      stats.totalVariants += product.variants.length;
      
      // Verifica proprietà nelle varianti
      product.variants.forEach(variant => {
        if (variant.specifications && Object.keys(variant.specifications.properties || {}).length > 0) {
          stats.productsWithAdditionalProperties++;
        }
      });
    }
    
    // 5. Verifica badge/promozioni
    if (product.badges && product.badges.length > 0) {
      stats.productsWithBadges++;
    }
  });
  
  // Mostra i risultati dell'analisi
  logger.info('=== ANALISI DATI MIGLIORATI ===');
  logger.info(`Prodotti analizzati: ${products.length}`);
  logger.info(`Prodotti con prezzo unitario: ${stats.productsWithPricePerUnit} (${percentOf(stats.productsWithPricePerUnit, products.length)}%)`);
  logger.info(`Prodotti in sconto: ${stats.productsWithDiscount} (${percentOf(stats.productsWithDiscount, products.length)}%)`);
  logger.info(`Totale categorie estratte: ${stats.totalCategories} (media: ${(stats.totalCategories / products.length).toFixed(2)} per prodotto)`);
  logger.info(`Prodotti con info consegna: ${stats.productsWithDeliveryInfo} (${percentOf(stats.productsWithDeliveryInfo, products.length)}%)`);
  logger.info(`Prodotti con varianti: ${stats.productsWithVariants} (${percentOf(stats.productsWithVariants, products.length)}%)`);
  logger.info(`Totale varianti: ${stats.totalVariants} (media: ${(stats.totalVariants / stats.productsWithVariants).toFixed(2)} per prodotto)`);
  logger.info(`Prodotti con badge: ${stats.productsWithBadges} (${percentOf(stats.productsWithBadges, products.length)}%)`);
  logger.info(`Prodotti con proprietà aggiuntive: ${stats.productsWithAdditionalProperties} (${percentOf(stats.productsWithAdditionalProperties, products.length)}%)`);
  
  // Mostra esempio del primo prodotto
  if (products.length > 0) {
    const sampleProduct = products[0];
    logger.info('\n=== ESEMPIO PRODOTTO ===');
    logger.info(`Titolo: ${sampleProduct.title}`);
    logger.info(`Brand: ${sampleProduct.brand}`);
    logger.info(`SKU: ${sampleProduct.sku}`);
    logger.info(`GTIN: ${sampleProduct.gtin || 'N/A'}`);
    
    if (sampleProduct.price) {
      logger.info(`Prezzo: €${sampleProduct.price.current} (originale: €${sampleProduct.price.original})`);
      if (sampleProduct.price.discountPercentage > 0) {
        logger.info(`Sconto: ${sampleProduct.price.discountPercentage}%`);
      }
      if (sampleProduct.price.pricePerUnit) {
        logger.info(`Prezzo unitario: €${sampleProduct.price.pricePerUnit.value.toFixed(2)}/${sampleProduct.price.pricePerUnit.unit}`);
      }
    }
    
    if (sampleProduct.deliveryInfo) {
      logger.info(`Stato disponibilità: ${sampleProduct.deliveryInfo.status}`);
      logger.info(`Stima consegna: ${sampleProduct.deliveryInfo.estimatedDelivery}`);
    }
    
    if (sampleProduct.categories && sampleProduct.categories.length > 0) {
      logger.info(`Categorie: ${sampleProduct.categories.map(cat => cat.name).join(' > ')}`);
    }
    
    if (sampleProduct.variants && sampleProduct.variants.length > 0) {
      logger.info(`Varianti: ${sampleProduct.variants.length}`);
      const sampleVariant = sampleProduct.variants[0];
      logger.info(`  - Esempio variante: ${sampleVariant.title}`);
    }
  }
}

/**
 * Calcola la percentuale
 * @param {number} value - Valore
 * @param {number} total - Totale
 * @returns {string} Percentuale formattata
 */
function percentOf(value, total) {
  if (total === 0) return '0.00';
  return ((value / total) * 100).toFixed(2);
}

// Esegui il test
testEnhancedScraper()
  .then(result => {
    if (result.success) {
      logger.info(`Test completato: ${result.productCount} prodotti estratti`);
    } else {
      logger.error(`Test fallito: ${result.error}`);
    }
  })
  .catch(error => {
    logger.error(`Errore non gestito: ${error.message}`);
  }); 