import mongoose from 'mongoose';
import PricingStrategy from '../models/PricingStrategy.js';
import DemandForecast from '../models/DemandForecast.js';
import { CompetitorRate, Competitor } from '../models/CompetitorMonitoring.js';
import RoomAvailability from '../models/RoomAvailability.js';
import RoomType from '../models/RoomType.js';
import AuditLog from '../models/AuditLog.js';
import channelSyncService from './channelSyncService.js';

/**
 * Dynamic Pricing Service
 * AI-powered revenue optimization and automatic rate adjustments
 */
class DynamicPricingService {
  
  constructor() {
    this.isRunning = false;
    this.priceUpdateQueue = new Map();
  }

  /**
   * Calculate optimal rates for a hotel using all available strategies
   * @param {string} hotelId - Hotel ID
   * @param {Date} startDate - Start date for pricing
   * @param {Date} endDate - End date for pricing
   * @param {Object} options - Additional options
   */
  async calculateOptimalRates(hotelId, startDate, endDate, options = {}) {
    try {
      const {
        roomTypeId = null,
        forceRecalculation = false,
        includeCompetitorData = true,
        includeDemandForecast = true
      } = options;

      console.log(`🧮 Calculating optimal rates for hotel ${hotelId}...`);

      // Get active pricing strategies
      const strategies = await PricingStrategy.getActiveStrategies(hotelId);
      if (strategies.length === 0) {
        return {
          success: false,
          message: 'No active pricing strategies found'
        };
      }

      // Get room types to price
      const roomTypeQuery = { hotelId, isActive: true };
      if (roomTypeId) roomTypeQuery._id = roomTypeId;
      
      const roomTypes = await RoomType.find(roomTypeQuery);
      
      const results = [];
      const dateRange = this.getDateRange(startDate, endDate);

      for (const date of dateRange) {
        for (const roomType of roomTypes) {
          try {
            const pricing = await this.calculateRoomTypeRate(
              hotelId,
              roomType,
              date,
              strategies,
              {
                includeCompetitorData,
                includeDemandForecast,
                forceRecalculation
              }
            );

            if (pricing) {
              results.push(pricing);
            }

          } catch (roomError) {
            console.error(`Error calculating rate for ${roomType.name} on ${date}:`, roomError);
          }
        }
      }

      return {
        success: true,
        message: `Calculated rates for ${results.length} room-date combinations`,
        results,
        strategies: strategies.map(s => ({ id: s.strategyId, name: s.name, type: s.type }))
      };

    } catch (error) {
      console.error('Error calculating optimal rates:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Calculate rate for specific room type and date
   * @param {string} hotelId - Hotel ID
   * @param {Object} roomType - Room type document
   * @param {Date} date - Date for pricing
   * @param {Array} strategies - Active pricing strategies
   * @param {Object} options - Calculation options
   */
  async calculateRoomTypeRate(hotelId, roomType, date, strategies, options) {
    try {
      // Get current availability and occupancy
      const availability = await RoomAvailability.findOne({
        hotelId,
        roomTypeId: roomType._id,
        date
      });

      if (!availability) {
        console.warn(`No availability data for ${roomType.name} on ${date}`);
        return null;
      }

      const currentOccupancy = (availability.soldRooms / availability.totalRooms) * 100;

      // Start with base pricing from strategies
      let bestRate = roomType.basePrice;
      let appliedStrategy = null;
      let strategicAdjustments = [];

      // Apply pricing strategies
      for (const strategy of strategies) {
        const strategyRate = await strategy.calculateRate(roomType._id, date, currentOccupancy);
        
        if (strategyRate && (strategy.priority > (appliedStrategy?.priority || 0))) {
          bestRate = strategyRate;
          appliedStrategy = strategy;
          strategicAdjustments.push({
            strategy: strategy.name,
            type: strategy.type,
            rate: strategyRate,
            applied: true
          });
        }
      }

      // Apply demand-based adjustments
      let demandAdjustment = 0;
      let demandForecast = null;

      if (options.includeDemandForecast) {
        demandForecast = await this.getDemandAdjustment(hotelId, roomType._id, date);
        if (demandForecast) {
          demandAdjustment = this.calculateDemandPriceAdjustment(
            demandForecast.predictedDemand.occupancyRate,
            currentOccupancy,
            bestRate
          );
          bestRate += demandAdjustment;
        }
      }

      // Apply competitor-based adjustments
      let competitorAdjustment = 0;
      let competitorData = null;

      if (options.includeCompetitorData) {
        competitorData = await this.getCompetitorAdjustment(hotelId, roomType, date);
        if (competitorData && competitorData.recommendedAdjustment) {
          competitorAdjustment = competitorData.recommendedAdjustment;
          bestRate += competitorAdjustment;
        }
      }

      // Apply final constraints
      const finalRate = this.applyPriceConstraints(bestRate, roomType, appliedStrategy);

      // Calculate revenue impact
      const revenueImpact = await this.calculateRevenueImpact(
        availability.baseRate,
        finalRate,
        availability.totalRooms,
        currentOccupancy
      );

      return {
        hotelId,
        roomTypeId: roomType._id,
        roomTypeName: roomType.name,
        date,
        pricing: {
          basePrice: roomType.basePrice,
          currentRate: availability.baseRate,
          calculatedRate: Math.round(finalRate),
          finalRate: Math.round(finalRate)
        },
        adjustments: {
          strategic: strategicAdjustments,
          demand: {
            adjustment: Math.round(demandAdjustment),
            forecast: demandForecast ? {
              predictedOccupancy: demandForecast.predictedDemand.occupancyRate,
              confidence: demandForecast.predictedDemand.confidence
            } : null
          },
          competitor: {
            adjustment: Math.round(competitorAdjustment),
            data: competitorData ? {
              averageCompetitorRate: competitorData.averageRate,
              position: competitorData.competitivePosition,
              rateRange: competitorData.rateRange
            } : null
          }
        },
        market: {
          currentOccupancy: Math.round(currentOccupancy * 100) / 100,
          availableRooms: availability.availableRooms,
          totalRooms: availability.totalRooms
        },
        performance: revenueImpact,
        appliedStrategy: appliedStrategy ? {
          strategyId: appliedStrategy.strategyId,
          name: appliedStrategy.name,
          type: appliedStrategy.type
        } : null,
        calculatedAt: new Date()
      };

    } catch (error) {
      console.error('Error calculating room type rate:', error);
      throw error;
    }
  }

  /**
   * Get demand-based pricing adjustment
   */
  async getDemandAdjustment(hotelId, roomTypeId, date) {
    try {
      // Check if we have a recent forecast
      let forecast = await DemandForecast.findOne({
        hotelId,
        roomTypeId,
        date
      });

      // Generate forecast if not exists or outdated
      if (!forecast || this.isForecastOutdated(forecast)) {
        forecast = await DemandForecast.generateForecast(hotelId, roomTypeId, date);
      }

      return forecast;

    } catch (error) {
      console.error('Error getting demand adjustment:', error);
      return null;
    }
  }

  /**
   * Calculate demand-based price adjustment
   */
  calculateDemandPriceAdjustment(predictedOccupancy, currentOccupancy, baseRate) {
    // Simple demand-based pricing logic
    const occupancyDifference = predictedOccupancy - currentOccupancy;
    
    // Increase price if predicted occupancy is higher than current
    if (occupancyDifference > 10) {
      return baseRate * 0.15; // 15% increase for high demand
    } else if (occupancyDifference > 5) {
      return baseRate * 0.08; // 8% increase for moderate demand
    } else if (occupancyDifference < -10) {
      return baseRate * -0.12; // 12% decrease for low demand
    } else if (occupancyDifference < -5) {
      return baseRate * -0.06; // 6% decrease for moderate low demand
    }
    
    return 0; // No adjustment for stable demand
  }

  /**
   * Get competitor-based pricing adjustment
   */
  async getCompetitorAdjustment(hotelId, roomType, date) {
    try {
      const competitorRates = await CompetitorRate.find({
        hotelId,
        roomType: roomType.legacyType, // Map room type
        date,
        'dataQuality.confidence': { $gte: 70 }
      }).populate('competitorId');

      if (competitorRates.length === 0) {
        return null;
      }

      const rates = competitorRates.map(cr => cr.rate.amount);
      const averageRate = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
      const minRate = Math.min(...rates);
      const maxRate = Math.max(...rates);

      // Determine competitive position and recommend adjustment
      let recommendedAdjustment = 0;
      let competitivePosition = 'unknown';

      if (roomType.basePrice < averageRate * 0.9) {
        competitivePosition = 'underpriced';
        recommendedAdjustment = (averageRate * 0.95) - roomType.basePrice; // Price closer to market
      } else if (roomType.basePrice > averageRate * 1.15) {
        competitivePosition = 'overpriced';
        recommendedAdjustment = (averageRate * 1.1) - roomType.basePrice; // Reduce to competitive level
      } else {
        competitivePosition = 'competitive';
        // Stay competitive with small adjustments based on occupancy
      }

      return {
        averageRate: Math.round(averageRate),
        minRate,
        maxRate,
        rateRange: { min: minRate, max: maxRate },
        competitivePosition,
        recommendedAdjustment: Math.round(recommendedAdjustment),
        competitorCount: competitorRates.length,
        lastUpdated: new Date()
      };

    } catch (error) {
      console.error('Error getting competitor adjustment:', error);
      return null;
    }
  }

  /**
   * Apply price constraints and business rules
   */
  applyPriceConstraints(calculatedRate, roomType, strategy) {
    let constrainedRate = calculatedRate;

    // Apply room type constraints
    if (roomType.priceConstraints) {
      if (roomType.priceConstraints.minPrice) {
        constrainedRate = Math.max(constrainedRate, roomType.priceConstraints.minPrice);
      }
      if (roomType.priceConstraints.maxPrice) {
        constrainedRate = Math.min(constrainedRate, roomType.priceConstraints.maxPrice);
      }
    }

    // Apply strategy constraints
    if (strategy && strategy.constraints) {
      constrainedRate = Math.max(strategy.constraints.minRate, 
                                Math.min(strategy.constraints.maxRate, constrainedRate));
    }

    // Business rules: minimum viable rate (e.g., never below 70% of base price)
    const minimumViableRate = roomType.basePrice * 0.7;
    constrainedRate = Math.max(constrainedRate, minimumViableRate);

    // Maximum rate protection (e.g., never above 300% of base price)
    const maximumRate = roomType.basePrice * 3;
    constrainedRate = Math.min(constrainedRate, maximumRate);

    return constrainedRate;
  }

  /**
   * Calculate revenue impact of price change
   */
  async calculateRevenueImpact(currentRate, newRate, totalRooms, currentOccupancy) {
    const rateChange = newRate - currentRate;
    const rateChangePercent = (rateChange / currentRate) * 100;

    // Simple price elasticity model
    const priceElasticity = -0.8; // Assumed elasticity
    const demandChange = rateChangePercent * priceElasticity;
    const newOccupancy = Math.max(0, Math.min(100, currentOccupancy + demandChange));

    const currentRevenue = (currentOccupancy / 100) * totalRooms * currentRate;
    const projectedRevenue = (newOccupancy / 100) * totalRooms * newRate;
    const revenueChange = projectedRevenue - currentRevenue;

    return {
      currentRevenue: Math.round(currentRevenue),
      projectedRevenue: Math.round(projectedRevenue),
      revenueChange: Math.round(revenueChange),
      revenueChangePercent: Math.round((revenueChange / currentRevenue) * 10000) / 100,
      occupancyImpact: Math.round((newOccupancy - currentOccupancy) * 100) / 100,
      recommendationScore: this.calculateRecommendationScore(revenueChange, rateChangePercent)
    };
  }

  /**
   * Calculate recommendation score for price change
   */
  calculateRecommendationScore(revenueChange, rateChangePercent) {
    let score = 50; // Base score

    // Revenue improvement adds to score
    if (revenueChange > 0) {
      score += Math.min(30, revenueChange / 100); // Up to 30 points for revenue gain
    } else {
      score -= Math.min(30, Math.abs(revenueChange) / 100); // Deduct for revenue loss
    }

    // Moderate rate changes preferred
    const absRateChange = Math.abs(rateChangePercent);
    if (absRateChange < 5) {
      score += 10; // Small changes are safer
    } else if (absRateChange > 20) {
      score -= 15; // Large changes are risky
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Apply calculated rates to inventory
   * @param {string} hotelId - Hotel ID
   * @param {Array} pricingResults - Results from calculateOptimalRates
   * @param {Object} options - Application options
   */
  async applyPricingChanges(hotelId, pricingResults, options = {}) {
    try {
      const {
        minRecommendationScore = 60,
        autoApply = false,
        notifyChannels = true
      } = options;

      console.log(`💰 Applying pricing changes for hotel ${hotelId}...`);

      const appliedChanges = [];
      const skippedChanges = [];

      for (const pricing of pricingResults) {
        try {
          // Check recommendation score
          if (pricing.performance.recommendationScore < minRecommendationScore) {
            skippedChanges.push({
              ...pricing,
              reason: `Low recommendation score (${pricing.performance.recommendationScore})`
            });
            continue;
          }

          // Check if rate change is significant enough
          const rateChange = Math.abs(pricing.pricing.finalRate - pricing.pricing.currentRate);
          const changePercent = (rateChange / pricing.pricing.currentRate) * 100;

          if (changePercent < 2) {
            skippedChanges.push({
              ...pricing,
              reason: `Rate change too small (${changePercent.toFixed(1)}%)`
            });
            continue;
          }

          // Apply the rate change
          const updated = await this.updateRoomAvailabilityRate(
            hotelId,
            pricing.roomTypeId,
            pricing.date,
            pricing.pricing.finalRate,
            pricing
          );

          if (updated) {
            appliedChanges.push({
              ...pricing,
              applied: true,
              appliedAt: new Date()
            });

            // Log the change
            await AuditLog.logChange({
              hotelId,
              tableName: 'RoomAvailability',
              recordId: pricing.roomTypeId,
              changeType: 'update',
              source: 'dynamic_pricing',
              oldValues: { sellingRate: pricing.pricing.currentRate },
              newValues: { sellingRate: pricing.pricing.finalRate },
              metadata: {
                tags: ['dynamic-pricing', 'revenue-optimization'],
                strategy: pricing.appliedStrategy?.name,
                revenueImpact: pricing.performance.revenueChange
              }
            });

          } else {
            skippedChanges.push({
              ...pricing,
              reason: 'Failed to update availability record'
            });
          }

        } catch (changeError) {
          console.error(`Error applying price change for ${pricing.roomTypeName}:`, changeError);
          skippedChanges.push({
            ...pricing,
            reason: changeError.message
          });
        }
      }

      // Sync changes to channels if requested
      if (notifyChannels && appliedChanges.length > 0) {
        await this.syncPricingToChannels(hotelId, appliedChanges);
      }

      return {
        success: true,
        message: `Applied ${appliedChanges.length} pricing changes, skipped ${skippedChanges.length}`,
        appliedChanges,
        skippedChanges,
        totalRevenueImpact: appliedChanges.reduce((sum, change) => 
          sum + (change.performance?.revenueChange || 0), 0)
      };

    } catch (error) {
      console.error('Error applying pricing changes:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update room availability with new rate
   */
  async updateRoomAvailabilityRate(hotelId, roomTypeId, date, newRate, pricingContext) {
    try {
      const updated = await RoomAvailability.findOneAndUpdate(
        {
          hotelId,
          roomTypeId,
          date
        },
        {
          $set: {
            sellingRate: newRate,
            needsSync: true,
            lastPriceUpdate: new Date(),
            pricingStrategy: pricingContext.appliedStrategy?.strategyId,
            dynamicPricing: {
              enabled: true,
              lastCalculated: pricingContext.calculatedAt,
              adjustments: pricingContext.adjustments,
              revenueImpact: pricingContext.performance
            }
          }
        },
        { new: true }
      );

      return !!updated;

    } catch (error) {
      console.error('Error updating room availability rate:', error);
      return false;
    }
  }

  /**
   * Sync pricing changes to OTA channels
   */
  async syncPricingToChannels(hotelId, appliedChanges) {
    try {
      console.log(`🔄 Syncing pricing changes to channels...`);

      // Group changes by room type for efficient syncing
      const roomTypeChanges = new Map();
      
      for (const change of appliedChanges) {
        if (!roomTypeChanges.has(change.roomTypeId)) {
          roomTypeChanges.set(change.roomTypeId, []);
        }
        roomTypeChanges.get(change.roomTypeId).push(change);
      }

      // Trigger sync for each room type
      for (const [roomTypeId, changes] of roomTypeChanges) {
        const dates = changes.map(c => c.date);
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));

        await channelSyncService.syncHotelToChannels(hotelId, {
          startDate: minDate,
          endDate: maxDate,
          roomTypeId,
          force: true
        });
      }

      return {
        success: true,
        roomTypesSynced: roomTypeChanges.size,
        channelSyncTriggered: true
      };

    } catch (error) {
      console.error('Error syncing pricing to channels:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Run automated pricing optimization
   * @param {string} hotelId - Hotel ID
   * @param {Object} options - Automation options
   */
  async runAutomatedPricing(hotelId, options = {}) {
    if (this.isRunning) {
      console.log('Automated pricing already running');
      return { success: false, message: 'Already running' };
    }

    try {
      this.isRunning = true;
      console.log(`🤖 Starting automated pricing for hotel ${hotelId}...`);

      const {
        daysAhead = 30,
        autoApply = true,
        minRecommendationScore = 70
      } = options;

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + daysAhead);

      // Calculate optimal rates
      const calculation = await this.calculateOptimalRates(hotelId, startDate, endDate, {
        includeCompetitorData: true,
        includeDemandForecast: true
      });

      if (!calculation.success) {
        return calculation;
      }

      // Apply changes if auto-apply is enabled
      let applicationResult = null;
      if (autoApply && calculation.results.length > 0) {
        applicationResult = await this.applyPricingChanges(hotelId, calculation.results, {
          minRecommendationScore,
          autoApply: true,
          notifyChannels: true
        });
      }

      return {
        success: true,
        message: `Automated pricing completed`,
        calculation,
        application: applicationResult,
        summary: {
          calculatedRates: calculation.results.length,
          appliedChanges: applicationResult?.appliedChanges.length || 0,
          skippedChanges: applicationResult?.skippedChanges.length || 0,
          totalRevenueImpact: applicationResult?.totalRevenueImpact || 0
        }
      };

    } catch (error) {
      console.error('Error in automated pricing:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Utility methods
   */
  getDateRange(startDate, endDate) {
    const dates = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
  }

  isForecastOutdated(forecast) {
    const hoursSinceUpdate = (Date.now() - forecast.updatedAt.getTime()) / (1000 * 60 * 60);
    return hoursSinceUpdate > 6; // Refresh forecasts older than 6 hours
  }
}

export default new DynamicPricingService();