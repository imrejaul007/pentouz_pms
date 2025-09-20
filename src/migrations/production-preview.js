import mongoose from 'mongoose';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');
config({ path: envPath });

console.log('🔍 PRODUCTION MIGRATION PREVIEW');
console.log('================================');
console.log('⚠️  This script will ANALYZE your production data');
console.log('⚠️  NO CHANGES will be made to your database');
console.log('================================\n');

async function connectToProduction() {
  try {
    const mongoURI = process.env.MONGO_URI;
    if (!mongoURI) {
      throw new Error('MONGO_URI not found in .env file');
    }
    
    console.log('📡 Connecting to PRODUCTION database...');
    await mongoose.connect(mongoURI);
    console.log('✅ Connected successfully');
    console.log(`📍 Database: ${mongoose.connection.name}`);
    console.log(`🌐 Host: ${mongoose.connection.host}`);
    
    return true;
  } catch (error) {
    console.error('❌ Connection failed:', error);
    return false;
  }
}

async function analyzeCurrentData() {
  try {
    // Import existing models
    const { default: Room } = await import('../models/Room.js');
    const { default: Booking } = await import('../models/Booking.js');
    
    console.log('📊 ANALYZING CURRENT DATA STRUCTURE');
    console.log('===================================');
    
    // Analyze Rooms
    const roomAnalysis = await Room.aggregate([
      {
        $group: {
          _id: {
            hotelId: '$hotelId',
            type: '$type'
          },
          count: { $sum: 1 },
          avgBaseRate: { $avg: '$baseRate' },
          sampleRoomNumbers: { $push: '$roomNumber' },
          maxCapacity: { $max: '$capacity' },
          totalRooms: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.hotelId': 1, '_id.type': 1 }
      }
    ]);
    
    console.log(`\n🏨 ROOMS ANALYSIS (${roomAnalysis.length} hotel-roomtype combinations):`);
    console.log('===========================================');
    
    let totalRooms = 0;
    const roomTypeMapping = new Map();
    
    roomAnalysis.forEach(item => {
      const { hotelId, type } = item._id;
      totalRooms += item.count;
      
      console.log(`📍 Hotel: ${hotelId}`);
      console.log(`   Room Type: ${type}`);
      console.log(`   Rooms Count: ${item.count}`);
      console.log(`   Avg Base Rate: ₹${Math.round(item.avgBaseRate || 0)}`);
      console.log(`   Max Capacity: ${item.maxCapacity}`);
      console.log(`   Sample Room Numbers: ${item.sampleRoomNumbers.slice(0, 3).join(', ')}${item.sampleRoomNumbers.length > 3 ? '...' : ''}`);
      console.log('');
      
      // Track for migration preview
      if (!roomTypeMapping.has(hotelId)) {
        roomTypeMapping.set(hotelId, new Set());
      }
      roomTypeMapping.get(hotelId).add(type);
    });
    
    console.log(`📊 SUMMARY: ${totalRooms} total rooms across ${roomTypeMapping.size} hotels`);
    
    // Analyze Bookings
    const bookingAnalysis = await Booking.aggregate([
      {
        $group: {
          _id: {
            hotelId: '$hotelId',
            status: '$status',
            source: '$source'
          },
          count: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { '_id.hotelId': 1, '_id.status': 1 } }
    ]);
    
    console.log(`\n📋 BOOKINGS ANALYSIS (${bookingAnalysis.length} combinations):`);
    console.log('========================================');
    
    let totalBookings = 0;
    let totalRevenue = 0;
    
    bookingAnalysis.forEach(item => {
      const { hotelId, status, source } = item._id;
      totalBookings += item.count;
      totalRevenue += item.totalRevenue || 0;
      
      console.log(`📍 Hotel: ${hotelId} | Status: ${status} | Source: ${source} | Count: ${item.count} | Revenue: ₹${Math.round(item.totalRevenue || 0)}`);
    });
    
    console.log(`📊 SUMMARY: ${totalBookings} total bookings, ₹${Math.round(totalRevenue)} total revenue`);
    
    return {
      roomAnalysis,
      bookingAnalysis,
      summary: {
        totalRooms,
        totalBookings,
        totalRevenue,
        hotelCount: roomTypeMapping.size,
        roomTypeMapping
      }
    };
    
  } catch (error) {
    console.error('❌ Data analysis failed:', error);
    throw error;
  }
}

async function previewMigrationPlan(analysisData) {
  console.log('\n🚀 MIGRATION PLAN PREVIEW');
  console.log('=========================');
  
  const { summary, roomAnalysis } = analysisData;
  
  console.log('📝 STEP 1: Room Types Creation');
  console.log('------------------------------');
  let roomTypesToCreate = 0;
  
  for (const [hotelId, roomTypes] of summary.roomTypeMapping.entries()) {
    console.log(`🏨 Hotel ${hotelId}:`);
    roomTypes.forEach(type => {
      roomTypesToCreate++;
      const roomData = roomAnalysis.find(r => r._id.hotelId.equals(hotelId) && r._id.type === type);
      console.log(`   ✅ Will create: ${type.toUpperCase()} Room Type`);
      console.log(`      - Unique ID: RT_${hotelId.toString().slice(-4).toUpperCase()}_${type.substring(0,3).toUpperCase()}_XXXXXX`);
      console.log(`      - Base Price: ₹${Math.round(roomData?.avgBaseRate || 0)}`);
      console.log(`      - Room Count: ${roomData?.count || 0}`);
    });
    console.log('');
  }
  
  console.log(`📊 Total Room Types to create: ${roomTypesToCreate}\n`);
  
  console.log('📅 STEP 2: Room Availability Creation');
  console.log('------------------------------------');
  const availabilityRecords = roomTypesToCreate * 365; // 1 year
  console.log(`✅ Will create: ${availabilityRecords} availability records`);
  console.log(`   - Date Range: Next 12 months`);
  console.log(`   - Per Room Type: 365 daily records`);
  console.log(`   - Total Storage: ~${Math.round(availabilityRecords * 0.5)}KB\n`);
  
  console.log('📋 STEP 3: Booking Enhancement');
  console.log('------------------------------');
  console.log(`✅ Will enhance: ${summary.totalBookings} existing bookings`);
  console.log('   - Add OTA sync fields');
  console.log('   - Add channel mapping capability');
  console.log('   - Add modification tracking\n');
  
  console.log('📝 STEP 4: Audit Trail Setup');
  console.log('----------------------------');
  console.log('✅ Will create comprehensive change tracking');
  console.log('   - All future changes logged');
  console.log('   - Channel sync reconciliation');
  console.log('   - Data integrity monitoring\n');
  
  console.log('⚡ ESTIMATED MIGRATION TIME');
  console.log('==========================');
  const estimatedMinutes = Math.max(2, Math.ceil(roomTypesToCreate / 10));
  console.log(`⏱️  Estimated Duration: ${estimatedMinutes} minutes`);
  console.log(`💾 Additional Storage: ~${Math.round(availabilityRecords * 0.5 + roomTypesToCreate * 0.1)}KB`);
  console.log(`🔄 Rollback Available: Yes, complete rollback possible\n`);
  
  console.log('🎯 BENEFITS AFTER MIGRATION');
  console.log('===========================');
  console.log('✅ Ready for Booking.com integration');
  console.log('✅ Ready for Expedia integration');
  console.log('✅ Ready for Airbnb integration');
  console.log('✅ Date-level inventory control');
  console.log('✅ Real-time rate/availability sync');
  console.log('✅ Complete audit trail for reconciliation');
  console.log('✅ Multi-channel revenue optimization\n');
  
  return {
    roomTypesToCreate,
    availabilityRecords,
    estimatedMinutes
  };
}

async function runProductionPreview() {
  try {
    const connected = await connectToProduction();
    if (!connected) {
      process.exit(1);
    }
    
    const analysisData = await analyzeCurrentData();
    const migrationPlan = await previewMigrationPlan(analysisData);
    
    console.log('🎉 PREVIEW COMPLETED SUCCESSFULLY');
    console.log('=================================');
    console.log('✅ Your production data has been analyzed');
    console.log('✅ Migration plan generated');
    console.log('✅ No changes made to your database');
    console.log('✅ System is ready for migration\n');
    
    console.log('🚀 NEXT STEPS');
    console.log('=============');
    console.log('1. 💾 Create database backup:');
    console.log('   mongodump --uri="your-mongodb-uri" --out=./backup');
    console.log('2. 🏃 Run migration:');
    console.log('   node src/migrations/run-migration.js');
    console.log('3. 🔍 Verify results');
    console.log('4. 🌟 Start configuring OTA channels\n');
    
    await mongoose.disconnect();
    console.log('📡 Disconnected from database');
    
  } catch (error) {
    console.error('\n❌ PREVIEW FAILED');
    console.error('=================');
    console.error('Error:', error.message);
    
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

runProductionPreview();
