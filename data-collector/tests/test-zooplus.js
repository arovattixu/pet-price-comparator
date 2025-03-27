require('dotenv').config();
const mongoose = require('mongoose');
const { scrapeZooplus } = require('./src/scrapers/zooplus');
const logger = require('./src/utils/logger');

// Funzione principale
async function main() {
  try {
    // Connessione a MongoDB
    logger.info('Connessione a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    logger.info('Connessione a MongoDB stabilita');
    
    // Configurazione opzioni scraper
    const scraperOptions = {
      enablePagination: true,       // Attiva la paginazione per recuperare più prodotti
      maxPages: 2,                  // Limita a 2 pagine per categoria (etico)
      retryAttempts: 2,             // Limita i tentativi in caso di errore
      pauseBetweenCategories: 5000, // Pausa più lunga tra categorie (5 secondi)
      pauseBetweenPages: 2000,      // Pausa tra pagine di una stessa categoria (2 secondi)
      requestDelay: 1000            // Pausa tra richieste singole (1 secondo)
    };
    
    // Esegui lo scraping direttamente senza setup del queue
    logger.info('Avvio test scraper Zooplus con chiamata API diretta');
    logger.info(`Configurazione ETICAMENTE RESPONSABILE: 
      - Paginazione: ${scraperOptions.enablePagination ? 'abilitata' : 'disabilitata'}
      - Max pagine per categoria: ${scraperOptions.maxPages}
      - Pausa tra categorie: ${scraperOptions.pauseBetweenCategories}ms
      - Pausa tra pagine: ${scraperOptions.pauseBetweenPages}ms
      - Pausa tra richieste: ${scraperOptions.requestDelay}ms
    `);
    
    // Esecuzione diretta della funzione di scraping con opzioni
    const results = await scrapeZooplus(scraperOptions);
    
    logger.info(`Test completato con successo!`);
    logger.info(`Esecuzione completata in ${results.executionTime.toFixed(2)} secondi`);
    logger.info(`Categorie processate: ${results.categoriesProcessed} (${results.categoriesSucceeded} riuscite, ${results.categoriesFailed} fallite)`);
    logger.info(`Prodotti totali trovati: ${results.totalProducts}`);
    logger.info(`Prodotti salvati: ${results.savedProducts} nuovi, ${results.updatedProducts} aggiornati`);
    logger.info(`Prodotti non salvati: ${results.skippedProducts} saltati, ${results.failedProducts} falliti`);
  } catch (error) {
    logger.error(`Errore durante il test: ${error.message}`);
    logger.error(error.stack);
  } finally {
    // Chiudi la connessione a MongoDB
    await mongoose.connection.close();
    logger.info('Connessione a MongoDB chiusa');
  }
}

// Esegui la funzione principale
main(); 