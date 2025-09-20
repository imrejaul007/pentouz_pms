import mongoose from 'mongoose';
import dotenv from 'dotenv';
import POSOutlet from '../models/POSOutlet.js';
import POSMenu from '../models/POSMenu.js';
import User from '../models/User.js';
import Hotel from '../models/Hotel.js';
import Room from '../models/Room.js';
import Booking from '../models/Booking.js';

dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI or MONGODB_URI environment variable is required');
    }
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Seed POS Outlets
const seedPOSOutlets = async () => {
  try {
    console.log('🌱 Seeding POS Outlets...');
    // Check if outlets already exist
    const existingOutlets = await POSOutlet.countDocuments();
    if (existingOutlets > 0) {
      console.log('✅ POS Outlets already exist, skipping...');
      return;
    }

    const outlets = [
      {
        outletId: 'restaurant-001',
        name: 'Main Restaurant',
        type: 'restaurant',
        location: 'Ground Floor',
        isActive: true,
        operatingHours: {
          monday: { open: '06:00', close: '23:00', closed: false },
          tuesday: { open: '06:00', close: '23:00', closed: false },
          wednesday: { open: '06:00', close: '23:00', closed: false },
          thursday: { open: '06:00', close: '23:00', closed: false },
          friday: { open: '06:00', close: '23:00', closed: false },
          saturday: { open: '06:00', close: '23:00', closed: false },
          sunday: { open: '06:00', close: '23:00', closed: false }
        },
        taxSettings: {
          defaultTaxRate: 0,
          serviceTaxRate: 0,
          gstRate: 18
        },
        paymentMethods: ['cash', 'card', 'room_charge', 'voucher'],
        settings: {
          allowRoomCharges: true,
          requireSignature: false,
          printReceipts: true,
          allowDiscounts: true,
          maxDiscountPercent: 20
        }
      },
      {
        outletId: 'spa-001',
        name: 'Wellness Spa',
        type: 'spa',
        location: '2nd Floor',
        isActive: true,
        operatingHours: {
          monday: { open: '09:00', close: '20:00', closed: false },
          tuesday: { open: '09:00', close: '20:00', closed: false },
          wednesday: { open: '09:00', close: '20:00', closed: false },
          thursday: { open: '09:00', close: '20:00', closed: false },
          friday: { open: '09:00', close: '20:00', closed: false },
          saturday: { open: '09:00', close: '20:00', closed: false },
          sunday: { open: '09:00', close: '20:00', closed: false }
        },
        taxSettings: {
          defaultTaxRate: 0,
          serviceTaxRate: 0,
          gstRate: 18
        },
        paymentMethods: ['cash', 'card', 'room_charge'],
        settings: {
          allowRoomCharges: true,
          requireSignature: false,
          printReceipts: true,
          allowDiscounts: true,
          maxDiscountPercent: 15
        }
      },
      {
        outletId: 'gym-001',
        name: 'Fitness Center',
        type: 'gym',
        location: 'Basement',
        isActive: true,
        operatingHours: {
          monday: { open: '06:00', close: '22:00', closed: false },
          tuesday: { open: '06:00', close: '22:00', closed: false },
          wednesday: { open: '06:00', close: '22:00', closed: false },
          thursday: { open: '06:00', close: '22:00', closed: false },
          friday: { open: '06:00', close: '22:00', closed: false },
          saturday: { open: '06:00', close: '22:00', closed: false },
          sunday: { open: '06:00', close: '22:00', closed: false }
        },
        taxSettings: {
          defaultTaxRate: 0,
          serviceTaxRate: 0,
          gstRate: 18
        },
        paymentMethods: ['cash', 'card', 'room_charge'],
        settings: {
          allowRoomCharges: true,
          requireSignature: false,
          printReceipts: true,
          allowDiscounts: true,
          maxDiscountPercent: 10
        }
      },
      {
        outletId: 'shop-001',
        name: 'Gift Shop',
        type: 'shop',
        location: 'Lobby',
        isActive: true,
        operatingHours: {
          monday: { open: '08:00', close: '21:00', closed: false },
          tuesday: { open: '08:00', close: '21:00', closed: false },
          wednesday: { open: '08:00', close: '21:00', closed: false },
          thursday: { open: '08:00', close: '21:00', closed: false },
          friday: { open: '08:00', close: '21:00', closed: false },
          saturday: { open: '08:00', close: '21:00', closed: false },
          sunday: { open: '08:00', close: '21:00', closed: false }
        },
        taxSettings: {
          defaultTaxRate: 0,
          serviceTaxRate: 0,
          gstRate: 18
        },
        paymentMethods: ['cash', 'card', 'room_charge'],
        settings: {
          allowRoomCharges: true,
          requireSignature: false,
          printReceipts: true,
          allowDiscounts: true,
          maxDiscountPercent: 25
        }
      },
      {
        outletId: 'parking-001',
        name: 'Valet Parking',
        type: 'parking',
        location: 'Ground Floor',
        isActive: true,
        operatingHours: {
          monday: { open: '00:00', close: '23:59', closed: false },
          tuesday: { open: '00:00', close: '23:59', closed: false },
          wednesday: { open: '00:00', close: '23:59', closed: false },
          thursday: { open: '00:00', close: '23:59', closed: false },
          friday: { open: '00:00', close: '23:59', closed: false },
          saturday: { open: '00:00', close: '23:59', closed: false },
          sunday: { open: '00:00', close: '23:59', closed: false }
        },
        taxSettings: {
          defaultTaxRate: 0,
          serviceTaxRate: 0,
          gstRate: 18
        },
        paymentMethods: ['cash', 'card', 'room_charge'],
        settings: {
          allowRoomCharges: true,
          requireSignature: false,
          printReceipts: true,
          allowDiscounts: true,
          maxDiscountPercent: 0
        }
      }
    ];

    await POSOutlet.insertMany(outlets);
    console.log('✅ POS Outlets seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding POS Outlets:', error);
  }
};

// Seed POS Menu Items
const seedPOSMenuItems = async () => {
  try {
    // Check if menu items already exist
    const existingMenus = await POSMenu.countDocuments();
    if (existingMenus > 0) {
      console.log('POS Menu Items already exist, skipping...');
      return;
    }

    // Get outlet IDs
    const restaurant = await POSOutlet.findOne({ outletId: 'restaurant-001' });
    const spa = await POSOutlet.findOne({ outletId: 'spa-001' });
    const gym = await POSOutlet.findOne({ outletId: 'gym-001' });
    const shop = await POSOutlet.findOne({ outletId: 'shop-001' });
    const parking = await POSOutlet.findOne({ outletId: 'parking-001' });

    if (!restaurant || !spa || !gym || !shop || !parking) {
      console.log('❌ Required outlets not found, skipping menu seeding...');
      return;
    }

    const menus = [
      {
        menuId: 'restaurant-menu-001',
        name: 'Main Restaurant Menu',
        outlet: restaurant._id,
        type: 'all_day',
        isActive: true,
        availableHours: { start: '06:00', end: '23:00' },
        items: [
          {
            itemId: 'food-001',
            name: 'Club Sandwich',
            description: 'Classic club sandwich with turkey, bacon, lettuce, and tomato',
            category: 'Main Course',
            subcategory: 'Sandwiches',
            price: 850,
            costPrice: 400,
            isActive: true,
            isAvailable: true,
            preparationTime: 15,
            allergens: ['gluten', 'dairy'],
            dietaryInfo: ['non-vegetarian'],
            ingredients: ['turkey', 'bacon', 'lettuce', 'tomato', 'bread'],
            taxes: { taxable: true, taxRate: 18 }
          },
          {
            itemId: 'food-002',
            name: 'Caesar Salad',
            description: 'Fresh romaine lettuce with Caesar dressing and croutons',
            category: 'Appetizer',
            subcategory: 'Salads',
            price: 650,
            costPrice: 250,
            isActive: true,
            isAvailable: true,
            preparationTime: 10,
            allergens: ['gluten', 'dairy'],
            dietaryInfo: ['non-vegetarian'],
            ingredients: ['romaine lettuce', 'Caesar dressing', 'croutons', 'parmesan'],
            taxes: { taxable: true, taxRate: 18 }
          },
          {
            itemId: 'drink-001',
            name: 'Fresh Orange Juice',
            description: 'Freshly squeezed orange juice',
            category: 'Beverages',
            subcategory: 'Juices',
            price: 350,
            costPrice: 150,
            isActive: true,
            isAvailable: true,
            preparationTime: 5,
            allergens: [],
            dietaryInfo: ['vegan', 'gluten-free'],
            ingredients: ['oranges'],
            taxes: { taxable: true, taxRate: 18 }
          },
          {
            itemId: 'food-003',
            name: 'Grilled Salmon',
            description: 'Fresh Atlantic salmon grilled to perfection',
            category: 'Main Course',
            subcategory: 'Seafood',
            price: 1450,
            costPrice: 800,
            isActive: true,
            isAvailable: true,
            preparationTime: 25,
            allergens: ['fish'],
            dietaryInfo: ['non-vegetarian', 'gluten-free'],
            ingredients: ['salmon', 'herbs', 'lemon', 'olive oil'],
            taxes: { taxable: true, taxRate: 18 }
          }
        ],
        categories: [
          { name: 'Appetizer', displayOrder: 1, isActive: true },
          { name: 'Main Course', displayOrder: 2, isActive: true },
          { name: 'Beverages', displayOrder: 3, isActive: true }
        ]
      },
      {
        menuId: 'spa-menu-001',
        name: 'Wellness Spa Services',
        outlet: spa._id,
        type: 'spa',
        isActive: true,
        availableHours: { start: '09:00', end: '20:00' },
        items: [
          {
            itemId: 'spa-001',
            name: 'Swedish Massage (60 min)',
            description: 'Relaxing Swedish massage for full body relaxation',
            category: 'Massage',
            subcategory: 'Therapeutic',
            price: 3500,
            costPrice: 1200,
            isActive: true,
            isAvailable: true,
            preparationTime: 60,
            allergens: [],
            dietaryInfo: ['vegan', 'gluten-free'],
            ingredients: ['massage oil', 'essential oils'],
            taxes: { taxable: true, taxRate: 18 }
          },
          {
            itemId: 'spa-002',
            name: 'Facial Treatment',
            description: 'Rejuvenating facial with premium skincare products',
            category: 'Skincare',
            subcategory: 'Facial',
            price: 2800,
            costPrice: 900,
            isActive: true,
            isAvailable: true,
            preparationTime: 45,
            allergens: [],
            dietaryInfo: ['vegan', 'gluten-free'],
            ingredients: ['facial cleanser', 'mask', 'moisturizer'],
            taxes: { taxable: true, taxRate: 18 }
          },
          {
            itemId: 'spa-003',
            name: 'Aromatherapy Session',
            description: 'Therapeutic aromatherapy with essential oils',
            category: 'Wellness',
            subcategory: 'Aromatherapy',
            price: 2200,
            costPrice: 700,
            isActive: true,
            isAvailable: true,
            preparationTime: 30,
            allergens: [],
            dietaryInfo: ['vegan', 'gluten-free'],
            ingredients: ['essential oils', 'diffuser'],
            taxes: { taxable: true, taxRate: 18 }
          }
        ],
        categories: [
          { name: 'Massage', displayOrder: 1, isActive: true },
          { name: 'Skincare', displayOrder: 2, isActive: true },
          { name: 'Wellness', displayOrder: 3, isActive: true }
        ]
      },
      {
        menuId: 'gym-menu-001',
        name: 'Fitness Center Services',
        outlet: gym._id,
        type: 'gym',
        isActive: true,
        availableHours: { start: '06:00', end: '22:00' },
        items: [
          {
            itemId: 'gym-001',
            name: 'Personal Training (1 hr)',
            description: 'One-on-one personal training session',
            category: 'Training',
            subcategory: 'Personal',
            price: 2000,
            costPrice: 800,
            isActive: true,
            isAvailable: true,
            preparationTime: 60,
            allergens: [],
            dietaryInfo: ['vegan', 'gluten-free'],
            ingredients: [],
            taxes: { taxable: true, taxRate: 18 }
          },
          {
            itemId: 'gym-002',
            name: 'Day Pass',
            description: 'Access to fitness center for one day',
            category: 'Access',
            subcategory: 'Pass',
            price: 500,
            costPrice: 100,
            isActive: true,
            isAvailable: true,
            preparationTime: 0,
            allergens: [],
            dietaryInfo: ['vegan', 'gluten-free'],
            ingredients: [],
            taxes: { taxable: true, taxRate: 18 }
          },
          {
            itemId: 'gym-003',
            name: 'Equipment Rental',
            description: 'Rental of fitness equipment',
            category: 'Rental',
            subcategory: 'Equipment',
            price: 200,
            costPrice: 50,
            isActive: true,
            isAvailable: true,
            preparationTime: 0,
            allergens: [],
            dietaryInfo: ['vegan', 'gluten-free'],
            ingredients: [],
            taxes: { taxable: true, taxRate: 18 }
          }
        ],
        categories: [
          { name: 'Training', displayOrder: 1, isActive: true },
          { name: 'Access', displayOrder: 2, isActive: true },
          { name: 'Rental', displayOrder: 3, isActive: true }
        ]
      },
      {
        menuId: 'shop-menu-001',
        name: 'Gift Shop Items',
        outlet: shop._id,
        type: 'retail',
        isActive: true,
        availableHours: { start: '08:00', end: '21:00' },
        items: [
          {
            itemId: 'shop-001',
            name: 'Hotel Branded T-Shirt',
            description: 'Premium cotton t-shirt with hotel logo',
            category: 'Apparel',
            subcategory: 'Clothing',
            price: 1200,
            costPrice: 400,
            isActive: true,
            isAvailable: true,
            preparationTime: 0,
            allergens: [],
            dietaryInfo: ['vegan', 'gluten-free'],
            ingredients: ['cotton', 'polyester'],
            taxes: { taxable: true, taxRate: 18 }
          },
          {
            itemId: 'shop-002',
            name: 'Local Handicrafts',
            description: 'Authentic local handicraft items',
            category: 'Souvenirs',
            subcategory: 'Handicrafts',
            price: 800,
            costPrice: 300,
            isActive: true,
            isAvailable: true,
            preparationTime: 0,
            allergens: [],
            dietaryInfo: ['vegan', 'gluten-free'],
            ingredients: ['wood', 'clay', 'fabric'],
            taxes: { taxable: true, taxRate: 18 }
          },
          {
            itemId: 'shop-003',
            name: 'Premium Chocolates',
            description: 'Assorted premium chocolate collection',
            category: 'Food',
            subcategory: 'Chocolates',
            price: 950,
            costPrice: 400,
            isActive: true,
            isAvailable: true,
            preparationTime: 0,
            allergens: ['dairy', 'nuts'],
            dietaryInfo: ['vegetarian'],
            ingredients: ['chocolate', 'milk', 'nuts', 'sugar'],
            taxes: { taxable: true, taxRate: 18 }
          }
        ],
        categories: [
          { name: 'Apparel', displayOrder: 1, isActive: true },
          { name: 'Souvenirs', displayOrder: 2, isActive: true },
          { name: 'Food', displayOrder: 3, isActive: true }
        ]
      },
      {
        menuId: 'parking-menu-001',
        name: 'Parking Services',
        outlet: parking._id,
        type: 'parking',
        isActive: true,
        availableHours: { start: '00:00', end: '23:59' },
        items: [
          {
            itemId: 'park-001',
            name: 'Valet Service (per day)',
            description: 'Professional valet parking service',
            category: 'Service',
            subcategory: 'Valet',
            price: 500,
            costPrice: 150,
            isActive: true,
            isAvailable: true,
            preparationTime: 0,
            allergens: [],
            dietaryInfo: ['vegan', 'gluten-free'],
            ingredients: [],
            taxes: { taxable: true, taxRate: 18 }
          },
          {
            itemId: 'park-002',
            name: 'Car Wash',
            description: 'Professional car wash and detailing',
            category: 'Service',
            subcategory: 'Car Care',
            price: 800,
            costPrice: 200,
            isActive: true,
            isAvailable: true,
            preparationTime: 30,
            allergens: [],
            dietaryInfo: ['vegan', 'gluten-free'],
            ingredients: ['car wash soap', 'wax'],
            taxes: { taxable: true, taxRate: 18 }
          }
        ],
        categories: [
          { name: 'Service', displayOrder: 1, isActive: true }
        ]
      }
    ];

    await POSMenu.insertMany(menus);
    console.log('✅ POS Menu Items seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding POS Menu Items:', error);
  }
};

// Seed Sample Hotel and Rooms
const seedHotelAndRooms = async () => {
  try {
    // Check if hotel already exists
    let hotel = await Hotel.findOne();
    if (!hotel) {
      hotel = await Hotel.create({
        name: 'Sample Hotel',
        address: {
          street: '123 Sample Street',
          city: 'Sample City',
          state: 'Sample State',
          zipCode: '12345',
          country: 'India'
        },
        contact: {
          phone: '+91-123-456-7890',
          email: 'info@samplehotel.com'
        },
        isActive: true
      });
      console.log('✅ Sample Hotel created');
    }

    // Check if rooms already exist
    const existingRooms = await Room.countDocuments();
    if (existingRooms > 0) {
      console.log('Rooms already exist, skipping...');
      return hotel;
    }

    // Create sample rooms
    const rooms = [
      {
        hotelId: hotel._id,
        roomNumber: '101',
        type: 'deluxe',
        floor: 1,
        isActive: true,
        currentRate: 5000,
        amenities: ['AC', 'TV', 'WiFi', 'Mini Bar']
      },
      {
        hotelId: hotel._id,
        roomNumber: '102',
        type: 'deluxe',
        floor: 1,
        isActive: true,
        currentRate: 5000,
        amenities: ['AC', 'TV', 'WiFi', 'Mini Bar']
      },
      {
        hotelId: hotel._id,
        roomNumber: '201',
        type: 'suite',
        floor: 2,
        isActive: true,
        currentRate: 8000,
        amenities: ['AC', 'TV', 'WiFi', 'Mini Bar', 'Jacuzzi']
      }
    ];

    await Room.insertMany(rooms);
    console.log('✅ Sample Rooms created');

    return hotel;
  } catch (error) {
    console.error('❌ Error seeding Hotel and Rooms:', error);
    return null;
  }
};

// Seed Sample Users and Bookings
const seedUsersAndBookings = async (hotel) => {
  try {
    if (!hotel) {
      console.log('❌ Hotel not found, skipping user and booking seeding...');
      return;
    }

    // Check if users already exist
    const existingUsers = await User.countDocuments();
    if (existingUsers > 0) {
      console.log('Users already exist, skipping...');
      return;
    }

    // Create sample guest user
    const guestUser = await User.create({
      name: 'John Doe',
      email: 'john.doe@example.com',
      phone: '+91-987-654-3210',
      password: 'password123',
      role: 'guest',
      hotelId: hotel._id,
      isActive: true
    });

    // Create sample staff user
    const staffUser = await User.create({
      name: 'Jane Smith',
      email: 'jane.smith@samplehotel.com',
      phone: '+91-987-654-3211',
      password: 'password123',
      role: 'staff',
      hotelId: hotel._id,
      isActive: true
    });

    console.log('✅ Sample Users created');
    console.log(`   - Guest: ${guestUser.name} (${guestUser.email})`);
    console.log(`   - Staff: ${staffUser.name} (${staffUser.email})`);

    // Get rooms
    const rooms = await Room.find({ hotelId: hotel._id });

    if (rooms.length > 0) {
      // Create sample booking
      const checkIn = new Date();
      const checkOut = new Date();
      checkOut.setDate(checkOut.getDate() + 2);

      await Booking.create({
        hotelId: hotel._id,
        userId: guestUser._id,
        rooms: [{
          roomId: rooms[0]._id,
          rate: rooms[0].currentRate
        }],
        checkIn,
        checkOut,
        nights: 2,
        status: 'checked_in',
        paymentStatus: 'paid',
        totalAmount: rooms[0].currentRate * 2,
        currency: 'INR',
        guestDetails: {
          adults: 2,
          children: 0
        }
      });

      console.log('✅ Sample Booking created');
    }

  } catch (error) {
    console.error('❌ Error seeding Users and Bookings:', error);
  }
};

// Main seeding function
const seedAllData = async () => {
  try {
    await connectDB();
    
    console.log('🌱 Starting data seeding...');
    
    await seedPOSOutlets();
    await seedPOSMenuItems();
    const hotel = await seedHotelAndRooms();
    await seedUsersAndBookings(hotel);
    
    console.log('✅ All data seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  }
};

// Run seeding if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedAllData();
}

export default seedAllData;
