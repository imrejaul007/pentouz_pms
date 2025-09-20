import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     CheckoutInventory:
 *       type: object
 *       required:
 *         - bookingId
 *         - roomId
 *         - checkedBy
 *         - items
 *       properties:
 *         _id:
 *           type: string
 *         bookingId:
 *           type: string
 *           description: Booking ID
 *         roomId:
 *           type: string
 *           description: Room ID
 *         checkedBy:
 *           type: string
 *           description: Staff member who performed the check
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               itemName:
 *                 type: string
 *               category:
 *                 type: string
 *               quantity:
 *                 type: number
 *               unitPrice:
 *                 type: number
 *               totalPrice:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [used, damaged, missing, intact]
 *               notes:
 *                 type: string
 *         subtotal:
 *           type: number
 *         tax:
 *           type: number
 *         totalAmount:
 *           type: number
 *         status:
 *           type: string
 *           enum: [pending, completed, paid]
 *         paymentMethod:
 *           type: string
 *         paymentStatus:
 *           type: string
 *           enum: [pending, paid, failed]
 *         notes:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const checkoutInventorySchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Booking',
    required: [true, 'Booking ID is required'],
    index: true
  },
  roomId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Room',
    required: [true, 'Room ID is required'],
    index: true
  },
  checkedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Staff member ID is required']
  },
  items: [{
    itemName: {
      type: String,
      required: true
    },
    category: {
      type: String,
      required: true,
      enum: ['bathroom', 'bedroom', 'kitchen', 'electronics', 'furniture', 'other']
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 1
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      enum: ['used', 'damaged', 'missing', 'intact'],
      default: 'intact'
    },
    notes: {
      type: String,
      maxlength: 200
    }
  }],
  subtotal: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  tax: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'paid'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'upi', 'bank_transfer'],
    default: 'cash'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending'
  },
  notes: {
    type: String,
    maxlength: 500
  },
  checkedAt: {
    type: Date,
    default: Date.now
  },
  paidAt: {
    type: Date
  },
  isAdminBypass: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Calculate totals before saving
checkoutInventorySchema.pre('save', function(next) {
  // Calculate subtotal
  this.subtotal = this.items.reduce((sum, item) => {
    return sum + (item.totalPrice || 0);
  }, 0);

  // Calculate tax (18% GST)
  this.tax = Math.round(this.subtotal * 0.18);

  // Calculate total amount
  this.totalAmount = this.subtotal + this.tax;

  next();
});

// Virtual for formatted total amount
checkoutInventorySchema.virtual('formattedTotalAmount').get(function() {
  return `₹${this.totalAmount.toLocaleString('en-IN')}`;
});

// Virtual for formatted subtotal
checkoutInventorySchema.virtual('formattedSubtotal').get(function() {
  return `₹${this.subtotal.toLocaleString('en-IN')}`;
});

// Virtual for formatted tax
checkoutInventorySchema.virtual('formattedTax').get(function() {
  return `₹${this.tax.toLocaleString('en-IN')}`;
});

// Static method to get checkout inventory by booking
checkoutInventorySchema.statics.findByBooking = function(bookingId) {
  return this.findOne({ bookingId }).populate([
    { path: 'bookingId', select: 'bookingNumber checkIn checkOut totalAmount' },
    { path: 'roomId', select: 'roomNumber type' },
    { path: 'checkedBy', select: 'name email' }
  ]);
};

// Static method to get all checkout inventories for a hotel
checkoutInventorySchema.statics.findByHotel = function(hotelId) {
  return this.find({})
    .populate([
      { 
        path: 'bookingId', 
        select: 'bookingNumber checkIn checkOut totalAmount',
        match: { hotelId }
      },
      { path: 'roomId', select: 'roomNumber type' },
      { path: 'checkedBy', select: 'name email' }
    ])
    .then(results => results.filter(result => result.bookingId));
};

export default mongoose.model('CheckoutInventory', checkoutInventorySchema);
