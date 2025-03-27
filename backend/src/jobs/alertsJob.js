/**
 * Price alerts scheduled jobs
 */
const logger = require('../utils/logger');
const PriceAlert = require('../models/PriceAlert');
const Product = require('../models/Product');
const PricePoint = require('../models/PricePoint');
const { clearCache } = require('../utils/cache');

/**
 * Process all price alerts 
 * - Checks all active alerts against current prices
 * - Triggers notifications for matched alerts
 * - Updates alert status
 */
async function processPriceAlerts() {
  try {
    logger.info('Starting price alerts processing');
    
    // Get all active alerts
    const activeAlerts = await PriceAlert.find({ 
      status: 'ACTIVE',
      triggered: false
    }).populate('productId');
    
    logger.info(`Found ${activeAlerts.length} active price alerts to process`);
    
    if (activeAlerts.length === 0) {
      return { 
        status: 'success',
        processed: 0,
        triggered: 0
      };
    }
    
    // Process each alert
    const results = await Promise.all(
      activeAlerts.map(alert => processAlert(alert))
    );
    
    // Count triggered alerts
    const triggeredAlerts = results.filter(r => r.triggered).length;
    
    // Clear alerts cache
    await clearCache('api:/alerts/*');
    
    logger.info(`Price alerts processing completed. Triggered ${triggeredAlerts} of ${activeAlerts.length} alerts`);
    
    return {
      status: 'success',
      processed: activeAlerts.length,
      triggered: triggeredAlerts
    };
  } catch (error) {
    logger.error(`Price alerts processing failed: ${error.message}`);
    throw error;
  }
}

/**
 * Process a single price alert
 * @param {Object} alert - The price alert to process
 * @returns {Object} Processing result
 */
async function processAlert(alert) {
  try {
    // Product may have been removed
    if (!alert.productId) {
      await PriceAlert.updateOne(
        { _id: alert._id },
        { 
          $set: { 
            status: 'EXPIRED',
            statusMessage: 'Product no longer exists'
          } 
        }
      );
      return { alertId: alert._id, triggered: false, status: 'EXPIRED' };
    }
    
    // Get the latest price for the product
    const latestPricePoint = await PricePoint.findOne(
      { productId: alert.productId._id },
      {},
      { sort: { timestamp: -1 } }
    );
    
    if (!latestPricePoint) {
      return { alertId: alert._id, triggered: false, status: 'ACTIVE' };
    }
    
    const currentPrice = latestPricePoint.price;
    let triggered = false;
    let statusMessage = '';
    
    // Check if alert conditions are met
    switch(alert.type) {
      case 'PRICE_BELOW':
        triggered = currentPrice <= alert.targetPrice;
        statusMessage = triggered ? 
          `Price dropped to ${currentPrice.toFixed(2)}€, below your target of ${alert.targetPrice.toFixed(2)}€` :
          `Current price (${currentPrice.toFixed(2)}€) still above your target (${alert.targetPrice.toFixed(2)}€)`;
        break;
        
      case 'PRICE_ABOVE':
        triggered = currentPrice >= alert.targetPrice;
        statusMessage = triggered ? 
          `Price increased to ${currentPrice.toFixed(2)}€, above your target of ${alert.targetPrice.toFixed(2)}€` :
          `Current price (${currentPrice.toFixed(2)}€) still below your target (${alert.targetPrice.toFixed(2)}€)`;
        break;
        
      case 'PRICE_CHANGE':
        // Alert if price changed by target percentage in any direction
        const priceChange = Math.abs(((currentPrice - alert.referencePrice) / alert.referencePrice) * 100);
        triggered = priceChange >= alert.targetPercentage;
        statusMessage = triggered ? 
          `Price changed by ${priceChange.toFixed(2)}%, exceeding your target of ${alert.targetPercentage.toFixed(2)}%` :
          `Price change (${priceChange.toFixed(2)}%) hasn't reached your target (${alert.targetPercentage.toFixed(2)}%)`;
        break;
        
      default:
        logger.warn(`Unknown alert type: ${alert.type}`);
    }
    
    // If alert conditions are met, update the alert status
    if (triggered) {
      await PriceAlert.updateOne(
        { _id: alert._id },
        { 
          $set: { 
            triggered: true,
            triggeredAt: new Date(),
            currentPrice,
            statusMessage
          } 
        }
      );
      
      // This is where you'd send the actual notifications
      // For now, we just log it
      logger.info(`Alert triggered: ${alert._id} - ${statusMessage}`);
      
      // Here you would add code to send notifications via:
      // - Email
      // - Push notification
      // - SMS
      // etc.
    }
    
    return { 
      alertId: alert._id, 
      triggered, 
      status: 'ACTIVE',
      message: statusMessage 
    };
  } catch (error) {
    logger.error(`Error processing alert ${alert._id}: ${error.message}`);
    return { alertId: alert._id, triggered: false, error: error.message };
  }
}

/**
 * Clean up expired alerts
 * Removes alerts that have been triggered more than 30 days ago
 */
async function cleanupOldAlerts() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const result = await PriceAlert.deleteMany({
      triggered: true,
      triggeredAt: { $lt: thirtyDaysAgo }
    });
    
    logger.info(`Cleaned up ${result.deletedCount} old triggered alerts`);
    return {
      status: 'success',
      deletedCount: result.deletedCount
    };
  } catch (error) {
    logger.error(`Failed to clean up old alerts: ${error.message}`);
    throw error;
  }
}

module.exports = {
  processPriceAlerts,
  processAlert,
  cleanupOldAlerts
}; 