import mongoose from 'mongoose';
import logger from './src/utils/logger.js';
import connectDB from './src/config/database.js';

// Import models
import UserAnalytics from './src/models/UserAnalytics.js';
import VIPGuest from './src/models/VIPGuest.js';
import WebConfiguration from './src/models/WebConfiguration.js';
import WebhookEndpoint from './src/models/WebhookEndpoint.js';
import WebSettings from './src/models/WebSettings.js';
import User from './src/models/User.js';
import Hotel from './src/models/Hotel.js';

const testUserAnalyticsSeeding = async () => {
  try {
    await connectDB();
    logger.info('🧪 Testing User Analytics & Web Management System seeding...');

    // Find existing users and hotel from the database
    const adminUser = await User.findOne({ email: 'admin@hotel.com' });
    const staffUser = await User.findOne({ email: 'staff@hotel.com' });  
    const guestUsers = await User.find({ role: 'guest' }).limit(3);
    const hotel = await Hotel.findOne();

    if (!adminUser || !staffUser || guestUsers.length === 0 || !hotel) {
      throw new Error('Required seed data not found. Please run full seed first.');
    }

    logger.info(`Found admin: ${adminUser.email}, staff: ${staffUser.email}, ${guestUsers.length} guests, hotel: ${hotel.name}`);

    // Clean existing data
    await UserAnalytics.deleteMany({});
    await VIPGuest.deleteMany({});
    await WebConfiguration.deleteMany({});
    await WebhookEndpoint.deleteMany({});
    await WebSettings.deleteMany({});

    // User Analytics - Track user behavior and engagement (corrected structure)
    const userAnalyticsData = [
      {
        userId: adminUser._id,
        date: new Date(),
        engagementScore: 85.5,
        activityMetrics: {
          loginCount: 45,
          sessionDuration: 1800000,
          pageViews: 250,
          actionsPerformed: 125,
          lastActivity: new Date(),
          uniqueFeaturesUsed: 15,
          timeSpentOnPlatform: 25200000
        },
        performanceMetrics: {
          responseTime: 800,
          errorRate: 0.2,
          taskCompletionRate: 95.5,
          efficiencyScore: 92.0,
          productivityScore: 88.5,
          accuracyRate: 97.2
        },
        behaviorPatterns: {
          peakActivityHours: [9, 10, 14, 15, 16],
          preferredDevices: ['desktop'],
          commonActions: ['create_booking', 'view_reports', 'manage_rooms'],
          navigationPatterns: ['dashboard', 'bookings', 'reports', 'settings'],
          featureUsageFrequency: new Map([
            ['bookings', 25],
            ['reports', 15]
          ]),
          averageSessionLength: 1800000,
          bounceRate: 5.2
        },
        lifecycleStage: 'engaged',
        churnRisk: 15.2,
        retentionScore: 92.8,
        segmentTags: ['power_user', 'high_value', 'frequent_user'],
        predictiveInsights: {
          nextLoginPrediction: new Date(Date.now() + 24 * 60 * 60 * 1000),
          engagementTrend: 'increasing',
          recommendedActions: ['feature_highlight', 'upgrade_promotion'],
          predictedLifetimeValue: 15000,
          nextFeatureRecommendation: 'advanced_analytics',
          optimalEngagementTime: '09:00-10:00'
        },
        cohortAnalysis: {
          cohortMonth: '2024-01',
          cohortWeek: '2024-W04'
        },
        hotelId: hotel._id
      }
    ];

    const createdUserAnalytics = await UserAnalytics.insertMany(userAnalyticsData);
    logger.info(`📊 User Analytics: ${createdUserAnalytics.length}`);

    // VIP Guest Management
    const vipGuestData = [
      {
        guestId: guestUsers[0]._id,
        vipLevel: 'gold',
        status: 'active',
        benefits: {
          roomUpgrade: true,
          lateCheckout: true,
          earlyCheckin: true,
          complimentaryBreakfast: true,
          spaAccess: true,
          conciergeService: true,
          priorityReservation: true,
          welcomeAmenities: true,
          airportTransfer: false,
          diningDiscount: 15,
          spaDiscount: 20
        },
        qualificationCriteria: {
          totalStays: 12,
          totalNights: 36,
          totalSpent: 125000,
          averageRating: 4.2,
          lastStayDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        },
        assignedConcierge: staffUser._id,
        specialRequests: [
          'Extra pillows',
          'Late checkout preferred'
        ],
        notes: 'Frequent business traveler.',
        anniversaryDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        hotelId: hotel._id,
        createdBy: adminUser._id,
        updatedBy: adminUser._id
      }
    ];

    const createdVIPGuests = await VIPGuest.insertMany(vipGuestData);
    logger.info(`👑 VIP Guests: ${createdVIPGuests.length}`);

    // Simple Webhook Endpoint
    const webhookEndpointData = [
      {
        name: 'Test Booking Webhook',
        description: 'Test webhook for booking events',
        url: 'https://api.test.com/webhooks/bookings',
        hotelId: hotel._id,
        createdBy: adminUser._id,
        events: ['booking.created', 'booking.updated'],
        secret: 'whsec_abcd1234567890123456789012345678901234567890123456789012345678',
        isActive: true,
        httpConfig: {
          method: 'POST',
          headers: new Map([
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
        stats: {
          totalDeliveries: 0,
          successfulDeliveries: 0,
          failedDeliveries: 0,
          averageResponseTime: 0
        },
        health: {
          status: 'healthy',
          lastHealthCheck: new Date(),
          consecutiveFailures: 0,
          uptime: 100.0
        },
        tags: ['test'],
        metadata: {}
      }
    ];

    // Create webhook endpoints one by one to trigger pre-save middleware
    const createdWebhookEndpoints = [];
    for (const webhookData of webhookEndpointData) {
      const webhook = new WebhookEndpoint(webhookData);
      await webhook.save();
      createdWebhookEndpoints.push(webhook);
    }
    logger.info(`🔗 Webhook Endpoints: ${createdWebhookEndpoints.length}`);

    // Web Settings - Simple version
    const webSettingsData = {
      hotelId: hotel._id,
      general: {
        hotelName: 'THE PENTOUZ',
        description: 'A luxury hotel in Mumbai',
        address: {
          street: '123 MG Road',
          city: 'Mumbai',
          state: 'Maharashtra',
          country: 'India',
          postalCode: '400001'
        },
        contact: {
          phone: '+91-22-1234-5678',
          email: 'info@thepentouz.com',
          website: 'https://thepentouz.com'
        },
        timezone: 'Asia/Kolkata',
        currency: {
          code: 'INR',
          symbol: '₹',
          position: 'before'
        },
        languages: [
          {
            code: 'en',
            name: 'English',
            isDefault: true
          }
        ]
      },
      booking: {
        minimumStay: 1,
        maximumStay: 30,
        advanceBookingLimit: 365,
        cutoffTime: {
          hours: 18,
          minutes: 0
        },
        cancellationPolicy: {
          type: 'moderate',
          hoursBeforeCheckin: 24,
          penaltyPercentage: 50
        },
        checkInTime: '15:00',
        checkOutTime: '11:00',
        instantConfirmation: true,
        requiresApproval: false,
        guestDataRequired: ['full_name', 'email', 'phone']
      },
      payment: {
        gateways: [],
        acceptedCurrencies: [
          { code: 'INR', symbol: '₹', exchangeRate: 1 }
        ],
        paymentMethods: [{
          type: 'credit_card', 
          isActive: true
        }],
        depositRequired: false,
        depositAmount: {
          type: 'percentage',
          value: 0
        },
        taxInclusive: false
      },
      seo: {
        metaTags: {
          title: 'THE PENTOUZ - Luxury Hotel',
          description: 'Experience luxury at THE PENTOUZ',
          keywords: ['luxury hotel', 'Mumbai']
        },
        robots: {
          index: true,
          follow: true
        },
        sitemap: {
          autoGenerate: true
        }
      },
      integrations: {
        googleAnalytics: {
          isActive: false
        },
        googleTagManager: {
          isActive: false
        },
        facebookPixel: {
          isActive: false
        },
        emailMarketing: {
          provider: 'none',
          isActive: false
        },
        chatWidget: {
          provider: 'none',
          isActive: false
        },
        reviewPlatforms: []
      },
      theme: {
        colorScheme: {
          primary: '#1a365d',
          secondary: '#718096',
          accent: '#d69e2e',
          background: '#ffffff',
          text: '#2d3748',
          success: '#38a169',
          error: '#e53e3e',
          warning: '#d69e2e'
        },
        typography: {
          primaryFont: 'Inter',
          secondaryFont: 'Inter',
          fontSize: {
            base: '16px',
            scale: 1.125
          }
        },
        layout: {
          maxWidth: '1200px',
          borderRadius: '8px',
          spacing: '1rem'
        }
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
          enabled: false
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
        maintenanceMessage: 'Under maintenance',
        allowedIPs: [],
        autoBackup: {
          enabled: true,
          frequency: 'weekly',
          retention: 30
        }
      },
      version: '1.0.0',
      isActive: true,
      createdBy: adminUser._id
    };

    const createdWebSettings = await WebSettings.create(webSettingsData);
    logger.info(`⚙️ Web Settings: 1`);

    logger.info('✅ User Analytics & Web Management System test seeding completed successfully!');

    // Verify counts
    const userAnalyticsCount = await UserAnalytics.countDocuments();
    const vipGuestCount = await VIPGuest.countDocuments();
    const webhookEndpointCount = await WebhookEndpoint.countDocuments();
    const webSettingsCount = await WebSettings.countDocuments();

    logger.info('');
    logger.info('📊 VERIFICATION RESULTS:');
    logger.info(`📊 User Analytics: ${userAnalyticsCount}`);
    logger.info(`👑 VIP Guests: ${vipGuestCount}`);
    logger.info(`🔗 Webhook Endpoints: ${webhookEndpointCount}`);
    logger.info(`⚙️ Web Settings: ${webSettingsCount}`);

    await mongoose.connection.close();
    
  } catch (error) {
    console.error('❌ Test seeding failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
};

testUserAnalyticsSeeding();