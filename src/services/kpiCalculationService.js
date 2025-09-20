import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import Review from '../models/Review.js';
import StaffTask from '../models/StaffTask.js';
import MaintenanceTask from '../models/MaintenanceTask.js';
import Housekeeping from '../models/Housekeeping.js';
import KPI from '../models/KPI.js';

class KPICalculationService {
  /**
   * Calculate and save KPIs for a specific date and hotel
   * @param {string} hotelId - Hotel ID
   * @param {Date} date - Date for calculation
   * @param {string} period - Period type (daily, weekly, monthly, yearly)
   */
  static async calculateKPIs(hotelId, date, period = 'daily') {
    const { startDate, endDate } = this.getDateRange(date, period);

    try {
      // Calculate all KPI components
      const [
        revenueData,
        occupancyData,
        productivityData,
        riskData,
        floorData,
        operatingExpenses
      ] = await Promise.all([
        this.calculateRevenueMetrics(hotelId, startDate, endDate),
        this.calculateOccupancyMetrics(hotelId, startDate, endDate),
        this.calculateProductivityMetrics(hotelId, startDate, endDate),
        this.calculateRiskMetrics(hotelId, startDate, endDate),
        this.calculateFloorMetrics(hotelId, startDate, endDate),
        this.calculateOperatingExpenses(hotelId, startDate, endDate)
      ]);

      // Create or update KPI record
      const kpiData = {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        date: new Date(date),
        period,
        revenue: revenueData,
        occupancy: occupancyData,
        rates: {
          adr: 0,
          revpar: 0
        },
        productivity: productivityData,
        risk: riskData,
        floorMetrics: floorData,
        profitability: {
          ...operatingExpenses,
          roomDirectCosts: this.calculateRoomDirectCosts(occupancyData.roomNightsSold),
          gop: 0,
          goppar: 0,
          cpor: 0
        }
      };

      // Try to find existing KPI record
      let kpi = await KPI.findOne({ hotelId, date: new Date(date), period });
      
      if (kpi) {
        // Update existing record
        Object.assign(kpi, kpiData);
      } else {
        // Create new record
        kpi = new KPI(kpiData);
      }
      
      // Save to trigger pre-save middleware
      await kpi.save();

      return kpi;
    } catch (error) {
      console.error('Error calculating KPIs:', error);
      throw error;
    }
  }

  /**
   * Calculate revenue metrics
   */
  static async calculateRevenueMetrics(hotelId, startDate, endDate) {
    const pipeline = [
      {
        $match: {
          hotelId: new mongoose.Types.ObjectId(hotelId),
          status: { $in: ['confirmed', 'checked_in', 'checked_out'] },
          $or: [
            { checkIn: { $gte: startDate, $lte: endDate } },
            { checkOut: { $gte: startDate, $lte: endDate } },
            { checkIn: { $lte: startDate }, checkOut: { $gte: endDate } }
          ]
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$totalAmount' },
          bookings: { $push: '$$ROOT' }
        }
      }
    ];

    const result = await Booking.aggregate(pipeline);
    const data = result[0] || { totalAmount: 0, bookings: [] };

    // Calculate revenue breakdown
    let roomRevenue = 0;
    let addOns = 0;
    let taxes = 0;
    let discounts = 0;

    data.bookings.forEach(booking => {
      const baseAmount = booking.totalAmount || 0;
      
      // Estimate room revenue (75% of total, rest is taxes and services)
      const roomAmount = baseAmount * 0.75;
      roomRevenue += roomAmount;
      
      // Estimate taxes (18% GST on room amount)
      const taxAmount = roomAmount * 0.18;
      taxes += taxAmount;
      
      // Add-ons and extras
      if (booking.extras && booking.extras.length > 0) {
        const extraAmount = booking.extras.reduce((sum, extra) => 
          sum + (extra.price * extra.quantity), 0);
        addOns += extraAmount;
      }

      // Note: Discounts would need to be tracked separately in booking model
      // For now, we'll estimate based on difference
      const calculatedTotal = roomAmount + taxAmount + (booking.extras ? 
        booking.extras.reduce((sum, extra) => sum + (extra.price * extra.quantity), 0) : 0);
      
      if (calculatedTotal > baseAmount) {
        discounts += calculatedTotal - baseAmount;
      }
    });

    return {
      roomRevenue,
      nonRoomRevenue: 0, // Would come from F&B, Spa services - not currently tracked
      totalRevenue: roomRevenue,
      addOns,
      discounts,
      taxes
    };
  }

  /**
   * Calculate occupancy metrics
   */
  static async calculateOccupancyMetrics(hotelId, startDate, endDate) {
    // Get total available rooms for the hotel
    const totalRooms = await Room.countDocuments({ 
      hotelId: new mongoose.Types.ObjectId(hotelId),
      isActive: true 
    });

    // Calculate days in period
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const availableRoomNights = totalRooms * days;

    // Calculate occupied room nights
    const occupancyPipeline = [
      {
        $match: {
          hotelId: new mongoose.Types.ObjectId(hotelId),
          status: { $in: ['confirmed', 'checked_in', 'checked_out'] },
          $or: [
            { checkIn: { $gte: startDate, $lte: endDate } },
            { checkOut: { $gte: startDate, $lte: endDate } },
            { checkIn: { $lte: startDate }, checkOut: { $gte: endDate } }
          ]
        }
      },
      {
        $addFields: {
          roomNights: {
            $multiply: [
              { $size: '$rooms' },
              '$nights'
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          totalRoomNights: { $sum: '$roomNights' },
          bookingCount: { $sum: 1 }
        }
      }
    ];

    const occupancyResult = await Booking.aggregate(occupancyPipeline);
    const occupancyData = occupancyResult[0] || { totalRoomNights: 0, bookingCount: 0 };

    // Calculate room nights sold (rooms × nights for each booking)
    const roomNightsSold = occupancyData.totalRoomNights || 0;

    return {
      roomNightsSold,
      availableRoomNights,
      occupancyRate: availableRoomNights > 0 ? (roomNightsSold / availableRoomNights) * 100 : 0
    };
  }

  /**
   * Calculate productivity metrics
   */
  static async calculateProductivityMetrics(hotelId, startDate, endDate) {
    const [housekeepingData, maintenanceData, frontDeskData] = await Promise.all([
      this.calculateHousekeepingProductivity(hotelId, startDate, endDate),
      this.calculateMaintenanceProductivity(hotelId, startDate, endDate),
      this.calculateFrontDeskProductivity(hotelId, startDate, endDate)
    ]);

    return {
      housekeeping: housekeepingData,
      maintenance: maintenanceData,
      frontDesk: frontDeskData
    };
  }

  /**
   * Calculate housekeeping productivity
   */
  static async calculateHousekeepingProductivity(hotelId, startDate, endDate) {
    const housekeepingTasks = await Housekeeping.find({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      createdAt: { $gte: startDate, $lte: endDate },
      status: 'completed'
    });

    const cleanedRooms = housekeepingTasks.length;
    
    // Estimate paid hours (8 hours per day per housekeeper, assuming 2 housekeepers)
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const paidHours = days * 8 * 2; // 2 housekeepers, 8 hours per day

    return {
      cleanedRooms,
      paidHours,
      productivity: paidHours > 0 ? cleanedRooms / paidHours : 0
    };
  }

  /**
   * Calculate maintenance productivity
   */
  static async calculateMaintenanceProductivity(hotelId, startDate, endDate) {
    const maintenanceTasks = await MaintenanceTask.find({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      createdAt: { $gte: startDate, $lte: endDate },
      status: 'completed'
    });

    const workOrdersClosed = maintenanceTasks.length;
    
    // Estimate paid hours (8 hours per day per maintenance staff, assuming 1 staff)
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const paidHours = days * 8 * 1; // 1 maintenance staff, 8 hours per day

    return {
      workOrdersClosed,
      paidHours,
      productivity: paidHours > 0 ? workOrdersClosed / paidHours : 0
    };
  }

  /**
   * Calculate front desk productivity
   */
  static async calculateFrontDeskProductivity(hotelId, startDate, endDate) {
    const checkInsData = await Booking.aggregate([
      {
        $match: {
          hotelId: new mongoose.Types.ObjectId(hotelId),
          checkInTime: { $gte: startDate, $lte: endDate }
        }
      },
      { $count: "checkIns" }
    ]);

    const checkOutsData = await Booking.aggregate([
      {
        $match: {
          hotelId: new mongoose.Types.ObjectId(hotelId),
          checkOutTime: { $gte: startDate, $lte: endDate }
        }
      },
      { $count: "checkOuts" }
    ]);

    const checkIns = checkInsData[0]?.checkIns || 0;
    const checkOuts = checkOutsData[0]?.checkOuts || 0;

    // Estimate paid hours (12 hours per day, 2 shifts, assuming 2 front desk staff)
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const paidHours = days * 12 * 2; // 2 front desk staff, 12 hours per day

    return {
      checkIns,
      checkOuts,
      paidHours,
      productivity: paidHours > 0 ? (checkIns + checkOuts) / paidHours : 0
    };
  }

  /**
   * Calculate risk metrics
   */
  static async calculateRiskMetrics(hotelId, startDate, endDate) {
    const bookingStats = await Booking.aggregate([
      {
        $match: {
          hotelId: new mongoose.Types.ObjectId(hotelId),
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          confirmedBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
          },
          cancelledBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          noShowBookings: {
            $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] }
          }
        }
      }
    ]);

    const stats = bookingStats[0] || {
      totalBookings: 0,
      confirmedBookings: 0,
      cancelledBookings: 0,
      noShowBookings: 0
    };

    // Calculate guest satisfaction from reviews
    const reviewStats = await Review.aggregate([
      {
        $match: {
          hotelId: new mongoose.Types.ObjectId(hotelId),
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          fiveStarReviews: {
            $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] }
          }
        }
      }
    ]);

    const reviewData = reviewStats[0] || {
      averageRating: 0,
      totalReviews: 0,
      fiveStarReviews: 0
    };

    return {
      noShowRate: stats.confirmedBookings > 0 ? (stats.noShowBookings / stats.confirmedBookings) * 100 : 0,
      cancellationRate: stats.totalBookings > 0 ? (stats.cancelledBookings / stats.totalBookings) * 100 : 0,
      guestSatisfaction: {
        averageRating: reviewData.averageRating || 0,
        npsScore: this.calculateNPS(reviewData.averageRating || 0),
        fiveStarPercentage: reviewData.totalReviews > 0 ? (reviewData.fiveStarReviews / reviewData.totalReviews) * 100 : 0
      }
    };
  }

  /**
   * Calculate floor-wise metrics
   */
  static async calculateFloorMetrics(hotelId, startDate, endDate) {
    const floorData = await Room.aggregate([
      {
        $match: {
          hotelId: new mongoose.Types.ObjectId(hotelId),
          isActive: true
        }
      },
      {
        $lookup: {
          from: 'bookings',
          let: { roomId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $in: ['$$roomId', '$rooms.roomId'] },
                status: { $in: ['confirmed', 'checked_in', 'checked_out'] },
                $or: [
                  { checkIn: { $gte: startDate, $lte: endDate } },
                  { checkOut: { $gte: startDate, $lte: endDate } },
                  { checkIn: { $lte: startDate }, checkOut: { $gte: endDate } }
                ]
              }
            }
          ],
          as: 'bookings'
        }
      },
      {
        $group: {
          _id: '$floor',
          roomRevenue: {
            $sum: {
              $reduce: {
                input: '$bookings',
                initialValue: 0,
                in: { $add: ['$$value', '$$this.totalAmount'] }
              }
            }
          },
          roomCount: { $sum: 1 }
        }
      }
    ]);

    return floorData.map(floor => ({
      floor: floor._id,
      roomRevenue: floor.roomRevenue || 0,
      directCosts: this.estimateFloorDirectCosts(floor.roomRevenue),
      allocatedOverheads: this.estimateFloorOverheads(floor.roomRevenue),
      floorProfit: 0 // Will be calculated in pre-save middleware
    }));
  }

  /**
   * Calculate operating expenses
   */
  static async calculateOperatingExpenses(hotelId, startDate, endDate) {
    // This would typically come from accounting system
    // For now, we'll estimate based on revenue percentages
    const revenueData = await this.calculateRevenueMetrics(hotelId, startDate, endDate);
    const totalRevenue = revenueData.totalRevenue;

    return {
      operatingExpenses: totalRevenue * 0.65, // Estimate 65% of revenue as operating expenses
      roomDirectCosts: totalRevenue * 0.15    // Estimate 15% as direct room costs
    };
  }

  /**
   * Helper methods
   */
  static getDateRange(date, period) {
    const targetDate = new Date(date);
    let startDate, endDate;

    switch (period) {
      case 'weekly':
        startDate = new Date(targetDate);
        startDate.setDate(targetDate.getDate() - targetDate.getDay());
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;

      case 'monthly':
        startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
        endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;

      case 'yearly':
        startDate = new Date(targetDate.getFullYear(), 0, 1);
        endDate = new Date(targetDate.getFullYear(), 11, 31);
        endDate.setHours(23, 59, 59, 999);
        break;

      default: // daily
        startDate = new Date(targetDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(targetDate);
        endDate.setHours(23, 59, 59, 999);
    }

    return { startDate, endDate };
  }

  static calculateNPS(averageRating) {
    // Convert 5-star rating to NPS scale (-100 to +100)
    if (averageRating >= 4.5) return 50 + ((averageRating - 4.5) * 100);
    if (averageRating >= 3.5) return 0 + ((averageRating - 3.5) * 50);
    return -50 + ((averageRating - 1) / 2.5 * 50);
  }

  static calculateRoomDirectCosts(roomNights) {
    // Estimate direct costs per room night (cleaning supplies, amenities, utilities)
    const costPerRoomNight = 200; // INR
    return roomNights * costPerRoomNight;
  }

  static estimateFloorDirectCosts(floorRevenue) {
    // Estimate floor direct costs as 12% of floor revenue
    return floorRevenue * 0.12;
  }

  static estimateFloorOverheads(floorRevenue) {
    // Estimate allocated overheads as 8% of floor revenue
    return floorRevenue * 0.08;
  }

  /**
   * Batch calculate KPIs for multiple dates
   */
  static async batchCalculateKPIs(hotelId, startDate, endDate, period = 'daily') {
    const dates = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    const results = [];
    for (const date of dates) {
      try {
        const kpi = await this.calculateKPIs(hotelId, date, period);
        results.push(kpi);
      } catch (error) {
        console.error(`Error calculating KPI for date ${date}:`, error);
      }
    }

    return results;
  }
}

export default KPICalculationService;