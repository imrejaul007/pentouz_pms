import mongoose from 'mongoose';
import RoomTypeAllotment from './src/models/RoomTypeAllotment.js';
import RoomType from './src/models/RoomType.js';
import User from './src/models/User.js';
import Hotel from './src/models/Hotel.js';

// Use the specific MongoDB Atlas URI provided
const MONGO_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('🔄 Database connected for allotment seeding');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
};

const seedAllotmentData = async () => {
  try {
    console.log('🚀 Starting Room Type Allotment seed process...');

    // Find existing admin user or create one
    let adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      adminUser = await User.create({
        name: 'Hotel Admin',
        email: 'admin@hotel.com',
        password: 'admin123',
        role: 'admin',
        corporateDetails: {
          companyId: new mongoose.Types.ObjectId()
        }
      });
      console.log('✅ Created admin user');
    } else {
      console.log('✅ Found existing admin user:', adminUser.name);
    }

    // Find existing hotel or create one
    let hotel = await Hotel.findOne();
    if (!hotel) {
      hotel = await Hotel.create({
        name: 'THE PENTOUZ',
        description: 'A luxury hotel in the heart of the city',
        address: {
          street: '123 Luxury Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          zipCode: '400001',
          country: 'India'
        },
        contact: {
          phone: '+91-22-1234-5678',
          email: 'info@thepentouz.com',
          website: 'https://thepentouz.com'
        },
        amenities: ['WiFi', 'Spa', 'Pool', 'Restaurant', 'Gym'],
        rating: 5
      });
      console.log('✅ Created hotel');
    } else {
      console.log('✅ Found existing hotel:', hotel.name);
    }

    // Update user with hotelId if not set
    if (!adminUser.hotelId) {
      adminUser.hotelId = hotel._id;
      await adminUser.save();
      console.log('✅ Updated user with hotelId');
    }

    // Check existing room types or create them
    let roomTypes = await RoomType.find({ hotelId: hotel._id });
    if (roomTypes.length === 0) {
      const roomTypeData = [
        {
          code: 'DLX',
          name: 'Deluxe Room',
          description: 'Spacious deluxe room with modern amenities',
          hotelId: hotel._id,
          specifications: {
            maxOccupancy: 3,
            bedType: 'king',
            bedCount: 1,
            roomSize: 350
          },
          amenities: [
            { code: 'WIFI', name: 'WiFi', category: 'technology' },
            { code: 'AC', name: 'Air Conditioning', category: 'comfort' },
            { code: 'MINIBAR', name: 'Minibar', category: 'comfort' },
            { code: 'SAFE', name: 'Safe', category: 'comfort' }
          ],
          totalRooms: 15,
          baseCurrency: 'INR',
          baseRate: 5000,
          isActive: true
        },
        {
          code: 'STE',
          name: 'Executive Suite',
          description: 'Luxury executive suite with separate living area',
          hotelId: hotel._id,
          specifications: {
            maxOccupancy: 5,
            bedType: 'king',
            bedCount: 1,
            roomSize: 650
          },
          amenities: [
            { code: 'WIFI', name: 'WiFi', category: 'technology' },
            { code: 'AC', name: 'Air Conditioning', category: 'comfort' },
            { code: 'MINIBAR', name: 'Minibar', category: 'comfort' },
            { code: 'SAFE', name: 'Safe', category: 'comfort' },
            { code: 'LIVING', name: 'Living Area', category: 'comfort' },
            { code: 'KITCHEN', name: 'Kitchen', category: 'comfort' }
          ],
          totalRooms: 20,
          baseCurrency: 'INR',
          baseRate: 12000,
          isActive: true
        },
        {
          code: 'STD',
          name: 'Standard Room',
          description: 'Comfortable standard room with essential amenities',
          hotelId: hotel._id,
          specifications: {
            maxOccupancy: 3,
            bedType: 'queen',
            bedCount: 1,
            roomSize: 280
          },
          amenities: [
            { code: 'WIFI', name: 'WiFi', category: 'technology' },
            { code: 'AC', name: 'Air Conditioning', category: 'comfort' },
            { code: 'SAFE', name: 'Safe', category: 'comfort' }
          ],
          totalRooms: 25,
          baseCurrency: 'INR',
          baseRate: 3500,
          isActive: true
        },
        {
          code: 'FAM',
          name: 'Family Room',
          description: 'Spacious family room perfect for larger groups',
          hotelId: hotel._id,
          specifications: {
            maxOccupancy: 6,
            bedType: 'queen',
            bedCount: 2,
            roomSize: 500
          },
          amenities: [
            { code: 'WIFI', name: 'WiFi', category: 'technology' },
            { code: 'AC', name: 'Air Conditioning', category: 'comfort' },
            { code: 'MINIBAR', name: 'Minibar', category: 'comfort' },
            { code: 'SAFE', name: 'Safe', category: 'comfort' },
            { code: 'BALCONY', name: 'Balcony', category: 'comfort' }
          ],
          totalRooms: 30,
          baseCurrency: 'INR',
          baseRate: 8000,
          isActive: true
        }
      ];

      roomTypes = await RoomType.insertMany(roomTypeData);
      console.log('✅ Created room types:', roomTypes.length);
    } else {
      console.log('✅ Found existing room types:', roomTypes.length);
    }

    // Clear existing allotment data only for this hotel
    await RoomTypeAllotment.deleteMany({ hotelId: hotel._id });
    console.log('🧹 Cleared existing allotment data for hotel');

    // Create comprehensive allotment data for each room type
    const allotmentData = [];
    const channels = [
      { id: 'direct', name: 'Direct Booking', priority: 1, commission: 0, markup: 0 },
      { id: 'booking_com', name: 'Booking.com', priority: 2, commission: 15, markup: 5 },
      { id: 'expedia', name: 'Expedia', priority: 3, commission: 18, markup: 8 },
      { id: 'agoda', name: 'Agoda', priority: 4, commission: 12, markup: 3 }
    ];

    // Generate dates for next 30 days
    const today = new Date();
    const dates = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }

    roomTypes.forEach((roomType, roomTypeIndex) => {
      dates.forEach((date, dateIndex) => {
        // Vary inventory based on room type and date
        const baseInventory = 15 + (roomTypeIndex * 5); // 15, 20, 25, 30
        const dateVariation = Math.floor(Math.sin(dateIndex * 0.5) * 3); // ±3 variation
        const totalInventory = Math.max(5, baseInventory + dateVariation);

        // Calculate allocations
        const directAllocation = Math.floor(totalInventory * 0.4); // 40% direct
        const channelAllocations = channels.slice(1).map((channel, index) => {
          const percentage = [0.25, 0.20, 0.15][index] || 0.1; // 25%, 20%, 15%
          return Math.floor(totalInventory * percentage);
        });

        const totalAllocated = directAllocation + channelAllocations.reduce((sum, alloc) => sum + alloc, 0);
        const availableRooms = totalInventory - totalAllocated;

        // Create bookings simulation (sold rooms)
        const occupancyRate = 0.6 + (Math.random() * 0.3); // 60-90% occupancy
        const soldRooms = Math.floor(totalAllocated * occupancyRate);

        // Distribute sold rooms across channels
        const channelBookings = [];
        let remainingSold = soldRooms;
        
        channels.forEach((channel, index) => {
          const allocation = index === 0 ? directAllocation : channelAllocations[index - 1];
          const channelSold = Math.min(remainingSold, Math.floor(allocation * (0.5 + Math.random() * 0.4)));
          remainingSold -= channelSold;
          
          channelBookings.push({
            channelId: channel.id,
            channelName: channel.name,
            allocated: allocation,
            sold: channelSold,
            available: allocation - channelSold,
            blocked: Math.floor(Math.random() * 2), // 0-1 blocked rooms
            rate: {
              basePrice: roomType.baseRate + (roomType.baseRate * channel.markup / 100),
              currency: 'INR'
            },
            restrictions: {
              minStay: Math.random() > 0.8 ? 2 : 1, // 20% chance of 2-night minimum
              maxStay: 7,
              closedToArrival: Math.random() > 0.95, // 5% chance
              closedToDeparture: Math.random() > 0.95 // 5% chance
            }
          });
        });

        const allotment = {
          name: `${roomType.name} - ${date.toISOString().split('T')[0]}`,
          description: `Daily allocation for ${roomType.name} on ${date.toDateString()}`,
          roomTypeId: roomType._id,
          hotelId: hotel._id,
          date: date,
          status: 'active',
          
          defaultSettings: {
            totalInventory: totalInventory,
            defaultAllocationMethod: 'percentage',
            overbookingAllowed: true,
            overbookingLimit: Math.floor(totalInventory * 0.1), // 10% overbooking
            autoReleaseHours: 24,
            stopSellThreshold: 2
          },

          channels: channels.map(channel => ({
            channelId: channel.id,
            channelName: channel.name,
            priority: channel.priority,
            commission: channel.commission,
            markup: channel.markup,
            isActive: true,
            allocationMethod: 'percentage',
            restrictions: {
              minStay: 1,
              maxStay: 7,
              advanceBookingDays: 365,
              lastMinuteHours: 2
            }
          })),

          dailyAllotments: [
            {
              date: date,
              totalInventory: totalInventory,
              channelAllotments: channelBookings.map(cb => ({
                channelId: cb.channelId,
                allocated: cb.allocated,
                sold: cb.sold,
                available: cb.available,
                blocked: cb.blocked,
                rate: cb.rate.basePrice,
                restrictions: cb.restrictions
              })),
              freeStock: availableRooms,
              totalSold: soldRooms,
              occupancyRate: (soldRooms / totalInventory) * 100,
              isHoliday: Math.random() > 0.9,
              isBlackout: Math.random() > 0.95
            }
          ],

          analytics: {
            lastCalculated: new Date(),
            nextCalculation: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
            metrics: {
              averageOccupancy: (soldRooms / totalInventory) * 100,
              totalRevenue: channelBookings.reduce((sum, cb) => sum + (cb.sold * cb.rate.basePrice), 0),
              channelPerformance: channelBookings.map(cb => ({
                channelId: cb.channelId,
                occupancyRate: (cb.sold / cb.allocated) * 100,
                revenue: cb.sold * cb.rate.basePrice,
                bookings: cb.sold
              }))
            }
          },

          createdBy: adminUser._id,
          updatedBy: adminUser._id
        };

        allotmentData.push(allotment);
      });
    });

    // Insert allotment data in batches to avoid memory issues
    console.log('📊 Creating allotment records...');
    const batchSize = 50;
    for (let i = 0; i < allotmentData.length; i += batchSize) {
      const batch = allotmentData.slice(i, i + batchSize);
      await RoomTypeAllotment.insertMany(batch);
      console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allotmentData.length / batchSize)}`);
    }

    console.log('🎉 Successfully seeded room type allotment data!');
    console.log(`📈 Created ${allotmentData.length} allotment records`);
    console.log(`🏨 Hotel: ${hotel.name} (${hotel._id})`);
    console.log(`👤 Admin User: ${adminUser.name} (${adminUser._id})`);
    console.log(`🏠 Room Types: ${roomTypes.length}`);
    console.log(`📅 Date Range: ${dates[0].toDateString()} - ${dates[dates.length - 1].toDateString()}`);

  } catch (error) {
    console.error('❌ Error seeding allotment data:', error);
    throw error;
  }
};

const runSeed = async () => {
  try {
    await connectDB();
    await seedAllotmentData();
    console.log('🏆 Allotment seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('💥 Seeding failed:', error);
    process.exit(1);
  }
};

runSeed();