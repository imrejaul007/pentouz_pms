import mongoose from 'mongoose';

const seasonSchema = new mongoose.Schema({
  seasonId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['peak', 'high', 'shoulder', 'low', 'off', 'custom'],
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true,
    validate: {
      validator: function(endDate) {
        return endDate > this.startDate;
      },
      message: 'End date must be after start date'
    }
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringPattern: {
    type: {
      type: String,
      enum: ['yearly', 'monthly', 'weekly'],
      default: 'yearly'
    },
    interval: {
      type: Number,
      default: 1,
      min: 1
    }
  },
  rateAdjustments: [{
    roomType: {
      type: String,
      enum: ['single', 'double', 'suite', 'deluxe', 'all'],
      default: 'all'
    },
    adjustmentType: {
      type: String,
      enum: ['percentage', 'fixed', 'absolute'],
      default: 'percentage'
    },
    adjustmentValue: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true
    }
  }],
  applicableRatePlans: [{
    type: String,
    ref: 'RatePlan'
  }],
  restrictions: {
    minLength: {
      type: Number,
      default: 1,
      min: 1
    },
    maxLength: {
      type: Number,
      default: 30
    },
    closedToArrival: [Date],
    closedToDeparture: [Date],
    dayOfWeekRestrictions: {
      monday: { type: Boolean, default: true },
      tuesday: { type: Boolean, default: true },
      wednesday: { type: Boolean, default: true },
      thursday: { type: Boolean, default: true },
      friday: { type: Boolean, default: true },
      saturday: { type: Boolean, default: true },
      sunday: { type: Boolean, default: true }
    }
  },
  bookingWindow: {
    minAdvanceBooking: {
      type: Number,
      default: 0,
      min: 0
    },
    maxAdvanceBooking: {
      type: Number,
      default: 365,
      min: 1
    }
  },
  priority: {
    type: Number,
    default: 0,
    min: 0
  },
  tags: [String],
  color: {
    type: String,
    default: '#3B82F6',
    match: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

seasonSchema.virtual('duration').get(function() {
  return Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24));
});

seasonSchema.virtual('isCurrentlyActive').get(function() {
  const now = new Date();
  return this.isActive && now >= this.startDate && now <= this.endDate;
});

seasonSchema.index({ startDate: 1, endDate: 1 });
seasonSchema.index({ seasonId: 1 });
seasonSchema.index({ type: 1, isActive: 1 });
seasonSchema.index({ priority: -1 });
seasonSchema.index({ tags: 1 });

seasonSchema.methods.isApplicableToRatePlan = function(ratePlanId) {
  return this.applicableRatePlans.length === 0 || 
         this.applicableRatePlans.includes(ratePlanId);
};

seasonSchema.methods.getAdjustmentForRoomType = function(roomType) {
  const adjustment = this.rateAdjustments.find(
    adj => adj.roomType === roomType || adj.roomType === 'all'
  );
  return adjustment || null;
};

seasonSchema.methods.isValidForDate = function(date) {
  const checkDate = new Date(date);
  return checkDate >= this.startDate && checkDate <= this.endDate;
};

seasonSchema.pre('save', function(next) {
  if (!this.seasonId) {
    this.seasonId = `season_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

export default mongoose.models.Season || mongoose.model('Season', seasonSchema);
