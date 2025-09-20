import mongoose from 'mongoose';
import UserAnalytics from './src/models/UserAnalytics.js';
import VIPGuest from './src/models/VIPGuest.js';
import WebConfiguration from './src/models/WebConfiguration.js';
import WebhookEndpoint from './src/models/WebhookEndpoint.js';
import WebSettings from './src/models/WebSettings.js';
import Hotel from './src/models/Hotel.js';
import User from './src/models/User.js';

const testWebManagementSeeding = async () => {
  try {
    await mongoose.connect('mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');
    console.log('✅ Connected to MongoDB');
    
    // Get hotel and users from database
    const hotel = await Hotel.findOne();
    const users = await User.find();
    const adminUser = users.find(user => user.role === 'admin');
    const staffUser = users.find(user => user.role === 'staff');
    const guestUsers = users.filter(user => user.role === 'guest');
    
    console.log('🏨 Hotel:', hotel?.name);
    console.log('👤 Admin:', adminUser?.email);
    console.log('👤 Staff:', staffUser?.email);
    console.log('👥 Guests:', guestUsers?.map(g => g.email));
    
    if (!hotel || !adminUser) {
      throw new Error('Missing required hotel or admin user from database');
    }
    
    console.log('\n📊 Starting UserAnalytics seeding...');
    
    // Test UserAnalytics creation exactly as in seed.js
    const userAnalyticsData = [
      {
        userId: adminUser._id,
        date: new Date(),
        engagementScore: 85.5,
        activityMetrics: {
          loginCount: 45,
          sessionDuration: 1800000, // 30 minutes
          pageViews: 250,
          actionsPerformed: 125,
          lastActivity: new Date(),
          uniqueFeaturesUsed: 15,
          timeSpentOnPlatform: 25200000 // 7 hours this week
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
            ['reports', 15],
            ['settings', 8]
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

    try {
      const createdUserAnalytics = await UserAnalytics.insertMany(userAnalyticsData);
      console.log(`✅ UserAnalytics created: ${createdUserAnalytics.length}`);
    } catch (error) {
      console.error('❌ UserAnalytics creation failed:', error.message);
      if (error.errors) {
        Object.keys(error.errors).forEach(key => {
          console.error('  -', key + ':', error.errors[key].message);
        });
      }
    }

    console.log('\n👑 Starting VIPGuest seeding...');
    
    if (guestUsers.length > 0) {
      const vipGuestData = [{
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
        assignedConcierge: staffUser?._id,
        specialRequests: [
          'Extra pillows',
          'Late checkout preferred',
          'Quiet room away from elevator'
        ],
        notes: 'Frequent business traveler. Prefers executive floors.',
        anniversaryDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        hotelId: hotel._id,
        createdBy: adminUser._id,
        updatedBy: adminUser._id
      }];

      try {
        const createdVIPGuests = await VIPGuest.insertMany(vipGuestData);
        console.log(`✅ VIPGuests created: ${createdVIPGuests.length}`);
      } catch (error) {
        console.error('❌ VIPGuest creation failed:', error.message);
        if (error.errors) {
          Object.keys(error.errors).forEach(key => {
            console.error('  -', key + ':', error.errors[key].message);
          });
        }
      }
    }

    console.log('\n📡 Starting WebhookEndpoint seeding...');
    
    const webhookEndpointData = [{
      name: 'Test Booking Webhook',
      description: 'Test webhook for booking events',
      url: 'https://api.example.com/webhooks/test',
      hotelId: hotel._id,
      createdBy: adminUser._id,
      events: ['booking.created', 'booking.updated'],
      isActive: true
    }];

    try {
      // Create webhook endpoints one by one to trigger pre-save middleware
      const createdWebhookEndpoints = [];
      for (const webhookData of webhookEndpointData) {
        const webhook = new WebhookEndpoint(webhookData);
        await webhook.save();
        createdWebhookEndpoints.push(webhook);
      }
      console.log(`✅ WebhookEndpoints created: ${createdWebhookEndpoints.length}`);
    } catch (error) {
      console.error('❌ WebhookEndpoint creation failed:', error.message);
      if (error.errors) {
        Object.keys(error.errors).forEach(key => {
          console.error('  -', key + ':', error.errors[key].message);
        });
      }
    }

    console.log('\n⚙️ Starting WebSettings seeding...');
    
    const webSettingsData = {
      hotelId: hotel._id,
      general: {
        hotelName: 'Test Hotel Settings'
      }
    };

    try {
      const createdWebSettings = await WebSettings.create(webSettingsData);
      console.log(`✅ WebSettings created: 1`);
    } catch (error) {
      console.error('❌ WebSettings creation failed:', error.message);
      if (error.errors) {
        Object.keys(error.errors).forEach(key => {
          console.error('  -', key + ':', error.errors[key].message);
        });
      }
    }

    console.log('\n🌐 Starting WebConfiguration seeding...');
    
    const webConfigurationData = {
      hotelId: hotel._id,
      configurationName: 'Test Configuration',
      auditInfo: {
        createdBy: adminUser._id
      }
    };

    try {
      const createdWebConfiguration = await WebConfiguration.create(webConfigurationData);
      console.log(`✅ WebConfiguration created: 1`);
    } catch (error) {
      console.error('❌ WebConfiguration creation failed:', error.message);
      if (error.errors) {
        Object.keys(error.errors).forEach(key => {
          console.error('  -', key + ':', error.errors[key].message);
        });
      }
    }

    // Final count check
    console.log('\n📊 Final Collection Counts:');
    const userAnalyticsCount = await UserAnalytics.countDocuments({ hotelId: hotel._id });
    const vipGuestsCount = await VIPGuest.countDocuments({ hotelId: hotel._id });
    const webhookEndpointsCount = await WebhookEndpoint.countDocuments({ hotelId: hotel._id });
    const webSettingsCount = await WebSettings.countDocuments({ hotelId: hotel._id });
    const webConfigurationCount = await WebConfiguration.countDocuments({ hotelId: hotel._id });

    console.log(`👤 UserAnalytics: ${userAnalyticsCount}`);
    console.log(`👑 VIPGuests: ${vipGuestsCount}`);
    console.log(`📡 WebhookEndpoints: ${webhookEndpointsCount}`);
    console.log(`⚙️ WebSettings: ${webSettingsCount}`);
    console.log(`🌐 WebConfiguration: ${webConfigurationCount}`);
    
    mongoose.connection.close();
    console.log('\n✅ Test completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
};

testWebManagementSeeding();