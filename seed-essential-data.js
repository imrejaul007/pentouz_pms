import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Import only essential models that have proper schema and default exports
import User from './src/models/User.js';
import Hotel from './src/models/Hotel.js';
import Room from './src/models/Room.js';
import RoomType from './src/models/RoomType.js';
import Booking from './src/models/Booking.js';
import PropertyGroup from './src/models/PropertyGroup.js';
import Department from './src/models/Department.js';
import HotelArea from './src/models/HotelArea.js';
import RoomFeature from './src/models/RoomFeature.js';
import PaymentMethod from './src/models/PaymentMethod.js';
import POSMenu from './src/models/POSMenu.js';
import POSOutlet from './src/models/POSOutlet.js';
import HotelService from './src/models/HotelService.js';
import AddOnService from './src/models/AddOnService.js';
import InventoryItem from './src/models/InventoryItem.js';
import RevenueAccount from './src/models/RevenueAccount.js';
import RoomAvailability from './src/models/RoomAvailability.js';
import LocalAttraction from './src/models/LocalAttraction.js';
import Offer from './src/models/Offer.js';
import Season from './src/models/Season.js';
import KPI from './src/models/KPI.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
};

const seedEssentialData = async () => {
  try {
    console.log('🌱 Starting essential data seeding (Adding without deleting existing data)...');

    // Step 1: Get admin user and hotel
    const adminUser = await User.findOne({ email: 'admin@hotel.com' });
    if (!adminUser) {
      console.error('❌ Admin user not found. Please run the main seed script first.');
      return;
    }

    const mainHotel = await Hotel.findOne({ name: 'THE PENTOUZ' });
    if (!mainHotel) {
      console.error('❌ Main hotel not found. Please run the main seed script first.');
      return;
    }

    const hotelId = mainHotel._id;
    const userId = adminUser._id;
    console.log(`📍 Using Hotel: ${mainHotel.name} (${hotelId})`);
    console.log(`👤 Using Admin: ${adminUser.email} (${userId})`);

    // Step 2: Add Departments
    console.log('\n🏢 Adding Departments...');
    const departments = [
      { name: 'Front Office', hotelId, isActive: true },
      { name: 'Housekeeping', hotelId, isActive: true },
      { name: 'Food & Beverage', hotelId, isActive: true },
      { name: 'Maintenance', hotelId, isActive: true },
      { name: 'Security', hotelId, isActive: true },
      { name: 'IT Support', hotelId, isActive: true }
    ];
    
    let deptCount = 0;
    for (const dept of departments) {
      const existing = await Department.findOne({ name: dept.name, hotelId });
      if (!existing) {
        await Department.create(dept);
        deptCount++;
      }
    }
    console.log(`✅ Added ${deptCount} new departments`);

    // Step 3: Add Hotel Areas
    console.log('\n🏨 Adding Hotel Areas...');
    const hotelAreas = [
      { name: 'Main Building', hotelId, floor: 0, isActive: true },
      { name: 'Tower A', hotelId, floor: 1, isActive: true },
      { name: 'Tower B', hotelId, floor: 2, isActive: true },
      { name: 'Garden Wing', hotelId, floor: 0, isActive: true },
      { name: 'Pool Side', hotelId, floor: 0, isActive: true }
    ];
    
    let areaCount = 0;
    for (const area of hotelAreas) {
      const existing = await HotelArea.findOne({ name: area.name, hotelId });
      if (!existing) {
        await HotelArea.create(area);
        areaCount++;
      }
    }
    console.log(`✅ Added ${areaCount} new hotel areas`);

    // Step 4: Add Room Features
    console.log('\n🛏️ Adding Room Features...');
    const roomFeatures = [
      { name: 'Sea View', hotelId, isActive: true },
      { name: 'City View', hotelId, isActive: true },
      { name: 'Garden View', hotelId, isActive: true },
      { name: 'Balcony', hotelId, isActive: true },
      { name: 'Jacuzzi', hotelId, isActive: true },
      { name: 'Mini Bar', hotelId, isActive: true }
    ];
    
    let featureCount = 0;
    for (const feature of roomFeatures) {
      const existing = await RoomFeature.findOne({ name: feature.name, hotelId });
      if (!existing) {
        await RoomFeature.create(feature);
        featureCount++;
      }
    }
    console.log(`✅ Added ${featureCount} new room features`);

    // Step 5: Add Payment Methods
    console.log('\n💳 Adding Payment Methods...');
    const paymentMethods = [
      { name: 'Cash', type: 'cash', hotelId, isActive: true },
      { name: 'Credit Card', type: 'card', hotelId, isActive: true },
      { name: 'Debit Card', type: 'card', hotelId, isActive: true },
      { name: 'UPI', type: 'digital', hotelId, isActive: true },
      { name: 'Net Banking', type: 'bank_transfer', hotelId, isActive: true }
    ];
    
    let pmCount = 0;
    for (const pm of paymentMethods) {
      const existing = await PaymentMethod.findOne({ name: pm.name, hotelId });
      if (!existing) {
        await PaymentMethod.create(pm);
        pmCount++;
      }
    }
    console.log(`✅ Added ${pmCount} new payment methods`);

    // Step 6: Add POS Outlets
    console.log('\n🍽️ Adding POS Outlets...');
    const posOutlets = [
      { 
        name: 'Main Restaurant', 
        type: 'restaurant', 
        location: 'Ground Floor', 
        hotelId, 
        isActive: true 
      },
      { 
        name: 'Pool Bar', 
        type: 'bar', 
        location: 'Pool Side', 
        hotelId, 
        isActive: true 
      },
      { 
        name: 'Room Service', 
        type: 'room_service', 
        location: 'All Floors', 
        hotelId, 
        isActive: true 
      }
    ];
    
    let outletCount = 0;
    for (const outlet of posOutlets) {
      const existing = await POSOutlet.findOne({ name: outlet.name, hotelId });
      if (!existing) {
        await POSOutlet.create(outlet);
        outletCount++;
      }
    }
    console.log(`✅ Added ${outletCount} new POS outlets`);

    // Step 7: Add POS Menu Items
    console.log('\n🍔 Adding POS Menu Items...');
    const menuItems = [
      { itemId: 'BF001', name: 'Continental Breakfast', category: 'Breakfast', price: 750, hotelId },
      { itemId: 'ST001', name: 'Paneer Tikka', category: 'Starters', price: 450, hotelId },
      { itemId: 'MC001', name: 'Butter Chicken', category: 'Main Course', price: 750, hotelId },
      { itemId: 'MC002', name: 'Dal Makhani', category: 'Main Course', price: 550, hotelId },
      { itemId: 'BV001', name: 'Fresh Juice', category: 'Beverages', price: 250, hotelId },
      { itemId: 'DS001', name: 'Chocolate Brownie', category: 'Desserts', price: 350, hotelId }
    ];
    
    let menuCount = 0;
    for (const item of menuItems) {
      const existing = await POSMenu.findOne({ itemId: item.itemId, hotelId });
      if (!existing) {
        await POSMenu.create(item);
        menuCount++;
      }
    }
    console.log(`✅ Added ${menuCount} new menu items`);

    // Step 8: Add Hotel Services
    console.log('\n🛎️ Adding Hotel Services...');
    const hotelServices = [
      { name: 'Spa Treatment', category: 'wellness', price: 3000, hotelId, isActive: true },
      { name: 'Airport Transfer', category: 'transport', price: 2000, hotelId, isActive: true },
      { name: 'Laundry Service', category: 'housekeeping', price: 500, hotelId, isActive: true },
      { name: 'City Tour', category: 'concierge', price: 1500, hotelId, isActive: true },
      { name: 'Gym Access', category: 'fitness', price: 0, hotelId, isActive: true }
    ];
    
    let serviceCount = 0;
    for (const service of hotelServices) {
      const existing = await HotelService.findOne({ name: service.name, hotelId });
      if (!existing) {
        await HotelService.create(service);
        serviceCount++;
      }
    }
    console.log(`✅ Added ${serviceCount} new hotel services`);

    // Step 9: Add Add-on Services
    console.log('\n➕ Adding Add-on Services...');
    const addOnServices = [
      { name: 'Extra Bed', description: 'Additional bed', price: 1000, hotelId, isActive: true },
      { name: 'Late Checkout', description: 'Checkout until 2 PM', price: 500, hotelId, isActive: true },
      { name: 'Early Checkin', description: 'Checkin from 10 AM', price: 500, hotelId, isActive: true },
      { name: 'Breakfast Package', description: 'Continental breakfast', price: 750, hotelId, isActive: true }
    ];
    
    let addonCount = 0;
    for (const addon of addOnServices) {
      const existing = await AddOnService.findOne({ name: addon.name, hotelId });
      if (!existing) {
        await AddOnService.create(addon);
        addonCount++;
      }
    }
    console.log(`✅ Added ${addonCount} new add-on services`);

    // Step 10: Add Inventory Items
    console.log('\n📦 Adding Inventory Items...');
    const inventoryItems = [
      { name: 'Bath Towel', category: 'Linen', unit: 'piece', currentStock: 500, hotelId, isActive: true },
      { name: 'Hand Towel', category: 'Linen', unit: 'piece', currentStock: 400, hotelId, isActive: true },
      { name: 'Bed Sheet', category: 'Linen', unit: 'set', currentStock: 450, hotelId, isActive: true },
      { name: 'Pillow Cover', category: 'Linen', unit: 'piece', currentStock: 400, hotelId, isActive: true },
      { name: 'Shampoo', category: 'Toiletries', unit: 'bottle', currentStock: 300, hotelId, isActive: true },
      { name: 'Soap', category: 'Toiletries', unit: 'piece', currentStock: 500, hotelId, isActive: true }
    ];
    
    let invCount = 0;
    for (const item of inventoryItems) {
      const existing = await InventoryItem.findOne({ name: item.name, hotelId });
      if (!existing) {
        await InventoryItem.create(item);
        invCount++;
      }
    }
    console.log(`✅ Added ${invCount} new inventory items`);

    // Step 11: Add Revenue Accounts
    console.log('\n💵 Adding Revenue Accounts...');
    const revenueAccounts = [
      { name: 'Room Revenue', category: 'accommodation', hotelId, isActive: true },
      { name: 'Food & Beverage', category: 'dining', hotelId, isActive: true },
      { name: 'Spa Revenue', category: 'wellness', hotelId, isActive: true },
      { name: 'Laundry Revenue', category: 'services', hotelId, isActive: true },
      { name: 'Miscellaneous Revenue', category: 'other', hotelId, isActive: true }
    ];
    
    let revCount = 0;
    for (const account of revenueAccounts) {
      const existing = await RevenueAccount.findOne({ name: account.name, hotelId });
      if (!existing) {
        await RevenueAccount.create(account);
        revCount++;
      }
    }
    console.log(`✅ Added ${revCount} new revenue accounts`);

    // Step 12: Add Local Attractions
    console.log('\n🏛️ Adding Local Attractions...');
    const attractions = [
      { name: 'Gateway of India', description: 'Historic monument', distance: 2.5, hotelId, isActive: true },
      { name: 'Marine Drive', description: 'Scenic waterfront', distance: 1.8, hotelId, isActive: true },
      { name: 'Juhu Beach', description: 'Popular beach destination', distance: 8.5, hotelId, isActive: true },
      { name: 'Colaba Causeway', description: 'Shopping street', distance: 2.0, hotelId, isActive: true },
      { name: 'Elephanta Caves', description: 'UNESCO World Heritage Site', distance: 12.0, hotelId, isActive: true }
    ];
    
    let attrCount = 0;
    for (const attraction of attractions) {
      const existing = await LocalAttraction.findOne({ name: attraction.name, hotelId });
      if (!existing) {
        await LocalAttraction.create(attraction);
        attrCount++;
      }
    }
    console.log(`✅ Added ${attrCount} new local attractions`);

    // Step 13: Add Offers
    console.log('\n🎁 Adding Offers...');
    const offers = [
      {
        name: 'Early Bird Special',
        description: '10% discount for bookings made 30 days in advance',
        discountType: 'percentage',
        discountValue: 10,
        validFrom: new Date(),
        validTo: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        hotelId,
        isActive: true
      },
      {
        name: 'Weekend Getaway',
        description: '15% discount on weekend stays',
        discountType: 'percentage',
        discountValue: 15,
        validFrom: new Date(),
        validTo: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        hotelId,
        isActive: true
      }
    ];
    
    let offerCount = 0;
    for (const offer of offers) {
      const existing = await Offer.findOne({ name: offer.name, hotelId });
      if (!existing) {
        await Offer.create(offer);
        offerCount++;
      }
    }
    console.log(`✅ Added ${offerCount} new offers`);

    // Step 14: Add Seasons
    console.log('\n🌴 Adding Seasons...');
    const seasons = [
      {
        name: 'Peak Season',
        description: 'High demand period (Dec-Jan)',
        startDate: new Date('2024-12-01'),
        endDate: new Date('2025-01-31'),
        hotelId,
        isActive: true
      },
      {
        name: 'Shoulder Season',
        description: 'Moderate demand (Oct-Nov)',
        startDate: new Date('2024-10-01'),
        endDate: new Date('2024-11-30'),
        hotelId,
        isActive: true
      },
      {
        name: 'Low Season',
        description: 'Low demand (Jun-Sep)',
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-09-30'),
        hotelId,
        isActive: true
      }
    ];
    
    let seasonCount = 0;
    for (const season of seasons) {
      const existing = await Season.findOne({ name: season.name, hotelId });
      if (!existing) {
        await Season.create(season);
        seasonCount++;
      }
    }
    console.log(`✅ Added ${seasonCount} new seasons`);

    // Step 15: Add Room Availability (next 30 days)
    console.log('\n📊 Adding Room Availability...');
    const roomTypes = await RoomType.find({ hotelId });
    let availabilityCount = 0;
    
    if (roomTypes.length > 0) {
      for (let day = 0; day < 30; day++) {
        const date = new Date();
        date.setDate(date.getDate() + day);
        
        for (const roomType of roomTypes) {
          const existing = await RoomAvailability.findOne({ hotelId, roomTypeId: roomType._id, date });
          if (!existing) {
            await RoomAvailability.create({
              hotelId,
              roomTypeId: roomType._id,
              date,
              totalRooms: roomType.totalRooms || 25,
              availableRooms: Math.floor((roomType.totalRooms || 25) * 0.7),
              soldRooms: Math.floor((roomType.totalRooms || 25) * 0.3),
              blockedRooms: 0,
              baseRate: roomType.baseRate,
              sellingRate: roomType.baseRate * (day < 7 ? 1.2 : 1),
              currency: 'INR'
            });
            availabilityCount++;
          }
        }
      }
    }
    console.log(`✅ Added ${availabilityCount} new room availability records`);

    // Step 16: Add Sample KPIs
    console.log('\n📈 Adding KPI Data...');
    const today = new Date();
    const existingKPI = await KPI.findOne({ hotelId, date: today });
    
    if (!existingKPI) {
      await KPI.create({
        hotelId,
        date: today,
        occupancyRate: 75,
        adr: 8500,
        revPar: 6375,
        totalRevenue: 850000,
        roomRevenue: 650000,
        fbRevenue: 150000,
        otherRevenue: 50000,
        totalRooms: 100,
        occupiedRooms: 75,
        availableRooms: 25,
        arrivals: 15,
        departures: 12,
        stayovers: 48,
        cancellations: 2,
        noShows: 1
      });
      console.log('✅ Added KPI data for today');
    } else {
      console.log('✅ KPI data already exists');
    }

    // Final Summary
    console.log('\n' + '='.repeat(70));
    console.log('🎉 ESSENTIAL DATA SEEDING COMPLETED!');
    console.log('='.repeat(70));
    console.log('📊 Data Added Summary:');
    console.log(`   🏢 Departments: ${deptCount} new`);
    console.log(`   🏨 Hotel Areas: ${areaCount} new`);
    console.log(`   🛏️ Room Features: ${featureCount} new`);
    console.log(`   💳 Payment Methods: ${pmCount} new`);
    console.log(`   🍽️ POS Outlets: ${outletCount} new`);
    console.log(`   🍔 Menu Items: ${menuCount} new`);
    console.log(`   🛎️ Hotel Services: ${serviceCount} new`);
    console.log(`   ➕ Add-on Services: ${addonCount} new`);
    console.log(`   📦 Inventory Items: ${invCount} new`);
    console.log(`   💵 Revenue Accounts: ${revCount} new`);
    console.log(`   🏛️ Local Attractions: ${attrCount} new`);
    console.log(`   🎁 Offers: ${offerCount} new`);
    console.log(`   🌴 Seasons: ${seasonCount} new`);
    console.log(`   📊 Room Availability: ${availabilityCount} new`);
    console.log('='.repeat(70));
    
    // Get final counts
    const finalCounts = {
      users: await User.countDocuments(),
      hotels: await Hotel.countDocuments(),
      rooms: await Room.countDocuments({ hotelId }),
      roomTypes: await RoomType.countDocuments({ hotelId }),
      bookings: await Booking.countDocuments({ hotelId }),
      departments: await Department.countDocuments({ hotelId }),
      menuItems: await POSMenu.countDocuments({ hotelId }),
      services: await HotelService.countDocuments({ hotelId }),
      inventory: await InventoryItem.countDocuments({ hotelId }),
      offers: await Offer.countDocuments({ hotelId })
    };
    
    console.log('\n📊 TOTAL DATABASE COUNTS:');
    console.log(`   👥 Total Users: ${finalCounts.users}`);
    console.log(`   🏨 Total Hotels: ${finalCounts.hotels}`);
    console.log(`   🚪 Total Rooms: ${finalCounts.rooms}`);
    console.log(`   🛏️ Room Types: ${finalCounts.roomTypes}`);
    console.log(`   📅 Bookings: ${finalCounts.bookings}`);
    console.log(`   🏢 Departments: ${finalCounts.departments}`);
    console.log(`   🍔 Menu Items: ${finalCounts.menuItems}`);
    console.log(`   🛎️ Hotel Services: ${finalCounts.services}`);
    console.log(`   📦 Inventory Items: ${finalCounts.inventory}`);
    console.log(`   🎁 Active Offers: ${finalCounts.offers}`);
    
    console.log('\n✅ Essential data has been added without deleting existing records');
    console.log('✅ All models have consistent hotelId references');
    console.log('✅ Your Multi-Property Manager now has comprehensive data!');
    console.log('\n🔐 Login Credentials:');
    console.log('   📧 Admin: admin@hotel.com');
    console.log('   🔑 Password: admin123');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
};

const main = async () => {
  try {
    await connectDB();
    await seedEssentialData();
    await mongoose.connection.close();
    console.log('\n🔒 Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the script
main();