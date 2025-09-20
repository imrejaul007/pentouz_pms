import apiMetricsService from '../services/apiMetricsService.js';
import APIKey from '../models/APIKey.js';
import logger from '../utils/logger.js';

/**
 * API Metrics Collection Middleware
 * Tracks all API requests without WebSockets - uses immediate DB updates
 */
class APIMetricsMiddleware {
  constructor() {
    this.buffer = new Map(); // Temporary buffer for batch processing
    this.bufferFlushInterval = 30000; // Flush every 30 seconds
    this.maxBufferSize = 1000;

    // Start periodic buffer flush
    this.startBufferFlushing();
  }

  /**
   * Main middleware function
   */
  trackRequest() {
    return async (req, res, next) => {
      const startTime = Date.now();
      const requestTimestamp = new Date();

      // Skip tracking for certain paths
      if (this.shouldSkipTracking(req.path)) {
        return next();
      }

      // Capture request data
      const requestData = {
        method: req.method,
        path: this.normalizePath(req.path),
        originalPath: req.path,
        hotelId: req.user?.hotelId,
        userId: req.user?.id,
        userRole: req.user?.role,
        apiKeyId: req.apiKey?.keyId,
        apiKeyType: req.apiKey?.type,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        requestSize: parseInt(req.get('content-length')) || 0,
        timestamp: requestTimestamp
      };

      // Override res.end to capture response data
      const originalEnd = res.end;
      res.end = function(chunk, encoding) {
        const responseTime = Date.now() - startTime;
        const responseSize = chunk ? Buffer.byteLength(chunk, encoding) : 0;

        // Complete request data
        const completeData = {
          ...requestData,
          statusCode: res.statusCode,
          responseTime,
          responseSize,
          success: res.statusCode >= 200 && res.statusCode < 400,
          error: res.statusCode >= 400
        };

        // Track metrics asynchronously (don't block response)
        setImmediate(() => {
          apiMetricsMiddleware.recordMetrics(completeData);
        });

        // Call original end
        originalEnd.call(this, chunk, encoding);
      };

      next();
    };
  }

  /**
   * Record metrics data
   */
  async recordMetrics(data) {
    try {
      // Don't track if no hotel context
      if (!data.hotelId) return;

      // Update API Key usage if present
      if (data.apiKeyId) {
        await this.updateAPIKeyUsage(data);
      }

      // Buffer metrics for batch processing
      const bufferKey = this.createBufferKey(data);

      if (!this.buffer.has(bufferKey)) {
        this.buffer.set(bufferKey, {
          hotelId: data.hotelId,
          period: 'minute',
          timestamp: this.normalizeTimestamp(data.timestamp, 'minute'),
          endpoint: {
            method: data.method,
            path: data.path,
            category: this.categorizeEndpoint(data.path)
          },
          requests: {
            total: 0,
            successful: 0,
            failed: 0,
            byStatusCode: new Map()
          },
          performance: {
            responseTimes: [],
            totalResponseTime: 0,
            minResponseTime: Infinity,
            maxResponseTime: 0
          },
          errors: {
            total: 0,
            byType: new Map()
          },
          apiKeyUsage: {
            keyRequests: new Map(),
            byKeyType: new Map()
          },
          users: {
            userIds: new Set(),
            byRole: new Map()
          },
          bandwidth: {
            totalBytes: 0,
            requestBytes: 0,
            responseBytes: 0
          }
        });
      }

      const metric = this.buffer.get(bufferKey);

      // Update metrics
      metric.requests.total += 1;
      if (data.success) {
        metric.requests.successful += 1;
      } else {
        metric.requests.failed += 1;
        metric.errors.total += 1;
      }

      // Update status code distribution
      const statusKey = Math.floor(data.statusCode / 100) * 100;
      metric.requests.byStatusCode.set(statusKey,
        (metric.requests.byStatusCode.get(statusKey) || 0) + 1);

      // Update performance metrics
      if (data.responseTime) {
        metric.performance.responseTimes.push(data.responseTime);
        metric.performance.totalResponseTime += data.responseTime;
        metric.performance.minResponseTime = Math.min(metric.performance.minResponseTime, data.responseTime);
        metric.performance.maxResponseTime = Math.max(metric.performance.maxResponseTime, data.responseTime);
      }

      // Update API key usage
      if (data.apiKeyId) {
        metric.apiKeyUsage.keyRequests.set(data.apiKeyId,
          (metric.apiKeyUsage.keyRequests.get(data.apiKeyId) || 0) + 1);
        metric.apiKeyUsage.byKeyType.set(data.apiKeyType,
          (metric.apiKeyUsage.byKeyType.get(data.apiKeyType) || 0) + 1);
      }

      // Update user metrics
      if (data.userId) {
        metric.users.userIds.add(data.userId);
        metric.users.byRole.set(data.userRole,
          (metric.users.byRole.get(data.userRole) || 0) + 1);
      }

      // Update bandwidth
      metric.bandwidth.totalBytes += (data.requestSize || 0) + (data.responseSize || 0);
      metric.bandwidth.requestBytes += data.requestSize || 0;
      metric.bandwidth.responseBytes += data.responseSize || 0;

      // Flush buffer if too large
      if (this.buffer.size >= this.maxBufferSize) {
        await this.flushBuffer();
      }

    } catch (error) {
      logger.error('Error recording API metrics:', error);
    }
  }

  /**
   * Update API Key usage statistics
   */
  async updateAPIKeyUsage(data) {
    try {
      await APIKey.findOneAndUpdate(
        { keyId: data.apiKeyId },
        {
          $inc: { 'usage.totalRequests': 1 },
          $set: {
            'usage.lastUsed': data.timestamp,
            'usage.lastUserAgent': data.userAgent,
            'usage.lastIP': data.ip
          }
        }
      );
    } catch (error) {
      logger.error('Error updating API key usage:', error);
    }
  }

  /**
   * Start periodic buffer flushing
   */
  startBufferFlushing() {
    setInterval(() => {
      this.flushBuffer();
    }, this.bufferFlushInterval);
  }

  /**
   * Flush buffer to database
   */
  async flushBuffer() {
    if (this.buffer.size === 0) return;

    try {
      const metricsToSave = Array.from(this.buffer.values());
      this.buffer.clear();

      // Save metrics in batches
      for (const metric of metricsToSave) {
        await this.saveMetricToDatabase(metric);
      }

      logger.info(`Flushed ${metricsToSave.length} API metrics to database`);
    } catch (error) {
      logger.error('Error flushing metrics buffer:', error);
    }
  }

  /**
   * Save individual metric to database
   */
  async saveMetricToDatabase(metric) {
    try {
      // Calculate performance averages
      const responseTimes = metric.performance.responseTimes;
      if (responseTimes.length > 0) {
        responseTimes.sort((a, b) => a - b);
        metric.performance.averageResponseTime = metric.performance.totalResponseTime / responseTimes.length;
        metric.performance.p50ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.5)];
        metric.performance.p95ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.95)];
        metric.performance.p99ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.99)];
      }

      // Convert Maps to Objects for MongoDB
      const dbMetric = {
        hotelId: metric.hotelId,
        period: metric.period,
        timestamp: metric.timestamp,
        endpoint: metric.endpoint,
        requests: {
          total: metric.requests.total,
          successful: metric.requests.successful,
          failed: metric.requests.failed,
          byStatusCode: Object.fromEntries(metric.requests.byStatusCode)
        },
        performance: {
          averageResponseTime: metric.performance.averageResponseTime || 0,
          minResponseTime: metric.performance.minResponseTime === Infinity ? 0 : metric.performance.minResponseTime,
          maxResponseTime: metric.performance.maxResponseTime,
          p50ResponseTime: metric.performance.p50ResponseTime || 0,
          p95ResponseTime: metric.performance.p95ResponseTime || 0,
          p99ResponseTime: metric.performance.p99ResponseTime || 0,
          responseTimes: responseTimes.slice(-100) // Keep last 100 samples
        },
        errors: {
          total: metric.errors.total,
          byType: Object.fromEntries(metric.errors.byType)
        },
        apiKeyUsage: {
          totalKeys: metric.apiKeyUsage.keyRequests.size,
          byKeyType: Object.fromEntries(metric.apiKeyUsage.byKeyType)
        },
        users: {
          total: metric.users.userIds.size,
          byRole: Object.fromEntries(metric.users.byRole)
        },
        bandwidth: metric.bandwidth
      };

      // Use upsert to update existing or create new
      await apiMetricsService.recordMetric(dbMetric);

    } catch (error) {
      logger.error('Error saving metric to database:', error);
    }
  }

  /**
   * Utility methods
   */
  shouldSkipTracking(path) {
    const skipPaths = [
      '/health',
      '/favicon.ico',
      '/robots.txt',
      '/api/v1/api-management/metrics', // Don't track the metrics endpoint itself
    ];
    return skipPaths.some(skipPath => path.startsWith(skipPath));
  }

  normalizePath(path) {
    // Replace dynamic segments with placeholders
    return path
      .replace(/\/[0-9a-fA-F]{24}/g, '/:id') // MongoDB ObjectIds
      .replace(/\/\d+/g, '/:id') // Numeric IDs
      .replace(/\?.*$/, ''); // Remove query parameters
  }

  categorizeEndpoint(path) {
    if (path.includes('/booking')) return 'Bookings';
    if (path.includes('/room')) return 'Rooms';
    if (path.includes('/guest')) return 'Guests';
    if (path.includes('/payment')) return 'Payments';
    if (path.includes('/user')) return 'Users';
    if (path.includes('/admin')) return 'Admin';
    if (path.includes('/staff')) return 'Staff';
    if (path.includes('/auth')) return 'Authentication';
    if (path.includes('/api-management')) return 'API Management';
    if (path.includes('/dashboard')) return 'Dashboard';
    if (path.includes('/report')) return 'Reports';
    if (path.includes('/inventory')) return 'Inventory';
    if (path.includes('/housekeeping')) return 'Housekeeping';
    if (path.includes('/maintenance')) return 'Maintenance';
    if (path.includes('/pos')) return 'POS';
    if (path.includes('/financial')) return 'Financial';
    return 'Other';
  }

  createBufferKey(data) {
    const timeKey = this.normalizeTimestamp(data.timestamp, 'minute').getTime();
    return `${data.hotelId}-${data.method}-${data.path}-${timeKey}`;
  }

  normalizeTimestamp(timestamp, period) {
    const date = new Date(timestamp);
    switch (period) {
      case 'minute':
        return new Date(date.getFullYear(), date.getMonth(), date.getDate(),
                       date.getHours(), date.getMinutes());
      case 'hour':
        return new Date(date.getFullYear(), date.getMonth(), date.getDate(),
                       date.getHours());
      case 'day':
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
      default:
        return date;
    }
  }
}

// Create singleton instance
const apiMetricsMiddleware = new APIMetricsMiddleware();

export default apiMetricsMiddleware;
