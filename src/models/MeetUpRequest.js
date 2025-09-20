import mongoose from 'mongoose';

const meetUpRequestSchema = new mongoose.Schema({
  requesterId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Requester ID is required'],
    index: true
  },
  targetUserId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Target user ID is required'],
    index: true
  },
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required'],
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'cancelled', 'completed'],
    default: 'pending',
    index: true
  },
  type: {
    type: String,
    enum: ['casual', 'business', 'social', 'networking', 'activity'],
    required: [true, 'Meet-up type is required']
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  proposedDate: {
    type: Date,
    required: [true, 'Proposed date is required'],
    validate: {
      validator: function(value) {
        return value > new Date();
      },
      message: 'Proposed date must be in the future'
    }
  },
  proposedTime: {
    start: {
      type: String,
      required: [true, 'Start time is required'],
      validate: {
        validator: function(value) {
          return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value);
        },
        message: 'Start time must be in HH:MM format'
      }
    },
    end: {
      type: String,
      required: [true, 'End time is required'],
      validate: {
        validator: function(value) {
          return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value);
        },
        message: 'End time must be in HH:MM format'
      }
    }
  },
  location: {
    type: {
      type: String,
      enum: ['hotel_lobby', 'restaurant', 'bar', 'meeting_room', 'outdoor', 'other'],
      required: [true, 'Location type is required']
    },
    name: {
      type: String,
      required: [true, 'Location name is required'],
      maxlength: [100, 'Location name cannot exceed 100 characters']
    },
    details: {
      type: String,
      maxlength: [200, 'Location details cannot exceed 200 characters']
    }
  },
  meetingRoomBooking: {
    roomId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Room'
    },
    bookingId: {
      type: mongoose.Schema.ObjectId,
      ref: 'ServiceBooking'
    },
    isRequired: {
      type: Boolean,
      default: false
    },
    equipment: [{
      type: String,
      enum: ['projector', 'whiteboard', 'flipchart', 'sound_system', 'video_conference', 'laptop']
    }],
    services: [{
      type: String,
      enum: ['basic_refreshments', 'business_lunch', 'welcome_drinks', 'stationery_kit', 'photographer', 'concierge_support']
    }],
    cost: {
      baseRoom: { type: Number, default: 0 },
      equipment: { type: Number, default: 0 },
      services: { type: Number, default: 0 },
      subtotal: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      currency: { type: String, default: 'INR' },
      breakdown: {
        room: {
          cost: Number,
          duration: Number
        },
        equipment: [{
          id: String,
          name: String,
          cost: Number
        }],
        services: [{
          id: String,
          name: String,
          cost: Number
        }]
      }
    },
    confirmedAt: Date,
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled'],
      default: 'pending'
    }
  },
  participants: {
    maxParticipants: {
      type: Number,
      min: [2, 'Minimum 2 participants required'],
      max: [20, 'Maximum 20 participants allowed'],
      default: 2
    },
    confirmedParticipants: [{
      userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      name: {
        type: String,
        required: true
      },
      email: {
        type: String,
        required: true
      },
      confirmedAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  preferences: {
    interests: [{
      type: String,
      maxlength: [50, 'Interest cannot exceed 50 characters']
    }],
    languages: [{
      type: String,
      maxlength: [20, 'Language cannot exceed 20 characters']
    }],
    ageGroup: {
      type: String,
      enum: ['18-25', '26-35', '36-45', '46-55', '55+', 'any']
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'any']
    }
  },
  communication: {
    preferredMethod: {
      type: String,
      enum: ['in_app', 'email', 'phone', 'whatsapp'],
      default: 'in_app'
    },
    contactInfo: {
      email: String,
      phone: String,
      whatsapp: String
    }
  },
  response: {
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending'
    },
    message: {
      type: String,
      maxlength: [300, 'Response message cannot exceed 300 characters']
    },
    respondedAt: Date,
    alternativeDate: Date,
    alternativeTime: {
      start: String,
      end: String
    }
  },
  activity: {
    type: {
      type: String,
      enum: ['coffee', 'lunch', 'dinner', 'drinks', 'walk', 'tour', 'game', 'other'],
      required: function() {
        return this.type === 'activity';
      }
    },
    duration: {
      type: Number,
      min: [30, 'Minimum duration is 30 minutes'],
      max: [480, 'Maximum duration is 8 hours'],
      default: 60
    },
    cost: {
      type: Number,
      min: [0, 'Cost cannot be negative'],
      default: 0
    },
    costSharing: {
      type: Boolean,
      default: false
    }
  },
  safety: {
    verifiedOnly: {
      type: Boolean,
      default: false
    },
    publicLocation: {
      type: Boolean,
      default: true
    },
    hotelStaffPresent: {
      type: Boolean,
      default: false
    }
  },
  metadata: {
    tags: [String],
    category: {
      type: String,
      enum: ['business', 'leisure', 'cultural', 'sports', 'food', 'entertainment']
    },
    difficulty: {
      type: String,
      enum: ['easy', 'moderate', 'challenging'],
      default: 'easy'
    }
  },
  notifications: {
    reminderSent: {
      type: Boolean,
      default: false
    },
    reminderSentAt: Date,
    followUpSent: {
      type: Boolean,
      default: false
    },
    followUpSentAt: Date
  },
  // Staff supervision fields
  assignedStaff: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    index: true
  },
  supervisionStatus: {
    type: String,
    enum: ['not_required', 'assigned', 'in_progress', 'completed'],
    default: 'not_required',
    index: true
  },
  supervisionNotes: {
    type: String,
    maxlength: [500, 'Supervision notes cannot exceed 500 characters']
  },
  supervisionCompletedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
meetUpRequestSchema.index({ requesterId: 1, status: 1 });
meetUpRequestSchema.index({ targetUserId: 1, status: 1 });
meetUpRequestSchema.index({ hotelId: 1, status: 1 });
meetUpRequestSchema.index({ proposedDate: 1, status: 1 });
meetUpRequestSchema.index({ type: 1, status: 1 });
meetUpRequestSchema.index({ 'location.type': 1 });
meetUpRequestSchema.index({ createdAt: -1 });
// Staff supervision indexes
meetUpRequestSchema.index({ assignedStaff: 1, supervisionStatus: 1 });
meetUpRequestSchema.index({ hotelId: 1, supervisionStatus: 1 });
meetUpRequestSchema.index({ hotelId: 1, assignedStaff: 1 });
meetUpRequestSchema.index({ 'safety.hotelStaffPresent': 1 });
meetUpRequestSchema.index({ 'safety.publicLocation': 1 });

// Virtuals
meetUpRequestSchema.virtual('isUpcoming').get(function() {
  return this.proposedDate > new Date() && this.status === 'accepted';
});

meetUpRequestSchema.virtual('isPast').get(function() {
  return this.proposedDate < new Date();
});

meetUpRequestSchema.virtual('canBeCancelled').get(function() {
  return this.status === 'accepted' && this.proposedDate > new Date();
});

meetUpRequestSchema.virtual('canBeRescheduled').get(function() {
  return this.status === 'accepted' && this.proposedDate > new Date();
});

meetUpRequestSchema.virtual('participantCount').get(function() {
  return this.participants.confirmedParticipants.length;
});

meetUpRequestSchema.virtual('hasAvailableSpots').get(function() {
  return this.participants.confirmedParticipants.length < this.participants.maxParticipants;
});

meetUpRequestSchema.virtual('requiresSupervision').get(function() {
  return this.safety?.hotelStaffPresent ||
         !this.safety?.publicLocation ||
         this.participants.maxParticipants > 4 ||
         (this.location.type === 'other' || this.location.type === 'outdoor');
});

meetUpRequestSchema.virtual('isSupervisionPending').get(function() {
  return this.supervisionStatus === 'assigned' || this.supervisionStatus === 'in_progress';
});

meetUpRequestSchema.virtual('isSupervisionCompleted').get(function() {
  return this.supervisionStatus === 'completed';
});

// Static methods
meetUpRequestSchema.statics.getUpcomingMeetUps = function(userId) {
  return this.find({
    $or: [
      { requesterId: userId },
      { targetUserId: userId },
      { 'participants.confirmedParticipants.userId': userId }
    ],
    status: 'accepted',
    proposedDate: { $gt: new Date() }
  })
  .populate('requesterId', 'name email avatar')
  .populate('targetUserId', 'name email avatar')
  .populate('hotelId', 'name address')
  .populate('meetingRoomBooking.roomId', 'number type')
  .sort({ proposedDate: 1 });
};

meetUpRequestSchema.statics.getPendingRequests = function(userId) {
  return this.find({
    targetUserId: userId,
    status: 'pending'
  })
  .populate('requesterId', 'name email avatar')
  .populate('hotelId', 'name address')
  .sort({ createdAt: -1 });
};

meetUpRequestSchema.statics.getSentRequests = function(userId) {
  return this.find({
    requesterId: userId
  })
  .populate('targetUserId', 'name email avatar')
  .populate('hotelId', 'name address')
  .sort({ createdAt: -1 });
};

meetUpRequestSchema.statics.getMeetUpStats = function(userId) {
  return this.aggregate([
    {
      $match: {
        $or: [
          { requesterId: new mongoose.Types.ObjectId(userId) },
          { targetUserId: new mongoose.Types.ObjectId(userId) }
        ]
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
};

// Instance methods
meetUpRequestSchema.methods.acceptRequest = function(message = '') {
  this.status = 'accepted';
  this.response = {
    status: 'accepted',
    message,
    respondedAt: new Date()
  };
  return this.save();
};

meetUpRequestSchema.methods.declineRequest = function(message = '') {
  this.status = 'declined';
  this.response = {
    status: 'declined',
    message,
    respondedAt: new Date()
  };
  return this.save();
};

meetUpRequestSchema.methods.cancelRequest = function() {
  this.status = 'cancelled';
  return this.save();
};

meetUpRequestSchema.methods.completeRequest = function() {
  this.status = 'completed';
  return this.save();
};

meetUpRequestSchema.methods.addParticipant = function(userId, name, email) {
  const existingParticipant = this.participants.confirmedParticipants.find(
    p => p.userId.toString() === userId.toString()
  );
  
  if (!existingParticipant && this.hasAvailableSpots) {
    this.participants.confirmedParticipants.push({
      userId,
      name,
      email,
      confirmedAt: new Date()
    });
    return this.save();
  }
  
  throw new Error('Participant already exists or no available spots');
};

meetUpRequestSchema.methods.removeParticipant = function(userId) {
  const index = this.participants.confirmedParticipants.findIndex(
    p => p.userId.toString() === userId.toString()
  );
  
  if (index !== -1) {
    this.participants.confirmedParticipants.splice(index, 1);
    return this.save();
  }
  
  throw new Error('Participant not found');
};

meetUpRequestSchema.methods.suggestAlternative = function(date, time) {
  this.response.alternativeDate = date;
  this.response.alternativeTime = time;
  return this.save();
};

// Staff supervision methods
meetUpRequestSchema.methods.assignStaffSupervision = function(staffId, notes = '') {
  this.assignedStaff = staffId;
  this.supervisionStatus = 'assigned';
  this.supervisionNotes = notes;
  return this.save();
};

meetUpRequestSchema.methods.updateSupervisionStatus = function(status, notes = '') {
  this.supervisionStatus = status;
  if (notes) this.supervisionNotes = notes;
  if (status === 'completed') {
    this.supervisionCompletedAt = new Date();
  }
  return this.save();
};

meetUpRequestSchema.methods.getSupervisionPriority = function() {
  let priorityScore = 0;
  const factors = [];

  if (!this.safety?.publicLocation) {
    priorityScore += 3;
    factors.push('Private location');
  }
  if (this.safety?.hotelStaffPresent) {
    priorityScore += 2;
    factors.push('Staff presence required');
  }
  if (!this.safety?.verifiedOnly) {
    priorityScore += 1;
    factors.push('Unverified users allowed');
  }

  const meetUpHour = new Date(this.proposedDate).getHours();
  if (meetUpHour < 6 || meetUpHour > 22) {
    priorityScore += 2;
    factors.push('Late/early hours');
  }

  if (this.participants.maxParticipants > 4) {
    priorityScore += 1;
    factors.push('Large group');
  }

  if (this.location.type === 'other' || this.location.type === 'outdoor') {
    priorityScore += 1;
    factors.push('Non-standard location');
  }

  let priority, label;
  if (priorityScore >= 5) {
    priority = 'high';
    label = 'High Priority';
  } else if (priorityScore >= 2) {
    priority = 'medium';
    label = 'Medium Priority';
  } else {
    priority = 'low';
    label = 'Low Priority';
  }

  return {
    priority,
    label,
    score: priorityScore,
    factors
  };
};

// Pre-save middleware
meetUpRequestSchema.pre('save', function(next) {
  // Validate time format
  if (this.proposedTime.start >= this.proposedTime.end) {
    return next(new Error('End time must be after start time'));
  }
  
  // Auto-complete past meet-ups
  if (this.isPast && this.status === 'accepted') {
    this.status = 'completed';
  }
  
  next();
});

export default mongoose.model('MeetUpRequest', meetUpRequestSchema);
