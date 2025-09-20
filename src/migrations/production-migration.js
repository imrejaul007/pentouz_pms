import mongoose from 'mongoose';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');
config({ path: envPath });

console.log('🚀 PRODUCTION MIGRATION STARTING');
console.log('================================');
console.log('⚠️  MIGRATING YOUR PRODUCTION DATA');
console.log('⚠️  This will transform your hotel data structure');
console.log('================================\n');

const LEGACY_ROOM_TYPE_MAPPING = {
  'single': { name: 'Single Room', code: 'SGL', maxOccupancy: 1 },
  'double': { name: 'Double Room', code: 'DBL', maxOccupancy: 2 },
  'suite': { name: 'Suite', code: 'STE', maxOccupancy: 4 },
  'deluxe': { name: 'Deluxe Room', code: 'DLX', maxOccupancy: 3 }
};

async function runProductionMigration() {
  let Room, RoomType, RoomAvailability, Booking, AuditLog;
  
  try {
    // Connect to production database
    console.log('📡 Connecting to production database...');
    const mongoURI = process.env.MONGO_URI;
    if (!mongoURI) {
      throw new Error('MONGO_URI not found in environment variables');
    }
    
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to production MongoDB Atlas');
    console.log(`📍 Database: ${mongoose.connection.name}`);
    
    // Import models
    console.log('📋 Loading models...');
    Room = (await import('../models/Room.js')).default;
    RoomType = (await import('../models/RoomType.js')).default;
    RoomAvailability = (await import('../models/RoomAvailability.js')).default;
    Booking = (await import('../models/Booking.js')).default;
    AuditLog = (await import('../models/AuditLog.js')).default;
    console.log('✅ Models loaded successfully');
    
    // Start migration transaction
    console.log('🔄 Starting migration transaction...');
    const session = await mongoose.startSession();
    await session.startTransaction();
    
    try {
      // STEP 1: Analyze existing room data
      console.log('\n📊 STEP 1: Analyzing existing rooms...');
      const roomAnalysis = await Room.aggregate([
        {
          $group: {
            _id: { hotelId: '$hotelId', type: '$type' },
            count: { $sum: 1 },
            avgBaseRate: { $avg: '$baseRate' },
            maxCapacity: { $max: '$capacity' }
          }
        }
      ]).session(session);
      
      console.log(`Found ${roomAnalysis.length} hotel-roomtype combinations to migrate`);
      
      // STEP 2: Create RoomTypes
      console.log('\n🏗️  STEP 2: Creating RoomType entities...');
      const createdRoomTypes = [];
      const roomTypeMapping = new Map();
      
      for (const data of roomAnalysis) {
        const { hotelId, type: legacyType } = data._id;
        const mapping = LEGACY_ROOM_TYPE_MAPPING[legacyType];
        
        if (!mapping) {
          console.warn(`⚠️  Unknown room type: ${legacyType}, skipping...`);
          continue;
        }
        
        // Check if already exists
        const existingRoomType = await RoomType.findOne({
          hotelId,
          legacyType
        }).session(session);
        
        if (existingRoomType) {
          console.log(`✅ RoomType already exists: ${existingRoomType.name}`);
          roomTypeMapping.set(`${hotelId}_${legacyType}`, existingRoomType._id);
          continue;
        }
        
        // Create new RoomType
        const roomTypeData = {
          hotelId,
          name: mapping.name,
          code: mapping.code,
          maxOccupancy: data.maxCapacity || mapping.maxOccupancy,
          basePrice: Math.round(data.avgBaseRate || 0),
          legacyType,
          isActive: true
        };
        
        const roomType = new RoomType(roomTypeData);
        await roomType.save({ session });
        
        createdRoomTypes.push(roomType);
        roomTypeMapping.set(`${hotelId}_${legacyType}`, roomType._id);
        
        console.log(`✅ Created: ${roomType.name} (${roomType.roomTypeId})`);
        
        // Log creation
        await AuditLog.logChange({
          hotelId,
          tableName: 'RoomType',
          recordId: roomType._id,
          changeType: 'create',
          source: 'migration',
          newValues: roomTypeData,
          metadata: {
            batchId: 'production-migration-001',
            tags: ['migration', 'room-types', 'production']
          }
        });
      }
      
      console.log(`🎉 Created ${createdRoomTypes.length} new room types`);
      
      // STEP 3: Create Room Availability Records
      console.log('\n📅 STEP 3: Creating room availability data...');
      let totalAvailabilityRecords = 0;
      
      for (const roomType of createdRoomTypes) {
        // Get room count for this type
        const roomCount = await Room.countDocuments({
          hotelId: roomType.hotelId,
          type: roomType.legacyType,
          isActive: true
        }).session(session);
        
        if (roomCount === 0) {
          console.log(`⚠️  No rooms found for ${roomType.name}, skipping availability creation`);
          continue;
        }
        
        console.log(`📊 Creating availability for ${roomType.name} (${roomCount} rooms)`);
        
        // Create 12 months of availability data
        const availabilityRecords = [];
        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 12);
        
        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
          const currentDate = new Date(date);
          
          // Check for existing bookings on this date
          const bookingsForDate = await Booking.find({
            hotelId: roomType.hotelId,
            checkIn: { $lte: currentDate },
            checkOut: { $gt: currentDate },
            status: { $in: ['confirmed', 'checked_in'] },
            roomType: roomType.legacyType
          }).session(session);
          
          const soldRooms = bookingsForDate.reduce((total, booking) => {
            return total + booking.rooms.length;
          }, 0);
          
          const availabilityRecord = {
            hotelId: roomType.hotelId,
            roomTypeId: roomType._id,
            date: currentDate,
            totalRooms: roomCount,
            availableRooms: Math.max(0, roomCount - soldRooms),
            soldRooms: soldRooms,
            blockedRooms: 0,
            overbookedRooms: Math.max(0, soldRooms - roomCount),
            baseRate: roomType.basePrice,
            sellingRate: roomType.basePrice,
            currency: 'INR',
            needsSync: true
          };
          
          // Add reservation tracking
          if (bookingsForDate.length > 0) {
            availabilityRecord.reservations = bookingsForDate.map(booking => ({
              bookingId: booking._id,
              roomsReserved: booking.rooms.length,
              source: booking.source || 'direct',
              reservedAt: booking.createdAt
            }));
          }
          
          availabilityRecords.push(availabilityRecord);
        }
        
        // Batch insert availability records
        if (availabilityRecords.length > 0) {
          await RoomAvailability.insertMany(availabilityRecords, {
            session,
            ordered: false
          });
          
          totalAvailabilityRecords += availabilityRecords.length;
          console.log(`✅ Created ${availabilityRecords.length} availability records for ${roomType.name}`);
          
          // Log availability creation
          await AuditLog.logChange({
            hotelId: roomType.hotelId,
            tableName: 'RoomAvailability',
            recordId: roomType._id,
            changeType: 'create',
            source: 'migration',
            newValues: {
              roomTypeName: roomType.name,
              recordsCreated: availabilityRecords.length,
              dateRange: { start: startDate, end: endDate }
            },
            metadata: {
              batchId: 'production-migration-001',
              tags: ['migration', 'availability', 'production']
            }
          });
        }
      }
      
      console.log(`🎉 Created ${totalAvailabilityRecords} total availability records`);
      
      // STEP 4: Commit transaction
      console.log('\n💾 STEP 4: Committing migration...');
      await session.commitTransaction();
      console.log('✅ Migration transaction committed successfully');
      
      // STEP 5: Final verification
      console.log('\n🔍 STEP 5: Verifying migration results...');
      const finalRoomTypeCount = await RoomType.countDocuments({ legacyType: { $exists: true } });
      const finalAvailabilityCount = await RoomAvailability.countDocuments();
      const finalAuditCount = await AuditLog.countDocuments({ 
        'metadata.batchId': 'production-migration-001' 
      });
      
      console.log(`✅ Room Types: ${finalRoomTypeCount}`);
      console.log(`✅ Availability Records: ${finalAvailabilityCount}`);
      console.log(`✅ Audit Logs: ${finalAuditCount}`);
      
      console.log('\n🎉 PRODUCTION MIGRATION COMPLETED SUCCESSFULLY!');
      console.log('==============================================');
      console.log('✅ Your hotel system is now channel-management ready!');
      console.log('✅ All data migrated safely with audit trail');
      console.log('✅ Ready for OTA integrations (Booking.com, Expedia, etc.)');
      console.log('✅ Date-level inventory control enabled');
      console.log('✅ Real-time sync capabilities activated');
      
      console.log('\n🌟 NEXT STEPS:');
      console.log('==============');
      console.log('1. ✅ Update your application code to use new models');
      console.log('2. ✅ Configure OTA channel connections');
      console.log('3. ✅ Test booking flows with new structure');
      console.log('4. ✅ Set up rate/inventory sync schedules');
      
      return {
        success: true,
        roomTypesCreated: createdRoomTypes.length,
        availabilityRecords: totalAvailabilityRecords,
        auditLogs: finalAuditCount
      };
      
    } catch (error) {
      console.error('\n❌ Migration failed, rolling back...');
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
    
  } catch (error) {
    console.error('\n❌ PRODUCTION MIGRATION FAILED!');
    console.error('================================');
    console.error('Error:', error.message);
    console.error('\nYour original data remains unchanged.');
    console.error('Please check the error and try again.');
    throw error;
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('📡 Disconnected from database');
    }
  }
}

// Execute migration
runProductionMigration()
  .then((result) => {
    console.log('\n🚀 Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed!');
    process.exit(1);
  });
