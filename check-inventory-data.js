import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Import models
import './src/models/Hotel.js';
import './src/models/Room.js';
import './src/models/RoomType.js';
import RoomAvailability from './src/models/RoomAvailability.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hotel-management';

async function checkInventoryData() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if any inventory data exists
    const inventoryCount = await RoomAvailability.countDocuments();
    console.log(`\n📊 Total Inventory Records: ${inventoryCount}`);

    if (inventoryCount === 0) {
      console.log('⚠️ No inventory data found in database!');
      console.log('\n🔍 Checking for room types to create inventory...');
      
      // Get room types to create inventory for
      const RoomType = mongoose.model('RoomType');
      const roomTypes = await RoomType.find({ isActive: true }).limit(5);
      
      if (roomTypes.length === 0) {
        console.log('❌ No active room types found! Cannot create inventory.');
        return;
      }

      console.log(`\n✅ Found ${roomTypes.length} room types`);
      roomTypes.forEach(rt => {
        console.log(`  - ${rt.name} (${rt.code})`);
      });

      // Ask if we should create sample inventory
      console.log('\n💡 Would you like to create sample inventory data?');
      console.log('   Run: node seed-inventory-data.js');
      
    } else {
      // Show sample of existing inventory
      console.log('\n📋 Sample Inventory Data:');
      
      const samples = await RoomAvailability.find()
        .populate('roomTypeId', 'name code')
        .limit(5)
        .sort({ date: -1 });
      
      samples.forEach(inv => {
        const roomType = inv.roomTypeId;
        console.log(`\n  Date: ${inv.date.toISOString().split('T')[0]}`);
        console.log(`  Room Type: ${roomType?.name || 'Unknown'} (${roomType?.code || 'N/A'})`);
        console.log(`  Total Rooms: ${inv.totalRooms}`);
        console.log(`  Available: ${inv.availableRooms}`);
        console.log(`  Sold: ${inv.soldRooms}`);
        console.log(`  Base Rate: ${inv.currency} ${inv.baseRate}`);
        console.log(`  Stop Sell: ${inv.stopSellFlag ? 'Yes' : 'No'}`);
      });

      // Check date range of inventory
      const oldest = await RoomAvailability.findOne().sort({ date: 1 });
      const newest = await RoomAvailability.findOne().sort({ date: -1 });
      
      if (oldest && newest) {
        console.log('\n📅 Date Range:');
        console.log(`  Oldest: ${oldest.date.toISOString().split('T')[0]}`);
        console.log(`  Newest: ${newest.date.toISOString().split('T')[0]}`);
      }

      // Check for today's inventory
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayInventory = await RoomAvailability.countDocuments({
        date: {
          $gte: today,
          $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        }
      });

      console.log(`\n📆 Today's Inventory Records: ${todayInventory}`);
      
      if (todayInventory === 0) {
        console.log('⚠️ No inventory data for today! You may need to generate current/future dates.');
      }

      // Check future inventory (next 30 days)
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      
      const futureInventory = await RoomAvailability.countDocuments({
        date: {
          $gte: today,
          $lte: futureDate
        }
      });

      console.log(`📈 Next 30 Days Inventory Records: ${futureInventory}`);
      
      if (futureInventory === 0) {
        console.log('⚠️ No future inventory data! Calendar will appear empty.');
        console.log('💡 Run: node seed-inventory-data.js to create future inventory');
      }
    }

    // Check by hotel
    console.log('\n🏨 Inventory by Hotel:');
    const hotelGroups = await RoomAvailability.aggregate([
      {
        $group: {
          _id: '$hotelId',
          count: { $sum: 1 },
          minDate: { $min: '$date' },
          maxDate: { $max: '$date' }
        }
      }
    ]);

    if (hotelGroups.length === 0) {
      console.log('  No inventory data grouped by hotel');
    } else {
      for (const group of hotelGroups) {
        console.log(`\n  Hotel ID: ${group._id}`);
        console.log(`  Records: ${group.count}`);
        console.log(`  Date Range: ${group.minDate?.toISOString().split('T')[0]} to ${group.maxDate?.toISOString().split('T')[0]}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Database connection closed');
  }
}

// Run the check
checkInventoryData();