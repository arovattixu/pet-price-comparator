/**
 * Compare Controller
 * Handles product comparison functionality
 */
const logger = require('../../utils/logger');
const Product = require('../../models/Product');
const PricePoint = require('../../models/PricePoint');
const SimilarProduct = require('../../models/SimilarProduct');
const { clearCache } = require('../../utils/cache');

/**
 * Get products similar to the specified one
 */
const getSimilarProducts = async (req, res) => {
  try {
    const { productId } = req.params;
    const { limit = 10, minSimilarity = 0.7 } = req.query;
    
    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Prodotto non trovato'
      });
    }
    
    // Find similar products from both product1 and product2 fields
    const similarProducts = await SimilarProduct.find({
      $or: [
        { 'product1._id': productId },
        { 'product2._id': productId }
      ],
      similarity: { $gte: parseFloat(minSimilarity) }
    }).sort({ similarity: -1 }).limit(parseInt(limit));
    
    if (similarProducts.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          productId,
          productName: product.name,
          similarCount: 0,
          similarProducts: []
        }
      });
    }
    
    // Extract similar products and format response
    const formattedSimilar = similarProducts.map(sp => {
      const isProduct1 = sp.product1._id.toString() === productId;
      const similar = isProduct1 ? sp.product2 : sp.product1;
      
      return {
        productId: similar._id,
        name: similar.name,
        brand: similar.brand,
        price: similar.price,
        imageUrl: similar.imageUrl,
        source: similar.source,
        similarity: sp.similarity,
        similarityFactors: sp.similarityFactors || {},
        priceDifference: similar.price - product.price,
        priceDifferencePercentage: ((similar.price - product.price) / product.price) * 100
      };
    });
    
    return res.status(200).json({
      success: true,
      data: {
        productId,
        productName: product.name,
        similarCount: formattedSimilar.length,
        similarProducts: formattedSimilar
      }
    });
  } catch (error) {
    logger.error(`Error in getSimilarProducts: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante il recupero dei prodotti simili'
    });
  }
};

/**
 * Get similarity score between two products
 */
const getSimilarityScore = async (req, res) => {
  try {
    const { productId1, productId2 } = req.params;
    
    // Validate products exist
    const [product1, product2] = await Promise.all([
      Product.findById(productId1),
      Product.findById(productId2)
    ]);
    
    if (!product1 || !product2) {
      return res.status(404).json({
        success: false,
        error: 'Uno o entrambi i prodotti non sono stati trovati'
      });
    }
    
    // Find similarity record
    const similarityRecord = await SimilarProduct.findOne({
      $or: [
        { 'product1._id': productId1, 'product2._id': productId2 },
        { 'product1._id': productId2, 'product2._id': productId1 }
      ]
    });
    
    if (!similarityRecord) {
      return res.status(404).json({
        success: false,
        error: 'Nessun record di similarità trovato per questi prodotti'
      });
    }
    
    // Get latest prices for price comparison
    const [latestPrice1, latestPrice2] = await Promise.all([
      PricePoint.findOne({ productId: productId1 }, {}, { sort: { timestamp: -1 } }),
      PricePoint.findOne({ productId: productId2 }, {}, { sort: { timestamp: -1 } })
    ]);
    
    const price1 = latestPrice1 ? latestPrice1.price : null;
    const price2 = latestPrice2 ? latestPrice2.price : null;
    
    // Calculate price difference if prices are available
    let priceDifference = null;
    let priceDifferencePercentage = null;
    
    if (price1 !== null && price2 !== null) {
      priceDifference = price2 - price1;
      priceDifferencePercentage = ((price2 - price1) / price1) * 100;
    }
    
    return res.status(200).json({
      success: true,
      data: {
        product1: {
          id: productId1,
          name: product1.name,
          brand: product1.brand,
          price: price1,
          source: product1.source
        },
        product2: {
          id: productId2,
          name: product2.name,
          brand: product2.brand,
          price: price2,
          source: product2.source
        },
        similarity: similarityRecord.similarity,
        similarityFactors: similarityRecord.similarityFactors || {},
        priceDifference,
        priceDifferencePercentage,
        cheaperProduct: priceDifference > 0 ? product1.name : (priceDifference < 0 ? product2.name : 'Prezzi uguali')
      }
    });
  } catch (error) {
    logger.error(`Error in getSimilarityScore: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante il recupero del punteggio di similarità'
    });
  }
};

/**
 * Compare different sources for the same product
 */
const compareSourcesForProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Prodotto non trovato'
      });
    }
    
    // Find similar products with very high similarity (likely same product on different sources)
    const similarProducts = await SimilarProduct.find({
      $or: [
        { 'product1._id': productId },
        { 'product2._id': productId }
      ],
      similarity: { $gte: 0.9 },
      'product1.source': { $ne: 'product2.source' } // Different sources
    }).sort({ similarity: -1 });
    
    if (similarProducts.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          productId,
          productName: product.name,
          sourceCount: 1,
          currentSource: product.source,
          alternativeSources: []
        }
      });
    }
    
    // Get latest price for the product
    const latestPrice = await PricePoint.findOne(
      { productId },
      {},
      { sort: { timestamp: -1 } }
    );
    
    // Extract alternative sources and format response
    const alternativeSources = await Promise.all(
      similarProducts.map(async (sp) => {
        const isProduct1 = sp.product1._id.toString() === productId;
        const alternative = isProduct1 ? sp.product2 : sp.product1;
        
        // Get latest price for the alternative
        const alternativePrice = await PricePoint.findOne(
          { productId: alternative._id },
          {},
          { sort: { timestamp: -1 } }
        );
        
        const price = alternativePrice ? alternativePrice.price : null;
        const originalPrice = latestPrice ? latestPrice.price : null;
        
        // Calculate price difference if prices are available
        let priceDifference = null;
        let priceDifferencePercentage = null;
        
        if (originalPrice !== null && price !== null) {
          priceDifference = price - originalPrice;
          priceDifferencePercentage = ((price - originalPrice) / originalPrice) * 100;
        }
        
        return {
          productId: alternative._id,
          name: alternative.name,
          source: alternative.source,
          price,
          link: alternative.url || null,
          similarity: sp.similarity,
          priceDifference,
          priceDifferencePercentage,
          isCheaper: priceDifference !== null ? priceDifference < 0 : null
        };
      })
    );
    
    return res.status(200).json({
      success: true,
      data: {
        productId,
        productName: product.name,
        currentSource: product.source,
        currentPrice: latestPrice ? latestPrice.price : null,
        sourceCount: 1 + alternativeSources.length,
        alternativeSources
      }
    });
  } catch (error) {
    logger.error(`Error in compareSourcesForProduct: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante il confronto delle fonti'
    });
  }
};

/**
 * Calculate potential savings for a product
 */
const calculateSavings = async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Prodotto non trovato'
      });
    }
    
    // Get price history for the product
    const priceHistory = await PricePoint.find({ productId })
      .sort({ timestamp: -1 })
      .limit(100);
    
    if (priceHistory.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Nessun dato di prezzo disponibile per questo prodotto'
      });
    }
    
    const currentPrice = priceHistory[0].price;
    const minPrice = Math.min(...priceHistory.map(pp => pp.price));
    const maxPrice = Math.max(...priceHistory.map(pp => pp.price));
    
    // Find similar products to compare prices
    const similarProducts = await SimilarProduct.find({
      $or: [
        { 'product1._id': productId },
        { 'product2._id': productId }
      ],
      similarity: { $gte: 0.75 }
    }).sort({ similarity: -1 });
    
    // Get alternative options with prices
    const alternatives = await Promise.all(
      similarProducts.map(async (sp) => {
        const isProduct1 = sp.product1._id.toString() === productId;
        const alternative = isProduct1 ? sp.product2 : sp.product1;
        
        // Get latest price for the alternative
        const alternativePrice = await PricePoint.findOne(
          { productId: alternative._id },
          {},
          { sort: { timestamp: -1 } }
        );
        
        return {
          productId: alternative._id,
          name: alternative.name,
          brand: alternative.brand,
          source: alternative.source,
          price: alternativePrice ? alternativePrice.price : null,
          similarity: sp.similarity
        };
      })
    );
    
    // Filter out alternatives with no price
    const validAlternatives = alternatives.filter(alt => alt.price !== null);
    
    // Find cheapest alternative
    const cheapestAlternative = validAlternatives.length > 0 
      ? validAlternatives.reduce((min, alt) => alt.price < min.price ? alt : min, validAlternatives[0])
      : null;
    
    // Calculate potential savings
    const historicalSavings = currentPrice - minPrice;
    const historicalSavingsPercentage = ((currentPrice - minPrice) / currentPrice) * 100;
    
    const alternativeSavings = cheapestAlternative && cheapestAlternative.price < currentPrice
      ? currentPrice - cheapestAlternative.price
      : 0;
    
    const alternativeSavingsPercentage = alternativeSavings > 0
      ? (alternativeSavings / currentPrice) * 100
      : 0;
    
    return res.status(200).json({
      success: true,
      data: {
        productId,
        productName: product.name,
        currentPrice,
        historicalPriceRange: {
          min: minPrice,
          max: maxPrice,
          range: maxPrice - minPrice
        },
        historicalSavings: {
          amount: historicalSavings,
          percentage: historicalSavingsPercentage
        },
        alternativeSavings: {
          amount: alternativeSavings,
          percentage: alternativeSavingsPercentage,
          cheapestAlternative: cheapestAlternative
            ? {
                productId: cheapestAlternative.productId,
                name: cheapestAlternative.name,
                price: cheapestAlternative.price,
                source: cheapestAlternative.source,
                similarity: cheapestAlternative.similarity
              }
            : null
        },
        bestSavings: alternativeSavings > historicalSavings
          ? 'alternative'
          : 'historical'
      }
    });
  } catch (error) {
    logger.error(`Error in calculateSavings: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante il calcolo del risparmio potenziale'
    });
  }
};

/**
 * Find cheaper alternatives to a product
 */
const findCheaperAlternatives = async (req, res) => {
  try {
    const { productId } = req.params;
    const { limit = 10, minSimilarity = 0.7 } = req.query;
    
    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Prodotto non trovato'
      });
    }
    
    // Get current price for the product
    const currentPrice = await PricePoint.findOne(
      { productId },
      {},
      { sort: { timestamp: -1 } }
    );
    
    if (!currentPrice) {
      return res.status(404).json({
        success: false,
        error: 'Nessun dato di prezzo disponibile per questo prodotto'
      });
    }
    
    // Find similar products
    const similarProducts = await SimilarProduct.find({
      $or: [
        { 'product1._id': productId },
        { 'product2._id': productId }
      ],
      similarity: { $gte: parseFloat(minSimilarity) }
    }).sort({ similarity: -1 });
    
    // Check alternative prices
    const alternatives = await Promise.all(
      similarProducts.map(async (sp) => {
        const isProduct1 = sp.product1._id.toString() === productId;
        const alternative = isProduct1 ? sp.product2 : sp.product1;
        
        // Get latest price for the alternative
        const alternativePrice = await PricePoint.findOne(
          { productId: alternative._id },
          {},
          { sort: { timestamp: -1 } }
        );
        
        return {
          productId: alternative._id,
          name: alternative.name,
          brand: alternative.brand,
          price: alternativePrice ? alternativePrice.price : null,
          imageUrl: alternative.imageUrl,
          source: alternative.source,
          similarity: sp.similarity,
          similarityFactors: sp.similarityFactors || {}
        };
      })
    );
    
    // Filter cheaper alternatives with valid prices
    const cheaperAlternatives = alternatives
      .filter(alt => alt.price !== null && alt.price < currentPrice.price)
      .sort((a, b) => {
        // Sort by price difference, considering similarity
        const aDiscount = currentPrice.price - a.price;
        const bDiscount = currentPrice.price - b.price;
        return bDiscount - aDiscount; // Largest discount first
      })
      .slice(0, parseInt(limit));
    
    return res.status(200).json({
      success: true,
      data: {
        productId,
        productName: product.name,
        currentPrice: currentPrice.price,
        alternativesCount: cheaperAlternatives.length,
        cheaperAlternatives: cheaperAlternatives.map(alt => ({
          ...alt,
          priceDifference: currentPrice.price - alt.price,
          savingsPercentage: ((currentPrice.price - alt.price) / currentPrice.price) * 100
        }))
      }
    });
  } catch (error) {
    logger.error(`Error in findCheaperAlternatives: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante la ricerca di alternative più economiche'
    });
  }
};

/**
 * Find premium alternatives to a product
 */
const findPremiumAlternatives = async (req, res) => {
  try {
    const { productId } = req.params;
    const { limit = 10, minSimilarity = 0.7 } = req.query;
    
    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Prodotto non trovato'
      });
    }
    
    // Get current price for the product
    const currentPrice = await PricePoint.findOne(
      { productId },
      {},
      { sort: { timestamp: -1 } }
    );
    
    if (!currentPrice) {
      return res.status(404).json({
        success: false,
        error: 'Nessun dato di prezzo disponibile per questo prodotto'
      });
    }
    
    // Find similar products
    const similarProducts = await SimilarProduct.find({
      $or: [
        { 'product1._id': productId },
        { 'product2._id': productId }
      ],
      similarity: { $gte: parseFloat(minSimilarity) }
    }).sort({ similarity: -1 });
    
    // Check alternative prices
    const alternatives = await Promise.all(
      similarProducts.map(async (sp) => {
        const isProduct1 = sp.product1._id.toString() === productId;
        const alternative = isProduct1 ? sp.product2 : sp.product1;
        
        // Get latest price for the alternative
        const alternativePrice = await PricePoint.findOne(
          { productId: alternative._id },
          {},
          { sort: { timestamp: -1 } }
        );
        
        return {
          productId: alternative._id,
          name: alternative.name,
          brand: alternative.brand,
          price: alternativePrice ? alternativePrice.price : null,
          imageUrl: alternative.imageUrl,
          source: alternative.source,
          similarity: sp.similarity,
          similarityFactors: sp.similarityFactors || {}
        };
      })
    );
    
    // Filter premium alternatives with valid prices
    const premiumAlternatives = alternatives
      .filter(alt => alt.price !== null && alt.price > currentPrice.price)
      .sort((a, b) => {
        // Sort considering similarity and price difference
        const aPremium = (a.price - currentPrice.price) * a.similarity;
        const bPremium = (b.price - currentPrice.price) * b.similarity;
        return aPremium - bPremium; // Smallest premium (considering similarity) first
      })
      .slice(0, parseInt(limit));
    
    return res.status(200).json({
      success: true,
      data: {
        productId,
        productName: product.name,
        currentPrice: currentPrice.price,
        alternativesCount: premiumAlternatives.length,
        premiumAlternatives: premiumAlternatives.map(alt => ({
          ...alt,
          priceDifference: alt.price - currentPrice.price,
          priceIncreasePercentage: ((alt.price - currentPrice.price) / currentPrice.price) * 100
        }))
      }
    });
  } catch (error) {
    logger.error(`Error in findPremiumAlternatives: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante la ricerca di alternative premium'
    });
  }
};

/**
 * Find best value products in a category
 */
const findBestValueProducts = async (req, res) => {
  try {
    const { category } = req.params;
    const { limit = 10 } = req.query;
    
    // Find products in this category
    const productsInCategory = await Product.find({ category });
    
    if (productsInCategory.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Nessun prodotto trovato in questa categoria'
      });
    }
    
    // Get product IDs
    const productIds = productsInCategory.map(p => p._id);
    
    // Get latest prices for these products
    const pricesMap = new Map();
    
    for (const productId of productIds) {
      const latestPrice = await PricePoint.findOne(
        { productId },
        {},
        { sort: { timestamp: -1 } }
      );
      
      if (latestPrice) {
        pricesMap.set(productId.toString(), latestPrice.price);
      }
    }
    
    // Get similarity data for products in this category
    const similarityData = await SimilarProduct.find({
      $or: [
        { 'product1._id': { $in: productIds } },
        { 'product2._id': { $in: productIds } }
      ],
      'product1.category': category,
      'product2.category': category
    });
    
    // Calculate a "value score" for each product
    const productScores = productsInCategory
      .filter(p => pricesMap.has(p._id.toString())) // Only products with prices
      .map(product => {
        const price = pricesMap.get(product._id.toString());
        
        // Find similar products for comparison
        const similar = similarityData.filter(sp => 
          sp.product1._id.toString() === product._id.toString() || 
          sp.product2._id.toString() === product._id.toString()
        );
        
        // Calculate average price of similar products
        let similarPrices = [];
        
        for (const sp of similar) {
          const similarProductId = sp.product1._id.toString() === product._id.toString() 
            ? sp.product2._id.toString() 
            : sp.product1._id.toString();
          
          if (pricesMap.has(similarProductId)) {
            similarPrices.push(pricesMap.get(similarProductId));
          }
        }
        
        const avgSimilarPrice = similarPrices.length > 0
          ? similarPrices.reduce((sum, p) => sum + p, 0) / similarPrices.length
          : null;
        
        // Calculate value score (higher is better)
        // Value = similarity to others / price (relative to category average)
        let valueScore;
        
        if (avgSimilarPrice) {
          // If price is lower than average similar price, it's a good value
          valueScore = avgSimilarPrice / price;
        } else {
          // Fallback if no similar prices available
          const avgCategoryPrice = Array.from(pricesMap.values()).reduce((sum, p) => sum + p, 0) / pricesMap.size;
          valueScore = avgCategoryPrice / price;
        }
        
        return {
          productId: product._id,
          name: product.name,
          brand: product.brand,
          price,
          imageUrl: product.imageUrl,
          source: product.source,
          valueScore,
          avgSimilarPrice,
          similarProductsCount: similar.length
        };
      })
      .sort((a, b) => b.valueScore - a.valueScore) // Sort by value score (higher first)
      .slice(0, parseInt(limit));
    
    return res.status(200).json({
      success: true,
      data: {
        category,
        productsCount: productScores.length,
        bestValueProducts: productScores
      }
    });
  } catch (error) {
    logger.error(`Error in findBestValueProducts: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante la ricerca dei prodotti con miglior rapporto qualità-prezzo'
    });
  }
};

module.exports = {
  getSimilarProducts,
  getSimilarityScore,
  compareSourcesForProduct,
  calculateSavings,
  findCheaperAlternatives,
  findPremiumAlternatives,
  findBestValueProducts
}; 