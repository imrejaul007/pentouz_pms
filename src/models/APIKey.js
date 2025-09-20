import mongoose from 'mongoose';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const apiKeySchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'API Key name is required'],
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Key Management
  keyId: {
    type: String,
    required: true,
    unique: true
  },
  keyHash: {
    type: String,
    required: true,
    select: false // Never return in queries
  },
  keyPrefix: {
    type: String,
    required: true // For identifying keys (pk_live_, pk_test_, etc.)
  },
  
  // Ownership
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
  
  // Access Control
  type: {
    type: String,
    enum: ['read', 'write', 'admin'],
    required: true,
    default: 'read'
  },
  permissions: [{
    resource: {
      type: String,
      required: true // e.g., 'reservations', 'rooms', 'guests'
    },
    actions: [{
      type: String,
      enum: ['create', 'read', 'update', 'delete']
    }]
  }],
  
  // Environment
  environment: {
    type: String,
    enum: ['sandbox', 'production'],
    default: 'sandbox'
  },
  
  // Rate Limiting
  rateLimit: {
    requestsPerMinute: {
      type: Number,
      default: 60
    },
    requestsPerHour: {
      type: Number,
      default: 1000
    },
    requestsPerDay: {
      type: Number,
      default: 10000
    }
  },
  
  // IP Restrictions
  allowedIPs: [{
    type: String,
    validate: {
      validator: function(ip) {
        // Basic IP validation - can be enhanced
        return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) || ip === '*';
      },
      message: 'Invalid IP address format'
    }
  }],
  
  // Domain Restrictions  
  allowedDomains: [{
    type: String
  }],
  
  // Status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Expiry
  expiresAt: {
    type: Date,
    index: true
  },
  
  // Usage Statistics
  usage: {
    totalRequests: {
      type: Number,
      default: 0
    },
    lastUsed: {
      type: Date
    },
    lastUserAgent: String,
    lastIP: String
  },
  
  // Rate Limit Tracking (Reset daily)
  rateLimitUsage: {
    today: {
      date: Date,
      requests: {
        type: Number,
        default: 0
      }
    },
    thisHour: {
      hour: Date,
      requests: {
        type: Number,
        default: 0
      }
    },
    thisMinute: {
      minute: Date,
      requests: {
        type: Number,
        default: 0
      }
    }
  },
  
  // Metadata
  tags: [String],
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes
apiKeySchema.index({ hotelId: 1, isActive: 1, createdAt: -1 });
apiKeySchema.index({ keyId: 1 });
apiKeySchema.index({ expiresAt: 1 });
apiKeySchema.index({ 'usage.lastUsed': -1 });

// Generate API Key
apiKeySchema.statics.generateKey = function(type, environment) {
  const prefix = `${type === 'admin' ? 'ak' : type === 'write' ? 'wk' : 'rk'}_${environment === 'production' ? 'live' : 'test'}`;
  const randomBytes = crypto.randomBytes(32).toString('hex');
  return `${prefix}_${randomBytes}`;
};

// Hash API Key
apiKeySchema.methods.hashKey = async function(key) {
  return await bcrypt.hash(key, 12);
};

// Verify API Key
apiKeySchema.statics.verifyKey = async function(providedKey) {
  try {
    const keyId = providedKey.split('_')[2]; // Extract ID portion
    const apiKey = await this.findOne({ 
      keyId: providedKey,
      isActive: true
    }).select('+keyHash');
    
    if (!apiKey) return null;
    
    // Check expiry
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return null;
    }
    
    const isValid = await bcrypt.compare(providedKey, apiKey.keyHash);
    return isValid ? apiKey : null;
  } catch (error) {
    return null;
  }
};

// Update usage statistics
apiKeySchema.methods.recordUsage = async function(req) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
  const thisMinute = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());
  
  // Update usage statistics
  this.usage.totalRequests += 1;
  this.usage.lastUsed = now;
  this.usage.lastUserAgent = req.headers['user-agent'];
  this.usage.lastIP = req.ip;
  
  // Update rate limit tracking
  if (!this.rateLimitUsage.today.date || this.rateLimitUsage.today.date.getTime() !== today.getTime()) {
    this.rateLimitUsage.today = { date: today, requests: 1 };
  } else {
    this.rateLimitUsage.today.requests += 1;
  }
  
  if (!this.rateLimitUsage.thisHour.hour || this.rateLimitUsage.thisHour.hour.getTime() !== thisHour.getTime()) {
    this.rateLimitUsage.thisHour = { hour: thisHour, requests: 1 };
  } else {
    this.rateLimitUsage.thisHour.requests += 1;
  }
  
  if (!this.rateLimitUsage.thisMinute.minute || this.rateLimitUsage.thisMinute.minute.getTime() !== thisMinute.getTime()) {
    this.rateLimitUsage.thisMinute = { minute: thisMinute, requests: 1 };
  } else {
    this.rateLimitUsage.thisMinute.requests += 1;
  }
  
  await this.save();
};

// Check rate limits
apiKeySchema.methods.checkRateLimit = function() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
  const thisMinute = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());
  
  // Check daily limit
  if (this.rateLimitUsage.today.date && 
      this.rateLimitUsage.today.date.getTime() === today.getTime() &&
      this.rateLimitUsage.today.requests >= this.rateLimit.requestsPerDay) {
    return { allowed: false, resetTime: new Date(today.getTime() + 24 * 60 * 60 * 1000), limit: 'day' };
  }
  
  // Check hourly limit
  if (this.rateLimitUsage.thisHour.hour && 
      this.rateLimitUsage.thisHour.hour.getTime() === thisHour.getTime() &&
      this.rateLimitUsage.thisHour.requests >= this.rateLimit.requestsPerHour) {
    return { allowed: false, resetTime: new Date(thisHour.getTime() + 60 * 60 * 1000), limit: 'hour' };
  }
  
  // Check minute limit
  if (this.rateLimitUsage.thisMinute.minute && 
      this.rateLimitUsage.thisMinute.minute.getTime() === thisMinute.getTime() &&
      this.rateLimitUsage.thisMinute.requests >= this.rateLimit.requestsPerMinute) {
    return { allowed: false, resetTime: new Date(thisMinute.getTime() + 60 * 1000), limit: 'minute' };
  }
  
  return { allowed: true };
};

// Pre-save middleware
apiKeySchema.pre('save', async function(next) {
  // Generate keyId if not exists
  if (!this.keyId) {
    this.keyId = this.constructor.generateKey(this.type, this.environment);
    this.keyHash = await this.hashKey(this.keyId);
    
    // Extract prefix for easy identification
    this.keyPrefix = this.keyId.substring(0, this.keyId.lastIndexOf('_'));
  }
  
  next();
});

const APIKey = mongoose.model('APIKey', apiKeySchema);
export default APIKey;
