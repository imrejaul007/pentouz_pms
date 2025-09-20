import mongoose from 'mongoose';
import OTAPayload from '../models/OTAPayload.js';
import AuditLog from '../models/AuditLog.js';
import logger from '../utils/logger.js';
import { compress } from '../utils/compression.js';
import fs from 'fs/promises';
import path from 'path';
import archiver from 'archiver';
import cron from 'node-cron';

class PayloadRetentionService {
  constructor() {
    this.retentionPolicies = new Map();
    this.archiveConfig = {
      enabled: process.env.ENABLE_PAYLOAD_ARCHIVING === 'true',
      location: process.env.ARCHIVE_LOCATION || './archives',
      compressionLevel: parseInt(process.env.ARCHIVE_COMPRESSION_LEVEL) || 6,
      maxArchiveSize: parseInt(process.env.MAX_ARCHIVE_SIZE) || 100 * 1024 * 1024 // 100MB
    };
    this.cleanupStats = {
      lastRun: null,
      payloadsProcessed: 0,
      payloadsArchived: 0,
      payloadsDeleted: 0,
      spaceReclaimed: 0
    };
    
    this.initializeRetentionPolicies();
  }

  /**
   * Check database connectivity
   */
  isDbConnected() {
    return mongoose.connection.readyState === 1;
  }

  /**
   * Initialize default retention policies
   */
  initializeRetentionPolicies() {
    // Default retention periods in days
    this.setRetentionPolicy('booking_create', {
      retentionDays: 2555, // ~7 years for compliance
      archiveAfterDays: 365, // Archive after 1 year
      compressionLevel: 9,
      requiresCompliance: true
    });

    this.setRetentionPolicy('booking_update', {
      retentionDays: 1825, // 5 years
      archiveAfterDays: 365,
      compressionLevel: 6,
      requiresCompliance: true
    });

    this.setRetentionPolicy('booking_cancel', {
      retentionDays: 2555, // 7 years
      archiveAfterDays: 180, // Archive after 6 months
      compressionLevel: 9,
      requiresCompliance: true
    });

    this.setRetentionPolicy('amendment_request', {
      retentionDays: 1825, // 5 years
      archiveAfterDays: 365,
      compressionLevel: 6,
      requiresCompliance: true
    });

    this.setRetentionPolicy('webhook_notification', {
      retentionDays: 365, // 1 year
      archiveAfterDays: 90, // Archive after 3 months
      compressionLevel: 3,
      requiresCompliance: false
    });

    this.setRetentionPolicy('inventory_sync', {
      retentionDays: 90, // 3 months
      archiveAfterDays: 30, // Archive after 1 month
      compressionLevel: 3,
      requiresCompliance: false
    });

    this.setRetentionPolicy('rate_update', {
      retentionDays: 365, // 1 year
      archiveAfterDays: 90,
      compressionLevel: 3,
      requiresCompliance: false
    });

    // Default policy for unknown operations
    this.setRetentionPolicy('default', {
      retentionDays: 365,
      archiveAfterDays: 90,
      compressionLevel: 6,
      requiresCompliance: false
    });
  }

  /**
   * Set retention policy for an operation type
   */
  setRetentionPolicy(operationType, policy) {
    this.retentionPolicies.set(operationType, {
      ...policy,
      updatedAt: new Date()
    });
    logger.info(`Retention policy updated for ${operationType}`, policy);
  }

  /**
   * Get retention policy for an operation type
   */
  getRetentionPolicy(operationType) {
    return this.retentionPolicies.get(operationType) || 
           this.retentionPolicies.get('default');
  }

  /**
   * Start automated retention management
   */
  start() {
    // Run cleanup daily at 2 AM
    cron.schedule('0 2 * * *', async () => {
      try {
        await this.runDailyCleanup();
      } catch (error) {
        logger.error('Daily cleanup failed:', error);
      }
    });

    // Run archival weekly on Sunday at 3 AM
    cron.schedule('0 3 * * 0', async () => {
      try {
        await this.runWeeklyArchival();
      } catch (error) {
        logger.error('Weekly archival failed:', error);
      }
    });

    // Run compliance check monthly on 1st at 4 AM
    cron.schedule('0 4 1 * *', async () => {
      try {
        await this.runComplianceCheck();
      } catch (error) {
        logger.error('Monthly compliance check failed:', error);
      }
    });

    logger.info('Payload retention service started with automated scheduling');
  }

  /**
   * Run daily cleanup process
   */
  async runDailyCleanup() {
    // Skip if database is not connected
    if (!this.isDbConnected()) {
      logger.debug('Database not connected, skipping daily cleanup');
      return;
    }

    const startTime = Date.now();
    logger.info('Starting daily payload cleanup');

    const stats = {
      processed: 0,
      archived: 0,
      deleted: 0,
      spaceReclaimed: 0,
      errors: []
    };

    try {
      // Find payloads ready for archival or deletion
      const cutoffDate = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)); // 30 days ago
      
      const payloads = await OTAPayload.find({
        $or: [
          { 'retention.deleteAfter': { $lt: new Date() } },
          { 
            createdAt: { $lt: cutoffDate },
            'retention.archived': false
          }
        ]
      })
      .limit(1000) // Process in batches
      .sort({ createdAt: 1 });

      for (const payload of payloads) {
        try {
          const policy = this.getRetentionPolicy(payload.businessContext.operation);
          const result = await this.processPayloadRetention(payload, policy);
          
          stats.processed++;
          if (result.action === 'archived') {
            stats.archived++;
          } else if (result.action === 'deleted') {
            stats.deleted++;
          }
          stats.spaceReclaimed += result.spaceReclaimed || 0;

        } catch (error) {
          stats.errors.push({
            payloadId: payload.payloadId,
            error: error.message
          });
        }
      }

      // Update cleanup stats
      this.cleanupStats = {
        lastRun: new Date(),
        payloadsProcessed: stats.processed,
        payloadsArchived: stats.archived,
        payloadsDeleted: stats.deleted,
        spaceReclaimed: stats.spaceReclaimed
      };

      const duration = Date.now() - startTime;
      logger.info(`Daily cleanup completed in ${duration}ms`, stats);

    } catch (error) {
      logger.error('Daily cleanup process failed:', error);
      throw error;
    }
  }

  /**
   * Process individual payload for retention
   */
  async processPayloadRetention(payload, policy) {
    const now = new Date();
    const createdAt = new Date(payload.createdAt);
    const ageInDays = (now - createdAt) / (1000 * 60 * 60 * 24);

    // Check if payload should be deleted
    if (payload.retention.deleteAfter && now > payload.retention.deleteAfter) {
      return await this.deletePayload(payload);
    }

    // Check if payload should be archived
    if (!payload.retention.archived && ageInDays > policy.archiveAfterDays) {
      return await this.archivePayload(payload, policy);
    }

    return { action: 'none', spaceReclaimed: 0 };
  }

  /**
   * Archive payload to external storage
   */
  async archivePayload(payload, policy) {
    try {
      if (!this.archiveConfig.enabled) {
        logger.warn(`Archiving disabled, skipping payload ${payload.payloadId}`);
        return { action: 'skipped', spaceReclaimed: 0 };
      }

      // Create archive directory if it doesn't exist
      const archiveDir = path.join(this.archiveConfig.location, 
        payload.createdAt.getFullYear().toString(),
        (payload.createdAt.getMonth() + 1).toString().padStart(2, '0')
      );
      
      await fs.mkdir(archiveDir, { recursive: true });

      // Prepare archive data
      const archiveData = {
        payloadId: payload.payloadId,
        metadata: {
          direction: payload.direction,
          channel: payload.channel,
          operation: payload.businessContext.operation,
          createdAt: payload.createdAt,
          parsedPayload: payload.parsedPayload,
          businessContext: payload.businessContext,
          security: payload.security,
          classification: payload.classification
        },
        rawPayload: payload.rawPayload,
        response: payload.response,
        archivedAt: new Date()
      };

      // Compress and save archive file
      const archiveFileName = `${payload.payloadId}.json.gz`;
      const archiveFilePath = path.join(archiveDir, archiveFileName);
      
      const compressedData = await compress(JSON.stringify(archiveData));
      await fs.writeFile(archiveFilePath, compressedData);

      const originalSize = payload.metrics.payloadSize || 0;
      const archiveSize = compressedData.length;

      // Update payload record
      payload.retention.archived = true;
      payload.retention.archiveLocation = archiveFilePath;
      payload.rawPayload = undefined; // Remove raw data to save space
      payload.response = undefined;
      
      await payload.save();

      // Log archival
      await this.logArchivalAction(payload, {
        archiveLocation: archiveFilePath,
        originalSize,
        archiveSize,
        compressionRatio: ((originalSize - archiveSize) / originalSize * 100).toFixed(2)
      });

      logger.info(`Payload ${payload.payloadId} archived to ${archiveFilePath}`);

      return { 
        action: 'archived', 
        spaceReclaimed: originalSize - archiveSize,
        archiveLocation: archiveFilePath 
      };

    } catch (error) {
      logger.error(`Failed to archive payload ${payload.payloadId}:`, error);
      throw error;
    }
  }

  /**
   * Delete payload from database
   */
  async deletePayload(payload) {
    try {
      const originalSize = payload.metrics.payloadSize || 0;

      // Log deletion before removing
      await this.logDeletionAction(payload, {
        reason: 'retention_policy_expired',
        originalSize
      });

      // Delete the payload
      await OTAPayload.findByIdAndDelete(payload._id);

      logger.info(`Payload ${payload.payloadId} deleted due to retention policy`);

      return { 
        action: 'deleted', 
        spaceReclaimed: originalSize 
      };

    } catch (error) {
      logger.error(`Failed to delete payload ${payload.payloadId}:`, error);
      throw error;
    }
  }

  /**
   * Run weekly archival of old payloads
   */
  async runWeeklyArchival() {
    // Skip if database is not connected
    if (!this.isDbConnected()) {
      logger.debug('Database not connected, skipping weekly archival');
      return;
    }

    logger.info('Starting weekly archival process');

    try {
      // Find unarchived payloads older than their archival threshold
      const oneYearAgo = new Date(Date.now() - (365 * 24 * 60 * 60 * 1000));
      
      const oldPayloads = await OTAPayload.find({
        'retention.archived': false,
        createdAt: { $lt: oneYearAgo }
      })
      .limit(500)
      .sort({ createdAt: 1 });

      let archivedCount = 0;
      for (const payload of oldPayloads) {
        try {
          const policy = this.getRetentionPolicy(payload.businessContext.operation);
          const result = await this.archivePayload(payload, policy);
          
          if (result.action === 'archived') {
            archivedCount++;
          }
        } catch (error) {
          logger.error(`Failed to archive payload ${payload.payloadId}:`, error);
        }
      }

      logger.info(`Weekly archival completed: ${archivedCount} payloads archived`);

    } catch (error) {
      logger.error('Weekly archival failed:', error);
      throw error;
    }
  }

  /**
   * Run monthly compliance check
   */
  async runComplianceCheck() {
    // Skip if database is not connected
    if (!this.isDbConnected()) {
      logger.debug('Database not connected, skipping compliance check');
      return;
    }

    logger.info('Starting monthly compliance check');

    try {
      // Check for payloads that should have been deleted but weren't
      const overduePayloads = await OTAPayload.find({
        'retention.deleteAfter': { $lt: new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)) } // 7 days overdue
      });

      if (overduePayloads.length > 0) {
        logger.warn(`Found ${overduePayloads.length} overdue payloads for deletion`);
        
        // Force delete overdue payloads
        for (const payload of overduePayloads) {
          await this.deletePayload(payload);
        }
      }

      // Check archived payloads integrity
      await this.verifyArchiveIntegrity();

      // Generate compliance report
      const complianceReport = await this.generateRetentionComplianceReport();
      
      logger.info('Monthly compliance check completed', {
        overduePayloads: overduePayloads.length,
        complianceScore: complianceReport.overallCompliance
      });

    } catch (error) {
      logger.error('Monthly compliance check failed:', error);
      throw error;
    }
  }

  /**
   * Verify archive integrity
   */
  async verifyArchiveIntegrity() {
    try {
      const archivedPayloads = await OTAPayload.find({
        'retention.archived': true,
        'retention.archiveLocation': { $exists: true }
      }).limit(100);

      let integrityIssues = 0;

      for (const payload of archivedPayloads) {
        try {
          const archivePath = payload.retention.archiveLocation;
          await fs.access(archivePath);
          
          // Verify file size is reasonable
          const stats = await fs.stat(archivePath);
          if (stats.size === 0) {
            logger.error(`Archive file is empty: ${archivePath}`);
            integrityIssues++;
          }
          
        } catch (error) {
          logger.error(`Archive integrity issue for ${payload.payloadId}:`, error);
          integrityIssues++;
        }
      }

      if (integrityIssues > 0) {
        logger.warn(`Found ${integrityIssues} archive integrity issues`);
      }

      return integrityIssues;

    } catch (error) {
      logger.error('Archive integrity verification failed:', error);
      throw error;
    }
  }

  /**
   * Generate retention compliance report
   */
  async generateRetentionComplianceReport() {
    try {
      const report = {
        generatedAt: new Date(),
        summary: {},
        compliance: {},
        recommendations: []
      };

      // Get overall payload statistics
      const totalPayloads = await OTAPayload.countDocuments();
      const archivedPayloads = await OTAPayload.countDocuments({ 'retention.archived': true });
      const overduePayloads = await OTAPayload.countDocuments({
        'retention.deleteAfter': { $lt: new Date() }
      });

      report.summary = {
        totalPayloads,
        archivedPayloads,
        archivedPercentage: ((archivedPayloads / totalPayloads) * 100).toFixed(2),
        overduePayloads,
        lastCleanupRun: this.cleanupStats.lastRun
      };

      // Compliance score calculation
      const complianceScore = overduePayloads === 0 ? 100 : 
        Math.max(0, 100 - ((overduePayloads / totalPayloads) * 100));
      
      report.compliance = {
        overallScore: complianceScore.toFixed(2),
        retentionCompliant: overduePayloads === 0,
        archivalEffective: (archivedPayloads / totalPayloads) > 0.7
      };

      // Generate recommendations
      if (overduePayloads > 0) {
        report.recommendations.push('Immediate cleanup required for overdue payloads');
      }
      
      if ((archivedPayloads / totalPayloads) < 0.5) {
        report.recommendations.push('Consider more aggressive archival policies');
      }

      return report;

    } catch (error) {
      logger.error('Failed to generate retention compliance report:', error);
      throw error;
    }
  }

  /**
   * Log archival action
   */
  async logArchivalAction(payload, archivalInfo) {
    try {
      await AuditLog.logChange({
        tableName: 'OTAPayload',
        recordId: payload._id,
        changeType: 'archive',
        source: 'system',
        sourceDetails: {
          service: 'PayloadRetentionService',
          action: 'payload_archived'
        },
        newValues: {
          archived: true,
          archiveLocation: archivalInfo.archiveLocation,
          originalSize: archivalInfo.originalSize,
          archiveSize: archivalInfo.archiveSize,
          compressionRatio: archivalInfo.compressionRatio
        },
        metadata: {
          priority: 'low',
          tags: ['payload_archival', 'retention_policy']
        }
      });
    } catch (error) {
      logger.error('Failed to log archival action:', error);
    }
  }

  /**
   * Log deletion action
   */
  async logDeletionAction(payload, deletionInfo) {
    try {
      await AuditLog.logChange({
        tableName: 'OTAPayload',
        recordId: payload._id,
        changeType: 'delete',
        source: 'system',
        sourceDetails: {
          service: 'PayloadRetentionService',
          action: 'payload_deleted'
        },
        oldValues: {
          payloadId: payload.payloadId,
          channel: payload.channel,
          direction: payload.direction,
          operation: payload.businessContext.operation,
          size: deletionInfo.originalSize
        },
        metadata: {
          priority: 'medium',
          tags: ['payload_deletion', 'retention_policy', deletionInfo.reason]
        }
      });
    } catch (error) {
      logger.error('Failed to log deletion action:', error);
    }
  }

  /**
   * Manually trigger cleanup for specific criteria
   */
  async manualCleanup(criteria = {}) {
    logger.info('Starting manual cleanup', criteria);

    const query = {};
    
    if (criteria.channel) query.channel = criteria.channel;
    if (criteria.olderThanDays) {
      const cutoffDate = new Date(Date.now() - (criteria.olderThanDays * 24 * 60 * 60 * 1000));
      query.createdAt = { $lt: cutoffDate };
    }
    if (criteria.operation) query['businessContext.operation'] = criteria.operation;

    const payloads = await OTAPayload.find(query)
      .limit(criteria.limit || 100)
      .sort({ createdAt: 1 });

    const results = {
      processed: 0,
      archived: 0,
      deleted: 0,
      errors: []
    };

    for (const payload of payloads) {
      try {
        const policy = this.getRetentionPolicy(payload.businessContext.operation);
        const result = await this.processPayloadRetention(payload, policy);
        
        results.processed++;
        if (result.action === 'archived') results.archived++;
        if (result.action === 'deleted') results.deleted++;
        
      } catch (error) {
        results.errors.push({
          payloadId: payload.payloadId,
          error: error.message
        });
      }
    }

    logger.info('Manual cleanup completed', results);
    return results;
  }

  /**
   * Get retention service statistics
   */
  getStats() {
    return {
      ...this.cleanupStats,
      retentionPolicies: Array.from(this.retentionPolicies.keys()),
      archiveConfig: this.archiveConfig
    };
  }
}

export default new PayloadRetentionService();