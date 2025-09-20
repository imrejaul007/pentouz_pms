import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     AccountAttribute:
 *       type: object
 *       required:
 *         - name
 *         - type
 *         - category
 *         - isActive
 *       properties:
 *         _id:
 *           type: string
 *           description: Account attribute ID
 *         name:
 *           type: string
 *           description: Attribute name
 *         label:
 *           type: string
 *           description: Display label for the attribute
 *         type:
 *           type: string
 *           enum: [text, number, date, boolean, select, multiselect, textarea, email, phone, url, file]
 *           description: Attribute data type
 *         category:
 *           type: string
 *           enum: [personal, business, financial, contact, preferences, security, compliance, other]
 *           description: Attribute category
 *         description:
 *           type: string
 *           description: Attribute description
 *         isRequired:
 *           type: boolean
 *           description: Whether the attribute is required
 *         isActive:
 *           type: boolean
 *           description: Whether the attribute is active
 *         validation:
 *           type: object
 *           properties:
 *             minLength:
 *               type: number
 *               description: Minimum length for text fields
 *             maxLength:
 *               type: number
 *               description: Maximum length for text fields
 *             min:
 *               type: number
 *               description: Minimum value for number fields
 *             max:
 *               type: number
 *               description: Maximum value for number fields
 *             pattern:
 *               type: string
 *               description: Regex pattern for validation
 *             options:
 *               type: array
 *               items:
 *                 type: string
 *               description: Options for select/multiselect fields
 *         defaultValue:
 *           type: string
 *           description: Default value for the attribute
 *         displayOrder:
 *           type: number
 *           description: Display order in forms
 *         isSystem:
 *           type: boolean
 *           default: false
 *           description: Whether this is a system-defined attribute
 *         hotelId:
 *           type: string
 *           description: Hotel ID this attribute belongs to
 *         createdBy:
 *           type: string
 *           description: User who created this attribute
 *         updatedBy:
 *           type: string
 *           description: User who last updated this attribute
 */

const accountAttributeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Attribute name is required'],
    trim: true,
    maxLength: [100, 'Attribute name cannot exceed 100 characters'],
    index: true
  },
  label: {
    type: String,
    required: [true, 'Attribute label is required'],
    trim: true,
    maxLength: [100, 'Attribute label cannot exceed 100 characters']
  },
  type: {
    type: String,
    required: [true, 'Attribute type is required'],
    enum: [
      'text', 'number', 'date', 'boolean', 'select', 'multiselect', 
      'textarea', 'email', 'phone', 'url', 'file'
    ],
    index: true
  },
  category: {
    type: String,
    required: [true, 'Attribute category is required'],
    enum: [
      'personal', 'business', 'financial', 'contact', 'preferences', 
      'security', 'compliance', 'other'
    ],
    index: true
  },
  description: {
    type: String,
    maxLength: [500, 'Description cannot exceed 500 characters']
  },
  isRequired: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  validation: {
    minLength: {
      type: Number,
      min: 0
    },
    maxLength: {
      type: Number,
      min: 1
    },
    min: {
      type: Number
    },
    max: {
      type: Number
    },
    pattern: {
      type: String
    },
    options: [{
      value: {
        type: String,
        required: true
      },
      label: {
        type: String,
        required: true
      },
      isDefault: {
        type: Boolean,
        default: false
      }
    }]
  },
  defaultValue: {
    type: String
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  isSystem: {
    type: Boolean,
    default: false
  },
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
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
accountAttributeSchema.index({ hotelId: 1, category: 1 });
accountAttributeSchema.index({ hotelId: 1, isActive: 1 });
accountAttributeSchema.index({ hotelId: 1, displayOrder: 1 });

// Ensure unique attribute names per hotel
accountAttributeSchema.index({ hotelId: 1, name: 1 }, { unique: true });

// Virtual for validation rules summary
accountAttributeSchema.virtual('validationSummary').get(function() {
  const rules = [];
  if (this.validation.minLength) rules.push(`Min length: ${this.validation.minLength}`);
  if (this.validation.maxLength) rules.push(`Max length: ${this.validation.maxLength}`);
  if (this.validation.min !== undefined) rules.push(`Min value: ${this.validation.min}`);
  if (this.validation.max !== undefined) rules.push(`Max value: ${this.validation.max}`);
  if (this.validation.pattern) rules.push('Custom pattern');
  if (this.validation.options && this.validation.options.length > 0) {
    rules.push(`${this.validation.options.length} options`);
  }
  return rules.join(', ');
});

// Instance methods
accountAttributeSchema.methods.validateValue = function(value) {
  const errors = [];
  
  // Required validation
  if (this.isRequired && (!value || value === '')) {
    errors.push(`${this.label} is required`);
    return errors;
  }
  
  if (!value || value === '') return errors; // Skip validation for empty optional fields
  
  // Type-specific validation
  switch (this.type) {
    case 'text':
    case 'textarea':
      if (this.validation.minLength && value.length < this.validation.minLength) {
        errors.push(`${this.label} must be at least ${this.validation.minLength} characters`);
      }
      if (this.validation.maxLength && value.length > this.validation.maxLength) {
        errors.push(`${this.label} cannot exceed ${this.validation.maxLength} characters`);
      }
      if (this.validation.pattern && !new RegExp(this.validation.pattern).test(value)) {
        errors.push(`${this.label} format is invalid`);
      }
      break;
      
    case 'number':
      const numValue = Number(value);
      if (isNaN(numValue)) {
        errors.push(`${this.label} must be a valid number`);
      } else {
        if (this.validation.min !== undefined && numValue < this.validation.min) {
          errors.push(`${this.label} must be at least ${this.validation.min}`);
        }
        if (this.validation.max !== undefined && numValue > this.validation.max) {
          errors.push(`${this.label} cannot exceed ${this.validation.max}`);
        }
      }
      break;
      
    case 'email':
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(value)) {
        errors.push(`${this.label} must be a valid email address`);
      }
      break;
      
    case 'phone':
      const phonePattern = /^[\+]?[\d\s\-\(\)]+$/;
      if (!phonePattern.test(value)) {
        errors.push(`${this.label} must be a valid phone number`);
      }
      break;
      
    case 'url':
      try {
        new URL(value);
      } catch {
        errors.push(`${this.label} must be a valid URL`);
      }
      break;
      
    case 'select':
      if (this.validation.options && this.validation.options.length > 0) {
        const validValues = this.validation.options.map(opt => opt.value);
        if (!validValues.includes(value)) {
          errors.push(`${this.label} must be one of: ${validValues.join(', ')}`);
        }
      }
      break;
      
    case 'multiselect':
      if (this.validation.options && this.validation.options.length > 0) {
        const validValues = this.validation.options.map(opt => opt.value);
        const values = Array.isArray(value) ? value : [value];
        const invalidValues = values.filter(v => !validValues.includes(v));
        if (invalidValues.length > 0) {
          errors.push(`${this.label} contains invalid values: ${invalidValues.join(', ')}`);
        }
      }
      break;
  }
  
  return errors;
};

accountAttributeSchema.methods.getDefaultValue = function() {
  if (this.defaultValue) return this.defaultValue;
  
  switch (this.type) {
    case 'text':
    case 'textarea':
    case 'email':
    case 'phone':
    case 'url':
      return '';
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'date':
      return new Date();
    case 'select':
      const defaultOption = this.validation.options?.find(opt => opt.isDefault);
      return defaultOption ? defaultOption.value : '';
    case 'multiselect':
      return [];
    case 'file':
      return null;
    default:
      return '';
  }
};

// Static methods
accountAttributeSchema.statics.getByCategory = function(hotelId, category) {
  return this.find({ hotelId, category, isActive: true })
    .sort({ displayOrder: 1, name: 1 })
    .populate('createdBy updatedBy', 'name email');
};

accountAttributeSchema.statics.getActiveAttributes = function(hotelId) {
  return this.find({ hotelId, isActive: true })
    .sort({ category: 1, displayOrder: 1, name: 1 })
    .populate('createdBy updatedBy', 'name email');
};

accountAttributeSchema.statics.validateAttributeData = function(attributes, data) {
  const errors = {};
  
  for (const attribute of attributes) {
    const value = data[attribute.name];
    const validationErrors = attribute.validateValue(value);
    if (validationErrors.length > 0) {
      errors[attribute.name] = validationErrors;
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Pre-save middleware
accountAttributeSchema.pre('save', function(next) {
  // Ensure display order is set
  if (this.displayOrder === undefined || this.displayOrder === null) {
    this.displayOrder = 0;
  }
  
  // Validate select/multiselect options
  if ((this.type === 'select' || this.type === 'multiselect') && 
      (!this.validation.options || this.validation.options.length === 0)) {
    return next(new Error('Select and multiselect attributes must have options defined'));
  }
  
  // Ensure only one default option for select fields
  if (this.type === 'select' && this.validation.options) {
    const defaultOptions = this.validation.options.filter(opt => opt.isDefault);
    if (defaultOptions.length > 1) {
      return next(new Error('Only one option can be set as default for select attributes'));
    }
  }
  
  next();
});

const AccountAttribute = mongoose.model('AccountAttribute', accountAttributeSchema);

export default AccountAttribute;
