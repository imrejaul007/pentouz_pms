import axios from 'axios';

const BASE_URL = 'http://localhost:4000/api/v1';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4YjZjYTM5ZDUxZWRjOTQ1NzQ3NjlmNiIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc1NjgxMDYyNCwiZXhwIjoxNzU3NDE1NDI0fQ.VxICsjRU7NsPXy04ZdJv9uNbnQdoiOvwj0QGj3jJclU';

async function testBillingFix() {
  console.log('Testing Billing Session Creation with bookingNumber...\n');

  try {
    // Test creating a billing session with bookingNumber (string)
    console.log('1. Testing Create Billing Session with bookingNumber...');
    const createResponse = await axios.post(`${BASE_URL}/billing-sessions`, {
      guestName: 'Test Guest',
      roomNumber: '999', // Use a different room number
      bookingNumber: 'BK-2024-001', // This should work now
      hotelId: '68b6ca39d51edc94574769f6'
    }, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    });
    
    console.log('✅ Create Billing Session successful!');
    console.log('Status:', createResponse.status);
    console.log('Data:', createResponse.data);
    
    // Test creating another session with a different booking number
    console.log('\n2. Testing Create Billing Session with another bookingNumber...');
    const createResponse2 = await axios.post(`${BASE_URL}/billing-sessions`, {
      guestName: 'Another Guest',
      roomNumber: '998', // Use another different room number
      bookingNumber: 'BK-2024-002',
      hotelId: '68b6ca39d51edc94574769f6'
    }, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    });
    
    console.log('✅ Second Billing Session created successfully!');
    console.log('Status:', createResponse2.status);
    console.log('Data:', createResponse2.data);
    
  } catch (error) {
    console.log('❌ Error:', error.response?.status, error.response?.data || error.message);
  }
}

testBillingFix().catch(console.error);
