import mongoose from 'mongoose';

const notificationTemplateSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 500
  },
  category: {
    type: String,
    required: true,
    enum: [
      'booking',
      'payment',
      'service',
      'maintenance',
      'inventory',
      'system',
      'security',
      'promotional',
      'emergency',
      'staff',
      'guest_experience',
      'loyalty',
      'review'
    ]
  },
  type: {
    type: String,
    required: true,
    enum: [
      'booking_confirmation',
      'booking_reminder',
      'booking_cancellation',
      'payment_success',
      'payment_failed',
      'payment_reminder',
      'service_booking',
      'service_reminder',
      'service_completed',
      'maintenance_request',
      'maintenance_completed',
      'inventory_alert',
      'inventory_low_stock',
      'system_alert',
      'security_alert',
      'staff_assignment',
      'staff_reminder',
      'guest_welcome',
      'guest_checkout',
      'guest_request',
      'promotional_offer',
      'loyalty_reward',
      'review_request',
      'emergency_alert',
      'custom'
    ]
  },
  subject: {
    type: String,
    required: true,
    maxlength: 200
  },
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  message: {
    type: String,
    required: true,
    maxlength: 1000
  },
  // Rich text content for email/detailed views
  htmlContent: {
    type: String,
    maxlength: 5000
  },
  // Template variables that can be replaced
  variables: [{
    name: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['string', 'number', 'date', 'boolean', 'currency'],
      default: 'string'
    },
    required: {
      type: Boolean,
      default: false
    },
    defaultValue: {
      type: String
    }
  }],
  // Delivery settings
  channels: [{
    type: String,
    enum: ['in_app', 'email', 'sms', 'push', 'browser'],
    required: true
  }],
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  // Routing configuration
  routing: {
    targetRoles: [{
      type: String,
      enum: ['admin', 'staff', 'guest', 'travel_agent'],
      required: true
    }],
    departments: [String], // For staff filtering
    conditions: [{
      field: String,
      operator: {
        type: String,
        enum: ['equals', 'not_equals', 'contains', 'greater_than', 'less_than']
      },
      value: String
    }]
  },
  // Scheduling options
  scheduling: {
    immediate: {
      type: Boolean,
      default: true
    },
    delay: {
      type: Number, // Minutes
      default: 0
    },
    respectQuietHours: {
      type: Boolean,
      default: true
    }
  },
  // Localization support
  localization: [{
    language: {
      type: String,
      required: true
    },
    subject: String,
    title: String,
    message: String,
    htmlContent: String
  }],
  // Usage tracking
  usage: {
    timesUsed: {
      type: Number,
      default: 0
    },
    lastUsed: Date,
    avgDeliveryRate: {
      type: Number,
      default: 0
    },
    avgReadRate: {
      type: Number,
      default: 0
    }
  },
  // Template metadata
  metadata: {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    version: {
      type: Number,
      default: 1
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isSystem: {
      type: Boolean,
      default: false
    },
    tags: [String]
  }
}, {
  timestamps: true
});

// Indexes
notificationTemplateSchema.index({ hotelId: 1, category: 1 });
notificationTemplateSchema.index({ hotelId: 1, type: 1 });
notificationTemplateSchema.index({ hotelId: 1, 'metadata.isActive': 1 });
notificationTemplateSchema.index({ hotelId: 1, name: 'text', description: 'text' });

// Instance methods
notificationTemplateSchema.methods.populateTemplate = function(variables = {}) {
  let populatedSubject = this.subject;
  let populatedTitle = this.title;
  let populatedMessage = this.message;
  let populatedHtml = this.htmlContent;

  // Replace template variables
  this.variables.forEach(variable => {
    const placeholder = `{{${variable.name}}}`;
    const value = variables[variable.name] || variable.defaultValue || '';

    // Format value based on type
    let formattedValue = value;
    if (variable.type === 'currency' && typeof value === 'number') {
      formattedValue = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(value);
    } else if (variable.type === 'date' && value) {
      formattedValue = new Date(value).toLocaleDateString();
    }

    populatedSubject = populatedSubject.replace(new RegExp(placeholder, 'g'), formattedValue);
    populatedTitle = populatedTitle.replace(new RegExp(placeholder, 'g'), formattedValue);
    populatedMessage = populatedMessage.replace(new RegExp(placeholder, 'g'), formattedValue);
    if (populatedHtml) {
      populatedHtml = populatedHtml.replace(new RegExp(placeholder, 'g'), formattedValue);
    }
  });

  return {
    subject: populatedSubject,
    title: populatedTitle,
    message: populatedMessage,
    htmlContent: populatedHtml,
    channels: this.channels,
    priority: this.priority,
    routing: this.routing,
    scheduling: this.scheduling
  };
};

notificationTemplateSchema.methods.validateVariables = function(variables = {}) {
  const errors = [];

  this.variables.forEach(variable => {
    if (variable.required && !variables[variable.name]) {
      errors.push(`Missing required variable: ${variable.name}`);
    }

    if (variables[variable.name] && variable.type === 'number') {
      if (isNaN(Number(variables[variable.name]))) {
        errors.push(`Variable ${variable.name} must be a number`);
      }
    }

    if (variables[variable.name] && variable.type === 'date') {
      if (isNaN(Date.parse(variables[variable.name]))) {
        errors.push(`Variable ${variable.name} must be a valid date`);
      }
    }
  });

  return errors;
};

notificationTemplateSchema.methods.incrementUsage = function(deliveryRate = null, readRate = null) {
  this.usage.timesUsed++;
  this.usage.lastUsed = new Date();

  if (deliveryRate !== null) {
    // Calculate running average
    const currentAvg = this.usage.avgDeliveryRate || 0;
    const timesUsed = this.usage.timesUsed;
    this.usage.avgDeliveryRate = ((currentAvg * (timesUsed - 1)) + deliveryRate) / timesUsed;
  }

  if (readRate !== null) {
    const currentAvg = this.usage.avgReadRate || 0;
    const timesUsed = this.usage.timesUsed;
    this.usage.avgReadRate = ((currentAvg * (timesUsed - 1)) + readRate) / timesUsed;
  }

  return this.save();
};

// Static methods
notificationTemplateSchema.statics.getByCategory = function(hotelId, category) {
  return this.find({
    hotelId,
    category,
    'metadata.isActive': true
  }).sort({ 'usage.timesUsed': -1, name: 1 });
};

notificationTemplateSchema.statics.getByType = function(hotelId, type) {
  return this.findOne({
    hotelId,
    type,
    'metadata.isActive': true
  }).sort({ 'usage.timesUsed': -1 });
};

notificationTemplateSchema.statics.search = function(hotelId, query) {
  return this.find({
    hotelId,
    'metadata.isActive': true,
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } },
      { 'metadata.tags': { $in: [new RegExp(query, 'i')] } }
    ]
  }).sort({ 'usage.timesUsed': -1 });
};

notificationTemplateSchema.statics.getMostUsed = function(hotelId, limit = 10) {
  return this.find({
    hotelId,
    'metadata.isActive': true
  })
  .sort({ 'usage.timesUsed': -1 })
  .limit(limit);
};

notificationTemplateSchema.statics.getPerformanceStats = function(hotelId) {
  return this.aggregate([
    { $match: { hotelId, 'metadata.isActive': true } },
    {
      $group: {
        _id: '$category',
        totalTemplates: { $sum: 1 },
        avgUsage: { $avg: '$usage.timesUsed' },
        avgDeliveryRate: { $avg: '$usage.avgDeliveryRate' },
        avgReadRate: { $avg: '$usage.avgReadRate' }
      }
    },
    { $sort: { totalTemplates: -1 } }
  ]);
};

// Create default templates for a hotel
notificationTemplateSchema.statics.createDefaultTemplates = async function(hotelId, createdBy) {
  const defaultTemplates = [
    {
      name: 'Booking Confirmation',
      description: 'Standard booking confirmation message',
      category: 'booking',
      type: 'booking_confirmation',
      subject: 'Booking Confirmed - {{bookingNumber}}',
      title: 'Booking Confirmed',
      message: 'Dear {{guestName}}, your booking {{bookingNumber}} for {{checkInDate}} to {{checkOutDate}} has been confirmed. Thank you for choosing THE PENTOUZ!',
      channels: ['in_app', 'email'],
      routing: { targetRoles: ['guest'] },
      variables: [
        { name: 'guestName', description: 'Guest full name', type: 'string', required: true },
        { name: 'bookingNumber', description: 'Booking reference number', type: 'string', required: true },
        { name: 'checkInDate', description: 'Check-in date', type: 'date', required: true },
        { name: 'checkOutDate', description: 'Check-out date', type: 'date', required: true }
      ],
      metadata: { isSystem: true }
    },
    {
      name: 'Payment Success',
      description: 'Payment confirmation message',
      category: 'payment',
      type: 'payment_success',
      subject: 'Payment Received - {{amount}}',
      title: 'Payment Confirmed',
      message: 'Thank you {{guestName}}! Your payment of {{amount}} has been successfully processed for booking {{bookingNumber}}.',
      channels: ['in_app', 'email'],
      routing: { targetRoles: ['guest'] },
      variables: [
        { name: 'guestName', description: 'Guest full name', type: 'string', required: true },
        { name: 'amount', description: 'Payment amount', type: 'currency', required: true },
        { name: 'bookingNumber', description: 'Booking reference number', type: 'string', required: true }
      ],
      metadata: { isSystem: true }
    },
    {
      name: 'Maintenance Request',
      description: 'Maintenance task assignment',
      category: 'maintenance',
      type: 'maintenance_request',
      subject: 'Maintenance Required - Room {{roomNumber}}',
      title: 'New Maintenance Task',
      message: 'Maintenance required in room {{roomNumber}}: {{description}}. Priority: {{priority}}',
      channels: ['in_app', 'push'],
      priority: 'high',
      routing: { targetRoles: ['staff'], departments: ['Maintenance'] },
      variables: [
        { name: 'roomNumber', description: 'Room number', type: 'string', required: true },
        { name: 'description', description: 'Issue description', type: 'string', required: true },
        { name: 'priority', description: 'Task priority', type: 'string', required: true }
      ],
      metadata: { isSystem: true }
    }
  ];

  const templates = defaultTemplates.map(template => ({
    ...template,
    hotelId,
    metadata: {
      ...template.metadata,
      createdBy
    }
  }));

  return this.insertMany(templates);
};

export default mongoose.model('NotificationTemplate', notificationTemplateSchema);