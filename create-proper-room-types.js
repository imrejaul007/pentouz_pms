import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Import models
import RoomType from './src/models/RoomType.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hotel-management';
const HOTEL_ID = '68bc094f80c86bfe258e172b';

async function createProperRoomTypes() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log(`\n🗑️ Cleaning existing room types for hotel: ${HOTEL_ID}`);
    await RoomType.deleteMany({ hotelId: HOTEL_ID });
    console.log('✅ Cleaned existing room types');

    console.log('\n🏨 Creating proper room types with correct schema...');
    
    const roomTypesData = [
      {
        code: 'STD',
        name: 'Standard Room',
        description: 'Comfortable standard room with modern amenities and city view',
        shortDescription: 'Cozy standard room for up to 2 guests',
        specifications: {
          maxOccupancy: 2,
          bedType: 'double',
          bedCount: 1,
          roomSize: 25, // 25 square meters
          view: 'city',
          smokingPolicy: 'non_smoking'
        },
        amenities: [
          { code: 'WIFI', name: 'Free WiFi', category: 'technology', isHighlight: true },
          { code: 'AC', name: 'Air Conditioning', category: 'comfort', isHighlight: true },
          { code: 'TV', name: 'LED TV', category: 'entertainment', isHighlight: false },
          { code: 'MINIBAR', name: 'Mini Bar', category: 'comfort', isHighlight: false }
        ],
        totalRooms: 20,
        baseRate: 8000,
        baseCurrency: 'INR',
        category: 'standard',
        rank: 1,
        hotelId: HOTEL_ID,
        settings: {
          allowOverbooking: false,
          overbookingLimit: 0,
          requiresApproval: false
        },
        content: {
          baseLanguage: 'EN',
          contentKeys: {},
          translations: [],
          autoTranslate: true,
          translationPriority: 'medium'
        },
        isActive: true,
        isPublished: true
      },
      {
        code: 'DLX',
        name: 'Deluxe Room',
        description: 'Spacious deluxe room with premium amenities and garden view',
        shortDescription: 'Elegant deluxe room for up to 3 guests',
        specifications: {
          maxOccupancy: 3,
          bedType: 'queen',
          bedCount: 1,
          roomSize: 35, // 35 square meters
          view: 'garden',
          smokingPolicy: 'non_smoking'
        },
        amenities: [
          { code: 'WIFI', name: 'Free WiFi', category: 'technology', isHighlight: true },
          { code: 'AC', name: 'Air Conditioning', category: 'comfort', isHighlight: true },
          { code: 'TV', name: 'Smart TV', category: 'entertainment', isHighlight: true },
          { code: 'MINIBAR', name: 'Mini Bar', category: 'comfort', isHighlight: false },
          { code: 'BALCONY', name: 'Private Balcony', category: 'other', isHighlight: true }
        ],
        totalRooms: 15,
        baseRate: 12000,
        baseCurrency: 'INR',
        category: 'deluxe',
        rank: 2,
        hotelId: HOTEL_ID,
        settings: {
          allowOverbooking: false,
          overbookingLimit: 0,
          requiresApproval: false
        },
        content: {
          baseLanguage: 'EN',
          contentKeys: {},
          translations: [],
          autoTranslate: true,
          translationPriority: 'medium'
        },
        isActive: true,
        isPublished: true
      },
      {
        code: 'STE',
        name: 'Premium Suite',
        description: 'Luxurious premium suite with separate living area and premium amenities',
        shortDescription: 'Spacious premium suite for up to 4 guests',
        specifications: {
          maxOccupancy: 4,
          bedType: 'king',
          bedCount: 1,
          roomSize: 60, // 60 square meters
          view: 'sea',
          smokingPolicy: 'non_smoking'
        },
        amenities: [
          { code: 'WIFI', name: 'Free WiFi', category: 'technology', isHighlight: true },
          { code: 'AC', name: 'Climate Control', category: 'comfort', isHighlight: true },
          { code: 'TV', name: 'Smart TV', category: 'entertainment', isHighlight: true },
          { code: 'MINIBAR', name: 'Premium Mini Bar', category: 'comfort', isHighlight: true },
          { code: 'BALCONY', name: 'Private Balcony', category: 'other', isHighlight: true },
          { code: 'LIVING', name: 'Separate Living Area', category: 'comfort', isHighlight: true }
        ],
        totalRooms: 8,
        baseRate: 20000,
        baseCurrency: 'INR',
        category: 'suite',
        rank: 3,
        hotelId: HOTEL_ID,
        settings: {
          allowOverbooking: false,
          overbookingLimit: 0,
          requiresApproval: false
        },
        content: {
          baseLanguage: 'EN',
          contentKeys: {},
          translations: [],
          autoTranslate: true,
          translationPriority: 'medium'
        },
        isActive: true,
        isPublished: true
      },
      {
        code: 'EXE',
        name: 'Executive Suite',
        description: 'Premium executive suite with exclusive amenities and stunning views',
        shortDescription: 'Luxury executive suite for up to 4 guests',
        specifications: {
          maxOccupancy: 4,
          bedType: 'king',
          bedCount: 1,
          roomSize: 80, // 80 square meters
          view: 'sea',
          smokingPolicy: 'non_smoking'
        },
        amenities: [
          { code: 'WIFI', name: 'Free WiFi', category: 'technology', isHighlight: true },
          { code: 'AC', name: 'Climate Control', category: 'comfort', isHighlight: true },
          { code: 'TV', name: 'Premium Smart TV', category: 'entertainment', isHighlight: true },
          { code: 'MINIBAR', name: 'Premium Mini Bar', category: 'comfort', isHighlight: true },
          { code: 'BALCONY', name: 'Private Balcony', category: 'other', isHighlight: true },
          { code: 'LIVING', name: 'Separate Living Area', category: 'comfort', isHighlight: true },
          { code: 'BUTLER', name: 'Butler Service', category: 'business', isHighlight: true }
        ],
        totalRooms: 5,
        baseRate: 28000,
        baseCurrency: 'INR',
        category: 'executive',
        rank: 4,
        hotelId: HOTEL_ID,
        settings: {
          allowOverbooking: false,
          overbookingLimit: 0,
          requiresApproval: false
        },
        content: {
          baseLanguage: 'EN',
          contentKeys: {},
          translations: [],
          autoTranslate: true,
          translationPriority: 'medium'
        },
        isActive: true,
        isPublished: true
      }
    ];

    console.log(`\n🔨 Creating ${roomTypesData.length} room types...`);
    
    for (const roomTypeData of roomTypesData) {
      console.log(`\n📋 Creating: ${roomTypeData.name} (${roomTypeData.code})`);
      
      const roomType = new RoomType(roomTypeData);
      await roomType.save();
      
      console.log(`  ✅ Created: ₹${roomTypeData.baseRate} - Max ${roomTypeData.specifications.maxOccupancy} guests`);
    }

    console.log('\n🎉 All room types created successfully!');

    // Verify the creation
    console.log('\n🔍 Verifying created room types...');
    const createdRoomTypes = await RoomType.find({ hotelId: HOTEL_ID });
    console.log(`📊 Total room types created: ${createdRoomTypes.length}`);

    createdRoomTypes.forEach((rt, index) => {
      console.log(`\n  ${index + 1}. ${rt.name} (${rt.code})`);
      console.log(`     - ID: ${rt._id}`);
      console.log(`     - Base Rate: ${rt.baseCurrency} ${rt.baseRate}`);
      console.log(`     - Max Occupancy: ${rt.specifications.maxOccupancy}`);
      console.log(`     - Total Rooms: ${rt.totalRooms}`);
      console.log(`     - Category: ${rt.category}`);
      console.log(`     - Active: ${rt.isActive}`);
    });

    // Test API endpoint format
    console.log('\n📡 Testing API endpoint response format...');
    const apiOptions = await RoomType.find(
      { hotelId: HOTEL_ID, isActive: true },
      '_id name code baseRate specifications.maxOccupancy totalRooms'
    ).lean();
    
    const formattedOptions = apiOptions.map(opt => ({
      id: opt._id.toString(),
      roomTypeId: opt._id.toString(), // Using _id as roomTypeId
      name: opt.name,
      code: opt.code,
      basePrice: opt.baseRate,
      maxOccupancy: opt.specifications.maxOccupancy,
      legacyType: opt.code.toLowerCase()
    }));

    console.log('API Response format:');
    console.log(JSON.stringify(formattedOptions, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Database connection closed');
  }
}

createProperRoomTypes();