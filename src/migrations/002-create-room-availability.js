import mongoose from 'mongoose';
import RoomType from '../models/RoomType.js';
import Room from '../models/Room.js';
import RoomAvailability from '../models/RoomAvailability.js';
import Booking from '../models/Booking.js';
import AuditLog from '../models/AuditLog.js';

/**
 * Migration Script: Create RoomAvailability records for date-level inventory
 * This creates the foundation for OTA channel management
 */

export async function createRoomAvailabilityData(options = {}) {
  const {
    startDate = new Date(),
    monthsAhead = 12, // Create 12 months of availability data
    hotelId = null // If null, process all hotels
  } = options;
  
  console.log('📅 Starting Room Availability Data Creation...');
  console.log(`📊 Creating ${monthsAhead} months of data starting from ${startDate.toDateString()}`);
  
  try {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // 1. Get all room types (after room type migration)
      const query = hotelId ? { hotelId, isActive: true } : { isActive: true };
      const roomTypes = await RoomType.find(query).session(session);
      
      if (roomTypes.length === 0) {
        throw new Error('No room types found. Please run room types migration first.');
      }
      
      console.log(`🏨 Found ${roomTypes.length} room types to process`);
      
      let totalCreated = 0;
      const batchId = `availability-creation-${Date.now()}`;
      
      for (const roomType of roomTypes) {
        console.log(`🔄 Processing ${roomType.name} for hotel ${roomType.hotelId}...`);
        
        // Get total rooms of this type
        const totalRoomsCount = await Room.countDocuments({
          hotelId: roomType.hotelId,
          type: roomType.legacyType, // Use legacy type for now
          isActive: true
        }).session(session);
        
        if (totalRoomsCount === 0) {
          console.log(`⚠️  No rooms found for room type ${roomType.name}`);
          continue;
        }
        
        console.log(`📊 Found ${totalRoomsCount} rooms of type ${roomType.name}`);
        
        // Create availability records for each date
        const availabilityRecords = [];
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + monthsAhead);
        
        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
          const currentDate = new Date(date);
          
          // Check if availability record already exists
          const existingRecord = await RoomAvailability.findOne({
            hotelId: roomType.hotelId,
            roomTypeId: roomType._id,
            date: currentDate
          }).session(session);
          
          if (existingRecord) {
            continue; // Skip if already exists
          }
          
          // Get current bookings for this date and room type
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
            totalRooms: totalRoomsCount,
            availableRooms: totalRoomsCount - soldRooms,
            soldRooms: soldRooms,
            blockedRooms: 0,
            overbookedRooms: Math.max(0, soldRooms - totalRoomsCount), // Handle existing overbookings
            baseRate: roomType.basePrice,
            sellingRate: roomType.basePrice,
            currency: 'INR',
            needsSync: true
          };
          
          availabilityRecords.push(availabilityRecord);
          
          // Add reservation tracking
          if (bookingsForDate.length > 0) {
            availabilityRecord.reservations = bookingsForDate.map(booking => ({
              bookingId: booking._id,
              roomsReserved: booking.rooms.length,
              source: booking.source || 'direct',
              reservedAt: booking.createdAt
            }));
          }
        }
        
        // Batch insert availability records
        if (availabilityRecords.length > 0) {
          const inserted = await RoomAvailability.insertMany(availabilityRecords, { 
            session,
            ordered: false // Continue on duplicates
          });
          
          totalCreated += inserted.length;
          
          // Log creation in audit log
          await AuditLog.logChange({
            hotelId: roomType.hotelId,
            tableName: 'RoomAvailability',
            recordId: roomType._id,
            changeType: 'create',
            source: 'migration',
            newValues: {
              roomTypeName: roomType.name,
              recordsCreated: inserted.length,
              dateRange: {
                start: startDate,
                end: endDate
              }
            },
            metadata: {
              batchId,
              tags: ['migration', 'room-availability'],
              priority: 'high'
            }
          });
          
          console.log(`✅ Created ${inserted.length} availability records for ${roomType.name}`);
        }
      }
      
      await session.commitTransaction();
      
      console.log(`🎉 Successfully created ${totalCreated} room availability records`);
      
      return {
        success: true,
        totalCreated,
        dateRange: { startDate, monthsAhead },
        batchId
      };
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
    
  } catch (error) {
    console.error('❌ Room Availability Creation failed:', error);
    throw error;
  }
}

export async function rollbackRoomAvailability(batchId) {
  console.log(`🔄 Rolling back Room Availability Creation (batch: ${batchId})...`);
  
  try {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Delete availability records created by this batch
      const deletedResult = await RoomAvailability.deleteMany({
        inventoryId: { $regex: `^AVAIL_.*` } // Delete only migration-created records
      }).session(session);
      
      // Delete related audit logs
      await AuditLog.deleteMany({
        'metadata.batchId': batchId
      }).session(session);
      
      await session.commitTransaction();
      
      console.log(`✅ Rolled back ${deletedResult.deletedCount} availability records`);
      return { success: true, deletedCount: deletedResult.deletedCount };
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
    
  } catch (error) {
    console.error('❌ Room Availability Rollback failed:', error);
    throw error;
  }
}

export async function verifyRoomAvailability(hotelId = null) {
  console.log('🔍 Verifying Room Availability Data...');
  
  const query = hotelId ? { hotelId } : {};
  
  const stats = await RoomAvailability.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$hotelId',
        totalRecords: { $sum: 1 },
        dateRange: {
          $push: {
            min: { $min: '$date' },
            max: { $max: '$date' }
          }
        },
        totalRooms: { $sum: '$totalRooms' },
        totalAvailable: { $sum: '$availableRooms' },
        totalSold: { $sum: '$soldRooms' }
      }
    }
  ]);
  
  const roomTypesCovered = await RoomAvailability.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$roomTypeId',
        recordCount: { $sum: 1 }
      }
    }
  ]);
  
  const results = {
    hotelStats: stats,
    roomTypesCovered: roomTypesCovered.length,
    totalAvailabilityRecords: stats.reduce((sum, hotel) => sum + hotel.totalRecords, 0)
  };
  
  console.log('📋 Availability Verification Results:', results);
  return results;
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const options = {
      startDate: new Date(),
      monthsAhead: 12
    };
    
    await createRoomAvailabilityData(options);
    await verifyRoomAvailability();
    console.log('✅ Room Availability Creation completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Room Availability Creation failed:', error);
    process.exit(1);
  }
}
