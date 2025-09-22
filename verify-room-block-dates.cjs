const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management?retryWrites=true&w=majority&appName=Cluster0';

// Use the actual RoomBlock schema structure from TapeChart
const tapeChartSchema = new mongoose.Schema({
  RoomBlock: {
    type: mongoose.Schema,
    default: {}
  }
}, { strict: false });

const TapeChart = mongoose.model('TapeChart', tapeChartSchema);

async function verifyRoomBlockDates() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('=== ROOM BLOCK DATE ANALYSIS ===\n');

    // Try to find the correct collection
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📋 Available Collections:');
    collections.forEach(col => {
      if (col.name.toLowerCase().includes('room') || col.name.toLowerCase().includes('block')) {
        console.log(`   - ${col.name} ⭐`);
      } else {
        console.log(`   - ${col.name}`);
      }
    });

    // Try different possible collection names
    const possibleCollections = ['roomblocks', 'room_blocks', 'tapecharts', 'RoomBlocks'];
    let roomBlocks = [];

    for (const collectionName of possibleCollections) {
      try {
        const collection = mongoose.connection.db.collection(collectionName);
        const blocks = await collection.find({}).toArray();
        if (blocks.length > 0) {
          console.log(`\n✅ Found ${blocks.length} room blocks in collection: ${collectionName}`);
          roomBlocks = blocks;
          break;
        }
      } catch (error) {
        // Collection doesn't exist, continue
      }
    }

    if (roomBlocks.length === 0) {
      // Try using the TapeChart collection and look for RoomBlock subdocuments
      const tapeChartDocs = await mongoose.connection.db.collection('tapecharts').find({}).toArray();
      console.log(`\n📊 TapeChart documents found: ${tapeChartDocs.length}`);

      for (const doc of tapeChartDocs) {
        if (doc.RoomBlock || doc.roomBlocks || doc.blocks) {
          console.log(`   Document ${doc._id} has room block data`);
          console.log(`   Structure:`, Object.keys(doc));
        }
      }
    }

    if (roomBlocks.length > 0) {
      console.log('\n📅 ROOM BLOCK DATE ANALYSIS:');
      const today = new Date();
      console.log(`Today's date: ${today.toDateString()}\n`);

      for (const block of roomBlocks) {
        const startDate = new Date(block.startDate);
        const endDate = new Date(block.endDate);

        const isCurrentlyActive = startDate <= today && endDate >= today;
        const isFutureActive = startDate > today && block.status === 'active';

        console.log(`🏨 ${block.blockName || 'Unnamed Block'}`);
        console.log(`   Status: ${block.status}`);
        console.log(`   Start: ${startDate.toDateString()}`);
        console.log(`   End: ${endDate.toDateString()}`);
        console.log(`   Currently Active (happening now): ${isCurrentlyActive ? '✅ YES' : '❌ NO'}`);
        console.log(`   Future Active: ${isFutureActive ? '✅ YES' : '❌ NO'}`);
        console.log('');
      }

      // Apply dashboard logic
      const currentlyActiveBlocks = roomBlocks.filter(block => {
        const startDate = new Date(block.startDate);
        const endDate = new Date(block.endDate);
        return block.status === 'active' && startDate <= today && endDate >= today;
      });

      const allActiveBlocks = roomBlocks.filter(block => block.status === 'active');

      console.log('📊 COMPARISON RESULTS:');
      console.log(`   Dashboard Logic (currently active): ${currentlyActiveBlocks.length} blocks`);
      console.log(`   Management Page Logic (all active): ${allActiveBlocks.length} blocks`);
      console.log(`   Dashboard shows 0 because: ${currentlyActiveBlocks.length === 0 ? 'No blocks are currently active' : 'Unknown reason'}`);

      if (currentlyActiveBlocks.length === 0 && allActiveBlocks.length > 0) {
        console.log('\n✅ EXPLANATION CONFIRMED:');
        console.log('   - Dashboard: Shows 0 because no room blocks are happening RIGHT NOW');
        console.log('   - Management: Shows 2+ because it includes all future active blocks');
        console.log('   - Both are correct for their respective contexts');
      }

    } else {
      console.log('\n❌ No room blocks found in any collection');
      console.log('   This suggests the data might be in a different structure or location');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

verifyRoomBlockDates();