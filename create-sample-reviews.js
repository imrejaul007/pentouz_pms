import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function createSampleData() {
  try {
    await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/hotel-management');
    console.log('Connected to MongoDB');
    
    // First, create a sample hotel if none exists
    let hotel = await mongoose.connection.db.collection('hotels').findOne({});
    if (!hotel) {
      const hotelData = {
        _id: new mongoose.Types.ObjectId('68b19648e35a38ee7b1d1828'),
        name: 'The Pentouz',
        description: 'Luxury hotel in the heart of the city',
        address: {
          street: '123 Hotel Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          zipCode: '400001',
          country: 'India'
        },
        phone: '+91-9876543210',
        email: 'info@thepentouz.com',
        amenities: ['wifi', 'pool', 'gym', 'spa', 'restaurant'],
        images: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await mongoose.connection.db.collection('hotels').insertOne(hotelData);
      hotel = hotelData;
      console.log('Sample hotel created');
    }

    // Create sample users for the reviews
    const users = [];
    const userNames = [
      'John Smith', 'Sarah Johnson', 'Michael Brown', 'Emma Davis', 'James Wilson',
      'Lisa Anderson', 'David Miller', 'Jennifer Garcia', 'Robert Martinez', 'Amanda Taylor'
    ];

    for (let i = 0; i < userNames.length; i++) {
      const userData = {
        _id: new mongoose.Types.ObjectId(),
        name: userNames[i],
        email: `user${i+1}@example.com`,
        password: 'hashedpassword',
        role: 'guest',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      users.push(userData);
    }

    // Insert users (ignore duplicates)
    try {
      await mongoose.connection.db.collection('users').insertMany(users, { ordered: false });
      console.log('Sample users created');
    } catch (err) {
      console.log('Some users may already exist, continuing...');
    }

    // Check if reviews already exist
    const existingReviews = await mongoose.connection.db.collection('reviews').countDocuments({});
    if (existingReviews > 0) {
      console.log(`${existingReviews} reviews already exist. Skipping review creation.`);
      mongoose.connection.close();
      return;
    }

    // Create sample reviews
    const sampleReviews = [
      {
        _id: new mongoose.Types.ObjectId(),
        hotelId: hotel._id,
        userId: users[0]._id,
        rating: 5,
        title: 'Outstanding Experience!',
        content: 'The Pentouz exceeded all my expectations. The staff was incredibly friendly, the room was spotless, and the location is perfect. The breakfast buffet was amazing with so many options. I will definitely be staying here again on my next visit to Mumbai.',
        categories: {
          cleanliness: 5,
          service: 5,
          location: 5,
          value: 4,
          amenities: 5
        },
        isVerified: true,
        isPublished: true,
        moderationStatus: 'approved',
        helpfulVotes: 12,
        visitType: 'business',
        guestName: userNames[0],
        stayDate: new Date('2024-01-15'),
        source: 'direct',
        language: 'en',
        createdAt: new Date('2024-01-20'),
        updatedAt: new Date('2024-01-20')
      },
      {
        _id: new mongoose.Types.ObjectId(),
        hotelId: hotel._id,
        userId: users[1]._id,
        rating: 4,
        title: 'Great Stay with Minor Issues',
        content: 'Overall had a wonderful time at The Pentouz. The room was comfortable and the pool area was fantastic. The only minor issue was the slow WiFi in my room, but the staff was quick to help resolve it. Great value for money and would recommend to friends.',
        categories: {
          cleanliness: 4,
          service: 5,
          location: 4,
          value: 5,
          amenities: 3
        },
        isVerified: true,
        isPublished: true,
        moderationStatus: 'approved',
        helpfulVotes: 8,
        visitType: 'leisure',
        guestName: userNames[1],
        stayDate: new Date('2024-01-10'),
        source: 'direct',
        language: 'en',
        createdAt: new Date('2024-01-12'),
        updatedAt: new Date('2024-01-12')
      },
      {
        _id: new mongoose.Types.ObjectId(),
        hotelId: hotel._id,
        userId: users[2]._id,
        rating: 5,
        title: 'Perfect for Families',
        content: 'Stayed here with my wife and two kids. The hotel is very family-friendly with a great kids pool and playground. The rooms are spacious and clean. The restaurant has excellent food with options for children. Staff went above and beyond to make our stay comfortable.',
        categories: {
          cleanliness: 5,
          service: 5,
          location: 4,
          value: 4,
          amenities: 5
        },
        isVerified: true,
        isPublished: true,
        moderationStatus: 'approved',
        helpfulVotes: 15,
        visitType: 'family',
        guestName: userNames[2],
        stayDate: new Date('2024-02-01'),
        source: 'direct',
        language: 'en',
        createdAt: new Date('2024-02-05'),
        updatedAt: new Date('2024-02-05')
      },
      {
        _id: new mongoose.Types.ObjectId(),
        hotelId: hotel._id,
        userId: users[3]._id,
        rating: 3,
        title: 'Average Experience',
        content: 'The hotel is decent but nothing special. Room was clean but dated. Service was okay but not exceptional. Location is good for business travelers. Price is reasonable for what you get. Would consider other options next time.',
        categories: {
          cleanliness: 3,
          service: 3,
          location: 4,
          value: 3,
          amenities: 3
        },
        isVerified: true,
        isPublished: true,
        moderationStatus: 'approved',
        helpfulVotes: 3,
        visitType: 'business',
        guestName: userNames[3],
        stayDate: new Date('2024-01-25'),
        source: 'direct',
        language: 'en',
        createdAt: new Date('2024-01-28'),
        updatedAt: new Date('2024-01-28')
      },
      {
        _id: new mongoose.Types.ObjectId(),
        hotelId: hotel._id,
        userId: users[4]._id,
        rating: 5,
        title: 'Luxury at Its Best',
        content: 'What an incredible stay! From the moment we walked in, we were treated like royalty. The concierge helped us plan our entire trip. The spa services were world-class, and the rooftop restaurant has the most amazing view of the city. Worth every penny!',
        categories: {
          cleanliness: 5,
          service: 5,
          location: 5,
          value: 4,
          amenities: 5
        },
        isVerified: true,
        isPublished: true,
        moderationStatus: 'approved',
        helpfulVotes: 20,
        visitType: 'couple',
        guestName: userNames[4],
        stayDate: new Date('2024-02-14'),
        source: 'direct',
        language: 'en',
        createdAt: new Date('2024-02-16'),
        updatedAt: new Date('2024-02-16')
      },
      {
        _id: new mongoose.Types.ObjectId(),
        hotelId: hotel._id,
        userId: users[5]._id,
        rating: 4,
        title: 'Comfortable Business Stay',
        content: 'Perfect location for business meetings downtown. The business center was well-equipped and the conference rooms were professional. Room service was prompt and food quality was good. Would definitely book again for business trips.',
        categories: {
          cleanliness: 4,
          service: 4,
          location: 5,
          value: 4,
          amenities: 4
        },
        isVerified: true,
        isPublished: true,
        moderationStatus: 'approved',
        helpfulVotes: 7,
        visitType: 'business',
        guestName: userNames[5],
        stayDate: new Date('2024-02-20'),
        source: 'direct',
        language: 'en',
        createdAt: new Date('2024-02-22'),
        updatedAt: new Date('2024-02-22'),
        response: {
          content: 'Thank you for your wonderful review! We\'re delighted that our business facilities met your needs. We look forward to hosting you again on your next business trip to Mumbai.',
          respondedBy: new mongoose.Types.ObjectId(),
          respondedAt: new Date('2024-02-23')
        }
      },
      {
        _id: new mongoose.Types.ObjectId(),
        hotelId: hotel._id,
        userId: users[6]._id,
        rating: 2,
        title: 'Disappointing Stay',
        content: 'Unfortunately, my experience was below expectations. The room had maintenance issues with the air conditioning, and it took hours to get it fixed. The breakfast selection was limited and the food was cold. Service was slow throughout my stay.',
        categories: {
          cleanliness: 2,
          service: 2,
          location: 4,
          value: 2,
          amenities: 2
        },
        isVerified: true,
        isPublished: true,
        moderationStatus: 'approved',
        helpfulVotes: 1,
        visitType: 'business',
        guestName: userNames[6],
        stayDate: new Date('2024-01-30'),
        source: 'direct',
        language: 'en',
        createdAt: new Date('2024-02-01'),
        updatedAt: new Date('2024-02-01'),
        response: {
          content: 'We sincerely apologize for the issues during your stay. We have addressed the maintenance problems and improved our breakfast service. We would like to invite you back for a complimentary stay to make up for this experience.',
          respondedBy: new mongoose.Types.ObjectId(),
          respondedAt: new Date('2024-02-02')
        }
      },
      {
        _id: new mongoose.Types.ObjectId(),
        hotelId: hotel._id,
        userId: users[7]._id,
        rating: 4,
        title: 'Lovely Weekend Getaway',
        content: 'Booked this for a weekend getaway and was pleasantly surprised. The pool area is beautiful and perfect for relaxation. Room was clean and comfortable. The location is great for exploring the city. Staff was helpful with recommendations for local attractions.',
        categories: {
          cleanliness: 4,
          service: 4,
          location: 5,
          value: 4,
          amenities: 4
        },
        isVerified: true,
        isPublished: true,
        moderationStatus: 'approved',
        helpfulVotes: 9,
        visitType: 'leisure',
        guestName: userNames[7],
        stayDate: new Date('2024-02-10'),
        source: 'direct',
        language: 'en',
        createdAt: new Date('2024-02-12'),
        updatedAt: new Date('2024-02-12')
      }
    ];

    await mongoose.connection.db.collection('reviews').insertMany(sampleReviews);
    console.log(`Created ${sampleReviews.length} sample reviews`);
    
    // Verify the reviews were created
    const reviewCount = await mongoose.connection.db.collection('reviews').countDocuments({});
    console.log(`Total reviews in database: ${reviewCount}`);
    
    mongoose.connection.close();
    console.log('Database seeding completed successfully!');
    
  } catch (err) {
    console.error('Error:', err.message);
    mongoose.connection.close();
  }
}

createSampleData();