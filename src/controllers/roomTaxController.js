import RoomTax from '../models/RoomTax.js';
import RoomType from '../models/RoomType.js';
import taxCalculationService from '../services/taxCalculationService.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

/**
 * Room Tax Controller
 * Handles CRUD operations for room taxes and tax calculations
 */

/**
 * Get all room taxes for a hotel
 */
export const getRoomTaxes = catchAsync(async (req, res, next) => {
  const { hotelId } = req.params;
  const { 
    page = 1, 
    limit = 20, 
    isActive,
    taxType, 
    taxCategory,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Build filter query
  const filter = { hotelId };
  
  if (isActive !== undefined) {
    filter.isActive = isActive === 'true';
  }
  
  if (taxType) {
    filter.taxType = taxType;
  }
  
  if (taxCategory) {
    filter.taxCategory = taxCategory;
  }

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

  const skip = (page - 1) * limit;

  // Execute query with pagination
  const [taxes, total] = await Promise.all([
    RoomTax.find(filter)
      .populate('applicableRoomTypes', 'name code category')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    RoomTax.countDocuments(filter)
  ]);

  res.status(200).json({
    status: 'success',
    results: taxes.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: {
      taxes
    }
  });
});

/**
 * Get a single room tax by ID
 */
export const getRoomTax = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const tax = await RoomTax.findById(id)
    .populate('applicableRoomTypes', 'name code category pricing')
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');

  if (!tax) {
    return next(new ApplicationError('Room tax not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      tax
    }
  });
});

/**
 * Create a new room tax
 */
export const createRoomTax = catchAsync(async (req, res, next) => {
  const { hotelId } = req.params;
  const userId = req.user._id;

  // Validate required fields
  const requiredFields = ['taxName', 'taxType', 'taxCategory'];
  for (const field of requiredFields) {
    if (!req.body[field]) {
      return next(new ApplicationError(`${field} is required`, 400));
    }
  }

  // Validate tax rate or fixed amount
  if (req.body.isPercentage && (!req.body.taxRate || req.body.taxRate <= 0)) {
    return next(new ApplicationError('Tax rate must be greater than 0 for percentage taxes', 400));
  }

  if (!req.body.isPercentage && (!req.body.fixedAmount || req.body.fixedAmount <= 0)) {
    return next(new ApplicationError('Fixed amount must be greater than 0 for fixed amount taxes', 400));
  }

  // Check for duplicate tax name
  const existingTax = await RoomTax.findOne({
    hotelId,
    taxName: req.body.taxName,
    isActive: true
  });

  if (existingTax) {
    return next(new ApplicationError('A tax with this name already exists', 400));
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

  const taxData = {
    ...req.body,
    hotelId,
    createdBy: userId
  };

  const tax = await RoomTax.create(taxData);

  // Populate the created tax
  await tax.populate([
    { path: 'applicableRoomTypes', select: 'name code category' },
    { path: 'createdBy', select: 'name email' }
  ]);

  logger.info('Room tax created', {
    taxId: tax._id,
    taxName: tax.taxName,
    hotelId,
    userId
  });

  res.status(201).json({
    status: 'success',
    data: {
      tax
    }
  });
});

/**
 * Update a room tax
 */
export const updateRoomTax = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  const tax = await RoomTax.findById(id);

  if (!tax) {
    return next(new ApplicationError('Room tax not found', 404));
  }

  // Check if tax is editable
  if (!tax.isEditable) {
    return next(new ApplicationError('This tax cannot be modified', 400));
  }

  // Validate room types if being updated
  if (req.body.applicableRoomTypes && req.body.applicableRoomTypes.length > 0) {
    const roomTypes = await RoomType.find({
      _id: { $in: req.body.applicableRoomTypes },
      hotelId: tax.hotelId
    });

    if (roomTypes.length !== req.body.applicableRoomTypes.length) {
      return next(new ApplicationError('One or more room types are invalid', 400));
    }
  }

  // Check for duplicate name if name is being changed
  if (req.body.taxName && req.body.taxName !== tax.taxName) {
    const existingTax = await RoomTax.findOne({
      hotelId: tax.hotelId,
      taxName: req.body.taxName,
      isActive: true,
      _id: { $ne: id }
    });

    if (existingTax) {
      return next(new ApplicationError('A tax with this name already exists', 400));
    }
  }

  // Update the tax
  const updatedTax = await RoomTax.findByIdAndUpdate(
    id,
    { ...req.body, updatedBy: userId },
    { new: true, runValidators: true }
  ).populate([
    { path: 'applicableRoomTypes', select: 'name code category' },
    { path: 'createdBy', select: 'name email' },
    { path: 'updatedBy', select: 'name email' }
  ]);

  logger.info('Room tax updated', {
    taxId: updatedTax._id,
    taxName: updatedTax.taxName,
    hotelId: updatedTax.hotelId,
    userId
  });

  res.status(200).json({
    status: 'success',
    data: {
      tax: updatedTax
    }
  });
});

/**
 * Delete/Deactivate a room tax
 */
export const deleteRoomTax = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  const tax = await RoomTax.findById(id);

  if (!tax) {
    return next(new ApplicationError('Room tax not found', 404));
  }

  // Check if tax is editable
  if (!tax.isEditable) {
    return next(new ApplicationError('This tax cannot be deleted', 400));
  }

  // Soft delete by setting isActive to false
  const updatedTax = await RoomTax.findByIdAndUpdate(
    id,
    { isActive: false, updatedBy: userId },
    { new: true }
  );

  logger.info('Room tax deactivated', {
    taxId: updatedTax._id,
    taxName: updatedTax.taxName,
    hotelId: updatedTax.hotelId,
    userId
  });

  res.status(204).json({
    status: 'success',
    data: null
  });
});

/**
 * Calculate taxes for booking preview
 */
export const calculateTaxes = catchAsync(async (req, res, next) => {
  const { hotelId } = req.params;
  const {
    roomTypeId,
    baseAmount,
    roomCount = 1,
    guestCount = 1,
    stayNights = 1,
    channel = 'direct',
    guestType,
    guestCountry,
    checkInDate
  } = req.body;

  if (!baseAmount || baseAmount <= 0) {
    return next(new ApplicationError('Base amount is required and must be greater than 0', 400));
  }

  try {
    const calculationResult = await taxCalculationService.calculateBookingTaxes({
      hotelId,
      roomTypeId,
      baseAmount,
      roomCount,
      guestCount,
      stayNights,
      channel,
      guestType,
      guestCountry,
      checkInDate: checkInDate ? new Date(checkInDate) : new Date()
    });

    // Add category breakdown
    const categoryBreakdown = taxCalculationService.getTaxBreakdownByCategory(
      calculationResult.taxBreakdown
    );

    res.status(200).json({
      status: 'success',
      data: {
        ...calculationResult,
        categoryBreakdown
      }
    });

  } catch (error) {
    logger.error('Tax calculation failed:', {
      error: error.message,
      hotelId,
      baseAmount,
      stack: error.stack
    });
    
    return next(new ApplicationError('Tax calculation failed', 500));
  }
});

/**
 * Get applicable taxes for specific criteria
 */
export const getApplicableTaxes = catchAsync(async (req, res, next) => {
  const { hotelId } = req.params;
  const {
    roomTypeId,
    channel,
    guestType,
    guestCountry,
    checkInDate
  } = req.query;

  const criteria = {
    roomTypeId,
    channel,
    guestType,
    guestCountry,
    checkInDate: checkInDate ? new Date(checkInDate) : new Date()
  };

  const applicableTaxes = await RoomTax.getApplicableTaxes(hotelId, criteria);

  res.status(200).json({
    status: 'success',
    results: applicableTaxes.length,
    data: {
      taxes: applicableTaxes.map(tax => ({
        id: tax._id,
        name: tax.taxName,
        type: tax.taxType,
        category: tax.taxCategory,
        rate: tax.taxRate,
        isPercentage: tax.isPercentage,
        fixedAmount: tax.fixedAmount,
        calculationMethod: tax.calculationMethod,
        description: tax.description
      }))
    }
  });
});

/**
 * Get tax summary and analytics
 */
export const getTaxSummary = catchAsync(async (req, res, next) => {
  const { hotelId } = req.params;
  const { startDate, endDate, taxType, taxCategory } = req.query;

  const summary = await taxCalculationService.getTaxSummary(hotelId, {
    startDate,
    endDate,
    taxType,
    taxCategory
  });

  res.status(200).json({
    status: 'success',
    data: {
      summary
    }
  });
});

/**
 * Bulk update tax status
 */
export const bulkUpdateTaxStatus = catchAsync(async (req, res, next) => {
  const { hotelId } = req.params;
  const { taxIds, isActive } = req.body;
  const userId = req.user._id;

  if (!Array.isArray(taxIds) || taxIds.length === 0) {
    return next(new ApplicationError('Tax IDs array is required', 400));
  }

  if (typeof isActive !== 'boolean') {
    return next(new ApplicationError('isActive must be a boolean value', 400));
  }

  const result = await RoomTax.updateMany(
    {
      _id: { $in: taxIds },
      hotelId,
      isEditable: true
    },
    {
      isActive,
      updatedBy: userId
    }
  );

  logger.info('Bulk tax status update', {
    hotelId,
    taxIds,
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
 * Get tax types and categories for dropdown options
 */
export const getTaxOptions = catchAsync(async (req, res, next) => {
  const taxTypes = [
    'VAT',
    'GST',
    'service_tax',
    'luxury_tax',
    'city_tax',
    'tourism_tax',
    'occupancy_tax',
    'resort_fee',
    'facility_tax',
    'custom'
  ];

  const taxCategories = [
    'room_charge',
    'service_charge',
    'additional_service',
    'government',
    'local_authority',
    'facility'
  ];

  const calculationMethods = [
    'per_room',
    'per_guest',
    'per_night',
    'per_booking'
  ];

  const roundingRules = [
    'round_up',
    'round_down',
    'round_nearest',
    'no_rounding'
  ];

  res.status(200).json({
    status: 'success',
    data: {
      taxTypes,
      taxCategories,
      calculationMethods,
      roundingRules
    }
  });
});

export default {
  getRoomTaxes,
  getRoomTax,
  createRoomTax,
  updateRoomTax,
  deleteRoomTax,
  calculateTaxes,
  getApplicableTaxes,
  getTaxSummary,
  bulkUpdateTaxStatus,
  getTaxOptions
};
