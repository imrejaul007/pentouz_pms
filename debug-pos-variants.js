import mongoose from 'mongoose';
import POSItemVariant from './src/models/POSItemVariant.js';
import POSMenu from './src/models/POSMenu.js';
import POSAttribute from './src/models/POSAttribute.js';

const MONGODB_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function debugVariants() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('🔍 Debugging POSItemVariant seeding...\n');
    
    // Check if POSMenu items exist
    const menuItemCount = await POSMenu.countDocuments();
    console.log('📋 POSMenu items available:', menuItemCount);
    
    if (menuItemCount > 0) {
      const sampleMenuItems = await POSMenu.find().limit(3).select('name category');
      console.log('Sample menu items:');
      sampleMenuItems.forEach(item => {
        console.log(`  - ${item.name} (${item.category})`);
      });
    }
    
    // Check POSAttributes
    const attributeCount = await POSAttribute.countDocuments();
    console.log('\n🏷️  POSAttributes available:', attributeCount);
    
    // Check POSItemVariants
    const variantCount = await POSItemVariant.countDocuments();
    console.log('🍽️  POSItemVariants found:', variantCount);
    
    if (variantCount === 0) {
      console.log('\n❌ No POSItemVariants found. This suggests the seeding failed.');
      console.log('Likely reasons:');
      console.log('1. POSMenu items were not available during seeding');
      console.log('2. POSAttribute references were incorrect');
      console.log('3. Validation errors during variant creation');
    } else {
      const variants = await POSItemVariant.find().populate('menuItem attributes.attribute');
      console.log('\n✅ Found POSItemVariants:');
      variants.forEach(variant => {
        console.log(`  - ${variant.name}: ₹${variant.pricing.basePrice}`);
      });
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect();
  }
}

debugVariants();