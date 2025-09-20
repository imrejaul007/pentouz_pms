/**
 * ETL Service for Data Warehouse Operations
 * Handles Extract, Transform, Load operations for analytics
 */

import cron from 'node-cron';
import { FactBookings, FactRevenue, DimDate, DimGuest, MonthlyRevenueAggregate, DataWarehouseHelpers } from '../../models/analytics/DataWarehouse.js';
import Booking from '../../models/Booking.js';
import User from '../../models/User.js';
import Room from '../../models/Room.js';
import Hotel from '../../models/Hotel.js';
import logger from '../../utils/logger.js';

class ETLService {
  constructor() {
    this.logger = logger;
    this.isRunning = false;
    this.lastRunTime = null;
    
    // Schedule ETL jobs
    this.scheduleETLJobs();
  }
  
  /**
   * Schedule automated ETL jobs
   */
  scheduleETLJobs() {
    // Full ETL runs daily at 2 AM
    cron.schedule('0 2 * * *', async () => {
      await this.executeFullETL();
    });
    
    // Incremental updates every hour
    cron.schedule('0 * * * *', async () => {
      await this.executeIncrementalETL();
    });
    
    // Monthly aggregation on the 1st of each month
    cron.schedule('0 3 1 * *', async () => {
      await this.executeMonthlyAggregation();
    });
    
    this.logger.info('ETL jobs scheduled successfully');
  }
  
  /**
   * Execute full ETL process
   */
  async executeFullETL() {
    if (this.isRunning) {
      this.logger.warn('ETL process already running, skipping');
      return;
    }
    
    this.isRunning = true;
    const startTime = new Date();
    
    try {
      this.logger.info('Starting full ETL process');
      
      // Step 1: Extract data from operational systems
      const extractedData = await this.extractOperationalData();
      
      // Step 2: Transform and validate data
      const transformedData = await this.transformData(extractedData);
      
      // Step 3: Load into data warehouse
      await this.loadToDataWarehouse(transformedData);
      
      // Step 4: Update aggregates
      await this.updateAggregates();
      
      // Step 5: Data quality checks
      await this.performDataQualityChecks();
      
      this.lastRunTime = new Date();
      const duration = (this.lastRunTime - startTime) / 1000;
      
      this.logger.info(`Full ETL process completed in ${duration} seconds`);
      
      return {
        success: true,
        duration: duration,
        recordsProcessed: transformedData.bookings.length,
        timestamp: this.lastRunTime
      };
      
    } catch (error) {
      this.logger.error('ETL process failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }
  
  /**
   * Execute incremental ETL for recent changes
   */
  async executeIncrementalETL() {
    try {
      const lastRun = this.lastRunTime || new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
      
      // Extract only changed/new records
      const incrementalData = await this.extractIncrementalData(lastRun);
      
      if (incrementalData.bookings.length === 0) {
        this.logger.info('No new data for incremental ETL');
        return;
      }
      
      const transformedData = await this.transformData(incrementalData);
      await this.loadToDataWarehouse(transformedData, true); // incremental load
      
      this.logger.info(`Incremental ETL completed: ${incrementalData.bookings.length} records processed`);
      
    } catch (error) {
      this.logger.error('Incremental ETL failed:', error);
    }
  }
  
  /**
   * Extract data from operational database
   */
  async extractOperationalData() {
    this.logger.info('Extracting operational data');
    
    // Extract bookings with related data
    const bookings = await Booking.aggregate([
      {
        $match: {
          status: { $in: ['confirmed', 'checked_in', 'checked_out'] },
          createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } // Last year
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'guestId',
          foreignField: '_id',
          as: 'guest'
        }
      },
      {
        $lookup: {
          from: 'rooms',
          localField: 'roomId',
          foreignField: '_id',
          as: 'room'
        }
      },
      {
        $lookup: {
          from: 'hotels',
          localField: 'hotelId',
          foreignField: '_id',
          as: 'hotel'
        }
      },
      {
        $unwind: '$guest'
      },
      {
        $unwind: '$room'
      },
      {
        $unwind: '$hotel'
      }
    ]);
    
    // Extract guest profiles for dimension table
    const guests = await User.find({
      role: 'guest',
      updatedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
    }).lean();
    
    this.logger.info(`Extracted ${bookings.length} bookings and ${guests.length} guests`);
    
    return {
      bookings,
      guests
    };
  }
  
  /**
   * Extract incremental data since last run
   */
  async extractIncrementalData(lastRunTime) {
    const bookings = await Booking.aggregate([
      {
        $match: {
          updatedAt: { $gte: lastRunTime },
          status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'guestId',
          foreignField: '_id',
          as: 'guest'
        }
      },
      {
        $lookup: {
          from: 'rooms',
          localField: 'roomId',
          foreignField: '_id',
          as: 'room'
        }
      },
      {
        $lookup: {
          from: 'hotels',
          localField: 'hotelId',
          foreignField: '_id',
          as: 'hotel'
        }
      },
      {
        $unwind: '$guest'
      },
      {
        $unwind: '$room'
      },
      {
        $unwind: '$hotel'
      }
    ]);
    
    const guests = await User.find({
      role: 'guest',
      updatedAt: { $gte: lastRunTime }
    }).lean();
    
    return { bookings, guests };
  }
  
  /**
   * Transform extracted data for data warehouse
   */
  async transformData(extractedData) {
    this.logger.info('Transforming data for data warehouse');
    
    const transformedBookings = [];
    const transformedGuests = [];
    const transformedRevenue = [];
    
    // Transform bookings to fact table format
    for (const booking of extractedData.bookings) {
      try {
        const checkInDate = new Date(booking.checkInDate);
        const checkOutDate = new Date(booking.checkOutDate);
        const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
        
        // Calculate KPIs
        const adr = booking.totalAmount / nights; // Average Daily Rate
        const revpar = adr * (booking.room.isOccupied ? 1 : 0); // Revenue per available room
        
        // Determine guest characteristics
        const guestSegment = DataWarehouseHelpers.determineGuestSegment({
          purpose: booking.purpose || 'leisure',
          advance_days: Math.floor((checkInDate - new Date(booking.createdAt)) / (1000 * 60 * 60 * 24)),
          room_rate: adr,
          amenities: booking.room.amenities || []
        });
        
        const transformedBooking = {
          booking_key: booking._id,
          date_key: DataWarehouseHelpers.generateDateKey(checkInDate),
          guest_key: booking.guest._id,
          room_key: booking.room._id,
          hotel_key: booking.hotel._id,
          
          revenue_amount: booking.totalAmount,
          nights_stayed: nights,
          advance_payment: booking.advancePayment || 0,
          total_guests: booking.numberOfGuests || 1,
          
          adr: adr,
          revpar: revpar,
          
          booking_channel: this.determineBookingChannel(booking),
          booking_lead_days: Math.floor((checkInDate - new Date(booking.createdAt)) / (1000 * 60 * 60 * 24)),
          booking_status: booking.status,
          
          guest_type: this.determineGuestType(booking.guest),
          guest_segment: guestSegment,
          
          check_in_date: checkInDate,
          check_out_date: checkOutDate,
          is_weekend: this.isWeekend(checkInDate),
          is_holiday: await this.isHoliday(checkInDate),
          season: DataWarehouseHelpers.calculateSeason(checkInDate)
        };
        
        transformedBookings.push(transformedBooking);
        
        // Create daily revenue records for each night
        for (let i = 0; i < nights; i++) {
          const currentDate = new Date(checkInDate);
          currentDate.setDate(currentDate.getDate() + i);
          
          const dailyRevenue = {
            date_key: DataWarehouseHelpers.generateDateKey(currentDate),
            hotel_key: booking.hotel._id,
            room_type_key: booking.room.roomType,
            
            gross_revenue: booking.totalAmount / nights,
            net_revenue: (booking.totalAmount - (booking.totalAmount * 0.1)) / nights, // Assuming 10% commission
            tax_amount: booking.gstDetails?.gstAmount || 0,
            discount_amount: booking.discountAmount || 0,
            ancillary_revenue: booking.ancillaryCharges || 0,
            
            rooms_sold: 1,
            rooms_available: booking.hotel.totalRooms, // This should be room type specific
            occupancy_rate: (1 / booking.hotel.totalRooms) * 100,
            
            adr: adr,
            revpar: revpar,
            profit_margin: ((booking.totalAmount / nights) - 100) / (booking.totalAmount / nights) * 100 // Simplified calculation
          };
          
          transformedRevenue.push(dailyRevenue);
        }
        
      } catch (error) {
        this.logger.error(`Error transforming booking ${booking._id}:`, error);
      }
    }
    
    // Transform guests for dimension table
    for (const guest of extractedData.guests) {
      try {
        const guestBookings = await Booking.find({ guestId: guest._id }).lean();
        const avgBookingValue = guestBookings.reduce((sum, b) => sum + b.totalAmount, 0) / guestBookings.length;
        
        const transformedGuest = {
          guest_key: guest._id,
          guest_id: guest._id,
          
          guest_type: guest.corporateCompanyId ? 'corporate' : 'individual',
          guest_segment: this.determineGuestSegmentFromProfile(guest, guestBookings),
          loyalty_tier: guest.loyaltyProgram?.currentTier || 'none',
          
          age_group: this.calculateAgeGroup(guest.dateOfBirth),
          country: guest.address?.country || 'Unknown',
          city: guest.address?.city || 'Unknown',
          
          booking_frequency: DataWarehouseHelpers.calculateBookingFrequency(guestBookings),
          avg_booking_value: avgBookingValue,
          preferred_room_type: this.calculatePreferredRoomType(guestBookings),
          preferred_amenities: this.calculatePreferredAmenities(guestBookings),
          
          effective_date: guest.updatedAt,
          is_current: true
        };
        
        transformedGuests.push(transformedGuest);
      } catch (error) {
        this.logger.error(`Error transforming guest ${guest._id}:`, error);
      }
    }
    
    this.logger.info(`Transformed ${transformedBookings.length} bookings, ${transformedGuests.length} guests, ${transformedRevenue.length} revenue records`);
    
    return {
      bookings: transformedBookings,
      guests: transformedGuests,
      revenue: transformedRevenue
    };
  }
  
  /**
   * Load transformed data into data warehouse
   */
  async loadToDataWarehouse(transformedData, isIncremental = false) {
    this.logger.info(`Loading data to warehouse (incremental: ${isIncremental})`);
    
    try {
      // Load bookings fact table
      if (transformedData.bookings.length > 0) {
        if (isIncremental) {
          // Update existing records or insert new ones
          for (const booking of transformedData.bookings) {
            await FactBookings.findOneAndUpdate(
              { booking_key: booking.booking_key },
              booking,
              { upsert: true, new: true }
            );
          }
        } else {
          // Bulk insert for full load
          await FactBookings.insertMany(transformedData.bookings, { ordered: false });
        }
      }
      
      // Load revenue fact table
      if (transformedData.revenue.length > 0) {
        if (isIncremental) {
          for (const revenue of transformedData.revenue) {
            await FactRevenue.findOneAndUpdate(
              { 
                date_key: revenue.date_key, 
                hotel_key: revenue.hotel_key, 
                room_type_key: revenue.room_type_key 
              },
              revenue,
              { upsert: true, new: true }
            );
          }
        } else {
          await FactRevenue.insertMany(transformedData.revenue, { ordered: false });
        }
      }
      
      // Load guest dimension (SCD Type 2)
      for (const guest of transformedData.guests) {
        await this.loadGuestDimension(guest);
      }
      
      this.logger.info('Data warehouse loading completed');
      
    } catch (error) {
      this.logger.error('Error loading data to warehouse:', error);
      throw error;
    }
  }
  
  /**
   * Load guest dimension with SCD Type 2 logic
   */
  async loadGuestDimension(guestData) {
    // Check for existing current record
    const existingGuest = await DimGuest.findOne({
      guest_id: guestData.guest_id,
      is_current: true
    });
    
    if (existingGuest) {
      // Check if attributes have changed
      const hasChanged = this.checkGuestAttributesChanged(existingGuest, guestData);
      
      if (hasChanged) {
        // Expire old record
        existingGuest.expiry_date = new Date();
        existingGuest.is_current = false;
        await existingGuest.save();
        
        // Insert new record
        await DimGuest.create(guestData);
      }
    } else {
      // Insert new record
      await DimGuest.create(guestData);
    }
  }
  
  /**
   * Update monthly aggregation tables
   */
  async updateAggregates() {
    this.logger.info('Updating aggregate tables');
    
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    
    // Get all hotels
    const hotels = await Hotel.find({}).select('_id').lean();
    
    for (const hotel of hotels) {
      await this.updateMonthlyRevenueAggregate(hotel._id, year, month);
    }
    
    this.logger.info('Aggregate tables updated');
  }
  
  /**
   * Update monthly revenue aggregate for a specific hotel
   */
  async updateMonthlyRevenueAggregate(hotelId, year, month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const startDateKey = DataWarehouseHelpers.generateDateKey(startDate);
    const endDateKey = DataWarehouseHelpers.generateDateKey(endDate);
    
    // Aggregate data from fact tables
    const revenueData = await FactRevenue.aggregate([
      {
        $match: {
          hotel_key: hotelId,
          date_key: { $gte: startDateKey, $lte: endDateKey }
        }
      },
      {
        $group: {
          _id: null,
          total_revenue: { $sum: '$gross_revenue' },
          rooms_revenue: { $sum: '$gross_revenue' },
          ancillary_revenue: { $sum: '$ancillary_revenue' },
          avg_adr: { $avg: '$adr' },
          avg_revpar: { $avg: '$revpar' },
          avg_occupancy: { $avg: '$occupancy_rate' }
        }
      }
    ]);
    
    const bookingData = await FactBookings.aggregate([
      {
        $match: {
          hotel_key: hotelId,
          date_key: { $gte: startDateKey, $lte: endDateKey }
        }
      },
      {
        $group: {
          _id: null,
          total_bookings: { $sum: 1 },
          total_nights: { $sum: '$nights_stayed' },
          unique_guests: { $addToSet: '$guest_key' },
          avg_los: { $avg: '$nights_stayed' },
          
          // Segment breakdown
          leisure_revenue: {
            $sum: {
              $cond: [{ $eq: ['$guest_segment', 'leisure'] }, '$revenue_amount', 0]
            }
          },
          business_revenue: {
            $sum: {
              $cond: [{ $eq: ['$guest_segment', 'business'] }, '$revenue_amount', 0]
            }
          },
          corporate_revenue: {
            $sum: {
              $cond: [{ $eq: ['$guest_segment', 'corporate'] }, '$revenue_amount', 0]
            }
          },
          
          // Channel breakdown
          direct_bookings: {
            $sum: {
              $cond: [{ $eq: ['$booking_channel', 'direct'] }, 1, 0]
            }
          },
          ota_bookings: {
            $sum: {
              $cond: [{ $eq: ['$booking_channel', 'ota'] }, 1, 0]
            }
          },
          corporate_bookings: {
            $sum: {
              $cond: [{ $eq: ['$booking_channel', 'corporate'] }, 1, 0]
            }
          }
        }
      }
    ]);
    
    if (revenueData.length > 0 && bookingData.length > 0) {
      const aggregateData = {
        hotel_id: hotelId,
        year,
        month,
        
        ...revenueData[0],
        ...bookingData[0],
        unique_guests: bookingData[0].unique_guests.length,
        
        updated_at: new Date()
      };
      
      // Upsert monthly aggregate
      await MonthlyRevenueAggregate.findOneAndUpdate(
        { hotel_id: hotelId, year, month },
        aggregateData,
        { upsert: true, new: true }
      );
    }
  }
  
  /**
   * Perform data quality checks
   */
  async performDataQualityChecks() {
    this.logger.info('Performing data quality checks');
    
    const checks = [
      // Check for null revenue amounts
      {
        name: 'Null Revenue Check',
        query: async () => await FactBookings.countDocuments({ revenue_amount: { $lte: 0 } }),
        threshold: 0
      },
      
      // Check for future dates
      {
        name: 'Future Dates Check',
        query: async () => await FactBookings.countDocuments({ 
          check_in_date: { $gt: new Date() } 
        }),
        threshold: 100 // Allow some future bookings
      },
      
      // Check for duplicate bookings
      {
        name: 'Duplicate Bookings Check',
        query: async () => {
          const duplicates = await FactBookings.aggregate([
            { $group: { _id: '$booking_key', count: { $sum: 1 } } },
            { $match: { count: { $gt: 1 } } }
          ]);
          return duplicates.length;
        },
        threshold: 0
      }
    ];
    
    for (const check of checks) {
      try {
        const result = await check.query();
        if (result > check.threshold) {
          this.logger.warn(`Data quality issue: ${check.name} found ${result} problems`);
        } else {
          this.logger.info(`Data quality check passed: ${check.name}`);
        }
      } catch (error) {
        this.logger.error(`Data quality check failed: ${check.name}`, error);
      }
    }
  }
  
  /**
   * Populate date dimension for the current year
   */
  async populateDateDimension(year = new Date().getFullYear()) {
    this.logger.info(`Populating date dimension for year ${year}`);
    
    const dates = [];
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dateKey = DataWarehouseHelpers.generateDateKey(date);
      
      // Check if date already exists
      const existingDate = await DimDate.findOne({ date_key: dateKey });
      if (existingDate) continue;
      
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isBusinessDay = !isWeekend && !await this.isHoliday(date);
      
      const dateRecord = {
        date_key: dateKey,
        full_date: new Date(date),
        year: date.getFullYear(),
        quarter: Math.floor((date.getMonth() + 3) / 3),
        month: date.getMonth() + 1,
        week: this.getWeekOfYear(date),
        day_of_year: this.getDayOfYear(date),
        day_of_month: date.getDate(),
        day_of_week: dayOfWeek,
        
        month_name: date.toLocaleString('default', { month: 'long' }),
        day_name: date.toLocaleString('default', { weekday: 'long' }),
        quarter_name: `Q${Math.floor((date.getMonth() + 3) / 3)}`,
        
        is_weekend: isWeekend,
        is_holiday: await this.isHoliday(date),
        is_business_day: isBusinessDay,
        
        season: DataWarehouseHelpers.calculateSeason(date),
        booking_period: this.determineBookingPeriod(date)
      };
      
      dates.push(dateRecord);
    }
    
    if (dates.length > 0) {
      await DimDate.insertMany(dates, { ordered: false });
      this.logger.info(`Inserted ${dates.length} date records`);
    }
  }
  
  // Helper methods
  determineBookingChannel(booking) {
    if (booking.source === 'corporate') return 'corporate';
    if (booking.source === 'phone') return 'phone';
    if (booking.source === 'ota') return 'ota';
    return 'direct';
  }
  
  determineGuestType(guest) {
    if (guest.corporateCompanyId) return 'corporate';
    if (guest.loyaltyProgram?.currentTier !== 'none') return 'loyalty_member';
    // Check if returning guest
    return 'new'; // This would need more logic
  }
  
  determineGuestSegmentFromProfile(guest, bookings) {
    if (guest.corporateCompanyId) return 'corporate';
    
    const businessBookings = bookings.filter(b => b.purpose === 'business').length;
    const leisureBookings = bookings.filter(b => b.purpose !== 'business').length;
    
    return businessBookings > leisureBookings ? 'business' : 'leisure';
  }
  
  calculateAgeGroup(dateOfBirth) {
    if (!dateOfBirth) return null;
    
    const age = Math.floor((Date.now() - new Date(dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000));
    
    if (age < 26) return '18-25';
    if (age < 36) return '26-35';
    if (age < 46) return '36-45';
    if (age < 56) return '46-55';
    if (age < 66) return '56-65';
    return '65+';
  }
  
  calculatePreferredRoomType(bookings) {
    const roomTypeCounts = {};
    bookings.forEach(booking => {
      const roomType = booking.room?.type || 'unknown';
      roomTypeCounts[roomType] = (roomTypeCounts[roomType] || 0) + 1;
    });
    
    return Object.keys(roomTypeCounts).reduce((a, b) => 
      roomTypeCounts[a] > roomTypeCounts[b] ? a : b
    ) || null;
  }
  
  calculatePreferredAmenities(bookings) {
    const amenityCounts = {};
    bookings.forEach(booking => {
      (booking.room?.amenities || []).forEach(amenity => {
        amenityCounts[amenity] = (amenityCounts[amenity] || 0) + 1;
      });
    });
    
    return Object.entries(amenityCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([amenity]) => amenity);
  }
  
  isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6;
  }
  
  async isHoliday(date) {
    // This would integrate with a holiday API or database
    // For now, return false
    return false;
  }
  
  checkGuestAttributesChanged(existing, newData) {
    const fieldsToCheck = ['guest_segment', 'loyalty_tier', 'booking_frequency'];
    return fieldsToCheck.some(field => existing[field] !== newData[field]);
  }
  
  getWeekOfYear(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }
  
  getDayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }
  
  determineBookingPeriod(date) {
    const today = new Date();
    const daysDiff = Math.floor((date - today) / (1000 * 60 * 60 * 24));
    
    if (daysDiff < 0) return 'past';
    if (daysDiff <= 7) return 'last_minute';
    if (daysDiff <= 30) return 'normal';
    return 'advance';
  }
  
  /**
   * Manual ETL trigger for testing/maintenance
   */
  async triggerManualETL(options = {}) {
    const { fullLoad = false, dateRange = null } = options;
    
    if (fullLoad) {
      return await this.executeFullETL();
    } else {
      return await this.executeIncrementalETL();
    }
  }
  
  /**
   * Get ETL status and metrics
   */
  getETLStatus() {
    return {
      isRunning: this.isRunning,
      lastRunTime: this.lastRunTime,
      scheduledJobs: [
        'Daily full ETL at 2 AM',
        'Hourly incremental updates',
        'Monthly aggregation on 1st'
      ]
    };
  }
}

export default ETLService;