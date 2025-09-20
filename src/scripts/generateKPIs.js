import mongoose from 'mongoose';
import dotenv from 'dotenv';
import KPICalculationService from '../services/kpiCalculationService.js';
import Hotel from '../models/Hotel.js';
import logger from '../utils/logger.js';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL || process.env.MONGO_URI);
    logger.info('Database connected for KPI generation');
  } catch (error) {
    logger.error('Database connection failed:', error);
    process.exit(1);
  }
};

const generateKPIs = async () => {
  try {
    // Get all hotels
    const hotels = await Hotel.find({ isActive: true });
    
    if (hotels.length === 0) {
      logger.info('No hotels found. Run the seed script first.');
      return;
    }

    logger.info(`Found ${hotels.length} hotel(s). Generating KPIs...`);

    const currentDate = new Date();
    const currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    
    for (const hotel of hotels) {
      logger.info(`Generating KPIs for hotel: ${hotel.name} (ID: ${hotel._id})`);
      
      try {
        // Calculate monthly KPI for current month
        const monthlyKPI = await KPICalculationService.calculateKPIs(
          hotel._id.toString(), 
          currentMonth, 
          'monthly'
        );
        
        logger.info(`Monthly KPI generated for ${hotel.name}:`);
        logger.info(`  - Total Revenue: ₹${monthlyKPI.revenue.totalRevenue}`);
        logger.info(`  - Room Revenue: ₹${monthlyKPI.revenue.roomRevenue}`);
        logger.info(`  - Room Nights Sold: ${monthlyKPI.occupancy.roomNightsSold}`);
        logger.info(`  - ADR: ₹${monthlyKPI.rates.adr}`);
        logger.info(`  - Occupancy: ${monthlyKPI.occupancy.occupancyRate}%`);
        logger.info(`  - Operating Expenses: ₹${monthlyKPI.profitability.operatingExpenses}`);
        logger.info(`  - GOP: ₹${monthlyKPI.profitability.gop}`);
        logger.info(`  - Guest Satisfaction: ${monthlyKPI.risk.guestSatisfaction.averageRating}/5`);
        
        // Debug: print the full KPI object
        console.log('\n=== FULL KPI OBJECT ===');
        console.log(JSON.stringify(monthlyKPI.toObject(), null, 2));
        
        // Also generate some daily KPIs for trend data (last 30 days)
        const dailyKPIs = [];
        for (let i = 29; i >= 0; i--) {
          const date = new Date(currentDate.getTime() - (i * 24 * 60 * 60 * 1000));
          try {
            const dailyKPI = await KPICalculationService.calculateKPIs(
              hotel._id.toString(),
              date,
              'daily'
            );
            dailyKPIs.push(dailyKPI);
          } catch (error) {
            logger.warn(`Failed to generate daily KPI for ${date.toDateString()}: ${error.message}`);
          }
        }
        
        logger.info(`Generated ${dailyKPIs.length} daily KPI records for trend data`);
        
      } catch (error) {
        logger.error(`Failed to generate KPIs for hotel ${hotel.name}:`, error);
      }
    }

    logger.info('✅ KPI generation completed!');
    
  } catch (error) {
    logger.error('KPI generation failed:', error);
    throw error;
  }
};

const main = async () => {
  await connectDB();
  await generateKPIs();
  await mongoose.connection.close();
  logger.info('Database connection closed');
  process.exit(0);
};

main().catch((error) => {
  logger.error('KPI generation process failed:', error);
  process.exit(1);
});