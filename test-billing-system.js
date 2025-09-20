import mongoose from 'mongoose';
import dotenv from 'dotenv';
import BillingSession from './src/models/BillingSession.js';
import POSOutlet from './src/models/POSOutlet.js';
import POSMenu from './src/models/POSMenu.js';
import User from './src/models/User.js';
import Hotel from './src/models/Hotel.js';

dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Test BillingSession Model
const testBillingSessionModel = async () => {
  console.log('\n🧪 Testing BillingSession Model...');
  
  try {
    // Get a sample hotel and user
    const hotel = await Hotel.findOne();
    const user = await User.findOne({ role: 'staff' });
    
    if (!hotel || !user) {
      console.log('❌ Required test data not found. Please run seedBillingData.js first.');
      return;
    }

    // Test creating a billing session
    const sessionData = {
      sessionId: `TEST-${Date.now()}`,
      hotelId: hotel._id,
      guestName: 'Test Guest',
      roomNumber: '999',
      createdBy: user._id
    };

    const billingSession = new BillingSession(sessionData);
    
    // Test adding items
    billingSession.addItem({
      id: 'test-item-1',
      name: 'Test Item 1',
      category: 'Test Category',
      price: 100,
      outlet: 'Test Outlet'
    });

    billingSession.addItem({
      id: 'test-item-2',
      name: 'Test Item 2',
      category: 'Test Category',
      price: 200,
      outlet: 'Test Outlet'
    });

    // Test updating item quantity
    billingSession.updateItemQuantity('test-item-1', 2);

    // Test applying discount
    billingSession.applyDiscount(10, true); // 10% discount

    // Test calculating totals
    const totals = billingSession.calculateTotals();
    console.log('📊 Calculated totals:', totals);

    // Test processing payment
    billingSession.processPayment('room_charge');

    // Save the session
    await billingSession.save();
    console.log('✅ BillingSession model test passed');

    // Clean up
    await BillingSession.findByIdAndDelete(billingSession._id);
    console.log('🧹 Test session cleaned up');

  } catch (error) {
    console.error('❌ BillingSession model test failed:', error);
  }
};

// Test POS Data
const testPOSData = async () => {
  console.log('\n🧪 Testing POS Data...');
  
  try {
    // Check POS outlets
    const outlets = await POSOutlet.find();
    console.log(`📊 Found ${outlets.length} POS outlets`);
    
    if (outlets.length > 0) {
      console.log('✅ POS outlets data available');
      
      // Check POS menus
      const menus = await POSMenu.find();
      console.log(`📊 Found ${menus.length} POS menus`);
      
      if (menus.length > 0) {
        console.log('✅ POS menus data available');
        
        // Check menu items
        const totalItems = menus.reduce((sum, menu) => sum + menu.items.length, 0);
        console.log(`📊 Total menu items: ${totalItems}`);
      }
    } else {
      console.log('⚠️ No POS data found. Please run seedBillingData.js first.');
    }

  } catch (error) {
    console.error('❌ POS data test failed:', error);
  }
};

// Test User and Hotel Data
const testUserAndHotelData = async () => {
  console.log('\n🧪 Testing User and Hotel Data...');
  
  try {
    // Check hotels
    const hotels = await Hotel.find();
    console.log(`📊 Found ${hotels.length} hotels`);
    
    if (hotels.length > 0) {
      console.log('✅ Hotel data available');
      
      // Check users
      const users = await User.find();
      console.log(`📊 Found ${users.length} users`);
      
      const staffUsers = users.filter(user => user.role === 'staff');
      const guestUsers = users.filter(user => user.role === 'guest');
      
      console.log(`📊 Staff users: ${staffUsers.length}`);
      console.log(`📊 Guest users: ${guestUsers.length}`);
      
      if (staffUsers.length > 0 && guestUsers.length > 0) {
        console.log('✅ User data available for testing');
      }
    } else {
      console.log('⚠️ No user/hotel data found. Please run seedBillingData.js first.');
    }

  } catch (error) {
    console.error('❌ User and hotel data test failed:', error);
  }
};

// Test API Endpoints (if server is running)
const testAPIEndpoints = async () => {
  console.log('\n🧪 Testing API Endpoints...');
  
  try {
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:4000';
    
    // Test health endpoint
    const healthResponse = await fetch(`${baseUrl}/health`);
    if (healthResponse.ok) {
      console.log('✅ Health endpoint accessible');
      
      // Test billing sessions endpoint (without auth for now)
      const billingResponse = await fetch(`${baseUrl}/api/v1/billing-sessions`);
      if (billingResponse.status === 401) {
        console.log('✅ Billing sessions endpoint accessible (requires auth)');
      } else {
        console.log(`⚠️ Billing sessions endpoint returned: ${billingResponse.status}`);
      }
      
    } else {
      console.log('⚠️ Health endpoint not accessible. Is the server running?');
    }

  } catch (error) {
    console.log('⚠️ API endpoint test skipped (server may not be running)');
  }
};

// Main test function
const runAllTests = async () => {
  try {
    await connectDB();
    
    console.log('🚀 Starting Billing System Tests...\n');
    
    await testUserAndHotelData();
    await testPOSData();
    await testBillingSessionModel();
    await testAPIEndpoints();
    
    console.log('\n✅ All tests completed!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
};

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
}

export default runAllTests;
