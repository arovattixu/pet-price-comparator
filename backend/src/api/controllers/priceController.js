/**
 * Price Controller
 * Handles price-related functionality
 */
const logger = require('../../utils/logger');
const Product = require('../../models/Product');
const PricePoint = require('../../models/PricePoint');
const { clearCache } = require('../../utils/cache');

/**
 * Get the latest price for a product
 */
const getLatestPrice = async (req, res) => {
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
    
    // Get the latest price point
    const latestPrice = await PricePoint.findOne(
      { productId },
      {},
      { sort: { timestamp: -1 } }
    );
    
    if (!latestPrice) {
      return res.status(404).json({
        success: false,
        error: 'Nessun dato di prezzo disponibile per questo prodotto'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: {
        productId,
        productName: product.name,
        price: latestPrice.price,
        currency: latestPrice.currency || 'EUR',
        timestamp: latestPrice.timestamp,
        source: product.source
      }
    });
  } catch (error) {
    logger.error(`Error in getLatestPrice: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante il recupero del prezzo'
    });
  }
};

/**
 * Get price history for a product
 */
const getPriceHistory = async (req, res) => {
  try {
    const { productId } = req.params;
    const { days = 30, limit = 100 } = req.query;
    
    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Prodotto non trovato'
      });
    }
    
    // Calculate start date based on days parameter
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    // Get price points
    const pricePoints = await PricePoint.find({
      productId,
      timestamp: { $gte: startDate }
    })
      .sort({ timestamp: 1 })
      .limit(parseInt(limit));
    
    if (pricePoints.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Nessun dato di prezzo disponibile per questo periodo'
      });
    }
    
    // Format response
    const priceHistory = pricePoints.map(pp => ({
      price: pp.price,
      currency: pp.currency || 'EUR',
      timestamp: pp.timestamp,
      isPromotion: pp.isPromotion || false
    }));
    
    return res.status(200).json({
      success: true,
      data: {
        productId,
        productName: product.name,
        source: product.source,
        period: `${days} giorni`,
        priceHistory
      }
    });
  } catch (error) {
    logger.error(`Error in getPriceHistory: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante il recupero dello storico prezzi'
    });
  }
};

/**
 * Get price statistics for a product
 */
const getPriceStats = async (req, res) => {
  try {
    const { productId } = req.params;
    const { days = 90 } = req.query;
    
    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Prodotto non trovato'
      });
    }
    
    // Calculate start date based on days parameter
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    // Get price points
    const pricePoints = await PricePoint.find({
      productId,
      timestamp: { $gte: startDate }
    });
    
    if (pricePoints.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Nessun dato di prezzo disponibile per questo periodo'
      });
    }
    
    // Calculate price statistics
    const prices = pricePoints.map(pp => pp.price);
    const latestPrice = prices[prices.length - 1];
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    
    // Determine price trend
    let trend;
    if (prices.length >= 2) {
      const firstPrice = prices[0];
      const lastPrice = prices[prices.length - 1];
      const priceDiff = ((lastPrice - firstPrice) / firstPrice) * 100;
      
      if (priceDiff > 5) {
        trend = 'IN_AUMENTO';
      } else if (priceDiff < -5) {
        trend = 'IN_DIMINUZIONE';
      } else {
        trend = 'STABILE';
      }
    } else {
      trend = 'DATI_INSUFFICIENTI';
    }
    
    return res.status(200).json({
      success: true,
      data: {
        productId,
        productName: product.name,
        source: product.source,
        period: `${days} giorni`,
        dataPoints: pricePoints.length,
        currentPrice: latestPrice,
        maxPrice,
        minPrice,
        avgPrice,
        savings: maxPrice - minPrice,
        savingsPercentage: ((maxPrice - minPrice) / maxPrice) * 100,
        volatility: (maxPrice - minPrice) / avgPrice,
        trend
      }
    });
  } catch (error) {
    logger.error(`Error in getPriceStats: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante il recupero delle statistiche sui prezzi'
    });
  }
};

/**
 * Compare prices between two products
 */
const comparePrices = async (req, res) => {
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
    
    // Get latest prices
    const [latestPrice1, latestPrice2] = await Promise.all([
      PricePoint.findOne({ productId: productId1 }, {}, { sort: { timestamp: -1 } }),
      PricePoint.findOne({ productId: productId2 }, {}, { sort: { timestamp: -1 } })
    ]);
    
    if (!latestPrice1 || !latestPrice2) {
      return res.status(404).json({
        success: false,
        error: 'Dati di prezzo non disponibili per uno o entrambi i prodotti'
      });
    }
    
    // Calculate price difference
    const priceDiff = latestPrice1.price - latestPrice2.price;
    const priceDiffPercentage = (priceDiff / latestPrice1.price) * 100;
    
    return res.status(200).json({
      success: true,
      data: {
        comparison: {
          product1: {
            id: productId1,
            name: product1.name,
            price: latestPrice1.price,
            source: product1.source,
            lastUpdated: latestPrice1.timestamp
          },
          product2: {
            id: productId2,
            name: product2.name,
            price: latestPrice2.price,
            source: product2.source,
            lastUpdated: latestPrice2.timestamp
          },
          priceDifference: priceDiff,
          priceDifferencePercentage: priceDiffPercentage,
          cheaperProduct: priceDiff > 0 ? product2.name : (priceDiff < 0 ? product1.name : 'Prezzi uguali'),
          potentialSavings: Math.abs(priceDiff)
        }
      }
    });
  } catch (error) {
    logger.error(`Error in comparePrices: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante il confronto dei prezzi'
    });
  }
};

/**
 * Get recent price changes across all products
 */
const getRecentPriceChanges = async (req, res) => {
  try {
    const { days = 7, limit = 20 } = req.query;
    
    // Calculate start date
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    // Use aggregation to find products with significant price changes
    const priceChanges = await PricePoint.aggregate([
      // Group by product and get min and max prices in the period
      {
        $match: {
          timestamp: { $gte: startDate }
        }
      },
      {
        $sort: {
          timestamp: 1
        }
      },
      {
        $group: {
          _id: '$productId',
          pricePoints: { $push: { price: '$price', timestamp: '$timestamp' } },
          latestPrice: { $last: '$price' },
          initialPrice: { $first: '$price' }
        }
      },
      // Calculate price change percentage
      {
        $project: {
          _id: 1,
          latestPrice: 1,
          initialPrice: 1,
          priceChangePercentage: {
            $multiply: [
              { $divide: [{ $subtract: ['$latestPrice', '$initialPrice'] }, '$initialPrice'] },
              100
            ]
          },
          priceChange: { $subtract: ['$latestPrice', '$initialPrice'] }
        }
      },
      // Filter for significant changes
      {
        $match: {
          $or: [
            { priceChangePercentage: { $gte: 5 } },
            { priceChangePercentage: { $lte: -5 } }
          ]
        }
      },
      // Sort by absolute change percentage
      {
        $sort: {
          priceChangePercentage: -1
        }
      },
      {
        $limit: parseInt(limit)
      }
    ]);
    
    // Get product details for the changes
    const productsWithChanges = await Promise.all(
      priceChanges.map(async (change) => {
        const product = await Product.findById(change._id);
        return {
          productId: change._id,
          productName: product ? product.name : 'Prodotto non disponibile',
          productImage: product ? product.imageUrl : null,
          source: product ? product.source : 'unknown',
          initialPrice: change.initialPrice,
          currentPrice: change.latestPrice,
          priceChange: change.priceChange,
          priceChangePercentage: change.priceChangePercentage,
          trend: change.priceChange > 0 ? 'AUMENTO' : 'DIMINUZIONE'
        };
      })
    );
    
    return res.status(200).json({
      success: true,
      data: {
        period: `${days} giorni`,
        count: productsWithChanges.length,
        priceChanges: productsWithChanges
      }
    });
  } catch (error) {
    logger.error(`Error in getRecentPriceChanges: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante il recupero dei cambiamenti di prezzo'
    });
  }
};

/**
 * Get price changes for a specific product
 */
const getProductPriceChanges = async (req, res) => {
  try {
    const { productId } = req.params;
    const { days = 30 } = req.query;
    
    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Prodotto non trovato'
      });
    }
    
    // Calculate start date
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    // Get price points in chronological order
    const pricePoints = await PricePoint.find({
      productId,
      timestamp: { $gte: startDate }
    }).sort({ timestamp: 1 });
    
    if (pricePoints.length < 2) {
      return res.status(200).json({
        success: true,
        data: {
          productId,
          productName: product.name,
          period: `${days} giorni`,
          message: 'Dati insufficienti per calcolare i cambiamenti di prezzo',
          priceChanges: []
        }
      });
    }
    
    // Calculate price changes between consecutive price points
    const priceChanges = [];
    for (let i = 1; i < pricePoints.length; i++) {
      const previousPoint = pricePoints[i - 1];
      const currentPoint = pricePoints[i];
      
      const priceDiff = currentPoint.price - previousPoint.price;
      const priceDiffPercentage = (priceDiff / previousPoint.price) * 100;
      
      // Only include actual changes
      if (priceDiff !== 0) {
        priceChanges.push({
          fromDate: previousPoint.timestamp,
          toDate: currentPoint.timestamp,
          fromPrice: previousPoint.price,
          toPrice: currentPoint.price,
          priceDifference: priceDiff,
          priceDifferencePercentage: priceDiffPercentage,
          direction: priceDiff > 0 ? 'AUMENTO' : 'DIMINUZIONE'
        });
      }
    }
    
    return res.status(200).json({
      success: true,
      data: {
        productId,
        productName: product.name,
        period: `${days} giorni`,
        currentPrice: pricePoints[pricePoints.length - 1].price,
        initialPrice: pricePoints[0].price,
        totalChangePercentage: ((pricePoints[pricePoints.length - 1].price - pricePoints[0].price) / pricePoints[0].price) * 100,
        changeCount: priceChanges.length,
        priceChanges
      }
    });
  } catch (error) {
    logger.error(`Error in getProductPriceChanges: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante il recupero dei cambiamenti di prezzo'
    });
  }
};

/**
 * Get price fluctuations and volatility data for a product
 */
const getPriceFluctuations = async (req, res) => {
  try {
    const { productId } = req.params;
    const { days = 90 } = req.query;
    
    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Prodotto non trovato'
      });
    }
    
    // Calculate start date
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    // Get price points
    const pricePoints = await PricePoint.find({
      productId,
      timestamp: { $gte: startDate }
    }).sort({ timestamp: 1 });
    
    if (pricePoints.length < 3) {
      return res.status(200).json({
        success: true,
        data: {
          productId,
          productName: product.name,
          period: `${days} giorni`,
          message: 'Dati insufficienti per calcolare le fluttuazioni di prezzo',
          volatility: 0,
          fluctuations: []
        }
      });
    }
    
    // Calculate price fluctuations
    const prices = pricePoints.map(pp => pp.price);
    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    
    // Calculate standard deviation (volatility)
    const squaredDifferences = prices.map(price => Math.pow(price - avgPrice, 2));
    const variance = squaredDifferences.reduce((sum, sqDiff) => sum + sqDiff, 0) / prices.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Express volatility as a percentage of average price
    const volatilityPercentage = (standardDeviation / avgPrice) * 100;
    
    // Identify significant fluctuations (direction changes)
    const fluctuations = [];
    let direction = null;
    
    for (let i = 1; i < pricePoints.length; i++) {
      const previousPoint = pricePoints[i - 1];
      const currentPoint = pricePoints[i];
      const priceDiff = currentPoint.price - previousPoint.price;
      
      if (priceDiff === 0) continue;
      
      const currentDirection = priceDiff > 0 ? 'up' : 'down';
      
      // Direction changed or first direction
      if (direction === null || direction !== currentDirection) {
        direction = currentDirection;
        fluctuations.push({
          date: currentPoint.timestamp,
          price: currentPoint.price,
          direction: currentDirection,
          changeAmount: priceDiff,
          changePercentage: (priceDiff / previousPoint.price) * 100
        });
      }
    }
    
    // Calculate price stability index (0-100, higher means more stable)
    const stabilityIndex = Math.max(0, 100 - volatilityPercentage * 5);
    
    return res.status(200).json({
      success: true,
      data: {
        productId,
        productName: product.name,
        period: `${days} giorni`,
        dataPoints: pricePoints.length,
        avgPrice,
        maxPrice: Math.max(...prices),
        minPrice: Math.min(...prices),
        priceRange: Math.max(...prices) - Math.min(...prices),
        standardDeviation,
        volatilityPercentage,
        stabilityIndex,
        volatilityCategory: volatilityPercentage < 5 ? 'BASSA' : (volatilityPercentage < 15 ? 'MEDIA' : 'ALTA'),
        fluctuationCount: fluctuations.length,
        fluctuations
      }
    });
  } catch (error) {
    logger.error(`Error in getPriceFluctuations: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante il recupero delle fluttuazioni di prezzo'
    });
  }
};

module.exports = {
  getLatestPrice,
  getPriceHistory,
  getPriceStats,
  comparePrices,
  getRecentPriceChanges,
  getProductPriceChanges,
  getPriceFluctuations
}; 