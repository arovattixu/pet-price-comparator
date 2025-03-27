/**
 * Configurazione delle politiche di scraping
 * Definisce i parametri di comportamento degli scraper
 */

module.exports = {
  defaultPolicy: {
    minDelay: 3000,        // 3 secondi minimo tra le richieste
    maxDelay: 7000,        // 7 secondi massimo tra le richieste
    maxConcurrent: 1,      // Numero massimo di browser concorrenti
    respectRobotsTxt: true // Rispetta le regole dei robots.txt
  },
  zooplus: {
    baseUrl: 'https://www.zooplus.it',
    apiBaseUrl: 'https://www.zooplus.it/api/discover/v1'
  },
  arcaplanet: {
    baseUrl: 'https://www.arcaplanet.it',
    apiBaseUrl: 'https://www.arcaplanet.it/api/graphql',
    graphqlEndpoint: 'https://www.arcaplanet.it/api/graphql?operationName=ProductsQueryForPlp',
    restApiEndpoint: 'https://www.arcaplanet.it/api/search',  // Endpoint REST alternativo
    restCategoryEndpoint: 'https://www.arcaplanet.it/api/category' // Endpoint per categorie
  }
};