# Production OTA Integration Guide

## 🔗 Real API Integration Steps

### 1. **Booking.com Partner Hub Setup**
```bash
# Register at Booking.com Partner Hub
https://partners.booking.com/

# Get your credentials:
- Client ID
- Client Secret  
- Property ID (Hotel ID)
- Webhook Secret
```

### 2. **Environment Variables**
```bash
# Add to .env file
BOOKINGCOM_API_BASE=https://distribution-xml.booking.com/2.5
BOOKINGCOM_CLIENT_ID=your_client_id_here
BOOKINGCOM_CLIENT_SECRET=your_client_secret_here
BOOKINGCOM_WEBHOOK_SECRET=your_webhook_secret_here
```

### 3. **Replace Mock Authentication**
```javascript
// In bookingComConnector.js
async authenticate() {
  try {
    const response = await axios.post(`${this.baseURL}/json/authorize`, {
      username: this.clientId,
      password: this.clientSecret
    });
    return response.data.access_token;
  } catch (error) {
    throw new Error(`Authentication failed: ${error.message}`);
  }
}
```

### 4. **Real API Endpoints**
```javascript
// Replace fetchAvailability() method
async fetchAvailability(propertyId, accessToken) {
  const response = await axios.post(`${this.baseURL}/json/availability`, {
    property_id: propertyId,
    checkin: new Date().toISOString().split('T')[0],
    checkout: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  }, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  return response.data;
}

// Update room rates
async updateRates(propertyId, roomRates, accessToken) {
  const response = await axios.post(`${this.baseURL}/json/rates`, {
    property_id: propertyId,
    rates: roomRates
  }, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  return response.data;
}

// Get reservations
async getReservations(propertyId, accessToken, fromDate, toDate) {
  const response = await axios.post(`${this.baseURL}/json/reservations`, {
    property_id: propertyId,
    from_date: fromDate,
    to_date: toDate
  }, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  return response.data;
}
```

### 5. **Webhook Implementation**
```javascript
// Add webhook route in routes/webhooks.js
router.post('/booking-com', (req, res) => {
  const signature = req.headers['x-booking-signature'];
  const body = JSON.stringify(req.body);
  
  const expectedSignature = crypto
    .createHmac('sha256', process.env.BOOKINGCOM_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');
  
  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process webhook
  const connector = new BookingComConnector();
  connector.handleWebhook(req.body, signature);
  
  res.status(200).json({ status: 'success' });
});
```

### 6. **Enhanced Hotel Model**
```javascript
// Add to Hotel schema
otaConnections: {
  bookingCom: {
    isEnabled: Boolean,
    credentials: {
      clientId: String,
      clientSecret: String,
      propertyId: String,
      webhookSecret: String
    },
    settings: {
      autoSync: { type: Boolean, default: true },
      syncFrequency: { type: String, default: '1h' },
      syncTypes: [{ type: String, enum: ['availability', 'rates', 'restrictions', 'reservations'] }]
    },
    lastSync: {
      availability: Date,
      rates: Date, 
      reservations: Date
    },
    stats: {
      totalSyncs: { type: Number, default: 0 },
      successfulSyncs: { type: Number, default: 0 },
      failedSyncs: { type: Number, default: 0 }
    }
  }
}
```

### 7. **Cron Jobs for Auto Sync**
```javascript
// Add to server.js or separate scheduler
import cron from 'node-cron';
import { BookingComConnector } from './services/bookingComConnector.js';

// Run every hour
cron.schedule('0 * * * *', async () => {
  console.log('Running scheduled OTA sync...');
  
  const hotels = await Hotel.find({
    'otaConnections.bookingCom.isEnabled': true,
    'otaConnections.bookingCom.settings.autoSync': true
  });
  
  for (const hotel of hotels) {
    const connector = new BookingComConnector();
    try {
      await connector.syncAvailability(hotel._id);
      await connector.syncReservations(hotel._id);
    } catch (error) {
      console.error(`Auto sync failed for hotel ${hotel._id}:`, error);
    }
  }
});
```

## 🔧 Additional Features to Implement

### Rate Management
- Sync room rates from PMS to OTA
- Dynamic pricing based on occupancy
- Seasonal rate adjustments

### Inventory Management  
- Room availability sync
- Overbooking protection
- Minimum stay restrictions

### Reservation Management
- Two-way booking sync
- Cancellation handling
- Modification processing

### Analytics & Reporting
- Revenue tracking per OTA
- Booking conversion rates
- Channel performance metrics

## 🚀 Testing Strategy

### 1. **Sandbox Environment**
```bash
# Use Booking.com test environment
BOOKINGCOM_API_BASE=https://distribution-xml.booking.com/2.5-test
```

### 2. **Unit Tests**
```javascript
describe('BookingComConnector', () => {
  it('should authenticate successfully', async () => {
    const connector = new BookingComConnector();
    const token = await connector.authenticate();
    expect(token).toBeDefined();
  });
  
  it('should sync availability', async () => {
    const result = await connector.syncAvailability(hotelId);
    expect(result.syncId).toBeDefined();
  });
});
```

### 3. **Integration Tests**
```javascript
describe('OTA API Integration', () => {
  it('should handle webhook notifications', async () => {
    const response = await request(app)
      .post('/api/v1/webhooks/booking-com')
      .send(mockWebhookPayload)
      .set('x-booking-signature', validSignature);
    
    expect(response.status).toBe(200);
  });
});
```

This guide transforms your current mock implementation into a production-ready OTA integration system with real data persistence and API connections.