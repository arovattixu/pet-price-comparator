const fs = require('fs');
const path = require('path');
const logger = require('./src/utils/logger');

/**
 * Script per verificare la compatibilità dei dati con lo schema del database
 * Analizza tutti i file JSON di Arcaplanet e produce un rapporto completo
 */

// Schema vitale come da modello nel database
const vitalFields = {
  // Schema obbligatorio nel database
  required: ['name', 'source', 'sourceId'],
  
  // Schema importante ma non obbligatorio
  important: ['description', 'brand', 'category', 'imageUrl', 'prices'],
  
  // Schema prezzi
  prices: ['store', 'price', 'currency', 'url', 'inStock']
};

/**
 * Funzione principale
 */
async function checkDataCompatibility() {
  logger.info('Inizio verifica compatibilità dati con database');
  
  // Trova tutti i file JSON nel percorso dei risultati
  const resultsDir = path.join(__dirname, 'results', 'arcaplanet');
  
  if (!fs.existsSync(resultsDir)) {
    logger.error(`Directory non trovata: ${resultsDir}`);
    return;
  }
  
  // Ottieni l'elenco dei file JSON
  const files = fs.readdirSync(resultsDir)
    .filter(file => file.endsWith('-products.json'));
  
  logger.info(`Trovati ${files.length} file JSON da analizzare`);
  
  // Statistiche complessive
  const overallStats = {
    totalFiles: files.length,
    filesWithErrors: 0,
    filesWithWarnings: 0,
    totalProducts: 0,
    productsWithErrors: 0,
    productsWithWarnings: 0,
    missingFields: {},
    categoryStats: {}
  };
  
  // Reset statistiche campi mancanti
  vitalFields.required.forEach(field => {
    overallStats.missingFields[field] = 0;
  });
  
  vitalFields.important.forEach(field => {
    overallStats.missingFields[field] = 0;
  });
  
  // Analizza ogni file
  const fileReports = [];
  
  for (const file of files) {
    const filePath = path.join(resultsDir, file);
    logger.info(`Analisi file: ${file}`);
    
    try {
      const fileReport = await analyzeFile(filePath);
      fileReports.push({
        file,
        ...fileReport
      });
      
      // Aggiorna statistiche complessive
      overallStats.totalProducts += fileReport.stats.totalProducts;
      
      if (fileReport.hasErrors) {
        overallStats.filesWithErrors++;
        overallStats.productsWithErrors += fileReport.stats.productsWithErrors;
      }
      
      if (fileReport.hasWarnings) {
        overallStats.filesWithWarnings++;
        overallStats.productsWithWarnings += fileReport.stats.productsWithWarnings;
      }
      
      // Aggiorna statistiche campi mancanti
      Object.keys(fileReport.stats.missingFields).forEach(field => {
        if (!overallStats.missingFields[field]) {
          overallStats.missingFields[field] = 0;
        }
        overallStats.missingFields[field] += fileReport.stats.missingFields[field];
      });
      
      // Aggiungi statistiche categorie
      if (fileReport.stats.category) {
        const category = fileReport.stats.category;
        if (!overallStats.categoryStats[category]) {
          overallStats.categoryStats[category] = {
            totalProducts: 0,
            productsWithErrors: 0
          };
        }
        overallStats.categoryStats[category].totalProducts += fileReport.stats.totalProducts;
        overallStats.categoryStats[category].productsWithErrors += fileReport.stats.productsWithErrors;
      }
      
    } catch (error) {
      logger.error(`Errore nell'analisi del file ${file}: ${error.message}`);
      overallStats.filesWithErrors++;
    }
  }
  
  // Genera rapporto completo
  generateReport(overallStats, fileReports);
}

/**
 * Analizza un singolo file JSON
 */
async function analyzeFile(filePath) {
  try {
    // Leggi il file JSON
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (!Array.isArray(data)) {
      return {
        hasErrors: true,
        stats: {
          totalProducts: 0,
          productsWithErrors: 0,
          productsWithWarnings: 0,
          missingFields: {}
        },
        errors: ['Il file non contiene un array di prodotti']
      };
    }
    
    // Statistiche del file
    const stats = {
      totalProducts: data.length,
      productsWithErrors: 0,
      productsWithWarnings: 0,
      missingFields: {},
      category: extractCategoryFromFilename(filePath)
    };
    
    // Reset statistiche campi mancanti
    vitalFields.required.forEach(field => {
      stats.missingFields[field] = 0;
    });
    
    vitalFields.important.forEach(field => {
      stats.missingFields[field] = 0;
    });
    
    // Analizza ogni prodotto
    const productsWithIssues = [];
    
    for (const product of data) {
      const issues = {
        errors: [],
        warnings: []
      };
      
      // Verifica campi obbligatori
      vitalFields.required.forEach(field => {
        let exists = false;
        
        // Gestisci mapping speciali
        if (field === 'name' && product.title) {
          exists = true;
        } else if (field === 'source') {
          exists = true; // Arcaplanet (determinato dal percorso)
        } else if (field === 'sourceId' && (product.id || product.sku)) {
          exists = true;
        } else if (field === 'prices') {
          exists = product.price !== undefined;
        } else {
          exists = product[field] !== undefined;
        }
        
        if (!exists) {
          issues.errors.push(`Campo obbligatorio mancante: ${field}`);
          stats.missingFields[field] = (stats.missingFields[field] || 0) + 1;
        }
      });
      
      // Verifica campi importanti
      vitalFields.important.forEach(field => {
        let exists = false;
        
        // Gestisci mapping speciali
        if (field === 'description') {
          exists = true; // Non sempre disponibile, non critico
        } else if (field === 'imageUrl' && product.images && product.images.length > 0) {
          exists = true;
        } else if (field === 'prices') {
          exists = product.price !== undefined;
        } else {
          exists = product[field] !== undefined;
        }
        
        if (!exists) {
          issues.warnings.push(`Campo importante mancante: ${field}`);
          stats.missingFields[field] = (stats.missingFields[field] || 0) + 1;
        }
      });
      
      // Verifica formato prezzo
      if (product.price === undefined) {
        issues.errors.push('Prezzo mancante');
      } else if (typeof product.price !== 'number' && 
                (typeof product.price !== 'object' || !product.price.current)) {
        issues.warnings.push('Formato prezzo non standard');
      }
      
      // Aggiorna contatori
      if (issues.errors.length > 0) {
        stats.productsWithErrors++;
      }
      
      if (issues.warnings.length > 0) {
        stats.productsWithWarnings++;
      }
      
      if (issues.errors.length > 0 || issues.warnings.length > 0) {
        productsWithIssues.push({
          id: product.id || product.sku,
          title: product.title,
          issues
        });
      }
    }
    
    return {
      hasErrors: stats.productsWithErrors > 0,
      hasWarnings: stats.productsWithWarnings > 0,
      stats,
      productsWithIssues: productsWithIssues.slice(0, 10) // Limita a 10 esempi
    };
    
  } catch (error) {
    logger.error(`Errore durante l'analisi del file: ${error.message}`);
    return {
      hasErrors: true,
      stats: {
        totalProducts: 0,
        productsWithErrors: 0,
        productsWithWarnings: 0,
        missingFields: {}
      },
      errors: [`Errore durante l'analisi: ${error.message}`]
    };
  }
}

/**
 * Estrae la categoria dal nome del file
 */
function extractCategoryFromFilename(filePath) {
  const filename = path.basename(filePath);
  const match = filename.match(/(.+)-products\.json/);
  return match ? match[1] : null;
}

/**
 * Genera un rapporto completo
 */
function generateReport(overallStats, fileReports) {
  // Crea il rapporto completo
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalFiles: overallStats.totalFiles,
      filesWithErrors: overallStats.filesWithErrors,
      filesWithWarnings: overallStats.filesWithWarnings,
      totalProducts: overallStats.totalProducts,
      productsWithErrors: overallStats.productsWithErrors,
      productsWithWarnings: overallStats.productsWithWarnings,
      errorRate: overallStats.totalProducts > 0 
        ? (overallStats.productsWithErrors / overallStats.totalProducts * 100).toFixed(2) + '%' 
        : '0%',
      warningRate: overallStats.totalProducts > 0 
        ? (overallStats.productsWithWarnings / overallStats.totalProducts * 100).toFixed(2) + '%' 
        : '0%'
    },
    missingFields: overallStats.missingFields,
    categoryStats: overallStats.categoryStats,
    fileReports: fileReports.map(report => ({
      file: report.file,
      totalProducts: report.stats.totalProducts,
      productsWithErrors: report.stats.productsWithErrors,
      productsWithWarnings: report.stats.productsWithWarnings,
      category: report.stats.category,
      hasErrors: report.hasErrors,
      hasWarnings: report.hasWarnings,
      exampleIssues: report.productsWithIssues || []
    }))
  };
  
  // Salva il rapporto come JSON
  const reportPath = path.join(__dirname, 'data-compatibility-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  // Log delle statistiche principali
  logger.info('===============================================');
  logger.info('RAPPORTO COMPATIBILITÀ DATI');
  logger.info('===============================================');
  logger.info(`File totali analizzati: ${report.summary.totalFiles}`);
  logger.info(`File con errori: ${report.summary.filesWithErrors}`);
  logger.info(`File con avvertimenti: ${report.summary.filesWithWarnings}`);
  logger.info(`Prodotti totali: ${report.summary.totalProducts}`);
  logger.info(`Prodotti con errori: ${report.summary.productsWithErrors} (${report.summary.errorRate})`);
  logger.info(`Prodotti con avvertimenti: ${report.summary.productsWithWarnings} (${report.summary.warningRate})`);
  
  logger.info('Campi mancanti:');
  Object.keys(report.missingFields).forEach(field => {
    if (report.missingFields[field] > 0) {
      const rate = ((report.missingFields[field] / report.summary.totalProducts) * 100).toFixed(2);
      logger.info(`- ${field}: ${report.missingFields[field]} (${rate}%)`);
    }
  });
  
  logger.info('===============================================');
  logger.info(`Rapporto salvato in: ${reportPath}`);
}

// Esecuzione dello script
checkDataCompatibility().catch(err => {
  logger.error(`Errore nell'esecuzione: ${err.message}`);
  process.exit(1);
}); 