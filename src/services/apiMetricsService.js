import APIMetrics from '../models/APIMetrics.js';
import AuditLog from '../models/AuditLog.js';
import APIKey from '../models/APIKey.js';
import WebhookEndpoint from '../models/WebhookEndpoint.js';
import logger from '../utils/logger.js';
import { EventEmitter } from 'events';

class APIMetricsService extends EventEmitter {
  constructor() {
    super();
    this.metricsBuffer = new Map(); // Buffer for real-time metrics
    this.flushInterval = 300000; // Flush every 5 minutes (reduced frequency)
    this.maxBufferSize = 10000;
    
    this.startMetricsCollection();
  }

  /**
   * Start metrics collection and periodic flushing
   */
  startMetricsCollection() {
    // Flush buffer periodically
    setInterval(() => {
      this.flushMetrics();
    }, this.flushInterval);

    // Cleanup old metrics data periodically (daily)
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 24 * 60 * 60 * 1000);

    logger.info('API Metrics Service started');
  }

  /**
   * Record a single API request metric
   */
  async recordRequest(data) {
    try {
      const {
        hotelId,
        method,
        path,
        statusCode,
        responseTime,
        requestSize,
        responseSize,
        userId,
        userRole,
        apiKeyId,
        apiKeyType,
        userAgent,
        ip,
        country,
        region,
        error
      } = data;

      const timestamp = new Date();
      const category = this.categorizeEndpoint(path);
      
      // Create buffer key for aggregation
      const bufferKey = this.createBufferKey(hotelId, 'minute', timestamp, method, path);
      
      if (!this.metricsBuffer.has(bufferKey)) {
        this.metricsBuffer.set(bufferKey, {
          hotelId,
          period: 'minute',
          timestamp: this.normalizeTimestamp(timestamp, 'minute'),
          endpoint: { method, path, category },
          requests: { total: 0, successful: 0, failed: 0, byStatusCode: new Map() },
          performance: { responseTimes: [], totalResponseTime: 0 },
          errors: { total: 0, byType: new Map(), topErrors: [] },
          apiKeyUsage: { keyRequests: new Map(), byKeyType: new Map() },
          users: { total: new Set(), authenticated: 0, anonymous: 0, byRole: new Map() },
          geographic: { countries: new Map(), regions: new Map() },
          sources: { userAgents: new Map(), ips: new Set() },
          bandwidth: { totalBytes: 0, requestBytes: 0, responseBytes: 0 },
          security: { suspiciousActivities: 0, authFailures: 0 }
        });
      }

      const metric = this.metricsBuffer.get(bufferKey);
      
      // Update request counts
      metric.requests.total += 1;
      if (statusCode >= 200 && statusCode < 400) {
        metric.requests.successful += 1;
      } else {
        metric.requests.failed += 1;
      }
      
      // Update status code distribution
      const statusKey = Math.floor(statusCode / 100) * 100;
      metric.requests.byStatusCode.set(statusKey, 
        (metric.requests.byStatusCode.get(statusKey) || 0) + 1);

      // Update performance metrics
      if (responseTime) {
        metric.performance.responseTimes.push(responseTime);
        metric.performance.totalResponseTime += responseTime;
      }

      // Update error metrics
      if (error) {
        metric.errors.total += 1;
        const errorType = this.categorizeError(error, statusCode);
        metric.errors.byType.set(errorType, 
          (metric.errors.byType.get(errorType) || 0) + 1);
      }

      // Update API key usage
      if (apiKeyId) {
        metric.apiKeyUsage.keyRequests.set(apiKeyId,
          (metric.apiKeyUsage.keyRequests.get(apiKeyId) || 0) + 1);
        
        if (apiKeyType) {
          metric.apiKeyUsage.byKeyType.set(apiKeyType,
            (metric.apiKeyUsage.byKeyType.get(apiKeyType) || 0) + 1);
        }
      }

      // Update user metrics
      if (userId) {
        metric.users.total.add(userId);
        metric.users.authenticated += 1;
        
        if (userRole) {
          metric.users.byRole.set(userRole,
            (metric.users.byRole.get(userRole) || 0) + 1);
        }
      } else {
        metric.users.anonymous += 1;
      }

      // Update geographic data
      if (country) {
        metric.geographic.countries.set(country,
          (metric.geographic.countries.get(country) || 0) + 1);
      }
      if (region) {
        metric.geographic.regions.set(region,
          (metric.geographic.regions.get(region) || 0) + 1);
      }

      // Update sources
      if (userAgent) {
        metric.sources.userAgents.set(userAgent,
          (metric.sources.userAgents.get(userAgent) || 0) + 1);
      }
      if (ip) {
        metric.sources.ips.add(ip);
      }

      // Update bandwidth
      if (requestSize) metric.bandwidth.requestBytes += requestSize;
      if (responseSize) metric.bandwidth.responseBytes += responseSize;
      metric.bandwidth.totalBytes += (requestSize || 0) + (responseSize || 0);

      // Check for security issues
      if (statusCode === 401 || statusCode === 403) {
        metric.security.authFailures += 1;
      }

      // Flush buffer if too large
      if (this.metricsBuffer.size > this.maxBufferSize) {
        await this.flushMetrics();
      }

      // Emit real-time event
      this.emit('requestRecorded', {
        hotelId,
        endpoint: `${method} ${path}`,
        statusCode,
        responseTime
      });

    } catch (error) {
      logger.error('Error recording API request metric:', error);
    }
  }

  /**
   * Record webhook delivery metric
   */
  async recordWebhookDelivery(data) {
    try {
      const {
        hotelId,
        webhookId,
        event,
        success,
        statusCode,
        responseTime,
        attempts,
        error
      } = data;

      const timestamp = new Date();
      const bufferKey = this.createBufferKey(hotelId, 'minute', timestamp, 'webhook', event);
      
      if (!this.metricsBuffer.has(bufferKey)) {
        this.metricsBuffer.set(bufferKey, {
          hotelId,
          period: 'minute',
          timestamp: this.normalizeTimestamp(timestamp, 'minute'),
          webhooks: {
            totalDeliveries: 0,
            successful: 0,
            failed: 0,
            averageDeliveryTime: 0,
            byEndpoint: new Map(),
            totalResponseTime: 0
          }
        });
      }

      const metric = this.metricsBuffer.get(bufferKey);
      
      metric.webhooks.totalDeliveries += 1;
      if (success) {
        metric.webhooks.successful += 1;
      } else {
        metric.webhooks.failed += 1;
      }

      if (responseTime) {
        metric.webhooks.totalResponseTime += responseTime;
        metric.webhooks.averageDeliveryTime = 
          metric.webhooks.totalResponseTime / metric.webhooks.totalDeliveries;
      }

      // Update webhook endpoint stats
      if (!metric.webhooks.byEndpoint.has(webhookId)) {
        metric.webhooks.byEndpoint.set(webhookId, {
          delivered: 0,
          failed: 0,
          totalTime: 0
        });
      }

      const endpointStats = metric.webhooks.byEndpoint.get(webhookId);
      if (success) {
        endpointStats.delivered += 1;
      } else {
        endpointStats.failed += 1;
      }

      if (responseTime) {
        endpointStats.totalTime += responseTime;
        endpointStats.averageTime = endpointStats.totalTime / 
          (endpointStats.delivered + endpointStats.failed);
      }

      this.emit('webhookDelivered', {
        hotelId,
        webhookId,
        event,
        success,
        responseTime
      });

    } catch (error) {
      logger.error('Error recording webhook delivery metric:', error);
    }
  }

  /**
   * Flush buffered metrics to database
   */
  async flushMetrics() {
    try {
      if (this.metricsBuffer.size === 0) return;

      const metricsToFlush = Array.from(this.metricsBuffer.values());
      this.metricsBuffer.clear();

      // Process and save metrics
      const saves = metricsToFlush.map(async (metric) => {
        // Convert Maps and Sets to objects for storage
        metric.requests.byStatusCode = Object.fromEntries(metric.requests.byStatusCode);
        metric.errors.byType = Object.fromEntries(metric.errors.byType);
        
        if (metric.apiKeyUsage) {
          metric.apiKeyUsage.keyRequests = Object.fromEntries(metric.apiKeyUsage.keyRequests);
          metric.apiKeyUsage.byKeyType = Object.fromEntries(metric.apiKeyUsage.byKeyType);
        }
        
        if (metric.users) {
          metric.users.total = metric.users.total.size;
          metric.users.byRole = Object.fromEntries(metric.users.byRole);
        }
        
        if (metric.geographic) {
          metric.geographic.countries = Object.fromEntries(metric.geographic.countries);
          metric.geographic.regions = Object.fromEntries(metric.geographic.regions);
        }
        
        if (metric.sources) {
          metric.sources.userAgents = Object.fromEntries(metric.sources.userAgents);
          metric.sources.totalIPs = metric.sources.ips.size;
          delete metric.sources.ips;
        }

        // Calculate performance metrics
        if (metric.performance && metric.performance.responseTimes.length > 0) {
          const times = metric.performance.responseTimes.sort((a, b) => a - b);
          metric.performance.averageResponseTime = metric.performance.totalResponseTime / times.length;
          metric.performance.minResponseTime = times[0];
          metric.performance.maxResponseTime = times[times.length - 1];
          metric.performance.p50ResponseTime = times[Math.floor(times.length * 0.5)];
          metric.performance.p95ResponseTime = times[Math.floor(times.length * 0.95)];
          metric.performance.p99ResponseTime = times[Math.floor(times.length * 0.99)];
          
          // Keep only sample for storage (limit to 100 samples)
          if (times.length > 100) {
            metric.performance.responseTimes = times.filter((_, i) => i % Math.ceil(times.length / 100) === 0);
          }
        }

        // Convert webhook endpoint maps
        if (metric.webhooks && metric.webhooks.byEndpoint) {
          metric.webhooks.byEndpoint = Object.fromEntries(metric.webhooks.byEndpoint);
        }

        return APIMetrics.findOneAndUpdate(
          {
            hotelId: metric.hotelId,
            period: metric.period,
            timestamp: metric.timestamp,
            'endpoint.method': metric.endpoint?.method,
            'endpoint.path': metric.endpoint?.path
          },
          { $set: metric },
          { upsert: true, new: true }
        );
      });

      await Promise.all(saves);
      
      // Generate aggregated metrics for longer periods
      await this.generateAggregatedMetrics();
      
      logger.info(`Flushed ${metricsToFlush.length} metric entries to database`);

    } catch (error) {
      logger.error('Error flushing metrics to database:', error);
    }
  }

  /**
   * Generate hourly, daily, and monthly aggregated metrics from minute data
   */
  async generateAggregatedMetrics() {
    try {
      const now = new Date();
      
      // Generate hourly metrics from last hour's minute data
      const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() - 1);
      const hourEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
      
      await this.aggregateMetrics('minute', 'hour', hourStart, hourEnd);
      
      // Generate daily metrics from yesterday's hourly data (run once a day)
      if (now.getHours() === 0 && now.getMinutes() < 5) {
        const dayStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        
        await this.aggregateMetrics('hour', 'day', dayStart, dayEnd);
      }

      // Generate monthly metrics (run once a month)
      if (now.getDate() === 1 && now.getHours() === 0 && now.getMinutes() < 5) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
        
        await this.aggregateMetrics('day', 'month', monthStart, monthEnd);
      }

    } catch (error) {
      logger.error('Error generating aggregated metrics:', error);
    }
  }

  /**
   * Aggregate metrics from one period to another
   */
  async aggregateMetrics(fromPeriod, toPeriod, startTime, endTime) {
    try {
      const pipeline = [
        {
          $match: {
            period: fromPeriod,
            timestamp: { $gte: startTime, $lt: endTime }
          }
        },
        {
          $group: {
            _id: {
              hotelId: '$hotelId',
              method: '$endpoint.method',
              path: '$endpoint.path',
              category: '$endpoint.category'
            },
            totalRequests: { $sum: '$requests.total' },
            successfulRequests: { $sum: '$requests.successful' },
            failedRequests: { $sum: '$requests.failed' },
            totalErrors: { $sum: '$errors.total' },
            responseTimes: { $push: '$performance.responseTimes' },
            totalBandwidth: { $sum: '$bandwidth.totalBytes' },
            totalWebhooks: { $sum: '$webhooks.totalDeliveries' }
          }
        }
      ];

      const aggregatedData = await APIMetrics.aggregate(pipeline);
      
      for (const data of aggregatedData) {
        const aggregatedMetric = {
          hotelId: data._id.hotelId,
          period: toPeriod,
          timestamp: this.normalizeTimestamp(startTime, toPeriod),
          endpoint: {
            method: data._id.method,
            path: data._id.path,
            category: data._id.category
          },
          requests: {
            total: data.totalRequests,
            successful: data.successfulRequests,
            failed: data.failedRequests
          },
          errors: {
            total: data.totalErrors
          },
          bandwidth: {
            totalBytes: data.totalBandwidth
          },
          webhooks: {
            totalDeliveries: data.totalWebhooks
          }
        };

        // Calculate performance metrics from aggregated response times
        const allResponseTimes = data.responseTimes.flat().filter(t => t != null);
        if (allResponseTimes.length > 0) {
          const sortedTimes = allResponseTimes.sort((a, b) => a - b);
          aggregatedMetric.performance = {
            averageResponseTime: allResponseTimes.reduce((sum, t) => sum + t, 0) / allResponseTimes.length,
            minResponseTime: sortedTimes[0],
            maxResponseTime: sortedTimes[sortedTimes.length - 1],
            p50ResponseTime: sortedTimes[Math.floor(sortedTimes.length * 0.5)],
            p95ResponseTime: sortedTimes[Math.floor(sortedTimes.length * 0.95)],
            p99ResponseTime: sortedTimes[Math.floor(sortedTimes.length * 0.99)]
          };
        }

        await APIMetrics.findOneAndUpdate(
          {
            hotelId: aggregatedMetric.hotelId,
            period: toPeriod,
            timestamp: aggregatedMetric.timestamp,
            'endpoint.method': aggregatedMetric.endpoint.method,
            'endpoint.path': aggregatedMetric.endpoint.path
          },
          { $set: aggregatedMetric },
          { upsert: true }
        );
      }

      logger.info(`Generated ${toPeriod} aggregated metrics from ${fromPeriod} data`, {
        count: aggregatedData.length,
        period: `${startTime} to ${endTime}`
      });

    } catch (error) {
      logger.error(`Error aggregating ${fromPeriod} to ${toPeriod} metrics:`, error);
    }
  }

  /**
   * Get real-time dashboard metrics
   */
  async getDashboardMetrics(hotelId, timeRange = '24h') {
    try {
      return await APIMetrics.getDashboardMetrics(hotelId, timeRange);
    } catch (error) {
      logger.error('Error getting dashboard metrics:', error);
      return null;
    }
  }

  /**
   * Get top endpoints
   */
  async getTopEndpoints(hotelId, timeRange = '24h', limit = 10) {
    try {
      return await APIMetrics.getTopEndpoints(hotelId, timeRange, limit);
    } catch (error) {
      logger.error('Error getting top endpoints:', error);
      return [];
    }
  }

  /**
   * Clean up old metrics data
   */
  async cleanupOldMetrics() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 365); // Keep 1 year of data

      const result = await APIMetrics.deleteMany({
        timestamp: { $lt: cutoffDate }
      });

      if (result.deletedCount > 0) {
        logger.info(`Cleaned up ${result.deletedCount} old metric records`);
      }

    } catch (error) {
      logger.error('Error cleaning up old metrics:', error);
    }
  }

  // Helper methods

  createBufferKey(hotelId, period, timestamp, method, path) {
    const normalizedTime = this.normalizeTimestamp(timestamp, period);
    return `${hotelId}_${period}_${normalizedTime.getTime()}_${method}_${path}`;
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
      case 'month':
        return new Date(date.getFullYear(), date.getMonth());
      default:
        return date;
    }
  }

  categorizeEndpoint(path) {
    if (path.includes('booking') || path.includes('reservation')) return 'reservations';
    if (path.includes('room')) return 'rooms';
    if (path.includes('guest')) return 'guests';
    if (path.includes('payment')) return 'payments';
    if (path.includes('inventory')) return 'inventory';
    if (path.includes('report')) return 'reports';
    if (path.includes('webhook')) return 'webhooks';
    if (path.includes('auth')) return 'authentication';
    return 'other';
  }

  categorizeError(error, statusCode) {
    if (statusCode === 400) return 'validation';
    if (statusCode === 401 || statusCode === 403) return 'authentication';
    if (statusCode === 404) return 'not_found';
    if (statusCode === 429) return 'rate_limit';
    if (statusCode >= 500) return 'server_error';
    if (error && error.includes('timeout')) return 'timeout';
    return 'unknown';
  }
}

// Create singleton instance
const apiMetricsService = new APIMetricsService();

export default apiMetricsService;