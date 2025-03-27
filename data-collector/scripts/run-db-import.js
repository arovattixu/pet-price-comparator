#!/usr/bin/env node
/**
 * Script per eseguire l'importazione dei dati nel database
 * Può essere configurato come cron job
 */

require('dotenv').config();
const logger = require('../src/utils/logger');
const updatePriceData = require('./importers/import-prices-to-db');

logger.info('Avvio importazione dati nel database...');

updatePriceData()
  .then(() => {
    logger.info('Importazione dati completata con successo');
    process.exit(0);
  })
  .catch(error => {
    logger.error(`Errore durante l'importazione dei dati: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }); 