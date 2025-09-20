import mongoose from 'mongoose';
import POSMenu from './src/models/POSMenu.js';

const MONGODB_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function checkMenuData() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('🔍 Checking all POSMenu data...\n');
    
    const allMenuItems = await POSMenu.find();
    console.log(`Total menu items: ${allMenuItems.length}`);
    
    console.log('\nDetailed menu items:');
    allMenuItems.forEach((item, index) => {
      console.log(`${index + 1}. ${item.name}`);
      console.log(`   - Hotel ID: ${item.hotelId || 'UNDEFINED'}`);
      console.log(`   - Menu ID: ${item.menuId}`);
      console.log(`   - Type: ${item.type}`);
      console.log(`   - Outlet: ${item.outlet}`);
      console.log('');
    });
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect();
  }
}

checkMenuData();