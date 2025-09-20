import mongoose from 'mongoose';
import RoomType from './src/models/RoomType.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hotel-management';
const HOTEL_ID = '68bc094f80c86bfe258e172b';

async function cleanupRoomTypes() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // First check what we have
    const allRoomTypes = await RoomType.find({ hotelId: HOTEL_ID });
    console.log('\nCurrent room types:');
    allRoomTypes.forEach(rt => {
      console.log(`${rt.name} (${rt.code}): ${rt.totalRooms} rooms, ₹${rt.baseRate}, Active: ${rt.isActive}`);
    });

    // Delete all room types for this hotel
    const deleteResult = await RoomType.deleteMany({ hotelId: HOTEL_ID });
    console.log(`\nDeleted ${deleteResult.deletedCount} room types`);

    // Create the 4 consistent room types we want (totaling 100 rooms)
    const newRoomTypes = [
      {
        hotelId: HOTEL_ID,
        code: 'STD',
        name: 'Standard Room',
        description: 'Comfortable standard room with city view',
        shortDescription: 'Standard room with city view',
        specifications: {
          maxOccupancy: 2,
          bedType: 'double',
          bedCount: 1,
          roomSize: 25,
          view: 'city',
          smokingPolicy: 'non_smoking'
        },
        amenities: [
          { code: 'WIFI', name: 'WiFi', category: 'technology', isHighlight: false },
          { code: 'TV', name: 'TV', category: 'entertainment', isHighlight: false },
          { code: 'AC', name: 'Air Conditioning', category: 'comfort', isHighlight: false },
          { code: 'MINIBAR', name: 'Mini Bar', category: 'comfort', isHighlight: false }
        ],
        totalRooms: 40,
        baseRate: 3500,
        baseCurrency: 'USD',
        category: 'standard',
        rank: 1,
        isActive: true,
        isPublished: true,
        content: {
          baseLanguage: 'EN',
          autoTranslate: true,
          translationPriority: 'medium',
          translations: []
        },
        channels: [],
        images: []
      },
      {
        hotelId: HOTEL_ID,
        code: 'DLX',
        name: 'Deluxe Room',
        description: 'Spacious deluxe room with premium amenities and city view',
        shortDescription: 'Deluxe room with premium amenities',
        specifications: {
          maxOccupancy: 3,
          bedType: 'queen',
          bedCount: 1,
          roomSize: 35,
          view: 'city',
          smokingPolicy: 'non_smoking'
        },
        amenities: [
          { code: 'WIFI', name: 'WiFi', category: 'technology', isHighlight: false },
          { code: 'TV', name: 'TV', category: 'entertainment', isHighlight: false },
          { code: 'AC', name: 'Air Conditioning', category: 'comfort', isHighlight: false },
          { code: 'MINIBAR', name: 'Mini Bar', category: 'comfort', isHighlight: true },
          { code: 'ROOMSERVICE', name: 'Room Service', category: 'other', isHighlight: false },
          { code: 'BALCONY', name: 'Balcony', category: 'comfort', isHighlight: true }
        ],
        totalRooms: 30,
        baseRate: 5000,
        baseCurrency: 'USD',
        category: 'deluxe',
        rank: 2,
        isActive: true,
        isPublished: true,
        content: {
          baseLanguage: 'EN',
          autoTranslate: true,
          translationPriority: 'medium',
          translations: []
        },
        channels: [],
        images: []
      },
      {
        hotelId: HOTEL_ID,
        code: 'EXE',
        name: 'Executive Suite',
        description: 'Executive suite with business amenities and premium city view',
        shortDescription: 'Executive suite with business amenities',
        specifications: {
          maxOccupancy: 4,
          bedType: 'queen',
          bedCount: 1,
          roomSize: 45,
          view: 'city',
          smokingPolicy: 'non_smoking'
        },
        amenities: [
          { code: 'WIFI', name: 'WiFi', category: 'technology', isHighlight: false },
          { code: 'TV', name: 'TV', category: 'entertainment', isHighlight: false },
          { code: 'AC', name: 'Air Conditioning', category: 'comfort', isHighlight: false },
          { code: 'MINIBAR', name: 'Mini Bar', category: 'comfort', isHighlight: true },
          { code: 'ROOMSERVICE', name: 'Room Service', category: 'other', isHighlight: false },
          { code: 'CITYVIEW', name: 'City View', category: 'comfort', isHighlight: true },
          { code: 'WORKDESK', name: 'Work Desk', category: 'business', isHighlight: false },
          { code: 'BREAKFAST', name: 'Complimentary Breakfast', category: 'other', isHighlight: true }
        ],
        totalRooms: 20,
        baseRate: 8000,
        baseCurrency: 'USD',
        category: 'executive',
        rank: 3,
        isActive: true,
        isPublished: true,
        content: {
          baseLanguage: 'EN',
          autoTranslate: true,
          translationPriority: 'medium',
          translations: []
        },
        channels: [],
        images: []
      },
      {
        hotelId: HOTEL_ID,
        code: 'STE',
        name: 'Premium Suite',
        description: 'Luxurious suite with separate living area and premium amenities',
        shortDescription: 'Luxury suite with living area',
        specifications: {
          maxOccupancy: 4,
          bedType: 'king',
          bedCount: 1,
          roomSize: 60,
          view: 'city',
          smokingPolicy: 'non_smoking'
        },
        amenities: [
          { code: 'WIFI', name: 'WiFi', category: 'technology', isHighlight: false },
          { code: 'TV', name: 'TV', category: 'entertainment', isHighlight: false },
          { code: 'AC', name: 'Air Conditioning', category: 'comfort', isHighlight: false },
          { code: 'MINIBAR', name: 'Mini Bar', category: 'comfort', isHighlight: true },
          { code: 'ROOMSERVICE', name: 'Room Service', category: 'other', isHighlight: false },
          { code: 'BALCONY', name: 'Balcony', category: 'comfort', isHighlight: true },
          { code: 'JACUZZI', name: 'Jacuzzi', category: 'comfort', isHighlight: true },
          { code: 'LIVINGAREA', name: 'Living Area', category: 'comfort', isHighlight: true }
        ],
        totalRooms: 10,
        baseRate: 12000,
        baseCurrency: 'USD',
        category: 'suite',
        rank: 4,
        isActive: true,
        isPublished: true,
        content: {
          baseLanguage: 'EN',
          autoTranslate: true,
          translationPriority: 'high',
          translations: []
        },
        channels: [],
        images: []
      }
    ];

    const createdRoomTypes = await RoomType.create(newRoomTypes);
    console.log(`\nCreated ${createdRoomTypes.length} clean room types:`);

    let totalRooms = 0;
    let totalValue = 0;
    createdRoomTypes.forEach(rt => {
      console.log(`${rt.name} (${rt.code}): ${rt.totalRooms} rooms, ₹${rt.baseRate}`);
      totalRooms += rt.totalRooms;
      totalValue += rt.baseRate;
    });

    const avgRate = Math.round(totalValue / createdRoomTypes.length);
    console.log(`\nFinal Summary:`);
    console.log(`Total Room Types: ${createdRoomTypes.length}`);
    console.log(`Total Rooms: ${totalRooms}`);
    console.log(`Average Base Rate: ₹${avgRate}`);
    console.log(`Active Types: ${createdRoomTypes.filter(rt => rt.isActive).length}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

cleanupRoomTypes();