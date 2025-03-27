/**
 * Script centralizzato per l'amministrazione del sistema
 * Permette di eseguire tutte le operazioni di importazione e manutenzione
 * da un unico punto di accesso
 */

require('dotenv').config();
const { exec } = require('child_process');
const path = require('path');
const logger = require('../src/utils/logger');
const readline = require('readline');

// Crea un'interfaccia readline per l'input dell'utente
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Funzione per eseguire un comando e restituire una Promise
function executeCommand(command) {
  return new Promise((resolve, reject) => {
    logger.info(`Esecuzione comando: ${command}`);
    
    const child = exec(command, { cwd: path.resolve(__dirname, '..') });
    
    child.stdout.on('data', (data) => {
      process.stdout.write(data);
    });
    
    child.stderr.on('data', (data) => {
      process.stderr.write(data);
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Il comando è terminato con codice di uscita ${code}`));
      }
    });
  });
}

// Funzione per chiedere conferma all'utente
function askConfirmation(question) {
  return new Promise((resolve) => {
    rl.question(`${question} (s/n): `, (answer) => {
      resolve(answer.toLowerCase() === 's' || answer.toLowerCase() === 'si');
    });
  });
}

// Opzioni disponibili
const options = [
  {
    id: 1,
    name: 'Importa tutti i prodotti',
    command: 'node scripts/importers/import-all-products.js',
  },
  {
    id: 2,
    name: 'Importa prodotti da JSON specifico',
    action: async () => {
      const jsonFile = await new Promise((resolve) => {
        rl.question('Inserisci il percorso del file JSON: ', (answer) => {
          resolve(answer);
        });
      });
      
      const dryRun = await askConfirmation('Eseguire in modalità dry-run?');
      const dryRunFlag = dryRun ? '--dry-run' : '';
      
      return executeCommand(`node scripts/importers/import-products-from-json-improved.js ${jsonFile} ${dryRunFlag}`);
    }
  },
  {
    id: 3,
    name: 'Verifica stato database',
    command: 'node scripts/maintenance/check-db.js',
  },
  {
    id: 4,
    name: 'Verifica dettagli prodotto',
    command: 'node scripts/maintenance/check-product-details.js',
  },
  {
    id: 5,
    name: 'Ripara prodotti con immagini mancanti',
    action: async () => {
      const dryRun = await askConfirmation('Eseguire in modalità dry-run?');
      const dryRunFlag = dryRun ? '--dry-run' : '';
      
      const limit = await new Promise((resolve) => {
        rl.question('Limite di prodotti da elaborare (0 per tutti): ', (answer) => {
          resolve(parseInt(answer) || 0);
        });
      });
      
      const limitFlag = limit > 0 ? `--limit ${limit}` : '';
      
      const source = await new Promise((resolve) => {
        rl.question('Filtra per fonte (lascia vuoto per tutte): ', (answer) => {
          resolve(answer.trim());
        });
      });
      
      const sourceFlag = source ? `--source ${source}` : '';
      
      return executeCommand(`node scripts/maintenance/repair-missing-images.js ${dryRunFlag} ${limitFlag} ${sourceFlag}`);
    }
  },
  {
    id: 6,
    name: 'Esci',
    action: () => {
      rl.close();
      process.exit(0);
    }
  }
];

// Funzione principale
async function main() {
  console.log('\n===== STRUMENTI DI AMMINISTRAZIONE =====\n');
  
  while (true) {
    console.log('Operazioni disponibili:');
    options.forEach(option => {
      console.log(`${option.id}. ${option.name}`);
    });
    
    const choice = await new Promise((resolve) => {
      rl.question('\nSeleziona un\'opzione (1-6): ', (answer) => {
        resolve(parseInt(answer));
      });
    });
    
    const selectedOption = options.find(option => option.id === choice);
    
    if (!selectedOption) {
      console.log('Opzione non valida. Riprova.');
      continue;
    }
    
    try {
      if (selectedOption.command) {
        const confirmation = await askConfirmation(`Confermi di voler eseguire: ${selectedOption.name}?`);
        if (confirmation) {
          await executeCommand(selectedOption.command);
        }
      } else if (selectedOption.action) {
        await selectedOption.action();
      }
      
      if (selectedOption.id !== 6) {
        console.log('\nOperazione completata.');
        await new Promise((resolve) => {
          rl.question('\nPremi Enter per continuare...', () => {
            console.log('\n');
            resolve();
          });
        });
      }
    } catch (error) {
      logger.error(`Si è verificato un errore: ${error.message}`);
      console.log('\nSi è verificato un errore durante l\'esecuzione dell\'operazione.');
      await new Promise((resolve) => {
        rl.question('\nPremi Enter per continuare...', () => {
          console.log('\n');
          resolve();
        });
      });
    }
  }
}

// Avvia lo script
if (require.main === module) {
  main().catch(error => {
    logger.error(`Errore fatale: ${error.message}`);
    rl.close();
    process.exit(1);
  });
} 