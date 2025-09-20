import request from 'supertest';
import app from '../server.js';
import User from '../models/User.js';
import Booking from '../models/Booking.js';
import CorporateCompany from '../models/CorporateCompany.js';
import jwt from 'jsonwebtoken';

describe('GST Management API Tests', () => {
  let adminToken, adminUser, testCompany, testBooking;

  beforeAll(async () => {
    // Create admin user
    adminUser = await User.create({
      name: 'Test Admin',
      email: 'admin@test.com',
      password: 'admin123',
      role: 'admin',
      hotelId: '507f1f77bcf86cd799439011'
    });

    // Generate JWT token
    adminToken = jwt.sign(
      { id: adminUser._id, role: adminUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Create test corporate company
    testCompany = await CorporateCompany.create({
      name: 'Test Corp',
      gstNumber: '27AAAAA0000A1Z5',
      contactPerson: 'John Doe',
      email: 'john@testcorp.com',
      phone: '9876543210',
      hotelId: adminUser.hotelId
    });

    // Create test corporate booking
    testBooking = await Booking.create({
      bookingNumber: 'BK001',
      userId: adminUser._id,
      hotelId: adminUser.hotelId,
      corporateBooking: {
        corporateCompanyId: testCompany._id
      },
      totalAmount: 10000,
      status: 'confirmed',
      checkIn: new Date(),
      checkOut: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
  });

  afterAll(async () => {
    await User.deleteOne({ _id: adminUser._id });
    await CorporateCompany.deleteOne({ _id: testCompany._id });
    await Booking.deleteOne({ _id: testBooking._id });
  });

  describe('GST Calculator', () => {
    test('should calculate GST for forward calculation', async () => {
      const response = await request(app)
        .post('/api/v1/corporate/gst/calculate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 10000,
          gstRate: 18,
          placeOfSupply: 'Maharashtra',
          companyState: 'Maharashtra'
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.gstCalculation).toHaveProperty('baseAmount', 10000);
      expect(response.body.data.gstCalculation).toHaveProperty('cgstAmount', 900);
      expect(response.body.data.gstCalculation).toHaveProperty('sgstAmount', 900);
      expect(response.body.data.gstCalculation).toHaveProperty('totalAmount', 11800);
      expect(response.body.data.gstCalculation.isInterstate).toBe(false);
    });

    test('should calculate GST for interstate transaction (IGST)', async () => {
      const response = await request(app)
        .post('/api/v1/corporate/gst/calculate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 10000,
          gstRate: 18,
          placeOfSupply: 'Karnataka',
          companyState: 'Maharashtra'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.gstCalculation).toHaveProperty('igstAmount', 1800);
      expect(response.body.data.gstCalculation).toHaveProperty('cgstAmount', 0);
      expect(response.body.data.gstCalculation).toHaveProperty('sgstAmount', 0);
      expect(response.body.data.gstCalculation.isInterstate).toBe(true);
    });

    test('should calculate reverse GST', async () => {
      const response = await request(app)
        .post('/api/v1/corporate/gst/reverse-calculate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          totalAmount: 11800,
          gstRate: 18
        });

      expect(response.status).toBe(200);
      expect(response.body.data.reverseCalculation).toHaveProperty('baseAmount', 10000);
      expect(response.body.data.reverseCalculation).toHaveProperty('totalGstAmount', 1800);
    });

    test('should return error for invalid amount', async () => {
      const response = await request(app)
        .post('/api/v1/corporate/gst/calculate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: -100,
          gstRate: 18
        });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
    });
  });

  describe('GST Validator', () => {
    test('should validate correct GST number', async () => {
      const response = await request(app)
        .post('/api/v1/corporate/gst/validate-number')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          gstNumber: '27AAAAA0000A1Z5'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.isValid).toBe(true);
      expect(response.body.data.stateCode).toBe('27');
      expect(response.body.data.stateName).toBe('Maharashtra');
    });

    test('should validate incorrect GST number', async () => {
      const response = await request(app)
        .post('/api/v1/corporate/gst/validate-number')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          gstNumber: 'INVALID123'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.isValid).toBe(false);
    });

    test('should return error for missing GST number', async () => {
      const response = await request(app)
        .post('/api/v1/corporate/gst/validate-number')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('Booking GST Calculator', () => {
    test('should calculate GST for booking items', async () => {
      const response = await request(app)
        .post('/api/v1/corporate/gst/calculate-booking')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          items: [
            {
              description: 'Room Charges',
              quantity: 2,
              unitPrice: 5000,
              amount: 10000
            },
            {
              description: 'Food & Beverage',
              quantity: 1,
              unitPrice: 2000,
              amount: 2000
            }
          ],
          gstDetails: {
            gstRate: 18,
            placeOfSupply: 'Maharashtra',
            companyState: 'Maharashtra',
            isGstApplicable: true
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.data.gstCalculation).toHaveProperty('baseAmount', 12000);
      expect(response.body.data.gstCalculation).toHaveProperty('totalAmount', 14160);
    });

    test('should return error for invalid booking items', async () => {
      const response = await request(app)
        .post('/api/v1/corporate/gst/calculate-booking')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          items: [],
          gstDetails: {
            gstRate: 18
          }
        });

      expect(response.status).toBe(400);
    });
  });

  describe('State Codes', () => {
    test('should fetch all state codes', async () => {
      const response = await request(app)
        .get('/api/v1/corporate/gst/state-codes')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.stateCodes).toBeInstanceOf(Array);
      expect(response.body.data.stateCodes.length).toBeGreaterThan(30);

      // Check if Maharashtra is present
      const maharashtra = response.body.data.stateCodes.find(state => state.code === '27');
      expect(maharashtra).toBeDefined();
      expect(maharashtra.name).toBe('Maharashtra');
    });
  });

  describe('Invoice Generation', () => {
    test('should generate invoice data for corporate booking', async () => {
      const response = await request(app)
        .get(`/api/v1/corporate/gst/generate-invoice-data/${testBooking._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('bookingId');
      expect(response.body.data).toHaveProperty('bookingNumber', 'BK001');
      expect(response.body.data.company).toHaveProperty('name', 'Test Corp');
    });

    test('should return error for non-existent booking', async () => {
      const response = await request(app)
        .get('/api/v1/corporate/gst/generate-invoice-data/507f1f77bcf86cd799439999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });

    test('should fetch corporate bookings with type filter', async () => {
      const response = await request(app)
        .get('/api/v1/bookings?type=corporate&limit=100')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);

      // All returned bookings should have corporate company
      response.body.data.forEach(booking => {
        expect(booking.corporateBooking?.corporateCompanyId).toBeDefined();
      });
    });
  });

  describe('Booking GST Updates', () => {
    test('should update booking GST details', async () => {
      const response = await request(app)
        .patch(`/api/v1/corporate/gst/update-booking-gst/${testBooking._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          gstRate: 12,
          isGstApplicable: true
        });

      expect(response.status).toBe(200);
      expect(response.body.data.gstDetails).toHaveProperty('gstRate', 12);
      expect(response.body.data.gstDetails.isGstApplicable).toBe(true);
    });

    test('should return error for invalid GST number', async () => {
      const response = await request(app)
        .patch(`/api/v1/corporate/gst/update-booking-gst/${testBooking._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          gstNumber: 'INVALID123'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Authorization Tests', () => {
    test('should return 401 for missing token', async () => {
      const response = await request(app)
        .post('/api/v1/corporate/gst/calculate')
        .send({
          amount: 10000,
          gstRate: 18
        });

      expect(response.status).toBe(401);
    });

    test('should return 401 for invalid token', async () => {
      const response = await request(app)
        .post('/api/v1/corporate/gst/calculate')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          amount: 10000,
          gstRate: 18
        });

      expect(response.status).toBe(401);
    });
  });
});