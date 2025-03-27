#!/usr/bin/env node

/**
 * Script di test per le funzionalità di normalizzazione dei prezzi
 * Testa l'estrazione del peso e il calcolo del prezzo unitario
 */
const priceNormalizer = require('../utils/priceNormalizer');
const logger = require('../utils/logger');

// Campioni di stringhe di peso da testare
const weightSamples = [
  '2kg',
  '400g',
  '1.5 kg',
  '1000 g',
  '12 oz',
  '2 lb',
  '1 L',
  '500ml',
  '4 x 100g',
  '3x400g',
  '2KG',
  '600G',
  'Royal Canin 15kg',
  'Crocchette per gatti 2kg',
  'Cibo umido 400g',
  'Snack 150 g',
  '3 bustine da 85g',
  '800', // senza unità
  '1,5kg', // virgola invece di punto
  'peso netto: 2kg'
];

// Campioni di prodotti per testare il riconoscimento di prodotti simili
const productSamples = [
  {
    _id: '1',
    name: 'Royal Canin Adult Medium 15kg',
    brand: 'Royal Canin',
    price: 59.99
  },
  {
    _id: '2',
    name: 'Royal Canin Adult Medium 4kg',
    brand: 'Royal Canin',
    price: 24.99
  },
  {
    _id: '3',
    name: 'Royal Canin Medium Adult 10kg',
    brand: 'Royal Canin',
    price: 49.99
  },
  {
    _id: '4',
    name: 'Hill\'s Science Plan Medium Adult 12kg',
    brand: 'Hill\'s',
    price: 54.99
  },
  {
    _id: '5',
    name: 'Royal Canin Maxi Adult 14kg',
    brand: 'Royal Canin',
    price: 58.99
  }
];

// Campioni di nomi di prodotti per testare l'estrazione di peso dal nome
const productNameSamples = [
  'Royal Canin Mini Adult 8kg',
  'Hill\'s Science Plan Adult Medium 14kg',
  'Purina ONE Adult 3 kg',
  'Eukanuba Adult Medium 3x5kg',
  'Whiskas Cibo Umido per Gatti 4x100g',
  'Gourmet Gold Patè con Manzo 24x85g',
  'Monge Natural Superpremium Adult 12kg',
  'Acana Wild Prairie Cat & Kitten 1,8kg',
  'Felix Le Ghiottonerie Multipack 80x100g',
  'Almo Nature Daily Menu Bio con Pollo e Verdure 100g'
];

/**
 * Test estrazione peso
 */
const testWeightExtraction = () => {
  logger.info('=== TEST ESTRAZIONE PESO ===');
  
  weightSamples.forEach((sample, index) => {
    const result = priceNormalizer.extractWeight(sample);
    
    logger.info(`\nSample ${index + 1}: "${sample}"`);
    if (result) {
      logger.info(`Risultato: ${result.value} ${result.unit}`);
      
      // Converti in unità standard (grammi)
      const standardUnit = priceNormalizer.convertToStandardUnit(result);
      logger.info(`Convertito in grammi: ${standardUnit}g`);
    } else {
      logger.info('Non è stato possibile estrarre il peso');
    }
  });
  
  logger.info('\nTest estrazione peso completato');
};

/**
 * Test calcolo prezzo unitario
 */
const testUnitPriceCalculation = () => {
  logger.info('\n=== TEST CALCOLO PREZZO UNITARIO ===');
  
  const testCases = [
    { price: 59.99, weight: '15kg' },
    { price: 24.99, weight: '4kg' },
    { price: 10.99, weight: '400g' },
    { price: 15.50, weight: '1000g' },
    { price: 5.99, weight: '3x85g' },
    { price: 8.99, weight: '2 lb' },
    { price: 7.99, weight: '500ml' }
  ];
  
  testCases.forEach((testCase, index) => {
    const pricePerKg = priceNormalizer.calculatePricePerKg(testCase.price, testCase.weight);
    
    logger.info(`\nTest ${index + 1}: ${testCase.price}€ per ${testCase.weight}`);
    if (pricePerKg !== null) {
      logger.info(`Prezzo per kg: ${pricePerKg.toFixed(2)} €/kg`);
    } else {
      logger.info('Non è stato possibile calcolare il prezzo unitario');
    }
  });
  
  logger.info('\nTest calcolo prezzo unitario completato');
};

/**
 * Test riconoscimento prodotti simili con dimensioni diverse
 */
const testSimilarProducts = () => {
  logger.info('\n=== TEST RICONOSCIMENTO PRODOTTI SIMILI ===');
  
  // Test tutti i possibili confronti
  for (let i = 0; i < productSamples.length; i++) {
    for (let j = i + 1; j < productSamples.length; j++) {
      const product1 = productSamples[i];
      const product2 = productSamples[j];
      
      const areSimilar = priceNormalizer.areSameProductDifferentSizes(product1, product2);
      
      logger.info(`\nConfronto ${i + 1} vs ${j + 1}:`);
      logger.info(`Prodotto 1: ${product1.name} (${product1.brand})`);
      logger.info(`Prodotto 2: ${product2.name} (${product2.brand})`);
      logger.info(`Risultato: ${areSimilar ? 'SIMILI' : 'DIVERSI'}`);
    }
  }
  
  logger.info('\nTest riconoscimento prodotti simili completato');
};

/**
 * Test estrazione peso dal nome del prodotto
 */
const testWeightExtractionFromName = () => {
  logger.info('\n=== TEST ESTRAZIONE PESO DAL NOME PRODOTTO ===');
  
  productNameSamples.forEach((name, index) => {
    // Cerca peso nel nome
    const weightMatch = name.match(/(\d+[\d.]*\s*(g|kg|ml|l|lb|oz))/i);
    const weightStr = weightMatch ? weightMatch[0] : '';
    
    // Estrai peso
    const weight = priceNormalizer.extractWeight(weightStr);
    
    logger.info(`\nProdotto ${index + 1}: "${name}"`);
    logger.info(`Peso estratto: "${weightStr}"`);
    
    if (weight) {
      logger.info(`Valore: ${weight.value} ${weight.unit}`);
      const grams = priceNormalizer.convertToStandardUnit(weight);
      logger.info(`Convertito in grammi: ${grams}g`);
    } else {
      logger.info('Non è stato possibile estrarre il peso');
    }
  });
  
  logger.info('\nTest estrazione peso dal nome prodotto completato');
};

/**
 * Test raggruppamento prodotti
 */
const testProductGrouping = () => {
  logger.info('\n=== TEST RAGGRUPPAMENTO PRODOTTI ===');
  
  // Aggiungi dettagli di peso ad alcuni prodotti
  const productsWithDetails = productSamples.map(p => {
    // Estrai peso dal nome
    const weightMatch = p.name.match(/(\d+[\d.]*\s*(g|kg|ml|l|lb|oz))/i);
    const weightStr = weightMatch ? weightMatch[0] : '';
    
    return {
      ...p,
      details: {
        weight: weightStr
      }
    };
  });
  
  // Raggruppa i prodotti
  const groupedProducts = priceNormalizer.groupProductsByBaseProduct(productsWithDetails);
  
  logger.info(`Gruppi trovati: ${groupedProducts.length}`);
  
  groupedProducts.forEach((group, index) => {
    logger.info(`\nGruppo ${index + 1}: ${group.baseProduct} (${group.brand})`);
    logger.info(`Varianti: ${group.variants.length}`);
    
    group.variants.forEach((variant, vIndex) => {
      logger.info(`  Variante ${vIndex + 1}: ${variant.name}`);
      logger.info(`    Prezzo: ${variant.price}€`);
      
      if (variant.unitPrice && variant.unitPrice.value) {
        logger.info(`    Prezzo unitario: ${variant.unitPrice.formattedValue}`);
      }
      
      logger.info(`    Peso estratto: ${variant.extractedWeight}`);
    });
    
    if (group.bestValue) {
      logger.info(`\n  Miglior valore: ${group.bestValue.name}`);
      if (group.bestValue.unitPrice.value) {
        logger.info(`    Prezzo unitario: ${group.bestValue.unitPrice.formattedValue}`);
      }
    }
    
    logger.info(`  Range prezzo: ${group.priceRange.min}€ - ${group.priceRange.max}€`);
    if (group.unitPriceRange) {
      logger.info(`  Range prezzo unitario: ${group.unitPriceRange.min.toFixed(2)} - ${group.unitPriceRange.max.toFixed(2)} €/kg`);
    }
  });
  
  logger.info('\nTest raggruppamento prodotti completato');
};

/**
 * Esegue tutti i test
 */
const runAllTests = () => {
  logger.info('=== INIZIO TEST PRICE NORMALIZER ===\n');
  
  testWeightExtraction();
  testUnitPriceCalculation();
  testSimilarProducts();
  testWeightExtractionFromName();
  testProductGrouping();
  
  logger.info('\n=== TUTTI I TEST COMPLETATI ===');
};

// Avvia i test
runAllTests(); 