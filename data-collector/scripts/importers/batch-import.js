/**
 * Script di importazione batch ottimizzato
 * Utilizza operazioni dirette sul database per migliorare le prestazioni
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

// Configurazione
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pet-price-comparator';
const RESULTS_DIR = path.join(__dirname, '../../results');
const BATCH_SIZE = 25; // Dimensione batch ridotta per evitare timeout

// Estrai il nome del database dall'URI
function getDatabaseName(uri) {
  const parts = uri.split('/');
  let dbName = parts[parts.length - 1];
  if (dbName.includes('?')) {
    dbName = dbName.split('?')[0];
  }
  return dbName;
}

// Normalizza i dati del prodotto in base alla fonte
function normalizeProductData(productData, source) {
  // Determina il sourceId in base al formato
  let sourceId;
  let name;
  let description = '';
  let brand = '';
  let imageUrl = '';
  let price = 0;
  let url = '';
  let category = '';
  let variants = [];
  
  if (source === 'arcaplanet') {
    // Formato Arcaplanet
    sourceId = productData.id || productData.sku;
    name = productData.title || productData.name;
    description = productData.description || '';
    brand = productData.brand || '';
    imageUrl = Array.isArray(productData.images) && productData.images.length > 0 
      ? productData.images[0] 
      : (productData.imageUrl || '');
    price = productData.price?.current || 0;
    url = productData.url || '';
    category = productData.category || '';
    
    // Se ci sono varianti, le normalizziamo
    if (productData.variants && Array.isArray(productData.variants)) {
      variants = productData.variants.map(variant => ({
        variantId: variant.id || 'default',
        description: variant.title || variant.name || 'Variante',
        available: variant.available !== false,
        currentPrice: {
          amount: parseFloat(variant.price || 0),
          currency: 'EUR'
        }
      }));
    }
  } else if (source === 'zooplus') {
    // Formato Zooplus
    sourceId = productData.sourceId || productData.id || productData.sku;
    name = productData.name || '';
    description = productData.description || '';
    brand = productData.brand || '';
    imageUrl = productData.imageUrl || '';
    url = productData.prices && productData.prices.length > 0 ? productData.prices[0].url : '';
    price = productData.prices && productData.prices.length > 0 ? productData.prices[0].price : 0;
    category = productData.category || '';
    
    // Controllo le varianti
    if (productData.variants && Array.isArray(productData.variants)) {
      variants = productData.variants.map(variant => ({
        variantId: variant.id || 'default',
        description: variant.name || 'Variante',
        available: variant.available !== false,
        currentPrice: {
          amount: parseFloat(variant.price || 0),
          currency: 'EUR'
        }
      }));
    }
  }
  
  // Verifica che i campi essenziali siano presenti
  if (!sourceId) {
    throw new Error('Prodotto senza ID');
  }
  
  if (!name) {
    throw new Error('Prodotto senza nome');
  }
  
  return {
    sourceId: sourceId.toString(),
    name,
    description,
    brand,
    imageUrl,
    price: parseFloat(price) || 0,
    url,
    category,
    variants
  };
}

// Determina il petType da nome e categoria
function determinePetType(name, category) {
  const nameLower = name.toLowerCase();
  const categoryLower = category.toLowerCase();
  
  if (nameLower.includes('cane') || 
      nameLower.includes('cani') || 
      categoryLower.includes('cane') || 
      categoryLower.includes('cani')) {
    return 'cane';
  }
  
  if (nameLower.includes('gatto') || 
      nameLower.includes('gatti') || 
      categoryLower.includes('gatto') || 
      categoryLower.includes('gatti')) {
    return 'gatto';
  }
  
  if (nameLower.includes('roditore') || 
      nameLower.includes('roditori') || 
      categoryLower.includes('roditore') || 
      categoryLower.includes('roditori')) {
    return 'piccoli animali';
  }
  
  // Default
  return 'altro';
}

async function batchImport() {
  console.log('Avvio importazione batch...');
  console.log(`Directory risultati: ${RESULTS_DIR}`);
  
  // Configura client MongoDB
  const client = new MongoClient(MONGODB_URI, {
    connectTimeoutMS: 30000,
    socketTimeoutMS: 60000,
    serverSelectionTimeoutMS: 30000
  });
  
  // Statistiche
  let stats = {
    processedFiles: 0,
    processedProducts: 0,
    newProducts: 0,
    updatedProducts: 0,
    newPricePoints: 0,
    errors: 0,
    skipped: 0
  };
  
  try {
    // Connetti al database
    await client.connect();
    console.log('Connesso al database MongoDB');
    
    const dbName = getDatabaseName(MONGODB_URI);
    const db = client.db(dbName);
    
    // Collezioni
    const productsCollection = db.collection('products');
    const pricePointsCollection = db.collection('pricepoints');
    
    // Fonti di dati
    const sources = ['arcaplanet', 'zooplus'];
    
    for (const source of sources) {
      const sourceDir = path.join(RESULTS_DIR, source);
      
      // Verifica directory
      if (!fs.existsSync(sourceDir)) {
        console.warn(`Directory per ${source} non trovata: ${sourceDir}`);
        continue;
      }
      
      console.log(`Elaborazione dei dati da ${source}...`);
      console.log(`Directory: ${sourceDir}`);
      
      // Leggi i file JSON
      const files = fs.readdirSync(sourceDir)
        .filter(file => file.endsWith('.json') && !file.includes('report'));
      
      console.log(`Trovati ${files.length} file JSON in ${sourceDir}`);
      
      if (files.length === 0) continue;
      
      for (const file of files) {
        try {
          const filePath = path.join(sourceDir, file);
          console.log(`Elaborazione file: ${filePath}`);
          
          // Leggi e analizza il file
          const rawData = fs.readFileSync(filePath, 'utf8');
          
          if (!rawData || rawData.trim() === '') {
            console.warn(`File vuoto: ${filePath}`);
            continue;
          }
          
          let jsonData;
          
          try {
            jsonData = JSON.parse(rawData);
          } catch (parseError) {
            console.error(`Errore nel parsing JSON del file ${file}: ${parseError.message}`);
            stats.errors++;
            continue;
          }
          
          if (!Array.isArray(jsonData) || jsonData.length === 0) {
            console.warn(`Il file ${file} non contiene un array valido. Contiene: ${typeof jsonData}`);
            stats.skipped++;
            continue;
          }
          
          console.log(`File ${file}: processando ${jsonData.length} prodotti`);
          
          // Elabora i prodotti in batch
          for (let i = 0; i < jsonData.length; i += BATCH_SIZE) {
            const batch = jsonData.slice(i, i + BATCH_SIZE);
            const pricePointBatch = [];
            
            // Elabora ogni prodotto nel batch
            for (const productData of batch) {
              try {
                if (!productData) {
                  stats.skipped++;
                  continue;
                }
                
                stats.processedProducts++;
                
                // Normalizza i dati del prodotto
                let normalizedData;
                try {
                  normalizedData = normalizeProductData(productData, source);
                } catch (normalizeError) {
                  console.warn(`Impossibile normalizzare prodotto: ${normalizeError.message}`);
                  stats.skipped++;
                  continue;
                }
                
                const { sourceId, name, description, brand, imageUrl, price, url, category, variants } = normalizedData;
                
                // Cerca prodotto esistente
                const existingProduct = await productsCollection.findOne({
                  source: source,
                  sourceId: sourceId
                });
                
                // Determina il petType
                const petType = determinePetType(name, category);
                
                if (!existingProduct) {
                  // Crea nuovo prodotto
                  const newProduct = {
                    name,
                    description,
                    brand,
                    category,
                    imageUrl,
                    source,
                    sourceId,
                    petType,
                    prices: [{
                      store: source,
                      price: parseFloat(price),
                      currency: 'EUR',
                      url,
                      lastUpdated: new Date()
                    }],
                    createdAt: new Date(),
                    updatedAt: new Date()
                  };
                  
                  // Aggiungi varianti se presenti
                  if (variants && variants.length > 0) {
                    newProduct.variants = variants;
                  }
                  
                  // Inserisci
                  const result = await productsCollection.insertOne(newProduct);
                  stats.newProducts++;
                  
                  // Crea price point
                  pricePointBatch.push({
                    productId: result.insertedId,
                    source,
                    price: {
                      amount: parseFloat(price),
                      currency: 'EUR'
                    },
                    recordedAt: new Date()
                  });
                  stats.newPricePoints++;
                } else {
                  // Aggiorna prodotto esistente
                  const productId = existingProduct._id;
                  
                  // Aggiorna prezzi
                  let prices = existingProduct.prices || [];
                  const priceIndex = prices.findIndex(p => p.store === source);
                  
                  if (priceIndex >= 0) {
                    prices[priceIndex] = {
                      ...prices[priceIndex],
                      price: parseFloat(price),
                      url,
                      lastUpdated: new Date()
                    };
                  } else {
                    prices.push({
                      store: source,
                      price: parseFloat(price),
                      currency: 'EUR',
                      url,
                      lastUpdated: new Date()
                    });
                  }
                  
                  const updateData = {
                    prices,
                    updatedAt: new Date()
                  };
                  
                  // Aggiorna varianti se presenti
                  if (variants && variants.length > 0) {
                    updateData.variants = variants;
                  }
                  
                  // Aggiorna
                  await productsCollection.updateOne(
                    { _id: productId },
                    { $set: updateData }
                  );
                  stats.updatedProducts++;
                  
                  // Crea price point
                  pricePointBatch.push({
                    productId: new ObjectId(productId),
                    source,
                    price: {
                      amount: parseFloat(price),
                      currency: 'EUR'
                    },
                    recordedAt: new Date()
                  });
                  stats.newPricePoints++;
                }
              } catch (productError) {
                console.error(`Errore nel processare un prodotto: ${productError.message}`);
                stats.errors++;
              }
            }
            
            // Inserisci i price points in batch
            if (pricePointBatch.length > 0) {
              try {
                await pricePointsCollection.insertMany(pricePointBatch);
              } catch (batchError) {
                console.error(`Errore nell'inserimento batch dei price points: ${batchError.message}`);
                stats.errors++;
              }
            }
            
            console.log(`Progresso: ${i + batch.length}/${jsonData.length} prodotti`);
          }
          
          stats.processedFiles++;
          console.log(`File ${file} elaborato con successo`);
        } catch (fileError) {
          console.error(`Errore nel processare il file ${file}: ${fileError.message}`);
          stats.errors++;
        }
      }
    }
    
    console.log(`
Importazione batch completata:
- File processati: ${stats.processedFiles}
- Prodotti processati: ${stats.processedProducts}
- Nuovi prodotti: ${stats.newProducts}
- Prodotti aggiornati: ${stats.updatedProducts}
- Nuovi punti prezzo: ${stats.newPricePoints}
- Prodotti saltati: ${stats.skipped}
- Errori: ${stats.errors}
    `);
    
  } catch (error) {
    console.error(`Errore durante l'importazione batch: ${error.message}`);
    console.error(error.stack);
    throw error; // Rilancia l'errore per gestione esterna
  } finally {
    // Chiudi la connessione
    await client.close();
    console.log('Connessione al database chiusa');
  }
}

// Se eseguito direttamente
if (require.main === module) {
  batchImport()
    .then(() => {
      console.log('Importazione batch completata con successo');
      process.exit(0);
    })
    .catch((error) => {
      console.error(`Errore durante l'importazione batch: ${error.message}`);
      console.error(error.stack);
      process.exit(1);
    });
} else {
  // Esporta
  module.exports = batchImport;
} 