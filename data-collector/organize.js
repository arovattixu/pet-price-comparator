/**
 * Script di organizzazione della cartella data-collector
 * Questo script sposta tutti i file nelle rispettive cartelle
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Mappa dei file da spostare
const fileMapping = [
  // Importatori
  { from: 'import-products-from-json.js', to: 'scripts/importers/' },
  { from: 'import-products-from-json-improved.js', to: 'scripts/importers/' },
  { from: 'import-all-products.js', to: 'scripts/importers/' },
  { from: 'import-all-json-files.js', to: 'scripts/importers/' },
  
  // Utility
  { from: 'analyze-json-structure.js', to: 'scripts/utils/' },
  { from: 'extract-arcaplanet-categories.js', to: 'scripts/utils/' },
  { from: 'test-analyze-json.js', to: 'scripts/utils/' },
  
  // Manutenzione
  { from: 'check-import.js', to: 'scripts/maintenance/' },
  { from: 'check-db.js', to: 'scripts/maintenance/' },
  { from: 'check-product-details.js', to: 'scripts/maintenance/' },
  { from: 'fix-product-source.js', to: 'scripts/maintenance/' },
  { from: 'fix-categories.js', to: 'scripts/maintenance/' },
  { from: 'remove-problematic-product.js', to: 'scripts/maintenance/' },
  { from: 'cleanup.js', to: 'scripts/maintenance/' },
  { from: 'check-import-progress.js', to: 'scripts/maintenance/' },
  
  // Validation
  { from: 'check-data-quality.js', to: 'scripts/validation/' },
  { from: 'check-data-compatibility.js', to: 'scripts/validation/' },
  { from: 'verify-json-quality.js', to: 'scripts/validation/' },

  // Scraping
  { from: 'check-zooplus-scraping.js', to: 'scripts/scraping/' },
  
  // Test
  { from: 'test-arcaplanet.js', to: 'tests/' },
  { from: 'test-zooplus.js', to: 'tests/' },
  { from: 'test-enhanced-scraper.js', to: 'tests/' },
  { from: 'test-final-validation.js', to: 'tests/' }, 
  { from: 'test-fix-duplicates.js', to: 'tests/' },
  { from: 'test-arcaplanet-improved-scraper.js', to: 'tests/' },
  
  // Reports
  { from: 'data-compatibility-report.json', to: 'reports/' },
  { from: 'summary.md', to: 'reports/' },
  
  // Dati temporanei
  { from: 'arcaplanet-datastructured.json', to: 'tmp/' },
  { from: 'arcaplanet-improved-products.json', to: 'tmp/' },
  { from: 'test-validation-no-duplicates.json', to: 'tmp/' },
  { from: 'test-fix-duplicates-results.json', to: 'tmp/' },
  
  // Immagini e screenshot
  { from: 'arcaplanet-debug.png', to: 'tmp/' },
  { from: 'arcaplanet-screenshot.png', to: 'tmp/' },
  
  // Dati
  { from: 'arcaplanet_scraper_results_*.json', to: 'data/' },
  { from: 'arcaplanet_products_*.json', to: 'data/' },
  { from: 'arcaplanet_api_data_*.json', to: 'data/' },
  { from: 'arcaplanet_*.html', to: 'data/' },
  { from: 'arcaplanet_*.png', to: 'data/' },
  { from: 'zooplus-*.png', to: 'data/' }
];

function organizeFiles() {
  console.log('Inizia organizzazione dei file...');
  
  // Crea le cartelle se non esistono
  const directories = [
    'scripts/importers',
    'scripts/utils',
    'scripts/maintenance',
    'scripts/validation',
    'scripts/scraping',
    'tests',
    'data',
    'backups',
    'tmp',
    'reports'
  ];
  
  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      console.log(`Creazione directory ${dir}...`);
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  // Sposta i file
  let movedFiles = 0;
  
  fileMapping.forEach(mapping => {
    const fromGlob = mapping.from;
    const toDir = mapping.to;
    
    if (fromGlob.includes('*')) {
      // Caso pattern glob
      try {
        const cmd = `find . -maxdepth 1 -name "${fromGlob}" -type f -not -path "./node_modules/*" -not -path "./scripts/*" -not -path "./tests/*" -not -path "./data/*"`;
        const files = execSync(cmd).toString().trim().split('\n');
        
        files.forEach(filePath => {
          if (filePath && filePath !== '') {
            const fileName = path.basename(filePath);
            moveFile(fileName, toDir);
            movedFiles++;
          }
        });
      } catch (error) {
        console.error(`Errore nel trovare i file con pattern ${fromGlob}:`, error.message);
      }
    } else {
      // Caso file specifico
      if (fs.existsSync(fromGlob)) {
        moveFile(fromGlob, toDir);
        movedFiles++;
      }
    }
  });
  
  console.log(`\nOrganizzazione completata! ${movedFiles} file spostati.`);
  console.log('\nSuggerimento: esegui ora questi script dalla loro nuova posizione:');
  console.log('- node scripts/importers/import-all-json-files.js');
  console.log('- node scripts/maintenance/check-db.js');
  console.log('- node scripts/validation/check-data-quality.js');
}

function moveFile(fromPath, toDir) {
  try {
    const fileName = path.basename(fromPath);
    const destPath = path.join(toDir, fileName);
    
    // Se il file esiste già nella destinazione, verificare se è più recente
    if (fs.existsSync(destPath)) {
      const sourceStats = fs.statSync(fromPath);
      const destStats = fs.statSync(destPath);
      
      if (sourceStats.mtime <= destStats.mtime) {
        console.log(`Skipping ${fromPath}: il file di destinazione è più recente o uguale`);
        return;
      }
    }
    
    // Sposta il file (in realtà lo copia e poi elimina l'originale)
    fs.copyFileSync(fromPath, destPath);
    fs.unlinkSync(fromPath);
    console.log(`Spostato: ${fromPath} -> ${destPath}`);
  } catch (error) {
    console.error(`Errore nello spostamento di ${fromPath}:`, error.message);
  }
}

// Esegui organizzazione
organizeFiles(); 