import AdvancedReportingService from '../services/analytics/AdvancedReportingService.js';
import ETLService from '../services/analytics/ETLService.js';
import PredictiveAnalyticsEngine from '../services/analytics/PredictiveAnalyticsEngine.js';
import GuestSegmentationService from '../services/analytics/GuestSegmentationService.js';
import staffProductivityService from '../services/staffProductivityService.js';
import corporateAnalyticsService from '../services/corporateAnalyticsService.js';
import bookingChannelService from '../services/bookingChannelService.js';
import { 
  FactBookings, 
  FactRevenue, 
  MonthlyRevenueAggregate,
  DataWarehouseHelpers 
} from '../models/analytics/DataWarehouse.js';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import RoomType from '../models/RoomType.js';
import Hotel from '../models/Hotel.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';
import mongoose from 'mongoose';

const reportingService = new AdvancedReportingService();

// Simple in-memory cache for dashboard metrics
const dashboardCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL
const etlService = new ETLService();
const predictiveEngine = new PredictiveAnalyticsEngine();
const guestSegmentationService = new GuestSegmentationService();

// Initialize services
let servicesInitialized = false;
const initializeServices = async () => {
  if (!servicesInitialized) {
    try {
      await reportingService.initialize();
      await predictiveEngine.initialize();
      await guestSegmentationService.initialize();
      servicesInitialized = true;
    } catch (error) {
      logger.warn('Some analytics services failed to initialize:', error.message);
    }
  }
};

export const generateReport = async (req, res) => {
  try {
    await initializeServices();
    
    const { reportType: bodyReportType, parameters = {}, options = {} } = req.body;
    const reportType = req.reportType || bodyReportType;
    
    if (!reportType) {
      return res.status(400).json({
        success: false,
        message: 'Report type is required'
      });
    }

    // Set default date range if not provided
    if (!parameters.start_date) {
      parameters.start_date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    }
    if (!parameters.end_date) {
      parameters.end_date = new Date();
    }

    const report = await reportingService.generateReport(reportType, parameters, options);

    res.json({
      success: true,
      data: report,
      metadata: {
        reportType,
        parameters,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Report generation failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error.message
    });
  }
};

export const getReportStatus = async (req, res) => {
  try {
    const { reportId } = req.params;
    const status = await reportingService.getReportStatus(reportId);

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    logger.error('Failed to get report status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get report status',
      error: error.message
    });
  }
};

export const getCachedReport = async (req, res) => {
  try {
    const { cacheKey } = req.params;
    const report = await reportingService.getCachedReport(cacheKey);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found in cache'
      });
    }

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    logger.error('Failed to get cached report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get cached report',
      error: error.message
    });
  }
};

export const clearReportCache = async (req, res) => {
  try {
    const { reportType } = req.params;
    await reportingService.clearCache(reportType);

    res.json({
      success: true,
      message: `Cache cleared for ${reportType || 'all reports'}`
    });

  } catch (error) {
    logger.error('Failed to clear report cache:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear report cache',
      error: error.message
    });
  }
};

// Clear dashboard cache
export const clearDashboardCache = async (req, res) => {
  try {
    const { cacheKey } = req.params;
    
    if (cacheKey) {
      dashboardCache.delete(cacheKey);
      logger.info(`Dashboard cache cleared for key: ${cacheKey}`);
    } else {
      dashboardCache.clear();
      logger.info('All dashboard cache cleared');
    }

    res.json({
      success: true,
      message: cacheKey ? `Dashboard cache cleared for ${cacheKey}` : 'All dashboard cache cleared',
      cacheSize: dashboardCache.size
    });

  } catch (error) {
    logger.error('Failed to clear dashboard cache:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear dashboard cache',
      error: error.message
    });
  }
};

export const getReportTemplates = async (req, res) => {
  try {
    const templates = await reportingService.getReportTemplates();

    res.json({
      success: true,
      data: templates
    });

  } catch (error) {
    logger.error('Failed to get report templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get report templates',
      error: error.message
    });
  }
};

export const scheduleReport = async (req, res) => {
  try {
    const { reportType, schedule, parameters = {} } = req.body;
    
    if (!reportType || !schedule) {
      return res.status(400).json({
        success: false,
        message: 'Report type and schedule are required'
      });
    }

    const jobId = await reportingService.scheduleReport(reportType, schedule, parameters);

    res.json({
      success: true,
      data: { jobId },
      message: 'Report scheduled successfully'
    });

  } catch (error) {
    logger.error('Failed to schedule report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to schedule report',
      error: error.message
    });
  }
};

export const exportReport = async (req, res) => {
  try {
    const { reportId, format } = req.params;
    const report = await reportingService.exportReport(reportId, format);

    res.setHeader('Content-Type', format === 'pdf' ? 'application/pdf' : 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="report-${reportId}.${format}"`);
    
    res.send(report);

  } catch (error) {
    logger.error('Failed to export report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export report',
      error: error.message
    });
  }
};

export const getDashboardMetrics = async (req, res) => {
  try {
    const { period = '30d', hotel_id } = req.query;
    const userRole = req.user?.role || 'staff';
    
    // Create cache key
    const cacheKey = `dashboard_${period}_${hotel_id || 'all'}`;
    
    // Check cache first
    const cachedData = dashboardCache.get(cacheKey);
    if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_TTL) {
      logger.info(`Dashboard metrics served from cache for key: ${cacheKey}`);
      return res.json({
        success: true,
        data: cachedData.data,
        metadata: {
          period,
          cached: true,
          cacheAge: Date.now() - cachedData.timestamp,
          generatedAt: new Date(cachedData.timestamp).toISOString()
        }
      });
    }
    
    // Calculate date range based on period
    let startDate, endDate = new Date();
    switch (period) {
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get real data from database with role-based filtering
    const dashboardData = await getRealDashboardData(startDate, endDate, hotel_id, userRole);
    
    // Cache the result
    dashboardCache.set(cacheKey, {
      data: dashboardData,
      timestamp: Date.now()
    });
    
    // Clean up old cache entries (simple cleanup)
    if (dashboardCache.size > 100) {
      const now = Date.now();
      for (const [key, value] of dashboardCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          dashboardCache.delete(key);
        }
      }
    }

    res.json({
      success: true,
      data: dashboardData,
      metadata: {
        period,
        dateRange: { startDate, endDate },
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error in getDashboardMetrics:', error);
    
    // Return a fallback response instead of throwing
    res.json({
      success: true,
      data: {
        kpis: {
          revenue: { label: 'Total Revenue', value: 0, change: 0, changeType: 'neutral', format: 'currency' },
          occupancy: { label: 'Occupancy Rate', value: 0, change: 0, changeType: 'neutral', format: 'percentage' },
          adr: { label: 'Average Daily Rate', value: 0, change: 0, changeType: 'neutral', format: 'currency' },
          revpar: { label: 'RevPAR', value: 0, change: 0, changeType: 'neutral', format: 'currency' },
          bookings: { label: 'Total Bookings', value: 0, change: 0, changeType: 'neutral', format: 'number' },
          cancellations: { label: 'Cancellations', value: 0, change: 0, changeType: 'neutral', format: 'number' }
        },
        revenueByChannel: [],
        guestSegmentation: [],
        topPerformingRooms: [],
        alerts: [{
          id: 'error',
          type: 'error',
          message: 'Unable to load dashboard data. Please try again.',
          timestamp: new Date().toISOString()
        }]
      },
      metadata: {
        period,
        cached: false,
        generatedAt: new Date().toISOString(),
        error: true
      }
    });
  }
};

// Data validation helper function
function validateBookingData(bookings) {
  let validationResults = {
    hasIssues: false,
    issues: [],
    statistics: {
      totalBookings: bookings.length,
      invalidAmounts: 0,
      missingDates: 0,
      invalidDateRanges: 0,
      missingRooms: 0,
      missingGuestDetails: 0
    }
  };

  bookings.forEach((booking, index) => {
    // Check for invalid amounts
    if (!booking.totalAmount || booking.totalAmount <= 0) {
      validationResults.hasIssues = true;
      validationResults.statistics.invalidAmounts++;
      validationResults.issues.push(`Booking ${booking._id}: Invalid or missing totalAmount`);
    }

    // Check for missing dates
    if (!booking.checkIn || !booking.checkOut) {
      validationResults.hasIssues = true;
      validationResults.statistics.missingDates++;
      validationResults.issues.push(`Booking ${booking._id}: Missing check-in or check-out date`);
    }

    // Check for invalid date ranges
    if (booking.checkIn && booking.checkOut && booking.checkIn >= booking.checkOut) {
      validationResults.hasIssues = true;
      validationResults.statistics.invalidDateRanges++;
      validationResults.issues.push(`Booking ${booking._id}: Check-in date is after check-out date`);
    }

    // Check for missing room information
    if (!booking.rooms || booking.rooms.length === 0) {
      validationResults.hasIssues = true;
      validationResults.statistics.missingRooms++;
      validationResults.issues.push(`Booking ${booking._id}: No rooms assigned`);
    }

    // Check for missing guest details
    if (!booking.guestDetails || !booking.guestDetails.adults) {
      validationResults.statistics.missingGuestDetails++;
    }
  });

  logger.debug('Booking data validation completed', validationResults.statistics);
  return validationResults;
}

// Helper function to get real dashboard data
async function getRealDashboardData(startDate, endDate, hotelId, userRole = 'admin') {
  try {
    logger.info('Executive Dashboard calculation started', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      hotelId,
      userRole
    });

    // Build filter for hotel and date range
    // Use check-in dates for revenue calculation to avoid double-counting
    const filter = {
      checkIn: { $gte: startDate, $lte: endDate } // Only bookings checking in during period
    };

    if (hotelId) {
      filter.hotelId = mongoose.Types.ObjectId.isValid(hotelId)
        ? new mongoose.Types.ObjectId(hotelId)
        : hotelId;
    }

    logger.info('Booking filter applied', {
      filter,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      hotelId,
      hotelIdType: typeof hotelId
    });

    // Test the query without population first
    const testCount = await Booking.countDocuments(filter);
    logger.info('Booking test count query', {
      filter,
      countResult: testCount
    });

    // Get bookings data with proper population
    const bookings = await Booking.find(filter)
      .populate('hotelId', 'name')
      .populate('userId', 'name email')
      .populate('rooms.roomId', 'roomNumber type currentRate')
      .lean(); // Use lean() for better performance when not modifying documents

    logger.info('Bookings retrieved for analytics', {
      totalBookings: bookings.length,
      dateRange: `${startDate.toISOString()} to ${endDate.toISOString()}`,
      sampleBookingIds: bookings.slice(0, 3).map(b => b._id)
    });

    // Data validation checks
    const validationResults = validateBookingData(bookings);
    if (validationResults.hasIssues) {
      logger.warn('Data quality issues detected', validationResults);
    }

    // Calculate KPIs
    const totalRevenue = bookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);
    const totalBookings = bookings.length;

    logger.debug('Basic KPI calculation', {
      totalRevenue,
      totalBookings
    });

    // Calculate total room nights sold for accurate ADR
    const totalRoomNightsSold = bookings.reduce((sum, booking) => {
      const nights = Math.ceil((booking.checkOut - booking.checkIn) / (1000 * 60 * 60 * 24));
      const roomCount = booking.rooms ? booking.rooms.length : 1;
      const bookingRoomNights = Math.max(1, nights) * roomCount;

      logger.debug('Room nights calculation for booking', {
        bookingId: booking._id,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        nights,
        roomCount,
        bookingRoomNights
      });

      return sum + bookingRoomNights;
    }, 0);

    // ADR = Total Room Revenue / Total Room Nights Sold
    const averageDailyRate = totalRoomNightsSold > 0 ? totalRevenue / totalRoomNightsSold : 0;

    logger.info('ADR calculation completed', {
      totalRoomNightsSold,
      averageDailyRate: Math.round(averageDailyRate * 100) / 100
    });

    // Calculate RevPAR (Revenue Per Available Room)
    let totalRooms = 0;
    try {
      totalRooms = await Room.countDocuments({
        hotelId: hotelId,
        isActive: true
      });
      logger.debug('Room count completed', { totalRooms });
    } catch (error) {
      logger.error('Failed to get room count', { error: error.message });
      totalRooms = 10; // Fallback assumption for basic calculation
    }

    // Calculate the number of days in the period
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) || 1;
    const availableRoomNights = totalRooms * daysDiff;

    // RevPAR = Total Revenue / Available Room Nights
    const revpar = availableRoomNights > 0 ? totalRevenue / availableRoomNights : 0;

    logger.info('RevPAR calculation completed', {
      totalRooms,
      daysDiff,
      availableRoomNights,
      revpar: Math.round(revpar * 100) / 100
    });

    // Simplified occupancy rate calculation
    // Get all confirmed/checked-in/checked-out bookings in the period
    const occupiedBookings = await Booking.find({
      ...filter,
      status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
    }).select('checkIn checkOut roomId');

    // Calculate total booked room nights
    const totalBookedNights = occupiedBookings.reduce((sum, booking) => {
      const nights = Math.ceil((booking.checkOut - booking.checkIn) / (1000 * 60 * 60 * 24));
      const bookedNights = Math.max(1, nights);

      logger.debug('Occupancy booking calculation', {
        bookingId: booking._id,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        nights,
        bookedNights
      });

      return sum + bookedNights; // Ensure at least 1 night
    }, 0);

    // Calculate occupancy rate
    const occupancyRate = availableRoomNights > 0 ? (totalBookedNights / availableRoomNights) * 100 : 0;

    logger.info('Occupancy calculation completed', {
      occupiedBookingsCount: occupiedBookings.length,
      totalBookedNights,
      occupancyRate: Math.round(occupancyRate * 100) / 100
    });

    // Get cancellation data
    let cancellations = 0;
    try {
      cancellations = await Booking.countDocuments({
        ...filter,
        status: 'cancelled'
      });
      logger.debug('Cancellation count completed', { cancellations });
    } catch (error) {
      logger.error('Failed to get cancellation count', { error: error.message });
      cancellations = 0;
    }

    // Revenue by channel (using source field or default to 'direct')
    let revenueByChannel = [];
    try {
      revenueByChannel = await Booking.aggregate([
        { $match: filter },
        {
          $group: {
            _id: { $ifNull: ['$source', 'direct'] },
            revenue: { $sum: '$totalAmount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { revenue: -1 } }
      ]);
      logger.debug('Revenue by channel aggregation completed', { channelCount: revenueByChannel.length });
    } catch (error) {
      logger.error('Revenue by channel aggregation failed', { error: error.message });
      // Fallback to simple calculation
      revenueByChannel = [{ _id: 'direct', revenue: totalRevenue, count: totalBookings }];
    }

    // Guest segmentation (by guest type or booking characteristics)
    let guestSegmentation = [];
    try {
      guestSegmentation = await Booking.aggregate([
        { $match: filter },
        {
          $addFields: {
            guestCategory: {
              $switch: {
                branches: [
                  { case: { $eq: ['$guestDetails.adults', 1] }, then: 'Single' },
                  { case: { $eq: ['$guestDetails.adults', 2] }, then: 'Couple' },
                  { case: { $gte: ['$guestDetails.adults', 3] }, then: 'Group' }
                ],
                default: 'Single'
              }
            }
          }
        },
        {
          $group: {
            _id: '$guestCategory',
            count: { $sum: 1 },
            revenue: { $sum: '$totalAmount' }
          }
        },
        { $sort: { count: -1 } }
      ]);
      logger.debug('Guest segmentation aggregation completed', { segmentCount: guestSegmentation.length });
    } catch (error) {
      logger.error('Guest segmentation aggregation failed', { error: error.message });
      // Fallback to simple single category
      guestSegmentation = [{ _id: 'Single', count: totalBookings, revenue: totalRevenue }];
    }

    // Top performing room types
    let topPerformingRoomTypes = [];
    try {
      topPerformingRoomTypes = await Booking.aggregate([
        { $match: filter },
        { $unwind: '$rooms' },
        { $lookup: {
          from: 'rooms',
          localField: 'rooms.roomId',
          foreignField: '_id',
          as: 'roomDetails'
        }},
        { $unwind: '$roomDetails' },
        {
          $group: {
            _id: '$roomDetails.type',
            revenue: { $sum: '$rooms.rate' },
            bookings: { $sum: 1 },
            roomType: { $first: '$roomDetails.type' }
          }
        },
        { $sort: { revenue: -1 } },
        { $limit: 5 }
      ]);
      logger.debug('Top room types aggregation completed', { roomTypeCount: topPerformingRoomTypes.length });
    } catch (error) {
      logger.error('Top performing room types aggregation failed', { error: error.message });
      // Fallback to empty array or basic room type data
      topPerformingRoomTypes = [];
    }

    // Calculate previous period for comparison
    const periodDuration = endDate.getTime() - startDate.getTime();
    const previousPeriodEnd = new Date(startDate.getTime() - 1); // Day before current period starts
    const previousPeriodStart = new Date(previousPeriodEnd.getTime() - periodDuration);
    
    const previousBookings = await Booking.find({
      ...filter,
      checkIn: { $gte: previousPeriodStart, $lt: previousPeriodEnd }
    });

    const previousRevenue = previousBookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);
    const previousBookingsCount = previousBookings.length;

    // Calculate previous period occupancy rate
    const previousOccupiedBookings = await Booking.find({
      checkIn: { $gte: previousPeriodStart, $lt: previousPeriodEnd },
      status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
    }).select('checkIn checkOut roomId');

    const previousTotalBookedNights = previousOccupiedBookings.reduce((sum, booking) => {
      const nights = Math.ceil((booking.checkOut - booking.checkIn) / (1000 * 60 * 60 * 24));
      return sum + Math.max(1, nights);
    }, 0);

    const previousAvailableRoomNights = totalRooms * daysDiff;
    const previousOccupancy = previousAvailableRoomNights > 0 ? (previousTotalBookedNights / previousAvailableRoomNights) * 100 : 0;
    const previousCancellations = await Booking.countDocuments({
      checkIn: { $gte: previousPeriodStart, $lt: previousPeriodEnd },
      status: 'cancelled'
    });
    
    // Calculate year-over-year comparison
    const yearAgoStart = new Date(startDate.getFullYear() - 1, startDate.getMonth(), startDate.getDate());
    const yearAgoEnd = new Date(endDate.getFullYear() - 1, endDate.getMonth(), endDate.getDate());
    const yearAgoBookings = await Booking.find({
      checkIn: { $gte: yearAgoStart, $lt: yearAgoEnd },
      ...(hotelId && { hotelId })
    });
    
    const yearAgoRevenue = yearAgoBookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);
    const yearAgoBookingsCount = yearAgoBookings.length;
    
    // Generate trend data (last 7 days)
    const trendData = await generateTrendData(startDate, endDate, hotelId);
    
    // Generate forecast data
    const forecastData = await generateForecastData(bookings, totalRooms);

    // Calculate changes
    const revenueChange = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;
    const bookingsChange = previousBookingsCount > 0 ? ((totalBookings - previousBookingsCount) / previousBookingsCount) * 100 : 0;
    const occupancyChange = previousOccupancy > 0 ? ((occupiedRooms - previousOccupancy) / previousOccupancy) * 100 : 0;
    const cancellationChange = previousCancellations > 0 ? ((cancellations - previousCancellations) / previousCancellations) * 100 : 0;

    // Format guest segmentation data
    const formattedGuestSegmentation = guestSegmentation.map(item => {
      let segmentName = 'Unknown';
      if (item._id === 1) segmentName = 'Solo';
      else if (item._id === 2) segmentName = 'Couple';
      else if (item._id === 3) segmentName = 'Family';
      else if (item._id >= 4) segmentName = 'Group';
      
      return {
        segment: segmentName,
        count: item.count,
        revenue: item.revenue,
        percentage: totalBookings > 0 ? (item.count / totalBookings) * 100 : 0
      };
    });

    // Format top performing room types
    const formattedTopPerformingRoomTypes = topPerformingRoomTypes.map(item => ({
      roomType: item.room.roomNumber || 'Unknown',
      revenue: item.revenue,
      occupancy: 0, // Could calculate this if needed
      performance: item.revenue > 10000 ? 'excellent' : item.revenue > 5000 ? 'good' : 'average'
    }));

    // Base dashboard data
    const baseData = {
      kpis: {
        revenue: {
          label: 'Total Revenue',
          value: totalRevenue,
          change: revenueChange,
          changeType: revenueChange >= 0 ? 'increase' : 'decrease',
          format: 'currency'
        },
        occupancy: {
          label: 'Occupancy Rate',
          value: occupancyRate,
          change: occupancyChange,
          changeType: occupancyChange >= 0 ? 'increase' : 'decrease',
          format: 'percentage'
        },
        adr: {
          label: 'Average Daily Rate',
          value: averageDailyRate,
          change: 0, // Could calculate this if needed
          changeType: 'neutral',
          format: 'currency'
        },
        revpar: {
          label: 'RevPAR',
          value: revpar,
          change: 0, // Could calculate this if needed
          changeType: 'neutral',
          format: 'currency'
        },
        bookings: {
          label: 'Total Bookings',
          value: totalBookings,
          change: bookingsChange,
          changeType: bookingsChange >= 0 ? 'increase' : 'decrease',
          format: 'number'
        },
        cancellations: {
          label: 'Cancellations',
          value: cancellations,
          change: cancellationChange,
          changeType: cancellationChange >= 0 ? 'increase' : 'decrease',
          format: 'number'
        }
      },
      revenueByChannel: revenueByChannel.map(item => ({
        channel: item._id || 'Unknown',
        revenue: item.revenue,
        percentage: totalRevenue > 0 ? (item.revenue / totalRevenue) * 100 : 0
      })),
      guestSegmentation: formattedGuestSegmentation,
      topPerformingRooms: formattedTopPerformingRoomTypes,
      alerts: [] // Could add system alerts here
    };

    // Add role-based data
    if (userRole === 'admin' || userRole === 'manager') {
      baseData.trends = trendData;
      baseData.forecasts = forecastData;
      baseData.comparisons = {
        previousPeriod: {
          revenue: revenueChange,
          occupancy: occupancyChange,
          adr: 0 // Placeholder
        },
        yearOverYear: {
          revenue: yearAgoRevenue > 0 ? ((totalRevenue - yearAgoRevenue) / yearAgoRevenue) * 100 : 0,
          occupancy: 0, // Placeholder
          adr: 0 // Placeholder
        }
      };
    }

    // Add staff-specific operational data
    if (userRole === 'staff') {
      baseData.operationalMetrics = {
        todaysCheckins: totalBookings,
        currentOccupancy: occupancyRate,
        todaysCheckouts: Math.floor(totalBookings * 0.8), // Estimated
        todaysRevenue: totalRevenue,
        availableRooms: totalRooms - Math.floor(totalRooms * occupancyRate / 100)
      };
    }

    return baseData;

  } catch (error) {
    logger.error('Critical error in getRealDashboardData:', {
      error: error.message,
      stack: error.stack,
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString(),
      hotelId,
      userRole
    });

    // Return a fallback response with basic data structure
    return {
      kpis: {
        revenue: { label: 'Total Revenue', value: 0, change: 0, changeType: 'neutral', format: 'currency' },
        occupancy: { label: 'Occupancy Rate', value: 0, change: 0, changeType: 'neutral', format: 'percentage' },
        adr: { label: 'Average Daily Rate', value: 0, change: 0, changeType: 'neutral', format: 'currency' },
        revpar: { label: 'RevPAR', value: 0, change: 0, changeType: 'neutral', format: 'currency' },
        bookings: { label: 'Total Bookings', value: 0, change: 0, changeType: 'neutral', format: 'number' },
        cancellations: { label: 'Cancellations', value: 0, change: 0, changeType: 'neutral', format: 'number' }
      },
      revenueByChannel: [],
      guestSegmentation: [],
      topPerformingRooms: [],
      alerts: [{
        id: 'error',
        type: 'error',
        message: 'Unable to load dashboard data. Please try again.',
        timestamp: new Date().toISOString()
      }]
    };
  }
}

export const getRealtimeKPIs = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    // Get today's bookings
    const todayBookings = await Booking.find({
      checkIn: { $gte: startOfDay, $lt: endOfDay }
    });

    const todayRevenue = todayBookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);
    const todayBookingsCount = todayBookings.length;
    const todayADR = todayBookingsCount > 0 ? todayRevenue / todayBookingsCount : 0;

    // Get total rooms for occupancy calculation
    const totalRooms = await Room.countDocuments({ isActive: true });
    const todayOccupiedRooms = await Booking.countDocuments({
      checkIn: { $gte: startOfDay, $lt: endOfDay },
      status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
    });
    const todayOccupancyRate = totalRooms > 0 ? (todayOccupiedRooms / totalRooms) * 100 : 0;
    const todayRevpar = totalRooms > 0 ? todayRevenue / totalRooms : 0;

    res.json({
      success: true,
      data: {
        today: {
          revenue: todayRevenue,
          bookings: todayBookingsCount,
          adr: todayADR,
          occupancy: {
            occupancy_rate: todayOccupancyRate,
            occupied_rooms: todayOccupiedRooms,
            total_rooms: totalRooms
          },
          revpar: todayRevpar
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error getting real-time KPIs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get real-time KPIs',
      error: error.message
    });
  }
};

// Staff-specific operational metrics
export const getStaffOperationalMetrics = async (req, res) => {
  try {
    const { hotel_id } = req.query;
    const userRole = req.user?.role || 'staff';
    
    if (userRole !== 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This endpoint is for staff only.'
      });
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Get today's operational data
    const todaysCheckins = await Booking.find({
      checkIn: { $gte: today, $lt: tomorrow },
      status: { $in: ['confirmed', 'checked_in'] },
      ...(hotel_id && { hotelId: hotel_id })
    }).populate('userId', 'name email').populate('rooms.roomId', 'roomNumber type');
    
    const todaysCheckouts = await Booking.find({
      checkOut: { $gte: today, $lt: tomorrow },
      status: { $in: ['checked_in', 'checked_out'] },
      ...(hotel_id && { hotelId: hotel_id })
    }).populate('userId', 'name email').populate('rooms.roomId', 'roomNumber type');
    
    const currentOccupancy = await Booking.countDocuments({
      status: 'checked_in',
      ...(hotel_id && { hotelId: hotel_id })
    });
    
    const totalRooms = await Room.countDocuments({ 
      ...(hotel_id && { hotelId: hotel_id }), 
      isActive: true 
    });
    
    const availableRooms = totalRooms - currentOccupancy;
    
    res.json({
      success: true,
      data: {
        todaysCheckins: {
          count: todaysCheckins.length,
          bookings: todaysCheckins.map(booking => ({
            id: booking._id,
            guestName: booking.userId?.name || 'Unknown',
            roomNumber: booking.rooms[0]?.roomId?.roomNumber || 'N/A',
            checkInTime: booking.checkIn,
            status: booking.status
          }))
        },
        todaysCheckouts: {
          count: todaysCheckouts.length,
          bookings: todaysCheckouts.map(booking => ({
            id: booking._id,
            guestName: booking.userId?.name || 'Unknown',
            roomNumber: booking.rooms[0]?.roomId?.roomNumber || 'N/A',
            checkOutTime: booking.checkOut,
            status: booking.status
          }))
        },
        currentOccupancy: {
          occupied: currentOccupancy,
          available: availableRooms,
          total: totalRooms,
          occupancyRate: totalRooms > 0 ? (currentOccupancy / totalRooms) * 100 : 0
        }
      }
    });
    
  } catch (error) {
    logger.error('Error fetching staff operational metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch operational metrics',
      error: error.message
    });
  }
};

export const forecastOccupancy = async (req, res) => {
  try {
    await initializeServices();
    
    const { hotelId } = req.params;
    const { days = 30 } = req.query;
    
    const forecast = await predictiveEngine.forecastOccupancy(hotelId, parseInt(days));

    res.json({
      success: true,
      data: forecast
    });

  } catch (error) {
    logger.error('Error forecasting occupancy:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to forecast occupancy',
      error: error.message
    });
  }
};

export const predictDemand = async (req, res) => {
  try {
    await initializeServices();
    
    const { hotelId } = req.params;
    const { period = '30d' } = req.query;
    
    const prediction = await predictiveEngine.predictDemand(hotelId, period);

    res.json({
      success: true,
      data: prediction
    });

  } catch (error) {
    logger.error('Error predicting demand:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to predict demand',
      error: error.message
    });
  }
};

export const analyzeMarketTrends = async (req, res) => {
  try {
    await initializeServices();
    
    const { hotelId } = req.params;
    const { period = '90d' } = req.query;
    
    const trends = await predictiveEngine.analyzeMarketTrends(hotelId, period);

    res.json({
      success: true,
      data: trends
    });

  } catch (error) {
    logger.error('Error analyzing market trends:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze market trends',
      error: error.message
    });
  }
};

// Staff Productivity Analytics
export const getStaffProductivity = async (req, res) => {
  try {
    const result = await staffProductivityService.getStaffProductivityAnalytics(req.body);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    logger.error('Error in getStaffProductivity:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getHousekeepingEfficiency = async (req, res) => {
  try {
    const result = await staffProductivityService.getHousekeepingEfficiency(req.body);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    logger.error('Error in getHousekeepingEfficiency:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getFrontDeskPerformance = async (req, res) => {
  try {
    const result = await staffProductivityService.getFrontDeskPerformance(req.body);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    logger.error('Error in getFrontDeskPerformance:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Corporate Analytics
export const getCorporateBookings = async (req, res) => {
  try {
    const result = await corporateAnalyticsService.getCorporateBookingAnalytics(req.body);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    logger.error('Error in getCorporateBookings:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getCorporatePayments = async (req, res) => {
  try {
    const result = await corporateAnalyticsService.getCorporatePaymentAnalytics(req.body);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    logger.error('Error in getCorporatePayments:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Booking Channel Analytics
export const getBookingChannels = async (req, res) => {
  try {
    const result = await bookingChannelService.getChannelPerformanceAnalytics(req.body);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    logger.error('Error in getBookingChannels:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const getChannelROI = async (req, res) => {
  try {
    const result = await bookingChannelService.getChannelROIAnalysis(req.body);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    logger.error('Error in getChannelROI:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// New endpoint for room type profitability analysis
export const getRoomTypeProfitability = async (req, res) => {
  try {
    const { period = '30d', hotel_id } = req.query;

    // Calculate date range
    let startDate, endDate = new Date();
    switch (period) {
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const roomTypeProfitability = await calculateRoomTypeProfitability(startDate, endDate, hotel_id);

    res.json({
      success: true,
      data: roomTypeProfitability,
      metadata: {
        period,
        dateRange: { startDate, endDate },
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error in getRoomTypeProfitability:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get room type profitability',
      error: error.message
    });
  }
};

// New endpoint for revenue forecasting
export const getRevenueForecast = async (req, res) => {
  try {
    const { days = 7, hotel_id } = req.query;

    const forecast = await generateRevenueForecast(parseInt(days), hotel_id);

    res.json({
      success: true,
      data: forecast,
      metadata: {
        days: parseInt(days),
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error in getRevenueForecast:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate revenue forecast',
      error: error.message
    });
  }
};

// New endpoint for smart recommendations
export const getSmartRecommendations = async (req, res) => {
  try {
    const { period = '30d', hotel_id } = req.query;

    const recommendations = await generateSmartRecommendations(period, hotel_id);

    res.json({
      success: true,
      data: recommendations,
      metadata: {
        period,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error in getSmartRecommendations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate smart recommendations',
      error: error.message
    });
  }
};

// Helper function to calculate room type profitability
async function calculateRoomTypeProfitability(startDate, endDate, hotelId) {
  try {
    const filter = {
      $or: [
        { createdAt: { $gte: startDate, $lte: endDate } }, // Bookings created in period
        { checkIn: { $gte: startDate, $lte: endDate } }    // Bookings checking in during period
      ]
    };

    if (hotelId) {
      filter.hotelId = hotelId;
    }

    // Get all bookings with room details
    const bookings = await Booking.find(filter)
      .populate('rooms.roomId', 'type roomNumber currentRate baseRate');

    // Group by room type and calculate metrics
    const roomTypeStats = {};

    bookings.forEach(booking => {
      booking.rooms.forEach(room => {
        const roomType = room.roomId.type;

        if (!roomTypeStats[roomType]) {
          roomTypeStats[roomType] = {
            roomType: roomType,
            totalRevenue: 0,
            totalBookings: 0,
            roomNumbers: new Set(),
            rates: []
          };
        }

        roomTypeStats[roomType].totalRevenue += room.rate || 0;
        roomTypeStats[roomType].totalBookings += 1;
        roomTypeStats[roomType].roomNumbers.add(room.roomId.roomNumber);
        roomTypeStats[roomType].rates.push(room.rate || 0);
      });
    });

    // Get total rooms by type for occupancy calculation
    const allRooms = await Room.find({ hotelId: hotelId, isActive: true });
    const roomCounts = {};
    allRooms.forEach(room => {
      roomCounts[room.type] = (roomCounts[room.type] || 0) + 1;
    });

    // Calculate profitability metrics
    const profitabilityData = Object.values(roomTypeStats).map(stats => {
      const averageRate = stats.rates.length > 0
        ? stats.rates.reduce((sum, rate) => sum + rate, 0) / stats.rates.length
        : 0;

      // Estimate costs based on room type (more complex room types have higher costs)
      const costMultiplier = {
        'single': 0.45,
        'double': 0.50,
        'deluxe': 0.55,
        'suite': 0.60,
        'presidential': 0.65
      };

      const estimatedCosts = stats.totalRevenue * (costMultiplier[stats.roomType] || 0.50);
      const profit = stats.totalRevenue - estimatedCosts;
      const profitMargin = stats.totalRevenue > 0 ? (profit / stats.totalRevenue) * 100 : 0;

      // Calculate occupancy rate
      const totalRoomsOfType = roomCounts[stats.roomType] || 1;
      const occupancyRate = (stats.roomNumbers.size / totalRoomsOfType) * 100;

      return {
        roomType: formatRoomTypeName(stats.roomType),
        revenue: stats.totalRevenue,
        costs: estimatedCosts,
        profit: profit,
        profitMargin: Math.round(profitMargin * 10) / 10,
        occupancyRate: Math.round(occupancyRate * 10) / 10,
        averageRate: Math.round(averageRate),
        roomCount: totalRoomsOfType,
        bookings: stats.totalBookings
      };
    });

    // Sort by revenue (highest first)
    return profitabilityData.sort((a, b) => b.revenue - a.revenue);

  } catch (error) {
    logger.error('Error calculating room type profitability:', error);
    throw error;
  }
}

// Helper function to generate revenue forecast
async function generateRevenueForecast(days, hotelId) {
  try {
    // Get historical booking data for pattern analysis
    const historicalData = await Booking.find({
      hotelId: hotelId,
      checkIn: {
        $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        $lte: new Date()
      }
    }).populate('rooms.roomId', 'type');

    // Analyze patterns by day of week
    const dayPatterns = {};
    historicalData.forEach(booking => {
      const dayOfWeek = new Date(booking.checkIn).getDay();
      if (!dayPatterns[dayOfWeek]) {
        dayPatterns[dayOfWeek] = { totalRevenue: 0, count: 0 };
      }
      dayPatterns[dayOfWeek].totalRevenue += booking.totalAmount || 0;
      dayPatterns[dayOfWeek].count += 1;
    });

    // Generate forecast for next N days
    const forecast = [];
    for (let i = 1; i <= days; i++) {
      const forecastDate = new Date(Date.now() + i * 24 * 60 * 60 * 1000);
      const dayOfWeek = forecastDate.getDay();

      const historicalAvg = dayPatterns[dayOfWeek]
        ? dayPatterns[dayOfWeek].totalRevenue / dayPatterns[dayOfWeek].count
        : 8000; // Default average

      // Add some randomness and seasonal factors
      const variance = 0.15; // 15% variance
      const randomFactor = 1 + (Math.random() - 0.5) * variance;
      const weekendBoost = (dayOfWeek === 5 || dayOfWeek === 6) ? 1.3 : 1.0;

      const predictedRevenue = Math.round(historicalAvg * randomFactor * weekendBoost);
      const predictedOccupancy = Math.min(95, Math.max(40, predictedRevenue / 150)); // Rough conversion

      // Calculate confidence based on historical data availability
      const confidence = dayPatterns[dayOfWeek]
        ? Math.min(95, 60 + (dayPatterns[dayOfWeek].count * 5))
        : 70;

      // Determine factors affecting the forecast
      const factors = [];
      if (dayOfWeek === 5 || dayOfWeek === 6) factors.push('Weekend surge');
      if (dayOfWeek === 1) factors.push('Monday dip');
      if (predictedOccupancy > 80) factors.push('High demand');
      if (predictedOccupancy < 60) factors.push('Low season');
      factors.push('Historical trend');

      forecast.push({
        date: forecastDate.toISOString().split('T')[0],
        predictedRevenue,
        predictedOccupancy: Math.round(predictedOccupancy * 10) / 10,
        confidence: Math.round(confidence),
        factors: factors.slice(0, 3) // Limit to 3 factors
      });
    }

    return forecast;

  } catch (error) {
    logger.error('Error generating revenue forecast:', error);
    throw error;
  }
}

// Helper function to generate smart recommendations
async function generateSmartRecommendations(period, hotelId) {
  try {
    // Get current room type performance
    let startDate, endDate = new Date();
    switch (period) {
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const roomTypeData = await calculateRoomTypeProfitability(startDate, endDate, hotelId);

    const recommendations = {
      revenueOpportunities: [],
      costOptimizations: []
    };

    // Analyze each room type for opportunities
    roomTypeData.forEach(roomType => {
      // Revenue opportunities
      if (roomType.occupancyRate < 70 && roomType.profitMargin > 30) {
        recommendations.revenueOpportunities.push({
          title: `Increase ${roomType.roomType} rates`,
          description: `Current occupancy is ${roomType.occupancyRate}%. Consider ${roomType.occupancyRate < 50 ? '20%' : '10%'} rate increase for peak periods.`,
          potential: `+₹${Math.round(roomType.revenue * 0.15)}/month`,
          type: 'rate_increase'
        });
      }

      if (roomType.occupancyRate > 85 && roomType.averageRate < 5000) {
        recommendations.revenueOpportunities.push({
          title: `Upsell ${roomType.roomType} packages`,
          description: `High occupancy rate (${roomType.occupancyRate}%). Target guests with premium packages and add-ons.`,
          potential: `+₹${Math.round(roomType.revenue * 0.12)}/month`,
          type: 'upsell'
        });
      }

      // Cost optimizations
      if (roomType.profitMargin < 35) {
        recommendations.costOptimizations.push({
          title: `Optimize ${roomType.roomType} operations`,
          description: `Profit margin is ${roomType.profitMargin}%, below target of 35%. Review operational costs and efficiency.`,
          savings: `-₹${Math.round(roomType.costs * 0.10)}/month`,
          type: 'cost_reduction'
        });
      }

      if (roomType.occupancyRate < 50) {
        recommendations.costOptimizations.push({
          title: `Dynamic staffing for ${roomType.roomType}`,
          description: `Low occupancy (${roomType.occupancyRate}%). Consider flexible staffing to reduce operational costs.`,
          savings: `-₹${Math.round(roomType.costs * 0.15)}/month`,
          type: 'staffing'
        });
      }
    });

    // Limit to top 2 recommendations per category
    recommendations.revenueOpportunities = recommendations.revenueOpportunities.slice(0, 2);
    recommendations.costOptimizations = recommendations.costOptimizations.slice(0, 2);

    return recommendations;

  } catch (error) {
    logger.error('Error generating smart recommendations:', error);
    throw error;
  }
}

// Helper function to format room type names
function formatRoomTypeName(roomType) {
  const typeMapping = {
    'single': 'Standard Single',
    'double': 'Standard Double',
    'deluxe': 'Deluxe Suite',
    'suite': 'Executive Suite',
    'presidential': 'Presidential Suite'
  };

  return typeMapping[roomType] || roomType.charAt(0).toUpperCase() + roomType.slice(1) + ' Room';
}

// Profitability Dashboard Methods
export const getProfitabilityMetrics = async (req, res) => {
  try {
    const hotelId = req.user.hotelId;
    const { period = '30d' } = req.query;

    // Calculate date range based on period
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    // Get all bookings in the period (including recent bookings created for dashboard)
    // For demo purposes, also include recently created bookings within the last 7 days
    const recentCreationDate = new Date();
    recentCreationDate.setDate(recentCreationDate.getDate() - 7);

    const bookings = await Booking.find({
      hotelId,
      $or: [
        { checkIn: { $gte: startDate, $lte: endDate } },
        { createdAt: { $gte: recentCreationDate } } // Include recently created bookings
      ],
      status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
    }).populate('rooms.roomId');

    // Get all rooms
    const rooms = await Room.find({ hotelId, isActive: true });
    const totalRooms = rooms.length;

    // Calculate basic metrics
    const totalRevenue = bookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);
    const totalRoomNights = bookings.reduce((sum, booking) => sum + (booking.nights || 0), 0);

    // Estimate costs (simplified calculation - in real system would have actual cost data)
    const estimatedCosts = totalRevenue * 0.6; // Assume 60% of revenue as costs
    const grossProfit = totalRevenue - estimatedCosts;
    const netProfit = grossProfit * 0.85; // Assume 15% for taxes/other expenses
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // Calculate occupancy and rates
    const totalPossibleRoomNights = totalRooms * Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const occupancyRate = totalPossibleRoomNights > 0 ? (totalRoomNights / totalPossibleRoomNights) * 100 : 0;
    const averageDailyRate = totalRoomNights > 0 ? totalRevenue / totalRoomNights : 0;
    const revenuePAR = totalPossibleRoomNights > 0 ? totalRevenue / totalRooms / Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) : 0;

    // Calculate previous period for comparison
    const prevEndDate = new Date(startDate);
    const prevStartDate = new Date(startDate);
    prevStartDate.setTime(prevStartDate.getTime() - (endDate.getTime() - startDate.getTime()));

    const prevBookings = await Booking.find({
      hotelId,
      checkIn: { $gte: prevStartDate, $lte: prevEndDate },
      status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
    });

    const prevRevenue = prevBookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);
    const prevRoomNights = prevBookings.reduce((sum, booking) => sum + (booking.nights || 0), 0);
    const prevProfit = (prevRevenue - (prevRevenue * 0.6)) * 0.85;
    const prevOccupancy = totalPossibleRoomNights > 0 ? (prevRoomNights / totalPossibleRoomNights) * 100 : 0;

    // Calculate room type profitability
    const roomTypeProfitability = [];
    const roomTypeStats = {};

    // Group bookings by room type
    for (const booking of bookings) {
      const roomType = booking.roomType || 'Unknown';
      if (!roomTypeStats[roomType]) {
        roomTypeStats[roomType] = {
          revenue: 0,
          nights: 0,
          bookings: 0,
          roomCount: 0
        };
      }
      roomTypeStats[roomType].revenue += booking.totalAmount || 0;
      roomTypeStats[roomType].nights += booking.nights || 0;
      roomTypeStats[roomType].bookings += 1;
    }

    // Count rooms by type
    const roomTypeCounts = {};
    for (const room of rooms) {
      const type = room.roomType || 'Unknown';
      roomTypeCounts[type] = (roomTypeCounts[type] || 0) + 1;
    }

    // Build room type profitability data
    for (const [roomType, stats] of Object.entries(roomTypeStats)) {
      const revenue = stats.revenue;
      const costs = revenue * 0.6;
      const profit = revenue - costs;
      const roomCount = roomTypeCounts[roomType] || 0;
      const occupancyRate = roomCount > 0 && stats.nights > 0 ?
        (stats.nights / (roomCount * Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)))) * 100 : 0;

      roomTypeProfitability.push({
        roomType,
        revenue,
        costs,
        profit,
        profitMargin: revenue > 0 ? (profit / revenue) * 100 : 0,
        occupancyRate,
        averageRate: stats.nights > 0 ? revenue / stats.nights : 0,
        roomCount
      });
    }

    // Generate forecast data (simplified prediction)
    const forecast = [];
    for (let i = 0; i < 7; i++) {
      const futureDate = new Date(endDate);
      futureDate.setDate(endDate.getDate() + i + 1);

      // Simple prediction based on historical average with some variation
      const dailyAvgRevenue = totalRevenue / Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      const variation = (Math.random() - 0.5) * 0.3; // ±15% variation
      const predictedRevenue = dailyAvgRevenue * (1 + variation);
      const predictedOccupancy = Math.min(95, occupancyRate * (1 + variation));

      forecast.push({
        date: futureDate.toISOString().split('T')[0],
        predictedRevenue: Math.round(predictedRevenue),
        predictedOccupancy: Math.round(predictedOccupancy * 10) / 10,
        confidence: 75 + Math.random() * 20, // 75-95% confidence
        factors: ['Historical trends', 'Seasonal patterns', 'Current bookings']
      });
    }

    // Smart recommendations
    const recommendations = {
      revenueOpportunities: [
        {
          title: 'Optimize Room Rates',
          description: `Current ADR is ₹${Math.round(averageDailyRate)}. Consider dynamic pricing.`,
          potential: `+₹${Math.round(totalRevenue * 0.15)}`,
          type: 'pricing'
        },
        {
          title: 'Increase Occupancy',
          description: `${Math.round(100 - occupancyRate)}% rooms available for optimization.`,
          potential: `+₹${Math.round(totalRevenue * 0.25)}`,
          type: 'occupancy'
        }
      ],
      costOptimizations: [
        {
          title: 'Energy Efficiency',
          description: 'Implement smart room controls for unoccupied rooms.',
          savings: `₹${Math.round(estimatedCosts * 0.08)}`,
          type: 'operational'
        },
        {
          title: 'Staff Optimization',
          description: 'Optimize housekeeping schedules based on occupancy.',
          savings: `₹${Math.round(estimatedCosts * 0.12)}`,
          type: 'staffing'
        }
      ]
    };

    const result = {
      totalRevenue: Math.round(totalRevenue),
      totalCosts: Math.round(estimatedCosts),
      grossProfit: Math.round(grossProfit),
      netProfit: Math.round(netProfit),
      profitMargin: Math.round(profitMargin * 10) / 10,
      revenuePerRoom: totalRooms > 0 ? Math.round(totalRevenue / totalRooms) : 0,
      costPerRoom: totalRooms > 0 ? Math.round(estimatedCosts / totalRooms) : 0,
      occupancyRate: Math.round(occupancyRate * 10) / 10,
      averageDailyRate: Math.round(averageDailyRate),
      revenuePAR: Math.round(revenuePAR),
      previousPeriodComparison: {
        revenue: prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100 * 10) / 10 : 0,
        profit: prevProfit > 0 ? Math.round(((netProfit - prevProfit) / prevProfit) * 100 * 10) / 10 : 0,
        occupancy: prevOccupancy > 0 ? Math.round(((occupancyRate - prevOccupancy) / prevOccupancy) * 100 * 10) / 10 : 0
      },
      roomTypeProfitability,
      forecast,
      recommendations
    };

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Profitability metrics error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Helper function to generate trend data
async function generateTrendData(startDate, endDate, hotelId) {
  try {
    const days = Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000));
    const trendData = {
      revenue: [],
      occupancy: [],
      adr: []
    };

    for (let i = 0; i < Math.min(days, 7); i++) {
      const dayStart = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      
      const dayBookings = await Booking.find({
        checkIn: { $gte: dayStart, $lt: dayEnd },
        ...(hotelId && { hotelId })
      }).lean();

      const dayRevenue = dayBookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);
      const dayOccupancy = dayBookings.length;
      const dayADR = dayBookings.length > 0 ? dayRevenue / dayBookings.length : 0;

      trendData.revenue.push({
        date: dayStart.toISOString().split('T')[0],
        value: dayRevenue
      });
      trendData.occupancy.push({
        date: dayStart.toISOString().split('T')[0],
        value: dayOccupancy
      });
      trendData.adr.push({
        date: dayStart.toISOString().split('T')[0],
        value: dayADR
      });
    }

    return trendData;
  } catch (error) {
    logger.error('Error generating trend data:', error);
    return { revenue: [], occupancy: [], adr: [] };
  }
}

// Helper function to generate forecast data
async function generateForecastData(bookings, totalRooms) {
  try {
    // Simple forecasting based on recent trends
    const recentBookings = bookings.slice(-7); // Last 7 bookings
    const avgRevenue = recentBookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0) / recentBookings.length;
    const avgOccupancy = recentBookings.length / 7;

    // Simple linear projection (in real implementation, use more sophisticated algorithms)
    const nextWeekRevenue = avgRevenue * 7 * 1.1; // 10% growth assumption
    const nextMonthRevenue = avgRevenue * 30 * 1.15; // 15% growth assumption
    
    const nextWeekOccupancy = Math.min(avgOccupancy * 1.05, totalRooms); // 5% growth, capped at total rooms
    const nextMonthOccupancy = Math.min(avgOccupancy * 1.1, totalRooms); // 10% growth, capped at total rooms

    return {
      revenue: {
        nextWeek: nextWeekRevenue,
        nextMonth: nextMonthRevenue
      },
      occupancy: {
        nextWeek: (nextWeekOccupancy / totalRooms) * 100,
        nextMonth: (nextMonthOccupancy / totalRooms) * 100
      }
    };
  } catch (error) {
    logger.error('Error generating forecast data:', error);
    return {
      revenue: { nextWeek: 0, nextMonth: 0 },
      occupancy: { nextWeek: 0, nextMonth: 0 }
    };
  }
}
