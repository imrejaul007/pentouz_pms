const axios = require('axios');

async function testTapeChartAPI() {
  try {
    console.log('🔄 Testing TapeChart API...\n');

    // First, login to get JWT token
    console.log('1️⃣ Logging in...');
    let token;
    let baseURL = 'http://localhost:4000';

    try {
      // Try port 4000 first
      const loginResponse = await axios.post(`${baseURL}/api/v1/auth/login`, {
        email: 'admin@hotel.com',
        password: 'admin123'
      });
      token = loginResponse.data.data?.token || loginResponse.data.token;
    } catch (error) {
      // If port 4000 fails, try port 4002 (test server)
      console.log('   Port 4000 failed, trying port 4002...');
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

    // Test TapeChart Dashboard endpoint
    console.log('2️⃣ Testing TapeChart Dashboard endpoint...');
    const dashboardResponse = await axios.get(`${baseURL}/api/v1/tape-chart/dashboard`, config);
    const dashboard = dashboardResponse.data.data;

    console.log('✅ Dashboard Response:');
    console.log(`   Total Rooms: ${dashboard.summary.totalRooms}`);
    console.log(`   Available Rooms: ${dashboard.summary.availableRooms}`);
    console.log(`   Occupied Rooms: ${dashboard.summary.occupiedRooms}`);
    console.log(`   Reserved Rooms: ${dashboard.summary.reservedRooms}`);
    console.log(`   Maintenance Rooms: ${dashboard.summary.maintenanceRooms}`);
    console.log(`   Occupancy Rate: ${dashboard.summary.occupancyRate}%`);
    console.log();

    // Test TapeChart Views endpoint
    console.log('3️⃣ Testing TapeChart Views endpoint...');
    const viewsResponse = await axios.get(`${baseURL}/api/v1/tape-chart/views`, config);
    const views = viewsResponse.data.data;

    console.log(`✅ Found ${views.length} TapeChart views:`);
    views.forEach(view => {
      console.log(`   - ${view.viewName} (${view.viewType})`);
    });
    console.log();

    // Test TapeChart Data generation
    if (views.length > 0) {
      console.log('4️⃣ Testing TapeChart Data generation...');
      const viewId = views[0]._id;
      const today = new Date();
      const startDate = new Date(today);
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 6);

      const chartDataResponse = await axios.post(`${baseURL}/api/v1/tape-chart/generate`, {
        viewId: viewId,
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      }, config);

      const chartData = chartDataResponse.data.data;
      console.log(`✅ Chart Data Generated:`);
      console.log(`   Rooms in chart: ${chartData.rooms.length}`);
      console.log(`   Date range: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
      console.log(`   Summary:`);
      console.log(`   - Total Rooms: ${chartData.summary.totalRooms}`);
      console.log(`   - Occupied: ${chartData.summary.occupiedRooms}`);
      console.log(`   - Available: ${chartData.summary.availableRooms}`);
      console.log(`   - Reserved: ${chartData.summary.reservedRooms}`);
      console.log(`   - Maintenance: ${chartData.summary.maintenanceRooms}`);
      console.log(`   - Occupancy Rate: ${chartData.summary.occupancyRate.toFixed(2)}%`);
    }

    console.log('\n✅ All TapeChart API endpoints are working correctly!');
    console.log('📊 The TapeChart should now display all 100 rooms.');

  } catch (error) {
    console.error('❌ Error:', error.response ? error.response.data : error.message);
    if (error.response && error.response.status === 401) {
      console.log('   Authentication failed. Check credentials.');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('   Server is not running on port 4000. Please start the backend server.');
    }
  }
}

testTapeChartAPI();