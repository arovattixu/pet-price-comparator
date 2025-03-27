#!/usr/bin/env node

/**
 * Script di popolazione dei gruppi di prodotti
 * Analizza i prodotti esistenti e li raggruppa per nome base, estraendo le informazioni su dimensioni/peso
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const ProductGroup = require('../models/ProductGroup');
const priceNormalizer = require('../utils/priceNormalizer');
const logger = require('../utils/logger');

// Configurazione MongoDB
const connectToDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    logger.info('Connesso a MongoDB');
  } catch (error) {
    logger.error(`Errore di connessione a MongoDB: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Estrai il nome base rimuovendo le informazioni sul peso
 * @param {string} name - Nome completo del prodotto
 * @returns {string} - Nome base senza informazioni di peso/dimensione
 */
const extractBaseName = (name) => {
  // Rimuovi informazioni su peso/dimensione
  return name.replace(/\d+[\d.]*\s*(g|kg|ml|l|lb|oz)(\s|$)/gi, ' ').trim();
};

/**
 * Raggruppa prodotti per nome base
 * @param {Array} products - Array di prodotti
 * @returns {Object} - Prodotti raggruppati per nome base
 */
const groupProductsByBaseName = (products) => {
  const groups = {};
  
  products.forEach(product => {
    if (!product.brand) return; // Salta prodotti senza marca
    
    const baseNameWithoutSize = extractBaseName(product.name);
    const key = `${product.brand}___${baseNameWithoutSize}`.toLowerCase();
    
    if (!groups[key]) {
      groups[key] = {
        baseName: baseNameWithoutSize,
        brand: product.brand,
        products: []
      };
    }
    
    groups[key].products.push(product);
  });
  
  return groups;
};

/**
 * Crea o aggiorna gruppi di prodotti
 * @param {Object} groupedProducts - Prodotti raggruppati per nome base
 */
const createOrUpdateProductGroups = async (groupedProducts) => {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  
  for (const [key, group] of Object.entries(groupedProducts)) {
    try {
      // Salta gruppi con un solo prodotto
      if (group.products.length < 2) {
        skipped++;
        continue;
      }
      
      // Estrai informazioni sui prodotti
      const productVariants = group.products.map(product => {
        // Estrai informazioni sul peso
        let weightStr = product.details?.weight || '';
        if (!weightStr) {
          const weightMatch = product.name.match(/(\d+[\d.]*\s*(g|kg|ml|l|lb|oz))/i);
          if (weightMatch) weightStr = weightMatch[0];
        }
        
        const weightObj = priceNormalizer.extractWeight(weightStr);
        const pricePerKg = priceNormalizer.calculatePricePerKg(product.price, weightStr);
        
        return {
          productId: product._id,
          size: weightStr,
          weight: weightObj ? {
            value: weightObj.value,
            unit: weightObj.unit
          } : null,
          price: product.price,
          unitPrice: pricePerKg ? {
            value: pricePerKg,
            unit: 'EUR/kg'
          } : null
        };
      });
      
      // Filtra prodotti con unitPrice valido
      const validVariants = productVariants.filter(v => v.unitPrice && v.unitPrice.value);
      
      // Salta il gruppo se non ci sono abbastanza varianti con prezzi unitari validi
      if (validVariants.length < 2) {
        skipped++;
        continue;
      }
      
      // Ordina varianti per prezzo unitario
      const sortedVariants = [...validVariants].sort((a, b) => a.unitPrice.value - b.unitPrice.value);
      
      // Calcola i range di prezzo
      const prices = validVariants.map(v => v.price);
      const unitPrices = validVariants.map(v => v.unitPrice.value);
      const priceRange = {
        min: Math.min(...prices),
        max: Math.max(...prices),
        unitMin: Math.min(...unitPrices),
        unitMax: Math.max(...unitPrices)
      };
      
      // Imposta il miglior valore
      const bestValue = sortedVariants[0];
      
      // Aggiungi flag bestValue alle varianti
      const variantsWithFlag = sortedVariants.map(v => ({
        ...v,
        bestValue: v.productId.toString() === bestValue.productId.toString()
      }));
      
      // Determina se il gruppo ha fonti diverse
      const sources = new Set();
      for (const product of group.products) {
        sources.add(product.source);
      }
      
      // Crea o aggiorna il gruppo
      const existingGroup = await ProductGroup.findOne({
        'baseProduct.brand': group.brand,
        'baseProduct.name': group.baseName
      });
      
      if (existingGroup) {
        // Aggiorna gruppo esistente
        existingGroup.variants = variantsWithFlag;
        existingGroup.priceRange = priceRange;
        existingGroup.bestValue = {
          productId: bestValue.productId,
          price: bestValue.price,
          unitPrice: bestValue.unitPrice.value,
          size: bestValue.size
        };
        existingGroup.hasCompleteData = true;
        existingGroup.variantCount = variantsWithFlag.length;
        existingGroup.hasDifferentSources = sources.size > 1;
        existingGroup.lastUpdated = new Date();
        
        await existingGroup.save();
        updated++;
      } else {
        // Crea nuovo gruppo
        const newGroup = new ProductGroup({
          baseProduct: {
            name: group.baseName,
            brand: group.brand,
            category: group.products[0].category,
            petType: group.products[0].petType
          },
          variants: variantsWithFlag,
          priceRange,
          bestValue: {
            productId: bestValue.productId,
            price: bestValue.price,
            unitPrice: bestValue.unitPrice.value,
            size: bestValue.size
          },
          hasCompleteData: true,
          variantCount: variantsWithFlag.length,
          hasDifferentSources: sources.size > 1
        });
        
        await newGroup.save();
        created++;
      }
      
      // Aggiorna i relativi documenti Product
      const updates = group.products.map(product => {
        return {
          updateOne: {
            filter: { _id: product._id },
            update: {
              $set: {
                'productGroup.baseProductId': group.products[0]._id,
                'productGroup.isBaseProduct': product._id.toString() === group.products[0]._id.toString()
              }
            }
          }
        };
      });
      
      if (updates.length > 0) {
        await Product.bulkWrite(updates);
      }
      
    } catch (error) {
      logger.error(`Errore nell'elaborazione del gruppo ${key}: ${error.message}`);
    }
  }
  
  return {
    created,
    updated,
    skipped
  };
};

/**
 * Funzione principale che esegue l'intero processo
 */
const main = async () => {
  try {
    await connectToDB();
    
    // Recupera tutti i prodotti
    logger.info('Recupero prodotti dal database...');
    const products = await Product.find({});
    logger.info(`Trovati ${products.length} prodotti`);
    
    // Raggruppa i prodotti per nome base
    logger.info('Raggruppamento prodotti per nome base...');
    const groupedProducts = groupProductsByBaseName(products);
    logger.info(`Identificati ${Object.keys(groupedProducts).length} gruppi potenziali`);
    
    // Crea o aggiorna i gruppi di prodotti
    logger.info('Creazione/aggiornamento gruppi di prodotti...');
    const result = await createOrUpdateProductGroups(groupedProducts);
    
    logger.info('Processo completato con successo');
    logger.info(`Gruppi creati: ${result.created}`);
    logger.info(`Gruppi aggiornati: ${result.updated}`);
    logger.info(`Gruppi saltati: ${result.skipped}`);
    
  } catch (error) {
    logger.error(`Errore nell'esecuzione del processo: ${error.message}`);
  } finally {
    logger.info('Chiusura connessione al database...');
    await mongoose.connection.close();
    process.exit(0);
  }
};

// Esegui lo script
main(); 