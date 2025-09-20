import mongoose from 'mongoose';

// Room Configuration Schema for Tape Chart
const roomConfigurationSchema = new mongoose.Schema({
  configId: {
    type: String,
    required: true,
    unique: true
  },
  roomNumber: {
    type: String,
    required: true
  },
  roomType: {
    type: String,
    required: true
  },
  floor: {
    type: Number,
    required: true
  },
  building: String,
  wing: String,
  position: {
    row: Number,
    column: Number,
    x: Number,
    y: Number
  },
  displaySettings: {
    color: {
      type: String,
      default: '#ffffff'
    },
    width: {
      type: Number,
      default: 120
    },
    height: {
      type: Number,
      default: 40
    },
    showRoomNumber: {
      type: Boolean,
      default: true
    },
    showGuestName: {
      type: Boolean,
      default: true
    },
    showRoomType: {
      type: Boolean,
      default: false
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Room Status History Schema
const roomStatusHistorySchema = new mongoose.Schema({
  historyId: {
    type: String,
    required: true,
    unique: true
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['available', 'occupied', 'reserved', 'out_of_order', 'maintenance', 'dirty', 'clean', 'inspected'],
    required: true
  },
  previousStatus: String,
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  },
  guestName: String,
  checkIn: Date,
  checkOut: Date,
  notes: String,
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  changeReason: String,
  duration: Number, // in minutes
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  }
}, {
  timestamps: true
});

// Room Block Schema for Group Reservations
const roomBlockSchema = new mongoose.Schema({
  blockId: {
    type: String,
    required: true,
    unique: true
  },
  blockName: {
    type: String,
    required: true
  },
  groupName: {
    type: String,
    required: true
  },
  corporateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CorporateCompany'
  },
  eventType: {
    type: String,
    enum: ['conference', 'wedding', 'corporate_event', 'tour_group', 'other'],
    default: 'other'
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  rooms: [{
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true
    },
    roomNumber: String,
    roomType: String,
    rate: Number,
    status: {
      type: String,
      enum: ['blocked', 'reserved', 'occupied', 'released'],
      default: 'blocked'
    },
    guestName: String,
    specialRequests: String
  }],
  totalRooms: {
    type: Number,
    required: true
  },
  roomsBooked: {
    type: Number,
    default: 0
  },
  roomsReleased: {
    type: Number,
    default: 0
  },
  blockRate: Number,
  currency: {
    type: String,
    default: 'INR'
  },
  cutOffDate: Date,
  autoReleaseDate: Date,
  status: {
    type: String,
    enum: ['active', 'confirmed', 'cancelled', 'completed', 'expired'],
    default: 'active'
  },
  contactPerson: {
    name: String,
    email: String,
    phone: String,
    title: String
  },
  billingInstructions: {
    type: String,
    enum: ['master_account', 'individual_folios', 'split_billing'],
    default: 'master_account'
  },
  specialInstructions: String,
  amenities: [String],
  cateringRequirements: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: [{
    content: {
      type: String,
      required: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    isInternal: {
      type: Boolean,
      default: true
    }
  }]
}, {
  timestamps: true
});

// Advanced Reservation Schema
const advancedReservationSchema = new mongoose.Schema({
  reservationId: {
    type: String,
    required: true,
    unique: true
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  reservationType: {
    type: String,
    enum: ['standard', 'group', 'corporate', 'vip', 'complimentary', 'house_use'],
    default: 'standard'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'vip'],
    default: 'medium'
  },
  roomPreferences: {
    preferredRooms: [String],
    preferredFloor: Number,
    preferredView: String,
    adjacentRooms: Boolean,
    connectingRooms: Boolean,
    accessibleRoom: Boolean,
    smokingPreference: {
      type: String,
      enum: ['non_smoking', 'smoking', 'no_preference'],
      default: 'non_smoking'
    }
  },
  guestProfile: {
    vipStatus: {
      type: String,
      enum: ['none', 'member', 'silver', 'gold', 'platinum', 'diamond'],
      default: 'none'
    },
    loyaltyNumber: String,
    preferences: {
      bedType: String,
      pillowType: String,
      roomTemperature: Number,
      newspaper: String,
      wakeUpCall: Boolean,
      turndownService: Boolean
    },
    allergies: [String],
    specialNeeds: [String],
    dietaryRestrictions: [String]
  },
  roomAssignments: [{
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room'
    },
    roomNumber: String,
    assignedDate: Date,
    assignmentType: {
      type: String,
      enum: ['auto', 'manual', 'upgrade', 'preference'],
      default: 'auto'
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notes: String
  }],
  upgrades: [{
    fromRoomType: String,
    toRoomType: String,
    upgradeType: {
      type: String,
      enum: ['complimentary', 'paid', 'loyalty', 'operational'],
      required: true
    },
    upgradeReason: String,
    additionalCharge: {
      type: Number,
      default: 0
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    upgradeDate: {
      type: Date,
      default: Date.now
    }
  }],
  specialRequests: [{
    type: {
      type: String,
      enum: ['room_setup', 'amenities', 'services', 'dining', 'transportation', 'other'],
      required: true
    },
    description: String,
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled'],
      default: 'pending'
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    dueDate: Date,
    cost: Number,
    notes: String
  }],
  compRooms: [{
    reason: {
      type: String,
      enum: ['vip_guest', 'service_recovery', 'loyalty_benefit', 'promotional', 'staff_courtesy'],
      required: true
    },
    authorizedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    approvalLevel: {
      type: String,
      enum: ['supervisor', 'manager', 'gm', 'owner'],
      required: true
    },
    nights: Number,
    value: Number,
    restrictions: String
  }],
  reservationFlags: [{
    flag: {
      type: String,
      enum: ['credit_hold', 'no_show_risk', 'special_attention', 'vip', 'complainer', 'loyalty_member'],
      required: true
    },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'info'
    },
    description: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    expiryDate: Date
  }],
  waitlistInfo: {
    waitlistPosition: Number,
    waitlistDate: Date,
    preferredRoomTypes: [String],
    maxRate: Number,
    flexibleDates: {
      checkInRange: {
        start: Date,
        end: Date
      },
      checkOutRange: {
        start: Date,
        end: Date
      }
    },
    notificationPreferences: {
      email: Boolean,
      sms: Boolean,
      phone: Boolean
    },
    autoConfirm: Boolean
  }
}, {
  timestamps: true
});

// Tape Chart View Configuration
const tapeChartViewSchema = new mongoose.Schema({
  viewId: {
    type: String,
    required: true,
    unique: true
  },
  viewName: {
    type: String,
    required: true
  },
  viewType: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'custom'],
    default: 'daily'
  },
  dateRange: {
    startDate: Date,
    endDate: Date,
    defaultDays: {
      type: Number,
      default: 7
    }
  },
  displaySettings: {
    showWeekends: {
      type: Boolean,
      default: true
    },
    colorCoding: {
      available: { type: String, default: '#28a745' },
      occupied: { type: String, default: '#dc3545' },
      reserved: { type: String, default: '#ffc107' },
      maintenance: { type: String, default: '#6f42c1' },
      out_of_order: { type: String, default: '#495057' },
      dirty: { type: String, default: '#fd7e14' },
      clean: { type: String, default: '#20c997' }
    },
    roomSorting: {
      type: String,
      enum: ['room_number', 'room_type', 'floor', 'status', 'custom'],
      default: 'room_number'
    },
    showGuestNames: {
      type: Boolean,
      default: true
    },
    showRoomTypes: {
      type: Boolean,
      default: true
    },
    showRates: {
      type: Boolean,
      default: false
    },
    compactView: {
      type: Boolean,
      default: false
    }
  },
  filters: {
    floors: [Number],
    roomTypes: [String],
    statuses: [String],
    buildings: [String],
    wings: [String]
  },
  userPreferences: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDefault: {
      type: Boolean,
      default: false
    },
    customSettings: {}
  }],
  isSystemDefault: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Room Assignment Rules Schema
const roomAssignmentRulesSchema = new mongoose.Schema({
  ruleId: {
    type: String,
    required: true,
    unique: true
  },
  ruleName: {
    type: String,
    required: true
  },
  priority: {
    type: Number,
    required: true,
    default: 1
  },
  isActive: {
    type: Boolean,
    default: true
  },
  conditions: {
    guestType: [String], // vip, loyalty_member, corporate, etc.
    reservationType: [String],
    roomTypes: [String],
    lengthOfStay: {
      min: Number,
      max: Number
    },
    advanceBooking: {
      min: Number, // days
      max: Number
    },
    seasonality: [String],
    occupancyLevel: {
      min: Number, // percentage
      max: Number
    }
  },
  actions: {
    preferredFloors: [Number],
    preferredRoomNumbers: [String],
    avoidRoomNumbers: [String],
    upgradeEligible: Boolean,
    upgradeFromTypes: [String],
    upgradeToTypes: [String],
    amenityPackages: [String],
    specialServices: [String],
    rateOverrides: {
      discountPercentage: Number,
      fixedRate: Number
    }
  },
  restrictions: {
    maxUpgrades: Number,
    blockoutDates: [{
      startDate: Date,
      endDate: Date,
      reason: String
    }],
    minimumRevenue: Number,
    requiredApproval: {
      type: String,
      enum: ['none', 'supervisor', 'manager', 'gm'],
      default: 'none'
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Pre-save middleware to generate IDs
roomConfigurationSchema.pre('save', async function(next) {
  if (!this.configId) {
    this.configId = `RC-${Date.now()}`;
  }
  next();
});

roomStatusHistorySchema.pre('save', async function(next) {
  if (!this.historyId) {
    this.historyId = `RSH-${Date.now()}`;
  }
  next();
});

roomBlockSchema.pre('save', async function(next) {
  if (!this.blockId) {
    this.blockId = `RB-${Date.now()}`;
  }
  next();
});

advancedReservationSchema.pre('save', async function(next) {
  if (!this.reservationId) {
    this.reservationId = `RES-${Date.now()}`;
  }
  next();
});

tapeChartViewSchema.pre('save', async function(next) {
  if (!this.viewId) {
    this.viewId = `TCV-${Date.now()}`;
  }
  next();
});

roomAssignmentRulesSchema.pre('save', async function(next) {
  if (!this.ruleId) {
    this.ruleId = `RAR-${Date.now()}`;
  }
  next();
});

const RoomConfiguration = mongoose.model('RoomConfiguration', roomConfigurationSchema);
const RoomStatusHistory = mongoose.model('RoomStatusHistory', roomStatusHistorySchema);
const RoomBlock = mongoose.model('RoomBlock', roomBlockSchema);
const AdvancedReservation = mongoose.model('AdvancedReservation', advancedReservationSchema);
const TapeChartView = mongoose.model('TapeChartView', tapeChartViewSchema);
const RoomAssignmentRules = mongoose.model('RoomAssignmentRules', roomAssignmentRulesSchema);

export default {
  RoomConfiguration,
  RoomStatusHistory,
  RoomBlock,
  AdvancedReservation,
  TapeChartView,
  RoomAssignmentRules
};
