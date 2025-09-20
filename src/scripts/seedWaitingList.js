import mongoose from 'mongoose';
import dotenv from 'dotenv';
import WaitingList from '../models/WaitingList.js';
import Hotel from '../models/Hotel.js';
import User from '../models/User.js';
import Booking from '../models/Booking.js';

dotenv.config();

// Sample waiting list data for realistic scenarios
const sampleWaitlistEntries = [
  {
    guestName: 'Sarah Johnson',
    email: 'sarah.johnson@email.com',
    phone: '+1-555-0123',
    roomType: 'Deluxe Suite',
    preferredDates: {
      checkIn: new Date('2024-12-15'),
      checkOut: new Date('2024-12-18')
    },
    alternativeDates: [
      {
        checkIn: new Date('2024-12-20'),
        checkOut: new Date('2024-12-23')
      },
      {
        checkIn: new Date('2024-12-22'),
        checkOut: new Date('2024-12-25')
      }
    ],
    guests: 2,
    priority: 'high',
    vipStatus: true,
    loyaltyTier: 'Platinum',
    specialRequests: 'Ocean view preferred, late checkout requested',
    contactPreference: 'email',
    maxRate: 450,
    source: 'direct',
    notificationPreferences: {
      email: true,
      sms: false,
      phone: false
    }
  },
  {
    guestName: 'Michael Chen',
    email: 'mchen@company.com',
    phone: '+1-555-0456',
    roomType: 'Executive Room',
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
    notificationPreferences: {
      email: true,
      sms: true,
      phone: true
    }
  },
  {
    guestName: 'Emily Rodriguez',
    email: 'emily.rodriguez@email.com',
    phone: '+1-555-0789',
    roomType: 'Standard Room',
    preferredDates: {
      checkIn: new Date('2024-12-20'),
      checkOut: new Date('2024-12-22')
    },
    alternativeDates: [
      {
        checkIn: new Date('2024-12-23'),
        checkOut: new Date('2024-12-25')
      }
    ],
    guests: 3,
    priority: 'low',
    vipStatus: false,
    specialRequests: 'Family room, extra bed for child required',
    contactPreference: 'sms',
    maxRate: 180,
    source: 'expedia',
    notificationPreferences: {
      email: false,
      sms: true,
      phone: false
    }
  },
  {
    guestName: 'James Wilson',
    email: 'j.wilson@corporate.com',
    phone: '+1-555-0321',
    roomType: 'Deluxe Room',
    preferredDates: {
      checkIn: new Date('2024-12-10'),
      checkOut: new Date('2024-12-12')
    },
    guests: 1,
    priority: 'medium',
    vipStatus: false,
    loyaltyTier: 'Silver',
    specialRequests: 'Quiet room, business amenities',
    contactPreference: 'email',
    maxRate: 320,
    source: 'corporate',
    notificationPreferences: {
      email: true,
      sms: false,
      phone: false
    }
  },
  {
    guestName: 'Maria Garcia',
    email: 'maria.garcia@gmail.com',
    phone: '+1-555-0987',
    roomType: 'Presidential Suite',
    preferredDates: {
      checkIn: new Date('2024-12-28'),
      checkOut: new Date('2024-12-31')
    },
    guests: 4,
    priority: 'high',
    vipStatus: true,
    loyaltyTier: 'Diamond',
    specialRequests: 'New Year celebration, champagne service, connecting rooms',
    contactPreference: 'phone',
    maxRate: 800,
    source: 'direct',
    notificationPreferences: {
      email: true,
      sms: true,
      phone: true
    }
  }
];

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected for waiting list seeding');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function seedWaitingList() {
  try {
    console.log('🌱 Starting waiting list seeding...');

    // Get hotel and admin user for references
    const hotel = await Hotel.findOne({ name: /pentouz/i });
    if (!hotel) {
      throw new Error('Hotel not found. Please run basic seed first.');
    }

    const adminUser = await User.findOne({ email: 'admin@hotel.com' });
    if (!adminUser) {
      throw new Error('Admin user not found. Please run basic seed first.');
    }

    console.log(`📊 Using hotel: ${hotel.name}`);
    console.log(`👤 Using admin user: ${adminUser.name}`);

    // Clear existing waiting list entries
    await WaitingList.deleteMany({});
    console.log('🗑️ Cleared existing waiting list entries');

    // Create waiting list entries
    const waitlistEntries = [];

    for (let i = 0; i < sampleWaitlistEntries.length; i++) {
      const entryData = sampleWaitlistEntries[i];

      const entry = {
        ...entryData,
        hotelId: hotel._id,
        addedDate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random date within last 7 days
        notes: [
          {
            content: `Waiting list entry created via ${entryData.source}`,
            createdBy: adminUser._id,
            isInternal: true,
            createdAt: new Date()
          },
          {
            content: entryData.vipStatus ? 'VIP guest - ensure premium service' : 'Standard service level',
            createdBy: adminUser._id,
            isInternal: true,
            createdAt: new Date()
          }
        ]
      };

      // Add some contact history for some entries
      if (i < 2) {
        entry.contactHistory = [
          {
            contactDate: new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000),
            method: entryData.contactPreference,
            message: 'Initial contact - confirmed preferences',
            contactedBy: adminUser._id
          }
        ];
        entry.lastContact = new Date(Date.now() - Math.random() * 2 * 24 * 60 * 60 * 1000);
        entry.status = 'contacted';
      } else {
        entry.status = 'active';
      }

      waitlistEntries.push(entry);
    }

    const createdEntries = await WaitingList.insertMany(waitlistEntries);
    console.log(`✅ Created ${createdEntries.length} waiting list entries`);

    // Display summary
    console.log('\n📊 Summary of created entries:');
    const statusCounts = await WaitingList.aggregate([
      { $match: { hotelId: hotel._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const priorityCounts = await WaitingList.aggregate([
      { $match: { hotelId: hotel._id } },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    const vipCount = await WaitingList.countDocuments({ hotelId: hotel._id, vipStatus: true });

    console.log('\nStatus breakdown:');
    statusCounts.forEach(stat => {
      console.log(`  • ${stat._id}: ${stat.count}`);
    });

    console.log('\nPriority breakdown:');
    priorityCounts.forEach(stat => {
      console.log(`  • ${stat._id}: ${stat.count}`);
    });

    console.log(`\nVIP guests: ${vipCount}`);

    console.log('\n🎉 Waiting list seeding completed successfully!');

  } catch (error) {
    console.error('❌ Error seeding waiting list:', error);
    throw error;
  }
}

async function main() {
  try {
    await connectDB();
    await seedWaitingList();
    console.log('\n✅ Waiting list seeding completed successfully');
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

export default { seedWaitingList };