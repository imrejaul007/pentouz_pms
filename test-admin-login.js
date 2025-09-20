import axios from 'axios';

const BASE_URL = 'http://localhost:4000/api/v1';

async function testAdminLogin() {
  console.log('Testing Admin Login...\n');

  try {
    // Test admin login
    console.log('1. Testing admin login...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@hotel.com',
      password: 'admin123'
    });
    
    console.log('✅ Admin login successful!');
    console.log('Status:', loginResponse.status);
    console.log('Token:', loginResponse.data.token ? '✅ Present' : '❌ Missing');
    console.log('User:', loginResponse.data.user ? '✅ Present' : '❌ Missing');
    
    if (loginResponse.data.token) {
      const token = loginResponse.data.token;
      
      // Test accessing protected route with token
      console.log('\n2. Testing protected route with token...');
      const posResponse = await axios.get(`${BASE_URL}/pos/outlets`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('✅ Protected route access successful!');
      console.log('Status:', posResponse.status);
      console.log('Data:', posResponse.data);
      
      // Test billing sessions endpoint
      console.log('\n3. Testing billing sessions endpoint...');
      const billingResponse = await axios.get(`${BASE_URL}/billing-sessions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('✅ Billing sessions access successful!');
      console.log('Status:', billingResponse.status);
      console.log('Data:', billingResponse.data);
    }
    
  } catch (error) {
    console.log('❌ Error:', error.response?.status, error.response?.data || error.message);
  }
}

testAdminLogin().catch(console.error);
