import mongoose from 'mongoose';

const phoneExtensionSchema = new mongoose.Schema({
  // Basic Information
  extensionNumber: {
    type: String,
    required: [true, 'Extension number is required'],
    trim: true,
    unique: true,
    index: true,
    minLength: [3, 'Extension number must be at least 3 characters'],
    maxLength: [10, 'Extension number cannot exceed 10 characters'],
    match: [/^[0-9]+$/, 'Extension number must contain only digits']
  },
  
  displayName: {
    type: String,
    required: [true, 'Display name is required'],
    trim: true,
    maxLength: [100, 'Display name cannot exceed 100 characters']
  },
  
  description: {
    type: String,
    trim: true,
    maxLength: [500, 'Description cannot exceed 500 characters']
  },

  // Hotel and Room Association
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required'],
    index: true
  },
  
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    index: true,
    sparse: true // Allow null for common areas
  },
  
  roomNumber: {
    type: String,
    trim: true,
    index: true,
    sparse: true
  },

  // Phone Configuration
  phoneType: {
    type: String,
    enum: {
      values: ['room_phone', 'desk_phone', 'cordless', 'conference', 'fax', 'emergency', 'service', 'admin', 'maintenance', 'security'],
      message: 'Invalid phone type'
    },
    required: [true, 'Phone type is required'],
    index: true
  },
  
  phoneModel: {
    type: String,
    trim: true,
    maxLength: [100, 'Phone model cannot exceed 100 characters']
  },
  
  features: [{
    type: String,
    enum: ['voicemail', 'caller_id', 'call_waiting', 'conference_call', 'speed_dial', 'intercom', 'wake_up_call', 'do_not_disturb']
  }],

  // Location and Assignment
  location: {
    floor: {
      type: Number,
      min: [-5, 'Floor cannot be less than -5'],
      max: [100, 'Floor cannot exceed 100']
    },
    wing: {
      type: String,
      trim: true,
      maxLength: [50, 'Wing cannot exceed 50 characters']
    },
    area: {
      type: String,
      trim: true,
      maxLength: [100, 'Area cannot exceed 100 characters']
    },
    coordinates: {
      x: Number,
      y: Number
    }
  },

  // Status and Availability
  status: {
    type: String,
    enum: {
      values: ['active', 'inactive', 'maintenance', 'out_of_order', 'temporary'],
      message: 'Invalid phone extension status'
    },
    default: 'active',
    index: true
  },
  
  isAvailable: {
    type: Boolean,
    default: true,
    index: true
  },
  
  maintenanceMode: {
    isEnabled: {
      type: Boolean,
      default: false
    },
    reason: {
      type: String,
      trim: true,
      maxLength: [200, 'Maintenance reason cannot exceed 200 characters']
    },
    scheduledUntil: Date,
    technician: {
      type: String,
      trim: true,
      maxLength: [100, 'Technician name cannot exceed 100 characters']
    }
  },

  // Call Configuration
  callSettings: {
    allowOutgoingCalls: {
      type: Boolean,
      default: true
    },
    allowInternationalCalls: {
      type: Boolean,
      default: false
    },
    allowLongDistanceCalls: {
      type: Boolean,
      default: false
    },
    restrictedNumbers: [{
      number: {
        type: String,
        trim: true
      },
      reason: {
        type: String,
        trim: true
      }
    }],
    speedDialNumbers: [{
      label: {
        type: String,
        required: true,
        trim: true,
        maxLength: [50, 'Speed dial label cannot exceed 50 characters']
      },
      number: {
        type: String,
        required: true,
        trim: true,
        maxLength: [20, 'Speed dial number cannot exceed 20 characters']
      },
      position: {
        type: Number,
        min: [1, 'Speed dial position must be at least 1'],
        max: [99, 'Speed dial position cannot exceed 99']
      }
    }]
  },

  // Directory Settings
  directorySettings: {
    showInDirectory: {
      type: Boolean,
      default: true
    },
    publicListing: {
      type: Boolean,
      default: true
    },
    category: {
      type: String,
      enum: ['guest_rooms', 'common_areas', 'staff', 'services', 'emergency', 'admin'],
      default: 'guest_rooms'
    },
    sortOrder: {
      type: Number,
      default: 0
    }
  },

  // Integration Settings
  integrationSettings: {
    pbxId: {
      type: String,
      trim: true,
      maxLength: [50, 'PBX ID cannot exceed 50 characters']
    },
    sipAddress: {
      type: String,
      trim: true,
      maxLength: [100, 'SIP address cannot exceed 100 characters']
    },
    macAddress: {
      type: String,
      trim: true,
      match: [/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, 'Invalid MAC address format']
    },
    ipAddress: {
      type: String,
      trim: true,
      match: [/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/, 'Invalid IP address format']
    },
    firmwareVersion: {
      type: String,
      trim: true,
      maxLength: [50, 'Firmware version cannot exceed 50 characters']
    }
  },

  // Usage Statistics
  usageStats: {
    totalCallsReceived: {
      type: Number,
      default: 0,
      min: [0, 'Total calls received cannot be negative']
    },
    totalCallsMade: {
      type: Number,
      default: 0,
      min: [0, 'Total calls made cannot be negative']
    },
    lastUsed: Date,
    averageDailyUsage: {
      type: Number,
      default: 0,
      min: [0, 'Average daily usage cannot be negative']
    },
    peakUsageHours: [{
      hour: {
        type: Number,
        min: 0,
        max: 23
      },
      callCount: {
        type: Number,
        min: 0
      }
    }]
  },

  // Audit Information
  auditInfo: {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by is required']
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    lastModified: {
      type: Date,
      default: Date.now
    },
    version: {
      type: Number,
      default: 1
    }
  },

  // Notes and Comments
  notes: {
    type: String,
    trim: true,
    maxLength: [1000, 'Notes cannot exceed 1000 characters']
  },
  
  internalNotes: {
    type: String,
    trim: true,
    maxLength: [1000, 'Internal notes cannot exceed 1000 characters']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
phoneExtensionSchema.index({ hotelId: 1, extensionNumber: 1 }, { unique: true });
phoneExtensionSchema.index({ hotelId: 1, roomId: 1 });
phoneExtensionSchema.index({ hotelId: 1, phoneType: 1 });
phoneExtensionSchema.index({ hotelId: 1, status: 1 });
phoneExtensionSchema.index({ hotelId: 1, 'directorySettings.category': 1 });
phoneExtensionSchema.index({ extensionNumber: 'text', displayName: 'text', description: 'text' });

// Virtual for room information
phoneExtensionSchema.virtual('roomInfo', {
  ref: 'Room',
  localField: 'roomId',
  foreignField: '_id',
  justOne: true
});

// Virtual for hotel information
phoneExtensionSchema.virtual('hotelInfo', {
  ref: 'Hotel',
  localField: 'hotelId',
  foreignField: '_id',
  justOne: true
});

// Pre-save middleware
phoneExtensionSchema.pre('save', async function(next) {
  try {
    // Update version and last modified
    if (this.isModified() && !this.isNew) {
      this.auditInfo.version += 1;
      this.auditInfo.lastModified = new Date();
    }

    // Auto-populate room number if room is assigned
    if (this.isModified('roomId') && this.roomId) {
      const Room = mongoose.model('Room');
      const room = await Room.findById(this.roomId).select('roomNumber');
      if (room) {
        this.roomNumber = room.roomNumber;
      }
    }

    // Validate extension number uniqueness within hotel
    if (this.isModified('extensionNumber') || this.isModified('hotelId')) {
      const existingExtension = await this.constructor.findOne({
        hotelId: this.hotelId,
        extensionNumber: this.extensionNumber,
        _id: { $ne: this._id }
      });

      if (existingExtension) {
        throw new Error('Extension number already exists in this hotel');
      }
    }

    // Validate speed dial positions are unique
    const speedDialNumbers = this.callSettings?.speedDialNumbers || [];
    const positions = speedDialNumbers.map(sd => sd.position);
    if (positions.length !== new Set(positions).size) {
      throw new Error('Speed dial positions must be unique');
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Instance methods
phoneExtensionSchema.methods.isAssignedToRoom = function() {
  return Boolean(this.roomId);
};

phoneExtensionSchema.methods.isOperational = function() {
  return this.status === 'active' && this.isAvailable && !this.maintenanceMode.isEnabled;
};

phoneExtensionSchema.methods.addSpeedDial = function(label, number, position) {
  if (!this.callSettings) {
    this.callSettings = { speedDialNumbers: [] };
  }
  
  // Check if position is already taken
  const existingPosition = this.callSettings.speedDialNumbers.find(sd => sd.position === position);
  if (existingPosition) {
    throw new Error(`Speed dial position ${position} is already taken`);
  }

  this.callSettings.speedDialNumbers.push({ label, number, position });
  this.callSettings.speedDialNumbers.sort((a, b) => a.position - b.position);
  
  return this.save();
};

phoneExtensionSchema.methods.removeSpeedDial = function(position) {
  if (!this.callSettings?.speedDialNumbers) {
    return this;
  }

  this.callSettings.speedDialNumbers = this.callSettings.speedDialNumbers.filter(
    sd => sd.position !== position
  );
  
  return this.save();
};

phoneExtensionSchema.methods.updateUsageStats = function(callType = 'received') {
  const now = new Date();
  const currentHour = now.getHours();
  
  // Update call counts
  if (callType === 'received') {
    this.usageStats.totalCallsReceived += 1;
  } else if (callType === 'made') {
    this.usageStats.totalCallsMade += 1;
  }
  
  // Update last used
  this.usageStats.lastUsed = now;
  
  // Update peak usage hours
  const existingHour = this.usageStats.peakUsageHours.find(h => h.hour === currentHour);
  if (existingHour) {
    existingHour.callCount += 1;
  } else {
    this.usageStats.peakUsageHours.push({
      hour: currentHour,
      callCount: 1
    });
  }
  
  return this.save();
};

phoneExtensionSchema.methods.setMaintenance = function(reason, scheduledUntil, technician) {
  this.maintenanceMode = {
    isEnabled: true,
    reason,
    scheduledUntil,
    technician
  };
  this.status = 'maintenance';
  this.isAvailable = false;
  
  return this.save();
};

phoneExtensionSchema.methods.clearMaintenance = function() {
  this.maintenanceMode = {
    isEnabled: false,
    reason: undefined,
    scheduledUntil: undefined,
    technician: undefined
  };
  this.status = 'active';
  this.isAvailable = true;
  
  return this.save();
};

// Static methods
phoneExtensionSchema.statics.findByHotel = function(hotelId, filters = {}) {
  return this.find({ hotelId, ...filters })
    .populate('roomInfo', 'roomNumber floor roomType status')
    .populate('hotelInfo', 'name')
    .sort({ extensionNumber: 1 });
};

phoneExtensionSchema.statics.findAvailableExtensions = function(hotelId) {
  return this.find({
    hotelId,
    status: 'active',
    isAvailable: true,
    'maintenanceMode.isEnabled': false
  }).populate('roomInfo', 'roomNumber floor');
};

phoneExtensionSchema.statics.getDirectoryListing = function(hotelId, category = null) {
  const query = {
    hotelId,
    'directorySettings.showInDirectory': true,
    'directorySettings.publicListing': true,
    status: 'active'
  };

  if (category) {
    query['directorySettings.category'] = category;
  }

  return this.find(query)
    .select('extensionNumber displayName description phoneType directorySettings location')
    .populate('roomInfo', 'roomNumber floor')
    .sort({ 'directorySettings.sortOrder': 1, extensionNumber: 1 });
};

phoneExtensionSchema.statics.getUsageReport = function(hotelId, dateRange) {
  const matchStage = {
    hotelId: mongoose.Types.ObjectId(hotelId)
  };

  if (dateRange?.startDate || dateRange?.endDate) {
    matchStage['usageStats.lastUsed'] = {};
    if (dateRange.startDate) {
      matchStage['usageStats.lastUsed'].$gte = new Date(dateRange.startDate);
    }
    if (dateRange.endDate) {
      matchStage['usageStats.lastUsed'].$lte = new Date(dateRange.endDate);
    }
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$phoneType',
        totalExtensions: { $sum: 1 },
        totalCallsReceived: { $sum: '$usageStats.totalCallsReceived' },
        totalCallsMade: { $sum: '$usageStats.totalCallsMade' },
        averageDailyUsage: { $avg: '$usageStats.averageDailyUsage' },
        activeExtensions: {
          $sum: {
            $cond: [{ $eq: ['$status', 'active'] }, 1, 0]
          }
        }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

phoneExtensionSchema.statics.bulkUpdateStatus = function(extensionIds, status, updatedBy) {
  return this.updateMany(
    { _id: { $in: extensionIds } },
    {
      $set: {
        status,
        'auditInfo.updatedBy': updatedBy,
        'auditInfo.lastModified': new Date(),
        $inc: { 'auditInfo.version': 1 }
      }
    }
  );
};

phoneExtensionSchema.statics.generateNextExtension = async function(hotelId, prefix = '') {
  const lastExtension = await this.findOne(
    { 
      hotelId,
      extensionNumber: new RegExp(`^${prefix}\\d+$`)
    },
    {},
    { sort: { extensionNumber: -1 } }
  );

  if (!lastExtension) {
    return `${prefix}1000`;
  }

  const lastNumber = parseInt(lastExtension.extensionNumber.replace(prefix, ''));
  return `${prefix}${lastNumber + 1}`;
};

// Pre-remove middleware
phoneExtensionSchema.pre('remove', async function(next) {
  try {
    // Log extension removal
    console.log(`Removing phone extension: ${this.extensionNumber} from hotel: ${this.hotelId}`);
    
    // Could add notification logic here
    next();
  } catch (error) {
    next(error);
  }
});

const PhoneExtension = mongoose.model('PhoneExtension', phoneExtensionSchema);

export default PhoneExtension;
