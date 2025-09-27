import mongoose from 'mongoose';
import ExtraPersonCharge from '../models/ExtraPersonCharge.js';
import HotelSettings from '../models/HotelSettings.js';

const DEFAULT_EXTRA_PERSON_RULES = [
  {
    name: 'Standard Adult Extra Person',
    description: 'Standard charge for additional adults',
    chargeType: 'fixed',
    amount: 1500,
    currency: 'INR',
    guestType: 'adult',
    applicableRoomTypes: [], // Empty means applies to all room types
    maxExtraPersons: 3,
    priority: 1,
    seasonalRates: [
      {
        seasonName: 'Peak Season',
        startDate: new Date('2024-12-15'),
        endDate: new Date('2025-01-15'),
        multiplier: 1.3,
        isActive: true
      },
      {
        seasonName: 'Festival Season',
        startDate: new Date('2024-10-01'),
        endDate: new Date('2024-11-15'),
        multiplier: 1.2,
        isActive: true
      }
    ],
    dayOfWeekRates: {
      monday: 1,
      tuesday: 1,
      wednesday: 1,
      thursday: 1.1,
      friday: 1.3,
      saturday: 1.5,
      sunday: 1.2
    },
    pricingTiers: [
      {
        fromPersonCount: 1,
        toPersonCount: 1,
        amount: 1500,
        chargeType: 'fixed'
      },
      {
        fromPersonCount: 2,
        toPersonCount: 2,
        amount: 1400,
        chargeType: 'fixed'
      },
      {
        fromPersonCount: 3,
        toPersonCount: 10,
        amount: 1300,
        chargeType: 'fixed'
      }
    ],
    taxSettings: {
      isTaxable: true,
      taxRate: 18,
      taxType: 'exclusive'
    },
    sourceSpecificRates: [
      {
        source: 'direct',
        multiplier: 1,
        isActive: true
      },
      {
        source: 'booking_com',
        multiplier: 1.1,
        isActive: true
      },
      {
        source: 'corporate',
        multiplier: 0.9,
        isActive: true
      }
    ],
    isActive: true,
    effectiveFrom: new Date(),
    effectiveTo: new Date('2025-12-31')
  },
  {
    name: 'Child Extra Person (0-5 years)',
    description: 'Complimentary charge for children aged 0-5 years',
    chargeType: 'fixed',
    amount: 0,
    currency: 'INR',
    guestType: 'child',
    ageRange: {
      min: 0,
      max: 5
    },
    applicableRoomTypes: [],
    maxExtraPersons: 2,
    priority: 3,
    taxSettings: {
      isTaxable: false,
      taxRate: 0,
      taxType: 'exclusive'
    },
    isActive: true,
    effectiveFrom: new Date()
  },
  {
    name: 'Child Extra Person (6-12 years)',
    description: '50% charge for children aged 6-12 years',
    chargeType: 'percentage_of_room_rate',
    amount: 25, // 25% of adult rate
    currency: 'INR',
    guestType: 'child',
    ageRange: {
      min: 6,
      max: 12
    },
    applicableRoomTypes: [],
    maxExtraPersons: 2,
    priority: 2,
    dayOfWeekRates: {
      monday: 1,
      tuesday: 1,
      wednesday: 1,
      thursday: 1,
      friday: 1.2,
      saturday: 1.3,
      sunday: 1.1
    },
    taxSettings: {
      isTaxable: true,
      taxRate: 18,
      taxType: 'exclusive'
    },
    isActive: true,
    effectiveFrom: new Date()
  },
  {
    name: 'Premium Suite Adult Extra Person',
    description: 'Premium charge for additional adults in suite rooms',
    chargeType: 'fixed',
    amount: 2500,
    currency: 'INR',
    guestType: 'adult',
    applicableRoomTypes: ['suite', 'deluxe'],
    maxExtraPersons: 2,
    priority: 5,
    seasonalRates: [
      {
        seasonName: 'Peak Season',
        startDate: new Date('2024-12-15'),
        endDate: new Date('2025-01-15'),
        multiplier: 1.4,
        isActive: true
      }
    ],
    dayOfWeekRates: {
      monday: 1,
      tuesday: 1,
      wednesday: 1,
      thursday: 1.1,
      friday: 1.4,
      saturday: 1.6,
      sunday: 1.3
    },
    taxSettings: {
      isTaxable: true,
      taxRate: 18,
      taxType: 'exclusive'
    },
    isActive: true,
    effectiveFrom: new Date()
  },
  {
    name: 'Economy Room Adult Extra Person',
    description: 'Budget-friendly charge for additional adults in single/double rooms',
    chargeType: 'fixed',
    amount: 1200,
    currency: 'INR',
    guestType: 'adult',
    applicableRoomTypes: ['single', 'double'],
    maxExtraPersons: 2,
    priority: 1,
    dayOfWeekRates: {
      monday: 1,
      tuesday: 1,
      wednesday: 1,
      thursday: 1,
      friday: 1.2,
      saturday: 1.3,
      sunday: 1.1
    },
    pricingTiers: [
      {
        fromPersonCount: 1,
        toPersonCount: 1,
        amount: 1200,
        chargeType: 'fixed'
      },
      {
        fromPersonCount: 2,
        toPersonCount: 5,
        amount: 1100,
        chargeType: 'fixed'
      }
    ],
    taxSettings: {
      isTaxable: true,
      taxRate: 18,
      taxType: 'exclusive'
    },
    sourceSpecificRates: [
      {
        source: 'direct',
        multiplier: 0.95, // 5% discount for direct bookings
        isActive: true
      }
    ],
    isActive: true,
    effectiveFrom: new Date()
  }
];

export async function seedExtraPersonChargeRules() {
  console.log('🌱 Seeding extra person charge rules...');

  try {
    // Get all hotels to create rules for each
    const hotelSettings = await HotelSettings.find({}).select('hotelId');

    if (hotelSettings.length === 0) {
      console.log('⚠️ No hotels found. Creating default rules for testing...');

      // Create rules for a default hotel ID (this should match your test hotel)
      const defaultHotelId = new mongoose.Types.ObjectId('68cd01414419c17b5f6b4c12'); // Your test hotel ID

      for (const ruleData of DEFAULT_EXTRA_PERSON_RULES) {
        const rule = {
          ...ruleData,
          hotelId: defaultHotelId
        };

        // Check if rule already exists
        const existingRule = await ExtraPersonCharge.findOne({
          hotelId: defaultHotelId,
          name: ruleData.name,
          guestType: ruleData.guestType
        });

        if (!existingRule) {
          const newRule = new ExtraPersonCharge(rule);
          await newRule.save();
          console.log(`✅ Created rule: ${ruleData.name} for default hotel`);
        } else {
          console.log(`⏭️ Rule already exists: ${ruleData.name} for default hotel`);
        }
      }
    } else {
      // Create rules for each hotel
      for (const hotel of hotelSettings) {
        console.log(`\n📍 Creating rules for hotel: ${hotel.hotelId}`);

        for (const ruleData of DEFAULT_EXTRA_PERSON_RULES) {
          const rule = {
            ...ruleData,
            hotelId: hotel.hotelId
          };

          // Check if rule already exists
          const existingRule = await ExtraPersonCharge.findOne({
            hotelId: hotel.hotelId,
            name: ruleData.name,
            guestType: ruleData.guestType
          });

          if (!existingRule) {
            const newRule = new ExtraPersonCharge(rule);
            await newRule.save();
            console.log(`✅ Created rule: ${ruleData.name}`);
          } else {
            console.log(`⏭️ Rule already exists: ${ruleData.name}`);
          }
        }
      }
    }

    // Verify rules were created
    const totalRules = await ExtraPersonCharge.countDocuments({});
    console.log(`\n🎉 Total extra person charge rules in database: ${totalRules}`);

    // Test dynamic pricing calculation
    console.log('\n🧪 Testing dynamic pricing calculation...');

    const testBookingData = {
      roomType: 'double',
      baseRoomRate: 5000,
      extraPersons: [
        { id: 'test1', name: 'John Doe', type: 'adult' },
        { id: 'test2', name: 'Jane Doe', type: 'child', age: 8 }
      ],
      checkIn: '2024-08-15',
      checkOut: '2024-08-18',
      nights: 3,
      bookingSource: 'direct',
      guestDetails: { adults: 2, children: 0 }
    };

    const testHotelId = hotelSettings.length > 0 ?
      hotelSettings[0].hotelId :
      new mongoose.Types.ObjectId('68cd01414419c17b5f6b4c12');

    try {
      const pricingResult = await ExtraPersonCharge.calculateExtraPersonCharge(testHotelId, testBookingData);
      console.log('✅ Dynamic pricing test successful!');
      console.log(`   Total extra charge: ₹${pricingResult.totalExtraCharge}`);
      console.log(`   Breakdown: ${pricingResult.chargeBreakdown.length} charges calculated`);
    } catch (error) {
      console.error('❌ Dynamic pricing test failed:', error.message);
    }

    return {
      success: true,
      message: 'Extra person charge rules seeded successfully',
      totalRules
    };

  } catch (error) {
    console.error('❌ Failed to seed extra person charge rules:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Connect to database
  const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management';

  mongoose.connect(MONGO_URI)
    .then(async () => {
      console.log('🔗 Connected to MongoDB');
      const result = await seedExtraPersonChargeRules();
      console.log('\n📋 SEEDING COMPLETE');
      console.log(result.success ? '🎉 SUCCESS' : '❌ FAILED');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Database connection failed:', error);
      process.exit(1);
    });
}

export default seedExtraPersonChargeRules;