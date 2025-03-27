const fs = require('fs');
const path = require('path');
const logger = require('./src/utils/logger');

/**
 * Verifica la qualità dei dati nei file JSON di Arcaplanet
 * per assicurarsi che siano compatibili con lo schema del database
 */
async function verifyJsonQuality(filePath) {
  logger.info(`Verifico qualità dei dati in: ${filePath}`);
  
  try {
    // Leggi il file JSON
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (!Array.isArray(data)) {
      logger.error(`Il file non contiene un array di prodotti: ${filePath}`);
      return {
        valid: false,
        errors: ['Il file non contiene un array di prodotti']
      };
    }
    
    logger.info(`File contiene ${data.length} prodotti`);
    
    // Statistiche
    const stats = {
      totalProducts: data.length,
      productsWithMissingFields: 0,
      productsWithoutTitle: 0,
      productsWithoutBrand: 0,
      productsWithoutPrice: 0,
      productsWithoutId: 0,
      productsWithoutSku: 0,
      productsWithoutImages: 0,
      productsWithoutCategories: 0,
      productsWithDuplicateVariants: 0,
      duplicateSkus: new Set(),
      totalDuplicates: 0
    };
    
    // Verifica campi obbligatori e qualità dati
    for (const product of data) {
      let hasMissingFields = false;
      
      // Verifica ID e SKU
      if (!product.id && !product.sourceId) {
        stats.productsWithoutId++;
        hasMissingFields = true;
      }
      
      if (!product.sku) {
        stats.productsWithoutSku++;
        hasMissingFields = true;
      }
      
      // Verifica titolo
      if (!product.title) {
        stats.productsWithoutTitle++;
        hasMissingFields = true;
      }
      
      // Verifica brand
      if (!product.brand) {
        stats.productsWithoutBrand++;
        hasMissingFields = true;
      }
      
      // Verifica prezzo
      if (!product.price || (typeof product.price === 'object' && !product.price.current)) {
        stats.productsWithoutPrice++;
        hasMissingFields = true;
      }
      
      // Verifica immagini
      if (!product.images || !Array.isArray(product.images) || product.images.length === 0) {
        stats.productsWithoutImages++;
        hasMissingFields = true;
      }
      
      // Verifica categorie
      if (!product.categories || !Array.isArray(product.categories) || product.categories.length === 0) {
        stats.productsWithoutCategories++;
        hasMissingFields = true;
      }
      
      // Verifica duplicati nelle varianti
      if (product.variants && Array.isArray(product.variants)) {
        const variantSkus = new Set();
        const duplicates = [];
        
        for (const variant of product.variants) {
          if (variant.sku) {
            if (variantSkus.has(variant.sku)) {
              duplicates.push(variant.sku);
              stats.totalDuplicates++;
              stats.duplicateSkus.add(variant.sku);
            } else {
              variantSkus.add(variant.sku);
            }
          }
        }
        
        if (duplicates.length > 0) {
          stats.productsWithDuplicateVariants++;
          logger.warn(`Prodotto ${product.title} (${product.id}) ha varianti duplicate: ${duplicates.join(', ')}`);
        }
      }
      
      if (hasMissingFields) {
        stats.productsWithMissingFields++;
      }
    }
    
    // Converti il Set di SKU duplicati in un array per il log
    stats.duplicateSkus = Array.from(stats.duplicateSkus);
    
    logger.info('Statistiche qualità dati:');
    logger.info(`Totale prodotti: ${stats.totalProducts}`);
    logger.info(`Prodotti con campi mancanti: ${stats.productsWithMissingFields}`);
    logger.info(`Prodotti senza titolo: ${stats.productsWithoutTitle}`);
    logger.info(`Prodotti senza brand: ${stats.productsWithoutBrand}`);
    logger.info(`Prodotti senza prezzo: ${stats.productsWithoutPrice}`);
    logger.info(`Prodotti senza ID: ${stats.productsWithoutId}`);
    logger.info(`Prodotti senza SKU: ${stats.productsWithoutSku}`);
    logger.info(`Prodotti senza immagini: ${stats.productsWithoutImages}`);
    logger.info(`Prodotti senza categorie: ${stats.productsWithoutCategories}`);
    logger.info(`Prodotti con varianti duplicate: ${stats.productsWithDuplicateVariants}`);
    logger.info(`Totale duplicati: ${stats.totalDuplicates}`);
    
    // Verifica compatibilità con lo schema del database
    logger.info('Verifica compatibilità con schema database...');
    const schemaCompatibility = verifySchemaCompatibility(data);
    
    return {
      valid: stats.productsWithMissingFields === 0 && stats.productsWithDuplicateVariants === 0,
      stats,
      schemaCompatibility
    };
  } catch (error) {
    logger.error(`Errore durante la verifica del file JSON: ${error.message}`);
    return {
      valid: false,
      errors: [`Errore durante la verifica: ${error.message}`]
    };
  }
}

/**
 * Verifica la compatibilità con lo schema del database
 */
function verifySchemaCompatibility(products) {
  let sampleProduct = null;
  
  // Prendi un prodotto di esempio per verificare la mappatura
  if (products.length > 0) {
    sampleProduct = products[0];
  }
  
  if (!sampleProduct) {
    return {
      compatible: false,
      errors: ['Nessun prodotto disponibile per verifica schema']
    };
  }
  
  // Verifica che i campi essenziali possano essere estratti
  const mappingErrors = [];
  
  // Verifica source
  if (sampleProduct.source !== 'arcaplanet' && !sampleProduct.store) {
    mappingErrors.push('Campo "source" non trovato o non mappabile');
  }
  
  // Verifica sourceId
  if (!sampleProduct.id && !sampleProduct.sourceId && !sampleProduct.sku) {
    mappingErrors.push('Campo "sourceId" non trovato o non mappabile');
  }
  
  // Verifica name
  if (!sampleProduct.title && !sampleProduct.name) {
    mappingErrors.push('Campo "name" non trovato o non mappabile');
  }
  
  // Verifica prezzo
  let priceExtractable = false;
  
  if (typeof sampleProduct.price === 'number') {
    priceExtractable = true;
  } else if (sampleProduct.price && typeof sampleProduct.price === 'object') {
    if (sampleProduct.price.current || sampleProduct.price.metaPropPrice) {
      priceExtractable = true;
    }
  }
  
  if (!priceExtractable) {
    mappingErrors.push('Campo "price" non trovato o non mappabile');
  }
  
  // Risultato della verifica di compatibilità
  return {
    compatible: mappingErrors.length === 0,
    errors: mappingErrors,
    sampleProductFields: Object.keys(sampleProduct),
    suggestedMapping: {
      source: 'arcaplanet',
      sourceId: sampleProduct.id || sampleProduct.sourceId || sampleProduct.sku,
      name: sampleProduct.title || sampleProduct.name,
      brand: typeof sampleProduct.brand === 'string' ? sampleProduct.brand : (sampleProduct.brand ? sampleProduct.brand.name : ''),
      category: sampleProduct.categories && sampleProduct.categories.length > 0 ? sampleProduct.categories[0].path : '',
      imageUrl: sampleProduct.images && sampleProduct.images.length > 0 ? sampleProduct.images[0] : '',
      price: typeof sampleProduct.price === 'number' ? sampleProduct.price : 
             (sampleProduct.price && sampleProduct.price.current ? parseFloat(sampleProduct.price.current) : 0),
      url: sampleProduct.url || `https://www.arcaplanet.it/p/${sampleProduct.slug || sampleProduct.id}`
    }
  };
}

// Esecuzione dello script se chiamato direttamente
if (require.main === module) {
  if (process.argv.length < 3) {
    console.log('Uso: node verify-json-quality.js <path-to-json-file>');
    process.exit(1);
  }
  
  const filePath = process.argv[2];
  
  verifyJsonQuality(filePath)
    .then(result => {
      if (result.valid) {
        logger.info('Verifica completata: i dati sono validi e compatibili');
        
        // Aggiungi dettagli sulla compatibilità dello schema
        if (result.schemaCompatibility.compatible) {
          logger.info('Schema compatibile con il database');
          logger.info('Campi disponibili nel prodotto di esempio: ' + JSON.stringify(result.schemaCompatibility.sampleProductFields));
          logger.info('Mappatura suggerita: ' + JSON.stringify(result.schemaCompatibility.suggestedMapping, null, 2));
        } else {
          logger.warn('Schema non completamente compatibile con il database');
          logger.warn('Errori di mappatura: ' + JSON.stringify(result.schemaCompatibility.errors));
        }
        
        process.exit(0);
      } else {
        logger.warn('Verifica completata: i dati hanno problemi di qualità');
        process.exit(1);
      }
    })
    .catch(error => {
      logger.error(`Errore durante l'esecuzione: ${error.message}`);
      process.exit(1);
    });
} 