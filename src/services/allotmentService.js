import mongoose from 'mongoose';
import RoomTypeAllotment from '../models/RoomTypeAllotment.js';
import RoomType from '../models/RoomType.js';
import Booking from '../models/Booking.js';
import AuditLog from '../models/AuditLog.js';

class AllotmentService {
  /**
   * Create a new room type allotment configuration
   */
  async createAllotment(allotmentData, userId) {
    try {
      // Check if allotment already exists for this room type
      const existing = await RoomTypeAllotment.findOne({
        hotelId: allotmentData.hotelId,
        roomTypeId: allotmentData.roomTypeId,
        status: 'active'
      });

      if (existing) {
        throw new Error('Active allotment configuration already exists for this room type');
      }

      // Validate room type exists
      const roomType = await RoomType.findById(allotmentData.roomTypeId);
      if (!roomType) {
        throw new Error('Room type not found');
      }

      // Set default values
      const allotmentConfig = {
        ...allotmentData,
        createdBy: userId && mongoose.Types.ObjectId.isValid(userId) ? userId : null,
        updatedBy: userId && mongoose.Types.ObjectId.isValid(userId) ? userId : null,
        status: 'active'
      };

      // Create default channels if not provided
      if (!allotmentConfig.channels || allotmentConfig.channels.length === 0) {
        allotmentConfig.channels = this.getDefaultChannels();
      } else {
        // Ensure all channels have required fields
        allotmentConfig.channels = allotmentConfig.channels.map(channel => ({
          ...channel,
          isActive: channel.isActive !== undefined ? channel.isActive : true,
          priority: channel.priority || 1,
          commission: channel.commission || 0,
          markup: channel.markup || 0,
          restrictions: {
            minimumStay: 1,
            maximumStay: 30,
            closedToArrival: false,
            closedToDeparture: false,
            stopSell: false,
            ...channel.restrictions
          }
        }));
      }

      // Initialize default allocation rules
      if (!allotmentConfig.allocationRules || allotmentConfig.allocationRules.length === 0) {
        allotmentConfig.allocationRules = this.getDefaultAllocationRules(allotmentConfig.channels);
      }

      const allotment = new RoomTypeAllotment(allotmentConfig);
      await allotment.save();

      // Create initial allotments for the next 90 days
      await this.initializeAllotments(allotment._id, 90);

      // Log the creation
      try {
        await this.logAction(allotment._id, userId, 'created', { allotmentId: allotment._id });
      } catch (logError) {
        console.warn('Failed to log action:', logError.message);
      }

      return allotment;
    } catch (error) {
      throw new Error(`Failed to create allotment: ${error.message}`);
    }
  }

  /**
   * Get default channel configurations
   */
  getDefaultChannels() {
    return [
      {
        channelId: 'direct',
        channelName: 'Direct Booking',
        isActive: true,
        priority: 100,
        commission: 0,
        markup: 0,
        restrictions: {
          minimumStay: 1,
          maximumStay: 30,
          closedToArrival: false,
          closedToDeparture: false,
          stopSell: false
        }
      },
      {
        channelId: 'booking_com',
        channelName: 'Booking.com',
        isActive: true,
        priority: 80,
        commission: 15,
        markup: 5,
        restrictions: {
          minimumStay: 1,
          maximumStay: 21,
          closedToArrival: false,
          closedToDeparture: false,
          stopSell: false
        }
      },
      {
        channelId: 'expedia',
        channelName: 'Expedia',
        isActive: true,
        priority: 75,
        commission: 18,
        markup: 8,
        restrictions: {
          minimumStay: 1,
          maximumStay: 21,
          closedToArrival: false,
          closedToDeparture: false,
          stopSell: false
        }
      },
      {
        channelId: 'airbnb',
        channelName: 'Airbnb',
        isActive: false,
        priority: 60,
        commission: 12,
        markup: 10,
        restrictions: {
          minimumStay: 2,
          maximumStay: 30,
          closedToArrival: false,
          closedToDeparture: false,
          stopSell: false
        }
      }
    ];
  }

  /**
   * Get default allocation rules
   */
  getDefaultAllocationRules(channels) {
    return [
      {
        name: 'Default Percentage Distribution',
        type: 'percentage',
        isActive: true,
        priority: 1,
        conditions: {
          dateRange: {
            startDate: new Date(),
            endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
          }
        },
        allocation: {
          method: 'percentage',
          channels: channels.map(channel => ({
            channelId: channel.channelId,
            percentage: Math.floor(100 / channels.length)
          }))
        },
        fallbackRule: 'equal_distribution'
      }
    ];
  }

  /**
   * Initialize allotments for the next N days
   */
  async initializeAllotments(allotmentId, days = 90) {
    try {
      const allotment = await RoomTypeAllotment.findById(allotmentId);
      if (!allotment) {
        throw new Error('Allotment not found');
      }

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + days);

      // Create daily allotments for the date range
      const dailyAllotments = [];
      for (let currentDate = new Date(startDate); currentDate <= endDate; currentDate.setDate(currentDate.getDate() + 1)) {
        const dateStr = new Date(currentDate).toISOString().split('T')[0];
        
        // Create channel allocations for this day
        const channelAllotments = allotment.channels.map(channel => ({
          channelId: channel.channelId,
          channelName: channel.channelName,
          allocated: Math.floor(allotment.defaultSettings.totalInventory * 0.25), // Default 25% per channel
          sold: 0,
          available: Math.floor(allotment.defaultSettings.totalInventory * 0.25),
          blocked: 0,
          overbooking: 0,
          rate: 1000, // Default rate
          lastUpdated: new Date()
        }));

        const totalAllocated = channelAllotments.reduce((sum, ch) => sum + ch.allocated, 0);
        const totalSold = channelAllotments.reduce((sum, ch) => sum + ch.sold, 0);
        const occupancyRate = totalAllocated > 0 ? (totalSold / totalAllocated) * 100 : 0;

        dailyAllotments.push({
          date: new Date(currentDate),
          totalInventory: allotment.defaultSettings.totalInventory,
          channelAllotments,
          freeStock: allotment.defaultSettings.totalInventory - totalAllocated,
          totalSold,
          occupancyRate,
          isHoliday: false,
          isBlackout: false
        });
      }

      // Update the allotment with daily allotments
      allotment.dailyAllotments = dailyAllotments;
      
      // Calculate overall occupancy rate
      const totalOccupancy = dailyAllotments.reduce((sum, daily) => sum + daily.occupancyRate, 0);
      allotment.overallOccupancyRate = dailyAllotments.length > 0 ? totalOccupancy / dailyAllotments.length : 0;
      
      await allotment.save();

      return true;
    } catch (error) {
      throw new Error(`Failed to initialize allotments: ${error.message}`);
    }
  }

  /**
   * Calculate and apply allocation rules for a date range
   */
  async applyAllocationRule(allotmentId, ruleId, dateRange, userId = null) {
    try {
      const allotment = await RoomTypeAllotment.findById(allotmentId);
      if (!allotment) {
        throw new Error('Allotment not found');
      }

      const rule = allotment.allocationRules.find(r => r._id.toString() === ruleId && r.isActive);
      if (!rule) {
        throw new Error('Allocation rule not found or inactive');
      }

      const startDate = new Date(dateRange.startDate);
      const endDate = new Date(dateRange.endDate);
      let daysProcessed = 0;

      // Process each day in the range
      for (let currentDate = new Date(startDate); currentDate <= endDate; currentDate.setDate(currentDate.getDate() + 1)) {
        await this.calculateDayAllocation(allotment, rule, new Date(currentDate));
        daysProcessed++;
      }

      // Save the updated allotment
      await allotment.save();

      // Log the action
      if (userId) {
        await this.logAction(allotmentId, userId, 'allocated', {
          ruleId,
          dateRange,
          daysProcessed
        });
      }

      return { success: true, daysProcessed };
    } catch (error) {
      throw new Error(`Failed to apply allocation rule: ${error.message}`);
    }
  }

  /**
   * Calculate allocation for a specific date
   */
  async calculateDayAllocation(allotment, rule, date) {
    try {
      // Check if conditions match
      if (!this.checkRuleConditions(rule, date)) {
        return;
      }

      // Get existing allocation for the date
      let dailyAllotment = allotment.getAllotmentForDate(date);
      
      if (!dailyAllotment) {
        dailyAllotment = {
          date: new Date(date),
          totalInventory: allotment.defaultSettings.totalInventory,
          channelAllotments: [],
          freeStock: allotment.defaultSettings.totalInventory,
          totalSold: 0,
          occupancyRate: 0
        };
        allotment.dailyAllotments.push(dailyAllotment);
      }

      // Apply allocation based on rule type
      switch (rule.type) {
        case 'percentage':
          this.applyPercentageAllocation(allotment, dailyAllotment, rule);
          break;
        case 'fixed':
          this.applyFixedAllocation(allotment, dailyAllotment, rule);
          break;
        case 'priority':
          await this.applyPriorityAllocation(allotment, dailyAllotment, rule, date);
          break;
        case 'dynamic':
          await this.applyDynamicAllocation(allotment, dailyAllotment, rule, date);
          break;
      }

      // Update totals
      allotment.updateTotals(dailyAllotment);
      
    } catch (error) {
      throw new Error(`Failed to calculate day allocation: ${error.message}`);
    }
  }

  /**
   * Check if rule conditions match for a given date
   */
  checkRuleConditions(rule, date) {
    const conditions = rule.conditions;

    // Check date range
    if (conditions.dateRange) {
      if (conditions.dateRange.startDate && date < new Date(conditions.dateRange.startDate)) {
        return false;
      }
      if (conditions.dateRange.endDate && date > new Date(conditions.dateRange.endDate)) {
        return false;
      }
    }

    // Check days of week
    if (conditions.daysOfWeek && conditions.daysOfWeek.length > 0) {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayOfWeek = dayNames[date.getDay()];
      if (!conditions.daysOfWeek.includes(dayOfWeek)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Apply percentage-based allocation
   */
  applyPercentageAllocation(allotment, dailyAllotment, rule) {
    const totalInventory = dailyAllotment.totalInventory;
    
    rule.allocation.percentage.forEach((percentage, channelId) => {
      const allocated = Math.floor((totalInventory * percentage) / 100);
      this.updateChannelAllocation(allotment, dailyAllotment, channelId, { allocated });
    });
  }

  /**
   * Apply fixed allocation
   */
  applyFixedAllocation(allotment, dailyAllotment, rule) {
    rule.allocation.fixed.forEach((amount, channelId) => {
      this.updateChannelAllocation(allotment, dailyAllotment, channelId, { allocated: amount });
    });
  }

  /**
   * Apply priority-based allocation
   */
  async applyPriorityAllocation(allotment, dailyAllotment, rule, date) {
    const totalInventory = dailyAllotment.totalInventory;
    const priorities = rule.allocation.priority.sort((a, b) => b.priority - a.priority);
    
    let remainingInventory = totalInventory;

    for (const priorityRule of priorities) {
      const { channelId, minAllocation, maxAllocation } = priorityRule;
      
      // Get channel performance metrics
      const performance = await this.getChannelPerformance(allotment._id, channelId, date);
      
      // Calculate allocation based on performance and priority
      let allocation = Math.min(
        maxAllocation || remainingInventory,
        Math.max(
          minAllocation || 0,
          Math.floor(remainingInventory * (performance.utilizationRate / 100))
        )
      );

      allocation = Math.min(allocation, remainingInventory);
      
      this.updateChannelAllocation(allotment, dailyAllotment, channelId, { allocated: allocation });
      remainingInventory -= allocation;

      if (remainingInventory <= 0) break;
    }
  }

  /**
   * Apply dynamic allocation based on demand forecasting
   */
  async applyDynamicAllocation(allotment, dailyAllotment, rule, date) {
    try {
      // Get historical data and forecasting
      const forecast = await this.getDemandForecast(allotment._id, date);
      const totalInventory = dailyAllotment.totalInventory;
      
      let remainingInventory = totalInventory;
      const allocations = {};

      // Allocate based on forecasted demand
      for (const channelId of allotment.channels.map(c => c.channelId)) {
        const channelForecast = forecast.channels.find(c => c.channelId === channelId);
        if (channelForecast) {
          const demandPercentage = channelForecast.demandScore / forecast.totalDemandScore;
          let allocation = Math.floor(totalInventory * demandPercentage);
          
          // Apply min/max constraints
          const channel = allotment.channels.find(c => c.channelId === channelId);
          if (channel && channel.restrictions) {
            allocation = Math.max(0, Math.min(allocation, remainingInventory));
          }

          allocations[channelId] = allocation;
          remainingInventory -= allocation;
        }
      }

      // Apply allocations
      Object.entries(allocations).forEach(([channelId, allocated]) => {
        this.updateChannelAllocation(allotment, dailyAllotment, channelId, { allocated });
      });

    } catch (error) {
      // Fallback to percentage allocation if dynamic fails
      console.warn(`Dynamic allocation failed, falling back to percentage: ${error.message}`);
      const fallbackRule = {
        type: 'percentage',
        allocation: {
          percentage: new Map([
            ['direct', 40],
            ['booking_com', 35],
            ['expedia', 25]
          ])
        }
      };
      this.applyPercentageAllocation(allotment, dailyAllotment, fallbackRule);
    }
  }

  /**
   * Update channel allocation within daily allotment
   */
  updateChannelAllocation(allotment, dailyAllotment, channelId, updates) {
    let channelAllocation = dailyAllotment.channelAllotments.find(c => c.channelId === channelId);
    
    if (!channelAllocation) {
      channelAllocation = {
        channelId,
        allocated: 0,
        sold: 0,
        available: 0,
        blocked: 0,
        overbooking: 0,
        lastUpdated: new Date()
      };
      dailyAllotment.channelAllotments.push(channelAllocation);
    }

    Object.assign(channelAllocation, updates);
    channelAllocation.available = channelAllocation.allocated - channelAllocation.sold - channelAllocation.blocked;
    channelAllocation.lastUpdated = new Date();
  }

  /**
   * Process booking and update allocations
   */
  async processBooking(bookingData) {
    try {
      const { hotelId, roomTypeId, checkIn, checkOut, channelId, rooms = 1 } = bookingData;

      const allotment = await RoomTypeAllotment.findOne({
        hotelId,
        roomTypeId,
        status: 'active'
      });

      if (!allotment) {
        throw new Error('No active allotment found for this room type');
      }

      // Update allocations for each night
      const startDate = new Date(checkIn);
      const endDate = new Date(checkOut);
      const nights = [];

      for (let date = new Date(startDate); date < endDate; date.setDate(date.getDate() + 1)) {
        const dailyAllotment = allotment.getAllotmentForDate(date);
        
        if (!dailyAllotment) {
          throw new Error(`No allocation found for date: ${date.toDateString()}`);
        }

        const channelAllocation = dailyAllotment.channelAllotments.find(c => c.channelId === channelId);
        
        if (!channelAllocation) {
          throw new Error(`No allocation found for channel: ${channelId}`);
        }

        if (channelAllocation.available < rooms) {
          // Check if overbooking is allowed
          if (!allotment.defaultSettings.overbookingAllowed) {
            throw new Error(`Insufficient inventory for ${date.toDateString()}. Available: ${channelAllocation.available}, Requested: ${rooms}`);
          }
          
          if (channelAllocation.overbooking + rooms > allotment.defaultSettings.overbookingLimit) {
            throw new Error(`Overbooking limit exceeded for ${date.toDateString()}`);
          }

          // Allow overbooking
          channelAllocation.overbooking += rooms;
        } else {
          channelAllocation.sold += rooms;
        }

        channelAllocation.available = channelAllocation.allocated - channelAllocation.sold - channelAllocation.blocked;
        channelAllocation.lastUpdated = new Date();
        
        allotment.updateTotals(dailyAllotment);
        nights.push(new Date(date));
      }

      await allotment.save();

      // Log the booking
      await this.logAction(allotment._id, null, 'booked', {
        channelId,
        rooms,
        nights: nights.length,
        dates: nights
      });

      return { success: true, message: 'Booking processed successfully' };

    } catch (error) {
      throw new Error(`Failed to process booking: ${error.message}`);
    }
  }

  /**
   * Release rooms (cancellation)
   */
  async releaseRooms(releaseData) {
    try {
      const { hotelId, roomTypeId, checkIn, checkOut, channelId, rooms = 1, userId } = releaseData;

      const allotment = await RoomTypeAllotment.findOne({
        hotelId,
        roomTypeId,
        status: 'active'
      });

      if (!allotment) {
        throw new Error('No active allotment found for this room type');
      }

      // Release rooms for each night
      const startDate = new Date(checkIn);
      const endDate = new Date(checkOut);
      const nights = [];

      for (let date = new Date(startDate); date < endDate; date.setDate(date.getDate() + 1)) {
        const dailyAllotment = allotment.getAllotmentForDate(date);
        
        if (dailyAllotment) {
          const channelAllocation = dailyAllotment.channelAllotments.find(c => c.channelId === channelId);
          
          if (channelAllocation) {
            // First release from overbooking, then from sold
            const overbookingToRelease = Math.min(channelAllocation.overbooking, rooms);
            const soldToRelease = Math.min(channelAllocation.sold, rooms - overbookingToRelease);

            channelAllocation.overbooking -= overbookingToRelease;
            channelAllocation.sold -= soldToRelease;
            channelAllocation.available = channelAllocation.allocated - channelAllocation.sold - channelAllocation.blocked;
            channelAllocation.lastUpdated = new Date();
            
            allotment.updateTotals(dailyAllotment);
            nights.push(new Date(date));
          }
        }
      }

      await allotment.save();

      // Log the release
      await this.logAction(allotment._id, userId, 'released', {
        channelId,
        rooms,
        nights: nights.length,
        dates: nights
      });

      return { success: true, message: 'Rooms released successfully' };

    } catch (error) {
      throw new Error(`Failed to release rooms: ${error.message}`);
    }
  }

  /**
   * Get channel performance metrics
   */
  async getChannelPerformance(allotmentId, channelId, referenceDate) {
    try {
      const allotment = await RoomTypeAllotment.findById(allotmentId);
      if (!allotment) {
        return { utilizationRate: 50, conversionRate: 20, averageRate: 100 }; // Default values
      }

      // Look for recent performance data
      const recentMetrics = allotment.performanceMetrics
        .flatMap(period => period.channelMetrics)
        .filter(metric => metric.channelId === channelId)
        .sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated))
        .slice(0, 3);

      if (recentMetrics.length > 0) {
        const avgUtilization = recentMetrics.reduce((sum, m) => sum + m.utilizationRate, 0) / recentMetrics.length;
        const avgConversion = recentMetrics.reduce((sum, m) => sum + m.conversionRate, 0) / recentMetrics.length;
        const avgRate = recentMetrics.reduce((sum, m) => sum + m.averageRate, 0) / recentMetrics.length;

        return {
          utilizationRate: avgUtilization,
          conversionRate: avgConversion,
          averageRate: avgRate
        };
      }

      // Fallback to historical data from daily allotments
      const historicalData = allotment.dailyAllotments
        .filter(day => new Date(day.date) < referenceDate)
        .slice(-30) // Last 30 days
        .map(day => day.channelAllotments.find(c => c.channelId === channelId))
        .filter(Boolean);

      if (historicalData.length > 0) {
        const avgUtilization = historicalData.reduce((sum, c) => {
          return sum + (c.allocated > 0 ? (c.sold / c.allocated) * 100 : 0);
        }, 0) / historicalData.length;

        return {
          utilizationRate: avgUtilization,
          conversionRate: Math.max(10, avgUtilization * 0.8), // Estimated
          averageRate: 100 // Default rate
        };
      }

      return { utilizationRate: 50, conversionRate: 20, averageRate: 100 };
    } catch (error) {
      return { utilizationRate: 50, conversionRate: 20, averageRate: 100 };
    }
  }

  /**
   * Get demand forecast for dynamic allocation
   */
  async getDemandForecast(allotmentId, date) {
    try {
      // This is a simplified forecast - in production, this would use ML models
      const allotment = await RoomTypeAllotment.findById(allotmentId);
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      // Base demand scores (higher = more demand)
      const baseDemand = {
        direct: isWeekend ? 60 : 40,
        booking_com: isWeekend ? 80 : 70,
        expedia: isWeekend ? 70 : 60,
        airbnb: isWeekend ? 90 : 50
      };

      // Adjust based on historical performance
      const channels = [];
      let totalDemandScore = 0;

      for (const channel of allotment.channels) {
        if (channel.isActive) {
          const performance = await this.getChannelPerformance(allotmentId, channel.channelId, date);
          const demandScore = baseDemand[channel.channelId] || 50;
          const adjustedScore = demandScore * (1 + (performance.utilizationRate - 50) / 100);
          
          channels.push({
            channelId: channel.channelId,
            demandScore: Math.max(10, adjustedScore)
          });
          
          totalDemandScore += adjustedScore;
        }
      }

      return { channels, totalDemandScore };
    } catch (error) {
      // Fallback forecast
      return {
        channels: [
          { channelId: 'direct', demandScore: 40 },
          { channelId: 'booking_com', demandScore: 35 },
          { channelId: 'expedia', demandScore: 25 }
        ],
        totalDemandScore: 100
      };
    }
  }

  /**
   * Generate performance analytics
   */
  async generateAnalytics(allotmentId, period) {
    try {
      const allotment = await RoomTypeAllotment.findById(allotmentId);
      if (!allotment) {
        throw new Error('Allotment not found');
      }

      const startDate = new Date(period.startDate);
      const endDate = new Date(period.endDate);

      // For now, generate analytics based on allotment data only
      // This avoids dependency on booking data which might not exist
      console.log('Generating analytics for allotment:', allotmentId, 'period:', period);
      console.log('Start date:', startDate, 'End date:', endDate);

      // Calculate metrics by channel based on allotment data
      const channelMetrics = [];
      
      for (const channel of allotment.channels) {
        if (channel.isActive) {
          // Get allocated rooms for the period
          let periodAllotments = allotment.dailyAllotments.filter(day => {
            const dayDate = new Date(day.date);
            return dayDate >= startDate && dayDate <= endDate;
          });
          
          // If no data found in the requested period, use all available data
          if (periodAllotments.length === 0) {
            console.log(`No data found in requested period, using all available data`);
            periodAllotments = allotment.dailyAllotments;
          }
          
          console.log(`Channel ${channel.channelId}: Found ${periodAllotments.length} days in period`);

          const totalAllocated = periodAllotments.reduce((sum, day) => {
            const channelAllotment = day.channelAllotments.find(c => c.channelId === channel.channelId);
            return sum + (channelAllotment ? channelAllotment.allocated : 0);
          }, 0);

          const totalSold = periodAllotments.reduce((sum, day) => {
            const channelAllotment = day.channelAllotments.find(c => c.channelId === channel.channelId);
            return sum + (channelAllotment ? channelAllotment.sold : 0);
          }, 0);

          const totalRevenue = periodAllotments.reduce((sum, day) => {
            const channelAllotment = day.channelAllotments.find(c => c.channelId === channel.channelId);
            return sum + (channelAllotment ? (channelAllotment.sold * (channelAllotment.rate || 1000)) : 0);
          }, 0);

          channelMetrics.push({
            channelId: channel.channelId,
            totalAllocated,
            totalSold,
            totalRevenue,
            averageRate: totalSold > 0 ? totalRevenue / totalSold : 0,
            utilizationRate: totalAllocated > 0 ? (totalSold / totalAllocated) * 100 : 0,
            conversionRate: totalAllocated > 0 ? (totalSold / totalAllocated) * 100 : 0,
            leadTime: 7, // Default lead time in days
            cancellationRate: 5, // Default cancellation rate
            noShowRate: 2, // Default no-show rate
            revenuePerAvailableRoom: totalAllocated > 0 ? totalRevenue / totalAllocated : 0
          });
        }
      }

      // Calculate overall metrics
      let periodAllotments = allotment.dailyAllotments.filter(day => {
        const dayDate = new Date(day.date);
        return dayDate >= startDate && dayDate <= endDate;
      });
      
      // If no data found in the requested period, use all available data
      if (periodAllotments.length === 0) {
        periodAllotments = allotment.dailyAllotments;
      }

      const overallMetrics = {
        totalInventory: periodAllotments.reduce((sum, day) => sum + day.totalInventory, 0),
        totalSold: periodAllotments.reduce((sum, day) => sum + day.totalSold, 0),
        totalRevenue: channelMetrics.reduce((sum, channel) => sum + channel.totalRevenue, 0),
        averageOccupancyRate: periodAllotments.length > 0 ? 
          periodAllotments.reduce((sum, day) => sum + day.occupancyRate, 0) / periodAllotments.length : 0
      };

      overallMetrics.revenuePerAvailableRoom = overallMetrics.totalInventory > 0 ? 
        overallMetrics.totalRevenue / overallMetrics.totalInventory : 0;
      overallMetrics.averageDailyRate = overallMetrics.totalSold > 0 ? 
        overallMetrics.totalRevenue / overallMetrics.totalSold : 0;

      const performanceMetrics = {
        period: { startDate, endDate },
        channelMetrics,
        overallMetrics
      };

      // For now, just return the metrics without saving to allotment
      // TODO: Implement addPerformanceMetrics and generateRecommendations methods

      // Transform to match frontend expected format
      return {
        summary: {
          averageOccupancy: overallMetrics.averageOccupancyRate,
          totalRevenue: overallMetrics.totalRevenue,
          totalBookings: overallMetrics.totalSold,
          occupancyTrend: 5.2, // TODO: Calculate actual trend
          revenueTrend: 8.1, // TODO: Calculate actual trend
          bookingsTrend: 12.3, // TODO: Calculate actual trend
          topChannel: channelMetrics.length > 0 ? {
            name: channelMetrics[0].channelId.replace('_', ' '),
            occupancy: channelMetrics[0].utilizationRate
          } : { name: 'No Data', occupancy: 0 }
        },
        dailyPerformance: periodAllotments.map(day => ({
          date: day.date,
          occupancy: day.occupancyRate,
          revenue: day.channelAllotments.reduce((sum, ch) => sum + (ch.sold * (ch.rate || 1000)), 0)
        })),
        channelPerformance: channelMetrics.map(channel => ({
          channelName: channel.channelId.replace('_', ' '),
          occupancy: channel.utilizationRate,
          revenue: channel.totalRevenue,
          bookings: channel.totalSold,
          adr: channel.averageRate,
          commission: 15 // Default commission
        })),
        utilizationByDay: this.calculateUtilizationByDay(periodAllotments),
        leadTimeDistribution: await this.calculateLeadTimeDistribution(periodAllotments, allotment.hotelId),
        seasonalPatterns: this.calculateSeasonalPatterns(periodAllotments),
        bookingPatterns: this.calculateBookingPatterns(periodAllotments),
        recommendations: this.generateRecommendations(channelMetrics, overallMetrics),
        channelEfficiency: channelMetrics.map(channel => ({
          channelName: channel.channelId.replace('_', ' '),
          revenuePerBooking: channel.averageRate
        })),
        allocationEfficiency: this.calculateAllocationEfficiency(channelMetrics)
      };
    } catch (error) {
      throw new Error(`Failed to generate analytics: ${error.message}`);
    }
  }

  /**
   * Calculate utilization by day of week
   */
  calculateUtilizationByDay(periodAllotments) {
    const dayUtilization = {
      'Mon': [], 'Tue': [], 'Wed': [], 'Thu': [], 'Fri': [], 'Sat': [], 'Sun': []
    };
    
    periodAllotments.forEach(day => {
      const dayOfWeek = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' });
      if (dayUtilization[dayOfWeek]) {
        dayUtilization[dayOfWeek].push(day.occupancyRate);
      }
    });
    
    return Object.entries(dayUtilization).map(([day, rates]) => ({
      day,
      utilization: rates.length > 0 ? Math.round(rates.reduce((sum, rate) => sum + rate, 0) / rates.length) : 0
    }));
  }

  /**
   * Calculate lead time distribution based on real booking data
   */
  async calculateLeadTimeDistribution(periodAllotments, hotelId) {
    try {
      // Get all bookings for the hotel from the last 90 days for analysis
      const analysisStartDate = new Date();
      analysisStartDate.setDate(analysisStartDate.getDate() - 90);

      const bookings = await Booking.find({
        hotelId: new mongoose.Types.ObjectId(hotelId),
        createdAt: { $gte: analysisStartDate },
        status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
      }).select('createdAt checkIn');

      if (bookings.length === 0) {
        // Fallback to estimated distribution if no booking data available
        const totalBookings = periodAllotments.reduce((sum, day) => sum + day.totalSold, 0);
        return [
          { name: 'Same Day', count: Math.round(totalBookings * 0.1) },
          { name: '1-3 Days', count: Math.round(totalBookings * 0.3) },
          { name: '1 Week', count: Math.round(totalBookings * 0.4) },
          { name: '2+ Weeks', count: Math.round(totalBookings * 0.2) }
        ];
      }

      // Calculate actual lead times
      const leadTimeCategories = {
        'Same Day': 0,
        '1-3 Days': 0,
        '1 Week': 0,
        '2+ Weeks': 0
      };

      bookings.forEach(booking => {
        const leadTimeDays = Math.floor((booking.checkIn - booking.createdAt) / (1000 * 60 * 60 * 24));

        if (leadTimeDays === 0) {
          leadTimeCategories['Same Day']++;
        } else if (leadTimeDays >= 1 && leadTimeDays <= 3) {
          leadTimeCategories['1-3 Days']++;
        } else if (leadTimeDays >= 4 && leadTimeDays <= 7) {
          leadTimeCategories['1 Week']++;
        } else {
          leadTimeCategories['2+ Weeks']++;
        }
      });

      return [
        { name: 'Same Day', count: leadTimeCategories['Same Day'] },
        { name: '1-3 Days', count: leadTimeCategories['1-3 Days'] },
        { name: '1 Week', count: leadTimeCategories['1 Week'] },
        { name: '2+ Weeks', count: leadTimeCategories['2+ Weeks'] }
      ];

    } catch (error) {
      console.error('Error calculating lead time distribution:', error);
      // Fallback to estimated distribution on error
      const totalBookings = periodAllotments.reduce((sum, day) => sum + day.totalSold, 0);
      return [
        { name: 'Same Day', count: Math.round(totalBookings * 0.1) },
        { name: '1-3 Days', count: Math.round(totalBookings * 0.3) },
        { name: '1 Week', count: Math.round(totalBookings * 0.4) },
        { name: '2+ Weeks', count: Math.round(totalBookings * 0.2) }
      ];
    }
  }

  /**
   * Calculate seasonal patterns
   */
  calculateSeasonalPatterns(periodAllotments) {
    const monthlyData = {};
    
    periodAllotments.forEach(day => {
      const month = new Date(day.date).toLocaleDateString('en-US', { month: 'short' });
      if (!monthlyData[month]) {
        monthlyData[month] = [];
      }
      monthlyData[month].push(day.occupancyRate);
    });
    
    return Object.entries(monthlyData).map(([month, rates]) => ({
      month,
      occupancy: rates.length > 0 ? Math.round(rates.reduce((sum, rate) => sum + rate, 0) / rates.length) : 0
    }));
  }

  /**
   * Calculate booking patterns by day of week
   */
  calculateBookingPatterns(periodAllotments) {
    const dayBookings = {
      'Mon': [], 'Tue': [], 'Wed': [], 'Thu': [], 'Fri': [], 'Sat': [], 'Sun': []
    };
    
    periodAllotments.forEach(day => {
      const dayOfWeek = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' });
      if (dayBookings[dayOfWeek]) {
        dayBookings[dayOfWeek].push(day.totalSold);
      }
    });
    
    return Object.entries(dayBookings).map(([day, bookings]) => ({
      day,
      bookings: bookings.length > 0 ? Math.round(bookings.reduce((sum, count) => sum + count, 0) / bookings.length) : 0
    }));
  }

  /**
   * Calculate allocation efficiency by method
   */
  calculateAllocationEfficiency(channelMetrics) {
    // Calculate efficiency based on actual utilization rates
    const totalUtilization = channelMetrics.reduce((sum, channel) => sum + channel.utilizationRate, 0);
    const averageUtilization = channelMetrics.length > 0 ? totalUtilization / channelMetrics.length : 0;
    
    return [
      { 
        method: 'percentage', 
        efficiency: Math.round(averageUtilization * 0.9) // Slightly lower than average
      },
      { 
        method: 'fixed', 
        efficiency: Math.round(averageUtilization * 0.8) // Lower than percentage
      },
      { 
        method: 'dynamic', 
        efficiency: Math.round(averageUtilization * 1.1) // Higher than average
      }
    ];
  }

  /**
   * Generate recommendations based on real data
   */
  generateRecommendations(channelMetrics, overallMetrics) {
    const recommendations = [];
    
    // Find best performing channel
    const bestChannel = channelMetrics.reduce((best, channel) => 
      channel.utilizationRate > best.utilizationRate ? channel : best, channelMetrics[0]);
    
    // Find underperforming channels
    const underperformingChannels = channelMetrics.filter(channel => 
      channel.utilizationRate < 50 && channel.totalAllocated > 0);
    
    if (bestChannel && bestChannel.utilizationRate > 70) {
      recommendations.push({
        type: 'increase_allocation',
        priority: 'high',
        impact: `Increase allocation for ${bestChannel.channelId} channel`,
        confidence: Math.min(95, 60 + bestChannel.utilizationRate),
        expectedImpact: `Revenue increase of ₹${Math.round(bestChannel.totalRevenue * 0.1).toLocaleString()}-${Math.round(bestChannel.totalRevenue * 0.2).toLocaleString()}`
      });
    }
    
    if (underperformingChannels.length > 0) {
      underperformingChannels.forEach(channel => {
        recommendations.push({
          type: 'optimize_channel',
          priority: 'medium',
          impact: `Optimize ${channel.channelId} channel performance`,
          confidence: 75,
          expectedImpact: `Potential revenue increase of ₹${Math.round(channel.totalAllocated * channel.averageRate * 0.2).toLocaleString()}`
        });
      });
    }
    
    if (overallMetrics.averageOccupancyRate < 60) {
      recommendations.push({
        type: 'improve_occupancy',
        priority: 'high',
        impact: 'Overall occupancy is below target',
        confidence: 90,
        expectedImpact: `Revenue increase of ₹${Math.round(overallMetrics.totalRevenue * 0.3).toLocaleString()} with 20% occupancy improvement`
      });
    }
    
    return recommendations.length > 0 ? recommendations : [{
      type: 'maintain_performance',
      priority: 'low',
      impact: 'Current performance is optimal',
      confidence: 85,
      expectedImpact: 'Continue current strategy'
    }];
  }

  /**
   * Calculate average lead time for bookings
   */
  calculateAverageLeadTime(bookings) {
    if (bookings.length === 0) return 0;

    const leadTimes = bookings.map(booking => {
      const bookingDate = new Date(booking.createdAt);
      const checkInDate = new Date(booking.checkIn);
      const diffTime = Math.abs(checkInDate - bookingDate);
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Convert to days
    });

    return leadTimes.reduce((sum, time) => sum + time, 0) / leadTimes.length;
  }

  /**
   * Calculate cancellation rate for a channel
   */
  async calculateCancellationRate(channelId, startDate, endDate) {
    try {
      const totalBookings = await Booking.countDocuments({
        source: channelId,
        createdAt: { $gte: startDate, $lte: endDate }
      });

      const cancelledBookings = await Booking.countDocuments({
        source: channelId,
        status: 'cancelled',
        createdAt: { $gte: startDate, $lte: endDate }
      });

      return totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Calculate no-show rate
   */
  calculateNoShowRate(bookings) {
    if (bookings.length === 0) return 0;

    const noShows = bookings.filter(booking => booking.status === 'no_show').length;
    return (noShows / bookings.length) * 100;
  }

  /**
   * Optimize allocations based on performance
   */
  async optimizeAllocations(allotmentId, userId) {
    try {
      const allotment = await RoomTypeAllotment.findById(allotmentId);
      if (!allotment) {
        throw new Error('Allotment not found');
      }

      // Generate current analytics
      const lastWeek = {
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      };

      const analytics = await this.generateAnalytics(allotmentId, lastWeek);
      
      // Check if we have channel performance data
      if (!analytics || !analytics.channelPerformance || analytics.channelPerformance.length === 0) {
        // If no performance data, create a default balanced allocation
        const defaultRule = {
          name: `Default Balanced Allocation - ${new Date().toLocaleDateString()}`,
          type: 'percentage',
          isActive: false,
          conditions: {
            dateRange: {
              startDate: new Date(),
              endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            }
          },
          allocation: {
            percentage: {
              direct: 40,
              booking_com: 35,
              expedia: 25
            }
          },
          fallbackRule: 'revenue_optimization'
        };

        allotment.allocationRules.push(defaultRule);
        await allotment.save();

        return { success: true, optimizedRule: defaultRule, message: 'Created default allocation due to insufficient data' };
      }

      // Create optimized allocation rule based on performance
      const optimizedPercentages = new Map();
      let totalPercentage = 100;

      // Sort channels by revenue per available room
      const sortedChannels = analytics.channelPerformance
        .sort((a, b) => (b.revenue || 0) - (a.revenue || 0));

      // Allocate higher percentages to better performing channels
      sortedChannels.forEach((channel, index) => {
        let percentage;
        const occupancy = channel.occupancy || 0; // Use occupancy with fallback to 0

        if (index === 0) {
          percentage = Math.min(50, 30 + occupancy * 0.2); // Top performer gets 30-50%
        } else if (index === 1) {
          percentage = Math.min(35, 25 + occupancy * 0.1); // Second gets 25-35%
        } else {
          percentage = Math.max(15, totalPercentage / (sortedChannels.length - index)); // Others split remainder
        }

        // Ensure percentage is a valid number
        percentage = isNaN(percentage) ? 30 : percentage;

        const channelKey = channel.channelName.replace(' ', '_').toLowerCase();
        optimizedPercentages.set(channelKey, Math.round(percentage));
        totalPercentage -= percentage;
      });

      // Normalize percentages to ensure they sum to 100
      let totalAllocated = 0;
      optimizedPercentages.forEach(value => totalAllocated += value);

      if (totalAllocated !== 100) {
        const scaleFactor = 100 / totalAllocated;
        optimizedPercentages.forEach((value, key) => {
          optimizedPercentages.set(key, Math.round(value * scaleFactor));
        });
      }

      // Ensure all required channels have allocations
      const finalPercentages = {};
      const channels = ['direct', 'booking_com', 'expedia'];
      let remainingPercentage = 100;

      channels.forEach((channelKey, index) => {
        if (optimizedPercentages.has(channelKey)) {
          finalPercentages[channelKey] = optimizedPercentages.get(channelKey);
        } else {
          // Default distribution if channel wasn't in performance data
          if (index === channels.length - 1) {
            finalPercentages[channelKey] = remainingPercentage;
          } else {
            finalPercentages[channelKey] = Math.floor(100 / channels.length);
          }
        }
        remainingPercentage -= finalPercentages[channelKey];
      });

      // Create new optimized rule
      const optimizedRule = {
        name: `Optimized Allocation - ${new Date().toLocaleDateString()}`,
        type: 'percentage',
        isActive: false, // Don't activate automatically
        conditions: {
          dateRange: {
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Next 30 days
          }
        },
        allocation: {
          percentage: finalPercentages
        },
        fallbackRule: 'revenue_optimization'
      };

      allotment.allocationRules.push(optimizedRule);
      await allotment.save();

      // Log the optimization
      await this.logAction(allotmentId, userId, 'updated', {
        ruleId: optimizedRule._id,
        optimizedPercentages: finalPercentages,
        reason: 'Allocation optimized based on performance'
      });

      return { success: true, optimizedRule };
    } catch (error) {
      throw new Error(`Failed to optimize allocations: ${error.message}`);
    }
  }

  /**
   * Get dashboard data for allotments overview
   */
  async getDashboard(hotelId, params = {}) {
    try {
      console.log('🔍 [AllotmentService] getDashboard called with hotelId:', hotelId);

      // Get all allotments for the hotel
      const allotments = await RoomTypeAllotment.find({ hotelId })
        .populate('roomTypeId', 'name code baseRate')
        .lean();

      console.log('📊 [AllotmentService] Found allotments:', allotments.length);

      // Calculate dashboard metrics
      const totalAllotments = allotments.length;

      // Get unique room types
      const uniqueRoomTypes = new Set(allotments.map(a => a.roomTypeId?._id?.toString()));
      const totalRoomTypes = uniqueRoomTypes.size;

      // Get unique channels from the allotment channels array
      const uniqueChannels = new Set();
      allotments.forEach(allotment => {
        if (allotment.channels) {
          allotment.channels.forEach(channel => {
            uniqueChannels.add(channel.channelId);
          });
        }
      });
      const totalChannels = uniqueChannels.size;

      // Calculate occupancy and revenue from analytics data
      let totalOccupancy = 0;
      let totalRevenue = 0;
      let channelPerformance = {};
      let occupancyCount = 0;

      allotments.forEach(allotment => {
        // Use analytics data for metrics
        if (allotment.performanceMetrics && allotment.performanceMetrics.length > 0) {
          const latestMetrics = allotment.performanceMetrics[allotment.performanceMetrics.length - 1];

          if (latestMetrics.overallMetrics?.totalRevenue) {
            totalRevenue += latestMetrics.overallMetrics.totalRevenue;
          }

          if (latestMetrics.overallMetrics?.averageOccupancyRate) {
            totalOccupancy += latestMetrics.overallMetrics.averageOccupancyRate;
            occupancyCount++;
          }

          // Process channel performance from analytics
          if (latestMetrics.channelMetrics) {
            latestMetrics.channelMetrics.forEach(channel => {
              if (!channelPerformance[channel.channelId]) {
                channelPerformance[channel.channelId] = {
                  channelId: channel.channelId,
                  channelName: channel.channelId.replace('_', '.'),
                  totalSold: 0,
                  totalRevenue: 0,
                  totalAllocated: 0
                };
              }
              channelPerformance[channel.channelId].totalSold += channel.totalSold || 0;
              channelPerformance[channel.channelId].totalRevenue += channel.totalRevenue || 0;
              channelPerformance[channel.channelId].totalAllocated += channel.totalAllocated || 0;
            });
          }
        }

        // Also check channels array for performance data
        if (allotment.channels) {
          allotment.channels.forEach(channel => {
            if (!channelPerformance[channel.channelId]) {
              channelPerformance[channel.channelId] = {
                channelId: channel.channelId,
                channelName: channel.channelName || channel.channelId.replace('_', '.'),
                totalSold: 0,
                totalRevenue: 0,
                totalAllocated: 0
              };
            }
          });
        }

        // Extract data from dailyAllotments if available
        if (allotment.dailyAllotments && allotment.dailyAllotments.length > 0) {
          allotment.dailyAllotments.forEach(dailyAllotment => {
            if (dailyAllotment.channelAllotments) {
              dailyAllotment.channelAllotments.forEach(channelData => {
                if (!channelPerformance[channelData.channelId]) {
                  channelPerformance[channelData.channelId] = {
                    channelId: channelData.channelId,
                    channelName: channelData.channelName || channelData.channelId.replace('_', '.'),
                    totalSold: 0,
                    totalRevenue: 0,
                    totalAllocated: 0
                  };
                }

                // Add up the metrics
                channelPerformance[channelData.channelId].totalSold += channelData.sold || 0;
                channelPerformance[channelData.channelId].totalAllocated += channelData.allocated || 0;
                if (channelData.rate) {
                  channelPerformance[channelData.channelId].totalRevenue += (channelData.sold || 0) * channelData.rate;
                }
              });
            }
          });
        }
      });

      const averageOccupancyRate = occupancyCount > 0 ? totalOccupancy / occupancyCount : 0;

      // Calculate utilizationRate for all channels and find top performing channel
      const channelList = Object.values(channelPerformance).map(channel => ({
        ...channel,
        utilizationRate: channel.totalAllocated > 0 ? (channel.totalSold / channel.totalAllocated) * 100 : 0
      }));

      const topPerformingChannel = channelList.length > 0
        ? channelList.reduce((top, channel) =>
            channel.totalRevenue > (top?.totalRevenue || 0) ? channel : top
          )
        : null;

      // Find low utilization channels (less than 50% occupancy)
      const lowUtilizationChannels = channelList.filter(channel => {
        return channel.utilizationRate < 50 && channel.totalAllocated > 0;
      });

      // Get recent recommendations from allotments
      const recentRecommendations = [];
      allotments.forEach(allotment => {
        if (allotment.analytics?.recommendations) {
          recentRecommendations.push(...allotment.analytics.recommendations.slice(0, 2));
        }
      });

      const dashboardData = {
        totalAllotments,
        totalRoomTypes,
        totalChannels,
        averageOccupancyRate: Math.round(averageOccupancyRate * 100) / 100,
        totalRevenue,
        topPerformingChannel,
        lowUtilizationChannels: lowUtilizationChannels.slice(0, 5), // Limit to 5
        recentRecommendations: recentRecommendations.slice(0, 5) // Limit to 5
      };

      console.log('✅ [AllotmentService] Returning dashboard data:', dashboardData);

      return dashboardData;
    } catch (error) {
      console.error('❌ [AllotmentService] Error fetching dashboard data:', error);
      throw new Error(`Failed to fetch dashboard data: ${error.message}`);
    }
  }

  /**
   * Get calendar data for room type allotments
   */
  async getCalendarData(params) {
    try {
      const { roomTypeId, startDate, endDate } = params;

      const filter = {};
      if (roomTypeId) {
        filter.roomTypeId = roomTypeId;
      }

      const allotments = await RoomTypeAllotment.find(filter)
        .populate('roomTypeId', 'name code')
        .lean();

      const calendarData = [];
      const start = new Date(startDate);
      const end = new Date(endDate);

      for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        allotments.forEach(allotment => {
          const dailyAllotment = allotment.dailyAllotments?.find(day => {
            const dayDate = new Date(day.date);
            return dayDate.toDateString() === date.toDateString();
          });

          if (dailyAllotment) {
            calendarData.push({
              date: new Date(date).toISOString(),
              roomTypeId: allotment.roomTypeId._id,
              roomTypeName: allotment.roomTypeId.name,
              totalRooms: dailyAllotment.totalInventory,
              availableRooms: dailyAllotment.freeStock + dailyAllotment.channelAllotments.reduce((sum, c) => sum + c.available, 0),
              occupancyRate: dailyAllotment.occupancyRate,
              status: 'available'
            });
          } else {
            calendarData.push({
              date: new Date(date).toISOString(),
              roomTypeId: allotment.roomTypeId._id,
              roomTypeName: allotment.roomTypeId.name,
              totalRooms: allotment.defaultSettings.totalInventory,
              availableRooms: allotment.defaultSettings.totalInventory,
              occupancyRate: 0,
              status: 'available'
            });
          }
        });
      }

      return calendarData;
    } catch (error) {
      throw new Error(`Failed to get calendar data: ${error.message}`);
    }
  }

  /**
   * Bulk update allotments
   */
  async bulkUpdateAllotments(updates) {
    try {
      const results = [];

      for (const update of updates) {
        try {
          const allotment = await RoomTypeAllotment.findByIdAndUpdate(
            update.id,
            { ...update.data, updatedAt: new Date() },
            { new: true, runValidators: true }
          );

          if (allotment) {
            results.push(allotment);
          }
        } catch (error) {
          console.error(`Failed to update allotment ${update.id}:`, error.message);
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to bulk update allotments: ${error.message}`);
    }
  }

  /**
   * Log allotment actions for audit trail
   */
  async logAction(allotmentId, userId, action, details) {
    try {
      const allotment = await RoomTypeAllotment.findById(allotmentId);
      if (!allotment) return;

      // Initialize changeLog if it doesn't exist
      if (!allotment.changeLog) {
        allotment.changeLog = [];
      }

      // Add to allotment change log
      allotment.changeLog.push({
        userId: userId || 'system',
        action,
        changes: details,
        timestamp: new Date()
      });

      await allotment.save();

      // Also log to global audit log if available
      try {
        if (AuditLog) {
          await AuditLog.create({
            entityType: 'RoomTypeAllotment',
            entityId: allotmentId,
            action,
            userId: userId || 'system',
            changes: details,
            timestamp: new Date()
          });
        }
      } catch (auditError) {
        console.warn('Failed to create audit log:', auditError.message);
      }
    } catch (error) {
      console.error('Failed to log allotment action:', error.message);
    }
  }
}

export default new AllotmentService();