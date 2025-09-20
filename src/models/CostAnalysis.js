import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     CostAnalysis:
 *       type: object
 *       required:
 *         - hotelId
 *         - analysisDate
 *         - analysisType
 *       properties:
 *         _id:
 *           type: string
 *         hotelId:
 *           type: string
 *           description: Hotel ID
 *         analysisDate:
 *           type: string
 *           format: date-time
 *           description: Date and time of the analysis
 *         analysisType:
 *           type: string
 *           enum: [price_comparison, bulk_optimization, contract_analysis, roi_calculation, supplier_evaluation]
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               itemId:
 *                 type: string
 *               currentCost:
 *                 type: number
 *               optimizedCost:
 *                 type: number
 *               potentialSavings:
 *                 type: number
 *               recommendations:
 *                 type: array
 *                 items:
 *                   type: string
 */

const costAnalysisSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required'],
    index: true
  },
  analysisDate: {
    type: Date,
    required: [true, 'Analysis date is required'],
    default: Date.now,
    index: true
  },
  analysisType: {
    type: String,
    enum: {
      values: ['price_comparison', 'bulk_optimization', 'contract_analysis', 'roi_calculation', 'supplier_evaluation', 'demand_forecasting'],
      message: 'Invalid analysis type'
    },
    required: [true, 'Analysis type is required'],
    index: true
  },
  period: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    duration: {
      type: Number,
      description: 'Analysis period in days'
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
    currentSupplier: {
      name: String,
      unitPrice: {
        type: Number,
        min: 0
      },
      leadTime: Number,
      reliability: Number,
      contractTerms: String
    },
    alternativeSuppliers: [{
      name: {
        type: String,
        required: true
      },
      unitPrice: {
        type: Number,
        required: true,
        min: 0
      },
      leadTime: {
        type: Number,
        min: 0
      },
      reliability: {
        type: Number,
        min: 0,
        max: 100
      },
      qualityScore: {
        type: Number,
        min: 0,
        max: 100
      },
      minimumOrder: {
        type: Number,
        min: 0
      },
      contractTerms: String,
      paymentTerms: String,
      shippingCost: {
        type: Number,
        min: 0
      },
      bulkDiscounts: [{
        quantity: Number,
        discountPercent: Number
      }],
      certifications: [String],
      notes: String
    }],
    consumptionData: {
      monthlyAverage: {
        type: Number,
        min: 0
      },
      quarterlyAverage: {
        type: Number,
        min: 0
      },
      yearlyProjection: {
        type: Number,
        min: 0
      },
      seasonalityFactor: {
        type: Number,
        min: 0
      },
      volatility: {
        type: Number,
        min: 0
      },
      trendDirection: {
        type: String,
        enum: ['increasing', 'decreasing', 'stable', 'volatile']
      }
    },
    costAnalysis: {
      currentAnnualCost: {
        type: Number,
        min: 0
      },
      optimizedAnnualCost: {
        type: Number,
        min: 0
      },
      potentialSavings: {
        type: Number,
        min: 0
      },
      savingsPercentage: {
        type: Number,
        min: 0,
        max: 100
      },
      breakEvenQuantity: {
        type: Number,
        min: 0
      },
      riskScore: {
        type: Number,
        min: 0,
        max: 100
      }
    },
    bulkOptimization: {
      currentOrderQuantity: {
        type: Number,
        min: 0
      },
      optimalOrderQuantity: {
        type: Number,
        min: 0
      },
      orderFrequency: {
        current: Number,
        optimal: Number
      },
      storageRequirement: {
        current: Number,
        optimal: Number
      },
      storageCost: {
        type: Number,
        min: 0
      },
      carryingCost: {
        type: Number,
        min: 0
      },
      orderingCost: {
        type: Number,
        min: 0
      },
      eoqSavings: {
        type: Number,
        min: 0
      }
    },
    qualityMetrics: {
      defectRate: {
        type: Number,
        min: 0,
        max: 100
      },
      returnRate: {
        type: Number,
        min: 0,
        max: 100
      },
      customerSatisfaction: {
        type: Number,
        min: 0,
        max: 100
      },
      durabilityScore: {
        type: Number,
        min: 0,
        max: 100
      }
    },
    recommendations: [{
      type: {
        type: String,
        enum: ['supplier_change', 'bulk_purchase', 'contract_renegotiation', 'alternative_product', 'timing_optimization', 'quality_upgrade']
      },
      description: {
        type: String,
        required: true
      },
      estimatedSavings: {
        type: Number,
        min: 0
      },
      implementationCost: {
        type: Number,
        min: 0
      },
      timeToImplement: {
        type: Number,
        description: 'Days to implement'
      },
      priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
      },
      confidence: {
        type: Number,
        min: 0,
        max: 100,
        description: 'Confidence in recommendation success'
      },
      riskLevel: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
      }
    }]
  }],
  aggregatedResults: {
    totalCurrentCost: {
      type: Number,
      min: 0
    },
    totalOptimizedCost: {
      type: Number,
      min: 0
    },
    totalPotentialSavings: {
      type: Number,
      min: 0
    },
    averageSavingsPercentage: {
      type: Number,
      min: 0,
      max: 100
    },
    categoryBreakdown: [{
      category: String,
      currentCost: Number,
      optimizedCost: Number,
      savings: Number,
      savingsPercentage: Number,
      itemCount: Number
    }],
    topSavingsOpportunities: [{
      itemId: {
        type: mongoose.Schema.ObjectId,
        ref: 'InventoryItem'
      },
      name: String,
      potentialSavings: Number,
      savingsPercentage: Number
    }],
    riskAnalysis: {
      lowRiskSavings: Number,
      mediumRiskSavings: Number,
      highRiskSavings: Number,
      overallRiskScore: {
        type: Number,
        min: 0,
        max: 100
      }
    }
  },
  supplierAnalysis: {
    currentSuppliers: [{
      name: String,
      itemCount: Number,
      totalSpend: Number,
      averagePrice: Number,
      reliability: Number,
      qualityScore: Number,
      performanceMetrics: {
        onTimeDelivery: Number,
        qualityIssues: Number,
        priceStability: Number
      }
    }],
    recommendedChanges: [{
      action: String,
      currentSupplier: String,
      recommendedSupplier: String,
      itemsAffected: Number,
      estimatedSavings: Number,
      riskLevel: String
    }],
    supplierConcentrationRisk: {
      type: Number,
      min: 0,
      max: 100
    },
    diversificationRecommendations: [String]
  },
  contractAnalysis: {
    existingContracts: [{
      supplier: String,
      contractValue: Number,
      expiryDate: Date,
      renewalTerms: String,
      performanceMetrics: {
        complianceScore: Number,
        costEffectiveness: Number
      },
      renegotiationOpportunities: [String]
    }],
    renewalRecommendations: [{
      supplier: String,
      action: {
        type: String,
        enum: ['renew', 'renegotiate', 'replace', 'extend']
      },
      rationale: String,
      estimatedImpact: Number
    }]
  },
  roiCalculations: {
    investmentOpportunities: [{
      description: String,
      initialInvestment: Number,
      annualSavings: Number,
      paybackPeriod: Number,
      roi: Number,
      npv: Number,
      irr: Number,
      riskAdjustedRoi: Number
    }],
    automationOpportunities: [{
      process: String,
      currentCost: Number,
      automationCost: Number,
      annualSavings: Number,
      efficiency: Number
    }]
  },
  marketAnalysis: {
    priceVolatility: [{
      category: String,
      volatilityIndex: Number,
      trend: String,
      priceRange: {
        min: Number,
        max: Number,
        average: Number
      }
    }],
    marketConditions: {
      demand: String,
      supply: String,
      priceDirection: String,
      factors: [String]
    },
    timingRecommendations: [{
      action: String,
      timeframe: String,
      rationale: String,
      confidence: Number
    }]
  },
  metadata: {
    dataQuality: {
      completeness: {
        type: Number,
        min: 0,
        max: 100
      },
      accuracy: {
        type: Number,
        min: 0,
        max: 100
      },
      freshness: {
        type: Number,
        min: 0,
        max: 100
      }
    },
    analysisMethod: {
      type: String,
      enum: ['automated', 'manual', 'hybrid']
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    nextReviewDate: {
      type: Date
    },
    reviewFrequency: {
      type: String,
      enum: ['weekly', 'monthly', 'quarterly', 'annually']
    }
  },
  actionPlan: {
    immediateActions: [{
      description: String,
      responsible: String,
      deadline: Date,
      estimatedSavings: Number,
      status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'cancelled'],
        default: 'pending'
      }
    }],
    mediumTermActions: [{
      description: String,
      responsible: String,
      deadline: Date,
      estimatedSavings: Number,
      prerequisites: [String],
      status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'cancelled'],
        default: 'pending'
      }
    }],
    longTermStrategies: [{
      description: String,
      timeline: String,
      estimatedSavings: Number,
      requiredInvestment: Number,
      strategicValue: String
    }]
  },
  approvalStatus: {
    status: {
      type: String,
      enum: ['draft', 'pending_review', 'approved', 'implemented'],
      default: 'draft'
    },
    reviewedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    approvedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    reviewDate: Date,
    approvalDate: Date,
    comments: [String]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
costAnalysisSchema.index({ hotelId: 1, analysisDate: -1 });
costAnalysisSchema.index({ hotelId: 1, analysisType: 1, analysisDate: -1 });
costAnalysisSchema.index({ 'items.itemId': 1, analysisDate: -1 });
costAnalysisSchema.index({ hotelId: 1, 'approvalStatus.status': 1 });

// Pre-save middleware to calculate derived fields
costAnalysisSchema.pre('save', function(next) {
  // Calculate period duration
  if (this.period.startDate && this.period.endDate) {
    this.period.duration = Math.ceil((this.period.endDate - this.period.startDate) / (1000 * 60 * 60 * 24));
  }

  // Calculate aggregated results
  if (this.items && this.items.length > 0) {
    this.aggregatedResults = this.aggregatedResults || {};

    // Calculate totals
    this.aggregatedResults.totalCurrentCost = this.items.reduce((sum, item) =>
      sum + (item.costAnalysis?.currentAnnualCost || 0), 0);

    this.aggregatedResults.totalOptimizedCost = this.items.reduce((sum, item) =>
      sum + (item.costAnalysis?.optimizedAnnualCost || 0), 0);

    this.aggregatedResults.totalPotentialSavings = this.aggregatedResults.totalCurrentCost - this.aggregatedResults.totalOptimizedCost;

    this.aggregatedResults.averageSavingsPercentage = this.aggregatedResults.totalCurrentCost > 0 ?
      (this.aggregatedResults.totalPotentialSavings / this.aggregatedResults.totalCurrentCost) * 100 : 0;

    // Calculate category breakdown
    const categoryMap = new Map();
    this.items.forEach(item => {
      if (!categoryMap.has(item.category)) {
        categoryMap.set(item.category, {
          category: item.category,
          currentCost: 0,
          optimizedCost: 0,
          itemCount: 0
        });
      }
      const category = categoryMap.get(item.category);
      category.currentCost += item.costAnalysis?.currentAnnualCost || 0;
      category.optimizedCost += item.costAnalysis?.optimizedAnnualCost || 0;
      category.itemCount++;
    });

    this.aggregatedResults.categoryBreakdown = Array.from(categoryMap.values()).map(cat => ({
      ...cat,
      savings: cat.currentCost - cat.optimizedCost,
      savingsPercentage: cat.currentCost > 0 ? ((cat.currentCost - cat.optimizedCost) / cat.currentCost) * 100 : 0
    }));

    // Find top savings opportunities
    this.aggregatedResults.topSavingsOpportunities = this.items
      .filter(item => item.costAnalysis?.potentialSavings > 0)
      .sort((a, b) => (b.costAnalysis?.potentialSavings || 0) - (a.costAnalysis?.potentialSavings || 0))
      .slice(0, 10)
      .map(item => ({
        itemId: item.itemId,
        name: item.name,
        potentialSavings: item.costAnalysis?.potentialSavings || 0,
        savingsPercentage: item.costAnalysis?.savingsPercentage || 0
      }));
  }

  // Set next review date if not set
  if (!this.metadata.nextReviewDate) {
    const reviewInterval = {
      weekly: 7,
      monthly: 30,
      quarterly: 90,
      annually: 365
    };
    const days = reviewInterval[this.metadata.reviewFrequency] || 30;
    this.metadata.nextReviewDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  next();
});

// Static method to perform price comparison analysis
costAnalysisSchema.statics.performPriceComparison = async function(hotelId, itemIds = []) {
  const InventoryItem = mongoose.model('InventoryItem');
  const InventoryTransaction = mongoose.model('InventoryTransaction');

  const query = { hotelId, isActive: true };
  if (itemIds.length > 0) {
    query._id = { $in: itemIds };
  }

  const items = await InventoryItem.find(query);
  const analysisItems = [];

  for (const item of items) {
    // Get consumption data from transactions
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    const transactions = await InventoryTransaction.find({
      hotelId,
      'items.itemId': item._id,
      processedAt: { $gte: sixMonthsAgo },
      status: 'completed'
    });

    const totalConsumed = transactions.reduce((sum, transaction) => {
      const itemTransaction = transaction.items.find(i => i.itemId.toString() === item._id.toString());
      return sum + Math.abs(itemTransaction?.quantityChanged || 0);
    }, 0);

    const monthlyAverage = totalConsumed / 6;
    const yearlyProjection = monthlyAverage * 12;

    // Generate mock alternative suppliers for demonstration
    const alternativeSuppliers = generateMockSuppliers(item);

    const currentAnnualCost = item.unitPrice * yearlyProjection;
    const bestAlternative = alternativeSuppliers.reduce((best, supplier) =>
      supplier.unitPrice < best.unitPrice ? supplier : best
    );
    const optimizedAnnualCost = bestAlternative.unitPrice * yearlyProjection;

    analysisItems.push({
      itemId: item._id,
      name: item.name,
      category: item.category,
      currentSupplier: {
        name: item.supplier?.name || 'Current Supplier',
        unitPrice: item.unitPrice,
        leadTime: item.reorderSettings?.preferredSupplier?.leadTime || 7,
        reliability: 85
      },
      alternativeSuppliers,
      consumptionData: {
        monthlyAverage,
        quarterlyAverage: monthlyAverage * 3,
        yearlyProjection,
        seasonalityFactor: 1.0,
        volatility: 0.1,
        trendDirection: 'stable'
      },
      costAnalysis: {
        currentAnnualCost,
        optimizedAnnualCost,
        potentialSavings: currentAnnualCost - optimizedAnnualCost,
        savingsPercentage: currentAnnualCost > 0 ? ((currentAnnualCost - optimizedAnnualCost) / currentAnnualCost) * 100 : 0,
        riskScore: calculateRiskScore(item, bestAlternative)
      },
      recommendations: generateRecommendations(item, bestAlternative, currentAnnualCost - optimizedAnnualCost)
    });
  }

  return await this.create({
    hotelId,
    analysisType: 'price_comparison',
    period: {
      startDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
      endDate: new Date()
    },
    items: analysisItems,
    metadata: {
      analysisMethod: 'automated',
      confidence: 85,
      reviewFrequency: 'monthly'
    }
  });
};

// Static method to perform bulk optimization analysis
costAnalysisSchema.statics.performBulkOptimization = async function(hotelId, itemIds = []) {
  const InventoryItem = mongoose.model('InventoryItem');

  const query = { hotelId, isActive: true };
  if (itemIds.length > 0) {
    query._id = { $in: itemIds };
  }

  const items = await InventoryItem.find(query);
  const analysisItems = [];

  for (const item of items) {
    // Calculate Economic Order Quantity (EOQ)
    const annualDemand = item.currentStock * 12; // Simplified assumption
    const orderingCost = 50; // Default ordering cost
    const carryingCostRate = 0.2; // 20% carrying cost
    const carryingCost = item.unitPrice * carryingCostRate;

    const eoq = Math.sqrt((2 * annualDemand * orderingCost) / carryingCost);
    const optimalOrderQuantity = Math.max(eoq, item.reorderSettings?.reorderQuantity || 1);

    const currentOrderQuantity = item.reorderSettings?.reorderQuantity || item.stockThreshold * 2;
    const currentOrderFrequency = annualDemand / currentOrderQuantity;
    const optimalOrderFrequency = annualDemand / optimalOrderQuantity;

    const currentTotalCost = (annualDemand / currentOrderQuantity) * orderingCost +
                           (currentOrderQuantity / 2) * carryingCost;
    const optimalTotalCost = (annualDemand / optimalOrderQuantity) * orderingCost +
                           (optimalOrderQuantity / 2) * carryingCost;

    analysisItems.push({
      itemId: item._id,
      name: item.name,
      category: item.category,
      bulkOptimization: {
        currentOrderQuantity,
        optimalOrderQuantity: Math.round(optimalOrderQuantity),
        orderFrequency: {
          current: Math.round(currentOrderFrequency),
          optimal: Math.round(optimalOrderFrequency)
        },
        storageRequirement: {
          current: currentOrderQuantity,
          optimal: optimalOrderQuantity
        },
        storageCost: carryingCost,
        carryingCost: carryingCost,
        orderingCost: orderingCost,
        eoqSavings: currentTotalCost - optimalTotalCost
      },
      costAnalysis: {
        currentAnnualCost: currentTotalCost,
        optimizedAnnualCost: optimalTotalCost,
        potentialSavings: currentTotalCost - optimalTotalCost,
        savingsPercentage: currentTotalCost > 0 ? ((currentTotalCost - optimalTotalCost) / currentTotalCost) * 100 : 0
      },
      recommendations: [{
        type: 'bulk_purchase',
        description: `Optimize order quantity to ${Math.round(optimalOrderQuantity)} units`,
        estimatedSavings: currentTotalCost - optimalTotalCost,
        priority: currentTotalCost - optimalTotalCost > 100 ? 'high' : 'medium',
        confidence: 80
      }]
    });
  }

  return await this.create({
    hotelId,
    analysisType: 'bulk_optimization',
    period: {
      startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      endDate: new Date()
    },
    items: analysisItems,
    metadata: {
      analysisMethod: 'automated',
      confidence: 80,
      reviewFrequency: 'quarterly'
    }
  });
};

// Helper functions
function generateMockSuppliers(item) {
  const basePrice = item.unitPrice;
  return [
    {
      name: 'EconoSupply Plus',
      unitPrice: basePrice * 0.85,
      leadTime: 10,
      reliability: 75,
      qualityScore: 80,
      minimumOrder: 50,
      bulkDiscounts: [
        { quantity: 100, discountPercent: 5 },
        { quantity: 500, discountPercent: 10 }
      ]
    },
    {
      name: 'Premium Wholesale',
      unitPrice: basePrice * 0.95,
      leadTime: 5,
      reliability: 95,
      qualityScore: 95,
      minimumOrder: 25,
      bulkDiscounts: [
        { quantity: 200, discountPercent: 3 }
      ]
    },
    {
      name: 'BulkBuy Direct',
      unitPrice: basePrice * 0.78,
      leadTime: 14,
      reliability: 70,
      qualityScore: 75,
      minimumOrder: 100,
      bulkDiscounts: [
        { quantity: 500, discountPercent: 15 },
        { quantity: 1000, discountPercent: 20 }
      ]
    }
  ];
}

function calculateRiskScore(item, alternative) {
  let risk = 0;

  // Price difference risk
  const priceDiff = Math.abs(item.unitPrice - alternative.unitPrice) / item.unitPrice;
  risk += priceDiff * 30;

  // Reliability risk
  risk += (100 - alternative.reliability) * 0.5;

  // Lead time risk
  if (alternative.leadTime > 7) risk += 10;

  // Quality risk
  risk += (100 - alternative.qualityScore) * 0.3;

  return Math.min(100, Math.max(0, risk));
}

function generateRecommendations(item, bestAlternative, savings) {
  const recommendations = [];

  if (savings > 100) {
    recommendations.push({
      type: 'supplier_change',
      description: `Switch to ${bestAlternative.name} for ${savings.toFixed(2)} annual savings`,
      estimatedSavings: savings,
      priority: savings > 500 ? 'high' : 'medium',
      confidence: 85 - calculateRiskScore(item, bestAlternative),
      riskLevel: calculateRiskScore(item, bestAlternative) > 50 ? 'high' : 'medium'
    });
  }

  if (bestAlternative.bulkDiscounts && bestAlternative.bulkDiscounts.length > 0) {
    recommendations.push({
      type: 'bulk_purchase',
      description: `Consider bulk purchase for additional ${bestAlternative.bulkDiscounts[0].discountPercent}% discount`,
      estimatedSavings: savings * (bestAlternative.bulkDiscounts[0].discountPercent / 100),
      priority: 'medium',
      confidence: 75
    });
  }

  return recommendations;
}

export default mongoose.model('CostAnalysis', costAnalysisSchema);
