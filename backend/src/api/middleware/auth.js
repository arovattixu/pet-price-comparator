const config = require('../../config/config');

/**
 * Middleware per l'autenticazione tramite API key
 */
function apiKeyAuth(req, res, next) {
  // Salta l'autenticazione se non è configurata una API key
  if (!config.security.apiKey) {
    return next();
  }
  
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== config.security.apiKey) {
    return res.status(401).json({
      error: {
        message: 'API key non valida o mancante',
        code: 'INVALID_API_KEY'
      }
    });
  }
  
  next();
}

module.exports = { apiKeyAuth };