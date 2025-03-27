/**
 * Price API Routes
 * Manage product price data
 */
const express = require('express');
const router = express.Router();
const priceController = require('../controllers/priceController');
const { shortCache, mediumCache } = require('../../middleware/cacheMiddleware');

/**
 * @route GET /api/prices/latest/:productId
 * @description Ottieni il prezzo più recente di un prodotto
 * @access Pubblico
 */
router.get('/latest/:productId', shortCache, priceController.getLatestPrice);

/**
 * @route GET /api/prices/history/:productId
 * @description Ottieni lo storico dei prezzi di un prodotto
 * @access Pubblico
 */
router.get('/history/:productId', mediumCache, priceController.getPriceHistory);

/**
 * @route GET /api/prices/stats/:productId
 * @description Ottieni statistiche sui prezzi di un prodotto
 * @access Pubblico
 */
router.get('/stats/:productId', mediumCache, priceController.getPriceStats);

/**
 * @route GET /api/prices/compare/:productId1/:productId2
 * @description Confronta i prezzi di due prodotti
 * @access Pubblico
 */
router.get('/compare/:productId1/:productId2', shortCache, priceController.comparePrices);

/**
 * @route GET /api/prices/changes
 * @description Ottieni i cambiamenti di prezzo recenti
 * @access Pubblico
 */
router.get('/changes', shortCache, priceController.getRecentPriceChanges);

/**
 * @route GET /api/prices/changes/:productId
 * @description Ottieni i cambiamenti di prezzo recenti per un prodotto
 * @access Pubblico
 */
router.get('/changes/:productId', shortCache, priceController.getProductPriceChanges);

/**
 * @route GET /api/prices/fluctuations/:productId
 * @description Ottieni le fluttuazioni di prezzo di un prodotto
 * @access Pubblico
 */
router.get('/fluctuations/:productId', mediumCache, priceController.getPriceFluctuations);

module.exports = router; 