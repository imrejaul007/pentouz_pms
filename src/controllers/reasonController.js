import reasonService from '../services/reasonService.js';
import { catchAsync } from '../utils/catchAsync.js';

// Create a new reason
export const createReason = catchAsync(async (req, res) => {
  const reasonData = {
    ...req.body,
    hotelId: req.user.hotelId
  };

  const reason = await reasonService.createReason(reasonData, req.user._id);

  res.status(201).json({
    success: true,
    message: 'Reason created successfully',
    data: reason
  });
});

// Get all reasons for a hotel
export const getReasons = catchAsync(async (req, res) => {
  const { 
    category,
    isActive,
    userRole,
    departmentId,
    page,
    limit,
    sortBy,
    sortOrder
  } = req.query;

  const options = {
    category,
    isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    userRole: userRole || req.user.role,
    departmentId,
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 50,
    sortBy,
    sortOrder
  };

  const result = await reasonService.getReasonsByHotel(req.user.hotelId, options);

  res.json({
    success: true,
    data: result
  });
});

// Get reason by ID
export const getReasonById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { populate, includeUsageLog } = req.query;

  const options = {
    populate: populate === 'true',
    includeUsageLog: includeUsageLog === 'true'
  };

  const reason = await reasonService.getReasonById(id, options);

  res.json({
    success: true,
    data: reason
  });
});

// Update reason
export const updateReason = catchAsync(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const reason = await reasonService.updateReason(id, updateData, req.user._id);

  res.json({
    success: true,
    message: 'Reason updated successfully',
    data: reason
  });
});

// Delete reason
export const deleteReason = catchAsync(async (req, res) => {
  const { id } = req.params;

  await reasonService.deleteReason(id, req.user._id);

  res.json({
    success: true,
    message: 'Reason deleted successfully'
  });
});

// Get reasons by category
export const getReasonsByCategory = catchAsync(async (req, res) => {
  const { category } = req.params;
  const { includeInactive } = req.query;

  const options = {
    includeInactive: includeInactive === 'true'
  };

  const reasons = await reasonService.getReasonsByCategory(req.user.hotelId, category, options);

  res.json({
    success: true,
    data: reasons
  });
});

// Get reasons by user role
export const getReasonsByRole = catchAsync(async (req, res) => {
  const { role } = req.params;
  const { category, includeInactive } = req.query;

  const options = {
    category,
    includeInactive: includeInactive === 'true'
  };

  const reasons = await reasonService.getReasonsByRole(req.user.hotelId, role, options);

  res.json({
    success: true,
    data: reasons
  });
});

// Get most used reasons
export const getMostUsedReasons = catchAsync(async (req, res) => {
  const { limit } = req.query;

  const reasons = await reasonService.getMostUsedReasons(req.user.hotelId, parseInt(limit) || 10);

  res.json({
    success: true,
    data: reasons
  });
});

// Log reason usage
export const logReasonUsage = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { context, entityId, entityType, financialImpact, notes, approvedBy } = req.body;

  if (!context || !entityId || !entityType) {
    return res.status(400).json({
      success: false,
      message: 'Context, entityId, and entityType are required'
    });
  }

  const options = {
    financialImpact,
    notes,
    approvedBy
  };

  const reason = await reasonService.logReasonUsage(
    id, 
    req.user._id, 
    context, 
    entityId, 
    entityType, 
    options
  );

  res.json({
    success: true,
    message: 'Reason usage logged successfully',
    data: reason
  });
});

// Search reasons
export const searchReasons = catchAsync(async (req, res) => {
  const { q: searchQuery } = req.query;

  if (!searchQuery) {
    return res.status(400).json({
      success: false,
      message: 'Search query is required'
    });
  }

  const { category, userRole, limit } = req.query;
  const options = { 
    category, 
    userRole: userRole || req.user.role, 
    limit: parseInt(limit) || 20 
  };

  const reasons = await reasonService.searchReasons(
    req.user.hotelId, 
    searchQuery, 
    options
  );

  res.json({
    success: true,
    data: reasons
  });
});

// Bulk update reasons
export const bulkUpdateReasons = catchAsync(async (req, res) => {
  const { updates } = req.body;

  if (!updates || !Array.isArray(updates)) {
    return res.status(400).json({
      success: false,
      message: 'Updates array is required'
    });
  }

  const results = await reasonService.bulkUpdateReasons(
    req.user.hotelId, 
    updates, 
    req.user._id
  );

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;

  res.json({
    success: true,
    message: `Bulk update completed: ${successCount} successful, ${failureCount} failed`,
    data: results
  });
});

// Bulk create reasons
export const bulkCreateReasons = catchAsync(async (req, res) => {
  const { reasons } = req.body;

  if (!reasons || !Array.isArray(reasons)) {
    return res.status(400).json({
      success: false,
      message: 'Reasons array is required'
    });
  }

  const results = await reasonService.bulkCreateReasons(
    req.user.hotelId, 
    reasons, 
    req.user._id
  );

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;

  res.json({
    success: true,
    message: `Bulk creation completed: ${successCount} successful, ${failureCount} failed`,
    data: results
  });
});

// Export reasons
export const exportReasons = catchAsync(async (req, res) => {
  const { format = 'json' } = req.query;

  const data = await reasonService.exportReasons(req.user.hotelId, format);

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="reasons.csv"');
    res.send(data);
  } else {
    res.json({
      success: true,
      data
    });
  }
});

// Get reason statistics
export const getReasonStats = catchAsync(async (req, res) => {
  const stats = await reasonService.getReasonStats(req.user.hotelId);

  res.json({
    success: true,
    data: stats
  });
});

// Get usage analytics
export const getUsageAnalytics = catchAsync(async (req, res) => {
  const { period = '30d' } = req.query;

  const analytics = await reasonService.getUsageAnalytics(req.user.hotelId, period);

  res.json({
    success: true,
    data: analytics
  });
});

// Validate reason usage
export const validateReasonUsage = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { context, amount } = req.query;

  const options = {
    amount: parseFloat(amount) || 0,
    user: req.user
  };

  const validation = await reasonService.validateReasonUsage(id, req.user._id, context, options);

  res.json({
    success: true,
    data: validation
  });
});

// Get reason categories (static list)
export const getReasonCategories = catchAsync(async (req, res) => {
  const categories = [
    { value: 'cancellation', label: 'Cancellation', description: 'Booking cancellation reasons' },
    { value: 'no_show', label: 'No Show', description: 'Guest no-show reasons' },
    { value: 'modification', label: 'Modification', description: 'Booking modification reasons' },
    { value: 'discount', label: 'Discount', description: 'Discount application reasons' },
    { value: 'comp', label: 'Complimentary', description: 'Complimentary service reasons' },
    { value: 'refund', label: 'Refund', description: 'Refund processing reasons' },
    { value: 'upgrade', label: 'Upgrade', description: 'Room upgrade reasons' },
    { value: 'downgrade', label: 'Downgrade', description: 'Room downgrade reasons' },
    { value: 'early_checkout', label: 'Early Checkout', description: 'Early departure reasons' },
    { value: 'late_checkout', label: 'Late Checkout', description: 'Late departure reasons' },
    { value: 'damage', label: 'Damage', description: 'Property damage reasons' },
    { value: 'complaint', label: 'Complaint', description: 'Guest complaint reasons' },
    { value: 'maintenance', label: 'Maintenance', description: 'Maintenance-related reasons' },
    { value: 'overbooking', label: 'Overbooking', description: 'Overbooking situation reasons' },
    { value: 'group_booking', label: 'Group Booking', description: 'Group booking reasons' },
    { value: 'vip', label: 'VIP', description: 'VIP guest treatment reasons' },
    { value: 'loyalty', label: 'Loyalty', description: 'Loyalty program reasons' },
    { value: 'package', label: 'Package', description: 'Package deal reasons' },
    { value: 'seasonal', label: 'Seasonal', description: 'Seasonal adjustment reasons' },
    { value: 'promotional', label: 'Promotional', description: 'Promotional offer reasons' },
    { value: 'operational', label: 'Operational', description: 'Operational requirement reasons' },
    { value: 'other', label: 'Other', description: 'Other miscellaneous reasons' }
  ];

  res.json({
    success: true,
    data: categories
  });
});

// Get user roles (static list for reason permissions)
export const getUserRoles = catchAsync(async (req, res) => {
  const roles = [
    { value: 'admin', label: 'Administrator', description: 'System administrator' },
    { value: 'manager', label: 'Manager', description: 'Hotel manager' },
    { value: 'supervisor', label: 'Supervisor', description: 'Department supervisor' },
    { value: 'front_desk', label: 'Front Desk', description: 'Front desk staff' },
    { value: 'housekeeping', label: 'Housekeeping', description: 'Housekeeping staff' },
    { value: 'maintenance', label: 'Maintenance', description: 'Maintenance staff' },
    { value: 'guest_services', label: 'Guest Services', description: 'Guest services staff' }
  ];

  res.json({
    success: true,
    data: roles
  });
});

// Clone reason
export const cloneReason = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { newName, newCode } = req.body;

  if (!newName || !newCode) {
    return res.status(400).json({
      success: false,
      message: 'New name and code are required for cloning'
    });
  }

  const originalReason = await reasonService.getReasonById(id);
  
  if (!originalReason) {
    return res.status(404).json({
      success: false,
      message: 'Original reason not found'
    });
  }

  // Create new reason data by copying from original
  const newReasonData = {
    ...originalReason.toObject(),
    name: newName,
    code: newCode,
    // Reset usage data
    usage: {
      totalUsed: 0,
      lastUsed: null,
      avgFrequencyPerMonth: 0,
      avgFinancialImpact: 0,
      commonPatterns: []
    },
    usageLog: []
  };

  // Remove fields that shouldn't be cloned
  delete newReasonData._id;
  delete newReasonData.createdAt;
  delete newReasonData.updatedAt;
  delete newReasonData.__v;

  const clonedReason = await reasonService.createReason(
    newReasonData, 
    req.user._id
  );

  res.status(201).json({
    success: true,
    message: 'Reason cloned successfully',
    data: clonedReason
  });
});

// Update reason status
export const updateReasonStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { isActive, reason } = req.body;

  if (typeof isActive !== 'boolean') {
    return res.status(400).json({
      success: false,
      message: 'isActive must be a boolean value'
    });
  }

  const updatedReason = await reasonService.updateReason(
    id, 
    { isActive }, 
    req.user._id
  );

  res.json({
    success: true,
    message: `Reason ${isActive ? 'activated' : 'deactivated'} successfully`,
    data: updatedReason
  });
});
