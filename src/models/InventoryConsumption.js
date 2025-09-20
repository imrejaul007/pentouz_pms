import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     InventoryConsumption:
 *       type: object
 *       required:
 *         - hotelId
 *         - inventoryItemId
 *         - quantity
 *         - consumptionType
 *         - departmentType
 *       properties:
 *         _id:
 *           type: string
 *         hotelId:
 *           type: string
 *           description: Hotel ID this consumption belongs to
 *         inventoryItemId:
 *           type: string
 *           description: Reference to the inventory item consumed
 *         quantity:
 *           type: number
 *           description: Quantity consumed
 *         consumptionType:
 *           type: string
 *           enum: [housekeeping, guest_service, maintenance, room_service, guest_request, replacement, complimentary, chargeable]
 *           description: Type of consumption
 *         departmentType:
 *           type: string
 *           enum: [housekeeping, guest_services, maintenance, administration, food_beverage]
 *           description: Department responsible for consumption
 *         consumedBy:
 *           type: string
 *           description: Staff member who consumed/used the item
 *         consumedFor:
 *           type: string
 *           description: Guest or entity the item was consumed for
 *         roomId:
 *           type: string
 *           description: Room where item was consumed (if applicable)
 *         bookingId:
 *           type: string
 *           description: Booking associated with consumption (if applicable)
 *         guestServiceId:
 *           type: string
 *           description: Guest service request ID (if applicable)
 *         housekeepingTaskId:
 *           type: string
 *           description: Housekeeping task ID (if applicable)
 *         unitCost:
 *           type: number
 *           description: Cost per unit at time of consumption
 *         totalCost:
 *           type: number
 *           description: Total cost of consumption
 *         chargeToGuest:
 *           type: boolean
 *           description: Whether this consumption should be charged to guest
 *         guestChargeAmount:
 *           type: number
 *           description: Amount charged to guest (if different from cost)
 *         isComplimentary:
 *           type: boolean
 *           description: Whether this consumption was complimentary
 *         replacementType:
 *           type: string
 *           enum: [damaged, lost, wear_and_tear, theft, guest_request]
 *           description: Reason for replacement (if applicable)
 *         notes:
 *           type: string
 *           description: Additional notes about consumption
 *         consumedAt:
 *           type: string
 *           format: date-time
 *           description: When the item was consumed
 *         billed:
 *           type: boolean
 *           description: Whether consumption has been billed
 *         billedAt:
 *           type: string
 *           format: date-time
 *           description: When consumption was billed
 *         invoiceId:
 *           type: string
 *           description: Invoice ID if billed
 */

const inventoryConsumptionSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required'],
    index: true
  },
  inventoryItemId: {
    type: mongoose.Schema.ObjectId,
    ref: 'InventoryItem',
    required: [true, 'Inventory item ID is required'],
    index: true
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0.01, 'Quantity must be greater than 0']
  },
  consumptionType: {
    type: String,
    required: [true, 'Consumption type is required'],
    enum: {
      values: ['housekeeping', 'guest_service', 'maintenance', 'room_service', 'guest_request', 'replacement', 'complimentary', 'chargeable'],
      message: 'Invalid consumption type'
    },
    index: true
  },
  departmentType: {
    type: String,
    required: [true, 'Department type is required'],
    enum: {
      values: ['housekeeping', 'guest_services', 'maintenance', 'administration', 'food_beverage'],
      message: 'Invalid department type'
    },
    index: true
  },
  // Staff/User Information
  consumedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    index: true,
    description: 'Staff member who consumed/used the item'
  },
  consumedFor: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    description: 'Guest or entity the item was consumed for'
  },
  // Location and Context
  roomId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Room',
    index: true,
    description: 'Room where item was consumed'
  },
  bookingId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Booking',
    index: true,
    description: 'Booking associated with consumption'
  },
  // Related Service Records
  guestServiceId: {
    type: mongoose.Schema.ObjectId,
    ref: 'GuestService',
    index: true,
    description: 'Guest service request that triggered consumption'
  },
  housekeepingTaskId: {
    type: mongoose.Schema.ObjectId,
    ref: 'HousekeepingTask',
    index: true,
    description: 'Housekeeping task that required consumption'
  },
  maintenanceRequestId: {
    type: mongoose.Schema.ObjectId,
    ref: 'MaintenanceRequest',
    description: 'Maintenance request that required consumption'
  },
  // Financial Information
  unitCost: {
    type: Number,
    required: [true, 'Unit cost is required'],
    min: [0, 'Unit cost cannot be negative'],
    description: 'Cost per unit at time of consumption'
  },
  totalCost: {
    type: Number,
    required: [true, 'Total cost is required'],
    min: [0, 'Total cost cannot be negative'],
    description: 'Total cost of consumption (quantity * unitCost)'
  },
  chargeToGuest: {
    type: Boolean,
    default: false,
    description: 'Whether this consumption should be charged to guest'
  },
  guestChargeAmount: {
    type: Number,
    min: [0, 'Guest charge amount cannot be negative'],
    description: 'Amount to charge guest (if different from cost)'
  },
  isComplimentary: {
    type: Boolean,
    default: false,
    description: 'Whether this consumption was complimentary to guest'
  },
  // Replacement Information
  replacementType: {
    type: String,
    enum: {
      values: ['damaged', 'lost', 'wear_and_tear', 'theft', 'guest_request'],
      message: 'Invalid replacement type'
    },
    description: 'Reason for replacement if applicable'
  },
  // Quality and Performance Tracking
  expectedQuantity: {
    type: Number,
    min: [0, 'Expected quantity cannot be negative'],
    description: 'Expected quantity for this type of task/service'
  },
  efficiency: {
    type: Number,
    min: [0, 'Efficiency cannot be negative'],
    max: [200, 'Efficiency cannot exceed 200%'],
    description: 'Efficiency percentage (actual vs expected consumption)'
  },
  // VIP and Special Requirements
  isVIPGuest: {
    type: Boolean,
    default: false,
    description: 'Whether consumption was for VIP guest'
  },
  specialRequirements: {
    type: String,
    maxlength: [300, 'Special requirements cannot exceed 300 characters'],
    description: 'Special requirements or preferences'
  },
  // Additional Information
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters'],
    description: 'Additional notes about consumption'
  },
  consumedAt: {
    type: Date,
    default: Date.now,
    index: true,
    description: 'When the item was consumed'
  },
  // Billing Information
  billed: {
    type: Boolean,
    default: false,
    index: true,
    description: 'Whether consumption has been billed'
  },
  billedAt: {
    type: Date,
    description: 'When consumption was billed'
  },
  invoiceId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Invoice',
    description: 'Invoice ID if consumption was billed'
  },
  // Approval Workflow
  status: {
    type: String,
    enum: {
      values: ['pending', 'approved', 'billed', 'disputed', 'adjusted'],
      message: 'Invalid status'
    },
    default: 'approved',
    index: true
  },
  approvedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    description: 'Staff member who approved the consumption'
  },
  approvedAt: {
    type: Date,
    description: 'When consumption was approved'
  },
  // Prediction and Analytics Data
  predicted: {
    type: Boolean,
    default: false,
    description: 'Whether this consumption was predicted by algorithm'
  },
  predictionAccuracy: {
    type: Number,
    min: [0, 'Prediction accuracy cannot be negative'],
    max: [100, 'Prediction accuracy cannot exceed 100%'],
    description: 'Accuracy of prediction if this was predicted'
  },
  // Automation Flags
  autoGenerated: {
    type: Boolean,
    default: false,
    description: 'Whether consumption was automatically generated'
  },
  sourceSystem: {
    type: String,
    enum: ['manual', 'housekeeping', 'guest_service', 'room_service', 'maintenance', 'automated'],
    default: 'manual',
    description: 'System that generated this consumption record'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound Indexes for efficient queries
inventoryConsumptionSchema.index({ hotelId: 1, consumptionType: 1, consumedAt: -1 });
inventoryConsumptionSchema.index({ hotelId: 1, departmentType: 1, consumedAt: -1 });
inventoryConsumptionSchema.index({ hotelId: 1, roomId: 1, consumedAt: -1 });
inventoryConsumptionSchema.index({ hotelId: 1, consumedBy: 1, consumedAt: -1 });
inventoryConsumptionSchema.index({ hotelId: 1, billed: 1, chargeToGuest: 1 });
inventoryConsumptionSchema.index({ inventoryItemId: 1, consumedAt: -1 });
inventoryConsumptionSchema.index({ bookingId: 1, chargeToGuest: 1 });

// Virtual for cost efficiency
inventoryConsumptionSchema.virtual('costEfficiency').get(function() {
  if (!this.expectedQuantity || this.expectedQuantity === 0) return null;
  return Math.round((this.expectedQuantity / this.quantity) * 100);
});

// Virtual for profit margin (if charged to guest)
inventoryConsumptionSchema.virtual('profitMargin').get(function() {
  if (!this.chargeToGuest || !this.guestChargeAmount) return 0;
  return this.guestChargeAmount - this.totalCost;
});

// Virtual for days since consumption
inventoryConsumptionSchema.virtual('daysSinceConsumption').get(function() {
  const now = new Date();
  const consumed = new Date(this.consumedAt);
  return Math.floor((now - consumed) / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to calculate totals
inventoryConsumptionSchema.pre('save', function(next) {
  // Calculate total cost
  this.totalCost = this.quantity * this.unitCost;

  // Set guest charge amount if not specified but chargeable
  if (this.chargeToGuest && !this.guestChargeAmount) {
    // Use a default markup of 150% if no specific guest price
    this.guestChargeAmount = Math.round(this.totalCost * 1.5);
  }

  // Calculate efficiency if expected quantity is provided
  if (this.expectedQuantity && this.expectedQuantity > 0) {
    this.efficiency = Math.round((this.expectedQuantity / this.quantity) * 100);
  }

  // Set approval timestamp if being approved
  if (this.status === 'approved' && !this.approvedAt) {
    this.approvedAt = new Date();
  }

  // Set billing timestamp if being billed
  if (this.billed && !this.billedAt) {
    this.billedAt = new Date();
  }

  next();
});

// Instance method to mark as billed
inventoryConsumptionSchema.methods.markAsBilled = function(invoiceId) {
  this.billed = true;
  this.billedAt = new Date();
  this.status = 'billed';
  if (invoiceId) {
    this.invoiceId = invoiceId;
  }
  return this.save();
};

// Instance method to update guest charges
inventoryConsumptionSchema.methods.updateGuestCharges = function(chargeAmount, isComplimentary = false) {
  this.chargeToGuest = !isComplimentary && chargeAmount > 0;
  this.guestChargeAmount = chargeAmount;
  this.isComplimentary = isComplimentary;
  return this.save();
};

// Static method to get consumption statistics
inventoryConsumptionSchema.statics.getConsumptionStats = async function(hotelId, filters = {}) {
  const matchQuery = { hotelId, ...filters };

  const pipeline = [
    { $match: matchQuery },
    {
      $group: {
        _id: {
          type: '$consumptionType',
          department: '$departmentType'
        },
        totalQuantity: { $sum: '$quantity' },
        totalCost: { $sum: '$totalCost' },
        totalRevenue: { $sum: { $cond: ['$chargeToGuest', '$guestChargeAmount', 0] } },
        avgEfficiency: { $avg: '$efficiency' },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.type',
        departmentStats: {
          $push: {
            department: '$_id.department',
            totalQuantity: '$totalQuantity',
            totalCost: '$totalCost',
            totalRevenue: '$totalRevenue',
            avgEfficiency: '$avgEfficiency',
            count: '$count'
          }
        },
        overallQuantity: { $sum: '$totalQuantity' },
        overallCost: { $sum: '$totalCost' },
        overallRevenue: { $sum: '$totalRevenue' }
      }
    }
  ];

  return await this.aggregate(pipeline);
};

// Static method to get top consuming items
inventoryConsumptionSchema.statics.getTopConsumingItems = async function(hotelId, limit = 10, dateRange = {}) {
  const matchQuery = { hotelId };

  if (dateRange.start && dateRange.end) {
    matchQuery.consumedAt = {
      $gte: new Date(dateRange.start),
      $lte: new Date(dateRange.end)
    };
  }

  const pipeline = [
    { $match: matchQuery },
    {
      $group: {
        _id: '$inventoryItemId',
        totalQuantity: { $sum: '$quantity' },
        totalCost: { $sum: '$totalCost' },
        totalRevenue: { $sum: { $cond: ['$chargeToGuest', '$guestChargeAmount', 0] } },
        avgEfficiency: { $avg: '$efficiency' },
        consumptionCount: { $sum: 1 }
      }
    },
    { $sort: { totalQuantity: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'inventoryitems',
        localField: '_id',
        foreignField: '_id',
        as: 'item'
      }
    },
    { $unwind: '$item' }
  ];

  return await this.aggregate(pipeline);
};

// Static method to get staff consumption efficiency
inventoryConsumptionSchema.statics.getStaffEfficiency = async function(hotelId, dateRange = {}) {
  const matchQuery = {
    hotelId,
    consumedBy: { $exists: true },
    efficiency: { $exists: true }
  };

  if (dateRange.start && dateRange.end) {
    matchQuery.consumedAt = {
      $gte: new Date(dateRange.start),
      $lte: new Date(dateRange.end)
    };
  }

  const pipeline = [
    { $match: matchQuery },
    {
      $group: {
        _id: '$consumedBy',
        avgEfficiency: { $avg: '$efficiency' },
        totalTasks: { $sum: 1 },
        totalCost: { $sum: '$totalCost' },
        totalQuantity: { $sum: '$quantity' }
      }
    },
    { $sort: { avgEfficiency: -1 } },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'staff'
      }
    },
    { $unwind: '$staff' }
  ];

  return await this.aggregate(pipeline);
};

// Static method to get consumption trends
inventoryConsumptionSchema.statics.getConsumptionTrends = async function(hotelId, period = 'daily', limit = 30) {
  const matchQuery = { hotelId };

  let groupBy;
  switch (period) {
    case 'hourly':
      groupBy = {
        year: { $year: '$consumedAt' },
        month: { $month: '$consumedAt' },
        day: { $dayOfMonth: '$consumedAt' },
        hour: { $hour: '$consumedAt' }
      };
      break;
    case 'weekly':
      groupBy = {
        year: { $year: '$consumedAt' },
        week: { $week: '$consumedAt' }
      };
      break;
    case 'monthly':
      groupBy = {
        year: { $year: '$consumedAt' },
        month: { $month: '$consumedAt' }
      };
      break;
    default: // daily
      groupBy = {
        year: { $year: '$consumedAt' },
        month: { $month: '$consumedAt' },
        day: { $dayOfMonth: '$consumedAt' }
      };
  }

  const pipeline = [
    { $match: matchQuery },
    {
      $group: {
        _id: groupBy,
        totalQuantity: { $sum: '$quantity' },
        totalCost: { $sum: '$totalCost' },
        totalRevenue: { $sum: { $cond: ['$chargeToGuest', '$guestChargeAmount', 0] } },
        avgEfficiency: { $avg: '$efficiency' },
        uniqueItems: { $addToSet: '$inventoryItemId' },
        consumptionCount: { $sum: 1 }
      }
    },
    {
      $addFields: {
        uniqueItemCount: { $size: '$uniqueItems' }
      }
    },
    { $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1, '_id.hour': -1 } },
    { $limit: limit }
  ];

  return await this.aggregate(pipeline);
};

// Static method to predict consumption for housekeeping
inventoryConsumptionSchema.statics.predictHousekeepingConsumption = async function(hotelId, roomTypeId, taskTypes = []) {
  const matchQuery = {
    hotelId,
    consumptionType: 'housekeeping',
    housekeepingTaskId: { $exists: true }
  };

  // Add date filter for recent consumption patterns (last 90 days)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  matchQuery.consumedAt = { $gte: ninetyDaysAgo };

  const pipeline = [
    { $match: matchQuery },
    {
      $lookup: {
        from: 'housekeepingtasks',
        localField: 'housekeepingTaskId',
        foreignField: '_id',
        as: 'task'
      }
    },
    { $unwind: '$task' },
    {
      $lookup: {
        from: 'rooms',
        localField: 'roomId',
        foreignField: '_id',
        as: 'room'
      }
    },
    { $unwind: '$room' },
    {
      $match: roomTypeId ? { 'room.roomType': roomTypeId } : {}
    },
    {
      $group: {
        _id: {
          inventoryItemId: '$inventoryItemId',
          taskType: '$task.tasks',
          roomType: '$room.roomType'
        },
        avgQuantity: { $avg: '$quantity' },
        minQuantity: { $min: '$quantity' },
        maxQuantity: { $max: '$quantity' },
        totalConsumptions: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'inventoryitems',
        localField: '_id.inventoryItemId',
        foreignField: '_id',
        as: 'item'
      }
    },
    { $unwind: '$item' }
  ];

  return await this.aggregate(pipeline);
};

export default mongoose.model('InventoryConsumption', inventoryConsumptionSchema);
