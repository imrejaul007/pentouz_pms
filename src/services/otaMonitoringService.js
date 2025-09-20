import ChannelConfiguration from '../models/ChannelConfiguration.js';
import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import { EventEmitter } from 'events';

// Monitoring data schema
const otaMetricSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true
  },
  channelId: {
    type: String,
    required: true
  },
  metricType: {
    type: String,
    enum: [
      'sync_performance',
      'translation_quality',
      'rate_distribution',
      'content_delivery',
      'error_tracking',
      'business_metrics'
    ],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  tags: {
    type: Map,
    of: String
  }
}, {
  timestamps: true
});

// Create indexes for efficient querying
otaMetricSchema.index({ hotelId: 1, channelId: 1, timestamp: -1 });
otaMetricSchema.index({ metricType: 1, timestamp: -1 });
otaMetricSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 }); // 30 days

const OTAMetric = mongoose.model('OTAMetric', otaMetricSchema);

class OTAMonitoringService extends EventEmitter {
  constructor() {
    super();
    this.alertThresholds = {
      syncFailureRate: 20, // %
      averageResponseTime: 5000, // ms
      translationAccuracy: 75, // %
      uptimePercentage: 95, // %
      errorRate: 5 // %
    };
    
    this.monitoringInterval = null;
    this.realTimeMetrics = new Map();
    
    // Start real-time monitoring
    this.startRealTimeMonitoring();
  }

  /**
   * Record a metric event
   */
  async recordMetric(hotelId, channelId, metricType, data, tags = {}) {
    try {
      const metric = new OTAMetric({
        hotelId,
        channelId,
        metricType,
        data,
        tags
      });

      await metric.save();

      // Update real-time metrics
      this.updateRealTimeMetrics(hotelId, channelId, metricType, data);

      // Check for alerts
      await this.checkAlerts(hotelId, channelId, metricType, data);

      // Emit metric event
      this.emit('metricRecorded', { hotelId, channelId, metricType, data, tags });

    } catch (error) {
      logger.error('Failed to record OTA metric:', error);
    }
  }

  /**
   * Record sync performance metrics
   */
  async recordSyncPerformance(hotelId, channelId, syncData) {
    const performanceData = {
      syncType: syncData.syncType || 'unknown',
      duration: syncData.duration,
      itemsSynced: syncData.itemsSynced || 0,
      itemsFailed: syncData.itemsFailed || 0,
      responseTime: syncData.responseTime,
      httpStatus: syncData.httpStatus,
      success: syncData.success,
      error: syncData.error || null,
      retryCount: syncData.retryCount || 0
    };

    await this.recordMetric(hotelId, channelId, 'sync_performance', performanceData, {
      syncType: syncData.syncType,
      success: syncData.success.toString()
    });
  }

  /**
   * Record translation quality metrics
   */
  async recordTranslationQuality(hotelId, channelId, translationData) {
    const qualityData = {
      sourceLanguage: translationData.sourceLanguage,
      targetLanguage: translationData.targetLanguage,
      contentType: translationData.contentType,
      originalLength: translationData.originalLength,
      translatedLength: translationData.translatedLength,
      confidenceScore: translationData.confidenceScore,
      processingTime: translationData.processingTime,
      method: translationData.method || 'automatic',
      approved: translationData.approved || false,
      reviewerRating: translationData.reviewerRating || null
    };

    await this.recordMetric(hotelId, channelId, 'translation_quality', qualityData, {
      sourceLanguage: translationData.sourceLanguage,
      targetLanguage: translationData.targetLanguage,
      contentType: translationData.contentType,
      method: translationData.method
    });
  }

  /**
   * Record rate distribution metrics
   */
  async recordRateDistribution(hotelId, channelId, rateData) {
    const distributionData = {
      baseCurrency: rateData.baseCurrency,
      targetCurrency: rateData.targetCurrency,
      conversionRate: rateData.conversionRate,
      originalRate: rateData.originalRate,
      convertedRate: rateData.convertedRate,
      markup: rateData.markup || 0,
      ratesProcessed: rateData.ratesProcessed || 1,
      processingTime: rateData.processingTime,
      success: rateData.success,
      errors: rateData.errors || []
    };

    await this.recordMetric(hotelId, channelId, 'rate_distribution', distributionData, {
      baseCurrency: rateData.baseCurrency,
      targetCurrency: rateData.targetCurrency,
      success: rateData.success.toString()
    });
  }

  /**
   * Record content delivery metrics
   */
  async recordContentDelivery(hotelId, channelId, contentData) {
    const deliveryData = {
      contentType: contentData.contentType,
      languages: contentData.languages || [],
      totalSize: contentData.totalSize || 0,
      compressionRatio: contentData.compressionRatio || 0,
      deliveryTime: contentData.deliveryTime,
      cacheHit: contentData.cacheHit || false,
      cdnUsed: contentData.cdnUsed || false,
      httpStatus: contentData.httpStatus,
      success: contentData.success
    };

    await this.recordMetric(hotelId, channelId, 'content_delivery', deliveryData, {
      contentType: contentData.contentType,
      cacheHit: contentData.cacheHit.toString(),
      success: contentData.success.toString()
    });
  }

  /**
   * Record error tracking metrics
   */
  async recordError(hotelId, channelId, errorData) {
    const errorMetric = {
      errorType: errorData.type || 'unknown',
      errorCode: errorData.code || null,
      errorMessage: errorData.message || '',
      stackTrace: errorData.stack || null,
      context: errorData.context || {},
      severity: errorData.severity || 'medium',
      recoverable: errorData.recoverable || false,
      userImpact: errorData.userImpact || 'unknown',
      resolution: errorData.resolution || null
    };

    await this.recordMetric(hotelId, channelId, 'error_tracking', errorMetric, {
      errorType: errorData.type,
      severity: errorData.severity,
      recoverable: errorData.recoverable.toString()
    });
  }

  /**
   * Record business metrics
   */
  async recordBusinessMetrics(hotelId, channelId, businessData) {
    const metrics = {
      bookingsReceived: businessData.bookingsReceived || 0,
      revenue: businessData.revenue || 0,
      currency: businessData.currency || 'USD',
      averageRate: businessData.averageRate || 0,
      occupancyRate: businessData.occupancyRate || 0,
      conversionRate: businessData.conversionRate || 0,
      clickThroughRate: businessData.clickThroughRate || 0,
      impressions: businessData.impressions || 0,
      period: businessData.period || 'daily'
    };

    await this.recordMetric(hotelId, channelId, 'business_metrics', metrics, {
      currency: businessData.currency,
      period: businessData.period
    });
  }

  /**
   * Get comprehensive dashboard data for a hotel
   */
  async getDashboardData(hotelId, timeRange = '7d') {
    try {
      const startDate = this.getStartDate(timeRange);
      const endDate = new Date();

      const [
        channelConfigs,
        syncMetrics,
        translationMetrics,
        rateMetrics,
        contentMetrics,
        errorMetrics,
        businessMetrics
      ] = await Promise.all([
        ChannelConfiguration.getActiveChannelsForHotel(hotelId),
        this.getSyncMetrics(hotelId, startDate, endDate),
        this.getTranslationMetrics(hotelId, startDate, endDate),
        this.getRateMetrics(hotelId, startDate, endDate),
        this.getContentMetrics(hotelId, startDate, endDate),
        this.getErrorMetrics(hotelId, startDate, endDate),
        this.getBusinessMetrics(hotelId, startDate, endDate)
      ]);

      // Calculate summary statistics
      const summary = this.calculateSummaryStats(
        channelConfigs,
        syncMetrics,
        translationMetrics,
        errorMetrics
      );

      // Get real-time status
      const realTimeStatus = this.getRealTimeStatus(hotelId);

      // Check for active alerts
      const alerts = await this.getActiveAlerts(hotelId);

      return {
        summary,
        realTimeStatus,
        alerts,
        channels: channelConfigs.map(config => ({
          channelId: config.channelId,
          channelName: config.channelName,
          status: config.status,
          performance: config.performance,
          languages: config.activeSupportedLanguages.length,
          currencies: config.activeSupportedCurrencies.length
        })),
        metrics: {
          sync: syncMetrics,
          translation: translationMetrics,
          rates: rateMetrics,
          content: contentMetrics,
          errors: errorMetrics,
          business: businessMetrics
        },
        timeRange: {
          start: startDate,
          end: endDate,
          period: timeRange
        }
      };

    } catch (error) {
      logger.error('Failed to get dashboard data:', error);
      throw error;
    }
  }

  /**
   * Get channel-specific performance report
   */
  async getChannelReport(hotelId, channelId, timeRange = '30d') {
    try {
      const startDate = this.getStartDate(timeRange);
      const endDate = new Date();

      const [
        channelConfig,
        metrics,
        trends,
        comparisons
      ] = await Promise.all([
        ChannelConfiguration.getByHotelAndChannel(hotelId, channelId),
        this.getChannelMetrics(hotelId, channelId, startDate, endDate),
        this.getChannelTrends(hotelId, channelId, startDate, endDate),
        this.getChannelComparisons(hotelId, channelId, timeRange)
      ]);

      if (!channelConfig) {
        throw new Error('Channel configuration not found');
      }

      // Calculate performance scores
      const performanceScores = this.calculatePerformanceScores(metrics);

      // Generate recommendations
      const recommendations = await this.generateRecommendations(
        channelId,
        metrics,
        trends,
        performanceScores
      );

      return {
        channel: {
          id: channelConfig.channelId,
          name: channelConfig.channelName,
          status: channelConfig.status,
          configuration: {
            languages: channelConfig.activeSupportedLanguages,
            currencies: channelConfig.activeSupportedCurrencies,
            autoTranslate: channelConfig.languageSettings.autoTranslate,
            autoConvert: channelConfig.currencySettings.autoConvert
          }
        },
        performance: {
          scores: performanceScores,
          metrics,
          trends,
          comparisons
        },
        recommendations,
        timeRange: {
          start: startDate,
          end: endDate,
          period: timeRange
        }
      };

    } catch (error) {
      logger.error('Failed to get channel report:', error);
      throw error;
    }
  }

  /**
   * Get translation analytics
   */
  async getTranslationAnalytics(hotelId, options = {}) {
    try {
      const {
        channelId,
        language,
        contentType,
        timeRange = '30d'
      } = options;

      const startDate = this.getStartDate(timeRange);
      const endDate = new Date();

      const query = {
        hotelId: mongoose.Types.ObjectId(hotelId),
        metricType: 'translation_quality',
        timestamp: { $gte: startDate, $lte: endDate }
      };

      if (channelId) query.channelId = channelId;
      if (language) query['data.targetLanguage'] = language;
      if (contentType) query['data.contentType'] = contentType;

      const [
        qualityTrends,
        languageBreakdown,
        contentTypeBreakdown,
        topPerformers,
        improvementAreas
      ] = await Promise.all([
        this.getTranslationQualityTrends(query, startDate, endDate),
        this.getLanguageTranslationBreakdown(query),
        this.getContentTypeTranslationBreakdown(query),
        this.getTopPerformingTranslations(query),
        this.getTranslationImprovementAreas(query)
      ]);

      return {
        overview: {
          totalTranslations: qualityTrends.reduce((sum, trend) => sum + trend.count, 0),
          averageQuality: this.calculateAverageQuality(qualityTrends),
          languagesCovered: languageBreakdown.length,
          contentTypesCovered: contentTypeBreakdown.length
        },
        trends: qualityTrends,
        breakdowns: {
          languages: languageBreakdown,
          contentTypes: contentTypeBreakdown
        },
        insights: {
          topPerformers,
          improvementAreas
        },
        timeRange: {
          start: startDate,
          end: endDate,
          period: timeRange
        }
      };

    } catch (error) {
      logger.error('Failed to get translation analytics:', error);
      throw error;
    }
  }

  // Private helper methods

  updateRealTimeMetrics(hotelId, channelId, metricType, data) {
    const key = `${hotelId}-${channelId}`;
    
    if (!this.realTimeMetrics.has(key)) {
      this.realTimeMetrics.set(key, {});
    }
    
    const channelMetrics = this.realTimeMetrics.get(key);
    channelMetrics[metricType] = {
      ...data,
      timestamp: new Date()
    };
  }

  async checkAlerts(hotelId, channelId, metricType, data) {
    const alertConditions = [];

    switch (metricType) {
      case 'sync_performance':
        if (!data.success) {
          alertConditions.push({
            type: 'sync_failure',
            severity: 'high',
            message: `Sync failed for ${channelId}: ${data.error}`
          });
        }
        if (data.responseTime > this.alertThresholds.averageResponseTime) {
          alertConditions.push({
            type: 'slow_response',
            severity: 'medium',
            message: `Slow response time for ${channelId}: ${data.responseTime}ms`
          });
        }
        break;

      case 'translation_quality':
        if (data.confidenceScore < this.alertThresholds.translationAccuracy) {
          alertConditions.push({
            type: 'poor_translation',
            severity: 'medium',
            message: `Low translation quality for ${channelId}: ${data.confidenceScore}%`
          });
        }
        break;

      case 'error_tracking':
        if (data.severity === 'high' || data.severity === 'critical') {
          alertConditions.push({
            type: 'critical_error',
            severity: data.severity,
            message: `${data.severity} error in ${channelId}: ${data.errorMessage}`
          });
        }
        break;
    }

    // Process alerts
    for (const alert of alertConditions) {
      await this.processAlert(hotelId, channelId, alert);
    }
  }

  async processAlert(hotelId, channelId, alert) {
    try {
      // Record alert
      await this.recordMetric(hotelId, channelId, 'alert', alert, {
        alertType: alert.type,
        severity: alert.severity
      });

      // Emit alert event
      this.emit('alert', {
        hotelId,
        channelId,
        alert,
        timestamp: new Date()
      });

      logger.warn(`OTA Alert: ${alert.message}`, {
        hotelId,
        channelId,
        alertType: alert.type,
        severity: alert.severity
      });

    } catch (error) {
      logger.error('Failed to process alert:', error);
    }
  }

  startRealTimeMonitoring() {
    if (this.monitoringInterval) return;

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performHealthChecks();
      } catch (error) {
        logger.error('Health check failed:', error);
      }
    }, 60000); // Every minute
  }

  async performHealthChecks() {
    const activeChannels = await ChannelConfiguration.find({
      'status.isActive': true,
      'status.connectionStatus': 'connected'
    });

    for (const channel of activeChannels) {
      try {
        // Check if last sync was recent enough
        const lastSyncTime = channel.status.lastSync?.rates || 
                            channel.status.lastSync?.inventory || 
                            channel.status.lastSync?.content;

        if (lastSyncTime) {
          const timeSinceLastSync = Date.now() - new Date(lastSyncTime).getTime();
          const maxSyncInterval = this.getMaxSyncInterval(channel.integrationSettings.syncSchedule);

          if (timeSinceLastSync > maxSyncInterval) {
            await this.recordError(channel.hotelId, channel.channelId, {
              type: 'sync_delay',
              severity: 'medium',
              message: `Sync overdue by ${Math.round(timeSinceLastSync / 60000)} minutes`,
              context: { lastSyncTime, timeSinceLastSync }
            });
          }
        }

      } catch (error) {
        logger.error(`Health check failed for ${channel.channelId}:`, error);
      }
    }
  }

  getStartDate(timeRange) {
    const now = new Date();
    
    switch (timeRange) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  }

  async getSyncMetrics(hotelId, startDate, endDate) {
    return await OTAMetric.aggregate([
      {
        $match: {
          hotelId: mongoose.Types.ObjectId(hotelId),
          metricType: 'sync_performance',
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$channelId',
          totalSyncs: { $sum: 1 },
          successfulSyncs: { 
            $sum: { $cond: ['$data.success', 1, 0] }
          },
          averageResponseTime: { $avg: '$data.responseTime' },
          totalItems: { $sum: '$data.itemsSynced' }
        }
      },
      {
        $addFields: {
          successRate: {
            $multiply: [
              { $divide: ['$successfulSyncs', '$totalSyncs'] },
              100
            ]
          }
        }
      }
    ]);
  }

  async getTranslationMetrics(hotelId, startDate, endDate) {
    return await OTAMetric.aggregate([
      {
        $match: {
          hotelId: mongoose.Types.ObjectId(hotelId),
          metricType: 'translation_quality',
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            channelId: '$channelId',
            targetLanguage: '$data.targetLanguage'
          },
          totalTranslations: { $sum: 1 },
          averageConfidence: { $avg: '$data.confidenceScore' },
          averageProcessingTime: { $avg: '$data.processingTime' }
        }
      }
    ]);
  }

  async getRateMetrics(hotelId, startDate, endDate) {
    return await OTAMetric.aggregate([
      {
        $match: {
          hotelId: mongoose.Types.ObjectId(hotelId),
          metricType: 'rate_distribution',
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$channelId',
          totalRates: { $sum: '$data.ratesProcessed' },
          successfulDistributions: {
            $sum: { $cond: ['$data.success', 1, 0] }
          },
          averageProcessingTime: { $avg: '$data.processingTime' }
        }
      }
    ]);
  }

  async getContentMetrics(hotelId, startDate, endDate) {
    return await OTAMetric.aggregate([
      {
        $match: {
          hotelId: mongoose.Types.ObjectId(hotelId),
          metricType: 'content_delivery',
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$channelId',
          totalDeliveries: { $sum: 1 },
          successfulDeliveries: {
            $sum: { $cond: ['$data.success', 1, 0] }
          },
          cacheHitRate: {
            $avg: { $cond: ['$data.cacheHit', 1, 0] }
          },
          averageDeliveryTime: { $avg: '$data.deliveryTime' }
        }
      }
    ]);
  }

  async getErrorMetrics(hotelId, startDate, endDate) {
    return await OTAMetric.aggregate([
      {
        $match: {
          hotelId: mongoose.Types.ObjectId(hotelId),
          metricType: 'error_tracking',
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            channelId: '$channelId',
            errorType: '$data.errorType',
            severity: '$data.severity'
          },
          count: { $sum: 1 },
          recoverable: {
            $sum: { $cond: ['$data.recoverable', 1, 0] }
          }
        }
      }
    ]);
  }

  async getBusinessMetrics(hotelId, startDate, endDate) {
    return await OTAMetric.aggregate([
      {
        $match: {
          hotelId: mongoose.Types.ObjectId(hotelId),
          metricType: 'business_metrics',
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$channelId',
          totalBookings: { $sum: '$data.bookingsReceived' },
          totalRevenue: { $sum: '$data.revenue' },
          averageRate: { $avg: '$data.averageRate' },
          averageOccupancy: { $avg: '$data.occupancyRate' }
        }
      }
    ]);
  }

  calculateSummaryStats(channelConfigs, syncMetrics, translationMetrics, errorMetrics) {
    const totalChannels = channelConfigs.length;
    const connectedChannels = channelConfigs.filter(c => c.status.connectionStatus === 'connected').length;
    
    const totalSyncs = syncMetrics.reduce((sum, metric) => sum + metric.totalSyncs, 0);
    const successfulSyncs = syncMetrics.reduce((sum, metric) => sum + metric.successfulSyncs, 0);
    const overallSyncRate = totalSyncs > 0 ? (successfulSyncs / totalSyncs) * 100 : 0;
    
    const totalTranslations = translationMetrics.reduce((sum, metric) => sum + metric.totalTranslations, 0);
    const averageTranslationQuality = translationMetrics.length > 0 
      ? translationMetrics.reduce((sum, metric) => sum + metric.averageConfidence, 0) / translationMetrics.length
      : 0;
    
    const totalErrors = errorMetrics.reduce((sum, metric) => sum + metric.count, 0);
    const criticalErrors = errorMetrics.filter(metric => metric._id.severity === 'critical').reduce((sum, metric) => sum + metric.count, 0);

    return {
      channels: {
        total: totalChannels,
        connected: connectedChannels,
        connectionRate: totalChannels > 0 ? (connectedChannels / totalChannels) * 100 : 0
      },
      sync: {
        totalSyncs,
        successRate: overallSyncRate,
        averageResponseTime: syncMetrics.reduce((sum, metric) => sum + metric.averageResponseTime, 0) / syncMetrics.length || 0
      },
      translation: {
        totalTranslations,
        averageQuality: averageTranslationQuality
      },
      errors: {
        total: totalErrors,
        critical: criticalErrors,
        errorRate: totalSyncs > 0 ? (totalErrors / totalSyncs) * 100 : 0
      }
    };
  }

  getRealTimeStatus(hotelId) {
    const status = {};
    
    for (const [key, metrics] of this.realTimeMetrics.entries()) {
      if (key.startsWith(hotelId)) {
        const channelId = key.split('-')[1];
        status[channelId] = {
          lastActivity: Math.max(...Object.values(metrics).map(m => new Date(m.timestamp).getTime())),
          status: this.determineChannelStatus(metrics)
        };
      }
    }
    
    return status;
  }

  determineChannelStatus(metrics) {
    if (metrics.error_tracking && metrics.error_tracking.severity === 'critical') {
      return 'error';
    }
    
    if (metrics.sync_performance && !metrics.sync_performance.success) {
      return 'warning';
    }
    
    return 'healthy';
  }

  getMaxSyncInterval(syncSchedule) {
    const intervals = {
      'real_time': 5 * 60 * 1000, // 5 minutes
      'every_5_min': 10 * 60 * 1000, // 10 minutes grace
      'hourly': 90 * 60 * 1000, // 1.5 hours
      'daily': 26 * 60 * 60 * 1000 // 26 hours
    };

    return intervals[syncSchedule?.inventory] || intervals['hourly'];
  }

  // Add more helper methods as needed...
  
  destroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.removeAllListeners();
  }
}

export default new OTAMonitoringService();