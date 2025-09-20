import mongoose from 'mongoose';

/**
 * Bill Message Model
 * 
 * Manages custom message templates for POS bills including:
 * - Message types: header, footer, promotional, thank you, terms
 * - Template variables and dynamic content
 * - Multi-language support
 * - Message scheduling and conditions
 */

const messageVariableSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  defaultValue: String,
  isRequired: {
    type: Boolean,
    default: false
  },
  dataType: {
    type: String,
    enum: ['TEXT', 'NUMBER', 'DATE', 'CURRENCY', 'BOOLEAN'],
    default: 'TEXT'
  }
}, { _id: false });

const messageConditionSchema = new mongoose.Schema({
  field: {
    type: String,
    required: true
  },
  operator: {
    type: String,
    enum: ['EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'LESS_THAN', 'CONTAINS', 'NOT_CONTAINS', 'IS_EMPTY', 'IS_NOT_EMPTY'],
    required: true
  },
  value: mongoose.Schema.Types.Mixed,
  logicOperator: {
    type: String,
    enum: ['AND', 'OR'],
    default: 'AND'
  }
}, { _id: false });

const billMessageSchema = new mongoose.Schema({
  // Standard fields
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Message identification
  messageId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: String,

  // Message classification
  messageType: {
    type: String,
    enum: [
      'HEADER',           // Header message at top of bill
      'FOOTER',           // Footer message at bottom of bill
      'PROMOTIONAL',      // Promotional messages
      'THANK_YOU',        // Thank you messages
      'TERMS_CONDITIONS', // Terms and conditions
      'DISCLAIMER',       // Legal disclaimers
      'CONTACT_INFO',     // Contact information
      'SOCIAL_MEDIA',     // Social media links
      'CUSTOM'            // Custom message types
    ],
    required: true,
    index: true
  },

  // Message content
  content: {
    type: String,
    required: true,
    trim: true
  },
  htmlContent: {
    type: String,
    trim: true
  },

  // Template variables
  variables: [messageVariableSchema],

  // Display configuration
  displayConfig: {
    position: {
      type: String,
      enum: ['TOP', 'BOTTOM', 'CENTER', 'CUSTOM'],
      default: 'BOTTOM'
    },
    alignment: {
      type: String,
      enum: ['LEFT', 'CENTER', 'RIGHT', 'JUSTIFY'],
      default: 'CENTER'
    },
    fontSize: {
      type: String,
      enum: ['SMALL', 'MEDIUM', 'LARGE', 'EXTRA_LARGE'],
      default: 'MEDIUM'
    },
    fontWeight: {
      type: String,
      enum: ['NORMAL', 'BOLD', 'LIGHT'],
      default: 'NORMAL'
    },
    color: String,
    backgroundColor: String,
    border: {
      enabled: {
        type: Boolean,
        default: false
      },
      style: {
        type: String,
        enum: ['SOLID', 'DASHED', 'DOTTED'],
        default: 'SOLID'
      },
      width: {
        type: Number,
        default: 1
      },
      color: String
    },
    padding: {
      top: { type: Number, default: 0 },
      right: { type: Number, default: 0 },
      bottom: { type: Number, default: 0 },
      left: { type: Number, default: 0 }
    },
    margin: {
      top: { type: Number, default: 0 },
      right: { type: Number, default: 0 },
      bottom: { type: Number, default: 0 },
      left: { type: Number, default: 0 }
    }
  },

  // Message conditions
  conditions: {
    enabled: {
      type: Boolean,
      default: false
    },
    rules: [messageConditionSchema],
    logicOperator: {
      type: String,
      enum: ['AND', 'OR'],
      default: 'AND'
    }
  },

  // Scheduling
  scheduling: {
    enabled: {
      type: Boolean,
      default: false
    },
    validFrom: {
      type: Date,
      default: Date.now
    },
    validTo: {
      type: Date,
      validate: {
        validator: function(value) {
          return !value || value > this.scheduling.validFrom;
        },
        message: 'Valid to date must be after valid from date'
      }
    },
    timeSlots: [{
      dayOfWeek: {
        type: Number,
        min: 0,
        max: 6 // 0 = Sunday, 6 = Saturday
      },
      startTime: String, // HH:MM format
      endTime: String,   // HH:MM format
      isActive: {
        type: Boolean,
        default: true
      }
    }],
    frequency: {
      type: String,
      enum: ['ALWAYS', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'],
      default: 'ALWAYS'
    }
  },

  // Language and localization
  localization: {
    language: {
      type: String,
      default: 'en',
      index: true
    },
    region: {
      type: String,
      default: 'US'
    },
    translations: [{
      language: {
        type: String,
        required: true
      },
      content: {
        type: String,
        required: true
      },
      htmlContent: String,
      title: String
    }]
  },

  // Message status and validity
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isSystemMessage: {
    type: Boolean,
    default: false // System messages cannot be deleted
  },
  priority: {
    type: Number,
    default: 100,
    min: 1,
    max: 1000
  },

  // Usage tracking
  usageCount: {
    type: Number,
    default: 0
  },
  lastUsed: Date,

  // Category and sorting
  category: {
    type: String,
    enum: [
      'STANDARD',      // Standard bill messages
      'PROMOTIONAL',   // Promotional content
      'LEGAL',         // Legal disclaimers
      'CONTACT',       // Contact information
      'SOCIAL',        // Social media
      'CUSTOM'         // Custom categories
    ],
    default: 'STANDARD'
  },
  sortOrder: {
    type: Number,
    default: 0
  },

  // Integration settings
  posIntegration: {
    applicableOutlets: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'POSOutlet'
    }],
    applicableCategories: [{
      type: String,
      enum: ['FOOD', 'BEVERAGE', 'SERVICE', 'PRODUCT', 'ALCOHOL', 'TOBACCO', 'LUXURY', 'GENERAL']
    }],
    minOrderAmount: {
      type: Number,
      default: 0
    },
    maxOrderAmount: {
      type: Number,
      default: null
    },
    customerTypes: [{
      type: String,
      enum: ['guest', 'corporate', 'staff', 'walk_in', 'vip']
    }]
  },

  // Metadata
  metadata: {
    tags: [String],
    notes: String,
    customFields: mongoose.Schema.Types.Mixed,
    version: {
      type: Number,
      default: 1
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
billMessageSchema.index({ hotelId: 1, messageType: 1, isActive: 1 });
billMessageSchema.index({ hotelId: 1, category: 1, sortOrder: 1 });
billMessageSchema.index({ hotelId: 1, 'localization.language': 1, isActive: 1 });
billMessageSchema.index({ 'scheduling.validFrom': 1, 'scheduling.validTo': 1 });

// Virtual for formatted display
billMessageSchema.virtual('formattedDisplay').get(function() {
  return `${this.title} (${this.messageType})`;
});

// Virtual for current validity
billMessageSchema.virtual('isCurrentlyValid').get(function() {
  if (!this.isActive) return false;
  
  const now = new Date();
  if (this.scheduling.enabled) {
    if (now < this.scheduling.validFrom) return false;
    if (this.scheduling.validTo && now > this.scheduling.validTo) return false;
  }
  
  return true;
});

// Virtual for processed content
billMessageSchema.virtual('processedContent').get(function() {
  let content = this.content;
  
  // Replace variables with placeholders
  if (this.variables && this.variables.length > 0) {
    this.variables.forEach(variable => {
      const placeholder = `{{${variable.name}}}`;
      const value = variable.defaultValue || `[${variable.name}]`;
      content = content.replace(new RegExp(placeholder, 'g'), value);
    });
  }
  
  return content;
});

// Pre-save middleware to generate messageId if not provided
billMessageSchema.pre('save', async function(next) {
  if (!this.messageId) {
    const prefix = this.messageType.substring(0, 3).toUpperCase();
    const count = await this.constructor.countDocuments({
      messageId: new RegExp(`^${prefix}`)
    });
    this.messageId = `${prefix}${(count + 1).toString().padStart(3, '0')}`;
  }
  next();
});

// Static method to get messages by type
billMessageSchema.statics.getMessagesByType = function(hotelId, messageType, options = {}) {
  const query = {
    hotelId,
    messageType,
    isActive: true
  };

  if (options.language) {
    query['localization.language'] = options.language;
  }

  if (options.outletId) {
    query.$or = [
      { 'posIntegration.applicableOutlets': { $size: 0 } },
      { 'posIntegration.applicableOutlets': options.outletId }
    ];
  }

  return this.find(query)
    .sort({ priority: 1, sortOrder: 1, createdAt: 1 })
    .populate('createdBy updatedBy', 'firstName lastName email');
};

// Static method to get active messages for bill generation
billMessageSchema.statics.getActiveMessagesForBill = function(hotelId, context = {}) {
  const now = new Date();
  const query = {
    hotelId,
    isActive: true,
    $or: [
      { 'scheduling.enabled': false },
      {
        'scheduling.enabled': true,
        'scheduling.validFrom': { $lte: now },
        $or: [
          { 'scheduling.validTo': { $exists: false } },
          { 'scheduling.validTo': null },
          { 'scheduling.validTo': { $gte: now } }
        ]
      }
    ]
  };

  if (context.outletId) {
    query.$and = [
      query,
      {
        $or: [
          { 'posIntegration.applicableOutlets': { $size: 0 } },
          { 'posIntegration.applicableOutlets': context.outletId }
        ]
      }
    ];
  }

  if (context.language) {
    query['localization.language'] = context.language;
  }

  return this.find(query)
    .sort({ messageType: 1, priority: 1, sortOrder: 1 })
    .populate('createdBy updatedBy', 'firstName lastName email');
};

// Instance method to process message with context
billMessageSchema.methods.processMessage = function(context = {}) {
  let content = this.content;
  
  // Replace variables with actual values from context
  if (this.variables && this.variables.length > 0) {
    this.variables.forEach(variable => {
      const placeholder = `{{${variable.name}}}`;
      const value = context[variable.name] || variable.defaultValue || `[${variable.name}]`;
      content = content.replace(new RegExp(placeholder, 'g'), value);
    });
  }
  
  // Apply date formatting
  const now = new Date();
  content = content.replace(/\{\{current_date\}\}/g, now.toLocaleDateString());
  content = content.replace(/\{\{current_time\}\}/g, now.toLocaleTimeString());
  content = content.replace(/\{\{current_datetime\}\}/g, now.toLocaleString());
  
  return content;
};

// Instance method to check if message should be displayed
billMessageSchema.methods.shouldDisplay = function(context = {}) {
  if (!this.isCurrentlyValid) return false;
  
  // Check conditions
  if (this.conditions.enabled && this.conditions.rules.length > 0) {
    const results = this.conditions.rules.map(rule => {
      const value = context[rule.field];
      
      switch (rule.operator) {
        case 'EQUALS':
          return value === rule.value;
        case 'NOT_EQUALS':
          return value !== rule.value;
        case 'GREATER_THAN':
          return parseFloat(value) > parseFloat(rule.value);
        case 'LESS_THAN':
          return parseFloat(value) < parseFloat(rule.value);
        case 'CONTAINS':
          return value && value.toString().includes(rule.value);
        case 'NOT_CONTAINS':
          return !value || !value.toString().includes(rule.value);
        case 'IS_EMPTY':
          return !value || value === '';
        case 'IS_NOT_EMPTY':
          return value && value !== '';
        default:
          return true;
      }
    });
    
    const logicOperator = this.conditions.logicOperator;
    const conditionMet = logicOperator === 'AND' 
      ? results.every(result => result)
      : results.some(result => result);
    
    if (!conditionMet) return false;
  }
  
  // Check scheduling
  if (this.scheduling.enabled) {
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.toTimeString().substring(0, 5);
    
    const activeTimeSlot = this.scheduling.timeSlots.find(slot => 
      slot.dayOfWeek === currentDay && 
      slot.isActive &&
      currentTime >= slot.startTime && 
      currentTime <= slot.endTime
    );
    
    if (!activeTimeSlot) return false;
  }
  
  return true;
};

// Instance method to update usage statistics
billMessageSchema.methods.updateUsage = function() {
  this.usageCount += 1;
  this.lastUsed = new Date();
  return this.save();
};

// Instance method to get translation
billMessageSchema.methods.getTranslation = function(language) {
  if (!language || language === this.localization.language) {
    return {
      content: this.content,
      htmlContent: this.htmlContent,
      title: this.title
    };
  }
  
  const translation = this.localization.translations.find(t => t.language === language);
  if (translation) {
    return {
      content: translation.content,
      htmlContent: translation.htmlContent,
      title: translation.title || this.title
    };
  }
  
  // Fallback to default language
  return {
    content: this.content,
    htmlContent: this.htmlContent,
    title: this.title
  };
};

export default mongoose.model('BillMessage', billMessageSchema);
