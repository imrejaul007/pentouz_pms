import axios from 'axios';

const API_BASE_URL = 'http://localhost:4000/api/v1';

async function testSeededData() {
  try {
    console.log('🧪 Testing Seeded Data...\n');

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

      // Test Promo Codes
      console.log('\n📊 Testing Promo Codes:');
      try {
        const promoResponse = await axios.get(`${API_BASE_URL}/booking-engine/promo-codes`, { headers: authHeaders });
        console.log(`✅ Found ${promoResponse.data.data?.length || 0} promo codes`);

        if (promoResponse.data.data && promoResponse.data.data.length > 0) {
          const activeCodes = promoResponse.data.data.filter(p => p.isActive);
          const expiredCodes = promoResponse.data.data.filter(p => !p.isActive);
          console.log(`   Active: ${activeCodes.length}`);
          console.log(`   Expired: ${expiredCodes.length}`);

          // Show sample promo codes
          promoResponse.data.data.slice(0, 3).forEach(promo => {
            console.log(`   - ${promo.code}: ${promo.name} (${promo.isActive ? 'Active' : 'Inactive'})`);
          });
        }
      } catch (error) {
        console.log(`❌ Promo codes error: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
      }

      // Test Reviews
      console.log('\n📝 Testing Reviews:');
      try {
        const reviewResponse = await axios.get(`${API_BASE_URL}/booking-engine/reviews`, { headers: authHeaders });
        console.log(`✅ Found ${reviewResponse.data.data?.length || 0} reviews`);

        if (reviewResponse.data.data && reviewResponse.data.data.length > 0) {
          const approved = reviewResponse.data.data.filter(r => r.moderation?.status === 'approved').length;
          const pending = reviewResponse.data.data.filter(r => r.moderation?.status === 'pending').length;
          const flagged = reviewResponse.data.data.filter(r => r.moderation?.status === 'flagged').length;
          const avgRating = reviewResponse.data.data.reduce((sum, r) => sum + r.content.rating, 0) / reviewResponse.data.data.length;

          console.log(`   Approved: ${approved}`);
          console.log(`   Pending: ${pending}`);
          console.log(`   Flagged: ${flagged}`);
          console.log(`   Average Rating: ${avgRating.toFixed(1)}`);

          // Show sample reviews with guest names
          console.log('\n   Sample Reviews:');
          reviewResponse.data.data.slice(0, 3).forEach(review => {
            console.log(`   - "${review.content?.title || 'No title'}" by ${review.guest?.name || 'Unknown Guest'} (${review.content?.rating}⭐)`);
            console.log(`     Status: ${review.moderation?.status || 'unknown'}, Platform: ${review.platform}`);
          });
        }
      } catch (error) {
        console.log(`❌ Reviews error: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
      }

      console.log('\n🎯 Summary:');
      console.log('✅ Both promo codes and reviews should now be properly seeded');
      console.log('✅ Guest names should display correctly instead of "Unknown Guest"');
      console.log('✅ Promo code stats should show active/expired counts');

    } else {
      console.log('❌ Login failed');
    }

  } catch (error) {
    console.error('🚨 Test failed:', error.response?.data || error.message);
  }
}

testSeededData();