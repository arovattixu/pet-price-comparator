const ProxyChain = require('proxy-chain');
const logger = require('../utils/logger');
const ProxyManager = require('./proxy-manager');
const UserAgentRotator = require('./user-agents');

/**
 * Configura e restituisce un server proxy
 * @returns {Promise<Object>} Configurazione del proxy
 */
async function setupProxy() {
  // Inizializza il rotatore di user agent
  const userAgentRotator = new UserAgentRotator();
  
  // Se l'uso del proxy è disabilitato, restituisci solo il rotatore di user agent
  if (process.env.USE_PROXY !== 'true') {
    logger.info('Proxy disabilitato, utilizzo solo rotazione user agent');
    return {
      userAgentRotator
    };
  }
  
  try {
    // Inizializza il gestore di proxy
    const proxyManager = new ProxyManager();
    await proxyManager.initialize();
    
    // Crea un nuovo server proxy
    const server = new ProxyChain.Server({
      port: 8000,
      prepareRequestFunction: ({ request, username, password, hostname, port, isHttp }) => {
        // Ottieni il prossimo proxy dalla rotazione
        const upstreamProxyUrl = proxyManager.getNextProxy();
        
        return {
          requestAuthentication: false,
          upstreamProxyUrl: upstreamProxyUrl === 'direct://' ? null : upstreamProxyUrl,
        };
      },
    });
    
    // Avvia il server proxy
    await server.listen();
    
    logger.info(`Proxy server in ascolto su ${server.port}`);
    
    return {
      server,
      url: `http://localhost:${server.port}`,
      userAgentRotator
    };
  } catch (error) {
    logger.error(`Errore durante la configurazione del proxy: ${error.message}`);
    return null;
  }
}

module.exports = { setupProxy };