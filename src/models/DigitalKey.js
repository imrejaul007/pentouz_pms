import mongoose from 'mongoose';
import crypto from 'crypto';

const digitalKeySchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.ObjectId, 
    ref: 'User', 
    required: [true, 'User ID is required'], 
    index: true 
  },
  bookingId: { 
    type: mongoose.Schema.ObjectId, 
    ref: 'Booking', 
    required: [true, 'Booking ID is required'], 
    index: true 
  },
  roomId: { 
    type: mongoose.Schema.ObjectId, 
    ref: 'Room', 
    required: [true, 'Room ID is required'], 
    index: true 
  },
  hotelId: { 
    type: mongoose.Schema.ObjectId, 
    ref: 'Hotel', 
    required: [true, 'Hotel ID is required'], 
    index: true 
  },
  keyCode: { 
    type: String, 
    required: [true, 'Key code is required'], 
    unique: true,
    index: true,
    validate: {
      validator: function(value) {
        return /^[A-Z0-9]{16}$/.test(value);
      },
      message: 'Key code must be 16 characters long and contain only uppercase letters and numbers'
    }
  },
  qrCode: { 
    type: String, 
    required: [true, 'QR code data is required'] 
  },
  status: { 
    type: String, 
    enum: ['active', 'expired', 'revoked', 'used'], 
    default: 'active', 
    index: true 
  },
  type: { 
    type: String, 
    enum: ['primary', 'temporary', 'emergency'], 
    default: 'primary' 
  },
  validFrom: { 
    type: Date, 
    required: [true, 'Valid from date is required'],
    validate: {
      validator: function(value) {
        return value <= new Date();
      },
      message: 'Valid from date cannot be in the future'
    }
  },
  validUntil: { 
    type: Date, 
    required: [true, 'Valid until date is required'],
    validate: {
      validator: function(value) {
        return value > this.validFrom;
      },
      message: 'Valid until date must be after valid from date'
    }
  },
  maxUses: { 
    type: Number, 
    default: -1, // -1 means unlimited
    min: [-1, 'Max uses cannot be less than -1']
  },
  currentUses: { 
    type: Number, 
    default: 0,
    min: [0, 'Current uses cannot be negative']
  },
  lastUsedAt: { 
    type: Date 
  },
  sharedWith: [{
    userId: { 
      type: mongoose.Schema.ObjectId, 
      ref: 'User' 
    },
    email: { 
      type: String, 
      lowercase: true,
      validate: {
        validator: function(value) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        },
        message: 'Please provide a valid email address'
      }
    },
    name: { 
      type: String, 
      required: true,
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    sharedAt: { 
      type: Date, 
      default: Date.now 
    },
    expiresAt: { 
      type: Date,
      validate: {
        validator: function(value) {
          return !value || value > new Date();
        },
        message: 'Expiration date must be in the future'
      }
    },
    isActive: { 
      type: Boolean, 
      default: true 
    }
  }],
  accessLogs: [{
    timestamp: { 
      type: Date, 
      default: Date.now 
    },
    action: { 
      type: String, 
      enum: ['generated', 'accessed', 'shared', 'revoked', 'expired'], 
      required: true 
    },
    userId: { 
      type: mongoose.Schema.ObjectId, 
      ref: 'User' 
    },
    deviceInfo: {
      userAgent: String,
      ipAddress: String,
      location: String
    },
    metadata: mongoose.Schema.Types.Mixed
  }],
  securitySettings: {
    requirePin: { 
      type: Boolean, 
      default: false 
    },
    pin: { 
      type: String,
      validate: {
        validator: function(value) {
          return !this.securitySettings.requirePin || (value && /^\d{4,6}$/.test(value));
        },
        message: 'PIN must be 4-6 digits when required'
      }
    },
    allowSharing: { 
      type: Boolean, 
      default: true 
    },
    maxSharedUsers: { 
      type: Number, 
      default: 5,
      min: [0, 'Max shared users cannot be negative']
    },
    requireApproval: { 
      type: Boolean, 
      default: false 
    }
  },
  metadata: {
    generatedBy: { 
      type: mongoose.Schema.ObjectId, 
      ref: 'User' 
    },
    deviceInfo: {
      userAgent: String,
      ipAddress: String,
      location: String
    },
    notes: { 
      type: String, 
      maxlength: [500, 'Notes cannot exceed 500 characters'] 
    }
  }
}, { 
  timestamps: true, 
  toJSON: { virtuals: true }, 
  toObject: { virtuals: true } 
});

// Indexes for performance
digitalKeySchema.index({ userId: 1, status: 1 });
digitalKeySchema.index({ bookingId: 1, status: 1 });
digitalKeySchema.index({ roomId: 1, status: 1 });
digitalKeySchema.index({ validUntil: 1 }, { expireAfterSeconds: 0 });
digitalKeySchema.index({ 'sharedWith.expiresAt': 1 });
digitalKeySchema.index({ keyCode: 1, status: 1 });

// Virtuals
digitalKeySchema.virtual('isExpired').get(function() {
  return this.validUntil < new Date();
});

digitalKeySchema.virtual('isValid').get(function() {
  return this.status === 'active' && !this.isExpired && 
         (this.maxUses === -1 || this.currentUses < this.maxUses);
});

digitalKeySchema.virtual('canBeUsed').get(function() {
  return this.isValid && this.status !== 'used';
});

digitalKeySchema.virtual('canBeShared').get(function() {
  return this.isValid && this.securitySettings.allowSharing && 
         (this.securitySettings.maxSharedUsers === 0 || 
          this.sharedWith.filter(share => share.isActive).length < this.securitySettings.maxSharedUsers);
});

digitalKeySchema.virtual('remainingUses').get(function() {
  return this.maxUses === -1 ? 'unlimited' : Math.max(0, this.maxUses - this.currentUses);
});

// Static methods
digitalKeySchema.statics.generateKeyCode = function() {
  return crypto.randomBytes(8).toString('hex').toUpperCase();
};

digitalKeySchema.statics.findByKeyCode = function(keyCode) {
  return this.findOne({ keyCode, status: 'active' })
    .populate('userId', 'name email')
    .populate('bookingId', 'bookingNumber checkIn checkOut')
    .populate('roomId', 'number type floor')
    .populate('hotelId', 'name address');
};

digitalKeySchema.statics.getActiveKeysForUser = function(userId) {
  return this.find({ 
    userId, 
    status: 'active',
    validUntil: { $gt: new Date() }
  })
  .populate('bookingId', 'bookingNumber checkIn checkOut')
  .populate('roomId', 'number type floor')
  .populate('hotelId', 'name address')
  .sort({ validUntil: 1 });
};

digitalKeySchema.statics.getSharedKeysForUser = function(userId) {
  return this.find({
    'sharedWith.userId': userId,
    'sharedWith.isActive': true,
    status: 'active',
    validUntil: { $gt: new Date() },
    $or: [
      { 'sharedWith.expiresAt': { $exists: false } },
      { 'sharedWith.expiresAt': { $gt: new Date() } }
    ]
  })
  .populate('userId', 'name email')
  .populate('bookingId', 'bookingNumber checkIn checkOut')
  .populate('roomId', 'number type floor')
  .populate('hotelId', 'name address')
  .sort({ validUntil: 1 });
};

// Instance methods
digitalKeySchema.methods.addAccessLog = function(action, userId = null, deviceInfo = {}, metadata = {}) {
  this.accessLogs.push({
    action,
    userId,
    deviceInfo,
    metadata
  });
  return this.save();
};

digitalKeySchema.methods.useKey = function(userId = null, deviceInfo = {}) {
  if (!this.canBeUsed) {
    throw new Error('Key cannot be used');
  }
  
  this.currentUses += 1;
  this.lastUsedAt = new Date();
  
  if (this.maxUses !== -1 && this.currentUses >= this.maxUses) {
    this.status = 'used';
  }
  
  // Add access log without saving to avoid parallel save issue
  this.accessLogs.push({
    action: 'accessed',
    userId,
    deviceInfo,
    metadata: {}
  });
  return this.save();
};

digitalKeySchema.methods.shareWithUser = function(shareData) {
  if (!this.canBeShared) {
    throw new Error('Key cannot be shared');
  }
  
  // Check if already shared with this user/email
  const existingShare = this.sharedWith.find(share => 
    (share.userId && share.userId.toString() === shareData.userId) ||
    (share.email && share.email === shareData.email)
  );
  
  if (existingShare) {
    existingShare.isActive = true;
    existingShare.expiresAt = shareData.expiresAt;
    existingShare.name = shareData.name;
  } else {
    this.sharedWith.push(shareData);
  }
  
  // Add access log without saving to avoid parallel save issue
  this.accessLogs.push({
    action: 'shared',
    userId: shareData.userId,
    deviceInfo: {},
    metadata: { sharedWith: shareData }
  });
  return this.save();
};

digitalKeySchema.methods.revokeShare = function(userIdOrEmail) {
  const shareIndex = this.sharedWith.findIndex(share => 
    (share.userId && share.userId.toString() === userIdOrEmail) ||
    (share.email && share.email === userIdOrEmail)
  );
  
  if (shareIndex !== -1) {
    this.sharedWith[shareIndex].isActive = false;
    // Add access log without saving to avoid parallel save issue
    this.accessLogs.push({
      action: 'revoked',
      userId: null,
      deviceInfo: {},
      metadata: { revokedShare: this.sharedWith[shareIndex] }
    });
    return this.save();
  }
  
  throw new Error('Share not found');
};

digitalKeySchema.methods.revokeKey = function() {
  this.status = 'revoked';
  // Add access log without saving
  this.accessLogs.push({
    action: 'revoked',
    userId: null,
    deviceInfo: {},
    metadata: {}
  });
  return this.save();
};

// Pre-save middleware
digitalKeySchema.pre('save', function(next) {
  // Auto-expire keys
  if (this.isExpired && this.status === 'active') {
    this.status = 'expired';
    // Add access log without saving to avoid parallel save issue
    this.accessLogs.push({
      action: 'expired',
      userId: null,
      deviceInfo: {},
      metadata: {}
    });
  }
  
  // Validate PIN if required
  if (this.securitySettings.requirePin && !this.securitySettings.pin) {
    return next(new Error('PIN is required when PIN requirement is enabled'));
  }
  
  next();
});

// Pre-save middleware for new documents
digitalKeySchema.pre('save', function(next) {
  if (this.isNew) {
    // Generate key code if not provided
    if (!this.keyCode) {
      this.keyCode = this.constructor.generateKeyCode();
    }
    
    // Add initial access log without saving to avoid parallel save issue
    this.accessLogs.push({
      action: 'generated',
      userId: this.metadata?.generatedBy || null,
      deviceInfo: this.metadata?.deviceInfo || {},
      metadata: {}
    });
  }
  next();
});

export default mongoose.model('DigitalKey', digitalKeySchema);
