/**
 * Price Alert Controller
 * Handles price alert creation, management, and notifications
 */
const logger = require('../../utils/logger');
const PriceAlert = require('../../models/PriceAlert');
const Product = require('../../models/Product');
const PricePoint = require('../../models/PricePoint');
const { processAlert } = require('../../jobs/alertsJob');
const { clearCache } = require('../../utils/cache');

/**
 * Get all price alerts for the current user
 * If user auth is implemented, filter by user ID
 */
const getUserAlerts = async (req, res) => {
  try {
    // Sample user ID - replace with actual auth when implemented
    const userId = req.query.userId || 'anonymous';
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Build filter
    const filter = { userId };
    
    // If status is provided, filter by status
    if (req.query.status && ['ACTIVE', 'TRIGGERED', 'EXPIRED'].includes(req.query.status)) {
      filter.status = req.query.status;
    }
    
    // Count total alerts matching the filter
    const totalAlerts = await PriceAlert.countDocuments(filter);
    
    // Get alerts with pagination
    const alerts = await PriceAlert.find(filter)
      .populate('productId', 'name brand imageUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    return res.status(200).json({
      success: true,
      count: alerts.length,
      total: totalAlerts,
      page,
      pages: Math.ceil(totalAlerts / limit),
      data: alerts
    });
  } catch (error) {
    logger.error(`Error in getUserAlerts: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante il recupero degli avvisi di prezzo'
    });
  }
};

/**
 * Get a specific price alert by ID
 */
const getAlertById = async (req, res) => {
  try {
    const alert = await PriceAlert.findById(req.params.alertId)
      .populate('productId');
    
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Avviso di prezzo non trovato'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: alert
    });
  } catch (error) {
    logger.error(`Error in getAlertById: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante il recupero dell\'avviso di prezzo'
    });
  }
};

/**
 * Create a new price alert
 */
const createAlert = async (req, res) => {
  try {
    const {
      userId = 'anonymous',
      productId,
      type,
      targetPrice,
      targetPercentage,
      referencePrice,
      notificationEmail,
      notificationType = 'EMAIL'
    } = req.body;
    
    // Validate required fields based on alert type
    if (!productId || !type) {
      return res.status(400).json({
        success: false,
        error: 'Il productId e il tipo di avviso sono obbligatori'
      });
    }
    
    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Prodotto non trovato'
      });
    }
    
    // Validate alert type
    if (!['PRICE_BELOW', 'PRICE_ABOVE', 'PRICE_CHANGE'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo di avviso non valido'
      });
    }
    
    // Validate type-specific required fields
    if ((type === 'PRICE_BELOW' || type === 'PRICE_ABOVE') && targetPrice === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Il prezzo target è obbligatorio per questo tipo di avviso'
      });
    }
    
    if (type === 'PRICE_CHANGE' && (targetPercentage === undefined || referencePrice === undefined)) {
      return res.status(400).json({
        success: false,
        error: 'La percentuale target e il prezzo di riferimento sono obbligatori per questo tipo di avviso'
      });
    }

    // Validate notification settings
    if (notificationType === 'EMAIL' && !notificationEmail) {
      return res.status(400).json({
        success: false,
        error: 'L\'email di notifica è obbligatoria per le notifiche via email'
      });
    }
    
    // Get latest price
    const latestPrice = await PricePoint.findOne(
      { productId },
      {},
      { sort: { timestamp: -1 } }
    );
    
    // Create the alert
    const newAlert = new PriceAlert({
      userId,
      productId,
      type,
      targetPrice,
      targetPercentage,
      referencePrice: referencePrice || (latestPrice ? latestPrice.price : null),
      currentPrice: latestPrice ? latestPrice.price : null,
      notificationEmail,
      notificationType,
      status: 'ACTIVE',
      triggered: false,
      statusMessage: 'Avviso creato, in attesa di aggiornamenti del prezzo'
    });
    
    await newAlert.save();
    
    // Clear cache
    await clearCache('api:/alerts/*');
    
    return res.status(201).json({
      success: true,
      data: newAlert,
      message: 'Avviso di prezzo creato con successo'
    });
  } catch (error) {
    logger.error(`Error in createAlert: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante la creazione dell\'avviso di prezzo'
    });
  }
};

/**
 * Update an existing price alert
 */
const updateAlert = async (req, res) => {
  try {
    const {
      type,
      targetPrice,
      targetPercentage,
      referencePrice,
      notificationEmail,
      notificationType
    } = req.body;
    
    const alert = await PriceAlert.findById(req.params.alertId);
    
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Avviso di prezzo non trovato'
      });
    }
    
    // Update alert fields
    if (type) alert.type = type;
    if (targetPrice !== undefined) alert.targetPrice = targetPrice;
    if (targetPercentage !== undefined) alert.targetPercentage = targetPercentage;
    if (referencePrice !== undefined) alert.referencePrice = referencePrice;
    if (notificationEmail) alert.notificationEmail = notificationEmail;
    if (notificationType) alert.notificationType = notificationType;
    
    // Reset triggered status if alert conditions changed
    if (
      (type && type !== alert.type) ||
      (targetPrice !== undefined && targetPrice !== alert.targetPrice) ||
      (targetPercentage !== undefined && targetPercentage !== alert.targetPercentage)
    ) {
      alert.triggered = false;
      alert.triggeredAt = null;
      alert.statusMessage = 'Avviso aggiornato, in attesa di aggiornamenti del prezzo';
    }
    
    await alert.save();
    
    // Clear cache
    await clearCache('api:/alerts/*');
    
    return res.status(200).json({
      success: true,
      data: alert,
      message: 'Avviso di prezzo aggiornato con successo'
    });
  } catch (error) {
    logger.error(`Error in updateAlert: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante l\'aggiornamento dell\'avviso di prezzo'
    });
  }
};

/**
 * Delete a price alert
 */
const deleteAlert = async (req, res) => {
  try {
    const alert = await PriceAlert.findById(req.params.alertId);
    
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Avviso di prezzo non trovato'
      });
    }
    
    await alert.remove();
    
    // Clear cache
    await clearCache('api:/alerts/*');
    
    return res.status(200).json({
      success: true,
      message: 'Avviso di prezzo eliminato con successo'
    });
  } catch (error) {
    logger.error(`Error in deleteAlert: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante l\'eliminazione dell\'avviso di prezzo'
    });
  }
};

/**
 * Get alerts by product ID
 */
const getAlertsByProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.query.userId || 'anonymous';
    
    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Prodotto non trovato'
      });
    }
    
    // Find alerts for this product
    const alerts = await PriceAlert.find({
      productId,
      userId
    }).sort({ createdAt: -1 });
    
    return res.status(200).json({
      success: true,
      count: alerts.length,
      data: alerts
    });
  } catch (error) {
    logger.error(`Error in getAlertsByProduct: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante il recupero degli avvisi di prezzo'
    });
  }
};

/**
 * Get alerts by status
 */
const getAlertsByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const userId = req.query.userId || 'anonymous';
    
    // Validate status
    if (!['ACTIVE', 'TRIGGERED', 'EXPIRED'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Stato non valido'
      });
    }
    
    // Find alerts with this status
    const alerts = await PriceAlert.find({
      status,
      userId
    })
      .populate('productId', 'name brand imageUrl')
      .sort({ updatedAt: -1 });
    
    return res.status(200).json({
      success: true,
      count: alerts.length,
      data: alerts
    });
  } catch (error) {
    logger.error(`Error in getAlertsByStatus: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante il recupero degli avvisi di prezzo'
    });
  }
};

/**
 * Test an alert (simulate triggering for testing purposes)
 */
const testAlert = async (req, res) => {
  try {
    const alert = await PriceAlert.findById(req.params.alertId)
      .populate('productId');
    
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Avviso di prezzo non trovato'
      });
    }
    
    // Process the alert
    const result = await processAlert(alert);
    
    return res.status(200).json({
      success: true,
      data: result,
      message: 'Test dell\'avviso di prezzo completato'
    });
  } catch (error) {
    logger.error(`Error in testAlert: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Si è verificato un errore durante il test dell\'avviso di prezzo'
    });
  }
};

module.exports = {
  getUserAlerts,
  getAlertById,
  createAlert,
  updateAlert,
  deleteAlert,
  getAlertsByProduct,
  getAlertsByStatus,
  testAlert
}; 