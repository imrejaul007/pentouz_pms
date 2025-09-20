import mongoose from 'mongoose';

const WaitingListSchema = new mongoose.Schema({
  waitlistId: {
    type: String
  },
  guestName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  roomType: {
    type: String,
    required: true,
    enum: ['Standard Room', 'Deluxe Room', 'Executive Room', 'Deluxe Suite', 'Presidential Suite']
  },
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true
  },
  preferredDates: {
    checkIn: {
      type: Date,
      required: true
    },
    checkOut: {
      type: Date,
      required: true
    }
  },
  alternativeDates: [{
    checkIn: {
      type: Date,
      required: true
    },
    checkOut: {
      type: Date,
      required: true
    }
  }],
  guests: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  vipStatus: {
    type: Boolean,
    default: false
  },
  loyaltyTier: {
    type: String,
    enum: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond']
  },
  specialRequests: {
    type: String
  },
  contactPreference: {
    type: String,
    enum: ['email', 'phone', 'sms'],
    default: 'email'
  },
  maxRate: {
    type: Number,
    min: 0
  },
  status: {
    type: String,
    enum: ['active', 'contacted', 'confirmed', 'expired', 'cancelled'],
    default: 'active'
  },
  addedDate: {
    type: Date,
    default: Date.now
  },
  lastContact: {
    type: Date
  },
  contactHistory: [{
    contactDate: {
      type: Date,
      default: Date.now
    },
    method: {
      type: String,
      enum: ['email', 'phone', 'sms', 'in_person']
    },
    message: String,
    contactedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  notes: [{
    content: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isInternal: {
      type: Boolean,
      default: true
    }
  }],
  source: {
    type: String,
    enum: ['direct', 'booking.com', 'expedia', 'agoda', 'website', 'phone', 'walk_in'],
    default: 'direct'
  },
  notificationPreferences: {
    email: {
      type: Boolean,
      default: true
    },
    sms: {
      type: Boolean,
      default: false
    },
    phone: {
      type: Boolean,
      default: false
    }
  },
  roomAvailabilityAlerts: {
    type: Boolean,
    default: true
  },
  autoConfirm: {
    type: Boolean,
    default: false
  },
  expiryDate: {
    type: Date
  },
  // Integration with existing booking if waitlist converts to booking
  convertedToBooking: {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking'
    },
    convertedDate: Date,
    convertedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  // Tracking and analytics
  priority_score: {
    type: Number,
    default: 0
  },
  engagement_score: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
WaitingListSchema.index({ hotelId: 1, status: 1 });
WaitingListSchema.index({ hotelId: 1, roomType: 1, status: 1 });
WaitingListSchema.index({ hotelId: 1, 'preferredDates.checkIn': 1, 'preferredDates.checkOut': 1 });
WaitingListSchema.index({ email: 1 });
WaitingListSchema.index({ priority: 1, addedDate: 1 });
WaitingListSchema.index({ status: 1, vipStatus: -1, priority: 1 });

// Pre-save middleware to generate waitlistId
WaitingListSchema.pre('save', function(next) {
  if (!this.waitlistId) {
    this.waitlistId = `WL${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  // Calculate priority score based on various factors
  let score = 0;

  // VIP status adds 50 points
  if (this.vipStatus) score += 50;

  // Loyalty tier scoring
  const loyaltyScores = {
    'Diamond': 40,
    'Platinum': 30,
    'Gold': 20,
    'Silver': 10,
    'Bronze': 5
  };
  if (this.loyaltyTier) {
    score += loyaltyScores[this.loyaltyTier] || 0;
  }

  // Priority level scoring
  const priorityScores = {
    'high': 30,
    'medium': 15,
    'low': 5
  };
  score += priorityScores[this.priority] || 0;

  // Time-based scoring (earlier requests get more points)
  const daysWaiting = Math.floor((Date.now() - this.addedDate.getTime()) / (1000 * 60 * 60 * 24));
  score += Math.min(daysWaiting * 2, 20); // Max 20 points for waiting time

  this.priority_score = score;

  next();
});

// Instance methods
WaitingListSchema.methods.addNote = function(content, createdBy, isInternal = true) {
  this.notes.push({
    content,
    createdBy,
    isInternal,
    createdAt: new Date()
  });
  return this.save();
};

WaitingListSchema.methods.addContact = function(method, message, contactedBy) {
  this.contactHistory.push({
    method,
    message,
    contactedBy,
    contactDate: new Date()
  });
  this.lastContact = new Date();
  return this.save();
};

WaitingListSchema.methods.updateStatus = function(newStatus, updatedBy) {
  const oldStatus = this.status;
  this.status = newStatus;

  // Add automatic note for status change
  this.notes.push({
    content: `Status changed from ${oldStatus} to ${newStatus}`,
    createdBy: updatedBy,
    isInternal: true,
    createdAt: new Date()
  });

  if (newStatus === 'contacted') {
    this.lastContact = new Date();
  }

  return this.save();
};

WaitingListSchema.methods.convertToBooking = function(bookingId, convertedBy) {
  this.convertedToBooking = {
    bookingId,
    convertedDate: new Date(),
    convertedBy
  };
  this.status = 'confirmed';
  return this.save();
};

// Static methods
WaitingListSchema.statics.getActiveWaitlist = function(hotelId, filters = {}) {
  const query = {
    hotelId,
    status: { $in: ['active', 'contacted'] },
    ...filters
  };

  return this.find(query)
    .populate('convertedToBooking.bookingId', 'bookingNumber')
    .populate('convertedToBooking.convertedBy', 'name email')
    .populate('notes.createdBy', 'name email')
    .populate('contactHistory.contactedBy', 'name email')
    .sort({ priority_score: -1, addedDate: 1 });
};

WaitingListSchema.statics.getWaitlistStats = function(hotelId) {
  return this.aggregate([
    { $match: { hotelId: new mongoose.Types.ObjectId(hotelId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgWaitTime: {
          $avg: {
            $divide: [
              { $subtract: ['$$NOW', '$addedDate'] },
              1000 * 60 * 60 * 24 // Convert to days
            ]
          }
        }
      }
    }
  ]);
};

WaitingListSchema.statics.findMatchingAvailability = function(hotelId, roomType, checkIn, checkOut) {
  // This would integrate with room availability logic
  // For now, return entries that match the criteria
  return this.find({
    hotelId,
    roomType,
    status: { $in: ['active', 'contacted'] },
    $or: [
      {
        'preferredDates.checkIn': { $lte: checkOut },
        'preferredDates.checkOut': { $gte: checkIn }
      },
      {
        'alternativeDates': {
          $elemMatch: {
            'checkIn': { $lte: checkOut },
            'checkOut': { $gte: checkIn }
          }
        }
      }
    ]
  }).sort({ priority_score: -1, addedDate: 1 });
};

const WaitingList = mongoose.model('WaitingList', WaitingListSchema);

export default WaitingList;
