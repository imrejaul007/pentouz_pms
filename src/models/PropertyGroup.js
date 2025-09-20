import mongoose from 'mongoose';

const propertyGroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Property group name is required'],
    trim: true,
    maxlength: [100, 'Property group name cannot exceed 100 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  groupType: {
    type: String,
    enum: ['chain', 'franchise', 'management_company', 'independent'],
    required: true,
    default: 'chain'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  ownerId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Group configuration
  settings: {
    // Centralized booking policies
    defaultCancellationPolicy: {
      type: String,
      default: '24 hours before check-in'
    },
    defaultChildPolicy: {
      type: String,
      default: 'Children under 12 stay free'
    },
    defaultPetPolicy: {
      type: String,
      default: 'Pets not allowed'
    },
    
    // Financial settings
    baseCurrency: {
      type: String,
      default: 'USD'
    },
    supportedCurrencies: [{
      type: String
    }],
    
    // Operational settings
    timezone: {
      type: String,
      default: 'UTC'
    },
    dateFormat: {
      type: String,
      default: 'YYYY-MM-DD'
    },
    
    // Brand settings
    brandGuidelines: {
      primaryColor: String,
      secondaryColor: String,
      logoUrl: String,
      websiteUrl: String
    },
    
    // Communication settings
    defaultLanguage: {
      type: String,
      default: 'en'
    },
    supportedLanguages: [{
      type: String
    }],
    
    // Integration settings
    centralizedRates: {
      type: Boolean,
      default: false
    },
    centralizedInventory: {
      type: Boolean,
      default: false
    },
    sharedGuestDatabase: {
      type: Boolean,
      default: true
    },
    
    // Centralized Rate Management Settings
    rateManagement: {
      autoSync: { type: Boolean, default: true },
      syncFrequency: {
        type: String,
        enum: ['real_time', 'hourly', 'daily', 'weekly', 'manual'],
        default: 'daily'
      },
      allowPropertyOverrides: { type: Boolean, default: true },
      requireApproval: { type: Boolean, default: false },
      conflictResolution: {
        type: String,
        enum: ['centralized_wins', 'property_wins', 'manual_resolve', 'alert_only'],
        default: 'alert_only'
      }
    },
    
    // Reporting settings
    consolidatedReporting: {
      type: Boolean,
      default: true
    },
    reportingHierarchy: {
      type: String,
      enum: ['centralized', 'distributed', 'hybrid'],
      default: 'centralized'
    }
  },
  
  // Group permissions and access control
  permissions: {
    allowCrossPropertyBookings: {
      type: Boolean,
      default: true
    },
    allowCrossPropertyTransfers: {
      type: Boolean,
      default: true
    },
    allowSharedStaff: {
      type: Boolean,
      default: false
    },
    allowSharedInventory: {
      type: Boolean,
      default: false
    },
    allowConsolidatedBilling: {
      type: Boolean,
      default: false
    }
  },
  
  // Contact information
  contact: {
    corporateAddress: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String
    },
    phone: String,
    email: {
      type: String,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    website: String
  },
  
  // Business information
  businessInfo: {
    registrationNumber: String,
    taxId: String,
    businessType: {
      type: String,
      enum: ['corporation', 'llc', 'partnership', 'sole_proprietorship'],
      default: 'corporation'
    },
    establishedYear: Number
  },
  
  // Statistics and metrics
  metrics: {
    totalProperties: {
      type: Number,
      default: 0
    },
    totalRooms: {
      type: Number,
      default: 0
    },
    averageOccupancyRate: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    },
    activeUsers: {
      type: Number,
      default: 0
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  
  // Integration configurations
  integrations: {
    centralReservationSystem: {
      isEnabled: {
        type: Boolean,
        default: false
      },
      provider: String,
      configuration: mongoose.Schema.Types.Mixed
    },
    propertyManagementSystem: {
      isEnabled: {
        type: Boolean,
        default: false
      },
      provider: String,
      configuration: mongoose.Schema.Types.Mixed
    },
    channelManager: {
      isEnabled: {
        type: Boolean,
        default: false
      },
      provider: String,
      configuration: mongoose.Schema.Types.Mixed
    },
    accountingSystem: {
      isEnabled: {
        type: Boolean,
        default: false
      },
      provider: String,
      configuration: mongoose.Schema.Types.Mixed
    }
  },
  
  // Audit trail
  auditLog: [{
    action: {
      type: String,
      required: true
    },
    performedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true
    },
    performedAt: {
      type: Date,
      default: Date.now
    },
    changes: mongoose.Schema.Types.Mixed,
    ipAddress: String
  }]
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
propertyGroupSchema.index({ ownerId: 1, status: 1 });
propertyGroupSchema.index({ groupType: 1, status: 1 });
propertyGroupSchema.index({ name: 'text', description: 'text' });
propertyGroupSchema.index({ 'contact.email': 1 });
propertyGroupSchema.index({ createdAt: -1 });

// Virtual for properties in this group
propertyGroupSchema.virtual('properties', {
  ref: 'Hotel',
  localField: '_id',
  foreignField: 'propertyGroupId'
});

// Virtual for property count
propertyGroupSchema.virtual('propertyCount', {
  ref: 'Hotel',
  localField: '_id',
  foreignField: 'propertyGroupId',
  count: true
});

// Methods
propertyGroupSchema.methods.addAuditEntry = function(action, performedBy, changes, ipAddress) {
  this.auditLog.push({
    action,
    performedBy,
    changes,
    ipAddress
  });
  
  // Keep only last 100 audit entries
  if (this.auditLog.length > 100) {
    this.auditLog = this.auditLog.slice(-100);
  }
  
  return this.save();
};

propertyGroupSchema.methods.updateMetrics = async function() {
  const Hotel = mongoose.model('Hotel');
  const User = mongoose.model('User');
  
  try {
    // Count properties in this group
    const propertyStats = await Hotel.aggregate([
      { $match: { propertyGroupId: this._id, isActive: true } },
      {
        $group: {
          _id: null,
          totalProperties: { $sum: 1 }
        }
      }
    ]);

    // Get property IDs for this group
    const propertyIds = await Hotel.find({ propertyGroupId: this._id, isActive: true }).distinct('_id');

    // Count total rooms for all properties in this group
    const Room = mongoose.model('Room');
    const totalRooms = await Room.countDocuments({ hotelId: { $in: propertyIds } });

    // Count active users
    const userCount = await User.countDocuments({ propertyGroupId: this._id, isActive: true });

    // Calculate revenue from bookings
    const Booking = mongoose.model('Booking');
    const revenueStats = await Booking.aggregate([
      {
        $match: {
          hotelId: { $in: propertyIds },
          status: { $in: ['confirmed', 'checked_in', 'checked_out'] },
          checkIn: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalBookings: { $sum: 1 }
        }
      }
    ]);

    // Update metrics
    if (propertyStats.length > 0) {
      this.metrics.totalProperties = propertyStats[0].totalProperties;
    }
    this.metrics.totalRooms = totalRooms;

    if (revenueStats.length > 0) {
      this.metrics.totalRevenue = revenueStats[0].totalRevenue || 0;
      this.metrics.averageOccupancyRate = this.metrics.totalRooms > 0 ?
        (revenueStats[0].totalBookings / this.metrics.totalRooms) * 100 : 0;
    }
    
    this.metrics.activeUsers = userCount;
    this.metrics.lastUpdated = new Date();
    
    await this.save();
    
  } catch (error) {
    console.error('Error updating property group metrics:', error);
  }
};

// Static methods
propertyGroupSchema.statics.findByOwner = function(ownerId, options = {}) {
  const { status = 'active', includeProperties = false } = options;
  
  let query = this.find({ ownerId, status });
  
  if (includeProperties) {
    query = query.populate('properties');
  }
  
  return query.sort({ createdAt: -1 });
};

propertyGroupSchema.statics.getGroupStats = async function(groupId) {
  const group = await this.findById(groupId);
  if (!group) {
    throw new Error('Property group not found');
  }
  
  const Hotel = mongoose.model('Hotel');
  const Booking = mongoose.model('Booking');
  
  // Get properties in this group
  const properties = await Hotel.find({ propertyGroupId: groupId, isActive: true });
  const propertyIds = properties.map(p => p._id);
  
  // Calculate stats
  const stats = await Promise.all([
    // Total bookings across all properties
    Booking.countDocuments({ hotelId: { $in: propertyIds } }),
    
    // Revenue stats (last 30 days)
    Booking.aggregate([
      {
        $match: {
          hotelId: { $in: propertyIds },
          status: 'completed',
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalBookings: { $sum: 1 }
        }
      }
    ])
  ]);
  
  return {
    group: group.toObject(),
    properties: properties.length,
    totalBookings: stats[0],
    monthlyRevenue: stats[1][0]?.totalRevenue || 0,
    monthlyBookings: stats[1][0]?.totalBookings || 0
  };
};

// Pre-save middleware
propertyGroupSchema.pre('save', function(next) {
  if (this.isModified('settings') || this.isModified('permissions')) {
    this.metrics.lastUpdated = new Date();
  }
  next();
});

// Post-save middleware to update related properties
propertyGroupSchema.post('save', async function(doc) {
  if (this.isModified('settings')) {
    const Hotel = mongoose.model('Hotel');
    
    // Update all properties in this group with new settings
    await Hotel.updateMany(
      { propertyGroupId: doc._id },
      { 
        $set: { 
          'groupSettings.lastSyncAt': new Date(),
          'groupSettings.version': doc.updatedAt
        } 
      }
    );
  }
});

export default mongoose.model('PropertyGroup', propertyGroupSchema);
