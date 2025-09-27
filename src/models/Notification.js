import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.ObjectId, 
    ref: 'User', 
    required: [true, 'User ID is required'], 
    index: true 
  },
  hotelId: { 
    type: mongoose.Schema.ObjectId, 
    ref: 'Hotel', 
    required: [true, 'Hotel ID is required'], 
    index: true 
  },
  type: {
    type: String,
    enum: [
      // Original types
      'booking_confirmation', 'booking_reminder', 'booking_cancellation', 'payment_success', 'payment_failed', 'loyalty_points', 'service_booking', 'service_reminder', 'promotional', 'system_alert', 'welcome', 'check_in', 'check_out', 'review_request', 'special_offer',
      // Admin dashboard types
      'booking_created', 'payment_update', 'booking_cancelled', 'user_registration', 'service_request', 'review_created', 'user_activity', 'data_refresh',
      // Inventory notification types
      'inventory_damage', 'inventory_missing', 'inventory_replacement_needed', 'inventory_guest_charged', 'inventory_low_stock', 'checkout_inspection_failed', 'inventory_theft',

      // HOTEL MANAGEMENT AUTOMATION NOTIFICATIONS
      // Daily Operations
      'daily_check_assigned', 'daily_check_started', 'daily_check_overdue', 'daily_check_completed', 'daily_check_issues', 'daily_check_quality_low',

      // Maintenance Workflow
      'maintenance_request_created', 'maintenance_urgent', 'maintenance_assigned', 'maintenance_started', 'maintenance_completed', 'maintenance_overdue', 'maintenance_high_cost',

      // Housekeeping & Room Status
      'room_needs_cleaning', 'housekeeping_assigned', 'cleaning_started', 'cleaning_completed', 'deep_cleaning_due', 'cleaning_quality_issue',
      'room_out_of_order', 'room_back_in_service', 'room_occupied', 'room_checkout_dirty', 'room_ready',

      // Guest Service Workflow
      'guest_service_created', 'guest_service_urgent', 'guest_service_assigned', 'guest_service_started', 'guest_service_completed', 'guest_service_overdue', 'guest_service_vip',

      // Inventory Management
      'inventory_out_of_stock', 'inventory_damaged', 'inventory_high_value_used', 'inventory_theft_suspected',

      // Operational Intelligence
      'daily_operations_summary', 'staff_performance_alert', 'revenue_impact_alert', 'guest_satisfaction_low', 'equipment_failure_pattern',

      // Staff Management
      'task_assignment', 'task_overdue', 'shift_reminder', 'performance_review_due',

      // Emergency & Security
      'emergency_alert', 'security_incident', 'evacuation_notice', 'safety_inspection_required'
    ],
    required: [true, 'Notification type is required']
  },
  title: { 
    type: String, 
    required: [true, 'Notification title is required'], 
    maxlength: [100, 'Title cannot exceed 100 characters'] 
  },
  message: { 
    type: String, 
    required: [true, 'Notification message is required'], 
    maxlength: [500, 'Message cannot exceed 500 characters'] 
  },
  channels: [{
    type: String,
    enum: ['in_app', 'email', 'sms', 'push', 'websocket'],
    required: [true, 'At least one delivery channel is required']
  }],
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'urgent'], 
    default: 'medium' 
  },
  status: { 
    type: String, 
    enum: ['pending', 'sent', 'delivered', 'failed', 'read'], 
    default: 'pending', 
    index: true 
  },
  readAt: { 
    type: Date 
  },
  scheduledFor: { 
    type: Date, 
    validate: {
      validator: function(value) {
        return !value || value > new Date();
      },
      message: 'Scheduled time must be in the future'
    }
  },
  sentAt: { 
    type: Date 
  },
  deliveredAt: { 
    type: Date 
  },
  metadata: {
    bookingId: { type: mongoose.Schema.ObjectId, ref: 'Booking' },
    serviceBookingId: { type: mongoose.Schema.ObjectId, ref: 'ServiceBooking' },
    paymentId: { type: mongoose.Schema.ObjectId, ref: 'Payment' },
    loyaltyTransactionId: { type: mongoose.Schema.ObjectId, ref: 'Loyalty' },
    actionUrl: { type: String, validate: { validator: function(value) { return !value || /^https?:\/\/.+/.test(value); }, message: 'Action URL must be a valid URL' } },
    actionText: { type: String, maxlength: [50, 'Action text cannot exceed 50 characters'] },
    imageUrl: { type: String, validate: { validator: function(value) { return !value || /^https?:\/\/.+/.test(value); }, message: 'Image URL must be a valid URL' } },
    category: { type: String, enum: ['booking', 'payment', 'loyalty', 'service', 'promotional', 'system'] },
    tags: [{ type: String, trim: true }]
  },
  deliveryAttempts: [{
    channel: { type: String, enum: ['in_app', 'email', 'sms', 'push', 'websocket'], required: true },
    attemptedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['success', 'failed'], required: true },
    errorMessage: { type: String },
    responseData: mongoose.Schema.Types.Mixed
  }],
  expiresAt: { 
    type: Date,
    validate: {
      validator: function(value) {
        return !value || value > new Date();
      },
      message: 'Expiration date must be in the future'
    }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, status: 1 });
notificationSchema.index({ userId: 1, type: 1 });
notificationSchema.index({ hotelId: 1, type: 1 });
notificationSchema.index({ scheduledFor: 1, status: 'pending' });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for checking if notification is expired
notificationSchema.virtual('isExpired').get(function() {
  return this.expiresAt && this.expiresAt < new Date();
});

// Virtual for checking if notification is scheduled
notificationSchema.virtual('isScheduled').get(function() {
  return this.scheduledFor && this.scheduledFor > new Date();
});

// Virtual for checking if notification can be sent
notificationSchema.virtual('canBeSent').get(function() {
  return this.status === 'pending' && !this.isExpired && !this.isScheduled;
});

// Static method to get unread count for a user
notificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({
    userId,
    status: { $in: ['pending', 'sent', 'delivered'] },
    readAt: { $exists: false }
  });
};

// Static method to get notifications by type
notificationSchema.statics.getByType = function(userId, type, limit = 20) {
  return this.find({ userId, type })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('metadata.bookingId', 'bookingNumber checkIn checkOut')
    .populate('metadata.serviceBookingId', 'bookingDate numberOfPeople')
    .populate('metadata.paymentId', 'amount currency');
};

// Static method to mark notifications as read
notificationSchema.statics.markAsRead = function(userId, notificationIds) {
  return this.updateMany(
    { 
      _id: { $in: notificationIds }, 
      userId,
      readAt: { $exists: false }
    },
    { 
      $set: { 
        status: 'read',
        readAt: new Date() 
      } 
    }
  );
};

// Static method to mark all notifications as read
notificationSchema.statics.markAllAsRead = function(userId) {
  return this.updateMany(
    {
      userId,
      status: { $in: ['pending', 'sent', 'delivered'] },
      readAt: { $exists: false }
    },
    {
      $set: {
        status: 'read',
        readAt: new Date()
      }
    }
  );
};

// Instance method to mark as read
notificationSchema.methods.markAsRead = function() {
  if (!this.readAt) {
    this.status = 'read';
    this.readAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

// Instance method to mark as sent
notificationSchema.methods.markAsSent = function(channel, responseData = null) {
  this.status = 'sent';
  this.sentAt = new Date();
  this.deliveryAttempts.push({
    channel,
    status: 'success',
    responseData
  });
  return this.save();
};

// Instance method to mark as failed
notificationSchema.methods.markAsFailed = function(channel, errorMessage) {
  this.deliveryAttempts.push({
    channel,
    status: 'failed',
    errorMessage
  });
  
  // If all channels failed, mark as failed
  const allChannels = this.channels.length;
  const failedChannels = this.deliveryAttempts.filter(attempt => attempt.status === 'failed').length;
  
  if (failedChannels === allChannels) {
    this.status = 'failed';
  }
  
  return this.save();
};

// Pre-save middleware to validate channels
notificationSchema.pre('save', function(next) {
  if (this.channels && this.channels.length === 0) {
    return next(new Error('At least one delivery channel is required'));
  }
  next();
});

export default mongoose.model('Notification', notificationSchema);
