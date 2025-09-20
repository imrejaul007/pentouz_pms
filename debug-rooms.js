import mongoose from 'mongoose';
import Room from './src/models/Room.js';
import Booking from './src/models/Booking.js';

// Connect to MongoDB
await mongoose.connect('mongodb://localhost:27017/hotel_management');

console.log('=== ROOM DEBUGGING ===');

// Get all rooms without any filter
const allRooms = await Room.find({});
console.log('Total rooms in database:', allRooms.length);

if (allRooms.length > 0) {
  console.log('Sample room:', {
    id: allRooms[0]._id,
    hotelId: allRooms[0].hotelId,
    roomNumber: allRooms[0].roomNumber,
    status: allRooms[0].status,
    isActive: allRooms[0].isActive
  });
  
  // Group by hotelId
  const roomsByHotel = {};
  allRooms.forEach(room => {
    const hotelId = room.hotelId.toString();
    if (!roomsByHotel[hotelId]) {
      roomsByHotel[hotelId] = [];
    }
    roomsByHotel[hotelId].push({
      id: room._id,
      roomNumber: room.roomNumber,
      status: room.status,
      isActive: room.isActive
    });
  });
  
  console.log('Rooms by hotelId:');
  Object.keys(roomsByHotel).forEach(hotelId => {
    console.log(`Hotel ${hotelId}: ${roomsByHotel[hotelId].length} rooms`);
  });
}

console.log('\n=== BOOKING DEBUGGING ===');

// Get all bookings
const allBookings = await Booking.find({});
console.log('Total bookings in database:', allBookings.length);

if (allBookings.length > 0) {
  console.log('Sample booking:', {
    id: allBookings[0]._id,
    hotelId: allBookings[0].hotelId,
    status: allBookings[0].status,
    checkIn: allBookings[0].checkIn,
    checkOut: allBookings[0].checkOut,
    roomIds: allBookings[0].rooms.map(r => r.roomId)
  });
}

// Test the specific hotelId we're using
const testHotelId = '68afe8080c02fcbe30092b8e';
console.log(`\n=== TESTING HOTEL ID: ${testHotelId} ===`);

const roomsForHotel = await Room.find({ hotelId: testHotelId });
console.log(`Rooms found for hotel ${testHotelId}:`, roomsForHotel.length);

const bookingsForHotel = await Booking.find({ hotelId: testHotelId });
console.log(`Bookings found for hotel ${testHotelId}:`, bookingsForHotel.length);

process.exit(0);
