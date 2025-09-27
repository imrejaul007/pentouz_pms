import mongoose from 'mongoose';
import TravelAgent from './src/models/TravelAgent.js';
import User from './src/models/User.js';
import TravelAgentBooking from './src/models/TravelAgentBooking.js';

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management?retryWrites=true&w=majority&appName=Cluster0";

// Hotel ID for the travel agents
const HOTEL_ID = new mongoose.Types.ObjectId('68cd01414419c17b5f6b4c12');

const sampleTravelAgents = [
  {
    agentCode: 'TA001',
    companyName: 'Elite Travel Agency',
    contactPerson: 'John Smith',
    phone: '+1-555-123-4567',
    email: 'john@elitetravel.com',
    hotelId: HOTEL_ID,
    address: {
      street: '123 Travel Street',
      city: 'New York',
      state: 'NY',
      country: 'USA',
      zipCode: '10001'
    },
    businessDetails: {
      licenseNumber: 'LIC123456',
      gstNumber: 'GST789012',
      establishedYear: 2015,
      businessType: 'both'
    },
    commissionStructure: {
      defaultRate: 8,
      seasonalRates: [
        {
          season: 'peak',
          commissionRate: 10,
          validFrom: new Date('2024-12-01'),
          validTo: new Date('2024-12-31')
        }
      ]
    },
    bookingLimits: {
      maxBookingsPerDay: 20,
      maxRoomsPerBooking: 5,
      maxAdvanceBookingDays: 180
    },
    paymentTerms: {
      creditLimit: 50000,
      paymentDueDays: 30,
      preferredPaymentMethod: 'bank_transfer'
    },
    status: 'active',
    performanceMetrics: {
      totalBookings: 150,
      totalRevenue: 450000,
      totalCommissionEarned: 36000,
      averageBookingValue: 3000,
      lastBookingDate: new Date('2024-09-20')
    },
    notes: 'High-performing agent with excellent track record'
  },
  {
    agentCode: 'TA002',
    companyName: 'Global Tours & Travel',
    contactPerson: 'Sarah Johnson',
    phone: '+1-555-234-5678',
    email: 'sarah@globaltoursandtravel.com',
    hotelId: HOTEL_ID,
    address: {
      street: '456 Tourism Ave',
      city: 'Los Angeles',
      state: 'CA',
      country: 'USA',
      zipCode: '90210'
    },
    businessDetails: {
      licenseNumber: 'LIC234567',
      gstNumber: 'GST890123',
      establishedYear: 2018,
      businessType: 'international'
    },
    commissionStructure: {
      defaultRate: 7.5
    },
    bookingLimits: {
      maxBookingsPerDay: 15,
      maxRoomsPerBooking: 10,
      maxAdvanceBookingDays: 365
    },
    paymentTerms: {
      creditLimit: 75000,
      paymentDueDays: 15,
      preferredPaymentMethod: 'online'
    },
    status: 'active',
    performanceMetrics: {
      totalBookings: 200,
      totalRevenue: 680000,
      totalCommissionEarned: 51000,
      averageBookingValue: 3400,
      lastBookingDate: new Date('2024-09-21')
    },
    notes: 'Specializes in international group bookings'
  },
  {
    agentCode: 'TA003',
    companyName: 'Budget Travel Solutions',
    contactPerson: 'Mike Chen',
    phone: '+1-555-345-6789',
    email: 'mike@budgettravel.com',
    hotelId: HOTEL_ID,
    address: {
      street: '789 Economy Lane',
      city: 'Chicago',
      state: 'IL',
      country: 'USA',
      zipCode: '60601'
    },
    businessDetails: {
      licenseNumber: 'LIC345678',
      gstNumber: 'GST901234',
      establishedYear: 2020,
      businessType: 'domestic'
    },
    commissionStructure: {
      defaultRate: 6
    },
    bookingLimits: {
      maxBookingsPerDay: 25,
      maxRoomsPerBooking: 3,
      maxAdvanceBookingDays: 90
    },
    paymentTerms: {
      creditLimit: 30000,
      paymentDueDays: 45,
      preferredPaymentMethod: 'bank_transfer'
    },
    status: 'active',
    performanceMetrics: {
      totalBookings: 300,
      totalRevenue: 420000,
      totalCommissionEarned: 25200,
      averageBookingValue: 1400,
      cancellationRate: 8,
      lastBookingDate: new Date('2024-09-19')
    },
    notes: 'Focuses on budget-friendly domestic travel'
  },
  {
    agentCode: 'TA004',
    companyName: 'Luxury Escapes Ltd',
    contactPerson: 'Emma Rodriguez',
    phone: '+1-555-456-7890',
    email: 'emma@luxuryescapes.com',
    hotelId: HOTEL_ID,
    address: {
      street: '321 Premium Boulevard',
      city: 'Miami',
      state: 'FL',
      country: 'USA',
      zipCode: '33101'
    },
    businessDetails: {
      licenseNumber: 'LIC456789',
      gstNumber: 'GST012345',
      establishedYear: 2012,
      businessType: 'both'
    },
    commissionStructure: {
      defaultRate: 12,
      seasonalRates: [
        {
          season: 'high',
          commissionRate: 15,
          validFrom: new Date('2024-06-01'),
          validTo: new Date('2024-08-31')
        }
      ]
    },
    bookingLimits: {
      maxBookingsPerDay: 10,
      maxRoomsPerBooking: 8,
      maxAdvanceBookingDays: 365
    },
    paymentTerms: {
      creditLimit: 100000,
      paymentDueDays: 7,
      preferredPaymentMethod: 'bank_transfer'
    },
    status: 'active',
    performanceMetrics: {
      totalBookings: 80,
      totalRevenue: 960000,
      totalCommissionEarned: 115200,
      averageBookingValue: 12000,
      cancellationRate: 2,
      lastBookingDate: new Date('2024-09-22')
    },
    notes: 'High-end luxury travel specialist with VIP clients'
  },
  {
    agentCode: 'TA005',
    companyName: 'Corporate Travel Management',
    contactPerson: 'David Wilson',
    phone: '+1-555-567-8901',
    email: 'david@corptravelmanagement.com',
    hotelId: HOTEL_ID,
    address: {
      street: '654 Business Center',
      city: 'Seattle',
      state: 'WA',
      country: 'USA',
      zipCode: '98101'
    },
    businessDetails: {
      licenseNumber: 'LIC567890',
      gstNumber: 'GST123456',
      establishedYear: 2016,
      businessType: 'both'
    },
    commissionStructure: {
      defaultRate: 9
    },
    bookingLimits: {
      maxBookingsPerDay: 30,
      maxRoomsPerBooking: 15,
      maxAdvanceBookingDays: 180
    },
    paymentTerms: {
      creditLimit: 150000,
      paymentDueDays: 30,
      preferredPaymentMethod: 'bank_transfer'
    },
    status: 'active',
    performanceMetrics: {
      totalBookings: 250,
      totalRevenue: 875000,
      totalCommissionEarned: 78750,
      averageBookingValue: 3500,
      cancellationRate: 4,
      lastBookingDate: new Date('2024-09-21')
    },
    notes: 'Specializes in corporate business travel and conferences'
  },
  {
    agentCode: 'TA006',
    companyName: 'Adventure Travel Co',
    contactPerson: 'Lisa Thompson',
    phone: '+1-555-678-9012',
    email: 'lisa@adventuretravel.com',
    hotelId: HOTEL_ID,
    address: {
      street: '987 Explorer Way',
      city: 'Denver',
      state: 'CO',
      country: 'USA',
      zipCode: '80201'
    },
    businessDetails: {
      licenseNumber: 'LIC678901',
      gstNumber: 'GST234567',
      establishedYear: 2019,
      businessType: 'domestic'
    },
    commissionStructure: {
      defaultRate: 7
    },
    bookingLimits: {
      maxBookingsPerDay: 12,
      maxRoomsPerBooking: 4,
      maxAdvanceBookingDays: 120
    },
    paymentTerms: {
      creditLimit: 40000,
      paymentDueDays: 30,
      preferredPaymentMethod: 'bank_transfer'
    },
    status: 'pending_approval',
    performanceMetrics: {
      totalBookings: 45,
      totalRevenue: 180000,
      totalCommissionEarned: 12600,
      averageBookingValue: 4000,
      cancellationRate: 6,
      lastBookingDate: new Date('2024-09-18')
    },
    notes: 'New agent specializing in adventure and outdoor activities'
  },
  {
    agentCode: 'TA007',
    companyName: 'Family Vacation Experts',
    contactPerson: 'Robert Martinez',
    phone: '+1-555-789-0123',
    email: 'robert@familyvacationexperts.com',
    hotelId: HOTEL_ID,
    address: {
      street: '147 Family Lane',
      city: 'Orlando',
      state: 'FL',
      country: 'USA',
      zipCode: '32801'
    },
    businessDetails: {
      licenseNumber: 'LIC789012',
      gstNumber: 'GST345678',
      establishedYear: 2017,
      businessType: 'domestic'
    },
    commissionStructure: {
      defaultRate: 8.5
    },
    bookingLimits: {
      maxBookingsPerDay: 18,
      maxRoomsPerBooking: 6,
      maxAdvanceBookingDays: 150
    },
    paymentTerms: {
      creditLimit: 60000,
      paymentDueDays: 21,
      preferredPaymentMethod: 'online'
    },
    status: 'active',
    performanceMetrics: {
      totalBookings: 180,
      totalRevenue: 540000,
      totalCommissionEarned: 45900,
      averageBookingValue: 3000,
      cancellationRate: 7,
      lastBookingDate: new Date('2024-09-20')
    },
    notes: 'Focuses on family-friendly destinations and activities'
  },
  {
    agentCode: 'TA008',
    companyName: 'Honeymoon Destinations',
    contactPerson: 'Jennifer Lee',
    phone: '+1-555-890-1234',
    email: 'jennifer@honeymoon-destinations.com',
    hotelId: HOTEL_ID,
    address: {
      street: '258 Romance Street',
      city: 'San Francisco',
      state: 'CA',
      country: 'USA',
      zipCode: '94102'
    },
    businessDetails: {
      licenseNumber: 'LIC890123',
      gstNumber: 'GST456789',
      establishedYear: 2021,
      businessType: 'international'
    },
    commissionStructure: {
      defaultRate: 10
    },
    bookingLimits: {
      maxBookingsPerDay: 8,
      maxRoomsPerBooking: 2,
      maxAdvanceBookingDays: 365
    },
    paymentTerms: {
      creditLimit: 25000,
      paymentDueDays: 14,
      preferredPaymentMethod: 'online'
    },
    status: 'active',
    performanceMetrics: {
      totalBookings: 60,
      totalRevenue: 360000,
      totalCommissionEarned: 36000,
      averageBookingValue: 6000,
      cancellationRate: 3,
      lastBookingDate: new Date('2024-09-22')
    },
    notes: 'Specializes in romantic getaways and honeymoon packages'
  }
];

async function seedTravelAgentData() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing travel agents (except the original one if needed)
    console.log('\n🗑️ Clearing existing travel agents...');
    const existingAgents = await TravelAgent.find({});
    console.log(`Found ${existingAgents.length} existing travel agents`);

    // Delete all except keep one if it has important data
    await TravelAgent.deleteMany({});
    console.log('✅ Cleared existing travel agents');

    // Create sample users for travel agents (if they don't exist)
    console.log('\n👥 Creating sample users for travel agents...');
    const users = [];

    for (let i = 0; i < sampleTravelAgents.length; i++) {
      const agent = sampleTravelAgents[i];

      // Check if user exists
      let user = await User.findOne({ email: agent.email });

      if (!user) {
        user = new User({
          name: agent.contactPerson,
          email: agent.email,
          password: 'password123', // Will be hashed by the model
          phone: agent.phone,
          role: 'travel_agent',
          status: 'active',
          permissions: ['create_booking', 'view_booking', 'update_booking']
        });
        await user.save();
        console.log(`✅ Created user: ${user.name} (${user.email})`);
      }

      users.push(user);

      // Add userId to travel agent data
      sampleTravelAgents[i].userId = user._id;
    }

    // Create travel agents
    console.log('\n🏢 Creating travel agents...');
    const createdAgents = await TravelAgent.insertMany(sampleTravelAgents);
    console.log(`✅ Created ${createdAgents.length} travel agents`);

    // Display summary
    console.log('\n📊 Travel Agents Summary:');
    createdAgents.forEach((agent, index) => {
      console.log(`${index + 1}. ${agent.companyName} (${agent.agentCode}) - ${agent.status}`);
      console.log(`   Contact: ${agent.contactPerson} - ${agent.email}`);
      console.log(`   Performance: ${agent.performanceMetrics.totalBookings} bookings, ₹${agent.performanceMetrics.totalRevenue.toLocaleString()}`);
      console.log('');
    });

    console.log(`\n🎉 Successfully seeded ${createdAgents.length} travel agents!`);
    console.log(`💰 Total Revenue: ₹${createdAgents.reduce((sum, agent) => sum + agent.performanceMetrics.totalRevenue, 0).toLocaleString()}`);
    console.log(`📈 Total Bookings: ${createdAgents.reduce((sum, agent) => sum + agent.performanceMetrics.totalBookings, 0)}`);
    console.log(`🏆 Active Agents: ${createdAgents.filter(agent => agent.status === 'active').length}`);
    console.log(`⏳ Pending Approval: ${createdAgents.filter(agent => agent.status === 'pending_approval').length}`);

    // Now create sample bookings for analytics
    console.log('\n📝 Creating sample travel agent bookings for analytics...');
    
    // Clear existing bookings
    await TravelAgentBooking.deleteMany({});
    console.log('✅ Cleared existing bookings');

    const sampleBookings = [];
    const bookingStatuses = ['confirmed', 'completed', 'cancelled', 'no_show', 'modified'];
    const commissionPaymentStatuses = ['pending', 'paid', 'processing', 'cancelled']; // For commission.paymentStatus
    const paymentDetailsStatuses = ['pending', 'paid', 'partial', 'failed', 'refunded']; // For paymentDetails.status
    const seasons = ['peak', 'high', 'low', 'off'];

    // Generate 30 sample bookings
    for (let i = 0; i < 30; i++) {
      const agent = createdAgents[Math.floor(Math.random() * createdAgents.length)];
      const bookingDate = new Date();
      bookingDate.setDate(bookingDate.getDate() - Math.floor(Math.random() * 90)); // Last 90 days
      
      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + Math.floor(Math.random() * 30) + 1);
      
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + Math.floor(Math.random() * 7) + 1);
      
      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
      const rooms = Math.floor(Math.random() * 3) + 1;
      const guests = rooms * (Math.floor(Math.random() * 2) + 1);
      
      const baseRate = Math.floor(Math.random() * 5000) + 1000; // ₹1000-6000 per night
      const subtotal = baseRate * nights * rooms;
      const taxes = Math.floor(subtotal * 0.12); // 12% tax
      const fees = Math.floor(subtotal * 0.05); // 5% fees
      const totalAmount = subtotal + taxes + fees;
      
      const commissionRate = agent.commissionStructure?.defaultRate || 8;
      const commissionAmount = (subtotal * commissionRate) / 100;
      
      const booking = {
        bookingId: new mongoose.Types.ObjectId(), // Generate unique booking ID
        travelAgentId: agent._id,
        agentCode: agent.agentCode,
        hotelId: HOTEL_ID,
        guestDetails: {
          primaryGuest: {
            name: `Guest ${i + 1}`,
            email: `guest${i + 1}@example.com`,
            phone: `+91-98765-${String(43210 + i).padStart(5, '0')}`
          },
          totalGuests: guests,
          totalRooms: rooms
        },
        bookingDetails: {
          checkIn: checkIn,
          checkOut: checkOut,
          nights: nights,
          roomTypes: [{
            roomTypeId: new mongoose.Types.ObjectId(),
            roomTypeName: `Deluxe Room ${i + 1}`,
            quantity: rooms,
            ratePerNight: baseRate,
            totalAmount: subtotal
          }]
        },
        pricing: {
          subtotal: subtotal,
          taxes: taxes,
          fees: fees,
          totalAmount: totalAmount
        },
        commission: {
          rate: commissionRate,
          amount: commissionAmount,
          totalCommission: commissionAmount,
          paymentStatus: commissionPaymentStatuses[Math.floor(Math.random() * commissionPaymentStatuses.length)]
        },
        bookingStatus: bookingStatuses[Math.floor(Math.random() * bookingStatuses.length)],
        paymentDetails: {
          status: paymentDetailsStatuses[Math.floor(Math.random() * paymentDetailsStatuses.length)],
          method: ['credit_card', 'bank_transfer', 'cash', 'cheque', 'agent_credit'][Math.floor(Math.random() * 5)],
          amount: totalAmount
        },
        performance: {
          leadTime: Math.floor(Math.random() * 60) + 1, // 1-60 days
          seasonality: seasons[Math.floor(Math.random() * seasons.length)],
          conversionRate: Math.random() * 0.3 + 0.5 // 50-80%
        },
        confirmationNumber: `TA${agent.agentCode}-${String(1000 + i).padStart(4, '0')}`,
        specialRequests: i % 3 === 0 ? 'Late checkout requested' : null,
        isActive: true,
        createdAt: bookingDate,
        updatedAt: bookingDate
      };

      sampleBookings.push(booking);
    }

    // Create bookings
    const createdBookings = await TravelAgentBooking.insertMany(sampleBookings);
    console.log(`✅ Created ${createdBookings.length} travel agent bookings`);

    // Display booking summary
    console.log('\n📊 Travel Agent Bookings Summary:');
    const statusCounts = await TravelAgentBooking.aggregate([
      { $group: { _id: '$bookingStatus', count: { $sum: 1 } } }
    ]);
    
    const paymentCounts = await TravelAgentBooking.aggregate([
      { $group: { _id: '$commission.paymentStatus', count: { $sum: 1 } } }
    ]);

    console.log('\n📈 Booking Status Breakdown:');
    statusCounts.forEach(status => {
      console.log(`   ${status._id}: ${status.count} bookings`);
    });

    console.log('\n💰 Commission Payment Status:');
    paymentCounts.forEach(payment => {
      console.log(`   ${payment._id}: ${payment.count} bookings`);
    });

    const totalRevenue = await TravelAgentBooking.aggregate([
      { $group: { _id: null, total: { $sum: '$pricing.totalAmount' } } }
    ]);

    const totalCommission = await TravelAgentBooking.aggregate([
      { $group: { _id: null, total: { $sum: '$commission.totalCommission' } } }
    ]);

    console.log(`\n💰 Total Booking Revenue: ₹${totalRevenue[0]?.total?.toLocaleString() || 0}`);
    console.log(`💸 Total Commission: ₹${totalCommission[0]?.total?.toLocaleString() || 0}`);
    console.log(`📅 Date Range: Last 90 days`);

    console.log('\n🎉 Successfully seeded travel agents AND bookings!');

  } catch (error) {
    console.error('❌ Error seeding travel agent data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

seedTravelAgentData();