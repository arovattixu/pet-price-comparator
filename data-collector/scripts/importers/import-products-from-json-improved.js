/**
 * Script migliorato per importare prodotti da file JSON a MongoDB
 * Versione con rilevamento avanzato della fonte e controlli anti-duplicazione
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Product = require('../../src/models/product');
const logger = require('../../src/utils/logger');

// Ottieni parametri da linea di comando
const args = process.argv.slice(2);
const jsonFilePath = args[0];
const options = {
  dryRun: args.includes('--dry-run'),
  forceProduction: args.includes('--force-production'),
  skipBackup: args.includes('--skip-backup'),
  ignoreErrors: args.includes('--ignore-errors'),
  forceSource: args.find(arg => arg.startsWith('--force-source=')),
  batchSize: 50
};

// Estrai il valore di forceSource se presente
if (options.forceSource) {
  options.forceSource = options.forceSource.split('=')[1];
  if (!['arcaplanet', 'zooplus'].includes(options.forceSource)) {
    logger.error(`Fonte non valida: ${options.forceSource}. Utilizza 'arcaplanet' o 'zooplus'`);
    process.exit(1);
  }
}

/**
 * Funzione principale che coordina il processo di importazione
 */
async function importProductsFromJson() {
  // Controlli preliminari
  if (!jsonFilePath) {
    logger.error('Percorso del file JSON mancante.');
    logger.info('Utilizzo: node import-products-from-json-improved.js <file.json> [--dry-run] [--force-production] [--skip-backup] [--ignore-errors] [--force-source=arcaplanet|zooplus]');
    process.exit(1);
  }

  if (!fs.existsSync(jsonFilePath)) {
    logger.error(`File non trovato: ${jsonFilePath}`);
    process.exit(1);
  }

  // Avvisi ambiente
  if (process.env.NODE_ENV === 'production' && !options.forceProduction) {
    logger.warn('⚠️ ATTENZIONE: Stai per eseguire l\'importazione in ambiente di produzione.');
    logger.warn('Per procedere, esegui nuovamente lo script con --force-production');
    process.exit(1);
  }

  try {
    // Connessione al database
    logger.info('Connessione a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    logger.info('Connessione a MongoDB stabilita');

    // Backup dati (se non esplicitamente saltato)
    if (!options.skipBackup) {
      await performBackupBeforeImport();
    }

    // Carica e valida il file JSON
    logger.info(`Caricamento file JSON: ${jsonFilePath}`);
    const jsonData = await loadAndValidateJsonFile(jsonFilePath);
    logger.info(`File JSON caricato con successo. ${jsonData.length} prodotti trovati.`);

    // Analisi preliminare per determinare la fonte predominante
    const sourceAnalysis = analyzeSourceDistribution(jsonData);
    logger.info(`Analisi fonte: ${sourceAnalysis.arcaplanet} prodotti Arcaplanet, ${sourceAnalysis.zooplus} prodotti Zooplus, ${sourceAnalysis.unknown} prodotti sconosciuti`);
    
    // Imposta la fonte predominante se non forzata manualmente
    const predominantSource = options.forceSource || 
                             (sourceAnalysis.arcaplanet > sourceAnalysis.zooplus ? 'arcaplanet' : 'zooplus');
    logger.info(`Fonte predominante rilevata: ${predominantSource}${options.forceSource ? ' (forzata manualmente)' : ''}`);

    // Verifica pre-importazione per duplicati
    await checkForPotentialDuplicates(jsonData, predominantSource);

    // Esegui dry run se richiesto
    if (options.dryRun) {
      logger.info('Esecuzione in modalità DRY RUN (nessuna modifica verrà applicata al database)');
      const dryRunStats = await processProducts(jsonData, { ...options, dryRun: true, predominantSource });
      logger.info('Risultati della simulazione (dry run):', dryRunStats);
      
      if (dryRunStats.errors > 0 && !options.ignoreErrors) {
        logger.error(`Errori rilevati durante la simulazione: ${dryRunStats.errors}. Importazione annullata.`);
        logger.error('Usa --ignore-errors per procedere nonostante gli errori.');
        process.exit(1);
      }
    }

    // Procedi con l'importazione effettiva
    const importStats = await processProducts(jsonData, { ...options, predominantSource });
    logger.info('Importazione completata con i seguenti risultati:');
    logger.info(`- Prodotti processati: ${importStats.processed}`);
    logger.info(`- Prodotti aggiunti: ${importStats.added}`);
    logger.info(`- Prodotti aggiornati: ${importStats.updated}`);
    logger.info(`- Prodotti saltati: ${importStats.skipped}`);
    logger.info(`- Errori: ${importStats.errors}`);

    // Verifica integrità dei dati dopo l'importazione
    if (!options.dryRun) {
      const integrityResult = await verifyImportIntegrity();
      if (!integrityResult.allPassed) {
        logger.warn('⚠️ Verifica integrità post-importazione: PROBLEMI RILEVATI');
        integrityResult.checks.forEach(check => {
          if (!check.passed) {
            logger.warn(`- ${check.check}: FALLITO. ${check.details}`);
          }
        });
      } else {
        logger.info('✅ Verifica integrità post-importazione: SUPERATA');
      }
    }

  } catch (error) {
    logger.error(`Errore durante l'importazione: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  } finally {
    // Chiusura connessione MongoDB
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      logger.info('Connessione a MongoDB chiusa');
    }
  }
}

/**
 * Analizza la distribuzione delle fonti nel set di dati
 */
function analyzeSourceDistribution(items) {
  const distribution = {
    arcaplanet: 0,
    zooplus: 0,
    unknown: 0
  };

  for (const item of items) {
    const source = determineSourceFromData(item);
    if (source === 'arcaplanet') {
      distribution.arcaplanet++;
    } else if (source === 'zooplus') {
      distribution.zooplus++;
    } else {
      distribution.unknown++;
    }
  }

  return distribution;
}

/**
 * Verifica potenziali duplicati prima dell'importazione
 */
async function checkForPotentialDuplicates(items, predominantSource) {
  logger.info('Verifica di potenziali duplicati...');
  
  // Estrai gli ID di origine
  const sourceIds = items.map(item => {
    if (item.sourceId) return item.sourceId;
    if (item.node?.id) return item.node.id;
    if (item.node?.sku) return item.node.sku;
    return item.id || item.sku || '';
  }).filter(Boolean);
  
  // Verifica duplicati nel database
  const existingProducts = await Product.find({
    source: predominantSource,
    sourceId: { $in: sourceIds }
  }).lean();

  if (existingProducts.length > 0) {
    logger.warn(`⚠️ Trovati ${existingProducts.length} prodotti potenzialmente duplicati nel database:`);
    existingProducts.slice(0, 5).forEach(product => {
      logger.warn(`- ${product.name} (${product.source} - ${product.sourceId})`);
    });
    
    if (existingProducts.length > 5) {
      logger.warn(`... e altri ${existingProducts.length - 5} prodotti`);
    }
    
    logger.info("Durante l'importazione, questi prodotti verranno aggiornati invece che inseriti come nuovi.");
  } else {
    logger.info('Nessun duplicato trovato nel database.');
  }
}

/**
 * Esegue un backup dei dati presenti nel database prima dell'importazione
 */
async function performBackupBeforeImport() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = './backups';
    
    // Crea directory se non esiste
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const backupPath = path.join(backupDir, `products_backup_${timestamp}.json`);
    
    logger.info('Creazione backup dei prodotti esistenti...');
    
    // Esporta tutti i prodotti in modo incrementale per gestire grandi volumi di dati
    const totalCount = await Product.countDocuments();
    const batchSize = 1000;
    const batches = Math.ceil(totalCount / batchSize);
    
    const writeStream = fs.createWriteStream(backupPath, { encoding: 'utf8' });
    writeStream.write('[\n');
    
    let isFirst = true;
    
    for (let i = 0; i < batches; i++) {
      const products = await Product.find({})
        .skip(i * batchSize)
        .limit(batchSize)
        .lean();
      
      for (const product of products) {
        if (!isFirst) {
          writeStream.write(',\n');
        } else {
          isFirst = false;
        }
        writeStream.write(JSON.stringify(product));
      }
      
      logger.info(`Backup in corso: ${Math.min((i + 1) * batchSize, totalCount)}/${totalCount} prodotti`);
    }
    
    writeStream.write('\n]');
    writeStream.end();
    
    logger.info(`Backup completato: ${totalCount} prodotti salvati in ${backupPath}`);
    return backupPath;
  } catch (error) {
    logger.error(`Errore durante il backup: ${error.message}`);
    if (!options.ignoreErrors) {
      throw error;
    }
  }
}

/**
 * Carica e valida il file JSON
 */
async function loadAndValidateJsonFile(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const jsonData = JSON.parse(fileContent);
    
    if (!Array.isArray(jsonData)) {
      throw new Error('Il file JSON deve contenere un array di prodotti');
    }
    
    return jsonData;
  } catch (error) {
    logger.error(`Errore durante il caricamento del file JSON: ${error.message}`);
    throw error;
  }
}

/**
 * Processa i prodotti in modo sicuro, con gestione batch e trasazioni
 */
async function processProducts(products, options) {
  const stats = {
    processed: 0,
    added: 0,
    updated: 0,
    skipped: 0,
    errors: 0
  };

  // Dividi i prodotti in batch per un'elaborazione più efficiente
  const batches = [];
  for (let i = 0; i < products.length; i += options.batchSize) {
    batches.push(products.slice(i, i + options.batchSize));
  }

  logger.info(`Elaborazione di ${products.length} prodotti in ${batches.length} batch`);

  // Elabora ogni batch
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    logger.info(`Elaborazione batch ${batchIndex + 1}/${batches.length} (${batch.length} prodotti)`);

    const batchStats = await processBatch(batch, options);
    
    // Aggiorna le statistiche complessive
    stats.processed += batchStats.processed;
    stats.added += batchStats.added;
    stats.updated += batchStats.updated;
    stats.skipped += batchStats.skipped;
    stats.errors += batchStats.errors;
  }

  return stats;
}

/**
 * Processa un singolo batch di prodotti
 */
async function processBatch(products, options) {
  const stats = {
    processed: 0,
    added: 0,
    updated: 0,
    skipped: 0,
    errors: 0
  };

  // Usa una transazione MongoDB se non in modalità dry run
  if (!options.dryRun) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      for (const product of products) {
        try {
          const result = await processProduct(product, options, session);
          stats.processed++;
          stats[result.action]++;
        } catch (error) {
          const sourceId = product.sourceId || product.id || (product.node && product.node.id) || 'unknown';
          const name = product.name || product.title || (product.node && product.node.name) || 'Unknown Product';
          
          logger.error(`Errore durante l'elaborazione del prodotto: ${error.message}`, { 
            product: { sourceId, name } 
          });
          stats.errors++;
          if (!options.ignoreErrors) {
            throw error;
          }
        }
      }

      // Conferma le modifiche solo se non in modalità dry run
      await session.commitTransaction();
      session.endSession();
    } catch (error) {
      // Annulla tutte le modifiche in caso di errore
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } else {
    // Modalità dry run: simula l'elaborazione senza effettuare modifiche
    for (const product of products) {
      try {
        const result = await simulateProcessProduct(product, options);
        stats.processed++;
        stats[result.action]++;
      } catch (error) {
        const sourceId = product.sourceId || product.id || (product.node && product.node.id) || 'unknown';
        const name = product.name || product.title || (product.node && product.node.name) || 'Unknown Product';
        
        logger.error(`[DRY RUN] Errore durante la simulazione del prodotto: ${error.message}`, { 
          product: { sourceId, name } 
        });
        stats.errors++;
        if (!options.ignoreErrors) {
          throw error;
        }
      }
    }
  }

  return stats;
}

/**
 * Elabora un singolo prodotto
 */
async function processProduct(product, options, session) {
  // Validazione e sanitizzazione
  const validationResult = validateProductData(product, options.predominantSource);
  if (!validationResult.valid) {
    logger.warn(`Prodotto non valido: ${validationResult.errors.join(', ')}`);
    
    if (!options.ignoreErrors) {
      throw new Error(`Validazione fallita: ${validationResult.errors.join(', ')}`);
    }
    
    return { action: 'skipped' };
  }

  // Mappa il prodotto al formato del modello
  const productData = mapToProductSchema(product, options.predominantSource);
  
  // Verifica se il prodotto esiste già
  const query = {
    source: productData.source,
    sourceId: productData.sourceId
  };
  
  const existingProduct = await Product.findOne(query).session(session);
  
  if (existingProduct) {
    // Aggiorna prodotto esistente
    const updatedProduct = await Product.findOneAndUpdate(
      query,
      { $set: productData },
      { new: true, session }
    );
    
    logger.debug(`Aggiornato prodotto: ${productData.name} (${productData.sourceId})`);
    return { action: 'updated', product: updatedProduct };
  } else {
    // Crea nuovo prodotto
    const newProduct = new Product(productData);
    await newProduct.save({ session });
    
    logger.debug(`Salvato nuovo prodotto: ${productData.name} (${productData.sourceId})`);
    return { action: 'added', product: newProduct };
  }
}

/**
 * Simula l'elaborazione di un prodotto (per dry run)
 */
async function simulateProcessProduct(product, options) {
  // Validazione
  const validationResult = validateProductData(product, options.predominantSource);
  if (!validationResult.valid) {
    logger.warn(`[DRY RUN] Prodotto non valido: ${validationResult.errors.join(', ')}`);
    
    if (!options.ignoreErrors) {
      throw new Error(`Validazione fallita: ${validationResult.errors.join(', ')}`);
    }
    
    return { action: 'skipped' };
  }

  // Mappa il prodotto al formato del modello
  const productData = mapToProductSchema(product, options.predominantSource);
  
  // Verifica se il prodotto esiste già (senza session)
  const query = {
    source: productData.source,
    sourceId: productData.sourceId
  };
  
  const existingProduct = await Product.findOne(query);
  
  if (existingProduct) {
    logger.debug(`[DRY RUN] Aggiornato prodotto: ${productData.name} (${productData.sourceId})`);
    return { action: 'updated' };
  } else {
    logger.debug(`[DRY RUN] Salvato nuovo prodotto: ${productData.name} (${productData.sourceId})`);
    return { action: 'added' };
  }
}

/**
 * Valida i dati del prodotto
 */
function validateProductData(item, predominantSource) {
  const errors = [];
  
  // Determina la fonte in base all'item e alla fonte predominante
  const source = item.source || 
                determineSourceFromData(item) || 
                predominantSource;
  
  // Estrai sourceId dai vari campi possibili
  let sourceId = '';
  
  if (source === 'arcaplanet') {
    // Priorità per item con struttura Arcaplanet
    sourceId = item.sourceId || 
              (item.node && (item.node.id || item.node.sku)) || 
              item.id || 
              item.sku || 
              (item.metadata && item.metadata.vtexId) || 
              '';
  } else {
    // Priorità per item con struttura Zooplus
    sourceId = item.sourceId || 
              item.id || 
              item.shopIdentifier || 
              item.sku || 
              '';
  }
  
  // Validazione campi obbligatori
  if (!sourceId) errors.push('sourceId mancante');
  if (!source) errors.push('source mancante');
  
  // Ottieni il nome da vari campi possibili
  const name = item.name || 
               item.title || 
               (item.node && item.node.name) || 
               (item.isVariantOf && item.isVariantOf.name) || 
               '';
               
  if (!name) errors.push('name mancante');
  
  return { 
    valid: errors.length === 0, 
    errors,
    sourceId,
    source,
    name
  };
}

/**
 * Determina la fonte dei dati in base alle caratteristiche del JSON
 * Versione migliorata basata sull'analisi della struttura
 */
function determineSourceFromData(item) {
  // Punteggio di confidenza per Arcaplanet
  let arcaplanetScore = 0;
  
  // Caratteristiche distintive di Arcaplanet
  if (item.source === 'arcaplanet') arcaplanetScore += 3;  // Peso maggiore se dichiarato esplicitamente
  if (item.node !== undefined) arcaplanetScore += 3;      // Peso maggiore per la struttura "node"
  if (item.metadata?.vtexId !== undefined) arcaplanetScore += 2;
  if (item.url?.includes('arcaplanet.it')) arcaplanetScore += 2;
  if (item.slug?.includes('arcaplanet')) arcaplanetScore += 1;
  if (item.categories !== undefined) arcaplanetScore += 1;
  if (item.stockStatus !== undefined) arcaplanetScore += 1;
  
  // Caratteristiche distintive di Zooplus
  let zooplusScore = 0;
  if (item.source === 'zooplus') zooplusScore += 3;      // Peso maggiore se dichiarato esplicitamente
  if (item.shopIdentifier) zooplusScore += 3;
  if (item.url?.includes('zooplus')) zooplusScore += 2;
  if (item.path?.includes('zooplus')) zooplusScore += 2;
  if (item.picture200 || item.picture400) zooplusScore += 2;
  
  // Determina la fonte in base al punteggio più alto
  if (arcaplanetScore > zooplusScore && arcaplanetScore >= 2) {
    return 'arcaplanet';
  } else if (zooplusScore > 0) {
    return 'zooplus';
  }
  
  // Fallback per strutture annidiate di Arcaplanet
  // Verifica se la struttura è quella anniddata con "node"
  if (item.node) {
    if (item.node.slug?.includes('arcaplanet')) return 'arcaplanet';
    if (item.node.isVariantOf?.hasVariant) return 'arcaplanet';
    return 'arcaplanet';  // Se c'è "node", molto probabile sia Arcaplanet
  }
  
  // Non è stato possibile determinare la fonte
  return null;
}

/**
 * Mappa i dati del prodotto allo schema del database
 */
function mapToProductSchema(item, predominantSource) {
  // Determina la fonte corretta
  const source = item.source || determineSourceFromData(item) || predominantSource;
  
  // Gestisci strutture nidificate di ArcaPlanet
  if (source === 'arcaplanet') {
    if (item.node) {
      return mapArcaPlanetProductNested(item);
    } else {
      return mapArcaPlanetProductFlat(item);
    }
  }
  
  // Se è già nel formato del modello, usa direttamente
  if (item.source && item.sourceId && item.prices && Array.isArray(item.prices)) {
    // Assicurati che i campi siano aggiornati
    return {
      ...item,
      updatedAt: new Date()
    };
  }
  
  // Assume che sia Zooplus se non è ArcaPlanet e non è già nel formato corretto
  return mapZooplusProduct(item);
}

/**
 * Mappa un prodotto Zooplus al formato del modello
 */
function mapZooplusProduct(item) {
  const sourceId = item.sourceId || item.shopIdentifier || item.id || 
                   (item.path ? item.path.split('/').pop() : '') || 
                   `zp-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
                   
  const name = item.name || item.title || 'Prodotto Zooplus';
  const description = item.description || item.summary || '';
  const imageUrl = item.imageUrl || item.picture400 || item.picture200 || '';
  const brand = item.brand || '';
  const category = item.category || '';
  
  // Estrai prezzo e disponibilità
  const price = extractPrice(item);
  const inStock = item.available !== false;
  
  // Costruisci URL
  const productUrl = item.url || 
                    (item.path ? `https://www.zooplus.it${item.path}` : '');
  
  return {
    source: 'zooplus',
    sourceId: sourceId,
    name: name,
    description: description,
    imageUrl: imageUrl,
    brand: brand,
    category: category,
    prices: [{
      store: 'zooplus',
      price: price,
      currency: 'EUR',
      url: productUrl,
      lastUpdated: new Date(),
      inStock: inStock
    }],
    sku: item.sku || sourceId,
    weight: item.weight || '',
    updatedAt: new Date(),
    createdAt: item.createdAt || new Date()
  };
}

/**
 * Mappa un prodotto ArcaPlanet (con struttura annidata) al formato del modello
 */
function mapArcaPlanetProductNested(item) {
  const node = item.node;
  
  // Estrai i dati necessari
  const sourceId = node.id || node.sku || '';
  const name = node.isVariantOf?.name || node.name || '';
  const brand = node.brand?.name || '';
  
  // Estrai peso/misura dalle proprietà aggiuntive
  let weight = '';
  if (node.additionalProperty && Array.isArray(node.additionalProperty)) {
    const weightProp = node.additionalProperty.find(prop => 
      prop.name === 'Weight (G)' || prop.name === 'Weight' || prop.name.includes('Weight')
    );
    if (weightProp) {
      weight = weightProp.value;
    }
  }
  
  // Estrai URL immagine
  const imageUrl = node.image && node.image.length > 0 ? node.image[0].url : '';
  
  // Estrai prezzo e disponibilità
  let price = 0;
  let inStock = true;
  
  // Determina il prezzo e la disponibilità
  if (node.offers && node.offers.lowPrice) {
    price = parseFloat(node.offers.lowPrice);
  }
  
  if (node.isVariantOf?.hasVariant && node.isVariantOf.hasVariant.length > 0) {
    const variant = node.isVariantOf.hasVariant.find(v => v.sku === node.sku);
    if (variant && variant.offers && variant.offers.offers && variant.offers.offers.length > 0) {
      inStock = variant.offers.offers[0].availability === 'https://schema.org/InStock';
    }
  }
  
  // Costruisci URL prodotto
  const productUrl = `https://www.arcaplanet.it/p/${node.slug || sourceId}`;
  
  return {
    source: 'arcaplanet',
    sourceId: sourceId,
    name: name,
    description: '',  // ArcaPlanet spesso non ha descrizione nel JSON
    imageUrl: imageUrl,
    brand: brand,
    category: item.category || '',  // Potrebbe essere fornito dall'esterno
    prices: [{
      store: 'arcaplanet',
      price: price,
      currency: 'EUR',
      url: productUrl,
      lastUpdated: new Date(),
      inStock: inStock
    }],
    sku: node.sku || sourceId,
    weight: weight,
    updatedAt: new Date(),
    createdAt: new Date()
  };
}

/**
 * Mappa un prodotto ArcaPlanet (con struttura piatta) al formato del modello
 */
function mapArcaPlanetProductFlat(item) {
  // Estrai i dati necessari
  const sourceId = item.sourceId || item.id || item.sku || '';
  const name = item.name || item.title || '';
  const brand = typeof item.brand === 'string' ? item.brand : (item.brand?.name || '');
  const description = item.description || '';
  const imageUrl = item.imageUrl || '';
  
  // Estrai prezzo
  let price = 0;
  let inStock = true;
  
  if (typeof item.price === 'number') {
    price = item.price;
  } else if (item.price && item.price.current) {
    price = parseFloat(item.price.current);
  } else {
    price = extractPrice(item);
  }
  
  if (item.stockStatus) {
    inStock = item.stockStatus === 'IN_STOCK';
  }
  
  // Costruisci URL prodotto
  const productUrl = item.url || `https://www.arcaplanet.it/p/${item.slug || sourceId}`;
  
  // Categoria dal path o dalle categorie
  let category = '';
  if (item.categories && item.categories.length > 0) {
    category = item.categories[0].path || '';
  } else if (item.metadata && item.metadata.categoryPath) {
    category = item.metadata.categoryPath;
  }
  
  return {
    source: 'arcaplanet',
    sourceId: sourceId,
    name: name,
    description: description,
    imageUrl: imageUrl,
    brand: brand,
    category: category,
    prices: [{
      store: 'arcaplanet',
      price: price,
      currency: 'EUR',
      url: productUrl,
      lastUpdated: new Date(),
      inStock: inStock
    }],
    sku: item.sku || sourceId,
    weight: item.weight || '',
    updatedAt: new Date(),
    createdAt: item.createdAt || new Date()
  };
}

/**
 * Estrae il prezzo da un oggetto prodotto
 */
function extractPrice(item) {
  // Gestisce diversi formati di prezzo
  if (typeof item.price === 'number') {
    return item.price;
  }
  
  if (item.price?.metaPropPrice) {
    return parseFloat(item.price.metaPropPrice);
  }
  
  if (item.price?.current) {
    return parseFloat(item.price.current);
  }
  
  // Se c'è un array prices, usa il primo prezzo
  if (item.prices && Array.isArray(item.prices) && item.prices.length > 0) {
    return parseFloat(item.prices[0].price) || 0;
  }
  
  // Controlla nelle varianti
  if (item.variants && Array.isArray(item.variants) && item.variants.length > 0) {
    if (item.variants[0].price) {
      if (typeof item.variants[0].price === 'number') {
        return item.variants[0].price;
      } else if (item.variants[0].price.current) {
        return parseFloat(item.variants[0].price.current);
      }
    }
  }
  
  // Estrai da string come "12,99 €"
  if (typeof item.price === 'string') {
    const match = item.price.match(/([0-9]+[,.][0-9]+)/);
    if (match) {
      return parseFloat(match[0].replace(',', '.'));
    }
  }
  
  // Default: prezzo zero
  return 0;
}

/**
 * Verifica l'integrità dei dati dopo l'importazione
 */
async function verifyImportIntegrity() {
  const integrityChecks = [];
  
  // Verifica che tutti i prodotti abbiano campi obbligatori
  const missingFields = await Product.countDocuments({
    $or: [
      { source: { $exists: false } },
      { sourceId: { $exists: false } },
      { name: { $exists: false } }
    ]
  });
  
  integrityChecks.push({
    check: 'campi_obbligatori',
    passed: missingFields === 0,
    details: missingFields > 0 ? `${missingFields} prodotti con campi mancanti` : null
  });
  
  // Verifica duplicati
  const pipeline = [
    { $group: { _id: { source: "$source", sourceId: "$sourceId" }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ];
  const duplicates = await Product.aggregate(pipeline);
  
  integrityChecks.push({
    check: 'duplicati',
    passed: duplicates.length === 0,
    details: duplicates.length > 0 ? `${duplicates.length} chiavi duplicate trovate` : null
  });
  
  // Verifica prodotti senza prezzi
  const missingPrices = await Product.countDocuments({
    $or: [
      { prices: { $exists: false } },
      { prices: { $size: 0 } },
      { 'prices.price': { $exists: false } }
    ]
  });
  
  integrityChecks.push({
    check: 'prezzi',
    passed: missingPrices === 0,
    details: missingPrices > 0 ? `${missingPrices} prodotti senza informazioni sui prezzi` : null
  });
  
  return {
    allPassed: integrityChecks.every(check => check.passed),
    checks: integrityChecks
  };
}

// Esegui lo script
importProductsFromJson()
  .then(() => {
    logger.info('Script completato con successo');
    process.exit(0);
  })
  .catch(error => {
    logger.error(`Errore durante l'esecuzione dello script: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }); 