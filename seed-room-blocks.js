import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TapeChartModels from './src/models/TapeChart.js';
import Room from './src/models/Room.js';
import Hotel from './src/models/Hotel.js';
import User from './src/models/User.js';

dotenv.config();

const { RoomBlock } = TapeChartModels;

async function seedRoomBlocks() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hotel-management');
    console.log('MongoDB connected successfully');

    // Get existing data
    const hotel = await Hotel.findOne();
    const rooms = await Room.find({ isActive: true }).limit(20);
    const users = await User.find({ role: 'admin' }).limit(1);

    if (!hotel || rooms.length === 0 || users.length === 0) {
      console.error('Missing required data. Run main seed script first.');
      return;
    }

    console.log(`Found hotel: ${hotel.name}`);
    console.log(`Found ${rooms.length} rooms`);
    console.log(`Found ${users.length} admin users`);

    // Create sample room blocks
    const roomBlocksData = [
      {
        blockId: 'BLOCK-TECH-2025-001',
        blockName: 'Tech Conference 2025',
        groupName: 'TechCorp International',
        eventType: 'conference',
        startDate: new Date('2025-03-15'),
        endDate: new Date('2025-03-17'),
        rooms: rooms.slice(0, 5).map(room => ({
          roomId: room._id,
          roomNumber: room.roomNumber,
          roomType: room.type,
          rate: 4500,
          status: 'blocked'
        })),
        totalRooms: 5,
        roomsBooked: 2,
        roomsReleased: 0,
        blockRate: 4500,
        currency: 'INR',
        cutOffDate: new Date('2025-03-10'),
        status: 'active',
        contactPerson: {
          name: 'Sarah Johnson',
          email: 'sarah@techcorp.com',
          phone: '+1-555-0123',
          title: 'Event Coordinator'
        },
        billingInstructions: 'master_account',
        specialInstructions: 'Provide welcome desk in lobby, conference room setup needed',
        amenities: ['Wi-Fi', 'Breakfast', 'Conference Room Access'],
        notes: [
          {
            content: 'Initial room block created for tech conference',
            createdBy: users[0]._id,
            isInternal: true
          }
        ],
        createdBy: users[0]._id
      },
      {
        blockId: 'BLOCK-WEDDING-2025-002',
        blockName: 'Smith-Williams Wedding',
        groupName: 'Wedding Party',
        eventType: 'wedding',
        startDate: new Date('2025-04-12'),
        endDate: new Date('2025-04-14'),
        rooms: rooms.slice(5, 15).map(room => ({
          roomId: room._id,
          roomNumber: room.roomNumber,
          roomType: room.type,
          rate: 5500,
          status: 'blocked'
        })),
        totalRooms: 10,
        roomsBooked: 6,
        roomsReleased: 1,
        blockRate: 5500,
        currency: 'INR',
        cutOffDate: new Date('2025-04-05'),
        status: 'confirmed',
        contactPerson: {
          name: 'Michael Smith',
          email: 'michael.smith@email.com',
          phone: '+1-555-0456',
          title: 'Groom'
        },
        billingInstructions: 'individual_folios',
        specialInstructions: 'Wedding reception in banquet hall, flower arrangements needed',
        amenities: ['Champagne Welcome', 'Late Checkout', 'Spa Access'],
        cateringRequirements: 'Vegetarian options required, no nuts',
        notes: [
          {
            content: 'Wedding block confirmed, deposit received',
            createdBy: users[0]._id,
            isInternal: false
          }
        ],
        createdBy: users[0]._id
      },
      {
        blockId: 'BLOCK-CORPORATE-2025-003',
        blockName: 'Corporate Sales Summit',
        groupName: 'Global Sales Inc',
        eventType: 'corporate_event',
        startDate: new Date('2025-05-20'),
        endDate: new Date('2025-05-23'),
        rooms: rooms.slice(15, 20).map(room => ({
          roomId: room._id,
          roomNumber: room.roomNumber,
          roomType: room.type,
          rate: 4000,
          status: 'blocked'
        })),
        totalRooms: 5,
        roomsBooked: 1,
        roomsReleased: 0,
        blockRate: 4000,
        currency: 'INR',
        cutOffDate: new Date('2025-05-15'),
        status: 'active',
        contactPerson: {
          name: 'Jennifer Lopez',
          email: 'j.lopez@globalsales.com',
          phone: '+1-555-0789',
          title: 'HR Director'
        },
        billingInstructions: 'split_billing',
        specialInstructions: 'Executive floor preferred, early breakfast service needed',
        amenities: ['Business Center', 'Executive Lounge', 'Express Checkout'],
        notes: [],
        createdBy: users[0]._id
      }
    ];

    console.log('Creating room blocks...');
    await RoomBlock.deleteMany({});
    const createdRoomBlocks = await RoomBlock.create(roomBlocksData);
    console.log(`✅ Created ${createdRoomBlocks.length} room blocks`);

    // Update some rooms to "occupied" status to simulate real data
    const techConferenceBlock = createdRoomBlocks[0];
    techConferenceBlock.rooms[0].status = 'occupied';
    techConferenceBlock.rooms[0].guestName = 'John Doe';
    techConferenceBlock.rooms[1].status = 'occupied';
    techConferenceBlock.rooms[1].guestName = 'Jane Smith';
    techConferenceBlock.roomsBooked = 2;
    await techConferenceBlock.save();

    const weddingBlock = createdRoomBlocks[1];
    for (let i = 0; i < 6; i++) {
      weddingBlock.rooms[i].status = 'occupied';
      weddingBlock.rooms[i].guestName = `Wedding Guest ${i + 1}`;
    }
    weddingBlock.rooms[6].status = 'released';
    weddingBlock.roomsBooked = 6;
    weddingBlock.roomsReleased = 1;
    await weddingBlock.save();

    const corporateBlock = createdRoomBlocks[2];
    corporateBlock.rooms[0].status = 'occupied';
    corporateBlock.rooms[0].guestName = 'Corporate Executive';
    corporateBlock.roomsBooked = 1;
    await corporateBlock.save();

    console.log('✅ Room blocks seeded successfully with realistic data!');
    process.exit(0);

  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seedRoomBlocks();