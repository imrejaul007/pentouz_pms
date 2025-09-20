import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { operationalManagementService } from '../services/operationalManagementService.js';
import Counter from '../models/Counter.js';
import ArrivalDepartureMode from '../models/ArrivalDepartureMode.js';
import LostFound from '../models/LostFound.js';

// Counter Controllers
export const createCounter = catchAsync(async (req, res, next) => {
  const counter = await operationalManagementService.createCounter(
    req.body,
    req.user._id
  );

  res.status(201).json({
    status: 'success',
    data: {
      counter
    }
  });
});

export const getCounters = catchAsync(async (req, res, next) => {
  const { type } = req.query;
  const counters = await operationalManagementService.getCounters(
    req.user.hotelId,
    type
  );

  res.status(200).json({
    status: 'success',
    results: counters.length,
    data: {
      counters
    }
  });
});

export const getCounter = catchAsync(async (req, res, next) => {
  const counter = await Counter.findById(req.params.id)
    .populate('createdBy updatedBy', 'name email');

  if (!counter) {
    return next(new ApplicationError('Counter not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      counter
    }
  });
});

export const updateCounter = catchAsync(async (req, res, next) => {
  const counter = await operationalManagementService.updateCounter(
    req.params.id,
    req.body,
    req.user._id
  );

  res.status(200).json({
    status: 'success',
    data: {
      counter
    }
  });
});

export const updateCounterStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;
  const counter = await operationalManagementService.updateCounterStatus(
    req.params.id,
    status,
    req.user._id
  );

  res.status(200).json({
    status: 'success',
    data: {
      counter
    }
  });
});

export const deleteCounter = catchAsync(async (req, res, next) => {
  await operationalManagementService.deleteCounter(
    req.params.id,
    req.user._id
  );

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Arrival/Departure Mode Controllers
export const createArrivalDepartureMode = catchAsync(async (req, res, next) => {
  const mode = await operationalManagementService.createArrivalDepartureMode(
    req.body,
    req.user._id
  );

  res.status(201).json({
    status: 'success',
    data: {
      mode
    }
  });
});

export const getArrivalDepartureModes = catchAsync(async (req, res, next) => {
  const { type, category } = req.query;
  const modes = await operationalManagementService.getArrivalDepartureModes(
    req.user.hotelId,
    type,
    category
  );

  res.status(200).json({
    status: 'success',
    results: modes.length,
    data: {
      modes
    }
  });
});

export const getArrivalDepartureMode = catchAsync(async (req, res, next) => {
  const mode = await ArrivalDepartureMode.findById(req.params.id)
    .populate('createdBy updatedBy', 'name email');

  if (!mode) {
    return next(new ApplicationError('Arrival/Departure mode not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      mode
    }
  });
});

export const updateArrivalDepartureMode = catchAsync(async (req, res, next) => {
  const mode = await operationalManagementService.updateArrivalDepartureMode(
    req.params.id,
    req.body,
    req.user._id
  );

  res.status(200).json({
    status: 'success',
    data: {
      mode
    }
  });
});

export const deleteArrivalDepartureMode = catchAsync(async (req, res, next) => {
  await operationalManagementService.deleteArrivalDepartureMode(
    req.params.id,
    req.user._id
  );

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Lost & Found Controllers
export const createLostFoundItem = catchAsync(async (req, res, next) => {
  const item = await operationalManagementService.createLostFoundItem(
    req.body,
    req.user._id
  );

  res.status(201).json({
    status: 'success',
    data: {
      item
    }
  });
});

export const getLostFoundItems = catchAsync(async (req, res, next) => {
  const filters = {
    status: req.query.status,
    category: req.query.category,
    priority: req.query.priority,
    search: req.query.search
  };

  const items = await operationalManagementService.getLostFoundItems(
    req.user.hotelId,
    filters
  );

  res.status(200).json({
    status: 'success',
    results: items.length,
    data: {
      items
    }
  });
});

export const getLostFoundItem = catchAsync(async (req, res, next) => {
  const item = await LostFound.findById(req.params.id)
    .populate('people.foundBy people.claimedBy people.reportedBy', 'name email')
    .populate('guest.guestId', 'name email phone');

  if (!item) {
    return next(new ApplicationError('Lost & Found item not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      item
    }
  });
});

export const updateLostFoundItem = catchAsync(async (req, res, next) => {
  const item = await operationalManagementService.updateLostFoundItem(
    req.params.id,
    req.body,
    req.user._id
  );

  res.status(200).json({
    status: 'success',
    data: {
      item
    }
  });
});

export const claimLostFoundItem = catchAsync(async (req, res, next) => {
  const { claimedBy, notes } = req.body;
  const item = await operationalManagementService.claimLostFoundItem(
    req.params.id,
    claimedBy,
    notes,
    req.user._id
  );

  res.status(200).json({
    status: 'success',
    data: {
      item
    }
  });
});

export const disposeLostFoundItem = catchAsync(async (req, res, next) => {
  const { notes } = req.body;
  const item = await operationalManagementService.disposeLostFoundItem(
    req.params.id,
    notes,
    req.user._id
  );

  res.status(200).json({
    status: 'success',
    data: {
      item
    }
  });
});

export const updateLostFoundItemLocation = catchAsync(async (req, res, next) => {
  const { newLocation, notes } = req.body;
  const item = await operationalManagementService.updateLostFoundItemLocation(
    req.params.id,
    newLocation,
    notes,
    req.user._id
  );

  res.status(200).json({
    status: 'success',
    data: {
      item
    }
  });
});

// Utility Controllers
export const getOperationalOverview = catchAsync(async (req, res, next) => {
  const overview = await operationalManagementService.getOperationalOverview(
    req.user.hotelId
  );

  res.status(200).json({
    status: 'success',
    data: {
      overview
    }
  });
});

export const bulkUpdateCounterStatus = catchAsync(async (req, res, next) => {
  const { updates } = req.body;

  if (!Array.isArray(updates) || updates.length === 0) {
    return next(new ApplicationError('Updates array is required', 400));
  }

  const results = await operationalManagementService.bulkUpdateCounterStatus(
    updates,
    req.user._id
  );

  res.status(200).json({
    status: 'success',
    data: {
      results
    }
  });
});

export const bulkDisposeExpiredItems = catchAsync(async (req, res, next) => {
  const { notes } = req.body;
  const results = await operationalManagementService.bulkDisposeExpiredItems(
    notes,
    req.user._id
  );

  res.status(200).json({
    status: 'success',
    data: {
      results
    }
  });
});

// Analytics Controllers
export const getCounterAnalytics = catchAsync(async (req, res, next) => {
  const { dateRange } = req.query;
  const analytics = await operationalManagementService.getCounterAnalytics(
    req.user.hotelId,
    dateRange
  );

  res.status(200).json({
    status: 'success',
    data: {
      analytics
    }
  });
});

export const getModeAnalytics = catchAsync(async (req, res, next) => {
  const { dateRange } = req.query;
  const analytics = await operationalManagementService.getModeAnalytics(
    req.user.hotelId,
    dateRange
  );

  res.status(200).json({
    status: 'success',
    data: {
      analytics
    }
  });
});

export const getLostFoundAnalytics = catchAsync(async (req, res, next) => {
  const { dateRange } = req.query;
  const analytics = await operationalManagementService.getLostFoundAnalytics(
    req.user.hotelId,
    dateRange
  );

  res.status(200).json({
    status: 'success',
    data: {
      analytics
    }
  });
});

export const getExpiredLostFoundItems = catchAsync(async (req, res, next) => {
  const items = await operationalManagementService.getExpiredLostFoundItems(
    req.user.hotelId
  );

  res.status(200).json({
    status: 'success',
    results: items.length,
    data: {
      items
    }
  });
});

export const getValuableLostFoundItems = catchAsync(async (req, res, next) => {
  const items = await operationalManagementService.getValuableLostFoundItems(
    req.user.hotelId
  );

  res.status(200).json({
    status: 'success',
    results: items.length,
    data: {
      items
    }
  });
});

export const operationalManagementController = {
  // Counters
  createCounter,
  getCounters,
  getCounter,
  updateCounter,
  updateCounterStatus,
  deleteCounter,
  
  // Arrival/Departure Modes
  createArrivalDepartureMode,
  getArrivalDepartureModes,
  getArrivalDepartureMode,
  updateArrivalDepartureMode,
  deleteArrivalDepartureMode,
  
  // Lost & Found
  createLostFoundItem,
  getLostFoundItems,
  getLostFoundItem,
  updateLostFoundItem,
  claimLostFoundItem,
  disposeLostFoundItem,
  updateLostFoundItemLocation,
  
  // Utilities
  getOperationalOverview,
  bulkUpdateCounterStatus,
  bulkDisposeExpiredItems,
  
  // Analytics
  getCounterAnalytics,
  getModeAnalytics,
  getLostFoundAnalytics,
  getExpiredLostFoundItems,
  getValuableLostFoundItems
};
