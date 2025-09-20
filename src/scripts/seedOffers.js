import 'dotenv/config';
import mongoose from 'mongoose';
import Offer from '../models/Offer.js';
import Hotel from '../models/Hotel.js';
import logger from '../utils/logger.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management?retryWrites=true&w=majority&appName=Cluster0';

// Sample offers data
const sampleOffers = [
  // Room offers
  {
    title: '20% Off Your Next Stay',
    description: 'Enjoy a fantastic 20% discount on your next room booking at our hotel. Valid for all room types.',
    pointsRequired: 500,
    discountPercentage: 20,
    type: 'discount',
    category: 'room',
    minTier: 'bronze',
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
    maxRedemptions: 100,
    terms: 'Valid for new bookings only. Cannot be combined with other offers. Subject to availability.'
  },
  {
    title: 'Free Room Upgrade',
    description: 'Upgrade your standard room to the next available category at no extra cost.',
    pointsRequired: 800,
    type: 'upgrade',
    category: 'room',
    minTier: 'silver',
    validFrom: new Date(),
    maxRedemptions: 50,
    terms: 'Subject to availability at check-in. Upgrade is to the next available room category.'
  },
  {
    title: 'Suite Upgrade for Gold Members',
    description: 'Exclusive suite upgrade for our valued Gold and Platinum members.',
    pointsRequired: 1500,
    type: 'upgrade',
    category: 'room',
    minTier: 'gold',
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    maxRedemptions: 25,
    terms: 'Available for Gold and Platinum members only. Must be requested at time of booking.'
  },

  // Dining offers
  {
    title: 'Complimentary Breakfast',
    description: 'Start your day with a delicious complimentary breakfast for two at our main restaurant.',
    pointsRequired: 300,
    type: 'free_service',
    category: 'dining',
    minTier: 'bronze',
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
    maxRedemptions: 200,
    terms: 'Valid for breakfast only. For two guests maximum. Must be staying at the hotel.'
  },
  {
    title: '₹1000 Off Restaurant Bill',
    description: 'Get ₹1000 discount on your dining bill at any of our hotel restaurants.',
    pointsRequired: 750,
    discountAmount: 1000,
    type: 'discount',
    category: 'dining',
    minTier: 'silver',
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days
    maxRedemptions: 75,
    terms: 'Minimum bill amount ₹2000. Valid at all hotel restaurants. Cannot be used for room service.'
  },
  {
    title: 'Free Welcome Dinner',
    description: 'Enjoy a complimentary dinner for two at our signature restaurant.',
    pointsRequired: 1200,
    type: 'free_service',
    category: 'dining',
    minTier: 'gold',
    validFrom: new Date(),
    maxRedemptions: 30,
    terms: 'Three-course dinner for two. Beverages not included. Advance reservation required.'
  },

  // Spa offers
  {
    title: '30% Off Spa Services',
    description: 'Relax and rejuvenate with 30% off all spa treatments and services.',
    pointsRequired: 600,
    discountPercentage: 30,
    type: 'discount',
    category: 'spa',
    minTier: 'bronze',
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000), // 120 days
    maxRedemptions: 100,
    terms: 'Valid for all spa services. Advance booking required. Not valid on packages.'
  },
  {
    title: 'Complimentary 60-Min Massage',
    description: 'Enjoy a relaxing 60-minute massage of your choice, completely complimentary.',
    pointsRequired: 1000,
    type: 'free_service',
    category: 'spa',
    minTier: 'silver',
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 180 days
    maxRedemptions: 40,
    terms: 'Choice of Swedish, Deep Tissue, or Aromatherapy massage. Subject to availability.'
  },

  // Transport offers
  {
    title: 'Free Airport Transfer',
    description: 'Complimentary one-way airport transfer service for your convenience.',
    pointsRequired: 400,
    type: 'free_service',
    category: 'transport',
    minTier: 'bronze',
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
    maxRedemptions: 150,
    terms: 'One-way transfer only. Must be booked 24 hours in advance. Subject to availability.'
  },
  {
    title: '50% Off Car Rental',
    description: 'Get half price on our premium car rental services during your stay.',
    pointsRequired: 800,
    discountPercentage: 50,
    type: 'discount',
    category: 'transport',
    minTier: 'silver',
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
    maxRedemptions: 25,
    terms: 'Valid for economy and compact cars only. Driver must be 25+ with valid license.'
  },

  // General/Bonus offers
  {
    title: 'Double Points Weekend',
    description: 'Earn double loyalty points on all purchases during weekends.',
    pointsRequired: 200,
    type: 'bonus_points',
    category: 'general',
    minTier: 'bronze',
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    maxRedemptions: 500,
    terms: 'Valid on Saturdays and Sundays only. Applies to all eligible purchases.'
  },
  {
    title: 'Bonus 1000 Points',
    description: 'Get an instant boost of 1000 loyalty points added to your account.',
    pointsRequired: 100,
    type: 'bonus_points',
    category: 'general',
    minTier: 'bronze',
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days
    maxRedemptions: 1000,
    terms: 'Points will be credited within 24 hours. Valid once per member.'
  },
  {
    title: 'VIP Experience Package',
    description: 'Exclusive VIP treatment including priority check-in, welcome gifts, and concierge service.',
    pointsRequired: 2000,
    type: 'upgrade',
    category: 'general',
    minTier: 'platinum',
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    maxRedemptions: 10,
    terms: 'For Platinum members only. Includes priority services, welcome amenities, and dedicated concierge.'
  },
  {
    title: 'Late Checkout Special',
    description: 'Extend your stay with complimentary late checkout until 4 PM.',
    pointsRequired: 150,
    type: 'free_service',
    category: 'general',
    minTier: 'bronze',
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
    maxRedemptions: 300,
    terms: 'Subject to availability. Must be requested at check-in. Cannot be extended further.'
  }
];

async function seedOffers() {
  try {
    console.log('🌱 Starting offer seeding process...');
    
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Get the first hotel to associate offers with
    const hotel = await Hotel.findOne();
    if (!hotel) {
      console.log('❌ No hotel found. Please seed hotels first.');
      return;
    }
    console.log(`🏨 Using hotel: ${hotel.name} (${hotel._id})`);

    // Clear existing offers (optional - comment out if you want to keep existing offers)
    console.log('🧹 Clearing existing offers...');
    await Offer.deleteMany({});

    // Create offers with hotel reference
    const offersToCreate = sampleOffers.map(offer => ({
      ...offer,
      hotelId: hotel._id,
      currentRedemptions: Math.floor(Math.random() * (offer.maxRedemptions || 100) * 0.3) // Random redemptions (up to 30% of max)
    }));

    console.log(`🏗️ Creating ${offersToCreate.length} sample offers...`);
    const createdOffers = await Offer.insertMany(offersToCreate);
    
    console.log(`✅ Successfully created ${createdOffers.length} offers:`);
    
    // Group offers by category for summary
    const offersByCategory = createdOffers.reduce((acc, offer) => {
      acc[offer.category] = (acc[offer.category] || 0) + 1;
      return acc;
    }, {});

    Object.entries(offersByCategory).forEach(([category, count]) => {
      console.log(`   📋 ${category}: ${count} offers`);
    });

    // Summary by type
    const offersByType = createdOffers.reduce((acc, offer) => {
      acc[offer.type] = (acc[offer.type] || 0) + 1;
      return acc;
    }, {});

    console.log('\n📊 Offers by type:');
    Object.entries(offersByType).forEach(([type, count]) => {
      console.log(`   🎯 ${type.replace('_', ' ')}: ${count} offers`);
    });

    console.log('\n🎉 Offer seeding completed successfully!');
    console.log(`💡 You can now view and manage these offers at: /admin/offers`);
    
  } catch (error) {
    console.error('❌ Error seeding offers:', error);
    logger.error('Offer seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Auto-run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedOffers().catch(console.error);
}

export default seedOffers;