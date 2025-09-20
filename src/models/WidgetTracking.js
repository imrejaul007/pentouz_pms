import mongoose from 'mongoose';

/**
 * Widget Tracking Model
 * Tracks impressions, clicks, conversions, and other events for booking widgets
 */
const widgetTrackingSchema = new mongoose.Schema({
  trackingId: {
    type: String,
    required: true,
    unique: true
  },
  widgetId: {
    type: String,
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  event: {
    type: String,
    required: true,
    enum: [
      'impression',
      'click',
      'widget_loaded',
      'widget_shown',
      'widget_closed',
      'form_start',
      'form_submit',
      'conversion',
      'error'
    ]
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Request Information
  url: String,
  referrer: String,
  userAgent: String,
  ip: String,

  // Device Information
  screenResolution: String,
  viewportSize: String,
  deviceType: {
    type: String,
    enum: ['desktop', 'tablet', 'mobile', 'unknown'],
    default: 'unknown'
  },
  browser: String,
  os: String,

  // Geographic Information
  country: String,
  region: String,
  city: String,
  timezone: String,

  // Widget Configuration
  widgetType: {
    type: String,
    enum: ['inline', 'popup', 'sidebar', 'floating', 'iframe'],
    default: 'inline'
  },
  widgetConfig: {
    theme: String,
    language: String,
    currency: String,
    autoShow: Boolean,
    autoShowDelay: Number
  },

  // Event Data
  eventData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Booking Information (for conversions)
  bookingData: {
    checkin: Date,
    checkout: Date,
    adults: Number,
    children: Number,
    roomType: String,
    promoCode: String,
    estimatedValue: Number
  },

  // Attribution & Campaign Data
  source: String,
  medium: String,
  campaign: String,
  utmParams: {
    source: String,
    medium: String,
    campaign: String,
    term: String,
    content: String
  },

  // Performance Metrics
  loadTime: Number,
  timeOnWidget: Number,

  // Conversion Tracking
  isConversion: {
    type: Boolean,
    default: false
  },
  conversionValue: Number,
  conversionStep: String,

  // A/B Testing
  testVariant: String,
  testGroup: String,

  // Custom Properties
  customProperties: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  collection: 'widget_tracking'
});

// Indexes for better query performance
widgetTrackingSchema.index({ widgetId: 1, timestamp: -1 });
widgetTrackingSchema.index({ sessionId: 1, timestamp: 1 });
widgetTrackingSchema.index({ event: 1, timestamp: -1 });
widgetTrackingSchema.index({ isConversion: 1, timestamp: -1 });
widgetTrackingSchema.index({ timestamp: -1 });

// TTL index to automatically delete old tracking data (90 days)
widgetTrackingSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Virtual for session duration calculation
widgetTrackingSchema.virtual('sessionDuration').get(function() {
  // This would need to be calculated by comparing with other events in the same session
  return this.timeOnWidget || 0;
});

// Static methods for analytics
widgetTrackingSchema.statics.getWidgetPerformance = async function(widgetId, dateRange = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - dateRange);

  const pipeline = [
    {
      $match: {
        widgetId: widgetId,
        timestamp: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$event',
        count: { $sum: 1 },
        totalValue: { $sum: '$conversionValue' }
      }
    }
  ];

  const results = await this.aggregate(pipeline);

  const metrics = {
    impressions: 0,
    clicks: 0,
    conversions: 0,
    conversionRate: 0,
    totalRevenue: 0,
    averageValue: 0
  };

  results.forEach(result => {
    switch (result._id) {
      case 'impression':
        metrics.impressions = result.count;
        break;
      case 'click':
        metrics.clicks = result.count;
        break;
      case 'conversion':
        metrics.conversions = result.count;
        metrics.totalRevenue = result.totalValue || 0;
        break;
    }
  });

  if (metrics.clicks > 0) {
    metrics.conversionRate = (metrics.conversions / metrics.clicks) * 100;
  }

  if (metrics.conversions > 0) {
    metrics.averageValue = metrics.totalRevenue / metrics.conversions;
  }

  return metrics;
};

widgetTrackingSchema.statics.getConversionFunnel = async function(widgetId, dateRange = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - dateRange);

  const pipeline = [
    {
      $match: {
        widgetId: widgetId,
        timestamp: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$sessionId',
        events: { $push: '$event' },
        firstEvent: { $min: '$timestamp' },
        lastEvent: { $max: '$timestamp' },
        hasConversion: { $max: '$isConversion' }
      }
    },
    {
      $project: {
        hasImpression: { $in: ['impression', '$events'] },
        hasClick: { $in: ['click', '$events'] },
        hasFormStart: { $in: ['form_start', '$events'] },
        hasFormSubmit: { $in: ['form_submit', '$events'] },
        hasConversion: '$hasConversion',
        sessionDuration: { $subtract: ['$lastEvent', '$firstEvent'] }
      }
    },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        impressions: { $sum: { $cond: ['$hasImpression', 1, 0] } },
        clicks: { $sum: { $cond: ['$hasClick', 1, 0] } },
        formStarts: { $sum: { $cond: ['$hasFormStart', 1, 0] } },
        formSubmits: { $sum: { $cond: ['$hasFormSubmit', 1, 0] } },
        conversions: { $sum: { $cond: ['$hasConversion', 1, 0] } },
        avgSessionDuration: { $avg: '$sessionDuration' }
      }
    }
  ];

  const result = await this.aggregate(pipeline);
  return result[0] || {};
};

widgetTrackingSchema.statics.getTopPerformingWidgets = async function(limit = 10, dateRange = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - dateRange);

  const pipeline = [
    {
      $match: {
        timestamp: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$widgetId',
        impressions: { $sum: { $cond: [{ $eq: ['$event', 'impression'] }, 1, 0] } },
        clicks: { $sum: { $cond: [{ $eq: ['$event', 'click'] }, 1, 0] } },
        conversions: { $sum: { $cond: [{ $eq: ['$event', 'conversion'] }, 1, 0] } },
        totalRevenue: { $sum: '$conversionValue' }
      }
    },
    {
      $project: {
        widgetId: '$_id',
        impressions: 1,
        clicks: 1,
        conversions: 1,
        totalRevenue: 1,
        conversionRate: {
          $cond: [
            { $gt: ['$clicks', 0] },
            { $multiply: [{ $divide: ['$conversions', '$clicks'] }, 100] },
            0
          ]
        }
      }
    },
    { $sort: { conversions: -1, conversionRate: -1 } },
    { $limit: limit }
  ];

  return await this.aggregate(pipeline);
};

const WidgetTracking = mongoose.model('WidgetTracking', widgetTrackingSchema);

export default WidgetTracking;