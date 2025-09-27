import mongoose from 'mongoose';
import NotificationAutomationService from '../services/notificationAutomationService.js';

const housekeepingSchema = new mongoose.Schema({
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
  taskType: {
    type: String,
    enum: ['cleaning', 'maintenance', 'inspection', 'deep_clean', 'checkout_clean'],
    required: true
  },
  // Support both field names for backward compatibility
  type: {
    type: String,
    enum: ['cleaning', 'maintenance', 'inspection', 'deep_clean', 'checkout_clean']
  },
  title: {
    type: String,
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
    enum: ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  // Support both field names for backward compatibility
  assignedToUserId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  assignedTo: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  estimatedDuration: {
    type: Number, // minutes
    default: 30
  },
  startedAt: Date,
  completedAt: Date,
  actualDuration: Number, // minutes
  notes: String,
  supplies: [{
    name: String,
    quantity: Number,
    unit: String
  }],
  beforeImages: [String],
  afterImages: [String],
  // Additional fields from seed data
  checkIn: Date,
  checkOut: Date,
  roomStatus: {
    type: String,
    enum: ['dirty', 'clean', 'inspected', 'maintenance_required']
  },
  timeSpent: Number // minutes
}, {
  timestamps: true
});

// Indexes
housekeepingSchema.index({ hotelId: 1, status: 1 });
housekeepingSchema.index({ roomId: 1, status: 1 });
housekeepingSchema.index({ assignedToUserId: 1, status: 1 });

// Handle field compatibility and calculate actual duration
housekeepingSchema.pre('save', function(next) {
  // Handle backward compatibility for field names
  if (this.type && !this.taskType) {
    this.taskType = this.type;
  }
  if (this.taskType && !this.type) {
    this.type = this.taskType;
  }
  
  if (this.assignedTo && !this.assignedToUserId) {
    this.assignedToUserId = this.assignedTo;
  }
  if (this.assignedToUserId && !this.assignedTo) {
    this.assignedTo = this.assignedToUserId;
  }

  // Calculate actual duration when completed
  if (this.isModified('completedAt') && this.startedAt && this.completedAt) {
    this.actualDuration = Math.round((this.completedAt - this.startedAt) / (1000 * 60));
  }
  
  // Use timeSpent as actualDuration if available
  if (this.timeSpent && !this.actualDuration) {
    this.actualDuration = this.timeSpent;
  }
  
  next();
});

// NOTIFICATION AUTOMATION HOOKS
housekeepingSchema.post('save', async function(doc) {
  try {
    // Get room data for notifications
    const room = await mongoose.model('Room').findById(doc.roomId).select('roomNumber');
    const roomNumber = room ? room.roomNumber : 'Unknown';

    // 1. New housekeeping task created
    if (this.isNew) {
      const notificationType = doc.taskType === 'deep_clean' ? 'deep_cleaning_due' : 'room_needs_cleaning';
      const priority = doc.priority === 'urgent' ? 'urgent' : 'medium';

      await NotificationAutomationService.triggerNotification(
        notificationType,
        {
          roomNumber,
          taskType: doc.taskType,
          title: doc.title,
          description: doc.description,
          priority: doc.priority,
          taskId: doc._id,
          estimatedDuration: doc.estimatedDuration,
          specialRequirements: doc.taskType === 'deep_clean' ? 'Deep cleaning required' : null
        },
        'auto',
        priority,
        doc.hotelId
      );
    }

    // 2. Housekeeping task assigned to staff
    if (doc.isModified('assignedTo') && doc.assignedTo) {
      await NotificationAutomationService.triggerNotification(
        'housekeeping_assigned',
        {
          roomNumber,
          taskType: doc.taskType,
          title: doc.title,
          taskId: doc._id,
          assignedTo: doc.assignedTo,
          priority: doc.priority,
          estimatedDuration: doc.estimatedDuration,
          specialInstructions: doc.description
        },
        [doc.assignedTo],
        doc.priority === 'urgent' ? 'urgent' : 'medium',
        doc.hotelId
      );
    }

    // 3. Cleaning started
    if (doc.isModified('status') && doc.status === 'in_progress') {
      await NotificationAutomationService.triggerNotification(
        'cleaning_started',
        {
          roomNumber,
          taskType: doc.taskType,
          title: doc.title,
          taskId: doc._id,
          assignedTo: doc.assignedTo,
          startedAt: doc.startedAt || new Date()
        },
        'auto',
        'low',
        doc.hotelId
      );
    }

    // 4. Cleaning completed
    if (doc.isModified('status') && doc.status === 'completed') {
      await NotificationAutomationService.triggerNotification(
        'cleaning_completed',
        {
          roomNumber,
          taskType: doc.taskType,
          title: doc.title,
          taskId: doc._id,
          completedAt: doc.completedAt || new Date(),
          actualDuration: doc.actualDuration,
          assignedTo: doc.assignedTo,
          roomStatus: doc.roomStatus || 'clean'
        },
        'auto',
        'medium',
        doc.hotelId
      );
    }

    // 5. Quality issue notification
    if (doc.isModified('roomStatus') && doc.roomStatus === 'maintenance_required') {
      await NotificationAutomationService.triggerNotification(
        'cleaning_quality_issue',
        {
          roomNumber,
          taskType: doc.taskType,
          issue: 'Maintenance required after cleaning',
          taskId: doc._id,
          assignedTo: doc.assignedTo,
          notes: doc.notes
        },
        'auto',
        'high',
        doc.hotelId
      );
    }

  } catch (error) {
    console.error('Error in Housekeeping notification hook:', error);
  }
});

export default mongoose.model('Housekeeping', housekeepingSchema);
