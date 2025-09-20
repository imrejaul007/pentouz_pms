import MeasurementUnit from '../models/MeasurementUnit.js';
import unitConversionService from '../services/unitConversionService.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

/**
 * Measurement Unit Controller
 * 
 * Handles measurement unit management operations including:
 * - Unit CRUD operations
 * - Conversion endpoints
 * - Unit validation functions
 * - Unit reporting and analytics
 */

class MeasurementUnitController {
  /**
   * Create a new measurement unit
   */
  createUnit = catchAsync(async (req, res, next) => {
    const {
      name,
      symbol,
      displayName,
      description,
      unitType,
      unitSystem,
      isBaseUnit,
      baseUnit,
      decimalPlaces,
      precision,
      displayFormat,
      category,
      sortOrder,
      minValue,
      maxValue,
      allowNegative,
      posIntegration
    } = req.body;

    // Validate required fields
    if (!name || !symbol || !displayName || !unitType || !unitSystem) {
      return next(new ApplicationError('Name, symbol, display name, unit type, and unit system are required', 400));
    }

    // Check for duplicate unit name in the same hotel
    const existingUnit = await MeasurementUnit.findOne({
      hotelId: req.user.hotelId,
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });

    if (existingUnit) {
      return next(new ApplicationError('Unit with this name already exists', 409));
    }

    // Check for duplicate symbol
    const existingSymbol = await MeasurementUnit.findOne({
      hotelId: req.user.hotelId,
      symbol: { $regex: new RegExp(`^${symbol}$`, 'i') }
    });

    if (existingSymbol) {
      return next(new ApplicationError('Unit with this symbol already exists', 409));
    }

    const unitData = {
      hotelId: req.user.hotelId,
      name,
      symbol,
      displayName,
      description,
      unitType,
      unitSystem,
      isBaseUnit: isBaseUnit || false,
      baseUnit: baseUnit || null,
      decimalPlaces: decimalPlaces || 2,
      precision: precision || 0.01,
      displayFormat: displayFormat || {
        showSymbol: true,
        symbolPosition: 'after',
        thousandsSeparator: ',',
        decimalSeparator: '.'
      },
      category: category || 'STANDARD',
      sortOrder: sortOrder || 0,
      minValue: minValue || 0,
      maxValue: maxValue || null,
      allowNegative: allowNegative || false,
      posIntegration: posIntegration || {
        isDefaultForType: false,
        applicableCategories: [],
        inventoryTracking: true
      },
      createdBy: req.user._id
    };

    const unit = await MeasurementUnit.create(unitData);

    logger.info('Measurement unit created', {
      unitId: unit._id,
      unitName: unit.name,
      unitType: unit.unitType,
      userId: req.user._id
    });

    res.status(201).json({
      status: 'success',
      data: {
        unit
      }
    });
  });

  /**
   * Get all measurement units for a hotel
   */
  getUnits = catchAsync(async (req, res, next) => {
    const {
      unitType,
      unitSystem,
      category,
      isActive,
      isBaseUnit,
      page = 1,
      limit = 50,
      sortBy = 'sortOrder',
      sortOrder = 'asc'
    } = req.query;

    const filter = { hotelId: req.user.hotelId };

    if (unitType) filter.unitType = unitType;
    if (unitSystem) filter.unitSystem = unitSystem;
    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (isBaseUnit !== undefined) filter.isBaseUnit = isBaseUnit === 'true';

    const sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const skip = (page - 1) * limit;

    const units = await MeasurementUnit.find(filter)
      .populate('createdBy updatedBy', 'firstName lastName email')
      .populate('baseUnit', 'name symbol')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await MeasurementUnit.countDocuments(filter);

    res.status(200).json({
      status: 'success',
      data: {
        units,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  });

  /**
   * Get a specific measurement unit by ID
   */
  getUnit = catchAsync(async (req, res, next) => {
    const unit = await MeasurementUnit.findOne({
      _id: req.params.id,
      hotelId: req.user.hotelId
    })
      .populate('createdBy updatedBy', 'firstName lastName email')
      .populate('baseUnit', 'name symbol')
      .populate('conversionFactors.targetUnit', 'name symbol unitType');

    if (!unit) {
      return next(new ApplicationError('Measurement unit not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        unit
      }
    });
  });

  /**
   * Update a measurement unit
   */
  updateUnit = catchAsync(async (req, res, next) => {
    const unit = await MeasurementUnit.findOne({
      _id: req.params.id,
      hotelId: req.user.hotelId
    });

    if (!unit) {
      return next(new ApplicationError('Measurement unit not found', 404));
    }

    // Check for duplicate name if name is being updated
    if (req.body.name && req.body.name !== unit.name) {
      const existingUnit = await MeasurementUnit.findOne({
        hotelId: req.user.hotelId,
        name: { $regex: new RegExp(`^${req.body.name}$`, 'i') },
        _id: { $ne: req.params.id }
      });

      if (existingUnit) {
        return next(new ApplicationError('Unit with this name already exists', 409));
      }
    }

    // Check for duplicate symbol if symbol is being updated
    if (req.body.symbol && req.body.symbol !== unit.symbol) {
      const existingSymbol = await MeasurementUnit.findOne({
        hotelId: req.user.hotelId,
        symbol: { $regex: new RegExp(`^${req.body.symbol}$`, 'i') },
        _id: { $ne: req.params.id }
      });

      if (existingSymbol) {
        return next(new ApplicationError('Unit with this symbol already exists', 409));
      }
    }

    const updatedUnit = await MeasurementUnit.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        updatedBy: req.user._id
      },
      { new: true, runValidators: true }
    )
      .populate('createdBy updatedBy', 'firstName lastName email')
      .populate('baseUnit', 'name symbol')
      .populate('conversionFactors.targetUnit', 'name symbol unitType');

    logger.info('Measurement unit updated', {
      unitId: updatedUnit._id,
      unitName: updatedUnit.name,
      userId: req.user._id
    });

    res.status(200).json({
      status: 'success',
      data: {
        unit: updatedUnit
      }
    });
  });

  /**
   * Delete a measurement unit
   */
  deleteUnit = catchAsync(async (req, res, next) => {
    const unit = await MeasurementUnit.findOne({
      _id: req.params.id,
      hotelId: req.user.hotelId
    });

    if (!unit) {
      return next(new ApplicationError('Measurement unit not found', 404));
    }

    // Check if unit is being used
    const isUsed = unit.usageCount > 0;
    
    if (isUsed || unit.isSystemUnit) {
      // Soft delete - deactivate instead of removing
      unit.isActive = false;
      unit.updatedBy = req.user._id;
      await unit.save();

      logger.info('Measurement unit deactivated', {
        unitId: unit._id,
        unitName: unit.name,
        userId: req.user._id
      });

      res.status(200).json({
        status: 'success',
        message: 'Unit deactivated successfully (cannot delete unit with usage history or system unit)'
      });
    } else {
      // Hard delete if never used and not system unit
      await MeasurementUnit.findByIdAndDelete(req.params.id);

      logger.info('Measurement unit deleted', {
        unitId: unit._id,
        unitName: unit.name,
        userId: req.user._id
      });

      res.status(200).json({
        status: 'success',
        message: 'Unit deleted successfully'
      });
    }
  });

  /**
   * Convert between units
   */
  convertUnits = catchAsync(async (req, res, next) => {
    const {
      fromUnitId,
      toUnitId,
      value,
      precision = 6,
      validateInput = true,
      useCache = true
    } = req.body;

    if (!fromUnitId || !toUnitId || value === undefined) {
      return next(new ApplicationError('From unit ID, to unit ID, and value are required', 400));
    }

    try {
      const result = await unitConversionService.convert(
        fromUnitId,
        toUnitId,
        value,
        { precision, validateInput, useCache }
      );

      res.status(200).json({
        status: 'success',
        data: result
      });
    } catch (error) {
      return next(new ApplicationError(`Unit conversion failed: ${error.message}`, 400));
    }
  });

  /**
   * Convert multiple units in batch
   */
  convertBatch = catchAsync(async (req, res, next) => {
    const {
      conversions,
      parallel = true,
      maxConcurrency = 10
    } = req.body;

    if (!conversions || !Array.isArray(conversions) || conversions.length === 0) {
      return next(new ApplicationError('Conversions array is required', 400));
    }

    try {
      const results = await unitConversionService.convertBatch(conversions, {
        parallel,
        maxConcurrency
      });

      res.status(200).json({
        status: 'success',
        data: {
          results,
          totalConversions: conversions.length,
          processedAt: new Date()
        }
      });
    } catch (error) {
      return next(new ApplicationError(`Batch conversion failed: ${error.message}`, 400));
    }
  });

  /**
   * Get available conversions for a unit
   */
  getAvailableConversions = catchAsync(async (req, res, next) => {
    const { unitId } = req.params;

    try {
      const availableUnits = await unitConversionService.getAvailableConversions(unitId);

      res.status(200).json({
        status: 'success',
        data: {
          availableUnits
        }
      });
    } catch (error) {
      return next(new ApplicationError(`Failed to get available conversions: ${error.message}`, 400));
    }
  });

  /**
   * Get units by type
   */
  getUnitsByType = catchAsync(async (req, res, next) => {
    const { unitType } = req.params;
    const { includeSystemUnits = true } = req.query;

    try {
      const units = await MeasurementUnit.getUnitsByType(
        req.user.hotelId,
        unitType,
        { includeSystemUnits: includeSystemUnits === 'true' }
      );

      res.status(200).json({
        status: 'success',
        data: {
          units
        }
      });
    } catch (error) {
      return next(new ApplicationError(`Failed to get units by type: ${error.message}`, 400));
    }
  });

  /**
   * Get base units
   */
  getBaseUnits = catchAsync(async (req, res, next) => {
    try {
      const baseUnits = await MeasurementUnit.getBaseUnits(req.user.hotelId);

      res.status(200).json({
        status: 'success',
        data: {
          baseUnits
        }
      });
    } catch (error) {
      return next(new ApplicationError(`Failed to get base units: ${error.message}`, 400));
    }
  });

  /**
   * Get unit types
   */
  getUnitTypes = catchAsync(async (req, res, next) => {
    const unitTypes = await MeasurementUnit.distinct('unitType', {
      hotelId: req.user.hotelId,
      isActive: true
    });

    const unitTypeInfo = {
      WEIGHT: { name: 'Weight', description: 'Units for measuring weight/mass' },
      VOLUME: { name: 'Volume', description: 'Units for measuring volume/capacity' },
      QUANTITY: { name: 'Quantity', description: 'Units for counting items' },
      LENGTH: { name: 'Length', description: 'Units for measuring length/distance' },
      AREA: { name: 'Area', description: 'Units for measuring area' },
      TIME: { name: 'Time', description: 'Units for measuring time duration' },
      TEMPERATURE: { name: 'Temperature', description: 'Units for measuring temperature' },
      CUSTOM: { name: 'Custom', description: 'Custom-defined units' }
    };

    const types = unitTypes.map(type => ({
      code: type,
      ...unitTypeInfo[type]
    }));

    res.status(200).json({
      status: 'success',
      data: {
        unitTypes: types
      }
    });
  });

  /**
   * Get unit systems
   */
  getUnitSystems = catchAsync(async (req, res, next) => {
    const unitSystems = await MeasurementUnit.distinct('unitSystem', {
      hotelId: req.user.hotelId,
      isActive: true
    });

    const unitSystemInfo = {
      METRIC: { name: 'Metric System', description: 'International System of Units (SI)' },
      IMPERIAL: { name: 'Imperial System', description: 'British Imperial System' },
      US_CUSTOMARY: { name: 'US Customary', description: 'United States Customary System' },
      CUSTOM: { name: 'Custom System', description: 'Custom-defined unit system' }
    };

    const systems = unitSystems.map(system => ({
      code: system,
      ...unitSystemInfo[system]
    }));

    res.status(200).json({
      status: 'success',
      data: {
        unitSystems: systems
      }
    });
  });

  /**
   * Add conversion factor
   */
  addConversionFactor = catchAsync(async (req, res, next) => {
    const { unitId } = req.params;
    const { targetUnitId, factor, offset = 0 } = req.body;

    if (!targetUnitId || factor === undefined) {
      return next(new ApplicationError('Target unit ID and conversion factor are required', 400));
    }

    const unit = await MeasurementUnit.findOne({
      _id: unitId,
      hotelId: req.user.hotelId
    });

    if (!unit) {
      return next(new ApplicationError('Measurement unit not found', 404));
    }

    try {
      await unit.addConversionFactor(targetUnitId, factor, offset);

      logger.info('Conversion factor added', {
        unitId: unit._id,
        targetUnitId,
        factor,
        userId: req.user._id
      });

      res.status(201).json({
        status: 'success',
        message: 'Conversion factor added successfully'
      });
    } catch (error) {
      return next(new ApplicationError(`Failed to add conversion factor: ${error.message}`, 400));
    }
  });

  /**
   * Get conversion report
   */
  getConversionReport = catchAsync(async (req, res, next) => {
    const { startDate, endDate, unitType, unitSystem } = req.query;

    try {
      const report = await unitConversionService.getConversionReport(
        req.user.hotelId,
        { startDate, endDate }
      );

      // Filter by unit type or system if specified
      if (unitType || unitSystem) {
        report.summary = report.summary.filter(item => {
          if (unitType && item._id.unitType !== unitType) return false;
          if (unitSystem && item._id.unitSystem !== unitSystem) return false;
          return true;
        });
      }

      res.status(200).json({
        status: 'success',
        data: report
      });
    } catch (error) {
      return next(new ApplicationError(`Conversion report generation failed: ${error.message}`, 500));
    }
  });

  /**
   * Validate unit configuration
   */
  validateUnitConfiguration = catchAsync(async (req, res, next) => {
    try {
      const validation = await unitConversionService.validateUnitConfiguration(
        req.user.hotelId
      );

      res.status(200).json({
        status: 'success',
        data: validation
      });
    } catch (error) {
      return next(new ApplicationError(`Unit validation failed: ${error.message}`, 500));
    }
  });

  /**
   * Clear conversion cache
   */
  clearConversionCache = catchAsync(async (req, res, next) => {
    unitConversionService.clearCache();

    logger.info('Unit conversion cache cleared', {
      userId: req.user._id
    });

    res.status(200).json({
      status: 'success',
      message: 'Unit conversion cache cleared successfully'
    });
  });

  /**
   * Get cache statistics
   */
  getCacheStats = catchAsync(async (req, res, next) => {
    const stats = unitConversionService.getCacheStats();

    res.status(200).json({
      status: 'success',
      data: {
        cacheStats: stats
      }
    });
  });

  /**
   * Format value for display
   */
  formatValue = catchAsync(async (req, res, next) => {
    const { unitId } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      return next(new ApplicationError('Value is required', 400));
    }

    const unit = await MeasurementUnit.findOne({
      _id: unitId,
      hotelId: req.user.hotelId
    });

    if (!unit) {
      return next(new ApplicationError('Measurement unit not found', 404));
    }

    const result = unit.formatValue(value);

    res.status(200).json({
      status: 'success',
      data: result
    });
  });
}

export default new MeasurementUnitController();
