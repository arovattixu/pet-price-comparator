/**
 * Price Point Model
 * Represents a price point for a product at a specific time
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Verifica se il modello esiste già per evitare l'errore "OverwriteModelError"
if (mongoose.models.PricePoint) {
  module.exports = mongoose.models.PricePoint;
} else {
  const PricePointSchema = new Schema({
    // Product reference
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true
    },
    
    // Product variant (if applicable)
    variant: {
      id: String,
      name: String
    },
    
    // Price details
    price: {
      type: Number,
      required: true
    },
    originalPrice: Number,
    currency: {
      type: String,
      default: 'EUR'
    },
    discountPercentage: Number,
    pricePerUnit: {
      value: Number,
      unit: String
    },
    
    // Source information
    source: {
      type: String,
      required: true,
      index: true
    },
    url: String,
    
    // Availability
    inStock: {
      type: Boolean,
      default: true
    },
    
    // Price point was captured at
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    
    // Analytics
    priceChange: {
      amount: Number,
      percentage: Number,
      direction: {
        type: String,
        enum: ['up', 'down', 'unchanged']
      },
      sinceLastPoint: Boolean
    },
    
    // Metadata
    metadata: {
      userAgent: String,
      ipAddress: String,
      apiVersion: String
    }
  }, {
    timestamps: true
  });

  // Indices for faster queries
  PricePointSchema.index({ product: 1, source: 1, timestamp: -1 });
  PricePointSchema.index({ product: 1, timestamp: -1 });
  PricePointSchema.index({ source: 1, timestamp: -1 });
  
  // Esporta il modello verificando prima se esiste già
  module.exports = mongoose.models.PricePoint || mongoose.model('PricePoint', PricePointSchema);
} 