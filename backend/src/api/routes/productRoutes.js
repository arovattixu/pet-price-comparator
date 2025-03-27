const express = require('express');
const productController = require('../controllers/productController');
const router = express.Router();

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Ottiene tutti i prodotti con paginazione e filtri
 *     tags: [Prodotti]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Numero di pagina per la paginazione
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Numero di elementi per pagina
 *     responses:
 *       200:
 *         description: Lista di prodotti
 *       500:
 *         description: Errore del server
 */
router.get('/', productController.getAllProducts);

/**
 * @swagger
 * /api/products/similar:
 *   get:
 *     summary: Trova prodotti simili tra diversi negozi (confronto avanzato)
 *     tags: [Prodotti]
 *     parameters:
 *       - in: query
 *         name: productId
 *         schema:
 *           type: string
 *         description: ID del prodotto di riferimento
 *       - in: query
 *         name: brand
 *         schema:
 *           type: string
 *         description: Brand per trovare prodotti simili
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Nome del prodotto per trovare prodotti simili
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Numero massimo di risultati simili
 *       - in: query
 *         name: minSimilarity
 *         schema:
 *           type: number
 *           default: 0.7
 *         description: Punteggio minimo di similarità (0-1)
 *     responses:
 *       200:
 *         description: Lista di prodotti simili
 *       400:
 *         description: Parametri mancanti o non validi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Fornire productId oppure almeno brand o name per la ricerca"
 *                     code:
 *                       type: string
 *                       example: "INVALID_QUERY_PARAMS"
 *       500:
 *         description: Errore del server
 */
router.get('/similar', productController.findSimilarProducts);

/**
 * @swagger
 * /api/products/categories/all:
 *   get:
 *     summary: Ottiene tutte le categorie disponibili
 *     tags: [Prodotti]
 *     responses:
 *       200:
 *         description: Lista di categorie
 *       500:
 *         description: Errore del server
 */
router.get('/categories/all', productController.getCategories);

/**
 * @swagger
 * /api/products/brands/all:
 *   get:
 *     summary: Ottiene tutti i brand disponibili
 *     tags: [Prodotti]
 *     responses:
 *       200:
 *         description: Lista di brand
 *       500:
 *         description: Errore del server
 */
router.get('/brands/all', productController.getBrands);

/**
 * @swagger
 * /api/products/search:
 *   get:
 *     summary: Cerca prodotti con ricerca testuale
 *     tags: [Prodotti]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         required: true
 *         description: Termine di ricerca testuale
 *       - in: query
 *         name: petType
 *         schema:
 *           type: string
 *         description: Tipo di animale (cane, gatto)
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Categoria del prodotto
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Numero massimo di risultati
 *     responses:
 *       200:
 *         description: Risultati della ricerca
 *       400:
 *         description: Parametri mancanti o non validi
 *       500:
 *         description: Errore del server
 */
router.get('/search', productController.searchProducts);

/**
 * @swagger
 * /api/products/deals/best:
 *   get:
 *     summary: Ottiene i prodotti con il maggior risparmio
 *     tags: [Prodotti]
 *     responses:
 *       200:
 *         description: Lista di prodotti con il maggior risparmio
 *       500:
 *         description: Errore del server
 */
router.get('/deals/best', productController.getBestDeals);

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Ottiene un singolo prodotto per ID
 *     tags: [Prodotti]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID del prodotto
 *     responses:
 *       200:
 *         description: Dettagli del prodotto
 *       404:
 *         description: Prodotto non trovato
 *       500:
 *         description: Errore del server
 */
router.get('/:id', productController.getProductById);

/**
 * @swagger
 * /api/products/{id}/compare:
 *   get:
 *     summary: Confronta i prezzi di un prodotto tra diversi negozi
 *     tags: [Prodotti]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID del prodotto
 *     responses:
 *       200:
 *         description: Confronto dei prezzi
 *       404:
 *         description: Prodotto non trovato
 *       500:
 *         description: Errore del server
 */
router.get('/:id/compare', productController.compareProductPrices);

/**
 * @swagger
 * /api/products/{productId}/price-history:
 *   get:
 *     summary: Ottiene lo storico dei prezzi di un prodotto nel tempo
 *     tags: [Prodotti]
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
 *         description: Periodo di tempo per lo storico
 *     responses:
 *       200:
 *         description: Storico dei prezzi
 *       404:
 *         description: Prodotto non trovato
 *       500:
 *         description: Errore del server
 */
router.get('/:productId/price-history', productController.getPriceHistory);

module.exports = router;