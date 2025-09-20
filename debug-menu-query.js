import mongoose from 'mongoose';
import POSMenu from './src/models/POSMenu.js';
import Hotel from './src/models/Hotel.js';

const MONGODB_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function debugMenuQuery() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('🔍 Debugging POSMenu query...\n');
    
    // Find the hotel
    const hotel = await Hotel.findOne();
    console.log('Hotel found:', hotel ? hotel.name : 'None');
    console.log('Hotel ID:', hotel ? hotel._id : 'None');
    
    if (hotel) {
      // Try the exact query from the seed script
      const existingMenuItems = await POSMenu.find({ hotelId: hotel._id }).limit(3);
      console.log('\nQuery result:', existingMenuItems.length, 'menu items found');
      
      if (existingMenuItems.length > 0) {
        console.log('\nMenu items details:');
        existingMenuItems.forEach((item, index) => {
          console.log(`${index + 1}. ${item.name} (${item.displayName})`);
          console.log(`   - ID: ${item._id}`);
          console.log(`   - Price: ₹${item.price || 'N/A'}`);
          console.log(`   - Hotel ID: ${item.hotelId}`);
        });
      } else {
        console.log('\nNo menu items found for hotel ID:', hotel._id);
        
        // Let's check all POSMenu items
        const allMenuItems = await POSMenu.find();
        console.log('Total POSMenu items in database:', allMenuItems.length);
        
        if (allMenuItems.length > 0) {
          console.log('First menu item hotel ID:', allMenuItems[0].hotelId);
          console.log('Hotel ID type match?', allMenuItems[0].hotelId.equals(hotel._id));
        }
      }
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect();
  }
}

debugMenuQuery();