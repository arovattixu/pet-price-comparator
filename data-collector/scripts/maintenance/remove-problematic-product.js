require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./src/models/product');
const logger = require('./src/utils/logger');
const { ObjectId } = mongoose.Types;

async function removeProblematicProduct() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    logger.info('Connessione a MongoDB stabilita');
    
    // ID del prodotto problematico
    const problematicProductId = '67deadd7e412acf58513f0ed';
    
    // Verifica che il prodotto esista
    const problematicProduct = await Product.findById(problematicProductId);
    
    if (!problematicProduct) {
      logger.error(`Prodotto con ID ${problematicProductId} non trovato`);
      return;
    }
    
    // Mostra dettagli del prodotto da eliminare
    logger.info('Dettagli del prodotto da eliminare:');
    logger.info(`- ID: ${problematicProduct._id}`);
    logger.info(`- Nome: ${problematicProduct.name || 'N/A'}`);
    logger.info(`- Source: ${problematicProduct.source || 'MANCANTE'}`);
    logger.info(`- SourceId: ${problematicProduct.sourceId || 'MANCANTE'}`);
    
    // Rimuovi il prodotto
    const result = await Product.deleteOne({ _id: new ObjectId(problematicProductId) });
    
    if (result.deletedCount === 1) {
      logger.info(`Prodotto problematico con ID ${problematicProductId} rimosso con successo`);
    } else {
      logger.warn(`Rimozione non riuscita o prodotto già rimosso`);
    }
    
    // Verifica finale dei prodotti con campi mancanti
    const missingFields = await Product.countDocuments({
      $or: [
        { source: { $exists: false } },
        { sourceId: { $exists: false } },
        { name: { $exists: false } }
      ]
    });
    
    logger.info(`Prodotti con campi mancanti rimasti: ${missingFields}`);
    
    // Conteggio finale
    const arcaplanetCount = await Product.countDocuments({ source: 'arcaplanet' });
    const zooplusCount = await Product.countDocuments({ source: 'zooplus' });
    const totalCount = await Product.countDocuments();
    
    logger.info('Conteggio finale dei prodotti nel database:');
    logger.info(`- Totale: ${totalCount}`);
    logger.info(`- Arcaplanet: ${arcaplanetCount}`);
    logger.info(`- Zooplus: ${zooplusCount}`);
    
  } catch (error) {
    logger.error(`Errore durante la rimozione: ${error.message}`);
    logger.error(error.stack);
  } finally {
    await mongoose.connection.close();
    logger.info('Connessione a MongoDB chiusa');
  }
}

// Esegui la rimozione
removeProblematicProduct()
  .then(() => {
    logger.info('Operazione completata');
    process.exit(0);
  })
  .catch(error => {
    logger.error(`Errore durante l'esecuzione dello script: ${error.message}`);
    process.exit(1);
  }); 