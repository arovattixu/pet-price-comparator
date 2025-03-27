/**
 * Advanced Compare API Routes
 * Manages advanced product comparison functionality with unit price calculations
 */
const express = require('express');
const router = express.Router();
// Utilizziamo il controller reale per la produzione
const advancedCompareController = require('../controllers/advancedCompareController');
const { shortCache, mediumCache } = require('../../middleware/cacheMiddleware');

/**
 * @route GET /api/advanced-compare/unit-prices/:productId
 * @description Confronta un prodotto con prodotti simili, includendo calcoli di prezzo unitario
 * @access Pubblico
 */
router.get('/unit-prices/:productId', shortCache, advancedCompareController.compareWithUnitPrices);

/**
 * @route GET /api/advanced-compare/best-value/:brand/:category?
 * @description Trova i prodotti con il miglior rapporto qualità-prezzo per un brand e categoria
 * @access Pubblico
 */
router.get('/best-value/:brand/:category?', mediumCache, advancedCompareController.findBestValueByBrand);

/**
 * @route GET /api/advanced-compare/sizes
 * @description Confronta diverse dimensioni di prodotti simili per trovare il miglior valore
 * @access Pubblico
 */
router.get('/sizes', shortCache, advancedCompareController.compareSizes);

/**
 * @route POST /api/advanced-compare/update-unit-prices
 * @description Aggiorna i prezzi unitari per tutti i prodotti
 * @access Privato/Admin
 */
router.post('/update-unit-prices', advancedCompareController.updateAllUnitPrices);

/**
 * @route POST /api/advanced-compare/update-product-groups
 * @description Aggiorna i gruppi di prodotti
 * @access Privato/Admin
 */
router.post('/update-product-groups', advancedCompareController.updateProductGroups);

module.exports = router; 