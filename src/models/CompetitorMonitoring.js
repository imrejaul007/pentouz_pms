import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     CompetitorRate:
 *       type: object
 *       properties:
 *         competitorId:
 *           type: string
 *         name:
 *           type: string
 *         rate:
 *           type: number
 *         availability:
 *           type: string
 *         lastUpdated:
 *           type: string
 *           format: date-time
 */

const competitorRateSchema = new mongoose.Schema({
  rateId: {
    type: String,
    required: true,
    unique: true
  },
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: true
  },
  competitorId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Competitor',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  roomType: {
    type: String,
    required: true // e.g., 'deluxe', 'standard', 'suite'
  },
  // Rate information
  rate: {
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'INR'
    },
    ratePlan: String, // e.g., 'BAR', 'Non-refundable'
    includesBreakfast: Boolean,
    includesTax: Boolean
  },
  // Availability information
  availability: {
    status: {
      type: String,
      enum: ['available', 'limited', 'sold_out', 'unknown'],
      required: true
    },
    roomsLeft: Number, // If shown (e.g., "Only 2 rooms left")
    restrictions: [{
      type: {
        type: String,
        enum: ['min_stay', 'max_stay', 'no_checkin', 'no_checkout']
      },
      value: mongoose.Schema.Types.Mixed
    }]
  },
  // Source information
  source: {
    channel: {
      type: String,
      enum: ['booking.com', 'expedia', 'hotel_website', 'agoda', 'hotels.com', 'trivago'],
      required: true
    },
    url: String,
    scrapedAt: {
      type: Date,
      default: Date.now
    },
    scrapeMethod: {
      type: String,
      enum: ['api', 'web_scraping', 'manual'],
      default: 'web_scraping'
    }
  },
  // Quality and confidence
  dataQuality: {
    confidence: {
      type: Number,
      min: 0,
      max: 100,
      default: 80
    },
    verified: {
      type: Boolean,
      default: false
    },
    lastVerified: Date,
    issues: [String] // Any data quality issues
  },
  // Comparison with our rates
  comparison: {
    ourRate: Number,
    difference: Number, // Their rate - our rate
    percentageDifference: Number,
    competitivePosition: {
      type: String,
      enum: ['cheaper', 'same', 'more_expensive'],
      default: 'same'
    }
  }
}, {
  timestamps: true
});

const competitorSchema = new mongoose.Schema({
  competitorId: {
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
  name: {
    type: String,
    required: true
  },
  description: String,
  // Location and property details
  location: {
    address: String,
    city: String,
    latitude: Number,
    longitude: Number,
    distanceFromUs: Number // in kilometers
  },
  propertyDetails: {
    starRating: Number,
    roomCount: Number,
    propertyType: {
      type: String,
      enum: ['hotel', 'resort', 'guesthouse', 'apartment', 'villa']
    },
    amenities: [String],
    targetSegment: {
      type: String,
      enum: ['budget', 'mid-scale', 'upscale', 'luxury']
    }
  },
  // Monitoring configuration
  monitoring: {
    isActive: {
      type: Boolean,
      default: true
    },
    priority: {
      type: Number,
      min: 1,
      max: 10,
      default: 5
    },
    monitoringFrequency: {
      type: Number,
      default: 360 // minutes
    },
    roomTypeMappings: [{
      ourRoomType: {
        type: mongoose.Schema.ObjectId,
        ref: 'RoomType'
      },
      theirRoomType: String,
      mapping: {
        type: String,
        enum: ['exact', 'similar', 'approximate']
      }
    }]
  },
  // Data sources
  dataSources: [{
    channel: {
      type: String,
      enum: ['booking.com', 'expedia', 'hotel_website', 'agoda', 'hotels.com'],
      required: true
    },
    url: String,
    enabled: {
      type: Boolean,
      default: true
    },
    credentials: {
      apiKey: String,
      username: String,
      password: String
    },
    lastSuccessfulScrape: Date,
    lastError: {
      message: String,
      timestamp: Date
    }
  }],
  // Performance tracking
  performance: {
    averageRate: Number,
    occupancyEstimate: Number,
    reviewScore: Number,
    reviewCount: Number,
    lastUpdated: Date
  },
  // Analysis results
  analysis: {
    competitiveStrength: {
      type: String,
      enum: ['weak', 'moderate', 'strong', 'very_strong']
    },
    priceStrategy: {
      type: String,
      enum: ['premium', 'competitive', 'value', 'budget']
    },
    marketPosition: String,
    threats: [String],
    opportunities: [String]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Competitor rate alert schema
const competitorAlertSchema = new mongoose.Schema({
  alertId: {
    type: String,
    required: true,
    unique: true
  },
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: true
  },
  competitorId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Competitor',
    required: true
  },
  alertType: {
    type: String,
    enum: ['price_drop', 'price_increase', 'availability_change', 'new_competitor', 'rate_parity_violation'],
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  message: {
    type: String,
    required: true
  },
  details: {
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    difference: Number,
    percentageChange: Number,
    roomType: String,
    date: Date
  },
  actionRecommendations: [{
    action: String,
    priority: {
      type: String,
      enum: ['low', 'medium', 'high']
    },
    estimatedImpact: String
  }],
  status: {
    type: String,
    enum: ['new', 'acknowledged', 'in_progress', 'resolved', 'dismissed'],
    default: 'new'
  },
  assignedTo: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  resolvedAt: Date,
  resolution: String
}, {
  timestamps: true
});

// Indexes
competitorRateSchema.index({ hotelId: 1, competitorId: 1, date: 1, roomType: 1 }, { unique: true });
competitorRateSchema.index({ date: 1, 'source.scrapedAt': -1 });
competitorSchema.index({ hotelId: 1, 'monitoring.isActive': 1 });
competitorAlertSchema.index({ hotelId: 1, status: 1, createdAt: -1 });

// Pre-save hooks to generate IDs
competitorRateSchema.pre('save', function(next) {
  if (!this.rateId) {
    const timestamp = Date.now();
    const dateStr = this.date.toISOString().split('T')[0].replace(/-/g, '');
    this.rateId = `CR_${this.competitorId.toString().slice(-6)}_${dateStr}_${timestamp}`;
  }
  next();
});

competitorSchema.pre('save', function(next) {
  if (!this.competitorId) {
    const timestamp = Date.now();
    const hotelCode = this.hotelId.toString().slice(-6).toUpperCase();
    const nameCode = this.name.replace(/[^A-Z0-9]/gi, '').substring(0, 6).toUpperCase();
    this.competitorId = `COMP_${hotelCode}_${nameCode}_${timestamp}`;
  }
  next();
});

competitorAlertSchema.pre('save', function(next) {
  if (!this.alertId) {
    const timestamp = Date.now();
    const alertCode = this.alertType.toUpperCase().substring(0, 4);
    this.alertId = `ALERT_${alertCode}_${timestamp}`;
  }
  next();
});

// Instance methods for Competitor
competitorSchema.methods.updatePerformance = async function() {
  const CompetitorRate = mongoose.model('CompetitorRate');
  
  // Get recent rates (last 30 days)
  const recentRates = await CompetitorRate.find({
    competitorId: this._id,
    date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
  });
  
  if (recentRates.length > 0) {
    const totalRate = recentRates.reduce((sum, rate) => sum + rate.rate.amount, 0);
    this.performance.averageRate = totalRate / recentRates.length;
    
    // Estimate occupancy based on availability patterns
    const availableCount = recentRates.filter(rate => rate.availability.status === 'available').length;
    this.performance.occupancyEstimate = ((recentRates.length - availableCount) / recentRates.length) * 100;
  }
  
  this.performance.lastUpdated = new Date();
  await this.save();
};

competitorSchema.methods.generateAlerts = async function(newRate, oldRate = null) {
  const CompetitorAlert = mongoose.model('CompetitorAlert');
  const alerts = [];
  
  if (oldRate) {
    const priceDifference = newRate.rate.amount - oldRate.rate.amount;
    const percentageChange = (priceDifference / oldRate.rate.amount) * 100;
    
    // Significant price drop
    if (percentageChange < -15) {
      alerts.push({
        hotelId: this.hotelId,
        competitorId: this._id,
        alertType: 'price_drop',
        severity: 'high',
        message: `${this.name} dropped prices by ${Math.abs(percentageChange).toFixed(1)}%`,
        details: {
          oldValue: oldRate.rate.amount,
          newValue: newRate.rate.amount,
          difference: priceDifference,
          percentageChange,
          roomType: newRate.roomType,
          date: newRate.date
        },
        actionRecommendations: [
          {
            action: 'Review and consider matching price reduction',
            priority: 'high',
            estimatedImpact: 'May lose bookings if price gap is too wide'
          }
        ]
      });
    }
    
    // Significant price increase
    if (percentageChange > 20) {
      alerts.push({
        hotelId: this.hotelId,
        competitorId: this._id,
        alertType: 'price_increase',
        severity: 'medium',
        message: `${this.name} increased prices by ${percentageChange.toFixed(1)}%`,
        details: {
          oldValue: oldRate.rate.amount,
          newValue: newRate.rate.amount,
          difference: priceDifference,
          percentageChange,
          roomType: newRate.roomType,
          date: newRate.date
        },
        actionRecommendations: [
          {
            action: 'Consider increasing rates to capture additional revenue',
            priority: 'medium',
            estimatedImpact: 'Opportunity to increase revenue without losing competitiveness'
          }
        ]
      });
    }
  }
  
  // Create alerts in database
  for (const alertData of alerts) {
    const alert = new CompetitorAlert(alertData);
    await alert.save();
  }
  
  return alerts;
};

// Static methods for CompetitorRate
competitorRateSchema.statics.getCompetitivePosition = async function(hotelId, roomType, date) {
  const rates = await this.find({
    hotelId,
    roomType,
    date,
    'dataQuality.confidence': { $gte: 60 }
  }).populate('competitorId');
  
  if (rates.length === 0) return null;
  
  const sortedRates = rates.sort((a, b) => a.rate.amount - b.rate.amount);
  const averageRate = rates.reduce((sum, rate) => sum + rate.rate.amount, 0) / rates.length;
  
  return {
    totalCompetitors: rates.length,
    lowestRate: sortedRates[0],
    highestRate: sortedRates[sortedRates.length - 1],
    averageRate,
    medianRate: sortedRates[Math.floor(sortedRates.length / 2)].rate.amount,
    rateDistribution: {
      budget: rates.filter(r => r.rate.amount < averageRate * 0.8).length,
      midRange: rates.filter(r => r.rate.amount >= averageRate * 0.8 && r.rate.amount <= averageRate * 1.2).length,
      premium: rates.filter(r => r.rate.amount > averageRate * 1.2).length
    }
  };
};

competitorRateSchema.statics.updateComparison = async function(rateId, ourRate) {
  const rate = await this.findById(rateId);
  if (!rate) return;
  
  rate.comparison.ourRate = ourRate;
  rate.comparison.difference = rate.rate.amount - ourRate;
  rate.comparison.percentageDifference = ((rate.rate.amount - ourRate) / ourRate) * 100;
  
  if (rate.rate.amount < ourRate * 0.95) {
    rate.comparison.competitivePosition = 'cheaper';
  } else if (rate.rate.amount > ourRate * 1.05) {
    rate.comparison.competitivePosition = 'more_expensive';
  } else {
    rate.comparison.competitivePosition = 'same';
  }
  
  await rate.save();
};

// Static methods for Competitor
competitorSchema.statics.getActiveCompetitors = async function(hotelId) {
  return this.find({
    hotelId,
    'monitoring.isActive': true
  }).sort({ 'monitoring.priority': -1 });
};

const CompetitorRate = mongoose.model('CompetitorRate', competitorRateSchema);
const Competitor = mongoose.model('Competitor', competitorSchema);
const CompetitorAlert = mongoose.model('CompetitorAlert', competitorAlertSchema);

export { CompetitorRate, Competitor, CompetitorAlert };
export default Competitor;
