import tapeChartSeeder from './src/scripts/seedTapeChart.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

console.log('🚀 Starting TapeChart seeder...');

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to database');
    
    await tapeChartSeeder.seedTapeChartData();
    console.log('✅ TapeChart seeding completed');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
    process.exit(0);
  }
}

run();
