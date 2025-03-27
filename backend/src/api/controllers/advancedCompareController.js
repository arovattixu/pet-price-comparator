/**
 * Advanced Compare Controller
 * Handles advanced price comparison functionality with unit price calculations
 */
const logger = require('../../utils/logger');
const Product = require('../../models/Product');
const ProductGroup = require('../../models/ProductGroup');
const priceNormalizer = require('../../utils/priceNormalizer');
const mongoose = require('mongoose');

/**
 * Compare products with unit price calculations
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const compareWithUnitPrices = async (req, res) => {
  try {
    const { productId } = req.params;
    
    logger.info(`Inizio confronto con prezzi unitari per il prodotto: ${productId}`);
    
    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      logger.warn(`Prodotto non trovato con ID: ${productId}`);
      return res.status(404).json({
        success: false,
        error: 'Prodotto non trovato'
      });
    }
    
    // Find similar products
    const similarProducts = await Product.find({
      brand: product.brand,
      category: product.category,
      _id: { $ne: productId }
    });
    
    logger.info(`Trovati ${similarProducts.length} prodotti simili per ${product.name}`);
    
    // Add the current product to the list
    const allProducts = [product, ...similarProducts];
    
    // Calculate unit prices for all products
    const productsWithUnitPrices = allProducts.map(p => {
      const weightStr = p.details?.weight || '';
      const pricePerKg = priceNormalizer.calculatePricePerKg(p.price, weightStr);
      
      return {
        _id: p._id,
        name: p.name,
        brand: p.brand,
        price: p.price,
        currency: p.currency,
        source: p.source,
        imageUrl: p.imageUrl,
        weight: weightStr,
        unitPrice: pricePerKg ? {
          value: pricePerKg,
          unit: 'EUR/kg',
          formattedValue: `${pricePerKg.toFixed(2)} €/kg`
        } : null
      };
    });
    
    // Group products by base product (ignoring size variations)
    const groupedProducts = priceNormalizer.groupProductsByBaseProduct(productsWithUnitPrices);
    
    logger.info(`Prodotti raggruppati in ${groupedProducts.length} gruppi di base`);
    
    return res.status(200).json({
      success: true,
      data: {
        originalProduct: {
          _id: product._id,
          name: product.name,
          price: product.price,
          weight: product.details?.weight || ''
        },
        groupedProducts,
        totalGroups: groupedProducts.length,
        totalProducts: productsWithUnitPrices.length
      }
    });
  } catch (error) {
    logger.error(`Error in compareWithUnitPrices: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante il confronto dei prodotti'
    });
  }
};

/**
 * Find the best value products in each product group
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const findBestValueByBrand = async (req, res) => {
  try {
    const { brand, category } = req.params;
    const { limit = 10 } = req.query;
    
    logger.info(`Ricerca prodotti con miglior valore per brand: ${brand}, categoria: ${category || 'All'}`);
    
    // Find products matching the criteria
    const products = await Product.find({
      brand,
      ...(category ? { category } : {})
    });
    
    if (products.length === 0) {
      logger.info(`Nessun prodotto trovato per brand: ${brand}, categoria: ${category || 'All'}`);
      return res.status(200).json({
        success: true,
        data: {
          brand,
          category: category || 'All',
          products: []
        }
      });
    }
    
    logger.info(`Trovati ${products.length} prodotti per brand: ${brand}`);
    
    // Calculate unit prices and group products
    const productsWithUnitPrices = products.map(p => {
      const weightStr = p.details?.weight || '';
      const pricePerKg = priceNormalizer.calculatePricePerKg(p.price, weightStr);
      
      return {
        _id: p._id,
        name: p.name,
        brand: p.brand,
        category: p.category,
        price: p.price,
        source: p.source,
        imageUrl: p.imageUrl,
        weight: weightStr,
        unitPrice: pricePerKg ? {
          value: pricePerKg,
          unit: 'EUR/kg',
          formattedValue: `${pricePerKg.toFixed(2)} €/kg`
        } : null
      };
    });
    
    // Group products
    const groupedProducts = priceNormalizer.groupProductsByBaseProduct(productsWithUnitPrices);
    
    // Extract best value product from each group
    const bestValueProducts = groupedProducts
      .filter(group => group.bestValue && group.bestValue.unitPrice && group.bestValue.unitPrice.value)
      .map(group => ({
        baseProduct: group.baseProduct,
        bestValue: group.bestValue,
        priceRange: group.priceRange,
        unitPriceRange: group.unitPriceRange,
        variantCount: group.variants.length
      }))
      .sort((a, b) => a.bestValue.unitPrice.value - b.bestValue.unitPrice.value)
      .slice(0, parseInt(limit));
    
    logger.info(`Identificati ${bestValueProducts.length} prodotti con miglior valore in ${groupedProducts.length} gruppi`);
    
    return res.status(200).json({
      success: true,
      data: {
        brand,
        category: category || 'All',
        groupCount: groupedProducts.length,
        bestValueProducts
      }
    });
  } catch (error) {
    logger.error(`Error in findBestValueByBrand: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante la ricerca dei prodotti con miglior rapporto qualità-prezzo'
    });
  }
};

/**
 * Compare products across different sizes and find the best value
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const compareSizes = async (req, res) => {
  try {
    const { namePattern } = req.query;
    
    if (!namePattern || namePattern.length < 3) {
      logger.warn(`Pattern di ricerca troppo corto: ${namePattern}`);
      return res.status(400).json({
        success: false,
        error: 'È necessario fornire un pattern di nome prodotto di almeno 3 caratteri'
      });
    }
    
    logger.info(`Confronto dimensioni per pattern: ${namePattern}`);
    
    // Verifica lo stato della connessione al database
    if (mongoose.connection.readyState !== 1) {
      logger.error(`Tentativo di query al database con connessione non attiva. Stato: ${mongoose.connection.readyState}`);
      return res.status(503).json({
        success: false,
        error: 'Database temporaneamente non disponibile. Riprova tra qualche secondo.'
      });
    }
    
    // Imposta un timeout di 20 secondi per la query
    const dbQuery = Product.find({
      $text: { 
        $search: namePattern 
      }
    }).sort({ score: { $meta: 'textScore' } }).limit(20);
    
    // Esegui la query con un timeout esplicito
    const products = await Promise.race([
      dbQuery.exec(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout dopo 20 secondi')), 20000)
      )
    ]);
    
    if (products.length === 0) {
      logger.info(`Nessun prodotto trovato per pattern: ${namePattern}`);
      return res.status(200).json({
        success: true,
        data: {
          namePattern,
          products: []
        }
      });
    }
    
    logger.info(`Trovati ${products.length} prodotti per pattern: ${namePattern}`);
    
    // Calculate unit prices for all products
    const productsWithUnitPrices = products.map(p => {
      // Extract weight from product details or name
      const weightStr = p.details?.weight || '';
      let extractedWeight = weightStr;
      
      // If weight not found in details, try to extract from name
      if (!weightStr) {
        const weightMatch = p.name.match(/(\d+[\d.]*\s*(g|kg|ml|l|lb|oz))/i);
        if (weightMatch) extractedWeight = weightMatch[0];
      }
      
      // Calculate price per kg
      const pricePerKg = priceNormalizer.calculatePricePerKg(p.price, extractedWeight);
      
      return {
        _id: p._id,
        name: p.name,
        brand: p.brand || 'Sconosciuto', // Ensure brand is never null
        price: p.price,
        currency: p.currency || 'EUR', // Default to EUR if missing
        source: p.source,
        imageUrl: p.imageUrl,
        weight: extractedWeight,
        unitPrice: pricePerKg ? {
          value: pricePerKg,
          unit: 'EUR/kg',
          formattedValue: `${pricePerKg.toFixed(2)} €/kg`
        } : null
      };
    });
    
    // Filter out products without valid unit prices
    const validProducts = productsWithUnitPrices.filter(p => p.unitPrice && p.unitPrice.value);
    
    if (validProducts.length === 0) {
      logger.info(`Nessun prodotto con prezzo unitario valido trovato per pattern: ${namePattern}`);
      return res.status(200).json({
        success: true,
        data: {
          namePattern,
          message: 'Nessun prodotto con informazioni di peso valide trovato',
          products: []
        }
      });
    }
    
    // Group by brand to organize the results
    const productsByBrand = {};
    validProducts.forEach(p => {
      if (!productsByBrand[p.brand]) {
        productsByBrand[p.brand] = [];
      }
      productsByBrand[p.brand].push(p);
    });
    
    // For each brand, identify the best value
    const result = Object.entries(productsByBrand).map(([brand, products]) => {
      // Sort by unit price
      const sortedProducts = [...products].sort((a, b) => a.unitPrice.value - b.unitPrice.value);
      
      const bestValue = sortedProducts.length > 0 ? sortedProducts[0] : null;
      
      return {
        brand,
        products: sortedProducts,
        bestValue,
        productCount: products.length,
        priceRange: {
          min: Math.min(...products.map(p => p.price)),
          max: Math.max(...products.map(p => p.price))
        },
        unitPriceRange: {
          min: Math.min(...sortedProducts.map(p => p.unitPrice.value)),
          max: Math.max(...sortedProducts.map(p => p.unitPrice.value))
        }
      };
    });
    
    logger.info(`Prodotti raggruppati per ${result.length} brand`);
    
    return res.status(200).json({
      success: true,
      data: {
        namePattern,
        brandCount: result.length,
        productCount: validProducts.length,
        brandComparison: result
      }
    });
  } catch (error) {
    // Gestione specifica per timeout
    if (error.message && error.message.includes('timeout')) {
      logger.error(`Timeout nella query compareSizes: ${error.message}`);
      return res.status(503).json({
        success: false,
        error: 'La ricerca dei prodotti ha impiegato troppo tempo. Riprova tra qualche istante.'
      });
    }
    
    // Gestione specifica per errori di connessione
    if (error.name === 'MongoNetworkError' || (error.message && error.message.includes('buffering timed out'))) {
      logger.error(`Errore di connessione MongoDB in compareSizes: ${error.message}`);
      return res.status(503).json({
        success: false,
        error: 'Errore di connessione al database. Riprova tra qualche istante.'
      });
    }
    
    logger.error(`Error in compareSizes: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante il confronto delle dimensioni dei prodotti'
    });
  }
};

/**
 * Update unit prices for all products
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateAllUnitPrices = async (req, res) => {
  try {
    // This is an administrative function, can be protected with auth middleware
    const { limit = 1000 } = req.query;
    
    logger.info(`Avvio aggiornamento prezzi unitari per ${limit} prodotti`);
    
    // Find products
    const products = await Product.find({}).limit(parseInt(limit));
    
    let updated = 0;
    let failed = 0;
    const errors = [];
    
    // Process products in batches to prevent timeouts
    const batchSize = 100;
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      
      logger.info(`Elaborazione batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(products.length/batchSize)}, ${batch.length} prodotti`);
      
      const updates = batch.map(product => {
        try {
          // Try to get weight from details or extract from product name
          let weightStr = product.details?.weight || '';
          
          if (!weightStr) {
            const weightMatch = product.name.match(/(\d+[\d.]*\s*(g|kg|ml|l|lb|oz))/i);
            if (weightMatch) weightStr = weightMatch[0];
          }
          
          // Extract weight components
          const weightObj = priceNormalizer.extractWeight(weightStr);
          
          if (weightObj) {
            const pricePerKg = priceNormalizer.calculatePricePerKg(product.price, weightStr);
            
            // Update the product
            return {
              updateOne: {
                filter: { _id: product._id },
                update: {
                  $set: {
                    unitPrice: {
                      value: pricePerKg,
                      unit: 'EUR/kg',
                      calculatedAt: new Date()
                    },
                    packageInfo: {
                      weight: {
                        value: weightObj.value,
                        unit: weightObj.unit,
                        original: weightStr
                      }
                    }
                  }
                }
              }
            };
          }
          
          failed++;
          errors.push(`No weight found for product ${product._id}`);
          return null;
        } catch (error) {
          failed++;
          errors.push(`Error processing product ${product._id}: ${error.message}`);
          return null;
        }
      }).filter(Boolean);
      
      if (updates.length > 0) {
        const result = await Product.bulkWrite(updates);
        updated += result.modifiedCount;
        logger.info(`Aggiornati ${result.modifiedCount} prodotti nel batch`);
      }
    }
    
    logger.info(`Aggiornamento completato: ${updated} prodotti aggiornati, ${failed} falliti`);
    
    return res.status(200).json({
      success: true,
      data: {
        totalProcessed: products.length,
        updated,
        failed,
        errors: errors.slice(0, 10) // Return only first 10 errors
      }
    });
  } catch (error) {
    logger.error(`Error in updateAllUnitPrices: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante l\'aggiornamento dei prezzi unitari'
    });
  }
};

/**
 * Update product groups in the database
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateProductGroups = async (req, res) => {
  try {
    logger.info('Avvio aggiornamento gruppi di prodotti');
    
    // Verifica lo stato della connessione al database
    if (mongoose.connection.readyState !== 1) {
      logger.error(`Tentativo di aggiornare gruppi di prodotti con connessione non attiva. Stato: ${mongoose.connection.readyState}`);
      return res.status(503).json({
        success: false,
        error: 'Database temporaneamente non disponibile. Riprova tra qualche secondo.'
      });
    }
    
    // Get all products with timeout
    const dbQuery = Product.find({});
    
    // Esegui la query con un timeout esplicito
    const products = await Promise.race([
      dbQuery.exec(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout dopo 30 secondi')), 30000)
      )
    ]);
    
    logger.info(`Trovati ${products.length} prodotti da raggruppare`);
    
    if (products.length === 0) {
      logger.warn('Nessun prodotto trovato nel database');
      return res.status(200).json({
        success: true,
        data: {
          message: 'Nessun prodotto trovato nel database',
          created: 0,
          updated: 0,
          skipped: 0,
          totalGroups: 0
        }
      });
    }
    
    // Prepare product groups
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    // Group products by base name and brand
    const processedIds = new Set();
    const groups = {};
    
    // First pass - group products
    for (const product of products) {
      try {
        if (!product.brand) {
          logger.debug(`Prodotto ${product._id} saltato: brand mancante`);
          continue; // Skip products without brand
        }
        
        if (!product.name) {
          logger.debug(`Prodotto ${product._id} saltato: nome mancante`);
          continue; // Skip products without name
        }
        
        // Clean name by removing weight mentions
        const cleanName = product.name.replace(/\d+\s*(g|kg|ml|l|lb|oz)(\s|$)/gi, ' ').trim();
        if (!cleanName) {
          logger.debug(`Prodotto ${product._id} saltato: nome pulito vuoto`);
          continue;
        }
        
        const key = `${product.brand}___${cleanName}`.toLowerCase();
        
        if (!groups[key]) {
          groups[key] = {
            baseProduct: {
              name: cleanName,
              brand: product.brand,
              category: product.category || 'Sconosciuta',
              petType: product.petType || 'Sconosciuto'
            },
            variants: []
          };
        }
        
        // Add to variants
        const weightStr = product.details?.weight || '';
        const pricePerKg = priceNormalizer.calculatePricePerKg(product.price, weightStr);
        const weightObj = priceNormalizer.extractWeight(weightStr);
        
        if (pricePerKg && weightObj) {
          groups[key].variants.push({
            productId: product._id,
            size: weightStr,
            weight: {
              value: weightObj.value,
              unit: weightObj.unit
            },
            price: product.price,
            unitPrice: {
              value: pricePerKg,
              unit: 'EUR/kg'
            },
            bestValue: false // Will be set later
          });
        } else {
          logger.debug(`Prodotto ${product._id} non aggiunto al gruppo: impossibile estrarre peso o calcolare prezzo unitario`);
        }
      } catch (error) {
        logger.error(`Errore nell'elaborazione del prodotto ${product._id}: ${error.message}`);
        errors++;
      }
    }
    
    const totalGroups = Object.keys(groups).length;
    logger.info(`Creati ${totalGroups} gruppi potenziali`);
    
    if (totalGroups === 0) {
      logger.warn('Nessun gruppo di prodotti creato');
      return res.status(200).json({
        success: true,
        data: {
          message: 'Nessun gruppo di prodotti creato',
          created: 0,
          updated: 0,
          skipped: 0,
          errors: errors,
          totalGroups: 0
        }
      });
    }
    
    // Utilizza Promise.all con un array di promesse di dimensione controllata (batch processing)
    const batchSize = 10; // Processa 10 gruppi alla volta
    const groupKeys = Object.keys(groups);
    const batches = [];
    
    // Divide i gruppi in batch
    for (let i = 0; i < groupKeys.length; i += batchSize) {
      batches.push(groupKeys.slice(i, i + batchSize));
    }
    
    // Processa ogni batch sequenzialmente
    for (const batch of batches) {
      await Promise.all(batch.map(async (key) => {
        try {
          const group = groups[key];
          
          // Skip groups with less than 2 variants
          if (!group.variants || group.variants.length < 2) {
            logger.debug(`Gruppo ${key} saltato: meno di 2 varianti`);
            skipped++;
            return;
          }
          
          // Sort variants by unit price
          group.variants.sort((a, b) => a.unitPrice.value - b.unitPrice.value);
          
          // Set best value flag
          if (group.variants.length > 0) {
            group.variants[0].bestValue = true;
          }
          
          // Calculate price ranges
          const prices = group.variants.map(v => v.price);
          const unitPrices = group.variants.map(v => v.unitPrice.value);
          
          if (prices.length === 0 || unitPrices.length === 0) {
            logger.warn(`Gruppo ${key} saltato: nessun prezzo valido`);
            skipped++;
            return;
          }
          
          const priceRange = {
            min: Math.min(...prices),
            max: Math.max(...prices),
            unitMin: Math.min(...unitPrices),
            unitMax: Math.max(...unitPrices)
          };
          
          // Validate price range values
          if (isNaN(priceRange.min) || isNaN(priceRange.max) || 
              isNaN(priceRange.unitMin) || isNaN(priceRange.unitMax)) {
            logger.warn(`Gruppo ${key} saltato: valori di prezzo non validi`);
            skipped++;
            return;
          }
          
          const bestValue = {
            productId: group.variants[0].productId,
            price: group.variants[0].price,
            unitPrice: group.variants[0].unitPrice.value,
            size: group.variants[0].size
          };
          
          // Check if group exists with timeout
          const existingGroup = await Promise.race([
            ProductGroup.findOne({
              'baseProduct.brand': group.baseProduct.brand,
              'baseProduct.name': group.baseProduct.name
            }).exec(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Query timeout durante la ricerca del gruppo esistente')), 10000)
            )
          ]);
          
          if (existingGroup) {
            // Update existing group
            existingGroup.variants = group.variants;
            existingGroup.priceRange = priceRange;
            existingGroup.bestValue = bestValue;
            existingGroup.variantCount = group.variants.length;
            existingGroup.hasCompleteData = true;
            existingGroup.lastUpdated = new Date();
            
            await Promise.race([
              existingGroup.save(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout durante il salvataggio del gruppo esistente')), 10000)
              )
            ]);
            
            updated++;
            logger.debug(`Gruppo ${key} aggiornato con ${group.variants.length} varianti`);
          } else {
            // Create new group
            const productGroup = new ProductGroup({
              baseProduct: group.baseProduct,
              variants: group.variants,
              priceRange,
              bestValue,
              variantCount: group.variants.length,
              hasCompleteData: true,
              lastUpdated: new Date()
            });
            
            await Promise.race([
              productGroup.save(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout durante il salvataggio del nuovo gruppo')), 10000)
              )
            ]);
            
            created++;
            logger.debug(`Gruppo ${key} creato con ${group.variants.length} varianti`);
          }
          
          // Update product references with timeout
          const variants = group.variants.map(v => v.productId);
          await Promise.race([
            Product.updateMany(
              { _id: { $in: variants } },
              { 
                $set: { 
                  'productGroup.baseProductId': group.variants[0].productId,
                  'productGroup.isBaseProduct': false
                } 
              }
            ).exec(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout durante l\'aggiornamento dei riferimenti prodotto')), 15000)
            )
          ]);
          
          // Set first product as base product with timeout
          await Promise.race([
            Product.updateOne(
              { _id: group.variants[0].productId },
              { $set: { 'productGroup.isBaseProduct': true } }
            ).exec(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout durante l\'impostazione del prodotto base')), 10000)
            )
          ]);
          
        } catch (error) {
          logger.error(`Errore nell'elaborazione del gruppo ${key}: ${error.message}`);
          errors++;
        }
      }));
      
      // Aggiunta di un breve ritardo tra i batch per evitare sovraccarichi
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    logger.info(`Aggiornamento gruppi completato: ${created} creati, ${updated} aggiornati, ${skipped} saltati, ${errors} errori`);
    
    return res.status(200).json({
      success: true,
      data: {
        created,
        updated,
        skipped,
        errors,
        totalGroups: created + updated
      }
    });
  } catch (error) {
    // Gestione specifica per timeout
    if (error.message && error.message.includes('timeout')) {
      logger.error(`Timeout nella operazione updateProductGroups: ${error.message}`);
      return res.status(503).json({
        success: false,
        error: 'L\'operazione ha impiegato troppo tempo. Riprova tra qualche istante con meno dati.'
      });
    }
    
    // Gestione specifica per errori di connessione
    if (error.name === 'MongoNetworkError' || (error.message && error.message.includes('buffering timed out'))) {
      logger.error(`Errore di connessione MongoDB in updateProductGroups: ${error.message}`);
      return res.status(503).json({
        success: false,
        error: 'Errore di connessione al database. Riprova tra qualche istante.'
      });
    }
    
    logger.error(`Error in updateProductGroups: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante l\'aggiornamento dei gruppi di prodotti'
    });
  }
};

module.exports = {
  compareWithUnitPrices,
  findBestValueByBrand,
  compareSizes,
  updateAllUnitPrices,
  updateProductGroups
}; 