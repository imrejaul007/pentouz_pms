import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     KPI:
 *       type: object
 *       required:
 *         - hotelId
 *         - date
 *         - period
 *       properties:
 *         _id:
 *           type: string
 *         hotelId:
 *           type: string
 *           description: Hotel ID
 *         date:
 *           type: string
 *           format: date
 *         period:
 *           type: string
 *           enum: [daily, weekly, monthly, yearly]
 *         revenue:
 *           type: object
 *           properties:
 *             roomRevenue:
 *               type: number
 *               description: Total room revenue
 *             nonRoomRevenue:
 *               type: number
 *               description: F&B, Spa, Other services
 *             totalRevenue:
 *               type: number
 *               description: Total hotel revenue
 *             addOns:
 *               type: number
 *               description: Additional services and fees
 *             discounts:
 *               type: number
 *               description: Total discounts given
 *             taxes:
 *               type: number
 *               description: Taxes collected
 *         occupancy:
 *           type: object
 *           properties:
 *             roomNightsSold:
 *               type: number
 *               description: Number of room nights sold
 *             availableRoomNights:
 *               type: number
 *               description: Total available room nights
 *             occupancyRate:
 *               type: number
 *               description: Occupancy percentage
 *         rates:
 *           type: object
 *           properties:
 *             adr:
 *               type: number
 *               description: Average Daily Rate
 *             revpar:
 *               type: number
 *               description: Revenue per Available Room
 *         profitability:
 *           type: object
 *           properties:
 *             gop:
 *               type: number
 *               description: Gross Operating Profit
 *             goppar:
 *               type: number
 *               description: GOP per Available Room
 *             cpor:
 *               type: number
 *               description: Cost per Occupied Room
 *             roomDirectCosts:
 *               type: number
 *               description: Direct costs for rooms
 *             operatingExpenses:
 *               type: number
 *               description: Total operating expenses
 *         productivity:
 *           type: object
 *           properties:
 *             housekeeping:
 *               type: object
 *               properties:
 *                 cleanedRooms:
 *                   type: number
 *                 paidHours:
 *                   type: number
 *                 productivity:
 *                   type: number
 *                   description: Cleaned Rooms ÷ Paid Hours
 *             maintenance:
 *               type: object
 *               properties:
 *                 workOrdersClosed:
 *                   type: number
 *                 paidHours:
 *                   type: number
 *                 productivity:
 *                   type: number
 *                   description: Work Orders Closed ÷ Paid Hours
 *             frontDesk:
 *               type: object
 *               properties:
 *                 checkIns:
 *                   type: number
 *                 checkOuts:
 *                   type: number
 *                 paidHours:
 *                   type: number
 *                 productivity:
 *                   type: number
 *                   description: (Check-ins + Check-outs) ÷ Paid Hours
 *         risk:
 *           type: object
 *           properties:
 *             noShowRate:
 *               type: number
 *               description: No-shows ÷ Confirmed Bookings
 *             cancellationRate:
 *               type: number
 *               description: Cancellations ÷ Bookings
 *             guestSatisfaction:
 *               type: object
 *               properties:
 *                 averageRating:
 *                   type: number
 *                 npsScore:
 *                   type: number
 *                 fiveStarPercentage:
 *                   type: number
 *         floorMetrics:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               floor:
 *                 type: number
 *               roomRevenue:
 *                 type: number
 *               directCosts:
 *                 type: number
 *               allocatedOverheads:
 *                 type: number
 *               floorProfit:
 *                 type: number
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const kpiSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required']
  },
  date: {
    type: Date,
    required: [true, 'Date is required']
  },
  period: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
    required: [true, 'Period is required'],
    default: 'daily'
  },
  
  // Revenue metrics
  revenue: {
    roomRevenue: {
      type: Number,
      default: 0,
      min: 0
    },
    nonRoomRevenue: {
      type: Number,
      default: 0,
      min: 0
    },
    totalRevenue: {
      type: Number,
      default: 0,
      min: 0
    },
    addOns: {
      type: Number,
      default: 0,
      min: 0
    },
    discounts: {
      type: Number,
      default: 0,
      min: 0
    },
    taxes: {
      type: Number,
      default: 0,
      min: 0
    }
  },

  // Occupancy metrics
  occupancy: {
    roomNightsSold: {
      type: Number,
      default: 0,
      min: 0
    },
    availableRoomNights: {
      type: Number,
      default: 0,
      min: 0
    },
    occupancyRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  },

  // Rate metrics
  rates: {
    adr: {
      type: Number,
      default: 0,
      min: 0
    },
    revpar: {
      type: Number,
      default: 0,
      min: 0
    }
  },

  // Profitability metrics
  profitability: {
    gop: {
      type: Number,
      default: 0
    },
    goppar: {
      type: Number,
      default: 0
    },
    cpor: {
      type: Number,
      default: 0,
      min: 0
    },
    roomDirectCosts: {
      type: Number,
      default: 0,
      min: 0
    },
    operatingExpenses: {
      type: Number,
      default: 0,
      min: 0
    }
  },

  // Productivity metrics
  productivity: {
    housekeeping: {
      cleanedRooms: {
        type: Number,
        default: 0,
        min: 0
      },
      paidHours: {
        type: Number,
        default: 0,
        min: 0
      },
      productivity: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    maintenance: {
      workOrdersClosed: {
        type: Number,
        default: 0,
        min: 0
      },
      paidHours: {
        type: Number,
        default: 0,
        min: 0
      },
      productivity: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    frontDesk: {
      checkIns: {
        type: Number,
        default: 0,
        min: 0
      },
      checkOuts: {
        type: Number,
        default: 0,
        min: 0
      },
      paidHours: {
        type: Number,
        default: 0,
        min: 0
      },
      productivity: {
        type: Number,
        default: 0,
        min: 0
      }
    }
  },

  // Risk and quality metrics
  risk: {
    noShowRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    cancellationRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    guestSatisfaction: {
      averageRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
      },
      npsScore: {
        type: Number,
        default: 0,
        min: -100,
        max: 100
      },
      fiveStarPercentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      }
    }
  },

  // Floor-wise metrics
  floorMetrics: [{
    floor: {
      type: Number,
      required: true,
      min: 1
    },
    roomRevenue: {
      type: Number,
      default: 0,
      min: 0
    },
    directCosts: {
      type: Number,
      default: 0,
      min: 0
    },
    allocatedOverheads: {
      type: Number,
      default: 0,
      min: 0
    },
    floorProfit: {
      type: Number,
      default: 0
    }
  }],

  // Metadata for tracking calculation source
  metadata: {
    calculatedAt: {
      type: Date,
      default: Date.now
    },
    source: {
      type: String,
      enum: ['manual', 'automated', 'import'],
      default: 'automated'
    },
    version: {
      type: String,
      default: '1.0'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
kpiSchema.index({ hotelId: 1, date: 1, period: 1 }, { unique: true });
kpiSchema.index({ hotelId: 1, period: 1, date: -1 });
kpiSchema.index({ date: -1 });

// Pre-save middleware to calculate derived metrics
kpiSchema.pre('save', function(next) {
  // Calculate ADR (Average Daily Rate)
  if (this.occupancy.roomNightsSold > 0) {
    this.rates.adr = this.revenue.roomRevenue / this.occupancy.roomNightsSold;
  }

  // Calculate RevPAR (Revenue per Available Room)
  if (this.occupancy.availableRoomNights > 0) {
    this.rates.revpar = this.revenue.roomRevenue / this.occupancy.availableRoomNights;
  }

  // Calculate Occupancy Rate
  if (this.occupancy.availableRoomNights > 0) {
    this.occupancy.occupancyRate = (this.occupancy.roomNightsSold / this.occupancy.availableRoomNights) * 100;
  }

  // Calculate total revenue
  this.revenue.totalRevenue = this.revenue.roomRevenue + this.revenue.nonRoomRevenue;

  // Calculate GOP (Gross Operating Profit)
  this.profitability.gop = this.revenue.totalRevenue - this.profitability.operatingExpenses;

  // Calculate GOPPAR (GOP per Available Room)
  if (this.occupancy.availableRoomNights > 0) {
    this.profitability.goppar = this.profitability.gop / this.occupancy.availableRoomNights;
  }

  // Calculate CPOR (Cost per Occupied Room)
  if (this.occupancy.roomNightsSold > 0) {
    this.profitability.cpor = this.profitability.roomDirectCosts / this.occupancy.roomNightsSold;
  }

  // Calculate productivity metrics
  if (this.productivity.housekeeping.paidHours > 0) {
    this.productivity.housekeeping.productivity = this.productivity.housekeeping.cleanedRooms / this.productivity.housekeeping.paidHours;
  }

  if (this.productivity.maintenance.paidHours > 0) {
    this.productivity.maintenance.productivity = this.productivity.maintenance.workOrdersClosed / this.productivity.maintenance.paidHours;
  }

  if (this.productivity.frontDesk.paidHours > 0) {
    this.productivity.frontDesk.productivity = (this.productivity.frontDesk.checkIns + this.productivity.frontDesk.checkOuts) / this.productivity.frontDesk.paidHours;
  }

  // Calculate floor profits
  this.floorMetrics.forEach(floor => {
    floor.floorProfit = floor.roomRevenue - floor.directCosts - floor.allocatedOverheads;
  });

  next();
});

// Instance methods for calculations
kpiSchema.methods.calculateAverageRoomProfit = function() {
  if (this.occupancy.roomNightsSold > 0) {
    return (this.revenue.roomRevenue - this.profitability.roomDirectCosts) / this.occupancy.roomNightsSold;
  }
  return 0;
};

kpiSchema.methods.getPerformanceScore = function() {
  const weights = {
    occupancy: 0.3,
    adr: 0.25,
    guestSatisfaction: 0.2,
    productivity: 0.15,
    profitability: 0.1
  };

  const scores = {
    occupancy: Math.min(this.occupancy.occupancyRate / 85 * 100, 100), // 85% is excellent
    adr: Math.min(this.rates.adr / 5000 * 100, 100), // 5000 INR is high-end
    guestSatisfaction: this.risk.guestSatisfaction.averageRating / 5 * 100,
    productivity: Math.min((this.productivity.housekeeping.productivity + this.productivity.maintenance.productivity + this.productivity.frontDesk.productivity) / 3 * 20, 100),
    profitability: this.profitability.gop > 0 ? Math.min(this.profitability.gop / this.revenue.totalRevenue * 100 * 2, 100) : 0
  };

  return Object.entries(weights).reduce((total, [metric, weight]) => {
    return total + (scores[metric] * weight);
  }, 0);
};

// Static methods for aggregation
kpiSchema.statics.getAggregatedKPIs = async function(hotelId, startDate, endDate, period = 'daily') {
  const pipeline = [
    {
      $match: {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        date: { $gte: new Date(startDate), $lte: new Date(endDate) },
        period
      }
    },
    {
      $group: {
        _id: null,
        totalRoomRevenue: { $sum: '$revenue.roomRevenue' },
        totalNonRoomRevenue: { $sum: '$revenue.nonRoomRevenue' },
        totalRoomNightsSold: { $sum: '$occupancy.roomNightsSold' },
        totalAvailableRoomNights: { $sum: '$occupancy.availableRoomNights' },
        avgADR: { $avg: '$rates.adr' },
        avgRevPAR: { $avg: '$rates.revpar' },
        avgOccupancy: { $avg: '$occupancy.occupancyRate' },
        totalGOP: { $sum: '$profitability.gop' },
        avgGuestSatisfaction: { $avg: '$risk.guestSatisfaction.averageRating' },
        avgNoShowRate: { $avg: '$risk.noShowRate' },
        avgCancellationRate: { $avg: '$risk.cancellationRate' }
      }
    }
  ];

  const result = await this.aggregate(pipeline);
  return result[0] || {};
};

kpiSchema.statics.getTrendData = async function(hotelId, metric, days = 30) {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));

  const pipeline = [
    {
      $match: {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        date: { $gte: startDate, $lte: endDate },
        period: 'daily'
      }
    },
    { $sort: { date: 1 } },
    {
      $project: {
        date: 1,
        value: `$${metric}`
      }
    }
  ];

  return await this.aggregate(pipeline);
};

export default mongoose.model('KPI', kpiSchema);
