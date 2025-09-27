import fetch from 'node-fetch';

// Configuration
const BASE_URL = 'http://localhost:4000/api/v1';
const ADMIN_CREDENTIALS = {
  email: 'admin@hotel.com',
  password: 'admin123'
};

let authToken = null;

// Helper function to make API requests
async function makeRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  console.log(`\n🔗 Making ${options.method || 'GET'} request to: ${url}`);
  
  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    const responseText = await response.text();
    let data;
    
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.log(`❌ Response is not JSON: ${responseText.substring(0, 200)}...`);
      return { status: response.status, data: responseText };
    }

    console.log(`📊 Status: ${response.status}`);
    console.log(`📄 Response:`, JSON.stringify(data, null, 2));
    
    return { status: response.status, data };
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
    return { status: 'error', error: error.message };
  }
}

// Test functions
async function testLogin() {
  console.log('\n🔐 Testing Admin Login...');
  const result = await makeRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(ADMIN_CREDENTIALS)
  });

  if (result.status === 200 && result.data.token) {
    authToken = result.data.token;
    console.log('✅ Login successful! Token received.');
    return true;
  } else {
    console.log('❌ Login failed!');
    return false;
  }
}

async function testGetAllTravelAgents() {
  console.log('\n👥 Testing Get All Travel Agents...');
  const result = await makeRequest('/travel-agents');
  
  if (result.status === 200) {
    console.log(`✅ Found ${result.data.data?.length || 0} travel agents`);
    if (result.data.data && result.data.data.length > 0) {
      console.log('📋 Sample agent:', {
        companyName: result.data.data[0].companyName,
        agentCode: result.data.data[0].agentCode,
        status: result.data.data[0].status,
        hotelId: result.data.data[0].hotelId
      });
    }
  } else {
    console.log('❌ Failed to get travel agents');
  }
  return result;
}

async function testGetTravelAgentById() {
  console.log('\n🔍 Testing Get Travel Agent by ID...');
  
  // First get all agents to get an ID
  const allAgents = await makeRequest('/travel-agents');
  if (allAgents.status === 200 && allAgents.data.data && allAgents.data.data.length > 0) {
    const agentId = allAgents.data.data[0]._id;
    console.log(`Using agent ID: ${agentId}`);
    
    const result = await makeRequest(`/travel-agents/${agentId}`);
    
    if (result.status === 200) {
      console.log('✅ Successfully retrieved travel agent details');
      console.log('📋 Agent details:', {
        companyName: result.data.data.companyName,
        agentCode: result.data.data.agentCode,
        contactPerson: result.data.data.contactPerson,
        status: result.data.data.status,
        performanceMetrics: result.data.data.performanceMetrics
      });
    } else {
      console.log('❌ Failed to get travel agent by ID');
    }
    return result;
  } else {
    console.log('❌ No agents found to test with');
    return { status: 'error', message: 'No agents available' };
  }
}

async function testGetTravelAgentPerformance() {
  console.log('\n📊 Testing Get Travel Agent Performance...');
  
  // First get all agents to get an ID
  const allAgents = await makeRequest('/travel-agents');
  if (allAgents.status === 200 && allAgents.data.data && allAgents.data.data.length > 0) {
    const agentId = allAgents.data.data[0]._id;
    console.log(`Using agent ID: ${agentId}`);
    
    const result = await makeRequest(`/travel-agents/${agentId}/performance`);
    
    if (result.status === 200) {
      console.log('✅ Successfully retrieved travel agent performance');
    } else {
      console.log('❌ Failed to get travel agent performance');
    }
    return result;
  } else {
    console.log('❌ No agents found to test with');
    return { status: 'error', message: 'No agents available' };
  }
}

async function testValidateAgentCode() {
  console.log('\n✅ Testing Validate Agent Code...');
  
  // First get all agents to get a code
  const allAgents = await makeRequest('/travel-agents');
  if (allAgents.status === 200 && allAgents.data.data && allAgents.data.data.length > 0) {
    const agentCode = allAgents.data.data[0].agentCode;
    console.log(`Using agent code: ${agentCode}`);
    
    const result = await makeRequest(`/travel-agents/validate-code/${agentCode}`);
    
    if (result.status === 200) {
      console.log('✅ Successfully validated agent code');
    } else {
      console.log('❌ Failed to validate agent code');
    }
    return result;
  } else {
    console.log('❌ No agents found to test with');
    return { status: 'error', message: 'No agents available' };
  }
}

async function testAdminTravelDashboard() {
  console.log('\n📈 Testing Admin Travel Dashboard...');
  const result = await makeRequest('/admin/travel-dashboard/overview');
  
  if (result.status === 200) {
    console.log('✅ Successfully retrieved travel dashboard overview');
  } else {
    console.log('❌ Failed to get travel dashboard overview');
  }
  return result;
}

async function testAdminTravelDashboardAgents() {
  console.log('\n👥 Testing Admin Travel Dashboard Agents...');
  const result = await makeRequest('/admin/travel-dashboard/agents');
  
  if (result.status === 200) {
    console.log('✅ Successfully retrieved travel dashboard agents');
  } else {
    console.log('❌ Failed to get travel dashboard agents');
  }
  return result;
}

async function testAdminTravelDashboardAnalytics() {
  console.log('\n📊 Testing Admin Travel Dashboard Analytics...');
  const result = await makeRequest('/admin/travel-dashboard/analytics');
  
  if (result.status === 200) {
    console.log('✅ Successfully retrieved travel dashboard analytics');
  } else {
    console.log('❌ Failed to get travel dashboard analytics');
  }
  return result;
}

// Main test function
async function runTests() {
  console.log('🚀 Starting Travel Agent Routes Test...');
  console.log('=' .repeat(60));
  
  // Test 1: Login
  const loginSuccess = await testLogin();
  if (!loginSuccess) {
    console.log('❌ Cannot proceed without authentication');
    return;
  }
  
  // Test 2: Get all travel agents
  await testGetAllTravelAgents();
  
  // Test 3: Get travel agent by ID
  await testGetTravelAgentById();
  
  // Test 4: Get travel agent performance
  await testGetTravelAgentPerformance();
  
  // Test 5: Validate agent code
  await testValidateAgentCode();
  
  // Test 6: Admin travel dashboard overview
  await testAdminTravelDashboard();
  
  // Test 7: Admin travel dashboard agents
  await testAdminTravelDashboardAgents();
  
  // Test 8: Admin travel dashboard analytics
  await testAdminTravelDashboardAnalytics();
  
  console.log('\n' + '=' .repeat(60));
  console.log('🏁 Travel Agent Routes Test Completed!');
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test failed with error:', error);
  process.exit(1);
});
