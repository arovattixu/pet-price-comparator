const mongoose = require('mongoose');
const logger = require('./src/utils/logger');
require('dotenv').config();

// Schema del prodotto completo
const productSchema = new mongoose.Schema({
  name: String,
  description: String,
  brand: String,
  category: [String],
  imageUrl: String,
  source: String,
  sourceId: String,
  url: String,
  sku: String,
  gtin: String,
  prices: [{
    value: Number,
    currency: String,
    date: Date,
    isDiscounted: Boolean,
    originalPrice: Number,
    pricePerUnit: {
      value: Number,
      unit: String
    }
  }],
  variants: [{
    name: String,
    sku: String,
    sourceId: String,
    price: {
      value: Number,
      currency: String,
      date: Date,
      isDiscounted: Boolean,
      originalPrice: Number,
      pricePerUnit: {
        value: Number,
        unit: String
      }
    },
    attributes: Object
  }],
  attributes: Object,
  metadata: Object,
  createdAt: Date,
  updatedAt: Date
});

const Product = mongoose.model('Product', productSchema);

async function checkDataQuality() {
  logger.info('Verifica qualità dei dati nel database');
  
  try {
    // Connessione al database
    logger.info('Connessione a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    logger.info('Connessione a MongoDB stabilita');
    
    // Statistiche generali
    logger.info('=== STATISTICHE GENERALI ===');
    const totalProducts = await Product.countDocuments();
    logger.info(`Prodotti totali: ${totalProducts}`);
    
    const sourceStats = await Product.aggregate([
      { $group: { _id: "$source", count: { $sum: 1 } } }
    ]);
    
    sourceStats.forEach(stat => {
      logger.info(`Prodotti da ${stat._id}: ${stat.count}`);
    });
    
    // Verifico campi obbligatori mancanti
    logger.info('\n=== VERIFICA CAMPI OBBLIGATORI ===');
    const missingName = await Product.countDocuments({ name: { $in: [null, "", undefined] } });
    const missingBrand = await Product.countDocuments({ brand: { $in: [null, "", undefined] } });
    const missingCategory = await Product.countDocuments({ $or: [
      { category: { $size: 0 } },
      { category: { $exists: false } }
    ]});
    const missingSource = await Product.countDocuments({ source: { $in: [null, "", undefined] } });
    const missingSourceId = await Product.countDocuments({ sourceId: { $in: [null, "", undefined] } });
    const missingPrices = await Product.countDocuments({ $or: [
      { prices: { $size: 0 } }, 
      { prices: { $exists: false } }
    ]});
    
    logger.info(`Prodotti senza nome: ${missingName}`);
    logger.info(`Prodotti senza marca: ${missingBrand}`);
    logger.info(`Prodotti senza categoria: ${missingCategory}`);
    logger.info(`Prodotti senza fonte: ${missingSource}`);
    logger.info(`Prodotti senza ID fonte: ${missingSourceId}`);
    logger.info(`Prodotti senza prezzi: ${missingPrices}`);
    
    // Estrazione e analisi di un prodotto di esempio
    logger.info('\n=== ESEMPIO PRODOTTO ===');
    const sampleProduct = await Product.findOne({ source: 'arcaplanet' }).lean();
    if (sampleProduct) {
      logger.info(`Nome: ${sampleProduct.name}`);
      logger.info(`Marca: ${sampleProduct.brand}`);
      
      // Gestione sicura della categoria
      let categoryString = 'Non disponibile';
      if (sampleProduct.category && Array.isArray(sampleProduct.category) && sampleProduct.category.length > 0) {
        categoryString = sampleProduct.category.join(' > ');
      }
      logger.info(`Categoria: ${categoryString}`);
      
      logger.info(`URL: ${sampleProduct.url || 'Non disponibile'}`);
      logger.info(`SKU: ${sampleProduct.sku || 'Non disponibile'}`);
      logger.info(`GTIN: ${sampleProduct.gtin || 'Non disponibile'}`);
      
      if (sampleProduct.prices && sampleProduct.prices.length > 0) {
        const price = sampleProduct.prices[0];
        logger.info(`Prezzo: ${price.value} ${price.currency || 'EUR'}`);
        if (price.isDiscounted && price.originalPrice) {
          logger.info(`Prezzo originale: ${price.originalPrice} ${price.currency || 'EUR'}`);
        }
        if (price.pricePerUnit && price.pricePerUnit.value) {
          logger.info(`Prezzo per unità: ${price.pricePerUnit.value} ${price.pricePerUnit.unit || ''}`);
        }
      } else {
        logger.info('Prezzo: Non disponibile');
      }
      
      if (sampleProduct.variants && sampleProduct.variants.length > 0) {
        logger.info(`Varianti: ${sampleProduct.variants.length}`);
        logger.info(`Prima variante: ${sampleProduct.variants[0].name || 'Senza nome'}`);
      } else {
        logger.info('Varianti: Nessuna');
      }
      
      if (sampleProduct.metadata && Object.keys(sampleProduct.metadata).length > 0) {
        logger.info('Metadati disponibili:');
        Object.keys(sampleProduct.metadata).forEach(key => {
          logger.info(`- ${key}`);
        });
      } else {
        logger.info('Metadati: Nessuno');
      }
    } else {
      logger.info('Nessun prodotto di esempio trovato');
    }
    
    // Check duplicati
    logger.info('\n=== VERIFICA DUPLICATI ===');
    const duplicateSourceIds = await Product.aggregate([
      { $group: { 
          _id: { source: "$source", sourceId: "$sourceId" }, 
          count: { $sum: 1 } 
        } 
      },
      { $match: { count: { $gt: 1 } } },
      { $count: "duplicates" }
    ]);
    
    const duplicatesCount = duplicateSourceIds.length > 0 ? duplicateSourceIds[0].duplicates : 0;
    logger.info(`Prodotti con sourceId duplicato: ${duplicatesCount}`);
    
    // Riepilogo
    logger.info('\n=== RIEPILOGO QUALITÀ DATI ===');
    const totalIssues = missingName + missingBrand + missingCategory + missingSource + missingSourceId + missingPrices;
    
    if (totalIssues === 0) {
      logger.info('✅ La qualità dei dati è eccellente! Nessun campo obbligatorio mancante.');
    } else {
      logger.info(`⚠️ Ci sono ${totalIssues} problemi con i campi obbligatori.`);
      
      // Dettaglio dei problemi
      if (missingName > 0) logger.info(`- ${missingName} prodotti senza nome`);
      if (missingBrand > 0) logger.info(`- ${missingBrand} prodotti senza marca`);
      if (missingCategory > 0) logger.info(`- ${missingCategory} prodotti senza categoria`);
      if (missingSource > 0) logger.info(`- ${missingSource} prodotti senza fonte`);
      if (missingSourceId > 0) logger.info(`- ${missingSourceId} prodotti senza ID fonte`);
      if (missingPrices > 0) logger.info(`- ${missingPrices} prodotti senza prezzi`);
    }
    
    if (duplicatesCount === 0) {
      logger.info('✅ Non ci sono duplicati per sourceId.');
    } else {
      logger.info(`⚠️ Ci sono ${duplicatesCount} duplicati per sourceId.`);
    }
    
  } catch (error) {
    logger.error(`Errore durante la verifica della qualità dei dati: ${error.message}`);
  } finally {
    // Chiusura connessione MongoDB
    await mongoose.connection.close();
    logger.info('Connessione a MongoDB chiusa');
  }
}

// Esecuzione dello script
checkDataQuality().catch(err => {
  logger.error(`Errore nell'esecuzione: ${err.message}`);
  process.exit(1);
}); 