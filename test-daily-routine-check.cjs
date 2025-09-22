const axios = require('axios');

const BASE_URL = 'http://localhost:4000/api/v1';

// Staff credentials
const STAFF_CREDENTIALS = {
  email: 'staff@hotel.com',
  password: 'staff123'
};

async function testDailyRoutineCheck() {
  try {
    console.log('🔐 Authenticating staff user...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, STAFF_CREDENTIALS);
    const staffToken = loginResponse.data.token;
    const staffUser = loginResponse.data.user;

    console.log('✅ Staff authentication successful');
    console.log('👤 Staff user:', {
      id: staffUser.id,
      name: staffUser.name,
      role: staffUser.role,
      hotelId: staffUser.hotelId
    });

    const headers = {
      'Authorization': `Bearer ${staffToken}`,
      'Content-Type': 'application/json'
    };

    console.log('\n🔍 Testing Daily Routine Check endpoints...');

    // Test getting assigned rooms
    try {
      console.log('\n📋 Testing GET /daily-inventory-checks/my-assigned-rooms...');
      const assignedRoomsResponse = await axios.get(`${BASE_URL}/daily-inventory-checks/my-assigned-rooms`, { headers });
      console.log('✅ Success: My assigned rooms');
      console.log('📊 Response:', JSON.stringify(assignedRoomsResponse.data, null, 2));
    } catch (error) {
      console.error('❌ Failed to get assigned rooms:', error.response?.data || error.message);
    }

    // Test getting all daily checks for this hotel
    try {
      console.log('\n📋 Testing GET /daily-inventory-checks...');
      const allChecksResponse = await axios.get(`${BASE_URL}/daily-inventory-checks`, { headers });
      console.log('✅ Success: All daily checks');
      console.log('📊 Data count:', allChecksResponse.data.data?.dailyChecks?.length || 0);
      if (allChecksResponse.data.data?.dailyChecks?.length > 0) {
        console.log('📊 First check:', JSON.stringify(allChecksResponse.data.data.dailyChecks[0], null, 2));
      }
    } catch (error) {
      console.error('❌ Failed to get all checks:', error.response?.data || error.message);
    }

    // Test creating a daily check assignment
    try {
      console.log('\n📋 Testing POST /daily-inventory-checks (create assignment)...');
      const createAssignmentData = {
        roomNumber: '101',
        assignedTo: staffUser.id,
        checkDate: new Date().toISOString(),
        estimatedDuration: 30,
        fixedInventory: [
          { itemName: 'TV Remote', quantity: 1, category: 'electronics' },
          { itemName: 'Bed Sheets', quantity: 2, category: 'bedroom' }
        ],
        dailyInventory: [
          { itemName: 'Towels', quantity: 4, category: 'bathroom' },
          { itemName: 'Soap', quantity: 2, category: 'bathroom' }
        ]
      };

      const createResponse = await axios.post(`${BASE_URL}/daily-inventory-checks`, createAssignmentData, { headers });
      console.log('✅ Success: Created daily check assignment');
      console.log('📊 Created assignment:', JSON.stringify(createResponse.data, null, 2));

      // Now test getting assigned rooms again
      console.log('\n📋 Re-testing GET /daily-inventory-checks/my-assigned-rooms after creation...');
      const newAssignedRoomsResponse = await axios.get(`${BASE_URL}/daily-inventory-checks/my-assigned-rooms`, { headers });
      console.log('✅ Success: My assigned rooms (after creation)');
      console.log('📊 Response:', JSON.stringify(newAssignedRoomsResponse.data, null, 2));

    } catch (error) {
      console.error('❌ Failed to create assignment:', error.response?.data || error.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testDailyRoutineCheck();