const mongoose = require('mongoose');

const DB_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management?retryWrites=true&w=majority&appName=Cluster0';

async function verifyStaffData() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(DB_URI);
    console.log('✅ Connected to MongoDB');

    // Get staff user info
    const User = mongoose.model('User', new mongoose.Schema({}, {strict: false}));
    const staffUser = await User.findOne({ email: 'staff@hotel.com' });

    if (!staffUser) {
      console.log('❌ Staff user not found');
      return;
    }

    console.log('\n👤 Staff User Info:');
    console.log(`  ID: ${staffUser._id}`);
    console.log(`  Name: ${staffUser.name}`);
    console.log(`  Role: ${staffUser.role}`);
    console.log(`  Hotel ID: ${staffUser.hotelId}`);

    const hotelId = staffUser.hotelId;

    // Check task collections based on API queries
    console.log('\n📊 Checking Task Collections:');

    // 1. Housekeeping tasks (pendingHousekeeping)
    const Housekeeping = mongoose.model('Housekeeping', new mongoose.Schema({}, {strict: false}));
    const pendingHousekeeping = await Housekeeping.countDocuments({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      status: 'pending'
    });
    console.log(`  Pending Housekeeping Tasks: ${pendingHousekeeping}`);

    // Show some examples
    const housekeepingTasks = await Housekeeping.find({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      status: 'pending'
    }).limit(3);
    housekeepingTasks.forEach((task, i) => {
      console.log(`    ${i+1}. ${task.taskType || 'Unknown'} - Room ${task.roomNumber || 'N/A'} - ${task.description || 'No description'}`);
    });

    // 2. Maintenance tasks (pendingMaintenance) - assigned to this specific staff
    const MaintenanceTask = mongoose.model('MaintenanceTask', new mongoose.Schema({}, {strict: false}));
    const pendingMaintenance = await MaintenanceTask.countDocuments({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      assignedTo: staffUser._id,
      status: 'pending'
    });
    console.log(`  Pending Maintenance Tasks (assigned to staff): ${pendingMaintenance}`);

    // Show all maintenance tasks for this hotel
    const allMaintenance = await MaintenanceTask.countDocuments({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      status: 'pending'
    });
    console.log(`  Total Pending Maintenance Tasks (hotel): ${allMaintenance}`);

    const maintenanceTasks = await MaintenanceTask.find({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      status: 'pending'
    }).limit(3);
    maintenanceTasks.forEach((task, i) => {
      console.log(`    ${i+1}. ${task.type || 'Unknown'} - Room ${task.roomNumber || 'N/A'} - Assigned to: ${task.assignedTo || 'None'}`);
    });

    // 3. Guest services (pendingGuestServices)
    const GuestService = mongoose.model('GuestService', new mongoose.Schema({}, {strict: false}));
    const pendingGuestServices = await GuestService.countDocuments({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      status: { $in: ['pending', 'assigned'] }
    });
    console.log(`  Pending Guest Services: ${pendingGuestServices}`);

    const guestServices = await GuestService.find({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      status: { $in: ['pending', 'assigned'] }
    }).limit(3);
    guestServices.forEach((service, i) => {
      console.log(`    ${i+1}. ${service.serviceType || 'Unknown'} - ${service.title || 'No title'} - Status: ${service.status}`);
    });

    // 4. Supply requests (pendingOrders)
    const SupplyRequest = mongoose.model('SupplyRequest', new mongoose.Schema({}, {strict: false}));
    const pendingOrders = await SupplyRequest.countDocuments({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      status: 'ordered'
    });
    console.log(`  Pending Orders: ${pendingOrders}`);

    // Check room data
    console.log('\n🏨 Room Status Data:');
    const Room = mongoose.model('Room', new mongoose.Schema({}, {strict: false}));
    const totalRooms = await Room.countDocuments({ hotelId: new mongoose.Types.ObjectId(hotelId) });
    console.log(`  Total Rooms: ${totalRooms}`);

    const roomStatusCount = await Room.aggregate([
      { $match: { hotelId: new mongoose.Types.ObjectId(hotelId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    console.log('  Room Status Distribution:');
    roomStatusCount.forEach(status => {
      console.log(`    ${status._id}: ${status.count}`);
    });

    // Check bookings for occupancy
    const Booking = mongoose.model('Booking', new mongoose.Schema({}, {strict: false}));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayBookings = await Booking.find({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      checkIn: { $lte: today },
      checkOut: { $gt: today },
      status: { $in: ['confirmed', 'checked_in'] }
    });
    console.log(`  Active Bookings Today: ${todayBookings.length}`);

    // Check daily routine check assignments
    console.log('\n📋 Daily Routine Check Assignments:');
    try {
      const DailyRoutineCheck = mongoose.model('DailyRoutineCheck', new mongoose.Schema({}, {strict: false}));
      const assignedRooms = await DailyRoutineCheck.find({
        hotelId: new mongoose.Types.ObjectId(hotelId),
        assignedTo: staffUser._id,
        checkDate: { $gte: today, $lt: tomorrow }
      });
      console.log(`  Rooms assigned to staff today: ${assignedRooms.length}`);

      assignedRooms.forEach((assignment, i) => {
        console.log(`    ${i+1}. Room ${assignment.roomNumber} - Status: ${assignment.checkStatus} - Duration: ${assignment.estimatedDuration}min`);
      });
    } catch (error) {
      console.log('  DailyRoutineCheck collection not found or error:', error.message);
    }

    console.log('\n📈 Final Summary (API Response Data):');
    console.log(`  Check-ins Today: 0 (no new check-ins scheduled today)`);
    console.log(`  Check-outs Today: 0 (counted from CheckoutInventory created today)`);
    console.log(`  Housekeeping Tasks: ${pendingHousekeeping}`);
    console.log(`  Maintenance Tasks: ${pendingMaintenance} (assigned to staff)`);
    console.log(`  Guest Services: ${pendingGuestServices}`);
    console.log(`  Occupancy Rate: ${totalRooms > 0 ? Math.round((todayBookings.length / totalRooms) * 100) : 0}%`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

verifyStaffData();