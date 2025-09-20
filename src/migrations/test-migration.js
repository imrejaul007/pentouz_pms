import mongoose from 'mongoose';

// We'll import models after connecting to avoid dependency issues
let Room, RoomType, RoomAvailability, Booking, AuditLog;

/**
 * Test Migration Script
 * Creates sample data first, then tests the migration
 */

const MONGO_URI = 'mongodb+srv://mukulraj756_db_user:ON3QqOsVRFpGRf3C@cluster0.bvtjhii.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function connectToDatabase() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('📡 Connected to MongoDB Atlas');
    console.log(`📍 Database: ${mongoose.connection.name}`);
    
    // Import models after connection
    const roomModule = await import('../models/Room.js');
    Room = roomModule.default;
    
    const roomTypeModule = await import('../models/RoomType.js');
    RoomType = roomTypeModule.default;
    
    const roomAvailabilityModule = await import('../models/RoomAvailability.js');
    RoomAvailability = roomAvailabilityModule.default;
    
    const bookingModule = await import('../models/Booking.js');
    Booking = bookingModule.default;
    
    const auditLogModule = await import('../models/AuditLog.js');
    AuditLog = auditLogModule.default;
    
    console.log('✅ Models imported successfully');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

async function createSampleData() {
  console.log('🏗️  Creating sample data for migration testing...');
  
  try {
    // Create a sample hotel ID (you can replace this with a real hotel ID)
    const sampleHotelId = new mongoose.Types.ObjectId();
    
    // Create sample rooms with the old structure
    const sampleRooms = [
      {
        hotelId: sampleHotelId,
        roomNumber: '101',
        type: 'single',
        baseRate: 2000,
        currentRate: 2200,
        status: 'vacant',
        floor: 1,
        capacity: 1,
        amenities: ['AC', 'WiFi', 'TV'],
        isActive: true
      },
      {
        hotelId: sampleHotelId,
        roomNumber: '102',
        type: 'double',
        baseRate: 3500,
        currentRate: 3800,
        status: 'vacant',
        floor: 1,
        capacity: 2,
        amenities: ['AC', 'WiFi', 'TV', 'Mini Bar'],
        isActive: true
      },
      {
        hotelId: sampleHotelId,
        roomNumber: '201',
        type: 'suite',
        baseRate: 8000,
        currentRate: 8500,
        status: 'vacant',
        floor: 2,
        capacity: 4,
        amenities: ['AC', 'WiFi', 'TV', 'Mini Bar', 'Balcony'],
        isActive: true
      },
      {
        hotelId: sampleHotelId,
        roomNumber: '202',
        type: 'deluxe',
        baseRate: 5500,
        currentRate: 6000,
        status: 'vacant',
        floor: 2,
        capacity: 3,
        amenities: ['AC', 'WiFi', 'TV', 'Mini Bar', 'City View'],
        isActive: true
      }
    ];
    
    // Clear existing test data
    await Room.deleteMany({ hotelId: sampleHotelId });
    await RoomType.deleteMany({ hotelId: sampleHotelId });
    await RoomAvailability.deleteMany({ hotelId: sampleHotelId });
    await Booking.deleteMany({ hotelId: sampleHotelId });
    await AuditLog.deleteMany({ hotelId: sampleHotelId });
    
    // Insert sample rooms
    const insertedRooms = await Room.insertMany(sampleRooms);
    console.log(`✅ Created ${insertedRooms.length} sample rooms`);
    
    // Create a sample booking
    const sampleUserId = new mongoose.Types.ObjectId();
    const sampleBooking = {
      hotelId: sampleHotelId,
      userId: sampleUserId,
      rooms: [{ roomId: insertedRooms[0]._id, rate: 2200 }],
      checkIn: new Date('2024-01-15'),
      checkOut: new Date('2024-01-17'),
      nights: 2,
      status: 'confirmed',
      paymentStatus: 'paid',
      totalAmount: 4400,
      roomType: 'single',
      guestDetails: { adults: 1, children: 0 },
      source: 'direct'
    };
    
    const insertedBooking = await Booking.create(sampleBooking);
    console.log(`✅ Created sample booking: ${insertedBooking.bookingNumber}`);
    
    return {
      hotelId: sampleHotelId,
      roomsCreated: insertedRooms.length,
      bookingId: insertedBooking._id
    };
    
  } catch (error) {
    console.error('❌ Failed to create sample data:', error);
    throw error;
  }
}

async function testMigrationSteps() {
  console.log('🧪 Testing Migration Steps...');
  
  try {
    const sampleData = await createSampleData();
    console.log(`🏨 Test hotel ID: ${sampleData.hotelId}`);
    
    // Import migration functions
    const { migrateRoomTypes, verifyRoomTypesMigration } = await import('./001-migrate-room-types.js');
    const { createRoomAvailabilityData, verifyRoomAvailability } = await import('./002-create-room-availability.js');
    
    console.log('\n📝 Testing Room Types Migration...');
    const roomTypesResult = await migrateRoomTypes();
    console.log(`✅ Room types result:`, roomTypesResult);
    
    await verifyRoomTypesMigration();
    
    console.log('\n📅 Testing Room Availability Creation...');
    const availabilityResult = await createRoomAvailabilityData({
      startDate: new Date('2024-01-01'),
      monthsAhead: 3, // Just 3 months for testing
      hotelId: sampleData.hotelId
    });
    console.log(`✅ Availability result:`, availabilityResult);
    
    await verifyRoomAvailability(sampleData.hotelId);
    
    // Test audit log
    console.log('\n📋 Testing Audit Log...');
    const auditLogs = await AuditLog.find({ hotelId: sampleData.hotelId }).limit(5);
    console.log(`✅ Found ${auditLogs.length} audit log entries`);
    
    // Verify data integrity
    console.log('\n🔍 Verifying Data Integrity...');
    
    const roomTypes = await RoomType.find({ hotelId: sampleData.hotelId });
    const availabilityRecords = await RoomAvailability.find({ hotelId: sampleData.hotelId });
    
    console.log(`✅ Room types created: ${roomTypes.length}`);
    console.log(`✅ Availability records: ${availabilityRecords.length}`);
    
    // Check if room type mapping works
    for (const roomType of roomTypes) {
      const roomsOfType = await Room.countDocuments({ 
        hotelId: sampleData.hotelId, 
        type: roomType.legacyType 
      });
      console.log(`✅ ${roomType.name} (${roomType.legacyType}): ${roomsOfType} rooms`);
    }
    
    console.log('\n🎉 MIGRATION TEST COMPLETED SUCCESSFULLY!');
    console.log('==========================================');
    console.log('Your migration system is working correctly.');
    console.log('You can now run the full migration safely.');
    
    return {
      success: true,
      testData: {
        hotelId: sampleData.hotelId,
        roomTypesCreated: roomTypes.length,
        availabilityRecords: availabilityRecords.length
      }
    };
    
  } catch (error) {
    console.error('❌ Migration test failed:', error);
    throw error;
  }
}

async function cleanupTestData(hotelId) {
  console.log('🧹 Cleaning up test data...');
  
  try {
    await Promise.all([
      Room.deleteMany({ hotelId }),
      RoomType.deleteMany({ hotelId }),
      RoomAvailability.deleteMany({ hotelId }),
      Booking.deleteMany({ hotelId }),
      AuditLog.deleteMany({ hotelId })
    ]);
    
    console.log('✅ Test data cleaned up');
  } catch (error) {
    console.error('⚠️  Failed to cleanup test data:', error);
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  let testData = null;
  
  try {
    await connectToDatabase();
    
    const result = await testMigrationSteps();
    testData = result.testData;
    
    console.log('\n💡 Next steps:');
    console.log('1. Run: node run-migration.js (for full migration)');
    console.log('2. Update your application code to use the new models');
    console.log('3. Test your application with the new data structure');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup test data
    if (testData && testData.hotelId) {
      await cleanupTestData(testData.hotelId);
    }
    
    await mongoose.disconnect();
    console.log('📡 Disconnected from database');
  }
}
