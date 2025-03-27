/**
 * Script per riparare i prodotti con immagini mancanti
 * Questo script identifica i prodotti che non hanno immagini
 * o hanno immagini non valide e tenta di ripararli.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../../src/models/product');
const logger = require('../../src/utils/logger');
const fs = require('fs');
const path = require('path');

// Configura opzioni da linea di comando
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE_PRODUCTION = args.includes('--force-production');
const LIMIT = args.includes('--limit') ? 
  parseInt(args[args.indexOf('--limit') + 1]) : 0;
const SOURCE = args.includes('--source') ?
  args[args.indexOf('--source') + 1] : null;

async function repairMissingImages() {
  logger.info('=== RIPARAZIONE IMMAGINI MANCANTI ===');
  
  // Verificare che non siamo in produzione a meno che non sia forzato
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && !FORCE_PRODUCTION) {
    logger.error('Questo script non può essere eseguito in produzione senza --force-production');
    return;
  }
  
  // Avviso se in modalità dry run
  if (DRY_RUN) {
    logger.info('MODALITÀ DRY RUN: nessuna modifica verrà apportata al database');
  }
  
  try {
    // Connessione al database
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    logger.info('Connessione a MongoDB stabilita');
    
    // Costruisci la query per trovare prodotti con immagini mancanti
    const query = {
      $or: [
        { images: { $exists: false } },
        { images: { $size: 0 } },
        { images: { $elemMatch: { $eq: "" } } },
        { images: { $elemMatch: { $eq: null } } }
      ]
    };
    
    // Aggiungi filtro per source se specificato
    if (SOURCE) {
      query.source = SOURCE;
      logger.info(`Filtrando solo prodotti da: ${SOURCE}`);
    }
    
    // Conta i prodotti con immagini mancanti
    const totalCount = await Product.countDocuments(query);
    logger.info(`Trovati ${totalCount} prodotti con immagini mancanti o invalide`);
    
    if (totalCount === 0) {
      logger.info('Nessun prodotto da riparare trovato!');
      await mongoose.connection.close();
      return;
    }
    
    // Applica limite se specificato
    const limitMsg = LIMIT > 0 ? `Limitato a ${LIMIT} prodotti` : 'Processando tutti i prodotti';
    logger.info(limitMsg);
    
    // Ottieni i prodotti da riparare
    let productsToRepair = Product.find(query);
    if (LIMIT > 0) {
      productsToRepair = productsToRepair.limit(LIMIT);
    }
    
    const products = await productsToRepair.exec();
    
    // Contatori per le statistiche
    let repairedCount = 0;
    let failedCount = 0;
    
    // Processa ogni prodotto
    for (const product of products) {
      logger.info(`Processando: ${product.name} (ID: ${product._id})`);
      
      // Logica di riparazione specifica per ogni fonte di dati
      let imagesFixed = false;
      
      if (product.source === 'arcaplanet') {
        imagesFixed = await repairArcaplanetImages(product);
      } else if (product.source === 'zooplus') {
        imagesFixed = await repairZooplusImages(product);
      } else {
        logger.warn(`Fonte dati '${product.source}' non supportata per la riparazione`);
      }
      
      // Aggiorna le statistiche
      if (imagesFixed) {
        repairedCount++;
        if (!DRY_RUN) {
          await product.save();
          logger.info(`Prodotto riparato e salvato: ${product.name}`);
        } else {
          logger.info(`Prodotto potenzialmente riparabile: ${product.name} (Dry run, nessun salvataggio)`);
        }
      } else {
        failedCount++;
        logger.warn(`Impossibile riparare le immagini per: ${product.name}`);
      }
    }
    
    // Mostra statistiche finali
    logger.info('=== RISULTATI RIPARAZIONE ===');
    logger.info(`Totale prodotti processati: ${products.length}`);
    logger.info(`Prodotti riparati: ${repairedCount}`);
    logger.info(`Prodotti non riparabili: ${failedCount}`);
    
  } catch (error) {
    logger.error(`Errore durante la riparazione delle immagini: ${error.message}`);
    if (error.stack) {
      logger.debug(error.stack);
    }
  } finally {
    // Chiudi la connessione al database
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      logger.info('Connessione a MongoDB chiusa');
    }
  }
}

/**
 * Funzione per riparare le immagini dei prodotti Arcaplanet
 */
async function repairArcaplanetImages(product) {
  try {
    // Se il prodotto ha un'immagine principale ma non è nella lista immagini
    if (product.mainImage && (!product.images || !product.images.includes(product.mainImage))) {
      if (!product.images) product.images = [];
      product.images.push(product.mainImage);
      logger.info(`Aggiunta immagine principale a immagini: ${product.mainImage}`);
      return true;
    }
    
    // Se ha url del prodotto ma nessuna immagine, potremmo tentare di ricavare l'immagine dall'URL
    // Questa è solo una implementazione di esempio
    if (product.url && (!product.images || product.images.length === 0)) {
      // In un sistema reale, qui potremmo fare uno scrape della pagina del prodotto
      logger.info(`Potremmo tentare di ri-scrapare l'immagine da: ${product.url}`);
      // Questo è solo un esempio, in realtà non modifica nulla
      return false;
    }
    
    return false;
  } catch (error) {
    logger.error(`Errore durante la riparazione immagini Arcaplanet: ${error.message}`);
    return false;
  }
}

/**
 * Funzione per riparare le immagini dei prodotti Zooplus
 */
async function repairZooplusImages(product) {
  try {
    // Logica specifica per Zooplus simile a quella di Arcaplanet
    if (product.mainImage && (!product.images || !product.images.includes(product.mainImage))) {
      if (!product.images) product.images = [];
      product.images.push(product.mainImage);
      logger.info(`Aggiunta immagine principale a immagini: ${product.mainImage}`);
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error(`Errore durante la riparazione immagini Zooplus: ${error.message}`);
    return false;
  }
}

// Esegui lo script se chiamato direttamente
if (require.main === module) {
  repairMissingImages()
    .then(() => {
      logger.info('Script di riparazione immagini completato');
      process.exit(0);
    })
    .catch(error => {
      logger.error(`Errore fatale: ${error.message}`);
      process.exit(1);
    });
} 