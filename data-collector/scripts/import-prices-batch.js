#!/usr/bin/env node

/**
 * Script per l'importazione batch dei dati raccolti
 */

require('dotenv').config();
const path = require('path');
const batchImport = require('./importers/batch-import');

console.log('=== IMPORTAZIONE BATCH DEI PRODOTTI AVVIATA ===');
console.log(`Data: ${new Date().toISOString()}`);
console.log('===============================================');

// Esegui l'importazione batch
batchImport()
  .then(() => {
    console.log('===============================================');
    console.log('Importazione batch completata con successo');
    process.exit(0);
  })
  .catch(error => {
    console.error('Errore durante l\'importazione batch:');
    console.error(error);
    process.exit(1);
  }); 