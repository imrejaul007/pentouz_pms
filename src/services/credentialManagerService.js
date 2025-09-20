import encryptionService from './encryptionService.js';
import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

class CredentialManagerService {
  constructor() {
    this.credentialStore = new Map(); // In production, use secure database
    this.tokenBlacklist = new Set();
    this.rateLimitStore = new Map();
    
    // Credential types and their configurations
    this.credentialTypes = {
      OTA_API: {
        name: 'OTA API Credentials',
        description: 'API keys for OTA integrations (Booking.com, Expedia, etc.)',
        rotation: 90, // days
        encryption: 'credential',
        fields: ['apiKey', 'secret', 'webhookUrl', 'environment']
      },
      PAYMENT_GATEWAY: {
        name: 'Payment Gateway',
        description: 'Payment processor credentials (Stripe, PayPal, etc.)',
        rotation: 180,
        encryption: 'financial',
        fields: ['publicKey', 'secretKey', 'webhookSecret', 'environment']
      },
      EMAIL_SERVICE: {
        name: 'Email Service',
        description: 'SMTP and email service credentials',
        rotation: 365,
        encryption: 'credential',
        fields: ['host', 'port', 'username', 'password', 'secure']
      },
      SMS_SERVICE: {
        name: 'SMS Service',
        description: 'SMS provider credentials (Twilio, AWS SNS, etc.)',
        rotation: 180,
        encryption: 'credential', 
        fields: ['accountSid', 'authToken', 'fromNumber']
      },
      CLOUD_STORAGE: {
        name: 'Cloud Storage',
        description: 'Cloud storage service credentials (AWS S3, Google Cloud, etc.)',
        rotation: 90,
        encryption: 'credential',
        fields: ['accessKeyId', 'secretAccessKey', 'region', 'bucket']
      },
      DATABASE: {
        name: 'Database',
        description: 'Database connection credentials',
        rotation: 90,
        encryption: 'credential',
        fields: ['host', 'port', 'username', 'password', 'database']
      },
      INTERNAL_API: {
        name: 'Internal API',
        description: 'Internal service API tokens',
        rotation: 30,
        encryption: 'credential',
        fields: ['token', 'endpoint', 'version']
      }
    };

    // Initialize default system credentials
    this.initializeSystemCredentials();
  }

  /**
   * Create new credential set
   */
  async createCredentials(credentialType, credentials, metadata = {}) {
    try {
      const credentialId = uuidv4();
      const type = this.credentialTypes[credentialType];
      
      if (!type) {
        throw new Error(`Unknown credential type: ${credentialType}`);
      }

      // Validate required fields
      const missingFields = type.fields.filter(field => !credentials.hasOwnProperty(field));
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // Encrypt credentials
      const encryptedCredentials = encryptionService.encryptCredential(credentials, {
        type: credentialType,
        createdBy: metadata.createdBy,
        environment: metadata.environment || 'production',
        ...metadata
      });

      const credentialRecord = {
        id: credentialId,
        type: credentialType,
        name: metadata.name || `${type.name} - ${new Date().toISOString()}`,
        description: metadata.description || type.description,
        encryptedData: encryptedCredentials,
        status: 'active',
        environment: metadata.environment || 'production',
        createdAt: new Date(),
        createdBy: metadata.createdBy,
        expiresAt: this.calculateExpirationDate(type.rotation),
        lastUsed: null,
        usageCount: 0,
        metadata: {
          ...metadata,
          fields: type.fields,
          encryptionType: type.encryption
        },
        auditLog: [{
          action: 'created',
          timestamp: new Date(),
          by: metadata.createdBy,
          details: { type: credentialType, environment: metadata.environment }
        }]
      };

      this.credentialStore.set(credentialId, credentialRecord);

      logger.info('Credentials created', {
        credentialId,
        type: credentialType,
        createdBy: metadata.createdBy,
        environment: metadata.environment
      });

      return {
        credentialId,
        type: credentialType,
        name: credentialRecord.name,
        status: 'active',
        expiresAt: credentialRecord.expiresAt
      };
    } catch (error) {
      logger.error('Failed to create credentials', {
        type: credentialType,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Retrieve credentials
   */
  async getCredentials(credentialId, accessedBy) {
    try {
      const record = this.credentialStore.get(credentialId);
      
      if (!record) {
        throw new Error('Credentials not found');
      }

      if (record.status !== 'active') {
        throw new Error('Credentials are not active');
      }

      if (record.expiresAt && new Date() > record.expiresAt) {
        throw new Error('Credentials have expired');
      }

      // Decrypt credentials
      const decryptedData = encryptionService.decryptCredential(record.encryptedData);
      
      // Update usage tracking
      record.lastUsed = new Date();
      record.usageCount++;
      record.auditLog.push({
        action: 'accessed',
        timestamp: new Date(),
        by: accessedBy,
        ip: 'system' // Would be actual IP in production
      });

      logger.info('Credentials accessed', {
        credentialId,
        type: record.type,
        accessedBy,
        usageCount: record.usageCount
      });

      return {
        credentialId,
        type: record.type,
        credentials: decryptedData.credential,
        metadata: decryptedData.metadata,
        expiresAt: record.expiresAt
      };
    } catch (error) {
      logger.error('Failed to retrieve credentials', {
        credentialId,
        accessedBy,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update existing credentials
   */
  async updateCredentials(credentialId, updates, updatedBy) {
    try {
      const record = this.credentialStore.get(credentialId);
      
      if (!record) {
        throw new Error('Credentials not found');
      }

      // Create new version while preserving audit trail
      const currentData = encryptionService.decryptCredential(record.encryptedData);
      const updatedCredentials = { ...currentData.credential, ...updates };

      const encryptedData = encryptionService.encryptCredential(updatedCredentials, {
        ...currentData.metadata,
        updatedAt: new Date().toISOString(),
        updatedBy
      });

      record.encryptedData = encryptedData;
      record.auditLog.push({
        action: 'updated',
        timestamp: new Date(),
        by: updatedBy,
        details: { fields: Object.keys(updates) }
      });

      logger.info('Credentials updated', {
        credentialId,
        type: record.type,
        updatedBy,
        fieldsUpdated: Object.keys(updates)
      });

      return {
        credentialId,
        status: 'updated',
        updatedAt: new Date()
      };
    } catch (error) {
      logger.error('Failed to update credentials', {
        credentialId,
        updatedBy,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Rotate credentials
   */
  async rotateCredentials(credentialId, newCredentials, rotatedBy) {
    try {
      const record = this.credentialStore.get(credentialId);
      
      if (!record) {
        throw new Error('Credentials not found');
      }

      // Archive current credentials
      record.status = 'rotated';
      record.auditLog.push({
        action: 'rotated',
        timestamp: new Date(),
        by: rotatedBy,
        details: { reason: 'scheduled_rotation' }
      });

      // Create new credentials
      const newCredentialId = await this.createCredentials(
        record.type,
        newCredentials,
        {
          name: `${record.name} (Rotated)`,
          description: record.description,
          environment: record.environment,
          createdBy: rotatedBy,
          previousCredentialId: credentialId
        }
      );

      logger.info('Credentials rotated', {
        oldCredentialId: credentialId,
        newCredentialId: newCredentialId.credentialId,
        type: record.type,
        rotatedBy
      });

      return newCredentialId;
    } catch (error) {
      logger.error('Failed to rotate credentials', {
        credentialId,
        rotatedBy,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Revoke credentials
   */
  async revokeCredentials(credentialId, reason, revokedBy) {
    try {
      const record = this.credentialStore.get(credentialId);
      
      if (!record) {
        throw new Error('Credentials not found');
      }

      record.status = 'revoked';
      record.revokedAt = new Date();
      record.revokedBy = revokedBy;
      record.revocationReason = reason;
      
      record.auditLog.push({
        action: 'revoked',
        timestamp: new Date(),
        by: revokedBy,
        details: { reason }
      });

      // Add to blacklist if applicable
      if (record.type === 'INTERNAL_API') {
        const data = encryptionService.decryptCredential(record.encryptedData);
        this.tokenBlacklist.add(data.credential.token);
      }

      logger.warn('Credentials revoked', {
        credentialId,
        type: record.type,
        reason,
        revokedBy
      });

      return {
        credentialId,
        status: 'revoked',
        revokedAt: record.revokedAt
      };
    } catch (error) {
      logger.error('Failed to revoke credentials', {
        credentialId,
        revokedBy,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate API token for internal services
   */
  async generateAPIToken(service, permissions = [], expiryDays = 30, createdBy) {
    try {
      const token = this.createSecureToken();
      const tokenHash = this.hashToken(token);
      
      const tokenData = {
        id: uuidv4(),
        service,
        token,
        tokenHash,
        permissions,
        status: 'active',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000),
        createdBy,
        lastUsed: null,
        usageCount: 0,
        rateLimits: {
          requests: 1000, // per hour
          period: 'hour'
        }
      };

      // Store token (in production, use secure database)
      this.credentialStore.set(tokenData.id, {
        type: 'API_TOKEN',
        tokenData,
        auditLog: [{
          action: 'token_created',
          timestamp: new Date(),
          by: createdBy,
          service
        }]
      });

      logger.info('API token generated', {
        tokenId: tokenData.id,
        service,
        permissions,
        expiresAt: tokenData.expiresAt,
        createdBy
      });

      return {
        tokenId: tokenData.id,
        token, // Only returned once
        service,
        permissions,
        expiresAt: tokenData.expiresAt,
        rateLimits: tokenData.rateLimits
      };
    } catch (error) {
      logger.error('Failed to generate API token', {
        service,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Validate API token
   */
  async validateAPIToken(token, requiredPermissions = []) {
    try {
      const tokenHash = this.hashToken(token);
      
      // Check blacklist
      if (this.tokenBlacklist.has(token)) {
        throw new Error('Token has been revoked');
      }

      // Find token in store
      let tokenRecord = null;
      for (const record of this.credentialStore.values()) {
        if (record.type === 'API_TOKEN' && record.tokenData.tokenHash === tokenHash) {
          tokenRecord = record.tokenData;
          break;
        }
      }

      if (!tokenRecord) {
        throw new Error('Invalid token');
      }

      if (tokenRecord.status !== 'active') {
        throw new Error('Token is not active');
      }

      if (new Date() > tokenRecord.expiresAt) {
        throw new Error('Token has expired');
      }

      // Check permissions
      const hasRequiredPermissions = requiredPermissions.every(permission => 
        tokenRecord.permissions.includes(permission) || tokenRecord.permissions.includes('*')
      );

      if (!hasRequiredPermissions) {
        throw new Error('Insufficient permissions');
      }

      // Check rate limits
      const rateLimitKey = `${tokenRecord.id}:${tokenRecord.rateLimits.period}`;
      const now = Date.now();
      const periodStart = this.getPeriodStart(now, tokenRecord.rateLimits.period);
      
      if (!this.rateLimitStore.has(rateLimitKey)) {
        this.rateLimitStore.set(rateLimitKey, { count: 0, resetAt: periodStart });
      }

      const rateLimitData = this.rateLimitStore.get(rateLimitKey);
      
      if (now > rateLimitData.resetAt) {
        rateLimitData.count = 0;
        rateLimitData.resetAt = this.getPeriodStart(now, tokenRecord.rateLimits.period);
      }

      if (rateLimitData.count >= tokenRecord.rateLimits.requests) {
        throw new Error('Rate limit exceeded');
      }

      // Update usage
      rateLimitData.count++;
      tokenRecord.lastUsed = new Date();
      tokenRecord.usageCount++;

      return {
        valid: true,
        tokenId: tokenRecord.id,
        service: tokenRecord.service,
        permissions: tokenRecord.permissions,
        rateLimitRemaining: tokenRecord.rateLimits.requests - rateLimitData.count,
        rateLimitResetAt: new Date(rateLimitData.resetAt)
      };
    } catch (error) {
      logger.warn('Token validation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * List credentials for management
   */
  async listCredentials(filters = {}) {
    try {
      const credentials = Array.from(this.credentialStore.values())
        .filter(record => {
          if (filters.type && record.type !== filters.type) return false;
          if (filters.status && record.status !== filters.status) return false;
          if (filters.environment && record.environment !== filters.environment) return false;
          return true;
        })
        .map(record => ({
          id: record.id,
          type: record.type,
          name: record.name,
          status: record.status,
          environment: record.environment,
          createdAt: record.createdAt,
          expiresAt: record.expiresAt,
          lastUsed: record.lastUsed,
          usageCount: record.usageCount
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return {
        credentials,
        total: credentials.length,
        filters
      };
    } catch (error) {
      logger.error('Failed to list credentials', { error: error.message });
      throw error;
    }
  }

  /**
   * Get credential audit log
   */
  async getCredentialAuditLog(credentialId) {
    try {
      const record = this.credentialStore.get(credentialId);
      
      if (!record) {
        throw new Error('Credentials not found');
      }

      return {
        credentialId,
        type: record.type,
        auditLog: record.auditLog.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      };
    } catch (error) {
      logger.error('Failed to get audit log', { credentialId, error: error.message });
      throw error;
    }
  }

  /**
   * Check for expiring credentials
   */
  async checkExpiringCredentials(warningDays = 30) {
    try {
      const warningDate = new Date(Date.now() + warningDays * 24 * 60 * 60 * 1000);
      
      const expiringCredentials = Array.from(this.credentialStore.values())
        .filter(record => 
          record.status === 'active' &&
          record.expiresAt &&
          record.expiresAt <= warningDate
        )
        .map(record => ({
          id: record.id,
          type: record.type,
          name: record.name,
          expiresAt: record.expiresAt,
          daysUntilExpiry: Math.ceil((record.expiresAt - new Date()) / (24 * 60 * 60 * 1000))
        }))
        .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

      return {
        expiringCredentials,
        count: expiringCredentials.length,
        warningDays
      };
    } catch (error) {
      logger.error('Failed to check expiring credentials', { error: error.message });
      throw error;
    }
  }

  // Helper methods

  createSecureToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  calculateExpirationDate(rotationDays) {
    if (!rotationDays) return null;
    return new Date(Date.now() + rotationDays * 24 * 60 * 60 * 1000);
  }

  getPeriodStart(timestamp, period) {
    const date = new Date(timestamp);
    switch (period) {
      case 'hour':
        return new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours() + 1).getTime();
      case 'day':
        return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
      default:
        return timestamp + 60 * 60 * 1000; // Default to 1 hour
    }
  }

  async initializeSystemCredentials() {
    // Initialize with system defaults if needed
    logger.info('Credential manager initialized');
  }

  /**
   * Get security report
   */
  getSecurityReport() {
    const credentials = Array.from(this.credentialStore.values());
    const totalCredentials = credentials.length;
    const activeCredentials = credentials.filter(c => c.status === 'active').length;
    const expiredCredentials = credentials.filter(c => c.expiresAt && new Date() > c.expiresAt).length;
    const credentialsByType = credentials.reduce((acc, cred) => {
      acc[cred.type] = (acc[cred.type] || 0) + 1;
      return acc;
    }, {});

    return {
      totalCredentials,
      activeCredentials,
      expiredCredentials,
      revokedCredentials: credentials.filter(c => c.status === 'revoked').length,
      credentialsByType,
      blacklistedTokens: this.tokenBlacklist.size,
      supportedTypes: Object.keys(this.credentialTypes),
      lastUpdated: new Date().toISOString()
    };
  }
}

// Create singleton instance
const credentialManagerService = new CredentialManagerService();

export default credentialManagerService;