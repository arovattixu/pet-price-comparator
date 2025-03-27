#!/bin/bash

# Script per eseguire tutti i test e inizializzare il database

# Colori per output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== INIZIO TEST DEL SISTEMA DI CONFRONTO AVANZATO ===${NC}\n"

# Verifica che il server sia in esecuzione
echo -e "${YELLOW}Verifico che il server sia in esecuzione...${NC}"
if curl -s http://localhost:3001/api/health > /dev/null; then
  echo -e "${GREEN}Server in esecuzione. Procedo con i test.${NC}\n"
else
  echo -e "${YELLOW}Server non rilevato. Avvio server in background...${NC}"
  node src/index-minimal.js > /dev/null 2>&1 &
  SERVER_PID=$!
  echo -e "${GREEN}Server avviato con PID: ${SERVER_PID}${NC}"
  echo "Attendo 5 secondi per l'inizializzazione..."
  sleep 5
fi

# 1. Test del normalizzatore di prezzi (funzionalità di base)
echo -e "\n${BLUE}1. Test del normalizzatore di prezzi${NC}"
echo -e "${YELLOW}Eseguo test di estrazione peso e calcolo prezzo unitario...${NC}"
node src/scripts/testPriceNormalizer.js
if [ $? -eq 0 ]; then
  echo -e "${GREEN}Test del normalizzatore di prezzi completato con successo.${NC}"
else
  echo -e "${RED}Test del normalizzatore di prezzi fallito.${NC}"
  exit 1
fi

# 2. Popolamento gruppi di prodotti
echo -e "\n${BLUE}2. Popolamento gruppi di prodotti${NC}"
echo -e "${YELLOW}Eseguo script di popolazione gruppi di prodotti...${NC}"
node src/scripts/populateProductGroups.js
if [ $? -eq 0 ]; then
  echo -e "${GREEN}Popolamento gruppi di prodotti completato con successo.${NC}"
else
  echo -e "${RED}Popolamento gruppi di prodotti fallito.${NC}"
  exit 1
fi

# 3. Test delle API avanzate
echo -e "\n${BLUE}3. Test delle API avanzate${NC}"
echo -e "${YELLOW}Eseguo test delle API di confronto avanzato...${NC}"
node src/scripts/testAdvancedCompareApi.js
if [ $? -eq 0 ]; then
  echo -e "${GREEN}Test delle API avanzate completato con successo.${NC}"
else
  echo -e "${RED}Test delle API avanzate fallito.${NC}"
  exit 1
fi

echo -e "\n${GREEN}=== TUTTI I TEST COMPLETATI CON SUCCESSO ===${NC}"
echo -e "${BLUE}Il sistema di confronto avanzato è pronto all'uso.${NC}"
echo -e "${YELLOW}Puoi accedere alle API avanzate tramite:${NC}"
echo -e "  - GET /api/advanced-compare/unit-prices/:productId"
echo -e "  - GET /api/advanced-compare/best-value/:brand/:category?"
echo -e "  - GET /api/advanced-compare/sizes?namePattern=Text"
echo -e "  - POST /api/advanced-compare/update-unit-prices"

# Se abbiamo avviato il server, chiediamo se chiuderlo
if [ ! -z "$SERVER_PID" ]; then
  echo -e "\n${YELLOW}Vuoi arrestare il server avviato? (s/n)${NC}"
  read answer
  if [ "$answer" = "s" ]; then
    kill $SERVER_PID
    echo -e "${GREEN}Server arrestato.${NC}"
  else
    echo -e "${GREEN}Server lasciato in esecuzione con PID: ${SERVER_PID}${NC}"
  fi
fi

exit 0 