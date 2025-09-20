import mongoose from 'mongoose';
import GuestCRMProfile from '../models/GuestCRMProfile.js';
import GuestBehavior from '../models/GuestBehavior.js';
import User from '../models/User.js';
import Hotel from '../models/Hotel.js';
import Booking from '../models/Booking.js';
import crmAutomationService from '../services/crmAutomationService.js';

const mongoURI = process.env.MONGO_URI || 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management?retryWrites=true&w=majority&appName=Cluster0';

async function connectDB() {
  try {
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function seedCRMData() {
  try {
    console.log('🌱 Starting CRM data seeding...');

    // Get hotels and users
    const hotels = await Hotel.find().limit(3);
    if (hotels.length === 0) {
      console.log('❌ No hotels found. Please seed hotels first.');
      return;
    }

    const users = await User.find({ role: 'guest' }).limit(50);
    if (users.length === 0) {
      console.log('❌ No guest users found. Please seed users first.');
      return;
    }

    console.log(`Found ${hotels.length} hotels and ${users.length} guest users`);

    // Clear existing CRM data
    await GuestCRMProfile.deleteMany({});
    await GuestBehavior.deleteMany({});
    console.log('🧹 Cleared existing CRM data');

    let profilesCreated = 0;
    let behaviorsCreated = 0;

    // Create CRM profiles for each guest
    for (const hotel of hotels) {
      const hotelUsers = users.slice(0, Math.min(20, users.length)); // Limit per hotel

      for (const user of hotelUsers) {
        try {
          // Create CRM profile
          const profile = await crmAutomationService.createOrUpdateGuestProfile(user._id, hotel._id, {
            preferences: {
              roomType: getRandomElement(['standard', 'deluxe', 'suite', 'executive']),
              bedType: getRandomElement(['single', 'double', 'king', 'twin']),
              smokingPreference: getRandomElement(['smoking', 'non-smoking']),
              floorPreference: getRandomElement(['low', 'middle', 'high', 'any']),
              specialRequests: getRandomSpecialRequests()
            },
            communicationPreferences: {
              email: Math.random() > 0.2, // 80% prefer email
              sms: Math.random() > 0.6,   // 40% prefer SMS
              push: Math.random() > 0.3,  // 70% prefer push
              phone: Math.random() > 0.8, // 20% prefer phone
              language: getRandomElement(['en', 'es', 'fr', 'de']),
              timezone: getRandomElement(['UTC', 'EST', 'PST', 'CET'])
            }
          });

          profilesCreated++;

          // Create random behaviors for this guest
          const behaviorCount = Math.floor(Math.random() * 15) + 5; // 5-20 behaviors

          for (let i = 0; i < behaviorCount; i++) {
            const behaviorType = getRandomBehaviorType();
            const daysAgo = Math.floor(Math.random() * 90); // Last 90 days
            const timestamp = new Date(Date.now() - (daysAgo * 24 * 60 * 60 * 1000));

            const behaviorData = {
              behaviorType,
              sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              pageUrl: getRandomPageUrl(behaviorType),
              referrerUrl: getRandomReferrer(),
              userAgent: getRandomUserAgent(),
              ipAddress: getRandomIP(),
              deviceType: getRandomElement(['desktop', 'mobile', 'tablet']),
              source: getRandomElement(['direct', 'organic', 'paid', 'social', 'email', 'referral']),
              medium: getRandomElement(['search', 'social', 'email', 'display', 'referral']),
              campaign: getRandomCampaign(),
              localTime: timestamp,
              timezone: profile.communicationPreferences.timezone,
              interactionData: getRandomInteractionData(behaviorType),
              transactionValue: behaviorType === 'booking_complete' ? Math.random() * 1000 + 100 : 0,
              metadata: {
                browser: getRandomBrowser(),
                os: getRandomOS(),
                screenResolution: getRandomResolution()
              }
            };

            // Override timestamp for realistic timeline
            const behavior = await crmAutomationService.trackBehavior(user._id, hotel._id, behaviorData);

            // Update timestamp manually for historical data
            await GuestBehavior.findByIdAndUpdate(behavior._id, { timestamp });

            behaviorsCreated++;
          }

          // Update metrics after creating behaviors
          await crmAutomationService.updateGuestMetrics(profile);

          if (profilesCreated % 5 === 0) {
            console.log(`✨ Created ${profilesCreated} profiles and ${behaviorsCreated} behaviors...`);
          }

        } catch (error) {
          console.error(`Error creating CRM data for user ${user._id}:`, error);
        }
      }
    }

    console.log(`✅ CRM data seeding completed!`);
    console.log(`📊 Summary:`);
    console.log(`   - Profiles created: ${profilesCreated}`);
    console.log(`   - Behaviors tracked: ${behaviorsCreated}`);
    console.log(`   - Hotels: ${hotels.length}`);

    // Show some sample analytics
    const sampleHotel = hotels[0];
    const analytics = await GuestCRMProfile.aggregate([
      { $match: { hotelId: sampleHotel._id } },
      {
        $group: {
          _id: '$rfmAnalysis.segment',
          count: { $sum: 1 },
          avgLoyalty: { $avg: '$loyaltyMetrics.score' }
        }
      }
    ]);

    console.log(`\n📈 Sample Analytics for ${sampleHotel.name}:`);
    analytics.forEach(stat => {
      console.log(`   ${stat._id}: ${stat.count} guests (avg loyalty: ${Math.round(stat.avgLoyalty)})`);
    });

  } catch (error) {
    console.error('❌ Error seeding CRM data:', error);
    throw error;
  }
}

// Helper functions for realistic data generation
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomSpecialRequests() {
  const requests = [
    'Late check-in', 'Early check-out', 'High floor', 'Quiet room',
    'Extra towels', 'Baby crib', 'Airport pickup', 'Vegetarian meals',
    'No housekeeping', 'Extra pillows', 'Mini bar restocking'
  ];
  const count = Math.floor(Math.random() * 3);
  const selected = [];
  for (let i = 0; i < count; i++) {
    const request = getRandomElement(requests);
    if (!selected.includes(request)) {
      selected.push(request);
    }
  }
  return selected;
}

function getRandomBehaviorType() {
  const behaviors = [
    'page_view', 'room_search', 'room_view', 'add_to_cart', 'checkout_start',
    'booking_complete', 'email_open', 'email_click', 'support_contact',
    'review_left', 'loyalty_action', 'preferences_update', 'profile_update'
  ];
  const weights = [30, 20, 25, 10, 5, 3, 15, 8, 4, 2, 3, 2, 1]; // Weighted probabilities

  let totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < behaviors.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return behaviors[i];
    }
  }

  return 'page_view';
}

function getRandomPageUrl(behaviorType) {
  const baseUrls = {
    'page_view': ['/rooms', '/amenities', '/contact', '/about'],
    'room_search': ['/search', '/availability'],
    'room_view': ['/rooms/deluxe', '/rooms/suite', '/rooms/standard'],
    'add_to_cart': ['/booking/cart'],
    'checkout_start': ['/booking/checkout'],
    'booking_complete': ['/booking/confirmation'],
    'email_open': ['/email/track/open'],
    'email_click': ['/email/track/click'],
    'support_contact': ['/support', '/contact'],
    'review_left': ['/reviews/submit'],
    'loyalty_action': ['/loyalty/dashboard'],
    'preferences_update': ['/profile/preferences'],
    'profile_update': ['/profile/edit']
  };

  const urls = baseUrls[behaviorType] || ['/'];
  return getRandomElement(urls);
}

function getRandomReferrer() {
  const referrers = [
    'https://google.com/search',
    'https://booking.com',
    'https://expedia.com',
    'https://facebook.com',
    'https://instagram.com',
    'direct',
    'https://tripadvisor.com'
  ];
  return getRandomElement(referrers);
}

function getRandomUserAgent() {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15',
    'Mozilla/5.0 (Android 11; Mobile; rv:89.0) Gecko/89.0 Firefox/89.0'
  ];
  return getRandomElement(userAgents);
}

function getRandomIP() {
  return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

function getRandomCampaign() {
  const campaigns = [
    'summer_special', 'winter_discount', 'weekend_getaway', 'business_travel',
    'holiday_promotion', 'loyalty_reward', 'new_guest_offer', 'facebook_ad',
    'google_ads', 'email_newsletter', null
  ];
  return getRandomElement(campaigns);
}

function getRandomInteractionData(behaviorType) {
  const data = {};

  switch (behaviorType) {
    case 'room_search':
      data.checkInDate = new Date(Date.now() + Math.random() * 60 * 24 * 60 * 60 * 1000);
      data.checkOutDate = new Date(data.checkInDate.getTime() + (Math.random() * 7 + 1) * 24 * 60 * 60 * 1000);
      data.guests = Math.floor(Math.random() * 4) + 1;
      data.roomType = getRandomElement(['standard', 'deluxe', 'suite']);
      break;

    case 'room_view':
      data.roomType = getRandomElement(['standard', 'deluxe', 'suite', 'executive']);
      data.duration = Math.floor(Math.random() * 300) + 30; // 30-330 seconds
      data.scrollDepth = Math.floor(Math.random() * 100);
      break;

    case 'booking_complete':
      data.bookingId = new mongoose.Types.ObjectId();
      data.roomType = getRandomElement(['standard', 'deluxe', 'suite']);
      data.duration = Math.floor(Math.random() * 7) + 1;
      break;

    default:
      data.duration = Math.floor(Math.random() * 180) + 10;
      data.clickCount = Math.floor(Math.random() * 20);
      break;
  }

  return data;
}

function getRandomBrowser() {
  return getRandomElement(['Chrome', 'Firefox', 'Safari', 'Edge', 'Opera']);
}

function getRandomOS() {
  return getRandomElement(['Windows', 'macOS', 'iOS', 'Android', 'Linux']);
}

function getRandomResolution() {
  const resolutions = ['1920x1080', '1366x768', '1536x864', '375x667', '414x896'];
  return getRandomElement(resolutions);
}

async function main() {
  try {
    await connectDB();
    await seedCRMData();
    console.log('🎉 CRM seeding completed successfully!');
  } catch (error) {
    console.error('💥 Seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📤 Database connection closed');
    process.exit(0);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default seedCRMData;