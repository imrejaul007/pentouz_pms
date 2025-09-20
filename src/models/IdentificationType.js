import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     IdentificationType:
 *       type: object
 *       required:
 *         - name
 *         - code
 *         - category
 *         - isActive
 *       properties:
 *         _id:
 *           type: string
 *           description: Identification type ID
 *         name:
 *           type: string
 *           description: Identification type name
 *         code:
 *           type: string
 *           description: Unique code for the identification type
 *         category:
 *           type: string
 *           enum: [government, corporate, student, military, diplomatic, other]
 *           description: Identification type category
 *         description:
 *           type: string
 *           description: Identification type description
 *         isActive:
 *           type: boolean
 *           description: Whether the identification type is active
 *         validation:
 *           type: object
 *           properties:
 *             pattern:
 *               type: string
 *               description: Regex pattern for validation
 *             minLength:
 *               type: number
 *               description: Minimum length
 *             maxLength:
 *               type: number
 *               description: Maximum length
 *             format:
 *               type: string
 *               description: Expected format description
 *         requirements:
 *           type: object
 *           properties:
 *             isRequired:
 *               type: boolean
 *               description: Whether this ID is required
 *             expiryRequired:
 *               type: boolean
 *               description: Whether expiry date is required
 *             photoRequired:
 *               type: boolean
 *               description: Whether photo is required
 *             verificationRequired:
 *               type: boolean
 *               description: Whether verification is required
 *         displayOrder:
 *           type: number
 *           description: Display order in lists
 *         icon:
 *           type: string
 *           description: Icon identifier for display
 *         color:
 *           type: string
 *           description: Color code for display purposes
 *         hotelId:
 *           type: string
 *           description: Hotel ID this identification type belongs to
 *         createdBy:
 *           type: string
 *           description: User who created this identification type
 *         updatedBy:
 *           type: string
 *           description: User who last updated this identification type
 */

const identificationTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Identification type name is required'],
    trim: true,
    maxLength: [100, 'Identification type name cannot exceed 100 characters'],
    index: true
  },
  code: {
    type: String,
    required: [true, 'Identification type code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxLength: [20, 'Identification type code cannot exceed 20 characters'],
    match: [/^[A-Z0-9_-]+$/, 'Identification type code can only contain letters, numbers, underscores and hyphens']
  },
  category: {
    type: String,
    required: [true, 'Identification type category is required'],
    enum: [
      'government', 'corporate', 'student', 'military', 'diplomatic', 'other'
    ],
    index: true
  },
  description: {
    type: String,
    maxLength: [500, 'Description cannot exceed 500 characters']
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  validation: {
    pattern: {
      type: String,
      trim: true
    },
    minLength: {
      type: Number,
      min: 1
    },
    maxLength: {
      type: Number,
      min: 1
    },
    format: {
      type: String,
      trim: true
    },
    examples: [{
      type: String,
      trim: true
    }]
  },
  requirements: {
    isRequired: {
      type: Boolean,
      default: true
    },
    expiryRequired: {
      type: Boolean,
      default: false
    },
    photoRequired: {
      type: Boolean,
      default: false
    },
    verificationRequired: {
      type: Boolean,
      default: false
    },
    multipleAllowed: {
      type: Boolean,
      default: false
    },
    ageRestriction: {
      minAge: {
        type: Number,
        min: 0,
        max: 120
      },
      maxAge: {
        type: Number,
        min: 0,
        max: 120
      }
    }
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  icon: {
    type: String,
    trim: true,
    default: 'id-card'
  },
  color: {
    type: String,
    match: [/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color code'],
    default: '#6B7280'
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
identificationTypeSchema.index({ hotelId: 1, category: 1 });
identificationTypeSchema.index({ hotelId: 1, isActive: 1 });
identificationTypeSchema.index({ hotelId: 1, displayOrder: 1 });

// Ensure unique identification type codes per hotel
identificationTypeSchema.index({ hotelId: 1, code: 1 }, { unique: true });

// Virtual for validation summary
identificationTypeSchema.virtual('validationSummary').get(function() {
  const rules = [];
  if (this.validation.minLength) rules.push(`Min length: ${this.validation.minLength}`);
  if (this.validation.maxLength) rules.push(`Max length: ${this.validation.maxLength}`);
  if (this.validation.pattern) rules.push('Custom pattern');
  if (this.validation.format) rules.push(`Format: ${this.validation.format}`);
  return rules.join(', ');
});

// Virtual for requirements summary
identificationTypeSchema.virtual('requirementsSummary').get(function() {
  const requirements = [];
  if (this.requirements.expiryRequired) requirements.push('Expiry date');
  if (this.requirements.photoRequired) requirements.push('Photo');
  if (this.requirements.verificationRequired) requirements.push('Verification');
  if (this.requirements.multipleAllowed) requirements.push('Multiple allowed');
  if (this.requirements.ageRestriction.minAge) {
    requirements.push(`Min age: ${this.requirements.ageRestriction.minAge}`);
  }
  if (this.requirements.ageRestriction.maxAge) {
    requirements.push(`Max age: ${this.requirements.ageRestriction.maxAge}`);
  }
  return requirements.join(', ');
});

// Instance methods
identificationTypeSchema.methods.validateId = function(idNumber) {
  const errors = [];
  
  if (!idNumber || idNumber.trim() === '') {
    if (this.requirements.isRequired) {
      errors.push(`${this.name} is required`);
    }
    return errors;
  }
  
  const trimmedId = idNumber.trim();
  
  // Length validation
  if (this.validation.minLength && trimmedId.length < this.validation.minLength) {
    errors.push(`${this.name} must be at least ${this.validation.minLength} characters`);
  }
  if (this.validation.maxLength && trimmedId.length > this.validation.maxLength) {
    errors.push(`${this.name} cannot exceed ${this.validation.maxLength} characters`);
  }
  
  // Pattern validation
  if (this.validation.pattern) {
    try {
      const regex = new RegExp(this.validation.pattern);
      if (!regex.test(trimmedId)) {
        errors.push(`${this.name} format is invalid`);
      }
    } catch (error) {
      console.error('Invalid regex pattern for identification type:', this.name, error);
    }
  }
  
  return errors;
};

identificationTypeSchema.methods.validateAge = function(age) {
  const errors = [];
  
  if (this.requirements.ageRestriction.minAge && age < this.requirements.ageRestriction.minAge) {
    errors.push(`Minimum age for ${this.name} is ${this.requirements.ageRestriction.minAge}`);
  }
  
  if (this.requirements.ageRestriction.maxAge && age > this.requirements.ageRestriction.maxAge) {
    errors.push(`Maximum age for ${this.name} is ${this.requirements.ageRestriction.maxAge}`);
  }
  
  return errors;
};

identificationTypeSchema.methods.isExpired = function(expiryDate) {
  if (!this.requirements.expiryRequired || !expiryDate) {
    return false;
  }
  
  const expiry = new Date(expiryDate);
  const today = new Date();
  return expiry < today;
};

identificationTypeSchema.methods.getDisplayFormat = function() {
  if (this.validation.format) {
    return this.validation.format;
  }
  
  if (this.validation.examples && this.validation.examples.length > 0) {
    return `Example: ${this.validation.examples[0]}`;
  }
  
  return 'Enter valid identification number';
};

// Static methods
identificationTypeSchema.statics.getByCategory = function(hotelId, category) {
  return this.find({ hotelId, category, isActive: true })
    .sort({ displayOrder: 1, name: 1 })
    .populate('createdBy updatedBy', 'name email');
};

identificationTypeSchema.statics.getActiveTypes = function(hotelId) {
  return this.find({ hotelId, isActive: true })
    .sort({ category: 1, displayOrder: 1, name: 1 })
    .populate('createdBy updatedBy', 'name email');
};

identificationTypeSchema.statics.getRequiredTypes = function(hotelId) {
  return this.find({ hotelId, isActive: true, 'requirements.isRequired': true })
    .sort({ displayOrder: 1, name: 1 });
};

identificationTypeSchema.statics.getGovernmentTypes = function(hotelId) {
  return this.find({ hotelId, category: 'government', isActive: true })
    .sort({ displayOrder: 1, name: 1 });
};

identificationTypeSchema.statics.validateIdentificationData = function(types, data) {
  const errors = {};
  
  for (const type of types) {
    const idNumber = data[type.code];
    const validationErrors = type.validateId(idNumber);
    
    if (validationErrors.length > 0) {
      errors[type.code] = validationErrors;
    }
    
    // Validate age if age restriction exists
    if (data.age && (type.requirements.ageRestriction.minAge || type.requirements.ageRestriction.maxAge)) {
      const ageErrors = type.validateAge(data.age);
      if (ageErrors.length > 0) {
        errors[`${type.code}_age`] = ageErrors;
      }
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Pre-save middleware
identificationTypeSchema.pre('save', function(next) {
  // Ensure display order is set
  if (this.displayOrder === undefined || this.displayOrder === null) {
    this.displayOrder = 0;
  }
  
  // Validate age restrictions
  if (this.requirements.ageRestriction.minAge && this.requirements.ageRestriction.maxAge) {
    if (this.requirements.ageRestriction.minAge > this.requirements.ageRestriction.maxAge) {
      return next(new Error('Minimum age cannot be greater than maximum age'));
    }
  }
  
  // Validate length restrictions
  if (this.validation.minLength && this.validation.maxLength) {
    if (this.validation.minLength > this.validation.maxLength) {
      return next(new Error('Minimum length cannot be greater than maximum length'));
    }
  }
  
  // Validate regex pattern if provided
  if (this.validation.pattern) {
    try {
      new RegExp(this.validation.pattern);
    } catch (error) {
      return next(new Error('Invalid regex pattern for validation'));
    }
  }
  
  next();
});

const IdentificationType = mongoose.model('IdentificationType', identificationTypeSchema);

export default IdentificationType;
