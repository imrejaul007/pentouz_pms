import AuditLog from '../models/AuditLog.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';

// Get audit logs with filtering and pagination
export const getAuditLogs = catchAsync(async (req, res, next) => {
  const {
    action,
    entityType,
    entityId,
    userId,
    category,
    severity,
    status,
    startDate,
    endDate,
    tags,
    page = 1,
    limit = 50,
    sortBy = 'timestamp',
    sortOrder = 'desc'
  } = req.query;

  // Build query filters
  const filters = {
    hotelId: req.user.hotelId
  };

  if (action) filters.changeType = action;
  if (entityType) filters.tableName = entityType;
  if (entityId) filters.recordId = entityId;
  if (userId) filters.userId = userId;
  if (category) filters['metadata.priority'] = category;
  if (status) filters['reconciliation.status'] = status;

  if (tags) {
    const tagArray = Array.isArray(tags) ? tags : [tags];
    filters['metadata.tags'] = { $in: tagArray };
  }

  if (startDate || endDate) {
    filters.createdAt = {};
    if (startDate) filters.createdAt.$gte = new Date(startDate);
    if (endDate) filters.createdAt.$lte = new Date(endDate);
  }

  // Get total count for pagination
  const totalCount = await AuditLog.countDocuments(filters);

  // Build sort object
  const sort = {};
  sort[sortBy === 'timestamp' ? 'createdAt' : sortBy] = sortOrder === 'desc' ? -1 : 1;

  // Execute query
  const auditLogs = await AuditLog.find(filters)
    .populate('userId', 'name email role')
    .populate('sourceDetails.channel', 'name category')
    .sort(sort)
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  // Transform data for response
  const transformedLogs = auditLogs.map(log => ({
    id: log._id,
    auditId: log.logId,
    action: log.changeType,
    entityType: log.tableName,
    entityId: log.recordId,
    user: log.userId ? {
      id: log.userId._id,
      name: log.userId.name,
      email: log.userId.email,
      role: log.userId.role
    } : null,
    changes: {
      before: log.oldValues,
      after: log.newValues,
      changedFields: log.changedFields
    },
    metadata: {
      source: log.source,
      channel: log.sourceDetails?.channelName,
      ipAddress: log.sourceDetails?.ipAddress,
      userAgent: log.sourceDetails?.userAgent,
      priority: log.metadata?.priority,
      tags: log.metadata?.tags,
      correlationId: log.metadata?.correlationId
    },
    bookingDetails: log.bookingDetails,
    inventoryDetails: log.inventoryDetails,
    error: log.error,
    reconciliation: log.reconciliation,
    timestamp: log.createdAt,
    updatedAt: log.updatedAt
  }));

  res.status(200).json({
    success: true,
    data: transformedLogs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalCount,
      pages: Math.ceil(totalCount / parseInt(limit))
    }
  });
});

// Get specific audit log by ID
export const getAuditLogById = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const auditLog = await AuditLog.findOne({
    _id: id,
    hotelId: req.user.hotelId
  })
    .populate('userId', 'name email role')
    .populate('sourceDetails.channel', 'name category')
    .populate('reconciliation.reconciledBy', 'name email');

  if (!auditLog) {
    return next(new ApplicationError('Audit log not found', 404));
  }

  const transformedLog = {
    id: auditLog._id,
    auditId: auditLog.logId,
    action: auditLog.changeType,
    entityType: auditLog.tableName,
    entityId: auditLog.recordId,
    user: auditLog.userId ? {
      id: auditLog.userId._id,
      name: auditLog.userId.name,
      email: auditLog.userId.email,
      role: auditLog.userId.role
    } : null,
    changes: {
      before: auditLog.oldValues,
      after: auditLog.newValues,
      changedFields: auditLog.changedFields
    },
    metadata: {
      source: auditLog.source,
      channel: auditLog.sourceDetails?.channel,
      ipAddress: auditLog.sourceDetails?.ipAddress,
      userAgent: auditLog.sourceDetails?.userAgent,
      sessionId: auditLog.sourceDetails?.sessionId,
      priority: auditLog.metadata?.priority,
      tags: auditLog.metadata?.tags,
      correlationId: auditLog.metadata?.correlationId,
      batchId: auditLog.metadata?.batchId
    },
    bookingDetails: auditLog.bookingDetails,
    inventoryDetails: auditLog.inventoryDetails,
    error: auditLog.error,
    reconciliation: {
      status: auditLog.reconciliation.status,
      reconciledAt: auditLog.reconciliation.reconciledAt,
      reconciledBy: auditLog.reconciliation.reconciledBy,
      notes: auditLog.reconciliation.notes
    },
    timestamp: auditLog.createdAt,
    updatedAt: auditLog.updatedAt,
    retentionDate: auditLog.retentionDate
  };

  res.status(200).json({
    success: true,
    data: transformedLog
  });
});

// Get audit trail for a specific entity
export const getEntityAuditTrail = catchAsync(async (req, res, next) => {
  const { entityType, entityId } = req.params;
  const { page = 1, limit = 50 } = req.query;

  const auditLogs = await AuditLog.getChangeHistory(entityType, entityId, {
    hotelId: req.user.hotelId,
    limit: parseInt(limit),
    skip: (parseInt(page) - 1) * parseInt(limit)
  });

  const totalCount = await AuditLog.countDocuments({
    tableName: entityType,
    recordId: entityId,
    hotelId: req.user.hotelId
  });

  res.status(200).json({
    success: true,
    data: auditLogs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalCount,
      pages: Math.ceil(totalCount / parseInt(limit))
    }
  });
});

// Get audit statistics
export const getAuditStats = catchAsync(async (req, res, next) => {
  const { startDate, endDate, period = '30d' } = req.query;

  // Calculate date range if period is provided
  let dateRange = {};
  if (period) {
    const periodMap = {
      '24h': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365
    };
    const days = periodMap[period] || 30;
    dateRange.start = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    dateRange.end = new Date();
  }

  if (startDate) dateRange.start = new Date(startDate);
  if (endDate) dateRange.end = new Date(endDate);

  const filters = { hotelId: req.user.hotelId };
  if (dateRange.start || dateRange.end) {
    filters.createdAt = {};
    if (dateRange.start) filters.createdAt.$gte = dateRange.start;
    if (dateRange.end) filters.createdAt.$lte = dateRange.end;
  }

  // Get comprehensive statistics
  const [
    totalLogs,
    actionBreakdown,
    entityBreakdown,
    userActivity,
    dailyActivity,
    sourceBreakdown,
    errorLogs
  ] = await Promise.all([
    // Total logs count
    AuditLog.countDocuments(filters),

    // Action breakdown
    AuditLog.aggregate([
      { $match: filters },
      { $group: { _id: '$changeType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]),

    // Entity type breakdown
    AuditLog.aggregate([
      { $match: filters },
      { $group: { _id: '$tableName', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),

    // User activity
    AuditLog.aggregate([
      { $match: filters },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$userId',
          name: { $first: '$user.name' },
          email: { $first: '$user.email' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]),

    // Daily activity (last 30 days)
    AuditLog.aggregate([
      {
        $match: {
          ...filters,
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]),

    // Source breakdown
    AuditLog.aggregate([
      { $match: filters },
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),

    // Error logs
    AuditLog.countDocuments({
      ...filters,
      error: { $exists: true, $ne: null }
    })
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalLogs,
      errorLogs,
      period: period || 'custom',
      dateRange,
      breakdown: {
        actions: actionBreakdown.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        entities: entityBreakdown.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        sources: sourceBreakdown.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      },
      activity: {
        users: userActivity,
        daily: dailyActivity
      }
    }
  });
});

// Clean up old audit logs
export const cleanupAuditLogs = catchAsync(async (req, res, next) => {
  const { daysToKeep = 365, dryRun = false } = req.body;

  if (req.user.role !== 'admin') {
    return next(new ApplicationError('Only administrators can perform audit log cleanup', 403));
  }

  const cutoffDate = new Date(Date.now() - (parseInt(daysToKeep) * 24 * 60 * 60 * 1000));

  if (dryRun) {
    // Just count what would be deleted
    const count = await AuditLog.countDocuments({
      hotelId: req.user.hotelId,
      createdAt: { $lt: cutoffDate }
    });

    return res.status(200).json({
      success: true,
      message: `Dry run completed. ${count} logs would be deleted.`,
      data: {
        logsToDelete: count,
        cutoffDate,
        daysToKeep: parseInt(daysToKeep)
      }
    });
  }

  // Perform actual cleanup
  const result = await AuditLog.deleteMany({
    hotelId: req.user.hotelId,
    createdAt: { $lt: cutoffDate }
  });

  // Log the cleanup action
  await AuditLog.logChange({
    hotelId: req.user.hotelId,
    tableName: 'AuditLog',
    recordId: 'cleanup',
    changeType: 'delete',
    userId: req.user._id,
    userEmail: req.user.email,
    userRole: req.user.role,
    source: 'manual',
    sourceDetails: {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    },
    metadata: {
      deletedCount: result.deletedCount,
      cutoffDate,
      daysToKeep: parseInt(daysToKeep),
      priority: 'high',
      tags: ['cleanup', 'maintenance']
    }
  });

  res.status(200).json({
    success: true,
    message: `Successfully deleted ${result.deletedCount} audit logs`,
    data: {
      deletedCount: result.deletedCount,
      cutoffDate,
      daysToKeep: parseInt(daysToKeep)
    }
  });
});

// Mark audit logs as reconciled (for channel sync discrepancies)
export const reconcileAuditLog = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  const auditLog = await AuditLog.findOne({
    _id: id,
    hotelId: req.user.hotelId
  });

  if (!auditLog) {
    return next(new ApplicationError('Audit log not found', 404));
  }

  if (!['reconciled', 'discrepancy'].includes(status)) {
    return next(new ApplicationError('Status must be either reconciled or discrepancy', 400));
  }

  if (status === 'reconciled') {
    await auditLog.markReconciled(req.user._id, notes);
  } else {
    await auditLog.markDiscrepancy(req.user._id, notes);
  }

  res.status(200).json({
    success: true,
    message: `Audit log marked as ${status}`,
    data: auditLog
  });
});

// Create manual audit log entry (for system administrators)
export const createAuditLog = catchAsync(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new ApplicationError('Only administrators can create manual audit logs', 403));
  }

  const {
    action,
    entityType,
    entityId,
    changes,
    notes,
    priority = 'medium',
    tags = []
  } = req.body;

  const auditLog = await AuditLog.logChange({
    hotelId: req.user.hotelId,
    tableName: entityType,
    recordId: entityId,
    changeType: action,
    userId: req.user._id,
    userEmail: req.user.email,
    userRole: req.user.role,
    source: 'manual',
    oldValues: changes?.before || {},
    newValues: changes?.after || {},
    sourceDetails: {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    },
    metadata: {
      priority,
      tags: [...tags, 'manual_entry'],
      notes
    }
  });

  res.status(201).json({
    success: true,
    message: 'Manual audit log created successfully',
    data: auditLog
  });
});

export default {
  getAuditLogs,
  getAuditLogById,
  getEntityAuditTrail,
  getAuditStats,
  cleanupAuditLogs,
  reconcileAuditLog,
  createAuditLog
};
