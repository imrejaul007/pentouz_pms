import mongoose from 'mongoose';
import crypto from 'crypto';

const webhookEndpointSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Webhook name is required'],
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Endpoint Configuration
  url: {
    type: String,
    required: [true, 'Webhook URL is required'],
    validate: {
      validator: function(url) {
        try {
          new URL(url);
          return url.startsWith('http://') || url.startsWith('https://');
        } catch {
          return false;
        }
      },
      message: 'Please provide a valid HTTP/HTTPS URL'
    }
  },
  
  // Ownership
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Event Subscriptions
  events: [{
    type: String,
    required: true,
    enum: [
      // Booking Events
      'booking.created',
      'booking.updated', 
      'booking.cancelled',
      'booking.confirmed',
      'booking.checked_in',
      'booking.checked_out',
      'booking.no_show',
      
      // Payment Events
      'payment.completed',
      'payment.failed',
      'payment.refunded',
      'payment.partial_refund',
      
      // Room Events
      'room.availability_changed',
      'room.status_changed',
      'room.maintenance_scheduled',
      'room.cleaned',
      
      // Rate Events
      'rate.updated',
      'rate.created',
      'rate.deleted',
      
      // Guest Events
      'guest.created',
      'guest.updated',
      'guest.checked_in',
      'guest.checked_out',
      
      // System Events
      'system.backup_completed',
      'system.maintenance_started',
      'system.maintenance_completed',
      'system.error_occurred'
    ]
  }],
  
  // Security
  secret: {
    type: String,
    required: true,
    select: false // Never return in regular queries
  },
  
  // Configuration
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // HTTP Configuration
  httpConfig: {
    method: {
      type: String,
      enum: ['POST', 'PUT'],
      default: 'POST'
    },
    headers: {
      type: Map,
      of: String,
      default: new Map()
    },
    timeout: {
      type: Number,
      default: 30000, // 30 seconds
      min: 1000,
      max: 300000 // 5 minutes max
    },
    contentType: {
      type: String,
      enum: ['application/json', 'application/x-www-form-urlencoded'],
      default: 'application/json'
    }
  },
  
  // Retry Configuration
  retryPolicy: {
    enabled: {
      type: Boolean,
      default: true
    },
    maxRetries: {
      type: Number,
      default: 3,
      min: 0,
      max: 10
    },
    initialDelay: {
      type: Number,
      default: 1000, // 1 second
      min: 100
    },
    maxDelay: {
      type: Number,
      default: 60000, // 1 minute
      min: 1000
    },
    backoffMultiplier: {
      type: Number,
      default: 2,
      min: 1,
      max: 10
    },
    retryOn: [{
      type: String,
      enum: ['timeout', 'connection_error', '5xx', '4xx'],
      default: ['timeout', 'connection_error', '5xx']
    }]
  },
  
  // Filtering
  filters: {
    enabled: {
      type: Boolean,
      default: false
    },
    conditions: [{
      field: String, // e.g., 'booking.status', 'guest.vipLevel'
      operator: {
        type: String,
        enum: ['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'in', 'not_in']
      },
      value: mongoose.Schema.Types.Mixed
    }]
  },
  
  // Statistics
  stats: {
    totalDeliveries: {
      type: Number,
      default: 0
    },
    successfulDeliveries: {
      type: Number,
      default: 0
    },
    failedDeliveries: {
      type: Number,
      default: 0
    },
    lastDelivery: {
      attempt: Date,
      success: Boolean,
      statusCode: Number,
      responseTime: Number,
      errorMessage: String
    },
    averageResponseTime: {
      type: Number,
      default: 0
    }
  },
  
  // Health Monitoring
  health: {
    status: {
      type: String,
      enum: ['healthy', 'degraded', 'unhealthy'],
      default: 'healthy'
    },
    lastHealthCheck: Date,
    consecutiveFailures: {
      type: Number,
      default: 0
    },
    uptime: {
      type: Number,
      default: 100 // percentage
    }
  },
  
  // Metadata
  tags: [String],
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes
webhookEndpointSchema.index({ hotelId: 1, isActive: 1, createdAt: -1 });
webhookEndpointSchema.index({ events: 1 });
webhookEndpointSchema.index({ 'health.status': 1 });
webhookEndpointSchema.index({ 'stats.lastDelivery.attempt': -1 });

// Generate webhook secret
webhookEndpointSchema.statics.generateSecret = function() {
  return `whsec_${crypto.randomBytes(32).toString('hex')}`;
};

// Pre-save middleware to generate secret
webhookEndpointSchema.pre('save', function(next) {
  if (!this.secret) {
    this.secret = this.constructor.generateSecret();
  }
  next();
});

// Method to create webhook signature
webhookEndpointSchema.methods.createSignature = function(payload, timestamp) {
  const signaturePayload = `${timestamp}.${JSON.stringify(payload)}`;
  return crypto
    .createHmac('sha256', this.secret)
    .update(signaturePayload, 'utf8')
    .digest('hex');
};

// Method to verify webhook signature
webhookEndpointSchema.methods.verifySignature = function(payload, signature, timestamp) {
  const expectedSignature = this.createSignature(payload, timestamp);
  const providedSignature = signature.replace('sha256=', '');
  
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(providedSignature, 'hex')
  );
};

// Method to check if event should be delivered
webhookEndpointSchema.methods.shouldDeliverEvent = function(eventType, eventData) {
  // Check if webhook is active
  if (!this.isActive) return false;
  
  // Check if event type is subscribed
  if (!this.events.includes(eventType)) return false;
  
  // Check filters if enabled
  if (this.filters.enabled && this.filters.conditions.length > 0) {
    return this.filters.conditions.every(condition => {
      const fieldValue = this.getNestedValue(eventData, condition.field);
      return this.evaluateCondition(fieldValue, condition.operator, condition.value);
    });
  }
  
  return true;
};

// Helper method to get nested object values
webhookEndpointSchema.methods.getNestedValue = function(obj, path) {
  return path.split('.').reduce((current, key) => current && current[key], obj);
};

// Helper method to evaluate filter conditions
webhookEndpointSchema.methods.evaluateCondition = function(fieldValue, operator, expectedValue) {
  switch (operator) {
    case 'equals':
      return fieldValue === expectedValue;
    case 'not_equals':
      return fieldValue !== expectedValue;
    case 'contains':
      return String(fieldValue).includes(String(expectedValue));
    case 'not_contains':
      return !String(fieldValue).includes(String(expectedValue));
    case 'greater_than':
      return Number(fieldValue) > Number(expectedValue);
    case 'less_than':
      return Number(fieldValue) < Number(expectedValue);
    case 'in':
      return Array.isArray(expectedValue) && expectedValue.includes(fieldValue);
    case 'not_in':
      return Array.isArray(expectedValue) && !expectedValue.includes(fieldValue);
    default:
      return false;
  }
};

// Method to record delivery attempt
webhookEndpointSchema.methods.recordDelivery = async function(success, statusCode, responseTime, errorMessage = null) {
  this.stats.totalDeliveries += 1;
  
  if (success) {
    this.stats.successfulDeliveries += 1;
    this.health.consecutiveFailures = 0;
  } else {
    this.stats.failedDeliveries += 1;
    this.health.consecutiveFailures += 1;
  }
  
  // Update last delivery info
  this.stats.lastDelivery = {
    attempt: new Date(),
    success,
    statusCode,
    responseTime,
    errorMessage
  };
  
  // Update average response time
  if (responseTime && success) {
    const totalSuccessful = this.stats.successfulDeliveries;
    const currentAverage = this.stats.averageResponseTime || 0;
    this.stats.averageResponseTime = ((currentAverage * (totalSuccessful - 1)) + responseTime) / totalSuccessful;
  }
  
  // Update health status
  this.updateHealthStatus();
  
  await this.save();
};

// Method to update health status
webhookEndpointSchema.methods.updateHealthStatus = function() {
  const failureRate = this.stats.totalDeliveries > 0 
    ? this.stats.failedDeliveries / this.stats.totalDeliveries 
    : 0;
  
  if (this.health.consecutiveFailures >= 5 || failureRate > 0.5) {
    this.health.status = 'unhealthy';
    this.health.uptime = Math.max(0, 100 - (failureRate * 100));
  } else if (this.health.consecutiveFailures >= 2 || failureRate > 0.2) {
    this.health.status = 'degraded'; 
    this.health.uptime = Math.max(0, 100 - (failureRate * 100));
  } else {
    this.health.status = 'healthy';
    this.health.uptime = Math.max(0, 100 - (failureRate * 100));
  }
  
  this.health.lastHealthCheck = new Date();
};

const WebhookEndpoint = mongoose.model('WebhookEndpoint', webhookEndpointSchema);
export default WebhookEndpoint;
