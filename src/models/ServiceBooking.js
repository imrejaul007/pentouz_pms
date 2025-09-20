import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     ServiceBooking:
 *       type: object
 *       required:
 *         - userId
 *         - serviceId
 *         - hotelId
 *         - bookingDate
 *         - numberOfPeople
 *         - totalAmount
 *       properties:
 *         _id:
 *           type: string
 *           description: Service booking ID
 *         userId:
 *           type: string
 *           description: User who made the booking
 *         serviceId:
 *           type: string
 *           description: Hotel service being booked
 *         hotelId:
 *           type: string
 *           description: Hotel where service is located
 *         bookingDate:
 *           type: string
 *           format: date-time
 *           description: Date and time of service
 *         numberOfPeople:
 *           type: number
 *           description: Number of people for the service
 *         totalAmount:
 *           type: number
 *           description: Total cost of the booking
 *         currency:
 *           type: string
 *           description: Currency for the amount
 *         status:
 *           type: string
 *           enum: [pending, confirmed, completed, cancelled]
 *           description: Booking status
 *         specialRequests:
 *           type: string
 *           description: Any special requests from guest
 *         paymentStatus:
 *           type: string
 *           enum: [pending, paid, refunded]
 *           description: Payment status
 *         paymentMethod:
 *           type: string
 *           description: Method used for payment
 *         cancellationReason:
 *           type: string
 *           description: Reason for cancellation if applicable
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const serviceBookingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  serviceId: {
    type: mongoose.Schema.ObjectId,
    ref: 'HotelService',
    required: [true, 'Service ID is required'],
    index: true
  },
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required'],
    index: true
  },
  bookingDate: {
    type: Date,
    required: [true, 'Booking date is required'],
    validate: {
      validator: function(value) {
        return value > new Date();
      },
      message: 'Booking date must be in the future'
    }
  },
  numberOfPeople: {
    type: Number,
    required: [true, 'Number of people is required'],
    min: [1, 'At least 1 person is required'],
    validate: {
      validator: async function(value) {
        // Check if service capacity allows this many people
        const service = await mongoose.model('HotelService').findById(this.serviceId);
        if (service && service.capacity && value > service.capacity) {
          return false;
        }
        return true;
      },
      message: 'Number of people exceeds service capacity'
    }
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative']
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true,
    maxlength: 3
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled'],
    default: 'pending',
    index: true
  },
  specialRequests: {
    type: String,
    maxlength: [500, 'Special requests cannot exceed 500 characters']
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded'],
    default: 'pending',
    index: true
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'cash', 'upi', 'wallet', 'loyalty_points'],
    required: function() {
      return this.paymentStatus === 'paid';
    }
  },
  paymentIntentId: {
    type: String,
    trim: true
  },
  cancellationReason: {
    type: String,
    maxlength: [200, 'Cancellation reason cannot exceed 200 characters']
  },
  cancelledAt: {
    type: Date
  },
  cancelledBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  rating: {
    score: {
      type: Number,
      min: 1,
      max: 5
    },
    review: {
      type: String,
      maxlength: [500, 'Review cannot exceed 500 characters']
    },
    reviewedAt: {
      type: Date
    }
  },
  reminderSent: {
    type: Boolean,
    default: false
  },
  reminderSentAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
serviceBookingSchema.index({ userId: 1, bookingDate: -1 });
serviceBookingSchema.index({ serviceId: 1, bookingDate: 1 });
serviceBookingSchema.index({ hotelId: 1, status: 1 });
serviceBookingSchema.index({ bookingDate: 1, status: 1 });
serviceBookingSchema.index({ paymentStatus: 1, status: 1 });

// Virtual for formatted amount
serviceBookingSchema.virtual('formattedAmount').get(function() {
  return `${this.currency} ${this.totalAmount.toLocaleString()}`;
});

// Virtual for booking date display
serviceBookingSchema.virtual('bookingDateDisplay').get(function() {
  return this.bookingDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Virtual for time until booking
serviceBookingSchema.virtual('timeUntilBooking').get(function() {
  const now = new Date();
  const diff = this.bookingDate - now;
  
  if (diff <= 0) return 'Past';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ${hours} hour${hours > 1 ? 's' : ''}`;
  } else {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }
});

// Virtual for status color
serviceBookingSchema.virtual('statusColor').get(function() {
  switch (this.status) {
    case 'pending': return 'yellow';
    case 'confirmed': return 'blue';
    case 'completed': return 'green';
    case 'cancelled': return 'red';
    default: return 'gray';
  }
});

// Static method to get user bookings
serviceBookingSchema.statics.getUserBookings = async function(userId, options = {}) {
  const { page = 1, limit = 20, status } = options;
  const skip = (page - 1) * limit;
  
  const matchQuery = { userId };
  if (status) {
    matchQuery.status = status;
  }
  
  const bookings = await this.find(matchQuery)
    .sort({ bookingDate: -1 })
    .skip(skip)
    .limit(limit)
    .populate('serviceId', 'name type price images')
    .populate('hotelId', 'name');
    
  const total = await this.countDocuments(matchQuery);
  
  return {
    bookings,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      hasNext: page * limit < total,
      hasPrev: page > 1
    }
  };
};

// Static method to get service bookings
serviceBookingSchema.statics.getServiceBookings = async function(serviceId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return await this.find({
    serviceId,
    bookingDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['pending', 'confirmed'] }
  }).populate('userId', 'name email');
};

// Static method to check availability
serviceBookingSchema.statics.checkAvailability = async function(serviceId, date, numberOfPeople) {
  const service = await mongoose.model('HotelService').findById(serviceId);
  if (!service) return { available: false, reason: 'Service not found' };
  
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const existingBookings = await this.find({
    serviceId,
    bookingDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['pending', 'confirmed'] }
  });
  
  const totalBookedPeople = existingBookings.reduce((sum, booking) => sum + booking.numberOfPeople, 0);
  const availableCapacity = service.capacity - totalBookedPeople;
  
  if (availableCapacity < numberOfPeople) {
    return {
      available: false,
      reason: `Only ${availableCapacity} people can be accommodated`,
      availableCapacity
    };
  }
  
  return { available: true, availableCapacity };
};

// Instance method to cancel booking
serviceBookingSchema.methods.cancelBooking = async function(reason, cancelledBy) {
  if (this.status === 'cancelled') {
    throw new Error('Booking is already cancelled');
  }
  
  if (this.status === 'completed') {
    throw new Error('Cannot cancel completed booking');
  }
  
  this.status = 'cancelled';
  this.cancellationReason = reason;
  this.cancelledAt = new Date();
  this.cancelledBy = cancelledBy;
  
  return await this.save();
};

// Instance method to confirm booking
serviceBookingSchema.methods.confirmBooking = async function() {
  if (this.status !== 'pending') {
    throw new Error('Only pending bookings can be confirmed');
  }
  
  this.status = 'confirmed';
  return await this.save();
};

// Instance method to complete booking
serviceBookingSchema.methods.completeBooking = async function() {
  if (this.status !== 'confirmed') {
    throw new Error('Only confirmed bookings can be completed');
  }
  
  this.status = 'completed';
  return await this.save();
};

// Pre-save middleware to validate booking
serviceBookingSchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('bookingDate')) {
    // Check if booking date is in the future
    if (this.bookingDate <= new Date()) {
      return next(new Error('Booking date must be in the future'));
    }
  }
  
  if (this.isNew || this.isModified('numberOfPeople')) {
    // Check service capacity
    const service = await mongoose.model('HotelService').findById(this.serviceId);
    if (service && service.capacity && this.numberOfPeople > service.capacity) {
      return next(new Error('Number of people exceeds service capacity'));
    }
  }
  
  next();
});

export default mongoose.model('ServiceBooking', serviceBookingSchema);
