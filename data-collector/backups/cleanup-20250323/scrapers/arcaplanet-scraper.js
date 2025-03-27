const BaseScraper = require('./base-scraper');
const { arcaplanet } = require('../../config/scraping-policies');
const axios = require('axios');
const logger = require('../utils/logger');
const puppeteer = require('puppeteer');
const fs = require('fs');

class ArcaplanetScraper extends BaseScraper {
  constructor(options = {}) {
    super(options);
    
    // Configurazione base dello scraper
    this.name = 'arcaplanet';
    this.baseUrl = arcaplanet.baseUrl;
    this.apiBaseUrl = arcaplanet.apiBaseUrl;
    this.graphqlEndpoint = arcaplanet.graphqlEndpoint;
    
    // Configurazione della paginazione con approccio moderato
    this.enablePagination = options.enablePagination !== undefined ? options.enablePagination : true;
    this.maxPages = options.maxPages || 5;  // Limitato a 5 pagine per categoria
    this.productsPerPage = options.productsPerPage || 20; // Prodotti per pagina (visto nel test)
    
    // Configurazione delle pause e dei tentativi
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 5000;
    this.pauseBetweenPages = options.pauseBetweenPages || 2000;
    this.requestDelay = options.requestDelay || 3000;
    
    // Configurazione proxy
    this.proxy = options.proxy || null;
    
    // Configurazione debug
    this.debug = options.debug || false;
    
    // Configurazione Puppeteer
    this.usePuppeteer = options.usePuppeteer !== undefined ? options.usePuppeteer : true;
    this.headless = options.headless !== undefined ? options.headless : true;
    this.browserTimeout = options.browserTimeout || 60000;
    this.puppeteerViewport = { width: 1280, height: 800 };
    
    // Cache per cookies e dati di autenticazione
    this.cookies = null;
    this.authHeaders = null;
    this.browser = null;
    this.categoryFacetsCache = new Map(); // Cache per mappare percorsi di categoria ai facets
    
    // User agents realistici per smartphone e desktop
    this.userAgents = [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    ];
    
    logger.info(`Inizializzato scraper Arcaplanet (VTEX) con Puppeteer:
    - URL Base: ${this.baseUrl}
    - URL API: ${this.apiBaseUrl}
    - Paginazione: ${this.enablePagination ? 'abilitata' : 'disabilitata'}
    - Pagine massime: ${this.maxPages}
    - Prodotti per pagina: ${this.productsPerPage}
    - Tentativi: ${this.retryAttempts}
    - Pausa tra pagine: ${this.pauseBetweenPages}ms
    - Pausa tra richieste: ${this.requestDelay}ms
    - Debug: ${this.debug ? 'attivato' : 'disattivato'}
    - Usa Puppeteer: ${this.usePuppeteer ? 'sì' : 'no'}
    - Headless: ${this.headless ? 'sì' : 'no'}
    - Proxy: ${this.proxy ? 'configurato' : 'non configurato'}`);
  }

  /**
   * Inizializza il browser Puppeteer se necessario
   * @returns {Promise<void>}
   */
  async initBrowser() {
    if (!this.browser) {
      logger.info('Inizializzazione browser Puppeteer...');
      
      const launchOptions = {
        headless: this.headless ? 'new' : false,
        defaultViewport: this.puppeteerViewport,
        timeout: this.browserTimeout,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      };
      
      // Aggiungi proxy se configurato
      if (this.proxy) {
        launchOptions.args.push(`--proxy-server=${this.proxy.host}:${this.proxy.port}`);
      }
      
      try {
        this.browser = await puppeteer.launch(launchOptions);
        logger.info('Browser Puppeteer inizializzato con successo');
      } catch (error) {
        logger.error(`Errore nell'inizializzazione del browser: ${error.message}`);
        throw error;
      }
    }
    
    return this.browser;
  }

  /**
   * Chiude il browser Puppeteer se aperto
   * @returns {Promise<void>}
   */
  async closeBrowser() {
    if (this.browser) {
      logger.info('Chiusura browser Puppeteer...');
      await this.browser.close();
      this.browser = null;
      logger.info('Browser Puppeteer chiuso');
    }
  }

  /**
   * Ottiene un User-Agent casuale dalla lista
   * @returns {string} User-Agent casuale
   */
  getRandomUserAgent() {
    const randomIndex = Math.floor(Math.random() * this.userAgents.length);
    return this.userAgents[randomIndex];
  }

  /**
   * Recupera i prodotti di una categoria tramite le API GraphQL o Puppeteer
   * @param {string} categoryPath - Path della categoria (ad es. "gatto/cibo-umido")
   * @returns {Promise<Array>} Array di prodotti mappati
   */
  async fetchCategoryProducts(categoryPath) {
    try {
      logger.info(`Recupero prodotti per categoria: ${categoryPath}`);
      
      // Determina il metodo di recupero
      if (this.usePuppeteer) {
        // Usa Puppeteer per recuperare i prodotti
        return await this.fetchCategoryProductsWithPuppeteer(categoryPath);
      } else {
        // Fallback a GraphQL API
        const graphqlData = await this.fetchGraphQLData(categoryPath, 0, 24);
        
        if (!graphqlData || !graphqlData.products || !graphqlData.products.items) {
          logger.warn(`Nessun dato valido ricevuto per categoria ${categoryPath}`);
          return [];
        }
        
        // Ottieni e mappa i prodotti
        const products = graphqlData.products.items;
        logger.info(`Recuperati ${products.length} prodotti per categoria ${categoryPath}`);
        
        // Mappa i prodotti nel formato comune
        return this.mapProducts(products, categoryPath);
      }
    } catch (error) {
      logger.error(`Errore durante il recupero dei prodotti per la categoria ${categoryPath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Recupera i prodotti di una categoria tramite Puppeteer
   * @param {string} categoryPath - Path della categoria (ad es. "gatto/cibo-umido")
   * @returns {Promise<Array>} Array di prodotti mappati
   */
  async fetchCategoryProductsWithPuppeteer(categoryPath) {
    logger.info(`Recupero prodotti per categoria con Puppeteer: ${categoryPath}`);
    
    try {
      // Inizializza il browser
      await this.initBrowser();
      
      // Se la paginazione è disabilitata, recupera solo la prima pagina
      if (!this.enablePagination) {
        logger.info(`Paginazione disabilitata, recupero solo prima pagina per ${categoryPath}`);
        const firstPageProducts = await this.fetchProductsPage(categoryPath, 1);
        return this.mapProductsFromVTEX(firstPageProducts, categoryPath);
      }
      
      // Altrimenti, recupera tutte le pagine fino al limite
      logger.info(`Recupero prodotti con paginazione per ${categoryPath} (max pagine: ${this.maxPages})`);
      return await this.fetchProductsWithPaginationPuppeteer(categoryPath);
    } catch (error) {
      logger.error(`Errore durante il recupero prodotti con Puppeteer: ${error.message}`);
      throw error;
    } finally {
      // Chiudi il browser se non sono previste altre operazioni a breve
      if (!this.debug) {
        await this.closeBrowser();
      }
    }
  }

  /**
   * Recupera i prodotti con paginazione tramite Puppeteer
   * @param {string} categoryPath - Percorso della categoria
   * @returns {Promise<Array>} Array di prodotti mappati
   */
  async fetchProductsWithPaginationPuppeteer(categoryPath) {
    try {
      logger.info(`Iniziando recupero paginato con Puppeteer per ${categoryPath}`);
      
      // Apri la pagina della categoria per intercettare la prima risposta API
      // e ottenere i cookies e l'autenticazione
      const firstPageData = await this.fetchInitialPageAndDetectAPI(categoryPath);
      
      if (!firstPageData || !firstPageData.products || firstPageData.products.length === 0) {
        logger.warn(`Nessun prodotto trovato nella prima pagina per ${categoryPath}`);
        return [];
      }
      
      // Estrai informazioni sulla paginazione dalla prima risposta
      const totalCount = firstPageData.totalCount || 0;
      const totalPages = Math.ceil(totalCount / this.productsPerPage);
      const pagesLimit = Math.min(totalPages, this.maxPages);
      
      logger.info(`Trovati ${totalCount} prodotti totali, ${totalPages} pagine (limite: ${pagesLimit})`);
      
      // Array per tutti i prodotti
      let allProducts = [...firstPageData.products];
      
      // Se c'è più di una pagina, continua con le chiamate API dirette usando i cookies
      if (pagesLimit > 1 && this.cookies) {
        logger.info(`Recupero pagine aggiuntive (${pagesLimit - 1}) usando i cookies della sessione`);
        
        // Utilizza i cookies e i dati di sessione per fare richieste API dirette
        // per le pagine successive (più veloce di Puppeteer)
        for (let page = 2; page <= pagesLimit; page++) {
          logger.info(`Recupero pagina ${page}/${pagesLimit} tramite API diretta`);
          
          // Piccola pausa prima di ogni richiesta
          await new Promise(resolve => setTimeout(resolve, this.pauseBetweenPages));
          
          try {
            // Calcola il parametro "after" in base alla pagina
            const after = (page - 1) * this.productsPerPage;
            
            // Recupera i prodotti della pagina corrente tramite API
            const pageData = await this.fetchPageViaAPI(categoryPath, page, after);
            
            if (pageData && pageData.products && pageData.products.length > 0) {
              logger.info(`Trovati ${pageData.products.length} prodotti nella pagina ${page}`);
              allProducts = allProducts.concat(pageData.products);
            } else {
              logger.warn(`Nessun prodotto trovato nella pagina ${page}`);
              break; // Termina se non ci sono altri prodotti
            }
          } catch (error) {
            logger.error(`Errore durante il recupero della pagina ${page}: ${error.message}`);
            // Continua con la pagina successiva nonostante l'errore
          }
        }
      }
      
      logger.info(`Recuperati ${allProducts.length} prodotti totali per la categoria ${categoryPath}`);
      
      // Mappa i prodotti nel formato comune dell'applicazione
      return this.mapProductsFromVTEX(allProducts, categoryPath);
      
    } catch (error) {
      logger.error(`Errore durante il recupero paginato: ${error.message}`);
      throw error;
    }
  }

  /**
   * Recupera la prima pagina e intercetta la risposta API
   * @param {string} categoryPath - Percorso della categoria
   * @returns {Promise<Object>} Informazioni API e prodotti
   */
  async fetchInitialPageAndDetectAPI(categoryPath) {
    logger.info(`Navigazione iniziale e intercettazione API per ${categoryPath}`);
    
    // Apri una nuova pagina
    const page = await this.browser.newPage();
    
    try {
      // Imposta user agent
      await page.setUserAgent(this.getRandomUserAgent());
      
      // Imposta timeout
      await page.setDefaultNavigationTimeout(this.browserTimeout);
      await page.setDefaultTimeout(this.browserTimeout);
      
      // Array per memorizzare le risposte GraphQL
      let graphqlResponses = [];
      
      // Intercetta le risposte API
      page.on('response', async (response) => {
        const url = response.url();
        
        // Filtra solo le risposte GraphQL
        if (url.includes('/api/graphql') && response.request().method() === 'POST') {
          try {
            // Estrai i dati della risposta e della richiesta
            const responseData = await response.json();
            const requestData = JSON.parse(response.request().postData());
            
            // Filtra solo le risposte pertinenti ai prodotti
            if (requestData.operationName === 'ProductsQueryForPlp' && 
                responseData.data && 
                responseData.data.search && 
                responseData.data.search.products) {
              
              // Salva la risposta per analisi
              graphqlResponses.push({
                request: requestData,
                response: responseData,
                url: url,
                timestamp: new Date().toISOString()
              });
              
              // Cache della mappatura del percorso categoria ai selectedFacets
              if (requestData.variables && requestData.variables.selectedFacets) {
                this.categoryFacetsCache.set(categoryPath, requestData.variables.selectedFacets);
                
                if (this.debug) {
                  logger.debug(`Cache facets per ${categoryPath}: ${JSON.stringify(requestData.variables.selectedFacets)}`);
                }
              }
            }
          } catch (error) {
            logger.debug(`Errore nell'analizzare la risposta API: ${error.message}`);
          }
        }
      });
      
      // Naviga alla pagina della categoria
      const categoryUrl = `${this.baseUrl}/${categoryPath}`;
      logger.info(`Navigazione a ${categoryUrl}`);
      
      await page.goto(categoryUrl, { waitUntil: 'networkidle2' });
      logger.info('Pagina caricata, attesa caricamento prodotti...');
      
      // Attendi caricamento prodotti (al massimo 30 secondi)
      try {
        await page.waitForSelector('[data-testid="gallery-layout-container"], [class*="vtex-search-result"]', { 
          timeout: 30000,
          visible: true 
        });
        logger.info('Prodotti caricati nella pagina');
      } catch (timeoutError) {
        logger.warn('Timeout durante attesa caricamento prodotti. Continuo comunque...');
      }
      
      // Attendi per essere sicuri che tutte le chiamate API siano complete
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Estrai i cookies per le richieste successive
      this.cookies = await page.cookies();
      logger.info(`Estratti ${this.cookies.length} cookies per le richieste future`);
      
      // Analizza le risposte intercettate
      if (graphqlResponses.length > 0) {
        logger.info(`Intercettate ${graphqlResponses.length} risposte API GraphQL`);
        
        // Prendi l'ultima risposta (che contiene i prodotti)
        const latestResponse = graphqlResponses[graphqlResponses.length - 1];
        
        // Estrai i dati dei prodotti e della paginazione
        const edges = latestResponse.response.data.search.products.edges || [];
        const totalCount = latestResponse.response.data.search.products.pageInfo?.totalCount || 0;
        
        // Salva la richiesta GraphQL per riutilizzarla
        this.lastGraphQLRequest = latestResponse.request;
        
        logger.info(`Prima pagina: trovati ${edges.length} prodotti (totale: ${totalCount})`);
        
        // Estrai tutti i prodotti
        const products = edges.map(edge => edge.node);
        
        return {
          products,
          totalCount,
          pageInfo: latestResponse.response.data.search.products.pageInfo,
          request: latestResponse.request
        };
      } else {
        logger.warn('Nessuna risposta API intercettata durante la navigazione iniziale!');
        
        // Tentativo di fallback: estrai direttamente dal DOM
        logger.info('Tentativo di estrazione prodotti dal DOM...');
        
        const productsData = await page.evaluate(() => {
          // Cerca gli elementi prodotto nella pagina
          const productElements = document.querySelectorAll('[data-testid="product-summary"], [class*="vtex-product-summary"]');
          
          // Estrai i dati da ciascun elemento
          return Array.from(productElements).map(element => {
            // Nome prodotto
            const nameElement = element.querySelector('[data-testid="product-summary-name"], [class*="nameContainer"]');
            const name = nameElement ? nameElement.textContent.trim() : 'N/A';
            
            // Brand
            const brandElement = element.querySelector('[data-testid="product-summary-brand"], [class*="brandName"]');
            const brand = brandElement ? brandElement.textContent.trim() : 'N/A';
            
            // Prezzo
            const priceElement = element.querySelector('[data-testid="price"], [class*="price"]');
            const price = priceElement ? priceElement.textContent.trim() : 'N/A';
            
            // URL e immagine
            const linkElement = element.querySelector('a');
            const url = linkElement ? linkElement.href : 'N/A';
            
            const imageElement = element.querySelector('img');
            const imageUrl = imageElement ? imageElement.src : 'N/A';
            
            // ID/SKU (estrai dall'URL se possibile)
            let id = 'N/A';
            let sku = 'N/A';
            if (url && url.includes('-')) {
              const parts = url.split('-');
              const lastPart = parts[parts.length - 1];
              if (/^\d+$/.test(lastPart)) {
                id = lastPart;
                sku = lastPart;
              }
            }
            
            return { 
              id, 
              sku, 
              name, 
              brand: { name: brand },
              offers: { 
                offers: [{ 
                  price, 
                  listPrice: price,
                  availability: 'https://schema.org/InStock' 
                }] 
              },
              image: { url: imageUrl },
              url
            };
          });
        });
        
        logger.info(`Estratti ${productsData.length} prodotti dal DOM`);
        
        return {
          products: productsData,
          totalCount: productsData.length,
          pageInfo: { hasNextPage: false }
        };
      }
    } catch (error) {
      logger.error(`Errore durante la navigazione iniziale: ${error.message}`);
      throw error;
    } finally {
      // Chiudi la pagina ma mantieni il browser aperto
      await page.close();
    }
  }

  /**
   * Recupera una pagina di prodotti tramite API utilizzando i cookie e le info della sessione
   * @param {string} categoryPath - Percorso della categoria
   * @param {number} pageNum - Numero di pagina
   * @param {number} after - Valore "after" per la paginazione
   * @returns {Promise<Object>} Dati dei prodotti
   */
  async fetchPageViaAPI(categoryPath, pageNum, after) {
    logger.info(`Recupero pagina ${pageNum} tramite API diretta per ${categoryPath} (after=${after})`);
    
    try {
      // Verifica che abbiamo i cookies
      if (!this.cookies || !this.lastGraphQLRequest) {
        throw new Error('Cookies o dati GraphQL non disponibili. Eseguire prima fetchInitialPageAndDetectAPI');
      }
      
      // Prepara i dati per la richiesta GraphQL
      const graphqlPayload = {
        ...this.lastGraphQLRequest,
        variables: {
          ...this.lastGraphQLRequest.variables,
          first: this.productsPerPage,
          after: after.toString()
        }
      };
      
      // Usa i facets dalla cache se disponibili
      if (this.categoryFacetsCache.has(categoryPath)) {
        graphqlPayload.variables.selectedFacets = this.categoryFacetsCache.get(categoryPath);
      }
      
      // Converti i cookies in formato string per uso con axios
      const cookieString = this.cookies
        .map(cookie => `${cookie.name}=${cookie.value}`)
        .join('; ');
      
      // Prepara headers con cookies
      const headers = {
        'accept': '*/*',
        'accept-language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
        'content-type': 'application/json',
        'user-agent': this.getRandomUserAgent(),
        'origin': this.baseUrl,
        'referer': `${this.baseUrl}/${categoryPath}`,
        'cookie': cookieString
      };
      
      if (this.debug) {
        logger.debug(`Richiesta API pagina ${pageNum}:
        URL: ${this.graphqlEndpoint}
        Payload: ${JSON.stringify(graphqlPayload)}
        `);
      }
      
      // Implementa tentativi con backoff esponenziale
      let attempt = 0;
      let lastError = null;
      
      while (attempt < this.retryAttempts) {
        try {
          // Esegui la richiesta all'API GraphQL
          const response = await axios.post(
            this.graphqlEndpoint,
            graphqlPayload,
            { headers, timeout: this.browserTimeout }
          );
          
          // Verifica che la risposta contenga dati validi
          if (response.data && 
              response.data.data && 
              response.data.data.search && 
              response.data.data.search.products) {
            
            const edges = response.data.data.search.products.edges || [];
            const products = edges.map(edge => edge.node);
            
            logger.info(`API pagina ${pageNum}: trovati ${products.length} prodotti`);
            
            return {
              products,
              totalCount: response.data.data.search.products.pageInfo?.totalCount || 0,
              pageInfo: response.data.data.search.products.pageInfo
            };
          } else {
            logger.warn(`Risposta API per pagina ${pageNum} non contiene dati validi`);
            return { products: [], totalCount: 0 };
          }
        } catch (error) {
          lastError = error;
          attempt++;
          
          // Calcola il tempo di attesa con backoff esponenziale
          const waitTime = this.retryDelay * Math.pow(2, attempt - 1);
          logger.warn(`Tentativo ${attempt}/${this.retryAttempts} fallito. Riprovo tra ${waitTime}ms`);
          
          // Pausa prima del prossimo tentativo
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
      
      // Se arriviamo qui, tutti i tentativi sono falliti
      throw lastError || new Error(`Tutti i ${this.retryAttempts} tentativi di recupero pagina ${pageNum} sono falliti`);
    } catch (error) {
      logger.error(`Errore durante recupero pagina ${pageNum} via API: ${error.message}`);
      throw error;
    }
  }

  /**
   * Mappa i prodotti dal formato VTEX al formato comune dell'applicazione
   * @param {Array} products - Array di prodotti nel formato VTEX
   * @param {string} categoryPath - Percorso della categoria
   * @returns {Array} - Array di prodotti mappati
   */
  mapProductsFromVTEX(products, categoryPath) {
    try {
      logger.info(`Mappatura di ${products.length} prodotti VTEX per categoria ${categoryPath}`);
      
      if (products.length === 0) {
        logger.warn(`Nessun prodotto da mappare per categoria ${categoryPath}`);
        return [];
      }
      
      // Mappa i prodotti nel formato comune
      const mappedProducts = products.map(product => {
        try {
          // Dati base del prodotto
          const id = product.id || product.productId || '';
          const name = product.name || '';
          const sku = product.sku || id;
          const slug = product.slug || '';
          
          // Dati prezzo
          let price = 0;
          let listPrice = 0;
          let currency = 'EUR';
          let availability = 'UNKNOWN';
          
          if (product.offers && product.offers.offers && product.offers.offers.length > 0) {
            const offer = product.offers.offers[0];
            price = parseFloat(offer.price) || 0;
            listPrice = parseFloat(offer.listPrice) || price;
            availability = (offer.availability === 'https://schema.org/InStock') ? 'IN_STOCK' : 'OUT_OF_STOCK';
          }
          
          // Dati brand
          const brand = (product.brand && product.brand.name) ? product.brand.name : '';
          
          // Dati immagine
          let imageUrl = '';
          if (product.image && product.image.url) {
            imageUrl = product.image.url;
            
            // Correggi URL immagine se necessario (es. protocollo mancante)
            if (imageUrl && !imageUrl.startsWith('http')) {
              if (imageUrl.startsWith('//')) {
                imageUrl = 'https:' + imageUrl;
              } else {
                imageUrl = 'https://' + imageUrl;
              }
            }
            
            // Verifica CDN immagine VTEX e ottieni la versione più grande
            if (imageUrl.includes('vteximg.com.br') && !imageUrl.includes('/1000x1000/')) {
              imageUrl = imageUrl.replace(/\/\d+x\d+\//, '/1000x1000/');
            }
          }
          
          // URL prodotto
          let productUrl = product.url || `${this.baseUrl}/${slug}`;
          
          // Correzione URL per assicurarsi che sia completo
          if (productUrl && !productUrl.startsWith('http')) {
            productUrl = this.baseUrl + (productUrl.startsWith('/') ? '' : '/') + productUrl;
          }
          
          // Calcola sconto
          let discountPercentage = 0;
          if (listPrice > 0 && price < listPrice) {
            discountPercentage = Math.round(((listPrice - price) / listPrice) * 100);
          }
          
          // Estrai descrizione
          let description = '';
          if (product.description) {
            if (typeof product.description === 'string') {
              description = product.description;
            } else if (product.description.html) {
              description = product.description.html;
            }
          }
          
          // Mappatura al formato comune
          return {
            source: 'arcaplanet',
            sourceId: id,
            name: name,
            brand: brand,
            price: {
              current: price,
              original: listPrice,
              currency: currency,
              discountPercentage: discountPercentage
            },
            url: productUrl,
            imageUrl: imageUrl,
            description: description,
            sku: sku,
            stockStatus: availability,
            categories: [{ path: categoryPath }],
            metadata: {
              categoryPath,
              slug,
              vtexId: id
            },
            lastUpdated: new Date()
          };
        } catch (error) {
          logger.error(`Errore durante la mappatura del prodotto: ${error.message}`);
          return null;
        }
      });
      
      // Filtra i prodotti nulli
      const validProducts = mappedProducts.filter(product => product !== null);
      
      logger.info(`Mappati con successo ${validProducts.length} prodotti validi`);
      
      return validProducts;
    } catch (error) {
      logger.error(`Errore durante la mappatura dei prodotti: ${error.message}`);
      return [];
    }
  }

  /**
   * Cleanup delle risorse
   */
  async cleanup() {
    await this.closeBrowser();
  }

  /**
   * [LEGACY] Metodo mantenuto per compatibilità
   */
  async mapProducts(products, categoryPath) {
    try {
      logger.info(`Mappatura legacy di ${products.length} prodotti per categoria ${categoryPath}`);
      
      // Implementazione precedente
      // ... existing code ...
      
      // Ora reindirizza al nuovo metodo
      return this.mapProductsFromVTEX(products, categoryPath);
    } catch (error) {
      logger.error(`Errore durante la mappatura legacy: ${error.message}`);
      return [];
    }
  }
}

module.exports = ArcaplanetScraper;