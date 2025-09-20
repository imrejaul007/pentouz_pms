import mongoose from 'mongoose';

const specialPeriodSchema = new mongoose.Schema({
  periodId: {
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
    enum: [
      'holiday', 'festival', 'event', 'conference', 
      'wedding_season', 'sports_event', 'blackout', 
      'maintenance', 'custom'
    ],
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
        return endDate >= this.startDate;
      },
      message: 'End date must be on or after start date'
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
    },
    endRecurrence: Date
  },
  rateOverrides: [{
    roomType: {
      type: String,
      enum: ['single', 'double', 'suite', 'deluxe', 'all'],
      default: 'all'
    },
    overrideType: {
      type: String,
      enum: ['percentage', 'fixed', 'absolute', 'block'],
      default: 'percentage'
    },
    overrideValue: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true
    }
  }],
  restrictions: {
    bookingRestriction: {
      type: String,
      enum: ['none', 'closed_to_arrival', 'closed_to_departure', 'closed_to_both', 'blocked'],
      default: 'none'
    },
    minLength: {
      type: Number,
      default: 1,
      min: 1
    },
    maxLength: {
      type: Number,
      default: 30
    },
    mustStayThrough: {
      type: Boolean,
      default: false
    }
  },
  applicableRatePlans: [{
    type: String,
    ref: 'RatePlan'
  }],
  eventDetails: {
    eventName: String,
    venue: String,
    organizer: String,
    expectedAttendees: Number,
    impactRadius: {
      type: Number,
      default: 10
    }
  },
  demand: {
    level: {
      type: String,
      enum: ['very_low', 'low', 'normal', 'high', 'very_high', 'extreme'],
      default: 'normal'
    },
    expectedOccupancy: {
      type: Number,
      min: 0,
      max: 100
    },
    competitorImpact: {
      type: String,
      enum: ['none', 'low', 'medium', 'high'],
      default: 'medium'
    }
  },
  priority: {
    type: Number,
    default: 100,
    min: 0,
    max: 1000
  },
  tags: [String],
  color: {
    type: String,
    default: '#EF4444',
    match: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
  },
  alerts: {
    emailNotification: {
      type: Boolean,
      default: true
    },
    daysBeforeAlert: {
      type: Number,
      default: 30,
      min: 1
    },
    recipients: [String]
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

specialPeriodSchema.virtual('duration').get(function() {
  return Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24)) + 1;
});

specialPeriodSchema.virtual('isCurrentlyActive').get(function() {
  const now = new Date();
  return this.isActive && now >= this.startDate && now <= this.endDate;
});

specialPeriodSchema.virtual('daysUntilStart').get(function() {
  const now = new Date();
  if (now >= this.startDate) return 0;
  return Math.ceil((this.startDate - now) / (1000 * 60 * 60 * 24));
});

specialPeriodSchema.virtual('isBlackoutPeriod').get(function() {
  return this.type === 'blackout' || 
         this.restrictions.bookingRestriction === 'blocked';
});

specialPeriodSchema.index({ startDate: 1, endDate: 1 });
specialPeriodSchema.index({ periodId: 1 });
specialPeriodSchema.index({ type: 1, isActive: 1 });
specialPeriodSchema.index({ priority: -1 });
specialPeriodSchema.index({ tags: 1 });
specialPeriodSchema.index({ 'demand.level': 1 });

specialPeriodSchema.methods.isApplicableToRatePlan = function(ratePlanId) {
  return this.applicableRatePlans.length === 0 || 
         this.applicableRatePlans.includes(ratePlanId);
};

specialPeriodSchema.methods.getOverrideForRoomType = function(roomType) {
  const override = this.rateOverrides.find(
    ovr => ovr.roomType === roomType || ovr.roomType === 'all'
  );
  return override || null;
};

specialPeriodSchema.methods.isValidForDate = function(date) {
  const checkDate = new Date(date);
  return checkDate >= this.startDate && checkDate <= this.endDate;
};

specialPeriodSchema.methods.isBookingAllowed = function(arrivalDate, departureDate) {
  const arrival = new Date(arrivalDate);
  const departure = new Date(departureDate);
  
  switch (this.restrictions.bookingRestriction) {
    case 'blocked':
      return false;
    case 'closed_to_arrival':
      return arrival < this.startDate || arrival > this.endDate;
    case 'closed_to_departure':
      return departure < this.startDate || departure > this.endDate;
    case 'closed_to_both':
      return (arrival < this.startDate || arrival > this.endDate) &&
             (departure < this.startDate || departure > this.endDate);
    default:
      return true;
  }
};

specialPeriodSchema.methods.generateNextOccurrence = function() {
  if (!this.isRecurring) return null;
  
  const next = new Date(this.startDate);
  const duration = this.endDate - this.startDate;
  
  switch (this.recurringPattern.type) {
    case 'yearly':
      next.setFullYear(next.getFullYear() + this.recurringPattern.interval);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + this.recurringPattern.interval);
      break;
    case 'weekly':
      next.setDate(next.getDate() + (7 * this.recurringPattern.interval));
      break;
  }
  
  if (this.recurringPattern.endRecurrence && next > this.recurringPattern.endRecurrence) {
    return null;
  }
  
  return {
    startDate: next,
    endDate: new Date(next.getTime() + duration)
  };
};

specialPeriodSchema.pre('save', function(next) {
  if (!this.periodId) {
    this.periodId = `period_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

specialPeriodSchema.methods.shouldTriggerAlert = function() {
  const now = new Date();
  const daysUntil = Math.ceil((this.startDate - now) / (1000 * 60 * 60 * 24));
  return this.alerts.emailNotification && 
         daysUntil <= this.alerts.daysBeforeAlert && 
         daysUntil > 0;
};

export default mongoose.models.SpecialPeriod || mongoose.model('SpecialPeriod', specialPeriodSchema);
