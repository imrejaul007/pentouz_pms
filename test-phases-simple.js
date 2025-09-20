import axios from 'axios';

const BASE_URL = 'http://localhost:4000/api/v1';

async function testEndpointsWithoutAuth() {
  console.log('🚀 Testing API Endpoints (Without Authentication)');
  console.log('=' .repeat(60));
  
  const endpoints = [
    { name: 'Health Check', url: 'http://localhost:4000/health', method: 'GET' },
    { name: 'API Docs', url: 'http://localhost:4000/docs', method: 'GET' },
    { name: 'Auth Register', url: `${BASE_URL}/auth/register`, method: 'POST' },
    { name: 'Auth Login', url: `${BASE_URL}/auth/login`, method: 'POST' },
    { name: 'Loyalty Dashboard', url: `${BASE_URL}/loyalty/dashboard`, method: 'GET' },
    { name: 'Hotel Services', url: `${BASE_URL}/hotel-services`, method: 'GET' },
    { name: 'Notifications', url: `${BASE_URL}/notifications`, method: 'GET' },
    { name: 'Digital Keys', url: `${BASE_URL}/digital-keys`, method: 'GET' },
    { name: 'Meet-Up Requests', url: `${BASE_URL}/meet-up-requests`, method: 'GET' }
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\n📋 Testing: ${endpoint.name}`);
      console.log(`URL: ${endpoint.url}`);
      
      let response;
      if (endpoint.method === 'GET') {
        response = await axios.get(endpoint.url);
      } else if (endpoint.method === 'POST') {
        response = await axios.post(endpoint.url, {});
      }
      
      console.log(`✅ Status: ${response.status}`);
      console.log(`✅ Response: ${JSON.stringify(response.data).substring(0, 100)}...`);
      
    } catch (error) {
      console.log(`❌ Error: ${error.response?.status || 'Connection failed'}`);
      console.log(`❌ Message: ${error.response?.data?.message || error.message}`);
    }
  }
}

async function testAuthEndpoints() {
  console.log('\n🔐 Testing Authentication Endpoints');
  console.log('=' .repeat(50));
  
  try {
    // Test login with provided credentials
    console.log('📋 Testing user login...');
    const loginData = {
      email: 'john@example.com',
      password: 'guest123'
    };
    
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, loginData);
    console.log('✅ Login successful:', loginResponse.data);
    
    return loginResponse.data.token;
    
  } catch (error) {
    console.log('❌ Auth test failed:', error.response?.data?.message || error.message);
    return null;
  }
}

async function testProtectedEndpoints(token) {
  if (!token) {
    console.log('❌ Cannot test protected endpoints without token');
    return;
  }
  
  console.log('\n🔒 Testing Protected Endpoints');
  console.log('=' .repeat(50));
  
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  
  const protectedEndpoints = [
    { name: 'Loyalty Dashboard', url: `${BASE_URL}/loyalty/dashboard` },
    { name: 'Loyalty Offers', url: `${BASE_URL}/loyalty/offers` },
    { name: 'Hotel Services', url: `${BASE_URL}/hotel-services` },
    { name: 'Notifications', url: `${BASE_URL}/notifications` },
    { name: 'Digital Keys', url: `${BASE_URL}/digital-keys` },
    { name: 'Meet-Up Requests', url: `${BASE_URL}/meet-up-requests` }
  ];
  
  for (const endpoint of protectedEndpoints) {
    try {
      console.log(`\n📋 Testing: ${endpoint.name}`);
      const response = await axios.get(endpoint.url, { headers });
      console.log(`✅ Status: ${response.status}`);
      console.log(`✅ Response: ${JSON.stringify(response.data).substring(0, 100)}...`);
    } catch (error) {
      console.log(`❌ Error: ${error.response?.status || 'Connection failed'}`);
      console.log(`❌ Message: ${error.response?.data?.message || error.message}`);
    }
  }
}

async function runAllTests() {
  await testEndpointsWithoutAuth();
  const token = await testAuthEndpoints();
  await testProtectedEndpoints(token);
  
  console.log('\n🎯 Testing Complete!');
}

runAllTests().catch(console.error);
