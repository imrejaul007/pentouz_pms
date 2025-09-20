import mongoose from 'mongoose';

const roomLockSchema = new mongoose.Schema({
  lockId: {
    type: String,
    unique: true,
    required: true
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    enum: ['viewing', 'editing', 'assigning'],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 } // MongoDB TTL index for auto-cleanup
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    sessionId: String
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate locks on same room
roomLockSchema.index({ roomId: 1, userId: 1 }, { unique: false });

// Index for efficient cleanup and queries
roomLockSchema.index({ expiresAt: 1 });
roomLockSchema.index({ roomId: 1, expiresAt: 1 });

// Pre-save middleware to generate lock ID
roomLockSchema.pre('save', async function(next) {
  if (!this.lockId) {
    this.lockId = `LOCK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

// Static method to get active locks
roomLockSchema.statics.getActiveLocks = function(filters = {}) {
  const query = {
    expiresAt: { $gt: new Date() },
    ...filters
  };

  return this.find(query)
    .populate('userId', 'name email role')
    .populate('roomId', 'roomNumber type floor')
    .sort({ timestamp: -1 });
};

// Static method to check if room is locked
roomLockSchema.statics.isRoomLocked = async function(roomId, excludeUserId = null) {
  const query = {
    roomId: roomId,
    expiresAt: { $gt: new Date() }
  };

  if (excludeUserId) {
    query.userId = { $ne: excludeUserId };
  }

  const lock = await this.findOne(query).populate('userId', 'name email role');
  return lock;
};

// Static method to create or update lock
roomLockSchema.statics.createOrUpdateLock = async function(roomId, userId, action, duration = 300000) { // 5 minutes default
  const existingLock = await this.findOne({
    roomId: roomId,
    userId: userId,
    expiresAt: { $gt: new Date() }
  });

  const expiresAt = new Date(Date.now() + duration);

  if (existingLock) {
    // Update existing lock
    existingLock.action = action;
    existingLock.expiresAt = expiresAt;
    existingLock.timestamp = new Date();
    return await existingLock.save();
  } else {
    // Create new lock
    return await this.create({
      roomId: roomId,
      userId: userId,
      action: action,
      expiresAt: expiresAt
    });
  }
};

// Static method to release lock
roomLockSchema.statics.releaseLock = async function(roomId, userId = null, force = false) {
  const query = {
    roomId: roomId,
    expiresAt: { $gt: new Date() }
  };

  // If not force unlock, must be by same user
  if (!force && userId) {
    query.userId = userId;
  }

  return await this.findOneAndDelete(query);
};

// Static method to cleanup expired locks (for cron job)
roomLockSchema.statics.cleanupExpiredLocks = async function() {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
  return result.deletedCount;
};

// Instance method to extend lock duration
roomLockSchema.methods.extend = function(additionalTime = 300000) { // 5 minutes
  this.expiresAt = new Date(this.expiresAt.getTime() + additionalTime);
  return this.save();
};

// Instance method to check if lock is about to expire
roomLockSchema.methods.isExpiringSoon = function(threshold = 60000) { // 1 minute
  return (this.expiresAt.getTime() - Date.now()) < threshold;
};

// Virtual for remaining time
roomLockSchema.virtual('remainingTime').get(function() {
  return Math.max(0, this.expiresAt.getTime() - Date.now());
});

// Virtual for lock status
roomLockSchema.virtual('status').get(function() {
  const now = Date.now();
  const expires = this.expiresAt.getTime();

  if (expires < now) {
    return 'expired';
  } else if ((expires - now) < 60000) { // Less than 1 minute
    return 'expiring';
  } else {
    return 'active';
  }
});

// Ensure virtuals are included in JSON
roomLockSchema.set('toJSON', { virtuals: true });
roomLockSchema.set('toObject', { virtuals: true });

const RoomLock = mongoose.model('RoomLock', roomLockSchema);

export default RoomLock;
