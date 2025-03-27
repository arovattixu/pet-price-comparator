const mongoose = require('mongoose');
const logger = require('../utils/logger');

async function connectToDatabase() {
  try {
    // Aggiungo opzioni di configurazione per migliorare la gestione delle connessioni
    const options = {
      connectTimeoutMS: 30000, // Aumenta il timeout di connessione a 30 secondi
      socketTimeoutMS: 45000,  // Aumenta il timeout del socket a 45 secondi
      serverSelectionTimeoutMS: 30000, // Timeout per la selezione del server
      maxPoolSize: 10, // Limita il numero di connessioni nel pool
      minPoolSize: 2, // Mantieni almeno 2 connessioni aperte
      maxIdleTimeMS: 60000, // Chiudi le connessioni inattive dopo 60 secondi
      retryWrites: true, // Riprova le operazioni di scrittura fallite
      retryReads: true  // Riprova le operazioni di lettura fallite
    };
    
    logger.info('Connessione al database MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, options);
    
    mongoose.connection.on('error', (err) => {
      logger.error(`Errore di connessione MongoDB: ${err}`);
    });

    mongoose.connection.on('connected', () => {
      logger.info('Connessione al database MongoDB stabilita');
    });
    
    return mongoose.connection;
  } catch (error) {
    logger.error(`Impossibile connettersi al database: ${error.message}`);
    throw error;
  }
}

module.exports = { connectToDatabase };