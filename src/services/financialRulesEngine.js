import Decimal from 'decimal.js';
import { ApplicationError } from '../middleware/errorHandler.js';

/**
 * Financial Rules Engine
 * Implements business rules and validation logic for financial operations
 * Ensures compliance with hotel industry standards and regulatory requirements
 */
class FinancialRulesEngine {
  constructor() {
    // Configure business rules and limits
    this.rules = {
      // Payment limits
      maxCashPayment: new Decimal(200000), // 2 Lakh INR
      maxSinglePayment: new Decimal(10000000), // 1 Crore INR
      minPaymentAmount: new Decimal(1), // 1 INR

      // Settlement limits
      maxSettlementAmount: new Decimal(50000000), // 5 Crore INR
      maxOutstandingDays: 365, // 1 year

      // Late fee constraints
      maxLateFeeRate: new Decimal(25), // 25% annual
      minGracePeriod: 0, // days
      maxGracePeriod: 30, // days

      // Currency constraints
      supportedCurrencies: ['INR', 'USD', 'EUR', 'GBP', 'JPY'],
      defaultCurrency: 'INR',

      // Tax rates by region (configurable)
      taxRates: {
        'IN': new Decimal(0.18), // 18% GST in India
        'US': new Decimal(0.08), // Average US sales tax
        'EU': new Decimal(0.20), // Average EU VAT
        'UK': new Decimal(0.20), // UK VAT
        'default': new Decimal(0.18)
      },

      // Compliance thresholds
      complianceThresholds: {
        largeTransaction: new Decimal(1000000), // 10 Lakh INR
        suspiciousRefund: new Decimal(500000), // 5 Lakh INR
        highValueGuest: new Decimal(2000000), // 20 Lakh INR
        corporateDiscount: new Decimal(0.20), // 20% max corporate discount
      }
    };
  }

  /**
   * Validates settlement creation rules
   */
  validateSettlementCreation(settlementData, booking) {
    const violations = [];
    const warnings = [];

    try {
      // Validate basic settlement constraints
      this._validateSettlementConstraints(settlementData, violations, warnings);

      // Validate against booking data
      this._validateBookingConsistency(settlementData, booking, violations, warnings);

      // Validate guest and booking type rules
      this._validateGuestTypeRules(settlementData, booking, violations, warnings);

      // Validate payment terms
      this._validatePaymentTerms(settlementData, violations, warnings);

      // Validate currency and regional rules
      this._validateCurrencyRules(settlementData, violations, warnings);

    } catch (error) {
      violations.push(`Rule validation error: ${error.message}`);
    }

    return {
      isValid: violations.length === 0,
      violations,
      warnings,
      appliedRules: this._getAppliedRules(settlementData)
    };
  }

  /**
   * Validates payment processing rules
   */
  validatePaymentProcessing(paymentData, settlement) {
    const violations = [];
    const warnings = [];

    try {
      // Validate payment amount rules
      this._validatePaymentAmount(paymentData, settlement, violations, warnings);

      // Validate payment method rules
      this._validatePaymentMethod(paymentData, settlement, violations, warnings);

      // Validate anti-money laundering rules
      this._validateAMLRules(paymentData, settlement, violations, warnings);

      // Validate business logic constraints
      this._validatePaymentBusinessLogic(paymentData, settlement, violations, warnings);

    } catch (error) {
      violations.push(`Payment validation error: ${error.message}`);
    }

    return {
      isValid: violations.length === 0,
      violations,
      warnings,
      requiresApproval: this._requiresManagerApproval(paymentData, settlement)
    };
  }

  /**
   * Validates adjustment rules
   */
  validateAdjustmentRules(adjustmentData, settlement) {
    const violations = [];
    const warnings = [];

    try {
      // Validate adjustment type and amount
      this._validateAdjustmentType(adjustmentData, violations, warnings);

      // Validate adjustment authorization
      this._validateAdjustmentAuthorization(adjustmentData, settlement, violations, warnings);

      // Validate adjustment impact on settlement
      this._validateAdjustmentImpact(adjustmentData, settlement, violations, warnings);

    } catch (error) {
      violations.push(`Adjustment validation error: ${error.message}`);
    }

    return {
      isValid: violations.length === 0,
      violations,
      warnings,
      requiresApproval: this._requiresAdjustmentApproval(adjustmentData, settlement)
    };
  }

  /**
   * Validates refund processing rules
   */
  validateRefundRules(refundData, settlement) {
    const violations = [];
    const warnings = [];

    try {
      // Validate refund eligibility
      this._validateRefundEligibility(refundData, settlement, violations, warnings);

      // Validate refund amount
      this._validateRefundAmount(refundData, settlement, violations, warnings);

      // Validate refund method
      this._validateRefundMethod(refundData, settlement, violations, warnings);

    } catch (error) {
      violations.push(`Refund validation error: ${error.message}`);
    }

    return {
      isValid: violations.length === 0,
      violations,
      warnings,
      requiresApproval: this._requiresRefundApproval(refundData, settlement)
    };
  }

  /**
   * Validates settlement constraints
   */
  _validateSettlementConstraints(settlementData, violations, warnings) {
    const finalAmount = new Decimal(settlementData.finalAmount || 0);

    if (finalAmount.gt(this.rules.maxSettlementAmount)) {
      violations.push(`Settlement amount exceeds maximum limit of ${this.rules.maxSettlementAmount.toFixed(2)}`);
    }

    if (finalAmount.lt(0)) {
      violations.push('Settlement amount cannot be negative');
    }

    // Validate currency
    if (!this.rules.supportedCurrencies.includes(settlementData.currency)) {
      violations.push(`Unsupported currency: ${settlementData.currency}`);
    }

    // Validate due date
    if (settlementData.dueDate) {
      const dueDate = new Date(settlementData.dueDate);
      const maxDueDate = new Date();
      maxDueDate.setDate(maxDueDate.getDate() + this.rules.maxOutstandingDays);

      if (dueDate > maxDueDate) {
        warnings.push(`Due date is very far in the future (${this.rules.maxOutstandingDays} days)`);
      }

      if (dueDate < new Date()) {
        warnings.push('Due date is in the past');
      }
    }
  }

  /**
   * Validates booking consistency
   */
  _validateBookingConsistency(settlementData, booking, violations, warnings) {
    if (!booking) {
      violations.push('Associated booking not found');
      return;
    }

    // Validate amount consistency
    const settlementAmount = new Decimal(settlementData.finalAmount || 0);
    const bookingAmount = new Decimal(booking.totalAmount || 0);

    if (settlementAmount.lt(bookingAmount.times(0.5))) {
      warnings.push('Settlement amount is significantly lower than booking amount');
    }

    if (settlementAmount.gt(bookingAmount.times(2))) {
      warnings.push('Settlement amount is significantly higher than booking amount');
    }

    // Validate guest consistency
    if (settlementData.guestDetails?.guestId &&
        booking.userId &&
        settlementData.guestDetails.guestId !== booking.userId.toString()) {
      violations.push('Guest ID mismatch between settlement and booking');
    }

    // Validate booking status
    if (booking.status === 'cancelled') {
      warnings.push('Creating settlement for cancelled booking');
    }
  }

  /**
   * Validates guest type rules
   */
  _validateGuestTypeRules(settlementData, booking, violations, warnings) {
    const finalAmount = new Decimal(settlementData.finalAmount || 0);

    // High-value guest validation
    if (finalAmount.gt(this.rules.complianceThresholds.highValueGuest)) {
      warnings.push('High-value guest settlement requires enhanced documentation');
    }

    // Corporate booking rules
    if (booking?.guestDetails?.type === 'corporate') {
      // Validate corporate discount limits
      const originalAmount = new Decimal(booking.totalAmount || 0);
      if (originalAmount.gt(0)) {
        const discountPercentage = originalAmount.minus(finalAmount).div(originalAmount);
        if (discountPercentage.gt(this.rules.complianceThresholds.corporateDiscount)) {
          violations.push(`Corporate discount exceeds maximum allowed (${this.rules.complianceThresholds.corporateDiscount.times(100).toFixed(0)}%)`);
        }
      }
    }

    // VIP guest rules
    if (booking?.guestDetails?.isVIP || settlementData.flags?.isVIP) {
      warnings.push('VIP guest settlement - ensure premium service standards');
    }
  }

  /**
   * Validates payment terms
   */
  _validatePaymentTerms(settlementData, violations, warnings) {
    if (settlementData.terms) {
      const { lateFeeRate, gracePeriod } = settlementData.terms;

      if (lateFeeRate !== undefined) {
        const rate = new Decimal(lateFeeRate);
        if (rate.gt(this.rules.maxLateFeeRate)) {
          violations.push(`Late fee rate exceeds maximum (${this.rules.maxLateFeeRate.toFixed(0)}%)`);
        }
        if (rate.lt(0)) {
          violations.push('Late fee rate cannot be negative');
        }
      }

      if (gracePeriod !== undefined) {
        if (gracePeriod < this.rules.minGracePeriod || gracePeriod > this.rules.maxGracePeriod) {
          violations.push(`Grace period must be between ${this.rules.minGracePeriod} and ${this.rules.maxGracePeriod} days`);
        }
      }
    }
  }

  /**
   * Validates currency rules
   */
  _validateCurrencyRules(settlementData, violations, warnings) {
    const currency = settlementData.currency || this.rules.defaultCurrency;

    if (!this.rules.supportedCurrencies.includes(currency)) {
      violations.push(`Currency ${currency} is not supported`);
    }

    // Check for currency consistency across adjustments
    if (settlementData.adjustments) {
      settlementData.adjustments.forEach((adjustment, index) => {
        if (adjustment.currency && adjustment.currency !== currency) {
          violations.push(`Adjustment ${index + 1} currency mismatch`);
        }
      });
    }
  }

  /**
   * Validates payment amount rules
   */
  _validatePaymentAmount(paymentData, settlement, violations, warnings) {
    const amount = new Decimal(paymentData.amount || 0);
    const outstanding = new Decimal(settlement.outstandingBalance || 0);

    if (amount.lt(this.rules.minPaymentAmount)) {
      violations.push(`Payment amount below minimum (${this.rules.minPaymentAmount.toFixed(2)})`);
    }

    if (amount.gt(this.rules.maxSinglePayment)) {
      violations.push(`Payment amount exceeds maximum single payment limit (${this.rules.maxSinglePayment.toFixed(2)})`);
    }

    // Check for suspicious patterns
    if (amount.gt(outstanding.times(1.5))) {
      warnings.push('Payment amount significantly exceeds outstanding balance');
    }

    // Round amount validation
    if (amount.equals(amount.round())) {
      warnings.push('Round amount payment detected - may need verification');
    }
  }

  /**
   * Validates payment method rules
   */
  _validatePaymentMethod(paymentData, settlement, violations, warnings) {
    const { method, amount } = paymentData;
    const paymentAmount = new Decimal(amount || 0);

    switch (method) {
      case 'cash':
        if (paymentAmount.gt(this.rules.maxCashPayment)) {
          violations.push(`Cash payment exceeds limit (${this.rules.maxCashPayment.toFixed(2)})`);
        }
        if (paymentAmount.gt(new Decimal(50000))) {
          warnings.push('Large cash payment - ensure compliance documentation');
        }
        break;

      case 'card':
        if (!paymentData.reference) {
          warnings.push('Card payment missing transaction reference');
        }
        break;

      case 'bank_transfer':
        if (!paymentData.reference) {
          violations.push('Bank transfer requires transaction reference');
        }
        break;

      case 'upi':
        if (!paymentData.reference) {
          violations.push('UPI payment requires transaction ID');
        }
        break;
    }
  }

  /**
   * Validates anti-money laundering rules
   */
  _validateAMLRules(paymentData, settlement, violations, warnings) {
    const amount = new Decimal(paymentData.amount || 0);

    // Large transaction reporting
    if (amount.gt(this.rules.complianceThresholds.largeTransaction)) {
      warnings.push('Large transaction - AML reporting may be required');
    }

    // Multiple cash payments pattern
    if (paymentData.method === 'cash' && settlement.payments) {
      const recentCashPayments = settlement.payments
        .filter(p => p.method === 'cash' && p.status === 'completed')
        .reduce((sum, p) => sum.plus(new Decimal(p.amount || 0)), new Decimal(0));

      if (recentCashPayments.plus(amount).gt(this.rules.maxCashPayment)) {
        warnings.push('Multiple cash payments approaching compliance threshold');
      }
    }

    // Structured transaction detection
    const commonStructuredAmounts = [49999, 99999, 199999, 499999];
    if (commonStructuredAmounts.includes(amount.toNumber())) {
      warnings.push('Payment amount matches common structuring pattern');
    }
  }

  /**
   * Validates payment business logic
   */
  _validatePaymentBusinessLogic(paymentData, settlement, violations, warnings) {
    const amount = new Decimal(paymentData.amount || 0);
    const outstanding = new Decimal(settlement.outstandingBalance || 0);

    // Validate payment timing
    if (settlement.status === 'completed') {
      violations.push('Cannot add payment to completed settlement');
    }

    if (settlement.status === 'cancelled') {
      violations.push('Cannot add payment to cancelled settlement');
    }

    // Validate overpayment handling
    if (amount.gt(outstanding) && !paymentData.allowOverpayment) {
      violations.push('Payment would result in overpayment');
    }

    // Validate partial payment logic
    if (amount.lt(outstanding) && amount.lt(outstanding.times(0.1))) {
      warnings.push('Very small partial payment - consider minimum payment policies');
    }
  }

  /**
   * Validates adjustment type
   */
  _validateAdjustmentType(adjustmentData, violations, warnings) {
    const validTypes = [
      'extra_person_charge', 'damage_charge', 'minibar_charge',
      'service_charge', 'discount', 'refund', 'penalty',
      'cancellation_fee', 'other'
    ];

    if (!validTypes.includes(adjustmentData.type)) {
      violations.push(`Invalid adjustment type: ${adjustmentData.type}`);
    }

    const amount = new Decimal(adjustmentData.amount || 0);

    // Validate amount based on type
    switch (adjustmentData.type) {
      case 'discount':
      case 'refund':
        if (amount.gt(0)) {
          warnings.push(`${adjustmentData.type} should typically be negative`);
        }
        break;

      case 'extra_person_charge':
      case 'damage_charge':
      case 'service_charge':
      case 'penalty':
        if (amount.lt(0)) {
          warnings.push(`${adjustmentData.type} should typically be positive`);
        }
        break;
    }
  }

  /**
   * Validates adjustment authorization
   */
  _validateAdjustmentAuthorization(adjustmentData, settlement, violations, warnings) {
    const amount = new Decimal(Math.abs(adjustmentData.amount || 0));

    // High-value adjustments require approval
    if (amount.gt(new Decimal(100000))) { // 1 Lakh INR
      if (!adjustmentData.appliedBy?.userRole ||
          !['admin', 'manager'].includes(adjustmentData.appliedBy.userRole)) {
        violations.push('High-value adjustment requires admin/manager authorization');
      }
    }

    // Damage charges require documentation
    if (adjustmentData.type === 'damage_charge' && !adjustmentData.attachments?.length) {
      warnings.push('Damage charge should include supporting documentation');
    }

    // Service charges validation
    if (adjustmentData.type === 'service_charge' && !adjustmentData.description) {
      violations.push('Service charge requires detailed description');
    }
  }

  /**
   * Validates adjustment impact
   */
  _validateAdjustmentImpact(adjustmentData, settlement, violations, warnings) {
    const adjustmentAmount = new Decimal(adjustmentData.amount || 0);
    const currentFinalAmount = new Decimal(settlement.finalAmount || 0);
    const newFinalAmount = currentFinalAmount.plus(adjustmentAmount);

    if (newFinalAmount.lt(0)) {
      violations.push('Adjustment would result in negative final amount');
    }

    // Validate adjustment percentage of original amount
    const originalAmount = new Decimal(settlement.originalAmount || 0);
    if (originalAmount.gt(0)) {
      const adjustmentPercentage = adjustmentAmount.abs().div(originalAmount);
      if (adjustmentPercentage.gt(new Decimal(1))) { // 100%
        warnings.push('Adjustment exceeds 100% of original amount');
      }
    }
  }

  /**
   * Validates refund eligibility
   */
  _validateRefundEligibility(refundData, settlement, violations, warnings) {
    // Basic eligibility checks
    if (settlement.status === 'cancelled') {
      violations.push('Cannot process refund for cancelled settlement');
    }

    if (settlement.totalPaid <= 0) {
      violations.push('No payments to refund');
    }

    // Time-based eligibility
    const settlementAge = Math.ceil((new Date() - new Date(settlement.createdAt)) / (1000 * 60 * 60 * 24));
    if (settlementAge > 365) { // 1 year
      warnings.push('Refund request for settlement older than 1 year');
    }
  }

  /**
   * Validates refund amount
   */
  _validateRefundAmount(refundData, settlement, violations, warnings) {
    const refundAmount = new Decimal(refundData.amount || 0);
    const totalPaid = new Decimal(settlement.totalPaid || 0);
    const finalAmount = new Decimal(settlement.finalAmount || 0);

    const maxRefundable = totalPaid.minus(finalAmount);

    if (refundAmount.gt(maxRefundable)) {
      violations.push(`Refund amount exceeds refundable amount (${maxRefundable.toFixed(2)})`);
    }

    if (refundAmount.gt(this.rules.complianceThresholds.suspiciousRefund)) {
      warnings.push('Large refund amount - enhanced verification recommended');
    }
  }

  /**
   * Validates refund method
   */
  _validateRefundMethod(refundData, settlement, violations, warnings) {
    const { method } = refundData;

    if (method === 'cash' && !refundData.reason) {
      violations.push('Cash refund requires detailed reason');
    }

    // Validate refund to source requirements
    if (method === 'refund_to_source') {
      const cardPayments = settlement.payments?.filter(p => p.method === 'card') || [];
      if (cardPayments.length === 0) {
        violations.push('No card payment found for refund to source');
      }
    }
  }

  /**
   * Determines if manager approval is required for payment
   */
  _requiresManagerApproval(paymentData, settlement) {
    const amount = new Decimal(paymentData.amount || 0);

    return (
      amount.gt(this.rules.complianceThresholds.largeTransaction) ||
      paymentData.method === 'cash' && amount.gt(this.rules.maxCashPayment.times(0.8)) ||
      settlement.flags?.requiresManagerApproval
    );
  }

  /**
   * Determines if adjustment approval is required
   */
  _requiresAdjustmentApproval(adjustmentData, settlement) {
    const amount = new Decimal(Math.abs(adjustmentData.amount || 0));

    return (
      amount.gt(new Decimal(100000)) || // 1 Lakh INR
      adjustmentData.type === 'discount' && amount.gt(new Decimal(50000)) ||
      settlement.flags?.requiresManagerApproval
    );
  }

  /**
   * Determines if refund approval is required
   */
  _requiresRefundApproval(refundData, settlement) {
    const amount = new Decimal(refundData.amount || 0);

    return (
      amount.gt(this.rules.complianceThresholds.suspiciousRefund) ||
      refundData.method === 'cash' ||
      settlement.flags?.requiresManagerApproval
    );
  }

  /**
   * Gets applied rules for audit trail
   */
  _getAppliedRules(settlementData) {
    return {
      maxSettlementAmount: this.rules.maxSettlementAmount.toNumber(),
      supportedCurrencies: this.rules.supportedCurrencies,
      maxOutstandingDays: this.rules.maxOutstandingDays,
      complianceThresholds: {
        largeTransaction: this.rules.complianceThresholds.largeTransaction.toNumber(),
        highValueGuest: this.rules.complianceThresholds.highValueGuest.toNumber()
      }
    };
  }

  /**
   * Updates business rules (for configuration management)
   */
  updateRules(newRules) {
    // Merge new rules with existing ones
    Object.keys(newRules).forEach(key => {
      if (this.rules.hasOwnProperty(key)) {
        if (typeof newRules[key] === 'object' && !Decimal.isDecimal(newRules[key])) {
          this.rules[key] = { ...this.rules[key], ...newRules[key] };
        } else {
          this.rules[key] = newRules[key];
        }
      }
    });
  }

  /**
   * Gets current rules configuration
   */
  getRules() {
    return JSON.parse(JSON.stringify(this.rules, (key, value) => {
      return Decimal.isDecimal(value) ? value.toNumber() : value;
    }));
  }
}

export default new FinancialRulesEngine();