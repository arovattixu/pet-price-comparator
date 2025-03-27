#!/usr/bin/env node

/**
 * Script per trovare prodotti simili tra diverse fonti
 * Utile per generare offerte comparate
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
 * Trova prodotti simili nel database
 */
async function findSimilarProducts() {
  console.log('=== RICERCA PRODOTTI SIMILI ===');
  console.log(`Data: ${new Date().toISOString()}`);
  console.log('===============================');
  
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
      totalProducts: 0,
      totalSimilarities: 0,
      highSimilarities: 0,
      productPairsWithSources: 0
    };
    
    // Leggi tutti i prodotti
    console.log('Lettura dei prodotti dal database...');
    const products = await productsCollection.find().toArray();
    stats.totalProducts = products.length;
    
    console.log(`Trovati ${stats.totalProducts} prodotti`);
    
    // Trova prodotti simili
    console.log('Ricerca prodotti simili...');
    
    const similarityThreshold = 0.7; // Soglia di similarità (0-1)
    const similarProducts = [];
    
    // Matrici per memorizzare i risultati
    const similarities = [];
    
    // Trova coppie di prodotti simili
    for (let i = 0; i < products.length; i++) {
      const product1 = products[i];
      
      // Mostra avanzamento
      if (i % 100 === 0) {
        console.log(`Progresso: ${i}/${products.length} prodotti analizzati`);
      }
      
      for (let j = i + 1; j < products.length; j++) {
        const product2 = products[j];
        
        // Considera solo prodotti di fonti diverse
        if (product1.source === product2.source) continue;
        
        // Considera solo prodotti dello stesso tipo di animale
        if (product1.petType !== product2.petType) continue;
        
        // Calcola la somiglianza
        const similarity = calculateSimilarity(product1.name, product2.name);
        stats.totalSimilarities++;
        
        // Se la somiglianza è sopra la soglia, aggiungi alla lista
        if (similarity >= similarityThreshold) {
          stats.highSimilarities++;
          
          // Verifica che i prodotti abbiano prezzi
          if (product1.prices && product1.prices.length > 0 && 
              product2.prices && product2.prices.length > 0) {
            stats.productPairsWithSources++;
            
            // Aggiungi alla lista di prodotti simili
            similarProducts.push({
              product1: {
                id: product1._id,
                name: product1.name,
                source: product1.source,
                price: product1.prices[0].price,
                url: product1.prices[0].url
              },
              product2: {
                id: product2._id,
                name: product2.name,
                source: product2.source,
                price: product2.prices[0].price,
                url: product2.prices[0].url
              },
              similarity: similarity,
              priceDifference: Math.abs(product1.prices[0].price - product2.prices[0].price),
              priceRatio: Math.max(product1.prices[0].price, product2.prices[0].price) / 
                         Math.min(product1.prices[0].price, product2.prices[0].price)
            });
            
            // Memorizza la similarità
            similarities.push({
              id1: product1._id,
              id2: product2._id,
              similarity: similarity
            });
          }
        }
      }
    }
    
    // Ordina per similarità decrescente
    similarProducts.sort((a, b) => b.similarity - a.similarity);
    
    // Stampa i primi 10 prodotti simili
    console.log('\nTop 10 prodotti simili:');
    for (let i = 0; i < Math.min(10, similarProducts.length); i++) {
      const pair = similarProducts[i];
      console.log(`
${i + 1}. Similarità: ${(pair.similarity * 100).toFixed(1)}%
   - ${pair.product1.source}: ${pair.product1.name} (${pair.product1.price}€)
   - ${pair.product2.source}: ${pair.product2.name} (${pair.product2.price}€)
   - Differenza di prezzo: ${pair.priceDifference.toFixed(2)}€ (rapporto: ${pair.priceRatio.toFixed(2)})
      `);
    }
    
    // Vedi se ci sono prodotti con grande differenza di prezzo
    similarProducts.sort((a, b) => b.priceRatio - a.priceRatio);
    
    console.log('\nTop 10 prodotti simili con maggiore differenza di prezzo:');
    for (let i = 0; i < Math.min(10, similarProducts.length); i++) {
      const pair = similarProducts[i];
      if (pair.similarity >= 0.75) { // Solo alta similarità per evitare falsi positivi
        console.log(`
${i + 1}. Rapporto prezzo: ${pair.priceRatio.toFixed(2)}x (Similarità: ${(pair.similarity * 100).toFixed(1)}%)
   - ${pair.product1.source}: ${pair.product1.name} (${pair.product1.price}€)
   - ${pair.product2.source}: ${pair.product2.name} (${pair.product2.price}€)
   - Differenza di prezzo: ${pair.priceDifference.toFixed(2)}€
      `);
      }
    }
    
    // Stampa statistiche
    console.log(`
Statistiche:
- Prodotti totali: ${stats.totalProducts}
- Confronti effettuati: ${stats.totalSimilarities}
- Prodotti con alta similarità: ${stats.highSimilarities}
- Coppie di prodotti con prezzi: ${stats.productPairsWithSources}
    `);
    
    console.log('===============================');
    
  } catch (error) {
    console.error(`Errore durante la ricerca di prodotti simili: ${error.message}`);
    console.error(error.stack);
  } finally {
    // Chiudi la connessione
    await client.close();
    console.log('Connessione al database chiusa');
  }
}

// Esegui
findSimilarProducts()
  .then(() => {
    console.log('Ricerca prodotti simili completata');
    process.exit(0);
  })
  .catch(error => {
    console.error(`Errore: ${error.message}`);
    process.exit(1);
  }); 