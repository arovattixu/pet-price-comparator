const mongoose = require('mongoose');

/**
 * Schema per i prodotti simili
 * Rappresenta la relazione tra due prodotti che sono simili
 */
const similarProductSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  similarProductId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  similarity: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
    index: true
  },
  priceDifference: {
    type: Number,
    required: true
  },
  priceRatio: {
    type: Number,
    required: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indice composito per ottimizzare le query
similarProductSchema.index({ productId: 1, similarity: -1 });
similarProductSchema.index({ similarProductId: 1, similarity: -1 });

// Indice per trovare prodotti con il miglior risparmio
similarProductSchema.index({ priceDifference: -1 });
similarProductSchema.index({ priceRatio: -1 });

module.exports = mongoose.model('SimilarProduct', similarProductSchema, 'similarproducts'); 