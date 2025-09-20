import loginAnalyticsService from '../services/loginAnalyticsService.js';
import LoginSession from '../models/LoginSession.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import mongoose from 'mongoose';

// Get comprehensive login analytics
export const getLoginAnalytics = catchAsync(async (req, res) => {
  const { dateRange, groupBy } = req.query;
  
  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }
  if (groupBy) options.groupBy = groupBy;

  const analytics = await loginAnalyticsService.getLoginAnalytics(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: analytics
  });
});

// Get login patterns and trends
export const getLoginPatterns = catchAsync(async (req, res) => {
  const { dateRange, patternType } = req.query;
  
  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }
  if (patternType) options.patternType = patternType;

  const patterns = await loginAnalyticsService.getLoginPatterns(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: patterns
  });
});

// Get security metrics and threat analysis
export const getSecurityMetrics = catchAsync(async (req, res) => {
  const { dateRange } = req.query;
  
  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }

  const metrics = await loginAnalyticsService.getSecurityMetrics(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: metrics
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

  const analysis = await loginAnalyticsService.getUserBehaviorAnalysis(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: analysis
  });
});

// Get compliance reporting
export const getComplianceReport = catchAsync(async (req, res) => {
  const { dateRange, complianceType } = req.query;
  
  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }
  if (complianceType) options.complianceType = complianceType;

  const report = await loginAnalyticsService.getComplianceReport(req.user.hotelId, options);

  res.json({
    status: 'success',
    data: report
  });
});

// Get active sessions
export const getActiveSessions = catchAsync(async (req, res) => {
  const { userId, minRiskScore, limit = 50 } = req.query;
  
  const options = {};
  if (userId) options.userId = userId;
  if (minRiskScore) options.minRiskScore = parseInt(minRiskScore);

  const sessions = await LoginSession.getActiveSessions(req.user.hotelId, options)
    .limit(parseInt(limit));

  res.json({
    status: 'success',
    results: sessions.length,
    data: { sessions }
  });
});

// Get session details
export const getSessionDetails = catchAsync(async (req, res) => {
  const { sessionId } = req.params;

  const session = await LoginSession.findOne({
    sessionId,
    hotelId: req.user.hotelId
  }).populate('userId', 'name email role');

  if (!session) {
    throw new ApplicationError('Session not found', 404);
  }

  res.json({
    status: 'success',
    data: { session }
  });
});

// End session
export const endSession = catchAsync(async (req, res) => {
  const { sessionId } = req.params;

  const session = await LoginSession.findOne({
    sessionId,
    hotelId: req.user.hotelId
  });

  if (!session) {
    throw new ApplicationError('Session not found', 404);
  }

  if (!session.isActive) {
    throw new ApplicationError('Session is already ended', 400);
  }

  await session.endSession();

  // Log the session end
  await AuditLog.create({
    user: {
      _id: session.userId,
      name: 'System',
      email: 'system@hotel.com',
      role: 'system'
    },
    action: 'session_ended',
    details: `Session ended for user ${session.userId}`,
    timestamp: new Date(),
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.json({
    status: 'success',
    message: 'Session ended successfully',
    data: { session }
  });
});

// Get suspicious sessions
export const getSuspiciousSessions = catchAsync(async (req, res) => {
  const { limit = 20 } = req.query;

  const sessions = await LoginSession.detectSuspiciousSessions(req.user.hotelId, {
    limit: parseInt(limit)
  });

  res.json({
    status: 'success',
    results: sessions.length,
    data: { sessions }
  });
});

// Update session risk score
export const updateSessionRiskScore = catchAsync(async (req, res) => {
  const { sessionId } = req.params;
  const { riskScore, reason } = req.body;

  if (riskScore < 0 || riskScore > 100) {
    throw new ApplicationError('Risk score must be between 0 and 100', 400);
  }

  const session = await LoginSession.findOne({
    sessionId,
    hotelId: req.user.hotelId
  });

  if (!session) {
    throw new ApplicationError('Session not found', 404);
  }

  session.riskScore = riskScore;
  if (reason) {
    session.securityFlags.push('manual_review');
  }
  await session.save();

  // Log the risk score update
  await AuditLog.create({
    user: {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role
    },
    action: 'risk_score_updated',
    details: `Risk score updated to ${riskScore} for session ${sessionId}. Reason: ${reason || 'Manual review'}`,
    timestamp: new Date(),
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.json({
    status: 'success',
    message: 'Risk score updated successfully',
    data: { session }
  });
});

// Add security flag to session
export const addSecurityFlag = catchAsync(async (req, res) => {
  const { sessionId } = req.params;
  const { flag, reason } = req.body;

  const validFlags = [
    'suspicious_ip',
    'unusual_location',
    'multiple_devices',
    'rapid_logins',
    'failed_attempts',
    'privilege_escalation',
    'data_breach_attempt',
    'bot_detected',
    'vpn_detected',
    'tor_detected',
    'manual_review'
  ];

  if (!validFlags.includes(flag)) {
    throw new ApplicationError('Invalid security flag', 400);
  }

  const session = await LoginSession.findOne({
    sessionId,
    hotelId: req.user.hotelId
  });

  if (!session) {
    throw new ApplicationError('Session not found', 404);
  }

  await session.addSecurityFlag(flag);

  // Log the security flag addition
  await AuditLog.create({
    user: {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role
    },
    action: 'security_flag_added',
    details: `Security flag '${flag}' added to session ${sessionId}. Reason: ${reason || 'Manual review'}`,
    timestamp: new Date(),
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.json({
    status: 'success',
    message: 'Security flag added successfully',
    data: { session }
  });
});

// Get session history for user
export const getUserSessionHistory = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 20, dateRange } = req.query;

  const query = {
    userId: new mongoose.Types.ObjectId(userId),
    hotelId: req.user.hotelId
  };

  if (dateRange) {
    try {
      const range = JSON.parse(dateRange);
      query.loginTime = {
        $gte: new Date(range.start),
        $lte: new Date(range.end)
      };
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }

  const skip = (page - 1) * limit;

  const [sessions, total] = await Promise.all([
    LoginSession.find(query)
      .sort({ loginTime: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    LoginSession.countDocuments(query)
  ]);

  res.json({
    status: 'success',
    results: sessions.length,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total,
      limit: parseInt(limit)
    },
    data: { sessions }
  });
});

// Get real-time login monitoring
export const getRealTimeMonitoring = catchAsync(async (req, res) => {
  const { timeWindow = 300 } = req.query; // 5 minutes default

  const timeThreshold = new Date(Date.now() - (timeWindow * 1000));

  const pipeline = [
    {
      $match: {
        hotelId: req.user.hotelId,
        loginTime: { $gte: timeThreshold }
      }
    },
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
        totalLogins: { $sum: 1 },
        activeSessions: { $sum: { $cond: ['$isActive', 1, 0] } },
        highRiskSessions: { $sum: { $cond: [{ $gt: ['$riskScore', 70] }, 1, 0] } },
        uniqueUsers: { $addToSet: '$userId' },
        uniqueIPs: { $addToSet: '$ipAddress' },
        recentLogins: {
          $push: {
            userId: '$userId',
            userName: '$user.name',
            userEmail: '$user.email',
            loginTime: '$loginTime',
            ipAddress: '$ipAddress',
            riskScore: '$riskScore',
            securityFlags: '$securityFlags',
            deviceInfo: '$deviceInfo',
            locationInfo: '$locationInfo'
          }
        }
      }
    }
  ];

  const [monitoringData, suspiciousActivities] = await Promise.all([
    LoginSession.aggregate(pipeline),
    AuditLog.find({
      'user.hotelId': req.user.hotelId,
      timestamp: { $gte: timeThreshold },
      action: { $in: ['failed_login', 'suspicious_activity', 'security_alert'] }
    }).sort({ timestamp: -1 }).limit(10)
  ]);

  const result = monitoringData[0] || {
    totalLogins: 0,
    activeSessions: 0,
    highRiskSessions: 0,
    uniqueUsers: [],
    uniqueIPs: [],
    recentLogins: []
  };

  res.json({
    status: 'success',
    data: {
      ...result,
      uniqueUserCount: result.uniqueUsers.length,
      uniqueIPCount: result.uniqueIPs.length,
      suspiciousActivities,
      timeWindow: parseInt(timeWindow)
    }
  });
});

// Export login analytics
export const exportLoginAnalytics = catchAsync(async (req, res) => {
  const { format = 'json', dateRange } = req.query;
  
  const options = {};
  if (dateRange) {
    try {
      options.dateRange = JSON.parse(dateRange);
    } catch (error) {
      throw new ApplicationError('Invalid date range format', 400);
    }
  }

  const analytics = await loginAnalyticsService.getLoginAnalytics(req.user.hotelId, options);

  if (format === 'csv') {
    const csvData = convertAnalyticsToCSV(analytics);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=login_analytics.csv');
    res.send(csvData);
  } else {
    res.json({
      status: 'success',
      data: analytics
    });
  }
});

// Get security alerts
export const getSecurityAlerts = catchAsync(async (req, res) => {
  const { severity, limit = 50 } = req.query;

  const matchStage = {
    'user.hotelId': req.user.hotelId,
    action: { $in: ['security_alert', 'suspicious_activity', 'failed_login', 'privilege_escalation'] }
  };

  if (severity) {
    matchStage.severity = severity;
  }

  const alerts = await AuditLog.find(matchStage)
    .populate('user', 'name email role')
    .sort({ timestamp: -1 })
    .limit(parseInt(limit));

  res.json({
    status: 'success',
    results: alerts.length,
    data: { alerts }
  });
});

// Helper function to convert analytics to CSV
function convertAnalyticsToCSV(analytics) {
  const headers = [
    'Metric',
    'Value',
    'Percentage'
  ];
  
  const rows = [
    ['Total Logins', analytics.totalLogins, '100%'],
    ['Active Sessions', analytics.activeSessions, `${((analytics.activeSessions / analytics.totalLogins) * 100).toFixed(1)}%`],
    ['High Risk Sessions', analytics.highRiskSessions, `${((analytics.highRiskSessions / analytics.totalLogins) * 100).toFixed(1)}%`],
    ['MFA Sessions', analytics.mfaSessions, `${analytics.mfaRate.toFixed(1)}%`],
    ['Unique Users', analytics.uniqueUserCount, `${((analytics.uniqueUserCount / analytics.totalLogins) * 100).toFixed(1)}%`],
    ['Unique IPs', analytics.uniqueIPCount, `${((analytics.uniqueIPCount / analytics.totalLogins) * 100).toFixed(1)}%`]
  ];
  
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

export default {
  getLoginAnalytics,
  getLoginPatterns,
  getSecurityMetrics,
  getUserBehaviorAnalysis,
  getComplianceReport,
  getActiveSessions,
  getSessionDetails,
  endSession,
  getSuspiciousSessions,
  updateSessionRiskScore,
  addSecurityFlag,
  getUserSessionHistory,
  getRealTimeMonitoring,
  exportLoginAnalytics,
  getSecurityAlerts
};
