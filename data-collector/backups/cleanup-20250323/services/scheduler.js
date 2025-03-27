const ZooplusScraper = require('../scrapers/zooplus-scraper');
const ArcaplanetScraper = require('../scrapers/arcaplanet-scraper');
const ProxyManager = require('../proxy/proxy-manager');
const UserAgentRotator = require('../proxy/user-agents');
const { zooplusCategoryPaths, arcaplanetCategoryPaths } = require('../../config/categories');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Importa i modelli di MongoDB
const Product = require('../models/product');
const PricePoint = require('../models/price-point');

/**
 * Esegue il task di scraping per tutti i siti configurati
 * @returns {Promise<void>}
 */
async function runScrapingTask() {
  logger.info('Avvio task di scraping');
  
  try {
    // Inizializza il gestore proxy e user agent
    const proxyManager = new ProxyManager();
    await proxyManager.initialize();
    
    const userAgentRotator = new UserAgentRotator();
    
    // Opzioni per gli scraper
    const scraperOptions = {
      proxyManager,
      userAgentRotator,
      minDelay: parseInt(process.env.MIN_DELAY) || 3000,
      maxDelay: parseInt(process.env.MAX_DELAY) || 7000,
      respectRobotsTxt: true
    };
    
    // Inizializza gli scraper
    const zooplusScraper = new ZooplusScraper(scraperOptions);
    const arcaplanetScraper = new ArcaplanetScraper(scraperOptions);
    
    // Esegui lo scraping per ogni categoria di Zooplus
    for (const category of zooplusCategoryPaths) {
      logger.info(`Scraping categoria Zooplus: ${category}`);
      
      try {
        const zooplusProducts = await zooplusScraper.fetchCategoryProducts(category);
        logger.info(`Trovati ${zooplusProducts.length} prodotti su Zooplus per la categoria ${category}`);
        await saveProducts(zooplusProducts, 'zooplus');
      } catch (error) {
        logger.error(`Errore durante lo scraping di Zooplus per la categoria ${category}: ${error.message}`);
      }
    }
    
    // Esegui lo scraping per ogni categoria di Arcaplanet
    for (const category of arcaplanetCategoryPaths) {
      logger.info(`Scraping categoria Arcaplanet: ${category}`);
      
      try {
        const arcaplanetProducts = await arcaplanetScraper.fetchCategoryProducts(category);
        logger.info(`Trovati ${arcaplanetProducts.length} prodotti su Arcaplanet per la categoria ${category}`);
        await saveProducts(arcaplanetProducts, 'arcaplanet');
      } catch (error) {
        logger.error(`Errore durante lo scraping di Arcaplanet per la categoria ${category}: ${error.message}`);
      }
    }
    
    logger.info('Task di scraping completato con successo');
  } catch (error) {
    logger.error(`Errore durante l'esecuzione del task di scraping: ${error.message}`);
    throw error;
  }
}

/**
 * Salva o aggiorna i prodotti nel database
 * @param {Array} products - Lista di prodotti da salvare
 * @param {String} source - Fonte dei prodotti (zooplus, arcaplanet)
 * @returns {Promise<void>}
 */
async function saveProducts(products, source) {
  for (const product of products) {
    try {
      // Verifica che il prodotto sia valido
      if (!product) {
        logger.warn(`Prodotto non valido (undefined) da ${source}`);
        continue;
      }
      
      // Verifica che il prodotto abbia un sourceId
      if (!product.sourceId) {
        logger.warn(`Prodotto senza sourceId da ${source}, salto`);
        continue;
      }
      
      // Determina il tipo di pet dalla categoria (con fallback sicuro)
      let petType = 'altro';
      
      if (product.category) {
        const categoryLower = product.category.toLowerCase();
        if (categoryLower.includes('cani') || categoryLower.includes('cane')) {
          petType = 'cane';
        } else if (categoryLower.includes('gatti') || categoryLower.includes('gatto')) {
          petType = 'gatto';
        }
      } else {
        // Se la categoria non è definita, prova a determinarla dall'URL o dal percorso
        const path = product.url || '';
        if (path.includes('cani') || path.includes('cane')) {
          petType = 'cane';
        } else if (path.includes('gatti') || path.includes('gatto')) {
          petType = 'gatto';
        }
        
        logger.warn(`Prodotto senza categoria da ${source}, determinato tipo: ${petType}`);
      }
      
      // Cerca il prodotto esistente
      const existingProduct = await Product.findOne({
        source: source,
        sourceId: product.sourceId
      });
      
      // Assicuriamoci che name e title siano definiti
      const productName = product.name || product.title || 'Prodotto senza nome';
      const productDescription = product.description || '';
      const productBrand = product.brand || '';
      const productCategory = product.category || `${petType}/altro`;
      const productImage = product.imageUrl || '';
      
      // Assicuriamoci che variants sia un array
      const productVariants = Array.isArray(product.variants) ? product.variants : [];
      
      if (existingProduct) {
        // Aggiorna il prodotto esistente
        existingProduct.name = productName;
        existingProduct.description = productDescription;
        existingProduct.imageUrl = productImage;
        existingProduct.rating = product.rating || 0;
        existingProduct.reviewCount = product.reviewCount || 0;
        existingProduct.updatedAt = new Date();
        
        // Assicuriamoci che gli array existingProduct.variants e existingProduct.prices esistano
        if (!Array.isArray(existingProduct.variants)) {
          logger.warn(`Prodotto ${productName} da ${source} con campo variants non valido, inizializzazione array vuoto`);
          existingProduct.variants = [];
        }
        
        if (!Array.isArray(existingProduct.prices)) {
          logger.warn(`Prodotto ${productName} da ${source} con campo prices non valido, inizializzazione array vuoto`);
          existingProduct.prices = [];
        }
        
        // Aggiorna varianti e prezzi
        if (productVariants.length > 0) {
          for (const variant of productVariants) {
            // Verifica che la variante abbia un ID
            if (!variant.variantId) {
              logger.warn(`Variante senza ID per ${productName} da ${source}, salto`);
              continue;
            }
            
            // Trova la variante esistente
            const existingVariant = existingProduct.variants.find(
              v => v.variantId === variant.variantId
            );
            
            if (existingVariant) {
              // Aggiorna la variante esistente
              existingVariant.description = variant.description || '';
              existingVariant.available = variant.available !== false;
              existingVariant.discounted = variant.discounted || false;
              existingVariant.discountAmount = variant.discountAmount || '';
              
              // Verifica se il prezzo è cambiato (con controlli di sicurezza)
              const existingPrice = existingProduct.prices.find(p => p.store === source);
              const currentPrice = variant.price?.current || 0;
              
              if (existingPrice && existingPrice.price !== currentPrice) {
                // Aggiorna il prezzo esistente
                existingPrice.price = currentPrice;
                existingPrice.lastUpdated = new Date();
                existingPrice.url = product.url || '';
                
                // Salva lo storico del prezzo
                await new PricePoint({
                  productId: existingProduct._id,
                  variantId: variant.variantId,
                  source: source,
                  price: {
                    amount: currentPrice,
                    currency: variant.price?.currency || 'EUR',
                    unitPrice: variant.price?.unitPrice || null,
                    discounted: variant.discounted || false,
                    discountAmount: variant.discountAmount || ''
                  }
                }).save();
                
                logger.info(`Aggiornato prezzo per ${productName} (${variant.variantId}) da ${source}`);
              }
            } else {
              // Aggiungi nuova variante
              existingProduct.variants.push({
                variantId: variant.variantId,
                description: variant.description || '',
                available: variant.available !== false,
                discounted: variant.discounted || false,
                discountAmount: variant.discountAmount || ''
              });
              
              // Salva lo storico del prezzo per la nuova variante
              await new PricePoint({
                productId: existingProduct._id,
                variantId: variant.variantId,
                source: source,
                price: {
                  amount: variant.price?.current || 0,
                  currency: variant.price?.currency || 'EUR',
                  unitPrice: variant.price?.unitPrice || null,
                  discounted: variant.discounted || false,
                  discountAmount: variant.discountAmount || ''
                }
              }).save();
              
              logger.info(`Aggiunta nuova variante per ${productName} (${variant.variantId}) da ${source}`);
            }
          }
        } else {
          logger.warn(`Prodotto ${productName} da ${source} senza varianti`);
        }
        
        await existingProduct.save();
        logger.info(`Aggiornato prodotto esistente: ${productName} da ${source}`);
      } else {
        // Se non ci sono varianti, creiamo una variante di default
        const defaultVariants = productVariants.length > 0 ? productVariants : [{
          variantId: `default-${Date.now()}`,
          description: '',
          price: { current: 0, currency: 'EUR' },
          available: true
        }];
        
        // Crea un nuovo prodotto
        const newProduct = new Product({
          name: productName,
          description: productDescription,
          brand: productBrand,
          category: productCategory,
          imageUrl: productImage,
          source: source,
          sourceId: product.sourceId,
          petType: petType,
          rating: product.rating || 0,
          reviewCount: product.reviewCount || 0,
          prices: [{
            store: source,
            price: defaultVariants[0].price?.current || 0,
            currency: defaultVariants[0].price?.currency || 'EUR',
            url: product.url || '',
            lastUpdated: new Date(),
            inStock: defaultVariants[0].available !== false
          }],
          variants: defaultVariants.map(variant => ({
            variantId: variant.variantId,
            description: variant.description || '',
            available: variant.available !== false,
            discounted: variant.discounted || false,
            discountAmount: variant.discountAmount || ''
          }))
        });
        
        await newProduct.save();
        
        // Salva lo storico dei prezzi per tutte le varianti
        for (const variant of defaultVariants) {
          await new PricePoint({
            productId: newProduct._id,
            variantId: variant.variantId,
            source: source,
            price: {
              amount: variant.price?.current || 0,
              currency: variant.price?.currency || 'EUR',
              unitPrice: variant.price?.unitPrice || null,
              discounted: variant.discounted || false,
              discountAmount: variant.discountAmount || ''
            }
          }).save();
        }
        
        logger.info(`Creato nuovo prodotto: ${productName} da ${source}`);
      }
    } catch (error) {
      const productTitle = product?.title || product?.name || 'sconosciuto';
      logger.error(`Errore durante il salvataggio del prodotto ${productTitle}: ${error.message}`);
      if (error.stack) {
        logger.debug(`Stack trace: ${error.stack}`);
      }
    }
  }
}

module.exports = { runScrapingTask, saveProducts };