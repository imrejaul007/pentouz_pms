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

async function testBothEndpoints() {
  try {
    console.log('=== TESTING ADMIN DASHBOARD OCCUPANCY ENDPOINT ===');
    const adminResponse = await makeAPIRequest('/api/v1/admin-dashboard/occupancy?hotelId=68cd01414419c17b5f6b4c12');

    console.log('Admin Dashboard Response Status:', adminResponse.status);

    if (adminResponse.data && adminResponse.data.rooms) {
      console.log(`Total rooms in admin dashboard: ${adminResponse.data.rooms.length}`);

      // Check for Room 1003
      const room1003 = adminResponse.data.rooms.find(room => room.roomNumber === '1003');
      if (room1003) {
        console.log('Room 1003 found in admin dashboard:', {
          roomNumber: room1003.roomNumber,
          computedStatus: room1003.computedStatus,
          status: room1003.status,
          currentBooking: room1003.currentBooking,
          floor: room1003.floor
        });
      } else {
        console.log('Room 1003 NOT FOUND in admin dashboard');

        // Show a sample of rooms
        console.log('\nFirst 5 rooms in admin dashboard:');
        adminResponse.data.rooms.slice(0, 5).forEach(room => {
          console.log(`  Room ${room.roomNumber}: status=${room.status}, computedStatus=${room.computedStatus}`);
        });
      }

      // Count occupied rooms
      const occupiedRooms = adminResponse.data.rooms.filter(r => (r.computedStatus || r.status) === 'occupied');
      console.log(`\nOccupied rooms in admin dashboard: ${occupiedRooms.length}`);
      occupiedRooms.forEach(room => {
        console.log(`  Room ${room.roomNumber}: ${room.computedStatus || room.status}`);
      });
    }

    console.log('\n=== TESTING ROOMS ENDPOINT ===');
    const roomsResponse = await makeAPIRequest('/api/v1/rooms?hotelId=68cd01414419c17b5f6b4c12&limit=100');

    console.log('Rooms Response Status:', roomsResponse.status);

    if (roomsResponse.data && roomsResponse.data.rooms) {
      console.log(`Total rooms in rooms endpoint: ${roomsResponse.data.rooms.length}`);

      // Check for Room 1003
      const room1003Rooms = roomsResponse.data.rooms.find(room => room.roomNumber === '1003');
      if (room1003Rooms) {
        console.log('Room 1003 found in rooms endpoint:', {
          roomNumber: room1003Rooms.roomNumber,
          computedStatus: room1003Rooms.computedStatus,
          status: room1003Rooms.status,
          currentBooking: room1003Rooms.currentBooking,
          floor: room1003Rooms.floor
        });
      } else {
        console.log('Room 1003 NOT FOUND in rooms endpoint');
      }

      // Count occupied rooms
      const occupiedRoomsEndpoint = roomsResponse.data.rooms.filter(r => (r.computedStatus || r.status) === 'occupied');
      console.log(`\nOccupied rooms in rooms endpoint: ${occupiedRoomsEndpoint.length}`);
      occupiedRoomsEndpoint.forEach(room => {
        console.log(`  Room ${room.roomNumber}: ${room.computedStatus || room.status}`);
      });
    }

  } catch (error) {
    console.error('Error testing endpoints:', error.message);
  }
}

testBothEndpoints();