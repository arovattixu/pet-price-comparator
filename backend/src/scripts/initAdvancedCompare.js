#!/usr/bin/env node

/**
 * Script di inizializzazione per le funzionalità di confronto avanzato dei prezzi
 * - Verifica connessione al database
 * - Aggiorna i prezzi unitari di tutti i prodotti
 * - Crea i gruppi di prodotti
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const ProductGroup = require('../models/ProductGroup');
const priceNormalizer = require('../utils/priceNormalizer');
const logger = require('../utils/logger');

// Configurazione colori per la console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m'
};

/**
 * Connessione al database MongoDB
 */
const connectToDB = async () => {
  try {
    console.log(`${colors.blue}Connessione al database MongoDB...${colors.reset}`);
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log(`${colors.green}✓ Connessione al database stabilita con successo${colors.reset}`);
    return true;
  } catch (error) {
    console.error(`${colors.red}✗ Errore nella connessione al database: ${error.message}${colors.reset}`);
    return false;
  }
};

/**
 * Verifica che i modelli necessari siano registrati
 */
const verifyModels = async () => {
  try {
    console.log(`${colors.blue}Verifica dei modelli mongoose...${colors.reset}`);
    
    // Verifica Product model
    const productCount = await Product.countDocuments();
    console.log(`${colors.green}✓ Modello Product verificato, ${productCount} prodotti trovati${colors.reset}`);
    
    // Verifica ProductGroup model
    const groupCount = await ProductGroup.countDocuments();
    console.log(`${colors.green}✓ Modello ProductGroup verificato, ${groupCount} gruppi trovati${colors.reset}`);
    
    return true;
  } catch (error) {
    console.error(`${colors.red}✗ Errore nella verifica dei modelli: ${error.message}${colors.reset}`);
    return false;
  }
};

/**
 * Calcola e aggiorna i prezzi unitari per tutti i prodotti
 */
const updateUnitPrices = async () => {
  try {
    console.log(`${colors.blue}Aggiornamento prezzi unitari...${colors.reset}`);
    
    // Ottieni tutti i prodotti
    const products = await Product.find({});
    console.log(`${colors.blue}Trovati ${products.length} prodotti da elaborare${colors.reset}`);
    
    let updated = 0;
    let failed = 0;
    
    // Batch processing
    const batchSize = 100;
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      
      console.log(`${colors.blue}Elaborazione batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(products.length/batchSize)}${colors.reset}`);
      
      const updates = batch.map(product => {
        try {
          // Ottieni il peso dal prodotto
          let weightStr = product.details?.weight || '';
          
          // Se non c'è nel campo details, prova a estrarlo dal nome
          if (!weightStr) {
            // Espressione regolare migliorata per identificare il peso nel nome
            const regexPatterns = [
              /(\d+[\d.,]*)\s*(kg|g|gr|gramm[io]|kilo|kilos)/i,        // Formato standard (15kg, 400g)
              /(\d+)x(\d+[\d.,]*)\s*(kg|g|gr|gramm[io]|kilo|kilos)/i,  // Formato multiplo (3x100g)
              /(\d+[\d.,]*)\s*(kg|g|gr|gramm[io]|kilo|kilos)\b/i,      // Con spazio e confine parola
              /(\d+[\d.,]*)(kg|g|gr)\b/i,                              // Senza spazio ma con confine
              /\b(\d+[\d.,]*)\s*(kg|g|gr)\b/i,                         // Con confini parola su entrambi i lati
              /(\d+[\d.,]*)\s*([kK][gG]|[gG])\b/i                      // Maiuscole e minuscole mischiate
            ];
            
            for (const regex of regexPatterns) {
              const match = product.name.match(regex);
              if (match) {
                // Normalizza il formato del peso
                let value = match[1].replace(',', '.');
                let unit = match[2].toLowerCase();
                
                // Normalizza l'unità
                if (unit === 'gr' || unit === 'grammi' || unit === 'grammo') unit = 'g';
                if (unit === 'kilo' || unit === 'kilos') unit = 'kg';
                
                weightStr = `${value}${unit}`;
                break;
              }
            }
            
            // Se c'è un formato con moltiplicatore (3x100g)
            const multiMatch = product.name.match(/(\d+)x(\d+[\d.,]*)\s*(kg|g|gr|gramm[io]|kilo|kilos)/i);
            if (multiMatch) {
              const multiplier = parseInt(multiMatch[1]);
              let value = parseFloat(multiMatch[2].replace(',', '.'));
              const unit = multiMatch[3].toLowerCase() === 'kg' ? 'kg' : 'g';
              
              // Calcola il peso totale
              value = multiplier * value;
              weightStr = `${value}${unit}`;
            }
          }
          
          // Se ancora non c'è peso, prova a vedere se ci sono numeri che potrebbero essere pesi
          if (!weightStr) {
            // Cerca numeri che potrebbero essere pesi
            const numberMatches = product.name.match(/\b(\d+[\d.,]*)\b/g);
            if (numberMatches && numberMatches.length > 0) {
              // Cerca numeri che potrebbero essere pesi realistici (tra 50g e 25kg)
              for (const match of numberMatches) {
                const num = parseFloat(match.replace(',', '.'));
                if (num >= 0.05 && num <= 25) {
                  // Assume kg se il numero è piccolo, g se è grande
                  const unit = num < 5 ? 'kg' : 'g';
                  weightStr = `${num}${unit}`;
                  break;
                }
              }
            }
          }
          
          // Se ancora non c'è peso, salta
          if (!weightStr) {
            failed++;
            return null;
          }
          
          // Log for debugging
          console.log(`${colors.yellow}Estratto peso ${weightStr} da "${product.name}"${colors.reset}`);
          
          // Calcola il prezzo unitario
          const weightObj = priceNormalizer.extractWeight(weightStr);
          if (!weightObj) {
            failed++;
            return null;
          }
          
          const pricePerKg = priceNormalizer.calculatePricePerKg(product.price, weightStr);
          if (!pricePerKg) {
            failed++;
            return null;
          }
          
          // Update the product
          return {
            updateOne: {
              filter: { _id: product._id },
              update: {
                $set: {
                  unitPrice: {
                    value: pricePerKg,
                    unit: 'EUR/kg',
                    calculatedAt: new Date()
                  },
                  packageInfo: {
                    weight: {
                      value: weightObj.value,
                      unit: weightObj.unit,
                      original: weightStr
                    }
                  }
                }
              }
            }
          };
        } catch (error) {
          console.error(`${colors.red}Errore per prodotto ${product.name}: ${error.message}${colors.reset}`);
          failed++;
          return null;
        }
      }).filter(Boolean);
      
      if (updates.length > 0) {
        const result = await Product.bulkWrite(updates);
        updated += result.modifiedCount;
        console.log(`${colors.green}Aggiornati ${result.modifiedCount} prodotti nel batch${colors.reset}`);
      }
    }
    
    console.log(`${colors.green}✓ Aggiornamento prezzi unitari completato: ${updated} prodotti aggiornati, ${failed} falliti${colors.reset}`);
    return { updated, failed };
  } catch (error) {
    console.error(`${colors.red}✗ Errore nell'aggiornamento dei prezzi unitari: ${error.message}${colors.reset}`);
    return null;
  }
};

/**
 * Crea i gruppi di prodotti
 */
const createProductGroups = async () => {
  try {
    console.log(`${colors.blue}Creazione gruppi di prodotti...${colors.reset}`);
    
    // Ottieni tutti i prodotti
    const products = await Product.find({});
    
    // Prepare product groups
    let created = 0;
    let updated = 0;
    let skipped = 0;
    
    // Group products by base name and brand
    const groups = {};
    
    // First pass - group products
    products.forEach(product => {
      if (!product.brand) return; // Skip products without brand
      
      // Clean name by removing weight mentions
      const cleanName = product.name.replace(/\d+\s*(g|kg|ml|l|lb|oz)(\s|$)/gi, ' ').trim();
      const key = `${product.brand}___${cleanName}`.toLowerCase();
      
      if (!groups[key]) {
        groups[key] = {
          baseProduct: {
            name: cleanName,
            brand: product.brand,
            category: product.category,
            petType: product.petType
          },
          variants: []
        };
      }
      
      // Add to variants if has unitPrice
      if (product.unitPrice && product.unitPrice.value) {
        groups[key].variants.push({
          productId: product._id,
          size: product.packageInfo?.weight?.original || '',
          weight: product.packageInfo?.weight || {},
          price: product.price,
          unitPrice: product.unitPrice,
          bestValue: false // Will be set later
        });
      }
    });
    
    console.log(`${colors.blue}Creati ${Object.keys(groups).length} gruppi potenziali${colors.reset}`);
    
    // Process groups
    for (const [key, group] of Object.entries(groups)) {
      try {
        // Skip groups with less than 2 variants
        if (group.variants.length < 2) {
          skipped++;
          continue;
        }
        
        // Sort variants by unit price
        group.variants.sort((a, b) => a.unitPrice.value - b.unitPrice.value);
        
        // Set best value flag
        if (group.variants.length > 0) {
          group.variants[0].bestValue = true;
        }
        
        // Calculate price ranges
        const prices = group.variants.map(v => v.price);
        const unitPrices = group.variants.map(v => v.unitPrice.value);
        
        const priceRange = {
          min: Math.min(...prices),
          max: Math.max(...prices),
          unitMin: Math.min(...unitPrices),
          unitMax: Math.max(...unitPrices)
        };
        
        const bestValue = {
          productId: group.variants[0].productId,
          price: group.variants[0].price,
          unitPrice: group.variants[0].unitPrice.value,
          size: group.variants[0].size
        };
        
        // Check if group exists
        const existingGroup = await ProductGroup.findOne({
          'baseProduct.brand': group.baseProduct.brand,
          'baseProduct.name': group.baseProduct.name
        });
        
        if (existingGroup) {
          // Update existing group
          existingGroup.variants = group.variants;
          existingGroup.priceRange = priceRange;
          existingGroup.bestValue = bestValue;
          existingGroup.variantCount = group.variants.length;
          existingGroup.hasCompleteData = true;
          existingGroup.lastUpdated = new Date();
          
          await existingGroup.save();
          updated++;
        } else {
          // Create new group
          const productGroup = new ProductGroup({
            baseProduct: group.baseProduct,
            variants: group.variants,
            priceRange,
            bestValue,
            variantCount: group.variants.length,
            hasCompleteData: true,
            lastUpdated: new Date()
          });
          
          await productGroup.save();
          created++;
        }
        
        // Update product references
        const variants = group.variants.map(v => v.productId);
        await Product.updateMany(
          { _id: { $in: variants } },
          { 
            $set: { 
              'productGroup.baseProductId': group.variants[0].productId,
              'productGroup.isBaseProduct': false
            } 
          }
        );
        
        // Set first product as base product
        await Product.updateOne(
          { _id: group.variants[0].productId },
          { $set: { 'productGroup.isBaseProduct': true } }
        );
        
      } catch (error) {
        console.error(`${colors.red}Errore nell'elaborazione del gruppo ${key}: ${error.message}${colors.reset}`);
      }
    }
    
    console.log(`${colors.green}✓ Creazione gruppi di prodotti completata: ${created} creati, ${updated} aggiornati, ${skipped} saltati${colors.reset}`);
    return { created, updated, skipped };
  } catch (error) {
    console.error(`${colors.red}✗ Errore nella creazione dei gruppi di prodotti: ${error.message}${colors.reset}`);
    return null;
  }
};

/**
 * Funzione principale che esegue l'intera inizializzazione
 */
const main = async () => {
  console.log(`${colors.bright}${colors.blue}=== INIZIALIZZAZIONE SISTEMA DI CONFRONTO AVANZATO DEI PREZZI ===${colors.reset}\n`);
  
  // Connessione al database
  if (!await connectToDB()) {
    console.error(`${colors.red}✗ Impossibile procedere senza connessione al database${colors.reset}`);
    process.exit(1);
  }
  
  // Verifica modelli
  if (!await verifyModels()) {
    console.error(`${colors.red}✗ Impossibile procedere senza modelli corretti${colors.reset}`);
    process.exit(1);
  }
  
  // Aggiorna prezzi unitari
  const priceResults = await updateUnitPrices();
  if (!priceResults) {
    console.error(`${colors.red}✗ Aggiornamento prezzi unitari fallito${colors.reset}`);
    process.exit(1);
  }
  
  // Crea gruppi di prodotti
  const groupResults = await createProductGroups();
  if (!groupResults) {
    console.error(`${colors.red}✗ Creazione gruppi di prodotti fallita${colors.reset}`);
    process.exit(1);
  }
  
  console.log(`\n${colors.bright}${colors.green}=== INIZIALIZZAZIONE COMPLETATA CON SUCCESSO ===${colors.reset}`);
  console.log(`${colors.green}Prezzi unitari: ${priceResults.updated} aggiornati, ${priceResults.failed} falliti${colors.reset}`);
  console.log(`${colors.green}Gruppi di prodotti: ${groupResults.created} creati, ${groupResults.updated} aggiornati, ${groupResults.skipped} saltati${colors.reset}`);
  
  // Chiudi la connessione al database
  await mongoose.connection.close();
  console.log(`${colors.blue}Connessione al database chiusa${colors.reset}`);
};

// Esegui lo script
main().catch(error => {
  console.error(`${colors.red}Errore imprevisto: ${error.message}${colors.reset}`);
  process.exit(1);
}); 