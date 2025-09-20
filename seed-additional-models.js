import mongoose from 'mongoose';
import UserAnalytics from './src/models/UserAnalytics.js';
import VIPGuest from './src/models/VIPGuest.js';
import WebConfiguration from './src/models/WebConfiguration.js';
import WebhookEndpoint from './src/models/WebhookEndpoint.js';
import WebSettings from './src/models/WebSettings.js';
import Hotel from './src/models/Hotel.js';
import User from './src/models/User.js';

// Database connection
const connectDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hotel-management', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Database connected for additional models seeding');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
};

// Helper function to get random item from array
const getRandomItem = (array) => array[Math.floor(Math.random() * array.length)];

// Helper function to get random number within range
const getRandomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Helper function to get random date within range
const getRandomDate = (start, end) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

// Seed UserAnalytics
const seedUserAnalytics = async (hotelId, users) => {
  const userAnalyticsData = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);

  for (const user of users) {
    for (let i = 0; i < 30; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i * 3);

      const analytics = {
        userId: user._id,
        date,
        hotelId,
        engagementScore: getRandomNumber(30, 95),
        activityMetrics: {
          loginCount: getRandomNumber(0, 10),
          sessionDuration: getRandomNumber(300, 3600), // 5 minutes to 1 hour
          pageViews: getRandomNumber(5, 50),
          actionsPerformed: getRandomNumber(2, 25),
          lastActivity: getRandomDate(date, new Date()),
          uniqueFeaturesUsed: getRandomNumber(1, 8),
          timeSpentOnPlatform: getRandomNumber(600, 7200)
        },
        performanceMetrics: {
          responseTime: getRandomNumber(100, 2000),
          errorRate: getRandomNumber(0, 15),
          taskCompletionRate: getRandomNumber(60, 98),
          efficiencyScore: getRandomNumber(70, 95),
          productivityScore: getRandomNumber(65, 90),
          accuracyRate: getRandomNumber(85, 99)
        },
        behaviorPatterns: {
          peakActivityHours: [getRandomNumber(8, 18), getRandomNumber(19, 23)],
          preferredDevices: [getRandomItem(['desktop', 'mobile', 'tablet'])],
          commonActions: [
            getRandomItem(['login', 'view_dashboard', 'create_booking', 'update_profile']),
            getRandomItem(['search_rooms', 'view_reports', 'send_message', 'export_data'])
          ],
          navigationPatterns: [
            getRandomItem(['dashboard->bookings', 'bookings->guests', 'reports->analytics']),
            getRandomItem(['settings->profile', 'rooms->availability', 'guests->communications'])
          ],
          featureUsageFrequency: new Map([
            ['bookings', getRandomNumber(5, 20)],
            ['reports', getRandomNumber(2, 10)],
            ['guests', getRandomNumber(3, 15)],
            ['rooms', getRandomNumber(4, 12)]
          ]),
          averageSessionLength: getRandomNumber(1800, 5400),
          bounceRate: getRandomNumber(10, 40)
        },
        lifecycleStage: getRandomItem(['new', 'active', 'engaged', 'at_risk']),
        churnRisk: getRandomNumber(5, 70),
        retentionScore: getRandomNumber(60, 95),
        segmentTags: [
          getRandomItem(['high_value', 'frequent_user', 'power_user', 'casual_user']),
          getRandomItem(['mobile_first', 'desktop_preferred', 'business_hours', 'weekend_user'])
        ],
        predictiveInsights: {
          nextLoginPrediction: getRandomDate(new Date(), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
          engagementTrend: getRandomItem(['increasing', 'stable', 'decreasing']),
          recommendedActions: [
            getRandomItem(['send_welcome_email', 'offer_training', 'feature_highlight']),
            getRandomItem(['engagement_campaign', 'retention_offer', 'feedback_request'])
          ],
          predictedLifetimeValue: getRandomNumber(1000, 10000),
          nextFeatureRecommendation: getRandomItem(['analytics_dashboard', 'mobile_app', 'automation_tools']),
          optimalEngagementTime: getRandomItem(['9:00 AM', '2:00 PM', '7:00 PM'])
        },
        cohortAnalysis: {
          cohortMonth: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
          cohortWeek: `${date.getFullYear()}-W${Math.ceil(date.getDate() / 7)}`,
          retentionRate: getRandomNumber(70, 90),
          revenueContribution: getRandomNumber(500, 5000)
        }
      };

      userAnalyticsData.push(analytics);
    }
  }

  await UserAnalytics.insertMany(userAnalyticsData);
  console.log(`👤 User Analytics: ${userAnalyticsData.length}`);
};

// Seed VIPGuests
const seedVIPGuests = async (hotelId, users, adminUser) => {
  const guestUsers = users.filter(user => user.role === 'guest');
  const staffUsers = users.filter(user => user.role === 'staff');
  const vipGuestData = [];

  for (let i = 0; i < Math.min(8, guestUsers.length); i++) {
    const guest = guestUsers[i];
    const vipLevel = getRandomItem(['bronze', 'silver', 'gold', 'platinum', 'diamond']);
    const status = getRandomItem(['active', 'inactive', 'suspended', 'pending']);

    // Set benefits based on VIP level
    const benefits = {
      roomUpgrade: ['gold', 'platinum', 'diamond'].includes(vipLevel),
      lateCheckout: ['silver', 'gold', 'platinum', 'diamond'].includes(vipLevel),
      earlyCheckin: ['silver', 'gold', 'platinum', 'diamond'].includes(vipLevel),
      complimentaryBreakfast: ['gold', 'platinum', 'diamond'].includes(vipLevel),
      spaAccess: ['platinum', 'diamond'].includes(vipLevel),
      conciergeService: ['diamond'].includes(vipLevel),
      priorityReservation: ['gold', 'platinum', 'diamond'].includes(vipLevel),
      welcomeAmenities: ['silver', 'gold', 'platinum', 'diamond'].includes(vipLevel),
      airportTransfer: ['platinum', 'diamond'].includes(vipLevel),
      diningDiscount: vipLevel === 'bronze' ? 5 : vipLevel === 'silver' ? 10 : vipLevel === 'gold' ? 15 : vipLevel === 'platinum' ? 20 : 25,
      spaDiscount: vipLevel === 'bronze' ? 0 : vipLevel === 'silver' ? 10 : vipLevel === 'gold' ? 15 : vipLevel === 'platinum' ? 20 : 30
    };

    const qualificationCriteria = {
      totalStays: getRandomNumber(1, 25),
      totalNights: getRandomNumber(5, 100),
      totalSpent: getRandomNumber(1000, 75000),
      averageRating: parseFloat((Math.random() * 2 + 3).toFixed(1)), // 3.0 to 5.0
      lastStayDate: getRandomDate(new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), new Date())
    };

    const vipGuest = {
      guestId: guest._id,
      vipLevel,
      status,
      benefits,
      qualificationCriteria,
      assignedConcierge: staffUsers.length > 0 ? getRandomItem(staffUsers)._id : null,
      specialRequests: [
        getRandomItem(['High floor room', 'Quiet room', 'Ocean view', 'Close to elevator']),
        getRandomItem(['Extra pillows', 'Hypoallergenic bedding', 'Mini fridge', 'Welcome fruit basket'])
      ],
      notes: `VIP guest since ${new Date().getFullYear() - getRandomNumber(1, 5)}. Prefers ${getRandomItem(['modern', 'classic', 'luxury'])} accommodations.`,
      anniversaryDate: getRandomDate(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), new Date()),
      expiryDate: getRandomDate(new Date(), new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)),
      hotelId,
      createdBy: adminUser._id
    };

    vipGuestData.push(vipGuest);
  }

  await VIPGuest.insertMany(vipGuestData);
  logger.info(`👑 VIP Guests: ${vipGuestData.length}`, {
    service: 'hotel-management-system',
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
};

// Seed WebConfiguration
const seedWebConfiguration = async (hotelId, adminUser) => {
  const webConfigData = {
    hotelId,
    configurationName: 'Main Hotel Configuration',
    version: '2.0',
    abTesting: {
      isEnabled: true,
      tests: [
        {
          testId: 'booking-form-ab-001',
          testName: 'Booking Form Optimization',
          description: 'Testing different booking form layouts',
          testType: 'form',
          targetPage: 'booking',
          variants: [
            {
              variantId: 'control',
              variantName: 'Original Form',
              description: 'Current booking form design',
              trafficAllocation: 50,
              configuration: { layout: 'vertical' },
              isControl: true
            },
            {
              variantId: 'variant-a',
              variantName: 'Horizontal Layout',
              description: 'Horizontal booking form layout',
              trafficAllocation: 50,
              configuration: { layout: 'horizontal' },
              isControl: false
            }
          ],
          testSettings: {
            trafficSplit: 50,
            targetAudience: {
              segments: ['all'],
              deviceTargeting: ['desktop', 'mobile'],
              languageTargeting: ['en', 'es']
            },
            schedule: {
              startDate: new Date(),
              endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              timezone: 'UTC',
              isScheduled: true
            },
            goals: [
              {
                goalId: 'conversion-rate',
                goalName: 'Booking Conversion Rate',
                goalType: 'conversion',
                targetValue: 15,
                trackingMethod: 'booking_completed',
                isPrimary: true
              }
            ]
          },
          status: 'running',
          results: {
            totalVisitors: getRandomNumber(500, 2000),
            totalConversions: getRandomNumber(50, 200),
            conversionRate: 0,
            variantResults: [
              {
                variantId: 'control',
                visitors: getRandomNumber(200, 800),
                conversions: getRandomNumber(20, 80),
                conversionRate: 0,
                revenue: getRandomNumber(5000, 20000),
                avgSessionDuration: getRandomNumber(180, 600),
                bounceRate: getRandomNumber(30, 60)
              }
            ]
          }
        }
      ],
      globalSettings: {
        defaultConfidenceLevel: 95,
        minimumSampleSize: 100,
        testDuration: { default: 14, maximum: 90 }
      }
    },
    performance: {
      isEnabled: true,
      metrics: [],
      monitoring: {
        realTimeAlerts: true,
        alertThresholds: {
          pageLoadTime: 3000,
          firstContentfulPaint: 2500,
          cumulativeLayoutShift: 0.1
        },
        reportingFrequency: 'daily'
      }
    },
    userBehavior: {
      isEnabled: true,
      trackingSettings: {
        trackClicks: true,
        trackScrolling: true,
        trackFormInteractions: true,
        trackPageViews: true,
        sessionRecording: false,
        heatmaps: true
      },
      retentionPeriod: 90,
      anonymization: true
    },
    conversionFunnels: [
      {
        funnelId: 'booking-funnel-001',
        funnelName: 'Hotel Booking Funnel',
        description: 'Main booking conversion funnel',
        steps: [
          {
            stepId: 'landing',
            stepName: 'Landing Page View',
            stepType: 'page_view',
            stepOrder: 1,
            criteria: { page: '/rooms' },
            isRequired: true
          },
          {
            stepId: 'select-room',
            stepName: 'Room Selection',
            stepType: 'element_click',
            stepOrder: 2,
            criteria: { element: '.room-select-btn' },
            isRequired: true
          },
          {
            stepId: 'booking-form',
            stepName: 'Booking Form',
            stepType: 'page_view',
            stepOrder: 3,
            criteria: { page: '/booking' },
            isRequired: true
          },
          {
            stepId: 'payment',
            stepName: 'Payment Completed',
            stepType: 'event',
            stepOrder: 4,
            criteria: { event: 'payment_completed' },
            isRequired: true
          }
        ],
        analytics: {
          totalSessions: getRandomNumber(1000, 5000),
          completedSessions: getRandomNumber(100, 500),
          conversionRate: 0,
          stepAnalytics: []
        },
        isActive: true
      }
    ],
    personalization: {
      isEnabled: false,
      rules: [],
      globalSettings: {
        defaultPersonalizationDuration: 30,
        maxRulesPerPage: 5,
        enableRealtimePersonalization: false
      }
    },
    analytics: {
      customEvents: [
        {
          eventId: 'room-view',
          eventName: 'Room Detail View',
          description: 'User views room details',
          category: 'engagement',
          parameters: [
            { name: 'room_type', type: 'string', required: true },
            { name: 'price', type: 'number', required: false }
          ]
        }
      ],
      cohortAnalysis: {
        isEnabled: false,
        defaultCohortSize: 1000
      },
      attribution: {
        model: 'last_click',
        lookbackWindow: 30
      }
    },
    integrations: [
      {
        integrationId: 'google-analytics',
        integrationType: 'analytics',
        provider: 'Google Analytics',
        configuration: {
          apiKeys: new Map([['tracking_id', 'GA-XXXXX-X']]),
          endpoints: new Map(),
          settings: { enhanced_ecommerce: true }
        },
        isActive: true,
        status: 'connected'
      }
    ],
    advanced: {
      cachingStrategy: 'moderate',
      compressionLevel: 'medium',
      cdnConfiguration: {
        isEnabled: false,
        provider: '',
        settings: {}
      },
      securitySettings: {
        contentSecurityPolicy: true,
        xssProtection: true,
        httpsOnly: true,
        rateLimiting: {
          enabled: true,
          requestsPerMinute: 100
        }
      }
    },
    status: 'active',
    auditInfo: {
      createdBy: adminUser._id,
      updatedBy: adminUser._id,
      changeLog: [
        {
          action: 'created',
          changedBy: adminUser._id,
          changedAt: new Date(),
          changes: { status: 'created initial configuration' },
          version: '2.0'
        }
      ]
    }
  };

  await WebConfiguration.create(webConfigData);
  logger.info('🌐 Web Configuration: 1', {
    service: 'hotel-management-system',
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
};

// Seed WebhookEndpoints
const seedWebhookEndpoints = async (hotelId, adminUser) => {
  const webhookData = [
    {
      name: 'Booking Notifications',
      description: 'Webhook for booking-related events',
      url: 'https://api.example.com/webhooks/bookings',
      hotelId,
      createdBy: adminUser._id,
      events: ['booking.created', 'booking.updated', 'booking.cancelled', 'booking.confirmed'],
      isActive: true,
      httpConfig: {
        method: 'POST',
        headers: new Map([
          ['Authorization', 'Bearer token123'],
          ['Content-Type', 'application/json']
        ]),
        timeout: 30000,
        contentType: 'application/json'
      },
      retryPolicy: {
        enabled: true,
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 60000,
        backoffMultiplier: 2,
        retryOn: ['timeout', 'connection_error', '5xx']
      },
      filters: {
        enabled: false,
        conditions: []
      },
      stats: {
        totalDeliveries: getRandomNumber(100, 500),
        successfulDeliveries: getRandomNumber(80, 450),
        failedDeliveries: getRandomNumber(0, 50),
        lastDelivery: {
          attempt: getRandomDate(new Date(Date.now() - 24 * 60 * 60 * 1000), new Date()),
          success: true,
          statusCode: 200,
          responseTime: getRandomNumber(100, 1000)
        },
        averageResponseTime: getRandomNumber(200, 800)
      },
      health: {
        status: 'healthy',
        lastHealthCheck: new Date(),
        consecutiveFailures: 0,
        uptime: getRandomNumber(95, 100)
      },
      tags: ['bookings', 'notifications'],
      metadata: {
        environment: 'production',
        team: 'backend'
      }
    },
    {
      name: 'Payment Alerts',
      description: 'Webhook for payment processing events',
      url: 'https://api.example.com/webhooks/payments',
      hotelId,
      createdBy: adminUser._id,
      events: ['payment.completed', 'payment.failed', 'payment.refunded'],
      isActive: true,
      httpConfig: {
        method: 'POST',
        timeout: 25000,
        contentType: 'application/json'
      },
      retryPolicy: {
        enabled: true,
        maxRetries: 5,
        initialDelay: 2000,
        maxDelay: 120000,
        backoffMultiplier: 2.5
      },
      stats: {
        totalDeliveries: getRandomNumber(50, 200),
        successfulDeliveries: getRandomNumber(45, 180),
        failedDeliveries: getRandomNumber(0, 20)
      },
      health: {
        status: getRandomItem(['healthy', 'degraded']),
        lastHealthCheck: new Date(),
        consecutiveFailures: getRandomNumber(0, 2),
        uptime: getRandomNumber(90, 100)
      },
      tags: ['payments', 'alerts'],
      metadata: {
        priority: 'high',
        team: 'finance'
      }
    },
    {
      name: 'Room Status Updates',
      description: 'Webhook for room availability and status changes',
      url: 'https://api.example.com/webhooks/rooms',
      hotelId,
      createdBy: adminUser._id,
      events: ['room.availability_changed', 'room.status_changed', 'room.maintenance_scheduled'],
      isActive: false,
      httpConfig: {
        method: 'PUT',
        timeout: 20000,
        contentType: 'application/json'
      },
      stats: {
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0
      },
      health: {
        status: 'healthy',
        consecutiveFailures: 0,
        uptime: 100
      },
      tags: ['rooms', 'status'],
      metadata: {
        environment: 'staging'
      }
    }
  ];

  await WebhookEndpoint.insertMany(webhookData);
  logger.info(`📡 Webhook Endpoints: ${webhookData.length}`, {
    service: 'hotel-management-system',
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
};

// Seed WebSettings
const seedWebSettings = async (hotelId, adminUser) => {
  const webSettingsData = {
    hotelId,
    general: {
      hotelName: 'Grand Plaza Hotel',
      description: 'Luxury accommodation in the heart of the city with exceptional service and amenities.',
      address: {
        street: '123 Main Street',
        city: 'New York',
        state: 'NY',
        country: 'United States',
        postalCode: '10001'
      },
      contact: {
        phone: '+1-555-123-4567',
        email: 'info@grandplazahotel.com',
        website: 'https://grandplazahotel.com',
        socialMedia: {
          facebook: 'https://facebook.com/grandplazahotel',
          instagram: 'https://instagram.com/grandplazahotel',
          twitter: 'https://twitter.com/grandplazahotel',
          linkedin: 'https://linkedin.com/company/grandplazahotel'
        }
      },
      timezone: 'America/New_York',
      currency: {
        code: 'USD',
        symbol: '$',
        position: 'before'
      },
      languages: [
        {
          code: 'en',
          name: 'English',
          isDefault: true
        },
        {
          code: 'es',
          name: 'Spanish',
          isDefault: false
        },
        {
          code: 'fr',
          name: 'French',
          isDefault: false
        }
      ]
    },
    booking: {
      minimumStay: 1,
      maximumStay: 21,
      advanceBookingLimit: 365,
      cutoffTime: {
        hours: 18,
        minutes: 0
      },
      cancellationPolicy: {
        type: 'moderate',
        hoursBeforeCheckin: 24,
        penaltyPercentage: 10,
        customTerms: 'Free cancellation up to 24 hours before check-in. Late cancellations incur a 10% penalty.'
      },
      checkInTime: '15:00',
      checkOutTime: '11:00',
      instantConfirmation: true,
      requiresApproval: false,
      guestDataRequired: [
        'full_name',
        'email',
        'phone',
        'address',
        'nationality',
        'arrival_time'
      ]
    },
    payment: {
      gateways: [
        {
          name: 'stripe',
          isActive: true,
          configuration: {
            publishableKey: 'pk_test_xxxxx',
            webhookSecret: 'whsec_xxxxx'
          },
          fees: {
            percentage: 2.9,
            fixed: 0.30
          }
        },
        {
          name: 'paypal',
          isActive: true,
          configuration: {
            clientId: 'paypal_client_id',
            environment: 'sandbox'
          },
          fees: {
            percentage: 3.4,
            fixed: 0.30
          }
        }
      ],
      acceptedCurrencies: [
        {
          code: 'USD',
          symbol: '$',
          exchangeRate: 1.0
        },
        {
          code: 'EUR',
          symbol: '€',
          exchangeRate: 0.85
        },
        {
          code: 'GBP',
          symbol: '£',
          exchangeRate: 0.75
        }
      ],
      paymentMethods: [
        { type: 'credit_card', isActive: true },
        { type: 'debit_card', isActive: true },
        { type: 'paypal', isActive: true },
        { type: 'bank_transfer', isActive: false }
      ],
      depositRequired: true,
      depositAmount: {
        type: 'percentage',
        value: 20
      },
      taxInclusive: false
    },
    seo: {
      metaTags: {
        title: 'Grand Plaza Hotel - Luxury Accommodation in New York',
        description: 'Experience luxury at Grand Plaza Hotel. Premium rooms, exceptional service, and prime location in New York City.',
        keywords: ['hotel', 'luxury', 'new york', 'accommodation', 'business', 'vacation']
      },
      structuredData: {
        '@type': 'Hotel',
        name: 'Grand Plaza Hotel',
        address: {
          '@type': 'PostalAddress',
          streetAddress: '123 Main Street',
          addressLocality: 'New York',
          addressRegion: 'NY',
          postalCode: '10001'
        }
      },
      googleBusinessProfile: {
        placeId: 'ChIJxxxxxxxxxxxxx',
        isConnected: true
      },
      robots: {
        index: true,
        follow: true
      },
      sitemap: {
        autoGenerate: true,
        lastGenerated: new Date()
      }
    },
    integrations: {
      googleAnalytics: {
        isActive: true,
        trackingId: 'UA-12345678-1',
        measurementId: 'G-XXXXXXXXXX'
      },
      googleTagManager: {
        isActive: true,
        containerId: 'GTM-XXXXXXX'
      },
      facebookPixel: {
        isActive: false,
        pixelId: ''
      },
      emailMarketing: {
        provider: 'mailchimp',
        apiKey: 'mc_api_key_xxxxx',
        listId: 'list_id_xxxxx',
        isActive: true
      },
      chatWidget: {
        provider: 'intercom',
        widgetId: 'widget_xxxxx',
        isActive: true
      },
      reviewPlatforms: [
        {
          name: 'google',
          widgetCode: '<div class="google-reviews">...</div>',
          isActive: true
        },
        {
          name: 'tripadvisor',
          widgetCode: '<div class="tripadvisor-widget">...</div>',
          isActive: true
        }
      ]
    },
    theme: {
      colorScheme: {
        primary: '#1e40af',
        secondary: '#64748b',
        accent: '#f59e0b',
        background: '#ffffff',
        text: '#1f2937',
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b'
      },
      typography: {
        primaryFont: 'Inter',
        secondaryFont: 'Playfair Display',
        fontSize: {
          base: '16px',
          scale: 1.125
        }
      },
      layout: {
        maxWidth: '1400px',
        borderRadius: '8px',
        spacing: '1rem'
      },
      customCSS: `
        .hero-section {
          background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
        }
        .booking-form {
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        }
      `
    },
    advanced: {
      caching: {
        enabled: true,
        ttl: 300
      },
      compression: {
        enabled: true
      },
      cdn: {
        enabled: false,
        provider: '',
        endpoint: ''
      },
      security: {
        csrfProtection: true,
        rateLimiting: {
          enabled: true,
          maxRequests: 100,
          windowMinutes: 15
        },
        encryption: {
          algorithm: 'AES-256-GCM'
        }
      }
    },
    maintenance: {
      isMaintenanceMode: false,
      maintenanceMessage: 'We are currently performing scheduled maintenance. Please check back soon.',
      allowedIPs: ['127.0.0.1', '::1'],
      autoBackup: {
        enabled: true,
        frequency: 'daily',
        retention: 30
      }
    },
    version: '1.0.0',
    isActive: true,
    createdBy: adminUser._id,
    updatedBy: adminUser._id
  };

  await WebSettings.create(webSettingsData);
  logger.info('⚙️ Web Settings: 1', {
    service: 'hotel-management-system',
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
};

// Main seeding function
const seedAdditionalModels = async () => {
  try {
    await connectDatabase();

    // Get existing hotel and users
    const hotel = await Hotel.findOne();
    const users = await User.find();
    const adminUser = users.find(user => user.role === 'admin');

    if (!hotel) {
      throw new Error('No hotel found in database. Please run main seed script first.');
    }

    if (!adminUser) {
      throw new Error('No admin user found in database. Please run main seed script first.');
    }

    logger.info('🌱 Starting additional models seeding...', {
      service: 'hotel-management-system',
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0'
    });

    // Check if data already exists
    const existingUserAnalytics = await UserAnalytics.countDocuments({ hotelId: hotel._id });
    const existingVIPGuests = await VIPGuest.countDocuments({ hotelId: hotel._id });
    const existingWebConfig = await WebConfiguration.countDocuments({ hotelId: hotel._id });
    const existingWebhooks = await WebhookEndpoint.countDocuments({ hotelId: hotel._id });
    const existingWebSettings = await WebSettings.countDocuments({ hotelId: hotel._id });

    if (existingUserAnalytics === 0) {
      console.log('👤 Seeding User Analytics...');
      await seedUserAnalytics(hotel._id, users);
    } else {
      logger.info(`👤 User Analytics already exist: ${existingUserAnalytics}`, {
        service: 'hotel-management-system',
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0'
      });
    }

    if (existingVIPGuests === 0) {
      console.log('👑 Seeding VIP Guests...');
      await seedVIPGuests(hotel._id, users, adminUser);
    } else {
      logger.info(`👑 VIP Guests already exist: ${existingVIPGuests}`, {
        service: 'hotel-management-system',
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0'
      });
    }

    if (existingWebConfig === 0) {
      console.log('🌐 Seeding Web Configuration...');
      await seedWebConfiguration(hotel._id, adminUser);
    } else {
      logger.info(`🌐 Web Configuration already exists: ${existingWebConfig}`, {
        service: 'hotel-management-system',
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0'
      });
    }

    if (existingWebhooks === 0) {
      console.log('📡 Seeding Webhook Endpoints...');
      await seedWebhookEndpoints(hotel._id, adminUser);
    } else {
      logger.info(`📡 Webhook Endpoints already exist: ${existingWebhooks}`, {
        service: 'hotel-management-system',
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0'
      });
    }

    if (existingWebSettings === 0) {
      console.log('⚙️ Seeding Web Settings...');
      await seedWebSettings(hotel._id, adminUser);
    } else {
      logger.info(`⚙️ Web Settings already exist: ${existingWebSettings}`, {
        service: 'hotel-management-system',
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0'
      });
    }

    logger.info('✅ Additional models seeding completed successfully!', {
      service: 'hotel-management-system',
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0'
    });

    // Summary
    logger.info('📊 Additional Models Summary:', {
      service: 'hotel-management-system',
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0'
    });
    
    const userAnalyticsCount = await UserAnalytics.countDocuments({ hotelId: hotel._id });
    const vipGuestsCount = await VIPGuest.countDocuments({ hotelId: hotel._id });
    const webConfigCount = await WebConfiguration.countDocuments({ hotelId: hotel._id });
    const webhookCount = await WebhookEndpoint.countDocuments({ hotelId: hotel._id });
    const webSettingsCount = await WebSettings.countDocuments({ hotelId: hotel._id });

    logger.info(`👤 User Analytics Records: ${userAnalyticsCount}`, {
      service: 'hotel-management-system',
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0'
    });
    logger.info(`👑 VIP Guests: ${vipGuestsCount}`, {
      service: 'hotel-management-system',
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0'
    });
    logger.info(`🌐 Web Configurations: ${webConfigCount}`, {
      service: 'hotel-management-system',
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0'
    });
    logger.info(`📡 Webhook Endpoints: ${webhookCount}`, {
      service: 'hotel-management-system',
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0'
    });
    logger.info(`⚙️ Web Settings: ${webSettingsCount}`, {
      service: 'hotel-management-system',
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0'
    });

    process.exit(0);
  } catch (error) {
    logger.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

// Run seeding if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedAdditionalModels();
}

export default seedAdditionalModels;