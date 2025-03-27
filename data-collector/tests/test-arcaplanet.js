require('dotenv').config();
const mongoose = require('mongoose');
const { scrapeArcaplanet } = require('./src/scrapers/arcaplanet');
const logger = require('./src/utils/logger');
const ArcaplanetScraper = require('./src/scrapers/arcaplanet-scraper');
const { arcaplanet } = require('./config/scraping-policies');
const axios = require('axios');
const fs = require('fs');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

async function testArcaplanetWithPuppeteer() {
  try {
    logger.info('Avvio test Arcaplanet con Puppeteer (browser headless)');
    
    // Configurazione di base
    const options = {
      debug: true,
      baseUrl: arcaplanet.baseUrl,
      testCategory: 'gatto/cibo-umido',
      timeout: 60000, // 60 secondi
      headless: true, // cambia a false per vedere il browser in azione
      saveToFile: true
    };
    
    logger.info(`Test Puppeteer:
    - URL base: ${options.baseUrl}
    - Categoria di test: ${options.testCategory}
    - Timeout: ${options.timeout}ms
    - Headless: ${options.headless ? 'attivato' : 'disattivato'}`);
    
    // Crea e configura il browser
    logger.info('Avvio del browser headless...');
    const browser = await puppeteer.launch({
      headless: options.headless ? 'new' : false,
      defaultViewport: { width: 1280, height: 800 },
      timeout: options.timeout,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      // Apri una nuova pagina
      const page = await browser.newPage();
      
      // Imposta uno user agent mobile
      await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1');
      
      // Attiva il monitoraggio delle richieste di rete
      let graphqlResponses = [];
      
      // Intercetta le risposte dell'API GraphQL
      page.on('response', async (response) => {
        const url = response.url();
        
        // Filtra solo le risposte GraphQL rilevanti
        if (url.includes('/api/graphql') && response.request().method() === 'POST') {
          try {
            const responseData = await response.json();
            const requestData = JSON.parse(response.request().postData());
            
            // Salva solo le risposte che contengono dati di prodotto
            if (requestData.operationName === 'ProductsQueryForPlp' && 
                responseData.data && 
                responseData.data.search && 
                responseData.data.search.products) {
              
              logger.info(`Intercettata risposta API GraphQL con ${responseData.data.search.products.edges?.length || 0} prodotti`);
              
              // Salva risposta e request per analisi
              graphqlResponses.push({
                request: requestData,
                response: responseData,
                url: url,
                timestamp: new Date().toISOString()
              });
            }
          } catch (e) {
            logger.debug(`Errore durante l'elaborazione della risposta: ${e.message}`);
          }
        }
      });
      
      // Configura i timeouts
      await page.setDefaultNavigationTimeout(options.timeout);
      await page.setDefaultTimeout(options.timeout);
      
      // Visita la pagina della categoria
      const categoryUrl = `${options.baseUrl}/${options.testCategory}`;
      logger.info(`Navigazione a ${categoryUrl}...`);
      
      // Vai alla pagina e attendi che sia completamente caricata
      await page.goto(categoryUrl, { waitUntil: 'networkidle2' });
      logger.info('Pagina caricata. Attendo caricamento prodotti...');
      
      // Attendi che appaiano elementi del prodotto (massimo 30 secondi)
      try {
        await page.waitForSelector('[data-testid="gallery-layout-container"]', { 
          timeout: 30000,
          visible: true 
        });
        logger.info('Prodotti caricati nella pagina');
      } catch (timeoutError) {
        logger.warn('Timeout durante attesa caricamento prodotti. Continuiamo comunque...');
      }
      
      // Attendi un po' per essere sicuri che tutte le chiamate API siano complete
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Controlla se abbiamo intercettato dati API
      if (graphqlResponses.length > 0) {
        logger.info(`Intercettate ${graphqlResponses.length} risposte GraphQL`);
        
        // Prendiamo l'ultima risposta intercettata che probabilmente è quella che contiene i dati
        const latestResponse = graphqlResponses[graphqlResponses.length - 1];
        
        // Mostra informazioni sulla query GraphQL
        const requestInfo = latestResponse.request;
        logger.info(`Query GraphQL: ${requestInfo.operationName}`);
        logger.info(`Variabili query: ${JSON.stringify(requestInfo.variables)}`);
        
        // Analizza e mostra i dati dei prodotti
        const products = latestResponse.response.data.search.products.edges || [];
        const totalCount = latestResponse.response.data.search.products.pageInfo?.totalCount || 0;
        
        logger.info(`Prodotti trovati: ${products.length} di ${totalCount} totali`);
        
        if (products.length > 0) {
          // Mostra dettagli del primo prodotto
          const firstProduct = products[0].node;
          logger.info(`Dettagli primo prodotto:`);
          logger.info(`- ID: ${firstProduct.id || 'N/A'}`);
          logger.info(`- Nome: ${firstProduct.name || 'N/A'}`);
          logger.info(`- SKU: ${firstProduct.sku || 'N/A'}`);
          logger.info(`- Slug: ${firstProduct.slug || 'N/A'}`);
          
          if (firstProduct.offers && firstProduct.offers.offers && firstProduct.offers.offers[0]) {
            const offer = firstProduct.offers.offers[0];
            logger.info(`- Prezzo: ${offer.price}`);
            logger.info(`- Prezzo listino: ${offer.listPrice}`);
            logger.info(`- Disponibilità: ${offer.availability}`);
          }
          
          if (firstProduct.brand) {
            logger.info(`- Brand: ${firstProduct.brand.name || 'N/A'}`);
          }
          
          if (firstProduct.image) {
            logger.info(`- Immagine: ${firstProduct.image.url || 'N/A'}`);
          }
          
          // Salva i dati intercettati per analisi futura
          if (options.saveToFile) {
            const timestamp = new Date().toISOString().replace(/:/g, '-');
            
            // Salva dati API completi
            const apiFilename = `./arcaplanet_api_data_${timestamp}.json`;
            fs.writeFileSync(apiFilename, JSON.stringify(latestResponse, null, 2));
            logger.info(`Dati API completi salvati in: ${apiFilename}`);
            
            // Salva solo i prodotti per uso più semplice
            const productsFilename = `./arcaplanet_products_${timestamp}.json`;
            fs.writeFileSync(productsFilename, JSON.stringify(products, null, 2));
            logger.info(`Dati prodotti salvati in: ${productsFilename}`);
          }
        }
      } else {
        logger.warn('Nessuna risposta GraphQL intercettata. Provo a estrarre i dati direttamente dal DOM...');
        
        // Estrai i prodotti dal DOM come fallback
        const productsData = await page.evaluate(() => {
          // Cerca gli elementi prodotto nella pagina
          const productElements = document.querySelectorAll('[data-testid="product-summary"]');
          
          // Estrai i dati da ciascun elemento
          return Array.from(productElements).map(element => {
            // Nome prodotto
            const nameElement = element.querySelector('[data-testid="product-summary-name"]');
            const name = nameElement ? nameElement.textContent.trim() : 'N/A';
            
            // Brand
            const brandElement = element.querySelector('[data-testid="product-summary-brand"]');
            const brand = brandElement ? brandElement.textContent.trim() : 'N/A';
            
            // Prezzo
            const priceElement = element.querySelector('[data-testid="price"]');
            const price = priceElement ? priceElement.textContent.trim() : 'N/A';
            
            // URL e immagine
            const linkElement = element.querySelector('a');
            const url = linkElement ? linkElement.href : 'N/A';
            
            const imageElement = element.querySelector('img');
            const imageUrl = imageElement ? imageElement.src : 'N/A';
            
            return { name, brand, price, url, imageUrl };
          });
        });
        
        // Log dei prodotti trovati nel DOM
        logger.info(`Trovati ${productsData.length} prodotti nel DOM`);
        
        if (productsData.length > 0) {
          // Mostra dettagli del primo prodotto
          const firstProduct = productsData[0];
          logger.info(`Dettagli primo prodotto (dal DOM):`);
          logger.info(`- Nome: ${firstProduct.name}`);
          logger.info(`- Brand: ${firstProduct.brand}`);
          logger.info(`- Prezzo: ${firstProduct.price}`);
          logger.info(`- URL: ${firstProduct.url}`);
          logger.info(`- Immagine: ${firstProduct.imageUrl}`);
          
          // Salva i dati estratti dal DOM
          if (options.saveToFile) {
            const timestamp = new Date().toISOString().replace(/:/g, '-');
            const domFilename = `./arcaplanet_dom_products_${timestamp}.json`;
            fs.writeFileSync(domFilename, JSON.stringify(productsData, null, 2));
            logger.info(`Dati prodotti DOM salvati in: ${domFilename}`);
          }
        }
      }
      
      // Screenshot della pagina per verifica
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const screenshotPath = `./arcaplanet_screenshot_${timestamp}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: false });
      logger.info(`Screenshot salvato in: ${screenshotPath}`);
      
    } finally {
      // Chiudi il browser
      await browser.close();
      logger.info('Browser chiuso');
    }
    
    logger.info('Test completato con successo');
    
  } catch (error) {
    logger.error('Test Arcaplanet con Puppeteer fallito:', error.message);
    logger.error(error.stack);
    process.exit(1);
  }
}

/**
 * Test del nuovo scraper Arcaplanet con implementazione Puppeteer
 */
async function testArcaplanetScraper() {
  try {
    logger.info('Avvio test dello scraper Arcaplanet utilizzando il nuovo motore Puppeteer');
    
    // Configura opzioni
    const options = {
      debug: true,
      baseUrl: arcaplanet.baseUrl,
      apiBaseUrl: arcaplanet.apiBaseUrl,
      graphqlEndpoint: arcaplanet.graphqlEndpoint,
      enablePagination: true,
      maxPages: 2, // Limitiamo a 2 pagine per non sovraccaricare il server
      pauseBetweenPages: 3000,
      requestDelay: 2000,
      headless: true, // true per headless, false per vedere il browser
      usePuppeteer: true,
      productsPerPage: 20,
      browserTimeout: 60000
    };
    
    logger.info(`Test scraper:
    - URL base: ${options.baseUrl}
    - Paginazione: ${options.enablePagination ? 'abilitata' : 'disabilitata'}
    - Pagine massime: ${options.maxPages}
    - Timeout browser: ${options.browserTimeout}ms
    - Prodotti per pagina: ${options.productsPerPage}
    - Modalità headless: ${options.headless ? 'attivata' : 'disattivata'}`);
    
    // Categoria di test
    const testCategory = 'gatto/cibo-umido';
    logger.info(`Categoria di test: ${testCategory}`);
    
    // Inizializza lo scraper
    const scraper = new ArcaplanetScraper(options);
    
    // Recupera i prodotti
    logger.info(`Avvio recupero prodotti per categoria ${testCategory}...`);
    const startTime = Date.now();
    
    // Recupera i prodotti usando il nuovo metodo
    const products = await scraper.fetchCategoryProducts(testCategory);
    
    const endTime = Date.now();
    const elapsedTime = (endTime - startTime) / 1000;
    
    logger.info(`Recupero completato in ${elapsedTime.toFixed(2)} secondi`);
    logger.info(`Trovati ${products.length} prodotti mappati per categoria ${testCategory}`);
    
    // Mostra dettagli del primo prodotto (se disponibile)
    if (products.length > 0) {
      const firstProduct = products[0];
      logger.info(`Dettagli primo prodotto:`);
      logger.info(`- ID: ${firstProduct.sourceId}`);
      logger.info(`- Nome: ${firstProduct.name}`);
      logger.info(`- Brand: ${firstProduct.brand}`);
      logger.info(`- Prezzo: ${firstProduct.price.current} ${firstProduct.price.currency}`);
      logger.info(`- Prezzo originale: ${firstProduct.price.original} ${firstProduct.price.currency}`);
      logger.info(`- Sconto: ${firstProduct.price.discountPercentage}%`);
      logger.info(`- URL: ${firstProduct.url}`);
      logger.info(`- Immagine: ${firstProduct.imageUrl}`);
    }
    
    // Salva i dati in un file JSON per analisi
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `./arcaplanet_scraper_results_${timestamp}.json`;
    fs.writeFileSync(filename, JSON.stringify(products, null, 2));
    logger.info(`Risultati salvati in ${filename}`);
    
    // Cleanup delle risorse
    await scraper.cleanup();
    logger.info('Test scraper completato con successo');
    
  } catch (error) {
    logger.error('Test scraper Arcaplanet fallito:', error.message);
    logger.error(error.stack);
    process.exit(1);
  }
}

// Avvia il test del nuovo scraper
testArcaplanetScraper(); 