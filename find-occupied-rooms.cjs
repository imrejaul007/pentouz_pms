const http = require('http');

function makeAPIRequest() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 4000,
      path: '/api/v1/rooms?hotelId=68cd01414419c17b5f6b4c12&limit=100',
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

async function findOccupiedRooms() {
  try {
    const response = await makeAPIRequest();

    if (response.data && response.data.rooms) {
      const occupiedRooms = response.data.rooms.filter(room => room.computedStatus === 'occupied');

      console.log('=== OCCUPIED ROOMS ===');
      console.log(`Total occupied: ${occupiedRooms.length}`);

      occupiedRooms.forEach(room => {
        console.log(`Room ${room.roomNumber}: ${room.computedStatus}`);
        if (room.currentBooking) {
          console.log(`  Booking: ${room.currentBooking.status} from ${room.currentBooking.checkIn} to ${room.currentBooking.checkOut}`);
        }
      });
    } else {
      console.log('No room data found');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

findOccupiedRooms();