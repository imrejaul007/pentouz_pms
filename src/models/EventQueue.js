import mongoose from 'mongoose';

/**
 * Event Queue Model
 * 
 * Stores update events that need to be processed by Channel Manager
 * for async OTA synchronization
 */

const eventQueueSchema = new mongoose.Schema({
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  eventType: {
    type: String,
    enum: [
      'rate_update',
      'availability_update',
      'restriction_update',
      'room_type_update',
      'booking_modification',
      'cancellation',
      'stop_sell_update'
    ],
    required: true,
    index: true
  },
  priority: {
    type: Number,
    enum: [1, 2, 3, 4, 5], // 1 = highest, 5 = lowest
    default: 3,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  
  // Event payload with standardized structure
  payload: {
    // Common fields
    hotelId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Hotel',
      required: true,
      index: true
    },
    roomTypeId: {
      type: mongoose.Schema.ObjectId,
      ref: 'RoomType',
      index: true
    },
    
    // Date range for the update
    dateRange: {
      startDate: {
        type: Date,
        required: true,
        index: true
      },
      endDate: {
        type: Date,
        required: true,
        index: true
      }
    },
    
    // Channel targeting
    channels: [{
      type: String,
      enum: ['booking_com', 'expedia', 'airbnb', 'agoda', 'hotels_com', 'amadeus', 'sabre', 'all']
    }],
    
    // Event-specific data
    data: mongoose.Schema.Types.Mixed
  },
  
  // Processing metadata
  processing: {
    attempts: {
      type: Number,
      default: 0,
      index: true
    },
    maxAttempts: {
      type: Number,
      default: 3
    },
    nextRetryAt: {
      type: Date,
      index: true
    },
    processingStartedAt: Date,
    processingCompletedAt: Date,
    processingDuration: Number, // milliseconds
    
    // Worker information
    workerId: String,
    workerInstance: String
  },
  
  // Error handling
  errors: [{
    attemptNumber: Number,
    timestamp: {
      type: Date,
      default: Date.now
    },
    error: {
      code: String,
      message: String,
      stack: String,
      channel: String
    },
    context: mongoose.Schema.Types.Mixed
  }],
  
  // Results tracking
  results: [{
    channel: String,
    status: {
      type: String,
      enum: ['success', 'failed', 'skipped']
    },
    response: mongoose.Schema.Types.Mixed,
    processingTime: Number,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  source: {
    type: String,
    enum: ['manual', 'system', 'webhook', 'scheduler', 'bulk_operation'],
    default: 'system'
  },
  correlationId: {
    type: String,
    index: true
  },
  
  // Scheduling
  scheduledFor: {
    type: Date,
    index: true
  },
  
  // Grouping related events
  batchId: {
    type: String,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  suppressReservedKeysWarning: true // Suppresses warning for 'errors' field
});

// Compound indexes for efficient querying
eventQueueSchema.index({ status: 1, priority: 1, createdAt: 1 });
eventQueueSchema.index({ status: 1, scheduledFor: 1 });
eventQueueSchema.index({ eventType: 1, status: 1, createdAt: 1 });
eventQueueSchema.index({ 'payload.hotelId': 1, status: 1, eventType: 1 });
eventQueueSchema.index({ batchId: 1, status: 1 });
eventQueueSchema.index({ correlationId: 1 });

// TTL index for completed/failed events (cleanup after 30 days)
eventQueueSchema.index({ 
  updatedAt: 1 
}, { 
  expireAfterSeconds: 30 * 24 * 60 * 60,
  partialFilterExpression: { 
    status: { $in: ['completed', 'cancelled'] } 
  }
});

// Virtual for processing time calculation
eventQueueSchema.virtual('totalProcessingTime').get(function() {
  if (this.processing.processingStartedAt && this.processing.processingCompletedAt) {
    return this.processing.processingCompletedAt - this.processing.processingStartedAt;
  }
  return null;
});

// Virtual for retry eligibility
eventQueueSchema.virtual('canRetry').get(function() {
  return this.processing.attempts < this.processing.maxAttempts && 
         this.status === 'failed' &&
         (!this.processing.nextRetryAt || this.processing.nextRetryAt <= new Date());
});

// Pre-save middleware
eventQueueSchema.pre('save', function(next) {
  // Generate eventId if not provided
  if (!this.eventId) {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.eventId = `EVT_${timestamp}_${random}`;
  }
  
  // Validate date range
  if (this.payload.dateRange.endDate <= this.payload.dateRange.startDate) {
    return next(new Error('End date must be after start date'));
  }
  
  // Set default scheduled time
  if (!this.scheduledFor) {
    this.scheduledFor = new Date();
  }
  
  next();
});

// Instance methods
eventQueueSchema.methods.markAsProcessing = function(workerId, workerInstance) {
  this.status = 'processing';
  this.processing.processingStartedAt = new Date();
  this.processing.workerId = workerId;
  this.processing.workerInstance = workerInstance;
  return this.save();
};

eventQueueSchema.methods.markAsCompleted = function(results = []) {
  this.status = 'completed';
  this.processing.processingCompletedAt = new Date();
  this.processing.processingDuration = this.processing.processingCompletedAt - this.processing.processingStartedAt;
  this.results = results;
  return this.save();
};

eventQueueSchema.methods.markAsFailed = function(error, retryDelay = 60000) {
  this.status = 'failed';
  this.processing.attempts += 1;
  
  // Add error to errors array
  this.errors.push({
    attemptNumber: this.processing.attempts,
    error: {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message,
      stack: error.stack,
      channel: error.channel
    },
    context: error.context
  });
  
  // Set next retry time if attempts remain
  if (this.processing.attempts < this.processing.maxAttempts) {
    this.processing.nextRetryAt = new Date(Date.now() + (retryDelay * this.processing.attempts));
    this.status = 'pending'; // Reset to pending for retry
  }
  
  return this.save();
};

eventQueueSchema.methods.cancel = function(reason) {
  this.status = 'cancelled';
  this.errors.push({
    attemptNumber: this.processing.attempts,
    error: {
      code: 'CANCELLED',
      message: reason || 'Event cancelled',
      stack: null
    }
  });
  return this.save();
};

// Static methods
eventQueueSchema.statics.getNextPendingEvents = async function(limit = 10, eventTypes = null) {
  const filter = {
    status: 'pending',
    scheduledFor: { $lte: new Date() }
  };
  
  if (eventTypes && eventTypes.length > 0) {
    filter.eventType = { $in: eventTypes };
  }
  
  return this.find(filter)
    .sort({ priority: 1, createdAt: 1 })
    .limit(limit);
};

eventQueueSchema.statics.getRetryableEvents = async function(limit = 10) {
  const now = new Date();
  
  return this.find({
    status: 'failed',
    'processing.attempts': { $lt: this.schema.obj.processing.maxAttempts.default },
    $or: [
      { 'processing.nextRetryAt': { $exists: false } },
      { 'processing.nextRetryAt': { $lte: now } }
    ]
  })
  .sort({ priority: 1, 'processing.nextRetryAt': 1 })
  .limit(limit);
};

eventQueueSchema.statics.getEventsByBatch = async function(batchId) {
  return this.find({ batchId }).sort({ createdAt: 1 });
};

eventQueueSchema.statics.getEventStats = async function(hotelId = null, dateFrom = null) {
  const matchStage = {};
  if (hotelId) matchStage['payload.hotelId'] = new mongoose.Types.ObjectId(hotelId);
  if (dateFrom) matchStage.createdAt = { $gte: dateFrom };
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          eventType: '$eventType',
          status: '$status'
        },
        count: { $sum: 1 },
        avgProcessingTime: { $avg: '$processing.processingDuration' }
      }
    },
    {
      $group: {
        _id: '$_id.eventType',
        stats: {
          $push: {
            status: '$_id.status',
            count: '$count',
            avgProcessingTime: '$avgProcessingTime'
          }
        },
        totalCount: { $sum: '$count' }
      }
    }
  ]);
};

export default mongoose.model('EventQueue', eventQueueSchema);
