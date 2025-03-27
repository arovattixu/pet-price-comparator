const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
require('dotenv').config();

class ProxyManager {
  constructor() {
    this.proxies = [];
    this.currentProxyIndex = 0;
    this.proxyListPath = process.env.PROXY_LIST || path.join(__dirname, '../../config/proxies.txt');
  }

  async initialize() {
    try {
      // Se è definito un file di proxy, caricalo
      if (this.proxyListPath) {
        const data = await fs.readFile(this.proxyListPath, 'utf8');
        this.proxies = data.split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#'));
      }
      
      logger.info(`Inizializzati ${this.proxies.length} proxy`);
      
      // Se non ci sono proxy, usa connessione diretta
      if (this.proxies.length === 0) {
        this.proxies.push('direct://');
      }
    } catch (error) {
      logger.error('Error initializing proxy manager:', error);
      // Usa connessione diretta in caso di errore
      this.proxies = ['direct://'];
    }
  }

  getNextProxy() {
    const proxy = this.proxies[this.currentProxyIndex];
    this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxies.length;
    return proxy;
  }

  async rotateProxy() {
    // Passa al proxy successivo
    this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxies.length;
    return this.proxies[this.currentProxyIndex];
  }

  getProxyCount() {
    return this.proxies.length;
  }
}

module.exports = ProxyManager;