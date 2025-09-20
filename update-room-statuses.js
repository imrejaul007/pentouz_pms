import mongoose from 'mongoose';
import Booking from './src/models/Booking.js';
import Room from './src/models/Room.js';
import Hotel from './src/models/Hotel.js';

const MONGO_URI = "mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

async function updateRoomStatuses() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const hotel = await Hotel.findOne();
    if (!hotel) {
      console.log('No hotel found');
      return;
    }

    console.log(`Processing room statuses for hotel: ${hotel.name}`);

    const today = new Date();
    console.log(`Current date/time: ${today.toISOString()}`);

    // Get all rooms
    const rooms = await Room.find({ hotelId: hotel._id });
    console.log(`Found ${rooms.length} rooms`);

    // Get all current bookings (checked in or confirmed for today)
    const currentBookings = await Booking.find({
      hotelId: hotel._id,
      checkIn: { $lte: today },
      checkOut: { $gt: today },
      status: { $in: ['confirmed', 'checked_in'] }
    }).populate('rooms.roomId');

    console.log(`Found ${currentBookings.length} current bookings`);

    // Reset all rooms to vacant first
    await Room.updateMany(
      { hotelId: hotel._id },
      {
        $unset: { currentBooking: 1 },
        $set: {
          status: 'vacant',
          lastUpdated: today
        }
      }
    );

    console.log('Reset all rooms to vacant status');

    let occupiedCount = 0;

    // Update room statuses based on current bookings
    for (const booking of currentBookings) {
      for (const roomBooking of booking.rooms) {
        await Room.findByIdAndUpdate(roomBooking.roomId, {
          status: booking.status === 'checked_in' ? 'occupied' : 'reserved',
          currentBooking: booking._id,
          lastUpdated: today
        });

        if (booking.status === 'checked_in') {
          occupiedCount++;
        }

        console.log(`Updated room ${roomBooking.roomId} to ${booking.status === 'checked_in' ? 'occupied' : 'reserved'} for booking ${booking.bookingNumber}`);
      }
    }

    // Set some additional room statuses for realism
    const vacantRooms = await Room.find({
      hotelId: hotel._id,
      status: 'vacant'
    });

    // Set 8% of remaining vacant rooms to maintenance
    const maintenanceCount = Math.min(8, Math.floor(vacantRooms.length * 0.08));
    for (let i = 0; i < maintenanceCount; i++) {
      const room = vacantRooms[i];
      await Room.findByIdAndUpdate(room._id, {
        status: 'maintenance',
        lastUpdated: today
      });
      console.log(`Set room ${room.roomNumber} to maintenance`);
    }

    // Set 5% to dirty/cleaning status
    const dirtyCount = Math.min(5, Math.floor(vacantRooms.length * 0.05));
    for (let i = maintenanceCount; i < maintenanceCount + dirtyCount; i++) {
      if (i < vacantRooms.length) {
        const room = vacantRooms[i];
        await Room.findByIdAndUpdate(room._id, {
          status: 'dirty',
          lastUpdated: today
        });
        console.log(`Set room ${room.roomNumber} to dirty`);
      }
    }

    // Summary of room statuses
    const statusSummary = await Room.aggregate([
      { $match: { hotelId: hotel._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    console.log('\n📊 ROOM STATUS SUMMARY:');
    statusSummary.forEach(status => {
      console.log(`   ${status._id}: ${status.count} rooms`);
    });

    const totalRooms = rooms.length;
    const occupancyRate = ((occupiedCount / totalRooms) * 100).toFixed(1);
    console.log(`\n🏨 OCCUPANCY RATE: ${occupancyRate}%`);
    console.log(`   Occupied: ${occupiedCount}/${totalRooms} rooms`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  }
}

updateRoomStatuses();