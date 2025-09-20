import securityMonitoringService from '../services/securityMonitoringService.js';
import logger from '../utils/logger.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';

export const logSecurityEvent = async (req, res, next) => {
  try {
    const {
      type,
      severity,
      resource,
      action,
      outcome,
      details,
      risk_score
    } = req.body;

    if (!type || !action || !outcome) {
      throw new ValidationError('Type, action, and outcome are required');
    }

    const eventData = {
      type,
      severity: severity || 'low',
      userId: req.user?.id,
      sessionId: req.sessionID,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      resource,
      action,
      outcome,
      details: details || {},
      risk_score: risk_score || 0,
      location: req.headers['cf-ipcountry'] || 'Unknown'
    };

    const event = await securityMonitoringService.logSecurityEvent(eventData);

    res.status(201).json({
      success: true,
      data: {
        eventId: event.id,
        timestamp: event.timestamp,
        risk_score: event.risk_score
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getSecurityEvents = async (req, res, next) => {
  try {
    const { 
      type, 
      severity, 
      userId, 
      timeframe = 24, 
      limit = 50, 
      offset = 0 
    } = req.query;

    let events = Array.from(securityMonitoringService.securityEvents.values());

    // Apply filters
    if (type) {
      events = events.filter(event => event.type === type);
    }
    if (severity) {
      events = events.filter(event => event.severity === severity);
    }
    if (userId) {
      events = events.filter(event => event.userId === userId);
    }

    // Apply timeframe filter
    const since = new Date(Date.now() - (parseInt(timeframe) * 60 * 60 * 1000));
    events = events.filter(event => new Date(event.timestamp) >= since);

    // Sort by timestamp (newest first)
    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Apply pagination
    const paginatedEvents = events.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json({
      success: true,
      data: {
        events: paginatedEvents,
        total: events.length,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: events.length > (parseInt(offset) + parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getSecurityEvent = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    const event = securityMonitoringService.securityEvents.get(eventId);
    if (!event) {
      throw new NotFoundError('Security event not found');
    }

    res.json({
      success: true,
      data: event
    });
  } catch (error) {
    next(error);
  }
};

export const getThreatAlerts = async (req, res, next) => {
  try {
    const { 
      severity, 
      status = 'open', 
      timeframe = 24, 
      limit = 50, 
      offset = 0 
    } = req.query;

    let alerts = Array.from(securityMonitoringService.threatAlerts.values());

    // Apply filters
    if (severity) {
      alerts = alerts.filter(alert => alert.severity === severity);
    }
    if (status !== 'all') {
      alerts = alerts.filter(alert => alert.status === status);
    }

    // Apply timeframe filter
    const since = new Date(Date.now() - (parseInt(timeframe) * 60 * 60 * 1000));
    alerts = alerts.filter(alert => new Date(alert.timestamp) >= since);

    // Sort by severity and timestamp
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    alerts.sort((a, b) => {
      const severityDiff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
      if (severityDiff !== 0) return severityDiff;
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    // Apply pagination
    const paginatedAlerts = alerts.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json({
      success: true,
      data: {
        alerts: paginatedAlerts,
        total: alerts.length,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: alerts.length > (parseInt(offset) + parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const updateThreatAlert = async (req, res, next) => {
  try {
    const { alertId } = req.params;
    const { status, assignedTo, notes } = req.body;

    const alert = securityMonitoringService.threatAlerts.get(alertId);
    if (!alert) {
      throw new NotFoundError('Threat alert not found');
    }

    // Update alert
    if (status) alert.status = status;
    if (assignedTo) alert.assignedTo = assignedTo;
    if (notes) {
      alert.notes.push({
        timestamp: new Date(),
        userId: req.user.id,
        note: notes
      });
    }

    alert.updatedAt = new Date();
    alert.updatedBy = req.user.id;

    securityMonitoringService.threatAlerts.set(alertId, alert);

    logger.info('Threat alert updated', {
      alertId,
      updatedBy: req.user.id,
      changes: { status, assignedTo, hasNotes: !!notes }
    });

    res.json({
      success: true,
      data: alert
    });
  } catch (error) {
    next(error);
  }
};

export const getSuspiciousActivities = async (req, res, next) => {
  try {
    const { 
      status = 'under_review', 
      timeframe = 24, 
      limit = 50, 
      offset = 0 
    } = req.query;

    let activities = Array.from(securityMonitoringService.suspiciousActivities.values());

    // Apply filters
    if (status !== 'all') {
      activities = activities.filter(activity => activity.status === status);
    }

    // Apply timeframe filter
    const since = new Date(Date.now() - (parseInt(timeframe) * 60 * 60 * 1000));
    activities = activities.filter(activity => new Date(activity.timestamp) >= since);

    // Sort by risk score and timestamp
    activities.sort((a, b) => {
      const riskDiff = (b.risk_score || 0) - (a.risk_score || 0);
      if (riskDiff !== 0) return riskDiff;
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    // Apply pagination
    const paginatedActivities = activities.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json({
      success: true,
      data: {
        activities: paginatedActivities,
        total: activities.length,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: activities.length > (parseInt(offset) + parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const reviewSuspiciousActivity = async (req, res, next) => {
  try {
    const { activityId } = req.params;
    const { status, false_positive, notes } = req.body;

    const activity = securityMonitoringService.suspiciousActivities.get(activityId);
    if (!activity) {
      throw new NotFoundError('Suspicious activity not found');
    }

    // Update activity review
    if (status) activity.status = status;
    if (false_positive !== undefined) activity.false_positive = false_positive;
    
    activity.reviewed_by = req.user.id;
    activity.reviewed_at = new Date();
    
    if (notes) activity.notes = notes;

    securityMonitoringService.suspiciousActivities.set(activityId, activity);

    logger.info('Suspicious activity reviewed', {
      activityId,
      reviewedBy: req.user.id,
      status,
      false_positive
    });

    res.json({
      success: true,
      data: activity
    });
  } catch (error) {
    next(error);
  }
};

export const logAuditEvent = async (req, res, next) => {
  try {
    const {
      action,
      resource,
      resourceId,
      outcome,
      changes,
      metadata,
      compliance_tags
    } = req.body;

    if (!action || !resource || !outcome) {
      throw new ValidationError('Action, resource, and outcome are required');
    }

    const auditData = {
      userId: req.user?.id,
      userRole: req.user?.role,
      action,
      resource,
      resourceId,
      outcome,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      sessionId: req.sessionID,
      changes: changes || {},
      metadata: metadata || {},
      compliance_tags: compliance_tags || []
    };

    const audit = await securityMonitoringService.logAuditEvent(auditData);

    res.status(201).json({
      success: true,
      data: {
        auditId: audit.id,
        timestamp: audit.timestamp
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getAuditLogs = async (req, res, next) => {
  try {
    const { 
      userId, 
      resource, 
      action, 
      outcome, 
      timeframe = 24, 
      limit = 50, 
      offset = 0 
    } = req.query;

    let logs = Array.from(securityMonitoringService.auditLogs.values());

    // Apply filters
    if (userId) {
      logs = logs.filter(log => log.userId === userId);
    }
    if (resource) {
      logs = logs.filter(log => log.resource === resource);
    }
    if (action) {
      logs = logs.filter(log => log.action === action);
    }
    if (outcome) {
      logs = logs.filter(log => log.outcome === outcome);
    }

    // Apply timeframe filter
    const since = new Date(Date.now() - (parseInt(timeframe) * 60 * 60 * 1000));
    logs = logs.filter(log => new Date(log.timestamp) >= since);

    // Sort by timestamp (newest first)
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Apply pagination
    const paginatedLogs = logs.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json({
      success: true,
      data: {
        logs: paginatedLogs,
        total: logs.length,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: logs.length > (parseInt(offset) + parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getSecurityDashboard = async (req, res, next) => {
  try {
    const { timeframe = 24 } = req.query;

    const dashboard = securityMonitoringService.getSecurityDashboard(parseInt(timeframe));

    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    next(error);
  }
};

export const getThreatIntelligence = async (req, res, next) => {
  try {
    const report = securityMonitoringService.getThreatIntelligenceReport();

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

export const getSecurityMetrics = async (req, res, next) => {
  try {
    const { period = 'day' } = req.query; // day, week, month

    const timeframes = {
      day: 24,
      week: 24 * 7,
      month: 24 * 30
    };

    const hours = timeframes[period] || 24;
    const since = new Date(Date.now() - (hours * 60 * 60 * 1000));

    const events = Array.from(securityMonitoringService.securityEvents.values())
      .filter(event => new Date(event.timestamp) >= since);

    const alerts = Array.from(securityMonitoringService.threatAlerts.values())
      .filter(alert => new Date(alert.timestamp) >= since);

    const metrics = {
      period,
      timeframe: `${hours} hours`,
      metrics: {
        total_events: events.length,
        security_alerts: alerts.length,
        critical_alerts: alerts.filter(a => a.severity === 'critical').length,
        blocked_attacks: events.filter(e => e.outcome === 'blocked').length,
        failed_authentications: events.filter(e => e.type === 'authentication' && e.outcome === 'failure').length,
        data_access_events: events.filter(e => e.type === 'data_access').length,
        average_risk_score: events.length > 0 ? 
          events.reduce((sum, e) => sum + (e.risk_score || 0), 0) / events.length : 0
      },
      trends: {
        events_trend: calculateTrend(events, 'events'),
        alerts_trend: calculateTrend(alerts, 'alerts'),
        risk_trend: calculateRiskTrend(events)
      }
    };

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    next(error);
  }
};

export const exportSecurityReport = async (req, res, next) => {
  try {
    const { 
      format = 'json', 
      timeframe = 24, 
      include_events = true, 
      include_alerts = true, 
      include_audit = false 
    } = req.query;

    const since = new Date(Date.now() - (parseInt(timeframe) * 60 * 60 * 1000));
    const report = {
      generated_at: new Date().toISOString(),
      timeframe: `${timeframe} hours`,
      report_includes: {
        events: include_events === 'true',
        alerts: include_alerts === 'true',
        audit_logs: include_audit === 'true'
      },
      data: {}
    };

    if (include_events === 'true') {
      report.data.security_events = Array.from(securityMonitoringService.securityEvents.values())
        .filter(event => new Date(event.timestamp) >= since);
    }

    if (include_alerts === 'true') {
      report.data.threat_alerts = Array.from(securityMonitoringService.threatAlerts.values())
        .filter(alert => new Date(alert.timestamp) >= since);
    }

    if (include_audit === 'true') {
      report.data.audit_logs = Array.from(securityMonitoringService.auditLogs.values())
        .filter(log => new Date(log.timestamp) >= since);
    }

    // Set appropriate content type and headers
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="security-report-${Date.now()}.csv"`);
      // Convert to CSV format (simplified)
      res.send('CSV export not implemented in demo');
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="security-report-${Date.now()}.json"`);
      res.json(report);
    }
  } catch (error) {
    next(error);
  }
};

// Helper method for trend calculation
function calculateTrend(items, type) {
  // Simple trend calculation - could be more sophisticated
  const now = Date.now();
  const halfPeriod = 12 * 60 * 60 * 1000; // 12 hours

  const recent = items.filter(item => 
    (now - new Date(item.timestamp).getTime()) < halfPeriod
  ).length;

  const previous = items.filter(item => {
    const age = now - new Date(item.timestamp).getTime();
    return age >= halfPeriod && age < (halfPeriod * 2);
  }).length;

  if (previous === 0) return recent > 0 ? 'increasing' : 'stable';
  
  const change = ((recent - previous) / previous) * 100;
  
  if (Math.abs(change) < 10) return 'stable';
  return change > 0 ? 'increasing' : 'decreasing';
}

function calculateRiskTrend(events) {
  const now = Date.now();
  const halfPeriod = 12 * 60 * 60 * 1000;

  const recentEvents = events.filter(event => 
    (now - new Date(event.timestamp).getTime()) < halfPeriod
  );
  const previousEvents = events.filter(event => {
    const age = now - new Date(event.timestamp).getTime();
    return age >= halfPeriod && age < (halfPeriod * 2);
  });

  const recentRisk = recentEvents.length > 0 ? 
    recentEvents.reduce((sum, e) => sum + (e.risk_score || 0), 0) / recentEvents.length : 0;
  const previousRisk = previousEvents.length > 0 ? 
    previousEvents.reduce((sum, e) => sum + (e.risk_score || 0), 0) / previousEvents.length : 0;

  if (previousRisk === 0) return recentRisk > 0 ? 'increasing' : 'stable';
  
  const change = ((recentRisk - previousRisk) / previousRisk) * 100;
  
  if (Math.abs(change) < 10) return 'stable';
  return change > 0 ? 'increasing' : 'decreasing';
}

export default {
  logSecurityEvent,
  getSecurityEvents,
  getSecurityEvent,
  getThreatAlerts,
  updateThreatAlert,
  getSuspiciousActivities,
  reviewSuspiciousActivity,
  logAuditEvent,
  getAuditLogs,
  getSecurityDashboard,
  getThreatIntelligence,
  getSecurityMetrics,
  exportSecurityReport
};
