const Product = require('../../db/models/Product');
const PricePoint = require('../../db/models/PricePoint');
const logger = require('../../utils/logger');
const mongoose = require('mongoose');
const moment = require('moment');

/**
 * Ottiene lo storico dei prezzi di un prodotto con analisi
 * Include statistiche sul prezzo e tendenze nel tempo
 */
async function getProductPriceHistory(req, res, next) {
  try {
    const { productId } = req.params;
    const { period = 'all', source } = req.query;
    
    // Verifica che il prodotto esista
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        error: { message: 'Prodotto non trovato', code: 'PRODUCT_NOT_FOUND' }
      });
    }
    
    // Definisci la data di inizio in base al periodo richiesto
    let startDate = null;
    const now = new Date();
    
    switch (period) {
      case '7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90days':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
      default:
        startDate = null;
        break;
    }
    
    // Prepara la query
    const query = { productId: new mongoose.Types.ObjectId(productId) };
    
    if (startDate) {
      query.recordedAt = { $gte: startDate };
    }
    
    if (source) {
      query.source = source;
    }
    
    // Ottieni i price points
    const pricePoints = await PricePoint.find(query)
      .sort({ recordedAt: 1 });
    
    if (pricePoints.length === 0) {
      return res.json({
        data: {
          product: {
            id: product._id,
            name: product.name,
            source: product.source
          },
          priceHistory: [],
          analysis: {
            min: null,
            max: null,
            avg: null,
            trend: 'stable',
            hasPriceDrops: false
          }
        }
      });
    }
    
    // Raggruppa i prezzi per fonte
    const pricesBySource = {};
    
    pricePoints.forEach(point => {
      const source = point.source;
      if (!pricesBySource[source]) {
        pricesBySource[source] = [];
      }
      
      pricesBySource[source].push({
        date: point.recordedAt,
        price: point.price.amount,
        variantId: point.variantId
      });
    });
    
    // Calcola statistiche per ogni fonte
    const sourceAnalysis = {};
    const priceHistory = {};
    
    for (const [source, prices] of Object.entries(pricesBySource)) {
      // Statistiche base
      const priceValues = prices.map(p => p.price);
      const min = Math.min(...priceValues);
      const max = Math.max(...priceValues);
      const avg = priceValues.reduce((sum, price) => sum + price, 0) / priceValues.length;
      
      // Calcola la tendenza del prezzo
      let trend = 'stable';
      if (prices.length > 1) {
        const firstPrice = prices[0].price;
        const lastPrice = prices[prices.length - 1].price;
        const priceDiff = lastPrice - firstPrice;
        const percentChange = (priceDiff / firstPrice) * 100;
        
        if (percentChange < -5) {
          trend = 'decreasing';
        } else if (percentChange > 5) {
          trend = 'increasing';
        }
      }
      
      // Verifica se ci sono riduzioni di prezzo
      let hasPriceDrops = false;
      for (let i = 1; i < prices.length; i++) {
        if (prices[i].price < prices[i-1].price) {
          hasPriceDrops = true;
          break;
        }
      }
      
      // Formatta la cronologia dei prezzi per la visualizzazione
      const history = prices.map(point => ({
        date: point.date,
        price: point.price,
        variantId: point.variantId
      }));
      
      // Memorizza analisi e cronologia
      sourceAnalysis[source] = {
        min,
        max,
        avg: avg.toFixed(2),
        trend,
        hasPriceDrops,
        pricePoints: prices.length
      };
      
      priceHistory[source] = history;
    }
    
    // Calcola le statistiche complessive
    const allPrices = pricePoints.map(p => p.price.amount);
    const overallMin = Math.min(...allPrices);
    const overallMax = Math.max(...allPrices);
    const overallAvg = allPrices.reduce((sum, price) => sum + price, 0) / allPrices.length;
    
    // Determina la tendenza complessiva
    let overallTrend = 'stable';
    if (pricePoints.length > 1) {
      const firstPrice = pricePoints[0].price.amount;
      const lastPrice = pricePoints[pricePoints.length - 1].price.amount;
      const priceDiff = lastPrice - firstPrice;
      const percentChange = (priceDiff / firstPrice) * 100;
      
      if (percentChange < -5) {
        overallTrend = 'decreasing';
      } else if (percentChange > 5) {
        overallTrend = 'increasing';
      }
    }
    
    // Verifica se ci sono riduzioni di prezzo complessive
    let overallHasPriceDrops = false;
    for (let i = 1; i < pricePoints.length; i++) {
      if (pricePoints[i].price.amount < pricePoints[i-1].price.amount) {
        overallHasPriceDrops = true;
        break;
      }
    }
    
    res.json({
      data: {
        product: {
          id: product._id,
          name: product.name,
          brand: product.brand,
          petType: product.petType,
          imageUrl: product.imageUrl
        },
        priceHistory,
        analysis: {
          overall: {
            min: overallMin,
            max: overallMax,
            avg: overallAvg.toFixed(2),
            trend: overallTrend,
            hasPriceDrops: overallHasPriceDrops,
            pricePoints: pricePoints.length
          },
          bySource: sourceAnalysis
        }
      }
    });
    
  } catch (error) {
    logger.error(`Errore nel recuperare lo storico prezzi del prodotto ${req.params.productId}: ${error.message}`);
    next(error);
  }
}

/**
 * Ottiene l'andamento dei prezzi per un tipo di animale
 * Analizza le variazioni di prezzo nel tempo per prodotti dello stesso tipo
 */
async function getPetTypePriceTrends(req, res, next) {
  try {
    const { petType } = req.params;
    const { period = '30days', limit = 10 } = req.query;
    const limitNum = parseInt(limit);
    
    // Definisci la data di inizio in base al periodo richiesto
    let startDate = null;
    const now = new Date();
    
    switch (period) {
      case '7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90days':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Default a 30 giorni
        break;
    }
    
    // Cerca prodotti del tipo specificato
    const products = await Product.find({ petType });
    const productIds = products.map(p => p._id);
    
    // Cerca price points per questi prodotti
    const pricePointsQuery = {
      productId: { $in: productIds },
      recordedAt: { $gte: startDate }
    };
    
    // Analisi dei prezzi per tipo di animale usando aggregation pipeline
    const priceTrends = await PricePoint.aggregate([
      // Filtra per prodotti del tipo specifico e periodo
      { $match: pricePointsQuery },
      
      // Raggruppa per fonte e data (giorno)
      {
        $group: {
          _id: {
            source: "$source",
            date: {
              $dateToString: { format: "%Y-%m-%d", date: "$recordedAt" }
            }
          },
          avgPrice: { $avg: "$price.amount" },
          minPrice: { $min: "$price.amount" },
          maxPrice: { $max: "$price.amount" },
          count: { $sum: 1 }
        }
      },
      
      // Ordina per fonte e data
      { $sort: { "_id.source": 1, "_id.date": 1 } },
      
      // Raggruppa di nuovo per fonte per ottenere la serie temporale
      {
        $group: {
          _id: "$_id.source",
          prices: {
            $push: {
              date: "$_id.date",
              avg: { $round: ["$avgPrice", 2] },
              min: { $round: ["$minPrice", 2] },
              max: { $round: ["$maxPrice", 2] },
              count: "$count"
            }
          }
        }
      }
    ]);
    
    // Prepara i dati per la risposta API
    const formattedTrends = priceTrends.map(trend => {
      const source = trend._id;
      
      // Calcola la variazione di prezzo dall'inizio alla fine
      const firstPrice = trend.prices[0]?.avg || 0;
      const lastPrice = trend.prices[trend.prices.length - 1]?.avg || 0;
      
      const priceDiff = lastPrice - firstPrice;
      const percentChange = firstPrice > 0 ? (priceDiff / firstPrice) * 100 : 0;
      
      // Determina la tendenza
      let trendDirection = 'stable';
      if (percentChange < -5) {
        trendDirection = 'decreasing';
      } else if (percentChange > 5) {
        trendDirection = 'increasing';
      }
      
      return {
        source,
        priceData: trend.prices,
        analysis: {
          initialPrice: firstPrice.toFixed(2),
          finalPrice: lastPrice.toFixed(2),
          change: priceDiff.toFixed(2),
          percentChange: percentChange.toFixed(2) + '%',
          trend: trendDirection
        }
      };
    });
    
    // Calcola le statistiche di categoria complessive
    const categoryStats = {
      totalProducts: products.length,
      averagePrice: 0,
      priceRange: { min: 0, max: 0 },
      priceTrend: 'stable',
      mostExpensiveSource: '',
      cheapestSource: ''
    };
    
    // Calcola il prezzo medio attuale per fonte
    const sourceAvgPrices = {};
    
    formattedTrends.forEach(trend => {
      const lastPricePoint = trend.priceData[trend.priceData.length - 1];
      if (lastPricePoint) {
        sourceAvgPrices[trend.source] = parseFloat(lastPricePoint.avg);
      }
    });
    
    // Determina la fonte più costosa e più economica
    if (Object.keys(sourceAvgPrices).length > 0) {
      const sources = Object.keys(sourceAvgPrices);
      let maxSource = sources[0];
      let minSource = sources[0];
      
      sources.forEach(source => {
        if (sourceAvgPrices[source] > sourceAvgPrices[maxSource]) {
          maxSource = source;
        }
        if (sourceAvgPrices[source] < sourceAvgPrices[minSource]) {
          minSource = source;
        }
      });
      
      categoryStats.mostExpensiveSource = maxSource;
      categoryStats.cheapestSource = minSource;
      
      // Calcola il prezzo medio complessivo
      const avgPrices = Object.values(sourceAvgPrices);
      categoryStats.averagePrice = (avgPrices.reduce((sum, p) => sum + p, 0) / avgPrices.length).toFixed(2);
      
      // Imposta il range di prezzo
      categoryStats.priceRange.min = Math.min(...avgPrices).toFixed(2);
      categoryStats.priceRange.max = Math.max(...avgPrices).toFixed(2);
    }
    
    res.json({
      data: {
        petType,
        trends: formattedTrends,
        stats: categoryStats,
        period
      }
    });
    
  } catch (error) {
    logger.error(`Errore nel recuperare i trend di prezzo per ${req.params.petType}: ${error.message}`);
    next(error);
  }
}

/**
 * Ottiene l'andamento dei prezzi per una categoria
 */
async function getCategoryPriceTrends(req, res, next) {
  try {
    const { category } = req.params;
    const { period = '30days', limit = 10 } = req.query;
    const limitNum = parseInt(limit);
    
    // Definisci la data di inizio in base al periodo richiesto
    let startDate = null;
    const now = new Date();
    
    switch (period) {
      case '7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90days':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Default a 30 giorni
        break;
    }
    
    // Cerca prodotti della categoria specificata
    const products = await Product.find({ 
      category: { $regex: category, $options: 'i' }
    });
    const productIds = products.map(p => p._id);
    
    // Cerca price points per questi prodotti
    const pricePointsQuery = {
      productId: { $in: productIds },
      recordedAt: { $gte: startDate }
    };
    
    // Analisi dei prezzi per categoria usando aggregation pipeline
    const priceTrends = await PricePoint.aggregate([
      // Filtra per prodotti della categoria e periodo
      { $match: pricePointsQuery },
      
      // Raggruppa per fonte e data (giorno)
      {
        $group: {
          _id: {
            source: "$source",
            date: {
              $dateToString: { format: "%Y-%m-%d", date: "$recordedAt" }
            }
          },
          avgPrice: { $avg: "$price.amount" },
          minPrice: { $min: "$price.amount" },
          maxPrice: { $max: "$price.amount" },
          count: { $sum: 1 }
        }
      },
      
      // Ordina per fonte e data
      { $sort: { "_id.source": 1, "_id.date": 1 } },
      
      // Raggruppa di nuovo per fonte per ottenere la serie temporale
      {
        $group: {
          _id: "$_id.source",
          prices: {
            $push: {
              date: "$_id.date",
              avg: { $round: ["$avgPrice", 2] },
              min: { $round: ["$minPrice", 2] },
              max: { $round: ["$maxPrice", 2] },
              count: "$count"
            }
          }
        }
      }
    ]);
    
    // Prepara i dati per la risposta API
    const formattedTrends = priceTrends.map(trend => {
      const source = trend._id;
      
      // Calcola la variazione di prezzo dall'inizio alla fine
      const firstPrice = trend.prices[0]?.avg || 0;
      const lastPrice = trend.prices[trend.prices.length - 1]?.avg || 0;
      
      const priceDiff = lastPrice - firstPrice;
      const percentChange = firstPrice > 0 ? (priceDiff / firstPrice) * 100 : 0;
      
      // Determina la tendenza
      let trendDirection = 'stable';
      if (percentChange < -5) {
        trendDirection = 'decreasing';
      } else if (percentChange > 5) {
        trendDirection = 'increasing';
      }
      
      return {
        source,
        priceData: trend.prices,
        analysis: {
          initialPrice: firstPrice.toFixed(2),
          finalPrice: lastPrice.toFixed(2),
          change: priceDiff.toFixed(2),
          percentChange: percentChange.toFixed(2) + '%',
          trend: trendDirection
        }
      };
    });
    
    // Calcola le statistiche di categoria complessive
    const categoryStats = {
      totalProducts: products.length,
      averagePrice: 0,
      priceRange: { min: 0, max: 0 },
      priceTrend: 'stable',
      mostExpensiveSource: '',
      cheapestSource: ''
    };
    
    // Calcola il prezzo medio attuale per fonte
    const sourceAvgPrices = {};
    
    formattedTrends.forEach(trend => {
      const lastPricePoint = trend.priceData[trend.priceData.length - 1];
      if (lastPricePoint) {
        sourceAvgPrices[trend.source] = parseFloat(lastPricePoint.avg);
      }
    });
    
    // Determina la fonte più costosa e più economica
    if (Object.keys(sourceAvgPrices).length > 0) {
      const sources = Object.keys(sourceAvgPrices);
      let maxSource = sources[0];
      let minSource = sources[0];
      
      sources.forEach(source => {
        if (sourceAvgPrices[source] > sourceAvgPrices[maxSource]) {
          maxSource = source;
        }
        if (sourceAvgPrices[source] < sourceAvgPrices[minSource]) {
          minSource = source;
        }
      });
      
      categoryStats.mostExpensiveSource = maxSource;
      categoryStats.cheapestSource = minSource;
      
      // Calcola il prezzo medio complessivo
      const avgPrices = Object.values(sourceAvgPrices);
      categoryStats.averagePrice = (avgPrices.reduce((sum, p) => sum + p, 0) / avgPrices.length).toFixed(2);
      
      // Imposta il range di prezzo
      categoryStats.priceRange.min = Math.min(...avgPrices).toFixed(2);
      categoryStats.priceRange.max = Math.max(...avgPrices).toFixed(2);
    }
    
    res.json({
      data: {
        category,
        trends: formattedTrends,
        stats: categoryStats,
        period
      }
    });
    
  } catch (error) {
    logger.error(`Errore nel recuperare i trend di prezzo per ${req.params.category}: ${error.message}`);
    next(error);
  }
}

/**
 * Ottiene l'andamento dei prezzi per un negozio
 */
async function getStorePriceTrends(req, res, next) {
  try {
    const { store } = req.params;
    const { period = '30days', category, petType } = req.query;
    
    // Definisci la data di inizio in base al periodo richiesto
    let startDate = null;
    const now = new Date();
    
    switch (period) {
      case '7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90days':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }
    
    // Prepara pipeline di aggregazione per price points
    const matchStage = {
      source: store,
      recordedAt: { $gte: startDate }
    };
    
    // Aggiungi filtri opzionali se richiesti
    let productFilters = {};
    if (category) {
      productFilters.category = { $regex: category, $options: 'i' };
    }
    if (petType) {
      productFilters.petType = petType;
    }
    
    let productIds = [];
    if (Object.keys(productFilters).length > 0) {
      const filteredProducts = await Product.find(productFilters);
      productIds = filteredProducts.map(p => p._id);
      matchStage.productId = { $in: productIds };
    }
    
    // Esegui aggregazione per ottenere trend
    const priceTrends = await PricePoint.aggregate([
      { $match: matchStage },
      
      // Raggruppa per data (giorno)
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: "%Y-%m-%d", date: "$recordedAt" }
            }
          },
          avgPrice: { $avg: "$price.amount" },
          minPrice: { $min: "$price.amount" },
          maxPrice: { $max: "$price.amount" },
          count: { $sum: 1 }
        }
      },
      
      // Ordina per data
      { $sort: { "_id.date": 1 } },
      
      // Formatta i risultati
      {
        $project: {
          _id: 0,
          date: "$_id.date",
          avg: { $round: ["$avgPrice", 2] },
          min: { $round: ["$minPrice", 2] },
          max: { $round: ["$maxPrice", 2] },
          count: "$count"
        }
      }
    ]);
    
    // Calcola statistiche
    let firstPrice = 0;
    let lastPrice = 0;
    let trendDirection = 'stable';
    
    if (priceTrends.length > 0) {
      firstPrice = priceTrends[0].avg;
      lastPrice = priceTrends[priceTrends.length - 1].avg;
      
      const priceDiff = lastPrice - firstPrice;
      const percentChange = firstPrice > 0 ? (priceDiff / firstPrice) * 100 : 0;
      
      if (percentChange < -5) {
        trendDirection = 'decreasing';
      } else if (percentChange > 5) {
        trendDirection = 'increasing';
      }
    }
    
    // Ottieni categorie più rappresentate nel negozio
    const topCategories = await Product.aggregate([
      { $match: { source: store } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    res.json({
      data: {
        store,
        priceData: priceTrends,
        analysis: {
          initialPrice: firstPrice.toFixed(2),
          finalPrice: lastPrice.toFixed(2),
          change: (lastPrice - firstPrice).toFixed(2),
          percentChange: ((lastPrice - firstPrice) / (firstPrice || 1) * 100).toFixed(2) + '%',
          trend: trendDirection,
          dataPoints: priceTrends.length
        },
        topCategories: topCategories.map(cat => ({
          category: cat._id,
          productCount: cat.count
        })),
        period
      }
    });
    
  } catch (error) {
    logger.error(`Errore nel recuperare i trend di prezzo per ${req.params.store}: ${error.message}`);
    next(error);
  }
}

/**
 * Ottiene l'andamento dei prezzi per un brand
 */
async function getBrandPriceTrends(req, res, next) {
  try {
    const { brand } = req.params;
    const { period = '30days' } = req.query;
    
    // Definisci la data di inizio in base al periodo richiesto
    let startDate = null;
    const now = new Date();
    
    switch (period) {
      case '7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90days':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }
    
    // Cerca prodotti del brand
    const products = await Product.find({ 
      brand: { $regex: brand, $options: 'i' }
    });
    
    const productIds = products.map(p => p._id);
    
    // Cerca price points per questi prodotti
    const pricePointsQuery = {
      productId: { $in: productIds },
      recordedAt: { $gte: startDate }
    };
    
    // Analisi dei prezzi per brand usando aggregation pipeline
    const priceTrends = await PricePoint.aggregate([
      // Filtra per prodotti del brand e periodo
      { $match: pricePointsQuery },
      
      // Raggruppa per fonte e data (giorno)
      {
        $group: {
          _id: {
            source: "$source",
            date: {
              $dateToString: { format: "%Y-%m-%d", date: "$recordedAt" }
            }
          },
          avgPrice: { $avg: "$price.amount" },
          minPrice: { $min: "$price.amount" },
          maxPrice: { $max: "$price.amount" },
          count: { $sum: 1 }
        }
      },
      
      // Ordina per fonte e data
      { $sort: { "_id.source": 1, "_id.date": 1 } },
      
      // Raggruppa di nuovo per fonte per ottenere la serie temporale
      {
        $group: {
          _id: "$_id.source",
          prices: {
            $push: {
              date: "$_id.date",
              avg: { $round: ["$avgPrice", 2] },
              min: { $round: ["$minPrice", 2] },
              max: { $round: ["$maxPrice", 2] },
              count: "$count"
            }
          }
        }
      }
    ]);
    
    // Prepara i dati per la risposta API
    const formattedTrends = priceTrends.map(trend => {
      const source = trend._id;
      
      // Calcola la variazione di prezzo dall'inizio alla fine
      const firstPrice = trend.prices[0]?.avg || 0;
      const lastPrice = trend.prices[trend.prices.length - 1]?.avg || 0;
      
      const priceDiff = lastPrice - firstPrice;
      const percentChange = firstPrice > 0 ? (priceDiff / firstPrice) * 100 : 0;
      
      // Determina la tendenza
      let trendDirection = 'stable';
      if (percentChange < -5) {
        trendDirection = 'decreasing';
      } else if (percentChange > 5) {
        trendDirection = 'increasing';
      }
      
      return {
        source,
        priceData: trend.prices,
        analysis: {
          initialPrice: firstPrice.toFixed(2),
          finalPrice: lastPrice.toFixed(2),
          change: priceDiff.toFixed(2),
          percentChange: percentChange.toFixed(2) + '%',
          trend: trendDirection
        }
      };
    });
    
    // Ottieni le categorie principali per il brand
    const brandCategories = await Product.aggregate([
      { $match: { brand: { $regex: brand, $options: 'i' } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    res.json({
      data: {
        brand,
        trends: formattedTrends,
        stats: {
          totalProducts: products.length,
          topCategories: brandCategories.map(cat => ({
            category: cat._id,
            productCount: cat.count
          }))
        },
        period
      }
    });
    
  } catch (error) {
    logger.error(`Errore nel recuperare i trend di prezzo per ${req.params.brand}: ${error.message}`);
    next(error);
  }
}

/**
 * Confronta l'andamento dei prezzi tra diversi prodotti
 */
async function comparePriceTrends(req, res, next) {
  try {
    const { productIds, period = '30days' } = req.query;
    
    if (!productIds) {
      return res.status(400).json({
        error: { message: 'Parametro productIds richiesto', code: 'MISSING_PRODUCT_IDS' }
      });
    }
    
    const productIdArray = productIds.split(',');
    
    // Definisci la data di inizio in base al periodo richiesto
    let startDate = null;
    const now = new Date();
    
    switch (period) {
      case '7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90days':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }
    
    // Converti gli ID in ObjectID
    const objectIds = productIdArray.map(id => new mongoose.Types.ObjectId(id));
    
    // Ottieni i dettagli dei prodotti
    const products = await Product.find({ _id: { $in: objectIds } });
    
    // Crea un mapping per un facile accesso
    const productMap = {};
    products.forEach(p => {
      productMap[p._id.toString()] = p;
    });
    
    // Ottieni i price points per i prodotti
    const pricePoints = await PricePoint.find({
      productId: { $in: objectIds },
      recordedAt: { $gte: startDate }
    }).sort({ recordedAt: 1 });
    
    // Raggruppa i prezzi per prodotto e fonte
    const pricesByProduct = {};
    
    pricePoints.forEach(point => {
      const productId = point.productId.toString();
      const source = point.source;
      const key = `${productId}-${source}`;
      
      if (!pricesByProduct[key]) {
        pricesByProduct[key] = {
          productId,
          productName: productMap[productId]?.name || 'Prodotto sconosciuto',
          source,
          prices: []
        };
      }
      
      pricesByProduct[key].prices.push({
        date: point.recordedAt,
        price: point.price.amount
      });
    });
    
    // Calcola le variazioni di prezzo per ogni prodotto
    const comparisonData = Object.values(pricesByProduct).map(item => {
      const { productId, productName, source, prices } = item;
      
      if (prices.length === 0) {
        return {
          productId,
          productName,
          source,
          prices: [],
          analysis: {
            change: 0,
            percentChange: '0%',
            trend: 'stable'
          }
        };
      }
      
      const firstPrice = prices[0].price;
      const lastPrice = prices[prices.length - 1].price;
      const priceDiff = lastPrice - firstPrice;
      const percentChange = firstPrice > 0 ? (priceDiff / firstPrice) * 100 : 0;
      
      let trendDirection = 'stable';
      if (percentChange < -5) {
        trendDirection = 'decreasing';
      } else if (percentChange > 5) {
        trendDirection = 'increasing';
      }
      
      return {
        productId,
        productName,
        source,
        product: productMap[productId],
        prices,
        analysis: {
          initialPrice: firstPrice.toFixed(2),
          finalPrice: lastPrice.toFixed(2),
          change: priceDiff.toFixed(2),
          percentChange: percentChange.toFixed(2) + '%',
          trend: trendDirection
        }
      };
    });
    
    // Ordina per variazione di prezzo (dal più economico al più costoso)
    comparisonData.sort((a, b) => {
      return parseFloat(a.analysis.change) - parseFloat(b.analysis.change);
    });
    
    res.json({
      data: {
        products: products.map(p => ({
          id: p._id,
          name: p.name,
          brand: p.brand,
          source: p.source,
          imageUrl: p.imageUrl
        })),
        comparisons: comparisonData,
        period
      }
    });
    
  } catch (error) {
    logger.error(`Errore nel confrontare i trend di prezzo: ${error.message}`);
    next(error);
  }
}

module.exports = {
  getProductPriceHistory,
  getPetTypePriceTrends,
  getCategoryPriceTrends,
  getStorePriceTrends,
  getBrandPriceTrends,
  comparePriceTrends
}; 