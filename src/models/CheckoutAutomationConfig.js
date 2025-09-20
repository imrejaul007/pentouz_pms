import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     CheckoutAutomationConfig:
 *       type: object
 *       required:
 *         - hotelId
 *       properties:
 *         _id:
 *           type: string
 *         hotelId:
 *           type: string
 *           description: Hotel ID this configuration belongs to
 *         isEnabled:
 *           type: boolean
 *           description: Whether checkout automation is enabled
 *         isLaundryAutomationEnabled:
 *           type: boolean
 *           description: Whether laundry automation is enabled
 *         isInventoryAutomationEnabled:
 *           type: boolean
 *           description: Whether inventory automation is enabled
 *         isHousekeepingAutomationEnabled:
 *           type: boolean
 *           description: Whether housekeeping automation is enabled
 *         defaultLaundryReturnDays:
 *           type: number
 *           description: Default days for laundry return
 *         automaticTaskAssignment:
 *           type: boolean
 *           description: Whether to automatically assign tasks to staff
 *         settings:
 *           type: object
 *           description: Detailed automation settings
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const checkoutAutomationConfigSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required'],
    unique: true,
    index: true
  },
  isEnabled: {
    type: Boolean,
    default: true,
    description: 'Master switch for checkout automation'
  },
  isLaundryAutomationEnabled: {
    type: Boolean,
    default: true,
    description: 'Enable automatic laundry processing on checkout'
  },
  isInventoryAutomationEnabled: {
    type: Boolean,
    default: true,
    description: 'Enable automatic inventory assessment on checkout'
  },
  isHousekeepingAutomationEnabled: {
    type: Boolean,
    default: true,
    description: 'Enable automatic housekeeping task creation on checkout'
  },
  defaultLaundryReturnDays: {
    type: Number,
    default: 1,
    min: [1, 'Laundry return days must be at least 1'],
    max: [7, 'Laundry return days cannot exceed 7'],
    description: 'Default number of days for laundry return'
  },
  automaticTaskAssignment: {
    type: Boolean,
    default: true,
    description: 'Automatically assign housekeeping tasks to available staff'
  },
  settings: {
    laundryCategories: {
      type: [String],
      default: ['bedding', 'towels', 'bathrobes', 'curtains'],
      enum: {
        values: ['bedding', 'towels', 'bathrobes', 'curtains', 'carpets', 'other'],
        message: 'Invalid laundry category'
      },
      description: 'Item categories that require laundry processing'
    },
    inventoryCheckCategories: {
      type: [String],
      default: ['toiletries', 'amenities', 'electronics'],
      enum: {
        values: ['toiletries', 'amenities', 'electronics', 'furniture', 'cleaning', 'other'],
        message: 'Invalid inventory check category'
      },
      description: 'Item categories to check during inventory assessment'
    },
    housekeepingTaskTypes: {
      type: [String],
      default: ['checkout_clean', 'deep_clean'],
      enum: {
        values: ['cleaning', 'maintenance', 'inspection', 'deep_clean', 'checkout_clean'],
        message: 'Invalid housekeeping task type'
      },
      description: 'Types of housekeeping tasks to create automatically'
    },
    roomStatusFlow: {
      type: [String],
      default: ['dirty', 'cleaning', 'ready'],
      description: 'Room status flow after checkout'
    },
    notificationSettings: {
      notifyOnSuccess: {
        type: Boolean,
        default: true,
        description: 'Send notifications when automation succeeds'
      },
      notifyOnFailure: {
        type: Boolean,
        default: true,
        description: 'Send notifications when automation fails'
      },
      notifyRecipients: {
        type: [String],
        default: ['admin', 'housekeeping_manager'],
        enum: ['admin', 'manager', 'housekeeping_manager', 'front_desk', 'all_staff'],
        description: 'Who to notify about automation results'
      }
    },
    costSettings: {
      includeLaundryCosts: {
        type: Boolean,
        default: false,
        description: 'Include laundry costs in guest billing'
      },
      includeInventoryCosts: {
        type: Boolean,
        default: true,
        description: 'Include inventory replacement costs in guest billing'
      },
      markupPercentage: {
        type: Number,
        default: 0,
        min: [0, 'Markup percentage cannot be negative'],
        max: [100, 'Markup percentage cannot exceed 100%'],
        description: 'Markup percentage for automated charges'
      }
    },
    timingSettings: {
      processingDelay: {
        type: Number,
        default: 0,
        min: [0, 'Processing delay cannot be negative'],
        max: [60, 'Processing delay cannot exceed 60 minutes'],
        description: 'Delay in minutes before starting automation'
      },
      maxProcessingTime: {
        type: Number,
        default: 30,
        min: [5, 'Max processing time must be at least 5 minutes'],
        max: [120, 'Max processing time cannot exceed 120 minutes'],
        description: 'Maximum time allowed for automation processing'
      },
      retryAttempts: {
        type: Number,
        default: 3,
        min: [0, 'Retry attempts cannot be negative'],
        max: [10, 'Retry attempts cannot exceed 10'],
        description: 'Number of retry attempts for failed automation'
      }
    }
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    description: 'User who created this configuration'
  },
  lastUpdatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    description: 'User who last updated this configuration'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
checkoutAutomationConfigSchema.index({ hotelId: 1, isEnabled: 1 });

// Virtual for configuration summary
checkoutAutomationConfigSchema.virtual('summary').get(function() {
  return {
    isEnabled: this.isEnabled,
    enabledFeatures: {
      laundry: this.isLaundryAutomationEnabled,
      inventory: this.isInventoryAutomationEnabled,
      housekeeping: this.isHousekeepingAutomationEnabled
    },
    defaultLaundryReturnDays: this.defaultLaundryReturnDays,
    automaticTaskAssignment: this.automaticTaskAssignment
  };
});

// Pre-save middleware
checkoutAutomationConfigSchema.pre('save', function(next) {
  // Validate that at least one automation type is enabled if master switch is on
  if (this.isEnabled && 
      !this.isLaundryAutomationEnabled && 
      !this.isInventoryAutomationEnabled && 
      !this.isHousekeepingAutomationEnabled) {
    return next(new Error('At least one automation type must be enabled when automation is enabled'));
  }
  
  next();
});

// Instance method to enable/disable all automation
checkoutAutomationConfigSchema.methods.toggleAutomation = function(enabled) {
  this.isEnabled = enabled;
  return this.save();
};

// Instance method to enable/disable specific automation type
checkoutAutomationConfigSchema.methods.toggleAutomationType = function(type, enabled) {
  switch (type) {
    case 'laundry':
      this.isLaundryAutomationEnabled = enabled;
      break;
    case 'inventory':
      this.isInventoryAutomationEnabled = enabled;
      break;
    case 'housekeeping':
      this.isHousekeepingAutomationEnabled = enabled;
      break;
    default:
      throw new Error(`Invalid automation type: ${type}`);
  }
  return this.save();
};

// Instance method to update settings
checkoutAutomationConfigSchema.methods.updateSettings = function(newSettings) {
  this.settings = { ...this.settings, ...newSettings };
  return this.save();
};

// Static method to get configuration for hotel
checkoutAutomationConfigSchema.statics.getForHotel = function(hotelId) {
  return this.findOne({ hotelId });
};

// Static method to create default configuration
checkoutAutomationConfigSchema.statics.createDefault = function(hotelId, createdBy) {
  return this.create({
    hotelId,
    createdBy,
    isEnabled: true,
    isLaundryAutomationEnabled: true,
    isInventoryAutomationEnabled: true,
    isHousekeepingAutomationEnabled: true,
    defaultLaundryReturnDays: 1,
    automaticTaskAssignment: true,
    settings: {
      laundryCategories: ['bedding', 'towels', 'bathrobes', 'curtains'],
      inventoryCheckCategories: ['toiletries', 'amenities', 'electronics'],
      housekeepingTaskTypes: ['checkout_clean', 'deep_clean'],
      roomStatusFlow: ['dirty', 'cleaning', 'ready'],
      notificationSettings: {
        notifyOnSuccess: true,
        notifyOnFailure: true,
        notifyRecipients: ['admin', 'housekeeping_manager']
      },
      costSettings: {
        includeLaundryCosts: false,
        includeInventoryCosts: true,
        markupPercentage: 0
      },
      timingSettings: {
        processingDelay: 0,
        maxProcessingTime: 30,
        retryAttempts: 3
      }
    }
  });
};

export default mongoose.model('CheckoutAutomationConfig', checkoutAutomationConfigSchema);
