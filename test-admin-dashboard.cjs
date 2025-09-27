const http = require('http');

function makeAPIRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 4000,
      path: path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Request': 'true'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

async function testAdminDashboard() {
  try {
    console.log('Testing Admin Dashboard occupancy endpoint...');
    const response = await makeAPIRequest('/api/v1/admin-dashboard/occupancy?hotelId=68cd01414419c17b5f6b4c12');

    console.log('Admin Dashboard Response Status:', response.status);
    console.log('Admin Dashboard Data Structure:');
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data && response.data.roomsByStatus) {
      console.log('\n=== ROOM STATUS BREAKDOWN ===');
      Object.entries(response.data.roomsByStatus).forEach(([status, rooms]) => {
        console.log(`${status}: ${rooms.length} rooms`);
        if (status === 'occupied' && rooms.length > 0) {
          console.log('Occupied rooms:');
          rooms.forEach(room => {
            console.log(`  Room ${room.roomNumber}: computedStatus=${room.computedStatus}, status=${room.status}`);
            if (room.currentBooking) {
              console.log(`    Booking: ${room.currentBooking.status} from ${room.currentBooking.checkIn} to ${room.currentBooking.checkOut}`);
            }
          });
        }
      });

      // Check specifically for Room 1003
      console.log('\n=== SEARCHING FOR ROOM 1003 ===');
      let room1003Found = false;
      Object.entries(response.data.roomsByStatus).forEach(([status, rooms]) => {
        const room1003 = rooms.find(room => room.roomNumber === '1003');
        if (room1003) {
          console.log(`Room 1003 found in ${status} status:`, {
            roomNumber: room1003.roomNumber,
            computedStatus: room1003.computedStatus,
            status: room1003.status,
            currentBooking: room1003.currentBooking
          });
          room1003Found = true;
        }
      });

      if (!room1003Found) {
        console.log('Room 1003 NOT FOUND in admin-dashboard response');
      }
    }

  } catch (error) {
    console.error('Error testing admin dashboard:', error.message);
  }
}

testAdminDashboard();