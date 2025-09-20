import mongoose from 'mongoose';
import 'dotenv/config';

// Import models
import CheckoutAutomationConfig from './src/models/CheckoutAutomationConfig.js';
import LaundryTemplate from './src/models/LaundryTemplate.js';
import CheckoutAutomationLog from './src/models/CheckoutAutomationLog.js';
import Hotel from './src/models/Hotel.js';
import User from './src/models/User.js';

const seedAutomationData = async () => {
  try {
    console.log('🚀 Starting Automation System Seed Data...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.DATABASE_URL || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Get or create a hotel
    let hotel = await Hotel.findOne();
    if (!hotel) {
      console.log('⚠️  No hotel found. Please run the main seed script first.');
      return;
    }

    // Get or create an admin user
    let adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.log('⚠️  No admin user found. Please run the main seed script first.');
      return;
    }

    console.log(`🏨 Using Hotel: ${hotel.name} (${hotel._id})`);
    console.log(`👤 Using Admin: ${adminUser.name} (${adminUser._id})`);

    // === CHECKOUT AUTOMATION CONFIG ===
    console.log('⚙️  Seeding Checkout Automation Configuration...');
    
    // Check if config already exists
    let automationConfig = await CheckoutAutomationConfig.findOne({ hotelId: hotel._id });
    
    if (!automationConfig) {
      automationConfig = await CheckoutAutomationConfig.createDefault(hotel._id, adminUser._id);
      console.log('✅ Created default automation configuration');
    } else {
      console.log('✅ Automation configuration already exists');
    }

    // === LAUNDRY TEMPLATES ===
    console.log('🧺 Seeding Laundry Templates...');
    
    // Check if templates already exist
    const existingTemplates = await LaundryTemplate.find({ hotelId: hotel._id });
    
    if (existingTemplates.length === 0) {
      // Create default templates for all room types
      const defaultTemplates = await LaundryTemplate.createDefaultTemplates(hotel._id, adminUser._id);
      console.log(`✅ Created ${defaultTemplates.length} default laundry templates`);

      // Create additional custom templates
      const customTemplates = [
        {
          hotelId: hotel._id,
          roomType: 'suite',
          templateName: 'Suite Room Laundry Template',
          description: 'Comprehensive laundry template for suite rooms with premium amenities',
          items: [
            {
              itemId: null,
              itemName: 'Premium Bed Sheets',
              category: 'bedding',
              baseQuantity: 4,
              guestMultiplier: 1,
              isRequired: true,
              defaultReturnDays: 1,
              priority: 'high',
              costPerItem: 25.00,
              specialInstructions: 'Premium cotton sheets - handle with care'
            },
            {
              itemId: null,
              itemName: 'Silk Pillowcases',
              category: 'bedding',
              baseQuantity: 4,
              guestMultiplier: 1,
              isRequired: true,
              defaultReturnDays: 1,
              priority: 'high',
              costPerItem: 15.00,
              specialInstructions: 'Silk pillowcases - delicate handling required'
            },
            {
              itemId: null,
              itemName: 'Premium Bath Towels',
              category: 'towels',
              baseQuantity: 8,
              guestMultiplier: 1.5,
              isRequired: true,
              defaultReturnDays: 1,
              priority: 'medium',
              costPerItem: 12.00,
              specialInstructions: 'Premium Egyptian cotton towels'
            },
            {
              itemId: null,
              itemName: 'Hand Towels',
              category: 'towels',
              baseQuantity: 6,
              guestMultiplier: 1,
              isRequired: true,
              defaultReturnDays: 1,
              priority: 'medium',
              costPerItem: 6.00
            },
            {
              itemId: null,
              itemName: 'Luxury Bathrobes',
              category: 'bathrobes',
              baseQuantity: 2,
              guestMultiplier: 1,
              isRequired: true,
              defaultReturnDays: 2,
              priority: 'low',
              costPerItem: 45.00,
              specialInstructions: 'Luxury bathrobes - dry clean only'
            },
            {
              itemId: null,
              itemName: 'Premium Curtains',
              category: 'curtains',
              baseQuantity: 1,
              guestMultiplier: 0,
              isRequired: false,
              defaultReturnDays: 3,
              priority: 'low',
              costPerItem: 60.00,
              specialInstructions: 'Premium curtains - professional cleaning required'
            }
          ],
          guestCountAdjustments: {
            single: 0.8,
            double: 1.0,
            triple: 1.2,
            quadPlus: 1.5
          },
          seasonalAdjustments: {
            summer: 1.1,
            winter: 0.9,
            monsoon: 1.2
          },
          isDefault: true,
          isActive: true,
          createdBy: adminUser._id
        },
        {
          hotelId: hotel._id,
          roomType: 'presidential',
          templateName: 'Presidential Suite Laundry Template',
          description: 'Ultimate luxury laundry template for presidential suites',
          items: [
            {
              itemId: null,
              itemName: 'Luxury Bed Sheets',
              category: 'bedding',
              baseQuantity: 6,
              guestMultiplier: 1,
              isRequired: true,
              defaultReturnDays: 1,
              priority: 'urgent',
              costPerItem: 35.00,
              specialInstructions: 'Luxury Egyptian cotton sheets - premium handling'
            },
            {
              itemId: null,
              itemName: 'Silk Pillowcases',
              category: 'bedding',
              baseQuantity: 6,
              guestMultiplier: 1,
              isRequired: true,
              defaultReturnDays: 1,
              priority: 'urgent',
              costPerItem: 20.00,
              specialInstructions: 'Pure silk pillowcases - delicate handling'
            },
            {
              itemId: null,
              itemName: 'Luxury Bath Towels',
              category: 'towels',
              baseQuantity: 12,
              guestMultiplier: 1.5,
              isRequired: true,
              defaultReturnDays: 1,
              priority: 'high',
              costPerItem: 18.00,
              specialInstructions: 'Luxury Turkish cotton towels'
            },
            {
              itemId: null,
              itemName: 'Hand Towels',
              category: 'towels',
              baseQuantity: 8,
              guestMultiplier: 1,
              isRequired: true,
              defaultReturnDays: 1,
              priority: 'high',
              costPerItem: 8.00
            },
            {
              itemId: null,
              itemName: 'Ultra Luxury Bathrobes',
              category: 'bathrobes',
              baseQuantity: 2,
              guestMultiplier: 1,
              isRequired: true,
              defaultReturnDays: 2,
              priority: 'medium',
              costPerItem: 65.00,
              specialInstructions: 'Ultra luxury bathrobes - professional dry cleaning only'
            },
            {
              itemId: null,
              itemName: 'Luxury Curtains',
              category: 'curtains',
              baseQuantity: 2,
              guestMultiplier: 0,
              isRequired: false,
              defaultReturnDays: 3,
              priority: 'low',
              costPerItem: 85.00,
              specialInstructions: 'Luxury curtains - professional cleaning required'
            },
            {
              itemId: null,
              itemName: 'Table Linens',
              category: 'linens',
              baseQuantity: 4,
              guestMultiplier: 0,
              isRequired: false,
              defaultReturnDays: 2,
              priority: 'low',
              costPerItem: 25.00,
              specialInstructions: 'Premium table linens for dining area'
            }
          ],
          guestCountAdjustments: {
            single: 0.7,
            double: 1.0,
            triple: 1.3,
            quadPlus: 1.8
          },
          seasonalAdjustments: {
            summer: 1.2,
            winter: 0.8,
            monsoon: 1.3
          },
          isDefault: true,
          isActive: true,
          createdBy: adminUser._id
        }
      ];

      const createdCustomTemplates = await LaundryTemplate.insertMany(customTemplates);
      console.log(`✅ Created ${createdCustomTemplates.length} custom laundry templates`);
    } else {
      console.log(`✅ ${existingTemplates.length} laundry templates already exist`);
    }

    // === SAMPLE AUTOMATION LOGS ===
    console.log('📊 Seeding Sample Automation Logs...');
    
    const existingLogs = await CheckoutAutomationLog.find({ hotelId: hotel._id });
    
    if (existingLogs.length === 0) {
      // Create sample automation logs for demonstration
      const sampleLogs = [
        {
          hotelId: hotel._id,
          bookingId: null, // Will be populated if bookings exist
          roomId: null, // Will be populated if rooms exist
          triggeredBy: 'system',
          automationType: 'full_checkout',
          status: 'completed',
          startTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          endTime: new Date(Date.now() - 2 * 60 * 60 * 1000 + 15 * 60 * 1000), // 15 minutes later
          duration: 15,
          steps: [
            {
              step: 'laundry_processing',
              status: 'completed',
              startTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
              endTime: new Date(Date.now() - 2 * 60 * 60 * 1000 + 5 * 60 * 1000),
              duration: 5,
              details: {
                itemsProcessed: 8,
                totalCost: 120.00,
                templateUsed: 'Standard Room Laundry Template'
              }
            },
            {
              step: 'inventory_assessment',
              status: 'completed',
              startTime: new Date(Date.now() - 2 * 60 * 60 * 1000 + 5 * 60 * 1000),
              endTime: new Date(Date.now() - 2 * 60 * 60 * 1000 + 10 * 60 * 1000),
              duration: 5,
              details: {
                itemsChecked: 15,
                itemsReplaced: 2,
                totalCost: 45.00,
                conditionScore: 8.5
              }
            },
            {
              step: 'housekeeping_tasks',
              status: 'completed',
              startTime: new Date(Date.now() - 2 * 60 * 60 * 1000 + 10 * 60 * 1000),
              endTime: new Date(Date.now() - 2 * 60 * 60 * 1000 + 15 * 60 * 1000),
              duration: 5,
              details: {
                tasksCreated: 3,
                tasksAssigned: 2,
                estimatedDuration: 45
              }
            }
          ],
          results: {
            totalCost: 165.00,
            totalDuration: 15,
            successRate: 100,
            itemsProcessed: 23,
            tasksCreated: 3
          },
          errors: [],
          metadata: {
            guestCount: 2,
            roomType: 'standard',
            season: 'normal',
            roomCondition: 'good'
          }
        },
        {
          hotelId: hotel._id,
          bookingId: null,
          roomId: null,
          triggeredBy: 'system',
          automationType: 'full_checkout',
          status: 'completed',
          startTime: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
          endTime: new Date(Date.now() - 4 * 60 * 60 * 1000 + 20 * 60 * 1000), // 20 minutes later
          duration: 20,
          steps: [
            {
              step: 'laundry_processing',
              status: 'completed',
              startTime: new Date(Date.now() - 4 * 60 * 60 * 1000),
              endTime: new Date(Date.now() - 4 * 60 * 60 * 1000 + 8 * 60 * 1000),
              duration: 8,
              details: {
                itemsProcessed: 12,
                totalCost: 180.00,
                templateUsed: 'Deluxe Room Laundry Template'
              }
            },
            {
              step: 'inventory_assessment',
              status: 'completed',
              startTime: new Date(Date.now() - 4 * 60 * 60 * 1000 + 8 * 60 * 1000),
              endTime: new Date(Date.now() - 4 * 60 * 60 * 1000 + 15 * 60 * 1000),
              duration: 7,
              details: {
                itemsChecked: 20,
                itemsReplaced: 3,
                totalCost: 75.00,
                conditionScore: 9.0
              }
            },
            {
              step: 'housekeeping_tasks',
              status: 'completed',
              startTime: new Date(Date.now() - 4 * 60 * 60 * 1000 + 15 * 60 * 1000),
              endTime: new Date(Date.now() - 4 * 60 * 60 * 1000 + 20 * 60 * 1000),
              duration: 5,
              details: {
                tasksCreated: 4,
                tasksAssigned: 3,
                estimatedDuration: 60
              }
            }
          ],
          results: {
            totalCost: 255.00,
            totalDuration: 20,
            successRate: 100,
            itemsProcessed: 32,
            tasksCreated: 4
          },
          errors: [],
          metadata: {
            guestCount: 3,
            roomType: 'deluxe',
            season: 'normal',
            roomCondition: 'excellent'
          }
        }
      ];

      const createdLogs = await CheckoutAutomationLog.insertMany(sampleLogs);
      console.log(`✅ Created ${createdLogs.length} sample automation logs`);
    } else {
      console.log(`✅ ${existingLogs.length} automation logs already exist`);
    }

    console.log('🎉 Automation System Seed Data Complete!');
    console.log('\n📋 Summary:');
    console.log(`   • Automation Config: ${automationConfig ? '✅ Created' : '❌ Failed'}`);
    console.log(`   • Laundry Templates: ${existingTemplates.length} existing`);
    console.log(`   • Automation Logs: ${existingLogs.length} existing`);
    
    console.log('\n🌐 Access the Automation Dashboard at:');
    console.log('   http://localhost:3000/admin/automation');
    console.log('\n🔑 Login with admin credentials to access the automation features.');

  } catch (error) {
    console.error('❌ Error seeding automation data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

// Run the seed function
seedAutomationData();
