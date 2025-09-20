import mongoose from 'mongoose';
import RoomType from './src/models/RoomType.js';
import logger from './src/utils/logger.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hotel-management';

// Use the specific hotel ID provided by the user
const HOTEL_ID = '68b9e0125eaf06d56ef64a78';

const roomTypes = [
  {
    hotelId: HOTEL_ID,
    code: 'STD',
    name: 'Standard Room',
    description: 'Comfortable standard room with essential amenities',
    shortDescription: 'Essential comfort for a perfect stay',
    specifications: {
      maxOccupancy: 2,
      bedType: 'double',
      bedCount: 1,
      roomSize: 25,
      view: 'city',
      smokingPolicy: 'non_smoking'
    },
    amenities: [
      { code: 'AC', name: 'Air Conditioning', category: 'comfort', isHighlight: true },
      { code: 'WIFI', name: 'Free WiFi', category: 'technology', isHighlight: true },
      { code: 'TV', name: 'LCD TV', category: 'entertainment' },
      { code: 'MINIBAR', name: 'Mini Bar', category: 'comfort' }
    ],
    totalRooms: 40,
    baseRate: 3500,
    baseCurrency: 'INR',
    content: {
      baseLanguage: 'EN',
      autoTranslate: true,
      translationPriority: 'medium'
    },
    category: 'standard',
    rank: 1,
    isActive: true,
    isPublished: true
  },
  {
    hotelId: HOTEL_ID,
    code: 'DLX',
    name: 'Deluxe Room',
    description: 'Spacious deluxe room with premium amenities and city view',
    shortDescription: 'Enhanced comfort with premium amenities',
    specifications: {
      maxOccupancy: 3,
      bedType: 'king',
      bedCount: 1,
      roomSize: 35,
      view: 'city',
      smokingPolicy: 'non_smoking'
    },
    amenities: [
      { code: 'AC', name: 'Air Conditioning', category: 'comfort', isHighlight: true },
      { code: 'WIFI', name: 'Free WiFi', category: 'technology', isHighlight: true },
      { code: 'TV', name: 'Smart TV', category: 'entertainment', isHighlight: true },
      { code: 'MINIBAR', name: 'Mini Bar', category: 'comfort' },
      { code: 'BALCONY', name: 'Balcony', category: 'comfort', isHighlight: true },
      { code: 'COFFEE', name: 'Coffee Maker', category: 'comfort' }
    ],
    totalRooms: 30,
    baseRate: 5000,
    baseCurrency: 'INR',
    content: {
      baseLanguage: 'EN',
      autoTranslate: true,
      translationPriority: 'high'
    },
    category: 'deluxe',
    rank: 2,
    isActive: true,
    isPublished: true
  },
  {
    hotelId: HOTEL_ID,
    code: 'EXE',
    name: 'Executive Suite',
    description: 'Luxurious executive suite with separate living area and business amenities',
    shortDescription: 'Executive comfort with business facilities',
    specifications: {
      maxOccupancy: 4,
      bedType: 'king',
      bedCount: 1,
      roomSize: 50,
      view: 'sea',
      smokingPolicy: 'non_smoking'
    },
    amenities: [
      { code: 'AC', name: 'Air Conditioning', category: 'comfort', isHighlight: true },
      { code: 'WIFI', name: 'Free WiFi', category: 'technology', isHighlight: true },
      { code: 'TV', name: 'Smart TV', category: 'entertainment', isHighlight: true },
      { code: 'MINIBAR', name: 'Mini Bar', category: 'comfort' },
      { code: 'BALCONY', name: 'Sea View Balcony', category: 'comfort', isHighlight: true },
      { code: 'COFFEE', name: 'Coffee Maker', category: 'comfort' },
      { code: 'WORKDESK', name: 'Work Desk', category: 'business', isHighlight: true },
      { code: 'LIVINGAREA', name: 'Separate Living Area', category: 'comfort', isHighlight: true }
    ],
    totalRooms: 20,
    baseRate: 8000,
    baseCurrency: 'INR',
    content: {
      baseLanguage: 'EN',
      autoTranslate: true,
      translationPriority: 'high'
    },
    category: 'suite',
    rank: 3,
    isActive: true,
    isPublished: true
  },
  {
    hotelId: HOTEL_ID,
    code: 'STE',
    name: 'Premium Suite',
    description: 'Ultimate luxury suite with premium amenities, ocean view, and personalized service',
    shortDescription: 'Luxury redefined with ocean views',
    specifications: {
      maxOccupancy: 4,
      bedType: 'king',
      bedCount: 1,
      roomSize: 70,
      view: 'sea',
      smokingPolicy: 'non_smoking'
    },
    amenities: [
      { code: 'AC', name: 'Climate Control', category: 'comfort', isHighlight: true },
      { code: 'WIFI', name: 'Premium WiFi', category: 'technology', isHighlight: true },
      { code: 'TV', name: 'Premium Smart TV', category: 'entertainment', isHighlight: true },
      { code: 'MINIBAR', name: 'Premium Mini Bar', category: 'comfort' },
      { code: 'BALCONY', name: 'Ocean View Terrace', category: 'comfort', isHighlight: true },
      { code: 'COFFEE', name: 'Espresso Machine', category: 'comfort' },
      { code: 'WORKDESK', name: 'Executive Work Desk', category: 'business' },
      { code: 'LIVINGAREA', name: 'Premium Living Room', category: 'comfort', isHighlight: true },
      { code: 'JACUZZI', name: 'Private Jacuzzi', category: 'comfort', isHighlight: true },
      { code: 'BUTLER', name: 'Butler Service', category: 'other', isHighlight: true }
    ],
    totalRooms: 10,
    baseRate: 12000,
    baseCurrency: 'INR',
    content: {
      baseLanguage: 'EN',
      autoTranslate: true,
      translationPriority: 'critical'
    },
    category: 'premium',
    rank: 4,
    isActive: true,
    isPublished: true
  }
];

async function seedRoomTypes() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    logger.info('Connected to MongoDB for room types seeding');

    // Check if room types already exist for this hotel
    const existingRoomTypes = await RoomType.find({ hotelId: HOTEL_ID });
    
    if (existingRoomTypes.length > 0) {
      logger.info(`Found ${existingRoomTypes.length} existing room types for hotel ${HOTEL_ID}. Skipping seed.`);
      process.exit(0);
    }

    // Create room types
    const createdRoomTypes = await RoomType.create(roomTypes);
    logger.info(`Successfully created ${createdRoomTypes.length} room types for hotel ${HOTEL_ID}`);

    // Log each room type for verification
    createdRoomTypes.forEach(rt => {
      logger.info(`Created room type: ${rt.code} - ${rt.name} (${rt.totalRooms} rooms at ₹${rt.baseRate})`);
    });

    process.exit(0);

  } catch (error) {
    logger.error('Error seeding room types:', error);
    process.exit(1);
  }
}

// Run the seed function
seedRoomTypes();