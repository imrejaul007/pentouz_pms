import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     DemandForecast:
 *       type: object
 *       properties:
 *         forecastId:
 *           type: string
 *         date:
 *           type: string
 *           format: date
 *         predictedOccupancy:
 *           type: number
 *         confidence:
 *           type: number
 */

const demandForecastSchema = new mongoose.Schema({
  forecastId: {
    type: String,
    required: false,
    unique: true,
    sparse: true
  },
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: true
  },
  roomTypeId: {
    type: mongoose.Schema.ObjectId,
    ref: 'RoomType',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  // Demand predictions
  predictedDemand: {
    occupancyRate: {
      type: Number,
      min: 0,
      max: 100,
      required: true
    },
    roomsBooked: {
      type: Number,
      min: 0,
      required: true
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100,
      required: true
    }
  },
  // Revenue predictions
  revenueForcast: {
    predictedRevenue: Number,
    predictedADR: Number, // Average Daily Rate
    predictedRevPAR: Number, // Revenue Per Available Room
    confidence: Number
  },
  // Factors influencing demand
  demandFactors: {
    historical: {
      sameWeekLastYear: Number,
      sameMonthLastYear: Number,
      averageLast30Days: Number,
      trendDirection: {
        type: String,
        enum: ['increasing', 'decreasing', 'stable']
      }
    },
    seasonal: {
      seasonType: {
        type: String,
        enum: ['low', 'shoulder', 'high', 'peak']
      },
      seasonalMultiplier: Number,
      weatherImpact: Number
    },
    market: {
      competitorOccupancy: Number,
      marketEvents: [{
        name: String,
        impact: {
          type: String,
          enum: ['high', 'medium', 'low']
        },
        expectedIncrease: Number
      }],
      economicIndicators: {
        localBusinessActivity: Number,
        tourismIndex: Number
      }
    },
    booking: {
      currentBookings: Number,
      paceVsLastYear: Number, // % comparison
      leadTimePattern: String,
      cancellationRate: Number
    }
  },
  // Algorithm details
  modelInfo: {
    algorithm: {
      type: String,
      enum: ['linear_regression', 'time_series', 'neural_network', 'hybrid'],
      default: 'hybrid'
    },
    version: String,
    lastTrained: Date,
    accuracy: Number, // Historical accuracy %
    dataPoints: Number // Number of historical data points used
  },
  // Pricing recommendations
  pricingRecommendations: {
    recommendedRate: Number,
    priceElasticity: Number, // How sensitive demand is to price changes
    optimalPriceRange: {
      min: Number,
      max: Number
    },
    competitivenessScore: Number, // How competitive current pricing is
    revenueOptimizationScore: Number
  },
  // Validation and accuracy
  validation: {
    actualOccupancy: Number, // Filled after the date
    actualRevenue: Number,
    accuracyScore: Number, // How accurate this forecast was
    validated: {
      type: Boolean,
      default: false
    },
    validatedAt: Date
  },
  // Alerts and flags
  alerts: [{
    type: {
      type: String,
      enum: ['high_demand', 'low_demand', 'price_opportunity', 'competitor_alert']
    },
    message: String,
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    },
    actionRequired: Boolean
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
demandForecastSchema.index({ hotelId: 1, roomTypeId: 1, date: 1 }, { unique: true });
demandForecastSchema.index({ hotelId: 1, date: 1 });
demandForecastSchema.index({ date: 1, 'predictedDemand.confidence': -1 });

// Pre-save hook to generate forecast ID
demandForecastSchema.pre('save', function(next) {
  if (!this.forecastId) {
    const timestamp = Date.now();
    const hotelCode = this.hotelId.toString().slice(-6).toUpperCase();
    const dateStr = this.date.toISOString().split('T')[0].replace(/-/g, '');
    this.forecastId = `DF_${hotelCode}_${dateStr}_${timestamp}`;
  }
  next();
});

// Instance methods
demandForecastSchema.methods.updateWithActual = async function(actualOccupancy, actualRevenue) {
  this.validation.actualOccupancy = actualOccupancy;
  this.validation.actualRevenue = actualRevenue;
  
  // Calculate accuracy score
  const occupancyError = Math.abs(this.predictedDemand.occupancyRate - actualOccupancy);
  this.validation.accuracyScore = Math.max(0, 100 - (occupancyError * 2)); // Penalize errors
  
  this.validation.validated = true;
  this.validation.validatedAt = new Date();
  
  await this.save();
  
  return this.validation.accuracyScore;
};

demandForecastSchema.methods.generateAlerts = function() {
  const alerts = [];
  
  // High demand alert
  if (this.predictedDemand.occupancyRate > 85 && this.predictedDemand.confidence > 70) {
    alerts.push({
      type: 'high_demand',
      message: `High demand predicted (${this.predictedDemand.occupancyRate}% occupancy)`,
      severity: 'high',
      actionRequired: true
    });
  }
  
  // Low demand alert
  if (this.predictedDemand.occupancyRate < 40 && this.predictedDemand.confidence > 70) {
    alerts.push({
      type: 'low_demand',
      message: `Low demand predicted (${this.predictedDemand.occupancyRate}% occupancy)`,
      severity: 'medium',
      actionRequired: true
    });
  }
  
  // Price opportunity
  if (this.pricingRecommendations.revenueOptimizationScore < 60) {
    alerts.push({
      type: 'price_opportunity',
      message: 'Price optimization opportunity detected',
      severity: 'medium',
      actionRequired: false
    });
  }
  
  this.alerts = alerts;
};

// Static methods
demandForecastSchema.statics.generateForecast = async function(hotelId, roomTypeId, date) {
  const RoomAvailability = mongoose.model('RoomAvailability');
  const Booking = mongoose.model('Booking');
  
  try {
    // Get historical data for the same day of week, month, etc.
    const historicalData = await this.getHistoricalData(hotelId, roomTypeId, date);
    const bookingPace = await this.getBookingPace(hotelId, roomTypeId, date);
    const marketFactors = await this.getMarketFactors(hotelId, date);
    
    // Simple demand forecasting algorithm
    const baseOccupancy = historicalData.averageOccupancy || 60;
    const seasonalAdjustment = this.getSeasonalAdjustment(date);
    const paceAdjustment = bookingPace.adjustment || 0;
    const marketAdjustment = marketFactors.adjustment || 0;
    
    const predictedOccupancy = Math.min(100, Math.max(0, 
      baseOccupancy + seasonalAdjustment + paceAdjustment + marketAdjustment
    ));
    
    // Get room capacity
    const roomType = await mongoose.model('RoomType').findById(roomTypeId);
    const totalRooms = await this.getTotalRooms(hotelId, roomTypeId);
    
    const predictedRoomsBooked = Math.round((predictedOccupancy / 100) * totalRooms);
    const confidence = this.calculateConfidence(historicalData, bookingPace, marketFactors);
    
    // Calculate revenue predictions
    const predictedADR = roomType.basePrice * (1 + (predictedOccupancy - 60) / 100 * 0.2); // Simple price elasticity
    const predictedRevenue = predictedRoomsBooked * predictedADR;
    const predictedRevPAR = predictedRevenue / totalRooms;
    
    // Create forecast
    const forecast = new this({
      hotelId,
      roomTypeId,
      date,
      predictedDemand: {
        occupancyRate: Math.round(predictedOccupancy * 100) / 100,
        roomsBooked: predictedRoomsBooked,
        confidence: Math.round(confidence * 100) / 100
      },
      revenueForcast: {
        predictedRevenue: Math.round(predictedRevenue),
        predictedADR: Math.round(predictedADR),
        predictedRevPAR: Math.round(predictedRevPAR),
        confidence: Math.round(confidence * 100) / 100
      },
      demandFactors: {
        historical: historicalData,
        seasonal: {
          seasonType: this.getSeasonType(date),
          seasonalMultiplier: seasonalAdjustment / 100,
          weatherImpact: 0 // Would integrate with weather API
        },
        market: marketFactors,
        booking: bookingPace
      },
      modelInfo: {
        algorithm: 'hybrid',
        version: '1.0',
        lastTrained: new Date(),
        accuracy: 75, // Default accuracy
        dataPoints: historicalData.dataPoints || 30
      }
    });
    
    // Generate pricing recommendations
    forecast.pricingRecommendations = {
      recommendedRate: Math.round(predictedADR),
      priceElasticity: 0.8, // Default elasticity
      optimalPriceRange: {
        min: Math.round(predictedADR * 0.85),
        max: Math.round(predictedADR * 1.25)
      },
      competitivenessScore: 75, // Default score
      revenueOptimizationScore: Math.min(100, confidence + (predictedOccupancy > 70 ? 20 : 0))
    };
    
    // Generate alerts
    forecast.generateAlerts();
    
    await forecast.save();
    return forecast;
    
  } catch (error) {
    console.error('Error generating forecast:', error);
    throw error;
  }
};

demandForecastSchema.statics.getHistoricalData = async function(hotelId, roomTypeId, date) {
  const RoomAvailability = mongoose.model('RoomAvailability');
  
  // Get same day of week for last 8 weeks
  const historicalDates = [];
  for (let i = 1; i <= 8; i++) {
    const histDate = new Date(date);
    histDate.setDate(histDate.getDate() - (i * 7));
    historicalDates.push(histDate);
  }
  
  const historicalData = await RoomAvailability.find({
    hotelId,
    roomTypeId,
    date: { $in: historicalDates }
  });
  
  const occupancies = historicalData.map(d => (d.soldRooms / d.totalRooms) * 100);
  const averageOccupancy = occupancies.reduce((sum, occ) => sum + occ, 0) / occupancies.length || 60;
  
  return {
    averageOccupancy,
    sameWeekLastYear: averageOccupancy, // Simplified
    sameMonthLastYear: averageOccupancy, // Simplified
    averageLast30Days: averageOccupancy,
    trendDirection: 'stable',
    dataPoints: historicalData.length
  };
};

demandForecastSchema.statics.getBookingPace = async function(hotelId, roomTypeId, date) {
  const Booking = mongoose.model('Booking');
  
  // Get current bookings for this date
  const currentBookings = await Booking.countDocuments({
    hotelId,
    roomType: roomTypeId, // Note: This might need adjustment based on your booking model
    checkIn: { $lte: date },
    checkOut: { $gt: date },
    status: { $in: ['confirmed', 'checked_in'] }
  });
  
  return {
    currentBookings,
    paceVsLastYear: 0, // Simplified
    leadTimePattern: 'normal',
    cancellationRate: 5, // Default 5%
    adjustment: 0 // No adjustment for now
  };
};

demandForecastSchema.statics.getMarketFactors = async function(hotelId, date) {
  return {
    competitorOccupancy: 65, // Default market occupancy
    marketEvents: [],
    economicIndicators: {
      localBusinessActivity: 70,
      tourismIndex: 75
    },
    adjustment: 0
  };
};

demandForecastSchema.statics.getTotalRooms = async function(hotelId, roomTypeId) {
  const RoomAvailability = mongoose.model('RoomAvailability');
  
  const availability = await RoomAvailability.findOne({
    hotelId,
    roomTypeId,
    date: { $gte: new Date() }
  });
  
  return availability ? availability.totalRooms : 20; // Default fallback
};

demandForecastSchema.statics.getSeasonalAdjustment = function(date) {
  const month = date.getMonth();
  
  // Simple seasonal adjustments for India
  const seasonalFactors = {
    0: -10, // January (low season)
    1: -5,  // February
    2: 0,   // March
    3: 5,   // April
    4: 10,  // May (high season)
    5: 15,  // June (peak season)
    6: 15,  // July
    7: 10,  // August
    8: 5,   // September
    9: 0,   // October
    10: -5, // November
    11: -10 // December
  };
  
  return seasonalFactors[month] || 0;
};

demandForecastSchema.statics.getSeasonType = function(date) {
  const month = date.getMonth();
  
  if ([11, 0, 1].includes(month)) return 'low';
  if ([2, 9, 10].includes(month)) return 'shoulder';
  if ([3, 4, 8].includes(month)) return 'high';
  return 'peak'; // May-August
};

demandForecastSchema.statics.calculateConfidence = function(historical, booking, market) {
  let confidence = 50; // Base confidence
  
  // More historical data = higher confidence
  if (historical.dataPoints > 4) confidence += 20;
  
  // Stable trends = higher confidence
  if (historical.trendDirection === 'stable') confidence += 10;
  
  // Recent booking activity = higher confidence
  if (booking.currentBookings > 0) confidence += 15;
  
  return Math.min(95, confidence);
};

export default mongoose.model('DemandForecast', demandForecastSchema);
