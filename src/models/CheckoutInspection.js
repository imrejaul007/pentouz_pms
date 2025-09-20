import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     CheckoutInspection:
 *       type: object
 *       required:
 *         - hotelId
 *         - roomId
 *         - bookingId
 *         - inspectedBy
 *       properties:
 *         _id:
 *           type: string
 *         hotelId:
 *           type: string
 *           description: Hotel ID
 *         roomId:
 *           type: string
 *           description: Room ID being inspected
 *         bookingId:
 *           type: string
 *           description: Booking ID for checkout
 *         inspectedBy:
 *           type: string
 *           description: Staff member who performed inspection
 *         inspectionDate:
 *           type: string
 *           format: date-time
 *         checklistItems:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               category:
 *                 type: string
 *                 enum: [electronics, plumbing, furniture, amenities, cleanliness]
 *               item:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [working, not_working, missing, damaged]
 *               notes:
 *                 type: string
 *         inventoryVerification:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               itemId:
 *                 type: string
 *               expectedQuantity:
 *                 type: number
 *               actualQuantity:
 *                 type: number
 *               condition:
 *                 type: string
 *               verified:
 *                 type: boolean
 *         inspectionStatus:
 *           type: string
 *           enum: [passed, failed, pending_charges]
 *         canCheckout:
 *           type: boolean
 */

const checkoutInspectionSchema = new mongoose.Schema({
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
  bookingId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Booking',
    required: [true, 'Booking ID is required'],
    index: true,
    unique: true // One inspection per booking
  },
  guestId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    description: 'Primary guest for the booking'
  },
  inspectedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Inspector is required']
  },
  inspectionDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  checklistItems: [{
    category: {
      type: String,
      required: [true, 'Checklist category is required'],
      enum: {
        values: ['electronics', 'plumbing', 'furniture', 'amenities', 'cleanliness', 'safety'],
        message: 'Invalid checklist category'
      }
    },
    item: {
      type: String,
      required: [true, 'Checklist item is required'],
      trim: true
    },
    description: {
      type: String,
      trim: true,
      description: 'Description of what to check'
    },
    status: {
      type: String,
      required: [true, 'Item status is required'],
      enum: {
        values: ['working', 'not_working', 'missing', 'damaged', 'dirty', 'satisfactory'],
        message: 'Invalid item status'
      }
    },
    severity: {
      type: String,
      enum: ['minor', 'moderate', 'major', 'critical'],
      description: 'Severity of issue if any'
    },
    actionRequired: {
      type: String,
      enum: ['none', 'clean', 'repair', 'replace', 'report_maintenance'],
      default: 'none'
    },
    estimatedCost: {
      type: Number,
      min: 0,
      description: 'Estimated cost to fix if applicable'
    },
    notes: {
      type: String,
      maxlength: [300, 'Notes cannot exceed 300 characters']
    },
    photos: [{
      url: String,
      description: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],
    checkedAt: {
      type: Date,
      default: Date.now
    }
  }],
  inventoryVerification: [{
    itemId: {
      type: mongoose.Schema.ObjectId,
      ref: 'InventoryItem',
      required: [true, 'Item ID is required']
    },
    itemName: {
      type: String,
      required: [true, 'Item name is required']
    },
    category: {
      type: String,
      enum: ['bedding', 'toiletries', 'minibar', 'electronics', 'amenities', 'cleaning', 'furniture']
    },
    expectedQuantity: {
      type: Number,
      required: [true, 'Expected quantity is required'],
      min: 0
    },
    actualQuantity: {
      type: Number,
      required: [true, 'Actual quantity is required'],
      min: 0
    },
    condition: {
      type: String,
      required: [true, 'Item condition is required'],
      enum: {
        values: ['excellent', 'good', 'fair', 'worn', 'damaged', 'missing'],
        message: 'Invalid item condition'
      }
    },
    verified: {
      type: Boolean,
      default: function() {
        return this.actualQuantity === this.expectedQuantity && this.condition !== 'damaged';
      }
    },
    discrepancy: {
      type: String,
      enum: ['none', 'missing', 'damaged', 'extra', 'wrong_condition'],
      default: 'none'
    },
    replacementNeeded: {
      type: Boolean,
      default: false
    },
    chargeGuest: {
      type: Boolean,
      default: false
    },
    chargeAmount: {
      type: Number,
      min: 0,
      description: 'Amount to charge guest for this item'
    },
    location: {
      type: String,
      trim: true,
      description: 'Where item was found/expected'
    },
    notes: {
      type: String,
      maxlength: [300, 'Notes cannot exceed 300 characters']
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
  damagesFound: [{
    type: {
      type: String,
      enum: ['inventory_damage', 'room_damage', 'missing_item', 'extra_usage'],
      required: true
    },
    category: {
      type: String,
      enum: ['bedding', 'toiletries', 'minibar', 'electronics', 'amenities', 'furniture', 'fixtures']
    },
    itemId: {
      type: mongoose.Schema.ObjectId,
      ref: 'InventoryItem'
    },
    itemName: String,
    description: {
      type: String,
      required: [true, 'Damage description is required'],
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    severity: {
      type: String,
      enum: ['minor', 'moderate', 'major', 'critical'],
      default: 'minor'
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1
    },
    estimatedCost: {
      type: Number,
      required: [true, 'Estimated cost is required'],
      min: 0
    },
    chargeGuest: {
      type: Boolean,
      required: [true, 'Charge decision is required']
    },
    chargeAmount: {
      type: Number,
      min: 0,
      description: 'Actual amount charged to guest'
    },
    chargeReason: {
      type: String,
      maxlength: [200, 'Charge reason cannot exceed 200 characters']
    },
    location: {
      type: String,
      trim: true
    },
    photos: [{
      url: String,
      description: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],
    reportedToMaintenance: {
      type: Boolean,
      default: false
    },
    maintenanceTicketId: {
      type: mongoose.Schema.ObjectId,
      description: 'Related maintenance ticket if created'
    }
  }],
  roomConditionScore: {
    type: Number,
    min: 0,
    max: 100,
    description: 'Overall room condition score out of 100'
  },
  totalCharges: {
    type: Number,
    default: 0,
    min: 0,
    description: 'Total amount charged to guest'
  },
  chargesSummary: {
    damages: {
      type: Number,
      default: 0,
      min: 0
    },
    missing: {
      type: Number,
      default: 0,
      min: 0
    },
    extra: {
      type: Number,
      default: 0,
      min: 0
    },
    cleaning: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  inspectionStatus: {
    type: String,
    enum: {
      values: ['in_progress', 'passed', 'failed', 'pending_charges', 'completed'],
      message: 'Invalid inspection status'
    },
    default: 'in_progress',
    index: true
  },
  canCheckout: {
    type: Boolean,
    default: function() {
      return this.inspectionStatus === 'passed' || this.inspectionStatus === 'completed';
    }
  },
  checkoutBlocked: {
    type: Boolean,
    default: false,
    description: 'Whether checkout is blocked pending resolution'
  },
  blockingIssues: [{
    issue: String,
    severity: String,
    resolution: String
  }],
  specialInstructions: {
    type: String,
    maxlength: [500, 'Special instructions cannot exceed 500 characters']
  },
  followUpRequired: {
    type: Boolean,
    default: false
  },
  followUpNotes: {
    type: String,
    maxlength: [500, 'Follow-up notes cannot exceed 500 characters']
  },
  timeSpent: {
    type: Number,
    min: 0,
    description: 'Time spent on inspection in minutes'
  },
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  completedAt: {
    type: Date
  },
  approvedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    description: 'Manager who approved the inspection'
  },
  approvedAt: {
    type: Date
  },
  transactionId: {
    type: mongoose.Schema.ObjectId,
    ref: 'InventoryTransaction',
    description: 'Related inventory transaction if charges applied'
  },
  invoiceId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Invoice',
    description: 'Related invoice if guest was charged'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
checkoutInspectionSchema.index({ hotelId: 1, inspectionDate: -1 });
checkoutInspectionSchema.index({ hotelId: 1, inspectionStatus: 1 });
checkoutInspectionSchema.index({ roomId: 1, inspectionDate: -1 });
checkoutInspectionSchema.index({ inspectedBy: 1, inspectionDate: -1 });

// Virtual for inspection duration
checkoutInspectionSchema.virtual('inspectionDuration').get(function() {
  if (!this.completedAt) return null;
  const diffTime = Math.abs(this.completedAt - this.inspectionDate);
  return Math.ceil(diffTime / (1000 * 60)); // in minutes
});

// Virtual for overall pass/fail status
checkoutInspectionSchema.virtual('overallStatus').get(function() {
  const failedChecks = this.checklistItems.filter(item => 
    ['not_working', 'damaged', 'missing'].includes(item.status)
  ).length;
  
  const criticalFailures = this.checklistItems.filter(item =>
    item.severity === 'critical'
  ).length;
  
  if (criticalFailures > 0) return 'critical_issues';
  if (failedChecks > 3) return 'multiple_issues';
  if (failedChecks > 0) return 'minor_issues';
  return 'passed';
});

// Virtual for items needing attention
checkoutInspectionSchema.virtual('itemsNeedingAttention').get(function() {
  return this.inventoryVerification.filter(item => !item.verified).length;
});

// Pre-save middleware
checkoutInspectionSchema.pre('save', function(next) {
  // Calculate total charges
  this.totalCharges = this.damagesFound
    .filter(damage => damage.chargeGuest)
    .reduce((total, damage) => total + (damage.chargeAmount || 0), 0);
  
  // Calculate charges summary
  this.chargesSummary = {
    damages: this.damagesFound
      .filter(d => d.type === 'inventory_damage' && d.chargeGuest)
      .reduce((sum, d) => sum + (d.chargeAmount || 0), 0),
    missing: this.damagesFound
      .filter(d => d.type === 'missing_item' && d.chargeGuest)
      .reduce((sum, d) => sum + (d.chargeAmount || 0), 0),
    extra: this.damagesFound
      .filter(d => d.type === 'extra_usage' && d.chargeGuest)
      .reduce((sum, d) => sum + (d.chargeAmount || 0), 0),
    cleaning: this.checklistItems
      .filter(c => c.status === 'dirty' && c.estimatedCost)
      .reduce((sum, c) => sum + (c.estimatedCost || 0), 0)
  };
  
  // Calculate room condition score
  if (this.checklistItems.length > 0) {
    const statusScores = {
      working: 100,
      satisfactory: 100,
      dirty: 60,
      not_working: 20,
      damaged: 10,
      missing: 0
    };
    
    const totalScore = this.checklistItems.reduce((sum, item) => {
      return sum + (statusScores[item.status] || 50);
    }, 0);
    
    this.roomConditionScore = Math.round(totalScore / this.checklistItems.length);
  }
  
  // Update checkout eligibility
  const criticalIssues = this.checklistItems.filter(item => item.severity === 'critical').length;
  const blockingDamages = this.damagesFound.filter(damage => damage.severity === 'critical').length;
  
  this.checkoutBlocked = criticalIssues > 0 || blockingDamages > 0;
  this.canCheckout = !this.checkoutBlocked && 
    (this.inspectionStatus === 'passed' || this.inspectionStatus === 'completed');
  
  // Set completion date
  if (this.inspectionStatus === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  next();
});

// Instance method to complete inspection
checkoutInspectionSchema.methods.completeInspection = function(status = 'completed') {
  this.inspectionStatus = status;
  this.completedAt = new Date();
  
  return this.save();
};

// Instance method to approve checkout
checkoutInspectionSchema.methods.approveCheckout = function(approvedBy, notes) {
  this.inspectionStatus = 'completed';
  this.approvedBy = approvedBy;
  this.approvedAt = new Date();
  this.canCheckout = true;
  if (notes) this.notes = notes;
  
  return this.save();
};

// Instance method to block checkout
checkoutInspectionSchema.methods.blockCheckout = function(issues, notes) {
  this.checkoutBlocked = true;
  this.canCheckout = false;
  this.blockingIssues = issues.map(issue => ({
    issue: issue.description,
    severity: issue.severity,
    resolution: issue.resolution
  }));
  if (notes) this.notes = notes;
  
  return this.save();
};

// Instance method to add damage
checkoutInspectionSchema.methods.addDamage = function(damageData) {
  this.damagesFound.push(damageData);
  
  return this.save();
};

// Instance method to calculate charges
checkoutInspectionSchema.methods.calculateCharges = function() {
  const charges = {
    damages: 0,
    missing: 0,
    extra: 0,
    total: 0
  };
  
  this.damagesFound.forEach(damage => {
    if (damage.chargeGuest && damage.chargeAmount) {
      charges.total += damage.chargeAmount;
      
      if (damage.type === 'inventory_damage') {
        charges.damages += damage.chargeAmount;
      } else if (damage.type === 'missing_item') {
        charges.missing += damage.chargeAmount;
      } else if (damage.type === 'extra_usage') {
        charges.extra += damage.chargeAmount;
      }
    }
  });
  
  return charges;
};

// Static method to get pending inspections
checkoutInspectionSchema.statics.getPendingInspections = function(hotelId) {
  return this.find({
    hotelId,
    inspectionStatus: { $in: ['in_progress', 'pending_charges'] }
  })
  .populate('roomId', 'roomNumber type')
  .populate('bookingId', 'bookingNumber guestDetails checkOut')
  .populate('inspectedBy', 'name')
  .sort({ inspectionDate: 1 });
};

// Static method to get inspection summary
checkoutInspectionSchema.statics.getInspectionSummary = async function(hotelId, startDate, endDate) {
  const matchQuery = { hotelId: new mongoose.Types.ObjectId(hotelId) };
  
  if (startDate || endDate) {
    matchQuery.inspectionDate = {};
    if (startDate) matchQuery.inspectionDate.$gte = new Date(startDate);
    if (endDate) matchQuery.inspectionDate.$lte = new Date(endDate);
  }
  
  const summary = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$inspectionStatus',
        count: { $sum: 1 },
        totalCharges: { $sum: '$totalCharges' },
        avgRoomScore: { $avg: '$roomConditionScore' }
      }
    }
  ]);
  
  const damagesSummary = await this.aggregate([
    { $match: matchQuery },
    { $unwind: '$damagesFound' },
    { $match: { 'damagesFound.chargeGuest': true } },
    {
      $group: {
        _id: '$damagesFound.type',
        count: { $sum: 1 },
        totalAmount: { $sum: '$damagesFound.chargeAmount' }
      }
    }
  ]);
  
  return {
    statusSummary: summary,
    damagesSummary: damagesSummary
  };
};

// Static method to create inspection from template
checkoutInspectionSchema.statics.createFromTemplate = async function(bookingData) {
  const { hotelId, roomId, bookingId, guestId, inspectedBy } = bookingData;
  
  // Get room inventory to create checklist
  const RoomInventory = mongoose.model('RoomInventory');
  const roomInventory = await RoomInventory.findOne({ roomId }).populate('items.itemId');
  
  const checklistItems = [
    // Electronics
    { category: 'electronics', item: 'TV', description: 'Check if TV is working and all channels accessible' },
    { category: 'electronics', item: 'Remote Control', description: 'Verify all buttons function properly' },
    { category: 'electronics', item: 'Air Conditioning', description: 'Check heating and cooling functions' },
    { category: 'electronics', item: 'Lights', description: 'Test all light switches and bulbs' },
    
    // Plumbing
    { category: 'plumbing', item: 'Bathroom Tap', description: 'Check water pressure and temperature' },
    { category: 'plumbing', item: 'Shower', description: 'Test shower functionality and drainage' },
    { category: 'plumbing', item: 'Toilet', description: 'Verify flushing mechanism works' },
    
    // Furniture
    { category: 'furniture', item: 'Bed', description: 'Check bed frame stability and mattress condition' },
    { category: 'furniture', item: 'Chairs', description: 'Verify structural integrity' },
    { category: 'furniture', item: 'Desk', description: 'Check drawers and surface condition' },
    
    // Amenities
    { category: 'amenities', item: 'Safe', description: 'Test locking mechanism' },
    { category: 'amenities', item: 'Minibar', description: 'Check temperature and contents' },
    
    // Cleanliness
    { category: 'cleanliness', item: 'Overall Cleanliness', description: 'Assess general cleanliness of room' },
    { category: 'cleanliness', item: 'Bathroom Cleanliness', description: 'Check bathroom sanitation' }
  ];
  
  const inventoryVerification = roomInventory ? roomInventory.items.map(item => ({
    itemId: item.itemId._id,
    itemName: item.itemId.name,
    category: item.itemId.category,
    expectedQuantity: item.expectedQuantity,
    actualQuantity: item.currentQuantity,
    condition: item.condition,
    verified: item.currentQuantity === item.expectedQuantity && item.condition !== 'damaged'
  })) : [];
  
  return await this.create({
    hotelId,
    roomId,
    bookingId,
    guestId,
    inspectedBy,
    checklistItems: checklistItems.map(item => ({
      ...item,
      status: 'working' // Default status, will be updated during inspection
    })),
    inventoryVerification,
    inspectionStatus: 'in_progress'
  });
};

export default mongoose.model('CheckoutInspection', checkoutInspectionSchema);
