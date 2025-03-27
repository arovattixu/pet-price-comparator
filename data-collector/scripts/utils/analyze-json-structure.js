require('dotenv').config();
const fs = require('fs');
const path = require('path');
const logger = require('./src/utils/logger');

/**
 * Analizza la struttura dei file JSON per determinare pattern riconoscibili
 * che possono essere utilizzati per migliorare il rilevamento della fonte
 */
async function analyzeJsonStructure() {
  const samples = [
    // Campioni Arcaplanet
    { path: './results/arcaplanet/arcaplanet_gatto_cibo-umido_2025-03-22T15-03-07.692Z.json', expectedSource: 'arcaplanet' },
    { path: './arcaplanet_products_2025-03-22T14-45-47.732Z.json', expectedSource: 'arcaplanet' },
    { path: './arcaplanet_scraper_results_2025-03-22T14-53-37.514Z.json', expectedSource: 'arcaplanet' }
    // Qui puoi aggiungere anche campioni Zooplus se disponibili
  ];

  logger.info('Analisi delle strutture JSON per migliorare il rilevamento della fonte...');
  
  for (const sample of samples) {
    try {
      logger.info(`\nAnalisi del file: ${sample.path}`);
      if (!fs.existsSync(sample.path)) {
        logger.warn(`File non trovato: ${sample.path}`);
        continue;
      }
      
      const data = JSON.parse(fs.readFileSync(sample.path, 'utf8'));
      
      if (!Array.isArray(data)) {
        logger.warn(`Il file non contiene un array di prodotti: ${sample.path}`);
        continue;
      }
      
      // Analizza il primo elemento come campione
      const firstItem = data[0];
      logger.info(`Struttura campione (primo elemento):`);
      
      // Identifica campi chiave per il rilevamento della fonte
      const keyFields = [
        'source', 'sourceId', 'node', 'slug', 'url', 'shopIdentifier',
        'metadata', 'categories', 'stockStatus', 'brand'
      ];
      
      // Mappa i campi chiave trovati
      const foundFields = keyFields.filter(field => 
        field in firstItem || 
        (firstItem.node && field in firstItem.node)
      );
      
      logger.info(`Campi chiave trovati: ${foundFields.join(', ')}`);
      
      // Caratteristiche distintive Arcaplanet
      const arcaplanetFeatures = [
        firstItem.source === 'arcaplanet',
        firstItem.node !== undefined,
        firstItem.metadata?.vtexId !== undefined,
        firstItem.url?.includes('arcaplanet.it'),
        firstItem.slug?.includes('arcaplanet'),
        firstItem.categories !== undefined
      ].filter(Boolean);
      
      // Punteggio di confidenza Arcaplanet
      const arcaplanetScore = arcaplanetFeatures.length;
      
      logger.info(`Punteggio rilevamento Arcaplanet: ${arcaplanetScore}/6`);
      logger.info(`Fonte attesa: ${sample.expectedSource}`);
      logger.info(`Fonte rilevata: ${arcaplanetScore >= 2 ? 'arcaplanet' : 'zooplus'}`);
      
      // Analisi dei prodotti nel file
      const totalProducts = data.length;
      
      // Campi utili per mappatura
      if (firstItem.node) {
        logger.info('Formato: Annidato con node (struttura originale Arcaplanet)');
      } else if (firstItem.source === 'arcaplanet') {
        logger.info('Formato: Piatto con campo source esplicito (formato scraper Arcaplanet)');
      } else {
        logger.info('Formato: Non riconosciuto o Zooplus');
      }
      
      logger.info(`Totale prodotti nel file: ${totalProducts}`);
    } catch (error) {
      logger.error(`Errore durante l'analisi del file ${sample.path}:`);
      logger.error(error.message);
    }
  }
  
  logger.info('\nAnalisi completata. Utilizzare queste informazioni per migliorare la funzione determineSourceFromData()');
}

analyzeJsonStructure().catch(console.error); 