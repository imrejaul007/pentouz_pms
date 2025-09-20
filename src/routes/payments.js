import express from 'express';
import Stripe from 'stripe';
import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';
import { authenticate } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * @swagger
 * /payments/intent:
 *   post:
 *     summary: Create payment intent
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bookingId
 *             properties:
 *               bookingId:
 *                 type: string
 *               amount:
 *                 type: number
 *               currency:
 *                 type: string
 *                 default: USD
 *     responses:
 *       200:
 *         description: Payment intent created successfully
 */
router.post('/intent', 
  authenticate, 
  validate(schemas.createPaymentIntent), 
  catchAsync(async (req, res) => {
    const { bookingId, amount, currency = 'INR' } = req.body;

    // Get booking
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    // Check if user owns the booking
    if (booking.userId.toString() !== req.user._id.toString()) {
      throw new ApplicationError('You do not have permission to pay for this booking', 403);
    }

    // Check if booking is still valid for payment
    if (booking.status === 'cancelled') {
      throw new ApplicationError('Cannot pay for a cancelled booking', 400);
    }

    if (booking.paymentStatus === 'paid') {
      throw new ApplicationError('Booking has already been paid', 400);
    }

    // Use booking amount if not provided
    const paymentAmount = amount || booking.totalAmount * 100; // Convert to cents

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(paymentAmount),
      currency: currency.toLowerCase(),
      metadata: {
        bookingId: bookingId,
        userId: req.user._id.toString(),
        bookingNumber: booking.bookingNumber
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Create payment record
    await Payment.create({
      bookingId,
      hotelId: booking.hotelId,
      stripePaymentIntentId: paymentIntent.id,
      amount: paymentAmount / 100,
      currency: currency.toUpperCase(),
      status: 'pending'
    });

    res.json({
      status: 'success',
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      }
    });
  })
);

/**
 * @swagger
 * /payments/confirm:
 *   post:
 *     summary: Confirm payment (server-side)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentIntentId
 *             properties:
 *               paymentIntentId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment confirmed successfully
 */
router.post('/confirm', 
  authenticate, 
  catchAsync(async (req, res) => {
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      throw new ApplicationError('Payment Intent ID is required', 400);
    }

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status === 'succeeded') {
      // Find and update payment record
      const payment = await Payment.findOneAndUpdate(
        { stripePaymentIntentId: paymentIntentId },
        { 
          status: 'succeeded',
          processedAt: new Date()
        },
        { new: true }
      );

      if (payment) {
        // Update booking status
        await Booking.findByIdAndUpdate(payment.bookingId, {
          status: 'confirmed',
          paymentStatus: 'paid',
          stripePaymentId: paymentIntentId
        });
      }

      res.json({
        status: 'success',
        data: {
          paymentIntent: {
            id: paymentIntent.id,
            status: paymentIntent.status,
            amount: paymentIntent.amount
          }
        }
      });
    } else {
      throw new ApplicationError('Payment has not been completed', 400);
    }
  })
);

/**
 * @swagger
 * /payments/refund:
 *   post:
 *     summary: Create refund
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentIntentId
 *             properties:
 *               paymentIntentId:
 *                 type: string
 *               amount:
 *                 type: number
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Refund created successfully
 */
router.post('/refund', 
  authenticate, 
  catchAsync(async (req, res) => {
    const { paymentIntentId, amount, reason } = req.body;

    if (!paymentIntentId) {
      throw new ApplicationError('Payment Intent ID is required', 400);
    }

    // Find payment record
    const payment = await Payment.findOne({ stripePaymentIntentId: paymentIntentId })
      .populate('bookingId');

    if (!payment) {
      throw new ApplicationError('Payment not found', 404);
    }

    // Check permissions (admin/staff or booking owner)
    if (req.user.role === 'guest' && 
        payment.bookingId.userId.toString() !== req.user._id.toString()) {
      throw new ApplicationError('You do not have permission to refund this payment', 403);
    }

    // Create refund in Stripe
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amount ? Math.round(amount * 100) : undefined, // Partial or full refund
      reason: reason || 'requested_by_customer',
      metadata: {
        bookingId: payment.bookingId._id.toString(),
        refundedBy: req.user._id.toString()
      }
    });

    // Update payment record
    payment.refunds.push({
      stripeRefundId: refund.id,
      amount: refund.amount / 100,
      reason: refund.reason
    });

    payment.status = refund.amount === payment.amount * 100 ? 'refunded' : 'partially_refunded';
    await payment.save();

    // Update booking status
    await Booking.findByIdAndUpdate(payment.bookingId._id, {
      paymentStatus: payment.status
    });

    res.json({
      status: 'success',
      data: {
        refund: {
          id: refund.id,
          amount: refund.amount / 100,
          status: refund.status
        }
      }
    });
  })
);

export default router;