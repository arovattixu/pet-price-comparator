const mongoose = require('mongoose');

/**
 * Schema per gli avvisi di prezzo
 * Consente agli utenti di impostare notifiche quando il prezzo di un prodotto
 * scende sotto una certa soglia o cambia di una certa percentuale
 */
const PriceAlertSchema = new mongoose.Schema({
  userId: {
    type: String,  // In un'implementazione completa questo sarebbe un riferimento a un modello User
    required: true,
    index: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  variantId: {
    type: String,
    required: false  // Se non specificato, l'avviso si applica a qualsiasi variante
  },
  source: {
    type: String,
    required: true,
    enum: ['zooplus', 'arcaplanet', 'any'],
    default: 'any'  // 'any' significa che l'avviso si applica a qualsiasi negozio
  },
  targetPrice: {
    type: Number,
    required: false  // Se specificato, l'avviso si attiva quando il prezzo scende sotto questa soglia
  },
  percentageChange: {
    type: Number,
    required: false  // Se specificato, l'avviso si attiva quando il prezzo cambia di questa percentuale
  },
  currentPrice: {
    type: Number,
    required: true  // Prezzo al momento della creazione dell'avviso
  },
  notifyOnAnyChange: {
    type: Boolean,
    default: false  // Se true, l'avviso si attiva per qualsiasi cambiamento di prezzo
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastNotified: {
    type: Date,
    default: null
  },
  notificationsSent: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indice composto per query di controllo efficiente
PriceAlertSchema.index({ productId: 1, variantId: 1, userId: 1 });
PriceAlertSchema.index({ isActive: 1 });

const PriceAlert = mongoose.model('PriceAlert', PriceAlertSchema);

module.exports = PriceAlert; 