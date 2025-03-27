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
    enum: ['zooplus', 'arcaplanet'],
    index: true
  },
  sourceId: {
    type: String,
    trim: true,
    index: true
  },
  petType: {
    type: String,
    enum: ['cane', 'gatto'],
    index: true
  },
  rating: {
    type: Number,
    min: 0,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0
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
  variants: [{
    variantId: {
      type: String,
      required: true
    },
    description: {
      type: String,
      trim: true
    },
    available: {
      type: Boolean,
      default: true
    },
    discounted: {
      type: Boolean,
      default: false
    },
    discountAmount: {
      type: String,
      trim: true
    }
  }],
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
productSchema.index({ petType: 1, category: 1 });
productSchema.index({ 'variants.variantId': 1 });

const Product = mongoose.model('Product', productSchema);

module.exports = Product;