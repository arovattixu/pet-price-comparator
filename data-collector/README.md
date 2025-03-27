# Data Collector per Pet Price Compare

Questo componente è responsabile della raccolta dati dai siti e-commerce di prodotti per animali domestici e del loro inserimento nel database.

## Struttura del progetto

```
data-collector/
├── collect.js              # Script principale per la raccolta dati
├── results/                # Directory dove vengono salvati i risultati dello scraping
│   ├── arcaplanet/         # Risultati da Arcaplanet
│   └── zooplus/            # Risultati da Zooplus
├── scripts/                # Script utili
│   ├── importers/          # Moduli di importazione
│   │   └── batch-import.js # Modulo per l'importazione batch
│   ├── import-prices-batch.js # Script di importazione batch
│   ├── check-import-status.js # Script per verificare lo stato dell'importazione
│   └── migrate-pet-types.js   # Script per migrare i tipi di animale
└── logs/                   # Directory per i log
```

## Flusso di funzionamento

1. **Raccolta dati**: Il processo inizia con l'esecuzione dello script `collect.js` che si occupa dello scraping dei dati dai siti e-commerce. I risultati vengono salvati nella directory `results` in file JSON separati per categoria.

2. **Importazione dei dati**: Dopo la raccolta, lo script `import-prices-batch.js` si occupa di importare i dati nel database MongoDB. Questo script utilizza un approccio batch per migliorare le prestazioni e ridurre il carico sul database.

3. **Monitoraggio**: Lo script `check-import-status.js` può essere eseguito in qualsiasi momento per verificare lo stato dell'importazione e ottenere statistiche sui dati importati.

## Installazione e configurazione

### Prerequisiti
- Node.js >= 14.x
- MongoDB
- Accesso al database MongoDB specificato nel file `.env`

### Configurazione
Crea un file `.env` nella root del progetto con i seguenti parametri:

```
MONGODB_URI=mongodb+srv://username:password@host/database?retryWrites=true&w=majority
RESULTS_DIR=/path/to/results/directory  # opzionale, default: ./results
```

### Installazione dipendenze
```bash
npm install
```

## Utilizzo

### Raccolta dati
```bash
node collect.js
```

### Importazione dati
```bash
node scripts/import-prices-batch.js
```

### Verificare lo stato dell'importazione
```bash
node scripts/check-import-status.js
```

### Assegnare i tipi di animale
```bash
node scripts/migrate-pet-types.js
```

## Automazione con cron

Per automatizzare il processo di raccolta e importazione dei dati, è possibile utilizzare il file `crontab.txt` fornito:

```bash
# Installare il crontab
crontab crontab.txt
```

Il crontab è configurato per:
- Eseguire lo scraping ogni giorno alle 1:00 AM
- Importare i dati nel database ogni giorno alle 2:00 AM

## Risoluzione dei problemi

### Timeout durante l'importazione
Se si verificano timeout durante l'importazione di grandi quantità di dati:
1. Ridurre la dimensione del batch modificando la costante `BATCH_SIZE` nel file `scripts/importers/batch-import.js`
2. Aumentare i timeout di connessione MongoDB nel file di importazione
3. Eseguire l'importazione in momenti di minor carico sul server

### Errori di connessione al database
Verificare che il `MONGODB_URI` nel file `.env` sia corretto e che le credenziali siano valide.

## Contribuire
Per contribuire al progetto:
1. Forka il repository
2. Crea un branch per la tua feature (`git checkout -b feature/amazing-feature`)
3. Commit delle modifiche (`git commit -m 'Aggiunta una funzionalità incredibile'`)
4. Push al branch (`git push origin feature/amazing-feature`)
5. Apri una Pull Request