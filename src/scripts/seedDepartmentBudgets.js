import 'dotenv/config';
import mongoose from 'mongoose';
import DepartmentBudget from '../models/DepartmentBudget.js';
import Hotel from '../models/Hotel.js';
import connectDB from '../config/database.js';

// Connect to database
await connectDB();

console.log('🏦 Seeding Department Budgets...');

try {
  // Get all hotels
  const hotels = await Hotel.find();

  if (hotels.length === 0) {
    console.log('❌ No hotels found. Please seed hotels first.');
    process.exit(1);
  }

  // Department budget configurations
  const departmentConfigs = {
    housekeeping: {
      monthly: { supply_requests: 25000, equipment: 8000, maintenance: 3000 },
      quarterly: { supply_requests: 75000, equipment: 25000, maintenance: 10000 },
      yearly: { supply_requests: 300000, equipment: 100000, maintenance: 40000 }
    },
    maintenance: {
      monthly: { supply_requests: 35000, equipment: 15000, maintenance: 12000 },
      quarterly: { supply_requests: 105000, equipment: 45000, maintenance: 36000 },
      yearly: { supply_requests: 420000, equipment: 180000, maintenance: 144000 }
    },
    front_desk: {
      monthly: { supply_requests: 15000, equipment: 5000, maintenance: 2000 },
      quarterly: { supply_requests: 45000, equipment: 15000, maintenance: 6000 },
      yearly: { supply_requests: 180000, equipment: 60000, maintenance: 24000 }
    },
    food_beverage: {
      monthly: { supply_requests: 40000, equipment: 12000, maintenance: 8000 },
      quarterly: { supply_requests: 120000, equipment: 36000, maintenance: 24000 },
      yearly: { supply_requests: 480000, equipment: 144000, maintenance: 96000 }
    },
    spa: {
      monthly: { supply_requests: 20000, equipment: 8000, maintenance: 4000 },
      quarterly: { supply_requests: 60000, equipment: 24000, maintenance: 12000 },
      yearly: { supply_requests: 240000, equipment: 96000, maintenance: 48000 }
    },
    laundry: {
      monthly: { supply_requests: 18000, equipment: 10000, maintenance: 6000 },
      quarterly: { supply_requests: 54000, equipment: 30000, maintenance: 18000 },
      yearly: { supply_requests: 216000, equipment: 120000, maintenance: 72000 }
    },
    kitchen: {
      monthly: { supply_requests: 45000, equipment: 20000, maintenance: 15000 },
      quarterly: { supply_requests: 135000, equipment: 60000, maintenance: 45000 },
      yearly: { supply_requests: 540000, equipment: 240000, maintenance: 180000 }
    },
    bar: {
      monthly: { supply_requests: 30000, equipment: 8000, maintenance: 4000 },
      quarterly: { supply_requests: 90000, equipment: 24000, maintenance: 12000 },
      yearly: { supply_requests: 360000, equipment: 96000, maintenance: 48000 }
    }
  };

  const departments = Object.keys(departmentConfigs);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const currentQuarter = Math.ceil(currentMonth / 3);

  let totalBudgetsCreated = 0;

  for (const hotel of hotels) {
    console.log(`\n🏨 Processing ${hotel.name}...`);

    for (const department of departments) {
      const config = departmentConfigs[department];

      // Create yearly budget
      const yearlyBudget = await DepartmentBudget.findOneAndUpdate(
        {
          hotelId: hotel._id,
          department,
          'budgetPeriod.year': currentYear,
          'budgetPeriod.month': null,
          'budgetPeriod.quarter': null
        },
        {
          hotelId: hotel._id,
          department,
          budgetPeriod: { year: currentYear },
          allocations: {
            total: config.yearly.supply_requests + config.yearly.equipment + config.yearly.maintenance,
            supply_requests: config.yearly.supply_requests,
            equipment: config.yearly.equipment,
            maintenance: config.yearly.maintenance,
            other: 0
          },
          spent: {
            total: Math.floor(Math.random() * config.yearly.supply_requests * 0.3), // Random 0-30% spent
            supply_requests: Math.floor(Math.random() * config.yearly.supply_requests * 0.25),
            equipment: Math.floor(Math.random() * config.yearly.equipment * 0.15),
            maintenance: Math.floor(Math.random() * config.yearly.maintenance * 0.2),
            other: 0
          },
          commitments: {
            pending_approvals: Math.floor(Math.random() * 10000), // Random pending commitments
            approved_orders: Math.floor(Math.random() * 15000) // Random approved orders
          },
          status: 'active'
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Create quarterly budget (current quarter)
      const quarterlyBudget = await DepartmentBudget.findOneAndUpdate(
        {
          hotelId: hotel._id,
          department,
          'budgetPeriod.year': currentYear,
          'budgetPeriod.quarter': currentQuarter,
          'budgetPeriod.month': null
        },
        {
          hotelId: hotel._id,
          department,
          budgetPeriod: { year: currentYear, quarter: currentQuarter },
          allocations: {
            total: config.quarterly.supply_requests + config.quarterly.equipment + config.quarterly.maintenance,
            supply_requests: config.quarterly.supply_requests,
            equipment: config.quarterly.equipment,
            maintenance: config.quarterly.maintenance,
            other: 0
          },
          spent: {
            total: Math.floor(Math.random() * config.quarterly.supply_requests * 0.4),
            supply_requests: Math.floor(Math.random() * config.quarterly.supply_requests * 0.35),
            equipment: Math.floor(Math.random() * config.quarterly.equipment * 0.25),
            maintenance: Math.floor(Math.random() * config.quarterly.maintenance * 0.3),
            other: 0
          },
          commitments: {
            pending_approvals: Math.floor(Math.random() * 5000),
            approved_orders: Math.floor(Math.random() * 8000)
          },
          status: 'active'
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Create monthly budget (current month)
      const monthlyBudget = await DepartmentBudget.findOneAndUpdate(
        {
          hotelId: hotel._id,
          department,
          'budgetPeriod.year': currentYear,
          'budgetPeriod.month': currentMonth
        },
        {
          hotelId: hotel._id,
          department,
          budgetPeriod: { year: currentYear, month: currentMonth },
          allocations: {
            total: config.monthly.supply_requests + config.monthly.equipment + config.monthly.maintenance,
            supply_requests: config.monthly.supply_requests,
            equipment: config.monthly.equipment,
            maintenance: config.monthly.maintenance,
            other: 0
          },
          spent: {
            total: Math.floor(Math.random() * config.monthly.supply_requests * 0.6),
            supply_requests: Math.floor(Math.random() * config.monthly.supply_requests * 0.55),
            equipment: Math.floor(Math.random() * config.monthly.equipment * 0.35),
            maintenance: Math.floor(Math.random() * config.monthly.maintenance * 0.4),
            other: 0
          },
          commitments: {
            pending_approvals: Math.floor(Math.random() * 3000),
            approved_orders: Math.floor(Math.random() * 4000)
          },
          status: 'active'
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      totalBudgetsCreated += 3; // yearly, quarterly, monthly
      console.log(`   ✅ Created budgets for ${department} department`);
    }

    // Create some previous months for trend analysis
    for (let monthOffset = 1; monthOffset <= 6; monthOffset++) {
      const targetDate = new Date();
      targetDate.setMonth(targetDate.getMonth() - monthOffset);
      const targetYear = targetDate.getFullYear();
      const targetMonth = targetDate.getMonth() + 1;

      for (const department of departments.slice(0, 4)) { // Only create for 4 departments to save time
        const config = departmentConfigs[department];

        await DepartmentBudget.findOneAndUpdate(
          {
            hotelId: hotel._id,
            department,
            'budgetPeriod.year': targetYear,
            'budgetPeriod.month': targetMonth
          },
          {
            hotelId: hotel._id,
            department,
            budgetPeriod: { year: targetYear, month: targetMonth },
            allocations: {
              total: config.monthly.supply_requests + config.monthly.equipment + config.monthly.maintenance,
              supply_requests: config.monthly.supply_requests,
              equipment: config.monthly.equipment,
              maintenance: config.monthly.maintenance,
              other: 0
            },
            spent: {
              total: Math.floor(config.monthly.supply_requests * (0.7 + Math.random() * 0.3)), // 70-100% spent for past months
              supply_requests: Math.floor(config.monthly.supply_requests * (0.65 + Math.random() * 0.3)),
              equipment: Math.floor(config.monthly.equipment * (0.5 + Math.random() * 0.4)),
              maintenance: Math.floor(config.monthly.maintenance * (0.6 + Math.random() * 0.3)),
              other: 0
            },
            commitments: {
              pending_approvals: 0, // Past months should have no pending commitments
              approved_orders: 0
            },
            status: monthOffset > 3 ? 'closed' : 'active'
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        totalBudgetsCreated++;
      }
    }
  }

  console.log(`\n✅ Successfully created ${totalBudgetsCreated} department budgets across ${hotels.length} hotels!`);
  console.log(`\n📊 Budget Summary:`);
  console.log(`   - Current year budgets: ${departments.length * hotels.length} yearly`);
  console.log(`   - Current quarter budgets: ${departments.length * hotels.length} quarterly`);
  console.log(`   - Current month budgets: ${departments.length * hotels.length} monthly`);
  console.log(`   - Historical trend data: ${4 * 6 * hotels.length} previous months`);

  // Display sample utilization data
  const sampleBudgets = await DepartmentBudget.find({
    'budgetPeriod.year': currentYear,
    'budgetPeriod.month': currentMonth
  }).limit(5);

  console.log(`\n📋 Sample Budget Utilization:`);
  sampleBudgets.forEach((budget, index) => {
    console.log(`   ${index + 1}. ${budget.department}: ${budget.utilizationPercentage.toFixed(1)}% (₹${budget.spent.supply_requests.toLocaleString('en-IN')} / ₹${budget.allocations.supply_requests.toLocaleString('en-IN')})`);
  });

} catch (error) {
  console.error('❌ Error seeding department budgets:', error);
} finally {
  console.log('\n🔌 Disconnecting from database...');
  await mongoose.disconnect();
}