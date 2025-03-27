const ArcaplanetScraper = require('./src/scrapers/arcaplanet-scraper');
const fs = require('fs');
const path = require('path');
const logger = require('./src/utils/logger');

/**
 * Script di test per verificare la correzione della duplicazione delle varianti
 */
async function testFixDuplicates() {
  try {
    logger.info('Iniziando test per verificare la correzione della duplicazione delle varianti');
    
    // Creazione istanza dello scraper con opzioni limitate per il test
    const scraper = new ArcaplanetScraper({
      maxPages: 1,
      productsPerPage: 20,
      debug: true,
      headless: true
    });
    
    // Esecuzione dello scraping su una categoria test
    const category = 'cane/cibo-secco';
    logger.info(`Esecuzione scraping sulla categoria: ${category}`);
    
    // Limita a 20 prodotti per velocizzare il test
    const products = await scraper.scrapeCategory(category, 1, 20);
    
    logger.info(`Recuperati ${products.length} prodotti`);
    
    // Controlla le varianti duplicate
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
    logger.info('=== RISULTATI TEST DUPLICAZIONE VARIANTI ===');
    logger.info(`Prodotti analizzati: ${products.length}`);
    logger.info(`Varianti totali: ${variantStats.totalVariants}`);
    logger.info(`Varianti uniche: ${variantStats.uniqueVariantCount}`);
    logger.info(`Prodotti con varianti duplicate: ${variantStats.productCountWithDuplicates}`);
    
    if (variantStats.productCountWithDuplicates > 0) {
      logger.warn('ATTENZIONE: Trovati prodotti con varianti duplicate!');
      variantStats.duplicatesFound.forEach(item => {
        logger.warn(`- Prodotto "${item.title}" (${item.productId}) ha SKU duplicati: ${item.duplicateSkus.join(', ')}`);
      });
    } else {
      logger.info('SUCCESSO: Nessuna variante duplicata trovata!');
    }
    
    // Salva i risultati e i prodotti per verifica
    const testResults = {
      timestamp: new Date().toISOString(),
      stats: variantStats,
      products: products
    };
    
    const outputPath = path.join(__dirname, 'test-fix-duplicates-results.json');
    fs.writeFileSync(outputPath, JSON.stringify(testResults, null, 2));
    
    logger.info(`Risultati completi salvati in: ${outputPath}`);
    
    return variantStats.productCountWithDuplicates === 0;
  } catch (error) {
    logger.error(`Errore durante il test: ${error.message}`);
    return false;
  } finally {
    // Chiusura
    logger.info('Test completato');
  }
}

// Esecuzione del test
testFixDuplicates()
  .then(success => {
    if (success) {
      logger.info('✅ Test completato con successo! La correzione funziona.');
      process.exit(0);
    } else {
      logger.error('❌ Test fallito! La correzione non funziona completamente.');
      process.exit(1);
    }
  })
  .catch(error => {
    logger.error(`Errore imprevisto: ${error.message}`);
    process.exit(1);
  }); 