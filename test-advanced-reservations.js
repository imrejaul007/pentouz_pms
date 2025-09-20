import mongoose from 'mongoose';
import TapeChartModels from './src/models/TapeChart.js';
import Booking from './src/models/Booking.js';
import User from './src/models/User.js';
import Room from './src/models/Room.js';

const { AdvancedReservation } = TapeChartModels;

// MongoDB connection
const MONGO_URI = "mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

async function testAdvancedReservationCreation() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Check if we have required data
    const bookingCount = await Booking.countDocuments();
    const userCount = await User.countDocuments();
    const roomCount = await Room.countDocuments();

    console.log(`Bookings in DB: ${bookingCount}`);
    console.log(`Users in DB: ${userCount}`);
    console.log(`Rooms in DB: ${roomCount}`);

    if (bookingCount === 0) {
      console.log('\n❌ No bookings found! Advanced Reservations need existing bookings.');
      return;
    }

    // Get a sample booking
    const sampleBooking = await Booking.findOne();
    const sampleUser = await User.findOne({ role: 'staff' });
    const sampleRoom = await Room.findOne();

    console.log(`\nUsing booking: ${sampleBooking?.bookingNumber} (${sampleBooking?._id})`);
    console.log(`Using user: ${sampleUser?.name} (${sampleUser?._id})`);
    console.log(`Using room: ${sampleRoom?.roomNumber} (${sampleRoom?._id})`);

    // Try to create a simple Advanced Reservation
    console.log('\n🧪 Testing Advanced Reservation creation...');

    const testAdvancedReservation = {
      reservationId: `TEST-ADV-${Date.now()}`,
      bookingId: sampleBooking._id,
      reservationType: 'standard',
      priority: 'medium',
      roomPreferences: {
        preferredView: 'city',
        accessibleRoom: false,
        smokingPreference: 'non_smoking'
      },
      guestProfile: {
        vipStatus: 'none',
        preferences: {},
        allergies: [],
        specialNeeds: [],
        dietaryRestrictions: []
      },
      roomAssignments: [],
      upgrades: [],
      specialRequests: [],
      reservationFlags: []
    };

    const createdReservation = await AdvancedReservation.create(testAdvancedReservation);
    console.log('✅ Successfully created test Advanced Reservation:', createdReservation._id);

    // Test with more complex data (like the seed file)
    console.log('\n🧪 Testing with complex data like seed file...');

    const complexAdvancedReservation = {
      reservationId: `ADV-${Date.now()}-COMPLEX`,
      bookingId: sampleBooking._id,
      reservationType: 'vip',
      priority: 'vip',
      roomPreferences: {
        preferredRooms: [sampleRoom._id.toString()],
        preferredFloor: 6,
        preferredView: 'city',
        adjacentRooms: false,
        connectingRooms: false,
        accessibleRoom: false,
        smokingPreference: 'non_smoking'
      },
      guestProfile: {
        vipStatus: 'platinum',
        loyaltyNumber: 'PLT-TEST-123',
        preferences: {
          bedType: 'king',
          pillowType: 'memory_foam',
          roomTemperature: 72,
          newspaper: 'Financial Times',
          wakeUpCall: false,
          turndownService: true
        },
        allergies: ['shellfish'],
        specialNeeds: [],
        dietaryRestrictions: ['vegetarian']
      },
      roomAssignments: [
        {
          roomId: sampleRoom._id,
          roomNumber: sampleRoom.roomNumber,
          assignedDate: new Date(),
          assignmentType: 'preference',
          assignedBy: sampleUser._id,
          notes: 'Test VIP guest preference'
        }
      ],
      upgrades: [
        {
          fromRoomType: 'deluxe',
          toRoomType: 'suite',
          upgradeType: 'complimentary',
          upgradeReason: 'VIP status - test',
          additionalCharge: 0,
          approvedBy: sampleUser._id,
          upgradeDate: new Date()
        }
      ],
      specialRequests: [
        {
          type: 'amenities',
          description: 'Premium champagne and chocolate arrangement',
          priority: 'high',
          status: 'confirmed',
          assignedTo: sampleUser._id,
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          cost: 150,
          notes: 'VIP welcome amenity'
        }
      ],
      reservationFlags: [
        {
          flag: 'vip',
          severity: 'info',
          description: 'Test platinum member',
          createdBy: sampleUser._id,
          createdAt: new Date(),
          expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      ]
    };

    const createdComplexReservation = await AdvancedReservation.create(complexAdvancedReservation);
    console.log('✅ Successfully created complex Advanced Reservation:', createdComplexReservation._id);

    // Check final count
    const finalCount = await AdvancedReservation.countDocuments();
    console.log(`\n📊 Total Advanced Reservations after test: ${finalCount}`);

  } catch (error) {
    console.error('❌ Error during test:', error);
    if (error.errors) {
      console.log('\n📋 Validation Errors:');
      Object.keys(error.errors).forEach(key => {
        console.log(`  - ${key}: ${error.errors[key].message}`);
      });
    }
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

testAdvancedReservationCreation();