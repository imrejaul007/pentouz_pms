import mongoose from 'mongoose';
import NotificationAutomationService from '../services/notificationAutomationService.js';

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

// NOTIFICATION AUTOMATION HOOKS
dailyRoutineCheckSchema.post('save', async function(doc) {
  try {
    // Get room data for notifications
    const room = await mongoose.model('Room').findById(doc.roomId).select('roomNumber');
    const roomNumber = room ? room.roomNumber : 'Unknown';

    // 1. New daily check assigned
    if (this.isNew && doc.status === 'pending') {
      await NotificationAutomationService.triggerNotification(
        'daily_check_assigned',
        {
          roomNumber,
          checkId: doc._id,
          assignedToUserId: doc.checkedBy,
          checkDate: doc.checkDate
        },
        [doc.checkedBy],
        'medium',
        doc.hotelId
      );
    }

    // 2. Daily check started
    if (doc.isModified('status') && doc.status === 'in_progress' && doc.startedAt) {
      await NotificationAutomationService.triggerNotification(
        'daily_check_started',
        {
          roomNumber,
          checkId: doc._id,
          startedBy: doc.checkedBy
        },
        'auto',
        'low',
        doc.hotelId
      );
    }

    // 3. Daily check completed
    if (doc.isModified('status') && doc.status === 'completed') {
      await NotificationAutomationService.triggerNotification(
        'daily_check_completed',
        {
          roomNumber,
          checkId: doc._id,
          qualityScore: doc.qualityScore,
          completedBy: doc.checkedBy,
          totalCost: doc.totalCost
        },
        'auto',
        'low',
        doc.hotelId
      );

      // Check for low quality score
      if (doc.qualityScore && doc.qualityScore < 3) {
        await NotificationAutomationService.triggerNotification(
          'daily_check_quality_low',
          {
            roomNumber,
            qualityScore: doc.qualityScore,
            checkId: doc._id
          },
          'auto',
          'medium',
          doc.hotelId
        );
      }
    }

    // 4. Issues found during check
    if (doc.issues && doc.issues.length > 0 && doc.isModified('issues')) {
      const issueDescriptions = doc.issues.map(issue => `${issue.type}: ${issue.description}`).join(', ');

      await NotificationAutomationService.triggerNotification(
        'daily_check_issues',
        {
          roomNumber,
          checkId: doc._id,
          issueDescription: issueDescriptions,
          issueCount: doc.issues.length,
          urgentIssues: doc.issues.filter(i => i.priority === 'urgent').length
        },
        'auto',
        doc.issues.some(i => i.priority === 'urgent') ? 'high' : 'medium',
        doc.hotelId
      );
    }

    // 5. Inventory tracking notifications
    if (doc.isModified('items') && doc.items && doc.items.length > 0) {
      for (const item of doc.items) {
        // Check for damaged inventory
        if (item.condition && item.condition === 'damaged') {
          await NotificationAutomationService.triggerNotification(
            'inventory_damaged',
            {
              roomNumber,
              itemName: item.name,
              itemId: item.inventoryItemId,
              checkId: doc._id,
              condition: item.condition,
              notes: item.notes || 'Damaged during room check',
              checkedBy: doc.checkedBy,
              estimatedValue: item.unitPrice || 0
            },
            'auto',
            'medium',
            doc.hotelId
          );
        }

        // Check for missing inventory (expected but not found)
        if (item.expectedQuantity && item.actualQuantity < item.expectedQuantity) {
          const missingQuantity = item.expectedQuantity - item.actualQuantity;
          const totalValue = missingQuantity * (item.unitPrice || 0);

          // Determine if theft is suspected (high-value items or large quantity missing)
          const theftSuspected = totalValue > 100 || (item.unitPrice > 50 && missingQuantity >= 2);

          if (theftSuspected) {
            await NotificationAutomationService.triggerNotification(
              'inventory_theft_suspected',
              {
                roomNumber,
                itemName: item.name,
                itemId: item.inventoryItemId,
                checkId: doc._id,
                expectedQuantity: item.expectedQuantity,
                actualQuantity: item.actualQuantity,
                missingQuantity,
                unitValue: item.unitPrice || 0,
                totalValue,
                checkedBy: doc.checkedBy,
                notes: item.notes || 'Significant inventory discrepancy detected',
                suspicionLevel: totalValue > 500 ? 'High' : 'Medium'
              },
              'auto',
              'urgent',
              doc.hotelId
            );
          } else {
            await NotificationAutomationService.triggerNotification(
              'inventory_missing',
              {
                roomNumber,
                itemName: item.name,
                itemId: item.inventoryItemId,
                checkId: doc._id,
                expectedQuantity: item.expectedQuantity,
                actualQuantity: item.actualQuantity,
                missingQuantity,
                unitValue: item.unitPrice || 0,
                totalValue,
                checkedBy: doc.checkedBy,
                notes: item.notes || 'Inventory item not found during check'
              },
              'auto',
              'high',
              doc.hotelId
            );
          }
        }
      }
    }

  } catch (error) {
    console.error('Error in DailyRoutineCheck notification hook:', error);
  }
});

export default mongoose.model('DailyRoutineCheck', dailyRoutineCheckSchema);
