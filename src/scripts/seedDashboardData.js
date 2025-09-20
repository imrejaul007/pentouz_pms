import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Hotel from '../models/Hotel.js';
import Room from '../models/Room.js';
import RoomType from '../models/RoomType.js';
import Booking from '../models/Booking.js';
import logger from '../utils/logger.js';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    logger.info('Database connected for dashboard seeding');
  } catch (error) {
    logger.error('Database connection failed:', error);
    process.exit(1);
  }
};

const seedDashboardData = async () => {
  try {
    console.log('🌱 Starting dashboard data seeding...');
    logger.info('🌱 Starting dashboard data seeding...');

    // Get or create hotel
    let hotel = await Hotel.findOne({ name: 'THE PENTOUZ' });
    if (!hotel) {
      hotel = await Hotel.create({
        name: 'THE PENTOUZ',
        description: 'A luxury hotel in the heart of the city',
        address: {
          street: '123 Main Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          country: 'India',
          zipCode: '400001',
          coordinates: { latitude: 19.0760, longitude: 72.8777 }
        },
        contact: {
          phone: '+91-22-12345678',
          email: 'info@thepentouz.com',
          website: 'https://thepentouz.com'
        },
        amenities: ['WiFi', 'Pool', 'Spa', 'Restaurant', 'Gym', 'Parking'],
        images: ['https://example.com/hotel1.jpg', 'https://example.com/hotel2.jpg'],
        rating: 4.5,
        isActive: true
      });
      console.log('✅ Created hotel: THE PENTOUZ');
      logger.info('✅ Created hotel: THE PENTOUZ');
    }

    // Get or create admin user
    let adminUser = await User.findOne({ email: 'admin@hotel.com' });
    if (!adminUser) {
      const hashedPassword = await bcrypt.hash('admin123', 12);
      adminUser = await User.create({
        name: 'Hotel Admin',
        email: 'admin@hotel.com',
        password: hashedPassword,
        role: 'admin',
        hotelId: hotel._id,
        isActive: true
      });
      console.log('✅ Created admin user');
      logger.info('✅ Created admin user');
    }

    // Create room types
    const roomTypes = [
      {
        code: 'STD',
        name: 'Standard Room',
        description: 'Comfortable standard room with city view',
        shortDescription: 'Standard room with city view',
        baseRate: 2500,
        totalRooms: 8,
        specifications: {
          maxOccupancy: 2,
          bedType: 'double',
          bedCount: 1,
          roomSize: 25,
          view: 'city',
          smokingPolicy: 'non_smoking'
        },
        amenities: [
          { code: 'WIFI', name: 'WiFi', category: 'technology' },
          { code: 'TV', name: 'TV', category: 'entertainment' },
          { code: 'AC', name: 'Air Conditioning', category: 'comfort' },
          { code: 'MINIBAR', name: 'Mini Bar', category: 'comfort' }
        ],
        hotelId: hotel._id,
        isActive: true,
        isPublished: true
      },
      {
        code: 'DLX',
        name: 'Deluxe Room',
        description: 'Spacious deluxe room with premium amenities',
        shortDescription: 'Deluxe room with premium amenities',
        baseRate: 3500,
        totalRooms: 8,
        specifications: {
          maxOccupancy: 3,
          bedType: 'queen',
          bedCount: 1,
          roomSize: 35,
          view: 'city',
          smokingPolicy: 'non_smoking'
        },
        amenities: [
          { code: 'WIFI', name: 'WiFi', category: 'technology' },
          { code: 'TV', name: 'TV', category: 'entertainment' },
          { code: 'AC', name: 'Air Conditioning', category: 'comfort' },
          { code: 'MINIBAR', name: 'Mini Bar', category: 'comfort' },
          { code: 'BALCONY', name: 'Balcony', category: 'comfort', isHighlight: true }
        ],
        hotelId: hotel._id,
        isActive: true,
        isPublished: true
      },
      {
        code: 'SUITE',
        name: 'Executive Suite',
        description: 'Luxurious executive suite with separate living area',
        shortDescription: 'Executive suite with living area',
        baseRate: 5500,
        totalRooms: 4,
        specifications: {
          maxOccupancy: 4,
          bedType: 'king',
          bedCount: 1,
          roomSize: 60,
          view: 'city',
          smokingPolicy: 'non_smoking'
        },
        amenities: [
          { code: 'WIFI', name: 'WiFi', category: 'technology' },
          { code: 'TV', name: 'TV', category: 'entertainment' },
          { code: 'AC', name: 'Air Conditioning', category: 'comfort' },
          { code: 'MINIBAR', name: 'Mini Bar', category: 'comfort' },
          { code: 'BALCONY', name: 'Balcony', category: 'comfort' },
          { code: 'KITCHENETTE', name: 'Kitchenette', category: 'comfort', isHighlight: true }
        ],
        hotelId: hotel._id,
        isActive: true,
        isPublished: true
      },
      {
        code: 'PRES',
        name: 'Presidential Suite',
        description: 'Ultimate luxury presidential suite',
        shortDescription: 'Presidential suite',
        baseRate: 8500,
        totalRooms: 2,
        specifications: {
          maxOccupancy: 6,
          bedType: 'king',
          bedCount: 1,
          roomSize: 100,
          view: 'city',
          smokingPolicy: 'non_smoking'
        },
        amenities: [
          { code: 'WIFI', name: 'WiFi', category: 'technology' },
          { code: 'TV', name: 'TV', category: 'entertainment' },
          { code: 'AC', name: 'Air Conditioning', category: 'comfort' },
          { code: 'MINIBAR', name: 'Mini Bar', category: 'comfort' },
          { code: 'BALCONY', name: 'Balcony', category: 'comfort' },
          { code: 'KITCHEN', name: 'Kitchen', category: 'comfort', isHighlight: true },
          { code: 'JACUZZI', name: 'Jacuzzi', category: 'comfort', isHighlight: true }
        ],
        hotelId: hotel._id,
        isActive: true,
        isPublished: true
      }
    ];

    // Clear existing room types and create new ones
    await RoomType.deleteMany({ hotelId: hotel._id });
    const createdRoomTypes = await RoomType.create(roomTypes);
    console.log(`✅ Created ${createdRoomTypes.length} room types`);
    logger.info(`✅ Created ${createdRoomTypes.length} room types`);

    // Create rooms
    const rooms = [];
    const roomNumbers = ['101', '102', '103', '104', '105', '106', '107', '108', '201', '202', '203', '204', '205', '206', '207', '208', '301', '302', '303', '304', '305', '306', '307', '308'];
    
    for (let i = 0; i < roomNumbers.length; i++) {
      const roomType = createdRoomTypes[i % createdRoomTypes.length];
      rooms.push({
        hotelId: hotel._id,
        roomNumber: roomNumbers[i],
        type: roomType.code,
        baseRate: roomType.baseRate,
        currentRate: roomType.baseRate + Math.floor(Math.random() * 500),
        status: 'vacant',
        floor: Math.floor(i / 8) + 1,
        capacity: roomType.specifications.maxOccupancy,
        amenities: roomType.amenities.map(amenity => amenity.name),
        isActive: true
      });
    }

    // Clear existing rooms and create new ones
    await Room.deleteMany({ hotelId: hotel._id });
    const createdRooms = await Room.create(rooms);
    console.log(`✅ Created ${createdRooms.length} rooms`);
    logger.info(`✅ Created ${createdRooms.length} rooms`);

    // Create guest users
    const guestUsers = [];
    const guestNames = [
      'Rajesh Kumar', 'Priya Sharma', 'Amit Patel', 'Sneha Singh', 'Vikram Gupta',
      'Anita Reddy', 'Suresh Nair', 'Kavita Joshi', 'Ravi Mehta', 'Sunita Agarwal',
      'Deepak Verma', 'Meera Iyer', 'Arjun Khanna', 'Pooja Malhotra', 'Rohit Saxena',
      'Shilpa Rao', 'Kiran Desai', 'Manoj Tiwari', 'Rekha Pandey', 'Sandeep Jain'
    ];

    for (let i = 0; i < guestNames.length; i++) {
      const hashedPassword = await bcrypt.hash('guest123', 12);
      guestUsers.push({
        name: guestNames[i],
        email: `guest${i + 1}@example.com`,
        password: hashedPassword,
        role: 'guest',
        isActive: true
      });
    }

    // Clear existing guest users and create new ones
    await User.deleteMany({ role: 'guest' });
    const createdGuests = await User.create(guestUsers);
    console.log(`✅ Created ${createdGuests.length} guest users`);
    logger.info(`✅ Created ${createdGuests.length} guest users`);

    // Create comprehensive booking data for the last 90 days
    const bookings = [];
    const today = new Date();
    const sources = ['direct', 'booking.com', 'expedia', 'airbnb', 'agoda', 'hotels.com'];
    const statuses = ['confirmed', 'checked_in', 'checked_out', 'cancelled', 'pending'];
    const statusWeights = [0.4, 0.1, 0.3, 0.1, 0.1]; // Weighted distribution

    // Generate bookings for the last 90 days
    for (let dayOffset = 0; dayOffset < 90; dayOffset++) {
      const currentDate = new Date(today.getTime() - dayOffset * 24 * 60 * 60 * 1000);
      
      // Generate 2-8 bookings per day
      const bookingsPerDay = Math.floor(Math.random() * 7) + 2;
      
      for (let i = 0; i < bookingsPerDay; i++) {
        const guest = createdGuests[Math.floor(Math.random() * createdGuests.length)];
        const room = createdRooms[Math.floor(Math.random() * createdRooms.length)];
        
        // Generate check-in date (past or future)
        let checkIn;
        if (dayOffset < 30) {
          // Past bookings
          checkIn = new Date(currentDate.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);
        } else {
          // Future bookings
          checkIn = new Date(currentDate.getTime() + Math.random() * 30 * 24 * 60 * 60 * 1000);
        }
        
        const nights = Math.floor(Math.random() * 5) + 1; // 1-5 nights
        const checkOut = new Date(checkIn.getTime() + nights * 24 * 60 * 60 * 1000);
        
        // Weighted random status selection
        const random = Math.random();
        let status = 'confirmed';
        let cumulativeWeight = 0;
        for (let j = 0; j < statuses.length; j++) {
          cumulativeWeight += statusWeights[j];
          if (random <= cumulativeWeight) {
            status = statuses[j];
            break;
          }
        }
        
        const source = sources[Math.floor(Math.random() * sources.length)];
        const baseAmount = room.currentRate * nights;
        const totalAmount = baseAmount + Math.floor(Math.random() * 1000); // Add some variation
        
        bookings.push({
          hotelId: hotel._id,
          userId: guest._id,
          rooms: [{
            roomId: room._id,
            rate: room.currentRate
          }],
          checkIn,
          checkOut,
          nights,
          status,
          paymentStatus: status === 'cancelled' ? 'refunded' : 'paid',
          totalAmount,
          currency: 'INR',
          source,
          guestDetails: {
            adults: Math.floor(Math.random() * 3) + 1,
            children: Math.floor(Math.random() * 2),
            specialRequests: Math.random() > 0.8 ? 'Late check-in requested' : null
          },
          bookingNumber: `BK${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
          idempotencyKey: `seed-${Date.now()}-${Math.random()}`,
          reservedUntil: status === 'pending' ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null
        });
      }
    }

    // Clear existing bookings and create new ones
    await Booking.deleteMany({ hotelId: hotel._id });
    const createdBookings = await Booking.create(bookings);
    console.log(`✅ Created ${createdBookings.length} bookings`);
    logger.info(`✅ Created ${createdBookings.length} bookings`);

    // Create some recent bookings for real-time data
    const recentBookings = [];
    for (let i = 0; i < 10; i++) {
      const guest = createdGuests[Math.floor(Math.random() * createdGuests.length)];
      const room = createdRooms[Math.floor(Math.random() * createdRooms.length)];
      
      const checkIn = new Date(today.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);
      const nights = Math.floor(Math.random() * 3) + 1;
      const checkOut = new Date(checkIn.getTime() + nights * 24 * 60 * 60 * 1000);
      
      recentBookings.push({
        hotelId: hotel._id,
        userId: guest._id,
        rooms: [{
          roomId: room._id,
          rate: room.currentRate
        }],
        checkIn,
        checkOut,
        nights,
        status: ['confirmed', 'checked_in'][Math.floor(Math.random() * 2)],
        paymentStatus: 'paid',
        totalAmount: room.currentRate * nights,
        currency: 'INR',
        source: sources[Math.floor(Math.random() * sources.length)],
        guestDetails: {
          adults: Math.floor(Math.random() * 2) + 1,
          children: 0
        },
        bookingNumber: `BK${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        idempotencyKey: `recent-${Date.now()}-${Math.random()}`
      });
    }

    await Booking.create(recentBookings);
    console.log(`✅ Created ${recentBookings.length} recent bookings`);
    logger.info(`✅ Created ${recentBookings.length} recent bookings`);

    // Summary
    console.log('🎉 Dashboard data seeding completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Hotel: ${hotel.name}`);
    console.log(`   - Room Types: ${createdRoomTypes.length}`);
    console.log(`   - Rooms: ${createdRooms.length}`);
    console.log(`   - Guest Users: ${createdGuests.length}`);
    console.log(`   - Total Bookings: ${createdBookings.length + recentBookings.length}`);
    console.log(`   - Recent Bookings: ${recentBookings.length}`);
    
    logger.info('🎉 Dashboard data seeding completed successfully!');
    logger.info(`📊 Summary:`);
    logger.info(`   - Hotel: ${hotel.name}`);
    logger.info(`   - Room Types: ${createdRoomTypes.length}`);
    logger.info(`   - Rooms: ${createdRooms.length}`);
    logger.info(`   - Guest Users: ${createdGuests.length}`);
    logger.info(`   - Total Bookings: ${createdBookings.length + recentBookings.length}`);
    logger.info(`   - Recent Bookings: ${recentBookings.length}`);

  } catch (error) {
    console.error('❌ Dashboard data seeding failed:', error);
    logger.error('❌ Dashboard data seeding failed:', error);
    throw error;
  }
};

const main = async () => {
  try {
    await connectDB();
    await seedDashboardData();
    process.exit(0);
  } catch (error) {
    logger.error('Seeding process failed:', error);
    process.exit(1);
  }
};

// Run if called directly
console.log('Script loaded, checking execution...');
console.log('import.meta.url:', import.meta.url);
console.log('process.argv[1]:', process.argv[1]);

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].includes('seedDashboardData.js')) {
  console.log('Running main function...');
  main();
} else {
  console.log('Not running main function, script imported as module');
}

export default seedDashboardData;
