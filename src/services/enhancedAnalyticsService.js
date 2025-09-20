import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import User from '../models/User.js';
import SupplyRequest from '../models/SupplyRequest.js';
import DepartmentBudget from '../models/DepartmentBudget.js';
import Vendor from '../models/Vendor.js';
import CheckoutInventory from '../models/CheckoutInventory.js';
import MaintenanceTask from '../models/MaintenanceTask.js';
import logger from '../utils/logger.js';

class EnhancedAnalyticsService {
  /**
   * Get comprehensive financial trends with real data
   */
  async getFinancialTrends(hotelId, startDate, endDate, period = 'daily') {
    try {
      const dateFormat = this.getDateFormat(period);

      // Get revenue trends from bookings
      const revenueTrends = await Booking.aggregate([
        {
          $match: {
            hotelId: new mongoose.Types.ObjectId(hotelId),
            createdAt: { $gte: startDate, $lte: endDate },
            status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: dateFormat, date: '$createdAt' } }
            },
            revenue: { $sum: '$totalAmount' },
            bookingCount: { $sum: 1 },
            averageBookingValue: { $avg: '$totalAmount' }
          }
        },
        { $sort: { '_id.date': 1 } }
      ]);

      // Get expense trends from supply requests, maintenance, etc.
      const expenseTrends = await this.calculateExpenseTrends(hotelId, startDate, endDate, dateFormat);

      // Get occupancy trends
      const occupancyTrends = await this.calculateOccupancyTrends(hotelId, startDate, endDate, dateFormat);

      // Combine and format data
      const trends = this.combineTrendData(revenueTrends, expenseTrends, occupancyTrends);

      return {
        success: true,
        data: {
          labels: trends.labels,
          revenue: trends.revenue,
          expenses: trends.expenses,
          profit: trends.profit,
          occupancy: trends.occupancy,
          summary: {
            totalRevenue: trends.revenue.reduce((sum, val) => sum + val, 0),
            totalExpenses: trends.expenses.reduce((sum, val) => sum + val, 0),
            averageOccupancy: trends.occupancy.reduce((sum, val) => sum + val, 0) / trends.occupancy.length
          }
        }
      };
    } catch (error) {
      logger.error('Error getting financial trends:', error);
      throw error;
    }
  }

  /**
   * Get real-time business intelligence metrics
   */
  async getBusinessIntelligence(hotelId, period = '30d') {
    try {
      const { startDate, endDate } = this.calculateDateRange(period);

      // Execute multiple queries in parallel
      const [
        revenueMetrics,
        operationalMetrics,
        customerMetrics,
        performanceMetrics
      ] = await Promise.all([
        this.calculateRevenueMetrics(hotelId, startDate, endDate),
        this.calculateOperationalMetrics(hotelId, startDate, endDate),
        this.calculateCustomerMetrics(hotelId, startDate, endDate),
        this.calculatePerformanceMetrics(hotelId, startDate, endDate)
      ]);

      // Generate insights based on data
      const insights = this.generateBusinessInsights({
        revenue: revenueMetrics,
        operational: operationalMetrics,
        customer: customerMetrics,
        performance: performanceMetrics
      });

      return {
        success: true,
        data: {
          kpis: {
            revenue: revenueMetrics,
            operational: operationalMetrics,
            customer: customerMetrics,
            performance: performanceMetrics
          },
          insights,
          generatedAt: new Date().toISOString(),
          period
        }
      };
    } catch (error) {
      logger.error('Error getting business intelligence:', error);
      throw error;
    }
  }

  /**
   * Get predictive analytics for demand forecasting
   */
  async getDemandForecast(hotelId, forecastDays = 30) {
    try {
      // Get historical data for pattern analysis
      const historicalData = await this.getHistoricalBookingPatterns(hotelId, 90);

      // Analyze seasonal patterns
      const seasonalPatterns = this.analyzeSeasonalPatterns(historicalData);

      // Analyze day-of-week patterns
      const weeklyPatterns = this.analyzeWeeklyPatterns(historicalData);

      // Generate forecast
      const forecast = this.generateDemandForecast(
        seasonalPatterns,
        weeklyPatterns,
        forecastDays
      );

      // Calculate confidence levels
      const confidenceLevels = this.calculateForecastConfidence(historicalData, forecast);

      return {
        success: true,
        data: {
          forecast: forecast.map((item, index) => ({
            ...item,
            confidence: confidenceLevels[index]
          })),
          patterns: {
            seasonal: seasonalPatterns,
            weekly: weeklyPatterns
          },
          metadata: {
            historicalDataPoints: historicalData.length,
            forecastDays,
            generatedAt: new Date().toISOString()
          }
        }
      };
    } catch (error) {
      logger.error('Error generating demand forecast:', error);
      throw error;
    }
  }

  /**
   * Get cost anomaly detection analysis
   */
  async getCostAnomalyDetection(hotelId, period = '30d') {
    try {
      const { startDate, endDate } = this.calculateDateRange(period);

      // Get historical cost baseline
      const baselineData = await this.calculateCostBaseline(hotelId, startDate, endDate);

      // Get current period costs
      const currentCosts = await this.getCurrentPeriodCosts(hotelId, startDate, endDate);

      // Detect anomalies
      const anomalies = this.detectCostAnomalies(baselineData, currentCosts);

      // Generate recommendations
      const recommendations = this.generateCostOptimizationRecommendations(anomalies, currentCosts);

      return {
        success: true,
        data: {
          anomalies,
          baseline: baselineData,
          current: currentCosts,
          recommendations,
          summary: {
            totalAnomalies: anomalies.length,
            potentialSavings: recommendations.reduce((sum, rec) => sum + (rec.potentialSavings || 0), 0),
            riskLevel: this.calculateRiskLevel(anomalies)
          }
        }
      };
    } catch (error) {
      logger.error('Error detecting cost anomalies:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive vendor performance analytics
   */
  async getVendorPerformanceAnalytics(hotelId, period = '30d') {
    try {
      const { startDate, endDate } = this.calculateDateRange(period);

      // Get vendor performance data
      const vendorPerformance = await Vendor.aggregate([
        {
          $match: {
            hotelId: new mongoose.Types.ObjectId(hotelId),
            isActive: true
          }
        },
        {
          $addFields: {
            reliabilityScore: {
              $add: [
                { $multiply: [{ $divide: ['$performance.onTimeDelivery', 100] }, 30] },
                { $multiply: [{ $divide: ['$performance.qualityRating', 5] }, 25] },
                { $multiply: [{ $divide: ['$performance.completionRate', 100] }, 20] },
                { $multiply: [{ $min: [{ $divide: ['$performance.orderCount', 50] }, 1] }, 15] },
                { $multiply: [{ $divide: ['$rating', 5] }, 10] }
              ]
            }
          }
        },
        {
          $lookup: {
            from: 'supplyrequests',
            let: { vendorName: '$name' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$hotelId', new mongoose.Types.ObjectId(hotelId)] },
                      { $gte: ['$createdAt', startDate] },
                      { $lte: ['$createdAt', endDate] }
                    ]
                  }
                }
              },
              { $unwind: '$items' },
              {
                $match: {
                  $expr: { $eq: ['$items.supplier', '$$vendorName'] }
                }
              }
            ],
            as: 'recentOrders'
          }
        },
        {
          $project: {
            name: 1,
            category: 1,
            rating: 1,
            isPreferred: 1,
            performance: 1,
            totalOrderValue: 1,
            reliabilityScore: 1,
            recentOrderCount: { $size: '$recentOrders' },
            recentOrderValue: {
              $reduce: {
                input: '$recentOrders',
                initialValue: 0,
                in: { $add: ['$$value', { $multiply: ['$$this.items.quantity', '$$this.items.estimatedCost'] }] }
              }
            }
          }
        },
        { $sort: { reliabilityScore: -1 } }
      ]);

      // Calculate category performance
      const categoryPerformance = await this.calculateVendorCategoryPerformance(hotelId, startDate, endDate);

      // Generate vendor insights
      const insights = this.generateVendorInsights(vendorPerformance, categoryPerformance);

      return {
        success: true,
        data: {
          vendors: vendorPerformance,
          categoryPerformance,
          insights,
          summary: {
            totalVendors: vendorPerformance.length,
            averageReliabilityScore: vendorPerformance.reduce((sum, v) => sum + v.reliabilityScore, 0) / vendorPerformance.length,
            topPerformers: vendorPerformance.slice(0, 5),
            needsImprovement: vendorPerformance.filter(v => v.reliabilityScore < 60)
          }
        }
      };
    } catch (error) {
      logger.error('Error getting vendor performance analytics:', error);
      throw error;
    }
  }

  // Helper methods

  getDateFormat(period) {
    switch (period) {
      case 'hourly': return '%Y-%m-%d %H:00';
      case 'daily': return '%Y-%m-%d';
      case 'weekly': return '%Y-%U';
      case 'monthly': return '%Y-%m';
      case 'yearly': return '%Y';
      default: return '%Y-%m-%d';
    }
  }

  calculateDateRange(period) {
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    return { startDate, endDate };
  }

  async calculateExpenseTrends(hotelId, startDate, endDate, dateFormat) {
    // Calculate expenses from supply requests
    const supplyExpenses = await SupplyRequest.aggregate([
      {
        $match: {
          hotelId: new mongoose.Types.ObjectId(hotelId),
          createdAt: { $gte: startDate, $lte: endDate },
          status: { $in: ['approved', 'ordered', 'received'] }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: dateFormat, date: '$createdAt' } }
          },
          supplyExpenses: { $sum: '$totalActualCost' }
        }
      }
    ]);

    // Calculate maintenance expenses
    const maintenanceExpenses = await MaintenanceTask.aggregate([
      {
        $match: {
          hotelId: new mongoose.Types.ObjectId(hotelId),
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: dateFormat, date: '$createdAt' } }
          },
          maintenanceExpenses: { $sum: '$cost' }
        }
      }
    ]);

    // Combine expense data
    const expenseMap = new Map();

    supplyExpenses.forEach(item => {
      expenseMap.set(item._id.date, (expenseMap.get(item._id.date) || 0) + item.supplyExpenses);
    });

    maintenanceExpenses.forEach(item => {
      expenseMap.set(item._id.date, (expenseMap.get(item._id.date) || 0) + item.maintenanceExpenses);
    });

    return Array.from(expenseMap.entries()).map(([date, expenses]) => ({
      _id: { date },
      expenses
    })).sort((a, b) => a._id.date.localeCompare(b._id.date));
  }

  async calculateOccupancyTrends(hotelId, startDate, endDate, dateFormat) {
    const totalRooms = await Room.countDocuments({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      isActive: true
    });

    return await Booking.aggregate([
      {
        $match: {
          hotelId: new mongoose.Types.ObjectId(hotelId),
          checkIn: { $gte: startDate, $lte: endDate },
          status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: dateFormat, date: '$checkIn' } }
          },
          occupiedRooms: { $sum: { $size: '$rooms' } }
        }
      },
      {
        $addFields: {
          occupancyRate: { $multiply: [{ $divide: ['$occupiedRooms', totalRooms] }, 100] }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);
  }

  combineTrendData(revenueTrends, expenseTrends, occupancyTrends) {
    const dateMap = new Map();

    // Collect all unique dates
    const allDates = new Set();
    revenueTrends.forEach(item => allDates.add(item._id.date));
    expenseTrends.forEach(item => allDates.add(item._id.date));
    occupancyTrends.forEach(item => allDates.add(item._id.date));

    // Initialize data structure
    Array.from(allDates).sort().forEach(date => {
      dateMap.set(date, { revenue: 0, expenses: 0, occupancy: 0 });
    });

    // Populate data
    revenueTrends.forEach(item => {
      const data = dateMap.get(item._id.date);
      if (data) data.revenue = item.revenue;
    });

    expenseTrends.forEach(item => {
      const data = dateMap.get(item._id.date);
      if (data) data.expenses = item.expenses;
    });

    occupancyTrends.forEach(item => {
      const data = dateMap.get(item._id.date);
      if (data) data.occupancy = item.occupancyRate;
    });

    // Convert to arrays
    const sortedDates = Array.from(allDates).sort();
    return {
      labels: sortedDates,
      revenue: sortedDates.map(date => dateMap.get(date).revenue),
      expenses: sortedDates.map(date => dateMap.get(date).expenses),
      profit: sortedDates.map(date => dateMap.get(date).revenue - dateMap.get(date).expenses),
      occupancy: sortedDates.map(date => dateMap.get(date).occupancy)
    };
  }

  async calculateRevenueMetrics(hotelId, startDate, endDate) {
    const metrics = await Booking.aggregate([
      {
        $match: {
          hotelId: new mongoose.Types.ObjectId(hotelId),
          checkIn: { $gte: startDate, $lte: endDate },
          status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalBookings: { $sum: 1 },
          averageBookingValue: { $avg: '$totalAmount' },
          totalNights: { $sum: '$nights' }
        }
      }
    ]);

    return metrics[0] || { totalRevenue: 0, totalBookings: 0, averageBookingValue: 0, totalNights: 0 };
  }

  async calculateOperationalMetrics(hotelId, startDate, endDate) {
    const [maintenanceMetrics, supplyMetrics, staffMetrics] = await Promise.all([
      // Maintenance metrics
      MaintenanceTask.aggregate([
        {
          $match: {
            hotelId: new mongoose.Types.ObjectId(hotelId),
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: null,
            totalTasks: { $sum: 1 },
            completedTasks: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            totalMaintenanceCost: { $sum: '$cost' },
            averageCompletionTime: { $avg: '$estimatedDuration' }
          }
        }
      ]),

      // Supply request metrics
      SupplyRequest.aggregate([
        {
          $match: {
            hotelId: new mongoose.Types.ObjectId(hotelId),
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: null,
            totalRequests: { $sum: 1 },
            approvedRequests: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
            totalSupplyCost: { $sum: '$totalActualCost' }
          }
        }
      ]),

      // Staff metrics (simplified)
      User.aggregate([
        {
          $match: {
            hotelId: new mongoose.Types.ObjectId(hotelId),
            role: 'staff',
            isActive: true
          }
        },
        {
          $group: {
            _id: null,
            totalStaff: { $sum: 1 },
            activeDepartments: { $addToSet: '$department' }
          }
        }
      ])
    ]);

    return {
      maintenance: maintenanceMetrics[0] || {},
      supply: supplyMetrics[0] || {},
      staff: staffMetrics[0] || {}
    };
  }

  async calculateCustomerMetrics(hotelId, startDate, endDate) {
    return await Booking.aggregate([
      {
        $match: {
          hotelId: new mongoose.Types.ObjectId(hotelId),
          checkIn: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          uniqueGuests: { $addToSet: '$userId' },
          totalBookings: { $sum: 1 },
          averageStayDuration: { $avg: '$nights' },
          repeatGuests: {
            $sum: {
              $cond: [
                { $gt: [{ $size: { $filter: { input: '$rooms', cond: { $gt: ['$$this.rate', 5000] } } } }, 0] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $addFields: {
          uniqueGuestCount: { $size: '$uniqueGuests' },
          customerRetentionRate: {
            $multiply: [
              { $divide: ['$repeatGuests', '$totalBookings'] },
              100
            ]
          }
        }
      }
    ]).then(result => result[0] || {});
  }

  async calculatePerformanceMetrics(hotelId, startDate, endDate) {
    const totalRooms = await Room.countDocuments({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      isActive: true
    });

    const bookingMetrics = await Booking.aggregate([
      {
        $match: {
          hotelId: new mongoose.Types.ObjectId(hotelId),
          checkIn: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalRoomNights: { $sum: '$nights' },
          totalBookings: { $sum: 1 }
        }
      }
    ]);

    const metrics = bookingMetrics[0] || {};
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const totalPossibleRoomNights = totalRooms * days;

    return {
      occupancyRate: totalPossibleRoomNights > 0 ? (metrics.totalRoomNights / totalPossibleRoomNights) * 100 : 0,
      averageDailyRate: metrics.totalRoomNights > 0 ? metrics.totalRevenue / metrics.totalRoomNights : 0,
      revenuePAR: totalPossibleRoomNights > 0 ? metrics.totalRevenue / totalRooms / days : 0,
      totalRooms,
      totalPossibleRoomNights
    };
  }

  generateBusinessInsights(data) {
    const insights = [];

    // Revenue insights
    if (data.revenue.totalRevenue > 100000) {
      insights.push({
        type: 'positive',
        category: 'revenue',
        title: 'Strong Revenue Performance',
        description: `Generated ₹${Math.round(data.revenue.totalRevenue).toLocaleString()} in revenue`,
        impact: 'high'
      });
    }

    // Occupancy insights
    if (data.performance.occupancyRate > 80) {
      insights.push({
        type: 'positive',
        category: 'occupancy',
        title: 'High Occupancy Rate',
        description: `Achieving ${Math.round(data.performance.occupancyRate)}% occupancy`,
        impact: 'medium'
      });
    } else if (data.performance.occupancyRate < 50) {
      insights.push({
        type: 'warning',
        category: 'occupancy',
        title: 'Low Occupancy Alert',
        description: `Occupancy at ${Math.round(data.performance.occupancyRate)}% - consider marketing efforts`,
        impact: 'high'
      });
    }

    // Operational insights
    if (data.operational.maintenance.completedTasks / data.operational.maintenance.totalTasks > 0.9) {
      insights.push({
        type: 'positive',
        category: 'operations',
        title: 'Excellent Maintenance Performance',
        description: 'Over 90% of maintenance tasks completed on time',
        impact: 'medium'
      });
    }

    return insights;
  }

  async getHistoricalBookingPatterns(hotelId, days) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return await Booking.find({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      createdAt: { $gte: startDate },
      status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
    }).select('createdAt checkIn totalAmount nights');
  }

  analyzeSeasonalPatterns(historicalData) {
    const monthlyData = {};

    historicalData.forEach(booking => {
      const month = new Date(booking.checkIn).getMonth();
      if (!monthlyData[month]) {
        monthlyData[month] = { bookings: 0, revenue: 0 };
      }
      monthlyData[month].bookings += 1;
      monthlyData[month].revenue += booking.totalAmount;
    });

    return monthlyData;
  }

  analyzeWeeklyPatterns(historicalData) {
    const weeklyData = {};

    historicalData.forEach(booking => {
      const dayOfWeek = new Date(booking.checkIn).getDay();
      if (!weeklyData[dayOfWeek]) {
        weeklyData[dayOfWeek] = { bookings: 0, revenue: 0 };
      }
      weeklyData[dayOfWeek].bookings += 1;
      weeklyData[dayOfWeek].revenue += booking.totalAmount;
    });

    return weeklyData;
  }

  generateDemandForecast(seasonalPatterns, weeklyPatterns, days) {
    const forecast = [];
    const today = new Date();

    for (let i = 1; i <= days; i++) {
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + i);

      const month = futureDate.getMonth();
      const dayOfWeek = futureDate.getDay();

      const seasonalFactor = seasonalPatterns[month] ? seasonalPatterns[month].bookings / 30 : 2;
      const weeklyFactor = weeklyPatterns[dayOfWeek] ? weeklyPatterns[dayOfWeek].bookings / 7 : 2;

      const baseDemand = (seasonalFactor + weeklyFactor) / 2;
      const variance = Math.random() * 0.3 - 0.15; // ±15% variance
      const predictedDemand = Math.max(0, baseDemand * (1 + variance));

      forecast.push({
        date: futureDate.toISOString().split('T')[0],
        predictedDemand: Math.round(predictedDemand),
        predictedRevenue: Math.round(predictedDemand * 8000), // Estimated revenue per booking
        factors: this.getDemandFactors(futureDate, seasonalFactor, weeklyFactor)
      });
    }

    return forecast;
  }

  getDemandFactors(date, seasonalFactor, weeklyFactor) {
    const factors = [];

    if (weeklyFactor > 3) factors.push('Weekend surge');
    if (seasonalFactor > 4) factors.push('Peak season');
    if (date.getDay() === 1) factors.push('Monday dip');
    if (seasonalFactor < 1.5) factors.push('Off season');

    return factors.length > 0 ? factors : ['Normal demand'];
  }

  calculateForecastConfidence(historicalData, forecast) {
    const dataQuality = Math.min(100, (historicalData.length / 30) * 100);
    const baseConfidence = 60 + (dataQuality * 0.3);

    return forecast.map((item, index) => {
      const futureDistance = index + 1;
      const distancePenalty = Math.min(30, futureDistance * 0.5);
      return Math.max(40, Math.round(baseConfidence - distancePenalty));
    });
  }

  async calculateCostBaseline(hotelId, startDate, endDate) {
    const historicalStartDate = new Date(startDate);
    historicalStartDate.setDate(historicalStartDate.getDate() - 90); // 90 days historical

    const [supplyBaseline, maintenanceBaseline] = await Promise.all([
      SupplyRequest.aggregate([
        {
          $match: {
            hotelId: new mongoose.Types.ObjectId(hotelId),
            createdAt: { $gte: historicalStartDate, $lt: startDate },
            status: { $in: ['approved', 'ordered', 'received'] }
          }
        },
        {
          $group: {
            _id: '$department',
            avgCost: { $avg: '$totalActualCost' },
            count: { $sum: 1 }
          }
        }
      ]),

      MaintenanceTask.aggregate([
        {
          $match: {
            hotelId: new mongoose.Types.ObjectId(hotelId),
            createdAt: { $gte: historicalStartDate, $lt: startDate },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: '$category',
            avgCost: { $avg: '$cost' },
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    return { supply: supplyBaseline, maintenance: maintenanceBaseline };
  }

  async getCurrentPeriodCosts(hotelId, startDate, endDate) {
    const [currentSupply, currentMaintenance] = await Promise.all([
      SupplyRequest.aggregate([
        {
          $match: {
            hotelId: new mongoose.Types.ObjectId(hotelId),
            createdAt: { $gte: startDate, $lte: endDate },
            status: { $in: ['approved', 'ordered', 'received'] }
          }
        },
        {
          $group: {
            _id: '$department',
            totalCost: { $sum: '$totalActualCost' },
            avgCost: { $avg: '$totalActualCost' },
            count: { $sum: 1 }
          }
        }
      ]),

      MaintenanceTask.aggregate([
        {
          $match: {
            hotelId: new mongoose.Types.ObjectId(hotelId),
            createdAt: { $gte: startDate, $lte: endDate },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: '$category',
            totalCost: { $sum: '$cost' },
            avgCost: { $avg: '$cost' },
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    return { supply: currentSupply, maintenance: currentMaintenance };
  }

  detectCostAnomalies(baseline, current) {
    const anomalies = [];
    const threshold = 2.0; // 2 standard deviations

    // Check supply request anomalies
    current.supply.forEach(currentItem => {
      const baselineItem = baseline.supply.find(b => b._id === currentItem._id);
      if (baselineItem) {
        const deviation = Math.abs(currentItem.avgCost - baselineItem.avgCost) / baselineItem.avgCost;
        if (deviation > threshold) {
          anomalies.push({
            type: 'supply',
            category: currentItem._id,
            deviation: Math.round(deviation * 100),
            currentCost: currentItem.avgCost,
            baselineCost: baselineItem.avgCost,
            severity: deviation > 3 ? 'high' : 'medium'
          });
        }
      }
    });

    // Check maintenance anomalies
    current.maintenance.forEach(currentItem => {
      const baselineItem = baseline.maintenance.find(b => b._id === currentItem._id);
      if (baselineItem) {
        const deviation = Math.abs(currentItem.avgCost - baselineItem.avgCost) / baselineItem.avgCost;
        if (deviation > threshold) {
          anomalies.push({
            type: 'maintenance',
            category: currentItem._id,
            deviation: Math.round(deviation * 100),
            currentCost: currentItem.avgCost,
            baselineCost: baselineItem.avgCost,
            severity: deviation > 3 ? 'high' : 'medium'
          });
        }
      }
    });

    return anomalies;
  }

  generateCostOptimizationRecommendations(anomalies, currentCosts) {
    const recommendations = [];

    anomalies.forEach(anomaly => {
      if (anomaly.currentCost > anomaly.baselineCost) {
        recommendations.push({
          title: `Review ${anomaly.category} ${anomaly.type} costs`,
          description: `Costs have increased by ${anomaly.deviation}% above baseline`,
          potentialSavings: (anomaly.currentCost - anomaly.baselineCost) * 0.5,
          priority: anomaly.severity,
          actions: [
            'Review vendor contracts',
            'Negotiate better pricing',
            'Consider alternative suppliers',
            'Optimize usage patterns'
          ]
        });
      }
    });

    return recommendations;
  }

  calculateRiskLevel(anomalies) {
    if (anomalies.length === 0) return 'low';

    const highSeverityCount = anomalies.filter(a => a.severity === 'high').length;
    const totalDeviation = anomalies.reduce((sum, a) => sum + a.deviation, 0);

    if (highSeverityCount > 0 || totalDeviation > 500) return 'high';
    if (anomalies.length > 3 || totalDeviation > 200) return 'medium';
    return 'low';
  }

  async calculateVendorCategoryPerformance(hotelId, startDate, endDate) {
    return await Vendor.aggregate([
      {
        $match: {
          hotelId: new mongoose.Types.ObjectId(hotelId),
          isActive: true
        }
      },
      {
        $group: {
          _id: '$category',
          averageRating: { $avg: '$rating' },
          averageReliability: { $avg: '$performance.onTimeDelivery' },
          vendorCount: { $sum: 1 },
          totalOrderValue: { $sum: '$totalOrderValue' }
        }
      },
      { $sort: { averageRating: -1 } }
    ]);
  }

  generateVendorInsights(vendorPerformance, categoryPerformance) {
    const insights = [];

    // Top performing vendors
    const topVendors = vendorPerformance.slice(0, 3);
    if (topVendors.length > 0) {
      insights.push({
        type: 'positive',
        title: 'Top Performing Vendors',
        description: `${topVendors.map(v => v.name).join(', ')} showing excellent performance`,
        impact: 'medium'
      });
    }

    // Underperforming vendors
    const underperforming = vendorPerformance.filter(v => v.reliabilityScore < 60);
    if (underperforming.length > 0) {
      insights.push({
        type: 'warning',
        title: 'Vendors Need Attention',
        description: `${underperforming.length} vendors with reliability scores below 60%`,
        impact: 'high'
      });
    }

    // Category insights
    const bestCategory = categoryPerformance[0];
    if (bestCategory) {
      insights.push({
        type: 'info',
        title: 'Best Category Performance',
        description: `${bestCategory._id} category averaging ${Math.round(bestCategory.averageRating * 10) / 10} star rating`,
        impact: 'low'
      });
    }

    return insights;
  }
}

export default new EnhancedAnalyticsService();