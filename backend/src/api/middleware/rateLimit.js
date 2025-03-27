const rateLimit = require('express-rate-limit');
const config = require('../../config/config');

/**
 * Middleware per limitare il numero di richieste
 */
const apiLimiter = rateLimit({
  windowMs: config.security.rateLimitWindow, // Finestra di tempo
  max: config.security.rateLimitMax, // Numero massimo di richieste
  standardHeaders: true, // Restituisce i rate limit info negli headers `RateLimit-*`
  legacyHeaders: false, // Disabilita gli headers `X-RateLimit-*`
  message: {
    error: {
      message: 'Troppe richieste, riprova più tardi',
      code: 'RATE_LIMIT_EXCEEDED'
    }
  }
});

module.exports = { apiLimiter };