import mongoose from 'mongoose';
import { syncExistingBookings, trackBookingEvent } from './src/middleware/marketingSyncMiddleware.js';

const MONGO_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management?retryWrites=true&w=majority&appName=Cluster0';

async function testMarketingSync() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to database');

    // Test the sync of existing bookings
    console.log('🔄 Testing sync of existing bookings...');
    await syncExistingBookings();

    // Test creating a new booking event - get a real user ID first
    console.log('🔄 Testing new booking event tracking...');
    const db = mongoose.connection.db;
    const users = await db.collection('users').find({}).limit(1).toArray();
    const testUserId = users[0]?._id;

    if (testUserId) {
      await trackBookingEvent('booking_created', {
        totalAmount: 5000,
        bookingNumber: 'TEST-' + Date.now(),
        source: 'main-booking-widget'
      }, testUserId);
      console.log(`✅ Tested booking event for user ${testUserId}`);
    } else {
      console.log('⚠️ No users found for testing');
    }

    // Verify the updates
    console.log('📊 Checking updated metrics...');

    const widgets = await db.collection('bookingwidgets').find({}).toArray();
    const guestProfiles = await db.collection('guestcrms').find({}).toArray();

    console.log('\n=== Updated Widget Performance ===');
    widgets.forEach(widget => {
      console.log(`${widget.name}:`);
      console.log(`  Impressions: ${widget.performance?.impressions || 0}`);
      console.log(`  Conversions: ${widget.performance?.conversions || 0}`);
      console.log(`  Conversion Rate: ${(widget.performance?.conversionRate || 0).toFixed(2)}%`);
    });

    console.log('\n=== Updated Guest Segments ===');
    const segmentCounts = {};
    guestProfiles.forEach(profile => {
      const segment = profile.segmentation?.segment || 'unknown';
      segmentCounts[segment] = (segmentCounts[segment] || 0) + 1;
    });

    Object.entries(segmentCounts).forEach(([segment, count]) => {
      console.log(`${segment}: ${count} guests`);
    });

    console.log('\n✅ Marketing sync testing completed!');
    console.log('🔄 Real-time sync is now active for new bookings');

  } catch (error) {
    console.error('❌ Error testing marketing sync:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📌 Disconnected from database');
  }
}

testMarketingSync();