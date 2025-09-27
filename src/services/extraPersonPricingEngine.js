import ExtraPersonCharge from '../models/ExtraPersonCharge.js';
import HotelSettings from '../models/HotelSettings.js';

/**
 * Dynamic Pricing Engine for Extra Persons
 * Handles complex pricing scenarios, discounts, and dynamic rates
 */
class ExtraPersonPricingEngine {
  constructor() {
    this.discountStrategies = new Map();
    this.seasonalMultipliers = new Map();
    this.loyaltyTiers = new Map();

    // Initialize default strategies
    this.initializeDefaultStrategies();
  }

  /**
   * Initialize default pricing strategies
   */
  initializeDefaultStrategies() {
    // Group booking discounts
    this.discountStrategies.set('group_booking', (context) => {
      const { extraPersons, originalGuestCount } = context;
      const totalPersons = extraPersons.length + originalGuestCount;

      if (totalPersons >= 10) return 0.15; // 15% discount for 10+ people
      if (totalPersons >= 6) return 0.10; // 10% discount for 6+ people
      if (totalPersons >= 4) return 0.05; // 5% discount for 4+ people
      return 0;
    });

    // Extended stay discounts
    this.discountStrategies.set('extended_stay', (context) => {
      const { nights } = context;

      if (nights >= 30) return 0.25; // 25% discount for 30+ nights
      if (nights >= 14) return 0.15; // 15% discount for 14+ nights
      if (nights >= 7) return 0.10; // 10% discount for 7+ nights
      return 0;
    });

    // Family discount (children)
    this.discountStrategies.set('family_discount', (context) => {
      const { extraPersons } = context;
      const childrenCount = extraPersons.filter(p => p.type === 'child').length;

      if (childrenCount >= 3) return 0.20; // 20% discount for 3+ children
      if (childrenCount >= 2) return 0.10; // 10% discount for 2+ children
      return 0;
    });

    // Corporate booking discounts
    this.discountStrategies.set('corporate_discount', (context) => {
      const { bookingSource, corporateId } = context;

      if (bookingSource === 'corporate' && corporateId) {
        return 0.12; // 12% corporate discount
      }
      return 0;
    });

    // Loyalty tier multipliers
    this.loyaltyTiers.set('bronze', 0.95); // 5% discount
    this.loyaltyTiers.set('silver', 0.90); // 10% discount
    this.loyaltyTiers.set('gold', 0.85); // 15% discount
    this.loyaltyTiers.set('platinum', 0.80); // 20% discount
  }

  /**
   * Calculate comprehensive extra person charges with dynamic pricing
   * @param {Object} pricingContext - All pricing context data
   * @returns {Object} Detailed pricing breakdown
   */
  async calculateDynamicPricing(pricingContext) {
    const {
      hotelId,
      bookingId,
      extraPersons,
      baseBookingData,
      guestProfile = {},
      marketingSettings = {}
    } = pricingContext;

    try {
      // Get base pricing from existing charge rules
      const baseCharges = await this.calculateBaseCharges(hotelId, baseBookingData, extraPersons);

      // Apply dynamic pricing strategies
      const dynamicAdjustments = await this.applyDynamicStrategies(pricingContext);

      // Apply loyalty and membership discounts
      const loyaltyAdjustments = this.applyLoyaltyDiscounts(guestProfile, baseCharges);

      // Apply promotional discounts
      const promotionalAdjustments = await this.applyPromotionalDiscounts(
        hotelId,
        baseBookingData,
        marketingSettings
      );

      // Apply demand-based pricing
      const demandAdjustments = await this.applyDemandBasedPricing(
        hotelId,
        baseBookingData.checkIn,
        baseBookingData.roomType
      );

      // Apply competitor pricing adjustment
      const competitorAdjustments = await this.applyCompetitorPricing(
        hotelId,
        baseBookingData,
        marketingSettings
      );

      // Combine all adjustments
      const finalPricing = this.combineAllAdjustments({
        baseCharges,
        dynamicAdjustments,
        loyaltyAdjustments,
        promotionalAdjustments,
        demandAdjustments,
        competitorAdjustments
      });

      // Generate detailed breakdown
      return {
        success: true,
        pricingBreakdown: finalPricing,
        totalExtraPersonCharge: finalPricing.totalFinalAmount,
        currency: baseCharges.currency,
        appliedStrategies: finalPricing.appliedStrategies,
        savings: finalPricing.totalSavings,
        metadata: {
          calculatedAt: new Date(),
          pricingEngineVersion: '1.0',
          contextHash: this.generateContextHash(pricingContext)
        }
      };

    } catch (error) {
      console.error('Dynamic pricing calculation failed:', error);

      // Fallback to base pricing
      const fallbackCharges = await this.calculateBaseCharges(hotelId, baseBookingData, extraPersons);

      return {
        success: false,
        error: error.message,
        pricingBreakdown: fallbackCharges,
        totalExtraPersonCharge: fallbackCharges.totalExtraCharge,
        currency: fallbackCharges.currency,
        appliedStrategies: ['base_pricing_fallback']
      };
    }
  }

  /**
   * Calculate base charges using existing ExtraPersonCharge model
   */
  async calculateBaseCharges(hotelId, baseBookingData, extraPersons) {
    const bookingData = {
      ...baseBookingData,
      extraPersons: extraPersons.map(person => ({
        id: person.personId || person.id,
        name: person.name,
        type: person.type,
        age: person.age
      }))
    };

    return await ExtraPersonCharge.calculateExtraPersonCharge(hotelId, bookingData);
  }

  /**
   * Apply dynamic pricing strategies
   */
  async applyDynamicStrategies(pricingContext) {
    const adjustments = [];
    const { extraPersons, baseBookingData, guestProfile } = pricingContext;

    const context = {
      extraPersons,
      originalGuestCount: baseBookingData.guestDetails?.adults + baseBookingData.guestDetails?.children || 2,
      nights: baseBookingData.nights,
      bookingSource: baseBookingData.source,
      corporateId: baseBookingData.corporateBooking?.corporateCompanyId,
      guestProfile
    };

    // Apply each discount strategy
    for (const [strategyName, strategyFunction] of this.discountStrategies) {
      try {
        const discountRate = strategyFunction(context);
        if (discountRate > 0) {
          adjustments.push({
            strategy: strategyName,
            type: 'discount',
            rate: discountRate,
            description: `${strategyName.replace('_', ' ').toUpperCase()} discount`
          });
        }
      } catch (error) {
        console.warn(`Failed to apply ${strategyName} strategy:`, error);
      }
    }

    return adjustments;
  }

  /**
   * Apply loyalty program discounts
   */
  applyLoyaltyDiscounts(guestProfile, baseCharges) {
    const adjustments = [];

    if (guestProfile.loyaltyTier && this.loyaltyTiers.has(guestProfile.loyaltyTier)) {
      const multiplier = this.loyaltyTiers.get(guestProfile.loyaltyTier);
      const discountRate = 1 - multiplier;

      adjustments.push({
        strategy: 'loyalty_program',
        type: 'discount',
        rate: discountRate,
        tier: guestProfile.loyaltyTier,
        description: `${guestProfile.loyaltyTier.toUpperCase()} loyalty member discount`
      });
    }

    // VIP guest benefits
    if (guestProfile.isVIP) {
      adjustments.push({
        strategy: 'vip_benefits',
        type: 'discount',
        rate: 0.15, // 15% VIP discount
        description: 'VIP guest special discount'
      });
    }

    return adjustments;
  }

  /**
   * Apply promotional discounts based on hotel settings
   */
  async applyPromotionalDiscounts(hotelId, baseBookingData, marketingSettings) {
    const adjustments = [];

    try {
      // Check for active promotions (this would integrate with a promotions system)
      const activePromotions = await this.getActivePromotions(hotelId, baseBookingData.checkIn);

      for (const promotion of activePromotions) {
        if (this.isPromotionApplicable(promotion, baseBookingData)) {
          adjustments.push({
            strategy: 'promotional_discount',
            type: 'discount',
            rate: promotion.discountRate,
            promoCode: promotion.code,
            description: promotion.description || `${promotion.code} promotion`
          });
        }
      }

      // Early booking discount
      const bookingLeadTime = Math.ceil((new Date(baseBookingData.checkIn) - new Date()) / (1000 * 60 * 60 * 24));
      if (bookingLeadTime >= 30) {
        adjustments.push({
          strategy: 'early_booking',
          type: 'discount',
          rate: 0.10, // 10% early booking discount
          description: 'Early booking discount (30+ days advance)'
        });
      }

      // Last-minute booking surcharge
      if (bookingLeadTime <= 1) {
        adjustments.push({
          strategy: 'last_minute',
          type: 'surcharge',
          rate: 0.15, // 15% last-minute surcharge
          description: 'Last-minute booking surcharge'
        });
      }

    } catch (error) {
      console.warn('Failed to apply promotional discounts:', error);
    }

    return adjustments;
  }

  /**
   * Apply demand-based pricing adjustments
   */
  async applyDemandBasedPricing(hotelId, checkInDate, roomType) {
    const adjustments = [];

    try {
      // Get occupancy forecast for the date
      const occupancyData = await this.getOccupancyForecast(hotelId, checkInDate);

      if (occupancyData.occupancyRate > 0.90) {
        // High demand - apply surge pricing
        adjustments.push({
          strategy: 'high_demand_surge',
          type: 'surcharge',
          rate: 0.25, // 25% surge pricing
          description: 'High demand surge pricing (90%+ occupancy)'
        });
      } else if (occupancyData.occupancyRate < 0.50) {
        // Low demand - offer discount
        adjustments.push({
          strategy: 'low_demand_discount',
          type: 'discount',
          rate: 0.20, // 20% discount to fill rooms
          description: 'Low demand discount (under 50% occupancy)'
        });
      }

      // Weekend vs weekday pricing
      const dayOfWeek = new Date(checkInDate).getDay();
      if (dayOfWeek === 5 || dayOfWeek === 6) { // Friday or Saturday
        adjustments.push({
          strategy: 'weekend_premium',
          type: 'surcharge',
          rate: 0.15, // 15% weekend premium
          description: 'Weekend premium pricing'
        });
      }

    } catch (error) {
      console.warn('Failed to apply demand-based pricing:', error);
    }

    return adjustments;
  }

  /**
   * Apply competitor-based pricing adjustments
   */
  async applyCompetitorPricing(hotelId, baseBookingData, marketingSettings) {
    const adjustments = [];

    if (!marketingSettings.enableCompetitorPricing) {
      return adjustments;
    }

    try {
      // This would integrate with a competitive pricing API
      const competitorData = await this.getCompetitorPricing(hotelId, baseBookingData);

      if (competitorData && competitorData.averagePrice) {
        const ourBasePrice = baseBookingData.baseRoomRate;
        const priceDifference = (ourBasePrice - competitorData.averagePrice) / competitorData.averagePrice;

        if (priceDifference > 0.20) {
          // We're significantly more expensive - offer discount
          adjustments.push({
            strategy: 'competitor_matching',
            type: 'discount',
            rate: 0.10, // 10% competitive discount
            description: 'Competitive pricing adjustment'
          });
        }
      }

    } catch (error) {
      console.warn('Failed to apply competitor pricing:', error);
    }

    return adjustments;
  }

  /**
   * Combine all pricing adjustments into final pricing
   */
  combineAllAdjustments(adjustmentData) {
    const { baseCharges, ...allAdjustments } = adjustmentData;

    let totalDiscountRate = 0;
    let totalSurchargeRate = 0;
    const appliedStrategies = [];

    // Collect all adjustments
    const allAdjustmentArrays = Object.values(allAdjustments).flat();

    for (const adjustment of allAdjustmentArrays) {
      if (adjustment.type === 'discount') {
        totalDiscountRate += adjustment.rate;
      } else if (adjustment.type === 'surcharge') {
        totalSurchargeRate += adjustment.rate;
      }
      appliedStrategies.push(adjustment.strategy);
    }

    // Cap discount at 50%
    totalDiscountRate = Math.min(totalDiscountRate, 0.50);

    // Calculate final amounts for each person
    const finalChargeBreakdown = baseCharges.chargeBreakdown.map(personCharge => {
      const baseAmount = personCharge.totalCharge;
      const discountAmount = baseAmount * totalDiscountRate;
      const surchargeAmount = baseAmount * totalSurchargeRate;
      const finalAmount = baseAmount - discountAmount + surchargeAmount;

      return {
        ...personCharge,
        originalAmount: baseAmount,
        discountAmount,
        surchargeAmount,
        finalAmount,
        effectiveDiscountRate: (discountAmount - surchargeAmount) / baseAmount
      };
    });

    const totalOriginalAmount = finalChargeBreakdown.reduce((sum, charge) => sum + charge.originalAmount, 0);
    const totalFinalAmount = finalChargeBreakdown.reduce((sum, charge) => sum + charge.finalAmount, 0);
    const totalSavings = totalOriginalAmount - totalFinalAmount;

    return {
      chargeBreakdown: finalChargeBreakdown,
      totalOriginalAmount,
      totalFinalAmount,
      totalSavings,
      effectiveDiscountRate: totalSavings / totalOriginalAmount,
      appliedStrategies,
      adjustmentDetails: allAdjustmentArrays
    };
  }

  /**
   * Get active promotions for a hotel and date
   */
  async getActivePromotions(hotelId, checkInDate) {
    // This would integrate with a promotions/marketing system
    // For now, return mock data
    return [
      {
        code: 'SUMMER2024',
        discountRate: 0.15,
        description: 'Summer special discount',
        validFrom: new Date('2024-06-01'),
        validTo: new Date('2024-08-31'),
        applicableToExtraPersons: true
      }
    ];
  }

  /**
   * Check if promotion is applicable to booking
   */
  isPromotionApplicable(promotion, baseBookingData) {
    const checkInDate = new Date(baseBookingData.checkIn);
    return checkInDate >= promotion.validFrom &&
           checkInDate <= promotion.validTo &&
           promotion.applicableToExtraPersons;
  }

  /**
   * Get occupancy forecast for demand-based pricing
   */
  async getOccupancyForecast(hotelId, date) {
    // This would integrate with a revenue management system
    // For now, return mock data based on date
    const dayOfWeek = new Date(date).getDay();
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;

    return {
      occupancyRate: isWeekend ? 0.85 : 0.65,
      averageDailyRate: isWeekend ? 5500 : 4200,
      competitorOccupancy: isWeekend ? 0.80 : 0.60
    };
  }

  /**
   * Get competitor pricing data
   */
  async getCompetitorPricing(hotelId, baseBookingData) {
    // This would integrate with competitive intelligence APIs
    // For now, return mock data
    return {
      averagePrice: baseBookingData.baseRoomRate * 0.95,
      lowestPrice: baseBookingData.baseRoomRate * 0.80,
      highestPrice: baseBookingData.baseRoomRate * 1.20,
      numberOfCompetitors: 5
    };
  }

  /**
   * Generate context hash for pricing consistency
   */
  generateContextHash(context) {
    const hashString = JSON.stringify({
      extraPersons: context.extraPersons?.length || 0,
      checkIn: context.baseBookingData?.checkIn,
      nights: context.baseBookingData?.nights,
      roomType: context.baseBookingData?.roomType,
      guestTier: context.guestProfile?.loyaltyTier
    });

    // Simple hash function for demonstration
    let hash = 0;
    for (let i = 0; i < hashString.length; i++) {
      const char = hashString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  /**
   * Add custom discount strategy
   */
  addDiscountStrategy(name, strategyFunction) {
    this.discountStrategies.set(name, strategyFunction);
  }

  /**
   * Remove discount strategy
   */
  removeDiscountStrategy(name) {
    return this.discountStrategies.delete(name);
  }

  /**
   * Get pricing preview without saving
   */
  async getPricingPreview(hotelId, previewData) {
    const mockContext = {
      hotelId,
      bookingId: null,
      extraPersons: previewData.extraPersons,
      baseBookingData: previewData.baseBookingData,
      guestProfile: previewData.guestProfile || {},
      marketingSettings: previewData.marketingSettings || {}
    };

    return await this.calculateDynamicPricing(mockContext);
  }
}

// Create singleton instance
const extraPersonPricingEngine = new ExtraPersonPricingEngine();

export default extraPersonPricingEngine;