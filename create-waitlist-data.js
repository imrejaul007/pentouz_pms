import mongoose from 'mongoose';
import WaitingList from './src/models/WaitingList.js';
import Hotel from './src/models/Hotel.js';
import User from './src/models/User.js';

const MONGO_URI = "mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

async function createWaitlistData() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Get hotel and user
    const hotel = await Hotel.findOne();
    const user = await User.findOne({ role: 'admin' });

    if (!hotel || !user) {
      console.log('Missing hotel or user data');
      return;
    }

    console.log(`Using hotel: ${hotel.name}`);
    console.log(`Using user: ${user.name}`);

    // Clear existing waiting list
    await WaitingList.deleteMany({});

    // Create sample waiting list entries
    const entries = [
      {
        guestName: 'Sarah Johnson',
        email: 'sarah@email.com',
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
        notes: [{
          content: 'VIP guest - Platinum member',
          createdBy: user._id,
          isInternal: true,
          createdAt: new Date()
        }]
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
        notes: [{
          content: 'Corporate guest - frequent traveler',
          createdBy: user._id,
          isInternal: true,
          createdAt: new Date()
        }]
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
        notes: [{
          content: 'Family vacation booking request',
          createdBy: user._id,
          isInternal: true,
          createdAt: new Date()
        }]
      }
    ];

    // Create entries one by one to trigger pre-save middleware
    const created = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = new WaitingList(entries[i]);
      const saved = await entry.save();
      created.push(saved);
      console.log(`Created entry: ${saved.guestName} (${saved.waitlistId})`);
    }

    console.log(`✅ Created ${created.length} waiting list entries`);

    // Verify creation
    const count = await WaitingList.countDocuments();
    console.log(`Total waiting list entries: ${count}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  }
}

createWaitlistData();