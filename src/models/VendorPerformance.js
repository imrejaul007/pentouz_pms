import mongoose from 'mongoose';

const vendorPerformanceSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true,
    index: true
  },
  period: {
    type: {
      type: String,
      enum: ['weekly', 'monthly', 'quarterly', 'yearly'],
      required: true
    },
    year: {
      type: Number,
      required: true,
      min: 2020,
      max: 2050
    },
    month: {
      type: Number,
      min: 1,
      max: 12
    },
    quarter: {
      type: Number,
      min: 1,
      max: 4
    },
    week: {
      type: Number,
      min: 1,
      max: 53
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    }
  },
  deliveryMetrics: {
    totalOrders: {
      type: Number,
      default: 0,
      min: 0
    },
    onTimeDeliveries: {
      type: Number,
      default: 0,
      min: 0
    },
    lateDeliveries: {
      type: Number,
      default: 0,
      min: 0
    },
    onTimeDeliveryPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    averageDeliveryTime: {
      type: Number,
      default: 0,
      min: 0 // in days
    },
    promisedDeliveryTime: {
      type: Number,
      default: 0,
      min: 0 // in days
    },
    deliveryVariance: {
      type: Number,
      default: 0 // deviation from promised time
    },
    emergencyDeliveries: {
      type: Number,
      default: 0,
      min: 0
    },
    emergencyDeliverySuccess: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  qualityMetrics: {
    totalItemsReceived: {
      type: Number,
      default: 0,
      min: 0
    },
    defectiveItems: {
      type: Number,
      default: 0,
      min: 0
    },
    defectRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    returnedItems: {
      type: Number,
      default: 0,
      min: 0
    },
    returnRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    qualityScore: {
      type: Number,
      default: 3,
      min: 1,
      max: 5
    },
    qualityIssues: [{
      category: {
        type: String,
        enum: ['damaged', 'incorrect_item', 'poor_quality', 'expired', 'incomplete', 'other']
      },
      count: { type: Number, min: 0 },
      description: { type: String, trim: true }
    }],
    inspectionsPassed: {
      type: Number,
      default: 0,
      min: 0
    },
    inspectionsFailed: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  costMetrics: {
    totalOrderValue: {
      type: Number,
      default: 0,
      min: 0
    },
    averageOrderValue: {
      type: Number,
      default: 0,
      min: 0
    },
    costSavings: {
      type: Number,
      default: 0
    },
    priceVariance: {
      type: Number,
      default: 0
    },
    competitivenessScore: {
      type: Number,
      default: 3,
      min: 1,
      max: 5
    },
    discountsReceived: {
      type: Number,
      default: 0,
      min: 0
    },
    penaltiesPaid: {
      type: Number,
      default: 0,
      min: 0
    },
    contractCompliance: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    }
  },
  serviceMetrics: {
    responseTime: {
      averageHours: {
        type: Number,
        default: 24,
        min: 0
      },
      targetHours: {
        type: Number,
        default: 24,
        min: 0
      }
    },
    communicationScore: {
      type: Number,
      default: 3,
      min: 1,
      max: 5
    },
    professionalismScore: {
      type: Number,
      default: 3,
      min: 1,
      max: 5
    },
    problemResolution: {
      totalIssues: {
        type: Number,
        default: 0,
        min: 0
      },
      resolvedIssues: {
        type: Number,
        default: 0,
        min: 0
      },
      averageResolutionTime: {
        type: Number,
        default: 0,
        min: 0 // in hours
      },
      satisfactionScore: {
        type: Number,
        default: 3,
        min: 1,
        max: 5
      }
    },
    supportQuality: {
      type: Number,
      default: 3,
      min: 1,
      max: 5
    },
    documentationQuality: {
      type: Number,
      default: 3,
      min: 1,
      max: 5
    }
  },
  orderMetrics: {
    totalOrders: {
      type: Number,
      default: 0,
      min: 0
    },
    completedOrders: {
      type: Number,
      default: 0,
      min: 0
    },
    cancelledOrders: {
      type: Number,
      default: 0,
      min: 0
    },
    orderFulfillmentRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    orderAccuracy: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    partialDeliveries: {
      type: Number,
      default: 0,
      min: 0
    },
    completeDeliveries: {
      type: Number,
      default: 0,
      min: 0
    },
    orderComplexity: {
      simpleOrders: { type: Number, default: 0, min: 0 },
      complexOrders: { type: Number, default: 0, min: 0 },
      rushOrders: { type: Number, default: 0, min: 0 }
    }
  },
  reliabilityMetrics: {
    consistencyScore: {
      type: Number,
      default: 3,
      min: 1,
      max: 5
    },
    predictabilityScore: {
      type: Number,
      default: 3,
      min: 1,
      max: 5
    },
    dependabilityScore: {
      type: Number,
      default: 3,
      min: 1,
      max: 5
    },
    flexibilityScore: {
      type: Number,
      default: 3,
      min: 1,
      max: 5
    },
    innovationScore: {
      type: Number,
      default: 3,
      min: 1,
      max: 5
    }
  },
  complianceMetrics: {
    contractCompliance: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    },
    documentationCompliance: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    },
    deliveryCompliance: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    },
    qualityCompliance: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    },
    safetyCompliance: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    },
    complianceViolations: [{
      type: {
        type: String,
        enum: ['delivery', 'quality', 'documentation', 'safety', 'contract', 'other']
      },
      description: { type: String, trim: true },
      severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical']
      },
      date: { type: Date, default: Date.now },
      resolved: { type: Boolean, default: false },
      resolutionDate: Date
    }]
  },
  overallScore: {
    type: Number,
    default: 3,
    min: 1,
    max: 5
  },
  weightedScore: {
    type: Number,
    default: 3,
    min: 1,
    max: 5
  },
  recommendations: [{
    category: {
      type: String,
      enum: ['delivery', 'quality', 'cost', 'service', 'compliance', 'general']
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    },
    recommendation: {
      type: String,
      required: true,
      trim: true
    },
    actionRequired: {
      type: String,
      enum: ['vendor', 'hotel', 'both'],
      default: 'vendor'
    },
    targetDate: Date,
    status: {
      type: String,
      enum: ['open', 'in_progress', 'completed', 'cancelled'],
      default: 'open'
    }
  }],
  improvements: [{
    area: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    implementationDate: Date,
    impact: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    measuredImprovement: {
      type: String,
      trim: true
    }
  }],
  achievements: [{
    category: {
      type: String,
      enum: ['delivery', 'quality', 'cost', 'service', 'innovation', 'partnership']
    },
    achievement: {
      type: String,
      required: true,
      trim: true
    },
    date: {
      type: Date,
      default: Date.now
    },
    impact: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    recognition: {
      type: String,
      trim: true
    }
  }],
  benchmarkComparison: {
    industryAverage: {
      deliveryPerformance: { type: Number, min: 0, max: 100 },
      qualityScore: { type: Number, min: 1, max: 5 },
      serviceScore: { type: Number, min: 1, max: 5 },
      overallScore: { type: Number, min: 1, max: 5 }
    },
    hotelAverage: {
      deliveryPerformance: { type: Number, min: 0, max: 100 },
      qualityScore: { type: Number, min: 1, max: 5 },
      serviceScore: { type: Number, min: 1, max: 5 },
      overallScore: { type: Number, min: 1, max: 5 }
    },
    ranking: {
      amongAllVendors: { type: Number, min: 1 },
      inCategory: { type: Number, min: 1 },
      totalVendors: { type: Number, min: 1 },
      categoryVendors: { type: Number, min: 1 }
    }
  },
  trendAnalysis: {
    deliveryTrend: {
      type: String,
      enum: ['improving', 'stable', 'declining'],
      default: 'stable'
    },
    qualityTrend: {
      type: String,
      enum: ['improving', 'stable', 'declining'],
      default: 'stable'
    },
    costTrend: {
      type: String,
      enum: ['improving', 'stable', 'declining'],
      default: 'stable'
    },
    serviceTrend: {
      type: String,
      enum: ['improving', 'stable', 'declining'],
      default: 'stable'
    },
    overallTrend: {
      type: String,
      enum: ['improving', 'stable', 'declining'],
      default: 'stable'
    }
  },
  reviewDate: {
    type: Date,
    default: Date.now
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  nextReviewDate: {
    type: Date,
    required: true
  },
  actionPlan: [{
    area: {
      type: String,
      required: true,
      trim: true
    },
    action: {
      type: String,
      required: true,
      trim: true
    },
    owner: {
      type: String,
      enum: ['vendor', 'hotel', 'both'],
      required: true
    },
    targetDate: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ['planned', 'in_progress', 'completed', 'overdue'],
      default: 'planned'
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    }
  }],
  notes: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for performance
vendorPerformanceSchema.index({ hotelId: 1, vendorId: 1, 'period.type': 1, 'period.year': 1 });
vendorPerformanceSchema.index({ hotelId: 1, 'period.startDate': 1, 'period.endDate': 1 });
vendorPerformanceSchema.index({ hotelId: 1, overallScore: -1 });
vendorPerformanceSchema.index({ vendorId: 1, 'period.type': 1, 'period.year': 1 });

// Ensure unique performance record per vendor per period
vendorPerformanceSchema.index({
  hotelId: 1,
  vendorId: 1,
  'period.type': 1,
  'period.year': 1,
  'period.month': 1,
  'period.quarter': 1,
  'period.week': 1
}, { unique: true });

// Virtual fields
vendorPerformanceSchema.virtual('performanceSummary').get(function() {
  return {
    delivery: {
      score: this.deliveryMetrics.onTimeDeliveryPercentage,
      trend: this.trendAnalysis.deliveryTrend
    },
    quality: {
      score: this.qualityMetrics.qualityScore,
      trend: this.trendAnalysis.qualityTrend
    },
    cost: {
      score: this.costMetrics.competitivenessScore,
      trend: this.trendAnalysis.costTrend
    },
    service: {
      score: this.serviceMetrics.communicationScore,
      trend: this.trendAnalysis.serviceTrend
    },
    overall: {
      score: this.overallScore,
      trend: this.trendAnalysis.overallTrend
    }
  };
});

vendorPerformanceSchema.virtual('kpiStatus').get(function() {
  const delivery = this.deliveryMetrics.onTimeDeliveryPercentage;
  const quality = this.qualityMetrics.defectRate;
  const fulfillment = this.orderMetrics.orderFulfillmentRate;

  return {
    delivery: delivery >= 95 ? 'excellent' : delivery >= 85 ? 'good' : delivery >= 70 ? 'average' : 'poor',
    quality: quality <= 2 ? 'excellent' : quality <= 5 ? 'good' : quality <= 10 ? 'average' : 'poor',
    fulfillment: fulfillment >= 98 ? 'excellent' : fulfillment >= 90 ? 'good' : fulfillment >= 80 ? 'average' : 'poor'
  };
});

vendorPerformanceSchema.virtual('riskLevel').get(function() {
  const delivery = this.deliveryMetrics.onTimeDeliveryPercentage;
  const quality = this.qualityMetrics.defectRate;
  const compliance = this.complianceMetrics.contractCompliance;

  let riskScore = 0;

  if (delivery < 70) riskScore += 3;
  else if (delivery < 85) riskScore += 2;
  else if (delivery < 95) riskScore += 1;

  if (quality > 10) riskScore += 3;
  else if (quality > 5) riskScore += 2;
  else if (quality > 2) riskScore += 1;

  if (compliance < 80) riskScore += 3;
  else if (compliance < 90) riskScore += 2;
  else if (compliance < 95) riskScore += 1;

  if (riskScore >= 7) return 'high';
  else if (riskScore >= 4) return 'medium';
  else if (riskScore >= 2) return 'low';
  else return 'minimal';
});

// Pre-save middleware
vendorPerformanceSchema.pre('save', function(next) {
  // Calculate derived metrics
  this.calculateDerivedMetrics();

  // Calculate overall score
  this.calculateOverallScore();

  // Set next review date if not set
  if (!this.nextReviewDate) {
    const nextReview = new Date(this.reviewDate);
    switch (this.period.type) {
      case 'weekly':
        nextReview.setDate(nextReview.getDate() + 7);
        break;
      case 'monthly':
        nextReview.setMonth(nextReview.getMonth() + 1);
        break;
      case 'quarterly':
        nextReview.setMonth(nextReview.getMonth() + 3);
        break;
      case 'yearly':
        nextReview.setFullYear(nextReview.getFullYear() + 1);
        break;
    }
    this.nextReviewDate = nextReview;
  }

  next();
});

// Instance methods
vendorPerformanceSchema.methods.calculateDerivedMetrics = function() {
  // Calculate delivery metrics
  if (this.deliveryMetrics.totalOrders > 0) {
    this.deliveryMetrics.onTimeDeliveryPercentage =
      (this.deliveryMetrics.onTimeDeliveries / this.deliveryMetrics.totalOrders) * 100;
  }

  // Calculate quality metrics
  if (this.qualityMetrics.totalItemsReceived > 0) {
    this.qualityMetrics.defectRate =
      (this.qualityMetrics.defectiveItems / this.qualityMetrics.totalItemsReceived) * 100;

    this.qualityMetrics.returnRate =
      (this.qualityMetrics.returnedItems / this.qualityMetrics.totalItemsReceived) * 100;
  }

  // Calculate order metrics
  if (this.orderMetrics.totalOrders > 0) {
    this.orderMetrics.orderFulfillmentRate =
      (this.orderMetrics.completedOrders / this.orderMetrics.totalOrders) * 100;
  }

  // Calculate cost metrics
  if (this.orderMetrics.totalOrders > 0) {
    this.costMetrics.averageOrderValue =
      this.costMetrics.totalOrderValue / this.orderMetrics.totalOrders;
  }
};

vendorPerformanceSchema.methods.calculateOverallScore = function() {
  // Weighted calculation of overall score
  const weights = {
    delivery: 0.25,
    quality: 0.25,
    cost: 0.20,
    service: 0.15,
    reliability: 0.10,
    compliance: 0.05
  };

  // Normalize delivery percentage to 1-5 scale
  const deliveryScore = Math.min(5, Math.max(1, (this.deliveryMetrics.onTimeDeliveryPercentage / 20) + 1));

  // Use existing scores for other metrics
  const qualityScore = this.qualityMetrics.qualityScore;
  const costScore = this.costMetrics.competitivenessScore;
  const serviceScore = this.serviceMetrics.communicationScore;
  const reliabilityScore = this.reliabilityMetrics.dependabilityScore;
  const complianceScore = Math.min(5, Math.max(1, (this.complianceMetrics.contractCompliance / 20) + 1));

  this.overallScore = (
    deliveryScore * weights.delivery +
    qualityScore * weights.quality +
    costScore * weights.cost +
    serviceScore * weights.service +
    reliabilityScore * weights.reliability +
    complianceScore * weights.compliance
  );

  this.weightedScore = this.overallScore;
};

vendorPerformanceSchema.methods.addRecommendation = function(recommendation) {
  this.recommendations.push(recommendation);
  return this.save();
};

vendorPerformanceSchema.methods.addImprovement = function(improvement) {
  this.improvements.push(improvement);
  return this.save();
};

vendorPerformanceSchema.methods.addAchievement = function(achievement) {
  this.achievements.push(achievement);
  return this.save();
};

vendorPerformanceSchema.methods.updateActionPlan = function(actionId, updates) {
  const action = this.actionPlan.id(actionId);
  if (action) {
    Object.assign(action, updates);
    return this.save();
  }
  throw new Error('Action plan item not found');
};

// Static methods
vendorPerformanceSchema.statics.getPerformanceByPeriod = function(hotelId, period, year, month = null, quarter = null) {
  const query = {
    hotelId,
    'period.type': period,
    'period.year': year
  };

  if (period === 'monthly' && month) query['period.month'] = month;
  if (period === 'quarterly' && quarter) query['period.quarter'] = quarter;

  return this.find(query)
    .populate('vendorId', 'name categories status')
    .sort({ overallScore: -1 });
};

vendorPerformanceSchema.statics.getTopPerformers = function(hotelId, period = 'monthly', limit = 10) {
  return this.find({
    hotelId,
    'period.type': period
  })
  .populate('vendorId', 'name categories')
  .sort({ overallScore: -1, weightedScore: -1 })
  .limit(limit);
};

vendorPerformanceSchema.statics.getPoorPerformers = function(hotelId, period = 'monthly', threshold = 2.5) {
  return this.find({
    hotelId,
    'period.type': period,
    overallScore: { $lt: threshold }
  })
  .populate('vendorId', 'name categories')
  .sort({ overallScore: 1 });
};

vendorPerformanceSchema.statics.getPerformanceTrends = async function(hotelId, vendorId, periods = 6) {
  return this.find({
    hotelId,
    vendorId,
    'period.type': 'monthly'
  })
  .sort({ 'period.year': -1, 'period.month': -1 })
  .limit(periods)
  .select('period overallScore deliveryMetrics.onTimeDeliveryPercentage qualityMetrics.qualityScore costMetrics.competitivenessScore serviceMetrics.communicationScore');
};

vendorPerformanceSchema.statics.getPerformanceComparison = async function(hotelId, vendorIds, period = 'monthly') {
  return this.find({
    hotelId,
    vendorId: { $in: vendorIds },
    'period.type': period
  })
  .populate('vendorId', 'name')
  .sort({ overallScore: -1 });
};

vendorPerformanceSchema.statics.getHotelPerformanceStats = async function(hotelId, period = 'monthly') {
  const stats = await this.aggregate([
    {
      $match: {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        'period.type': period
      }
    },
    {
      $group: {
        _id: null,
        avgDeliveryPerformance: { $avg: '$deliveryMetrics.onTimeDeliveryPercentage' },
        avgQualityScore: { $avg: '$qualityMetrics.qualityScore' },
        avgServiceScore: { $avg: '$serviceMetrics.communicationScore' },
        avgOverallScore: { $avg: '$overallScore' },
        totalVendors: { $sum: 1 },
        excellentPerformers: {
          $sum: { $cond: [{ $gte: ['$overallScore', 4.5] }, 1, 0] }
        },
        goodPerformers: {
          $sum: { $cond: [{ $and: [{ $gte: ['$overallScore', 3.5] }, { $lt: ['$overallScore', 4.5] }] }, 1, 0] }
        },
        poorPerformers: {
          $sum: { $cond: [{ $lt: ['$overallScore', 2.5] }, 1, 0] }
        }
      }
    }
  ]);

  return stats[0] || {};
};

const VendorPerformance = mongoose.model('VendorPerformance', vendorPerformanceSchema);

export default VendorPerformance;
