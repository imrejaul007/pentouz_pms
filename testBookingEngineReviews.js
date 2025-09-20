import axios from 'axios';

const API_BASE_URL = 'http://localhost:4000/api/v1';

async function testBookingEngineReviews() {
  try {
    console.log('🧪 Testing Booking Engine Review Routes...\n');

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

      // Test GET reviews from booking-engine
      console.log('\n2. Testing GET /booking-engine/reviews');
      try {
        const response = await axios.get(`${API_BASE_URL}/booking-engine/reviews`, { headers: authHeaders });
        console.log(`✅ GET booking-engine reviews: Found ${response.data.data?.length || 0} reviews`);
        if (response.data.data && response.data.data.length > 0) {
          console.log(`   Sample: ${response.data.data[0].content?.title || 'No title'} - Rating: ${response.data.data[0].content?.rating}`);
        } else {
          console.log('   No reviews found in ReviewManagement collection');
        }
      } catch (error) {
        console.log(`❌ GET booking-engine reviews: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
      }

      // Test creating a review via booking-engine
      console.log('\n3. Testing POST /booking-engine/reviews (Create)');
      try {
        const reviewData = {
          reviewId: 'TEST-' + Date.now(),
          platform: 'Direct',
          guest: {
            name: 'John Doe',
            email: 'john@example.com',
            verified: true
          },
          content: {
            rating: 5,
            title: 'Excellent Stay!',
            review: 'Had a wonderful time at the hotel. Great service and comfortable rooms.',
            stayDate: '2024-09-15'
          },
          sentiment: {
            score: 0.8,
            label: 'positive'
          },
          metadata: {
            source: 'Website',
            ipAddress: '192.168.1.1',
            userAgent: 'Test User Agent'
          },
          isPublic: true
        };

        const createResponse = await axios.post(`${API_BASE_URL}/booking-engine/reviews`, reviewData);
        console.log('✅ POST booking-engine reviews: Successfully created review');
        console.log(`   Created: ${createResponse.data.data?.content?.title || 'Unknown'}`);

        // Test GET again to see if it appears
        const updatedResponse = await axios.get(`${API_BASE_URL}/booking-engine/reviews`, { headers: authHeaders });
        console.log(`✅ GET after creation: Found ${updatedResponse.data.data?.length || 0} reviews`);

      } catch (error) {
        console.log(`❌ POST booking-engine reviews: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
        console.log('   Error details:', error.response?.data);
      }

      // Compare with the old reviews endpoint
      console.log('\n4. Comparing with /reviews endpoint');
      const userResponse = await axios.get(`${API_BASE_URL}/auth/me`, { headers: authHeaders });
      const hotelId = userResponse.data.user.hotelId;

      try {
        const oldReviewResponse = await axios.get(`${API_BASE_URL}/reviews/hotel/${hotelId}`, { headers: authHeaders });
        console.log(`✅ GET /reviews/hotel/:hotelId: Found ${oldReviewResponse.data.data?.length || 0} reviews`);
      } catch (error) {
        console.log(`❌ GET /reviews/hotel/:hotelId: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
      }

    } else {
      console.log('❌ Login failed');
    }

  } catch (error) {
    console.error('🚨 Test failed:', error.response?.data || error.message);
  }
}

testBookingEngineReviews();