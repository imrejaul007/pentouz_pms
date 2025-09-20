import mongoose from 'mongoose';

const staffTaskSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required']
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Staff member is required']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator is required']
  },
  taskType: {
    type: String,
    enum: [
      'daily_inventory_check',
      'inventory_restocking',
      'room_maintenance',
      'guest_service',
      'inventory_delivery',
      'damage_assessment',
      'custom'
    ],
    required: [true, 'Task type is required']
  },
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['assigned', 'in_progress', 'completed', 'cancelled', 'overdue'],
    default: 'assigned'
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  completedAt: Date,
  estimatedDuration: {
    type: Number, // in minutes
    default: 30
  },
  actualDuration: Number, // in minutes
  
  // Task-specific data
  roomIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room'
  }],
  inventoryItems: [{
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem'
    },
    requiredQuantity: Number,
    currentQuantity: Number,
    notes: String
  }],
  
  // Task completion data
  completionNotes: String,
  completionPhotos: [String], // URLs to uploaded photos
  completionData: mongoose.Schema.Types.Mixed, // Flexible data for different task types
  
  // Quality control
  isVerified: {
    type: Boolean,
    default: false
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: Date,
  
  // Recurring task settings
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringPattern: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    required: function() { return this.isRecurring; }
  },
  nextOccurrence: Date,
  
  // Metrics
  startedAt: Date,
  pausedDuration: {
    type: Number, // in minutes
    default: 0
  },
  
  tags: [String],
  
  // Notification settings
  sendReminders: {
    type: Boolean,
    default: true
  },
  remindersSent: [{
    sentAt: Date,
    type: {
      type: String,
      enum: ['due_soon', 'overdue', 'completion_required']
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
staffTaskSchema.index({ assignedTo: 1, status: 1, dueDate: 1 });
staffTaskSchema.index({ hotelId: 1, taskType: 1, status: 1 });
staffTaskSchema.index({ status: 1, dueDate: 1 });
staffTaskSchema.index({ createdAt: -1 });

// Virtual for overdue status
staffTaskSchema.virtual('isOverdue').get(function() {
  if (this.status === 'completed' || this.status === 'cancelled') return false;
  return new Date() > this.dueDate;
});

// Virtual for time remaining
staffTaskSchema.virtual('timeRemaining').get(function() {
  if (this.status === 'completed' || this.status === 'cancelled') return 0;
  const now = new Date();
  const remaining = this.dueDate.getTime() - now.getTime();
  return Math.max(0, Math.floor(remaining / (1000 * 60))); // in minutes
});

// Virtual for completion percentage (for multi-step tasks)
staffTaskSchema.virtual('completionPercentage').get(function() {
  if (this.status === 'completed') return 100;
  if (this.status === 'assigned') return 0;
  
  // For inventory tasks, calculate based on rooms/items completed
  if (this.taskType === 'daily_inventory_check' && this.roomIds.length > 0) {
    const completedRooms = this.completionData?.completedRooms?.length || 0;
    return Math.floor((completedRooms / this.roomIds.length) * 100);
  }
  
  if (this.status === 'in_progress') return 50;
  return 0;
});

// Pre-save middleware to handle status changes
staffTaskSchema.pre('save', function(next) {
  // Set completedAt when status changes to completed
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
    
    // Calculate actual duration if startedAt exists
    if (this.startedAt) {
      const totalMinutes = Math.floor((this.completedAt.getTime() - this.startedAt.getTime()) / (1000 * 60));
      this.actualDuration = totalMinutes - this.pausedDuration;
    }
  }
  
  // Set startedAt when status changes to in_progress
  if (this.isModified('status') && this.status === 'in_progress' && !this.startedAt) {
    this.startedAt = new Date();
  }
  
  // Update overdue status
  if (this.isOverdue && this.status !== 'overdue' && this.status !== 'completed') {
    this.status = 'overdue';
  }
  
  next();
});

// Static methods
staffTaskSchema.statics.getStaffTasks = function(staffId, options = {}) {
  const {
    status,
    taskType,
    priority,
    dueDate,
    limit = 50,
    skip = 0,
    sortBy = '-createdAt'
  } = options;
  
  let query = { assignedTo: staffId };
  
  if (status) query.status = status;
  if (taskType) query.taskType = taskType;
  if (priority) query.priority = priority;
  if (dueDate) {
    const date = new Date(dueDate);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    query.dueDate = { $gte: date, $lt: nextDay };
  }
  
  return this.find(query)
    .populate('roomIds', 'roomNumber type floor')
    .populate('inventoryItems.itemId', 'name category unitPrice')
    .populate('createdBy', 'name email')
    .sort(sortBy)
    .limit(limit)
    .skip(skip);
};

staffTaskSchema.statics.getTodaysTasks = function(staffId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return this.find({
    assignedTo: staffId,
    dueDate: { $gte: today, $lt: tomorrow },
    status: { $nin: ['completed', 'cancelled'] }
  })
  .populate('roomIds', 'roomNumber type floor')
  .populate('inventoryItems.itemId', 'name category')
  .sort('priority dueDate');
};

staffTaskSchema.statics.getOverdueTasks = function(hotelId) {
  return this.find({
    hotelId,
    status: { $nin: ['completed', 'cancelled'] },
    dueDate: { $lt: new Date() }
  })
  .populate('assignedTo', 'name email')
  .populate('roomIds', 'roomNumber')
  .sort('dueDate');
};

staffTaskSchema.statics.getTaskStats = function(hotelId, startDate, endDate) {
  const matchStage = {
    hotelId: mongoose.Types.ObjectId(hotelId)
  };
  
  if (startDate && endDate) {
    matchStage.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalTasks: { $sum: 1 },
        completedTasks: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        overdueTasks: {
          $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] }
        },
        inProgressTasks: {
          $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
        },
        avgCompletionTime: {
          $avg: { $cond: [{ $ne: ['$actualDuration', null] }, '$actualDuration', null] }
        },
        tasksByType: {
          $push: {
            type: '$taskType',
            status: '$status',
            priority: '$priority'
          }
        }
      }
    }
  ]);
};

// Instance methods
staffTaskSchema.methods.markInProgress = function() {
  this.status = 'in_progress';
  if (!this.startedAt) this.startedAt = new Date();
  return this.save();
};

staffTaskSchema.methods.markCompleted = function(completionData = {}) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.completionData = { ...this.completionData, ...completionData };
  
  if (this.startedAt && !this.actualDuration) {
    const totalMinutes = Math.floor((this.completedAt.getTime() - this.startedAt.getTime()) / (1000 * 60));
    this.actualDuration = totalMinutes - this.pausedDuration;
  }
  
  return this.save();
};

staffTaskSchema.methods.addCompletionPhoto = function(photoUrl, description = '') {
  if (!this.completionPhotos) this.completionPhotos = [];
  this.completionPhotos.push(photoUrl);
  
  if (!this.completionData) this.completionData = {};
  if (!this.completionData.photos) this.completionData.photos = [];
  this.completionData.photos.push({ url: photoUrl, description, timestamp: new Date() });
  
  return this.save();
};

staffTaskSchema.methods.updateProgress = function(progressData) {
  if (!this.completionData) this.completionData = {};
  this.completionData = { ...this.completionData, ...progressData };
  
  // Update status based on progress
  if (this.status === 'assigned') {
    this.status = 'in_progress';
    if (!this.startedAt) this.startedAt = new Date();
  }
  
  return this.save();
};

const StaffTask = mongoose.model('StaffTask', staffTaskSchema);
export default StaffTask;
