import RoomCharge from '../models/RoomCharge.js';
import RoomType from '../models/RoomType.js';
import RoomTax from '../models/RoomTax.js';
import taxCalculationService from '../services/taxCalculationService.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

/**
 * Room Charge Controller
 * Handles CRUD operations for room charges and charge calculations
 */

/**
 * Get all room charges for a hotel
 */
export const getRoomCharges = catchAsync(async (req, res, next) => {
  const { hotelId } = req.params;
  const { 
    page = 1, 
    limit = 20, 
    isActive,
    chargeType, 
    chargeCategory,
    sortBy = 'chargeName',
    sortOrder = 'asc'
  } = req.query;

  // Build filter query
  const filter = { hotelId };
  
  if (isActive !== undefined) {
    filter.isActive = isActive === 'true';
  }
  
  if (chargeType) {
    filter.chargeType = chargeType;
  }
  
  if (chargeCategory) {
    filter.chargeCategory = chargeCategory;
  }

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

  const skip = (page - 1) * limit;

  // Execute query with pagination
  const [charges, total] = await Promise.all([
    RoomCharge.find(filter)
      .populate('applicableRoomTypes', 'name code category')
      .populate('taxConfiguration.applicableTaxes', 'taxName taxType taxRate')
      .populate('integrationSettings.revenueAccountId', 'accountCode accountName')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    RoomCharge.countDocuments(filter)
  ]);

  res.status(200).json({
    status: 'success',
    results: charges.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: {
      charges
    }
  });
});

/**
 * Get a single room charge by ID
 */
export const getRoomCharge = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const charge = await RoomCharge.findById(id)
    .populate('applicableRoomTypes', 'name code category pricing')
    .populate('taxConfiguration.applicableTaxes', 'taxName taxType taxRate taxCategory')
    .populate('integrationSettings.revenueAccountId', 'accountCode accountName revenueCategory')
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');

  if (!charge) {
    return next(new ApplicationError('Room charge not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      charge
    }
  });
});

/**
 * Create a new room charge
 */
export const createRoomCharge = catchAsync(async (req, res, next) => {
  const { hotelId } = req.params;
  const userId = req.user._id;

  // Validate required fields
  const requiredFields = ['chargeName', 'chargeCode', 'chargeType', 'chargeCategory', 'chargeAmount'];
  for (const field of requiredFields) {
    if (!req.body[field]) {
      return next(new ApplicationError(`${field} is required`, 400));
    }
  }

  // Validate charge amount
  if (req.body.chargeAmount <= 0) {
    return next(new ApplicationError('Charge amount must be greater than 0', 400));
  }

  // Check for duplicate charge code
  const existingCharge = await RoomCharge.findOne({
    hotelId,
    chargeCode: req.body.chargeCode.toUpperCase()
  });

  if (existingCharge) {
    return next(new ApplicationError('A charge with this code already exists', 400));
  }

  // Validate room types if specified
  if (req.body.applicableRoomTypes && req.body.applicableRoomTypes.length > 0) {
    const roomTypes = await RoomType.find({
      _id: { $in: req.body.applicableRoomTypes },
      hotelId
    });

    if (roomTypes.length !== req.body.applicableRoomTypes.length) {
      return next(new ApplicationError('One or more room types are invalid', 400));
    }
  }

  // Validate applicable taxes if specified
  if (req.body.taxConfiguration?.applicableTaxes && req.body.taxConfiguration.applicableTaxes.length > 0) {
    const taxes = await RoomTax.find({
      _id: { $in: req.body.taxConfiguration.applicableTaxes },
      hotelId
    });

    if (taxes.length !== req.body.taxConfiguration.applicableTaxes.length) {
      return next(new ApplicationError('One or more taxes are invalid', 400));
    }
  }

  const chargeData = {
    ...req.body,
    hotelId,
    chargeCode: req.body.chargeCode.toUpperCase(),
    createdBy: userId
  };

  const charge = await RoomCharge.create(chargeData);

  // Populate the created charge
  await charge.populate([
    { path: 'applicableRoomTypes', select: 'name code category' },
    { path: 'taxConfiguration.applicableTaxes', select: 'taxName taxType taxRate' },
    { path: 'createdBy', select: 'name email' }
  ]);

  logger.info('Room charge created', {
    chargeId: charge._id,
    chargeCode: charge.chargeCode,
    hotelId,
    userId
  });

  res.status(201).json({
    status: 'success',
    data: {
      charge
    }
  });
});

/**
 * Update a room charge
 */
export const updateRoomCharge = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  const charge = await RoomCharge.findById(id);

  if (!charge) {
    return next(new ApplicationError('Room charge not found', 404));
  }

  // Check if charge is system generated
  if (charge.isSystemGenerated && req.body.isActive === false) {
    return next(new ApplicationError('System generated charges cannot be deactivated', 400));
  }

  // Check for duplicate charge code if being changed
  if (req.body.chargeCode && req.body.chargeCode.toUpperCase() !== charge.chargeCode) {
    const existingCharge = await RoomCharge.findOne({
      hotelId: charge.hotelId,
      chargeCode: req.body.chargeCode.toUpperCase(),
      _id: { $ne: id }
    });

    if (existingCharge) {
      return next(new ApplicationError('A charge with this code already exists', 400));
    }
  }

  // Validate room types if being updated
  if (req.body.applicableRoomTypes && req.body.applicableRoomTypes.length > 0) {
    const roomTypes = await RoomType.find({
      _id: { $in: req.body.applicableRoomTypes },
      hotelId: charge.hotelId
    });

    if (roomTypes.length !== req.body.applicableRoomTypes.length) {
      return next(new ApplicationError('One or more room types are invalid', 400));
    }
  }

  // Validate applicable taxes if being updated
  if (req.body.taxConfiguration?.applicableTaxes && req.body.taxConfiguration.applicableTaxes.length > 0) {
    const taxes = await RoomTax.find({
      _id: { $in: req.body.taxConfiguration.applicableTaxes },
      hotelId: charge.hotelId
    });

    if (taxes.length !== req.body.taxConfiguration.applicableTaxes.length) {
      return next(new ApplicationError('One or more taxes are invalid', 400));
    }
  }

  // Prepare update data
  const updateData = { ...req.body, updatedBy: userId };
  if (updateData.chargeCode) {
    updateData.chargeCode = updateData.chargeCode.toUpperCase();
  }

  // Update the charge
  const updatedCharge = await RoomCharge.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  ).populate([
    { path: 'applicableRoomTypes', select: 'name code category' },
    { path: 'taxConfiguration.applicableTaxes', select: 'taxName taxType taxRate' },
    { path: 'createdBy', select: 'name email' },
    { path: 'updatedBy', select: 'name email' }
  ]);

  logger.info('Room charge updated', {
    chargeId: updatedCharge._id,
    chargeCode: updatedCharge.chargeCode,
    hotelId: updatedCharge.hotelId,
    userId
  });

  res.status(200).json({
    status: 'success',
    data: {
      charge: updatedCharge
    }
  });
});

/**
 * Delete/Deactivate a room charge
 */
export const deleteRoomCharge = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  const charge = await RoomCharge.findById(id);

  if (!charge) {
    return next(new ApplicationError('Room charge not found', 404));
  }

  // Check if charge is system generated
  if (charge.isSystemGenerated) {
    return next(new ApplicationError('System generated charges cannot be deleted', 400));
  }

  // Soft delete by setting isActive to false
  const updatedCharge = await RoomCharge.findByIdAndUpdate(
    id,
    { isActive: false, updatedBy: userId },
    { new: true }
  );

  logger.info('Room charge deactivated', {
    chargeId: updatedCharge._id,
    chargeCode: updatedCharge.chargeCode,
    hotelId: updatedCharge.hotelId,
    userId
  });

  res.status(204).json({
    status: 'success',
    data: null
  });
});

/**
 * Calculate room charges for booking preview
 */
export const calculateRoomCharges = catchAsync(async (req, res, next) => {
  const { hotelId } = req.params;
  const {
    roomTypeId,
    baseAmount,
    roomCount = 1,
    guestCount = 1,
    stayNights = 1,
    channel = 'direct',
    rateType = 'standard',
    guestType,
    guestCountry,
    checkInDate,
    includeOptionalCharges = false,
    selectedCharges = []
  } = req.body;

  if (!baseAmount || baseAmount <= 0) {
    return next(new ApplicationError('Base amount is required and must be greater than 0', 400));
  }

  try {
    const calculationResult = await taxCalculationService.calculateRoomCharges({
      hotelId,
      roomTypeId,
      baseAmount,
      roomCount,
      guestCount,
      stayNights,
      channel,
      rateType,
      guestType,
      guestCountry,
      checkInDate: checkInDate ? new Date(checkInDate) : new Date(),
      includeOptionalCharges,
      selectedCharges
    });

    res.status(200).json({
      status: 'success',
      data: calculationResult
    });

  } catch (error) {
    logger.error('Room charges calculation failed:', {
      error: error.message,
      hotelId,
      baseAmount,
      stack: error.stack
    });
    
    return next(new ApplicationError('Room charges calculation failed', 500));
  }
});

/**
 * Calculate comprehensive booking total (room + charges + taxes)
 */
export const calculateComprehensiveTotal = catchAsync(async (req, res, next) => {
  const { hotelId } = req.params;
  const {
    roomTypeId,
    baseAmount,
    roomCount = 1,
    guestCount = 1,
    stayNights = 1,
    channel = 'direct',
    rateType = 'standard',
    guestType,
    guestCountry,
    checkInDate,
    includeOptionalCharges = false,
    selectedCharges = []
  } = req.body;

  if (!baseAmount || baseAmount <= 0) {
    return next(new ApplicationError('Base amount is required and must be greater than 0', 400));
  }

  try {
    const calculationResult = await taxCalculationService.calculateComprehensiveBookingTotal({
      hotelId,
      roomTypeId,
      baseAmount,
      roomCount,
      guestCount,
      stayNights,
      channel,
      rateType,
      guestType,
      guestCountry,
      checkInDate: checkInDate ? new Date(checkInDate) : new Date(),
      includeOptionalCharges,
      selectedCharges
    });

    res.status(200).json({
      status: 'success',
      data: calculationResult
    });

  } catch (error) {
    logger.error('Comprehensive booking calculation failed:', {
      error: error.message,
      hotelId,
      baseAmount,
      stack: error.stack
    });
    
    return next(new ApplicationError('Comprehensive booking calculation failed', 500));
  }
});

/**
 * Get applicable room charges for specific criteria
 */
export const getApplicableCharges = catchAsync(async (req, res, next) => {
  const { hotelId } = req.params;
  const {
    roomTypeId,
    channel,
    rateType,
    chargeCategory,
    chargeType,
    roomRate,
    guestCount,
    stayNights,
    checkInDate
  } = req.query;

  const criteria = {
    roomTypeId,
    channel,
    rateType,
    chargeCategory,
    chargeType,
    roomRate: roomRate ? parseFloat(roomRate) : undefined,
    guestCount: guestCount ? parseInt(guestCount) : undefined,
    stayNights: stayNights ? parseInt(stayNights) : undefined,
    checkInDate: checkInDate ? new Date(checkInDate) : new Date()
  };

  const applicableCharges = await RoomCharge.getApplicableCharges(hotelId, criteria);

  res.status(200).json({
    status: 'success',
    results: applicableCharges.length,
    data: {
      charges: applicableCharges.map(charge => ({
        id: charge._id,
        name: charge.chargeName,
        code: charge.chargeCode,
        type: charge.chargeType,
        category: charge.chargeCategory,
        amount: charge.chargeAmount,
        isPercentage: charge.isPercentage,
        calculationMethod: charge.calculationMethod,
        displayName: charge.effectiveDisplayName,
        description: charge.effectiveDescription,
        isMandatory: charge.chargeCategory === 'mandatory',
        isOptional: charge.chargeCategory === 'optional'
      }))
    }
  });
});

/**
 * Get room charge summary and analytics
 */
export const getChargeSummary = catchAsync(async (req, res, next) => {
  const { hotelId } = req.params;
  const { startDate, endDate, chargeType, chargeCategory } = req.query;

  const summary = await RoomCharge.getChargeSummary(hotelId, {
    startDate,
    endDate,
    chargeType,
    chargeCategory
  });

  res.status(200).json({
    status: 'success',
    data: {
      summary
    }
  });
});

/**
 * Bulk update charge status
 */
export const bulkUpdateChargeStatus = catchAsync(async (req, res, next) => {
  const { hotelId } = req.params;
  const { chargeIds, isActive } = req.body;
  const userId = req.user._id;

  if (!Array.isArray(chargeIds) || chargeIds.length === 0) {
    return next(new ApplicationError('Charge IDs array is required', 400));
  }

  if (typeof isActive !== 'boolean') {
    return next(new ApplicationError('isActive must be a boolean value', 400));
  }

  const result = await RoomCharge.updateMany(
    {
      _id: { $in: chargeIds },
      hotelId,
      isSystemGenerated: { $ne: true } // Cannot deactivate system charges
    },
    {
      isActive,
      updatedBy: userId
    }
  );

  logger.info('Bulk charge status update', {
    hotelId,
    chargeIds,
    isActive,
    modifiedCount: result.modifiedCount,
    userId
  });

  res.status(200).json({
    status: 'success',
    data: {
      modifiedCount: result.modifiedCount
    }
  });
});

/**
 * Get charge types and categories for dropdown options
 */
export const getChargeOptions = catchAsync(async (req, res, next) => {
  const chargeTypes = [
    'service_fee',
    'resort_fee',
    'cleaning_fee',
    'damage_fee',
    'utility_fee',
    'parking_fee',
    'wifi_fee',
    'minibar_fee',
    'laundry_fee',
    'spa_fee',
    'gym_fee',
    'pet_fee',
    'early_checkin_fee',
    'late_checkout_fee',
    'amenity_fee',
    'cancellation_fee',
    'noshow_fee',
    'upgrade_fee',
    'package_fee',
    'custom_fee'
  ];

  const chargeCategories = [
    'mandatory',
    'optional',
    'conditional',
    'penalty',
    'service',
    'amenity',
    'utility'
  ];

  const calculationMethods = [
    'per_stay',
    'per_night',
    'per_guest',
    'per_room',
    'percentage'
  ];

  const percentageBases = [
    'room_rate',
    'total_amount',
    'subtotal'
  ];

  const exemptGuestTypes = [
    'VIP',
    'corporate',
    'government',
    'senior_citizen',
    'military',
    'employee'
  ];

  res.status(200).json({
    status: 'success',
    data: {
      chargeTypes,
      chargeCategories,
      calculationMethods,
      percentageBases,
      exemptGuestTypes
    }
  });
});

/**
 * Update charge audit information
 */
export const updateChargeAudit = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { totalCharges, applicationCount } = req.body;

  const charge = await RoomCharge.findById(id);

  if (!charge) {
    return next(new ApplicationError('Room charge not found', 404));
  }

  const updateData = {};
  
  if (totalCharges !== undefined) {
    updateData['auditInfo.totalCharges'] = totalCharges;
  }
  
  if (applicationCount !== undefined) {
    updateData['auditInfo.applicationCount'] = applicationCount;
  }
  
  updateData['auditInfo.lastAppliedDate'] = new Date();
  
  if (totalCharges !== undefined && applicationCount !== undefined && applicationCount > 0) {
    updateData['auditInfo.averageChargeAmount'] = totalCharges / applicationCount;
  }

  const updatedCharge = await RoomCharge.findByIdAndUpdate(
    id,
    updateData,
    { new: true }
  );

  res.status(200).json({
    status: 'success',
    data: {
      charge: updatedCharge
    }
  });
});

export default {
  getRoomCharges,
  getRoomCharge,
  createRoomCharge,
  updateRoomCharge,
  deleteRoomCharge,
  calculateRoomCharges,
  calculateComprehensiveTotal,
  getApplicableCharges,
  getChargeSummary,
  bulkUpdateChargeStatus,
  getChargeOptions,
  updateChargeAudit
};
