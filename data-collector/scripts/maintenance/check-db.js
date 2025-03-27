/**
 * Script per eseguire controlli di base sul database
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../../src/models/product');
const logger = require('../../src/utils/logger');

async function checkDatabase() {
  try {
    // Connessione a MongoDB
    logger.info('Connessione a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    logger.info('Connessione a MongoDB stabilita');
    
    // Conta i prodotti totali
    const totalCount = await Product.countDocuments();
    logger.info(`Totale prodotti nel database: ${totalCount}`);
    
    // Conta i prodotti Zooplus
    const zooplusCount = await Product.countDocuments({ source: 'zooplus' });
    logger.info(`Prodotti Zooplus nel database: ${zooplusCount}`);
    
    // Ottieni informazioni sui prodotti Zooplus
    const zooplusProducts = await Product.find({ source: 'zooplus' })
      .select('name brand category prices.price')
      .limit(5);
    
    logger.info('Esempio di prodotti Zooplus:');
    zooplusProducts.forEach((product, index) => {
      logger.info(`${index + 1}. ${product.name} - ${product.brand} - Prezzo: ${product.prices[0]?.price || 'N/A'} EUR`);
    });
    
    // Verifica categorie presenti
    const categories = await Product.distinct('category', { source: 'zooplus' });
    logger.info(`Categorie Zooplus presenti: ${categories.join(', ')}`);
    
  } catch (error) {
    logger.error(`Errore durante la verifica del database: ${error.message}`);
    logger.error(error.stack);
  } finally {
    // Chiudi la connessione a MongoDB
    await mongoose.connection.close();
    logger.info('Connessione a MongoDB chiusa');
  }
}

// Esegui la funzione
checkDatabase(); 