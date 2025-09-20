import mongoose from 'mongoose';

const roomFeatureSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  
  // Basic Information
  featureName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  
  featureCode: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    maxlength: 30,
    match: /^[A-Z0-9_-]+$/
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Feature Classification
  category: {
    type: String,
    required: true,
    enum: [
      'view', 'bedding', 'bathroom', 'technology', 'accessibility',
      'climate', 'entertainment', 'workspace', 'kitchen', 'safety',
      'connectivity', 'luxury', 'space', 'outdoor', 'pet', 'special'
    ],
    index: true
  },
  
  subCategory: {
    type: String,
    trim: true,
    maxlength: 50
  },
  
  featureType: {
    type: String,
    enum: ['standard', 'premium', 'optional', 'on_request', 'seasonal'],
    default: 'standard'
  },
  
  // Hierarchical Features
  isParentFeature: {
    type: Boolean,
    default: false
  },
  
  parentFeatureId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RoomFeature',
    default: null
  },
  
  childFeatures: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RoomFeature'
  }],
  
  // Feature Details
  specifications: {
    // View Features
    viewType: {
      type: String,
      enum: ['ocean', 'mountain', 'city', 'garden', 'pool', 'courtyard', 'street', 'partial', 'no_view']
    },
    viewQuality: {
      type: String,
      enum: ['panoramic', 'full', 'partial', 'limited', 'obstructed']
    },
    
    // Bedding Features
    bedType: {
      type: String,
      enum: ['king', 'queen', 'double', 'twin', 'single', 'bunk', 'sofa_bed', 'murphy', 'rollaway', 'crib']
    },
    bedCount: {
      type: Number,
      min: 0,
      max: 10
    },
    mattressType: {
      type: String,
      enum: ['memory_foam', 'spring', 'latex', 'hybrid', 'pillow_top', 'firm', 'soft']
    },
    
    // Bathroom Features
    bathroomType: {
      type: String,
      enum: ['ensuite', 'shared', 'private_external', 'jack_and_jill']
    },
    bathroomCount: {
      type: Number,
      min: 0,
      max: 5
    },
    bathroomAmenities: [{
      type: String,
      enum: ['shower', 'bathtub', 'jacuzzi', 'bidet', 'double_vanity', 'rainfall_shower', 'steam_shower']
    }],
    
    // Space Features
    roomSize: {
      value: Number,
      unit: {
        type: String,
        enum: ['sqft', 'sqm'],
        default: 'sqft'
      }
    },
    ceilingHeight: {
      value: Number,
      unit: {
        type: String,
        enum: ['ft', 'm'],
        default: 'ft'
      }
    },
    
    // Technology Features
    tvSize: {
      type: Number,
      min: 0,
      max: 100
    },
    tvType: {
      type: String,
      enum: ['lcd', 'led', 'oled', 'qled', 'smart_tv', 'cable', 'satellite']
    },
    audioSystem: {
      type: String,
      enum: ['basic', 'surround', 'soundbar', 'bluetooth', 'bose', 'premium']
    },
    
    // Connectivity Features
    wifiSpeed: {
      type: String,
      enum: ['basic', 'high_speed', 'premium', 'fiber', 'dedicated']
    },
    ethernetPorts: {
      type: Number,
      min: 0,
      max: 10
    },
    usbPorts: {
      type: Number,
      min: 0,
      max: 20
    },
    
    // Climate Features
    climateControl: {
      type: String,
      enum: ['central_ac', 'split_ac', 'window_ac', 'heating', 'fan', 'fireplace']
    },
    temperatureControl: {
      type: String,
      enum: ['manual', 'digital', 'smart', 'app_controlled']
    }
  },
  
  // Pricing and Value
  pricing: {
    isPremium: {
      type: Boolean,
      default: false
    },
    additionalCharge: {
      type: Number,
      default: 0,
      min: 0
    },
    chargeType: {
      type: String,
      enum: ['per_night', 'per_stay', 'one_time', 'hourly'],
      default: 'per_night'
    },
    includedInBaseRate: {
      type: Boolean,
      default: true
    }
  },
  
  // Availability and Restrictions
  availability: {
    isAvailable: {
      type: Boolean,
      default: true
    },
    seasonalAvailability: [{
      season: {
        type: String,
        enum: ['spring', 'summer', 'fall', 'winter', 'peak', 'off_peak']
      },
      available: Boolean
    }],
    minimumStayRequired: {
      type: Number,
      default: 0
    },
    maximumOccupancy: {
      type: Number,
      default: 0
    },
    ageRestriction: {
      minAge: {
        type: Number,
        default: 0
      },
      adultsOnly: {
        type: Boolean,
        default: false
      }
    }
  },
  
  // Booking and Display
  bookingSettings: {
    isBookable: {
      type: Boolean,
      default: false
    },
    allowGuestSelection: {
      type: Boolean,
      default: false
    },
    requiresApproval: {
      type: Boolean,
      default: false
    },
    advanceBookingDays: {
      type: Number,
      default: 0
    },
    cancellationPolicy: {
      type: String,
      enum: ['standard', 'flexible', 'strict', 'non_refundable', 'custom']
    }
  },
  
  displaySettings: {
    showOnWebsite: {
      type: Boolean,
      default: true
    },
    showOnOTA: {
      type: Boolean,
      default: true
    },
    displayOrder: {
      type: Number,
      default: 0
    },
    highlightFeature: {
      type: Boolean,
      default: false
    },
    icon: {
      type: String,
      maxlength: 50
    },
    images: [{
      url: String,
      caption: String,
      isPrimary: {
        type: Boolean,
        default: false
      }
    }]
  },
  
  // Localization
  localization: [{
    language: {
      type: String,
      required: true,
      maxlength: 5
    },
    featureName: {
      type: String,
      required: true
    },
    description: String,
    marketingText: String
  }],
  
  // Marketing and SEO
  marketing: {
    marketingName: {
      type: String,
      maxlength: 100
    },
    marketingDescription: {
      type: String,
      maxlength: 1000
    },
    searchKeywords: [{
      type: String,
      maxlength: 50
    }],
    sellingPoints: [{
      type: String,
      maxlength: 200
    }],
    targetSegments: [{
      type: String,
      enum: ['business', 'leisure', 'family', 'couples', 'groups', 'solo', 'luxury', 'budget']
    }]
  },
  
  // OTA and Channel Mapping
  channelMapping: [{
    channelCode: {
      type: String,
      required: true
    },
    channelFeatureCode: String,
    channelFeatureName: String,
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  
  // Room Assignment
  assignedRooms: [{
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room'
    },
    assignedDate: {
      type: Date,
      default: Date.now
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  
  assignedRoomTypes: [{
    roomTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RoomType'
    },
    isStandard: {
      type: Boolean,
      default: false
    },
    isOptional: {
      type: Boolean,
      default: false
    }
  }],
  
  // Statistics and Usage
  statistics: {
    totalRoomsAssigned: {
      type: Number,
      default: 0
    },
    totalBookingsWithFeature: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    totalReviews: {
      type: Number,
      default: 0
    },
    conversionRate: {
      type: Number,
      default: 0
    },
    revenueGenerated: {
      type: Number,
      default: 0
    },
    lastUsedDate: Date
  },
  
  // Maintenance and Quality
  maintenance: {
    requiresMaintenance: {
      type: Boolean,
      default: false
    },
    maintenanceFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly', 'annually', 'as_needed']
    },
    lastMaintenanceDate: Date,
    nextMaintenanceDate: Date,
    maintenanceNotes: String,
    qualityScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 100
    }
  },
  
  // Compliance and Certifications
  compliance: {
    certifications: [{
      name: String,
      issuingBody: String,
      issueDate: Date,
      expiryDate: Date,
      certificateNumber: String
    }],
    safetyCompliant: {
      type: Boolean,
      default: true
    },
    accessibilityCompliant: {
      type: Boolean,
      default: false
    },
    environmentalCompliant: {
      type: Boolean,
      default: false
    }
  },
  
  // Status and Lifecycle
  status: {
    type: String,
    enum: ['active', 'inactive', 'discontinued', 'coming_soon', 'seasonal'],
    default: 'active',
    index: true
  },
  
  lifecycleStage: {
    type: String,
    enum: ['new', 'established', 'premium', 'phasing_out', 'discontinued'],
    default: 'new'
  },
  
  // Tags and Metadata
  tags: [{
    type: String,
    maxlength: 50
  }],
  
  customAttributes: [{
    key: {
      type: String,
      maxlength: 50
    },
    value: mongoose.Schema.Types.Mixed,
    dataType: {
      type: String,
      enum: ['string', 'number', 'boolean', 'date', 'array', 'object']
    }
  }],
  
  // Notes and Documentation
  notes: {
    type: String,
    maxlength: 2000
  },
  
  internalNotes: {
    type: String,
    maxlength: 2000
  },
  
  // Audit Information
  auditInfo: {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    changeLog: [{
      action: String,
      changedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      changedAt: {
        type: Date,
        default: Date.now
      },
      changes: mongoose.Schema.Types.Mixed
    }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes
roomFeatureSchema.index({ hotelId: 1, featureCode: 1 }, { unique: true });
roomFeatureSchema.index({ hotelId: 1, category: 1, status: 1 });
roomFeatureSchema.index({ hotelId: 1, featureType: 1, status: 1 });
roomFeatureSchema.index({ hotelId: 1, 'pricing.isPremium': 1 });
roomFeatureSchema.index({ hotelId: 1, 'displaySettings.showOnWebsite': 1, status: 1 });

// Virtual for full feature path (for hierarchical features)
roomFeatureSchema.virtual('fullPath').get(function() {
  if (!this.parentFeatureId) return this.featureName;
  // Would need to populate parent to get full path
  return this.featureName;
});

// Virtual for availability status
roomFeatureSchema.virtual('isCurrentlyAvailable').get(function() {
  if (!this.availability.isAvailable) return false;
  if (this.status !== 'active') return false;
  
  // Check seasonal availability
  const currentMonth = new Date().getMonth();
  const currentSeason = currentMonth < 3 ? 'winter' : 
                        currentMonth < 6 ? 'spring' : 
                        currentMonth < 9 ? 'summer' : 'fall';
  
  const seasonalAvail = this.availability.seasonalAvailability.find(s => s.season === currentSeason);
  if (seasonalAvail && !seasonalAvail.available) return false;
  
  return true;
});

// Instance methods
roomFeatureSchema.methods.assignToRoom = async function(roomId) {
  const existingAssignment = this.assignedRooms.find(
    assignment => assignment.roomId.toString() === roomId.toString() && assignment.isActive
  );
  
  if (existingAssignment) {
    throw new Error('Feature already assigned to this room');
  }
  
  this.assignedRooms.push({
    roomId,
    assignedDate: new Date(),
    isActive: true
  });
  
  this.statistics.totalRoomsAssigned = this.assignedRooms.filter(a => a.isActive).length;
  await this.save();
};

roomFeatureSchema.methods.removeFromRoom = async function(roomId) {
  const assignment = this.assignedRooms.find(
    a => a.roomId.toString() === roomId.toString() && a.isActive
  );
  
  if (assignment) {
    assignment.isActive = false;
    this.statistics.totalRoomsAssigned = this.assignedRooms.filter(a => a.isActive).length;
    await this.save();
  }
};

roomFeatureSchema.methods.assignToRoomType = async function(roomTypeId, isStandard = false, isOptional = false) {
  const existingAssignment = this.assignedRoomTypes.find(
    a => a.roomTypeId.toString() === roomTypeId.toString()
  );
  
  if (existingAssignment) {
    existingAssignment.isStandard = isStandard;
    existingAssignment.isOptional = isOptional;
  } else {
    this.assignedRoomTypes.push({
      roomTypeId,
      isStandard,
      isOptional
    });
  }
  
  await this.save();
};

roomFeatureSchema.methods.updateStatistics = async function() {
  const Booking = mongoose.model('Booking');
  const Room = mongoose.model('Room');
  
  // Get all active room IDs with this feature
  const activeRoomIds = this.assignedRooms
    .filter(a => a.isActive)
    .map(a => a.roomId);
  
  if (activeRoomIds.length === 0) {
    this.statistics.totalBookingsWithFeature = 0;
    this.statistics.conversionRate = 0;
    return;
  }
  
  // Calculate booking statistics
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const bookingStats = await Booking.aggregate([
    {
      $match: {
        roomId: { $in: activeRoomIds },
        checkInDate: { $gte: thirtyDaysAgo },
        status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
      }
    },
    {
      $group: {
        _id: null,
        totalBookings: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' }
      }
    }
  ]);
  
  if (bookingStats.length > 0) {
    this.statistics.totalBookingsWithFeature = bookingStats[0].totalBookings;
    this.statistics.revenueGenerated = bookingStats[0].totalRevenue;
    
    // Calculate conversion rate (bookings with feature / total bookings for these rooms)
    const totalRoomBookings = await Booking.countDocuments({
      roomId: { $in: activeRoomIds },
      checkInDate: { $gte: thirtyDaysAgo }
    });
    
    this.statistics.conversionRate = totalRoomBookings > 0 
      ? (bookingStats[0].totalBookings / totalRoomBookings) * 100 
      : 0;
  }
  
  this.statistics.lastUsedDate = new Date();
  await this.save();
};

roomFeatureSchema.methods.calculatePricing = function(nights = 1) {
  if (this.pricing.includedInBaseRate) return 0;
  
  switch (this.pricing.chargeType) {
    case 'per_night':
      return this.pricing.additionalCharge * nights;
    case 'per_stay':
    case 'one_time':
      return this.pricing.additionalCharge;
    case 'hourly':
      return this.pricing.additionalCharge * 24 * nights;
    default:
      return 0;
  }
};

roomFeatureSchema.methods.getTranslation = function(language) {
  const translation = this.localization.find(l => l.language === language);
  return translation || {
    featureName: this.featureName,
    description: this.description,
    marketingText: this.marketing.marketingDescription
  };
};

// Static methods
roomFeatureSchema.statics.getFeaturesByCategory = async function(hotelId, category) {
  return await this.find({
    hotelId,
    category,
    status: 'active'
  }).sort({ 'displaySettings.displayOrder': 1, featureName: 1 });
};

roomFeatureSchema.statics.getPremiumFeatures = async function(hotelId) {
  return await this.find({
    hotelId,
    'pricing.isPremium': true,
    status: 'active'
  }).sort({ 'pricing.additionalCharge': -1 });
};

roomFeatureSchema.statics.getFeatureHierarchy = async function(hotelId) {
  const features = await this.find({
    hotelId,
    isParentFeature: true,
    status: 'active'
  }).populate('childFeatures');
  
  return features;
};

roomFeatureSchema.statics.bulkAssignToRooms = async function(featureIds, roomIds) {
  const features = await this.find({ _id: { $in: featureIds } });
  const results = [];
  
  for (const feature of features) {
    for (const roomId of roomIds) {
      try {
        await feature.assignToRoom(roomId);
        results.push({ featureId: feature._id, roomId, success: true });
      } catch (error) {
        results.push({ featureId: feature._id, roomId, success: false, error: error.message });
      }
    }
  }
  
  return results;
};

roomFeatureSchema.statics.generateFeatureReport = async function(hotelId, options = {}) {
  const { startDate, endDate, category } = options;
  
  const matchStage = { hotelId: mongoose.Types.ObjectId(hotelId) };
  if (category) matchStage.category = category;
  if (startDate && endDate) {
    matchStage['statistics.lastUsedDate'] = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$category',
        totalFeatures: { $sum: 1 },
        activeFeatures: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
        },
        premiumFeatures: {
          $sum: { $cond: ['$pricing.isPremium', 1, 0] }
        },
        totalRevenue: { $sum: '$statistics.revenueGenerated' },
        averageRating: { $avg: '$statistics.averageRating' },
        totalBookings: { $sum: '$statistics.totalBookingsWithFeature' }
      }
    },
    { $sort: { totalRevenue: -1 } }
  ]);
};

// Note: Pagination plugin removed - implement as needed

const RoomFeature = mongoose.model('RoomFeature', roomFeatureSchema);

export default RoomFeature;
