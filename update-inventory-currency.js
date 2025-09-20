import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Import models
import RoomAvailability from './src/models/RoomAvailability.js';
import RoomType from './src/models/RoomType.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hotel-management';
const HOTEL_ID = '68bc094f80c86bfe258e172b';

async function updateInventoryCurrency() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log(`\n🏨 Updating inventory currency for hotel: ${HOTEL_ID}`);
    
    // Get current room types with their IDs and rates
    const roomTypes = await RoomType.find({ hotelId: HOTEL_ID });
    console.log(`📊 Found ${roomTypes.length} room types`);

    // Create mapping of old roomTypeIds to new ones
    const roomTypeMapping = {};
    roomTypes.forEach(rt => {
      console.log(`  - ${rt.name} (${rt.code}): ${rt._id} - ₹${rt.baseRate}`);
      roomTypeMapping[rt.code] = {
        id: rt._id,
        baseRate: rt.baseRate,
        name: rt.name
      };
    });

    // Get all inventory records for this hotel
    const inventoryRecords = await RoomAvailability.find({ hotelId: HOTEL_ID });
    console.log(`\n📦 Found ${inventoryRecords.length} inventory records to update`);

    let updated = 0;
    let errors = 0;

    for (const record of inventoryRecords) {
      try {
        // Get the room type this record belongs to
        const roomType = await RoomType.findById(record.roomTypeId);
        if (!roomType) {
          console.log(`⚠️ Skipping record - Room type not found: ${record.roomTypeId}`);
          continue;
        }

        // Update currency and rates based on current room type rates
        const newBaseRate = roomType.baseRate;
        let newSellingRate = record.sellingRate;

        // If selling rate is in USD, convert to INR proportionally
        if (record.currency === 'USD' && record.sellingRate) {
          // Calculate the premium/discount ratio and apply to new base rate
          const ratio = record.sellingRate / record.baseRate;
          newSellingRate = Math.round(newBaseRate * ratio);
        }

        await RoomAvailability.findByIdAndUpdate(record._id, {
          currency: 'INR',
          baseRate: newBaseRate,
          sellingRate: newSellingRate || newBaseRate
        });

        updated++;
        
        if (updated % 50 === 0) {
          console.log(`  ✅ Updated ${updated} records...`);
        }

      } catch (error) {
        console.log(`  ❌ Error updating record ${record._id}: ${error.message}`);
        errors++;
      }
    }

    console.log(`\n🎉 Currency update completed!`);
    console.log(`📊 Summary:`);
    console.log(`  - Total records processed: ${inventoryRecords.length}`);
    console.log(`  - Successfully updated: ${updated}`);
    console.log(`  - Errors: ${errors}`);

    // Verify the updates
    console.log('\n🔍 Verifying updates...');
    const sampleUpdated = await RoomAvailability.find({ 
      hotelId: HOTEL_ID, 
      currency: 'INR' 
    }).limit(3).populate('roomTypeId', 'name code');

    sampleUpdated.forEach((inv, index) => {
      console.log(`\n  ${index + 1}. ${inv.date.toISOString().split('T')[0]} - ${inv.roomTypeId?.name}`);
      console.log(`     - Currency: ${inv.currency}`);
      console.log(`     - Base Rate: ₹${inv.baseRate}`);
      console.log(`     - Selling Rate: ₹${inv.sellingRate}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Database connection closed');
  }
}

updateInventoryCurrency();