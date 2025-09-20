import UserAnalytics from '../models/UserAnalytics.js';
import User from '../models/User.js';
import LoginSession from '../models/LoginSession.js';
import AuditLog from '../models/AuditLog.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import mongoose from 'mongoose';

class UserEngagementService {
  /**
   * Get comprehensive user engagement analytics
   */
  async getUserEngagementAnalytics(hotelId, options = {}) {
    try {
      const { dateRange, userId, segmentTags } = options;
      
      const matchStage = { hotelId };

      if (dateRange && dateRange.start && dateRange.end) {
        matchStage.date = {
          $gte: new Date(dateRange.start),
          $lte: new Date(dateRange.end)
        };
      }

      if (userId) {
        matchStage.userId = new mongoose.Types.ObjectId(userId);
      }

      if (segmentTags && segmentTags.length > 0) {
        matchStage.segmentTags = { $in: segmentTags };
      }

      const pipeline = [
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
            averageEngagementScore: { $avg: '$engagementScore' },
            averageChurnRisk: { $avg: '$churnRisk' },
            averageRetentionScore: { $avg: '$retentionScore' },
            highEngagementUsers: { $sum: { $cond: [{ $gte: ['$engagementScore', 80] }, 1, 0] } },
            mediumEngagementUsers: { $sum: { $cond: [{ $and: [{ $gte: ['$engagementScore', 60] }, { $lt: ['$engagementScore', 80] }] }, 1, 0] } },
            lowEngagementUsers: { $sum: { $cond: [{ $lt: ['$engagementScore', 60] }, 1, 0] } },
            atRiskUsers: { $sum: { $cond: [{ $gte: ['$churnRisk', 70] }, 1, 0] } },
            newUsers: { $sum: { $cond: [{ $eq: ['$lifecycleStage', 'new'] }, 1, 0] } },
            activeUsers: { $sum: { $cond: [{ $eq: ['$lifecycleStage', 'active'] }, 1, 0] } },
            engagedUsers: { $sum: { $cond: [{ $eq: ['$lifecycleStage', 'engaged'] }, 1, 0] } },
            churnedUsers: { $sum: { $cond: [{ $eq: ['$lifecycleStage', 'churned'] }, 1, 0] } },
            bySegment: {
              $push: {
                segmentTags: '$segmentTags',
                engagementScore: '$engagementScore',
                churnRisk: '$churnRisk',
                user: '$user'
              }
            },
            byLifecycle: {
              $push: {
                lifecycleStage: '$lifecycleStage',
                engagementScore: '$engagementScore',
                user: '$user'
              }
            }
          }
        }
      ];

      const [analytics, engagementTrends, topPerformers] = await Promise.all([
        UserAnalytics.aggregate(pipeline),
        this.getEngagementTrends(hotelId, options),
        this.getTopEngagedUsers(hotelId, options)
      ]);

      const result = analytics[0] || {
        totalUsers: [],
        averageEngagementScore: 0,
        averageChurnRisk: 0,
        averageRetentionScore: 0,
        highEngagementUsers: 0,
        mediumEngagementUsers: 0,
        lowEngagementUsers: 0,
        atRiskUsers: 0,
        newUsers: 0,
        activeUsers: 0,
        engagedUsers: 0,
        churnedUsers: 0
      };

      // Calculate segment distribution
      const segmentDistribution = this.calculateSegmentDistribution(result.bySegment || []);
      const lifecycleDistribution = this.calculateLifecycleDistribution(result.byLifecycle || []);

      return {
        ...result,
        totalUserCount: result.totalUsers.length,
        engagementTrends,
        topPerformers,
        segmentDistribution,
        lifecycleDistribution,
        engagementRate: result.totalUsers.length > 0 ? 
          ((result.highEngagementUsers + result.mediumEngagementUsers) / result.totalUsers.length) * 100 : 0,
        churnRate: result.totalUsers.length > 0 ? 
          (result.atRiskUsers / result.totalUsers.length) * 100 : 0
      };
    } catch (error) {
      throw new ApplicationError('Failed to fetch user engagement analytics', 500);
    }
  }

  /**
   * Get user behavior analysis
   */
  async getUserBehaviorAnalysis(hotelId, options = {}) {
    try {
      const { dateRange, userId } = options;
      
      const matchStage = { hotelId };

      if (dateRange && dateRange.start && dateRange.end) {
        matchStage.date = {
          $gte: new Date(dateRange.start),
          $lte: new Date(dateRange.end)
        };
      }

      if (userId) {
        matchStage.userId = new mongoose.Types.ObjectId(userId);
      }

      const pipeline = [
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
            _id: '$userId',
            user: { $first: '$user' },
            averageEngagementScore: { $avg: '$engagementScore' },
            averageChurnRisk: { $avg: '$churnRisk' },
            totalLogins: { $sum: '$activityMetrics.loginCount' },
            totalPageViews: { $sum: '$activityMetrics.pageViews' },
            totalActions: { $sum: '$activityMetrics.actionsPerformed' },
            averageSessionDuration: { $avg: '$activityMetrics.sessionDuration' },
            peakActivityHours: { $addToSet: '$behaviorPatterns.peakActivityHours' },
            preferredDevices: { $addToSet: '$behaviorPatterns.preferredDevices' },
            commonActions: { $addToSet: '$behaviorPatterns.commonActions' },
            averageBounceRate: { $avg: '$behaviorPatterns.bounceRate' },
            featureUsage: { $addToSet: '$behaviorPatterns.featureUsageFrequency' },
            lifecycleStages: { $addToSet: '$lifecycleStage' },
            segmentTags: { $addToSet: '$segmentTags' }
          }
        },
        {
          $addFields: {
            behaviorScore: {
              $add: [
                { $multiply: [{ $divide: ['$averageEngagementScore', 100] }, 40] },
                { $multiply: [{ $subtract: [1, { $divide: ['$averageChurnRisk', 100] }] }, 30] },
                { $multiply: [{ $subtract: [1, { $divide: ['$averageBounceRate', 100] }] }, 20] },
                { $multiply: [{ $divide: ['$totalActions', 100] }, 10] }
              ]
            },
            activityLevel: {
              $cond: [
                { $gte: ['$totalLogins', 20] },
                'high',
                {
                  $cond: [
                    { $gte: ['$totalLogins', 10] },
                    'medium',
                    'low'
                  ]
                }
              ]
            }
          }
        },
        { $sort: { behaviorScore: -1 } }
      ];

      const behaviorData = await UserAnalytics.aggregate(pipeline);

      return {
        users: behaviorData,
        totalUsers: behaviorData.length,
        averageBehaviorScore: behaviorData.length > 0 ? 
          behaviorData.reduce((sum, user) => sum + user.behaviorScore, 0) / behaviorData.length : 0,
        activityDistribution: this.calculateActivityDistribution(behaviorData)
      };
    } catch (error) {
      throw new ApplicationError('Failed to fetch user behavior analysis', 500);
    }
  }

  /**
   * Get performance metrics calculation
   */
  async getPerformanceMetrics(hotelId, options = {}) {
    try {
      const { dateRange, userId, role } = options;
      
      const matchStage = { hotelId };

      if (dateRange && dateRange.start && dateRange.end) {
        matchStage.date = {
          $gte: new Date(dateRange.start),
          $lte: new Date(dateRange.end)
        };
      }

      if (userId) {
        matchStage.userId = new mongoose.Types.ObjectId(userId);
      }

      const pipeline = [
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
          $match: role ? { 'user.role': role } : {}
        },
        {
          $group: {
            _id: null,
            totalUsers: { $addToSet: '$userId' },
            averageEfficiencyScore: { $avg: '$performanceMetrics.efficiencyScore' },
            averageProductivityScore: { $avg: '$performanceMetrics.productivityScore' },
            averageAccuracyRate: { $avg: '$performanceMetrics.accuracyRate' },
            averageTaskCompletionRate: { $avg: '$performanceMetrics.taskCompletionRate' },
            averageResponseTime: { $avg: '$performanceMetrics.responseTime' },
            averageErrorRate: { $avg: '$performanceMetrics.errorRate' },
            topPerformers: {
              $push: {
                userId: '$userId',
                user: '$user',
                efficiencyScore: '$performanceMetrics.efficiencyScore',
                productivityScore: '$performanceMetrics.productivityScore',
                accuracyRate: '$performanceMetrics.accuracyRate',
                engagementScore: '$engagementScore'
              }
            },
            byRole: {
              $push: {
                role: '$user.role',
                efficiencyScore: '$performanceMetrics.efficiencyScore',
                productivityScore: '$performanceMetrics.productivityScore',
                accuracyRate: '$performanceMetrics.accuracyRate'
              }
            }
          }
        }
      ];

      const [performanceData, performanceTrends] = await Promise.all([
        UserAnalytics.aggregate(pipeline),
        this.getPerformanceTrends(hotelId, options)
      ]);

      const result = performanceData[0] || {
        totalUsers: [],
        averageEfficiencyScore: 0,
        averageProductivityScore: 0,
        averageAccuracyRate: 0,
        averageTaskCompletionRate: 0,
        averageResponseTime: 0,
        averageErrorRate: 0
      };

      // Calculate role-based performance
      const rolePerformance = this.calculateRolePerformance(result.byRole || []);

      // Get top performers
      const topPerformers = (result.topPerformers || [])
        .sort((a, b) => {
          const scoreA = (a.efficiencyScore + a.productivityScore + a.accuracyRate) / 3;
          const scoreB = (b.efficiencyScore + b.productivityScore + b.accuracyRate) / 3;
          return scoreB - scoreA;
        })
        .slice(0, 10);

      return {
        ...result,
        totalUserCount: result.totalUsers.length,
        performanceTrends,
        rolePerformance,
        topPerformers,
        overallPerformanceScore: (
          result.averageEfficiencyScore + 
          result.averageProductivityScore + 
          result.averageAccuracyRate
        ) / 3
      };
    } catch (error) {
      throw new ApplicationError('Failed to fetch performance metrics', 500);
    }
  }

  /**
   * Get user lifecycle analysis
   */
  async getUserLifecycleAnalysis(hotelId, options = {}) {
    try {
      const { dateRange } = options;
      
      const matchStage = { hotelId };

      if (dateRange && dateRange.start && dateRange.end) {
        matchStage.date = {
          $gte: new Date(dateRange.start),
          $lte: new Date(dateRange.end)
        };
      }

      const pipeline = [
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
            _id: '$lifecycleStage',
            users: { $addToSet: '$user' },
            averageEngagementScore: { $avg: '$engagementScore' },
            averageChurnRisk: { $avg: '$churnRisk' },
            averageRetentionScore: { $avg: '$retentionScore' },
            count: { $sum: 1 },
            segmentDistribution: {
              $push: {
                segmentTags: '$segmentTags',
                engagementScore: '$engagementScore'
              }
            }
          }
        },
        {
          $addFields: {
            userCount: { $size: '$users' }
          }
        },
        { $sort: { count: -1 } }
      ];

      const lifecycleData = await UserAnalytics.aggregate(pipeline);

      // Calculate lifecycle transitions
      const transitions = await this.calculateLifecycleTransitions(hotelId, options);

      return {
        stages: lifecycleData,
        transitions,
        totalUsers: lifecycleData.reduce((sum, stage) => sum + stage.userCount, 0),
        stageDistribution: this.calculateStageDistribution(lifecycleData)
      };
    } catch (error) {
      throw new ApplicationError('Failed to fetch user lifecycle analysis', 500);
    }
  }

  /**
   * Get engagement scoring algorithms
   */
  async calculateEngagementScores(hotelId, options = {}) {
    try {
      const { dateRange, userId } = options;
      
      const matchStage = { hotelId };

      if (dateRange && dateRange.start && dateRange.end) {
        matchStage.date = {
          $gte: new Date(dateRange.start),
          $lte: new Date(dateRange.end)
        };
      }

      if (userId) {
        matchStage.userId = new mongoose.Types.ObjectId(userId);
      }

      const analytics = await UserAnalytics.find(matchStage)
        .populate('userId', 'name email role')
        .sort({ date: -1 });

      // Calculate engagement scores for each record
      const updatedAnalytics = analytics.map(record => {
        record.calculateEngagementScore();
        record.calculateChurnRisk();
        record.updateLifecycleStage();
        return record;
      });

      // Save updated scores
      await Promise.all(updatedAnalytics.map(record => record.save()));

      return {
        updatedRecords: updatedAnalytics.length,
        averageEngagementScore: updatedAnalytics.length > 0 ? 
          updatedAnalytics.reduce((sum, record) => sum + record.engagementScore, 0) / updatedAnalytics.length : 0,
        averageChurnRisk: updatedAnalytics.length > 0 ? 
          updatedAnalytics.reduce((sum, record) => sum + record.churnRisk, 0) / updatedAnalytics.length : 0
      };
    } catch (error) {
      throw new ApplicationError('Failed to calculate engagement scores', 500);
    }
  }

  /**
   * Get engagement trends
   */
  async getEngagementTrends(hotelId, options = {}) {
    try {
      const { dateRange } = options;
      
      const matchStage = { hotelId };

      if (dateRange && dateRange.start && dateRange.end) {
        matchStage.date = {
          $gte: new Date(dateRange.start),
          $lte: new Date(dateRange.end)
        };
      }

      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: {
              year: { $year: '$date' },
              month: { $month: '$date' },
              day: { $dayOfMonth: '$date' }
            },
            averageEngagement: { $avg: '$engagementScore' },
            averageChurnRisk: { $avg: '$churnRisk' },
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
      ];

      return await UserAnalytics.aggregate(pipeline);
    } catch (error) {
      throw new ApplicationError('Failed to fetch engagement trends', 500);
    }
  }

  /**
   * Get top engaged users
   */
  async getTopEngagedUsers(hotelId, options = {}) {
    try {
      const { dateRange, limit = 10 } = options;
      
      const matchStage = { hotelId };

      if (dateRange && dateRange.start && dateRange.end) {
        matchStage.date = {
          $gte: new Date(dateRange.start),
          $lte: new Date(dateRange.end)
        };
      }

      const pipeline = [
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
            _id: '$userId',
            user: { $first: '$user' },
            averageEngagementScore: { $avg: '$engagementScore' },
            averageChurnRisk: { $avg: '$churnRisk' },
            totalLogins: { $sum: '$activityMetrics.loginCount' },
            totalActions: { $sum: '$activityMetrics.actionsPerformed' },
            segmentTags: { $addToSet: '$segmentTags' },
            lifecycleStage: { $first: '$lifecycleStage' }
          }
        },
        {
          $addFields: {
            engagementLevel: {
              $cond: [
                { $gte: ['$averageEngagementScore', 80] },
                'high',
                {
                  $cond: [
                    { $gte: ['$averageEngagementScore', 60] },
                    'medium',
                    'low'
                  ]
                }
              ]
            }
          }
        },
        { $sort: { averageEngagementScore: -1 } },
        { $limit: limit }
      ];

      return await UserAnalytics.aggregate(pipeline);
    } catch (error) {
      throw new ApplicationError('Failed to fetch top engaged users', 500);
    }
  }

  /**
   * Get performance trends
   */
  async getPerformanceTrends(hotelId, options = {}) {
    try {
      const { dateRange } = options;
      
      const matchStage = { hotelId };

      if (dateRange && dateRange.start && dateRange.end) {
        matchStage.date = {
          $gte: new Date(dateRange.start),
          $lte: new Date(dateRange.end)
        };
      }

      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: {
              year: { $year: '$date' },
              month: { $month: '$date' },
              day: { $dayOfMonth: '$date' }
            },
            averageEfficiency: { $avg: '$performanceMetrics.efficiencyScore' },
            averageProductivity: { $avg: '$performanceMetrics.productivityScore' },
            averageAccuracy: { $avg: '$performanceMetrics.accuracyRate' },
            averageResponseTime: { $avg: '$performanceMetrics.responseTime' },
            averageErrorRate: { $avg: '$performanceMetrics.errorRate' }
          }
        },
        { $sort: { '_id': 1 } }
      ];

      return await UserAnalytics.aggregate(pipeline);
    } catch (error) {
      throw new ApplicationError('Failed to fetch performance trends', 500);
    }
  }

  /**
   * Calculate lifecycle transitions
   */
  async calculateLifecycleTransitions(hotelId, options = {}) {
    try {
      const { dateRange } = options;
      
      const matchStage = { hotelId };

      if (dateRange && dateRange.start && dateRange.end) {
        matchStage.date = {
          $gte: new Date(dateRange.start),
          $lte: new Date(dateRange.end)
        };
      }

      const pipeline = [
        { $match: matchStage },
        {
          $sort: { userId: 1, date: 1 }
        },
        {
          $group: {
            _id: '$userId',
            stages: { $push: '$lifecycleStage' },
            dates: { $push: '$date' }
          }
        },
        {
          $addFields: {
            transitions: {
              $reduce: {
                input: { $range: [1, { $size: '$stages' }] },
                initialValue: [],
                in: {
                  $concatArrays: [
                    '$$value',
                    [{
                      from: { $arrayElemAt: ['$stages', { $subtract: ['$$this', 1] }] },
                      to: { $arrayElemAt: ['$stages', '$$this'] },
                      date: { $arrayElemAt: ['$dates', '$$this'] }
                    }]
                  ]
                }
              }
            }
          }
        },
        {
          $unwind: '$transitions'
        },
        {
          $group: {
            _id: {
              from: '$transitions.from',
              to: '$transitions.to'
            },
            count: { $sum: 1 },
            averageTransitionTime: { $avg: '$transitions.date' }
          }
        },
        { $sort: { count: -1 } }
      ];

      return await UserAnalytics.aggregate(pipeline);
    } catch (error) {
      throw new ApplicationError('Failed to calculate lifecycle transitions', 500);
    }
  }

  /**
   * Calculate segment distribution
   */
  calculateSegmentDistribution(segmentData) {
    const distribution = {};
    
    segmentData.forEach(item => {
      item.segmentTags.forEach(tag => {
        if (!distribution[tag]) {
          distribution[tag] = { count: 0, totalEngagement: 0, totalChurnRisk: 0 };
        }
        distribution[tag].count++;
        distribution[tag].totalEngagement += item.engagementScore;
        distribution[tag].totalChurnRisk += item.churnRisk;
      });
    });

    return Object.entries(distribution).map(([segment, data]) => ({
      segment,
      count: data.count,
      averageEngagement: data.count > 0 ? data.totalEngagement / data.count : 0,
      averageChurnRisk: data.count > 0 ? data.totalChurnRisk / data.count : 0
    }));
  }

  /**
   * Calculate lifecycle distribution
   */
  calculateLifecycleDistribution(lifecycleData) {
    const distribution = {};
    
    lifecycleData.forEach(item => {
      if (!distribution[item.lifecycleStage]) {
        distribution[item.lifecycleStage] = { count: 0, totalEngagement: 0 };
      }
      distribution[item.lifecycleStage].count++;
      distribution[item.lifecycleStage].totalEngagement += item.engagementScore;
    });

    return Object.entries(distribution).map(([stage, data]) => ({
      stage,
      count: data.count,
      averageEngagement: data.count > 0 ? data.totalEngagement / data.count : 0
    }));
  }

  /**
   * Calculate activity distribution
   */
  calculateActivityDistribution(behaviorData) {
    const distribution = { high: 0, medium: 0, low: 0 };
    
    behaviorData.forEach(user => {
      distribution[user.activityLevel]++;
    });

    return distribution;
  }

  /**
   * Calculate role performance
   */
  calculateRolePerformance(roleData) {
    const performance = {};
    
    roleData.forEach(item => {
      if (!performance[item.role]) {
        performance[item.role] = {
          count: 0,
          totalEfficiency: 0,
          totalProductivity: 0,
          totalAccuracy: 0
        };
      }
      performance[item.role].count++;
      performance[item.role].totalEfficiency += item.efficiencyScore;
      performance[item.role].totalProductivity += item.productivityScore;
      performance[item.role].totalAccuracy += item.accuracyRate;
    });

    return Object.entries(performance).map(([role, data]) => ({
      role,
      count: data.count,
      averageEfficiency: data.count > 0 ? data.totalEfficiency / data.count : 0,
      averageProductivity: data.count > 0 ? data.totalProductivity / data.count : 0,
      averageAccuracy: data.count > 0 ? data.totalAccuracy / data.count : 0,
      overallScore: data.count > 0 ? 
        (data.totalEfficiency + data.totalProductivity + data.totalAccuracy) / (data.count * 3) : 0
    }));
  }

  /**
   * Calculate stage distribution
   */
  calculateStageDistribution(lifecycleData) {
    const total = lifecycleData.reduce((sum, stage) => sum + stage.userCount, 0);
    
    return lifecycleData.map(stage => ({
      ...stage,
      percentage: total > 0 ? (stage.userCount / total) * 100 : 0
    }));
  }
}

export default new UserEngagementService();
