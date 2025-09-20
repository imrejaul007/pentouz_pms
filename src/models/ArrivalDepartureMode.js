import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     ArrivalDepartureMode:
 *       type: object
 *       required:
 *         - name
 *         - code
 *         - type
 *         - isActive
 *       properties:
 *         _id:
 *           type: string
 *           description: Arrival/Departure mode ID
 *         name:
 *           type: string
 *           description: Mode name
 *         code:
 *           type: string
 *           description: Unique code for the mode
 *         type:
 *           type: string
 *           enum: [air, train, bus, car, taxi, walk_in, boat, motorcycle, bicycle, other]
 *           description: Mode type
 *         description:
 *           type: string
 *           description: Mode description
 *         isActive:
 *           type: boolean
 *           description: Whether the mode is active
 *         category:
 *           type: string
 *           enum: [transportation, personal, business, emergency, other]
 *           description: Mode category
 *         icon:
 *           type: string
 *           description: Icon identifier for display
 *         color:
 *           type: string
 *           description: Color code for display purposes
 *         requiresDetails:
 *           type: object
 *           properties:
 *             flightNumber:
 *               type: boolean
 *               description: Whether flight number is required
 *             trainNumber:
 *               type: boolean
 *               description: Whether train number is required
 *             busNumber:
 *               type: boolean
 *               description: Whether bus number is required
 *             vehicleNumber:
 *               type: boolean
 *               description: Whether vehicle number is required
 *             driverName:
 *               type: boolean
 *               description: Whether driver name is required
 *             driverPhone:
 *               type: boolean
 *               description: Whether driver phone is required
 *             company:
 *               type: boolean
 *               description: Whether company name is required
 *             estimatedTime:
 *               type: boolean
 *               description: Whether estimated time is required
 *         tracking:
 *           type: object
 *           properties:
 *             trackArrival:
 *               type: boolean
 *               description: Whether to track arrival
 *             trackDeparture:
 *               type: boolean
 *               description: Whether to track departure
 *             trackDelays:
 *               type: boolean
 *               description: Whether to track delays
 *             trackCancellations:
 *               type: boolean
 *               description: Whether to track cancellations
 *         analytics:
 *           type: object
 *           properties:
 *             totalUsage:
 *               type: number
 *               default: 0
 *             averageDelay:
 *               type: number
 *               default: 0
 *             onTimePercentage:
 *               type: number
 *               default: 100
 *             lastUsed:
 *               type: string
 *               format: date-time
 *         displayOrder:
 *           type: number
 *           description: Display order in lists
 *         hotelId:
 *           type: string
 *           description: Hotel ID this mode belongs to
 *         createdBy:
 *           type: string
 *           description: User who created this mode
 *         updatedBy:
 *           type: string
 *           description: User who last updated this mode
 */

const arrivalDepartureModeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Mode name is required'],
    trim: true,
    maxLength: [100, 'Mode name cannot exceed 100 characters'],
    index: true
  },
  code: {
    type: String,
    required: [true, 'Mode code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxLength: [20, 'Mode code cannot exceed 20 characters'],
    match: [/^[A-Z0-9_-]+$/, 'Mode code can only contain letters, numbers, underscores and hyphens']
  },
  type: {
    type: String,
    required: [true, 'Mode type is required'],
    enum: [
      'air', 'train', 'bus', 'car', 'taxi', 'walk_in', 'boat', 
      'motorcycle', 'bicycle', 'other'
    ],
    index: true
  },
  description: {
    type: String,
    maxLength: [500, 'Description cannot exceed 500 characters']
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  category: {
    type: String,
    required: [true, 'Mode category is required'],
    enum: ['transportation', 'personal', 'business', 'emergency', 'other'],
    index: true
  },
  icon: {
    type: String,
    trim: true,
    default: 'transport'
  },
  color: {
    type: String,
    match: [/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color code'],
    default: '#3B82F6'
  },
  requiresDetails: {
    flightNumber: {
      type: Boolean,
      default: false
    },
    trainNumber: {
      type: Boolean,
      default: false
    },
    busNumber: {
      type: Boolean,
      default: false
    },
    vehicleNumber: {
      type: Boolean,
      default: false
    },
    driverName: {
      type: Boolean,
      default: false
    },
    driverPhone: {
      type: Boolean,
      default: false
    },
    company: {
      type: Boolean,
      default: false
    },
    estimatedTime: {
      type: Boolean,
      default: false
    }
  },
  tracking: {
    trackArrival: {
      type: Boolean,
      default: true
    },
    trackDeparture: {
      type: Boolean,
      default: true
    },
    trackDelays: {
      type: Boolean,
      default: false
    },
    trackCancellations: {
      type: Boolean,
      default: false
    }
  },
  analytics: {
    totalUsage: {
      type: Number,
      default: 0
    },
    averageDelay: {
      type: Number,
      default: 0
    },
    onTimePercentage: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    },
    lastUsed: {
      type: Date
    }
  },
  displayOrder: {
    type: Number,
    default: 0
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
arrivalDepartureModeSchema.index({ hotelId: 1, type: 1 });
arrivalDepartureModeSchema.index({ hotelId: 1, category: 1 });
arrivalDepartureModeSchema.index({ hotelId: 1, isActive: 1 });
arrivalDepartureModeSchema.index({ hotelId: 1, displayOrder: 1 });

// Ensure unique mode codes per hotel
arrivalDepartureModeSchema.index({ hotelId: 1, code: 1 }, { unique: true });

// Virtual for required details summary
arrivalDepartureModeSchema.virtual('requiredDetailsSummary').get(function() {
  const details = [];
  if (this.requiresDetails.flightNumber) details.push('Flight Number');
  if (this.requiresDetails.trainNumber) details.push('Train Number');
  if (this.requiresDetails.busNumber) details.push('Bus Number');
  if (this.requiresDetails.vehicleNumber) details.push('Vehicle Number');
  if (this.requiresDetails.driverName) details.push('Driver Name');
  if (this.requiresDetails.driverPhone) details.push('Driver Phone');
  if (this.requiresDetails.company) details.push('Company');
  if (this.requiresDetails.estimatedTime) details.push('Estimated Time');
  return details.join(', ') || 'No additional details required';
});

// Virtual for tracking summary
arrivalDepartureModeSchema.virtual('trackingSummary').get(function() {
  const tracking = [];
  if (this.tracking.trackArrival) tracking.push('Arrival');
  if (this.tracking.trackDeparture) tracking.push('Departure');
  if (this.tracking.trackDelays) tracking.push('Delays');
  if (this.tracking.trackCancellations) tracking.push('Cancellations');
  return tracking.join(', ');
});

// Instance methods
arrivalDepartureModeSchema.methods.getRequiredFields = function() {
  const fields = [];
  
  if (this.requiresDetails.flightNumber) fields.push('flightNumber');
  if (this.requiresDetails.trainNumber) fields.push('trainNumber');
  if (this.requiresDetails.busNumber) fields.push('busNumber');
  if (this.requiresDetails.vehicleNumber) fields.push('vehicleNumber');
  if (this.requiresDetails.driverName) fields.push('driverName');
  if (this.requiresDetails.driverPhone) fields.push('driverPhone');
  if (this.requiresDetails.company) fields.push('company');
  if (this.requiresDetails.estimatedTime) fields.push('estimatedTime');
  
  return fields;
};

arrivalDepartureModeSchema.methods.validateDetails = function(details) {
  const errors = [];
  const requiredFields = this.getRequiredFields();
  
  for (const field of requiredFields) {
    if (!details[field] || details[field].toString().trim() === '') {
      const fieldName = field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1');
      errors.push(`${fieldName} is required for ${this.name}`);
    }
  }
  
  return errors;
};

arrivalDepartureModeSchema.methods.updateAnalytics = function(delay = 0, isOnTime = true) {
  this.analytics.totalUsage += 1;
  
  // Update average delay
  const currentAvg = this.analytics.averageDelay;
  const totalUsage = this.analytics.totalUsage;
  this.analytics.averageDelay = 
    ((currentAvg * (totalUsage - 1)) + delay) / totalUsage;
  
  // Update on-time percentage
  const currentOnTime = this.analytics.onTimePercentage;
  const onTimeCount = Math.round((currentOnTime / 100) * (totalUsage - 1));
  const newOnTimeCount = onTimeCount + (isOnTime ? 1 : 0);
  this.analytics.onTimePercentage = (newOnTimeCount / totalUsage) * 100;
  
  this.analytics.lastUsed = new Date();
  
  return this.save();
};

// Static methods
arrivalDepartureModeSchema.statics.getByType = function(hotelId, type) {
  return this.find({ hotelId, type, isActive: true })
    .sort({ displayOrder: 1, name: 1 })
    .populate('createdBy updatedBy', 'name email');
};

arrivalDepartureModeSchema.statics.getByCategory = function(hotelId, category) {
  return this.find({ hotelId, category, isActive: true })
    .sort({ displayOrder: 1, name: 1 })
    .populate('createdBy updatedBy', 'name email');
};

arrivalDepartureModeSchema.statics.getActiveModes = function(hotelId) {
  return this.find({ hotelId, isActive: true })
    .sort({ category: 1, displayOrder: 1, name: 1 })
    .populate('createdBy updatedBy', 'name email');
};

arrivalDepartureModeSchema.statics.getModeAnalytics = function(hotelId, dateRange) {
  const pipeline = [
    { $match: { hotelId: new mongoose.Types.ObjectId(hotelId), isActive: true } },
    {
      $group: {
        _id: '$type',
        totalModes: { $sum: 1 },
        totalUsage: { $sum: '$analytics.totalUsage' },
        avgDelay: { $avg: '$analytics.averageDelay' },
        avgOnTimePercentage: { $avg: '$analytics.onTimePercentage' }
      }
    },
    { $sort: { _id: 1 } }
  ];

  return this.aggregate(pipeline);
};

arrivalDepartureModeSchema.statics.getPopularModes = function(hotelId, limit = 5) {
  return this.find({ hotelId, isActive: true })
    .sort({ 'analytics.totalUsage': -1 })
    .limit(limit)
    .select('name type analytics.totalUsage analytics.onTimePercentage');
};

// Pre-save middleware
arrivalDepartureModeSchema.pre('save', function(next) {
  // Ensure display order is set
  if (this.displayOrder === undefined || this.displayOrder === null) {
    this.displayOrder = 0;
  }

  // Validate on-time percentage
  if (this.analytics.onTimePercentage < 0 || this.analytics.onTimePercentage > 100) {
    return next(new Error('On-time percentage must be between 0 and 100'));
  }

  next();
});

const ArrivalDepartureMode = mongoose.model('ArrivalDepartureMode', arrivalDepartureModeSchema);

export default ArrivalDepartureMode;
