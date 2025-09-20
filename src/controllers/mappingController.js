import RoomMapping from '../models/RoomMapping.js';
import RateMapping from '../models/RateMapping.js';
import RoomType from '../models/RoomType.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

/**
 * Room Mapping Controllers
 */

// Get all room mappings with filters
export const getRoomMappings = catchAsync(async (req, res, next) => {
  const { 
    roomTypeId, 
    channel, 
    isActive = true, 
    page = 1, 
    limit = 50 
  } = req.query;
  
  const filter = {};
  if (roomTypeId) filter.pmsRoomTypeId = roomTypeId;
  if (channel) filter.channel = channel;
  if (isActive !== 'all') filter.isActive = isActive === 'true';
  
  const skip = (page - 1) * limit;
  
  const [mappings, total] = await Promise.all([
    RoomMapping.find(filter)
      .populate('roomTypeDetails', 'name category capacity amenities')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    RoomMapping.countDocuments(filter)
  ]);
  
  res.status(200).json({
    status: 'success',
    results: mappings.length,
    total,
    currentPage: parseInt(page),
    totalPages: Math.ceil(total / limit),
    data: {
      mappings
    }
  });
});

// Get room mapping by ID
export const getRoomMapping = catchAsync(async (req, res, next) => {
  const mapping = await RoomMapping.findById(req.params.id)
    .populate('roomTypeDetails', 'name category capacity amenities baseRate')
    .populate('createdBy updatedBy', 'name email');
  
  if (!mapping) {
    return next(new ApplicationError('Room mapping not found', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      mapping
    }
  });
});

// Create new room mapping
export const createRoomMapping = catchAsync(async (req, res, next) => {
  const {
    pmsRoomTypeId,
    channel,
    channelRoomId,
    channelRoomName,
    channelRoomDescription,
    mappingConfig
  } = req.body;
  
  // Validate room type exists
  const roomType = await RoomType.findById(pmsRoomTypeId);
  if (!roomType) {
    return next(new ApplicationError('Room type not found', 404));
  }
  
  // Check for duplicate mapping
  const existingMapping = await RoomMapping.findOne({
    channel,
    channelRoomId
  });
  
  if (existingMapping) {
    return next(new ApplicationError('Channel room ID already mapped', 409));
  }
  
  const mapping = await RoomMapping.create({
    pmsRoomTypeId,
    channel,
    channelRoomId,
    channelRoomName,
    channelRoomDescription,
    mappingConfig,
    createdBy: req.user?._id
  });
  
  await mapping.populate('roomTypeDetails', 'name category capacity');
  
  logger.info('Room mapping created', {
    mappingId: mapping._id,
    roomType: pmsRoomTypeId,
    channel,
    channelRoomId,
    userId: req.user?._id
  });
  
  res.status(201).json({
    status: 'success',
    data: {
      mapping
    }
  });
});

// Update room mapping
export const updateRoomMapping = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const updates = { ...req.body };
  
  // Add updatedBy field
  updates.updatedBy = req.user?._id;
  
  // If changing channel room ID, check for duplicates
  if (updates.channelRoomId) {
    const existingMapping = await RoomMapping.findOne({
      _id: { $ne: id },
      channel: updates.channel || undefined,
      channelRoomId: updates.channelRoomId
    });
    
    if (existingMapping) {
      return next(new ApplicationError('Channel room ID already mapped', 409));
    }
  }
  
  const mapping = await RoomMapping.findByIdAndUpdate(
    id,
    updates,
    { new: true, runValidators: true }
  ).populate('roomTypeDetails', 'name category capacity');
  
  if (!mapping) {
    return next(new ApplicationError('Room mapping not found', 404));
  }
  
  logger.info('Room mapping updated', {
    mappingId: mapping._id,
    updates: Object.keys(updates),
    userId: req.user?._id
  });
  
  res.status(200).json({
    status: 'success',
    data: {
      mapping
    }
  });
});

// Delete room mapping
export const deleteRoomMapping = catchAsync(async (req, res, next) => {
  const mapping = await RoomMapping.findById(req.params.id);
  
  if (!mapping) {
    return next(new ApplicationError('Room mapping not found', 404));
  }
  
  // Check for associated rate mappings
  const rateMappings = await RateMapping.countDocuments({
    roomMappingId: req.params.id
  });
  
  if (rateMappings > 0) {
    return next(new ApplicationError(
      `Cannot delete room mapping. ${rateMappings} rate mappings depend on it.`, 
      400
    ));
  }
  
  await RoomMapping.findByIdAndDelete(req.params.id);
  
  logger.info('Room mapping deleted', {
    mappingId: req.params.id,
    userId: req.user?._id
  });
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Get room mappings by room type
export const getRoomMappingsByRoomType = catchAsync(async (req, res, next) => {
  const { roomTypeId } = req.params;
  const { activeOnly = true } = req.query;
  
  const mappings = await RoomMapping.findByRoomType(roomTypeId, activeOnly === 'true');
  
  res.status(200).json({
    status: 'success',
    results: mappings.length,
    data: {
      mappings
    }
  });
});

// Get room mappings by channel
export const getRoomMappingsByChannel = catchAsync(async (req, res, next) => {
  const { channel } = req.params;
  const { activeOnly = true } = req.query;
  
  const mappings = await RoomMapping.findByChannel(channel, activeOnly === 'true');
  
  res.status(200).json({
    status: 'success',
    results: mappings.length,
    data: {
      mappings
    }
  });
});

/**
 * Rate Mapping Controllers
 */

// Get all rate mappings with filters
export const getRateMappings = catchAsync(async (req, res, next) => {
  const { 
    roomMappingId, 
    pmsRatePlanId, 
    isActive = true, 
    page = 1, 
    limit = 50 
  } = req.query;
  
  const filter = {};
  if (roomMappingId) filter.roomMappingId = roomMappingId;
  if (pmsRatePlanId) filter.pmsRatePlanId = pmsRatePlanId;
  if (isActive !== 'all') filter.isActive = isActive === 'true';
  
  const skip = (page - 1) * limit;
  
  const [mappings, total] = await Promise.all([
    RateMapping.find(filter)
      .populate('roomMappingDetails', 'channel channelRoomId channelRoomName')
      .populate('channelInfo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    RateMapping.countDocuments(filter)
  ]);
  
  res.status(200).json({
    status: 'success',
    results: mappings.length,
    total,
    currentPage: parseInt(page),
    totalPages: Math.ceil(total / limit),
    data: {
      mappings
    }
  });
});

// Get rate mapping by ID
export const getRateMapping = catchAsync(async (req, res, next) => {
  const mapping = await RateMapping.findById(req.params.id)
    .populate('roomMappingDetails')
    .populate('channelInfo')
    .populate('createdBy updatedBy', 'name email');
  
  if (!mapping) {
    return next(new ApplicationError('Rate mapping not found', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      mapping
    }
  });
});

// Create new rate mapping
export const createRateMapping = catchAsync(async (req, res, next) => {
  const {
    pmsRatePlanId,
    roomMappingId,
    channelRatePlanId,
    channelRatePlanName,
    channelRatePlanDescription,
    ratePlanConfig
  } = req.body;
  
  // Validate room mapping exists
  const roomMapping = await RoomMapping.findById(roomMappingId);
  if (!roomMapping) {
    return next(new ApplicationError('Room mapping not found', 404));
  }
  
  // Check for duplicate rate mapping
  const existingMapping = await RateMapping.findOne({
    roomMappingId,
    channelRatePlanId
  });
  
  if (existingMapping) {
    return next(new ApplicationError('Channel rate plan ID already mapped for this room mapping', 409));
  }
  
  const mapping = await RateMapping.create({
    pmsRatePlanId,
    roomMappingId,
    channelRatePlanId,
    channelRatePlanName,
    channelRatePlanDescription,
    ratePlanConfig,
    createdBy: req.user?._id
  });
  
  await mapping.populate('roomMappingDetails channelInfo');
  
  logger.info('Rate mapping created', {
    mappingId: mapping._id,
    pmsRatePlanId,
    roomMappingId,
    channelRatePlanId,
    userId: req.user?._id
  });
  
  res.status(201).json({
    status: 'success',
    data: {
      mapping
    }
  });
});

// Update rate mapping
export const updateRateMapping = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const updates = { ...req.body };
  
  // Add updatedBy field
  updates.updatedBy = req.user?._id;
  
  // If changing channel rate plan ID, check for duplicates
  if (updates.channelRatePlanId && updates.roomMappingId) {
    const existingMapping = await RateMapping.findOne({
      _id: { $ne: id },
      roomMappingId: updates.roomMappingId,
      channelRatePlanId: updates.channelRatePlanId
    });
    
    if (existingMapping) {
      return next(new ApplicationError('Channel rate plan ID already mapped for this room mapping', 409));
    }
  }
  
  const mapping = await RateMapping.findByIdAndUpdate(
    id,
    updates,
    { new: true, runValidators: true }
  ).populate('roomMappingDetails channelInfo');
  
  if (!mapping) {
    return next(new ApplicationError('Rate mapping not found', 404));
  }
  
  logger.info('Rate mapping updated', {
    mappingId: mapping._id,
    updates: Object.keys(updates),
    userId: req.user?._id
  });
  
  res.status(200).json({
    status: 'success',
    data: {
      mapping
    }
  });
});

// Delete rate mapping
export const deleteRateMapping = catchAsync(async (req, res, next) => {
  const mapping = await RateMapping.findByIdAndDelete(req.params.id);
  
  if (!mapping) {
    return next(new ApplicationError('Rate mapping not found', 404));
  }
  
  logger.info('Rate mapping deleted', {
    mappingId: req.params.id,
    userId: req.user?._id
  });
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Get rate mappings by room mapping
export const getRateMappingsByRoomMapping = catchAsync(async (req, res, next) => {
  const { roomMappingId } = req.params;
  const { activeOnly = true } = req.query;
  
  const mappings = await RateMapping.findByRoomMapping(roomMappingId, activeOnly === 'true');
  
  res.status(200).json({
    status: 'success',
    results: mappings.length,
    data: {
      mappings
    }
  });
});

// Get rate mappings by PMS rate plan
export const getRateMappingsByRatePlan = catchAsync(async (req, res, next) => {
  const { pmsRatePlanId } = req.params;
  const { activeOnly = true } = req.query;
  
  const mappings = await RateMapping.findByRatePlan(pmsRatePlanId, activeOnly === 'true');
  
  res.status(200).json({
    status: 'success',
    results: mappings.length,
    data: {
      mappings
    }
  });
});

// Test rate calculation
export const testRateCalculation = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { baseRate, checkIn, dayOfWeek } = req.body;
  
  const mapping = await RateMapping.findById(id);
  if (!mapping) {
    return next(new ApplicationError('Rate mapping not found', 404));
  }
  
  const calculatedRate = mapping.calculateChannelRate(baseRate, checkIn, dayOfWeek);
  
  res.status(200).json({
    status: 'success',
    data: {
      baseRate,
      calculatedRate,
      difference: calculatedRate - baseRate,
      percentageChange: ((calculatedRate - baseRate) / baseRate * 100).toFixed(2)
    }
  });
});

/**
 * Bulk Operations
 */

// Bulk create room mappings
export const bulkCreateRoomMappings = catchAsync(async (req, res, next) => {
  const { mappings } = req.body;
  
  if (!Array.isArray(mappings) || mappings.length === 0) {
    return next(new ApplicationError('Mappings array is required', 400));
  }
  
  // Add createdBy to all mappings
  const mappingsWithUser = mappings.map(mapping => ({
    ...mapping,
    createdBy: req.user?._id
  }));
  
  const createdMappings = await RoomMapping.insertMany(mappingsWithUser, { ordered: false });
  
  logger.info('Bulk room mappings created', {
    count: createdMappings.length,
    userId: req.user?._id
  });
  
  res.status(201).json({
    status: 'success',
    results: createdMappings.length,
    data: {
      mappings: createdMappings
    }
  });
});

// Update sync status for multiple mappings
export const bulkUpdateSyncStatus = catchAsync(async (req, res, next) => {
  const { mappings } = req.body; // Array of {id, status, error}
  
  const promises = mappings.map(async ({ id, status, error }) => {
    const mapping = await RoomMapping.findById(id);
    if (mapping) {
      return mapping.updateSyncStatus(status, error);
    }
  });
  
  const results = await Promise.allSettled(promises);
  const successful = results.filter(r => r.status === 'fulfilled').length;
  
  res.status(200).json({
    status: 'success',
    data: {
      total: mappings.length,
      successful,
      failed: mappings.length - successful
    }
  });
});
