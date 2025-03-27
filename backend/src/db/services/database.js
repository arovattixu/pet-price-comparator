const mongoose = require('mongoose');
const logger = require('../../utils/logger');

async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    mongoose.connection.on('error', (err) => {
      logger.error(`Errore di connessione MongoDB: ${err}`);
    });
    
    return mongoose.connection;
  } catch (error) {
    logger.error(`Impossibile connettersi al database: ${error.message}`);
    throw error;
  }
}

module.exports = { connectToDatabase };