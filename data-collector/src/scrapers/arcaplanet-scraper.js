const BaseScraper = require('./base-scraper');
const { arcaplanet } = require('../../config/scraping-policies');
const axios = require('axios');
const logger = require('../utils/logger');
const puppeteer = require('puppeteer');
const fs = require('fs');
const cheerio = require('cheerio');
const { arcaplanetClient } = require('../services/graphql-client');

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

  /**
   * Esegue lo scraping di una categoria specifica
   * @param {string} category - Il percorso della categoria (es. "cane/cibo-secco")
   * @param {number} page - Pagina da cui iniziare (default: 1)
   * @param {number} limit - Limite di prodotti da recuperare (default: 50)
   * @returns {Promise<Array>} - Array di prodotti della categoria
   */
  async scrapeCategory(category, page = 1, limit = 50) {
    try {
      logger.info(`Iniziando scraping della categoria: ${category}`);
      
      // Inizializza il browser se necessario
      if (this.usePuppeteer && !this.browser) {
        await this.initBrowser();
      }
      
      // Approccio ibrido: prima tentiamo con Puppeteer per intercettare le richieste GraphQL
      try {
        logger.info(`Navigazione e intercettazione richieste per la categoria ${category}`);
        
        // Naviga alla pagina e intercetta le richieste/risposte GraphQL
        const navigationResult = await this.navigateAndInterceptGraphQL(category, this.browserTimeout);
        
        // Se abbiamo dei prodotti e le richieste sono state intercettate correttamente
        if (navigationResult.products.length > 0 && navigationResult.requests.length > 0) {
          logger.info(`Intercettate ${navigationResult.requests.length} richieste e ${navigationResult.products.length} prodotti`);
          
          // Calcola quante pagine ulteriori dobbiamo recuperare basandoci sul limite
          const productsToFetch = Math.max(0, limit - navigationResult.products.length);
          
          // Se abbiamo bisogno di più prodotti e abbiamo il client GraphQL pronto
          if (productsToFetch > 0 && this.lastGraphQLRequest) {
            logger.info(`Recupero ${productsToFetch} prodotti aggiuntivi tramite GraphQL diretto`);
            
            // Calcola la pagina successiva da cui partire
            const nextPage = Math.floor(navigationResult.products.length / this.productsPerPage) + 1;
            let additionalProducts = [];
            
            try {
              // Per ogni pagina aggiuntiva necessaria
              for (let p = nextPage; p <= this.maxPages && additionalProducts.length < productsToFetch; p++) {
                // Calcola from e to per la paginazione
                const from = (p - 1) * this.productsPerPage;
                const to = from + this.productsPerPage - 1;
                
                logger.info(`Recupero pagina ${p} via GraphQL (da ${from} a ${to})`);
                
                // Prepara la richiesta GraphQL con i dati intercettati
                const query = this.lastGraphQLRequest.query;
                const variables = {
                  ...this.lastGraphQLRequest.variables,
                  from: from,
                  to: to
                };
                
                // Esegui la richiesta con il client GraphQL
                const data = await arcaplanetClient.query(
                  query, 
                  variables, 
                  'ProductsQueryForPlp'
                );
                
                // Estrai i prodotti
                if (data && data.data && data.data.search && 
                    data.data.search.products && data.data.search.products.edges) {
                  
                  const pageProducts = data.data.search.products.edges.map(edge => edge.node);
                  logger.info(`Recuperati ${pageProducts.length} prodotti nella pagina ${p}`);
                  
                  additionalProducts.push(...pageProducts);
                  
                  // Pausa tra le richieste
                  if (p < this.maxPages) {
                    await new Promise(resolve => setTimeout(resolve, this.pauseBetweenPages));
                  }
                  
                  // Se abbiamo raggiunto il limite, fermiamoci
                  if (navigationResult.products.length + additionalProducts.length >= limit) {
                    break;
                  }
                } else {
                  logger.warn(`Nessun prodotto nella pagina ${p}`);
                  break;
                }
              }
              
              logger.info(`Recuperati ${additionalProducts.length} prodotti aggiuntivi via GraphQL`);
              
              // Combina i prodotti iniziali con quelli aggiuntivi
              navigationResult.products.push(...additionalProducts);
              
            } catch (graphqlError) {
              logger.error(`Errore nel recupero dati GraphQL aggiuntivi: ${graphqlError.message}`);
              // Continuiamo con i prodotti che abbiamo già
            }
          }
          
          // Limita al massimo numero richiesto
          const finalProducts = navigationResult.products.slice(0, limit);
          
          logger.info(`Elaborazione di ${finalProducts.length} prodotti recuperati`);
          
          // Processa i prodotti in gruppi
          const productGroups = this.processProductsIntoGroups(finalProducts);
          
          // Converti in formato standard
          const standardProducts = this.convertGroupsToStandardFormat(productGroups);
          
          logger.info(`Scraping completato per ${category}: recuperati ${standardProducts.length} prodotti (${Object.keys(productGroups).length} gruppi)`);
          
          return standardProducts;
        } else {
          throw new Error('Nessun prodotto o richiesta intercettata durante la navigazione');
        }
      } catch (puppeteerError) {
        logger.error(`Errore approccio Puppeteer: ${puppeteerError.message}`);
        logger.info('Tentativo con approccio GraphQL diretto...');
        
        // Fallback: prova con il client GraphQL direttamente
        let allProducts = [];
        let totalPages = Math.ceil(limit / this.productsPerPage);
        totalPages = Math.min(totalPages, this.maxPages);
        
        for (let p = page; p <= totalPages; p++) {
          logger.info(`Recupero pagina ${p} di prodotti via GraphQL diretto`);
          
          try {
            // Utilizza il client GraphQL per ottenere i prodotti
            const result = await arcaplanetClient.getProductsByCategory(
              category,
              p,
              this.productsPerPage
            );
            
            if (result && result.products && result.products.length > 0) {
              allProducts.push(...result.products);
              
              // Pausa tra le richieste
              if (p < totalPages) {
                await new Promise(resolve => setTimeout(resolve, this.pauseBetweenPages));
              }
              
              // Se abbiamo raggiunto il limite, fermiamoci
              if (allProducts.length >= limit) {
                break;
              }
            } else {
              logger.warn(`Nessun prodotto nella pagina ${p}`);
              break;
            }
          } catch (graphqlError) {
            logger.error(`Errore GraphQL diretto per pagina ${p}: ${graphqlError.message}`);
            break;
          }
        }
        
        // Limita al massimo numero richiesto
        allProducts = allProducts.slice(0, limit);
        
        if (allProducts.length === 0) {
          throw new Error('Nessun prodotto recuperato con entrambi gli approcci');
        }
        
        logger.info(`Recuperati ${allProducts.length} prodotti con approccio GraphQL diretto`);
        
        // Processa i prodotti in gruppi
        const productGroups = this.processProductsIntoGroups(allProducts);
        
        // Converti in formato standard
        const standardProducts = this.convertGroupsToStandardFormat(productGroups);
        
        logger.info(`Scraping completato per ${category}: recuperati ${standardProducts.length} prodotti (${Object.keys(productGroups).length} gruppi)`);
        
        return standardProducts;
      }
    } catch (error) {
      logger.error(`Errore durante lo scraping della categoria ${category}: ${error.message}`);
      throw error;
    } finally {
      // Chiudi il browser se non è necessario mantenerlo aperto
      if (!this.keepBrowserOpen && this.browser) {
        await this.closeBrowser();
      }
    }
  }

  /**
   * Elabora i prodotti raggruppandoli per productGroupID
   * @param {Array} products - Lista di prodotti da elaborare
   * @returns {Object} - Prodotti raggruppati per ID gruppo
   */
  processProductsIntoGroups(products) {
    logger.info(`Elaborazione di ${products.length} prodotti in gruppi`);
    
    const productGroups = {};
    
    // Raggruppa per productGroupID
    for (const product of products) {
      if (!product.isVariantOf || !product.isVariantOf.productGroupID) {
        logger.warn('Prodotto senza productGroupID, saltato');
        continue;
      }
      
      const groupID = product.isVariantOf.productGroupID;
      const groupName = product.isVariantOf.name;
      
      // Inizializza il gruppo se non esiste
      if (!productGroups[groupID]) {
        productGroups[groupID] = {
          groupId: groupID,
          name: groupName,
          brand: product.brand?.name || '',
          variants: [],
          allImages: new Set(),
          // Estrai categorizzazione dal breadcrumbList se disponibile
          categories: product.breadcrumbList?.itemListElement?.map(item => ({
            name: item.name,
            path: item.item
          })) || [],
          // Estrai badge/promozioni
          badges: product.productBadges || []
        };
      }
      
      // Aggiungi l'immagine se presente
      if (product.image) {
        const images = Array.isArray(product.image) ? product.image : [product.image];
        images.forEach(img => {
          if (img.url) productGroups[groupID].allImages.add(img.url);
        });
      }
      
      // Estrai prezzo, disponibilità e dati di spedizione
      let price = null;
      let listPrice = null;
      let available = false;
      let seller = null;
      let deliveryInfo = 'Standard';
      
      if (product.offers && product.offers.offers && product.offers.offers.length > 0) {
        const offer = product.offers.offers[0];
        price = offer.price;
        listPrice = offer.listPrice;
        available = offer.availability === 'https://schema.org/InStock';
        seller = offer.seller?.identifier || '1';
        
        // Estrai informazioni di disponibilità specifiche se presenti
        if (offer.availability === 'https://schema.org/InStock') {
          deliveryInfo = 'Disponibile';
        } else if (offer.availability === 'https://schema.org/OutOfStock') {
          deliveryInfo = 'Non disponibile';
        } else if (offer.availability === 'https://schema.org/PreOrder') {
          deliveryInfo = 'Preordinabile';
        } else if (offer.availability === 'https://schema.org/BackOrder') {
          deliveryInfo = 'In arrivo';
        }
      }
      
      // Estrai informazioni sul prezzo unitario
      let pricePerUnit = null;
      let unitMultiplier = 1;
      let unitMeasurement = 'un';
      
      if (product.stockKeepingUnit && product.stockKeepingUnit.pricePerUnit) {
        pricePerUnit = {
          value: price / (product.stockKeepingUnit.pricePerUnit.multiplier || 1),
          unit: product.stockKeepingUnit.pricePerUnit.unit || 'KG'
        };
      }
      
      if (product.productSpecifications) {
        unitMultiplier = product.productSpecifications.unitMultiplier || 1;
        unitMeasurement = product.productSpecifications.measurementUnit || 'un';
      }
      
      // Estrai proprietà addizionali
      const additionalProperties = {};
      if (Array.isArray(product.additionalProperty)) {
        product.additionalProperty.forEach(prop => {
          if (prop.name && prop.value) {
            additionalProperties[prop.name] = prop.value;
          }
        });
      }
      
      // Aggiungi la variante solo se non esiste già
      const existingVariant = productGroups[groupID].variants.find(
        v => v.id === product.id && v.sku === product.sku
      );
      
      if (!existingVariant) {
        productGroups[groupID].variants.push({
          id: product.id,
          sku: product.sku,
          gtin: product.gtin || null,
          name: product.name,
          slug: product.slug,
          price: price,
          listPrice: listPrice,
          available: available,
          url: `${this.baseUrl}/${product.slug}/p`,
          pricePerUnit: pricePerUnit,
          delivery: deliveryInfo,
          seller: seller,
          properties: additionalProperties,
          unitMultiplier: unitMultiplier,
          unitMeasurement: unitMeasurement
        });
      } else {
        logger.debug(`Variante con ID ${product.id} e SKU ${product.sku} già presente, saltata.`);
      }
    }
    
    // Converti i set di immagini in array
    Object.values(productGroups).forEach(group => {
      group.images = Array.from(group.allImages);
      delete group.allImages;
    });
    
    logger.info(`Creati ${Object.keys(productGroups).length} gruppi di prodotti`);
    
    return productGroups;
  }

  /**
   * Converte i gruppi di prodotti in un formato standardizzato per il database
   * @param {Object} productGroups - Prodotti raggruppati per ID gruppo
   * @returns {Array} - Prodotti in formato standardizzato
   */
  convertGroupsToStandardFormat(productGroups) {
    logger.info('Conversione gruppi in formato standard...');
    
    const standardProducts = [];
    
    for (const groupId in productGroups) {
      const group = productGroups[groupId];
      
      // Trova la variante principale (quella disponibile o la prima)
      const mainVariant = group.variants.find(v => v.available) || group.variants[0];
      
      if (!mainVariant) continue;
      
      // Estrai categorie normalizzate
      const normalizedCategories = this.normalizeCategories(group.categories || []);
      
      // Calcola il prezzo per unità medio se disponibile
      const pricePerUnit = mainVariant.pricePerUnit 
        ? { value: mainVariant.pricePerUnit.value, unit: mainVariant.pricePerUnit.unit }
        : null;
      
      // Crea il prodotto standard
      const standardProduct = {
        id: mainVariant.id,
        sku: mainVariant.sku,
        gtin: mainVariant.gtin || null,
        title: group.name,
        brand: group.brand,
        url: mainVariant.url,
        images: group.images,
        price: {
          current: mainVariant.price,
          original: mainVariant.listPrice,
          currency: 'EUR',
          pricePerUnit: pricePerUnit,
          discountPercentage: this.calculateDiscountPercentage(mainVariant.price, mainVariant.listPrice)
        },
        available: mainVariant.available,
        store: this.name,
        deliveryInfo: {
          status: mainVariant.delivery,
          seller: mainVariant.seller,
          estimatedDelivery: this.estimateDeliveryTime(mainVariant.delivery)
        },
        variants: group.variants.map(v => ({
          id: v.id,
          sku: v.sku,
          gtin: v.gtin || null,
          title: v.name,
          url: v.url,
          price: {
            current: v.price,
            original: v.listPrice,
            pricePerUnit: v.pricePerUnit
          },
          available: v.available,
          deliveryInfo: {
            status: v.delivery,
            seller: v.seller
          },
          specifications: {
            unitMultiplier: v.unitMultiplier,
            unitMeasurement: v.unitMeasurement,
            properties: v.properties || {}
          }
        })),
        categories: normalizedCategories,
        badges: group.badges || [],
        metadata: {
          groupId: groupId,
          variantCount: group.variants.length,
          scrapedAt: new Date().toISOString(),
          unitMultiplier: mainVariant.unitMultiplier,
          unitMeasurement: mainVariant.unitMeasurement
        }
      };
      
      standardProducts.push(standardProduct);
    }
    
    logger.info(`Convertiti ${standardProducts.length} prodotti in formato standard`);
    
    return standardProducts;
  }
  
  /**
   * Calcola la percentuale di sconto
   * @param {number} currentPrice - Prezzo attuale
   * @param {number} originalPrice - Prezzo originale
   * @returns {number} Percentuale di sconto
   */
  calculateDiscountPercentage(currentPrice, originalPrice) {
    if (!currentPrice || !originalPrice || currentPrice >= originalPrice) {
      return 0;
    }
    
    return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
  }
  
  /**
   * Normalizza le categorie del prodotto
   * @param {Array} categories - Categorie da normalizzare
   * @returns {Array} Categorie normalizzate
   */
  normalizeCategories(categories) {
    if (!categories || categories.length === 0) {
      return [];
    }
    
    return categories.map(category => ({
      id: category.path ? category.path.replace(/\//g, '') : '',
      name: category.name || '',
      path: category.path || '',
      level: category.path ? (category.path.match(/\//g) || []).length : 0
    }));
  }
  
  /**
   * Stima il tempo di consegna in base allo stato di disponibilità
   * @param {string} deliveryStatus - Stato di disponibilità
   * @returns {string} Tempo di consegna stimato
   */
  estimateDeliveryTime(deliveryStatus) {
    switch(deliveryStatus) {
      case 'Disponibile':
        return '1-3 giorni lavorativi';
      case 'In arrivo':
        return '5-10 giorni lavorativi';
      case 'Preordinabile':
        return 'Data di rilascio non disponibile';
      case 'Non disponibile':
        return 'Non disponibile';
      default:
        return 'Tempi di consegna standard';
    }
  }

  /**
   * Naviga una pagina e intercetta tutte le richieste e risposte GraphQL
   * @param {string} categoryPath - Percorso della categoria da navigare
   * @param {number} timeout - Timeout in ms
   * @returns {Promise<Object>} - Dati intercettati e prodotti estratti
   */
  async navigateAndInterceptGraphQL(categoryPath, timeout = 60000) {
    logger.info(`Navigazione e intercettazione richieste GraphQL per ${categoryPath}`);
    
    if (!this.browser) {
      await this.initBrowser();
    }
    
    // Dati di runtime
    const runtime = {
      interceptedRequests: [],
      graphqlResponses: [],
      cookies: [],
      products: []
    };
    
    const page = await this.browser.newPage();
    
    try {
      // Imposta user agent
      await page.setUserAgent(this.getRandomUserAgent());
      
      // Imposta timeout
      await page.setDefaultNavigationTimeout(timeout);
      await page.setDefaultTimeout(timeout);
      
      // Attiva l'intercettazione delle richieste
      await page.setRequestInterception(true);
      
      // Intercetta le richieste
      page.on('request', async (request) => {
        const url = request.url();
        
        // Se è una richiesta GraphQL, salva i dettagli
        if (url.includes('/api/graphql') && request.method() === 'POST') {
          try {
            const postData = request.postData();
            if (postData) {
              const parsed = JSON.parse(postData);
              
              // Salviamo solo un numero limitato di richieste
              if (runtime.interceptedRequests.length < 10) {
                runtime.interceptedRequests.push({
                  url,
                  headers: request.headers(),
                  postData: parsed,
                  method: request.method(),
                  timestamp: new Date().toISOString()
                });
                
                logger.debug(`Intercettata richiesta GraphQL: ${parsed.operationName || 'senza nome'}`);
              }
              
              // Cache della mappatura del percorso categoria ai selectedFacets
              if (parsed.variables && parsed.variables.selectedFacets && parsed.operationName === 'ProductsQueryForPlp') {
                this.categoryFacetsCache.set(categoryPath, parsed.variables.selectedFacets);
                logger.debug(`Aggiornata cache facets per ${categoryPath}`);
              }
            }
          } catch (error) {
            logger.debug(`Errore nell'analizzare i dati della richiesta: ${error.message}`);
          }
        }
        
        // Continua con la richiesta
        request.continue();
      });
      
      // Intercetta le risposte
      page.on('response', async (response) => {
        const url = response.url();
        
        // Se è una risposta GraphQL, salvala
        if (url.includes('/api/graphql') && response.request().method() === 'POST') {
          try {
            const responseData = await response.json();
            const requestData = JSON.parse(response.request().postData());
            
            // Salviamo solo le risposte di query per prodotti
            if (requestData.operationName === 'ProductsQueryForPlp' && 
                responseData.data && 
                responseData.data.search && 
                responseData.data.search.products) {
              
              runtime.graphqlResponses.push({
                url,
                request: requestData,
                response: responseData,
                timestamp: new Date().toISOString()
              });
              
              logger.info(`Intercettata risposta GraphQL con ${responseData.data.search.products.edges?.length || 0} prodotti`);
              
              // Estrai prodotti dalla risposta
              if (responseData.data.search.products.edges) {
                const products = responseData.data.search.products.edges.map(edge => edge.node);
                runtime.products.push(...products);
                
                // Salva la richiesta GraphQL per riutilizzarla
                this.lastGraphQLRequest = requestData;
                
                logger.info(`Estratti ${products.length} prodotti dalla risposta GraphQL`);
              }
            }
          } catch (error) {
            logger.debug(`Errore nell'analizzare la risposta: ${error.message}`);
          }
        }
      });
      
      // Naviga alla pagina della categoria
      const categoryUrl = `${this.baseUrl}/${categoryPath}`;
      logger.info(`Navigazione a ${categoryUrl}`);
      
      await page.goto(categoryUrl, { waitUntil: 'networkidle2' });
      logger.info('Pagina caricata, attesa caricamento prodotti...');
      
      // Attendi caricamento prodotti
      try {
        await page.waitForSelector('[data-testid="gallery-layout-container"], [class*="vtex-search-result"]', { 
          timeout: 30000,
          visible: true 
        });
        logger.info('Prodotti caricati nella pagina');
      } catch (timeoutError) {
        logger.warn('Timeout durante attesa caricamento prodotti. Continuo comunque...');
      }
      
      // Scroll della pagina per caricare più prodotti
      await this.autoScrollPage(page);
      
      // Estrai i cookie
      runtime.cookies = await page.cookies();
      logger.info(`Estratti ${runtime.cookies.length} cookies dalla sessione`);
      
      // Salva i cookies per future richieste
      this.cookies = runtime.cookies;
      
      // Converti array di cookie in oggetto per il client GraphQL
      const cookiesObj = {};
      runtime.cookies.forEach(cookie => {
        cookiesObj[cookie.name] = cookie.value;
      });
      
      // Aggiorna il client GraphQL con i cookie
      arcaplanetClient.setCookies(cookiesObj);
      
      return {
        cookies: runtime.cookies,
        requests: runtime.interceptedRequests,
        responses: runtime.graphqlResponses,
        products: runtime.products,
        totalCount: runtime.graphqlResponses.length > 0 
          ? runtime.graphqlResponses[0].response.data.search.products.pageInfo?.totalCount || 0
          : 0
      };
      
    } catch (error) {
      logger.error(`Errore durante la navigazione e intercettazione: ${error.message}`);
      throw error;
    } finally {
      // Chiudi la pagina
      await page.close();
      logger.info('Pagina chiusa');
    }
  }
  
  /**
   * Funzione per scorrere automaticamente la pagina e caricare più prodotti
   * @param {Page} page - La pagina Puppeteer da scorrere
   */
  async autoScrollPage(page) {
    logger.info('Scorrimento pagina per caricare più prodotti...');
    
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
    
    logger.info('Scorrimento completato');
  }
}

module.exports = ArcaplanetScraper;