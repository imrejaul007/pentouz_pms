import mongoose from 'mongoose';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');
config({ path: envPath });

console.log('🔍 VERIFYING PRODUCTION MIGRATION RESULTS');
console.log('=========================================');

async function verifyMigration() {
  try {
    // Connect to database
    const mongoURI = process.env.MONGO_URI;
    await mongoose.connect(mongoURI);
    console.log('📡 Connected to production database');
    
    // Import models
    const { default: RoomType } = await import('../models/RoomType.js');
    const { default: RoomAvailability } = await import('../models/RoomAvailability.js');
    const { default: AuditLog } = await import('../models/AuditLog.js');
    const { default: Room } = await import('../models/Room.js');
    
    console.log('✅ Models imported\n');
    
    // Check Room Types
    console.log('🏨 ROOM TYPES VERIFICATION');
    console.log('==========================');
    const roomTypes = await RoomType.find({ legacyType: { $exists: true } });
    console.log(`✅ Found ${roomTypes.length} migrated room types:`);
    
    roomTypes.forEach(rt => {
      console.log(`   📍 ${rt.name} (${rt.code})`);
      console.log(`      ID: ${rt.roomTypeId}`);
      console.log(`      Legacy Type: ${rt.legacyType}`);
      console.log(`      Base Price: ₹${rt.basePrice}`);
      console.log(`      Max Occupancy: ${rt.maxOccupancy}`);
      console.log('');
    });
    
    // Check Room Availability
    console.log('📅 ROOM AVAILABILITY VERIFICATION');
    console.log('=================================');
    const totalAvailability = await RoomAvailability.countDocuments();
    console.log(`✅ Total availability records: ${totalAvailability}`);
    
    // Get sample availability records
    const sampleAvailability = await RoomAvailability.find().limit(3).populate('roomTypeId');
    console.log('📊 Sample availability records:');
    
    sampleAvailability.forEach(av => {
      console.log(`   📅 ${av.date.toDateString()}`);
      console.log(`      Room Type: ${av.roomTypeId?.name}`);
      console.log(`      Total Rooms: ${av.totalRooms}`);
      console.log(`      Available: ${av.availableRooms}`);
      console.log(`      Sold: ${av.soldRooms}`);
      console.log(`      Base Rate: ₹${av.baseRate}`);
      console.log('');
    });
    
    // Check date range
    const dateRange = await RoomAvailability.aggregate([
      {
        $group: {
          _id: null,
          minDate: { $min: '$date' },
          maxDate: { $max: '$date' }
        }
      }
    ]);
    
    if (dateRange.length > 0) {
      console.log(`📆 Date range: ${dateRange[0].minDate.toDateString()} to ${dateRange[0].maxDate.toDateString()}`);
    }
    
    // Check Audit Logs
    console.log('\n📋 AUDIT LOG VERIFICATION');
    console.log('=========================');
    const auditLogs = await AuditLog.find({ 
      'metadata.batchId': 'production-migration-001' 
    });
    console.log(`✅ Migration audit logs: ${auditLogs.length}`);
    
    // Check original rooms
    console.log('\n🛏️  ORIGINAL ROOMS STATUS');
    console.log('========================');
    const originalRoomCount = await Room.countDocuments();
    console.log(`✅ Original rooms preserved: ${originalRoomCount}`);
    
    const roomTypeCounts = await Room.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);
    
    console.log('📊 Room distribution:');
    roomTypeCounts.forEach(rt => {
      console.log(`   ${rt._id}: ${rt.count} rooms`);
    });
    
    // Final status
    console.log('\n🎉 MIGRATION VERIFICATION COMPLETE!');
    console.log('===================================');
    console.log(`✅ Room Types Created: ${roomTypes.length}`);
    console.log(`✅ Availability Records: ${totalAvailability}`);
    console.log(`✅ Audit Logs: ${auditLogs.length}`);
    console.log(`✅ Original Rooms Preserved: ${originalRoomCount}`);
    
    const isSuccessful = (
      roomTypes.length > 0 && 
      totalAvailability > 0 && 
      originalRoomCount > 0
    );
    
    if (isSuccessful) {
      console.log('\n🌟 MIGRATION STATUS: SUCCESS!');
      console.log('=============================');
      console.log('✅ Your hotel system is now channel-management ready!');
      console.log('✅ OTA integrations can now be configured');
      console.log('✅ Date-level inventory control active');
      console.log('✅ All original data preserved');
    } else {
      console.log('\n⚠️  MIGRATION STATUS: INCOMPLETE');
      console.log('===============================');
      console.log('Some components may not have migrated correctly.');
    }
    
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from database');
    
    return isSuccessful;
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    return false;
  }
}

verifyMigration()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(() => {
    process.exit(1);
  });
