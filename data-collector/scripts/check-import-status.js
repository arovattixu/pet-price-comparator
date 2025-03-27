#!/usr/bin/env node

/**
 * Script per verificare lo stato dell'importazione
 * Controlla il numero di prodotti nel database e per fonte
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

// Configurazione
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pet-price-comparator';

// Estrai il nome del database dall'URI
function getDatabaseName(uri) {
  const parts = uri.split('/');
  let dbName = parts[parts.length - 1];
  if (dbName.includes('?')) {
    dbName = dbName.split('?')[0];
  }
  return dbName;
}

async function checkImportStatus() {
  console.log('=== STATO IMPORTAZIONE PRODOTTI ===');
  console.log(`Data: ${new Date().toISOString()}`);
  console.log('===================================');
  
  // Configura client MongoDB
  const client = new MongoClient(MONGODB_URI, {
    connectTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    serverSelectionTimeoutMS: 30000
  });
  
  try {
    // Connetti al database
    await client.connect();
    console.log('Connesso al database MongoDB');
    
    const dbName = getDatabaseName(MONGODB_URI);
    const db = client.db(dbName);
    
    // Collezioni
    const productsCollection = db.collection('products');
    const pricePointsCollection = db.collection('pricepoints');
    
    // Statistiche generali
    const totalProducts = await productsCollection.countDocuments();
    const totalPricePoints = await pricePointsCollection.countDocuments();
    
    console.log(`Totale prodotti nel database: ${totalProducts}`);
    console.log(`Totale price points nel database: ${totalPricePoints}`);
    
    // Statistiche per fonte
    const sources = ['arcaplanet', 'zooplus'];
    for (const source of sources) {
      const sourceProducts = await productsCollection.countDocuments({ source });
      console.log(`Prodotti da ${source}: ${sourceProducts}`);
    }
    
    // Statistiche per tipo di animale
    const petTypes = ['cane', 'gatto', 'piccoli animali', 'altro'];
    for (const petType of petTypes) {
      const petProducts = await productsCollection.countDocuments({ petType });
      console.log(`Prodotti per ${petType}: ${petProducts}`);
    }
    
    // Prodotti con più di una fonte di prezzo
    const multiSourceProducts = await productsCollection.countDocuments({
      'prices.1': { $exists: true }
    });
    
    console.log(`Prodotti con prezzi da più fonti: ${multiSourceProducts}`);
    
    // Prodotti modificati recentemente
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const recentlyUpdated = await productsCollection.countDocuments({
      updatedAt: { $gte: oneDayAgo }
    });
    
    console.log(`Prodotti aggiornati nelle ultime 24 ore: ${recentlyUpdated}`);
    
    // Prezzi registrati recentemente
    const recentPricePoints = await pricePointsCollection.countDocuments({
      recordedAt: { $gte: oneDayAgo }
    });
    
    console.log(`Punti prezzo registrati nelle ultime 24 ore: ${recentPricePoints}`);
    
    console.log('===================================');
    
  } catch (error) {
    console.error(`Errore durante il controllo dello stato: ${error.message}`);
    console.error(error.stack);
  } finally {
    // Chiudi la connessione
    await client.close();
    console.log('Connessione al database chiusa');
  }
}

// Esegui
checkImportStatus()
  .then(() => {
    console.log('Controllo stato completato');
    process.exit(0);
  })
  .catch(error => {
    console.error(`Errore: ${error.message}`);
    process.exit(1);
  }); 