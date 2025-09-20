import request from 'supertest';
import mongoose from 'mongoose';
import app from '../server.js';
import User from '../models/User.js';
import Hotel from '../models/Hotel.js';
import Room from '../models/Room.js';
import Booking from '../models/Booking.js';
import RoomBlock from '../models/RoomBlock.js';
import AuditLog from '../models/AuditLog.js';

describe('Bulk Operations System', () => {
  let adminToken;
  let staffToken;
  let hotelId;
  let adminUser;
  let staffUser;
  let testRooms = [];
  let testBookings = [];

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI_TEST || process.env.MONGO_URI);
  });

  beforeEach(async () => {
    // Clean database
    await User.deleteMany({});
    await Hotel.deleteMany({});
    await Room.deleteMany({});
    await Booking.deleteMany({});
    await RoomBlock.deleteMany({});
    await AuditLog.deleteMany({});

    // Create test hotel
    const hotel = await Hotel.create({
      name: 'Test Hotel',
      address: { city: 'Test City', country: 'Test Country' },
      contact: { phone: '123-456-7890', email: 'test@hotel.com' }
    });
    hotelId = hotel._id;

    // Create users
    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@test.com',
      password: 'password123',
      role: 'admin',
      hotelId: hotelId
    });

    staffUser = await User.create({
      name: 'Staff User',
      email: 'staff@test.com',
      password: 'password123',
      role: 'staff',
      hotelId: hotelId
    });

    // Create test rooms
    const roomsData = [
      { roomNumber: '101', type: 'single', floor: 1, capacity: 1, baseRate: 2500, status: 'vacant', amenities: ['WiFi', 'AC'] },
      { roomNumber: '102', type: 'double', floor: 1, capacity: 2, baseRate: 3500, status: 'vacant', amenities: ['WiFi', 'AC', 'TV'] },
      { roomNumber: '103', type: 'double', floor: 1, capacity: 2, baseRate: 3500, status: 'vacant', amenities: ['WiFi', 'AC', 'TV'] },
      { roomNumber: '201', type: 'deluxe', floor: 2, capacity: 2, baseRate: 4500, status: 'vacant', amenities: ['WiFi', 'AC', 'TV', 'Minibar'] },
      { roomNumber: '202', type: 'deluxe', floor: 2, capacity: 2, baseRate: 4500, status: 'vacant', amenities: ['WiFi', 'AC', 'TV', 'Minibar'] },
      { roomNumber: '301', type: 'suite', floor: 3, capacity: 4, baseRate: 8000, status: 'vacant', amenities: ['WiFi', 'AC', 'TV', 'Minibar', 'Balcony'] }
    ];

    testRooms = await Promise.all(roomsData.map(roomData =>
      Room.create({ ...roomData, hotelId })
    ));

    // Create test bookings
    const bookingsData = [
      {
        bookingNumber: 'BK001',
        guestName: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        checkIn: new Date('2024-06-01'),
        checkOut: new Date('2024-06-03'),
        roomType: 'single',
        totalAmount: 5000,
        status: 'pending'
      },
      {
        bookingNumber: 'BK002',
        guestName: 'Jane Smith',
        email: 'jane@example.com',
        phone: '+1234567891',
        checkIn: new Date('2024-06-05'),
        checkOut: new Date('2024-06-08'),
        roomType: 'deluxe',
        totalAmount: 13500,
        status: 'pending'
      }
    ];

    testBookings = await Promise.all(bookingsData.map(bookingData =>
      Booking.create({ ...bookingData, hotelId })
    ));

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

  describe('POST /api/v1/tape-chart/bulk/room-status', () => {
    it('should update status of multiple rooms', async () => {
      const roomIds = [testRooms[0]._id, testRooms[1]._id, testRooms[2]._id];

      const response = await request(app)
        .post('/api/v1/tape-chart/bulk/room-status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          roomIds,
          status: 'maintenance',
          reason: 'Scheduled maintenance'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.updatedCount).toBe(3);
      expect(response.body.data.successfulUpdates).toHaveLength(3);

      // Verify rooms were updated
      const updatedRooms = await Room.find({ _id: { $in: roomIds } });
      expect(updatedRooms.every(room => room.status === 'maintenance')).toBe(true);

      // Verify audit logs were created
      const auditLogs = await AuditLog.find({ changeType: 'update' });
      expect(auditLogs).toHaveLength(3);
    });

    it('should handle partial failures gracefully', async () => {
      // Create a room that doesn't exist
      const nonExistentId = new mongoose.Types.ObjectId();
      const roomIds = [testRooms[0]._id, nonExistentId, testRooms[1]._id];

      const response = await request(app)
        .post('/api/v1/tape-chart/bulk/room-status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          roomIds,
          status: 'clean'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.updatedCount).toBe(2);
      expect(response.body.data.successfulUpdates).toHaveLength(2);
      expect(response.body.data.failedUpdates).toHaveLength(1);
    });

    it('should reject invalid status values', async () => {
      const roomIds = [testRooms[0]._id];

      await request(app)
        .post('/api/v1/tape-chart/bulk/room-status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          roomIds,
          status: 'invalid_status'
        })
        .expect(400);
    });

    it('should require at least one room ID', async () => {
      await request(app)
        .post('/api/v1/tape-chart/bulk/room-status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          roomIds: [],
          status: 'clean'
        })
        .expect(400);
    });

    it('should enforce maximum bulk operation limit', async () => {
      // Create array with more than allowed limit (assuming 100)
      const roomIds = Array(101).fill().map(() => new mongoose.Types.ObjectId());

      await request(app)
        .post('/api/v1/tape-chart/bulk/room-status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          roomIds,
          status: 'clean'
        })
        .expect(400);
    });
  });

  describe('POST /api/v1/tape-chart/bulk/room-assignment', () => {
    it('should assign multiple rooms to bookings', async () => {
      const assignments = [
        { roomId: testRooms[0]._id, bookingId: testBookings[0]._id },
        { roomId: testRooms[1]._id, bookingId: testBookings[1]._id }
      ];

      const response = await request(app)
        .post('/api/v1/tape-chart/bulk/room-assignment')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          assignments,
          confirmOverrides: false
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.assignedCount).toBe(2);
      expect(response.body.data.successfulAssignments).toHaveLength(2);

      // Verify bookings were updated
      const updatedBookings = await Booking.find({
        _id: { $in: [testBookings[0]._id, testBookings[1]._id] }
      });
      expect(updatedBookings[0].roomId).toBeDefined();
      expect(updatedBookings[1].roomId).toBeDefined();
    });

    it('should detect and report conflicts', async () => {
      // First assign a room
      await Room.findByIdAndUpdate(testRooms[0]._id, { status: 'occupied' });

      const assignments = [
        { roomId: testRooms[0]._id, bookingId: testBookings[0]._id }
      ];

      const response = await request(app)
        .post('/api/v1/tape-chart/bulk/room-assignment')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          assignments,
          confirmOverrides: false
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.assignedCount).toBe(0);
      expect(response.body.data.conflicts).toHaveLength(1);
      expect(response.body.data.conflicts[0].reason).toContain('occupied');
    });

    it('should allow overriding conflicts when confirmed', async () => {
      // Set room as occupied
      await Room.findByIdAndUpdate(testRooms[0]._id, { status: 'occupied' });

      const assignments = [
        { roomId: testRooms[0]._id, bookingId: testBookings[0]._id }
      ];

      const response = await request(app)
        .post('/api/v1/tape-chart/bulk/room-assignment')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          assignments,
          confirmOverrides: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.assignedCount).toBe(1);
    });
  });

  describe('POST /api/v1/tape-chart/bulk/room-block', () => {
    it('should create block for multiple rooms', async () => {
      const roomIds = [testRooms[0]._id, testRooms[1]._id];

      const response = await request(app)
        .post('/api/v1/tape-chart/bulk/room-block')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          roomIds,
          blockData: {
            blockName: 'Maintenance Block',
            startDate: '2024-06-01',
            endDate: '2024-06-03',
            reason: 'Scheduled maintenance'
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.blockedCount).toBe(2);

      // Verify room block was created
      const roomBlocks = await RoomBlock.find({ blockName: 'Maintenance Block' });
      expect(roomBlocks).toHaveLength(1);
    });

    it('should validate block date range', async () => {
      const roomIds = [testRooms[0]._id];

      await request(app)
        .post('/api/v1/tape-chart/bulk/room-block')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          roomIds,
          blockData: {
            blockName: 'Invalid Block',
            startDate: '2024-06-03',
            endDate: '2024-06-01', // End before start
            reason: 'Test'
          }
        })
        .expect(400);
    });
  });

  describe('POST /api/v1/tape-chart/bulk/room-release', () => {
    beforeEach(async () => {
      // Create a room block first
      await RoomBlock.create({
        hotelId,
        blockName: 'Test Block',
        groupName: 'Test Group',
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-03'),
        totalRooms: 2,
        contactPerson: { name: 'Test', email: 'test@test.com' },
        roomIds: [testRooms[0]._id, testRooms[1]._id]
      });

      // Mark rooms as blocked
      await Room.updateMany(
        { _id: { $in: [testRooms[0]._id, testRooms[1]._id] } },
        { status: 'blocked' }
      );
    });

    it('should release multiple blocked rooms', async () => {
      const roomIds = [testRooms[0]._id, testRooms[1]._id];

      const response = await request(app)
        .post('/api/v1/tape-chart/bulk/room-release')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          roomIds,
          releaseReason: 'Block cancelled'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.releasedCount).toBe(2);

      // Verify rooms are no longer blocked
      const rooms = await Room.find({ _id: { $in: roomIds } });
      expect(rooms.every(room => room.status !== 'blocked')).toBe(true);
    });
  });

  describe('GET /api/v1/tape-chart/bulk/progress/:batchId', () => {
    it('should return progress of bulk operation', async () => {
      // Start a bulk operation to get a batch ID
      const roomIds = [testRooms[0]._id, testRooms[1]._id];

      const bulkResponse = await request(app)
        .post('/api/v1/tape-chart/bulk/room-status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          roomIds,
          status: 'clean',
          async: true // Request async processing
        });

      const batchId = bulkResponse.body.data.batchId;

      // Check progress
      const progressResponse = await request(app)
        .get(`/api/v1/tape-chart/bulk/progress/${batchId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(progressResponse.body.success).toBe(true);
      expect(progressResponse.body.data.batchId).toBe(batchId);
      expect(progressResponse.body.data.status).toBeDefined();
      expect(progressResponse.body.data.progress).toBeDefined();
    });
  });

  describe('Staff Access Control', () => {
    it('should allow staff to perform bulk status updates', async () => {
      const roomIds = [testRooms[0]._id];

      await request(app)
        .post('/api/v1/tape-chart/bulk/room-status')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          roomIds,
          status: 'clean'
        })
        .expect(200);
    });

    it('should restrict bulk blocking to admin only', async () => {
      const roomIds = [testRooms[0]._id];

      await request(app)
        .post('/api/v1/tape-chart/bulk/room-block')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          roomIds,
          blockData: {
            blockName: 'Test Block',
            startDate: '2024-06-01',
            endDate: '2024-06-03'
          }
        })
        .expect(403);
    });

    it('should require authentication for all bulk operations', async () => {
      await request(app)
        .post('/api/v1/tape-chart/bulk/room-status')
        .send({
          roomIds: [testRooms[0]._id],
          status: 'clean'
        })
        .expect(401);
    });
  });

  describe('Audit Trail Integration', () => {
    it('should log all bulk operations in audit trail', async () => {
      const roomIds = [testRooms[0]._id, testRooms[1]._id];

      await request(app)
        .post('/api/v1/tape-chart/bulk/room-status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          roomIds,
          status: 'maintenance'
        });

      // Check audit logs
      const auditLogs = await AuditLog.find({
        changeType: 'update',
        tableName: 'Room',
        userId: adminUser._id
      });

      expect(auditLogs).toHaveLength(2);
      expect(auditLogs.every(log => log.metadata?.tags?.includes('bulk_operation'))).toBe(true);
    });
  });
});