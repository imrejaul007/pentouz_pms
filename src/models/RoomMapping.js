import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     RoomMapping:
 *       type: object
 *       required:
 *         - pmsRoomTypeId
 *         - channel
 *         - channelRoomId
 *       properties:
 *         _id:
 *           type: string
 *         pmsRoomTypeId:
 *           type: string
 *           description: Internal PMS Room Type ID
 *         channel:
 *           type: string
 *           enum: [booking_com, expedia, airbnb, agoda, hotels_com, amadeus, sabre]
 *           description: OTA Channel name
 *         channelRoomId:
 *           type: string
 *           description: External channel room type ID
 *         channelRoomName:
 *           type: string
 *           description: Room type name as displayed on channel
 *         channelRoomDescription:
 *           type: string
 *           description: Room description for the channel
 *         isActive:
 *           type: boolean
 *           default: true
 *         mappingConfig:
 *           type: object
 *           description: Channel-specific configuration
 */

const roomMappingSchema = new mongoose.Schema({
  // Internal PMS Room Type reference
  pmsRoomTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RoomType',
    required: true,
    index: true
  },
  
  // Channel identification
  channel: {
    type: String,
    required: true,
    enum: [
      'booking_com',
      'expedia', 
      'airbnb',
      'agoda',
      'hotels_com',
      'amadeus',
      'sabre',
      'galileo',
      'worldspan',
      'direct_web'
    ],
    index: true
  },
  
  // External channel room identification
  channelRoomId: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  
  channelRoomName: {
    type: String,
    required: true,
    trim: true
  },
  
  channelRoomDescription: {
    type: String,
    trim: true
  },
  
  // Mapping status and configuration
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Channel-specific configuration
  mappingConfig: {
    // Booking.com specific
    property_id: String,
    room_type_id: String,
    
    // Expedia specific
    hotel_id: String,
    room_type_id_exp: String,
    
    // Airbnb specific
    listing_id: String,
    
    // Commission and pricing rules
    commission: {
      type: Number,
      min: 0,
      max: 100,
      default: 15
    },
    
    // Rate modifications
    rateModifier: {
      type: {
        type: String,
        enum: ['percentage', 'fixed'],
        default: 'percentage'
      },
      value: {
        type: Number,
        default: 0
      }
    },
    
    // Availability restrictions
    minAdvanceBooking: {
      type: Number,
      default: 0,
      min: 0
    },
    
    maxAdvanceBooking: {
      type: Number,
      default: 365,
      min: 1
    },
    
    // Custom fields for different channels
    customFields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed
    }
  },
  
  // Sync tracking
  lastSync: {
    success: Date,
    attempt: Date,
    status: {
      type: String,
      enum: ['success', 'failed', 'pending'],
      default: 'pending'
    },
    error: String
  },
  
  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for performance
roomMappingSchema.index({ pmsRoomTypeId: 1, channel: 1 });
roomMappingSchema.index({ channel: 1, channelRoomId: 1 }, { unique: true });
roomMappingSchema.index({ pmsRoomTypeId: 1, isActive: 1 });
roomMappingSchema.index({ channel: 1, isActive: 1 });

// Virtual for room type details
roomMappingSchema.virtual('roomTypeDetails', {
  ref: 'RoomType',
  localField: 'pmsRoomTypeId',
  foreignField: '_id',
  justOne: true
});

// Static method to find mappings by room type
roomMappingSchema.statics.findByRoomType = function(roomTypeId, activeOnly = true) {
  const query = { pmsRoomTypeId: roomTypeId };
  if (activeOnly) query.isActive = true;
  return this.find(query).populate('roomTypeDetails');
};

// Static method to find mapping by channel and external ID
roomMappingSchema.statics.findByChannelRoom = function(channel, channelRoomId) {
  return this.findOne({ 
    channel, 
    channelRoomId, 
    isActive: true 
  }).populate('roomTypeDetails');
};

// Static method to get all mappings for a channel
roomMappingSchema.statics.findByChannel = function(channel, activeOnly = true) {
  const query = { channel };
  if (activeOnly) query.isActive = true;
  return this.find(query).populate('roomTypeDetails');
};

// Instance method to update sync status
roomMappingSchema.methods.updateSyncStatus = function(status, error = null) {
  this.lastSync.attempt = new Date();
  this.lastSync.status = status;
  
  if (status === 'success') {
    this.lastSync.success = new Date();
    this.lastSync.error = undefined;
  } else if (status === 'failed' && error) {
    this.lastSync.error = error;
  }
  
  return this.save();
};

// Instance method to calculate effective rate
roomMappingSchema.methods.calculateChannelRate = function(baseRate) {
  if (!this.mappingConfig?.rateModifier) return baseRate;
  
  const { type, value } = this.mappingConfig.rateModifier;
  
  if (type === 'percentage') {
    return baseRate * (1 + value / 100);
  } else if (type === 'fixed') {
    return baseRate + value;
  }
  
  return baseRate;
};

// Pre-save middleware for validation
roomMappingSchema.pre('save', function(next) {
  // Ensure channel room ID is properly formatted
  if (this.channelRoomId) {
    this.channelRoomId = this.channelRoomId.toString().trim();
  }
  
  // Validate commission range
  if (this.mappingConfig?.commission) {
    if (this.mappingConfig.commission < 0 || this.mappingConfig.commission > 100) {
      return next(new Error('Commission must be between 0 and 100'));
    }
  }
  
  next();
});

export default mongoose.model('RoomMapping', roomMappingSchema);
