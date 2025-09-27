import express from 'express';
import Stripe from 'stripe';
import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';
import POSOrder from '../models/POSOrder.js';
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
        const paymentType = payment.metadata?.get('paymentType');

        if (paymentType === 'extra_person_charges') {
          // Handle extra person charges payment
          const booking = await Booking.findById(payment.bookingId);
          if (booking) {
            // Update booking with payment confirmation
            booking.extraPersonCharges = booking.extraPersonCharges || [];

            // Parse charge details from metadata
            const chargeDetails = payment.metadata?.get('chargeDetails');
            if (chargeDetails) {
              const charges = JSON.parse(chargeDetails);
              charges.forEach(charge => {
                const existingCharge = booking.extraPersonCharges.find(c => c.personId === charge.personId);
                if (existingCharge) {
                  existingCharge.paymentStatus = 'paid';
                  existingCharge.stripePaymentId = paymentIntentId;
                } else {
                  booking.extraPersonCharges.push({
                    personId: charge.personId,
                    baseCharge: charge.amount,
                    totalCharge: charge.amount,
                    currency: payment.currency,
                    description: charge.description || 'Extra person charge',
                    paymentStatus: 'paid',
                    stripePaymentId: paymentIntentId,
                    paidAt: new Date()
                  });
                }
              });
            }

            await booking.save();
          }
        } else if (paymentType === 'settlement') {
          // Handle settlement payment
          const settlementId = payment.metadata?.get('settlementId');
          if (settlementId) {
            const Settlement = (await import('../models/Settlement.js')).default;
            const settlement = await Settlement.findById(settlementId);

            if (settlement) {
              // Add payment to settlement
              settlement.payments.push({
                paymentId: payment._id,
                stripePaymentIntentId: paymentIntentId,
                amount: payment.amount,
                method: 'stripe',
                paidBy: payment.metadata?.get('paidBy'),
                paidAt: new Date()
              });

              // Update settlement status based on remaining balance
              const totalPaid = settlement.payments.reduce((sum, p) => sum + p.amount, 0);
              const remainingBalance = settlement.finalAmount - totalPaid;

              if (remainingBalance <= 0) {
                settlement.status = 'completed';
                settlement.completedAt = new Date();
              } else {
                settlement.status = 'partial';
              }

              settlement.outstandingBalance = Math.max(0, remainingBalance);
              await settlement.save();
            }
          }
        } else {
          // Standard booking payment
          await Booking.findByIdAndUpdate(payment.bookingId, {
            status: 'confirmed',
            paymentStatus: 'paid',
            stripePaymentId: paymentIntentId
          });
        }
      }

      res.json({
        status: 'success',
        data: {
          paymentIntent: {
            id: paymentIntent.id,
            status: paymentIntent.status,
            amount: paymentIntent.amount,
            paymentType: paymentIntent.metadata?.paymentType || 'booking'
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
 * /payments/extra-person-charges/intent:
 *   post:
 *     summary: Create payment intent for extra person charges
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
 *               - extraPersonCharges
 *             properties:
 *               bookingId:
 *                 type: string
 *               extraPersonCharges:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     personId:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     description:
 *                       type: string
 *               currency:
 *                 type: string
 *                 default: INR
 *     responses:
 *       200:
 *         description: Payment intent created for extra person charges
 */
router.post('/extra-person-charges/intent',
  authenticate,
  catchAsync(async (req, res) => {
    const { bookingId, extraPersonCharges, currency = 'INR' } = req.body;

    // Get booking
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    // Check permissions - only admin/staff can create extra person charge payments
    if (!['admin', 'staff'].includes(req.user.role)) {
      throw new ApplicationError('Only admin and staff can process extra person charges', 403);
    }

    // Calculate total extra person charges
    const totalExtraCharges = extraPersonCharges.reduce((sum, charge) => sum + charge.amount, 0);

    if (totalExtraCharges <= 0) {
      throw new ApplicationError('Extra person charges must be greater than 0', 400);
    }

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalExtraCharges * 100), // Convert to cents
      currency: currency.toLowerCase(),
      metadata: {
        bookingId: bookingId,
        paymentType: 'extra_person_charges',
        processedBy: req.user._id.toString(),
        bookingNumber: booking.bookingNumber,
        extraPersonCount: extraPersonCharges.length.toString()
      },
      description: `Extra person charges for booking ${booking.bookingNumber}`,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Create payment record
    await Payment.create({
      bookingId,
      hotelId: booking.hotelId,
      stripePaymentIntentId: paymentIntent.id,
      amount: totalExtraCharges,
      currency: currency.toUpperCase(),
      status: 'pending',
      paymentMethod: 'card',
      metadata: new Map([
        ['paymentType', 'extra_person_charges'],
        ['processedBy', req.user._id.toString()],
        ['extraPersonCount', extraPersonCharges.length.toString()],
        ['chargeDetails', JSON.stringify(extraPersonCharges)]
      ])
    });

    res.json({
      status: 'success',
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: totalExtraCharges,
        currency: currency.toUpperCase()
      }
    });
  })
);

/**
 * @swagger
 * /payments/settlement/intent:
 *   post:
 *     summary: Create payment intent for settlement
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
 *               - settlementId
 *               - amount
 *             properties:
 *               settlementId:
 *                 type: string
 *               amount:
 *                 type: number
 *               currency:
 *                 type: string
 *                 default: INR
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment intent created for settlement
 */
router.post('/settlement/intent',
  authenticate,
  catchAsync(async (req, res) => {
    const { settlementId, amount, currency = 'INR', description = '' } = req.body;

    // Import Settlement model
    const Settlement = (await import('../models/Settlement.js')).default;

    // Get settlement
    const settlement = await Settlement.findById(settlementId).populate('bookingId');
    if (!settlement) {
      throw new ApplicationError('Settlement not found', 404);
    }

    // Check permissions - only admin/staff or booking owner can pay settlements
    const canPay = ['admin', 'staff'].includes(req.user.role) ||
                   settlement.bookingId.userId.toString() === req.user._id.toString();

    if (!canPay) {
      throw new ApplicationError('You do not have permission to pay this settlement', 403);
    }

    if (amount <= 0) {
      throw new ApplicationError('Settlement amount must be greater than 0', 400);
    }

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      metadata: {
        settlementId: settlementId,
        bookingId: settlement.bookingId._id.toString(),
        paymentType: 'settlement',
        paidBy: req.user._id.toString(),
        bookingNumber: settlement.bookingId.bookingNumber
      },
      description: description || `Settlement payment for booking ${settlement.bookingId.bookingNumber}`,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Create payment record
    await Payment.create({
      bookingId: settlement.bookingId._id,
      hotelId: settlement.bookingId.hotelId,
      stripePaymentIntentId: paymentIntent.id,
      amount: amount,
      currency: currency.toUpperCase(),
      status: 'pending',
      paymentMethod: 'card',
      metadata: new Map([
        ['paymentType', 'settlement'],
        ['settlementId', settlementId],
        ['paidBy', req.user._id.toString()]
      ])
    });

    res.json({
      status: 'success',
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: amount,
        currency: currency.toUpperCase()
      }
    });
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

// Food ordering payment methods

// Process room charge payment for food orders
router.post('/room-charge', authenticate, catchAsync(async (req, res) => {
  const { orderId, amount, currency = 'INR', roomNumber, bookingId, items } = req.body;

  if (!amount || !bookingId) {
    throw new ApplicationError('Amount and booking ID are required', 400);
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new ApplicationError('Booking not found', 404);
  }

  if (req.user.role === 'guest' && booking.userId.toString() !== req.user._id.toString()) {
    throw new ApplicationError('Access denied', 403);
  }

  const reference = `RC-${Date.now()}`;
  const paymentData = {
    method: 'room_charge',
    status: 'paid',
    paymentDetails: { roomChargeReference: reference, roomNumber, bookingId }
  };

  if (orderId) {
    const posOrder = await POSOrder.findById(orderId);
    if (posOrder) {
      posOrder.payment = paymentData;
      await posOrder.save();
    }
  }

  const serviceCharge = {
    type: 'service_charge',
    amount: parseFloat(amount),
    description: `Room service order - ${items?.length || 0} items`,
    appliedBy: {
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role === 'guest' ? 'staff' : req.user.role
    }
  };

  if (!booking.settlementTracking) booking.settlementTracking = { adjustments: [] };
  if (!booking.settlementTracking.adjustments) booking.settlementTracking.adjustments = [];
  booking.settlementTracking.adjustments.push(serviceCharge);
  booking.totalAmount = (booking.totalAmount || 0) + parseFloat(amount);
  await booking.save();

  res.json({
    success: true,
    message: 'Amount added to room charges successfully',
    data: { transactionId: reference, amount, currency, paymentMethod: 'room_charge', status: 'paid' }
  });
}));

// Process cash on delivery for food orders
router.post('/cash-on-delivery', authenticate, catchAsync(async (req, res) => {
  const { orderId, amount, currency = 'INR', roomNumber } = req.body;

  if (!amount) {
    throw new ApplicationError('Amount is required', 400);
  }

  const reference = `COD_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const paymentData = {
    method: 'cash',
    status: 'pending',
    paymentDetails: { reference, deliveryAddress: roomNumber ? `Room ${roomNumber}` : 'Guest location' }
  };

  if (orderId) {
    const posOrder = await POSOrder.findById(orderId);
    if (posOrder) {
      posOrder.payment = paymentData;
      await posOrder.save();
    }
  }

  res.json({
    success: true,
    message: 'Cash on delivery order created successfully',
    data: { transactionId: reference, amount: parseFloat(amount), currency, paymentMethod: 'cash', status: 'pending' }
  });
}));

export default router;