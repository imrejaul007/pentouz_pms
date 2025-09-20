import encryptionService from '../services/encryptionService.js';
import logger from '../utils/logger.js';

/**
 * Middleware to automatically encrypt/decrypt specified fields in Mongoose schemas
 */
export class EncryptedFieldPlugin {
  constructor(schema, options = {}) {
    this.schema = schema;
    this.options = {
      fields: options.fields || [],
      keyType: options.keyType || 'pii',
      searchable: options.searchable || [],
      ...options
    };
    
    this.init();
  }

  init() {
    // Add encrypted field definitions
    this.addEncryptedFields();
    
    // Add pre-save middleware for encryption
    this.addPreSaveMiddleware();
    
    // Add post-find middleware for decryption
    this.addPostFindMiddleware();
    
    // Add search hash fields for searchable encrypted fields
    this.addSearchHashFields();
  }

  addEncryptedFields() {
    this.options.fields.forEach(fieldName => {
      // Store original field definition
      const originalField = this.schema.paths[fieldName];
      
      if (originalField) {
        // Modify field to store encrypted data
        this.schema.add({
          [`${fieldName}_encrypted`]: {
            type: String,
            select: false // Don't include in queries by default
          }
        });

        // Keep original field for input/output
        // Will be handled by middleware
      }
    });
  }

  addSearchHashFields() {
    this.options.searchable.forEach(fieldName => {
      this.schema.add({
        [`${fieldName}_hash`]: {
          type: String,
          index: true,
          select: false
        }
      });
    });
  }

  addPreSaveMiddleware() {
    this.schema.pre('save', async function(next) {
      try {
        // Encrypt specified fields before saving
        for (const fieldName of this.constructor.encryptedFields || []) {
          const value = this.get(fieldName);
          
          if (value !== undefined && this.isModified(fieldName)) {
            // Encrypt the value
            const encrypted = encryptionService.encryptData(value, this.constructor.keyType || 'pii');
            this.set(`${fieldName}_encrypted`, encrypted);
            
            // Create search hash if field is searchable
            if (this.constructor.searchableFields?.includes(fieldName)) {
              const hash = encryptionService.hashForSearch(value);
              this.set(`${fieldName}_hash`, hash);
            }
            
            // Clear the plaintext field
            this.set(fieldName, undefined);
          }
        }
        
        next();
      } catch (error) {
        logger.error('Encryption middleware error', { error: error.message });
        next(error);
      }
    });

    // Handle updates
    this.schema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], async function() {
      try {
        const update = this.getUpdate();
        const encryptedFields = this.model.encryptedFields || [];
        
        for (const fieldName of encryptedFields) {
          if (update[fieldName] !== undefined) {
            // Encrypt the value
            const encrypted = encryptionService.encryptData(update[fieldName], this.model.keyType || 'pii');
            update[`${fieldName}_encrypted`] = encrypted;
            
            // Create search hash if field is searchable
            if (this.model.searchableFields?.includes(fieldName)) {
              const hash = encryptionService.hashForSearch(update[fieldName]);
              update[`${fieldName}_hash`] = hash;
            }
            
            // Remove plaintext field from update
            delete update[fieldName];
          }
        }
      } catch (error) {
        logger.error('Update encryption middleware error', { error: error.message });
        throw error;
      }
    });
  }

  addPostFindMiddleware() {
    // Decrypt fields after finding documents
    const decryptFields = async function(docs) {
      if (!docs) return;
      
      const docsArray = Array.isArray(docs) ? docs : [docs];
      
      for (const doc of docsArray) {
        if (!doc) continue;
        
        const encryptedFields = doc.constructor.encryptedFields || [];
        
        for (const fieldName of encryptedFields) {
          const encryptedValue = doc.get(`${fieldName}_encrypted`);
          
          if (encryptedValue) {
            try {
              const decrypted = encryptionService.decryptData(encryptedValue, doc.constructor.keyType || 'pii');
              doc.set(fieldName, decrypted);
              
              // Remove encrypted field from output
              doc.set(`${fieldName}_encrypted`, undefined);
            } catch (error) {
              logger.error('Decryption error', { 
                fieldName, 
                docId: doc._id, 
                error: error.message 
              });
              
              // Set field to null if decryption fails
              doc.set(fieldName, null);
            }
          }
        }
      }
    };

    this.schema.post(['find', 'findOne', 'findOneAndUpdate'], decryptFields);
  }
}

/**
 * Plugin function for Mongoose schemas
 */
export function encryptedFieldsPlugin(schema, options) {
  new EncryptedFieldPlugin(schema, options);
  
  // Add static properties to the model
  schema.statics.encryptedFields = options.fields || [];
  schema.statics.searchableFields = options.searchable || [];
  schema.statics.keyType = options.keyType || 'pii';
}

/**
 * Helper function to create searchable queries for encrypted fields
 */
export function createSearchQuery(fieldName, searchValue, modelName) {
  try {
    const hash = encryptionService.hashForSearch(searchValue);
    return { [`${fieldName}_hash`]: hash };
  } catch (error) {
    logger.error('Search query creation failed', { 
      fieldName, 
      modelName, 
      error: error.message 
    });
    return {};
  }
}

/**
 * Decorator for marking fields as encrypted in model definition
 */
export function encrypted(options = {}) {
  return function(target, propertyKey) {
    if (!target.encryptedFields) {
      target.encryptedFields = [];
    }
    
    if (!target.encryptedFields.includes(propertyKey)) {
      target.encryptedFields.push(propertyKey);
    }

    if (options.searchable) {
      if (!target.searchableFields) {
        target.searchableFields = [];
      }
      target.searchableFields.push(propertyKey);
    }
  };
}

/**
 * Middleware for handling GDPR data anonymization
 */
export function anonymizeForExport(doc, fieldMappings = {}) {
  const anonymized = { ...doc };
  
  for (const [fieldName, anonymizeType] of Object.entries(fieldMappings)) {
    const value = anonymized[fieldName];
    if (value) {
      anonymized[fieldName] = encryptionService.anonymizeData(value, anonymizeType);
    }
  }
  
  return anonymized;
}

/**
 * Validation middleware for encrypted fields
 */
export function validateEncryptedField(value, fieldName) {
  if (!value) return true;
  
  // Check if it's already encrypted data
  if (typeof value === 'string' && encryptionService.verifyIntegrity(value)) {
    return true;
  }
  
  // Validate plaintext value based on field type
  switch (fieldName) {
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    case 'phone':
      return /^\+?[1-9]\d{1,14}$/.test(value.replace(/\s/g, ''));
    case 'ssn':
      return /^\d{3}-?\d{2}-?\d{4}$/.test(value);
    case 'creditCard':
      return /^\d{13,19}$/.test(value.replace(/\s/g, ''));
    default:
      return true;
  }
}

/**
 * Helper to get field encryption status
 */
export function getFieldEncryptionStatus(model) {
  return {
    modelName: model.modelName,
    encryptedFields: model.encryptedFields || [],
    searchableFields: model.searchableFields || [],
    keyType: model.keyType || 'pii',
    totalFields: Object.keys(model.schema.paths).length,
    encryptedFieldCount: (model.encryptedFields || []).length
  };
}

/**
 * Bulk encryption migration helper
 */
export async function migrateToEncryption(Model, batchSize = 100) {
  try {
    const total = await Model.countDocuments();
    let processed = 0;
    
    logger.info('Starting encryption migration', { 
      model: Model.modelName, 
      totalDocuments: total 
    });

    while (processed < total) {
      const batch = await Model.find({})
        .select('+' + (Model.encryptedFields || []).map(f => `${f}_encrypted`).join(' +'))
        .limit(batchSize)
        .skip(processed);

      const operations = [];
      
      for (const doc of batch) {
        const hasUnencryptedData = (Model.encryptedFields || []).some(field => {
          const plaintext = doc[field];
          const encrypted = doc[`${field}_encrypted`];
          return plaintext && !encrypted;
        });

        if (hasUnencryptedData) {
          operations.push({
            updateOne: {
              filter: { _id: doc._id },
              update: { $set: {} } // This will trigger pre-save middleware
            }
          });
        }
      }

      if (operations.length > 0) {
        await Model.bulkWrite(operations);
      }

      processed += batch.length;
      
      logger.info('Migration progress', { 
        model: Model.modelName, 
        processed, 
        total, 
        percentage: Math.round((processed / total) * 100)
      });
    }

    logger.info('Encryption migration completed', { 
      model: Model.modelName, 
      totalProcessed: processed 
    });

    return { success: true, processed };
  } catch (error) {
    logger.error('Encryption migration failed', { 
      model: Model.modelName, 
      error: error.message 
    });
    throw error;
  }
}

export default {
  encryptedFieldsPlugin,
  createSearchQuery,
  encrypted,
  anonymizeForExport,
  validateEncryptedField,
  getFieldEncryptionStatus,
  migrateToEncryption
};
