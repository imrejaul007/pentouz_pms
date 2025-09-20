#!/usr/bin/env node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import {
  BookingWidget,
  PromoCode,
  GuestCRM,
  EmailCampaign,
  LoyaltyProgram,
  LandingPage,
  ReviewManagement
} from './src/models/BookingEngine.js';

// Load environment variables
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management?retryWrites=true&w=majority&appName=Cluster0';

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function getExistingData() {
  const User = mongoose.model('User');
  const Booking = mongoose.model('Booking');
  const Review = mongoose.model('Review');
  const Hotel = mongoose.model('Hotel');

  const users = await User.find({}).limit(20);
  const bookings = await Booking.find({}).populate('userId').limit(18);
  const reviews = await Review.find({}).limit(25);
  const hotels = await Hotel.find({}).limit(1);

  return { users, bookings, reviews, hotels };
}

async function seedBookingWidgets() {
  console.log('🔧 Seeding Booking Widgets...');

  const widgets = [
    {
      widgetId: 'main-booking-widget',
      name: 'Main Hotel Booking Widget',
      type: 'inline',
      isActive: true,
      config: {
        theme: {
          primaryColor: '#3b82f6',
          secondaryColor: '#f3f4f6',
          textColor: '#1f2937',
          borderRadius: '8px',
          fontFamily: 'Inter'
        },
        layout: {
          showImages: true,
          showPrices: true,
          showAmenities: true,
          showReviews: true,
          columns: 2,
          maxRooms: 10
        },
        behavior: {
          autoSearch: false,
          showAvailabilityCalendar: true,
          enableGuestSelection: true,
          minStayNights: 1,
          maxStayNights: 30,
          advanceBookingDays: 365
        }
      },
      performance: {
        impressions: 12500,
        clicks: 875,
        conversions: 52,
        conversionRate: 5.94,
        averageBookingValue: 4200
      }
    },
    {
      widgetId: 'popup-promo-widget',
      name: 'Promotional Popup Widget',
      type: 'popup',
      isActive: true,
      config: {
        theme: {
          primaryColor: '#dc2626',
          secondaryColor: '#fef2f2',
          textColor: '#1f2937',
          borderRadius: '12px',
          fontFamily: 'Inter'
        },
        layout: {
          showImages: true,
          showPrices: true,
          showAmenities: false,
          showReviews: false,
          columns: 1,
          maxRooms: 5
        }
      },
      performance: {
        impressions: 8750,
        clicks: 432,
        conversions: 18,
        conversionRate: 4.17,
        averageBookingValue: 3800
      }
    },
    {
      widgetId: 'sidebar-mini-widget',
      name: 'Sidebar Mini Booking',
      type: 'sidebar',
      isActive: true,
      performance: {
        impressions: 5200,
        clicks: 234,
        conversions: 11,
        conversionRate: 4.70,
        averageBookingValue: 3600
      }
    },
    {
      widgetId: 'mobile-floating-widget',
      name: 'Mobile Floating Widget',
      type: 'floating',
      isActive: true,
      performance: {
        impressions: 9800,
        clicks: 654,
        conversions: 35,
        conversionRate: 5.35,
        averageBookingValue: 3900
      }
    },
    {
      widgetId: 'partner-iframe-widget',
      name: 'Partner Site Iframe',
      type: 'iframe',
      isActive: true,
      performance: {
        impressions: 3400,
        clicks: 198,
        conversions: 8,
        conversionRate: 4.04,
        averageBookingValue: 4500
      }
    }
  ];

  await BookingWidget.deleteMany({});
  const createdWidgets = await BookingWidget.insertMany(widgets);
  console.log(`✅ Created ${createdWidgets.length} booking widgets`);
  return createdWidgets;
}

async function seedPromoCodes() {
  console.log('🎫 Seeding Promo Codes...');

  const promoCodes = [
    {
      codeId: 'welcome20',
      code: 'WELCOME20',
      name: 'Welcome Discount',
      description: '20% off for first-time guests',
      type: 'percentage',
      discount: { value: 20, maxAmount: 1000 },
      conditions: {
        minBookingValue: 2000,
        minNights: 2,
        firstTimeGuests: true,
        maxUsagePerGuest: 1
      },
      validity: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2025-12-31')
      },
      usage: {
        totalUsageLimit: 1000,
        currentUsage: 156
      },
      isActive: true
    },
    {
      codeId: 'weekend25',
      code: 'WEEKEND25',
      name: 'Weekend Special',
      description: '25% off weekend stays',
      type: 'percentage',
      discount: { value: 25, maxAmount: 1500 },
      conditions: {
        minBookingValue: 3000,
        validDaysOfWeek: [5, 6], // Friday, Saturday
        minNights: 2
      },
      validity: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2025-06-30')
      },
      usage: {
        totalUsageLimit: 500,
        currentUsage: 89
      },
      isActive: true
    },
    {
      codeId: 'longstay15',
      code: 'LONGSTAY15',
      name: 'Extended Stay Discount',
      description: '15% off stays of 7+ nights',
      type: 'percentage',
      discount: { value: 15 },
      conditions: {
        minNights: 7,
        minBookingValue: 5000
      },
      validity: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2025-12-31')
      },
      usage: {
        currentUsage: 23
      },
      isActive: true
    },
    {
      codeId: 'earlybird500',
      code: 'EARLYBIRD500',
      name: 'Early Bird Fixed Discount',
      description: '₹500 off bookings made 30+ days in advance',
      type: 'fixed_amount',
      discount: { value: 500 },
      conditions: {
        advanceBookingDays: 30,
        minBookingValue: 2500
      },
      validity: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2025-12-31')
      },
      usage: {
        currentUsage: 78
      },
      isActive: true
    },
    {
      codeId: 'stayplus1free',
      code: 'STAYPLUS1FREE',
      name: 'Stay 3 Get 1 Free',
      description: 'Book 3 nights, get 4th night free',
      type: 'free_night',
      discount: { value: 1, freeNights: 1 },
      conditions: {
        minNights: 3,
        minBookingValue: 4000
      },
      validity: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2025-08-31')
      },
      usage: {
        currentUsage: 34
      },
      isActive: true
    }
  ];

  await PromoCode.deleteMany({});
  const createdPromoCodes = await PromoCode.insertMany(promoCodes);
  console.log(`✅ Created ${createdPromoCodes.length} promo codes`);
  return createdPromoCodes;
}

async function seedGuestCRM(users, bookings) {
  console.log('👥 Seeding Guest CRM profiles...');

  const guestProfiles = [];

  for (const user of users.slice(0, 15)) { // Create CRM for 15 users
    const userBookings = bookings.filter(b => b.userId && b.userId._id.toString() === user._id.toString());
    const totalSpent = userBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    const avgBookingValue = userBookings.length > 0 ? totalSpent / userBookings.length : 0;

    // Determine segment based on booking history
    let segment = 'new';
    if (userBookings.length >= 5) segment = 'vip';
    else if (userBookings.length >= 3) segment = 'frequent';
    else if (userBookings.length >= 1) segment = 'potential';

    const profile = {
      guestId: user._id,
      profile: {
        firstName: user.name ? user.name.split(' ')[0] : 'Guest',
        lastName: user.name ? user.name.split(' ').slice(1).join(' ') : '',
        email: user.email,
        phone: user.phone || `+91${Math.floor(Math.random() * 9000000000) + 1000000000}`,
        gender: Math.random() > 0.5 ? 'male' : 'female',
        nationality: 'Indian',
        language: 'en'
      },
      preferences: {
        roomType: ['deluxe', 'suite', 'single', 'double'][Math.floor(Math.random() * 4)],
        bedType: ['king', 'queen', 'twin'][Math.floor(Math.random() * 3)],
        floorLevel: ['high', 'middle', 'low'][Math.floor(Math.random() * 3)],
        smokingPreference: 'non-smoking',
        specialRequests: ['late checkout', 'early checkin', 'room service', 'spa access'].slice(0, Math.floor(Math.random() * 3)),
        communicationPreferences: {
          email: true,
          sms: Math.random() > 0.3,
          phone: Math.random() > 0.7,
          whatsapp: Math.random() > 0.4
        }
      },
      demographics: {
        ageGroup: ['18-25', '26-35', '36-45', '46-55', '55+'][Math.floor(Math.random() * 5)],
        incomeLevel: ['budget', 'mid-range', 'luxury'][Math.floor(Math.random() * 3)],
        travelPurpose: ['business', 'leisure', 'family', 'romantic'][Math.floor(Math.random() * 4)],
        bookingBehavior: ['early_booker', 'last_minute', 'planner'][Math.floor(Math.random() * 3)]
      },
      bookingHistory: {
        totalBookings: userBookings.length,
        totalSpent: totalSpent,
        averageBookingValue: avgBookingValue,
        lastBookingDate: userBookings.length > 0 ? userBookings[userBookings.length - 1].createdAt : null,
        favoriteRoomTypes: ['deluxe', 'suite'],
        leadTime: Math.floor(Math.random() * 30) + 7,
        cancellationRate: Math.random() * 0.1 // 0-10%
      },
      segmentation: {
        lifetimeValue: totalSpent,
        segment: segment,
        loyaltyTier: totalSpent > 20000 ? 'gold' : totalSpent > 10000 ? 'silver' : 'bronze',
        tags: segment === 'vip' ? ['high_value', 'frequent_guest'] : segment === 'frequent' ? ['repeat_customer'] : ['new_guest']
      },
      engagement: {
        emailEngagement: {
          opens: Math.floor(Math.random() * 50),
          clicks: Math.floor(Math.random() * 25),
          lastOpened: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
          unsubscribed: Math.random() > 0.9
        },
        websiteActivity: {
          visits: Math.floor(Math.random() * 20) + 5,
          pageViews: Math.floor(Math.random() * 100) + 20,
          lastVisit: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
          searchQueries: ['luxury room', 'best rates', 'family package']
        }
      },
      feedback: {
        averageRating: 3.5 + Math.random() * 1.5, // 3.5-5 stars
        reviews: [{
          platform: 'direct',
          rating: Math.floor(Math.random() * 2) + 4, // 4-5 stars
          comment: 'Great experience at the hotel',
          date: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000)
        }]
      }
    };

    guestProfiles.push(profile);
  }

  await GuestCRM.deleteMany({});
  const createdProfiles = await GuestCRM.insertMany(guestProfiles);
  console.log(`✅ Created ${createdProfiles.length} guest CRM profiles`);
  return createdProfiles;
}

async function seedEmailCampaigns() {
  console.log('📧 Seeding Email Campaigns...');

  const campaigns = [
    {
      campaignId: 'welcome-series-2024',
      name: 'Welcome Series 2024',
      type: 'welcome',
      status: 'sent',
      content: {
        subject: 'Welcome to THE PENTOUZ - Your Journey Begins!',
        preheader: 'Discover luxury and comfort with exclusive member benefits',
        template: 'welcome_template_v2',
        personalization: {
          useFirstName: true,
          usePastBookings: false,
          usePreferences: true
        }
      },
      targeting: {
        segments: ['new'],
        excludeUnsubscribed: true
      },
      tracking: {
        sent: 1250,
        opens: 687,
        clicks: 123,
        conversions: 34,
        revenue: 142800
      }
    },
    {
      campaignId: 'summer-promo-2024',
      name: 'Summer Special Promotion',
      type: 'promotional',
      status: 'sent',
      content: {
        subject: '🌞 Summer Escape: 25% OFF Your Next Stay!',
        preheader: 'Limited time offer - Book now for summer dates',
        template: 'promotional_template_v3',
        personalization: {
          useFirstName: true,
          usePastBookings: true,
          usePreferences: true,
          dynamicContent: true
        }
      },
      targeting: {
        segments: ['frequent', 'potential'],
        criteria: {
          lastBookingDays: 180,
          spentAmount: { min: 5000, max: 50000 }
        }
      },
      tracking: {
        sent: 2100,
        opens: 1134,
        clicks: 287,
        conversions: 89,
        revenue: 356700
      },
      offers: [{
        type: 'percentage',
        promoCode: 'SUMMER25',
        discount: 25,
        validUntil: new Date('2024-08-31')
      }]
    },
    {
      campaignId: 'abandoned-booking-recovery',
      name: 'Abandoned Booking Recovery',
      type: 'abandoned_booking',
      status: 'sent',
      content: {
        subject: 'Complete Your Booking - Special Discount Inside!',
        preheader: 'Your room is waiting - Save 10% when you complete today',
        template: 'abandoned_booking_template',
        personalization: {
          useFirstName: true,
          usePastBookings: true,
          dynamicContent: true
        }
      },
      tracking: {
        sent: 845,
        opens: 423,
        clicks: 156,
        conversions: 67,
        revenue: 234500
      }
    },
    {
      campaignId: 'post-stay-feedback',
      name: 'Post-Stay Review Request',
      type: 'post_stay',
      status: 'sent',
      content: {
        subject: 'How was your stay? Share your experience',
        preheader: 'Your feedback helps us improve - earn 500 loyalty points',
        template: 'post_stay_template',
        personalization: {
          useFirstName: true,
          usePastBookings: true
        }
      },
      tracking: {
        sent: 1876,
        opens: 1204,
        clicks: 432,
        conversions: 156
      }
    },
    {
      campaignId: 'birthday-special-2024',
      name: 'Birthday Special Campaign',
      type: 'birthday',
      status: 'scheduled',
      content: {
        subject: '🎉 Happy Birthday! Special Gift Inside',
        preheader: 'Celebrate with us - Complimentary room upgrade',
        template: 'birthday_template',
        personalization: {
          useFirstName: true,
          usePreferences: true
        }
      },
      scheduling: {
        recurring: {
          enabled: true,
          frequency: 'monthly'
        }
      },
      tracking: {
        sent: 234,
        opens: 178,
        clicks: 89,
        conversions: 23,
        revenue: 67800
      }
    }
  ];

  await EmailCampaign.deleteMany({});
  const createdCampaigns = await EmailCampaign.insertMany(campaigns);
  console.log(`✅ Created ${createdCampaigns.length} email campaigns`);
  return createdCampaigns;
}

async function seedReviewManagement(reviews) {
  console.log('⭐ Seeding Review Management...');

  const reviewManagements = [];

  // Convert existing reviews to marketing review format
  for (let i = 0; i < Math.min(reviews.length, 20); i++) {
    const review = reviews[i];
    const platforms = ['google', 'tripadvisor', 'booking.com', 'direct', 'facebook'];
    const platform = platforms[Math.floor(Math.random() * platforms.length)];

    const reviewMgmt = {
      reviewId: `review_${Date.now()}_${i}`,
      platform: platform,
      platformReviewId: platform === 'direct' ? null : `${platform}_${Math.random().toString(36).substr(2, 9)}`,
      guest: {
        name: `Guest ${i + 1}`,
        email: `guest${i + 1}@example.com`,
        verified: Math.random() > 0.2
      },
      content: {
        rating: Math.floor(Math.random() * 2) + 4, // 4-5 stars
        title: ['Excellent Stay', 'Great Service', 'Amazing Experience', 'Wonderful Hotel'][Math.floor(Math.random() * 4)],
        review: review.comment || 'Had a wonderful time at the hotel. Great service and comfortable rooms.',
        roomType: ['deluxe', 'suite', 'standard', 'premium'][Math.floor(Math.random() * 4)],
        stayDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
        travelType: ['leisure', 'business', 'family'][Math.floor(Math.random() * 3)]
      },
      categories: {
        cleanliness: 4 + Math.random(),
        comfort: 4 + Math.random(),
        location: 4 + Math.random(),
        facilities: 4 + Math.random(),
        staff: 4 + Math.random(),
        valueForMoney: 3.5 + Math.random() * 1.5
      },
      sentiment: {
        score: 0.3 + Math.random() * 0.7, // 0.3 to 1 (positive)
        label: 'positive',
        confidence: 0.8 + Math.random() * 0.2
      },
      moderation: {
        status: 'approved',
        moderatedAt: new Date()
      },
      visibility: {
        isPublic: true,
        isPromoted: Math.random() > 0.8
      },
      analytics: {
        helpfulVotes: Math.floor(Math.random() * 20),
        views: Math.floor(Math.random() * 500) + 50,
        shares: Math.floor(Math.random() * 5)
      }
    };

    reviewManagements.push(reviewMgmt);
  }

  await ReviewManagement.deleteMany({});
  const createdReviews = await ReviewManagement.insertMany(reviewManagements);
  console.log(`✅ Created ${createdReviews.length} review management entries`);
  return createdReviews;
}

async function seedLoyaltyPrograms() {
  console.log('🏆 Seeding Loyalty Programs...');

  const loyaltyProgram = {
    programId: 'pentouz-rewards',
    name: 'PENTOUZ Rewards',
    description: 'Earn points on every stay and unlock exclusive benefits',
    isActive: true,
    tiers: [
      {
        name: 'Bronze',
        minPoints: 0,
        maxPoints: 2499,
        benefits: [
          { type: 'early_checkin', description: 'Early check-in subject to availability', value: 'free' },
          { type: 'wifi', description: 'Complimentary WiFi', value: 'free' }
        ],
        perks: ['Welcome drink', 'Late checkout (2 PM)'],
        color: '#CD7F32'
      },
      {
        name: 'Silver',
        minPoints: 2500,
        maxPoints: 9999,
        benefits: [
          { type: 'room_upgrade', description: 'Room upgrade subject to availability', value: 'free' },
          { type: 'breakfast', description: 'Complimentary breakfast', value: 'free' }
        ],
        perks: ['Priority check-in', 'Late checkout (4 PM)', 'Welcome amenity'],
        color: '#C0C0C0'
      },
      {
        name: 'Gold',
        minPoints: 10000,
        maxPoints: 24999,
        benefits: [
          { type: 'guaranteed_upgrade', description: 'Guaranteed room upgrade', value: 'free' },
          { type: 'spa_credit', description: 'Spa credit', value: '₹1000' }
        ],
        perks: ['Executive lounge access', 'Late checkout (6 PM)', 'Welcome gift'],
        color: '#FFD700'
      },
      {
        name: 'Platinum',
        minPoints: 25000,
        maxPoints: 999999,
        benefits: [
          { type: 'suite_upgrade', description: 'Suite upgrade when available', value: 'free' },
          { type: 'dining_credit', description: 'Dining credit', value: '₹2000' }
        ],
        perks: ['Personal concierge', 'Private airport transfer', 'VIP amenities'],
        color: '#E5E4E2'
      }
    ],
    pointsRules: {
      earningRates: [
        { action: 'booking', pointsPerDollar: 1, multiplier: 1 },
        { action: 'review', fixedPoints: 100 },
        { action: 'referral', fixedPoints: 500 },
        { action: 'birthday', fixedPoints: 250 }
      ],
      redemptionRates: [
        { reward: 'free_night', pointsRequired: 5000, cashValue: 3000 },
        { reward: 'room_upgrade', pointsRequired: 2000, cashValue: 1500 },
        { reward: 'dining_voucher', pointsRequired: 1500, cashValue: 1000 }
      ],
      expiration: {
        enabled: true,
        months: 24,
        warningDays: 30
      }
    },
    rewards: [
      {
        rewardId: 'free_night_standard',
        name: 'Free Night - Standard Room',
        description: 'One complimentary night in a standard room',
        type: 'free_night',
        pointsRequired: 5000,
        availability: 50,
        validityDays: 365
      },
      {
        rewardId: 'spa_treatment',
        name: 'Complimentary Spa Treatment',
        description: '60-minute relaxation massage',
        type: 'gift',
        pointsRequired: 3000,
        availability: 25,
        validityDays: 180
      }
    ],
    gamification: {
      badges: [
        { name: 'First Stay', description: 'Complete your first booking', icon: 'star', criteria: 'first_booking' },
        { name: 'Review Champion', description: 'Write 5 reviews', icon: 'trophy', criteria: '5_reviews' },
        { name: 'Loyalty Master', description: 'Reach Gold tier', icon: 'crown', criteria: 'gold_tier' }
      ],
      challenges: [
        { name: 'Summer Getaway', description: 'Book 3 stays this summer', pointsReward: 1000, validUntil: new Date('2024-08-31') }
      ]
    }
  };

  await LoyaltyProgram.deleteMany({});
  const createdProgram = await LoyaltyProgram.create(loyaltyProgram);
  console.log(`✅ Created loyalty program: ${createdProgram.name}`);
  return createdProgram;
}

async function updateMarketingMetrics() {
  console.log('📊 Updating marketing dashboard metrics...');

  // Calculate real-time metrics from seeded data
  const widgets = await BookingWidget.find({});
  const campaigns = await EmailCampaign.find({});
  const guestProfiles = await GuestCRM.find({});
  const reviews = await ReviewManagement.find({});

  const totalImpressions = widgets.reduce((sum, w) => sum + (w.performance?.impressions || 0), 0);
  const totalClicks = widgets.reduce((sum, w) => sum + (w.performance?.clicks || 0), 0);
  const totalConversions = widgets.reduce((sum, w) => sum + (w.performance?.conversions || 0), 0);

  const emailsSent = campaigns.reduce((sum, c) => sum + (c.tracking?.sent || 0), 0);
  const emailOpens = campaigns.reduce((sum, c) => sum + (c.tracking?.opens || 0), 0);
  const emailClicks = campaigns.reduce((sum, c) => sum + (c.tracking?.clicks || 0), 0);

  const averageRating = reviews.reduce((sum, r) => sum + (r.content?.rating || 0), 0) / reviews.length;

  console.log('📈 Marketing Dashboard Summary:');
  console.log(`   Widget Impressions: ${totalImpressions.toLocaleString()}`);
  console.log(`   Widget Conversions: ${totalConversions}`);
  console.log(`   Email Campaigns: ${campaigns.length}`);
  console.log(`   Emails Sent: ${emailsSent.toLocaleString()}`);
  console.log(`   Guest Profiles: ${guestProfiles.length}`);
  console.log(`   Review Average: ${averageRating.toFixed(1)} stars`);

  return {
    totalImpressions,
    totalConversions,
    emailsSent,
    guestProfiles: guestProfiles.length,
    averageRating
  };
}

async function main() {
  console.log('🚀 Starting Marketing Data Seeding Process...');
  console.log('=====================================');

  try {
    // Connect to database
    await connectDB();

    // Get existing data to base marketing data on
    const { users, bookings, reviews, hotels } = await getExistingData();
    console.log(`📊 Found existing data: ${users.length} users, ${bookings.length} bookings, ${reviews.length} reviews`);

    // Seed all marketing collections
    await seedBookingWidgets();
    await seedPromoCodes();
    await seedGuestCRM(users, bookings);
    await seedEmailCampaigns();
    await seedReviewManagement(reviews);
    await seedLoyaltyPrograms();

    // Calculate and display summary metrics
    const metrics = await updateMarketingMetrics();

    console.log('=====================================');
    console.log('✅ Marketing Data Seeding Completed Successfully!');
    console.log('📊 Dashboard should now show real data instead of zeros');
    console.log('🔄 Real-time sync between booking and marketing systems is next step');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('📌 Database disconnected');
  }
}

// Run the seeding process
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default main;