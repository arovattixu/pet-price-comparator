/**
 * Script per l'aggiornamento periodico dei dati sui prezzi
 * Legge i file JSON dei risultati dello scraping e aggiorna il database
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const logger = require('../../src/utils/logger');

// Importa i modelli dal database
let Product, PricePoint;
try {
  // Prova a importare i modelli dal backend se disponibile
  const modelsPath = process.env.BACKEND_PATH ? 
    path.join(process.env.BACKEND_PATH, 'src/db/models') : 
    '../../models';

  Product = require(path.join(modelsPath, 'product'));
  PricePoint = require(path.join(modelsPath, 'PricePoint'));
} catch (error) {
  // Se non riesce, usa modelli locali (se disponibili)
  logger.error(`Errore nel caricamento dei modelli dal backend: ${error.message}`);
  logger.info('Tentativo di caricamento dei modelli locali...');
  
  try {
    Product = require('../../src/models/product');
    PricePoint = require('../../src/models/PricePoint');
  } catch (modelError) {
    logger.error(`Impossibile caricare i modelli: ${modelError.message}`);
    process.exit(1);
  }
}

// Configurazione
const RESULTS_DIR = process.env.RESULTS_DIR || path.join(__dirname, '../../results');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pet-price-comparator';

/**
 * Aggiorna i prezzi nel database a partire dai dati raccolti
 */
async function updatePriceData() {
  let mongooseConnection = null;
  
  try {
    // Connessione al database con timeout aumentato
    logger.info(`Connessione al database MongoDB: ${MONGODB_URI}`);
    
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 30000, // Aumenta il timeout a 30 secondi
      socketTimeoutMS: 45000, // Aumenta il timeout del socket a 45 secondi
      connectTimeoutMS: 30000 // Aumenta il timeout di connessione a 30 secondi
    });
    
    mongooseConnection = mongoose.connection;
    
    // Gestisci gli eventi di connessione
    mongooseConnection.on('error', (err) => {
      logger.error(`Errore di connessione MongoDB: ${err.message}`);
    });
    
    mongooseConnection.on('disconnected', () => {
      logger.warn('Disconnesso dal database MongoDB');
    });
    
    logger.info('Connesso al database MongoDB');
    
    let updatedProducts = 0;
    let newPricePoints = 0;
    let processedFiles = 0;
    let errorCount = 0;
    
    // Lista delle fonti da elaborare
    const sources = ['arcaplanet', 'zooplus'];
    
    for (const source of sources) {
      const sourceDir = path.join(RESULTS_DIR, source);
      
      // Verifica che la directory esista
      if (!fs.existsSync(sourceDir)) {
        logger.warn(`Directory per ${source} non trovata: ${sourceDir}`);
        continue;
      }
      
      logger.info(`Elaborazione dei dati da ${source}...`);
      
      // Leggi i file nella directory
      const files = fs.readdirSync(sourceDir)
        .filter(file => file.endsWith('.json'));
      
      if (files.length === 0) {
        logger.warn(`Nessun file JSON trovato nella directory ${sourceDir}`);
        continue;
      }
      
      for (const file of files) {
        try {
          const filePath = path.join(sourceDir, file);
          
          // Verifica che il file esista
          if (!fs.existsSync(filePath)) {
            logger.warn(`File non trovato: ${filePath}`);
            continue;
          }
          
          // Leggi il file
          const rawData = fs.readFileSync(filePath, 'utf8');
          
          if (!rawData || rawData.trim() === '') {
            logger.warn(`File vuoto: ${filePath}`);
            continue;
          }
          
          let jsonData;
          try {
            jsonData = JSON.parse(rawData);
          } catch (parseError) {
            logger.error(`Errore nel parsing del JSON: ${parseError.message}`);
            logger.error(`File problematico: ${filePath}`);
            errorCount++;
            continue;
          }
          
          if (!Array.isArray(jsonData)) {
            logger.warn(`Il file non contiene un array: ${filePath}`);
            continue;
          }
          
          logger.info(`Elaborazione del file ${file} con ${jsonData.length} prodotti`);
          
          // Elabora ogni prodotto
          for (const productData of jsonData) {
            try {
              if (!productData) {
                logger.warn('Prodotto non valido (null o undefined)');
                continue;
              }
              
              const sourceId = productData.sourceId || productData.id;
              if (!sourceId) {
                logger.warn('Prodotto senza sourceId o id - impossibile elaborare');
                continue;
              }
              
              // Trova il prodotto nel database o creane uno nuovo
              let product;
              try {
                product = await Product.findOne({
                  source: source,
                  sourceId: sourceId
                });
              } catch (findError) {
                logger.error(`Errore nella ricerca del prodotto: ${findError.message}`);
                errorCount++;
                continue;
              }
              
              if (!product) {
                // Crea un nuovo prodotto se non esiste
                product = new Product({
                  name: productData.name || productData.title || 'Unknown Product',
                  description: productData.description || '',
                  brand: productData.brand || '',
                  category: productData.category || '',
                  imageUrl: productData.imageUrl || productData.image || '',
                  source: source,
                  sourceId: sourceId,
                  petType: productData.petType || 'cane', // Default value
                  sku: productData.sku || '',
                  weight: productData.weight || ''
                });
              }
              
              // Estrai e aggiorna varianti e prezzi
              const variants = productData.variants || [];
              
              // Aggiorna array di varianti
              if (variants.length > 0) {
                product.variants = variants.map(variant => ({
                  variantId: variant.variantId || variant.id || 'default',
                  description: variant.description || variant.name || 'Default Variant',
                  available: variant.available !== false,
                  currentPrice: {
                    amount: parseFloat(variant.price || variant.currentPrice?.amount || 0),
                    currency: variant.currency || variant.currentPrice?.currency || 'EUR',
                    discounted: variant.discounted || variant.currentPrice?.discounted || false,
                    discountAmount: variant.discountAmount || variant.currentPrice?.discountAmount || 0
                  }
                }));
              }
              
              // Aggiorna i prezzi
              if (!product.prices) product.prices = [];
              
              // Aggiorna o aggiungi il prezzo per questo store
              const priceIndex = product.prices.findIndex(p => p.store === source);
              
              if (priceIndex >= 0) {
                // Aggiorna prezzo esistente
                product.prices[priceIndex].price = variants[0]?.currentPrice?.amount || 
                                                  variants[0]?.price || 
                                                  productData.price || 0;
                product.prices[priceIndex].lastUpdated = new Date();
                product.prices[priceIndex].inStock = variants[0]?.available !== false;
              } else {
                // Aggiungi nuovo prezzo
                product.prices.push({
                  store: source,
                  price: variants[0]?.currentPrice?.amount || 
                         variants[0]?.price || 
                         productData.price || 0,
                  currency: 'EUR',
                  url: productData.url || '',
                  lastUpdated: new Date(),
                  inStock: variants[0]?.available !== false
                });
              }
              
              // Salva prodotto
              try {
                await product.save();
                updatedProducts++;
                
                // Registra punto prezzo per ogni variante
                for (const variant of variants) {
                  // Crea nuovo punto prezzo
                  const pricePoint = new PricePoint({
                    productId: product._id,
                    variantId: variant.variantId || variant.id || 'default',
                    source,
                    price: {
                      amount: parseFloat(variant.price || variant.currentPrice?.amount || 0),
                      currency: variant.currency || variant.currentPrice?.currency || 'EUR',
                      discounted: variant.discounted || variant.currentPrice?.discounted || false,
                      discountAmount: variant.discountAmount || variant.currentPrice?.discountAmount || 0
                    },
                    recordedAt: new Date()
                  });
                  
                  await pricePoint.save();
                  newPricePoints++;
                }
              } catch (saveError) {
                logger.error(`Errore nel salvare il prodotto: ${saveError.message}`);
                errorCount++;
              }
            } catch (productError) {
              logger.error(`Errore nel processare il prodotto da ${source}: ${productError.message}`);
              errorCount++;
            }
          }
          
          processedFiles++;
        } catch (fileError) {
          logger.error(`Errore nel processare il file ${file} da ${source}: ${fileError.message}`);
          errorCount++;
        }
      }
    }
    
    logger.info(`
      Aggiornamento completato:
      - File processati: ${processedFiles}
      - Prodotti aggiornati: ${updatedProducts}
      - Nuovi punti prezzo: ${newPricePoints}
      - Errori: ${errorCount}
    `);
    
  } catch (error) {
    logger.error(`Errore nell'aggiornamento dei dati: ${error.message}`);
    logger.error(error.stack);
  } finally {
    // Chiudi la connessione al database
    if (mongooseConnection) {
      try {
        await mongoose.connection.close();
        logger.info('Disconnesso dal database MongoDB');
      } catch (closeError) {
        logger.error(`Errore nella chiusura della connessione: ${closeError.message}`);
      }
    }
  }
}

// Se il file è eseguito direttamente, esegui l'aggiornamento
if (require.main === module) {
  updatePriceData()
    .then(() => {
      logger.info('Aggiornamento dei dati completato');
      process.exit(0);
    })
    .catch((error) => {
      logger.error(`Errore durante l'aggiornamento dei dati: ${error.message}`);
      logger.error(error.stack);
      process.exit(1);
    });
} else {
  // Altrimenti esporta la funzione per l'uso in altri moduli
  module.exports = updatePriceData;
} 