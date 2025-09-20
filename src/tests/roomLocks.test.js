import request from 'supertest';
import mongoose from 'mongoose';
import app from '../server.js';
import User from '../models/User.js';
import Hotel from '../models/Hotel.js';
import Room from '../models/Room.js';
import RoomLock from '../models/RoomLock.js';

describe('Room Lock System', () => {
  let adminToken;
  let staffToken;
  let hotelId;
  let roomId;
  let adminUser;
  let staffUser;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGO_URI_TEST || process.env.MONGO_URI);
  });

  beforeEach(async () => {
    // Clean database
    await User.deleteMany({});
    await Hotel.deleteMany({});
    await Room.deleteMany({});
    await RoomLock.deleteMany({});

    // Create test hotel
    const hotel = await Hotel.create({
      name: 'Test Hotel',
      address: { city: 'Test City', country: 'Test Country' },
      contact: { phone: '123-456-7890', email: 'test@hotel.com' }
    });
    hotelId = hotel._id;

    // Create admin user
    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@test.com',
      password: 'password123',
      role: 'admin',
      hotelId: hotelId
    });

    // Create staff user
    staffUser = await User.create({
      name: 'Staff User',
      email: 'staff@test.com',
      password: 'password123',
      role: 'staff',
      hotelId: hotelId
    });

    // Create test room
    const room = await Room.create({
      hotelId: hotelId,
      roomNumber: '101',
      type: 'single',
      baseRate: 2500,
      floor: 1,
      capacity: 1,
      amenities: ['WiFi', 'AC'],
      status: 'vacant'
    });
    roomId = room._id;

    // Get auth tokens
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'password123' });
    adminToken = adminLogin.body.token;

    const staffLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'staff@test.com', password: 'password123' });
    staffToken = staffLogin.body.token;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('POST /api/v1/tape-chart/rooms/:roomId/lock', () => {
    it('should successfully lock a room for viewing', async () => {
      const response = await request(app)
        .post(`/api/v1/tape-chart/rooms/${roomId}/lock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'viewing' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.roomId).toBe(roomId.toString());
      expect(response.body.data.userId).toBe(adminUser._id.toString());
      expect(response.body.data.action).toBe('viewing');
      expect(response.body.data.expiresAt).toBeDefined();
    });

    it('should successfully lock a room for editing', async () => {
      const response = await request(app)
        .post(`/api/v1/tape-chart/rooms/${roomId}/lock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'editing' })
        .expect(201);

      expect(response.body.data.action).toBe('editing');
    });

    it('should fail to lock already locked room by different user', async () => {
      // Admin locks the room first
      await request(app)
        .post(`/api/v1/tape-chart/rooms/${roomId}/lock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'editing' });

      // Staff tries to lock the same room
      const response = await request(app)
        .post(`/api/v1/tape-chart/rooms/${roomId}/lock`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ action: 'editing' })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already locked');
      expect(response.body.lockedBy).toBe(adminUser.name);
    });

    it('should allow same user to upgrade lock from viewing to editing', async () => {
      // First lock for viewing
      await request(app)
        .post(`/api/v1/tape-chart/rooms/${roomId}/lock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'viewing' });

      // Upgrade to editing
      const response = await request(app)
        .post(`/api/v1/tape-chart/rooms/${roomId}/lock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'editing' })
        .expect(200);

      expect(response.body.data.action).toBe('editing');
    });

    it('should auto-expire locks after timeout', async () => {
      // Create lock with 1 second expiry for testing
      await RoomLock.create({
        roomId: roomId,
        userId: adminUser._id,
        action: 'editing',
        expiresAt: new Date(Date.now() + 1000) // 1 second
      });

      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should be able to lock now
      const response = await request(app)
        .post(`/api/v1/tape-chart/rooms/${roomId}/lock`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ action: 'editing' })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should require authentication', async () => {
      await request(app)
        .post(`/api/v1/tape-chart/rooms/${roomId}/lock`)
        .send({ action: 'viewing' })
        .expect(401);
    });

    it('should validate action parameter', async () => {
      const response = await request(app)
        .post(`/api/v1/tape-chart/rooms/${roomId}/lock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'invalid_action' })
        .expect(400);

      expect(response.body.message).toContain('Invalid action');
    });
  });

  describe('DELETE /api/v1/tape-chart/rooms/:roomId/unlock', () => {
    beforeEach(async () => {
      // Create a lock
      await request(app)
        .post(`/api/v1/tape-chart/rooms/${roomId}/lock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'editing' });
    });

    it('should successfully unlock room by lock owner', async () => {
      const response = await request(app)
        .delete(`/api/v1/tape-chart/rooms/${roomId}/unlock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('unlocked');
    });

    it('should fail to unlock room by different user', async () => {
      const response = await request(app)
        .delete(`/api/v1/tape-chart/rooms/${roomId}/unlock`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not authorized');
    });

    it('should allow admin to force unlock any room', async () => {
      // Staff locks the room
      await RoomLock.deleteMany({});
      await request(app)
        .post(`/api/v1/tape-chart/rooms/${roomId}/lock`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ action: 'editing' });

      // Admin force unlocks
      const response = await request(app)
        .delete(`/api/v1/tape-chart/rooms/${roomId}/unlock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ force: true })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/tape-chart/rooms/locks', () => {
    beforeEach(async () => {
      // Create multiple locks
      await request(app)
        .post(`/api/v1/tape-chart/rooms/${roomId}/lock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'editing' });
    });

    it('should return all active locks', async () => {
      const response = await request(app)
        .get('/api/v1/tape-chart/rooms/locks')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].roomId).toBe(roomId.toString());
      expect(response.body.data[0].user.name).toBe('Admin User');
    });

    it('should filter locks by room ID', async () => {
      const response = await request(app)
        .get(`/api/v1/tape-chart/rooms/locks?roomId=${roomId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
    });

    it('should not return expired locks', async () => {
      // Create expired lock
      await RoomLock.create({
        roomId: roomId,
        userId: staffUser._id,
        action: 'viewing',
        expiresAt: new Date(Date.now() - 1000) // Already expired
      });

      const response = await request(app)
        .get('/api/v1/tape-chart/rooms/locks')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Should only return the non-expired lock
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].user.name).toBe('Admin User');
    });
  });

  describe('Lock cleanup and expiration', () => {
    it('should clean up expired locks automatically', async () => {
      // Create expired lock
      await RoomLock.create({
        roomId: roomId,
        userId: adminUser._id,
        action: 'editing',
        expiresAt: new Date(Date.now() - 1000)
      });

      // Trigger cleanup (would normally be done by cron job)
      await RoomLock.deleteMany({ expiresAt: { $lt: new Date() } });

      const locks = await RoomLock.find({});
      expect(locks).toHaveLength(0);
    });

    it('should handle multiple locks on different rooms', async () => {
      // Create another room
      const room2 = await Room.create({
        hotelId: hotelId,
        roomNumber: '102',
        type: 'double',
        baseRate: 3500,
        floor: 1,
        capacity: 2,
        amenities: ['WiFi', 'AC'],
        status: 'vacant'
      });

      // Lock both rooms
      await request(app)
        .post(`/api/v1/tape-chart/rooms/${roomId}/lock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'editing' });

      await request(app)
        .post(`/api/v1/tape-chart/rooms/${room2._id}/lock`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ action: 'viewing' });

      const response = await request(app)
        .get('/api/v1/tape-chart/rooms/locks')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(2);
    });
  });
});