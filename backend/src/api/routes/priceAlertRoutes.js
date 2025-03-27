/**
 * Price Alert API Routes
 * Manage user price alerts for products
 */
const express = require('express');
const router = express.Router();
const priceAlertController = require('../controllers/priceAlertController');
const { shortCache, mediumCache } = require('../../middleware/cacheMiddleware');

/**
 * @route GET /api/alerts
 * @description Ottieni tutti gli avvisi di prezzo per l'utente corrente
 * @access Pubblico
 */
router.get('/', mediumCache, priceAlertController.getUserAlerts);

/**
 * @route GET /api/alerts/:alertId
 * @description Ottieni i dettagli di un avviso di prezzo specifico
 * @access Pubblico
 */
router.get('/:alertId', mediumCache, priceAlertController.getAlertById);

/**
 * @route POST /api/alerts
 * @description Crea un nuovo avviso di prezzo
 * @access Pubblico
 */
router.post('/', priceAlertController.createAlert);

/**
 * @route PUT /api/alerts/:alertId
 * @description Aggiorna un avviso di prezzo esistente
 * @access Pubblico
 */
router.put('/:alertId', priceAlertController.updateAlert);

/**
 * @route DELETE /api/alerts/:alertId
 * @description Elimina un avviso di prezzo
 * @access Pubblico
 */
router.delete('/:alertId', priceAlertController.deleteAlert);

/**
 * @route GET /api/alerts/product/:productId
 * @description Ottieni gli avvisi di prezzo per un prodotto specifico
 * @access Pubblico
 */
router.get('/product/:productId', shortCache, priceAlertController.getAlertsByProduct);

/**
 * @route GET /api/alerts/status/:status
 * @description Ottieni gli avvisi di prezzo filtrati per stato
 * @access Pubblico
 */
router.get('/status/:status', shortCache, priceAlertController.getAlertsByStatus);

/**
 * @route POST /api/alerts/test/:alertId
 * @description Testa un avviso di prezzo (simula un trigger)
 * @access Pubblico
 */
router.post('/test/:alertId', priceAlertController.testAlert);

module.exports = router; 