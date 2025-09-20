import mongoose from 'mongoose';

const centralizedRateSchema = new mongoose.Schema({
  rateId: {
    type: String,
    required: true,
    unique: true,
    default: () => `CR${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`
  },
  
  rateName: {
    type: String,
    required: true,
    trim: true,
    maxLength: 100
  },
  
  description: {
    type: String,
    trim: true,
    maxLength: 500
  },
  
  propertyGroup: {
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'PropertyGroup', required: true },
    groupName: String,
    properties: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Hotel' }]
  },
  
  rateType: {
    type: String,
    enum: ['BAR', 'corporate', 'promotional', 'package', 'group', 'member', 'government', 'negotiated'],
    required: true
  },
  
  category: {
    type: String,
    enum: ['standard', 'premium', 'luxury', 'budget', 'family', 'business', 'leisure'],
    default: 'standard'
  },
  
  basePricing: {
    basePrice: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'USD' },
    pricePerNight: { type: Boolean, default: true },
    includeTaxes: { type: Boolean, default: false },
    includeBreakfast: { type: Boolean, default: false }
  },
  
  roomTypes: [{
    roomTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType' },
    roomTypeName: String,
    baseRate: { type: Number, required: true },
    adjustment: {
      type: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
      value: { type: Number, default: 0 }
    },
    availability: {
      isAvailable: { type: Boolean, default: true },
      allotment: { type: Number, min: 0 },
      stopSale: { type: Boolean, default: false }
    }
  }],
  
  distributionSettings: {
    distributionType: {
      type: String,
      enum: ['broadcast', 'selective', 'inheritance', 'override'],
      default: 'broadcast'
    },
    targetProperties: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Hotel' }],
    excludeProperties: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Hotel' }],
    overrideLocal: { type: Boolean, default: false },
    syncStatus: {
      type: String,
      enum: ['pending', 'syncing', 'synced', 'failed', 'partial'],
      default: 'pending'
    },
    lastSyncDate: Date,
    syncErrors: [{
      propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel' },
      error: String,
      timestamp: { type: Date, default: Date.now }
    }]
  },
  
  validityPeriod: {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    timezone: { type: String, default: 'UTC' },
    recurringPattern: {
      type: { type: String, enum: ['none', 'weekly', 'monthly', 'yearly'], default: 'none' },
      interval: { type: Number, min: 1, default: 1 },
      daysOfWeek: [{ type: Number, min: 0, max: 6 }], // 0 = Sunday
      endAfter: { type: Number, min: 1 } // Number of occurrences
    }
  },
  
  bookingWindow: {
    advanceBooking: {
      minimum: { type: Number, default: 0 },
      maximum: { type: Number, default: 365 }
    },
    cutoffTime: { type: String, default: '18:00' },
    sameDayBooking: { type: Boolean, default: true }
  },
  
  stayRestrictions: {
    minimumStay: { type: Number, min: 1, default: 1 },
    maximumStay: { type: Number, min: 1, default: 30 },
    closedToArrival: [{ type: Date }],
    closedToDeparture: [{ type: Date }],
    stayThrough: [{ 
      startDate: Date, 
      endDate: Date,
      minimumStay: Number 
    }]
  },
  
  cancellationPolicy: {
    type: { type: String, enum: ['flexible', 'moderate', 'strict', 'non_refundable'], default: 'moderate' },
    cutoffHours: { type: Number, default: 24 },
    penaltyType: { type: String, enum: ['percentage', 'nights', 'fixed'], default: 'nights' },
    penaltyAmount: { type: Number, default: 1 },
    noShowPolicy: {
      chargeType: { type: String, enum: ['first_night', 'full_stay', 'percentage'], default: 'first_night' },
      chargeAmount: Number
    }
  },
  
  propertySpecificRates: [{
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
    propertyName: String,
    localRateId: String,
    adjustments: {
      type: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
      value: { type: Number, default: 0 }
    },
    overrides: {
      basePrice: Number,
      minimumStay: Number,
      maximumStay: Number,
      bookingWindow: {
        minimum: Number,
        maximum: Number
      }
    },
    syncStatus: {
      status: { type: String, enum: ['pending', 'synced', 'failed'], default: 'pending' },
      lastSync: Date,
      error: String
    }
  }],
  
  channels: {
    enabled: [{ 
      type: String, 
      enum: ['direct', 'website', 'ota', 'gds', 'corporate', 'travel_agent', 'wholesaler'] 
    }],
    channelSettings: [{
      channel: String,
      markup: {
        type: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
        value: { type: Number, default: 0 }
      },
      commission: {
        type: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
        value: { type: Number, default: 0 }
      },
      isActive: { type: Boolean, default: true }
    }],
    restrictions: {
      minimumStay: Number,
      maximumStay: Number,
      bookingWindow: {
        minimum: Number,
        maximum: Number
      }
    }
  },
  
  conflictResolution: {
    priority: { type: Number, min: 1, max: 10, default: 5 },
    conflictsWith: [{ 
      rateId: { type: mongoose.Schema.Types.ObjectId, ref: 'CentralizedRate' },
      rateName: String,
      conflictType: { type: String, enum: ['overlap', 'duplicate', 'priority'], required: true },
      resolution: { type: String, enum: ['ignore', 'override', 'merge', 'alert'], default: 'alert' }
    }],
    autoResolve: { type: Boolean, default: false }
  },
  
  analytics: {
    totalBookings: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    averageDailyRate: { type: Number, default: 0 },
    occupancyRate: { type: Number, default: 0 },
    revPAR: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 },
    performanceMetrics: [{
      propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel' },
      bookings: Number,
      revenue: Number,
      adr: Number,
      occupancy: Number,
      revpar: Number,
      lastUpdated: { type: Date, default: Date.now }
    }]
  },
  
  compliance: {
    taxIncluded: { type: Boolean, default: false },
    taxBreakdown: [{
      taxType: { type: String, enum: ['VAT', 'GST', 'city_tax', 'service_tax', 'resort_fee'] },
      percentage: Number,
      fixedAmount: Number,
      isIncluded: Boolean
    }],
    legalRequirements: {
      priceDisplayRules: [String],
      cancellationRules: [String],
      complianceNotes: String
    }
  },
  
  audit: {
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    approvalStatus: {
      type: String,
      enum: ['draft', 'pending_approval', 'approved', 'rejected', 'expired'],
      default: 'draft'
    },
    approvalDate: Date,
    version: { type: Number, default: 1 },
    changeLog: [{
      field: String,
      oldValue: mongoose.Schema.Types.Mixed,
      newValue: mongoose.Schema.Types.Mixed,
      changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
      changedAt: { type: Date, default: Date.now },
      reason: String
    }]
  },
  
  isActive: { type: Boolean, default: true },
  isTemplate: { type: Boolean, default: false },
  templateName: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
centralizedRateSchema.index({ rateId: 1 }, { unique: true });
centralizedRateSchema.index({ 'propertyGroup.groupId': 1, rateType: 1 });
centralizedRateSchema.index({ 'validityPeriod.startDate': 1, 'validityPeriod.endDate': 1 });
centralizedRateSchema.index({ 'distributionSettings.syncStatus': 1 });
centralizedRateSchema.index({ 'audit.approvalStatus': 1 });
centralizedRateSchema.index({ isActive: 1, isTemplate: 1 });
centralizedRateSchema.index({ 'propertySpecificRates.propertyId': 1 });
centralizedRateSchema.index({ createdAt: -1 });

// Virtual fields
centralizedRateSchema.virtual('isValid').get(function() {
  const now = new Date();
  return now >= this.validityPeriod.startDate && now <= this.validityPeriod.endDate;
});

centralizedRateSchema.virtual('daysUntilExpiry').get(function() {
  const now = new Date();
  const expiry = new Date(this.validityPeriod.endDate);
  const diffTime = expiry - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

centralizedRateSchema.virtual('syncProgress').get(function() {
  const total = this.propertyGroup.properties.length;
  const synced = this.propertySpecificRates.filter(rate => rate.syncStatus.status === 'synced').length;
  return total > 0 ? Math.round((synced / total) * 100) : 0;
});

centralizedRateSchema.virtual('hasConflicts').get(function() {
  return this.conflictResolution.conflictsWith.length > 0;
});

centralizedRateSchema.virtual('totalProperties').get(function() {
  return this.propertyGroup.properties.length;
});

// Instance methods
centralizedRateSchema.methods.calculateRateForProperty = function(propertyId, roomType, date, guests = 2) {
  let baseRate = this.basePricing.basePrice;
  
  // Apply room type adjustment
  const roomTypeRate = this.roomTypes.find(rt => 
    rt.roomTypeId.toString() === roomType.toString() || rt.roomTypeName === roomType
  );
  
  if (roomTypeRate) {
    if (roomTypeRate.adjustment.type === 'percentage') {
      baseRate = baseRate * (1 + roomTypeRate.adjustment.value / 100);
    } else {
      baseRate = baseRate + roomTypeRate.adjustment.value;
    }
  }
  
  // Apply property-specific adjustments
  const propertyRate = this.propertySpecificRates.find(pr => 
    pr.propertyId.toString() === propertyId.toString()
  );
  
  if (propertyRate) {
    if (propertyRate.overrides.basePrice) {
      baseRate = propertyRate.overrides.basePrice;
    } else if (propertyRate.adjustments.type === 'percentage') {
      baseRate = baseRate * (1 + propertyRate.adjustments.value / 100);
    } else {
      baseRate = baseRate + propertyRate.adjustments.value;
    }
  }
  
  return {
    baseRate,
    currency: this.basePricing.currency,
    taxIncluded: this.basePricing.includeTaxes,
    breakfastIncluded: this.basePricing.includeBreakfast
  };
};

centralizedRateSchema.methods.checkAvailability = function(propertyId, roomType, checkIn, checkOut) {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  
  // Check validity period
  if (checkInDate < this.validityPeriod.startDate || checkInDate > this.validityPeriod.endDate) {
    return { available: false, reason: 'Outside validity period' };
  }
  
  // Check booking window
  const now = new Date();
  const daysUntilCheckIn = Math.ceil((checkInDate - now) / (1000 * 60 * 60 * 24));
  
  if (daysUntilCheckIn < this.bookingWindow.advanceBooking.minimum) {
    return { available: false, reason: 'Minimum advance booking not met' };
  }
  
  if (daysUntilCheckIn > this.bookingWindow.advanceBooking.maximum) {
    return { available: false, reason: 'Maximum advance booking exceeded' };
  }
  
  // Check stay restrictions
  const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
  
  if (nights < this.stayRestrictions.minimumStay) {
    return { available: false, reason: `Minimum ${this.stayRestrictions.minimumStay} nights required` };
  }
  
  if (nights > this.stayRestrictions.maximumStay) {
    return { available: false, reason: `Maximum ${this.stayRestrictions.maximumStay} nights allowed` };
  }
  
  // Check closed to arrival/departure
  const closedToArrival = this.stayRestrictions.closedToArrival.some(date => 
    new Date(date).toDateString() === checkInDate.toDateString()
  );
  
  if (closedToArrival) {
    return { available: false, reason: 'Closed to arrival on selected date' };
  }
  
  const closedToDeparture = this.stayRestrictions.closedToDeparture.some(date => 
    new Date(date).toDateString() === checkOutDate.toDateString()
  );
  
  if (closedToDeparture) {
    return { available: false, reason: 'Closed to departure on selected date' };
  }
  
  // Check room type availability
  const roomTypeRate = this.roomTypes.find(rt => 
    rt.roomTypeId?.toString() === roomType.toString() || rt.roomTypeName === roomType
  );
  
  if (!roomTypeRate || !roomTypeRate.availability.isAvailable || roomTypeRate.availability.stopSale) {
    return { available: false, reason: 'Room type not available' };
  }
  
  return { available: true, rate: this.calculateRateForProperty(propertyId, roomType, checkIn) };
};

centralizedRateSchema.methods.distributeToProperties = async function() {
  this.distributionSettings.syncStatus = 'syncing';
  this.distributionSettings.lastSyncDate = new Date();
  
  const results = {
    success: [],
    failed: [],
    total: 0
  };
  
  try {
    let targetProperties = [];
    
    if (this.distributionSettings.distributionType === 'broadcast') {
      targetProperties = this.propertyGroup.properties;
    } else if (this.distributionSettings.distributionType === 'selective') {
      targetProperties = this.distributionSettings.targetProperties;
    }
    
    // Filter out excluded properties
    targetProperties = targetProperties.filter(propId => 
      !this.distributionSettings.excludeProperties.includes(propId)
    );
    
    results.total = targetProperties.length;
    
    // This would integrate with actual property management systems
    // For now, we'll update the sync status
    for (const propertyId of targetProperties) {
      try {
        // Simulate distribution logic
        let propertyRate = this.propertySpecificRates.find(pr => 
          pr.propertyId.toString() === propertyId.toString()
        );
        
        if (!propertyRate) {
          propertyRate = {
            propertyId,
            adjustments: { type: 'percentage', value: 0 },
            syncStatus: { status: 'pending' }
          };
          this.propertySpecificRates.push(propertyRate);
        }
        
        propertyRate.syncStatus.status = 'synced';
        propertyRate.syncStatus.lastSync = new Date();
        propertyRate.syncStatus.error = null;
        
        results.success.push(propertyId);
      } catch (error) {
        results.failed.push({ propertyId, error: error.message });
        
        // Log sync error
        this.distributionSettings.syncErrors.push({
          propertyId,
          error: error.message
        });
      }
    }
    
    this.distributionSettings.syncStatus = results.failed.length > 0 ? 'partial' : 'synced';
    
    await this.save();
    return results;
    
  } catch (error) {
    this.distributionSettings.syncStatus = 'failed';
    this.distributionSettings.syncErrors.push({
      error: error.message
    });
    
    await this.save();
    throw error;
  }
};

centralizedRateSchema.methods.addPropertyOverride = function(propertyId, overrides) {
  let propertyRate = this.propertySpecificRates.find(pr => 
    pr.propertyId.toString() === propertyId.toString()
  );
  
  if (!propertyRate) {
    propertyRate = {
      propertyId,
      adjustments: { type: 'percentage', value: 0 },
      overrides: {},
      syncStatus: { status: 'pending' }
    };
    this.propertySpecificRates.push(propertyRate);
  }
  
  Object.assign(propertyRate.overrides, overrides);
  propertyRate.syncStatus.status = 'pending';
  
  return this.save();
};

centralizedRateSchema.methods.logChange = function(field, oldValue, newValue, changedBy, reason) {
  this.audit.changeLog.push({
    field,
    oldValue,
    newValue,
    changedBy,
    reason
  });
  
  this.audit.version += 1;
  this.audit.updatedBy = changedBy;
  
  return this.save();
};

// Static methods
centralizedRateSchema.statics.findActiveRatesForProperty = function(propertyId, date) {
  const checkDate = date || new Date();
  
  return this.find({
    'propertyGroup.properties': propertyId,
    isActive: true,
    'validityPeriod.startDate': { $lte: checkDate },
    'validityPeriod.endDate': { $gte: checkDate },
    'audit.approvalStatus': 'approved'
  }).populate('propertyGroup.groupId');
};

centralizedRateSchema.statics.findConflictingRates = function(groupId, startDate, endDate, rateType) {
  return this.find({
    'propertyGroup.groupId': groupId,
    rateType,
    isActive: true,
    $or: [
      {
        'validityPeriod.startDate': { $lte: endDate },
        'validityPeriod.endDate': { $gte: startDate }
      }
    ]
  });
};

centralizedRateSchema.statics.getDistributionStatus = function(groupId) {
  return this.aggregate([
    { $match: { 'propertyGroup.groupId': groupId, isActive: true } },
    {
      $group: {
        _id: '$distributionSettings.syncStatus',
        count: { $sum: 1 },
        rates: { $push: { rateId: '$rateId', rateName: '$rateName' } }
      }
    }
  ]);
};

centralizedRateSchema.statics.generatePerformanceReport = function(groupId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        'propertyGroup.groupId': groupId,
        isActive: true,
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$rateType',
        totalRates: { $sum: 1 },
        totalBookings: { $sum: '$analytics.totalBookings' },
        totalRevenue: { $sum: '$analytics.totalRevenue' },
        avgADR: { $avg: '$analytics.averageDailyRate' },
        avgOccupancy: { $avg: '$analytics.occupancyRate' }
      }
    },
    { $sort: { totalRevenue: -1 } }
  ]);
};

// Pre-save middleware
centralizedRateSchema.pre('save', function(next) {
  // Update sync status if properties changed
  if (this.isModified('propertyGroup.properties')) {
    this.distributionSettings.syncStatus = 'pending';
  }
  
  // Validate date ranges
  if (this.validityPeriod.startDate >= this.validityPeriod.endDate) {
    next(new Error('End date must be after start date'));
    return;
  }
  
  // Ensure property-specific rates exist for all group properties
  if (this.propertyGroup.properties) {
    this.propertyGroup.properties.forEach(propertyId => {
      const exists = this.propertySpecificRates.find(pr => 
        pr.propertyId.toString() === propertyId.toString()
      );
      
      if (!exists) {
        this.propertySpecificRates.push({
          propertyId,
          adjustments: { type: 'percentage', value: 0 },
          syncStatus: { status: 'pending' }
        });
      }
    });
  }
  
  next();
});

const CentralizedRate = mongoose.model('CentralizedRate', centralizedRateSchema);

export default CentralizedRate;
