import axios from 'axios';

const API_BASE_URL = 'http://localhost:4000/api/v1';

async function testBookingEnginePromoCodes() {
  try {
    console.log('🧪 Testing Booking Engine Promo Code Routes...\n');

    // Step 1: Login to get JWT token
    console.log('1. Logging in as admin...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'admin@hotel.com',
      password: 'admin123'
    });

    if (loginResponse.data.status === 'success' && loginResponse.data.token) {
      console.log('✅ Login successful');
      const token = loginResponse.data.token;

      const authHeaders = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Test GET promo codes
      console.log('\n2. Testing GET /booking-engine/promo-codes');
      try {
        const response = await axios.get(`${API_BASE_URL}/booking-engine/promo-codes`, { headers: authHeaders });
        console.log(`✅ GET promo codes: Found ${response.data.data?.length || 0} promo codes`);
        if (response.data.data && response.data.data.length > 0) {
          console.log(`   Sample: ${response.data.data[0].code} - ${response.data.data[0].name}`);
        } else {
          console.log('   No promo codes found - this explains why frontend shows 0');
        }
      } catch (error) {
        console.log(`❌ GET promo codes: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
      }

      // Test creating a promo code
      console.log('\n3. Testing POST /booking-engine/promo-codes (Create)');
      try {
        const promoData = {
          codeId: 'TEST2024',
          code: 'WELCOME20',
          name: 'Welcome Discount',
          description: 'Welcome discount for new guests',
          type: 'percentage',
          discountValue: 20,
          maxAmount: 1000,
          minBookingValue: 2000,
          minNights: 1,
          maxNights: 7,
          applicableRoomTypes: [],
          firstTimeGuests: true,
          maxUsagePerGuest: 1,
          combinableWithOtherOffers: false,
          startDate: '2024-09-01',
          endDate: '2024-12-31',
          totalUsageLimit: 100,
          guestSegments: ['new'],
          channels: ['direct'],
          isActive: true
        };

        const createResponse = await axios.post(`${API_BASE_URL}/booking-engine/promo-codes`, promoData, { headers: authHeaders });
        console.log('✅ POST promo codes: Successfully created promo code');
        console.log(`   Created: ${createResponse.data.data?.code || 'Unknown'}`);

        // Test GET again to see if it appears
        const updatedResponse = await axios.get(`${API_BASE_URL}/booking-engine/promo-codes`, { headers: authHeaders });
        console.log(`✅ GET after creation: Found ${updatedResponse.data.data?.length || 0} promo codes`);

      } catch (error) {
        console.log(`❌ POST promo codes: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
        console.log('   Error details:', error.response?.data);
      }

      // Test validation
      console.log('\n4. Testing POST /booking-engine/promo-codes/validate');
      try {
        const validateData = {
          code: 'WELCOME20',
          bookingValue: 5000,
          checkInDate: '2024-10-01',
          checkOutDate: '2024-10-03'
        };

        const validateResponse = await axios.post(`${API_BASE_URL}/booking-engine/promo-codes/validate`, validateData, { headers: authHeaders });
        console.log('✅ POST validate: Success');
        console.log(`   Valid: ${validateResponse.data.data?.valid}, Discount: ${validateResponse.data.data?.discount}`);

      } catch (error) {
        console.log(`❌ POST validate: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
      }

    } else {
      console.log('❌ Login failed');
    }

  } catch (error) {
    console.error('🚨 Test failed:', error.response?.data || error.message);
  }
}

testBookingEnginePromoCodes();