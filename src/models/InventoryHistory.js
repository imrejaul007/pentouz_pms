import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     InventoryHistory:
 *       type: object
 *       required:
 *         - hotelId
 *         - snapshotDate
 *         - items
 *       properties:
 *         _id:
 *           type: string
 *         hotelId:
 *           type: string
 *           description: Hotel ID
 *         snapshotDate:
 *           type: string
 *           format: date-time
 *           description: Date and time of the snapshot
 *         snapshotType:
 *           type: string
 *           enum: [daily, weekly, monthly, manual, trigger]
 *           description: Type of snapshot taken
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               itemId:
 *                 type: string
 *               name:
 *                 type: string
 *               category:
 *                 type: string
 *               stockLevel:
 *                 type: number
 *               unitPrice:
 *                 type: number
 *               totalValue:
 *                 type: number
 *               consumptionRate:
 *                 type: number
 *               daysOfStock:
 *                 type: number
 *         metadata:
 *           type: object
 *           description: Additional metadata about the snapshot
 */

const inventoryHistorySchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required'],
    index: true
  },
  snapshotDate: {
    type: Date,
    required: [true, 'Snapshot date is required'],
    index: true
  },
  snapshotType: {
    type: String,
    enum: {
      values: ['daily', 'weekly', 'monthly', 'manual', 'trigger'],
      message: 'Invalid snapshot type'
    },
    default: 'daily',
    index: true
  },
  period: {
    year: {
      type: Number,
      required: true,
      index: true
    },
    month: {
      type: Number,
      min: 1,
      max: 12,
      index: true
    },
    week: {
      type: Number,
      min: 1,
      max: 53,
      index: true
    },
    day: {
      type: Number,
      min: 1,
      max: 31
    },
    quarter: {
      type: Number,
      min: 1,
      max: 4,
      index: true
    }
  },
  items: [{
    itemId: {
      type: mongoose.Schema.ObjectId,
      ref: 'InventoryItem',
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      enum: ['bedding', 'toiletries', 'minibar', 'electronics', 'amenities', 'cleaning', 'furniture'],
      required: true
    },
    stockLevel: {
      type: Number,
      required: true,
      min: 0
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    totalValue: {
      type: Number,
      required: true,
      min: 0
    },
    stockThreshold: {
      type: Number,
      min: 0
    },
    consumptionRate: {
      type: Number,
      min: 0,
      description: 'Items consumed per day on average'
    },
    daysOfStock: {
      type: Number,
      min: 0,
      description: 'Estimated days until stockout'
    },
    turnoverRate: {
      type: Number,
      min: 0,
      description: 'Inventory turnover rate'
    },
    supplierInfo: {
      name: String,
      leadTime: Number,
      reliability: Number // 0-100 score
    },
    seasonalityIndex: {
      type: Number,
      min: 0,
      description: 'Seasonal consumption multiplier'
    },
    trendDirection: {
      type: String,
      enum: ['increasing', 'decreasing', 'stable', 'volatile'],
      description: 'Consumption trend direction'
    },
    anomalyScore: {
      type: Number,
      min: 0,
      max: 100,
      description: 'Anomaly detection score'
    }
  }],
  aggregatedMetrics: {
    totalItems: {
      type: Number,
      min: 0
    },
    totalValue: {
      type: Number,
      min: 0
    },
    averageConsumptionRate: {
      type: Number,
      min: 0
    },
    lowStockItems: {
      type: Number,
      min: 0
    },
    outOfStockItems: {
      type: Number,
      min: 0
    },
    categoryBreakdown: [{
      category: String,
      itemCount: Number,
      totalValue: Number,
      averageConsumption: Number
    }],
    riskMetrics: {
      stockoutRisk: {
        type: Number,
        min: 0,
        max: 100
      },
      overStockRisk: {
        type: Number,
        min: 0,
        max: 100
      },
      priceVolatilityRisk: {
        type: Number,
        min: 0,
        max: 100
      }
    }
  },
  triggers: [{
    type: {
      type: String,
      enum: ['low_stock', 'price_change', 'consumption_spike', 'seasonal_peak']
    },
    itemId: {
      type: mongoose.Schema.ObjectId,
      ref: 'InventoryItem'
    },
    threshold: Number,
    actualValue: Number,
    triggeredAt: {
      type: Date,
      default: Date.now
    }
  }],
  metadata: {
    dataSource: {
      type: String,
      enum: ['automated', 'manual', 'import'],
      default: 'automated'
    },
    processingTime: {
      type: Number,
      description: 'Time taken to generate snapshot in milliseconds'
    },
    recordCount: {
      type: Number,
      description: 'Number of records processed'
    },
    qualityScore: {
      type: Number,
      min: 0,
      max: 100,
      description: 'Data quality score'
    },
    anomaliesDetected: {
      type: Number,
      min: 0
    },
    trends: [{
      category: String,
      trend: String,
      confidence: Number
    }],
    recommendations: [{
      type: String,
      description: String,
      priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical']
      },
      estimatedSavings: Number
    }]
  },
  complianceStatus: {
    lastAuditDate: Date,
    complianceScore: {
      type: Number,
      min: 0,
      max: 100
    },
    violations: [{
      type: String,
      severity: {
        type: String,
        enum: ['minor', 'major', 'critical']
      },
      description: String
    }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for efficient querying
inventoryHistorySchema.index({ hotelId: 1, snapshotDate: -1 });
inventoryHistorySchema.index({ hotelId: 1, snapshotType: 1, snapshotDate: -1 });
inventoryHistorySchema.index({ hotelId: 1, 'period.year': 1, 'period.month': 1 });
inventoryHistorySchema.index({ hotelId: 1, 'period.year': 1, 'period.quarter': 1 });
inventoryHistorySchema.index({ 'items.itemId': 1, snapshotDate: -1 });

// Pre-save middleware to calculate derived fields
inventoryHistorySchema.pre('save', function(next) {
  // Calculate period fields
  const date = this.snapshotDate;
  this.period = {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    week: getWeekNumber(date),
    quarter: Math.ceil((date.getMonth() + 1) / 3)
  };

  // Calculate aggregated metrics
  if (this.items && this.items.length > 0) {
    this.aggregatedMetrics = {
      totalItems: this.items.length,
      totalValue: this.items.reduce((sum, item) => sum + item.totalValue, 0),
      averageConsumptionRate: this.items.reduce((sum, item) => sum + (item.consumptionRate || 0), 0) / this.items.length,
      lowStockItems: this.items.filter(item => item.stockLevel <= item.stockThreshold).length,
      outOfStockItems: this.items.filter(item => item.stockLevel === 0).length
    };

    // Calculate category breakdown
    const categoryMap = new Map();
    this.items.forEach(item => {
      if (!categoryMap.has(item.category)) {
        categoryMap.set(item.category, {
          category: item.category,
          itemCount: 0,
          totalValue: 0,
          totalConsumption: 0
        });
      }
      const category = categoryMap.get(item.category);
      category.itemCount++;
      category.totalValue += item.totalValue;
      category.totalConsumption += item.consumptionRate || 0;
    });

    this.aggregatedMetrics.categoryBreakdown = Array.from(categoryMap.values()).map(cat => ({
      ...cat,
      averageConsumption: cat.totalConsumption / cat.itemCount
    }));
  }

  next();
});

// Helper function to get week number
function getWeekNumber(date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// Static method to create snapshot
inventoryHistorySchema.statics.createSnapshot = async function(hotelId, snapshotType = 'manual') {
  const InventoryItem = mongoose.model('InventoryItem');
  const InventoryTransaction = mongoose.model('InventoryTransaction');

  const startTime = Date.now();
  const snapshotDate = new Date();

  // Get all active inventory items
  const items = await InventoryItem.find({ hotelId, isActive: true });

  const historyItems = [];

  for (const item of items) {
    // Calculate consumption rate based on recent transactions
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentTransactions = await InventoryTransaction.find({
      hotelId,
      'items.itemId': item._id,
      processedAt: { $gte: thirtyDaysAgo },
      status: 'completed'
    });

    const totalConsumed = recentTransactions.reduce((sum, transaction) => {
      const itemTransaction = transaction.items.find(i => i.itemId.toString() === item._id.toString());
      return sum + Math.abs(itemTransaction?.quantityChanged || 0);
    }, 0);

    const consumptionRate = totalConsumed / 30; // Daily average
    const daysOfStock = consumptionRate > 0 ? item.currentStock / consumptionRate : 999;

    historyItems.push({
      itemId: item._id,
      name: item.name,
      category: item.category,
      stockLevel: item.currentStock,
      unitPrice: item.unitPrice,
      totalValue: item.currentStock * item.unitPrice,
      stockThreshold: item.stockThreshold,
      consumptionRate,
      daysOfStock: Math.round(daysOfStock),
      turnoverRate: item.currentStock > 0 ? totalConsumed / item.currentStock : 0,
      supplierInfo: {
        name: item.supplier?.name,
        leadTime: item.reorderSettings?.preferredSupplier?.leadTime,
        reliability: 85 // Default reliability score
      },
      seasonalityIndex: 1, // Default, would be calculated based on historical data
      trendDirection: 'stable', // Default, would be calculated based on historical data
      anomalyScore: 0 // Default, would be calculated based on statistical analysis
    });
  }

  const processingTime = Date.now() - startTime;

  return await this.create({
    hotelId,
    snapshotDate,
    snapshotType,
    items: historyItems,
    metadata: {
      dataSource: 'automated',
      processingTime,
      recordCount: items.length,
      qualityScore: 95, // Default quality score
      anomaliesDetected: 0
    }
  });
};

// Static method to get trend data
inventoryHistorySchema.statics.getTrendData = async function(hotelId, itemId, days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return await this.find({
    hotelId,
    'items.itemId': itemId,
    snapshotDate: { $gte: startDate }
  })
  .select('snapshotDate items.$')
  .sort({ snapshotDate: 1 });
};

// Static method to detect anomalies
inventoryHistorySchema.statics.detectAnomalies = async function(hotelId, threshold = 2) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const pipeline = [
    {
      $match: {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        snapshotDate: { $gte: thirtyDaysAgo }
      }
    },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.itemId',
        name: { $first: '$items.name' },
        category: { $first: '$items.category' },
        values: { $push: '$items.consumptionRate' },
        avg: { $avg: '$items.consumptionRate' },
        stdDev: { $stdDevPop: '$items.consumptionRate' },
        count: { $sum: 1 }
      }
    },
    {
      $match: {
        count: { $gte: 7 }, // At least 7 data points
        stdDev: { $gt: 0 }
      }
    }
  ];

  const results = await this.aggregate(pipeline);

  return results.filter(item => {
    const latest = item.values[item.values.length - 1];
    const zScore = Math.abs((latest - item.avg) / item.stdDev);
    return zScore > threshold;
  });
};

// Static method to get seasonal patterns
inventoryHistorySchema.statics.getSeasonalPatterns = async function(hotelId, itemId) {
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

  const pipeline = [
    {
      $match: {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        'items.itemId': new mongoose.Types.ObjectId(itemId),
        snapshotDate: { $gte: oneYearAgo }
      }
    },
    { $unwind: '$items' },
    {
      $match: {
        'items.itemId': new mongoose.Types.ObjectId(itemId)
      }
    },
    {
      $group: {
        _id: {
          month: '$period.month',
          quarter: '$period.quarter'
        },
        avgConsumption: { $avg: '$items.consumptionRate' },
        avgStock: { $avg: '$items.stockLevel' },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.month': 1 } }
  ];

  return await this.aggregate(pipeline);
};

// Static method to generate predictive insights
inventoryHistorySchema.statics.generatePredictiveInsights = async function(hotelId, daysAhead = 30) {
  const InventoryItem = mongoose.model('InventoryItem');

  // Get current stock levels
  const currentItems = await InventoryItem.find({ hotelId, isActive: true });

  const insights = [];

  for (const item of currentItems) {
    // Get historical consumption data
    const historicalData = await this.getTrendData(hotelId, item._id, 90);

    if (historicalData.length < 7) continue; // Need at least a week of data

    const consumptionRates = historicalData.map(h =>
      h.items.find(i => i.itemId.toString() === item._id.toString())?.consumptionRate || 0
    );

    const avgConsumption = consumptionRates.reduce((a, b) => a + b, 0) / consumptionRates.length;
    const projectedConsumption = avgConsumption * daysAhead;
    const projectedStock = Math.max(0, item.currentStock - projectedConsumption);

    let riskLevel = 'low';
    if (projectedStock === 0) riskLevel = 'critical';
    else if (projectedStock <= item.stockThreshold) riskLevel = 'high';
    else if (projectedStock <= item.stockThreshold * 2) riskLevel = 'medium';

    insights.push({
      itemId: item._id,
      name: item.name,
      category: item.category,
      currentStock: item.currentStock,
      projectedStock,
      projectedConsumption,
      avgDailyConsumption: avgConsumption,
      riskLevel,
      recommendedAction: getRiskAction(riskLevel, item),
      estimatedStockoutDate: avgConsumption > 0 ?
        new Date(Date.now() + (item.currentStock / avgConsumption) * 24 * 60 * 60 * 1000) : null
    });
  }

  return insights.sort((a, b) => {
    const riskOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    return riskOrder[b.riskLevel] - riskOrder[a.riskLevel];
  });
};

function getRiskAction(riskLevel, item) {
  switch (riskLevel) {
    case 'critical':
      return `URGENT: Order ${item.reorderSettings?.reorderQuantity || 50} units immediately`;
    case 'high':
      return `Schedule reorder of ${item.reorderSettings?.reorderQuantity || 30} units within 3 days`;
    case 'medium':
      return `Plan reorder of ${item.reorderSettings?.reorderQuantity || 20} units within 1 week`;
    default:
      return 'Monitor consumption trends';
  }
}

export default mongoose.model('InventoryHistory', inventoryHistorySchema);
