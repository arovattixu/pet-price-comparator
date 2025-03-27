#!/usr/bin/env node

/**
 * Script per assegnare correttamente i tipi di animale ai prodotti esistenti
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

// Determina il petType da nome e categoria
function determinePetType(name, category) {
  const nameLower = (name || '').toLowerCase();
  const categoryLower = (category || '').toLowerCase();
  
  if (nameLower.includes('cane') || 
      nameLower.includes('cani') || 
      categoryLower.includes('cane') || 
      categoryLower.includes('cani')) {
    return 'cane';
  }
  
  if (nameLower.includes('gatto') || 
      nameLower.includes('gatti') || 
      categoryLower.includes('gatto') || 
      categoryLower.includes('gatti')) {
    return 'gatto';
  }
  
  if (nameLower.includes('roditore') || 
      nameLower.includes('roditori') || 
      categoryLower.includes('roditore') || 
      categoryLower.includes('roditori') ||
      categoryLower.includes('piccoli animali') ||
      nameLower.includes('piccoli animali')) {
    return 'piccoli animali';
  }
  
  // Default
  return 'altro';
}

async function migratePetTypes() {
  console.log('=== MIGRAZIONE TIPI DI ANIMALE ===');
  console.log(`Data: ${new Date().toISOString()}`);
  console.log('==================================');
  
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
    
    // Collezione prodotti
    const productsCollection = db.collection('products');
    
    // Statistiche
    let stats = {
      processed: 0,
      cane: 0,
      gatto: 0,
      piccoli_animali: 0,
      altro: 0,
      errors: 0
    };
    
    // Recupera tutti i prodotti
    const cursor = productsCollection.find({});
    
    // Elabora i prodotti in batch
    const BATCH_SIZE = 100;
    let products = [];
    let batch = 0;
    
    // Funzione per elaborare un batch di prodotti
    async function processBatch(productsBatch) {
      const operations = [];
      
      for (const product of productsBatch) {
        try {
          stats.processed++;
          
          // Assegna il petType in base a nome e categoria
          const petType = determinePetType(product.name, product.category);
          
          // Aggiorna le statistiche
          if (petType === 'cane') stats.cane++;
          else if (petType === 'gatto') stats.gatto++;
          else if (petType === 'piccoli animali') stats.piccoli_animali++;
          else stats.altro++;
          
          // Aggiungi l'operazione di aggiornamento
          operations.push({
            updateOne: {
              filter: { _id: product._id },
              update: { $set: { petType } }
            }
          });
        } catch (error) {
          console.error(`Errore nell'elaborazione del prodotto ${product._id}: ${error.message}`);
          stats.errors++;
        }
      }
      
      // Esegui le operazioni in un'unica richiesta
      if (operations.length > 0) {
        await productsCollection.bulkWrite(operations);
      }
    }
    
    // Elabora i prodotti in batch
    while (await cursor.hasNext()) {
      const product = await cursor.next();
      products.push(product);
      
      if (products.length >= BATCH_SIZE) {
        batch++;
        console.log(`Elaborazione batch ${batch}...`);
        
        await processBatch(products);
        console.log(`Batch ${batch} completato. Prodotti elaborati: ${stats.processed}`);
        
        products = [];
      }
    }
    
    // Elabora gli ultimi prodotti se ce ne sono
    if (products.length > 0) {
      batch++;
      console.log(`Elaborazione batch ${batch} (finale)...`);
      
      await processBatch(products);
      console.log(`Batch ${batch} completato. Prodotti elaborati: ${stats.processed}`);
    }
    
    // Stampa le statistiche
    console.log(`
Migrazione completata:
- Prodotti elaborati: ${stats.processed}
- Assegnati come cane: ${stats.cane}
- Assegnati come gatto: ${stats.gatto}
- Assegnati come piccoli animali: ${stats.piccoli_animali}
- Assegnati come altro: ${stats.altro}
- Errori: ${stats.errors}
    `);
    
    console.log('==================================');
    
  } catch (error) {
    console.error(`Errore durante la migrazione: ${error.message}`);
    console.error(error.stack);
  } finally {
    // Chiudi la connessione
    await client.close();
    console.log('Connessione al database chiusa');
  }
}

// Esegui la migrazione
migratePetTypes()
  .then(() => {
    console.log('Migrazione completata con successo');
    process.exit(0);
  })
  .catch(error => {
    console.error(`Errore: ${error.message}`);
    process.exit(1);
  }); 