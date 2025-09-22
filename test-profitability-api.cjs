const axios = require('axios');

async function testProfitabilityAPI() {
  try {
    console.log('🔄 Testing Profitability Analytics API...\n');

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

    // Test Profitability Metrics endpoint
    console.log('📊 Testing Profitability Metrics endpoint...');
    try {
      const profitabilityResponse = await axios.get(`${baseURL}/api/v1/analytics/profitability-metrics?period=30d`, config);
      const profitability = profitabilityResponse.data.data;

      console.log('✅ Profitability Response received');
      console.log(`   Total Revenue: ₹${profitability.totalRevenue}`);
      console.log(`   Net Profit: ₹${profitability.netProfit}`);
      console.log(`   Profit Margin: ${profitability.profitMargin}%`);
      console.log(`   RevPAR: ₹${profitability.revpar}`);
      console.log(`   Occupancy Rate: ${profitability.occupancyRate}%`);

      console.log('\n📋 Room Type Profitability:');
      if (profitability.roomTypeProfitability && profitability.roomTypeProfitability.length > 0) {
        for (const roomType of profitability.roomTypeProfitability) {
          console.log(`   ${roomType.roomType}:`);
          console.log(`     Rooms: ${roomType.roomCount}`);
          console.log(`     Revenue: ₹${Math.round(roomType.revenue)}`);
          console.log(`     Profit: ₹${Math.round(roomType.profit)}`);
          console.log(`     Occupancy: ${roomType.occupancyRate.toFixed(2)}%`);
          console.log(`     Avg Rate: ₹${Math.round(roomType.averageRate)}`);
          console.log('');
        }
      } else {
        console.log('   No room type profitability data found');
      }

      // Verify the fixes worked
      const hasUnknownRooms = profitability.roomTypeProfitability?.some(rt => rt.roomType === 'Unknown');
      const hasProperRoomTypes = profitability.roomTypeProfitability?.some(rt =>
        ['single', 'double', 'deluxe', 'suite'].includes(rt.roomType)
      );

      console.log('\n🔍 FIX VERIFICATION:');
      console.log(`   Has "Unknown" rooms: ${hasUnknownRooms ? '❌' : '✅'}`);
      console.log(`   Has proper room types: ${hasProperRoomTypes ? '✅' : '❌'}`);
      console.log(`   Room type count matches expectation: ${profitability.roomTypeProfitability?.length >= 3 ? '✅' : '❌'}`);

    } catch (error) {
      console.error('❌ Error calling profitability endpoint:', error.response?.data || error.message);
    }

    // Test Room Type Profitability endpoint
    console.log('\n📈 Testing Room Type Profitability endpoint...');
    try {
      const roomTypeResponse = await axios.get(`${baseURL}/api/v1/analytics/room-type-profitability`, config);
      const roomTypeData = roomTypeResponse.data.data;

      console.log('✅ Room Type Profitability Response received');
      console.log(`   Total room types: ${roomTypeData.length}`);

      for (const roomType of roomTypeData) {
        console.log(`   ${roomType.roomType}: ${roomType.totalRooms} rooms, ₹${Math.round(roomType.totalRevenue)} revenue`);
      }

    } catch (error) {
      console.error('❌ Error calling room type profitability endpoint:', error.response?.data || error.message);
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

testProfitabilityAPI();