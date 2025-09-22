const axios = require('axios');

async function testAdvancedReservationsAPI() {
  try {
    console.log('🔄 Testing Advanced Reservations API Implementation...\n');

    let baseURL = 'http://localhost:4000';
    let token;

    // Try to login to main server first, fallback to test server
    try {
      console.log('   Attempting login to main server (port 4000)...');
      const loginResponse = await axios.post(`${baseURL}/api/v1/auth/login`, {
        email: 'admin@hotel.com',
        password: 'admin123'
      });
      token = loginResponse.data.data?.token || loginResponse.data.token;
      console.log('✅ Login successful on main server');
    } catch (error) {
      console.log('   Main server not available, trying test server (port 4002)...');
      baseURL = 'http://localhost:4002';
      try {
        const loginResponse = await axios.post(`${baseURL}/api/v1/auth/login`, {
          email: 'admin@hotel.com',
          password: 'admin123'
        });
        token = loginResponse.data.token;
        console.log('✅ Login successful on test server');
      } catch (testError) {
        console.log('❌ Both servers unavailable. Server needs to be started.');
        return;
      }
    }

    console.log(`🌐 Using server: ${baseURL}\n`);

    // Set up headers with auth token
    const config = {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };

    // Test the critical stats endpoint
    console.log('📊 TESTING CRITICAL STATISTICS ENDPOINT:');
    console.log('========================================\n');

    try {
      const statsResponse = await axios.get(`${baseURL}/api/v1/advanced-reservations/stats`, config);
      const stats = statsResponse.data.data;

      console.log('✅ Statistics endpoint working!');
      console.log('📋 Returned data structure:');
      console.log(`   Total Reservations: ${stats.totalReservations || 'N/A'}`);
      console.log(`   VIP Reservations: ${stats.vipReservations || 'N/A'}`);
      console.log(`   Upgrade Requests: ${stats.upgradeRequests || 'N/A'}`);
      console.log(`   Special Requests: ${stats.specialRequests || 'N/A'}`);
      console.log(`   Waitlist Count: ${stats.waitlistCount || 'N/A'}`);
      console.log(`   Pending Approvals: ${stats.pendingApprovals || 'N/A'}`);

      // Check if data matches screenshot requirements
      const meetsRequirements =
        stats.totalReservations === 5 &&
        stats.vipReservations === 1 &&
        stats.upgradeRequests === 2 &&
        stats.waitlistCount === 5;

      console.log(`\n🎯 Screenshot Requirements Check:`);
      console.log(`   Total Reservations: ${stats.totalReservations} (Expected: 5) ${stats.totalReservations === 5 ? '✅' : '❌'}`);
      console.log(`   VIP Reservations: ${stats.vipReservations} (Expected: 1) ${stats.vipReservations === 1 ? '✅' : '❌'}`);
      console.log(`   Upgrades: ${stats.upgradeRequests} (Expected: 2) ${stats.upgradeRequests === 2 ? '✅' : '❌'}`);
      console.log(`   Waitlist: ${stats.waitlistCount} (Expected: 5) ${stats.waitlistCount === 5 ? '✅' : '❌'}`);

      console.log(`\n${meetsRequirements ? '🎉' : '⚠️'} RESULT: ${meetsRequirements ? 'ALL REQUIREMENTS MET!' : 'Some requirements not met'}`);

      if (stats.typeStats && Array.isArray(stats.typeStats)) {
        console.log('\n📊 Type Distribution:');
        stats.typeStats.forEach(type => {
          console.log(`   ${type._id}: ${type.count}`);
        });
      }

      if (stats.priorityStats && typeof stats.priorityStats === 'object') {
        console.log('\n📈 Priority Distribution:');
        Object.entries(stats.priorityStats).forEach(([priority, count]) => {
          console.log(`   ${priority}: ${count}`);
        });
      }

    } catch (error) {
      if (error.response?.status === 404) {
        console.log('❌ Statistics endpoint not found (404)');
        console.log('   This means the Advanced Reservations routes are not properly registered.');
      } else if (error.response?.status === 403) {
        console.log('❌ Access forbidden (403)');
        console.log('   Check authentication and authorization setup.');
      } else {
        console.log(`❌ Error calling statistics endpoint: ${error.response?.status || error.message}`);
        if (error.response?.data) {
          console.log(`   Error details: ${JSON.stringify(error.response.data, null, 2)}`);
        }
      }
    }

    // Test main reservations endpoint
    console.log('\n🏨 TESTING MAIN RESERVATIONS ENDPOINT:');
    console.log('======================================\n');

    try {
      const reservationsResponse = await axios.get(`${baseURL}/api/v1/advanced-reservations`, config);
      const reservations = reservationsResponse.data.data;

      console.log('✅ Main reservations endpoint working!');
      console.log(`📊 Found ${Array.isArray(reservations) ? reservations.length : 'N/A'} reservations`);

      if (Array.isArray(reservations) && reservations.length > 0) {
        console.log('\n📋 Sample reservation data:');
        const sample = reservations[0];
        console.log(`   ID: ${sample._id || sample.id}`);
        console.log(`   Type: ${sample.reservationType}`);
        console.log(`   Priority: ${sample.priority}`);
        console.log(`   VIP Status: ${sample.guestProfile?.vipStatus || false}`);
        console.log(`   Status: ${sample.status}`);
      }

    } catch (error) {
      console.log(`❌ Error calling reservations endpoint: ${error.response?.status || error.message}`);
    }

    console.log('\n🚀 NEXT STEPS:');
    console.log('==============');
    console.log('1. If API endpoints are working, the frontend should show real data');
    console.log('2. Navigate to Advanced Reservations page to verify');
    console.log('3. Check browser network tab for API call responses');
    console.log('4. If still showing mock data, check frontend service configuration');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

testAdvancedReservationsAPI();