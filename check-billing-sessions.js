import axios from 'axios';

const BASE_URL = 'http://localhost:4000/api/v1';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4YjZjYTM5ZDUxZWRjOTQ1NzQ3NjlmNiIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc1NjgxMDYyNCwiZXhwIjoxNzU3NDE1NDI0fQ.VxICsjRU7NsPXy04ZdJv9uNbnQdoiOvwj0QGj3jJclU';

async function checkBillingSessions() {
  console.log('Checking existing billing sessions...\n');

  try {
    // Get all billing sessions for the hotel
    const response = await axios.get(`${BASE_URL}/billing-sessions/hotel/68afe8080c02fcbe30092b8e`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    });
    
    console.log('✅ Billing sessions retrieved successfully!');
    console.log('Total sessions:', response.data.results);
    
    if (response.data.data && response.data.data.length > 0) {
      console.log('\n📋 Active Billing Sessions:');
      response.data.data.forEach((session, index) => {
        console.log(`${index + 1}. Session ID: ${session.sessionId}`);
        console.log(`   Guest: ${session.guestName}`);
        console.log(`   Room: ${session.roomNumber}`);
        console.log(`   Status: ${session.status}`);
        console.log(`   Created: ${new Date(session.createdAt).toLocaleString()}`);
        console.log(`   ID: ${session._id}`);
        console.log('');
      });
      
      // Check for active sessions (draft or room_charged)
      const activeSessions = response.data.data.filter(s => 
        s.status === 'draft' || s.status === 'room_charged'
      );
      
      if (activeSessions.length > 0) {
        console.log(`⚠️  Found ${activeSessions.length} active sessions that need to be cleared:`);
        activeSessions.forEach(session => {
          console.log(`   - Room ${session.roomNumber}: ${session.guestName} (${session.status})`);
        });
        
        console.log('\n💡 To fix the "room already has active session" error, you can:');
        console.log('   1. Complete these sessions (checkout)');
        console.log('   2. Void these sessions');
        console.log('   3. Delete draft sessions');
      }
    } else {
      console.log('✅ No billing sessions found. You can create new ones.');
    }
    
  } catch (error) {
    console.log('❌ Error:', error.response?.status, error.response?.data || error.message);
  }
}

checkBillingSessions().catch(console.error);
