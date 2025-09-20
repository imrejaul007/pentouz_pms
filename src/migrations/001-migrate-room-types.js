import mongoose from 'mongoose';
import Room from '../models/Room.js';
import RoomType from '../models/RoomType.js';
import AuditLog from '../models/AuditLog.js';

/**
 * Migration Script: Create RoomTypes from existing Room data
 * This script safely migrates from hardcoded room types to proper RoomType entities
 */

const LEGACY_ROOM_TYPE_MAPPING = {
  'single': {
    name: 'Single Room',
    code: 'SGL',
    maxOccupancy: 1,
    description: 'Comfortable single occupancy room'
  },
  'double': {
    name: 'Double Room', 
    code: 'DBL',
    maxOccupancy: 2,
    description: 'Standard double occupancy room'
  },
  'suite': {
    name: 'Suite',
    code: 'STE',
    maxOccupancy: 4,
    description: 'Luxury suite with separate living area'
  },
  'deluxe': {
    name: 'Deluxe Room',
    code: 'DLX', 
    maxOccupancy: 3,
    description: 'Premium room with enhanced amenities'
  }
};

export async function migrateRoomTypes() {
  console.log('🏨 Starting Room Types Migration...');
  
  try {
    // Start transaction for safety
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // 1. Get all unique hotels and room types from existing rooms
      const roomTypesData = await Room.aggregate([
        {
          $group: {
            _id: {
              hotelId: '$hotelId',
              type: '$type'
            },
            count: { $sum: 1 },
            avgBaseRate: { $avg: '$baseRate' },
            maxCapacity: { $max: '$capacity' },
            sampleAmenities: { $first: '$amenities' },
            sampleImages: { $first: '$images' }
          }
        }
      ]).session(session);
      
      console.log(`📊 Found ${roomTypesData.length} unique hotel-roomtype combinations`);
      
      const createdRoomTypes = [];
      const roomTypeMapping = new Map(); // Legacy type -> RoomType._id mapping
      
      // 2. Create RoomType documents for each unique combination
      for (const data of roomTypesData) {
        const { hotelId, type: legacyType } = data._id;
        const mapping = LEGACY_ROOM_TYPE_MAPPING[legacyType];
        
        if (!mapping) {
          console.warn(`⚠️  Unknown legacy room type: ${legacyType}`);
          continue;
        }
        
        // Check if RoomType already exists (safety check)
        const existingRoomType = await RoomType.findOne({
          hotelId,
          legacyType
        }).session(session);
        
        if (existingRoomType) {
          console.log(`✅ RoomType already exists for hotel ${hotelId}, type ${legacyType}`);
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
          description: mapping.description,
          amenities: data.sampleAmenities || [],
          images: data.sampleImages || [],
          legacyType, // Keep for backward compatibility
          isActive: true
        };
        
        const roomType = new RoomType(roomTypeData);
        await roomType.save({ session });
        
        createdRoomTypes.push(roomType);
        roomTypeMapping.set(`${hotelId}_${legacyType}`, roomType._id);
        
        // Log the creation in audit log
        await AuditLog.logChange({
          hotelId,
          tableName: 'RoomType',
          recordId: roomType._id,
          changeType: 'create',
          source: 'migration',
          newValues: roomTypeData,
          metadata: {
            batchId: 'room-types-migration-001',
            tags: ['migration', 'room-types']
          }
        });
        
        console.log(`✅ Created RoomType: ${roomType.name} (${roomType.code}) for hotel ${hotelId}`);
      }
      
      console.log(`🎉 Successfully created ${createdRoomTypes.length} room types`);
      
      // 3. Store mapping for next migration step (room updates)
      const mappingData = Object.fromEntries(roomTypeMapping);
      console.log('💾 Room type mapping created:', mappingData);
      
      await session.commitTransaction();
      
      return {
        success: true,
        createdCount: createdRoomTypes.length,
        roomTypeMapping: mappingData,
        createdRoomTypes
      };
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
    
  } catch (error) {
    console.error('❌ Room Types Migration failed:', error);
    throw error;
  }
}

export async function rollbackRoomTypes() {
  console.log('🔄 Rolling back Room Types Migration...');
  
  try {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Delete all RoomTypes that have legacyType (created by migration)
      const deletedResult = await RoomType.deleteMany({
        legacyType: { $exists: true }
      }).session(session);
      
      // Delete related audit logs
      await AuditLog.deleteMany({
        tableName: 'RoomType',
        'metadata.batchId': 'room-types-migration-001'
      }).session(session);
      
      await session.commitTransaction();
      
      console.log(`✅ Rolled back ${deletedResult.deletedCount} room types`);
      return { success: true, deletedCount: deletedResult.deletedCount };
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
    
  } catch (error) {
    console.error('❌ Room Types Rollback failed:', error);
    throw error;
  }
}

// Utility function to verify migration
export async function verifyRoomTypesMigration() {
  console.log('🔍 Verifying Room Types Migration...');
  
  const legacyRoomTypes = await Room.distinct('type');
  const migratedRoomTypes = await RoomType.find({ legacyType: { $exists: true } });
  
  const results = {
    legacyTypesFound: legacyRoomTypes,
    migratedTypesCreated: migratedRoomTypes.length,
    coverage: migratedRoomTypes.map(rt => rt.legacyType),
    isComplete: legacyRoomTypes.every(legacyType => 
      migratedRoomTypes.some(rt => rt.legacyType === legacyType)
    )
  };
  
  console.log('📋 Migration Verification Results:', results);
  return results;
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await migrateRoomTypes();
    await verifyRoomTypesMigration();
    console.log('✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}
