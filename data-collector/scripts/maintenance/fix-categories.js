const fs = require('fs');
const path = require('path');
const logger = require('./src/utils/logger');

/**
 * Script per correggere il problema delle categorie mancanti nei file JSON
 * Estrae la categoria dal nome del file e la aggiunge ai prodotti
 */
async function fixCategories() {
  logger.info('Inizio correzione categorie nei file JSON');
  
  // Trova tutti i file JSON nel percorso dei risultati
  const resultsDir = path.join(__dirname, 'results', 'arcaplanet');
  
  if (!fs.existsSync(resultsDir)) {
    logger.error(`Directory non trovata: ${resultsDir}`);
    return;
  }
  
  // Ottieni l'elenco dei file JSON
  const files = fs.readdirSync(resultsDir)
    .filter(file => file.endsWith('-products.json'));
  
  logger.info(`Trovati ${files.length} file JSON da elaborare`);
  
  // Statistiche
  let totalFiles = 0;
  let totalProducts = 0;
  let totalFixed = 0;
  
  // Elabora ogni file
  for (const file of files) {
    const filePath = path.join(resultsDir, file);
    logger.info(`Elaborazione file: ${file}`);
    
    try {
      // Estrai categoria dal nome del file
      const category = extractCategoryFromFilename(file);
      if (!category) {
        logger.warn(`Impossibile estrarre categoria dal file ${file}`);
        continue;
      }
      
      // Normalizza il percorso della categoria
      const normalizedCategory = normalizeCategoryPath(category);
      
      // Leggi il file
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      if (!Array.isArray(data)) {
        logger.warn(`Il file ${file} non contiene un array di prodotti`);
        continue;
      }
      
      let productsFixed = 0;
      
      // Aggiorna i prodotti
      for (const product of data) {
        // Verifica se la categoria è già presente
        const hasCategoryField = product.category && typeof product.category === 'string';
        
        if (!hasCategoryField) {
          // Aggiungi campo categoria
          product.category = normalizedCategory;
          productsFixed++;
        }
        
        // Verifica le categorie annidate
        if (product.categories && Array.isArray(product.categories) && product.categories.length > 0) {
          // Assicurati che tutte le categorie abbiano il campo path
          for (const cat of product.categories) {
            if (!cat.path) {
              cat.path = normalizedCategory;
              productsFixed++;
            }
          }
        } else {
          // Nessuna categoria annidata, crea l'array categories
          product.categories = [{
            name: category.split('-').pop(),
            path: normalizedCategory
          }];
          productsFixed++;
        }
      }
      
      // Salva il file aggiornato
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      
      logger.info(`File ${file}: ${data.length} prodotti, ${productsFixed} aggiornati`);
      
      totalFiles++;
      totalProducts += data.length;
      totalFixed += productsFixed;
    } catch (error) {
      logger.error(`Errore durante l'elaborazione del file ${file}: ${error.message}`);
    }
  }
  
  logger.info('===============================================');
  logger.info('RIEPILOGO CORREZIONE CATEGORIE');
  logger.info('===============================================');
  logger.info(`File elaborati: ${totalFiles}`);
  logger.info(`Prodotti totali: ${totalProducts}`);
  logger.info(`Prodotti corretti: ${totalFixed}`);
  logger.info('===============================================');
}

/**
 * Estrae la categoria dal nome del file
 */
function extractCategoryFromFilename(filename) {
  const match = filename.match(/(.+)-products\.json/);
  return match ? match[1] : null;
}

/**
 * Normalizza il percorso della categoria
 */
function normalizeCategoryPath(categoryPath) {
  // Assicurati che il percorso abbia la forma /categoria/sottocategoria/
  const parts = categoryPath.split('-');
  
  // Determina il tipo di animale (cane, gatto, ecc.)
  const petType = parts[0];
  
  // Rimuovi il tipo di animale e prendi il resto come categorie
  const categories = parts.slice(1);
  
  // Costruisci il percorso
  let path = `/${petType}/`;
  
  if (categories.length > 0) {
    path += `${categories.join('/')}/`;
  }
  
  return path;
}

// Esecuzione dello script
fixCategories().catch(err => {
  logger.error(`Errore nell'esecuzione: ${err.message}`);
  process.exit(1);
}); 