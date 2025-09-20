import mongoose from 'mongoose';
import logger from '../utils/logger.js';

/**
 * Content Schema
 * 
 * Manages structured multilingual content for the hotel system.
 * Handles templates, snippets, and reusable content blocks with built-in translation support.
 */
const contentSchema = new mongoose.Schema({
  // Content identification
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(key) {
        // Validate key format: namespace.category.item (e.g., hotel.amenities.pool)
        return /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/.test(key);
      },
      message: 'Content key must follow format: namespace.category.item (lowercase, underscore allowed)'
    }
  },

  // Content categorization
  namespace: {
    type: String,
    required: true,
    enum: [
      'hotel', 'room', 'amenity', 'service', 'policy', 'email', 'sms', 
      'ui', 'form', 'error', 'notification', 'marketing', 'legal'
    ],
    index: true
  },

  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },

  subcategory: {
    type: String,
    trim: true,
    maxlength: 50
  },

  // Content metadata
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },

  description: {
    type: String,
    trim: true,
    maxlength: 500
  },

  // Content structure
  contentType: {
    type: String,
    enum: ['text', 'html', 'markdown', 'template', 'json', 'list'],
    default: 'text'
  },

  // Default content (usually in base language)
  defaultContent: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },

  // Base language for the content
  baseLanguage: {
    type: String,
    required: true,
    uppercase: true,
    default: 'EN',
    ref: 'Language'
  },

  // Translation configuration
  translationConfig: {
    isTranslatable: {
      type: Boolean,
      default: true
    },

    autoTranslate: {
      type: Boolean,
      default: false
    },

    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },

    // Fields that should not be translated (for complex content)
    excludeFields: [String],

    // Translation quality requirements
    qualityThreshold: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.8
    },

    requireReview: {
      type: Boolean,
      default: true
    }
  },

  // Content variations for different contexts
  variations: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    
    description: String,

    // Context where this variation is used
    context: {
      channel: {
        type: String,
        enum: ['website', 'mobile_app', 'email', 'sms', 'ota', 'kiosk', 'staff_interface']
      },
      audience: {
        type: String,
        enum: ['guest', 'staff', 'admin', 'public', 'member']
      },
      formality: {
        type: String,
        enum: ['formal', 'casual', 'friendly', 'professional']
      }
    },

    content: mongoose.Schema.Types.Mixed,
    isActive: { type: Boolean, default: true }
  }],

  // Template variables (for dynamic content)
  variables: [{
    name: {
      type: String,
      required: true,
      validate: {
        validator: function(name) {
          return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(name);
        },
        message: 'Variable name must start with letter and contain only letters, numbers, and underscores'
      }
    },
    
    type: {
      type: String,
      enum: ['string', 'number', 'date', 'boolean', 'object'],
      default: 'string'
    },

    description: String,

    required: { type: Boolean, default: false },

    defaultValue: mongoose.Schema.Types.Mixed,

    // Validation rules for the variable
    validation: {
      minLength: Number,
      maxLength: Number,
      pattern: String,
      enum: [String]
    },

    // Formatting options
    formatting: {
      dateFormat: String,
      numberFormat: String,
      transform: {
        type: String,
        enum: ['uppercase', 'lowercase', 'capitalize', 'title']
      }
    }
  }],

  // Usage tracking
  usage: {
    totalViews: { type: Number, default: 0 },
    totalTranslations: { type: Number, default: 0 },
    lastUsed: Date,
    
    // Popular contexts where this content is used
    contexts: [{
      name: String,
      count: Number,
      lastUsed: Date
    }],

    // Languages this content has been translated to
    languages: [{
      code: {
        type: String,
        ref: 'Language'
      },
      status: {
        type: String,
        enum: ['pending', 'translated', 'approved', 'published']
      },
      lastUpdated: Date,
      version: Number
    }]
  },

  // Content lifecycle
  status: {
    type: String,
    enum: ['draft', 'review', 'approved', 'published', 'archived'],
    default: 'draft',
    index: true
  },

  // Publishing information
  publishing: {
    publishedAt: Date,
    
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },

    // Scheduled publishing
    scheduledFor: Date,

    expiresAt: Date,

    // Version control
    version: {
      type: Number,
      default: 1,
      min: 1
    },

    changelog: [{
      version: Number,
      changes: String,
      changedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      changedAt: {
        type: Date,
        default: Date.now
      }
    }]
  },

  // Access control
  permissions: {
    view: [{
      type: String,
      enum: ['admin', 'content_manager', 'translator', 'reviewer', 'staff']
    }],

    edit: [{
      type: String,
      enum: ['admin', 'content_manager']
    }],

    translate: [{
      type: String,
      enum: ['admin', 'content_manager', 'translator']
    }],

    approve: [{
      type: String,
      enum: ['admin', 'content_manager', 'reviewer']
    }]
  },

  // Tags for organization and search
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],

  // Metadata
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

  isSystem: {
    type: Boolean,
    default: false // System content cannot be deleted
  },

  // Creation and modification tracking
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

// Indexes
contentSchema.index({ key: 1, isActive: 1 });
contentSchema.index({ namespace: 1, category: 1, isActive: 1 });
contentSchema.index({ status: 1, isActive: 1 });
contentSchema.index({ 'translationConfig.isTranslatable': 1, isActive: 1 });
contentSchema.index({ tags: 1, isActive: 1 });
contentSchema.index({ createdAt: -1 });

// Virtual for full namespace path
contentSchema.virtual('fullPath').get(function() {
  return `${this.namespace}.${this.category}${this.subcategory ? '.' + this.subcategory : ''}`;
});

// Virtual for translation completeness
contentSchema.virtual('translationCompleteness').get(function() {
  if (!this.usage.languages || this.usage.languages.length === 0) return 0;
  
  const published = this.usage.languages.filter(lang => lang.status === 'published').length;
  return Math.round((published / this.usage.languages.length) * 100);
});

// Static methods

/**
 * Get content by key with optional language
 */
contentSchema.statics.getByKey = async function(key, language = null, options = {}) {
  try {
    const content = await this.findOne({
      key: key.toLowerCase(),
      isActive: true,
      status: options.includeDrafts ? { $in: ['draft', 'published'] } : 'published'
    });

    if (!content) return null;

    // Track usage
    if (!options.skipUsageTracking) {
      content.usage.totalViews += 1;
      content.usage.lastUsed = new Date();
      await content.save();
    }

    return content;

  } catch (error) {
    logger.error('Failed to get content by key', { key, error: error.message });
    throw error;
  }
};

/**
 * Get content by namespace/category
 */
contentSchema.statics.getByNamespace = async function(namespace, category = null, options = {}) {
  try {
    const query = {
      namespace,
      isActive: true,
      status: options.includeDrafts ? { $in: ['draft', 'published'] } : 'published'
    };

    if (category) {
      query.category = category;
    }

    const sort = options.sortBy || { category: 1, key: 1 };
    const limit = options.limit || 100;

    return await this.find(query)
      .sort(sort)
      .limit(limit)
      .select(options.fields || '-__v');

  } catch (error) {
    logger.error('Failed to get content by namespace', { namespace, category, error: error.message });
    throw error;
  }
};

/**
 * Search content
 */
contentSchema.statics.searchContent = async function(searchTerm, options = {}) {
  try {
    const query = {
      isActive: true,
      status: options.includeDrafts ? { $in: ['draft', 'published'] } : 'published'
    };

    // Text search
    if (searchTerm) {
      query.$or = [
        { key: { $regex: searchTerm, $options: 'i' } },
        { title: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
        { tags: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    // Apply filters
    if (options.namespace) query.namespace = options.namespace;
    if (options.category) query.category = options.category;
    if (options.tags && options.tags.length > 0) query.tags = { $in: options.tags };
    if (options.contentType) query.contentType = options.contentType;

    const sort = options.sortBy || { updatedAt: -1 };
    const limit = options.limit || 50;
    const skip = options.skip || 0;

    return await this.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('createdBy updatedBy', 'name email')
      .select(options.fields || '-__v');

  } catch (error) {
    logger.error('Content search failed', { searchTerm, error: error.message });
    throw error;
  }
};

/**
 * Get translatable content
 */
contentSchema.statics.getTranslatableContent = async function(options = {}) {
  try {
    const query = {
      'translationConfig.isTranslatable': true,
      isActive: true,
      status: 'published'
    };

    if (options.priority) {
      query['translationConfig.priority'] = options.priority;
    }

    if (options.autoTranslate !== undefined) {
      query['translationConfig.autoTranslate'] = options.autoTranslate;
    }

    return await this.find(query)
      .sort({ 'translationConfig.priority': -1, updatedAt: -1 })
      .limit(options.limit || 100);

  } catch (error) {
    logger.error('Failed to get translatable content', { error: error.message });
    throw error;
  }
};

// Instance methods

/**
 * Render content with variables
 */
contentSchema.methods.render = function(variables = {}, variation = null) {
  try {
    let content = variation ? 
      this.variations.find(v => v.name === variation)?.content || this.defaultContent :
      this.defaultContent;

    // Handle different content types
    switch (this.contentType) {
      case 'template':
        // Simple template variable replacement
        if (typeof content === 'string') {
          content = content.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
            return variables[varName] !== undefined ? variables[varName] : match;
          });
        }
        break;

      case 'json':
        // Deep variable replacement in JSON content
        if (typeof content === 'object') {
          content = this.replaceVariablesInObject(content, variables);
        }
        break;

      case 'list':
        // Handle list content with variables
        if (Array.isArray(content)) {
          content = content.map(item => 
            typeof item === 'string' ? 
              item.replace(/\{\{(\w+)\}\}/g, (match, varName) => variables[varName] || match) :
              item
          );
        }
        break;
    }

    return content;

  } catch (error) {
    logger.error('Failed to render content', { 
      contentKey: this.key,
      error: error.message 
    });
    return this.defaultContent;
  }
};

/**
 * Helper method to replace variables in nested objects
 */
contentSchema.methods.replaceVariablesInObject = function(obj, variables) {
  if (typeof obj === 'string') {
    return obj.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      return variables[varName] !== undefined ? variables[varName] : match;
    });
  }

  if (Array.isArray(obj)) {
    return obj.map(item => this.replaceVariablesInObject(item, variables));
  }

  if (typeof obj === 'object' && obj !== null) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = this.replaceVariablesInObject(value, variables);
    }
    return result;
  }

  return obj;
};

/**
 * Update translation status for a language
 */
contentSchema.methods.updateLanguageStatus = async function(languageCode, status) {
  try {
    const langIndex = this.usage.languages.findIndex(lang => lang.code === languageCode);
    
    if (langIndex >= 0) {
      this.usage.languages[langIndex].status = status;
      this.usage.languages[langIndex].lastUpdated = new Date();
    } else {
      this.usage.languages.push({
        code: languageCode,
        status,
        lastUpdated: new Date(),
        version: 1
      });
    }

    await this.save();

    logger.info('Content language status updated', {
      contentKey: this.key,
      language: languageCode,
      status
    });

  } catch (error) {
    logger.error('Failed to update language status', {
      contentKey: this.key,
      language: languageCode,
      error: error.message
    });
    throw error;
  }
};

/**
 * Create new version
 */
contentSchema.methods.createVersion = async function(changes, userId) {
  try {
    // Add to changelog
    this.publishing.changelog.push({
      version: this.publishing.version + 1,
      changes,
      changedBy: userId,
      changedAt: new Date()
    });

    this.publishing.version += 1;
    this.updatedBy = userId;
    this.status = 'review'; // Reset to review status

    await this.save();

    logger.info('New content version created', {
      contentKey: this.key,
      version: this.publishing.version,
      userId
    });

    return this.publishing.version;

  } catch (error) {
    logger.error('Failed to create content version', {
      contentKey: this.key,
      error: error.message
    });
    throw error;
  }
};

/**
 * Publish content
 */
contentSchema.methods.publish = async function(userId) {
  try {
    this.status = 'published';
    this.publishing.publishedAt = new Date();
    this.publishing.publishedBy = userId;
    this.updatedBy = userId;

    await this.save();

    logger.info('Content published', {
      contentKey: this.key,
      version: this.publishing.version,
      userId
    });

  } catch (error) {
    logger.error('Failed to publish content', {
      contentKey: this.key,
      error: error.message
    });
    throw error;
  }
};

// Pre-save middleware
contentSchema.pre('save', function(next) {
  // Ensure key matches namespace.category pattern
  if (this.isModified('key') || this.isModified('namespace') || this.isModified('category')) {
    const expectedPrefix = `${this.namespace}.${this.category}`;
    if (!this.key.startsWith(expectedPrefix)) {
      this.key = `${expectedPrefix}.${this.key.split('.').pop()}`;
    }
  }

  next();
});

// Post-save middleware for audit logging
contentSchema.post('save', function(doc) {
  logger.info('Content document saved', {
    contentKey: doc.key,
    namespace: doc.namespace,
    status: doc.status,
    version: doc.publishing.version
  });
});

export default mongoose.models.Content || mongoose.model('Content', contentSchema);
