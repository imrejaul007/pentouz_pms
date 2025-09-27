import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import RoomAvailability from '../../src/models/RoomAvailability.js';
import StopSellRule from '../../src/models/StopSellRule.js';
import inventoryAlertService from '../../src/services/inventoryAlertService.js';

let mongoServer;

describe('Reservation Engine Integration Tests', () => {
  beforeAll(async () => {
    // Start in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections before each test
    await mongoose.connection.db.dropDatabase();
  });

  describe('Transaction Locking Tests', () => {
    test('should prevent overbooking with concurrent requests', async () => {
      const hotelId = new mongoose.Types.ObjectId();
      const roomTypeId = new mongoose.Types.ObjectId();
      const date = new Date('2024-01-15');
      
      // Create inventory with 1 room available
      const inventory = new RoomAvailability({
        hotelId,
        roomTypeId,
        date,
        totalRooms: 1,
        availableRooms: 1,
        soldRooms: 0,
        blockedRooms: 0
      });
      await inventory.save();

      // Simulate concurrent booking attempts
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(
          RoomAvailability.bookRoomsWithLock(
            hotelId,
            roomTypeId,
            date,
            new Date('2024-01-16'),
            1,
            new mongoose.Types.ObjectId(),
            'test'
          )
        );
      }

      const results = await Promise.allSettled(promises);
      
      // Only one should succeed
      const successfulBookings = results.filter(r => r.status === 'fulfilled');
      const failedBookings = results.filter(r => r.status === 'rejected');
      
      expect(successfulBookings).toHaveLength(1);
      expect(failedBookings).toHaveLength(2);
      
      // Verify final inventory state
      const updatedInventory = await RoomAvailability.findById(inventory._id);
      expect(updatedInventory.availableRooms).toBe(0);
      expect(updatedInventory.soldRooms).toBe(1);
    });

    test('should handle inventory updates atomically', async () => {
      const hotelId = new mongoose.Types.ObjectId();
      const roomTypeId = new mongoose.Types.ObjectId();
      const date = new Date('2024-01-15');
      
      // Create inventory
      const inventory = new RoomAvailability({
        hotelId,
        roomTypeId,
        date,
        totalRooms: 5,
        availableRooms: 5,
        soldRooms: 0,
        blockedRooms: 0
      });
      await inventory.save();

      // Book 3 rooms
      await RoomAvailability.bookRoomsWithLock(
        hotelId,
        roomTypeId,
        date,
        new Date('2024-01-16'),
        3,
        new mongoose.Types.ObjectId(),
        'test'
      );

      // Verify inventory consistency
      const updatedInventory = await RoomAvailability.findById(inventory._id);
      expect(updatedInventory.availableRooms).toBe(2);
      expect(updatedInventory.soldRooms).toBe(3);
      expect(updatedInventory.totalRooms).toBe(5);
    });
  });

  describe('Stop Sell Rules Tests', () => {
    test('should evaluate stop sell rules correctly', async () => {
      const hotelId = new mongoose.Types.ObjectId();
      const roomTypeId = new mongoose.Types.ObjectId();
      
      // Create a stop sell rule
      const rule = new StopSellRule({
        hotelId,
        name: 'Weekend Stop Sell',
        description: 'Stop selling on weekends',
        ruleType: 'stop_sell',
        priority: 1,
        dateRange: {
          startDate: new Date('2024-01-13'), // Saturday
          endDate: new Date('2024-01-14'),   // Sunday
          daysOfWeek: [0, 6] // Sunday and Saturday
        },
        allRoomTypes: true,
        allChannels: true,
        actions: {
          stopSell: true,
          closedToArrival: false,
          closedToDeparture: false
        },
        createdBy: new mongoose.Types.ObjectId()
      });
      await rule.save();

      // Test rule evaluation
      const context = {
        hotelId,
        date: new Date('2024-01-13'), // Saturday
        roomTypeId,
        channel: 'direct'
      };

      const results = await StopSellRule.evaluateRulesForContext(context);
      
      expect(results).toHaveLength(1);
      expect(results[0].actions.stopSell).toBe(true);
    });

    test('should respect rule priorities', async () => {
      const hotelId = new mongoose.Types.ObjectId();
      const roomTypeId = new mongoose.Types.ObjectId();
      
      // Create two rules with different priorities
      const lowPriorityRule = new StopSellRule({
        hotelId,
        name: 'Low Priority Rule',
        ruleType: 'stop_sell',
        priority: 1,
        dateRange: {
          startDate: new Date('2024-01-15'),
          endDate: new Date('2024-01-15')
        },
        allRoomTypes: true,
        allChannels: true,
        actions: { stopSell: true },
        createdBy: new mongoose.Types.ObjectId()
      });

      const highPriorityRule = new StopSellRule({
        hotelId,
        name: 'High Priority Rule',
        ruleType: 'stop_sell',
        priority: 10,
        dateRange: {
          startDate: new Date('2024-01-15'),
          endDate: new Date('2024-01-15')
        },
        allRoomTypes: true,
        allChannels: true,
        actions: { stopSell: false },
        createdBy: new mongoose.Types.ObjectId()
      });

      await lowPriorityRule.save();
      await highPriorityRule.save();

      // Test rule evaluation
      const context = {
        hotelId,
        date: new Date('2024-01-15'),
        roomTypeId,
        channel: 'direct'
      };

      const results = await StopSellRule.evaluateRulesForContext(context);
      
      // High priority rule should override low priority rule
      expect(results).toHaveLength(2);
      expect(results[0].priority).toBe(10);
      expect(results[0].actions.stopSell).toBe(false);
    });
  });

  describe('Inventory Alert Service Tests', () => {
    test('should detect overbooking and send alerts', async () => {
      const hotelId = new mongoose.Types.ObjectId();
      const roomTypeId = new mongoose.Types.ObjectId();
      
      // Create inventory with overbooking
      const inventory = new RoomAvailability({
        hotelId,
        roomTypeId,
        date: new Date('2024-01-15'),
        totalRooms: 5,
        availableRooms: -1, // Overbooked
        soldRooms: 6,        // More than total
        blockedRooms: 0
      });
      await inventory.save();

      // Check inventory and alert
      const alerts = await inventoryAlertService.checkInventoryAndAlert(
        hotelId,
        new Date('2024-01-15'),
        new Date('2024-01-15')
      );

      expect(alerts.length).toBeGreaterThan(0);
      
      const overbookingAlert = alerts.find(alert => alert.type === 'overbooking');
      expect(overbookingAlert).toBeDefined();
      expect(overbookingAlert.severity).toBe('critical');
    });

    test('should detect low inventory and send alerts', async () => {
      const hotelId = new mongoose.Types.ObjectId();
      const roomTypeId = new mongoose.Types.ObjectId();
      
      // Create inventory with low availability
      const inventory = new RoomAvailability({
        hotelId,
        roomTypeId,
        date: new Date('2024-01-15'),
        totalRooms: 10,
        availableRooms: 1, // 10% availability (below threshold)
        soldRooms: 9,
        blockedRooms: 0
      });
      await inventory.save();

      // Check inventory and alert
      const alerts = await inventoryAlertService.checkInventoryAndAlert(
        hotelId,
        new Date('2024-01-15'),
        new Date('2024-01-15')
      );

      expect(alerts.length).toBeGreaterThan(0);
      
      const lowInventoryAlert = alerts.find(alert => alert.type === 'low_inventory');
      expect(lowInventoryAlert).toBeDefined();
      expect(lowInventoryAlert.severity).toBe('warning');
    });
  });

  describe('Audit Trail Tests', () => {
    test('should track inventory changes with audit trail', async () => {
      const hotelId = new mongoose.Types.ObjectId();
      const roomTypeId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();
      
      // Create inventory
      const inventory = new RoomAvailability({
        hotelId,
        roomTypeId,
        date: new Date('2024-01-15'),
        totalRooms: 5,
        availableRooms: 5,
        soldRooms: 0,
        blockedRooms: 0
      });
      await inventory.save();

      // Update stop sell status
      await inventory.updateStopSellStatus(
        { stopSellFlag: true, closedToArrival: true },
        userId,
        'Test stop sell update',
        { ipAddress: '127.0.0.1' }
      );

      // Get audit trail
      const auditTrail = await RoomAvailability.getAuditTrail(
        hotelId,
        roomTypeId,
        new Date('2024-01-15'),
        new Date('2024-01-15'),
        'stop_sell'
      );

      expect(auditTrail).toHaveLength(1);
      expect(auditTrail[0].action).toBe('stop_sell');
      expect(auditTrail[0].userId.toString()).toBe(userId.toString());
      expect(auditTrail[0].reason).toBe('Test stop sell update');
      expect(auditTrail[0].metadata.ipAddress).toBe('127.0.0.1');
    });

    test('should track rate changes with audit trail', async () => {
      const hotelId = new mongoose.Types.ObjectId();
      const roomTypeId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();
      
      // Create inventory
      const inventory = new RoomAvailability({
        hotelId,
        roomTypeId,
        date: new Date('2024-01-15'),
        totalRooms: 5,
        availableRooms: 5,
        soldRooms: 0,
        blockedRooms: 0,
        baseRate: 100,
        sellingRate: 100,
        currency: 'INR'
      });
      await inventory.save();

      // Update rates
      await inventory.updateRates(
        { baseRate: 120, sellingRate: 150 },
        userId,
        'Rate increase for peak season',
        { channel: 'manual' }
      );

      // Get audit trail
      const auditTrail = await RoomAvailability.getAuditTrail(
        hotelId,
        roomTypeId,
        new Date('2024-01-15'),
        new Date('2024-01-15'),
        'rate_change'
      );

      expect(auditTrail).toHaveLength(1);
      expect(auditTrail[0].action).toBe('rate_change');
      expect(auditTrail[0].oldValues.baseRate).toBe(100);
      expect(auditTrail[0].newValues.baseRate).toBe(120);
      expect(auditTrail[0].newValues.sellingRate).toBe(150);
    });
  });

  describe('Performance Metrics Tests', () => {
    test('should calculate performance metrics correctly', async () => {
      const hotelId = new mongoose.Types.ObjectId();
      const roomTypeId = new mongoose.Types.ObjectId();
      
      // Create inventory for multiple days
      const inventories = [];
      for (let i = 0; i < 3; i++) {
        const date = new Date('2024-01-15');
        date.setDate(date.getDate() + i);
        
        const inventory = new RoomAvailability({
          hotelId,
          roomTypeId,
          date,
          totalRooms: 5,
          availableRooms: 5 - i,
          soldRooms: i,
          blockedRooms: 0,
          baseRate: 100,
          sellingRate: 120
        });
        inventories.push(inventory);
      }
      await RoomAvailability.insertMany(inventories);

      // Get performance metrics
      const metrics = await RoomAvailability.getPerformanceMetrics(
        hotelId,
        roomTypeId,
        new Date('2024-01-15'),
        new Date('2024-01-17')
      );

      expect(metrics).toBeDefined();
      expect(metrics.totalDays).toBe(3);
      expect(metrics.averageOccupancy).toBe(1); // (0+1+2)/3
      expect(metrics.revenuePerRoom).toBe(40); // (0+120+240)/3
      expect(metrics.conversionRate).toBe(0); // No reservations yet
    });
  });
});
