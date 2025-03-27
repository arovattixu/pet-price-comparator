require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('./src/utils/logger');

// URI del database MongoDB
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  logger.error('MONGODB_URI non definito nelle variabili d\'ambiente');
  process.exit(1);
}

logger.info(`Tentativo di connessione a MongoDB: ${MONGODB_URI.substring(0, MONGODB_URI.indexOf('@') + 1)}[rimanente nascosto]`);

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000
})
.then(() => {
  logger.info('Connessione a MongoDB riuscita!');
  
  // Verifica stato del database
  return mongoose.connection.db.admin().ping();
})
.then(() => {
  logger.info('Ping al database completato con successo');
  
  // Ottieni informazioni sul database
  return mongoose.connection.db.stats();
})
.then((stats) => {
  logger.info(`Statistiche database: ${stats.db}, Collezioni: ${stats.collections}, Documenti totali: ${stats.objects}`);
  
  // Lista le collezioni
  return mongoose.connection.db.listCollections().toArray();
})
.then((collections) => {
  logger.info(`Collezioni nel database: ${collections.map(c => c.name).join(', ')}`);
  
  // Chiudi la connessione
  return mongoose.connection.close();
})
.then(() => {
  logger.info('Test completato. Connessione chiusa.');
  process.exit(0);
})
.catch((err) => {
  logger.error(`Errore di connessione a MongoDB: ${err.message}`);
  
  if (err.name === 'MongoServerSelectionError') {
    logger.error('Impossibile connettersi al server MongoDB. Verificare che il server sia in esecuzione e che le credenziali siano corrette.');
  }
  
  process.exit(1);
}); 