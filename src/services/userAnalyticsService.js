import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import mongoose from 'mongoose';

class UserAnalyticsService {
  /**
   * Get comprehensive user analytics
   */
  async getUserAnalytics(hotelId, options = {}) {
    try {
      const { dateRange, groupBy = 'day' } = options;
      
      const matchStage = {
        $or: [
          { role: 'guest' },
          { hotelId: new mongoose.Types.ObjectId(hotelId) }
        ]
      };

      if (dateRange && dateRange.start && dateRange.end) {
        matchStage.createdAt = {
          $gte: new Date(dateRange.start),
          $lte: new Date(dateRange.end)
        };
      }

      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } },
            inactiveUsers: { $sum: { $cond: ['$isActive', 0, 1] } },
            guests: { $sum: { $cond: [{ $eq: ['$role', 'guest'] }, 1, 0] } },
            staff: { $sum: { $cond: [{ $eq: ['$role', 'staff'] }, 1, 0] } },
            admins: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } },
            managers: { $sum: { $cond: [{ $eq: ['$role', 'manager'] }, 1, 0] } },
            corporateUsers: { $sum: { $cond: [{ $eq: ['$guestType', 'corporate'] }, 1, 0] } },
            loyaltyMembers: { $sum: { $cond: [{ $gt: ['$loyalty.points', 0] }, 1, 0] } },
            byMonth: {
              $push: {
                month: { $month: '$createdAt' },
                year: { $year: '$createdAt' },
                role: '$role',
                isActive: '$isActive'
              }
            }
          }
        }
      ];

      const [analytics, recentUsers, topUsers] = await Promise.all([
        User.aggregate(pipeline),
        this.getRecentUsers(hotelId, 10),
        this.getTopUsers(hotelId, 10)
      ]);

      const result = analytics[0] || {
        totalUsers: 0,
        activeUsers: 0,
        inactiveUsers: 0,
        guests: 0,
        staff: 0,
        admins: 0,
        managers: 0,
        corporateUsers: 0,
        loyaltyMembers: 0
      };

      // Calculate monthly trends
      const monthlyTrends = this.calculateMonthlyTrends(result.byMonth || []);

      return {
        ...result,
        monthlyTrends,
        recentUsers,
        topUsers,
        engagementRate: result.totalUsers > 0 ? (result.activeUsers / result.totalUsers) * 100 : 0,
        loyaltyRate: result.totalUsers > 0 ? (result.loyaltyMembers / result.totalUsers) * 100 : 0
      };
    } catch (error) {
      throw new ApplicationError('Failed to fetch user analytics', 500);
    }
  }

  /**
   * Get user activity metrics
   */
  async getUserActivityMetrics(hotelId, options = {}) {
    try {
      const { dateRange, userId } = options;
      
      const matchStage = {
        $or: [
          { 'user.role': 'guest' },
          { 'user.hotelId': new mongoose.Types.ObjectId(hotelId) }
        ]
      };

      if (userId) {
        matchStage['user._id'] = new mongoose.Types.ObjectId(userId);
      }

      if (dateRange && dateRange.start && dateRange.end) {
        matchStage.timestamp = {
          $gte: new Date(dateRange.start),
          $lte: new Date(dateRange.end)
        };
      }

      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalActivities: { $sum: 1 },
            uniqueUsers: { $addToSet: '$user._id' },
            loginActivities: { $sum: { $cond: [{ $eq: ['$action', 'login'] }, 1, 0] } },
            logoutActivities: { $sum: { $cond: [{ $eq: ['$action', 'logout'] }, 1, 0] } },
            profileUpdates: { $sum: { $cond: [{ $eq: ['$action', 'profile_update'] }, 1, 0] } },
            byAction: {
              $push: {
                action: '$action',
                timestamp: '$timestamp'
              }
            },
            byHour: {
              $push: {
                hour: { $hour: '$timestamp' },
                action: '$action'
              }
            }
          }
        }
      ];

      const [activityData, userEngagement] = await Promise.all([
        AuditLog.aggregate(pipeline),
        this.getUserEngagementMetrics(hotelId, options)
      ]);

      const result = activityData[0] || {
        totalActivities: 0,
        uniqueUsers: [],
        loginActivities: 0,
        logoutActivities: 0,
        profileUpdates: 0
      };

      // Calculate hourly patterns
      const hourlyPatterns = this.calculateHourlyPatterns(result.byHour || []);
      
      // Calculate action distribution
      const actionDistribution = this.calculateActionDistribution(result.byAction || []);

      return {
        ...result,
        uniqueUserCount: result.uniqueUsers.length,
        hourlyPatterns,
        actionDistribution,
        userEngagement,
        averageActivitiesPerUser: result.uniqueUsers.length > 0 ? result.totalActivities / result.uniqueUsers.length : 0
      };
    } catch (error) {
      throw new ApplicationError('Failed to fetch user activity metrics', 500);
    }
  }

  /**
   * Get user performance metrics
   */
  async getUserPerformanceMetrics(hotelId, options = {}) {
    try {
      const { dateRange, userId } = options;
      
      const matchStage = {
        $or: [
          { role: 'guest' },
          { hotelId: new mongoose.Types.ObjectId(hotelId) }
        ]
      };

      if (userId) {
        matchStage._id = new mongoose.Types.ObjectId(userId);
      }

      const pipeline = [
        { $match: matchStage },
        {
          $lookup: {
            from: 'auditlogs',
            localField: '_id',
            foreignField: 'user._id',
            as: 'activities'
          }
        },
        {
          $addFields: {
            activityCount: { $size: '$activities' },
            lastActivity: { $max: '$activities.timestamp' },
            loginCount: {
              $size: {
                $filter: {
                  input: '$activities',
                  cond: { $eq: ['$$this.action', 'login'] }
                }
              }
            },
            daysSinceLastActivity: {
              $divide: [
                { $subtract: [new Date(), { $max: '$activities.timestamp' }] },
                1000 * 60 * 60 * 24
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            activeUsers: { $sum: { $cond: [{ $gt: ['$activityCount', 0] }, 1, 0] } },
            highlyActiveUsers: { $sum: { $cond: [{ $gt: ['$activityCount', 10] }, 1, 0] } },
            averageActivityPerUser: { $avg: '$activityCount' },
            averageLoginsPerUser: { $avg: '$loginCount' },
            usersWithRecentActivity: { $sum: { $cond: [{ $lt: ['$daysSinceLastActivity', 7] }, 1, 0] } },
            usersWithOldActivity: { $sum: { $cond: [{ $gt: ['$daysSinceLastActivity', 30] }, 1, 0] } },
            byRole: {
              $push: {
                role: '$role',
                activityCount: '$activityCount',
                loginCount: '$loginCount'
              }
            }
          }
        }
      ];

      const [performanceData, topPerformers] = await Promise.all([
        User.aggregate(pipeline),
        this.getTopPerformingUsers(hotelId, 10)
      ]);

      const result = performanceData[0] || {
        totalUsers: 0,
        activeUsers: 0,
        highlyActiveUsers: 0,
        averageActivityPerUser: 0,
        averageLoginsPerUser: 0,
        usersWithRecentActivity: 0,
        usersWithOldActivity: 0
      };

      // Calculate role-based performance
      const rolePerformance = this.calculateRolePerformance(result.byRole || []);

      return {
        ...result,
        rolePerformance,
        topPerformers,
        activityRate: result.totalUsers > 0 ? (result.activeUsers / result.totalUsers) * 100 : 0,
        highActivityRate: result.totalUsers > 0 ? (result.highlyActiveUsers / result.totalUsers) * 100 : 0,
        recentActivityRate: result.totalUsers > 0 ? (result.usersWithRecentActivity / result.totalUsers) * 100 : 0
      };
    } catch (error) {
      throw new ApplicationError('Failed to fetch user performance metrics', 500);
    }
  }

  /**
   * Get user segmentation data
   */
  async getUserSegmentation(hotelId, options = {}) {
    try {
      const { segmentBy = 'role' } = options;
      
      const matchStage = {
        $or: [
          { role: 'guest' },
          { hotelId: new mongoose.Types.ObjectId(hotelId) }
        ]
      };

      const pipeline = [
        { $match: matchStage },
        {
          $lookup: {
            from: 'auditlogs',
            localField: '_id',
            foreignField: 'user._id',
            as: 'activities'
          }
        },
        {
          $addFields: {
            activityCount: { $size: '$activities' },
            lastActivity: { $max: '$activities.timestamp' },
            daysSinceLastActivity: {
              $divide: [
                { $subtract: [new Date(), { $max: '$activities.timestamp' }] },
                1000 * 60 * 60 * 24
              ]
            },
            segment: this.getSegmentValue(segmentBy)
          }
        },
        {
          $group: {
            _id: '$segment',
            count: { $sum: 1 },
            activeCount: { $sum: { $cond: [{ $gt: ['$activityCount', 0] }, 1, 0] } },
            averageActivity: { $avg: '$activityCount' },
            averageDaysSinceActivity: { $avg: '$daysSinceLastActivity' },
            loyaltyPoints: { $avg: '$loyalty.points' }
          }
        },
        { $sort: { count: -1 } }
      ];

      const segments = await User.aggregate(pipeline);

      return {
        segments,
        totalSegments: segments.length,
        segmentBy
      };
    } catch (error) {
      throw new ApplicationError('Failed to fetch user segmentation', 500);
    }
  }

  /**
   * Get user engagement metrics
   */
  async getUserEngagementMetrics(hotelId, options = {}) {
    try {
      const { dateRange } = options;
      
      const matchStage = {
        $or: [
          { 'user.role': 'guest' },
          { 'user.hotelId': new mongoose.Types.ObjectId(hotelId) }
        ]
      };

      if (dateRange && dateRange.start && dateRange.end) {
        matchStage.timestamp = {
          $gte: new Date(dateRange.start),
          $lte: new Date(dateRange.end)
        };
      }

      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: '$user._id',
            activityCount: { $sum: 1 },
            lastActivity: { $max: '$timestamp' },
            uniqueActions: { $addToSet: '$action' }
          }
        },
        {
          $addFields: {
            engagementScore: {
              $add: [
                { $multiply: ['$activityCount', 0.1] },
                { $multiply: [{ $size: '$uniqueActions' }, 0.2] },
                {
                  $cond: [
                    { $gt: [{ $divide: [{ $subtract: [new Date(), '$lastActivity'] }, 1000 * 60 * 60 * 24] }, 7] },
                    -0.5,
                    0.5
                  ]
                }
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            highEngagement: { $sum: { $cond: [{ $gt: ['$engagementScore', 2] }, 1, 0] } },
            mediumEngagement: { $sum: { $cond: [{ $and: [{ $gte: ['$engagementScore', 1] }, { $lte: ['$engagementScore', 2] }] }, 1, 0] } },
            lowEngagement: { $sum: { $cond: [{ $lt: ['$engagementScore', 1] }, 1, 0] } },
            averageEngagement: { $avg: '$engagementScore' }
          }
        }
      ];

      const result = await AuditLog.aggregate(pipeline);
      
      return result[0] || {
        totalUsers: 0,
        highEngagement: 0,
        mediumEngagement: 0,
        lowEngagement: 0,
        averageEngagement: 0
      };
    } catch (error) {
      throw new ApplicationError('Failed to fetch user engagement metrics', 500);
    }
  }

  /**
   * Get recent users
   */
  async getRecentUsers(hotelId, limit = 10) {
    try {
      const users = await User.find({
        $or: [
          { role: 'guest' },
          { hotelId: new mongoose.Types.ObjectId(hotelId) }
        ]
      })
      .select('name email role createdAt lastLogin isActive')
      .sort({ createdAt: -1 })
      .limit(limit);

      return users;
    } catch (error) {
      throw new ApplicationError('Failed to fetch recent users', 500);
    }
  }

  /**
   * Get top users by activity
   */
  async getTopUsers(hotelId, limit = 10) {
    try {
      const pipeline = [
        {
          $match: {
            $or: [
              { role: 'guest' },
              { hotelId: new mongoose.Types.ObjectId(hotelId) }
            ]
          }
        },
        {
          $lookup: {
            from: 'auditlogs',
            localField: '_id',
            foreignField: 'user._id',
            as: 'activities'
          }
        },
        {
          $addFields: {
            activityCount: { $size: '$activities' },
            lastActivity: { $max: '$activities.timestamp' }
          }
        },
        {
          $sort: { activityCount: -1 }
        },
        {
          $limit: limit
        },
        {
          $project: {
            name: 1,
            email: 1,
            role: 1,
            activityCount: 1,
            lastActivity: 1,
            isActive: 1
          }
        }
      ];

      return await User.aggregate(pipeline);
    } catch (error) {
      throw new ApplicationError('Failed to fetch top users', 500);
    }
  }

  /**
   * Get top performing users
   */
  async getTopPerformingUsers(hotelId, limit = 10) {
    try {
      const pipeline = [
        {
          $match: {
            $or: [
              { role: 'guest' },
              { hotelId: new mongoose.Types.ObjectId(hotelId) }
            ]
          }
        },
        {
          $lookup: {
            from: 'auditlogs',
            localField: '_id',
            foreignField: 'user._id',
            as: 'activities'
          }
        },
        {
          $addFields: {
            loginCount: {
              $size: {
                $filter: {
                  input: '$activities',
                  cond: { $eq: ['$$this.action', 'login'] }
                }
              }
            },
            lastActivity: { $max: '$activities.timestamp' },
            performanceScore: {
              $add: [
                { $multiply: [{ $size: '$activities' }, 0.1] },
                { $multiply: [{ $size: { $filter: { input: '$activities', cond: { $eq: ['$$this.action', 'login'] } } } }, 0.2] },
                {
                  $cond: [
                    { $gt: [{ $divide: [{ $subtract: [new Date(), { $max: '$activities.timestamp' }] }, 1000 * 60 * 60 * 24] }, 7] },
                    -0.3,
                    0.3
                  ]
                }
              ]
            }
          }
        },
        {
          $sort: { performanceScore: -1 }
        },
        {
          $limit: limit
        },
        {
          $project: {
            name: 1,
            email: 1,
            role: 1,
            loginCount: 1,
            lastActivity: 1,
            performanceScore: 1,
            isActive: 1
          }
        }
      ];

      return await User.aggregate(pipeline);
    } catch (error) {
      throw new ApplicationError('Failed to fetch top performing users', 500);
    }
  }

  /**
   * Calculate monthly trends
   */
  calculateMonthlyTrends(monthlyData) {
    const trends = {};
    
    monthlyData.forEach(item => {
      const key = `${item.year}-${item.month}`;
      if (!trends[key]) {
        trends[key] = { total: 0, active: 0, byRole: {} };
      }
      trends[key].total++;
      if (item.isActive) trends[key].active++;
      trends[key].byRole[item.role] = (trends[key].byRole[item.role] || 0) + 1;
    });

    return Object.entries(trends).map(([month, data]) => ({
      month,
      ...data
    }));
  }

  /**
   * Calculate hourly patterns
   */
  calculateHourlyPatterns(hourlyData) {
    const patterns = Array(24).fill(0);
    
    hourlyData.forEach(item => {
      patterns[item.hour]++;
    });

    return patterns.map((count, hour) => ({ hour, count }));
  }

  /**
   * Calculate action distribution
   */
  calculateActionDistribution(actionData) {
    const distribution = {};
    
    actionData.forEach(item => {
      distribution[item.action] = (distribution[item.action] || 0) + 1;
    });

    return Object.entries(distribution).map(([action, count]) => ({
      action,
      count
    }));
  }

  /**
   * Calculate role performance
   */
  calculateRolePerformance(roleData) {
    const performance = {};
    
    roleData.forEach(item => {
      if (!performance[item.role]) {
        performance[item.role] = { total: 0, totalActivity: 0, totalLogins: 0 };
      }
      performance[item.role].total++;
      performance[item.role].totalActivity += item.activityCount;
      performance[item.role].totalLogins += item.loginCount;
    });

    Object.keys(performance).forEach(role => {
      const data = performance[role];
      data.averageActivity = data.total > 0 ? data.totalActivity / data.total : 0;
      data.averageLogins = data.total > 0 ? data.totalLogins / data.total : 0;
    });

    return performance;
  }

  /**
   * Get segment value based on segment type
   */
  getSegmentValue(segmentBy) {
    switch (segmentBy) {
      case 'role':
        return '$role';
      case 'loyalty':
        return {
          $cond: [
            { $gt: ['$loyalty.points', 1000] },
            'high_loyalty',
            {
              $cond: [
                { $gt: ['$loyalty.points', 100] },
                'medium_loyalty',
                'low_loyalty'
              ]
            }
          ]
        };
      case 'activity':
        return {
          $cond: [
            { $gt: ['$activityCount', 10] },
            'high_activity',
            {
              $cond: [
                { $gt: ['$activityCount', 0] },
                'medium_activity',
                'low_activity'
              ]
            }
          ]
        };
      default:
        return '$role';
    }
  }

  /**
   * Export user analytics data
   */
  async exportUserAnalytics(hotelId, format = 'json', options = {}) {
    try {
      const analytics = await this.getUserAnalytics(hotelId, options);
      
      if (format === 'csv') {
        const csvData = this.convertToCSV(analytics);
        return csvData;
      }
      
      return analytics;
    } catch (error) {
      throw new ApplicationError('Failed to export user analytics', 500);
    }
  }

  /**
   * Convert analytics data to CSV format
   */
  convertToCSV(data) {
    const headers = [
      'Metric',
      'Value',
      'Percentage'
    ];
    
    const rows = [
      ['Total Users', data.totalUsers, '100%'],
      ['Active Users', data.activeUsers, `${data.engagementRate.toFixed(1)}%`],
      ['Guests', data.guests, `${((data.guests / data.totalUsers) * 100).toFixed(1)}%`],
      ['Staff', data.staff, `${((data.staff / data.totalUsers) * 100).toFixed(1)}%`],
      ['Admins', data.admins, `${((data.admins / data.totalUsers) * 100).toFixed(1)}%`],
      ['Managers', data.managers, `${((data.managers / data.totalUsers) * 100).toFixed(1)}%`],
      ['Loyalty Members', data.loyaltyMembers, `${data.loyaltyRate.toFixed(1)}%`]
    ];
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

export default new UserAnalyticsService();
