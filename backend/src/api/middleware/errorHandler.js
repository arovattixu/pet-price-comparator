const logger = require('../../utils/logger');

/**
 * Middleware per la gestione degli errori
 */
function errorHandler(err, req, res, next) {
  // Log dell'errore
  logger.error(`${err.name}: ${err.message}\nStack: ${err.stack}`);
  
  // Errore di validazione Mongoose
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: {
        message: 'Errore di validazione',
        details: Object.values(err.errors).map(e => e.message),
        code: 'VALIDATION_ERROR'
      }
    });
  }
  
  // Errore di cast Mongoose (es. ID non valido)
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: {
        message: 'Formato dati non valido',
        details: err.message,
        code: 'INVALID_FORMAT'
      }
    });
  }
  
  // Errore di duplicazione (es. unique constraint)
  if (err.code === 11000) {
    return res.status(409).json({
      error: {
        message: 'Risorsa già esistente',
        details: err.message,
        code: 'DUPLICATE_RESOURCE'
      }
    });
  }
  
  // Errore generico
  return res.status(500).json({
    error: {
      message: 'Errore interno del server',
      code: 'INTERNAL_SERVER_ERROR'
    }
  });
}

module.exports = errorHandler;