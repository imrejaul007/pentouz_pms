import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     CustomField:
 *       type: object
 *       required:
 *         - name
 *         - type
 *         - category
 *         - isActive
 *       properties:
 *         _id:
 *           type: string
 *           description: Custom field ID
 *         name:
 *           type: string
 *           description: Field name
 *         label:
 *           type: string
 *           description: Display label for the field
 *         type:
 *           type: string
 *           enum: [text, number, date, dropdown, checkbox, multiselect, textarea, email, phone, url]
 *           description: Field type
 *         category:
 *           type: string
 *           enum: [personal, preferences, contact, business, special, other]
 *           description: Field category
 *         description:
 *           type: string
 *           description: Field description
 *         isRequired:
 *           type: boolean
 *           description: Whether the field is required
 *         isActive:
 *           type: boolean
 *           description: Whether the field is active
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
 *               description: Options for dropdown/multiselect fields
 *         displayOrder:
 *           type: number
 *           description: Display order in forms
 *         isVisible:
 *           type: boolean
 *           description: Whether field is visible to guests
 *         isEditable:
 *           type: boolean
 *           description: Whether field is editable by guests
 *         defaultValue:
 *           type: string
 *           description: Default value for the field
 *         helpText:
 *           type: string
 *           description: Help text for the field
 *         group:
 *           type: string
 *           description: Field group for organization
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           description: Tags for categorization
 *         hotelId:
 *           type: string
 *           description: Hotel ID
 *         createdBy:
 *           type: string
 *           description: User who created the field
 *         updatedBy:
 *           type: string
 *           description: User who last updated the field
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const customFieldSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Field name is required'],
    trim: true,
    maxlength: [100, 'Field name cannot be more than 100 characters']
  },
  label: {
    type: String,
    required: [true, 'Field label is required'],
    trim: true,
    maxlength: [200, 'Field label cannot be more than 200 characters']
  },
  type: {
    type: String,
    required: [true, 'Field type is required'],
    enum: {
      values: ['text', 'number', 'date', 'dropdown', 'checkbox', 'multiselect', 'textarea', 'email', 'phone', 'url'],
      message: 'Invalid field type'
    }
  },
  category: {
    type: String,
    required: [true, 'Field category is required'],
    enum: {
      values: ['personal', 'preferences', 'contact', 'business', 'special', 'other'],
      message: 'Invalid field category'
    }
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  isRequired: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  validation: {
    minLength: {
      type: Number,
      min: 0
    },
    maxLength: {
      type: Number,
      min: 0
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
      type: String,
      trim: true
    }]
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  isVisible: {
    type: Boolean,
    default: true
  },
  isEditable: {
    type: Boolean,
    default: true
  },
  defaultValue: {
    type: String,
    maxlength: [500, 'Default value cannot be more than 500 characters']
  },
  helpText: {
    type: String,
    maxlength: [300, 'Help text cannot be more than 300 characters']
  },
  group: {
    type: String,
    trim: true,
    maxlength: [100, 'Group name cannot be more than 100 characters']
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Tag cannot be more than 50 characters']
  }],
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: true
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
customFieldSchema.index({ hotelId: 1, name: 1 }, { unique: true });
customFieldSchema.index({ hotelId: 1, category: 1 });
customFieldSchema.index({ hotelId: 1, type: 1 });
customFieldSchema.index({ hotelId: 1, isActive: 1 });
customFieldSchema.index({ hotelId: 1, displayOrder: 1 });

// Pre-save middleware to set updatedBy
customFieldSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedBy = this.createdBy; // This will be updated by controller
  }
  next();
});

// Pre-save middleware to validate field-specific requirements
customFieldSchema.pre('save', function(next) {
  // Validate dropdown and multiselect fields have options
  if ((this.type === 'dropdown' || this.type === 'multiselect') && 
      (!this.validation.options || this.validation.options.length === 0)) {
    return next(new Error('Dropdown and multiselect fields must have options'));
  }

  // Validate min/max for number fields
  if (this.type === 'number' && this.validation.min && this.validation.max && 
      this.validation.min > this.validation.max) {
    return next(new Error('Minimum value cannot be greater than maximum value'));
  }

  // Validate min/max length for text fields
  if ((this.type === 'text' || this.type === 'textarea') && 
      this.validation.minLength && this.validation.maxLength && 
      this.validation.minLength > this.validation.maxLength) {
    return next(new Error('Minimum length cannot be greater than maximum length'));
  }

  next();
});

// Virtual for creator details
customFieldSchema.virtual('creator', {
  ref: 'User',
  localField: 'createdBy',
  foreignField: '_id',
  justOne: true
});

// Virtual for updater details
customFieldSchema.virtual('updater', {
  ref: 'User',
  localField: 'updatedBy',
  foreignField: '_id',
  justOne: true
});

// Static method to get fields by category
customFieldSchema.statics.getFieldsByCategory = async function(hotelId, category) {
  return await this.find({
    hotelId: new mongoose.Types.ObjectId(hotelId),
    category,
    isActive: true
  }).sort({ displayOrder: 1, name: 1 });
};

// Static method to get active fields for forms
customFieldSchema.statics.getActiveFields = async function(hotelId, options = {}) {
  const { category, type, isVisible, isEditable } = options;
  
  const query = {
    hotelId: new mongoose.Types.ObjectId(hotelId),
    isActive: true
  };

  if (category) query.category = category;
  if (type) query.type = type;
  if (isVisible !== undefined) query.isVisible = isVisible;
  if (isEditable !== undefined) query.isEditable = isEditable;

  return await this.find(query).sort({ displayOrder: 1, name: 1 });
};

// Static method to get field statistics
customFieldSchema.statics.getFieldStatistics = async function(hotelId) {
  const stats = await this.aggregate([
    { $match: { hotelId: new mongoose.Types.ObjectId(hotelId) } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: ['$isActive', 1, 0] } },
        inactive: { $sum: { $cond: ['$isActive', 0, 1] } },
        required: { $sum: { $cond: ['$isRequired', 1, 0] } },
        visible: { $sum: { $cond: ['$isVisible', 1, 0] } },
        editable: { $sum: { $cond: ['$isEditable', 1, 0] } },
        byType: {
          $push: {
            type: '$type',
            isActive: '$isActive'
          }
        },
        byCategory: {
          $push: {
            category: '$category',
            isActive: '$isActive'
          }
        }
      }
    }
  ]);

  if (stats.length === 0) {
    return {
      total: 0,
      active: 0,
      inactive: 0,
      required: 0,
      visible: 0,
      editable: 0,
      byType: {},
      byCategory: {}
    };
  }

  const result = stats[0];
  
  // Calculate type breakdown
  const typeStats = {};
  result.byType.forEach(item => {
    if (!typeStats[item.type]) {
      typeStats[item.type] = { total: 0, active: 0, inactive: 0 };
    }
    typeStats[item.type].total++;
    if (item.isActive) {
      typeStats[item.type].active++;
    } else {
      typeStats[item.type].inactive++;
    }
  });

  // Calculate category breakdown
  const categoryStats = {};
  result.byCategory.forEach(item => {
    if (!categoryStats[item.category]) {
      categoryStats[item.category] = { total: 0, active: 0, inactive: 0 };
    }
    categoryStats[item.category].total++;
    if (item.isActive) {
      categoryStats[item.category].active++;
    } else {
      categoryStats[item.category].inactive++;
    }
  });

  return {
    total: result.total,
    active: result.active,
    inactive: result.inactive,
    required: result.required,
    visible: result.visible,
    editable: result.editable,
    byType: typeStats,
    byCategory: categoryStats
  };
};

// Instance method to validate field value
customFieldSchema.methods.validateValue = function(value) {
  const errors = [];

  // Check required
  if (this.isRequired && (!value || value.toString().trim() === '')) {
    errors.push(`${this.label} is required`);
    return errors;
  }

  // Skip validation if value is empty and not required
  if (!value || value.toString().trim() === '') {
    return errors;
  }

  // Type-specific validation
  switch (this.type) {
    case 'text':
    case 'textarea':
      if (this.validation.minLength && value.length < this.validation.minLength) {
        errors.push(`${this.label} must be at least ${this.validation.minLength} characters`);
      }
      if (this.validation.maxLength && value.length > this.validation.maxLength) {
        errors.push(`${this.label} must be no more than ${this.validation.maxLength} characters`);
      }
      if (this.validation.pattern && !new RegExp(this.validation.pattern).test(value)) {
        errors.push(`${this.label} format is invalid`);
      }
      break;

    case 'number':
      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        errors.push(`${this.label} must be a valid number`);
      } else {
        if (this.validation.min !== undefined && numValue < this.validation.min) {
          errors.push(`${this.label} must be at least ${this.validation.min}`);
        }
        if (this.validation.max !== undefined && numValue > this.validation.max) {
          errors.push(`${this.label} must be no more than ${this.validation.max}`);
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
      const phonePattern = /^[\+]?[1-9][\d]{0,15}$/;
      if (!phonePattern.test(value.replace(/[\s\-\(\)]/g, ''))) {
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

    case 'date':
      const dateValue = new Date(value);
      if (isNaN(dateValue.getTime())) {
        errors.push(`${this.label} must be a valid date`);
      }
      break;

    case 'dropdown':
      if (!this.validation.options.includes(value)) {
        errors.push(`${this.label} must be one of the allowed values`);
      }
      break;

    case 'multiselect':
      if (Array.isArray(value)) {
        const invalidValues = value.filter(v => !this.validation.options.includes(v));
        if (invalidValues.length > 0) {
          errors.push(`${this.label} contains invalid values`);
        }
      } else {
        errors.push(`${this.label} must be an array of values`);
      }
      break;

    case 'checkbox':
      if (typeof value !== 'boolean') {
        errors.push(`${this.label} must be true or false`);
      }
      break;
  }

  return errors;
};

// Instance method to get field configuration for forms
customFieldSchema.methods.getFormConfig = function() {
  return {
    name: this.name,
    label: this.label,
    type: this.type,
    required: this.isRequired,
    defaultValue: this.defaultValue,
    helpText: this.helpText,
    validation: this.validation,
    options: this.validation.options || [],
    group: this.group,
    displayOrder: this.displayOrder
  };
};

export default mongoose.model('CustomField', customFieldSchema);
