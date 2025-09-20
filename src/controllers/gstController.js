import GSTCalculationService from '../services/gstCalculationService.js';
import CorporateCompany from '../models/CorporateCompany.js';
import Booking from '../models/Booking.js';
import Invoice from '../models/Invoice.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';

/**
 * @swagger
 * tags:
 *   name: GST
 *   description: GST calculation and management
 */

/**
 * @swagger
 * /api/v1/gst/calculate:
 *   post:
 *     summary: Calculate GST for given amount and configuration
 *     tags: [GST]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Base amount
 *                 required: true
 *               gstRate:
 *                 type: number
 *                 description: GST rate (default: 18)
 *               placeOfSupply:
 *                 type: string
 *                 description: Place of supply state
 *               companyState:
 *                 type: string
 *                 description: Company's state
 *     responses:
 *       200:
 *         description: GST calculation breakdown
 *       400:
 *         description: Invalid input data
 */
export const calculateGST = catchAsync(async (req, res, next) => {
  const { amount, gstRate = 18, placeOfSupply = 'Maharashtra', companyState = 'Maharashtra' } = req.body;
  
  if (!amount || amount < 0) {
    return next(new ApplicationError('Valid amount is required', 400));
  }
  
  try {
    const gstCalculation = GSTCalculationService.calculateGST(
      amount,
      gstRate,
      placeOfSupply,
      companyState
    );
    
    res.status(200).json({
      status: 'success',
      data: {
        gstCalculation
      }
    });
  } catch (error) {
    return next(new ApplicationError(error.message, 400));
  }
});

/**
 * @swagger
 * /api/v1/gst/validate-number:
 *   post:
 *     summary: Validate GST number format
 *     tags: [GST]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               gstNumber:
 *                 type: string
 *                 description: GST number to validate
 *                 required: true
 *     responses:
 *       200:
 *         description: GST number validation result
 */
export const validateGSTNumber = catchAsync(async (req, res, next) => {
  const { gstNumber } = req.body;
  
  if (!gstNumber) {
    return next(new ApplicationError('GST number is required', 400));
  }
  
  const isValid = GSTCalculationService.validateGSTNumber(gstNumber);
  
  let stateInfo = {};
  if (isValid) {
    try {
      const stateCode = GSTCalculationService.getStateCodeFromGST(gstNumber);
      const stateName = GSTCalculationService.getStateFromCode(stateCode);
      stateInfo = {
        stateCode,
        stateName
      };
    } catch (error) {
      // If state extraction fails, still return validation result
    }
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      gstNumber,
      isValid,
      ...stateInfo
    }
  });
});

/**
 * @swagger
 * /api/v1/gst/calculate-booking:
 *   post:
 *     summary: Calculate GST for booking items
 *     tags: [GST]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     description:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     unitPrice:
 *                       type: number
 *               gstDetails:
 *                 type: object
 *                 properties:
 *                   gstRate:
 *                     type: number
 *                   placeOfSupply:
 *                     type: string
 *                   companyState:
 *                     type: string
 *                   isGstApplicable:
 *                     type: boolean
 *     responses:
 *       200:
 *         description: GST calculation for booking items
 */
export const calculateBookingGST = catchAsync(async (req, res, next) => {
  const { items, gstDetails = {} } = req.body;
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    return next(new ApplicationError('Valid items array is required', 400));
  }
  
  // Validate items
  for (const item of items) {
    if (!item.quantity || item.quantity < 0) {
      return next(new ApplicationError('Valid quantity is required for all items', 400));
    }
    if (!item.unitPrice || item.unitPrice < 0) {
      return next(new ApplicationError('Valid unit price is required for all items', 400));
    }
  }
  
  try {
    const gstCalculation = GSTCalculationService.calculateBookingGST(items, gstDetails);
    
    res.status(200).json({
      status: 'success',
      data: {
        gstCalculation
      }
    });
  } catch (error) {
    return next(new ApplicationError(error.message, 400));
  }
});

/**
 * @swagger
 * /api/v1/gst/reverse-calculate:
 *   post:
 *     summary: Calculate base amount from total amount including GST
 *     tags: [GST]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               totalAmount:
 *                 type: number
 *                 description: Total amount including GST
 *                 required: true
 *               gstRate:
 *                 type: number
 *                 description: GST rate (default: 18)
 *     responses:
 *       200:
 *         description: Reverse GST calculation
 */
export const reverseCalculateGST = catchAsync(async (req, res, next) => {
  const { totalAmount, gstRate = 18 } = req.body;
  
  if (!totalAmount || totalAmount < 0) {
    return next(new ApplicationError('Valid total amount is required', 400));
  }
  
  const reverseCalculation = GSTCalculationService.calculateReverseGST(totalAmount, gstRate);
  
  res.status(200).json({
    status: 'success',
    data: {
      reverseCalculation
    }
  });
});

/**
 * @swagger
 * /api/v1/gst/generate-invoice-data/{bookingId}:
 *   get:
 *     summary: Generate GST invoice data for a booking
 *     tags: [GST]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: GST invoice data
 *       404:
 *         description: Booking not found
 */
export const generateGSTInvoiceData = catchAsync(async (req, res, next) => {
  const booking = await Booking.findOne({
    _id: req.params.bookingId,
    hotelId: req.user.hotelId
  })
  .populate('corporateBooking.corporateCompanyId')
  .populate('hotelId');
  
  if (!booking) {
    return next(new ApplicationError('Booking not found', 404));
  }
  
  if (!booking.corporateBooking?.corporateCompanyId) {
    return next(new ApplicationError('This is not a corporate booking', 400));
  }
  
  const company = booking.corporateBooking.corporateCompanyId;
  const hotel = booking.hotelId;
  
  const invoiceData = GSTCalculationService.generateGSTInvoiceData(
    booking,
    company,
    hotel
  );
  
  res.status(200).json({
    status: 'success',
    data: {
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
      company: {
        name: company.name,
        gstNumber: company.gstNumber
      },
      ...invoiceData
    }
  });
});

/**
 * @swagger
 * /api/v1/gst/state-codes:
 *   get:
 *     summary: Get all Indian state codes for GST
 *     tags: [GST]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of state codes and names
 */
export const getStateCodes = catchAsync(async (req, res, next) => {
  const stateCodes = {
    '01': 'Jammu and Kashmir',
    '02': 'Himachal Pradesh',
    '03': 'Punjab',
    '04': 'Chandigarh',
    '05': 'Uttarakhand',
    '06': 'Haryana',
    '07': 'Delhi',
    '08': 'Rajasthan',
    '09': 'Uttar Pradesh',
    '10': 'Bihar',
    '11': 'Sikkim',
    '12': 'Arunachal Pradesh',
    '13': 'Nagaland',
    '14': 'Manipur',
    '15': 'Mizoram',
    '16': 'Tripura',
    '17': 'Meghalaya',
    '18': 'Assam',
    '19': 'West Bengal',
    '20': 'Jharkhand',
    '21': 'Orissa',
    '22': 'Chhattisgarh',
    '23': 'Madhya Pradesh',
    '24': 'Gujarat',
    '25': 'Daman and Diu',
    '26': 'Dadra and Nagar Haveli',
    '27': 'Maharashtra',
    '29': 'Karnataka',
    '30': 'Goa',
    '31': 'Lakshadweep',
    '32': 'Kerala',
    '33': 'Tamil Nadu',
    '34': 'Puducherry',
    '35': 'Andaman and Nicobar Islands',
    '36': 'Telangana',
    '37': 'Andhra Pradesh',
    '38': 'Ladakh'
  };
  
  const stateList = Object.entries(stateCodes).map(([code, name]) => ({
    code,
    name
  }));
  
  res.status(200).json({
    status: 'success',
    results: stateList.length,
    data: {
      stateCodes: stateList
    }
  });
});

/**
 * @swagger
 * /api/v1/gst/update-booking-gst/{bookingId}:
 *   patch:
 *     summary: Update GST details for a booking
 *     tags: [GST]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               gstNumber:
 *                 type: string
 *               gstRate:
 *                 type: number
 *               isGstApplicable:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Booking GST details updated
 *       404:
 *         description: Booking not found
 */
export const updateBookingGSTDetails = catchAsync(async (req, res, next) => {
  const { gstNumber, gstRate, isGstApplicable } = req.body;
  
  // Validate GST number if provided
  if (gstNumber && !GSTCalculationService.validateGSTNumber(gstNumber)) {
    return next(new ApplicationError('Invalid GST number format', 400));
  }
  
  const booking = await Booking.findOne({
    _id: req.params.bookingId,
    hotelId: req.user.hotelId
  });
  
  if (!booking) {
    return next(new ApplicationError('Booking not found', 404));
  }
  
  const updateData = {};
  if (gstNumber !== undefined) updateData['gstDetails.gstNumber'] = gstNumber;
  if (gstRate !== undefined) updateData['gstDetails.gstRate'] = gstRate;
  if (isGstApplicable !== undefined) updateData['gstDetails.isGstApplicable'] = isGstApplicable;
  
  // Recalculate GST amounts if applicable
  if (gstRate !== undefined || isGstApplicable !== undefined) {
    const newGstRate = gstRate !== undefined ? gstRate : booking.gstDetails?.gstRate || 18;
    const newIsGstApplicable = isGstApplicable !== undefined ? isGstApplicable : (booking.gstDetails?.isGstApplicable !== false);
    
    if (newIsGstApplicable) {
      const gstCalculation = GSTCalculationService.calculateGST(booking.totalAmount, newGstRate);
      updateData['gstDetails.gstAmount'] = gstCalculation.totalGstAmount;
      updateData['gstDetails.cgst'] = gstCalculation.cgstAmount;
      updateData['gstDetails.sgst'] = gstCalculation.sgstAmount;
      updateData['gstDetails.igst'] = gstCalculation.igstAmount;
    } else {
      updateData['gstDetails.gstAmount'] = 0;
      updateData['gstDetails.cgst'] = 0;
      updateData['gstDetails.sgst'] = 0;
      updateData['gstDetails.igst'] = 0;
    }
  }
  
  const updatedBooking = await Booking.findByIdAndUpdate(
    req.params.bookingId,
    updateData,
    { new: true, runValidators: true }
  );
  
  res.status(200).json({
    status: 'success',
    data: {
      booking: updatedBooking,
      gstDetails: updatedBooking.gstDetails
    }
  });
});
