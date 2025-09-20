import mongoose from 'mongoose';

// A/B Test Configuration Schema
const abTestSchema = new mongoose.Schema({
  testId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  testName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  testType: {
    type: String,
    enum: ['page', 'element', 'form', 'content', 'design', 'pricing', 'flow'],
    required: true
  },
  targetPage: {
    type: String,
    enum: ['home', 'booking', 'rooms', 'checkout', 'confirmation', 'all'],
    default: 'all'
  },
  variants: [{
    variantId: {
      type: String,
      required: true
    },
    variantName: {
      type: String,
      required: true
    },
    description: String,
    trafficAllocation: {
      type: Number,
      min: 0,
      max: 100,
      default: 50
    },
    configuration: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    isControl: {
      type: Boolean,
      default: false
    }
  }],
  testSettings: {
    trafficSplit: {
      type: Number,
      min: 1,
      max: 100,
      default: 50
    },
    targetAudience: {
      segments: [{
        type: String,
        enum: ['all', 'new_visitors', 'returning_visitors', 'mobile', 'desktop', 'direct_traffic', 'search_traffic', 'social_traffic']
      }],
      geoTargeting: [{
        country: String,
        region: String
      }],
      deviceTargeting: [{
        type: String,
        enum: ['desktop', 'mobile', 'tablet']
      }],
      languageTargeting: [String]
    },
    schedule: {
      startDate: Date,
      endDate: Date,
      timezone: {
        type: String,
        default: 'UTC'
      },
      isScheduled: {
        type: Boolean,
        default: false
      }
    },
    goals: [{
      goalId: String,
      goalName: String,
      goalType: {
        type: String,
        enum: ['conversion', 'click', 'time_spent', 'page_views', 'form_completion', 'revenue']
      },
      targetValue: Number,
      trackingMethod: String,
      isPrimary: {
        type: Boolean,
        default: false
      }
    }]
  },
  status: {
    type: String,
    enum: ['draft', 'running', 'paused', 'completed', 'archived'],
    default: 'draft'
  },
  results: {
    totalVisitors: {
      type: Number,
      default: 0
    },
    totalConversions: {
      type: Number,
      default: 0
    },
    conversionRate: {
      type: Number,
      default: 0
    },
    variantResults: [{
      variantId: String,
      visitors: {
        type: Number,
        default: 0
      },
      conversions: {
        type: Number,
        default: 0
      },
      conversionRate: {
        type: Number,
        default: 0
      },
      revenue: {
        type: Number,
        default: 0
      },
      avgSessionDuration: {
        type: Number,
        default: 0
      },
      bounceRate: {
        type: Number,
        default: 0
      }
    }],
    statisticalSignificance: {
      isSignificant: {
        type: Boolean,
        default: false
      },
      confidenceLevel: {
        type: Number,
        default: 95
      },
      pValue: Number,
      winningVariant: String
    }
  }
}, {
  timestamps: true
});

// Performance Monitoring Schema
const performanceMetricSchema = new mongoose.Schema({
  metricId: {
    type: String,
    required: true
  },
  metricName: {
    type: String,
    required: true
  },
  metricType: {
    type: String,
    enum: ['page_load_time', 'time_to_first_byte', 'first_contentful_paint', 'largest_contentful_paint', 'cumulative_layout_shift', 'first_input_delay'],
    required: true
  },
  value: {
    type: Number,
    required: true
  },
  threshold: {
    good: Number,
    needsImprovement: Number,
    poor: Number
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  page: String,
  device: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet']
  },
  location: String
}, {
  timestamps: true
});

// User Behavior Tracking Schema
const userBehaviorSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true
  },
  userId: String,
  visitorType: {
    type: String,
    enum: ['new', 'returning'],
    default: 'new'
  },
  sessionData: {
    startTime: {
      type: Date,
      default: Date.now
    },
    endTime: Date,
    duration: Number,
    pageViews: [{
      page: String,
      url: String,
      timestamp: Date,
      timeSpent: Number,
      scrollDepth: {
        type: Number,
        min: 0,
        max: 100
      }
    }],
    interactions: [{
      type: {
        type: String,
        enum: ['click', 'hover', 'scroll', 'form_field', 'form_submit', 'download', 'video_play', 'search']
      },
      element: String,
      elementId: String,
      elementClass: String,
      page: String,
      timestamp: Date,
      value: mongoose.Schema.Types.Mixed
    }],
    device: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet']
    },
    browser: String,
    operatingSystem: String,
    referrer: String,
    trafficSource: {
      type: String,
      enum: ['direct', 'search', 'social', 'email', 'referral', 'paid']
    }
  },
  conversionData: {
    hasConverted: {
      type: Boolean,
      default: false
    },
    conversionType: String,
    conversionValue: Number,
    conversionTimestamp: Date,
    goalsFulfilled: [String]
  },
  heatmapData: {
    clicks: [{
      x: Number,
      y: Number,
      page: String,
      timestamp: Date
    }],
    mouseMoves: [{
      x: Number,
      y: Number,
      page: String,
      timestamp: Date
    }],
    scrollEvents: [{
      scrollY: Number,
      page: String,
      timestamp: Date
    }]
  }
}, {
  timestamps: true
});

// Conversion Funnel Schema
const conversionFunnelSchema = new mongoose.Schema({
  funnelId: {
    type: String,
    required: true,
    unique: true
  },
  funnelName: {
    type: String,
    required: true
  },
  description: String,
  steps: [{
    stepId: String,
    stepName: String,
    stepType: {
      type: String,
      enum: ['page_view', 'element_click', 'form_submit', 'event', 'goal']
    },
    stepOrder: Number,
    criteria: {
      page: String,
      element: String,
      event: String,
      conditions: mongoose.Schema.Types.Mixed
    },
    isRequired: {
      type: Boolean,
      default: true
    }
  }],
  analytics: {
    totalSessions: {
      type: Number,
      default: 0
    },
    completedSessions: {
      type: Number,
      default: 0
    },
    conversionRate: {
      type: Number,
      default: 0
    },
    stepAnalytics: [{
      stepId: String,
      entrances: {
        type: Number,
        default: 0
      },
      exits: {
        type: Number,
        default: 0
      },
      dropoffRate: {
        type: Number,
        default: 0
      },
      avgTimeSpent: {
        type: Number,
        default: 0
      }
    }]
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Personalization Rule Schema
const personalizationRuleSchema = new mongoose.Schema({
  ruleId: {
    type: String,
    required: true,
    unique: true
  },
  ruleName: {
    type: String,
    required: true
  },
  description: String,
  targetAudience: {
    segments: [{
      type: String,
      enum: ['new_visitors', 'returning_visitors', 'high_value', 'price_sensitive', 'mobile_users', 'vip_guests', 'corporate_guests']
    }],
    conditions: [{
      field: String,
      operator: {
        type: String,
        enum: ['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'in', 'not_in']
      },
      value: mongoose.Schema.Types.Mixed
    }],
    behaviorCriteria: [{
      action: String,
      page: String,
      element: String,
      frequency: Number,
      timeframe: String
    }]
  },
  personalization: {
    content: [{
      selector: String,
      contentType: {
        type: String,
        enum: ['text', 'html', 'image', 'offer', 'pricing', 'availability']
      },
      originalContent: String,
      personalizedContent: String
    }],
    offers: [{
      offerType: String,
      offerValue: Number,
      conditions: mongoose.Schema.Types.Mixed,
      validUntil: Date
    }],
    layout: {
      modifications: [{
        element: String,
        property: String,
        value: String
      }]
    }
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'draft'],
    default: 'draft'
  },
  performance: {
    impressions: {
      type: Number,
      default: 0
    },
    clicks: {
      type: Number,
      default: 0
    },
    conversions: {
      type: Number,
      default: 0
    },
    revenue: {
      type: Number,
      default: 0
    },
    ctr: {
      type: Number,
      default: 0
    },
    conversionRate: {
      type: Number,
      default: 0
    }
  },
  schedule: {
    startDate: Date,
    endDate: Date,
    isScheduled: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Integration Configuration Schema
const integrationConfigSchema = new mongoose.Schema({
  integrationId: {
    type: String,
    required: true
  },
  integrationType: {
    type: String,
    enum: ['analytics', 'heatmap', 'chat', 'email', 'crm', 'payment', 'social', 'advertising', 'webhook'],
    required: true
  },
  provider: {
    type: String,
    required: true
  },
  configuration: {
    apiKeys: {
      type: Map,
      of: String
    },
    endpoints: {
      type: Map,
      of: String
    },
    settings: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastSync: Date,
  status: {
    type: String,
    enum: ['connected', 'disconnected', 'error', 'syncing'],
    default: 'disconnected'
  },
  errorMessages: [String]
}, {
  timestamps: true
});

// Main Web Configuration Schema
const webConfigurationSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  configurationName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  version: {
    type: String,
    default: '2.0'
  },
  
  // A/B Testing Configuration
  abTesting: {
    isEnabled: {
      type: Boolean,
      default: false
    },
    tests: [abTestSchema],
    globalSettings: {
      defaultConfidenceLevel: {
        type: Number,
        default: 95
      },
      minimumSampleSize: {
        type: Number,
        default: 100
      },
      testDuration: {
        default: {
          type: Number,
          default: 14
        },
        maximum: {
          type: Number,
          default: 90
        }
      }
    }
  },
  
  // Performance Monitoring
  performance: {
    isEnabled: {
      type: Boolean,
      default: true
    },
    metrics: [performanceMetricSchema],
    monitoring: {
      realTimeAlerts: {
        type: Boolean,
        default: true
      },
      alertThresholds: {
        pageLoadTime: {
          type: Number,
          default: 3000
        },
        firstContentfulPaint: {
          type: Number,
          default: 2500
        },
        cumulativeLayoutShift: {
          type: Number,
          default: 0.1
        }
      },
      reportingFrequency: {
        type: String,
        enum: ['hourly', 'daily', 'weekly'],
        default: 'daily'
      }
    }
  },
  
  // User Behavior Tracking
  userBehavior: {
    isEnabled: {
      type: Boolean,
      default: true
    },
    trackingSettings: {
      trackClicks: {
        type: Boolean,
        default: true
      },
      trackScrolling: {
        type: Boolean,
        default: true
      },
      trackFormInteractions: {
        type: Boolean,
        default: true
      },
      trackPageViews: {
        type: Boolean,
        default: true
      },
      sessionRecording: {
        type: Boolean,
        default: false
      },
      heatmaps: {
        type: Boolean,
        default: true
      }
    },
    retentionPeriod: {
      type: Number,
      default: 90
    },
    anonymization: {
      type: Boolean,
      default: true
    }
  },
  
  // Conversion Funnels
  conversionFunnels: [conversionFunnelSchema],
  
  // Personalization
  personalization: {
    isEnabled: {
      type: Boolean,
      default: false
    },
    rules: [personalizationRuleSchema],
    globalSettings: {
      defaultPersonalizationDuration: {
        type: Number,
        default: 30
      },
      maxRulesPerPage: {
        type: Number,
        default: 5
      },
      enableRealtimePersonalization: {
        type: Boolean,
        default: false
      }
    }
  },
  
  // Advanced Analytics
  analytics: {
    customEvents: [{
      eventId: String,
      eventName: String,
      description: String,
      category: String,
      parameters: [{
        name: String,
        type: String,
        required: Boolean
      }]
    }],
    cohortAnalysis: {
      isEnabled: {
        type: Boolean,
        default: false
      },
      defaultCohortSize: {
        type: Number,
        default: 1000
      }
    },
    attribution: {
      model: {
        type: String,
        enum: ['first_click', 'last_click', 'linear', 'time_decay', 'position_based'],
        default: 'last_click'
      },
      lookbackWindow: {
        type: Number,
        default: 30
      }
    }
  },
  
  // Integrations
  integrations: [integrationConfigSchema],
  
  // Advanced Settings
  advanced: {
    cachingStrategy: {
      type: String,
      enum: ['aggressive', 'moderate', 'conservative'],
      default: 'moderate'
    },
    compressionLevel: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    cdnConfiguration: {
      isEnabled: {
        type: Boolean,
        default: false
      },
      provider: String,
      settings: mongoose.Schema.Types.Mixed
    },
    securitySettings: {
      contentSecurityPolicy: {
        type: Boolean,
        default: true
      },
      xssProtection: {
        type: Boolean,
        default: true
      },
      httpsOnly: {
        type: Boolean,
        default: true
      },
      rateLimiting: {
        enabled: {
          type: Boolean,
          default: true
        },
        requestsPerMinute: {
          type: Number,
          default: 100
        }
      }
    }
  },
  
  // Status and Metadata
  status: {
    type: String,
    enum: ['active', 'inactive', 'testing'],
    default: 'active'
  },
  
  // Audit Information
  auditInfo: {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    changeLog: [{
      action: String,
      changedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      changedAt: {
        type: Date,
        default: Date.now
      },
      changes: mongoose.Schema.Types.Mixed,
      version: String
    }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
webConfigurationSchema.index({ hotelId: 1, status: 1 });
webConfigurationSchema.index({ 'abTesting.tests.testId': 1 });
webConfigurationSchema.index({ 'abTesting.tests.status': 1 });
webConfigurationSchema.index({ 'performance.metrics.timestamp': 1 });
webConfigurationSchema.index({ 'personalization.rules.status': 1 });

// Virtual fields
webConfigurationSchema.virtual('activeABTests').get(function() {
  return this.abTesting.tests.filter(test => test.status === 'running');
});

webConfigurationSchema.virtual('activePersonalizationRules').get(function() {
  return this.personalization.rules.filter(rule => rule.status === 'active');
});

webConfigurationSchema.virtual('connectedIntegrations').get(function() {
  return this.integrations.filter(integration => integration.status === 'connected');
});

// Instance methods
webConfigurationSchema.methods.startABTest = async function(testId) {
  const test = this.abTesting.tests.find(t => t.testId === testId);
  if (!test) {
    throw new Error('Test not found');
  }
  
  test.status = 'running';
  test.testSettings.schedule.startDate = new Date();
  
  await this.save();
  return test;
};

webConfigurationSchema.methods.stopABTest = async function(testId) {
  const test = this.abTesting.tests.find(t => t.testId === testId);
  if (!test) {
    throw new Error('Test not found');
  }
  
  test.status = 'completed';
  test.testSettings.schedule.endDate = new Date();
  
  await this.save();
  return test;
};

webConfigurationSchema.methods.calculateTestResults = function(testId) {
  const test = this.abTesting.tests.find(t => t.testId === testId);
  if (!test) {
    throw new Error('Test not found');
  }
  
  // Calculate overall conversion rate
  test.results.conversionRate = test.results.totalVisitors > 0 
    ? (test.results.totalConversions / test.results.totalVisitors) * 100 
    : 0;
  
  // Calculate per-variant results
  test.results.variantResults.forEach(variant => {
    variant.conversionRate = variant.visitors > 0 
      ? (variant.conversions / variant.visitors) * 100 
      : 0;
  });
  
  return test.results;
};

webConfigurationSchema.methods.getPerformanceReport = function(timeframe = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - timeframe);
  
  const recentMetrics = this.performance.metrics.filter(
    metric => metric.timestamp >= cutoffDate
  );
  
  const report = {
    totalMetrics: recentMetrics.length,
    averagePageLoadTime: 0,
    averageFCP: 0,
    averageLCP: 0,
    averageCLS: 0,
    timeframe
  };
  
  if (recentMetrics.length > 0) {
    report.averagePageLoadTime = recentMetrics
      .filter(m => m.metricType === 'page_load_time')
      .reduce((sum, m) => sum + m.value, 0) / recentMetrics.length;
    
    report.averageFCP = recentMetrics
      .filter(m => m.metricType === 'first_contentful_paint')
      .reduce((sum, m) => sum + m.value, 0) / recentMetrics.length;
  }
  
  return report;
};

// Static methods
webConfigurationSchema.statics.getOptimizationReport = async function(hotelId) {
  const config = await this.findOne({ hotelId, status: 'active' });
  if (!config) return null;
  
  const report = {
    abTests: {
      total: config.abTesting.tests.length,
      running: config.abTesting.tests.filter(t => t.status === 'running').length,
      completed: config.abTesting.tests.filter(t => t.status === 'completed').length
    },
    performance: config.getPerformanceReport(),
    personalization: {
      total: config.personalization.rules.length,
      active: config.personalization.rules.filter(r => r.status === 'active').length
    },
    integrations: {
      total: config.integrations.length,
      connected: config.integrations.filter(i => i.status === 'connected').length
    }
  };
  
  return report;
};

const WebConfiguration = mongoose.model('WebConfiguration', webConfigurationSchema);

export default WebConfiguration;
