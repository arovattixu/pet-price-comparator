/**
 * Similar Product Model
 * Schema for storing relationships between similar products
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Verifica se il modello esiste già per evitare l'errore "OverwriteModelError"
if (mongoose.models.SimilarProduct) {
  module.exports = mongoose.models.SimilarProduct;
} else {
  const SimilarProductSchema = new Schema({
    // The main product
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true
    },
    
    // Similar product
    similarTo: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true
    },
    
    // Similarity score (0-1)
    similarityScore: {
      type: Number,
      min: 0,
      max: 1,
      required: true,
      index: true
    },
    
    // Similarity type
    similarityType: {
      type: String,
      enum: ['AUTOMATIC', 'MANUAL', 'USER_SUGGESTED'],
      default: 'AUTOMATIC'
    },
    
    // Features that match
    matchingFeatures: [String],
    
    // Description of how they are similar
    similarityReason: String,
    
    // Status of the similarity relationship
    status: {
      type: String,
      enum: ['ACTIVE', 'PENDING_REVIEW', 'REJECTED', 'ARCHIVED'],
      default: 'ACTIVE',
      index: true
    },
    
    // For user suggestions
    submittedBy: {
      userId: String,
      username: String,
      date: {
        type: Date,
        default: Date.now
      }
    },
    
    // For moderation
    moderation: {
      reviewedBy: String,
      reviewDate: Date,
      reviewNotes: String
    },
    
    // Price comparison data
    priceDifference: {
      absoluteAmount: Number,
      percentageDifference: Number,
      calculatedAt: Date
    },
    
    // Metadata
    metadata: {
      lastUpdated: {
        type: Date,
        default: Date.now
      },
      algorithm: String,
      algorithmVersion: String,
      confidence: Number
    }
  }, {
    timestamps: true
  });

  // Create indexes for efficient querying
  SimilarProductSchema.index({ product: 1, similarityScore: -1 });
  SimilarProductSchema.index({ similarTo: 1, similarityScore: -1 });
  
  // Ensure unique relationship pairs
  SimilarProductSchema.index({ product: 1, similarTo: 1 }, { unique: true });
  
  // Esporta il modello verificando prima se esiste già
  module.exports = mongoose.models.SimilarProduct || mongoose.model('SimilarProduct', SimilarProductSchema);
} 