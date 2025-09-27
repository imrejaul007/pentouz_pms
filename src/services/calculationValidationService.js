import Decimal from 'decimal.js';
import { ApplicationError } from '../middleware/errorHandler.js';

/**
 * Calculation Validation Service
 * Ensures financial accuracy and prevents calculation errors in the Settlement system
 * Uses Decimal.js for precise financial calculations to avoid floating-point precision issues
 */
class CalculationValidationService {
  constructor() {
    // Configure Decimal.js for financial precision
    Decimal.set({
      precision: 28, // High precision for financial calculations
      rounding: Decimal.ROUND_HALF_UP, // Standard financial rounding
      toExpNeg: -15, // Use exponential form for very small numbers
      toExpPos: 20   // Use exponential form for very large numbers
    });
  }

  /**
   * Validates all financial calculations in a settlement
   * @param {Object} settlement - Settlement object to validate
   * @returns {Object} - Validation result with corrections if needed
   */
  validateSettlementCalculations(settlement) {
    const validationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      corrections: {},
      originalValues: {},
      calculations: {}
    };

    try {
      // Store original values for audit trail
      validationResult.originalValues = {
        finalAmount: settlement.finalAmount,
        totalPaid: settlement.totalPaid,
        outstandingBalance: settlement.outstandingBalance,
        refundAmount: settlement.refundAmount
      };

      // 1. Validate basic financial constraints
      this._validateBasicConstraints(settlement, validationResult);

      // 2. Validate outstanding balance calculation
      this._validateOutstandingBalance(settlement, validationResult);

      // 3. Validate refund amount calculation
      this._validateRefundAmount(settlement, validationResult);

      // 4. Validate payment totals
      this._validatePaymentTotals(settlement, validationResult);

      // 5. Validate adjustment calculations
      this._validateAdjustments(settlement, validationResult);

      // 6. Validate tax calculations
      this._validateTaxCalculations(settlement, validationResult);

      // 7. Validate currency consistency
      this._validateCurrencyConsistency(settlement, validationResult);

      // 8. Validate business rules
      this._validateBusinessRules(settlement, validationResult);

      // Set overall validation status
      validationResult.isValid = validationResult.errors.length === 0;

    } catch (error) {
      validationResult.isValid = false;
      validationResult.errors.push(`Validation error: ${error.message}`);
    }

    return validationResult;
  }

  /**
   * Validates basic financial constraints
   */
  _validateBasicConstraints(settlement, result) {
    // Check for negative amounts where not allowed
    if (settlement.originalAmount < 0) {
      result.errors.push('Original amount cannot be negative');
    }

    if (settlement.finalAmount < 0) {
      result.errors.push('Final amount cannot be negative');
    }

    if (settlement.totalPaid < 0) {
      result.errors.push('Total paid cannot be negative');
    }

    // Check for reasonable amount limits (prevent unrealistic values)
    const maxAmount = new Decimal('999999999.99'); // 999M max
    if (new Decimal(settlement.finalAmount).gt(maxAmount)) {
      result.warnings.push('Final amount is unusually large and may need review');
    }

    // Check for zero amounts that might indicate missing data
    if (settlement.finalAmount === 0 && settlement.originalAmount > 0) {
      result.warnings.push('Final amount is zero but original amount is positive - verify adjustments');
    }
  }

  /**
   * Validates outstanding balance calculation
   * Formula: outstandingBalance = max(0, finalAmount - totalPaid)
   */
  _validateOutstandingBalance(settlement, result) {
    const finalAmount = new Decimal(settlement.finalAmount || 0);
    const totalPaid = new Decimal(settlement.totalPaid || 0);
    const expectedOutstanding = Decimal.max(0, finalAmount.minus(totalPaid));
    const actualOutstanding = new Decimal(settlement.outstandingBalance || 0);

    if (!expectedOutstanding.equals(actualOutstanding)) {
      result.errors.push(
        `Outstanding balance calculation error. Expected: ${expectedOutstanding.toFixed(2)}, ` +
        `Actual: ${actualOutstanding.toFixed(2)}`
      );
      result.corrections.outstandingBalance = expectedOutstanding.toNumber();
    }

    result.calculations.outstandingBalance = {
      formula: 'max(0, finalAmount - totalPaid)',
      finalAmount: finalAmount.toNumber(),
      totalPaid: totalPaid.toNumber(),
      expected: expectedOutstanding.toNumber(),
      actual: actualOutstanding.toNumber()
    };
  }

  /**
   * Validates refund amount calculation
   * Formula: refundAmount = max(0, totalPaid - finalAmount)
   */
  _validateRefundAmount(settlement, result) {
    const finalAmount = new Decimal(settlement.finalAmount || 0);
    const totalPaid = new Decimal(settlement.totalPaid || 0);
    const expectedRefund = Decimal.max(0, totalPaid.minus(finalAmount));
    const actualRefund = new Decimal(settlement.refundAmount || 0);

    if (!expectedRefund.equals(actualRefund)) {
      result.errors.push(
        `Refund amount calculation error. Expected: ${expectedRefund.toFixed(2)}, ` +
        `Actual: ${actualRefund.toFixed(2)}`
      );
      result.corrections.refundAmount = expectedRefund.toNumber();
    }

    result.calculations.refundAmount = {
      formula: 'max(0, totalPaid - finalAmount)',
      finalAmount: finalAmount.toNumber(),
      totalPaid: totalPaid.toNumber(),
      expected: expectedRefund.toNumber(),
      actual: actualRefund.toNumber()
    };
  }

  /**
   * Validates payment totals against payment records
   */
  _validatePaymentTotals(settlement, result) {
    if (!settlement.payments || settlement.payments.length === 0) {
      if (settlement.totalPaid > 0) {
        result.errors.push('Total paid is greater than zero but no payment records exist');
      }
      return;
    }

    // Calculate total from completed payments only
    const calculatedTotal = settlement.payments
      .filter(payment => payment.status === 'completed')
      .reduce((total, payment) => {
        return total.plus(new Decimal(payment.amount || 0));
      }, new Decimal(0));

    const actualTotal = new Decimal(settlement.totalPaid || 0);

    if (!calculatedTotal.equals(actualTotal)) {
      result.errors.push(
        `Payment total mismatch. Calculated from payments: ${calculatedTotal.toFixed(2)}, ` +
        `Stored total: ${actualTotal.toFixed(2)}`
      );
      result.corrections.totalPaid = calculatedTotal.toNumber();
    }

    // Validate individual payment amounts
    settlement.payments.forEach((payment, index) => {
      if (payment.amount <= 0) {
        result.errors.push(`Payment ${index + 1} has invalid amount: ${payment.amount}`);
      }
      if (!payment.method) {
        result.errors.push(`Payment ${index + 1} is missing payment method`);
      }
    });

    result.calculations.paymentTotal = {
      calculatedFromPayments: calculatedTotal.toNumber(),
      storedTotal: actualTotal.toNumber(),
      completedPayments: settlement.payments.filter(p => p.status === 'completed').length,
      totalPayments: settlement.payments.length
    };
  }

  /**
   * Validates adjustment calculations
   */
  _validateAdjustments(settlement, result) {
    if (!settlement.adjustments || settlement.adjustments.length === 0) {
      return;
    }

    let adjustmentTotal = new Decimal(0);
    let taxTotal = new Decimal(0);

    settlement.adjustments.forEach((adjustment, index) => {
      const amount = new Decimal(adjustment.amount || 0);
      const taxAmount = new Decimal(adjustment.taxAmount || 0);

      // Validate adjustment amount
      if (amount.isZero()) {
        result.warnings.push(`Adjustment ${index + 1} has zero amount`);
      }

      // Validate tax calculation if taxable
      if (adjustment.taxable && taxAmount.isZero() && !amount.isZero()) {
        result.warnings.push(`Adjustment ${index + 1} is marked taxable but has zero tax amount`);
      }

      // Validate negative adjustments (discounts, refunds)
      const isCredit = ['discount', 'refund'].includes(adjustment.type);
      if (isCredit && amount.gt(0)) {
        result.warnings.push(`Adjustment ${index + 1} of type '${adjustment.type}' should be negative`);
      }

      adjustmentTotal = adjustmentTotal.plus(amount);
      taxTotal = taxTotal.plus(taxAmount);
    });

    // Calculate expected final amount
    const originalAmount = new Decimal(settlement.originalAmount || 0);
    const expectedFinalAmount = originalAmount.plus(adjustmentTotal).plus(taxTotal);
    const actualFinalAmount = new Decimal(settlement.finalAmount || 0);

    if (!expectedFinalAmount.equals(actualFinalAmount)) {
      result.warnings.push(
        `Final amount may not reflect adjustments correctly. ` +
        `Original: ${originalAmount.toFixed(2)}, ` +
        `Adjustments: ${adjustmentTotal.toFixed(2)}, ` +
        `Tax: ${taxTotal.toFixed(2)}, ` +
        `Expected Final: ${expectedFinalAmount.toFixed(2)}, ` +
        `Actual Final: ${actualFinalAmount.toFixed(2)}`
      );
    }

    result.calculations.adjustments = {
      totalAdjustments: adjustmentTotal.toNumber(),
      totalTax: taxTotal.toNumber(),
      originalAmount: originalAmount.toNumber(),
      expectedFinalAmount: expectedFinalAmount.toNumber(),
      actualFinalAmount: actualFinalAmount.toNumber()
    };
  }

  /**
   * Validates tax calculations for adjustments
   */
  _validateTaxCalculations(settlement, result) {
    if (!settlement.adjustments || settlement.adjustments.length === 0) {
      return;
    }

    settlement.adjustments.forEach((adjustment, index) => {
      if (!adjustment.taxable) return;

      const amount = new Decimal(adjustment.amount || 0);
      const taxAmount = new Decimal(adjustment.taxAmount || 0);

      // Basic tax validation - assuming 18% GST (can be configurable)
      const expectedTaxRate = new Decimal(0.18);
      const expectedTax = amount.times(expectedTaxRate);

      // Allow for small rounding differences
      const tolerance = new Decimal(0.01);
      if (taxAmount.minus(expectedTax).abs().gt(tolerance)) {
        result.warnings.push(
          `Adjustment ${index + 1} tax calculation may be incorrect. ` +
          `Amount: ${amount.toFixed(2)}, ` +
          `Expected Tax (18%): ${expectedTax.toFixed(2)}, ` +
          `Actual Tax: ${taxAmount.toFixed(2)}`
        );
      }
    });
  }

  /**
   * Validates currency consistency
   */
  _validateCurrencyConsistency(settlement, result) {
    const currency = settlement.currency || 'INR';

    // Check if all monetary values use same currency context
    if (!currency.match(/^[A-Z]{3}$/)) {
      result.errors.push(`Invalid currency format: ${currency}`);
    }

    // Validate decimal places for currency
    const decimalPlaces = this._getCurrencyDecimalPlaces(currency);
    const amounts = [
      { name: 'finalAmount', value: settlement.finalAmount },
      { name: 'totalPaid', value: settlement.totalPaid },
      { name: 'outstandingBalance', value: settlement.outstandingBalance },
      { name: 'refundAmount', value: settlement.refundAmount }
    ];

    amounts.forEach(({ name, value }) => {
      if (value && !this._hasValidDecimalPlaces(value, decimalPlaces)) {
        result.warnings.push(
          `${name} has invalid decimal places for currency ${currency}: ${value}`
        );
      }
    });
  }

  /**
   * Validates business rules
   */
  _validateBusinessRules(settlement, result) {
    // Rule 1: Outstanding balance and refund amount are mutually exclusive
    const outstanding = new Decimal(settlement.outstandingBalance || 0);
    const refund = new Decimal(settlement.refundAmount || 0);

    if (outstanding.gt(0) && refund.gt(0)) {
      result.errors.push('Outstanding balance and refund amount cannot both be greater than zero');
    }

    // Rule 2: Validate status consistency with amounts
    if (settlement.status === 'completed') {
      if (outstanding.gt(0)) {
        result.errors.push('Settlement marked as completed but has outstanding balance');
      }
      if (refund.gt(0) && settlement.status !== 'refunded') {
        result.warnings.push('Settlement has refund amount but status is not refunded');
      }
    }

    // Rule 3: Prevent overpayment without refund processing
    const finalAmount = new Decimal(settlement.finalAmount || 0);
    const totalPaid = new Decimal(settlement.totalPaid || 0);

    if (totalPaid.gt(finalAmount) && refund.isZero()) {
      result.errors.push('Overpayment detected but refund amount is zero');
    }

    // Rule 4: Validate payment method constraints
    if (settlement.payments) {
      const cashPayments = settlement.payments.filter(p => p.method === 'cash');
      const totalCash = cashPayments.reduce((sum, p) => sum.plus(new Decimal(p.amount || 0)), new Decimal(0));

      // Warn for large cash payments (potential compliance issue)
      if (totalCash.gt(new Decimal(200000))) { // 2 Lakh INR
        result.warnings.push('Large cash payment detected - may require compliance review');
      }
    }
  }

  /**
   * Gets decimal places for currency
   */
  _getCurrencyDecimalPlaces(currency) {
    const currencyDecimals = {
      'INR': 2,
      'USD': 2,
      'EUR': 2,
      'GBP': 2,
      'JPY': 0
    };
    return currencyDecimals[currency] || 2;
  }

  /**
   * Validates decimal places for amount
   */
  _hasValidDecimalPlaces(amount, maxDecimals) {
    const decimal = new Decimal(amount);
    const decimalPlaces = decimal.decimalPlaces();
    return decimalPlaces <= maxDecimals;
  }

  /**
   * Corrects calculation errors in settlement
   */
  applyCalculationCorrections(settlement, corrections) {
    let hasChanges = false;

    Object.keys(corrections).forEach(field => {
      if (settlement[field] !== corrections[field]) {
        settlement[field] = corrections[field];
        hasChanges = true;
      }
    });

    // Recalculate dependent values
    if (hasChanges) {
      const finalAmount = new Decimal(settlement.finalAmount || 0);
      const totalPaid = new Decimal(settlement.totalPaid || 0);

      settlement.outstandingBalance = Decimal.max(0, finalAmount.minus(totalPaid)).toNumber();
      settlement.refundAmount = Decimal.max(0, totalPaid.minus(finalAmount)).toNumber();
    }

    return hasChanges;
  }

  /**
   * Validates payment amount against outstanding balance
   */
  validatePaymentAmount(settlement, paymentAmount, allowOverpayment = false) {
    const outstanding = new Decimal(settlement.outstandingBalance || 0);
    const payment = new Decimal(paymentAmount);

    if (payment.lte(0)) {
      throw new ApplicationError('Payment amount must be greater than zero', 400);
    }

    if (!allowOverpayment && payment.gt(outstanding)) {
      throw new ApplicationError(
        `Payment amount (${payment.toFixed(2)}) exceeds outstanding balance (${outstanding.toFixed(2)})`,
        400
      );
    }

    return {
      isValid: true,
      payment: payment.toNumber(),
      outstanding: outstanding.toNumber(),
      willBeOverpaid: payment.gt(outstanding)
    };
  }

  /**
   * Calculates late fees based on settlement terms
   */
  calculateLateFee(settlement, asOfDate = new Date()) {
    if (!settlement.dueDate || !settlement.terms?.lateFeeRate) {
      return { lateFee: 0, daysLate: 0, applicable: false };
    }

    const dueDate = new Date(settlement.dueDate);
    const currentDate = new Date(asOfDate);
    const gracePeriod = settlement.terms.gracePeriod || 0;

    // Calculate days late considering grace period
    const gracePeriodEnd = new Date(dueDate);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriod);

    if (currentDate <= gracePeriodEnd) {
      return { lateFee: 0, daysLate: 0, applicable: false };
    }

    const daysLate = Math.ceil((currentDate - gracePeriodEnd) / (1000 * 60 * 60 * 24));
    const monthsLate = daysLate / 30; // Approximate months

    const outstandingBalance = new Decimal(settlement.outstandingBalance || 0);
    const lateFeeRate = new Decimal(settlement.terms.lateFeeRate / 100); // Convert percentage

    const lateFee = outstandingBalance.times(lateFeeRate).times(monthsLate);

    return {
      lateFee: lateFee.toNumber(),
      daysLate,
      monthsLate: Number(monthsLate.toFixed(2)),
      applicable: true,
      calculationDetails: {
        outstandingBalance: outstandingBalance.toNumber(),
        lateFeeRate: settlement.terms.lateFeeRate,
        daysLate,
        monthsLate: Number(monthsLate.toFixed(2))
      }
    };
  }
}

export default new CalculationValidationService();