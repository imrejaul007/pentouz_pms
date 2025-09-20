import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     Communication:
 *       type: object
 *       required:
 *         - hotelId
 *         - type
 *         - recipients
 *         - subject
 *         - content
 *       properties:
 *         _id:
 *           type: string
 *         hotelId:
 *           type: string
 *           description: Hotel ID
 *         campaignId:
 *           type: string
 *           description: Campaign ID if part of marketing campaign
 *         type:
 *           type: string
 *           enum: [email, sms, push, in_app, whatsapp, welcome, reminder, follow_up, marketing, announcement]
 *           description: Communication type
 *         category:
 *           type: string
 *           enum: [transactional, marketing, operational, emergency, promotional]
 *           default: transactional
 *         priority:
 *           type: string
 *           enum: [low, normal, high, urgent]
 *           default: normal
 *         status:
 *           type: string
 *           enum: [draft, scheduled, sending, sent, failed, cancelled]
 *           default: draft
 *         recipients:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               name:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [pending, sent, delivered, read, failed, bounced, unsubscribed]
 *               sentAt:
 *                 type: string
 *                 format: date-time
 *               deliveredAt:
 *                 type: string
 *                 format: date-time
 *               readAt:
 *                 type: string
 *                 format: date-time
 *               errorMessage:
 *                 type: string
 *         subject:
 *           type: string
 *           description: Message subject/title
 *         content:
 *           type: string
 *           description: Message content
 *         htmlContent:
 *           type: string
 *           description: HTML version of content
 *         attachments:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               url:
 *                 type: string
 *               type:
 *                 type: string
 *               size:
 *                 type: number
 *         scheduledAt:
 *           type: string
 *           format: date-time
 *         sentAt:
 *           type: string
 *           format: date-time
 *         sentBy:
 *           type: string
 *           description: User who sent the communication
 *         template:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *             name:
 *               type: string
 *             variables:
 *               type: object
 *         personalization:
 *           type: object
 *           description: Personalization data for each recipient
 *         tracking:
 *           type: object
 *           properties:
 *             opens:
 *               type: number
 *               default: 0
 *             clicks:
 *               type: number
 *               default: 0
 *             replies:
 *               type: number
 *               default: 0
 *             unsubscribes:
 *               type: number
 *               default: 0
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const communicationSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required']
  },
  campaignId: {
    type: mongoose.Schema.ObjectId,
    ref: 'MarketingCampaign'
  },
  messageId: {
    type: String,
    unique: true
  },
  type: {
    type: String,
    enum: {
      values: ['email', 'sms', 'push', 'in_app', 'whatsapp', 'welcome', 'reminder', 'follow_up', 'marketing', 'announcement'],
      message: 'Invalid communication type'
    },
    required: [true, 'Communication type is required']
  },
  category: {
    type: String,
    enum: {
      values: ['transactional', 'marketing', 'operational', 'emergency', 'promotional'],
      message: 'Invalid category'
    },
    default: 'transactional'
  },
  priority: {
    type: String,
    enum: {
      values: ['low', 'normal', 'high', 'urgent'],
      message: 'Invalid priority'
    },
    default: 'normal'
  },
  status: {
    type: String,
    enum: {
      values: ['draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'],
      message: 'Invalid status'
    },
    default: 'draft'
  },
  recipients: [{
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    email: {
      type: String,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    phone: {
      type: String,
      match: [/^\+?[\d\s-()]+$/, 'Please enter a valid phone number']
    },
    name: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'read', 'failed', 'bounced', 'unsubscribed'],
      default: 'pending'
    },
    sentAt: Date,
    deliveredAt: Date,
    readAt: Date,
    clickedAt: Date,
    errorMessage: String,
    trackingId: String,
    personalData: {
      type: Map,
      of: mongoose.Schema.Types.Mixed
    }
  }],
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
    maxlength: [200, 'Subject cannot be more than 200 characters']
  },
  content: {
    type: String,
    required: [true, 'Content is required'],
    maxlength: [10000, 'Content cannot be more than 10000 characters']
  },
  htmlContent: {
    type: String,
    maxlength: [50000, 'HTML content cannot be more than 50000 characters']
  },
  plainTextContent: {
    type: String,
    maxlength: [10000, 'Plain text content cannot be more than 10000 characters']
  },
  attachments: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    url: {
      type: String,
      required: true,
      match: [/^https?:\/\//, 'Attachment URL must be valid']
    },
    type: {
      type: String,
      enum: ['image', 'pdf', 'document', 'video', 'other'],
      default: 'other'
    },
    size: {
      type: Number,
      min: 0
    },
    mimeType: String
  }],
  scheduledAt: {
    type: Date,
    index: true
  },
  sentAt: Date,
  sentBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Sender is required']
  },
  template: {
    id: {
      type: mongoose.Schema.ObjectId,
      ref: 'MessageTemplate'
    },
    name: String,
    variables: {
      type: Map,
      of: mongoose.Schema.Types.Mixed
    }
  },
  segmentation: {
    criteria: {
      type: Map,
      of: mongoose.Schema.Types.Mixed
    },
    tags: [String],
    guestTypes: [String],
    loyaltyTiers: [String]
  },
  automation: {
    trigger: {
      type: String,
      enum: ['booking_confirmation', 'check_in', 'check_out', 'birthday', 'anniversary', 'review_request', 'loyalty_milestone', 'custom']
    },
    delay: {
      type: Number,
      min: 0
    },
    conditions: {
      type: Map,
      of: mongoose.Schema.Types.Mixed
    }
  },
  tracking: {
    opens: {
      type: Number,
      default: 0
    },
    clicks: {
      type: Number,
      default: 0
    },
    replies: {
      type: Number,
      default: 0
    },
    unsubscribes: {
      type: Number,
      default: 0
    },
    bounces: {
      type: Number,
      default: 0
    },
    openRate: {
      type: Number,
      default: 0
    },
    clickRate: {
      type: Number,
      default: 0
    },
    lastOpened: Date,
    lastClicked: Date
  },
  provider: {
    name: {
      type: String,
      enum: ['sendgrid', 'mailgun', 'ses', 'twilio', 'firebase', 'custom'],
      default: 'sendgrid'
    },
    messageId: String,
    response: mongoose.Schema.Types.Mixed
  },
  abTest: {
    isEnabled: {
      type: Boolean,
      default: false
    },
    variant: {
      type: String,
      enum: ['A', 'B']
    },
    testId: String
  },
  compliance: {
    optInDate: Date,
    optOutDate: Date,
    unsubscribeUrl: String,
    gdprCompliant: {
      type: Boolean,
      default: false
    },
    canSpamCompliant: {
      type: Boolean,
      default: false
    }
  },
  metrics: {
    deliveryTime: Number, // in milliseconds
    processingTime: Number, // in milliseconds
    cost: {
      type: Number,
      min: 0,
      default: 0
    }
  },
  retries: {
    count: {
      type: Number,
      default: 0
    },
    maxRetries: {
      type: Number,
      default: 3
    },
    lastRetry: Date,
    nextRetry: Date
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot be more than 500 characters']
  },
  tags: [String]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
communicationSchema.index({ hotelId: 1, status: 1 });
communicationSchema.index({ type: 1, category: 1 });
communicationSchema.index({ sentBy: 1, createdAt: -1 });
communicationSchema.index({ scheduledAt: 1, status: 1 });
communicationSchema.index({ 'recipients.userId': 1 });
communicationSchema.index({ 'recipients.email': 1 });
communicationSchema.index({ campaignId: 1 });

// Generate message ID before saving
communicationSchema.pre('save', function(next) {
  if (!this.messageId) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    this.messageId = `MSG${date}${random}`;
  }
  next();
});

// Virtual for total recipients
communicationSchema.virtual('totalRecipients').get(function() {
  return this.recipients.length;
});

// Virtual for sent count
communicationSchema.virtual('sentCount').get(function() {
  return this.recipients.filter(r => r.status === 'sent').length;
});

// Virtual for delivered count
communicationSchema.virtual('deliveredCount').get(function() {
  return this.recipients.filter(r => r.status === 'delivered').length;
});

// Virtual for failed count
communicationSchema.virtual('failedCount').get(function() {
  return this.recipients.filter(r => r.status === 'failed').length;
});

// Virtual for delivery rate
communicationSchema.virtual('deliveryRate').get(function() {
  if (this.totalRecipients === 0) return 0;
  return Math.round((this.deliveredCount / this.totalRecipients) * 100);
});

// Instance method to add recipient
communicationSchema.methods.addRecipient = function(recipientData) {
  this.recipients.push({
    ...recipientData,
    status: 'pending',
    trackingId: this.generateTrackingId()
  });
  return this.save();
};

// Instance method to generate tracking ID
communicationSchema.methods.generateTrackingId = function() {
  return `${this.messageId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Instance method to mark as sent
communicationSchema.methods.markAsSent = function(recipientIndex, providerResponse) {
  if (recipientIndex < 0 || recipientIndex >= this.recipients.length) {
    throw new Error('Invalid recipient index');
  }
  
  this.recipients[recipientIndex].status = 'sent';
  this.recipients[recipientIndex].sentAt = new Date();
  
  if (providerResponse) {
    this.provider.response = providerResponse;
    if (providerResponse.messageId) {
      this.provider.messageId = providerResponse.messageId;
    }
  }
  
  // Update overall status
  const allSent = this.recipients.every(r => ['sent', 'delivered', 'failed'].includes(r.status));
  if (allSent) {
    this.status = 'sent';
    this.sentAt = new Date();
  }
  
  return this.save();
};

// Instance method to mark as delivered
communicationSchema.methods.markAsDelivered = function(recipientIndex) {
  if (recipientIndex < 0 || recipientIndex >= this.recipients.length) {
    throw new Error('Invalid recipient index');
  }
  
  this.recipients[recipientIndex].status = 'delivered';
  this.recipients[recipientIndex].deliveredAt = new Date();
  
  return this.save();
};

// Instance method to mark as read/opened
communicationSchema.methods.markAsRead = function(recipientIndex) {
  if (recipientIndex < 0 || recipientIndex >= this.recipients.length) {
    throw new Error('Invalid recipient index');
  }
  
  this.recipients[recipientIndex].status = 'read';
  this.recipients[recipientIndex].readAt = new Date();
  
  // Update tracking
  this.tracking.opens += 1;
  this.tracking.lastOpened = new Date();
  this.tracking.openRate = (this.tracking.opens / this.totalRecipients) * 100;
  
  return this.save();
};

// Instance method to track click
communicationSchema.methods.trackClick = function(recipientIndex) {
  if (recipientIndex >= 0 && recipientIndex < this.recipients.length) {
    this.recipients[recipientIndex].clickedAt = new Date();
  }
  
  this.tracking.clicks += 1;
  this.tracking.lastClicked = new Date();
  this.tracking.clickRate = (this.tracking.clicks / this.totalRecipients) * 100;
  
  return this.save();
};

// Instance method to personalize content
communicationSchema.methods.personalizeContent = function(recipientIndex) {
  if (recipientIndex < 0 || recipientIndex >= this.recipients.length) {
    throw new Error('Invalid recipient index');
  }
  
  const recipient = this.recipients[recipientIndex];
  let personalizedContent = this.content;
  let personalizedSubject = this.subject;
  
  // Replace common variables
  const replacements = {
    '{{name}}': recipient.name || 'Guest',
    '{{firstName}}': recipient.name ? recipient.name.split(' ')[0] : 'Guest',
    '{{email}}': recipient.email || '',
    '{{hotelName}}': this.hotelId.name || 'Hotel',
    '{{messageId}}': this.messageId,
    '{{trackingId}}': recipient.trackingId || ''
  };
  
  // Add custom personal data
  if (recipient.personalData) {
    Object.keys(recipient.personalData).forEach(key => {
      replacements[`{{${key}}}`] = recipient.personalData.get(key);
    });
  }
  
  // Add template variables
  if (this.template && this.template.variables) {
    Object.keys(this.template.variables).forEach(key => {
      replacements[`{{${key}}}`] = this.template.variables.get(key);
    });
  }
  
  // Apply replacements
  Object.keys(replacements).forEach(placeholder => {
    const value = replacements[placeholder] || '';
    personalizedContent = personalizedContent.replace(new RegExp(placeholder, 'g'), value);
    personalizedSubject = personalizedSubject.replace(new RegExp(placeholder, 'g'), value);
  });
  
  return {
    subject: personalizedSubject,
    content: personalizedContent
  };
};

// Instance method to schedule message
communicationSchema.methods.schedule = function(scheduledAt) {
  this.scheduledAt = new Date(scheduledAt);
  this.status = 'scheduled';
  return this.save();
};

// Instance method to cancel scheduled message
communicationSchema.methods.cancel = function() {
  if (this.status !== 'scheduled') {
    throw new Error('Only scheduled messages can be cancelled');
  }
  
  this.status = 'cancelled';
  return this.save();
};

// Static method to get communication statistics
communicationSchema.statics.getCommunicationStats = async function(hotelId, startDate, endDate) {
  const matchQuery = { hotelId };
  
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
        totalRecipients: { $sum: '$totalRecipients' },
        avgOpenRate: { $avg: '$tracking.openRate' },
        avgClickRate: { $avg: '$tracking.clickRate' }
      }
    },
    {
      $group: {
        _id: '$_id.type',
        stats: {
          $push: {
            status: '$_id.status',
            count: '$count',
            totalRecipients: '$totalRecipients',
            avgOpenRate: '$avgOpenRate',
            avgClickRate: '$avgClickRate'
          }
        },
        totalMessages: { $sum: '$count' }
      }
    }
  ];

  return await this.aggregate(pipeline);
};

// Static method to get scheduled messages
communicationSchema.statics.getScheduledMessages = async function(hotelId, fromDate) {
  const query = {
    hotelId,
    status: 'scheduled',
    scheduledAt: { $lte: fromDate || new Date() }
  };

  return await this.find(query)
    .populate('sentBy', 'name')
    .sort('scheduledAt');
};

// Static method to get messages by campaign
communicationSchema.statics.getByCampaign = async function(campaignId) {
  return await this.find({ campaignId })
    .populate('sentBy', 'name')
    .sort('-createdAt');
};

export default mongoose.model('Communication', communicationSchema);
