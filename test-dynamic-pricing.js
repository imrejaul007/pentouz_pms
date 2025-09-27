import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

console.log('🧪 Testing Dynamic Pricing After Seeding Rules');
console.log('=' .repeat(50));

// Test dynamic pricing calculation
async function testDynamicPricing() {
  try {
    const pricingData = {
      extraPersons: [
        { name: 'John Smith', type: 'adult' },
        { name: 'Jane Smith', type: 'child', age: 8 }
      ],
      baseBookingData: {
        roomType: 'double',
        baseRoomRate: 5000,
        checkIn: '2024-08-15',
        checkOut: '2024-08-18',
        nights: 3,
        source: 'direct',
        guestDetails: { adults: 2, children: 1 }
      }
    };

    console.log('\n📊 Testing Dynamic Pricing Calculation...');
    console.log('Request data:', JSON.stringify(pricingData, null, 2));

    const response = await axios.post(`${API_BASE}/extra-person-pricing/calculate`, pricingData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('\n✅ Dynamic pricing calculation successful!');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));

    return true;
  } catch (error) {
    console.error('\n❌ Dynamic pricing calculation failed:');
    console.error('Status:', error.response?.status);
    console.error('Error:', error.response?.data || error.message);
    return false;
  }
}

// Main test
async function runTests() {
  console.log('🔄 Starting dynamic pricing tests...');

  const pricingResult = await testDynamicPricing();

  console.log('\n📋 TEST SUMMARY:');
  console.log('Dynamic Pricing:', pricingResult ? '✅ PASSED' : '❌ FAILED');

  if (pricingResult) {
    console.log('\n🎉 All tests passed! Dynamic pricing is working correctly.');
  } else {
    console.log('\n⚠️ Some tests failed. Please check the backend server and database.');
  }
}

runTests().catch(console.error);