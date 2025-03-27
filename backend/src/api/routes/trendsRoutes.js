const express = require('express');
const router = express.Router();
const { cacheMiddleware } = require('../../utils/cache');

// Controllers
const trendsController = require('../controllers/trendsController');

/**
 * @swagger
 * /api/trends/price-history/{productId}:
 *   get:
 *     summary: Ottiene lo storico dei prezzi di un prodotto con analisi
 *     tags: [Trend]
 *     parameters:
 *       - in: path
 *         name: productId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID del prodotto
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7days, 30days, 90days, 1year, all]
 *           default: 30days
 *         description: Periodo di tempo per l'analisi
 *     responses:
 *       200:
 *         description: Storico e analisi dei prezzi
 *       404:
 *         description: Prodotto non trovato
 *       500:
 *         description: Errore del server
 */
router.get('/price-history/:productId', cacheMiddleware(60 * 60), trendsController.getProductPriceHistory);

/**
 * @swagger
 * /api/trends/pet-type/{petType}:
 *   get:
 *     summary: Ottiene l'andamento dei prezzi per un tipo di animale
 *     tags: [Trend]
 *     parameters:
 *       - in: path
 *         name: petType
 *         schema:
 *           type: string
 *           enum: [cane, gatto]
 *         required: true
 *         description: Tipo di animale (cane/gatto)
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7days, 30days, 90days, 1year, all]
 *           default: 30days
 *         description: Periodo di tempo per l'analisi
 *     responses:
 *       200:
 *         description: Andamento dei prezzi per tipo di animale
 *       500:
 *         description: Errore del server
 */
router.get('/pet-type/:petType', cacheMiddleware(24 * 60 * 60), trendsController.getPetTypePriceTrends);

/**
 * @swagger
 * /api/trends/category/{category}:
 *   get:
 *     summary: Ottiene l'andamento dei prezzi per una categoria
 *     tags: [Trend]
 *     parameters:
 *       - in: path
 *         name: category
 *         schema:
 *           type: string
 *         required: true
 *         description: Categoria del prodotto
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7days, 30days, 90days, 1year, all]
 *           default: 30days
 *         description: Periodo di tempo per l'analisi
 *     responses:
 *       200:
 *         description: Andamento dei prezzi per categoria
 *       500:
 *         description: Errore del server
 */
router.get('/category/:category', cacheMiddleware(24 * 60 * 60), trendsController.getCategoryPriceTrends);

/**
 * @swagger
 * /api/trends/store/{store}:
 *   get:
 *     summary: Ottiene l'andamento dei prezzi per un negozio
 *     tags: [Trend]
 *     parameters:
 *       - in: path
 *         name: store
 *         schema:
 *           type: string
 *           enum: [zooplus, arcaplanet]
 *         required: true
 *         description: Nome del negozio
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7days, 30days, 90days, 1year, all]
 *           default: 30days
 *         description: Periodo di tempo per l'analisi
 *     responses:
 *       200:
 *         description: Andamento dei prezzi per negozio
 *       500:
 *         description: Errore del server
 */
router.get('/store/:store', cacheMiddleware(24 * 60 * 60), trendsController.getStorePriceTrends);

/**
 * @swagger
 * /api/trends/brand/{brand}:
 *   get:
 *     summary: Ottiene l'andamento dei prezzi per un brand
 *     tags: [Trend]
 *     parameters:
 *       - in: path
 *         name: brand
 *         schema:
 *           type: string
 *         required: true
 *         description: Nome del brand
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7days, 30days, 90days, 1year, all]
 *           default: 30days
 *         description: Periodo di tempo per l'analisi
 *     responses:
 *       200:
 *         description: Andamento dei prezzi per brand
 *       500:
 *         description: Errore del server
 */
router.get('/brand/:brand', cacheMiddleware(24 * 60 * 60), trendsController.getBrandPriceTrends);

/**
 * @swagger
 * /api/trends/compare:
 *   get:
 *     summary: Confronta l'andamento dei prezzi tra diversi prodotti
 *     tags: [Trend]
 *     parameters:
 *       - in: query
 *         name: ids
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         required: true
 *         description: Array di ID dei prodotti da confrontare
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7days, 30days, 90days, 1year, all]
 *           default: 30days
 *         description: Periodo di tempo per l'analisi
 *     responses:
 *       200:
 *         description: Confronto dell'andamento dei prezzi
 *       500:
 *         description: Errore del server
 */
router.get('/compare', cacheMiddleware(60 * 60), trendsController.comparePriceTrends);

module.exports = router; 