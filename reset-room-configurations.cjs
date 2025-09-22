const mongoose = require('mongoose');
const crypto = require('crypto');

const MONGO_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management?retryWrites=true&w=majority&appName=Cluster0';

// Define schemas with configId
const roomSchema = new mongoose.Schema({
  roomNumber: String,
  type: String,
  status: String,
  hotelId: mongoose.Schema.Types.ObjectId,
  isActive: Boolean,
  floor: Number,
  building: String,
  wing: String
});

const roomConfigurationSchema = new mongoose.Schema({
  configId: { type: String, unique: true, required: true },
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  roomNumber: String,
  roomType: String,
  floor: Number,
  building: { type: String, default: 'Main' },
  wing: { type: String, default: 'A' },
  position: {
    row: Number,
    column: Number
  },
  displaySettings: {
    color: { type: String, default: '#3B82F6' },
    width: { type: Number, default: 120 },
    height: { type: Number, default: 60 },
    showRoomNumber: { type: Boolean, default: true },
    showGuestName: { type: Boolean, default: true },
    showRoomType: { type: Boolean, default: true }
  },
  isActive: { type: Boolean, default: true },
  sortOrder: Number,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Room = mongoose.model('Room', roomSchema);
const RoomConfiguration = mongoose.model('RoomConfiguration', roomConfigurationSchema);

async function resetRoomConfigurations() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Ask for confirmation
    console.log('⚠️  WARNING: This will delete all existing room configurations and recreate them.');
    console.log('📊 Proceeding in 3 seconds...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Delete all existing room configurations
    const deleteResult = await RoomConfiguration.deleteMany({});
    console.log(`🗑️  Deleted ${deleteResult.deletedCount} existing room configurations\n`);

    // Get all active rooms
    const rooms = await Room.find({ isActive: true }).sort({ floor: 1, roomNumber: 1 });
    console.log(`📊 Found ${rooms.length} active rooms`);

    // Create configurations for all rooms
    const configurationsToCreate = [];
    let sortOrder = 0;

    for (const room of rooms) {
      const row = Math.floor(sortOrder / 10);
      const column = sortOrder % 10;

      const newConfig = {
        configId: `config-${room.roomNumber}-${crypto.randomBytes(4).toString('hex')}`,
        roomId: room._id,
        roomNumber: room.roomNumber,
        roomType: room.type,
        floor: room.floor || 1,
        building: room.building || 'Main',
        wing: room.wing || getWingForFloor(room.floor),
        position: { row, column },
        displaySettings: {
          color: getColorByRoomType(room.type),
          width: 120,
          height: 60,
          showRoomNumber: true,
          showGuestName: true,
          showRoomType: true
        },
        isActive: true,
        sortOrder: sortOrder++
      };

      configurationsToCreate.push(newConfig);
    }

    if (configurationsToCreate.length > 0) {
      console.log(`\n📝 Creating ${configurationsToCreate.length} new room configurations...`);

      // Insert in batches of 10 to avoid overwhelming the database
      const batchSize = 10;
      for (let i = 0; i < configurationsToCreate.length; i += batchSize) {
        const batch = configurationsToCreate.slice(i, i + batchSize);
        try {
          await RoomConfiguration.insertMany(batch);
          console.log(`   ✅ Created batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(configurationsToCreate.length / batchSize)}`);
        } catch (batchError) {
          console.error(`   ❌ Error in batch ${Math.floor(i / batchSize) + 1}:`, batchError.message);
        }
      }

      console.log(`\n✅ Successfully created room configurations`);
    }

    // Verify the final count
    const finalConfigCount = await RoomConfiguration.countDocuments({});
    console.log(`\n📊 Final room configuration count: ${finalConfigCount}`);

    // Show sample of created configurations
    console.log('\n=== SAMPLE CONFIGURATIONS ===');
    const sampleConfigs = await RoomConfiguration.find({})
      .limit(10)
      .populate('roomId', 'roomNumber type status floor');

    for (const config of sampleConfigs) {
      console.log(`Room ${config.roomNumber}: Floor ${config.floor}, Wing ${config.wing}, Position (${config.position.row},${config.position.column})`);
    }

    // Show distribution
    console.log('\n=== CONFIGURATION DISTRIBUTION ===');
    const configsByFloor = await RoomConfiguration.aggregate([
      {
        $group: {
          _id: '$floor',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    for (const floor of configsByFloor) {
      console.log(`Floor ${floor._id}: ${floor.count} configurations`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

// Helper function to get wing based on floor
function getWingForFloor(floor) {
  if (!floor) return 'A';
  if (floor <= 3) return 'A';
  if (floor <= 6) return 'B';
  if (floor <= 9) return 'C';
  return 'D';
}

// Helper function to get color based on room type
function getColorByRoomType(roomType) {
  const colors = {
    'single': '#3B82F6',     // Blue
    'double': '#10B981',     // Green
    'suite': '#F59E0B',      // Amber
    'deluxe': '#8B5CF6',     // Purple
    'executive': '#EF4444',  // Red
    'presidential': '#EC4899' // Pink
  };
  return colors[roomType] || '#3B82F6';
}

resetRoomConfigurations();