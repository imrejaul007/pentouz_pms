import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     Document:
 *       type: object
 *       required:
 *         - userId
 *         - userType
 *         - filename
 *         - category
 *       properties:
 *         _id:
 *           type: string
 *           description: Document ID
 *         userId:
 *           type: string
 *           description: Reference to User model
 *         userType:
 *           type: string
 *           enum: [guest, staff]
 *           description: Type of user who uploaded the document
 *         bookingId:
 *           type: string
 *           description: Reference to Booking (for guest documents)
 *         departmentId:
 *           type: string
 *           description: Reference to Department (for staff documents)
 *         filename:
 *           type: string
 *           description: Stored filename
 *         originalName:
 *           type: string
 *           description: Original filename
 *         fileType:
 *           type: string
 *           description: MIME type of the file
 *         fileSize:
 *           type: number
 *           description: File size in bytes
 *         category:
 *           type: string
 *           description: Document category based on user type
 *         documentType:
 *           type: string
 *           description: Specific document type
 *         status:
 *           type: string
 *           enum: [pending, verified, rejected, expired, renewal_required]
 *           default: pending
 *         verificationDetails:
 *           type: object
 *           properties:
 *             verifiedBy:
 *               type: string
 *             verifiedAt:
 *               type: string
 *               format: date-time
 *             comments:
 *               type: string
 *             rejectionReason:
 *               type: string
 *             confidenceLevel:
 *               type: number
 *               minimum: 1
 *               maximum: 10
 */

const documentSchema = new mongoose.Schema({
  // User association
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  userType: {
    type: String,
    enum: ['guest', 'staff'],
    required: [true, 'User type is required'],
    index: true
  },

  // Context references
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: function() {
      return this.userType === 'guest' && this.category === 'booking_related';
    },
    index: true
  },
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: function() {
      return this.userType === 'staff';
    },
    index: true
  },
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required'],
    index: true
  },

  // File details
  filename: {
    type: String,
    required: [true, 'Filename is required'],
    trim: true
  },
  originalName: {
    type: String,
    required: [true, 'Original filename is required'],
    trim: true,
    maxlength: [255, 'Original filename cannot exceed 255 characters']
  },
  fileType: {
    type: String,
    required: [true, 'File type is required'],
    enum: [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  },
  fileSize: {
    type: Number,
    required: [true, 'File size is required'],
    min: [1, 'File size must be greater than 0'],
    max: [10 * 1024 * 1024, 'File size cannot exceed 10MB']
  },
  filePath: {
    type: String,
    required: [true, 'File path is required'],
    select: false // Don't include in queries by default for security
  },

  // Document classification
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
  isRequired: {
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

  // Verification workflow
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected', 'expired', 'renewal_required'],
    default: 'pending',
    index: true
  },
  verificationLevel: {
    type: String,
    enum: ['basic', 'enhanced', 'background_check'],
    default: 'basic'
  },

  // Verification details
  verificationDetails: {
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verifiedAt: Date,
    comments: {
      type: String,
      maxlength: [1000, 'Comments cannot exceed 1000 characters']
    },
    rejectionReason: {
      type: String,
      maxlength: [500, 'Rejection reason cannot exceed 500 characters']
    },
    confidenceLevel: {
      type: Number,
      min: 1,
      max: 10,
      default: 5
    },
    verificationNotes: [String],
    additionalChecksRequired: [String]
  },

  // Compliance and expiry
  expiryDate: {
    type: Date,
    index: true
  },
  renewalRequired: {
    type: Boolean,
    default: false,
    index: true
  },
  renewalReminderSent: {
    type: Boolean,
    default: false
  },
  complianceFlags: [{
    type: String,
    enum: ['gdpr_sensitive', 'background_check_required', 'legal_verification', 'medical_confidential']
  }],

  // Access control
  accessLevel: {
    type: String,
    enum: ['public', 'internal', 'confidential', 'restricted'],
    default: 'internal',
    index: true
  },
  viewableByRoles: [{
    type: String,
    enum: ['guest', 'staff', 'admin', 'manager', 'hr']
  }],
  departmentAccess: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  }],

  // Upload metadata
  uploadSource: {
    type: String,
    enum: ['web', 'mobile', 'email', 'scanner', 'api'],
    default: 'web'
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Uploaded by user is required']
  },
  ipAddress: {
    type: String,
    match: [/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^(?:[a-fA-F0-9]*:){7}[a-fA-F0-9]*$/, 'Invalid IP address format']
  },
  deviceInfo: {
    userAgent: String,
    platform: String,
    browser: String
  },

  // Document description and tags
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    trim: true
  },
  tags: [String],

  // Processing status
  ocrProcessed: {
    type: Boolean,
    default: false
  },
  ocrData: {
    extractedText: String,
    confidence: Number,
    extractedFields: mongoose.Schema.Types.Mixed
  },

  // Audit trail
  auditLog: [{
    action: {
      type: String,
      required: true,
      enum: [
        'upload', 'view', 'download', 'verify', 'reject',
        'update', 'delete', 'access_granted', 'access_denied'
      ]
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    performedAt: {
      type: Date,
      default: Date.now
    },
    details: mongoose.Schema.Types.Mixed,
    ipAddress: String,
    userAgent: String
  }],

  // Status tracking
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Linked documents
  linkedDocuments: [{
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document'
    },
    relationshipType: {
      type: String,
      enum: ['related', 'replacement', 'supporting', 'renewal']
    }
  }],

  // Notification tracking
  notificationsSent: [{
    type: {
      type: String,
      enum: ['upload_confirmation', 'verification_request', 'approved', 'rejected', 'expiry_reminder', 'renewal_required']
    },
    sentAt: {
      type: Date,
      default: Date.now
    },
    sentTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    method: {
      type: String,
      enum: ['email', 'sms', 'push', 'in_app']
    }
  }]
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      // Remove sensitive fields from JSON output
      delete ret.filePath;
      delete ret.ipAddress;
      delete ret.deviceInfo;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Indexes for performance and queries
documentSchema.index({ userId: 1, userType: 1, status: 1 });
documentSchema.index({ userType: 1, category: 1, status: 1 });
documentSchema.index({ hotelId: 1, userType: 1, status: 1 });
documentSchema.index({ departmentId: 1, status: 1 });
documentSchema.index({ bookingId: 1, status: 1 });
documentSchema.index({ status: 1, priority: 1, createdAt: -1 });
documentSchema.index({ expiryDate: 1, renewalRequired: 1 });
documentSchema.index({ 'verificationDetails.verifiedBy': 1, 'verificationDetails.verifiedAt': -1 });
documentSchema.index({ isActive: 1, isDeleted: 1 });
documentSchema.index({ tags: 1 });
documentSchema.index({ createdAt: -1 });

// Text search index
documentSchema.index({
  originalName: 'text',
  description: 'text',
  documentType: 'text',
  tags: 'text'
});

// Virtual for file URL (secure access)
documentSchema.virtual('fileUrl').get(function() {
  if (this.filename) {
    return `/api/v1/documents/${this._id}/download`;
  }
  return null;
});

// Virtual for days until expiry
documentSchema.virtual('daysUntilExpiry').get(function() {
  if (!this.expiryDate) return null;
  const now = new Date();
  const expiry = new Date(this.expiryDate);
  const diffTime = expiry - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for document age
documentSchema.virtual('documentAge').get(function() {
  const now = new Date();
  const created = new Date(this.createdAt);
  const diffTime = now - created;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for verification status
documentSchema.virtual('isVerified').get(function() {
  return this.status === 'verified';
});

// Virtual for expiry status
documentSchema.virtual('isExpiring').get(function() {
  if (!this.expiryDate) return false;
  const daysUntilExpiry = this.daysUntilExpiry;
  return daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry > 0;
});

documentSchema.virtual('isExpired').get(function() {
  if (!this.expiryDate) return false;
  return new Date() > new Date(this.expiryDate);
});

// Instance methods
documentSchema.methods.addAuditEntry = function(action, performedBy, details = {}, ipAddress = '', userAgent = '') {
  this.auditLog.push({
    action,
    performedBy,
    details,
    ipAddress,
    userAgent
  });

  // Keep only last 50 audit entries per document
  if (this.auditLog.length > 50) {
    this.auditLog = this.auditLog.slice(-50);
  }

  return this.save();
};

documentSchema.methods.verify = async function(verifiedBy, comments = '', confidenceLevel = 5) {
  this.status = 'verified';
  this.verificationDetails.verifiedBy = verifiedBy;
  this.verificationDetails.verifiedAt = new Date();
  this.verificationDetails.comments = comments;
  this.verificationDetails.confidenceLevel = confidenceLevel;

  await this.addAuditEntry('verify', verifiedBy, { comments, confidenceLevel });
  return this.save();
};

documentSchema.methods.reject = async function(rejectedBy, rejectionReason) {
  this.status = 'rejected';
  this.verificationDetails.verifiedBy = rejectedBy;
  this.verificationDetails.verifiedAt = new Date();
  this.verificationDetails.rejectionReason = rejectionReason;

  await this.addAuditEntry('reject', rejectedBy, { rejectionReason });
  return this.save();
};

documentSchema.methods.markForRenewal = async function(updatedBy, reason = '') {
  this.status = 'renewal_required';
  this.renewalRequired = true;

  await this.addAuditEntry('renewal_required', updatedBy, { reason });
  return this.save();
};

documentSchema.methods.canBeViewedBy = function(user, userDepartment = null) {
  // Document owner can always view
  if (this.userId.toString() === user._id.toString()) {
    return true;
  }

  // Admin can view all documents
  if (user.role === 'admin') {
    return true;
  }

  // Check role-based access
  if (this.viewableByRoles.includes(user.role)) {
    return true;
  }

  // Department-based access for staff documents
  if (this.userType === 'staff' && userDepartment) {
    return this.departmentAccess.some(deptId =>
      deptId.toString() === userDepartment.toString()
    );
  }

  // Staff can view guest documents based on access level
  if (this.userType === 'guest' && user.role === 'staff') {
    return ['public', 'internal'].includes(this.accessLevel);
  }

  return false;
};

// Static methods
documentSchema.statics.getDocumentsByUser = function(userId, options = {}) {
  const {
    status,
    category,
    userType,
    limit = 50,
    skip = 0,
    sortBy = '-createdAt'
  } = options;

  let query = { userId, isActive: true, isDeleted: false };

  if (status) query.status = status;
  if (category) query.category = category;
  if (userType) query.userType = userType;

  return this.find(query)
    .populate('verificationDetails.verifiedBy', 'name email')
    .populate('departmentId', 'name code')
    .populate('bookingId', 'bookingNumber checkIn checkOut')
    .sort(sortBy)
    .limit(limit)
    .skip(skip);
};

documentSchema.statics.getPendingVerifications = function(hotelId, options = {}) {
  const {
    userType,
    departmentId,
    priority,
    limit = 100,
    skip = 0
  } = options;

  let query = {
    hotelId,
    status: 'pending',
    isActive: true,
    isDeleted: false
  };

  if (userType) query.userType = userType;
  if (departmentId) query.departmentId = departmentId;
  if (priority) query.priority = priority;

  return this.find(query)
    .populate('userId', 'name email role')
    .populate('uploadedBy', 'name email')
    .populate('departmentId', 'name code')
    .populate('bookingId', 'bookingNumber checkIn checkOut')
    .sort({ priority: -1, createdAt: 1 })
    .limit(limit)
    .skip(skip);
};

documentSchema.statics.getExpiringDocuments = function(hotelId, days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + days);

  return this.find({
    hotelId,
    isActive: true,
    isDeleted: false,
    expiryDate: {
      $exists: true,
      $lte: cutoffDate,
      $gte: new Date()
    }
  })
  .populate('userId', 'name email role')
  .populate('departmentId', 'name code')
  .sort({ expiryDate: 1 });
};

documentSchema.statics.getComplianceStats = async function(hotelId, options = {}) {
  const { userType, departmentId, startDate, endDate } = options;

  let matchStage = {
    hotelId: mongoose.Types.ObjectId(hotelId),
    isActive: true,
    isDeleted: false
  };

  if (userType) matchStage.userType = userType;
  if (departmentId) matchStage.departmentId = mongoose.Types.ObjectId(departmentId);
  if (startDate && endDate) {
    matchStage.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalDocuments: { $sum: 1 },
        verifiedDocuments: {
          $sum: { $cond: [{ $eq: ['$status', 'verified'] }, 1, 0] }
        },
        pendingDocuments: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        },
        rejectedDocuments: {
          $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
        },
        expiredDocuments: {
          $sum: { $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] }
        },
        documentsByCategory: {
          $push: {
            category: '$category',
            status: '$status',
            userType: '$userType'
          }
        },
        avgVerificationTime: {
          $avg: {
            $cond: [
              { $ne: ['$verificationDetails.verifiedAt', null] },
              {
                $subtract: [
                  '$verificationDetails.verifiedAt',
                  '$createdAt'
                ]
              },
              null
            ]
          }
        }
      }
    }
  ]);
};

// Pre-save middleware
documentSchema.pre('save', function(next) {
  // Set expiry reminder flag when approaching expiry
  if (this.expiryDate && !this.renewalReminderSent) {
    const daysUntilExpiry = this.daysUntilExpiry;
    if (daysUntilExpiry !== null && daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
      this.renewalRequired = true;
    }
  }

  // Auto-set expired status
  if (this.expiryDate && new Date() > new Date(this.expiryDate) && this.status !== 'expired') {
    this.status = 'expired';
  }

  // Set default viewable roles based on user type
  if (this.isNew && this.viewableByRoles.length === 0) {
    if (this.userType === 'guest') {
      this.viewableByRoles = ['staff', 'admin'];
    } else if (this.userType === 'staff') {
      this.viewableByRoles = ['admin', 'hr'];
    }
  }

  next();
});

// Pre-remove middleware
documentSchema.pre('remove', async function(next) {
  // Soft delete instead of hard delete for audit purposes
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.isActive = false;

  await this.save();
  next();
});

export default mongoose.model('Document', documentSchema);