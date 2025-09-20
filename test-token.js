import axios from 'axios';

const BASE_URL = 'http://localhost:4000/api/v1';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4YjZjYTM5ZDUxZWRjOTQ1NzQ3NjlmNiIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc1NjgxMDYyNCwiZXhwIjoxNzU3NDE1NDI0fQ.VxICsjRU7NsPXy04ZdJv9uNbnQdoiOvwj0QGj3jJclU';

async function testToken() {
  console.log('Testing JWT Token Access...\n');

  try {
    // Test POS outlets endpoint with token
    console.log('1. Testing POS Outlets endpoint with token...');
    const posResponse = await axios.get(`${BASE_URL}/pos/outlets`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    });
    
    console.log('✅ POS Outlets access successful!');
    console.log('Status:', posResponse.status);
    console.log('Data:', posResponse.data);
    
  } catch (error) {
    console.log('❌ POS Outlets error:', error.response?.status, error.response?.data || error.message);
  }

  try {
    // Test Billing Sessions endpoint with token
    console.log('\n2. Testing Billing Sessions endpoint with token...');
    const billingResponse = await axios.get(`${BASE_URL}/billing-sessions`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    });
    
    console.log('✅ Billing Sessions access successful!');
    console.log('Status:', billingResponse.status);
    console.log('Data:', billingResponse.data);
    
  } catch (error) {
    console.log('❌ Billing Sessions error:', error.response?.status, error.response?.data || error.message);
  }

  try {
    // Test creating a billing session
    console.log('\n3. Testing Create Billing Session with token...');
    const createResponse = await axios.post(`${BASE_URL}/billing-sessions`, {
      guestName: 'Test Guest',
      roomNumber: '101',
      hotelId: '68b6ca39d51edc94574769f6' // This should match the user's hotelId
    }, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    });
    
    console.log('✅ Create Billing Session successful!');
    console.log('Status:', createResponse.status);
    console.log('Data:', createResponse.data);
    
  } catch (error) {
    console.log('❌ Create Billing Session error:', error.response?.status, error.response?.data || error.message);
  }
}

testToken().catch(console.error);
