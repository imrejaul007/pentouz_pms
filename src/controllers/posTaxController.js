import POSTax from '../models/POSTax.js';
import posTaxCalculationService from '../services/posTaxCalculationService.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

/**
 * POS Tax Controller
 * 
 * Handles tax management operations including:
 * - Tax CRUD operations
 * - Tax calculation endpoints
 * - Tax reporting functions
 * - Tax configuration validation
 */

class POSTaxController {
  /**
   * Create a new tax
   */
  createTax = catchAsync(async (req, res, next) => {
    const {
      name,
      displayName,
      description,
      taxType,
      taxGroup,
      rules,
      exemptions,
      validFrom,
      validTo,
      reportingCode,
      glAccountCode,
      isInclusive,
      displayFormat
    } = req.body;

    // Validate required fields
    if (!name || !displayName || !taxType || !taxGroup || !rules || rules.length === 0) {
      return next(new ApplicationError('Name, display name, tax type, tax group, and rules are required', 400));
    }

    // Check for duplicate tax name in the same hotel
    const existingTax = await POSTax.findOne({
      hotelId: req.user.hotelId,
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });

    if (existingTax) {
      return next(new ApplicationError('Tax with this name already exists', 409));
    }

    const taxData = {
      hotelId: req.user.hotelId,
      name,
      displayName,
      description,
      taxType,
      taxGroup,
      rules,
      exemptions: exemptions || [],
      validFrom: validFrom ? new Date(validFrom) : new Date(),
      validTo: validTo ? new Date(validTo) : null,
      reportingCode,
      glAccountCode,
      isInclusive: isInclusive || false,
      displayFormat: displayFormat || {
        showOnReceipt: true,
        showInBreakdown: true
      },
      createdBy: req.user._id
    };

    const tax = await POSTax.create(taxData);

    logger.info('Tax created', {
      taxId: tax._id,
      taxName: tax.name,
      taxType: tax.taxType,
      userId: req.user._id
    });

    res.status(201).json({
      status: 'success',
      data: {
        tax
      }
    });
  });

  /**
   * Get all taxes for a hotel
   */
  getTaxes = catchAsync(async (req, res, next) => {
    const {
      taxType,
      taxGroup,
      isActive,
      outletId,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = { hotelId: req.user.hotelId };

    if (taxType) filter.taxType = taxType;
    if (taxGroup) filter.taxGroup = taxGroup;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (outletId) filter.outletId = outletId;

    const sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const skip = (page - 1) * limit;

    const taxes = await POSTax.find(filter)
      .populate('createdBy updatedBy', 'firstName lastName email')
      .populate('outletId', 'name type')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await POSTax.countDocuments(filter);

    res.status(200).json({
      status: 'success',
      data: {
        taxes,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  });

  /**
   * Get a specific tax by ID
   */
  getTax = catchAsync(async (req, res, next) => {
    const tax = await POSTax.findOne({
      _id: req.params.id,
      hotelId: req.user.hotelId
    })
      .populate('createdBy updatedBy', 'firstName lastName email')
      .populate('outletId', 'name type');

    if (!tax) {
      return next(new ApplicationError('Tax not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        tax
      }
    });
  });

  /**
   * Update a tax
   */
  updateTax = catchAsync(async (req, res, next) => {
    const tax = await POSTax.findOne({
      _id: req.params.id,
      hotelId: req.user.hotelId
    });

    if (!tax) {
      return next(new ApplicationError('Tax not found', 404));
    }

    // Check for duplicate name if name is being updated
    if (req.body.name && req.body.name !== tax.name) {
      const existingTax = await POSTax.findOne({
        hotelId: req.user.hotelId,
        name: { $regex: new RegExp(`^${req.body.name}$`, 'i') },
        _id: { $ne: req.params.id }
      });

      if (existingTax) {
        return next(new ApplicationError('Tax with this name already exists', 409));
      }
    }

    const updatedTax = await POSTax.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        updatedBy: req.user._id
      },
      { new: true, runValidators: true }
    )
      .populate('createdBy updatedBy', 'firstName lastName email')
      .populate('outletId', 'name type');

    logger.info('Tax updated', {
      taxId: updatedTax._id,
      taxName: updatedTax.name,
      userId: req.user._id
    });

    res.status(200).json({
      status: 'success',
      data: {
        tax: updatedTax
      }
    });
  });

  /**
   * Delete a tax
   */
  deleteTax = catchAsync(async (req, res, next) => {
    const tax = await POSTax.findOne({
      _id: req.params.id,
      hotelId: req.user.hotelId
    });

    if (!tax) {
      return next(new ApplicationError('Tax not found', 404));
    }

    // Check if tax is being used in any orders
    const isUsed = tax.calculationCount > 0;
    
    if (isUsed) {
      // Soft delete - deactivate instead of removing
      tax.isActive = false;
      tax.updatedBy = req.user._id;
      await tax.save();

      logger.info('Tax deactivated', {
        taxId: tax._id,
        taxName: tax.name,
        userId: req.user._id
      });

      res.status(200).json({
        status: 'success',
        message: 'Tax deactivated successfully (cannot delete tax with calculation history)'
      });
    } else {
      // Hard delete if never used
      await POSTax.findByIdAndDelete(req.params.id);

      logger.info('Tax deleted', {
        taxId: tax._id,
        taxName: tax.name,
        userId: req.user._id
      });

      res.status(200).json({
        status: 'success',
        message: 'Tax deleted successfully'
      });
    }
  });

  /**
   * Calculate tax for an amount
   */
  calculateTax = catchAsync(async (req, res, next) => {
    const {
      amount,
      taxGroup,
      customerType = 'individual',
      outletId,
      applyExemptions = true
    } = req.body;

    if (!amount || amount < 0) {
      return next(new ApplicationError('Valid amount is required', 400));
    }

    try {
      const result = await posTaxCalculationService.calculateTaxForAmount(
        await posTaxCalculationService.getApplicableTaxes(
          req.user.hotelId,
          outletId
        ),
        amount,
        {
          customerType,
          productCategory: taxGroup,
          outletId,
          applyExemptions
        }
      );

      res.status(200).json({
        status: 'success',
        data: {
          amount,
          taxGroup,
          customerType,
          ...result
        }
      });
    } catch (error) {
      return next(new ApplicationError(`Tax calculation failed: ${error.message}`, 500));
    }
  });

  /**
   * Calculate taxes for an order
   */
  calculateOrderTaxes = catchAsync(async (req, res, next) => {
    const {
      items,
      subtotal,
      customerType = 'individual',
      outletId,
      applyExemptions = true,
      includeBreakdown = true
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return next(new ApplicationError('Order items are required', 400));
    }

    if (!subtotal || subtotal < 0) {
      return next(new ApplicationError('Valid subtotal is required', 400));
    }

    try {
      const result = await posTaxCalculationService.calculateOrderTaxes(
        { items, subtotal },
        {
          hotelId: req.user.hotelId,
          outletId,
          customerType,
          applyExemptions,
          includeBreakdown
        }
      );

      res.status(200).json({
        status: 'success',
        data: result
      });
    } catch (error) {
      return next(new ApplicationError(`Order tax calculation failed: ${error.message}`, 500));
    }
  });

  /**
   * Get tax groups
   */
  getTaxGroups = catchAsync(async (req, res, next) => {
    const taxGroups = await POSTax.distinct('taxGroup', {
      hotelId: req.user.hotelId,
      isActive: true
    });

    const taxGroupInfo = {
      FOOD: { name: 'Food Items', description: 'Food and meal items' },
      BEVERAGE: { name: 'Beverages', description: 'Non-alcoholic beverages' },
      SERVICE: { name: 'Services', description: 'Service charges and fees' },
      PRODUCT: { name: 'Products', description: 'Retail products and merchandise' },
      ALCOHOL: { name: 'Alcoholic Beverages', description: 'Alcoholic drinks' },
      TOBACCO: { name: 'Tobacco Products', description: 'Tobacco and smoking products' },
      LUXURY: { name: 'Luxury Items', description: 'High-value luxury items' },
      GENERAL: { name: 'General Items', description: 'General merchandise' }
    };

    const groups = taxGroups.map(group => ({
      code: group,
      ...taxGroupInfo[group]
    }));

    res.status(200).json({
      status: 'success',
      data: {
        taxGroups: groups
      }
    });
  });

  /**
   * Get tax types
   */
  getTaxTypes = catchAsync(async (req, res, next) => {
    const taxTypes = await POSTax.distinct('taxType', {
      hotelId: req.user.hotelId,
      isActive: true
    });

    const taxTypeInfo = {
      VAT: { name: 'Value Added Tax', description: 'Standard VAT on goods and services' },
      GST: { name: 'Goods and Services Tax', description: 'Comprehensive GST system' },
      SERVICE_TAX: { name: 'Service Tax', description: 'Tax on service charges' },
      LOCAL_TAX: { name: 'Local Tax', description: 'Municipal or local government tax' },
      LUXURY_TAX: { name: 'Luxury Tax', description: 'Tax on luxury items' },
      ENTERTAINMENT_TAX: { name: 'Entertainment Tax', description: 'Tax on entertainment services' },
      CUSTOM: { name: 'Custom Tax', description: 'Custom-defined tax' }
    };

    const types = taxTypes.map(type => ({
      code: type,
      ...taxTypeInfo[type]
    }));

    res.status(200).json({
      status: 'success',
      data: {
        taxTypes: types
      }
    });
  });

  /**
   * Get tax report
   */
  getTaxReport = catchAsync(async (req, res, next) => {
    const { startDate, endDate, taxType, taxGroup } = req.query;

    try {
      const report = await posTaxCalculationService.getTaxReport(
        req.user.hotelId,
        { startDate, endDate }
      );

      // Filter by tax type or group if specified
      if (taxType || taxGroup) {
        report.summary = report.summary.filter(item => {
          if (taxType && item._id.taxType !== taxType) return false;
          if (taxGroup && item._id.taxGroup !== taxGroup) return false;
          return true;
        });
      }

      res.status(200).json({
        status: 'success',
        data: report
      });
    } catch (error) {
      return next(new ApplicationError(`Tax report generation failed: ${error.message}`, 500));
    }
  });

  /**
   * Validate tax configuration
   */
  validateTaxConfiguration = catchAsync(async (req, res, next) => {
    try {
      const validation = await posTaxCalculationService.validateTaxConfiguration(
        req.user.hotelId
      );

      res.status(200).json({
        status: 'success',
        data: validation
      });
    } catch (error) {
      return next(new ApplicationError(`Tax validation failed: ${error.message}`, 500));
    }
  });

  /**
   * Clear tax calculation cache
   */
  clearTaxCache = catchAsync(async (req, res, next) => {
    posTaxCalculationService.clearCache();

    logger.info('Tax cache cleared', {
      userId: req.user._id
    });

    res.status(200).json({
      status: 'success',
      message: 'Tax calculation cache cleared successfully'
    });
  });

  /**
   * Get tax exemptions
   */
  getTaxExemptions = catchAsync(async (req, res, next) => {
    const { taxId } = req.params;

    const tax = await POSTax.findOne({
      _id: taxId,
      hotelId: req.user.hotelId
    });

    if (!tax) {
      return next(new ApplicationError('Tax not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        exemptions: tax.exemptions
      }
    });
  });

  /**
   * Add tax exemption
   */
  addTaxExemption = catchAsync(async (req, res, next) => {
    const { taxId } = req.params;
    const exemptionData = req.body;

    const tax = await POSTax.findOne({
      _id: taxId,
      hotelId: req.user.hotelId
    });

    if (!tax) {
      return next(new ApplicationError('Tax not found', 404));
    }

    tax.exemptions.push(exemptionData);
    tax.updatedBy = req.user._id;
    await tax.save();

    logger.info('Tax exemption added', {
      taxId: tax._id,
      exemptionName: exemptionData.name,
      userId: req.user._id
    });

    res.status(201).json({
      status: 'success',
      data: {
        exemption: exemptionData
      }
    });
  });

  /**
   * Update tax exemption
   */
  updateTaxExemption = catchAsync(async (req, res, next) => {
    const { taxId, exemptionId } = req.params;
    const exemptionData = req.body;

    const tax = await POSTax.findOne({
      _id: taxId,
      hotelId: req.user.hotelId
    });

    if (!tax) {
      return next(new ApplicationError('Tax not found', 404));
    }

    const exemption = tax.exemptions.id(exemptionId);
    if (!exemption) {
      return next(new ApplicationError('Exemption not found', 404));
    }

    Object.assign(exemption, exemptionData);
    tax.updatedBy = req.user._id;
    await tax.save();

    logger.info('Tax exemption updated', {
      taxId: tax._id,
      exemptionId,
      userId: req.user._id
    });

    res.status(200).json({
      status: 'success',
      data: {
        exemption
      }
    });
  });

  /**
   * Delete tax exemption
   */
  deleteTaxExemption = catchAsync(async (req, res, next) => {
    const { taxId, exemptionId } = req.params;

    const tax = await POSTax.findOne({
      _id: taxId,
      hotelId: req.user.hotelId
    });

    if (!tax) {
      return next(new ApplicationError('Tax not found', 404));
    }

    const exemption = tax.exemptions.id(exemptionId);
    if (!exemption) {
      return next(new ApplicationError('Exemption not found', 404));
    }

    exemption.remove();
    tax.updatedBy = req.user._id;
    await tax.save();

    logger.info('Tax exemption deleted', {
      taxId: tax._id,
      exemptionId,
      userId: req.user._id
    });

    res.status(200).json({
      status: 'success',
      message: 'Exemption deleted successfully'
    });
  });
}

export default new POSTaxController();
