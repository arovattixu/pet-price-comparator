require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('./src/utils/logger');

// URI del database MongoDB
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  logger.error('MONGODB_URI non definito nelle variabili d\'ambiente');
  process.exit(1);
}

// Schema per i modelli
const productSchema = new mongoose.Schema({}, { strict: false });
const pricePointSchema = new mongoose.Schema({}, { strict: false });
const priceAlertSchema = new mongoose.Schema({}, { strict: false });
const productGroupSchema = new mongoose.Schema({}, { strict: false });

// Definizione dei modelli
const Product = mongoose.model('Product', productSchema, 'products');
const PricePoint = mongoose.model('PricePoint', pricePointSchema, 'pricepoints');
const PriceAlert = mongoose.model('PriceAlert', priceAlertSchema, 'pricealerts');
const ProductGroup = mongoose.model('ProductGroup', productGroupSchema, 'productgroups');

// Funzione per visualizzare dati in formato compatto
function formatDocument(doc) {
  if (!doc) return 'Documento non trovato';
  
  // Converte il documento in un oggetto semplice
  const plainDoc = doc.toObject ? doc.toObject() : doc;
  
  // Se il documento ha un _id, convertilo in stringa
  if (plainDoc._id) {
    plainDoc._id = plainDoc._id.toString();
  }
  
  return plainDoc;
}

// Funzione principale
async function runTests() {
  logger.info(`Connessione a MongoDB: ${MONGODB_URI.substring(0, MONGODB_URI.indexOf('@') + 1)}[rimanente nascosto]`);
  
  try {
    await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    logger.info('Connessione a MongoDB riuscita!');

    // 1. Statistiche del database
    const stats = await mongoose.connection.db.stats();
    logger.info(`Database: ${stats.db}`);
    logger.info(`Totale documenti: ${stats.objects}`);
    logger.info(`Dimensione: ${(stats.dataSize / (1024 * 1024)).toFixed(2)} MB`);

    // 2. Elenco delle collezioni
    const collections = await mongoose.connection.db.listCollections().toArray();
    logger.info(`Collezioni disponibili: ${collections.map(c => c.name).join(', ')}`);

    // 3. Conteggio documenti in ogni collezione
    logger.info('====== STATISTICHE COLLEZIONI ======');
    const productCount = await Product.countDocuments();
    logger.info(`Products: ${productCount} documenti`);
    
    const pricePointCount = await PricePoint.countDocuments();
    logger.info(`PricePoints: ${pricePointCount} documenti`);
    
    const priceAlertCount = await PriceAlert.countDocuments();
    logger.info(`PriceAlerts: ${priceAlertCount} documenti`);
    
    const productGroupCount = await ProductGroup.countDocuments();
    logger.info(`ProductGroups: ${productGroupCount} documenti`);

    // 4. Esempi di documenti dalla collezione prodotti
    logger.info('====== ESEMPI DI PRODOTTI ======');
    const products = await Product.find().limit(3);
    products.forEach((product, index) => {
      logger.info(`Prodotto ${index + 1}:`);
      logger.info(`ID: ${product._id}`);
      logger.info(`Nome: ${product.name}`);
      logger.info(`Marca: ${product.brand}`);
      logger.info(`Fonte: ${product.source}`);
      logger.info(`Prezzo: ${product.prices && product.prices[0] ? product.prices[0].price : 'N/A'} €`);
      logger.info('---');
    });

    // 5. Query prodotti per brand
    logger.info('====== PRODOTTI PER BRAND ======');
    const brands = ['Royal Canin', 'Purina', 'Hill\'s', 'Monge'];
    
    for (const brand of brands) {
      const count = await Product.countDocuments({ brand: { $regex: brand, $options: 'i' } });
      logger.info(`${brand}: ${count} prodotti`);
    }

    // 6. Ultimi PricePoints aggiunti
    logger.info('====== ULTIMI AGGIORNAMENTI PREZZI ======');
    const latestPricePoints = await PricePoint.find().sort({ recordedAt: -1 }).limit(3);
    latestPricePoints.forEach((pp, index) => {
      logger.info(`PricePoint ${index + 1}:`);
      logger.info(`ID Prodotto: ${pp.productId}`);
      logger.info(`Prezzo: ${pp.price ? pp.price.amount : 'N/A'} ${pp.price ? pp.price.currency : ''}`);
      logger.info(`Data registrazione: ${pp.recordedAt}`);
      logger.info(`Fonte: ${pp.source}`);
      logger.info('---');
    });

    // 7. Variazioni di prezzo per un prodotto
    logger.info('====== STORICO PREZZI PER UN PRODOTTO ======');
    if (latestPricePoints.length > 0) {
      const sampleProductId = latestPricePoints[0].productId;
      const priceHistory = await PricePoint.find({ productId: sampleProductId })
        .sort({ recordedAt: -1 })
        .limit(5);
      
      logger.info(`Storico prezzi per prodotto ID: ${sampleProductId}`);
      priceHistory.forEach((point, index) => {
        logger.info(`${index + 1}. ${point.recordedAt.toISOString().split('T')[0]}: ${point.price ? point.price.amount : 'N/A'} ${point.price ? point.price.currency : ''}`);
      });
      
      // Recupera i dettagli del prodotto
      const productDetails = await Product.findById(sampleProductId);
      if (productDetails) {
        logger.info(`Nome prodotto: ${productDetails.name}`);
        logger.info(`Marca: ${productDetails.brand}`);
      }
    }

    // 8. Controlla gli alert sui prezzi
    logger.info('====== ALERT PREZZI ======');
    const alerts = await PriceAlert.find().limit(3);
    alerts.forEach((alert, index) => {
      logger.info(`Alert ${index + 1}:`);
      logger.info(`ID Prodotto: ${alert.productId}`);
      logger.info(`Prezzo target: ${alert.targetPrice}`);
      logger.info(`Email: ${alert.email}`);
      logger.info(`Stato: ${alert.isActive ? 'Attivo' : 'Inattivo'}`);
      logger.info('---');
    });

    // 9. Gruppo di prodotti simili
    logger.info('====== GRUPPI DI PRODOTTI ======');
    const groups = await ProductGroup.find().limit(2);
    groups.forEach((group, index) => {
      logger.info(`Gruppo ${index + 1}:`);
      logger.info(`Nome base: ${group.baseProductName}`);
      logger.info(`Marca: ${group.brand}`);
      logger.info(`Numero prodotti: ${group.products ? group.products.length : 0}`);
      if (group.products && group.products.length > 0) {
        logger.info('Prodotti nel gruppo:');
        group.products.slice(0, 3).forEach((prod, i) => {
          logger.info(`  ${i + 1}. ${prod.name || 'N/A'} - ${prod.price || 'N/A'}€`);
        });
        if (group.products.length > 3) {
          logger.info(`  ... e altri ${group.products.length - 3} prodotti`);
        }
      }
      logger.info('---');
    });

    logger.info('Test completato con successo!');
  } catch (error) {
    logger.error(`Errore durante il test: ${error.message}`);
    logger.error(error.stack);
  } finally {
    // Chiudi la connessione al database
    await mongoose.connection.close();
    logger.info('Connessione al database chiusa');
    process.exit(0);
  }
}

// Esegui i test
runTests().catch(err => {
  logger.error(`Errore critico: ${err.message}`);
  logger.error(err.stack);
  process.exit(1);
}); 