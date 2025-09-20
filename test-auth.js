import axios from 'axios';

const BASE_URL = 'http://localhost:4000/api/v1';

async function testAuth() {
  console.log('Testing Authentication endpoints...\n');

  try {
    // Test if server is running
    console.log('1. Testing server health...');
    const healthResponse = await axios.get(`${BASE_URL.replace('/api/v1', '')}/health`);
    console.log('✅ Server health:', healthResponse.status, healthResponse.data);
  } catch (error) {
    console.log('❌ Server health error:', error.message);
    return;
  }

  try {
    // Test auth endpoints
    console.log('\n2. Testing auth endpoints...');
    const authResponse = await axios.get(`${BASE_URL}/auth`);
    console.log('✅ Auth endpoint:', authResponse.status, authResponse.data);
  } catch (error) {
    console.log('❌ Auth endpoint error:', error.response?.status, error.response?.data || error.message);
  }

  try {
    // Test if we can access protected routes without auth
    console.log('\n3. Testing protected route without auth...');
    const posResponse = await axios.get(`${BASE_URL}/pos/outlets`);
    console.log('✅ POS outlets (no auth):', posResponse.status, posResponse.data);
  } catch (error) {
    console.log('❌ POS outlets (no auth) error:', error.response?.status, error.response?.data || error.message);
  }
}

testAuth().catch(console.error);
