# Importatori per il Database

Questa cartella contiene gli script per l'importazione dei dati raccolti dagli scraper nel database MongoDB.

## Script Principali

### `import-prices-to-db.js`

Questo script è responsabile dell'aggiornamento periodico dei dati sui prezzi nel database. Legge i file JSON prodotti dagli scraper e aggiorna il database MongoDB con i dati più recenti.

**Funzionalità principali**:
- Legge i file JSON dalla cartella `results/` (suddivisi per fonte)
- Aggiorna i prodotti esistenti o ne crea di nuovi
- Registra i punti prezzo per tracciare lo storico dei prezzi
- Gestisce varianti e prezzi in modo appropriato

**Utilizzo**:
```bash
# Esecuzione diretta
node scripts/importers/import-prices-to-db.js

# Tramite script di automazione
node scripts/run-db-import.js
```

**Configurazione**:
Lo script utilizza le seguenti variabili d'ambiente (definite nel file `.env`):
- `MONGODB_URI`: URL di connessione al database MongoDB
- `RESULTS_DIR`: Percorso della directory dei risultati (default: `./results`)
- `BACKEND_PATH`: Percorso della directory del backend (per accedere ai modelli)

### `run-db-import.js`

Script wrapper che può essere configurato come cron job per eseguire l'importazione periodicamente.

**Configurazione come cron job**:

Aggiungi al crontab il seguente comando per eseguire l'importazione alle 2:00 AM ogni giorno:
```
0 2 * * * cd /path/to/data-collector && node scripts/run-db-import.js >> logs/import.log 2>&1
```

## Modifica dell'architettura

Questo script è stato spostato dal backend al data-collector per migliorare la separazione delle responsabilità:
- Il **data-collector** ora gestisce sia lo scraping che l'importazione nel database
- Il **backend** si concentra esclusivamente sulla fornitura di API e sulla logica di business

### Vantaggi della nuova architettura:
- Separazione più netta delle responsabilità
- Il backend non dipende più dalla posizione dei file del data-collector
- Maggiore coesione tra le funzionalità correlate
- Scalabilità e manutenibilità migliorate

## Dipendenze

Lo script richiede i seguenti modelli:
- `Product`: per gestire i prodotti nel database
- `PricePoint`: per tracciare lo storico dei prezzi

Se possibile, i modelli vengono importati dal backend (tramite il percorso specificato in `BACKEND_PATH`), altrimenti si tenta di utilizzare i modelli locali. 