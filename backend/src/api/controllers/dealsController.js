const Product = require('../../db/models/Product');
const SimilarProduct = require('../../db/models/SimilarProduct');
const PricePoint = require('../../db/models/PricePoint');
const logger = require('../../utils/logger');
const mongoose = require('mongoose');
const cache = require('../../utils/cache');

/**
 * Trova i prodotti con il miglior risparmio basato su prodotti simili
 */
async function getBestDeals(req, res, next) {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    const minDiscount = parseFloat(req.query.minDiscount) || 10; // percentuale minima di sconto

    // Ottieni i prodotti con il maggiore sconto
    const products = await Product.aggregate([
      { $match: { 'prices.1': { $exists: true } } },  // almeno due prezzi registrati
      { $addFields: {
        currentPrice: { $arrayElemAt: ['$prices.price', 0] },
        previousPrice: { $arrayElemAt: ['$prices.price', 1] },
        // Calcola lo sconto come percentuale
        discount: {
          $multiply: [
            { $divide: [
              { $subtract: [
                { $arrayElemAt: ['$prices.price', 1] },
                { $arrayElemAt: ['$prices.price', 0] }
              ]},
              { $arrayElemAt: ['$prices.price', 1] }
            ]},
            100
          ]
        }
      }},
      { $match: { discount: { $gte: minDiscount } } }, // filtro per sconto minimo
      { $sort: { discount: -1 } },   // ordina per sconto decrescente
      { $skip: offset },
      { $limit: limit }
    ]);

    res.json({
      success: true,
      data: {
        count: products.length,
        items: products.map(p => ({
          id: p._id,
          name: p.name,
          brand: p.brand,
          source: p.source,
          currentPrice: p.currentPrice,
          previousPrice: p.previousPrice,
          discount: Math.round(p.discount * 10) / 10, // arrotonda a 1 decimale
          imageUrl: p.imageUrl
        }))
      }
    });
  } catch (error) {
    logger.error(`Errore nel recuperare le migliori offerte: ${error.message}`);
    next(error);
  }
}

/**
 * Trova i prodotti con il miglior risparmio per un tipo di animale specifico
 */
async function getBestDealsByPetType(req, res, next) {
  try {
    const { petType } = req.params; // 'cat' o 'dog'
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    const minDiscount = parseFloat(req.query.minDiscount) || 10;

    // Costruisci il pattern di ricerca basato sul tipo di animale
    const searchPattern = petType === 'cat' ? 
      { $regex: /gatt|cat|felin/i } : 
      { $regex: /cane|dog|cucciolo|puppy/i };

    // Ottieni i prodotti con il maggiore sconto per il tipo di animale specificato
    const products = await Product.aggregate([
      { $match: { 
        'prices.1': { $exists: true },
        $or: [
          { name: searchPattern },
          { category: searchPattern },
          { description: searchPattern }
        ] 
      }},
      { $addFields: {
        currentPrice: { $arrayElemAt: ['$prices.price', 0] },
        previousPrice: { $arrayElemAt: ['$prices.price', 1] },
        discount: {
          $multiply: [
            { $divide: [
              { $subtract: [
                { $arrayElemAt: ['$prices.price', 1] },
                { $arrayElemAt: ['$prices.price', 0] }
              ]},
              { $arrayElemAt: ['$prices.price', 1] }
            ]},
            100
          ]
        }
      }},
      { $match: { discount: { $gte: minDiscount } } },
      { $sort: { discount: -1 } },
      { $skip: offset },
      { $limit: limit }
    ]);

    res.json({
      success: true,
      data: {
        petType,
        count: products.length,
        items: products.map(p => ({
          id: p._id,
          name: p.name,
          brand: p.brand,
          source: p.source,
          currentPrice: p.currentPrice,
          previousPrice: p.previousPrice,
          discount: Math.round(p.discount * 10) / 10,
          imageUrl: p.imageUrl
        }))
      }
    });
  } catch (error) {
    logger.error(`Errore nel recuperare le offerte per ${req.params.petType}: ${error.message}`);
    next(error);
  }
}

/**
 * Trova i prodotti con le riduzioni di prezzo più recenti
 */
async function getTrendingDeals(req, res, next) {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const daysBack = parseInt(req.query.days) || 7;
    const minDiscount = parseFloat(req.query.minDiscount) || 5;

    // Calcola la data di inizio per il periodo di tendenza
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Trova i prodotti che hanno avuto riduzioni di prezzo recenti
    const recentPriceDrops = await PricePoint.aggregate([
      {
        $match: {
          recordedAt: { $gte: startDate }
        }
      },
      {
        $sort: { recordedAt: -1 }
      },
      {
        $group: {
          _id: '$productId',
          currentPrice: { $first: '$price.amount' },
          prices: { $push: '$price.amount' },
          dates: { $push: '$recordedAt' }
        }
      },
      {
        $project: {
          _id: 1,
          currentPrice: 1,
          previousPrice: { $arrayElemAt: ['$prices', 1] },
          discount: {
            $multiply: [
              {
                $divide: [
                  { $subtract: [{ $arrayElemAt: ['$prices', 1] }, '$currentPrice'] },
                  { $arrayElemAt: ['$prices', 1] }
                ]
              },
              100
            ]
          },
          daysAgo: {
            $divide: [
              { $subtract: [new Date(), { $arrayElemAt: ['$dates', 0] }] },
              1000 * 60 * 60 * 24 // millisecondi in un giorno
            ]
          }
        }
      },
      {
        $match: {
          discount: { $gte: minDiscount },
          previousPrice: { $exists: true, $ne: null }
        }
      },
      {
        $sort: { daysAgo: 1, discount: -1 }
      },
      {
        $limit: limit
      }
    ]);

    // Recupera i dettagli completi dei prodotti
    const productIds = recentPriceDrops.map(drop => drop._id);
    const productDetails = await Product.find({ _id: { $in: productIds } });

    // Combina i dettagli dei prodotti con le informazioni sugli sconti
    const result = recentPriceDrops.map(drop => {
      const product = productDetails.find(p => p._id.toString() === drop._id.toString());
      return {
        id: drop._id,
        name: product ? product.name : 'Prodotto non disponibile',
        brand: product ? product.brand : 'N/A',
        source: product ? product.source : 'N/A',
        currentPrice: drop.currentPrice,
        previousPrice: drop.previousPrice,
        discount: Math.round(drop.discount * 10) / 10,
        daysAgo: Math.round(drop.daysAgo),
        imageUrl: product ? product.imageUrl : null
      };
    });

    res.json({
      success: true,
      data: {
        count: result.length,
        items: result
      }
    });
  } catch (error) {
    logger.error(`Errore nel recuperare le offerte di tendenza: ${error.message}`);
    next(error);
  }
}

/**
 * Trova i prodotti con le maggiori riduzioni di prezzo
 */
async function getPriceDrops(req, res, next) {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    const minAmount = parseFloat(req.query.minAmount) || 5; // euro di riduzione minima
    
    // Trova i prodotti con le maggiori riduzioni di prezzo in valore assoluto
    const priceDrops = await Product.aggregate([
      { $match: { 'prices.1': { $exists: true } } },
      { $addFields: {
        currentPrice: { $arrayElemAt: ['$prices.price', 0] },
        previousPrice: { $arrayElemAt: ['$prices.price', 1] },
        // Calcola la riduzione come valore assoluto
        reduction: {
          $subtract: [
            { $arrayElemAt: ['$prices.price', 1] },
            { $arrayElemAt: ['$prices.price', 0] }
          ]
        }
      }},
      { $match: { reduction: { $gte: minAmount } } },
      { $sort: { reduction: -1 } },
      { $skip: offset },
      { $limit: limit }
    ]);
    
    res.json({
      success: true,
      data: {
        count: priceDrops.length,
        items: priceDrops.map(p => ({
          id: p._id,
          name: p.name,
          brand: p.brand,
          source: p.source,
          currentPrice: p.currentPrice,
          previousPrice: p.previousPrice,
          reduction: Math.round(p.reduction * 100) / 100, // arrotonda a 2 decimali
          imageUrl: p.imageUrl
        }))
      }
    });
  } catch (error) {
    logger.error(`Errore nel recuperare le riduzioni di prezzo: ${error.message}`);
    next(error);
  }
}

/**
 * Trova i prodotti con il miglior risparmio in una categoria specifica
 */
async function getDealsByCategory(req, res, next) {
  try {
    const { category } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    const minDiscount = parseFloat(req.query.minDiscount) || 10;
    
    // Cerca la categoria usando una regex case-insensitive
    const categoryRegex = new RegExp(category, 'i');
    
    // Trova i prodotti con sconti nella categoria specificata
    const products = await Product.aggregate([
      { $match: { 
        'prices.1': { $exists: true },
        category: categoryRegex
      }},
      { $addFields: {
        currentPrice: { $arrayElemAt: ['$prices.price', 0] },
        previousPrice: { $arrayElemAt: ['$prices.price', 1] },
        discount: {
          $multiply: [
            { $divide: [
              { $subtract: [
                { $arrayElemAt: ['$prices.price', 1] },
                { $arrayElemAt: ['$prices.price', 0] }
              ]},
              { $arrayElemAt: ['$prices.price', 1] }
            ]},
            100
          ]
        }
      }},
      { $match: { discount: { $gte: minDiscount } } },
      { $sort: { discount: -1 } },
      { $skip: offset },
      { $limit: limit }
    ]);
    
    res.json({
      success: true,
      data: {
        category,
        count: products.length,
        items: products.map(p => ({
          id: p._id,
          name: p.name,
          brand: p.brand,
          source: p.source,
          currentPrice: p.currentPrice,
          previousPrice: p.previousPrice,
          discount: Math.round(p.discount * 10) / 10,
          imageUrl: p.imageUrl
        }))
      }
    });
  } catch (error) {
    logger.error(`Errore nel recuperare i deals per categoria ${req.params.category}: ${error.message}`);
    next(error);
  }
}

/**
 * Trova i prodotti con il miglior risparmio per un brand specifico
 */
async function getDealsByBrand(req, res, next) {
  try {
    const { brand } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    const minDiscount = parseFloat(req.query.minDiscount) || 10;
    
    // Cerca il brand usando una regex case-insensitive
    const brandRegex = new RegExp(brand, 'i');
    
    // Trova i prodotti con sconti del brand specificato
    const products = await Product.aggregate([
      { $match: { 
        'prices.1': { $exists: true },
        brand: brandRegex
      }},
      { $addFields: {
        currentPrice: { $arrayElemAt: ['$prices.price', 0] },
        previousPrice: { $arrayElemAt: ['$prices.price', 1] },
        discount: {
          $multiply: [
            { $divide: [
              { $subtract: [
                { $arrayElemAt: ['$prices.price', 1] },
                { $arrayElemAt: ['$prices.price', 0] }
              ]},
              { $arrayElemAt: ['$prices.price', 1] }
            ]},
            100
          ]
        }
      }},
      { $match: { discount: { $gte: minDiscount } } },
      { $sort: { discount: -1 } },
      { $skip: offset },
      { $limit: limit }
    ]);
    
    res.json({
      success: true,
      data: {
        brand,
        count: products.length,
        items: products.map(p => ({
          id: p._id,
          name: p.name,
          brand: p.brand,
          source: p.source,
          currentPrice: p.currentPrice,
          previousPrice: p.previousPrice,
          discount: Math.round(p.discount * 10) / 10,
          imageUrl: p.imageUrl
        }))
      }
    });
  } catch (error) {
    logger.error(`Errore nel recuperare i deals per brand ${req.params.brand}: ${error.message}`);
    next(error);
  }
}

/**
 * Controller per la gestione delle offerte e sconti
 */
module.exports = {
  getBestDeals,
  getBestDealsByPetType,
  getTrendingDeals,
  getPriceDrops,
  getDealsByCategory,
  getDealsByBrand
}; 