import logger from '../utils/logger.js';
import cacheService from './cacheService.js';
import mongoose from 'mongoose';

class MonitoringService {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        byMethod: {},
        byRoute: {},
        byStatus: {},
        responseTimes: []
      },
      errors: {
        total: 0,
        byType: {},
        byRoute: {},
        recent: []
      },
      performance: {
        memoryUsage: [],
        cpuUsage: [],
        databaseQueries: 0,
        slowQueries: []
      },
      business: {
        bookings: 0,
        revenue: 0,
        activeUsers: 0,
        systemHealth: 'healthy'
      }
    };

    this.alerts = [];
    this.thresholds = {
      responseTime: 1000, // 1 second
      errorRate: 0.05, // 5%
      memoryUsage: 0.8, // 80%
      cpuUsage: 0.7, // 70%
      databaseQueries: 1000 // per minute
    };

    this.isMonitoring = false;
    this.monitoringInterval = null;
  }

  // Start monitoring
  start() {
    if (this.isMonitoring) {
      logger.warn('Monitoring service is already running');
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.checkAlerts();
      this.cleanupOldData();
    }, 60000); // Every minute

    logger.info('Monitoring service started');
  }

  // Stop monitoring
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    logger.info('Monitoring service stopped');
  }

  // Record request metrics
  recordRequest(req, res, responseTime) {
    const method = req.method;
    const route = req.route?.path || req.path;
    const status = res.statusCode;

    // Update request counts
    this.metrics.requests.total++;
    this.metrics.requests.byMethod[method] = (this.metrics.requests.byMethod[method] || 0) + 1;
    this.metrics.requests.byRoute[route] = (this.metrics.requests.byRoute[route] || 0) + 1;
    this.metrics.requests.byStatus[status] = (this.metrics.requests.byStatus[status] || 0) + 1;
    this.metrics.requests.responseTimes.push(responseTime);

    // Keep only last 1000 response times
    if (this.metrics.requests.responseTimes.length > 1000) {
      this.metrics.requests.responseTimes.shift();
    }

    // Record slow requests
    if (responseTime > this.thresholds.responseTime) {
      this.recordSlowRequest(req, responseTime);
    }

    // Record errors
    if (status >= 400) {
      this.recordError(req, res, new Error(`HTTP ${status}`));
    }
  }

  // Record error metrics
  recordError(req, res, error) {
    const route = req.route?.path || req.path;
    const errorType = error.constructor.name;
    const errorMessage = error.message;

    this.metrics.errors.total++;
    this.metrics.errors.byType[errorType] = (this.metrics.errors.byType[errorType] || 0) + 1;
    this.metrics.errors.byRoute[route] = (this.metrics.errors.byRoute[route] || 0) + 1;

    // Add to recent errors
    this.metrics.errors.recent.push({
      timestamp: new Date(),
      route,
      errorType,
      errorMessage,
      stack: error.stack
    });

    // Keep only last 100 errors
    if (this.metrics.errors.recent.length > 100) {
      this.metrics.errors.recent.shift();
    }

    logger.error('Error recorded by monitoring service:', {
      route,
      errorType,
      errorMessage,
      timestamp: new Date()
    });
  }

  // Record slow request
  recordSlowRequest(req, responseTime) {
    const route = req.route?.path || req.path;
    
    this.metrics.performance.slowQueries.push({
      timestamp: new Date(),
      route,
      responseTime,
      method: req.method,
      url: req.originalUrl
    });

    // Keep only last 100 slow queries
    if (this.metrics.performance.slowQueries.length > 100) {
      this.metrics.performance.slowQueries.shift();
    }
  }

  // Record database query
  recordDatabaseQuery(queryTime) {
    this.metrics.performance.databaseQueries++;
    
    if (queryTime > 100) { // 100ms threshold
      this.metrics.performance.slowQueries.push({
        timestamp: new Date(),
        type: 'database',
        queryTime,
        description: 'Slow database query'
      });
    }
  }

  // Collect system metrics
  async collectMetrics() {
    try {
      // Memory usage
      const memUsage = process.memoryUsage();
      this.metrics.performance.memoryUsage.push({
        timestamp: new Date(),
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss
      });

      // Keep only last 60 memory readings (1 hour)
      if (this.metrics.performance.memoryUsage.length > 60) {
        this.metrics.performance.memoryUsage.shift();
      }

      // Database health
      const dbState = mongoose.connection.readyState;
      const dbHealth = {
        timestamp: new Date(),
        state: dbState,
        stateName: ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState]
      };

      // Cache health
      const cacheHealth = await cacheService.healthCheck();

      // Business metrics
      await this.collectBusinessMetrics();

      // Update system health
      this.updateSystemHealth();

      logger.debug('Metrics collected successfully');
    } catch (error) {
      logger.error('Error collecting metrics:', error);
    }
  }

  // Collect business metrics
  async collectBusinessMetrics() {
    try {
      const Booking = mongoose.model('Booking');
      const User = mongoose.model('User');

      // Recent bookings count
      const recentBookings = await Booking.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });

      // Active users (logged in within last hour)
      const activeUsers = await User.countDocuments({
        lastActivity: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
      });

      // Revenue calculation (simplified)
      const todayBookings = await Booking.find({
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        status: 'confirmed'
      });

      const revenue = todayBookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);

      this.metrics.business = {
        bookings: recentBookings,
        revenue,
        activeUsers,
        systemHealth: this.metrics.business.systemHealth
      };
    } catch (error) {
      logger.error('Error collecting business metrics:', error);
    }
  }

  // Update system health
  updateSystemHealth() {
    const errorRate = this.calculateErrorRate();
    const avgResponseTime = this.calculateAverageResponseTime();
    const memoryUsage = this.calculateMemoryUsage();

    let health = 'healthy';

    if (errorRate > this.thresholds.errorRate || 
        avgResponseTime > this.thresholds.responseTime ||
        memoryUsage > this.thresholds.memoryUsage) {
      health = 'warning';
    }

    if (errorRate > this.thresholds.errorRate * 2 ||
        avgResponseTime > this.thresholds.responseTime * 2 ||
        memoryUsage > 0.95) {
      health = 'critical';
    }

    this.metrics.business.systemHealth = health;
  }

  // Calculate error rate
  calculateErrorRate() {
    const totalRequests = this.metrics.requests.total;
    const totalErrors = this.metrics.errors.total;
    
    return totalRequests > 0 ? totalErrors / totalRequests : 0;
  }

  // Calculate average response time
  calculateAverageResponseTime() {
    const responseTimes = this.metrics.requests.responseTimes;
    return responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;
  }

  // Calculate memory usage percentage
  calculateMemoryUsage() {
    const memoryReadings = this.metrics.performance.memoryUsage;
    if (memoryReadings.length === 0) return 0;

    const latest = memoryReadings[memoryReadings.length - 1];
    return latest.used / latest.total;
  }

  // Check for alerts
  checkAlerts() {
    const alerts = [];

    // Error rate alert
    const errorRate = this.calculateErrorRate();
    if (errorRate > this.thresholds.errorRate) {
      alerts.push({
        type: 'error_rate',
        severity: errorRate > this.thresholds.errorRate * 2 ? 'critical' : 'warning',
        message: `High error rate detected: ${(errorRate * 100).toFixed(2)}%`,
        value: errorRate,
        threshold: this.thresholds.errorRate,
        timestamp: new Date()
      });
    }

    // Response time alert
    const avgResponseTime = this.calculateAverageResponseTime();
    if (avgResponseTime > this.thresholds.responseTime) {
      alerts.push({
        type: 'response_time',
        severity: avgResponseTime > this.thresholds.responseTime * 2 ? 'critical' : 'warning',
        message: `High response time detected: ${avgResponseTime.toFixed(2)}ms`,
        value: avgResponseTime,
        threshold: this.thresholds.responseTime,
        timestamp: new Date()
      });
    }

    // Memory usage alert
    const memoryUsage = this.calculateMemoryUsage();
    if (memoryUsage > this.thresholds.memoryUsage) {
      alerts.push({
        type: 'memory_usage',
        severity: memoryUsage > 0.95 ? 'critical' : 'warning',
        message: `High memory usage detected: ${(memoryUsage * 100).toFixed(2)}%`,
        value: memoryUsage,
        threshold: this.thresholds.memoryUsage,
        timestamp: new Date()
      });
    }

    // Database query alert
    if (this.metrics.performance.databaseQueries > this.thresholds.databaseQueries) {
      alerts.push({
        type: 'database_queries',
        severity: 'warning',
        message: `High database query count: ${this.metrics.performance.databaseQueries}`,
        value: this.metrics.performance.databaseQueries,
        threshold: this.thresholds.databaseQueries,
        timestamp: new Date()
      });
    }

    // Add new alerts
    this.alerts.push(...alerts);

    // Send alerts
    alerts.forEach(alert => this.sendAlert(alert));

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  // Send alert
  async sendAlert(alert) {
    try {
      // Log alert
      logger.warn('Alert triggered:', alert);

      // Send to external monitoring service (if configured)
      if (process.env.MONITORING_WEBHOOK_URL) {
        await this.sendWebhookAlert(alert);
      }

      // Send email alert for critical issues
      if (alert.severity === 'critical' && process.env.ALERT_EMAIL) {
        await this.sendEmailAlert(alert);
      }

      // Send Slack notification (if configured)
      if (process.env.SLACK_WEBHOOK_URL) {
        await this.sendSlackAlert(alert);
      }
    } catch (error) {
      logger.error('Error sending alert:', error);
    }
  }

  // Send webhook alert
  async sendWebhookAlert(alert) {
    try {
      const response = await fetch(process.env.MONITORING_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          alert,
          metrics: this.getMetrics(),
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status}`);
      }
    } catch (error) {
      logger.error('Webhook alert failed:', error);
    }
  }

  // Send email alert
  async sendEmailAlert(alert) {
    // Implement email sending logic here
    logger.info('Email alert would be sent:', alert);
  }

  // Send Slack alert
  async sendSlackAlert(alert) {
    try {
      const color = alert.severity === 'critical' ? '#ff0000' : '#ffaa00';
      
      const response = await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          attachments: [{
            color,
            title: `🚨 ${alert.type.toUpperCase()} Alert`,
            text: alert.message,
            fields: [
              {
                title: 'Severity',
                value: alert.severity,
                short: true
              },
              {
                title: 'Value',
                value: alert.value.toString(),
                short: true
              },
              {
                title: 'Threshold',
                value: alert.threshold.toString(),
                short: true
              }
            ],
            footer: 'Hotel Management System',
            ts: Math.floor(Date.now() / 1000)
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`Slack notification failed: ${response.status}`);
      }
    } catch (error) {
      logger.error('Slack alert failed:', error);
    }
  }

  // Cleanup old data
  cleanupOldData() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    // Clean up old memory readings
    this.metrics.performance.memoryUsage = this.metrics.performance.memoryUsage.filter(
      reading => reading.timestamp > oneHourAgo
    );

    // Clean up old slow queries
    this.metrics.performance.slowQueries = this.metrics.performance.slowQueries.filter(
      query => query.timestamp > oneHourAgo
    );

    // Clean up old errors
    this.metrics.errors.recent = this.metrics.errors.recent.filter(
      error => error.timestamp > oneHourAgo
    );

    // Reset database query counter
    this.metrics.performance.databaseQueries = 0;
  }

  // Get metrics
  getMetrics() {
    return {
      ...this.metrics,
      calculated: {
        errorRate: this.calculateErrorRate(),
        averageResponseTime: this.calculateAverageResponseTime(),
        memoryUsage: this.calculateMemoryUsage()
      }
    };
  }

  // Get alerts
  getAlerts(severity = null) {
    if (severity) {
      return this.alerts.filter(alert => alert.severity === severity);
    }
    return this.alerts;
  }

  // Get health status
  getHealthStatus() {
    return {
      status: this.metrics.business.systemHealth,
      timestamp: new Date(),
      metrics: {
        errorRate: this.calculateErrorRate(),
        averageResponseTime: this.calculateAverageResponseTime(),
        memoryUsage: this.calculateMemoryUsage(),
        databaseQueries: this.metrics.performance.databaseQueries
      },
      thresholds: this.thresholds
    };
  }

  // Update thresholds
  updateThresholds(newThresholds) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    logger.info('Monitoring thresholds updated:', this.thresholds);
  }
}

// Create singleton instance
const monitoringService = new MonitoringService();

export default monitoringService;
