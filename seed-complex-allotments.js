import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

// Correct hotel ID and room type IDs
const HOTEL_ID = '68bc094f80c86bfe258e172b';

const ROOM_TYPES = [
  {
    _id: '68bc094f80c86bfe258e1731',
    code: 'STD',
    name: 'Standard Room',
    totalRooms: 40,
    baseRate: 2500
  },
  {
    _id: '68bc094f80c86bfe258e1736',
    code: 'DLX', 
    name: 'Deluxe Room',
    totalRooms: 30,
    baseRate: 3500
  },
  {
    _id: '68bc094f80c86bfe258e173d',
    code: 'STE',
    name: 'Premium Suite',
    totalRooms: 10,
    baseRate: 8000
  },
  {
    _id: '68bc094f80c86bfe258e1746',
    code: 'EXE',
    name: 'Executive Deluxe',
    totalRooms: 20,
    baseRate: 6000
  }
];

async function seedComplexAllotments() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB successfully\n');

    const db = mongoose.connection.db;

    // Clear existing allotments
    console.log('=== CLEANING EXISTING ALLOTMENTS ===');
    const deleteResult = await db.collection('roomtypeallotments').deleteMany({ 
      hotelId: new mongoose.Types.ObjectId(HOTEL_ID) 
    });
    console.log(`Deleted ${deleteResult.deletedCount} existing allotments for hotel ${HOTEL_ID}\n`);

    const startDate = new Date();
    const allotments = [];

    console.log('=== CREATING COMPLEX ALLOTMENTS ===');
    
    for (const roomType of ROOM_TYPES) {
      console.log(`Creating allotment for ${roomType.name} (${roomType.code})...`);
      
      // Generate daily allotments for next 30 days
      const dailyAllotments = [];
      
      for (let i = 0; i < 30; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        
        // Channel allocations with realistic bookings
        const totalInventory = roomType.totalRooms;
        const directAllocated = Math.ceil(totalInventory * 0.4); // 40% to direct
        const bookingComAllocated = Math.ceil(totalInventory * 0.25); // 25% to booking.com
        const expediaAllocated = Math.ceil(totalInventory * 0.2); // 20% to expedia
        const agodaAllocated = totalInventory - directAllocated - bookingComAllocated - expediaAllocated;
        
        // Random sold rooms per channel
        const directSold = Math.floor(Math.random() * directAllocated * 0.8);
        const bookingSold = Math.floor(Math.random() * bookingComAllocated * 0.7);
        const expediaSold = Math.floor(Math.random() * expediaAllocated * 0.6);
        const agodaSold = Math.floor(Math.random() * agodaAllocated * 0.5);
        
        const totalSold = directSold + bookingSold + expediaSold + agodaSold;
        const occupancyRate = (totalSold / totalInventory) * 100;
        const freeStock = totalInventory - totalSold;
        
        dailyAllotments.push({
          date: date,
          totalInventory: totalInventory,
          channelAllotments: [
            {
              channelId: "direct",
              allocated: directAllocated,
              sold: directSold,
              available: directAllocated - directSold,
              blocked: 0,
              overbooking: 0,
              rate: Math.round(roomType.baseRate * (0.9 + Math.random() * 0.2)), // ±10% variation
              _id: new mongoose.Types.ObjectId(),
              lastUpdated: new Date()
            },
            {
              channelId: "booking_com",
              allocated: bookingComAllocated,
              sold: bookingSold,
              available: bookingComAllocated - bookingSold,
              blocked: 0,
              overbooking: 0,
              rate: Math.round(roomType.baseRate * 1.05 * (0.9 + Math.random() * 0.2)), // 5% markup
              _id: new mongoose.Types.ObjectId(),
              lastUpdated: new Date()
            },
            {
              channelId: "expedia",
              allocated: expediaAllocated,
              sold: expediaSold,
              available: expediaAllocated - expediaSold,
              blocked: Math.floor(Math.random() * 2), // 0-1 blocked
              overbooking: 0,
              rate: Math.round(roomType.baseRate * 1.08 * (0.9 + Math.random() * 0.2)), // 8% markup
              _id: new mongoose.Types.ObjectId(),
              lastUpdated: new Date()
            },
            {
              channelId: "agoda",
              allocated: agodaAllocated,
              sold: agodaSold,
              available: agodaAllocated - agodaSold,
              blocked: Math.floor(Math.random() * 2), // 0-1 blocked
              overbooking: 0,
              rate: Math.round(roomType.baseRate * 1.03 * (0.9 + Math.random() * 0.2)), // 3% markup
              _id: new mongoose.Types.ObjectId(),
              lastUpdated: new Date()
            }
          ],
          freeStock: freeStock,
          totalSold: totalSold,
          occupancyRate: occupancyRate,
          isHoliday: false,
          isBlackout: false,
          _id: new mongoose.Types.ObjectId()
        });
      }

      // Calculate overall occupancy rate
      const avgOccupancy = dailyAllotments.reduce((sum, day) => sum + day.occupancyRate, 0) / dailyAllotments.length;

      const allotment = {
        _id: new mongoose.Types.ObjectId(),
        hotelId: new mongoose.Types.ObjectId(HOTEL_ID),
        roomTypeId: new mongoose.Types.ObjectId(roomType._id),
        name: `${roomType.name} - ${new Date().getFullYear()}`,
        description: `Daily allocation for ${roomType.name}`,
        status: "active",
        channels: [
          {
            channelId: "direct",
            channelName: "Direct Booking",
            isActive: true,
            priority: 1,
            commission: 0,
            markup: 0,
            maxAdvanceBooking: 365,
            minAdvanceBooking: 0,
            cutoffTime: "18:00",
            restrictions: {
              minimumStay: 1,
              maximumStay: 30,
              closedToArrival: false,
              closedToDeparture: false,
              stopSell: false
            },
            rateModifiers: {
              weekdays: 0,
              weekends: 0,
              holidays: 0
            },
            _id: new mongoose.Types.ObjectId()
          },
          {
            channelId: "booking_com",
            channelName: "Booking.com",
            isActive: true,
            priority: 2,
            commission: 15,
            markup: 5,
            maxAdvanceBooking: 365,
            minAdvanceBooking: 0,
            cutoffTime: "18:00",
            restrictions: {
              minimumStay: 1,
              maximumStay: 30,
              closedToArrival: false,
              closedToDeparture: false,
              stopSell: false
            },
            rateModifiers: {
              weekdays: 0,
              weekends: 0,
              holidays: 0
            },
            _id: new mongoose.Types.ObjectId()
          },
          {
            channelId: "expedia",
            channelName: "Expedia",
            isActive: true,
            priority: 3,
            commission: 18,
            markup: 8,
            maxAdvanceBooking: 365,
            minAdvanceBooking: 0,
            cutoffTime: "18:00",
            restrictions: {
              minimumStay: 1,
              maximumStay: 30,
              closedToArrival: false,
              closedToDeparture: false,
              stopSell: false
            },
            rateModifiers: {
              weekdays: 0,
              weekends: 0,
              holidays: 0
            },
            _id: new mongoose.Types.ObjectId()
          },
          {
            channelId: "agoda",
            channelName: "Agoda",
            isActive: true,
            priority: 4,
            commission: 12,
            markup: 3,
            maxAdvanceBooking: 365,
            minAdvanceBooking: 0,
            cutoffTime: "18:00",
            restrictions: {
              minimumStay: 1,
              maximumStay: 30,
              closedToArrival: false,
              closedToDeparture: false,
              stopSell: false
            },
            rateModifiers: {
              weekdays: 0,
              weekends: 0,
              holidays: 0
            },
            _id: new mongoose.Types.ObjectId()
          }
        ],
        dailyAllotments: dailyAllotments,
        defaultSettings: {
          totalInventory: roomType.totalRooms,
          defaultAllocationMethod: "percentage",
          overbookingAllowed: true,
          overbookingLimit: 1,
          releaseWindow: 24,
          autoRelease: true,
          blockPeriod: 0
        },
        analytics: {
          lastCalculated: new Date(),
          nextCalculation: new Date(Date.now() + 24 * 60 * 60 * 1000),
          calculationFrequency: "daily",
          alerts: [],
          recommendations: []
        },
        integration: {
          channelManager: {
            isConnected: false,
            syncFrequency: 15,
            autoSync: true,
            errorLog: []
          },
          pms: {
            isConnected: false
          }
        },
        createdBy: new mongoose.Types.ObjectId('68b9e0125eaf06d56ef64a7a'),
        updatedBy: new mongoose.Types.ObjectId('68b9e0125eaf06d56ef64a7a'),
        version: 1,
        allocationRules: [],
        performanceMetrics: [],
        changeLog: [],
        overallOccupancyRate: avgOccupancy, // Add this field for frontend
        __v: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      allotments.push(allotment);
    }

    // Insert all allotments using raw MongoDB
    console.log(`\nInserting ${allotments.length} complex allotments...`);
    const insertResult = await db.collection('roomtypeallotments').insertMany(allotments);
    console.log(`Successfully inserted ${Object.keys(insertResult.insertedIds).length} allotments\n`);

    // Display summary
    console.log('=== SUMMARY ===');
    for (const roomType of ROOM_TYPES) {
      const count = await db.collection('roomtypeallotments').countDocuments({
        roomTypeId: new mongoose.Types.ObjectId(roomType._id),
        hotelId: new mongoose.Types.ObjectId(HOTEL_ID)
      });
      console.log(`${roomType.name}: ${count} allotment created`);
    }

    // Show sample data structure
    console.log('\n=== SAMPLE COMPLEX ALLOTMENT STRUCTURE ===');
    const sampleAllotment = await db.collection('roomtypeallotments').findOne({
      hotelId: new mongoose.Types.ObjectId(HOTEL_ID)
    });

    if (sampleAllotment) {
      console.log('Sample allotment keys:', Object.keys(sampleAllotment));
      console.log('defaultSettings:', sampleAllotment.defaultSettings);
      console.log('overallOccupancyRate:', sampleAllotment.overallOccupancyRate);
      console.log('channels count:', sampleAllotment.channels?.length || 0);
      console.log('dailyAllotments count:', sampleAllotment.dailyAllotments?.length || 0);
      
      if (sampleAllotment.dailyAllotments && sampleAllotment.dailyAllotments[0]) {
        console.log('First daily allotment keys:', Object.keys(sampleAllotment.dailyAllotments[0]));
        console.log('First daily allotment channelAllotments:', sampleAllotment.dailyAllotments[0].channelAllotments?.length || 0);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

seedComplexAllotments();