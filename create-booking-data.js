import mongoose from 'mongoose';
import Booking from './src/models/Booking.js';
import Room from './src/models/Room.js';
import Hotel from './src/models/Hotel.js';
import User from './src/models/User.js';

const MONGO_URI = "mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

async function createBookingData() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Get hotel and users
    const hotel = await Hotel.findOne();
    const guestUsers = await User.find({ role: 'guest' }).limit(10);

    if (!hotel) {
      console.log('No hotel found');
      return;
    }

    if (guestUsers.length === 0) {
      console.log('No guest users found');
      return;
    }

    console.log(`Using hotel: ${hotel.name}`);
    console.log(`Found ${guestUsers.length} guest users`);

    // Get all rooms
    const rooms = await Room.find({ hotelId: hotel._id, isActive: true });
    console.log(`Found ${rooms.length} rooms`);

    // Clear existing bookings
    await Booking.deleteMany({ hotelId: hotel._id });
    console.log('Cleared existing bookings');

    // Room type configurations with rates
    const roomTypeRates = {
      'Standard Room': { baseRate: 2500, maxRate: 3500 },
      'Deluxe Room': { baseRate: 4000, maxRate: 5500 },
      'Executive Room': { baseRate: 5500, maxRate: 7000 },
      'Deluxe Suite': { baseRate: 8000, maxRate: 12000 },
      'Presidential Suite': { baseRate: 15000, maxRate: 25000 }
    };

    // Generate bookings for the past 30 days and next 30 days
    const bookings = [];
    const today = new Date();

    // Generate 50 bookings across different dates
    for (let i = 0; i < 50; i++) {
      const randomUser = guestUsers[Math.floor(Math.random() * guestUsers.length)];

      // Random dates (past 30 days to future 30 days)
      const checkInOffset = Math.floor(Math.random() * 60) - 30; // -30 to +30 days
      const checkInDate = new Date(today);
      checkInDate.setDate(today.getDate() + checkInOffset);

      const stayDuration = Math.floor(Math.random() * 7) + 1; // 1-7 nights
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkInDate.getDate() + stayDuration);

      // Select random room
      const availableRooms = rooms.filter(room => {
        // Simple availability check - avoid double booking same room on same dates
        return !bookings.some(existingBooking =>
          existingBooking.rooms.some(r => r.roomId.toString() === room._id.toString()) &&
          ((new Date(existingBooking.checkIn) <= checkInDate && new Date(existingBooking.checkOut) > checkInDate) ||
           (new Date(existingBooking.checkIn) < checkOutDate && new Date(existingBooking.checkOut) >= checkOutDate))
        );
      });

      if (availableRooms.length === 0) continue;

      const selectedRoom = availableRooms[Math.floor(Math.random() * availableRooms.length)];
      const roomTypeRate = roomTypeRates[selectedRoom.roomType] || roomTypeRates['Standard Room'];

      // Calculate rates
      const baseRate = roomTypeRate.baseRate + Math.floor(Math.random() * (roomTypeRate.maxRate - roomTypeRate.baseRate));
      const numberOfNights = Math.max(1, Math.floor((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)));
      const subtotal = baseRate * numberOfNights;
      const taxes = subtotal * 0.18; // 18% GST
      const totalAmount = subtotal + taxes;

      // Determine booking status based on dates (using valid enum values)
      let status = 'confirmed';
      if (checkOutDate < today) {
        status = 'checked_out'; // Changed from 'completed' to 'checked_out'
      } else if (checkInDate <= today && checkOutDate > today) {
        status = 'checked_in';
      } else if (checkInDate > today) {
        status = Math.random() > 0.8 ? 'pending' : 'confirmed';
      }

      // Generate booking number
      const bookingNumber = `BK${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

      const booking = {
        hotelId: hotel._id,
        userId: randomUser._id, // This is required by schema
        bookingNumber: bookingNumber,
        rooms: [{
          roomId: selectedRoom._id,
          rate: baseRate // This is required by schema
        }],
        checkIn: checkInDate,
        checkOut: checkOutDate,
        nights: numberOfNights, // This is required by schema
        totalGuests: Math.floor(Math.random() * 4) + 1,
        status: status,
        paymentStatus: status === 'checked_out' ? 'paid' : (status === 'checked_in' ? 'paid' : 'pending'),
        totalAmount: totalAmount,
        currency: 'INR',
        // Additional fields for completeness
        guestDetails: {
          name: randomUser.name,
          email: randomUser.email,
          phone: randomUser.phone || '+91-9876543210',
          adults: Math.floor(Math.random() * 3) + 1,
          children: Math.floor(Math.random() * 2),
          specialRequests: Math.random() > 0.7 ? 'Late checkout requested' : null
        },
        roomType: selectedRoom.roomType,
        source: ['direct', 'booking_com', 'expedia', 'airbnb'][Math.floor(Math.random() * 4)],
        createdAt: new Date(checkInDate.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Created up to 7 days before checkin
        updatedAt: new Date()
      };

      bookings.push(booking);
    }

    // Insert bookings in batches
    const batchSize = 10;
    let createdCount = 0;

    for (let i = 0; i < bookings.length; i += batchSize) {
      const batch = bookings.slice(i, i + batchSize);
      const created = await Booking.insertMany(batch);
      createdCount += created.length;
      console.log(`Created batch ${Math.floor(i/batchSize) + 1}: ${created.length} bookings`);
    }

    console.log(`✅ Successfully created ${createdCount} bookings with real room assignments and revenue data`);

    // Update room statuses based on current bookings
    const currentBookings = await Booking.find({
      hotelId: hotel._id,
      checkIn: { $lte: today },
      checkOut: { $gt: today },
      status: 'checked_in'
    });

    // Update room statuses
    for (const booking of currentBookings) {
      for (const roomBooking of booking.rooms) {
        await Room.findByIdAndUpdate(roomBooking.roomId, {
          status: 'occupied',
          currentBooking: booking._id,
          lastUpdated: new Date()
        });
      }
    }

    // Set some rooms to different statuses for realism
    const vacantRooms = await Room.find({ hotelId: hotel._id, status: 'vacant' });

    // Set 10% of vacant rooms to maintenance
    const maintenanceCount = Math.floor(vacantRooms.length * 0.1);
    for (let i = 0; i < maintenanceCount; i++) {
      const room = vacantRooms[Math.floor(Math.random() * vacantRooms.length)];
      await Room.findByIdAndUpdate(room._id, { status: 'maintenance' });
    }

    // Set 5% to dirty/cleaning
    const dirtyCount = Math.floor(vacantRooms.length * 0.05);
    for (let i = 0; i < dirtyCount; i++) {
      const room = vacantRooms[Math.floor(Math.random() * vacantRooms.length)];
      if (room.status === 'vacant') {
        await Room.findByIdAndUpdate(room._id, { status: 'dirty' });
      }
    }

    console.log(`✅ Updated room statuses based on bookings`);
    console.log(`   - Occupied rooms: ${currentBookings.reduce((sum, b) => sum + b.rooms.length, 0)}`);
    console.log(`   - Maintenance rooms: ${maintenanceCount}`);
    console.log(`   - Dirty rooms: ${dirtyCount}`);

    // Summary statistics
    const totalRevenue = bookings.reduce((sum, booking) => sum + booking.totalAmount, 0);
    const avgDailyRate = bookings.length > 0 ? totalRevenue / bookings.reduce((sum, b) => sum + b.numberOfNights, 0) : 0;
    const occupiedRoomsCount = currentBookings.reduce((sum, b) => sum + b.rooms.length, 0);
    const occupancyRate = (occupiedRoomsCount / rooms.length) * 100;

    console.log('\n📊 BOOKING SUMMARY:');
    console.log(`   Total Bookings: ${createdCount}`);
    console.log(`   Total Revenue: ₹${totalRevenue.toLocaleString('en-IN')}`);
    console.log(`   Average Daily Rate: ₹${avgDailyRate.toLocaleString('en-IN')}`);
    console.log(`   Current Occupancy: ${occupancyRate.toFixed(1)}%`);
    console.log(`   Occupied Rooms: ${occupiedRoomsCount}/${rooms.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  }
}

createBookingData();