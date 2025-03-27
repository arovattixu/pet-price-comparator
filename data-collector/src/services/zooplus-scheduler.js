const db = require('./database');
const logger = require('../utils/logger');
const zooplusScraper = require('../scrapers/zooplus-scraper');
const { saveProducts } = require('./scheduler'); // Riutilizziamo la funzione saveProducts esistente

// Lista delle categorie di Zooplus
const zooplusCategories = [
    'cani/cibo-secco-per-cani',
    'cani/cibo-umido-per-cani',
    'gatti/cibo-umido-per-gatti',
    'gatti/cibo-secco-per-gatti',
    'gatti/lettiere-per-gatti',
    'piccoli-animali/cibo-per-roditori',
    'rettili/cibo-per-rettili'
    // Aggiungi altre categorie secondo necessità
];

/**
 * Avvia lo scraping di tutte le categorie Zooplus
 */
async function startZooplusScraping() {
    logger.info('Avvio scraping Zooplus...');
    
    for (const category of zooplusCategories) {
        try {
            logger.info(`Scraping categoria Zooplus: ${category}`);
            const products = await zooplusScraper.fetchCategoryProducts(category);
            logger.info(`Trovati ${products.length} prodotti su Zooplus per la categoria ${category}`);
            
            // Aggiungiamo informazioni sulla categoria e la fonte
            const processedProducts = products.map(product => ({
                ...product,
                source: 'zooplus',
                category: category.replace(/-/g, ' '),
            }));
            
            // Salviamo i prodotti
            await saveProducts(processedProducts);
        } catch (error) {
            logger.error(`Errore durante lo scraping di ${category} su Zooplus: ${error.message}`);
        }
    }
    
    logger.info('Scraping Zooplus completato');
}

module.exports = {
    startZooplusScraping,
    zooplusCategories
}; 