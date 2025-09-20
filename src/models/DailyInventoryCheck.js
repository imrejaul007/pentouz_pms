import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     DailyInventoryCheck:
 *       type: object
 *       required:
 *         - hotelId
 *         - roomId
 *         - checkedBy
 *         - checkDate
 *       properties:
 *         _id:
 *           type: string
 *         hotelId:
 *           type: string
 *           description: Hotel ID
 *         roomId:
 *           type: string
 *           description: Room being checked
 *         checkedBy:
 *           type: string
 *           description: Staff member performing the check
 *         checkDate:
 *           type: string
 *           format: date
 *           description: Date of the check
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               itemId:
 *                 type: string
 *               itemName:
 *                 type: string
 *               category:
 *                 type: string
 *               currentQuantity:
 *                 type: number
 *               requiredQuantity:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [sufficient, low, missing, damaged]
 *               notes:
 *                 type: string
 *         status:
 *           type: string
 *           enum: [pending, in_progress, completed, overdue]
 *           default: pending
 *         completedAt:
 *           type: string
 *           format: date-time
 *         notes:
 *           type: string
 *         issues:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               itemId:
 *                 type: string
 *               issue:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const dailyInventoryCheckSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required'],
    index: true
  },
  roomId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Room',
    required: [true, 'Room ID is required'],
    index: true
  },
  checkedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Staff member ID is required']
  },
  checkDate: {
    type: Date,
    required: [true, 'Check date is required'],
    default: Date.now,
    index: true
  },
  items: [{
    itemId: {
      type: mongoose.Schema.ObjectId,
      ref: 'InventoryItem',
      required: true
    },
    itemName: {
      type: String,
      required: true
    },
    category: {
      type: String,
      required: true
    },
    currentQuantity: {
      type: Number,
      required: true,
      min: 0
    },
    requiredQuantity: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      enum: ['sufficient', 'low', 'missing', 'damaged'],
      default: 'sufficient'
    },
    notes: {
      type: String,
      maxlength: 200
    }
  }],
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'overdue'],
    default: 'pending'
  },
  completedAt: {
    type: Date
  },
  notes: {
    type: String,
    maxlength: 500
  },
  issues: [{
    itemId: {
      type: mongoose.Schema.ObjectId,
      ref: 'InventoryItem'
    },
    issue: {
      type: String,
      required: true,
      maxlength: 200
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    },
    resolved: {
      type: Boolean,
      default: false
    },
    resolvedAt: {
      type: Date
    },
    resolvedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    }
  }]
}, {
  timestamps: true
});

// Index for efficient queries
dailyInventoryCheckSchema.index({ hotelId: 1, checkDate: -1 });
dailyInventoryCheckSchema.index({ roomId: 1, checkDate: -1 });
dailyInventoryCheckSchema.index({ checkedBy: 1, checkDate: -1 });
dailyInventoryCheckSchema.index({ status: 1, checkDate: -1 });

// Virtual for checking if overdue
dailyInventoryCheckSchema.virtual('isOverdue').get(function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(this.checkDate);
  checkDate.setHours(0, 0, 0, 0);
  
  return checkDate < today && this.status !== 'completed';
});

// Method to mark as completed
dailyInventoryCheckSchema.methods.markCompleted = function() {
  this.status = 'completed';
  this.completedAt = new Date();
  return this.save();
};

// Method to add issue
dailyInventoryCheckSchema.methods.addIssue = function(itemId, issue, priority = 'medium') {
  this.issues.push({
    itemId,
    issue,
    priority
  });
  return this.save();
};

// Method to resolve issue
dailyInventoryCheckSchema.methods.resolveIssue = function(issueId, resolvedBy) {
  const issue = this.issues.id(issueId);
  if (issue) {
    issue.resolved = true;
    issue.resolvedAt = new Date();
    issue.resolvedBy = resolvedBy;
  }
  return this.save();
};

// Static method to get today's checks
dailyInventoryCheckSchema.statics.getTodayChecks = function(hotelId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return this.find({
    hotelId,
    checkDate: {
      $gte: today,
      $lt: tomorrow
    }
  }).populate('roomId', 'roomNumber type')
    .populate('checkedBy', 'name email')
    .sort('checkDate');
};

// Static method to get overdue checks
dailyInventoryCheckSchema.statics.getOverdueChecks = function(hotelId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return this.find({
    hotelId,
    checkDate: { $lt: today },
    status: { $ne: 'completed' }
  }).populate('roomId', 'roomNumber type')
    .populate('checkedBy', 'name email')
    .sort('checkDate');
};

export default mongoose.model('DailyInventoryCheck', dailyInventoryCheckSchema);
