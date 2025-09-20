/**
 * GST Calculation Service
 * Handles all GST calculations for corporate bookings and invoices
 */

class GSTCalculationService {
  /**
   * Calculate GST for a given amount and rate
   * @param {number} amount - Base amount
   * @param {number} gstRate - GST rate (default 18%)
   * @param {string} placeOfSupply - Place of supply (for determining IGST vs CGST+SGST)
   * @param {string} companyState - Company's state
   * @returns {Object} GST calculation breakdown
   */
  static calculateGST(amount, gstRate = 18, placeOfSupply = 'Maharashtra', companyState = 'Maharashtra') {
    if (amount < 0) {
      throw new Error('Amount cannot be negative');
    }
    
    if (gstRate < 0 || gstRate > 100) {
      throw new Error('GST rate must be between 0 and 100');
    }
    
    const baseAmount = amount;
    const isInterState = placeOfSupply !== companyState;
    
    let cgstRate = 0;
    let sgstRate = 0;
    let igstRate = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;
    
    if (isInterState) {
      // Inter-state transaction - apply IGST
      igstRate = gstRate;
      igstAmount = (baseAmount * igstRate) / 100;
    } else {
      // Intra-state transaction - apply CGST + SGST
      cgstRate = gstRate / 2;
      sgstRate = gstRate / 2;
      cgstAmount = (baseAmount * cgstRate) / 100;
      sgstAmount = (baseAmount * sgstRate) / 100;
    }
    
    const totalGstAmount = cgstAmount + sgstAmount + igstAmount;
    const totalAmount = baseAmount + totalGstAmount;
    
    return {
      baseAmount: Math.round(baseAmount * 100) / 100,
      gstRate,
      cgstRate,
      sgstRate,
      igstRate,
      cgstAmount: Math.round(cgstAmount * 100) / 100,
      sgstAmount: Math.round(sgstAmount * 100) / 100,
      igstAmount: Math.round(igstAmount * 100) / 100,
      totalGstAmount: Math.round(totalGstAmount * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
      isInterState,
      placeOfSupply,
      companyState
    };
  }
  
  /**
   * Validate GST number format
   * @param {string} gstNumber - GST number to validate
   * @returns {boolean} true if valid, false otherwise
   */
  static validateGSTNumber(gstNumber) {
    if (!gstNumber || typeof gstNumber !== 'string') {
      return false;
    }
    
    // GST number format: 2 digits (state code) + 10 characters (PAN) + 1 character + 1 digit + Z + 1 alphanumeric
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstRegex.test(gstNumber.toUpperCase());
  }
  
  /**
   * Extract state code from GST number
   * @param {string} gstNumber - GST number
   * @returns {string} State code
   */
  static getStateCodeFromGST(gstNumber) {
    if (!this.validateGSTNumber(gstNumber)) {
      throw new Error('Invalid GST number format');
    }
    
    return gstNumber.substring(0, 2);
  }
  
  /**
   * Get state name from state code
   * @param {string} stateCode - 2-digit state code
   * @returns {string} State name
   */
  static getStateFromCode(stateCode) {
    const stateCodes = {
      '01': 'Jammu and Kashmir',
      '02': 'Himachal Pradesh',
      '03': 'Punjab',
      '04': 'Chandigarh',
      '05': 'Uttarakhand',
      '06': 'Haryana',
      '07': 'Delhi',
      '08': 'Rajasthan',
      '09': 'Uttar Pradesh',
      '10': 'Bihar',
      '11': 'Sikkim',
      '12': 'Arunachal Pradesh',
      '13': 'Nagaland',
      '14': 'Manipur',
      '15': 'Mizoram',
      '16': 'Tripura',
      '17': 'Meghalaya',
      '18': 'Assam',
      '19': 'West Bengal',
      '20': 'Jharkhand',
      '21': 'Orissa',
      '22': 'Chhattisgarh',
      '23': 'Madhya Pradesh',
      '24': 'Gujarat',
      '25': 'Daman and Diu',
      '26': 'Dadra and Nagar Haveli',
      '27': 'Maharashtra',
      '29': 'Karnataka',
      '30': 'Goa',
      '31': 'Lakshadweep',
      '32': 'Kerala',
      '33': 'Tamil Nadu',
      '34': 'Puducherry',
      '35': 'Andaman and Nicobar Islands',
      '36': 'Telangana',
      '37': 'Andhra Pradesh',
      '38': 'Ladakh'
    };
    
    return stateCodes[stateCode] || 'Unknown State';
  }
  
  /**
   * Calculate GST for booking items
   * @param {Array} items - Array of booking items
   * @param {Object} gstDetails - GST configuration
   * @returns {Object} Detailed GST calculation
   */
  static calculateBookingGST(items, gstDetails = {}) {
    const {
      gstRate = 18,
      placeOfSupply = 'Maharashtra',
      companyState = 'Maharashtra',
      isGstApplicable = true
    } = gstDetails;
    
    if (!isGstApplicable) {
      const subtotal = items.reduce((sum, item) => 
        sum + (item.quantity * item.unitPrice), 0);
      
      return {
        subtotal: Math.round(subtotal * 100) / 100,
        totalGstAmount: 0,
        totalAmount: Math.round(subtotal * 100) / 100,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        itemBreakdown: items.map(item => ({
          ...item,
          itemTotal: item.quantity * item.unitPrice,
          gstAmount: 0
        }))
      };
    }
    
    let subtotal = 0;
    let totalGstAmount = 0;
    let totalCgstAmount = 0;
    let totalSgstAmount = 0;
    let totalIgstAmount = 0;
    
    const itemBreakdown = items.map(item => {
      const itemTotal = item.quantity * item.unitPrice;
      subtotal += itemTotal;
      
      const gst = this.calculateGST(itemTotal, gstRate, placeOfSupply, companyState);
      
      totalGstAmount += gst.totalGstAmount;
      totalCgstAmount += gst.cgstAmount;
      totalSgstAmount += gst.sgstAmount;
      totalIgstAmount += gst.igstAmount;
      
      return {
        ...item,
        itemTotal,
        gstAmount: gst.totalGstAmount,
        cgstAmount: gst.cgstAmount,
        sgstAmount: gst.sgstAmount,
        igstAmount: gst.igstAmount
      };
    });
    
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalGstAmount: Math.round(totalGstAmount * 100) / 100,
      totalAmount: Math.round((subtotal + totalGstAmount) * 100) / 100,
      cgstAmount: Math.round(totalCgstAmount * 100) / 100,
      sgstAmount: Math.round(totalSgstAmount * 100) / 100,
      igstAmount: Math.round(totalIgstAmount * 100) / 100,
      gstRate,
      isInterState: placeOfSupply !== companyState,
      itemBreakdown
    };
  }
  
  /**
   * Generate GST invoice data
   * @param {Object} booking - Booking data
   * @param {Object} company - Corporate company data
   * @param {Object} hotel - Hotel data
   * @returns {Object} GST invoice data
   */
  static generateGSTInvoiceData(booking, company, hotel) {
    const gstDetails = this.calculateBookingGST(
      booking.items || [{
        description: 'Room Charges',
        quantity: booking.nights || 1,
        unitPrice: booking.totalAmount / (booking.nights || 1)
      }],
      {
        gstRate: booking.gstDetails?.gstRate || 18,
        placeOfSupply: company.address?.state || 'Maharashtra',
        companyState: hotel.address?.state || 'Maharashtra',
        isGstApplicable: booking.gstDetails?.isGstApplicable !== false
      }
    );
    
    return {
      invoiceData: {
        ...gstDetails,
        gstDetails: {
          gstNumber: company.gstNumber,
          gstRate: gstDetails.gstRate,
          cgstRate: gstDetails.gstRate / 2,
          sgstRate: gstDetails.gstRate / 2,
          igstRate: gstDetails.isInterState ? gstDetails.gstRate : 0,
          cgstAmount: gstDetails.cgstAmount,
          sgstAmount: gstDetails.sgstAmount,
          igstAmount: gstDetails.igstAmount,
          totalGstAmount: gstDetails.totalGstAmount,
          placeOfSupply: company.address?.state || 'Maharashtra',
          isGstApplicable: true
        },
        corporateDetails: {
          corporateCompanyId: company._id,
          billingAddress: company.address,
          purchaseOrderNumber: booking.corporateBooking?.purchaseOrderNumber,
          costCenter: booking.corporateBooking?.costCenter,
          paymentTerms: company.paymentTerms,
          billingEmail: company.primaryHRContact?.email
        }
      },
      gstSummary: {
        subtotal: gstDetails.subtotal,
        totalGstAmount: gstDetails.totalGstAmount,
        totalAmount: gstDetails.totalAmount,
        taxBreakdown: {
          cgst: gstDetails.cgstAmount,
          sgst: gstDetails.sgstAmount,
          igst: gstDetails.igstAmount
        }
      }
    };
  }
  
  /**
   * Calculate reverse GST (when total amount includes GST)
   * @param {number} totalAmount - Total amount including GST
   * @param {number} gstRate - GST rate
   * @returns {Object} Reverse GST calculation
   */
  static calculateReverseGST(totalAmount, gstRate = 18) {
    const baseAmount = (totalAmount * 100) / (100 + gstRate);
    const gstAmount = totalAmount - baseAmount;
    
    return {
      totalAmount: Math.round(totalAmount * 100) / 100,
      baseAmount: Math.round(baseAmount * 100) / 100,
      gstAmount: Math.round(gstAmount * 100) / 100,
      gstRate
    };
  }
  
  /**
   * Format GST amount for display
   * @param {number} amount - Amount to format
   * @returns {string} Formatted amount
   */
  static formatGSTAmount(amount) {
    return `₹${amount.toLocaleString('en-IN', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  }
}

export default GSTCalculationService;