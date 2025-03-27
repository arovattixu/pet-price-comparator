/**
 * Script per creare l'indice di testo sulla collezione dei prodotti
 * per abilitare la ricerca testuale
 */

require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('../src/utils/logger');

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  logger.error('Please define the MONGODB_URI environment variable');
  process.exit(1);
}

const createTextIndex = async () => {
  try {
    // Connetti a MongoDB
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 60000,
      connectTimeoutMS: 60000,
      socketTimeoutMS: 90000
    });
    
    logger.info('Connessione a MongoDB riuscita!');
    
    // Ottieni la collezione dei prodotti
    const db = mongoose.connection.db;
    const productCollection = db.collection('products');
    
    // Crea indice di testo su name, brand e category
    await productCollection.createIndex(
      { name: 'text', brand: 'text', category: 'text' },
      { 
        name: 'products_text_index',
        weights: {
          name: 10, // Nome ha priorità più alta
          brand: 5,  // Brand ha priorità media
          category: 1 // Categoria ha priorità più bassa
        },
        default_language: 'italian'
      }
    );
    
    logger.info('Indice di testo creato con successo sulla collezione products!');
  } catch (error) {
    logger.error(`Errore nella creazione dell'indice di testo: ${error.message}`);
  } finally {
    // Chiudi la connessione al database
    await mongoose.connection.close();
    logger.info('Connessione al database chiusa');
  }
};

// Esegui la funzione
createTextIndex()
  .then(() => {
    logger.info('Script terminato con successo!');
    process.exit(0);
  })
  .catch(error => {
    logger.error(`Errore nell'esecuzione dello script: ${error.message}`);
    process.exit(1);
  }); 