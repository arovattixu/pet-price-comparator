/**
 * Script per controllare i dettagli di un prodotto specifico
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../../src/models/product');
const logger = require('../../src/utils/logger');

async function checkProductDetails() {
  try {
    // Connessione a MongoDB
    logger.info('Connessione a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    logger.info('Connessione a MongoDB stabilita');
    
    // Ottieni un prodotto completo a caso per analizzarlo
    const randomProduct = await Product.findOne({ source: 'zooplus' });
    if (randomProduct) {
      logger.info('Dettagli completi di un prodotto:');
      console.log(JSON.stringify(randomProduct.toObject(), null, 2));
      
      logger.info(`\n\nCampi principali del prodotto "${randomProduct.name}":`);
      logger.info(`- ID: ${randomProduct._id}`);
      logger.info(`- Source: ${randomProduct.source}`);
      logger.info(`- SourceID: ${randomProduct.sourceId}`);
      logger.info(`- Categoria: ${randomProduct.category}`);
      logger.info(`- Brand: ${randomProduct.brand}`);
      logger.info(`- URL Immagine: ${randomProduct.imageUrl}`);
      
      if (randomProduct.prices && randomProduct.prices.length > 0) {
        const price = randomProduct.prices[0];
        logger.info(`- Prezzo: ${price.price} ${price.currency}`);
        logger.info(`- Negozio: ${price.store}`);
        logger.info(`- URL Prodotto: ${price.url}`);
        logger.info(`- In Magazzino: ${price.inStock ? 'Sì' : 'No'}`);
        logger.info(`- Ultimo Aggiornamento: ${price.lastUpdated}`);
      }
    } else {
      logger.warn('Nessun prodotto Zooplus trovato nel database');
    }
    
    // Statistiche sui prezzi
    const priceStats = await Product.aggregate([
      { $match: { source: 'zooplus' } },
      { $unwind: '$prices' },
      { 
        $group: {
          _id: null,
          avgPrice: { $avg: '$prices.price' },
          minPrice: { $min: '$prices.price' },
          maxPrice: { $max: '$prices.price' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    if (priceStats.length > 0) {
      const stats = priceStats[0];
      logger.info('\nStatistiche sui prezzi Zooplus:');
      logger.info(`- Prezzo medio: ${stats.avgPrice.toFixed(2)} EUR`);
      logger.info(`- Prezzo minimo: ${stats.minPrice.toFixed(2)} EUR`);
      logger.info(`- Prezzo massimo: ${stats.maxPrice.toFixed(2)} EUR`);
      logger.info(`- Numero di prezzi: ${stats.count}`);
    }
    
  } catch (error) {
    logger.error(`Errore durante la verifica dei dettagli: ${error.message}`);
    logger.error(error.stack);
  } finally {
    // Chiudi la connessione a MongoDB
    await mongoose.connection.close();
    logger.info('Connessione a MongoDB chiusa');
  }
}

// Esegui la funzione
checkProductDetails(); 