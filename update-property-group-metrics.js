import mongoose from 'mongoose';
import PropertyGroup from './src/models/PropertyGroup.js';
import Hotel from './src/models/Hotel.js';
import User from './src/models/User.js';
import Booking from './src/models/Booking.js';
import Room from './src/models/Room.js';

const MONGO_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management?retryWrites=true&w=majority&appName=Cluster0';

async function updatePropertyGroupMetrics() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const groupId = '68cd01594419c17b5f6b55c1'; // Pentouz Hotels Group ID

    console.log('Finding property group...');
    const propertyGroup = await PropertyGroup.findById(groupId);

    if (!propertyGroup) {
      console.log('Property group not found');
      return;
    }

    console.log('Property group found:', propertyGroup.name);
    console.log('Current metrics:', propertyGroup.metrics);

    console.log('Updating metrics...');

    // Debug: Check what hotels are in this group
    const hotelsInGroup = await mongoose.model('Hotel').find({ propertyGroupId: groupId, isActive: true });
    console.log('Hotels in group:', hotelsInGroup.map(h => ({ name: h.name, roomCount: h.roomCount })));

    await propertyGroup.updateMetrics();

    console.log('Metrics updated successfully');

    // Fetch updated group
    const updatedGroup = await PropertyGroup.findById(groupId);
    console.log('Updated metrics:', updatedGroup.metrics);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

updatePropertyGroupMetrics();