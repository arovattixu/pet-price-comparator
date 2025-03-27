const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  brand: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    trim: true
  },
  imageUrl: {
    type: String,
    trim: true
  },
  source: {
    type: String,
    required: true,
    enum: ['zooplus', 'arcaplanet'],
    default: 'zooplus'
  },
  sourceId: {
    type: String,
    required: true,
    trim: true
  },
  prices: [{
    store: {
      type: String,
      required: true,
      enum: ['zooplus', 'arcaplanet']
    },
    price: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'EUR'
    },
    url: {
      type: String,
      required: true
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    inStock: {
      type: Boolean,
      default: true
    }
  }],
  sku: {
    type: String,
    trim: true
  },
  weight: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indici per migliorare le performance delle query
productSchema.index({ name: 1 });
productSchema.index({ 'prices.store': 1 });
productSchema.index({ category: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ source: 1, sourceId: 1 }, { unique: true });

const Product = mongoose.model('Product', productSchema);

module.exports = Product;