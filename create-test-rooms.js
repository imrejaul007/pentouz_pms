import mongoose from 'mongoose';
import Room from './src/models/Room.js';

// Connect to MongoDB
await mongoose.connect('mongodb://localhost:27017/hotel_management');

const hotelId = '68afe8080c02fcbe30092b8e';

// Create test rooms
const testRooms = [
  {
    hotelId,
    roomNumber: '101',
    type: 'single',
    baseRate: 1500,
    currentRate: 1500,
    status: 'vacant',
    floor: 1,
    capacity: 2,
    amenities: ['WiFi', 'TV', 'AC'],
    images: [],
    description: 'Comfortable single room with modern amenities',
    isActive: true
  },
  {
    hotelId,
    roomNumber: '102',
    type: 'double',
    baseRate: 2000,
    currentRate: 2000,
    status: 'vacant',
    floor: 1,
    capacity: 4,
    amenities: ['WiFi', 'TV', 'AC', 'Mini Bar'],
    images: [],
    description: 'Spacious double room perfect for families',
    isActive: true
  },
  {
    hotelId,
    roomNumber: '201',
    type: 'suite',
    baseRate: 3500,
    currentRate: 3500,
    status: 'vacant',
    floor: 2,
    capacity: 6,
    amenities: ['WiFi', 'TV', 'AC', 'Mini Bar', 'Balcony', 'Room Service'],
    images: [],
    description: 'Luxury suite with premium amenities',
    isActive: true
  },
  {
    hotelId,
    roomNumber: '202',
    type: 'deluxe',
    baseRate: 2800,
    currentRate: 2800,
    status: 'vacant',
    floor: 2,
    capacity: 4,
    amenities: ['WiFi', 'TV', 'AC', 'Mini Bar', 'Balcony'],
    images: [],
    description: 'Deluxe room with city view',
    isActive: true
  },
  {
    hotelId,
    roomNumber: '301',
    type: 'single',
    baseRate: 1500,
    currentRate: 1500,
    status: 'maintenance',
    floor: 3,
    capacity: 2,
    amenities: ['WiFi', 'TV', 'AC'],
    images: [],
    description: 'Single room under maintenance',
    isActive: true
  },
  {
    hotelId,
    roomNumber: '302',
    type: 'double',
    baseRate: 2000,
    currentRate: 2000,
    status: 'dirty',
    floor: 3,
    capacity: 4,
    amenities: ['WiFi', 'TV', 'AC'],
    images: [],
    description: 'Double room being cleaned',
    isActive: true
  }
];

// Create the rooms
for (const roomData of testRooms) {
  const room = new Room(roomData);
  await room.save();
  console.log('Created room:', room.roomNumber, 'with status:', room.status);
}

console.log('Test rooms created successfully!');
process.exit(0);
