import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     Room:
 *       type: object
 *       required:
 *         - hotelId
 *         - roomNumber
 *         - type
 *         - baseRate
 *       properties:
 *         _id:
 *           type: string
 *         hotelId:
 *           type: string
 *           description: Hotel ID
 *         roomNumber:
 *           type: string
 *           description: Room number
 *         type:
 *           type: string
 *           enum: [single, double, suite, deluxe]
 *         baseRate:
 *           type: number
 *           description: Base rate per night
 *         currentRate:
 *           type: number
 *           description: Current rate per night
 *         status:
 *           type: string
 *           enum: [vacant, occupied, dirty, maintenance, out_of_order]
 *           default: vacant
 *         floor:
 *           type: number
 *         capacity:
 *           type: number
 *           default: 2
 *         amenities:
 *           type: array
 *           items:
 *             type: string
 *         images:
 *           type: array
 *           items:
 *             type: string
 *         description:
 *           type: string
 *         isActive:
 *           type: boolean
 *           default: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const roomSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required']
  },
  roomNumber: {
    type: String,
    required: [true, 'Room number is required'],
    trim: true
  },
  // NEW: Reference to RoomType entity
  roomTypeId: {
    type: mongoose.Schema.ObjectId,
    ref: 'RoomType',
    index: true
  },
  // Hotel Area reference for physical location and organization
  hotelAreaId: {
    type: mongoose.Schema.ObjectId,
    ref: 'HotelArea',
    index: true
  },
  // LEGACY: Keep for backward compatibility during transition
  type: {
    type: String,
    enum: {
      values: ['single', 'double', 'suite', 'deluxe'],
      message: 'Room type must be single, double, suite, or deluxe'
    }
  },
  baseRate: {
    type: Number,
    required: [true, 'Base rate is required'],
    min: [0, 'Base rate cannot be negative']
  },
  currentRate: {
    type: Number,
    min: [0, 'Current rate cannot be negative']
  },
  status: {
    type: String,
    enum: {
      values: ['vacant', 'occupied', 'dirty', 'maintenance', 'out_of_order'],
      message: 'Invalid room status'
    },
    default: 'vacant'
  },
  floor: {
    type: Number,
    min: 1
  },
  capacity: {
    type: Number,
    required: true,
    min: [1, 'Capacity must be at least 1'],
    default: 2
  },
  amenities: [{
    type: String,
    trim: true
  }],
  images: [{
    type: String,
    match: [/^https?:\/\//, 'Image URL must be valid']
  }],
  description: {
    type: String,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Revenue Account Integration
  revenueAccountCode: {
    type: String,
    trim: true,
    uppercase: true,
    maxLength: 20,
    index: true
  },
  // Alternative: Reference to RevenueAccount model
  revenueAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RevenueAccount',
    index: true
  },
  lastCleaned: Date,
  maintenanceNotes: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
roomSchema.index({ hotelId: 1, roomNumber: 1 }, { unique: true });
roomSchema.index({ hotelId: 1, type: 1, status: 1 });
roomSchema.index({ hotelId: 1, floor: 1 });
roomSchema.index({ hotelId: 1, revenueAccountCode: 1 });
roomSchema.index({ hotelId: 1, revenueAccountId: 1 });

// Set current rate to base rate if not provided
roomSchema.pre('save', function(next) {
  if (!this.currentRate) {
    this.currentRate = this.baseRate;
  }
  next();
});

// Virtual for current bookings
roomSchema.virtual('currentBookings', {
  ref: 'Booking',
  localField: '_id',
  foreignField: 'rooms.roomId',
  match: {
    status: { $in: ['confirmed', 'checked_in'] },
    checkOut: { $gte: new Date() }
  }
});

// Virtual for room type details (NEW)
roomSchema.virtual('roomTypeDetails', {
  ref: 'RoomType',
  localField: 'roomTypeId',
  foreignField: '_id',
  justOne: true
});

// Virtual for revenue account details
roomSchema.virtual('revenueAccountDetails', {
  ref: 'RevenueAccount',
  localField: 'revenueAccountId',
  foreignField: '_id',
  justOne: true
});

// Instance method to check availability for date range
roomSchema.methods.isAvailable = async function(checkIn, checkOut) {
  const Booking = mongoose.model('Booking');
  
  const conflictingBookings = await Booking.find({
    'rooms.roomId': this._id,
    status: { $in: ['confirmed', 'checked_in'] },
    $or: [
      { checkIn: { $lt: checkOut, $gte: checkIn } },
      { checkOut: { $gt: checkIn, $lte: checkOut } },
      { checkIn: { $lte: checkIn }, checkOut: { $gte: checkOut } }
    ]
  });

  return conflictingBookings.length === 0 && this.status === 'vacant' && this.isActive;
};

// NEW: Get room type (works with both legacy and new structure)
roomSchema.methods.getRoomType = async function() {
  // If we have roomTypeId, use the new structure
  if (this.roomTypeId) {
    const RoomType = mongoose.model('RoomType');
    return await RoomType.findById(this.roomTypeId);
  }
  
  // Fallback to legacy structure
  if (this.type) {
    const RoomType = mongoose.model('RoomType');
    return await RoomType.findOne({ 
      hotelId: this.hotelId, 
      legacyType: this.type 
    });
  }
  
  return null;
};

// NEW: Get effective room type string (backward compatible)
roomSchema.methods.getTypeString = function() {
  // Return legacy type if available (for backward compatibility)
  return this.type || 'unknown';
};

// NEW: Link room to RoomType entity
roomSchema.methods.linkToRoomType = async function() {
  if (this.roomTypeId || !this.type) {
    return; // Already linked or no type to link
  }
  
  const RoomType = mongoose.model('RoomType');
  const roomType = await RoomType.findOne({
    hotelId: this.hotelId,
    legacyType: this.type
  });
  
  if (roomType) {
    this.roomTypeId = roomType._id;
    await this.save();
  }
};

// Static method to find available rooms (ENHANCED for new structure)
roomSchema.statics.findAvailable = async function(hotelId, checkInDate, checkOutDate, roomTypeFilter = null) {
  const Booking = mongoose.model('Booking');
  const RoomAvailability = mongoose.model('RoomAvailability');
  
  // Ensure dates are properly formatted
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);
  
  // NEW: Try to use RoomAvailability for more accurate results
  if (roomTypeFilter) {
    // If we have roomTypeFilter, try to use the new availability system
    const RoomType = mongoose.model('RoomType');
    let roomTypeId = roomTypeFilter;
    
    // Handle both ObjectId and legacy string types
    if (typeof roomTypeFilter === 'string') {
      const roomType = await RoomType.findOne({
        hotelId,
        $or: [
          { legacyType: roomTypeFilter },
          { _id: mongoose.Types.ObjectId.isValid(roomTypeFilter) ? roomTypeFilter : null }
        ]
      });
      if (roomType) roomTypeId = roomType._id;
    }
    
    // Check availability using the new system
    const availabilityRecords = await RoomAvailability.find({
      hotelId,
      roomTypeId,
      date: { $gte: checkIn, $lt: checkOut },
      availableRooms: { $gt: 0 }
    });
    
    // If we have availability data, use it
    if (availabilityRecords.length > 0) {
      const minAvailable = Math.min(...availabilityRecords.map(r => r.availableRooms));
      if (minAvailable > 0) {
        // Find actual room instances
        const query = {
          hotelId,
          status: 'vacant',
          isActive: true
        };
        
        if (roomTypeId) {
          query.$or = [
            { roomTypeId },
            { type: roomTypeFilter } // Fallback to legacy
          ];
        }
        
        return await this.find(query).populate('roomTypeDetails').sort({ roomNumber: 1 });
      }
    }
  }
  
  // FALLBACK: Use legacy booking-based availability check
  const conflictingBookings = await Booking.find({
    hotelId,
    status: { $in: ['confirmed', 'checked_in'] },
    $or: [
      { checkIn: { $lt: checkOut, $gte: checkIn } },
      { checkOut: { $gt: checkIn, $lte: checkOut } },
      { checkIn: { $lte: checkIn }, checkOut: { $gte: checkOut } }
    ]
  }).select('rooms.roomId');

  const occupiedRoomIds = conflictingBookings.flatMap(booking => 
    booking.rooms.map(room => room.roomId.toString())
  );

  // Build query for available rooms
  const query = {
    hotelId,
    _id: { $nin: occupiedRoomIds },
    status: 'vacant',
    isActive: true
  };

  // Handle room type filtering (both new and legacy)
  if (roomTypeFilter) {
    if (mongoose.Types.ObjectId.isValid(roomTypeFilter)) {
      query.roomTypeId = roomTypeFilter;
    } else {
      query.type = roomTypeFilter; // Legacy string type
    }
  }

  const availableRooms = await this.find(query)
    .populate('roomTypeDetails')
    .sort({ roomNumber: 1 });
  
  return availableRooms;
};

// Method to get room status based on current bookings
roomSchema.statics.getRoomsWithRealTimeStatus = async function(hotelId, options = {}) {
  const Booking = mongoose.model('Booking');
  
  const {
    type,
    floor,
    page = 1,
    limit = 100
  } = options;
  
  // Build base query
  const query = {
    hotelId,
    isActive: true
  };
  
  if (type) query.type = type;
  if (floor) query.floor = floor;
  
  // Get all rooms for the hotel
  const rooms = await this.find(query)
    .sort({ floor: 1, roomNumber: 1 })
    .skip((page - 1) * limit)
    .limit(limit);
  
  if (!rooms.length) return { rooms: [], total: 0 };
  
  // Get current date
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  
  // Find all current bookings that affect these rooms
  const currentBookings = await Booking.find({
    hotelId,
    status: { $in: ['confirmed', 'checked_in'] },
    checkOut: { $gte: today }, // Haven't checked out yet
    checkIn: { $lte: tomorrow } // Started or starting soon
  }).select('rooms.roomId status checkIn checkOut');
  
  console.log('Real-time status calculation:', {
    hotelId,
    today: today.toISOString(),
    tomorrow: tomorrow.toISOString(),
    totalRooms: rooms.length,
    currentBookings: currentBookings.length,
    bookings: currentBookings.map(b => ({
      id: b._id,
      status: b.status,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      roomIds: b.rooms.map(r => r.roomId)
    }))
  });
  
  // Create a map of room occupancy
  const roomOccupancyMap = new Map();
  
  currentBookings.forEach(booking => {
    booking.rooms.forEach(roomBooking => {
      const roomId = roomBooking.roomId.toString();
      const checkIn = new Date(booking.checkIn);
      const checkOut = new Date(booking.checkOut);
      
      let computedStatus = 'occupied';
      
      // More granular status based on dates and booking status
      if (booking.status === 'checked_in') {
        computedStatus = 'occupied';
      } else if (booking.status === 'confirmed') {
        if (checkIn <= today) {
          computedStatus = 'occupied'; // Should be checked in
        } else {
          computedStatus = 'reserved'; // Reserved for future
        }
      }
      
      roomOccupancyMap.set(roomId, {
        status: computedStatus,
        bookingId: booking._id,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        bookingStatus: booking.status
      });
    });
  });
  
  // Add computed status to each room
  const roomsWithStatus = rooms.map(room => {
    const roomObj = room.toObject();
    const occupancy = roomOccupancyMap.get(room._id.toString());
    
    if (occupancy) {
      roomObj.computedStatus = occupancy.status;
      roomObj.currentBooking = {
        bookingId: occupancy.bookingId,
        checkIn: occupancy.checkIn,
        checkOut: occupancy.checkOut,
        status: occupancy.bookingStatus
      };
    } else {
      // Check if room has any other status (maintenance, dirty, etc.)
      roomObj.computedStatus = room.status === 'vacant' ? 'vacant' : room.status;
    }
    
    return roomObj;
  });
  
  // Get total count for pagination
  const total = await this.countDocuments(query);
  
  return {
    rooms: roomsWithStatus,
    total,
    pagination: {
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

export default mongoose.model('Room', roomSchema);
