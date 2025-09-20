import mongoose from 'mongoose';

const apiMetricsSchema = new mongoose.Schema({
  // Scope
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  
  // Time Period
  period: {
    type: String,
    required: true,
    enum: ['minute', 'hour', 'day', 'month'],
    index: true
  },
  timestamp: {
    type: Date,
    required: true
    // Note: index defined separately below for compound indexes
  },
  
  // Endpoint Information
  endpoint: {
    method: String,
    path: String,
    category: String // e.g., 'reservations', 'rooms', 'guests'
  },
  
  // Request Metrics
  requests: {
    total: {
      type: Number,
      default: 0
    },
    successful: {
      type: Number,
      default: 0
    },
    failed: {
      type: Number,
      default: 0
    },
    byStatusCode: {
      type: Map,
      of: Number,
      default: new Map()
    }
  },
  
  // Performance Metrics
  performance: {
    averageResponseTime: {
      type: Number,
      default: 0
    },
    minResponseTime: {
      type: Number,
      default: 0
    },
    maxResponseTime: {
      type: Number,
      default: 0
    },
    p50ResponseTime: Number, // 50th percentile
    p95ResponseTime: Number, // 95th percentile
    p99ResponseTime: Number, // 99th percentile
    responseTimes: [Number] // Store sample response times for percentile calculation
  },
  
  // Error Analysis
  errors: {
    total: {
      type: Number,
      default: 0
    },
    byType: {
      type: Map,
      of: Number,
      default: new Map() // 'validation', 'auth', 'server', 'timeout', etc.
    },
    byEndpoint: {
      type: Map,
      of: Number,
      default: new Map()
    },
    topErrors: [{
      message: String,
      count: Number,
      lastOccurred: Date
    }]
  },
  
  // API Key Usage
  apiKeyUsage: {
    totalKeys: {
      type: Number,
      default: 0
    },
    activeKeys: {
      type: Number,
      default: 0
    },
    topKeys: [{
      keyId: String,
      requests: Number,
      errors: Number
    }],
    byKeyType: {
      type: Map,
      of: Number,
      default: new Map() // 'read', 'write', 'admin'
    }
  },
  
  // User Metrics
  users: {
    total: {
      type: Number,
      default: 0
    },
    authenticated: {
      type: Number,
      default: 0
    },
    anonymous: {
      type: Number,
      default: 0
    },
    byRole: {
      type: Map,
      of: Number,
      default: new Map()
    }
  },
  
  // Geographic Data
  geographic: {
    countries: {
      type: Map,
      of: Number,
      default: new Map()
    },
    regions: {
      type: Map,
      of: Number,
      default: new Map()
    },
    topLocations: [{
      country: String,
      region: String,
      requests: Number
    }]
  },
  
  // Traffic Sources
  sources: {
    userAgents: {
      type: Map,
      of: Number,
      default: new Map()
    },
    referrers: {
      type: Map,
      of: Number,
      default: new Map()
    },
    topSources: [{
      type: String, // 'browser', 'mobile', 'api', 'bot'
      name: String,
      requests: Number
    }]
  },
  
  // Bandwidth Usage
  bandwidth: {
    totalBytes: {
      type: Number,
      default: 0
    },
    requestBytes: {
      type: Number,
      default: 0
    },
    responseBytes: {
      type: Number,
      default: 0
    },
    averageRequestSize: {
      type: Number,
      default: 0
    },
    averageResponseSize: {
      type: Number,
      default: 0
    }
  },
  
  // Rate Limiting
  rateLimiting: {
    totalLimited: {
      type: Number,
      default: 0
    },
    byEndpoint: {
      type: Map,
      of: Number,
      default: new Map()
    },
    byApiKey: {
      type: Map,
      of: Number,
      default: new Map()
    }
  },
  
  // Webhook Metrics
  webhooks: {
    totalDeliveries: {
      type: Number,
      default: 0
    },
    successful: {
      type: Number,
      default: 0
    },
    failed: {
      type: Number,
      default: 0
    },
    averageDeliveryTime: {
      type: Number,
      default: 0
    },
    byEndpoint: {
      type: Map,
      of: {
        delivered: Number,
        failed: Number,
        averageTime: Number
      },
      default: new Map()
    }
  },
  
  // Security Metrics
  security: {
    suspiciousActivities: {
      type: Number,
      default: 0
    },
    blockedRequests: {
      type: Number,
      default: 0
    },
    authFailures: {
      type: Number,
      default: 0
    },
    unusualPatterns: [{
      type: String,
      description: String,
      count: Number,
      severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical']
      }
    }]
  }
}, {
  timestamps: true,
  suppressReservedKeysWarning: true // Suppresses warning for 'errors' field
});

// Compound indexes for efficient querying
apiMetricsSchema.index({ hotelId: 1, period: 1, timestamp: -1 });
apiMetricsSchema.index({ hotelId: 1, 'endpoint.category': 1, timestamp: -1 });
apiMetricsSchema.index({ hotelId: 1, 'endpoint.path': 1, timestamp: -1 });
apiMetricsSchema.index({ hotelId: 1, 'endpoint.method': 1, 'endpoint.path': 1 }); // For endpoint lookups
apiMetricsSchema.index({ timestamp: 1 }); // For cleanup

// Performance optimization indexes
apiMetricsSchema.index({ hotelId: 1, timestamp: -1, period: 1 }); // Dashboard queries
apiMetricsSchema.index({ hotelId: 1, 'requests.total': -1 }); // Top endpoints
apiMetricsSchema.index({ 'endpoint.method': 1, 'endpoint.path': 1, hotelId: 1 }); // Endpoint stats

// TTL index for data retention
apiMetricsSchema.index({ timestamp: 1 }, {
  expireAfterSeconds: 60 * 60 * 24 * 365 // 1 year retention
});

// Static methods
apiMetricsSchema.statics.recordMetric = async function(data) {
  const {
    hotelId,
    period,
    timestamp,
    endpoint,
    requests,
    performance,
    errors,
    apiKeyUsage,
    users,
    geographic,
    sources,
    bandwidth,
    rateLimiting,
    webhooks,
    security
  } = data;
  
  const filter = {
    hotelId,
    period,
    timestamp: this.normalizeTimestamp(timestamp, period),
    'endpoint.method': endpoint?.method,
    'endpoint.path': endpoint?.path
  };
  
  const update = {
    $inc: {
      'requests.total': requests?.total || 0,
      'requests.successful': requests?.successful || 0,
      'requests.failed': requests?.failed || 0,
      'errors.total': errors?.total || 0,
      'bandwidth.totalBytes': bandwidth?.totalBytes || 0,
      'rateLimiting.totalLimited': rateLimiting?.totalLimited || 0,
      'webhooks.totalDeliveries': webhooks?.totalDeliveries || 0,
      'security.suspiciousActivities': security?.suspiciousActivities || 0
    },
    $set: {
      'endpoint.category': endpoint?.category
    }
  };
  
  // Handle performance metrics with averages
  if (performance?.responseTime) {
    update.$push = {
      'performance.responseTimes': {
        $each: [performance.responseTime],
        $slice: -1000 // Keep last 1000 samples
      }
    };
  }
  
  return await this.findOneAndUpdate(filter, update, { 
    upsert: true, 
    new: true,
    setDefaultsOnInsert: true
  });
};

// Normalize timestamp based on period
apiMetricsSchema.statics.normalizeTimestamp = function(timestamp, period) {
  const date = new Date(timestamp);
  
  switch (period) {
    case 'minute':
      return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 
                     date.getHours(), date.getMinutes());
    case 'hour':
      return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 
                     date.getHours());
    case 'day':
      return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    case 'month':
      return new Date(date.getFullYear(), date.getMonth());
    default:
      return date;
  }
};

// Calculate percentiles from response times
apiMetricsSchema.methods.calculatePercentiles = function() {
  if (!this.performance.responseTimes || this.performance.responseTimes.length === 0) {
    return;
  }
  
  const times = this.performance.responseTimes.sort((a, b) => a - b);
  const length = times.length;
  
  this.performance.p50ResponseTime = times[Math.floor(length * 0.5)];
  this.performance.p95ResponseTime = times[Math.floor(length * 0.95)];
  this.performance.p99ResponseTime = times[Math.floor(length * 0.99)];
  
  this.performance.minResponseTime = times[0];
  this.performance.maxResponseTime = times[length - 1];
  
  const sum = times.reduce((acc, time) => acc + time, 0);
  this.performance.averageResponseTime = sum / length;
};

// Aggregate metrics for dashboard (optimized)
apiMetricsSchema.statics.getDashboardMetrics = async function(hotelId, timeRange = '24h') {
  const now = new Date();
  let startTime;
  let period = 'hour';

  switch (timeRange) {
    case '1h':
      startTime = new Date(now.getTime() - 60 * 60 * 1000);
      period = 'minute';
      break;
    case '24h':
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      period = 'hour';
      break;
    case '7d':
      startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      period = 'day';
      break;
    case '30d':
      startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      period = 'day';
      break;
    default:
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  // Optimized pipeline with proper index usage
  const pipeline = [
    {
      $match: {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        timestamp: { $gte: startTime },
        period: period
      }
    },
    {
      $group: {
        _id: null,
        totalRequests: { $sum: '$requests.total' },
        successfulRequests: { $sum: '$requests.successful' },
        failedRequests: { $sum: '$requests.failed' },
        totalErrors: { $sum: '$errors.total' },
        avgResponseTime: { $avg: '$performance.averageResponseTime' },
        totalBandwidth: { $sum: '$bandwidth.totalBytes' },
        rateLimited: { $sum: '$rateLimiting.totalLimited' },
        requestsToday: {
          $sum: {
            $cond: {
              if: { $gte: ['$timestamp', new Date(now.setHours(0, 0, 0, 0))] },
              then: '$requests.total',
              else: 0
            }
          }
        }
      }
    }
  ];

  const [summary] = await this.aggregate(pipeline).allowDiskUse(true);

  return {
    totalRequests: summary?.totalRequests || 0,
    requestsToday: summary?.requestsToday || 0,
    successfulRequests: summary?.successfulRequests || 0,
    failedRequests: summary?.failedRequests || 0,
    errorRate: summary?.totalRequests > 0
      ? ((summary.totalErrors || 0) / summary.totalRequests * 100).toFixed(2)
      : 0,
    averageResponseTime: Math.round(summary?.avgResponseTime || 0),
    totalBandwidth: summary?.totalBandwidth || 0,
    rateLimited: summary?.rateLimited || 0
  };
};

// Get top endpoints (optimized)
apiMetricsSchema.statics.getTopEndpoints = async function(hotelId, timeRange = '24h', limit = 10) {
  const now = new Date();
  let startTime;

  switch (timeRange) {
    case '24h':
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    default:
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  return await this.aggregate([
    {
      $match: {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        timestamp: { $gte: startTime },
        'requests.total': { $gt: 0 } // Only include endpoints with requests
      }
    },
    {
      $group: {
        _id: {
          method: '$endpoint.method',
          path: '$endpoint.path',
          category: '$endpoint.category'
        },
        totalRequests: { $sum: '$requests.total' },
        totalErrors: { $sum: '$errors.total' },
        avgResponseTime: { $avg: '$performance.averageResponseTime' }
      }
    },
    {
      $match: {
        totalRequests: { $gt: 0 } // Ensure we have actual data
      }
    },
    {
      $sort: { totalRequests: -1 }
    },
    {
      $limit: limit
    },
    {
      $project: {
        _id: 0,
        endpoint: {
          $concat: ['$_id.method', ' ', '$_id.path']
        },
        method: '$_id.method',
        path: '$_id.path',
        category: '$_id.category',
        requests: '$totalRequests',
        errors: '$totalErrors',
        avgResponseTime: { $round: ['$avgResponseTime', 0] },
        errorRate: {
          $cond: {
            if: { $gt: ['$totalRequests', 0] },
            then: { $round: [{ $multiply: [{ $divide: ['$totalErrors', '$totalRequests'] }, 100] }, 2] },
            else: 0
          }
        }
      }
    }
  ]).allowDiskUse(true);
};

// Fast endpoint usage lookup
apiMetricsSchema.statics.getEndpointUsage = async function(hotelId, method, path, timeRange = '24h') {
  const now = new Date();
  let startTime;

  switch (timeRange) {
    case '1h':
      startTime = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case '24h':
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    default:
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  const [result] = await this.aggregate([
    {
      $match: {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        'endpoint.method': method,
        'endpoint.path': path,
        timestamp: { $gte: startTime }
      }
    },
    {
      $group: {
        _id: null,
        totalRequests: { $sum: '$requests.total' },
        totalErrors: { $sum: '$errors.total' },
        avgResponseTime: { $avg: '$performance.averageResponseTime' }
      }
    }
  ]);

  return {
    requests: result?.totalRequests || 0,
    errors: result?.totalErrors || 0,
    avgResponseTime: Math.round(result?.avgResponseTime || 0),
    errorRate: result?.totalRequests > 0
      ? ((result.totalErrors || 0) / result.totalRequests * 100).toFixed(2)
      : 0
  };
};

// Pre-hook to ensure indexes
apiMetricsSchema.pre('save', function() {
  // Ensure timestamp is indexed properly for queries
  if (this.isNew && !this.timestamp) {
    this.timestamp = new Date();
  }
});

const APIMetrics = mongoose.model('APIMetrics', apiMetricsSchema);
export default APIMetrics;
