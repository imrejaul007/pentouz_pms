import mongoose from 'mongoose';
import Booking from './src/models/Booking.js';
import User from './src/models/User.js';
import RoomType from './src/models/RoomType.js';
import dotenv from 'dotenv';

dotenv.config();

async function createUnassignedBookings() {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/hotel-management';
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Get a sample user and room types for the bookings
    let sampleUser = await User.findOne();
    if (!sampleUser) {
      // Create a sample user if none exist
      sampleUser = new User({
        name: 'Sample Guest',
        email: 'guest@example.com',
        phone: '+1234567890',
        role: 'guest',
        status: 'active'
      });
      await sampleUser.save();
    }

    const roomTypes = await RoomType.find().limit(3);
    if (roomTypes.length === 0) {
      throw new Error('No room types found. Please create room types first.');
    }

    // Create unassigned bookings
    const unassignedBookings = [
      {
        bookingNumber: `UB${Date.now()}001`,
        userId: sampleUser._id,
        guestDetails: {
          name: 'Michael Johnson',
          email: 'michael.johnson@example.com',
          phone: '+1234567891',
          adults: 2,
          children: 0,
          specialRequests: 'Late checkout, Ocean view preferred'
        },
        hotelId: roomTypes[0].hotelId || new mongoose.Types.ObjectId(),
        checkIn: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        checkOut: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 4 days from now
        nights: 3,
        rooms: [{
          roomTypeId: roomTypes[0]._id,
          roomId: new mongoose.Types.ObjectId(), // Placeholder - will be set to null after creation
          adults: 2,
          children: 0,
          rate: 2500
        }],
        totalAmount: 7500,
        status: 'confirmed',
        paymentStatus: 'pending',
        source: 'direct',
        channelBookingId: `DIRECT_${Date.now()}_001`,
        vipStatus: 'vip'
      },
      {
        bookingNumber: `UB${Date.now()}002`,
        userId: sampleUser._id,
        guestDetails: {
          name: 'Sarah Williams',
          email: 'sarah.williams@example.com',
          phone: '+1234567892',
          adults: 2,
          children: 1,
          specialRequests: 'Baby crib required, High floor preferred'
        },
        hotelId: roomTypes[1]?.hotelId || roomTypes[0].hotelId || new mongoose.Types.ObjectId(),
        checkIn: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Day after tomorrow
        checkOut: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        nights: 3,
        rooms: [{
          roomTypeId: roomTypes[1]?._id || roomTypes[0]._id,
          roomId: new mongoose.Types.ObjectId(), // Placeholder - will be set to null after creation
          adults: 2,
          children: 1,
          rate: 3500
        }],
        totalAmount: 10500,
        status: 'confirmed',
        paymentStatus: 'paid',
        source: 'direct',
        channelBookingId: `DIRECT_${Date.now()}_002`,
        vipStatus: 'svip'
      },
      {
        bookingNumber: `UB${Date.now()}003`,
        userId: sampleUser._id,
        guestDetails: {
          name: 'David Chen',
          email: 'david.chen@example.com',
          phone: '+1234567893',
          adults: 1,
          children: 0,
          specialRequests: 'Quiet room, Business center access'
        },
        hotelId: roomTypes[2]?.hotelId || roomTypes[0].hotelId || new mongoose.Types.ObjectId(),
        checkIn: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // Tomorrow
        checkOut: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), // 6 days from now
        nights: 5,
        rooms: [{
          roomTypeId: roomTypes[2]?._id || roomTypes[0]._id,
          roomId: new mongoose.Types.ObjectId(), // Placeholder - will be set to null after creation
          adults: 1,
          children: 0,
          rate: 1800
        }],
        totalAmount: 9000,
        status: 'confirmed',
        paymentStatus: 'paid',
        source: 'booking_com',
        channelBookingId: `BOOKING_${Date.now()}_003`,
        vipStatus: 'corporate',
        corporateBooking: {
          corporateCompanyId: new mongoose.Types.ObjectId(),
          companyName: 'TechCorp Inc.',
          billingAddress: '123 Business St, Corp City, CC 12345'
        }
      },
      {
        bookingNumber: `UB${Date.now()}004`,
        userId: sampleUser._id,
        guestDetails: {
          name: 'Emma Rodriguez',
          email: 'emma.rodriguez@example.com',
          phone: '+1234567894',
          adults: 2,
          children: 0,
          specialRequests: 'Honeymoon package, Room decorations'
        },
        hotelId: roomTypes[0].hotelId || new mongoose.Types.ObjectId(),
        checkIn: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        checkOut: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000), // 8 days from now
        nights: 5,
        rooms: [{
          roomTypeId: roomTypes[0]._id,
          roomId: new mongoose.Types.ObjectId(), // Placeholder - will be set to null after creation
          adults: 2,
          children: 0,
          rate: 4500
        }],
        totalAmount: 22500,
        status: 'confirmed',
        paymentStatus: 'paid',
        source: 'booking_com',
        channelBookingId: `BOOKING_${Date.now()}_004`,
        vipStatus: 'vip'
      },
      {
        bookingNumber: `UB${Date.now()}005`,
        userId: sampleUser._id,
        guestDetails: {
          name: 'James Thompson',
          email: 'james.thompson@example.com',
          phone: '+1234567895',
          adults: 1,
          children: 0,
          specialRequests: 'Ground floor, Wheelchair accessible'
        },
        hotelId: roomTypes[1]?.hotelId || roomTypes[0].hotelId || new mongoose.Types.ObjectId(),
        checkIn: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // Tomorrow
        checkOut: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        nights: 2,
        rooms: [{
          roomTypeId: roomTypes[1]?._id || roomTypes[0]._id,
          roomId: new mongoose.Types.ObjectId(), // Placeholder - will be set to null after creation
          adults: 1,
          children: 0,
          rate: 2000
        }],
        totalAmount: 4000,
        status: 'confirmed',
        paymentStatus: 'pending',
        source: 'direct',
        channelBookingId: `DIRECT_${Date.now()}_005`,
        vipStatus: 'none'
      }
    ];

    // Insert the bookings
    const createdBookings = await Booking.insertMany(unassignedBookings);
    
    // Now set all roomId values to null to make them truly unassigned
    for (const booking of createdBookings) {
      await Booking.updateOne(
        { _id: booking._id },
        { $set: { 'rooms.$[].roomId': null } }
      );
    }
    
    // Fetch updated bookings to show the null roomIds
    const finalBookings = await Booking.find({ 
      _id: { $in: createdBookings.map(b => b._id) }
    });
    
    console.log('✅ Created unassigned bookings successfully:');
    finalBookings.forEach((booking, index) => {
      console.log(`${index + 1}. ${booking.guestDetails.name} - ${booking.bookingNumber} (${booking.vipStatus})`);
      console.log(`   Check-in: ${booking.checkIn.toDateString()}`);
      console.log(`   Room Type: ${booking.rooms[0].roomTypeId}`);
      console.log(`   Status: ${booking.status} | Room: ${booking.rooms[0].roomId === null ? 'Unassigned ✓' : 'Assigned'}`);
      console.log('');
    });

    console.log(`\n🎯 Total unassigned bookings created: ${createdBookings.length}`);
    console.log('\n📝 These bookings have:');
    console.log('   - Confirmed status but no room assigned (roomId: null)');
    console.log('   - Various VIP levels (none, vip, svip, corporate)');
    console.log('   - Different check-in dates for testing');
    console.log('   - Special requests for realistic testing');
    
    console.log('\n✨ Now you can test drag-and-drop in TapeChart:');
    console.log('   1. Go to TapeChart tab');
    console.log('   2. You should see these reservations in "Unassigned" section');
    console.log('   3. Drag them to available rooms to test assignment');

  } catch (error) {
    console.error('❌ Error creating unassigned bookings:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the function
createUnassignedBookings();