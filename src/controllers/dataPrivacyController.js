import dataPrivacyService from '../services/dataPrivacyService.js';
import encryptionService from '../services/encryptionService.js';
import logger from '../utils/logger.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';

export const recordConsent = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const { consents, version, method, doubleOptIn, validUntil, metadata } = req.body;

    if (!consents || typeof consents !== 'object') {
      throw new ValidationError('Consents object is required');
    }

    const consentData = {
      consents,
      version: version || '1.0',
      method: method || 'web_form',
      doubleOptIn: doubleOptIn || false,
      validUntil,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      metadata
    };

    const result = await dataPrivacyService.recordConsent(userId, consentData);

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const checkConsent = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { purpose } = req.query;

    if (!purpose) {
      throw new ValidationError('Purpose is required');
    }

    const result = await dataPrivacyService.checkConsent(userId, purpose);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const createProcessingAgreement = async (req, res, next) => {
  try {
    const {
      name,
      contact,
      purpose,
      dataCategories,
      retentionPeriod,
      securityMeasures,
      location,
      subProcessors,
      expiryDate,
      auditFrequency
    } = req.body;

    if (!name || !contact || !purpose || !dataCategories) {
      throw new ValidationError('Name, contact, purpose, and data categories are required');
    }

    const processorData = {
      name,
      contact,
      purpose,
      dataCategories,
      retentionPeriod,
      securityMeasures: securityMeasures || [],
      location,
      subProcessors: subProcessors || [],
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      auditFrequency: auditFrequency || 'annual'
    };

    const agreement = await dataPrivacyService.createProcessingAgreement(processorData);

    logger.info('Processing agreement created', {
      agreementId: agreement.id,
      processor: name,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: agreement
    });
  } catch (error) {
    next(error);
  }
};

export const minimizeData = async (req, res, next) => {
  try {
    const { data, purpose, userRole } = req.body;

    if (!data || !purpose) {
      throw new ValidationError('Data and purpose are required');
    }

    const minimizedData = await dataPrivacyService.minimizeData(
      data, 
      purpose, 
      userRole || req.user?.role || 'guest'
    );

    res.json({
      success: true,
      data: {
        original: data,
        minimized: minimizedData,
        purpose,
        userRole: userRole || req.user?.role || 'guest'
      }
    });
  } catch (error) {
    next(error);
  }
};

export const anonymizeData = async (req, res, next) => {
  try {
    const { data, anonymizationType } = req.body;

    if (!data) {
      throw new ValidationError('Data is required');
    }

    const anonymizedData = await dataPrivacyService.anonymizeForAnalytics(
      data,
      anonymizationType || 'hash'
    );

    res.json({
      success: true,
      data: {
        original: Object.keys(data), // Only return field names, not values
        anonymized: anonymizedData,
        anonymizationType: anonymizationType || 'hash'
      }
    });
  } catch (error) {
    next(error);
  }
};

export const checkRetentionCompliance = async (req, res, next) => {
  try {
    const results = await dataPrivacyService.checkRetentionCompliance();

    res.json({
      success: true,
      data: {
        ...results,
        checkedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
};

export const generatePrivacyImpactAssessment = async (req, res, next) => {
  try {
    const {
      name,
      dataTypes,
      sources,
      recipients,
      crossBorderTransfers,
      risks,
      mitigations,
      lawfulBasis,
      specialCategories,
      securityMeasures,
      retentionPeriod,
      automaticProcessing,
      largScale,
      vulnerableSubjects,
      newTechnology,
      profiling,
      publicAccess,
      encryptionAtRest,
      encryptionInTransit,
      highRisk
    } = req.body;

    if (!name || !dataTypes || !lawfulBasis) {
      throw new ValidationError('Project name, data types, and lawful basis are required');
    }

    const projectData = {
      name,
      assessor: req.user.id,
      dataTypes,
      sources: sources || [],
      recipients: recipients || [],
      crossBorderTransfers: crossBorderTransfers || false,
      risks: risks || [],
      mitigations: mitigations || [],
      lawfulBasis,
      specialCategories: specialCategories || false,
      securityMeasures: securityMeasures || [],
      retentionPeriod,
      automaticProcessing: automaticProcessing || false,
      largScale: largScale || false,
      vulnerableSubjects: vulnerableSubjects || false,
      newTechnology: newTechnology || false,
      profiling: profiling || false,
      publicAccess: publicAccess || false,
      encryptionAtRest: encryptionAtRest || false,
      encryptionInTransit: encryptionInTransit || false,
      highRisk: highRisk || false
    };

    const pia = await dataPrivacyService.generatePrivacyImpactAssessment(projectData);

    logger.info('Privacy Impact Assessment generated', {
      piaId: pia.id,
      projectName: name,
      assessor: req.user.id
    });

    res.status(201).json({
      success: true,
      data: pia
    });
  } catch (error) {
    next(error);
  }
};

export const createPrivacyNotice = async (req, res, next) => {
  try {
    const { purpose, dataTypes, legalBasis } = req.body;

    if (!purpose || !dataTypes || !legalBasis) {
      throw new ValidationError('Purpose, data types, and legal basis are required');
    }

    const notice = dataPrivacyService.createPurposeSpecificNotice(purpose, dataTypes, legalBasis);

    res.status(201).json({
      success: true,
      data: notice
    });
  } catch (error) {
    next(error);
  }
};

export const updatePrivacyPreferences = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.params.userId;
    const preferences = req.body;

    if (!preferences || Object.keys(preferences).length === 0) {
      throw new ValidationError('Preferences are required');
    }

    const updatedPreferences = await dataPrivacyService.updatePrivacyPreferences(userId, preferences);

    res.json({
      success: true,
      data: updatedPreferences
    });
  } catch (error) {
    next(error);
  }
};

export const getPrivacyPreferences = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.params.userId;
    
    const preferences = dataPrivacyService.privacySettings.get(userId) || {};

    res.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    next(error);
  }
};

export const getComplianceDashboard = async (req, res, next) => {
  try {
    const dashboard = dataPrivacyService.getComplianceDashboard();

    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    next(error);
  }
};

export const getRetentionRules = async (req, res, next) => {
  try {
    const rules = dataPrivacyService.retentionRules;

    res.json({
      success: true,
      data: {
        rules,
        totalRules: Object.keys(rules).length
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getProcessingAgreements = async (req, res, next) => {
  try {
    const { status, expiringSoon } = req.query;
    
    let agreements = Array.from(dataPrivacyService.dataProcessingAgreements.values());

    // Filter by status
    if (status) {
      agreements = agreements.filter(agreement => agreement.status === status);
    }

    // Filter expiring soon (within 30 days)
    if (expiringSoon === 'true') {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      
      agreements = agreements.filter(agreement => 
        agreement.expiryDate && new Date(agreement.expiryDate) <= thirtyDaysFromNow
      );
    }

    res.json({
      success: true,
      data: {
        agreements,
        total: agreements.length
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getConsentHistory = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const userConsents = Array.from(dataPrivacyService.consentRecords.values())
      .filter(record => record.userId === userId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Don't return encrypted consent data
    const sanitizedConsents = userConsents.map(consent => ({
      id: consent.id,
      timestamp: consent.timestamp,
      consentVersion: consent.consentVersion,
      method: consent.method,
      doubleOptIn: consent.doubleOptIn,
      validUntil: consent.validUntil,
      // Decrypt consents for display
      consents: consent.encryptedConsents ? 
        JSON.parse(encryptionService.decryptData(consent.encryptedConsents, 'pii')) :
        consent.consents
    }));

    res.json({
      success: true,
      data: {
        userId,
        consentHistory: sanitizedConsents,
        total: sanitizedConsents.length
      }
    });
  } catch (error) {
    next(error);
  }
};

export const validateDataProcessing = async (req, res, next) => {
  try {
    const { purpose, dataTypes, legalBasis, userId } = req.body;

    if (!purpose || !dataTypes || !legalBasis) {
      throw new ValidationError('Purpose, data types, and legal basis are required');
    }

    const validation = {
      purpose,
      dataTypes,
      legalBasis,
      isValid: true,
      issues: [],
      recommendations: []
    };

    // Check if consent is required and available
    if (legalBasis === 'consent' && userId) {
      const consentCheck = await dataPrivacyService.checkConsent(userId, purpose);
      if (!consentCheck.hasConsent) {
        validation.isValid = false;
        validation.issues.push('Consent required but not found or expired');
        validation.recommendations.push('Obtain valid consent before processing');
      }
    }

    // Check retention compliance
    if (dataTypes.some(type => type.includes('personal'))) {
      validation.recommendations.push('Ensure data retention policies are applied');
    }

    // Security recommendations
    if (dataTypes.some(type => type.includes('sensitive'))) {
      validation.recommendations.push('Apply enhanced security measures for sensitive data');
    }

    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    next(error);
  }
};

export default {
  recordConsent,
  checkConsent,
  createProcessingAgreement,
  minimizeData,
  anonymizeData,
  checkRetentionCompliance,
  generatePrivacyImpactAssessment,
  createPrivacyNotice,
  updatePrivacyPreferences,
  getPrivacyPreferences,
  getComplianceDashboard,
  getRetentionRules,
  getProcessingAgreements,
  getConsentHistory,
  validateDataProcessing
};
