import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Hotel from '../models/Hotel.js';
import Room from '../models/Room.js';
import Booking from '../models/Booking.js';
import TapeChart from '../models/TapeChart.js';
import WaitingList from '../models/WaitingList.js';

dotenv.config();

const {
  RoomConfiguration,
  RoomStatusHistory,
  RoomBlock,
  AdvancedReservation,
  TapeChartView,
  RoomAssignmentRules
} = TapeChart;

// Sample data for realistic tape chart scenarios
const sampleConfigs = [
  // Executive Floor Rooms
  { roomNumber: '501', roomType: 'Deluxe Suite', floor: 5, building: 'Main', wing: 'North' },
  { roomNumber: '502', roomType: 'Deluxe Suite', floor: 5, building: 'Main', wing: 'North' },
  { roomNumber: '503', roomType: 'Executive Room', floor: 5, building: 'Main', wing: 'North' },
  { roomNumber: '504', roomType: 'Executive Room', floor: 5, building: 'Main', wing: 'North' },
  { roomNumber: '505', roomType: 'Presidential Suite', floor: 5, building: 'Main', wing: 'South' },

  // Business Floor
  { roomNumber: '401', roomType: 'Business Room', floor: 4, building: 'Main', wing: 'North' },
  { roomNumber: '402', roomType: 'Business Room', floor: 4, building: 'Main', wing: 'North' },
  { roomNumber: '403', roomType: 'Business Suite', floor: 4, building: 'Main', wing: 'North' },
  { roomNumber: '404', roomType: 'Business Suite', floor: 4, building: 'Main', wing: 'South' },
  { roomNumber: '405', roomType: 'Conference Suite', floor: 4, building: 'Main', wing: 'South' },

  // Standard Rooms
  { roomNumber: '301', roomType: 'Standard Room', floor: 3, building: 'Main', wing: 'North' },
  { roomNumber: '302', roomType: 'Standard Room', floor: 3, building: 'Main', wing: 'North' },
  { roomNumber: '303', roomType: 'Deluxe Room', floor: 3, building: 'Main', wing: 'North' },
  { roomNumber: '304', roomType: 'Deluxe Room', floor: 3, building: 'Main', wing: 'South' },
  { roomNumber: '305', roomType: 'Family Room', floor: 3, building: 'Main', wing: 'South' },

  // Garden Wing
  { roomNumber: 'G101', roomType: 'Garden View', floor: 1, building: 'Garden', wing: 'East' },
  { roomNumber: 'G102', roomType: 'Garden View', floor: 1, building: 'Garden', wing: 'East' },
  { roomNumber: 'G103', roomType: 'Garden Suite', floor: 1, building: 'Garden', wing: 'East' },
  { roomNumber: 'G201', roomType: 'Garden Deluxe', floor: 2, building: 'Garden', wing: 'West' },
  { roomNumber: 'G202', roomType: 'Garden Suite', floor: 2, building: 'Garden', wing: 'West' }
];

const roomBlockScenarios = [
  {
    blockName: 'TechCorp Annual Conference 2025',
    groupName: 'TechCorp India Pvt Ltd',
    eventType: 'conference',
    totalRooms: 15,
    startDate: new Date('2025-09-20'),
    endDate: new Date('2025-09-23'),
    blockRate: 18000,
    contactPerson: {
      name: 'Rajesh Kumar',
      email: 'rajesh.kumar@techcorp.in',
      phone: '+91-9876543210',
      title: 'Event Manager'
    },
    specialInstructions: 'Late check-out required for all guests. Welcome drinks on arrival.',
    cateringRequirements: 'Conference hall setup with A/V equipment. Daily breakfast and lunch.'
  },
  {
    blockName: 'Wedding Block - Sharma Family',
    groupName: 'Sharma-Gupta Wedding',
    eventType: 'wedding',
    totalRooms: 8,
    startDate: new Date('2025-09-25'),
    endDate: new Date('2025-09-27'),
    blockRate: 22000,
    contactPerson: {
      name: 'Priya Sharma',
      email: 'priya.sharma@gmail.com',
      phone: '+91-9876543211',
      title: 'Bride\'s Sister'
    },
    specialInstructions: 'Flower petals and welcome gifts in rooms. Early check-in for bride\'s family.',
    cateringRequirements: 'Traditional Indian breakfast. Room service 24/7.'
  },
  {
    blockName: 'Medical Tourism Group',
    groupName: 'Apollo Health Tourism',
    eventType: 'tour_group',
    totalRooms: 6,
    startDate: new Date('2025-09-18'),
    endDate: new Date('2025-09-22'),
    blockRate: 15000,
    contactPerson: {
      name: 'Dr. Sarah Johnson',
      email: 'sarah.johnson@apollo.com',
      phone: '+91-9876543212',
      title: 'Medical Coordinator'
    },
    specialInstructions: 'Wheelchair accessible rooms required. Hospital shuttle service.',
    cateringRequirements: 'Special dietary requirements. Light continental breakfast.'
  }
];

const sampleGuestProfiles = [
  {
    name: 'Arjun Patel',
    vipStatus: 'platinum',
    loyaltyNumber: 'PLAT-001234',
    preferences: {
      bedType: 'King Size',
      pillowType: 'Memory Foam',
      roomTemperature: 22,
      newspaper: 'Times of India',
      wakeUpCall: true,
      turndownService: true
    },
    specialNeeds: ['High floor preference', 'Quiet room']
  },
  {
    name: 'Michelle Chen',
    vipStatus: 'gold',
    loyaltyNumber: 'GOLD-005678',
    preferences: {
      bedType: 'Queen Size',
      pillowType: 'Down',
      roomTemperature: 20,
      newspaper: 'Economic Times',
      wakeUpCall: false,
      turndownService: true
    },
    allergies: ['Nuts', 'Shellfish'],
    dietaryRestrictions: ['Vegetarian']
  },
  {
    name: 'Robert Williams',
    vipStatus: 'silver',
    loyaltyNumber: 'SILV-009012',
    preferences: {
      bedType: 'Twin Beds',
      pillowType: 'Standard',
      roomTemperature: 24,
      wakeUpCall: true,
      turndownService: false
    },
    specialNeeds: ['Business center access', 'Late checkout']
  }
];

const assignmentRulesData = [
  {
    ruleName: 'VIP Guest Premium Floor Assignment',
    priority: 1,
    conditions: {
      guestType: ['vip', 'platinum', 'diamond'],
      roomTypes: ['Deluxe Suite', 'Presidential Suite', 'Executive Room']
    },
    actions: {
      preferredFloors: [5, 4],
      upgradeEligible: true,
      upgradeFromTypes: ['Standard Room', 'Deluxe Room'],
      upgradeToTypes: ['Executive Room', 'Deluxe Suite'],
      amenityPackages: ['Welcome Champagne', 'Premium Toiletries', 'Priority Housekeeping']
    }
  },
  {
    ruleName: 'Corporate Guest Business Floor',
    priority: 2,
    conditions: {
      guestType: ['corporate'],
      reservationType: ['corporate'],
      lengthOfStay: { min: 2, max: 14 }
    },
    actions: {
      preferredFloors: [4],
      preferredRoomNumbers: ['401', '402', '403', '404'],
      amenityPackages: ['Business Center Access', 'Extended WiFi', 'Early Breakfast']
    }
  },
  {
    ruleName: 'Family Group Adjacent Rooms',
    priority: 3,
    conditions: {
      reservationType: ['group'],
      roomTypes: ['Family Room', 'Deluxe Room']
    },
    actions: {
      preferredFloors: [3],
      amenityPackages: ['Kids Welcome Kit', 'Extra Towels', 'Baby Cot if needed']
    }
  },
  {
    ruleName: 'Garden View for Leisure Guests',
    priority: 4,
    conditions: {
      guestType: ['leisure'],
      lengthOfStay: { min: 3, max: 10 }
    },
    actions: {
      preferredFloors: [1, 2],
      preferredRoomNumbers: ['G101', 'G102', 'G103', 'G201', 'G202'],
      amenityPackages: ['Garden Tour', 'Spa Discount', 'Welcome Fruit Basket']
    }
  }
];

const tapeChartViews = [
  {
    viewName: 'Daily Operations View',
    viewType: 'daily',
    dateRange: {
      defaultDays: 1
    },
    displaySettings: {
      showWeekends: true,
      roomSorting: 'floor',
      showGuestNames: true,
      showRoomTypes: true,
      showRates: false,
      compactView: false
    },
    filters: {
      floors: [1, 2, 3, 4, 5],
      roomTypes: ['Standard Room', 'Deluxe Room', 'Executive Room', 'Suite'],
      statuses: ['available', 'occupied', 'reserved', 'maintenance']
    },
    isSystemDefault: true
  },
  {
    viewName: 'Weekly Management View',
    viewType: 'weekly',
    dateRange: {
      defaultDays: 7
    },
    displaySettings: {
      showWeekends: true,
      roomSorting: 'room_number',
      showGuestNames: true,
      showRoomTypes: false,
      showRates: true,
      compactView: true
    },
    filters: {
      floors: [3, 4, 5],
      roomTypes: ['Executive Room', 'Deluxe Suite', 'Presidential Suite']
    }
  },
  {
    viewName: 'Housekeeping Focus View',
    viewType: 'daily',
    dateRange: {
      defaultDays: 1
    },
    displaySettings: {
      showWeekends: true,
      roomSorting: 'status',
      showGuestNames: false,
      showRoomTypes: true,
      showRates: false,
      compactView: true
    },
    filters: {
      statuses: ['dirty', 'clean', 'maintenance', 'out_of_order']
    }
  }
];

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected for tape chart seeding');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function seedTapeChartData() {
  try {
    console.log('🌱 Starting tape chart data seeding...');

    // Get hotel and users for references
    const hotel = await Hotel.findOne({ name: /pentouz/i });
    if (!hotel) {
      throw new Error('Hotel not found. Please run basic seed first.');
    }

    const adminUser = await User.findOne({ email: 'admin@hotel.com' });
    if (!adminUser) {
      throw new Error('Admin user not found. Please run basic seed first.');
    }

    const rooms = await Room.find({ hotelId: hotel._id });
    if (rooms.length === 0) {
      throw new Error('No rooms found. Please run basic seed first.');
    }

    console.log(`📊 Found ${rooms.length} rooms in ${hotel.name}`);

    // 1. Seed Room Configurations
    console.log('🏠 Creating room configurations...');
    await RoomConfiguration.deleteMany({});

    const roomConfigs = [];
    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];
      // Use sample config if available, otherwise generate default config
      const config = sampleConfigs[i] || {
        roomNumber: room.roomNumber,
        roomType: room.roomType || 'Standard Room',
        floor: room.floor || Math.floor(parseInt(room.roomNumber) / 100) || 1,
        building: 'Main',
        wing: i % 2 === 0 ? 'North' : 'South'
      };

      roomConfigs.push({
        configId: `config_${room.roomNumber}_${Date.now()}_${i}`,
        roomNumber: room.roomNumber,
        roomType: room.roomType || config.roomType,
        floor: room.floor || config.floor,
        building: config.building,
        wing: config.wing,
        position: {
          row: Math.floor(i / 10) + 1,
          column: (i % 10) + 1,
          x: (i % 10) * 140 + 10,
          y: Math.floor(i / 10) * 60 + 10
        },
        displaySettings: {
          color: '#ffffff',
          width: 120,
          height: 50,
          showRoomNumber: true,
          showGuestName: true,
          showRoomType: true
        },
        sortOrder: i + 1
      });
    }

    const createdConfigs = await RoomConfiguration.insertMany(roomConfigs);
    console.log(`✅ Created ${createdConfigs.length} room configurations`);

    // 2. Seed Room Blocks
    console.log('🏢 Creating room blocks...');
    await RoomBlock.deleteMany({});

    const roomBlocks = [];
    for (const blockData of roomBlockScenarios) {
      const blockRooms = [];

      // Assign rooms to block
      for (let i = 0; i < Math.min(blockData.totalRooms, rooms.length - 5); i++) {
        const room = rooms[i + 5]; // Skip first 5 rooms
        blockRooms.push({
          roomId: room._id,
          roomNumber: room.roomNumber,
          roomType: room.roomType,
          rate: blockData.blockRate,
          status: i < blockData.totalRooms / 2 ? 'reserved' : 'blocked',
          guestName: i < blockData.totalRooms / 2 ? `Guest ${i + 1}` : null
        });
      }

      roomBlocks.push({
        blockId: `block_${blockData.blockName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}_${roomBlockScenarios.indexOf(blockData)}`,
        blockName: blockData.blockName,
        groupName: blockData.groupName,
        eventType: blockData.eventType,
        startDate: blockData.startDate,
        endDate: blockData.endDate,
        rooms: blockRooms,
        totalRooms: blockData.totalRooms,
        roomsBooked: Math.floor(blockData.totalRooms / 2),
        roomsReleased: 0,
        blockRate: blockData.blockRate,
        cutOffDate: new Date(blockData.startDate.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days before
        autoReleaseDate: new Date(blockData.startDate.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days before
        status: 'active',
        contactPerson: blockData.contactPerson,
        billingInstructions: 'master_account',
        specialInstructions: blockData.specialInstructions,
        amenities: ['WiFi', 'Breakfast', 'Parking'],
        cateringRequirements: blockData.cateringRequirements,
        createdBy: adminUser._id,
        lastModifiedBy: adminUser._id,
        notes: [{
          content: `Block created for ${blockData.eventType} event`,
          createdBy: adminUser._id,
          createdAt: new Date(),
          isInternal: true
        }]
      });
    }

    const createdBlocks = await RoomBlock.insertMany(roomBlocks);
    console.log(`✅ Created ${createdBlocks.length} room blocks`);

    // 3. Seed Advanced Reservations
    console.log('🎯 Creating advanced reservations...');
    await AdvancedReservation.deleteMany({});

    // Get some existing bookings to create advanced reservations
    const bookings = await Booking.find({ hotelId: hotel._id }).limit(5);

    const advancedReservations = [];
    for (let i = 0; i < Math.min(bookings.length, sampleGuestProfiles.length); i++) {
      const booking = bookings[i];
      const guestProfile = sampleGuestProfiles[i];
      const room = rooms[i];

      advancedReservations.push({
        reservationId: `ADV-${Date.now()}-${i + 1}`,
        bookingId: booking._id,
        reservationType: i === 0 ? 'vip' : i === 1 ? 'corporate' : 'standard',
        priority: guestProfile.vipStatus === 'platinum' ? 'vip' : 'high',
        roomPreferences: {
          preferredRooms: [room.roomNumber],
          preferredFloor: room.floor || 3,
          preferredView: 'Garden View',
          adjacentRooms: false,
          connectingRooms: false,
          accessibleRoom: false,
          smokingPreference: 'non_smoking'
        },
        guestProfile: {
          vipStatus: guestProfile.vipStatus,
          loyaltyNumber: guestProfile.loyaltyNumber,
          preferences: guestProfile.preferences,
          allergies: guestProfile.allergies || [],
          specialNeeds: guestProfile.specialNeeds || [],
          dietaryRestrictions: guestProfile.dietaryRestrictions || []
        },
        roomAssignments: [{
          roomId: room._id,
          roomNumber: room.roomNumber,
          assignedDate: new Date(),
          assignmentType: 'auto',
          assignedBy: adminUser._id,
          notes: 'Auto-assigned based on preferences'
        }],
        specialRequests: [
          {
            type: 'amenities',
            description: 'Extra pillows and towels',
            priority: 'medium',
            status: 'pending',
            assignedTo: adminUser._id,
            dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
            cost: 0
          }
        ],
        reservationFlags: [
          {
            flag: guestProfile.vipStatus === 'platinum' ? 'vip' : 'loyalty_member',
            severity: 'info',
            description: `${guestProfile.vipStatus} member requires special attention`,
            createdBy: adminUser._id
          }
        ]
      });
    }

    const createdReservations = await AdvancedReservation.insertMany(advancedReservations);
    console.log(`✅ Created ${createdReservations.length} advanced reservations`);

    // 4. Seed Tape Chart Views
    console.log('👁️ Creating tape chart views...');
    await TapeChartView.deleteMany({});

    const views = tapeChartViews.map((view, index) => ({
      ...view,
      viewId: `view_${view.viewName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}_${index}`,
      createdBy: adminUser._id
    }));

    const createdViews = await TapeChartView.insertMany(views);
    console.log(`✅ Created ${createdViews.length} tape chart views`);

    // 5. Seed Room Assignment Rules
    console.log('📋 Creating room assignment rules...');
    await RoomAssignmentRules.deleteMany({});

    const rules = assignmentRulesData.map((rule, index) => ({
      ...rule,
      ruleId: `rule_${rule.ruleName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}_${index}`,
      createdBy: adminUser._id,
      lastModifiedBy: adminUser._id
    }));

    const createdRules = await RoomAssignmentRules.insertMany(rules);
    console.log(`✅ Created ${createdRules.length} assignment rules`);

    // 6. Seed Room Status History
    console.log('📈 Creating room status history...');
    await RoomStatusHistory.deleteMany({});

    const statusHistory = [];
    const statuses = ['available', 'occupied', 'reserved', 'dirty', 'clean', 'maintenance'];

    for (let i = 0; i < 50; i++) {
      const room = rooms[i % rooms.length];
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * 7)); // Last 7 days

      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const previousStatus = statuses[Math.floor(Math.random() * statuses.length)];

      statusHistory.push({
        historyId: `history_${room.roomNumber}_${Date.now()}_${i}`,
        roomId: room._id,
        date: date,
        status: status,
        previousStatus: previousStatus,
        guestName: status === 'occupied' ? `Guest ${Math.floor(Math.random() * 100)}` : null,
        checkIn: status === 'occupied' ? date : null,
        checkOut: status === 'occupied' ? new Date(date.getTime() + 2 * 24 * 60 * 60 * 1000) : null,
        notes: `Status changed from ${previousStatus} to ${status}`,
        changedBy: adminUser._id,
        changeReason: 'Regular operations',
        duration: Math.floor(Math.random() * 480) + 60, // 1-8 hours
        priority: Math.random() > 0.7 ? 'high' : 'medium'
      });
    }

    const createdHistory = await RoomStatusHistory.insertMany(statusHistory);
    console.log(`✅ Created ${createdHistory.length} status history records`);

    // 7. Seed Waiting List Entries
    console.log('📝 Creating waiting list entries...');
    await WaitingList.deleteMany({});

    const waitlistData = [
      {
        guestName: 'Sarah Johnson',
        email: 'sarah.johnson@email.com',
        phone: '+1-555-0123',
        roomType: 'Deluxe Suite',
        hotelId: hotel._id,
        preferredDates: {
          checkIn: new Date('2024-12-15'),
          checkOut: new Date('2024-12-18')
        },
        guests: 2,
        priority: 'high',
        vipStatus: true,
        loyaltyTier: 'Platinum',
        specialRequests: 'Ocean view preferred, late checkout',
        contactPreference: 'email',
        maxRate: 450,
        source: 'direct',
        status: 'active',
        notes: [
          {
            content: 'VIP guest - Platinum member',
            createdBy: adminUser._id,
            isInternal: true,
            createdAt: new Date()
          }
        ]
      },
      {
        guestName: 'Michael Chen',
        email: 'mchen@company.com',
        phone: '+1-555-0456',
        roomType: 'Executive Room',
        hotelId: hotel._id,
        preferredDates: {
          checkIn: new Date('2024-12-12'),
          checkOut: new Date('2024-12-14')
        },
        guests: 1,
        priority: 'medium',
        vipStatus: false,
        loyaltyTier: 'Gold',
        specialRequests: 'Business center access, early breakfast',
        contactPreference: 'phone',
        maxRate: 280,
        source: 'booking.com',
        status: 'contacted',
        lastContact: new Date(),
        notes: [
          {
            content: 'Corporate guest - frequent traveler',
            createdBy: adminUser._id,
            isInternal: true,
            createdAt: new Date()
          }
        ],
        contactHistory: [
          {
            contactDate: new Date(),
            method: 'phone',
            message: 'Confirmed availability preferences',
            contactedBy: adminUser._id
          }
        ]
      },
      {
        guestName: 'Emily Rodriguez',
        email: 'emily.r@email.com',
        phone: '+1-555-0789',
        roomType: 'Standard Room',
        hotelId: hotel._id,
        preferredDates: {
          checkIn: new Date('2024-12-20'),
          checkOut: new Date('2024-12-22')
        },
        guests: 3,
        priority: 'low',
        vipStatus: false,
        specialRequests: 'Family room, extra bed for child',
        contactPreference: 'sms',
        maxRate: 180,
        source: 'expedia',
        status: 'active',
        notes: [
          {
            content: 'Family vacation booking request',
            createdBy: adminUser._id,
            isInternal: true,
            createdAt: new Date()
          }
        ]
      }
    ];

    const createdWaitlist = await WaitingList.insertMany(waitlistData);
    console.log(`✅ Created ${createdWaitlist.length} waiting list entries`);

    console.log('\n🎉 Tape chart data seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   • Room Configurations: ${createdConfigs.length}`);
    console.log(`   • Room Blocks: ${createdBlocks.length}`);
    console.log(`   • Advanced Reservations: ${createdReservations.length}`);
    console.log(`   • Tape Chart Views: ${createdViews.length}`);
    console.log(`   • Assignment Rules: ${createdRules.length}`);
    console.log(`   • Status History Records: ${createdHistory.length}`);
    console.log(`   • Waiting List Entries: ${createdWaitlist.length}`);
    console.log('\n✨ Your tape chart should now display realistic operational data!');

  } catch (error) {
    console.error('❌ Error seeding tape chart data:', error);
    throw error;
  }
}

async function main() {
  try {
    await connectDB();
    await seedTapeChartData();
    console.log('\n✅ Tape chart seeding completed successfully');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
}

// Run the seeding if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default { seedTapeChartData };