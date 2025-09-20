import axios from 'axios';

const BASE_URL = 'http://localhost:4000/api/v1';
let authToken = '';

// Test user credentials
const testUser = {
  email: 'john@example.com',
  password: 'guest123'
};

async function login() {
  try {
    console.log('🔐 Logging in...');
    const response = await axios.post(`${BASE_URL}/auth/login`, testUser);
    authToken = response.data.token;
    console.log('✅ Login successful');
    return true;
  } catch (error) {
    console.log('❌ Login failed:', error.response?.data?.message || error.message);
    return false;
  }
}

async function testPhase1Loyalty() {
  console.log('\n🎯 Testing Phase 1: Loyalty & Rewards System');
  console.log('=' .repeat(50));
  
  try {
    const headers = { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' };
    
    // Test 1: Get loyalty dashboard
    console.log('📋 Test 1: Get loyalty dashboard');
    const dashboardResponse = await axios.get(`${BASE_URL}/loyalty/dashboard`, { headers });
    console.log('✅ Loyalty dashboard:', dashboardResponse.data);
    
    // Test 2: Get loyalty offers
    console.log('📋 Test 2: Get loyalty offers');
    const offersResponse = await axios.get(`${BASE_URL}/loyalty/offers`, { headers });
    console.log('✅ Loyalty offers:', offersResponse.data);
    
    // Test 3: Get transaction history
    console.log('📋 Test 3: Get transaction history');
    const historyResponse = await axios.get(`${BASE_URL}/loyalty/transactions`, { headers });
    console.log('✅ Transaction history:', historyResponse.data);
    
    console.log('✅ Phase 1: Loyalty & Rewards System - PASSED');
    return true;
  } catch (error) {
    console.log('❌ Phase 1 failed:', error.response?.data?.message || error.message);
    return false;
  }
}

async function testPhase2HotelServices() {
  console.log('\n🎯 Testing Phase 2: Hotel Services System');
  console.log('=' .repeat(50));
  
  try {
    const headers = { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' };
    
    // Test 1: Get hotel services
    console.log('📋 Test 1: Get hotel services');
    const servicesResponse = await axios.get(`${BASE_URL}/hotel-services`, { headers });
    console.log('✅ Hotel services:', servicesResponse.data);
    
    // Test 2: Get service bookings
    console.log('📋 Test 2: Get service bookings');
    const bookingsResponse = await axios.get(`${BASE_URL}/hotel-services/bookings`, { headers });
    console.log('✅ Service bookings:', bookingsResponse.data);
    
    console.log('✅ Phase 2: Hotel Services System - PASSED');
    return true;
  } catch (error) {
    console.log('❌ Phase 2 failed:', error.response?.data?.message || error.message);
    return false;
  }
}

async function testPhase3Notifications() {
  console.log('\n🎯 Testing Phase 3: Notifications System');
  console.log('=' .repeat(50));
  
  try {
    const headers = { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' };
    
    // Test 1: Get notifications
    console.log('📋 Test 1: Get notifications');
    const notificationsResponse = await axios.get(`${BASE_URL}/notifications`, { headers });
    console.log('✅ Notifications:', notificationsResponse.data);
    
    // Test 2: Get notification preferences
    console.log('📋 Test 2: Get notification preferences');
    const preferencesResponse = await axios.get(`${BASE_URL}/notifications/preferences`, { headers });
    console.log('✅ Notification preferences:', preferencesResponse.data);
    
    console.log('✅ Phase 3: Notifications System - PASSED');
    return true;
  } catch (error) {
    console.log('❌ Phase 3 failed:', error.response?.data?.message || error.message);
    return false;
  }
}

async function testPhase4DigitalKeys() {
  console.log('\n🎯 Testing Phase 4: Digital Room Key System');
  console.log('=' .repeat(50));
  
  try {
    const headers = { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' };
    
    // Test 1: Get digital keys
    console.log('📋 Test 1: Get digital keys');
    const keysResponse = await axios.get(`${BASE_URL}/digital-keys`, { headers });
    console.log('✅ Digital keys:', keysResponse.data);
    
    // Test 2: Get key statistics
    console.log('📋 Test 2: Get key statistics');
    const statsResponse = await axios.get(`${BASE_URL}/digital-keys/stats/overview`, { headers });
    console.log('✅ Key statistics:', statsResponse.data);
    
    console.log('✅ Phase 4: Digital Room Key System - PASSED');
    return true;
  } catch (error) {
    console.log('❌ Phase 4 failed:', error.response?.data?.message || error.message);
    return false;
  }
}

async function testPhase5MeetUpRequests() {
  console.log('\n🎯 Testing Phase 5: Guest Meet-Up Requests System');
  console.log('=' .repeat(50));
  
  try {
    const headers = { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' };
    
    // Test 1: Get meet-up requests
    console.log('📋 Test 1: Get meet-up requests');
    const meetUpsResponse = await axios.get(`${BASE_URL}/meet-up-requests`, { headers });
    console.log('✅ Meet-up requests:', meetUpsResponse.data);
    
    // Test 2: Get meet-up statistics
    console.log('📋 Test 2: Get meet-up statistics');
    const statsResponse = await axios.get(`${BASE_URL}/meet-up-requests/stats/overview`, { headers });
    console.log('✅ Meet-up statistics:', statsResponse.data);
    
    console.log('✅ Phase 5: Guest Meet-Up Requests System - PASSED');
    return true;
  } catch (error) {
    console.log('❌ Phase 5 failed:', error.response?.data?.message || error.message);
    return false;
  }
}

async function testAllPhases() {
  console.log('🚀 Starting Comprehensive Hotel Management System Tests');
  console.log('=' .repeat(60));
  
  // Login first
  if (!(await login())) {
    console.log('❌ Cannot proceed without authentication');
    return;
  }
  
  const results = {
    phase1: await testPhase1Loyalty(),
    phase2: await testPhase2HotelServices(),
    phase3: await testPhase3Notifications(),
    phase4: await testPhase4DigitalKeys(),
    phase5: await testPhase5MeetUpRequests()
  };
  
  console.log('\n📊 Test Results Summary');
  console.log('=' .repeat(30));
  console.log(`Phase 1 (Loyalty): ${results.phase1 ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Phase 2 (Hotel Services): ${results.phase2 ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Phase 3 (Notifications): ${results.phase3 ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Phase 4 (Digital Keys): ${results.phase4 ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Phase 5 (Meet-Up Requests): ${results.phase5 ? '✅ PASSED' : '❌ FAILED'}`);
  
  const passedCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.keys(results).length;
  
  console.log(`\n🎯 Overall Result: ${passedCount}/${totalCount} phases passed`);
  
  if (passedCount === totalCount) {
    console.log('🎉 All phases are working correctly!');
  } else {
    console.log('⚠️  Some phases need attention. Check the error messages above.');
  }
}

testAllPhases().catch(console.error);
