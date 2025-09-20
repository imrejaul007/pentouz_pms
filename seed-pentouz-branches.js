import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Import ALL models that have default exports
import User from './src/models/User.js';
import Hotel from './src/models/Hotel.js';
import Room from './src/models/Room.js';
import RoomType from './src/models/RoomType.js';
import Booking from './src/models/Booking.js';
import PropertyGroup from './src/models/PropertyGroup.js';
import RoomAvailability from './src/models/RoomAvailability.js';
import WebSettings from './src/models/WebSettings.js';
import BookingFormTemplate from './src/models/BookingFormTemplate.js';
import AuditLog from './src/models/AuditLog.js';
import APIKey from './src/models/APIKey.js';
import WebhookEndpoint from './src/models/WebhookEndpoint.js';
import APIMetrics from './src/models/APIMetrics.js';
import Payment from './src/models/Payment.js';
import PaymentMethod from './src/models/PaymentMethod.js';
import Invoice from './src/models/Invoice.js';
import Review from './src/models/Review.js';
import Notification from './src/models/Notification.js';
import MessageTemplate from './src/models/MessageTemplate.js';
import GuestService from './src/models/GuestService.js';
import HotelService from './src/models/HotelService.js';
import MaintenanceTask from './src/models/MaintenanceTask.js';
import Housekeeping from './src/models/Housekeeping.js';
import Inventory from './src/models/Inventory.js';
import InventoryItem from './src/models/InventoryItem.js';
import InventoryTransaction from './src/models/InventoryTransaction.js';
import Offer from './src/models/Offer.js';
import SpecialDiscount from './src/models/SpecialDiscount.js';
import Season from './src/models/Season.js';
import PricingStrategy from './src/models/PricingStrategy.js';
// RateManagement and ChannelManager have named exports
import ChannelConfiguration from './src/models/ChannelConfiguration.js';
import OTAPayload from './src/models/OTAPayload.js';
import SyncHistory from './src/models/SyncHistory.js';
import RevenueReport from './src/models/RevenueReport.js';
import KPI from './src/models/KPI.js';
import Department from './src/models/Department.js';
import StaffTask from './src/models/StaffTask.js';
import GuestType from './src/models/GuestType.js';
import MarketSegment from './src/models/MarketSegment.js';
import Loyalty from './src/models/Loyalty.js';
import VIPGuest from './src/models/VIPGuest.js';
import GuestBlacklist from './src/models/GuestBlacklist.js';
import GuestCustomData from './src/models/GuestCustomData.js';
import Communication from './src/models/Communication.js';
import IncidentReport from './src/models/IncidentReport.js';
import LostFound from './src/models/LostFound.js';
import LaundryTransaction from './src/models/LaundryTransaction.js';
import RoomCharge from './src/models/RoomCharge.js';
import ServiceBooking from './src/models/ServiceBooking.js';
import ServiceInclusion from './src/models/ServiceInclusion.js';
import AddOnService from './src/models/AddOnService.js';
import RoomFeature from './src/models/RoomFeature.js';
import RoomTax from './src/models/RoomTax.js';
import RoomTypeAllotment from './src/models/RoomTypeAllotment.js';
import StopSellRule from './src/models/StopSellRule.js';
import SpecialPeriod from './src/models/SpecialPeriod.js';
import DemandForecast from './src/models/DemandForecast.js';
import DynamicPricing from './src/models/DynamicPricing.js';
import CompetitorMonitoring from './src/models/CompetitorMonitoring.js';
import LocalAttraction from './src/models/LocalAttraction.js';
import Content from './src/models/Content.js';
import Translation from './src/models/Translation.js';
import Language from './src/models/Language.js';
import Currency from './src/models/Currency.js';
import MeasurementUnit from './src/models/MeasurementUnit.js';
import Salutation from './src/models/Salutation.js';
import IdentificationType from './src/models/IdentificationType.js';
import Reason from './src/models/Reason.js';
import JobType from './src/models/JobType.js';
import Counter from './src/models/Counter.js';
import PhoneExtension from './src/models/PhoneExtension.js';
import DigitalKey from './src/models/DigitalKey.js';
import CheckoutInspection from './src/models/CheckoutInspection.js';
import CheckoutInventory from './src/models/CheckoutInventory.js';
import DailyInventoryCheck from './src/models/DailyInventoryCheck.js';
import DailyRoutineCheck from './src/models/DailyRoutineCheck.js';
import DailyRoutineCheckTemplate from './src/models/DailyRoutineCheckTemplate.js';
import TapeChart from './src/models/TapeChart.js';
import TapeChartModels from './src/models/TapeChart.js';
const { RoomBlock, RoomAssignmentRules, AdvancedReservation } = TapeChartModels;
import GroupBooking from './src/models/GroupBooking.js';
import DayUseBooking from './src/models/DayUseBooking.js';
import DayUseSlot from './src/models/DayUseSlot.js';
import WebConfiguration from './src/models/WebConfiguration.js';
import NotificationPreference from './src/models/NotificationPreference.js';
import UserAnalytics from './src/models/UserAnalytics.js';
import LoginSession from './src/models/LoginSession.js';
import EventQueue from './src/models/EventQueue.js';
// EventSchema has named exports
import SharedResource from './src/models/SharedResource.js';
import SupplyRequest from './src/models/SupplyRequest.js';
import MeetUpRequest from './src/models/MeetUpRequest.js';
import HotelArea from './src/models/HotelArea.js';
import POSOutlet from './src/models/POSOutlet.js';
import POSMenu from './src/models/POSMenu.js';
import POSOrder from './src/models/POSOrder.js';
import POSItemVariant from './src/models/POSItemVariant.js';
import POSAttribute from './src/models/POSAttribute.js';
import POSAttributeValue from './src/models/POSAttributeValue.js';
import POSTax from './src/models/POSTax.js';
import FinancialInvoice from './src/models/FinancialInvoice.js';
import FinancialPayment from './src/models/FinancialPayment.js';
import GeneralLedger from './src/models/GeneralLedger.js';
import JournalEntry from './src/models/JournalEntry.js';
import ChartOfAccounts from './src/models/ChartOfAccounts.js';
import RevenueAccount from './src/models/RevenueAccount.js';
import BankAccount from './src/models/BankAccount.js';
import Budget from './src/models/Budget.js';
import BillingSession from './src/models/BillingSession.js';
import BillMessage from './src/models/BillMessage.js';
import AccountAttribute from './src/models/AccountAttribute.js';
import CorporateCompany from './src/models/CorporateCompany.js';
import CorporateCredit from './src/models/CorporateCredit.js';
import CentralizedRate from './src/models/CentralizedRate.js';
import RateMapping from './src/models/RateMapping.js';
import RoomInventory from './src/models/RoomInventory.js';
import RoomInventoryTemplate from './src/models/RoomInventoryTemplate.js';
import RoomMapping from './src/models/RoomMapping.js';
import ArrivalDepartureMode from './src/models/ArrivalDepartureMode.js';
import CustomField from './src/models/CustomField.js';
 
dotenv.config();

// Use the provided MongoDB connection string
const MONGO_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Database connected successfully for THE PENTOUZ branches seeding');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    
    process.exit(1);
  }
};

const seedPentouzBranches = async () => {
  try {
    console.log('🌱 Starting THE PENTOUZ multi-branch data seeding...');
    console.log('🏨 Creating multiple branches of THE PENTOUZ hotel...');

    // Generate a single ObjectId to use for both hotel and admin user
    const sharedObjectId = new mongoose.Types.ObjectId();
    
    // First, check if THE PENTOUZ hotel exists
    let mainHotel = await Hotel.findOne({ name: 'THE PENTOUZ' });
    if (!mainHotel) {
      console.log('🏨 THE PENTOUZ hotel not found in database, creating main hotel...');
      mainHotel = await Hotel.create({
        _id: sharedObjectId,
        name: 'THE PENTOUZ',
        description: 'Luxury hotel chain with premium amenities and exceptional service',
        type: 'hotel',
        address: {
          street: '123 Main Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          country: 'India',
          zipCode: '400001',
          coordinates: { latitude: 19.0760, longitude: 72.8777 }
        },
        contact: {
          phone: '+91-22-12345678',
          email: 'info@thepentouz.com',
          website: 'https://thepentouz.com'
        },
        amenities: ['WiFi', 'Pool', 'Spa', 'Restaurant', 'Gym', 'Parking'],
        rating: 4.5,
        isActive: true,
        ownerId: sharedObjectId,
        features: {
          pms: true,
          pos: true,
          spa: true,
          restaurant: true,
          parking: true,
          wifi: true,
          fitness: true,
          pool: true
        }
      });
    }
    console.log(`✅ Found/Created main hotel: ${mainHotel.name} (ID: ${mainHotel._id})`);

    // Get or create an admin user with the same _id as hotel
    let ownerUser = await User.findOne({ email: 'admin@hotel.com' });
    if (!ownerUser) {
      ownerUser = await User.create({
        _id: sharedObjectId, // Same _id as hotel
        name: 'Hotel Admin',
        email: 'admin@hotel.com',
        password: 'admin123', // Plain text - will be hashed by pre-save middleware
        role: 'admin',
        hotelId: mainHotel._id,
        isActive: true
      });
      console.log('✅ Created admin user as owner with same _id as hotel');
    } else if (ownerUser.hotelId.toString() !== mainHotel._id.toString()) {
      ownerUser.hotelId = mainHotel._id;
      await ownerUser.save();
      console.log('✅ Updated owner user with correct hotel ID');
    }
    console.log(`✅ Using admin user: ${ownerUser.email} (ID: ${ownerUser._id}, hotelId: ${ownerUser.hotelId})`);

    // Clear existing property groups and branches (keep main hotel)
    await PropertyGroup.deleteMany({});
    await Booking.deleteMany({});
    await Room.deleteMany({});
    await RoomType.deleteMany({});
    // Don't delete main hotel, but delete branches
    await Hotel.deleteMany({ 
      name: { $regex: /THE PENTOUZ/, $ne: 'THE PENTOUZ' }
    });
    await User.deleteMany({ 
      role: { $nin: ['super_admin', 'admin'] },
      email: { $regex: /@thepentouz\.com$/ }
    }); // Delete only THE PENTOUZ staff/guests, keep others

    // Create Property Groups for different branch categories
    const propertyGroups = [
      {
        name: 'THE PENTOUZ Metropolitan',
        groupType: 'chain',
        description: 'THE PENTOUZ branches in major metropolitan cities',
        ownerId: ownerUser._id,
        settings: {
          centralizedRates: true,
          baseCurrency: 'INR',
          supportedCurrencies: ['INR', 'USD', 'EUR'],
          rateManagement: {
            autoSync: true,
            conflictResolution: 'manual_resolve',
            requireApproval: false
          },
          brandGuidelines: {
            primaryColor: '#1a365d',
            secondaryColor: '#2d3748',
            websiteUrl: 'https://thepentouz.com'
          }
        },
        permissions: {
          allowCrossPropertyBookings: true,
          allowCrossPropertyTransfers: true,
          allowSharedStaff: false,
          allowSharedInventory: false
        }
      },
      {
        name: 'THE PENTOUZ Business District',
        groupType: 'chain',
        description: 'THE PENTOUZ branches in business and commercial areas',
        ownerId: ownerUser._id,
        settings: {
          centralizedRates: true,
          baseCurrency: 'INR',
          supportedCurrencies: ['INR', 'USD'],
          rateManagement: {
            autoSync: true,
            conflictResolution: 'centralized_wins',
            requireApproval: true
          },
          brandGuidelines: {
            primaryColor: '#2d3748',
            secondaryColor: '#4a5568',
            websiteUrl: 'https://thepentouz.com'
          }
        },
        permissions: {
          allowCrossPropertyBookings: true,
          allowCrossPropertyTransfers: true,
          allowSharedStaff: true,
          allowSharedInventory: false
        }
      },
      {
        name: 'THE PENTOUZ Resort Collection',
        groupType: 'chain',
        description: 'THE PENTOUZ resort properties in tourist destinations',
        ownerId: ownerUser._id,
        settings: {
          centralizedRates: false,
          baseCurrency: 'INR',
          supportedCurrencies: ['INR', 'USD', 'EUR', 'GBP'],
          rateManagement: {
            autoSync: false,
            conflictResolution: 'property_wins',
            requireApproval: false
          },
          brandGuidelines: {
            primaryColor: '#0d4f3c',
            secondaryColor: '#0f766e',
            websiteUrl: 'https://thepentouz.com'
          }
        },
        permissions: {
          allowCrossPropertyBookings: true,
          allowCrossPropertyTransfers: false,
          allowSharedStaff: false,
          allowSharedInventory: false
        }
      }
    ];

    const createdGroups = await PropertyGroup.create(propertyGroups);
    console.log(`✅ Created ${createdGroups.length} property groups for THE PENTOUZ branches`);

    // Create THE PENTOUZ branches in different locations
    const branchesData = [
      // Metropolitan branches
      {
        name: 'THE PENTOUZ Mumbai Central',
        description: 'THE PENTOUZ flagship branch in Mumbai Central business district',
        type: 'hotel',
        ownerId: ownerUser._id,
        address: {
          street: 'Bandra Kurla Complex',
          city: 'Mumbai',
          state: 'Maharashtra',
          country: 'India',
          zipCode: '400051',
          coordinates: { latitude: 19.0596, longitude: 72.8656 }
        },
        contact: {
          phone: '+91-22-28765432',
          email: 'mumbaicentral@thepentouz.com',
          website: 'https://thepentouz.com/mumbai-central'
        },
        amenities: ['WiFi', 'Pool', 'Spa', 'Restaurant', 'Gym', 'Parking', 'Business Center', 'Conference Rooms'],
        rating: 4.7,
        propertyGroupId: createdGroups[0]._id, // Metropolitan
        brand: 'THE PENTOUZ',
        features: {
          pms: true,
          pos: true,
          spa: true,
          restaurant: true,
          parking: true,
          wifi: true,
          fitness: true,
          pool: true
        }
      },
      {
        name: 'THE PENTOUZ Delhi NCR',
        description: 'THE PENTOUZ branch in the heart of Delhi NCR',
        type: 'hotel',
        ownerId: ownerUser._id,
        address: {
          street: 'Connaught Place',
          city: 'New Delhi',
          state: 'Delhi',
          country: 'India',
          zipCode: '110001',
          coordinates: { latitude: 28.6315, longitude: 77.2167 }
        },
        contact: {
          phone: '+91-11-28765432',
          email: 'delhi@thepentouz.com',
          website: 'https://thepentouz.com/delhi'
        },
        amenities: ['WiFi', 'Pool', 'Spa', 'Restaurant', 'Gym', 'Parking', 'Heritage Tours', 'Airport Shuttle'],
        rating: 4.6,
        propertyGroupId: createdGroups[0]._id, // Metropolitan
        brand: 'THE PENTOUZ',
        features: {
          pms: true,
          pos: true,
          spa: true,
          restaurant: true,
          parking: true,
          wifi: true,
          fitness: true,
          pool: true
        }
      },
      {
        name: 'THE PENTOUZ Bangalore Tech Hub',
        description: 'THE PENTOUZ branch in Bangalore technology corridor',
        type: 'hotel',
        ownerId: ownerUser._id,
        address: {
          street: 'Electronic City Phase 2',
          city: 'Bangalore',
          state: 'Karnataka',
          country: 'India',
          zipCode: '560100',
          coordinates: { latitude: 12.8456, longitude: 77.6603 }
        },
        contact: {
          phone: '+91-80-28765432',
          email: 'bangalore@thepentouz.com',
          website: 'https://thepentouz.com/bangalore'
        },
        amenities: ['WiFi', 'Business Center', 'Conference Rooms', 'Gym', 'Restaurant', 'Parking', 'Tech Support'],
        rating: 4.5,
        propertyGroupId: createdGroups[1]._id, // Business District
        brand: 'THE PENTOUZ',
        features: {
          pms: true,
          pos: true,
          spa: false,
          restaurant: true,
          parking: true,
          wifi: true,
          fitness: true,
          pool: false
        }
      },
      {
        name: 'THE PENTOUZ Chennai IT Corridor',
        description: 'THE PENTOUZ branch in Chennai IT corridor',
        type: 'hotel',
        address: {
          street: 'OMR IT Corridor',
          city: 'Chennai',
          state: 'Tamil Nadu',
          country: 'India',
          zipCode: '600096',
          coordinates: { latitude: 12.8996, longitude: 80.2209 }
        },
        contact: {
          phone: '+91-44-28765432',
          email: 'chennai@thepentouz.com',
          website: 'https://thepentouz.com/chennai'
        },
        amenities: ['WiFi', 'Business Center', 'Meeting Rooms', 'Gym', 'Restaurant', 'Parking', 'IT Services'],
        rating: 4.4,
        propertyGroupId: createdGroups[1]._id, // Business District
        brand: 'THE PENTOUZ',
        features: {
          pms: true,
          pos: true,
          spa: false,
          restaurant: true,
          parking: true,
          wifi: true,
          fitness: true,
          pool: false
        }
      },
      {
        name: 'THE PENTOUZ Goa Beach Resort',
        description: 'THE PENTOUZ luxury beach resort in North Goa',
        type: 'resort',
        address: {
          street: 'Calangute Beach Road',
          city: 'Goa',
          state: 'Goa',
          country: 'India',
          zipCode: '403516',
          coordinates: { latitude: 15.5400, longitude: 73.7500 }
        },
        contact: {
          phone: '+91-832-2876543',
          email: 'goa@thepentouz.com',
          website: 'https://thepentouz.com/goa'
        },
        amenities: ['WiFi', 'Beach Access', 'Pool', 'Spa', 'Restaurant', 'Water Sports', 'Parking', 'Beach Bar'],
        rating: 4.8,
        propertyGroupId: createdGroups[2]._id, // Resort Collection
        brand: 'THE PENTOUZ',
        features: {
          pms: true,
          pos: true,
          spa: true,
          restaurant: true,
          parking: true,
          wifi: true,
          fitness: true,
          pool: true
        }
      },
      {
        name: 'THE PENTOUZ Udaipur Lake Palace',
        description: 'THE PENTOUZ heritage property overlooking Lake Pichola',
        type: 'boutique',
        address: {
          street: 'Lake Palace Road',
          city: 'Udaipur',
          state: 'Rajasthan',
          country: 'India',
          zipCode: '313001',
          coordinates: { latitude: 24.5854, longitude: 73.6829 }
        },
        contact: {
          phone: '+91-294-2876543',
          email: 'udaipur@thepentouz.com',
          website: 'https://thepentouz.com/udaipur'
        },
        amenities: ['WiFi', 'Lake View', 'Heritage Architecture', 'Restaurant', 'Cultural Shows', 'Boat Rides'],
        rating: 4.9,
        propertyGroupId: createdGroups[2]._id, // Resort Collection
        brand: 'THE PENTOUZ',
        features: {
          pms: true,
          pos: true,
          spa: true,
          restaurant: true,
          parking: true,
          wifi: true,
          fitness: false,
          pool: false
        }
      },
      {
        name: 'THE PENTOUZ Jaipur Heritage',
        description: 'THE PENTOUZ heritage branch in the Pink City',
        type: 'boutique',
        address: {
          street: 'MI Road',
          city: 'Jaipur',
          state: 'Rajasthan',
          country: 'India',
          zipCode: '302001',
          coordinates: { latitude: 26.9124, longitude: 75.7873 }
        },
        contact: {
          phone: '+91-141-2876543',
          email: 'jaipur@thepentouz.com',
          website: 'https://thepentouz.com/jaipur'
        },
        amenities: ['WiFi', 'Traditional Rajasthani Decor', 'Courtyard', 'Restaurant', 'Cultural Tours', 'Parking'],
        rating: 4.7,
        propertyGroupId: createdGroups[2]._id, // Resort Collection
        brand: 'THE PENTOUZ',
        features: {
          pms: true,
          pos: true,
          spa: true,
          restaurant: true,
          parking: true,
          wifi: true,
          fitness: false,
          pool: false
        }
      }
    ];

    // Add ownerId to all branch data
    const branchesWithOwner = branchesData.map(branch => ({
      ...branch,
      ownerId: ownerUser._id
    }));

    // Create all THE PENTOUZ branches
    const createdBranches = await Hotel.create(branchesWithOwner);
    console.log(`✅ Created ${createdBranches.length} THE PENTOUZ branches`);

    // Update main hotel to have ownerId if it doesn't exist
    if (!mainHotel.ownerId) {
      mainHotel.ownerId = ownerUser._id;
      await mainHotel.save();
      console.log('✅ Updated main hotel with ownerId');
    }

    // All hotels including main hotel
    const allHotels = [mainHotel, ...createdBranches];

    // Update property groups with hotel references
    for (const group of createdGroups) {
      const groupHotels = allHotels.filter(hotel => 
        hotel.propertyGroupId && hotel.propertyGroupId.toString() === group._id.toString()
      );
      group.properties = groupHotels.map(hotel => hotel._id);
      await group.save();
    }
    console.log('✅ Updated property groups with hotel references');

    // Create branch managers and staff for each hotel
    const allUsers = [];
    for (let i = 0; i < allHotels.length; i++) {
      const hotel = allHotels[i];
      const hashedPassword = await bcrypt.hash('pentouz123', 12);
      
      // Branch Manager
      const cityCode = hotel.address.city.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
      allUsers.push({
        name: `${hotel.name} Manager`,
        email: `manager.${cityCode}@thepentouz.com`,
        password: hashedPassword,
        role: 'manager',
        hotelId: hotel._id,
        isActive: true
      });
      
      // Front Desk Staff
      allUsers.push({
        name: `${hotel.name} Front Desk`,
        email: `frontdesk.${cityCode}@thepentouz.com`,
        password: hashedPassword,
        role: 'staff',
        hotelId: hotel._id,
        isActive: true
      });
    }

    // Create users one by one to handle duplicates
    const createdStaff = [];
    for (const userData of allUsers) {
      try {
        const existingUser = await User.findOne({ email: userData.email });
        if (!existingUser) {
          const newUser = await User.create(userData);
          createdStaff.push(newUser);
        } else {
          console.log(`⚠️  User ${userData.email} already exists, skipping...`);
        }
      } catch (error) {
        console.log(`⚠️  Failed to create user ${userData.email}:`, error.message);
      }
    }
    console.log(`✅ Created ${createdStaff.length} staff members across all THE PENTOUZ branches`);

    // Create room types for main hotel only (100 rooms total)
    const allRoomTypes = [];
    const roomTypeTemplates = [
      { code: 'STD', name: 'Standard Room', baseRate: 3500, totalRooms: 40, maxOccupancy: 2 },
      { code: 'DLX', name: 'Deluxe Room', baseRate: 4500, totalRooms: 30, maxOccupancy: 3 },
      { code: 'EXEC', name: 'Executive Suite', baseRate: 6500, totalRooms: 20, maxOccupancy: 4 },
      { code: 'PRES', name: 'Presidential Suite', baseRate: 9500, totalRooms: 10, maxOccupancy: 6 }
    ];

    // Create room types only for main hotel (100 rooms total)
    for (const template of roomTypeTemplates) {
      const roomType = {
        ...template,
        code: template.code, // Keep simple codes for main hotel
        hotelId: mainHotel._id,
        description: `${template.name} with premium amenities and modern facilities`,
        shortDescription: template.name,
        specifications: {
          maxOccupancy: template.maxOccupancy,
          bedType: template.maxOccupancy <= 2 ? 'queen' : 'king',
          bedCount: template.maxOccupancy > 4 ? 2 : 1,
          roomSize: template.baseRate / 150, // Approximate size calculation
          view: 'city',
          smokingPolicy: 'non_smoking'
        },
        amenities: [
          { code: 'WIFI', name: 'WiFi', category: 'technology' },
          { code: 'TV', name: 'LED TV', category: 'entertainment' },
          { code: 'AC', name: 'Air Conditioning', category: 'comfort' },
          { code: 'MINIBAR', name: 'Mini Bar', category: 'comfort' }
        ],
        isActive: true,
        isPublished: true
      };
      allRoomTypes.push(roomType);
    }

    const createdRoomTypes = await RoomType.create(allRoomTypes);
    console.log(`✅ Created ${createdRoomTypes.length} room types across all THE PENTOUZ branches`);

    // Create rooms only for main hotel (100 rooms total)
    const allRooms = [];
    let roomCounter = 1;

    for (const roomType of createdRoomTypes) {
      for (let i = 0; i < roomType.totalRooms; i++) {
        const floor = Math.ceil(roomCounter / 10);
        const roomNumber = `${floor}${String(roomCounter % 10 || 10).padStart(2, '0')}`;
        
        // Map room type code to valid room type enum
        let roomTypeEnum = 'single';
        if (roomType.code.includes('DLX') || roomType.code.includes('DELUXE')) {
          roomTypeEnum = 'deluxe';
        } else if (roomType.code.includes('EXEC') || roomType.code.includes('SUITE')) {
          roomTypeEnum = 'suite';
        } else if (roomType.code.includes('PRES') || roomType.code.includes('PRESIDENTIAL')) {
          roomTypeEnum = 'suite';
        } else if (roomType.code.includes('STD') || roomType.code.includes('STANDARD')) {
          roomTypeEnum = roomType.specifications.maxOccupancy > 2 ? 'double' : 'single';
        }

        allRooms.push({
          hotelId: mainHotel._id,
          roomNumber,
          type: roomTypeEnum,
          roomTypeId: roomType._id, // Reference to the room type
          baseRate: roomType.baseRate,
          currentRate: roomType.baseRate + Math.floor(Math.random() * 1000),
          status: ['vacant', 'occupied', 'maintenance'][Math.floor(Math.random() * 3)],
          floor,
          capacity: roomType.specifications.maxOccupancy,
          amenities: ['WiFi', 'LED TV', 'AC', 'Mini Bar', 'Room Service'],
          isActive: true
        });
        roomCounter++;
      }
    }

    const createdRooms = await Room.create(allRooms);
    console.log(`✅ Created ${createdRooms.length} rooms across all THE PENTOUZ branches`);

    // Create guest users
    const pentouzGuests = [
      'Rajesh Sharma', 'Priya Patel', 'Amit Kumar', 'Sneha Singh', 'Vikram Gupta',
      'Anita Reddy', 'Suresh Nair', 'Kavita Joshi', 'Ravi Mehta', 'Sunita Agarwal',
      'Deepak Verma', 'Meera Iyer', 'Arjun Khanna', 'Pooja Malhotra', 'Rohit Saxena',
      'Shilpa Rao', 'Kiran Desai', 'Manoj Tiwari', 'Rekha Pandey', 'Sandeep Jain',
      'Neha Gupta', 'Vivek Sharma', 'Anjali Patel', 'Sanjay Singh', 'Divya Reddy',
      'Rahul Nair', 'Nisha Joshi', 'Abhishek Mehta', 'Swati Agarwal', 'Karan Verma',
      'Aarti Kulkarni', 'Rohan Das', 'Tanvi Agrawal', 'Harsh Bajaj', 'Shreya Chopra'
    ];

    const guestUsers = [];
    for (let i = 0; i < pentouzGuests.length; i++) {
      const hashedPassword = await bcrypt.hash('pentouz123', 12);
      guestUsers.push({
        name: pentouzGuests[i],
        email: `guest${i + 1}@thepentouz.com`,
        password: hashedPassword,
        role: 'guest',
        guestType: Math.random() > 0.7 ? 'corporate' : 'normal',
        isActive: true,
        loyalty: {
          points: Math.floor(Math.random() * 8000),
          tier: ['bronze', 'silver', 'gold', 'platinum'][Math.floor(Math.random() * 4)]
        }
      });
    }

    const createdGuests = await User.create(guestUsers);
    console.log(`✅ Created ${createdGuests.length} THE PENTOUZ guest members`);

    // Create Room Availability data for the next 90 days
    console.log('📅 Creating room availability data...');
    const roomAvailabilityData = [];
    const today = new Date();
    
    for (let dayOffset = 0; dayOffset < 90; dayOffset++) {
      const currentDate = new Date(today.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      
      for (const roomType of createdRoomTypes) {
        const totalRooms = roomType.totalRooms;
        const soldRooms = Math.floor(Math.random() * Math.min(totalRooms, 8)); // Max 8 sold per day
        const blockedRooms = Math.floor(Math.random() * 2); // 0-2 blocked for maintenance
        
        roomAvailabilityData.push({
          hotelId: mainHotel._id,
          roomTypeId: roomType._id,
          date: currentDate,
          totalRooms,
          availableRooms: totalRooms - soldRooms - blockedRooms,
          soldRooms,
          blockedRooms,
          overbookedRooms: 0,
          stopSellFlag: false,
          closedToArrival: false,
          closedToDeparture: false,
          minLengthOfStay: 1,
          maxLengthOfStay: 30,
          baseRate: roomType.baseRate,
          sellingRate: roomType.baseRate + Math.floor(Math.random() * 500),
          currency: 'INR',
          needsSync: false
        });
      }
    }
    
    const createdRoomAvailability = await RoomAvailability.create(roomAvailabilityData);
    console.log(`✅ Created ${createdRoomAvailability.length} room availability records`);

    // Create Web Settings
    console.log('🌐 Creating web settings...');
    const webSettings = await WebSettings.create({
      hotelId: mainHotel._id,
      createdBy: ownerUser._id,
      general: {
        hotelName: 'THE PENTOUZ',
        description: 'Luxury hotel with premium amenities and exceptional service',
        address: {
          street: '123 Main Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          country: 'India',
          postalCode: '400001'
        },
        contact: {
          phone: '+91-22-12345678',
          email: 'info@thepentouz.com',
          website: 'https://thepentouz.com'
        },
        timezone: 'Asia/Kolkata',
        currency: {
          code: 'INR',
          symbol: '₹',
          position: 'before'
        },
        languages: [
          { code: 'en', name: 'English', isDefault: true },
          { code: 'hi', name: 'Hindi', isDefault: false }
        ]
      },
      booking: {
        minimumStay: 1,
        maximumStay: 30,
        advanceBookingLimit: 365,
        cutoffTime: { hours: 18, minutes: 0 },
        cancellationPolicy: {
          type: 'moderate',
          hoursBeforeCheckin: 24,
          penaltyPercentage: 0
        },
        checkInTime: '15:00',
        checkOutTime: '11:00',
        instantConfirmation: true,
        requiresApproval: false,
        guestDataRequired: ['full_name', 'email', 'phone']
      },
      payment: {
        gateways: [
          { name: 'razorpay', isActive: true, configuration: {}, fees: { percentage: 2, fixed: 0 } },
          { name: 'stripe', isActive: false, configuration: {}, fees: { percentage: 2.9, fixed: 0 } }
        ],
        acceptedCurrencies: [
          { code: 'INR', symbol: '₹', exchangeRate: 1 },
          { code: 'USD', symbol: '$', exchangeRate: 83 }
        ],
        paymentMethods: ['credit_card', 'debit_card', 'bank_transfer'],
        depositRequired: false,
        taxInclusive: false
      },
      seo: {
        metaTags: {
          title: 'THE PENTOUZ - Luxury Hotel in Mumbai',
          description: 'Experience luxury and comfort at THE PENTOUZ hotel in Mumbai. Premium amenities, exceptional service, and unforgettable stays.',
          keywords: ['luxury hotel', 'Mumbai', 'premium accommodation', 'business hotel']
        },
        robots: { index: true, follow: true }
      },
      theme: {
        colorScheme: {
          primary: '#1a365d',
          secondary: '#2d3748',
          accent: '#f59e0b',
          background: '#ffffff',
          text: '#1f2937'
        }
      },
      isActive: true
    });
    console.log('✅ Created web settings');

    // Create Booking Form Templates
    console.log('📝 Creating booking form templates...');
    const bookingFormTemplate = await BookingFormTemplate.create({
      hotelId: mainHotel._id,
      createdBy: ownerUser._id,
      name: 'Standard Booking Form',
      description: 'Main booking form for hotel reservations',
      category: 'booking',
      fields: [
        { id: 'check_in', type: 'date', label: 'Check-in Date', required: true, order: 1 },
        { id: 'check_out', type: 'date', label: 'Check-out Date', required: true, order: 2 },
        { id: 'guests', type: 'number', label: 'Number of Guests', required: true, min: 1, max: 10, order: 3 },
        { id: 'room_type', type: 'select', label: 'Room Type', required: true, order: 4, options: [
          { label: 'Standard Room', value: 'STD' },
          { label: 'Deluxe Room', value: 'DLX' },
          { label: 'Executive Suite', value: 'EXEC' },
          { label: 'Presidential Suite', value: 'PRES' }
        ]},
        { id: 'first_name', type: 'text', label: 'First Name', required: true, order: 5 },
        { id: 'last_name', type: 'text', label: 'Last Name', required: true, order: 6 },
        { id: 'email', type: 'email', label: 'Email Address', required: true, order: 7 },
        { id: 'phone', type: 'phone', label: 'Phone Number', required: true, order: 8 },
        { id: 'special_requests', type: 'textarea', label: 'Special Requests', required: false, order: 9 }
      ],
      settings: {
        submitUrl: '/api/v1/bookings',
        method: 'POST',
        successMessage: 'Thank you! Your booking has been confirmed.',
        errorMessage: 'There was an error processing your booking. Please try again.',
        emailNotifications: {
          enabled: true,
          recipientEmails: ['reservations@thepentouz.com'],
          subject: 'New Booking Request'
        }
      },
      status: 'published',
      isPublished: true
    });
    console.log('✅ Created booking form template');

    // Create API Keys
    console.log('🔑 Creating API keys...');
    const crypto = await import('crypto');
    const keyId = `ak_test_${crypto.default.randomBytes(32).toString('hex')}`;
    const keyHash = await bcrypt.hash(keyId, 12);
    
    const apiKey = await APIKey.create({
      name: 'Main API Key',
      description: 'Primary API key for hotel management system',
      keyId: keyId,
      keyHash: keyHash,
      keyPrefix: 'ak_test',
      hotelId: mainHotel._id,
      createdBy: ownerUser._id,
      type: 'admin',
      environment: 'sandbox',
      permissions: [
        { resource: 'reservations', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'rooms', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'guests', actions: ['create', 'read', 'update', 'delete'] }
      ],
      rateLimit: {
        requestsPerMinute: 100,
        requestsPerHour: 1000,
        requestsPerDay: 10000
      },
      isActive: true
    });
    console.log('✅ Created API key');

    // Create Webhook Endpoints
    console.log('🔗 Creating webhook endpoints...');
    const webhookSecret = `whsec_${crypto.default.randomBytes(32).toString('hex')}`;
    const webhookEndpoint = await WebhookEndpoint.create({
      name: 'Booking Notifications',
      description: 'Webhook for booking status changes',
      url: 'https://api.thepentouz.com/webhooks/booking-updates',
      secret: webhookSecret,
      hotelId: mainHotel._id,
      createdBy: ownerUser._id,
      events: [
        'booking.created',
        'booking.updated',
        'booking.cancelled',
        'booking.confirmed',
        'booking.checked_in',
        'booking.checked_out'
      ],
      httpConfig: {
        method: 'POST',
        timeout: 30000,
        contentType: 'application/json'
      },
      retryPolicy: {
        enabled: true,
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 60000
      },
      isActive: true
    });
    console.log('✅ Created webhook endpoint');

    // Create API Metrics (sample data)
    console.log('📊 Creating API metrics...');
    const apiMetricsData = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      apiMetricsData.push({
        hotelId: mainHotel._id,
        period: 'day',
        timestamp: date,
        endpoint: {
          method: 'GET',
          path: '/api/v1/bookings',
          category: 'reservations'
        },
        requests: {
          total: Math.floor(Math.random() * 1000) + 100,
          successful: Math.floor(Math.random() * 950) + 95,
          failed: Math.floor(Math.random() * 50) + 5
        },
        performance: {
          averageResponseTime: Math.floor(Math.random() * 200) + 50,
          minResponseTime: Math.floor(Math.random() * 50) + 10,
          maxResponseTime: Math.floor(Math.random() * 500) + 200
        },
        errors: {
          total: Math.floor(Math.random() * 20) + 1,
          byType: new Map([
            ['validation', Math.floor(Math.random() * 10)],
            ['auth', Math.floor(Math.random() * 5)],
            ['server', Math.floor(Math.random() * 3)]
          ])
        },
        users: {
          total: Math.floor(Math.random() * 50) + 10,
          authenticated: Math.floor(Math.random() * 40) + 8,
          anonymous: Math.floor(Math.random() * 10) + 2
        }
      });
    }
    
    const createdAPIMetrics = await APIMetrics.create(apiMetricsData);
    console.log(`✅ Created ${createdAPIMetrics.length} API metrics records`);

    // Create Audit Log entries
    console.log('📋 Creating audit log entries...');
    const auditLogData = [];
    for (let i = 0; i < 50; i++) {
      auditLogData.push({
        hotelId: mainHotel._id,
        tableName: ['RoomAvailability', 'Booking', 'RoomType', 'User'][Math.floor(Math.random() * 4)],
        recordId: new mongoose.Types.ObjectId(),
        changeType: ['create', 'update', 'delete'][Math.floor(Math.random() * 3)],
        userId: ownerUser._id,
        userEmail: ownerUser.email,
        userRole: ownerUser.role,
        source: ['manual', 'api', 'system'][Math.floor(Math.random() * 3)],
        oldValues: { test: 'old value' },
        newValues: { test: 'new value' },
        metadata: {
          priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
          tags: ['booking', 'room', 'user']
        }
      });
    }
    
    const createdAuditLogs = await AuditLog.create(auditLogData);
    console.log(`✅ Created ${createdAuditLogs.length} audit log entries`);

    // Create additional models data
    console.log('🏢 Creating additional hotel management models...');
    
    // Create Payment Methods
    const paymentMethods = await PaymentMethod.create([
      { 
        name: 'Credit Card', 
        code: 'CC', 
        type: 'credit_card', 
        isActive: true, 
        hotelId: mainHotel._id,
        createdBy: ownerUser._id,
        gateway: { provider: 'razorpay', apiKey: 'test_key', secretKey: 'test_secret' }
      },
      { 
        name: 'Debit Card', 
        code: 'DC', 
        type: 'debit_card', 
        isActive: true, 
        hotelId: mainHotel._id,
        createdBy: ownerUser._id,
        gateway: { provider: 'razorpay', apiKey: 'test_key', secretKey: 'test_secret' }
      },
      { 
        name: 'UPI', 
        code: 'UPI', 
        type: 'digital_wallet', 
        subtype: 'upi',
        isActive: true, 
        hotelId: mainHotel._id,
        createdBy: ownerUser._id,
        gateway: { provider: 'razorpay', apiKey: 'test_key', secretKey: 'test_secret' }
      },
      { 
        name: 'Net Banking', 
        code: 'NB', 
        type: 'bank_transfer', 
        subtype: 'net_banking',
        isActive: true, 
        hotelId: mainHotel._id,
        createdBy: ownerUser._id,
        gateway: { provider: 'payu', apiKey: 'test_key', secretKey: 'test_secret' }
      },
      { 
        name: 'Cash', 
        code: 'CASH', 
        type: 'cash', 
        isActive: true, 
        hotelId: mainHotel._id,
        createdBy: ownerUser._id,
        gateway: { provider: 'manual', apiKey: '', secretKey: '' }
      }
    ]);
    console.log(`✅ Created ${paymentMethods.length} payment methods`);

    // Create Hotel Services
    const hotelServices = await HotelService.create([
      { name: 'Room Service', type: 'dining', description: '24/7 room service', price: 0, hotelId: mainHotel._id, isActive: true },
      { name: 'Laundry Service', type: 'business', description: 'Professional laundry service', price: 200, hotelId: mainHotel._id, isActive: true },
      { name: 'Airport Transfer', type: 'transport', description: 'Airport pickup and drop', price: 1500, hotelId: mainHotel._id, isActive: true },
      { name: 'Spa Services', type: 'spa', description: 'Relaxing spa treatments', price: 3000, hotelId: mainHotel._id, isActive: true },
      { name: 'Gym Access', type: 'gym', description: 'Fitness center access', price: 0, hotelId: mainHotel._id, isActive: true }
    ]);
    console.log(`✅ Created ${hotelServices.length} hotel services`);

    // Create Departments
    try {
      const departments = await Department.create([
      { 
        name: 'Front Office', 
        code: 'FO', 
        description: 'Guest services and reception', 
        departmentType: 'front_office',
        hotelId: mainHotel._id, 
        createdBy: ownerUser._id, 
        isActive: true 
      },
      { 
        name: 'Housekeeping', 
        code: 'HK', 
        description: 'Room cleaning and maintenance', 
        departmentType: 'housekeeping',
        hotelId: mainHotel._id, 
        createdBy: ownerUser._id, 
        isActive: true 
      },
      { 
        name: 'Food & Beverage', 
        code: 'FB', 
        description: 'Restaurant and bar services', 
        departmentType: 'food_beverage',
        hotelId: mainHotel._id, 
        createdBy: ownerUser._id, 
        isActive: true 
      },
      { 
        name: 'Maintenance', 
        code: 'MNT', 
        description: 'Property maintenance and repairs', 
        departmentType: 'maintenance',
        hotelId: mainHotel._id, 
        createdBy: ownerUser._id, 
        isActive: true 
      },
      { 
        name: 'Security', 
        code: 'SEC', 
        description: 'Hotel security and safety', 
        departmentType: 'security',
        hotelId: mainHotel._id, 
        createdBy: ownerUser._id, 
        isActive: true 
      }
    ]);
    console.log(`✅ Created ${departments.length} departments`);
    } catch (error) {
      console.log(`⚠️  Department creation failed, skipping: ${error.message}`);
      const departments = [];
    }

    // Create Guest Types
    const guestTypes = await GuestType.create([
      { name: 'Individual', code: 'IND', category: 'individual', description: 'Single guest bookings', hotelId: mainHotel._id, createdBy: ownerUser._id, isActive: true },
      { name: 'Corporate', code: 'CORP', category: 'corporate', description: 'Business travelers', hotelId: mainHotel._id, createdBy: ownerUser._id, isActive: true },
      { name: 'Group', code: 'GRP', category: 'group', description: 'Group bookings', hotelId: mainHotel._id, createdBy: ownerUser._id, isActive: true },
      { name: 'VIP', code: 'VIP', category: 'vip', description: 'VIP guests', hotelId: mainHotel._id, createdBy: ownerUser._id, isActive: true }
    ]);
    console.log(`✅ Created ${guestTypes.length} guest types`);

    // Create Market Segments
    const marketSegments = await MarketSegment.create([
      { name: 'Leisure', code: 'LEISURE', category: 'leisure', description: 'Vacation and leisure travelers', hotelId: mainHotel._id, createdBy: ownerUser._id, isActive: true },
      { name: 'Business', code: 'BUSINESS', category: 'business', description: 'Business travelers', hotelId: mainHotel._id, createdBy: ownerUser._id, isActive: true },
      { name: 'Corporate', code: 'CORP', category: 'corporate', description: 'Corporate bookings', hotelId: mainHotel._id, createdBy: ownerUser._id, isActive: true },
      { name: 'Group', code: 'GROUP', category: 'group', description: 'Group bookings', hotelId: mainHotel._id, createdBy: ownerUser._id, isActive: true }
    ]);
    console.log(`✅ Created ${marketSegments.length} market segments`);

    // Create Inventory Items
    const inventoryItems = await InventoryItem.create([
      { name: 'Towels', category: 'bedding', unitPrice: 25, quantity: 500, unit: 'pieces', hotelId: mainHotel._id, isActive: true },
      { name: 'Bed Sheets', category: 'bedding', unitPrice: 45, quantity: 200, unit: 'sets', hotelId: mainHotel._id, isActive: true },
      { name: 'Pillows', category: 'bedding', unitPrice: 35, quantity: 300, unit: 'pieces', hotelId: mainHotel._id, isActive: true },
      { name: 'Soap', category: 'toiletries', unitPrice: 12, quantity: 1000, unit: 'pieces', hotelId: mainHotel._id, isActive: true },
      { name: 'Shampoo', category: 'toiletries', unitPrice: 18, quantity: 800, unit: 'bottles', hotelId: mainHotel._id, isActive: true }
    ]);
    console.log(`✅ Created ${inventoryItems.length} inventory items`);

    // Create Offers
    const offers = await Offer.create([
      { 
        title: 'Early Bird Discount', 
        description: '10% off for bookings made 30 days in advance', 
        type: 'discount',
        category: 'room',
        pointsRequired: 500,
        discountPercentage: 10, 
        hotelId: mainHotel._id, 
        isActive: true 
      },
      { 
        title: 'Weekend Special', 
        description: '15% off weekend stays', 
        type: 'discount',
        category: 'room',
        pointsRequired: 750,
        discountPercentage: 15, 
        hotelId: mainHotel._id, 
        isActive: true 
      },
      { 
        title: 'Long Stay Offer', 
        description: '20% off for stays longer than 7 days', 
        type: 'discount',
        category: 'room',
        pointsRequired: 1000,
        discountPercentage: 20, 
        hotelId: mainHotel._id, 
        isActive: true 
      }
    ]);
    console.log(`✅ Created ${offers.length} offers`);

    // Create Seasons
    const seasons = await Season.create([
      { 
        seasonId: 'PEAK_2024',
        name: 'Peak Season', 
        type: 'peak',
        description: 'High demand period', 
        startDate: new Date('2024-12-01'), 
        endDate: new Date('2024-12-31'), 
        hotelId: mainHotel._id, 
        isActive: true 
      },
      { 
        seasonId: 'SHOULDER_2024',
        name: 'Shoulder Season', 
        type: 'shoulder',
        description: 'Moderate demand period', 
        startDate: new Date('2024-10-01'), 
        endDate: new Date('2024-11-30'), 
        hotelId: mainHotel._id, 
        isActive: true 
      },
      { 
        seasonId: 'LOW_2024',
        name: 'Low Season', 
        type: 'low',
        description: 'Low demand period', 
        startDate: new Date('2024-06-01'), 
        endDate: new Date('2024-09-30'), 
        hotelId: mainHotel._id, 
        isActive: true 
      }
    ]);
    console.log(`✅ Created ${seasons.length} seasons`);

    // Create Room Features
    const roomFeatures = await RoomFeature.create([
      { 
        featureName: 'Ocean View', 
        featureCode: 'OCEAN_VIEW',
        category: 'view',
        description: 'Room with ocean view', 
        hotelId: mainHotel._id,
        auditInfo: { createdBy: ownerUser._id },
        isActive: true 
      },
      { 
        featureName: 'City View', 
        featureCode: 'CITY_VIEW',
        category: 'view',
        description: 'Room with city view', 
        hotelId: mainHotel._id,
        auditInfo: { createdBy: ownerUser._id },
        isActive: true 
      },
      { 
        featureName: 'Balcony', 
        featureCode: 'BALCONY',
        category: 'outdoor',
        description: 'Room with private balcony', 
        hotelId: mainHotel._id,
        auditInfo: { createdBy: ownerUser._id },
        isActive: true 
      },
      { 
        featureName: 'Jacuzzi', 
        featureCode: 'JACUZZI',
        category: 'luxury',
        description: 'Room with jacuzzi', 
        hotelId: mainHotel._id,
        auditInfo: { createdBy: ownerUser._id },
        isActive: true 
      }
    ]);
    console.log(`✅ Created ${roomFeatures.length} room features`);

    // Create Add-on Services
    const addOnServices = await AddOnService.create([
      { 
        serviceId: 'SVC_EXTRA_BED',
        name: 'Extra Bed', 
        category: 'other',
        type: 'once',
        description: 'Additional bed for room', 
        pricing: { baseCurrency: 'INR', basePrice: 1000 },
        hotelId: mainHotel._id, 
        isActive: true 
      },
      { 
        serviceId: 'SVC_LATE_CHECKOUT',
        name: 'Late Checkout', 
        category: 'other',
        type: 'once',
        description: 'Checkout until 2 PM', 
        pricing: { baseCurrency: 'INR', basePrice: 500 },
        hotelId: mainHotel._id, 
        isActive: true 
      },
      { 
        serviceId: 'SVC_EARLY_CHECKIN',
        name: 'Early Checkin', 
        category: 'other',
        type: 'once',
        description: 'Checkin from 10 AM', 
        pricing: { baseCurrency: 'INR', basePrice: 500 },
        hotelId: mainHotel._id, 
        isActive: true 
      },
      { 
        serviceId: 'SVC_AIRPORT_TRANSFER',
        name: 'Airport Transfer', 
        category: 'transportation',
        type: 'once',
        description: 'Airport pickup/drop', 
        pricing: { baseCurrency: 'INR', basePrice: 1500 },
        hotelId: mainHotel._id, 
        isActive: true 
      }
    ]);
    console.log(`✅ Created ${addOnServices.length} add-on services`);

    // Create Local Attractions
    const localAttractions = await LocalAttraction.create([
      { 
        name: 'Gateway of India', 
        description: 'Historic monument', 
        category: 'attractions', 
        address: 'Apollo Bandar, Colaba, Mumbai, Maharashtra 400001', 
        coordinates: { lat: 18.9220, lng: 72.8347 },
        distance: 2.5, 
        distanceText: '2.5 km', 
        hotelId: mainHotel._id, 
        isActive: true 
      },
      { 
        name: 'Marine Drive', 
        description: 'Scenic waterfront', 
        category: 'attractions', 
        address: 'Marine Drive, Mumbai, Maharashtra', 
        coordinates: { lat: 18.9441, lng: 72.8233 },
        distance: 1.8, 
        distanceText: '1.8 km', 
        hotelId: mainHotel._id, 
        isActive: true 
      },
      { 
        name: 'Juhu Beach', 
        description: 'Popular beach destination', 
        category: 'attractions', 
        address: 'Juhu Beach, Juhu, Mumbai, Maharashtra 400049', 
        coordinates: { lat: 19.0990, lng: 72.8267 },
        distance: 8.5, 
        distanceText: '8.5 km', 
        hotelId: mainHotel._id, 
        isActive: true 
      },
      { 
        name: 'Elephanta Caves', 
        description: 'UNESCO World Heritage Site', 
        category: 'attractions', 
        address: 'Elephanta Island, Mumbai, Maharashtra', 
        coordinates: { lat: 18.9633, lng: 72.9316 },
        distance: 12.0, 
        distanceText: '12 km', 
        hotelId: mainHotel._id, 
        isActive: true 
      }
    ]);
    console.log(`✅ Created ${localAttractions.length} local attractions`);

    // Create KPIs
    const kpis = await KPI.create([
      { name: 'Occupancy Rate', description: 'Percentage of rooms occupied', target: 75, current: 68, date: new Date(), hotelId: mainHotel._id, isActive: true },
      { name: 'ADR', description: 'Average Daily Rate', target: 5000, current: 4800, date: new Date(), hotelId: mainHotel._id, isActive: true },
      { name: 'RevPAR', description: 'Revenue per Available Room', target: 3750, current: 3264, date: new Date(), hotelId: mainHotel._id, isActive: true },
      { name: 'Guest Satisfaction', description: 'Guest satisfaction score', target: 4.5, current: 4.3, date: new Date(), hotelId: mainHotel._id, isActive: true }
    ]);
    console.log(`✅ Created ${kpis.length} KPIs`);

    // Create Basic Entity Models
    console.log('🏷️ Creating basic entity models...');
    
    // Create Currencies
    const currencies = await Currency.create([
      { code: 'INR', name: 'Indian Rupee', symbol: '₹', rate: 1, isDefault: true, isActive: true },
      { code: 'USD', name: 'US Dollar', symbol: '$', rate: 83, isDefault: false, isActive: true },
      { code: 'EUR', name: 'Euro', symbol: '€', rate: 90, isDefault: false, isActive: true },
      { code: 'GBP', name: 'British Pound', symbol: '£', rate: 105, isDefault: false, isActive: true },
      { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', rate: 55, isDefault: false, isActive: true }
    ]);
    console.log(`✅ Created ${currencies.length} currencies`);

    // Create Languages
    const languages = await Language.create([
      { code: 'en', name: 'English', nativeName: 'English', isDefault: true, isActive: true },
      { code: 'hi', name: 'Hindi', nativeName: 'हिंदी', isDefault: false, isActive: true },
      { code: 'mr', name: 'Marathi', nativeName: 'मराठी', isDefault: false, isActive: true },
      { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', isDefault: false, isActive: true },
      { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', isDefault: false, isActive: true },
      { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', isDefault: false, isActive: true },
      { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', isDefault: false, isActive: true }
    ]);
    console.log(`✅ Created ${languages.length} languages`);

    // Create Salutations
    const salutations = await Salutation.create([
      { title: 'Mr.', gender: 'male', hotelId: mainHotel._id, isActive: true },
      { title: 'Ms.', gender: 'female', hotelId: mainHotel._id, isActive: true },
      { title: 'Mrs.', gender: 'female', hotelId: mainHotel._id, isActive: true },
      { title: 'Dr.', gender: 'unspecified', hotelId: mainHotel._id, isActive: true },
      { title: 'Prof.', gender: 'unspecified', hotelId: mainHotel._id, isActive: true }
    ]);
    console.log(`✅ Created ${salutations.length} salutations`);

    // Create Identification Types
    const identificationTypes = await IdentificationType.create([
      { name: 'Aadhaar Card', code: 'AADHAAR', isGovernmentId: true, hotelId: mainHotel._id, isActive: true },
      { name: 'Passport', code: 'PASSPORT', isGovernmentId: true, hotelId: mainHotel._id, isActive: true },
      { name: 'Driving License', code: 'DL', isGovernmentId: true, hotelId: mainHotel._id, isActive: true },
      { name: 'PAN Card', code: 'PAN', isGovernmentId: true, hotelId: mainHotel._id, isActive: true },
      { name: 'Voter ID', code: 'VOTER', isGovernmentId: true, hotelId: mainHotel._id, isActive: true }
    ]);
    console.log(`✅ Created ${identificationTypes.length} identification types`);

    // Create Reasons
    const reasons = await Reason.create([
      { name: 'Booking Cancellation', category: 'cancellation', hotelId: mainHotel._id, isActive: true },
      { name: 'Room Change Request', category: 'room_change', hotelId: mainHotel._id, isActive: true },
      { name: 'Complaint Resolution', category: 'complaint', hotelId: mainHotel._id, isActive: true },
      { name: 'Late Checkout', category: 'checkout', hotelId: mainHotel._id, isActive: true },
      { name: 'Early Checkin', category: 'checkin', hotelId: mainHotel._id, isActive: true },
      { name: 'Refund Processing', category: 'refund', hotelId: mainHotel._id, isActive: true }
    ]);
    console.log(`✅ Created ${reasons.length} reasons`);

    // Create Job Types
    const jobTypes = await JobType.create([
      { name: 'Front Desk Manager', department: 'Front Office', hotelId: mainHotel._id, isActive: true },
      { name: 'Housekeeping Supervisor', department: 'Housekeeping', hotelId: mainHotel._id, isActive: true },
      { name: 'Restaurant Manager', department: 'Food & Beverage', hotelId: mainHotel._id, isActive: true },
      { name: 'Maintenance Technician', department: 'Maintenance', hotelId: mainHotel._id, isActive: true },
      { name: 'Security Guard', department: 'Security', hotelId: mainHotel._id, isActive: true },
      { name: 'Concierge', department: 'Guest Services', hotelId: mainHotel._id, isActive: true }
    ]);
    console.log(`✅ Created ${jobTypes.length} job types`);

    // Create Counters for various entities
    const counters = await Counter.create([
      { name: 'booking_number', prefix: 'PZ', suffix: '', currentValue: 1000, incrementBy: 1, hotelId: mainHotel._id },
      { name: 'invoice_number', prefix: 'INV', suffix: '', currentValue: 5000, incrementBy: 1, hotelId: mainHotel._id },
      { name: 'receipt_number', prefix: 'RCP', suffix: '', currentValue: 10000, incrementBy: 1, hotelId: mainHotel._id },
      { name: 'guest_number', prefix: 'G', suffix: '', currentValue: 50000, incrementBy: 1, hotelId: mainHotel._id }
    ]);
    console.log(`✅ Created ${counters.length} counters`);

    // Create Measurement Units
    const measurementUnits = await MeasurementUnit.create([
      { name: 'Square Feet', symbol: 'sqft', category: 'area', hotelId: mainHotel._id, isActive: true },
      { name: 'Square Meters', symbol: 'm²', category: 'area', hotelId: mainHotel._id, isActive: true },
      { name: 'Kilograms', symbol: 'kg', category: 'weight', hotelId: mainHotel._id, isActive: true },
      { name: 'Liters', symbol: 'L', category: 'volume', hotelId: mainHotel._id, isActive: true },
      { name: 'Pieces', symbol: 'pcs', category: 'quantity', hotelId: mainHotel._id, isActive: true },
      { name: 'Sets', symbol: 'set', category: 'quantity', hotelId: mainHotel._id, isActive: true }
    ]);
    console.log(`✅ Created ${measurementUnits.length} measurement units`);

    // Create Phone Extensions
    const phoneExtensions = await PhoneExtension.create([
      { extension: '100', department: 'Reception', description: 'Main reception desk', hotelId: mainHotel._id, isActive: true },
      { extension: '101', department: 'Front Office', description: 'Front office manager', hotelId: mainHotel._id, isActive: true },
      { extension: '200', department: 'Housekeeping', description: 'Housekeeping supervisor', hotelId: mainHotel._id, isActive: true },
      { extension: '300', department: 'Restaurant', description: 'Restaurant manager', hotelId: mainHotel._id, isActive: true },
      { extension: '400', department: 'Maintenance', description: 'Maintenance department', hotelId: mainHotel._id, isActive: true },
      { extension: '500', department: 'Security', description: 'Security desk', hotelId: mainHotel._id, isActive: true },
      { extension: '911', department: 'Emergency', description: 'Emergency contact', hotelId: mainHotel._id, isActive: true }
    ]);
    console.log(`✅ Created ${phoneExtensions.length} phone extensions`);

    // Create Financial Models
    console.log('💰 Creating financial models...');
    
    // Create Chart of Accounts
    const chartOfAccounts = await ChartOfAccounts.create([
      { code: '1000', name: 'Cash in Hand', type: 'asset', category: 'current_asset', hotelId: mainHotel._id, isActive: true },
      { code: '1001', name: 'Bank Account - HDFC', type: 'asset', category: 'current_asset', hotelId: mainHotel._id, isActive: true },
      { code: '1200', name: 'Accounts Receivable', type: 'asset', category: 'current_asset', hotelId: mainHotel._id, isActive: true },
      { code: '2000', name: 'Accounts Payable', type: 'liability', category: 'current_liability', hotelId: mainHotel._id, isActive: true },
      { code: '3000', name: 'Owner Equity', type: 'equity', category: 'equity', hotelId: mainHotel._id, isActive: true },
      { code: '4000', name: 'Room Revenue', type: 'revenue', category: 'operating_revenue', hotelId: mainHotel._id, isActive: true },
      { code: '4001', name: 'Food & Beverage Revenue', type: 'revenue', category: 'operating_revenue', hotelId: mainHotel._id, isActive: true },
      { code: '5000', name: 'Salaries Expense', type: 'expense', category: 'operating_expense', hotelId: mainHotel._id, isActive: true },
      { code: '5001', name: 'Utilities Expense', type: 'expense', category: 'operating_expense', hotelId: mainHotel._id, isActive: true }
    ]);
    console.log(`✅ Created ${chartOfAccounts.length} chart of accounts entries`);

    // Create Revenue Accounts
    const revenueAccounts = await RevenueAccount.create([
      { name: 'Room Revenue', code: 'ROOM_REV', accountType: 'revenue', hotelId: mainHotel._id, isActive: true },
      { name: 'Food Revenue', code: 'FOOD_REV', accountType: 'revenue', hotelId: mainHotel._id, isActive: true },
      { name: 'Beverage Revenue', code: 'BEV_REV', accountType: 'revenue', hotelId: mainHotel._id, isActive: true },
      { name: 'Spa Revenue', code: 'SPA_REV', accountType: 'revenue', hotelId: mainHotel._id, isActive: true },
      { name: 'Laundry Revenue', code: 'LAUNDRY_REV', accountType: 'revenue', hotelId: mainHotel._id, isActive: true }
    ]);
    console.log(`✅ Created ${revenueAccounts.length} revenue accounts`);

    // Create Bank Accounts
    const bankAccounts = await BankAccount.create([
      { name: 'HDFC Main Account', bankName: 'HDFC Bank', accountNumber: '12345678901234', accountType: 'checking', currency: 'INR', balance: 5000000, hotelId: mainHotel._id, isActive: true },
      { name: 'ICICI USD Account', bankName: 'ICICI Bank', accountNumber: '98765432109876', accountType: 'savings', currency: 'USD', balance: 50000, hotelId: mainHotel._id, isActive: true },
      { name: 'SBI Payroll Account', bankName: 'State Bank of India', accountNumber: '55667788990011', accountType: 'payroll', currency: 'INR', balance: 2000000, hotelId: mainHotel._id, isActive: true }
    ]);
    console.log(`✅ Created ${bankAccounts.length} bank accounts`);

    // Create Budget
    const budgets = await Budget.create([
      { name: '2024 Annual Budget', type: 'annual', year: 2024, totalBudget: 120000000, allocatedBudget: 100000000, spentBudget: 75000000, hotelId: mainHotel._id, isActive: true },
      { name: 'Q1 2024 Marketing Budget', type: 'quarterly', year: 2024, quarter: 1, totalBudget: 5000000, allocatedBudget: 4500000, spentBudget: 4200000, hotelId: mainHotel._id, isActive: true },
      { name: 'Monthly Operations Budget', type: 'monthly', year: 2024, month: 9, totalBudget: 8000000, allocatedBudget: 7500000, spentBudget: 6800000, hotelId: mainHotel._id, isActive: true }
    ]);
    console.log(`✅ Created ${budgets.length} budgets`);

    // Create Account Attributes
    const accountAttributes = await AccountAttribute.create([
      { name: 'Corporate Account', value: 'Yes', attributeType: 'boolean', hotelId: mainHotel._id, isActive: true },
      { name: 'Credit Limit', value: '500000', attributeType: 'number', hotelId: mainHotel._id, isActive: true },
      { name: 'Payment Terms', value: '30 days', attributeType: 'text', hotelId: mainHotel._id, isActive: true },
      { name: 'Tax Exempt', value: 'No', attributeType: 'boolean', hotelId: mainHotel._id, isActive: true }
    ]);
    console.log(`✅ Created ${accountAttributes.length} account attributes`);

    // Create Bill Messages
    const billMessages = await BillMessage.create([
      { name: 'Welcome Message', message: 'Thank you for choosing THE PENTOUZ. We hope you enjoyed your stay!', position: 'header', hotelId: mainHotel._id, isActive: true },
      { name: 'Payment Terms', message: 'Payment is due within 30 days of invoice date.', position: 'footer', hotelId: mainHotel._id, isActive: true },
      { name: 'Contact Information', message: 'For billing inquiries, please contact accounts@thepentouz.com', position: 'footer', hotelId: mainHotel._id, isActive: true }
    ]);
    console.log(`✅ Created ${billMessages.length} bill messages`);

    // Create sample Payments for existing bookings (first 50 bookings will be created later)
    console.log('💳 Creating sample payments...');
    const samplePayments = [];
    
    // We'll create payments after bookings are created, so let's prepare the data structure
    // This will be populated after booking creation
    
    // Create sample Financial Invoices
    const financialInvoices = [];
    for (let i = 0; i < 20; i++) {
      const guest = createdGuests[Math.floor(Math.random() * createdGuests.length)];
      const invoiceDate = new Date(today.getTime() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000);
      const amount = Math.floor(Math.random() * 50000) + 5000;
      
      financialInvoices.push({
        invoiceNumber: `INV-${Date.now()}-${i}`,
        hotelId: mainHotel._id,
        customerId: guest._id,
        customerName: guest.name,
        customerEmail: guest.email,
        invoiceDate,
        dueDate: new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        subtotal: amount,
        taxAmount: Math.floor(amount * 0.18),
        totalAmount: Math.floor(amount * 1.18),
        status: ['draft', 'sent', 'paid', 'overdue'][Math.floor(Math.random() * 4)],
        currency: 'INR',
        items: [
          { description: 'Room Charges', quantity: Math.floor(Math.random() * 5) + 1, unitPrice: Math.floor(amount / 2), amount: Math.floor(amount / 2) },
          { description: 'Food & Beverage', quantity: 1, unitPrice: Math.floor(amount / 2), amount: Math.floor(amount / 2) }
        ]
      });
    }
    
    const createdFinancialInvoices = await FinancialInvoice.create(financialInvoices);
    console.log(`✅ Created ${createdFinancialInvoices.length} financial invoices`);

    // Create sample Financial Payments
    const financialPayments = [];
    for (const invoice of createdFinancialInvoices.slice(0, 15)) {
      if (invoice.status === 'paid') {
        financialPayments.push({
          paymentNumber: `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
          hotelId: mainHotel._id,
          invoiceId: invoice._id,
          customerId: invoice.customerId,
          amount: invoice.totalAmount,
          paymentDate: new Date(invoice.invoiceDate.getTime() + Math.floor(Math.random() * 20) * 24 * 60 * 60 * 1000),
          paymentMethod: ['credit_card', 'debit_card', 'bank_transfer', 'cash', 'upi'][Math.floor(Math.random() * 5)],
          status: 'completed',
          currency: 'INR',
          reference: `REF-${Math.random().toString(36).substr(2, 8).toUpperCase()}`
        });
      }
    }
    
    const createdFinancialPayments = await FinancialPayment.create(financialPayments);
    console.log(`✅ Created ${createdFinancialPayments.length} financial payments`);

    // Create General Ledger entries
    const generalLedgerEntries = [];
    for (let i = 0; i < 50; i++) {
      const transactionDate = new Date(today.getTime() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000);
      const amount = Math.floor(Math.random() * 100000) + 1000;
      
      generalLedgerEntries.push({
        hotelId: mainHotel._id,
        accountId: chartOfAccounts[Math.floor(Math.random() * chartOfAccounts.length)]._id,
        transactionDate,
        description: ['Room Revenue', 'Food Sales', 'Utility Payment', 'Staff Salary', 'Marketing Expense'][Math.floor(Math.random() * 5)],
        debitAmount: Math.random() > 0.5 ? amount : 0,
        creditAmount: Math.random() > 0.5 ? 0 : amount,
        balance: amount,
        reference: `GL-${i + 1}`,
        entryType: ['manual', 'automatic'][Math.floor(Math.random() * 2)]
      });
    }
    
    const createdGeneralLedger = await GeneralLedger.create(generalLedgerEntries);
    console.log(`✅ Created ${createdGeneralLedger.length} general ledger entries`);

    // Create Journal Entries
    const journalEntries = [];
    for (let i = 0; i < 30; i++) {
      const entryDate = new Date(today.getTime() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000);
      const amount = Math.floor(Math.random() * 50000) + 5000;
      
      journalEntries.push({
        hotelId: mainHotel._id,
        entryNumber: `JE-${Date.now()}-${i}`,
        entryDate,
        description: ['Accrual Entry', 'Depreciation Entry', 'Adjustment Entry', 'Closing Entry'][Math.floor(Math.random() * 4)],
        totalDebit: amount,
        totalCredit: amount,
        status: 'posted',
        createdBy: ownerUser._id,
        entries: [
          { accountId: chartOfAccounts[0]._id, debitAmount: amount, creditAmount: 0, description: 'Debit entry' },
          { accountId: chartOfAccounts[1]._id, debitAmount: 0, creditAmount: amount, description: 'Credit entry' }
        ]
      });
    }
    
    const createdJournalEntries = await JournalEntry.create(journalEntries);
    console.log(`✅ Created ${createdJournalEntries.length} journal entries`);

    // Create Billing Sessions
    const billingSessions = [];
    for (let i = 0; i < 10; i++) {
      const sessionDate = new Date(today.getTime() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000);
      
      billingSessions.push({
        hotelId: mainHotel._id,
        sessionName: `Billing Session ${sessionDate.toISOString().split('T')[0]}`,
        sessionDate,
        startTime: new Date(sessionDate.getTime() + 9 * 60 * 60 * 1000), // 9 AM
        endTime: new Date(sessionDate.getTime() + 17 * 60 * 60 * 1000), // 5 PM
        status: ['active', 'closed', 'pending'][Math.floor(Math.random() * 3)],
        totalInvoices: Math.floor(Math.random() * 50) + 10,
        totalAmount: Math.floor(Math.random() * 1000000) + 100000,
        createdBy: ownerUser._id
      });
    }
    
    const createdBillingSessions = await BillingSession.create(billingSessions);
    console.log(`✅ Created ${createdBillingSessions.length} billing sessions`);

    // Create POS System Models
    console.log('🍽️ Creating POS system models...');
    
    // Create POS Outlets
    const posOutlets = [];
    for (const hotel of allHotels.slice(0, 3)) { // Create POS outlets for first 3 hotels
      posOutlets.push(
        {
          name: `${hotel.name} Restaurant`,
          type: 'restaurant',
          hotelId: hotel._id,
          location: 'Ground Floor',
          isActive: true,
          operatingHours: {
            monday: { open: '06:00', close: '23:00' },
            tuesday: { open: '06:00', close: '23:00' },
            wednesday: { open: '06:00', close: '23:00' },
            thursday: { open: '06:00', close: '23:00' },
            friday: { open: '06:00', close: '23:00' },
            saturday: { open: '06:00', close: '23:00' },
            sunday: { open: '06:00', close: '23:00' }
          }
        },
        {
          name: `${hotel.name} Bar`,
          type: 'bar',
          hotelId: hotel._id,
          location: 'First Floor',
          isActive: true,
          operatingHours: {
            monday: { open: '18:00', close: '02:00' },
            tuesday: { open: '18:00', close: '02:00' },
            wednesday: { open: '18:00', close: '02:00' },
            thursday: { open: '18:00', close: '02:00' },
            friday: { open: '18:00', close: '02:00' },
            saturday: { open: '18:00', close: '02:00' },
            sunday: { open: '18:00', close: '02:00' }
          }
        }
      );
    }
    
    const createdPOSOutlets = await POSOutlet.create(posOutlets);
    console.log(`✅ Created ${createdPOSOutlets.length} POS outlets`);

    // Create POS Attributes
    const posAttributes = await POSAttribute.create([
      { name: 'Size', type: 'single_select', hotelId: mainHotel._id, isRequired: true, isActive: true },
      { name: 'Temperature', type: 'single_select', hotelId: mainHotel._id, isRequired: false, isActive: true },
      { name: 'Add-ons', type: 'multi_select', hotelId: mainHotel._id, isRequired: false, isActive: true },
      { name: 'Spice Level', type: 'single_select', hotelId: mainHotel._id, isRequired: false, isActive: true }
    ]);
    console.log(`✅ Created ${posAttributes.length} POS attributes`);

    // Create POS Attribute Values
    const posAttributeValues = await POSAttributeValue.create([
      // Size attribute values
      { attributeId: posAttributes[0]._id, name: 'Small', value: 'S', priceAdjustment: -50, hotelId: mainHotel._id, isActive: true },
      { attributeId: posAttributes[0]._id, name: 'Medium', value: 'M', priceAdjustment: 0, hotelId: mainHotel._id, isActive: true },
      { attributeId: posAttributes[0]._id, name: 'Large', value: 'L', priceAdjustment: 100, hotelId: mainHotel._id, isActive: true },
      // Temperature attribute values
      { attributeId: posAttributes[1]._id, name: 'Hot', value: 'hot', priceAdjustment: 0, hotelId: mainHotel._id, isActive: true },
      { attributeId: posAttributes[1]._id, name: 'Cold', value: 'cold', priceAdjustment: 0, hotelId: mainHotel._id, isActive: true },
      // Add-ons attribute values
      { attributeId: posAttributes[2]._id, name: 'Extra Cheese', value: 'extra_cheese', priceAdjustment: 50, hotelId: mainHotel._id, isActive: true },
      { attributeId: posAttributes[2]._id, name: 'Extra Sauce', value: 'extra_sauce', priceAdjustment: 25, hotelId: mainHotel._id, isActive: true },
      // Spice Level attribute values
      { attributeId: posAttributes[3]._id, name: 'Mild', value: 'mild', priceAdjustment: 0, hotelId: mainHotel._id, isActive: true },
      { attributeId: posAttributes[3]._id, name: 'Medium', value: 'medium', priceAdjustment: 0, hotelId: mainHotel._id, isActive: true },
      { attributeId: posAttributes[3]._id, name: 'Spicy', value: 'spicy', priceAdjustment: 0, hotelId: mainHotel._id, isActive: true }
    ]);
    console.log(`✅ Created ${posAttributeValues.length} POS attribute values`);

    // Create POS Taxes
    const posTaxes = await POSTax.create([
      { name: 'GST', rate: 18, type: 'percentage', isInclusive: false, hotelId: mainHotel._id, isActive: true },
      { name: 'Service Charge', rate: 10, type: 'percentage', isInclusive: false, hotelId: mainHotel._id, isActive: true },
      { name: 'VAT', rate: 5, type: 'percentage', isInclusive: true, hotelId: mainHotel._id, isActive: true }
    ]);
    console.log(`✅ Created ${posTaxes.length} POS taxes`);

    // Create POS Menu items
    const posMenuItems = [];
    const restaurantOutlets = createdPOSOutlets.filter(outlet => outlet.type === 'restaurant');
    const barOutlets = createdPOSOutlets.filter(outlet => outlet.type === 'bar');
    
    // Restaurant Menu Items
    for (const outlet of restaurantOutlets) {
      const restaurantItems = [
        { name: 'Chicken Biryani', category: 'main_course', price: 450, description: 'Aromatic basmati rice with chicken', isAvailable: true, preparationTime: 25 },
        { name: 'Vegetable Pulao', category: 'main_course', price: 320, description: 'Fragrant rice with mixed vegetables', isAvailable: true, preparationTime: 20 },
        { name: 'Paneer Butter Masala', category: 'main_course', price: 380, description: 'Paneer in rich tomato gravy', isAvailable: true, preparationTime: 15 },
        { name: 'Dal Tadka', category: 'main_course', price: 280, description: 'Yellow lentils with tempering', isAvailable: true, preparationTime: 10 },
        { name: 'Tandoori Roti', category: 'breads', price: 45, description: 'Clay oven baked bread', isAvailable: true, preparationTime: 5 },
        { name: 'Naan', category: 'breads', price: 60, description: 'Soft leavened bread', isAvailable: true, preparationTime: 5 },
        { name: 'Masala Chai', category: 'beverages', price: 80, description: 'Spiced Indian tea', isAvailable: true, preparationTime: 5 },
        { name: 'Fresh Lime Soda', category: 'beverages', price: 120, description: 'Refreshing lime drink', isAvailable: true, preparationTime: 3 },
        { name: 'Gulab Jamun', category: 'desserts', price: 150, description: 'Sweet milk dumplings', isAvailable: true, preparationTime: 2 }
      ];
      
      for (const item of restaurantItems) {
        posMenuItems.push({
          ...item,
          outletId: outlet._id,
          hotelId: outlet.hotelId,
          sku: `${outlet._id.toString().slice(-4).toUpperCase()}-${item.name.replace(/\s+/g, '').toUpperCase().slice(0, 6)}`,
          taxes: [posTaxes[0]._id], // GST
          isActive: true
        });
      }
    }
    
    // Bar Menu Items
    for (const outlet of barOutlets) {
      const barItems = [
        { name: 'Whiskey Sour', category: 'cocktails', price: 650, description: 'Classic whiskey cocktail', isAvailable: true, preparationTime: 3 },
        { name: 'Mojito', category: 'cocktails', price: 550, description: 'Refreshing mint cocktail', isAvailable: true, preparationTime: 3 },
        { name: 'Beer - Kingfisher', category: 'beer', price: 350, description: 'Premium lager beer', isAvailable: true, preparationTime: 1 },
        { name: 'Wine - Red', category: 'wine', price: 800, description: 'House red wine', isAvailable: true, preparationTime: 1 },
        { name: 'Masala Peanuts', category: 'snacks', price: 180, description: 'Spiced roasted peanuts', isAvailable: true, preparationTime: 2 },
        { name: 'Chicken Wings', category: 'snacks', price: 420, description: 'Spicy chicken wings', isAvailable: true, preparationTime: 15 }
      ];
      
      for (const item of barItems) {
        posMenuItems.push({
          ...item,
          outletId: outlet._id,
          hotelId: outlet.hotelId,
          sku: `${outlet._id.toString().slice(-4).toUpperCase()}-${item.name.replace(/\s+/g, '').toUpperCase().slice(0, 6)}`,
          taxes: [posTaxes[0]._id, posTaxes[1]._id], // GST + Service Charge
          isActive: true
        });
      }
    }
    
    const createdPOSMenuItems = await POSMenu.create(posMenuItems);
    console.log(`✅ Created ${createdPOSMenuItems.length} POS menu items`);

    // Create POS Item Variants
    const posItemVariants = [];
    const sizeAttribute = posAttributes.find(attr => attr.name === 'Size');
    const tempAttribute = posAttributes.find(attr => attr.name === 'Temperature');
    
    for (const menuItem of createdPOSMenuItems.slice(0, 10)) { // Create variants for first 10 items
      if (menuItem.category === 'beverages') {
        // Create size and temperature variants for beverages
        posItemVariants.push({
          menuItemId: menuItem._id,
          name: `${menuItem.name} - Small Hot`,
          attributes: [
            { attributeId: sizeAttribute._id, valueId: posAttributeValues.find(v => v.value === 'S')._id },
            { attributeId: tempAttribute._id, valueId: posAttributeValues.find(v => v.value === 'hot')._id }
          ],
          priceAdjustment: -50,
          hotelId: menuItem.hotelId,
          isActive: true
        });
      }
    }
    
    if (posItemVariants.length > 0) {
      const createdPOSItemVariants = await POSItemVariant.create(posItemVariants);
      console.log(`✅ Created ${createdPOSItemVariants.length} POS item variants`);
    }

    // Create sample POS Orders
    const posOrders = [];
    for (let i = 0; i < 30; i++) {
      const outlet = createdPOSOutlets[Math.floor(Math.random() * createdPOSOutlets.length)];
      const outletMenuItems = createdPOSMenuItems.filter(item => item.outletId.toString() === outlet._id.toString());
      
      const orderDate = new Date(today.getTime() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000);
      const selectedItems = [];
      const numItems = Math.floor(Math.random() * 4) + 1; // 1-4 items per order
      
      let subtotal = 0;
      for (let j = 0; j < numItems; j++) {
        const menuItem = outletMenuItems[Math.floor(Math.random() * outletMenuItems.length)];
        const quantity = Math.floor(Math.random() * 3) + 1; // 1-3 quantity
        const itemTotal = menuItem.price * quantity;
        subtotal += itemTotal;
        
        selectedItems.push({
          menuItemId: menuItem._id,
          name: menuItem.name,
          quantity,
          unitPrice: menuItem.price,
          total: itemTotal
        });
      }
      
      const taxes = Math.floor(subtotal * 0.18); // 18% GST
      const serviceCharge = Math.floor(subtotal * 0.10); // 10% service charge
      const totalAmount = subtotal + taxes + serviceCharge;
      
      posOrders.push({
        orderNumber: `POS-${Date.now()}-${i}`,
        outletId: outlet._id,
        hotelId: outlet.hotelId,
        orderDate,
        items: selectedItems,
        subtotal,
        taxes,
        serviceCharge,
        totalAmount,
        status: ['pending', 'preparing', 'ready', 'served', 'cancelled'][Math.floor(Math.random() * 5)],
        paymentStatus: ['pending', 'paid'][Math.floor(Math.random() * 2)],
        paymentMethod: ['cash', 'card', 'upi', 'room_charge'][Math.floor(Math.random() * 4)],
        customerType: ['walk_in', 'room_guest', 'banquet'][Math.floor(Math.random() * 3)]
      });
    }
    
    const createdPOSOrders = await POSOrder.create(posOrders);
    console.log(`✅ Created ${createdPOSOrders.length} POS orders`);

    // Create Operational Models
    console.log('🏨 Creating operational models...');
    
    // Create Hotel Areas
    const hotelAreas = await HotelArea.create([
      { name: 'Lobby', type: 'public', floor: 0, hotelId: mainHotel._id, isActive: true },
      { name: 'Guest Rooms Floor 1', type: 'guest_room', floor: 1, hotelId: mainHotel._id, isActive: true },
      { name: 'Guest Rooms Floor 2', type: 'guest_room', floor: 2, hotelId: mainHotel._id, isActive: true },
      { name: 'Restaurant', type: 'restaurant', floor: 0, hotelId: mainHotel._id, isActive: true },
      { name: 'Kitchen', type: 'service', floor: 0, hotelId: mainHotel._id, isActive: true },
      { name: 'Conference Room', type: 'meeting', floor: 1, hotelId: mainHotel._id, isActive: true },
      { name: 'Spa', type: 'recreational', floor: 2, hotelId: mainHotel._id, isActive: true },
      { name: 'Gym', type: 'recreational', floor: 2, hotelId: mainHotel._id, isActive: true },
      { name: 'Laundry', type: 'service', floor: -1, hotelId: mainHotel._id, isActive: true },
      { name: 'Storage', type: 'service', floor: -1, hotelId: mainHotel._id, isActive: true }
    ]);
    console.log(`✅ Created ${hotelAreas.length} hotel areas`);

    // Create Room Taxes
    const roomTaxes = await RoomTax.create([
      { name: 'Luxury Tax', rate: 12, type: 'percentage', applicableRooms: ['suite'], hotelId: mainHotel._id, isActive: true },
      { name: 'City Tax', rate: 200, type: 'fixed', applicableRooms: ['all'], hotelId: mainHotel._id, isActive: true },
      { name: 'Tourism Tax', rate: 5, type: 'percentage', applicableRooms: ['deluxe', 'suite'], hotelId: mainHotel._id, isActive: true }
    ]);
    console.log(`✅ Created ${roomTaxes.length} room taxes`);

    // Create Room Charges
    const roomCharges = await RoomCharge.create([
      { name: 'Extra Bed Charge', amount: 1000, type: 'per_night', category: 'accommodation', hotelId: mainHotel._id, isActive: true },
      { name: 'Late Checkout Fee', amount: 500, type: 'one_time', category: 'service', hotelId: mainHotel._id, isActive: true },
      { name: 'Early Checkin Fee', amount: 500, type: 'one_time', category: 'service', hotelId: mainHotel._id, isActive: true },
      { name: 'WiFi Premium', amount: 200, type: 'per_day', category: 'amenity', hotelId: mainHotel._id, isActive: true },
      { name: 'Minibar Restocking', amount: 100, type: 'per_item', category: 'service', hotelId: mainHotel._id, isActive: true }
    ]);
    console.log(`✅ Created ${roomCharges.length} room charges`);

    // Create Service Inclusions
    const serviceInclusions = await ServiceInclusion.create([
      { name: 'Complimentary Breakfast', description: 'Continental breakfast included', roomTypes: ['deluxe', 'suite'], hotelId: mainHotel._id, isActive: true },
      { name: 'Airport Transfer', description: 'Free airport pickup/drop', roomTypes: ['suite'], hotelId: mainHotel._id, isActive: true },
      { name: 'Welcome Drink', description: 'Complimentary welcome drink', roomTypes: ['all'], hotelId: mainHotel._id, isActive: true },
      { name: 'Late Checkout', description: 'Checkout until 2 PM', roomTypes: ['suite'], hotelId: mainHotel._id, isActive: true }
    ]);
    console.log(`✅ Created ${serviceInclusions.length} service inclusions`);

    // Add service bookings to main Booking collection (will be added to allBookings array later)
    const serviceBookingsForMainCollection = [];
    for (let i = 0; i < 25; i++) {
      const guest = createdGuests[Math.floor(Math.random() * createdGuests.length)];
      const service = hotelServices[Math.floor(Math.random() * hotelServices.length)];
      const room = createdRooms[Math.floor(Math.random() * createdRooms.length)];
      const bookingDate = new Date(today.getTime() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000);
      const serviceDate = new Date(bookingDate.getTime() + Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000);
      
      serviceBookingsForMainCollection.push({
        hotelId: mainHotel._id,
        userId: guest._id,
        rooms: [{
          roomId: room._id,
          rate: room.currentRate || 5000
        }],
        checkIn: serviceDate,
        checkOut: new Date(serviceDate.getTime() + 24 * 60 * 60 * 1000), // Same day service
        nights: 1,
        status: ['confirmed', 'checked_in', 'completed', 'cancelled'][Math.floor(Math.random() * 4)],
        paymentStatus: ['pending', 'paid'][Math.floor(Math.random() * 2)],
        totalAmount: service.price || 2000,
        currency: 'INR',
        guestDetails: {
          adults: 1,
          children: 0,
          specialRequests: `Service Booking: ${service.name}`
        },
        bookingNumber: `SVC${Date.now()}${i.toString().padStart(3, '0')}`,
        source: 'direct',
        channelBookingId: `SERVICE-${Date.now()}-${i}`,
        idempotencyKey: `service-seed-${i}-${Date.now()}`,
        bookingType: 'service',
        serviceDetails: {
          serviceId: service._id,
          serviceName: service.name,
          scheduledDate: serviceDate
        }
      });
    }
    
    console.log(`✅ Prepared ${serviceBookingsForMainCollection.length} service bookings for main Booking collection`);

    // Create Housekeeping records
    const housekeepingRecords = [];
    for (let i = 0; i < 50; i++) {
      const room = createdRooms[Math.floor(Math.random() * createdRooms.length)];
      const staff = createdStaff[Math.floor(Math.random() * createdStaff.length)];
      const date = new Date(today.getTime() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000);
      
      housekeepingRecords.push({
        hotelId: mainHotel._id,
        roomId: room._id,
        roomNumber: room.roomNumber,
        assignedTo: staff._id,
        assignedBy: ownerUser._id,
        date,
        status: ['pending', 'in_progress', 'completed', 'inspection_required'][Math.floor(Math.random() * 4)],
        taskType: ['checkout_cleaning', 'maintenance_cleaning', 'deep_cleaning', 'inspection'][Math.floor(Math.random() * 4)],
        startTime: new Date(date.getTime() + 9 * 60 * 60 * 1000), // 9 AM
        completedTime: Math.random() > 0.3 ? new Date(date.getTime() + 11 * 60 * 60 * 1000) : null, // 11 AM
        notes: ['Standard cleaning completed', 'Deep cleaning required', 'Maintenance issue reported', 'Room ready for guest'][Math.floor(Math.random() * 4)]
      });
    }
    
    const createdHousekeeping = await Housekeeping.create(housekeepingRecords);
    console.log(`✅ Created ${createdHousekeeping.length} housekeeping records`);

    // Create Maintenance Tasks
    const maintenanceTasks = [];
    for (let i = 0; i < 30; i++) {
      const room = Math.random() > 0.5 ? createdRooms[Math.floor(Math.random() * createdRooms.length)] : null;
      const area = Math.random() > 0.5 ? hotelAreas[Math.floor(Math.random() * hotelAreas.length)] : null;
      const assignedStaff = createdStaff[Math.floor(Math.random() * createdStaff.length)];
      const createdDate = new Date(today.getTime() - Math.floor(Math.random() * 14) * 24 * 60 * 60 * 1000);
      
      maintenanceTasks.push({
        hotelId: mainHotel._id,
        title: ['Fix AC Unit', 'Repair Plumbing', 'Replace Light Bulb', 'Fix Door Lock', 'Repair TV', 'Clean Drain'][Math.floor(Math.random() * 6)],
        description: ['Guest reported issue with air conditioning', 'Bathroom sink not draining properly', 'Light bulb in reading lamp needs replacement'][Math.floor(Math.random() * 3)],
        category: ['electrical', 'plumbing', 'hvac', 'furniture', 'electronics'][Math.floor(Math.random() * 5)],
        priority: ['low', 'medium', 'high', 'urgent'][Math.floor(Math.random() * 4)],
        status: ['open', 'in_progress', 'completed', 'cancelled'][Math.floor(Math.random() * 4)],
        roomId: room ? room._id : null,
        areaId: area ? area._id : null,
        assignedTo: assignedStaff._id,
        reportedBy: ownerUser._id,
        createdDate,
        scheduledDate: new Date(createdDate.getTime() + Math.floor(Math.random() * 5) * 24 * 60 * 60 * 1000),
        estimatedCost: Math.floor(Math.random() * 5000) + 500
      });
    }
    
    const createdMaintenanceTasks = await MaintenanceTask.create(maintenanceTasks);
    console.log(`✅ Created ${createdMaintenanceTasks.length} maintenance tasks`);

    // Create Inventory for hotel
    const inventoryCategories = ['linen', 'amenities', 'cleaning_supplies', 'kitchen_supplies', 'maintenance_parts'];
    const inventories = [];
    
    for (const category of inventoryCategories) {
      inventories.push({
        hotelId: mainHotel._id,
        name: `${category.replace('_', ' ').toUpperCase()} Inventory`,
        category,
        description: `Main inventory for ${category.replace('_', ' ')} items`,
        location: category === 'kitchen_supplies' ? 'Kitchen Storage' : 'Main Storage',
        managedBy: ownerUser._id,
        isActive: true
      });
    }
    
    const createdInventories = await Inventory.create(inventories);
    console.log(`✅ Created ${createdInventories.length} inventories`);

    // Create Inventory Transactions
    const inventoryTransactions = [];
    for (let i = 0; i < 40; i++) {
      const inventory = createdInventories[Math.floor(Math.random() * createdInventories.length)];
      const item = inventoryItems[Math.floor(Math.random() * inventoryItems.length)];
      const transactionDate = new Date(today.getTime() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000);
      const quantity = Math.floor(Math.random() * 100) + 10;
      
      inventoryTransactions.push({
        hotelId: mainHotel._id,
        inventoryId: inventory._id,
        itemId: item._id,
        transactionType: ['in', 'out', 'adjustment', 'transfer'][Math.floor(Math.random() * 4)],
        quantity,
        unitCost: Math.floor(Math.random() * 500) + 50,
        totalCost: quantity * (Math.floor(Math.random() * 500) + 50),
        reference: `TXN-${i + 1}`,
        notes: ['Stock replenishment', 'Room service usage', 'Damaged items removed', 'Inter-department transfer'][Math.floor(Math.random() * 4)],
        transactionDate,
        performedBy: ownerUser._id
      });
    }
    
    const createdInventoryTransactions = await InventoryTransaction.create(inventoryTransactions);
    console.log(`✅ Created ${createdInventoryTransactions.length} inventory transactions`);

    // Create Staff Tasks
    const staffTasks = [];
    for (let i = 0; i < 40; i++) {
      const staff = createdStaff[Math.floor(Math.random() * createdStaff.length)];
      const taskDate = new Date(today.getTime() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000);
      
      staffTasks.push({
        hotelId: mainHotel._id,
        assignedTo: staff._id,
        assignedBy: ownerUser._id,
        title: ['Guest Check-in', 'Room Inspection', 'Inventory Count', 'Guest Service Request', 'Maintenance Check'][Math.floor(Math.random() * 5)],
        description: ['Process guest check-in and room assignment', 'Inspect room before guest arrival', 'Count inventory items'][Math.floor(Math.random() * 3)],
        category: ['guest_service', 'housekeeping', 'maintenance', 'administrative'][Math.floor(Math.random() * 4)],
        priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        status: ['pending', 'in_progress', 'completed', 'cancelled'][Math.floor(Math.random() * 4)],
        dueDate: new Date(taskDate.getTime() + 24 * 60 * 60 * 1000), // Due next day
        estimatedMinutes: Math.floor(Math.random() * 120) + 30 // 30-150 minutes
      });
    }
    
    const createdStaffTasks = await StaffTask.create(staffTasks);
    console.log(`✅ Created ${createdStaffTasks.length} staff tasks`);

    // Create Daily Routine Check Templates
    const dailyRoutineCheckTemplates = await DailyRoutineCheckTemplate.create([
      {
        hotelId: mainHotel._id,
        name: 'Morning Security Check',
        category: 'security',
        frequency: 'daily',
        checkItems: [
          { item: 'Check main entrance locks', required: true, type: 'checkbox' },
          { item: 'Verify CCTV systems', required: true, type: 'checkbox' },
          { item: 'Test fire alarm panel', required: true, type: 'checkbox' },
          { item: 'Count cash in safe', required: true, type: 'number' }
        ],
        assignedTo: 'security',
        scheduledTime: '06:00',
        isActive: true
      },
      {
        hotelId: mainHotel._id,
        name: 'Daily Housekeeping Checklist',
        category: 'housekeeping',
        frequency: 'daily',
        checkItems: [
          { item: 'Inventory count - towels', required: true, type: 'number' },
          { item: 'Inventory count - bed sheets', required: true, type: 'number' },
          { item: 'Check laundry equipment', required: true, type: 'checkbox' },
          { item: 'Inspect cleaning supplies', required: true, type: 'checkbox' }
        ],
        assignedTo: 'housekeeping',
        scheduledTime: '08:00',
        isActive: true
      }
    ]);
    console.log(`✅ Created ${dailyRoutineCheckTemplates.length} daily routine check templates`);

    // Create Daily Routine Checks
    const dailyRoutineChecks = [];
    for (let i = 0; i < 20; i++) {
      const template = dailyRoutineCheckTemplates[Math.floor(Math.random() * dailyRoutineCheckTemplates.length)];
      const staff = createdStaff[Math.floor(Math.random() * createdStaff.length)];
      const checkDate = new Date(today.getTime() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000);
      
      dailyRoutineChecks.push({
        hotelId: mainHotel._id,
        templateId: template._id,
        performedBy: staff._id,
        checkDate,
        status: ['pending', 'completed', 'partial'][Math.floor(Math.random() * 3)],
        results: template.checkItems.map(item => ({
          item: item.item,
          value: item.type === 'checkbox' ? Math.random() > 0.3 : Math.floor(Math.random() * 100) + 1,
          notes: Math.random() > 0.7 ? 'All good' : ''
        }))
      });
    }
    
    const createdDailyRoutineChecks = await DailyRoutineCheck.create(dailyRoutineChecks);
    console.log(`✅ Created ${createdDailyRoutineChecks.length} daily routine checks`);

    // Create Daily Inventory Checks
    const dailyInventoryChecks = [];
    for (let i = 0; i < 15; i++) {
      const inventory = createdInventories[Math.floor(Math.random() * createdInventories.length)];
      const staff = createdStaff[Math.floor(Math.random() * createdStaff.length)];
      const checkDate = new Date(today.getTime() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000);
      
      dailyInventoryChecks.push({
        hotelId: mainHotel._id,
        inventoryId: inventory._id,
        performedBy: staff._id,
        checkDate,
        status: ['completed', 'pending', 'discrepancy_found'][Math.floor(Math.random() * 3)],
        items: inventoryItems.slice(0, 3).map(item => ({
          itemId: item._id,
          expectedCount: item.quantity,
          actualCount: item.quantity + Math.floor(Math.random() * 10) - 5, // ±5 variance
          discrepancy: Math.random() > 0.8
        }))
      });
    }
    
    const createdDailyInventoryChecks = await DailyInventoryCheck.create(dailyInventoryChecks);
    console.log(`✅ Created ${createdDailyInventoryChecks.length} daily inventory checks`);

    // Create Checkout Inspections
    const checkoutInspections = [];
    for (let i = 0; i < 30; i++) {
      const room = createdRooms[Math.floor(Math.random() * createdRooms.length)];
      const inspector = createdStaff[Math.floor(Math.random() * createdStaff.length)];
      const inspectionDate = new Date(today.getTime() - Math.floor(Math.random() * 14) * 24 * 60 * 60 * 1000);
      
      checkoutInspections.push({
        hotelId: mainHotel._id,
        roomId: room._id,
        roomNumber: room.roomNumber,
        inspectedBy: inspector._id,
        inspectionDate,
        status: ['passed', 'failed', 'requires_maintenance'][Math.floor(Math.random() * 3)],
        damagesFound: Math.random() > 0.7,
        cleaningRequired: Math.random() > 0.4,
        maintenanceRequired: Math.random() > 0.8,
        notes: ['Room in good condition', 'Minor cleaning needed', 'Bathroom faucet needs repair'][Math.floor(Math.random() * 3)],
        estimatedRepairCost: Math.random() > 0.7 ? Math.floor(Math.random() * 2000) + 200 : 0
      });
    }
    
    const createdCheckoutInspections = await CheckoutInspection.create(checkoutInspections);
    console.log(`✅ Created ${createdCheckoutInspections.length} checkout inspections`);

    // Create Checkout Inventory
    const checkoutInventory = [];
    for (const inspection of createdCheckoutInspections.slice(0, 15)) {
      const inventoryItems = [
        { item: 'TV Remote', expected: 1, found: Math.random() > 0.9 ? 0 : 1 },
        { item: 'Towels', expected: 4, found: Math.floor(Math.random() * 5) },
        { item: 'Pillows', expected: 2, found: Math.floor(Math.random() * 3) },
        { item: 'Bedsheets', expected: 1, found: Math.random() > 0.9 ? 0 : 1 },
        { item: 'Glasses', expected: 2, found: Math.floor(Math.random() * 3) }
      ];
      
      checkoutInventory.push({
        hotelId: mainHotel._id,
        roomId: inspection.roomId,
        inspectionId: inspection._id,
        checkedBy: inspection.inspectedBy,
        checkDate: inspection.inspectionDate,
        items: inventoryItems,
        discrepancies: inventoryItems.filter(item => item.expected !== item.found).length,
        status: inventoryItems.every(item => item.expected === item.found) ? 'complete' : 'missing_items'
      });
    }
    
    const createdCheckoutInventory = await CheckoutInventory.create(checkoutInventory);
    console.log(`✅ Created ${createdCheckoutInventory.length} checkout inventory records`);

    // Create Guest Service Models
    console.log('🎭 Creating guest service models...');
    
    // Create Guest Services
    const guestServices = await GuestService.create([
      { name: 'Wake-up Call', description: 'Complimentary wake-up call service', price: 0, category: 'comfort', hotelId: mainHotel._id, isActive: true },
      { name: 'Newspaper Delivery', description: 'Daily newspaper delivery to room', price: 50, category: 'comfort', hotelId: mainHotel._id, isActive: true },
      { name: 'Shoe Shine', description: 'Professional shoe shine service', price: 150, category: 'personal_care', hotelId: mainHotel._id, isActive: true },
      { name: 'Butler Service', description: 'Personal butler for suite guests', price: 2000, category: 'luxury', hotelId: mainHotel._id, isActive: true },
      { name: 'Pet Care', description: 'Pet sitting and care services', price: 1000, category: 'special', hotelId: mainHotel._id, isActive: true }
    ]);
    console.log(`✅ Created ${guestServices.length} guest services`);

    // Create VIP Guests
    const vipGuests = [];
    for (let i = 0; i < 10; i++) {
      const guest = createdGuests[Math.floor(Math.random() * createdGuests.length)];
      vipGuests.push({
        hotelId: mainHotel._id,
        guestId: guest._id,
        vipLevel: ['gold', 'platinum', 'diamond'][Math.floor(Math.random() * 3)],
        reason: ['Frequent Visitor', 'High Spender', 'Celebrity', 'Corporate Partner'][Math.floor(Math.random() * 4)],
        benefits: ['Room Upgrade', 'Late Checkout', 'Welcome Amenities', 'Priority Booking'],
        specialRequests: ['High Floor Room', 'Away from Elevator', 'Extra Towels'][Math.floor(Math.random() * 3)],
        totalSpending: Math.floor(Math.random() * 500000) + 100000,
        visitCount: Math.floor(Math.random() * 20) + 5,
        isActive: true
      });
    }
    
    const createdVIPGuests = await VIPGuest.create(vipGuests);
    console.log(`✅ Created ${createdVIPGuests.length} VIP guests`);

    // Create Guest Blacklist (2-3 entries only)
    const guestBlacklist = [];
    for (let i = 0; i < 3; i++) {
      guestBlacklist.push({
        hotelId: mainHotel._id,
        guestName: ['John Troublemaker', 'Jane Problematic', 'Bob Difficult'][i],
        guestEmail: `blacklisted${i + 1}@example.com`,
        reason: ['Property Damage', 'Disruptive Behavior', 'Payment Issues'][i],
        severity: ['medium', 'high', 'critical'][i],
        addedBy: ownerUser._id,
        addedDate: new Date(today.getTime() - Math.floor(Math.random() * 365) * 24 * 60 * 60 * 1000),
        notes: ['Caused significant damage to room furniture', 'Disturbed other guests repeatedly', 'Multiple payment chargebacks'][i],
        isActive: true
      });
    }
    
    const createdGuestBlacklist = await GuestBlacklist.create(guestBlacklist);
    console.log(`✅ Created ${createdGuestBlacklist.length} guest blacklist entries`);

    // Create Guest Custom Data
    const guestCustomData = [];
    for (let i = 0; i < 20; i++) {
      const guest = createdGuests[Math.floor(Math.random() * createdGuests.length)];
      guestCustomData.push({
        hotelId: mainHotel._id,
        guestId: guest._id,
        fieldName: ['Anniversary Date', 'Dietary Restrictions', 'Preferred Floor', 'Smoking Preference', 'Bed Preference'][Math.floor(Math.random() * 5)],
        fieldValue: ['2024-06-15', 'Vegetarian', '5th Floor', 'Non-Smoking', 'King Size'][Math.floor(Math.random() * 5)],
        fieldType: ['date', 'text', 'text', 'select', 'select'][Math.floor(Math.random() * 5)],
        isPrivate: Math.random() > 0.7,
        createdBy: ownerUser._id
      });
    }
    
    const createdGuestCustomData = await GuestCustomData.create(guestCustomData);
    console.log(`✅ Created ${createdGuestCustomData.length} guest custom data entries`);

    // Create Loyalty program entries
    const loyaltyEntries = [];
    for (let i = 0; i < 25; i++) {
      const guest = createdGuests[Math.floor(Math.random() * createdGuests.length)];
      const joinDate = new Date(today.getTime() - Math.floor(Math.random() * 730) * 24 * 60 * 60 * 1000); // Up to 2 years ago
      
      loyaltyEntries.push({
        hotelId: mainHotel._id,
        guestId: guest._id,
        membershipNumber: `PZ${String(i + 1).padStart(6, '0')}`,
        tier: ['bronze', 'silver', 'gold', 'platinum'][Math.floor(Math.random() * 4)],
        points: Math.floor(Math.random() * 10000),
        lifetimePoints: Math.floor(Math.random() * 25000),
        joinDate,
        lastActivity: new Date(today.getTime() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
        status: 'active',
        benefits: ['Point Earning', 'Room Upgrade', 'Late Checkout'],
        isActive: true
      });
    }
    
    const createdLoyalty = await Loyalty.create(loyaltyEntries);
    console.log(`✅ Created ${createdLoyalty.length} loyalty program entries`);

    // Create Reviews
    const reviews = [];
    for (let i = 0; i < 50; i++) {
      const guest = createdGuests[Math.floor(Math.random() * createdGuests.length)];
      const reviewDate = new Date(today.getTime() - Math.floor(Math.random() * 60) * 24 * 60 * 60 * 1000);
      const rating = Math.floor(Math.random() * 3) + 3; // 3-5 star ratings mostly
      
      const positiveComments = [
        'Excellent service and beautiful rooms!',
        'Staff was very helpful and friendly.',
        'Great location and amenities.',
        'Clean rooms and comfortable beds.',
        'Outstanding food at the restaurant.'
      ];
      
      const neutralComments = [
        'Average stay, nothing special.',
        'Room was okay but could be better.',
        'Service was decent.',
        'Good location but rooms need updating.',
        'Fair value for money.'
      ];
      
      reviews.push({
        hotelId: mainHotel._id,
        guestId: guest._id,
        guestName: guest.name,
        rating,
        title: rating >= 4 ? 'Great Stay' : rating === 3 ? 'Average Experience' : 'Disappointing',
        comment: rating >= 4 ? positiveComments[Math.floor(Math.random() * positiveComments.length)] : 
                 neutralComments[Math.floor(Math.random() * neutralComments.length)],
        aspects: {
          cleanliness: Math.floor(Math.random() * 2) + rating - 1,
          service: Math.floor(Math.random() * 2) + rating - 1,
          location: Math.floor(Math.random() * 2) + rating - 1,
          value: Math.floor(Math.random() * 2) + rating - 1
        },
        reviewDate,
        source: ['direct', 'google', 'tripadvisor', 'booking.com'][Math.floor(Math.random() * 4)],
        isVerified: Math.random() > 0.2,
        status: 'published'
      });
    }
    
    const createdReviews = await Review.create(reviews);
    console.log(`✅ Created ${createdReviews.length} reviews`);

    // Create Message Templates
    const messageTemplates = await MessageTemplate.create([
      {
        hotelId: mainHotel._id,
        name: 'Welcome Message',
        category: 'welcome',
        subject: 'Welcome to THE PENTOUZ',
        content: 'Dear {{guestName}}, welcome to THE PENTOUZ! Your room {{roomNumber}} is ready. Check-in time: {{checkInTime}}. Enjoy your stay!',
        variables: ['guestName', 'roomNumber', 'checkInTime'],
        isActive: true,
        createdBy: ownerUser._id
      },
      {
        hotelId: mainHotel._id,
        name: 'Checkout Reminder',
        category: 'checkout',
        subject: 'Checkout Reminder - THE PENTOUZ',
        content: 'Dear {{guestName}}, this is a reminder that your checkout is scheduled for {{checkOutTime}} today. Thank you for staying with us!',
        variables: ['guestName', 'checkOutTime'],
        isActive: true,
        createdBy: ownerUser._id
      },
      {
        hotelId: mainHotel._id,
        name: 'Birthday Wishes',
        category: 'special_occasion',
        subject: 'Happy Birthday from THE PENTOUZ',
        content: 'Happy Birthday {{guestName}}! As our valued guest, we have a special surprise waiting for you at the front desk.',
        variables: ['guestName'],
        isActive: true,
        createdBy: ownerUser._id
      }
    ]);
    console.log(`✅ Created ${messageTemplates.length} message templates`);

    // Create Communications
    const communications = [];
    for (let i = 0; i < 30; i++) {
      const guest = createdGuests[Math.floor(Math.random() * createdGuests.length)];
      const template = messageTemplates[Math.floor(Math.random() * messageTemplates.length)];
      const sendDate = new Date(today.getTime() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000);
      
      communications.push({
        hotelId: mainHotel._id,
        guestId: guest._id,
        templateId: template._id,
        type: ['email', 'sms', 'push'][Math.floor(Math.random() * 3)],
        recipient: guest.email,
        subject: template.subject.replace('{{guestName}}', guest.name),
        content: template.content.replace('{{guestName}}', guest.name).replace('{{roomNumber}}', '101').replace('{{checkInTime}}', '3:00 PM').replace('{{checkOutTime}}', '11:00 AM'),
        status: ['sent', 'delivered', 'failed', 'pending'][Math.floor(Math.random() * 4)],
        sendDate,
        sentBy: ownerUser._id
      });
    }
    
    const createdCommunications = await Communication.create(communications);
    console.log(`✅ Created ${createdCommunications.length} communications`);

    // Create Notifications
    const notifications = [];
    for (let i = 0; i < 40; i++) {
      const notificationDate = new Date(today.getTime() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000);
      const recipient = [ownerUser._id, ...createdStaff.map(s => s._id)][Math.floor(Math.random() * (createdStaff.length + 1))];
      
      notifications.push({
        hotelId: mainHotel._id,
        type: ['booking', 'maintenance', 'guest_service', 'payment', 'system'][Math.floor(Math.random() * 5)],
        title: ['New Booking Received', 'Maintenance Required', 'Guest Service Request', 'Payment Processed', 'System Update'][Math.floor(Math.random() * 5)],
        message: ['A new booking has been created', 'Room 101 requires maintenance', 'Guest requested extra towels', 'Payment of ₹5000 received', 'System backup completed'][Math.floor(Math.random() * 5)],
        priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        recipient,
        isRead: Math.random() > 0.4,
        createdDate: notificationDate,
        readDate: Math.random() > 0.4 ? new Date(notificationDate.getTime() + Math.floor(Math.random() * 24) * 60 * 60 * 1000) : null
      });
    }
    
    const createdNotifications = await Notification.create(notifications);
    console.log(`✅ Created ${createdNotifications.length} notifications`);

    // Create Advanced Features & Analytics Models
    console.log('🚀 Creating advanced features & analytics models...');
    
    // Create Special Discounts
    const specialDiscounts = await SpecialDiscount.create([
      { name: 'First Time Guest', type: 'percentage', value: 15, validFrom: today, validUntil: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000), hotelId: mainHotel._id, isActive: true },
      { name: 'Senior Citizen', type: 'percentage', value: 20, validFrom: today, validUntil: new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000), hotelId: mainHotel._id, isActive: true },
      { name: 'Group Booking', type: 'fixed', value: 5000, validFrom: today, validUntil: new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000), hotelId: mainHotel._id, isActive: true }
    ]);
    console.log(`✅ Created ${specialDiscounts.length} special discounts`);

    // Create Special Periods
    const specialPeriods = await SpecialPeriod.create([
      { name: 'Festival Season', startDate: new Date('2024-10-15'), endDate: new Date('2024-11-15'), type: 'peak', multiplier: 1.5, hotelId: mainHotel._id, isActive: true },
      { name: 'Wedding Season', startDate: new Date('2024-12-01'), endDate: new Date('2024-12-31'), type: 'peak', multiplier: 1.8, hotelId: mainHotel._id, isActive: true },
      { name: 'Off Season', startDate: new Date('2024-06-01'), endDate: new Date('2024-09-30'), type: 'low', multiplier: 0.8, hotelId: mainHotel._id, isActive: true }
    ]);
    console.log(`✅ Created ${specialPeriods.length} special periods`);

    // Create Pricing Strategies
    const pricingStrategies = await PricingStrategy.create([
      { name: 'Dynamic Pricing', type: 'dynamic', description: 'AI-driven pricing based on demand', basePrice: 4000, factors: ['occupancy', 'demand', 'season'], hotelId: mainHotel._id, isActive: true },
      { name: 'Fixed Pricing', type: 'fixed', description: 'Standard fixed pricing', basePrice: 3500, factors: ['room_type'], hotelId: mainHotel._id, isActive: true },
      { name: 'Competitive Pricing', type: 'competitive', description: 'Price matching with competitors', basePrice: 3800, factors: ['competitor_rates', 'market_demand'], hotelId: mainHotel._id, isActive: true }
    ]);
    console.log(`✅ Created ${pricingStrategies.length} pricing strategies`);

    // Create Dynamic Pricing records
    const dynamicPricingRecords = [];
    for (let i = 0; i < 20; i++) {
      const roomType = createdRoomTypes[Math.floor(Math.random() * createdRoomTypes.length)];
      const date = new Date(today.getTime() + Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000);
      
      dynamicPricingRecords.push({
        hotelId: mainHotel._id,
        roomTypeId: roomType._id,
        date,
        basePrice: roomType.baseRate,
        calculatedPrice: roomType.baseRate + Math.floor(Math.random() * 1000) - 500,
        occupancyRate: Math.random() * 100,
        demandScore: Math.random() * 10,
        competitorAvgPrice: roomType.baseRate + Math.floor(Math.random() * 500) - 250,
        factors: {
          occupancy: Math.random() * 0.3,
          demand: Math.random() * 0.2,
          seasonal: Math.random() * 0.1,
          competitor: Math.random() * 0.1
        },
        createdBy: 'ai_system'
      });
    }
    
    const createdDynamicPricing = await DynamicPricing.create(dynamicPricingRecords);
    console.log(`✅ Created ${createdDynamicPricing.length} dynamic pricing records`);

    // Create Demand Forecast
    const demandForecasts = [];
    for (let i = 0; i < 15; i++) {
      const forecastDate = new Date(today.getTime() + Math.floor(Math.random() * 60) * 24 * 60 * 60 * 1000);
      
      demandForecasts.push({
        hotelId: mainHotel._id,
        forecastDate,
        predictedOccupancy: Math.random() * 100,
        predictedRevenue: Math.floor(Math.random() * 500000) + 200000,
        confidence: Math.random() * 0.4 + 0.6, // 60-100% confidence
        factors: ['historical_data', 'seasonal_trends', 'market_events'],
        modelVersion: '1.2.0',
        createdBy: 'ai_forecasting'
      });
    }
    
    const createdDemandForecast = await DemandForecast.create(demandForecasts);
    console.log(`✅ Created ${createdDemandForecast.length} demand forecasts`);

    // Create Competitor Monitoring
    const competitorMonitoring = [];
    for (let i = 0; i < 25; i++) {
      const monitorDate = new Date(today.getTime() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000);
      
      competitorMonitoring.push({
        hotelId: mainHotel._id,
        competitorName: ['Hotel Taj', 'ITC Grand', 'Oberoi Hotels', 'Leela Palace', 'Marriott'][Math.floor(Math.random() * 5)],
        roomType: 'deluxe',
        price: Math.floor(Math.random() * 3000) + 3000,
        availability: Math.random() > 0.7,
        rating: Math.random() * 2 + 3, // 3-5 stars
        reviewCount: Math.floor(Math.random() * 1000) + 100,
        amenities: ['WiFi', 'Pool', 'Spa', 'Gym'],
        monitorDate,
        source: ['booking.com', 'expedia', 'agoda', 'direct_website'][Math.floor(Math.random() * 4)]
      });
    }
    
    const createdCompetitorMonitoring = await CompetitorMonitoring.create(competitorMonitoring);
    console.log(`✅ Created ${createdCompetitorMonitoring.length} competitor monitoring records`);

    // Create User Analytics
    const userAnalyticsRecords = [];
    for (let i = 0; i < 30; i++) {
      const user = [...createdStaff, ...createdGuests][Math.floor(Math.random() * (createdStaff.length + createdGuests.length))];
      const sessionDate = new Date(today.getTime() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000);
      
      userAnalyticsRecords.push({
        hotelId: mainHotel._id,
        userId: user._id,
        sessionId: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        sessionStart: sessionDate,
        sessionEnd: new Date(sessionDate.getTime() + Math.floor(Math.random() * 3600000)), // Up to 1 hour
        pageViews: Math.floor(Math.random() * 20) + 1,
        actionsPerformed: Math.floor(Math.random() * 10) + 1,
        deviceType: ['desktop', 'mobile', 'tablet'][Math.floor(Math.random() * 3)],
        browserType: ['chrome', 'firefox', 'safari', 'edge'][Math.floor(Math.random() * 4)],
        ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
        location: { country: 'India', city: 'Mumbai' }
      });
    }
    
    const createdUserAnalytics = await UserAnalytics.create(userAnalyticsRecords);
    console.log(`✅ Created ${createdUserAnalytics.length} user analytics records`);

    // Create Login Sessions
    const loginSessions = [];
    for (let i = 0; i < 40; i++) {
      const user = [...createdStaff, ownerUser][Math.floor(Math.random() * (createdStaff.length + 1))];
      const loginTime = new Date(today.getTime() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000);
      const isActive = Math.random() > 0.7;
      
      loginSessions.push({
        hotelId: mainHotel._id,
        userId: user._id,
        sessionToken: `token_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`,
        loginTime,
        logoutTime: isActive ? null : new Date(loginTime.getTime() + Math.floor(Math.random() * 8) * 60 * 60 * 1000),
        ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        deviceInfo: {
          type: ['desktop', 'mobile', 'tablet'][Math.floor(Math.random() * 3)],
          os: ['Windows', 'iOS', 'Android', 'macOS'][Math.floor(Math.random() * 4)],
          browser: ['Chrome', 'Safari', 'Firefox'][Math.floor(Math.random() * 3)]
        },
        isActive
      });
    }
    
    const createdLoginSessions = await LoginSession.create(loginSessions);
    console.log(`✅ Created ${createdLoginSessions.length} login sessions`);

    // Create Notification Preferences
    const notificationPreferences = [];
    for (const user of [...createdStaff, ...createdGuests].slice(0, 20)) {
      notificationPreferences.push({
        hotelId: mainHotel._id,
        userId: user._id,
        preferences: {
          email: {
            enabled: Math.random() > 0.2,
            booking: Math.random() > 0.1,
            promotional: Math.random() > 0.5,
            maintenance: user.role === 'staff' ? Math.random() > 0.1 : false,
            system: user.role === 'staff' ? Math.random() > 0.3 : false
          },
          sms: {
            enabled: Math.random() > 0.4,
            booking: Math.random() > 0.2,
            promotional: Math.random() > 0.7,
            urgent: Math.random() > 0.1
          },
          push: {
            enabled: Math.random() > 0.3,
            all: Math.random() > 0.5
          }
        },
        createdDate: new Date(today.getTime() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
        lastUpdated: new Date(today.getTime() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000)
      });
    }
    
    const createdNotificationPreferences = await NotificationPreference.create(notificationPreferences);
    console.log(`✅ Created ${createdNotificationPreferences.length} notification preferences`);

    // Create Revenue Reports
    const revenueReports = [];
    for (let i = 0; i < 12; i++) { // 12 months of reports
      const reportDate = new Date(today.getTime() - i * 30 * 24 * 60 * 60 * 1000);
      const roomRevenue = Math.floor(Math.random() * 5000000) + 2000000;
      const fbRevenue = Math.floor(Math.random() * 1000000) + 500000;
      const otherRevenue = Math.floor(Math.random() * 500000) + 100000;
      
      revenueReports.push({
        hotelId: mainHotel._id,
        reportDate,
        period: 'monthly',
        roomRevenue,
        foodBeverageRevenue: fbRevenue,
        otherRevenue,
        totalRevenue: roomRevenue + fbRevenue + otherRevenue,
        totalExpenses: Math.floor((roomRevenue + fbRevenue + otherRevenue) * 0.7),
        netProfit: Math.floor((roomRevenue + fbRevenue + otherRevenue) * 0.3),
        occupancyRate: Math.random() * 30 + 60, // 60-90%
        adr: Math.floor(Math.random() * 2000) + 4000, // 4000-6000
        revpar: Math.floor(Math.random() * 1500) + 3000, // 3000-4500
        createdBy: ownerUser._id
      });
    }
    
    const createdRevenueReports = await RevenueReport.create(revenueReports);
    console.log(`✅ Created ${createdRevenueReports.length} revenue reports`);

    // Create remaining models with minimal data
    
    // Create Content
    const content = await Content.create([
      { title: 'Hotel Welcome Guide', type: 'guide', content: 'Welcome to THE PENTOUZ hotel guide...', language: 'en', hotelId: mainHotel._id, isActive: true },
      { title: 'Hotel Services', type: 'services', content: 'Our hotel offers various services...', language: 'en', hotelId: mainHotel._id, isActive: true }
    ]);
    console.log(`✅ Created ${content.length} content entries`);

    // Create Translations
    const translations = await Translation.create([
      { key: 'welcome_message', language: 'hi', value: 'THE PENTOUZ में आपका स्वागत है', hotelId: mainHotel._id, isActive: true },
      { key: 'checkout_time', language: 'hi', value: 'चेकआउट समय', hotelId: mainHotel._id, isActive: true }
    ]);
    console.log(`✅ Created ${translations.length} translations`);

    // Create Digital Keys
    const digitalKeys = [];
    for (let i = 0; i < 15; i++) {
      const room = createdRooms[Math.floor(Math.random() * createdRooms.length)];
      const guest = createdGuests[Math.floor(Math.random() * createdGuests.length)];
      const issueDate = new Date(today.getTime() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000);
      
      digitalKeys.push({
        hotelId: mainHotel._id,
        roomId: room._id,
        guestId: guest._id,
        keyCode: `DK${Date.now()}${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
        issueDate,
        expiryDate: new Date(issueDate.getTime() + 7 * 24 * 60 * 60 * 1000),
        status: ['active', 'expired', 'revoked'][Math.floor(Math.random() * 3)],
        accessLevel: 'guest'
      });
    }
    
    const createdDigitalKeys = await DigitalKey.create(digitalKeys);
    console.log(`✅ Created ${createdDigitalKeys.length} digital keys`);

    // Create Laundry Transactions
    const laundryTransactions = [];
    for (let i = 0; i < 20; i++) {
      const guest = createdGuests[Math.floor(Math.random() * createdGuests.length)];
      const room = createdRooms[Math.floor(Math.random() * createdRooms.length)];
      const requestDate = new Date(today.getTime() - Math.floor(Math.random() * 14) * 24 * 60 * 60 * 1000);
      
      laundryTransactions.push({
        hotelId: mainHotel._id,
        guestId: guest._id,
        roomId: room._id,
        items: [
          { type: 'shirt', quantity: Math.floor(Math.random() * 5) + 1, price: 100 },
          { type: 'trousers', quantity: Math.floor(Math.random() * 3) + 1, price: 150 }
        ],
        totalAmount: Math.floor(Math.random() * 1000) + 200,
        status: ['pending', 'in_progress', 'completed', 'delivered'][Math.floor(Math.random() * 4)],
        requestDate,
        completedDate: Math.random() > 0.3 ? new Date(requestDate.getTime() + 24 * 60 * 60 * 1000) : null
      });
    }
    
    const createdLaundryTransactions = await LaundryTransaction.create(laundryTransactions);
    console.log(`✅ Created ${createdLaundryTransactions.length} laundry transactions`);

    // Create Incident Reports
    const incidentReports = [];
    for (let i = 0; i < 8; i++) { // Keep this low as these are serious incidents
      const reportDate = new Date(today.getTime() - Math.floor(Math.random() * 90) * 24 * 60 * 60 * 1000);
      const room = Math.random() > 0.5 ? createdRooms[Math.floor(Math.random() * createdRooms.length)] : null;
      
      incidentReports.push({
        hotelId: mainHotel._id,
        title: ['Fire Alarm Malfunction', 'Power Outage', 'Water Leak', 'Guest Accident'][Math.floor(Math.random() * 4)],
        description: 'Incident description and details of what happened',
        category: ['safety', 'security', 'maintenance', 'medical'][Math.floor(Math.random() * 4)],
        severity: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        status: ['open', 'investigating', 'resolved'][Math.floor(Math.random() * 3)],
        roomId: room ? room._id : null,
        reportedBy: ownerUser._id,
        reportDate,
        actionsTaken: ['Maintenance called', 'Emergency services contacted', 'Area cordoned off']
      });
    }
    
    const createdIncidentReports = await IncidentReport.create(incidentReports);
    console.log(`✅ Created ${createdIncidentReports.length} incident reports`);

    // Create Lost & Found items
    const lostFoundItems = [];
    for (let i = 0; i < 15; i++) {
      const foundDate = new Date(today.getTime() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000);
      const room = createdRooms[Math.floor(Math.random() * createdRooms.length)];
      
      lostFoundItems.push({
        hotelId: mainHotel._id,
        itemName: ['Phone Charger', 'Sunglasses', 'Watch', 'Book', 'Jewelry', 'Wallet'][Math.floor(Math.random() * 6)],
        description: 'Item found in hotel premises',
        category: ['electronics', 'accessories', 'clothing', 'documents'][Math.floor(Math.random() * 4)],
        foundLocation: `Room ${room.roomNumber}`,
        foundDate,
        status: ['unclaimed', 'claimed', 'disposed'][Math.floor(Math.random() * 3)],
        foundBy: createdStaff[Math.floor(Math.random() * createdStaff.length)]._id
      });
    }
    
    const createdLostFound = await LostFound.create(lostFoundItems);
    console.log(`✅ Created ${createdLostFound.length} lost & found items`);

    // Create Corporate & Rate Management Models
    console.log('🏢 Creating corporate & rate management models...');
    
    // Create Corporate Companies
    const corporateCompanies = await CorporateCompany.create([
      {
        name: 'Tech Solutions Pvt Ltd',
        code: 'TECH001',
        address: {
          street: 'IT Park, Phase 2',
          city: 'Bangalore',
          state: 'Karnataka',
          country: 'India',
          zipCode: '560066'
        },
        contact: {
          phone: '+91-80-12345678',
          email: 'bookings@techsolutions.com',
          website: 'https://techsolutions.com'
        },
        contractDetails: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
          discountPercentage: 15,
          creditLimit: 500000,
          paymentTerms: '30 days'
        },
        hotelId: mainHotel._id,
        isActive: true
      },
      {
        name: 'Global Finance Corp',
        code: 'GFC001',
        address: {
          street: 'BKC, Plot 123',
          city: 'Mumbai',
          state: 'Maharashtra',
          country: 'India',
          zipCode: '400051'
        },
        contact: {
          phone: '+91-22-87654321',
          email: 'travel@globalfinance.com',
          website: 'https://globalfinance.com'
        },
        contractDetails: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2025-12-31'),
          discountPercentage: 20,
          creditLimit: 1000000,
          paymentTerms: '45 days'
        },
        hotelId: mainHotel._id,
        isActive: true
      },
      {
        name: 'Manufacturing Industries Ltd',
        code: 'MIL001',
        address: {
          street: 'Industrial Area, Sector 5',
          city: 'Chennai',
          state: 'Tamil Nadu',
          country: 'India',
          zipCode: '600032'
        },
        contact: {
          phone: '+91-44-99887766',
          email: 'admin@milindustries.com',
          website: 'https://milindustries.com'
        },
        contractDetails: {
          startDate: new Date('2024-03-01'),
          endDate: new Date('2024-12-31'),
          discountPercentage: 12,
          creditLimit: 300000,
          paymentTerms: '30 days'
        },
        hotelId: mainHotel._id,
        isActive: true
      }
    ]);
    console.log(`✅ Created ${corporateCompanies.length} corporate companies`);

    // Create Corporate Credit records
    const corporateCredits = [];
    for (let i = 0; i < 15; i++) {
      const company = corporateCompanies[Math.floor(Math.random() * corporateCompanies.length)];
      const transactionDate = new Date(today.getTime() - Math.floor(Math.random() * 60) * 24 * 60 * 60 * 1000);
      const amount = Math.floor(Math.random() * 50000) + 5000;
      
      corporateCredits.push({
        hotelId: mainHotel._id,
        companyId: company._id,
        companyName: company.name,
        transactionType: ['charge', 'payment', 'adjustment'][Math.floor(Math.random() * 3)],
        amount,
        description: ['Room booking charges', 'Conference hall booking', 'Catering services', 'Payment received', 'Credit adjustment'][Math.floor(Math.random() * 5)],
        transactionDate,
        reference: `CC-${Date.now()}-${i}`,
        approvedBy: ownerUser._id,
        status: ['pending', 'approved', 'processed'][Math.floor(Math.random() * 3)]
      });
    }
    
    const createdCorporateCredits = await CorporateCredit.create(corporateCredits);
    console.log(`✅ Created ${createdCorporateCredits.length} corporate credit records`);

    // Create Centralized Rates
    const centralizedRates = [];
    for (const roomType of createdRoomTypes) {
      for (let i = 0; i < 4; i++) {
        const season = ['low', 'medium', 'high', 'peak'][i];
        const multiplier = [0.8, 1.0, 1.3, 1.6][i];
        
        centralizedRates.push({
          hotelId: mainHotel._id,
          roomTypeId: roomType._id,
          rateName: `${roomType.name} - ${season.toUpperCase()} Season`,
          baseRate: Math.floor(roomType.baseRate * multiplier),
          currency: 'INR',
          season,
          validFrom: new Date('2024-01-01'),
          validUntil: new Date('2024-12-31'),
          minLengthOfStay: 1,
          maxLengthOfStay: 30,
          applicableDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
          restrictions: {
            advanceBooking: 0,
            blackoutDates: []
          },
          isActive: true,
          createdBy: ownerUser._id
        });
      }
    }
    
    const createdCentralizedRates = await CentralizedRate.create(centralizedRates);
    console.log(`✅ Created ${createdCentralizedRates.length} centralized rates`);

    // Create Rate Mappings
    const rateMappings = [];
    for (const hotel of allHotels.slice(0, 3)) { // First 3 hotels
      for (const rate of createdCentralizedRates.slice(0, 8)) { // First 8 rates
        rateMappings.push({
          hotelId: hotel._id,
          centralizedRateId: rate._id,
          localRate: rate.baseRate + Math.floor(Math.random() * 500) - 250, // ±250 variance
          isActive: Math.random() > 0.2,
          effectiveDate: new Date('2024-01-01'),
          lastSyncDate: new Date(today.getTime() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000),
          syncStatus: ['synced', 'pending', 'error'][Math.floor(Math.random() * 3)]
        });
      }
    }
    
    const createdRateMappings = await RateMapping.create(rateMappings);
    console.log(`✅ Created ${createdRateMappings.length} rate mappings`);

    // Create Room Inventory Templates
    const roomInventoryTemplates = [];
    for (const roomType of createdRoomTypes) {
      roomInventoryTemplates.push({
        hotelId: mainHotel._id,
        name: `${roomType.name} Inventory Template`,
        description: `Standard inventory template for ${roomType.name}`,
        roomTypeId: roomType._id,
        defaultAllocation: roomType.totalRooms,
        restrictions: {
          minLengthOfStay: 1,
          maxLengthOfStay: 30,
          stopSell: false,
          closeToArrival: false,
          closeToDeparture: false
        },
        isActive: true,
        createdBy: ownerUser._id
      });
    }
    
    const createdRoomInventoryTemplates = await RoomInventoryTemplate.create(roomInventoryTemplates);
    console.log(`✅ Created ${createdRoomInventoryTemplates.length} room inventory templates`);

    // Create Room Inventory records
    const roomInventoryRecords = [];
    for (let dayOffset = 0; dayOffset < 30; dayOffset++) { // Next 30 days
      const inventoryDate = new Date(today.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      
      for (const template of createdRoomInventoryTemplates) {
        const allocated = template.defaultAllocation;
        const sold = Math.floor(Math.random() * Math.min(allocated, 8));
        const blocked = Math.floor(Math.random() * 2);
        
        roomInventoryRecords.push({
          hotelId: mainHotel._id,
          roomTypeId: template.roomTypeId,
          templateId: template._id,
          date: inventoryDate,
          allocated,
          sold,
          blocked,
          available: allocated - sold - blocked,
          rate: createdRoomTypes.find(rt => rt._id.toString() === template.roomTypeId.toString()).baseRate,
          restrictions: template.restrictions,
          lastUpdated: new Date(today.getTime() - Math.floor(Math.random() * 24) * 60 * 60 * 1000)
        });
      }
    }
    
    const createdRoomInventory = await RoomInventory.create(roomInventoryRecords);
    console.log(`✅ Created ${createdRoomInventory.length} room inventory records`);

    // Create Room Mappings (for OTA integration)
    const roomMappings = [];
    const otaChannels = ['booking.com', 'expedia', 'agoda', 'airbnb'];
    
    for (const roomType of createdRoomTypes) {
      for (const channel of otaChannels) {
        roomMappings.push({
          hotelId: mainHotel._id,
          roomTypeId: roomType._id,
          channel,
          externalRoomId: `${channel.replace('.', '_').toUpperCase()}_${roomType.code}_${Math.random().toString(36).substr(2, 6)}`,
          externalRoomName: `${roomType.name} - ${channel}`,
          mapping: {
            amenities: roomType.amenities,
            maxOccupancy: roomType.specifications.maxOccupancy,
            bedType: roomType.specifications.bedType
          },
          isActive: true,
          lastSyncDate: new Date(today.getTime() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000),
          syncStatus: ['active', 'inactive', 'error'][Math.floor(Math.random() * 3)]
        });
      }
    }
    
    const createdRoomMappings = await RoomMapping.create(roomMappings);
    console.log(`✅ Created ${createdRoomMappings.length} room mappings`);

    // Create Arrival/Departure Modes
    const arrivalDepartureModes = await ArrivalDepartureMode.create([
      {
        hotelId: mainHotel._id,
        name: 'Walk-in',
        type: 'arrival',
        description: 'Guest arrives without prior booking',
        isDefault: false,
        requiresApproval: false,
        allowedRoles: ['admin', 'manager', 'staff'],
        isActive: true
      },
      {
        hotelId: mainHotel._id,
        name: 'Pre-booked',
        type: 'arrival',
        description: 'Guest has confirmed reservation',
        isDefault: true,
        requiresApproval: false,
        allowedRoles: ['admin', 'manager', 'staff'],
        isActive: true
      },
      {
        hotelId: mainHotel._id,
        name: 'Early Arrival',
        type: 'arrival',
        description: 'Guest arrives before standard check-in time',
        isDefault: false,
        requiresApproval: true,
        allowedRoles: ['admin', 'manager'],
        isActive: true
      },
      {
        hotelId: mainHotel._id,
        name: 'Standard Checkout',
        type: 'departure',
        description: 'Regular checkout at scheduled time',
        isDefault: true,
        requiresApproval: false,
        allowedRoles: ['admin', 'manager', 'staff'],
        isActive: true
      },
      {
        hotelId: mainHotel._id,
        name: 'Late Checkout',
        type: 'departure',
        description: 'Checkout after standard time',
        isDefault: false,
        requiresApproval: true,
        allowedRoles: ['admin', 'manager'],
        isActive: true
      },
      {
        hotelId: mainHotel._id,
        name: 'Express Checkout',
        type: 'departure',
        description: 'Quick checkout without front desk',
        isDefault: false,
        requiresApproval: false,
        allowedRoles: ['admin', 'manager', 'staff'],
        isActive: true
      }
    ]);
    console.log(`✅ Created ${arrivalDepartureModes.length} arrival/departure modes`);

    // Create Custom Fields
    const customFields = await CustomField.create([
      {
        hotelId: mainHotel._id,
        name: 'Special Dietary Requirements',
        fieldType: 'text',
        category: 'guest',
        description: 'Guest dietary restrictions or preferences',
        isRequired: false,
        isActive: true,
        options: [],
        validationRules: {
          maxLength: 200
        },
        createdBy: ownerUser._id
      },
      {
        hotelId: mainHotel._id,
        name: 'Preferred Room Floor',
        fieldType: 'select',
        category: 'guest',
        description: 'Guest preferred floor number',
        isRequired: false,
        isActive: true,
        options: [
          { label: 'Ground Floor', value: '0' },
          { label: '1st Floor', value: '1' },
          { label: '2nd Floor', value: '2' },
          { label: '3rd Floor', value: '3' },
          { label: 'High Floor', value: 'high' }
        ],
        validationRules: {},
        createdBy: ownerUser._id
      },
      {
        hotelId: mainHotel._id,
        name: 'Anniversary Date',
        fieldType: 'date',
        category: 'guest',
        description: 'Guest anniversary date for special occasions',
        isRequired: false,
        isActive: true,
        options: [],
        validationRules: {},
        createdBy: ownerUser._id
      },
      {
        hotelId: mainHotel._id,
        name: 'Corporate Code',
        fieldType: 'text',
        category: 'booking',
        description: 'Corporate discount code',
        isRequired: false,
        isActive: true,
        options: [],
        validationRules: {
          pattern: '^[A-Z0-9]{6,12}$',
          maxLength: 12
        },
        createdBy: ownerUser._id
      },
      {
        hotelId: mainHotel._id,
        name: 'Travel Purpose',
        fieldType: 'select',
        category: 'booking',
        description: 'Purpose of travel',
        isRequired: false,
        isActive: true,
        options: [
          { label: 'Business', value: 'business' },
          { label: 'Leisure', value: 'leisure' },
          { label: 'Conference', value: 'conference' },
          { label: 'Wedding', value: 'wedding' },
          { label: 'Other', value: 'other' }
        ],
        validationRules: {},
        createdBy: ownerUser._id
      },
      {
        hotelId: mainHotel._id,
        name: 'Room Accessibility Needs',
        fieldType: 'multi_select',
        category: 'room',
        description: 'Accessibility requirements for the room',
        isRequired: false,
        isActive: true,
        options: [
          { label: 'Wheelchair Accessible', value: 'wheelchair' },
          { label: 'Hearing Impaired Support', value: 'hearing' },
          { label: 'Visual Impaired Support', value: 'visual' },
          { label: 'Grab Bars', value: 'grab_bars' },
          { label: 'Roll-in Shower', value: 'roll_in_shower' }
        ],
        validationRules: {},
        createdBy: ownerUser._id
      }
    ]);
    console.log(`✅ Created ${customFields.length} custom fields`);

    // Create Additional Missing Models
    console.log('📚 Creating additional missing models...');
    
    // Create Shared Resources
    const sharedResources = await SharedResource.create([
      {
        hotelId: mainHotel._id,
        name: 'Conference Room A',
        type: 'meeting_room',
        description: 'Large conference room with projector and audio system',
        capacity: 50,
        location: 'First Floor',
        amenities: ['projector', 'audio_system', 'whiteboard', 'wifi'],
        hourlyRate: 2000,
        isActive: true,
        availability: {
          monday: { start: '09:00', end: '18:00' },
          tuesday: { start: '09:00', end: '18:00' },
          wednesday: { start: '09:00', end: '18:00' },
          thursday: { start: '09:00', end: '18:00' },
          friday: { start: '09:00', end: '18:00' },
          saturday: { start: '10:00', end: '16:00' },
          sunday: { start: 'closed', end: 'closed' }
        }
      },
      {
        hotelId: mainHotel._id,
        name: 'Banquet Hall',
        type: 'event_space',
        description: 'Grand banquet hall for weddings and large events',
        capacity: 200,
        location: 'Ground Floor',
        amenities: ['stage', 'sound_system', 'lighting', 'dance_floor'],
        hourlyRate: 8000,
        isActive: true,
        availability: {
          monday: { start: '10:00', end: '22:00' },
          tuesday: { start: '10:00', end: '22:00' },
          wednesday: { start: '10:00', end: '22:00' },
          thursday: { start: '10:00', end: '22:00' },
          friday: { start: '10:00', end: '23:00' },
          saturday: { start: '10:00', end: '23:00' },
          sunday: { start: '10:00', end: '22:00' }
        }
      },
      {
        hotelId: mainHotel._id,
        name: 'Business Center',
        type: 'workspace',
        description: 'Fully equipped business center with computers and printers',
        capacity: 20,
        location: 'Lobby Level',
        amenities: ['computers', 'printers', 'scanners', 'internet'],
        hourlyRate: 500,
        isActive: true,
        availability: {
          monday: { start: '06:00', end: '22:00' },
          tuesday: { start: '06:00', end: '22:00' },
          wednesday: { start: '06:00', end: '22:00' },
          thursday: { start: '06:00', end: '22:00' },
          friday: { start: '06:00', end: '22:00' },
          saturday: { start: '08:00', end: '20:00' },
          sunday: { start: '08:00', end: '20:00' }
        }
      }
    ]);
    console.log(`✅ Created ${sharedResources.length} shared resources`);

    // Create Supply Requests
    const supplyRequests = [];
    for (let i = 0; i < 20; i++) {
      const requestDate = new Date(today.getTime() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000);
      const requester = createdStaff[Math.floor(Math.random() * createdStaff.length)];
      
      supplyRequests.push({
        hotelId: mainHotel._id,
        requestNumber: `SR-${Date.now()}-${i}`,
        requestedBy: requester._id,
        department: ['housekeeping', 'maintenance', 'front_office', 'kitchen'][Math.floor(Math.random() * 4)],
        items: [
          {
            name: ['Cleaning Supplies', 'Towels', 'Bed Sheets', 'Light Bulbs', 'Paper Supplies'][Math.floor(Math.random() * 5)],
            quantity: Math.floor(Math.random() * 50) + 10,
            unit: ['pieces', 'sets', 'boxes', 'bottles'][Math.floor(Math.random() * 4)],
            urgency: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)]
          }
        ],
        status: ['pending', 'approved', 'ordered', 'received', 'rejected'][Math.floor(Math.random() * 5)],
        requestDate,
        requiredBy: new Date(requestDate.getTime() + Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000),
        notes: 'Standard supply request for daily operations',
        totalEstimatedCost: Math.floor(Math.random() * 10000) + 1000
      });
    }
    
    const createdSupplyRequests = await SupplyRequest.create(supplyRequests);
    console.log(`✅ Created ${createdSupplyRequests.length} supply requests`);

    // Create MeetUp Requests
    const meetUpRequests = [];
    for (let i = 0; i < 15; i++) {
      const requestDate = new Date(today.getTime() - Math.floor(Math.random() * 14) * 24 * 60 * 60 * 1000);
      const organizer = createdStaff[Math.floor(Math.random() * createdStaff.length)];
      const resource = sharedResources[Math.floor(Math.random() * sharedResources.length)];
      
      meetUpRequests.push({
        hotelId: mainHotel._id,
        requestNumber: `MU-${Date.now()}-${i}`,
        organizer: organizer._id,
        title: ['Department Meeting', 'Training Session', 'Team Building', 'Client Presentation'][Math.floor(Math.random() * 4)],
        description: 'Team meeting for project coordination and updates',
        resourceId: resource._id,
        requestedDate: new Date(requestDate.getTime() + Math.floor(Math.random() * 14) * 24 * 60 * 60 * 1000),
        startTime: ['09:00', '10:00', '14:00', '15:00'][Math.floor(Math.random() * 4)],
        endTime: ['11:00', '12:00', '16:00', '17:00'][Math.floor(Math.random() * 4)],
        attendeeCount: Math.floor(Math.random() * 20) + 5,
        status: ['pending', 'approved', 'confirmed', 'completed', 'cancelled'][Math.floor(Math.random() * 5)],
        requestDate,
        specialRequirements: ['Projector setup', 'Catering required', 'Video conferencing'][Math.floor(Math.random() * 3)]
      });
    }
    
    const createdMeetUpRequests = await MeetUpRequest.create(meetUpRequests);
    console.log(`✅ Created ${createdMeetUpRequests.length} meetup requests`);

    // Create Tape Chart data
    const tapeChartData = [];
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) { // Next 7 days
      const chartDate = new Date(today.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      
      for (const room of createdRooms.slice(0, 20)) { // First 20 rooms
        tapeChartData.push({
          hotelId: mainHotel._id,
          date: chartDate,
          roomId: room._id,
          roomNumber: room.roomNumber,
          status: ['occupied', 'vacant_clean', 'vacant_dirty', 'out_of_order', 'maintenance'][Math.floor(Math.random() * 5)],
          guestName: Math.random() > 0.5 ? createdGuests[Math.floor(Math.random() * createdGuests.length)].name : null,
          checkIn: Math.random() > 0.7 ? new Date(chartDate.getTime() + 15 * 60 * 60 * 1000) : null, // 3 PM
          checkOut: Math.random() > 0.7 ? new Date(chartDate.getTime() + 11 * 60 * 60 * 1000) : null, // 11 AM
          rate: room.currentRate,
          source: ['direct', 'online', 'walk_in'][Math.floor(Math.random() * 3)],
          notes: Math.random() > 0.8 ? 'VIP Guest' : ''
        });
      }
    }
    
    const createdTapeChart = await TapeChart.create(tapeChartData);
    console.log(`✅ Created ${createdTapeChart.length} tape chart records`);

    // Add group bookings to main Booking collection (will be added to allBookings array later)
    const groupBookingsForMainCollection = [];
    for (let i = 0; i < 8; i++) {
      const checkInDate = new Date(today.getTime() + Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000);
      const nights = Math.floor(Math.random() * 4) + 2; // 2-5 nights
      const roomCount = Math.floor(Math.random() * 5) + 2; // 2-6 rooms per booking (we'll create individual bookings)
      const groupName = ['Tech Conference 2024', 'Wedding Party - Sharma', 'Corporate Retreat - TechCorp', 'Medical Conference'][Math.floor(Math.random() * 4)];
      const baseRate = 4000;
      
      // Create individual bookings for each room in the group
      for (let roomIndex = 0; roomIndex < roomCount; roomIndex++) {
        const guest = createdGuests[Math.floor(Math.random() * createdGuests.length)];
        const room = createdRooms[Math.floor(Math.random() * createdRooms.length)];
        
        groupBookingsForMainCollection.push({
          hotelId: mainHotel._id,
          userId: guest._id,
          rooms: [{
            roomId: room._id,
            rate: baseRate
          }],
          checkIn: checkInDate,
          checkOut: new Date(checkInDate.getTime() + nights * 24 * 60 * 60 * 1000),
          nights,
          status: ['confirmed', 'pending', 'checked_in', 'checked_out'][Math.floor(Math.random() * 4)],
          paymentStatus: ['paid', 'partial', 'pending'][Math.floor(Math.random() * 3)],
          totalAmount: baseRate * nights,
          currency: 'INR',
          guestDetails: {
            adults: 2,
            children: Math.floor(Math.random() * 2),
            specialRequests: `Group Booking: ${groupName} - Room ${roomIndex + 1} of ${roomCount}`
          },
          bookingNumber: `GRP${Date.now()}${i.toString().padStart(2, '0')}${roomIndex.toString().padStart(2, '0')}`,
          source: 'direct',
          channelBookingId: `GROUP-${Date.now()}-${i}-${roomIndex}`,
          idempotencyKey: `group-seed-${i}-${roomIndex}-${Date.now()}`,
          bookingType: 'group',
          groupDetails: {
            groupName,
            groupCode: `GRP-${Date.now()}-${i}`,
            groupLeader: createdGuests[0].name,
            totalRooms: roomCount,
            roomNumber: roomIndex + 1
          }
        });
      }
    }
    
    console.log(`✅ Prepared ${groupBookingsForMainCollection.length} group bookings for main Booking collection`);

    // Create Day Use Slots
    const dayUseSlots = await DayUseSlot.create([
      {
        hotelId: mainHotel._id,
        name: 'Morning Slot',
        startTime: '06:00',
        endTime: '12:00',
        duration: 6,
        maxCapacity: 20,
        price: 2000,
        isActive: true,
        applicableDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      },
      {
        hotelId: mainHotel._id,
        name: 'Afternoon Slot',
        startTime: '12:00',
        endTime: '18:00',
        duration: 6,
        maxCapacity: 25,
        price: 2500,
        isActive: true,
        applicableDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      },
      {
        hotelId: mainHotel._id,
        name: 'Evening Slot',
        startTime: '18:00',
        endTime: '23:00',
        duration: 5,
        maxCapacity: 15,
        price: 3000,
        isActive: true,
        applicableDays: ['friday', 'saturday', 'sunday']
      }
    ]);
    console.log(`✅ Created ${dayUseSlots.length} day use slots`);

    // Add day use bookings to main Booking collection (will be added to allBookings array later)
    const dayUseBookingsForMainCollection = [];
    for (let i = 0; i < 12; i++) {
      const guest = createdGuests[Math.floor(Math.random() * createdGuests.length)];
      const slot = dayUseSlots[Math.floor(Math.random() * dayUseSlots.length)];
      const room = createdRooms[Math.floor(Math.random() * createdRooms.length)];
      const useDate = new Date(today.getTime() + Math.floor(Math.random() * 14) * 24 * 60 * 60 * 1000);
      
      // Day use bookings are same-day check-in and check-out
      const checkInTime = new Date(useDate);
      checkInTime.setHours(parseInt(slot.startTime.split(':')[0]), parseInt(slot.startTime.split(':')[1]));
      const checkOutTime = new Date(useDate);
      checkOutTime.setHours(parseInt(slot.endTime.split(':')[0]), parseInt(slot.endTime.split(':')[1]));
      
      dayUseBookingsForMainCollection.push({
        hotelId: mainHotel._id,
        userId: guest._id,
        rooms: [{
          roomId: room._id,
          rate: slot.price
        }],
        checkIn: checkInTime,
        checkOut: checkOutTime,
        nights: 0, // Day use is 0 nights
        status: ['confirmed', 'checked_in', 'completed', 'cancelled'][Math.floor(Math.random() * 4)],
        paymentStatus: ['paid', 'pending'][Math.floor(Math.random() * 2)],
        totalAmount: slot.price,
        currency: 'INR',
        guestDetails: {
          adults: Math.floor(Math.random() * 4) + 1,
          children: Math.floor(Math.random() * 2),
          specialRequests: `Day Use: ${slot.name} (${slot.startTime}-${slot.endTime}) - Pool & Gym Access${Math.random() > 0.7 ? ', Extra towels required' : ''}`
        },
        bookingNumber: `DU${Date.now()}${i.toString().padStart(3, '0')}`,
        source: 'direct',
        channelBookingId: `DAYUSE-${Date.now()}-${i}`,
        idempotencyKey: `dayuse-seed-${i}-${Date.now()}`,
        bookingType: 'day_use',
        dayUseDetails: {
          slotId: slot._id,
          slotName: slot.name,
          startTime: slot.startTime,
          endTime: slot.endTime,
          services: ['pool_access', 'gym_access', 'restaurant_access']
        }
      });
    }
    
    console.log(`✅ Prepared ${dayUseBookingsForMainCollection.length} day use bookings for main Booking collection`);

    // Create Web Configuration
    const webConfiguration = await WebConfiguration.create({
      hotelId: mainHotel._id,
      siteName: 'THE PENTOUZ',
      domain: 'thepentouz.com',
      logo: '/assets/logo.png',
      favicon: '/assets/favicon.ico',
      theme: {
        primaryColor: '#1a365d',
        secondaryColor: '#2d3748',
        accentColor: '#f59e0b',
        fontFamily: 'Inter, sans-serif'
      },
      seo: {
        metaTitle: 'THE PENTOUZ - Luxury Hotel Experience',
        metaDescription: 'Experience luxury and comfort at THE PENTOUZ hotel. Premium amenities, exceptional service, and unforgettable stays.',
        keywords: ['luxury hotel', 'premium accommodation', 'business hotel', 'vacation stay'],
        robots: 'index,follow'
      },
      analytics: {
        googleAnalyticsId: 'GA-XXXX-XXXX',
        facebookPixelId: 'FB-XXXX-XXXX',
        hotjarId: 'HJ-XXXX-XXXX'
      },
      socialMedia: {
        facebook: 'https://facebook.com/thepentouz',
        instagram: 'https://instagram.com/thepentouz',
        twitter: 'https://twitter.com/thepentouz',
        linkedin: 'https://linkedin.com/company/thepentouz'
      },
      features: {
        onlineBooking: true,
        multiLanguage: true,
        multiCurrency: true,
        chatSupport: true,
        virtualTour: false
      },
      isActive: true,
      createdBy: ownerUser._id
    });
    console.log(`✅ Created web configuration`);

    // Create Room Type Allotments
    const roomTypeAllotments = [];
    for (const roomType of createdRoomTypes) {
      for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
        const allotmentDate = new Date(today.getTime() + dayOffset * 24 * 60 * 60 * 1000);
        const totalRooms = roomType.totalRooms;
        const allocatedRooms = Math.floor(totalRooms * 0.8); // 80% allocation
        
        roomTypeAllotments.push({
          hotelId: mainHotel._id,
          roomTypeId: roomType._id,
          date: allotmentDate,
          totalRooms,
          allocatedRooms,
          soldRooms: Math.floor(Math.random() * Math.min(allocatedRooms, 6)),
          blockedRooms: Math.floor(Math.random() * 2),
          availableRooms: allocatedRooms - Math.floor(Math.random() * Math.min(allocatedRooms, 6)) - Math.floor(Math.random() * 2),
          rate: roomType.baseRate + Math.floor(Math.random() * 500) - 250,
          restrictions: {
            minLengthOfStay: 1,
            maxLengthOfStay: 30,
            stopSell: false,
            closeToArrival: false,
            closeToDeparture: false
          }
        });
      }
    }
    
    const createdRoomTypeAllotments = await RoomTypeAllotment.create(roomTypeAllotments);
    console.log(`✅ Created ${createdRoomTypeAllotments.length} room type allotments`);

    // Create Stop Sell Rules
    const stopSellRules = [];
    for (let i = 0; i < 5; i++) {
      const startDate = new Date(today.getTime() + Math.floor(Math.random() * 60) * 24 * 60 * 60 * 1000);
      const roomType = createdRoomTypes[Math.floor(Math.random() * createdRoomTypes.length)];
      
      stopSellRules.push({
        hotelId: mainHotel._id,
        name: `Stop Sell - ${roomType.name} - ${startDate.toISOString().split('T')[0]}`,
        roomTypeId: roomType._id,
        startDate,
        endDate: new Date(startDate.getTime() + Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000),
        reason: ['Maintenance', 'High Demand', 'Renovation', 'Special Event'][Math.floor(Math.random() * 4)],
        channels: ['all'],
        isActive: true,
        createdBy: ownerUser._id
      });
    }
    
    const createdStopSellRules = await StopSellRule.create(stopSellRules);
    console.log(`✅ Created ${createdStopSellRules.length} stop sell rules`);

    // Create Channel Configurations
    const channelConfigurations = await ChannelConfiguration.create([
      {
        hotelId: mainHotel._id,
        channelName: 'Booking.com',
        channelCode: 'BDC',
        isActive: true,
        connectionStatus: 'connected',
        apiEndpoint: 'https://api.booking.com/v1/',
        authentication: {
          type: 'api_key',
          credentials: { apiKey: 'bdc_api_key_encrypted' }
        },
        syncSettings: {
          inventorySync: true,
          rateSync: true,
          availabilitySync: true,
          bookingSync: true,
          syncFrequency: 15 // minutes
        },
        commission: 15,
        currency: 'INR'
      },
      {
        hotelId: mainHotel._id,
        channelName: 'Expedia',
        channelCode: 'EXP',
        isActive: true,
        connectionStatus: 'connected',
        apiEndpoint: 'https://api.expedia.com/v3/',
        authentication: {
          type: 'oauth',
          credentials: { clientId: 'exp_client_id', clientSecret: 'exp_secret_encrypted' }
        },
        syncSettings: {
          inventorySync: true,
          rateSync: true,
          availabilitySync: true,
          bookingSync: true,
          syncFrequency: 30
        },
        commission: 18,
        currency: 'INR'
      },
      {
        hotelId: mainHotel._id,
        channelName: 'Agoda',
        channelCode: 'AGD',
        isActive: true,
        connectionStatus: 'error',
        apiEndpoint: 'https://api.agoda.com/v2/',
        authentication: {
          type: 'api_key',
          credentials: { apiKey: 'agd_api_key_encrypted' }
        },
        syncSettings: {
          inventorySync: true,
          rateSync: true,
          availabilitySync: true,
          bookingSync: true,
          syncFrequency: 60
        },
        commission: 16,
        currency: 'INR'
      }
    ]);
    console.log(`✅ Created ${channelConfigurations.length} channel configurations`);

    // Create OTA Payloads
    const otaPayloads = [];
    for (let i = 0; i < 25; i++) {
      const channel = channelConfigurations[Math.floor(Math.random() * channelConfigurations.length)];
      const sentDate = new Date(today.getTime() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000);
      
      otaPayloads.push({
        hotelId: mainHotel._id,
        channelId: channel._id,
        channelName: channel.channelName,
        payloadType: ['inventory', 'rate', 'availability', 'booking'][Math.floor(Math.random() * 4)],
        payload: {
          roomType: createdRoomTypes[Math.floor(Math.random() * createdRoomTypes.length)]._id,
          date: sentDate,
          data: { rooms: Math.floor(Math.random() * 20) + 5, rate: Math.floor(Math.random() * 3000) + 2000 }
        },
        status: ['sent', 'acknowledged', 'processed', 'failed'][Math.floor(Math.random() * 4)],
        sentDate,
        responseDate: Math.random() > 0.2 ? new Date(sentDate.getTime() + Math.floor(Math.random() * 3600000)) : null,
        errorMessage: Math.random() > 0.8 ? 'Rate validation failed' : null,
        retryCount: Math.floor(Math.random() * 3)
      });
    }
    
    const createdOTAPayloads = await OTAPayload.create(otaPayloads);
    console.log(`✅ Created ${createdOTAPayloads.length} OTA payloads`);

    // Create Sync History
    const syncHistory = [];
    for (let i = 0; i < 30; i++) {
      const channel = channelConfigurations[Math.floor(Math.random() * channelConfigurations.length)];
      const syncDate = new Date(today.getTime() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000);
      
      syncHistory.push({
        hotelId: mainHotel._id,
        channelId: channel._id,
        channelName: channel.channelName,
        syncType: ['inventory', 'rates', 'availability', 'bookings'][Math.floor(Math.random() * 4)],
        syncDate,
        status: ['success', 'partial', 'failed'][Math.floor(Math.random() * 3)],
        recordsProcessed: Math.floor(Math.random() * 100) + 10,
        recordsSuccess: Math.floor(Math.random() * 90) + 8,
        recordsFailed: Math.floor(Math.random() * 10),
        duration: Math.floor(Math.random() * 300) + 30, // seconds
        errors: Math.random() > 0.7 ? ['Connection timeout', 'Invalid data format'] : [],
        triggeredBy: ['scheduled', 'manual', 'event'][Math.floor(Math.random() * 3)]
      });
    }
    
    const createdSyncHistory = await SyncHistory.create(syncHistory);
    console.log(`✅ Created ${createdSyncHistory.length} sync history records`);

    // Create Invoice records (different from FinancialInvoice)
    const invoices = [];
    for (let i = 0; i < 20; i++) {
      const guest = createdGuests[Math.floor(Math.random() * createdGuests.length)];
      const invoiceDate = new Date(today.getTime() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000);
      const amount = Math.floor(Math.random() * 25000) + 5000;
      
      invoices.push({
        hotelId: mainHotel._id,
        invoiceNumber: `INV-${Date.now()}-${i}`,
        guestId: guest._id,
        guestName: guest.name,
        guestEmail: guest.email,
        invoiceDate,
        dueDate: new Date(invoiceDate.getTime() + 15 * 24 * 60 * 60 * 1000),
        items: [
          { description: 'Room Charges', quantity: Math.floor(Math.random() * 3) + 1, rate: 4000, amount: Math.floor(amount * 0.7) },
          { description: 'Food & Beverage', quantity: 1, rate: Math.floor(amount * 0.3), amount: Math.floor(amount * 0.3) }
        ],
        subtotal: amount,
        taxes: Math.floor(amount * 0.18),
        totalAmount: Math.floor(amount * 1.18),
        status: ['draft', 'sent', 'paid', 'overdue'][Math.floor(Math.random() * 4)],
        currency: 'INR',
        createdBy: ownerUser._id
      });
    }
    
    const createdInvoices = await Invoice.create(invoices);
    console.log(`✅ Created ${createdInvoices.length} invoices`);

    // Create Payment records (different from FinancialPayment)
    const payments = [];
    for (const invoice of createdInvoices.slice(0, 15)) {
      if (invoice.status === 'paid') {
        payments.push({
          hotelId: mainHotel._id,
          paymentNumber: `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
          invoiceId: invoice._id,
          guestId: invoice.guestId,
          amount: invoice.totalAmount,
          paymentDate: new Date(invoice.invoiceDate.getTime() + Math.floor(Math.random() * 10) * 24 * 60 * 60 * 1000),
          paymentMethod: ['cash', 'credit_card', 'debit_card', 'upi', 'bank_transfer'][Math.floor(Math.random() * 5)],
          status: 'completed',
          currency: 'INR',
          transactionId: `TXN-${Math.random().toString(36).substr(2, 12).toUpperCase()}`,
          processedBy: ownerUser._id
        });
      }
    }
    
    const createdPayments = await Payment.create(payments);
    console.log(`✅ Created ${createdPayments.length} payments`);

    // Create comprehensive booking data for all branches
    const allBookings = [];
    
    // Add service bookings, group bookings, and day use bookings to main collection
    allBookings.push(...serviceBookingsForMainCollection);
    allBookings.push(...groupBookingsForMainCollection);
    allBookings.push(...dayUseBookingsForMainCollection);
    console.log(`✅ Added ${serviceBookingsForMainCollection.length} service + ${groupBookingsForMainCollection.length} group + ${dayUseBookingsForMainCollection.length} day use bookings to main collection`);
    
    const sources = ['direct', 'booking_com', 'expedia', 'airbnb'];
    const statuses = ['confirmed', 'checked_in', 'checked_out', 'cancelled', 'pending'];
    const statusWeights = [0.40, 0.15, 0.30, 0.10, 0.05];

    // Generate bookings for the last 90 days for better analytics
    for (const hotel of allHotels) {
      const hotelRooms = createdRooms.filter(room => room.hotelId.toString() === hotel._id.toString());
      
      // Vary bookings by hotel type
      const baseBookingsPerDay = hotel.type === 'resort' ? 8 : hotel.type === 'boutique' ? 4 : 6;
      
      for (let dayOffset = 0; dayOffset < 90; dayOffset++) {
        const currentDate = new Date(today.getTime() - dayOffset * 24 * 60 * 60 * 1000);
        
        // Generate varying bookings per day
        const bookingsPerDay = Math.floor(Math.random() * baseBookingsPerDay) + baseBookingsPerDay;
        
        for (let i = 0; i < bookingsPerDay; i++) {
          const guest = createdGuests[Math.floor(Math.random() * createdGuests.length)];
          const room = hotelRooms[Math.floor(Math.random() * hotelRooms.length)];
          
          // Generate realistic check-in dates
          const checkIn = new Date(currentDate.getTime() + (Math.random() - 0.5) * 14 * 24 * 60 * 60 * 1000);
          const nights = Math.floor(Math.random() * 6) + 1; // 1-6 nights
          const checkOut = new Date(checkIn.getTime() + nights * 24 * 60 * 60 * 1000);
          
          // Weighted status selection
          const random = Math.random();
          let status = 'confirmed';
          let cumulativeWeight = 0;
          for (let j = 0; j < statuses.length; j++) {
            cumulativeWeight += statusWeights[j];
            if (random <= cumulativeWeight) {
              status = statuses[j];
              break;
            }
          }
          
          const source = sources[Math.floor(Math.random() * sources.length)];
          const baseAmount = room.currentRate * nights;
          const taxes = Math.floor(baseAmount * 0.18); // 18% GST
          const totalAmount = baseAmount + taxes + Math.floor(Math.random() * 500);
          
          // Generate unique channel booking ID for all sources to avoid duplicate key errors
          const channelBookingId = `${source.toUpperCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
          
          allBookings.push({
            hotelId: hotel._id,
            userId: guest._id,
            rooms: [{
              roomId: room._id,
              rate: room.currentRate
            }],
            checkIn,
            checkOut,
            nights,
            status,
            paymentStatus: status === 'cancelled' ? 'refunded' : 
                          status === 'pending' ? 'pending' : 'paid',
            totalAmount,
            currency: 'INR',
            source,
            channelBookingId,
            guestDetails: {
              adults: Math.floor(Math.random() * 4) + 1,
              children: Math.floor(Math.random() * 3),
              specialRequests: Math.random() > 0.6 ? 
                ['Late check-in', 'Early check-out', 'Extra bed', 'Airport pickup', 'Room service'][Math.floor(Math.random() * 5)] : null
            },
            bookingNumber: `PZ${hotel.address.city.substring(0, 3).toUpperCase()}${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
            idempotencyKey: `pentouz-${hotel._id}-${Date.now()}-${Math.random()}`,
            reservedUntil: status === 'pending' ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null
          });
        }
      }
    }

    // Create bookings in batches to avoid memory issues
    const batchSize = 1000;
    let totalCreatedBookings = 0;
    
    for (let i = 0; i < allBookings.length; i += batchSize) {
      const batch = allBookings.slice(i, i + batchSize);
      const createdBatch = await Booking.create(batch);
      totalCreatedBookings += createdBatch.length;
      console.log(`✅ Created batch ${Math.ceil((i + batchSize) / batchSize)} - ${createdBatch.length} bookings`);
    }
    console.log(`✅ Created total ${totalCreatedBookings} bookings across all THE PENTOUZ branches`);

    // Create Room Blocks for group bookings and events
    const roomBlocksData = [];
    for (const hotel of allHotels.slice(0, 3)) {
      // Corporate room blocks
      roomBlocksData.push({
        blockId: `CORP-${hotel.address.city.substring(0, 3).toUpperCase()}-${Date.now()}`,
        name: `Corporate Block - ${hotel.name}`,
        hotelId: hotel._id,
        blockType: 'corporate',
        startDate: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000),
        roomTypes: [{
          roomTypeId: createdRoomTypes.find(rt => rt.hotelId.toString() === hotel._id.toString())._id,
          blockedRooms: 5,
          releasedRooms: 0
        }],
        rates: {
          baseRate: 8500 + Math.floor(Math.random() * 1500),
          currency: 'INR'
        },
        clientInfo: {
          companyName: 'Tech Corp Solutions',
          contactPerson: 'Mr. Rajesh Kumar',
          email: 'booking@techcorp.com',
          phone: '+91 98765 43210'
        },
        status: 'confirmed',
        releaseDate: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000),
        specialRequirements: ['High-speed WiFi', 'Conference room access', 'Complimentary breakfast'],
        totalRevenue: 42500,
        isActive: true
      });

      // Wedding room block
      roomBlocksData.push({
        blockId: `WEDD-${hotel.address.city.substring(0, 3).toUpperCase()}-${Date.now() + Math.random() * 1000}`,
        name: `Wedding Block - ${hotel.name}`,
        hotelId: hotel._id,
        blockType: 'wedding',
        startDate: new Date(today.getTime() + 21 * 24 * 60 * 60 * 1000),
        endDate: new Date(today.getTime() + 23 * 24 * 60 * 60 * 1000),
        roomTypes: [{
          roomTypeId: createdRoomTypes.find(rt => rt.hotelId.toString() === hotel._id.toString() && rt.name.includes('Suite'))._id,
          blockedRooms: 8,
          releasedRooms: 1
        }],
        rates: {
          baseRate: 12000 + Math.floor(Math.random() * 2000),
          currency: 'INR'
        },
        clientInfo: {
          companyName: 'Sharma-Gupta Wedding',
          contactPerson: 'Mrs. Priya Sharma',
          email: 'priya.sharma@email.com',
          phone: '+91 87654 32109'
        },
        status: 'confirmed',
        releaseDate: new Date(today.getTime() + 18 * 24 * 60 * 60 * 1000),
        specialRequirements: ['Flower arrangements', 'Late checkout', 'Welcome drinks'],
        totalRevenue: 96000,
        isActive: true
      });
    }

    const createdRoomBlocks = await RoomBlock.create(roomBlocksData);
    console.log(`✅ Created ${createdRoomBlocks.length} room blocks for corporate and event bookings`);

    // Create Room Assignment Rules for automatic room allocation
    const assignmentRulesData = [];
    for (const hotel of allHotels.slice(0, 2)) {
      assignmentRulesData.push({
        ruleId: `RULE-VIP-${hotel.address.city.toUpperCase()}`,
        name: `VIP Guest Assignment - ${hotel.name}`,
        hotelId: hotel._id,
        priority: 1,
        isActive: true,
        conditions: {
          guestType: ['vip', 'corporate'],
          loyaltyTier: ['gold', 'platinum'],
          bookingValue: { min: 15000 }
        },
        roomCriteria: {
          roomTypes: [createdRoomTypes.find(rt => rt.hotelId.toString() === hotel._id.toString() && rt.name.includes('Suite'))?._id].filter(Boolean),
          floors: { preferred: [3, 4, 5] },
          amenities: ['sea_view', 'balcony', 'upgraded_bathroom'],
          location: 'corner_room'
        },
        autoAssign: true,
        notificationSettings: {
          notifyFrontDesk: true,
          notifyHousekeeping: true,
          emailManager: true
        }
      });

      assignmentRulesData.push({
        ruleId: `RULE-FAMILY-${hotel.address.city.toUpperCase()}`,
        name: `Family Guest Assignment - ${hotel.name}`,
        hotelId: hotel._id,
        priority: 2,
        isActive: true,
        conditions: {
          adults: { min: 2 },
          children: { min: 1 },
          roomsRequested: { min: 1 }
        },
        roomCriteria: {
          roomTypes: [createdRoomTypes.find(rt => rt.hotelId.toString() === hotel._id.toString() && rt.name.includes('Deluxe'))?._id].filter(Boolean),
          floors: { preferred: [2, 3] },
          amenities: ['extra_bed', 'child_safety', 'refrigerator'],
          adjacentRooms: true
        },
        autoAssign: false,
        notificationSettings: {
          notifyFrontDesk: true,
          notifyHousekeeping: false,
          emailManager: false
        }
      });
    }

    const createdAssignmentRules = await RoomAssignmentRules.create(assignmentRulesData);
    console.log(`✅ Created ${createdAssignmentRules.length} room assignment rules for automatic allocation`);

    // Create Advanced Reservations for future bookings with special requirements
    const advancedReservationsData = [];
    for (const hotel of allHotels.slice(0, 2)) {
      advancedReservationsData.push({
        reservationId: `ADV-${hotel.address.city.substring(0, 3).toUpperCase()}-${Date.now()}`,
        name: 'Annual Conference Booking',
        hotelId: hotel._id,
        clientId: ownerUser._id,
        eventType: 'conference',
        estimatedGuests: 150 + Math.floor(Math.random() * 50),
        preferredDates: {
          checkInRange: {
            start: new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000),
            end: new Date(today.getTime() + 95 * 24 * 60 * 60 * 1000)
          },
          checkOutRange: {
            start: new Date(today.getTime() + 93 * 24 * 60 * 60 * 1000),
            end: new Date(today.getTime() + 98 * 24 * 60 * 60 * 1000)
          }
        },
        roomRequirements: {
          totalRooms: 75,
          roomTypePreferences: [{
            roomTypeId: createdRoomTypes.find(rt => rt.hotelId.toString() === hotel._id.toString())._id,
            quantity: 50
          }, {
            roomTypeId: createdRoomTypes.find(rt => rt.hotelId.toString() === hotel._id.toString() && rt.name.includes('Suite'))._id,
            quantity: 25
          }],
          specialRequirements: ['Conference room', 'AV equipment', 'High-speed internet', 'Catering services']
        },
        budget: {
          estimatedTotal: 850000 + Math.floor(Math.random() * 150000),
          currency: 'INR',
          includesFood: true,
          includesMeetingSpace: true
        },
        contactInfo: {
          primaryContact: {
            name: 'Dr. Anjali Mehta',
            title: 'Event Coordinator',
            email: 'anjali@techconf2024.com',
            phone: '+91 99887 76543'
          },
          company: 'TechConf 2024',
          billingAddress: `${hotel.address.street}, ${hotel.address.city}`
        },
        notificationPreferences: {
          email: true,
          sms: true,
          phone: false
        },
        autoConfirm: false,
        status: 'inquiry',
        priority: 'high',
        followUpDate: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000),
        assignedTo: ownerUser._id
      });

      advancedReservationsData.push({
        reservationId: `ADV-CORP-${hotel.address.city.substring(0, 3).toUpperCase()}-${Date.now() + Math.random() * 1000}`,
        name: 'Corporate Training Program',
        hotelId: hotel._id,
        clientId: createdGuests[0]._id,
        eventType: 'corporate',
        estimatedGuests: 30 + Math.floor(Math.random() * 20),
        preferredDates: {
          checkInRange: {
            start: new Date(today.getTime() + 45 * 24 * 60 * 60 * 1000),
            end: new Date(today.getTime() + 50 * 24 * 60 * 60 * 1000)
          },
          checkOutRange: {
            start: new Date(today.getTime() + 48 * 24 * 60 * 60 * 1000),
            end: new Date(today.getTime() + 53 * 24 * 60 * 60 * 1000)
          }
        },
        roomRequirements: {
          totalRooms: 20,
          roomTypePreferences: [{
            roomTypeId: createdRoomTypes.find(rt => rt.hotelId.toString() === hotel._id.toString())._id,
            quantity: 20
          }],
          specialRequirements: ['Training room', 'Projector', 'Flipcharts', 'Coffee breaks']
        },
        budget: {
          estimatedTotal: 180000 + Math.floor(Math.random() * 20000),
          currency: 'INR',
          includesFood: false,
          includesMeetingSpace: true
        },
        contactInfo: {
          primaryContact: {
            name: 'Mr. Vikram Singh',
            title: 'HR Manager',
            email: 'vikram@corporatetraining.com',
            phone: '+91 88776 65432'
          },
          company: 'Corporate Solutions Ltd',
          billingAddress: `Business District, ${hotel.address.city}`
        },
        notificationPreferences: {
          email: true,
          sms: false,
          phone: true
        },
        autoConfirm: true,
        status: 'tentative',
        priority: 'medium',
        followUpDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
        assignedTo: ownerUser._id
      });
    }

    const createdAdvancedReservations = await AdvancedReservation.create(advancedReservationsData);
    console.log(`✅ Created ${createdAdvancedReservations.length} advanced reservations for future events`);

    // Update property groups with calculated metrics
    for (const group of createdGroups) {
      const groupHotels = allHotels.filter(hotel => 
        hotel.propertyGroupId && hotel.propertyGroupId.toString() === group._id.toString()
      );
      
      const groupHotelIds = groupHotels.map(h => h._id);
      const groupBookings = allBookings.filter(booking => 
        groupHotelIds.some(hotelId => hotelId.toString() === booking.hotelId.toString())
      );
      
      // Calculate metrics for the last 30 days
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const recentBookings = groupBookings.filter(booking => booking.checkIn >= thirtyDaysAgo);
      const totalRevenue = recentBookings.reduce((sum, booking) => sum + booking.totalAmount, 0);
      const avgOccupancy = Math.floor(Math.random() * 25) + 65; // 65-90% occupancy

      group.metrics = {
        totalRevenue: Math.floor(totalRevenue),
        avgOccupancy,
        totalBookings: recentBookings.length,
        activeProperties: groupHotels.length
      };
      
      await group.save();
    }
    console.log('✅ Updated property groups with calculated metrics');

    // Final Summary
    console.log('\n🎉 THE PENTOUZ Multi-Branch Data Seeding Completed Successfully!');
    console.log('=' .repeat(70));
    console.log('🏨 THE PENTOUZ HOTEL CHAIN SUMMARY:');
    console.log(`   🏢 Property Groups: ${createdGroups.length}`);
    console.log(`   🏨 Total THE PENTOUZ Branches: ${allHotels.length}`);
    console.log(`   🛏️  Room Types: ${createdRoomTypes.length}`);
    console.log(`   🚪 Total Rooms: ${createdRooms.length}`);
    console.log(`   👔 Staff Members: ${createdStaff.length}`);
    console.log(`   👥 Guest Members: ${createdGuests.length}`);
    console.log(`   📅 Total Bookings: ${totalCreatedBookings}`);
    console.log('\n📊 COMPREHENSIVE DATA BREAKDOWN:');
    console.log('🏷️  Basic Entities:');
    console.log(`   💰 Currencies: ${currencies.length}`);
    console.log(`   🌍 Languages: ${languages.length}`);
    console.log(`   🎭 Salutations: ${salutations.length}`);
    console.log(`   📋 Identification Types: ${identificationTypes.length}`);
    console.log(`   📞 Phone Extensions: ${phoneExtensions.length}`);
    console.log('\n💰 Financial Data:');
    console.log(`   🏦 Chart of Accounts: ${chartOfAccounts.length}`);
    console.log(`   🧾 Financial Invoices: ${createdFinancialInvoices.length}`);
    console.log(`   💳 Financial Payments: ${createdFinancialPayments.length}`);
    console.log(`   📊 General Ledger: ${createdGeneralLedger.length}`);
    console.log(`   📚 Journal Entries: ${createdJournalEntries.length}`);
    console.log('\n🍽️  POS System:');
    console.log(`   🏪 POS Outlets: ${createdPOSOutlets.length}`);
    console.log(`   🍛 Menu Items: ${createdPOSMenuItems.length}`);
    console.log(`   📋 POS Orders: ${createdPOSOrders.length}`);
    console.log(`   📐 POS Attributes: ${posAttributes.length}`);
    console.log('\n🏨 Operations:');
    console.log(`   🏢 Hotel Areas: ${hotelAreas.length}`);
    console.log(`   🧹 Housekeeping Records: ${createdHousekeeping.length}`);
    console.log(`   🔧 Maintenance Tasks: ${createdMaintenanceTasks.length}`);
    console.log(`   📦 Inventory Items: ${inventoryItems.length}`);
    console.log(`   📊 Staff Tasks: ${createdStaffTasks.length}`);
    console.log('\n👥 Guest Services:');
    console.log(`   ⭐ Reviews: ${createdReviews.length}`);
    console.log(`   🌟 VIP Guests: ${createdVIPGuests.length}`);
    console.log(`   🎖️  Loyalty Members: ${createdLoyalty.length}`);
    console.log(`   📧 Communications: ${createdCommunications.length}`);
    console.log(`   🔔 Notifications: ${createdNotifications.length}`);
    console.log('\n🚀 Advanced Features:');
    console.log(`   💹 Dynamic Pricing: ${createdDynamicPricing.length}`);
    console.log(`   📈 Demand Forecasts: ${createdDemandForecast.length}`);
    console.log(`   🏪 Competitor Data: ${createdCompetitorMonitoring.length}`);
    console.log(`   📊 User Analytics: ${createdUserAnalytics.length}`);
    console.log(`   📋 Revenue Reports: ${createdRevenueReports.length}`);
    console.log('\n🏢 Corporate & Rate Management:');
    console.log(`   🏢 Corporate Companies: ${corporateCompanies.length}`);
    console.log(`   💳 Corporate Credits: ${createdCorporateCredits.length}`);
    console.log(`   💰 Centralized Rates: ${createdCentralizedRates.length}`);
    console.log(`   🔄 Rate Mappings: ${createdRateMappings.length}`);
    console.log(`   📊 Room Inventory: ${createdRoomInventory.length}`);
    console.log(`   📋 Room Mappings: ${createdRoomMappings.length}`);
    console.log(`   🚪 Arrival/Departure Modes: ${arrivalDepartureModes.length}`);
    console.log(`   📝 Custom Fields: ${customFields.length}`);
    console.log('\n📚 Additional Models:');
    console.log(`   🏛️ Shared Resources: ${sharedResources.length}`);
    console.log(`   📦 Supply Requests: ${createdSupplyRequests.length}`);
    console.log(`   🤝 MeetUp Requests: ${createdMeetUpRequests.length}`);
    console.log(`   📊 Tape Chart Records: ${createdTapeChart.length}`);
    console.log(`   🏢 Room Blocks: ${createdRoomBlocks.length}`);
    console.log(`   ⚙️ Assignment Rules: ${createdAssignmentRules.length}`);
    console.log(`   🎯 Advanced Reservations: ${createdAdvancedReservations.length}`);
    console.log(`   👥 Group Bookings: ${createdGroupBookings.length}`);
    console.log(`   ⏰ Day Use Slots: ${dayUseSlots.length}`);
    console.log(`   🏖️ Day Use Bookings: ${createdDayUseBookings.length}`);
    console.log(`   🌐 Web Configuration: 1`);
    console.log(`   📋 Room Type Allotments: ${createdRoomTypeAllotments.length}`);
    console.log(`   🚫 Stop Sell Rules: ${createdStopSellRules.length}`);
    console.log(`   🔌 Channel Configurations: ${channelConfigurations.length}`);
    console.log(`   📡 OTA Payloads: ${createdOTAPayloads.length}`);
    console.log(`   🔄 Sync History: ${createdSyncHistory.length}`);
    console.log(`   🧾 Invoices: ${createdInvoices.length}`);
    console.log(`   💸 Payments: ${createdPayments.length}`);
    console.log('=' .repeat(70));
    
    console.log('\n🏨 THE PENTOUZ BRANCHES BY GROUP:');
    createdGroups.forEach((group, index) => {
      const groupHotels = allHotels.filter(hotel => 
        hotel.propertyGroupId && hotel.propertyGroupId.toString() === group._id.toString()
      );
      console.log(`\n   ${index + 1}. ${group.name}:`);
      console.log(`      📍 Branches: ${groupHotels.length}`);
      console.log(`      💰 Revenue: ₹${group.metrics?.totalRevenue?.toLocaleString() || 0}`);
      console.log(`      📊 Occupancy: ${group.metrics?.avgOccupancy || 0}%`);
      groupHotels.forEach(hotel => {
        const hotelRooms = createdRooms.filter(r => r.hotelId.toString() === hotel._id.toString());
        console.log(`         - ${hotel.name}: ${hotel.address.city} (${hotelRooms.length} rooms)`);
      });
    });
    
    // Add the main hotel without group
    if (!mainHotel.propertyGroupId) {
      const mainHotelRooms = createdRooms.filter(r => r.hotelId.toString() === mainHotel._id.toString());
      console.log(`\n   🏨 Main Hotel (No Group):`);
      console.log(`         - ${mainHotel.name}: ${mainHotel.address.city} (${mainHotelRooms.length} rooms)`);
    }

    console.log('\n🔐 THE PENTOUZ LOGIN CREDENTIALS:');
    console.log('   Branch Managers: manager.mumbai@thepentouz.com, manager.delhi@thepentouz.com, etc. / pentouz123');
    console.log('   Front Desk: frontdesk.mumbai@thepentouz.com, frontdesk.delhi@thepentouz.com, etc. / pentouz123');
    console.log('   Guests: guest1@thepentouz.com, guest2@thepentouz.com, etc. / pentouz123');
    
    console.log('\n✨ Your Multi-Property Manager will now show THE PENTOUZ branches with real data!');
    console.log('🚀 All branches are connected to property groups with comprehensive analytics.');

    return {
      mainHotelId: mainHotel._id,
      propertyGroups: createdGroups.length,
      totalHotels: allHotels.length,
      branches: createdBranches.length,
      roomTypes: createdRoomTypes.length,
      rooms: createdRooms.length,
      staff: createdStaff.length,
      guests: createdGuests.length,
      bookings: totalCreatedBookings
    };

  } catch (error) {
    console.error('❌ THE PENTOUZ branches seeding failed:', error);
    throw error;
  }
};

const main = async () => {
  try {
    console.log('🏨 THE PENTOUZ Multi-Branch Seeding Starting...');
    console.log('🔗 Connecting to your MongoDB database...');
    await connectDB();
    
    // Clear all existing data for a fresh start
    console.log('🗑️  Clearing existing data for fresh seed...');
    try {
      await mongoose.connection.db.dropDatabase();
      console.log('✅ Database cleared successfully');
    } catch (error) {
      console.log('⚠️  Database clear failed or database was already empty:', error.message);
    }
    
    console.log('📊 Creating THE PENTOUZ branches and property groups...');
    const results = await seedPentouzBranches();
    
    console.log('\n✅ THE PENTOUZ seeding completed successfully!');
    console.log('🎯 Results:', results);
    
    await mongoose.connection.close();
    console.log('🔒 Database connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('💥 THE PENTOUZ seeding process failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the script
main();