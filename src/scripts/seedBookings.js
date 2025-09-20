import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import User from '../models/User.js';
import Hotel from '../models/Hotel.js';

dotenv.config();

const logger = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  error: (msg) => console.error(`❌ ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`)
};

async function seedBookingsOnly() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    logger.info('Connected to MongoDB');

    // Check if bookings already exist
    const existingBookings = await Booking.countDocuments();
    if (existingBookings > 0) {
      logger.info(`Found ${existingBookings} existing bookings. Skipping booking seed to preserve data.`);
      process.exit(0);
    }

    // Get existing data
    const hotel = await Hotel.findOne();
    const rooms = await Room.find().limit(80); // Use 80% of rooms for bookings
    const guests = await User.find({ role: { $in: ['guest', 'vip'] } });

    if (!hotel || rooms.length === 0 || guests.length === 0) {
      throw new Error('Missing required data. Please run main seed script first.');
    }

    logger.info(`Found ${rooms.length} rooms and ${guests.length} guests to work with`);

    // Create realistic booking data
    const bookings = [];
    const today = new Date();
    const statuses = ['confirmed', 'checked_in', 'checked_out', 'cancelled', 'pending'];
    const guestTypes = ['individual', 'corporate', 'group', 'travel_agent'];

    // Create current occupancy (checked in guests)
    for (let i = 0; i < 30; i++) {
      const guest = guests[Math.floor(Math.random() * guests.length)];
      const room = rooms[i % rooms.length];

      const checkIn = new Date(today.getTime() - Math.floor(Math.random() * 3) * 24 * 60 * 60 * 1000); // 0-2 days ago
      const stayDuration = Math.floor(Math.random() * 5) + 1; // 1-5 nights
      const checkOut = new Date(checkIn.getTime() + stayDuration * 24 * 60 * 60 * 1000);

      const roomRate = {
        'Standard': 2500,
        'Deluxe': 3500,
        'Executive': 4500,
        'Suite': 6500,
        'Presidential Suite': 12000
      }[room.type] || 2500;

      const baseRate = roomRate + Math.floor(Math.random() * 1000) - 500; // Add some variance
      const totalAmount = baseRate * stayDuration;

      bookings.push({
        hotelId: hotel._id,
        userId: guest._id,
        rooms: [{
          roomId: room._id,
          roomNumber: room.roomNumber,
          roomType: room.type,
          rate: baseRate,
          guests: Math.floor(Math.random() * 3) + 1
        }],
        bookingNumber: `BK${Date.now()}${i.toString().padStart(3, '0')}`,
        status: 'checked_in',
        checkIn: checkIn,
        checkOut: checkOut,
        nights: stayDuration,
        adults: Math.floor(Math.random() * 3) + 1,
        children: Math.floor(Math.random() * 2),
        totalAmount: totalAmount,
        paidAmount: Math.random() > 0.3 ? totalAmount : totalAmount * 0.5,
        balanceAmount: Math.random() > 0.3 ? 0 : totalAmount * 0.5,
        guestType: guestTypes[Math.floor(Math.random() * guestTypes.length)],
        source: 'direct',
        paymentStatus: Math.random() > 0.3 ? 'paid' : 'pending',
        specialRequests: Math.random() > 0.7 ? ['Late checkout', 'Extra towels'] : [],
        vipStatus: Math.random() > 0.8 ? 'vip' : 'none',
        createdAt: new Date(checkIn.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Booked up to 30 days ago
        updatedAt: new Date()
      });
    }

    // Create future reservations (confirmed bookings)
    for (let i = 30; i < 50; i++) {
      const guest = guests[Math.floor(Math.random() * guests.length)];
      const room = rooms[i % rooms.length];

      const checkIn = new Date(today.getTime() + (Math.floor(Math.random() * 30) + 1) * 24 * 60 * 60 * 1000); // 1-30 days from now
      const stayDuration = Math.floor(Math.random() * 4) + 1; // 1-4 nights
      const checkOut = new Date(checkIn.getTime() + stayDuration * 24 * 60 * 60 * 1000);

      const roomRate = {
        'Standard': 2500,
        'Deluxe': 3500,
        'Executive': 4500,
        'Suite': 6500,
        'Presidential Suite': 12000
      }[room.type] || 2500;

      const baseRate = roomRate + Math.floor(Math.random() * 1000) - 500;
      const totalAmount = baseRate * stayDuration;

      bookings.push({
        hotelId: hotel._id,
        userId: guest._id,
        rooms: [{
          roomId: room._id,
          roomNumber: room.roomNumber,
          roomType: room.type,
          rate: baseRate,
          guests: Math.floor(Math.random() * 3) + 1
        }],
        bookingNumber: `BK${Date.now()}${i.toString().padStart(3, '0')}`,
        status: 'confirmed',
        checkIn: checkIn,
        checkOut: checkOut,
        nights: stayDuration,
        adults: Math.floor(Math.random() * 3) + 1,
        children: Math.floor(Math.random() * 2),
        totalAmount: totalAmount,
        paidAmount: totalAmount * 0.3, // 30% advance payment
        balanceAmount: totalAmount * 0.7,
        guestType: guestTypes[Math.floor(Math.random() * guestTypes.length)],
        source: Math.random() > 0.5 ? 'direct' : 'booking_com',
        paymentStatus: 'pending',
        specialRequests: Math.random() > 0.6 ? ['Early checkin', 'City view room'] : [],
        vipStatus: Math.random() > 0.85 ? 'vip' : 'none',
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Booked up to 7 days ago
        updatedAt: new Date()
      });
    }

    // Create some recent checkouts
    for (let i = 50; i < 65; i++) {
      const guest = guests[Math.floor(Math.random() * guests.length)];
      const room = rooms[i % rooms.length];

      const checkOut = new Date(today.getTime() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000); // 0-6 days ago
      const stayDuration = Math.floor(Math.random() * 4) + 1;
      const checkIn = new Date(checkOut.getTime() - stayDuration * 24 * 60 * 60 * 1000);

      const roomRate = {
        'Standard': 2500,
        'Deluxe': 3500,
        'Executive': 4500,
        'Suite': 6500,
        'Presidential Suite': 12000
      }[room.type] || 2500;

      const baseRate = roomRate + Math.floor(Math.random() * 1000) - 500;
      const totalAmount = baseRate * stayDuration;

      bookings.push({
        hotelId: hotel._id,
        userId: guest._id,
        rooms: [{
          roomId: room._id,
          roomNumber: room.roomNumber,
          roomType: room.type,
          rate: baseRate,
          guests: Math.floor(Math.random() * 3) + 1
        }],
        bookingNumber: `BK${Date.now()}${i.toString().padStart(3, '0')}`,
        status: 'checked_out',
        checkIn: checkIn,
        checkOut: checkOut,
        actualCheckOut: checkOut,
        nights: stayDuration,
        adults: Math.floor(Math.random() * 3) + 1,
        children: Math.floor(Math.random() * 2),
        totalAmount: totalAmount,
        paidAmount: totalAmount,
        balanceAmount: 0,
        guestType: guestTypes[Math.floor(Math.random() * guestTypes.length)],
        source: Math.random() > 0.4 ? 'direct' : 'expedia',
        paymentStatus: 'paid',
        specialRequests: [],
        vipStatus: Math.random() > 0.9 ? 'vip' : 'none',
        createdAt: new Date(checkIn.getTime() - Math.random() * 60 * 24 * 60 * 60 * 1000),
        updatedAt: checkOut
      });
    }

    // Add some VIP bookings
    const vipGuests = guests.filter(g => Math.random() > 0.7); // Random VIP selection
    for (let i = 0; i < Math.min(5, vipGuests.length); i++) {
      const guest = vipGuests[i];
      const suiteRooms = rooms.filter(r => r.type.includes('Suite'));
      const room = suiteRooms[Math.floor(Math.random() * suiteRooms.length)] || rooms[0];

      const checkIn = new Date(today.getTime() + (Math.floor(Math.random() * 14) + 7) * 24 * 60 * 60 * 1000); // 1-3 weeks from now
      const stayDuration = Math.floor(Math.random() * 3) + 3; // 3-5 nights
      const checkOut = new Date(checkIn.getTime() + stayDuration * 24 * 60 * 60 * 1000);

      const baseRate = 8000 + Math.floor(Math.random() * 4000); // Premium rates
      const totalAmount = baseRate * stayDuration;

      bookings.push({
        hotelId: hotel._id,
        userId: guest._id,
        rooms: [{
          roomId: room._id,
          roomNumber: room.roomNumber,
          roomType: room.type,
          rate: baseRate,
          guests: 2
        }],
        bookingNumber: `VIP${Date.now()}${i.toString().padStart(2, '0')}`,
        status: 'confirmed',
        checkIn: checkIn,
        checkOut: checkOut,
        nights: stayDuration,
        adults: 2,
        children: 0,
        totalAmount: totalAmount,
        paidAmount: totalAmount, // VIPs pay in full
        balanceAmount: 0,
        guestType: 'vip',
        source: 'direct',
        paymentStatus: 'paid',
        specialRequests: ['Airport pickup', 'Champagne on arrival', 'Late checkout'],
        vipStatus: 'svip',
        notes: 'VIP guest - special attention required',
        createdAt: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000),
        updatedAt: new Date()
      });
    }

    // Create the bookings
    const createdBookings = await Booking.insertMany(bookings);
    logger.success(`Created ${createdBookings.length} realistic bookings`);

    // Update room statuses based on bookings
    logger.info('Updating room statuses based on bookings...');

    const occupiedRoomIds = createdBookings
      .filter(b => b.status === 'checked_in')
      .map(b => b.rooms[0].roomId);

    const reservedRoomIds = createdBookings
      .filter(b => b.status === 'confirmed')
      .map(b => b.rooms[0].roomId);

    // Update room statuses
    await Room.updateMany(
      { _id: { $in: occupiedRoomIds } },
      { status: 'occupied', lastCleaned: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    );

    await Room.updateMany(
      { _id: { $in: reservedRoomIds } },
      { status: 'reserved' }
    );

    // Set some rooms as dirty (recently checked out)
    const recentCheckouts = createdBookings
      .filter(b => b.status === 'checked_out' &&
        b.checkOut > new Date(Date.now() - 2 * 24 * 60 * 60 * 1000))
      .map(b => b.rooms[0].roomId)
      .slice(0, 5);

    await Room.updateMany(
      { _id: { $in: recentCheckouts } },
      { status: 'dirty', lastCleaned: null }
    );

    logger.success('Room statuses updated successfully');

    // Print summary
    const summary = await Booking.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: '$paidAmount' } } }
    ]);

    console.log('\n📊 Booking Summary:');
    summary.forEach(s => {
      console.log(`   ${s._id}: ${s.count} bookings (₹${s.revenue.toLocaleString()})`);
    });

    const totalRevenue = summary.reduce((acc, s) => acc + s.revenue, 0);
    console.log(`   Total Revenue: ₹${totalRevenue.toLocaleString()}`);

    logger.success('Booking seeding completed successfully!');

  } catch (error) {
    logger.error(`Seeding failed: ${error.message}`);
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
}

seedBookingsOnly();