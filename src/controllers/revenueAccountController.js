import RevenueAccount from '../models/RevenueAccount.js';
import RoomType from '../models/RoomType.js';
import revenueTrackingService from '../services/revenueTrackingService.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

/**
 * Revenue Account Controller
 * Handles CRUD operations for revenue accounts and revenue tracking
 */

/**
 * Get all revenue accounts for a hotel
 */
export const getRevenueAccounts = catchAsync(async (req, res, next) => {
  const { hotelId } = req.params;
  const { 
    page = 1, 
    limit = 20, 
    isActive,
    revenueCategory, 
    accountType,
    reportingGroup,
    parentAccount,
    sortBy = 'accountCode',
    sortOrder = 'asc',
    hierarchical = false
  } = req.query;

  if (hierarchical === 'true') {
    // Return hierarchical structure
    const hierarchy = await RevenueAccount.getAccountHierarchy(hotelId);
    
    return res.status(200).json({
      status: 'success',
      data: {
        accounts: hierarchy
      }
    });
  }

  // Build filter query
  const filter = { hotelId };
  
  if (isActive !== undefined) {
    filter.isActive = isActive === 'true';
  }
  
  if (revenueCategory) {
    filter.revenueCategory = revenueCategory;
  }
  
  if (accountType) {
    filter.accountType = accountType;
  }

  if (reportingGroup) {
    filter.reportingGroup = reportingGroup;
  }

  if (parentAccount) {
    filter.parentAccount = parentAccount === 'null' ? null : parentAccount;
  }

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

  const skip = (page - 1) * limit;

  // Execute query with pagination
  const [accounts, total] = await Promise.all([
    RevenueAccount.find(filter)
      .populate('parentAccount', 'accountCode accountName accountLevel')
      .populate('applicableRoomTypes', 'name code category')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    RevenueAccount.countDocuments(filter)
  ]);

  res.status(200).json({
    status: 'success',
    results: accounts.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: {
      accounts
    }
  });
});

/**
 * Get a single revenue account by ID
 */
export const getRevenueAccount = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const account = await RevenueAccount.findById(id)
    .populate('parentAccount', 'accountCode accountName accountLevel')
    .populate('applicableRoomTypes', 'name code category pricing')
    .populate('autoCalculation.basedOnAccount', 'accountCode accountName')
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');

  if (!account) {
    return next(new ApplicationError('Revenue account not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      account
    }
  });
});

/**
 * Create a new revenue account
 */
export const createRevenueAccount = catchAsync(async (req, res, next) => {
  const { hotelId } = req.params;
  const userId = req.user._id;

  // Validate required fields
  const requiredFields = ['accountCode', 'accountName', 'revenueCategory', 'accountType'];
  for (const field of requiredFields) {
    if (!req.body[field]) {
      return next(new ApplicationError(`${field} is required`, 400));
    }
  }

  // Check for duplicate account code
  const existingAccount = await RevenueAccount.findOne({
    hotelId,
    accountCode: req.body.accountCode.toUpperCase()
  });

  if (existingAccount) {
    return next(new ApplicationError('An account with this code already exists', 400));
  }

  // Validate parent account if specified
  if (req.body.parentAccount) {
    const parentAccount = await RevenueAccount.findOne({
      _id: req.body.parentAccount,
      hotelId
    });

    if (!parentAccount) {
      return next(new ApplicationError('Parent account not found', 400));
    }

    // Check account level depth
    if (parentAccount.accountLevel >= 5) {
      return next(new ApplicationError('Account hierarchy cannot exceed 5 levels', 400));
    }
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

  // Validate auto calculation based account
  if (req.body.autoCalculation?.isEnabled && req.body.autoCalculation?.basedOnAccount) {
    const basedOnAccount = await RevenueAccount.findOne({
      _id: req.body.autoCalculation.basedOnAccount,
      hotelId
    });

    if (!basedOnAccount) {
      return next(new ApplicationError('Based on account not found', 400));
    }
  }

  const accountData = {
    ...req.body,
    hotelId,
    accountCode: req.body.accountCode.toUpperCase(),
    createdBy: userId
  };

  const account = await RevenueAccount.create(accountData);

  // Populate the created account
  await account.populate([
    { path: 'parentAccount', select: 'accountCode accountName' },
    { path: 'applicableRoomTypes', select: 'name code category' },
    { path: 'createdBy', select: 'name email' }
  ]);

  logger.info('Revenue account created', {
    accountId: account._id,
    accountCode: account.accountCode,
    hotelId,
    userId
  });

  res.status(201).json({
    status: 'success',
    data: {
      account
    }
  });
});

/**
 * Update a revenue account
 */
export const updateRevenueAccount = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  const account = await RevenueAccount.findById(id);

  if (!account) {
    return next(new ApplicationError('Revenue account not found', 404));
  }

  // Check if account is system generated
  if (account.isSystemGenerated && req.body.isActive === false) {
    return next(new ApplicationError('System generated accounts cannot be deactivated', 400));
  }

  // Check for duplicate account code if being changed
  if (req.body.accountCode && req.body.accountCode.toUpperCase() !== account.accountCode) {
    const existingAccount = await RevenueAccount.findOne({
      hotelId: account.hotelId,
      accountCode: req.body.accountCode.toUpperCase(),
      _id: { $ne: id }
    });

    if (existingAccount) {
      return next(new ApplicationError('An account with this code already exists', 400));
    }
  }

  // Validate parent account if being changed
  if (req.body.parentAccount) {
    const parentAccount = await RevenueAccount.findOne({
      _id: req.body.parentAccount,
      hotelId: account.hotelId
    });

    if (!parentAccount) {
      return next(new ApplicationError('Parent account not found', 400));
    }

    // Check for circular reference
    if (req.body.parentAccount.toString() === id) {
      return next(new ApplicationError('Account cannot be its own parent', 400));
    }

    // Check account level depth
    if (parentAccount.accountLevel >= 5) {
      return next(new ApplicationError('Account hierarchy cannot exceed 5 levels', 400));
    }
  }

  // Validate room types if being updated
  if (req.body.applicableRoomTypes && req.body.applicableRoomTypes.length > 0) {
    const roomTypes = await RoomType.find({
      _id: { $in: req.body.applicableRoomTypes },
      hotelId: account.hotelId
    });

    if (roomTypes.length !== req.body.applicableRoomTypes.length) {
      return next(new ApplicationError('One or more room types are invalid', 400));
    }
  }

  // Prepare update data
  const updateData = { ...req.body, updatedBy: userId };
  if (updateData.accountCode) {
    updateData.accountCode = updateData.accountCode.toUpperCase();
  }

  // Update the account
  const updatedAccount = await RevenueAccount.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  ).populate([
    { path: 'parentAccount', select: 'accountCode accountName' },
    { path: 'applicableRoomTypes', select: 'name code category' },
    { path: 'createdBy', select: 'name email' },
    { path: 'updatedBy', select: 'name email' }
  ]);

  logger.info('Revenue account updated', {
    accountId: updatedAccount._id,
    accountCode: updatedAccount.accountCode,
    hotelId: updatedAccount.hotelId,
    userId
  });

  res.status(200).json({
    status: 'success',
    data: {
      account: updatedAccount
    }
  });
});

/**
 * Delete/Deactivate a revenue account
 */
export const deleteRevenueAccount = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  const account = await RevenueAccount.findById(id);

  if (!account) {
    return next(new ApplicationError('Revenue account not found', 404));
  }

  // Check if account is system generated
  if (account.isSystemGenerated) {
    return next(new ApplicationError('System generated accounts cannot be deleted', 400));
  }

  // Check if account has child accounts
  const childAccounts = await RevenueAccount.find({
    parentAccount: id,
    isActive: true
  });

  if (childAccounts.length > 0) {
    return next(new ApplicationError('Cannot delete account with active child accounts', 400));
  }

  // Soft delete by setting isActive to false
  const updatedAccount = await RevenueAccount.findByIdAndUpdate(
    id,
    { isActive: false, updatedBy: userId },
    { new: true }
  );

  logger.info('Revenue account deactivated', {
    accountId: updatedAccount._id,
    accountCode: updatedAccount.accountCode,
    hotelId: updatedAccount.hotelId,
    userId
  });

  res.status(204).json({
    status: 'success',
    data: null
  });
});

/**
 * Calculate revenue allocation for booking preview
 */
export const calculateRevenueAllocation = catchAsync(async (req, res, next) => {
  const { hotelId } = req.params;
  const {
    roomTypeId,
    baseAmount,
    roomCount = 1,
    guestCount = 1,
    stayNights = 1,
    channel = 'direct',
    rateType = 'standard',
    additionalCharges = []
  } = req.body;

  if (!baseAmount || baseAmount <= 0) {
    return next(new ApplicationError('Base amount is required and must be greater than 0', 400));
  }

  try {
    const allocationResult = await revenueTrackingService.calculateRevenueAllocation({
      hotelId,
      roomTypeId,
      baseAmount,
      roomCount,
      guestCount,
      stayNights,
      channel,
      rateType,
      additionalCharges
    });

    res.status(200).json({
      status: 'success',
      data: allocationResult
    });

  } catch (error) {
    logger.error('Revenue allocation calculation failed:', {
      error: error.message,
      hotelId,
      baseAmount,
      stack: error.stack
    });
    
    return next(new ApplicationError('Revenue allocation calculation failed', 500));
  }
});

/**
 * Get applicable revenue accounts for specific criteria
 */
export const getApplicableRevenueAccounts = catchAsync(async (req, res, next) => {
  const { hotelId } = req.params;
  const {
    roomTypeId,
    channel,
    rateType,
    revenueCategory,
    accountType
  } = req.query;

  const criteria = {
    roomTypeId,
    channel,
    rateType,
    revenueCategory,
    accountType
  };

  const applicableAccounts = await RevenueAccount.getApplicableAccounts(hotelId, criteria);

  res.status(200).json({
    status: 'success',
    results: applicableAccounts.length,
    data: {
      accounts: applicableAccounts.map(account => ({
        id: account._id,
        code: account.accountCode,
        name: account.accountName,
        category: account.revenueCategory,
        type: account.accountType,
        reportingGroup: account.reportingGroup,
        glAccountCode: account.glAccountCode,
        autoCalculation: account.autoCalculation.isEnabled,
        description: account.accountDescription
      }))
    }
  });
});

/**
 * Get revenue summary and analytics
 */
export const getRevenueSummary = catchAsync(async (req, res, next) => {
  const { hotelId } = req.params;
  const { startDate, endDate, revenueCategory, accountType } = req.query;

  const summary = await RevenueAccount.getRevenueSummary(hotelId, {
    startDate,
    endDate,
    revenueCategory,
    accountType
  });

  res.status(200).json({
    status: 'success',
    data: {
      summary
    }
  });
});

/**
 * Bulk update account status
 */
export const bulkUpdateAccountStatus = catchAsync(async (req, res, next) => {
  const { hotelId } = req.params;
  const { accountIds, isActive } = req.body;
  const userId = req.user._id;

  if (!Array.isArray(accountIds) || accountIds.length === 0) {
    return next(new ApplicationError('Account IDs array is required', 400));
  }

  if (typeof isActive !== 'boolean') {
    return next(new ApplicationError('isActive must be a boolean value', 400));
  }

  const result = await RevenueAccount.updateMany(
    {
      _id: { $in: accountIds },
      hotelId,
      isSystemGenerated: { $ne: true } // Cannot deactivate system accounts
    },
    {
      isActive,
      updatedBy: userId
    }
  );

  logger.info('Bulk account status update', {
    hotelId,
    accountIds,
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
 * Generate revenue report
 */
export const generateRevenueReport = catchAsync(async (req, res, next) => {
  const { hotelId } = req.params;
  const {
    startDate,
    endDate,
    revenueCategory,
    accountType,
    reportingGroup,
    groupBy = 'category',
    format = 'json'
  } = req.query;

  const filters = {
    startDate,
    endDate,
    revenueCategory,
    accountType,
    reportingGroup,
    groupBy
  };

  const report = await revenueTrackingService.generateRevenueReport(hotelId, filters);

  if (format === 'csv') {
    // Convert to CSV format (simplified implementation)
    const csvData = this.convertReportToCSV(report);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=revenue-report.csv');
    return res.status(200).send(csvData);
  }

  res.status(200).json({
    status: 'success',
    data: {
      report
    }
  });
});

/**
 * Get budget analysis
 */
export const getBudgetAnalysis = catchAsync(async (req, res, next) => {
  const { hotelId } = req.params;
  const { period = 'yearly', startDate, endDate } = req.query;

  const analysis = await revenueTrackingService.getBudgetAnalysis(hotelId, {
    period,
    startDate,
    endDate
  });

  res.status(200).json({
    status: 'success',
    data: {
      analysis
    }
  });
});

/**
 * Get revenue account options for dropdowns
 */
export const getAccountOptions = catchAsync(async (req, res, next) => {
  const revenueCategories = [
    'room_revenue',
    'upgrade_revenue',
    'package_revenue',
    'addon_revenue',
    'fee_revenue',
    'tax_revenue',
    'deposit_revenue',
    'penalty_revenue',
    'corporate_revenue',
    'group_revenue',
    'promotional_revenue',
    'seasonal_revenue',
    'channel_revenue',
    'other_revenue'
  ];

  const accountTypes = [
    'primary',
    'secondary',
    'adjustment',
    'promotional',
    'fee',
    'tax',
    'deposit'
  ];

  const reportingGroups = [
    'rooms_department',
    'food_beverage',
    'other_operated_departments',
    'rentals_other_income',
    'total_operated_department_revenue'
  ];

  const calculationMethods = [
    'percentage',
    'fixed_amount',
    'per_night',
    'per_guest',
    'tiered'
  ];

  const taxCategories = [
    'standard',
    'exempt',
    'reduced_rate',
    'zero_rate'
  ];

  res.status(200).json({
    status: 'success',
    data: {
      revenueCategories,
      accountTypes,
      reportingGroups,
      calculationMethods,
      taxCategories
    }
  });
});

/**
 * Convert report to CSV format (helper function)
 */
const convertReportToCSV = (report) => {
  const headers = ['Account Code', 'Account Name', 'Category', 'Type', 'Revenue', 'Transactions', 'Avg Per Transaction'];
  const rows = [headers.join(',')];

  report.accountDetails.forEach(account => {
    const row = [
      account.accountCode,
      `"${account.accountName}"`,
      account.revenueCategory,
      account.accountType,
      account.revenue,
      account.transactions,
      account.averagePerTransaction.toFixed(2)
    ];
    rows.push(row.join(','));
  });

  return rows.join('\n');
};

export default {
  getRevenueAccounts,
  getRevenueAccount,
  createRevenueAccount,
  updateRevenueAccount,
  deleteRevenueAccount,
  calculateRevenueAllocation,
  getApplicableRevenueAccounts,
  getRevenueSummary,
  bulkUpdateAccountStatus,
  generateRevenueReport,
  getBudgetAnalysis,
  getAccountOptions
};
