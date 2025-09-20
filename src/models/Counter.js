import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     Counter:
 *       type: object
 *       required:
 *         - name
 *         - code
 *         - type
 *         - isActive
 *       properties:
 *         _id:
 *           type: string
 *           description: Counter ID
 *         name:
 *           type: string
 *           description: Counter name
 *         code:
 *           type: string
 *           description: Unique code for the counter
 *         type:
 *           type: string
 *           enum: [front_desk, concierge, housekeeping, maintenance, security, restaurant, spa, business_center, other]
 *           description: Counter type
 *         description:
 *           type: string
 *           description: Counter description
 *         location:
 *           type: object
 *           properties:
 *             floor:
 *               type: number
 *               description: Floor number
 *             room:
 *               type: string
 *               description: Room or area identifier
 *             coordinates:
 *               type: object
 *               properties:
 *                 x:
 *                   type: number
 *                 y:
 *                   type: number
 *         isActive:
 *           type: boolean
 *           description: Whether the counter is active
 *         status:
 *           type: string
 *           enum: [available, busy, offline, maintenance]
 *           default: available
 *         capacity:
 *           type: object
 *           properties:
 *             maxConcurrentUsers:
 *               type: number
 *               description: Maximum concurrent users
 *             maxDailyTransactions:
 *               type: number
 *               description: Maximum daily transactions
 *         operatingHours:
 *           type: object
 *           properties:
 *             startTime:
 *               type: string
 *               format: time
 *             endTime:
 *               type: string
 *               format: time
 *             timezone:
 *               type: string
 *             workingDays:
 *               type: array
 *               items:
 *                 type: string
 *                 enum: [monday, tuesday, wednesday, thursday, friday, saturday, sunday]
 *         permissions:
 *           type: object
 *           properties:
 *             allowedRoles:
 *               type: array
 *               items:
 *                 type: string
 *             allowedDepartments:
 *               type: array
 *               items:
 *                 type: string
 *             requiresApproval:
 *               type: boolean
 *         features:
 *           type: object
 *           properties:
 *             supportsCheckIn:
 *               type: boolean
 *             supportsCheckOut:
 *               type: boolean
 *             supportsPayment:
 *               type: boolean
 *             supportsKeyIssuance:
 *               type: boolean
 *             supportsGuestServices:
 *               type: boolean
 *         analytics:
 *           type: object
 *           properties:
 *             totalTransactions:
 *               type: number
 *               default: 0
 *             averageTransactionTime:
 *               type: number
 *               default: 0
 *             peakHours:
 *               type: array
 *               items:
 *                 type: string
 *             lastUsed:
 *               type: string
 *               format: date-time
 *         hotelId:
 *           type: string
 *           description: Hotel ID this counter belongs to
 *         createdBy:
 *           type: string
 *           description: User who created this counter
 *         updatedBy:
 *           type: string
 *           description: User who last updated this counter
 */

const counterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Counter name is required'],
    trim: true,
    maxLength: [100, 'Counter name cannot exceed 100 characters'],
    index: true
  },
  code: {
    type: String,
    required: [true, 'Counter code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxLength: [20, 'Counter code cannot exceed 20 characters'],
    match: [/^[A-Z0-9_-]+$/, 'Counter code can only contain letters, numbers, underscores and hyphens']
  },
  type: {
    type: String,
    required: [true, 'Counter type is required'],
    enum: [
      'front_desk', 'concierge', 'housekeeping', 'maintenance', 'security', 
      'restaurant', 'spa', 'business_center', 'other'
    ],
    index: true
  },
  description: {
    type: String,
    maxLength: [500, 'Description cannot exceed 500 characters']
  },
  location: {
    floor: {
      type: Number,
      min: -10,
      max: 100
    },
    room: {
      type: String,
      trim: true,
      maxLength: [50, 'Room identifier cannot exceed 50 characters']
    },
    coordinates: {
      x: {
        type: Number,
        min: 0,
        max: 1000
      },
      y: {
        type: Number,
        min: 0,
        max: 1000
      }
    }
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  status: {
    type: String,
    enum: ['available', 'busy', 'offline', 'maintenance'],
    default: 'available',
    index: true
  },
  capacity: {
    maxConcurrentUsers: {
      type: Number,
      min: 1,
      max: 50,
      default: 1
    },
    maxDailyTransactions: {
      type: Number,
      min: 1,
      max: 10000,
      default: 1000
    }
  },
  operatingHours: {
    startTime: {
      type: String,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
    },
    endTime: {
      type: String,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    workingDays: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }]
  },
  permissions: {
    allowedRoles: [{
      type: String,
      enum: ['admin', 'manager', 'staff', 'front_desk', 'concierge', 'housekeeping', 'maintenance', 'security']
    }],
    allowedDepartments: [{
      type: mongoose.Schema.ObjectId,
      ref: 'Department'
    }],
    requiresApproval: {
      type: Boolean,
      default: false
    }
  },
  features: {
    supportsCheckIn: {
      type: Boolean,
      default: false
    },
    supportsCheckOut: {
      type: Boolean,
      default: false
    },
    supportsPayment: {
      type: Boolean,
      default: false
    },
    supportsKeyIssuance: {
      type: Boolean,
      default: false
    },
    supportsGuestServices: {
      type: Boolean,
      default: false
    }
  },
  analytics: {
    totalTransactions: {
      type: Number,
      default: 0
    },
    averageTransactionTime: {
      type: Number,
      default: 0
    },
    peakHours: [{
      type: String,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
    }],
    lastUsed: {
      type: Date
    }
  },
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
  updatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
counterSchema.index({ hotelId: 1, type: 1 });
counterSchema.index({ hotelId: 1, status: 1 });
counterSchema.index({ hotelId: 1, isActive: 1 });

// Ensure unique counter codes per hotel
counterSchema.index({ hotelId: 1, code: 1 }, { unique: true });

// Virtual for operating hours summary
counterSchema.virtual('operatingHoursSummary').get(function() {
  if (!this.operatingHours.startTime || !this.operatingHours.endTime) {
    return '24/7';
  }
  return `${this.operatingHours.startTime} - ${this.operatingHours.endTime}`;
});

// Virtual for features summary
counterSchema.virtual('featuresSummary').get(function() {
  const features = [];
  if (this.features.supportsCheckIn) features.push('Check-in');
  if (this.features.supportsCheckOut) features.push('Check-out');
  if (this.features.supportsPayment) features.push('Payment');
  if (this.features.supportsKeyIssuance) features.push('Key Issuance');
  if (this.features.supportsGuestServices) features.push('Guest Services');
  return features.join(', ') || 'Basic Operations';
});

// Instance methods
counterSchema.methods.isOperational = function() {
  if (!this.isActive || this.status === 'offline' || this.status === 'maintenance') {
    return false;
  }

  // Check operating hours
  if (this.operatingHours.startTime && this.operatingHours.endTime) {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    if (this.operatingHours.workingDays && !this.operatingHours.workingDays.includes(currentDay)) {
      return false;
    }
    
    if (currentTime < this.operatingHours.startTime || currentTime > this.operatingHours.endTime) {
      return false;
    }
  }

  return true;
};

counterSchema.methods.canHandleTransaction = function() {
  return this.isOperational() && this.status === 'available';
};

counterSchema.methods.updateAnalytics = function(transactionTime) {
  this.analytics.totalTransactions += 1;
  
  // Update average transaction time
  const currentAvg = this.analytics.averageTransactionTime;
  const totalTransactions = this.analytics.totalTransactions;
  this.analytics.averageTransactionTime = 
    ((currentAvg * (totalTransactions - 1)) + transactionTime) / totalTransactions;
  
  this.analytics.lastUsed = new Date();
  
  return this.save();
};

// Static methods
counterSchema.statics.getByType = function(hotelId, type) {
  return this.find({ hotelId, type, isActive: true })
    .sort({ name: 1 })
    .populate('createdBy updatedBy', 'name email');
};

counterSchema.statics.getOperationalCounters = function(hotelId) {
  return this.find({ hotelId, isActive: true, status: { $in: ['available', 'busy'] } })
    .sort({ type: 1, name: 1 });
};

counterSchema.statics.getAvailableCounters = function(hotelId) {
  return this.find({ hotelId, isActive: true, status: 'available' })
    .sort({ type: 1, name: 1 });
};

counterSchema.statics.getCounterAnalytics = function(hotelId, dateRange) {
  const pipeline = [
    { $match: { hotelId: new mongoose.Types.ObjectId(hotelId), isActive: true } },
    {
      $group: {
        _id: '$type',
        totalCounters: { $sum: 1 },
        availableCounters: {
          $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] }
        },
        totalTransactions: { $sum: '$analytics.totalTransactions' },
        avgTransactionTime: { $avg: '$analytics.averageTransactionTime' }
      }
    },
    { $sort: { _id: 1 } }
  ];

  return this.aggregate(pipeline);
};

// Pre-save middleware
counterSchema.pre('save', function(next) {
  // Validate operating hours
  if (this.operatingHours.startTime && this.operatingHours.endTime) {
    if (this.operatingHours.startTime >= this.operatingHours.endTime) {
      return next(new Error('Start time must be before end time'));
    }
  }

  // Validate capacity
  if (this.capacity.maxConcurrentUsers < 1) {
    return next(new Error('Maximum concurrent users must be at least 1'));
  }

  if (this.capacity.maxDailyTransactions < 1) {
    return next(new Error('Maximum daily transactions must be at least 1'));
  }

  next();
});

const Counter = mongoose.model('Counter', counterSchema);

export default Counter;
