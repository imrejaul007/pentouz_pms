import request from 'supertest';
import app from '../../server.js';
import mongoose from 'mongoose';

describe('Booking Tests', () => {
  let testUser;
  let testHotel;
  let testRoom;
  let authToken;

  beforeEach(async () => {
    // Create test hotel
    testHotel = await global.testUtils.createTestHotel();
    
    // Create test user
    testUser = await global.testUtils.createTestUser({
      hotelId: testHotel._id,
      role: 'guest'
    });

    // Create test room
    const Room = mongoose.model('Room');
    testRoom = await Room.create({
      hotelId: testHotel._id,
      roomNumber: '101',
      type: 'deluxe',
      capacity: 2,
      price: 1000,
      status: 'available',
      amenities: ['wifi', 'ac', 'tv']
    });

    // Generate auth token
    authToken = global.testUtils.generateTestToken(testUser);
  });

  describe('POST /api/v1/bookings', () => {
    it('should create a new booking successfully', async () => {
      const bookingData = {
        roomId: testRoom._id,
        checkIn: new Date(Date.now() + 86400000), // Tomorrow
        checkOut: new Date(Date.now() + 172800000), // Day after tomorrow
        guests: 2,
        specialRequests: 'Early check-in please'
      };

      const response = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${authToken}`)
        .send(bookingData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('_id');
      expect(response.body.data.roomId).toBe(testRoom._id.toString());
      expect(response.body.data.status).toBe('confirmed');
    });

    it('should fail with invalid room ID', async () => {
      const bookingData = {
        roomId: new mongoose.Types.ObjectId(),
        checkIn: new Date(Date.now() + 86400000),
        checkOut: new Date(Date.now() + 172800000),
        guests: 2
      };

      const response = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${authToken}`)
        .send(bookingData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should fail with invalid dates', async () => {
      const bookingData = {
        roomId: testRoom._id,
        checkIn: new Date(Date.now() - 86400000), // Yesterday
        checkOut: new Date(Date.now() + 86400000),
        guests: 2
      };

      const response = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${authToken}`)
        .send(bookingData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should fail without authentication', async () => {
      const bookingData = {
        roomId: testRoom._id,
        checkIn: new Date(Date.now() + 86400000),
        checkOut: new Date(Date.now() + 172800000),
        guests: 2
      };

      const response = await request(app)
        .post('/api/v1/bookings')
        .send(bookingData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/bookings', () => {
    beforeEach(async () => {
      // Create test bookings
      const Booking = mongoose.model('Booking');
      await Booking.create([
        {
          hotelId: testHotel._id,
          userId: testUser._id,
          roomId: testRoom._id,
          checkIn: new Date(Date.now() + 86400000),
          checkOut: new Date(Date.now() + 172800000),
          totalAmount: 1000,
          status: 'confirmed'
        },
        {
          hotelId: testHotel._id,
          userId: testUser._id,
          roomId: testRoom._id,
          checkIn: new Date(Date.now() + 259200000), // 3 days from now
          checkOut: new Date(Date.now() + 345600000), // 4 days from now
          totalAmount: 1000,
          status: 'pending'
        }
      ]);
    });

    it('should get user bookings', async () => {
      const response = await request(app)
        .get('/api/v1/bookings')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty('_id');
      expect(response.body.data[0]).toHaveProperty('status');
    });

    it('should filter bookings by status', async () => {
      const response = await request(app)
        .get('/api/v1/bookings?status=confirmed')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('confirmed');
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/bookings');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/bookings/:id', () => {
    let testBooking;

    beforeEach(async () => {
      const Booking = mongoose.model('Booking');
      testBooking = await Booking.create({
        hotelId: testHotel._id,
        userId: testUser._id,
        roomId: testRoom._id,
        checkIn: new Date(Date.now() + 86400000),
        checkOut: new Date(Date.now() + 172800000),
        totalAmount: 1000,
        status: 'confirmed'
      });
    });

    it('should get booking by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/bookings/${testBooking._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(testBooking._id.toString());
      expect(response.body.data.status).toBe('confirmed');
    });

    it('should fail with invalid booking ID', async () => {
      const response = await request(app)
        .get(`/api/v1/bookings/${new mongoose.Types.ObjectId()}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get(`/api/v1/bookings/${testBooking._id}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/bookings/:id', () => {
    let testBooking;

    beforeEach(async () => {
      const Booking = mongoose.model('Booking');
      testBooking = await Booking.create({
        hotelId: testHotel._id,
        userId: testUser._id,
        roomId: testRoom._id,
        checkIn: new Date(Date.now() + 86400000),
        checkOut: new Date(Date.now() + 172800000),
        totalAmount: 1000,
        status: 'confirmed'
      });
    });

    it('should update booking successfully', async () => {
      const updateData = {
        specialRequests: 'Updated special requests',
        guests: 3
      };

      const response = await request(app)
        .put(`/api/v1/bookings/${testBooking._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.specialRequests).toBe('Updated special requests');
      expect(response.body.data.guests).toBe(3);
    });

    it('should fail with invalid booking ID', async () => {
      const response = await request(app)
        .put(`/api/v1/bookings/${new mongoose.Types.ObjectId()}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ specialRequests: 'test' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/v1/bookings/:id', () => {
    let testBooking;

    beforeEach(async () => {
      const Booking = mongoose.model('Booking');
      testBooking = await Booking.create({
        hotelId: testHotel._id,
        userId: testUser._id,
        roomId: testRoom._id,
        checkIn: new Date(Date.now() + 86400000),
        checkOut: new Date(Date.now() + 172800000),
        totalAmount: 1000,
        status: 'confirmed'
      });
    });

    it('should cancel booking successfully', async () => {
      const response = await request(app)
        .delete(`/api/v1/bookings/${testBooking._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Booking cancelled successfully');
    });

    it('should fail with invalid booking ID', async () => {
      const response = await request(app)
        .delete(`/api/v1/bookings/${new mongoose.Types.ObjectId()}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
});
