/**
 * Advanced Reporting Service
 * High-performance reporting engine with caching and optimization
 */

import { createClient } from 'redis';
import Queue from 'bull';
import { FactBookings, FactRevenue, DimDate, DimGuest, MonthlyRevenueAggregate } from '../../models/analytics/DataWarehouse.js';
import logger from '../../utils/logger.js';

import { performance } from 'perf_hooks';

class AdvancedReportingService {
  constructor() {
    this.logger = logger;
    
    // Initialize Redis for caching
    this.cache = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    // Initialize report generation queue
    this.reportQueue = new Queue('report generation', process.env.REDIS_URL || 'redis://localhost:6379');
    
    // Cache TTL settings (in seconds)
    this.cacheTTL = {
      realtime: 60,        // 1 minute
      hourly: 3600,        // 1 hour
      daily: 86400,        // 24 hours
      weekly: 604800,      // 7 days
      monthly: 2592000     // 30 days
    };
    
    // Initialize report templates
    this.initializeReportTemplates();
    this.setupQueueProcessors();
  }
  
  /**
   * Initialize predefined report templates
   */
  initializeReportTemplates() {
    this.reportTemplates = {
      // Executive Dashboard Reports
      executive_summary: {
        name: 'Executive Summary',
        description: 'High-level KPIs and trends',
        cache_ttl: this.cacheTTL.hourly,
        query: this.generateExecutiveSummary.bind(this)
      },
      
      // Revenue Analysis Reports
      revenue_analysis: {
        name: 'Revenue Analysis',
        description: 'Detailed revenue breakdown and trends',
        cache_ttl: this.cacheTTL.hourly,
        query: this.generateRevenueAnalysis.bind(this)
      },
      
      occupancy_analysis: {
        name: 'Occupancy Analysis',
        description: 'Occupancy patterns and forecasting',
        cache_ttl: this.cacheTTL.hourly,
        query: this.generateOccupancyAnalysis.bind(this)
      },
      
      // Guest Analytics Reports
      guest_segmentation: {
        name: 'Guest Segmentation',
        description: 'Guest behavior and segmentation analysis',
        cache_ttl: this.cacheTTL.daily,
        query: this.generateGuestSegmentation.bind(this)
      },
      
      guest_lifetime_value: {
        name: 'Guest Lifetime Value',
        description: 'CLV analysis and retention metrics',
        cache_ttl: this.cacheTTL.daily,
        query: this.generateGuestLifetimeValue.bind(this)
      },
      
      // Operational Reports
      channel_performance: {
        name: 'Channel Performance',
        description: 'Booking channel analysis and optimization',
        cache_ttl: this.cacheTTL.hourly,
        query: this.generateChannelPerformance.bind(this)
      },
      
      seasonal_trends: {
        name: 'Seasonal Trends',
        description: 'Seasonal patterns and year-over-year comparisons',
        cache_ttl: this.cacheTTL.daily,
        query: this.generateSeasonalTrends.bind(this)
      },
      
      // Financial Reports
      profitability: {
        name: 'Profitability Analysis',
        description: 'Profit margins and cost analysis',
        cache_ttl: this.cacheTTL.daily,
        query: this.generateProfitabilityAnalysis.bind(this)
      },
      
      // Forecasting Reports
      demand_forecast: {
        name: 'Demand Forecasting',
        description: 'Future demand predictions',
        cache_ttl: this.cacheTTL.hourly,
        query: this.generateDemandForecast.bind(this)
      }
    };
  }
  
  /**
   * Setup queue processors for background report generation
   */
  setupQueueProcessors() {
    this.reportQueue.process('generate-report', async (job) => {
      const { reportType, parameters, userId } = job.data;
      
      try {
        const report = await this.executeReport(reportType, parameters);
        
        // Store result for user retrieval
        await this.cache.setex(
          `report:result:${job.id}`,
          3600, // 1 hour
          JSON.stringify({
            status: 'completed',
            data: report,
            generatedAt: new Date(),
            userId
          })
        );
        
        return report;
      } catch (error) {
        this.logger.error(`Report generation failed for job ${job.id}:`, error);
        throw error;
      }
    });
    
    this.reportQueue.on('completed', (job, result) => {
      this.logger.info(`Report generation completed: ${job.data.reportType}`);
    });
    
    this.reportQueue.on('failed', (job, err) => {
      this.logger.error(`Report generation failed: ${job.data.reportType}`, err);
    });
  }
  
  /**
   * Generate report with caching
   */
  async generateReport(reportType, parameters = {}, options = {}) {
    const startTime = performance.now();
    
    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey(reportType, parameters);
      
      // Check cache first (unless forced refresh)
      if (!options.forceRefresh) {
        const cachedResult = await this.cache.get(cacheKey);
        if (cachedResult) {
          const result = JSON.parse(cachedResult);
          result.cached = true;
          result.generationTime = performance.now() - startTime;
          
          this.logger.info(`Report served from cache: ${reportType}`);
          return result;
        }
      }
      
      // Check if report should be generated in background
      if (options.async) {
        const job = await this.reportQueue.add('generate-report', {
          reportType,
          parameters,
          userId: options.userId
        });
        
        return {
          jobId: job.id,
          status: 'queued',
          estimatedTime: this.estimateReportTime(reportType, parameters)
        };
      }
      
      // Generate report
      const report = await this.executeReport(reportType, parameters);
      
      // Cache result
      const template = this.reportTemplates[reportType];
      if (template) {
        await this.cache.setex(cacheKey, template.cache_ttl, JSON.stringify(report));
      }
      
      report.cached = false;
      report.generationTime = performance.now() - startTime;
      
      this.logger.info(`Report generated: ${reportType} (${report.generationTime.toFixed(2)}ms)`);
      return report;
      
    } catch (error) {
      this.logger.error(`Report generation failed: ${reportType}`, error);
      throw error;
    }
  }
  
  /**
   * Execute specific report query
   */
  async executeReport(reportType, parameters) {
    const template = this.reportTemplates[reportType];
    if (!template) {
      throw new Error(`Unknown report type: ${reportType}`);
    }
    
    // Validate and normalize parameters
    const normalizedParams = this.normalizeParameters(parameters);
    
    // Execute report query
    const result = await template.query(normalizedParams);
    
    return {
      reportType,
      parameters: normalizedParams,
      data: result,
      generatedAt: new Date(),
      metadata: {
        template: template.name,
        description: template.description
      }
    };
  }
  
  /**
   * Generate Executive Summary Report
   */
  async generateExecutiveSummary(params) {
    const { dateRange, hotelIds } = params;
    
    // Key Performance Indicators
    const kpis = await this.calculateExecutiveKPIs(dateRange, hotelIds);
    
    // Revenue trends (last 12 months)
    const revenueTrends = await this.getRevenueTrends(dateRange, hotelIds);
    
    // Occupancy trends
    const occupancyTrends = await this.getOccupancyTrends(dateRange, hotelIds);
    
    // Guest satisfaction metrics
    const guestMetrics = await this.getGuestSatisfactionMetrics(dateRange, hotelIds);
    
    // Market position
    const marketPosition = await this.getMarketPosition(dateRange, hotelIds);
    
    // Alerts and recommendations
    const insights = await this.generateExecutiveInsights(kpis, revenueTrends, occupancyTrends);
    
    return {
      kpis,
      trends: {
        revenue: revenueTrends,
        occupancy: occupancyTrends
      },
      guestMetrics,
      marketPosition,
      insights,
      summary: this.generateExecutiveSummaryText(kpis, insights)
    };
  }
  
  /**
   * Calculate Executive KPIs
   */
  async calculateExecutiveKPIs(dateRange, hotelIds) {
    const { startDate, endDate } = dateRange;
    const startDateKey = parseInt(startDate.toISOString().slice(0, 10).replace(/-/g, ''));
    const endDateKey = parseInt(endDate.toISOString().slice(0, 10).replace(/-/g, ''));
    
    // Current period metrics
    const currentMetrics = await FactRevenue.aggregate([
      {
        $match: {
          hotel_key: { $in: hotelIds },
          date_key: { $gte: startDateKey, $lte: endDateKey }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$gross_revenue' },
          totalRoomsSold: { $sum: '$rooms_sold' },
          totalRoomsAvailable: { $sum: '$rooms_available' },
          avgADR: { $avg: '$adr' },
          avgRevPAR: { $avg: '$revpar' },
          avgOccupancy: { $avg: '$occupancy_rate' },
          avgProfitMargin: { $avg: '$profit_margin' }
        }
      }
    ]);
    
    // Previous period for comparison (same duration, previous period)
    const periodLength = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const prevStartDate = new Date(startDate.getTime() - (periodLength * 24 * 60 * 60 * 1000));
    const prevEndDate = new Date(endDate.getTime() - (periodLength * 24 * 60 * 60 * 1000));
    const prevStartDateKey = parseInt(prevStartDate.toISOString().slice(0, 10).replace(/-/g, ''));
    const prevEndDateKey = parseInt(prevEndDate.toISOString().slice(0, 10).replace(/-/g, ''));
    
    const previousMetrics = await FactRevenue.aggregate([
      {
        $match: {
          hotel_key: { $in: hotelIds },
          date_key: { $gte: prevStartDateKey, $lte: prevEndDateKey }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$gross_revenue' },
          avgADR: { $avg: '$adr' },
          avgRevPAR: { $avg: '$revpar' },
          avgOccupancy: { $avg: '$occupancy_rate' }
        }
      }
    ]);
    
    const current = currentMetrics[0] || {};
    const previous = previousMetrics[0] || {};
    
    // Calculate percentage changes
    const calculateChange = (current, previous) => {
      if (!previous || previous === 0) return null;
      return ((current - previous) / previous) * 100;
    };
    
    return {
      revenue: {
        current: current.totalRevenue || 0,
        change: calculateChange(current.totalRevenue, previous.totalRevenue)
      },
      occupancy: {
        current: current.avgOccupancy || 0,
        change: calculateChange(current.avgOccupancy, previous.avgOccupancy)
      },
      adr: {
        current: current.avgADR || 0,
        change: calculateChange(current.avgADR, previous.avgADR)
      },
      revpar: {
        current: current.avgRevPAR || 0,
        change: calculateChange(current.avgRevPAR, previous.avgRevPAR)
      },
      profitMargin: {
        current: current.avgProfitMargin || 0,
        change: calculateChange(current.avgProfitMargin, previous.avgProfitMargin)
      },
      totalBookings: current.totalRoomsSold || 0
    };
  }
  
  /**
   * Generate Revenue Analysis Report
   */
  async generateRevenueAnalysis(params) {
    const { dateRange, hotelIds, breakdown = 'daily' } = params;
    
    // Revenue by time period
    const revenueByPeriod = await this.getRevenueByPeriod(dateRange, hotelIds, breakdown);
    
    // Revenue by segment
    const revenueBySegment = await this.getRevenueBySegment(dateRange, hotelIds);
    
    // Revenue by channel
    const revenueByChannel = await this.getRevenueByChannel(dateRange, hotelIds);
    
    // Revenue by room type
    const revenueByRoomType = await this.getRevenueByRoomType(dateRange, hotelIds);
    
    // Revenue forecast
    const revenueForecast = await this.generateRevenueForecast(dateRange, hotelIds);
    
    return {
      summary: {
        totalRevenue: revenueByPeriod.reduce((sum, item) => sum + item.revenue, 0),
        avgDailyRevenue: revenueByPeriod.reduce((sum, item) => sum + item.revenue, 0) / revenueByPeriod.length,
        growthRate: this.calculateGrowthRate(revenueByPeriod)
      },
      breakdown: {
        byPeriod: revenueByPeriod,
        bySegment: revenueBySegment,
        byChannel: revenueByChannel,
        byRoomType: revenueByRoomType
      },
      forecast: revenueForecast,
      insights: this.generateRevenueInsights(revenueByPeriod, revenueBySegment, revenueByChannel)
    };
  }
  
  /**
   * Generate Occupancy Analysis Report
   */
  async generateOccupancyAnalysis(params) {
    const { dateRange, hotelIds } = params;
    
    const startDateKey = parseInt(dateRange.startDate.toISOString().slice(0, 10).replace(/-/g, ''));
    const endDateKey = parseInt(dateRange.endDate.toISOString().slice(0, 10).replace(/-/g, ''));
    
    // Daily occupancy trends
    const dailyOccupancy = await FactRevenue.aggregate([
      {
        $match: {
          hotel_key: { $in: hotelIds },
          date_key: { $gte: startDateKey, $lte: endDateKey }
        }
      },
      {
        $lookup: {
          from: 'dimdates',
          localField: 'date_key',
          foreignField: 'date_key',
          as: 'dateInfo'
        }
      },
      {
        $unwind: '$dateInfo'
      },
      {
        $group: {
          _id: '$date_key',
          occupancyRate: { $avg: '$occupancy_rate' },
          roomsSold: { $sum: '$rooms_sold' },
          roomsAvailable: { $sum: '$rooms_available' },
          date: { $first: '$dateInfo.full_date' },
          isWeekend: { $first: '$dateInfo.is_weekend' },
          season: { $first: '$dateInfo.season' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    // Occupancy by day of week
    const occupancyByDayOfWeek = await FactRevenue.aggregate([
      {
        $match: {
          hotel_key: { $in: hotelIds },
          date_key: { $gte: startDateKey, $lte: endDateKey }
        }
      },
      {
        $lookup: {
          from: 'dimdates',
          localField: 'date_key',
          foreignField: 'date_key',
          as: 'dateInfo'
        }
      },
      {
        $unwind: '$dateInfo'
      },
      {
        $group: {
          _id: '$dateInfo.day_of_week',
          dayName: { $first: '$dateInfo.day_name' },
          avgOccupancy: { $avg: '$occupancy_rate' },
          avgRevPAR: { $avg: '$revpar' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    // Occupancy forecast
    const occupancyForecast = await this.generateOccupancyForecast(dateRange, hotelIds);
    
    return {
      summary: {
        avgOccupancy: dailyOccupancy.reduce((sum, day) => sum + day.occupancyRate, 0) / dailyOccupancy.length,
        peakOccupancy: Math.max(...dailyOccupancy.map(day => day.occupancyRate)),
        lowOccupancy: Math.min(...dailyOccupancy.map(day => day.occupancyRate)),
        totalRoomsSold: dailyOccupancy.reduce((sum, day) => sum + day.roomsSold, 0)
      },
      trends: {
        daily: dailyOccupancy,
        byDayOfWeek: occupancyByDayOfWeek
      },
      forecast: occupancyForecast,
      insights: this.generateOccupancyInsights(dailyOccupancy, occupancyByDayOfWeek)
    };
  }
  
  /**
   * Generate Guest Segmentation Report
   */
  async generateGuestSegmentation(params) {
    const { dateRange, hotelIds } = params;
    
    // Guest segments distribution
    const segmentDistribution = await FactBookings.aggregate([
      {
        $match: {
          hotel_key: { $in: hotelIds },
          check_in_date: {
            $gte: dateRange.startDate,
            $lte: dateRange.endDate
          }
        }
      },
      {
        $group: {
          _id: '$guest_segment',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$revenue_amount' },
          avgBookingValue: { $avg: '$revenue_amount' },
          avgLengthOfStay: { $avg: '$nights_stayed' }
        }
      },
      {
        $sort: { totalRevenue: -1 }
      }
    ]);
    
    // RFM Analysis (Recency, Frequency, Monetary)
    const rfmAnalysis = await this.performRFMAnalysis(dateRange, hotelIds);
    
    // Guest behavior patterns
    const behaviorPatterns = await this.analyzeBehaviorPatterns(dateRange, hotelIds);
    
    return {
      segmentDistribution,
      rfmAnalysis,
      behaviorPatterns,
      insights: this.generateGuestSegmentationInsights(segmentDistribution, rfmAnalysis)
    };
  }
  
  /**
   * Helper methods for report generation
   */
  
  async getRevenueTrends(dateRange, hotelIds) {
    const { startDate, endDate } = dateRange;
    const startDateKey = parseInt(startDate.toISOString().slice(0, 10).replace(/-/g, ''));
    const endDateKey = parseInt(endDate.toISOString().slice(0, 10).replace(/-/g, ''));
    
    return await FactRevenue.aggregate([
      {
        $match: {
          hotel_key: { $in: hotelIds },
          date_key: { $gte: startDateKey, $lte: endDateKey }
        }
      },
      {
        $lookup: {
          from: 'dimdates',
          localField: 'date_key',
          foreignField: 'date_key',
          as: 'dateInfo'
        }
      },
      {
        $unwind: '$dateInfo'
      },
      {
        $group: {
          _id: {
            year: '$dateInfo.year',
            month: '$dateInfo.month'
          },
          revenue: { $sum: '$gross_revenue' },
          occupancy: { $avg: '$occupancy_rate' },
          adr: { $avg: '$adr' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);
  }
  
  async performRFMAnalysis(dateRange, hotelIds) {
    // This would implement RFM (Recency, Frequency, Monetary) analysis
    // Simplified version for now
    return await FactBookings.aggregate([
      {
        $match: {
          hotel_key: { $in: hotelIds },
          check_in_date: {
            $gte: new Date(dateRange.startDate.getTime() - 365 * 24 * 60 * 60 * 1000), // Last year
            $lte: dateRange.endDate
          }
        }
      },
      {
        $group: {
          _id: '$guest_key',
          frequency: { $sum: 1 },
          monetary: { $sum: '$revenue_amount' },
          lastBooking: { $max: '$check_in_date' }
        }
      },
      {
        $addFields: {
          recency: {
            $divide: [
              { $subtract: [new Date(), '$lastBooking'] },
              1000 * 60 * 60 * 24 // Convert to days
            ]
          }
        }
      },
      {
        $bucket: {
          groupBy: '$monetary',
          boundaries: [0, 1000, 5000, 10000, 50000, 100000],
          default: 'high_value',
          output: {
            count: { $sum: 1 },
            avgFrequency: { $avg: '$frequency' },
            avgRecency: { $avg: '$recency' }
          }
        }
      }
    ]);
  }
  
  // Utility methods
  
  generateCacheKey(reportType, parameters) {
    const paramString = JSON.stringify(parameters, Object.keys(parameters).sort());
    return `report:${reportType}:${Buffer.from(paramString).toString('base64')}`;
  }
  
  normalizeParameters(params) {
    return {
      dateRange: {
        startDate: new Date(params.startDate || Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(params.endDate || Date.now())
      },
      hotelIds: Array.isArray(params.hotelIds) ? params.hotelIds : [params.hotelId].filter(Boolean),
      ...params
    };
  }
  
  estimateReportTime(reportType, parameters) {
    // Estimate based on report complexity and data volume
    const estimates = {
      executive_summary: 5000, // 5 seconds
      revenue_analysis: 8000,  // 8 seconds
      occupancy_analysis: 6000, // 6 seconds
      guest_segmentation: 15000, // 15 seconds
      profitability: 12000 // 12 seconds
    };
    
    return estimates[reportType] || 10000;
  }
  
  calculateGrowthRate(timeSeries) {
    if (timeSeries.length < 2) return 0;
    
    const firstValue = timeSeries[0].revenue;
    const lastValue = timeSeries[timeSeries.length - 1].revenue;
    
    return ((lastValue - firstValue) / firstValue) * 100;
  }
  
  // Additional helper methods for insights generation
  generateExecutiveInsights(kpis, revenueTrends, occupancyTrends) {
    const insights = [];
    
    // Revenue insights
    if (kpis.revenue.change > 10) {
      insights.push({
        type: 'positive',
        category: 'revenue',
        message: `Revenue is up ${kpis.revenue.change.toFixed(1)}% compared to the previous period`,
        impact: 'high'
      });
    } else if (kpis.revenue.change < -5) {
      insights.push({
        type: 'warning',
        category: 'revenue',
        message: `Revenue declined by ${Math.abs(kpis.revenue.change).toFixed(1)}% - investigate booking trends`,
        impact: 'high'
      });
    }
    
    // Occupancy insights
    if (kpis.occupancy.current > 85) {
      insights.push({
        type: 'opportunity',
        category: 'pricing',
        message: 'High occupancy detected - consider implementing dynamic pricing to maximize revenue',
        impact: 'medium'
      });
    }
    
    return insights;
  }
  
  /**
   * Get available report types
   */
  getAvailableReports() {
    return Object.keys(this.reportTemplates).map(key => ({
      id: key,
      name: this.reportTemplates[key].name,
      description: this.reportTemplates[key].description
    }));
  }
  
  /**
   * Get report generation status
   */
  async getReportStatus(jobId) {
    const job = await this.reportQueue.getJob(jobId);
    if (!job) return null;
    
    const state = await job.getState();
    
    if (state === 'completed') {
      const result = await this.cache.get(`report:result:${jobId}`);
      return result ? JSON.parse(result) : null;
    }
    
    return {
      status: state,
      progress: job.progress(),
      createdAt: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn
    };
  }
  
  /**
   * Clear report cache
   */
  async clearCache(pattern = 'report:*') {
    const keys = await this.cache.keys(pattern);
    if (keys.length > 0) {
      await this.cache.del(...keys);
    }
    return keys.length;
  }

  /**
   * Generate Guest Lifetime Value Report
   */
  async generateGuestLifetimeValue(params) {
    const { dateRange, hotelIds } = params;
    
    // Calculate CLV metrics
    const clvMetrics = await FactBookings.aggregate([
      {
        $match: {
          hotel_key: { $in: hotelIds },
          check_in_date: {
            $gte: dateRange.startDate,
            $lte: dateRange.endDate
          }
        }
      },
      {
        $group: {
          _id: '$guest_key',
          totalRevenue: { $sum: '$revenue_amount' },
          bookingCount: { $sum: 1 },
          avgBookingValue: { $avg: '$revenue_amount' },
          firstBooking: { $min: '$check_in_date' },
          lastBooking: { $max: '$check_in_date' }
        }
      },
      {
        $addFields: {
          customerLifetime: {
            $divide: [
              { $subtract: ['$lastBooking', '$firstBooking'] },
              1000 * 60 * 60 * 24 // Convert to days
            ]
          }
        }
      }
    ]);

    return {
      summary: {
        totalGuests: clvMetrics.length,
        avgCLV: clvMetrics.reduce((sum, guest) => sum + guest.totalRevenue, 0) / clvMetrics.length,
        avgBookingFrequency: clvMetrics.reduce((sum, guest) => sum + guest.bookingCount, 0) / clvMetrics.length
      },
      distribution: clvMetrics,
      insights: this.generateCLVInsights(clvMetrics)
    };
  }

  /**
   * Generate Channel Performance Report
   */
  async generateChannelPerformance(params) {
    const { dateRange, hotelIds } = params;
    
    const channelMetrics = await FactBookings.aggregate([
      {
        $match: {
          hotel_key: { $in: hotelIds },
          check_in_date: {
            $gte: dateRange.startDate,
            $lte: dateRange.endDate
          }
        }
      },
      {
        $group: {
          _id: '$booking_channel',
          totalBookings: { $sum: 1 },
          totalRevenue: { $sum: '$revenue_amount' },
          avgBookingValue: { $avg: '$revenue_amount' },
          conversionRate: { $avg: '$conversion_rate' }
        }
      },
      {
        $sort: { totalRevenue: -1 }
      }
    ]);

    return {
      summary: {
        totalChannels: channelMetrics.length,
        topChannel: channelMetrics[0]?.booking_channel || 'N/A',
        totalRevenue: channelMetrics.reduce((sum, channel) => sum + channel.totalRevenue, 0)
      },
      channels: channelMetrics,
      insights: this.generateChannelInsights(channelMetrics)
    };
  }

  /**
   * Generate Seasonal Trends Report
   */
  async generateSeasonalTrends(params) {
    const { dateRange, hotelIds } = params;
    
    const seasonalData = await FactRevenue.aggregate([
      {
        $match: {
          hotel_key: { $in: hotelIds },
          date_key: {
            $gte: parseInt(dateRange.startDate.toISOString().slice(0, 10).replace(/-/g, '')),
            $lte: parseInt(dateRange.endDate.toISOString().slice(0, 10).replace(/-/g, ''))
          }
        }
      },
      {
        $lookup: {
          from: 'dimdates',
          localField: 'date_key',
          foreignField: 'date_key',
          as: 'dateInfo'
        }
      },
      {
        $unwind: '$dateInfo'
      },
      {
        $group: {
          _id: {
            year: '$dateInfo.year',
            month: '$dateInfo.month',
            season: '$dateInfo.season'
          },
          revenue: { $sum: '$gross_revenue' },
          occupancy: { $avg: '$occupancy_rate' },
          adr: { $avg: '$adr' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    return {
      summary: {
        totalPeriods: seasonalData.length,
        peakSeason: this.findPeakSeason(seasonalData),
        lowSeason: this.findLowSeason(seasonalData)
      },
      trends: seasonalData,
      insights: this.generateSeasonalInsights(seasonalData)
    };
  }

  /**
   * Generate Profitability Analysis Report
   */
  async generateProfitabilityAnalysis(params) {
    const { dateRange, hotelIds } = params;
    
    const profitabilityMetrics = await FactRevenue.aggregate([
      {
        $match: {
          hotel_key: { $in: hotelIds },
          date_key: {
            $gte: parseInt(dateRange.startDate.toISOString().slice(0, 10).replace(/-/g, '')),
            $lte: parseInt(dateRange.endDate.toISOString().slice(0, 10).replace(/-/g, ''))
          }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$gross_revenue' },
          totalCosts: { $sum: '$operational_costs' },
          avgProfitMargin: { $avg: '$profit_margin' },
          avgROI: { $avg: '$roi' }
        }
      }
    ]);

    const metrics = profitabilityMetrics[0] || {};
    const netProfit = (metrics.totalRevenue || 0) - (metrics.totalCosts || 0);
    const profitMargin = metrics.totalRevenue ? (netProfit / metrics.totalRevenue) * 100 : 0;

    return {
      summary: {
        totalRevenue: metrics.totalRevenue || 0,
        totalCosts: metrics.totalCosts || 0,
        netProfit,
        profitMargin,
        avgROI: metrics.avgROI || 0
      },
      insights: this.generateProfitabilityInsights(metrics, netProfit, profitMargin)
    };
  }

  /**
   * Generate Demand Forecast Report
   */
  async generateDemandForecast(params) {
    const { dateRange, hotelIds, forecastDays = 30 } = params;
    
    // Simple linear trend forecasting
    const historicalData = await FactRevenue.aggregate([
      {
        $match: {
          hotel_key: { $in: hotelIds },
          date_key: {
            $gte: parseInt(dateRange.startDate.toISOString().slice(0, 10).replace(/-/g, '')),
            $lte: parseInt(dateRange.endDate.toISOString().slice(0, 10).replace(/-/g, ''))
          }
        }
      },
      {
        $group: {
          _id: '$date_key',
          demand: { $sum: '$rooms_sold' },
          revenue: { $sum: '$gross_revenue' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Calculate trend
    const trend = this.calculateTrend(historicalData.map(d => d.demand));
    
    // Generate forecast
    const forecast = [];
    const lastDate = new Date(dateRange.endDate);
    
    for (let i = 1; i <= forecastDays; i++) {
      const forecastDate = new Date(lastDate.getTime() + (i * 24 * 60 * 60 * 1000));
      const predictedDemand = Math.max(0, trend.slope * i + trend.intercept);
      
      forecast.push({
        date: forecastDate,
        predictedDemand: Math.round(predictedDemand),
        confidence: this.calculateConfidence(trend.r2)
      });
    }

    return {
      summary: {
        forecastDays,
        avgPredictedDemand: forecast.reduce((sum, f) => sum + f.predictedDemand, 0) / forecast.length,
        trendDirection: trend.slope > 0 ? 'increasing' : 'decreasing'
      },
      forecast,
      historicalData,
      insights: this.generateForecastInsights(forecast, trend)
    };
  }

  // Helper methods for the new report types
  generateCLVInsights(clvMetrics) {
    const insights = [];
    const avgCLV = clvMetrics.reduce((sum, guest) => sum + guest.totalRevenue, 0) / clvMetrics.length;
    
    if (avgCLV > 5000) {
      insights.push({
        type: 'positive',
        message: 'High average customer lifetime value indicates strong guest loyalty',
        impact: 'high'
      });
    }
    
    return insights;
  }

  generateChannelInsights(channelMetrics) {
    const insights = [];
    const topChannel = channelMetrics[0];
    
    if (topChannel && topChannel.totalRevenue > 100000) {
      insights.push({
        type: 'opportunity',
        message: `${topChannel._id} is the top performing channel - consider increasing investment`,
        impact: 'medium'
      });
    }
    
    return insights;
  }

  findPeakSeason(seasonalData) {
    const seasonTotals = {};
    seasonalData.forEach(item => {
      const season = item._id.season;
      seasonTotals[season] = (seasonTotals[season] || 0) + item.revenue;
    });
    
    return Object.entries(seasonTotals).reduce((a, b) => 
      seasonTotals[a[0]] > seasonTotals[b[0]] ? a : b
    )[0];
  }

  findLowSeason(seasonalData) {
    const seasonTotals = {};
    seasonalData.forEach(item => {
      const season = item._id.season;
      seasonTotals[season] = (seasonTotals[season] || 0) + item.revenue;
    });
    
    return Object.entries(seasonTotals).reduce((a, b) => 
      seasonTotals[a[0]] < seasonTotals[b[0]] ? a : b
    )[0];
  }

  generateSeasonalInsights(seasonalData) {
    const insights = [];
    const peakSeason = this.findPeakSeason(seasonalData);
    
    insights.push({
      type: 'information',
      message: `${peakSeason} is the peak season - optimize pricing and marketing`,
      impact: 'medium'
    });
    
    return insights;
  }

  generateProfitabilityInsights(metrics, netProfit, profitMargin) {
    const insights = [];
    
    if (profitMargin > 20) {
      insights.push({
        type: 'positive',
        message: 'Strong profit margins indicate efficient operations',
        impact: 'high'
      });
    } else if (profitMargin < 10) {
      insights.push({
        type: 'warning',
        message: 'Low profit margins - review operational costs and pricing strategy',
        impact: 'high'
      });
    }
    
    return insights;
  }

  calculateTrend(data) {
    const n = data.length;
    if (n < 2) return { slope: 0, intercept: 0, r2: 0 };
    
    const sumX = (n * (n - 1)) / 2;
    const sumY = data.reduce((sum, y) => sum + y, 0);
    const sumXY = data.reduce((sum, y, i) => sum + (i * y), 0);
    const sumX2 = data.reduce((sum, _, i) => sum + (i * i), 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R-squared
    const meanY = sumY / n;
    const ssRes = data.reduce((sum, y, i) => {
      const predicted = slope * i + intercept;
      return sum + Math.pow(y - predicted, 2);
    }, 0);
    const ssTot = data.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0);
    const r2 = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;
    
    return { slope, intercept, r2 };
  }

  calculateConfidence(r2) {
    return Math.min(95, Math.max(50, r2 * 100));
  }

  generateForecastInsights(forecast, trend) {
    const insights = [];
    
    if (trend.slope > 0) {
      insights.push({
        type: 'positive',
        message: 'Demand is trending upward - consider capacity planning',
        impact: 'medium'
      });
    } else if (trend.slope < 0) {
      insights.push({
        type: 'warning',
        message: 'Demand is declining - review marketing and pricing strategies',
        impact: 'high'
      });
    }
    
    return insights;
  }

  // Additional helper methods that are referenced but not implemented
  async getRevenueByPeriod(dateRange, hotelIds, breakdown) {
    // Simplified implementation
    return [];
  }

  async getRevenueBySegment(dateRange, hotelIds) {
    // Simplified implementation
    return [];
  }

  async getRevenueByChannel(dateRange, hotelIds) {
    // Simplified implementation
    return [];
  }

  async getRevenueByRoomType(dateRange, hotelIds) {
    // Simplified implementation
    return [];
  }

  async generateRevenueForecast(dateRange, hotelIds) {
    // Simplified implementation
    return [];
  }

  async getOccupancyTrends(dateRange, hotelIds) {
    // Simplified implementation
    return [];
  }

  async getGuestSatisfactionMetrics(dateRange, hotelIds) {
    // Simplified implementation
    return [];
  }

  async getMarketPosition(dateRange, hotelIds) {
    // Simplified implementation
    return [];
  }

  generateExecutiveSummaryText(kpis, insights) {
    return 'Executive summary text based on KPIs and insights';
  }

  async generateOccupancyForecast(dateRange, hotelIds) {
    // Simplified implementation
    return [];
  }

  generateOccupancyInsights(dailyOccupancy, occupancyByDayOfWeek) {
    // Simplified implementation
    return [];
  }

  generateGuestSegmentationInsights(segmentDistribution, rfmAnalysis) {
    // Simplified implementation
    return [];
  }

  generateRevenueInsights(revenueByPeriod, revenueBySegment, revenueByChannel) {
    // Simplified implementation
    return [];
  }

  async analyzeBehaviorPatterns(dateRange, hotelIds) {
    // Simplified implementation
    return [];
  }
}

export default AdvancedReportingService;