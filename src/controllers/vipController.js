import vipService from '../services/vipService.js';
import VIPGuest from '../models/VIPGuest.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';

// Get all VIP guests
export const getAllVIPGuests = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    vipLevel,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  const filters = {
    hotelId: req.user.hotelId,
    status,
    vipLevel,
    search,
    page: parseInt(page),
    limit: parseInt(limit),
    sortBy,
    sortOrder
  };

  const result = await vipService.getVIPGuests(filters);

  res.json({
    status: 'success',
    results: result.vipGuests.length,
    pagination: result.pagination,
    data: { vipGuests: result.vipGuests }
  });
});

// Get VIP guest by ID
export const getVIPGuest = catchAsync(async (req, res) => {
  const vipGuest = await VIPGuest.findById(req.params.id)
    .populate('guestId', 'name email phone')
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .populate('assignedConcierge', 'name email');

  if (!vipGuest) {
    throw new ApplicationError('VIP guest not found', 404);
  }

  // Check if user has access to this VIP guest
  if (vipGuest.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('Access denied', 403);
  }

  res.json({
    status: 'success',
    data: { vipGuest }
  });
});

// Add guest to VIP program
export const addToVIP = catchAsync(async (req, res) => {
  const vipData = {
    ...req.body,
    hotelId: req.user.hotelId
  };

  const vipGuest = await vipService.addToVIP(
    vipData,
    req.user._id,
    req.user.hotelId
  );

  res.status(201).json({
    status: 'success',
    data: { vipGuest }
  });
});

// Update VIP guest
export const updateVIPGuest = catchAsync(async (req, res) => {
  const vipGuest = await vipService.updateVIP(
    req.params.id,
    req.body,
    req.user._id
  );

  res.json({
    status: 'success',
    data: { vipGuest }
  });
});

// Remove guest from VIP program
export const removeFromVIP = catchAsync(async (req, res) => {
  const { reason } = req.body;

  const vipGuest = await vipService.removeFromVIP(
    req.params.id,
    req.user._id,
    reason
  );

  res.json({
    status: 'success',
    data: { vipGuest }
  });
});

// Check if guest is VIP
export const checkVIPStatus = catchAsync(async (req, res) => {
  const { guestId } = req.params;
  const { hotelId } = req.query;

  const targetHotelId = hotelId || req.user.hotelId;
  const vipGuest = await vipService.checkVIPStatus(guestId, targetHotelId);

  res.json({
    status: 'success',
    data: {
      isVIP: !!vipGuest,
      vipGuest
    }
  });
});

// Get VIP statistics
export const getVIPStatistics = catchAsync(async (req, res) => {
  const stats = await vipService.getVIPStatistics(req.user.hotelId);

  res.json({
    status: 'success',
    data: stats
  });
});

// Assign concierge to VIP guest
export const assignConcierge = catchAsync(async (req, res) => {
  const { conciergeId } = req.body;

  if (!conciergeId) {
    throw new ApplicationError('Concierge ID is required', 400);
  }

  const vipGuest = await vipService.assignConcierge(
    req.params.id,
    conciergeId,
    req.user
  );

  res.json({
    status: 'success',
    data: { vipGuest }
  });
});

// Get VIP benefits for guest
export const getVIPBenefits = catchAsync(async (req, res) => {
  const { guestId } = req.params;

  const benefits = await vipService.getVIPBenefits(guestId, req.user.hotelId);

  res.json({
    status: 'success',
    data: { benefits }
  });
});

// Auto-expire VIP statuses
export const autoExpireVIPs = catchAsync(async (req, res) => {
  const expiredCount = await vipService.autoExpireVIPs(req.user.hotelId);

  res.json({
    status: 'success',
    data: {
      expiredCount,
      message: `Expired ${expiredCount} VIP statuses`
    }
  });
});

// Get expiring VIPs
export const getExpiringVIPs = catchAsync(async (req, res) => {
  const { days = 30 } = req.query;

  const expiringVIPs = await vipService.getExpiringVIPs(req.user.hotelId, parseInt(days));

  res.json({
    status: 'success',
    results: expiringVIPs.length,
    data: { expiringVIPs }
  });
});

// Get VIP guest history
export const getVIPGuestHistory = catchAsync(async (req, res) => {
  const { guestId } = req.params;

  const history = await vipService.getVIPGuestHistory(guestId, req.user.hotelId);

  res.json({
    status: 'success',
    results: history.length,
    data: { history }
  });
});

// Bulk update VIP guests
export const bulkUpdateVIPGuests = catchAsync(async (req, res) => {
  const { vipIds, updateData } = req.body;

  if (!Array.isArray(vipIds) || vipIds.length === 0) {
    throw new ApplicationError('VIP IDs array is required', 400);
  }

  const result = await vipService.bulkUpdateVIPGuests(
    vipIds,
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

// Export VIP data
export const exportVIPData = catchAsync(async (req, res) => {
  const { format = 'csv' } = req.query;

  const data = await vipService.exportVIPData(req.user.hotelId, format);

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=vip_guests.csv');
    res.send(data);
  } else {
    res.json({
      status: 'success',
      results: data.length,
      data: { vipGuests: data }
    });
  }
});

// Validate VIP booking
export const validateVIPBooking = catchAsync(async (req, res) => {
  const { guestId } = req.body;
  const { hotelId } = req.query;

  if (!guestId) {
    throw new ApplicationError('Guest ID is required', 400);
  }

  const targetHotelId = hotelId || req.user.hotelId;
  const validation = await vipService.validateVIPBooking(guestId, targetHotelId, req.body);

  res.json({
    status: 'success',
    data: validation
  });
});

// Get VIP level requirements
export const getVIPLevelRequirements = catchAsync(async (req, res) => {
  const requirements = vipService.getVIPLevelRequirements();

  res.json({
    status: 'success',
    data: { requirements }
  });
});

// Update qualification criteria after stay
export const updateQualificationAfterStay = catchAsync(async (req, res) => {
  const { guestId, stayData } = req.body;

  if (!guestId || !stayData) {
    throw new ApplicationError('Guest ID and stay data are required', 400);
  }

  const vipGuest = await vipService.updateQualificationAfterStay(
    guestId,
    req.user.hotelId,
    stayData
  );

  res.json({
    status: 'success',
    data: { vipGuest }
  });
});

// Get concierge staff for assignment
export const getConciergeStaff = catchAsync(async (req, res) => {
  const User = (await import('../models/User.js')).default;
  
  const conciergeStaff = await User.find({
    hotelId: req.user.hotelId,
    role: { $in: ['admin', 'manager', 'staff'] },
    isActive: true
  }).select('name email role');

  res.json({
    status: 'success',
    results: conciergeStaff.length,
    data: { conciergeStaff }
  });
});

export default {
  getAllVIPGuests,
  getVIPGuest,
  addToVIP,
  updateVIPGuest,
  removeFromVIP,
  checkVIPStatus,
  getVIPStatistics,
  assignConcierge,
  getVIPBenefits,
  autoExpireVIPs,
  getExpiringVIPs,
  getVIPGuestHistory,
  bulkUpdateVIPGuests,
  exportVIPData,
  validateVIPBooking,
  getVIPLevelRequirements,
  updateQualificationAfterStay,
  getConciergeStaff
};
