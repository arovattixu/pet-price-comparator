#!/usr/bin/env node

/**
 * Script per popolare la tabella dei prodotti simili nel database
 * Questo script analizza i prodotti e salva le relazioni di similarità
 * per essere utilizzate dall'API
 */

require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

// Configurazione
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pet-price-comparator';
const SIMILARITY_THRESHOLD = 0.7; // Soglia di similarità (0-1)
const BATCH_SIZE = 500; // Numero di prodotti da processare in un batch

// Estrai il nome del database dall'URI
function getDatabaseName(uri) {
  const parts = uri.split('/');
  let dbName = parts[parts.length - 1];
  if (dbName.includes('?')) {
    dbName = dbName.split('?')[0];
  }
  return dbName;
}

/**
 * Elimina le parole comuni e i caratteri speciali
 * @param {string} text - Testo da normalizzare
 * @returns {string} - Testo normalizzato
 */
function normalizeText(text) {
  if (!text) return '';
  
  // Converti in minuscolo
  let normalized = text.toLowerCase();
  
  // Rimuovi caratteri speciali
  normalized = normalized.replace(/[^\w\s]/g, ' ');
  
  // Rimuovi numeri
  normalized = normalized.replace(/\d+/g, '');
  
  // Rimuovi parole comuni
  const stopWords = ['e', 'con', 'di', 'a', 'da', 'in', 'su', 'per', 'tra', 'fra', 'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una'];
  let words = normalized.split(/\s+/);
  words = words.filter(word => word.length > 2 && !stopWords.includes(word));
  
  // Rimuovi parti di grandezza (kg, g, cm, etc.)
  words = words.filter(word => !word.match(/^(kg|g|gr|cm|ml|lt|l)$/));
  
  return words.join(' ');
}

/**
 * Calcola la somiglianza tra due stringhe (Jaccard similarity)
 * @param {string} str1 - Prima stringa
 * @param {string} str2 - Seconda stringa
 * @returns {number} - Somiglianza (0-1)
 */
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  // Normalizza le stringhe
  const normalizedStr1 = normalizeText(str1);
  const normalizedStr2 = normalizeText(str2);
  
  // Dividi in parole
  const words1 = new Set(normalizedStr1.split(/\s+/).filter(Boolean));
  const words2 = new Set(normalizedStr2.split(/\s+/).filter(Boolean));
  
  // Calcola l'intersezione
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  
  // Calcola l'unione
  const union = new Set([...words1, ...words2]);
  
  // Calcola la similarità di Jaccard
  return intersection.size / union.size;
}

/**
 * Popola la tabella dei prodotti simili
 */
async function populateSimilarProducts() {
  console.log('=== POPOLAMENTO PRODOTTI SIMILI ===');
  console.log(`Data: ${new Date().toISOString()}`);
  console.log('===================================');
  
  // Configura client MongoDB
  const client = new MongoClient(MONGODB_URI, {
    connectTimeoutMS: 30000,
    socketTimeoutMS: 60000,
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
    const similarProductsCollection = db.collection('similarproducts');
    
    // Svuota la collezione dei prodotti simili
    console.log('Svuotamento della collezione dei prodotti simili...');
    await similarProductsCollection.deleteMany({});
    
    // Crea indici se non esistono già
    console.log('Creazione indici...');
    await similarProductsCollection.createIndex({ productId: 1 });
    await similarProductsCollection.createIndex({ similarProductId: 1 });
    await similarProductsCollection.createIndex({ similarity: 1 });
    
    // Recupera tutti i prodotti
    console.log('Recupero di tutti i prodotti...');
    const products = await productsCollection.find({}).toArray();
    
    console.log(`Trovati ${products.length} prodotti`);
    
    // Statistiche
    let stats = {
      totalProducts: products.length,
      totalComparisons: 0,
      similarPairsFound: 0,
      savedRelationships: 0
    };
    
    // Array per le operazioni di inserimento batch
    const similarityOperations = [];
    
    // Per ogni prodotto, trova i prodotti simili
    console.log('Ricerca prodotti simili...');
    
    for (let i = 0; i < products.length; i++) {
      const product1 = products[i];
      
      // Mostra avanzamento
      if (i % 100 === 0) {
        console.log(`Progresso: ${i}/${products.length} prodotti analizzati`);
      }
      
      // Trova prodotti simili
      for (let j = i + 1; j < products.length; j++) {
        const product2 = products[j];
        stats.totalComparisons++;
        
        // Considera solo prodotti di fonti diverse
        if (product1.source === product2.source) continue;
        
        // Considera solo prodotti dello stesso tipo di animale
        if (product1.petType !== product2.petType) continue;
        
        // Calcola la somiglianza
        const similarity = calculateSimilarity(product1.name, product2.name);
        
        // Se la somiglianza è sopra la soglia, salva la relazione
        if (similarity >= SIMILARITY_THRESHOLD) {
          stats.similarPairsFound++;
          
          // Verifica che entrambi i prodotti abbiano prezzi validi
          if (product1.prices && product1.prices.length > 0 && 
              product2.prices && product2.prices.length > 0) {
            
            // Calcola la differenza di prezzo
            const price1 = product1.prices[0].price;
            const price2 = product2.prices[0].price;
            const priceDifference = Math.abs(price1 - price2);
            const priceRatio = Math.max(price1, price2) / Math.min(price1, price2);
            
            // Crea le relazioni in entrambe le direzioni (bidirezionale)
            // Da product1 a product2
            similarityOperations.push({
              insertOne: {
                document: {
                  productId: product1._id,
                  similarProductId: product2._id,
                  similarity: similarity,
                  priceDifference: priceDifference,
                  priceRatio: priceRatio,
                  updatedAt: new Date()
                }
              }
            });
            
            // Da product2 a product1
            similarityOperations.push({
              insertOne: {
                document: {
                  productId: product2._id,
                  similarProductId: product1._id,
                  similarity: similarity,
                  priceDifference: priceDifference,
                  priceRatio: priceRatio,
                  updatedAt: new Date()
                }
              }
            });
            
            stats.savedRelationships += 2;
            
            // Esegui batch di operazioni quando raggiunge il limite
            if (similarityOperations.length >= BATCH_SIZE) {
              await similarProductsCollection.bulkWrite(similarityOperations);
              console.log(`Salvate ${similarityOperations.length} relazioni di similarità`);
              similarityOperations.length = 0; // Svuota l'array
            }
          }
        }
      }
    }
    
    // Esegui le operazioni rimanenti
    if (similarityOperations.length > 0) {
      await similarProductsCollection.bulkWrite(similarityOperations);
      console.log(`Salvate ${similarityOperations.length} relazioni di similarità rimanenti`);
    }
    
    // Stampa statistiche
    console.log(`
Popolamento prodotti simili completato:
- Prodotti totali: ${stats.totalProducts}
- Confronti effettuati: ${stats.totalComparisons}
- Coppie di prodotti simili trovate: ${stats.similarPairsFound}
- Relazioni di similarità salvate: ${stats.savedRelationships}
    `);
    
    // Esempio di query
    console.log('Esempi di query per i prodotti simili:');
    
    console.log('\nProdotti simili con maggiore similarità:');
    const topSimilar = await similarProductsCollection
      .find({})
      .sort({ similarity: -1 })
      .limit(5)
      .toArray();
    
    for (const similar of topSimilar) {
      const product = await productsCollection.findOne({ _id: similar.productId });
      const similarProduct = await productsCollection.findOne({ _id: similar.similarProductId });
      
      console.log(`
Similarità: ${(similar.similarity * 100).toFixed(1)}%
- ${product.source}: ${product.name}
- ${similarProduct.source}: ${similarProduct.name}
- Differenza di prezzo: ${similar.priceDifference.toFixed(2)}€ (rapporto: ${similar.priceRatio.toFixed(2)})
      `);
    }
    
    console.log('===================================');
    
  } catch (error) {
    console.error(`Errore durante il popolamento dei prodotti simili: ${error.message}`);
    console.error(error.stack);
  } finally {
    // Chiudi la connessione
    await client.close();
    console.log('Connessione al database chiusa');
  }
}

// Esegui
populateSimilarProducts()
  .then(() => {
    console.log('Popolamento prodotti simili completato con successo');
    process.exit(0);
  })
  .catch(error => {
    console.error(`Errore: ${error.message}`);
    process.exit(1);
  }); 