import otaPayloadService from '../services/otaPayloadService.js';
import otaAuditService from '../services/otaAuditService.js';
import payloadRetentionService from '../services/payloadRetentionService.js';
import OTAPayload from '../models/OTAPayload.js';
import AuditLog from '../models/AuditLog.js';
import logger from '../utils/logger.js';

/**
 * Get OTA payloads with filtering and pagination
 */
export const getOTAPayloads = async (req, res) => {
  try {
    const {
      channel,
      direction,
      operation,
      status,
      bookingId,
      correlationId,
      searchText,
      startDate,
      endDate,
      includeData,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filters = {
      channel,
      direction,
      operation,
      status,
      bookingId,
      correlationId,
      searchText,
      startDate,
      endDate
    };

    const options = {
      limit: Math.min(parseInt(limit), 100), // Cap at 100
      offset: (parseInt(page) - 1) * parseInt(limit),
      sortOrder,
      includeData: includeData === 'true'
    };

    const payloads = await otaPayloadService.searchPayloads(filters, options);

    // Get total count for pagination
    const totalQuery = {};
    if (filters.channel) totalQuery.channel = filters.channel;
    if (filters.direction) totalQuery.direction = filters.direction;
    if (filters.operation) totalQuery['businessContext.operation'] = filters.operation;
    if (filters.bookingId) totalQuery.relatedBookingId = filters.bookingId;
    if (filters.correlationId) totalQuery.correlationId = filters.correlationId;
    if (filters.startDate || filters.endDate) {
      totalQuery.createdAt = {};
      if (filters.startDate) totalQuery.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) totalQuery.createdAt.$lte = new Date(filters.endDate);
    }

    const total = await OTAPayload.countDocuments(totalQuery);

    res.status(200).json({
      status: 'success',
      data: {
        payloads,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        },
        filters: filters
      }
    });

  } catch (error) {
    logger.error('Failed to get OTA payloads:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Get specific OTA payload by ID with full data
 */
export const getOTAPayload = async (req, res) => {
  try {
    const { payloadId } = req.params;
    const { includeRawData = 'false' } = req.query;

    const payload = await OTAPayload.findOne({ payloadId })
      .populate('auditLogId', 'logId changeType createdAt');

    if (!payload) {
      return res.status(404).json({
        status: 'error',
        message: 'Payload not found'
      });
    }

    const result = {
      payload: payload.toObject(),
      decompressedPayload: null,
      decompressedResponse: null
    };

    // Include decompressed data if requested and user has permission
    if (includeRawData === 'true' && req.user?.role === 'admin') {
      result.decompressedPayload = await payload.getDecompressedPayload();
      result.decompressedResponse = await payload.getDecompressedResponse();
    }

    res.status(200).json({
      status: 'success',
      data: result
    });

  } catch (error) {
    logger.error('Failed to get OTA payload:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Get payload audit trail for a specific payload
 */
export const getPayloadAudit = async (req, res) => {
  try {
    const { payloadId } = req.params;

    const auditResult = await otaAuditService.auditPayload(payloadId);

    res.status(200).json({
      status: 'success',
      data: auditResult
    });

  } catch (error) {
    logger.error('Failed to get payload audit:', error);
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Get payloads for a specific booking
 */
export const getBookingPayloads = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { includeData = 'false', direction, channel } = req.query;

    const options = {
      includeData: includeData === 'true',
      direction,
      channel,
      sortOrder: 'asc'
    };

    const payloads = await otaPayloadService.getBookingPayloadHistory(bookingId, options);

    res.status(200).json({
      status: 'success',
      data: {
        bookingId,
        payloads,
        totalCount: payloads.length
      }
    });

  } catch (error) {
    logger.error('Failed to get booking payloads:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Get payload statistics and metrics
 */
export const getPayloadStats = async (req, res) => {
  try {
    const {
      channel,
      direction,
      startDate,
      endDate,
      groupBy = 'day'
    } = req.query;

    const filters = { channel, direction, startDate, endDate };
    const stats = await otaPayloadService.getPayloadStats(filters);

    // Get time-series data if date range provided
    let timeSeries = null;
    if (startDate && endDate) {
      timeSeries = await getTimeSeriesStats(filters, groupBy);
    }

    res.status(200).json({
      status: 'success',
      data: {
        stats,
        timeSeries,
        filters
      }
    });

  } catch (error) {
    logger.error('Failed to get payload stats:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Generate compliance report
 */
export const generateComplianceReport = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      channel,
      direction
    } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        status: 'error',
        message: 'Start date and end date are required'
      });
    }

    const filters = { channel, direction };
    const report = await otaAuditService.generateComplianceReport(startDate, endDate, filters);

    res.status(200).json({
      status: 'success',
      data: report
    });

  } catch (error) {
    logger.error('Failed to generate compliance report:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Reconcile OTA data for a booking
 */
export const reconcileBookingData = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const reconciliation = await otaAuditService.reconcileOTAData(bookingId);

    res.status(200).json({
      status: 'success',
      data: reconciliation
    });

  } catch (error) {
    logger.error('Failed to reconcile booking data:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Get audit logs with filtering
 */
export const getAuditLogs = async (req, res) => {
  try {
    const {
      tableName,
      recordId,
      userId,
      changeType,
      source,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query;

    const query = {};
    
    if (tableName) query.tableName = tableName;
    if (recordId) query.recordId = recordId;
    if (userId) query.userId = userId;
    if (changeType) query.changeType = changeType;
    if (source) query.source = source;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const logs = await AuditLog.find(query)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(offset);

    const total = await AuditLog.countDocuments(query);

    res.status(200).json({
      status: 'success',
      data: {
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    logger.error('Failed to get audit logs:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Search audit logs by correlation ID
 */
export const getAuditByCorrelation = async (req, res) => {
  try {
    const { correlationId } = req.params;

    // Get payloads with this correlation ID
    const payloads = await otaPayloadService.searchPayloads({ correlationId });

    // Get related audit logs
    const auditLogs = await AuditLog.find({
      'metadata.correlationId': correlationId
    })
    .populate('userId', 'name email')
    .sort({ createdAt: 1 });

    res.status(200).json({
      status: 'success',
      data: {
        correlationId,
        payloads,
        auditLogs,
        totalItems: payloads.length + auditLogs.length
      }
    });

  } catch (error) {
    logger.error('Failed to get audit by correlation:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Get retention service statistics
 */
export const getRetentionStats = async (req, res) => {
  try {
    const stats = payloadRetentionService.getStats();

    // Get additional database stats
    const totalPayloads = await OTAPayload.countDocuments();
    const archivedPayloads = await OTAPayload.countDocuments({ 'retention.archived': true });
    const overduePayloads = await OTAPayload.countDocuments({
      'retention.deleteAfter': { $lt: new Date() }
    });

    const databaseStats = {
      totalPayloads,
      archivedPayloads,
      activePayloads: totalPayloads - archivedPayloads,
      overduePayloads,
      archivePercentage: ((archivedPayloads / totalPayloads) * 100).toFixed(2)
    };

    res.status(200).json({
      status: 'success',
      data: {
        retentionService: stats,
        database: databaseStats
      }
    });

  } catch (error) {
    logger.error('Failed to get retention stats:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Manually trigger payload cleanup
 */
export const triggerManualCleanup = async (req, res) => {
  try {
    const {
      channel,
      olderThanDays,
      operation,
      limit = 100
    } = req.body;

    const criteria = {
      channel,
      olderThanDays,
      operation,
      limit: Math.min(parseInt(limit), 1000) // Cap at 1000
    };

    const result = await payloadRetentionService.manualCleanup(criteria);

    res.status(200).json({
      status: 'success',
      data: result
    });

  } catch (error) {
    logger.error('Failed to trigger manual cleanup:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Export audit data for compliance
 */
export const exportAuditData = async (req, res) => {
  try {
    const {
      format = 'json', // json, csv
      startDate,
      endDate,
      tableName,
      includePayloads = 'false'
    } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        status: 'error',
        message: 'Start date and end date are required'
      });
    }

    const query = {
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };

    if (tableName) query.tableName = tableName;

    const auditLogs = await AuditLog.find(query)
      .populate('userId', 'name email')
      .sort({ createdAt: 1 })
      .limit(10000); // Prevent excessive exports

    let exportData = auditLogs;

    // Include related payloads if requested
    if (includePayloads === 'true') {
      const correlationIds = auditLogs
        .map(log => log.metadata?.correlationId)
        .filter(id => id);

      if (correlationIds.length > 0) {
        const payloads = await OTAPayload.find({
          correlationId: { $in: correlationIds }
        })
        .select('-rawPayload -response'); // Exclude large binary data

        exportData = {
          auditLogs,
          relatedPayloads: payloads
        };
      }
    }

    // Set appropriate headers for download
    const filename = `audit-export-${startDate}-${endDate}.${format}`;
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      // Convert to CSV (simplified - would need proper CSV library)
      const csv = convertToCSV(auditLogs);
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.json({
        status: 'success',
        exportInfo: {
          generatedAt: new Date(),
          period: { startDate, endDate },
          recordCount: auditLogs.length,
          format
        },
        data: exportData
      });
    }

  } catch (error) {
    logger.error('Failed to export audit data:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Helper function to get time series statistics
 */
async function getTimeSeriesStats(filters, groupBy) {
  const groupStage = {};
  const matchStage = {};

  if (filters.channel) matchStage.channel = filters.channel;
  if (filters.direction) matchStage.direction = filters.direction;
  if (filters.startDate || filters.endDate) {
    matchStage.createdAt = {};
    if (filters.startDate) matchStage.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) matchStage.createdAt.$lte = new Date(filters.endDate);
  }

  // Group by time period
  switch (groupBy) {
    case 'hour':
      groupStage._id = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' },
        hour: { $hour: '$createdAt' }
      };
      break;
    case 'day':
    default:
      groupStage._id = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' }
      };
      break;
  }

  groupStage.count = { $sum: 1 };
  groupStage.avgSize = { $avg: '$metrics.payloadSize' };
  groupStage.channels = { $addToSet: '$channel' };

  const timeSeries = await OTAPayload.aggregate([
    { $match: matchStage },
    { $group: groupStage },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } }
  ]);

  return timeSeries;
}

/**
 * Simple CSV conversion helper
 */
function convertToCSV(data) {
  if (!data.length) return '';

  const headers = ['logId', 'tableName', 'changeType', 'createdAt', 'userId', 'source'];
  const csvRows = [headers.join(',')];

  for (const item of data) {
    const row = [
      item.logId || '',
      item.tableName || '',
      item.changeType || '',
      item.createdAt?.toISOString() || '',
      item.userId?.name || item.userId || '',
      item.source || ''
    ];
    csvRows.push(row.map(field => `"${field}"`).join(','));
  }

  return csvRows.join('\n');
}
