const { promisify } = require('util');
const sleep = promisify(setTimeout);
const logger = require('../utils/logger');
const axios = require('axios');

class BaseScraper {
  constructor(options = {}) {
    this.proxyManager = options.proxyManager;
    this.userAgentRotator = options.userAgentRotator;
    this.retryAttempts = options.retryAttempts || parseInt(process.env.RETRY_ATTEMPTS) || 3;
    this.retryDelay = options.retryDelay || parseInt(process.env.RETRY_DELAY) || 5000;
    this.timeout = options.timeout || parseInt(process.env.REQUEST_TIMEOUT) || 30000;
    this.proxy = options.proxy || null;
  }

  /**
   * Ottiene gli headers di base per le richieste API
   * @param {Object} additionalHeaders - Headers aggiuntivi da includere
   * @returns {Object} - Headers HTTP
   */
  getHeaders(additionalHeaders = {}) {
    const userAgent = this.userAgentRotator 
      ? this.userAgentRotator.getRandomUserAgent() 
      : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36';
    
    return {
      'User-Agent': userAgent,
      'Accept': 'application/json',
      'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      ...additionalHeaders
    };
  }

  /**
   * Configura le opzioni per axios
   * @param {Object} options - Opzioni aggiuntive per axios
   * @returns {Object} - Configurazione axios
   */
  getAxiosConfig(options = {}) {
    const config = {
      timeout: this.timeout,
      headers: this.getHeaders(options.headers || {}),
      ...options
    };

    return config;
  }

  /**
   * Esegue una funzione con retry in caso di errore
   * @param {Function} fn - Funzione da eseguire
   * @param {number} maxRetries - Numero massimo di tentativi
   * @returns {Promise<any>} - Risultato della funzione
   */
  async execWithRetry(fn, maxRetries = this.retryAttempts) {
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        return await fn();
      } catch (error) {
        retries++;
        logger.error(`Retry ${retries}/${maxRetries} a causa di: ${error.message}`);
        
        if (retries >= maxRetries) {
          throw error;
        }
        
        // Cambia proxy dopo un errore se disponibile
        if (this.proxyManager) {
          await this.proxyManager.rotateProxy();
          logger.info('Rotazione proxy dopo errore');
        }
        
        // Attendi più a lungo tra i retry con backoff esponenziale
        const retryDelay = this.retryDelay * Math.pow(1.5, retries - 1) * (0.9 + Math.random() * 0.2);
        logger.info(`Attesa di ${Math.round(retryDelay)}ms prima del prossimo tentativo`);
        await sleep(retryDelay);
      }
    }
  }

  /**
   * Esegue una richiesta HTTP GET con gestione retry
   * @param {string} url - URL della richiesta
   * @param {Object} params - Parametri query
   * @param {Object} options - Opzioni aggiuntive per axios
   * @returns {Promise<Object>} - Risposta della richiesta
   */
  async get(url, params = {}, options = {}) {
    return this.execWithRetry(async () => {
      const config = this.getAxiosConfig({
        ...options,
        params
      });
      
      logger.debug(`GET request to ${url} with params: ${JSON.stringify(params)}`);
      const response = await axios.get(url, config);
      
      if (response.status !== 200) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }
      
      return response.data;
    });
  }

  /**
   * Esegue una richiesta HTTP POST con gestione retry
   * @param {string} url - URL della richiesta
   * @param {Object} data - Dati da inviare
   * @param {Object} options - Opzioni aggiuntive per axios
   * @returns {Promise<Object>} - Risposta della richiesta
   */
  async post(url, data = {}, options = {}) {
    return this.execWithRetry(async () => {
      const config = this.getAxiosConfig(options);
      
      logger.debug(`POST request to ${url}`);
      const response = await axios.post(url, data, config);
      
      if (response.status !== 200 && response.status !== 201) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }
      
      return response.data;
    });
  }
}

module.exports = BaseScraper;