import mongoose from 'mongoose';

const hotelAreaSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  
  // Basic Information
  areaName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  
  areaCode: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    maxlength: 20,
    match: /^[A-Z0-9_-]+$/
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Area Type and Hierarchy
  areaType: {
    type: String,
    required: true,
    enum: ['building', 'wing', 'floor', 'section', 'block', 'tower', 'annex', 'pavilion'],
    index: true
  },
  
  parentAreaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HotelArea',
    default: null
  },
  
  hierarchyLevel: {
    type: Number,
    default: 0,
    min: 0,
    max: 10
  },
  
  fullPath: {
    type: String,
    default: ''
  },
  
  // Physical Properties
  floorNumber: {
    type: Number,
    default: null
  },
  
  totalRooms: {
    type: Number,
    default: 0,
    min: 0
  },
  
  availableRooms: {
    type: Number,
    default: 0,
    min: 0
  },
  
  totalSqft: {
    type: Number,
    default: null,
    min: 0
  },
  
  // Location and Access
  location: {
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    },
    directions: String
  },
  
  accessPoints: [{
    name: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['main_entrance', 'side_entrance', 'emergency_exit', 'service_entrance', 'elevator', 'stairs'],
      required: true
    },
    description: String,
    keyCardRequired: {
      type: Boolean,
      default: false
    },
    accessHours: {
      start: String, // 24-hour format: "06:00"
      end: String,   // 24-hour format: "22:00"
      allDay: {
        type: Boolean,
        default: true
      }
    }
  }],
  
  // Amenities and Features
  amenities: [{
    type: String,
    enum: [
      'elevator', 'stairs', 'handicap_accessible', 'vending_machines',
      'ice_machines', 'laundry', 'fitness_center', 'business_center',
      'meeting_rooms', 'restaurant', 'bar', 'pool', 'spa', 'parking',
      'wifi', 'concierge', 'room_service', 'housekeeping_station',
      'maintenance_room', 'storage', 'gift_shop', 'atm', 'safe_deposit'
    ]
  }],
  
  specialFeatures: [{
    name: String,
    description: String
  }],
  
  // Operational Information
  status: {
    type: String,
    enum: ['active', 'inactive', 'under_renovation', 'under_construction', 'closed'],
    default: 'active',
    index: true
  },
  
  operationalHours: {
    monday: { start: String, end: String, closed: Boolean },
    tuesday: { start: String, end: String, closed: Boolean },
    wednesday: { start: String, end: String, closed: Boolean },
    thursday: { start: String, end: String, closed: Boolean },
    friday: { start: String, end: String, closed: Boolean },
    saturday: { start: String, end: String, closed: Boolean },
    sunday: { start: String, end: String, closed: Boolean },
    allDay: {
      type: Boolean,
      default: true
    }
  },
  
  // Staff Assignment
  assignedStaff: [{
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['manager', 'supervisor', 'housekeeping', 'maintenance', 'security', 'concierge']
    },
    shift: {
      type: String,
      enum: ['morning', 'afternoon', 'evening', 'night', 'all_day']
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  
  // Room Configuration
  roomTypeDistribution: [{
    roomTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RoomType'
    },
    count: {
      type: Number,
      default: 0
    },
    availableCount: {
      type: Number,
      default: 0
    }
  }],
  
  roomNumberRange: {
    startNumber: Number,
    endNumber: Number,
    prefix: String,
    suffix: String
  },
  
  // Security and Access Control
  securitySettings: {
    requiresKeyCard: {
      type: Boolean,
      default: false
    },
    accessLevels: [{
      level: {
        type: String,
        enum: ['guest', 'staff', 'manager', 'admin', 'security', 'maintenance']
      },
      permissions: [String]
    }],
    cameraCount: {
      type: Number,
      default: 0
    },
    alarmSystem: {
      type: Boolean,
      default: false
    }
  },
  
  // Emergency Information
  emergencyInfo: {
    evacuationRoutes: [{
      name: String,
      description: String,
      mapImageUrl: String
    }],
    emergencyContacts: [{
      name: String,
      role: String,
      phone: String,
      extension: String
    }],
    fireSafetyEquipment: [{
      type: {
        type: String,
        enum: ['fire_extinguisher', 'smoke_detector', 'sprinkler', 'fire_alarm', 'emergency_light']
      },
      location: String,
      lastInspection: Date,
      nextInspection: Date
    }]
  },
  
  // Maintenance and Utilities
  maintenanceInfo: {
    hvacZone: String,
    electricalPanel: String,
    plumbingZone: String,
    wifiZone: String,
    lastDeepCleaning: Date,
    nextDeepCleaning: Date,
    maintenanceSchedule: [{
      task: String,
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'quarterly', 'annually']
      },
      lastCompleted: Date,
      nextDue: Date,
      assignedTo: String
    }]
  },
  
  // Display and UI Settings
  displaySettings: {
    color: {
      type: String,
      default: '#3B82F6'
    },
    icon: {
      type: String,
      default: 'building'
    },
    displayOrder: {
      type: Number,
      default: 0
    },
    showInPublicAreas: {
      type: Boolean,
      default: true
    },
    mapCoordinates: {
      x: Number,
      y: Number
    }
  },
  
  // Analytics and Statistics
  statistics: {
    averageOccupancy: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    averageRate: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    },
    guestSatisfactionScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 10
    },
    maintenanceRequestCount: {
      type: Number,
      default: 0
    },
    lastUpdatedStats: {
      type: Date,
      default: Date.now
    }
  },
  
  // Notes and Comments
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
    approvedAt: {
      type: Date
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for performance
hotelAreaSchema.index({ hotelId: 1, areaCode: 1 }, { unique: true });
hotelAreaSchema.index({ hotelId: 1, areaType: 1, status: 1 });
hotelAreaSchema.index({ hotelId: 1, parentAreaId: 1 });
hotelAreaSchema.index({ hotelId: 1, hierarchyLevel: 1, displaySettings: 1 });

// Virtual fields
hotelAreaSchema.virtual('occupancyRate').get(function() {
  return this.totalRooms > 0 ? ((this.totalRooms - this.availableRooms) / this.totalRooms) * 100 : 0;
});

hotelAreaSchema.virtual('children', {
  ref: 'HotelArea',
  localField: '_id',
  foreignField: 'parentAreaId'
});

hotelAreaSchema.virtual('parent', {
  ref: 'HotelArea',
  localField: 'parentAreaId',
  foreignField: '_id',
  justOne: true
});

hotelAreaSchema.virtual('rooms', {
  ref: 'Room',
  localField: '_id',
  foreignField: 'hotelAreaId'
});

// Pre-save middleware
hotelAreaSchema.pre('save', async function(next) {
  if (this.isModified('parentAreaId') || this.isModified('areaName')) {
    await this.updateHierarchy();
  }
  
  if (this.isModified('areaCode')) {
    // Check for duplicate area codes within the hotel
    const existing = await this.constructor.findOne({
      hotelId: this.hotelId,
      areaCode: this.areaCode,
      _id: { $ne: this._id }
    });
    
    if (existing) {
      throw new Error('Area code already exists in this hotel');
    }
  }
  
  next();
});

// Instance methods
hotelAreaSchema.methods.updateHierarchy = async function() {
  let level = 0;
  let path = this.areaName;
  let currentParentId = this.parentAreaId;
  
  // Calculate hierarchy level and full path
  while (currentParentId && level < 10) {
    const parent = await this.constructor.findById(currentParentId);
    if (!parent) break;
    
    level++;
    path = `${parent.areaName} > ${path}`;
    currentParentId = parent.parentAreaId;
  }
  
  this.hierarchyLevel = level;
  this.fullPath = path;
};

hotelAreaSchema.methods.updateRoomCounts = async function() {
  const Room = mongoose.model('Room');
  
  const counts = await Room.aggregate([
    { $match: { hotelAreaId: this._id } },
    {
      $group: {
        _id: null,
        totalRooms: { $sum: 1 },
        availableRooms: {
          $sum: {
            $cond: [{ $eq: ['$status', 'available'] }, 1, 0]
          }
        }
      }
    }
  ]);
  
  if (counts.length > 0) {
    this.totalRooms = counts[0].totalRooms;
    this.availableRooms = counts[0].availableRooms;
  } else {
    this.totalRooms = 0;
    this.availableRooms = 0;
  }
  
  await this.save();
};

hotelAreaSchema.methods.getHierarchyTree = async function() {
  const children = await this.constructor.find({
    parentAreaId: this._id,
    status: { $in: ['active', 'under_renovation'] }
  }).sort({ 'displaySettings.displayOrder': 1, areaName: 1 });
  
  const tree = {
    ...this.toObject(),
    children: []
  };
  
  for (const child of children) {
    tree.children.push(await child.getHierarchyTree());
  }
  
  return tree;
};

hotelAreaSchema.methods.updateStatistics = async function() {
  const Room = mongoose.model('Room');
  const Booking = mongoose.model('Booking');
  
  // Get room IDs in this area
  const rooms = await Room.find({ hotelAreaId: this._id }).select('_id');
  const roomIds = rooms.map(r => r._id);
  
  if (roomIds.length === 0) {
    this.statistics = {
      ...this.statistics,
      averageOccupancy: 0,
      averageRate: 0,
      totalRevenue: 0,
      lastUpdatedStats: new Date()
    };
    return;
  }
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // Calculate statistics from bookings
  const stats = await Booking.aggregate([
    {
      $match: {
        roomId: { $in: roomIds },
        checkInDate: { $gte: thirtyDaysAgo },
        status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
      }
    },
    {
      $group: {
        _id: null,
        totalBookings: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        averageRate: { $avg: '$roomRate' },
        totalNights: { $sum: { $divide: [{ $subtract: ['$checkOutDate', '$checkInDate'] }, 86400000] } }
      }
    }
  ]);
  
  if (stats.length > 0) {
    const stat = stats[0];
    const occupancyRate = (stat.totalNights / (roomIds.length * 30)) * 100;
    
    this.statistics = {
      ...this.statistics,
      averageOccupancy: Math.min(occupancyRate, 100),
      averageRate: stat.averageRate || 0,
      totalRevenue: stat.totalRevenue || 0,
      lastUpdatedStats: new Date()
    };
  }
};

// Static methods
hotelAreaSchema.statics.getAreaHierarchy = async function(hotelId, rootAreaId = null) {
  const areas = await this.find({
    hotelId,
    parentAreaId: rootAreaId,
    status: { $in: ['active', 'under_renovation'] }
  }).sort({ 'displaySettings.displayOrder': 1, areaName: 1 });
  
  const hierarchy = [];
  for (const area of areas) {
    const children = await this.getAreaHierarchy(hotelId, area._id);
    hierarchy.push({
      ...area.toObject(),
      children
    });
  }
  
  return hierarchy;
};

hotelAreaSchema.statics.bulkUpdateStatus = async function(areaIds, status, updatedBy) {
  return await this.updateMany(
    { _id: { $in: areaIds } },
    { 
      status,
      'auditInfo.updatedBy': updatedBy,
      updatedAt: new Date()
    }
  );
};

hotelAreaSchema.statics.generateAreaStats = async function(hotelId, options = {}) {
  const { startDate, endDate } = options;
  const matchStage = { hotelId: mongoose.Types.ObjectId(hotelId) };
  
  if (startDate && endDate) {
    matchStage['statistics.lastUpdatedStats'] = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$areaType',
        totalAreas: { $sum: 1 },
        activeAreas: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
        },
        totalRooms: { $sum: '$totalRooms' },
        totalRevenue: { $sum: '$statistics.totalRevenue' },
        averageOccupancy: { $avg: '$statistics.averageOccupancy' }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

// Note: Pagination plugin removed - implement as needed

const HotelArea = mongoose.model('HotelArea', hotelAreaSchema);

export default HotelArea;
