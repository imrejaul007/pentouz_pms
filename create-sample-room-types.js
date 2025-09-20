import mongoose from 'mongoose';
import dotenv from 'dotenv';
import RoomType from './src/models/RoomType.js';

// Load environment variables
dotenv.config();

const createSampleRoomTypes = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://mukulrajz82:YlXFLkxRa2tIL85C@cluster0.thahvbk.mongodb.net/hotel-management?retryWrites=true&w=majority');
    console.log('Connected to MongoDB');

    // Sample hotel ID (you can replace this with an actual hotel ID)
    const hotelId = '68b9daea83e9e917f87aa1b5';

    // Check if room types already exist for this hotel
    const existingRoomTypes = await RoomType.find({ hotelId });
    if (existingRoomTypes.length > 0) {
      console.log(`Hotel already has ${existingRoomTypes.length} room types`);
      return;
    }

    // Create sample room types
    const sampleRoomTypes = [
      {
        hotelId,
        name: 'Standard Room',
        code: 'STD',
        maxOccupancy: 2,
        basePrice: 2500,
        description: 'Comfortable standard room with basic amenities',
        amenities: ['WiFi', 'TV', 'Air Conditioning', 'Mini Fridge'],
        isActive: true,
        legacyType: 'single'
      },
      {
        hotelId,
        name: 'Deluxe Room',
        code: 'DLX',
        maxOccupancy: 3,
        basePrice: 3500,
        description: 'Spacious deluxe room with premium amenities',
        amenities: ['WiFi', 'TV', 'Air Conditioning', 'Mini Bar', 'Room Service', 'Balcony'],
        isActive: true,
        legacyType: 'double'
      },
      {
        hotelId,
        name: 'Premium Suite',
        code: 'STE',
        maxOccupancy: 4,
        basePrice: 5500,
        description: 'Luxurious suite with separate living area',
        amenities: ['WiFi', 'TV', 'Air Conditioning', 'Mini Bar', 'Room Service', 'Balcony', 'Jacuzzi', 'Living Area'],
        isActive: true,
        legacyType: 'suite',
        size: {
          squareFeet: 600,
          squareMeters: 55.7
        },
        bedConfiguration: [
          { bedType: 'king', quantity: 1 },
          { bedType: 'sofa_bed', quantity: 1 }
        ]
      },
      {
        hotelId,
        name: 'Executive Suite',
        code: 'EXE',
        maxOccupancy: 4,
        basePrice: 7500,
        description: 'Executive suite with business amenities and city view',
        amenities: ['WiFi', 'TV', 'Air Conditioning', 'Mini Bar', 'Room Service', 'City View', 'Work Desk', 'Meeting Area', 'Complimentary Breakfast'],
        isActive: true,
        legacyType: 'deluxe',
        size: {
          squareFeet: 800,
          squareMeters: 74.3
        },
        bedConfiguration: [
          { bedType: 'king', quantity: 1 },
          { bedType: 'sofa_bed', quantity: 1 }
        ]
      }
    ];

    // Insert room types
    const createdRoomTypes = await RoomType.insertMany(sampleRoomTypes);
    console.log(`Created ${createdRoomTypes.length} room types:`, createdRoomTypes.map(rt => `${rt.name} (${rt.code})`));

  } catch (error) {
    console.error('Error creating sample room types:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

createSampleRoomTypes();