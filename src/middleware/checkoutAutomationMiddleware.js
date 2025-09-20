import checkoutAutomationService from '../services/checkoutAutomationService.js';
import logger from '../utils/logger.js';

/**
 * Checkout Automation Middleware
 * 
 * Automatically triggers checkout automation when booking status changes to 'checked_out'
 * This middleware integrates with the Booking model's status change handling
 */

/**
 * Middleware to trigger checkout automation after booking status change
 * @param {Object} booking - Booking document
 * @param {string} newStatus - New booking status
 * @param {string} oldStatus - Previous booking status
 * @param {Object} context - Status change context
 */
export const triggerCheckoutAutomation = async (booking, newStatus, oldStatus, context = {}) => {
  // Only trigger for checkout status changes
  if (newStatus !== 'checked_out' || oldStatus === 'checked_out') {
    return;
  }

  // Check if automation is enabled for this booking
  if (context.enableAutomation === false) {
    logger.info('Checkout automation disabled for booking', { 
      bookingId: booking._id,
      reason: 'explicitly disabled'
    });
    return;
  }

  try {
    logger.info('Triggering checkout automation', { 
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
      hotelId: booking.hotelId
    });

    // Trigger automation asynchronously to avoid blocking the status change
    setImmediate(async () => {
      try {
        const result = await checkoutAutomationService.processCheckout(booking._id, {
          processedBy: context.userId || 'system',
          source: 'status_change_trigger'
        });

        logger.info('Checkout automation completed', {
          bookingId: booking._id,
          success: result.success,
          message: result.message
        });
      } catch (error) {
        logger.error('Checkout automation failed', {
          bookingId: booking._id,
          error: error.message,
          stack: error.stack
        });
      }
    });

  } catch (error) {
    logger.error('Failed to trigger checkout automation', {
      bookingId: booking._id,
      error: error.message
    });
  }
};

/**
 * Middleware to handle booking status changes
 * This should be called from the Booking model's post-save middleware
 */
export const bookingStatusChangeMiddleware = async function() {
  // Check if this is a status change
  if (this.isModified('status') && this._previousStatus) {
    await triggerCheckoutAutomation(
      this,
      this.status,
      this._previousStatus,
      this._statusChangeContext || {}
    );
  }
};

/**
 * Pre-save middleware to store previous status
 */
export const bookingPreSaveMiddleware = function(next) {
  // Store previous status for comparison
  if (this.isModified('status') && !this.isNew) {
    this._previousStatus = this.constructor.findById(this._id).select('status').status;
  }
  next();
};

/**
 * Post-save middleware to trigger automation
 */
export const bookingPostSaveMiddleware = async function() {
  // Only process for existing documents (not new ones)
  if (!this.isNew) {
    await bookingStatusChangeMiddleware.call(this);
  }
};

export default {
  triggerCheckoutAutomation,
  bookingStatusChangeMiddleware,
  bookingPreSaveMiddleware,
  bookingPostSaveMiddleware
};
