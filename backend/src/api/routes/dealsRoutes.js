/**
 * @swagger
 * tags:
 *   name: Deals
 *   description: API per la gestione delle offerte e delle migliori occasioni
 */
const express = require('express');
const router = express.Router();
const { cacheMiddleware } = require('../../utils/cache');

// Controllers
const dealsController = require('../controllers/dealsController');

/**
 * @swagger
 * /api/deals/best:
 *   get:
 *     summary: Recupera i prodotti con i migliori risparmi
 *     tags: [Deals]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Numero massimo di risultati da restituire
 *       - in: query
 *         name: minSimilarity
 *         schema:
 *           type: number
 *           default: 0.7
 *         description: Punteggio minimo di similarità
 *     responses:
 *       200:
 *         description: Lista delle migliori offerte
 *       500:
 *         description: Errore del server
 */
router.get('/best', cacheMiddleware(30 * 60), dealsController.getBestDeals);

/**
 * @swagger
 * /api/deals/best/{petType}:
 *   get:
 *     summary: Recupera i prodotti con i migliori risparmi per un tipo di animale domestico
 *     tags: [Deals]
 *     parameters:
 *       - in: path
 *         name: petType
 *         schema:
 *           type: string
 *         required: true
 *         description: Tipo di animale domestico
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Numero massimo di risultati da restituire
 *       - in: query
 *         name: minSimilarity
 *         schema:
 *           type: number
 *           default: 0.7
 *         description: Punteggio minimo di similarità
 *     responses:
 *       200:
 *         description: Lista delle migliori offerte per il tipo di animale specificato
 *       500:
 *         description: Errore del server
 */
router.get('/best/:petType', cacheMiddleware(30 * 60), dealsController.getBestDealsByPetType);

/**
 * @swagger
 * /api/deals/trending:
 *   get:
 *     summary: Recupera i prodotti con le più recenti riduzioni di prezzo
 *     tags: [Deals]
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 7
 *         description: Numero di giorni da considerare
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Numero massimo di risultati da restituire
 *     responses:
 *       200:
 *         description: Lista delle offerte di tendenza
 *       500:
 *         description: Errore del server
 */
router.get('/trending', cacheMiddleware(15 * 60), dealsController.getTrendingDeals);

/**
 * @swagger
 * /api/deals/price-drops:
 *   get:
 *     summary: Recupera i prodotti con i maggiori cali di prezzo
 *     tags: [Deals]
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Numero di giorni da considerare
 *       - in: query
 *         name: minReduction
 *         schema:
 *           type: number
 *           default: 5
 *         description: Percentuale minima di riduzione del prezzo
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Numero massimo di risultati da restituire
 *     responses:
 *       200:
 *         description: Lista dei prodotti con i maggiori cali di prezzo
 *       500:
 *         description: Errore del server
 */
router.get('/price-drops', cacheMiddleware(60 * 60), dealsController.getPriceDrops);

/**
 * @swagger
 * /api/deals/category/{category}:
 *   get:
 *     summary: Recupera i prodotti con i migliori risparmi in una categoria specifica
 *     tags: [Deals]
 *     parameters:
 *       - in: path
 *         name: category
 *         schema:
 *           type: string
 *         required: true
 *         description: Categoria del prodotto
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Numero massimo di risultati da restituire
 *       - in: query
 *         name: minSimilarity
 *         schema:
 *           type: number
 *           default: 0.7
 *         description: Punteggio minimo di similarità
 *     responses:
 *       200:
 *         description: Lista delle migliori offerte nella categoria specificata
 *       500:
 *         description: Errore del server
 */
router.get('/category/:category', cacheMiddleware(60 * 60), dealsController.getDealsByCategory);

/**
 * @swagger
 * /api/deals/brand/{brand}:
 *   get:
 *     summary: Recupera i prodotti con i migliori risparmi per una marca specifica
 *     tags: [Deals]
 *     parameters:
 *       - in: path
 *         name: brand
 *         schema:
 *           type: string
 *         required: true
 *         description: Marca del prodotto
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Numero massimo di risultati da restituire
 *       - in: query
 *         name: minSimilarity
 *         schema:
 *           type: number
 *           default: 0.7
 *         description: Punteggio minimo di similarità
 *     responses:
 *       200:
 *         description: Lista delle migliori offerte per la marca specificata
 *       500:
 *         description: Errore del server
 */
router.get('/brand/:brand', cacheMiddleware(60 * 60), dealsController.getDealsByBrand);

module.exports = router; 