import Season from '../models/Season.js';
import SpecialPeriod from '../models/SpecialPeriod.js';
import { v4 as uuidv4 } from 'uuid';

class SeasonalPricingService {
  /**
   * Calculate seasonal and special period adjustments for a given date and room type
   */
  async calculateSeasonalAdjustment(roomType, date, ratePlanId = null) {
    try {
      const checkDate = new Date(date);
      
      // Get active seasons for the date
      const seasons = await this.getActiveSeasonsForDate(checkDate, ratePlanId);
      
      // Get active special periods for the date
      const specialPeriods = await this.getActiveSpecialPeriodsForDate(checkDate, ratePlanId);
      
      // Calculate adjustments with priority order: Special Periods > Seasons
      let totalAdjustment = 0;
      let appliedAdjustments = [];
      
      // Apply seasonal adjustments first (lower priority)
      for (const season of seasons) {
        const adjustment = season.getAdjustmentForRoomType(roomType);
        if (adjustment) {
          const adjustmentAmount = this.calculateAdjustmentAmount(adjustment);
          totalAdjustment += adjustmentAmount;
          
          appliedAdjustments.push({
            type: 'season',
            name: season.name,
            adjustmentType: adjustment.adjustmentType,
            adjustmentValue: adjustment.adjustmentValue,
            calculatedAmount: adjustmentAmount,
            priority: season.priority
          });
        }
      }
      
      // Apply special period overrides (higher priority)
      for (const period of specialPeriods) {
        const override = period.getOverrideForRoomType(roomType);
        if (override) {
          const overrideAmount = this.calculateOverrideAmount(override);
          
          // Special periods can override seasonal adjustments based on type
          if (override.overrideType === 'absolute') {
            totalAdjustment = overrideAmount;
            appliedAdjustments = []; // Clear seasonal adjustments
          } else {
            totalAdjustment += overrideAmount;
          }
          
          appliedAdjustments.push({
            type: 'special_period',
            name: period.name,
            overrideType: override.overrideType,
            overrideValue: override.overrideValue,
            calculatedAmount: overrideAmount,
            priority: period.priority,
            periodType: period.type
          });
        }
      }
      
      return {
        totalAdjustment,
        appliedAdjustments: appliedAdjustments.sort((a, b) => b.priority - a.priority),
        hasSeasonalPricing: seasons.length > 0,
        hasSpecialPeriodPricing: specialPeriods.length > 0,
        date: checkDate
      };
      
    } catch (error) {
      console.error('Error calculating seasonal adjustment:', error);
      return {
        totalAdjustment: 0,
        appliedAdjustments: [],
        hasSeasonalPricing: false,
        hasSpecialPeriodPricing: false,
        date: new Date(date),
        error: error.message
      };
    }
  }
  
  /**
   * Get active seasons for a specific date
   */
  async getActiveSeasonsForDate(date, ratePlanId = null) {
    const query = {
      isActive: true,
      startDate: { $lte: date },
      endDate: { $gte: date }
    };
    
    if (ratePlanId) {
      query.$or = [
        { applicableRatePlans: { $size: 0 } },
        { applicableRatePlans: ratePlanId }
      ];
    }
    
    return await Season.find(query).sort({ priority: -1 });
  }
  
  /**
   * Get active special periods for a specific date
   */
  async getActiveSpecialPeriodsForDate(date, ratePlanId = null) {
    const query = {
      isActive: true,
      startDate: { $lte: date },
      endDate: { $gte: date }
    };
    
    if (ratePlanId) {
      query.$or = [
        { applicableRatePlans: { $size: 0 } },
        { applicableRatePlans: ratePlanId }
      ];
    }
    
    return await SpecialPeriod.find(query).sort({ priority: -1 });
  }
  
  /**
   * Calculate adjustment amount based on adjustment type
   */
  calculateAdjustmentAmount(adjustment) {
    switch (adjustment.adjustmentType) {
      case 'percentage':
        return adjustment.adjustmentValue; // Return percentage for later application
      case 'fixed':
        return adjustment.adjustmentValue; // Fixed amount
      case 'absolute':
        return adjustment.adjustmentValue; // Absolute rate
      default:
        return 0;
    }
  }
  
  /**
   * Calculate override amount based on override type
   */
  calculateOverrideAmount(override) {
    switch (override.overrideType) {
      case 'percentage':
        return override.overrideValue;
      case 'fixed':
        return override.overrideValue;
      case 'absolute':
        return override.overrideValue;
      case 'block':
        return -999999; // Indicates room is blocked
      default:
        return 0;
    }
  }
  
  /**
   * Check if booking is allowed for date range
   */
  async isBookingAllowed(arrivalDate, departureDate, roomType) {
    try {
      const arrival = new Date(arrivalDate);
      const departure = new Date(departureDate);
      
      // Check for blocking special periods
      const blockingPeriods = await SpecialPeriod.find({
        isActive: true,
        $or: [
          {
            startDate: { $lte: departure },
            endDate: { $gte: arrival }
          }
        ],
        'restrictions.bookingRestriction': { $in: ['blocked', 'closed_to_arrival', 'closed_to_departure', 'closed_to_both'] }
      });
      
      for (const period of blockingPeriods) {
        if (!period.isBookingAllowed(arrival, departure)) {
          return {
            allowed: false,
            reason: `Booking not allowed due to ${period.name} (${period.type})`,
            blockingPeriod: {
              name: period.name,
              type: period.type,
              startDate: period.startDate,
              endDate: period.endDate,
              restriction: period.restrictions.bookingRestriction
            }
          };
        }
      }
      
      return { allowed: true };
      
    } catch (error) {
      console.error('Error checking booking availability:', error);
      return {
        allowed: true,
        warning: 'Could not verify seasonal restrictions'
      };
    }
  }
  
  /**
   * Create a new season
   */
  async createSeason(seasonData) {
    try {
      const season = new Season({
        ...seasonData,
        seasonId: seasonData.seasonId || uuidv4()
      });
      
      await season.save();
      return season;
      
    } catch (error) {
      console.error('Error creating season:', error);
      throw error;
    }
  }
  
  /**
   * Update an existing season
   */
  async updateSeason(seasonId, updateData) {
    try {
      const season = await Season.findOneAndUpdate(
        { seasonId },
        updateData,
        { new: true, runValidators: true }
      );
      
      if (!season) {
        throw new Error('Season not found');
      }
      
      return season;
      
    } catch (error) {
      console.error('Error updating season:', error);
      throw error;
    }
  }
  
  /**
   * Create a new special period
   */
  async createSpecialPeriod(periodData) {
    try {
      const period = new SpecialPeriod({
        ...periodData,
        periodId: periodData.periodId || uuidv4()
      });
      
      await period.save();
      
      // If recurring, create future occurrences
      if (period.isRecurring) {
        await this.createRecurringOccurrences(period);
      }
      
      return period;
      
    } catch (error) {
      console.error('Error creating special period:', error);
      throw error;
    }
  }
  
  /**
   * Update an existing special period
   */
  async updateSpecialPeriod(periodId, updateData) {
    try {
      const period = await SpecialPeriod.findOneAndUpdate(
        { periodId },
        updateData,
        { new: true, runValidators: true }
      );
      
      if (!period) {
        throw new Error('Special period not found');
      }
      
      return period;
      
    } catch (error) {
      console.error('Error updating special period:', error);
      throw error;
    }
  }
  
  /**
   * Get seasons by date range
   */
  async getSeasonsByDateRange(startDate, endDate, includeInactive = false) {
    const query = {
      $or: [
        { startDate: { $gte: startDate, $lte: endDate } },
        { endDate: { $gte: startDate, $lte: endDate } },
        { startDate: { $lte: startDate }, endDate: { $gte: endDate } }
      ]
    };
    
    if (!includeInactive) {
      query.isActive = true;
    }
    
    return await Season.find(query).sort({ startDate: 1 });
  }
  
  /**
   * Get special periods by date range
   */
  async getSpecialPeriodsByDateRange(startDate, endDate, includeInactive = false) {
    const query = {
      $or: [
        { startDate: { $gte: startDate, $lte: endDate } },
        { endDate: { $gte: startDate, $lte: endDate } },
        { startDate: { $lte: startDate }, endDate: { $gte: endDate } }
      ]
    };
    
    if (!includeInactive) {
      query.isActive = true;
    }
    
    return await SpecialPeriod.find(query).sort({ startDate: 1 });
  }
  
  /**
   * Create recurring occurrences for a special period
   */
  async createRecurringOccurrences(period, maxOccurrences = 10) {
    try {
      const occurrences = [];
      let current = period;
      
      for (let i = 0; i < maxOccurrences; i++) {
        const nextOccurrence = current.generateNextOccurrence();
        
        if (!nextOccurrence) break;
        
        const newPeriod = new SpecialPeriod({
          ...period.toObject(),
          _id: undefined,
          periodId: `${period.periodId}_${i + 2}`,
          startDate: nextOccurrence.startDate,
          endDate: nextOccurrence.endDate,
          createdAt: undefined,
          updatedAt: undefined
        });
        
        await newPeriod.save();
        occurrences.push(newPeriod);
        current = newPeriod;
      }
      
      return occurrences;
      
    } catch (error) {
      console.error('Error creating recurring occurrences:', error);
      throw error;
    }
  }
  
  /**
   * Get pricing calendar for a date range
   */
  async getPricingCalendar(startDate, endDate, roomType = 'all') {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const calendar = [];
      
      for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        const adjustmentData = await this.calculateSeasonalAdjustment(roomType, new Date(date));
        const bookingAllowed = await this.isBookingAllowed(new Date(date), new Date(date.getTime() + 24 * 60 * 60 * 1000), roomType);
        
        calendar.push({
          date: new Date(date),
          adjustment: adjustmentData,
          bookingAllowed: bookingAllowed.allowed,
          restrictions: bookingAllowed.blockingPeriod || null
        });
      }
      
      return calendar;
      
    } catch (error) {
      console.error('Error getting pricing calendar:', error);
      throw error;
    }
  }
  
  /**
   * Get seasonal analytics for a period
   */
  async getSeasonalAnalytics(startDate, endDate) {
    try {
      const seasons = await this.getSeasonsByDateRange(startDate, endDate);
      const specialPeriods = await this.getSpecialPeriodsByDateRange(startDate, endDate);
      
      const analytics = {
        totalSeasons: seasons.length,
        totalSpecialPeriods: specialPeriods.length,
        seasonsByType: {},
        specialPeriodsByType: {},
        averageAdjustment: 0,
        peakDates: [],
        blackoutDates: []
      };
      
      // Analyze seasons
      seasons.forEach(season => {
        analytics.seasonsByType[season.type] = (analytics.seasonsByType[season.type] || 0) + 1;
      });
      
      // Analyze special periods
      specialPeriods.forEach(period => {
        analytics.specialPeriodsByType[period.type] = (analytics.specialPeriodsByType[period.type] || 0) + 1;
        
        if (period.isBlackoutPeriod) {
          analytics.blackoutDates.push({
            name: period.name,
            startDate: period.startDate,
            endDate: period.endDate
          });
        }
      });
      
      return analytics;
      
    } catch (error) {
      console.error('Error getting seasonal analytics:', error);
      throw error;
    }
  }
}

export default new SeasonalPricingService();