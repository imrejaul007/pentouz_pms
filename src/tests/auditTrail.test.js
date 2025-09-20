import request from 'supertest';
import mongoose from 'mongoose';
import app from '../server.js';
import User from '../models/User.js';
import Hotel from '../models/Hotel.js';
import Room from '../models/Room.js';
import AuditLog from '../models/AuditLog.js';

describe('Audit Trail System', () => {
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
    await AuditLog.deleteMany({});

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

  describe('Audit Log Creation', () => {
    it('should create audit log when room status is updated', async () => {
      await request(app)
        .put(`/api/v1/admin/rooms/${roomId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'maintenance' })
        .expect(200);

      const auditLogs = await AuditLog.find({ entityId: roomId.toString() });
      expect(auditLogs).toHaveLength(1);

      const log = auditLogs[0];
      expect(log.action).toBe('room_status_update');
      expect(log.entityType).toBe('room');
      expect(log.userId.toString()).toBe(adminUser._id.toString());
      expect(log.changes.before.status).toBe('vacant');
      expect(log.changes.after.status).toBe('maintenance');
    });

    it('should create audit log when room is assigned', async () => {
      // Create a booking first
      const booking = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          guestName: 'John Doe',
          email: 'john@example.com',
          phone: '+1234567890',
          checkIn: new Date(Date.now() + 24 * 60 * 60 * 1000),
          checkOut: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          roomType: 'single',
          guestCount: 1
        });

      const bookingId = booking.body.data._id;

      await request(app)
        .post('/api/v1/tape-chart/reservations/assign-room')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reservationId: bookingId,
          roomId: roomId
        })
        .expect(200);

      const auditLogs = await AuditLog.find({ action: 'room_assignment' });
      expect(auditLogs).toHaveLength(1);

      const log = auditLogs[0];
      expect(log.entityType).toBe('booking');
      expect(log.userId.toString()).toBe(adminUser._id.toString());
      expect(log.changes.after.assignedRoom).toBe(roomId.toString());
    });

    it('should create audit log when user logs in', async () => {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'staff@test.com', password: 'password123' })
        .expect(200);

      const auditLogs = await AuditLog.find({
        action: 'user_login',
        userId: staffUser._id
      });
      expect(auditLogs).toHaveLength(1);

      const log = auditLogs[0];
      expect(log.entityType).toBe('user');
      expect(log.entityId).toBe(staffUser._id.toString());
    });

    it('should include metadata in audit logs', async () => {
      await request(app)
        .put(`/api/v1/admin/rooms/${roomId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('User-Agent', 'Test Browser')
        .send({ status: 'clean' });

      const auditLog = await AuditLog.findOne({ entityId: roomId.toString() });
      expect(auditLog.metadata).toBeDefined();
      expect(auditLog.metadata.userAgent).toBe('Test Browser');
      expect(auditLog.metadata.ipAddress).toBeDefined();
    });
  });

  describe('GET /api/v1/audit-trail', () => {
    beforeEach(async () => {
      // Create some audit logs
      await AuditLog.create([
        {
          action: 'room_status_update',
          entityType: 'room',
          entityId: roomId,
          userId: adminUser._id,
          changes: { before: { status: 'vacant' }, after: { status: 'maintenance' } },
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
        },
        {
          action: 'user_login',
          entityType: 'user',
          entityId: staffUser._id,
          userId: staffUser._id,
          changes: {},
          timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000) // 1 hour ago
        },
        {
          action: 'room_assignment',
          entityType: 'booking',
          entityId: 'booking123',
          userId: adminUser._id,
          changes: { before: {}, after: { assignedRoom: roomId } },
          timestamp: new Date() // now
        }
      ]);
    });

    it('should return audit logs for admin users', async () => {
      const response = await request(app)
        .get('/api/v1/audit-trail')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.data[0].action).toBe('room_assignment'); // Most recent first
    });

    it('should restrict audit log access for non-admin users', async () => {
      await request(app)
        .get('/api/v1/audit-trail')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
    });

    it('should filter audit logs by action', async () => {
      const response = await request(app)
        .get('/api/v1/audit-trail?action=room_status_update')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].action).toBe('room_status_update');
    });

    it('should filter audit logs by entity type', async () => {
      const response = await request(app)
        .get('/api/v1/audit-trail?entityType=room')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].entityType).toBe('room');
    });

    it('should filter audit logs by user', async () => {
      const response = await request(app)
        .get(`/api/v1/audit-trail?userId=${staffUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].userId._id).toBe(staffUser._id.toString());
    });

    it('should filter audit logs by date range', async () => {
      const startDate = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
      const endDate = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago

      const response = await request(app)
        .get(`/api/v1/audit-trail?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(2); // Should exclude the most recent one
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/audit-trail?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(2);
      expect(response.body.pagination.total).toBe(3);
    });
  });

  describe('GET /api/v1/audit-trail/:id', () => {
    let auditLogId;

    beforeEach(async () => {
      const auditLog = await AuditLog.create({
        action: 'room_status_update',
        entityType: 'room',
        entityId: roomId,
        userId: adminUser._id,
        changes: { before: { status: 'vacant' }, after: { status: 'maintenance' } },
        metadata: { ipAddress: '127.0.0.1', userAgent: 'Test' }
      });
      auditLogId = auditLog._id;
    });

    it('should return specific audit log details', async () => {
      const response = await request(app)
        .get(`/api/v1/audit-trail/${auditLogId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(auditLogId.toString());
      expect(response.body.data.action).toBe('room_status_update');
      expect(response.body.data.metadata).toBeDefined();
    });

    it('should restrict access to non-admin users', async () => {
      await request(app)
        .get(`/api/v1/audit-trail/${auditLogId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent audit log', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      await request(app)
        .get(`/api/v1/audit-trail/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('Audit Log Cleanup', () => {
    it('should clean up old audit logs', async () => {
      // Create old audit logs (older than retention period)
      const oldDate = new Date(Date.now() - 366 * 24 * 60 * 60 * 1000); // 366 days ago

      await AuditLog.create([
        {
          action: 'old_action',
          entityType: 'room',
          entityId: roomId,
          userId: adminUser._id,
          changes: {},
          timestamp: oldDate
        },
        {
          action: 'recent_action',
          entityType: 'room',
          entityId: roomId,
          userId: adminUser._id,
          changes: {},
          timestamp: new Date() // Recent
        }
      ]);

      await request(app)
        .delete('/api/v1/audit-trail/cleanup')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const remainingLogs = await AuditLog.find({});
      expect(remainingLogs).toHaveLength(1);
      expect(remainingLogs[0].action).toBe('recent_action');
    });

    it('should restrict cleanup to admin users only', async () => {
      await request(app)
        .delete('/api/v1/audit-trail/cleanup')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
    });
  });
});