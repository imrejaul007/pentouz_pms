import mongoose from 'mongoose';

const emailCampaignSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Campaign name is required'],
    trim: true,
    maxlength: [100, 'Campaign name cannot exceed 100 characters']
  },
  subject: {
    type: String,
    required: [true, 'Email subject is required'],
    trim: true,
    maxlength: [200, 'Subject cannot exceed 200 characters']
  },
  content: {
    type: String,
    maxlength: [50000, 'Content cannot exceed 50,000 characters']
  },
  htmlContent: {
    type: String,
    maxlength: [100000, 'HTML content cannot exceed 100,000 characters']
  },
  template: {
    type: String,
    enum: ['welcome', 'booking_confirmation', 'newsletter', 'promotion', 'custom'],
    default: 'custom'
  },
  segmentCriteria: {
    role: {
      type: String,
      enum: ['guest', 'staff', 'admin', 'manager']
    },
    isActive: Boolean,
    lastLoginAfter: Date,
    totalBookingsMin: Number,
    totalBookingsMax: Number,
    loyaltyTier: {
      type: String,
      enum: ['bronze', 'silver', 'gold', 'platinum']
    },
    customCriteria: mongoose.Schema.Types.Mixed
  },
  personalization: {
    usePersonalizedSubject: {
      type: Boolean,
      default: true
    },
    usePersonalizedGreeting: {
      type: Boolean,
      default: true
    },
    includeLoyaltyInfo: {
      type: Boolean,
      default: false
    },
    includeBookingHistory: {
      type: Boolean,
      default: false
    },
    customFields: [{
      field: String,
      value: String
    }]
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'sending', 'sent', 'failed', 'paused'],
    default: 'draft'
  },
  scheduledAt: {
    type: Date,
    validate: {
      validator: function(value) {
        return !value || value > new Date();
      },
      message: 'Scheduled date must be in the future'
    }
  },
  sentAt: Date,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true
  },
  analytics: {
    totalSent: {
      type: Number,
      default: 0
    },
    totalDelivered: {
      type: Number,
      default: 0
    },
    totalOpened: {
      type: Number,
      default: 0
    },
    totalClicked: {
      type: Number,
      default: 0
    },
    totalUnsubscribed: {
      type: Number,
      default: 0
    },
    totalBounced: {
      type: Number,
      default: 0
    },
    totalFailed: {
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
    unsubscribeRate: {
      type: Number,
      default: 0
    },
    bounceRate: {
      type: Number,
      default: 0
    },
    lastError: String,
    deviceBreakdown: {
      desktop: { type: Number, default: 0 },
      mobile: { type: Number, default: 0 },
      tablet: { type: Number, default: 0 }
    },
    geoBreakdown: [{
      country: String,
      opens: Number,
      clicks: Number
    }],
    timeBreakdown: [{
      hour: Number,
      opens: Number,
      clicks: Number
    }]
  },
  tags: [{
    type: String,
    trim: true
  }],
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringConfig: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly']
    },
    interval: {
      type: Number,
      min: 1
    },
    endDate: Date,
    maxOccurrences: Number
  },
  attachments: [{
    filename: String,
    path: String,
    contentType: String,
    size: Number
  }],
  testMode: {
    type: Boolean,
    default: false
  },
  testRecipients: [String],
  approvalRequired: {
    type: Boolean,
    default: false
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1,000 characters']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
emailCampaignSchema.index({ hotelId: 1, status: 1 });
emailCampaignSchema.index({ hotelId: 1, createdBy: 1 });
emailCampaignSchema.index({ scheduledAt: 1, status: 1 });
emailCampaignSchema.index({ sentAt: 1 });
emailCampaignSchema.index({ 'analytics.totalSent': -1 });

// Virtual for calculated metrics
emailCampaignSchema.virtual('engagementScore').get(function() {
  if (this.analytics.totalSent === 0) return 0;

  const openWeight = 0.3;
  const clickWeight = 0.5;
  const unsubscribeWeight = -0.2;

  const openScore = (this.analytics.totalOpened / this.analytics.totalSent) * openWeight;
  const clickScore = (this.analytics.totalClicked / this.analytics.totalSent) * clickWeight;
  const unsubscribeScore = (this.analytics.totalUnsubscribed / this.analytics.totalSent) * unsubscribeWeight;

  return Math.max(0, Math.min(100, (openScore + clickScore + unsubscribeScore) * 100));
});

// Methods
emailCampaignSchema.methods.canBeEdited = function() {
  return ['draft', 'scheduled'].includes(this.status);
};

emailCampaignSchema.methods.canBeSent = function() {
  return ['draft', 'scheduled'].includes(this.status);
};

emailCampaignSchema.methods.markAsSent = function() {
  this.status = 'sent';
  this.sentAt = new Date();
  return this.save();
};

emailCampaignSchema.methods.incrementOpens = function() {
  this.analytics.totalOpened += 1;
  this.analytics.openRate = this.analytics.totalSent > 0
    ? (this.analytics.totalOpened / this.analytics.totalSent) * 100
    : 0;
  return this.save();
};

emailCampaignSchema.methods.incrementClicks = function() {
  this.analytics.totalClicked += 1;
  this.analytics.clickRate = this.analytics.totalSent > 0
    ? (this.analytics.totalClicked / this.analytics.totalSent) * 100
    : 0;
  return this.save();
};

emailCampaignSchema.methods.incrementUnsubscribes = function() {
  this.analytics.totalUnsubscribed += 1;
  this.analytics.unsubscribeRate = this.analytics.totalSent > 0
    ? (this.analytics.totalUnsubscribed / this.analytics.totalSent) * 100
    : 0;
  return this.save();
};

// Static methods
emailCampaignSchema.statics.getActiveRecipientCount = async function(hotelId, segmentCriteria = {}) {
  const User = mongoose.model('User');
  const filter = { hotelId, isActive: true };

  if (segmentCriteria.role) filter.role = segmentCriteria.role;
  if (segmentCriteria.lastLoginAfter) {
    filter.lastLogin = { $gte: new Date(segmentCriteria.lastLoginAfter) };
  }
  if (segmentCriteria.totalBookingsMin) {
    filter.totalBookings = { $gte: segmentCriteria.totalBookingsMin };
  }
  if (segmentCriteria.totalBookingsMax) {
    filter.totalBookings = { ...filter.totalBookings, $lte: segmentCriteria.totalBookingsMax };
  }
  if (segmentCriteria.loyaltyTier) {
    filter['loyaltyProgram.tier'] = segmentCriteria.loyaltyTier;
  }

  return await User.countDocuments(filter);
};

emailCampaignSchema.statics.getCampaignPerformance = async function(hotelId, dateRange = {}) {
  const filter = { hotelId, status: 'sent' };

  if (dateRange.start && dateRange.end) {
    filter.sentAt = {
      $gte: new Date(dateRange.start),
      $lte: new Date(dateRange.end)
    };
  }

  const campaigns = await this.find(filter).select('analytics sentAt name');

  const totalSent = campaigns.reduce((sum, c) => sum + c.analytics.totalSent, 0);
  const totalOpened = campaigns.reduce((sum, c) => sum + c.analytics.totalOpened, 0);
  const totalClicked = campaigns.reduce((sum, c) => sum + c.analytics.totalClicked, 0);
  const totalUnsubscribed = campaigns.reduce((sum, c) => sum + c.analytics.totalUnsubscribed, 0);

  return {
    totalCampaigns: campaigns.length,
    totalSent,
    totalOpened,
    totalClicked,
    totalUnsubscribed,
    averageOpenRate: totalSent > 0 ? (totalOpened / totalSent) * 100 : 0,
    averageClickRate: totalSent > 0 ? (totalClicked / totalSent) * 100 : 0,
    averageUnsubscribeRate: totalSent > 0 ? (totalUnsubscribed / totalSent) * 100 : 0,
    campaigns: campaigns.map(c => ({
      id: c._id,
      name: c.name,
      sentAt: c.sentAt,
      performance: {
        sent: c.analytics.totalSent,
        opened: c.analytics.totalOpened,
        clicked: c.analytics.totalClicked,
        openRate: c.analytics.openRate,
        clickRate: c.analytics.clickRate,
        engagementScore: c.engagementScore
      }
    }))
  };
};

// Pre-save middleware
emailCampaignSchema.pre('save', function(next) {
  // Calculate rates when analytics are updated
  if (this.isModified('analytics')) {
    const { totalSent, totalOpened, totalClicked, totalUnsubscribed, totalBounced } = this.analytics;

    if (totalSent > 0) {
      this.analytics.openRate = (totalOpened / totalSent) * 100;
      this.analytics.clickRate = (totalClicked / totalSent) * 100;
      this.analytics.unsubscribeRate = (totalUnsubscribed / totalSent) * 100;
      this.analytics.bounceRate = (totalBounced / totalSent) * 100;
    }
  }

  next();
});

// Post-save middleware for logging
emailCampaignSchema.post('save', function(doc) {
  if (this.isModified('status')) {
    console.log(`📧 Campaign "${doc.name}" status changed to: ${doc.status}`);
  }
});

export default mongoose.models.EmailCampaign || mongoose.model('EmailCampaign', emailCampaignSchema);