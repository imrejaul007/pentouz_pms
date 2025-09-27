import mongoose from 'mongoose';
import MultiBooking from './src/models/MultiBooking.js';
import TravelAgent from './src/models/TravelAgent.js';

async function testMultiBookingSystem() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log('🎯 Testing Multi-Booking System...');

    // Check if MultiBooking model is working
    const multiBookings = await MultiBooking.find({}).limit(3);
    console.log('📊 Multi-bookings in database:', multiBookings.length);

    if (multiBookings.length > 0) {
      const sample = multiBookings[0];
      console.log('📋 Sample multi-booking:');
      console.log('- Group Reference ID:', sample.groupReferenceId);
      console.log('- Status:', sample.status);
      console.log('- Total Rooms:', sample.groupDetails?.totalRooms);
      console.log('- Total Amount:', sample.pricing?.totalAmount);
      console.log('- Commission:', sample.commission?.finalCommission);
    }

    // Test the model methods
    const analytics = await MultiBooking.getMultiBookingAnalytics('68cd01414419c17b5f6b4c12', 'month');
    console.log('📈 Multi-booking analytics:', analytics);

    // Check travel agents
    const travelAgents = await TravelAgent.find({ status: 'active' }).limit(3);
    console.log('👥 Active travel agents:', travelAgents.length);

    if (travelAgents.length > 0) {
      console.log('- Sample agent:', travelAgents[0].companyName, travelAgents[0].agentCode);
    }

    console.log('✅ Multi-Booking System test completed successfully!');
    console.log('🔗 Access the system at: http://localhost:5173/travel-agent/multi-booking');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error testing multi-booking system:', error);
    process.exit(1);
  }
}

testMultiBookingSystem();