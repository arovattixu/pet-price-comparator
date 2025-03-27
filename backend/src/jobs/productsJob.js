/**
 * Product-related scheduled jobs
 */
const logger = require('../utils/logger');
const Product = require('../models/Product');
const SimilarProduct = require('../models/SimilarProduct');
const { clearCache } = require('../utils/cache');

/**
 * Update product data and refresh cache
 * - Updates product metadata
 * - Recalculates similar products
 * - Clears relevant cache
 */
async function updateProductData() {
  try {
    logger.info('Starting product data update');
    
    // 1. Update product availability status based on last price update
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Find products that haven't been updated in 30 days and mark as potentially unavailable
    const outdatedProducts = await Product.updateMany(
      { 
        'lastPriceUpdate': { $lt: thirtyDaysAgo } 
      },
      { 
        $set: { 
          'availability.status': 'POTENTIALLY_UNAVAILABLE',
          'availability.lastChecked': new Date()
        } 
      }
    );
    
    logger.info(`Marked ${outdatedProducts.modifiedCount} products as potentially unavailable`);
    
    // 2. Refresh similar products data
    await refreshSimilarProducts();
    
    // 3. Clear product-related cache
    await clearCache('api:/products/*');
    await clearCache('api:/deals/*');
    
    logger.info('Product data update completed successfully');
    return {
      status: 'success',
      outdatedProductsUpdated: outdatedProducts.modifiedCount
    };
  } catch (error) {
    logger.error(`Product data update failed: ${error.message}`);
    throw error;
  }
}

/**
 * Refresh similar products data
 * - Updates similarity scores
 * - Removes obsolete entries
 * - Adds new potential matches
 */
async function refreshSimilarProducts() {
  try {
    logger.info('Starting similar products refresh');
    
    // Get count of similar products before update
    const beforeCount = await SimilarProduct.countDocuments();
    
    // Remove similar product entries for products that are no longer available
    const result = await SimilarProduct.deleteMany({
      $or: [
        { 'product1.available': false },
        { 'product2.available': false }
      ]
    });
    
    logger.info(`Removed ${result.deletedCount} obsolete similar product entries`);
    
    // You might add logic here to find new similar products
    // This would typically involve complex product matching algorithms
    
    // Update final count
    const afterCount = await SimilarProduct.countDocuments();
    
    logger.info(`Similar products refresh completed. Before: ${beforeCount}, After: ${afterCount}`);
    return {
      status: 'success',
      removedCount: result.deletedCount,
      beforeCount,
      afterCount
    };
  } catch (error) {
    logger.error(`Similar products refresh failed: ${error.message}`);
    throw error;
  }
}

module.exports = {
  updateProductData,
  refreshSimilarProducts
}; 