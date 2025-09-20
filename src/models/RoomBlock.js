import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     RoomBlock:
 *       type: object
 *       required:
 *         - hotelId
 *         - blockName
 *         - startDate
 *         - endDate
 *         - totalRooms
 *       properties:
 *         _id:
 *           type: string
 *         hotelId:
 *           type: string
 *           description: Hotel ID
 *         blockName:
 *           type: string
 *           description: Name of the room block
 *         groupName:
 *           type: string
 *           description: Group or organization name
 *         startDate:
 *           type: string
 *           format: date
 *           description: Block start date
 *         endDate:
 *           type: string
 *           format: date
 *           description: Block end date
 *         totalRooms:
 *           type: number
 *           description: Total number of rooms in block
 *         roomIds:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of room IDs in the block
 *         contactPerson:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             email:
 *               type: string
 *             phone:
 *               type: string
 *         reason:
 *           type: string
 *           description: Reason for blocking rooms
 *         status:
 *           type: string
 *           enum: [active, released, expired]
 *           default: active
 *         notes:
 *           type: string
 *         createdBy:
 *           type: string
 *           description: User ID who created the block
 *         releasedBy:
 *           type: string
 *           description: User ID who released the block
 *         releasedAt:
 *           type: string
 *           format: date-time
 *         releaseReason:
 *           type: string
 *         isActive:
 *           type: boolean
 *           default: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const roomBlockSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required'],
    index: true
  },
  blockName: {
    type: String,
    required: [true, 'Block name is required'],
    trim: true,
    maxlength: [100, 'Block name cannot exceed 100 characters']
  },
  groupName: {
    type: String,
    trim: true,
    maxlength: [100, 'Group name cannot exceed 100 characters']
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
    index: true
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required'],
    index: true
  },
  totalRooms: {
    type: Number,
    required: [true, 'Total rooms is required'],
    min: [1, 'Total rooms must be at least 1']
  },
  roomIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  }],
  contactPerson: {
    name: {
      type: String,
      trim: true,
      maxlength: [100, 'Contact name cannot exceed 100 characters']
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [20, 'Phone number cannot exceed 20 characters']
    }
  },
  reason: {
    type: String,
    trim: true,
    maxlength: [500, 'Reason cannot exceed 500 characters']
  },
  status: {
    type: String,
    enum: {
      values: ['active', 'released', 'expired'],
      message: 'Status must be active, released, or expired'
    },
    default: 'active',
    index: true
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by user is required'],
    index: true
  },
  releasedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  releasedAt: {
    type: Date
  },
  releaseReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Release reason cannot exceed 500 characters']
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for performance
roomBlockSchema.index({ hotelId: 1, status: 1, startDate: 1 });
roomBlockSchema.index({ hotelId: 1, endDate: 1, status: 1 });
roomBlockSchema.index({ hotelId: 1, blockName: 1 });
roomBlockSchema.index({ hotelId: 1, createdBy: 1 });

// Validation: End date must be after start date
roomBlockSchema.pre('validate', function(next) {
  if (this.startDate && this.endDate && this.endDate <= this.startDate) {
    this.invalidate('endDate', 'End date must be after start date');
  }
  next();
});

// Validation: Total rooms must match roomIds length
roomBlockSchema.pre('validate', function(next) {
  if (this.roomIds && this.totalRooms && this.roomIds.length !== this.totalRooms) {
    this.invalidate('totalRooms', 'Total rooms must match the number of room IDs');
  }
  next();
});

// Virtual for duration in days
roomBlockSchema.virtual('durationDays').get(function() {
  if (this.startDate && this.endDate) {
    const diffTime = Math.abs(this.endDate - this.startDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  return 0;
});

// Virtual for room details
roomBlockSchema.virtual('roomDetails', {
  ref: 'Room',
  localField: 'roomIds',
  foreignField: '_id'
});

// Virtual for creator details
roomBlockSchema.virtual('creatorDetails', {
  ref: 'User',
  localField: 'createdBy',
  foreignField: '_id',
  justOne: true
});

// Virtual for releaser details
roomBlockSchema.virtual('releaserDetails', {
  ref: 'User',
  localField: 'releasedBy',
  foreignField: '_id',
  justOne: true
});

// Instance method to check if block is currently active
roomBlockSchema.methods.isCurrentlyActive = function() {
  const now = new Date();
  return this.status === 'active' &&
         this.startDate <= now &&
         this.endDate >= now &&
         this.isActive;
};

// Instance method to check if block overlaps with date range
roomBlockSchema.methods.overlapsWithDateRange = function(startDate, endDate) {
  return this.startDate < endDate && this.endDate > startDate;
};

// Instance method to release the block
roomBlockSchema.methods.release = async function(userId, reason = null) {
  this.status = 'released';
  this.releasedBy = userId;
  this.releasedAt = new Date();
  if (reason) this.releaseReason = reason;

  // Update associated rooms
  const Room = mongoose.model('Room');
  await Room.updateMany(
    { _id: { $in: this.roomIds } },
    {
      $unset: { blockId: 1 },
      status: 'vacant',
      statusUpdatedAt: new Date(),
      statusUpdatedBy: userId
    }
  );

  return await this.save();
};

// Static method to find active blocks for date range
roomBlockSchema.statics.findActiveForDateRange = function(hotelId, startDate, endDate) {
  return this.find({
    hotelId,
    status: 'active',
    isActive: true,
    $or: [
      { startDate: { $lt: endDate, $gte: startDate } },
      { endDate: { $gt: startDate, $lte: endDate } },
      { startDate: { $lte: startDate }, endDate: { $gte: endDate } }
    ]
  }).populate('roomDetails creatorDetails');
};

// Static method to find overlapping blocks
roomBlockSchema.statics.findOverlapping = function(hotelId, roomIds, startDate, endDate, excludeBlockId = null) {
  const query = {
    hotelId,
    status: 'active',
    isActive: true,
    roomIds: { $in: roomIds },
    $or: [
      { startDate: { $lt: endDate, $gte: startDate } },
      { endDate: { $gt: startDate, $lte: endDate } },
      { startDate: { $lte: startDate }, endDate: { $gte: endDate } }
    ]
  };

  if (excludeBlockId) {
    query._id = { $ne: excludeBlockId };
  }

  return this.find(query);
};

// Static method to automatically expire old blocks
roomBlockSchema.statics.expireOldBlocks = async function() {
  const now = new Date();

  const expiredBlocks = await this.updateMany(
    {
      status: 'active',
      endDate: { $lt: now }
    },
    {
      status: 'expired'
    }
  );

  return expiredBlocks;
};

// Pre-save hook to automatically expire if end date has passed
roomBlockSchema.pre('save', function(next) {
  if (this.status === 'active' && this.endDate < new Date()) {
    this.status = 'expired';
  }
  next();
});

export default mongoose.model('RoomBlock', roomBlockSchema);
