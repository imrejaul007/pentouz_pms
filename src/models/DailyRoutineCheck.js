import mongoose from 'mongoose';

const dailyRoutineCheckSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: true
  },
  roomId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Room',
    required: true
  },
  checkedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  checkedAt: {
    type: Date,
    default: Date.now
  },
  checkDate: {
    type: Date,
    required: true,
    default: function() {
      // Set to start of current day
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    }
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'overdue'],
    default: 'pending'
  },
  estimatedDuration: {
    type: Number, // in minutes
    default: 15
  },
  actualDuration: {
    type: Number, // in minutes
    default: null
  },
  startedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
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
    inventoryType: {
      type: String,
      enum: ['fixed', 'daily'],
      required: true
    },
    action: {
      type: String,
      enum: ['replace', 'add', 'laundry', 'reuse', 'no_action'],
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      default: 1
    },
    unitPrice: {
      type: Number,
      default: 0
    },
    totalPrice: {
      type: Number,
      default: 0
    },
    notes: String,
    status: {
      type: String,
      enum: ['available', 'missing', 'damaged', 'needs_cleaning', 'working'],
      default: 'working'
    }
  }],
  totalCost: {
    type: Number,
    default: 0
  },
  notes: String,
  photos: [{
    before: String, // URL to before photo
    after: String,  // URL to after photo
    description: String
  }],
  issues: [{
    type: {
      type: String,
      enum: ['maintenance', 'cleaning', 'inventory', 'other'],
      required: true
    },
    description: String,
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    },
    status: {
      type: String,
      enum: ['open', 'assigned', 'in_progress', 'resolved'],
      default: 'open'
    }
  }],
  qualityScore: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  followUpRequired: {
    type: Boolean,
    default: false
  },
  followUpDate: {
    type: Date,
    default: null
  },
  followUpNotes: String
}, {
  timestamps: true
});

// Indexes for efficient querying
dailyRoutineCheckSchema.index({ hotelId: 1, checkDate: 1 });
dailyRoutineCheckSchema.index({ hotelId: 1, roomId: 1, checkDate: 1 });
dailyRoutineCheckSchema.index({ hotelId: 1, checkedBy: 1, checkDate: 1 });
dailyRoutineCheckSchema.index({ hotelId: 1, status: 1, checkDate: 1 });

// Pre-save middleware to calculate total cost and duration
dailyRoutineCheckSchema.pre('save', function(next) {
  // Calculate total cost from items
  if (this.items && this.items.length > 0) {
    this.totalCost = this.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  }

  // Calculate actual duration if started and completed
  if (this.startedAt && this.completedAt) {
    this.actualDuration = Math.round((this.completedAt - this.startedAt) / (1000 * 60));
  }

  next();
});

// Static method to get rooms that need daily check
dailyRoutineCheckSchema.statics.getRoomsNeedingCheck = function(hotelId, date = new Date()) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  return this.aggregate([
    {
      $match: {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        checkDate: { $gte: startOfDay, $lt: endOfDay }
      }
    },
    {
      $lookup: {
        from: 'rooms',
        localField: 'roomId',
        foreignField: '_id',
        as: 'room'
      }
    },
    {
      $unwind: '$room'
    },
    {
      $group: {
        _id: '$roomId',
        lastCheck: { $first: '$checkedAt' },
        status: { $first: '$status' },
        room: { $first: '$room' }
      }
    },
    {
      $project: {
        _id: 1,
        roomNumber: '$room.roomNumber',
        type: '$room.type',
        floor: '$room.floor',
        lastCheck: 1,
        status: 1
      }
    }
  ]);
};

// Instance method to mark check as started
dailyRoutineCheckSchema.methods.startCheck = function() {
  this.status = 'in_progress';
  this.startedAt = new Date();
  return this.save();
};

// Instance method to complete check
dailyRoutineCheckSchema.methods.completeCheck = function() {
  this.status = 'completed';
  this.completedAt = new Date();
  return this.save();
};

// Instance method to add item to check
dailyRoutineCheckSchema.methods.addItem = function(itemData) {
  this.items.push(itemData);
  return this.save();
};

// Instance method to calculate quality score
dailyRoutineCheckSchema.methods.calculateQualityScore = function() {
  if (!this.items || this.items.length === 0) return null;
  
  let totalScore = 0;
  let itemCount = 0;
  
  this.items.forEach(item => {
    let itemScore = 5; // Default perfect score
    
    switch (item.status) {
      case 'missing':
        itemScore = 1;
        break;
      case 'damaged':
        itemScore = 2;
        break;
      case 'needs_cleaning':
        itemScore = 3;
        break;
      case 'available':
        itemScore = 4;
        break;
      case 'working':
        itemScore = 5;
        break;
    }
    
    totalScore += itemScore;
    itemCount++;
  });
  
  this.qualityScore = Math.round(totalScore / itemCount);
  return this.save();
};

export default mongoose.model('DailyRoutineCheck', dailyRoutineCheckSchema);
