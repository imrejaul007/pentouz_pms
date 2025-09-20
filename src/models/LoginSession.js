import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     LoginSession:
 *       type: object
 *       required:
 *         - userId
 *         - sessionId
 *         - loginTime
 *         - ipAddress
 *         - userAgent
 *       properties:
 *         _id:
 *           type: string
 *           description: Session ID
 *         userId:
 *           type: string
 *           description: Reference to User
 *         sessionId:
 *           type: string
 *           description: Unique session identifier
 *         loginTime:
 *           type: string
 *           format: date-time
 *           description: When the session started
 *         logoutTime:
 *           type: string
 *           format: date-time
 *           description: When the session ended
 *         ipAddress:
 *           type: string
 *           description: IP address of the login
 *         userAgent:
 *           type: string
 *           description: User agent string
 *         deviceInfo:
 *           type: object
 *           properties:
 *             deviceType:
 *               type: string
 *               enum: [desktop, mobile, tablet]
 *             browser:
 *               type: string
 *             os:
 *               type: string
 *             version:
 *               type: string
 *         locationInfo:
 *           type: object
 *           properties:
 *             country:
 *               type: string
 *             city:
 *               type: string
 *             region:
 *               type: string
 *             timezone:
 *               type: string
 *             coordinates:
 *               type: object
 *               properties:
 *                 latitude:
 *                   type: number
 *                 longitude:
 *                   type: number
 *         isActive:
 *           type: boolean
 *           default: true
 *           description: Whether the session is currently active
 *         lastActivity:
 *           type: string
 *           format: date-time
 *           description: Last activity timestamp
 *         activityCount:
 *           type: number
 *           default: 0
 *           description: Number of activities in this session
 *         securityFlags:
 *           type: array
 *           items:
 *             type: string
 *           description: Security flags for this session
 *         riskScore:
 *           type: number
 *           default: 0
 *           description: Risk score for this session (0-100)
 *         mfaUsed:
 *           type: boolean
 *           default: false
 *           description: Whether MFA was used for this session
 *         sessionDuration:
 *           type: number
 *           description: Session duration in milliseconds
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const loginSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  sessionId: {
    type: String,
    required: [true, 'Session ID is required'],
    unique: true,
    index: true
  },
  loginTime: {
    type: Date,
    required: [true, 'Login time is required'],
    default: Date.now
  },
  logoutTime: {
    type: Date,
    default: null
  },
  ipAddress: {
    type: String,
    required: [true, 'IP address is required'],
    index: true
  },
  userAgent: {
    type: String,
    required: [true, 'User agent is required']
  },
  deviceInfo: {
    deviceType: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet'],
      default: 'desktop'
    },
    browser: {
      type: String,
      default: 'Unknown'
    },
    os: {
      type: String,
      default: 'Unknown'
    },
    version: {
      type: String,
      default: 'Unknown'
    }
  },
  locationInfo: {
    country: {
      type: String,
      default: 'Unknown'
    },
    city: {
      type: String,
      default: 'Unknown'
    },
    region: {
      type: String,
      default: 'Unknown'
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    coordinates: {
      latitude: {
        type: Number,
        default: null
      },
      longitude: {
        type: Number,
        default: null
      }
    }
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  activityCount: {
    type: Number,
    default: 0
  },
  securityFlags: [{
    type: String,
    enum: [
      'suspicious_ip',
      'unusual_location',
      'multiple_devices',
      'rapid_logins',
      'failed_attempts',
      'privilege_escalation',
      'data_breach_attempt',
      'bot_detected',
      'vpn_detected',
      'tor_detected'
    ]
  }],
  riskScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
    index: true
  },
  mfaUsed: {
    type: Boolean,
    default: false
  },
  sessionDuration: {
    type: Number,
    default: 0
  },
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
loginSessionSchema.index({ userId: 1, isActive: 1 });
loginSessionSchema.index({ loginTime: -1 });
loginSessionSchema.index({ ipAddress: 1, loginTime: -1 });
loginSessionSchema.index({ riskScore: -1 });
loginSessionSchema.index({ hotelId: 1, isActive: 1 });

// Virtual for session duration calculation
loginSessionSchema.virtual('calculatedDuration').get(function() {
  if (this.logoutTime) {
    return this.logoutTime.getTime() - this.loginTime.getTime();
  }
  return Date.now() - this.loginTime.getTime();
});

// Virtual for session status
loginSessionSchema.virtual('status').get(function() {
  if (!this.isActive) return 'ended';
  if (this.riskScore > 70) return 'high_risk';
  if (this.riskScore > 30) return 'medium_risk';
  return 'normal';
});

// Pre-save middleware to calculate session duration
loginSessionSchema.pre('save', function(next) {
  if (this.logoutTime && this.isActive) {
    this.sessionDuration = this.logoutTime.getTime() - this.loginTime.getTime();
    this.isActive = false;
  } else if (this.isActive) {
    this.sessionDuration = Date.now() - this.loginTime.getTime();
  }
  next();
});

// Static method to get active sessions
loginSessionSchema.statics.getActiveSessions = function(hotelId, options = {}) {
  const query = { isActive: true, hotelId };
  
  if (options.userId) {
    query.userId = options.userId;
  }
  
  if (options.minRiskScore) {
    query.riskScore = { $gte: options.minRiskScore };
  }
  
  return this.find(query)
    .populate('userId', 'name email role')
    .sort({ loginTime: -1 });
};

// Static method to get session analytics
loginSessionSchema.statics.getSessionAnalytics = function(hotelId, dateRange) {
  const matchStage = { hotelId };
  
  if (dateRange && dateRange.start && dateRange.end) {
    matchStage.loginTime = {
      $gte: new Date(dateRange.start),
      $lte: new Date(dateRange.end)
    };
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        activeSessions: { $sum: { $cond: ['$isActive', 1, 0] } },
        averageDuration: { $avg: '$sessionDuration' },
        highRiskSessions: { $sum: { $cond: [{ $gt: ['$riskScore', 70] }, 1, 0] } },
        mfaSessions: { $sum: { $cond: ['$mfaUsed', 1, 0] } },
        uniqueUsers: { $addToSet: '$userId' },
        uniqueIPs: { $addToSet: '$ipAddress' },
        byDevice: {
          $push: {
            deviceType: '$deviceInfo.deviceType',
            browser: '$deviceInfo.browser',
            os: '$deviceInfo.os'
          }
        },
        byLocation: {
          $push: {
            country: '$locationInfo.country',
            city: '$locationInfo.city'
          }
        },
        byHour: {
          $push: {
            hour: { $hour: '$loginTime' },
            dayOfWeek: { $dayOfWeek: '$loginTime' }
          }
        }
      }
    }
  ]);
};

// Static method to detect suspicious sessions
loginSessionSchema.statics.detectSuspiciousSessions = function(hotelId, options = {}) {
  const pipeline = [
    { $match: { hotelId } },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user'
      }
    },
    {
      $unwind: '$user'
    },
    {
      $addFields: {
        suspiciousFlags: {
          $cond: [
            { $gt: ['$riskScore', 50] },
            ['high_risk_score'],
            []
          ]
        },
        isUnusualLocation: {
          $cond: [
            { $in: ['unusual_location', '$securityFlags'] },
            true,
            false
          ]
        },
        isMultipleDevices: {
          $cond: [
            { $in: ['multiple_devices', '$securityFlags'] },
            true,
            false
          ]
        }
      }
    },
    {
      $match: {
        $or: [
          { riskScore: { $gt: 50 } },
          { 'securityFlags.0': { $exists: true } },
          { isUnusualLocation: true },
          { isMultipleDevices: true }
        ]
      }
    },
    {
      $sort: { riskScore: -1, loginTime: -1 }
    }
  ];
  
  if (options.limit) {
    pipeline.push({ $limit: options.limit });
  }
  
  return this.aggregate(pipeline);
};

// Instance method to update activity
loginSessionSchema.methods.updateActivity = function() {
  this.lastActivity = new Date();
  this.activityCount += 1;
  return this.save();
};

// Instance method to end session
loginSessionSchema.methods.endSession = function() {
  this.logoutTime = new Date();
  this.isActive = false;
  this.sessionDuration = this.logoutTime.getTime() - this.loginTime.getTime();
  return this.save();
};

// Instance method to add security flag
loginSessionSchema.methods.addSecurityFlag = function(flag) {
  if (!this.securityFlags.includes(flag)) {
    this.securityFlags.push(flag);
    this.calculateRiskScore();
  }
  return this.save();
};

// Instance method to calculate risk score
loginSessionSchema.methods.calculateRiskScore = function() {
  let score = 0;
  
  // Base score from security flags
  const flagScores = {
    'suspicious_ip': 20,
    'unusual_location': 25,
    'multiple_devices': 15,
    'rapid_logins': 30,
    'failed_attempts': 35,
    'privilege_escalation': 50,
    'data_breach_attempt': 60,
    'bot_detected': 40,
    'vpn_detected': 10,
    'tor_detected': 45
  };
  
  this.securityFlags.forEach(flag => {
    score += flagScores[flag] || 0;
  });
  
  // Additional risk factors
  if (!this.mfaUsed) score += 5;
  if (this.activityCount > 100) score += 10;
  
  this.riskScore = Math.min(score, 100);
  return this.riskScore;
};

export default mongoose.model('LoginSession', loginSessionSchema);
