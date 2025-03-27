/**
 * Product Model
 * Schema for pet products
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Verifica se il modello esiste già per evitare l'errore "OverwriteModelError"
if (mongoose.models.Product) {
  module.exports = mongoose.models.Product;
} else {
  const ProductSchema = new Schema({
    // Basic info
    name: {
      type: String,
      required: true,
      index: true
    },
    brand: {
      type: String,
      index: true
    },
    description: String,
    
    // Categorization
    category: {
      type: String,
      index: true
    },
    subCategory: String,
    petType: {
      type: String,
      index: true
    },
    
    // Source info
    source: {
      type: String,
      required: true,
      index: true
    },
    sourceId: {
      type: String,
      index: true
    },
    url: String,
    
    // Images
    imageUrl: String,
    additionalImages: [String],
    
    // Current price (updated when new price points are added)
    price: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'EUR'
    },
    
    // Unit pricing information
    unitPrice: {
      value: Number,        // Price per unit (e.g., price per kg)
      unit: String,         // Unit (e.g., EUR/kg, EUR/L)
      calculatedAt: Date    // When this was last calculated
    },
    
    // Weight/size information
    packageInfo: {
      weight: {
        value: Number,      // Numeric weight value
        unit: String,       // Weight unit (g, kg, etc.)
        original: String    // Original weight string
      },
      quantity: Number,     // Number of items in package
      packageType: String   // Type of packaging
    },
    
    // Availability
    availability: {
      status: {
        type: String,
        enum: ['AVAILABLE', 'OUT_OF_STOCK', 'DISCONTINUED', 'POTENTIALLY_UNAVAILABLE'],
        default: 'AVAILABLE'
      },
      lastChecked: {
        type: Date,
        default: Date.now
      }
    },
    
    // Price history stats
    priceStats: {
      min: Number,
      max: Number,
      avg: Number,
      lastUpdate: Date
    },
    
    // Important dates
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    lastPriceUpdate: {
      type: Date,
      index: true
    },
    
    // Additional product data
    details: {
      weight: String,
      dimensions: String,
      ingredients: String,
      nutritionalInfo: String,
      ageRange: String,
      features: [String],
      variants: [String]
    },
    
    // Similar product groups
    productGroup: {
      baseProductId: {      // Reference to the base product in the group
        type: Schema.Types.ObjectId,
        ref: 'Product',
        index: true
      },
      isBaseProduct: {      // Whether this is the base product for a group of variants
        type: Boolean,
        default: false
      }
    },
    
    // SEO/analysis data
    keywords: [String],
    popularity: {
      type: Number,
      default: 0
    },
    reviewCount: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    }
  }, {
    timestamps: true
  });
  
  // Create compound indexes
  ProductSchema.index({ name: 1, brand: 1 });
  ProductSchema.index({ petType: 1, category: 1 });
  ProductSchema.index({ source: 1, sourceId: 1 }, { unique: true });
  
  // Create text index for search
  ProductSchema.index({ 
    name: 'text', 
    brand: 'text', 
    description: 'text',
    keywords: 'text'
  }, {
    weights: {
      name: 10,
      brand: 5,
      description: 2,
      keywords: 1
    },
    name: 'product_search_index'
  });
  
  // Pre-save middleware to update lastPriceUpdate when price changes
  ProductSchema.pre('save', function(next) {
    if (this.isModified('price')) {
      this.lastPriceUpdate = new Date();
    }
    next();
  });
  
  // Esporta il modello verificando prima se esiste già
  module.exports = mongoose.models.Product || mongoose.model('Product', ProductSchema);
} 