require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./src/models/product');
const logger = require('./src/utils/logger');

async function fixProductSource() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    logger.info('Connessione a MongoDB stabilita');
    
    // Identifica i prodotti Arcaplanet che sono stati importati come Zooplus
    // Questi sono stati aggiunti durante la seconda importazione e hanno
    // gli stessi sourceId dei prodotti Arcaplanet ma source='zooplus'
    
    // Prima ottieni tutti i sourceId di prodotti Arcaplanet
    const arcaplanetProducts = await Product.find({ source: 'arcaplanet' }, { sourceId: 1 }).lean();
    const arcaplanetIds = arcaplanetProducts.map(p => p.sourceId);
    
    logger.info(`Trovati ${arcaplanetIds.length} prodotti Arcaplanet genuini`);
    
    // Trova prodotti con gli stessi sourceId ma marcati come zooplus
    const misclassifiedProducts = await Product.find({ 
      source: 'zooplus',
      sourceId: { $in: arcaplanetIds }
    });
    
    logger.info(`Trovati ${misclassifiedProducts.length} prodotti Arcaplanet importati erroneamente come Zooplus`);
    
    if (misclassifiedProducts.length === 0) {
      logger.info('Nessun prodotto da correggere.');
      return;
    }
    
    // Ottieni le date di creazione per determinare quale tenere
    const deletedProducts = [];
    
    // Elimina i prodotti duplicati (quelli erroneamente importati come zooplus)
    for (const product of misclassifiedProducts) {
      logger.info(`Rimozione prodotto duplicato: ${product.name} (${product.sourceId})`);
      await Product.deleteOne({ _id: product._id });
      deletedProducts.push(product.sourceId);
    }
    
    logger.info(`Rimossi ${deletedProducts.length} prodotti duplicati erroneamente classificati come Zooplus`);
    
    // Verifica finale
    const arcaplanetCount = await Product.countDocuments({ source: 'arcaplanet' });
    const zooplusCount = await Product.countDocuments({ source: 'zooplus' });
    
    logger.info('Conteggio finale:');
    logger.info(`- Prodotti Arcaplanet: ${arcaplanetCount}`);
    logger.info(`- Prodotti Zooplus: ${zooplusCount}`);
    
  } catch (error) {
    logger.error(`Errore durante la correzione: ${error.message}`);
    logger.error(error.stack);
  } finally {
    await mongoose.connection.close();
    logger.info('Connessione a MongoDB chiusa');
  }
}

// Esegui la correzione
fixProductSource()
  .then(() => {
    logger.info('Operazione completata');
    process.exit(0);
  })
  .catch(error => {
    logger.error(`Errore durante l'esecuzione dello script: ${error.message}`);
    process.exit(1);
  }); 