import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     MaintenanceTask:
 *       type: object
 *       required:
 *         - hotelId
 *         - title
 *         - type
 *         - priority
 *       properties:
 *         _id:
 *           type: string
 *         hotelId:
 *           type: string
 *           description: Hotel ID
 *         roomId:
 *           type: string
 *           description: Room ID (if room-specific)
 *         title:
 *           type: string
 *           description: Task title
 *         description:
 *           type: string
 *           description: Detailed description
 *         type:
 *           type: string
 *           enum: [plumbing, electrical, hvac, cleaning, carpentry, painting, appliance, safety, other]
 *           description: Type of maintenance
 *         priority:
 *           type: string
 *           enum: [low, medium, high, urgent, emergency]
 *           description: Priority level
 *         status:
 *           type: string
 *           enum: [pending, assigned, in_progress, completed, cancelled, on_hold]
 *           default: pending
 *         assignedTo:
 *           type: string
 *           description: Staff member assigned
 *         reportedBy:
 *           type: string
 *           description: Who reported the issue
 *         estimatedDuration:
 *           type: number
 *           description: Estimated duration in hours
 *         actualDuration:
 *           type: number
 *           description: Actual duration in hours
 *         estimatedCost:
 *           type: number
 *           description: Estimated cost
 *         actualCost:
 *           type: number
 *           description: Actual cost
 *         scheduledDate:
 *           type: string
 *           format: date-time
 *         completedDate:
 *           type: string
 *           format: date-time
 *         materials:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               quantity:
 *                 type: number
 *               cost:
 *                 type: number
 *         notes:
 *           type: string
 *         images:
 *           type: array
 *           items:
 *             type: string
 *         isRecurring:
 *           type: boolean
 *           default: false
 *         recurringSchedule:
 *           type: object
 *           properties:
 *             frequency:
 *               type: string
 *               enum: [daily, weekly, monthly, quarterly, yearly]
 *             interval:
 *               type: number
 *             nextDue:
 *               type: string
 *               format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const maintenanceTaskSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required']
  },
  roomId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Room'
  },
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  type: {
    type: String,
    enum: {
      values: ['plumbing', 'electrical', 'hvac', 'cleaning', 'carpentry', 'painting', 'appliance', 'safety', 'other'],
      message: 'Invalid maintenance type'
    },
    required: [true, 'Maintenance type is required']
  },
  priority: {
    type: String,
    enum: {
      values: ['low', 'medium', 'high', 'urgent', 'emergency'],
      message: 'Invalid priority level'
    },
    required: [true, 'Priority is required']
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'assigned', 'in_progress', 'completed', 'cancelled', 'on_hold'],
      message: 'Invalid status'
    },
    default: 'pending'
  },
  assignedTo: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  reportedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  estimatedDuration: {
    type: Number,
    min: [0, 'Duration cannot be negative']
  },
  actualDuration: {
    type: Number,
    min: [0, 'Duration cannot be negative']
  },
  estimatedCost: {
    type: Number,
    min: [0, 'Cost cannot be negative'],
    default: 0
  },
  actualCost: {
    type: Number,
    min: [0, 'Cost cannot be negative'],
    default: 0
  },
  scheduledDate: {
    type: Date
  },
  startedDate: {
    type: Date
  },
  completedDate: {
    type: Date
  },
  dueDate: {
    type: Date
  },
  materials: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    unitCost: {
      type: Number,
      min: 0,
      default: 0
    },
    totalCost: {
      type: Number,
      min: 0,
      default: 0
    },
    supplier: String
  }],
  tools: [{
    type: String,
    trim: true
  }],
  skills: [{
    type: String,
    trim: true
  }],
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot be more than 1000 characters']
  },
  completionNotes: {
    type: String,
    maxlength: [1000, 'Completion notes cannot be more than 1000 characters']
  },
  images: [{
    url: {
      type: String,
      match: [/^https?:\/\//, 'Image URL must be valid']
    },
    caption: String,
    type: {
      type: String,
      enum: ['before', 'during', 'after'],
      default: 'during'
    }
  }],
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringSchedule: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly']
    },
    interval: {
      type: Number,
      min: 1,
      default: 1
    },
    nextDue: Date,
    lastCompleted: Date
  },
  category: {
    type: String,
    enum: ['preventive', 'corrective', 'emergency', 'inspection'],
    default: 'corrective'
  },
  impact: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  roomOutOfOrder: {
    type: Boolean,
    default: false
  },
  vendorRequired: {
    type: Boolean,
    default: false
  },
  vendor: {
    name: String,
    contact: String,
    cost: {
      type: Number,
      min: 0
    }
  },
  warranty: {
    isUnderWarranty: {
      type: Boolean,
      default: false
    },
    warrantyProvider: String,
    expiryDate: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
maintenanceTaskSchema.index({ hotelId: 1, status: 1 });
maintenanceTaskSchema.index({ roomId: 1, status: 1 });
maintenanceTaskSchema.index({ assignedTo: 1, status: 1 });
maintenanceTaskSchema.index({ priority: 1, dueDate: 1 });
maintenanceTaskSchema.index({ type: 1, status: 1 });
maintenanceTaskSchema.index({ isRecurring: 1, 'recurringSchedule.nextDue': 1 });

// Virtual for overdue status
maintenanceTaskSchema.virtual('isOverdue').get(function() {
  return this.dueDate && this.dueDate < new Date() && !['completed', 'cancelled'].includes(this.status);
});

// Virtual for total material cost
maintenanceTaskSchema.virtual('totalMaterialCost').get(function() {
  return this.materials.reduce((total, material) => total + (material.totalCost || 0), 0);
});

// Pre-save middleware to calculate material costs
maintenanceTaskSchema.pre('save', function(next) {
  // Calculate total cost for each material
  this.materials.forEach(material => {
    if (material.quantity && material.unitCost) {
      material.totalCost = material.quantity * material.unitCost;
    }
  });

  // Set started date when status changes to in_progress
  if (this.isModified('status') && this.status === 'in_progress' && !this.startedDate) {
    this.startedDate = new Date();
  }

  // Set completed date when status changes to completed
  if (this.isModified('status') && this.status === 'completed' && !this.completedDate) {
    this.completedDate = new Date();
    
    // Calculate actual duration if started
    if (this.startedDate) {
      this.actualDuration = (this.completedDate - this.startedDate) / (1000 * 60); // minutes
    }

    // Schedule next occurrence for recurring tasks
    if (this.isRecurring && this.recurringSchedule) {
      this.scheduleNextOccurrence();
    }
  }

  next();
});

// Instance method to schedule next occurrence
maintenanceTaskSchema.methods.scheduleNextOccurrence = function() {
  if (!this.isRecurring || !this.recurringSchedule) return;

  const { frequency, interval } = this.recurringSchedule;
  const now = new Date();
  let nextDue = new Date(now);

  switch (frequency) {
    case 'daily':
      nextDue.setDate(nextDue.getDate() + interval);
      break;
    case 'weekly':
      nextDue.setDate(nextDue.getDate() + (interval * 7));
      break;
    case 'monthly':
      nextDue.setMonth(nextDue.getMonth() + interval);
      break;
    case 'quarterly':
      nextDue.setMonth(nextDue.getMonth() + (interval * 3));
      break;
    case 'yearly':
      nextDue.setFullYear(nextDue.getFullYear() + interval);
      break;
  }

  this.recurringSchedule.nextDue = nextDue;
  this.recurringSchedule.lastCompleted = this.completedDate;
};

// Instance method to assign task
maintenanceTaskSchema.methods.assignTask = function(userId, scheduledDate) {
  this.assignedTo = userId;
  this.status = 'assigned';
  if (scheduledDate) {
    this.scheduledDate = scheduledDate;
  }
  return this.save();
};

// Instance method to calculate total cost
maintenanceTaskSchema.methods.calculateTotalCost = function() {
  const materialCost = this.totalMaterialCost;
  const vendorCost = this.vendor?.cost || 0;
  const laborCost = this.actualCost || this.estimatedCost;
  
  return materialCost + vendorCost + laborCost;
};

// Static method to get maintenance statistics
maintenanceTaskSchema.statics.getMaintenanceStats = async function(hotelId, startDate, endDate, staffFilter = {}) {
  const matchQuery = { hotelId, ...staffFilter };
  
  if (startDate && endDate) {
    matchQuery.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  const pipeline = [
    { $match: matchQuery },
    {
      $group: {
        _id: {
          type: '$type',
          status: '$status'
        },
        count: { $sum: 1 },
        avgDuration: { $avg: '$actualDuration' },
        totalCost: { $sum: '$actualCost' }
      }
    },
    {
      $group: {
        _id: '$_id.type',
        stats: {
          $push: {
            status: '$_id.status',
            count: '$count',
            avgDuration: '$avgDuration',
            totalCost: '$totalCost'
          }
        },
        totalTasks: { $sum: '$count' }
      }
    }
  ];

  return await this.aggregate(pipeline);
};

// Static method to get overdue tasks
maintenanceTaskSchema.statics.getOverdueTasks = async function(hotelId, staffFilter = {}) {
  return await this.find({
    hotelId,
    ...staffFilter,
    dueDate: { $lt: new Date() },
    status: { $in: ['pending', 'assigned', 'in_progress'] }
  })
  .populate('roomId', 'number type')
  .populate('assignedTo', 'name')
  .sort('dueDate');
};

// Static method to get upcoming recurring tasks
maintenanceTaskSchema.statics.getUpcomingRecurringTasks = async function(hotelId, days = 7, staffFilter = {}) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);

  return await this.find({
    hotelId,
    ...staffFilter,
    isRecurring: true,
    'recurringSchedule.nextDue': { $lte: futureDate }
  })
  .populate('roomId', 'number type')
  .sort('recurringSchedule.nextDue');
};

export default mongoose.model('MaintenanceTask', maintenanceTaskSchema);
