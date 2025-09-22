const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management?retryWrites=true&w=majority&appName=Cluster0';

// Define schemas directly for testing
const roomSchema = new mongoose.Schema({
  roomNumber: String,
  type: String,
  status: String,
  hotelId: mongoose.Schema.Types.ObjectId,
  isActive: Boolean,
  floor: Number
});

const tapeChartViewSchema = new mongoose.Schema({
  viewId: String,
  viewName: String,
  viewType: String,
  isSystemDefault: Boolean,
  createdBy: mongoose.Schema.Types.ObjectId
});

const Room = mongoose.model('Room', roomSchema);
const TapeChartView = mongoose.model('TapeChartView', tapeChartViewSchema);

async function debugTapeChart() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // 1. Check total rooms
    console.log('=== ROOM ANALYSIS ===');
    const totalRooms = await Room.countDocuments({});
    console.log(`📊 Total rooms in database: ${totalRooms}`);

    const activeRooms = await Room.countDocuments({ isActive: true });
    console.log(`✅ Active rooms: ${activeRooms}`);

    const inactiveRooms = await Room.countDocuments({ isActive: false });
    console.log(`❌ Inactive rooms: ${inactiveRooms}`);

    // 2. Check room distribution by hotel
    console.log('\n=== ROOMS BY HOTEL ===');
    const roomsByHotel = await Room.aggregate([
      {
        $group: {
          _id: '$hotelId',
          count: { $sum: 1 },
          activeCount: {
            $sum: { $cond: ['$isActive', 1, 0] }
          }
        }
      }
    ]);

    for (const hotel of roomsByHotel) {
      console.log(`🏨 Hotel ID: ${hotel._id}`);
      console.log(`   Total rooms: ${hotel.count}`);
      console.log(`   Active rooms: ${hotel.activeCount}`);
    }

    // 3. Check room status distribution
    console.log('\n=== ROOM STATUS DISTRIBUTION ===');
    const statusDistribution = await Room.aggregate([
      {
        $match: { isActive: true }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    for (const status of statusDistribution) {
      console.log(`📍 Status "${status._id || 'undefined'}": ${status.count} rooms`);
    }

    // 4. Check first 10 rooms
    console.log('\n=== FIRST 10 ROOMS (SAMPLE) ===');
    const sampleRooms = await Room.find({ isActive: true })
      .limit(10)
      .select('roomNumber type status floor hotelId')
      .sort({ roomNumber: 1 });

    for (const room of sampleRooms) {
      console.log(`Room ${room.roomNumber}: Type=${room.type}, Status=${room.status}, Floor=${room.floor}`);
    }

    // 5. Check TapeChart views
    console.log('\n=== TAPECHART VIEWS ===');
    const tapeChartViews = await TapeChartView.find({});
    console.log(`📊 Total TapeChart views: ${tapeChartViews.length}`);

    for (const view of tapeChartViews) {
      console.log(`📍 View: ${view.viewName} (${view.viewType}) - Default: ${view.isSystemDefault}`);
    }

    // 6. Check room configurations (if they exist)
    const RoomConfiguration = mongoose.models.RoomConfiguration || mongoose.model('RoomConfiguration', new mongoose.Schema({
      roomId: mongoose.Schema.Types.ObjectId,
      roomNumber: String,
      floor: Number,
      isActive: Boolean
    }));

    const roomConfigs = await RoomConfiguration.countDocuments({});
    console.log(`\n📊 Room Configurations in database: ${roomConfigs}`);

    // 7. Check if there's a limit being applied somewhere
    console.log('\n=== CHECKING FOR LIMITS ===');
    const distinctFloors = await Room.distinct('floor', { isActive: true });
    console.log(`📊 Distinct floors: ${distinctFloors.length} - ${distinctFloors.join(', ')}`);

    const roomsPerFloor = await Room.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$floor',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    console.log('\n=== ROOMS PER FLOOR ===');
    for (const floor of roomsPerFloor) {
      console.log(`Floor ${floor._id || 'undefined'}: ${floor.count} rooms`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

debugTapeChart();