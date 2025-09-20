import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Import all models
import Hotel from './src/models/Hotel.js';
import User from './src/models/User.js';
import Room from './src/models/Room.js';
import RoomType from './src/models/RoomType.js';
import Booking from './src/models/Booking.js';
import RoomAvailability from './src/models/RoomAvailability.js';
import WebSettings from './src/models/WebSettings.js';
import BookingFormTemplate from './src/models/BookingFormTemplate.js';
import AuditLog from './src/models/AuditLog.js';
import APIKey from './src/models/APIKey.js';
import WebhookEndpoint from './src/models/WebhookEndpoint.js';
import APIMetrics from './src/models/APIMetrics.js';
import RoomTypeAllotment from './src/models/RoomTypeAllotment.js';

// MongoDB connection string
const MONGO_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

// Your specified hotel ID
const HOTEL_ID = '68bc094f80c86bfe258e172b';

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// Clear existing data
async function clearExistingData() {
  console.log('🧹 Clearing existing data...');
  
  try {
    // Clear all collections in order (respecting foreign key constraints)
    await Booking.deleteMany({});
    await RoomAvailability.deleteMany({});
    await RoomTypeAllotment.deleteMany({});
    await Room.deleteMany({});
    await RoomType.deleteMany({});
    await WebSettings.deleteMany({});
    await BookingFormTemplate.deleteMany({});
    await AuditLog.deleteMany({});
    await APIKey.deleteMany({});
    await WebhookEndpoint.deleteMany({});
    await APIMetrics.deleteMany({});
    await User.deleteMany({});
    await Hotel.deleteMany({});
    
    console.log('✅ Existing data cleared successfully');
  } catch (error) {
    console.error('❌ Error clearing data:', error);
    throw error;
  }
}

// Create seed data
async function createSeedData() {
  console.log('🌱 Creating seed data...');
  
  try {
    // 1. Create Owner/Admin User first
    console.log('Creating Owner/Admin User...');
    const ownerUser = new User({
      name: 'Hotel Owner',
      email: 'owner@grandpalacehotel.com',
      password: 'admin123',
      phone: '+91-98765-43210',
      role: 'admin',
      hotelId: new mongoose.Types.ObjectId(HOTEL_ID), // Will be created next
      preferences: {
        bedType: 'king',
        floor: '5',
        smokingAllowed: false
      },
      loyalty: {
        points: 0,
        tier: 'platinum'
      },
      isActive: true
    });
    
    await ownerUser.save();
    console.log('✅ Owner user created:', ownerUser._id);

    // 2. Create Hotel
    console.log('Creating Hotel...');
    const hotel = new Hotel({
      _id: new mongoose.Types.ObjectId(HOTEL_ID),
      name: 'Grand Palace Hotel',
      description: 'A luxurious 5-star hotel in the heart of the city with world-class amenities and exceptional service.',
      address: {
        street: '123 Royal Avenue',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        zipCode: '400001',
        coordinates: {
          latitude: 19.0760,
          longitude: 72.8777
        }
      },
      contact: {
        phone: '+91-22-1234-5678',
        email: 'info@grandpalacehotel.com',
        website: 'https://www.grandpalacehotel.com'
      },
      amenities: [
        'Free WiFi',
        'Swimming Pool',
        'Fitness Center',
        'Spa & Wellness',
        'Restaurant',
        'Bar',
        'Room Service',
        'Concierge',
        'Business Center',
        'Parking',
        'Airport Shuttle',
        'Pet Friendly'
      ],
      images: [
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
        'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800',
        'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800'
      ],
      policies: {
        checkInTime: '15:00',
        checkOutTime: '11:00',
        cancellationPolicy: 'Free cancellation 24 hours before check-in',
        petPolicy: 'Pets allowed with additional charges',
        smokingPolicy: 'Non-smoking property'
      },
      settings: {
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        language: 'en'
      },
      isActive: true,
      ownerId: ownerUser._id
    });
    
    await hotel.save();
    console.log('✅ Hotel created:', hotel._id);

    // 3. Create Staff Users
    console.log('Creating Staff Users...');
    const staffUsers = [
      {
        name: 'John Manager',
        email: 'manager@grandpalacehotel.com',
        password: 'manager123',
        phone: '+91-98765-43211',
        role: 'manager',
        hotelId: hotel._id
      },
      {
        name: 'Sarah Receptionist',
        email: 'reception@grandpalacehotel.com',
        password: 'staff123',
        phone: '+91-98765-43212',
        role: 'staff',
        hotelId: hotel._id
      },
      {
        name: 'Mike Housekeeping',
        email: 'housekeeping@grandpalacehotel.com',
        password: 'staff123',
        phone: '+91-98765-43213',
        role: 'staff',
        hotelId: hotel._id
      }
    ];

    const createdStaff = [];
    for (const staffData of staffUsers) {
      const staff = new User({
        ...staffData,
        preferences: {
          bedType: 'double',
          smokingAllowed: false
        },
        loyalty: {
          points: 0,
          tier: 'bronze'
        },
        isActive: true
      });
      await staff.save();
      createdStaff.push(staff);
      console.log('✅ Staff user created:', staff.name);
    }

    // 4. Create Guest Users
    console.log('Creating Guest Users...');
    const guestUsers = [
      {
        name: 'Alice Johnson',
        email: 'alice.johnson@email.com',
        password: 'guest123',
        phone: '+91-98765-43214',
        role: 'guest',
        preferences: {
          bedType: 'queen',
          floor: '3',
          smokingAllowed: false
        },
        loyalty: {
          points: 2500,
          tier: 'gold'
        }
      },
      {
        name: 'Bob Smith',
        email: 'bob.smith@email.com',
        password: 'guest123',
        phone: '+91-98765-43215',
        role: 'guest',
        preferences: {
          bedType: 'king',
          floor: '7',
          smokingAllowed: false
        },
        loyalty: {
          points: 800,
          tier: 'silver'
        }
      },
      {
        name: 'Carol Davis',
        email: 'carol.davis@email.com',
        password: 'guest123',
        phone: '+91-98765-43216',
        role: 'guest',
        preferences: {
          bedType: 'double',
          smokingAllowed: false
        },
        loyalty: {
          points: 150,
          tier: 'bronze'
        }
      }
    ];

    const createdGuests = [];
    for (const guestData of guestUsers) {
      const guest = new User({
        ...guestData,
        isActive: true
      });
      await guest.save();
      createdGuests.push(guest);
      console.log('✅ Guest user created:', guest.name);
    }

    // 5. Create Room Types
    console.log('Creating Room Types...');
    const roomTypes = [
      {
        code: 'STD',
        name: 'Standard Room',
        description: 'Comfortable standard room with modern amenities',
        shortDescription: 'Standard room with city view',
        specifications: {
          maxOccupancy: 2,
          bedType: 'double',
          bedCount: 1,
          roomSize: 25,
          floor: { min: 1, max: 3 },
          view: 'city',
          smokingPolicy: 'non_smoking'
        },
        totalRooms: 20,
        baseRate: 5000,
        baseCurrency: 'INR',
        content: {
          baseLanguage: 'EN',
          contentKeys: {
            name: 'room.type.std.name',
            description: 'room.type.std.description',
            shortDescription: 'room.type.std.short_description'
          },
          translations: [
            { language: 'EN', status: 'published', completeness: 100 },
            { language: 'HI', status: 'translated', completeness: 80 }
          ]
        },
        amenities: [
          { code: 'WIFI', name: 'Free WiFi', category: 'technology', isHighlight: true },
          { code: 'AC', name: 'Air Conditioning', category: 'comfort', isHighlight: true },
          { code: 'TV', name: 'LED TV', category: 'entertainment', isHighlight: false },
          { code: 'MINIBAR', name: 'Mini Bar', category: 'comfort', isHighlight: false }
        ],
        images: [
          { url: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800', type: 'main', order: 1 },
          { url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800', type: 'bathroom', order: 2 }
        ],
        category: 'standard',
        rank: 1,
        hotelId: hotel._id,
        isActive: true,
        isPublished: true,
        createdBy: ownerUser._id
      },
      {
        code: 'DLX',
        name: 'Deluxe Room',
        description: 'Spacious deluxe room with premium amenities and better views',
        shortDescription: 'Deluxe room with garden view',
        specifications: {
          maxOccupancy: 3,
          bedType: 'king',
          bedCount: 1,
          roomSize: 35,
          floor: { min: 4, max: 6 },
          view: 'garden',
          smokingPolicy: 'non_smoking'
        },
        totalRooms: 15,
        baseRate: 7500,
        baseCurrency: 'INR',
        content: {
          baseLanguage: 'EN',
          contentKeys: {
            name: 'room.type.dlx.name',
            description: 'room.type.dlx.description',
            shortDescription: 'room.type.dlx.short_description'
          },
          translations: [
            { language: 'EN', status: 'published', completeness: 100 },
            { language: 'HI', status: 'translated', completeness: 75 }
          ]
        },
        amenities: [
          { code: 'WIFI', name: 'Free WiFi', category: 'technology', isHighlight: true },
          { code: 'AC', name: 'Air Conditioning', category: 'comfort', isHighlight: true },
          { code: 'TV', name: 'Smart TV', category: 'entertainment', isHighlight: true },
          { code: 'MINIBAR', name: 'Premium Mini Bar', category: 'comfort', isHighlight: true },
          { code: 'BALCONY', name: 'Private Balcony', category: 'comfort', isHighlight: true }
        ],
        images: [
          { url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800', type: 'main', order: 1 },
          { url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800', type: 'view', order: 2 }
        ],
        category: 'deluxe',
        rank: 2,
        hotelId: hotel._id,
        isActive: true,
        isPublished: true,
        createdBy: ownerUser._id
      },
      {
        code: 'SUITE',
        name: 'Executive Suite',
        description: 'Luxurious executive suite with separate living area and premium amenities',
        shortDescription: 'Executive suite with city skyline view',
        specifications: {
          maxOccupancy: 4,
          bedType: 'king',
          bedCount: 1,
          roomSize: 60,
          floor: { min: 7, max: 10 },
          view: 'city',
          smokingPolicy: 'non_smoking'
        },
        totalRooms: 8,
        baseRate: 15000,
        baseCurrency: 'INR',
        content: {
          baseLanguage: 'EN',
          contentKeys: {
            name: 'room.type.suite.name',
            description: 'room.type.suite.description',
            shortDescription: 'room.type.suite.short_description'
          },
          translations: [
            { language: 'EN', status: 'published', completeness: 100 },
            { language: 'HI', status: 'translated', completeness: 60 }
          ]
        },
        amenities: [
          { code: 'WIFI', name: 'Free WiFi', category: 'technology', isHighlight: true },
          { code: 'AC', name: 'Air Conditioning', category: 'comfort', isHighlight: true },
          { code: 'TV', name: 'Smart TV (2)', category: 'entertainment', isHighlight: true },
          { code: 'MINIBAR', name: 'Premium Mini Bar', category: 'comfort', isHighlight: true },
          { code: 'BALCONY', name: 'Private Balcony', category: 'comfort', isHighlight: true },
          { code: 'JACUZZI', name: 'Jacuzzi', category: 'comfort', isHighlight: true },
          { code: 'BUTLER', name: 'Butler Service', category: 'service', isHighlight: true }
        ],
        images: [
          { url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800', type: 'main', order: 1 },
          { url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800', type: 'view', order: 2 }
        ],
        category: 'suite',
        rank: 3,
        hotelId: hotel._id,
        isActive: true,
        isPublished: true,
        createdBy: ownerUser._id
      }
    ];

    const createdRoomTypes = [];
    for (const roomTypeData of roomTypes) {
      const roomType = new RoomType(roomTypeData);
      await roomType.save();
      createdRoomTypes.push(roomType);
      console.log('✅ Room type created:', roomType.name);
    }

    // 6. Create Rooms
    console.log('Creating Rooms...');
    const rooms = [];
    
    // Standard Rooms (20 rooms)
    for (let i = 1; i <= 20; i++) {
      const room = new Room({
        hotelId: hotel._id,
        roomNumber: `10${i.toString().padStart(2, '0')}`,
        roomTypeId: createdRoomTypes[0]._id, // Standard
        type: 'single', // Legacy field
        baseRate: 5000,
        currentRate: 5000,
        status: 'vacant',
        floor: Math.floor(i / 7) + 1,
        capacity: 2,
        amenities: ['Free WiFi', 'Air Conditioning', 'LED TV', 'Mini Bar'],
        images: ['https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400'],
        description: 'Comfortable standard room with modern amenities',
        isActive: true,
        revenueAccountCode: 'ROOM_STD',
        lastCleaned: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
      });
      await room.save();
      rooms.push(room);
    }

    // Deluxe Rooms (15 rooms)
    for (let i = 1; i <= 15; i++) {
      const room = new Room({
        hotelId: hotel._id,
        roomNumber: `20${i.toString().padStart(2, '0')}`,
        roomTypeId: createdRoomTypes[1]._id, // Deluxe
        type: 'double', // Legacy field
        baseRate: 7500,
        currentRate: 7500,
        status: 'vacant',
        floor: Math.floor(i / 5) + 4,
        capacity: 3,
        amenities: ['Free WiFi', 'Air Conditioning', 'Smart TV', 'Premium Mini Bar', 'Private Balcony'],
        images: ['https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400'],
        description: 'Spacious deluxe room with premium amenities',
        isActive: true,
        revenueAccountCode: 'ROOM_DLX',
        lastCleaned: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
      });
      await room.save();
      rooms.push(room);
    }

    // Executive Suites (8 rooms)
    for (let i = 1; i <= 8; i++) {
      const room = new Room({
        hotelId: hotel._id,
        roomNumber: `30${i.toString().padStart(2, '0')}`,
        roomTypeId: createdRoomTypes[2]._id, // Suite
        type: 'suite', // Legacy field
        baseRate: 15000,
        currentRate: 15000,
        status: 'vacant',
        floor: i + 6,
        capacity: 4,
        amenities: ['Free WiFi', 'Air Conditioning', 'Smart TV (2)', 'Premium Mini Bar', 'Private Balcony', 'Jacuzzi', 'Butler Service'],
        images: ['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400'],
        description: 'Luxurious executive suite with separate living area',
        isActive: true,
        revenueAccountCode: 'ROOM_SUITE',
        lastCleaned: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
      });
      await room.save();
      rooms.push(room);
    }

    console.log('✅ Created', rooms.length, 'rooms');

    // 7. Create Room Availability for next 90 days
    console.log('Creating Room Availability...');
    const today = new Date();
    const availabilityRecords = [];

    for (let dayOffset = 0; dayOffset < 90; dayOffset++) {
      const date = new Date(today);
      date.setDate(today.getDate() + dayOffset);
      
      for (const roomType of createdRoomTypes) {
        const availability = new RoomAvailability({
          hotelId: hotel._id,
          roomTypeId: roomType._id,
          date: date,
          totalRooms: roomType.totalRooms,
          availableRooms: roomType.totalRooms - Math.floor(Math.random() * Math.min(roomType.totalRooms * 0.3, 5)), // Random occupancy
          soldRooms: Math.floor(Math.random() * Math.min(roomType.totalRooms * 0.3, 5)),
          blockedRooms: Math.floor(Math.random() * 2),
          overbookedRooms: 0,
          stopSellFlag: false,
          closedToArrival: false,
          closedToDeparture: false,
          minLengthOfStay: 1,
          maxLengthOfStay: 30,
          baseRate: roomType.baseRate,
          sellingRate: roomType.baseRate + Math.floor(Math.random() * 1000) - 500, // Random rate variation
          currency: 'INR',
          needsSync: false,
          lastModifiedBy: ownerUser._id
        });
        
        availabilityRecords.push(availability);
      }
    }

    // Insert availability records in batches
    const batchSize = 100;
    for (let i = 0; i < availabilityRecords.length; i += batchSize) {
      const batch = availabilityRecords.slice(i, i + batchSize);
      await RoomAvailability.insertMany(batch, { ordered: false });
    }

    console.log('✅ Created', availabilityRecords.length, 'availability records');

    // 8. Create Bookings
    console.log('Creating Bookings...');
    const bookings = [];
    
    // Create some past bookings
    for (let i = 0; i < 10; i++) {
      const checkIn = new Date(today);
      checkIn.setDate(today.getDate() - Math.floor(Math.random() * 30) - 1);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkIn.getDate() + Math.floor(Math.random() * 5) + 1);
      
      const randomRoom = rooms[Math.floor(Math.random() * rooms.length)];
      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
      
      const booking = new Booking({
        hotelId: hotel._id,
        userId: createdGuests[Math.floor(Math.random() * createdGuests.length)]._id,
        rooms: [{
          roomId: randomRoom._id,
          rate: randomRoom.currentRate
        }],
        checkIn: checkIn,
        checkOut: checkOut,
        nights: nights,
        status: ['checked_out', 'cancelled'][Math.floor(Math.random() * 2)],
        paymentStatus: 'paid',
        totalAmount: randomRoom.currentRate * nights,
        currency: 'INR',
        guestDetails: {
          adults: Math.floor(Math.random() * 3) + 1,
          children: Math.floor(Math.random() * 2),
          specialRequests: Math.random() > 0.7 ? 'Late check-in requested' : null
        },
        source: ['direct', 'booking_com', 'expedia'][Math.floor(Math.random() * 3)],
        checkInTime: new Date(checkIn.getTime() + 2 * 60 * 60 * 1000), // 2 hours after check-in
        checkOutTime: new Date(checkOut.getTime() - 1 * 60 * 60 * 1000) // 1 hour before check-out
      });
      
      await booking.save();
      bookings.push(booking);
    }

    // Create some current bookings
    for (let i = 0; i < 5; i++) {
      const checkIn = new Date(today);
      checkIn.setDate(today.getDate() - Math.floor(Math.random() * 3));
      const checkOut = new Date(today);
      checkOut.setDate(today.getDate() + Math.floor(Math.random() * 5) + 1);
      
      const randomRoom = rooms[Math.floor(Math.random() * rooms.length)];
      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
      
      const booking = new Booking({
        hotelId: hotel._id,
        userId: createdGuests[Math.floor(Math.random() * createdGuests.length)]._id,
        rooms: [{
          roomId: randomRoom._id,
          rate: randomRoom.currentRate
        }],
        checkIn: checkIn,
        checkOut: checkOut,
        nights: nights,
        status: ['confirmed', 'checked_in'][Math.floor(Math.random() * 2)],
        paymentStatus: 'paid',
        totalAmount: randomRoom.currentRate * nights,
        currency: 'INR',
        guestDetails: {
          adults: Math.floor(Math.random() * 3) + 1,
          children: Math.floor(Math.random() * 2),
          specialRequests: Math.random() > 0.8 ? 'High floor preferred' : null
        },
        source: ['direct', 'booking_com'][Math.floor(Math.random() * 2)]
      });
      
      await booking.save();
      bookings.push(booking);
    }

    // Create some future bookings
    for (let i = 0; i < 8; i++) {
      const checkIn = new Date(today);
      checkIn.setDate(today.getDate() + Math.floor(Math.random() * 30) + 1);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkIn.getDate() + Math.floor(Math.random() * 7) + 1);
      
      const randomRoom = rooms[Math.floor(Math.random() * rooms.length)];
      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
      
      const booking = new Booking({
        hotelId: hotel._id,
        userId: createdGuests[Math.floor(Math.random() * createdGuests.length)]._id,
        rooms: [{
          roomId: randomRoom._id,
          rate: randomRoom.currentRate
        }],
        checkIn: checkIn,
        checkOut: checkOut,
        nights: nights,
        status: 'confirmed',
        paymentStatus: ['paid', 'pending'][Math.floor(Math.random() * 2)],
        totalAmount: randomRoom.currentRate * nights,
        currency: 'INR',
        guestDetails: {
          adults: Math.floor(Math.random() * 3) + 1,
          children: Math.floor(Math.random() * 2),
          specialRequests: Math.random() > 0.9 ? 'Anniversary celebration' : null
        },
        source: ['direct', 'booking_com', 'expedia'][Math.floor(Math.random() * 3)]
      });
      
      await booking.save();
      bookings.push(booking);
    }

    console.log('✅ Created', bookings.length, 'bookings');

    // 9. Create Web Settings
    console.log('Creating Web Settings...');
    const webSettings = new WebSettings({
      hotelId: hotel._id,
      general: {
        hotelName: 'Grand Palace Hotel',
        description: 'A luxurious 5-star hotel in the heart of Mumbai with world-class amenities and exceptional service.',
        address: {
          street: '123 Royal Avenue',
          city: 'Mumbai',
          state: 'Maharashtra',
          country: 'India',
          postalCode: '400001'
        },
        contact: {
          phone: '+91-22-1234-5678',
          email: 'info@grandpalacehotel.com',
          website: 'https://www.grandpalacehotel.com',
          socialMedia: {
            facebook: 'https://facebook.com/grandpalacehotel',
            instagram: 'https://instagram.com/grandpalacehotel',
            twitter: 'https://twitter.com/grandpalacehotel'
          }
        },
        timezone: 'Asia/Kolkata',
        currency: {
          code: 'INR',
          symbol: '₹',
          position: 'before'
        },
        languages: [
          { code: 'en', name: 'English', isDefault: true },
          { code: 'hi', name: 'Hindi', isDefault: false }
        ]
      },
      booking: {
        minimumStay: 1,
        maximumStay: 30,
        advanceBookingLimit: 365,
        cutoffTime: { hours: 18, minutes: 0 },
        cancellationPolicy: {
          type: 'moderate',
          hoursBeforeCheckin: 24,
          penaltyPercentage: 0,
          customTerms: 'Free cancellation 24 hours before check-in'
        },
        checkInTime: '15:00',
        checkOutTime: '11:00',
        instantConfirmation: true,
        requiresApproval: false,
        guestDataRequired: ['full_name', 'email', 'phone']
      },
      payment: {
        gateways: [
          {
            name: 'razorpay',
            isActive: true,
            configuration: {
              keyId: 'rzp_test_1234567890',
              keySecret: 'test_secret_key'
            },
            fees: { percentage: 2.5, fixed: 0 }
          }
        ],
        acceptedCurrencies: [
          { code: 'INR', symbol: '₹', exchangeRate: 1 }
        ],
        paymentMethods: [
          { type: 'credit_card', isActive: true },
          { type: 'debit_card', isActive: true },
          { type: 'upi', isActive: true },
          { type: 'netbanking', isActive: true }
        ],
        depositRequired: false,
        taxInclusive: true
      },
      seo: {
        metaTags: {
          title: 'Grand Palace Hotel Mumbai - Luxury 5 Star Hotel',
          description: 'Experience luxury at Grand Palace Hotel Mumbai. 5-star accommodation with world-class amenities in the heart of the city.',
          keywords: ['luxury hotel mumbai', '5 star hotel', 'grand palace hotel', 'mumbai accommodation']
        },
        robots: { index: true, follow: true }
      },
      theme: {
        colorScheme: {
          primary: '#1e40af',
          secondary: '#64748b',
          accent: '#f59e0b',
          background: '#ffffff',
          text: '#1f2937',
          success: '#10b981',
          error: '#ef4444',
          warning: '#f59e0b'
        },
        typography: {
          primaryFont: 'Inter',
          secondaryFont: 'Inter',
          fontSize: { base: '16px', scale: 1.125 }
        }
      },
      isActive: true,
      createdBy: ownerUser._id
    });

    await webSettings.save();
    console.log('✅ Web settings created');

    // 10. Create Booking Form Template
    console.log('Creating Booking Form Template...');
    const bookingFormTemplate = new BookingFormTemplate({
      hotelId: hotel._id,
      name: 'Standard Booking Form',
      description: 'Main booking form for hotel reservations',
      category: 'booking',
      fields: [
        {
          id: 'check_in',
          type: 'date',
          label: 'Check-in Date',
          required: true,
          order: 1,
          width: '50'
        },
        {
          id: 'check_out',
          type: 'date',
          label: 'Check-out Date',
          required: true,
          order: 2,
          width: '50'
        },
        {
          id: 'guests',
          type: 'number',
          label: 'Number of Guests',
          required: true,
          min: 1,
          max: 10,
          order: 3,
          width: '50'
        },
        {
          id: 'room_type',
          type: 'select',
          label: 'Room Type',
          required: true,
          order: 4,
          width: '50',
          options: [
            { label: 'Standard Room', value: 'STD' },
            { label: 'Deluxe Room', value: 'DLX' },
            { label: 'Executive Suite', value: 'SUITE' }
          ]
        },
        {
          id: 'first_name',
          type: 'text',
          label: 'First Name',
          required: true,
          order: 5,
          width: '50'
        },
        {
          id: 'last_name',
          type: 'text',
          label: 'Last Name',
          required: true,
          order: 6,
          width: '50'
        },
        {
          id: 'email',
          type: 'email',
          label: 'Email Address',
          required: true,
          order: 7,
          width: '50'
        },
        {
          id: 'phone',
          type: 'phone',
          label: 'Phone Number',
          required: true,
          order: 8,
          width: '50'
        },
        {
          id: 'special_requests',
          type: 'textarea',
          label: 'Special Requests',
          required: false,
          order: 9,
          width: '100'
        }
      ],
      settings: {
        submitUrl: '/api/v1/bookings',
        method: 'POST',
        successMessage: 'Thank you! Your booking has been confirmed.',
        errorMessage: 'There was an error processing your booking. Please try again.',
        submitButtonText: 'Book Now',
        emailNotifications: {
          enabled: true,
          recipientEmails: ['bookings@grandpalacehotel.com'],
          subject: 'New Booking Request'
        }
      },
      status: 'published',
      isPublished: true,
      createdBy: ownerUser._id
    });

    await bookingFormTemplate.save();
    console.log('✅ Booking form template created');

    // 11. Create API Key
    console.log('Creating API Key...');
    const apiKeyValue = `pk_live_${crypto.randomBytes(32).toString('hex')}`;
    const apiKeyHash = await bcrypt.hash(apiKeyValue, 12);
    
    const apiKey = new APIKey({
      name: 'Main API Key',
      description: 'Primary API key for hotel management system',
      keyId: crypto.randomUUID(),
      keyHash: apiKeyHash,
      keyPrefix: 'pk_live_',
      hotelId: hotel._id,
      createdBy: ownerUser._id,
      type: 'admin',
      permissions: [
        { resource: 'reservations', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'rooms', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'guests', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'rates', actions: ['create', 'read', 'update', 'delete'] }
      ],
      environment: 'production',
      rateLimit: {
        requestsPerMinute: 100,
        requestsPerHour: 1000,
        requestsPerDay: 10000
      },
      isActive: true
    });

    await apiKey.save();
    console.log('✅ API Key created:', apiKeyValue);

    // 12. Create Webhook Endpoint
    console.log('Creating Webhook Endpoint...');
    const webhookSecret = crypto.randomBytes(32).toString('hex');
    
    const webhookEndpoint = new WebhookEndpoint({
      name: 'Booking Webhook',
      description: 'Webhook for booking events',
      url: 'https://api.grandpalacehotel.com/webhooks/bookings',
      hotelId: hotel._id,
      createdBy: ownerUser._id,
      events: [
        'booking.created',
        'booking.updated',
        'booking.cancelled',
        'booking.confirmed',
        'booking.checked_in',
        'booking.checked_out'
      ],
      secret: webhookSecret,
      isActive: true,
      retryPolicy: {
        maxRetries: 3,
        retryDelay: 1000,
        backoffMultiplier: 2
      }
    });

    await webhookEndpoint.save();
    console.log('✅ Webhook endpoint created');

    // 13. Create some Audit Logs
    console.log('Creating Audit Logs...');
    const auditLogs = [];
    
    for (let i = 0; i < 20; i++) {
      const auditLog = new AuditLog({
        hotelId: hotel._id,
        tableName: ['Booking', 'Room', 'RoomType', 'User'][Math.floor(Math.random() * 4)],
        recordId: bookings[Math.floor(Math.random() * bookings.length)]._id,
        changeType: ['create', 'update', 'delete'][Math.floor(Math.random() * 3)],
        oldValues: { status: 'pending' },
        newValues: { status: 'confirmed' },
        userId: ownerUser._id,
        userEmail: ownerUser.email,
        userRole: ownerUser.role,
        source: ['manual', 'api', 'system'][Math.floor(Math.random() * 3)],
        sourceDetails: {
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      auditLogs.push(auditLog);
    }

    await AuditLog.insertMany(auditLogs);
    console.log('✅ Created', auditLogs.length, 'audit logs');

    // 14. Create API Metrics
    console.log('Creating API Metrics...');
    const apiMetrics = [];
    const now = new Date();
    
    for (let i = 0; i < 24; i++) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000); // Last 24 hours
      
      const metric = new APIMetrics({
        hotelId: hotel._id,
        period: 'hour',
        timestamp: timestamp,
        endpoint: {
          method: 'GET',
          path: '/api/v1/bookings',
          category: 'reservations'
        },
        requests: {
          total: Math.floor(Math.random() * 100) + 10,
          successful: Math.floor(Math.random() * 90) + 10,
          failed: Math.floor(Math.random() * 5),
          byStatusCode: new Map([
            ['200', Math.floor(Math.random() * 80) + 10],
            ['400', Math.floor(Math.random() * 3)],
            ['500', Math.floor(Math.random() * 2)]
          ])
        },
        performance: {
          averageResponseTime: Math.floor(Math.random() * 200) + 50,
          minResponseTime: Math.floor(Math.random() * 50) + 10,
          maxResponseTime: Math.floor(Math.random() * 500) + 200,
          p50ResponseTime: Math.floor(Math.random() * 150) + 40,
          p95ResponseTime: Math.floor(Math.random() * 300) + 100,
          p99ResponseTime: Math.floor(Math.random() * 500) + 200
        },
        errors: {
          total: Math.floor(Math.random() * 5),
          byType: new Map([
            ['validation', Math.floor(Math.random() * 2)],
            ['auth', Math.floor(Math.random() * 1)],
            ['server', Math.floor(Math.random() * 2)]
          ])
        }
      });
      
      apiMetrics.push(metric);
    }

    await APIMetrics.insertMany(apiMetrics);
    console.log('✅ Created', apiMetrics.length, 'API metrics');

    console.log('\n🎉 Seed data creation completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`- Hotel: ${hotel.name} (${hotel._id})`);
    console.log(`- Users: ${1 + createdStaff.length + createdGuests.length} (1 owner, ${createdStaff.length} staff, ${createdGuests.length} guests)`);
    console.log(`- Room Types: ${createdRoomTypes.length}`);
    console.log(`- Rooms: ${rooms.length}`);
    console.log(`- Availability Records: ${availabilityRecords.length}`);
    console.log(`- Bookings: ${bookings.length}`);
    console.log(`- Web Settings: 1`);
    console.log(`- Booking Form Templates: 1`);
    console.log(`- API Keys: 1`);
    console.log(`- Webhook Endpoints: 1`);
    console.log(`- Audit Logs: ${auditLogs.length}`);
    console.log(`- API Metrics: ${apiMetrics.length}`);
    
    console.log('\n🔑 Important Information:');
    console.log(`- Hotel ID: ${hotel._id}`);
    console.log(`- Owner Email: ${ownerUser.email} (Password: admin123)`);
    console.log(`- Manager Email: ${createdStaff[0].email} (Password: manager123)`);
    console.log(`- API Key: ${apiKeyValue}`);
    console.log(`- Webhook Secret: ${webhookSecret}`);

  } catch (error) {
    console.error('❌ Error creating seed data:', error);
    throw error;
  }
}

// Main function
async function main() {
  try {
    await connectDB();
    await clearExistingData();
    await createSeedData();
    
    console.log('\n✅ Database seeding completed successfully!');
    console.log('You can now start your application and use the seeded data.');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the seeding process
main();
