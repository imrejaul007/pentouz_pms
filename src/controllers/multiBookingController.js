import MultiBooking from '../models/MultiBooking.js';
import TravelAgent from '../models/TravelAgent.js';
import TravelAgentBooking from '../models/TravelAgentBooking.js';
import Booking from '../models/Booking.js';
import RoomType from '../models/RoomType.js';
import Hotel from '../models/Hotel.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import mongoose from 'mongoose';
import emailNotificationService from '../services/emailNotificationService.js';
import logger from '../utils/logger.js';

/**
 * Map room type names to Booking model enum values
 */
function mapRoomTypeNameToEnum(roomTypeName) {
  const mapping = {
    'standard room': 'single',
    'deluxe room': 'deluxe',
    'executive room': 'suite',
    'suite': 'suite',
    'presidential suite': 'suite',
    'single': 'single',
    'double': 'double',
    'deluxe': 'deluxe'
  };
  
  return mapping[roomTypeName.toLowerCase()] || 'deluxe'; // Default to deluxe if not found
}

/**
 * @swagger
 * components:
 *   tags:
 *     name: MultiBooking
 *     description: Multi-booking management for travel agents
 */

/**
 * @swagger
 * /api/v1/travel-agents/multi-booking:
 *   post:
 *     summary: Create a multi-booking for travel agents
 *     tags: [MultiBooking]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - travelAgentId
 *               - hotelId
 *               - groupDetails
 *               - bookings
 *               - paymentDetails
 *             properties:
 *               travelAgentId:
 *                 type: string
 *               hotelId:
 *                 type: string
 *               groupDetails:
 *                 type: object
 *               bookings:
 *                 type: array
 *               paymentDetails:
 *                 type: object
 *     responses:
 *       201:
 *         description: Multi-booking created successfully
 *       400:
 *         description: Invalid input data
 */
export const createMultiBooking = catchAsync(async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const {
        hotelId,
        groupDetails,
        bookings,
        paymentDetails,
        specialConditions,
        metadata,
        notes
      } = req.body;

      // Get travel agent ID from authenticated user
      let travelAgentId;
      let travelAgent;
      if (req.user.role === 'travel_agent') {
        // For travel agents, find their profile using their user ID
        travelAgent = await TravelAgent.findOne({ userId: req.user._id }).session(session);
        if (!travelAgent || travelAgent.status !== 'active') {
          throw new ApplicationError('Travel agent profile not found or not active', 404);
        }
        travelAgentId = travelAgent._id;
      } else {
        // For admin/manager, use the travelAgentId from request body
        travelAgentId = req.body.travelAgentId;
        if (!travelAgentId) {
          throw new ApplicationError('Travel agent ID is required', 400);
        }
        
        // Verify travel agent exists and is active
        travelAgent = await TravelAgent.findById(travelAgentId).session(session);
        if (!travelAgent || travelAgent.status !== 'active') {
          throw new ApplicationError('Travel agent not found or not active', 404);
        }
      }

      // Verify hotel exists
      const hotel = await Hotel.findById(hotelId).session(session);
      if (!hotel) {
        throw new ApplicationError('Hotel not found', 404);
      }

      // Validate room availability for all requested bookings
      const roomTypeIds = bookings.map(booking => booking.roomTypeId);
      const roomTypes = await RoomType.find({ _id: { $in: roomTypeIds } }).session(session);

      if (roomTypes.length !== roomTypeIds.length) {
        throw new ApplicationError('One or more room types not found', 404);
      }

      // Check travel agent booking limits
      const canBook = travelAgent.canMakeBooking();
      if (!canBook.allowed) {
        throw new ApplicationError(canBook.reason, 400);
      }

      // Calculate total rooms and validate against agent limits
      const totalRooms = bookings.reduce((sum, booking) => sum + booking.quantity, 0);
      if (totalRooms > travelAgent.bookingLimits.maxRoomsPerBooking) {
        throw new ApplicationError(`Total rooms (${totalRooms}) exceeds agent limit (${travelAgent.bookingLimits.maxRoomsPerBooking})`, 400);
      }

      // Create multi-booking document
      const multiBooking = new MultiBooking({
        groupReferenceId: `GRP${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
        travelAgentId,
        agentCode: travelAgent.agentCode,
        hotelId,
        groupDetails: {
          ...groupDetails,
          totalRooms,
          totalGuests: groupDetails.totalGuests || bookings.reduce((sum, booking) =>
            sum + (booking.guestDetails?.adults || 1) + (booking.guestDetails?.children || 0), 0
          )
        },
        bookings: bookings.map(booking => ({
          ...booking,
          status: 'pending',
          roomTypeName: roomTypes.find(rt => rt._id.toString() === booking.roomTypeId.toString())?.name || 'Unknown',
          totalAmount: booking.ratePerNight * booking.quantity * groupDetails.nights
        })),
        paymentDetails,
        specialConditions: specialConditions || {},
        metadata: metadata || {},
        notes,
        commission: {
          rate: travelAgent.getCommissionRate(bookings[0].roomTypeId, metadata?.season || 'regular'),
          bulkBonusRate: calculateBulkBonusRate(totalRooms),
          paymentStatus: 'pending'
        }
      });

      // Calculate bulk pricing
      multiBooking.calculateBulkPricing(calculateBulkDiscountRate(totalRooms));

      // Initialize transaction tracking
      await multiBooking.addTransactionStep(1, 'validate_availability', 'completed', {
        roomTypes: roomTypes.map(rt => ({ id: rt._id, name: rt.name, available: true }))
      }, session);

      await multiBooking.save({ session });

      // Begin room reservation process
      await multiBooking.addTransactionStep(2, 'reserve_rooms', 'in_progress', {}, session);

      // Process individual bookings
      const bookingPromises = multiBooking.bookings.map(async (bookingData, index) => {
        try {
          // Create individual booking
          const individualBooking = new Booking({
            userId: req.user._id,
            hotelId,
            roomIds: [], // Will be assigned later
            roomType: mapRoomTypeNameToEnum(bookingData.roomTypeName),
            checkIn: groupDetails.checkIn,
            checkOut: groupDetails.checkOut,
            nights: groupDetails.nights, // Add the required nights field
            guestDetails: {
              adults: bookingData.guestDetails.adults,
              children: bookingData.guestDetails.children,
              specialRequests: `Group booking: ${groupDetails.groupName}. Primary contact: ${groupDetails.primaryContact.name}`
            },
            totalAmount: bookingData.totalAmount,
            currency: multiBooking.pricing.currency,
            paymentStatus: 'pending',
            status: 'confirmed',
            metadata: {
              multiBookingId: multiBooking._id,
              groupReferenceId: multiBooking.groupReferenceId,
              isGroupBooking: true,
              bookingIndex: index
            }
          });

          await individualBooking.save({ session });

          // Create travel agent booking entry
          const travelAgentBooking = new TravelAgentBooking({
            bookingId: individualBooking._id,
            travelAgentId,
            agentCode: travelAgent.agentCode,
            hotelId,
            guestDetails: {
              primaryGuest: bookingData.guestDetails.primaryGuest,
              totalGuests: bookingData.guestDetails.adults + bookingData.guestDetails.children,
              totalRooms: bookingData.quantity
            },
            bookingDetails: {
              checkIn: groupDetails.checkIn,
              checkOut: groupDetails.checkOut,
              nights: groupDetails.nights,
              roomTypes: [{
                roomTypeId: bookingData.roomTypeId,
                roomTypeName: bookingData.roomTypeName,
                quantity: bookingData.quantity,
                ratePerNight: bookingData.ratePerNight,
                specialRate: bookingData.specialRate,
                totalAmount: bookingData.totalAmount
              }]
            },
            pricing: {
              subtotal: bookingData.totalAmount,
              taxes: 0,
              fees: 0,
              discounts: 0,
              totalAmount: bookingData.totalAmount
            },
            commission: {
              rate: multiBooking.commission.rate,
              amount: (bookingData.totalAmount * multiBooking.commission.rate) / 100,
              bonusRate: multiBooking.commission.bulkBonusRate,
              bonusAmount: (bookingData.totalAmount * multiBooking.commission.bulkBonusRate) / 100,
              paymentStatus: 'pending'
            },
            paymentDetails: {
              method: paymentDetails.method,
              status: 'pending'
            },
            performance: {
              bookingSource: 'online', // Changed from 'api' to valid enum value
              leadTime: Math.ceil((new Date(groupDetails.checkIn) - new Date()) / (1000 * 60 * 60 * 24)),
              seasonality: metadata?.season || 'high' // Changed from 'regular' to valid enum value
            },
            notes: `Multi-booking group: ${groupDetails.groupName}`
          });

          await travelAgentBooking.save({ session });

          // Update multi-booking with individual booking reference
          multiBooking.bookings[index].bookingId = individualBooking._id;
          multiBooking.bookings[index].status = 'confirmed';

          return {
            success: true,
            bookingId: individualBooking._id,
            travelAgentBookingId: travelAgentBooking._id
          };
        } catch (error) {
          // Mark this booking as failed
          multiBooking.bookings[index].status = 'failed';
          multiBooking.bookings[index].failureReason = error.message;

          // Add to failed bookings array
          multiBooking.failedBookings.push({
            roomTypeId: bookingData.roomTypeId,
            roomTypeName: bookingData.roomTypeName,
            quantity: bookingData.quantity,
            reason: error.message,
            attemptedAt: new Date()
          });

          return {
            success: false,
            error: error.message,
            roomTypeId: bookingData.roomTypeId
          };
        }
      });

      const bookingResults = await Promise.allSettled(bookingPromises);
      const successfulBookings = bookingResults.filter(result =>
        result.status === 'fulfilled' && result.value.success
      ).length;

      // Update transaction status
      if (successfulBookings > 0) {
        await multiBooking.updateTransactionStep(2, 'completed', {
          successfulBookings,
          totalBookings: bookings.length,
          successRate: (successfulBookings / bookings.length) * 100
        });

        if (successfulBookings === bookings.length) {
          await multiBooking.addTransactionStep(3, 'confirm_bookings', 'completed', {}, session);
          multiBooking.status = 'confirmed';
        } else {
          multiBooking.status = 'partially_booked';
        }
      } else {
        await multiBooking.updateTransactionStep(2, 'failed', {
          reason: 'All individual bookings failed'
        });
        multiBooking.status = 'failed';
      }

      await multiBooking.save({ session });

      // Update travel agent performance metrics
      if (successfulBookings > 0) {
        await travelAgent.updatePerformanceMetrics({
          totalAmount: multiBooking.pricing.totalAmount,
          commissionAmount: multiBooking.commission.finalCommission
        });

        // Send booking confirmation email
        try {
          const bookingConfirmationData = {
            bookingNumber: multiBooking.groupReferenceId,
            guestDetails: groupDetails.primaryContact,
            checkIn: groupDetails.checkIn,
            checkOut: groupDetails.checkOut,
            totalAmount: multiBooking.pricing.totalAmount,
            commissionAmount: multiBooking.commission.finalCommission
          };

          await emailNotificationService.sendBookingConfirmationEmail(
            bookingConfirmationData,
            travelAgent
          );

          logger.info(`Booking confirmation email sent for multi-booking ${multiBooking.groupReferenceId}`);
        } catch (emailError) {
          logger.error('Failed to send booking confirmation email:', emailError);
          // Don't fail the entire booking process for email errors
        }
      }

      res.status(201).json({
        success: true,
        message: `Multi-booking created with ${successfulBookings}/${bookings.length} successful bookings`,
        data: {
          multiBooking: {
            _id: multiBooking._id,
            groupReferenceId: multiBooking.groupReferenceId,
            status: multiBooking.status,
            pricing: multiBooking.pricing,
            commission: multiBooking.commission,
            groupDetails: multiBooking.groupDetails,
            bookings: multiBooking.bookings,
            createdAt: multiBooking.createdAt
          },
          bookingResults: bookingResults.map(result =>
            result.status === 'fulfilled' ? result.value : { success: false, error: result.reason }
          )
        }
      });
    });
  } catch (error) {
    throw error;
  } finally {
    await session.endSession();
  }
});

/**
 * @swagger
 * /api/v1/travel-agents/multi-booking/{id}:
 *   get:
 *     summary: Get multi-booking by ID
 *     tags: [MultiBooking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Multi-booking details
 *       404:
 *         description: Multi-booking not found
 */
export const getMultiBookingById = catchAsync(async (req, res) => {
  const { id } = req.params;

  const multiBooking = await MultiBooking.findById(id)
    .populate('travelAgent', 'companyName agentCode contactPerson phone email')
    .populate('hotel', 'name address phone email')
    .populate('bookings.roomTypeId', 'name description amenities')
    .populate('bookings.bookingId', 'bookingNumber status checkIn checkOut roomIds');

  if (!multiBooking) {
    throw new ApplicationError('Multi-booking not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'travel_agent') {
    const userTravelAgent = await TravelAgent.findOne({ userId: req.user._id });
    if (!userTravelAgent || multiBooking.travelAgentId.toString() !== userTravelAgent._id.toString()) {
      throw new ApplicationError('Access denied', 403);
    }
  }

  res.json({
    success: true,
    data: {
      multiBooking,
      summary: multiBooking.getBookingSummary()
    }
  });
});

/**
 * @swagger
 * /api/v1/travel-agents/multi-booking/{id}/status:
 *   patch:
 *     summary: Update multi-booking status
 *     tags: [MultiBooking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, confirmed, failed, partially_booked, cancelled]
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Status updated successfully
 */
export const updateMultiBookingStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  const multiBooking = await MultiBooking.findById(id);
  if (!multiBooking) {
    throw new ApplicationError('Multi-booking not found', 404);
  }

  const oldStatus = multiBooking.status;
  multiBooking.status = status;

  // Handle status-specific logic
  if (status === 'cancelled') {
    // Cancel all individual bookings
    for (const booking of multiBooking.bookings) {
      if (booking.bookingId && booking.status === 'confirmed') {
        await Booking.findByIdAndUpdate(booking.bookingId, {
          status: 'cancelled',
          cancellationReason: reason || 'Group booking cancelled'
        });

        await TravelAgentBooking.findOneAndUpdate(
          { bookingId: booking.bookingId },
          {
            bookingStatus: 'cancelled',
            'commission.paymentStatus': 'cancelled'
          }
        );
      }
    }

    // Update commission status
    multiBooking.commission.paymentStatus = 'cancelled';

    // Add transaction step for cancellation
    await multiBooking.addTransactionStep(
      multiBooking.transaction.steps.length + 1,
      'cancel_bookings',
      'completed',
      { reason, cancelledAt: new Date() }
    );
  }

  if (status === 'failed' && oldStatus !== 'failed') {
    // Initiate rollback for failed multi-booking
    await multiBooking.initiateRollback(reason || 'Multi-booking failed');
  }

  await multiBooking.save();

  res.json({
    success: true,
    message: `Multi-booking status updated to ${status}`,
    data: {
      multiBooking,
      oldStatus,
      newStatus: status,
      reason
    }
  });
});

/**
 * @swagger
 * /api/v1/travel-agents/multi-booking/calculate-pricing:
 *   post:
 *     summary: Calculate bulk pricing for multi-booking
 *     tags: [MultiBooking]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bookings
 *               - travelAgentId
 *             properties:
 *               bookings:
 *                 type: array
 *               travelAgentId:
 *                 type: string
 *               applyBulkDiscount:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Pricing calculation completed
 */
export const calculateBulkPricing = catchAsync(async (req, res) => {
  const { bookings, applyBulkDiscount = true } = req.body;

  // Get travel agent ID from authenticated user
  let travelAgentId;
  if (req.user.role === 'travel_agent') {
    // For travel agents, find their profile using their user ID
    const travelAgent = await TravelAgent.findOne({ userId: req.user._id });
    if (!travelAgent || travelAgent.status !== 'active') {
      throw new ApplicationError('Travel agent profile not found or not active', 404);
    }
    travelAgentId = travelAgent._id;
  } else {
    // For admin/manager, use the travelAgentId from request body
    travelAgentId = req.body.travelAgentId;
    if (!travelAgentId) {
      throw new ApplicationError('Travel agent ID is required', 400);
    }
  }

  // Verify travel agent
  const travelAgent = await TravelAgent.findById(travelAgentId);
  if (!travelAgent) {
    throw new ApplicationError('Travel agent not found', 404);
  }

  // Validate room types
  const roomTypeIds = bookings.map(booking => booking.roomTypeId);
  const roomTypes = await RoomType.find({ _id: { $in: roomTypeIds } });

  if (roomTypes.length !== roomTypeIds.length) {
    throw new ApplicationError('One or more room types not found', 404);
  }

  let subtotal = 0;
  const totalRooms = bookings.reduce((sum, booking) => sum + booking.quantity, 0);

  // Calculate subtotal
  const bookingCalculations = bookings.map(booking => {
    const roomType = roomTypes.find(rt => rt._id.toString() === booking.roomTypeId.toString());
    const baseRate = booking.ratePerNight || roomType.baseRate;
    const specialRate = booking.specialRate || baseRate;
    const nights = booking.nights || 1;
    const totalAmount = specialRate * booking.quantity * nights;

    subtotal += totalAmount;

    return {
      ...booking,
      roomTypeName: roomType.name,
      baseRate,
      specialRate,
      totalAmount,
      savings: (baseRate - specialRate) * booking.quantity * nights
    };
  });

  // Calculate bulk discount
  const bulkDiscountRate = applyBulkDiscount ? calculateBulkDiscountRate(totalRooms) : 0;
  const bulkDiscount = (subtotal * bulkDiscountRate) / 100;

  // Calculate taxes (18% GST)
  const taxRate = 18;
  const totalTaxes = ((subtotal - bulkDiscount) * taxRate) / 100;

  // Calculate commission
  const commissionRate = travelAgent.getCommissionRate(bookings[0].roomTypeId, 'regular');
  const bulkBonusRate = calculateBulkBonusRate(totalRooms);
  const baseCommission = ((subtotal - bulkDiscount) * commissionRate) / 100;
  const bulkBonus = ((subtotal - bulkDiscount) * bulkBonusRate) / 100;
  const totalCommission = baseCommission + bulkBonus;

  const pricing = {
    subtotal,
    bulkDiscount,
    bulkDiscountRate,
    totalTaxes,
    taxRate,
    totalAmount: subtotal - bulkDiscount + totalTaxes,
    currency: 'INR',
    commission: {
      rate: commissionRate,
      bulkBonusRate,
      baseCommission,
      bulkBonus,
      totalCommission
    },
    bookingBreakdown: bookingCalculations,
    summary: {
      totalRooms,
      totalBookings: bookings.length,
      averageRoomRate: subtotal / totalRooms,
      savingsFromBulkDiscount: bulkDiscount,
      netAmount: subtotal - bulkDiscount + totalTaxes
    }
  };

  res.json({
    success: true,
    data: {
      pricing,
      travelAgent: {
        companyName: travelAgent.companyName,
        agentCode: travelAgent.agentCode,
        commissionRate: travelAgent.commissionStructure.defaultRate
      }
    }
  });
});

/**
 * @swagger
 * /api/v1/travel-agents/multi-booking/{id}/rollback:
 *   post:
 *     summary: Rollback failed multi-booking
 *     tags: [MultiBooking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Rollback completed successfully
 */
export const rollbackFailedBookings = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const multiBooking = await MultiBooking.findById(id).session(session);
      if (!multiBooking) {
        throw new ApplicationError('Multi-booking not found', 404);
      }

      if (multiBooking.transaction.status === 'rolled_back') {
        throw new ApplicationError('Multi-booking already rolled back', 400);
      }

      // Initiate rollback
      await multiBooking.initiateRollback(reason);

      // Cancel confirmed bookings
      const rollbackSteps = [];

      for (const booking of multiBooking.bookings) {
        if (booking.bookingId && booking.status === 'confirmed') {
          try {
            // Cancel main booking
            await Booking.findByIdAndUpdate(
              booking.bookingId,
              {
                status: 'cancelled',
                cancellationReason: `Rollback: ${reason}`
              },
              { session }
            );

            // Cancel travel agent booking
            await TravelAgentBooking.findOneAndUpdate(
              { bookingId: booking.bookingId },
              {
                bookingStatus: 'cancelled',
                'commission.paymentStatus': 'cancelled'
              },
              { session }
            );

            rollbackSteps.push({
              action: `cancel_booking_${booking.bookingId}`,
              status: 'completed',
              details: {
                bookingId: booking.bookingId,
                roomType: booking.roomTypeName,
                quantity: booking.quantity
              }
            });

            // Update booking status in multi-booking
            booking.status = 'cancelled';
          } catch (error) {
            rollbackSteps.push({
              action: `cancel_booking_${booking.bookingId}`,
              status: 'failed',
              details: {
                error: error.message,
                bookingId: booking.bookingId
              }
            });
          }
        }
      }

      // Add rollback steps
      for (const step of rollbackSteps) {
        await multiBooking.addRollbackStep(step.action, step.status, step.details);
      }

      await multiBooking.save({ session });

      res.json({
        success: true,
        message: 'Multi-booking rollback completed',
        data: {
          multiBooking,
          rollbackSteps,
          rollbackSummary: {
            totalSteps: rollbackSteps.length,
            successfulSteps: rollbackSteps.filter(s => s.status === 'completed').length,
            failedSteps: rollbackSteps.filter(s => s.status === 'failed').length
          }
        }
      });
    });
  } finally {
    await session.endSession();
  }
});

/**
 * Get multi-bookings for a travel agent
 */
export const getAgentMultiBookings = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, status, startDate, endDate } = req.query;
  const skip = (page - 1) * limit;

  let travelAgentId;

  if (req.user.role === 'travel_agent') {
    const travelAgent = await TravelAgent.findOne({ userId: req.user._id });
    if (!travelAgent) {
      throw new ApplicationError('Travel agent profile not found', 404);
    }
    travelAgentId = travelAgent._id;
  } else {
    travelAgentId = req.query.travelAgentId;
  }

  let query = { isActive: true };

  if (travelAgentId) {
    query.travelAgentId = travelAgentId;
  }

  if (req.user.role !== 'super_admin' && req.user.hotelId) {
    query.hotelId = req.user.hotelId;
  }

  if (status) {
    query.status = status;
  }

  if (startDate && endDate) {
    query.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  const multiBookings = await MultiBooking.find(query)
    .populate('travelAgent', 'companyName agentCode contactPerson')
    .populate('hotel', 'name address')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await MultiBooking.countDocuments(query);

  res.json({
    success: true,
    data: {
      multiBookings: multiBookings.map(mb => ({
        ...mb.toObject(),
        summary: mb.getBookingSummary()
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNext: skip + multiBookings.length < total,
        hasPrev: page > 1
      }
    }
  });
});

/**
 * Get multi-booking analytics
 */
export const getMultiBookingAnalytics = catchAsync(async (req, res) => {
  const { period = 'month', hotelId } = req.query;

  let targetHotelId = hotelId;
  if (req.user.role !== 'super_admin' && req.user.hotelId) {
    targetHotelId = req.user.hotelId;
  }

  const analytics = await MultiBooking.getMultiBookingAnalytics(targetHotelId, period);

  // Get top performing agents
  const topAgents = await MultiBooking.aggregate([
    {
      $match: {
        hotelId: targetHotelId ? mongoose.Types.ObjectId(targetHotelId) : { $exists: true },
        isActive: true,
        status: { $in: ['confirmed', 'partially_booked'] }
      }
    },
    {
      $group: {
        _id: '$travelAgentId',
        totalMultiBookings: { $sum: 1 },
        totalRevenue: { $sum: '$pricing.totalAmount' },
        totalCommission: { $sum: '$commission.finalCommission' },
        avgGroupSize: { $avg: '$groupDetails.totalRooms' }
      }
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'travelagents',
        localField: '_id',
        foreignField: '_id',
        as: 'agent'
      }
    },
    { $unwind: '$agent' }
  ]);

  res.json({
    success: true,
    data: {
      analytics: analytics[0] || {},
      topPerformingAgents: topAgents.map(agent => ({
        agentId: agent._id,
        companyName: agent.agent.companyName,
        agentCode: agent.agent.agentCode,
        totalMultiBookings: agent.totalMultiBookings,
        totalRevenue: agent.totalRevenue,
        totalCommission: agent.totalCommission,
        avgGroupSize: Math.round(agent.avgGroupSize * 100) / 100
      })),
      period
    }
  });
});

// Helper functions
function calculateBulkDiscountRate(totalRooms) {
  if (totalRooms >= 20) return 15; // 15% for 20+ rooms
  if (totalRooms >= 15) return 12; // 12% for 15+ rooms
  if (totalRooms >= 10) return 10; // 10% for 10+ rooms
  if (totalRooms >= 5) return 5;   // 5% for 5+ rooms
  return 0; // No discount for less than 5 rooms
}

function calculateBulkBonusRate(totalRooms) {
  if (totalRooms >= 20) return 5; // 5% bonus for 20+ rooms
  if (totalRooms >= 15) return 3; // 3% bonus for 15+ rooms
  if (totalRooms >= 10) return 2; // 2% bonus for 10+ rooms
  if (totalRooms >= 5) return 1;  // 1% bonus for 5+ rooms
  return 0; // No bonus for less than 5 rooms
}