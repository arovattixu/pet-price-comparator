/**
 * Script per testare la connessione al database MongoDB
 */

require('dotenv').config();
const mongoose = require('mongoose');
const logger = console;

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pet-price-comparator';

async function testConnection() {
  try {
    logger.log(`Tentativo di connessione a MongoDB: ${MONGODB_URI}`);
    
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000
    });
    
    logger.log('✅ Connessione riuscita!');
    
    // Test semplice per verificare che possiamo eseguire operazioni
    const collections = await mongoose.connection.db.listCollections().toArray();
    logger.log(`Collezioni disponibili: ${collections.map(c => c.name).join(', ')}`);
    
    // Conteggio documenti
    const productCount = await mongoose.connection.db.collection('products').countDocuments();
    logger.log(`Numero di prodotti nel database: ${productCount}`);
    
    logger.log('Test completato con successo');
  } catch (error) {
    logger.error(`❌ Errore nella connessione: ${error.message}`);
    logger.error(error.stack);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      logger.log('Connessione chiusa');
    }
  }
}

testConnection()
  .then(() => process.exit(0))
  .catch(err => {
    logger.error(`Errore non gestito: ${err.message}`);
    process.exit(1);
  }); 