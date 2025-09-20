import mongoose from 'mongoose';

const revenueReportSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  reportId: {
    type: String,
    required: true,
    unique: true,
    default: () => `rev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  },
  
  // Report configuration
  reportType: {
    type: String,
    enum: [
      'daily', 'weekly', 'monthly', 'quarterly', 'yearly',
      'custom_period', 'real_time', 'forecast', 'comparative'
    ],
    required: true,
    index: true
  },
  reportPeriod: {
    startDate: {
      type: Date,
      required: true,
      index: true
    },
    endDate: {
      type: Date,
      required: true,
      index: true
    },
    timezone: {
      type: String,
      default: 'UTC'
    }
  },
  
  // Currency and localization settings
  currencySettings: {
    baseCurrency: {
      type: String,
      required: true,
      default: 'USD'
    },
    reportingCurrencies: [{
      currencyCode: {
        type: String,
        required: true
      },
      exchangeRate: {
        type: Number,
        required: true
      },
      rateDate: {
        type: Date,
        required: true
      },
      isDefault: {
        type: Boolean,
        default: false
      }
    }],
    conversionMethod: {
      type: String,
      enum: ['daily_average', 'period_average', 'closing_rate', 'real_time'],
      default: 'daily_average'
    }
  },
  
  // Revenue data by currency
  revenueData: {
    totalRevenue: {
      type: Map,
      of: Number, // Currency code -> amount
      required: true
    },
    roomRevenue: {
      type: Map,
      of: Number
    },
    serviceRevenue: {
      type: Map,
      of: Number
    },
    taxRevenue: {
      type: Map,
      of: Number
    },
    discountAmount: {
      type: Map,
      of: Number
    },
    netRevenue: {
      type: Map,
      of: Number
    }
  },
  
  // Performance metrics
  performanceMetrics: {
    occupancyRate: {
      type: Number,
      min: 0,
      max: 100
    },
    averageDailyRate: {
      type: Map,
      of: Number // Currency code -> ADR
    },
    revenuePerAvailableRoom: {
      type: Map,
      of: Number // Currency code -> RevPAR
    },
    totalRoomNights: {
      type: Number,
      default: 0
    },
    availableRoomNights: {
      type: Number,
      default: 0
    },
    
    // Advanced metrics
    totalRoomRevenue: {
      type: Map,
      of: Number // Currency code -> TRevPAR
    },
    grossOperatingProfit: {
      type: Map,
      of: Number // Currency code -> GOP
    },
    profitMargin: {
      type: Number,
      min: 0,
      max: 100
    }
  },
  
  // Channel breakdown
  channelBreakdown: [{
    channelId: {
      type: String,
      required: true
    },
    channelName: {
      type: String,
      required: true
    },
    revenue: {
      type: Map,
      of: Number // Currency code -> revenue
    },
    bookings: {
      type: Number,
      default: 0
    },
    roomNights: {
      type: Number,
      default: 0
    },
    averageRate: {
      type: Map,
      of: Number
    },
    commission: {
      type: Map,
      of: Number
    },
    netRevenue: {
      type: Map,
      of: Number
    }
  }],
  
  // Market segment analysis
  marketSegments: [{
    segmentName: {
      type: String,
      required: true
    },
    segmentType: {
      type: String,
      enum: ['corporate', 'leisure', 'group', 'government', 'other']
    },
    revenue: {
      type: Map,
      of: Number
    },
    bookings: {
      type: Number,
      default: 0
    },
    roomNights: {
      type: Number,
      default: 0
    },
    averageRate: {
      type: Map,
      of: Number
    },
    customerAcquisitionCost: {
      type: Map,
      of: Number
    }
  }],
  
  // Regional analysis
  regionalData: [{
    region: {
      type: String,
      required: true
    },
    country: {
      type: String,
      required: true
    },
    currency: {
      type: String,
      required: true
    },
    guestCount: {
      type: Number,
      default: 0
    },
    revenue: {
      type: Map,
      of: Number
    },
    averageStayLength: {
      type: Number,
      default: 0
    },
    repeatCustomerRate: {
      type: Number,
      min: 0,
      max: 100
    },
    seasonalityIndex: {
      type: Number,
      default: 1.0
    }
  }],
  
  // Time series data for trends
  timeSeriesData: [{
    date: {
      type: Date,
      required: true
    },
    revenue: {
      type: Map,
      of: Number
    },
    occupancyRate: {
      type: Number
    },
    averageDailyRate: {
      type: Map,
      of: Number
    },
    bookings: {
      type: Number,
      default: 0
    }
  }],
  
  // Forecasting data
  forecastData: {
    nextPeriodRevenue: {
      type: Map,
      of: Number
    },
    confidenceInterval: {
      lower: {
        type: Map,
        of: Number
      },
      upper: {
        type: Map,
        of: Number
      }
    },
    forecastMethod: {
      type: String,
      enum: ['linear_regression', 'seasonal_decomposition', 'arima', 'prophet', 'ensemble']
    },
    accuracy: {
      type: Number,
      min: 0,
      max: 100
    }
  },
  
  // Comparative analysis
  comparativeData: {
    previousPeriod: {
      revenue: {
        type: Map,
        of: Number
      },
      occupancyRate: {
        type: Number
      },
      averageDailyRate: {
        type: Map,
        of: Number
      }
    },
    yearOverYear: {
      revenue: {
        type: Map,
        of: Number
      },
      occupancyRate: {
        type: Number
      },
      averageDailyRate: {
        type: Map,
        of: Number
      }
    },
    marketComparison: {
      competitorSet: [{
        competitorId: String,
        averageRate: {
          type: Map,
          of: Number
        },
        occupancyRate: Number,
        marketShare: Number
      }],
      marketPosition: {
        type: String,
        enum: ['leader', 'challenger', 'follower', 'niche']
      },
      priceIndex: {
        type: Number,
        default: 100
      }
    }
  },
  
  // Report metadata
  reportMetadata: {
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    generatedAt: {
      type: Date,
      default: Date.now
    },
    processingTime: {
      type: Number // milliseconds
    },
    dataPoints: {
      type: Number,
      default: 0
    },
    dataQuality: {
      type: Number,
      min: 0,
      max: 100,
      default: 100
    },
    version: {
      type: String,
      default: '1.0'
    }
  },
  
  // Localization settings
  localization: {
    language: {
      type: String,
      default: 'EN'
    },
    numberFormat: {
      type: String,
      enum: ['US', 'EU', 'UK', 'IN', 'CN'],
      default: 'US'
    },
    dateFormat: {
      type: String,
      default: 'MM/DD/YYYY'
    },
    currencyDisplay: {
      type: String,
      enum: ['symbol', 'code', 'name'],
      default: 'symbol'
    }
  },
  
  // Export and sharing settings
  exportSettings: {
    formats: [{
      type: String,
      enum: ['pdf', 'excel', 'csv', 'json', 'powerbi', 'tableau']
    }],
    scheduledExports: [{
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly']
      },
      recipients: [String],
      format: String,
      lastSent: Date
    }],
    publicUrl: String,
    expiresAt: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
revenueReportSchema.index({ hotelId: 1, 'reportPeriod.startDate': -1 });
revenueReportSchema.index({ reportType: 1, createdAt: -1 });
revenueReportSchema.index({ 'currencySettings.baseCurrency': 1 });
revenueReportSchema.index({ 'reportPeriod.startDate': 1, 'reportPeriod.endDate': 1 });

// Virtual for revenue growth
revenueReportSchema.virtual('revenueGrowth').get(function() {
  if (!this.comparativeData?.previousPeriod?.revenue) return null;
  
  const currentRevenue = this.revenueData.totalRevenue.get(this.currencySettings.baseCurrency) || 0;
  const previousRevenue = this.comparativeData.previousPeriod.revenue.get(this.currencySettings.baseCurrency) || 0;
  
  if (previousRevenue === 0) return null;
  return ((currentRevenue - previousRevenue) / previousRevenue) * 100;
});

// Virtual for average daily rate growth
revenueReportSchema.virtual('adrGrowth').get(function() {
  if (!this.comparativeData?.previousPeriod?.averageDailyRate) return null;
  
  const baseCurrency = this.currencySettings.baseCurrency;
  const currentADR = this.performanceMetrics.averageDailyRate?.get(baseCurrency) || 0;
  const previousADR = this.comparativeData.previousPeriod.averageDailyRate.get(baseCurrency) || 0;
  
  if (previousADR === 0) return null;
  return ((currentADR - previousADR) / previousADR) * 100;
});

// Virtual for occupancy growth
revenueReportSchema.virtual('occupancyGrowth').get(function() {
  if (!this.comparativeData?.previousPeriod?.occupancyRate) return null;
  
  const currentOccupancy = this.performanceMetrics.occupancyRate || 0;
  const previousOccupancy = this.comparativeData.previousPeriod.occupancyRate || 0;
  
  if (previousOccupancy === 0) return null;
  return currentOccupancy - previousOccupancy; // Percentage point difference
});

// Instance methods
revenueReportSchema.methods.convertTocurrency = function(amount, toCurrency) {
  const fromCurrency = this.currencySettings.baseCurrency;
  if (fromCurrency === toCurrency) return amount;
  
  const currencyConfig = this.currencySettings.reportingCurrencies.find(
    c => c.currencyCode === toCurrency
  );
  
  if (!currencyConfig) throw new Error(`Currency ${toCurrency} not configured`);
  
  return amount * currencyConfig.exchangeRate;
};

revenueReportSchema.methods.getRevenueInCurrency = function(currencyCode) {
  const revenue = this.revenueData.totalRevenue.get(currencyCode);
  if (revenue !== undefined) return revenue;
  
  // Convert from base currency
  const baseRevenue = this.revenueData.totalRevenue.get(this.currencySettings.baseCurrency);
  if (baseRevenue === undefined) return 0;
  
  return this.convertTourrency(baseRevenue, currencyCode);
};

revenueReportSchema.methods.calculateRevenuePerAvailableRoom = function(currencyCode) {
  const totalRevenue = this.getRevenueInCurrency(currencyCode);
  const availableRoomNights = this.performanceMetrics.availableRoomNights || 1;
  
  return totalRevenue / availableRoomNights;
};

revenueReportSchema.methods.getTopPerformingChannel = function() {
  if (!this.channelBreakdown?.length) return null;
  
  const baseCurrency = this.currencySettings.baseCurrency;
  return this.channelBreakdown.reduce((top, channel) => {
    const channelRevenue = channel.revenue.get(baseCurrency) || 0;
    const topRevenue = top?.revenue?.get(baseCurrency) || 0;
    
    return channelRevenue > topRevenue ? channel : top;
  });
};

revenueReportSchema.methods.getRegionalInsights = function() {
  if (!this.regionalData?.length) return [];
  
  return this.regionalData.map(region => ({
    region: region.region,
    country: region.country,
    revenueShare: this.calculateRevenueShare(region),
    performanceIndex: this.calculateRegionalPerformanceIndex(region),
    growthPotential: this.calculateGrowthPotential(region)
  }));
};

revenueReportSchema.methods.calculateRevenueShare = function(regionData) {
  const baseCurrency = this.currencySettings.baseCurrency;
  const regionRevenue = regionData.revenue.get(baseCurrency) || 0;
  const totalRevenue = this.revenueData.totalRevenue.get(baseCurrency) || 1;
  
  return (regionRevenue / totalRevenue) * 100;
};

revenueReportSchema.methods.calculateRegionalPerformanceIndex = function(regionData) {
  // Simplified performance index calculation
  const avgStayLength = regionData.averageStayLength || 1;
  const repeatRate = regionData.repeatCustomerRate || 0;
  const seasonalityBonus = regionData.seasonalityIndex > 1 ? 10 : 0;
  
  return Math.min(100, (avgStayLength * 20) + (repeatRate * 0.5) + seasonalityBonus);
};

revenueReportSchema.methods.calculateGrowthPotential = function(regionData) {
  // Simplified growth potential calculation
  const guestCount = regionData.guestCount || 0;
  const repeatRate = regionData.repeatCustomerRate || 0;
  
  if (guestCount < 100) return 'High';
  if (repeatRate < 30) return 'Medium';
  return 'Low';
};

// Static methods
revenueReportSchema.statics.generateReport = async function(hotelId, options = {}) {
  const {
    reportType = 'monthly',
    startDate,
    endDate,
    baseCurrency = 'USD',
    includeForecasting = false,
    includeComparison = true
  } = options;
  
  // This would contain the complex logic to aggregate booking data
  // and generate comprehensive revenue reports
  
  const report = new this({
    hotelId,
    reportType,
    reportPeriod: { startDate, endDate },
    currencySettings: { baseCurrency }
  });
  
  // Populate report data (simplified for example)
  await report.populateRevenueData();
  await report.populatePerformanceMetrics();
  
  if (includeComparison) {
    await report.populateComparativeData();
  }
  
  if (includeForecasting) {
    await report.generateForecast();
  }
  
  return report;
};

revenueReportSchema.statics.getRevenueByPeriod = function(hotelId, startDate, endDate, currency = 'USD') {
  return this.aggregate([
    {
      $match: {
        hotelId: mongoose.Types.ObjectId(hotelId),
        'reportPeriod.startDate': { $gte: startDate },
        'reportPeriod.endDate': { $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: {
          $sum: { $ifNull: [`$revenueData.totalRevenue.${currency}`, 0] }
        },
        averageOccupancy: {
          $avg: '$performanceMetrics.occupancyRate'
        },
        reportCount: { $sum: 1 }
      }
    }
  ]);
};

// Instance method to populate data (would be implemented based on booking data)
revenueReportSchema.methods.populateRevenueData = async function() {
  // Implementation would query booking data and aggregate revenue
  // This is a placeholder for the complex aggregation logic
};

revenueReportSchema.methods.populatePerformanceMetrics = async function() {
  // Implementation would calculate KPIs from booking and room data
};

revenueReportSchema.methods.populateComparativeData = async function() {
  // Implementation would fetch previous period data for comparison
};

revenueReportSchema.methods.generateForecast = async function() {
  // Implementation would use ML algorithms to predict future revenue
};

const RevenueReport = mongoose.model('RevenueReport', revenueReportSchema);

export default RevenueReport;
