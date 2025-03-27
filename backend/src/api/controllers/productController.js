const Product = require('../../db/models/Product');
const logger = require('../../utils/logger');
const PricePoint = require('../../db/models/PricePoint');
const SimilarProduct = require('../../db/models/SimilarProduct');
const { clearCache } = require('../../utils/cache');

/**
 * Product Controller
 * Handles product-related functionality
 */

/**
 * Get all products with pagination and filtering
 */
const getAllProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Build filter from query parameters
    const filter = {};
    
    if (req.query.petType) {
      filter.petType = req.query.petType;
    }
    
    if (req.query.category) {
      filter.category = req.query.category;
    }
    
    if (req.query.brand) {
      filter.brand = req.query.brand;
    }
    
    if (req.query.source) {
      filter.source = req.query.source;
    }
    
    if (req.query.minPrice || req.query.maxPrice) {
      filter.price = {};
      
      if (req.query.minPrice) {
        filter.price.$gte = parseFloat(req.query.minPrice);
      }
      
      if (req.query.maxPrice) {
        filter.price.$lte = parseFloat(req.query.maxPrice);
      }
    }
    
    // Build sort options
    let sortOption = {};
    
    if (req.query.sort) {
      const sortField = req.query.sort.startsWith('-') ? req.query.sort.substring(1) : req.query.sort;
      const sortOrder = req.query.sort.startsWith('-') ? -1 : 1;
      sortOption[sortField] = sortOrder;
    } else {
      // Default sort by updatedAt
      sortOption = { updatedAt: -1 };
    }
    
    // Count total matching documents
    const total = await Product.countDocuments(filter);
    
    // Get paginated results
    const products = await Product.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .select('name brand petType category price imageUrl source lastPriceUpdate');
    
    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    
    return res.status(200).json({
      success: true,
      count: products.length,
      total,
      page,
      totalPages,
      hasMore: page < totalPages,
      data: products
    });
  } catch (error) {
    logger.error(`Error in getAllProducts: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante il recupero dei prodotti'
    });
  }
};

/**
 * Get a single product by ID
 */
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Prodotto non trovato'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    logger.error(`Error in getProductById: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante il recupero del prodotto'
    });
  }
};

/**
 * Search products by text query
 */
const searchProducts = async (req, res) => {
  try {
    const { q, petType, category, limit = 20 } = req.query;
    
    if (!q || q.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'La query di ricerca deve contenere almeno 3 caratteri'
      });
    }
    
    // Build search filter
    const filter = {
      $text: { $search: q }
    };
    
    if (petType) {
      filter.petType = petType;
    }
    
    if (category) {
      filter.category = category;
    }
    
    // Execute search
    const products = await Product.find(filter, {
      score: { $meta: 'textScore' }
    })
      .sort({ score: { $meta: 'textScore' } })
      .limit(parseInt(limit))
      .select('name brand petType category price imageUrl source lastPriceUpdate');
    
    return res.status(200).json({
      success: true,
      count: products.length,
      query: q,
      data: products
    });
  } catch (error) {
    logger.error(`Error in searchProducts: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante la ricerca dei prodotti'
    });
  }
};

/**
 * Get products by category
 */
const getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { limit = 20, page = 1 } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Count total products in this category
    const total = await Product.countDocuments({ category });
    
    // Get products
    const products = await Product.find({ category })
      .sort({ price: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('name brand petType price imageUrl source lastPriceUpdate');
    
    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    
    return res.status(200).json({
      success: true,
      count: products.length,
      total,
      page: parseInt(page),
      totalPages,
      hasMore: parseInt(page) < totalPages,
      category,
      data: products
    });
  } catch (error) {
    logger.error(`Error in getProductsByCategory: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante il recupero dei prodotti per categoria'
    });
  }
};

/**
 * Get products by pet type
 */
const getProductsByPetType = async (req, res) => {
  try {
    const { petType } = req.params;
    const { limit = 20, page = 1, category } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build filter
    const filter = { petType };
    
    if (category) {
      filter.category = category;
    }
    
    // Count total products for this pet type
    const total = await Product.countDocuments(filter);
    
    // Get products
    const products = await Product.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('name brand category price imageUrl source lastPriceUpdate');
    
    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    
    return res.status(200).json({
      success: true,
      count: products.length,
      total,
      page: parseInt(page),
      totalPages,
      hasMore: parseInt(page) < totalPages,
      petType,
      category: category || 'all',
      data: products
    });
  } catch (error) {
    logger.error(`Error in getProductsByPetType: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante il recupero dei prodotti per tipo di animale'
    });
  }
};

/**
 * Get products by brand
 */
const getProductsByBrand = async (req, res) => {
  try {
    const { brand } = req.params;
    const { limit = 20, page = 1 } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Count total products for this brand
    const total = await Product.countDocuments({ brand });
    
    // Get products
    const products = await Product.find({ brand })
      .sort({ price: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('name petType category price imageUrl source lastPriceUpdate');
    
    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    
    return res.status(200).json({
      success: true,
      count: products.length,
      total,
      page: parseInt(page),
      totalPages,
      hasMore: parseInt(page) < totalPages,
      brand,
      data: products
    });
  } catch (error) {
    logger.error(`Error in getProductsByBrand: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante il recupero dei prodotti per marca'
    });
  }
};

/**
 * Get products by source (e.g., Arcaplanet, Zooplus)
 */
const getProductsBySource = async (req, res) => {
  try {
    const { source } = req.params;
    const { limit = 20, page = 1 } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Count total products from this source
    const total = await Product.countDocuments({ source });
    
    // Get products
    const products = await Product.find({ source })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('name brand petType category price imageUrl lastPriceUpdate');
    
    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    
    return res.status(200).json({
      success: true,
      count: products.length,
      total,
      page: parseInt(page),
      totalPages,
      hasMore: parseInt(page) < totalPages,
      source,
      data: products
    });
  } catch (error) {
    logger.error(`Error in getProductsBySource: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante il recupero dei prodotti per fonte'
    });
  }
};

/**
 * Get recently updated products
 */
const getRecentlyUpdatedProducts = async (req, res) => {
  try {
    const { hours = 24, limit = 20 } = req.query;
    
    // Calculate cutoff time
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - parseInt(hours));
    
    // Find recently updated products
    const products = await Product.find({
      lastPriceUpdate: { $gte: cutoffDate }
    })
      .sort({ lastPriceUpdate: -1 })
      .limit(parseInt(limit))
      .select('name brand petType category price imageUrl source lastPriceUpdate');
    
    return res.status(200).json({
      success: true,
      count: products.length,
      timeframe: `${hours} hours`,
      data: products
    });
  } catch (error) {
    logger.error(`Error in getRecentlyUpdatedProducts: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante il recupero dei prodotti aggiornati di recente'
    });
  }
};

/**
 * Get available filters (categories, brands, pet types)
 */
const getFilters = async (req, res) => {
  try {
    // Get distinct values for each filter
    const [categories, brands, petTypes, sources] = await Promise.all([
      Product.distinct('category'),
      Product.distinct('brand'),
      Product.distinct('petType'),
      Product.distinct('source')
    ]);
    
    return res.status(200).json({
      success: true,
      filters: {
        categories: categories.filter(c => c && c.trim() !== '').sort(),
        brands: brands.filter(b => b && b.trim() !== '').sort(),
        petTypes: petTypes.filter(pt => pt && pt.trim() !== '').sort(),
        sources: sources.filter(s => s && s.trim() !== '').sort()
      }
    });
  } catch (error) {
    logger.error(`Error in getFilters: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante il recupero dei filtri'
    });
  }
};

/**
 * Confronta i prezzi di un prodotto tra diversi negozi
 */
async function compareProductPrices(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        error: {
          message: 'Prodotto non trovato',
          code: 'PRODUCT_NOT_FOUND'
        }
      });
    }
    
    res.json({ 
      data: {
        product: product.name,
        prices: product.prices
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Ottiene tutte le categorie disponibili
 */
async function getCategories(req, res, next) {
  try {
    const categories = await Product.distinct('category');
    res.json({ data: categories });
  } catch (error) {
    next(error);
  }
}

/**
 * Ottiene tutti i brand disponibili
 */
async function getBrands(req, res, next) {
  try {
    const brands = await Product.distinct('brand');
    res.json({ data: brands });
  } catch (error) {
    next(error);
  }
}

/**
 * Ottiene i prodotti con il maggior risparmio
 */
async function getBestDeals(req, res, next) {
  try {
    // Ottieni un numero limitato di prodotti per categoria, ma più di 10 per avere più chance di trovare corrispondenze
    const limit = parseInt(req.query.limit) || 5; // Limita il numero di offerte restituite
    
    // Ottieni le categorie principali
    const categories = await Product.distinct('category');
    const mainCategories = [...new Set(categories.map(cat => cat.split('/')[0]))];
    
    // Inizializza array di deal
    let allDeals = [];
    
    // Per ogni categoria principale, trova prodotti simili e confronta i prezzi
    for (const mainCategory of mainCategories) {
      // Raggruppa prodotti per brand e peso in questa categoria
      const productsInCategory = await Product.find({
        category: { $regex: `^${mainCategory}`, $options: 'i' }
      }).limit(50);
      
      // Raggruppa i prodotti per brand e caratteristiche simili
      const productGroups = {};
      
      for (const product of productsInCategory) {
        // Estrai il peso dal nome del prodotto o dal campo weight
        const weightPattern = /\b\d+([,.]\d+)?\s*(kg|g|gr|ml|l)\b/i;
        const weightMatch = product.weight ? 
                          product.weight.match(weightPattern) : 
                          product.name.match(weightPattern);
        
        const weight = weightMatch ? weightMatch[0] : 'unknown';
        const brand = product.brand || 'unknown';
        
        // Crea una chiave per il gruppo
        const groupKey = `${brand}_${weight}_${product.petType || 'any'}`;
        
        if (!productGroups[groupKey]) {
          productGroups[groupKey] = [];
        }
        
        productGroups[groupKey].push(product);
      }
      
      // Per ogni gruppo di prodotti simili, calcola la differenza di prezzo
      for (const [groupKey, products] of Object.entries(productGroups)) {
        // Salta i gruppi con un solo prodotto
        if (products.length < 2) continue;
        
        // Ottieni il prezzo minimo e massimo tra tutti i prodotti del gruppo
        let minPrice = Infinity;
        let maxPrice = 0;
        let bestProduct = null;
        let worstProduct = null;
        
        for (const product of products) {
          const productPrice = product.prices?.[0]?.price || 0;
          if (productPrice > 0) {
            if (productPrice < minPrice) {
              minPrice = productPrice;
              bestProduct = product;
            }
            if (productPrice > maxPrice) {
              maxPrice = productPrice;
              worstProduct = product;
            }
          }
        }
        
        // Calcola la differenza percentuale
        if (minPrice < Infinity && maxPrice > 0 && minPrice !== maxPrice) {
          const priceDifference = ((maxPrice - minPrice) / maxPrice) * 100;
          
          // Aggiungi il deal solo se c'è una differenza significativa (>5%)
          if (priceDifference > 5) {
            allDeals.push({
              productId: bestProduct._id,
              productName: bestProduct.name,
              category: bestProduct.category,
              brand: bestProduct.brand,
              imageUrl: bestProduct.imageUrl,
              bestPrice: minPrice,
              bestPriceStore: bestProduct.source,
              worstPrice: maxPrice,
              worstPriceStore: worstProduct.source,
              priceDifference: priceDifference.toFixed(2) + '%',
              absoluteSavings: (maxPrice - minPrice).toFixed(2),
              productsCount: products.length,
              similarProducts: products.map(p => ({
                id: p._id,
                name: p.name,
                source: p.source,
                price: p.prices?.[0]?.price || 0
              }))
            });
          }
        }
      }
    }
    
    // Ordina tutti i deal per differenza di prezzo decrescente
    allDeals.sort((a, b) => parseFloat(b.priceDifference) - parseFloat(a.priceDifference));
    
    // Restituisci i migliori N deal
    res.json({ data: allDeals.slice(0, limit) });
  } catch (error) {
    logger.error(`Errore nell'ottenere i best deals: ${error.message}`);
    next(error);
  }
}

/**
 * Trova prodotti simili tra diversi negozi (confronto avanzato)
 * Utilizza la collezione similarproducts pre-calcolata
 */
async function findSimilarProducts(req, res, next) {
  try {
    const { productId, source, brand, name, weight, petType, category, limit = 10 } = req.query;
    
    // Se viene fornito un ID prodotto, cerca direttamente nella collezione similarproducts
    if (productId) {
      // Verifica che il prodotto esista
      const targetProduct = await Product.findById(productId);
      if (!targetProduct) {
        return res.status(404).json({
          error: {
            message: 'Prodotto non trovato',
            code: 'PRODUCT_NOT_FOUND'
          }
        });
      }
      
      // Cerca prodotti simili utilizzando la collezione pre-calcolata
      const similarProducts = await SimilarProduct.find({ productId })
        .sort({ similarity: -1 })
        .limit(parseInt(limit))
        .populate({
          path: 'similarProductId',
          model: 'Product'
        });
      
      // Se non ci sono prodotti simili pre-calcolati, prova a cercarli con l'algoritmo di fallback
      if (similarProducts.length === 0) {
        logger.info(`Nessun prodotto simile pre-calcolato trovato per ${productId}. Utilizzo algoritmo di fallback.`);
        return findSimilarProductsFallback(req, res, next);
      }
      
      // Trasforma i risultati nel formato atteso
      const formattedResults = similarProducts.map(similarItem => {
        const product = similarItem.similarProductId;
        
        return {
          ...product.toObject(),
          similarityScore: Math.round(similarItem.similarity * 100),
          priceDifference: similarItem.priceDifference,
          priceRatio: similarItem.priceRatio
        };
      });
      
      // Calcola i potenziali risparmi
      let savingsData = null;
      if (formattedResults.length > 0) {
        const targetPrice = targetProduct.prices?.[0]?.price || 0;
        const bestAlternativePrice = Math.min(...formattedResults.map(p => 
          p.prices?.[0]?.price || Infinity
        ));
        
        if (targetPrice > 0 && bestAlternativePrice < Infinity) {
          const savings = targetPrice - bestAlternativePrice;
          const savingsPercentage = (savings / targetPrice) * 100;
          
          savingsData = {
            originalPrice: targetPrice,
            bestAlternativePrice,
            savings,
            savingsPercentage: savingsPercentage.toFixed(2)
          };
        }
      }
      
      res.json({
        data: {
          originalProduct: targetProduct,
          similarProducts: formattedResults,
          savings: savingsData,
          source: 'pre-calculated'
        }
      });
    } 
    // Se vengono forniti altri parametri, utilizziamo la ricerca per parametri
    else if (brand || name) {
      // Cerca prodotti in base ai parametri forniti
      const searchQuery = {};
      
      if (brand) searchQuery.brand = { $regex: brand, $options: 'i' };
      if (name) searchQuery.name = { $regex: name, $options: 'i' };
      if (source) searchQuery.source = source;
      if (petType) searchQuery.petType = petType;
      if (weight) searchQuery.name = { ...searchQuery.name, $regex: weight, $options: 'i' };
      if (category) searchQuery.category = { $regex: `^${category}`, $options: 'i' };
      
      // Ottieni i prodotti che corrispondono ai criteri di ricerca
      const products = await Product.find(searchQuery)
        .limit(5)
        .sort({ updatedAt: -1 });
      
      // Per ogni prodotto, trova i prodotti simili
      const allSimilarProducts = [];
      for (const product of products) {
        const similarProducts = await SimilarProduct.find({ productId: product._id })
          .sort({ similarity: -1 })
          .limit(5)
          .populate({
            path: 'similarProductId',
            model: 'Product'
          });
          
        // Aggiungi all'array generale
        for (const similarItem of similarProducts) {
          const similarProduct = similarItem.similarProductId;
          
          // Evita duplicati
          if (!allSimilarProducts.some(p => p._id.equals(similarProduct._id))) {
            allSimilarProducts.push({
              ...similarProduct.toObject(),
              originalProductId: product._id,
              originalProductName: product.name,
              similarityScore: Math.round(similarItem.similarity * 100),
              priceDifference: similarItem.priceDifference,
              priceRatio: similarItem.priceRatio
            });
          }
        }
      }
      
      // Limita i risultati finali
      const limitedResults = allSimilarProducts
        .sort((a, b) => b.similarityScore - a.similarityScore)
        .slice(0, parseInt(limit));
      
      res.json({
        data: {
          similarProducts: limitedResults,
          source: 'pre-calculated-by-params'
        }
      });
    } else {
      return res.status(400).json({
        error: {
          message: 'Fornire productId oppure almeno brand o name per la ricerca',
          code: 'INVALID_QUERY_PARAMS'
        }
      });
    }
  } catch (error) {
    logger.error(`Errore nella ricerca di prodotti simili: ${error.message}`);
    next(error);
  }
}

/**
 * Metodo di fallback che calcola i prodotti simili al volo
 * Usato solo se non ci sono dati pre-calcolati
 */
async function findSimilarProductsFallback(req, res, next) {
  try {
    const { productId, source, brand, name, weight, petType, category } = req.query;
    
    let targetProduct;
    let searchQuery = {};
    
    // Se viene fornito un ID prodotto, usa quello per trovare le informazioni
    if (productId) {
      targetProduct = await Product.findById(productId);
      if (!targetProduct) {
        return res.status(404).json({
          error: {
            message: 'Prodotto non trovato',
            code: 'PRODUCT_NOT_FOUND'
          }
        });
      }
      
      // Costruisci query di ricerca in base al prodotto trovato
      searchQuery = {
        _id: { $ne: targetProduct._id }, // Escludi il prodotto stesso
        brand: targetProduct.brand,
        source: { $ne: targetProduct.source } // Cerca solo in altri store
      };
      
      // Estrai peso dal nome o dal campo weight se disponibile
      const weightPattern = /\b\d+([,.]\d+)?\s*(kg|g|gr|ml|l)\b/i;
      const weightMatch = targetProduct.weight ? 
                         targetProduct.weight.match(weightPattern) : 
                         targetProduct.name.match(weightPattern);
      
      if (weightMatch) {
        // Usa regex per cercare prodotti con peso simile
        searchQuery.name = { 
          $regex: weightMatch[0], 
          $options: 'i' 
        };
      }
      
      if (targetProduct.petType) {
        searchQuery.petType = targetProduct.petType;
      }
      
      if (targetProduct.category) {
        // Per la categoria, considera anche le sottocategorie
        const mainCategory = targetProduct.category.split('/')[0];
        searchQuery.category = { $regex: `^${mainCategory}`, $options: 'i' };
      }
    } 
    // Altrimenti usa i parametri forniti nella query
    else if (brand || name) {
      if (brand) searchQuery.brand = { $regex: brand, $options: 'i' };
      if (name) searchQuery.name = { $regex: name, $options: 'i' };
      if (source) searchQuery.source = { $ne: source };
      if (petType) searchQuery.petType = petType;
      if (weight) searchQuery.name = { ...searchQuery.name, $regex: weight, $options: 'i' };
      if (category) searchQuery.category = { $regex: `^${category}`, $options: 'i' };
    } else {
      return res.status(400).json({
        error: {
          message: 'Fornire productId oppure almeno brand o name per la ricerca',
          code: 'INVALID_QUERY_PARAMS'
        }
      });
    }
    
    // Cerca prodotti simili
    const similarProducts = await Product.find(searchQuery)
      .limit(10)
      .sort({ updatedAt: -1 });
    
    // Calcola un punteggio di similarità per ogni prodotto trovato
    const productsWithSimilarity = similarProducts.map(product => {
      let similarityScore = 0;
      const maxScore = 100;
      
      // Confronto nome (fino a 30 punti)
      if (targetProduct && targetProduct.name) {
        const nameWords = targetProduct.name.toLowerCase().split(/\s+/);
        const productNameWords = product.name.toLowerCase().split(/\s+/);
        
        // Parole in comune
        const commonWords = nameWords.filter(word => 
          word.length > 3 && productNameWords.includes(word)
        );
        
        similarityScore += Math.min(30, (commonWords.length / nameWords.length) * 30);
      }
      
      // Confronto brand (20 punti)
      if (targetProduct && targetProduct.brand && 
          product.brand && targetProduct.brand.toLowerCase() === product.brand.toLowerCase()) {
        similarityScore += 20;
      }
      
      // Confronto peso (30 punti)
      const weightPattern = /\b\d+([,.]\d+)?\s*(kg|g|gr|ml|l)\b/i;
      const targetWeight = targetProduct ? 
                         (targetProduct.weight || targetProduct.name.match(weightPattern)?.[0]) : 
                         weight;
                         
      const productWeight = product.weight || product.name.match(weightPattern)?.[0];
      
      if (targetWeight && productWeight && targetWeight === productWeight) {
        similarityScore += 30;
      }
      
      // Confronto petType (10 punti)
      if (targetProduct && targetProduct.petType && 
          product.petType && targetProduct.petType === product.petType) {
        similarityScore += 10;
      }
      
      // Confronto categoria (10 punti)
      if (targetProduct && targetProduct.category && 
          product.category) {
        const targetMainCat = targetProduct.category.split('/')[0];
        const productMainCat = product.category.split('/')[0];
        
        if (targetMainCat === productMainCat) {
          similarityScore += 10;
        }
      }
      
      return {
        ...product.toObject(),
        similarityScore: Math.min(maxScore, similarityScore)
      };
    });
    
    // Filtra per una similarità minima e ordina per punteggio di similarità
    const threshold = 40; // Soglia minima di similarità
    const filteredProducts = productsWithSimilarity
      .filter(p => p.similarityScore >= threshold)
      .sort((a, b) => b.similarityScore - a.similarityScore);
    
    // Calcola i potenziali risparmi
    let savingsData = null;
    if (targetProduct && filteredProducts.length > 0) {
      const targetPrice = targetProduct.prices?.[0]?.price || 0;
      const bestAlternativePrice = Math.min(...filteredProducts.map(p => 
        p.prices?.[0]?.price || Infinity
      ));
      
      if (targetPrice > 0 && bestAlternativePrice < Infinity) {
        const savings = targetPrice - bestAlternativePrice;
        const savingsPercentage = (savings / targetPrice) * 100;
        
        savingsData = {
          originalPrice: targetPrice,
          bestAlternativePrice,
          savings,
          savingsPercentage: savingsPercentage.toFixed(2)
        };
      }
    }
    
    res.json({
      data: {
        originalProduct: targetProduct || null,
        similarProducts: filteredProducts,
        savings: savingsData,
        source: 'calculated-on-the-fly'
      }
    });
  } catch (error) {
    logger.error(`Errore nella ricerca di prodotti simili (fallback): ${error.message}`);
    next(error);
  }
}

/**
 * Ottiene lo storico dei prezzi di un prodotto o una variante nel tempo
 */
async function getPriceHistory(req, res, next) {
  try {
    const { productId, variantId } = req.params;
    const { timeRange, source } = req.query;
    
    // Validazione input
    if (!productId) {
      return res.status(400).json({
        error: {
          message: 'ID prodotto richiesto',
          code: 'MISSING_PRODUCT_ID'
        }
      });
    }
    
    // Definisci periodo per lo storico prezzi
    let startDate = new Date();
    switch (timeRange) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '1m':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case '3m':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case '6m':
        startDate.setMonth(startDate.getMonth() - 6);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        // Default 30 giorni
        startDate.setMonth(startDate.getMonth() - 1);
    }
    
    // Costruisci query
    const query = { 
      productId: productId,
      recordedAt: { $gte: startDate }
    };
    
    if (variantId) {
      query.variantId = variantId;
    }
    
    if (source) {
      query.source = source;
    }
    
    // Trova i punti prezzo
    const pricePoints = await PricePoint.find(query)
      .sort({ recordedAt: 1 });
    
    // Raggruppa i risultati per fonte se sono richiesti più fonti
    let groupedResults = {};
    const sources = [...new Set(pricePoints.map(p => p.source))];
    
    for (const storeSource of sources) {
      const storeData = pricePoints
        .filter(p => p.source === storeSource)
        .map(p => ({
          date: p.recordedAt,
          price: p.price.amount,
          variantId: p.variantId
        }));
      
      // Raggruppa per variante se non è specifico per una variante
      if (!variantId) {
        const variants = [...new Set(storeData.map(p => p.variantId))];
        const byVariant = {};
        
        for (const vId of variants) {
          byVariant[vId] = storeData.filter(p => p.variantId === vId);
        }
        
        groupedResults[storeSource] = {
          byVariant
        };
      } else {
        groupedResults[storeSource] = storeData;
      }
    }
    
    // Calcola statistiche
    let statistics = null;
    if (pricePoints.length > 0) {
      const prices = pricePoints.map(p => p.price.amount);
      const currentPrice = prices[prices.length - 1];
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      
      statistics = {
        currentPrice,
        minPrice,
        maxPrice,
        avgPrice: avgPrice.toFixed(2),
        priceChange: prices.length > 1 ? (((currentPrice - prices[0]) / prices[0]) * 100).toFixed(2) + '%' : '0%',
        numDataPoints: prices.length
      };
    }
    
    // Trova info prodotto
    const product = await Product.findById(productId);
    
    res.json({
      data: {
        product: product ? {
          id: product._id,
          name: product.name,
          brand: product.brand,
          category: product.category
        } : null,
        priceHistory: groupedResults,
        statistics,
        timeRange: timeRange || '1m'
      }
    });
  } catch (error) {
    logger.error(`Errore nel recupero dello storico prezzi: ${error.message}`);
    next(error);
  }
}

// Esporta le funzioni del controller
module.exports = {
  getAllProducts,
  getProductById,
  compareProductPrices,
  getCategories,
  getBrands,
  getBestDeals,
  findSimilarProducts,
  getPriceHistory,
  searchProducts,
  getProductsByCategory,
  getProductsByPetType,
  getProductsByBrand,
  getProductsBySource,
  getRecentlyUpdatedProducts,
  getFilters
};