import mongoose from 'mongoose';

const sharedResourceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Resource name is required'],
    trim: true,
    maxlength: [100, 'Resource name cannot exceed 100 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  type: {
    type: String,
    enum: [
      'staff', 
      'equipment', 
      'inventory', 
      'vehicle', 
      'facility', 
      'service',
      'digital_asset',
      'other'
    ],
    required: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  
  // Resource ownership and sharing
  ownerPropertyId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  propertyGroupId: {
    type: mongoose.Schema.ObjectId,
    ref: 'PropertyGroup',
    required: true,
    index: true
  },
  
  // Sharing configuration
  sharingPolicy: {
    type: String,
    enum: ['open', 'request_approval', 'restricted', 'emergency_only'],
    default: 'request_approval'
  },
  sharedWith: [{
    propertyId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Hotel',
      required: true
    },
    permissions: {
      type: [String],
      enum: ['view', 'book', 'modify', 'transfer'],
      default: ['view', 'book']
    },
    approvedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    status: {
      type: String,
      enum: ['active', 'suspended', 'revoked'],
      default: 'active'
    }
  }],
  
  // Resource details based on type
  resourceDetails: {
    // For staff resources
    staff: {
      employeeId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      department: String,
      skills: [String],
      certifications: [String],
      hourlyRate: Number,
      availability: {
        monday: { start: String, end: String },
        tuesday: { start: String, end: String },
        wednesday: { start: String, end: String },
        thursday: { start: String, end: String },
        friday: { start: String, end: String },
        saturday: { start: String, end: String },
        sunday: { start: String, end: String }
      }
    },
    
    // For equipment resources
    equipment: {
      model: String,
      manufacturer: String,
      serialNumber: String,
      purchaseDate: Date,
      warrantyExpiry: Date,
      maintenanceSchedule: String,
      operatingCost: Number,
      specifications: mongoose.Schema.Types.Mixed
    },
    
    // For inventory resources
    inventory: {
      stockKeepingUnit: String,
      currentStock: Number,
      minimumStock: Number,
      unitCost: Number,
      supplier: String,
      expiryDate: Date,
      storageRequirements: String
    },
    
    // For vehicle resources
    vehicle: {
      make: String,
      model: String,
      year: Number,
      licensePlate: String,
      capacity: Number,
      fuelType: String,
      insuranceExpiry: Date,
      maintenanceSchedule: String,
      operatingCost: Number
    },
    
    // For facility resources
    facility: {
      location: String,
      capacity: Number,
      amenities: [String],
      hourlyRate: Number,
      setupTime: Number, // minutes
      cleanupTime: Number, // minutes
      restrictions: [String]
    },
    
    // For service resources
    service: {
      serviceProvider: String,
      serviceType: String,
      cost: Number,
      duration: Number, // minutes
      requirements: [String],
      contact: {
        name: String,
        phone: String,
        email: String
      }
    }
  },
  
  // Availability and scheduling
  availability: {
    status: {
      type: String,
      enum: ['available', 'in_use', 'maintenance', 'unavailable'],
      default: 'available'
    },
    currentlyUsedBy: {
      propertyId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Hotel'
      },
      userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      startTime: Date,
      estimatedEndTime: Date,
      actualEndTime: Date
    },
    schedule: [{
      propertyId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Hotel',
        required: true
      },
      userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
      },
      startDate: {
        type: Date,
        required: true
      },
      endDate: {
        type: Date,
        required: true
      },
      purpose: String,
      status: {
        type: String,
        enum: ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled'],
        default: 'scheduled'
      },
      notes: String
    }]
  },
  
  // Usage tracking
  usageHistory: [{
    propertyId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Hotel',
      required: true
    },
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true
    },
    startTime: {
      type: Date,
      required: true
    },
    endTime: Date,
    duration: Number, // minutes
    cost: Number,
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: String,
    status: {
      type: String,
      enum: ['completed', 'cancelled', 'no_show'],
      default: 'completed'
    }
  }],
  
  // Financial tracking
  costSharing: {
    model: {
      type: String,
      enum: ['equal_split', 'usage_based', 'owner_pays', 'custom'],
      default: 'usage_based'
    },
    baseCost: Number, // per hour or per use
    additionalCosts: [{
      name: String,
      amount: Number,
      type: {
        type: String,
        enum: ['fixed', 'percentage', 'per_hour', 'per_use']
      }
    }],
    billingFrequency: {
      type: String,
      enum: ['immediate', 'daily', 'weekly', 'monthly'],
      default: 'monthly'
    }
  },
  
  // Maintenance and condition
  condition: {
    status: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'poor', 'needs_repair'],
      default: 'good'
    },
    lastInspection: Date,
    nextInspection: Date,
    maintenanceLog: [{
      date: Date,
      type: {
        type: String,
        enum: ['routine', 'repair', 'upgrade', 'inspection']
      },
      description: String,
      cost: Number,
      performedBy: String,
      propertyId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Hotel'
      }
    }]
  },
  
  // Location and logistics
  location: {
    currentPropertyId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Hotel',
      required: true
    },
    specificLocation: String, // Room, department, etc.
    isPortable: {
      type: Boolean,
      default: false
    },
    transportationCost: Number,
    transportationTime: Number // minutes
  },
  
  // Approval workflow
  approvalWorkflow: [{
    requestingPropertyId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Hotel'
    },
    requestedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    requestedAt: Date,
    requestType: {
      type: String,
      enum: ['access', 'booking', 'transfer', 'modification']
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'expired'],
      default: 'pending'
    },
    approvedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    rejectionReason: String,
    expiresAt: Date
  }],
  
  // Metadata
  tags: [String],
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
sharedResourceSchema.index({ ownerPropertyId: 1, type: 1 });
sharedResourceSchema.index({ propertyGroupId: 1, sharingPolicy: 1 });
sharedResourceSchema.index({ type: 1, category: 1, isActive: 1 });
sharedResourceSchema.index({ 'sharedWith.propertyId': 1, 'sharedWith.status': 1 });
sharedResourceSchema.index({ 'availability.status': 1, isActive: 1 });
sharedResourceSchema.index({ 'location.currentPropertyId': 1, isActive: 1 });
sharedResourceSchema.index({ createdAt: -1 });

// Text index for search
sharedResourceSchema.index({
  name: 'text',
  description: 'text',
  category: 'text',
  tags: 'text'
});

// Virtual for current usage
sharedResourceSchema.virtual('currentUsage', function() {
  if (this.availability.status === 'in_use' && this.availability.currentlyUsedBy) {
    return this.availability.currentlyUsedBy;
  }
  return null;
});

// Virtual for upcoming bookings
sharedResourceSchema.virtual('upcomingBookings', function() {
  const now = new Date();
  return this.availability.schedule.filter(booking => 
    booking.startDate > now && 
    booking.status !== 'cancelled'
  ).sort((a, b) => a.startDate - b.startDate);
});

// Virtual for usage statistics
sharedResourceSchema.virtual('usageStats', function() {
  const history = this.usageHistory;
  const totalUsages = history.length;
  const totalDuration = history.reduce((sum, usage) => sum + (usage.duration || 0), 0);
  const averageRating = history.length > 0 
    ? history.reduce((sum, usage) => sum + (usage.rating || 0), 0) / history.length 
    : 0;
  
  return {
    totalUsages,
    totalDuration,
    averageRating: Math.round(averageRating * 10) / 10,
    averageDuration: totalUsages > 0 ? Math.round(totalDuration / totalUsages) : 0
  };
});

// Methods
sharedResourceSchema.methods.canBeAccessedBy = function(propertyId, permission = 'view') {
  // Owner property always has access
  if (this.ownerPropertyId.toString() === propertyId.toString()) {
    return true;
  }
  
  // Check sharing policy
  if (this.sharingPolicy === 'restricted') {
    return false;
  }
  
  if (this.sharingPolicy === 'open') {
    return true;
  }
  
  // Check if property has explicit access
  const shareEntry = this.sharedWith.find(share => 
    share.propertyId.toString() === propertyId.toString() &&
    share.status === 'active'
  );
  
  if (shareEntry) {
    return shareEntry.permissions.includes(permission);
  }
  
  return false;
};

sharedResourceSchema.methods.addUsageEntry = function(propertyId, userId, startTime, endTime, options = {}) {
  const duration = endTime ? Math.round((endTime.getTime() - startTime.getTime()) / 60000) : null;
  
  this.usageHistory.push({
    propertyId,
    userId,
    startTime,
    endTime,
    duration,
    cost: options.cost || 0,
    rating: options.rating,
    feedback: options.feedback,
    status: options.status || 'completed'
  });
  
  // Update availability if this was current usage
  if (this.availability.currentlyUsedBy && 
      this.availability.currentlyUsedBy.propertyId.toString() === propertyId.toString()) {
    this.availability.currentlyUsedBy = null;
    this.availability.status = 'available';
  }
  
  return this.save();
};

sharedResourceSchema.methods.scheduleUsage = function(propertyId, userId, startDate, endDate, purpose, notes) {
  // Check for conflicts
  const conflicts = this.availability.schedule.filter(booking => 
    booking.status !== 'cancelled' &&
    ((startDate >= booking.startDate && startDate < booking.endDate) ||
     (endDate > booking.startDate && endDate <= booking.endDate) ||
     (startDate <= booking.startDate && endDate >= booking.endDate))
  );
  
  if (conflicts.length > 0) {
    throw new Error('Resource is already scheduled for the requested time period');
  }
  
  this.availability.schedule.push({
    propertyId,
    userId,
    startDate,
    endDate,
    purpose,
    notes,
    status: 'scheduled'
  });
  
  return this.save();
};

sharedResourceSchema.methods.requestAccess = function(requestingPropertyId, requestedBy, requestType) {
  const existingRequest = this.approvalWorkflow.find(request =>
    request.requestingPropertyId.toString() === requestingPropertyId.toString() &&
    request.requestType === requestType &&
    request.status === 'pending'
  );
  
  if (existingRequest) {
    throw new Error('A similar request is already pending');
  }
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days
  
  this.approvalWorkflow.push({
    requestingPropertyId,
    requestedBy,
    requestedAt: new Date(),
    requestType,
    status: 'pending',
    expiresAt
  });
  
  return this.save();
};

// Static methods
sharedResourceSchema.statics.findByPropertyGroup = function(propertyGroupId, options = {}) {
  const { type, category, status = 'active', availableOnly = false } = options;
  
  let query = this.find({ 
    propertyGroupId, 
    isActive: status === 'active' 
  });
  
  if (type) {
    query = query.where('type', type);
  }
  
  if (category) {
    query = query.where('category', category);
  }
  
  if (availableOnly) {
    query = query.where('availability.status', 'available');
  }
  
  return query.populate('ownerPropertyId', 'name address.city')
              .populate('location.currentPropertyId', 'name')
              .sort({ createdAt: -1 });
};

sharedResourceSchema.statics.findAccessibleByProperty = function(propertyId, options = {}) {
  const { type, category, availableOnly = false } = options;
  
  let matchQuery = {
    isActive: true,
    $or: [
      { ownerPropertyId: propertyId },
      { sharingPolicy: 'open' },
      { 
        sharedWith: {
          $elemMatch: {
            propertyId: propertyId,
            status: 'active'
          }
        }
      }
    ]
  };
  
  if (type) {
    matchQuery.type = type;
  }
  
  if (category) {
    matchQuery.category = category;
  }
  
  if (availableOnly) {
    matchQuery['availability.status'] = 'available';
  }
  
  return this.find(matchQuery)
             .populate('ownerPropertyId', 'name address.city')
             .populate('location.currentPropertyId', 'name')
             .sort({ createdAt: -1 });
};

sharedResourceSchema.statics.getUsageReport = async function(propertyGroupId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        propertyGroupId: new mongoose.Types.ObjectId(propertyGroupId),
        'usageHistory.startTime': {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $unwind: '$usageHistory'
    },
    {
      $match: {
        'usageHistory.startTime': {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: {
          resourceId: '$_id',
          resourceName: '$name',
          resourceType: '$type',
          usingProperty: '$usageHistory.propertyId'
        },
        totalUsages: { $sum: 1 },
        totalDuration: { $sum: '$usageHistory.duration' },
        totalCost: { $sum: '$usageHistory.cost' },
        averageRating: { $avg: '$usageHistory.rating' }
      }
    },
    {
      $lookup: {
        from: 'hotels',
        localField: '_id.usingProperty',
        foreignField: '_id',
        as: 'propertyInfo'
      }
    },
    {
      $project: {
        resourceId: '$_id.resourceId',
        resourceName: '$_id.resourceName',
        resourceType: '$_id.resourceType',
        usingPropertyName: { $arrayElemAt: ['$propertyInfo.name', 0] },
        totalUsages: 1,
        totalDuration: 1,
        totalCost: 1,
        averageRating: { $round: ['$averageRating', 1] }
      }
    },
    {
      $sort: { totalUsages: -1 }
    }
  ]);
};

export default mongoose.model('SharedResource', sharedResourceSchema);
