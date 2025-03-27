/**
 * Server Express di test per le API di confronto avanzato
 */
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const logger = require('./src/utils/logger');

// Importa il controller mock che non necessita di database
const mockController = require('./src/api/controllers/advancedCompareControllerMock');

// Crea app Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Rotte di base
app.get('/', (req, res) => {
  res.json({ 
    message: 'Server di test per API di confronto avanzato',
    endpoints: [
      '/api/advanced-compare/unit-prices/:productId',
      '/api/advanced-compare/best-value/:brand/:category?',
      '/api/advanced-compare/sizes?namePattern=Text',
      '/api/advanced-compare/update-unit-prices'
    ]
  });
});

// Healthcheck
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    mode: 'mock-data'
  });
});

// Configurazione delle rotte di confronto avanzato con il controller mock
const advancedCompareRouter = express.Router();
advancedCompareRouter.get('/unit-prices/:productId', mockController.compareWithUnitPrices);
advancedCompareRouter.get('/best-value/:brand/:category?', mockController.findBestValueByBrand);
advancedCompareRouter.get('/sizes', mockController.compareSizes);
advancedCompareRouter.post('/update-unit-prices', mockController.updateAllUnitPrices);

// API di confronto avanzato
app.use('/api/advanced-compare', advancedCompareRouter);

// Gestione errori
app.use((err, req, res, next) => {
  logger.error(`Errore: ${err.message}`);
  console.error('Errore:', err);
  res.status(500).json({
    success: false,
    error: 'Si è verificato un errore interno'
  });
});

// Avvio server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info(`Server di test in esecuzione su http://localhost:${PORT}`);
  logger.info('Utilizzando controller MOCK per i dati di esempio');
}); 