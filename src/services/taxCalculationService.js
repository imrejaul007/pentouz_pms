import RoomTax from '../models/RoomTax.js';
import RoomCharge from '../models/RoomCharge.js';
import RoomType from '../models/RoomType.js';
import logger from '../utils/logger.js';

/**
 * Tax Calculation Service
 * Handles complex tax calculations for room bookings
 */
class TaxCalculationService {
  /**
   * Calculate total taxes for a booking
   * @param {Object} bookingData - Booking information
   * @param {string} bookingData.hotelId - Hotel ID
   * @param {string} bookingData.roomTypeId - Room Type ID
   * @param {number} bookingData.baseAmount - Base room amount
   * @param {number} bookingData.roomCount - Number of rooms
   * @param {number} bookingData.guestCount - Number of guests
   * @param {number} bookingData.stayNights - Number of nights
   * @param {string} bookingData.channel - Booking channel
   * @param {string} bookingData.guestType - Guest type (VIP, corporate, etc.)
   * @param {string} bookingData.guestCountry - Guest country
   * @param {Date} bookingData.checkInDate - Check-in date
   * @returns {Object} Tax calculation result
   */
  async calculateBookingTaxes(bookingData) {
    try {
      const {
        hotelId,
        roomTypeId,
        baseAmount,
        roomCount = 1,
        guestCount = 1,
        stayNights = 1,
        channel = 'direct',
        guestType,
        guestCountry,
        checkInDate = new Date()
      } = bookingData;

      if (!hotelId || !baseAmount) {
        throw new Error('Hotel ID and base amount are required for tax calculation');
      }

      // Get applicable taxes
      const applicableTaxes = await RoomTax.getApplicableTaxes(hotelId, {
        roomTypeId,
        roomCount,
        guestCount,
        stayNights,
        channel,
        guestType,
        guestCountry,
        checkInDate
      });

      if (applicableTaxes.length === 0) {
        return {
          totalTaxAmount: 0,
          taxBreakdown: [],
          applicableTaxes: [],
          calculation: {
            baseAmount,
            totalAmount: baseAmount
          }
        };
      }

      // Calculate taxes
      const result = await this.calculateTaxes(baseAmount, applicableTaxes, {
        roomCount,
        guestCount,
        stayNights,
        channel,
        guestType,
        guestCountry,
        checkInDate
      });

      return result;

    } catch (error) {
      logger.error('Tax calculation failed:', {
        error: error.message,
        bookingData,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Calculate taxes for given base amount and tax list
   * @param {number} baseAmount - Base amount for tax calculation
   * @param {Array} taxes - Array of applicable taxes
   * @param {Object} criteria - Additional criteria for tax calculation
   * @returns {Object} Tax calculation result
   */
  async calculateTaxes(baseAmount, taxes, criteria = {}) {
    let runningAmount = baseAmount;
    let totalTaxAmount = 0;
    const taxBreakdown = [];
    const nonCompoundTaxes = [];
    const compoundTaxes = [];

    // Separate compound and non-compound taxes
    taxes.forEach(tax => {
      if (tax.isCompoundTax) {
        compoundTaxes.push(tax);
      } else {
        nonCompoundTaxes.push(tax);
      }
    });

    // Calculate non-compound taxes first
    for (const tax of nonCompoundTaxes) {
      const taxAmount = tax.calculateTax(baseAmount, criteria);
      
      if (taxAmount > 0) {
        totalTaxAmount += taxAmount;
        
        taxBreakdown.push({
          taxId: tax._id,
          taxName: tax.taxName,
          taxType: tax.taxType,
          taxCategory: tax.taxCategory,
          taxRate: tax.taxRate,
          isPercentage: tax.isPercentage,
          fixedAmount: tax.fixedAmount,
          calculationMethod: tax.calculationMethod,
          baseAmount: baseAmount,
          taxAmount: taxAmount,
          isCompound: false
        });
      }
    }

    // Update running amount for compound taxes
    runningAmount = baseAmount + totalTaxAmount;

    // Calculate compound taxes in order
    compoundTaxes.sort((a, b) => a.compoundOrder - b.compoundOrder);

    for (const tax of compoundTaxes) {
      const taxAmount = tax.calculateTax(runningAmount, criteria);
      
      if (taxAmount > 0) {
        totalTaxAmount += taxAmount;
        runningAmount += taxAmount;
        
        taxBreakdown.push({
          taxId: tax._id,
          taxName: tax.taxName,
          taxType: tax.taxType,
          taxCategory: tax.taxCategory,
          taxRate: tax.taxRate,
          isPercentage: tax.isPercentage,
          fixedAmount: tax.fixedAmount,
          calculationMethod: tax.calculationMethod,
          baseAmount: runningAmount - taxAmount,
          taxAmount: taxAmount,
          isCompound: true,
          compoundOrder: tax.compoundOrder
        });
      }
    }

    return {
      totalTaxAmount: Math.round(totalTaxAmount * 100) / 100,
      taxBreakdown,
      applicableTaxes: taxes.map(tax => ({
        id: tax._id,
        name: tax.taxName,
        type: tax.taxType,
        category: tax.taxCategory
      })),
      calculation: {
        baseAmount,
        totalTaxAmount,
        totalAmount: Math.round((baseAmount + totalTaxAmount) * 100) / 100
      }
    };
  }

  /**
   * Get tax breakdown by category
   * @param {Array} taxBreakdown - Tax breakdown array
   * @returns {Object} Tax breakdown grouped by category
   */
  getTaxBreakdownByCategory(taxBreakdown) {
    const categoryBreakdown = {};
    
    taxBreakdown.forEach(tax => {
      if (!categoryBreakdown[tax.taxCategory]) {
        categoryBreakdown[tax.taxCategory] = {
          category: tax.taxCategory,
          taxes: [],
          totalAmount: 0
        };
      }
      
      categoryBreakdown[tax.taxCategory].taxes.push(tax);
      categoryBreakdown[tax.taxCategory].totalAmount += tax.taxAmount;
    });

    // Round category totals
    Object.keys(categoryBreakdown).forEach(category => {
      categoryBreakdown[category].totalAmount = 
        Math.round(categoryBreakdown[category].totalAmount * 100) / 100;
    });

    return categoryBreakdown;
  }

  /**
   * Validate tax calculation result
   * @param {Object} calculationResult - Tax calculation result
   * @returns {boolean} Validation result
   */
  validateTaxCalculation(calculationResult) {
    try {
      const { calculation, taxBreakdown } = calculationResult;
      
      if (!calculation || typeof calculation.baseAmount !== 'number') {
        return false;
      }

      // Verify tax breakdown sum matches total tax amount
      const breakdownTotal = taxBreakdown.reduce((sum, tax) => sum + tax.taxAmount, 0);
      const roundedBreakdownTotal = Math.round(breakdownTotal * 100) / 100;
      
      if (Math.abs(roundedBreakdownTotal - calculation.totalTaxAmount) > 0.01) {
        logger.warn('Tax calculation mismatch:', {
          breakdownTotal: roundedBreakdownTotal,
          calculatedTotal: calculation.totalTaxAmount
        });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Tax calculation validation failed:', error.message);
      return false;
    }
  }

  /**
   * Calculate taxes for multiple room types
   * @param {Array} roomBookings - Array of room booking data
   * @returns {Object} Combined tax calculation result
   */
  async calculateMultiRoomTaxes(roomBookings) {
    try {
      const allCalculations = [];
      let totalBaseAmount = 0;
      let totalTaxAmount = 0;
      const combinedBreakdown = [];
      const combinedApplicableTaxes = new Set();

      for (const roomBooking of roomBookings) {
        const calculation = await this.calculateBookingTaxes(roomBooking);
        
        allCalculations.push({
          roomTypeId: roomBooking.roomTypeId,
          roomCount: roomBooking.roomCount,
          calculation
        });

        totalBaseAmount += calculation.calculation.baseAmount;
        totalTaxAmount += calculation.totalTaxAmount;
        
        // Add to combined breakdown
        calculation.taxBreakdown.forEach(tax => {
          combinedBreakdown.push({
            ...tax,
            roomTypeId: roomBooking.roomTypeId
          });
        });

        // Track all applicable taxes
        calculation.applicableTaxes.forEach(tax => {
          combinedApplicableTaxes.add(JSON.stringify(tax));
        });
      }

      return {
        totalTaxAmount: Math.round(totalTaxAmount * 100) / 100,
        taxBreakdown: combinedBreakdown,
        applicableTaxes: Array.from(combinedApplicableTaxes).map(tax => JSON.parse(tax)),
        calculation: {
          baseAmount: totalBaseAmount,
          totalTaxAmount: Math.round(totalTaxAmount * 100) / 100,
          totalAmount: Math.round((totalBaseAmount + totalTaxAmount) * 100) / 100
        },
        roomCalculations: allCalculations
      };

    } catch (error) {
      logger.error('Multi-room tax calculation failed:', error.message);
      throw error;
    }
  }

  /**
   * Get tax summary for reporting
   * @param {string} hotelId - Hotel ID
   * @param {Object} filters - Date and other filters
   * @returns {Object} Tax summary data
   */
  async getTaxSummary(hotelId, filters = {}) {
    try {
      const { startDate, endDate, taxType, taxCategory } = filters;
      
      const matchQuery = { hotelId };
      
      if (startDate || endDate) {
        matchQuery.createdAt = {};
        if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
        if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
      }

      if (taxType) matchQuery.taxType = taxType;
      if (taxCategory) matchQuery.taxCategory = taxCategory;

      // This would typically query booking/payment records with tax data
      // For now, returning tax configuration summary
      const activeTaxes = await RoomTax.find({
        hotelId,
        isActive: true
      }).lean();

      const summary = {
        totalActiveTaxes: activeTaxes.length,
        taxesByType: {},
        taxesByCategory: {},
        averageTaxRate: 0
      };

      let totalRate = 0;
      let rateCount = 0;

      activeTaxes.forEach(tax => {
        // Group by type
        if (!summary.taxesByType[tax.taxType]) {
          summary.taxesByType[tax.taxType] = 0;
        }
        summary.taxesByType[tax.taxType]++;

        // Group by category
        if (!summary.taxesByCategory[tax.taxCategory]) {
          summary.taxesByCategory[tax.taxCategory] = 0;
        }
        summary.taxesByCategory[tax.taxCategory]++;

        // Calculate average rate for percentage taxes
        if (tax.isPercentage) {
          totalRate += tax.taxRate;
          rateCount++;
        }
      });

      if (rateCount > 0) {
        summary.averageTaxRate = Math.round((totalRate / rateCount) * 100) / 100;
      }

      return summary;

    } catch (error) {
      logger.error('Tax summary calculation failed:', error.message);
      throw error;
    }
  }

  /**
   * Calculate room charges for a booking
   * @param {Object} bookingData - Booking information
   * @returns {Object} Room charges calculation result
   */
  async calculateRoomCharges(bookingData) {
    try {
      const {
        hotelId,
        roomTypeId,
        baseAmount,
        roomCount = 1,
        guestCount = 1,
        stayNights = 1,
        channel = 'direct',
        rateType = 'standard',
        guestType,
        guestCountry,
        checkInDate = new Date(),
        includeOptionalCharges = false,
        selectedCharges = []
      } = bookingData;

      if (!hotelId || !baseAmount) {
        throw new Error('Hotel ID and base amount are required for charge calculation');
      }

      // Get applicable room charges
      const applicableCharges = await RoomCharge.getApplicableCharges(hotelId, {
        roomTypeId,
        channel,
        rateType,
        roomRate: baseAmount,
        guestCount,
        stayNights,
        guestType,
        guestCountry,
        checkInDate
      });

      const chargeBreakdown = [];
      let totalChargeAmount = 0;
      let subtotal = baseAmount;

      // Process mandatory charges
      const mandatoryCharges = applicableCharges.filter(charge => charge.chargeCategory === 'mandatory');
      
      for (const charge of mandatoryCharges) {
        const chargeAmount = charge.calculateCharge(baseAmount, {
          roomCount,
          guestCount,
          stayNights,
          roomRate: baseAmount,
          totalAmount: subtotal,
          subtotal,
          checkInDate
        });

        if (chargeAmount > 0) {
          totalChargeAmount += chargeAmount;
          subtotal += chargeAmount;

          chargeBreakdown.push({
            chargeId: charge._id,
            chargeName: charge.chargeName,
            chargeCode: charge.chargeCode,
            chargeType: charge.chargeType,
            chargeCategory: charge.chargeCategory,
            chargeAmount,
            calculationMethod: charge.calculationMethod,
            isPercentage: charge.isPercentage,
            percentageBase: charge.percentageBase,
            baseAmount: charge.isPercentage ? 
              (charge.percentageBase === 'subtotal' ? subtotal - chargeAmount : baseAmount) : 
              baseAmount,
            isMandatory: true,
            displayName: charge.effectiveDisplayName,
            description: charge.effectiveDescription
          });
        }
      }

      // Process conditional charges
      const conditionalCharges = applicableCharges.filter(charge => charge.chargeCategory === 'conditional');
      
      for (const charge of conditionalCharges) {
        const chargeAmount = charge.calculateCharge(baseAmount, {
          roomCount,
          guestCount,
          stayNights,
          roomRate: baseAmount,
          totalAmount: subtotal,
          subtotal,
          checkInDate
        });

        if (chargeAmount > 0) {
          totalChargeAmount += chargeAmount;
          subtotal += chargeAmount;

          chargeBreakdown.push({
            chargeId: charge._id,
            chargeName: charge.chargeName,
            chargeCode: charge.chargeCode,
            chargeType: charge.chargeType,
            chargeCategory: charge.chargeCategory,
            chargeAmount,
            calculationMethod: charge.calculationMethod,
            isPercentage: charge.isPercentage,
            percentageBase: charge.percentageBase,
            baseAmount: charge.isPercentage ? 
              (charge.percentageBase === 'subtotal' ? subtotal - chargeAmount : baseAmount) : 
              baseAmount,
            isMandatory: false,
            displayName: charge.effectiveDisplayName,
            description: charge.effectiveDescription
          });
        }
      }

      // Process optional charges if requested
      if (includeOptionalCharges) {
        const optionalCharges = applicableCharges.filter(charge => 
          charge.chargeCategory === 'optional' && 
          (selectedCharges.length === 0 || selectedCharges.includes(charge._id.toString()))
        );

        for (const charge of optionalCharges) {
          const chargeAmount = charge.calculateCharge(baseAmount, {
            roomCount,
            guestCount,
            stayNights,
            roomRate: baseAmount,
            totalAmount: subtotal,
            subtotal,
            checkInDate
          });

          if (chargeAmount > 0) {
            totalChargeAmount += chargeAmount;
            subtotal += chargeAmount;

            chargeBreakdown.push({
              chargeId: charge._id,
              chargeName: charge.chargeName,
              chargeCode: charge.chargeCode,
              chargeType: charge.chargeType,
              chargeCategory: charge.chargeCategory,
              chargeAmount,
              calculationMethod: charge.calculationMethod,
              isPercentage: charge.isPercentage,
              percentageBase: charge.percentageBase,
              baseAmount: charge.isPercentage ? 
                (charge.percentageBase === 'subtotal' ? subtotal - chargeAmount : baseAmount) : 
                baseAmount,
              isMandatory: false,
              isOptional: true,
              displayName: charge.effectiveDisplayName,
              description: charge.effectiveDescription
            });
          }
        }
      }

      return {
        totalChargeAmount: Math.round(totalChargeAmount * 100) / 100,
        chargeBreakdown,
        applicableCharges: applicableCharges.map(charge => ({
          id: charge._id,
          name: charge.chargeName,
          code: charge.chargeCode,
          type: charge.chargeType,
          category: charge.chargeCategory,
          isOptional: charge.chargeCategory === 'optional'
        })),
        calculation: {
          baseAmount,
          totalChargeAmount: Math.round(totalChargeAmount * 100) / 100,
          subtotalWithCharges: Math.round(subtotal * 100) / 100
        }
      };

    } catch (error) {
      logger.error('Room charges calculation failed:', {
        error: error.message,
        bookingData,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Calculate comprehensive booking total with room charges and taxes
   * @param {Object} bookingData - Complete booking information
   * @returns {Object} Complete calculation result
   */
  async calculateComprehensiveBookingTotal(bookingData) {
    try {
      // First calculate room charges
      const chargesResult = await this.calculateRoomCharges(bookingData);
      
      // Calculate taxes on the subtotal including charges
      const subtotalWithCharges = chargesResult.calculation.subtotalWithCharges;
      
      const taxResult = await this.calculateBookingTaxes({
        ...bookingData,
        baseAmount: subtotalWithCharges
      });

      // Calculate taxes on individual charges if they are taxable
      const chargeTaxBreakdown = [];
      let totalChargeTaxes = 0;

      for (const charge of chargesResult.chargeBreakdown) {
        if (charge.isTaxable !== false) { // Default to taxable unless explicitly set to false
          const chargeTaxes = await this.calculateChargeSpecificTaxes(
            bookingData.hotelId,
            charge,
            bookingData
          );
          
          if (chargeTaxes.totalTaxAmount > 0) {
            totalChargeTaxes += chargeTaxes.totalTaxAmount;
            chargeTaxBreakdown.push({
              chargeId: charge.chargeId,
              chargeName: charge.chargeName,
              taxes: chargeTaxes.taxBreakdown
            });
          }
        }
      }

      const grandTotal = bookingData.baseAmount + 
                        chargesResult.totalChargeAmount + 
                        taxResult.totalTaxAmount + 
                        totalChargeTaxes;

      return {
        baseAmount: bookingData.baseAmount,
        totalChargeAmount: chargesResult.totalChargeAmount,
        totalTaxAmount: taxResult.totalTaxAmount,
        totalChargeTaxAmount: totalChargeTaxes,
        grandTotal: Math.round(grandTotal * 100) / 100,
        chargeBreakdown: chargesResult.chargeBreakdown,
        taxBreakdown: taxResult.taxBreakdown,
        chargeTaxBreakdown,
        applicableCharges: chargesResult.applicableCharges,
        applicableTaxes: taxResult.applicableTaxes,
        calculation: {
          roomAmount: bookingData.baseAmount,
          chargesAmount: chargesResult.totalChargeAmount,
          subtotalWithCharges: chargesResult.calculation.subtotalWithCharges,
          taxesOnSubtotal: taxResult.totalTaxAmount,
          taxesOnCharges: totalChargeTaxes,
          grandTotal: Math.round(grandTotal * 100) / 100
        },
        categoryBreakdown: this.getComprehensiveCategoryBreakdown(
          chargesResult.chargeBreakdown,
          taxResult.taxBreakdown,
          chargeTaxBreakdown
        )
      };

    } catch (error) {
      logger.error('Comprehensive booking calculation failed:', {
        error: error.message,
        bookingData,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Calculate taxes specific to individual charges
   * @param {string} hotelId - Hotel ID
   * @param {Object} charge - Charge object
   * @param {Object} bookingData - Booking data
   * @returns {Object} Charge-specific tax calculation
   */
  async calculateChargeSpecificTaxes(hotelId, charge, bookingData) {
    try {
      // Get taxes applicable to this specific charge
      const applicableTaxes = await RoomTax.find({
        hotelId,
        isActive: true,
        taxCategory: { $in: ['service_charge', 'additional_service', charge.chargeType] }
      });

      if (applicableTaxes.length === 0) {
        return {
          totalTaxAmount: 0,
          taxBreakdown: []
        };
      }

      // Calculate taxes on the charge amount
      const taxResult = await this.calculateTaxes(charge.chargeAmount, applicableTaxes, {
        roomCount: bookingData.roomCount || 1,
        guestCount: bookingData.guestCount || 1,
        stayNights: bookingData.stayNights || 1,
        channel: bookingData.channel || 'direct',
        guestType: bookingData.guestType,
        guestCountry: bookingData.guestCountry,
        checkInDate: bookingData.checkInDate
      });

      return taxResult;

    } catch (error) {
      logger.error('Charge-specific tax calculation failed:', error.message);
      return {
        totalTaxAmount: 0,
        taxBreakdown: []
      };
    }
  }

  /**
   * Get comprehensive category breakdown including charges and taxes
   * @param {Array} chargeBreakdown - Charge breakdown
   * @param {Array} taxBreakdown - Tax breakdown  
   * @param {Array} chargeTaxBreakdown - Charge tax breakdown
   * @returns {Object} Comprehensive category breakdown
   */
  getComprehensiveCategoryBreakdown(chargeBreakdown, taxBreakdown, chargeTaxBreakdown) {
    const categoryBreakdown = {
      charges: {},
      taxes: {},
      chargeTaxes: {}
    };

    // Process charges by type
    chargeBreakdown.forEach(charge => {
      if (!categoryBreakdown.charges[charge.chargeType]) {
        categoryBreakdown.charges[charge.chargeType] = {
          type: charge.chargeType,
          charges: [],
          totalAmount: 0
        };
      }
      
      categoryBreakdown.charges[charge.chargeType].charges.push(charge);
      categoryBreakdown.charges[charge.chargeType].totalAmount += charge.chargeAmount;
    });

    // Process taxes by category
    taxBreakdown.forEach(tax => {
      if (!categoryBreakdown.taxes[tax.taxCategory]) {
        categoryBreakdown.taxes[tax.taxCategory] = {
          category: tax.taxCategory,
          taxes: [],
          totalAmount: 0
        };
      }
      
      categoryBreakdown.taxes[tax.taxCategory].taxes.push(tax);
      categoryBreakdown.taxes[tax.taxCategory].totalAmount += tax.taxAmount;
    });

    // Process charge-specific taxes
    chargeTaxBreakdown.forEach(chargeTax => {
      const key = `${chargeTax.chargeName}_taxes`;
      categoryBreakdown.chargeTaxes[key] = {
        chargeName: chargeTax.chargeName,
        taxes: chargeTax.taxes,
        totalAmount: chargeTax.taxes.reduce((sum, tax) => sum + tax.taxAmount, 0)
      };
    });

    // Round all amounts
    Object.values(categoryBreakdown.charges).forEach(category => {
      category.totalAmount = Math.round(category.totalAmount * 100) / 100;
    });

    Object.values(categoryBreakdown.taxes).forEach(category => {
      category.totalAmount = Math.round(category.totalAmount * 100) / 100;
    });

    Object.values(categoryBreakdown.chargeTaxes).forEach(category => {
      category.totalAmount = Math.round(category.totalAmount * 100) / 100;
    });

    return categoryBreakdown;
  }

  /**
   * Preview tax calculation for given parameters
   * @param {Object} previewData - Preview parameters
   * @returns {Object} Tax calculation preview
   */
  async previewTaxCalculation(previewData) {
    try {
      const result = await this.calculateBookingTaxes(previewData);
      
      return {
        ...result,
        preview: true,
        categoryBreakdown: this.getTaxBreakdownByCategory(result.taxBreakdown)
      };

    } catch (error) {
      logger.error('Tax calculation preview failed:', error.message);
      throw error;
    }
  }

  /**
   * Preview comprehensive booking calculation
   * @param {Object} previewData - Preview parameters
   * @returns {Object} Comprehensive booking preview
   */
  async previewComprehensiveBooking(previewData) {
    try {
      const result = await this.calculateComprehensiveBookingTotal(previewData);
      
      return {
        ...result,
        preview: true
      };

    } catch (error) {
      logger.error('Comprehensive booking preview failed:', error.message);
      throw error;
    }
  }
}

export default new TaxCalculationService();