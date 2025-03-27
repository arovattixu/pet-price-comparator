/**
 * Client GraphQL per le API di Arcaplanet
 * Questo modulo gestisce le richieste GraphQL verso l'API di Arcaplanet
 */

const axios = require('axios');
const logger = require('../utils/logger');

class GraphQLClient {
  constructor(baseUrl, options = {}) {
    // Aggiungiamo l'operationName per la ricerca prodotti come default
    this.baseUrl = baseUrl;
    this.productSearchUrl = `${baseUrl}?operationName=ProductsQueryForPlp`;
    
    // Cookie necessari per l'autenticazione e la sessione
    // Questi valori possono essere aggiornati con setCookies
    this.cookies = options.cookies || {
      'vtex-search-anonymous': '903e9ff4a20848a99b20c0282bdabd2e',
      'CookieConsent': '{stamp:%2778OigyIfiAXbTNTLSRZ3RZXwJYrgrXTrNusbW7potYkIowcHmLQjig==%27%2Cnecessary:true%2Cpreferences:true%2Cstatistics:true%2Cmarketing:true%2Cmethod:%27explicit%27%2Cver:1%2Cutc:1742197420184%2Cregion:%27it%27}',
      'janus_sid': '19ae7d7d-57ca-48e6-abae-420ad917bb99'
    };
    
    // Headers basati su una richiesta reale del browser
    this.headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
      'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': '*/*',
      'Origin': 'https://www.arcaplanet.it',
      'Referer': 'https://www.arcaplanet.it/cane/cibo-secco',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin'
    };
    
    // Opzioni di default
    this.options = {
      timeout: options.timeout || 60000, // 60 secondi di timeout
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 2000, // 2 secondi tra i tentativi
      ...options
    };
    
    // Aggiorna i cookies nelle intestazioni
    this.updateCookieHeader();
  }
  
  /**
   * Imposta i cookies da utilizzare nelle richieste
   * @param {Object} cookies - Oggetto con i cookies da impostare
   */
  setCookies(cookies) {
    this.cookies = { ...this.cookies, ...cookies };
    this.updateCookieHeader();
    logger.debug(`Cookies aggiornati: ${Object.keys(this.cookies).length} cookies impostati`);
  }
  
  /**
   * Aggiorna l'header Cookie con i cookies correnti
   */
  updateCookieHeader() {
    if (Object.keys(this.cookies).length > 0) {
      const cookieString = Object.entries(this.cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
      
      this.headers['Cookie'] = cookieString;
      logger.debug(`Header Cookie aggiornato: ${cookieString.substring(0, 50)}...`);
    }
  }

  /**
   * Esegue una query GraphQL con gestione dei tentativi
   * @param {string} query - La query GraphQL da eseguire
   * @param {Object} variables - Le variabili da passare alla query
   * @param {string} operationName - Il nome dell'operazione GraphQL
   * @param {number} retryCount - Il conteggio attuale dei tentativi (uso interno)
   * @returns {Promise<Object>} - La risposta JSON dalla API
   */
  async query(query, variables = {}, operationName = null, retryCount = 0) {
    try {
      logger.debug(`Esecuzione query GraphQL verso ${this.baseUrl} (tentativo ${retryCount + 1}/${this.options.maxRetries + 1})`);
      logger.debug(`Variabili: ${JSON.stringify(variables)}`);
      
      // Determina l'URL corretto in base all'operazione
      const url = operationName === 'ProductsQueryForPlp' ? this.productSearchUrl : this.baseUrl;
      
      // Costruisci il payload con l'operationName se specificato
      const payload = {
        query,
        variables
      };
      
      if (operationName) {
        payload.operationName = operationName;
      }
      
      // Aggiungi un request-id aleatorio come fanno i browser
      const requestId = `|${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}.${Math.random().toString(36).substring(2, 15)}`;
      this.headers['request-id'] = requestId;
      
      // Genera un traceparent aleatorio come fanno i browser
      const traceId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const spanId = Math.random().toString(36).substring(2, 15);
      this.headers['traceparent'] = `00-${traceId}-${spanId}-01`;
      
      const response = await axios.post(url, payload, {
        headers: this.headers,
        timeout: this.options.timeout,
        validateStatus: status => status < 500 // Accetta anche risposte 4xx
      });

      // Salva eventuali cookies dalla risposta
      if (response.headers['set-cookie']) {
        this.parseCookies(response.headers['set-cookie']);
      }

      // Gestione errori GraphQL
      if (response.data && response.data.errors) {
        const errorMessages = response.data.errors.map(err => err.message).join(', ');
        logger.error(`Errori GraphQL: ${errorMessages}`);
        
        // Se abbiamo dati parziali, li restituiamo comunque
        if (response.data.data) {
          logger.warn(`Ricevuti dati parziali nonostante gli errori. Continuo con i dati disponibili.`);
          return response.data;
        }
        
        throw new Error(`Errore nella query GraphQL: ${errorMessages}`);
      }

      return response.data;
    } catch (error) {
      // Se il tentativo corrente è minore del massimo, prova di nuovo
      if (retryCount < this.options.maxRetries) {
        logger.warn(`Tentativo ${retryCount + 1}/${this.options.maxRetries} fallito: ${error.message}. Riprovo tra ${this.options.retryDelay}ms`);
        
        // Attendi con il delay configurato prima di riprovare
        await new Promise(resolve => setTimeout(resolve, this.options.retryDelay));
        
        // Incrementa il tempo di attesa tra i tentativi (exponential backoff)
        this.options.retryDelay = Math.min(this.options.retryDelay * 1.5, 10000);
        
        // Riprova con l'incremento del contatore
        return this.query(query, variables, operationName, retryCount + 1);
      }
      
      // Se abbiamo esaurito i tentativi, propaga l'errore
      logger.error(`Errore durante la richiesta GraphQL dopo ${this.options.maxRetries + 1} tentativi: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Analizza e salva i cookies dalla risposta
   * @param {Array} setCookieHeaders - Array di header Set-Cookie
   */
  parseCookies(setCookieHeaders) {
    // Verifica che setCookieHeaders sia un array
    if (!Array.isArray(setCookieHeaders)) {
      setCookieHeaders = [setCookieHeaders];
    }
    
    for (const cookieHeader of setCookieHeaders) {
      try {
        // Estrai il nome e il valore dal cookie
        const [cookiePart] = cookieHeader.split(';');
        const [name, value] = cookiePart.split('=').map(s => s.trim());
        
        if (name && value) {
          this.cookies[name] = value;
        }
      } catch (error) {
        logger.debug(`Errore nell'analisi del cookie: ${error.message}`);
      }
    }
    
    // Aggiorna l'header Cookie
    this.updateCookieHeader();
  }

  /**
   * Recupera i prodotti da una categoria specifica tramite GraphQL
   * @param {string} category - Il percorso della categoria (es. "cane/cibo-secco")
   * @param {number} page - Il numero di pagina da cui partire (default: 1)
   * @param {number} resultsPerPage - Numero di risultati per pagina (default: 50)
   * @returns {Promise<Object>} - I prodotti e il conteggio totale
   */
  async getProductsByCategory(category, page = 1, resultsPerPage = 50) {
    // Calcola i parametri di paginazione
    const from = (page - 1) * resultsPerPage;
    const to = from + resultsPerPage - 1;
    
    // Costruisci il percorso della categoria come selectedFacet
    const selectedFacets = [
      {
        key: 'c',
        value: category
      }
    ];
    
    // Aggiorna l'header di referer per la categoria specifica
    this.headers.Referer = `https://www.arcaplanet.it/${category}`;
    
    // Query per ottenere i prodotti di una categoria
    const query = `
      query productSearch($from: Int, $to: Int, $selectedFacets: [SelectedFacetInput], $fullText: String) {
        search(
          from: $from,
          to: $to,
          selectedFacets: $selectedFacets,
          fullText: $fullText,
          operator: AND
        ) {
          products {
            pageInfo {
              totalCount
            }
            edges {
              node {
                id
                slug
                sku
                name
                brand {
                  brandName
                  name
                }
                additionalProperty {
                  propertyID
                  name
                  value
                  valueReference
                }
                gtin
                productSpecifications {
                  itemId
                  measurementUnit
                  unitMultiplier
                }
                isVariantOf {
                  name
                  productGroupID
                  hasVariant {
                    sku
                    offers {
                      offers {
                        availability
                      }
                    }
                  }
                }
                image {
                  url
                  alternateName
                }
                offers {
                  lowPrice
                  offers {
                    availability
                    price
                    listPrice
                    seller {
                      identifier
                    }
                  }
                }
                breadcrumbList {
                  itemListElement {
                    item
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;
    
    try {
      const data = await this.query(query, {
        from,
        to,
        selectedFacets,
        fullText: ''
      }, 'ProductsQueryForPlp');
      
      // Verifica se la risposta contiene dati validi
      if (data && data.data && data.data.search && 
          data.data.search.products && data.data.search.products.edges) {
        
        return {
          products: data.data.search.products.edges.map(edge => edge.node),
          totalCount: data.data.search.products.pageInfo.totalCount
        };
      }
      
      throw new Error('Formato risposta GraphQL non valido');
    } catch (error) {
      logger.error(`Errore durante il recupero dei prodotti: ${error.message}`);
      throw error;
    }
  }

  /**
   * Recupera le categorie disponibili tramite GraphQL
   * @returns {Promise<Array>} - Lista delle categorie
   */
  async getCategories() {
    const query = `
      query GetCategories {
        categories(id: "1"){
          id
          name
          children {
            id
            name
            slug
            metaTagDescription
            children {
              id
              name
              slug
              metaTagDescription
            }
          }
        }
      }
    `;
    
    try {
      const data = await this.query(query, {}, 'GetCategories');
      
      if (data && data.data && data.data.categories) {
        return data.data.categories;
      }
      
      throw new Error('Formato risposta GraphQL non valido per categorie');
    } catch (error) {
      logger.error(`Errore durante il recupero delle categorie: ${error.message}`);
      throw error;
    }
  }
}

// Crea un'istanza del client GraphQL per Arcaplanet con opzioni personalizzate
const arcaplanetClient = new GraphQLClient('https://www.arcaplanet.it/api/graphql', {
  timeout: 60000,      // 60 secondi
  maxRetries: 3,       // Massimo 3 tentativi
  retryDelay: 2000     // 2 secondi tra i tentativi
});

module.exports = {
  GraphQLClient,
  arcaplanetClient
}; 