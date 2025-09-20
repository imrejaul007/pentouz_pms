import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Import ALL models
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
import Salutation from './src/models/Salutation.js';
import BillMessage from './src/models/BillMessage.js';
import POSMenu from './src/models/POSMenu.js';
import POSOrder from './src/models/POSOrder.js';
import POSTax from './src/models/POSTax.js';
import POSOutlet from './src/models/POSOutlet.js';
import POSAttribute from './src/models/POSAttribute.js';
import POSAttributeValue from './src/models/POSAttributeValue.js';
import POSItemVariant from './src/models/POSItemVariant.js';
import MeasurementUnit from './src/models/MeasurementUnit.js';
import PhoneExtension from './src/models/PhoneExtension.js';
import RoomCharge from './src/models/RoomCharge.js';
import RevenueAccount from './src/models/RevenueAccount.js';
import RoomTax from './src/models/RoomTax.js';
import RoomInventory from './src/models/RoomInventory.js';
import InventoryItem from './src/models/InventoryItem.js';
import InventoryTransaction from './src/models/InventoryTransaction.js';
import LaundryTransaction from './src/models/LaundryTransaction.js';
import StopSellRule from './src/models/StopSellRule.js';
import RoomAvailability from './src/models/RoomAvailability.js';
import RoomTypeAllotment from './src/models/RoomTypeAllotment.js';
import Housekeeping from './src/models/Housekeeping.js';
import MaintenanceTask from './src/models/MaintenanceTask.js';
import StaffTask from './src/models/StaffTask.js';
import IncidentReport from './src/models/IncidentReport.js';
import DailyInventoryCheck from './src/models/DailyInventoryCheck.js';
import DailyRoutineCheck from './src/models/DailyRoutineCheck.js';
import DailyRoutineCheckTemplate from './src/models/DailyRoutineCheckTemplate.js';
import CheckoutInspection from './src/models/CheckoutInspection.js';
import CheckoutInventory from './src/models/CheckoutInventory.js';
import RoomInventoryTemplate from './src/models/RoomInventoryTemplate.js';
import HotelService from './src/models/HotelService.js';
import ServiceBooking from './src/models/ServiceBooking.js';
import AddOnService from './src/models/AddOnService.js';
import ServiceInclusion from './src/models/ServiceInclusion.js';
import GuestService from './src/models/GuestService.js';
import DigitalKey from './src/models/DigitalKey.js';
import MeetUpRequest from './src/models/MeetUpRequest.js';
import SupplyRequest from './src/models/SupplyRequest.js';
import NotificationPreference from './src/models/NotificationPreference.js';
import Notification from './src/models/Notification.js';
import LocalAttraction from './src/models/LocalAttraction.js';
import Offer from './src/models/Offer.js';
import Loyalty from './src/models/Loyalty.js';
import Review from './src/models/Review.js';
import Payment from './src/models/Payment.js';
import Invoice from './src/models/Invoice.js';
import SyncHistory from './src/models/SyncHistory.js';
import MessageTemplate from './src/models/MessageTemplate.js';
import Communication from './src/models/Communication.js';
import Inventory from './src/models/Inventory.js';
import CorporateCompany from './src/models/CorporateCompany.js';
import GroupBooking from './src/models/GroupBooking.js';
import CorporateCredit from './src/models/CorporateCredit.js';
import KPI from './src/models/KPI.js';
// ChannelManager and BookingEngine don't have default exports
import TapeChart from './src/models/TapeChart.js';
import BillingSession from './src/models/BillingSession.js';
import JournalEntry from './src/models/JournalEntry.js';
import BankAccount from './src/models/BankAccount.js';
import Budget from './src/models/Budget.js';
import FinancialInvoice from './src/models/FinancialInvoice.js';
import FinancialPayment from './src/models/FinancialPayment.js';
import ChartOfAccounts from './src/models/ChartOfAccounts.js';
import GeneralLedger from './src/models/GeneralLedger.js';
// RevenueManagement, RoomMapping, RateMapping don't have default exports
import PricingStrategy from './src/models/PricingStrategy.js';
import DemandForecast from './src/models/DemandForecast.js';
import CompetitorMonitoring from './src/models/CompetitorMonitoring.js';
import EventQueue from './src/models/EventQueue.js';
import Currency from './src/models/Currency.js';
import Language from './src/models/Language.js';
import Translation from './src/models/Translation.js';
import Content from './src/models/Content.js';
import ChannelConfiguration from './src/models/ChannelConfiguration.js';
import RevenueReport from './src/models/RevenueReport.js';
import OTAPayload from './src/models/OTAPayload.js';
import SharedResource from './src/models/SharedResource.js';
import VIPGuest from './src/models/VIPGuest.js';
import GuestBlacklist from './src/models/GuestBlacklist.js';
import CustomField from './src/models/CustomField.js';
import GuestCustomData from './src/models/GuestCustomData.js';
import Season from './src/models/Season.js';
import SpecialPeriod from './src/models/SpecialPeriod.js';
import DayUseSlot from './src/models/DayUseSlot.js';
import DayUseBooking from './src/models/DayUseBooking.js';
import CentralizedRate from './src/models/CentralizedRate.js';
import LoginSession from './src/models/LoginSession.js';
import Reason from './src/models/Reason.js';
import LostFound from './src/models/LostFound.js';
import ArrivalDepartureMode from './src/models/ArrivalDepartureMode.js';
import Counter from './src/models/Counter.js';
import IdentificationType from './src/models/IdentificationType.js';
import GuestType from './src/models/GuestType.js';
import AccountAttribute from './src/models/AccountAttribute.js';
import UserAnalytics from './src/models/UserAnalytics.js';
import WebConfiguration from './src/models/WebConfiguration.js';
import WebSettings from './src/models/WebSettings.js';
import BookingFormTemplate from './src/models/BookingFormTemplate.js';
import AuditLog from './src/models/AuditLog.js';
import APIKey from './src/models/APIKey.js';
import WebhookEndpoint from './src/models/WebhookEndpoint.js';
import APIMetrics from './src/models/APIMetrics.js';
import MarketSegment from './src/models/MarketSegment.js';
import DynamicPricing from './src/models/DynamicPricing.js';
import JobType from './src/models/JobType.js';
import SpecialDiscount from './src/models/SpecialDiscount.js';

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

const seedComprehensiveData = async () => {
  try {
    console.log('🌱 Starting comprehensive data seeding...');
    console.log('📋 This will ADD data without deleting existing records');

    // Step 1: Get or create admin user
    let adminUser = await User.findOne({ email: 'admin@hotel.com' });
    if (!adminUser) {
      const hashedPassword = await bcrypt.hash('admin123', 12);
      adminUser = await User.create({
        name: 'Hotel Admin',
        email: 'admin@hotel.com',
        password: hashedPassword,
        phone: '+91-9876543210',
        role: 'admin',
        isActive: true
      });
      console.log('✅ Created admin user');
    }

    // Step 2: Get or create main hotel
    let mainHotel = await Hotel.findOne({ name: 'THE PENTOUZ' });
    if (!mainHotel) {
      mainHotel = await Hotel.create({
        name: 'THE PENTOUZ',
        description: 'Luxury hotel with premium amenities',
        address: {
          street: '123 Main Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          country: 'India',
          zipCode: '400001'
        },
        contact: {
          phone: '+91-22-12345678',
          email: 'info@thepentouz.com',
          website: 'https://thepentouz.com'
        },
        amenities: ['WiFi', 'Pool', 'Spa', 'Restaurant', 'Gym', 'Parking'],
        isActive: true,
        ownerId: adminUser._id
      });
      console.log('✅ Created main hotel');
    }

    // Update admin user with hotelId if needed
    if (!adminUser.hotelId || adminUser.hotelId.toString() !== mainHotel._id.toString()) {
      adminUser.hotelId = mainHotel._id;
      await adminUser.save();
    }

    const hotelId = mainHotel._id;
    const userId = adminUser._id;
    console.log(`📍 Using Hotel ID: ${hotelId}`);
    console.log(`👤 Using Admin User ID: ${userId}`);

    // Step 3: Create Salutations (no hotelId needed)
    console.log('\n📝 Creating Salutations...');
    const salutations = [
      { code: 'MR', title: 'Mr.', gender: 'male', displayOrder: 1, isActive: true },
      { code: 'MRS', title: 'Mrs.', gender: 'female', displayOrder: 2, isActive: true },
      { code: 'MS', title: 'Ms.', gender: 'female', displayOrder: 3, isActive: true },
      { code: 'DR', title: 'Dr.', gender: 'neutral', displayOrder: 4, isActive: true },
      { code: 'PROF', title: 'Prof.', gender: 'neutral', displayOrder: 5, isActive: true }
    ];
    for (const salutation of salutations) {
      await Salutation.findOneAndUpdate(
        { code: salutation.code },
        salutation,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Salutations');

    // Step 4: Create Departments
    console.log('\n🏢 Creating Departments...');
    const departments = [
      { name: 'Front Office', code: 'FO', hotelId, description: 'Reception and guest services', isActive: true },
      { name: 'Housekeeping', code: 'HK', hotelId, description: 'Room cleaning and maintenance', isActive: true },
      { name: 'Food & Beverage', code: 'FB', hotelId, description: 'Restaurant and bar services', isActive: true },
      { name: 'Maintenance', code: 'MT', hotelId, description: 'Property maintenance', isActive: true },
      { name: 'Security', code: 'SC', hotelId, description: 'Security services', isActive: true },
      { name: 'IT', code: 'IT', hotelId, description: 'Information technology', isActive: true },
      { name: 'Finance', code: 'FN', hotelId, description: 'Accounting and finance', isActive: true },
      { name: 'HR', code: 'HR', hotelId, description: 'Human resources', isActive: true }
    ];
    const createdDepartments = [];
    for (const dept of departments) {
      const created = await Department.findOneAndUpdate(
        { code: dept.code, hotelId },
        dept,
        { upsert: true, new: true }
      );
      createdDepartments.push(created);
    }
    console.log(`✅ Created/Updated ${createdDepartments.length} Departments`);

    // Step 5: Create Hotel Areas
    console.log('\n🏨 Creating Hotel Areas...');
    const hotelAreas = [
      { name: 'Main Building', code: 'MB', hotelId, floor: 0, description: 'Main hotel building', isActive: true },
      { name: 'Tower A', code: 'TA', hotelId, floor: 1, description: 'Tower A - Floors 1-5', isActive: true },
      { name: 'Tower B', code: 'TB', hotelId, floor: 1, description: 'Tower B - Floors 1-5', isActive: true },
      { name: 'Garden Wing', code: 'GW', hotelId, floor: 0, description: 'Garden facing rooms', isActive: true },
      { name: 'Pool Side', code: 'PS', hotelId, floor: 0, description: 'Pool side rooms', isActive: true }
    ];
    for (const area of hotelAreas) {
      await HotelArea.findOneAndUpdate(
        { code: area.code, hotelId },
        area,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Hotel Areas');

    // Step 6: Create Room Features
    console.log('\n🛏️ Creating Room Features...');
    const roomFeatures = [
      { name: 'Sea View', code: 'SV', hotelId, category: 'view', isActive: true },
      { name: 'City View', code: 'CV', hotelId, category: 'view', isActive: true },
      { name: 'Garden View', code: 'GV', hotelId, category: 'view', isActive: true },
      { name: 'Balcony', code: 'BL', hotelId, category: 'amenity', isActive: true },
      { name: 'Bathtub', code: 'BT', hotelId, category: 'bathroom', isActive: true },
      { name: 'Mini Bar', code: 'MB', hotelId, category: 'amenity', isActive: true },
      { name: 'Safe', code: 'SF', hotelId, category: 'amenity', isActive: true },
      { name: 'Coffee Machine', code: 'CM', hotelId, category: 'amenity', isActive: true }
    ];
    for (const feature of roomFeatures) {
      await RoomFeature.findOneAndUpdate(
        { code: feature.code, hotelId },
        feature,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Room Features');

    // Step 7: Create Room Types
    console.log('\n🚪 Creating Room Types...');
    const roomTypes = [
      {
        code: 'STD',
        name: 'Standard Room',
        description: 'Comfortable standard room',
        shortDescription: 'Standard room',
        baseRate: 5000,
        totalRooms: 30,
        specifications: {
          maxOccupancy: 2,
          bedType: 'double',
          bedCount: 1,
          roomSize: 25,
          view: 'city',
          smokingPolicy: 'non_smoking'
        },
        hotelId,
        isActive: true,
        isPublished: true,
        category: 'standard',
        rank: 1
      },
      {
        code: 'DLX',
        name: 'Deluxe Room',
        description: 'Spacious deluxe room',
        shortDescription: 'Deluxe room',
        baseRate: 7500,
        totalRooms: 25,
        specifications: {
          maxOccupancy: 3,
          bedType: 'queen',
          bedCount: 1,
          roomSize: 35,
          view: 'city',
          smokingPolicy: 'non_smoking'
        },
        hotelId,
        isActive: true,
        isPublished: true,
        category: 'deluxe',
        rank: 2
      },
      {
        code: 'SUITE',
        name: 'Executive Suite',
        description: 'Luxurious suite',
        shortDescription: 'Executive suite',
        baseRate: 12000,
        totalRooms: 30,
        specifications: {
          maxOccupancy: 4,
          bedType: 'king',
          bedCount: 1,
          roomSize: 60,
          view: 'city',
          smokingPolicy: 'non_smoking'
        },
        hotelId,
        isActive: true,
        isPublished: true,
        category: 'suite',
        rank: 3
      },
      {
        code: 'PRES',
        name: 'Presidential Suite',
        description: 'Ultimate luxury suite',
        shortDescription: 'Presidential suite',
        baseRate: 25000,
        totalRooms: 15,
        specifications: {
          maxOccupancy: 6,
          bedType: 'king',
          bedCount: 2,
          roomSize: 120,
          view: 'city',
          smokingPolicy: 'non_smoking'
        },
        hotelId,
        isActive: true,
        isPublished: true,
        category: 'premium',
        rank: 4
      }
    ];
    
    const createdRoomTypes = [];
    for (const roomType of roomTypes) {
      const created = await RoomType.findOneAndUpdate(
        { code: roomType.code, hotelId },
        roomType,
        { upsert: true, new: true }
      );
      createdRoomTypes.push(created);
    }
    console.log(`✅ Created/Updated ${createdRoomTypes.length} Room Types`);

    // Step 8: Create Rooms (100 rooms)
    console.log('\n🚪 Creating 100 Rooms...');
    const existingRooms = await Room.countDocuments({ hotelId });
    if (existingRooms < 100) {
      const rooms = [];
      let roomNumber = 101;
      
      for (let i = 0; i < 100; i++) {
        const roomType = createdRoomTypes[i % createdRoomTypes.length];
        const floor = Math.floor(roomNumber / 100);
        
        rooms.push({
          hotelId,
          roomNumber: roomNumber.toString(),
          roomTypeId: roomType._id,
          type: ['single', 'double', 'suite', 'deluxe'][i % 4],
          baseRate: roomType.baseRate,
          currentRate: roomType.baseRate,
          status: 'vacant',
          floor,
          capacity: roomType.specifications.maxOccupancy,
          amenities: ['WiFi', 'TV', 'AC', 'Mini Bar'],
          isActive: true
        });
        roomNumber++;
      }
      
      // Only create rooms that don't exist
      for (const room of rooms) {
        await Room.findOneAndUpdate(
          { roomNumber: room.roomNumber, hotelId },
          room,
          { upsert: true, new: true }
        );
      }
    }
    const totalRooms = await Room.countDocuments({ hotelId });
    console.log(`✅ Total Rooms: ${totalRooms}`);

    // Step 9: Create Payment Methods
    console.log('\n💳 Creating Payment Methods...');
    const paymentMethods = [
      { code: 'CASH', name: 'Cash', type: 'cash', hotelId, isActive: true },
      { code: 'CC', name: 'Credit Card', type: 'card', hotelId, isActive: true },
      { code: 'DC', name: 'Debit Card', type: 'card', hotelId, isActive: true },
      { code: 'UPI', name: 'UPI', type: 'digital', hotelId, isActive: true },
      { code: 'NB', name: 'Net Banking', type: 'bank_transfer', hotelId, isActive: true },
      { code: 'WALLET', name: 'Digital Wallet', type: 'digital', hotelId, isActive: true }
    ];
    for (const pm of paymentMethods) {
      await PaymentMethod.findOneAndUpdate(
        { code: pm.code, hotelId },
        pm,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Payment Methods');

    // Step 10: Create POS Outlets
    console.log('\n🍽️ Creating POS Outlets...');
    const posOutlets = [
      {
        name: 'Main Restaurant',
        code: 'REST',
        hotelId,
        type: 'restaurant',
        location: 'Ground Floor',
        isActive: true,
        operatingHours: {
          monday: { open: '07:00', close: '23:00' },
          tuesday: { open: '07:00', close: '23:00' },
          wednesday: { open: '07:00', close: '23:00' },
          thursday: { open: '07:00', close: '23:00' },
          friday: { open: '07:00', close: '23:00' },
          saturday: { open: '07:00', close: '23:00' },
          sunday: { open: '07:00', close: '23:00' }
        }
      },
      {
        name: 'Pool Bar',
        code: 'BAR',
        hotelId,
        type: 'bar',
        location: 'Pool Side',
        isActive: true,
        operatingHours: {
          monday: { open: '11:00', close: '22:00' },
          tuesday: { open: '11:00', close: '22:00' },
          wednesday: { open: '11:00', close: '22:00' },
          thursday: { open: '11:00', close: '22:00' },
          friday: { open: '11:00', close: '23:00' },
          saturday: { open: '11:00', close: '23:00' },
          sunday: { open: '11:00', close: '22:00' }
        }
      },
      {
        name: 'Room Service',
        code: 'RS',
        hotelId,
        type: 'room_service',
        location: 'All Floors',
        isActive: true,
        operatingHours: {
          monday: { open: '00:00', close: '23:59' },
          tuesday: { open: '00:00', close: '23:59' },
          wednesday: { open: '00:00', close: '23:59' },
          thursday: { open: '00:00', close: '23:59' },
          friday: { open: '00:00', close: '23:59' },
          saturday: { open: '00:00', close: '23:59' },
          sunday: { open: '00:00', close: '23:59' }
        }
      }
    ];
    const createdOutlets = [];
    for (const outlet of posOutlets) {
      const created = await POSOutlet.findOneAndUpdate(
        { code: outlet.code, hotelId },
        outlet,
        { upsert: true, new: true }
      );
      createdOutlets.push(created);
    }
    console.log(`✅ Created/Updated ${createdOutlets.length} POS Outlets`);

    // Step 11: Create POS Menu Items
    console.log('\n🍔 Creating POS Menu Items...');
    const menuItems = [
      { itemId: 'BF001', name: 'Continental Breakfast', category: 'Breakfast', price: 750, hotelId, isActive: true },
      { itemId: 'BF002', name: 'Indian Breakfast', category: 'Breakfast', price: 650, hotelId, isActive: true },
      { itemId: 'ST001', name: 'Paneer Tikka', category: 'Starters', price: 450, hotelId, isActive: true },
      { itemId: 'ST002', name: 'Chicken Wings', category: 'Starters', price: 550, hotelId, isActive: true },
      { itemId: 'MC001', name: 'Butter Chicken', category: 'Main Course', price: 750, hotelId, isActive: true },
      { itemId: 'MC002', name: 'Dal Makhani', category: 'Main Course', price: 550, hotelId, isActive: true },
      { itemId: 'MC003', name: 'Grilled Fish', category: 'Main Course', price: 950, hotelId, isActive: true },
      { itemId: 'BV001', name: 'Fresh Juice', category: 'Beverages', price: 250, hotelId, isActive: true },
      { itemId: 'BV002', name: 'Coffee', category: 'Beverages', price: 200, hotelId, isActive: true },
      { itemId: 'DS001', name: 'Chocolate Brownie', category: 'Desserts', price: 350, hotelId, isActive: true }
    ];
    for (const item of menuItems) {
      await POSMenu.findOneAndUpdate(
        { itemId: item.itemId, hotelId },
        item,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated POS Menu Items');

    // Step 12: Create POS Tax
    console.log('\n💰 Creating POS Tax...');
    const posTaxes = [
      { name: 'CGST', code: 'CGST', rate: 9, type: 'percentage', hotelId, isActive: true },
      { name: 'SGST', code: 'SGST', rate: 9, type: 'percentage', hotelId, isActive: true },
      { name: 'Service Charge', code: 'SC', rate: 10, type: 'percentage', hotelId, isActive: true }
    ];
    for (const tax of posTaxes) {
      await POSTax.findOneAndUpdate(
        { code: tax.code, hotelId },
        tax,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated POS Taxes');

    // Step 13: Create Hotel Services
    console.log('\n🛎️ Creating Hotel Services...');
    const hotelServices = [
      { name: 'Spa Treatment', code: 'SPA', hotelId, category: 'wellness', description: 'Relaxing spa', basePrice: 3000, duration: 60, isActive: true },
      { name: 'Airport Transfer', code: 'AIRPORT', hotelId, category: 'transport', description: 'Airport pickup/drop', basePrice: 2000, duration: 60, isActive: true },
      { name: 'Laundry Service', code: 'LAUNDRY', hotelId, category: 'housekeeping', description: 'Express laundry', basePrice: 500, duration: 24, isActive: true },
      { name: 'City Tour', code: 'TOUR', hotelId, category: 'concierge', description: 'Guided city tour', basePrice: 1500, duration: 240, isActive: true },
      { name: 'Gym Access', code: 'GYM', hotelId, category: 'fitness', description: 'Fitness center access', basePrice: 500, duration: 60, isActive: true }
    ];
    for (const service of hotelServices) {
      await HotelService.findOneAndUpdate(
        { code: service.code, hotelId },
        service,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Hotel Services');

    // Step 14: Create Add-on Services
    console.log('\n➕ Creating Add-on Services...');
    const addOnServices = [
      { name: 'Extra Bed', code: 'EB', description: 'Additional bed', price: 1000, hotelId, isActive: true },
      { name: 'Late Checkout', code: 'LC', description: 'Checkout until 2 PM', price: 500, hotelId, isActive: true },
      { name: 'Early Checkin', code: 'EC', description: 'Checkin from 10 AM', price: 500, hotelId, isActive: true },
      { name: 'Breakfast', code: 'BRK', description: 'Continental breakfast', price: 750, hotelId, isActive: true }
    ];
    for (const addon of addOnServices) {
      await AddOnService.findOneAndUpdate(
        { code: addon.code, hotelId },
        addon,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Add-on Services');

    // Step 15: Create Inventory Items
    console.log('\n📦 Creating Inventory Items...');
    const inventoryItems = [
      { name: 'Bath Towel', code: 'BT', category: 'Linen', unit: 'piece', minStock: 200, currentStock: 500, hotelId, isActive: true },
      { name: 'Hand Towel', code: 'HT', category: 'Linen', unit: 'piece', minStock: 200, currentStock: 400, hotelId, isActive: true },
      { name: 'Bed Sheet', code: 'BS', category: 'Linen', unit: 'piece', minStock: 200, currentStock: 450, hotelId, isActive: true },
      { name: 'Pillow Cover', code: 'PC', category: 'Linen', unit: 'piece', minStock: 200, currentStock: 400, hotelId, isActive: true },
      { name: 'Shampoo', code: 'SH', category: 'Toiletries', unit: 'bottle', minStock: 100, currentStock: 300, hotelId, isActive: true },
      { name: 'Soap', code: 'SP', category: 'Toiletries', unit: 'piece', minStock: 200, currentStock: 500, hotelId, isActive: true },
      { name: 'Toilet Paper', code: 'TP', category: 'Toiletries', unit: 'roll', minStock: 300, currentStock: 800, hotelId, isActive: true },
      { name: 'Mineral Water', code: 'MW', category: 'Minibar', unit: 'bottle', minStock: 200, currentStock: 600, hotelId, isActive: true }
    ];
    for (const item of inventoryItems) {
      await InventoryItem.findOneAndUpdate(
        { code: item.code, hotelId },
        item,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Inventory Items');

    // Step 16: Create Revenue Accounts
    console.log('\n💵 Creating Revenue Accounts...');
    const revenueAccounts = [
      { code: 'ROOM', name: 'Room Revenue', category: 'accommodation', hotelId, isActive: true },
      { code: 'FB', name: 'Food & Beverage', category: 'dining', hotelId, isActive: true },
      { code: 'SPA', name: 'Spa Revenue', category: 'wellness', hotelId, isActive: true },
      { code: 'LAUNDRY', name: 'Laundry Revenue', category: 'services', hotelId, isActive: true },
      { code: 'MISC', name: 'Miscellaneous', category: 'other', hotelId, isActive: true }
    ];
    for (const account of revenueAccounts) {
      await RevenueAccount.findOneAndUpdate(
        { code: account.code, hotelId },
        account,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Revenue Accounts');

    // Step 17: Create Room Tax
    console.log('\n🧾 Creating Room Taxes...');
    const roomTaxes = [
      { name: 'GST', code: 'GST', rate: 18, type: 'percentage', hotelId, isActive: true },
      { name: 'City Tax', code: 'CITY', rate: 2, type: 'percentage', hotelId, isActive: true },
      { name: 'Tourism Fee', code: 'TOUR', rate: 100, type: 'fixed', hotelId, isActive: true }
    ];
    for (const tax of roomTaxes) {
      await RoomTax.findOneAndUpdate(
        { code: tax.code, hotelId },
        tax,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Room Taxes');

    // Step 18: Create Measurement Units
    console.log('\n📏 Creating Measurement Units...');
    const units = [
      { code: 'PC', name: 'Piece', category: 'quantity', isActive: true },
      { code: 'KG', name: 'Kilogram', category: 'weight', isActive: true },
      { code: 'L', name: 'Liter', category: 'volume', isActive: true },
      { code: 'BOX', name: 'Box', category: 'quantity', isActive: true },
      { code: 'BOTTLE', name: 'Bottle', category: 'quantity', isActive: true }
    ];
    for (const unit of units) {
      await MeasurementUnit.findOneAndUpdate(
        { code: unit.code },
        unit,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Measurement Units');

    // Step 19: Create Languages
    console.log('\n🌐 Creating Languages...');
    const languages = [
      { code: 'EN', name: 'English', nativeName: 'English', isActive: true },
      { code: 'HI', name: 'Hindi', nativeName: 'हिन्दी', isActive: true },
      { code: 'FR', name: 'French', nativeName: 'Français', isActive: true },
      { code: 'DE', name: 'German', nativeName: 'Deutsch', isActive: true },
      { code: 'ES', name: 'Spanish', nativeName: 'Español', isActive: true }
    ];
    for (const lang of languages) {
      await Language.findOneAndUpdate(
        { code: lang.code },
        lang,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Languages');

    // Step 20: Create Currencies
    console.log('\n💱 Creating Currencies...');
    const currencies = [
      { code: 'INR', name: 'Indian Rupee', symbol: '₹', exchangeRate: 1, isActive: true },
      { code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 83.5, isActive: true },
      { code: 'EUR', name: 'Euro', symbol: '€', exchangeRate: 90.2, isActive: true },
      { code: 'GBP', name: 'British Pound', symbol: '£', exchangeRate: 105.8, isActive: true }
    ];
    for (const curr of currencies) {
      await Currency.findOneAndUpdate(
        { code: curr.code },
        curr,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Currencies');

    // Step 21: Create Guest Types
    console.log('\n👥 Creating Guest Types...');
    const guestTypes = [
      { name: 'Individual', code: 'IND', description: 'Single guest', hotelId, isActive: true },
      { name: 'Corporate', code: 'CORP', description: 'Business traveler', hotelId, isActive: true },
      { name: 'Group', code: 'GRP', description: 'Group booking', hotelId, isActive: true },
      { name: 'VIP', code: 'VIP', description: 'VIP guest', hotelId, isActive: true }
    ];
    for (const type of guestTypes) {
      await GuestType.findOneAndUpdate(
        { code: type.code, hotelId },
        type,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Guest Types');

    // Step 22: Create Market Segments
    console.log('\n📊 Creating Market Segments...');
    const marketSegments = [
      { name: 'Leisure', code: 'LEI', description: 'Vacation travelers', hotelId, isActive: true },
      { name: 'Business', code: 'BUS', description: 'Business travelers', hotelId, isActive: true },
      { name: 'Corporate', code: 'CORP', description: 'Corporate bookings', hotelId, isActive: true },
      { name: 'Online', code: 'ONL', description: 'Online bookings', hotelId, isActive: true }
    ];
    for (const segment of marketSegments) {
      await MarketSegment.findOneAndUpdate(
        { code: segment.code, hotelId },
        segment,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Market Segments');

    // Step 23: Create Identification Types
    console.log('\n🆔 Creating Identification Types...');
    const idTypes = [
      { name: 'Passport', code: 'PASS', description: 'International passport', hotelId, isActive: true },
      { name: 'Aadhaar Card', code: 'AADH', description: 'Indian Aadhaar card', hotelId, isActive: true },
      { name: 'Driving License', code: 'DL', description: 'Driving license', hotelId, isActive: true },
      { name: 'PAN Card', code: 'PAN', description: 'PAN card', hotelId, isActive: true }
    ];
    for (const idType of idTypes) {
      await IdentificationType.findOneAndUpdate(
        { code: idType.code, hotelId },
        idType,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Identification Types');

    // Step 24: Create Arrival/Departure Modes
    console.log('\n🚗 Creating Arrival/Departure Modes...');
    const modes = [
      { name: 'Car', code: 'CAR', type: 'arrival', hotelId, isActive: true },
      { name: 'Taxi', code: 'TAXI', type: 'arrival', hotelId, isActive: true },
      { name: 'Flight', code: 'FLT', type: 'arrival', hotelId, isActive: true },
      { name: 'Train', code: 'TRN', type: 'arrival', hotelId, isActive: true }
    ];
    for (const mode of modes) {
      await ArrivalDepartureMode.findOneAndUpdate(
        { code: mode.code, hotelId },
        mode,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Arrival/Departure Modes');

    // Step 25: Create Job Types
    console.log('\n💼 Creating Job Types...');
    const jobTypes = [
      { name: 'Manager', code: 'MGR', department: createdDepartments[0]._id, hotelId, isActive: true },
      { name: 'Supervisor', code: 'SUP', department: createdDepartments[0]._id, hotelId, isActive: true },
      { name: 'Staff', code: 'STF', department: createdDepartments[0]._id, hotelId, isActive: true },
      { name: 'Trainee', code: 'TRN', department: createdDepartments[0]._id, hotelId, isActive: true }
    ];
    for (const job of jobTypes) {
      await JobType.findOneAndUpdate(
        { code: job.code, hotelId },
        job,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Job Types');

    // Step 26: Create Reasons
    console.log('\n📝 Creating Reasons...');
    const reasons = [
      { name: 'Guest Request', code: 'GR', type: 'cancellation', hotelId, isActive: true },
      { name: 'No Show', code: 'NS', type: 'cancellation', hotelId, isActive: true },
      { name: 'Maintenance', code: 'MNT', type: 'block', hotelId, isActive: true },
      { name: 'VIP Guest', code: 'VIP', type: 'upgrade', hotelId, isActive: true }
    ];
    for (const reason of reasons) {
      await Reason.findOneAndUpdate(
        { code: reason.code, hotelId },
        reason,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Reasons');

    // Step 27: Create Bill Messages
    console.log('\n📄 Creating Bill Messages...');
    const billMessages = [
      { name: 'Thank You', code: 'TY', message: 'Thank you for choosing our hotel!', position: 'footer', hotelId, isActive: true },
      { name: 'GST Info', code: 'GST', message: 'GST No: 27AAACT2727Q1Z5', position: 'header', hotelId, isActive: true },
      { name: 'Terms', code: 'TRM', message: 'Check-out time is 11:00 AM', position: 'footer', hotelId, isActive: true }
    ];
    for (const msg of billMessages) {
      await BillMessage.findOneAndUpdate(
        { code: msg.code, hotelId },
        msg,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Bill Messages');

    // Step 28: Create Local Attractions
    console.log('\n🏛️ Creating Local Attractions...');
    const attractions = [
      { name: 'Gateway of India', description: 'Historic monument', distance: 2.5, category: 'monument', hotelId, isActive: true },
      { name: 'Marine Drive', description: 'Scenic waterfront', distance: 1.8, category: 'scenic', hotelId, isActive: true },
      { name: 'Juhu Beach', description: 'Popular beach', distance: 8.5, category: 'beach', hotelId, isActive: true },
      { name: 'Shopping Mall', description: 'Modern shopping center', distance: 1.2, category: 'shopping', hotelId, isActive: true }
    ];
    for (const attraction of attractions) {
      await LocalAttraction.findOneAndUpdate(
        { name: attraction.name, hotelId },
        attraction,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Local Attractions');

    // Step 29: Create Offers
    console.log('\n🎁 Creating Offers...');
    const offers = [
      {
        name: 'Early Bird',
        code: 'EB',
        description: '10% off for advance booking',
        discountType: 'percentage',
        discountValue: 10,
        validFrom: new Date(),
        validTo: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        hotelId,
        isActive: true
      },
      {
        name: 'Weekend Special',
        code: 'WS',
        description: '15% off on weekends',
        discountType: 'percentage',
        discountValue: 15,
        validFrom: new Date(),
        validTo: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        hotelId,
        isActive: true
      }
    ];
    for (const offer of offers) {
      await Offer.findOneAndUpdate(
        { code: offer.code, hotelId },
        offer,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Offers');

    // Step 30: Create Seasons
    console.log('\n🌴 Creating Seasons...');
    const seasons = [
      {
        name: 'Peak Season',
        code: 'PEAK',
        description: 'High demand period',
        startDate: new Date('2024-12-01'),
        endDate: new Date('2025-01-31'),
        hotelId,
        isActive: true
      },
      {
        name: 'Low Season',
        code: 'LOW',
        description: 'Low demand period',
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-08-31'),
        hotelId,
        isActive: true
      }
    ];
    for (const season of seasons) {
      await Season.findOneAndUpdate(
        { code: season.code, hotelId },
        season,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Seasons');

    // Step 31: Create Message Templates
    console.log('\n✉️ Creating Message Templates...');
    const messageTemplates = [
      {
        name: 'Booking Confirmation',
        code: 'BOOK_CONF',
        type: 'email',
        subject: 'Booking Confirmation - {{bookingNumber}}',
        body: 'Dear {{guestName}}, Your booking has been confirmed.',
        hotelId,
        isActive: true
      },
      {
        name: 'Check-in Reminder',
        code: 'CHECKIN',
        type: 'sms',
        subject: 'Check-in Reminder',
        body: 'Welcome! Your check-in time is {{checkInTime}}.',
        hotelId,
        isActive: true
      }
    ];
    for (const template of messageTemplates) {
      await MessageTemplate.findOneAndUpdate(
        { code: template.code, hotelId },
        template,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Message Templates');

    // Step 32: Create Corporate Companies
    console.log('\n🏢 Creating Corporate Companies...');
    const companies = [
      {
        name: 'Tech Corp',
        code: 'TECH',
        contactPerson: 'John Doe',
        email: 'john@techcorp.com',
        phone: '+91-9876543210',
        address: 'Mumbai',
        creditLimit: 500000,
        hotelId,
        isActive: true
      },
      {
        name: 'Finance Ltd',
        code: 'FIN',
        contactPerson: 'Jane Smith',
        email: 'jane@financeltd.com',
        phone: '+91-9876543211',
        address: 'Delhi',
        creditLimit: 300000,
        hotelId,
        isActive: true
      }
    ];
    for (const company of companies) {
      await CorporateCompany.findOneAndUpdate(
        { code: company.code, hotelId },
        company,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Corporate Companies');

    // Step 33: Create Bank Accounts
    console.log('\n🏦 Creating Bank Accounts...');
    const bankAccounts = [
      {
        accountName: 'THE PENTOUZ Main Account',
        accountNumber: '1234567890',
        bankName: 'State Bank of India',
        branch: 'Mumbai Main',
        ifscCode: 'SBIN0001234',
        accountType: 'current',
        currency: 'INR',
        hotelId,
        isActive: true
      }
    ];
    for (const account of bankAccounts) {
      await BankAccount.findOneAndUpdate(
        { accountNumber: account.accountNumber, hotelId },
        account,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Bank Accounts');

    // Step 34: Create Chart of Accounts
    console.log('\n📊 Creating Chart of Accounts...');
    const chartAccounts = [
      { code: '1000', name: 'Assets', type: 'asset', parentCode: null, hotelId, isActive: true },
      { code: '2000', name: 'Liabilities', type: 'liability', parentCode: null, hotelId, isActive: true },
      { code: '3000', name: 'Revenue', type: 'revenue', parentCode: null, hotelId, isActive: true },
      { code: '4000', name: 'Expenses', type: 'expense', parentCode: null, hotelId, isActive: true }
    ];
    for (const chart of chartAccounts) {
      await ChartOfAccounts.findOneAndUpdate(
        { code: chart.code, hotelId },
        chart,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Chart of Accounts');

    // Step 35: Create Phone Extensions
    console.log('\n📞 Creating Phone Extensions...');
    const phoneExtensions = [
      { extension: '100', department: 'Reception', location: 'Lobby', hotelId, isActive: true },
      { extension: '200', department: 'Room Service', location: 'Kitchen', hotelId, isActive: true },
      { extension: '300', department: 'Housekeeping', location: 'Floor 1', hotelId, isActive: true },
      { extension: '400', department: 'Concierge', location: 'Lobby', hotelId, isActive: true }
    ];
    for (const ext of phoneExtensions) {
      await PhoneExtension.findOneAndUpdate(
        { extension: ext.extension, hotelId },
        ext,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Phone Extensions');

    // Step 36: Create Room Charges
    console.log('\n💸 Creating Room Charges...');
    const roomCharges = [
      { name: 'Mini Bar', code: 'MB', type: 'consumable', amount: 0, hotelId, isActive: true },
      { name: 'Laundry', code: 'LDY', type: 'service', amount: 0, hotelId, isActive: true },
      { name: 'Room Service', code: 'RS', type: 'service', amount: 0, hotelId, isActive: true },
      { name: 'Telephone', code: 'TEL', type: 'usage', amount: 0, hotelId, isActive: true }
    ];
    for (const charge of roomCharges) {
      await RoomCharge.findOneAndUpdate(
        { code: charge.code, hotelId },
        charge,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Room Charges');

    // Step 37: Create Special Discounts
    console.log('\n🏷️ Creating Special Discounts...');
    const discounts = [
      {
        name: 'Senior Citizen',
        code: 'SR',
        discountType: 'percentage',
        discountValue: 10,
        applicableTo: 'room',
        hotelId,
        isActive: true
      },
      {
        name: 'Corporate Discount',
        code: 'CORP',
        discountType: 'percentage',
        discountValue: 15,
        applicableTo: 'room',
        hotelId,
        isActive: true
      }
    ];
    for (const discount of discounts) {
      await SpecialDiscount.findOneAndUpdate(
        { code: discount.code, hotelId },
        discount,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Special Discounts');

    // Step 38: Create Day Use Slots
    console.log('\n⏰ Creating Day Use Slots...');
    const dayUseSlots = [
      {
        name: 'Morning Slot',
        code: 'MORN',
        startTime: '06:00',
        endTime: '12:00',
        duration: 6,
        price: 2000,
        hotelId,
        isActive: true
      },
      {
        name: 'Afternoon Slot',
        code: 'AFTN',
        startTime: '12:00',
        endTime: '18:00',
        duration: 6,
        price: 2000,
        hotelId,
        isActive: true
      }
    ];
    for (const slot of dayUseSlots) {
      await DayUseSlot.findOneAndUpdate(
        { code: slot.code, hotelId },
        slot,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Day Use Slots');

    // Step 39: Create Custom Fields
    console.log('\n🔧 Creating Custom Fields...');
    const customFields = [
      {
        name: 'Anniversary Date',
        code: 'ANNIV',
        fieldType: 'date',
        entityType: 'guest',
        hotelId,
        isActive: true
      },
      {
        name: 'Dietary Preference',
        code: 'DIET',
        fieldType: 'select',
        entityType: 'guest',
        options: ['Vegetarian', 'Non-Vegetarian', 'Vegan', 'Gluten-Free'],
        hotelId,
        isActive: true
      }
    ];
    for (const field of customFields) {
      await CustomField.findOneAndUpdate(
        { code: field.code, hotelId },
        field,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Custom Fields');

    // Step 40: Create POS Attributes
    console.log('\n🍕 Creating POS Attributes...');
    const posAttributes = [
      {
        name: 'Size',
        code: 'SIZE',
        type: 'select',
        options: ['Small', 'Medium', 'Large'],
        hotelId,
        isActive: true
      },
      {
        name: 'Spice Level',
        code: 'SPICE',
        type: 'select',
        options: ['Mild', 'Medium', 'Hot', 'Extra Hot'],
        hotelId,
        isActive: true
      }
    ];
    for (const attr of posAttributes) {
      await POSAttribute.findOneAndUpdate(
        { code: attr.code, hotelId },
        attr,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated POS Attributes');

    // Step 41: Create Housekeeping Templates
    console.log('\n🧹 Creating Daily Routine Check Templates...');
    const checkTemplates = [
      {
        name: 'Room Cleaning Checklist',
        code: 'ROOM_CHK',
        category: 'housekeeping',
        checkItems: [
          { item: 'Bed Making', required: true },
          { item: 'Bathroom Cleaning', required: true },
          { item: 'Dusting', required: true },
          { item: 'Vacuuming', required: true },
          { item: 'Minibar Check', required: false }
        ],
        hotelId,
        isActive: true
      }
    ];
    for (const template of checkTemplates) {
      await DailyRoutineCheckTemplate.findOneAndUpdate(
        { code: template.code, hotelId },
        template,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Daily Routine Check Templates');

    // Step 42: Create Room Inventory Templates
    console.log('\n📋 Creating Room Inventory Templates...');
    const roomInvTemplates = [
      {
        name: 'Standard Room Inventory',
        code: 'STD_INV',
        items: [
          { itemName: 'Towels', quantity: 4 },
          { itemName: 'Bed Sheets', quantity: 2 },
          { itemName: 'Pillows', quantity: 2 },
          { itemName: 'Toiletries Set', quantity: 1 }
        ],
        hotelId,
        isActive: true
      }
    ];
    for (const template of roomInvTemplates) {
      await RoomInventoryTemplate.findOneAndUpdate(
        { code: template.code, hotelId },
        template,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Room Inventory Templates');

    // Step 43: Create Shared Resources
    console.log('\n🏊 Creating Shared Resources...');
    const sharedResources = [
      {
        name: 'Swimming Pool',
        code: 'POOL',
        type: 'facility',
        capacity: 50,
        location: 'Ground Floor',
        hotelId,
        isActive: true
      },
      {
        name: 'Conference Room A',
        code: 'CONF_A',
        type: 'meeting_room',
        capacity: 20,
        location: 'First Floor',
        hotelId,
        isActive: true
      }
    ];
    for (const resource of sharedResources) {
      await SharedResource.findOneAndUpdate(
        { code: resource.code, hotelId },
        resource,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Shared Resources');

    // Step 44: Create Service Inclusions
    console.log('\n✅ Creating Service Inclusions...');
    const inclusions = [
      {
        name: 'Breakfast Included',
        code: 'BRK_INC',
        description: 'Complimentary breakfast',
        type: 'meal',
        hotelId,
        isActive: true
      },
      {
        name: 'Airport Transfer',
        code: 'AIR_INC',
        description: 'Free airport pickup',
        type: 'transport',
        hotelId,
        isActive: true
      }
    ];
    for (const inclusion of inclusions) {
      await ServiceInclusion.findOneAndUpdate(
        { code: inclusion.code, hotelId },
        inclusion,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Service Inclusions');

    // Step 45: Create Account Attributes
    console.log('\n📊 Creating Account Attributes...');
    const accountAttrs = [
      {
        name: 'Loyalty Member',
        code: 'LOYAL',
        type: 'boolean',
        defaultValue: 'false',
        hotelId,
        isActive: true
      },
      {
        name: 'Credit Rating',
        code: 'CREDIT',
        type: 'select',
        options: ['Excellent', 'Good', 'Fair', 'Poor'],
        hotelId,
        isActive: true
      }
    ];
    for (const attr of accountAttrs) {
      await AccountAttribute.findOneAndUpdate(
        { code: attr.code, hotelId },
        attr,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Account Attributes');

    // Step 46: Create Special Periods
    console.log('\n📅 Creating Special Periods...');
    const specialPeriods = [
      {
        name: 'Christmas Week',
        code: 'XMAS',
        startDate: new Date('2024-12-24'),
        endDate: new Date('2024-12-31'),
        type: 'holiday',
        rateMultiplier: 1.5,
        hotelId,
        isActive: true
      },
      {
        name: 'New Year',
        code: 'NY',
        startDate: new Date('2024-12-31'),
        endDate: new Date('2025-01-02'),
        type: 'holiday',
        rateMultiplier: 2.0,
        hotelId,
        isActive: true
      }
    ];
    for (const period of specialPeriods) {
      await SpecialPeriod.findOneAndUpdate(
        { code: period.code, hotelId },
        period,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Special Periods');

    // Step 47: Create Sample KPIs
    console.log('\n📈 Creating KPIs...');
    const today = new Date();
    const kpis = {
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
    };
    await KPI.findOneAndUpdate(
      { hotelId, date: today },
      kpis,
      { upsert: true, new: true }
    );
    console.log('✅ Created/Updated KPIs');

    // Step 48: Create Sample Bookings
    console.log('\n📅 Creating Sample Bookings...');
    const rooms = await Room.find({ hotelId }).limit(10);
    const bookingCount = await Booking.countDocuments({ hotelId });
    
    if (bookingCount < 10 && rooms.length > 0) {
      const bookings = [];
      for (let i = 0; i < Math.min(10, rooms.length); i++) {
        const checkIn = new Date(Date.now() + i * 24 * 60 * 60 * 1000);
        const checkOut = new Date(checkIn.getTime() + 2 * 24 * 60 * 60 * 1000);
        
        bookings.push({
          hotelId,
          userId,
          rooms: [{
            roomId: rooms[i]._id,
            rate: rooms[i].currentRate || 5000
          }],
          checkIn,
          checkOut,
          nights: 2,
          status: 'confirmed',
          paymentStatus: 'pending',
          totalAmount: (rooms[i].currentRate || 5000) * 2,
          currency: 'INR',
          source: 'direct',
          guestDetails: {
            adults: 2,
            children: 0
          },
          bookingNumber: `BK${Date.now()}${i}`,
          idempotencyKey: `seed-${Date.now()}-${i}`
        });
      }
      
      for (const booking of bookings) {
        await Booking.findOneAndUpdate(
          { bookingNumber: booking.bookingNumber },
          booking,
          { upsert: true, new: true }
        );
      }
      console.log(`✅ Created/Updated ${bookings.length} sample bookings`);
    }

    // Step 49: Create Room Availability
    console.log('\n📊 Creating Room Availability...');
    const nextDays = 30;
    for (let day = 0; day < nextDays; day++) {
      const date = new Date(Date.now() + day * 24 * 60 * 60 * 1000);
      
      for (const roomType of createdRoomTypes) {
        await RoomAvailability.findOneAndUpdate(
          { hotelId, roomTypeId: roomType._id, date },
          {
            hotelId,
            roomTypeId: roomType._id,
            date,
            totalRooms: roomType.totalRooms,
            availableRooms: Math.floor(roomType.totalRooms * 0.7),
            soldRooms: Math.floor(roomType.totalRooms * 0.3),
            blockedRooms: 0,
            baseRate: roomType.baseRate,
            sellingRate: roomType.baseRate * (day < 7 ? 1.2 : 1),
            currency: 'INR'
          },
          { upsert: true, new: true }
        );
      }
    }
    console.log('✅ Created/Updated Room Availability for next 30 days');

    // Step 50: Create Pricing Strategies
    console.log('\n💰 Creating Pricing Strategies...');
    const pricingStrategies = [
      {
        name: 'Dynamic Pricing',
        code: 'DYN',
        type: 'dynamic',
        baseMultiplier: 1.0,
        rules: {
          occupancy: { above80: 1.3, above60: 1.15, below40: 0.85 },
          dayOfWeek: { weekend: 1.2, weekday: 1.0 },
          advance: { lastMinute: 0.9, earlyBird: 0.85 }
        },
        hotelId,
        isActive: true
      }
    ];
    for (const strategy of pricingStrategies) {
      await PricingStrategy.findOneAndUpdate(
        { code: strategy.code, hotelId },
        strategy,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Created/Updated Pricing Strategies');

    // Final Summary
    console.log('\n' + '='.repeat(70));
    console.log('🎉 COMPREHENSIVE DATA SEEDING COMPLETED!');
    console.log('='.repeat(70));
    console.log('📊 Summary:');
    console.log(`   🏨 Hotel: ${mainHotel.name}`);
    console.log(`   👤 Admin User: admin@hotel.com (password: admin123)`);
    console.log(`   🚪 Total Rooms: ${await Room.countDocuments({ hotelId })}`);
    console.log(`   📝 Total Models Seeded: 50+`);
    console.log('='.repeat(70));
    console.log('\n✅ All data has been added/updated without deleting existing records');
    console.log('✅ All models have consistent hotelId references');
    console.log('✅ You can now use the Multi-Property Manager with complete data!');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
};

const main = async () => {
  try {
    await connectDB();
    await seedComprehensiveData();
    await mongoose.connection.close();
    console.log('🔒 Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the script
main();