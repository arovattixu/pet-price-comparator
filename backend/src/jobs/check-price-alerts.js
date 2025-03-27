/**
 * Script per il controllo degli avvisi di prezzo
 * Questo script verifica i cambiamenti di prezzo dei prodotti e genera notifiche
 * In produzione, questo script dovrebbe essere eseguito periodicamente tramite un job scheduler (es. cron)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const PriceAlert = require('../db/models/PriceAlert');
const Product = require('../db/models/Product');
const PricePoint = require('../db/models/PricePoint');
const config = require('../config/config');

// In un'applicazione reale, qui potremmo utilizzare un servizio di notifica
// come email, push notification, SMS, ecc.
const NotificationService = {
  async sendPriceNotification(userId, alert, product, oldPrice, newPrice) {
    console.log(`[NOTIFICA] Utente: ${userId}`);
    console.log(`Prodotto: ${product.title}`);
    
    if (alert.variantId) {
      const variant = product.variants.find(v => v.variantId === alert.variantId);
      console.log(`Variante: ${variant?.description || 'N/A'}`);
    }
    
    console.log(`Prezzo precedente: ${oldPrice.toFixed(2)}€`);
    console.log(`Nuovo prezzo: ${newPrice.toFixed(2)}€`);
    
    const priceDiff = oldPrice - newPrice;
    const percentDiff = (priceDiff / oldPrice) * 100;
    
    if (priceDiff > 0) {
      console.log(`Prezzo diminuito di ${priceDiff.toFixed(2)}€ (${percentDiff.toFixed(2)}%)`);
    } else if (priceDiff < 0) {
      console.log(`Prezzo aumentato di ${Math.abs(priceDiff).toFixed(2)}€ (${Math.abs(percentDiff).toFixed(2)}%)`);
    }
    
    console.log('----------------------------------');
    
    // Qui potremmo inviare una notifica email, push, SMS, ecc.
    // Esempio: await emailService.send(userId, 'Cambio prezzo', message);
    
    return true;
  }
};

async function checkPriceAlerts() {
  try {
    // Connessione al database
    await mongoose.connect(config.database.uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connesso al database MongoDB');
    
    // Ottieni tutti gli avvisi attivi
    const alerts = await PriceAlert.find({ isActive: true });
    console.log(`Trovati ${alerts.length} avvisi attivi da controllare`);
    
    let notificationCounter = 0;
    
    // Controlla ogni avviso
    for (const alert of alerts) {
      try {
        // Ottieni il prodotto collegato all'avviso
        const product = await Product.findById(alert.productId);
        if (!product) {
          console.warn(`Prodotto non trovato per l'avviso ID: ${alert._id}`);
          continue;
        }
        
        // Ottieni il prezzo corrente
        let currentPrice = 0;
        
        if (alert.variantId) {
          // Se è specificata una variante, ottieni il prezzo della variante
          const variant = product.variants?.find(v => v.variantId === alert.variantId);
          if (!variant) {
            console.warn(`Variante non trovata per l'avviso ID: ${alert._id}`);
            continue;
          }
          currentPrice = variant.currentPrice?.amount || 0;
        } else {
          // Altrimenti, usa il prezzo più basso
          currentPrice = Math.min(
            ...product.variants?.map(v => v.currentPrice?.amount || Infinity) || [Infinity]
          );
          if (currentPrice === Infinity) currentPrice = 0;
        }
        
        // Se la fonte non corrisponde, salta
        if (alert.source !== 'any' && product.source !== alert.source) {
          continue;
        }
        
        // Se il prezzo è 0, c'è un errore nei dati
        if (currentPrice === 0) {
          console.warn(`Prezzo non valido per l'avviso ID: ${alert._id}`);
          continue;
        }
        
        // Verifica se il prezzo è cambiato
        const oldPrice = alert.currentPrice;
        const priceDifference = oldPrice - currentPrice;
        const percentageChange = (priceDifference / oldPrice) * 100;
        
        // Determina se inviare una notifica
        let shouldNotify = false;
        
        // Caso 1: Il prezzo è sceso sotto il target
        if (alert.targetPrice && currentPrice <= alert.targetPrice && oldPrice > alert.targetPrice) {
          shouldNotify = true;
        }
        
        // Caso 2: Il prezzo è sceso di una certa percentuale
        if (alert.percentageChange && percentageChange >= alert.percentageChange) {
          shouldNotify = true;
        }
        
        // Caso 3: Qualsiasi cambio di prezzo
        if (alert.notifyOnAnyChange && Math.abs(priceDifference) > 0.01) {
          shouldNotify = true;
        }
        
        // Se dobbiamo notificare
        if (shouldNotify) {
          // Invia la notifica
          const notificationSent = await NotificationService.sendPriceNotification(
            alert.userId,
            alert,
            product,
            oldPrice,
            currentPrice
          );
          
          if (notificationSent) {
            // Aggiorna l'avviso con il nuovo prezzo e lo stato della notifica
            alert.currentPrice = currentPrice;
            alert.lastNotified = new Date();
            alert.notificationsSent += 1;
            
            // Se il prezzo è sceso sotto il target, disattiva l'avviso
            if (alert.targetPrice && currentPrice <= alert.targetPrice) {
              alert.isActive = false;
            }
            
            await alert.save();
            
            notificationCounter++;
          }
        } else if (Math.abs(currentPrice - oldPrice) > 0.01) {
          // Se il prezzo è cambiato ma non dobbiamo notificare, aggiorna solo il prezzo corrente
          alert.currentPrice = currentPrice;
          await alert.save();
        }
        
      } catch (alertError) {
        console.error(`Errore nel controllare l'avviso ID: ${alert._id}`, alertError);
      }
    }
    
    console.log(`Controllati ${alerts.length} avvisi, inviate ${notificationCounter} notifiche`);
  } catch (error) {
    console.error('Errore nel controllo degli avvisi di prezzo:', error);
  } finally {
    // Chiudi la connessione al database
    await mongoose.connection.close();
    console.log('Disconnesso dal database MongoDB');
  }
}

// Esegui il controllo
if (require.main === module) {
  // Se il file è eseguito direttamente, esegui il controllo
  checkPriceAlerts()
    .then(() => {
      console.log('Controllo degli avvisi di prezzo completato');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Errore durante l\'esecuzione del controllo:', error);
      process.exit(1);
    });
} else {
  // Altrimenti esporta la funzione per l'uso in altri moduli
  module.exports = checkPriceAlerts;
} 