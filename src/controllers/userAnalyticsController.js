import userEngagementService from '../services/userEngagementService.js';
import UserAnalytics from '../models/UserAnalytics.js';
import User from '../models/User.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import mongoose from 'mongoose';

// Get comprehensive user engagement analytics
export const getUserEngagementAnalytics = catchAsync(async (req, res) => {
  const { dateRange, userId, segmentTags } = req.query;
  
  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }
  if (userId) options.userId = userId;
  if (segmentTags) {
    try {
      options.segmentTags = JSON.parse(segmentTags);
    } catch (error) {
      throw new ApplicationError('Invalid segment tags format', 400);
    }
  }

  const analytics = await userEngagementService.getUserEngagementAnalytics(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: analytics
  });
});

// Get user behavior analysis
export const getUserBehaviorAnalysis = catchAsync(async (req, res) => {
  const { dateRange, userId } = req.query;
  
  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }
  if (userId) options.userId = userId;

  const analysis = await userEngagementService.getUserBehaviorAnalysis(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: analysis
  });
});

// Get performance metrics
export const getPerformanceMetrics = catchAsync(async (req, res) => {
  const { dateRange, userId, role } = req.query;
  
  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }
  if (userId) options.userId = userId;
  if (role) options.role = role;

  const metrics = await userEngagementService.getPerformanceMetrics(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: metrics
  });
});

// Get user lifecycle analysis
export const getUserLifecycleAnalysis = catchAsync(async (req, res) => {
  const { dateRange } = req.query;
  
  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }

  const analysis = await userEngagementService.getUserLifecycleAnalysis(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: analysis
  });
});

// Calculate engagement scores
export const calculateEngagementScores = catchAsync(async (req, res) => {
  const { dateRange, userId } = req.query;
  
  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }
  if (userId) options.userId = userId;

  const result = await userEngagementService.calculateEngagementScores(req.user.hotelId, options);

  res.json({
    status: 'success',
    message: 'Engagement scores calculated successfully',
    data: result
  });
});

// Get engagement trends
export const getEngagementTrends = catchAsync(async (req, res) => {
  const { dateRange } = req.query;
  
  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }

  const trends = await userEngagementService.getEngagementTrends(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: trends
  });
});

// Get top engaged users
export const getTopEngagedUsers = catchAsync(async (req, res) => {
  const { dateRange, limit } = req.query;
  
  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }
  if (limit) options.limit = parseInt(limit);

  const users = await userEngagementService.getTopEngagedUsers(req.user.hotelId, options);

  res.json({
    status: 'success',
    results: users.length,
    data: { users }
  });
});

// Get performance trends
export const getPerformanceTrends = catchAsync(async (req, res) => {
  const { dateRange } = req.query;
  
  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }

  const trends = await userEngagementService.getPerformanceTrends(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: trends
  });
});

// Get user analytics summary
export const getUserAnalyticsSummary = catchAsync(async (req, res) => {
  const { dateRange } = req.query;
  
  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }

  const summary = await UserAnalytics.getUserAnalyticsSummary(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: summary[0] || {
      totalUsers: [],
      averageEngagementScore: 0,
      averageChurnRisk: 0,
      averageRetentionScore: 0,
      highEngagementUsers: 0,
      atRiskUsers: 0,
      newUsers: 0,
      activeUsers: 0,
      engagedUsers: 0,
      churnedUsers: 0
    }
  });
});

// Get user segmentation data
export const getUserSegmentation = catchAsync(async (req, res) => {
  const { dateRange, segmentTags, lifecycleStage, minEngagementScore } = req.query;
  
  const criteria = {};
  if (segmentTags) {
    try {
      criteria.segmentTags = JSON.parse(segmentTags);
    } catch (error) {
      throw new ApplicationError('Invalid segment tags format', 400);
    }
  }
  if (lifecycleStage) criteria.lifecycleStage = lifecycleStage;
  if (minEngagementScore) criteria.minEngagementScore = parseInt(minEngagementScore);

  const segmentation = await UserAnalytics.getUserSegmentation(req.user.hotelId, criteria);

  res.json({
    status: 'success',
    results: segmentation.length,
    data: { segments: segmentation }
  });
});

// Get predictive analytics
export const getPredictiveAnalytics = catchAsync(async (req, res) => {
  const { dateRange } = req.query;
  
  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }

  const analytics = await UserAnalytics.getPredictiveAnalytics(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: analytics[0] || {
      totalUsers: [],
      highChurnRiskUsers: [],
      engagementTrends: [],
      averagePredictedLifetimeValue: 0,
      totalUserCount: 0,
      highChurnRiskCount: 0
    }
  });
});

// Get user analytics by ID
export const getUserAnalyticsById = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const { dateRange, limit = 30 } = req.query;

  const query = {
    userId: new mongoose.Types.ObjectId(userId),
    hotelId: req.user.hotelId
  };

  if (dateRange) {
    try {
      const range = JSON.parse(dateRange);
      query.date = {
        $gte: new Date(range.start),
        $lte: new Date(range.end)
      };
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }

  const analytics = await UserAnalytics.find(query)
    .populate('userId', 'name email role')
    .sort({ date: -1 })
    .limit(parseInt(limit));

  if (analytics.length === 0) {
    throw new ApplicationError('No analytics data found for this user', 404);
  }

  res.json({
    status: 'success',
    results: analytics.length,
    data: { analytics }
  });
});

// Create or update user analytics
export const createOrUpdateUserAnalytics = catchAsync(async (req, res) => {
  const { userId, date, activityMetrics, performanceMetrics, behaviorPatterns } = req.body;

  if (!userId || !date) {
    throw new ApplicationError('User ID and date are required', 400);
  }

  const analyticsData = {
    userId: new mongoose.Types.ObjectId(userId),
    date: new Date(date),
    hotelId: req.user.hotelId,
    activityMetrics: activityMetrics || {},
    performanceMetrics: performanceMetrics || {},
    behaviorPatterns: behaviorPatterns || {}
  };

  const analytics = await UserAnalytics.findOneAndUpdate(
    {
      userId: analyticsData.userId,
      date: analyticsData.date,
      hotelId: analyticsData.hotelId
    },
    analyticsData,
    { upsert: true, new: true, runValidators: true }
  ).populate('userId', 'name email role');

  res.json({
    status: 'success',
    message: 'User analytics created/updated successfully',
    data: { analytics }
  });
});

// Get user engagement insights
export const getUserEngagementInsights = catchAsync(async (req, res) => {
  const { dateRange, userId } = req.query;
  
  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }
  if (userId) options.userId = userId;

  const [engagementAnalytics, behaviorAnalysis, performanceMetrics, lifecycleAnalysis] = await Promise.all([
    userEngagementService.getUserEngagementAnalytics(req.user.hotelId, options),
    userEngagementService.getUserBehaviorAnalysis(req.user.hotelId, options),
    userEngagementService.getPerformanceMetrics(req.user.hotelId, options),
    userEngagementService.getUserLifecycleAnalysis(req.user.hotelId, options)
  ]);

  const insights = {
    engagementAnalytics,
    behaviorAnalysis,
    performanceMetrics,
    lifecycleAnalysis,
    recommendations: generateRecommendations(engagementAnalytics, behaviorAnalysis, performanceMetrics)
  };

  res.json({
    status: 'success',
    data: insights
  });
});

// Export user analytics
export const exportUserAnalytics = catchAsync(async (req, res) => {
  const { format = 'json', dateRange, userId } = req.query;
  
  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }
  if (userId) options.userId = userId;

  const analytics = await userEngagementService.getUserEngagementAnalytics(req.user.hotelId, options);

  if (format === 'csv') {
    const csvData = convertAnalyticsToCSV(analytics);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=user_analytics.csv');
    res.send(csvData);
  } else {
    res.json({
      status: 'success',
      data: analytics
    });
  }
});

// Get user cohort analysis
export const getUserCohortAnalysis = catchAsync(async (req, res) => {
  const { dateRange, cohortType = 'month' } = req.query;
  
  const matchStage = { hotelId: req.user.hotelId };

  if (dateRange) {
    try {
      const range = JSON.parse(dateRange);
      matchStage.date = {
        $gte: new Date(range.start),
        $lte: new Date(range.end)
      };
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }

  let groupStage;
  if (cohortType === 'week') {
    groupStage = {
      _id: {
        year: { $year: '$date' },
        week: { $week: '$date' }
      }
    };
  } else {
    groupStage = {
      _id: {
        year: { $year: '$date' },
        month: { $month: '$date' }
      }
    };
  }

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        ...groupStage,
        users: { $addToSet: '$userId' },
        averageEngagement: { $avg: '$engagementScore' },
        averageRetention: { $avg: '$retentionScore' },
        averageChurnRisk: { $avg: '$churnRisk' },
        totalRevenue: { $sum: '$cohortAnalysis.revenueContribution' }
      }
    },
    {
      $addFields: {
        userCount: { $size: '$users' }
      }
    },
    { $sort: { '_id': 1 } }
  ];

  const cohortData = await UserAnalytics.aggregate(pipeline);

  res.json({
    status: 'success',
    results: cohortData.length,
    data: { cohorts: cohortData }
  });
});

// Helper function to generate recommendations
function generateRecommendations(engagementAnalytics, behaviorAnalysis, performanceMetrics) {
  const recommendations = [];

  // Engagement recommendations
  if (engagementAnalytics.engagementRate < 60) {
    recommendations.push({
      type: 'engagement',
      priority: 'high',
      title: 'Low Engagement Rate',
      description: `Current engagement rate is ${engagementAnalytics.engagementRate.toFixed(1)}%. Consider implementing engagement campaigns.`,
      action: 'Launch user engagement initiatives and feature adoption campaigns'
    });
  }

  // Churn risk recommendations
  if (engagementAnalytics.churnRate > 20) {
    recommendations.push({
      type: 'retention',
      priority: 'high',
      title: 'High Churn Risk',
      description: `${engagementAnalytics.churnRate.toFixed(1)}% of users are at risk of churning.`,
      action: 'Implement retention strategies and user feedback collection'
    });
  }

  // Performance recommendations
  if (performanceMetrics.overallPerformanceScore < 70) {
    recommendations.push({
      type: 'performance',
      priority: 'medium',
      title: 'Performance Improvement Needed',
      description: `Overall performance score is ${performanceMetrics.overallPerformanceScore.toFixed(1)}%.`,
      action: 'Provide training and optimize user workflows'
    });
  }

  // Behavior recommendations
  if (behaviorAnalysis.averageBehaviorScore < 60) {
    recommendations.push({
      type: 'behavior',
      priority: 'medium',
      title: 'User Behavior Optimization',
      description: 'Users are showing suboptimal behavior patterns.',
      action: 'Analyze user journeys and improve user experience'
    });
  }

  return recommendations;
}

// Helper function to convert analytics to CSV
function convertAnalyticsToCSV(analytics) {
  const headers = [
    'Metric',
    'Value',
    'Percentage'
  ];
  
  const rows = [
    ['Total Users', analytics.totalUserCount, '100%'],
    ['High Engagement Users', analytics.highEngagementUsers, `${((analytics.highEngagementUsers / analytics.totalUserCount) * 100).toFixed(1)}%`],
    ['Medium Engagement Users', analytics.mediumEngagementUsers, `${((analytics.mediumEngagementUsers / analytics.totalUserCount) * 100).toFixed(1)}%`],
    ['Low Engagement Users', analytics.lowEngagementUsers, `${((analytics.lowEngagementUsers / analytics.totalUserCount) * 100).toFixed(1)}%`],
    ['At Risk Users', analytics.atRiskUsers, `${((analytics.atRiskUsers / analytics.totalUserCount) * 100).toFixed(1)}%`],
    ['New Users', analytics.newUsers, `${((analytics.newUsers / analytics.totalUserCount) * 100).toFixed(1)}%`],
    ['Active Users', analytics.activeUsers, `${((analytics.activeUsers / analytics.totalUserCount) * 100).toFixed(1)}%`],
    ['Engaged Users', analytics.engagedUsers, `${((analytics.engagedUsers / analytics.totalUserCount) * 100).toFixed(1)}%`],
    ['Churned Users', analytics.churnedUsers, `${((analytics.churnedUsers / analytics.totalUserCount) * 100).toFixed(1)}%`]
  ];
  
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

export default {
  getUserEngagementAnalytics,
  getUserBehaviorAnalysis,
  getPerformanceMetrics,
  getUserLifecycleAnalysis,
  calculateEngagementScores,
  getEngagementTrends,
  getTopEngagedUsers,
  getPerformanceTrends,
  getUserAnalyticsSummary,
  getUserSegmentation,
  getPredictiveAnalytics,
  getUserAnalyticsById,
  createOrUpdateUserAnalytics,
  getUserEngagementInsights,
  exportUserAnalytics,
  getUserCohortAnalysis
};
