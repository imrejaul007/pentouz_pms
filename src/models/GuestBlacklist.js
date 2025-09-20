import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     GuestBlacklist:
 *       type: object
 *       required:
 *         - guestId
 *         - reason
 *         - type
 *         - isActive
 *       properties:
 *         _id:
 *           type: string
 *           description: Blacklist entry ID
 *         guestId:
 *           type: string
 *           description: Reference to blacklisted guest
 *         reason:
 *           type: string
 *           description: Reason for blacklisting
 *         type:
 *           type: string
 *           enum: [temporary, permanent, conditional]
 *           description: Type of blacklist
 *         category:
 *           type: string
 *           enum: [non_payment, damage, misconduct, security, policy_violation, other]
 *           description: Category of blacklist reason
 *         description:
 *           type: string
 *           description: Detailed description of the incident
 *         incidentDate:
 *           type: string
 *           format: date
 *           description: Date when the incident occurred
 *         expiryDate:
 *           type: string
 *           format: date
 *           description: Expiry date for temporary blacklists
 *         conditions:
 *           type: string
 *           description: Conditions for conditional blacklists
 *         isActive:
 *           type: boolean
 *           default: true
 *           description: Whether the blacklist entry is active
 *         appealStatus:
 *           type: string
 *           enum: [none, pending, approved, rejected]
 *           default: none
 *           description: Appeal status
 *         appealDate:
 *           type: string
 *           format: date-time
 *           description: Date when appeal was submitted
 *         appealNotes:
 *           type: string
 *           description: Notes from appeal review
 *         reviewedBy:
 *           type: string
 *           description: User who reviewed the appeal
 *         reviewedAt:
 *           type: string
 *           format: date-time
 *           description: Date when appeal was reviewed
 *         hotelId:
 *           type: string
 *           description: Hotel ID
 *         createdBy:
 *           type: string
 *           description: User who created the blacklist entry
 *         updatedBy:
 *           type: string
 *           description: User who last updated the entry
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const guestBlacklistSchema = new mongoose.Schema({
  guestId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Guest ID is required']
  },
  reason: {
    type: String,
    required: [true, 'Blacklist reason is required'],
    trim: true,
    maxlength: [200, 'Reason cannot be more than 200 characters']
  },
  type: {
    type: String,
    required: [true, 'Blacklist type is required'],
    enum: {
      values: ['temporary', 'permanent', 'conditional'],
      message: 'Invalid blacklist type'
    }
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: ['non_payment', 'damage', 'misconduct', 'security', 'policy_violation', 'other'],
      message: 'Invalid category'
    }
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  incidentDate: {
    type: Date,
    required: [true, 'Incident date is required']
  },
  expiryDate: {
    type: Date,
    validate: {
      validator: function(value) {
        if (this.type === 'temporary' && !value) {
          return false;
        }
        if (value && this.incidentDate && value <= this.incidentDate) {
          return false;
        }
        return true;
      },
      message: 'Expiry date is required for temporary blacklists and must be after incident date'
    }
  },
  conditions: {
    type: String,
    maxlength: [500, 'Conditions cannot be more than 500 characters'],
    validate: {
      validator: function(value) {
        if (this.type === 'conditional' && !value) {
          return false;
        }
        return true;
      },
      message: 'Conditions are required for conditional blacklists'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  appealStatus: {
    type: String,
    enum: {
      values: ['none', 'pending', 'approved', 'rejected'],
      message: 'Invalid appeal status'
    },
    default: 'none'
  },
  appealDate: {
    type: Date
  },
  appealNotes: {
    type: String,
    maxlength: [500, 'Appeal notes cannot be more than 500 characters']
  },
  reviewedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: true
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
guestBlacklistSchema.index({ guestId: 1, isActive: 1 });
guestBlacklistSchema.index({ hotelId: 1, isActive: 1 });
guestBlacklistSchema.index({ type: 1, category: 1 });
guestBlacklistSchema.index({ expiryDate: 1 });
guestBlacklistSchema.index({ appealStatus: 1 });

// Compound index for unique active blacklist per guest
guestBlacklistSchema.index({ guestId: 1, isActive: 1 }, { 
  unique: true, 
  partialFilterExpression: { isActive: true } 
});

// Pre-save middleware to set updatedBy
guestBlacklistSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedBy = this.createdBy; // This will be updated by controller
  }
  next();
});

// Pre-save middleware to handle expiry dates
guestBlacklistSchema.pre('save', function(next) {
  if (this.type === 'permanent') {
    this.expiryDate = undefined;
  }
  next();
});

// Virtual for guest details
guestBlacklistSchema.virtual('guest', {
  ref: 'User',
  localField: 'guestId',
  foreignField: '_id',
  justOne: true
});

// Virtual for creator details
guestBlacklistSchema.virtual('creator', {
  ref: 'User',
  localField: 'createdBy',
  foreignField: '_id',
  justOne: true
});

// Virtual for reviewer details
guestBlacklistSchema.virtual('reviewer', {
  ref: 'User',
  localField: 'reviewedBy',
  foreignField: '_id',
  justOne: true
});

// Static method to check if guest is blacklisted
guestBlacklistSchema.statics.isGuestBlacklisted = async function(guestId, hotelId) {
  const currentDate = new Date();
  
  const blacklistEntry = await this.findOne({
    guestId,
    hotelId,
    isActive: true,
    $or: [
      { type: 'permanent' },
      { type: 'conditional' },
      { 
        type: 'temporary',
        expiryDate: { $gt: currentDate }
      }
    ]
  }).populate('guestId', 'name email phone');

  return blacklistEntry;
};

// Static method to get blacklist statistics
guestBlacklistSchema.statics.getBlacklistStats = async function(hotelId) {
  const stats = await this.aggregate([
    { $match: { hotelId: new mongoose.Types.ObjectId(hotelId) } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: ['$isActive', 1, 0] } },
        inactive: { $sum: { $cond: ['$isActive', 0, 1] } },
        byType: {
          $push: {
            type: '$type',
            isActive: '$isActive'
          }
        },
        byCategory: {
          $push: {
            category: '$category',
            isActive: '$isActive'
          }
        },
        pendingAppeals: {
          $sum: { $cond: [{ $eq: ['$appealStatus', 'pending'] }, 1, 0] }
        }
      }
    }
  ]);

  if (stats.length === 0) {
    return {
      total: 0,
      active: 0,
      inactive: 0,
      byType: {},
      byCategory: {},
      pendingAppeals: 0
    };
  }

  const result = stats[0];
  
  // Calculate type breakdown
  const typeStats = {};
  result.byType.forEach(item => {
    if (!typeStats[item.type]) {
      typeStats[item.type] = { total: 0, active: 0, inactive: 0 };
    }
    typeStats[item.type].total++;
    if (item.isActive) {
      typeStats[item.type].active++;
    } else {
      typeStats[item.type].inactive++;
    }
  });

  // Calculate category breakdown
  const categoryStats = {};
  result.byCategory.forEach(item => {
    if (!categoryStats[item.category]) {
      categoryStats[item.category] = { total: 0, active: 0, inactive: 0 };
    }
    categoryStats[item.category].total++;
    if (item.isActive) {
      categoryStats[item.category].active++;
    } else {
      categoryStats[item.category].inactive++;
    }
  });

  return {
    total: result.total,
    active: result.active,
    inactive: result.inactive,
    byType: typeStats,
    byCategory: categoryStats,
    pendingAppeals: result.pendingAppeals
  };
};

// Static method to get expired blacklists
guestBlacklistSchema.statics.getExpiredBlacklists = async function(hotelId) {
  const currentDate = new Date();
  
  return await this.find({
    hotelId: new mongoose.Types.ObjectId(hotelId),
    type: 'temporary',
    isActive: true,
    expiryDate: { $lte: currentDate }
  }).populate('guestId', 'name email');
};

// Static method to auto-expire temporary blacklists
guestBlacklistSchema.statics.autoExpireBlacklists = async function(hotelId) {
  const currentDate = new Date();
  
  const result = await this.updateMany(
    {
      hotelId: new mongoose.Types.ObjectId(hotelId),
      type: 'temporary',
      isActive: true,
      expiryDate: { $lte: currentDate }
    },
    {
      $set: {
        isActive: false,
        updatedBy: null // System update
      }
    }
  );

  return result.modifiedCount;
};

// Instance method to submit appeal
guestBlacklistSchema.methods.submitAppeal = function(notes) {
  this.appealStatus = 'pending';
  this.appealDate = new Date();
  this.appealNotes = notes;
  return this.save();
};

// Instance method to review appeal
guestBlacklistSchema.methods.reviewAppeal = function(status, reviewedBy, notes) {
  this.appealStatus = status;
  this.reviewedBy = reviewedBy;
  this.reviewedAt = new Date();
  if (notes) this.appealNotes = notes;
  
  if (status === 'approved') {
    this.isActive = false;
  }
  
  return this.save();
};

export default mongoose.model('GuestBlacklist', guestBlacklistSchema);
