import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Import models
import User from './src/models/User.js';
import Hotel from './src/models/Hotel.js';
import Room from './src/models/Room.js';
import RoomType from './src/models/RoomType.js';
import Booking from './src/models/Booking.js';
import PropertyGroup from './src/models/PropertyGroup.js';

dotenv.config();

// Use the provided MongoDB connection string
const MONGO_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Database connected successfully for multi-property seeding');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
};

const seedMultiPropertyData = async () => {
  try {
    console.log('🌱 Starting comprehensive multi-property data seeding...');
    console.log('📊 This will create multiple hotels, property groups, users, and booking data...');

    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await PropertyGroup.deleteMany({});
    await Booking.deleteMany({});
    await Room.deleteMany({});
    await RoomType.deleteMany({});
    await Hotel.deleteMany({});
    await User.deleteMany({ role: { $ne: 'super_admin' } }); // Keep super admin if exists

    // Create Property Groups
    const propertyGroups = [
      {
        name: 'Luxury Resort Chain',
        groupType: 'chain',
        description: 'Premium luxury resorts across major tourist destinations',
        settings: {
          centralizedRates: true,
          rateManagement: {
            autoSync: true,
            conflictResolution: 'manual',
            approvalRequired: false
          },
          branding: {
            enforceStandards: true,
            allowOverrides: false
          },
          inheritance: {
            policies: true,
            amenities: true,
            pricing: true
          }
        },
        isActive: true
      },
      {
        name: 'Business Hotels Group',
        groupType: 'chain',
        description: 'Business-focused hotels in major metropolitan areas',
        settings: {
          centralizedRates: true,
          rateManagement: {
            autoSync: true,
            conflictResolution: 'auto',
            approvalRequired: true
          },
          branding: {
            enforceStandards: true,
            allowOverrides: true
          },
          inheritance: {
            policies: true,
            amenities: false,
            pricing: true
          }
        },
        isActive: true
      },
      {
        name: 'Boutique Collection',
        groupType: 'management_company',
        description: 'Unique boutique hotels with individual character',
        settings: {
          centralizedRates: false,
          rateManagement: {
            autoSync: false,
            conflictResolution: 'manual',
            approvalRequired: false
          },
          branding: {
            enforceStandards: false,
            allowOverrides: true
          },
          inheritance: {
            policies: false,
            amenities: false,
            pricing: false
          }
        },
        isActive: true
      }
    ];

    const createdGroups = await PropertyGroup.create(propertyGroups);
    console.log(`✅ Created ${createdGroups.length} property groups`);

    // Create Hotels with variety
    const hotelsData = [
      // Luxury Resort Chain Hotels
      {
        name: 'Royal Palace Resort Mumbai',
        description: 'Luxury 5-star resort in the heart of Mumbai with world-class amenities',
        type: 'resort',
        address: {
          street: 'Marine Drive',
          city: 'Mumbai',
          state: 'Maharashtra',
          country: 'India',
          zipCode: '400001',
          coordinates: { latitude: 19.0760, longitude: 72.8777 }
        },
        contact: {
          phone: '+91-22-12345678',
          email: 'info@royalpalacemumbai.com',
          website: 'https://royalpalacemumbai.com'
        },
        amenities: ['WiFi', 'Pool', 'Spa', 'Restaurant', 'Gym', 'Parking', 'Beach Access', 'Conference Rooms'],
        rating: 4.8,
        propertyGroupId: createdGroups[0]._id,
        features: {
          pms: true,
          pos: true,
          spa: true,
          restaurant: true,
          parking: true,
          wifi: true,
          fitness: true,
          pool: true
        }
      },
      {
        name: 'Grand Palace Resort Delhi',
        description: 'Elegant luxury resort in New Delhi with heritage charm',
        type: 'resort',
        address: {
          street: 'Connaught Place',
          city: 'New Delhi',
          state: 'Delhi',
          country: 'India',
          zipCode: '110001',
          coordinates: { latitude: 28.6139, longitude: 77.2090 }
        },
        contact: {
          phone: '+91-11-12345678',
          email: 'info@grandpalacedelhi.com',
          website: 'https://grandpalacedelhi.com'
        },
        amenities: ['WiFi', 'Pool', 'Spa', 'Restaurant', 'Gym', 'Parking', 'Heritage Tours', 'Business Center'],
        rating: 4.7,
        propertyGroupId: createdGroups[0]._id,
        features: {
          pms: true,
          pos: true,
          spa: true,
          restaurant: true,
          parking: true,
          wifi: true,
          fitness: true,
          pool: true
        }
      },
      {
        name: 'Paradise Resort Goa',
        description: 'Beachfront luxury resort in Goa with stunning ocean views',
        type: 'resort',
        address: {
          street: 'Calangute Beach',
          city: 'Goa',
          state: 'Goa',
          country: 'India',
          zipCode: '403516',
          coordinates: { latitude: 15.5400, longitude: 73.7500 }
        },
        contact: {
          phone: '+91-832-1234567',
          email: 'info@paradiseresortgoa.com',
          website: 'https://paradiseresortgoa.com'
        },
        amenities: ['WiFi', 'Beach Access', 'Pool', 'Spa', 'Restaurant', 'Water Sports', 'Parking', 'Bar'],
        rating: 4.6,
        propertyGroupId: createdGroups[0]._id,
        features: {
          pms: true,
          pos: true,
          spa: true,
          restaurant: true,
          parking: true,
          wifi: true,
          fitness: false,
          pool: true
        }
      },

      // Business Hotels Group
      {
        name: 'Executive Inn Bangalore',
        description: 'Modern business hotel in Bangalore tech hub',
        type: 'hotel',
        address: {
          street: 'Electronic City',
          city: 'Bangalore',
          state: 'Karnataka',
          country: 'India',
          zipCode: '560100',
          coordinates: { latitude: 12.9716, longitude: 77.5946 }
        },
        contact: {
          phone: '+91-80-12345678',
          email: 'info@executiveinnblr.com',
          website: 'https://executiveinnblr.com'
        },
        amenities: ['WiFi', 'Business Center', 'Conference Rooms', 'Gym', 'Restaurant', 'Parking'],
        rating: 4.3,
        propertyGroupId: createdGroups[1]._id,
        features: {
          pms: true,
          pos: true,
          spa: false,
          restaurant: true,
          parking: true,
          wifi: true,
          fitness: true,
          pool: false
        }
      },
      {
        name: 'Metro Business Hotel Chennai',
        description: 'Contemporary business hotel in Chennai business district',
        type: 'hotel',
        address: {
          street: 'T. Nagar',
          city: 'Chennai',
          state: 'Tamil Nadu',
          country: 'India',
          zipCode: '600017',
          coordinates: { latitude: 13.0827, longitude: 80.2707 }
        },
        contact: {
          phone: '+91-44-12345678',
          email: 'info@metrobusinesschennai.com',
          website: 'https://metrobusinesschennai.com'
        },
        amenities: ['WiFi', 'Business Center', 'Meeting Rooms', 'Gym', 'Restaurant', 'Parking', 'Airport Shuttle'],
        rating: 4.2,
        propertyGroupId: createdGroups[1]._id,
        features: {
          pms: true,
          pos: true,
          spa: false,
          restaurant: true,
          parking: true,
          wifi: true,
          fitness: true,
          pool: false
        }
      },

      // Boutique Collection
      {
        name: 'Heritage Haveli Jaipur',
        description: 'Authentic heritage boutique hotel in the Pink City',
        type: 'boutique',
        address: {
          street: 'Old City',
          city: 'Jaipur',
          state: 'Rajasthan',
          country: 'India',
          zipCode: '302001',
          coordinates: { latitude: 26.9124, longitude: 75.7873 }
        },
        contact: {
          phone: '+91-141-1234567',
          email: 'info@heritagehaveli.com',
          website: 'https://heritagehaveli.com'
        },
        amenities: ['WiFi', 'Traditional Decor', 'Courtyard', 'Restaurant', 'Cultural Shows', 'Parking'],
        rating: 4.5,
        propertyGroupId: createdGroups[2]._id,
        features: {
          pms: true,
          pos: false,
          spa: true,
          restaurant: true,
          parking: true,
          wifi: true,
          fitness: false,
          pool: false
        }
      },
      {
        name: 'Artistic Retreat Udaipur',
        description: 'Creative boutique hotel with artistic ambiance in the City of Lakes',
        type: 'boutique',
        address: {
          street: 'Lake Pichola',
          city: 'Udaipur',
          state: 'Rajasthan',
          country: 'India',
          zipCode: '313001',
          coordinates: { latitude: 24.5854, longitude: 73.6829 }
        },
        contact: {
          phone: '+91-294-1234567',
          email: 'info@artisticretreat.com',
          website: 'https://artisticretreat.com'
        },
        amenities: ['WiFi', 'Art Gallery', 'Lake View', 'Restaurant', 'Boat Rides', 'Parking'],
        rating: 4.4,
        propertyGroupId: createdGroups[2]._id,
        features: {
          pms: true,
          pos: false,
          spa: false,
          restaurant: true,
          parking: true,
          wifi: true,
          fitness: false,
          pool: false
        }
      }
    ];

    const createdHotels = [];
    for (const hotelData of hotelsData) {
      const hotel = await Hotel.create(hotelData);
      createdHotels.push(hotel);
    }
    console.log(`✅ Created ${createdHotels.length} hotels`);

    // Update property groups with hotel references
    for (const group of createdGroups) {
      const groupHotels = createdHotels.filter(hotel => 
        hotel.propertyGroupId && hotel.propertyGroupId.toString() === group._id.toString()
      );
      group.properties = groupHotels.map(hotel => hotel._id);
      await group.save();
    }
    console.log('✅ Updated property groups with hotel references');

    // Create admin users for each hotel
    const adminUsers = [];
    for (let i = 0; i < createdHotels.length; i++) {
      const hotel = createdHotels[i];
      const hashedPassword = await bcrypt.hash('admin123', 12);
      const adminUser = {
        name: `${hotel.name} Admin`,
        email: `admin${i + 1}@${hotel.name.toLowerCase().replace(/\s+/g, '')}.com`,
        password: hashedPassword,
        role: 'admin',
        hotelId: hotel._id,
        isActive: true
      };
      adminUsers.push(adminUser);
    }

    const createdAdmins = await User.create(adminUsers);
    console.log(`✅ Created ${createdAdmins.length} admin users`);

    // Create diverse room types for each hotel
    const allRoomTypes = [];
    const roomTypeTemplates = {
      resort: [
        { code: 'STD', name: 'Standard Room', baseRate: 3500, totalRooms: 10, maxOccupancy: 2 },
        { code: 'DLX', name: 'Deluxe Room', baseRate: 5000, totalRooms: 8, maxOccupancy: 3 },
        { code: 'SUITE', name: 'Executive Suite', baseRate: 8000, totalRooms: 6, maxOccupancy: 4 },
        { code: 'VILLA', name: 'Royal Villa', baseRate: 12000, totalRooms: 4, maxOccupancy: 6 }
      ],
      hotel: [
        { code: 'STD', name: 'Standard Room', baseRate: 2500, totalRooms: 12, maxOccupancy: 2 },
        { code: 'BIZ', name: 'Business Room', baseRate: 3500, totalRooms: 8, maxOccupancy: 2 },
        { code: 'EXEC', name: 'Executive Suite', baseRate: 5500, totalRooms: 4, maxOccupancy: 3 }
      ],
      boutique: [
        { code: 'DELUXE', name: 'Heritage Deluxe', baseRate: 4000, totalRooms: 6, maxOccupancy: 3 },
        { code: 'ROYAL', name: 'Royal Suite', baseRate: 7000, totalRooms: 4, maxOccupancy: 4 },
        { code: 'PREMIUM', name: 'Premium Villa', baseRate: 10000, totalRooms: 2, maxOccupancy: 5 }
      ]
    };

    for (const hotel of createdHotels) {
      const templates = roomTypeTemplates[hotel.type] || roomTypeTemplates.hotel;
      
      for (const template of templates) {
        const roomType = {
          ...template,
          hotelId: hotel._id,
          description: `${template.name} with premium amenities and comfort`,
          shortDescription: template.name,
          specifications: {
            maxOccupancy: template.maxOccupancy,
            bedType: template.maxOccupancy <= 2 ? 'queen' : 'king',
            bedCount: 1,
            roomSize: template.baseRate / 100, // Approximate size
            view: 'city',
            smokingPolicy: 'non_smoking'
          },
          amenities: [
            { code: 'WIFI', name: 'WiFi', category: 'technology' },
            { code: 'TV', name: 'TV', category: 'entertainment' },
            { code: 'AC', name: 'Air Conditioning', category: 'comfort' }
          ],
          isActive: true,
          isPublished: true
        };
        allRoomTypes.push(roomType);
      }
    }

    const createdRoomTypes = await RoomType.create(allRoomTypes);
    console.log(`✅ Created ${createdRoomTypes.length} room types`);

    // Create rooms for each hotel
    const allRooms = [];
    for (const hotel of createdHotels) {
      const hotelRoomTypes = createdRoomTypes.filter(rt => rt.hotelId.toString() === hotel._id.toString());
      let roomCounter = 1;

      for (const roomType of hotelRoomTypes) {
        for (let i = 0; i < roomType.totalRooms; i++) {
          const floor = Math.ceil(roomCounter / 10);
          const roomNumber = `${floor}${String(roomCounter % 10 || 10).padStart(2, '0')}`;
          
          allRooms.push({
            hotelId: hotel._id,
            roomNumber,
            type: roomType.code,
            baseRate: roomType.baseRate,
            currentRate: roomType.baseRate + Math.floor(Math.random() * 500),
            status: ['vacant', 'occupied', 'maintenance'][Math.floor(Math.random() * 3)],
            floor,
            capacity: roomType.specifications.maxOccupancy,
            amenities: ['WiFi', 'TV', 'AC', 'Mini Bar'],
            isActive: true
          });
          roomCounter++;
        }
      }
    }

    const createdRooms = await Room.create(allRooms);
    console.log(`✅ Created ${createdRooms.length} rooms`);

    // Create guest users
    const guestNames = [
      'Rajesh Kumar', 'Priya Sharma', 'Amit Patel', 'Sneha Singh', 'Vikram Gupta',
      'Anita Reddy', 'Suresh Nair', 'Kavita Joshi', 'Ravi Mehta', 'Sunita Agarwal',
      'Deepak Verma', 'Meera Iyer', 'Arjun Khanna', 'Pooja Malhotra', 'Rohit Saxena',
      'Shilpa Rao', 'Kiran Desai', 'Manoj Tiwari', 'Rekha Pandey', 'Sandeep Jain',
      'Neha Gupta', 'Vivek Sharma', 'Anjali Patel', 'Sanjay Singh', 'Divya Reddy',
      'Rahul Nair', 'Nisha Joshi', 'Abhishek Mehta', 'Swati Agarwal', 'Karan Verma'
    ];

    const guestUsers = [];
    for (let i = 0; i < guestNames.length; i++) {
      const hashedPassword = await bcrypt.hash('guest123', 12);
      guestUsers.push({
        name: guestNames[i],
        email: `guest${i + 1}@example.com`,
        password: hashedPassword,
        role: 'guest',
        guestType: Math.random() > 0.8 ? 'corporate' : 'normal',
        isActive: true,
        loyalty: {
          points: Math.floor(Math.random() * 5000),
          tier: ['bronze', 'silver', 'gold', 'platinum'][Math.floor(Math.random() * 4)]
        }
      });
    }

    const createdGuests = await User.create(guestUsers);
    console.log(`✅ Created ${createdGuests.length} guest users`);

    // Create comprehensive booking data for analytics
    const allBookings = [];
    const today = new Date();
    const sources = ['direct', 'booking.com', 'expedia', 'airbnb', 'agoda', 'hotels.com', 'makemytrip'];
    const statuses = ['confirmed', 'checked_in', 'checked_out', 'cancelled', 'pending'];
    const statusWeights = [0.35, 0.15, 0.35, 0.08, 0.07];

    // Generate bookings for the last 120 days for better analytics
    for (const hotel of createdHotels) {
      const hotelRooms = createdRooms.filter(room => room.hotelId.toString() === hotel._id.toString());
      
      for (let dayOffset = 0; dayOffset < 120; dayOffset++) {
        const currentDate = new Date(today.getTime() - dayOffset * 24 * 60 * 60 * 1000);
        
        // Generate 3-12 bookings per day per hotel
        const bookingsPerDay = Math.floor(Math.random() * 10) + 3;
        
        for (let i = 0; i < bookingsPerDay; i++) {
          const guest = createdGuests[Math.floor(Math.random() * createdGuests.length)];
          const room = hotelRooms[Math.floor(Math.random() * hotelRooms.length)];
          
          // Generate realistic check-in dates
          const checkIn = new Date(currentDate.getTime() + (Math.random() - 0.5) * 14 * 24 * 60 * 60 * 1000);
          const nights = Math.floor(Math.random() * 7) + 1; // 1-7 nights
          const checkOut = new Date(checkIn.getTime() + nights * 24 * 60 * 60 * 1000);
          
          // Weighted status selection
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
          const taxes = Math.floor(baseAmount * 0.12); // 12% tax
          const totalAmount = baseAmount + taxes + Math.floor(Math.random() * 1000);
          
          allBookings.push({
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
            paymentStatus: status === 'cancelled' ? 'refunded' : 
                          status === 'pending' ? 'pending' : 'paid',
            totalAmount,
            currency: 'INR',
            source,
            guestDetails: {
              adults: Math.floor(Math.random() * 3) + 1,
              children: Math.floor(Math.random() * 3),
              specialRequests: Math.random() > 0.7 ? 
                ['Late check-in', 'Extra pillows', 'Room service', 'Airport pickup'][Math.floor(Math.random() * 4)] : null
            },
            bookingNumber: `BK${hotel.name.substring(0, 2).toUpperCase()}${Date.now().toString().slice(-6)}${Math.random().toString(36).substr(2, 3).toUpperCase()}`,
            idempotencyKey: `multi-seed-${hotel._id}-${Date.now()}-${Math.random()}`,
            reservedUntil: status === 'pending' ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null
          });
        }
      }
    }

    // Batch create bookings
    const createdBookings = await Booking.create(allBookings);
    console.log(`✅ Created ${createdBookings.length} bookings across all hotels`);

    // Update property groups with calculated metrics
    for (const group of createdGroups) {
      const groupHotels = createdHotels.filter(hotel => 
        hotel.propertyGroupId && hotel.propertyGroupId.toString() === group._id.toString()
      );
      
      const groupHotelIds = groupHotels.map(h => h._id);
      const groupBookings = createdBookings.filter(booking => 
        groupHotelIds.some(hotelId => hotelId.toString() === booking.hotelId.toString())
      );
      
      // Calculate metrics for the last 30 days
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const recentBookings = groupBookings.filter(booking => booking.checkIn >= thirtyDaysAgo);
      const totalRevenue = recentBookings.reduce((sum, booking) => sum + booking.totalAmount, 0);
      const avgOccupancy = Math.floor(Math.random() * 40) + 60; // 60-100% occupancy

      group.metrics = {
        totalRevenue: Math.floor(totalRevenue),
        avgOccupancy,
        totalBookings: recentBookings.length,
        activeProperties: groupHotels.length
      };
      
      await group.save();
    }
    console.log('✅ Updated property groups with calculated metrics');

    // Create some staff users
    const staffUsers = [];
    for (let i = 0; i < createdHotels.length; i++) {
      const hotel = createdHotels[i];
      const hashedPassword = await bcrypt.hash('staff123', 12);
      
      // Manager
      staffUsers.push({
        name: `${hotel.name} Manager`,
        email: `manager${i + 1}@${hotel.name.toLowerCase().replace(/\s+/g, '')}.com`,
        password: hashedPassword,
        role: 'manager',
        hotelId: hotel._id,
        isActive: true
      });
      
      // Front desk staff
      staffUsers.push({
        name: `${hotel.name} Front Desk`,
        email: `frontdesk${i + 1}@${hotel.name.toLowerCase().replace(/\s+/g, '')}.com`,
        password: hashedPassword,
        role: 'staff',
        hotelId: hotel._id,
        isActive: true
      });
    }

    const createdStaff = await User.create(staffUsers);
    console.log(`✅ Created ${createdStaff.length} staff users`);

    // Final Summary
    console.log('\n🎉 Multi-Property Data Seeding Completed Successfully!');
    console.log('=' .repeat(60));
    console.log('📊 COMPREHENSIVE SUMMARY:');
    console.log(`   🏢 Property Groups: ${createdGroups.length}`);
    console.log(`   🏨 Hotels: ${createdHotels.length}`);
    console.log(`   🛏️  Room Types: ${createdRoomTypes.length}`);
    console.log(`   🚪 Total Rooms: ${createdRooms.length}`);
    console.log(`   👑 Admin Users: ${createdAdmins.length}`);
    console.log(`   👔 Staff Users: ${createdStaff.length}`);
    console.log(`   👥 Guest Users: ${createdGuests.length}`);
    console.log(`   📅 Total Bookings: ${createdBookings.length}`);
    console.log('=' .repeat(60));
    
    console.log('\n🏢 PROPERTY GROUPS CREATED:');
    createdGroups.forEach((group, index) => {
      const groupHotels = createdHotels.filter(hotel => 
        hotel.propertyGroupId && hotel.propertyGroupId.toString() === group._id.toString()
      );
      console.log(`   ${index + 1}. ${group.name} (${group.groupType})`);
      console.log(`      📍 Properties: ${groupHotels.length}`);
      console.log(`      💰 Revenue: ₹${group.metrics?.totalRevenue?.toLocaleString() || 0}`);
      console.log(`      📊 Occupancy: ${group.metrics?.avgOccupancy || 0}%`);
      groupHotels.forEach(hotel => {
        console.log(`         - ${hotel.name} (${hotel.address.city})`);
      });
      console.log('');
    });

    console.log('🔐 LOGIN CREDENTIALS:');
    console.log('   Super Admin: admin@hotel.com / admin123');
    console.log('   Hotel Admins: admin1@*.com, admin2@*.com, etc. / admin123');
    console.log('   Managers: manager1@*.com, manager2@*.com, etc. / staff123');
    console.log('   Front Desk: frontdesk1@*.com, frontdesk2@*.com, etc. / staff123');
    console.log('   Guests: guest1@example.com, guest2@example.com, etc. / guest123');
    
    console.log('\n✨ Your Multi-Property Manager should now display rich data!');
    console.log('🚀 You can now test all Multi-Property Manager features with real data.');

    return {
      propertyGroups: createdGroups.length,
      hotels: createdHotels.length,
      roomTypes: createdRoomTypes.length,
      rooms: createdRooms.length,
      users: createdAdmins.length + createdStaff.length + createdGuests.length,
      bookings: createdBookings.length
    };

  } catch (error) {
    console.error('❌ Multi-Property data seeding failed:', error);
    throw error;
  }
};

const main = async () => {
  try {
    console.log('🔗 Connecting to your MongoDB database...');
    await connectDB();
    
    console.log('📊 Starting comprehensive multi-property seeding...');
    const results = await seedMultiPropertyData();
    
    console.log('\n✅ Seeding completed successfully!');
    console.log('🎯 Results:', results);
    
    await mongoose.connection.close();
    console.log('🔒 Database connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('💥 Seeding process failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the script
main();