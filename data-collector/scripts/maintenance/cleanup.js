require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('./src/utils/logger');

// Funzione principale di pulizia
async function cleanupDatabase() {
    logger.info('Inizio pulizia database per i prodotti Arcaplanet...');
    
    try {
        // Connessione al database
        await mongoose.connect(process.env.MONGODB_URI);
        logger.info('Connesso al database MongoDB');
        
        // Ottieni il modello Product
        const productSchema = new mongoose.Schema({}, { strict: false });
        const Product = mongoose.model('Product', productSchema);
        
        // 1. Conta il numero totale di prodotti Arcaplanet
        const totalCount = await Product.countDocuments({ source: 'arcaplanet' });
        logger.info(`Trovati ${totalCount} prodotti totali da Arcaplanet`);

        // 2. Trova prodotti con nomi non validi (solo dimensioni/pesi)
        const invalidNameProducts = await Product.find({
            source: 'arcaplanet',
            $or: [
                { name: { $regex: /^\d+(\.\d+)?(KG|G|L|ML|PZ)$/i } },
                { name: { $in: ['BIANCA', 'BLU', 'NERO', 'ROSSO', 'VERDE', 'GIALLO', 'ROSA'] } }
            ]
        });
        
        logger.info(`Trovati ${invalidNameProducts.length} prodotti con nomi non validi (solo pesi/dimensioni/colori)`);
        
        // 3. Trova prodotti senza immagini
        const noImagesProducts = await Product.find({
            source: 'arcaplanet',
            $or: [
                { images: { $size: 0 } },
                { images: { $exists: false } }
            ]
        });
        
        logger.info(`Trovati ${noImagesProducts.length} prodotti senza immagini`);
        
        // 4. Trova prodotti senza varianti
        const noVariantsProducts = await Product.find({
            source: 'arcaplanet',
            $or: [
                { variants: { $size: 0 } },
                { variants: { $exists: false } }
            ]
        });
        
        logger.info(`Trovati ${noVariantsProducts.length} prodotti senza varianti`);
        
        // 5. Raccogli tutti gli ID da eliminare in un unico set
        const productsToDelete = new Set();
        
        invalidNameProducts.forEach(p => productsToDelete.add(p._id.toString()));
        noImagesProducts.forEach(p => productsToDelete.add(p._id.toString()));
        noVariantsProducts.forEach(p => productsToDelete.add(p._id.toString()));
        
        const uniqueProductsToDelete = [...productsToDelete];
        
        logger.info(`Eliminazione di ${uniqueProductsToDelete.length} prodotti non validi...`);
        
        // 6. Elimina i prodotti non validi
        if (uniqueProductsToDelete.length > 0) {
            const deleteResult = await Product.deleteMany({
                _id: { $in: uniqueProductsToDelete }
            });
            
            logger.info(`Eliminati ${deleteResult.deletedCount} prodotti non validi da Arcaplanet`);
        }
        
        // 7. Verifica finale
        const remainingCount = await Product.countDocuments({ source: 'arcaplanet' });
        logger.info(`Rimasti ${remainingCount} prodotti validi di Arcaplanet nel database`);
        logger.info(`Pulizia completata: rimossi ${totalCount - remainingCount} prodotti non validi`);
        
        // Chiudi la connessione
        await mongoose.connection.close();
        logger.info('Connessione al database chiusa');
        
        return {
            totalBefore: totalCount,
            totalAfter: remainingCount,
            removed: totalCount - remainingCount
        };
    } catch (error) {
        logger.error(`Errore durante la pulizia del database: ${error.message}`);
        throw error;
    }
}

// Esecuzione dello script
cleanupDatabase()
    .then(result => {
        logger.info('Pulizia database completata con successo', { result });
        process.exit(0);
    })
    .catch(err => {
        logger.error('Errore durante la pulizia del database', err);
        process.exit(1);
    }); 