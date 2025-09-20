import mongoose from 'mongoose';
import crypto from 'crypto';

/**
 * @swagger
 * components:
 *   schemas:
 *     AdminBypassAudit:
 *       type: object
 *       required:
 *         - hotelId
 *         - bypassId
 *         - bookingId
 *         - adminId
 *         - reason
 *       properties:
 *         _id:
 *           type: string
 *         bypassId:
 *           type: string
 *           description: Unique bypass operation identifier
 *         hotelId:
 *           type: string
 *           description: Hotel ID for multi-tenant isolation
 *         bookingId:
 *           type: string
 *           description: Booking that was bypassed
 *         adminId:
 *           type: string
 *           description: Admin who performed the bypass
 *         reason:
 *           type: object
 *           description: Comprehensive reason tracking
 *         financialImpact:
 *           type: object
 *           description: Financial impact analysis
 *         securityMetadata:
 *           type: object
 *           description: Security tracking information
 *         approvalChain:
 *           type: array
 *           description: Approval workflow tracking
 *         complianceFlags:
 *           type: object
 *           description: Regulatory compliance markers
 */

const adminBypassAuditSchema = new mongoose.Schema({
  // Unique bypass operation identifier
  bypassId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Multi-tenant support
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },

  // Core operation tracking
  bookingId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Booking',
    required: true,
    index: true
  },
  checkoutInventoryId: {
    type: mongoose.Schema.ObjectId,
    ref: 'CheckoutInventory',
    required: true
  },
  adminId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Enhanced reason tracking
  reason: {
    category: {
      type: String,
      required: true,
      enum: [
        'emergency_medical',
        'system_failure',
        'inventory_unavailable',
        'guest_complaint',
        'staff_shortage',
        'technical_issue',
        'management_override',
        'compliance_requirement',
        'other'
      ],
      index: true
    },
    subcategory: {
      type: String,
      maxlength: 100
    },
    description: {
      type: String,
      required: true,
      maxlength: 1000
    },
    urgencyLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
      index: true
    },
    estimatedDuration: {
      type: Number, // minutes
      min: 0
    },
    followUpRequired: {
      type: Boolean,
      default: false
    },
    encryptedNotes: {
      type: String, // Encrypted sensitive information
      select: false
    }
  },

  // Financial impact analysis
  financialImpact: {
    estimatedLoss: {
      type: Number,
      default: 0,
      min: 0
    },
    actualLoss: {
      type: Number,
      min: 0
    },
    currency: {
      type: String,
      default: 'USD',
      enum: ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD']
    },
    impactCategory: {
      type: String,
      enum: ['minimal', 'low', 'medium', 'high', 'severe'],
      default: 'minimal'
    },
    budgetImpact: {
      department: String,
      budgetCode: String,
      fiscalYear: Number,
      quarterImpact: Number
    },
    recoveryPlan: {
      type: String,
      maxlength: 500
    },
    recoveryStatus: {
      type: String,
      enum: ['not_started', 'in_progress', 'completed', 'abandoned'],
      default: 'not_started'
    }
  },

  // Security and tracking metadata
  securityMetadata: {
    ipAddress: {
      type: String,
      required: true
    },
    userAgent: {
      type: String,
      required: true
    },
    deviceFingerprint: {
      type: String
    },
    sessionId: {
      type: String,
      required: true
    },
    geolocation: {
      latitude: Number,
      longitude: Number,
      accuracy: Number,
      city: String,
      country: String
    },
    loginTimestamp: {
      type: Date,
      required: true
    },
    lastActivity: {
      type: Date,
      required: true
    },
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    securityFlags: [{
      flag: {
        type: String,
        enum: ['suspicious_timing', 'unusual_location', 'rapid_succession', 'high_value', 'pattern_anomaly']
      },
      severity: {
        type: String,
        enum: ['info', 'warning', 'critical']
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      details: String
    }]
  },

  // Approval workflow tracking
  approvalChain: [{
    approvalLevel: {
      type: Number,
      required: true
    },
    approverId: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    approverRole: {
      type: String,
      enum: ['admin', 'manager', 'supervisor', 'director', 'owner']
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'escalated', 'expired'],
      default: 'pending'
    },
    requestedAt: {
      type: Date,
      default: Date.now
    },
    respondedAt: Date,
    notes: {
      type: String,
      maxlength: 500
    },
    autoApproved: {
      type: Boolean,
      default: false
    },
    approvalMethod: {
      type: String,
      enum: ['web', 'mobile', 'email', 'sms', 'automatic']
    }
  }],

  // Operation status
  operationStatus: {
    status: {
      type: String,
      enum: ['initiated', 'pending_approval', 'approved', 'in_progress', 'completed', 'failed', 'rolled_back'],
      default: 'initiated',
      index: true
    },
    initiatedAt: {
      type: Date,
      default: Date.now
    },
    completedAt: Date,
    duration: Number, // milliseconds
    retryCount: {
      type: Number,
      default: 0
    },
    lastRetryAt: Date,
    errorDetails: {
      code: String,
      message: String,
      stack: String,
      recoverable: Boolean
    }
  },

  // Guest and booking context
  guestContext: {
    guestId: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    guestName: String,
    guestEmail: String,
    guestPhone: String,
    vipStatus: Boolean,
    loyaltyTier: String,
    previousBypassCount: {
      type: Number,
      default: 0
    },
    guestNotified: {
      type: Boolean,
      default: false
    },
    guestConsentProvided: {
      type: Boolean,
      default: false
    }
  },

  // Room and property context
  propertyContext: {
    roomId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Room'
    },
    roomNumber: String,
    roomType: String,
    floor: Number,
    building: String,
    roomStatus: String,
    housekeepingStatus: String,
    maintenanceIssues: [String],
    occupancyRate: Number, // hotel occupancy at time of bypass
    seasonalFactor: String
  },

  // Regulatory compliance
  complianceFlags: {
    gdprCompliant: {
      type: Boolean,
      default: true
    },
    pciCompliant: {
      type: Boolean,
      default: true
    },
    soxCompliant: {
      type: Boolean,
      default: true
    },
    industryStandards: [{
      standard: String, // ISO27001, PCI-DSS, GDPR, etc.
      compliant: Boolean,
      lastAudit: Date,
      nextAudit: Date,
      notes: String
    }],
    retentionPeriod: {
      type: Number,
      default: 2557 // 7 years in days
    },
    dataClassification: {
      type: String,
      enum: ['public', 'internal', 'confidential', 'restricted'],
      default: 'confidential'
    }
  },

  // Analytics and reporting
  analytics: {
    businessHours: {
      type: Boolean,
      default: true
    },
    weekday: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    },
    shift: {
      type: String,
      enum: ['morning', 'afternoon', 'evening', 'night']
    },
    staffLevel: {
      type: String,
      enum: ['understaffed', 'normal', 'overstaffed']
    },
    hotelOccupancy: {
      type: Number,
      min: 0,
      max: 100
    },
    seasonalPeak: {
      type: Boolean,
      default: false
    },
    eventImpact: {
      type: String,
      enum: ['none', 'local_event', 'conference', 'holiday', 'weather']
    }
  },

  // Follow-up and remediation
  followUp: {
    required: {
      type: Boolean,
      default: false
    },
    assignedTo: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    dueDate: Date,
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    },
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'completed', 'overdue'],
      default: 'not_started'
    },
    actions: [{
      action: String,
      assignee: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      dueDate: Date,
      status: {
        type: String,
        enum: ['pending', 'completed', 'cancelled']
      },
      completedAt: Date,
      notes: String
    }],
    resolution: {
      type: String,
      maxlength: 1000
    },
    preventiveMeasures: [{
      measure: String,
      implementedAt: Date,
      effectiveness: {
        type: String,
        enum: ['low', 'medium', 'high']
      }
    }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance and querying
adminBypassAuditSchema.index({ hotelId: 1, createdAt: -1 });
adminBypassAuditSchema.index({ adminId: 1, createdAt: -1 });
adminBypassAuditSchema.index({ 'reason.category': 1, createdAt: -1 });
adminBypassAuditSchema.index({ 'operationStatus.status': 1 });
adminBypassAuditSchema.index({ 'financialImpact.impactCategory': 1 });
adminBypassAuditSchema.index({ 'securityMetadata.riskScore': -1 });
adminBypassAuditSchema.index({ 'analytics.businessHours': 1, 'analytics.shift': 1 });

// Compound indexes for common queries
adminBypassAuditSchema.index({ hotelId: 1, 'reason.category': 1, createdAt: -1 });
adminBypassAuditSchema.index({ hotelId: 1, adminId: 1, createdAt: -1 });
adminBypassAuditSchema.index({ 'operationStatus.status': 1, 'reason.urgencyLevel': 1 });

// TTL index for data retention
adminBypassAuditSchema.index({
  createdAt: 1
}, {
  expireAfterSeconds: 220752000 // 7 years in seconds
});

// Pre-save middleware
adminBypassAuditSchema.pre('save', async function(next) {
  // Generate unique bypass ID if not provided
  if (!this.bypassId) {
    const timestamp = Date.now().toString();
    const random = crypto.randomBytes(4).toString('hex');
    this.bypassId = `BYPASS_${timestamp}_${random.toUpperCase()}`;
  }

  // Set analytics data
  const now = new Date();
  this.analytics.weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];

  const hours = now.getHours();
  if (hours >= 6 && hours < 12) this.analytics.shift = 'morning';
  else if (hours >= 12 && hours < 18) this.analytics.shift = 'afternoon';
  else if (hours >= 18 && hours < 22) this.analytics.shift = 'evening';
  else this.analytics.shift = 'night';

  this.analytics.businessHours = hours >= 8 && hours < 18 && this.analytics.weekday !== 'Sunday' && this.analytics.weekday !== 'Saturday';

  // Calculate operation duration if completed
  if (this.operationStatus.status === 'completed' && this.operationStatus.completedAt) {
    this.operationStatus.duration = this.operationStatus.completedAt - this.operationStatus.initiatedAt;
  }

  next();
});

// Instance methods
adminBypassAuditSchema.methods.encryptSensitiveNotes = function(notes, secretKey) {
  if (!notes) return;

  const cipher = crypto.createCipher('aes-256-cbc', secretKey);
  let encrypted = cipher.update(notes, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  this.reason.encryptedNotes = encrypted;
};

adminBypassAuditSchema.methods.decryptSensitiveNotes = function(secretKey) {
  if (!this.reason.encryptedNotes) return '';

  try {
    const decipher = crypto.createDecipher('aes-256-cbc', secretKey);
    let decrypted = decipher.update(this.reason.encryptedNotes, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Failed to decrypt notes:', error);
    return '[DECRYPTION_FAILED]';
  }
};

adminBypassAuditSchema.methods.addSecurityFlag = function(flag, severity = 'warning', details = '') {
  this.securityMetadata.securityFlags.push({
    flag,
    severity,
    details,
    timestamp: new Date()
  });

  // Recalculate risk score
  this.calculateRiskScore();
};

adminBypassAuditSchema.methods.calculateRiskScore = function() {
  let score = 0;

  // Base score by reason category
  const categoryScores = {
    'emergency_medical': 10,
    'system_failure': 20,
    'inventory_unavailable': 15,
    'guest_complaint': 25,
    'staff_shortage': 30,
    'technical_issue': 20,
    'management_override': 40,
    'compliance_requirement': 10,
    'other': 50
  };

  score += categoryScores[this.reason.category] || 50;

  // Urgency multiplier
  const urgencyMultipliers = {
    'low': 0.5,
    'medium': 1.0,
    'high': 1.5,
    'critical': 2.0
  };

  score *= urgencyMultipliers[this.reason.urgencyLevel] || 1.0;

  // Financial impact
  if (this.financialImpact.estimatedLoss > 1000) score += 20;
  if (this.financialImpact.estimatedLoss > 5000) score += 30;

  // Security flags impact
  this.securityMetadata.securityFlags.forEach(flag => {
    const flagScores = {
      'suspicious_timing': 15,
      'unusual_location': 25,
      'rapid_succession': 30,
      'high_value': 20,
      'pattern_anomaly': 35
    };

    const severityMultipliers = {
      'info': 0.5,
      'warning': 1.0,
      'critical': 2.0
    };

    score += (flagScores[flag.flag] || 10) * (severityMultipliers[flag.severity] || 1.0);
  });

  // Time-based factors
  const hour = new Date().getHours();
  if (hour < 6 || hour > 22) score += 10; // Night hours
  if (!this.analytics.businessHours) score += 15; // Outside business hours

  // Cap the score
  this.securityMetadata.riskScore = Math.min(Math.round(score), 100);
};

adminBypassAuditSchema.methods.addApprovalStep = function(level, approverId, approverRole) {
  this.approvalChain.push({
    approvalLevel: level,
    approverId,
    approverRole,
    status: 'pending',
    requestedAt: new Date()
  });
};

adminBypassAuditSchema.methods.processApproval = function(level, approverId, status, notes, method = 'web') {
  const approval = this.approvalChain.find(a => a.approvalLevel === level);
  if (!approval) {
    throw new Error(`Approval level ${level} not found`);
  }

  approval.status = status;
  approval.respondedAt = new Date();
  approval.notes = notes;
  approval.approvalMethod = method;

  // Update overall operation status if all approvals are completed
  const allApprovals = this.approvalChain.every(a => a.status === 'approved');
  const anyRejected = this.approvalChain.some(a => a.status === 'rejected');

  if (anyRejected) {
    this.operationStatus.status = 'failed';
  } else if (allApprovals) {
    this.operationStatus.status = 'approved';
  }
};

// Static methods
adminBypassAuditSchema.statics.createBypassAudit = async function(bypassData) {
  const audit = new this({
    bypassId: bypassData.bypassId || `BYPASS_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    hotelId: bypassData.hotelId,
    bookingId: bypassData.bookingId,
    checkoutInventoryId: bypassData.checkoutInventoryId,
    adminId: bypassData.adminId,
    reason: {
      category: bypassData.reason.category,
      subcategory: bypassData.reason.subcategory,
      description: bypassData.reason.description,
      urgencyLevel: bypassData.reason.urgencyLevel || 'medium',
      estimatedDuration: bypassData.reason.estimatedDuration,
      followUpRequired: bypassData.reason.followUpRequired || false
    },
    financialImpact: bypassData.financialImpact || {},
    securityMetadata: {
      ipAddress: bypassData.securityMetadata.ipAddress,
      userAgent: bypassData.securityMetadata.userAgent,
      deviceFingerprint: bypassData.securityMetadata.deviceFingerprint,
      sessionId: bypassData.securityMetadata.sessionId,
      geolocation: bypassData.securityMetadata.geolocation,
      loginTimestamp: bypassData.securityMetadata.loginTimestamp,
      lastActivity: new Date(),
      securityFlags: []
    },
    guestContext: bypassData.guestContext || {},
    propertyContext: bypassData.propertyContext || {},
    analytics: bypassData.analytics || {}
  });

  // Calculate initial risk score
  audit.calculateRiskScore();

  // Encrypt sensitive notes if provided
  if (bypassData.reason.sensitiveNotes && bypassData.encryptionKey) {
    audit.encryptSensitiveNotes(bypassData.reason.sensitiveNotes, bypassData.encryptionKey);
  }

  return await audit.save();
};

adminBypassAuditSchema.statics.getBypassStatistics = async function(hotelId, timeRange = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeRange);

  const stats = await this.aggregate([
    {
      $match: {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalBypasses: { $sum: 1 },
        averageRiskScore: { $avg: '$securityMetadata.riskScore' },
        totalFinancialImpact: { $sum: '$financialImpact.estimatedLoss' },
        byCategory: {
          $push: {
            category: '$reason.category',
            urgency: '$reason.urgencyLevel',
            riskScore: '$securityMetadata.riskScore'
          }
        },
        byShift: {
          $push: {
            shift: '$analytics.shift',
            businessHours: '$analytics.businessHours'
          }
        }
      }
    }
  ]);

  return stats[0] || {
    totalBypasses: 0,
    averageRiskScore: 0,
    totalFinancialImpact: 0,
    byCategory: [],
    byShift: []
  };
};

adminBypassAuditSchema.statics.getHighRiskBypasses = function(hotelId, threshold = 70) {
  return this.find({
    hotelId,
    'securityMetadata.riskScore': { $gte: threshold }
  })
  .populate('adminId', 'name email role')
  .populate('bookingId', 'bookingNumber')
  .sort({ 'securityMetadata.riskScore': -1 })
  .limit(50);
};

adminBypassAuditSchema.statics.getPendingApprovals = function(hotelId, approverId = null) {
  const query = {
    hotelId,
    'approvalChain.status': 'pending'
  };

  if (approverId) {
    query['approvalChain.approverId'] = approverId;
  }

  return this.find(query)
  .populate('adminId', 'name email')
  .populate('bookingId', 'bookingNumber')
  .sort({ createdAt: 1 });
};

// Virtual for formatted financial impact
adminBypassAuditSchema.virtual('formattedFinancialImpact').get(function() {
  const amount = this.financialImpact.actualLoss || this.financialImpact.estimatedLoss || 0;
  const currency = this.financialImpact.currency || 'INR';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
});

// Virtual for operation duration in human readable format
adminBypassAuditSchema.virtual('formattedDuration').get(function() {
  if (!this.operationStatus.duration) return 'N/A';

  const seconds = Math.floor(this.operationStatus.duration / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
});

// Virtual for risk level classification
adminBypassAuditSchema.virtual('riskLevel').get(function() {
  const score = this.securityMetadata.riskScore || 0;

  if (score >= 80) return 'Critical';
  if (score >= 60) return 'High';
  if (score >= 40) return 'Medium';
  if (score >= 20) return 'Low';
  return 'Minimal';
});

export default mongoose.model('AdminBypassAudit', adminBypassAuditSchema);
