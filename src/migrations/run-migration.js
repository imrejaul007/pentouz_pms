import mongoose from 'mongoose';
import { migrateRoomTypes, rollbackRoomTypes, verifyRoomTypesMigration } from './001-migrate-room-types.js';
import { createRoomAvailabilityData, rollbackRoomAvailability, verifyRoomAvailability } from './002-create-room-availability.js';

/**
 * Master Migration Script
 * Orchestrates the complete migration to channel management data model
 */

const MIGRATION_CONFIG = {
  connectDB: true,
  runVerifications: true,
  createAvailabilityMonths: 12,
  backupBeforeMigration: true
};

async function connectDatabase() {
  try {
    // Load environment variables
    const path = await import('path');
    const { config } = await import('dotenv');
    const { fileURLToPath } = await import('url');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const envPath = path.resolve(__dirname, '../../.env');
    config({ path: envPath });
    
    const mongoURI = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoURI) {
      throw new Error('No MongoDB URI found in environment variables');
    }
    
    await mongoose.connect(mongoURI);
    console.log('📡 Connected to Production MongoDB Atlas');
    console.log(`📍 Database: ${mongoose.connection.name}`);
    console.log('⚠️  WARNING: Using PRODUCTION database with real data!');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

async function createDatabaseBackup() {
  console.log('💾 Creating database backup (recommended before migration)...');
  console.log('⚠️  Please create a database backup manually before proceeding');
  console.log('   Example: mongodump --uri="your-mongodb-uri" --out=./backup');
  
  // Wait for user confirmation
  if (process.stdin.isTTY) {
    const { default: readline } = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      rl.question('Have you created a backup? (y/n): ', (answer) => {
        rl.close();
        if (answer.toLowerCase() !== 'y') {
          console.log('🛑 Migration cancelled. Please create a backup first.');
          process.exit(1);
        }
        resolve();
      });
    });
  }
}

export async function runFullMigration(options = {}) {
  const config = { ...MIGRATION_CONFIG, ...options };
  
  console.log('🚀 Starting Full Channel Management Migration');
  console.log('================================================');
  console.log('This migration will:');
  console.log('1. Create RoomType entities from existing room data');
  console.log('2. Create date-level room availability records');
  console.log('3. Prepare your system for OTA channel integration');
  console.log('================================================\n');
  
  const migrationResults = {
    startTime: new Date(),
    steps: [],
    success: false,
    error: null
  };
  
  try {
    // Connect to database
    if (config.connectDB) {
      await connectDatabase();
    }
    
    // Create backup prompt
    if (config.backupBeforeMigration) {
      await createDatabaseBackup();
    }
    
    // Step 1: Migrate Room Types
    console.log('\n📝 STEP 1: Migrating Room Types');
    console.log('================================');
    
    const roomTypesResult = await migrateRoomTypes();
    migrationResults.steps.push({
      step: 'room-types',
      success: roomTypesResult.success,
      details: roomTypesResult
    });
    
    if (config.runVerifications) {
      await verifyRoomTypesMigration();
    }
    
    // Step 2: Create Room Availability Data
    console.log('\n📅 STEP 2: Creating Room Availability Data');
    console.log('==========================================');
    
    const availabilityOptions = {
      startDate: new Date(),
      monthsAhead: config.createAvailabilityMonths
    };
    
    const availabilityResult = await createRoomAvailabilityData(availabilityOptions);
    migrationResults.steps.push({
      step: 'room-availability',
      success: availabilityResult.success,
      details: availabilityResult
    });
    
    if (config.runVerifications) {
      await verifyRoomAvailability();
    }
    
    // Step 3: Generate Summary Report
    console.log('\n📊 STEP 3: Migration Summary');
    console.log('============================');
    
    const summary = {
      roomTypesCreated: roomTypesResult.createdCount,
      availabilityRecordsCreated: availabilityResult.totalCreated,
      dateRangeCovered: {
        start: availabilityResult.dateRange.startDate,
        months: availabilityResult.dateRange.monthsAhead
      },
      nextSteps: [
        'Update Room model to reference RoomType',
        'Update booking logic to use RoomAvailability',
        'Configure channel mappings in admin panel',
        'Test OTA sync functionality'
      ]
    };
    
    migrationResults.endTime = new Date();
    migrationResults.duration = migrationResults.endTime - migrationResults.startTime;
    migrationResults.success = true;
    migrationResults.summary = summary;
    
    console.log('🎉 MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('===================================');
    console.log(`⏱️  Duration: ${Math.round(migrationResults.duration / 1000)}s`);
    console.log(`🏨 Room Types Created: ${summary.roomTypesCreated}`);
    console.log(`📅 Availability Records: ${summary.availabilityRecordsCreated}`);
    console.log(`📆 Date Range: ${summary.dateRangeCovered.months} months`);
    
    console.log('\n✨ WHAT\'S NEXT:');
    console.log('================');
    summary.nextSteps.forEach((step, index) => {
      console.log(`${index + 1}. ${step}`);
    });
    
    console.log('\n💡 Your system is now ready for OTA channel integration!');
    
    return migrationResults;
    
  } catch (error) {
    migrationResults.error = error;
    migrationResults.success = false;
    migrationResults.endTime = new Date();
    
    console.error('\n❌ MIGRATION FAILED');
    console.error('==================');
    console.error('Error:', error.message);
    console.error('\nMigration steps completed before failure:');
    migrationResults.steps.forEach(step => {
      const status = step.success ? '✅' : '❌';
      console.error(`${status} ${step.step}`);
    });
    
    console.error('\n🔄 To rollback this migration, run:');
    console.error('node rollback-migration.js');
    
    throw error;
  }
}

export async function rollbackFullMigration() {
  console.log('🔄 Starting Full Migration Rollback');
  console.log('===================================');
  
  try {
    if (MIGRATION_CONFIG.connectDB) {
      await connectDatabase();
    }
    
    console.log('⏪ Rolling back Room Availability data...');
    await rollbackRoomAvailability();
    
    console.log('⏪ Rolling back Room Types...');
    await rollbackRoomTypes();
    
    console.log('✅ Rollback completed successfully');
    
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  try {
    if (command === 'rollback') {
      await rollbackFullMigration();
    } else {
      await runFullMigration();
    }
    process.exit(0);
  } catch (error) {
    console.error('❌ Operation failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}
