import request from 'supertest';
import mongoose from 'mongoose';
import app from '../server.js';
import User from '../models/User.js';
import Hotel from '../models/Hotel.js';
import Room from '../models/Room.js';
import Booking from '../models/Booking.js';
import RoomBlock from '../models/RoomBlock.js';

describe('Advanced Search and Filtering', () => {
  let adminToken;
  let staffToken;
  let hotelId;
  let adminUser;
  let staffUser;
  let testRooms = [];
  let testBookings = [];
  let testBlocks = [];

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
      { roomNumber: '102', type: 'double', floor: 1, capacity: 2, baseRate: 3500, status: 'occupied', amenities: ['WiFi', 'AC', 'TV'] },
      { roomNumber: '201', type: 'deluxe', floor: 2, capacity: 2, baseRate: 4500, status: 'maintenance', amenities: ['WiFi', 'AC', 'TV', 'Minibar'] },
      { roomNumber: '301', type: 'suite', floor: 3, capacity: 4, baseRate: 8000, status: 'blocked', amenities: ['WiFi', 'AC', 'TV', 'Minibar', 'Balcony'] },
      { roomNumber: '302', type: 'suite', floor: 3, capacity: 4, baseRate: 8500, status: 'vacant', amenities: ['WiFi', 'AC', 'TV', 'Minibar', 'Jacuzzi'] }
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
        roomId: testRooms[0]._id,
        totalAmount: 5000,
        status: 'confirmed'
      },
      {
        bookingNumber: 'BK002',
        guestName: 'Jane Smith',
        email: 'jane@example.com',
        phone: '+1234567891',
        checkIn: new Date('2024-06-05'),
        checkOut: new Date('2024-06-08'),
        roomType: 'deluxe',
        roomId: testRooms[2]._id,
        totalAmount: 13500,
        status: 'confirmed'
      },
      {
        bookingNumber: 'BK003',
        guestName: 'Bob Wilson',
        email: 'bob@example.com',
        phone: '+1234567892',
        checkIn: new Date('2024-06-10'),
        checkOut: new Date('2024-06-15'),
        roomType: 'suite',
        totalAmount: 40000,
        status: 'pending'
      }
    ];

    testBookings = await Promise.all(bookingsData.map(bookingData =>
      Booking.create({ ...bookingData, hotelId })
    ));

    // Create test room blocks
    const blocksData = [
      {
        blockName: 'Wedding Block A',
        groupName: 'Smith Wedding',
        startDate: new Date('2024-07-01'),
        endDate: new Date('2024-07-03'),
        totalRooms: 5,
        contactPerson: { name: 'John Smith', email: 'john@smith.com' }
      },
      {
        blockName: 'Conference Block',
        groupName: 'Tech Conference',
        startDate: new Date('2024-08-01'),
        endDate: new Date('2024-08-05'),
        totalRooms: 10,
        contactPerson: { name: 'Tech Admin', email: 'admin@techconf.com' }
      }
    ];

    testBlocks = await Promise.all(blocksData.map(blockData =>
      RoomBlock.create({ ...blockData, hotelId })
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

  describe('POST /api/v1/tape-chart/search', () => {
    it('should search rooms by text query', async () => {
      const response = await request(app)
        .post('/api/v1/tape-chart/search')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          query: 'suite',
          entityType: 'room'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.rooms).toHaveLength(2);
      expect(response.body.data.rooms.every(room => room.type === 'suite')).toBe(true);
    });

    it('should search bookings by guest name', async () => {
      const response = await request(app)
        .post('/api/v1/tape-chart/search')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          query: 'John Doe',
          entityType: 'booking'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.bookings).toHaveLength(1);
      expect(response.body.data.bookings[0].guestName).toBe('John Doe');
    });

    it('should search blocks by group name', async () => {
      const response = await request(app)
        .post('/api/v1/tape-chart/search')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          query: 'wedding',
          entityType: 'block'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.blocks).toHaveLength(1);
      expect(response.body.data.blocks[0].groupName).toContain('Wedding');
    });

    it('should search across all entity types', async () => {
      const response = await request(app)
        .post('/api/v1/tape-chart/search')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          query: '101'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Should find room 101 and potentially bookings with room 101
      expect(response.body.data.rooms.some(room => room.roomNumber === '101')).toBe(true);
    });
  });

  describe('POST /api/v1/tape-chart/filter', () => {
    it('should filter rooms by status', async () => {
      const response = await request(app)
        .post('/api/v1/tape-chart/filter')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          entityType: 'room',
          filters: {
            status: ['vacant', 'occupied']
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.rooms).toHaveLength(3);
      expect(response.body.data.rooms.every(room =>
        ['vacant', 'occupied'].includes(room.status)
      )).toBe(true);
    });

    it('should filter rooms by floor', async () => {
      const response = await request(app)
        .post('/api/v1/tape-chart/filter')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          entityType: 'room',
          filters: {
            floors: [1, 2]
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.rooms).toHaveLength(3);
      expect(response.body.data.rooms.every(room => [1, 2].includes(room.floor))).toBe(true);
    });

    it('should filter rooms by price range', async () => {
      const response = await request(app)
        .post('/api/v1/tape-chart/filter')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          entityType: 'room',
          filters: {
            priceRange: {
              min: 3000,
              max: 5000
            }
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.rooms.every(room =>
        room.baseRate >= 3000 && room.baseRate <= 5000
      )).toBe(true);
    });

    it('should filter bookings by date range', async () => {
      const response = await request(app)
        .post('/api/v1/tape-chart/filter')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          entityType: 'booking',
          filters: {
            dateRange: {
              start: '2024-06-01',
              end: '2024-06-10'
            }
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.bookings).toHaveLength(2);
    });

    it('should filter bookings by status', async () => {
      const response = await request(app)
        .post('/api/v1/tape-chart/filter')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          entityType: 'booking',
          filters: {
            status: ['confirmed']
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.bookings).toHaveLength(2);
      expect(response.body.data.bookings.every(booking => booking.status === 'confirmed')).toBe(true);
    });

    it('should apply multiple filters', async () => {
      const response = await request(app)
        .post('/api/v1/tape-chart/filter')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          entityType: 'room',
          filters: {
            status: ['vacant'],
            floors: [1, 3],
            roomTypes: ['single', 'suite']
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.rooms.every(room =>
        room.status === 'vacant' &&
        [1, 3].includes(room.floor) &&
        ['single', 'suite'].includes(room.type)
      )).toBe(true);
    });
  });

  describe('GET /api/v1/tape-chart/search/suggestions', () => {
    it('should return search suggestions for rooms', async () => {
      const response = await request(app)
        .get('/api/v1/tape-chart/search/suggestions?query=su&type=room')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.suggestions).toBeDefined();
      expect(response.body.data.suggestions.some(s => s.includes('suite'))).toBe(true);
    });

    it('should return guest name suggestions', async () => {
      const response = await request(app)
        .get('/api/v1/tape-chart/search/suggestions?query=john&type=guest')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.suggestions.some(s => s.toLowerCase().includes('john'))).toBe(true);
    });
  });

  describe('GET /api/v1/tape-chart/search/filters', () => {
    it('should return available filter options', async () => {
      const response = await request(app)
        .get('/api/v1/tape-chart/search/filters')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.roomTypes).toBeDefined();
      expect(response.body.data.floors).toBeDefined();
      expect(response.body.data.amenities).toBeDefined();
      expect(response.body.data.statuses).toBeDefined();
    });

    it('should include dynamic values from database', async () => {
      const response = await request(app)
        .get('/api/v1/tape-chart/search/filters')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.roomTypes).toContain('suite');
      expect(response.body.data.floors).toContain(3);
      expect(response.body.data.amenities).toContain('WiFi');
    });
  });

  describe('Search Performance and Pagination', () => {
    it('should support pagination', async () => {
      const response = await request(app)
        .post('/api/v1/tape-chart/search')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          entityType: 'room',
          pagination: {
            page: 1,
            limit: 2
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.rooms).toHaveLength(2);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(2);
      expect(response.body.pagination.total).toBe(5);
    });

    it('should support sorting', async () => {
      const response = await request(app)
        .post('/api/v1/tape-chart/search')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          entityType: 'room',
          sort: {
            field: 'baseRate',
            order: 'desc'
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      const rates = response.body.data.rooms.map(room => room.baseRate);
      expect(rates).toEqual([...rates].sort((a, b) => b - a));
    });
  });

  describe('Staff Access Control', () => {
    it('should allow staff to search', async () => {
      const response = await request(app)
        .post('/api/v1/tape-chart/search')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          query: 'single',
          entityType: 'room'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v1/tape-chart/search')
        .send({
          query: 'single',
          entityType: 'room'
        })
        .expect(401);
    });
  });
});