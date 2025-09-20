import mongoose from 'mongoose';
import { PromoCode, ReviewManagement } from './src/models/BookingEngine.js';
import { v4 as uuidv4 } from 'uuid';

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management?retryWrites=true&w=majority&appName=Cluster0";

async function seedPromoCodesAndReviews() {
  try {
    console.log('🌱 Seeding Promo Codes and Reviews...\n');

    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await PromoCode.deleteMany({});
    await ReviewManagement.deleteMany({});
    console.log('🗑️  Cleared existing promo codes and reviews');

    // Seed Promo Codes
    console.log('\n📊 Creating Promo Codes...');
    const promoCodes = [
      {
        codeId: uuidv4(),
        code: 'WELCOME20',
        name: 'Welcome Discount',
        description: 'Welcome discount for new guests',
        type: 'percentage',
        discount: {
          value: 20,
          maxAmount: 1000
        },
        conditions: {
          minBookingValue: 2000,
          minNights: 1,
          maxNights: 7,
          applicableRoomTypes: [],
          firstTimeGuests: true,
          maxUsagePerGuest: 1,
          combinableWithOtherOffers: false
        },
        validity: {
          startDate: new Date('2024-09-01'),
          endDate: new Date('2024-12-31')
        },
        usage: {
          totalUsageLimit: 100,
          currentUsage: 15
        },
        targeting: {
          guestSegments: ['new'],
          channels: ['direct']
        },
        isActive: true
      },
      {
        codeId: uuidv4(),
        code: 'EARLY25',
        name: 'Early Bird Special',
        description: '25% off for bookings made 30 days in advance',
        type: 'percentage',
        discount: {
          value: 25,
          maxAmount: 1500
        },
        conditions: {
          minBookingValue: 3000,
          minNights: 2,
          maxNights: 14,
          applicableRoomTypes: [],
          advanceBookingDays: 30,
          firstTimeGuests: false,
          maxUsagePerGuest: 2,
          combinableWithOtherOffers: true
        },
        validity: {
          startDate: new Date('2024-09-01'),
          endDate: new Date('2024-11-30')
        },
        usage: {
          totalUsageLimit: 50,
          currentUsage: 8
        },
        targeting: {
          guestSegments: ['returning'],
          channels: ['direct', 'booking.com']
        },
        isActive: true
      },
      {
        codeId: uuidv4(),
        code: 'WEEKEND50',
        name: 'Weekend Getaway',
        description: '₹500 off weekend stays',
        type: 'fixed_amount',
        discount: {
          value: 500
        },
        conditions: {
          minBookingValue: 2500,
          minNights: 2,
          maxNights: 3,
          applicableRoomTypes: [],
          validDaysOfWeek: [5, 6], // Friday, Saturday
          firstTimeGuests: false,
          maxUsagePerGuest: 3,
          combinableWithOtherOffers: false
        },
        validity: {
          startDate: new Date('2024-09-01'),
          endDate: new Date('2024-12-31')
        },
        usage: {
          totalUsageLimit: 200,
          currentUsage: 45
        },
        targeting: {
          guestSegments: ['leisure'],
          channels: ['direct']
        },
        isActive: true
      },
      {
        codeId: uuidv4(),
        code: 'LONGSTAY',
        name: 'Extended Stay Discount',
        description: '30% off for stays longer than 7 nights',
        type: 'percentage',
        discount: {
          value: 30,
          maxAmount: 2000
        },
        conditions: {
          minBookingValue: 5000,
          minNights: 7,
          maxNights: 30,
          applicableRoomTypes: [],
          firstTimeGuests: false,
          maxUsagePerGuest: 1,
          combinableWithOtherOffers: true
        },
        validity: {
          startDate: new Date('2024-09-01'),
          endDate: new Date('2025-03-31')
        },
        usage: {
          totalUsageLimit: 25,
          currentUsage: 3
        },
        targeting: {
          guestSegments: ['business', 'extended'],
          channels: ['direct']
        },
        isActive: true
      },
      {
        codeId: uuidv4(),
        code: 'EXPIRED10',
        name: 'Expired Test Code',
        description: 'This code has expired for testing',
        type: 'percentage',
        discount: {
          value: 10
        },
        conditions: {
          minBookingValue: 1000,
          firstTimeGuests: false,
          maxUsagePerGuest: 1,
          combinableWithOtherOffers: false
        },
        validity: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-08-31')
        },
        usage: {
          totalUsageLimit: 100,
          currentUsage: 100
        },
        targeting: {
          guestSegments: ['all'],
          channels: ['direct']
        },
        isActive: false
      }
    ];

    const createdPromoCodes = await PromoCode.insertMany(promoCodes);
    console.log(`✅ Created ${createdPromoCodes.length} promo codes`);

    // Seed Reviews
    console.log('\n📝 Creating Reviews...');
    const reviews = [
      {
        reviewId: 'REV-' + Date.now() + '-1',
        platform: 'google',
        platformReviewId: 'google-123',
        guest: {
          name: 'Sarah Johnson',
          email: 'sarah@example.com',
          verified: true
        },
        content: {
          rating: 5,
          title: 'Outstanding Experience!',
          review: 'The hotel exceeded all my expectations. The staff was incredibly friendly and professional. The room was spotless and beautifully decorated. I would definitely stay here again!',
          roomType: 'Deluxe Room',
          stayDate: new Date('2024-09-15'),
          travelType: 'leisure'
        },
        categories: {
          cleanliness: 5,
          service: 5,
          value: 4,
          location: 5,
          amenities: 4
        },
        sentiment: {
          score: 0.9,
          label: 'positive'
        },
        response: {
          hasResponse: false
        },
        moderation: {
          status: 'approved',
          moderatedAt: new Date(),
          moderatedBy: 'System'
        },
        visibility: {
          isPublic: true,
          featured: true
        }
      },
      {
        reviewId: 'REV-' + Date.now() + '-2',
        platform: 'booking.com',
        platformReviewId: 'booking-456',
        guest: {
          name: 'Michael Chen',
          email: 'michael@example.com',
          verified: true
        },
        content: {
          rating: 4,
          title: 'Great Location, Good Service',
          review: 'Hotel is well located with easy access to major attractions. Staff was helpful and room was comfortable. Only minor issue was with the Wi-Fi speed.',
          roomType: 'Standard Room',
          stayDate: new Date('2024-09-10'),
          travelType: 'business'
        },
        categories: {
          cleanliness: 4,
          service: 4,
          value: 4,
          location: 5,
          amenities: 3
        },
        sentiment: {
          score: 0.7,
          label: 'positive'
        },
        response: {
          hasResponse: true,
          responseText: 'Thank you for your feedback! We appreciate your kind words and will work on improving our Wi-Fi service.',
          respondedAt: new Date(),
          respondedBy: 'Hotel Manager'
        },
        moderation: {
          status: 'approved',
          moderatedAt: new Date(),
          moderatedBy: 'Admin'
        },
        visibility: {
          isPublic: true,
          featured: false
        }
      },
      {
        reviewId: 'REV-' + Date.now() + '-3',
        platform: 'tripadvisor',
        platformReviewId: 'ta-789',
        guest: {
          name: 'Emma Wilson',
          email: 'emma@example.com',
          verified: false
        },
        content: {
          rating: 3,
          title: 'Average Stay',
          review: 'The hotel was okay, nothing special. Room was clean but dated. Service was slow at times. Could use some renovation.',
          roomType: 'Standard Room',
          stayDate: new Date('2024-09-05'),
          travelType: 'leisure'
        },
        categories: {
          cleanliness: 3,
          service: 2,
          value: 3,
          location: 4,
          amenities: 2
        },
        sentiment: {
          score: 0.2,
          label: 'neutral'
        },
        response: {
          hasResponse: false
        },
        moderation: {
          status: 'pending',
          flaggedReasons: ['service_complaint']
        },
        visibility: {
          isPublic: false,
          featured: false
        }
      },
      {
        reviewId: 'REV-' + Date.now() + '-4',
        platform: 'expedia',
        platformReviewId: 'exp-101',
        guest: {
          name: 'David Rodriguez',
          email: 'david@example.com',
          verified: true
        },
        content: {
          rating: 5,
          title: 'Perfect for Business Travel',
          review: 'Excellent business hotel with all necessary amenities. Great meeting facilities, reliable internet, and professional staff. Highly recommended for corporate travelers.',
          roomType: 'Executive Suite',
          stayDate: new Date('2024-09-12'),
          travelType: 'business'
        },
        categories: {
          cleanliness: 5,
          service: 5,
          value: 5,
          location: 4,
          amenities: 5
        },
        sentiment: {
          score: 0.95,
          label: 'positive'
        },
        response: {
          hasResponse: true,
          responseText: 'Thank you for choosing us for your business needs! We are delighted that our facilities met your expectations.',
          respondedAt: new Date(),
          respondedBy: 'Business Center Manager'
        },
        moderation: {
          status: 'approved',
          moderatedAt: new Date(),
          moderatedBy: 'Admin'
        },
        visibility: {
          isPublic: true,
          featured: true
        }
      },
      {
        reviewId: 'REV-' + Date.now() + '-5',
        platform: 'direct',
        guest: {
          name: 'Lisa Thompson',
          email: 'lisa@example.com',
          verified: true
        },
        content: {
          rating: 2,
          title: 'Disappointing Experience',
          review: 'Had high expectations but was let down. Room had maintenance issues, and the air conditioning was not working properly. Staff tried to help but resolution took too long.',
          roomType: 'Deluxe Room',
          stayDate: new Date('2024-09-08'),
          travelType: 'family'
        },
        categories: {
          cleanliness: 2,
          service: 3,
          value: 2,
          location: 4,
          amenities: 1
        },
        sentiment: {
          score: -0.6,
          label: 'negative'
        },
        response: {
          hasResponse: false
        },
        moderation: {
          status: 'flagged',
          flaggedReasons: ['maintenance_complaint', 'poor_rating'],
          moderatedAt: new Date(),
          moderatedBy: 'System'
        },
        visibility: {
          isPublic: false,
          featured: false
        }
      }
    ];

    const createdReviews = await ReviewManagement.insertMany(reviews);
    console.log(`✅ Created ${createdReviews.length} reviews`);

    // Calculate and display summary
    console.log('\n📊 Summary:');
    console.log(`Total Promo Codes: ${createdPromoCodes.length}`);
    console.log(`- Active: ${createdPromoCodes.filter(p => p.isActive).length}`);
    console.log(`- Expired: ${createdPromoCodes.filter(p => !p.isActive).length}`);
    console.log(`- Total Usage: ${createdPromoCodes.reduce((sum, p) => sum + p.usage.currentUsage, 0)}`);

    console.log(`\nTotal Reviews: ${createdReviews.length}`);
    const approvedReviews = createdReviews.filter(r => r.moderation.status === 'approved').length;
    const pendingReviews = createdReviews.filter(r => r.moderation.status === 'pending').length;
    const flaggedReviews = createdReviews.filter(r => r.moderation.status === 'flagged').length;
    const avgRating = createdReviews.reduce((sum, r) => sum + r.content.rating, 0) / createdReviews.length;

    console.log(`- Approved: ${approvedReviews}`);
    console.log(`- Pending: ${pendingReviews}`);
    console.log(`- Flagged: ${flaggedReviews}`);
    console.log(`- Average Rating: ${avgRating.toFixed(1)}`);

    console.log('\n🎉 Seeding completed successfully!');
    console.log('\n🚀 Frontend should now show:');
    console.log(`   Promo Codes: ${createdPromoCodes.filter(p => p.isActive).length} active codes`);
    console.log(`   Reviews: ${createdReviews.length} total, ${approvedReviews} approved, ${pendingReviews} pending`);

  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

seedPromoCodesAndReviews();