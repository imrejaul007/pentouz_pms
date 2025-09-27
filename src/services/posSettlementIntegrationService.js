import BillingSession from '../models/BillingSession.js';
import Settlement from '../models/Settlement.js';
import CheckoutInventory from '../models/CheckoutInventory.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * POS Settlement Integration Service
 *
 * This service handles the integration between:
 * - POS Billing Sessions
 * - Settlement Management
 * - Checkout Inventory
 * - Payment Processing
 *
 * It provides a unified workflow for post-checkout payment processing.
 */
class POSSettlementIntegrationService {

  /**
   * Create settlement automatically from a completed billing session
   * @param {string} billingSessionId - The billing session ID
   * @param {Object} userContext - User performing the operation
   * @returns {Object} Created settlement and integration metadata
   */
  async createSettlementFromBillingSession(billingSessionId, userContext) {
    try {
      // Get the billing session with all related data
      const billingSession = await BillingSession.findById(billingSessionId)
        .populate('hotelId', 'name')
        .populate('bookingId', 'bookingNumber checkIn checkOut totalAmount userId')
        .populate('createdBy', 'name email');

      if (!billingSession) {
        throw new ApplicationError('Billing session not found', 404);
      }

      // Validate session is ready for settlement creation
      if (billingSession.status !== 'room_charged' && billingSession.status !== 'paid') {
        throw new ApplicationError('Only completed billing sessions can create settlements', 400);
      }

      // Check if settlement already exists for this booking
      let settlement = null;
      if (billingSession.bookingId) {
        settlement = await Settlement.findOne({ bookingId: billingSession.bookingId });
      }

      // If no existing settlement, create new one
      if (!settlement) {
        settlement = await this._createNewSettlementFromSession(billingSession, userContext);
      } else {
        // Add POS items to existing settlement as adjustments
        await this._addPOSItemsToExistingSettlement(settlement, billingSession, userContext);
      }

      // Mark billing session as integrated
      billingSession.settlementId = settlement._id;
      billingSession.integratedAt = new Date();
      await billingSession.save();

      return {
        settlement,
        billingSession,
        integration: {
          type: settlement.isNewRecord ? 'new_settlement_created' : 'added_to_existing_settlement',
          posItemsCount: billingSession.items.length,
          posTotal: billingSession.grandTotal,
          settlementTotal: settlement.finalAmount,
          integratedAt: new Date()
        }
      };

    } catch (error) {
      console.error('Error creating settlement from billing session:', error);
      throw new ApplicationError(`Settlement creation failed: ${error.message}`, 500);
    }
  }

  /**
   * Create new settlement from billing session
   * @private
   */
  async _createNewSettlementFromSession(billingSession, userContext) {
    // Get guest details
    let guestDetails = {
      guestName: billingSession.guestName,
      guestEmail: null,
      guestPhone: null
    };

    // Try to get more guest details from booking
    if (billingSession.bookingId && billingSession.bookingId.userId) {
      const user = await User.findById(billingSession.bookingId.userId);
      if (user) {
        guestDetails = {
          guestId: user._id,
          guestName: user.name || billingSession.guestName,
          guestEmail: user.email,
          guestPhone: user.phone
        };
      }
    }

    // Create settlement data
    const settlementData = {
      hotelId: billingSession.hotelId._id || billingSession.hotelId,
      bookingId: billingSession.bookingId?._id,
      originalAmount: billingSession.bookingId?.totalAmount || 0,
      finalAmount: billingSession.grandTotal,
      guestDetails,
      bookingDetails: billingSession.bookingId ? {
        bookingNumber: billingSession.bookingId.bookingNumber,
        checkInDate: billingSession.bookingId.checkIn,
        checkOutDate: billingSession.bookingId.checkOut,
        roomNumbers: [billingSession.roomNumber],
        nights: this._calculateNights(billingSession.bookingId.checkIn, billingSession.bookingId.checkOut)
      } : {
        bookingNumber: `POS-${billingSession.sessionId}`,
        roomNumbers: [billingSession.roomNumber]
      },
      adjustments: this._convertPOSItemsToAdjustments(billingSession.items, userContext),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      notes: `Settlement created from POS billing session: ${billingSession.sessionId}`,
      createdBy: userContext.userId,
      tags: ['pos_integration', 'auto_created']
    };

    const settlement = new Settlement(settlementData);
    settlement.isNewRecord = true; // Flag for response
    await settlement.save();

    return settlement;
  }

  /**
   * Add POS items to existing settlement as adjustments
   * @private
   */
  async _addPOSItemsToExistingSettlement(settlement, billingSession, userContext) {
    const posAdjustments = this._convertPOSItemsToAdjustments(billingSession.items, userContext);

    // Add each POS item as an adjustment
    for (const adjustment of posAdjustments) {
      settlement.addAdjustment({
        ...adjustment,
        description: `${adjustment.description} (from POS session: ${billingSession.sessionId})`
      }, userContext);
    }

    // Update settlement notes
    const existingNotes = settlement.notes || '';
    settlement.notes = `${existingNotes}\n\nPOS charges added from billing session: ${billingSession.sessionId} on ${new Date().toISOString()}`;

    await settlement.save();
  }

  /**
   * Convert POS items to settlement adjustments
   * @private
   */
  _convertPOSItemsToAdjustments(items, userContext) {
    return items.map(item => ({
      type: this._mapPOSCategoryToAdjustmentType(item.category),
      amount: item.price * item.quantity,
      description: `${item.name} (${item.quantity}x₹${item.price}) from ${item.outlet}`,
      category: this._mapPOSCategoryToSettlementCategory(item.category),
      taxable: true,
      taxAmount: item.tax * item.quantity,
      appliedBy: {
        userId: userContext.userId,
        userName: userContext.userName,
        userRole: userContext.userRole
      }
    }));
  }

  /**
   * Add checkout inventory items to existing settlement
   * @param {string} checkoutInventoryId - Checkout inventory ID
   * @param {string} settlementId - Settlement ID (optional)
   * @param {Object} userContext - User performing the operation
   * @returns {Object} Updated settlement and integration metadata
   */
  async addCheckoutInventoryToSettlement(checkoutInventoryId, settlementId = null, userContext) {
    try {
      // Get checkout inventory
      const checkoutInventory = await CheckoutInventory.findById(checkoutInventoryId)
        .populate('bookingId', 'bookingNumber')
        .populate('roomId', 'roomNumber')
        .populate('checkedBy', 'name');

      if (!checkoutInventory) {
        throw new ApplicationError('Checkout inventory not found', 404);
      }

      // Find or create settlement
      let settlement;
      if (settlementId) {
        settlement = await Settlement.findById(settlementId);
        if (!settlement) {
          throw new ApplicationError('Settlement not found', 404);
        }
      } else {
        // Find existing settlement by booking
        settlement = await Settlement.findOne({ bookingId: checkoutInventory.bookingId });

        if (!settlement) {
          // Create new settlement for checkout charges
          settlement = await this._createSettlementFromCheckoutInventory(checkoutInventory, userContext);
        }
      }

      // Add checkout items as adjustments
      await this._addCheckoutItemsToSettlement(settlement, checkoutInventory, userContext);

      // Update checkout inventory status
      checkoutInventory.status = 'completed';
      checkoutInventory.settlementId = settlement._id;
      await checkoutInventory.save();

      return {
        settlement,
        checkoutInventory,
        integration: {
          type: 'checkout_items_added',
          itemsCount: checkoutInventory.items.filter(item =>
            item.status === 'damaged' || item.status === 'missing'
          ).length,
          totalCharges: checkoutInventory.totalAmount,
          integratedAt: new Date()
        }
      };

    } catch (error) {
      console.error('Error adding checkout inventory to settlement:', error);
      throw new ApplicationError(`Checkout integration failed: ${error.message}`, 500);
    }
  }

  /**
   * Create settlement from checkout inventory
   * @private
   */
  async _createSettlementFromCheckoutInventory(checkoutInventory, userContext) {
    // Get guest details from booking
    const booking = await Booking.findById(checkoutInventory.bookingId)
      .populate('userId', 'name email phone');

    const guestDetails = {
      guestId: booking.userId?._id,
      guestName: booking.userId?.name || 'Unknown Guest',
      guestEmail: booking.userId?.email,
      guestPhone: booking.userId?.phone
    };

    const settlementData = {
      hotelId: booking.hotelId,
      bookingId: checkoutInventory.bookingId,
      originalAmount: booking.totalAmount,
      finalAmount: checkoutInventory.totalAmount, // Will be updated when items are added
      guestDetails,
      bookingDetails: {
        bookingNumber: booking.bookingNumber,
        checkInDate: booking.checkIn,
        checkOutDate: booking.checkOut,
        roomNumbers: [checkoutInventory.roomId.roomNumber],
        nights: this._calculateNights(booking.checkIn, booking.checkOut)
      },
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      notes: `Settlement created from checkout inventory for damages/missing items`,
      createdBy: userContext.userId,
      tags: ['checkout_integration', 'damage_charges', 'auto_created']
    };

    const settlement = new Settlement(settlementData);
    await settlement.save();

    return settlement;
  }

  /**
   * Add checkout items to settlement as damage/missing adjustments
   * @private
   */
  async _addCheckoutItemsToSettlement(settlement, checkoutInventory, userContext) {
    const chargeableItems = checkoutInventory.items.filter(item =>
      item.status === 'damaged' || item.status === 'missing'
    );

    for (const item of chargeableItems) {
      const adjustmentType = item.status === 'damaged' ? 'damage_charge' : 'other';
      const description = `${item.itemName} - ${item.status} (${item.quantity}x₹${item.unitPrice})${item.notes ? ` - ${item.notes}` : ''}`;

      settlement.addAdjustment({
        type: adjustmentType,
        amount: item.totalPrice,
        description,
        category: 'damages',
        taxable: true,
        taxAmount: Math.round(item.totalPrice * 0.18), // 18% GST
        appliedBy: {
          userId: userContext.userId,
          userName: userContext.userName,
          userRole: userContext.userRole
        }
      }, userContext);
    }

    // Update settlement notes
    const existingNotes = settlement.notes || '';
    settlement.notes = `${existingNotes}\n\nCheckout charges added: ${chargeableItems.length} items totaling ₹${checkoutInventory.totalAmount}`;

    await settlement.save();
  }

  /**
   * Process unified payment across POS and Settlement systems
   * @param {string} settlementId - Settlement ID
   * @param {Object} paymentData - Payment information
   * @param {Object} userContext - User performing the operation
   * @returns {Object} Payment result and updated systems
   */
  async processUnifiedPayment(settlementId, paymentData, userContext) {
    try {
      const settlement = await Settlement.findById(settlementId);
      if (!settlement) {
        throw new ApplicationError('Settlement not found', 404);
      }

      // Validate payment amount
      if (paymentData.amount > settlement.outstandingBalance) {
        throw new ApplicationError('Payment amount cannot exceed outstanding balance', 400);
      }

      // Add payment to settlement
      const payment = settlement.addPayment(paymentData, userContext);
      await settlement.save();

      // If settlement is fully paid, mark any related billing sessions as settled
      if (settlement.status === 'completed') {
        await this._markRelatedBillingSessionsAsSettled(settlement);
      }

      return {
        settlement,
        payment,
        integration: {
          type: 'unified_payment_processed',
          amount: paymentData.amount,
          method: paymentData.method,
          newBalance: settlement.outstandingBalance,
          isFullyPaid: settlement.status === 'completed',
          processedAt: new Date()
        }
      };

    } catch (error) {
      console.error('Error processing unified payment:', error);
      throw new ApplicationError(`Payment processing failed: ${error.message}`, 500);
    }
  }

  /**
   * Get settlement preview for a booking
   * @param {string} bookingId - Booking ID
   * @returns {Object} Settlement preview data
   */
  async getSettlementPreview(bookingId) {
    try {
      const booking = await Booking.findById(bookingId)
        .populate('userId', 'name email phone')
        .populate('hotelId', 'name');

      if (!booking) {
        throw new ApplicationError('Booking not found', 404);
      }

      // Check for existing settlement
      const existingSettlement = await Settlement.findOne({ bookingId });

      // Get related POS billing sessions
      const billingSessions = await BillingSession.find({
        bookingId,
        status: { $in: ['room_charged', 'paid'] }
      });

      // Get checkout inventory
      const checkoutInventory = await CheckoutInventory.findOne({ bookingId })
        .populate('roomId', 'roomNumber');

      // Calculate preview totals
      let preview = {
        booking: {
          id: booking._id,
          bookingNumber: booking.bookingNumber,
          totalAmount: booking.totalAmount,
          paidAmount: booking.paymentDetails?.totalPaid || 0
        },
        existingSettlement: existingSettlement ? {
          id: existingSettlement._id,
          settlementNumber: existingSettlement.settlementNumber,
          status: existingSettlement.status,
          finalAmount: existingSettlement.finalAmount,
          outstandingBalance: existingSettlement.outstandingBalance
        } : null,
        posCharges: {
          sessions: billingSessions.map(session => ({
            sessionId: session.sessionId,
            grandTotal: session.grandTotal,
            itemsCount: session.items.length,
            status: session.status,
            createdAt: session.createdAt
          })),
          totalAmount: billingSessions.reduce((sum, session) => sum + session.grandTotal, 0)
        },
        checkoutCharges: checkoutInventory ? {
          inventoryId: checkoutInventory._id,
          totalAmount: checkoutInventory.totalAmount,
          chargeableItemsCount: checkoutInventory.items.filter(item =>
            item.status === 'damaged' || item.status === 'missing'
          ).length,
          status: checkoutInventory.status
        } : null,
        projectedSettlement: null
      };

      // Calculate projected settlement if new
      if (!existingSettlement) {
        preview.projectedSettlement = {
          originalAmount: booking.totalAmount,
          posCharges: preview.posCharges.totalAmount,
          checkoutCharges: checkoutInventory?.totalAmount || 0,
          projectedTotal: booking.totalAmount + preview.posCharges.totalAmount + (checkoutInventory?.totalAmount || 0),
          integrationNeeded: billingSessions.length > 0 || (checkoutInventory && checkoutInventory.totalAmount > 0)
        };
      }

      return preview;

    } catch (error) {
      console.error('Error generating settlement preview:', error);
      throw new ApplicationError(`Preview generation failed: ${error.message}`, 500);
    }
  }

  /**
   * Sync guest data across POS and Settlement systems
   * @param {string} bookingId - Booking ID
   * @returns {Object} Sync result
   */
  async syncGuestDataAcrossSystems(bookingId) {
    try {
      const booking = await Booking.findById(bookingId)
        .populate('userId', 'name email phone');

      if (!booking) {
        throw new ApplicationError('Booking not found', 404);
      }

      const guestData = {
        guestId: booking.userId?._id,
        guestName: booking.userId?.name,
        guestEmail: booking.userId?.email,
        guestPhone: booking.userId?.phone
      };

      const updates = [];

      // Update billing sessions
      const billingSessions = await BillingSession.find({ bookingId });
      for (const session of billingSessions) {
        if (session.guestName !== guestData.guestName) {
          session.guestName = guestData.guestName;
          await session.save();
          updates.push(`Updated billing session ${session.sessionId}`);
        }
      }

      // Update settlement
      const settlement = await Settlement.findOne({ bookingId });
      if (settlement) {
        let updated = false;
        if (settlement.guestDetails.guestName !== guestData.guestName) {
          settlement.guestDetails.guestName = guestData.guestName;
          updated = true;
        }
        if (settlement.guestDetails.guestEmail !== guestData.guestEmail) {
          settlement.guestDetails.guestEmail = guestData.guestEmail;
          updated = true;
        }
        if (settlement.guestDetails.guestPhone !== guestData.guestPhone) {
          settlement.guestDetails.guestPhone = guestData.guestPhone;
          updated = true;
        }

        if (updated) {
          await settlement.save();
          updates.push(`Updated settlement ${settlement.settlementNumber}`);
        }
      }

      return {
        guestData,
        updatesApplied: updates,
        syncedAt: new Date()
      };

    } catch (error) {
      console.error('Error syncing guest data:', error);
      throw new ApplicationError(`Guest data sync failed: ${error.message}`, 500);
    }
  }

  // Helper methods

  /**
   * Calculate nights between dates
   * @private
   */
  _calculateNights(checkIn, checkOut) {
    if (!checkIn || !checkOut) return 1;
    const diffTime = Math.abs(new Date(checkOut) - new Date(checkIn));
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Map POS category to adjustment type
   * @private
   */
  _mapPOSCategoryToAdjustmentType(category) {
    const mapping = {
      'food': 'service_charge',
      'beverage': 'service_charge',
      'spa': 'service_charge',
      'laundry': 'service_charge',
      'minibar': 'minibar_charge',
      'room_service': 'service_charge'
    };
    return mapping[category?.toLowerCase()] || 'service_charge';
  }

  /**
   * Map POS category to settlement category
   * @private
   */
  _mapPOSCategoryToSettlementCategory(category) {
    const mapping = {
      'food': 'food_beverage',
      'beverage': 'food_beverage',
      'spa': 'amenities',
      'laundry': 'services',
      'minibar': 'amenities',
      'room_service': 'services'
    };
    return mapping[category?.toLowerCase()] || 'services';
  }

  /**
   * Mark related billing sessions as settled
   * @private
   */
  async _markRelatedBillingSessionsAsSettled(settlement) {
    if (!settlement.bookingId) return;

    await BillingSession.updateMany(
      {
        bookingId: settlement.bookingId,
        status: { $in: ['room_charged', 'paid'] }
      },
      {
        $set: {
          settlementStatus: 'settled',
          settledAt: new Date()
        }
      }
    );
  }
}

export default new POSSettlementIntegrationService();