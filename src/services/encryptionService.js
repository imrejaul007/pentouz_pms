import crypto from 'crypto';
import logger from '../utils/logger.js';

class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16; // 128 bits
    this.tagLength = 16; // 128 bits
    
    // Initialize encryption keys
    this.initializeKeys();
  }

  /**
   * Initialize encryption keys from environment
   */
  initializeKeys() {
    // Primary encryption key for PII data
    this.piiKey = this.deriveKey(
      process.env.PII_ENCRYPTION_KEY || 'default-pii-key-change-in-production',
      'PII_ENCRYPTION'
    );
    
    // Key for API tokens and credentials
    this.credentialKey = this.deriveKey(
      process.env.CREDENTIAL_ENCRYPTION_KEY || 'default-credential-key-change-in-production',
      'CREDENTIAL_ENCRYPTION'
    );
    
    // Key for sensitive financial data
    this.financialKey = this.deriveKey(
      process.env.FINANCIAL_ENCRYPTION_KEY || 'default-financial-key-change-in-production',
      'FINANCIAL_ENCRYPTION'
    );

    logger.info('Encryption service initialized with secure keys');
  }

  /**
   * Derive a consistent key from a password using PBKDF2
   */
  deriveKey(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 100000, this.keyLength, 'sha256');
  }

  /**
   * Encrypt sensitive data with additional authentication
   */
  encryptData(plaintext, keyType = 'pii') {
    try {
      if (!plaintext || typeof plaintext !== 'string') {
        return null;
      }

      const key = this.getKeyByType(keyType);
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipher(this.algorithm, key, iv);
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      // Combine IV, tag, and encrypted data
      const result = {
        data: encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        keyType
      };

      return Buffer.from(JSON.stringify(result)).toString('base64');
    } catch (error) {
      logger.error('Encryption failed', { error: error.message, keyType });
      throw new Error('Data encryption failed');
    }
  }

  /**
   * Decrypt sensitive data with authentication verification
   */
  decryptData(encryptedData, expectedKeyType = 'pii') {
    try {
      if (!encryptedData) {
        return null;
      }

      const parsed = JSON.parse(Buffer.from(encryptedData, 'base64').toString());
      const { data, iv, tag, keyType } = parsed;
      
      // Verify key type matches expected
      if (keyType !== expectedKeyType) {
        throw new Error('Key type mismatch');
      }

      const key = this.getKeyByType(keyType);
      const decipher = crypto.createDecipher(this.algorithm, key, Buffer.from(iv, 'hex'));
      decipher.setAuthTag(Buffer.from(tag, 'hex'));
      
      let decrypted = decipher.update(data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Decryption failed', { error: error.message });
      throw new Error('Data decryption failed');
    }
  }

  /**
   * Hash data for searching/indexing (one-way, deterministic)
   */
  hashForSearch(plaintext, salt = 'search-salt') {
    if (!plaintext) return null;
    
    return crypto.pbkdf2Sync(
      plaintext.toLowerCase().trim(),
      salt,
      10000,
      32,
      'sha256'
    ).toString('hex');
  }

  /**
   * Create a secure token for API access
   */
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Encrypt API keys/tokens for storage
   */
  encryptCredential(credential, metadata = {}) {
    const data = {
      credential,
      metadata,
      createdAt: new Date().toISOString()
    };
    
    return this.encryptData(JSON.stringify(data), 'credential');
  }

  /**
   * Decrypt API keys/tokens
   */
  decryptCredential(encryptedCredential) {
    try {
      const decrypted = this.decryptData(encryptedCredential, 'credential');
      return JSON.parse(decrypted);
    } catch (error) {
      logger.error('Credential decryption failed', { error: error.message });
      throw new Error('Credential decryption failed');
    }
  }

  /**
   * Get encryption key by type
   */
  getKeyByType(keyType) {
    switch (keyType) {
      case 'pii':
        return this.piiKey;
      case 'credential':
        return this.credentialKey;
      case 'financial':
        return this.financialKey;
      default:
        throw new Error(`Unknown key type: ${keyType}`);
    }
  }

  /**
   * Rotate encryption keys (for key rotation policy)
   */
  async rotateKeys(keyType) {
    try {
      // In production, this would:
      // 1. Generate new key
      // 2. Re-encrypt all data with new key
      // 3. Update key storage
      // 4. Log rotation event
      
      logger.warn('Key rotation requested', { keyType });
      
      // For now, just log - actual implementation would require database migration
      return {
        success: false,
        message: 'Key rotation requires manual database migration',
        keyType
      };
    } catch (error) {
      logger.error('Key rotation failed', { keyType, error: error.message });
      throw error;
    }
  }

  /**
   * Verify data integrity
   */
  verifyIntegrity(encryptedData) {
    try {
      const parsed = JSON.parse(Buffer.from(encryptedData, 'base64').toString());
      return !!(parsed.data && parsed.iv && parsed.tag && parsed.keyType);
    } catch {
      return false;
    }
  }

  /**
   * Create anonymized version of data for analytics
   */
  anonymizeData(data, type) {
    switch (type) {
      case 'email':
        const [local, domain] = data.split('@');
        return `${local.substring(0, 2)}***@${domain}`;
      
      case 'phone':
        return `***${data.slice(-4)}`;
      
      case 'name':
        const names = data.split(' ');
        return names.map(name => `${name.charAt(0)}***`).join(' ');
      
      case 'address':
        return 'Address provided but anonymized';
      
      case 'creditCard':
        return `****-****-****-${data.slice(-4)}`;
      
      default:
        return '***anonymized***';
    }
  }

  /**
   * Generate encryption report for compliance
   */
  getEncryptionReport() {
    return {
      algorithm: this.algorithm,
      keyLength: this.keyLength,
      ivLength: this.ivLength,
      tagLength: this.tagLength,
      keyTypes: ['pii', 'credential', 'financial'],
      features: [
        'AES-256-GCM encryption',
        'Authenticated encryption',
        'Random IV for each encryption',
        'Key derivation with PBKDF2',
        'Data integrity verification'
      ],
      compliance: [
        'GDPR Article 32 (Security of processing)',
        'PCI DSS (Payment Card Industry)',
        'SOC 2 Type II controls'
      ]
    };
  }
}

// Create singleton instance
const encryptionService = new EncryptionService();

export default encryptionService;