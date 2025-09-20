import mongoose from 'mongoose';
import { Channel, ChannelPerformance } from './src/models/ChannelManager.js';
import OTAPayload from './src/models/OTAPayload.js';

const MONGODB_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function checkOTACollections() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Check all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n📋 All Collections:');
    collections.forEach(col => {
      console.log(`  - ${col.name}`);
    });
    
    // Check OTA-related collections specifically
    const otaCollections = collections.filter(col => 
      col.name.toLowerCase().includes('channel') || 
      col.name.toLowerCase().includes('ota') ||
      col.name.toLowerCase().includes('performance')
    );
    
    console.log('\n🔍 OTA-Related Collections:');
    otaCollections.forEach(col => {
      console.log(`  - ${col.name}`);
    });
    
    // Count documents in OTA collections
    console.log('\n📊 Document Counts:');
    
    const channelCount = await Channel.countDocuments();
    console.log(`Channels: ${channelCount}`);
    
    const channelPerformanceCount = await ChannelPerformance.countDocuments();
    console.log(`ChannelPerformance: ${channelPerformanceCount}`);
    
    const otaPayloadCount = await OTAPayload.countDocuments();
    console.log(`OTAPayload: ${otaPayloadCount}`);
    
    // Show sample data
    console.log('\n🔬 Sample ChannelPerformance Data:');
    const sampleChannelPerf = await ChannelPerformance.findOne().populate('channel');
    if (sampleChannelPerf) {
      console.log('Sample record:', JSON.stringify(sampleChannelPerf, null, 2));
    } else {
      console.log('No ChannelPerformance data found!');
    }
    
    console.log('\n🔬 Sample OTAPayload Data:');
    const samplePayload = await OTAPayload.findOne();
    if (samplePayload) {
      console.log('Sample record:', JSON.stringify({
        payloadId: samplePayload.payloadId,
        direction: samplePayload.direction,
        channel: samplePayload.channel,
        operation: samplePayload.businessContext?.operation,
        processingStatus: samplePayload.processingStatus,
        metrics: samplePayload.metrics
      }, null, 2));
    } else {
      console.log('No OTAPayload data found!');
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('Error checking collections:', error);
    await mongoose.disconnect();
  }
}

checkOTACollections();