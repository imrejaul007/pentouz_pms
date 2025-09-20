import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     MessageTemplate:
 *       type: object
 *       required:
 *         - hotelId
 *         - name
 *         - type
 *         - subject
 *         - content
 *       properties:
 *         _id:
 *           type: string
 *         hotelId:
 *           type: string
 *           description: Hotel ID
 *         name:
 *           type: string
 *           description: Template name
 *         description:
 *           type: string
 *           description: Template description
 *         type:
 *           type: string
 *           enum: [email, sms, push, in_app, whatsapp]
 *           description: Template type
 *         category:
 *           type: string
 *           enum: [welcome, confirmation, reminder, follow_up, marketing, announcement, transactional]
 *           description: Template category
 *         subject:
 *           type: string
 *           description: Template subject
 *         content:
 *           type: string
 *           description: Template content
 *         htmlContent:
 *           type: string
 *           description: HTML version of content
 *         variables:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               required:
 *                 type: boolean
 *               defaultValue:
 *                 type: string
 *         isActive:
 *           type: boolean
 *           default: true
 *         version:
 *           type: number
 *           default: 1
 *         createdBy:
 *           type: string
 *           description: User who created the template
 *         lastModifiedBy:
 *           type: string
 *           description: User who last modified the template
 *         usageCount:
 *           type: number
 *           default: 0
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const messageTemplateSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required']
  },
  name: {
    type: String,
    required: [true, 'Template name is required'],
    trim: true,
    maxlength: [100, 'Template name cannot be more than 100 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  type: {
    type: String,
    enum: {
      values: ['email', 'sms', 'push', 'in_app', 'whatsapp'],
      message: 'Invalid template type'
    },
    required: [true, 'Template type is required']
  },
  category: {
    type: String,
    enum: {
      values: ['welcome', 'confirmation', 'reminder', 'follow_up', 'marketing', 'announcement', 'transactional'],
      message: 'Invalid template category'
    },
    required: [true, 'Template category is required']
  },
  subject: {
    type: String,
    required: [true, 'Template subject is required'],
    trim: true,
    maxlength: [200, 'Subject cannot be more than 200 characters']
  },
  content: {
    type: String,
    required: [true, 'Template content is required'],
    maxlength: [10000, 'Content cannot be more than 10000 characters']
  },
  htmlContent: {
    type: String,
    maxlength: [50000, 'HTML content cannot be more than 50000 characters']
  },
  plainTextContent: {
    type: String,
    maxlength: [10000, 'Plain text content cannot be more than 10000 characters']
  },
  variables: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    required: {
      type: Boolean,
      default: false
    },
    defaultValue: String,
    type: {
      type: String,
      enum: ['string', 'number', 'date', 'boolean', 'object'],
      default: 'string'
    },
    validation: {
      pattern: String,
      minLength: Number,
      maxLength: Number,
      min: Number,
      max: Number
    }
  }],
  design: {
    theme: {
      type: String,
      enum: ['default', 'modern', 'classic', 'minimal', 'luxury'],
      default: 'default'
    },
    colors: {
      primary: {
        type: String,
        default: '#007bff'
      },
      secondary: {
        type: String,
        default: '#6c757d'
      },
      background: {
        type: String,
        default: '#ffffff'
      },
      text: {
        type: String,
        default: '#212529'
      }
    },
    fonts: {
      heading: {
        type: String,
        default: 'Arial, sans-serif'
      },
      body: {
        type: String,
        default: 'Arial, sans-serif'
      }
    },
    layout: {
      type: String,
      enum: ['single_column', 'two_column', 'three_column', 'custom'],
      default: 'single_column'
    },
    headerImage: String,
    footerText: String
  },
  localization: [{
    language: {
      type: String,
      required: true
    },
    subject: {
      type: String,
      required: true
    },
    content: {
      type: String,
      required: true
    },
    htmlContent: String
  }],
  triggers: [{
    event: {
      type: String,
      enum: [
        'booking_confirmed', 'check_in', 'check_out', 'payment_received',
        'review_request', 'birthday', 'anniversary', 'loyalty_milestone',
        'booking_reminder', 'stay_feedback', 'marketing_campaign', 'custom'
      ],
      required: true
    },
    delay: {
      value: {
        type: Number,
        default: 0
      },
      unit: {
        type: String,
        enum: ['minutes', 'hours', 'days', 'weeks'],
        default: 'hours'
      }
    },
    conditions: [{
      field: String,
      operator: {
        type: String,
        enum: ['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'not_contains']
      },
      value: mongoose.Schema.Types.Mixed
    }]
  }],
  abTesting: {
    isEnabled: {
      type: Boolean,
      default: false
    },
    variants: [{
      name: {
        type: String,
        required: true
      },
      subject: String,
      content: String,
      htmlContent: String,
      weight: {
        type: Number,
        min: 0,
        max: 100,
        default: 50
      }
    }],
    winningCriteria: {
      type: String,
      enum: ['open_rate', 'click_rate', 'conversion_rate', 'revenue'],
      default: 'open_rate'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  version: {
    type: Number,
    default: 1
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Creator is required']
  },
  lastModifiedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  usageCount: {
    type: Number,
    default: 0
  },
  lastUsed: Date,
  performance: {
    totalSent: {
      type: Number,
      default: 0
    },
    totalOpens: {
      type: Number,
      default: 0
    },
    totalClicks: {
      type: Number,
      default: 0
    },
    avgOpenRate: {
      type: Number,
      default: 0
    },
    avgClickRate: {
      type: Number,
      default: 0
    },
    conversions: {
      type: Number,
      default: 0
    },
    revenue: {
      type: Number,
      default: 0
    }
  },
  approvalStatus: {
    type: String,
    enum: ['draft', 'pending_approval', 'approved', 'rejected'],
    default: 'draft'
  },
  approvedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  tags: [String],
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot be more than 1000 characters']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
messageTemplateSchema.index({ hotelId: 1, type: 1, category: 1 });
messageTemplateSchema.index({ createdBy: 1, createdAt: -1 });
messageTemplateSchema.index({ isActive: 1, approvalStatus: 1 });
messageTemplateSchema.index({ 'triggers.event': 1 });
messageTemplateSchema.index({ usageCount: -1 });

// Pre-save middleware
messageTemplateSchema.pre('save', function(next) {
  if (this.isModified('content') || this.isModified('subject')) {
    this.lastModifiedBy = this.createdBy; // This should be set by the route handler
    this.version += 1;
  }
  next();
});

// Virtual for variable names
messageTemplateSchema.virtual('variableNames').get(function() {
  return this.variables.map(v => v.name);
});

// Virtual for required variables
messageTemplateSchema.virtual('requiredVariables').get(function() {
  return this.variables.filter(v => v.required).map(v => v.name);
});

// Instance method to validate variables
messageTemplateSchema.methods.validateVariables = function(providedVariables) {
  const requiredVars = this.requiredVariables;
  const missingVars = requiredVars.filter(varName => !providedVariables.hasOwnProperty(varName));
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required variables: ${missingVars.join(', ')}`);
  }
  
  // Validate each variable according to its constraints
  const errors = [];
  this.variables.forEach(variable => {
    const value = providedVariables[variable.name];
    if (value !== undefined) {
      if (variable.validation) {
        const { pattern, minLength, maxLength, min, max } = variable.validation;
        
        if (pattern && typeof value === 'string') {
          const regex = new RegExp(pattern);
          if (!regex.test(value)) {
            errors.push(`Variable ${variable.name} does not match pattern`);
          }
        }
        
        if (minLength && typeof value === 'string' && value.length < minLength) {
          errors.push(`Variable ${variable.name} must be at least ${minLength} characters`);
        }
        
        if (maxLength && typeof value === 'string' && value.length > maxLength) {
          errors.push(`Variable ${variable.name} cannot exceed ${maxLength} characters`);
        }
        
        if (min !== undefined && typeof value === 'number' && value < min) {
          errors.push(`Variable ${variable.name} must be at least ${min}`);
        }
        
        if (max !== undefined && typeof value === 'number' && value > max) {
          errors.push(`Variable ${variable.name} cannot exceed ${max}`);
        }
      }
    }
  });
  
  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }
  
  return true;
};

// Instance method to render template
messageTemplateSchema.methods.render = function(variables = {}, language = 'en') {
  // Validate variables first
  this.validateVariables(variables);
  
  // Get localized content if available
  let subject = this.subject;
  let content = this.content;
  let htmlContent = this.htmlContent;
  
  if (language !== 'en') {
    const localization = this.localization.find(l => l.language === language);
    if (localization) {
      subject = localization.subject;
      content = localization.content;
      htmlContent = localization.htmlContent || this.htmlContent;
    }
  }
  
  // Merge with default values
  const mergedVariables = {};
  this.variables.forEach(variable => {
    mergedVariables[variable.name] = variables[variable.name] || variable.defaultValue || '';
  });
  
  // Replace variables in content
  const renderText = (text) => {
    let rendered = text;
    Object.keys(mergedVariables).forEach(varName => {
      const placeholder = `{{${varName}}}`;
      const value = mergedVariables[varName] || '';
      rendered = rendered.replace(new RegExp(placeholder, 'g'), value);
    });
    return rendered;
  };
  
  return {
    subject: renderText(subject),
    content: renderText(content),
    htmlContent: htmlContent ? renderText(htmlContent) : null
  };
};

// Instance method to create A/B test variant
messageTemplateSchema.methods.createABVariant = function(variantData) {
  if (!this.abTesting.isEnabled) {
    this.abTesting.isEnabled = true;
  }
  
  this.abTesting.variants.push(variantData);
  
  // Adjust weights to ensure they sum to 100
  const totalWeight = this.abTesting.variants.reduce((sum, v) => sum + v.weight, 0);
  if (totalWeight > 100) {
    const scaleFactor = 100 / totalWeight;
    this.abTesting.variants.forEach(variant => {
      variant.weight = Math.round(variant.weight * scaleFactor);
    });
  }
  
  return this.save();
};

// Instance method to increment usage count
messageTemplateSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  this.lastUsed = new Date();
  return this.save({ validateBeforeSave: false });
};

// Instance method to update performance metrics
messageTemplateSchema.methods.updatePerformance = function(metrics) {
  const { sent, opens, clicks, conversions, revenue } = metrics;
  
  this.performance.totalSent += sent || 0;
  this.performance.totalOpens += opens || 0;
  this.performance.totalClicks += clicks || 0;
  this.performance.conversions += conversions || 0;
  this.performance.revenue += revenue || 0;
  
  // Calculate averages
  if (this.performance.totalSent > 0) {
    this.performance.avgOpenRate = (this.performance.totalOpens / this.performance.totalSent) * 100;
    this.performance.avgClickRate = (this.performance.totalClicks / this.performance.totalSent) * 100;
  }
  
  return this.save({ validateBeforeSave: false });
};

// Instance method to clone template
messageTemplateSchema.methods.clone = function(newName, createdBy) {
  const clonedTemplate = new this.constructor({
    hotelId: this.hotelId,
    name: newName || `${this.name} (Copy)`,
    description: `Cloned from ${this.name}`,
    type: this.type,
    category: this.category,
    subject: this.subject,
    content: this.content,
    htmlContent: this.htmlContent,
    plainTextContent: this.plainTextContent,
    variables: this.variables,
    design: this.design,
    createdBy: createdBy,
    version: 1,
    usageCount: 0
  });
  
  return clonedTemplate.save();
};

// Static method to get popular templates
messageTemplateSchema.statics.getPopularTemplates = async function(hotelId, type, limit = 10) {
  const query = { hotelId, isActive: true };
  if (type) query.type = type;
  
  return await this.find(query)
    .sort('-usageCount -lastUsed')
    .limit(limit)
    .populate('createdBy', 'name')
    .select('name type category usageCount performance lastUsed');
};

// Static method to get templates by trigger
messageTemplateSchema.statics.getByTrigger = async function(hotelId, event) {
  return await this.find({
    hotelId,
    isActive: true,
    'triggers.event': event,
    approvalStatus: 'approved'
  }).populate('createdBy', 'name');
};

// Static method to get template performance
messageTemplateSchema.statics.getPerformanceStats = async function(hotelId, startDate, endDate) {
  const matchQuery = { hotelId };
  
  if (startDate && endDate) {
    matchQuery.lastUsed = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  return await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: {
          type: '$type',
          category: '$category'
        },
        totalTemplates: { $sum: 1 },
        totalUsage: { $sum: '$usageCount' },
        avgOpenRate: { $avg: '$performance.avgOpenRate' },
        avgClickRate: { $avg: '$performance.avgClickRate' },
        totalRevenue: { $sum: '$performance.revenue' }
      }
    },
    {
      $group: {
        _id: '$_id.type',
        stats: {
          $push: {
            category: '$_id.category',
            totalTemplates: '$totalTemplates',
            totalUsage: '$totalUsage',
            avgOpenRate: '$avgOpenRate',
            avgClickRate: '$avgClickRate',
            totalRevenue: '$totalRevenue'
          }
        }
      }
    }
  ]);
};

export default mongoose.model('MessageTemplate', messageTemplateSchema);
