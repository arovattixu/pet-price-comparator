const fs = require('fs');
const path = require('path');
const logger = require('./src/utils/logger');
const { zooplusCategoryPaths } = require('./config/categories');

/**
 * Controlla lo stato dello scraping di Zooplus
 */
function checkScrapingStatus() {
  logger.info('Controllo lo stato dello scraping di Zooplus');
  
  // Definisci percorsi
  const resultsDir = path.join(__dirname, 'results', 'zooplus');
  const reportPath = path.join(resultsDir, 'scraping-report.json');
  
  // Verifica se la directory esiste
  if (!fs.existsSync(resultsDir)) {
    logger.info('❌ La directory dei risultati di Zooplus non esiste ancora');
    return;
  }
  
  // Leggi i file nella directory
  const files = fs.readdirSync(resultsDir)
    .filter(file => file.endsWith('-products.json'));
  
  // Verifica la presenza del report
  let report = null;
  if (fs.existsSync(reportPath)) {
    try {
      report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      logger.info('✅ Report di scraping trovato');
    } catch (error) {
      logger.error(`Errore nella lettura del report: ${error.message}`);
    }
  } else {
    logger.info('❌ Report di scraping non ancora disponibile');
  }
  
  // Conteggio dei file
  const totalCategories = zooplusCategoryPaths.length;
  const completedCategories = files.length;
  const progressPercent = ((completedCategories / totalCategories) * 100).toFixed(2);
  
  logger.info(`=== RIEPILOGO STATO SCRAPING ===`);
  logger.info(`Categorie totali: ${totalCategories}`);
  logger.info(`Categorie completate: ${completedCategories}/${totalCategories} (${progressPercent}%)`);
  
  // Se il report è disponibile, mostra statistiche aggiuntive
  if (report) {
    const elapsedMinutes = Math.round(report.elapsedSeconds / 60);
    logger.info(`Tempo trascorso: ${elapsedMinutes} minuti`);
    logger.info(`Prodotti totali recuperati: ${report.totalProducts}`);
    
    // Calcola il progresso previsto
    if (completedCategories > 0 && elapsedMinutes > 0) {
      const estimatedTotalMinutes = Math.round((elapsedMinutes / completedCategories) * totalCategories);
      const remainingMinutes = estimatedTotalMinutes - elapsedMinutes;
      
      if (remainingMinutes > 0) {
        logger.info(`Tempo stimato rimanente: ${remainingMinutes} minuti`);
      } else {
        logger.info(`Completamento imminente`);
      }
    }
    
    // Verifica categorie fallite
    const failedCategories = Object.entries(report.categories)
      .filter(([_, info]) => info.status !== 'success')
      .map(([category, info]) => ({ category, error: info.error }));
    
    if (failedCategories.length > 0) {
      logger.info(`\n❌ Categorie fallite: ${failedCategories.length}`);
      failedCategories.forEach(({ category, error }) => {
        logger.info(`- ${category}: ${error || 'Errore sconosciuto'}`);
      });
    } else {
      logger.info(`\n✅ Nessuna categoria fallita finora`);
    }
  }
  
  // Se ci sono file JSON, conta i prodotti
  if (files.length > 0) {
    logger.info(`\n=== DETTAGLI FILE JSON ===`);
    
    let totalProducts = 0;
    let maxProductsFile = '';
    let maxProductsCount = 0;
    
    for (const file of files) {
      try {
        const filePath = path.join(resultsDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        if (data.length > maxProductsCount) {
          maxProductsCount = data.length;
          maxProductsFile = file;
        }
        
        totalProducts += data.length;
      } catch (error) {
        logger.error(`Errore nella lettura del file ${file}: ${error.message}`);
      }
    }
    
    logger.info(`File JSON generati: ${files.length}`);
    logger.info(`Prodotti totali: ${totalProducts}`);
    logger.info(`Media prodotti per file: ${Math.round(totalProducts / files.length)}`);
    logger.info(`File con più prodotti: ${maxProductsFile} (${maxProductsCount} prodotti)`);
    
    // Mostra gli ultimi 3 file creati
    const fileStats = files.map(file => {
      const filePath = path.join(resultsDir, file);
      return {
        name: file,
        mtime: fs.statSync(filePath).mtime
      };
    });
    
    fileStats.sort((a, b) => b.mtime - a.mtime);
    
    logger.info(`\nUltimi file creati:`);
    fileStats.slice(0, 3).forEach(file => {
      logger.info(`- ${file.name} (${file.mtime.toLocaleString()})`);
    });
  }
  
  // Verifica se lo scraper è ancora in esecuzione
  logger.info(`\n=== STATO PROCESSO ===`);
  try {
    const { execSync } = require('child_process');
    const processCheck = execSync('ps aux | grep "run-zooplus-scraper.js" | grep -v grep').toString();
    
    if (processCheck.trim()) {
      logger.info(`✅ Il processo di scraping è ancora in esecuzione`);
    } else {
      logger.info(`❌ Il processo di scraping non sembra essere in esecuzione`);
    }
  } catch (error) {
    logger.info(`❌ Il processo di scraping non è in esecuzione`);
  }
}

// Esegui lo script
checkScrapingStatus(); 