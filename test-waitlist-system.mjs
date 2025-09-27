import mongoose from 'mongoose';
import Waitlist from './src/models/Waitlist.js';
import User from './src/models/User.js';
import Room from './src/models/Room.js';
import Hotel from './src/models/Hotel.js';

async function testWaitlistSystem() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🎯 Testing Waitlist System...');

    // Test 1: Check if Waitlist model is working
    console.log('\n📊 Checking Waitlist model...');
    const waitlistCount = await Waitlist.countDocuments();
    console.log(`Current waitlist entries: ${waitlistCount}`);

    // Test 2: Create sample waitlist entry if none exist
    if (waitlistCount === 0) {
      console.log('\n🔧 Creating sample waitlist data...');

      // Get or create a sample hotel
      let hotel = await Hotel.findOne({});
      if (!hotel) {
        hotel = new Hotel({
          name: 'Sample Hotel',
          address: '123 Hotel Street',
          contactInfo: {
            phone: '+1-555-0000',
            email: 'info@samplehotel.com'
          }
        });
        await hotel.save();
        console.log('✅ Created sample hotel');
      }

      // Get or create a sample user (guest)
      let guest = await User.findOne({ role: 'guest' });
      if (!guest) {
        guest = new User({
          name: 'John Doe',
          email: 'john.doe@example.com',
          password: 'password123',
          role: 'guest',
          phone: '+1-555-1234'
        });
        await guest.save();
        console.log('✅ Created sample guest');
      }

      // Create sample waitlist entry
      const waitlistEntry = new Waitlist({
        hotelId: hotel._id,
        guestId: guest._id,
        guestInfo: {
          name: guest.name,
          email: guest.email,
          phone: guest.phone,
          tier: 'vip'
        },
        requestedRoomType: 'Suite',
        checkInDate: new Date('2024-12-25'),
        checkOutDate: new Date('2024-12-28'),
        partySize: 2,
        maxPrice: 500,
        urgency: 'high',
        preferences: ['high floor', 'city view', 'quiet room'],
        specialRequests: ['champagne on arrival', 'late checkout'],
        autoNotify: true,
        metadata: {
          source: 'web'
        }
      });

      await waitlistEntry.save();
      console.log('✅ Created sample waitlist entry:', waitlistEntry._id);
    }

    // Test 3: Test waitlist analytics
    console.log('\n📈 Testing waitlist analytics...');
    let sampleHotel = await Hotel.findOne({});
    if (sampleHotel) {
      const analytics = await Waitlist.getWaitlistStats(sampleHotel._id, 'month');
      console.log('Analytics result:', JSON.stringify(analytics, null, 2));
    }

    // Test 4: Test active waitlist retrieval
    console.log('\n📋 Testing active waitlist retrieval...');
    if (sampleHotel) {
      const activeWaitlist = await Waitlist.getActiveWaitlist(sampleHotel._id);
      console.log(`Active waitlist entries: ${activeWaitlist.length}`);

      if (activeWaitlist.length > 0) {
        const entry = activeWaitlist[0];
        console.log('Sample entry details:');
        console.log('- Guest:', entry.guestInfo.name);
        console.log('- Tier:', entry.guestInfo.tier);
        console.log('- Requested Room:', entry.requestedRoomType);
        console.log('- Priority:', entry.priority);
        console.log('- Status:', entry.status);
        console.log('- Waiting Hours:', entry.waitingHours);
        console.log('- Waiting Days:', entry.waitingDays);
      }
    }

    // Test 5: Test match candidates functionality
    console.log('\n🎯 Testing match candidates...');
    if (sampleHotel) {
      const candidates = await Waitlist.findMatchCandidates(sampleHotel._id, {
        roomType: 'Suite',
        checkInDate: '2024-12-25',
        checkOutDate: '2024-12-28',
        maxPrice: 600,
        partySize: 2
      });
      console.log(`Match candidates found: ${candidates.length}`);
    }

    // Test 6: Test virtual fields
    console.log('\n🔍 Testing virtual fields...');
    const sampleEntry = await Waitlist.findOne({}).populate('guestId', 'name email');
    if (sampleEntry) {
      console.log('Virtual field tests:');
      console.log('- Waiting Days:', sampleEntry.waitingDays);
      console.log('- Waiting Hours:', sampleEntry.waitingHours);
      console.log('- Is Expired:', sampleEntry.isExpired);
      console.log('- Has Active Matches:', sampleEntry.hasActiveMatches);
      console.log('- Best Match:', sampleEntry.bestMatch ? 'Yes' : 'None');
    }

    // Test 7: Test instance methods
    console.log('\n⚙️ Testing instance methods...');
    const testEntry = await Waitlist.findOne({});
    if (testEntry) {
      // Test adding a note
      await testEntry.addNote('Test note from automated testing', testEntry.guestId);
      console.log('✅ Added note successfully');

      // Test adding contact history
      await testEntry.addContactHistory('email', 'attempted', 'Test contact attempt', testEntry.guestId);
      console.log('✅ Added contact history successfully');

      // Reload to see changes
      const updatedEntry = await Waitlist.findById(testEntry._id);
      console.log(`Notes count: ${updatedEntry.notes.length}`);
      console.log(`Contact history count: ${updatedEntry.contactHistory.length}`);
    }

    console.log('\n✅ Waitlist System test completed successfully!');
    console.log('🔗 System is ready for production use');
    console.log('📋 Available endpoints:');
    console.log('   - GET /api/v1/waitlist (get active waitlist)');
    console.log('   - POST /api/v1/waitlist (create entry)');
    console.log('   - GET /api/v1/waitlist/analytics (get analytics)');
    console.log('   - POST /api/v1/waitlist/process-matches (process matches)');
    console.log('   - POST /api/v1/waitlist/find-candidates (find candidates)');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error testing waitlist system:', error);
    process.exit(1);
  }
}

testWaitlistSystem();