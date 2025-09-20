import mongoose from 'mongoose';
import dotenv from 'dotenv';
import LaundryTransaction from './src/models/LaundryTransaction.js';
import RoomInventory from './src/models/RoomInventory.js';
import InventoryItem from './src/models/InventoryItem.js';
import Room from './src/models/Room.js';
import Hotel from './src/models/Hotel.js';
import User from './src/models/User.js';
import laundryService from './src/services/laundryService.js';

dotenv.config();

const connectDB = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
};

const testLaundrySystem = async () => {
  try {
    console.log('\n🧪 Testing Laundry System...\n');

    // Test 1: Create test data
    console.log('📝 Creating test data...');
    
    // Create test hotel
    const hotel = await Hotel.findOne() || await Hotel.create({
      name: 'Test Hotel',
      address: '123 Test Street',
      city: 'Test City',
      country: 'Test Country',
      phone: '+1234567890',
      email: 'test@hotel.com',
      isActive: true
    });

    // Create test user
    const user = await User.findOne({ role: 'admin' }) || await User.create({
      name: 'Test Admin',
      email: 'admin@test.com',
      password: 'password123',
      role: 'admin',
      hotelId: hotel._id,
      isActive: true
    });

    // Create test room
    const room = await Room.findOne({ hotelId: hotel._id }) || await Room.create({
      hotelId: hotel._id,
      roomNumber: '101',
      type: 'standard',
      baseRate: 100,
      currentRate: 100,
      status: 'vacant',
      floor: 1,
      capacity: 2,
      amenities: ['WiFi', 'TV', 'AC'],
      isActive: true
    });

    // Create test inventory item
    const inventoryItem = await InventoryItem.findOne({ hotelId: hotel._id }) || await InventoryItem.create({
      hotelId: hotel._id,
      name: 'Test Bed Sheet',
      category: 'bedding',
      unitPrice: 500,
      replacementPrice: 800,
      isComplimentary: true,
      isChargeable: false,
      stockThreshold: 20,
      supplier: 'Test Supplier',
      isActive: true
    });

    console.log('✅ Test data created successfully');

    // Test 2: Send items to laundry
    console.log('\n🧺 Testing send items to laundry...');
    
    const sendResult = await laundryService.sendItemsToLaundry({
      hotelId: hotel._id,
      roomId: room._id,
      items: [{
        itemId: inventoryItem._id,
        quantity: 2,
        notes: 'Test laundry request',
        specialInstructions: 'Handle with care'
      }],
      processedBy: user._id,
      expectedReturnDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      notes: 'Test laundry transaction',
      specialInstructions: 'Standard cleaning',
      isUrgent: false,
      source: 'manual'
    });

    console.log('✅ Items sent to laundry successfully');
    console.log(`   - Transaction ID: ${sendResult.transactions[0]._id}`);
    console.log(`   - Total items: ${sendResult.totalItems}`);
    console.log(`   - Total cost: ₹${sendResult.totalCost}`);

    // Test 3: Mark items as in laundry
    console.log('\n🏭 Testing mark items as in laundry...');
    
    const transactionId = sendResult.transactions[0]._id;
    await laundryService.markItemsAsInLaundry(transactionId, user._id);
    console.log('✅ Items marked as in laundry');

    // Test 4: Mark items as cleaning
    console.log('\n🧽 Testing mark items as cleaning...');
    
    await laundryService.markItemsAsCleaning(transactionId, user._id);
    console.log('✅ Items marked as cleaning');

    // Test 5: Mark items as ready
    console.log('\n✅ Testing mark items as ready...');
    
    await laundryService.markItemsAsReady(transactionId, user._id);
    console.log('✅ Items marked as ready');

    // Test 6: Return items from laundry
    console.log('\n📦 Testing return items from laundry...');
    
    await laundryService.returnItemsFromLaundry(
      transactionId,
      user._id,
      'good',
      [],
      []
    );
    console.log('✅ Items returned from laundry successfully');

    // Test 7: Get laundry dashboard
    console.log('\n📊 Testing laundry dashboard...');
    
    const dashboardData = await laundryService.getLaundryDashboard(hotel._id);
    console.log('✅ Laundry dashboard data retrieved');
    console.log(`   - Status summary: ${dashboardData.statusSummary.length} statuses`);
    console.log(`   - Total transactions: ${dashboardData.statistics.totalTransactions}`);
    console.log(`   - Total cost: ₹${dashboardData.statistics.totalCost}`);

    // Test 8: Get laundry status
    console.log('\n📋 Testing laundry status...');
    
    const statusData = await laundryService.getLaundryStatus(hotel._id);
    console.log('✅ Laundry status data retrieved');
    console.log(`   - Total transactions: ${statusData.length}`);

    // Test 9: Get overdue items
    console.log('\n⏰ Testing overdue items...');
    
    const overdueItems = await laundryService.getOverdueItems(hotel._id);
    console.log('✅ Overdue items retrieved');
    console.log(`   - Overdue items: ${overdueItems.length}`);

    // Test 10: Get laundry statistics
    console.log('\n📈 Testing laundry statistics...');
    
    const statistics = await laundryService.getLaundryStatistics(hotel._id, {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      end: new Date()
    });
    console.log('✅ Laundry statistics retrieved');
    console.log(`   - Status statistics: ${statistics.statusStatistics.length} statuses`);
    console.log(`   - Category statistics: ${statistics.categoryStatistics.length} categories`);

    console.log('\n🎉 All laundry system tests passed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ Database connection');
    console.log('   ✅ Test data creation');
    console.log('   ✅ Send items to laundry');
    console.log('   ✅ Mark items as in laundry');
    console.log('   ✅ Mark items as cleaning');
    console.log('   ✅ Mark items as ready');
    console.log('   ✅ Return items from laundry');
    console.log('   ✅ Laundry dashboard');
    console.log('   ✅ Laundry status');
    console.log('   ✅ Overdue items');
    console.log('   ✅ Laundry statistics');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
};

const cleanup = async () => {
  try {
    console.log('\n🧹 Cleaning up test data...');
    await LaundryTransaction.deleteMany({ notes: 'Test laundry transaction' });
    console.log('✅ Test data cleaned up');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
};

const runTests = async () => {
  try {
    await connectDB();
    await testLaundrySystem();
    await cleanup();
    console.log('\n🏁 All tests completed successfully!');
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database disconnected');
  }
};

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].includes('test-laundry-system.js')) {
  runTests();
}

export default runTests;
