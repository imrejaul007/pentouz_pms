const axios = require('axios');

async function testRoomBlocksAPI() {
  try {
    console.log('🔄 Testing Room Blocks API...\n');

    let baseURL = 'http://localhost:4000';
    let token;

    // Try to login to main server first, fallback to test server
    try {
      const loginResponse = await axios.post(`${baseURL}/api/v1/auth/login`, {
        email: 'admin@hotel.com',
        password: 'admin123'
      });
      token = loginResponse.data.data?.token || loginResponse.data.token;
    } catch (error) {
      console.log('   Main server (4000) not available, trying test server (4002)...');
      baseURL = 'http://localhost:4002';
      const loginResponse = await axios.post(`${baseURL}/api/v1/auth/login`, {
        email: 'admin@hotel.com',
        password: 'admin123'
      });
      token = loginResponse.data.token;
    }

    console.log(`✅ Login successful on ${baseURL}\n`);

    // Set up headers with auth token
    const config = {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };

    // Test Room Blocks endpoint
    console.log('🏗️ Testing GET /api/v1/tape-chart/room-blocks endpoint...');
    try {
      const roomBlocksResponse = await axios.get(`${baseURL}/api/v1/tape-chart/room-blocks`, config);
      const roomBlocks = roomBlocksResponse.data.data;

      console.log('✅ Room Blocks Response received');
      console.log(`📊 Total Room Blocks: ${roomBlocks ? roomBlocks.length : 0}`);

      if (roomBlocks && roomBlocks.length > 0) {
        console.log('\n📋 Room Blocks Details:');
        for (const block of roomBlocks) {
          console.log(`\n🏨 ${block.blockName || 'Unnamed Block'}`);
          console.log(`   ID: ${block._id}`);
          console.log(`   Status: ${block.status}`);
          console.log(`   Event Type: ${block.eventType}`);
          console.log(`   Start Date: ${block.startDate}`);
          console.log(`   End Date: ${block.endDate}`);
          console.log(`   Total Rooms: ${block.totalRooms || 0}`);
          console.log(`   Rooms Booked: ${block.roomsBooked || 0}`);

          if (block.contactPerson) {
            console.log(`   Contact: ${block.contactPerson.name || 'N/A'}`);
            console.log(`   Email: ${block.contactPerson.email || 'N/A'}`);
            console.log(`   Phone: ${block.contactPerson.phone || 'N/A'}`);
          }
        }

        // Check for specific blocks from screenshot
        console.log('\n🔍 SCREENSHOT VERIFICATION:');

        const techConference = roomBlocks.find(block =>
          block.blockName && block.blockName.toLowerCase().includes('tech conference')
        );

        const wedding = roomBlocks.find(block =>
          block.blockName && block.blockName.toLowerCase().includes('wedding')
        );

        console.log(`   Tech Conference 2025 found: ${techConference ? '✅' : '❌'}`);
        console.log(`   Smith-Williams Wedding found: ${wedding ? '✅' : '❌'}`);

        if (techConference) {
          console.log(`     Tech Conference Status: ${techConference.status}`);
          console.log(`     Tech Conference Rooms: ${techConference.totalRooms} total, ${techConference.roomsBooked} booked`);
        }

        if (wedding) {
          console.log(`     Wedding Status: ${wedding.status}`);
          console.log(`     Wedding Rooms: ${wedding.totalRooms} total, ${wedding.roomsBooked} booked`);
        }

      } else {
        console.log('   No room blocks found in database');
        console.log('\n❓ VERDICT: Room Block Management page is showing MOCK DATA');
        console.log('   - Database has 0 room blocks');
        console.log('   - UI shows 3 room blocks with detailed information');
        console.log('   - This indicates client-side mock data is being used');
      }

    } catch (error) {
      console.error('❌ Error calling room blocks endpoint:', error.response?.data || error.message);
      if (error.response?.status === 404) {
        console.log('   Endpoint not found - room blocks may not be implemented');
      }
    }

    // Test Room Block Stats endpoint
    console.log('\n📊 Testing GET /api/v1/tape-chart/room-blocks/stats endpoint...');
    try {
      const statsResponse = await axios.get(`${baseURL}/api/v1/tape-chart/room-blocks/stats`, config);
      const stats = statsResponse.data.data;

      console.log('✅ Room Block Stats Response received');
      console.log(`   Active Blocks: ${stats.activeBlocks || 0}`);
      console.log(`   Total Rooms: ${stats.totalRooms || 0}`);
      console.log(`   Booked Rooms: ${stats.bookedRooms || 0}`);
      console.log(`   Events: ${stats.events || 0}`);

    } catch (error) {
      console.error('❌ Error calling room block stats endpoint:', error.response?.data || error.message);
      if (error.response?.status === 404) {
        console.log('   Stats endpoint not found');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.response ? error.response.data : error.message);
    if (error.response && error.response.status === 401) {
      console.log('   Authentication failed. Check credentials.');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('   No server running. Please start the backend server.');
    }
  }
}

testRoomBlocksAPI();