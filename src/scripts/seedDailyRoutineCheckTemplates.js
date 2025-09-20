import mongoose from 'mongoose';
import dotenv from 'dotenv';
import DailyRoutineCheckTemplate from '../models/DailyRoutineCheckTemplate.js';
import Hotel from '../models/Hotel.js';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log('MongoDB disconnected successfully');
  } catch (error) {
    console.error('MongoDB disconnection error:', error);
  }
};

const createSampleTemplates = async () => {
  try {
    // Get the first hotel (assuming it exists)
    const hotel = await Hotel.findOne();
    if (!hotel) {
      console.error('No hotel found. Please create a hotel first.');
      return;
    }

    console.log('Creating daily routine check templates for hotel:', hotel.name);

    // Single Room Template
    const singleTemplate = new DailyRoutineCheckTemplate({
      hotelId: hotel._id,
      roomType: 'single',
      fixedInventory: [
        {
          name: 'TV',
          category: 'electronics',
          description: '32-inch LED TV with remote control',
          unitPrice: 15000,
          standardQuantity: 1,
          checkInstructions: 'Check if TV turns on, remote works, channels are clear',
          expectedCondition: 'working'
        },
        {
          name: 'AC Unit',
          category: 'appliances',
          description: 'Split AC with remote control',
          unitPrice: 25000,
          standardQuantity: 1,
          checkInstructions: 'Check if AC cools properly, remote functions, filters clean',
          expectedCondition: 'working'
        },
        {
          name: 'Bed',
          category: 'furniture',
          description: 'Single bed with mattress',
          unitPrice: 12000,
          standardQuantity: 1,
          checkInstructions: 'Check mattress condition, bed frame stability',
          expectedCondition: 'undamaged'
        },
        {
          name: 'Wardrobe',
          category: 'furniture',
          description: 'Built-in wardrobe with hangers',
          unitPrice: 8000,
          standardQuantity: 1,
          checkInstructions: 'Check door hinges, shelves stability, hangers present',
          expectedCondition: 'functional'
        },
        {
          name: 'Bathroom Fixtures',
          category: 'fixtures',
          description: 'Toilet, sink, shower with fittings',
          unitPrice: 15000,
          standardQuantity: 1,
          checkInstructions: 'Check water flow, drainage, no leaks',
          expectedCondition: 'working'
        }
      ],
      dailyInventory: [
        {
          name: 'Towels',
          category: 'bathroom',
          description: 'Bath towels and hand towels',
          unitPrice: 800,
          standardQuantity: 4,
          checkInstructions: 'Check cleanliness, no stains, adequate quantity',
          expectedCondition: 'clean'
        },
        {
          name: 'Bed Sheets',
          category: 'bedroom',
          description: 'Fitted sheet, flat sheet, pillowcases',
          unitPrice: 1200,
          standardQuantity: 2,
          checkInstructions: 'Check cleanliness, no tears, fresh smell',
          expectedCondition: 'clean'
        },
        {
          name: 'Toiletries',
          category: 'bathroom',
          description: 'Shampoo, soap, toothbrush, toothpaste',
          unitPrice: 150,
          standardQuantity: 2,
          checkInstructions: 'Check if sealed, not expired, adequate quantity',
          expectedCondition: 'fresh'
        },
        {
          name: 'Tea/Coffee',
          category: 'amenities',
          description: 'Tea bags, coffee sachets, sugar, creamer',
          unitPrice: 50,
          standardQuantity: 4,
          checkInstructions: 'Check if sealed, not expired, adequate quantity',
          expectedCondition: 'fresh'
        },
        {
          name: 'Water Bottles',
          category: 'amenities',
          description: 'Mineral water bottles',
          unitPrice: 30,
          standardQuantity: 2,
          checkInstructions: 'Check if sealed, not expired, adequate quantity',
          expectedCondition: 'fresh'
        }
      ],
      estimatedCheckDuration: 15,
      isActive: true
    });

    // Double Room Template
    const doubleTemplate = new DailyRoutineCheckTemplate({
      hotelId: hotel._id,
      roomType: 'double',
      fixedInventory: [
        {
          name: 'TV',
          category: 'electronics',
          description: '32-inch LED TV with remote control',
          unitPrice: 15000,
          standardQuantity: 1,
          checkInstructions: 'Check if TV turns on, remote works, channels are clear',
          expectedCondition: 'working'
        },
        {
          name: 'AC Unit',
          category: 'appliances',
          description: 'Split AC with remote control',
          unitPrice: 25000,
          standardQuantity: 1,
          checkInstructions: 'Check if AC cools properly, remote functions, filters clean',
          expectedCondition: 'working'
        },
        {
          name: 'Bed',
          category: 'furniture',
          description: 'Double bed with mattress',
          unitPrice: 15000,
          standardQuantity: 1,
          checkInstructions: 'Check mattress condition, bed frame stability',
          expectedCondition: 'undamaged'
        },
        {
          name: 'Wardrobe',
          category: 'furniture',
          description: 'Built-in wardrobe with hangers',
          unitPrice: 8000,
          standardQuantity: 1,
          checkInstructions: 'Check door hinges, shelves stability, hangers present',
          expectedCondition: 'functional'
        },
        {
          name: 'Bathroom Fixtures',
          category: 'fixtures',
          description: 'Toilet, sink, shower with fittings',
          unitPrice: 15000,
          standardQuantity: 1,
          checkInstructions: 'Check water flow, drainage, no leaks',
          expectedCondition: 'working'
        }
      ],
      dailyInventory: [
        {
          name: 'Towels',
          category: 'bathroom',
          description: 'Bath towels and hand towels',
          unitPrice: 800,
          standardQuantity: 4,
          checkInstructions: 'Check cleanliness, no stains, adequate quantity',
          expectedCondition: 'clean'
        },
        {
          name: 'Bed Sheets',
          category: 'bedroom',
          description: 'Fitted sheet, flat sheet, pillowcases',
          unitPrice: 1200,
          standardQuantity: 2,
          checkInstructions: 'Check cleanliness, no tears, fresh smell',
          expectedCondition: 'clean'
        },
        {
          name: 'Toiletries',
          category: 'bathroom',
          description: 'Shampoo, soap, toothbrush, toothpaste',
          unitPrice: 150,
          standardQuantity: 2,
          checkInstructions: 'Check if sealed, not expired, adequate quantity',
          expectedCondition: 'fresh'
        },
        {
          name: 'Tea/Coffee',
          category: 'amenities',
          description: 'Tea bags, coffee sachets, sugar, creamer',
          unitPrice: 50,
          standardQuantity: 4,
          checkInstructions: 'Check if sealed, not expired, adequate quantity',
          expectedCondition: 'fresh'
        },
        {
          name: 'Water Bottles',
          category: 'amenities',
          description: 'Mineral water bottles',
          unitPrice: 30,
          standardQuantity: 2,
          checkInstructions: 'Check if sealed, not expired, adequate quantity',
          expectedCondition: 'fresh'
        }
      ],
      estimatedCheckDuration: 15,
      isActive: true
    });

    // Deluxe Room Template
    const deluxeTemplate = new DailyRoutineCheckTemplate({
      hotelId: hotel._id,
      roomType: 'deluxe',
      fixedInventory: [
        {
          name: 'TV',
          category: 'electronics',
          description: '43-inch Smart TV with remote control',
          unitPrice: 25000,
          standardQuantity: 1,
          checkInstructions: 'Check if TV turns on, smart features work, remote functions',
          expectedCondition: 'working'
        },
        {
          name: 'AC Unit',
          category: 'appliances',
          description: 'Split AC with advanced controls',
          unitPrice: 35000,
          standardQuantity: 1,
          checkInstructions: 'Check if AC cools properly, advanced features work',
          expectedCondition: 'working'
        },
        {
          name: 'Bed',
          category: 'furniture',
          description: 'King size bed with premium mattress',
          unitPrice: 20000,
          standardQuantity: 1,
          checkInstructions: 'Check mattress condition, bed frame stability',
          expectedCondition: 'undamaged'
        },
        {
          name: 'Wardrobe',
          category: 'furniture',
          description: 'Premium wardrobe with additional storage',
          unitPrice: 15000,
          standardQuantity: 1,
          checkInstructions: 'Check door hinges, shelves stability, storage compartments',
          expectedCondition: 'functional'
        },
        {
          name: 'Bathroom Fixtures',
          category: 'fixtures',
          description: 'Premium toilet, sink, shower with fittings',
          unitPrice: 25000,
          standardQuantity: 1,
          checkInstructions: 'Check water flow, drainage, no leaks, premium finish',
          expectedCondition: 'working'
        },
        {
          name: 'Mini Fridge',
          category: 'appliances',
          description: 'Small refrigerator for beverages',
          unitPrice: 12000,
          standardQuantity: 1,
          checkInstructions: 'Check if cools properly, door seals properly',
          expectedCondition: 'working'
        }
      ],
      dailyInventory: [
        {
          name: 'Towels',
          category: 'bathroom',
          description: 'Premium bath towels and hand towels',
          unitPrice: 1200,
          standardQuantity: 6,
          checkInstructions: 'Check cleanliness, no stains, premium quality',
          expectedCondition: 'clean'
        },
        {
          name: 'Bed Sheets',
          category: 'bedroom',
          description: 'Premium fitted sheet, flat sheet, pillowcases',
          unitPrice: 2000,
          standardQuantity: 2,
          checkInstructions: 'Check cleanliness, no tears, premium quality',
          expectedCondition: 'clean'
        },
        {
          name: 'Toiletries',
          category: 'bathroom',
          description: 'Premium shampoo, soap, toothbrush, toothpaste',
          unitPrice: 300,
          standardQuantity: 2,
          checkInstructions: 'Check if sealed, not expired, premium quality',
          expectedCondition: 'fresh'
        },
        {
          name: 'Tea/Coffee',
          category: 'amenities',
          description: 'Premium tea bags, coffee sachets, sugar, creamer',
          unitPrice: 100,
          standardQuantity: 6,
          checkInstructions: 'Check if sealed, not expired, premium quality',
          expectedCondition: 'fresh'
        },
        {
          name: 'Water Bottles',
          category: 'amenities',
          description: 'Premium mineral water bottles',
          unitPrice: 50,
          standardQuantity: 4,
          checkInstructions: 'Check if sealed, not expired, premium quality',
          expectedCondition: 'fresh'
        },
        {
          name: 'Bathrobe',
          category: 'amenities',
          description: 'Premium cotton bathrobe',
          unitPrice: 800,
          standardQuantity: 2,
          checkInstructions: 'Check cleanliness, no stains, premium quality',
          expectedCondition: 'clean'
        }
      ],
      estimatedCheckDuration: 20,
      isActive: true
    });

    // Suite Template
    const suiteTemplate = new DailyRoutineCheckTemplate({
      hotelId: hotel._id,
      roomType: 'suite',
      fixedInventory: [
        {
          name: 'TV',
          category: 'electronics',
          description: '55-inch Smart TV with remote control',
          unitPrice: 40000,
          standardQuantity: 1,
          checkInstructions: 'Check if TV turns on, smart features work, remote functions',
          expectedCondition: 'working'
        },
        {
          name: 'AC Unit',
          category: 'appliances',
          description: 'Central AC with individual controls',
          unitPrice: 50000,
          standardQuantity: 1,
          checkInstructions: 'Check if AC cools properly, individual controls work',
          expectedCondition: 'working'
        },
        {
          name: 'Bed',
          category: 'furniture',
          description: 'King size bed with luxury mattress',
          unitPrice: 35000,
          standardQuantity: 1,
          checkInstructions: 'Check mattress condition, bed frame stability',
          expectedCondition: 'undamaged'
        },
        {
          name: 'Wardrobe',
          category: 'furniture',
          description: 'Luxury wardrobe with multiple compartments',
          unitPrice: 25000,
          standardQuantity: 1,
          checkInstructions: 'Check door hinges, shelves stability, all compartments',
          expectedCondition: 'functional'
        },
        {
          name: 'Bathroom Fixtures',
          category: 'fixtures',
          description: 'Luxury toilet, sink, shower with fittings',
          unitPrice: 40000,
          standardQuantity: 1,
          checkInstructions: 'Check water flow, drainage, no leaks, luxury finish',
          expectedCondition: 'working'
        },
        {
          name: 'Mini Fridge',
          category: 'appliances',
          description: 'Full-size refrigerator with beverages',
          unitPrice: 20000,
          standardQuantity: 1,
          checkInstructions: 'Check if cools properly, door seals properly',
          expectedCondition: 'working'
        },
        {
          name: 'Coffee Machine',
          category: 'appliances',
          description: 'Premium coffee machine with supplies',
          unitPrice: 15000,
          standardQuantity: 1,
          checkInstructions: 'Check if functions properly, supplies adequate',
          expectedCondition: 'working'
        }
      ],
      dailyInventory: [
        {
          name: 'Towels',
          category: 'bathroom',
          description: 'Luxury bath towels and hand towels',
          unitPrice: 2000,
          standardQuantity: 8,
          checkInstructions: 'Check cleanliness, no stains, luxury quality',
          expectedCondition: 'clean'
        },
        {
          name: 'Bed Sheets',
          category: 'bedroom',
          description: 'Luxury fitted sheet, flat sheet, pillowcases',
          unitPrice: 3500,
          standardQuantity: 2,
          checkInstructions: 'Check cleanliness, no tears, luxury quality',
          expectedCondition: 'clean'
        },
        {
          name: 'Toiletries',
          category: 'bathroom',
          description: 'Luxury shampoo, soap, toothbrush, toothpaste',
          unitPrice: 500,
          standardQuantity: 2,
          checkInstructions: 'Check if sealed, not expired, luxury quality',
          expectedCondition: 'fresh'
        },
        {
          name: 'Tea/Coffee',
          category: 'amenities',
          description: 'Luxury tea bags, coffee beans, sugar, creamer',
          unitPrice: 200,
          standardQuantity: 8,
          checkInstructions: 'Check if sealed, not expired, luxury quality',
          expectedCondition: 'fresh'
        },
        {
          name: 'Water Bottles',
          category: 'amenities',
          description: 'Luxury mineral water bottles',
          unitPrice: 80,
          standardQuantity: 6,
          checkInstructions: 'Check if sealed, not expired, luxury quality',
          expectedCondition: 'fresh'
        },
        {
          name: 'Bathrobe',
          category: 'amenities',
          description: 'Luxury cotton bathrobe',
          unitPrice: 1500,
          standardQuantity: 2,
          checkInstructions: 'Check cleanliness, no stains, luxury quality',
          expectedCondition: 'clean'
        },
        {
          name: 'Slippers',
          category: 'amenities',
          description: 'Premium hotel slippers',
          unitPrice: 300,
          standardQuantity: 2,
          checkInstructions: 'Check cleanliness, no stains, proper size',
          expectedCondition: 'clean'
        }
      ],
      estimatedCheckDuration: 25,
      isActive: true
    });

    // Save all templates
    await Promise.all([
      singleTemplate.save(),
      doubleTemplate.save(),
      deluxeTemplate.save(),
      suiteTemplate.save()
    ]);

    console.log('Successfully created daily routine check templates:');
    console.log('- Single Room Template');
    console.log('- Double Room Template');
    console.log('- Deluxe Room Template');
    console.log('- Suite Template');

  } catch (error) {
    console.error('Error creating templates:', error);
  }
};

const main = async () => {
  try {
    await connectDB();
    await createSampleTemplates();
    console.log('Daily routine check template seeding completed');
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await disconnectDB();
    process.exit(0);
  }
};

main();
