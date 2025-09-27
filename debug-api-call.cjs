const http = require('http');

function makeAPIRequest() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5001,
      path: '/api/rooms?hotelId=68c7ab1242a357d06adbb2aa&limit=100',
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

async function testAPI() {
  try {
    console.log('Testing API call to /api/rooms with X-Admin-Request header...');
    const response = await makeAPIRequest();

    console.log(`Status: ${response.status}`);
    console.log(`Total rooms: ${response.data?.rooms?.length || 0}`);

    if (response.data?.rooms) {
      const statusCounts = {};
      response.data.rooms.forEach(room => {
        const status = room.computedStatus || room.status;
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      console.log('\nRoom status breakdown:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`);
      });

      // Show reserved rooms specifically
      const reservedRooms = response.data.rooms.filter(r => (r.computedStatus || r.status) === 'reserved');
      console.log(`\nReserved rooms (${reservedRooms.length}):`);
      reservedRooms.forEach(room => {
        console.log(`  Room ${room.roomNumber}: computedStatus=${room.computedStatus}, status=${room.status}, floor=${room.floor}`);
        if (room.currentBooking) {
          console.log(`    Booking: ${room.currentBooking.status} from ${room.currentBooking.checkIn} to ${room.currentBooking.checkOut}`);
        }
      });

      // Show occupied rooms
      const occupiedRooms = response.data.rooms.filter(r => (r.computedStatus || r.status) === 'occupied');
      console.log(`\nOccupied rooms (${occupiedRooms.length}):`);
      occupiedRooms.slice(0, 3).forEach(room => {
        console.log(`  Room ${room.roomNumber}: computedStatus=${room.computedStatus}, status=${room.status}, floor=${room.floor}`);
        if (room.currentBooking) {
          console.log(`    Booking: ${room.currentBooking.status} from ${room.currentBooking.checkIn} to ${room.currentBooking.checkOut}`);
        }
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAPI();