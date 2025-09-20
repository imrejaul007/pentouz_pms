const { MongoClient } = require('mongodb');

const mongoURI = "mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management?retryWrites=true&w=majority&appName=Cluster0";

async function seedCRMData() {
  const client = new MongoClient(mongoURI);

  try {
    await client.connect();
    console.log('✅ MongoDB connected successfully');

    const db = client.db('hotel-management');

    // Get hotels and users
    const hotels = await db.collection('hotels').find().limit(3).toArray();
    const users = await db.collection('users').find({ role: 'guest' }).limit(20).toArray();

    console.log(`Found ${hotels.length} hotels and ${users.length} guest users`);

    if (hotels.length === 0 || users.length === 0) {
      console.log('❌ No hotels or users found. Please seed them first.');
      return;
    }

    // Clear existing CRM data
    await db.collection('guestcrmprofiles').deleteMany({});
    await db.collection('guestbehaviors').deleteMany({});
    console.log('🧹 Cleared existing CRM data');

    const profiles = [];
    const behaviors = [];

    // Create sample data
    for (const hotel of hotels) {
      for (let i = 0; i < Math.min(10, users.length); i++) {
        const user = users[i];

        // Create CRM profile
        const profile = {
          userId: user._id,
          hotelId: hotel._id,
          personalInfo: {
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.email,
            phone: user.phone || '',
            dateOfBirth: user.dateOfBirth,
            nationality: user.nationality || ''
          },
          preferences: {
            roomType: ['standard', 'deluxe', 'suite'][Math.floor(Math.random() * 3)],
            bedType: ['single', 'double', 'king'][Math.floor(Math.random() * 3)],
            smokingPreference: Math.random() > 0.8 ? 'smoking' : 'non-smoking',
            floorPreference: ['low', 'middle', 'high', 'any'][Math.floor(Math.random() * 4)],
            specialRequests: []
          },
          rfmAnalysis: {
            recency: { value: Math.floor(Math.random() * 365), score: Math.floor(Math.random() * 5) + 1 },
            frequency: { value: Math.floor(Math.random() * 10), score: Math.floor(Math.random() * 5) + 1 },
            monetary: { value: Math.floor(Math.random() * 5000), score: Math.floor(Math.random() * 5) + 1 },
            segment: ['Champions', 'Loyal Customers', 'New Customers', 'At Risk'][Math.floor(Math.random() * 4)],
            lastCalculated: new Date()
          },
          engagementMetrics: {
            totalBookings: Math.floor(Math.random() * 10),
            totalSpending: Math.floor(Math.random() * 5000),
            averageBookingValue: Math.floor(Math.random() * 500) + 100,
            totalPageViews: Math.floor(Math.random() * 100),
            totalEmailOpens: Math.floor(Math.random() * 50),
            totalEmailClicks: Math.floor(Math.random() * 20),
            lastEngagement: new Date(),
            averageEngagementScore: Math.floor(Math.random() * 100)
          },
          loyaltyMetrics: {
            score: Math.floor(Math.random() * 100),
            tier: ['Bronze', 'Silver', 'Gold', 'Platinum'][Math.floor(Math.random() * 4)],
            points: Math.floor(Math.random() * 10000),
            lifetimeValue: Math.floor(Math.random() * 10000)
          },
          lifecycleStage: ['prospect', 'new_customer', 'active', 'loyal', 'at_risk'][Math.floor(Math.random() * 5)],
          communicationPreferences: {
            email: true,
            sms: Math.random() > 0.5,
            push: Math.random() > 0.3,
            phone: Math.random() > 0.8,
            language: 'en',
            timezone: 'UTC',
            frequency: 'weekly',
            preferredTime: Math.floor(Math.random() * 24)
          },
          tags: ['new-guest'],
          notes: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };

        profiles.push(profile);

        // Create sample behaviors
        for (let j = 0; j < 5; j++) {
          const behaviorTypes = ['page_view', 'room_search', 'room_view', 'email_open', 'booking_complete'];
          const behavior = {
            userId: user._id,
            hotelId: hotel._id,
            sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            behaviorType: behaviorTypes[Math.floor(Math.random() * behaviorTypes.length)],
            pageUrl: '/rooms',
            deviceType: ['desktop', 'mobile', 'tablet'][Math.floor(Math.random() * 3)],
            source: ['direct', 'organic', 'paid'][Math.floor(Math.random() * 3)],
            engagementScore: Math.floor(Math.random() * 100),
            timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
            interactionData: {},
            transactionValue: 0
          };

          behaviors.push(behavior);
        }
      }
    }

    // Insert data
    if (profiles.length > 0) {
      await db.collection('guestcrmprofiles').insertMany(profiles);
      console.log(`✅ Created ${profiles.length} CRM profiles`);
    }

    if (behaviors.length > 0) {
      await db.collection('guestbehaviors').insertMany(behaviors);
      console.log(`✅ Created ${behaviors.length} guest behaviors`);
    }

    console.log('🎉 CRM data seeding completed successfully!');

  } catch (error) {
    console.error('❌ Error seeding CRM data:', error);
  } finally {
    await client.close();
    console.log('📤 Database connection closed');
  }
}

seedCRMData();