# Pet Price Comparator Backend

Backend API per il comparatore di prezzi di prodotti per animali domestici. Questa API fornisce funzionalità per il confronto dei prezzi, analisi dei trend, avvisi di prezzo e offerte speciali.

## Tecnologie

- Node.js
- Express
- MongoDB
- Redis (caching)
- Swagger (documentazione API)

## Funzionalità Principali

### Prodotti e Prezzi
- Ricerca prodotti 
- Dettagli prodotto
- Storico prezzi
- Filtraggio per categoria, marca, tipo di animale

### Confronto Prezzi
- Confronto diretto tra prodotti simili
- Confronto tra diverse fonti per lo stesso prodotto
- Analisi risparmio

### Offerte e Deals
- Migliori offerte per categoria
- Prodotti in promozione
- Maggiori riduzioni di prezzo
- Offerte trending

### Trend e Analisi
- Storico dei prezzi con grafici
- Previsioni di prezzo
- Trend per categoria
- Trend per negozio/fonte

### Avvisi di Prezzo
- Creazione avvisi personalizzati
- Notifiche quando il prezzo scende sotto una soglia
- Notifiche per cambiamenti significativi di prezzo

## Funzionalità di Confronto Avanzato dei Prezzi

Il sistema ora include funzionalità robuste e ottimizzate per il confronto avanzato dei prezzi che permettono di:

1. **Calcolare il prezzo unitario** (prezzo per kg) per confrontare prodotti con diverse dimensioni
2. **Raggruppare prodotti simili** con diverse dimensioni di confezione
3. **Identificare il miglior rapporto qualità-prezzo** tra diverse opzioni
4. **Normalizzare automaticamente i pesi** estratti dalle descrizioni dei prodotti

### API di Confronto Avanzato

Le seguenti API sono state implementate e ottimizzate per garantire performance e robustezza:

- **GET /api/advanced-compare/unit-prices/:productId**
  - Confronta un prodotto con prodotti simili, includendo calcoli di prezzo unitario
  - Mostra quale confezione offre il miglior rapporto qualità-prezzo
  - Include gestione errori migliorata e validazione dei dati

- **GET /api/advanced-compare/best-value/:brand/:category?**
  - Trova i prodotti con il miglior rapporto qualità-prezzo per un brand e categoria
  - Opzionalmente filtra per categoria
  - Ordina i risultati per convenienza (prezzo per kg)

- **GET /api/advanced-compare/sizes?namePattern=Text**
  - Confronta diverse dimensioni di prodotti simili per trovare il miglior valore
  - Cerca prodotti per nome e li raggruppa per brand
  - Gestisce correttamente prodotti senza informazioni di peso

- **POST /api/advanced-compare/update-unit-prices**
  - Aggiorna i prezzi unitari per tutti i prodotti (endpoint amministrativo)
  - Esegue calcoli in batch con gestione ottimizzata della memoria

- **POST /api/advanced-compare/update-product-groups**
  - Aggiorna i gruppi di prodotti basati sulle relazioni di similarità
  - Facilita aggiornamenti periodici del database

### Miglioramenti Implementati

I seguenti miglioramenti sono stati implementati per rendere il sistema più robusto:

1. **Gestione errori avanzata**
   - Validazione completa dei dati di input in tutti i moduli
   - Gestione delle eccezioni con messaggi di errore descrittivi
   - Logging dettagliato per facilitare il debug

2. **Ottimizzazione delle prestazioni**
   - Caching delle richieste frequenti
   - Query al database ottimizzate
   - Elaborazione asincrona per operazioni pesanti

3. **Normalizzazione robusta dei pesi**
   - Algoritmo migliorato per l'estrazione dei pesi da stringhe di testo
   - Supporto per vari formati (es. "2kg", "400g", "2x100g")
   - Conversione automatica in unità standard per confronti equi

4. **Algoritmo di similarità avanzato**
   - Miglioramento del riconoscimento di prodotti simili con dimensioni diverse
   - Prevenzione di falsi positivi nei raggruppamenti
   - Filtraggio intelligente dei risultati

### Modelli di Dati Avanzati

I seguenti modelli di dati sono stati implementati o migliorati:

1. **Product** - Aggiunto supporto per:
   - Prezzi unitari con timestamp di calcolo
   - Informazioni dettagliate sul packaging
   - Collegamenti ai gruppi di prodotti simili

2. **ProductGroup** - Nuovo modello per:
   - Raggruppare varianti dello stesso prodotto
   - Tracciare il miglior valore nel gruppo
   - Mantenere statistiche aggregate sui range di prezzo

### Script di Utilità

Sono stati aggiunti i seguenti script di utilità:

- **src/scripts/populateProductGroups.js**
  - Analizza i prodotti esistenti e li raggruppa per nome base
  - Estrae informazioni su dimensioni/peso
  - Crea gruppi di prodotti con varianti di dimensione

- **src/scripts/testPriceNormalizer.js**
  - Testa le funzionalità di estrazione del peso e calcolo del prezzo unitario
  - Verifica il corretto funzionamento del gruppo di prodotti simili

- **src/scripts/testAdvancedCompareApi.js**
  - Testa le API di confronto avanzato con vari casi d'uso

- **src/scripts/runTests.sh**
  - Script completo per testare tutte le funzionalità di confronto avanzato

### Come Eseguire i Test

Per testare le nuove funzionalità:

```bash
# Rendi eseguibile lo script
chmod +x src/scripts/runTests.sh

# Esegui tutti i test
./src/scripts/runTests.sh
```

## Struttura Progetto

```
backend/
├── src/                      # Codice sorgente principale
│   ├── api/                  # API endpoints
│   │   ├── controllers/      # Logica dei controller
│   │   ├── models/           # Modelli dati
│   │   └── routes/           # Definizione delle rotte
│   ├── middleware/           # Middleware personalizzati
│   ├── utils/                # Utility e helpers
│   │   ├── cache.js          # Utility per Redis caching
│   │   └── logger.js         # Configurazione logger
│   ├── jobs/                 # Job schedulati
│   ├── app.js                # Configurazione Express
│   └── index.js              # Entry point
├── tests/                    # Test e file di test
├── scripts/                  # Script di utilità
├── logs/                     # File di log
├── node_modules/             # Dipendenze (generato automaticamente)
├── package.json              # Configurazione progetto e dipendenze
├── package-lock.json         # Lock file delle dipendenze
├── .env                      # Variabili d'ambiente (non versionato)
└── .env.example              # Esempio di configurazione variabili d'ambiente
```

## API Endpoints

### Base
- `GET /` - Informazioni di base sull'API
- `GET /health` - Health check dell'API e del database

### Prodotti
- `GET /api/products` - Lista prodotti con paginazione e filtri
- `GET /api/products/:id` - Dettagli prodotto
- `GET /api/products/:id/compare` - Confronto prezzi tra fonti
- `GET /api/products/:productId/price-history` - Storico prezzi di un prodotto
- `GET /api/products/similar` - Ricerca prodotti simili
- `GET /api/products/categories/all` - Elenco categorie
- `GET /api/products/brands/all` - Elenco brand
- `GET /api/products/deals/best` - Prodotti con miglior risparmio

### Confronto
- `GET /api/compare/similar/:productId` - Prodotti simili
- `GET /api/compare/savings/:productId` - Calcolo risparmio

### Offerte (Deals)
- `GET /api/deals/best` - Migliori offerte
- `GET /api/deals/best/:petType` - Migliori offerte per tipo animale
- `GET /api/deals/trending` - Offerte trending
- `GET /api/deals/price-drops` - Maggiori riduzioni di prezzo
- `GET /api/deals/category/:category` - Offerte per categoria
- `GET /api/deals/brand/:brand` - Offerte per brand

### Trend
- `GET /api/trends/price-history/:productId` - Storico prezzi dettagliato
- `GET /api/trends/pet-type/:petType` - Trend per tipo animale
- `GET /api/trends/category/:category` - Trend per categoria
- `GET /api/trends/store/:store` - Trend per negozio
- `GET /api/trends/brand/:brand` - Trend per brand
- `GET /api/trends/compare` - Confronto trend tra prodotti

### Avvisi (PriceAlert)
- Gestione avvisi di prezzo
- Notifiche automatiche

## Configurazione

1. Clonare il repository
2. Creare un file `.env` basato su `.env.example`
3. Installare le dipendenze: `npm install`
4. Avviare il server: `npm start`

## Sviluppo

- `npm run dev` - Avvia il server in modalità sviluppo con hot reload
- `npm test` - Esegue i test

## Documentazione API

La documentazione API è disponibile all'indirizzo `/api-docs` una volta avviato il server.

## Caching

L'API utilizza Redis per il caching, migliorando significativamente le performance per le query più frequenti.

## Jobs Schedulati

Il backend include diversi job automatizzati:
- Aggiornamento dati prodotti e cache
- Calcolo trend e analytics
- Invio notifiche per avvisi di prezzo
- Refresh cache per dati frequentemente acceduti
- Pulizia dati obsoleti
- Aggiornamento periodico dei prezzi unitari e gruppi di prodotti 