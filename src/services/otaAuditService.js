import OTAPayload from '../models/OTAPayload.js';
import AuditLog from '../models/AuditLog.js';
import Booking from '../models/Booking.js';
import logger from '../utils/logger.js';
import { compressJSON, decompressJSON } from '../utils/compression.js';

class OTAAuditService {
  constructor() {
    this.validationRules = new Map();
    this.reconciliationQueue = [];
    this.alertThresholds = {
      failureRate: 10, // percentage
      responseTime: 5000, // milliseconds
      payloadSize: 10 * 1024 * 1024 // 10MB
    };
    
    this.initializeValidationRules();
  }

  /**
   * Initialize payload validation rules
   */
  initializeValidationRules() {
    // Booking validation rules
    this.addValidationRule('booking_create', {
      requiredFields: ['booking_id', 'guest_name', 'check_in', 'check_out'],
      fieldTypes: {
        booking_id: 'string',
        check_in: 'date',
        check_out: 'date',
        total_amount: 'number'
      },
      businessRules: [
        (payload) => {
          const checkIn = new Date(payload.check_in);
          const checkOut = new Date(payload.check_out);
          return checkOut > checkIn ? null : 'Check-out must be after check-in';
        },
        (payload) => {
          const checkIn = new Date(payload.check_in);
          const today = new Date();
          return checkIn >= today ? null : 'Check-in date cannot be in the past';
        }
      ]
    });

    // Amendment validation rules
    this.addValidationRule('amendment_request', {
      requiredFields: ['booking_id', 'amendment_type', 'requested_changes'],
      fieldTypes: {
        booking_id: 'string',
        amendment_type: 'string'
      },
      businessRules: [
        (payload) => {
          const validTypes = ['dates_change', 'guest_change', 'room_change', 'cancellation'];
          return validTypes.includes(payload.amendment_type) ? null : 'Invalid amendment type';
        }
      ]
    });

    // Webhook validation rules
    this.addValidationRule('webhook_notification', {
      requiredFields: ['event_type', 'timestamp'],
      fieldTypes: {
        timestamp: 'date'
      },
      securityRules: [
        (payload, headers) => {
          // Check for required signature header
          return headers['x-signature'] ? null : 'Missing signature header';
        }
      ]
    });
  }

  /**
   * Add a validation rule for an operation type
   */
  addValidationRule(operationType, rule) {
    this.validationRules.set(operationType, {
      ...rule,
      addedAt: new Date()
    });
  }

  /**
   * Validate OTA payload against business rules
   */
  async validatePayload(payload, operationType, headers = {}) {
    const rule = this.validationRules.get(operationType);
    if (!rule) {
      return { valid: true, warnings: ['No validation rule defined'] };
    }

    const errors = [];
    const warnings = [];

    try {
      // Check required fields
      if (rule.requiredFields) {
        for (const field of rule.requiredFields) {
          if (!this.hasNestedProperty(payload, field)) {
            errors.push(`Missing required field: ${field}`);
          }
        }
      }

      // Check field types
      if (rule.fieldTypes) {
        for (const [field, expectedType] of Object.entries(rule.fieldTypes)) {
          const value = this.getNestedValue(payload, field);
          if (value !== undefined && !this.isValidType(value, expectedType)) {
            errors.push(`Invalid type for field ${field}: expected ${expectedType}`);
          }
        }
      }

      // Apply business rules
      if (rule.businessRules) {
        for (const businessRule of rule.businessRules) {
          try {
            const result = businessRule(payload);
            if (result) {
              errors.push(result);
            }
          } catch (error) {
            warnings.push(`Business rule validation failed: ${error.message}`);
          }
        }
      }

      // Apply security rules
      if (rule.securityRules) {
        for (const securityRule of rule.securityRules) {
          try {
            const result = securityRule(payload, headers);
            if (result) {
              errors.push(result);
            }
          } catch (error) {
            warnings.push(`Security rule validation failed: ${error.message}`);
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        validatedAt: new Date()
      };

    } catch (error) {
      logger.error('Payload validation failed:', error);
      return {
        valid: false,
        errors: [`Validation system error: ${error.message}`],
        warnings,
        validatedAt: new Date()
      };
    }
  }

  /**
   * Perform comprehensive audit of OTA payload
   */
  async auditPayload(payloadId) {
    try {
      const payload = await OTAPayload.findOne({ payloadId }).populate('auditLogId');
      if (!payload) {
        throw new Error(`Payload ${payloadId} not found`);
      }

      const auditResult = {
        payloadId,
        auditTimestamp: new Date(),
        checks: {}
      };

      // 1. Validate payload structure and business rules
      const decompressedPayload = await payload.getDecompressedPayload();
      if (decompressedPayload) {
        const validation = await this.validatePayload(
          decompressedPayload,
          payload.businessContext.operation,
          Object.fromEntries(payload.headers)
        );
        auditResult.checks.validation = validation;
      }

      // 2. Check data integrity
      auditResult.checks.integrity = this.checkDataIntegrity(payload);

      // 3. Verify security aspects
      auditResult.checks.security = this.checkSecurityCompliance(payload);

      // 4. Performance analysis
      auditResult.checks.performance = this.analyzePerformance(payload);

      // 5. Compliance check
      auditResult.checks.compliance = await this.checkComplianceRequirements(payload);

      // 6. Cross-reference with related records
      auditResult.checks.crossReference = await this.crossReferenceData(payload);

      // Calculate overall audit score
      auditResult.overallScore = this.calculateAuditScore(auditResult.checks);
      auditResult.riskLevel = this.assessRiskLevel(auditResult.checks);

      // Store audit result
      await this.storeAuditResult(payload, auditResult);

      return auditResult;

    } catch (error) {
      logger.error('Payload audit failed:', error);
      throw error;
    }
  }

  /**
   * Check data integrity
   */
  checkDataIntegrity(payload) {
    const checks = {
      compressionIntegrity: true,
      sizeConsistency: true,
      formatCompliance: true,
      issues: []
    };

    // Check compression integrity
    if (payload.rawPayload.compressed) {
      if (!payload.rawPayload.size || payload.rawPayload.size <= 0) {
        checks.compressionIntegrity = false;
        checks.issues.push('Invalid compressed payload size');
      }
    }

    // Check size consistency
    if (payload.metrics.payloadSize) {
      const expectedSize = payload.rawPayload.size || payload.rawPayload.data.length;
      if (Math.abs(payload.metrics.payloadSize - expectedSize) > 100) {
        checks.sizeConsistency = false;
        checks.issues.push('Payload size mismatch in metrics');
      }
    }

    // Check format compliance
    try {
      const contentType = payload.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        // Should be valid JSON
        JSON.parse(payload.rawPayload.data.toString());
      }
    } catch (error) {
      checks.formatCompliance = false;
      checks.issues.push('Invalid JSON format');
    }

    checks.passed = checks.compressionIntegrity && checks.sizeConsistency && checks.formatCompliance;
    return checks;
  }

  /**
   * Check security compliance
   */
  checkSecurityCompliance(payload) {
    const checks = {
      authentication: false,
      signatureVerified: false,
      dataClassified: true,
      piiHandled: true,
      issues: []
    };

    // Check authentication
    if (payload.security.authenticated !== undefined) {
      checks.authentication = payload.security.authenticated;
      if (!checks.authentication) {
        checks.issues.push('Request was not authenticated');
      }
    }

    // Check signature verification
    if (payload.security.signature) {
      checks.signatureVerified = payload.security.signatureValid === true;
      if (!checks.signatureVerified) {
        checks.issues.push('Invalid or unverified signature');
      }
    }

    // Check data classification
    if (!payload.classification.dataLevel) {
      checks.dataClassified = false;
      checks.issues.push('Data classification not set');
    }

    // Check PII handling
    if (payload.classification.containsPII && payload.classification.dataLevel !== 'confidential') {
      checks.piiHandled = false;
      checks.issues.push('PII data not properly classified');
    }

    checks.passed = checks.authentication && checks.signatureVerified && 
                   checks.dataClassified && checks.piiHandled;
    return checks;
  }

  /**
   * Analyze performance metrics
   */
  analyzePerformance(payload) {
    const analysis = {
      responseTimeAcceptable: true,
      payloadSizeReasonable: true,
      processingEfficient: true,
      issues: []
    };

    // Check response time for outbound requests
    if (payload.direction === 'outbound' && payload.response.responseTime) {
      if (payload.response.responseTime > this.alertThresholds.responseTime) {
        analysis.responseTimeAcceptable = false;
        analysis.issues.push(`Slow response time: ${payload.response.responseTime}ms`);
      }
    }

    // Check payload size
    if (payload.metrics.payloadSize > this.alertThresholds.payloadSize) {
      analysis.payloadSizeReasonable = false;
      analysis.issues.push(`Large payload size: ${payload.metrics.payloadSize} bytes`);
    }

    // Check processing efficiency
    if (payload.metrics.processingDuration > 10000) { // 10 seconds
      analysis.processingEfficient = false;
      analysis.issues.push(`Slow processing: ${payload.metrics.processingDuration}ms`);
    }

    analysis.passed = analysis.responseTimeAcceptable && 
                     analysis.payloadSizeReasonable && 
                     analysis.processingEfficient;
    return analysis;
  }

  /**
   * Check compliance requirements (GDPR, PCI, etc.)
   */
  async checkComplianceRequirements(payload) {
    const compliance = {
      gdprCompliant: true,
      dataRetentionCompliant: true,
      auditTrailComplete: true,
      issues: []
    };

    // GDPR compliance
    if (payload.classification.containsPII) {
      // Check if consent was recorded (this would be more complex in real implementation)
      if (!payload.metadata.tags?.includes('gdpr_consent')) {
        compliance.gdprCompliant = false;
        compliance.issues.push('GDPR consent not recorded for PII data');
      }
    }

    // Data retention compliance
    if (!payload.retention.deleteAfter) {
      compliance.dataRetentionCompliant = false;
      compliance.issues.push('No data retention policy set');
    } else {
      const now = new Date();
      if (payload.retention.deleteAfter < now) {
        compliance.issues.push('Data past retention period');
      }
    }

    // Audit trail completeness
    if (!payload.auditLogId) {
      compliance.auditTrailComplete = false;
      compliance.issues.push('No audit log entry linked');
    }

    compliance.passed = compliance.gdprCompliant && 
                       compliance.dataRetentionCompliant && 
                       compliance.auditTrailComplete;
    return compliance;
  }

  /**
   * Cross-reference payload with related booking data
   */
  async crossReferenceData(payload) {
    const crossRef = {
      bookingExists: false,
      dataConsistent: false,
      relationsValid: false,
      issues: []
    };

    try {
      // Check if related booking exists
      if (payload.relatedBookingId) {
        const booking = await Booking.findById(payload.relatedBookingId);
        crossRef.bookingExists = !!booking;

        if (booking) {
          // Check data consistency between payload and booking
          const decompressedPayload = await payload.getDecompressedPayload();
          if (decompressedPayload) {
            // Compare key fields
            const inconsistencies = [];
            
            if (payload.parsedPayload.guestName && booking.guestInfo.name) {
              if (payload.parsedPayload.guestName !== booking.guestInfo.name) {
                inconsistencies.push('Guest name mismatch');
              }
            }

            if (payload.parsedPayload.totalAmount && booking.totalAmount) {
              const diff = Math.abs(payload.parsedPayload.totalAmount - booking.totalAmount);
              if (diff > 0.01) { // Allow for small rounding differences
                inconsistencies.push('Total amount mismatch');
              }
            }

            crossRef.dataConsistent = inconsistencies.length === 0;
            crossRef.issues.push(...inconsistencies);
          }
        } else {
          crossRef.issues.push('Related booking not found');
        }
      }

      // Check parent payload relationship
      if (payload.parentPayloadId) {
        const parentPayload = await OTAPayload.findOne({ payloadId: payload.parentPayloadId });
        crossRef.relationsValid = !!parentPayload;
        
        if (!parentPayload) {
          crossRef.issues.push('Parent payload not found');
        }
      } else {
        crossRef.relationsValid = true; // No parent required
      }

      crossRef.passed = (!payload.relatedBookingId || crossRef.bookingExists) &&
                       crossRef.dataConsistent && crossRef.relationsValid;

    } catch (error) {
      crossRef.issues.push(`Cross-reference check failed: ${error.message}`);
      crossRef.passed = false;
    }

    return crossRef;
  }

  /**
   * Calculate overall audit score (0-100)
   */
  calculateAuditScore(checks) {
    const weights = {
      validation: 25,
      integrity: 20,
      security: 25,
      performance: 10,
      compliance: 15,
      crossReference: 5
    };

    let totalScore = 0;
    let totalWeight = 0;

    for (const [checkType, check] of Object.entries(checks)) {
      if (weights[checkType]) {
        const score = check.passed ? 100 : 0;
        totalScore += score * weights[checkType];
        totalWeight += weights[checkType];
      }
    }

    return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
  }

  /**
   * Assess risk level based on audit results
   */
  assessRiskLevel(checks) {
    const criticalIssues = [];
    
    if (!checks.security?.passed) criticalIssues.push('security');
    if (!checks.compliance?.passed) criticalIssues.push('compliance');
    if (!checks.validation?.passed) criticalIssues.push('validation');

    if (criticalIssues.length >= 2) return 'high';
    if (criticalIssues.length === 1) return 'medium';
    if (!checks.integrity?.passed || !checks.performance?.passed) return 'low';
    
    return 'minimal';
  }

  /**
   * Store audit result in database
   */
  async storeAuditResult(payload, auditResult) {
    try {
      // Store in audit log
      await AuditLog.logChange({
        hotelId: payload.parsedPayload.hotelId,
        tableName: 'OTAPayload',
        recordId: payload._id,
        changeType: 'audit',
        source: 'system',
        sourceDetails: {
          auditService: 'OTAAuditService',
          version: '1.0.0'
        },
        newValues: {
          auditScore: auditResult.overallScore,
          riskLevel: auditResult.riskLevel,
          checksPerformed: Object.keys(auditResult.checks).length
        },
        metadata: {
          correlationId: payload.correlationId,
          priority: auditResult.riskLevel === 'high' ? 'critical' : 'medium',
          tags: ['payload_audit', `risk_${auditResult.riskLevel}`]
        }
      });

      // Update payload with audit metadata
      payload.metadata = payload.metadata || {};
      payload.metadata.lastAudit = {
        timestamp: auditResult.auditTimestamp,
        score: auditResult.overallScore,
        riskLevel: auditResult.riskLevel
      };
      
      await payload.save();

    } catch (error) {
      logger.error('Failed to store audit result:', error);
    }
  }

  /**
   * Generate compliance report for a date range
   */
  async generateComplianceReport(startDate, endDate, filters = {}) {
    try {
      const matchStage = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };

      if (filters.channel) matchStage.channel = filters.channel;
      if (filters.direction) matchStage.direction = filters.direction;

      const report = await OTAPayload.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalPayloads: { $sum: 1 },
            byChannel: {
              $push: {
                channel: '$channel',
                direction: '$direction',
                classification: '$classification.dataLevel',
                containsPII: '$classification.containsPII'
              }
            },
            averageAuditScore: {
              $avg: '$metadata.lastAudit.score'
            },
            riskDistribution: {
              $push: '$metadata.lastAudit.riskLevel'
            }
          }
        }
      ]);

      const complianceData = report[0] || {
        totalPayloads: 0,
        byChannel: [],
        averageAuditScore: 0,
        riskDistribution: []
      };

      // Calculate risk distribution
      const riskCounts = {
        minimal: 0,
        low: 0,
        medium: 0,
        high: 0
      };

      complianceData.riskDistribution.forEach(risk => {
        if (risk && riskCounts.hasOwnProperty(risk)) {
          riskCounts[risk]++;
        }
      });

      complianceData.riskDistribution = riskCounts;

      // Calculate channel statistics
      const channelStats = {};
      complianceData.byChannel.forEach(item => {
        const key = `${item.channel}_${item.direction}`;
        if (!channelStats[key]) {
          channelStats[key] = {
            channel: item.channel,
            direction: item.direction,
            count: 0,
            piiCount: 0,
            classificationCounts: {}
          };
        }
        channelStats[key].count++;
        if (item.containsPII) channelStats[key].piiCount++;
        if (item.classification) {
          channelStats[key].classificationCounts[item.classification] = 
            (channelStats[key].classificationCounts[item.classification] || 0) + 1;
        }
      });

      complianceData.channelStatistics = Object.values(channelStats);

      return {
        reportGenerated: new Date(),
        period: { startDate, endDate },
        filters,
        complianceData
      };

    } catch (error) {
      logger.error('Failed to generate compliance report:', error);
      throw error;
    }
  }

  /**
   * Reconcile OTA data with internal records
   */
  async reconcileOTAData(bookingId, options = {}) {
    try {
      const payloads = await OTAPayload.find({ relatedBookingId: bookingId })
        .sort({ createdAt: 1 });

      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new Error(`Booking ${bookingId} not found`);
      }

      const reconciliation = {
        bookingId,
        reconciledAt: new Date(),
        payloadsFound: payloads.length,
        discrepancies: [],
        consistencyScore: 0
      };

      // Check each payload for consistency
      for (const payload of payloads) {
        const payloadData = await payload.getDecompressedPayload();
        if (payloadData) {
          const discrepancies = this.findDataDiscrepancies(booking, payloadData, payload);
          reconciliation.discrepancies.push(...discrepancies);
        }
      }

      // Calculate consistency score
      const totalChecks = payloads.length * 5; // Assume 5 checks per payload
      const discrepancyCount = reconciliation.discrepancies.length;
      reconciliation.consistencyScore = totalChecks > 0 ? 
        Math.max(0, Math.round(((totalChecks - discrepancyCount) / totalChecks) * 100)) : 100;

      // Store reconciliation result
      await this.storeReconciliationResult(reconciliation);

      return reconciliation;

    } catch (error) {
      logger.error('OTA data reconciliation failed:', error);
      throw error;
    }
  }

  /**
   * Find discrepancies between booking data and payload data
   */
  findDataDiscrepancies(booking, payloadData, payload) {
    const discrepancies = [];

    // Check guest name
    if (payloadData.guest_name && booking.guestInfo?.name) {
      if (payloadData.guest_name.trim() !== booking.guestInfo.name.trim()) {
        discrepancies.push({
          field: 'guest_name',
          bookingValue: booking.guestInfo.name,
          payloadValue: payloadData.guest_name,
          payloadId: payload.payloadId,
          severity: 'medium'
        });
      }
    }

    // Check total amount
    if (payloadData.total_amount && booking.totalAmount) {
      const diff = Math.abs(payloadData.total_amount - booking.totalAmount);
      if (diff > 0.01) {
        discrepancies.push({
          field: 'total_amount',
          bookingValue: booking.totalAmount,
          payloadValue: payloadData.total_amount,
          difference: diff,
          payloadId: payload.payloadId,
          severity: diff > 10 ? 'high' : 'medium'
        });
      }
    }

    // Check dates
    if (payloadData.check_in && booking.checkIn) {
      const payloadDate = new Date(payloadData.check_in);
      const bookingDate = new Date(booking.checkIn);
      if (payloadDate.getTime() !== bookingDate.getTime()) {
        discrepancies.push({
          field: 'check_in',
          bookingValue: booking.checkIn,
          payloadValue: payloadData.check_in,
          payloadId: payload.payloadId,
          severity: 'high'
        });
      }
    }

    return discrepancies;
  }

  /**
   * Store reconciliation result
   */
  async storeReconciliationResult(reconciliation) {
    try {
      await AuditLog.logChange({
        tableName: 'Booking',
        recordId: reconciliation.bookingId,
        changeType: 'reconciliation',
        source: 'system',
        newValues: {
          consistencyScore: reconciliation.consistencyScore,
          discrepanciesFound: reconciliation.discrepancies.length,
          payloadsChecked: reconciliation.payloadsFound
        },
        metadata: {
          priority: reconciliation.consistencyScore < 80 ? 'high' : 'medium',
          tags: ['ota_reconciliation', `score_${Math.floor(reconciliation.consistencyScore / 10) * 10}`]
        }
      });
    } catch (error) {
      logger.error('Failed to store reconciliation result:', error);
    }
  }

  /**
   * Helper methods
   */
  hasNestedProperty(obj, path) {
    return path.split('.').reduce((current, key) => current && current.hasOwnProperty(key), obj) !== false;
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  }

  isValidType(value, expectedType) {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'date':
        return !isNaN(new Date(value).getTime());
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }
}

export default new OTAAuditService();