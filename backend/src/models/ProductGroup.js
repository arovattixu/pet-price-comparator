/**
 * ProductGroup Model
 * Schema for organizing products of the same base type but with different sizes/packaging
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Verifica se il modello esiste già per evitare l'errore "OverwriteModelError"
if (mongoose.models.ProductGroup) {
  module.exports = mongoose.models.ProductGroup;
} else {
  const ProductGroupSchema = new Schema({
    // Base product identifier
    baseProduct: {
      name: {
        type: String,
        required: true,
        index: true
      },
      brand: {
        type: String,
        index: true
      },
      category: String,
      petType: String
    },
    
    // Product variants - references to Product model
    variants: [{
      productId: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true
      },
      size: String,         // Formatted size (e.g., "2kg", "400g")
      weight: {             // Normalized weight info
        value: Number,
        unit: String
      },
      price: Number,
      unitPrice: {
        value: Number,      // e.g., price per kg
        unit: String        // e.g., "EUR/kg"
      },
      bestValue: Boolean    // Flag for best value in the group
    }],
    
    // Price ranges
    priceRange: {
      min: Number,
      max: Number,
      unitMin: Number,
      unitMax: Number
    },
    
    // Best value information
    bestValue: {
      productId: {
        type: Schema.Types.ObjectId,
        ref: 'Product'
      },
      price: Number,
      unitPrice: Number,
      size: String
    },
    
    // Metadata
    hasCompleteData: {
      type: Boolean,
      default: false
    },
    variantCount: {
      type: Number,
      default: 0
    },
    hasDifferentSources: {
      type: Boolean,
      default: false
    },
    
    // Timestamps
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  }, {
    timestamps: true
  });
  
  // Compound indexes
  ProductGroupSchema.index({ 'baseProduct.brand': 1, 'baseProduct.name': 1 });
  
  // Create indexes
  ProductGroupSchema.index({ 'variants.productId': 1 });
  ProductGroupSchema.index({ 'bestValue.productId': 1 });
  
  // Esporta il modello verificando prima se esiste già
  module.exports = mongoose.models.ProductGroup || mongoose.model('ProductGroup', ProductGroupSchema);
} 