import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

// Error analytics and reporting service
class ErrorReportingService {
  constructor() {
    this.errorDatabase = new Map(); // In production, this would be a proper database
    this.alertThresholds = {
      errorRatePerMinute: 10,
      criticalErrorsPerMinute: 3,
      uniqueErrorsPerHour: 20,
      consecutiveErrors: 5
    };
    this.recentErrors = [];
    this.errorPatterns = new Map();
    this.alertingSuppression = new Map();
  }

  /**
   * Report an error with full context
   */
  async reportError(error, context = {}) {
    const errorReport = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code,
        statusCode: error.statusCode
      },
      context: {
        userId: context.userId,
        userRole: context.userRole,
        hotelId: context.hotelId,
        correlationId: context.correlationId,
        requestId: context.requestId,
        endpoint: context.endpoint,
        method: context.method,
        userAgent: context.userAgent,
        ip: context.ip,
        environment: process.env.NODE_ENV,
        version: process.env.APP_VERSION,
        ...context.additional
      },
      severity: this.calculateSeverity(error, context),
      fingerprint: this.generateFingerprint(error, context),
      tags: this.generateTags(error, context)
    };

    // Store the error
    this.storeError(errorReport);

    // Update recent errors for pattern detection
    this.updateRecentErrors(errorReport);

    // Detect patterns and anomalies
    await this.detectPatterns(errorReport);

    // Check if alerts should be sent
    await this.checkAlertingRules(errorReport);

    // Log structured error
    logger.error('Error Reported', {
      errorId: errorReport.id,
      fingerprint: errorReport.fingerprint,
      severity: errorReport.severity,
      tags: errorReport.tags,
      context: errorReport.context
    });

    return errorReport.id;
  }

  /**
   * Generate error fingerprint for grouping similar errors
   */
  generateFingerprint(error, context) {
    const components = [
      error.name,
      this.normalizeErrorMessage(error.message),
      context.endpoint,
      error.code
    ];

    // Create hash-like fingerprint
    return components
      .filter(Boolean)
      .join('|')
      .replace(/[0-9]+/g, 'N') // Replace numbers with N
      .replace(/[a-f0-9-]{8,}/gi, 'ID'); // Replace IDs with ID
  }

  /**
   * Normalize error message to group similar errors
   */
  normalizeErrorMessage(message) {
    if (!message) return '';
    
    return message
      .replace(/[0-9]+/g, 'N')
      .replace(/[a-f0-9-]{8,}/gi, 'ID')
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, 'DATE')
      .replace(/\b\d{2}:\d{2}:\d{2}\b/g, 'TIME')
      .toLowerCase();
  }

  /**
   * Calculate error severity
   */
  calculateSeverity(error, context) {
    // Critical: 5xx errors, security issues, payment failures
    if (error.statusCode >= 500) return 'critical';
    if (error.name === 'SecurityError') return 'critical';
    if (error.name === 'PaymentError') return 'critical';
    
    // High: Authentication failures, data corruption
    if (error.statusCode === 401 || error.statusCode === 403) return 'high';
    if (error.name === 'ValidationError' && context.endpoint?.includes('payment')) return 'high';
    
    // Medium: 4xx errors, external service failures
    if (error.statusCode >= 400 && error.statusCode < 500) return 'medium';
    if (error.name === 'ExternalServiceError') return 'medium';
    
    // Low: other errors
    return 'low';
  }

  /**
   * Generate tags for categorization
   */
  generateTags(error, context) {
    const tags = [];

    // Error type tags
    if (error.name) tags.push(`error_type:${error.name.toLowerCase()}`);
    if (error.statusCode) tags.push(`status:${error.statusCode}`);
    
    // Context tags
    if (context.endpoint) {
      tags.push(`endpoint:${context.endpoint.replace(/[0-9]+/g, 'ID')}`);
      
      // Feature tags
      if (context.endpoint.includes('booking')) tags.push('feature:booking');
      if (context.endpoint.includes('payment')) tags.push('feature:payment');
      if (context.endpoint.includes('auth')) tags.push('feature:auth');
      if (context.endpoint.includes('room')) tags.push('feature:room');
      if (context.endpoint.includes('rate')) tags.push('feature:rate');
    }
    
    if (context.method) tags.push(`method:${context.method.toLowerCase()}`);
    if (context.userRole) tags.push(`role:${context.userRole}`);
    if (context.hotelId) tags.push(`hotel:${context.hotelId}`);

    // Environment tags
    tags.push(`env:${process.env.NODE_ENV || 'development'}`);

    return tags;
  }

  /**
   * Store error in database
   */
  storeError(errorReport) {
    const fingerprint = errorReport.fingerprint;
    
    if (this.errorDatabase.has(fingerprint)) {
      const existing = this.errorDatabase.get(fingerprint);
      existing.count++;
      existing.lastSeen = errorReport.timestamp;
      existing.occurrences.push({
        id: errorReport.id,
        timestamp: errorReport.timestamp,
        context: errorReport.context
      });

      // Keep only last 50 occurrences
      if (existing.occurrences.length > 50) {
        existing.occurrences = existing.occurrences.slice(-50);
      }
    } else {
      this.errorDatabase.set(fingerprint, {
        fingerprint,
        firstSeen: errorReport.timestamp,
        lastSeen: errorReport.timestamp,
        count: 1,
        severity: errorReport.severity,
        error: errorReport.error,
        tags: errorReport.tags,
        occurrences: [{
          id: errorReport.id,
          timestamp: errorReport.timestamp,
          context: errorReport.context
        }]
      });
    }
  }

  /**
   * Update recent errors for pattern detection
   */
  updateRecentErrors(errorReport) {
    this.recentErrors.push({
      timestamp: Date.now(),
      fingerprint: errorReport.fingerprint,
      severity: errorReport.severity,
      userId: errorReport.context.userId,
      endpoint: errorReport.context.endpoint
    });

    // Keep only errors from the last hour
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    this.recentErrors = this.recentErrors.filter(e => e.timestamp > oneHourAgo);
  }

  /**
   * Detect error patterns and anomalies
   */
  async detectPatterns(errorReport) {
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    const oneHourAgo = now - (60 * 60 * 1000);

    // Recent errors for pattern analysis
    const recentErrors = this.recentErrors.filter(e => e.timestamp > fiveMinutesAgo);
    
    // Pattern 1: Error rate spike
    const errorRatePerMinute = recentErrors.length / 5;
    if (errorRatePerMinute > this.alertThresholds.errorRatePerMinute) {
      await this.sendPatternAlert('error_rate_spike', {
        rate: errorRatePerMinute,
        threshold: this.alertThresholds.errorRatePerMinute,
        period: '5 minutes'
      });
    }

    // Pattern 2: Critical error cluster
    const criticalErrors = recentErrors.filter(e => e.severity === 'critical');
    const criticalErrorRate = criticalErrors.length / 5;
    if (criticalErrorRate > this.alertThresholds.criticalErrorsPerMinute) {
      await this.sendPatternAlert('critical_error_cluster', {
        rate: criticalErrorRate,
        threshold: this.alertThresholds.criticalErrorsPerMinute,
        errors: criticalErrors
      });
    }

    // Pattern 3: Single user experiencing many errors
    const userErrors = recentErrors.filter(e => e.userId === errorReport.context.userId);
    if (userErrors.length >= this.alertThresholds.consecutiveErrors) {
      await this.sendPatternAlert('user_error_cluster', {
        userId: errorReport.context.userId,
        errorCount: userErrors.length,
        period: '5 minutes'
      });
    }

    // Pattern 4: New error type
    const hourlyErrors = this.recentErrors.filter(e => e.timestamp > oneHourAgo);
    const uniqueFingerprints = new Set(hourlyErrors.map(e => e.fingerprint));
    if (uniqueFingerprints.size > this.alertThresholds.uniqueErrorsPerHour) {
      await this.sendPatternAlert('high_unique_errors', {
        uniqueErrors: uniqueFingerprints.size,
        threshold: this.alertThresholds.uniqueErrorsPerHour,
        period: '1 hour'
      });
    }

    // Pattern 5: Endpoint-specific error cluster
    if (errorReport.context.endpoint) {
      const endpointErrors = recentErrors.filter(e => e.endpoint === errorReport.context.endpoint);
      if (endpointErrors.length >= 10) { // 10 errors in 5 minutes for same endpoint
        await this.sendPatternAlert('endpoint_error_cluster', {
          endpoint: errorReport.context.endpoint,
          errorCount: endpointErrors.length,
          period: '5 minutes'
        });
      }
    }
  }

  /**
   * Check alerting rules and send notifications
   */
  async checkAlertingRules(errorReport) {
    const severity = errorReport.severity;
    const fingerprint = errorReport.fingerprint;

    // Suppress duplicate alerts for the same fingerprint within time window
    const suppressionKey = `${fingerprint}:${severity}`;
    const suppressionWindow = {
      critical: 5 * 60 * 1000,  // 5 minutes
      high: 15 * 60 * 1000,     // 15 minutes
      medium: 60 * 60 * 1000,   // 1 hour
      low: 4 * 60 * 60 * 1000   // 4 hours
    };

    const lastAlert = this.alertingSuppression.get(suppressionKey);
    const now = Date.now();

    if (lastAlert && (now - lastAlert) < suppressionWindow[severity]) {
      return; // Suppress duplicate alert
    }

    // Send alert based on severity
    if (severity === 'critical') {
      await this.sendCriticalAlert(errorReport);
    } else if (severity === 'high') {
      await this.sendHighPriorityAlert(errorReport);
    }

    // Update suppression timestamp
    this.alertingSuppression.set(suppressionKey, now);
  }

  /**
   * Send critical error alert
   */
  async sendCriticalAlert(errorReport) {
    const alertData = {
      type: 'critical_error',
      errorId: errorReport.id,
      fingerprint: errorReport.fingerprint,
      message: errorReport.error.message,
      endpoint: errorReport.context.endpoint,
      userId: errorReport.context.userId,
      hotelId: errorReport.context.hotelId,
      timestamp: errorReport.timestamp,
      dashboardUrl: `${process.env.ADMIN_URL}/errors/${errorReport.fingerprint}`
    };

    logger.error('CRITICAL ERROR ALERT', {
      alert: true,
      priority: 'critical',
      ...alertData
    });

    // Here you would integrate with your notification service
    // await notificationService.sendSlack('critical-alerts', alertData);
    // await notificationService.sendEmail('engineering@company.com', alertData);
    // await notificationService.sendPagerDuty(alertData);
  }

  /**
   * Send high priority error alert
   */
  async sendHighPriorityAlert(errorReport) {
    const alertData = {
      type: 'high_priority_error',
      errorId: errorReport.id,
      fingerprint: errorReport.fingerprint,
      message: errorReport.error.message,
      endpoint: errorReport.context.endpoint,
      timestamp: errorReport.timestamp
    };

    logger.warn('HIGH PRIORITY ERROR ALERT', {
      alert: true,
      priority: 'high',
      ...alertData
    });

    // Send to appropriate channels
    // await notificationService.sendSlack('error-alerts', alertData);
  }

  /**
   * Send pattern-based alert
   */
  async sendPatternAlert(patternType, patternData) {
    const suppressionKey = `pattern:${patternType}`;
    const lastAlert = this.alertingSuppression.get(suppressionKey);
    const now = Date.now();

    // Suppress pattern alerts for 15 minutes
    if (lastAlert && (now - lastAlert) < (15 * 60 * 1000)) {
      return;
    }

    const alertData = {
      type: 'error_pattern',
      pattern: patternType,
      ...patternData,
      timestamp: new Date().toISOString()
    };

    logger.warn('ERROR PATTERN DETECTED', {
      alert: true,
      priority: 'medium',
      ...alertData
    });

    this.alertingSuppression.set(suppressionKey, now);

    // Send pattern alert
    // await notificationService.sendSlack('pattern-alerts', alertData);
  }

  /**
   * Get error statistics and insights
   */
  getErrorStats(timeframe = '24h') {
    const now = Date.now();
    const timeframes = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };

    const cutoff = now - (timeframes[timeframe] || timeframes['24h']);

    // Filter recent errors
    const recentErrors = Array.from(this.errorDatabase.values())
      .map(errorGroup => ({
        ...errorGroup,
        occurrences: errorGroup.occurrences.filter(o => 
          new Date(o.timestamp).getTime() > cutoff
        )
      }))
      .filter(errorGroup => errorGroup.occurrences.length > 0);

    // Calculate statistics
    const totalErrors = recentErrors.reduce((sum, group) => sum + group.occurrences.length, 0);
    const uniqueErrors = recentErrors.length;

    // Severity breakdown
    const severityBreakdown = recentErrors.reduce((acc, group) => {
      acc[group.severity] = (acc[group.severity] || 0) + group.occurrences.length;
      return acc;
    }, {});

    // Top errors by frequency
    const topErrors = recentErrors
      .sort((a, b) => b.occurrences.length - a.occurrences.length)
      .slice(0, 10)
      .map(group => ({
        fingerprint: group.fingerprint,
        message: group.error.message,
        count: group.occurrences.length,
        severity: group.severity,
        firstSeen: group.firstSeen,
        lastSeen: group.lastSeen,
        tags: group.tags
      }));

    // Error trends (hourly buckets)
    const hourlyBuckets = {};
    recentErrors.forEach(group => {
      group.occurrences.forEach(occurrence => {
        const hour = new Date(occurrence.timestamp).toISOString().substring(0, 13);
        hourlyBuckets[hour] = (hourlyBuckets[hour] || 0) + 1;
      });
    });

    const trend = Object.entries(hourlyBuckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hour, count]) => ({ hour, count }));

    return {
      summary: {
        totalErrors,
        uniqueErrors,
        timeframe,
        severityBreakdown
      },
      topErrors,
      trend,
      recentPatterns: this.getRecentPatterns()
    };
  }

  /**
   * Get recent error patterns
   */
  getRecentPatterns() {
    // This would analyze recent patterns and return insights
    // For now, return basic pattern information
    return {
      errorRateSpikes: 0,
      criticalErrorClusters: 0,
      userErrorClusters: 0,
      endpointErrorClusters: 0
    };
  }

  /**
   * Get detailed error information
   */
  getErrorDetails(fingerprint) {
    return this.errorDatabase.get(fingerprint);
  }

  /**
   * Mark error as resolved
   */
  resolveError(fingerprint, resolvedBy, resolution) {
    const errorGroup = this.errorDatabase.get(fingerprint);
    if (errorGroup) {
      errorGroup.resolved = {
        timestamp: new Date().toISOString(),
        resolvedBy,
        resolution
      };

      logger.info('Error Resolved', {
        fingerprint,
        resolvedBy,
        resolution,
        totalOccurrences: errorGroup.count
      });
    }
  }

  /**
   * Clear old errors (maintenance function)
   */
  clearOldErrors(daysToKeep = 30) {
    const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    let cleared = 0;

    for (const [fingerprint, errorGroup] of this.errorDatabase.entries()) {
      const lastSeenTime = new Date(errorGroup.lastSeen).getTime();
      if (lastSeenTime < cutoff) {
        this.errorDatabase.delete(fingerprint);
        cleared++;
      }
    }

    logger.info('Old Errors Cleared', { cleared, daysToKeep });
    return cleared;
  }
}

// Create singleton instance
const errorReportingService = new ErrorReportingService();

export default errorReportingService;