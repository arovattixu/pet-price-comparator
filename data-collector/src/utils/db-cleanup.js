const db = require('../services/database');
const logger = require('./logger');

/**
 * Pulisce il database rimuovendo i prodotti Arcaplanet con dati non validi
 * - Prodotti con nomi che sono solo dimensioni/pesi
 * - Prodotti senza categoria o immagini
 * - Prodotti senza varianti
 */
async function cleanupArcaplanetProducts() {
    logger.info('Inizio pulizia database per i prodotti Arcaplanet...');
    
    try {
        // Connessione al database
        if (!db.isConnected()) {
            await db.connect();
        }
        
        // 1. Conta il numero totale di prodotti Arcaplanet
        const totalCount = await db.Product.countDocuments({ source: 'arcaplanet' });
        logger.info(`Trovati ${totalCount} prodotti totali da Arcaplanet`);

        // 2. Trova prodotti con nomi non validi (solo dimensioni/pesi)
        const invalidNameProducts = await db.Product.find({
            source: 'arcaplanet',
            $or: [
                { name: { $regex: /^\d+(\.\d+)?(KG|G|L|ML|PZ)$/i } },
                { name: { $in: ['BIANCA', 'BLU', 'NERO', 'ROSSO', 'VERDE', 'GIALLO', 'ROSA'] } }
            ]
        });
        
        logger.info(`Trovati ${invalidNameProducts.length} prodotti con nomi non validi (solo pesi/dimensioni/colori)`);
        
        // 3. Trova prodotti senza immagini
        const noImagesProducts = await db.Product.find({
            source: 'arcaplanet',
            $or: [
                { images: { $size: 0 } },
                { images: { $exists: false } }
            ]
        });
        
        logger.info(`Trovati ${noImagesProducts.length} prodotti senza immagini`);
        
        // 4. Trova prodotti senza varianti
        const noVariantsProducts = await db.Product.find({
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
            const deleteResult = await db.Product.deleteMany({
                _id: { $in: uniqueProductsToDelete }
            });
            
            logger.info(`Eliminati ${deleteResult.deletedCount} prodotti non validi da Arcaplanet`);
        }
        
        // 7. Verifica finale
        const remainingCount = await db.Product.countDocuments({ source: 'arcaplanet' });
        logger.info(`Rimasti ${remainingCount} prodotti validi di Arcaplanet nel database`);
        logger.info(`Pulizia completata: rimossi ${totalCount - remainingCount} prodotti non validi`);
        
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

// Esporta la funzione per l'utilizzo da riga di comando
if (require.main === module) {
    // Esecuzione diretta dello script
    cleanupArcaplanetProducts()
        .then(result => {
            logger.info('Pulizia database completata con successo', result);
            process.exit(0);
        })
        .catch(err => {
            logger.error('Errore durante la pulizia del database', err);
            process.exit(1);
        });
} else {
    // Importazione come modulo
    module.exports = {
        cleanupArcaplanetProducts
    };
} 