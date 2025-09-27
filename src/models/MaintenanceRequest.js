import mongoose from 'mongoose';
import NotificationAutomationService from '../services/notificationAutomationService.js';

const maintenanceRequestSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  floorId: {
    type: Number,
    required: false
  },
  issueType: {
    type: String,
    enum: ['plumbing', 'electrical', 'hvac', 'furniture', 'appliance', 'other'],
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  description: {
    type: String,
    required: true
  },
  estimatedCost: {
    type: Number,
    default: null
  },
  actualCost: {
    type: Number,
    default: null
  },
  scheduledDate: {
    type: Date,
    default: null
  },
  completedDate: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    default: null
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  images: [{
    type: String, // URLs to images
    default: []
  }],
  notes: {
    type: String,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
maintenanceRequestSchema.index({ hotelId: 1, status: 1 });
maintenanceRequestSchema.index({ roomId: 1, status: 1 });
maintenanceRequestSchema.index({ issueType: 1, priority: 1 });
maintenanceRequestSchema.index({ vendorId: 1, status: 1 });
maintenanceRequestSchema.index({ floorId: 1, status: 1 });

// NOTIFICATION AUTOMATION HOOKS
maintenanceRequestSchema.post('save', async function(doc) {
  try {
    // Get room data for notifications
    const room = await mongoose.model('Room').findById(doc.roomId).select('roomNumber');
    const roomNumber = room ? room.roomNumber : 'Unknown';

    // 1. New maintenance request created
    if (this.isNew) {
      const notificationType = doc.priority === 'urgent' ? 'maintenance_urgent' : 'maintenance_request_created';
      const priority = doc.priority === 'urgent' ? 'urgent' : 'medium';

      await NotificationAutomationService.triggerNotification(
        notificationType,
        {
          roomNumber,
          issueType: doc.issueType,
          description: doc.description,
          priority: doc.priority,
          requestId: doc._id,
          createdBy: doc.createdBy,
          estimatedCost: doc.estimatedCost
        },
        'auto',
        priority,
        doc.hotelId
      );
    }

    // 2. Maintenance assigned to staff
    if (doc.isModified('assignedTo') && doc.assignedTo) {
      await NotificationAutomationService.triggerNotification(
        'maintenance_assigned',
        {
          roomNumber,
          issueType: doc.issueType,
          description: doc.description,
          requestId: doc._id,
          assignedTo: doc.assignedTo,
          priority: doc.priority,
          scheduledDate: doc.scheduledDate
        },
        [doc.assignedTo],
        doc.priority === 'urgent' ? 'urgent' : 'medium',
        doc.hotelId
      );
    }

    // 3. Maintenance status changed to in_progress
    if (doc.isModified('status') && doc.status === 'in_progress') {
      await NotificationAutomationService.triggerNotification(
        'maintenance_started',
        {
          roomNumber,
          issueType: doc.issueType,
          description: doc.description,
          requestId: doc._id,
          assignedTo: doc.assignedTo
        },
        'auto',
        'low',
        doc.hotelId
      );
    }

    // 4. Maintenance completed
    if (doc.isModified('status') && doc.status === 'completed') {
      await NotificationAutomationService.triggerNotification(
        'maintenance_completed',
        {
          roomNumber,
          issueType: doc.issueType,
          description: doc.description,
          requestId: doc._id,
          completedDate: doc.completedDate,
          actualCost: doc.actualCost,
          createdBy: doc.createdBy,
          assignedTo: doc.assignedTo
        },
        'auto',
        'medium',
        doc.hotelId
      );
    }

    // 5. High-cost maintenance alert
    if (doc.isModified('actualCost') && doc.actualCost && doc.actualCost >= 500) {
      await NotificationAutomationService.triggerNotification(
        'maintenance_high_cost',
        {
          roomNumber,
          issueType: doc.issueType,
          cost: doc.actualCost,
          requestId: doc._id,
          description: doc.description
        },
        'auto',
        'high',
        doc.hotelId
      );
    }

    // Phase 6: Equipment failure pattern detection
    if (this.isNew && doc.issueType) {
      try {
        const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        // Count similar failures in the last 30 days
        const similarFailures = await mongoose.model('MaintenanceRequest').countDocuments({
          hotelId: doc.hotelId,
          issueType: doc.issueType,
          createdAt: { $gte: last30Days },
          _id: { $ne: doc._id } // Exclude current request
        });

        // If we have 3 or more similar failures, trigger pattern alert
        if (similarFailures >= 3) {
          // Get all similar requests for detailed analysis
          const recentRequests = await mongoose.model('MaintenanceRequest').find({
            hotelId: doc.hotelId,
            issueType: doc.issueType,
            createdAt: { $gte: last30Days }
          }).select('roomId priority actualCost estimatedCost createdAt').populate('roomId', 'roomNumber');

          const urgentCount = recentRequests.filter(req => req.priority === 'urgent').length;
          const avgCost = recentRequests.reduce((sum, req) => sum + (req.actualCost || req.estimatedCost || 0), 0) / recentRequests.length;
          const totalCost = recentRequests.reduce((sum, req) => sum + (req.actualCost || req.estimatedCost || 0), 0);

          const priority = urgentCount >= 2 ? 'urgent' : similarFailures >= 5 ? 'high' : 'medium';

          await NotificationAutomationService.triggerNotification(
            'equipment_failure_pattern',
            {
              equipmentType: doc.issueType,
              failureCount: similarFailures + 1, // Include current request
              timeFrame: '30 days',
              failureRate: Math.round(((similarFailures + 1) / 30) * 100) / 100,
              avgCost: Math.round(avgCost),
              urgentFailures: urgentCount,
              totalCost: Math.round(totalCost),
              pattern: similarFailures >= 5 ? 'Critical pattern detected' : 'Concerning pattern detected',
              affectedRooms: [...new Set(recentRequests.map(req => req.roomId?.roomNumber).filter(Boolean))],
              recommendation: this.generateMaintenanceRecommendation(similarFailures + 1, urgentCount),
              preventiveMaintenance: similarFailures >= 4,
              currentRequestId: doc._id,
              latestFailure: {
                roomNumber,
                description: doc.description,
                priority: doc.priority
              }
            },
            'auto',
            priority,
            doc.hotelId
          );
        }

      } catch (error) {
        console.error('Error in equipment failure pattern detection:', error);
      }
    }

  } catch (error) {
    console.error('Error in MaintenanceRequest notification hook:', error);
  }
});

// Helper method to generate maintenance recommendations based on failure patterns
maintenanceRequestSchema.methods.generateMaintenanceRecommendation = function(failureCount, urgentCount) {
  if (failureCount >= 5) {
    return `Consider replacing all ${this.issueType} equipment - high failure rate indicates end of life`;
  } else if (urgentCount >= 2) {
    return `Schedule immediate inspection of all ${this.issueType} equipment across the hotel`;
  } else {
    return `Implement preventive maintenance schedule for ${this.issueType} equipment`;
  }
};

export default mongoose.model('MaintenanceRequest', maintenanceRequestSchema);
