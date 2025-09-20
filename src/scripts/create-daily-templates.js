import mongoose from 'mongoose';
import DailyRoutineCheckTemplate from '../models/DailyRoutineCheckTemplate.js';

const MONGO_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const HOTEL_ID = '68c7e6ebca8aed0ec8036a9c';

const templateData = [
  {
    roomType: 'single',
    fixedInventory: [
      {
        name: 'Television',
        category: 'electronics',
        description: '32-inch LED TV with remote control',
        unitPrice: 15000,
        standardQuantity: 1,
        checkInstructions: 'Check power, remote functionality, and channel reception',
        expectedCondition: 'working'
      },
      {
        name: 'Air Conditioner',
        category: 'appliances',
        description: 'Split AC unit with remote',
        unitPrice: 25000,
        standardQuantity: 1,
        checkInstructions: 'Test cooling, heating, and remote control',
        expectedCondition: 'working'
      },
      {
        name: 'Bed',
        category: 'furniture',
        description: 'Single bed with headboard',
        unitPrice: 8000,
        standardQuantity: 1,
        checkInstructions: 'Check bed frame stability and mattress condition',
        expectedCondition: 'working'
      },
      {
        name: 'Study Table',
        category: 'furniture',
        description: 'Writing desk with chair',
        unitPrice: 3000,
        standardQuantity: 1,
        checkInstructions: 'Check table surface and chair condition',
        expectedCondition: 'working'
      },
      {
        name: 'Wardrobe',
        category: 'furniture',
        description: 'Built-in wardrobe with hangers',
        unitPrice: 5000,
        standardQuantity: 1,
        checkInstructions: 'Check doors, hangers, and interior lighting',
        expectedCondition: 'working'
      }
    ],
    dailyInventory: [
      {
        name: 'Bed Sheets',
        category: 'bedroom',
        description: 'Fresh bed sheets and pillowcases',
        unitPrice: 500,
        standardQuantity: 1,
        checkInstructions: 'Ensure clean, fresh sheets without stains or tears',
        expectedCondition: 'clean'
      },
      {
        name: 'Towels',
        category: 'bathroom',
        description: 'Bath towels and hand towels',
        unitPrice: 300,
        standardQuantity: 3,
        checkInstructions: 'Check cleanliness and adequate quantity',
        expectedCondition: 'clean'
      },
      {
        name: 'Toiletries',
        category: 'bathroom',
        description: 'Soap, shampoo, and toilet paper',
        unitPrice: 150,
        standardQuantity: 1,
        checkInstructions: 'Ensure adequate supply and check expiry dates',
        expectedCondition: 'fresh'
      },
      {
        name: 'Water Bottles',
        category: 'amenities',
        description: 'Complimentary water bottles',
        unitPrice: 25,
        standardQuantity: 2,
        checkInstructions: 'Check seal integrity and expiry date',
        expectedCondition: 'fresh'
      },
      {
        name: 'Tea/Coffee Kit',
        category: 'amenities',
        description: 'Tea bags, coffee sachets, sugar, cups',
        unitPrice: 100,
        standardQuantity: 1,
        checkInstructions: 'Ensure complete kit with clean cups',
        expectedCondition: 'adequate'
      }
    ]
  },
  {
    roomType: 'double',
    fixedInventory: [
      {
        name: 'Television',
        category: 'electronics',
        description: '42-inch LED TV with remote control',
        unitPrice: 20000,
        standardQuantity: 1,
        checkInstructions: 'Check power, remote functionality, and channel reception',
        expectedCondition: 'working'
      },
      {
        name: 'Air Conditioner',
        category: 'appliances',
        description: 'Split AC unit with remote',
        unitPrice: 30000,
        standardQuantity: 1,
        checkInstructions: 'Test cooling, heating, and remote control',
        expectedCondition: 'working'
      },
      {
        name: 'Double Bed',
        category: 'furniture',
        description: 'Double bed with headboard',
        unitPrice: 12000,
        standardQuantity: 1,
        checkInstructions: 'Check bed frame stability and mattress condition',
        expectedCondition: 'working'
      },
      {
        name: 'Study Table',
        category: 'furniture',
        description: 'Writing desk with chair',
        unitPrice: 3500,
        standardQuantity: 1,
        checkInstructions: 'Check table surface and chair condition',
        expectedCondition: 'working'
      },
      {
        name: 'Wardrobe',
        category: 'furniture',
        description: 'Built-in wardrobe with hangers',
        unitPrice: 6000,
        standardQuantity: 1,
        checkInstructions: 'Check doors, hangers, and interior lighting',
        expectedCondition: 'working'
      },
      {
        name: 'Mini Refrigerator',
        category: 'appliances',
        description: 'Small refrigerator for beverages',
        unitPrice: 8000,
        standardQuantity: 1,
        checkInstructions: 'Check cooling function and cleanliness',
        expectedCondition: 'working'
      }
    ],
    dailyInventory: [
      {
        name: 'Bed Sheets',
        category: 'bedroom',
        description: 'Fresh bed sheets and pillowcases',
        unitPrice: 700,
        standardQuantity: 1,
        checkInstructions: 'Ensure clean, fresh sheets without stains or tears',
        expectedCondition: 'clean'
      },
      {
        name: 'Towels',
        category: 'bathroom',
        description: 'Bath towels and hand towels',
        unitPrice: 400,
        standardQuantity: 4,
        checkInstructions: 'Check cleanliness and adequate quantity',
        expectedCondition: 'clean'
      },
      {
        name: 'Toiletries',
        category: 'bathroom',
        description: 'Soap, shampoo, conditioner, and toilet paper',
        unitPrice: 200,
        standardQuantity: 1,
        checkInstructions: 'Ensure adequate supply and check expiry dates',
        expectedCondition: 'fresh'
      },
      {
        name: 'Water Bottles',
        category: 'amenities',
        description: 'Complimentary water bottles',
        unitPrice: 25,
        standardQuantity: 4,
        checkInstructions: 'Check seal integrity and expiry date',
        expectedCondition: 'fresh'
      },
      {
        name: 'Tea/Coffee Kit',
        category: 'amenities',
        description: 'Tea bags, coffee sachets, sugar, cups',
        unitPrice: 150,
        standardQuantity: 1,
        checkInstructions: 'Ensure complete kit with clean cups',
        expectedCondition: 'adequate'
      },
      {
        name: 'Slippers',
        category: 'amenities',
        description: 'Disposable slippers for guests',
        unitPrice: 50,
        standardQuantity: 2,
        checkInstructions: 'Ensure clean, packaged slippers',
        expectedCondition: 'clean'
      }
    ]
  },
  {
    roomType: 'suite',
    fixedInventory: [
      {
        name: 'Living Room TV',
        category: 'electronics',
        description: '55-inch LED TV with premium channels',
        unitPrice: 35000,
        standardQuantity: 1,
        checkInstructions: 'Check power, remote functionality, and channel reception',
        expectedCondition: 'working'
      },
      {
        name: 'Bedroom TV',
        category: 'electronics',
        description: '42-inch LED TV in bedroom',
        unitPrice: 20000,
        standardQuantity: 1,
        checkInstructions: 'Check power, remote functionality, and channel reception',
        expectedCondition: 'working'
      },
      {
        name: 'Air Conditioner',
        category: 'appliances',
        description: 'Central AC system with digital controls',
        unitPrice: 50000,
        standardQuantity: 1,
        checkInstructions: 'Test cooling, heating, and digital controls',
        expectedCondition: 'working'
      },
      {
        name: 'King Size Bed',
        category: 'furniture',
        description: 'King size bed with premium mattress',
        unitPrice: 20000,
        standardQuantity: 1,
        checkInstructions: 'Check bed frame stability and mattress condition',
        expectedCondition: 'working'
      },
      {
        name: 'Sofa Set',
        category: 'furniture',
        description: '3-seater sofa with coffee table',
        unitPrice: 15000,
        standardQuantity: 1,
        checkInstructions: 'Check upholstery and structural integrity',
        expectedCondition: 'working'
      },
      {
        name: 'Work Desk',
        category: 'furniture',
        description: 'Executive desk with ergonomic chair',
        unitPrice: 5000,
        standardQuantity: 1,
        checkInstructions: 'Check desk surface and chair adjustment',
        expectedCondition: 'working'
      },
      {
        name: 'Mini Bar',
        category: 'appliances',
        description: 'Stocked mini bar refrigerator',
        unitPrice: 12000,
        standardQuantity: 1,
        checkInstructions: 'Check cooling, lighting, and lock mechanism',
        expectedCondition: 'working'
      },
      {
        name: 'Safe',
        category: 'fixtures',
        description: 'Electronic safe for valuables',
        unitPrice: 3000,
        standardQuantity: 1,
        checkInstructions: 'Test electronic lock and battery level',
        expectedCondition: 'working'
      }
    ],
    dailyInventory: [
      {
        name: 'Premium Bed Sheets',
        category: 'bedroom',
        description: 'High-thread-count bed sheets and pillowcases',
        unitPrice: 1200,
        standardQuantity: 1,
        checkInstructions: 'Ensure pristine condition without any stains or tears',
        expectedCondition: 'clean'
      },
      {
        name: 'Luxury Towels',
        category: 'bathroom',
        description: 'Bath towels, hand towels, and face towels',
        unitPrice: 800,
        standardQuantity: 6,
        checkInstructions: 'Check cleanliness and fluffiness',
        expectedCondition: 'clean'
      },
      {
        name: 'Premium Toiletries',
        category: 'bathroom',
        description: 'High-end soap, shampoo, conditioner, lotion',
        unitPrice: 400,
        standardQuantity: 1,
        checkInstructions: 'Ensure full bottles and check expiry dates',
        expectedCondition: 'fresh'
      },
      {
        name: 'Bathrobes',
        category: 'bathroom',
        description: 'Plush bathrobes for guests',
        unitPrice: 1500,
        standardQuantity: 2,
        checkInstructions: 'Check cleanliness and belt attachment',
        expectedCondition: 'clean'
      },
      {
        name: 'Welcome Fruit Basket',
        category: 'amenities',
        description: 'Fresh seasonal fruit basket',
        unitPrice: 500,
        standardQuantity: 1,
        checkInstructions: 'Ensure fresh fruits without any spoilage',
        expectedCondition: 'fresh'
      },
      {
        name: 'Premium Water',
        category: 'amenities',
        description: 'Premium bottled water',
        unitPrice: 50,
        standardQuantity: 4,
        checkInstructions: 'Check seal integrity and expiry date',
        expectedCondition: 'fresh'
      },
      {
        name: 'Gourmet Coffee Kit',
        category: 'amenities',
        description: 'Premium coffee, tea selection, and snacks',
        unitPrice: 300,
        standardQuantity: 1,
        checkInstructions: 'Ensure complete selection with clean utensils',
        expectedCondition: 'adequate'
      },
      {
        name: 'Premium Slippers',
        category: 'amenities',
        description: 'Comfortable slippers for guests',
        unitPrice: 200,
        standardQuantity: 2,
        checkInstructions: 'Ensure clean, well-packaged slippers',
        expectedCondition: 'clean'
      }
    ]
  },
  {
    roomType: 'deluxe',
    fixedInventory: [
      {
        name: 'Smart TV',
        category: 'electronics',
        description: '50-inch Smart LED TV with streaming services',
        unitPrice: 30000,
        standardQuantity: 1,
        checkInstructions: 'Check power, smart features, and streaming connectivity',
        expectedCondition: 'working'
      },
      {
        name: 'Air Conditioner',
        category: 'appliances',
        description: 'Inverter AC with digital display',
        unitPrice: 35000,
        standardQuantity: 1,
        checkInstructions: 'Test cooling efficiency and digital controls',
        expectedCondition: 'working'
      },
      {
        name: 'Queen Size Bed',
        category: 'furniture',
        description: 'Queen size bed with orthopedic mattress',
        unitPrice: 15000,
        standardQuantity: 1,
        checkInstructions: 'Check bed stability and mattress comfort',
        expectedCondition: 'working'
      },
      {
        name: 'Seating Area',
        category: 'furniture',
        description: 'Comfortable seating with side table',
        unitPrice: 8000,
        standardQuantity: 1,
        checkInstructions: 'Check upholstery and table stability',
        expectedCondition: 'working'
      },
      {
        name: 'Work Station',
        category: 'furniture',
        description: 'Modern work desk with adjustable chair',
        unitPrice: 4000,
        standardQuantity: 1,
        checkInstructions: 'Check desk functionality and chair adjustment',
        expectedCondition: 'working'
      },
      {
        name: 'Mini Fridge',
        category: 'appliances',
        description: 'Energy-efficient mini refrigerator',
        unitPrice: 10000,
        standardQuantity: 1,
        checkInstructions: 'Check cooling and cleanliness',
        expectedCondition: 'working'
      },
      {
        name: 'Wardrobe',
        category: 'furniture',
        description: 'Spacious wardrobe with LED lighting',
        unitPrice: 7000,
        standardQuantity: 1,
        checkInstructions: 'Check doors, lighting, and hanger functionality',
        expectedCondition: 'working'
      }
    ],
    dailyInventory: [
      {
        name: 'Quality Bed Sheets',
        category: 'bedroom',
        description: 'High-quality bed sheets and pillowcases',
        unitPrice: 900,
        standardQuantity: 1,
        checkInstructions: 'Ensure clean, fresh sheets without defects',
        expectedCondition: 'clean'
      },
      {
        name: 'Premium Towels',
        category: 'bathroom',
        description: 'Soft bath and hand towels',
        unitPrice: 600,
        standardQuantity: 5,
        checkInstructions: 'Check softness and cleanliness',
        expectedCondition: 'clean'
      },
      {
        name: 'Quality Toiletries',
        category: 'bathroom',
        description: 'Quality soap, shampoo, and conditioner',
        unitPrice: 300,
        standardQuantity: 1,
        checkInstructions: 'Ensure adequate quantity and freshness',
        expectedCondition: 'fresh'
      },
      {
        name: 'Complimentary Water',
        category: 'amenities',
        description: 'Premium complimentary water bottles',
        unitPrice: 30,
        standardQuantity: 3,
        checkInstructions: 'Check seal and expiry date',
        expectedCondition: 'fresh'
      },
      {
        name: 'Coffee/Tea Station',
        category: 'amenities',
        description: 'Quality coffee and tea with accompaniments',
        unitPrice: 200,
        standardQuantity: 1,
        checkInstructions: 'Ensure complete station with clean accessories',
        expectedCondition: 'adequate'
      },
      {
        name: 'Guest Amenities',
        category: 'amenities',
        description: 'Slippers, dental kit, shower cap',
        unitPrice: 150,
        standardQuantity: 1,
        checkInstructions: 'Ensure all items are properly packaged',
        expectedCondition: 'clean'
      }
    ]
  }
];

async function createTemplates() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGO_URI);
    
    console.log('Clearing existing templates...');
    await DailyRoutineCheckTemplate.deleteMany({});
    
    console.log('Creating new templates...');
    for (const template of templateData) {
      const newTemplate = new DailyRoutineCheckTemplate({
        hotelId: new mongoose.Types.ObjectId(HOTEL_ID),
        roomType: template.roomType,
        fixedInventory: template.fixedInventory,
        dailyInventory: template.dailyInventory,
        estimatedCheckDuration: 20,
        isActive: true,
        createdBy: new mongoose.Types.ObjectId(HOTEL_ID), // Using hotel ID as placeholder
        lastUpdatedBy: new mongoose.Types.ObjectId(HOTEL_ID)
      });
      
      await newTemplate.save();
      console.log(`✓ Created template for ${template.roomType} rooms`);
      console.log(`  - Fixed Inventory: ${template.fixedInventory.length} items`);
      console.log(`  - Daily Inventory: ${template.dailyInventory.length} items`);
    }
    
    console.log('\\n✅ All templates created successfully!');
    
    // Verify creation
    const count = await DailyRoutineCheckTemplate.countDocuments({});
    console.log(`Total templates in database: ${count}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating templates:', error);
    process.exit(1);
  }
}

createTemplates();