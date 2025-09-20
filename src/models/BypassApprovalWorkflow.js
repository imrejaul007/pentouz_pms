import mongoose from 'mongoose';
import crypto from 'crypto';

/**
 * @swagger
 * components:
 *   schemas:
 *     BypassApprovalWorkflow:
 *       type: object
 *       required:
 *         - hotelId
 *         - bypassAuditId
 *         - initiatedBy
 *         - approvalLevel
 *       properties:
 *         _id:
 *           type: string
 *         workflowId:
 *           type: string
 *           description: Unique workflow identifier
 *         hotelId:
 *           type: string
 *           description: Hotel ID for multi-tenant isolation
 *         bypassAuditId:
 *           type: string
 *           description: Reference to the bypass audit record
 *         initiatedBy:
 *           type: string
 *           description: Admin who initiated the bypass request
 *         approvalChain:
 *           type: array
 *           description: Sequential approval chain
 *         currentLevel:
 *           type: number
 *           description: Current approval level
 *         workflowStatus:
 *           type: string
 *           description: Overall workflow status
 *         approvalRules:
 *           type: object
 *           description: Rules that triggered this approval workflow
 */

const bypassApprovalWorkflowSchema = new mongoose.Schema({
  // Unique workflow identifier
  workflowId: {
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

  // Reference to the bypass audit record
  bypassAuditId: {
    type: mongoose.Schema.ObjectId,
    ref: 'AdminBypassAudit',
    required: true,
    index: true
  },

  // Admin who initiated the bypass request
  initiatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Sequential approval chain
  approvalChain: [{
    level: {
      type: Number,
      required: true
    },
    requiredRole: {
      type: String,
      enum: ['manager', 'supervisor', 'director', 'owner', 'admin'],
      required: true
    },
    specificApproverId: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    assignedTo: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'escalated', 'expired', 'skipped'],
      default: 'pending'
    },
    requestedAt: {
      type: Date,
      default: Date.now
    },
    respondedAt: Date,
    responseTime: Number, // milliseconds
    approvalMethod: {
      type: String,
      enum: ['web', 'mobile', 'email', 'sms', 'automatic', 'delegated']
    },
    approverNotes: {
      type: String,
      maxlength: 500
    },
    delegatedTo: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    delegationReason: {
      type: String,
      maxlength: 200
    },
    autoApproved: {
      type: Boolean,
      default: false
    },
    autoApprovalReason: String,
    ipAddress: String,
    userAgent: String,
    geolocation: {
      latitude: Number,
      longitude: Number,
      city: String,
      country: String
    },
    securityFlags: [{
      flag: String,
      severity: String,
      details: String,
      timestamp: {
        type: Date,
        default: Date.now
      }
    }]
  }],

  // Current approval level
  currentLevel: {
    type: Number,
    default: 1,
    index: true
  },

  // Overall workflow status
  workflowStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'escalated', 'expired', 'cancelled'],
    default: 'pending',
    index: true
  },

  // Approval rules that triggered this workflow
  approvalRules: {
    triggeredBy: [{
      rule: {
        type: String,
        enum: [
          'high_risk_score',
          'high_financial_impact', 
          'critical_security_flags',
          'after_hours_operation',
          'repeat_offender',
          'unusual_category',
          'management_override_required',
          'compliance_requirement',
          'custom_rule'
        ]
      },
      threshold: mongoose.Schema.Types.Mixed,
      actualValue: mongoose.Schema.Types.Mixed,
      priority: {
        type: Number,
        default: 1
      }
    }],
    requiredApprovals: {
      type: Number,
      default: 1
    },
    allowParallel: {
      type: Boolean,
      default: false
    },
    escalationEnabled: {
      type: Boolean,
      default: true
    },
    timeoutMinutes: {
      type: Number,
      default: 60 // 1 hour default
    },
    autoApprovalAllowed: {
      type: Boolean,
      default: false
    },
    emergencyBypass: {
      type: Boolean,
      default: false
    }
  },

  // Timing and performance tracking
  timing: {
    initiatedAt: {
      type: Date,
      default: Date.now
    },
    firstResponseAt: Date,
    completedAt: Date,
    totalDuration: Number, // milliseconds
    averageResponseTime: Number, // milliseconds
    timeoutAt: Date,
    escalatedAt: Date,
    remindersSent: {
      type: Number,
      default: 0
    },
    lastReminderAt: Date
  },

  // Escalation settings
  escalation: {
    enabled: {
      type: Boolean,
      default: true
    },
    timeoutMinutes: {
      type: Number,
      default: 60
    },
    escalationChain: [{
      level: Number,
      escalateTo: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      escalateToRole: {
        type: String,
        enum: ['manager', 'supervisor', 'director', 'owner']
      },
      timeoutMinutes: {
        type: Number,
        default: 30
      },
      notificationMethods: [{
        type: String,
        enum: ['email', 'sms', 'push', 'slack', 'teams']
      }]
    }],
    currentEscalationLevel: {
      type: Number,
      default: 0
    },
    maxEscalationLevel: {
      type: Number,
      default: 3
    },
    finalEscalationAction: {
      type: String,
      enum: ['auto_approve', 'auto_reject', 'manual_review'],
      default: 'manual_review'
    }
  },

  // Notification tracking
  notifications: {
    sent: [{
      type: {
        type: String,
        enum: ['approval_request', 'reminder', 'escalation', 'timeout_warning', 'completion']
      },
      method: {
        type: String,
        enum: ['email', 'sms', 'push', 'slack', 'teams', 'webhook']
      },
      recipient: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      sentAt: {
        type: Date,
        default: Date.now
      },
      delivered: Boolean,
      opened: Boolean,
      responded: Boolean,
      messageId: String,
      errorMessage: String
    }],
    preferences: {
      immediateNotification: {
        type: Boolean,
        default: true
      },
      reminderInterval: {
        type: Number,
        default: 15 // minutes
      },
      maxReminders: {
        type: Number,
        default: 3
      },
      escalationNotification: {
        type: Boolean,
        default: true
      }
    }
  },

  // Compliance and audit
  compliance: {
    regulatoryRequirement: String,
    complianceNotes: String,
    auditTrail: [{
      action: String,
      performedBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      details: mongoose.Schema.Types.Mixed,
      ipAddress: String,
      userAgent: String
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

  // Integration hooks
  integrations: {
    webhooks: [{
      event: {
        type: String,
        enum: ['workflow_started', 'approval_received', 'workflow_completed', 'workflow_rejected', 'escalation_triggered']
      },
      url: String,
      headers: mongoose.Schema.Types.Mixed,
      enabled: {
        type: Boolean,
        default: true
      },
      retryCount: {
        type: Number,
        default: 0
      },
      lastTriggered: Date,
      lastError: String
    }],
    slackChannel: String,
    teamsChannel: String,
    emailTemplate: String
  },

  // Analytics and reporting
  analytics: {
    businessHours: {
      type: Boolean,
      default: true
    },
    weekday: String,
    shift: String,
    urgencyLevel: String,
    complexity: {
      type: String,
      enum: ['simple', 'moderate', 'complex', 'critical'],
      default: 'simple'
    },
    approvalPath: String, // Comma-separated list of approval levels taken
    bypassReasons: [String],
    stakeholdersInvolved: Number,
    communicationChannels: [String]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
bypassApprovalWorkflowSchema.index({ hotelId: 1, workflowStatus: 1, createdAt: -1 });
bypassApprovalWorkflowSchema.index({ initiatedBy: 1, createdAt: -1 });
bypassApprovalWorkflowSchema.index({ 'approvalChain.assignedTo': 1, 'approvalChain.status': 1 });
bypassApprovalWorkflowSchema.index({ currentLevel: 1, workflowStatus: 1 });
bypassApprovalWorkflowSchema.index({ 'timing.timeoutAt': 1 });

// Compound indexes for common queries
bypassApprovalWorkflowSchema.index({ hotelId: 1, workflowStatus: 1, currentLevel: 1 });
bypassApprovalWorkflowSchema.index({ 'approvalChain.assignedTo': 1, workflowStatus: 1, createdAt: -1 });

// TTL index for data retention
bypassApprovalWorkflowSchema.index({
  createdAt: 1
}, {
  expireAfterSeconds: 220752000 // 7 years in seconds
});

// Pre-save middleware
bypassApprovalWorkflowSchema.pre('save', async function(next) {
  // Generate unique workflow ID if not provided
  if (!this.workflowId) {
    const timestamp = Date.now().toString();
    const random = crypto.randomBytes(4).toString('hex');
    this.workflowId = `APPROVAL_${timestamp}_${random.toUpperCase()}`;
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

  // Set timeout date
  if (!this.timing.timeoutAt && this.approvalRules.timeoutMinutes) {
    this.timing.timeoutAt = new Date(Date.now() + this.approvalRules.timeoutMinutes * 60 * 1000);
  }

  // Calculate total duration if completed
  if (this.workflowStatus === 'approved' || this.workflowStatus === 'rejected') {
    if (this.timing.completedAt) {
      this.timing.totalDuration = this.timing.completedAt - this.timing.initiatedAt;
    }

    // Calculate average response time
    const responses = this.approvalChain.filter(a => a.responseTime);
    if (responses.length > 0) {
      this.timing.averageResponseTime = responses.reduce((sum, a) => sum + a.responseTime, 0) / responses.length;
    }
  }

  next();
});

// Instance methods
bypassApprovalWorkflowSchema.methods.addApprovalLevel = function(level, requiredRole, specificApproverId = null, timeoutMinutes = 60) {
  this.approvalChain.push({
    level,
    requiredRole,
    specificApproverId,
    status: 'pending',
    requestedAt: new Date()
  });

  // Update timeout if this is a longer requirement
  if (timeoutMinutes > this.approvalRules.timeoutMinutes) {
    this.approvalRules.timeoutMinutes = timeoutMinutes;
    this.timing.timeoutAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);
  }
};

bypassApprovalWorkflowSchema.methods.assignApprover = function(level, approverId) {
  const approval = this.approvalChain.find(a => a.level === level);
  if (approval) {
    approval.assignedTo = approverId;
    approval.requestedAt = new Date();
  }
};

bypassApprovalWorkflowSchema.methods.processApproval = function(level, approverId, status, notes, method = 'web', ipAddress, userAgent) {
  const approval = this.approvalChain.find(a => a.level === level);
  if (!approval) {
    throw new Error(`Approval level ${level} not found`);
  }

  const now = new Date();
  approval.status = status;
  approval.respondedAt = now;
  approval.responseTime = now - approval.requestedAt;
  approval.approverNotes = notes;
  approval.approvalMethod = method;
  approval.ipAddress = ipAddress;
  approval.userAgent = userAgent;

  // Update workflow status
  this.updateWorkflowStatus();

  // Add to compliance audit trail
  this.compliance.auditTrail.push({
    action: `approval_${status}`,
    performedBy: approverId,
    timestamp: now,
    details: {
      level,
      notes,
      method,
      responseTime: approval.responseTime
    },
    ipAddress,
    userAgent
  });

  // Set first response time if this is the first response
  if (!this.timing.firstResponseAt) {
    this.timing.firstResponseAt = now;
  }
};

bypassApprovalWorkflowSchema.methods.updateWorkflowStatus = function() {
  const approvals = this.approvalChain;
  const allApproved = approvals.every(a => a.status === 'approved' || a.status === 'skipped');
  const anyRejected = approvals.some(a => a.status === 'rejected');
  const anyExpired = approvals.some(a => a.status === 'expired');

  if (anyRejected) {
    this.workflowStatus = 'rejected';
    this.timing.completedAt = new Date();
  } else if (anyExpired) {
    this.workflowStatus = 'expired';
    this.timing.completedAt = new Date();
  } else if (allApproved) {
    this.workflowStatus = 'approved';
    this.timing.completedAt = new Date();
  } else {
    // Find next pending approval
    const nextPending = approvals.find(a => a.status === 'pending');
    if (nextPending) {
      this.currentLevel = nextPending.level;
    }
  }
};

bypassApprovalWorkflowSchema.methods.escalateWorkflow = function(reason = 'timeout') {
  const currentApproval = this.approvalChain.find(a => a.level === this.currentLevel);
  if (currentApproval && currentApproval.status === 'pending') {
    currentApproval.status = 'escalated';
    
    this.escalation.currentEscalationLevel++;
    this.timing.escalatedAt = new Date();
    
    // Add to audit trail
    this.compliance.auditTrail.push({
      action: 'workflow_escalated',
      timestamp: new Date(),
      details: {
        reason,
        fromLevel: this.currentLevel,
        escalationLevel: this.escalation.currentEscalationLevel
      }
    });

    this.workflowStatus = 'escalated';
  }
};

bypassApprovalWorkflowSchema.methods.delegateApproval = function(fromLevel, toApproverId, delegationReason) {
  const approval = this.approvalChain.find(a => a.level === fromLevel);
  if (approval && approval.status === 'pending') {
    approval.delegatedTo = toApproverId;
    approval.delegationReason = delegationReason;
    approval.assignedTo = toApproverId;
    
    // Add to audit trail
    this.compliance.auditTrail.push({
      action: 'approval_delegated',
      performedBy: approval.assignedTo,
      timestamp: new Date(),
      details: {
        level: fromLevel,
        delegatedTo: toApproverId,
        reason: delegationReason
      }
    });
  }
};

bypassApprovalWorkflowSchema.methods.addNotification = function(type, method, recipient, messageId) {
  this.notifications.sent.push({
    type,
    method,
    recipient,
    sentAt: new Date(),
    messageId,
    delivered: false,
    opened: false,
    responded: false
  });
};

bypassApprovalWorkflowSchema.methods.markNotificationDelivered = function(messageId) {
  const notification = this.notifications.sent.find(n => n.messageId === messageId);
  if (notification) {
    notification.delivered = true;
  }
};

bypassApprovalWorkflowSchema.methods.isExpired = function() {
  return this.timing.timeoutAt && new Date() > this.timing.timeoutAt;
};

bypassApprovalWorkflowSchema.methods.canEscalate = function() {
  return this.escalation.enabled && 
         this.escalation.currentEscalationLevel < this.escalation.maxEscalationLevel &&
         this.workflowStatus === 'pending';
};

// Static methods
bypassApprovalWorkflowSchema.statics.createWorkflow = async function(workflowData) {
  const workflow = new this({
    hotelId: workflowData.hotelId,
    bypassAuditId: workflowData.bypassAuditId,
    initiatedBy: workflowData.initiatedBy,
    approvalRules: workflowData.approvalRules,
    approvalChain: workflowData.approvalChain || [],
    escalation: workflowData.escalation || {}
  });

  // Add initial approval levels based on rules
  if (workflowData.approvalLevels && workflowData.approvalLevels.length > 0) {
    workflowData.approvalLevels.forEach((level, index) => {
      workflow.addApprovalLevel(
        index + 1,
        level.requiredRole,
        level.specificApproverId,
        level.timeoutMinutes
      );
    });
  }

  return await workflow.save();
};

bypassApprovalWorkflowSchema.statics.getPendingApprovals = function(approverId, hotelId) {
  return this.find({
    hotelId,
    'approvalChain.assignedTo': approverId,
    'approvalChain.status': 'pending',
    workflowStatus: 'pending'
  })
  .populate('bypassAuditId', 'bypassId reason financialImpact')
  .populate('initiatedBy', 'name email')
  .sort({ createdAt: 1 });
};

bypassApprovalWorkflowSchema.statics.getWorkflowsByStatus = function(hotelId, status, limit = 50) {
  return this.find({ hotelId, workflowStatus: status })
    .populate('bypassAuditId', 'bypassId reason')
    .populate('initiatedBy', 'name email')
    .populate('approvalChain.assignedTo', 'name email role')
    .sort({ createdAt: -1 })
    .limit(limit);
};

bypassApprovalWorkflowSchema.statics.getExpiredWorkflows = function(hotelId = null) {
  const query = {
    workflowStatus: 'pending',
    'timing.timeoutAt': { $lt: new Date() }
  };
  
  if (hotelId) {
    query.hotelId = hotelId;
  }

  return this.find(query)
    .populate('bypassAuditId', 'bypassId')
    .populate('initiatedBy', 'name email');
};

bypassApprovalWorkflowSchema.statics.getWorkflowStatistics = async function(hotelId, timeRange = 30) {
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
        totalWorkflows: { $sum: 1 },
        approvedWorkflows: {
          $sum: { $cond: [{ $eq: ['$workflowStatus', 'approved'] }, 1, 0] }
        },
        rejectedWorkflows: {
          $sum: { $cond: [{ $eq: ['$workflowStatus', 'rejected'] }, 1, 0] }
        },
        expiredWorkflows: {
          $sum: { $cond: [{ $eq: ['$workflowStatus', 'expired'] }, 1, 0] }
        },
        averageResponseTime: { $avg: '$timing.averageResponseTime' },
        averageTotalDuration: { $avg: '$timing.totalDuration' },
        escalatedCount: {
          $sum: { $cond: [{ $gt: ['$escalation.currentEscalationLevel', 0] }, 1, 0] }
        }
      }
    }
  ]);

  return stats[0] || {
    totalWorkflows: 0,
    approvedWorkflows: 0,
    rejectedWorkflows: 0,
    expiredWorkflows: 0,
    averageResponseTime: 0,
    averageTotalDuration: 0,
    escalatedCount: 0
  };
};

// Virtual for approval completion percentage
bypassApprovalWorkflowSchema.virtual('completionPercentage').get(function() {
  const totalLevels = this.approvalChain.length;
  const completedLevels = this.approvalChain.filter(a => 
    a.status === 'approved' || a.status === 'rejected' || a.status === 'skipped'
  ).length;

  return totalLevels > 0 ? Math.round((completedLevels / totalLevels) * 100) : 0;
});

// Virtual for time remaining
bypassApprovalWorkflowSchema.virtual('timeRemaining').get(function() {
  if (!this.timing.timeoutAt) return null;
  
  const now = new Date();
  const timeRemaining = this.timing.timeoutAt - now;
  
  return timeRemaining > 0 ? timeRemaining : 0;
});

// Virtual for current approver
bypassApprovalWorkflowSchema.virtual('currentApprover').get(function() {
  const currentApproval = this.approvalChain.find(a => a.level === this.currentLevel);
  return currentApproval ? currentApproval.assignedTo : null;
});

export default mongoose.model('BypassApprovalWorkflow', bypassApprovalWorkflowSchema);
