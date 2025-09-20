import gdprComplianceService from '../services/gdprComplianceService.js';
import logger from '../utils/logger.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';

export const recordConsent = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { consents, ipAddress, userAgent, method } = req.body;

    if (!consents || typeof consents !== 'object') {
      throw new ValidationError('Consents object is required');
    }

    const consentRecord = await gdprComplianceService.recordConsent(userId, {
      consents,
      ipAddress: ipAddress || req.ip,
      userAgent: userAgent || req.headers['user-agent'],
      method: method || 'api'
    });

    logger.info('User consent recorded', {
      userId,
      consentId: consentRecord.id,
      consentsGiven: Object.keys(consents).filter(k => consents[k])
    });

    res.status(201).json({
      success: true,
      data: {
        consentId: consentRecord.id,
        timestamp: consentRecord.timestamp,
        consents: consentRecord.consents
      }
    });
  } catch (error) {
    next(error);
  }
};

export const updateConsent = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { consentId } = req.params;
    const { consents, ipAddress, userAgent } = req.body;

    if (!consents || typeof consents !== 'object') {
      throw new ValidationError('Consents object is required');
    }

    const updatedRecord = await gdprComplianceService.updateConsent(userId, consentId, {
      consents,
      ipAddress: ipAddress || req.ip,
      userAgent: userAgent || req.headers['user-agent']
    });

    res.json({
      success: true,
      data: {
        consentId: updatedRecord.id,
        timestamp: updatedRecord.timestamp,
        consents: updatedRecord.consents
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getConsentHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // In production, this would query the ConsentRecord collection
    const history = []; // Placeholder
    
    res.json({
      success: true,
      data: {
        userId,
        consentHistory: history,
        total: history.length
      }
    });
  } catch (error) {
    next(error);
  }
};

export const requestDataAccess = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { format = 'json', includeMetadata = true } = req.body;

    const result = await gdprComplianceService.handleAccessRequest(userId, {
      format,
      includeMetadata,
      requestedBy: userId,
      requestMethod: 'api'
    });

    logger.info('Data access request completed', {
      userId,
      requestId: result.requestId,
      format
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const requestDataRectification = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { corrections, reason } = req.body;

    if (!corrections || typeof corrections !== 'object') {
      throw new ValidationError('Corrections object is required');
    }

    const result = await gdprComplianceService.handleRectificationRequest(
      userId,
      corrections,
      {
        reason,
        requestedBy: userId,
        requestMethod: 'api'
      }
    );

    logger.info('Data rectification request completed', {
      userId,
      requestId: result.requestId,
      fieldsUpdated: Object.keys(corrections)
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const requestDataErasure = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { reason, confirmErasure } = req.body;

    if (!confirmErasure) {
      throw new ValidationError('Erasure confirmation is required');
    }

    if (!reason) {
      throw new ValidationError('Reason for erasure is required');
    }

    const result = await gdprComplianceService.handleErasureRequest(userId, {
      reason,
      requestedBy: userId,
      requestMethod: 'api',
      confirmed: confirmErasure
    });

    logger.info('Data erasure request processed', {
      userId,
      requestId: result.requestId,
      status: result.status,
      reason
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const requestDataPortability = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { format = 'json' } = req.body;

    const validFormats = ['json', 'csv', 'xml'];
    if (!validFormats.includes(format)) {
      throw new ValidationError(`Format must be one of: ${validFormats.join(', ')}`);
    }

    const result = await gdprComplianceService.handlePortabilityRequest(userId, format);

    logger.info('Data portability request completed', {
      userId,
      requestId: result.requestId,
      format
    });

    // Set appropriate content type
    const contentTypes = {
      json: 'application/json',
      csv: 'text/csv',
      xml: 'application/xml'
    };

    res.setHeader('Content-Type', contentTypes[format]);
    res.setHeader('Content-Disposition', `attachment; filename="user-data-${userId}.${format}"`);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const checkProcessingLawfulness = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { dataCategory, purpose } = req.params;

    const isLawful = await gdprComplianceService.isProcessingLawful(userId, dataCategory, purpose);

    res.json({
      success: true,
      data: {
        userId,
        dataCategory,
        purpose,
        isLawful,
        checkedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getPrivacyNotice = async (req, res, next) => {
  try {
    const { language = 'en' } = req.query;

    const privacyNotice = gdprComplianceService.generatePrivacyNotice();

    res.json({
      success: true,
      data: {
        language,
        privacyNotice
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getDataProcessingInfo = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get information about how user's data is processed
    const processingInfo = {
      userId,
      dataCategories: gdprComplianceService.dataCategories,
      consentTypes: gdprComplianceService.consentTypes,
      retentionPeriods: Object.entries(gdprComplianceService.dataCategories).map(([key, category]) => ({
        category: key,
        name: category.name,
        retentionDays: category.retention,
        lawfulBasis: category.lawfulBasis
      })),
      rights: [
        'access',
        'rectification', 
        'erasure',
        'portability',
        'restrict_processing',
        'object_to_processing'
      ]
    };

    res.json({
      success: true,
      data: processingInfo
    });
  } catch (error) {
    next(error);
  }
};

// Admin endpoints for GDPR management

export const getDataRetentionReport = async (req, res, next) => {
  try {
    const retentionReport = await gdprComplianceService.checkDataRetention();

    res.json({
      success: true,
      data: {
        reportDate: new Date().toISOString(),
        ...retentionReport
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getComplianceReport = async (req, res, next) => {
  try {
    const complianceReport = gdprComplianceService.getComplianceReport();

    res.json({
      success: true,
      data: complianceReport
    });
  } catch (error) {
    next(error);
  }
};

export const getAllDataRequests = async (req, res, next) => {
  try {
    const { status, type, limit = 50, offset = 0 } = req.query;

    // Get all data requests (from database in production)
    const requests = Array.from(gdprComplianceService.dataRequests.values())
      .filter(request => {
        if (status && request.status !== status) return false;
        if (type && request.type !== type) return false;
        return true;
      })
      .sort((a, b) => new Date(b.requestDate) - new Date(a.requestDate))
      .slice(offset, offset + parseInt(limit));

    res.json({
      success: true,
      data: {
        requests,
        total: requests.length,
        filters: { status, type },
        pagination: { limit: parseInt(limit), offset: parseInt(offset) }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getDataRequestById = async (req, res, next) => {
  try {
    const { requestId } = req.params;

    const request = gdprComplianceService.dataRequests.get(requestId);
    if (!request) {
      throw new NotFoundError('Data request not found');
    }

    res.json({
      success: true,
      data: request
    });
  } catch (error) {
    next(error);
  }
};

export const processDataRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { action, notes } = req.body; // approve, reject, process

    const request = gdprComplianceService.dataRequests.get(requestId);
    if (!request) {
      throw new NotFoundError('Data request not found');
    }

    // Process the request based on action
    switch (action) {
      case 'approve':
        request.status = 'approved';
        request.approvedBy = req.user.id;
        request.approvedAt = new Date();
        break;
      case 'reject':
        request.status = 'rejected';
        request.rejectedBy = req.user.id;
        request.rejectedAt = new Date();
        request.rejectionReason = notes;
        break;
      case 'process':
        // Actually execute the request
        break;
      default:
        throw new ValidationError('Invalid action');
    }

    request.notes = notes;
    request.processedBy = req.user.id;

    logger.info('Data request processed', {
      requestId,
      action,
      processedBy: req.user.id
    });

    res.json({
      success: true,
      data: request
    });
  } catch (error) {
    next(error);
  }
};

export const getBulkConsentStatus = async (req, res, next) => {
  try {
    const { userIds } = req.body;

    if (!Array.isArray(userIds)) {
      throw new ValidationError('userIds must be an array');
    }

    // Get consent status for multiple users
    const consentStatuses = userIds.map(userId => ({
      userId,
      hasConsent: true, // Placeholder - would check actual consent records
      consentDate: new Date().toISOString(),
      consentTypes: gdprComplianceService.consentTypes.reduce((acc, type) => {
        acc[type] = true; // Placeholder
        return acc;
      }, {})
    }));

    res.json({
      success: true,
      data: {
        consentStatuses,
        checkedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
};

export default {
  recordConsent,
  updateConsent,
  getConsentHistory,
  requestDataAccess,
  requestDataRectification,
  requestDataErasure,
  requestDataPortability,
  checkProcessingLawfulness,
  getPrivacyNotice,
  getDataProcessingInfo,
  getDataRetentionReport,
  getComplianceReport,
  getAllDataRequests,
  getDataRequestById,
  processDataRequest,
  getBulkConsentStatus
};
