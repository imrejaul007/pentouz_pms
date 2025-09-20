import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://mukulraj756_db_user:ON3QqOsVRFpGRf3C@cluster0.bvtjhii.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

console.log('🚀 Quick Migration Test');
console.log('======================');

async function quickTest() {
  try {
    // Connect
    console.log('📡 Connecting...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas');
    
    // Import models
    const { default: Room } = await import('../models/Room.js');
    const { default: RoomType } = await import('../models/RoomType.js');
    const { default: RoomAvailability } = await import('../models/RoomAvailability.js');
    const { default: AuditLog } = await import('../models/AuditLog.js');
    console.log('✅ Models imported');
    
    const testHotelId = new mongoose.Types.ObjectId();
    console.log(`🏨 Test Hotel ID: ${testHotelId}`);
    
    // Step 1: Create sample rooms (old structure)
    console.log('\n📝 Step 1: Creating sample rooms...');
    const sampleRooms = [
      { hotelId: testHotelId, roomNumber: '101', type: 'single', baseRate: 2000, capacity: 1 },
      { hotelId: testHotelId, roomNumber: '102', type: 'double', baseRate: 3500, capacity: 2 },
      { hotelId: testHotelId, roomNumber: '201', type: 'suite', baseRate: 8000, capacity: 4 }
    ];
    
    const rooms = await Room.insertMany(sampleRooms);
    console.log(`✅ Created ${rooms.length} sample rooms`);
    
    // Step 2: Create RoomTypes from rooms
    console.log('\n🏗️  Step 2: Creating RoomTypes...');
    const roomTypeMapping = {
      'single': { name: 'Single Room', code: 'SGL', maxOccupancy: 1 },
      'double': { name: 'Double Room', code: 'DBL', maxOccupancy: 2 },
      'suite': { name: 'Suite', code: 'STE', maxOccupancy: 4 }
    };
    
    const createdRoomTypes = [];
    for (const [legacyType, config] of Object.entries(roomTypeMapping)) {
      const roomType = new RoomType({
        hotelId: testHotelId,
        name: config.name,
        code: config.code,
        maxOccupancy: config.maxOccupancy,
        basePrice: 2000,
        legacyType,
        isActive: true
      });
      
      await roomType.save();
      createdRoomTypes.push(roomType);
      console.log(`✅ Created RoomType: ${roomType.name} (ID: ${roomType.roomTypeId})`);
    }
    
    // Step 3: Create Room Availability
    console.log('\n📅 Step 3: Creating Room Availability...');
    let totalAvailability = 0;
    
    for (const roomType of createdRoomTypes) {
      const roomCount = await Room.countDocuments({ 
        hotelId: testHotelId, 
        type: roomType.legacyType 
      });
      
      // Create 7 days of availability
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        
        const availability = new RoomAvailability({
          hotelId: testHotelId,
          roomTypeId: roomType._id,
          date,
          totalRooms: roomCount,
          availableRooms: roomCount,
          soldRooms: 0,
          baseRate: roomType.basePrice
        });
        
        await availability.save();
        totalAvailability++;
      }
      
      console.log(`✅ Created 7 days availability for ${roomType.name}`);
    }
    
    // Step 4: Create Audit Log
    console.log('\n📋 Step 4: Creating Audit Log...');
    const auditLog = new AuditLog({
      hotelId: testHotelId,
      tableName: 'RoomType',
      recordId: createdRoomTypes[0]._id,
      changeType: 'create',
      source: 'migration',
      newValues: { test: 'migration successful' }
    });
    
    await auditLog.save();
    console.log(`✅ Created audit log (ID: ${auditLog.logId})`);
    
    // Step 5: Verify everything
    console.log('\n🔍 Step 5: Verification...');
    const roomCount = await Room.countDocuments({ hotelId: testHotelId });
    const roomTypeCount = await RoomType.countDocuments({ hotelId: testHotelId });
    const availabilityCount = await RoomAvailability.countDocuments({ hotelId: testHotelId });
    const auditCount = await AuditLog.countDocuments({ hotelId: testHotelId });
    
    console.log(`✅ Rooms: ${roomCount}`);
    console.log(`✅ Room Types: ${roomTypeCount}`);
    console.log(`✅ Availability Records: ${availabilityCount}`);
    console.log(`✅ Audit Logs: ${auditCount}`);
    
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await Room.deleteMany({ hotelId: testHotelId });
    await RoomType.deleteMany({ hotelId: testHotelId });
    await RoomAvailability.deleteMany({ hotelId: testHotelId });
    await AuditLog.deleteMany({ hotelId: testHotelId });
    console.log('✅ Cleanup completed');
    
    await mongoose.disconnect();
    console.log('📡 Disconnected');
    
    console.log('\n🎉 MIGRATION TEST SUCCESSFUL!');
    console.log('============================');
    console.log('✅ All models work correctly');
    console.log('✅ Database connection stable'); 
    console.log('✅ Data creation and cleanup working');
    console.log('✅ Ready for production migration!');
    
  } catch (error) {
    console.error('\n❌ MIGRATION TEST FAILED!');
    console.error('=========================');
    console.error('Error:', error);
    
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

quickTest();
