import axios from 'axios';

const API_BASE_URL = 'http://localhost:4000/api/v1';

async function testRoomTypesEndpoint() {
  try {
    console.log('🧪 Testing Room Types Endpoint...\n');

    // Step 1: Login to get JWT token
    console.log('1. Logging in as admin...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'admin@hotel.com',
      password: 'admin123'
    });

    if (loginResponse.data.status === 'success' && loginResponse.data.token) {
      console.log('✅ Login successful');
      const token = loginResponse.data.token;

      const authHeaders = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // First get a hotel ID from available hotels
      console.log('\n2. Getting hotel ID...');
      let hotelId = null;
      try {
        // Get user info to extract hotel ID
        const userResponse = await axios.get(`${API_BASE_URL}/auth/me`, { headers: authHeaders });
        hotelId = userResponse.data.user.hotelId;
        console.log(`✅ Found hotel ID from user data: ${hotelId}`);
      } catch (error) {
        console.log('❌ Could not get hotel ID:', error.response?.data?.message || error.message);
        // Use default hotel ID as fallback
        hotelId = '64a7c123456789abcdef1234';
        console.log(`✅ Using fallback hotel ID: ${hotelId}`);
      }

      // Test room-types endpoint with hotel ID
      console.log('\n3. Testing GET /room-types/hotel/:hotelId');
      try {
        const response = await axios.get(`${API_BASE_URL}/room-types/hotel/${hotelId}`, { headers: authHeaders });
        console.log('✅ Room types API working');
        console.log(`   Found ${response.data.data?.length || 0} room types`);
        if (response.data.data && response.data.data.length > 0) {
          const roomType = response.data.data[0];
          console.log(`   Sample room type: ${roomType.name} (ID: ${roomType._id})`);
        }
      } catch (error) {
        console.log('❌ Room types API failed');
        console.log(`   Error: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
        console.log(`   Full response:`, error.response?.data);
      }

    } else {
      console.log('❌ Login failed');
    }

  } catch (error) {
    console.error('🚨 Test failed:', error.response?.data || error.message);
  }
}

testRoomTypesEndpoint();