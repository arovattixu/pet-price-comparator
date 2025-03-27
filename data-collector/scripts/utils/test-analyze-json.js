const fs = require('fs');
const path = require('path');
const logger = require('./src/utils/logger');

/**
 * Script per analizzare un file JSON esistente e verificare se ci sono varianti duplicate
 */
function analyzeJSON(filePath) {
  try {
    logger.info(`Analisi file: ${filePath}`);
    
    // Leggi il file JSON
    if (!fs.existsSync(filePath)) {
      logger.error(`File non trovato: ${filePath}`);
      return false;
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const products = JSON.parse(fileContent);
    
    logger.info(`Analisi di ${products.length} prodotti`);
    
    // Statistiche per i duplicati
    let variantStats = {
      totalVariants: 0,
      uniqueVariantCount: 0,
      productCountWithDuplicates: 0,
      duplicatesFound: []
    };
    
    // Analizza ogni prodotto
    products.forEach(product => {
      // Skip se non ha varianti
      if (!product.variants || !Array.isArray(product.variants)) {
        logger.warn(`Prodotto ${product.id || 'sconosciuto'} senza varianti valide`);
        return;
      }
      
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
    logger.info('=== RISULTATI ANALISI DUPLICATI ===');
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
    
    return variantStats.productCountWithDuplicates === 0;
  } catch (error) {
    logger.error(`Errore durante l'analisi: ${error.message}`);
    return false;
  }
}

// File da analizzare (usa il primo argomento da riga di comando o il valore di default)
const defaultFile = path.join(__dirname, 'results/arcaplanet/cane-cibo-secco-products.json');
const fileToAnalyze = process.argv[2] || defaultFile;

// Esecuzione dell'analisi
const success = analyzeJSON(fileToAnalyze);

if (success) {
  logger.info('✅ Analisi completata con successo! Non sono stati trovati duplicati.');
  process.exit(0);
} else {
  logger.error('❌ Analisi completata. Sono stati trovati duplicati o si sono verificati errori.');
  process.exit(1);
} 