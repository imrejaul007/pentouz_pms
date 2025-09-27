import mongoose from 'mongoose';

const notificationAnalyticsSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  notificationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Notification',
    required: true
  },
  eventType: {
    type: String,
    enum: ['sent', 'delivered', 'read', 'clicked', 'dismissed', 'failed'],
    required: true
  },
  channel: {
    type: String,
    enum: ['in_app', 'browser', 'email', 'sms', 'push'],
    required: true
  },
  deviceInfo: {
    userAgent: String,
    platform: String,
    isMobile: Boolean,
    browser: String
  },
  metadata: {
    category: String,
    priority: String,
    source: String,
    templateId: String,
    actionTaken: String
  },
  timing: {
    sentAt: Date,
    deliveredAt: Date,
    readAt: Date,
    clickedAt: Date,
    responseTime: Number // milliseconds
  },
  location: {
    country: String,
    region: String,
    timezone: String
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
notificationAnalyticsSchema.index({ hotelId: 1, createdAt: -1 });
notificationAnalyticsSchema.index({ userId: 1, eventType: 1 });
notificationAnalyticsSchema.index({ notificationId: 1 });
notificationAnalyticsSchema.index({ 'metadata.category': 1, createdAt: -1 });
notificationAnalyticsSchema.index({ channel: 1, eventType: 1 });

// Static methods for analytics queries
notificationAnalyticsSchema.statics.getDeliveryStats = async function(hotelId, timeRange = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeRange);

  const pipeline = [
    {
      $match: {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          channel: '$channel',
          eventType: '$eventType',
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: {
          channel: '$_id.channel',
          date: '$_id.date'
        },
        events: {
          $push: {
            type: '$_id.eventType',
            count: '$count'
          }
        }
      }
    },
    { $sort: { '_id.date': -1 } }
  ];

  return await this.aggregate(pipeline);
};

notificationAnalyticsSchema.statics.getUserEngagement = async function(hotelId, timeRange = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeRange);

  const pipeline = [
    {
      $match: {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$userId',
        totalNotifications: { $sum: 1 },
        readNotifications: {
          $sum: { $cond: [{ $eq: ['$eventType', 'read'] }, 1, 0] }
        },
        clickedNotifications: {
          $sum: { $cond: [{ $eq: ['$eventType', 'clicked'] }, 1, 0] }
        },
        avgResponseTime: {
          $avg: '$timing.responseTime'
        }
      }
    },
    {
      $addFields: {
        readRate: {
          $divide: ['$readNotifications', '$totalNotifications']
        },
        clickRate: {
          $divide: ['$clickedNotifications', '$totalNotifications']
        }
      }
    },
    { $sort: { totalNotifications: -1 } }
  ];

  return await this.aggregate(pipeline);
};

notificationAnalyticsSchema.statics.getCategoryPerformance = async function(hotelId, timeRange = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeRange);

  const pipeline = [
    {
      $match: {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        createdAt: { $gte: startDate },
        'metadata.category': { $exists: true }
      }
    },
    {
      $group: {
        _id: '$metadata.category',
        sent: { $sum: { $cond: [{ $eq: ['$eventType', 'sent'] }, 1, 0] } },
        delivered: { $sum: { $cond: [{ $eq: ['$eventType', 'delivered'] }, 1, 0] } },
        read: { $sum: { $cond: [{ $eq: ['$eventType', 'read'] }, 1, 0] } },
        clicked: { $sum: { $cond: [{ $eq: ['$eventType', 'clicked'] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ['$eventType', 'failed'] }, 1, 0] } },
        avgResponseTime: { $avg: '$timing.responseTime' }
      }
    },
    {
      $addFields: {
        deliveryRate: { $divide: ['$delivered', '$sent'] },
        readRate: { $divide: ['$read', '$delivered'] },
        clickRate: { $divide: ['$clicked', '$read'] },
        failureRate: { $divide: ['$failed', '$sent'] }
      }
    },
    { $sort: { sent: -1 } }
  ];

  return await this.aggregate(pipeline);
};

notificationAnalyticsSchema.statics.getChannelPerformance = async function(hotelId, timeRange = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeRange);

  const pipeline = [
    {
      $match: {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$channel',
        sent: { $sum: { $cond: [{ $eq: ['$eventType', 'sent'] }, 1, 0] } },
        delivered: { $sum: { $cond: [{ $eq: ['$eventType', 'delivered'] }, 1, 0] } },
        read: { $sum: { $cond: [{ $eq: ['$eventType', 'read'] }, 1, 0] } },
        clicked: { $sum: { $cond: [{ $eq: ['$eventType', 'clicked'] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ['$eventType', 'failed'] }, 1, 0] } },
        avgResponseTime: { $avg: '$timing.responseTime' }
      }
    },
    {
      $addFields: {
        deliveryRate: { $divide: ['$delivered', '$sent'] },
        readRate: { $divide: ['$read', '$delivered'] },
        clickRate: { $divide: ['$clicked', '$read'] },
        failureRate: { $divide: ['$failed', '$sent'] }
      }
    },
    { $sort: { sent: -1 } }
  ];

  return await this.aggregate(pipeline);
};

notificationAnalyticsSchema.statics.getRealTimeMetrics = async function(hotelId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pipeline = [
    {
      $match: {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        createdAt: { $gte: today }
      }
    },
    {
      $group: {
        _id: null,
        totalSent: { $sum: { $cond: [{ $eq: ['$eventType', 'sent'] }, 1, 0] } },
        totalDelivered: { $sum: { $cond: [{ $eq: ['$eventType', 'delivered'] }, 1, 0] } },
        totalRead: { $sum: { $cond: [{ $eq: ['$eventType', 'read'] }, 1, 0] } },
        totalClicked: { $sum: { $cond: [{ $eq: ['$eventType', 'clicked'] }, 1, 0] } },
        totalFailed: { $sum: { $cond: [{ $eq: ['$eventType', 'failed'] }, 1, 0] } },
        avgResponseTime: { $avg: '$timing.responseTime' }
      }
    }
  ];

  const result = await this.aggregate(pipeline);
  return result[0] || {
    totalSent: 0,
    totalDelivered: 0,
    totalRead: 0,
    totalClicked: 0,
    totalFailed: 0,
    avgResponseTime: 0
  };
};

// Instance methods
notificationAnalyticsSchema.methods.trackEvent = function(eventType, additionalData = {}) {
  this.eventType = eventType;
  this.timing[`${eventType}At`] = new Date();

  if (additionalData.responseTime) {
    this.timing.responseTime = additionalData.responseTime;
  }

  if (additionalData.actionTaken) {
    this.metadata.actionTaken = additionalData.actionTaken;
  }

  return this.save();
};

export default mongoose.model('NotificationAnalytics', notificationAnalyticsSchema);