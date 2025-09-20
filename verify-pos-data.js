import mongoose from 'mongoose';
import POSAttribute from './src/models/POSAttribute.js';
import POSAttributeValue from './src/models/POSAttributeValue.js';
import POSItemVariant from './src/models/POSItemVariant.js';
import POSTax from './src/models/POSTax.js';

const MONGODB_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function verifyPOSData() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('=== 🎉 POS Models Successfully Seeded! ===\n');

    // Count records
    const attributeCount = await POSAttribute.countDocuments();
    console.log('🏷️  POS Attributes:', attributeCount);

    const attributeValueCount = await POSAttributeValue.countDocuments();
    console.log('💎 POS Attribute Values:', attributeValueCount);

    const variantCount = await POSItemVariant.countDocuments();
    console.log('🍽️  POS Item Variants:', variantCount);

    const taxCount = await POSTax.countDocuments();
    console.log('🧾 POS Taxes:', taxCount);

    console.log('\n=== Sample Records ===');

    // Show sample attributes
    const attributes = await POSAttribute.find().select('displayName attributeType values');
    attributes.forEach(attr => {
      console.log(`📋 ${attr.displayName} (${attr.attributeType}): ${attr.values.length} embedded values`);
    });

    // Show sample taxes
    const taxes = await POSTax.find().select('displayName taxGroup rules');
    taxes.forEach(tax => {
      console.log(`💰 ${tax.displayName} (${tax.taxGroup}): ${tax.rules.length} rules`);
    });

    // Show sample variants
    const variants = await POSItemVariant.find().select('displayName attributes pricing');
    variants.forEach(variant => {
      console.log(`🍽️  ${variant.displayName}: ₹${variant.pricing.basePrice}`);
    });

    console.log('\n✅ All POS models seeded successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

verifyPOSData();