/**
 * Price Alert Model
 * Schema for storing user price alerts
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PriceAlertSchema = new Schema({
  // User identification (simple string until auth is implemented)
  userId: {
    type: String,
    required: true,
    default: 'anonymous',
    index: true
  },
  
  // Reference to the product being monitored
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  
  // Type of alert
  type: {
    type: String,
    enum: ['PRICE_BELOW', 'PRICE_ABOVE', 'PRICE_CHANGE'],
    required: true
  },
  
  // Target price (for PRICE_BELOW and PRICE_ABOVE alerts)
  targetPrice: {
    type: Number,
    required: function() {
      return this.type === 'PRICE_BELOW' || this.type === 'PRICE_ABOVE';
    }
  },
  
  // Target percentage change (for PRICE_CHANGE alerts)
  targetPercentage: {
    type: Number,
    required: function() {
      return this.type === 'PRICE_CHANGE';
    }
  },
  
  // Reference price (for PRICE_CHANGE alerts)
  referencePrice: {
    type: Number,
    required: function() {
      return this.type === 'PRICE_CHANGE';
    }
  },
  
  // Current price when the alert was created or last checked
  currentPrice: {
    type: Number
  },
  
  // Alert status
  status: {
    type: String,
    enum: ['ACTIVE', 'TRIGGERED', 'EXPIRED'],
    default: 'ACTIVE',
    index: true
  },
  
  // Whether the alert has been triggered
  triggered: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // When the alert was triggered
  triggeredAt: {
    type: Date
  },
  
  // Status message for display
  statusMessage: {
    type: String
  },
  
  // Email to receive notifications
  notificationEmail: {
    type: String,
    validate: {
      validator: function(v) {
        return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(v);
      },
      message: 'Please enter a valid email address'
    },
    required: function() {
      return this.notificationType === 'EMAIL';
    }
  },
  
  // Notification type
  notificationType: {
    type: String,
    enum: ['EMAIL', 'PUSH', 'SMS', 'NONE'],
    default: 'EMAIL'
  },
  
  // Notification settings
  notificationSettings: {
    frequency: {
      type: String,
      enum: ['ONCE', 'DAILY', 'ALWAYS'],
      default: 'ONCE'
    },
    lastSent: {
      type: Date
    }
  }
}, {
  timestamps: true
});

// Create indexes
PriceAlertSchema.index({ userId: 1, productId: 1, type: 1 }, { unique: true });
PriceAlertSchema.index({ createdAt: -1 });
PriceAlertSchema.index({ updatedAt: -1 });
PriceAlertSchema.index({ triggered: 1, triggeredAt: 1 });

// Esporta il modello verificando prima se esiste già
const PriceAlert = mongoose.models.PriceAlert || mongoose.model('PriceAlert', PriceAlertSchema);

module.exports = PriceAlert; 