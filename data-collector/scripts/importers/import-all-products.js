/**
 * Script per importare tutti i file JSON dalla cartella results
 * Utilizza import-products-from-json-improved.js per ogni file
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const logger = require('../../src/utils/logger');

// Configurazione
const resultsDir = path.resolve(__dirname, '../../results');
const options = process.argv.slice(2).join(' '); // Passa eventuali opzioni come --dry-run, ecc.

/**
 * Funzione principale che coordina l'importazione di tutti i file
 */
async function importAllProducts() {
  try {
    logger.info('=== IMPORTAZIONE DI TUTTI I PRODOTTI ===');
    
    // Trova tutte le sottocartelle in results (es. arcaplanet, zooplus, ecc.)
    const sourceFolders = fs.readdirSync(resultsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    logger.info(`Trovate ${sourceFolders.length} fonti di dati: ${sourceFolders.join(', ')}`);
    
    let totalFiles = 0;
    let processedFiles = 0;
    let failedFiles = 0;
    
    // Per ogni fonte, processa i file JSON
    for (const sourceFolder of sourceFolders) {
      const sourcePath = path.join(resultsDir, sourceFolder);
      
      // Trova tutti i file JSON nella cartella
      const jsonFiles = fs.readdirSync(sourcePath)
        .filter(file => file.endsWith('.json'))
        .map(file => path.join(sourcePath, file));
      
      logger.info(`Trovati ${jsonFiles.length} file JSON in ${sourceFolder}`);
      totalFiles += jsonFiles.length;
      
      // Processa ogni file in sequenza
      for (const jsonFile of jsonFiles) {
        try {
          logger.info(`Processing file [${processedFiles + 1}/${totalFiles}]: ${jsonFile}`);
          
          // Determina la fonte dai metadati
          const source = sourceFolder === 'arcaplanet' ? 'arcaplanet' : 
                         sourceFolder === 'zooplus' ? 'zooplus' : null;
          
          // Prepara il comando per eseguire lo script di importazione
          const scriptPath = path.resolve(__dirname, 'import-products-from-json-improved.js');
          const command = `node "${scriptPath}" "${jsonFile}" ${options}${source ? ` --force-source=${source}` : ''}`;
          
          logger.info(`Esecuzione comando: ${command}`);
          
          // Esegui il comando e attendi il completamento
          const { stdout, stderr } = await execPromise(command);
          
          if (stderr) {
            logger.warn(`Output stderr: ${stderr}`);
          }
          
          if (stdout) {
            logger.info(`Output importazione: ${stdout.split('\n').length} linee`);
          }
          
          processedFiles++;
          logger.info(`File elaborato con successo: ${jsonFile}`);
          logger.info(`Progresso: ${processedFiles}/${totalFiles}`);
          
        } catch (error) {
          failedFiles++;
          logger.error(`Errore durante l'importazione del file ${jsonFile}:`);
          logger.error(error.message);
          // Continua con il prossimo file
        }
      }
    }
    
    logger.info('=== RIEPILOGO IMPORTAZIONE ===');
    logger.info(`Totale file: ${totalFiles}`);
    logger.info(`File elaborati con successo: ${processedFiles}`);
    logger.info(`File falliti: ${failedFiles}`);
    
  } catch (error) {
    logger.error('Errore durante l\'importazione dei prodotti:');
    logger.error(error.message);
    process.exit(1);
  }
}

// Avvia l'importazione
importAllProducts()
  .then(() => {
    logger.info('Importazione di tutti i prodotti completata');
    process.exit(0);
  })
  .catch(error => {
    logger.error(`Errore generale: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }); 