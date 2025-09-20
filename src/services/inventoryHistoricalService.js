import InventoryHistory from '../models/InventoryHistory.js';
import InventoryItem from '../models/InventoryItem.js';
import InventoryTransaction from '../models/InventoryTransaction.js';
import mongoose from 'mongoose';

/**
 * Inventory Historical Analysis Service
 * Provides advanced analytics for inventory trends, patterns, and predictions
 */
class InventoryHistoricalService {
  /**
   * Create a historical snapshot of current inventory state
   */
  static async createSnapshot(hotelId, snapshotType = 'manual', triggeredBy = null) {
    try {
      const snapshot = await InventoryHistory.createSnapshot(hotelId, snapshotType);

      // If this is a triggered snapshot, add trigger information
      if (triggeredBy) {
        snapshot.triggers.push(triggeredBy);
        await snapshot.save();
      }

      return snapshot;
    } catch (error) {
      throw new Error(`Failed to create inventory snapshot: ${error.message}`);
    }
  }

  /**
   * Get trend analysis for specific items or categories
   */
  static async getTrendAnalysis(hotelId, options = {}) {
    try {
      const {
        itemIds = [],
        categories = [],
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days default
        endDate = new Date(),
        granularity = 'daily' // daily, weekly, monthly
      } = options;

      let matchQuery = {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        snapshotDate: { $gte: startDate, $lte: endDate }
      };

      // Add item or category filters
      let itemFilter = {};
      if (itemIds.length > 0) {
        itemFilter['items.itemId'] = { $in: itemIds.map(id => new mongoose.Types.ObjectId(id)) };
      }
      if (categories.length > 0) {
        itemFilter['items.category'] = { $in: categories };
      }

      const pipeline = [
        { $match: matchQuery },
        { $unwind: '$items' }
      ];

      if (Object.keys(itemFilter).length > 0) {
        pipeline.push({ $match: itemFilter });
      }

      // Group by time period based on granularity
      let groupBy;
      switch (granularity) {
        case 'weekly':
          groupBy = {
            year: '$period.year',
            week: '$period.week'
          };
          break;
        case 'monthly':
          groupBy = {
            year: '$period.year',
            month: '$period.month'
          };
          break;
        default: // daily
          groupBy = {
            year: '$period.year',
            month: '$period.month',
            day: '$period.day'
          };
      }

      pipeline.push(
        {
          $group: {
            _id: {
              itemId: '$items.itemId',
              name: '$items.name',
              category: '$items.category',
              period: groupBy
            },
            avgStockLevel: { $avg: '$items.stockLevel' },
            avgConsumptionRate: { $avg: '$items.consumptionRate' },
            avgTotalValue: { $avg: '$items.totalValue' },
            minStock: { $min: '$items.stockLevel' },
            maxStock: { $max: '$items.stockLevel' },
            dataPoints: { $sum: 1 },
            snapshots: {
              $push: {
                date: '$snapshotDate',
                stockLevel: '$items.stockLevel',
                consumptionRate: '$items.consumptionRate',
                totalValue: '$items.totalValue',
                daysOfStock: '$items.daysOfStock'
              }
            }
          }
        },
        {
          $sort: {
            '_id.itemId': 1,
            '_id.period.year': 1,
            '_id.period.month': 1,
            '_id.period.day': 1
          }
        }
      );

      const results = await InventoryHistory.aggregate(pipeline);

      // Process results to calculate trends
      const trendData = {};
      results.forEach(item => {
        const itemId = item._id.itemId.toString();
        if (!trendData[itemId]) {
          trendData[itemId] = {
            itemId: item._id.itemId,
            name: item._id.name,
            category: item._id.category,
            periods: [],
            overallTrend: 'stable',
            volatility: 0,
            seasonality: null
          };
        }

        trendData[itemId].periods.push({
          period: item._id.period,
          avgStockLevel: Math.round(item.avgStockLevel),
          avgConsumptionRate: parseFloat(item.avgConsumptionRate.toFixed(2)),
          avgTotalValue: parseFloat(item.avgTotalValue.toFixed(2)),
          minStock: item.minStock,
          maxStock: item.maxStock,
          dataPoints: item.dataPoints,
          snapshots: item.snapshots
        });
      });

      // Calculate overall trends and volatility for each item
      Object.values(trendData).forEach(item => {
        if (item.periods.length >= 3) {
          const stockLevels = item.periods.map(p => p.avgStockLevel);
          const consumptionRates = item.periods.map(p => p.avgConsumptionRate);

          // Calculate trend direction
          item.overallTrend = this.calculateTrendDirection(stockLevels);

          // Calculate volatility (coefficient of variation)
          item.volatility = this.calculateVolatility(consumptionRates);

          // Detect seasonality
          item.seasonality = this.detectSeasonality(consumptionRates);
        }
      });

      return Object.values(trendData);
    } catch (error) {
      throw new Error(`Failed to get trend analysis: ${error.message}`);
    }
  }

  /**
   * Detect anomalies in consumption patterns
   */
  static async detectAnomalies(hotelId, options = {}) {
    try {
      const {
        threshold = 2, // Standard deviations
        lookbackDays = 30,
        itemIds = []
      } = options;

      const anomalies = await InventoryHistory.detectAnomalies(hotelId, threshold);

      // Filter by itemIds if provided
      if (itemIds.length > 0) {
        return anomalies.filter(anomaly =>
          itemIds.includes(anomaly._id.toString())
        );
      }

      return anomalies.map(anomaly => ({
        itemId: anomaly._id,
        name: anomaly.name,
        category: anomaly.category,
        currentConsumption: anomaly.values[anomaly.values.length - 1],
        averageConsumption: parseFloat(anomaly.avg.toFixed(2)),
        standardDeviation: parseFloat(anomaly.stdDev.toFixed(2)),
        zScore: parseFloat((Math.abs(anomaly.values[anomaly.values.length - 1] - anomaly.avg) / anomaly.stdDev).toFixed(2)),
        anomalyType: anomaly.values[anomaly.values.length - 1] > anomaly.avg ? 'spike' : 'drop',
        severity: this.classifyAnomalySeverity(Math.abs(anomaly.values[anomaly.values.length - 1] - anomaly.avg) / anomaly.stdDev),
        dataPoints: anomaly.count
      }));
    } catch (error) {
      throw new Error(`Failed to detect anomalies: ${error.message}`);
    }
  }

  /**
   * Generate seasonal consumption patterns
   */
  static async getSeasonalPatterns(hotelId, itemId = null) {
    try {
      if (itemId) {
        const patterns = await InventoryHistory.getSeasonalPatterns(hotelId, itemId);
        return this.formatSeasonalData(patterns);
      }

      // Get patterns for all items
      const items = await InventoryItem.find({ hotelId, isActive: true }).select('_id name category');
      const allPatterns = {};

      for (const item of items) {
        const patterns = await InventoryHistory.getSeasonalPatterns(hotelId, item._id);
        if (patterns.length > 0) {
          allPatterns[item._id] = {
            itemId: item._id,
            name: item.name,
            category: item.category,
            patterns: this.formatSeasonalData(patterns)
          };
        }
      }

      return allPatterns;
    } catch (error) {
      throw new Error(`Failed to get seasonal patterns: ${error.message}`);
    }
  }

  /**
   * Generate predictive demand forecasting
   */
  static async generateDemandForecast(hotelId, options = {}) {
    try {
      const {
        forecastDays = 30,
        itemIds = [],
        includeSeasonality = true,
        confidenceLevel = 0.95
      } = options;

      const insights = await InventoryHistory.generatePredictiveInsights(hotelId, forecastDays);

      // Filter by itemIds if provided
      let filteredInsights = insights;
      if (itemIds.length > 0) {
        filteredInsights = insights.filter(insight =>
          itemIds.includes(insight.itemId.toString())
        );
      }

      // Enhanced forecasting with seasonality and confidence intervals
      const forecasts = await Promise.all(filteredInsights.map(async (insight) => {
        const historicalData = await InventoryHistory.getTrendData(hotelId, insight.itemId, 90);

        let seasonalMultiplier = 1;
        if (includeSeasonality && historicalData.length > 0) {
          seasonalMultiplier = await this.calculateSeasonalMultiplier(hotelId, insight.itemId);
        }

        const adjustedConsumption = insight.avgDailyConsumption * seasonalMultiplier;
        const adjustedProjectedConsumption = adjustedConsumption * forecastDays;
        const adjustedProjectedStock = Math.max(0, insight.currentStock - adjustedProjectedConsumption);

        // Calculate confidence intervals
        const variance = await this.calculateConsumptionVariance(hotelId, insight.itemId);
        const standardError = Math.sqrt(variance / forecastDays);
        const tValue = this.getTValue(confidenceLevel, Math.min(30, historicalData.length - 1));

        const marginOfError = tValue * standardError * forecastDays;
        const lowerBound = Math.max(0, adjustedProjectedStock - marginOfError);
        const upperBound = adjustedProjectedStock + marginOfError;

        return {
          ...insight,
          seasonalMultiplier: parseFloat(seasonalMultiplier.toFixed(2)),
          adjustedAvgDailyConsumption: parseFloat(adjustedConsumption.toFixed(2)),
          adjustedProjectedConsumption: parseFloat(adjustedProjectedConsumption.toFixed(2)),
          adjustedProjectedStock: Math.round(adjustedProjectedStock),
          confidence: {
            level: confidenceLevel,
            lowerBound: Math.round(lowerBound),
            upperBound: Math.round(upperBound),
            marginOfError: parseFloat(marginOfError.toFixed(2))
          },
          forecastAccuracy: await this.calculateForecastAccuracy(hotelId, insight.itemId),
          recommendedAction: this.getEnhancedRecommendation(insight, adjustedProjectedStock, lowerBound)
        };
      }));

      return forecasts.sort((a, b) => {
        const riskOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return riskOrder[b.riskLevel] - riskOrder[a.riskLevel];
      });
    } catch (error) {
      throw new Error(`Failed to generate demand forecast: ${error.message}`);
    }
  }

  /**
   * Get comprehensive inventory analytics dashboard data
   */
  static async getDashboardAnalytics(hotelId, options = {}) {
    try {
      const {
        period = 30, // days
        includeForecasting = true,
        includeAnomalies = true
      } = options;

      const startDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000);

      // Get recent snapshots for overview
      const recentSnapshots = await InventoryHistory.find({
        hotelId,
        snapshotDate: { $gte: startDate }
      }).sort({ snapshotDate: -1 }).limit(10);

      // Calculate key metrics
      const keyMetrics = this.calculateKeyMetrics(recentSnapshots);

      // Get trend analysis for major categories
      const trendAnalysis = await this.getTrendAnalysis(hotelId, {
        startDate,
        granularity: 'weekly'
      });

      // Get top items by various criteria
      const topItemsAnalysis = await this.getTopItemsAnalysis(hotelId, period);

      let anomalies = [];
      if (includeAnomalies) {
        anomalies = await this.detectAnomalies(hotelId, { lookbackDays: period });
      }

      let forecasting = [];
      if (includeForecasting) {
        forecasting = await this.generateDemandForecast(hotelId, { forecastDays: 14 });
      }

      return {
        period: {
          days: period,
          startDate,
          endDate: new Date()
        },
        keyMetrics,
        trends: {
          categories: this.aggregateTrendsByCategory(trendAnalysis),
          items: trendAnalysis.slice(0, 10) // Top 10 items
        },
        topItems: topItemsAnalysis,
        anomalies: anomalies.slice(0, 10), // Top 10 anomalies
        forecasting: forecasting.slice(0, 10), // Top 10 forecast items
        recommendations: this.generateAnalyticsRecommendations(keyMetrics, anomalies, forecasting)
      };
    } catch (error) {
      throw new Error(`Failed to get dashboard analytics: ${error.message}`);
    }
  }

  /**
   * Schedule automatic snapshot creation
   */
  static async scheduleSnapshot(hotelId, frequency = 'daily') {
    try {
      // This would typically integrate with a job scheduler like Bull
      const snapshot = await this.createSnapshot(hotelId, frequency);

      // Check for any triggers
      const triggers = await this.checkSnapshotTriggers(hotelId, snapshot);

      if (triggers.length > 0) {
        snapshot.triggers = triggers;
        await snapshot.save();
      }

      return snapshot;
    } catch (error) {
      throw new Error(`Failed to schedule snapshot: ${error.message}`);
    }
  }

  // Helper methods

  static calculateTrendDirection(values) {
    if (values.length < 3) return 'stable';

    const first = values.slice(0, Math.ceil(values.length / 3));
    const last = values.slice(-Math.ceil(values.length / 3));

    const firstAvg = first.reduce((a, b) => a + b, 0) / first.length;
    const lastAvg = last.reduce((a, b) => a + b, 0) / last.length;

    const change = (lastAvg - firstAvg) / firstAvg;

    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';

    // Check for volatility
    const variance = values.reduce((sum, val) => sum + Math.pow(val - (values.reduce((a, b) => a + b, 0) / values.length), 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const coefficientOfVariation = stdDev / mean;

    return coefficientOfVariation > 0.3 ? 'volatile' : 'stable';
  }

  static calculateVolatility(values) {
    if (values.length < 2) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return mean > 0 ? parseFloat((stdDev / mean).toFixed(3)) : 0;
  }

  static detectSeasonality(values) {
    if (values.length < 12) return null; // Need at least 12 data points

    // Simple seasonality detection - look for recurring patterns
    const peaks = [];
    const valleys = [];

    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > values[i-1] && values[i] > values[i+1]) {
        peaks.push(i);
      }
      if (values[i] < values[i-1] && values[i] < values[i+1]) {
        valleys.push(i);
      }
    }

    if (peaks.length >= 2) {
      const intervals = [];
      for (let i = 1; i < peaks.length; i++) {
        intervals.push(peaks[i] - peaks[i-1]);
      }

      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      return Math.round(avgInterval);
    }

    return null;
  }

  static classifyAnomalySeverity(zScore) {
    if (zScore >= 3) return 'critical';
    if (zScore >= 2.5) return 'high';
    if (zScore >= 2) return 'medium';
    return 'low';
  }

  static formatSeasonalData(patterns) {
    return patterns.map(pattern => ({
      month: pattern._id.month,
      quarter: pattern._id.quarter,
      avgConsumption: parseFloat(pattern.avgConsumption.toFixed(2)),
      avgStock: parseFloat(pattern.avgStock.toFixed(2)),
      dataPoints: pattern.count,
      seasonalIndex: parseFloat((pattern.avgConsumption / (patterns.reduce((sum, p) => sum + p.avgConsumption, 0) / patterns.length)).toFixed(2))
    }));
  }

  static async calculateSeasonalMultiplier(hotelId, itemId) {
    const currentMonth = new Date().getMonth() + 1;
    const patterns = await InventoryHistory.getSeasonalPatterns(hotelId, itemId);

    if (patterns.length === 0) return 1;

    const currentMonthPattern = patterns.find(p => p._id.month === currentMonth);
    if (!currentMonthPattern) return 1;

    const averageConsumption = patterns.reduce((sum, p) => sum + p.avgConsumption, 0) / patterns.length;
    return currentMonthPattern.avgConsumption / averageConsumption;
  }

  static async calculateConsumptionVariance(hotelId, itemId) {
    const historicalData = await InventoryHistory.getTrendData(hotelId, itemId, 60);

    if (historicalData.length < 2) return 1;

    const consumptionRates = historicalData.map(h =>
      h.items.find(i => i.itemId.toString() === itemId.toString())?.consumptionRate || 0
    );

    const mean = consumptionRates.reduce((a, b) => a + b, 0) / consumptionRates.length;
    const variance = consumptionRates.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / consumptionRates.length;

    return variance;
  }

  static getTValue(confidenceLevel, degreesOfFreedom) {
    // Simplified t-value lookup for common confidence levels
    const tTable = {
      0.90: { 5: 2.015, 10: 1.812, 15: 1.753, 20: 1.725, 30: 1.697 },
      0.95: { 5: 2.571, 10: 2.228, 15: 2.131, 20: 2.086, 30: 2.042 },
      0.99: { 5: 4.032, 10: 3.169, 15: 2.947, 20: 2.845, 30: 2.750 }
    };

    const df = Math.min(30, Math.max(5, degreesOfFreedom));
    const dfKeys = [5, 10, 15, 20, 30];
    const closestDf = dfKeys.reduce((prev, curr) =>
      Math.abs(curr - df) < Math.abs(prev - df) ? curr : prev
    );

    return tTable[confidenceLevel]?.[closestDf] || 2.042; // Default to 95% confidence, 30 df
  }

  static async calculateForecastAccuracy(hotelId, itemId) {
    // This would compare previous forecasts with actual consumption
    // For now, return a simulated accuracy based on data quality
    const historicalData = await InventoryHistory.getTrendData(hotelId, itemId, 30);

    if (historicalData.length < 7) return 60; // Low accuracy with limited data
    if (historicalData.length < 14) return 75; // Medium accuracy
    return 85; // Good accuracy with sufficient data
  }

  static getEnhancedRecommendation(insight, adjustedStock, lowerBound) {
    if (lowerBound <= 0) {
      return `CRITICAL: Order immediately! 95% chance of stockout within forecast period. Consider emergency supplier.`;
    }
    if (adjustedStock <= insight.stockThreshold) {
      return `HIGH PRIORITY: Schedule order within 2-3 days. Consider seasonal demand patterns.`;
    }
    if (adjustedStock <= insight.stockThreshold * 2) {
      return `MEDIUM: Plan order within 1 week. Monitor consumption trends closely.`;
    }
    return `LOW: Stock levels adequate. Continue monitoring consumption patterns.`;
  }

  static calculateKeyMetrics(snapshots) {
    if (snapshots.length === 0) return {};

    const latest = snapshots[0];
    const previous = snapshots[1];

    const metrics = {
      totalItems: latest.aggregatedMetrics?.totalItems || 0,
      totalValue: latest.aggregatedMetrics?.totalValue || 0,
      lowStockItems: latest.aggregatedMetrics?.lowStockItems || 0,
      outOfStockItems: latest.aggregatedMetrics?.outOfStockItems || 0,
      averageConsumptionRate: latest.aggregatedMetrics?.averageConsumptionRate || 0
    };

    if (previous) {
      metrics.changes = {
        totalValue: ((latest.aggregatedMetrics?.totalValue || 0) - (previous.aggregatedMetrics?.totalValue || 0)),
        lowStockItems: ((latest.aggregatedMetrics?.lowStockItems || 0) - (previous.aggregatedMetrics?.lowStockItems || 0)),
        averageConsumption: ((latest.aggregatedMetrics?.averageConsumptionRate || 0) - (previous.aggregatedMetrics?.averageConsumptionRate || 0))
      };
    }

    return metrics;
  }

  static aggregateTrendsByCategory(trendAnalysis) {
    const categoryMap = new Map();

    trendAnalysis.forEach(item => {
      if (!categoryMap.has(item.category)) {
        categoryMap.set(item.category, {
          category: item.category,
          items: [],
          avgVolatility: 0,
          trendDistribution: { increasing: 0, decreasing: 0, stable: 0, volatile: 0 }
        });
      }

      const category = categoryMap.get(item.category);
      category.items.push(item);
      category.trendDistribution[item.overallTrend]++;
    });

    return Array.from(categoryMap.values()).map(category => ({
      ...category,
      itemCount: category.items.length,
      avgVolatility: parseFloat((category.items.reduce((sum, item) => sum + item.volatility, 0) / category.items.length).toFixed(3)),
      items: undefined // Remove items array to reduce payload size
    }));
  }

  static async getTopItemsAnalysis(hotelId, period) {
    const startDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000);

    const pipeline = [
      {
        $match: {
          hotelId: new mongoose.Types.ObjectId(hotelId),
          snapshotDate: { $gte: startDate }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.itemId',
          name: { $first: '$items.name' },
          category: { $first: '$items.category' },
          avgConsumption: { $avg: '$items.consumptionRate' },
          avgValue: { $avg: '$items.totalValue' },
          avgStock: { $avg: '$items.stockLevel' },
          volatility: { $stdDevPop: '$items.consumptionRate' }
        }
      }
    ];

    const results = await InventoryHistory.aggregate(pipeline);

    return {
      topByConsumption: results
        .sort((a, b) => b.avgConsumption - a.avgConsumption)
        .slice(0, 10),
      topByValue: results
        .sort((a, b) => b.avgValue - a.avgValue)
        .slice(0, 10),
      mostVolatile: results
        .sort((a, b) => b.volatility - a.volatility)
        .slice(0, 10)
    };
  }

  static generateAnalyticsRecommendations(metrics, anomalies, forecasting) {
    const recommendations = [];

    // Stock level recommendations
    if (metrics.lowStockItems > 0) {
      recommendations.push({
        type: 'stock_management',
        priority: 'high',
        description: `${metrics.lowStockItems} items are below stock threshold`,
        action: 'Review reorder points and schedule replenishment'
      });
    }

    // Anomaly recommendations
    if (anomalies.length > 0) {
      const criticalAnomalies = anomalies.filter(a => a.severity === 'critical').length;
      if (criticalAnomalies > 0) {
        recommendations.push({
          type: 'anomaly_investigation',
          priority: 'critical',
          description: `${criticalAnomalies} critical consumption anomalies detected`,
          action: 'Investigate unusual consumption patterns immediately'
        });
      }
    }

    // Forecasting recommendations
    if (forecasting.length > 0) {
      const criticalForecasts = forecasting.filter(f => f.riskLevel === 'critical').length;
      if (criticalForecasts > 0) {
        recommendations.push({
          type: 'demand_forecasting',
          priority: 'high',
          description: `${criticalForecasts} items predicted to stock out soon`,
          action: 'Execute emergency procurement procedures'
        });
      }
    }

    return recommendations;
  }

  static async checkSnapshotTriggers(hotelId, snapshot) {
    const triggers = [];

    // Check for low stock triggers
    if (snapshot.aggregatedMetrics?.lowStockItems > 0) {
      triggers.push({
        type: 'low_stock',
        threshold: 'stock_threshold',
        actualValue: snapshot.aggregatedMetrics.lowStockItems,
        triggeredAt: new Date()
      });
    }

    // Check for consumption spikes
    const previousSnapshot = await InventoryHistory.findOne({
      hotelId,
      snapshotDate: { $lt: snapshot.snapshotDate }
    }).sort({ snapshotDate: -1 });

    if (previousSnapshot) {
      const currentAvgConsumption = snapshot.aggregatedMetrics?.averageConsumptionRate || 0;
      const previousAvgConsumption = previousSnapshot.aggregatedMetrics?.averageConsumptionRate || 0;

      if (currentAvgConsumption > previousAvgConsumption * 1.5) {
        triggers.push({
          type: 'consumption_spike',
          threshold: previousAvgConsumption * 1.5,
          actualValue: currentAvgConsumption,
          triggeredAt: new Date()
        });
      }
    }

    return triggers;
  }
}

export default InventoryHistoricalService;