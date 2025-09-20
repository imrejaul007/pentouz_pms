import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function testTapeChartDashboard() {
  try {
    const baseURL = 'http://localhost:4000/api/v1';

    console.log('🔐 Logging in as admin...');

    // Login with admin credentials
    const loginResponse = await axios.post(`${baseURL}/auth/login`, {
      email: 'admin@hotel.com',
      password: 'admin123'
    });

    if (loginResponse.data.status !== 'success') {
      throw new Error('Login failed: ' + (loginResponse.data.message || 'Unknown error'));
    }

    const token = loginResponse.data.token;
    console.log('✅ Login successful');

    // Set up headers with auth token
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Test TapeChart dashboard endpoint
    console.log('\n📊 Testing TapeChart Dashboard...');
    const dashboardResponse = await axios.get(`${baseURL}/tape-chart/dashboard`, { headers });

    if (dashboardResponse.data.success) {
      console.log('✅ TapeChart Dashboard API working');
      console.log('\n📈 Dashboard Data Summary:');

      const data = dashboardResponse.data.data;
      console.log(`   Total Rooms: ${data.totalRooms || 'N/A'}`);
      console.log(`   Occupied Rooms: ${data.occupiedRooms || 'N/A'}`);
      console.log(`   Available Rooms: ${data.availableRooms || 'N/A'}`);
      console.log(`   Occupancy Rate: ${data.occupancyRate || 'N/A'}%`);
      console.log(`   Total Revenue: ₹${data.totalRevenue || 'N/A'}`);

      if (data.bookings && data.bookings.length > 0) {
        console.log(`   Bookings Found: ${data.bookings.length}`);
      }
    } else {
      console.error('❌ Dashboard API failed:', dashboardResponse.data.message);
    }

    // Test chart data endpoint
    console.log('\n📊 Testing Chart Data Endpoint...');
    const chartResponse = await axios.get(`${baseURL}/tape-chart/chart-data`, { headers });

    if (chartResponse.data.success) {
      console.log('✅ Chart Data API working');
      const chartData = chartResponse.data.data;

      if (chartData.summary) {
        console.log('\n📊 Chart Summary:');
        console.log(`   Total Rooms: ${chartData.summary.totalRooms}`);
        console.log(`   Occupancy Rate: ${chartData.summary.occupancyRate}%`);
        console.log(`   Available: ${chartData.summary.available}`);
        console.log(`   Occupied: ${chartData.summary.occupied}`);
      }

      if (chartData.rooms) {
        console.log(`   Room Data Points: ${chartData.rooms.length}`);
      }
    } else {
      console.error('❌ Chart Data API failed:', chartResponse.data.message);
    }

    // Test views endpoint
    console.log('\n📊 Testing TapeChart Views...');
    const viewsResponse = await axios.get(`${baseURL}/tape-chart/views`, { headers });

    if (viewsResponse.data.success) {
      console.log('✅ Views API working');
      console.log(`   Views Available: ${viewsResponse.data.data.length}`);
    }

    console.log('\n🎉 All TapeChart API tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data?.message || error.message);

    if (error.response?.data) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testTapeChartDashboard();