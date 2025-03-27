/**
 * Trend analysis scheduled jobs
 */
const logger = require('../utils/logger');
const Product = require('../models/Product');
const PricePoint = require('../models/PricePoint');
const { clearCache } = require('../utils/cache');

/**
 * Generate price trends and analytics
 * This job analyzes historical price data to generate insights
 */
async function generateTrends() {
  try {
    logger.info('Starting trend analysis job');
    
    // Calculate various trend metrics
    const [
      largestPriceDrops,
      priceIncreaseCount,
      priceStabilityCount,
      categoryTrends
    ] = await Promise.all([
      findLargestPriceDrops(),
      calculatePriceIncreases(),
      calculatePriceStability(),
      analyzeCategoryTrends()
    ]);
    
    // Clear trend-related cache
    await clearCache('api:/trends/*');
    
    logger.info('Trend analysis completed successfully');
    return {
      status: 'success',
      metrics: {
        largestPriceDropsCount: largestPriceDrops.length,
        priceIncreaseCount,
        priceStabilityCount,
        analyzedCategories: Object.keys(categoryTrends).length
      }
    };
  } catch (error) {
    logger.error(`Trend analysis failed: ${error.message}`);
    throw error;
  }
}

/**
 * Find products with the largest price drops in the last 30 days
 * @returns {Array} Array of products with significant price drops
 */
async function findLargestPriceDrops() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Aggregate to find products with largest price drops
    const priceDrop = await PricePoint.aggregate([
      // Match price points from the last 30 days
      { $match: { timestamp: { $gte: thirtyDaysAgo } } },
      
      // Group by product ID and find min and max prices
      { 
        $group: { 
          _id: '$productId',
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
          pricePoints: { $push: { price: '$price', timestamp: '$timestamp' } },
          newestTimestamp: { $max: '$timestamp' },
          oldestTimestamp: { $min: '$timestamp' }
        } 
      },
      
      // Calculate price drop as a percentage
      { 
        $project: { 
          _id: 1,
          maxPrice: 1,
          minPrice: 1,
          priceDrop: { 
            $multiply: [
              { $divide: [{ $subtract: ['$maxPrice', '$minPrice'] }, '$maxPrice'] },
              100
            ] 
          },
          newestTimestamp: 1,
          oldestTimestamp: 1,
          pricePoints: { $slice: ['$pricePoints', 5] } // Keep only the last 5 price points for reference
        } 
      },
      
      // Filter for significant price drops (> 5%)
      { $match: { priceDrop: { $gt: 5 } } },
      
      // Sort by largest price drop
      { $sort: { priceDrop: -1 } },
      
      // Limit to top 100 drops
      { $limit: 100 }
    ]);
    
    logger.info(`Found ${priceDrop.length} products with significant price drops`);
    return priceDrop;
  } catch (error) {
    logger.error(`Error finding largest price drops: ${error.message}`);
    throw error;
  }
}

/**
 * Calculate how many products have had price increases in the last 30 days
 * @returns {Number} Count of products with price increases
 */
async function calculatePriceIncreases() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Similar aggregation to findLargestPriceDrops but for increases
    const result = await PricePoint.aggregate([
      { $match: { timestamp: { $gte: thirtyDaysAgo } } },
      { 
        $group: { 
          _id: '$productId',
          earliestPrice: { 
            $first: { 
              $arrayElemAt: [
                { $filter: {
                  input: '$price',
                  as: 'p',
                  cond: { $eq: ['$$p.timestamp', '$oldestTimestamp'] }
                }},
                0
              ]
            }
          },
          latestPrice: { 
            $first: { 
              $arrayElemAt: [
                { $filter: {
                  input: '$price',
                  as: 'p',
                  cond: { $eq: ['$$p.timestamp', '$newestTimestamp'] }
                }},
                0
              ]
            }
          },
          oldestTimestamp: { $min: '$timestamp' },
          newestTimestamp: { $max: '$timestamp' }
        } 
      },
      {
        $match: {
          $expr: { $gt: ['$latestPrice', '$earliestPrice'] }
        }
      },
      { $count: 'count' }
    ]);
    
    const count = result.length > 0 ? result[0].count : 0;
    logger.info(`Found ${count} products with price increases in the last 30 days`);
    return count;
  } catch (error) {
    logger.error(`Error calculating price increases: ${error.message}`);
    throw error;
  }
}

/**
 * Calculate how many products have had stable prices over time
 * @returns {Number} Count of products with stable prices
 */
async function calculatePriceStability() {
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    // Find products with minimal price variation
    const result = await PricePoint.aggregate([
      { $match: { timestamp: { $gte: ninetyDaysAgo } } },
      { 
        $group: { 
          _id: '$productId',
          pricePoints: { $push: '$price' },
          priceCount: { $sum: 1 },
          avgPrice: { $avg: '$price' },
          maxPrice: { $max: '$price' },
          minPrice: { $min: '$price' }
        } 
      },
      {
        $match: {
          priceCount: { $gt: 5 }, // At least 5 data points
          $expr: {
            $lt: [
              { $abs: { $subtract: ['$maxPrice', '$minPrice'] } },
              { $multiply: ['$avgPrice', 0.03] } // Less than 3% variation
            ]
          }
        }
      },
      { $count: 'count' }
    ]);
    
    const count = result.length > 0 ? result[0].count : 0;
    logger.info(`Found ${count} products with stable prices`);
    return count;
  } catch (error) {
    logger.error(`Error calculating price stability: ${error.message}`);
    throw error;
  }
}

/**
 * Analyze price trends by category
 * @returns {Object} Trend analysis by category
 */
async function analyzeCategoryTrends() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Get all products with their categories
    const products = await Product.find({}, { _id: 1, category: 1 });
    
    // Group products by category
    const productsByCategory = {};
    products.forEach(product => {
      if (!productsByCategory[product.category]) {
        productsByCategory[product.category] = [];
      }
      productsByCategory[product.category].push(product._id);
    });
    
    // Initialize result object
    const categoryTrends = {};
    
    // Process each category
    for (const [category, productIds] of Object.entries(productsByCategory)) {
      if (productIds.length < 5) continue; // Skip categories with too few products
      
      // Find price points for products in this category
      const pricePoints = await PricePoint.find({
        productId: { $in: productIds },
        timestamp: { $gte: thirtyDaysAgo }
      }).sort({ timestamp: 1 });
      
      // Group price points by date (day) and calculate average price
      const pricesByDay = {};
      pricePoints.forEach(pp => {
        const day = pp.timestamp.toISOString().split('T')[0];
        if (!pricesByDay[day]) {
          pricesByDay[day] = { sum: 0, count: 0 };
        }
        pricesByDay[day].sum += pp.price;
        pricesByDay[day].count += 1;
      });
      
      // Calculate average price for each day
      const trend = Object.entries(pricesByDay).map(([day, data]) => ({
        day,
        avgPrice: data.sum / data.count
      })).sort((a, b) => new Date(a.day) - new Date(b.day));
      
      // Calculate trend direction
      if (trend.length >= 2) {
        const firstPrice = trend[0].avgPrice;
        const lastPrice = trend[trend.length - 1].avgPrice;
        const percentChange = ((lastPrice - firstPrice) / firstPrice) * 100;
        
        categoryTrends[category] = {
          trend,
          percentChange,
          direction: percentChange > 1 ? 'up' : percentChange < -1 ? 'down' : 'stable'
        };
      }
    }
    
    logger.info(`Analyzed trends for ${Object.keys(categoryTrends).length} categories`);
    return categoryTrends;
  } catch (error) {
    logger.error(`Error analyzing category trends: ${error.message}`);
    throw error;
  }
}

module.exports = {
  generateTrends,
  findLargestPriceDrops,
  calculatePriceIncreases,
  calculatePriceStability,
  analyzeCategoryTrends
}; 