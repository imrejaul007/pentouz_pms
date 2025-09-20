import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const HOTEL_ID = '68bc094f80c86bfe258e172b';

// Define schemas to match backend expectations
const roomTypeSchema = new mongoose.Schema({
  name: String,
  code: String,
  baseRate: Number,
  maxOccupancy: Number,
  totalRooms: Number,
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel' }
}, { collection: 'roomtypes' });

const RoomType = mongoose.model('RoomType', roomTypeSchema);

async function testComplexFetch() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB successfully\n');

    const db = mongoose.connection.db;

    // Test fetching allotments like the backend controller does
    console.log('=== TESTING BACKEND-STYLE FETCH ===');
    
    const allotments = await db.collection('roomtypeallotments').find({ 
      hotelId: new mongoose.Types.ObjectId(HOTEL_ID) 
    }).toArray();

    console.log(`Found ${allotments.length} allotments\n`);

    // Test each allotment structure
    for (let i = 0; i < allotments.length; i++) {
      const allotment = allotments[i];
      console.log(`=== ALLOTMENT ${i + 1}: ${allotment.name} ===`);
      
      // Check the fields that frontend expects
      console.log(`✅ _id: ${allotment._id}`);
      console.log(`✅ hotelId: ${allotment.hotelId}`);
      console.log(`✅ roomTypeId: ${allotment.roomTypeId}`);
      console.log(`✅ name: ${allotment.name}`);
      console.log(`✅ status: ${allotment.status}`);
      
      // Check defaultSettings (this is what shows "0" in the frontend)
      if (allotment.defaultSettings) {
        console.log(`✅ defaultSettings.totalInventory: ${allotment.defaultSettings.totalInventory}`);
        console.log(`✅ defaultSettings.defaultAllocationMethod: ${allotment.defaultSettings.defaultAllocationMethod}`);
        console.log(`✅ defaultSettings.overbookingAllowed: ${allotment.defaultSettings.overbookingAllowed}`);
      } else {
        console.log(`❌ defaultSettings: MISSING!`);
      }
      
      // Check overallOccupancyRate
      if (allotment.overallOccupancyRate !== undefined) {
        console.log(`✅ overallOccupancyRate: ${allotment.overallOccupancyRate}%`);
      } else {
        console.log(`❌ overallOccupancyRate: MISSING!`);
      }
      
      // Check channels
      if (allotment.channels) {
        console.log(`✅ channels: ${allotment.channels.length} channels`);
        const activeChannels = allotment.channels.filter(c => c.isActive);
        console.log(`✅ active channels: ${activeChannels.length}`);
        activeChannels.forEach(channel => {
          console.log(`   - ${channel.channelName} (${channel.channelId})`);
        });
      } else {
        console.log(`❌ channels: MISSING!`);
      }
      
      // Check dailyAllotments
      if (allotment.dailyAllotments) {
        console.log(`✅ dailyAllotments: ${allotment.dailyAllotments.length} days`);
        
        // Show first day's data
        if (allotment.dailyAllotments[0]) {
          const firstDay = allotment.dailyAllotments[0];
          console.log(`   First day: ${new Date(firstDay.date).toLocaleDateString()}`);
          console.log(`   Total Inventory: ${firstDay.totalInventory}`);
          console.log(`   Total Sold: ${firstDay.totalSold}`);
          console.log(`   Occupancy Rate: ${firstDay.occupancyRate}%`);
          console.log(`   Channel Allocations: ${firstDay.channelAllotments?.length || 0}`);
        }
      } else {
        console.log(`❌ dailyAllotments: MISSING!`);
      }
      
      console.log('---\n');
    }

    // Test with populate (like the backend controller)
    console.log('=== TESTING WITH MONGOOSE POPULATE ===');
    
    const RoomTypeAllotment = mongoose.model('RoomTypeAllotment', new mongoose.Schema({}, { 
      strict: false,
      collection: 'roomtypeallotments' 
    }));

    const populatedAllotments = await RoomTypeAllotment.find({ 
      hotelId: new mongoose.Types.ObjectId(HOTEL_ID) 
    })
    .populate('roomTypeId', 'name code maxOccupancy baseRate')
    .lean();

    console.log(`\nPopulated allotments: ${populatedAllotments.length}`);
    
    if (populatedAllotments[0]) {
      const first = populatedAllotments[0];
      console.log('\n=== FIRST POPULATED ALLOTMENT ===');
      console.log(`name: ${first.name}`);
      console.log(`roomType: ${first.roomTypeId?.name || 'NOT POPULATED'}`);
      console.log(`defaultSettings.totalInventory: ${first.defaultSettings?.totalInventory || 'MISSING'}`);
      console.log(`overallOccupancyRate: ${first.overallOccupancyRate || 'MISSING'}`);
      console.log(`channels.length: ${first.channels?.length || 'MISSING'}`);
      
      if (first.channels) {
        const activeChannels = first.channels.filter(c => c.isActive);
        console.log(`active channels: ${activeChannels.length}`);
        activeChannels.forEach(channel => {
          console.log(`  - ${channel.channelName} (${channel.channelId})`);
        });
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

testComplexFetch();