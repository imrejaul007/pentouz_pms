import mongoose from 'mongoose';

const staffAlertSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      'maintenance_request',
      'housekeeping_urgent',
      'guest_complaint',
      'safety_incident',
      'equipment_failure',
      'supply_shortage',
      'room_issue',
      'guest_request',
      'checkout_delay',
      'cleaning_priority',
      'maintenance_emergency',
      'guest_service_vip',
      'inventory_critical',
      'room_out_of_order',
      'staff_assistance',
      'security_alert',
      'system_notification',
      'booking_issue',
      'payment_problem',
      'guest_no_show',
      'overbooking_alert',
      'special_request',
      'emergency_response',
      'compliance_issue',
      'training_reminder',
      'shift_change',
      'meetup_supervision_required',
      'meetup_high_risk',
      'meetup_safety_concern',
      'meetup_staff_required'
    ]
  },

  priority: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'urgent', 'critical'],
    default: 'medium'
  },

  title: {
    type: String,
    required: true,
    maxlength: 200,
    trim: true
  },

  message: {
    type: String,
    required: true,
    maxlength: 1000,
    trim: true
  },

  category: {
    type: String,
    required: true,
    enum: ['operational', 'maintenance', 'guest_service', 'inventory', 'safety', 'system'],
    default: 'operational'
  },

  status: {
    type: String,
    required: true,
    enum: ['active', 'acknowledged', 'in_progress', 'resolved', 'dismissed'],
    default: 'active'
  },

  hotelId: {
    type: String,
    required: true,
    index: true
  },

  // User who created the alert
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // User assigned to handle the alert
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // User who acknowledged the alert
  acknowledgedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // User who last updated the alert
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Additional metadata
  metadata: {
    roomNumber: {
      type: String,
      trim: true
    },
    guestName: {
      type: String,
      trim: true
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking'
    },
    maintenanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MaintenanceRequest'
    },
    inventoryItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem'
    },
    urgencyLevel: {
      type: String,
      enum: ['normal', 'urgent', 'emergency']
    },
    estimatedDuration: {
      type: Number, // in minutes
      min: 0
    },
    location: {
      type: String,
      trim: true
    },
    equipmentType: {
      type: String,
      trim: true
    },
    department: {
      type: String,
      enum: ['housekeeping', 'maintenance', 'front_desk', 'kitchen', 'security', 'management']
    }
  },

  // Timestamps
  acknowledgedAt: {
    type: Date,
    default: null
  },

  resolvedAt: {
    type: Date,
    default: null
  },

  dueDate: {
    type: Date,
    default: null
  },

  // Comments and updates
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    message: {
      type: String,
      required: true,
      maxlength: 500
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],

  // Escalation settings
  escalationLevel: {
    type: Number,
    default: 0,
    min: 0,
    max: 3
  },

  autoEscalate: {
    type: Boolean,
    default: false
  },

  escalationTimer: {
    type: Number, // in minutes
    default: null
  },

  // Notification settings
  notifyRoles: [{
    type: String,
    enum: ['staff', 'admin', 'manager', 'maintenance', 'housekeeping']
  }],

  soundAlert: {
    type: Boolean,
    default: false
  },

  // Analytics
  viewedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],

  responseTime: {
    type: Number, // in minutes
    default: null
  },

  resolutionTime: {
    type: Number, // in minutes
    default: null
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
staffAlertSchema.index({ hotelId: 1, status: 1 });
staffAlertSchema.index({ hotelId: 1, priority: 1 });
staffAlertSchema.index({ hotelId: 1, category: 1 });
staffAlertSchema.index({ hotelId: 1, assignedTo: 1 });
staffAlertSchema.index({ hotelId: 1, createdAt: -1 });
staffAlertSchema.index({ hotelId: 1, type: 1, status: 1 });

// Virtual for alert age in minutes
staffAlertSchema.virtual('ageInMinutes').get(function() {
  return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60));
});

// Virtual for overdue status
staffAlertSchema.virtual('isOverdue').get(function() {
  if (!this.dueDate) return false;
  return Date.now() > this.dueDate.getTime();
});

// Pre-save middleware to calculate response and resolution times
staffAlertSchema.pre('save', function(next) {
  if (this.isModified('acknowledgedAt') && this.acknowledgedAt && !this.responseTime) {
    this.responseTime = Math.floor((this.acknowledgedAt.getTime() - this.createdAt.getTime()) / (1000 * 60));
  }

  if (this.isModified('resolvedAt') && this.resolvedAt && !this.resolutionTime) {
    this.resolutionTime = Math.floor((this.resolvedAt.getTime() - this.createdAt.getTime()) / (1000 * 60));
  }

  next();
});

// Static method to get alerts summary for a hotel
staffAlertSchema.statics.getAlertsSummary = async function(hotelId) {
  const summary = await this.aggregate([
    { $match: { hotelId } },
    {
      $group: {
        _id: null,
        totalAlerts: { $sum: 1 },
        activeAlerts: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
        },
        criticalAlerts: {
          $sum: { $cond: [{ $eq: ['$priority', 'critical'] }, 1, 0] }
        },
        urgentAlerts: {
          $sum: { $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0] }
        },
        avgResponseTime: { $avg: '$responseTime' },
        avgResolutionTime: { $avg: '$resolutionTime' }
      }
    }
  ]);

  return summary[0] || {
    totalAlerts: 0,
    activeAlerts: 0,
    criticalAlerts: 0,
    urgentAlerts: 0,
    avgResponseTime: 0,
    avgResolutionTime: 0
  };
};

// Static method to get priority counts
staffAlertSchema.statics.getPriorityCounts = async function(hotelId) {
  const counts = await this.aggregate([
    { $match: { hotelId, status: { $in: ['active', 'acknowledged', 'in_progress'] } } },
    {
      $group: {
        _id: '$priority',
        count: { $sum: 1 }
      }
    }
  ]);

  const result = {
    low: 0,
    medium: 0,
    high: 0,
    urgent: 0,
    critical: 0
  };

  counts.forEach(item => {
    result[item._id] = item.count;
  });

  return result;
};

const StaffAlert = mongoose.model('StaffAlert', staffAlertSchema);

export default StaffAlert;
