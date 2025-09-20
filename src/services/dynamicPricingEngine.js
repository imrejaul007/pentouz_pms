import { PricingRule, DemandForecast, RateShopping, RevenueAnalytics } from '../models/RevenueManagement.js';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';

class DynamicPricingEngine {
  constructor() {
    this.baseRates = new Map();
  }

  /**
   * Calculate dynamic pricing for a room type on specific dates
   */
  async calculateDynamicRate(roomTypeId, checkInDate, checkOutDate, guestProfile = null) {
    try {
      const baseRate = await this.getBaseRate(roomTypeId);
      let finalRate = baseRate;

      // Get active pricing rules
      const pricingRules = await PricingRule.find({
        isActive: true,
        $or: [
          { applicableRoomTypes: roomTypeId },
          { applicableRoomTypes: { $size: 0 } } // Rules that apply to all room types
        ]
      }).sort({ priority: -1 });

      // Apply pricing rules in order of priority
      for (const rule of pricingRules) {
        const adjustment = await this.applyPricingRule(rule, roomTypeId, checkInDate, checkOutDate, guestProfile);
        finalRate = this.applyAdjustment(finalRate, adjustment, rule.conditions.adjustmentType || 'percentage');
      }

      // Apply demand-based pricing
      const demandAdjustment = await this.getDemandBasedAdjustment(roomTypeId, checkInDate);
      finalRate = this.applyAdjustment(finalRate, demandAdjustment, 'percentage');

      // Apply competitor-based pricing
      const competitorAdjustment = await this.getCompetitorBasedAdjustment(roomTypeId, checkInDate);
      finalRate = this.applyAdjustment(finalRate, competitorAdjustment, 'percentage');

      // Ensure minimum and maximum rate bounds
      const minRate = baseRate * 0.5; // Never go below 50% of base rate
      const maxRate = baseRate * 3.0; // Never go above 300% of base rate
      
      finalRate = Math.max(minRate, Math.min(maxRate, finalRate));

      return {
        baseRate,
        finalRate: Math.round(finalRate),
        adjustments: await this.getAppliedAdjustments(pricingRules, demandAdjustment, competitorAdjustment)
      };
    } catch (error) {
      console.error('Error calculating dynamic rate:', error);
      return { baseRate: 0, finalRate: 0, adjustments: [] };
    }
  }

  /**
   * Apply a specific pricing rule
   */
  async applyPricingRule(rule, roomTypeId, checkInDate, checkOutDate, guestProfile) {
    let adjustment = 0;

    switch (rule.type) {
      case 'occupancy_based':
        adjustment = await this.getOccupancyBasedAdjustment(rule, checkInDate);
        break;
      
      case 'day_of_week':
        adjustment = this.getDayOfWeekAdjustment(rule, checkInDate);
        break;
      
      case 'seasonal':
        adjustment = this.getSeasonalAdjustment(rule, checkInDate);
        break;
      
      case 'length_of_stay':
        adjustment = this.getLengthOfStayAdjustment(rule, checkInDate, checkOutDate);
        break;
      
      case 'geographic':
        adjustment = this.getGeographicAdjustment(rule, guestProfile);
        break;
      
      default:
        adjustment = 0;
    }

    return adjustment;
  }

  /**
   * Get occupancy-based pricing adjustment
   */
  async getOccupancyBasedAdjustment(rule, date) {
    try {
      const occupancy = await this.calculateOccupancyForDate(date);
      
      for (const threshold of rule.conditions.occupancyThresholds || []) {
        if (occupancy >= threshold.minOccupancy && occupancy <= threshold.maxOccupancy) {
          return threshold.adjustment;
        }
      }
      
      return 0;
    } catch (error) {
      console.error('Error getting occupancy adjustment:', error);
      return 0;
    }
  }

  /**
   * Get day-of-week pricing adjustment
   */
  getDayOfWeekAdjustment(rule, date) {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = dayNames[date.getDay()];
    
    const dayRule = rule.conditions.daysOfWeek?.find(d => d.day === dayOfWeek);
    return dayRule ? dayRule.adjustment : 0;
  }

  /**
   * Get seasonal pricing adjustment
   */
  getSeasonalAdjustment(rule, date) {
    for (const period of rule.conditions.seasonalPeriods || []) {
      if (date >= period.startDate && date <= period.endDate) {
        return period.adjustment;
      }
    }
    return 0;
  }

  /**
   * Get length-of-stay adjustment
   */
  getLengthOfStayAdjustment(rule, checkInDate, checkOutDate) {
    const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    
    for (const losRule of rule.conditions.lengthOfStay || []) {
      if (nights >= losRule.minNights && nights <= losRule.maxNights) {
        return losRule.adjustment;
      }
    }
    return 0;
  }

  /**
   * Get geographic pricing adjustment
   */
  getGeographicAdjustment(rule, guestProfile) {
    if (!guestProfile || !guestProfile.location) return 0;
    
    for (const geoRule of rule.conditions.geographicRules || []) {
      if (this.matchesGeographic(guestProfile.location, geoRule)) {
        return geoRule.adjustment;
      }
    }
    return 0;
  }

  /**
   * Get demand-based pricing adjustment
   */
  async getDemandBasedAdjustment(roomTypeId, date) {
    try {
      // Get booking velocity (bookings in last 7 days for this date)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const recentBookings = await Booking.countDocuments({
        checkInDate: date,
        roomType: roomTypeId,
        createdAt: { $gte: sevenDaysAgo },
        status: { $in: ['confirmed', 'checked_in'] }
      });

      // High demand = more bookings recently
      if (recentBookings > 10) return 15; // 15% increase
      if (recentBookings > 5) return 10;  // 10% increase
      if (recentBookings > 2) return 5;   // 5% increase
      
      return 0;
    } catch (error) {
      console.error('Error getting demand adjustment:', error);
      return 0;
    }
  }

  /**
   * Get competitor-based pricing adjustment
   */
  async getCompetitorBasedAdjustment(roomTypeId, date) {
    try {
      const competitorRates = await RateShopping.find({
        'rates.date': date,
        isActive: true
      });

      if (competitorRates.length === 0) return 0;

      // Calculate average competitor rate
      let totalRate = 0;
      let count = 0;
      
      competitorRates.forEach(competitor => {
        const rate = competitor.rates.find(r => r.date.getTime() === date.getTime());
        if (rate && rate.rate) {
          totalRate += rate.rate;
          count++;
        }
      });

      if (count === 0) return 0;

      const avgCompetitorRate = totalRate / count;
      const baseRate = await this.getBaseRate(roomTypeId);
      
      // If competitors are pricing higher, increase by up to 10%
      if (avgCompetitorRate > baseRate * 1.1) return 10;
      // If competitors are pricing lower, decrease by up to 5%
      if (avgCompetitorRate < baseRate * 0.9) return -5;
      
      return 0;
    } catch (error) {
      console.error('Error getting competitor adjustment:', error);
      return 0;
    }
  }

  /**
   * Calculate current occupancy for a date
   */
  async calculateOccupancyForDate(date) {
    try {
      const totalRooms = await Room.countDocuments({ isActive: true });
      const bookedRooms = await Booking.countDocuments({
        checkInDate: { $lte: date },
        checkOutDate: { $gt: date },
        status: { $in: ['confirmed', 'checked_in'] }
      });

      return totalRooms > 0 ? (bookedRooms / totalRooms) * 100 : 0;
    } catch (error) {
      console.error('Error calculating occupancy:', error);
      return 0;
    }
  }

  /**
   * Get base rate for room type
   */
  async getBaseRate(roomTypeId) {
    // This would typically come from a rate table or room type configuration
    // For now, returning a default base rate
    return 5000; // Base rate in cents/paise
  }

  /**
   * Apply adjustment to rate
   */
  applyAdjustment(rate, adjustment, type = 'percentage') {
    if (type === 'percentage') {
      return rate * (1 + adjustment / 100);
    } else {
      return rate + adjustment;
    }
  }

  /**
   * Generate demand forecast
   */
  async generateDemandForecast(roomTypeId, startDate, endDate) {
    const forecasts = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      try {
        const historical = await this.getHistoricalData(roomTypeId, currentDate);
        const events = await this.getUpcomingEvents(currentDate);
        const weather = await this.getWeatherForecast(currentDate);
        
        const predictedDemand = this.calculatePredictedDemand(historical, events, weather);
        const predictedOccupancy = Math.min(predictedDemand / await this.getTotalRooms(roomTypeId), 100);
        const recommendedRate = await this.calculateOptimalRate(roomTypeId, predictedOccupancy, currentDate);
        
        forecasts.push({
          date: new Date(currentDate),
          roomType: roomTypeId,
          predictedDemand,
          predictedOccupancy,
          recommendedRate,
          confidence: this.calculateConfidence(historical, events),
          factors: {
            historicalBookings: historical.avgBookings,
            seasonality: historical.seasonalityFactor,
            events: events.map(e => e.name),
            weatherForecast: weather.condition,
            competitorRates: await this.getAvgCompetitorRate(currentDate)
          }
        });
      } catch (error) {
        console.error(`Error forecasting for ${currentDate}:`, error);
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return forecasts;
  }

  /**
   * Get historical booking data
   */
  async getHistoricalData(roomTypeId, date) {
    // Get same day/month from previous years
    const historicalBookings = [];
    
    for (let year = 1; year <= 3; year++) {
      const historicalDate = new Date(date);
      historicalDate.setFullYear(historicalDate.getFullYear() - year);
      
      const bookings = await Booking.countDocuments({
        roomType: roomTypeId,
        checkInDate: historicalDate,
        status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
      });
      
      historicalBookings.push(bookings);
    }
    
    const avgBookings = historicalBookings.reduce((sum, b) => sum + b, 0) / historicalBookings.length;
    const seasonalityFactor = this.calculateSeasonality(date);
    
    return { avgBookings, seasonalityFactor };
  }

  /**
   * Calculate seasonality factor
   */
  calculateSeasonality(date) {
    const month = date.getMonth();
    const seasonalityMap = {
      0: 0.8,  // January - Low season
      1: 0.8,  // February - Low season
      2: 0.9,  // March - Shoulder season
      3: 1.1,  // April - High season
      4: 1.2,  // May - High season
      5: 1.0,  // June - Regular season
      6: 0.9,  // July - Shoulder season
      7: 0.9,  // August - Shoulder season
      8: 1.0,  // September - Regular season
      9: 1.1,  // October - High season
      10: 1.2, // November - High season
      11: 1.3  // December - Peak season
    };
    
    return seasonalityMap[month] || 1.0;
  }

  /**
   * Store rate shopping data
   */
  async storeRateShoppingData(competitorData) {
    try {
      for (const competitor of competitorData) {
        await RateShopping.findOneAndUpdate(
          { competitorId: competitor.competitorId },
          {
            competitorName: competitor.name,
            url: competitor.url,
            roomType: competitor.roomType,
            rates: competitor.rates,
            lastUpdated: new Date()
          },
          { upsert: true, new: true }
        );
      }
    } catch (error) {
      console.error('Error storing rate shopping data:', error);
    }
  }

  /**
   * Update revenue analytics
   */
  async updateRevenueAnalytics(date, roomTypeId = null) {
    try {
      const filter = { date };
      if (roomTypeId) filter.roomType = roomTypeId;

      const bookings = await Booking.find({
        checkInDate: { $lte: date },
        checkOutDate: { $gt: date },
        status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
      });

      const revenue = bookings.reduce((sum, booking) => sum + booking.totalAmount, 0);
      const roomsSold = bookings.length;
      const totalRooms = await this.getTotalRooms(roomTypeId);
      const occupancy = (roomsSold / totalRooms) * 100;
      const adr = roomsSold > 0 ? revenue / roomsSold : 0;
      const revpar = revenue / totalRooms;

      await RevenueAnalytics.findOneAndUpdate(
        filter,
        {
          metrics: {
            adr,
            revpar,
            occupancy,
            revenue,
            roomsSold,
            roomsAvailable: totalRooms
          }
        },
        { upsert: true, new: true }
      );
    } catch (error) {
      console.error('Error updating revenue analytics:', error);
    }
  }

  // Helper methods
  async getTotalRooms(roomTypeId = null) {
    const filter = { isActive: true };
    if (roomTypeId) filter.roomType = roomTypeId;
    return await Room.countDocuments(filter);
  }

  async getUpcomingEvents(date) {
    // This would integrate with an events API or database
    // For now, returning empty array
    return [];
  }

  async getWeatherForecast(date) {
    // This would integrate with a weather API
    // For now, returning default
    return { condition: 'clear', temperature: 25 };
  }

  calculatePredictedDemand(historical, events, weather) {
    let demand = historical.avgBookings * historical.seasonalityFactor;
    
    // Adjust for events
    events.forEach(event => {
      if (event.impact === 'high') demand *= 1.3;
      else if (event.impact === 'medium') demand *= 1.1;
    });
    
    // Adjust for weather (if relevant for the property)
    if (weather.condition === 'rain') demand *= 0.9;
    else if (weather.condition === 'sunny') demand *= 1.05;
    
    return Math.round(demand);
  }

  calculateOptimalRate(roomTypeId, predictedOccupancy, date) {
    // Simple optimization: higher occupancy = higher rates
    const baseRate = this.getBaseRate(roomTypeId);
    let multiplier = 1.0;
    
    if (predictedOccupancy > 90) multiplier = 1.3;
    else if (predictedOccupancy > 80) multiplier = 1.2;
    else if (predictedOccupancy > 70) multiplier = 1.1;
    else if (predictedOccupancy < 40) multiplier = 0.9;
    else if (predictedOccupancy < 20) multiplier = 0.8;
    
    return Math.round(baseRate * multiplier);
  }

  calculateConfidence(historical, events) {
    let confidence = 70; // Base confidence
    
    if (historical.avgBookings > 0) confidence += 20;
    if (events.length > 0) confidence += 10;
    
    return Math.min(confidence, 95);
  }

  async getAvgCompetitorRate(date) {
    const rates = await RateShopping.find({
      'rates.date': date,
      isActive: true
    });
    
    if (rates.length === 0) return 0;
    
    const total = rates.reduce((sum, comp) => {
      const rate = comp.rates.find(r => r.date.getTime() === date.getTime());
      return sum + (rate ? rate.rate : 0);
    }, 0);
    
    return total / rates.length;
  }

  matchesGeographic(guestLocation, rule) {
    return (
      (!rule.country || guestLocation.country === rule.country) &&
      (!rule.state || guestLocation.state === rule.state) &&
      (!rule.city || guestLocation.city === rule.city)
    );
  }

  async getAppliedAdjustments(pricingRules, demandAdjustment, competitorAdjustment) {
    const adjustments = [];
    
    pricingRules.forEach(rule => {
      adjustments.push({
        rule: rule.name,
        type: rule.type,
        adjustment: 0 // This would be calculated based on the specific conditions
      });
    });
    
    if (demandAdjustment !== 0) {
      adjustments.push({
        rule: 'Demand-based pricing',
        type: 'demand_based',
        adjustment: demandAdjustment
      });
    }
    
    if (competitorAdjustment !== 0) {
      adjustments.push({
        rule: 'Competitor-based pricing',
        type: 'competitor_based',
        adjustment: competitorAdjustment
      });
    }
    
    return adjustments;
  }
}

export default DynamicPricingEngine;