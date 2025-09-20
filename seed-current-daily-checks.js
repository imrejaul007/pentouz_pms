import mongoose from 'mongoose';
import dotenv from 'dotenv';
import DailyRoutineCheck from './src/models/DailyRoutineCheck.js';
import Room from './src/models/Room.js';
import User from './src/models/User.js';
import Hotel from './src/models/Hotel.js';

// Load environment variables
dotenv.config();

// MongoDB connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    process.exit(1);
  }
};

const generateCurrentDailyChecks = async () => {
  try {
    console.log('🔄 Generating current date daily check assignments...');

    // Get hotel
    const hotel = await Hotel.findOne();
    if (!hotel) {
      console.error('❌ No hotel found in database');
      return;
    }
    console.log(`✅ Found hotel: ${hotel.name}`);

    // Get all active rooms
    const rooms = await Room.find({
      hotelId: hotel._id,
      isActive: true
    }).limit(50); // Limit for testing

    if (rooms.length === 0) {
      console.error('❌ No rooms found');
      return;
    }
    console.log(`✅ Found ${rooms.length} rooms`);

    // Get only staff users (exclude admin and manager roles)
    const staffUsers = await User.find({
      hotelId: hotel._id,
      role: 'staff',
      isActive: true
    });

    if (staffUsers.length === 0) {
      console.error('❌ No staff users found');
      return;
    }
    console.log(`✅ Found ${staffUsers.length} staff users`);

    // Clear existing daily checks for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    await DailyRoutineCheck.deleteMany({
      hotelId: hotel._id,
      checkDate: { $gte: today, $lt: tomorrow }
    });
    console.log('🗑️ Cleared existing daily checks for today');

    // Generate assignments for today
    const dailyCheckAssignments = [];
    const inventoryItems = [
      {
        itemId: new mongoose.Types.ObjectId(),
        itemName: 'Bed Sheets',
        category: 'bedroom',
        inventoryType: 'daily',
        action: 'replace',
        quantity: 2,
        unitPrice: 200,
        totalPrice: 400,
        notes: 'Fresh linen set',
        status: 'working'
      },
      {
        itemId: new mongoose.Types.ObjectId(),
        itemName: 'Towels',
        category: 'bathroom',
        inventoryType: 'daily',
        action: 'replace',
        quantity: 3,
        unitPrice: 80,
        totalPrice: 240,
        notes: 'Clean towel set',
        status: 'working'
      },
      {
        itemId: new mongoose.Types.ObjectId(),
        itemName: 'Toiletries',
        category: 'bathroom',
        inventoryType: 'daily',
        action: 'add',
        quantity: 1,
        unitPrice: 150,
        totalPrice: 150,
        notes: 'Shampoo, soap, toothbrush set',
        status: 'working'
      }
    ];

    // Create different scenarios
    let assignedCount = 0;
    let completedCount = 0;

    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];
      const staffMember = staffUsers[i % staffUsers.length];

      // Create different statuses for realistic data
      let checkStatus = 'pending';
      let completedAt = null;
      let startedAt = null;
      let actualDuration = null;
      let items = [];
      let totalCost = 0;

      // 30% completed, 50% assigned pending, 20% unassigned
      const scenario = Math.random();

      if (scenario < 0.3) {
        // Completed checks
        checkStatus = 'completed';
        const checkTime = new Date();
        checkTime.setHours(8 + Math.floor(Math.random() * 6)); // Between 8 AM - 2 PM
        completedAt = checkTime;
        startedAt = new Date(checkTime.getTime() - (15 + Math.random() * 20) * 60 * 1000); // 15-35 min duration
        actualDuration = Math.floor((completedAt - startedAt) / (1000 * 60));
        items = inventoryItems.map(item => ({
          ...item,
          itemId: new mongoose.Types.ObjectId()
        }));
        totalCost = items.reduce((sum, item) => sum + item.totalPrice, 0);
        completedCount++;
      } else if (scenario < 0.8) {
        // Assigned but pending
        checkStatus = 'pending';
        assignedCount++;
      } else {
        // Skip this room (unassigned)
        continue;
      }

      const dailyCheck = {
        hotelId: hotel._id,
        roomId: room._id,
        checkedBy: staffMember._id,
        checkDate: today,
        status: checkStatus,
        estimatedDuration: 15 + Math.floor(Math.random() * 15), // 15-30 minutes
        actualDuration,
        startedAt,
        completedAt,
        items,
        totalCost,
        notes: checkStatus === 'completed' ?
          `Daily check completed for room ${room.roomNumber}. All items checked and maintained.` :
          null,
        qualityScore: checkStatus === 'completed' ? 4 + Math.floor(Math.random() * 2) : null
      };

      dailyCheckAssignments.push(dailyCheck);
    }

    // Insert the daily check assignments
    const createdChecks = await DailyRoutineCheck.insertMany(dailyCheckAssignments);

    console.log('✅ Current date daily check assignments created:');
    console.log(`   📋 Total assignments: ${createdChecks.length}`);
    console.log(`   ✅ Completed: ${completedCount}`);
    console.log(`   ⏳ Pending: ${assignedCount - completedCount}`);
    console.log(`   🔄 Unassigned: ${rooms.length - createdChecks.length}`);
    console.log(`   📅 Date: ${today.toDateString()}`);

    // Show staff assignment summary
    const staffSummary = {};
    createdChecks.forEach(check => {
      const staffId = check.checkedBy.toString();
      if (!staffSummary[staffId]) {
        const staff = staffUsers.find(s => s._id.toString() === staffId);
        staffSummary[staffId] = {
          name: staff.name,
          assigned: 0,
          completed: 0,
          pending: 0
        };
      }
      staffSummary[staffId].assigned++;
      if (check.status === 'completed') {
        staffSummary[staffId].completed++;
      } else {
        staffSummary[staffId].pending++;
      }
    });

    console.log('\n👥 Staff Assignment Summary:');
    Object.values(staffSummary).forEach(staff => {
      console.log(`   ${staff.name}: ${staff.assigned} assigned (${staff.completed} completed, ${staff.pending} pending)`);
    });

    console.log('\n🎉 Current daily checks generated successfully!');
    console.log('💡 The Daily Check Management page should now show realistic current data.');

  } catch (error) {
    console.error('❌ Error generating daily checks:', error.message);
    console.error(error.stack);
  }
};

// Main execution
const main = async () => {
  await connectDB();
  await generateCurrentDailyChecks();

  // Close database connection
  await mongoose.connection.close();
  console.log('📴 Database connection closed');
  process.exit(0);
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err.message);
  process.exit(1);
});

// Run the script
main();