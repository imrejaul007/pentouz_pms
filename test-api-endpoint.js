import axios from 'axios';

async function testEndpoint() {
  try {
    // First, let's test if the server is responding
    console.log('🔍 Testing API endpoint at http://localhost:4000/api/v1/booking-forms/templates');
    
    // You'll need to get a valid token from your app
    // For now, let's test without auth to see if endpoint exists
    const response = await axios.get('http://localhost:4000/api/v1/booking-forms/templates', {
      timeout: 5000
    });
    
    console.log('✅ Response received');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('💥 Error testing endpoint:');
    console.error('Status:', error.response?.status);
    console.error('Message:', error.message);
    console.error('Response data:', error.response?.data);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('🔴 Server is not running on port 4000!');
    }
  }
}

testEndpoint();