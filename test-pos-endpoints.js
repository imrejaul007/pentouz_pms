import axios from 'axios';

const BASE_URL = 'http://localhost:4000/api/v1';

async function testEndpoints() {
  console.log('Testing POS and Billing Session endpoints...\n');

  try {
    // Test POS outlets endpoint
    console.log('1. Testing POS Outlets endpoint...');
    const outletsResponse = await axios.get(`${BASE_URL}/pos/outlets`);
    console.log('✅ POS Outlets response:', outletsResponse.status, outletsResponse.data);
  } catch (error) {
    console.log('❌ POS Outlets error:', error.response?.status, error.response?.data || error.message);
  }

  try {
    // Test Billing Sessions endpoint
    console.log('\n2. Testing Billing Sessions endpoint...');
    const billingResponse = await axios.get(`${BASE_URL}/billing-sessions`);
    console.log('✅ Billing Sessions response:', billingResponse.status, billingResponse.data);
  } catch (error) {
    console.log('❌ Billing Sessions error:', error.response?.status, error.response?.data || error.message);
  }

  try {
    // Test server health
    console.log('\n3. Testing server health...');
    const healthResponse = await axios.get('http://localhost:4000/health');
    console.log('✅ Health check response:', healthResponse.status, healthResponse.data);
  } catch (error) {
    console.log('❌ Health check error:', error.response?.status, error.response?.data || error.message);
  }
}

testEndpoints().catch(console.error);
