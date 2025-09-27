import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     DocumentRequirement:
 *       type: object
 *       required:
 *         - hotelId
 *         - userType
 *         - category
 *         - documentType
 *       properties:
 *         _id:
 *           type: string
 *           description: Document requirement ID
 *         hotelId:
 *           type: string
 *           description: Reference to Hotel
 *         userType:
 *           type: string
 *           enum: [guest, staff]
 *           description: Type of user this requirement applies to
 *         category:
 *           type: string
 *           description: Document category
 *         documentType:
 *           type: string
 *           description: Specific document type required
 *         isMandatory:
 *           type: boolean
 *           description: Whether this document is mandatory
 *         priority:
 *           type: string
 *           enum: [low, medium, high, critical]
 *           description: Priority level of this requirement
 *         applicableConditions:
 *           type: object
 *           description: Conditions that determine when this requirement applies
 *         validationRules:
 *           type: object
 *           description: Rules for validating the document
 *         expirySettings:
 *           type: object
 *           description: Settings for document expiry and renewal
 */

const documentRequirementSchema = new mongoose.Schema({
  // Basic identification
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required'],
    index: true
  },
  userType: {
    type: String,
    enum: ['guest', 'staff'],
    required: [true, 'User type is required'],
    index: true
  },

  // Document specification
  category: {
    type: String,
    required: [true, 'Document category is required'],
    enum: [
      // Guest document categories
      'identity_proof', 'address_proof', 'travel_document', 'visa',
      'certificate', 'booking_related', 'payment_proof',

      // Staff document categories
      'employment_verification', 'id_proof', 'training_certificate',
      'health_certificate', 'background_check', 'work_permit',
      'emergency_contact', 'tax_document', 'bank_details'
    ],
    index: true
  },
  documentType: {
    type: String,
    required: [true, 'Document type is required'],
    trim: true,
    maxlength: [100, 'Document type cannot exceed 100 characters']
  },
  alternativeTypes: [{
    type: String,
    trim: true,
    maxlength: [100, 'Alternative type cannot exceed 100 characters']
  }],

  // Requirement settings
  isMandatory: {
    type: Boolean,
    default: false,
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  },
  order: {
    type: Number,
    default: 0,
    min: 0
  },

  // Applicable conditions
  applicableConditions: {
    // For staff documents
    departments: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department'
    }],
    jobRoles: [String],
    employmentTypes: [{
      type: String,
      enum: ['full_time', 'part_time', 'contract', 'intern', 'temporary']
    }],

    // For guest documents
    bookingTypes: [{
      type: String,
      enum: ['direct', 'ota', 'corporate', 'travel_agent', 'walk_in']
    }],
    roomTypes: [String],
    guestTypes: [{
      type: String,
      enum: ['normal', 'vip', 'corporate', 'group']
    }],
    nationalityRestrictions: [String],

    // Common conditions
    minimumAge: {
      type: Number,
      min: 0,
      max: 100
    },
    maximumAge: {
      type: Number,
      min: 0,
      max: 100
    },
    accessLevels: [{
      type: String,
      enum: ['basic', 'elevated', 'restricted', 'confidential']
    }],

    // Seasonal or date-based requirements
    dateRanges: [{
      startDate: Date,
      endDate: Date,
      description: String
    }],

    // Custom conditions
    customConditions: [{
      field: String,
      operator: {
        type: String,
        enum: ['equals', 'contains', 'greater_than', 'less_than', 'in_list', 'not_in_list']
      },
      value: mongoose.Schema.Types.Mixed,
      description: String
    }]
  },

  // Validation rules
  validationRules: {
    // File specifications
    allowedFileTypes: [{
      type: String,
      enum: [
        'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ]
    }],
    maxFileSize: {
      type: Number,
      default: 5 * 1024 * 1024, // 5MB default
      min: 1024 // 1KB minimum
    },
    minFileSize: {
      type: Number,
      default: 1024 // 1KB minimum
    },

    // Content validation
    requiresOCR: {
      type: Boolean,
      default: false
    },
    requiredFields: [{
      fieldName: String,
      fieldType: {
        type: String,
        enum: ['text', 'number', 'date', 'boolean']
      },
      isRequired: Boolean,
      validationPattern: String
    }],

    // Quality requirements
    minimumImageResolution: {
      width: Number,
      height: Number
    },
    requiresHighQuality: {
      type: Boolean,
      default: false
    },

    // Security validation
    requiresBackgroundCheck: {
      type: Boolean,
      default: false
    },
    requiresManualVerification: {
      type: Boolean,
      default: true
    },
    autoVerificationCriteria: mongoose.Schema.Types.Mixed
  },

  // Expiry and renewal settings
  expirySettings: {
    hasExpiry: {
      type: Boolean,
      default: false
    },
    defaultValidityPeriod: {
      type: Number, // in days
      min: 1
    },
    renewalPeriod: {
      type: Number, // days before expiry to start renewal process
      default: 30
    },
    gracePeriod: {
      type: Number, // days after expiry where document is still accepted
      default: 0
    },
    renewalReminders: [{
      daysBefore: {
        type: Number,
        required: true
      },
      reminderType: {
        type: String,
        enum: ['email', 'sms', 'push', 'in_app'],
        required: true
      },
      template: String
    }],
    autoRenewal: {
      enabled: {
        type: Boolean,
        default: false
      },
      conditions: mongoose.Schema.Types.Mixed
    }
  },

  // Notification settings
  notifications: {
    onUpload: {
      enabled: {
        type: Boolean,
        default: true
      },
      recipients: [{
        role: String,
        department: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Department'
        },
        email: String
      }],
      template: String
    },
    onVerification: {
      enabled: {
        type: Boolean,
        default: true
      },
      notifyUser: {
        type: Boolean,
        default: true
      },
      additionalRecipients: [String]
    },
    onRejection: {
      enabled: {
        type: Boolean,
        default: true
      },
      requiresManagerNotification: {
        type: Boolean,
        default: false
      }
    }
  },

  // Display and UX settings
  displaySettings: {
    title: {
      type: String,
      required: [true, 'Display title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters']
    },
    description: {
      type: String,
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    helpText: {
      type: String,
      maxlength: [1000, 'Help text cannot exceed 1000 characters']
    },
    examples: [String],
    icon: String,
    color: {
      type: String,
      match: [/^#[0-9A-F]{6}$/i, 'Invalid color format']
    },
    isVisible: {
      type: Boolean,
      default: true
    },
    displayOrder: {
      type: Number,
      default: 0
    }
  },

  // Integration settings
  integrations: {
    thirdPartyValidation: {
      enabled: {
        type: Boolean,
        default: false
      },
      provider: String,
      configuration: mongoose.Schema.Types.Mixed
    },
    workflowIntegration: {
      enabled: {
        type: Boolean,
        default: false
      },
      workflowId: String,
      triggerEvents: [String]
    }
  },

  // Status and metadata
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  effectiveFrom: {
    type: Date,
    default: Date.now
  },
  effectiveTo: Date,

  // Compliance and legal
  compliance: {
    regulatoryRequirement: {
      type: Boolean,
      default: false
    },
    complianceStandards: [String],
    retentionPeriod: {
      type: Number, // in days
      default: 2555 // 7 years default
    },
    gdprCategory: {
      type: String,
      enum: ['basic', 'sensitive', 'special_category']
    },
    legalBasis: String
  },

  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by is required']
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Version control
  version: {
    type: Number,
    default: 1,
    min: 1
  },
  previousVersionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DocumentRequirement'
  },
  changeLog: [{
    version: Number,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    changes: [String],
    reason: String
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
documentRequirementSchema.index({ hotelId: 1, userType: 1, isActive: 1 });
documentRequirementSchema.index({ userType: 1, category: 1, isMandatory: 1 });
documentRequirementSchema.index({ 'applicableConditions.departments': 1 });
documentRequirementSchema.index({ priority: 1, order: 1 });
documentRequirementSchema.index({ effectiveFrom: 1, effectiveTo: 1 });
documentRequirementSchema.index({ isActive: 1, effectiveFrom: 1 });

// Virtual for current status
documentRequirementSchema.virtual('isCurrentlyActive').get(function() {
  const now = new Date();
  return this.isActive &&
         now >= this.effectiveFrom &&
         (!this.effectiveTo || now <= this.effectiveTo);
});

// Virtual for days until effective
documentRequirementSchema.virtual('daysUntilEffective').get(function() {
  if (this.effectiveFrom <= new Date()) return 0;
  const diffTime = this.effectiveFrom - new Date();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Instance methods
documentRequirementSchema.methods.isApplicableForUser = function(user, additionalContext = {}) {
  if (!this.isCurrentlyActive) return false;

  const conditions = this.applicableConditions;

  // Check user type
  if (this.userType !== user.role && !(user.role === 'staff' && this.userType === 'staff')) {
    return false;
  }

  // Staff-specific checks
  if (this.userType === 'staff') {
    // Check department
    if (conditions.departments && conditions.departments.length > 0) {
      if (!user.departmentId || !conditions.departments.some(deptId =>
        deptId.toString() === user.departmentId.toString())) {
        return false;
      }
    }

    // Check employment type
    if (conditions.employmentTypes && conditions.employmentTypes.length > 0) {
      if (!additionalContext.employmentType ||
          !conditions.employmentTypes.includes(additionalContext.employmentType)) {
        return false;
      }
    }

    // Check job role
    if (conditions.jobRoles && conditions.jobRoles.length > 0) {
      if (!additionalContext.jobRole ||
          !conditions.jobRoles.includes(additionalContext.jobRole)) {
        return false;
      }
    }
  }

  // Guest-specific checks
  if (this.userType === 'guest') {
    // Check guest type
    if (conditions.guestTypes && conditions.guestTypes.length > 0) {
      const guestType = user.guestType || additionalContext.guestType || 'normal';
      if (!conditions.guestTypes.includes(guestType)) {
        return false;
      }
    }

    // Check booking type
    if (conditions.bookingTypes && conditions.bookingTypes.length > 0 && additionalContext.bookingType) {
      if (!conditions.bookingTypes.includes(additionalContext.bookingType)) {
        return false;
      }
    }

    // Check nationality
    if (conditions.nationalityRestrictions && conditions.nationalityRestrictions.length > 0) {
      const nationality = additionalContext.nationality;
      if (nationality && !conditions.nationalityRestrictions.includes(nationality)) {
        return false;
      }
    }
  }

  // Check age restrictions
  if (conditions.minimumAge || conditions.maximumAge) {
    const age = additionalContext.age;
    if (age !== undefined) {
      if (conditions.minimumAge && age < conditions.minimumAge) return false;
      if (conditions.maximumAge && age > conditions.maximumAge) return false;
    }
  }

  // Check custom conditions
  if (conditions.customConditions && conditions.customConditions.length > 0) {
    for (const condition of conditions.customConditions) {
      const fieldValue = additionalContext[condition.field];
      if (!this.evaluateCustomCondition(condition, fieldValue)) {
        return false;
      }
    }
  }

  return true;
};

documentRequirementSchema.methods.evaluateCustomCondition = function(condition, value) {
  switch (condition.operator) {
    case 'equals':
      return value === condition.value;
    case 'contains':
      return typeof value === 'string' && value.includes(condition.value);
    case 'greater_than':
      return Number(value) > Number(condition.value);
    case 'less_than':
      return Number(value) < Number(condition.value);
    case 'in_list':
      return Array.isArray(condition.value) && condition.value.includes(value);
    case 'not_in_list':
      return Array.isArray(condition.value) && !condition.value.includes(value);
    default:
      return true;
  }
};

documentRequirementSchema.methods.validateDocument = function(document) {
  const rules = this.validationRules;
  const errors = [];

  // File type validation
  if (rules.allowedFileTypes && rules.allowedFileTypes.length > 0) {
    if (!rules.allowedFileTypes.includes(document.fileType)) {
      errors.push(`File type ${document.fileType} is not allowed. Allowed types: ${rules.allowedFileTypes.join(', ')}`);
    }
  }

  // File size validation
  if (rules.maxFileSize && document.fileSize > rules.maxFileSize) {
    errors.push(`File size ${document.fileSize} exceeds maximum allowed size of ${rules.maxFileSize} bytes`);
  }

  if (rules.minFileSize && document.fileSize < rules.minFileSize) {
    errors.push(`File size ${document.fileSize} is below minimum required size of ${rules.minFileSize} bytes`);
  }

  // Additional validations can be added here

  return {
    isValid: errors.length === 0,
    errors
  };
};

documentRequirementSchema.methods.createNewVersion = async function(changes, changedBy, reason = '') {
  // Create new version
  const newVersion = new this.constructor({
    ...this.toObject(),
    _id: undefined,
    version: this.version + 1,
    previousVersionId: this._id,
    createdAt: undefined,
    updatedAt: undefined
  });

  // Apply changes
  Object.assign(newVersion, changes);

  // Add to change log
  newVersion.changeLog.push({
    version: newVersion.version,
    changedBy,
    changes: Object.keys(changes),
    reason
  });

  // Deactivate current version
  this.isActive = false;
  this.effectiveTo = new Date();

  await this.save();
  return await newVersion.save();
};

// Static methods
documentRequirementSchema.statics.getRequirementsForUser = function(hotelId, userType, additionalContext = {}) {
  return this.find({
    hotelId,
    userType,
    isActive: true,
    effectiveFrom: { $lte: new Date() },
    $or: [
      { effectiveTo: { $exists: false } },
      { effectiveTo: null },
      { effectiveTo: { $gte: new Date() } }
    ]
  })
  .populate('applicableConditions.departments', 'name code')
  .sort({ priority: -1, order: 1, 'displaySettings.displayOrder': 1 });
};

documentRequirementSchema.statics.getMandatoryRequirements = function(hotelId, userType, additionalContext = {}) {
  return this.getRequirementsForUser(hotelId, userType, additionalContext)
    .then(requirements => requirements.filter(req =>
      req.isMandatory && req.isApplicableForUser({ role: userType, ...additionalContext }, additionalContext)
    ));
};

documentRequirementSchema.statics.getRequirementsByDepartment = function(hotelId, departmentId) {
  return this.find({
    hotelId,
    userType: 'staff',
    'applicableConditions.departments': departmentId,
    isActive: true
  })
  .populate('createdBy', 'name email')
  .sort({ priority: -1, order: 1 });
};

documentRequirementSchema.statics.getExpiringRequirements = function(hotelId, days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + days);

  return this.find({
    hotelId,
    isActive: true,
    effectiveTo: {
      $exists: true,
      $lte: cutoffDate,
      $gte: new Date()
    }
  })
  .populate('createdBy', 'name email');
};

// Pre-save middleware
documentRequirementSchema.pre('save', function(next) {
  // Ensure effectiveFrom is set
  if (!this.effectiveFrom) {
    this.effectiveFrom = new Date();
  }

  // Set display order if not provided
  if (this.displaySettings && !this.displaySettings.displayOrder) {
    this.displaySettings.displayOrder = this.order;
  }

  // Validate date ranges
  if (this.effectiveTo && this.effectiveFrom && this.effectiveTo < this.effectiveFrom) {
    return next(new Error('Effective to date cannot be before effective from date'));
  }

  next();
});

// Post-save middleware for change tracking
documentRequirementSchema.post('save', function(doc) {
  // Emit events for requirement changes if needed
  if (doc.isModified('isActive') || doc.isModified('isMandatory')) {
    // Could trigger notifications or workflow updates
  }
});

export default mongoose.model('DocumentRequirement', documentRequirementSchema);