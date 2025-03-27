/**
 * Script per creare backup manuali del database
 * Esporta tutti i prodotti in un file JSON
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Product = require('../../src/models/product');
const logger = require('../../src/utils/logger');

// Opzioni da riga di comando
const args = process.argv.slice(2);
const options = {
  pretty: args.includes('--pretty'), // Formattazione JSON più leggibile
  outputDir: args.find(arg => arg.startsWith('--output='))?.split('=')[1] || '../../backups',
  collection: args.find(arg => arg.startsWith('--collection='))?.split('=')[1] || 'products'
};

/**
 * Crea un backup del database
 */
async function createBackup() {
  try {
    logger.info('Avvio backup del database...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.resolve(__dirname, options.outputDir);
    
    // Crea directory se non esiste
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const backupPath = path.join(backupDir, `${options.collection}_backup_${timestamp}.json`);
    
    // Connessione a MongoDB
    logger.info('Connessione a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    logger.info('Connessione a MongoDB stabilita');
    
    // Selezione della collezione da esportare
    let Model;
    if (options.collection === 'products') {
      Model = Product;
    } else {
      throw new Error(`Collezione non supportata: ${options.collection}`);
    }
    
    // Conteggio documenti
    const totalCount = await Model.countDocuments();
    logger.info(`Trovati ${totalCount} documenti da esportare`);
    
    if (totalCount === 0) {
      logger.warn('Nessun documento da esportare');
      return;
    }
    
    // Esportazione in batch
    const batchSize = 500;
    const batches = Math.ceil(totalCount / batchSize);
    
    const writeStream = fs.createWriteStream(backupPath, { encoding: 'utf8' });
    writeStream.write('[\n');
    
    let isFirst = true;
    let exportedCount = 0;
    
    for (let i = 0; i < batches; i++) {
      const documents = await Model.find({})
        .skip(i * batchSize)
        .limit(batchSize)
        .lean();
      
      for (const doc of documents) {
        if (!isFirst) {
          writeStream.write(',\n');
        } else {
          isFirst = false;
        }
        
        // Scrive il documento in formato JSON
        const jsonDoc = options.pretty ? 
          JSON.stringify(doc, null, 2) : 
          JSON.stringify(doc);
        
        writeStream.write(jsonDoc);
        exportedCount++;
      }
      
      // Aggiornamento progresso
      logger.info(`Backup in corso: ${Math.min((i + 1) * batchSize, totalCount)}/${totalCount} documenti (${Math.round((i + 1) * 100 / batches)}%)`);
    }
    
    writeStream.write('\n]');
    writeStream.end();
    
    // Attendi che la scrittura sia completata
    await new Promise((resolve) => {
      writeStream.on('finish', resolve);
    });
    
    const fileSizeBytes = fs.statSync(backupPath).size;
    const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2);
    
    logger.info(`Backup completato: ${exportedCount} documenti salvati in ${backupPath} (${fileSizeMB} MB)`);
    
  } catch (error) {
    logger.error(`Errore durante il backup: ${error.message}`);
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

// Avvia il backup
createBackup()
  .then(() => {
    logger.info('Script terminato con successo');
    process.exit(0);
  })
  .catch(error => {
    logger.error(`Errore generale: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }); 