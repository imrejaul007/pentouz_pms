import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import encryptionService from './encryptionService.js';
import gdprComplianceService from './gdprComplianceService.js';
import { v4 as uuidv4 } from 'uuid';

class DataPrivacyService {
  constructor() {
    this.privacyPolicies = new Map();
    this.consentRecords = new Map();
    this.dataProcessingAgreements = new Map();
    this.privacySettings = new Map();
    
    // Initialize default privacy policy
    this.initializeDefaultPolicy();
    
    // Data retention rules
    this.retentionRules = {
      GUEST_DATA: {
        category: 'Guest Information',
        retentionPeriod: 2555, // 7 years in days
        legalBasis: 'contract',
        autoDelete: true,
        fields: ['personalInfo', 'contactDetails', 'preferences']
      },
      BOOKING_DATA: {
        category: 'Booking Records',
        retentionPeriod: 2555, // 7 years for financial records
        legalBasis: 'legal_obligation',
        autoDelete: false, // Requires manual review
        fields: ['bookingDetails', 'paymentInfo', 'cancellations']
      },
      MARKETING_DATA: {
        category: 'Marketing Preferences',
        retentionPeriod: 1095, // 3 years
        legalBasis: 'consent',
        autoDelete: true,
        fields: ['emailPreferences', 'marketingConsent', 'behaviorData']
      },
      SESSION_DATA: {
        category: 'Session Information',
        retentionPeriod: 90, // 3 months
        legalBasis: 'legitimate_interest',
        autoDelete: true,
        fields: ['sessionLogs', 'ipAddresses', 'browserData']
      }
    };
    
    this.privacySettings.set('system', {
      dataMinimization: true,
      purposeLimitation: true,
      storageMinimization: true,
      accuracyMaintenance: true,
      integrityConfidentiality: true,
      accountability: true,
      transparencyReporting: true
    });
  }

  /**
   * Initialize default privacy policy
   */
  initializeDefaultPolicy() {
    const defaultPolicy = {
      id: 'default-v1.0',
      version: '1.0',
      effectiveDate: new Date(),
      title: 'Hotel Management System Privacy Policy',
      sections: {
        dataCollection: {
          title: 'Data We Collect',
          content: 'We collect personal information necessary for hotel operations including booking, payment, and service delivery.',
          categories: Object.keys(gdprComplianceService.dataCategories)
        },
        legalBasis: {
          title: 'Legal Basis for Processing',
          content: 'We process your data based on contract performance, legal obligations, and legitimate interests.',
          bases: ['contract', 'legal_obligation', 'legitimate_interest', 'consent']
        },
        dataSharing: {
          title: 'Data Sharing',
          content: 'We may share data with service providers, payment processors, and as required by law.',
          recipients: ['payment_processors', 'booking_channels', 'service_providers', 'legal_authorities']
        },
        retention: {
          title: 'Data Retention',
          content: 'We retain data for as long as necessary to fulfill the purposes outlined in this policy.',
          periods: this.retentionRules
        },
        rights: {
          title: 'Your Rights',
          content: 'You have rights to access, rectify, erase, restrict processing, data portability, and object to processing.',
          rights: gdprComplianceService.generatePrivacyNotice().rights
        },
        contact: {
          title: 'Contact Information',
          content: 'For privacy-related questions, contact our Data Protection Officer.',
          dpo: 'privacy@hotel.com',
          address: '123 Privacy Street, Data City, DC 12345'
        }
      }
    };
    
    this.privacyPolicies.set(defaultPolicy.id, defaultPolicy);
  }

  /**
   * Record user consent for data processing
   */
  async recordConsent(userId, consentData) {
    try {
      const consentId = uuidv4();
      const consentRecord = {
        id: consentId,
        userId,
        timestamp: new Date(),
        ipAddress: consentData.ipAddress,
        userAgent: consentData.userAgent,
        consentVersion: consentData.version || '1.0',
        consents: consentData.consents, // Object with purpose -> boolean mapping
        method: consentData.method || 'web_form',
        doubleOptIn: consentData.doubleOptIn || false,
        witnessed: consentData.witnessed || false,
        validUntil: consentData.validUntil || null,
        metadata: consentData.metadata || {}
      };

      // Encrypt sensitive consent data
      consentRecord.encryptedConsents = encryptionService.encryptData(
        JSON.stringify(consentRecord.consents),
        'pii'
      );

      this.consentRecords.set(consentId, consentRecord);

      // Also record in GDPR service
      await gdprComplianceService.recordConsent(userId, consentData);

      logger.info('Consent recorded', {
        consentId,
        userId,
        consentsGiven: Object.keys(consentData.consents).filter(k => consentData.consents[k])
      });

      return {
        consentId,
        timestamp: consentRecord.timestamp,
        consents: consentRecord.consents
      };
    } catch (error) {
      logger.error('Failed to record consent', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Check if user has given consent for specific purpose
   */
  async checkConsent(userId, purpose) {
    try {
      // Find latest consent record for user
      const userConsents = Array.from(this.consentRecords.values())
        .filter(record => record.userId === userId)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      if (userConsents.length === 0) {
        return { hasConsent: false, reason: 'No consent records found' };
      }

      const latestConsent = userConsents[0];
      
      // Decrypt consent data
      const decryptedConsents = JSON.parse(
        encryptionService.decryptData(latestConsent.encryptedConsents, 'pii')
      );

      const hasConsent = decryptedConsents[purpose] === true;
      const isExpired = latestConsent.validUntil && new Date() > new Date(latestConsent.validUntil);

      return {
        hasConsent: hasConsent && !isExpired,
        consentDate: latestConsent.timestamp,
        isExpired,
        consentId: latestConsent.id
      };
    } catch (error) {
      logger.error('Failed to check consent', { userId, purpose, error: error.message });
      return { hasConsent: false, reason: 'Error checking consent' };
    }
  }

  /**
   * Create data processing agreement
   */
  async createProcessingAgreement(processorData) {
    try {
      const agreementId = uuidv4();
      const agreement = {
        id: agreementId,
        processorName: processorData.name,
        processorContact: processorData.contact,
        processingPurpose: processorData.purpose,
        dataCategories: processorData.dataCategories,
        retentionPeriod: processorData.retentionPeriod,
        securityMeasures: processorData.securityMeasures,
        location: processorData.location,
        subProcessors: processorData.subProcessors || [],
        contractDate: new Date(),
        expiryDate: processorData.expiryDate,
        status: 'active',
        auditFrequency: processorData.auditFrequency || 'annual',
        lastAudit: null,
        nextAudit: this.calculateNextAuditDate(processorData.auditFrequency)
      };

      this.dataProcessingAgreements.set(agreementId, agreement);

      logger.info('Data processing agreement created', {
        agreementId,
        processor: processorData.name,
        purpose: processorData.purpose
      });

      return agreement;
    } catch (error) {
      logger.error('Failed to create processing agreement', { error: error.message, processorData });
      throw error;
    }
  }

  /**
   * Apply data minimization principles
   */
  async minimizeData(data, purpose, userRole = 'guest') {
    try {
      const minimizationRules = {
        booking_display: {
          guest: ['name', 'checkIn', 'checkOut', 'roomType', 'status'],
          staff: ['name', 'email', 'phone', 'checkIn', 'checkOut', 'roomType', 'status', 'specialRequests'],
          manager: ['*'] // All fields
        },
        marketing_analytics: {
          guest: [],
          staff: ['anonymizedId', 'bookingPatterns', 'preferences'],
          manager: ['anonymizedId', 'bookingPatterns', 'preferences', 'aggregatedMetrics']
        },
        financial_reporting: {
          guest: ['amount', 'paymentDate'],
          staff: ['amount', 'paymentDate', 'paymentMethod'],
          manager: ['*']
        }
      };

      const rules = minimizationRules[purpose];
      if (!rules || !rules[userRole]) {
        throw new Error(`No minimization rules found for purpose: ${purpose}, role: ${userRole}`);
      }

      const allowedFields = rules[userRole];
      if (allowedFields.includes('*')) {
        return data; // All fields allowed
      }

      // Filter data to only include allowed fields
      const minimizedData = {};
      allowedFields.forEach(field => {
        if (data[field] !== undefined) {
          minimizedData[field] = data[field];
        }
      });

      // Anonymize/pseudonymize sensitive fields
      if (purpose === 'marketing_analytics' && data.userId) {
        minimizedData.anonymizedId = encryptionService.anonymizeData(data.userId, 'pseudonym');
      }

      return minimizedData;
    } catch (error) {
      logger.error('Data minimization failed', { error: error.message, purpose, userRole });
      throw error;
    }
  }

  /**
   * Anonymize data for analytics
   */
  async anonymizeForAnalytics(data, anonymizationType = 'hash') {
    try {
      const anonymizedData = { ...data };
      
      const sensitiveFields = ['name', 'email', 'phone', 'passport', 'nationalId', 'address'];
      
      for (const field of sensitiveFields) {
        if (anonymizedData[field]) {
          anonymizedData[field] = encryptionService.anonymizeData(
            anonymizedData[field], 
            anonymizationType
          );
        }
      }

      // Generate analytics-safe ID
      if (data.userId) {
        anonymizedData.analyticsId = encryptionService.hashForSearch(data.userId);
        delete anonymizedData.userId;
      }

      return anonymizedData;
    } catch (error) {
      logger.error('Data anonymization failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Check data retention compliance
   */
  async checkRetentionCompliance() {
    try {
      const results = {
        checked: 0,
        compliant: 0,
        overdue: 0,
        actions: []
      };

      for (const [ruleKey, rule] of Object.entries(this.retentionRules)) {
        results.checked++;
        
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - rule.retentionPeriod);

        // In production, this would query actual data collections
        // For now, simulate compliance check
        const isCompliant = Math.random() > 0.1; // 90% compliance rate
        
        if (isCompliant) {
          results.compliant++;
        } else {
          results.overdue++;
          results.actions.push({
            category: rule.category,
            action: rule.autoDelete ? 'schedule_deletion' : 'manual_review',
            cutoffDate: cutoffDate.toISOString(),
            legalBasis: rule.legalBasis
          });
        }
      }

      logger.info('Retention compliance check completed', results);
      return results;
    } catch (error) {
      logger.error('Retention compliance check failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate privacy impact assessment
   */
  async generatePrivacyImpactAssessment(projectData) {
    try {
      const pia = {
        id: uuidv4(),
        projectName: projectData.name,
        assessmentDate: new Date(),
        assessor: projectData.assessor,
        
        // Data flow analysis
        dataFlow: {
          dataTypes: projectData.dataTypes || [],
          sources: projectData.sources || [],
          recipients: projectData.recipients || [],
          crossBorderTransfers: projectData.crossBorderTransfers || false
        },
        
        // Risk assessment
        riskAssessment: {
          likelihood: this.assessRiskLikelihood(projectData),
          severity: this.assessRiskSeverity(projectData),
          overallRisk: 'medium', // Will be calculated
          identifiedRisks: projectData.risks || [],
          mitigationMeasures: projectData.mitigations || []
        },
        
        // Legal compliance
        compliance: {
          lawfulBasis: projectData.lawfulBasis || 'consent',
          specialCategories: projectData.specialCategories || false,
          dataSubjectRights: true,
          securityMeasures: projectData.securityMeasures || [],
          retentionPeriod: projectData.retentionPeriod
        },
        
        // Recommendations
        recommendations: this.generatePIARecommendations(projectData),
        
        status: 'draft',
        approvalRequired: this.requiresApproval(projectData),
        dpoReview: projectData.highRisk || false
      };

      // Calculate overall risk
      pia.riskAssessment.overallRisk = this.calculateOverallRisk(
        pia.riskAssessment.likelihood,
        pia.riskAssessment.severity
      );

      logger.info('Privacy Impact Assessment generated', {
        piaId: pia.id,
        projectName: projectData.name,
        overallRisk: pia.riskAssessment.overallRisk
      });

      return pia;
    } catch (error) {
      logger.error('PIA generation failed', { error: error.message, projectData });
      throw error;
    }
  }

  /**
   * Create privacy notice for specific purpose
   */
  createPurposeSpecificNotice(purpose, dataTypes, legalBasis) {
    try {
      const notice = {
        id: uuidv4(),
        purpose,
        dataTypes,
        legalBasis,
        createdDate: new Date(),
        content: this.generateNoticeContent(purpose, dataTypes, legalBasis),
        language: 'en',
        version: '1.0'
      };

      return notice;
    } catch (error) {
      logger.error('Failed to create privacy notice', { error: error.message, purpose });
      throw error;
    }
  }

  /**
   * Update user privacy preferences
   */
  async updatePrivacyPreferences(userId, preferences) {
    try {
      const existingPreferences = this.privacySettings.get(userId) || {};
      
      const updatedPreferences = {
        ...existingPreferences,
        ...preferences,
        lastUpdated: new Date(),
        updatedBy: userId
      };

      this.privacySettings.set(userId, updatedPreferences);

      // If marketing consent changed, update consent records
      if (preferences.marketingEmails !== undefined) {
        await this.recordConsent(userId, {
          consents: { marketing_emails: preferences.marketingEmails },
          method: 'preference_update'
        });
      }

      logger.info('Privacy preferences updated', { userId, preferences: Object.keys(preferences) });
      return updatedPreferences;
    } catch (error) {
      logger.error('Failed to update privacy preferences', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Helper methods
   */
  
  calculateNextAuditDate(frequency) {
    const date = new Date();
    switch (frequency) {
      case 'quarterly':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'biannual':
        date.setMonth(date.getMonth() + 6);
        break;
      case 'annual':
      default:
        date.setFullYear(date.getFullYear() + 1);
        break;
    }
    return date;
  }

  assessRiskLikelihood(projectData) {
    // Simplified risk assessment logic
    let score = 1;
    if (projectData.automaticProcessing) score += 1;
    if (projectData.largScale) score += 1;
    if (projectData.vulnerableSubjects) score += 1;
    if (projectData.newTechnology) score += 1;
    
    return score <= 2 ? 'low' : score <= 3 ? 'medium' : 'high';
  }

  assessRiskSeverity(projectData) {
    // Simplified severity assessment
    let score = 1;
    if (projectData.specialCategories) score += 2;
    if (projectData.crossBorderTransfers) score += 1;
    if (projectData.profiling) score += 1;
    if (projectData.publicAccess) score += 1;
    
    return score <= 2 ? 'low' : score <= 4 ? 'medium' : 'high';
  }

  calculateOverallRisk(likelihood, severity) {
    const riskMatrix = {
      'low-low': 'low',
      'low-medium': 'low',
      'low-high': 'medium',
      'medium-low': 'low',
      'medium-medium': 'medium',
      'medium-high': 'high',
      'high-low': 'medium',
      'high-medium': 'high',
      'high-high': 'high'
    };
    
    return riskMatrix[`${likelihood}-${severity}`] || 'medium';
  }

  requiresApproval(projectData) {
    return projectData.highRisk || 
           projectData.specialCategories || 
           projectData.largScale ||
           projectData.newTechnology;
  }

  generatePIARecommendations(projectData) {
    const recommendations = [];
    
    if (projectData.specialCategories) {
      recommendations.push('Implement additional security measures for special category data');
    }
    if (projectData.crossBorderTransfers) {
      recommendations.push('Ensure adequate safeguards for international transfers');
    }
    if (!projectData.encryptionAtRest) {
      recommendations.push('Implement encryption at rest for all personal data');
    }
    if (!projectData.encryptionInTransit) {
      recommendations.push('Implement encryption in transit for all data transfers');
    }
    
    return recommendations;
  }

  generateNoticeContent(purpose, dataTypes, legalBasis) {
    return {
      overview: `We process your personal data for ${purpose}.`,
      dataTypes: `The following types of data are processed: ${dataTypes.join(', ')}.`,
      legalBasis: `The legal basis for this processing is: ${legalBasis}.`,
      retention: 'Data will be retained for the minimum period necessary.',
      rights: 'You have the right to access, rectify, erase, restrict processing, data portability, and object to processing.',
      contact: 'For questions about this processing, contact privacy@hotel.com'
    };
  }

  /**
   * Get privacy compliance dashboard data
   */
  getComplianceDashboard() {
    return {
      consentRecords: this.consentRecords.size,
      privacyPolicies: this.privacyPolicies.size,
      processingAgreements: this.dataProcessingAgreements.size,
      retentionRules: Object.keys(this.retentionRules).length,
      lastComplianceCheck: new Date().toISOString(),
      systemSettings: this.privacySettings.get('system')
    };
  }
}

// Create singleton instance
const dataPrivacyService = new DataPrivacyService();

export default dataPrivacyService;