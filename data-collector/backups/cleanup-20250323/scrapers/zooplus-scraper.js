const BaseScraper = require('./base-scraper');
const scrapingPolicies = require('../../config/scraping-policies');
const logger = require('../utils/logger');

class ZooplusScraper extends BaseScraper {
  constructor(options = {}) {
    super(options);
    const config = scrapingPolicies.zooplus;
    this.baseUrl = config.baseUrl;
    this.apiBaseUrl = config.apiBaseUrl || 'https://www.zooplus.it/api/discover/v1';
    
    // Memorizza tutte le opzioni per riferimenti futuri
    this.options = options;
    
    // Configurazioni per la paginazione
    this.enablePagination = options.enablePagination !== undefined 
      ? options.enablePagination 
      : true;
    
    this.maxPages = options.maxPages || 5;
    
    // Opzioni etiche per le pause
    this.pauseBetweenPages = options.pauseBetweenPages || 2000;
    this.requestDelay = options.requestDelay || 1000;
    
    logger.debug(`ZooplusScraper inizializzato: 
      - Paginazione: ${this.enablePagination ? 'abilitata' : 'disabilitata'}
      - Max pagine: ${this.maxPages}
      - Pausa tra pagine: ${this.pauseBetweenPages}ms
      - Pausa tra richieste: ${this.requestDelay}ms`);
  }

  /**
   * Recupera i prodotti per una categoria
   * @param {string} category - Il percorso della categoria
   * @returns {Promise<Array>} - Array di prodotti mappati al nostro schema
   */
  async fetchCategoryProducts(category) {
    try {
      logger.info(`Recupero prodotti per categoria: ${category}`);
      
      let products = [];
      
      if (this.enablePagination) {
        // Utilizza la funzione di paginazione per ottenere tutti i prodotti
        logger.info(`Utilizzando paginazione per categoria ${category}`);
        products = await this.fetchAllCategoryPages(category, this.maxPages);
        logger.info(`Recuperati ${products.length} prodotti con paginazione per categoria ${category}`);
      } else {
        // Utilizza il metodo senza paginazione (solo prima pagina)
        logger.info(`Paginazione disabilitata, recupero solo prima pagina per categoria ${category}`);
        const apiData = await this.fetchProductsFromApi(category);
        if (!apiData || !apiData.productList || !apiData.productList.products) {
          logger.warn('API data not found or invalid');
          return [];
        }
        
        products = apiData.productList.products;
        logger.info(`Recuperati ${products.length} prodotti dalla prima pagina per categoria ${category}`);
      }
      
      if (products.length === 0) {
        logger.warn(`Nessun prodotto trovato per la categoria ${category}`);
        return [];
      }
      
      // Mappa i prodotti al nostro schema
      const mappedProducts = this.mapProductsToSchema(products, category);
      logger.info(`Mappati ${mappedProducts.length} prodotti per categoria ${category}`);
      
      return mappedProducts;
    } catch (error) {
      logger.error(`Error fetching Zooplus category ${category}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Esegue una chiamata API per ottenere i prodotti di una categoria
   * @param {string} category - Il percorso della categoria
   * @param {number} page - Numero di pagina (per paginazione)
   * @returns {Promise<Object>} - Dati API
   */
  async fetchProductsFromApi(category, page = 1) {
    try {
      // Implementa una pausa etica prima della richiesta
      const requestDelay = this.requestDelay || 1000;
      if (page > 1 || category.includes('_')) { // Evita ritardo alla prima richiesta della prima categoria
        logger.debug(`Pausa etica di ${requestDelay}ms prima della richiesta API`);
        await new Promise(resolve => setTimeout(resolve, requestDelay));
      }
      
      // Costruisci l'URL dell'API con i parametri richiesti
      const apiUrl = `${this.apiBaseUrl}/products/list-faceted-partial`;
      
      // Parametri di query per l'API
      const params = {
        path: category,
        domain: 'zooplus.it',
        language: 'it',
        page
      };
      
      // Costruisci header con referer corretto
      const headers = {
        'Referer': `${this.baseUrl}${category}`,
        'Origin': this.baseUrl,
        // Header aggiuntivi per comportamento responsabile
        'Accept-Language': 'it-IT,it;q=0.9',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin'
      };
      
      logger.info(`Chiamata API [Pagina ${page}]: ${apiUrl} con params: ${JSON.stringify(params)}`);
      
      // Esegui la richiesta API usando il metodo get ereditato da BaseScraper
      const data = await this.get(apiUrl, params, { headers });
      
      // Verifica se la risposta è valida
      if (data && data.productList && data.productList.products) {
        const products = data.productList.products;
        logger.info(`API request successful, recuperati ${products.length} prodotti dalla pagina ${page}`);
        
        // Log di esempio per il primo prodotto (se esiste)
        if (products.length > 0) {
          logger.debug(`ID del primo prodotto: ${products[0].shopIdentifier || 'N/A'}`);
        }
        
        return data;
      } else {
        logger.warn(`API request returned invalid data structure: ${JSON.stringify(Object.keys(data || {}))}`);
        return null;
      }
    } catch (error) {
      logger.error(`Error fetching API data (pagina ${page}): ${error.message}`);
      
      // Log dettagliati per il debug
      if (error.response) {
        logger.error(`API error response status: ${error.response.status}`);
        logger.error(`API error response data: ${JSON.stringify(error.response.data || {})}`);
      }
      
      // In caso di errore, restituisci null per attivare eventuali fallback
      return null;
    }
  }
  
  /**
   * Recupera tutte le pagine di prodotti con paginazione
   * @param {string} category - Il percorso della categoria
   * @param {number} maxPages - Numero massimo di pagine da recuperare
   * @returns {Promise<Array>} - Array di tutti i prodotti
   */
  async fetchAllCategoryPages(category, maxPages = 10) {
    let allProducts = [];
    let page = 1;
    let hasMoreProducts = true;
    
    // Determina il ritardo tra pagine (usa le opzioni o un valore predefinito)
    const pauseBetweenPages = this.options?.pauseBetweenPages || 2000;
    
    logger.info(`Iniziando recupero paginato per categoria ${category}, max pagine: ${maxPages}`);
    logger.info(`Pausa etica tra pagine: ${pauseBetweenPages}ms`);
    
    while (hasMoreProducts && page <= maxPages) {
      try {
        logger.info(`Recupero pagina ${page}/${maxPages} per categoria ${category}`);
        
        const data = await this.fetchProductsFromApi(category, page);
        
        if (data && data.productList && data.productList.products) {
          const products = data.productList.products;
          logger.info(`Recuperati ${products.length} prodotti dalla pagina ${page}`);
          
          if (products.length === 0) {
            logger.info(`Nessun prodotto trovato alla pagina ${page}, terminazione paginazione`);
            hasMoreProducts = false;
          } else {
            allProducts = [...allProducts, ...products];
            page++;
            
            // Pausa etica tra le pagine per non sovraccaricare l'API
            if (hasMoreProducts && page <= maxPages) {
              logger.debug(`Pausa etica di ${pauseBetweenPages}ms prima della prossima pagina`);
              await new Promise(resolve => setTimeout(resolve, pauseBetweenPages));
            }
          }
        } else {
          logger.warn(`Risposta API non valida alla pagina ${page}, terminazione paginazione`);
          hasMoreProducts = false;
        }
      } catch (error) {
        logger.error(`Errore durante il recupero della pagina ${page}: ${error.message}`);
        hasMoreProducts = false;
      }
    }
    
    logger.info(`Recupero paginato completato: ${allProducts.length} prodotti totali in ${page-1} pagine`);
    return allProducts;
  }

  /**
   * Mappa i prodotti API al nostro schema
   * @param {Array} products - Array di prodotti dall'API
   * @param {string} category - Categoria dei prodotti
   * @returns {Array} - Prodotti mappati al nostro schema
   */
  mapProductsToSchema(products, category) {
    // Verifica che products sia un array
    if (!Array.isArray(products)) {
      logger.warn('mapProductsToSchema: input non è un array');
      return [];
    }

    logger.info(`Mapping di ${products.length} prodotti dalla categoria ${category}`);
    
    // Mappa ogni prodotto e assicura che abbia source e sourceId
    return products.map(product => {
      try {
        // Estrai l'ID del prodotto, assicurandoti che esista
        const sourceId = product.shopIdentifier || 
                       product.id || 
                       product.productId || 
                       product.path?.split('/').pop() || 
                       `zp-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
        
        // Estrai titolo, descrizione e immagine
        const name = product.title || 'Prodotto Zooplus';
        const description = product.summary || '';
        const imageUrl = product.picture400 || product.picture200 || '';
        
        // Estrai informazioni sulla variante/prezzo
        const variants = this.extractVariants(product);
        
        // Utilizza i dati della prima variante per il prezzo principale
        const mainVariant = variants[0] || {};
        const price = mainVariant.price?.current || 0;
        const available = mainVariant.available !== false;
        
        // Crea l'URL del prodotto
        const productUrl = product.path ? 
                         `${this.baseUrl}${product.path}` : 
                         `${this.baseUrl}${category}/${sourceId}`;
        
        // Crea il prodotto mappato
        return {
          source: 'zooplus', // SEMPRE impostare source
          sourceId: sourceId, // SEMPRE impostare sourceId
          name: name,
          description: description,
          imageUrl: imageUrl,
          brand: product.brand || '',
          category: category,
          
          // Prezzi e disponibilità
          prices: [{
            store: 'zooplus',
            price: parseFloat(price) || 0,
            currency: 'EUR',
            url: productUrl,
            lastUpdated: new Date(),
            inStock: available
          }],
          
          // Altri dati
          sku: product.sku || sourceId,
          weight: product.weight || '',
          variants: variants.length > 1 ? variants : undefined,
          
          // Metadati
          updatedAt: new Date(),
          createdAt: new Date()
        };
      } catch (error) {
        logger.error(`Errore nel mapping del prodotto: ${error.message}`);
        
        // In caso di errore, crea un prodotto minimo ma valido
        return {
          source: 'zooplus',
          sourceId: `zp-error-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
          name: 'Error processing product',
          description: `Error: ${error.message}`,
          category: category,
          prices: [{
            store: 'zooplus',
            price: 0,
            currency: 'EUR',
            url: `${this.baseUrl}${category}`,
            lastUpdated: new Date(),
            inStock: false
          }],
          createdAt: new Date(),
          updatedAt: new Date()
        };
      }
    });
  }
  
  /**
   * Estrae le informazioni sulle varianti di un prodotto
   * @param {Object} product - Prodotto dall'API
   * @returns {Array} - Array di varianti
   */
  extractVariants(product) {
    // Se il prodotto non ha varianti, crea una variante sintetica
    if (!product.variants || !Array.isArray(product.variants) || product.variants.length === 0) {
      return [{
        variantId: product.shopIdentifier || `variant-${Date.now()}`,
        description: '',
        price: {
          current: this.extractPrice(product),
          currency: 'EUR',
          priceDate: new Date()
        },
        available: product.available !== false
      }];
    }
    
    // Altrimenti mappa le varianti esistenti
    return product.variants.map((variant, index) => ({
      variantId: variant.id || `${product.shopIdentifier}-variant-${index}`,
      description: variant.description || '',
      price: {
        current: this.extractPrice(variant),
        currency: 'EUR',
        unitPrice: variant.price?.unitPrice,
        priceDate: new Date()
      },
      available: variant.available !== false,
      discounted: variant.articleDiscount?.discountLabel ? true : false,
      discountAmount: variant.articleDiscount?.discountLabel
    }));
  }
  
  /**
   * Estrae il prezzo da un prodotto o variante
   * @param {Object} item - Prodotto o variante
   * @returns {number} - Prezzo estratto
   */
  extractPrice(item) {
    // Gestisce diversi formati di prezzo
    if (typeof item.price === 'number') {
      return item.price;
    }
    
    if (item.price?.metaPropPrice) {
      return parseFloat(item.price.metaPropPrice);
    }
    
    if (item.price?.current) {
      return parseFloat(item.price.current);
    }
    
    if (item.price?.price?.value) {
      const match = item.price.price.value.match(/([0-9]+[,.][0-9]+)/);
      if (match) {
        return parseFloat(match[0].replace(',', '.'));
      }
    }
    
    if (typeof item.price === 'string') {
      const match = item.price.match(/([0-9]+[,.][0-9]+)/);
      if (match) {
        return parseFloat(match[0].replace(',', '.'));
      }
    }
    
    return 0;
  }
}

module.exports = ZooplusScraper;