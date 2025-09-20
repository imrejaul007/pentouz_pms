import CentralizedRateService from '../services/centralizedRateService.js';
import CentralizedRate from '../models/CentralizedRate.js';
import PropertyGroup from '../models/PropertyGroup.js';
import { catchAsync } from '../utils/catchAsync.js';

export const createRate = catchAsync(async (req, res) => {
  const rateData = {
    ...req.body,
    createdBy: req.user._id
  };

  const rate = await CentralizedRateService.createRate(rateData);
  
  res.status(201).json({
    success: true,
    message: 'Centralized rate created successfully',
    data: rate
  });
});

export const distributeRate = catchAsync(async (req, res) => {
  const { rateId } = req.params;
  const { propertyIds, options = {} } = req.body;

  const result = await CentralizedRateService.distributeRate(
    rateId, 
    propertyIds, 
    req.user._id, 
    options
  );

  res.status(200).json({
    success: true,
    message: 'Rate distributed successfully',
    data: result
  });
});

export const getRates = catchAsync(async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    groupId, 
    status,
    rateName,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  const filter = {};
  
  if (groupId) filter['propertyGroup.groupId'] = groupId;
  if (status) filter.status = status;
  if (rateName) filter.rateName = { $regex: rateName, $options: 'i' };

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

  const [rates, total] = await Promise.all([
    CentralizedRate.find(filter)
      .populate('propertyGroup.groupId', 'name')
      .populate('createdBy', 'name email')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit)),
    CentralizedRate.countDocuments(filter)
  ]);

  res.status(200).json({
    success: true,
    data: {
      rates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    }
  });
});

export const getRateById = catchAsync(async (req, res) => {
  const { rateId } = req.params;
  const { includeDistribution = false, includeConflicts = false } = req.query;

  const rate = await CentralizedRate.findById(rateId)
    .populate('propertyGroup.groupId')
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');

  if (!rate) {
    return res.status(404).json({
      success: false,
      message: 'Rate not found'
    });
  }

  const responseData = { rate };

  if (includeDistribution === 'true') {
    responseData.distribution = await CentralizedRateService.getRateDistribution(rateId);
  }

  if (includeConflicts === 'true') {
    responseData.conflicts = await CentralizedRateService.getActiveConflicts(rateId);
  }

  res.status(200).json({
    success: true,
    data: responseData
  });
});

export const updateRate = catchAsync(async (req, res) => {
  const { rateId } = req.params;
  const updateData = {
    ...req.body,
    updatedBy: req.user._id,
    updatedAt: new Date()
  };

  const rate = await CentralizedRateService.updateRate(rateId, updateData, req.user._id);

  res.status(200).json({
    success: true,
    message: 'Rate updated successfully',
    data: rate
  });
});

export const deleteRate = catchAsync(async (req, res) => {
  const { rateId } = req.params;

  await CentralizedRateService.deleteRate(rateId, req.user._id);

  res.status(200).json({
    success: true,
    message: 'Rate deleted successfully'
  });
});

export const calculateRate = catchAsync(async (req, res) => {
  const { rateId } = req.params;
  const { 
    checkIn, 
    checkOut, 
    roomType, 
    occupancy,
    propertyId,
    guestType = 'regular',
    promocode 
  } = req.body;

  if (!checkIn || !checkOut || !roomType || !occupancy) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: checkIn, checkOut, roomType, occupancy'
    });
  }

  const calculation = await CentralizedRateService.calculateRate(rateId, {
    checkIn: new Date(checkIn),
    checkOut: new Date(checkOut),
    roomType,
    occupancy: parseInt(occupancy),
    propertyId,
    guestType,
    promocode
  });

  res.status(200).json({
    success: true,
    data: calculation
  });
});

export const resolveConflict = catchAsync(async (req, res) => {
  const { conflictId } = req.params;
  const { resolution, notes } = req.body;

  if (!['accept_centralized', 'accept_property', 'create_exception'].includes(resolution)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid resolution type'
    });
  }

  const result = await CentralizedRateService.resolveConflict(
    conflictId, 
    resolution, 
    req.user._id, 
    notes
  );

  res.status(200).json({
    success: true,
    message: 'Conflict resolved successfully',
    data: result
  });
});

export const getConflicts = catchAsync(async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    status = 'pending',
    groupId,
    propertyId 
  } = req.query;

  const filter = { status };
  if (groupId) filter.groupId = groupId;
  if (propertyId) filter.propertyId = propertyId;

  const conflicts = await CentralizedRateService.getConflicts(filter, {
    page: parseInt(page),
    limit: parseInt(limit)
  });

  res.status(200).json({
    success: true,
    data: conflicts
  });
});

export const getRateAnalytics = catchAsync(async (req, res) => {
  const { rateId } = req.params;
  const { 
    startDate, 
    endDate, 
    propertyId,
    metricsType = 'performance' 
  } = req.query;

  const analytics = await CentralizedRateService.getRateAnalytics(rateId, {
    startDate: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: endDate ? new Date(endDate) : new Date(),
    propertyId,
    metricsType
  });

  res.status(200).json({
    success: true,
    data: analytics
  });
});

export const syncRates = catchAsync(async (req, res) => {
  const { groupId } = req.params;
  const { force = false } = req.body;

  const result = await CentralizedRateService.syncGroupRates(groupId, {
    force: Boolean(force),
    syncedBy: req.user._id
  });

  res.status(200).json({
    success: true,
    message: 'Rates synchronized successfully',
    data: result
  });
});

export const previewRateDistribution = catchAsync(async (req, res) => {
  const { rateId } = req.params;
  const { propertyIds, effectiveDate } = req.body;

  const preview = await CentralizedRateService.previewDistribution(rateId, {
    propertyIds,
    effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date()
  });

  res.status(200).json({
    success: true,
    data: preview
  });
});

export const getRateHistory = catchAsync(async (req, res) => {
  const { rateId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  const rate = await CentralizedRate.findById(rateId);
  if (!rate) {
    return res.status(404).json({
      success: false,
      message: 'Rate not found'
    });
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const history = rate.auditLog
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(skip, skip + parseInt(limit));

  const populatedHistory = await CentralizedRate.populate(history, {
    path: 'performedBy',
    select: 'name email'
  });

  res.status(200).json({
    success: true,
    data: {
      history: populatedHistory,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: rate.auditLog.length,
        totalPages: Math.ceil(rate.auditLog.length / parseInt(limit))
      }
    }
  });
});

export const exportRates = catchAsync(async (req, res) => {
  const { groupId, format = 'csv', includePricing = false } = req.query;

  if (!['csv', 'excel', 'json'].includes(format)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid export format. Supported formats: csv, excel, json'
    });
  }

  const exportData = await CentralizedRateService.exportRates({
    groupId,
    format,
    includePricing: Boolean(includePricing),
    exportedBy: req.user._id
  });

  res.setHeader('Content-Disposition', `attachment; filename="centralized_rates_${Date.now()}.${format}"`);
  
  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(exportData, null, 2));
  } else if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.send(exportData);
  } else {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(exportData);
  }
});

export const getGroupDashboard = catchAsync(async (req, res) => {
  const { groupId } = req.params;

  const group = await PropertyGroup.findById(groupId);
  if (!group) {
    return res.status(404).json({
      success: false,
      message: 'Property group not found'
    });
  }

  const dashboard = await CentralizedRateService.getGroupDashboard(groupId);

  res.status(200).json({
    success: true,
    data: dashboard
  });
});

export const validateRate = catchAsync(async (req, res) => {
  const { rateId } = req.params;

  const validation = await CentralizedRateService.validateRate(rateId);

  res.status(200).json({
    success: true,
    data: validation
  });
});

export const duplicateRate = catchAsync(async (req, res) => {
  const { rateId } = req.params;
  const { newName, newGroupId } = req.body;

  if (!newName) {
    return res.status(400).json({
      success: false,
      message: 'New rate name is required'
    });
  }

  const duplicatedRate = await CentralizedRateService.duplicateRate(rateId, {
    newName,
    newGroupId,
    createdBy: req.user._id
  });

  res.status(201).json({
    success: true,
    message: 'Rate duplicated successfully',
    data: duplicatedRate
  });
});

export const updateRateStatus = catchAsync(async (req, res) => {
  const { rateId } = req.params;
  const { status, notes } = req.body;

  if (!['active', 'inactive', 'suspended', 'draft'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status'
    });
  }

  const rate = await CentralizedRateService.updateRateStatus(rateId, status, req.user._id, notes);

  res.status(200).json({
    success: true,
    message: 'Rate status updated successfully',
    data: rate
  });
});
