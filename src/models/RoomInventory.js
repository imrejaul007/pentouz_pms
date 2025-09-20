import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     RoomInventory:
 *       type: object
 *       required:
 *         - hotelId
 *         - roomId
 *         - templateId
 *       properties:
 *         _id:
 *           type: string
 *         hotelId:
 *           type: string
 *           description: Hotel ID
 *         roomId:
 *           type: string
 *           description: Room ID this inventory belongs to
 *         currentBookingId:
 *           type: string
 *           description: Current active booking ID
 *         templateId:
 *           type: string
 *           description: Template used for this room inventory
 *         lastInspectionDate:
 *           type: string
 *           format: date-time
 *         lastCleaningDate:
 *           type: string
 *           format: date-time
 *         status:
 *           type: string
 *           enum: [clean, dirty, maintenance, inspection_required, damaged]
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               itemId:
 *                 type: string
 *               currentQuantity:
 *                 type: number
 *               expectedQuantity:
 *                 type: number
 *               condition:
 *                 type: string
 *                 enum: [excellent, good, fair, worn, damaged, missing]
 *               lastCheckedDate:
 *                 type: string
 *                 format: date-time
 *               needsReplacement:
 *                 type: boolean
 *               notes:
 *                 type: string
 */

const roomInventorySchema = new mongoose.Schema({
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
  currentBookingId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Booking',
    index: true,
    description: 'Current active booking if room is occupied'
  },
  templateId: {
    type: mongoose.Schema.ObjectId,
    ref: 'RoomInventoryTemplate',
    required: [true, 'Template ID is required']
  },
  lastInspectionDate: {
    type: Date,
    index: true
  },
  lastCleaningDate: {
    type: Date,
    index: true
  },
  nextInspectionDue: {
    type: Date,
    index: true
  },
  status: {
    type: String,
    enum: {
      values: ['clean', 'dirty', 'maintenance', 'inspection_required', 'damaged', 'out_of_order'],
      message: 'Invalid room inventory status'
    },
    default: 'inspection_required',
    index: true
  },
  items: [{
    itemId: {
      type: mongoose.Schema.ObjectId,
      ref: 'InventoryItem',
      required: [true, 'Item ID is required']
    },
    currentQuantity: {
      type: Number,
      required: [true, 'Current quantity is required'],
      min: [0, 'Current quantity must be non-negative']
    },
    expectedQuantity: {
      type: Number,
      required: [true, 'Expected quantity is required'],
      min: [0, 'Expected quantity must be non-negative']
    },
    condition: {
      type: String,
      enum: {
        values: ['excellent', 'good', 'fair', 'worn', 'damaged', 'missing'],
        message: 'Invalid item condition'
      },
      default: 'good'
    },
    lastCheckedDate: {
      type: Date,
      default: Date.now
    },
    lastReplacedDate: {
      type: Date
    },
    checkedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    location: {
      type: String,
      trim: true,
      description: 'Specific location in room'
    },
    needsReplacement: {
      type: Boolean,
      default: false
    },
    replacementReason: {
      type: String,
      enum: ['damaged', 'worn', 'missing', 'hygiene', 'guest_request', 'maintenance', 'laundry', 'lost']
    },
    replacementRequested: {
      type: Boolean,
      default: false
    },
    replacementRequestedDate: Date,
    // Laundry tracking fields
    laundryStatus: {
      type: String,
      enum: ['none', 'sent_to_laundry', 'in_laundry', 'returned_from_laundry', 'lost_in_laundry', 'damaged_in_laundry'],
      default: 'none'
    },
    laundryTransactionId: {
      type: mongoose.Schema.ObjectId,
      ref: 'LaundryTransaction'
    },
    lastLaundryDate: Date,
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot exceed 500 characters']
    },
    photos: [{
      url: String,
      description: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      },
      uploadedBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      }
    }]
  }],
  inspectionHistory: [{
    inspectedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true
    },
    inspectionDate: {
      type: Date,
      default: Date.now
    },
    inspectionType: {
      type: String,
      enum: ['daily_cleaning', 'checkout_inspection', 'maintenance', 'damage_assessment', 'setup'],
      required: true
    },
    findings: [{
      itemId: {
        type: mongoose.Schema.ObjectId,
        ref: 'InventoryItem'
      },
      issue: String,
      severity: {
        type: String,
        enum: ['minor', 'moderate', 'major', 'critical']
      },
      action: {
        type: String,
        enum: ['none', 'cleaned', 'replaced', 'repaired', 'reported']
      },
      cost: {
        type: Number,
        min: 0
      },
      chargedToGuest: {
        type: Boolean,
        default: false
      }
    }],
    overallStatus: {
      type: String,
      enum: ['passed', 'failed', 'needs_attention'],
      required: true
    },
    score: {
      type: Number,
      min: 0,
      max: 100,
      description: 'Overall inspection score out of 100'
    },
    timeSpent: {
      type: Number,
      description: 'Time spent in minutes'
    },
    notes: {
      type: String,
      maxlength: [1000, 'Notes cannot exceed 1000 characters']
    },
    photos: [{
      url: String,
      description: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }]
  }],
  specialInstructions: [{
    instruction: String,
    addedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  maintenanceRequired: {
    type: Boolean,
    default: false
  },
  maintenanceNotes: String,
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

// Compound indexes
roomInventorySchema.index({ hotelId: 1, roomId: 1 }, { unique: true });
roomInventorySchema.index({ hotelId: 1, status: 1 });
roomInventorySchema.index({ hotelId: 1, lastInspectionDate: 1 });
roomInventorySchema.index({ hotelId: 1, nextInspectionDue: 1 });

// Virtual for days since last inspection
roomInventorySchema.virtual('daysSinceLastInspection').get(function() {
  if (!this.lastInspectionDate) return null;
  const now = new Date();
  const diffTime = Math.abs(now - this.lastInspectionDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for items needing replacement
roomInventorySchema.virtual('itemsNeedingReplacement').get(function() {
  return this.items.filter(item => item.needsReplacement || item.condition === 'damaged' || item.condition === 'missing');
});

// Virtual for missing items
roomInventorySchema.virtual('missingItems').get(function() {
  return this.items.filter(item => item.currentQuantity < item.expectedQuantity);
});

// Virtual for overall condition score
roomInventorySchema.virtual('conditionScore').get(function() {
  if (this.items.length === 0) return 0;
  
  const conditionScores = {
    excellent: 100,
    good: 80,
    fair: 60,
    worn: 40,
    damaged: 20,
    missing: 0
  };
  
  const totalScore = this.items.reduce((sum, item) => {
    return sum + (conditionScores[item.condition] || 0);
  }, 0);
  
  return Math.round(totalScore / this.items.length);
});

// Virtual for inspection due status
roomInventorySchema.virtual('isInspectionOverdue').get(function() {
  if (!this.nextInspectionDue) return false;
  return new Date() > this.nextInspectionDue;
});

// Pre-save middleware
roomInventorySchema.pre('save', function(next) {
  // Calculate next inspection due date
  if (this.lastInspectionDate && !this.nextInspectionDue) {
    const nextDate = new Date(this.lastInspectionDate);
    nextDate.setDate(nextDate.getDate() + 1); // Daily inspections
    this.nextInspectionDue = nextDate;
  }
  
  // Update maintenance required flag
  this.maintenanceRequired = this.items.some(item => 
    item.needsReplacement || item.condition === 'damaged'
  );
  
  next();
});

// Instance method to record inspection
roomInventorySchema.methods.recordInspection = function(inspectionData) {
  this.inspectionHistory.push(inspectionData);
  this.lastInspectionDate = inspectionData.inspectionDate || new Date();
  
  // Update next inspection due
  const nextDate = new Date(this.lastInspectionDate);
  nextDate.setDate(nextDate.getDate() + 1);
  this.nextInspectionDue = nextDate;
  
  // Update status based on inspection
  this.status = inspectionData.overallStatus === 'passed' ? 'clean' : 'inspection_required';
  
  return this.save();
};

// Instance method to update item condition
roomInventorySchema.methods.updateItemCondition = function(itemId, updates) {
  const item = this.items.id(itemId);
  if (!item) {
    throw new Error('Item not found in room inventory');
  }
  
  Object.assign(item, updates);
  item.lastCheckedDate = new Date();
  
  return this.save();
};

// Instance method to request replacement
roomInventorySchema.methods.requestReplacement = function(itemId, reason, notes) {
  const item = this.items.id(itemId);
  if (!item) {
    throw new Error('Item not found in room inventory');
  }
  
  item.needsReplacement = true;
  item.replacementReason = reason;
  item.replacementRequested = true;
  item.replacementRequestedDate = new Date();
  item.notes = notes;
  
  return this.save();
};

// Static method to get rooms needing inspection
roomInventorySchema.statics.getRoomsNeedingInspection = function(hotelId) {
  const today = new Date();
  return this.find({
    hotelId,
    isActive: true,
    $or: [
      { nextInspectionDue: { $lte: today } },
      { status: 'inspection_required' },
      { maintenanceRequired: true }
    ]
  }).populate('roomId').sort('nextInspectionDue');
};

// Static method to get inventory summary
roomInventorySchema.statics.getInventorySummary = async function(hotelId) {
  const pipeline = [
    { $match: { hotelId: new mongoose.Types.ObjectId(hotelId), isActive: true } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.condition',
        count: { $sum: 1 },
        totalQuantity: { $sum: '$items.currentQuantity' }
      }
    }
  ];
  
  const summary = await this.aggregate(pipeline);
  
  const statusCounts = await this.aggregate([
    { $match: { hotelId: new mongoose.Types.ObjectId(hotelId), isActive: true } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  
  return {
    itemConditions: summary,
    roomStatuses: statusCounts
  };
};

// Static method to initialize room inventory from template
roomInventorySchema.statics.initializeFromTemplate = async function(roomId, templateId, bookingId = null) {
  const RoomInventoryTemplate = mongoose.model('RoomInventoryTemplate');
  const Room = mongoose.model('Room');
  
  const template = await RoomInventoryTemplate.findById(templateId).populate('items.itemId');
  const room = await Room.findById(roomId);
  
  if (!template || !room) {
    throw new Error('Template or room not found');
  }
  
  const items = template.items.map(templateItem => ({
    itemId: templateItem.itemId._id,
    currentQuantity: templateItem.defaultQuantity,
    expectedQuantity: templateItem.defaultQuantity,
    condition: 'good',
    location: templateItem.location,
    lastCheckedDate: new Date()
  }));
  
  return await this.create({
    hotelId: room.hotelId,
    roomId: roomId,
    currentBookingId: bookingId,
    templateId: templateId,
    lastInspectionDate: new Date(),
    status: 'clean',
    items: items
  });
};

export default mongoose.model('RoomInventory', roomInventorySchema);
