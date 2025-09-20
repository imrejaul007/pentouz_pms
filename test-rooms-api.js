const axios = require('axios');

async function testRoomsAPI() {
  try {
    console.log('Testing rooms API...');
    
    // Test 1: Get rooms without dates
    console.log('\n1. Testing rooms without dates:');
    const response1 = await axios.get('http://localhost:4000/api/v1/rooms?hotelId=68afe8080c02fcbe30092b8e');
    console.log('Response status:', response1.status);
    console.log('Rooms found:', response1.data.data?.rooms?.length || 0);
    
    // Test 2: Get rooms with dates
    console.log('\n2. Testing rooms with dates:');
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const response2 = await axios.get(`http://localhost:4000/api/v1/rooms?hotelId=68afe8080c02fcbe30092b8e&checkIn=${today}&checkOut=${tomorrow}`);
    console.log('Response status:', response2.status);
    console.log('Available rooms found:', response2.data.data?.rooms?.length || 0);
    
    // Test 3: Test with same dates (this was causing the error)
    console.log('\n3. Testing rooms with same dates:');
    const response3 = await axios.get(`http://localhost:4000/api/v1/rooms?hotelId=68afe8080c02fcbe30092b8e&checkIn=${today}&checkOut=${today}`);
    console.log('Response status:', response3.status);
    console.log('Available rooms found:', response3.data.data?.rooms?.length || 0);
    
  } catch (error) {
    console.error('Error testing rooms API:', error.response?.data || error.message);
  }
}

testRoomsAPI();

