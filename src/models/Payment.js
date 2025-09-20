import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Booking',
    required: true
  },
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: true
  },
  stripePaymentIntentId: {
    type: String,
    required: true,
    unique: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    uppercase: true,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['pending', 'succeeded', 'failed', 'canceled', 'refunded', 'partially_refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'cash', 'bank_transfer'],
    default: 'card'
  },
  metadata: {
    type: Map,
    of: String
  },
  refunds: [{
    stripeRefundId: String,
    amount: Number,
    reason: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  failureReason: String,
  processedAt: Date
}, {
  timestamps: true
});

// Indexes - stripePaymentIntentId already has unique constraint in schema
paymentSchema.index({ bookingId: 1 });
paymentSchema.index({ hotelId: 1, createdAt: -1 });

export default mongoose.model('Payment', paymentSchema);
