import mongoose from 'mongoose';
import 'dotenv/config';

// Import models to ensure indexes are created
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import TapeChart from '../models/TapeChart.js';
import {
  RatePlan,
  SeasonalRate,
  DynamicPricing,
  RateOverride,
  YieldManagement,
  Package
} from '../models/RateManagement.js';

async function optimizeIndexes() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Create indexes for Booking model (availability queries)
    console.log('Creating indexes for Booking collection...');
    await mongoose.connection.db.collection('bookings').createIndexes([
      // Availability check queries
      { 
        key: { 'rooms.roomId': 1, status: 1, checkIn: 1, checkOut: 1 }, 
        name: 'availability_lookup'
      },
      // Occupancy calculations
      { 
        key: { status: 1, checkIn: 1, checkOut: 1 }, 
        name: 'occupancy_calc'
      },
      // Room-specific bookings
      { 
        key: { 'rooms.roomId': 1, checkIn: -1 }, 
        name: 'room_bookings'
      },
      // Date range queries
      { 
        key: { checkIn: 1, checkOut: 1, status: 1 }, 
        name: 'date_range_queries'
      },
      // Guest booking history
      { 
        key: { userId: 1, createdAt: -1 }, 
        name: 'guest_history'
      }
    ]);

    // Create indexes for Room model
    console.log('Creating indexes for Room collection...');
    await mongoose.connection.db.collection('rooms').createIndexes([
      // Room search and filtering
      { 
        key: { type: 1, status: 1, isActive: 1, capacity: 1 }, 
        name: 'room_search'
      },
      // Hotel room lookup
      { 
        key: { hotelId: 1, type: 1, status: 1 }, 
        name: 'hotel_rooms'
      },
      // Floor-based searches
      { 
        key: { floor: 1, type: 1, status: 1 }, 
        name: 'floor_search'
      }
    ]);

    // Create indexes for TapeChart model (room blocks)
    console.log('Creating indexes for TapeChart collection...');
    await mongoose.connection.db.collection('tapecharts').createIndexes([
      // Room availability by date
      { 
        key: { roomId: 1, date: 1, status: 1 }, 
        name: 'room_date_status'
      },
      // Date range blocks
      { 
        key: { date: 1, status: 1 }, 
        name: 'date_blocks'
      },
      // Room blocks lookup
      { 
        key: { roomId: 1, date: -1 }, 
        name: 'room_blocks'
      }
    ]);

    // Create indexes for Rate Management collections
    console.log('Creating indexes for RatePlan collection...');
    await mongoose.connection.db.collection('rateplans').createIndexes([
      // Active rate plans by type
      { 
        key: { type: 1, isActive: 1, priority: -1 }, 
        name: 'active_plans'
      },
      // Rate plan lookup
      { 
        key: { planId: 1, isActive: 1 }, 
        name: 'plan_lookup'
      },
      // Validity period search
      { 
        key: { 'validity.startDate': 1, 'validity.endDate': 1, isActive: 1 }, 
        name: 'validity_search'
      },
      // Room type rates
      { 
        key: { 'baseRates.roomType': 1, isActive: 1 }, 
        name: 'room_type_rates'
      }
    ]);

    console.log('Creating indexes for SeasonalRate collection...');
    await mongoose.connection.db.collection('seasonalrates').createIndexes([
      // Seasonal adjustments by date
      { 
        key: { startDate: 1, endDate: 1, isActive: 1, priority: -1 }, 
        name: 'seasonal_lookup'
      },
      // Season ID lookup
      { 
        key: { seasonId: 1, isActive: 1 }, 
        name: 'season_id'
      }
    ]);

    console.log('Creating indexes for RateOverride collection...');
    await mongoose.connection.db.collection('rateoverrides').createIndexes([
      // Date and room type overrides
      { 
        key: { date: 1, roomType: 1, isActive: 1 }, 
        name: 'override_lookup'
      },
      // Rate plan overrides
      { 
        key: { ratePlanId: 1, date: 1, isActive: 1 }, 
        name: 'plan_overrides'
      },
      // Date range overrides
      { 
        key: { date: 1, isActive: 1 }, 
        name: 'date_overrides'
      }
    ]);

    console.log('Creating indexes for YieldManagement collection...');
    await mongoose.connection.db.collection('yieldmanagements').createIndexes([
      // Yield data by date and room type
      { 
        key: { date: 1, roomType: 1 }, 
        name: 'yield_lookup'
      },
      // Recent calculations
      { 
        key: { calculatedAt: -1, roomType: 1 }, 
        name: 'recent_calculations'
      },
      // Date range analytics
      { 
        key: { date: -1, roomType: 1 }, 
        name: 'date_analytics'
      }
    ]);

    console.log('Creating indexes for DynamicPricing collection...');
    await mongoose.connection.db.collection('dynamicpricings').createIndexes([
      // Active rules by priority
      { 
        key: { isActive: 1, priority: -1, type: 1 }, 
        name: 'active_rules'
      },
      // Rule type lookup
      { 
        key: { type: 1, isActive: 1 }, 
        name: 'rule_types'
      }
    ]);

    console.log('Creating indexes for Package collection...');
    await mongoose.connection.db.collection('packages').createIndexes([
      // Active packages by type
      { 
        key: { type: 1, isActive: 1 }, 
        name: 'package_types'
      },
      // Package validity
      { 
        key: { 'validity.startDate': 1, 'validity.endDate': 1, isActive: 1 }, 
        name: 'package_validity'
      },
      // Package ID lookup
      { 
        key: { packageId: 1, isActive: 1 }, 
        name: 'package_id'
      }
    ]);

    // Create compound indexes for complex queries
    console.log('Creating compound indexes for complex queries...');
    
    // Booking availability with room type and dates
    await mongoose.connection.db.collection('bookings').createIndex(
      { 
        'rooms.roomId': 1, 
        status: 1, 
        checkIn: 1, 
        checkOut: 1,
        'guestDetails.adults': 1
      },
      { 
        name: 'availability_complex',
        background: true
      }
    );

    // Rate calculation lookup
    await mongoose.connection.db.collection('rateplans').createIndex(
      { 
        'baseRates.roomType': 1,
        isActive: 1,
        'validity.startDate': 1,
        'validity.endDate': 1,
        priority: -1
      },
      { 
        name: 'rate_calculation',
        background: true
      }
    );

    // Occupancy and yield analysis
    await mongoose.connection.db.collection('bookings').createIndex(
      { 
        hotelId: 1,
        status: 1,
        checkIn: 1,
        checkOut: 1,
        'rooms.roomId': 1
      },
      { 
        name: 'occupancy_analysis',
        background: true
      }
    );

    // Text indexes for search functionality
    console.log('Creating text indexes for search...');
    
    // Rate plan search
    await mongoose.connection.db.collection('rateplans').createIndex(
      { 
        name: 'text', 
        description: 'text' 
      },
      { 
        name: 'rate_plan_search',
        background: true
      }
    );

    // Package search
    await mongoose.connection.db.collection('packages').createIndex(
      { 
        name: 'text', 
        description: 'text' 
      },
      { 
        name: 'package_search',
        background: true
      }
    );

    // Create partial indexes to save space
    console.log('Creating partial indexes...');
    
    // Only index active bookings
    await mongoose.connection.db.collection('bookings').createIndex(
      { 
        checkIn: 1, 
        checkOut: 1, 
        'rooms.roomId': 1 
      },
      { 
        name: 'active_bookings_only',
        partialFilterExpression: { 
          status: { $in: ['confirmed', 'checked_in'] } 
        },
        background: true
      }
    );

    // Only index future seasonal rates
    await mongoose.connection.db.collection('seasonalrates').createIndex(
      { 
        startDate: 1, 
        endDate: 1 
      },
      { 
        name: 'future_seasonal_only',
        partialFilterExpression: { 
          endDate: { $gte: new Date() },
          isActive: true
        },
        background: true
      }
    );

    // Create TTL indexes for cleanup
    console.log('Creating TTL indexes for data cleanup...');
    
    // Expire old yield management data (keep 2 years)
    await mongoose.connection.db.collection('yieldmanagements').createIndex(
      { calculatedAt: 1 },
      { 
        name: 'yield_cleanup',
        expireAfterSeconds: 365 * 24 * 60 * 60 * 2, // 2 years
        background: true
      }
    );

    // Expire old rate overrides (if they have expiration)
    await mongoose.connection.db.collection('rateoverrides').createIndex(
      { expiresAt: 1 },
      { 
        name: 'override_cleanup',
        expireAfterSeconds: 0, // Use document's expireAt field
        partialFilterExpression: { expiresAt: { $exists: true } },
        background: true
      }
    );

    console.log('✅ All indexes created successfully!');

    // Show index statistics
    console.log('\n📊 Index Statistics:');
    
    const collections = [
      'bookings', 'rooms', 'tapecharts', 'rateplans', 
      'seasonalrates', 'rateoverrides', 'yieldmanagements', 
      'dynamicpricings', 'packages'
    ];

    for (const collectionName of collections) {
      try {
        const indexes = await mongoose.connection.db.collection(collectionName).indexes();
        console.log(`${collectionName}: ${indexes.length} indexes`);
      } catch (error) {
        console.log(`${collectionName}: Collection not found or no indexes`);
      }
    }

  } catch (error) {
    console.error('❌ Error optimizing indexes:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Database connection closed');
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  optimizeIndexes()
    .then(() => {
      console.log('\n🎉 Index optimization completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Index optimization failed:', error);
      process.exit(1);
    });
}

export default optimizeIndexes;