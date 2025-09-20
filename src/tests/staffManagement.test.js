import request from 'supertest';
import app from '../server.js';
import User from '../models/User.js';
import Hotel from '../models/Hotel.js';
import jwt from 'jsonwebtoken';
import { connectDB } from '../config/database.js';

describe('Staff Management API Tests', () => {
  let adminToken, adminUser, testHotel, staffUser, guestUser;

  beforeAll(async () => {
    // Create test hotel
    testHotel = await Hotel.create({
      name: 'Test Hotel',
      address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'Test State',
        zipCode: '12345',
        country: 'Test Country'
      },
      contact: {
        email: 'hotel@test.com',
        phone: '+1234567890'
      },
      isActive: true
    });

    // Create admin user
    adminUser = await User.create({
      name: 'Test Admin',
      email: 'admin@stafftest.com',
      password: 'admin123',
      role: 'admin',
      hotelId: testHotel._id,
      isActive: true
    });

    // Create staff user
    staffUser = await User.create({
      name: 'Test Staff',
      email: 'staff@stafftest.com',
      password: 'staff123',
      role: 'staff',
      hotelId: testHotel._id,
      isActive: true,
      phone: '+1987654321'
    });

    // Create guest user (should not appear in staff management)
    guestUser = await User.create({
      name: 'Test Guest',
      email: 'guest@stafftest.com',
      password: 'guest123',
      role: 'guest',
      isActive: true
    });

    // Generate JWT token for admin
    adminToken = jwt.sign(
      { id: adminUser._id, role: adminUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
  });

  afterAll(async () => {
    await User.deleteMany({
      email: { $in: ['admin@stafftest.com', 'staff@stafftest.com', 'guest@stafftest.com'] }
    });
    await Hotel.deleteOne({ _id: testHotel._id });
  });

  describe('GET /admin/users - Staff Management Context', () => {
    test('should only return staff and admin users when no role specified', async () => {
      const response = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.users).toBeInstanceOf(Array);

      // Should not include guest users
      const userRoles = response.body.data.users.map(user => user.role);
      expect(userRoles).not.toContain('guest');

      // Should only contain staff and admin users
      userRoles.forEach(role => {
        expect(['staff', 'admin']).toContain(role);
      });

      // Should find our test staff and admin users
      const emails = response.body.data.users.map(user => user.email);
      expect(emails).toContain('admin@stafftest.com');
      expect(emails).toContain('staff@stafftest.com');
      expect(emails).not.toContain('guest@stafftest.com');
    });

    test('should filter by staff role correctly', async () => {
      const response = await request(app)
        .get('/api/v1/admin/users?role=staff')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      response.body.data.users.forEach(user => {
        expect(user.role).toBe('staff');
        expect(user.hotelId._id || user.hotelId).toBe(testHotel._id.toString());
      });
    });

    test('should filter by admin role correctly', async () => {
      const response = await request(app)
        .get('/api/v1/admin/users?role=admin')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      response.body.data.users.forEach(user => {
        expect(user.role).toBe('admin');
        expect(user.hotelId._id || user.hotelId).toBe(testHotel._id.toString());
      });
    });

    test('should search by name correctly', async () => {
      const response = await request(app)
        .get('/api/v1/admin/users?search=Test Staff')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const foundStaff = response.body.data.users.find(user => user.name === 'Test Staff');
      expect(foundStaff).toBeDefined();
      expect(foundStaff.role).toBe('staff');
    });

    test('should search by email correctly', async () => {
      const response = await request(app)
        .get('/api/v1/admin/users?search=staff@stafftest.com')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const foundStaff = response.body.data.users.find(user => user.email === 'staff@stafftest.com');
      expect(foundStaff).toBeDefined();
      expect(foundStaff.role).toBe('staff');
    });

    test('should filter by active status correctly', async () => {
      const response = await request(app)
        .get('/api/v1/admin/users?isActive=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      response.body.data.users.forEach(user => {
        expect(user.isActive).toBe(true);
      });
    });

    test('should handle pagination correctly', async () => {
      const response = await request(app)
        .get('/api/v1/admin/users?page=1&limit=1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(1);
    });
  });

  describe('POST /admin/users - Create Staff', () => {
    test('should create new staff member successfully', async () => {
      const newStaffData = {
        name: 'New Staff Member',
        email: 'newstaff@stafftest.com',
        password: 'password123',
        role: 'staff',
        phone: '+1555123456'
      };

      const response = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newStaffData);

      expect(response.status).toBe(201);
      expect(response.body.data.user.name).toBe(newStaffData.name);
      expect(response.body.data.user.email).toBe(newStaffData.email);
      expect(response.body.data.user.role).toBe('staff');
      expect(response.body.data.user.hotelId).toBe(testHotel._id.toString());

      // Clean up
      await User.deleteOne({ email: newStaffData.email });
    });

    test('should create new admin successfully', async () => {
      const newAdminData = {
        name: 'New Admin',
        email: 'newadmin@stafftest.com',
        password: 'password123',
        role: 'admin',
        phone: '+1555654321'
      };

      const response = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newAdminData);

      expect(response.status).toBe(201);
      expect(response.body.data.user.role).toBe('admin');
      expect(response.body.data.user.hotelId).toBe(testHotel._id.toString());

      // Clean up
      await User.deleteOne({ email: newAdminData.email });
    });

    test('should reject duplicate email', async () => {
      const duplicateData = {
        name: 'Duplicate User',
        email: 'staff@stafftest.com', // Already exists
        password: 'password123',
        role: 'staff'
      };

      const response = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(duplicateData);

      expect(response.status).toBe(409);
      expect(response.body.message).toContain('already exists');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/admin/users')
        .send({
          name: 'Test',
          email: 'test@test.com',
          password: 'password123',
          role: 'staff'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /admin/users/:id - Update Staff', () => {
    test('should update staff member successfully', async () => {
      const updates = {
        name: 'Updated Staff Name',
        role: 'admin'
      };

      const response = await request(app)
        .patch(`/api/v1/admin/users/${staffUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.data.user.name).toBe(updates.name);
      expect(response.body.data.user.role).toBe(updates.role);
    });

    test('should update staff status successfully', async () => {
      const response = await request(app)
        .patch(`/api/v1/admin/users/${staffUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(response.status).toBe(200);
      expect(response.body.data.user.isActive).toBe(false);

      // Restore active status
      await User.findByIdAndUpdate(staffUser._id, { isActive: true });
    });

    test('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .patch('/api/v1/admin/users/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /admin/users/:id - Delete Staff', () => {
    test('should delete staff member successfully', async () => {
      // Create a temporary staff user for deletion
      const tempStaff = await User.create({
        name: 'Temp Staff',
        email: 'tempstaff@stafftest.com',
        password: 'password123',
        role: 'staff',
        hotelId: testHotel._id
      });

      const response = await request(app)
        .delete(`/api/v1/admin/users/${tempStaff._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      // Verify deletion
      const deletedUser = await User.findById(tempStaff._id);
      expect(deletedUser).toBeNull();
    });

    test('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .delete('/api/v1/admin/users/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Authorization and Security', () => {
    test('should require admin role', async () => {
      // Create staff token
      const staffToken = jwt.sign(
        { id: staffUser._id, role: 'staff' },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      const response = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(response.status).toBe(403);
    });

    test('should require valid token', async () => {
      const response = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });

  describe('Data Validation', () => {
    test('should validate required fields for staff creation', async () => {
      const response = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test User'
          // Missing email, password
        });

      expect(response.status).toBe(500); // Validation error
    });

    test('should validate email format', async () => {
      const response = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test User',
          email: 'invalid-email',
          password: 'password123',
          role: 'staff'
        });

      expect(response.status).toBe(500); // Validation error from Mongoose
    });
  });
});