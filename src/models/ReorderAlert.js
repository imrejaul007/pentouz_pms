import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     ReorderAlert:
 *       type: object
 *       required:
 *         - hotelId
 *         - inventoryItemId
 *         - alertType
 *       properties:
 *         _id:
 *           type: string
 *         hotelId:
 *           type: string
 *           description: Hotel ID this alert belongs to
 *         inventoryItemId:
 *           type: string
 *           description: Reference to the inventory item
 *         alertType:
 *           type: string
 *           enum: [low_stock, critical_stock, reorder_needed]
 *           description: Type of reorder alert
 *         priority:
 *           type: string
 *           enum: [low, medium, high, critical]
 *           description: Priority level of the alert
 *         status:
 *           type: string
 *           enum: [active, acknowledged, resolved, dismissed]
 *           description: Current status of the alert
 *         currentStock:
 *           type: number
 *           description: Stock level when alert was created
 *         reorderPoint:
 *           type: number
 *           description: Reorder threshold that triggered this alert
 *         suggestedQuantity:
 *           type: number
 *           description: Suggested reorder quantity
 *         estimatedCost:
 *           type: number
 *           description: Estimated cost of reorder
 *         acknowledgedBy:
 *           type: string
 *           description: User who acknowledged the alert
 *         acknowledgedAt:
 *           type: string
 *           format: date-time
 *         resolvedBy:
 *           type: string
 *           description: User who resolved the alert
 *         resolvedAt:
 *           type: string
 *           format: date-time
 *         notes:
 *           type: string
 *           description: Additional notes about the alert
 */

const reorderAlertSchema = new mongoose.Schema({
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
  alertType: {
    type: String,
    required: [true, 'Alert type is required'],
    enum: {
      values: ['low_stock', 'critical_stock', 'reorder_needed'],
      message: 'Invalid alert type'
    },
    index: true
  },
  priority: {
    type: String,
    required: [true, 'Priority is required'],
    enum: {
      values: ['low', 'medium', 'high', 'critical'],
      message: 'Invalid priority level'
    },
    default: 'medium',
    index: true
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: {
      values: ['active', 'acknowledged', 'resolved', 'dismissed'],
      message: 'Invalid status'
    },
    default: 'active',
    index: true
  },
  currentStock: {
    type: Number,
    required: [true, 'Current stock is required'],
    min: [0, 'Current stock must be non-negative']
  },
  reorderPoint: {
    type: Number,
    required: [true, 'Reorder point is required'],
    min: [0, 'Reorder point must be non-negative']
  },
  suggestedQuantity: {
    type: Number,
    required: [true, 'Suggested quantity is required'],
    min: [1, 'Suggested quantity must be at least 1']
  },
  estimatedCost: {
    type: Number,
    min: [0, 'Estimated cost must be non-negative']
  },
  // Alert lifecycle tracking
  acknowledgedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  acknowledgedAt: {
    type: Date
  },
  resolvedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  resolvedAt: {
    type: Date
  },
  dismissedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  dismissedAt: {
    type: Date
  },
  // Additional information
  supplierInfo: {
    name: String,
    contact: String,
    email: String,
    leadTime: Number
  },
  urgencyScore: {
    type: Number,
    min: [0, 'Urgency score must be non-negative'],
    max: [100, 'Urgency score cannot exceed 100'],
    description: 'Calculated urgency score (0-100)'
  },
  expectedDeliveryDate: {
    type: Date,
    description: 'Expected delivery date if order is placed'
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  // Email notification tracking
  emailsSent: [{
    recipient: {
      type: String,
      required: true
    },
    sentAt: {
      type: Date,
      default: Date.now
    },
    type: {
      type: String,
      enum: ['alert', 'reminder', 'escalation'],
      default: 'alert'
    }
  }],
  lastEmailSent: {
    type: Date
  },
  // Related reorder request
  reorderRequestId: {
    type: mongoose.Schema.ObjectId,
    ref: 'ReorderRequest'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
reorderAlertSchema.index({ hotelId: 1, status: 1 });
reorderAlertSchema.index({ hotelId: 1, priority: 1, status: 1 });
reorderAlertSchema.index({ hotelId: 1, alertType: 1, status: 1 });
reorderAlertSchema.index({ inventoryItemId: 1, status: 1 });
reorderAlertSchema.index({ createdAt: 1 }); // For cleanup and aging
reorderAlertSchema.index({ hotelId: 1, createdAt: -1 }); // For dashboard queries

// Virtual for age of alert in hours
reorderAlertSchema.virtual('ageInHours').get(function() {
  const now = new Date();
  const created = this.createdAt;
  return Math.floor((now - created) / (1000 * 60 * 60));
});

// Virtual for urgency level based on priority and age
reorderAlertSchema.virtual('urgencyLevel').get(function() {
  const age = this.ageInHours;
  const priority = this.priority;

  if (priority === 'critical' || age > 72) return 'critical';
  if (priority === 'high' || age > 48) return 'high';
  if (priority === 'medium' || age > 24) return 'medium';
  return 'low';
});

// Virtual for display status
reorderAlertSchema.virtual('displayStatus').get(function() {
  if (this.status === 'resolved') return 'Resolved';
  if (this.status === 'acknowledged') return 'In Progress';
  if (this.status === 'dismissed') return 'Dismissed';
  return 'Needs Attention';
});

// Pre-save middleware to calculate urgency score
reorderAlertSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('currentStock') || this.isModified('reorderPoint')) {
    // Calculate urgency score based on how far below reorder point we are
    const stockDeficit = Math.max(0, this.reorderPoint - this.currentStock);
    const deficitPercentage = this.reorderPoint > 0 ? (stockDeficit / this.reorderPoint) * 100 : 0;

    // Base urgency on deficit percentage
    let urgencyScore = Math.min(deficitPercentage, 100);

    // Adjust based on priority
    switch (this.priority) {
      case 'critical':
        urgencyScore = Math.min(urgencyScore + 25, 100);
        break;
      case 'high':
        urgencyScore = Math.min(urgencyScore + 15, 100);
        break;
      case 'medium':
        urgencyScore = Math.min(urgencyScore + 5, 100);
        break;
    }

    this.urgencyScore = Math.round(urgencyScore);
  }

  next();
});

// Static method to get active alerts for a hotel
reorderAlertSchema.statics.getActiveAlerts = function(hotelId, options = {}) {
  const query = {
    hotelId,
    status: { $in: ['active', 'acknowledged'] }
  };

  if (options.priority) {
    query.priority = options.priority;
  }

  if (options.alertType) {
    query.alertType = options.alertType;
  }

  return this.find(query)
    .populate('inventoryItemId', 'name category currentStock')
    .populate('acknowledgedBy', 'name email')
    .sort({ urgencyScore: -1, createdAt: 1 });
};

// Static method to get alerts by status
reorderAlertSchema.statics.getAlertsByStatus = function(hotelId, status) {
  return this.find({ hotelId, status })
    .populate('inventoryItemId', 'name category currentStock unitPrice')
    .populate('acknowledgedBy resolvedBy dismissedBy', 'name email')
    .sort({ createdAt: -1 });
};

// Static method to get alert statistics
reorderAlertSchema.statics.getAlertStats = function(hotelId) {
  return this.aggregate([
    { $match: { hotelId: new mongoose.Types.ObjectId(hotelId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        averageUrgency: { $avg: '$urgencyScore' }
      }
    }
  ]);
};

// Instance method to acknowledge alert
reorderAlertSchema.methods.acknowledge = function(userId, notes) {
  this.status = 'acknowledged';
  this.acknowledgedBy = userId;
  this.acknowledgedAt = new Date();
  if (notes) this.notes = notes;
  return this.save();
};

// Instance method to resolve alert
reorderAlertSchema.methods.resolve = function(userId, notes) {
  this.status = 'resolved';
  this.resolvedBy = userId;
  this.resolvedAt = new Date();
  if (notes) this.notes = notes;
  return this.save();
};

// Instance method to dismiss alert
reorderAlertSchema.methods.dismiss = function(userId, notes) {
  this.status = 'dismissed';
  this.dismissedBy = userId;
  this.dismissedAt = new Date();
  if (notes) this.notes = notes;
  return this.save();
};

// Instance method to log email sent
reorderAlertSchema.methods.logEmailSent = function(recipient, type = 'alert') {
  this.emailsSent.push({ recipient, type });
  this.lastEmailSent = new Date();
  return this.save();
};

export default mongoose.model('ReorderAlert', reorderAlertSchema);
