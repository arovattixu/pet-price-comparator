const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const logger = require('./src/utils/logger');

/**
 * Script per importare tutti i file JSON nel database
 * Esegue lo script di importazione per ogni file JSON nella directory results/{source}
 */
async function importAllJsonFiles(source = 'arcaplanet') {
  logger.info(`Inizio importazione di tutti i file JSON ${source} nel database`);
  
  // Trova tutti i file JSON nel percorso dei risultati
  const resultsDir = path.join(__dirname, 'results', source);
  
  if (!fs.existsSync(resultsDir)) {
    logger.error(`Directory non trovata: ${resultsDir}`);
    return;
  }
  
  // Ottieni l'elenco dei file JSON
  const files = fs.readdirSync(resultsDir)
    .filter(file => file.endsWith('-products.json'));
  
  logger.info(`Trovati ${files.length} file JSON da importare`);
  
  // Statistiche
  const stats = {
    totalFiles: files.length,
    successfulImports: 0,
    failedImports: 0,
    inProgress: 0,
    completed: 0
  };
  
  // Definisci opzioni di importazione
  const importOptions = [
    `--force-source=${source}`,  // Forza la fonte specificata
    '--ignore-errors'           // Ignora gli errori non critici
  ];
  
  // Importa i file in sequenza (per evitare sovraccarichi)
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(resultsDir, file);
    stats.inProgress++;
    
    logger.info(`Importazione file ${i+1}/${files.length}: ${file}`);
    
    try {
      // Esegui lo script di importazione
      await executeImport(filePath, importOptions);
      
      stats.successfulImports++;
      logger.info(`Importazione di ${file} completata con successo`);
    } catch (error) {
      stats.failedImports++;
      logger.error(`Errore durante l'importazione di ${file}: ${error.message}`);
    }
    
    stats.inProgress--;
    stats.completed++;
    
    // Log progressi ogni 10 file o all'ultimo file
    if (stats.completed % 10 === 0 || stats.completed === stats.totalFiles) {
      logProgress(stats);
    }
  }
  
  // Log finale
  logger.info('===============================================');
  logger.info('RIEPILOGO IMPORTAZIONE');
  logger.info('===============================================');
  logger.info(`File totali: ${stats.totalFiles}`);
  logger.info(`Importazioni riuscite: ${stats.successfulImports}`);
  logger.info(`Importazioni fallite: ${stats.failedImports}`);
  logger.info('===============================================');
}

/**
 * Esegue lo script di importazione per un singolo file
 */
function executeImport(filePath, options = []) {
  return new Promise((resolve, reject) => {
    const args = [filePath, ...options];
    
    // Comando di importazione
    const importScript = path.join(__dirname, 'scripts', 'importers', 'import-products-from-json-improved.js');
    
    // Esegui il processo
    const process = spawn('node', [importScript, ...args], {
      stdio: 'inherit' // Mostra output in console principale
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Processo terminato con codice di errore: ${code}`));
      }
    });
    
    process.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Log dei progressi di importazione
 */
function logProgress(stats) {
  const progressPct = ((stats.completed / stats.totalFiles) * 100).toFixed(2);
  logger.info('--------------------------------------------------');
  logger.info(`Progresso importazione: ${progressPct}% (${stats.completed}/${stats.totalFiles})`);
  logger.info(`Riuscite: ${stats.successfulImports}, Fallite: ${stats.failedImports}, In corso: ${stats.inProgress}`);
  logger.info('--------------------------------------------------');
}

// Esecuzione dello script
const source = process.argv[2] || 'arcaplanet';
if (source !== 'arcaplanet' && source !== 'zooplus') {
  logger.error('Fonte non valida. Utilizzare "arcaplanet" o "zooplus"');
  process.exit(1);
}

logger.info(`Avvio importazione per la fonte: ${source}`);
importAllJsonFiles(source).catch(err => {
  logger.error(`Errore nell'esecuzione: ${err.message}`);
  process.exit(1);
}); 