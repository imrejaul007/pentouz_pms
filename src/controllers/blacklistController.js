import blacklistService from '../services/blacklistService.js';
import GuestBlacklist from '../models/GuestBlacklist.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';

// Get all blacklist entries
export const getAllBlacklistEntries = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    isActive,
    type,
    category,
    appealStatus,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  const filters = {
    hotelId: req.user.hotelId,
    isActive,
    type,
    category,
    appealStatus,
    search,
    page: parseInt(page),
    limit: parseInt(limit),
    sortBy,
    sortOrder
  };

  const result = await blacklistService.getBlacklistEntries(filters);

  res.json({
    status: 'success',
    results: result.entries.length,
    pagination: result.pagination,
    data: { blacklistEntries: result.entries }
  });
});

// Get blacklist entry by ID
export const getBlacklistEntry = catchAsync(async (req, res) => {
  const blacklistEntry = await GuestBlacklist.findById(req.params.id)
    .populate('guestId', 'name email phone')
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .populate('reviewedBy', 'name email');

  if (!blacklistEntry) {
    throw new ApplicationError('Blacklist entry not found', 404);
  }

  // Check if user has access to this blacklist entry
  if (blacklistEntry.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('Access denied', 403);
  }

  res.json({
    status: 'success',
    data: { blacklistEntry }
  });
});

// Add guest to blacklist
export const addToBlacklist = catchAsync(async (req, res) => {
  const blacklistData = {
    ...req.body,
    hotelId: req.user.hotelId
  };

  const blacklistEntry = await blacklistService.addToBlacklist(
    blacklistData,
    req.user._id,
    req.user.hotelId
  );

  res.status(201).json({
    status: 'success',
    data: { blacklistEntry }
  });
});

// Update blacklist entry
export const updateBlacklistEntry = catchAsync(async (req, res) => {
  const blacklistEntry = await blacklistService.updateBlacklist(
    req.params.id,
    req.body,
    req.user._id
  );

  res.json({
    status: 'success',
    data: { blacklistEntry }
  });
});

// Remove guest from blacklist
export const removeFromBlacklist = catchAsync(async (req, res) => {
  const { reason } = req.body;

  const blacklistEntry = await blacklistService.removeFromBlacklist(
    req.params.id,
    req.user._id,
    reason
  );

  res.json({
    status: 'success',
    data: { blacklistEntry }
  });
});

// Check if guest is blacklisted
export const checkGuestBlacklist = catchAsync(async (req, res) => {
  const { guestId } = req.params;
  const { hotelId } = req.query;

  const targetHotelId = hotelId || req.user.hotelId;
  const blacklistEntry = await blacklistService.checkGuestBlacklist(guestId, targetHotelId);

  res.json({
    status: 'success',
    data: {
      isBlacklisted: !!blacklistEntry,
      blacklistEntry
    }
  });
});

// Get blacklist statistics
export const getBlacklistStatistics = catchAsync(async (req, res) => {
  const stats = await blacklistService.getBlacklistStatistics(req.user.hotelId);

  res.json({
    status: 'success',
    data: stats
  });
});

// Submit appeal
export const submitAppeal = catchAsync(async (req, res) => {
  const { appealNotes } = req.body;

  const blacklistEntry = await blacklistService.submitAppeal(
    req.params.id,
    appealNotes
  );

  res.json({
    status: 'success',
    data: { blacklistEntry }
  });
});

// Review appeal
export const reviewAppeal = catchAsync(async (req, res) => {
  const { status, notes } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    throw new ApplicationError('Invalid appeal status', 400);
  }

  const blacklistEntry = await blacklistService.reviewAppeal(
    req.params.id,
    status,
    req.user._id,
    notes
  );

  res.json({
    status: 'success',
    data: { blacklistEntry }
  });
});

// Get pending appeals
export const getPendingAppeals = catchAsync(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const filters = {
    hotelId: req.user.hotelId,
    appealStatus: 'pending',
    page: parseInt(page),
    limit: parseInt(limit),
    sortBy: 'appealDate',
    sortOrder: 'asc'
  };

  const result = await blacklistService.getBlacklistEntries(filters);

  res.json({
    status: 'success',
    results: result.entries.length,
    pagination: result.pagination,
    data: { appeals: result.entries }
  });
});

// Auto-expire temporary blacklists
export const autoExpireBlacklists = catchAsync(async (req, res) => {
  const expiredCount = await blacklistService.autoExpireBlacklists(req.user.hotelId);

  res.json({
    status: 'success',
    data: {
      expiredCount,
      message: `Expired ${expiredCount} temporary blacklist entries`
    }
  });
});

// Get expired blacklists
export const getExpiredBlacklists = catchAsync(async (req, res) => {
  const expiredBlacklists = await blacklistService.getExpiredBlacklists(req.user.hotelId);

  res.json({
    status: 'success',
    results: expiredBlacklists.length,
    data: { expiredBlacklists }
  });
});

// Get guest blacklist history
export const getGuestBlacklistHistory = catchAsync(async (req, res) => {
  const { guestId } = req.params;

  const history = await blacklistService.getGuestBlacklistHistory(guestId, req.user.hotelId);

  res.json({
    status: 'success',
    results: history.length,
    data: { history }
  });
});

// Bulk update blacklist entries
export const bulkUpdateBlacklist = catchAsync(async (req, res) => {
  const { blacklistIds, updateData } = req.body;

  if (!Array.isArray(blacklistIds) || blacklistIds.length === 0) {
    throw new ApplicationError('Blacklist IDs array is required', 400);
  }

  const result = await blacklistService.bulkUpdateBlacklist(
    blacklistIds,
    updateData,
    req.user._id
  );

  res.json({
    status: 'success',
    data: {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount
    }
  });
});

// Export blacklist data
export const exportBlacklist = catchAsync(async (req, res) => {
  const { format = 'csv' } = req.query;

  const data = await blacklistService.exportBlacklist(req.user.hotelId, format);

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=blacklist.csv');
    res.send(data);
  } else {
    res.json({
      status: 'success',
      results: data.length,
      data: { blacklistEntries: data }
    });
  }
});

// Validate booking against blacklist
export const validateBooking = catchAsync(async (req, res) => {
  const { guestId } = req.body;
  const { hotelId } = req.query;

  if (!guestId) {
    throw new ApplicationError('Guest ID is required', 400);
  }

  const targetHotelId = hotelId || req.user.hotelId;
  const validation = await blacklistService.validateBooking(guestId, targetHotelId, req.body);

  res.json({
    status: 'success',
    data: validation
  });
});

export default {
  getAllBlacklistEntries,
  getBlacklistEntry,
  addToBlacklist,
  updateBlacklistEntry,
  removeFromBlacklist,
  checkGuestBlacklist,
  getBlacklistStatistics,
  submitAppeal,
  reviewAppeal,
  getPendingAppeals,
  autoExpireBlacklists,
  getExpiredBlacklists,
  getGuestBlacklistHistory,
  bulkUpdateBlacklist,
  exportBlacklist,
  validateBooking
};
