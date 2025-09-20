import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     CheckoutAutomationLog:
 *       type: object
 *       required:
 *         - bookingId
 *         - automationType
 *         - status
 *       properties:
 *         _id:
 *           type: string
 *         bookingId:
 *           type: string
 *           description: Booking ID this log entry belongs to
 *         roomId:
 *           type: string
 *           description: Room ID (if applicable)
 *         automationType:
 *           type: string
 *           enum: [checkout_processing, laundry_automation, inventory_automation, housekeeping_automation]
 *           description: Type of automation performed
 *         status:
 *           type: string
 *           enum: [started, completed, partial_success, failed, cancelled]
 *           description: Status of the automation
 *         details:
 *           type: array
 *           items:
 *             type: object
 *           description: Array of log details and results
 *         processedAt:
 *           type: string
 *           format: date-time
 *           description: When the automation was processed
 *         completedAt:
 *           type: string
 *           format: date-time
 *           description: When the automation was completed
 *         processingTime:
 *           type: number
 *           description: Processing time in milliseconds
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const checkoutAutomationLogSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Booking',
    required: [true, 'Booking ID is required'],
    index: true
  },
  roomId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Room',
    index: true,
    description: 'Room ID if automation is room-specific'
  },
  automationType: {
    type: String,
    required: [true, 'Automation type is required'],
    enum: {
      values: [
        'checkout_processing',
        'laundry_automation', 
        'inventory_automation',
        'housekeeping_automation',
        'room_status_update'
      ],
      message: 'Invalid automation type'
    },
    index: true
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: {
      values: ['started', 'completed', 'partial_success', 'failed', 'cancelled'],
      message: 'Invalid status'
    },
    default: 'started',
    index: true
  },
  details: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    step: {
      type: String,
      description: 'Step or action being performed'
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      description: 'Step-specific data or results'
    },
    success: {
      type: Boolean,
      description: 'Whether this step was successful'
    },
    error: {
      type: String,
      description: 'Error message if step failed'
    },
    duration: {
      type: Number,
      description: 'Duration of this step in milliseconds'
    }
  }],
  processedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  completedAt: {
    type: Date,
    description: 'When the automation was completed'
  },
  processingTime: {
    type: Number,
    description: 'Total processing time in milliseconds'
  },
  initiatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    description: 'User who initiated the automation'
  },
  systemInfo: {
    version: {
      type: String,
      description: 'System version when automation was run'
    },
    environment: {
      type: String,
      enum: ['development', 'staging', 'production'],
      description: 'Environment where automation was run'
    },
    serverId: {
      type: String,
      description: 'Server identifier'
    }
  },
  metadata: {
    retryCount: {
      type: Number,
      default: 0,
      description: 'Number of retry attempts'
    },
    originalError: {
      type: String,
      description: 'Original error message if this is a retry'
    },
    parentLogId: {
      type: mongoose.Schema.ObjectId,
      ref: 'CheckoutAutomationLog',
      description: 'Parent log ID if this is a retry'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
checkoutAutomationLogSchema.index({ bookingId: 1, processedAt: -1 });
checkoutAutomationLogSchema.index({ automationType: 1, status: 1 });
checkoutAutomationLogSchema.index({ processedAt: -1 });
checkoutAutomationLogSchema.index({ status: 1, processedAt: -1 });

// Virtual for formatted processing time
checkoutAutomationLogSchema.virtual('formattedProcessingTime').get(function() {
  if (!this.processingTime) return 'N/A';
  
  const seconds = Math.floor(this.processingTime / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
});

// Virtual for success rate
checkoutAutomationLogSchema.virtual('successRate').get(function() {
  if (!this.details || this.details.length === 0) return 0;
  
  const successfulSteps = this.details.filter(detail => detail.success === true).length;
  return Math.round((successfulSteps / this.details.length) * 100);
});

// Pre-save middleware to calculate processing time
checkoutAutomationLogSchema.pre('save', function(next) {
  if (this.completedAt && this.processedAt) {
    this.processingTime = this.completedAt.getTime() - this.processedAt.getTime();
  }
  next();
});

// Instance method to add a detail entry
checkoutAutomationLogSchema.methods.addDetail = function(step, data, success = true, error = null, duration = null) {
  this.details.push({
    timestamp: new Date(),
    step,
    data,
    success,
    error,
    duration
  });
  return this.save();
};

// Instance method to mark as completed
checkoutAutomationLogSchema.methods.markCompleted = function(status = 'completed') {
  this.status = status;
  this.completedAt = new Date();
  return this.save();
};

// Instance method to mark as failed
checkoutAutomationLogSchema.methods.markFailed = function(error) {
  this.status = 'failed';
  this.completedAt = new Date();
  this.addDetail('automation_failed', null, false, error);
  return this.save();
};

// Static method to get logs for booking
checkoutAutomationLogSchema.statics.getForBooking = function(bookingId, limit = 10) {
  return this.find({ bookingId })
    .sort({ processedAt: -1 })
    .limit(limit)
    .populate('initiatedBy', 'name email');
};

// Static method to get logs by status
checkoutAutomationLogSchema.statics.getByStatus = function(status, limit = 50) {
  return this.find({ status })
    .sort({ processedAt: -1 })
    .limit(limit)
    .populate('bookingId', 'bookingNumber')
    .populate('roomId', 'roomNumber')
    .populate('initiatedBy', 'name email');
};

// Static method to get failed automations
checkoutAutomationLogSchema.statics.getFailedAutomations = function(hours = 24, limit = 100) {
  const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
  
  return this.find({
    status: 'failed',
    processedAt: { $gte: cutoffTime }
  })
    .sort({ processedAt: -1 })
    .limit(limit)
    .populate('bookingId', 'bookingNumber')
    .populate('roomId', 'roomNumber')
    .populate('initiatedBy', 'name email');
};

// Static method to get automation statistics
checkoutAutomationLogSchema.statics.getStatistics = function(hotelId, dateRange = {}) {
  const matchQuery = {};
  
  if (hotelId) {
    matchQuery['bookingId.hotelId'] = hotelId;
  }
  
  if (dateRange.start && dateRange.end) {
    matchQuery.processedAt = {
      $gte: new Date(dateRange.start),
      $lte: new Date(dateRange.end)
    };
  }

  return this.aggregate([
    { $match: matchQuery },
    {
      $lookup: {
        from: 'bookings',
        localField: 'bookingId',
        foreignField: '_id',
        as: 'booking'
      }
    },
    { $unwind: '$booking' },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgProcessingTime: { $avg: '$processingTime' },
        totalProcessingTime: { $sum: '$processingTime' }
      }
    },
    {
      $group: {
        _id: null,
        statusBreakdown: {
          $push: {
            status: '$_id',
            count: '$count',
            avgProcessingTime: '$avgProcessingTime',
            totalProcessingTime: '$totalProcessingTime'
          }
        },
        totalAutomations: { $sum: '$count' },
        totalProcessingTime: { $sum: '$totalProcessingTime' }
      }
    },
    {
      $project: {
        _id: 0,
        totalAutomations: 1,
        totalProcessingTime: 1,
        avgProcessingTime: { $divide: ['$totalProcessingTime', '$totalAutomations'] },
        statusBreakdown: 1,
        successRate: {
          $multiply: [
            {
              $divide: [
                {
                  $sum: {
                    $cond: [
                      { $eq: ['$statusBreakdown.status', 'completed'] },
                      '$statusBreakdown.count',
                      0
                    ]
                  }
                },
                '$totalAutomations'
              ]
            },
            100
          ]
        }
      }
    }
  ]);
};

export default mongoose.model('CheckoutAutomationLog', checkoutAutomationLogSchema);
