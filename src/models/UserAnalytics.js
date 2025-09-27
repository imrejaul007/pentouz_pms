import mongoose from 'mongoose';
import NotificationAutomationService from '../services/notificationAutomationService.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     UserAnalytics:
 *       type: object
 *       required:
 *         - userId
 *         - date
 *         - hotelId
 *       properties:
 *         _id:
 *           type: string
 *           description: Analytics record ID
 *         userId:
 *           type: string
 *           description: Reference to User
 *         date:
 *           type: string
 *           format: date
 *           description: Date of analytics data
 *         engagementScore:
 *           type: number
 *           description: Overall engagement score (0-100)
 *         activityMetrics:
 *           type: object
 *           properties:
 *             loginCount:
 *               type: number
 *             sessionDuration:
 *               type: number
 *             pageViews:
 *               type: number
 *             actionsPerformed:
 *               type: number
 *             lastActivity:
 *               type: string
 *               format: date-time
 *         performanceMetrics:
 *           type: object
 *           properties:
 *             responseTime:
 *               type: number
 *             errorRate:
 *               type: number
 *             taskCompletionRate:
 *               type: number
 *             efficiencyScore:
 *               type: number
 *         behaviorPatterns:
 *           type: object
 *           properties:
 *             peakActivityHours:
 *               type: array
 *               items:
 *                 type: number
 *             preferredDevices:
 *               type: array
 *               items:
 *                 type: string
 *             commonActions:
 *               type: array
 *               items:
 *                 type: string
 *             navigationPatterns:
 *               type: array
 *               items:
 *                 type: string
 *         lifecycleStage:
 *           type: string
 *           enum: [new, active, engaged, at_risk, churned]
 *         churnRisk:
 *           type: number
 *           description: Churn risk score (0-100)
 *         retentionScore:
 *           type: number
 *           description: Retention likelihood score (0-100)
 *         segmentTags:
 *           type: array
 *           items:
 *             type: string
 *         predictiveInsights:
 *           type: object
 *           properties:
 *             nextLoginPrediction:
 *               type: string
 *               format: date-time
 *             engagementTrend:
 *               type: string
 *               enum: [increasing, stable, decreasing]
 *             recommendedActions:
 *               type: array
 *               items:
 *                 type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const userAnalyticsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
    index: true
  },
  engagementScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
    index: true
  },
  activityMetrics: {
    loginCount: {
      type: Number,
      default: 0
    },
    sessionDuration: {
      type: Number,
      default: 0
    },
    pageViews: {
      type: Number,
      default: 0
    },
    actionsPerformed: {
      type: Number,
      default: 0
    },
    lastActivity: {
      type: Date,
      default: Date.now
    },
    uniqueFeaturesUsed: {
      type: Number,
      default: 0
    },
    timeSpentOnPlatform: {
      type: Number,
      default: 0
    }
  },
  performanceMetrics: {
    responseTime: {
      type: Number,
      default: 0
    },
    errorRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    taskCompletionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    efficiencyScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    productivityScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    accuracyRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  },
  behaviorPatterns: {
    peakActivityHours: [{
      type: Number,
      min: 0,
      max: 23
    }],
    preferredDevices: [{
      type: String,
      enum: ['desktop', 'mobile', 'tablet']
    }],
    commonActions: [{
      type: String
    }],
    navigationPatterns: [{
      type: String
    }],
    featureUsageFrequency: {
      type: Map,
      of: Number
    },
    averageSessionLength: {
      type: Number,
      default: 0
    },
    bounceRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  },
  lifecycleStage: {
    type: String,
    enum: ['new', 'active', 'engaged', 'at_risk', 'churned'],
    default: 'new',
    index: true
  },
  churnRisk: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
    index: true
  },
  retentionScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
    index: true
  },
  segmentTags: [{
    type: String,
    enum: [
      'high_value',
      'frequent_user',
      'power_user',
      'casual_user',
      'new_user',
      'at_risk',
      'churned',
      'vip',
      'enterprise',
      'mobile_first',
      'desktop_preferred',
      'weekend_user',
      'business_hours',
      'night_owl',
      'early_bird'
    ]
  }],
  predictiveInsights: {
    nextLoginPrediction: {
      type: Date
    },
    engagementTrend: {
      type: String,
      enum: ['increasing', 'stable', 'decreasing'],
      default: 'stable'
    },
    recommendedActions: [{
      type: String,
      enum: [
        'send_welcome_email',
        'offer_training',
        'feature_highlight',
        'engagement_campaign',
        'retention_offer',
        'feedback_request',
        'upgrade_promotion',
        'support_outreach'
      ]
    }],
    predictedLifetimeValue: {
      type: Number,
      default: 0
    },
    nextFeatureRecommendation: {
      type: String
    },
    optimalEngagementTime: {
      type: String
    }
  },
  cohortAnalysis: {
    cohortMonth: {
      type: String
    },
    cohortWeek: {
      type: String
    },
    retentionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    revenueContribution: {
      type: Number,
      default: 0
    }
  },
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for performance
userAnalyticsSchema.index({ userId: 1, date: -1 });
userAnalyticsSchema.index({ hotelId: 1, date: -1 });
userAnalyticsSchema.index({ hotelId: 1, lifecycleStage: 1 });
userAnalyticsSchema.index({ hotelId: 1, engagementScore: -1 });
userAnalyticsSchema.index({ hotelId: 1, churnRisk: -1 });
userAnalyticsSchema.index({ hotelId: 1, segmentTags: 1 });

// Virtual for engagement level
userAnalyticsSchema.virtual('engagementLevel').get(function() {
  if (this.engagementScore >= 80) return 'high';
  if (this.engagementScore >= 60) return 'medium';
  if (this.engagementScore >= 40) return 'low';
  return 'very_low';
});

// Virtual for churn risk level
userAnalyticsSchema.virtual('churnRiskLevel').get(function() {
  if (this.churnRisk >= 70) return 'high';
  if (this.churnRisk >= 40) return 'medium';
  return 'low';
});

// Virtual for performance grade
userAnalyticsSchema.virtual('performanceGrade').get(function() {
  const avgScore = (this.performanceMetrics.efficiencyScore + 
                   this.performanceMetrics.productivityScore + 
                   this.performanceMetrics.accuracyRate) / 3;
  
  if (avgScore >= 90) return 'A';
  if (avgScore >= 80) return 'B';
  if (avgScore >= 70) return 'C';
  if (avgScore >= 60) return 'D';
  return 'F';
});

// Static method to get user analytics summary
userAnalyticsSchema.statics.getUserAnalyticsSummary = function(hotelId, dateRange) {
  const matchStage = { hotelId };
  
  if (dateRange && dateRange.start && dateRange.end) {
    matchStage.date = {
      $gte: new Date(dateRange.start),
      $lte: new Date(dateRange.end)
    };
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalUsers: { $addToSet: '$userId' },
        averageEngagementScore: { $avg: '$engagementScore' },
        averageChurnRisk: { $avg: '$churnRisk' },
        averageRetentionScore: { $avg: '$retentionScore' },
        highEngagementUsers: { $sum: { $cond: [{ $gte: ['$engagementScore', 80] }, 1, 0] } },
        atRiskUsers: { $sum: { $cond: [{ $gte: ['$churnRisk', 70] }, 1, 0] } },
        newUsers: { $sum: { $cond: [{ $eq: ['$lifecycleStage', 'new'] }, 1, 0] } },
        activeUsers: { $sum: { $cond: [{ $eq: ['$lifecycleStage', 'active'] }, 1, 0] } },
        engagedUsers: { $sum: { $cond: [{ $eq: ['$lifecycleStage', 'engaged'] }, 1, 0] } },
        churnedUsers: { $sum: { $cond: [{ $eq: ['$lifecycleStage', 'churned'] }, 1, 0] } },
        bySegment: {
          $push: {
            segmentTags: '$segmentTags',
            engagementScore: '$engagementScore'
          }
        }
      }
    }
  ]);
};

// Static method to get engagement trends
userAnalyticsSchema.statics.getEngagementTrends = function(hotelId, dateRange) {
  const matchStage = { hotelId };
  
  if (dateRange && dateRange.start && dateRange.end) {
    matchStage.date = {
      $gte: new Date(dateRange.start),
      $lte: new Date(dateRange.end)
    };
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: { $dayOfMonth: '$date' }
        },
        averageEngagement: { $avg: '$engagementScore' },
        userCount: { $addToSet: '$userId' },
        highEngagementCount: { $sum: { $cond: [{ $gte: ['$engagementScore', 80] }, 1, 0] } },
        atRiskCount: { $sum: { $cond: [{ $gte: ['$churnRisk', 70] }, 1, 0] } }
      }
    },
    {
      $addFields: {
        uniqueUserCount: { $size: '$userCount' }
      }
    },
    { $sort: { '_id': 1 } }
  ]);
};

// Static method to get user segmentation data
userAnalyticsSchema.statics.getUserSegmentation = function(hotelId, criteria = {}) {
  const matchStage = { hotelId };
  
  if (criteria.segmentTags && criteria.segmentTags.length > 0) {
    matchStage.segmentTags = { $in: criteria.segmentTags };
  }
  
  if (criteria.lifecycleStage) {
    matchStage.lifecycleStage = criteria.lifecycleStage;
  }
  
  if (criteria.minEngagementScore) {
    matchStage.engagementScore = { $gte: criteria.minEngagementScore };
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $group: {
        _id: '$segmentTags',
        users: { $addToSet: '$user' },
        averageEngagement: { $avg: '$engagementScore' },
        averageChurnRisk: { $avg: '$churnRisk' },
        averageRetentionScore: { $avg: '$retentionScore' },
        count: { $sum: 1 }
      }
    },
    {
      $addFields: {
        userCount: { $size: '$users' }
      }
    }
  ]);
};

// Static method to get predictive analytics data
userAnalyticsSchema.statics.getPredictiveAnalytics = function(hotelId, options = {}) {
  const matchStage = { hotelId };
  
  if (options.dateRange && options.dateRange.start && options.dateRange.end) {
    matchStage.date = {
      $gte: new Date(options.dateRange.start),
      $lte: new Date(options.dateRange.end)
    };
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $group: {
        _id: null,
        totalUsers: { $addToSet: '$userId' },
        highChurnRiskUsers: {
          $push: {
            $cond: [
              { $gte: ['$churnRisk', 70] },
              {
                userId: '$userId',
                userName: '$user.name',
                userEmail: '$user.email',
                churnRisk: '$churnRisk',
                engagementScore: '$engagementScore',
                lifecycleStage: '$lifecycleStage',
                recommendedActions: '$predictiveInsights.recommendedActions'
              },
              null
            ]
          }
        },
        engagementTrends: {
          $push: {
            userId: '$userId',
            userName: '$user.name',
            engagementTrend: '$predictiveInsights.engagementTrend',
            nextLoginPrediction: '$predictiveInsights.nextLoginPrediction'
          }
        },
        averagePredictedLifetimeValue: { $avg: '$predictiveInsights.predictedLifetimeValue' }
      }
    },
    {
      $addFields: {
        totalUserCount: { $size: '$totalUsers' },
        highChurnRiskCount: {
          $size: {
            $filter: {
              input: '$highChurnRiskUsers',
              cond: { $ne: ['$$this', null] }
            }
          }
        }
      }
    }
  ]);
};

// Instance method to calculate engagement score
userAnalyticsSchema.methods.calculateEngagementScore = function() {
  let score = 0;
  
  // Activity metrics (40% weight)
  const activityScore = (
    (this.activityMetrics.loginCount * 2) +
    (this.activityMetrics.pageViews * 0.5) +
    (this.activityMetrics.actionsPerformed * 1.5) +
    (this.activityMetrics.uniqueFeaturesUsed * 3)
  ) / 10;
  
  // Performance metrics (30% weight)
  const performanceScore = (
    this.performanceMetrics.efficiencyScore +
    this.performanceMetrics.productivityScore +
    this.performanceMetrics.accuracyRate
  ) / 3;
  
  // Behavior patterns (20% weight)
  const behaviorScore = Math.min(
    (this.behaviorPatterns.peakActivityHours.length * 5) +
    (this.behaviorPatterns.preferredDevices.length * 3) +
    (100 - this.behaviorPatterns.bounceRate),
    100
  );
  
  // Retention metrics (10% weight)
  const retentionScore = this.retentionScore;
  
  score = (activityScore * 0.4) + (performanceScore * 0.3) + (behaviorScore * 0.2) + (retentionScore * 0.1);
  
  this.engagementScore = Math.min(Math.max(score, 0), 100);
  return this.engagementScore;
};

// Instance method to calculate churn risk
userAnalyticsSchema.methods.calculateChurnRisk = function() {
  let risk = 0;
  
  // Low engagement increases risk
  if (this.engagementScore < 30) risk += 40;
  else if (this.engagementScore < 50) risk += 25;
  else if (this.engagementScore < 70) risk += 10;
  
  // High error rate increases risk
  if (this.performanceMetrics.errorRate > 20) risk += 20;
  else if (this.performanceMetrics.errorRate > 10) risk += 10;
  
  // Low task completion rate increases risk
  if (this.performanceMetrics.taskCompletionRate < 50) risk += 25;
  else if (this.performanceMetrics.taskCompletionRate < 70) risk += 15;
  
  // High bounce rate increases risk
  if (this.behaviorPatterns.bounceRate > 70) risk += 15;
  else if (this.behaviorPatterns.bounceRate > 50) risk += 10;
  
  // Lifecycle stage affects risk
  if (this.lifecycleStage === 'at_risk') risk += 30;
  else if (this.lifecycleStage === 'churned') risk = 100;
  
  this.churnRisk = Math.min(Math.max(risk, 0), 100);
  return this.churnRisk;
};

// Instance method to update lifecycle stage
userAnalyticsSchema.methods.updateLifecycleStage = function() {
  if (this.churnRisk >= 70) {
    this.lifecycleStage = 'at_risk';
  } else if (this.engagementScore >= 80) {
    this.lifecycleStage = 'engaged';
  } else if (this.engagementScore >= 60) {
    this.lifecycleStage = 'active';
  } else if (this.engagementScore >= 30) {
    this.lifecycleStage = 'new';
  } else {
    this.lifecycleStage = 'at_risk';
  }
  
  return this.lifecycleStage;
};

// Pre-save middleware to calculate scores
userAnalyticsSchema.pre('save', function(next) {
  this.calculateEngagementScore();
  this.calculateChurnRisk();
  this.updateLifecycleStage();
  next();
});

// PHASE 6: STAFF PERFORMANCE MONITORING HOOKS
userAnalyticsSchema.post('save', async function(doc) {
  try {
    // Only monitor staff performance for staff users
    const User = mongoose.model('User');
    const user = await User.findById(doc.userId).select('role firstName lastName hotelId');

    if (user && ['staff', 'housekeeping', 'maintenance'].includes(user.role)) {
      const efficiencyScore = doc.performanceMetrics?.efficiencyScore;
      const taskCompletionRate = doc.performanceMetrics?.taskCompletionRate;
      const errorRate = doc.performanceMetrics?.errorRate;

      // Trigger alerts for poor performance metrics
      let shouldAlert = false;
      let alertReason = [];

      if (efficiencyScore !== undefined && efficiencyScore < 60) {
        shouldAlert = true;
        alertReason.push(`Low efficiency score: ${efficiencyScore}%`);
      }

      if (taskCompletionRate !== undefined && taskCompletionRate < 70) {
        shouldAlert = true;
        alertReason.push(`Low task completion: ${taskCompletionRate}%`);
      }

      if (errorRate !== undefined && errorRate > 15) {
        shouldAlert = true;
        alertReason.push(`High error rate: ${errorRate}%`);
      }

      if (shouldAlert) {
        const priority = (efficiencyScore < 40 || taskCompletionRate < 50) ? 'high' : 'medium';

        await NotificationAutomationService.triggerNotification(
          'staff_performance_alert',
          {
            staffName: `${user.firstName} ${user.lastName}`,
            staffId: user._id,
            role: user.role,
            efficiencyScore: efficiencyScore || 'N/A',
            taskCompletionRate: taskCompletionRate || 'N/A',
            errorRate: errorRate || 'N/A',
            engagementScore: doc.engagementScore || 0,
            alertReasons: alertReason,
            date: doc.date,
            metric: alertReason.join(', '),
            timeFrame: 'recent analysis',
            recommendations: this.generatePerformanceRecommendations(doc),
            actionRequired: priority === 'high'
          },
          'auto',
          priority,
          user.hotelId
        );
      }
    }

  } catch (error) {
    console.error('Error in UserAnalytics notification hook:', error);
  }
});

// Helper method to generate performance recommendations
userAnalyticsSchema.methods.generatePerformanceRecommendations = function(doc) {
  const recommendations = [];

  if (doc.performanceMetrics?.efficiencyScore < 60) {
    recommendations.push('Schedule efficiency training session');
    recommendations.push('Review workflow optimization opportunities');
  }

  if (doc.performanceMetrics?.taskCompletionRate < 70) {
    recommendations.push('Analyze task assignment workload');
    recommendations.push('Consider additional resources or support');
  }

  if (doc.performanceMetrics?.errorRate > 15) {
    recommendations.push('Provide refresher training on quality standards');
    recommendations.push('Implement buddy system for quality assurance');
  }

  if (doc.engagementScore < 50) {
    recommendations.push('Schedule one-on-one meeting to discuss engagement');
    recommendations.push('Review job satisfaction and career development needs');
  }

  return recommendations.length > 0 ? recommendations : ['Monitor progress and provide regular feedback'];
};

export default mongoose.model('UserAnalytics', userAnalyticsSchema);
