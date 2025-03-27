const ArcaplanetScraper = require('./src/scrapers/arcaplanet-scraper');
const fs = require('fs');
const path = require('path');
const logger = require('./src/utils/logger');

/**
 * Script di test finale per verificare che lo scraper generi file JSON senza duplicati
 */
async function testFinalValidation() {
  try {
    logger.info('Iniziando test di validazione finale');
    
    // Categoria da testare
    const category = 'cane/cibo-secco';
    const outputFile = path.join(__dirname, 'test-validation-no-duplicates.json');
    
    // Creazione istanza dello scraper
    const scraper = new ArcaplanetScraper({
      maxPages: 2,
      productsPerPage: 20,
      debug: true,
      headless: true
    });
    
    // Esecuzione dello scraping
    logger.info(`Esecuzione scraping sulla categoria: ${category}`);
    const products = await scraper.scrapeCategory(category, 1, 40);
    
    logger.info(`Recuperati ${products.length} prodotti`);
    
    // Salva i prodotti in un file JSON
    fs.writeFileSync(outputFile, JSON.stringify(products, null, 2));
    logger.info(`Prodotti salvati in: ${outputFile}`);
    
    // Verifica se ci sono duplicati
    let variantStats = {
      totalVariants: 0,
      uniqueVariantCount: 0,
      productCountWithDuplicates: 0,
      duplicatesFound: []
    };
    
    // Analizza ogni prodotto
    products.forEach(product => {
      // Conta le varianti totali
      const totalVariants = product.variants.length;
      variantStats.totalVariants += totalVariants;
      
      // Verifica se ci sono SKU duplicati
      const skus = new Set();
      const duplicateSkus = new Set();
      
      product.variants.forEach(variant => {
        if (skus.has(variant.sku)) {
          duplicateSkus.add(variant.sku);
        } else {
          skus.add(variant.sku);
        }
      });
      
      // Conta varianti uniche (dopo aver rimosso i duplicati)
      const uniqueVariants = skus.size;
      variantStats.uniqueVariantCount += uniqueVariants;
      
      // Se ci sono duplicati, registrali
      if (duplicateSkus.size > 0) {
        variantStats.productCountWithDuplicates++;
        variantStats.duplicatesFound.push({
          productId: product.id,
          title: product.title,
          duplicateSkus: Array.from(duplicateSkus)
        });
      }
    });
    
    // Risultati
    logger.info('=== RISULTATI VALIDAZIONE FINALE ===');
    logger.info(`Prodotti analizzati: ${products.length}`);
    logger.info(`Varianti totali: ${variantStats.totalVariants}`);
    logger.info(`Varianti uniche: ${variantStats.uniqueVariantCount}`);
    logger.info(`Prodotti con varianti duplicate: ${variantStats.productCountWithDuplicates}`);
    
    if (variantStats.productCountWithDuplicates > 0) {
      logger.warn('ATTENZIONE: Trovati prodotti con varianti duplicate!');
      variantStats.duplicatesFound.forEach(item => {
        logger.warn(`- Prodotto "${item.title}" (${item.productId}) ha SKU duplicati: ${item.duplicateSkus.join(', ')}`);
      });
      return false;
    } else {
      logger.info('SUCCESSO: Nessuna variante duplicata trovata!');
      return true;
    }
  } catch (error) {
    logger.error(`Errore durante il test: ${error.message}`);
    return false;
  } finally {
    logger.info('Test di validazione finale completato');
  }
}

// Esecuzione del test
testFinalValidation()
  .then(success => {
    if (success) {
      logger.info('✅ Validazione completata con successo! Lo scraper non genera più duplicati.');
      process.exit(0);
    } else {
      logger.error('❌ Validazione fallita! Lo scraper genera ancora duplicati.');
      process.exit(1);
    }
  })
  .catch(error => {
    logger.error(`Errore imprevisto: ${error.message}`);
    process.exit(1);
  }); 