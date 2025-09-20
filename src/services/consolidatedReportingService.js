import mongoose from 'mongoose';
import PropertyGroup from '../models/PropertyGroup.js';
import Hotel from '../models/Hotel.js';
import Booking from '../models/Booking.js';
import RoomAvailability from '../models/RoomAvailability.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';
import cacheService from './cacheService.js';

/**
 * Consolidated Reporting Service
 * Handles cross-property analytics and reporting for multi-property chains
 */

class ConsolidatedReportingService {
  constructor() {
    this.cacheExpiry = 1800; // 30 minutes default cache
  }

  /**
   * Generate consolidated occupancy report across all properties in a group
   * @param {string} propertyGroupId - Property group ID
   * @param {Object} options - Report options
   */
  async generateOccupancyReport(propertyGroupId, options = {}) {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default 30 days ago
      endDate = new Date(),
      includeComparison = true,
      aggregateBy = 'day' // 'day', 'week', 'month'
    } = options;

    const cacheKey = `occupancy-report:${propertyGroupId}:${startDate.getTime()}:${endDate.getTime()}:${aggregateBy}`;

    try {
      // Try to get from cache first
      const cachedReport = await cacheService.get(cacheKey);
      if (cachedReport) {
        logger.info(`Occupancy report cache hit: ${propertyGroupId}`);
        return cachedReport;
      }

      // Get properties in the group
      const properties = await Hotel.find({
        propertyGroupId,
        isActive: true
      }).select('_id name address.city totalRooms');

      const propertyIds = properties.map(p => p._id);

      // Determine aggregation pipeline based on aggregateBy
      const dateGrouping = this.getDateGrouping(aggregateBy);

      // Get availability data
      const occupancyData = await RoomAvailability.aggregate([
        {
          $match: {
            hotelId: { $in: propertyIds },
            date: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              hotel: '$hotelId',
              ...dateGrouping
            },
            totalRooms: { $sum: '$totalRooms' },
            soldRooms: { $sum: '$soldRooms' },
            availableRooms: { $sum: '$availableRooms' },
            blockedRooms: { $sum: '$blockedRooms' },
            avgOccupancyRate: { $avg: { $divide: ['$soldRooms', '$totalRooms'] } }
          }
        },
        {
          $group: {
            _id: dateGrouping,
            properties: {
              $push: {
                hotelId: '$_id.hotel',
                totalRooms: '$totalRooms',
                soldRooms: '$soldRooms',
                availableRooms: '$availableRooms',
                blockedRooms: '$blockedRooms',
                occupancyRate: '$avgOccupancyRate'
              }
            },
            totalRoomsAllProperties: { $sum: '$totalRooms' },
            totalSoldAllProperties: { $sum: '$soldRooms' },
            consolidatedOccupancyRate: { $avg: '$avgOccupancyRate' }
          }
        },
        { $sort: { '_id': 1 } }
      ]);

      // Enrich with property information
      const enrichedData = occupancyData.map(period => {
        const propertiesWithInfo = period.properties.map(prop => {
          const propertyInfo = properties.find(p => p._id.toString() === prop.hotelId.toString());
          return {
            ...prop,
            propertyName: propertyInfo?.name || 'Unknown',
            propertyCity: propertyInfo?.address?.city || 'Unknown',
            occupancyPercentage: (prop.occupancyRate * 100).toFixed(2)
          };
        });

        return {
          ...period,
          properties: propertiesWithInfo,
          consolidatedOccupancyPercentage: (period.consolidatedOccupancyRate * 100).toFixed(2)
        };
      });

      // Generate comparison data if requested
      let comparisonData = null;
      if (includeComparison) {
        const previousStartDate = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));
        const previousEndDate = new Date(startDate.getTime());

        comparisonData = await this.getOccupancyComparison(
          propertyIds,
          previousStartDate,
          previousEndDate,
          aggregateBy
        );
      }

      const report = {
        propertyGroupId,
        reportType: 'occupancy',
        period: {
          startDate,
          endDate,
          aggregateBy
        },
        summary: {
          totalProperties: properties.length,
          totalRoomsInGroup: properties.reduce((sum, p) => sum + (p.totalRooms || 0), 0),
          averageOccupancyRate: enrichedData.length > 0
            ? enrichedData.reduce((sum, p) => sum + p.consolidatedOccupancyRate, 0) / enrichedData.length
            : 0
        },
        data: enrichedData,
        comparison: comparisonData,
        generatedAt: new Date()
      };

      // Cache the report
      await cacheService.set(cacheKey, report, this.cacheExpiry);

      logger.info(`Occupancy report generated: ${propertyGroupId}`, {
        propertiesCount: properties.length,
        periodsCount: enrichedData.length
      });

      return report;

    } catch (error) {
      logger.error('Error generating occupancy report:', error);
      throw new Error(`Failed to generate occupancy report: ${error.message}`);
    }
  }

  /**
   * Generate consolidated revenue report across all properties
   * @param {string} propertyGroupId - Property group ID
   * @param {Object} options - Report options
   */
  async generateRevenueReport(propertyGroupId, options = {}) {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date(),
      includeBreakdown = true,
      aggregateBy = 'day',
      currency = 'USD'
    } = options;

    const cacheKey = `revenue-report:${propertyGroupId}:${startDate.getTime()}:${endDate.getTime()}:${aggregateBy}:${currency}`;

    try {
      const cachedReport = await cacheService.get(cacheKey);
      if (cachedReport) {
        logger.info(`Revenue report cache hit: ${propertyGroupId}`);
        return cachedReport;
      }

      const properties = await Hotel.find({
        propertyGroupId,
        isActive: true
      }).select('_id name address.city settings.currency');

      const propertyIds = properties.map(p => p._id);
      const dateGrouping = this.getDateGrouping(aggregateBy);

      // Get booking revenue data
      const revenueData = await Booking.aggregate([
        {
          $match: {
            hotelId: { $in: propertyIds },
            status: { $in: ['confirmed', 'checked_in', 'completed'] },
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              hotel: '$hotelId',
              ...dateGrouping
            },
            totalRevenue: { $sum: '$totalAmount' },
            totalBookings: { $sum: 1 },
            averageBookingValue: { $avg: '$totalAmount' },
            revenueBreakdown: {
              $push: {
                bookingId: '$_id',
                amount: '$totalAmount',
                source: '$source',
                roomType: '$roomType'
              }
            }
          }
        },
        {
          $group: {
            _id: dateGrouping,
            properties: {
              $push: {
                hotelId: '$_id.hotel',
                totalRevenue: '$totalRevenue',
                totalBookings: '$totalBookings',
                averageBookingValue: '$averageBookingValue',
                revenueBreakdown: includeBreakdown ? '$revenueBreakdown' : null
              }
            },
            consolidatedRevenue: { $sum: '$totalRevenue' },
            consolidatedBookings: { $sum: '$totalBookings' },
            consolidatedAverageBookingValue: { $avg: '$averageBookingValue' }
          }
        },
        { $sort: { '_id': 1 } }
      ]);

      // Enrich with property information
      const enrichedData = revenueData.map(period => {
        const propertiesWithInfo = period.properties.map(prop => {
          const propertyInfo = properties.find(p => p._id.toString() === prop.hotelId.toString());
          return {
            ...prop,
            propertyName: propertyInfo?.name || 'Unknown',
            propertyCity: propertyInfo?.address?.city || 'Unknown',
            propertyCurrency: propertyInfo?.settings?.currency || currency,
            revenuePerBooking: prop.totalBookings > 0 ? (prop.totalRevenue / prop.totalBookings) : 0
          };
        });

        return {
          ...period,
          properties: propertiesWithInfo
        };
      });

      // Calculate RevPAR (Revenue Per Available Room) if possible
      const revparData = await this.calculateRevPAR(propertyIds, startDate, endDate, aggregateBy);

      const report = {
        propertyGroupId,
        reportType: 'revenue',
        period: {
          startDate,
          endDate,
          aggregateBy,
          currency
        },
        summary: {
          totalProperties: properties.length,
          totalRevenue: enrichedData.reduce((sum, p) => sum + p.consolidatedRevenue, 0),
          totalBookings: enrichedData.reduce((sum, p) => sum + p.consolidatedBookings, 0),
          averageBookingValue: enrichedData.length > 0
            ? enrichedData.reduce((sum, p) => sum + p.consolidatedAverageBookingValue, 0) / enrichedData.length
            : 0
        },
        data: enrichedData,
        revpar: revparData,
        generatedAt: new Date()
      };

      await cacheService.set(cacheKey, report, this.cacheExpiry);

      logger.info(`Revenue report generated: ${propertyGroupId}`, {
        propertiesCount: properties.length,
        totalRevenue: report.summary.totalRevenue
      });

      return report;

    } catch (error) {
      logger.error('Error generating revenue report:', error);
      throw new Error(`Failed to generate revenue report: ${error.message}`);
    }
  }

  /**
   * Generate consolidated performance comparison across properties
   * @param {string} propertyGroupId - Property group ID
   * @param {Object} options - Report options
   */
  async generatePerformanceComparison(propertyGroupId, options = {}) {
    const {
      period = '30d',
      metrics = ['occupancy', 'revenue', 'adr', 'revpar'],
      includeRankings = true
    } = options;

    const cacheKey = `performance-comparison:${propertyGroupId}:${period}:${metrics.join(',')}`;

    try {
      const cachedReport = await cacheService.get(cacheKey);
      if (cachedReport) {
        return cachedReport;
      }

      const endDate = new Date();
      const startDate = new Date();
      const days = parseInt(period.replace('d', ''));
      startDate.setDate(startDate.getDate() - days);

      const properties = await Hotel.find({
        propertyGroupId,
        isActive: true
      }).select('_id name address totalRooms');

      const propertyIds = properties.map(p => p._id);
      const performanceData = [];

      // Calculate metrics for each property
      for (const property of properties) {
        const propertyMetrics = await this.calculatePropertyMetrics(
          property._id,
          startDate,
          endDate,
          metrics
        );

        performanceData.push({
          propertyId: property._id,
          propertyName: property.name,
          address: property.address,
          totalRooms: property.totalRooms,
          metrics: propertyMetrics
        });
      }

      // Calculate group averages
      const groupAverages = this.calculateGroupAverages(performanceData, metrics);

      // Generate rankings if requested
      let rankings = null;
      if (includeRankings) {
        rankings = this.generateRankings(performanceData, metrics);
      }

      const report = {
        propertyGroupId,
        reportType: 'performance_comparison',
        period: {
          startDate,
          endDate,
          days
        },
        metrics: metrics,
        groupAverages,
        properties: performanceData,
        rankings,
        generatedAt: new Date()
      };

      await cacheService.set(cacheKey, report, this.cacheExpiry);

      logger.info(`Performance comparison generated: ${propertyGroupId}`, {
        propertiesCount: properties.length,
        metricsCount: metrics.length
      });

      return report;

    } catch (error) {
      logger.error('Error generating performance comparison:', error);
      throw new Error(`Failed to generate performance comparison: ${error.message}`);
    }
  }

  /**
   * Generate executive summary for property group
   * @param {string} propertyGroupId - Property group ID
   * @param {Object} options - Report options
   */
  async generateExecutiveSummary(propertyGroupId, options = {}) {
    const {
      period = '30d',
      includeForecasts = false,
      includeAlerts = true
    } = options;

    try {
      const endDate = new Date();
      const startDate = new Date();
      const days = parseInt(period.replace('d', ''));
      startDate.setDate(startDate.getDate() - days);

      // Get property group info
      const propertyGroup = await PropertyGroup.findById(propertyGroupId)
        .populate('properties', 'name address totalRooms isActive');

      if (!propertyGroup) {
        throw new Error('Property group not found');
      }

      // Get consolidated metrics
      const [occupancyReport, revenueReport, performanceComparison] = await Promise.all([
        this.generateOccupancyReport(propertyGroupId, { startDate, endDate, aggregateBy: 'month' }),
        this.generateRevenueReport(propertyGroupId, { startDate, endDate, aggregateBy: 'month' }),
        this.generatePerformanceComparison(propertyGroupId, { period })
      ]);

      // Calculate key performance indicators
      const kpis = {
        totalProperties: propertyGroup.properties.length,
        totalRooms: propertyGroup.properties.reduce((sum, p) => sum + (p.totalRooms || 0), 0),
        averageOccupancy: occupancyReport.summary.averageOccupancyRate,
        totalRevenue: revenueReport.summary.totalRevenue,
        averageADR: revenueReport.summary.averageBookingValue,
        revPAR: revenueReport.revpar ? revenueReport.revpar.average : 0
      };

      // Identify trends
      const trends = this.identifyTrends(occupancyReport.data, revenueReport.data);

      // Generate alerts if requested
      let alerts = null;
      if (includeAlerts) {
        alerts = await this.generatePerformanceAlerts(propertyGroupId, kpis);
      }

      // Generate forecasts if requested
      let forecasts = null;
      if (includeForecasts) {
        forecasts = await this.generateBasicForecasts(propertyGroupId, occupancyReport.data, revenueReport.data);
      }

      const summary = {
        propertyGroup: {
          id: propertyGroup._id,
          name: propertyGroup.name,
          type: propertyGroup.groupType,
          status: propertyGroup.status
        },
        period: {
          startDate,
          endDate,
          days
        },
        kpis,
        trends,
        topPerformers: performanceComparison.rankings ? {
          occupancy: performanceComparison.rankings.occupancy.slice(0, 3),
          revenue: performanceComparison.rankings.revenue.slice(0, 3)
        } : null,
        alerts,
        forecasts,
        generatedAt: new Date()
      };

      logger.info(`Executive summary generated: ${propertyGroupId}`, {
        propertiesCount: kpis.totalProperties,
        totalRevenue: kpis.totalRevenue
      });

      return summary;

    } catch (error) {
      logger.error('Error generating executive summary:', error);
      throw new Error(`Failed to generate executive summary: ${error.message}`);
    }
  }

  // Helper methods

  getDateGrouping(aggregateBy) {
    switch (aggregateBy) {
      case 'day':
        return {
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: { $dayOfMonth: '$date' }
        };
      case 'week':
        return {
          year: { $year: '$date' },
          week: { $week: '$date' }
        };
      case 'month':
        return {
          year: { $year: '$date' },
          month: { $month: '$date' }
        };
      default:
        return {
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: { $dayOfMonth: '$date' }
        };
    }
  }

  async getOccupancyComparison(propertyIds, startDate, endDate, aggregateBy) {
    const dateGrouping = this.getDateGrouping(aggregateBy);

    return await RoomAvailability.aggregate([
      {
        $match: {
          hotelId: { $in: propertyIds },
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: dateGrouping,
          avgOccupancyRate: { $avg: { $divide: ['$soldRooms', '$totalRooms'] } }
        }
      },
      { $sort: { '_id': 1 } }
    ]);
  }

  async calculateRevPAR(propertyIds, startDate, endDate, aggregateBy) {
    try {
      const revparData = await Booking.aggregate([
        {
          $match: {
            hotelId: { $in: propertyIds },
            status: { $in: ['confirmed', 'checked_in', 'completed'] },
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $lookup: {
            from: 'roomavailabilities',
            let: { hotelId: '$hotelId', checkIn: '$checkIn' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$hotelId', '$$hotelId'] },
                      { $gte: ['$date', '$$checkIn'] }
                    ]
                  }
                }
              }
            ],
            as: 'roomAvailability'
          }
        },
        {
          $group: {
            _id: '$hotelId',
            totalRevenue: { $sum: '$totalAmount' },
            totalAvailableRooms: { $sum: { $sum: '$roomAvailability.totalRooms' } }
          }
        },
        {
          $project: {
            hotelId: '$_id',
            revpar: {
              $cond: [
                { $gt: ['$totalAvailableRooms', 0] },
                { $divide: ['$totalRevenue', '$totalAvailableRooms'] },
                0
              ]
            }
          }
        }
      ]);

      const averageRevPAR = revparData.length > 0
        ? revparData.reduce((sum, hotel) => sum + hotel.revpar, 0) / revparData.length
        : 0;

      return {
        average: averageRevPAR,
        byProperty: revparData
      };
    } catch (error) {
      logger.error('Error calculating RevPAR:', error);
      return { average: 0, byProperty: [] };
    }
  }

  async calculatePropertyMetrics(propertyId, startDate, endDate, metrics) {
    const results = {};

    for (const metric of metrics) {
      switch (metric) {
        case 'occupancy':
          results.occupancy = await this.getPropertyOccupancy(propertyId, startDate, endDate);
          break;
        case 'revenue':
          results.revenue = await this.getPropertyRevenue(propertyId, startDate, endDate);
          break;
        case 'adr':
          results.adr = await this.getPropertyADR(propertyId, startDate, endDate);
          break;
        case 'revpar':
          results.revpar = await this.getPropertyRevPAR(propertyId, startDate, endDate);
          break;
      }
    }

    return results;
  }

  async getPropertyOccupancy(propertyId, startDate, endDate) {
    const result = await RoomAvailability.aggregate([
      {
        $match: {
          hotelId: propertyId,
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          avgOccupancy: { $avg: { $divide: ['$soldRooms', '$totalRooms'] } }
        }
      }
    ]);

    return result.length > 0 ? (result[0].avgOccupancy * 100) : 0;
  }

  async getPropertyRevenue(propertyId, startDate, endDate) {
    const result = await Booking.aggregate([
      {
        $match: {
          hotelId: propertyId,
          status: { $in: ['confirmed', 'checked_in', 'completed'] },
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' }
        }
      }
    ]);

    return result.length > 0 ? result[0].totalRevenue : 0;
  }

  async getPropertyADR(propertyId, startDate, endDate) {
    const result = await Booking.aggregate([
      {
        $match: {
          hotelId: propertyId,
          status: { $in: ['confirmed', 'checked_in', 'completed'] },
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          averageRate: { $avg: '$totalAmount' }
        }
      }
    ]);

    return result.length > 0 ? result[0].averageRate : 0;
  }

  async getPropertyRevPAR(propertyId, startDate, endDate) {
    // Simplified RevPAR calculation
    const [revenue, occupancy] = await Promise.all([
      this.getPropertyRevenue(propertyId, startDate, endDate),
      this.getPropertyOccupancy(propertyId, startDate, endDate)
    ]);

    return (revenue * occupancy) / 100;
  }

  calculateGroupAverages(performanceData, metrics) {
    const averages = {};

    for (const metric of metrics) {
      const values = performanceData
        .map(p => p.metrics[metric])
        .filter(v => v !== undefined && v !== null);

      averages[metric] = values.length > 0
        ? values.reduce((sum, val) => sum + val, 0) / values.length
        : 0;
    }

    return averages;
  }

  generateRankings(performanceData, metrics) {
    const rankings = {};

    for (const metric of metrics) {
      rankings[metric] = performanceData
        .filter(p => p.metrics[metric] !== undefined)
        .sort((a, b) => b.metrics[metric] - a.metrics[metric])
        .map((property, index) => ({
          rank: index + 1,
          propertyId: property.propertyId,
          propertyName: property.propertyName,
          value: property.metrics[metric]
        }));
    }

    return rankings;
  }

  identifyTrends(occupancyData, revenueData) {
    // Simple trend analysis - can be enhanced with more sophisticated algorithms
    const trends = {};

    if (occupancyData.length >= 2) {
      const firstPeriod = occupancyData[0].consolidatedOccupancyRate;
      const lastPeriod = occupancyData[occupancyData.length - 1].consolidatedOccupancyRate;
      
      trends.occupancy = {
        direction: lastPeriod > firstPeriod ? 'increasing' : 'decreasing',
        change: ((lastPeriod - firstPeriod) / firstPeriod * 100).toFixed(2)
      };
    }

    if (revenueData.length >= 2) {
      const firstPeriod = revenueData[0].consolidatedRevenue;
      const lastPeriod = revenueData[revenueData.length - 1].consolidatedRevenue;
      
      trends.revenue = {
        direction: lastPeriod > firstPeriod ? 'increasing' : 'decreasing',
        change: ((lastPeriod - firstPeriod) / firstPeriod * 100).toFixed(2)
      };
    }

    return trends;
  }

  async generatePerformanceAlerts(propertyGroupId, kpis) {
    const alerts = [];

    // Low occupancy alert
    if (kpis.averageOccupancy < 60) {
      alerts.push({
        type: 'warning',
        category: 'occupancy',
        message: `Group occupancy rate is below 60% (${kpis.averageOccupancy.toFixed(2)}%)`,
        priority: 'medium'
      });
    }

    // Low revenue alert
    if (kpis.totalRevenue < 10000) {
      alerts.push({
        type: 'warning',
        category: 'revenue',
        message: `Group revenue is below expected threshold`,
        priority: 'high'
      });
    }

    // Low RevPAR alert
    if (kpis.revPAR < 50) {
      alerts.push({
        type: 'info',
        category: 'revpar',
        message: `Group RevPAR could be improved (${kpis.revPAR.toFixed(2)})`,
        priority: 'low'
      });
    }

    return alerts;
  }

  async generateBasicForecasts(propertyGroupId, occupancyData, revenueData) {
    // Simple linear projection - can be enhanced with machine learning models
    const forecasts = {};

    if (occupancyData.length >= 3) {
      const trend = this.calculateLinearTrend(occupancyData.map(d => d.consolidatedOccupancyRate));
      forecasts.occupancy = {
        nextPeriod: Math.max(0, Math.min(100, occupancyData[occupancyData.length - 1].consolidatedOccupancyRate + trend)),
        confidence: 'low' // Basic forecast has low confidence
      };
    }

    if (revenueData.length >= 3) {
      const trend = this.calculateLinearTrend(revenueData.map(d => d.consolidatedRevenue));
      forecasts.revenue = {
        nextPeriod: Math.max(0, revenueData[revenueData.length - 1].consolidatedRevenue + trend),
        confidence: 'low'
      };
    }

    return forecasts;
  }

  calculateLinearTrend(values) {
    if (values.length < 2) return 0;

    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    return slope;
  }

  /**
   * Clear cached reports for a property group
   * @param {string} propertyGroupId - Property group ID
   */
  async clearReportCache(propertyGroupId) {
    try {
      const patterns = [
        `occupancy-report:${propertyGroupId}:*`,
        `revenue-report:${propertyGroupId}:*`,
        `performance-comparison:${propertyGroupId}:*`
      ];

      let totalCleared = 0;
      for (const pattern of patterns) {
        const cleared = await cacheService.delPattern(pattern);
        totalCleared += cleared;
      }

      logger.info(`Cleared ${totalCleared} cached reports for property group: ${propertyGroupId}`);
      return totalCleared;

    } catch (error) {
      logger.error('Error clearing report cache:', error);
      throw new Error(`Failed to clear report cache: ${error.message}`);
    }
  }
}

// Create singleton instance
const consolidatedReportingService = new ConsolidatedReportingService();

export default consolidatedReportingService;