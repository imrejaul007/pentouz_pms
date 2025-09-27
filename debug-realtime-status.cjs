const mongoose = require('mongoose');

// Import Room model properly
mongoose.connect('mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management?retryWrites=true&w=majority&appName=Cluster0')
.then(async () => {
  console.log('Connected to MongoDB - Testing getRoomsWithRealTimeStatus...');

  const Hotel = mongoose.model('Hotel', { name: String });
  const hotel = await Hotel.findOne();
  const hotelId = hotel._id;

  // Create Room model with the actual schema
  const roomSchema = new mongoose.Schema({
    hotelId: mongoose.Schema.ObjectId,
    roomNumber: String,
    type: String,
    baseRate: Number,
    currentRate: Number,
    status: String,
    floor: Number,
    capacity: Number,
    amenities: [String],
    images: [String],
    description: String,
    isActive: Boolean,
    lastCleaned: Date,
    maintenanceNotes: String
  }, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  });

  const bookingSchema = new mongoose.Schema({
    hotelId: mongoose.Schema.ObjectId,
    status: String,
    checkIn: Date,
    checkOut: Date,
    rooms: [{ roomId: mongoose.Schema.Types.ObjectId }]
  });

  const maintenanceTaskSchema = new mongoose.Schema({
    roomId: mongoose.Schema.Types.ObjectId,
    status: String
  });

  const housekeepingSchema = new mongoose.Schema({
    roomId: mongoose.Schema.Types.ObjectId,
    status: String
  });

  // Mock the static method getRoomsWithRealTimeStatus
  roomSchema.statics.getRoomsWithRealTimeStatus = async function(hotelId, options = {}) {
    const Booking = mongoose.model('Booking');
    const MaintenanceTask = mongoose.model('MaintenanceTask');
    const Housekeeping = mongoose.model('Housekeeping');

    const {
      type,
      floor,
      page = 1,
      limit = 100
    } = options;

    // Build base query
    const query = {
      hotelId,
      isActive: true
    };

    if (type) query.type = type;
    if (floor) query.floor = floor;

    // Get all rooms for the hotel
    const rooms = await this.find(query)
      .sort({ floor: 1, roomNumber: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    if (!rooms.length) return { rooms: [], total: 0 };

    // Get current date
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    console.log('Date calculation:', {
      now: now.toISOString(),
      today: today.toISOString(),
      tomorrow: tomorrow.toISOString()
    });

    // Find all current bookings that affect these rooms
    const currentBookings = await Booking.find({
      hotelId,
      status: { $in: ['confirmed', 'checked_in'] },
      checkOut: { $gte: today }, // Haven't checked out yet
      checkIn: { $lte: tomorrow } // Started or starting soon
    }).select('rooms.roomId status checkIn checkOut');

    console.log('Current bookings found:', currentBookings.length);

    // Create a map of room occupancy
    const roomOccupancyMap = new Map();

    currentBookings.forEach(booking => {
      booking.rooms.forEach(roomBooking => {
        const roomId = roomBooking.roomId.toString();
        const checkIn = new Date(booking.checkIn);
        const checkOut = new Date(booking.checkOut);

        let computedStatus = 'occupied';

        console.log(`Booking ${booking._id}:`, {
          status: booking.status,
          checkIn: checkIn.toISOString(),
          checkOut: checkOut.toISOString(),
          checkInVsToday: checkIn <= today ? 'past/today' : 'future',
          roomId: roomId
        });

        // More granular status based on dates and booking status
        if (booking.status === 'checked_in') {
          computedStatus = 'occupied';
        } else if (booking.status === 'confirmed') {
          if (checkIn <= today) {
            computedStatus = 'occupied'; // Should be checked in
          } else {
            computedStatus = 'reserved'; // Reserved for future
          }
        }

        console.log(`  -> computedStatus: ${computedStatus}`);

        roomOccupancyMap.set(roomId, {
          status: computedStatus,
          bookingId: booking._id,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          bookingStatus: booking.status
        });
      });
    });

    // Add computed status to each room
    const roomsWithStatus = rooms.map(room => {
      const roomObj = room.toObject();
      const roomId = room._id.toString();
      const occupancy = roomOccupancyMap.get(roomId);

      if (occupancy) {
        roomObj.computedStatus = occupancy.status;
        roomObj.currentBooking = {
          bookingId: occupancy.bookingId,
          checkIn: occupancy.checkIn,
          checkOut: occupancy.checkOut,
          status: occupancy.bookingStatus
        };
      } else if (room.status === 'out_of_order') {
        roomObj.computedStatus = 'out_of_order';
      } else {
        roomObj.computedStatus = 'vacant';
      }

      return roomObj;
    });

    // Get total count for pagination
    const total = await this.countDocuments(query);

    return {
      rooms: roomsWithStatus,
      total,
      pagination: {
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  };

  // Register models
  const Room = mongoose.model('Room', roomSchema);
  const Booking = mongoose.model('Booking', bookingSchema);
  const MaintenanceTask = mongoose.model('MaintenanceTask', maintenanceTaskSchema);
  const Housekeeping = mongoose.model('Housekeeping', housekeepingSchema);

  // Test the method
  console.log('\n=== TESTING getRoomsWithRealTimeStatus ===');
  const result = await Room.getRoomsWithRealTimeStatus(hotelId, { limit: 20 });

  console.log(`\nTotal rooms returned: ${result.rooms.length}`);
  console.log('Room status breakdown:');

  const statusCounts = {};
  result.rooms.forEach(room => {
    const status = room.computedStatus || room.status;
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  // Show rooms with reserved status
  const reservedRooms = result.rooms.filter(r => (r.computedStatus || r.status) === 'reserved');
  console.log(`\nReserved rooms (${reservedRooms.length}):`);
  reservedRooms.forEach(room => {
    console.log(`  Room ${room.roomNumber}: computedStatus=${room.computedStatus}, status=${room.status}`);
    if (room.currentBooking) {
      console.log(`    Booking: ${room.currentBooking.status} from ${room.currentBooking.checkIn} to ${room.currentBooking.checkOut}`);
    }
  });

  mongoose.disconnect();
})
.catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});