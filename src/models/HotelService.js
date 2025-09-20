import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     HotelService:
 *       type: object
 *       required:
 *         - hotelId
 *         - name
 *         - type
 *         - description
 *         - price
 *       properties:
 *         _id:
 *           type: string
 *           description: Service ID
 *         hotelId:
 *           type: string
 *           description: Hotel ID where service is available
 *         name:
 *           type: string
 *           description: Service name
 *         description:
 *           type: string
 *           description: Detailed service description
 *         type:
 *           type: string
 *           enum: [dining, spa, gym, transport, entertainment, business, wellness, recreation]
 *           description: Service category
 *         price:
 *           type: number
 *           description: Service price
 *         currency:
 *           type: string
 *           description: Price currency (default INR)
 *         duration:
 *           type: number
 *           description: Service duration in minutes
 *         capacity:
 *           type: number
 *           description: Maximum capacity for group services
 *         isActive:
 *           type: boolean
 *           description: Whether service is currently available
 *         images:
 *           type: array
 *           items:
 *             type: string
 *           description: Service images URLs
 *         amenities:
 *           type: array
 *           items:
 *             type: string
 *           description: Available amenities
 *         operatingHours:
 *           type: object
 *           properties:
 *             open:
 *               type: string
 *               format: time
 *             close:
 *               type: string
 *               format: time
 *         location:
 *           type: string
 *           description: Service location within hotel
 *         contactInfo:
 *           type: object
 *           properties:
 *             phone:
 *               type: string
 *             email:
 *               type: string
 *         specialInstructions:
 *           type: string
 *           description: Any special instructions for guests
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const hotelServiceSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required'],
    index: true
  },
  name: {
    type: String,
    required: [true, 'Service name is required'],
    trim: true,
    maxlength: [100, 'Service name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Service description is required'],
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  type: {
    type: String,
    enum: ['dining', 'spa', 'gym', 'transport', 'entertainment', 'business', 'wellness', 'recreation'],
    required: [true, 'Service type is required'],
    index: true
  },
  price: {
    type: Number,
    required: [true, 'Service price is required'],
    min: [0, 'Price cannot be negative']
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true,
    maxlength: 3
  },
  duration: {
    type: Number,
    min: [1, 'Duration must be at least 1 minute']
  },
  capacity: {
    type: Number,
    min: [1, 'Capacity must be at least 1']
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  images: [{
    type: String,
    validate: {
      validator: function(value) {
        if (value && !value.match(/^https?:\/\/.+/)) {
          return false;
        }
        return true;
      },
      message: 'Image URL must be a valid HTTP/HTTPS URL'
    }
  }],
  amenities: [{
    type: String,
    trim: true
  }],
  operatingHours: {
    open: {
      type: String,
      match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
    },
    close: {
      type: String,
      match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
    }
  },
  location: {
    type: String,
    trim: true,
    maxlength: [200, 'Location cannot exceed 200 characters']
  },
  contactInfo: {
    phone: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      validate: {
        validator: function(value) {
          if (value && !value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            return false;
          }
          return true;
        },
        message: 'Invalid email format'
      }
    }
  },
  specialInstructions: {
    type: String,
    maxlength: [500, 'Special instructions cannot exceed 500 characters']
  },
  tags: [{
    type: String,
    trim: true
  }],
  featured: {
    type: Boolean,
    default: false,
    index: true
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  // Staff Assignment Fields
  assignedStaff: [{
    staffId: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['manager', 'supervisor', 'attendant', 'specialist'],
      default: 'attendant'
    },
    primaryContact: {
      type: Boolean,
      default: false
    },
    assignedAt: {
      type: Date,
      default: Date.now
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  staffRequirements: {
    minimumStaff: {
      type: Number,
      default: 1,
      min: 0
    },
    requiredSkills: [{
      type: String,
      trim: true
    }],
    workingHours: {
      type: String,
      enum: ['full_time', 'part_time', 'on_demand', 'scheduled'],
      default: 'on_demand'
    }
  },
  serviceSettings: {
    autoAssignRequests: {
      type: Boolean,
      default: true
    },
    allowMultipleAssignments: {
      type: Boolean,
      default: false
    },
    notificationSettings: {
      emailNotifications: {
        type: Boolean,
        default: true
      },
      pushNotifications: {
        type: Boolean,
        default: true
      },
      smsNotifications: {
        type: Boolean,
        default: false
      }
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
hotelServiceSchema.index({ hotelId: 1, type: 1, isActive: 1 });
hotelServiceSchema.index({ hotelId: 1, featured: 1 });
hotelServiceSchema.index({ type: 1, isActive: 1 });
hotelServiceSchema.index({ 'rating.average': -1 });

// Virtual for formatted price
hotelServiceSchema.virtual('formattedPrice').get(function() {
  return `${this.currency} ${this.price.toLocaleString()}`;
});

// Virtual for duration display
hotelServiceSchema.virtual('durationDisplay').get(function() {
  if (!this.duration) return null;
  
  const hours = Math.floor(this.duration / 60);
  const minutes = this.duration % 60;
  
  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${minutes}m`;
  }
});

// Virtual for operating hours display
hotelServiceSchema.virtual('operatingHoursDisplay').get(function() {
  if (!this.operatingHours?.open || !this.operatingHours?.close) {
    return 'Contact for hours';
  }
  return `${this.operatingHours.open} - ${this.operatingHours.close}`;
});

// Static method to get services by type
hotelServiceSchema.statics.getServicesByType = async function(hotelId, type) {
  return await this.find({
    hotelId,
    type,
    isActive: true
  }).sort({ featured: -1, 'rating.average': -1 });
};

// Static method to get featured services
hotelServiceSchema.statics.getFeaturedServices = async function(hotelId) {
  return await this.find({
    hotelId,
    featured: true,
    isActive: true
  }).sort({ 'rating.average': -1 });
};

// Static method to search services
hotelServiceSchema.statics.searchServices = async function(hotelId, searchTerm) {
  const regex = new RegExp(searchTerm, 'i');
  
  return await this.find({
    hotelId,
    isActive: true,
    $or: [
      { name: regex },
      { description: regex },
      { tags: regex }
    ]
  }).sort({ featured: -1, 'rating.average': -1 });
};

// Instance method to update rating
hotelServiceSchema.methods.updateRating = async function(newRating) {
  const totalRating = this.rating.average * this.rating.count + newRating;
  this.rating.count += 1;
  this.rating.average = totalRating / this.rating.count;
  return await this.save();
};

// Staff Management Methods

// Assign staff member to service
hotelServiceSchema.methods.assignStaff = function(staffId, role = 'attendant', isPrimary = false) {
  // Check if staff is already assigned
  const existingAssignment = this.assignedStaff.find(
    assignment => assignment.staffId.toString() === staffId.toString() && assignment.isActive
  );

  if (existingAssignment) {
    // Update existing assignment
    existingAssignment.role = role;
    existingAssignment.primaryContact = isPrimary;
    return this;
  }

  // If setting as primary, remove primary from others
  if (isPrimary) {
    this.assignedStaff.forEach(assignment => {
      assignment.primaryContact = false;
    });
  }

  // Add new assignment
  this.assignedStaff.push({
    staffId,
    role,
    primaryContact: isPrimary,
    isActive: true
  });

  return this;
};

// Remove staff assignment
hotelServiceSchema.methods.unassignStaff = function(staffId) {
  const assignment = this.assignedStaff.find(
    assignment => assignment.staffId.toString() === staffId.toString()
  );

  if (assignment) {
    assignment.isActive = false;
  }

  return this;
};

// Get active assigned staff
hotelServiceSchema.methods.getActiveStaff = function() {
  return this.assignedStaff.filter(assignment => assignment.isActive);
};

// Get primary contact staff
hotelServiceSchema.methods.getPrimaryContact = function() {
  return this.assignedStaff.find(
    assignment => assignment.isActive && assignment.primaryContact
  );
};

// Check if service has adequate staffing
hotelServiceSchema.methods.hasAdequateStaffing = function() {
  const activeStaff = this.getActiveStaff();
  return activeStaff.length >= (this.staffRequirements?.minimumStaff || 1);
};

// Static method to get services assigned to staff member
hotelServiceSchema.statics.getServicesForStaff = async function(staffId, hotelId) {
  return await this.find({
    hotelId,
    'assignedStaff.staffId': staffId,
    'assignedStaff.isActive': true,
    isActive: true
  }).populate('assignedStaff.staffId', 'name email department');
};

// Pre-save middleware to validate operating hours
hotelServiceSchema.pre('save', function(next) {
  if (this.operatingHours?.open && this.operatingHours?.close) {
    const openTime = new Date(`2000-01-01 ${this.operatingHours.open}`);
    const closeTime = new Date(`2000-01-01 ${this.operatingHours.close}`);
    
    if (openTime >= closeTime) {
      return next(new Error('Close time must be after open time'));
    }
  }
  
  next();
});

export default mongoose.model('HotelService', hotelServiceSchema);
