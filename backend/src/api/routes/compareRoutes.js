/**
 * Compare API Routes
 * Manages product comparison functionality
 */
const express = require('express');
const router = express.Router();
const compareController = require('../controllers/compareController');
const { shortCache, mediumCache } = require('../../middleware/cacheMiddleware');

/**
 * @swagger
 * /api/compare/similar/{productId}:
 *   get:
 *     summary: Ottieni prodotti simili a quello specificato
 *     tags: [Confronto]
 *     parameters:
 *       - in: path
 *         name: productId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID del prodotto
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Numero massimo di risultati
 *     responses:
 *       200:
 *         description: Lista di prodotti simili
 *       404:
 *         description: Prodotto non trovato
 *       500:
 *         description: Errore del server
 */
router.get('/similar/:productId', mediumCache, compareController.getSimilarProducts);

/**
 * @route GET /api/compare/similarity/:productId1/:productId2
 * @description Ottieni il punteggio di similarità tra due prodotti
 * @access Pubblico
 */
router.get('/similarity/:productId1/:productId2', mediumCache, compareController.getSimilarityScore);

/**
 * @route GET /api/compare/sources/:productId
 * @description Confronta le diverse fonti per lo stesso prodotto
 * @access Pubblico
 */
router.get('/sources/:productId', shortCache, compareController.compareSourcesForProduct);

/**
 * @swagger
 * /api/compare/savings/{productId}:
 *   get:
 *     summary: Calcola il risparmio potenziale per un prodotto
 *     tags: [Confronto]
 *     parameters:
 *       - in: path
 *         name: productId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID del prodotto
 *     responses:
 *       200:
 *         description: Informazioni sul risparmio potenziale
 *       404:
 *         description: Prodotto non trovato
 *       500:
 *         description: Errore del server
 */
router.get('/savings/:productId', shortCache, compareController.calculateSavings);

/**
 * @route GET /api/compare/alternatives/:productId
 * @description Trova alternative più economiche a un prodotto
 * @access Pubblico
 */
router.get('/alternatives/:productId', mediumCache, compareController.findCheaperAlternatives);

/**
 * @route GET /api/compare/premium/:productId
 * @description Trova alternative premium a un prodotto
 * @access Pubblico
 */
router.get('/premium/:productId', mediumCache, compareController.findPremiumAlternatives);

/**
 * @route GET /api/compare/best-value/:category
 * @description Trova i prodotti con il miglior rapporto qualità-prezzo in una categoria
 * @access Pubblico
 */
router.get('/best-value/:category', mediumCache, compareController.findBestValueProducts);

module.exports = router; 