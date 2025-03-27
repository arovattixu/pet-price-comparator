# Documentazione Struttura Progetto Data Collector

Questo documento fornisce una panoramica dettagliata della struttura del progetto `data-collector`, descrivendo lo scopo di ciascuna cartella e file principale.

## Struttura Generale

Il progetto `data-collector` è organizzato nelle seguenti cartelle principali:

- `/src`: Codice sorgente principale dell'applicazione
- `/scripts`: Script operativi per varie funzionalità
- `/results`: Output organizzati degli scraper
- `/data`: Dati raccolti e file JSON temporanei
- `/backups`: Backup del database
- `/logs`: File di log delle operazioni
- `/tests`: Script di test
- `/config`: File di configurazione
- `/node_modules`: Dipendenze Node.js

## Cartelle e File Principali

### `/src` - Codice Sorgente

Contiene il codice core dell'applicazione, organizzato in sottocartelle per funzionalità:

- `/src/models`: Definizioni dei modelli di dati per MongoDB
  - `product.js`: Schema del prodotto
  - `price-point.js`: Schema del punto prezzo

- `/src/utils`: Utility condivise
  - `logger.js`: Configurazione del sistema di logging

- `/src/scrapers`: Implementazione degli scraper
  - `base-scraper.js`: Classe base con funzionalità comuni per tutti gli scraper
  - `arcaplanet-scraper.js`: Implementazione dello scraper per Arcaplanet
  - `arcaplanet.js`: Orchestrazione dello scraping di Arcaplanet
  - `zooplus-scraper.js`: Implementazione dello scraper per Zooplus
  - `zooplus.js`: Orchestrazione dello scraping di Zooplus
  - `index.js`: Punto di ingresso che configura e avvia tutti gli scraper
  - `categories.js`: Definizione delle categorie di prodotti da scrapare (aggiornato recentemente con nuovi URL)

- `/src/services`: Servizi per l'applicazione

- `/src/proxy`: Gestione dei proxy

- `/src/queue`: Gestione delle code per le operazioni di scraping

- `/src/index.js`: Punto di ingresso principale dell'applicazione

### `/scripts` - Script Operativi

Contiene script per operazioni di importazione, manutenzione e analisi:

- `/scripts/importers`: Script per l'importazione di dati
  - `batch-import.js`: **NUOVO** - Importatore batch ottimizzato che utilizza operazioni dirette MongoDB
  - `import-prices-to-db.js`: **NUOVO** - Importatore per aggiornare i prezzi nel database
  - `import-products-from-json-improved.js`: Importatore JSON avanzato con rilevamento automatico della fonte
  - `import-all-products.js`: Script per importare tutti i file JSON in batch
  - `import-all-json-files.js`: Importatore ottimizzato che processa tutti i file JSON in una directory

- `/scripts/import-prices-batch.js`: **NUOVO** - Script wrapper per l'importazione batch che richiama batch-import.js

- `/scripts/check-import-status.js`: **NUOVO** - Script per verificare lo stato dell'importazione con statistiche dettagliate

- `/scripts/migrate-pet-types.js`: **NUOVO** - Script per assegnare correttamente i tipi di animali ai prodotti

- `/scripts/find-similar-products.js`: **NUOVO** - Script per trovare prodotti simili tra diverse fonti

- `/scripts/populate-similar-products.js`: **NUOVO** - Script per popolare la tabella dei prodotti simili nel database

- `/scripts/test-db-connection.js`: **NUOVO** - Script per testare la connessione al database

- `/scripts/maintenance`: Script per manutenzione e correzione del database
  - `check-db.js`: Verifica lo stato generale del database
  - `check-import.js`: Verifica lo stato di un'importazione
  - `check-import-progress.js`: Monitora in tempo reale lo stato di avanzamento dell'importazione
  - `check-product-details.js`: Analizza i dettagli di un prodotto specifico
  - `create-backup.js`: Crea backup manuali del database
  - `fix-product-source.js`: Corregge la fonte di prodotti errati
  - `fix-categories.js`: Normalizza e corregge le categorie dei prodotti
  - `fix-duplicates.js`: Identifica e risolve duplicati nei dati
  - `remove-problematic-product.js`: Rimuove prodotti problematici
  - `repair-missing-images.js`: Ripara prodotti con immagini mancanti
  - `cleanup.js`: Pulisce file temporanei e dati di debug

- `/scripts/scraping`: Script per l'avvio e il monitoraggio degli scraper
  - `run-zooplus-scraper.js`: Avvia lo scraping di Zooplus
  - `check-zooplus-scraping.js`: Monitora lo stato dell'operazione di scraping su Zooplus

- `/scripts/validation`: Script per validazione e controllo qualità dei dati
  - `check-data-quality.js`: Verifica la qualità dei dati raccolti
  - `check-data-compatibility.js`: Controlla la compatibilità dei dati con lo schema del database
  - `verify-json-quality.js`: Verifica la correttezza dei file JSON

- `/scripts/utils`: Utility e strumenti di analisi
  - `analyze-json-structure.js`: Analizza la struttura dei file JSON
  - `extract-arcaplanet-categories.js`: Estrae le categorie di prodotti da Arcaplanet
  - `test-analyze-json.js`: Analizza la struttura dei dati raccolti

- `/scripts/admin-tools.js`: Interfaccia centralizzata per eseguire le operazioni di manutenzione

### `/results` - Output degli Scraper

Contiene i dati raccolti dagli scraper, organizzati per fonte:

- `/results/arcaplanet`: Dati raccolti da Arcaplanet
- `/results/zooplus`: Dati raccolti da Zooplus, inclusi i file JSON delle nuove categorie aggiunte

### `/data` - Dati Temporanei

Contiene file JSON, screenshot e altro materiale raccolto durante lo scraping che non è ancora stato processato.

### `/backups` - Backup

Contiene backup del database prima delle operazioni di importazione massiva, generati automaticamente con timestamp.

### `/logs` - Log

Contiene i file di log delle operazioni dell'applicazione, inclusi log di importazione batch, scraping, e analisi prodotti simili.

### `/tests` - Test

Contiene script per testare le funzionalità dell'applicazione:

- `test-arcaplanet.js`: Script di test per Arcaplanet
- `test-zooplus.js`: Script di test per Zooplus
- `test-fix-duplicates.js`: Test per la rimozione dei duplicati
- `test-final-validation.js`: Validazione finale dei dati
- `test-enhanced-scraper.js`: Test dello scraper migliorato

### `/config` - Configurazione

Contiene file di configurazione per l'applicazione.

## File di Configurazione

- `.env`: Configurazioni sensibili dell'ambiente (non tracciato in git)
- `.env.example`: Esempio di file di configurazione
- `package.json`: Definizione delle dipendenze npm e script
- `.eslintrc.js`: Configurazione ESLint per lo stile del codice
- `.prettierrc`: Configurazione Prettier per la formattazione
- `crontab.txt`: **NUOVO** - Configurazione dei cron job per automazione delle operazioni

## Script di Utilità

- `organize.js`: Script per organizzare la struttura del progetto (sposta i file nelle cartelle appropriate)

## File di Monitoraggio e Reportistica

- `/reports/data-compatibility-report.json`: Report dettagliato sulla compatibilità dei dati
- `/reports/summary.md`: Riepilogo delle operazioni di scraping e importazione

## Documenti di Processo

- `PROJECT_CHECKLIST.md`: Checklist pre-implementazione da consultare prima di ogni modifica
  - Contiene verifiche per garantire l'allineamento con l'obiettivo principale
  - Fornisce promemoria per il controllo della codebase
  - Include verifiche sulla qualità dei dati e l'efficienza tecnica
  - Serve come guida per mantenere il focus sulla creazione di un comparatore prezzi efficiente
- `README.md`: **AGGIORNATO** - Documentazione completa del flusso di lavoro con i nuovi script

## Flusso di Lavoro Ottimizzato (NUOVO)

Il flusso di lavoro è stato ottimizzato per migliorare le prestazioni e l'affidabilità:

1. Gli scraper in `/src/scrapers` raccolgono dati da Arcaplanet e Zooplus
2. I dati raccolti vengono salvati in file JSON nella cartella `/results`
3. Lo script `import-prices-batch.js` importa i dati con operazioni batch dirette su MongoDB
4. Lo script `migrate-pet-types.js` assegna correttamente le categorie di animali
5. Lo script `populate-similar-products.js` crea e mantiene relazioni tra prodotti simili
6. Lo script `check-import-status.js` verifica lo stato e fornisce statistiche

Questo nuovo flusso di lavoro **sostituisce** il precedente approccio basato su Mongoose utilizzato nel backend, offrendo:
- Migliori prestazioni con operazioni batch
- Maggiore affidabilità con gestione errori migliorata
- Maggiore separazione delle responsabilità (data-collector vs. backend)
- Automazione completa tramite cron jobs

## Comandi Principali (AGGIORNATI)

```bash
# Avviare l'applicazione
npm start

# Avviare in modalità sviluppo con ricaricamento automatico
npm run dev

# Avviare lo scraping completo
node collect.js

# Importare tutti i dati nel database (nuovo metodo batch)
node scripts/import-prices-batch.js

# Controllare lo stato dell'importazione
node scripts/check-import-status.js

# Assegnare i tipi di animale ai prodotti
node scripts/migrate-pet-types.js

# Trovare prodotti simili
node scripts/find-similar-products.js

# Popolare la tabella dei prodotti simili
node scripts/populate-similar-products.js

# Installare i cron job
crontab crontab.txt
```

## Note Tecniche (AGGIORNATE)

- Il progetto utilizza MongoDB come database
- Gli scraper sono basati su Puppeteer per l'estrazione dati
- Le operazioni di importazione utilizzano ora operazioni dirette MongoDB per migliori prestazioni
- L'identificazione di prodotti simili utilizza algoritmi di similarità Jaccard
- La migrazione dei dati è gestita tramite operazioni batch
- L'automazione completa è gestita tramite cron jobs
- I backup vengono generati automaticamente prima delle operazioni critiche

## Operazioni Recenti

1. **24/03/2024**: Riorganizzazione dell'architettura di importazione dati
   - Spostata la responsabilità dell'importazione dal backend al data-collector
   - Implementato nuovo sistema batch basato su operazioni dirette MongoDB
   - Creata separazione più chiara delle responsabilità tra componenti

2. **24/03/2024**: Implementazione di script per migrazione e analisi dati
   - Creato script per assegnare correttamente i tipi di animale ai prodotti
   - Sviluppato algoritmo di similarità per trovare prodotti simili tra fonti diverse
   - Implementato sistema per popolare e mantenere una tabella di prodotti simili

3. **24/03/2024**: Ottimizzazione delle prestazioni di importazione
   - Ridotta dimensione batch per evitare timeout
   - Aumentati timeout di connessione MongoDB
   - Implementata gestione robusta degli errori con statistiche dettagliate

4. **24/03/2024**: Implementazione di automazione completa
   - Creato file crontab.txt per configurare cron jobs
   - Pianificato scraping alle 1:00 AM
   - Pianificata importazione alle 2:00 AM
   - Pianificato popolamento prodotti simili alle 4:00 AM
   - Pianificato controllo stato database ogni 12 ore

5. **24/03/2024**: Miglioramento monitoraggio e diagnostica
   - Creato script dettagliato per verificare lo stato dell'importazione
   - Implementato script di test per la connessione al database
   - Aggiunta generazione di statistiche complete per tutte le operazioni

6. **23/03/2024**: Completato scraping di 9 nuove categorie Zooplus
   - Raccolti dati di 967 prodotti
   - Importati con successo nel database principale

7. **22/03/2024**: Aggiornamento delle categorie Zooplus con nuovi URL 
   - Aggiornati percorsi per prodotti cani e gatti

8. **22/03/2024**: Implementazione del monitoraggio in tempo reale dello scraping
   - Aggiunto script `check-zooplus-scraping.js` per monitorare lo stato del processo

9. **22/03/2024**: Miglioramento del processo di validazione dati
   - Sviluppati nuovi script per verificare qualità e compatibilità dei dati 