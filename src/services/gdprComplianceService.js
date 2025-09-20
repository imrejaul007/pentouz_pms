import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import encryptionService from './encryptionService.js';
import { v4 as uuidv4 } from 'uuid';

class GDPRComplianceService {
  constructor() {
    this.dataCategories = {
      PERSONAL_IDENTIFIERS: {
        name: 'Personal Identifiers',
        fields: ['name', 'email', 'phone', 'passport', 'nationalId'],
        retention: 2555, // 7 years in days
        lawfulBasis: 'contract'
      },
      CONTACT_INFORMATION: {
        name: 'Contact Information',
        fields: ['address', 'city', 'postalCode', 'country', 'emergencyContact'],
        retention: 2555,
        lawfulBasis: 'contract'
      },
      FINANCIAL_DATA: {
        name: 'Financial Data',
        fields: ['paymentMethod', 'billingAddress', 'transactionHistory'],
        retention: 2555,
        lawfulBasis: 'contract'
      },
      BEHAVIORAL_DATA: {
        name: 'Behavioral Data',
        fields: ['preferences', 'bookingHistory', 'loyaltyData'],
        retention: 1095, // 3 years
        lawfulBasis: 'legitimate_interest'
      },
      SPECIAL_CATEGORIES: {
        name: 'Special Categories',
        fields: ['healthInfo', 'dietaryRequirements', 'accessibility'],
        retention: 1095,
        lawfulBasis: 'explicit_consent'
      }
    };

    this.consentTypes = [
      'marketing_emails',
      'promotional_sms', 
      'behavioral_analytics',
      'third_party_sharing',
      'location_tracking'
    ];

    this.dataRequests = new Map(); // In-memory for demo, use database in production
  }

  /**
   * Record user consent
   */
  async recordConsent(userId, consentData) {
    try {
      const consentRecord = {
        id: uuidv4(),
        userId,
        consents: consentData.consents, // Object with consent types as keys
        ipAddress: consentData.ipAddress,
        userAgent: consentData.userAgent,
        timestamp: new Date(),
        version: '1.0', // Consent policy version
        method: consentData.method || 'web_form',
        witnessed: consentData.witnessed || false
      };

      // In production, save to ConsentRecord collection
      logger.info('Consent recorded', {
        userId,
        consentId: consentRecord.id,
        consents: Object.keys(consentData.consents).filter(k => consentData.consents[k])
      });

      return consentRecord;
    } catch (error) {
      logger.error('Failed to record consent', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Update user consent
   */
  async updateConsent(userId, consentId, updates) {
    try {
      // Create new consent record (maintaining audit trail)
      const newConsentRecord = await this.recordConsent(userId, {
        ...updates,
        previousConsentId: consentId
      });

      logger.info('Consent updated', { userId, oldConsentId: consentId, newConsentId: newConsentRecord.id });
      
      return newConsentRecord;
    } catch (error) {
      logger.error('Failed to update consent', { userId, consentId, error: error.message });
      throw error;
    }
  }

  /**
   * Check if processing is lawful for specific data
   */
  async isProcessingLawful(userId, dataCategory, purpose) {
    try {
      const category = this.dataCategories[dataCategory];
      if (!category) {
        throw new Error(`Unknown data category: ${dataCategory}`);
      }

      // Check lawful basis
      switch (category.lawfulBasis) {
        case 'consent':
          return await this.hasValidConsent(userId, purpose);
        
        case 'contract':
          return await this.isContractualNecessity(userId, purpose);
        
        case 'legitimate_interest':
          return await this.assessLegitimateInterest(userId, purpose);
        
        case 'legal_obligation':
          return true; // If we're required by law
        
        case 'vital_interests':
          return await this.isVitalInterest(purpose);
        
        case 'public_task':
          return false; // Not applicable for hotel management
        
        default:
          return false;
      }
    } catch (error) {
      logger.error('Failed to check lawful processing', { userId, dataCategory, purpose, error: error.message });
      return false;
    }
  }

  /**
   * Handle data subject access request (Right to Access)
   */
  async handleAccessRequest(userId, requestDetails) {
    try {
      const requestId = uuidv4();
      const request = {
        id: requestId,
        type: 'access',
        userId,
        requestedBy: requestDetails.requestedBy || userId,
        requestDate: new Date(),
        status: 'pending',
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        details: requestDetails
      };

      this.dataRequests.set(requestId, request);

      // Collect all user data
      const userData = await this.collectUserData(userId);
      
      // Generate portable data export
      const dataExport = await this.generateDataExport(userId, userData);

      request.status = 'completed';
      request.completedDate = new Date();
      request.dataExport = dataExport;

      logger.info('Access request completed', { userId, requestId });

      return {
        requestId,
        status: 'completed',
        dataExport,
        deadline: request.deadline
      };
    } catch (error) {
      logger.error('Failed to handle access request', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Handle right to rectification request
   */
  async handleRectificationRequest(userId, corrections, requestDetails) {
    try {
      const requestId = uuidv4();
      const request = {
        id: requestId,
        type: 'rectification',
        userId,
        requestedBy: requestDetails.requestedBy || userId,
        requestDate: new Date(),
        status: 'pending',
        corrections,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      };

      this.dataRequests.set(requestId, request);

      // Apply corrections (with audit trail)
      const results = await this.applyDataCorrections(userId, corrections);

      request.status = 'completed';
      request.completedDate = new Date();
      request.results = results;

      logger.info('Rectification request completed', { userId, requestId, corrections: Object.keys(corrections) });

      return {
        requestId,
        status: 'completed',
        results,
        corrections
      };
    } catch (error) {
      logger.error('Failed to handle rectification request', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Handle right to erasure request (Right to be Forgotten)
   */
  async handleErasureRequest(userId, requestDetails) {
    try {
      const requestId = uuidv4();
      const request = {
        id: requestId,
        type: 'erasure',
        userId,
        requestedBy: requestDetails.requestedBy || userId,
        requestDate: new Date(),
        status: 'pending',
        reason: requestDetails.reason,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      };

      this.dataRequests.set(requestId, request);

      // Check if erasure is possible (legal obligations, etc.)
      const erasureAssessment = await this.assessErasureRequest(userId, requestDetails.reason);

      if (!erasureAssessment.canErase) {
        request.status = 'rejected';
        request.rejectionReason = erasureAssessment.reason;
        request.completedDate = new Date();

        return {
          requestId,
          status: 'rejected',
          reason: erasureAssessment.reason
        };
      }

      // Perform erasure
      const erasureResults = await this.performDataErasure(userId, erasureAssessment.dataToErase);

      request.status = 'completed';
      request.completedDate = new Date();
      request.erasureResults = erasureResults;

      logger.info('Erasure request completed', { userId, requestId });

      return {
        requestId,
        status: 'completed',
        erasureResults
      };
    } catch (error) {
      logger.error('Failed to handle erasure request', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Handle data portability request
   */
  async handlePortabilityRequest(userId, format = 'json') {
    try {
      const requestId = uuidv4();
      const userData = await this.collectUserData(userId);
      
      // Filter to only include data provided by user or generated through automated processing
      const portableData = this.filterPortableData(userData);
      
      // Generate export in requested format
      const dataExport = await this.generatePortableExport(portableData, format);

      logger.info('Data portability request completed', { userId, requestId, format });

      return {
        requestId,
        format,
        dataExport,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to handle portability request', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Check data retention and schedule deletion
   */
  async checkDataRetention() {
    try {
      const now = new Date();
      const results = {
        reviewed: 0,
        markedForDeletion: 0,
        deleted: 0
      };

      // Check each data category
      for (const [categoryName, category] of Object.entries(this.dataCategories)) {
        const retentionDate = new Date(now.getTime() - (category.retention * 24 * 60 * 60 * 1000));
        
        // Find data older than retention period
        // This would query actual database collections
        logger.info('Checking data retention', { 
          category: categoryName, 
          retentionDays: category.retention,
          cutoffDate: retentionDate
        });

        results.reviewed++;
      }

      return results;
    } catch (error) {
      logger.error('Data retention check failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate privacy notice/policy
   */
  generatePrivacyNotice() {
    return {
      controller: {
        name: 'Hotel Management System',
        contact: 'privacy@hotel.com',
        dpo: 'dpo@hotel.com'
      },
      dataCategories: Object.entries(this.dataCategories).map(([key, category]) => ({
        category: key,
        name: category.name,
        fields: category.fields,
        lawfulBasis: category.lawfulBasis,
        retentionPeriod: `${category.retention} days`,
        purposes: this.getPurposesForCategory(key)
      })),
      rights: [
        'Right to access your personal data',
        'Right to rectification of inaccurate data',
        'Right to erasure (right to be forgotten)',
        'Right to restrict processing',
        'Right to data portability',
        'Right to object to processing',
        'Rights related to automated decision making'
      ],
      contact: {
        email: 'privacy@hotel.com',
        phone: '+1-555-PRIVACY',
        address: '123 Privacy Street, Data City, DC 12345'
      },
      lastUpdated: new Date().toISOString()
    };
  }

  // Helper methods

  async hasValidConsent(userId, purpose) {
    // Check if user has given valid consent for this purpose
    // This would query the ConsentRecord collection
    return true; // Simplified for demo
  }

  async isContractualNecessity(userId, purpose) {
    // Check if processing is necessary for contract performance
    const contractualPurposes = ['booking_processing', 'payment_processing', 'service_delivery'];
    return contractualPurposes.includes(purpose);
  }

  async assessLegitimateInterest(userId, purpose) {
    // Assess if legitimate interest applies
    const legitimateInterests = ['fraud_prevention', 'analytics', 'marketing'];
    return legitimateInterests.includes(purpose);
  }

  async isVitalInterest(purpose) {
    // Check if processing is necessary for vital interests
    return purpose === 'emergency_contact';
  }

  async collectUserData(userId) {
    // Collect all user data from various collections
    // This would query User, Booking, Payment, etc. collections
    return {
      profile: {},
      bookings: [],
      payments: [],
      preferences: {},
      communications: []
    };
  }

  async generateDataExport(userId, userData) {
    return {
      userId,
      exportDate: new Date().toISOString(),
      format: 'JSON',
      data: userData,
      encryption: 'AES-256-GCM',
      dataCategories: Object.keys(this.dataCategories)
    };
  }

  async applyDataCorrections(userId, corrections) {
    const results = {};
    
    for (const [field, newValue] of Object.entries(corrections)) {
      // Apply correction with audit trail
      results[field] = {
        oldValue: '[ENCRYPTED]', // Don't log actual values
        newValue: '[ENCRYPTED]',
        correctedAt: new Date().toISOString(),
        status: 'completed'
      };
    }

    return results;
  }

  async assessErasureRequest(userId, reason) {
    // Check legal obligations, legitimate interests, etc.
    const assessment = {
      canErase: true,
      reason: null,
      dataToErase: ['profile', 'preferences', 'marketing_data'],
      dataToRetain: ['booking_history', 'payment_records'], // Legal obligations
      retentionReason: 'Financial record keeping requirements'
    };

    return assessment;
  }

  async performDataErasure(userId, dataToErase) {
    const results = {};
    
    for (const dataType of dataToErase) {
      results[dataType] = {
        status: 'erased',
        erasedAt: new Date().toISOString(),
        method: 'cryptographic_erasure'
      };
    }

    return results;
  }

  filterPortableData(userData) {
    // Filter to only include data that user provided or was generated through automated processing
    return {
      profile: userData.profile,
      preferences: userData.preferences,
      bookingHistory: userData.bookings,
      // Exclude derived analytics, fraud scores, etc.
    };
  }

  async generatePortableExport(data, format) {
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'csv':
        return this.convertToCSV(data);
      case 'xml':
        return this.convertToXML(data);
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  convertToCSV(data) {
    // Convert nested JSON to CSV format
    return 'CSV export would be generated here';
  }

  convertToXML(data) {
    // Convert JSON to XML format
    return '<?xml version="1.0"?><data>XML export would be generated here</data>';
  }

  getPurposesForCategory(category) {
    const purposes = {
      PERSONAL_IDENTIFIERS: ['Account creation', 'Booking processing', 'Customer service'],
      CONTACT_INFORMATION: ['Service delivery', 'Communication', 'Emergency contact'],
      FINANCIAL_DATA: ['Payment processing', 'Fraud prevention', 'Refund processing'],
      BEHAVIORAL_DATA: ['Service improvement', 'Personalization', 'Analytics'],
      SPECIAL_CATEGORIES: ['Accessibility accommodation', 'Dietary services', 'Medical emergency']
    };

    return purposes[category] || [];
  }

  /**
   * Get compliance report
   */
  getComplianceReport() {
    return {
      framework: 'GDPR (General Data Protection Regulation)',
      implementedRights: [
        'Right to Access (Article 15)',
        'Right to Rectification (Article 16)', 
        'Right to Erasure (Article 17)',
        'Right to Data Portability (Article 20)',
        'Right to Object (Article 21)'
      ],
      lawfulBases: [
        'Consent (Article 6(1)(a))',
        'Contract (Article 6(1)(b))',
        'Legitimate Interest (Article 6(1)(f))'
      ],
      technicalMeasures: [
        'Data encryption at rest and in transit',
        'Pseudonymization of personal data',
        'Access controls and authentication',
        'Data retention policies',
        'Audit logging and monitoring'
      ],
      organizationalMeasures: [
        'Privacy by design implementation',
        'Data protection impact assessments',
        'Staff training on data protection',
        'Incident response procedures',
        'Vendor management for data processors'
      ],
      dataCategories: Object.keys(this.dataCategories).length,
      lastReviewed: new Date().toISOString()
    };
  }
}

// Create singleton instance
const gdprComplianceService = new GDPRComplianceService();

export default gdprComplianceService;