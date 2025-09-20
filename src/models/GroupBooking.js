import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     GroupBooking:
 *       type: object
 *       required:
 *         - hotelId
 *         - corporateCompanyId
 *         - checkIn
 *         - checkOut
 *         - rooms
 *       properties:
 *         _id:
 *           type: string
 *         hotelId:
 *           type: string
 *           description: Hotel ID
 *         corporateCompanyId:
 *           type: string
 *           description: Corporate company ID
 *         groupName:
 *           type: string
 *           description: Name/title of the group booking
 *         groupCode:
 *           type: string
 *           description: Unique group booking code
 *         checkIn:
 *           type: string
 *           format: date
 *         checkOut:
 *           type: string
 *           format: date
 *         nights:
 *           type: number
 *         rooms:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               guestName:
 *                 type: string
 *               guestEmail:
 *                 type: string
 *               guestPhone:
 *                 type: string
 *               roomType:
 *                 type: string
 *               roomId:
 *                 type: string
 *               rate:
 *                 type: number
 *               specialRequests:
 *                 type: string
 *               bookingId:
 *                 type: string
 *                 description: Individual booking ID for this room
 *         totalRooms:
 *           type: number
 *         totalAmount:
 *           type: number
 *         currency:
 *           type: string
 *           default: INR
 *         status:
 *           type: string
 *           enum: [draft, confirmed, partially_confirmed, cancelled]
 *           default: draft
 *         paymentMethod:
 *           type: string
 *           enum: [corporate_credit, direct_billing, advance_payment]
 *           default: corporate_credit
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const groupBookingSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required']
  },
  corporateCompanyId: {
    type: mongoose.Schema.ObjectId,
    ref: 'CorporateCompany',
    required: [true, 'Corporate company ID is required']
  },
  groupName: {
    type: String,
    required: [true, 'Group name is required'],
    trim: true,
    maxlength: [200, 'Group name cannot be more than 200 characters']
  },
  groupCode: {
    type: String,
    unique: true,
    uppercase: true
  },
  checkIn: {
    type: Date,
    required: [true, 'Check-in date is required']
  },
  checkOut: {
    type: Date,
    required: [true, 'Check-out date is required']
  },
  nights: {
    type: Number,
    min: [1, 'Number of nights must be at least 1']
  },
  rooms: [{
    guestName: {
      type: String,
      required: [true, 'Guest name is required'],
      trim: true
    },
    guestEmail: {
      type: String,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    guestPhone: {
      type: String,
      match: [/^\+?[\d\s-()]+$/, 'Please enter a valid phone number']
    },
    employeeId: {
      type: String,
      trim: true
    },
    department: {
      type: String,
      trim: true
    },
    roomType: {
      type: String,
      enum: ['single', 'double', 'suite', 'deluxe'],
      required: [true, 'Room type is required']
    },
    roomId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Room'
    },
    rate: {
      type: Number,
      min: [0, 'Rate cannot be negative']
    },
    specialRequests: {
      type: String,
      maxlength: [500, 'Special requests cannot be more than 500 characters']
    },
    bookingId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Booking'
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'],
      default: 'pending'
    },
    guestPreferences: {
      bedType: String,
      floor: String,
      smokingAllowed: Boolean
    }
  }],
  totalRooms: {
    type: Number,
    min: [1, 'Total rooms must be at least 1']
  },
  totalAmount: {
    type: Number,
    min: [0, 'Total amount cannot be negative']
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['draft', 'confirmed', 'partially_confirmed', 'checked_in', 'checked_out', 'cancelled'],
    default: 'draft'
  },
  paymentMethod: {
    type: String,
    enum: ['corporate_credit', 'direct_billing', 'advance_payment'],
    default: 'corporate_credit'
  },
  eventDetails: {
    eventType: {
      type: String,
      enum: ['conference', 'training', 'meeting', 'team_building', 'other']
    },
    eventName: String,
    eventDescription: String,
    eventStartDate: Date,
    eventEndDate: Date,
    meetingRoomRequired: Boolean,
    cateringRequired: Boolean,
    transportRequired: Boolean
  },
  contactPerson: {
    name: {
      type: String,
      required: [true, 'Contact person name is required']
    },
    email: {
      type: String,
      required: [true, 'Contact person email is required']
    },
    phone: {
      type: String,
      required: [true, 'Contact person phone is required']
    },
    designation: String
  },
  specialInstructions: {
    type: String,
    maxlength: [1000, 'Special instructions cannot be more than 1000 characters']
  },
  invoiceDetails: {
    billingAddress: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String
    },
    billingEmail: String,
    purchaseOrderNumber: String,
    costCenter: String
  },
  metadata: {
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    lastModifiedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    source: {
      type: String,
      enum: ['web', 'phone', 'email', 'api'],
      default: 'web'
    },
    notes: String
  }
}, {
  timestamps: true
});

// Indexes
groupBookingSchema.index({ hotelId: 1, checkIn: 1, checkOut: 1 });
groupBookingSchema.index({ corporateCompanyId: 1, status: 1 });
groupBookingSchema.index({ groupCode: 1 }, { unique: true });
groupBookingSchema.index({ 'contactPerson.email': 1 });

// Pre-save middleware to calculate derived fields
groupBookingSchema.pre('save', function(next) {
  // Calculate nights
  if (this.checkIn && this.checkOut) {
    this.nights = Math.ceil((this.checkOut - this.checkIn) / (1000 * 60 * 60 * 24));
  }
  
  // Calculate total rooms
  if (this.rooms) {
    this.totalRooms = this.rooms.length;
  }
  
  // Calculate total amount
  if (this.rooms) {
    this.totalAmount = this.rooms.reduce((total, room) => total + (room.rate || 0), 0) * this.nights;
  }
  
  // Generate group code if not exists
  if (!this.groupCode && this.groupName) {
    const timestamp = Date.now().toString().slice(-6);
    const namePrefix = this.groupName.substring(0, 3).toUpperCase();
    this.groupCode = `GRP${namePrefix}${timestamp}`;
  }
  
  next();
});

// Pre-save middleware to validate check-in/out dates
groupBookingSchema.pre('save', function(next) {
  if (this.checkIn && this.checkOut && this.checkIn >= this.checkOut) {
    return next(new Error('Check-out date must be after check-in date'));
  }
  next();
});

// Virtual to get confirmed rooms count
groupBookingSchema.virtual('confirmedRoomsCount').get(function() {
  return this.rooms.filter(room => room.status === 'confirmed').length;
});

// Virtual to get pending rooms count
groupBookingSchema.virtual('pendingRoomsCount').get(function() {
  return this.rooms.filter(room => room.status === 'pending').length;
});

// Instance method to confirm specific rooms
groupBookingSchema.methods.confirmRooms = function(roomIndices) {
  roomIndices.forEach(index => {
    if (this.rooms[index]) {
      this.rooms[index].status = 'confirmed';
    }
  });
  
  // Update overall status
  const confirmedCount = this.rooms.filter(room => room.status === 'confirmed').length;
  if (confirmedCount === this.rooms.length) {
    this.status = 'confirmed';
  } else if (confirmedCount > 0) {
    this.status = 'partially_confirmed';
  }
  
  return this.save();
};

// Instance method to cancel specific rooms
groupBookingSchema.methods.cancelRooms = function(roomIndices, reason) {
  roomIndices.forEach(index => {
    if (this.rooms[index]) {
      this.rooms[index].status = 'cancelled';
      if (reason) {
        this.rooms[index].cancellationReason = reason;
      }
    }
  });
  
  // Update overall status if all rooms are cancelled
  const activeRooms = this.rooms.filter(room => room.status !== 'cancelled');
  if (activeRooms.length === 0) {
    this.status = 'cancelled';
  }
  
  return this.save();
};

// Static method to find upcoming group bookings
groupBookingSchema.statics.findUpcomingBookings = function(hotelId, days = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    hotelId,
    checkIn: { $gte: new Date(), $lte: futureDate },
    status: { $in: ['confirmed', 'partially_confirmed'] }
  }).populate('corporateCompanyId');
};

export default mongoose.model('GroupBooking', groupBookingSchema);
