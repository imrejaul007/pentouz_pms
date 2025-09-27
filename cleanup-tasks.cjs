const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management?retryWrites=true&w=majority&appName=Cluster0')
.then(async () => {
  console.log('Connected to MongoDB - Cleaning up all pending tasks...');

  // Check housekeepings collection
  const Housekeeping = mongoose.model('Housekeeping', {
    roomId: mongoose.Schema.Types.ObjectId,
    status: String,
    taskType: String,
    hotelId: mongoose.Schema.Types.ObjectId,
    assignedTo: mongoose.Schema.Types.ObjectId,
    scheduledDate: Date,
    completedAt: Date
  });

  const pendingTasks = await Housekeeping.find({
    status: { $in: ['pending', 'in_progress'] }
  }).populate('roomId', 'roomNumber');

  console.log('Found pending cleaning tasks:', pendingTasks.length);

  if (pendingTasks.length > 0) {
    console.log('Sample tasks:');
    pendingTasks.slice(0, 5).forEach(task => {
      console.log(`Room ${task.roomId?.roomNumber || 'Unknown'} - Status: ${task.status} - Type: ${task.taskType}`);
    });

    // Complete all pending cleaning tasks
    const result = await Housekeeping.updateMany(
      { status: { $in: ['pending', 'in_progress'] } },
      {
        $set: {
          status: 'completed',
          completedAt: new Date()
        }
      }
    );

    console.log(`Completed ${result.modifiedCount} cleaning tasks`);
  }

  // Also check HousekeepingTask collection
  const HousekeepingTask = mongoose.model('HousekeepingTask', {
    roomId: mongoose.Schema.Types.ObjectId,
    status: String,
    taskType: String
  });

  const pendingHKTasks = await HousekeepingTask.find({
    status: { $in: ['pending', 'in_progress'] }
  }).populate('roomId', 'roomNumber');

  console.log('Found pending housekeeping tasks:', pendingHKTasks.length);

  if (pendingHKTasks.length > 0) {
    const hkResult = await HousekeepingTask.updateMany(
      { status: { $in: ['pending', 'in_progress'] } },
      {
        $set: {
          status: 'completed',
          completedAt: new Date()
        }
      }
    );

    console.log(`Completed ${hkResult.modifiedCount} housekeeping tasks`);
  }

  // Check for any other task collections
  const collections = await mongoose.connection.db.listCollections().toArray();
  const taskCollections = collections.filter(c =>
    c.name.includes('task') ||
    c.name.includes('housekeeping') ||
    c.name.includes('cleaning')
  );

  console.log('Task-related collections found:', taskCollections.map(c => c.name));

  console.log('✅ All cleaning and housekeeping tasks completed!');
  console.log('🔄 Refresh your dashboard to see all rooms as green (available)');

  mongoose.disconnect();
})
.catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});