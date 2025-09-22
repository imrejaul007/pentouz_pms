const axios = require('axios');

async function testAdvancedReservationsAPI() {
  try {
    console.log('🔄 Testing Advanced Reservations API...\n');

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

    // Test possible Advanced Reservations endpoints
    const endpointsToTest = [
      '/api/v1/advanced-reservations',
      '/api/v1/reservations/advanced',
      '/api/v1/tape-chart/advanced-reservations',
      '/api/v1/bookings/advanced',
      '/api/v1/reservations',
      '/api/v1/bookings'
    ];

    console.log('🏨 TESTING ADVANCED RESERVATIONS ENDPOINTS:\n');

    for (const endpoint of endpointsToTest) {
      try {
        console.log(`📡 Testing: ${endpoint}`);
        const response = await axios.get(`${baseURL}${endpoint}`, config);
        const data = response.data.data || response.data;

        console.log(`   ✅ Response received (${response.status})`);
        console.log(`   📊 Data count: ${Array.isArray(data) ? data.length : 'Not array'}`);

        if (Array.isArray(data) && data.length > 0) {
          console.log(`   📋 First item structure:`, Object.keys(data[0]));

          // Check for advanced reservation specific fields
          const hasAdvancedFields = data[0].hasOwnProperty('upgradeEligible') ||
                                   data[0].hasOwnProperty('specialRequests') ||
                                   data[0].hasOwnProperty('roomPreferences');

          console.log(`   🔍 Has advanced fields: ${hasAdvancedFields ? '✅' : '❌'}`);

          if (data.length === 5) {
            console.log(`   🎯 MATCHES SCREENSHOT COUNT (5) - POTENTIAL DATA SOURCE`);
          }
        }
        console.log('');

      } catch (error) {
        if (error.response?.status === 404) {
          console.log(`   ❌ Not found (404)`);
        } else if (error.response?.status === 403) {
          console.log(`   ❌ Forbidden (403)`);
        } else {
          console.log(`   ❌ Error: ${error.response?.status || error.message}`);
        }
        console.log('');
      }
    }

    // Test waitlist endpoints
    console.log('⏳ TESTING WAITLIST ENDPOINTS:\n');

    const waitlistEndpoints = [
      '/api/v1/waitlist',
      '/api/v1/waiting-list',
      '/api/v1/tape-chart/waitlist',
      '/api/v1/reservations/waitlist'
    ];

    for (const endpoint of waitlistEndpoints) {
      try {
        console.log(`📡 Testing: ${endpoint}`);
        const response = await axios.get(`${baseURL}${endpoint}`, config);
        const data = response.data.data || response.data;

        console.log(`   ✅ Response received (${response.status})`);
        console.log(`   📊 Data count: ${Array.isArray(data) ? data.length : 'Not array'}`);

        if (Array.isArray(data) && data.length === 5) {
          console.log(`   🎯 MATCHES SCREENSHOT COUNT (5) - POTENTIAL WAITLIST SOURCE`);
        }
        console.log('');

      } catch (error) {
        console.log(`   ❌ ${error.response?.status === 404 ? 'Not found (404)' : 'Error'}`);
        console.log('');
      }
    }

    // Test upgrade endpoints
    console.log('🔄 TESTING UPGRADE ENDPOINTS:\n');

    const upgradeEndpoints = [
      '/api/v1/upgrades',
      '/api/v1/room-upgrades',
      '/api/v1/reservations/upgrades',
      '/api/v1/tape-chart/upgrades'
    ];

    for (const endpoint of upgradeEndpoints) {
      try {
        console.log(`📡 Testing: ${endpoint}`);
        const response = await axios.get(`${baseURL}${endpoint}`, config);
        const data = response.data.data || response.data;

        console.log(`   ✅ Response received (${response.status})`);
        console.log(`   📊 Data count: ${Array.isArray(data) ? data.length : 'Not array'}`);

        if (Array.isArray(data) && data.length === 2) {
          console.log(`   🎯 MATCHES SCREENSHOT COUNT (2) - POTENTIAL UPGRADE SOURCE`);
        }
        console.log('');

      } catch (error) {
        console.log(`   ❌ ${error.response?.status === 404 ? 'Not found (404)' : 'Error'}`);
        console.log('');
      }
    }

    // Test dashboard/stats endpoints
    console.log('📊 TESTING DASHBOARD/STATS ENDPOINTS:\n');

    const statsEndpoints = [
      '/api/v1/dashboard/stats',
      '/api/v1/tape-chart/dashboard',
      '/api/v1/reservations/stats',
      '/api/v1/analytics/reservations'
    ];

    for (const endpoint of statsEndpoints) {
      try {
        console.log(`📡 Testing: ${endpoint}`);
        const response = await axios.get(`${baseURL}${endpoint}`, config);
        const data = response.data.data || response.data;

        console.log(`   ✅ Response received (${response.status})`);
        console.log(`   📋 Response structure:`, Object.keys(data));

        // Look for advanced reservations metrics
        if (data.advancedReservations || data.totalReservations || data.upgrades || data.waitlist) {
          console.log(`   🎯 CONTAINS RESERVATION METRICS - POTENTIAL DASHBOARD SOURCE`);

          if (data.advancedReservations) console.log(`   📊 Advanced Reservations: ${data.advancedReservations}`);
          if (data.totalReservations) console.log(`   📊 Total Reservations: ${data.totalReservations}`);
          if (data.upgrades) console.log(`   📊 Upgrades: ${data.upgrades}`);
          if (data.waitlist) console.log(`   📊 Waitlist: ${data.waitlist}`);
          if (data.vipReservations) console.log(`   📊 VIP Reservations: ${data.vipReservations}`);
        }
        console.log('');

      } catch (error) {
        console.log(`   ❌ ${error.response?.status === 404 ? 'Not found (404)' : 'Error'}`);
        console.log('');
      }
    }

    console.log('🔍 CONCLUSION:');
    console.log('If no endpoints return data matching the screenshot counts,');
    console.log('this confirms the Advanced Reservations page uses MOCK DATA.');

  } catch (error) {
    console.error('❌ Error:', error.response ? error.response.data : error.message);
    if (error.response && error.response.status === 401) {
      console.log('   Authentication failed. Check credentials.');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('   No server running. Please start the backend server.');
    }
  }
}

testAdvancedReservationsAPI();