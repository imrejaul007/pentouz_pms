import 'dotenv/config';
import mongoose from 'mongoose';
import LocalAttraction from '../models/LocalAttraction.js';
import Hotel from '../models/Hotel.js';
import connectDB from '../config/database.js';

const attractionsData = [
  // Amenities
  {
    name: 'Central Fitness Center',
    description: 'State-of-the-art fitness center with modern equipment',
    category: 'amenities',
    distance: 0.3,
    address: '123 Fitness Street, Downtown',
    coordinates: { lat: 40.7589, lng: -73.9851 },
    rating: 4.5,
    imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b',
    website: 'https://centralfitness.com',
    phone: '+1-555-0123',
    openingHours: {
      monday: '6:00 AM - 10:00 PM',
      tuesday: '6:00 AM - 10:00 PM',
      wednesday: '6:00 AM - 10:00 PM',
      thursday: '6:00 AM - 10:00 PM',
      friday: '6:00 AM - 10:00 PM',
      saturday: '8:00 AM - 8:00 PM',
      sunday: '8:00 AM - 8:00 PM'
    }
  },
  {
    name: 'Spa Sanctuary',
    description: 'Luxury spa offering massages and wellness treatments',
    category: 'amenities',
    distance: 0.4,
    address: '456 Wellness Avenue, Downtown',
    coordinates: { lat: 40.7614, lng: -73.9776 },
    rating: 4.8,
    imageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874',
    website: 'https://spasanctuary.com',
    phone: '+1-555-0124',
    openingHours: {
      monday: '9:00 AM - 9:00 PM',
      tuesday: '9:00 AM - 9:00 PM',
      wednesday: '9:00 AM - 9:00 PM',
      thursday: '9:00 AM - 9:00 PM',
      friday: '9:00 AM - 9:00 PM',
      saturday: '10:00 AM - 6:00 PM',
      sunday: '10:00 AM - 6:00 PM'
    }
  },
  {
    name: 'City Library',
    description: 'Modern public library with extensive digital resources',
    category: 'amenities',
    distance: 0.6,
    address: '789 Knowledge Boulevard, Downtown',
    coordinates: { lat: 40.7505, lng: -73.9934 },
    rating: 4.3,
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
    website: 'https://citylibrary.gov',
    phone: '+1-555-0125',
    openingHours: {
      monday: '9:00 AM - 8:00 PM',
      tuesday: '9:00 AM - 8:00 PM',
      wednesday: '9:00 AM - 8:00 PM',
      thursday: '9:00 AM - 8:00 PM',
      friday: '9:00 AM - 6:00 PM',
      saturday: '10:00 AM - 5:00 PM',
      sunday: '12:00 PM - 5:00 PM'
    }
  },

  // Dining
  {
    name: 'Bella Vista Restaurant',
    description: 'Fine dining Italian restaurant with panoramic city views',
    category: 'dining',
    distance: 0.2,
    address: '321 Gourmet Street, Downtown',
    coordinates: { lat: 40.7580, lng: -73.9855 },
    rating: 4.7,
    imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4',
    website: 'https://bellavista-restaurant.com',
    phone: '+1-555-0201',
    openingHours: {
      monday: '5:00 PM - 11:00 PM',
      tuesday: '5:00 PM - 11:00 PM',
      wednesday: '5:00 PM - 11:00 PM',
      thursday: '5:00 PM - 11:00 PM',
      friday: '5:00 PM - 12:00 AM',
      saturday: '5:00 PM - 12:00 AM',
      sunday: '5:00 PM - 10:00 PM'
    }
  },
  {
    name: 'Corner Cafe',
    description: 'Cozy coffee shop with freshly baked pastries and artisan coffee',
    category: 'dining',
    distance: 0.1,
    address: '654 Coffee Lane, Downtown',
    coordinates: { lat: 40.7595, lng: -73.9840 },
    rating: 4.4,
    imageUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24',
    website: 'https://cornercafe.com',
    phone: '+1-555-0202',
    openingHours: {
      monday: '7:00 AM - 6:00 PM',
      tuesday: '7:00 AM - 6:00 PM',
      wednesday: '7:00 AM - 6:00 PM',
      thursday: '7:00 AM - 6:00 PM',
      friday: '7:00 AM - 8:00 PM',
      saturday: '8:00 AM - 8:00 PM',
      sunday: '8:00 AM - 5:00 PM'
    }
  },
  {
    name: 'Sakura Sushi Bar',
    description: 'Authentic Japanese sushi and traditional dishes',
    category: 'dining',
    distance: 0.5,
    address: '987 Sushi Avenue, Downtown',
    coordinates: { lat: 40.7556, lng: -73.9903 },
    rating: 4.6,
    imageUrl: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351',
    website: 'https://sakurasushi.com',
    phone: '+1-555-0203',
    openingHours: {
      monday: '12:00 PM - 10:00 PM',
      tuesday: '12:00 PM - 10:00 PM',
      wednesday: '12:00 PM - 10:00 PM',
      thursday: '12:00 PM - 10:00 PM',
      friday: '12:00 PM - 11:00 PM',
      saturday: '12:00 PM - 11:00 PM',
      sunday: '12:00 PM - 9:00 PM'
    }
  },

  // Attractions
  {
    name: 'City Museum',
    description: 'Historical exhibits and artifacts showcasing local heritage',
    category: 'attractions',
    distance: 0.5,
    address: '111 Museum Plaza, Downtown',
    coordinates: { lat: 40.7542, lng: -73.9912 },
    rating: 4.5,
    imageUrl: 'https://images.unsplash.com/photo-1565060299507-6fe7d8b27b8e',
    website: 'https://citymuseum.org',
    phone: '+1-555-0301',
    openingHours: {
      monday: 'Closed',
      tuesday: '10:00 AM - 6:00 PM',
      wednesday: '10:00 AM - 6:00 PM',
      thursday: '10:00 AM - 6:00 PM',
      friday: '10:00 AM - 6:00 PM',
      saturday: '10:00 AM - 8:00 PM',
      sunday: '10:00 AM - 6:00 PM'
    }
  },
  {
    name: 'Central Park',
    description: 'Public park with walking trails, playground and scenic views',
    category: 'attractions',
    distance: 1.2,
    address: '222 Park Road, Downtown',
    coordinates: { lat: 40.7484, lng: -73.9857 },
    rating: 4.3,
    imageUrl: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e',
    website: 'https://centralpark.gov',
    phone: '+1-555-0302',
    openingHours: {
      monday: '6:00 AM - 8:00 PM',
      tuesday: '6:00 AM - 8:00 PM',
      wednesday: '6:00 AM - 8:00 PM',
      thursday: '6:00 AM - 8:00 PM',
      friday: '6:00 AM - 8:00 PM',
      saturday: '6:00 AM - 9:00 PM',
      sunday: '6:00 AM - 9:00 PM'
    }
  },
  {
    name: 'Art Gallery Downtown',
    description: 'Contemporary art gallery featuring local and international artists',
    category: 'attractions',
    distance: 0.8,
    address: '333 Art Street, Downtown',
    coordinates: { lat: 40.7521, lng: -73.9887 },
    rating: 4.2,
    imageUrl: 'https://images.unsplash.com/photo-1544967882-63b966e8671a',
    website: 'https://artgallerydowntown.com',
    phone: '+1-555-0303',
    openingHours: {
      monday: 'Closed',
      tuesday: '11:00 AM - 7:00 PM',
      wednesday: '11:00 AM - 7:00 PM',
      thursday: '11:00 AM - 7:00 PM',
      friday: '11:00 AM - 9:00 PM',
      saturday: '10:00 AM - 9:00 PM',
      sunday: '10:00 AM - 6:00 PM'
    }
  },

  // Shopping
  {
    name: 'Downtown Shopping Plaza',
    description: 'Multi-level shopping center with brand stores and boutiques',
    category: 'shopping',
    distance: 0.7,
    address: '444 Commerce Boulevard, Downtown',
    coordinates: { lat: 40.7567, lng: -73.9821 },
    rating: 4.1,
    imageUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8',
    website: 'https://downtownplaza.com',
    phone: '+1-555-0401',
    openingHours: {
      monday: '10:00 AM - 9:00 PM',
      tuesday: '10:00 AM - 9:00 PM',
      wednesday: '10:00 AM - 9:00 PM',
      thursday: '10:00 AM - 9:00 PM',
      friday: '10:00 AM - 10:00 PM',
      saturday: '10:00 AM - 10:00 PM',
      sunday: '11:00 AM - 8:00 PM'
    }
  },
  {
    name: 'Artisan Market',
    description: 'Local craft market with handmade goods and specialty items',
    category: 'shopping',
    distance: 0.9,
    address: '555 Market Square, Downtown',
    coordinates: { lat: 40.7498, lng: -73.9945 },
    rating: 4.4,
    imageUrl: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc',
    website: 'https://artisanmarket.com',
    phone: '+1-555-0402',
    openingHours: {
      monday: 'Closed',
      tuesday: 'Closed',
      wednesday: '10:00 AM - 6:00 PM',
      thursday: '10:00 AM - 6:00 PM',
      friday: '10:00 AM - 8:00 PM',
      saturday: '9:00 AM - 8:00 PM',
      sunday: '10:00 AM - 6:00 PM'
    }
  },

  // Transport
  {
    name: 'Central Station',
    description: 'Main transportation hub with subway and bus connections',
    category: 'transport',
    distance: 0.4,
    address: '666 Transit Avenue, Downtown',
    coordinates: { lat: 40.7603, lng: -73.9789 },
    rating: 3.8,
    imageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957',
    website: 'https://centraltransit.gov',
    phone: '+1-555-0501',
    openingHours: {
      monday: '5:00 AM - 12:00 AM',
      tuesday: '5:00 AM - 12:00 AM',
      wednesday: '5:00 AM - 12:00 AM',
      thursday: '5:00 AM - 12:00 AM',
      friday: '5:00 AM - 1:00 AM',
      saturday: '5:00 AM - 1:00 AM',
      sunday: '6:00 AM - 12:00 AM'
    }
  },
  {
    name: 'City Bike Share Station',
    description: 'Convenient bike rental station for city exploration',
    category: 'transport',
    distance: 0.2,
    address: '777 Bike Lane, Downtown',
    coordinates: { lat: 40.7588, lng: -73.9863 },
    rating: 4.0,
    imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64',
    website: 'https://citybikes.com',
    phone: '+1-555-0502',
    openingHours: {
      monday: '24 hours',
      tuesday: '24 hours',
      wednesday: '24 hours',
      thursday: '24 hours',
      friday: '24 hours',
      saturday: '24 hours',
      sunday: '24 hours'
    }
  },

  // Medical
  {
    name: 'Downtown Medical Center',
    description: 'Full-service medical facility with emergency care',
    category: 'medical',
    distance: 0.6,
    address: '888 Health Street, Downtown',
    coordinates: { lat: 40.7534, lng: -73.9798 },
    rating: 4.2,
    imageUrl: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56',
    website: 'https://downtownmedical.com',
    phone: '+1-555-0601',
    openingHours: {
      monday: '24 hours',
      tuesday: '24 hours',
      wednesday: '24 hours',
      thursday: '24 hours',
      friday: '24 hours',
      saturday: '24 hours',
      sunday: '24 hours'
    }
  },
  {
    name: 'City Pharmacy',
    description: 'Full-service pharmacy with prescription and over-the-counter medications',
    category: 'medical',
    distance: 0.3,
    address: '999 Pharmacy Road, Downtown',
    coordinates: { lat: 40.7576, lng: -73.9834 },
    rating: 4.1,
    imageUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1f',
    website: 'https://citypharmacy.com',
    phone: '+1-555-0602',
    openingHours: {
      monday: '8:00 AM - 9:00 PM',
      tuesday: '8:00 AM - 9:00 PM',
      wednesday: '8:00 AM - 9:00 PM',
      thursday: '8:00 AM - 9:00 PM',
      friday: '8:00 AM - 9:00 PM',
      saturday: '9:00 AM - 7:00 PM',
      sunday: '10:00 AM - 6:00 PM'
    }
  },

  // Entertainment
  {
    name: 'Grand Theater',
    description: 'Historic theater hosting Broadway shows and live performances',
    category: 'entertainment',
    distance: 1.0,
    address: '1010 Broadway Street, Downtown',
    coordinates: { lat: 40.7456, lng: -73.9875 },
    rating: 4.7,
    imageUrl: 'https://images.unsplash.com/photo-1503095396549-807759245b35',
    website: 'https://grandtheater.com',
    phone: '+1-555-0701',
    openingHours: {
      monday: 'Closed',
      tuesday: '7:00 PM - 11:00 PM',
      wednesday: '7:00 PM - 11:00 PM',
      thursday: '7:00 PM - 11:00 PM',
      friday: '7:00 PM - 11:00 PM',
      saturday: '2:00 PM - 11:00 PM',
      sunday: '2:00 PM - 9:00 PM'
    }
  },
  {
    name: 'Rooftop Lounge',
    description: 'Trendy rooftop bar with cocktails and city skyline views',
    category: 'entertainment',
    distance: 0.4,
    address: '1111 Skyline Avenue, Downtown',
    coordinates: { lat: 40.7612, lng: -73.9801 },
    rating: 4.6,
    imageUrl: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b',
    website: 'https://rooftoplounge.com',
    phone: '+1-555-0702',
    openingHours: {
      monday: 'Closed',
      tuesday: 'Closed',
      wednesday: '5:00 PM - 12:00 AM',
      thursday: '5:00 PM - 12:00 AM',
      friday: '5:00 PM - 2:00 AM',
      saturday: '5:00 PM - 2:00 AM',
      sunday: '4:00 PM - 11:00 PM'
    }
  },
  {
    name: 'Cinema Downtown',
    description: 'Modern movie theater with latest releases and comfortable seating',
    category: 'entertainment',
    distance: 0.8,
    address: '1212 Movie Boulevard, Downtown',
    coordinates: { lat: 40.7523, lng: -73.9923 },
    rating: 4.3,
    imageUrl: 'https://images.unsplash.com/photo-1489599510047-41c3c68fe1b8',
    website: 'https://cinemadowntown.com',
    phone: '+1-555-0703',
    openingHours: {
      monday: '12:00 PM - 11:00 PM',
      tuesday: '12:00 PM - 11:00 PM',
      wednesday: '12:00 PM - 11:00 PM',
      thursday: '12:00 PM - 11:00 PM',
      friday: '12:00 PM - 12:00 AM',
      saturday: '10:00 AM - 12:00 AM',
      sunday: '10:00 AM - 11:00 PM'
    }
  }
];

async function seedAttractions() {
  try {
    // Connect to database
    await connectDB();
    
    console.log('Connected to database');
    
    // Find the hotel
    console.log('Looking for hotel...');
    const allHotels = await Hotel.find({});
    console.log('All hotels found:', allHotels.map(h => h.name));
    
    const hotel = await Hotel.findOne({ name: 'THE PENTOUZ' });
    if (!hotel) {
      console.error('Hotel "THE PENTOUZ" not found');
      console.log('Available hotels:', allHotels.map(h => h.name));
      process.exit(1);
    }
    
    console.log(`Found hotel: ${hotel.name} (ID: ${hotel._id})`);
    
    // Check if attractions already exist
    const existingAttractions = await LocalAttraction.countDocuments({ hotelId: hotel._id });
    if (existingAttractions > 0) {
      console.log(`Found ${existingAttractions} existing attractions. Clearing them first...`);
      await LocalAttraction.deleteMany({ hotelId: hotel._id });
    }
    
    // Add hotelId to all attractions and generate distance text
    const attractionsWithHotelId = attractionsData.map(attraction => {
      const distanceText = attraction.distance < 1 
        ? `${Math.round(attraction.distance * 5280)} feet away`
        : `${attraction.distance.toFixed(1)} mile${attraction.distance !== 1 ? 's' : ''} away`;
        
      return {
        ...attraction,
        hotelId: hotel._id,
        distanceText,
        isActive: true
      };
    });
    
    // Insert attractions
    const createdAttractions = await LocalAttraction.insertMany(attractionsWithHotelId);
    
    console.log(`\n✅ Successfully seeded ${createdAttractions.length} attractions for ${hotel.name}:`);
    
    // Group and display by category
    const grouped = createdAttractions.reduce((acc, attr) => {
      if (!acc[attr.category]) acc[attr.category] = [];
      acc[attr.category].push(attr);
      return acc;
    }, {});
    
    Object.keys(grouped).forEach(category => {
      console.log(`\n📍 ${category.toUpperCase()} (${grouped[category].length} items):`);
      grouped[category].forEach(attr => {
        console.log(`   • ${attr.name} - ${attr.distanceText}`);
      });
    });
    
    console.log(`\n🎉 Attractions seeding completed successfully!`);
    console.log(`Total attractions created: ${createdAttractions.length}`);
    
  } catch (error) {
    console.error('Error seeding attractions:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed');
  }
}

// Run the seeding script
seedAttractions();