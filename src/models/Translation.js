import mongoose from 'mongoose';
import logger from '../utils/logger.js';

/**
 * Translation Schema
 * 
 * Stores all translations for content across the hotel management system.
 * Supports versioning, quality control, and translation workflow management.
 */
const translationSchema = new mongoose.Schema({
  // Content identification
  resourceType: {
    type: String,
    required: true,
    enum: [
      'room_type', 'room_amenity', 'hotel_amenity', 'hotel_description',
      'policy', 'email_template', 'sms_template', 'ui_text', 'form_field',
      'error_message', 'notification', 'menu_item', 'service_description',
      'package_description', 'rate_plan_description', 'marketing_content'
    ],
    index: true
  },

  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },

  fieldName: {
    type: String,
    required: true,
    trim: true
  },

  // Language information
  sourceLanguage: {
    type: String,
    required: true,
    uppercase: true,
    ref: 'Language',
    index: true
  },

  targetLanguage: {
    type: String,
    required: true,
    uppercase: true,
    ref: 'Language',
    index: true
  },

  // Content
  originalText: {
    type: String,
    required: true
  },

  translatedText: {
    type: String,
    required: true
  },

  // Translation metadata
  translationMethod: {
    type: String,
    enum: ['manual', 'automatic', 'hybrid'],
    required: true
  },

  provider: {
    type: String,
    enum: ['google', 'deepl', 'azure', 'manual', 'professional'],
    default: 'manual'
  },

  // Quality control
  quality: {
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5
    },
    
    reviewStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'needs_review'],
      default: 'pending',
      index: true
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },

    reviewedAt: Date,

    reviewNotes: String,

    qualityScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    }
  },

  // Workflow management
  workflow: {
    stage: {
      type: String,
      enum: ['draft', 'translation', 'review', 'approved', 'published'],
      default: 'draft',
      index: true
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },

    dueDate: Date,

    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    },

    tags: [String],

    notes: String
  },

  // Version control
  version: {
    type: Number,
    default: 1,
    min: 1
  },

  previousVersion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Translation'
  },

  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

  // Context information
  context: {
    channel: {
      type: String,
      enum: ['website', 'booking_engine', 'mobile_app', 'email', 'sms', 'ota', 'staff_interface']
    },

    audience: {
      type: String,
      enum: ['guest', 'staff', 'admin', 'public']
    },

    tone: {
      type: String,
      enum: ['formal', 'casual', 'friendly', 'professional', 'marketing']
    },

    maxLength: Number,

    formatting: {
      type: String,
      enum: ['plain_text', 'html', 'markdown', 'rich_text']
    },

    variables: [String] // Template variables like {{guestName}}, {{checkInDate}}
  },

  // Usage statistics
  usage: {
    impressions: { type: Number, default: 0 },
    lastUsed: Date,
    contexts: [String] // Where this translation has been used
  },

  // Audit trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for efficient queries
translationSchema.index({ 
  resourceType: 1, 
  resourceId: 1, 
  fieldName: 1, 
  targetLanguage: 1, 
  isActive: 1 
});
translationSchema.index({ sourceLanguage: 1, targetLanguage: 1 });
translationSchema.index({ 'quality.reviewStatus': 1, 'workflow.stage': 1 });
translationSchema.index({ 'workflow.assignedTo': 1, 'workflow.dueDate': 1 });
translationSchema.index({ createdAt: -1 });

// Virtual for translation age
translationSchema.virtual('ageInDays').get(function() {
  return Math.floor((new Date() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Virtual for approval status
translationSchema.virtual('isApproved').get(function() {
  return this.quality.reviewStatus === 'approved';
});

// Static methods

/**
 * Get translations for a specific resource
 */
translationSchema.statics.getResourceTranslations = async function(resourceType, resourceId, options = {}) {
  try {
    const query = {
      resourceType,
      resourceId,
      isActive: true,
      ...options.filter
    };

    if (options.targetLanguage) {
      query.targetLanguage = options.targetLanguage.toUpperCase();
    }

    if (options.approvedOnly) {
      query['quality.reviewStatus'] = 'approved';
    }

    return await this.find(query)
      .sort({ fieldName: 1, version: -1 })
      .populate('createdBy updatedBy quality.reviewedBy', 'name email')
      .lean();

  } catch (error) {
    logger.error('Failed to get resource translations', {
      resourceType,
      resourceId,
      error: error.message
    });
    throw error;
  }
};

/**
 * Get translation for specific field
 */
translationSchema.statics.getFieldTranslation = async function(resourceType, resourceId, fieldName, targetLanguage, options = {}) {
  try {
    const query = {
      resourceType,
      resourceId,
      fieldName,
      targetLanguage: targetLanguage.toUpperCase(),
      isActive: true
    };

    if (options.approvedOnly !== false) {
      query['quality.reviewStatus'] = 'approved';
    }

    // Get the latest version
    const translation = await this.findOne(query)
      .sort({ version: -1 })
      .populate('createdBy updatedBy quality.reviewedBy', 'name email');

    return translation;

  } catch (error) {
    logger.error('Failed to get field translation', {
      resourceType,
      resourceId,
      fieldName,
      targetLanguage,
      error: error.message
    });
    throw error;
  }
};

/**
 * Get pending translations for review
 */
translationSchema.statics.getPendingTranslations = async function(options = {}) {
  try {
    const query = {
      'quality.reviewStatus': 'pending',
      isActive: true
    };

    if (options.assignedTo) {
      query['workflow.assignedTo'] = options.assignedTo;
    }

    if (options.targetLanguage) {
      query.targetLanguage = options.targetLanguage.toUpperCase();
    }

    if (options.priority) {
      query['workflow.priority'] = options.priority;
    }

    return await this.find(query)
      .sort({ 'workflow.dueDate': 1, 'workflow.priority': -1, createdAt: 1 })
      .populate('createdBy workflow.assignedTo', 'name email')
      .limit(options.limit || 50);

  } catch (error) {
    logger.error('Failed to get pending translations', { error: error.message });
    throw error;
  }
};

/**
 * Get translation statistics
 */
translationSchema.statics.getTranslationStats = async function(filters = {}) {
  try {
    const pipeline = [
      { $match: { isActive: true, ...filters } },
      {
        $group: {
          _id: {
            resourceType: '$resourceType',
            targetLanguage: '$targetLanguage',
            reviewStatus: '$quality.reviewStatus'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: {
            resourceType: '$_id.resourceType',
            targetLanguage: '$_id.targetLanguage'
          },
          total: { $sum: '$count' },
          approved: {
            $sum: {
              $cond: [{ $eq: ['$_id.reviewStatus', 'approved'] }, '$count', 0]
            }
          },
          pending: {
            $sum: {
              $cond: [{ $eq: ['$_id.reviewStatus', 'pending'] }, '$count', 0]
            }
          }
        }
      }
    ];

    return await this.aggregate(pipeline);

  } catch (error) {
    logger.error('Failed to get translation statistics', { error: error.message });
    throw error;
  }
};

/**
 * Bulk update translations
 */
translationSchema.statics.bulkUpdateTranslations = async function(updates, userId) {
  try {
    const operations = updates.map(update => ({
      updateOne: {
        filter: { _id: update.id },
        update: {
          ...update.data,
          updatedBy: userId,
          updatedAt: new Date()
        }
      }
    }));

    const result = await this.bulkWrite(operations);

    logger.info('Bulk translation update completed', {
      matched: result.matchedCount,
      modified: result.modifiedCount,
      userId
    });

    return result;

  } catch (error) {
    logger.error('Bulk translation update failed', { error: error.message });
    throw error;
  }
};

// Instance methods

/**
 * Create new version of translation
 */
translationSchema.methods.createNewVersion = async function(newTranslation, userId) {
  try {
    // Set current version as inactive
    this.isActive = false;
    await this.save();

    // Create new version
    const newVersion = new this.constructor({
      ...this.toObject(),
      _id: undefined,
      version: this.version + 1,
      previousVersion: this._id,
      translatedText: newTranslation,
      quality: {
        ...this.quality,
        reviewStatus: 'pending',
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: null
      },
      isActive: true,
      createdBy: userId,
      updatedBy: userId,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await newVersion.save();

    logger.info('New translation version created', {
      resourceType: this.resourceType,
      resourceId: this.resourceId,
      fieldName: this.fieldName,
      targetLanguage: this.targetLanguage,
      oldVersion: this.version,
      newVersion: newVersion.version
    });

    return newVersion;

  } catch (error) {
    logger.error('Failed to create new translation version', {
      translationId: this._id,
      error: error.message
    });
    throw error;
  }
};

/**
 * Approve translation
 */
translationSchema.methods.approve = async function(reviewerId, notes = '') {
  try {
    this.quality.reviewStatus = 'approved';
    this.quality.reviewedBy = reviewerId;
    this.quality.reviewedAt = new Date();
    this.quality.reviewNotes = notes;
    this.workflow.stage = 'approved';
    this.updatedBy = reviewerId;

    await this.save();

    logger.info('Translation approved', {
      translationId: this._id,
      resourceType: this.resourceType,
      targetLanguage: this.targetLanguage,
      reviewerId
    });

  } catch (error) {
    logger.error('Failed to approve translation', {
      translationId: this._id,
      error: error.message
    });
    throw error;
  }
};

/**
 * Reject translation
 */
translationSchema.methods.reject = async function(reviewerId, notes = '') {
  try {
    this.quality.reviewStatus = 'rejected';
    this.quality.reviewedBy = reviewerId;
    this.quality.reviewedAt = new Date();
    this.quality.reviewNotes = notes;
    this.workflow.stage = 'translation'; // Back to translation stage
    this.updatedBy = reviewerId;

    await this.save();

    logger.info('Translation rejected', {
      translationId: this._id,
      resourceType: this.resourceType,
      targetLanguage: this.targetLanguage,
      reviewerId
    });

  } catch (error) {
    logger.error('Failed to reject translation', {
      translationId: this._id,
      error: error.message
    });
    throw error;
  }
};

/**
 * Track usage of translation
 */
translationSchema.methods.trackUsage = async function(context) {
  try {
    this.usage.impressions += 1;
    this.usage.lastUsed = new Date();
    
    if (context && !this.usage.contexts.includes(context)) {
      this.usage.contexts.push(context);
    }

    await this.save();

  } catch (error) {
    logger.error('Failed to track translation usage', {
      translationId: this._id,
      error: error.message
    });
  }
};

// Pre-save middleware for validation
translationSchema.pre('save', function(next) {
  // Ensure source and target languages are different
  if (this.sourceLanguage === this.targetLanguage) {
    return next(new Error('Source and target languages must be different'));
  }

  // Auto-set quality score based on confidence and review status
  if (this.quality.reviewStatus === 'approved') {
    this.quality.qualityScore = Math.max(this.quality.qualityScore, 80);
  }

  next();
});

// Post-save middleware for audit logging
translationSchema.post('save', function(doc) {
  logger.info('Translation document saved', {
    translationId: doc._id,
    resourceType: doc.resourceType,
    targetLanguage: doc.targetLanguage,
    reviewStatus: doc.quality.reviewStatus,
    version: doc.version
  });
});

export default mongoose.models.Translation || mongoose.model('Translation', translationSchema);
