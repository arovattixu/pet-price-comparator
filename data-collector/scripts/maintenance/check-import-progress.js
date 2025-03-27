const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const logger = require('./src/utils/logger');
require('dotenv').config();

// Modello Product (semplificato per la verifica)
const productSchema = new mongoose.Schema({
  name: String,
  source: String,
  sourceId: String,
  createdAt: Date,
  updatedAt: Date
});

const Product = mongoose.model('Product', productSchema);

async function checkImportProgress() {
  logger.info('Controllo lo stato dell\'importazione nel database');
  
  try {
    // Connessione al database
    logger.info('Connessione a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    logger.info('Connessione a MongoDB stabilita');
    
    // Ottieni conteggio prodotti in database
    const totalProducts = await Product.countDocuments();
    logger.info(`Trovati ${totalProducts} prodotti totali nel database`);
    
    // Conteggio per fonte
    const arcaplanetProducts = await Product.countDocuments({ source: 'arcaplanet' });
    const zooplusProducts = await Product.countDocuments({ source: 'zooplus' });
    logger.info(`Prodotti Arcaplanet: ${arcaplanetProducts}`);
    logger.info(`Prodotti Zooplus: ${zooplusProducts}`);
    
    // Conteggio per data di creazione (ultimi 30 minuti)
    const recentlyAdded = await Product.countDocuments({ 
      createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) } 
    });
    logger.info(`Prodotti aggiunti negli ultimi 30 minuti: ${recentlyAdded}`);
    
    // Conteggio file JSON
    const resultsDir = path.join(__dirname, 'results', 'arcaplanet');
    const files = fs.readdirSync(resultsDir)
      .filter(file => file.endsWith('-products.json'));
    
    // Conteggio prodotti nei file JSON
    let totalJsonProducts = 0;
    for (const file of files) {
      const filePath = path.join(resultsDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      totalJsonProducts += data.length;
    }
    
    logger.info(`Prodotti totali nei file JSON: ${totalJsonProducts}`);
    
    // Calcola progressi
    const importProgress = ((arcaplanetProducts / totalJsonProducts) * 100).toFixed(2);
    logger.info(`Progresso importazione: ${importProgress}% (${arcaplanetProducts}/${totalJsonProducts})`);
    
    // Lista prodotti recenti
    const recentProducts = await Product.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    
    logger.info('Prodotti aggiunti più recentemente:');
    recentProducts.forEach(product => {
      logger.info(`- ${product.name} (${product.source} - ${product.sourceId}) - ${new Date(product.createdAt).toLocaleString()}`);
    });
    
  } catch (error) {
    logger.error(`Errore durante il controllo dell'importazione: ${error.message}`);
  } finally {
    // Chiusura connessione MongoDB
    await mongoose.connection.close();
    logger.info('Connessione a MongoDB chiusa');
  }
}

// Esecuzione dello script
checkImportProgress().catch(err => {
  logger.error(`Errore nell'esecuzione: ${err.message}`);
  process.exit(1);
}); 