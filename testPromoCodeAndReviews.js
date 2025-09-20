import axios from 'axios';

const API_BASE_URL = 'http://localhost:4000/api/v1';

async function testPromoCodeAndReviews() {
  try {
    console.log('🧪 Testing Promo Code and Review Management...\n');

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

      // Get hotel ID
      const userResponse = await axios.get(`${API_BASE_URL}/auth/me`, { headers: authHeaders });
      const hotelId = userResponse.data.user.hotelId;
      console.log(`Hotel ID: ${hotelId}`);

      // Test Promo Code Routes
      console.log('\n📊 Testing Promo Code Management:');

      const promoRoutes = [
        '/promo-codes',
        '/promo-codes/stats',
        '/marketing/promo-codes',
        '/admin-dashboard/promo-codes'
      ];

      for (const route of promoRoutes) {
        try {
          const response = await axios.get(`${API_BASE_URL}${route}`, { headers: authHeaders });
          console.log(`✅ ${route}: Found ${response.data.data?.length || 'data'} records`);
        } catch (error) {
          console.log(`❌ ${route}: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
        }
      }

      // Test Review Routes
      console.log('\n📝 Testing Review Management:');

      const reviewRoutes = [
        `/reviews/hotel/${hotelId}`,
        `/reviews/hotel/${hotelId}/summary`,
        '/reviews/pending',
        '/reviews'
      ];

      for (const route of reviewRoutes) {
        try {
          const response = await axios.get(`${API_BASE_URL}${route}`, { headers: authHeaders });
          console.log(`✅ ${route}: Found ${response.data.data?.length || response.data.totalReviews || 'data'} records`);
          if (response.data.data && response.data.data.length > 0) {
            console.log(`   Sample: ${response.data.data[0].title || response.data.data[0].content || 'Review data'}`);
          }
        } catch (error) {
          console.log(`❌ ${route}: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
        }
      }

      // Check if review data exists in database
      console.log('\n🔍 Additional Database Checks:');

      // Test creating a review to see if the route works
      try {
        const reviewData = {
          hotelId: hotelId,
          rating: 5,
          title: 'Test Review',
          content: 'This is a test review to check if the system works',
          guestName: 'Test Guest',
          guestEmail: 'test@example.com'
        };

        const createResponse = await axios.post(`${API_BASE_URL}/reviews`, reviewData, { headers: authHeaders });
        console.log('✅ Review creation test: Success');

        // Now try to fetch reviews again
        const updatedResponse = await axios.get(`${API_BASE_URL}/reviews/hotel/${hotelId}`, { headers: authHeaders });
        console.log(`✅ Reviews after creation: Found ${updatedResponse.data.data?.length || 0} records`);

      } catch (error) {
        console.log(`❌ Review creation test: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
      }

    } else {
      console.log('❌ Login failed');
    }

  } catch (error) {
    console.error('🚨 Test failed:', error.response?.data || error.message);
  }
}

testPromoCodeAndReviews();