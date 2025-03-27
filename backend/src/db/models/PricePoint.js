const mongoose = require('mongoose');

const PricePointSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  variantId: {
    type: String,
    required: true,
    index: true
  },
  source: {
    type: String,
    required: true,
    enum: ['zooplus', 'arcaplanet']
  },
  price: {
    amount: Number,
    currency: {
      type: String,
      default: 'EUR'
    },
    unitPrice: String,
    discounted: Boolean,
    discountAmount: String
  },
  recordedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Indice per ricerche di serie temporali
PricePointSchema.index({ productId: 1, variantId: 1, recordedAt: -1 });

module.exports = mongoose.model('PricePoint', PricePointSchema);