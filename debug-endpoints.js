import axios from 'axios';

const BASE_URL = 'http://localhost:4000/api/v1';

async function debugEndpoints() {
  try {
    // Login first
    console.log('🔐 Logging in...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'john@example.com',
      password: 'guest123'
    });
    
    const token = loginResponse.data.token;
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    
    console.log('✅ Login successful');
    
    // Test Phase 2: Hotel Services Bookings
    console.log('\n🎯 Testing Phase 2: Hotel Services Bookings');
    console.log('=' .repeat(50));
    
    try {
      console.log('📋 Testing: GET /hotel-services/bookings');
      const bookingsResponse = await axios.get(`${BASE_URL}/hotel-services/bookings`, { headers });
      console.log('✅ Status:', bookingsResponse.status);
      console.log('✅ Response:', bookingsResponse.data);
    } catch (error) {
      console.log('❌ Error Status:', error.response?.status);
      console.log('❌ Error Message:', error.response?.data?.message || error.message);
      console.log('❌ Full Error:', error.response?.data);
    }
    
    // Test Phase 3: Notifications Preferences
    console.log('\n🎯 Testing Phase 3: Notifications Preferences');
    console.log('=' .repeat(50));
    
    try {
      console.log('📋 Testing: GET /notifications/preferences');
      const preferencesResponse = await axios.get(`${BASE_URL}/notifications/preferences`, { headers });
      console.log('✅ Status:', preferencesResponse.status);
      console.log('✅ Response:', preferencesResponse.data);
    } catch (error) {
      console.log('❌ Error Status:', error.response?.status);
      console.log('❌ Error Message:', error.response?.data?.message || error.message);
      console.log('❌ Full Error:', error.response?.data);
    }
    
    // Test all notification routes to see what's available
    console.log('\n🎯 Testing All Notification Routes');
    console.log('=' .repeat(50));
    
    const notificationEndpoints = [
      '/notifications',
      '/notifications/preferences',
      '/notifications/types',
      '/notifications/settings'
    ];
    
    for (const endpoint of notificationEndpoints) {
      try {
        console.log(`📋 Testing: GET ${endpoint}`);
        const response = await axios.get(`${BASE_URL}${endpoint}`, { headers });
        console.log(`✅ ${endpoint} - Status: ${response.status}`);
      } catch (error) {
        console.log(`❌ ${endpoint} - Status: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
      }
    }
    
    // Test all hotel services routes
    console.log('\n🎯 Testing All Hotel Services Routes');
    console.log('=' .repeat(50));
    
    const hotelServiceEndpoints = [
      '/hotel-services',
      '/hotel-services/bookings',
      '/hotel-services/available',
      '/hotel-services/featured'
    ];
    
    for (const endpoint of hotelServiceEndpoints) {
      try {
        console.log(`📋 Testing: GET ${endpoint}`);
        const response = await axios.get(`${BASE_URL}${endpoint}`, { headers });
        console.log(`✅ ${endpoint} - Status: ${response.status}`);
      } catch (error) {
        console.log(`❌ ${endpoint} - Status: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugEndpoints();
