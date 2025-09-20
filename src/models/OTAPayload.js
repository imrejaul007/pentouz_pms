import mongoose from 'mongoose';
import { compress, decompress } from '../utils/compression.js';

const otaPayloadSchema = new mongoose.Schema({
  // Unique identifier for the payload
  payloadId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Request/Response metadata
  direction: {
    type: String,
    required: true,
    enum: ['inbound', 'outbound'],
    index: true
  },
  
  // OTA Channel information
  channel: {
    type: String,
    required: true,
    enum: ['booking_com', 'expedia', 'airbnb', 'agoda', 'direct', 'other'],
    index: true
  },
  
  channelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Channel'
  },
  
  // API endpoint details
  endpoint: {
    url: {
      type: String,
      required: true
    },
    method: {
      type: String,
      required: true,
      enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    },
    path: String,
    query: mongoose.Schema.Types.Mixed
  },
  
  // Request/Response data
  headers: {
    type: Map,
    of: String,
    default: new Map()
  },
  
  // Raw payload data - stored compressed for large payloads
  rawPayload: {
    data: Buffer, // Compressed JSON data
    size: Number, // Original size in bytes
    compressed: {
      type: Boolean,
      default: false
    },
    encoding: {
      type: String,
      default: 'utf8'
    }
  },
  
  // Parsed payload for easy querying (limited fields)
  parsedPayload: {
    bookingId: String,
    reservationId: String,
    hotelId: String,
    roomType: String,
    checkIn: Date,
    checkOut: Date,
    guestName: String,
    totalAmount: Number,
    currency: String,
    eventType: String,
    operation: String, // create, update, delete, cancel
    status: String
  },
  
  // Response data (for outbound requests)
  response: {
    statusCode: Number,
    headers: {
      type: Map,
      of: String,
      default: new Map()
    },
    body: {
      data: Buffer, // Compressed response data
      size: Number,
      compressed: {
        type: Boolean,
        default: false
      }
    },
    responseTime: Number // in milliseconds
  },
  
  // Correlation and tracing
  correlationId: {
    type: String,
    index: true
  },
  
  traceId: String,
  
  parentPayloadId: {
    type: String,
    ref: 'OTAPayload'
  },
  
  // Booking/Amendment relationship
  relatedBookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    index: true
  },
  
  relatedAmendmentId: String,
  
  // Audit trail reference
  auditLogId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AuditLog'
  },
  
  // Processing status
  processingStatus: {
    type: String,
    enum: ['received', 'processing', 'processed', 'failed', 'ignored'],
    default: 'received',
    index: true
  },
  
  processingError: {
    message: String,
    code: String,
    stack: String,
    timestamp: Date
  },
  
  // Business context
  businessContext: {
    operation: {
      type: String,
      enum: ['booking_create', 'booking_update', 'booking_cancel', 'availability_update', 'rate_update', 'inventory_sync', 'amendment_request', 'webhook_notification']
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    source: {
      system: String,
      version: String,
      environment: String
    }
  },
  
  // Security and validation
  security: {
    authenticated: Boolean,
    signature: String,
    signatureValid: Boolean,
    ipAddress: String,
    userAgent: String
  },
  
  // Data classification
  classification: {
    containsPII: {
      type: Boolean,
      default: false
    },
    containsPaymentData: {
      type: Boolean,
      default: false
    },
    dataLevel: {
      type: String,
      enum: ['public', 'internal', 'confidential', 'restricted'],
      default: 'internal'
    }
  },
  
  // Retention and compliance
  retention: {
    retentionPeriod: {
      type: Number, // days
      default: 2555 // ~7 years for compliance
    },
    deleteAfter: {
      type: Date,
      index: { expireAfterSeconds: 0 }
    },
    archived: {
      type: Boolean,
      default: false
    },
    archiveLocation: String
  },
  
  // Performance metrics
  metrics: {
    payloadSize: Number,
    processingDuration: Number,
    memoryUsage: Number
  },
  
  // Additional metadata
  metadata: {
    tags: [String],
    notes: String,
    flags: {
      duplicate: Boolean,
      suspicious: Boolean,
      requiresReview: Boolean
    }
  }
  
}, {
  timestamps: true,
  // Enable compression at schema level
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      // Don't return raw payload data in JSON by default
      delete ret.rawPayload;
      delete ret.response;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Indexes for performance
otaPayloadSchema.index({ direction: 1, channel: 1, createdAt: -1 });
otaPayloadSchema.index({ correlationId: 1, createdAt: -1 });
otaPayloadSchema.index({ 'parsedPayload.bookingId': 1, createdAt: -1 });
otaPayloadSchema.index({ relatedBookingId: 1, createdAt: -1 });
otaPayloadSchema.index({ processingStatus: 1, createdAt: -1 });
otaPayloadSchema.index({ 'businessContext.operation': 1, createdAt: -1 });
otaPayloadSchema.index({ 'security.ipAddress': 1, createdAt: -1 });
otaPayloadSchema.index({ 'retention.deleteAfter': 1 });

// Compound indexes for common queries
otaPayloadSchema.index({ channel: 1, direction: 1, 'businessContext.operation': 1, createdAt: -1 });
otaPayloadSchema.index({ relatedBookingId: 1, direction: 1, processingStatus: 1 });

// Pre-save middleware to generate payloadId and handle compression
otaPayloadSchema.pre('save', async function(next) {
  try {
    // Generate unique payload ID
    if (!this.payloadId) {
      const timestamp = Date.now().toString();
      const random = Math.random().toString(36).substring(2, 8);
      const direction = this.direction.toUpperCase().substring(0, 2);
      const channel = this.channel.toUpperCase().substring(0, 3);
      this.payloadId = `${direction}_${channel}_${timestamp}_${random}`;
    }
    
    // Set retention delete date
    if (!this.retention.deleteAfter) {
      const retentionDays = this.retention.retentionPeriod || 2555;
      this.retention.deleteAfter = new Date(Date.now() + (retentionDays * 24 * 60 * 60 * 1000));
    }
    
    // Handle payload compression for large payloads
    if (this.isModified('rawPayload') && this.rawPayload && this.rawPayload.data) {
      const payloadSize = Buffer.byteLength(this.rawPayload.data);
      this.metrics.payloadSize = payloadSize;
      
      // Compress payloads larger than 10KB
      if (payloadSize > 10240 && !this.rawPayload.compressed) {
        try {
          const compressed = await compress(this.rawPayload.data);
          this.rawPayload.data = compressed;
          this.rawPayload.compressed = true;
          this.rawPayload.size = payloadSize;
        } catch (error) {
          console.warn('Failed to compress payload:', error);
        }
      }
    }
    
    // Handle response compression
    if (this.isModified('response.body') && this.response && this.response.body && this.response.body.data) {
      const responseSize = Buffer.byteLength(this.response.body.data);
      
      if (responseSize > 10240 && !this.response.body.compressed) {
        try {
          const compressed = await compress(this.response.body.data);
          this.response.body.data = compressed;
          this.response.body.compressed = true;
          this.response.body.size = responseSize;
        } catch (error) {
          console.warn('Failed to compress response:', error);
        }
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Virtual for getting decompressed payload
otaPayloadSchema.virtual('decompressedPayload').get(async function() {
  if (!this.rawPayload || !this.rawPayload.data) return null;
  
  if (this.rawPayload.compressed) {
    try {
      return await decompress(this.rawPayload.data);
    } catch (error) {
      console.error('Failed to decompress payload:', error);
      return null;
    }
  }
  
  return this.rawPayload.data.toString(this.rawPayload.encoding || 'utf8');
});

// Virtual for getting decompressed response
otaPayloadSchema.virtual('decompressedResponse').get(async function() {
  if (!this.response || !this.response.body || !this.response.body.data) return null;
  
  if (this.response.body.compressed) {
    try {
      return await decompress(this.response.body.data);
    } catch (error) {
      console.error('Failed to decompress response:', error);
      return null;
    }
  }
  
  return this.response.body.data.toString('utf8');
});

// Static methods for payload management
otaPayloadSchema.statics.storeInboundPayload = async function(data) {
  const payload = new this({
    direction: 'inbound',
    channel: data.channel,
    channelId: data.channelId,
    endpoint: {
      url: data.url,
      method: data.method,
      path: data.path,
      query: data.query
    },
    headers: new Map(Object.entries(data.headers || {})),
    rawPayload: {
      data: Buffer.from(JSON.stringify(data.payload)),
      size: Buffer.byteLength(JSON.stringify(data.payload)),
      encoding: 'utf8'
    },
    parsedPayload: data.parsedPayload || {},
    correlationId: data.correlationId,
    traceId: data.traceId,
    relatedBookingId: data.bookingId,
    relatedAmendmentId: data.amendmentId,
    businessContext: data.businessContext || {},
    security: {
      authenticated: data.authenticated,
      signature: data.signature,
      signatureValid: data.signatureValid,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent
    },
    classification: data.classification || {}
  });
  
  return await payload.save();
};

otaPayloadSchema.statics.storeOutboundPayload = async function(data) {
  const payload = new this({
    direction: 'outbound',
    channel: data.channel,
    channelId: data.channelId,
    endpoint: {
      url: data.url,
      method: data.method,
      path: data.path,
      query: data.query
    },
    headers: new Map(Object.entries(data.requestHeaders || {})),
    rawPayload: {
      data: Buffer.from(JSON.stringify(data.requestPayload)),
      size: Buffer.byteLength(JSON.stringify(data.requestPayload)),
      encoding: 'utf8'
    },
    response: {
      statusCode: data.responseStatus,
      headers: new Map(Object.entries(data.responseHeaders || {})),
      body: data.responseBody ? {
        data: Buffer.from(JSON.stringify(data.responseBody)),
        size: Buffer.byteLength(JSON.stringify(data.responseBody))
      } : undefined,
      responseTime: data.responseTime
    },
    parsedPayload: data.parsedPayload || {},
    correlationId: data.correlationId,
    traceId: data.traceId,
    relatedBookingId: data.bookingId,
    businessContext: data.businessContext || {},
    security: {
      ipAddress: data.ipAddress,
      userAgent: data.userAgent
    }
  });
  
  return await payload.save();
};

// Find payloads for a booking
otaPayloadSchema.statics.findByBookingId = function(bookingId, options = {}) {
  const query = { relatedBookingId: bookingId };
  
  if (options.direction) {
    query.direction = options.direction;
  }
  
  if (options.channel) {
    query.channel = options.channel;
  }
  
  if (options.operation) {
    query['businessContext.operation'] = options.operation;
  }
  
  return this.find(query)
    .sort({ createdAt: options.sortOrder === 'asc' ? 1 : -1 })
    .limit(options.limit || 100);
};

// Find payloads by correlation ID
otaPayloadSchema.statics.findByCorrelationId = function(correlationId) {
  return this.find({ correlationId })
    .sort({ createdAt: 1 });
};

// Get payload statistics
otaPayloadSchema.statics.getStats = async function(filters = {}) {
  const matchStage = {};
  
  if (filters.channel) matchStage.channel = filters.channel;
  if (filters.direction) matchStage.direction = filters.direction;
  if (filters.startDate || filters.endDate) {
    matchStage.createdAt = {};
    if (filters.startDate) matchStage.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) matchStage.createdAt.$lte = new Date(filters.endDate);
  }
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalPayloads: { $sum: 1 },
        totalSize: { $sum: '$metrics.payloadSize' },
        avgSize: { $avg: '$metrics.payloadSize' },
        byChannel: {
          $push: {
            channel: '$channel',
            direction: '$direction',
            operation: '$businessContext.operation'
          }
        },
        byStatus: {
          $push: '$processingStatus'
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalPayloads: 0,
    totalSize: 0,
    avgSize: 0,
    byChannel: [],
    byStatus: []
  };
};

// Instance methods
otaPayloadSchema.methods.getDecompressedPayload = async function() {
  if (!this.rawPayload || !this.rawPayload.data) return null;
  
  try {
    if (this.rawPayload.compressed) {
      const decompressed = await decompress(this.rawPayload.data);
      return JSON.parse(decompressed.toString('utf8'));
    } else {
      return JSON.parse(this.rawPayload.data.toString(this.rawPayload.encoding || 'utf8'));
    }
  } catch (error) {
    console.error('Failed to decompress/parse payload:', error);
    return null;
  }
};

otaPayloadSchema.methods.getDecompressedResponse = async function() {
  if (!this.response || !this.response.body || !this.response.body.data) return null;
  
  try {
    if (this.response.body.compressed) {
      const decompressed = await decompress(this.response.body.data);
      return JSON.parse(decompressed.toString('utf8'));
    } else {
      return JSON.parse(this.response.body.data.toString('utf8'));
    }
  } catch (error) {
    console.error('Failed to decompress/parse response:', error);
    return null;
  }
};

otaPayloadSchema.methods.markProcessed = function(status = 'processed') {
  this.processingStatus = status;
  return this.save();
};

otaPayloadSchema.methods.markFailed = function(error) {
  this.processingStatus = 'failed';
  this.processingError = {
    message: error.message,
    code: error.code,
    stack: error.stack,
    timestamp: new Date()
  };
  return this.save();
};

export default mongoose.model('OTAPayload', otaPayloadSchema);
