import mongoose from 'mongoose';

const fieldValidationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      'required', 'min_length', 'max_length', 'min_value', 'max_value',
      'email', 'phone', 'url', 'date', 'regex', 'custom'
    ],
    required: true
  },
  value: mongoose.Schema.Types.Mixed, // Can be number, string, etc.
  message: String // Custom error message
}, { _id: false });

const conditionalLogicSchema = new mongoose.Schema({
  condition: {
    field: {
      type: String,
      required: true
    },
    operator: {
      type: String,
      enum: ['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'in', 'not_in'],
      required: true
    },
    value: mongoose.Schema.Types.Mixed
  },
  action: {
    type: {
      type: String,
      enum: ['show', 'hide', 'enable', 'disable', 'set_value', 'set_required'],
      required: true
    },
    target: String, // Target field ID
    value: mongoose.Schema.Types.Mixed // Value to set if action is set_value
  }
}, { _id: false });

const formFieldSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: [
      'text', 'email', 'tel', 'phone', 'number', 'date', 'datetime', 'time',
      'textarea', 'select', 'multiselect', 'checkbox', 'radio', 'file',
      'password', 'url', 'color', 'range', 'hidden', 'divider', 'heading', 'html', 'section'
    ],
    required: true
  },
  label: String,
  placeholder: String,
  defaultValue: mongoose.Schema.Types.Mixed,
  helpText: String,
  
  // Field properties
  required: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  readonly: {
    type: Boolean,
    default: false
  },
  hidden: {
    type: Boolean,
    default: false
  },
  
  // Options for select, radio, checkbox fields
  options: [{
    label: String,
    value: String,
    selected: Boolean
  }],
  
  // File upload specific
  fileTypes: [String], // ['pdf', 'jpg', 'png']
  maxFileSize: Number, // in bytes
  maxFiles: Number,
  
  // Number/range specific
  min: Number,
  max: Number,
  step: Number,
  
  // Text specific
  minLength: Number,
  maxLength: Number,
  pattern: String, // regex pattern
  
  // Layout and styling
  width: {
    type: String,
    enum: ['25', '33', '50', '66', '75', '100'],
    default: '100'
  },
  cssClasses: String,
  
  // Validation rules
  validation: [fieldValidationSchema],
  
  // Conditional logic
  conditionalLogic: [conditionalLogicSchema],
  
  // Field order
  order: {
    type: Number,
    required: true
  },
  
  // Grouping
  group: String, // Group fields together
  
  // Multi-language support
  translations: {
    type: Map,
    of: {
      label: String,
      placeholder: String,
      helpText: String,
      options: [{
        label: String,
        value: String
      }]
    }
  }
}, { _id: false });

const formStylingSchema = new mongoose.Schema({
  theme: {
    colors: {
      primary: {
        type: String,
        default: '#3b82f6'
      },
      secondary: {
        type: String,
        default: '#64748b'
      },
      accent: {
        type: String,
        default: '#06b6d4'
      },
      background: {
        type: String,
        default: '#ffffff'
      },
      text: {
        type: String,
        default: '#1f2937'
      },
      error: {
        type: String,
        default: '#ef4444'
      }
    },
    fonts: {
      heading: {
        type: String,
        default: 'Inter, sans-serif'
      },
      body: {
        type: String,
        default: 'Inter, sans-serif'
      }
    },
    spacing: {
      small: {
        type: String,
        default: '0.5rem'
      },
      medium: {
        type: String,
        default: '1rem'
      },
      large: {
        type: String,
        default: '2rem'
      }
    }
  },
  layout: {
    maxWidth: {
      type: String,
      default: '600px'
    },
    padding: {
      type: String,
      default: '2rem'
    },
    borderRadius: {
      type: String,
      default: '0.5rem'
    },
    boxShadow: {
      type: String,
      default: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
    }
  },
  fields: {
    height: {
      type: String,
      default: '2.5rem'
    },
    borderRadius: {
      type: String,
      default: '0.375rem'
    },
    borderWidth: {
      type: String,
      default: '1px'
    },
    borderColor: {
      type: String,
      default: '#d1d5db'
    },
    focusBorderColor: {
      type: String,
      default: '#3b82f6'
    },
    backgroundColor: {
      type: String,
      default: '#ffffff'
    }
  },
  buttons: {
    height: {
      type: String,
      default: '2.5rem'
    },
    borderRadius: {
      type: String,
      default: '0.375rem'
    },
    fontSize: {
      type: String,
      default: '0.875rem'
    },
    fontWeight: {
      type: String,
      default: '500'
    }
  }
}, { _id: false });

const formSettingsSchema = new mongoose.Schema({
  submitUrl: String,
  method: {
    type: String,
    enum: ['POST', 'GET'],
    default: 'POST'
  },
  redirectUrl: String,
  successMessage: {
    type: String,
    default: 'Thank you! Your form has been submitted successfully.'
  },
  errorMessage: {
    type: String,
    default: 'There was an error submitting your form. Please try again.'
  },
  enableProgressBar: {
    type: Boolean,
    default: false
  },
  enableSaveProgress: {
    type: Boolean,
    default: false
  },
  allowFileUploads: {
    type: Boolean,
    default: false
  },
  maxFileSize: {
    type: Number,
    default: 5242880 // 5MB
  },
  allowedFileTypes: {
    type: [String],
    default: ['image/jpeg', 'image/png', 'application/pdf']
  },
  enableCaptcha: {
    type: Boolean,
    default: false
  },
  captchaProvider: {
    type: String,
    enum: ['recaptcha', 'hcaptcha'],
    default: 'recaptcha'
  },
  captchaSiteKey: String,
  enableAnalytics: {
    type: Boolean,
    default: true
  },
  gtmId: String,
  customCSS: String,
  customJS: String,
  // Keep some backward compatibility fields
  submitButtonText: {
    type: String,
    default: 'Submit'
  },
  emailNotifications: {
    enabled: {
      type: Boolean,
      default: true
    },
    recipientEmails: [String],
    subject: String,
    template: String
  },
  autoResponder: {
    enabled: {
      type: Boolean,
      default: false
    },
    subject: String,
    template: String
  },
  saveToDatabase: {
    type: Boolean,
    default: true
  },
  requireCaptcha: {
    type: Boolean,
    default: false
  },
  allowDrafts: {
    type: Boolean,
    default: false
  },
  maxSubmissions: {
    total: Number,
    perUser: Number,
    perDay: Number
  }
}, { _id: false });

const bookingFormTemplateSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    required: true,
    index: true
  },
  
  // Basic template information
  name: {
    type: String,
    required: true,
    maxlength: 200
  },
  description: String,
  category: {
    type: String,
    enum: ['booking', 'inquiry', 'registration', 'survey', 'custom'],
    default: 'booking'
  },
  
  // Form structure
  fields: [formFieldSchema],
  
  // Form styling and layout
  styling: formStylingSchema,
  
  // Form behavior settings
  settings: formSettingsSchema,
  
  // Version control
  version: {
    type: String,
    default: '1.0.0'
  },
  parentVersion: {
    type: mongoose.Schema.ObjectId,
    ref: 'BookingFormTemplate'
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  publishedAt: Date,
  
  // A/B Testing
  abTest: {
    isEnabled: {
      type: Boolean,
      default: false
    },
    testName: String,
    variants: [{
      name: String,
      percentage: Number,
      formData: mongoose.Schema.Types.Mixed // Complete form configuration for this variant
    }],
    startDate: Date,
    endDate: Date,
    winningVariant: String
  },
  
  // Analytics and usage
  usage: {
    views: {
      type: Number,
      default: 0
    },
    submissions: {
      type: Number,
      default: 0
    },
    conversionRate: {
      type: Number,
      default: 0
    },
    lastUsed: Date
  },
  
  // Multi-language support
  languages: [{
    code: String,
    name: String,
    isDefault: Boolean,
    settings: {
      submitButtonText: String,
      successMessage: String,
      errorMessage: String
    }
  }],
  
  // Template status
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  tags: [String],
  
  // SEO and metadata
  metadata: {
    title: String,
    description: String,
    keywords: [String],
    canonicalUrl: String
  },
  
  // Integration settings
  integrations: {
    pms: {
      enabled: {
        type: Boolean,
        default: true
      },
      mapping: {
        type: Map,
        of: String // Maps form fields to PMS fields
      }
    },
    crm: {
      enabled: {
        type: Boolean,
        default: false
      },
      provider: String,
      mapping: {
        type: Map,
        of: String
      }
    },
    emailMarketing: {
      enabled: {
        type: Boolean,
        default: false
      },
      provider: String,
      listId: String
    }
  },
  
  // Audit fields
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
bookingFormTemplateSchema.index({ hotelId: 1, status: 1 });
bookingFormTemplateSchema.index({ name: 1 });
bookingFormTemplateSchema.index({ category: 1 });
bookingFormTemplateSchema.index({ isPublished: 1 });
bookingFormTemplateSchema.index({ 'usage.conversionRate': -1 });
bookingFormTemplateSchema.index({ updatedAt: -1 });

// Compound indexes
bookingFormTemplateSchema.index({ hotelId: 1, isPublished: 1, status: 1 });
bookingFormTemplateSchema.index({ hotelId: 1, category: 1, status: 1 });

// Virtual for field count
bookingFormTemplateSchema.virtual('fieldCount').get(function() {
  return this.fields ? this.fields.length : 0;
});

// Virtual for required fields count
bookingFormTemplateSchema.virtual('requiredFieldCount').get(function() {
  return this.fields ? this.fields.filter(field => field.required).length : 0;
});

// Virtual for conversion rate calculation
bookingFormTemplateSchema.virtual('calculatedConversionRate').get(function() {
  if (this.usage.views === 0) return 0;
  return Math.round((this.usage.submissions / this.usage.views) * 100 * 100) / 100;
});

// Virtual for template URL
bookingFormTemplateSchema.virtual('templateUrl').get(function() {
  return `/booking-forms/${this._id}`;
});

// Instance methods
bookingFormTemplateSchema.methods.getFieldById = function(fieldId) {
  return this.fields.find(field => field.id === fieldId);
};

bookingFormTemplateSchema.methods.addField = function(fieldData) {
  const maxOrder = Math.max(...this.fields.map(f => f.order), 0);
  const newField = {
    ...fieldData,
    order: maxOrder + 1
  };
  this.fields.push(newField);
  return newField;
};

bookingFormTemplateSchema.methods.removeField = function(fieldId) {
  this.fields = this.fields.filter(field => field.id !== fieldId);
  // Reorder remaining fields
  this.fields.forEach((field, index) => {
    field.order = index + 1;
  });
};

bookingFormTemplateSchema.methods.reorderFields = function(fieldOrder) {
  fieldOrder.forEach((fieldId, index) => {
    const field = this.getFieldById(fieldId);
    if (field) {
      field.order = index + 1;
    }
  });
  this.fields.sort((a, b) => a.order - b.order);
};

bookingFormTemplateSchema.methods.validateForm = function(formData) {
  const errors = [];
  
  this.fields.forEach(field => {
    const value = formData[field.id];
    
    // Check required fields
    if (field.required && (!value || value === '')) {
      errors.push({
        fieldId: field.id,
        message: `${field.label} is required`
      });
    }
    
    // Validate field specific rules
    if (value) {
      field.validation.forEach(rule => {
        let isValid = true;
        
        switch (rule.type) {
          case 'min_length':
            isValid = value.length >= rule.value;
            break;
          case 'max_length':
            isValid = value.length <= rule.value;
            break;
          case 'email':
            isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            break;
          case 'phone':
            isValid = /^\+?[\d\s\-\(\)]+$/.test(value);
            break;
          case 'url':
            isValid = /^https?:\/\/.+/.test(value);
            break;
          case 'regex':
            isValid = new RegExp(rule.value).test(value);
            break;
        }
        
        if (!isValid) {
          errors.push({
            fieldId: field.id,
            message: rule.message || `${field.label} is invalid`
          });
        }
      });
    }
  });
  
  return errors;
};

bookingFormTemplateSchema.methods.createVariant = function(variantName, percentage = 50) {
  if (!this.abTest.isEnabled) {
    this.abTest.isEnabled = true;
    this.abTest.variants = [];
  }
  
  const variant = {
    name: variantName,
    percentage,
    formData: {
      fields: [...this.fields],
      styling: { ...this.styling },
      settings: { ...this.settings }
    }
  };
  
  this.abTest.variants.push(variant);
  return variant;
};

bookingFormTemplateSchema.methods.publish = function() {
  this.isPublished = true;
  this.status = 'published';
  this.publishedAt = new Date();
  this.usage.lastUsed = new Date();
};

bookingFormTemplateSchema.methods.unpublish = function() {
  this.isPublished = false;
  this.status = 'draft';
  this.publishedAt = null;
};

bookingFormTemplateSchema.methods.archive = function() {
  this.status = 'archived';
  this.isPublished = false;
};

bookingFormTemplateSchema.methods.incrementViews = function() {
  this.usage.views += 1;
  this.usage.lastUsed = new Date();
  this.usage.conversionRate = this.calculatedConversionRate;
  return this.save();
};

bookingFormTemplateSchema.methods.incrementSubmissions = function() {
  this.usage.submissions += 1;
  this.usage.lastUsed = new Date();
  this.usage.conversionRate = this.calculatedConversionRate;
  return this.save();
};

// Static methods
bookingFormTemplateSchema.statics.getPublishedTemplates = function(hotelId) {
  return this.find({ 
    hotelId, 
    isPublished: true, 
    status: 'published' 
  }).populate('createdBy updatedBy', 'name email');
};

bookingFormTemplateSchema.statics.getTemplateByCategory = function(hotelId, category) {
  return this.find({ 
    hotelId, 
    category, 
    status: { $ne: 'archived' } 
  }).populate('createdBy updatedBy', 'name email');
};

bookingFormTemplateSchema.statics.createFromDefault = function(hotelId, userId, category = 'booking') {
  const defaultTemplates = {
    booking: {
      name: 'Standard Booking Form',
      description: 'Standard hotel booking form with essential fields',
      fields: [
        { id: 'check_in', type: 'date', label: 'Check-in Date', required: true, order: 1 },
        { id: 'check_out', type: 'date', label: 'Check-out Date', required: true, order: 2 },
        { id: 'guests', type: 'number', label: 'Number of Guests', required: true, min: 1, max: 10, order: 3 },
        { id: 'room_type', type: 'select', label: 'Room Type', required: true, order: 4 },
        { id: 'first_name', type: 'text', label: 'First Name', required: true, order: 5 },
        { id: 'last_name', type: 'text', label: 'Last Name', required: true, order: 6 },
        { id: 'email', type: 'email', label: 'Email Address', required: true, order: 7 },
        { id: 'phone', type: 'phone', label: 'Phone Number', required: true, order: 8 },
        { id: 'special_requests', type: 'textarea', label: 'Special Requests', required: false, order: 9 }
      ]
    },
    inquiry: {
      name: 'Quick Inquiry Form',
      description: 'Simple inquiry form for guest questions',
      fields: [
        { id: 'name', type: 'text', label: 'Name', required: true, order: 1 },
        { id: 'email', type: 'email', label: 'Email', required: true, order: 2 },
        { id: 'phone', type: 'phone', label: 'Phone', required: false, order: 3 },
        { id: 'inquiry_type', type: 'select', label: 'Inquiry Type', required: true, order: 4, options: [
          { label: 'Room Availability', value: 'availability' },
          { label: 'Pricing', value: 'pricing' },
          { label: 'Services', value: 'services' },
          { label: 'Other', value: 'other' }
        ]},
        { id: 'message', type: 'textarea', label: 'Message', required: true, order: 5 }
      ]
    }
  };
  
  const template = defaultTemplates[category] || defaultTemplates.booking;
  
  return new this({
    hotelId,
    createdBy: userId,
    ...template
  });
};

// Pre-save middleware
bookingFormTemplateSchema.pre('save', function(next) {
  // Sort fields by order
  if (this.fields) {
    this.fields.sort((a, b) => a.order - b.order);
  }
  
  // Update conversion rate
  if (this.usage) {
    this.usage.conversionRate = this.calculatedConversionRate;
  }
  
  // Validate A/B test percentages
  if (this.abTest && this.abTest.isEnabled && this.abTest.variants) {
    const totalPercentage = this.abTest.variants.reduce((sum, variant) => sum + variant.percentage, 0);
    if (totalPercentage > 100) {
      return next(new Error('A/B test variant percentages cannot exceed 100%'));
    }
  }
  
  next();
});

const BookingFormTemplate = mongoose.model('BookingFormTemplate', bookingFormTemplateSchema);

export default BookingFormTemplate;
