const http = require('http');

// First login to get token
const loginData = JSON.stringify({
  email: 'admin@hotel.com',
  password: 'admin123'
});

const loginOptions = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/v1/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(loginData)
  }
};

console.log('=== TESTING TAPECHART AFTER FIX ===');
const loginReq = http.request(loginOptions, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const loginResult = JSON.parse(data);
      if (loginResult.token) {
        console.log('✅ Login successful');

        // Get TapeChart views first
        const token = loginResult.token;
        const viewsOptions = {
          hostname: 'localhost',
          port: 4000,
          path: '/api/v1/tape-chart/views',
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          }
        };

        const viewsReq = http.request(viewsOptions, (res) => {
          let viewsData = '';
          res.on('data', (chunk) => { viewsData += chunk; });
          res.on('end', () => {
            try {
              const viewsResult = JSON.parse(viewsData);

              if (viewsResult.data && viewsResult.data.length > 0) {
                console.log('📋 Found', viewsResult.data.length, 'TapeChart views');

                // Use first view to test chart data
                const firstView = viewsResult.data[0];
                console.log('🎯 Testing with view ID:', firstView._id);

                const chartOptions = {
                  hostname: 'localhost',
                  port: 4000,
                  path: '/api/v1/tape-chart/chart-data?viewId=' + firstView._id + '&startDate=2025-09-24&endDate=2025-09-30',
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                  }
                };

                const chartReq = http.request(chartOptions, (res) => {
                  let chartData = '';
                  res.on('data', (chunk) => { chartData += chunk; });
                  res.on('end', () => {
                    try {
                      const chartResult = JSON.parse(chartData);
                      console.log('\n=== TAPECHART OCCUPANCY RESULT ===');

                      if (chartResult.data && chartResult.data.summary) {
                        console.log('✅ SUCCESS! TapeChart data received');
                        console.log('📊 OCCUPANCY RATE:', chartResult.data.summary.occupancyRate + '%');
                        console.log('🏨 OCCUPIED ROOMS:', chartResult.data.summary.occupiedRooms);
                        console.log('🏨 TOTAL ROOMS:', chartResult.data.summary.totalRooms);
                        console.log('');
                        console.log('🎯 EXPECTED: Should now show ~5% instead of previous 3%');

                        // Check if this matches our other endpoints
                        if (chartResult.data.summary.occupancyRate >= 5) {
                          console.log('✅ FIXED! TapeChart now matches Admin Dashboard occupancy');
                        } else {
                          console.log('❌ Still showing low occupancy - may need additional fixes');
                        }
                      } else {
                        console.log('❌ No summary data in response');
                        console.log('Response status:', chartResult.success);
                        console.log('Error:', chartResult.message);
                      }
                    } catch (error) {
                      console.error('Chart parsing error:', error.message);
                      console.log('Raw response:', chartData.substring(0, 300));
                    }
                  });
                });

                chartReq.on('error', (error) => {
                  console.error('Chart request error:', error.message);
                });

                chartReq.end();
              } else {
                console.log('❌ No TapeChart views found');
              }
            } catch (error) {
              console.error('Views parsing error:', error.message);
            }
          });
        });

        viewsReq.on('error', (error) => {
          console.error('Views request error:', error.message);
        });

        viewsReq.end();
      }
    } catch (error) {
      console.error('Login error:', error.message);
    }
  });
});

loginReq.on('error', (error) => {
  console.error('Request error:', error.message);
});

loginReq.write(loginData);
loginReq.end();