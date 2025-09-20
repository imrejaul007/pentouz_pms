import mongoose from 'mongoose';
import 'dotenv/config';
import Room from '../models/Room.js';
import RoomType from '../models/RoomType.js';
import RoomAvailability from '../models/RoomAvailability.js';
import AuditLog from '../models/AuditLog.js';

class OTAMigrationScript {
  constructor() {
    this.results = {
      roomTypes: { created: 0, updated: 0, errors: [] },
      rooms: { migrated: 0, errors: [] },
      inventory: { created: 0, errors: [] },
      audit: { logged: 0, errors: [] }
    };
  }

  async migrate(hotelId = null) {
    try {
      console.log('🚀 Starting OTA-Ready Migration...\n');
      
      await mongoose.connect(process.env.MONGO_URI);
      console.log('✅ Connected to MongoDB\n');

      // Step 1: Create Room Types from legacy room types
      await this.createRoomTypesFromLegacy(hotelId);
      
      // Step 2: Migrate existing rooms to use room types
      await this.migrateRoomsToRoomTypes(hotelId);
      
      // Step 3: Create initial inventory records
      await this.createInitialInventory(hotelId);
      
      // Step 4: Log migration audit trail
      await this.logMigrationAudit(hotelId);
      
      this.printMigrationSummary();
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    } finally {
      await mongoose.disconnect();
      console.log('\n✅ Database connection closed');
    }
  }

  async createRoomTypesFromLegacy(hotelId) {
    console.log('📝 Step 1: Creating Room Types from legacy data...');
    
    try {
      const hotels = hotelId ? [{ _id: hotelId }] : await Room.distinct('hotelId');
      
      for (const hotel of (Array.isArray(hotels) ? hotels.map(id => ({ _id: id })) : hotels)) {
        // Get unique legacy room types for this hotel
        const legacyTypes = await Room.distinct('type', { 
          hotelId: hotel._id,
          type: { $exists: true, $ne: null }
        });

        console.log(`  Hotel ${hotel._id}: Found ${legacyTypes.length} legacy room types`);

        for (const legacyType of legacyTypes) {
          try {
            // Check if room type already exists
            let roomType = await RoomType.findOne({
              hotelId: hotel._id,
              legacyType
            });

            if (roomType) {
              console.log(`    ✓ Room type '${legacyType}' already exists`);
              this.results.roomTypes.updated++;
              continue;
            }

            // Get sample room to determine base price and capacity
            const sampleRoom = await Room.findOne({
              hotelId: hotel._id,
              type: legacyType,
              isActive: true
            });

            // Create new room type
            roomType = new RoomType({
              hotelId: hotel._id,
              name: this.getLegacyTypeName(legacyType),
              code: this.generateRoomTypeCode(legacyType),
              maxOccupancy: sampleRoom?.capacity || this.getDefaultOccupancy(legacyType),
              basePrice: sampleRoom?.baseRate || this.getDefaultPrice(legacyType),
              description: `Migrated from legacy room type: ${legacyType}`,
              legacyType,
              isActive: true
            });

            await roomType.save();
            
            console.log(`    ✅ Created room type: ${roomType.name} (${roomType.code})`);
            this.results.roomTypes.created++;

          } catch (error) {
            console.error(`    ❌ Error creating room type '${legacyType}':`, error.message);
            this.results.roomTypes.errors.push({
              hotelId: hotel._id,
              legacyType,
              error: error.message
            });
          }
        }
      }

      console.log(`✅ Room Types: Created ${this.results.roomTypes.created}, Updated ${this.results.roomTypes.updated}, Errors: ${this.results.roomTypes.errors.length}\n`);

    } catch (error) {
      console.error('❌ Error in createRoomTypesFromLegacy:', error);
      throw error;
    }
  }

  async migrateRoomsToRoomTypes(hotelId) {
    console.log('🏠 Step 2: Migrating rooms to use room types...');

    try {
      const filter = { 
        roomTypeId: { $exists: false },
        type: { $exists: true, $ne: null }
      };
      
      if (hotelId) {
        filter.hotelId = hotelId;
      }

      const roomsToMigrate = await Room.find(filter);
      console.log(`  Found ${roomsToMigrate.length} rooms to migrate`);

      for (const room of roomsToMigrate) {
        try {
          // Find corresponding room type
          const roomType = await RoomType.findOne({
            hotelId: room.hotelId,
            legacyType: room.type
          });

          if (!roomType) {
            throw new Error(`Room type not found for legacy type: ${room.type}`);
          }

          // Update room with room type ID
          room.roomTypeId = roomType._id;
          await room.save();

          this.results.rooms.migrated++;

        } catch (error) {
          console.error(`    ❌ Error migrating room ${room.roomNumber}:`, error.message);
          this.results.rooms.errors.push({
            roomId: room._id,
            roomNumber: room.roomNumber,
            error: error.message
          });
        }
      }

      console.log(`✅ Rooms: Migrated ${this.results.rooms.migrated}, Errors: ${this.results.rooms.errors.length}\n`);

    } catch (error) {
      console.error('❌ Error in migrateRoomsToRoomTypes:', error);
      throw error;
    }
  }

  async createInitialInventory(hotelId) {
    console.log('📊 Step 3: Creating initial inventory records...');

    try {
      const filter = {};
      if (hotelId) {
        filter.hotelId = hotelId;
      }

      const roomTypes = await RoomType.find(filter);
      console.log(`  Found ${roomTypes.length} room types`);

      const currentDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 3); // Create 3 months ahead

      for (const roomType of roomTypes) {
        try {
          // Count rooms of this type
          const totalRooms = await Room.countDocuments({
            hotelId: roomType.hotelId,
            roomTypeId: roomType._id,
            isActive: true
          });

          if (totalRooms === 0) {
            console.log(`    ⚠️  No rooms found for room type: ${roomType.name}`);
            continue;
          }

          // Create inventory for next 3 months
          const inventoryRecords = [];
          for (let date = new Date(currentDate); date <= endDate; date.setDate(date.getDate() + 1)) {
            // Check if inventory already exists for this date
            const existing = await RoomAvailability.findOne({
              hotelId: roomType.hotelId,
              roomTypeId: roomType._id,
              date: new Date(date)
            });

            if (existing) {
              continue; // Skip if already exists
            }

            inventoryRecords.push({
              hotelId: roomType.hotelId,
              roomTypeId: roomType._id,
              date: new Date(date),
              totalRooms,
              availableRooms: totalRooms,
              soldRooms: 0,
              blockedRooms: 0,
              baseRate: roomType.basePrice,
              sellingRate: roomType.basePrice,
              currency: 'INR',
              needsSync: false // Initial data doesn't need sync
            });
          }

          if (inventoryRecords.length > 0) {
            await RoomAvailability.insertMany(inventoryRecords);
            console.log(`    ✅ Created ${inventoryRecords.length} inventory records for ${roomType.name}`);
            this.results.inventory.created += inventoryRecords.length;
          } else {
            console.log(`    ✓ Inventory already exists for ${roomType.name}`);
          }

        } catch (error) {
          console.error(`    ❌ Error creating inventory for ${roomType.name}:`, error.message);
          this.results.inventory.errors.push({
            roomTypeId: roomType._id,
            roomTypeName: roomType.name,
            error: error.message
          });
        }
      }

      console.log(`✅ Inventory: Created ${this.results.inventory.created} records, Errors: ${this.results.inventory.errors.length}\n`);

    } catch (error) {
      console.error('❌ Error in createInitialInventory:', error);
      throw error;
    }
  }

  async logMigrationAudit(hotelId) {
    console.log('📋 Step 4: Logging migration audit trail...');

    try {
      const migrationSummary = {
        roomTypesCreated: this.results.roomTypes.created,
        roomsMigrated: this.results.rooms.migrated,
        inventoryRecordsCreated: this.results.inventory.created,
        totalErrors: this.results.roomTypes.errors.length + 
                     this.results.rooms.errors.length + 
                     this.results.inventory.errors.length
      };

      const auditLog = await AuditLog.logChange({
        hotelId: hotelId || null,
        tableName: 'Migration',
        recordId: 'OTA_MIGRATION_' + Date.now(),
        changeType: 'create',
        newValues: migrationSummary,
        source: 'migration',
        metadata: {
          migrationDate: new Date(),
          scriptVersion: '1.0.0',
          tags: ['ota_migration', 'room_types', 'inventory']
        }
      });

      console.log(`✅ Migration audit logged with ID: ${auditLog.logId}\n`);
      this.results.audit.logged++;

    } catch (error) {
      console.error('❌ Error logging migration audit:', error.message);
      this.results.audit.errors.push(error.message);
    }
  }

  // Helper methods
  getLegacyTypeName(legacyType) {
    const names = {
      'single': 'Single Room',
      'double': 'Double Room',
      'suite': 'Suite',
      'deluxe': 'Deluxe Room'
    };
    
    return names[legacyType] || `${legacyType.charAt(0).toUpperCase() + legacyType.slice(1)} Room`;
  }

  generateRoomTypeCode(legacyType) {
    const codes = {
      'single': 'SGL',
      'double': 'DBL',
      'suite': 'STE',
      'deluxe': 'DLX'
    };
    
    return codes[legacyType] || legacyType.substring(0, 3).toUpperCase();
  }

  getDefaultOccupancy(legacyType) {
    const occupancies = {
      'single': 1,
      'double': 2,
      'suite': 4,
      'deluxe': 3
    };
    
    return occupancies[legacyType] || 2;
  }

  getDefaultPrice(legacyType) {
    const prices = {
      'single': 1500,
      'double': 2000,
      'suite': 4000,
      'deluxe': 3000
    };
    
    return prices[legacyType] || 2000;
  }

  printMigrationSummary() {
    console.log('\n' + '='.repeat(50));
    console.log('🎉 OTA MIGRATION COMPLETED');
    console.log('='.repeat(50));
    
    console.log('\n📊 MIGRATION SUMMARY:');
    console.log(`✅ Room Types Created: ${this.results.roomTypes.created}`);
    console.log(`✅ Room Types Updated: ${this.results.roomTypes.updated}`);
    console.log(`✅ Rooms Migrated: ${this.results.rooms.migrated}`);
    console.log(`✅ Inventory Records Created: ${this.results.inventory.created}`);
    console.log(`✅ Audit Logs Created: ${this.results.audit.logged}`);
    
    const totalErrors = this.results.roomTypes.errors.length + 
                       this.results.rooms.errors.length + 
                       this.results.inventory.errors.length + 
                       this.results.audit.errors.length;
    
    if (totalErrors > 0) {
      console.log(`\n⚠️  ERRORS (${totalErrors} total):`);
      
      if (this.results.roomTypes.errors.length > 0) {
        console.log('  Room Type Errors:', this.results.roomTypes.errors.length);
      }
      if (this.results.rooms.errors.length > 0) {
        console.log('  Room Migration Errors:', this.results.rooms.errors.length);
      }
      if (this.results.inventory.errors.length > 0) {
        console.log('  Inventory Creation Errors:', this.results.inventory.errors.length);
      }
    } else {
      console.log('\n🎯 Migration completed without errors!');
    }

    console.log('\n🚀 NEXT STEPS:');
    console.log('1. Test new availability endpoints with room type IDs');
    console.log('2. Update frontend to use new room type management');
    console.log('3. Create rate plans using the rate management system');
    console.log('4. Set up OTA channel configurations');
    console.log('5. Test booking flow with new inventory system');
    
    console.log('\n' + '='.repeat(50));
  }
}

// Command line usage
const args = process.argv.slice(2);
const hotelId = args[0] || null;

// Run migration if this file is executed directly
if (process.argv[1] && process.argv[1].includes('migrateToOTAReady.js')) {
  const migration = new OTAMigrationScript();
  
  migration.migrate(hotelId)
    .then(() => {
      console.log('\n🎉 Migration script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Migration script failed:', error);
      process.exit(1);
    });
}

export default OTAMigrationScript;