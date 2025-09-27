import moment from 'moment';
import TravelAgentBooking from '../models/TravelAgentBooking.js';
import TravelAgent from '../models/TravelAgent.js';
import Booking from '../models/Booking.js';
import logger from '../utils/logger.js';
import { ApplicationError } from '../middleware/errorHandler.js';

class AnalyticsService {
  constructor() {
    this.cacheTTL = 30 * 60 * 1000; // 30 minutes cache
    this.cache = new Map();
  }

  /**
   * Generate cache key for analytics data
   * @param {string} type - Analytics type
   * @param {Object} params - Parameters
   * @returns {string} Cache key
   */
  generateCacheKey(type, params) {
    return `analytics_${type}_${JSON.stringify(params)}`;
  }

  /**
   * Get cached data or fetch new data
   * @param {string} cacheKey - Cache key
   * @param {Function} fetchFunction - Function to fetch data
   * @returns {*} Cached or fresh data
   */
  async getCachedOrFresh(cacheKey, fetchFunction) {
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    const freshData = await fetchFunction();
    this.cache.set(cacheKey, { data: freshData, timestamp: Date.now() });
    return freshData;
  }

  /**
   * Analyze booking trends for travel agents
   * @param {Object} filters - Filter criteria
   * @returns {Object} Booking trends analysis
   */
  async analyzeBookingTrends(filters = {}) {
    try {
      const cacheKey = this.generateCacheKey('booking_trends', filters);

      return await this.getCachedOrFresh(cacheKey, async () => {
        const { startDate, endDate, travelAgentId, hotelId, granularity = 'month' } = filters;

        const matchCriteria = {
          isActive: true,
          bookingStatus: 'confirmed'
        };

        if (travelAgentId) {
          matchCriteria.travelAgentId = travelAgentId;
        }

        if (hotelId) {
          matchCriteria.hotelId = hotelId;
        }

        if (startDate && endDate) {
          matchCriteria.createdAt = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          };
        }

        // Determine date grouping based on granularity
        let dateGrouping;
        switch (granularity) {
          case 'day':
            dateGrouping = {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            };
            break;
          case 'week':
            dateGrouping = {
              year: { $year: '$createdAt' },
              week: { $week: '$createdAt' }
            };
            break;
          case 'quarter':
            dateGrouping = {
              year: { $year: '$createdAt' },
              quarter: {
                $ceil: { $divide: [{ $month: '$createdAt' }, 3] }
              }
            };
            break;
          default: // month
            dateGrouping = {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            };
        }

        const trendData = await TravelAgentBooking.aggregate([
          { $match: matchCriteria },
          {
            $group: {
              _id: dateGrouping,
              totalBookings: { $sum: 1 },
              totalRevenue: { $sum: '$roomRevenue' },
              totalCommissions: { $sum: '$commissionAmount' },
              averageCommissionRate: { $avg: '$commissionRate' },
              uniqueAgents: { $addToSet: '$travelAgentId' }
            }
          },
          {
            $addFields: {
              uniqueAgentCount: { $size: '$uniqueAgents' },
              averageRevenuePerBooking: { $divide: ['$totalRevenue', '$totalBookings'] },
              averageCommissionPerBooking: { $divide: ['$totalCommissions', '$totalBookings'] }
            }
          },
          { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1, '_id.quarter': 1 } }
        ]);

        // Calculate growth rates
        const trendsWithGrowth = trendData.map((item, index) => {
          const previousItem = trendData[index - 1];
          let growthRates = {};

          if (previousItem) {
            growthRates = {
              bookingGrowth: ((item.totalBookings - previousItem.totalBookings) / previousItem.totalBookings * 100).toFixed(2),
              revenueGrowth: ((item.totalRevenue - previousItem.totalRevenue) / previousItem.totalRevenue * 100).toFixed(2),
              commissionGrowth: ((item.totalCommissions - previousItem.totalCommissions) / previousItem.totalCommissions * 100).toFixed(2)
            };
          }

          return {
            ...item,
            growthRates
          };
        });

        // Calculate overall statistics
        const totalBookings = trendData.reduce((sum, item) => sum + item.totalBookings, 0);
        const totalRevenue = trendData.reduce((sum, item) => sum + item.totalRevenue, 0);
        const totalCommissions = trendData.reduce((sum, item) => sum + item.totalCommissions, 0);

        const result = {
          trends: trendsWithGrowth,
          summary: {
            totalBookings,
            totalRevenue,
            totalCommissions,
            averageBookingsPerPeriod: totalBookings / (trendData.length || 1),
            averageRevenuePerPeriod: totalRevenue / (trendData.length || 1),
            averageCommissionsPerPeriod: totalCommissions / (trendData.length || 1),
            periodCount: trendData.length,
            granularity
          }
        };

        logger.info(`Booking trends analysis completed for ${trendData.length} periods`);
        return result;
      });
    } catch (error) {
      logger.error('Error analyzing booking trends:', error);
      throw new ApplicationError('Failed to analyze booking trends', 500);
    }
  }

  /**
   * Forecast revenue for travel agents using linear regression
   * @param {Object} filters - Filter criteria
   * @param {number} periodsAhead - Number of periods to forecast
   * @returns {Object} Revenue forecast
   */
  async forecastRevenue(filters = {}, periodsAhead = 6) {
    try {
      const cacheKey = this.generateCacheKey('revenue_forecast', { ...filters, periodsAhead });

      return await this.getCachedOrFresh(cacheKey, async () => {
        const { travelAgentId, hotelId, granularity = 'month' } = filters;

        // Get historical data for the last 24 periods
        const endDate = new Date();
        const startDate = new Date();

        switch (granularity) {
          case 'day':
            startDate.setDate(startDate.getDate() - 365); // Last year
            break;
          case 'week':
            startDate.setDate(startDate.getDate() - (52 * 7)); // Last 52 weeks
            break;
          case 'quarter':
            startDate.setMonth(startDate.getMonth() - (8 * 3)); // Last 8 quarters
            break;
          default: // month
            startDate.setMonth(startDate.getMonth() - 24); // Last 24 months
        }

        const historicalData = await this.analyzeBookingTrends({
          ...filters,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          granularity
        });

        if (historicalData.trends.length < 3) {
          throw new ApplicationError('Insufficient historical data for forecasting', 400);
        }

        // Prepare data for linear regression
        const dataPoints = historicalData.trends.map((item, index) => ({
          x: index + 1,
          revenue: item.totalRevenue,
          bookings: item.totalBookings,
          commissions: item.totalCommissions
        }));

        // Calculate forecasts using simple linear regression
        const revenueForecast = this.calculateLinearRegression(dataPoints, 'revenue', periodsAhead);
        const bookingsForecast = this.calculateLinearRegression(dataPoints, 'bookings', periodsAhead);
        const commissionsForecast = this.calculateLinearRegression(dataPoints, 'commissions', periodsAhead);

        // Apply seasonal adjustments if enough data
        const seasonalAdjustments = this.calculateSeasonalAdjustments(historicalData.trends, granularity);

        const forecast = [];
        const lastPeriodIndex = dataPoints.length;

        for (let i = 1; i <= periodsAhead; i++) {
          const periodIndex = lastPeriodIndex + i;
          const forecastDate = this.calculateForecastDate(endDate, i, granularity);

          let adjustedRevenue = revenueForecast.equation.slope * periodIndex + revenueForecast.equation.intercept;
          let adjustedBookings = bookingsForecast.equation.slope * periodIndex + bookingsForecast.equation.intercept;
          let adjustedCommissions = commissionsForecast.equation.slope * periodIndex + commissionsForecast.equation.intercept;

          // Apply seasonal adjustments
          const seasonalIndex = this.getSeasonalIndex(forecastDate, granularity);
          if (seasonalAdjustments[seasonalIndex]) {
            adjustedRevenue *= seasonalAdjustments[seasonalIndex];
            adjustedBookings *= seasonalAdjustments[seasonalIndex];
            adjustedCommissions *= seasonalAdjustments[seasonalIndex];
          }

          // Ensure non-negative values
          adjustedRevenue = Math.max(0, adjustedRevenue);
          adjustedBookings = Math.max(0, Math.round(adjustedBookings));
          adjustedCommissions = Math.max(0, adjustedCommissions);

          forecast.push({
            period: i,
            date: forecastDate,
            predictedRevenue: adjustedRevenue,
            predictedBookings: adjustedBookings,
            predictedCommissions: adjustedCommissions,
            confidence: this.calculateConfidence(revenueForecast.rSquared, i)
          });
        }

        const result = {
          forecast,
          historicalData: dataPoints,
          modelMetrics: {
            revenueRSquared: revenueForecast.rSquared,
            bookingsRSquared: bookingsForecast.rSquared,
            commissionsRSquared: commissionsForecast.rSquared,
            dataPoints: dataPoints.length,
            forecastPeriods: periodsAhead,
            granularity
          },
          summary: {
            totalForecastRevenue: forecast.reduce((sum, item) => sum + item.predictedRevenue, 0),
            totalForecastBookings: forecast.reduce((sum, item) => sum + item.predictedBookings, 0),
            totalForecastCommissions: forecast.reduce((sum, item) => sum + item.predictedCommissions, 0),
            averageConfidence: forecast.reduce((sum, item) => sum + item.confidence, 0) / forecast.length
          }
        };

        logger.info(`Revenue forecast completed for ${periodsAhead} periods ahead`);
        return result;
      });
    } catch (error) {
      logger.error('Error forecasting revenue:', error);
      throw new ApplicationError('Failed to forecast revenue', 500);
    }
  }

  /**
   * Calculate commission projections for travel agents
   * @param {Object} filters - Filter criteria
   * @returns {Object} Commission projections
   */
  async calculateCommissionProjections(filters = {}) {
    try {
      const cacheKey = this.generateCacheKey('commission_projections', filters);

      return await this.getCachedOrFresh(cacheKey, async () => {
        const { travelAgentId, startDate, endDate, projectionMonths = 6 } = filters;

        const matchCriteria = {
          isActive: true
        };

        if (travelAgentId) {
          matchCriteria.travelAgentId = travelAgentId;
        }

        if (startDate && endDate) {
          matchCriteria.createdAt = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          };
        }

        // Get commission data by agent and month
        const commissionData = await TravelAgentBooking.aggregate([
          { $match: matchCriteria },
          {
            $lookup: {
              from: 'travelagents',
              localField: 'travelAgentId',
              foreignField: '_id',
              as: 'agent'
            }
          },
          { $unwind: '$agent' },
          {
            $group: {
              _id: {
                travelAgentId: '$travelAgentId',
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' }
              },
              agentCode: { $first: '$agent.agentCode' },
              companyName: { $first: '$agent.companyName' },
              totalBookings: { $sum: 1 },
              totalRevenue: { $sum: '$roomRevenue' },
              totalCommissions: { $sum: '$commissionAmount' },
              averageCommissionRate: { $avg: '$commissionRate' },
              bookingStatuses: {
                $push: {
                  status: '$bookingStatus',
                  amount: '$commissionAmount'
                }
              }
            }
          },
          { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        // Group by agent and calculate projections
        const agentProjections = {};

        commissionData.forEach(item => {
          const agentId = item._id.travelAgentId.toString();

          if (!agentProjections[agentId]) {
            agentProjections[agentId] = {
              agentCode: item.agentCode,
              companyName: item.companyName,
              historicalData: [],
              projections: []
            };
          }

          agentProjections[agentId].historicalData.push({
            year: item._id.year,
            month: item._id.month,
            totalBookings: item.totalBookings,
            totalRevenue: item.totalRevenue,
            totalCommissions: item.totalCommissions,
            averageCommissionRate: item.averageCommissionRate,
            confirmedCommissions: item.bookingStatuses
              .filter(status => status.status === 'confirmed')
              .reduce((sum, booking) => sum + booking.amount, 0),
            pendingCommissions: item.bookingStatuses
              .filter(status => status.status === 'pending')
              .reduce((sum, booking) => sum + booking.amount, 0)
          });
        });

        // Calculate projections for each agent
        Object.keys(agentProjections).forEach(agentId => {
          const agent = agentProjections[agentId];
          const historicalData = agent.historicalData;

          if (historicalData.length >= 3) {
            // Calculate growth trends
            const recentMonths = historicalData.slice(-6); // Last 6 months
            const avgMonthlyCommissions = recentMonths.reduce((sum, month) => sum + month.totalCommissions, 0) / recentMonths.length;
            const avgMonthlyBookings = recentMonths.reduce((sum, month) => sum + month.totalBookings, 0) / recentMonths.length;
            const avgCommissionRate = recentMonths.reduce((sum, month) => sum + month.averageCommissionRate, 0) / recentMonths.length;

            // Calculate month-over-month growth
            const growthRates = [];
            for (let i = 1; i < recentMonths.length; i++) {
              const growth = (recentMonths[i].totalCommissions - recentMonths[i-1].totalCommissions) / recentMonths[i-1].totalCommissions;
              growthRates.push(growth);
            }
            const avgGrowthRate = growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length;

            // Generate projections
            for (let i = 1; i <= projectionMonths; i++) {
              const projectedDate = moment().add(i, 'months');
              const seasonalMultiplier = this.getSeasonalMultiplier(projectedDate.month() + 1);

              const baseCommission = avgMonthlyCommissions * Math.pow(1 + avgGrowthRate, i);
              const projectedCommissions = baseCommission * seasonalMultiplier;
              const projectedBookings = Math.round(avgMonthlyBookings * Math.pow(1 + avgGrowthRate, i) * seasonalMultiplier);

              agent.projections.push({
                month: projectedDate.month() + 1,
                year: projectedDate.year(),
                projectedCommissions: Math.max(0, projectedCommissions),
                projectedBookings: Math.max(0, projectedBookings),
                projectedRevenue: projectedCommissions / (avgCommissionRate / 100),
                confidence: this.calculateProjectionConfidence(historicalData.length, i),
                seasonalMultiplier
              });
            }
          }
        });

        // Calculate overall projections
        const overallProjections = [];
        for (let i = 1; i <= projectionMonths; i++) {
          const projectedDate = moment().add(i, 'months');
          let totalProjectedCommissions = 0;
          let totalProjectedBookings = 0;
          let totalProjectedRevenue = 0;
          let activeAgents = 0;

          Object.values(agentProjections).forEach(agent => {
            const projection = agent.projections.find(p => p.month === projectedDate.month() + 1 && p.year === projectedDate.year());
            if (projection) {
              totalProjectedCommissions += projection.projectedCommissions;
              totalProjectedBookings += projection.projectedBookings;
              totalProjectedRevenue += projection.projectedRevenue;
              activeAgents++;
            }
          });

          overallProjections.push({
            month: projectedDate.month() + 1,
            year: projectedDate.year(),
            totalProjectedCommissions,
            totalProjectedBookings,
            totalProjectedRevenue,
            activeAgents,
            averageCommissionPerAgent: activeAgents > 0 ? totalProjectedCommissions / activeAgents : 0
          });
        }

        const result = {
          agentProjections,
          overallProjections,
          summary: {
            totalAgents: Object.keys(agentProjections).length,
            projectionMonths,
            totalProjectedCommissions: overallProjections.reduce((sum, p) => sum + p.totalProjectedCommissions, 0),
            totalProjectedBookings: overallProjections.reduce((sum, p) => sum + p.totalProjectedBookings, 0),
            totalProjectedRevenue: overallProjections.reduce((sum, p) => sum + p.totalProjectedRevenue, 0)
          }
        };

        logger.info(`Commission projections calculated for ${Object.keys(agentProjections).length} agents`);
        return result;
      });
    } catch (error) {
      logger.error('Error calculating commission projections:', error);
      throw new ApplicationError('Failed to calculate commission projections', 500);
    }
  }

  /**
   * Calculate performance metrics for travel agents
   * @param {Object} filters - Filter criteria
   * @returns {Object} Performance metrics
   */
  async calculatePerformanceMetrics(filters = {}) {
    try {
      const cacheKey = this.generateCacheKey('performance_metrics', filters);

      return await this.getCachedOrFresh(cacheKey, async () => {
        const { travelAgentId, startDate, endDate, comparisonPeriod = 'previous_period' } = filters;

        const currentPeriodStart = startDate ? new Date(startDate) : moment().subtract(1, 'month').startOf('month').toDate();
        const currentPeriodEnd = endDate ? new Date(endDate) : moment().subtract(1, 'month').endOf('month').toDate();

        // Calculate comparison period
        const periodDuration = moment(currentPeriodEnd).diff(moment(currentPeriodStart), 'days');
        const comparisonStart = moment(currentPeriodStart).subtract(periodDuration + 1, 'days').toDate();
        const comparisonEnd = moment(currentPeriodStart).subtract(1, 'day').toDate();

        const matchCriteria = {
          isActive: true,
          bookingStatus: 'confirmed'
        };

        if (travelAgentId) {
          matchCriteria.travelAgentId = travelAgentId;
        }

        // Get current period metrics
        const currentMetrics = await TravelAgentBooking.aggregate([
          {
            $match: {
              ...matchCriteria,
              createdAt: { $gte: currentPeriodStart, $lte: currentPeriodEnd }
            }
          },
          {
            $lookup: {
              from: 'travelagents',
              localField: 'travelAgentId',
              foreignField: '_id',
              as: 'agent'
            }
          },
          { $unwind: '$agent' },
          {
            $group: {
              _id: '$travelAgentId',
              agentCode: { $first: '$agent.agentCode' },
              companyName: { $first: '$agent.companyName' },
              totalBookings: { $sum: 1 },
              totalRevenue: { $sum: '$roomRevenue' },
              totalCommissions: { $sum: '$commissionAmount' },
              averageCommissionRate: { $avg: '$commissionRate' },
              averageBookingValue: { $avg: '$roomRevenue' },
              bookingDates: { $push: '$createdAt' }
            }
          }
        ]);

        // Get comparison period metrics
        const comparisonMetrics = await TravelAgentBooking.aggregate([
          {
            $match: {
              ...matchCriteria,
              createdAt: { $gte: comparisonStart, $lte: comparisonEnd }
            }
          },
          {
            $group: {
              _id: '$travelAgentId',
              totalBookings: { $sum: 1 },
              totalRevenue: { $sum: '$roomRevenue' },
              totalCommissions: { $sum: '$commissionAmount' },
              averageCommissionRate: { $avg: '$commissionRate' },
              averageBookingValue: { $avg: '$roomRevenue' }
            }
          }
        ]);

        // Create comparison map
        const comparisonMap = {};
        comparisonMetrics.forEach(item => {
          comparisonMap[item._id.toString()] = item;
        });

        // Calculate performance metrics with comparisons
        const performanceMetrics = currentMetrics.map(current => {
          const agentId = current._id.toString();
          const comparison = comparisonMap[agentId] || {};

          // Calculate booking frequency (days between bookings)
          const bookingDates = current.bookingDates.sort((a, b) => new Date(a) - new Date(b));
          let averageDaysBetweenBookings = 0;
          if (bookingDates.length > 1) {
            const intervals = [];
            for (let i = 1; i < bookingDates.length; i++) {
              intervals.push(moment(bookingDates[i]).diff(moment(bookingDates[i-1]), 'days'));
            }
            averageDaysBetweenBookings = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
          }

          // Calculate growth rates
          const bookingGrowth = comparison.totalBookings ?
            ((current.totalBookings - comparison.totalBookings) / comparison.totalBookings * 100) : 0;
          const revenueGrowth = comparison.totalRevenue ?
            ((current.totalRevenue - comparison.totalRevenue) / comparison.totalRevenue * 100) : 0;
          const commissionGrowth = comparison.totalCommissions ?
            ((current.totalCommissions - comparison.totalCommissions) / comparison.totalCommissions * 100) : 0;

          // Calculate performance score (0-100)
          const performanceScore = this.calculatePerformanceScore({
            bookingGrowth,
            revenueGrowth,
            commissionGrowth,
            averageBookingValue: current.averageBookingValue,
            bookingFrequency: averageDaysBetweenBookings,
            totalBookings: current.totalBookings
          });

          return {
            agentId: current._id,
            agentCode: current.agentCode,
            companyName: current.companyName,
            currentPeriod: {
              totalBookings: current.totalBookings,
              totalRevenue: current.totalRevenue,
              totalCommissions: current.totalCommissions,
              averageCommissionRate: current.averageCommissionRate,
              averageBookingValue: current.averageBookingValue,
              averageDaysBetweenBookings
            },
            comparisonPeriod: {
              totalBookings: comparison.totalBookings || 0,
              totalRevenue: comparison.totalRevenue || 0,
              totalCommissions: comparison.totalCommissions || 0,
              averageCommissionRate: comparison.averageCommissionRate || 0,
              averageBookingValue: comparison.averageBookingValue || 0
            },
            growth: {
              bookingGrowth: parseFloat(bookingGrowth.toFixed(2)),
              revenueGrowth: parseFloat(revenueGrowth.toFixed(2)),
              commissionGrowth: parseFloat(commissionGrowth.toFixed(2))
            },
            performanceScore: parseFloat(performanceScore.toFixed(2)),
            rank: 0 // Will be calculated after sorting
          };
        });

        // Sort by performance score and assign ranks
        performanceMetrics.sort((a, b) => b.performanceScore - a.performanceScore);
        performanceMetrics.forEach((metric, index) => {
          metric.rank = index + 1;
        });

        // Calculate overall metrics
        const overallMetrics = {
          totalAgents: performanceMetrics.length,
          totalBookings: performanceMetrics.reduce((sum, m) => sum + m.currentPeriod.totalBookings, 0),
          totalRevenue: performanceMetrics.reduce((sum, m) => sum + m.currentPeriod.totalRevenue, 0),
          totalCommissions: performanceMetrics.reduce((sum, m) => sum + m.currentPeriod.totalCommissions, 0),
          averagePerformanceScore: performanceMetrics.reduce((sum, m) => sum + m.performanceScore, 0) / (performanceMetrics.length || 1),
          topPerformers: performanceMetrics.slice(0, 5),
          growthLeaders: performanceMetrics
            .filter(m => m.growth.revenueGrowth > 0)
            .sort((a, b) => b.growth.revenueGrowth - a.growth.revenueGrowth)
            .slice(0, 5)
        };

        const result = {
          performanceMetrics,
          overallMetrics,
          periodInfo: {
            currentPeriod: {
              start: currentPeriodStart,
              end: currentPeriodEnd
            },
            comparisonPeriod: {
              start: comparisonStart,
              end: comparisonEnd
            },
            periodDuration
          }
        };

        logger.info(`Performance metrics calculated for ${performanceMetrics.length} agents`);
        return result;
      });
    } catch (error) {
      logger.error('Error calculating performance metrics:', error);
      throw new ApplicationError('Failed to calculate performance metrics', 500);
    }
  }

  /**
   * Process time-series data for analytics
   * @param {Object} filters - Filter criteria
   * @param {string} metric - Metric to analyze
   * @returns {Object} Time-series analysis
   */
  async processTimeSeriesData(filters = {}, metric = 'revenue') {
    try {
      const cacheKey = this.generateCacheKey('time_series', { ...filters, metric });

      return await this.getCachedOrFresh(cacheKey, async () => {
        const { startDate, endDate, travelAgentId, granularity = 'day' } = filters;

        const matchCriteria = {
          isActive: true,
          bookingStatus: 'confirmed'
        };

        if (travelAgentId) {
          matchCriteria.travelAgentId = travelAgentId;
        }

        if (startDate && endDate) {
          matchCriteria.createdAt = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          };
        }

        // Determine date grouping and aggregation field
        let dateGrouping, aggregationField;

        switch (granularity) {
          case 'hour':
            dateGrouping = {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' },
              hour: { $hour: '$createdAt' }
            };
            break;
          case 'week':
            dateGrouping = {
              year: { $year: '$createdAt' },
              week: { $week: '$createdAt' }
            };
            break;
          case 'month':
            dateGrouping = {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            };
            break;
          default: // day
            dateGrouping = {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            };
        }

        switch (metric) {
          case 'commissions':
            aggregationField = '$commissionAmount';
            break;
          case 'bookings':
            aggregationField = 1; // Count
            break;
          default: // revenue
            aggregationField = '$roomRevenue';
        }

        const timeSeriesData = await TravelAgentBooking.aggregate([
          { $match: matchCriteria },
          {
            $group: {
              _id: dateGrouping,
              value: metric === 'bookings' ? { $sum: 1 } : { $sum: aggregationField },
              count: { $sum: 1 }
            }
          },
          { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1, '_id.week': 1 } }
        ]);

        // Calculate moving averages and trends
        const movingAverageWindow = Math.min(7, timeSeriesData.length); // 7-period moving average
        const dataWithAnalysis = timeSeriesData.map((item, index) => {
          // Calculate moving average
          const startIndex = Math.max(0, index - movingAverageWindow + 1);
          const windowData = timeSeriesData.slice(startIndex, index + 1);
          const movingAverage = windowData.reduce((sum, d) => sum + d.value, 0) / windowData.length;

          // Calculate trend (simple linear regression over last 5 points)
          let trend = 0;
          if (index >= 4) {
            const trendData = timeSeriesData.slice(index - 4, index + 1);
            const trendPoints = trendData.map((d, i) => ({ x: i, y: d.value }));
            const regression = this.calculateLinearRegression(trendPoints, 'y', 0);
            trend = regression.equation.slope;
          }

          return {
            ...item,
            movingAverage: parseFloat(movingAverage.toFixed(2)),
            trend: parseFloat(trend.toFixed(2)),
            date: this.constructDateFromGrouping(item._id, granularity)
          };
        });

        // Calculate volatility and seasonality
        const values = dataWithAnalysis.map(item => item.value);
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        const volatility = Math.sqrt(variance);

        // Detect seasonality patterns
        const seasonalPatterns = this.detectSeasonalPatterns(dataWithAnalysis, granularity);

        const result = {
          timeSeries: dataWithAnalysis,
          statistics: {
            mean: parseFloat(mean.toFixed(2)),
            volatility: parseFloat(volatility.toFixed(2)),
            min: Math.min(...values),
            max: Math.max(...values),
            totalDataPoints: dataWithAnalysis.length,
            metric,
            granularity
          },
          seasonalPatterns,
          trends: {
            overallTrend: dataWithAnalysis.length > 1 ?
              (dataWithAnalysis[dataWithAnalysis.length - 1].value - dataWithAnalysis[0].value) / dataWithAnalysis.length : 0,
            recentTrend: dataWithAnalysis.length > 5 ?
              dataWithAnalysis.slice(-5).reduce((sum, item) => sum + item.trend, 0) / 5 : 0
          }
        };

        logger.info(`Time-series analysis completed for ${metric} with ${dataWithAnalysis.length} data points`);
        return result;
      });
    } catch (error) {
      logger.error('Error processing time-series data:', error);
      throw new ApplicationError('Failed to process time-series data', 500);
    }
  }

  /**
   * Calculate linear regression for forecasting
   * @param {Array} dataPoints - Array of {x, y} points
   * @param {string} yField - Field name for y values
   * @param {number} forecastPeriods - Number of periods to forecast
   * @returns {Object} Regression results
   */
  calculateLinearRegression(dataPoints, yField, forecastPeriods = 0) {
    const n = dataPoints.length;
    const sumX = dataPoints.reduce((sum, point) => sum + point.x, 0);
    const sumY = dataPoints.reduce((sum, point) => sum + point[yField], 0);
    const sumXY = dataPoints.reduce((sum, point) => sum + (point.x * point[yField]), 0);
    const sumXX = dataPoints.reduce((sum, point) => sum + (point.x * point.x), 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const meanY = sumY / n;
    const totalSumSquares = dataPoints.reduce((sum, point) => sum + Math.pow(point[yField] - meanY, 2), 0);
    const residualSumSquares = dataPoints.reduce((sum, point) => {
      const predicted = slope * point.x + intercept;
      return sum + Math.pow(point[yField] - predicted, 2);
    }, 0);
    const rSquared = 1 - (residualSumSquares / totalSumSquares);

    return {
      equation: { slope, intercept },
      rSquared,
      dataPoints: n
    };
  }

  /**
   * Calculate seasonal adjustments for forecasting
   * @param {Array} trends - Historical trend data
   * @param {string} granularity - Time granularity
   * @returns {Object} Seasonal adjustment factors
   */
  calculateSeasonalAdjustments(trends, granularity) {
    const seasonalData = {};

    trends.forEach(item => {
      const seasonKey = this.getSeasonalIndex(item._id, granularity);

      if (!seasonalData[seasonKey]) {
        seasonalData[seasonKey] = [];
      }

      seasonalData[seasonKey].push(item.totalRevenue);
    });

    // Calculate average for each season and convert to multipliers
    const overallAverage = trends.reduce((sum, item) => sum + item.totalRevenue, 0) / trends.length;
    const seasonalAdjustments = {};

    Object.keys(seasonalData).forEach(seasonKey => {
      const seasonAverage = seasonalData[seasonKey].reduce((sum, value) => sum + value, 0) / seasonalData[seasonKey].length;
      seasonalAdjustments[seasonKey] = seasonAverage / overallAverage;
    });

    return seasonalAdjustments;
  }

  /**
   * Get seasonal index based on date and granularity
   * @param {Object|Date} date - Date object or date grouping
   * @param {string} granularity - Time granularity
   * @returns {string} Seasonal index
   */
  getSeasonalIndex(date, granularity) {
    if (date instanceof Date) {
      switch (granularity) {
        case 'day':
          return `${date.getMonth() + 1}-${date.getDate()}`;
        case 'week':
          return `week-${moment(date).week()}`;
        case 'quarter':
          return `quarter-${Math.ceil((date.getMonth() + 1) / 3)}`;
        default: // month
          return `month-${date.getMonth() + 1}`;
      }
    } else {
      // Date grouping object
      switch (granularity) {
        case 'day':
          return `${date.month}-${date.day}`;
        case 'week':
          return `week-${date.week}`;
        case 'quarter':
          return `quarter-${date.quarter}`;
        default: // month
          return `month-${date.month}`;
      }
    }
  }

  /**
   * Calculate forecast date based on granularity
   * @param {Date} baseDate - Base date
   * @param {number} periods - Number of periods ahead
   * @param {string} granularity - Time granularity
   * @returns {Date} Forecast date
   */
  calculateForecastDate(baseDate, periods, granularity) {
    const date = moment(baseDate);

    switch (granularity) {
      case 'day':
        return date.add(periods, 'days').toDate();
      case 'week':
        return date.add(periods, 'weeks').toDate();
      case 'quarter':
        return date.add(periods * 3, 'months').toDate();
      default: // month
        return date.add(periods, 'months').toDate();
    }
  }

  /**
   * Calculate confidence level for forecasts
   * @param {number} rSquared - R-squared value from regression
   * @param {number} periodsAhead - Number of periods ahead
   * @returns {number} Confidence percentage
   */
  calculateConfidence(rSquared, periodsAhead) {
    const baseConfidence = rSquared * 100;
    const decayFactor = Math.pow(0.9, periodsAhead - 1); // Confidence decreases over time
    return Math.max(10, baseConfidence * decayFactor); // Minimum 10% confidence
  }

  /**
   * Get seasonal multiplier for commission projections
   * @param {number} month - Month (1-12)
   * @returns {number} Seasonal multiplier
   */
  getSeasonalMultiplier(month) {
    // Basic seasonal pattern - adjust based on actual business patterns
    const seasonalFactors = {
      1: 0.9,   // January - slow after holidays
      2: 0.85,  // February - typically slow
      3: 1.0,   // March - normal
      4: 1.1,   // April - spring travel
      5: 1.15,  // May - peak spring
      6: 1.2,   // June - summer starts
      7: 1.25,  // July - peak summer
      8: 1.2,   // August - summer continues
      9: 1.1,   // September - back to school
      10: 1.05, // October - fall travel
      11: 1.1,  // November - holiday season starts
      12: 1.15  // December - holiday peak
    };

    return seasonalFactors[month] || 1.0;
  }

  /**
   * Calculate projection confidence based on data quality
   * @param {number} dataPoints - Number of historical data points
   * @param {number} periodsAhead - Number of periods ahead
   * @returns {number} Confidence percentage
   */
  calculateProjectionConfidence(dataPoints, periodsAhead) {
    let baseConfidence = Math.min(90, dataPoints * 10); // More data = higher confidence, max 90%
    const decayFactor = Math.pow(0.85, periodsAhead - 1); // Confidence decreases over time
    return Math.max(15, baseConfidence * decayFactor); // Minimum 15% confidence
  }

  /**
   * Calculate performance score for travel agents
   * @param {Object} metrics - Performance metrics
   * @returns {number} Performance score (0-100)
   */
  calculatePerformanceScore(metrics) {
    const {
      bookingGrowth,
      revenueGrowth,
      commissionGrowth,
      averageBookingValue,
      bookingFrequency,
      totalBookings
    } = metrics;

    // Weight factors for different metrics
    const weights = {
      growth: 0.4,      // 40% - Growth trends
      volume: 0.25,     // 25% - Booking volume
      value: 0.25,      // 25% - Booking value
      frequency: 0.1    // 10% - Booking frequency
    };

    // Growth score (0-30 points)
    const avgGrowth = (bookingGrowth + revenueGrowth + commissionGrowth) / 3;
    const growthScore = Math.max(0, Math.min(30, 15 + (avgGrowth / 5))); // Base 15, up to 30

    // Volume score (0-25 points)
    const volumeScore = Math.min(25, totalBookings * 2); // 2 points per booking, max 25

    // Value score (0-25 points)
    const valueScore = Math.min(25, (averageBookingValue / 100) * 2); // Scale based on booking value

    // Frequency score (0-10 points)
    const frequencyScore = bookingFrequency > 0 ?
      Math.max(0, Math.min(10, 10 - (bookingFrequency / 7))) : 10; // Better score for more frequent bookings

    const totalScore = (growthScore * weights.growth * 100 / 30) +
                      (volumeScore * weights.volume * 100 / 25) +
                      (valueScore * weights.value * 100 / 25) +
                      (frequencyScore * weights.frequency * 100 / 10);

    return Math.max(0, Math.min(100, totalScore));
  }

  /**
   * Construct date from aggregation grouping
   * @param {Object} grouping - MongoDB date grouping result
   * @param {string} granularity - Time granularity
   * @returns {Date} Constructed date
   */
  constructDateFromGrouping(grouping, granularity) {
    const { year, month, day, hour, week, quarter } = grouping;

    switch (granularity) {
      case 'hour':
        return new Date(year, month - 1, day, hour);
      case 'week':
        return moment().year(year).week(week).startOf('week').toDate();
      case 'quarter':
        return new Date(year, (quarter - 1) * 3, 1);
      case 'month':
        return new Date(year, month - 1, 1);
      default: // day
        return new Date(year, month - 1, day);
    }
  }

  /**
   * Detect seasonal patterns in time series data
   * @param {Array} timeSeriesData - Time series data points
   * @param {string} granularity - Time granularity
   * @returns {Object} Seasonal pattern analysis
   */
  detectSeasonalPatterns(timeSeriesData, granularity) {
    const patterns = {};

    timeSeriesData.forEach(item => {
      const seasonKey = this.getSeasonalIndex(item.date, granularity);

      if (!patterns[seasonKey]) {
        patterns[seasonKey] = {
          values: [],
          count: 0,
          average: 0,
          trend: 0
        };
      }

      patterns[seasonKey].values.push(item.value);
      patterns[seasonKey].count++;
    });

    // Calculate statistics for each pattern
    Object.keys(patterns).forEach(seasonKey => {
      const pattern = patterns[seasonKey];
      pattern.average = pattern.values.reduce((sum, v) => sum + v, 0) / pattern.values.length;

      // Calculate trend within the season
      if (pattern.values.length > 1) {
        const trendPoints = pattern.values.map((v, i) => ({ x: i, y: v }));
        const regression = this.calculateLinearRegression(trendPoints, 'y', 0);
        pattern.trend = regression.equation.slope;
      }
    });

    return patterns;
  }

  /**
   * Clear analytics cache
   */
  clearCache() {
    this.cache.clear();
    logger.info('Analytics cache cleared');
  }
}

export default new AnalyticsService();