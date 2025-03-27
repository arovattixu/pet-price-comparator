#!/usr/bin/env node

/**
 * Script di test per le API di confronto avanzato
 * Esegue richieste alle nuove API e mostra i risultati
 */
require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const logger = require('../utils/logger');

// Configurazione API
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api';
const HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};

// Configurazione MongoDB
const connectToDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    logger.info('Connesso a MongoDB');
    return true;
  } catch (error) {
    logger.error(`Errore di connessione a MongoDB: ${error.message}`);
    return false;
  }
};

/**
 * Ottiene un prodotto casuale dal database per i test
 */
const getRandomProduct = async () => {
  try {
    // Ottiene il conteggio totale dei prodotti
    const count = await Product.countDocuments();
    
    // Genera un indice casuale
    const random = Math.floor(Math.random() * count);
    
    // Ottiene un prodotto casuale
    const product = await Product.findOne().skip(random);
    
    return product;
  } catch (error) {
    logger.error(`Errore nel recupero di un prodotto casuale: ${error.message}`);
    return null;
  }
};

/**
 * Ottiene i prodotti di un brand specifico
 */
const getProductsByBrand = async (brand) => {
  try {
    const products = await Product.find({ brand: brand }).limit(1);
    return products.length > 0 ? products[0] : null;
  } catch (error) {
    logger.error(`Errore nel recupero dei prodotti del brand ${brand}: ${error.message}`);
    return null;
  }
};

/**
 * Formatta il JSON per la visualizzazione
 */
const formatJSON = (json) => {
  return JSON.stringify(json, null, 2);
};

/**
 * Esegue una richiesta API
 */
const makeRequest = async (method, endpoint, data = null, params = null) => {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    logger.info(`Richiesta ${method.toUpperCase()} a ${url}`);
    
    const config = {
      method,
      url,
      headers: HEADERS,
      ...(data && { data }),
      ...(params && { params })
    };
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    logger.error(`Errore nella richiesta: ${error.message}`);
    if (error.response) {
      logger.error(`Risposta del server: ${formatJSON(error.response.data)}`);
    }
    return null;
  }
};

/**
 * Test 1: Confronta prodotti con prezzi unitari
 */
const testCompareWithUnitPrices = async (productId) => {
  logger.info('=== TEST 1: Confronta prodotti con prezzi unitari ===');
  const result = await makeRequest('get', `/advanced-compare/unit-prices/${productId}`);
  
  if (result && result.success) {
    logger.info('Test completato con successo!');
    logger.info(`Prodotto originale: ${result.data.originalProduct.name}`);
    logger.info(`Gruppi totali: ${result.data.totalGroups}`);
    logger.info(`Prodotti totali: ${result.data.totalProducts}`);
    
    if (result.data.groupedProducts && result.data.groupedProducts.length > 0) {
      const firstGroup = result.data.groupedProducts[0];
      logger.info(`Esempio di gruppo: ${firstGroup.baseProduct} (${firstGroup.brand})`);
      logger.info(`Varianti: ${firstGroup.variants.length}`);
      logger.info(`Miglior valore: ${firstGroup.bestValue.name} - ${firstGroup.bestValue.unitPrice.formattedValue}`);
    }
  } else {
    logger.error('Test fallito');
  }
  
  return result;
};

/**
 * Test 2: Trova i prodotti con miglior rapporto qualità/prezzo per un brand
 */
const testFindBestValueByBrand = async (brand, category = null) => {
  logger.info('=== TEST 2: Trova i prodotti con miglior rapporto qualità/prezzo ===');
  const endpoint = category 
    ? `/advanced-compare/best-value/${brand}/${category}`
    : `/advanced-compare/best-value/${brand}`;
  
  const result = await makeRequest('get', endpoint);
  
  if (result && result.success) {
    logger.info('Test completato con successo!');
    logger.info(`Brand: ${result.data.brand}`);
    logger.info(`Categoria: ${result.data.category}`);
    logger.info(`Gruppi totali: ${result.data.groupCount}`);
    
    if (result.data.bestValueProducts && result.data.bestValueProducts.length > 0) {
      result.data.bestValueProducts.forEach((product, index) => {
        logger.info(`\nProdotto ${index + 1}: ${product.baseProduct}`);
        logger.info(`Miglior valore: ${product.bestValue.unitPrice.formattedValue}`);
        logger.info(`Range di prezzo: ${product.priceRange.min}€ - ${product.priceRange.max}€`);
        logger.info(`Varianti: ${product.variantCount}`);
      });
    }
  } else {
    logger.error('Test fallito');
  }
  
  return result;
};

/**
 * Test 3: Confronta diverse dimensioni di prodotti simili
 */
const testCompareSizes = async (namePattern) => {
  logger.info('=== TEST 3: Confronta diverse dimensioni di prodotti simili ===');
  const result = await makeRequest('get', '/advanced-compare/sizes', null, { namePattern });
  
  if (result && result.success) {
    logger.info('Test completato con successo!');
    logger.info(`Pattern ricercato: ${result.data.namePattern}`);
    logger.info(`Marche trovate: ${result.data.brandCount}`);
    logger.info(`Prodotti totali: ${result.data.productCount}`);
    
    if (result.data.brandComparison && result.data.brandComparison.length > 0) {
      result.data.brandComparison.forEach((brand, index) => {
        logger.info(`\nMarca ${index + 1}: ${brand.brand}`);
        logger.info(`Prodotti: ${brand.productCount}`);
        
        if (brand.bestValue) {
          logger.info(`Miglior valore: ${brand.bestValue.name}`);
          logger.info(`Prezzo: ${brand.bestValue.price}€`);
          logger.info(`Prezzo per kg: ${brand.bestValue.unitPrice.formattedValue}`);
        }
        
        if (brand.unitPriceRange) {
          logger.info(`Range prezzo unitario: ${brand.unitPriceRange.min.toFixed(2)}€/kg - ${brand.unitPriceRange.max.toFixed(2)}€/kg`);
        }
      });
    }
  } else {
    logger.error('Test fallito');
  }
  
  return result;
};

/**
 * Test 4: Aggiorna tutti i prezzi unitari
 */
const testUpdateAllUnitPrices = async (limit = 50) => {
  logger.info('=== TEST 4: Aggiorna tutti i prezzi unitari ===');
  const result = await makeRequest('post', '/advanced-compare/update-unit-prices', null, { limit });
  
  if (result && result.success) {
    logger.info('Test completato con successo!');
    logger.info(`Prodotti elaborati: ${result.data.totalProcessed}`);
    logger.info(`Prodotti aggiornati: ${result.data.updated}`);
    logger.info(`Prodotti falliti: ${result.data.failed}`);
    
    if (result.data.errors && result.data.errors.length > 0) {
      logger.info('\nPrimi errori:');
      result.data.errors.forEach((err, index) => {
        logger.info(`${index + 1}: ${err}`);
      });
    }
  } else {
    logger.error('Test fallito');
  }
  
  return result;
};

/**
 * Esegue tutti i test
 */
const runAllTests = async () => {
  try {
    // Connessione al database
    const connected = await connectToDB();
    if (!connected) {
      logger.error('Impossibile connettersi al database. Test annullati.');
      process.exit(1);
    }
    
    // Ottieni un prodotto casuale e un brand per i test
    const randomProduct = await getRandomProduct();
    if (!randomProduct) {
      logger.error('Nessun prodotto trovato nel database. Test annullati.');
      process.exit(1);
    }
    
    logger.info(`Prodotto scelto per i test: ${randomProduct.name} (${randomProduct._id})`);
    
    // Test 1: Confronta prodotti con prezzi unitari
    await testCompareWithUnitPrices(randomProduct._id);
    
    // Test 2: Trova i prodotti con miglior rapporto qualità/prezzo
    const brand = randomProduct.brand || 'Royal Canin';
    await testFindBestValueByBrand(brand);
    
    // Test 3: Confronta diverse dimensioni di prodotti simili
    const namePattern = randomProduct.name.split(' ').slice(0, 2).join(' ');
    await testCompareSizes(namePattern);
    
    // Test 4: Aggiorna tutti i prezzi unitari (limitato a 50 prodotti per il test)
    await testUpdateAllUnitPrices(50);
    
    logger.info('\nTutti i test completati!');
    
  } catch (error) {
    logger.error(`Errore nell'esecuzione dei test: ${error.message}`);
  } finally {
    // Chiudi la connessione al database
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      logger.info('Connessione al database chiusa');
    }
  }
};

// Avvia i test
runAllTests(); 