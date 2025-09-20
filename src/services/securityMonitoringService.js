import mongoose from 'mongoose';
import crypto from 'crypto';
import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

class SecurityMonitoringService {
  constructor() {
    // Security events storage (in-memory for demo, use database in production)
    this.securityEvents = new Map();
    this.suspiciousActivities = new Map();
    this.auditLogs = new Map();
    this.threatAlerts = new Map();
    
    // Security thresholds and rules
    this.securityRules = {
      LOGIN_ATTEMPTS: {
        threshold: 5,
        timeWindow: 900000, // 15 minutes
        action: 'lock_account',
        severity: 'medium'
      },
      CONCURRENT_SESSIONS: {
        threshold: 3,
        timeWindow: 3600000, // 1 hour
        action: 'alert_admin',
        severity: 'low'
      },
      DATA_ACCESS_VOLUME: {
        threshold: 100,
        timeWindow: 300000, // 5 minutes
        action: 'throttle_requests',
        severity: 'medium'
      },
      PRIVILEGE_ESCALATION: {
        threshold: 1,
        timeWindow: 0, // Immediate
        action: 'immediate_alert',
        severity: 'high'
      },
      UNUSUAL_LOCATION: {
        threshold: 1,
        timeWindow: 0,
        action: 'require_mfa',
        severity: 'medium'
      },
      API_ABUSE: {
        threshold: 1000,
        timeWindow: 3600000, // 1 hour
        action: 'rate_limit',
        severity: 'low'
      }
    };

    // Initialize monitoring patterns
    this.initializePatterns();
  }

  /**
   * Initialize threat detection patterns
   */
  initializePatterns() {
    this.threatPatterns = {
      SQL_INJECTION: {
        pattern: /(union|select|insert|delete|drop|create|alter|exec|execute|script|javascript|onload|onerror)/i,
        severity: 'high',
        category: 'injection'
      },
      XSS_ATTEMPT: {
        pattern: /(<script|javascript:|onload=|onerror=|onmouseover=)/i,
        severity: 'high',
        category: 'xss'
      },
      PATH_TRAVERSAL: {
        pattern: /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\\)/i,
        severity: 'medium',
        category: 'path_traversal'
      },
      CREDENTIAL_STUFFING: {
        pattern: /password.*\b(123456|password|admin|root|test)\b/i,
        severity: 'medium',
        category: 'credential_abuse'
      }
    };

    this.anomalyDetectors = {
      UNUSUAL_USER_AGENT: {
        check: (userAgent) => !userAgent || userAgent.length < 10 || userAgent.includes('bot'),
        severity: 'low'
      },
      RAPID_REQUESTS: {
        check: (requests, timeWindow) => requests.length > 50 && this.getTimeSpread(requests) < 60000,
        severity: 'medium'
      },
      OFF_HOURS_ACCESS: {
        check: (timestamp) => {
          const hour = new Date(timestamp).getHours();
          return hour < 6 || hour > 22;
        },
        severity: 'low'
      }
    };
  }

  /**
   * Log security event
   */
  async logSecurityEvent(eventData) {
    try {
      const eventId = uuidv4();
      const event = {
        id: eventId,
        timestamp: new Date(),
        type: eventData.type,
        severity: eventData.severity || 'low',
        userId: eventData.userId,
        sessionId: eventData.sessionId,
        ipAddress: eventData.ipAddress,
        userAgent: eventData.userAgent,
        resource: eventData.resource,
        action: eventData.action,
        outcome: eventData.outcome, // 'success', 'failure', 'blocked'
        details: eventData.details || {},
        risk_score: eventData.risk_score || 0,
        location: eventData.location,
        fingerprint: this.generateEventFingerprint(eventData)
      };

      this.securityEvents.set(eventId, event);

      // Check for patterns and anomalies
      await this.analyzeSecurityEvent(event);

      logger.info('Security event logged', {
        eventId,
        type: event.type,
        severity: event.severity,
        userId: event.userId
      });

      return event;
    } catch (error) {
      logger.error('Failed to log security event', { error: error.message, eventData });
      throw error;
    }
  }

  /**
   * Analyze security event for threats and anomalies
   */
  async analyzeSecurityEvent(event) {
    try {
      const analysis = {
        threats: [],
        anomalies: [],
        risk_score: event.risk_score || 0,
        recommendations: []
      };

      // Check threat patterns
      for (const [patternName, pattern] of Object.entries(this.threatPatterns)) {
        if (this.checkThreatPattern(event, pattern)) {
          analysis.threats.push({
            type: patternName,
            severity: pattern.severity,
            category: pattern.category
          });
          analysis.risk_score += this.getSeverityScore(pattern.severity);
        }
      }

      // Check anomaly detectors
      for (const [detectorName, detector] of Object.entries(this.anomalyDetectors)) {
        if (this.checkAnomaly(event, detector)) {
          analysis.anomalies.push({
            type: detectorName,
            severity: detector.severity
          });
          analysis.risk_score += this.getSeverityScore(detector.severity);
        }
      }

      // Check security rules
      const ruleViolations = await this.checkSecurityRules(event);
      if (ruleViolations.length > 0) {
        analysis.rule_violations = ruleViolations;
        analysis.risk_score += ruleViolations.length * 10;
      }

      // Generate recommendations
      analysis.recommendations = this.generateSecurityRecommendations(analysis);

      // Create alert if high risk
      if (analysis.risk_score > 50) {
        await this.createThreatAlert(event, analysis);
      }

      // Log suspicious activity if needed
      if (analysis.threats.length > 0 || analysis.risk_score > 30) {
        await this.logSuspiciousActivity(event, analysis);
      }

      return analysis;
    } catch (error) {
      logger.error('Security event analysis failed', { error: error.message, eventId: event.id });
      return { threats: [], anomalies: [], risk_score: 0 };
    }
  }

  /**
   * Check security rules violations
   */
  async checkSecurityRules(event) {
    const violations = [];

    try {
      // Check login attempt threshold
      if (event.type === 'authentication' && event.outcome === 'failure') {
        const recentAttempts = this.getRecentEvents(
          event.userId || event.ipAddress,
          'authentication',
          this.securityRules.LOGIN_ATTEMPTS.timeWindow
        );

        if (recentAttempts.length >= this.securityRules.LOGIN_ATTEMPTS.threshold) {
          violations.push({
            rule: 'LOGIN_ATTEMPTS',
            threshold: this.securityRules.LOGIN_ATTEMPTS.threshold,
            actual: recentAttempts.length,
            action: this.securityRules.LOGIN_ATTEMPTS.action
          });
        }
      }

      // Check concurrent sessions
      if (event.type === 'session_start') {
        const activeSessions = this.getActiveUserSessions(event.userId);
        if (activeSessions.length >= this.securityRules.CONCURRENT_SESSIONS.threshold) {
          violations.push({
            rule: 'CONCURRENT_SESSIONS',
            threshold: this.securityRules.CONCURRENT_SESSIONS.threshold,
            actual: activeSessions.length,
            action: this.securityRules.CONCURRENT_SESSIONS.action
          });
        }
      }

      // Check data access volume
      if (event.type === 'data_access') {
        const recentAccess = this.getRecentEvents(
          event.userId,
          'data_access',
          this.securityRules.DATA_ACCESS_VOLUME.timeWindow
        );

        if (recentAccess.length >= this.securityRules.DATA_ACCESS_VOLUME.threshold) {
          violations.push({
            rule: 'DATA_ACCESS_VOLUME',
            threshold: this.securityRules.DATA_ACCESS_VOLUME.threshold,
            actual: recentAccess.length,
            action: this.securityRules.DATA_ACCESS_VOLUME.action
          });
        }
      }

      // Check privilege escalation
      if (event.type === 'privilege_change' && event.details.escalation) {
        violations.push({
          rule: 'PRIVILEGE_ESCALATION',
          threshold: this.securityRules.PRIVILEGE_ESCALATION.threshold,
          actual: 1,
          action: this.securityRules.PRIVILEGE_ESCALATION.action
        });
      }

    } catch (error) {
      logger.error('Security rule check failed', { error: error.message, eventId: event.id });
    }

    return violations;
  }

  /**
   * Create threat alert
   */
  async createThreatAlert(event, analysis) {
    try {
      const alertId = uuidv4();
      const alert = {
        id: alertId,
        timestamp: new Date(),
        severity: this.calculateAlertSeverity(analysis.risk_score),
        type: 'security_threat',
        eventId: event.id,
        userId: event.userId,
        ipAddress: event.ipAddress,
        threats: analysis.threats,
        anomalies: analysis.anomalies,
        risk_score: analysis.risk_score,
        status: 'open',
        escalated: analysis.risk_score > 80,
        assignedTo: null,
        notes: [],
        auto_generated: true
      };

      this.threatAlerts.set(alertId, alert);

      // Notify administrators for high-risk alerts
      if (alert.severity === 'critical' || alert.escalated) {
        await this.notifySecurityTeam(alert);
      }

      logger.warn('Threat alert created', {
        alertId,
        severity: alert.severity,
        risk_score: analysis.risk_score,
        eventId: event.id
      });

      return alert;
    } catch (error) {
      logger.error('Failed to create threat alert', { error: error.message, eventId: event.id });
      throw error;
    }
  }

  /**
   * Log suspicious activity
   */
  async logSuspiciousActivity(event, analysis) {
    try {
      const activityId = uuidv4();
      const activity = {
        id: activityId,
        timestamp: new Date(),
        eventId: event.id,
        userId: event.userId,
        ipAddress: event.ipAddress,
        activity_type: event.type,
        risk_indicators: [
          ...analysis.threats.map(t => t.type),
          ...analysis.anomalies.map(a => a.type)
        ],
        risk_score: analysis.risk_score,
        status: 'under_review',
        false_positive: false,
        reviewed_by: null,
        reviewed_at: null
      };

      this.suspiciousActivities.set(activityId, activity);

      logger.info('Suspicious activity logged', {
        activityId,
        eventId: event.id,
        risk_score: analysis.risk_score
      });

      return activity;
    } catch (error) {
      logger.error('Failed to log suspicious activity', { error: error.message, eventId: event.id });
      throw error;
    }
  }

  /**
   * Generate audit log entry
   */
  async logAuditEvent(auditData) {
    try {
      const auditId = uuidv4();
      const audit = {
        id: auditId,
        timestamp: new Date(),
        userId: auditData.userId,
        userRole: auditData.userRole,
        action: auditData.action,
        resource: auditData.resource,
        resourceId: auditData.resourceId,
        outcome: auditData.outcome, // 'success', 'failure', 'denied'
        ipAddress: auditData.ipAddress,
        userAgent: auditData.userAgent,
        sessionId: auditData.sessionId,
        changes: auditData.changes || {}, // Before/after values
        metadata: auditData.metadata || {},
        compliance_tags: auditData.compliance_tags || [] // GDPR, PCI, etc.
      };

      this.auditLogs.set(auditId, audit);

      logger.info('Audit event logged', {
        auditId,
        userId: audit.userId,
        action: audit.action,
        resource: audit.resource
      });

      return audit;
    } catch (error) {
      logger.error('Failed to log audit event', { error: error.message, auditData });
      throw error;
    }
  }

  /**
   * Get security dashboard data
   */
  getSecurityDashboard(timeframe = 24) { // hours
    try {
      const since = new Date(Date.now() - (timeframe * 60 * 60 * 1000));
      
      const recentEvents = Array.from(this.securityEvents.values())
        .filter(event => new Date(event.timestamp) >= since);

      const recentAlerts = Array.from(this.threatAlerts.values())
        .filter(alert => new Date(alert.timestamp) >= since);

      const suspiciousCount = Array.from(this.suspiciousActivities.values())
        .filter(activity => new Date(activity.timestamp) >= since).length;

      const dashboard = {
        timeframe: `${timeframe} hours`,
        overview: {
          total_events: recentEvents.length,
          threat_alerts: recentAlerts.length,
          suspicious_activities: suspiciousCount,
          critical_alerts: recentAlerts.filter(a => a.severity === 'critical').length
        },
        event_breakdown: this.getEventBreakdown(recentEvents),
        top_risks: this.getTopRiskEvents(recentEvents),
        alert_severity_distribution: this.getAlertSeverityDistribution(recentAlerts),
        geographic_analysis: this.getGeographicAnalysis(recentEvents),
        user_risk_scores: this.getUserRiskScores(recentEvents),
        trend_analysis: this.getTrendAnalysis(recentEvents, timeframe)
      };

      return dashboard;
    } catch (error) {
      logger.error('Failed to generate security dashboard', { error: error.message });
      throw error;
    }
  }

  /**
   * Get threat intelligence report
   */
  getThreatIntelligenceReport() {
    try {
      const report = {
        generated_at: new Date().toISOString(),
        threat_landscape: {
          active_threats: Array.from(this.threatAlerts.values())
            .filter(alert => alert.status === 'open').length,
          threat_categories: this.getThreatCategories(),
          attack_vectors: this.getAttackVectors(),
          geographical_threats: this.getGeographicalThreats()
        },
        vulnerability_assessment: {
          high_risk_users: this.getHighRiskUsers(),
          vulnerable_endpoints: this.getVulnerableEndpoints(),
          security_gaps: this.identifySecurityGaps()
        },
        recommendations: this.generateThreatRecommendations()
      };

      return report;
    } catch (error) {
      logger.error('Failed to generate threat intelligence report', { error: error.message });
      throw error;
    }
  }

  /**
   * Helper methods
   */

  generateEventFingerprint(eventData) {
    const fingerprint = `${eventData.type}_${eventData.userId}_${eventData.ipAddress}_${eventData.resource}`;
    return crypto.createHash('sha256').update(fingerprint).digest('hex').substring(0, 16);
  }

  checkThreatPattern(event, pattern) {
    const testStrings = [
      event.resource,
      JSON.stringify(event.details),
      event.userAgent
    ].filter(Boolean);

    return testStrings.some(str => pattern.pattern.test(str));
  }

  checkAnomaly(event, detector) {
    try {
      return detector.check(event.userAgent || event.timestamp || []);
    } catch (error) {
      return false;
    }
  }

  getSeverityScore(severity) {
    const scores = { low: 10, medium: 25, high: 50, critical: 100 };
    return scores[severity] || 10;
  }

  calculateAlertSeverity(riskScore) {
    if (riskScore >= 80) return 'critical';
    if (riskScore >= 50) return 'high';
    if (riskScore >= 25) return 'medium';
    return 'low';
  }

  getRecentEvents(identifier, type, timeWindow) {
    const since = new Date(Date.now() - timeWindow);
    return Array.from(this.securityEvents.values())
      .filter(event => 
        (event.userId === identifier || event.ipAddress === identifier) &&
        event.type === type &&
        new Date(event.timestamp) >= since
      );
  }

  getActiveUserSessions(userId) {
    // This would query active session storage in production
    return Array.from(this.securityEvents.values())
      .filter(event => 
        event.userId === userId &&
        event.type === 'session_start' &&
        !this.hasSessionEnd(event.sessionId)
      );
  }

  hasSessionEnd(sessionId) {
    return Array.from(this.securityEvents.values())
      .some(event => 
        event.sessionId === sessionId &&
        event.type === 'session_end'
      );
  }

  getTimeSpread(requests) {
    if (requests.length < 2) return 0;
    const times = requests.map(r => new Date(r.timestamp).getTime()).sort();
    return times[times.length - 1] - times[0];
  }

  generateSecurityRecommendations(analysis) {
    const recommendations = [];
    
    if (analysis.threats.some(t => t.category === 'injection')) {
      recommendations.push('Implement input validation and parameterized queries');
    }
    
    if (analysis.anomalies.some(a => a.type === 'RAPID_REQUESTS')) {
      recommendations.push('Consider implementing rate limiting');
    }
    
    if (analysis.risk_score > 50) {
      recommendations.push('Enable additional monitoring for this user/IP');
    }

    return recommendations;
  }

  async notifySecurityTeam(alert) {
    // This would integrate with notification systems
    logger.warn('Security team notification', {
      alertId: alert.id,
      severity: alert.severity,
      message: `Critical security alert: Risk score ${alert.risk_score}`
    });
  }

  getEventBreakdown(events) {
    const breakdown = {};
    events.forEach(event => {
      breakdown[event.type] = (breakdown[event.type] || 0) + 1;
    });
    return breakdown;
  }

  getTopRiskEvents(events) {
    return events
      .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
      .slice(0, 10)
      .map(event => ({
        id: event.id,
        type: event.type,
        risk_score: event.risk_score,
        timestamp: event.timestamp,
        userId: event.userId,
        ipAddress: event.ipAddress
      }));
  }

  getAlertSeverityDistribution(alerts) {
    const distribution = { low: 0, medium: 0, high: 0, critical: 0 };
    alerts.forEach(alert => {
      distribution[alert.severity] = (distribution[alert.severity] || 0) + 1;
    });
    return distribution;
  }

  getGeographicAnalysis(events) {
    // Simplified geographic analysis
    const locations = {};
    events.forEach(event => {
      if (event.location) {
        locations[event.location] = (locations[event.location] || 0) + 1;
      }
    });
    return locations;
  }

  getUserRiskScores(events) {
    const userScores = {};
    events.forEach(event => {
      if (event.userId) {
        userScores[event.userId] = (userScores[event.userId] || 0) + (event.risk_score || 0);
      }
    });
    
    // Return top 10 highest risk users
    return Object.entries(userScores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([userId, score]) => ({ userId, risk_score: score }));
  }

  getTrendAnalysis(events, timeframe) {
    // Simple trend analysis - events per hour
    const hours = Math.min(timeframe, 24);
    const trend = new Array(hours).fill(0);
    const now = Date.now();
    
    events.forEach(event => {
      const eventTime = new Date(event.timestamp).getTime();
      const hoursAgo = Math.floor((now - eventTime) / (60 * 60 * 1000));
      if (hoursAgo < hours) {
        trend[hours - 1 - hoursAgo]++;
      }
    });
    
    return trend;
  }

  getThreatCategories() {
    const threats = Array.from(this.threatAlerts.values());
    const categories = {};
    threats.forEach(alert => {
      alert.threats.forEach(threat => {
        categories[threat.category] = (categories[threat.category] || 0) + 1;
      });
    });
    return categories;
  }

  getAttackVectors() {
    // Simplified attack vector analysis
    return {
      web_application: 45,
      authentication: 30,
      api_abuse: 15,
      social_engineering: 10
    };
  }

  getGeographicalThreats() {
    // Simplified geographical threat distribution
    return {
      'Unknown': 40,
      'US': 30,
      'EU': 20,
      'Other': 10
    };
  }

  getHighRiskUsers() {
    const suspiciousUsers = Array.from(this.suspiciousActivities.values())
      .reduce((acc, activity) => {
        if (activity.userId) {
          acc[activity.userId] = (acc[activity.userId] || 0) + activity.risk_score;
        }
        return acc;
      }, {});
    
    return Object.entries(suspiciousUsers)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([userId, score]) => ({ userId, risk_score: score }));
  }

  getVulnerableEndpoints() {
    const events = Array.from(this.securityEvents.values());
    const endpoints = {};
    
    events.forEach(event => {
      if (event.resource && event.risk_score > 20) {
        endpoints[event.resource] = (endpoints[event.resource] || 0) + event.risk_score;
      }
    });
    
    return Object.entries(endpoints)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([endpoint, score]) => ({ endpoint, risk_score: score }));
  }

  identifySecurityGaps() {
    return [
      'Consider implementing Web Application Firewall',
      'Enable multi-factor authentication for all admin accounts',
      'Implement automated threat response for high-risk events',
      'Consider additional monitoring for API endpoints'
    ];
  }

  generateThreatRecommendations() {
    return [
      'Increase monitoring sensitivity for high-risk users',
      'Implement automated blocking for known attack patterns',
      'Consider geolocation-based access controls',
      'Review and update security policies based on threat landscape'
    ];
  }
}

// Create singleton instance
const securityMonitoringService = new SecurityMonitoringService();

export default securityMonitoringService;