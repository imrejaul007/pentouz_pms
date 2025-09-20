import LoginSession from '../models/LoginSession.js';
import AuditLog from '../models/AuditLog.js';
import User from '../models/User.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import mongoose from 'mongoose';

class LoginAnalyticsService {
  /**
   * Get comprehensive login analytics
   */
  async getLoginAnalytics(hotelId, options = {}) {
    try {
      const { dateRange, groupBy = 'day' } = options;
      
      const matchStage = { hotelId };

      if (dateRange && dateRange.start && dateRange.end) {
        matchStage.loginTime = {
          $gte: new Date(dateRange.start),
          $lte: new Date(dateRange.end)
        };
      }

      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalLogins: { $sum: 1 },
            activeSessions: { $sum: { $cond: ['$isActive', 1, 0] } },
            endedSessions: { $sum: { $cond: ['$isActive', 0, 1] } },
            uniqueUsers: { $addToSet: '$userId' },
            uniqueIPs: { $addToSet: '$ipAddress' },
            averageSessionDuration: { $avg: '$sessionDuration' },
            highRiskSessions: { $sum: { $cond: [{ $gt: ['$riskScore', 70] }, 1, 0] } },
            mediumRiskSessions: { $sum: { $cond: [{ $and: [{ $gte: ['$riskScore', 30] }, { $lte: ['$riskScore', 70] }] }, 1, 0] } },
            mfaSessions: { $sum: { $cond: ['$mfaUsed', 1, 0] } },
            byDevice: {
              $push: {
                deviceType: '$deviceInfo.deviceType',
                browser: '$deviceInfo.browser',
                os: '$deviceInfo.os'
              }
            },
            byLocation: {
              $push: {
                country: '$locationInfo.country',
                city: '$locationInfo.city'
              }
            },
            byHour: {
              $push: {
                hour: { $hour: '$loginTime' },
                dayOfWeek: { $dayOfWeek: '$loginTime' }
              }
            }
          }
        }
      ];

      const [analytics, recentLogins, topUsers] = await Promise.all([
        LoginSession.aggregate(pipeline),
        this.getRecentLogins(hotelId, 10),
        this.getTopLoginUsers(hotelId, 10)
      ]);

      const result = analytics[0] || {
        totalLogins: 0,
        activeSessions: 0,
        endedSessions: 0,
        uniqueUsers: [],
        uniqueIPs: [],
        averageSessionDuration: 0,
        highRiskSessions: 0,
        mediumRiskSessions: 0,
        mfaSessions: 0
      };

      // Calculate patterns
      const hourlyPatterns = this.calculateHourlyPatterns(result.byHour || []);
      const deviceDistribution = this.calculateDeviceDistribution(result.byDevice || []);
      const locationDistribution = this.calculateLocationDistribution(result.byLocation || []);

      return {
        ...result,
        uniqueUserCount: result.uniqueUsers.length,
        uniqueIPCount: result.uniqueIPs.length,
        hourlyPatterns,
        deviceDistribution,
        locationDistribution,
        recentLogins,
        topUsers,
        mfaRate: result.totalLogins > 0 ? (result.mfaSessions / result.totalLogins) * 100 : 0,
        riskRate: result.totalLogins > 0 ? ((result.highRiskSessions + result.mediumRiskSessions) / result.totalLogins) * 100 : 0
      };
    } catch (error) {
      throw new ApplicationError('Failed to fetch login analytics', 500);
    }
  }

  /**
   * Get login patterns and trends
   */
  async getLoginPatterns(hotelId, options = {}) {
    try {
      const { dateRange, patternType = 'hourly' } = options;
      
      const matchStage = { hotelId };

      if (dateRange && dateRange.start && dateRange.end) {
        matchStage.loginTime = {
          $gte: new Date(dateRange.start),
          $lte: new Date(dateRange.end)
        };
      }

      let groupStage;
      switch (patternType) {
        case 'hourly':
          groupStage = {
            _id: { hour: { $hour: '$loginTime' } },
            count: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' },
            averageRisk: { $avg: '$riskScore' }
          };
          break;
        case 'daily':
          groupStage = {
            _id: { 
              year: { $year: '$loginTime' },
              month: { $month: '$loginTime' },
              day: { $dayOfMonth: '$loginTime' }
            },
            count: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' },
            averageRisk: { $avg: '$riskScore' }
          };
          break;
        case 'weekly':
          groupStage = {
            _id: { 
              year: { $year: '$loginTime' },
              week: { $week: '$loginTime' }
            },
            count: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' },
            averageRisk: { $avg: '$riskScore' }
          };
          break;
        default:
          groupStage = {
            _id: { hour: { $hour: '$loginTime' } },
            count: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' },
            averageRisk: { $avg: '$riskScore' }
          };
      }

      const pipeline = [
        { $match: matchStage },
        { $group: groupStage },
        { $sort: { '_id': 1 } }
      ];

      const patterns = await LoginSession.aggregate(pipeline);

      return {
        patternType,
        patterns: patterns.map(pattern => ({
          ...pattern,
          uniqueUserCount: pattern.uniqueUsers.length,
          averageRisk: Math.round(pattern.averageRisk || 0)
        }))
      };
    } catch (error) {
      throw new ApplicationError('Failed to fetch login patterns', 500);
    }
  }

  /**
   * Get security metrics and threat analysis
   */
  async getSecurityMetrics(hotelId, options = {}) {
    try {
      const { dateRange } = options;
      
      const matchStage = { hotelId };

      if (dateRange && dateRange.start && dateRange.end) {
        matchStage.loginTime = {
          $gte: new Date(dateRange.start),
          $lte: new Date(dateRange.end)
        };
      }

      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            highRiskSessions: { $sum: { $cond: [{ $gt: ['$riskScore', 70] }, 1, 0] } },
            mediumRiskSessions: { $sum: { $cond: [{ $and: [{ $gte: ['$riskScore', 30] }, { $lte: ['$riskScore', 70] }] }, 1, 0] } },
            suspiciousIPSessions: { $sum: { $cond: [{ $in: ['suspicious_ip', '$securityFlags'] }, 1, 0] } },
            unusualLocationSessions: { $sum: { $cond: [{ $in: ['unusual_location', '$securityFlags'] }, 1, 0] } },
            multipleDeviceSessions: { $sum: { $cond: [{ $in: ['multiple_devices', '$securityFlags'] }, 1, 0] } },
            rapidLoginSessions: { $sum: { $cond: [{ $in: ['rapid_logins', '$securityFlags'] }, 1, 0] } },
            failedAttemptSessions: { $sum: { $cond: [{ $in: ['failed_attempts', '$securityFlags'] }, 1, 0] } },
            botDetectedSessions: { $sum: { $cond: [{ $in: ['bot_detected', '$securityFlags'] }, 1, 0] } },
            vpnDetectedSessions: { $sum: { $cond: [{ $in: ['vpn_detected', '$securityFlags'] }, 1, 0] } },
            torDetectedSessions: { $sum: { $cond: [{ $in: ['tor_detected', '$securityFlags'] }, 1, 0] } },
            mfaSessions: { $sum: { $cond: ['$mfaUsed', 1, 0] } },
            averageRiskScore: { $avg: '$riskScore' }
          }
        }
      ];

      const [securityData, threatTrends] = await Promise.all([
        LoginSession.aggregate(pipeline),
        this.getThreatTrends(hotelId, options)
      ]);

      const result = securityData[0] || {
        totalSessions: 0,
        highRiskSessions: 0,
        mediumRiskSessions: 0,
        suspiciousIPSessions: 0,
        unusualLocationSessions: 0,
        multipleDeviceSessions: 0,
        rapidLoginSessions: 0,
        failedAttemptSessions: 0,
        botDetectedSessions: 0,
        vpnDetectedSessions: 0,
        torDetectedSessions: 0,
        mfaSessions: 0,
        averageRiskScore: 0
      };

      return {
        ...result,
        threatTrends,
        securityScore: this.calculateSecurityScore(result),
        riskDistribution: {
          high: result.highRiskSessions,
          medium: result.mediumRiskSessions,
          low: result.totalSessions - result.highRiskSessions - result.mediumRiskSessions
        }
      };
    } catch (error) {
      throw new ApplicationError('Failed to fetch security metrics', 500);
    }
  }

  /**
   * Get user behavior analysis
   */
  async getUserBehaviorAnalysis(hotelId, options = {}) {
    try {
      const { dateRange, userId } = options;
      
      const matchStage = { hotelId };
      if (userId) matchStage.userId = new mongoose.Types.ObjectId(userId);

      if (dateRange && dateRange.start && dateRange.end) {
        matchStage.loginTime = {
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
            totalSessions: { $sum: 1 },
            averageSessionDuration: { $avg: '$sessionDuration' },
            averageRiskScore: { $avg: '$riskScore' },
            mfaUsage: { $sum: { $cond: ['$mfaUsed', 1, 0] } },
            highRiskSessions: { $sum: { $cond: [{ $gt: ['$riskScore', 70] }, 1, 0] } },
            uniqueIPs: { $addToSet: '$ipAddress' },
            uniqueDevices: { $addToSet: '$deviceInfo.deviceType' },
            uniqueLocations: { $addToSet: '$locationInfo.country' },
            lastLogin: { $max: '$loginTime' },
            firstLogin: { $min: '$loginTime' },
            securityFlags: { $addToSet: '$securityFlags' }
          }
        },
        {
          $addFields: {
            uniqueIPCount: { $size: '$uniqueIPs' },
            uniqueDeviceCount: { $size: '$uniqueDevices' },
            uniqueLocationCount: { $size: '$uniqueLocations' },
            mfaRate: { $multiply: [{ $divide: ['$mfaUsage', '$totalSessions'] }, 100] },
            riskRate: { $multiply: [{ $divide: ['$highRiskSessions', '$totalSessions'] }, 100] },
            behaviorScore: {
              $add: [
                { $multiply: [{ $divide: ['$mfaUsage', '$totalSessions'] }, 30] },
                { $multiply: [{ $subtract: [1, { $divide: ['$averageRiskScore', 100] }] }, 40] },
                { $multiply: [{ $divide: ['$uniqueIPCount', 5] }, 10] },
                { $multiply: [{ $divide: ['$uniqueDeviceCount', 3] }, 10] },
                { $multiply: [{ $divide: ['$uniqueLocationCount', 2] }, 10] }
              ]
            }
          }
        },
        { $sort: { behaviorScore: -1 } }
      ];

      const behaviorData = await LoginSession.aggregate(pipeline);

      return {
        users: behaviorData,
        totalUsers: behaviorData.length,
        averageBehaviorScore: behaviorData.length > 0 ? 
          behaviorData.reduce((sum, user) => sum + user.behaviorScore, 0) / behaviorData.length : 0
      };
    } catch (error) {
      throw new ApplicationError('Failed to fetch user behavior analysis', 500);
    }
  }

  /**
   * Get compliance reporting data
   */
  async getComplianceReport(hotelId, options = {}) {
    try {
      const { dateRange, complianceType = 'all' } = options;
      
      const matchStage = { hotelId };

      if (dateRange && dateRange.start && dateRange.end) {
        matchStage.loginTime = {
          $gte: new Date(dateRange.start),
          $lte: new Date(dateRange.end)
        };
      }

      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            mfaCompliantSessions: { $sum: { $cond: ['$mfaUsed', 1, 0] } },
            highRiskSessions: { $sum: { $cond: [{ $gt: ['$riskScore', 70] }, 1, 0] } },
            suspiciousSessions: { $sum: { $cond: [{ $gt: [{ $size: '$securityFlags' }, 0] }, 1, 0] } },
            uniqueUsers: { $addToSet: '$userId' },
            uniqueIPs: { $addToSet: '$ipAddress' },
            byCountry: {
              $push: {
                country: '$locationInfo.country',
                riskScore: '$riskScore'
              }
            },
            byDevice: {
              $push: {
                deviceType: '$deviceInfo.deviceType',
                mfaUsed: '$mfaUsed'
              }
            }
          }
        }
      ];

      const [complianceData, auditTrail] = await Promise.all([
        LoginSession.aggregate(pipeline),
        this.getAuditTrail(hotelId, options)
      ]);

      const result = complianceData[0] || {
        totalSessions: 0,
        mfaCompliantSessions: 0,
        highRiskSessions: 0,
        suspiciousSessions: 0,
        uniqueUsers: [],
        uniqueIPs: []
      };

      const countryCompliance = this.calculateCountryCompliance(result.byCountry || []);
      const deviceCompliance = this.calculateDeviceCompliance(result.byDevice || []);

      return {
        ...result,
        uniqueUserCount: result.uniqueUsers.length,
        uniqueIPCount: result.uniqueIPs.length,
        mfaComplianceRate: result.totalSessions > 0 ? (result.mfaCompliantSessions / result.totalSessions) * 100 : 0,
        riskComplianceRate: result.totalSessions > 0 ? ((result.totalSessions - result.highRiskSessions) / result.totalSessions) * 100 : 0,
        countryCompliance,
        deviceCompliance,
        auditTrail
      };
    } catch (error) {
      throw new ApplicationError('Failed to fetch compliance report', 500);
    }
  }

  /**
   * Get recent logins
   */
  async getRecentLogins(hotelId, limit = 10) {
    try {
      const logins = await LoginSession.find({ hotelId })
        .populate('userId', 'name email role')
        .sort({ loginTime: -1 })
        .limit(limit);

      return logins;
    } catch (error) {
      throw new ApplicationError('Failed to fetch recent logins', 500);
    }
  }

  /**
   * Get top login users
   */
  async getTopLoginUsers(hotelId, limit = 10) {
    try {
      const pipeline = [
        { $match: { hotelId } },
        {
          $group: {
            _id: '$userId',
            loginCount: { $sum: 1 },
            averageRiskScore: { $avg: '$riskScore' },
            lastLogin: { $max: '$loginTime' },
            uniqueIPs: { $addToSet: '$ipAddress' },
            uniqueDevices: { $addToSet: '$deviceInfo.deviceType' }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: '$user' },
        {
          $addFields: {
            uniqueIPCount: { $size: '$uniqueIPs' },
            uniqueDeviceCount: { $size: '$uniqueDevices' }
          }
        },
        { $sort: { loginCount: -1 } },
        { $limit: limit }
      ];

      return await LoginSession.aggregate(pipeline);
    } catch (error) {
      throw new ApplicationError('Failed to fetch top login users', 500);
    }
  }

  /**
   * Get threat trends
   */
  async getThreatTrends(hotelId, options = {}) {
    try {
      const { dateRange } = options;
      
      const matchStage = { hotelId };

      if (dateRange && dateRange.start && dateRange.end) {
        matchStage.loginTime = {
          $gte: new Date(dateRange.start),
          $lte: new Date(dateRange.end)
        };
      }

      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: {
              year: { $year: '$loginTime' },
              month: { $month: '$loginTime' },
              day: { $dayOfMonth: '$loginTime' }
            },
            highRiskCount: { $sum: { $cond: [{ $gt: ['$riskScore', 70] }, 1, 0] } },
            suspiciousCount: { $sum: { $cond: [{ $gt: [{ $size: '$securityFlags' }, 0] }, 1, 0] } },
            totalCount: { $sum: 1 }
          }
        },
        { $sort: { '_id': 1 } }
      ];

      return await LoginSession.aggregate(pipeline);
    } catch (error) {
      throw new ApplicationError('Failed to fetch threat trends', 500);
    }
  }

  /**
   * Get audit trail
   */
  async getAuditTrail(hotelId, options = {}) {
    try {
      const { dateRange, limit = 50 } = options;
      
      const matchStage = {
        'user.hotelId': new mongoose.Types.ObjectId(hotelId),
        action: { $in: ['login', 'logout', 'failed_login', 'password_change', 'mfa_enabled', 'mfa_disabled'] }
      };

      if (dateRange && dateRange.start && dateRange.end) {
        matchStage.timestamp = {
          $gte: new Date(dateRange.start),
          $lte: new Date(dateRange.end)
        };
      }

      const auditLogs = await AuditLog.find(matchStage)
        .populate('user', 'name email role')
        .sort({ timestamp: -1 })
        .limit(limit);

      return auditLogs;
    } catch (error) {
      throw new ApplicationError('Failed to fetch audit trail', 500);
    }
  }

  /**
   * Calculate hourly patterns
   */
  calculateHourlyPatterns(hourlyData) {
    const patterns = Array(24).fill(0);
    const userPatterns = Array(24).fill(0);
    
    hourlyData.forEach(item => {
      patterns[item.hour]++;
      if (item.uniqueUsers) {
        userPatterns[item.hour] = Math.max(userPatterns[item.hour], item.uniqueUsers.length);
      }
    });

    return patterns.map((count, hour) => ({ 
      hour, 
      count,
      uniqueUsers: userPatterns[hour]
    }));
  }

  /**
   * Calculate device distribution
   */
  calculateDeviceDistribution(deviceData) {
    const distribution = {};
    
    deviceData.forEach(item => {
      const key = `${item.deviceType}-${item.browser}`;
      distribution[key] = (distribution[key] || 0) + 1;
    });

    return Object.entries(distribution).map(([device, count]) => ({
      device,
      count
    }));
  }

  /**
   * Calculate location distribution
   */
  calculateLocationDistribution(locationData) {
    const distribution = {};
    
    locationData.forEach(item => {
      const key = `${item.country}-${item.city}`;
      distribution[key] = (distribution[key] || 0) + 1;
    });

    return Object.entries(distribution).map(([location, count]) => ({
      location,
      count
    }));
  }

  /**
   * Calculate security score
   */
  calculateSecurityScore(securityData) {
    const totalSessions = securityData.totalSessions;
    if (totalSessions === 0) return 100;

    const riskPenalty = (securityData.highRiskSessions * 20) + (securityData.mediumRiskSessions * 10);
    const mfaBonus = (securityData.mfaSessions / totalSessions) * 20;
    
    return Math.max(0, 100 - riskPenalty + mfaBonus);
  }

  /**
   * Calculate country compliance
   */
  calculateCountryCompliance(countryData) {
    const compliance = {};
    
    countryData.forEach(item => {
      if (!compliance[item.country]) {
        compliance[item.country] = { total: 0, highRisk: 0 };
      }
      compliance[item.country].total++;
      if (item.riskScore > 70) {
        compliance[item.country].highRisk++;
      }
    });

    return Object.entries(compliance).map(([country, data]) => ({
      country,
      total: data.total,
      highRisk: data.highRisk,
      complianceRate: ((data.total - data.highRisk) / data.total) * 100
    }));
  }

  /**
   * Calculate device compliance
   */
  calculateDeviceCompliance(deviceData) {
    const compliance = {};
    
    deviceData.forEach(item => {
      if (!compliance[item.deviceType]) {
        compliance[item.deviceType] = { total: 0, mfaUsed: 0 };
      }
      compliance[item.deviceType].total++;
      if (item.mfaUsed) {
        compliance[item.deviceType].mfaUsed++;
      }
    });

    return Object.entries(compliance).map(([device, data]) => ({
      device,
      total: data.total,
      mfaUsed: data.mfaUsed,
      mfaRate: (data.mfaUsed / data.total) * 100
    }));
  }
}

export default new LoginAnalyticsService();
