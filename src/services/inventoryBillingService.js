import Invoice from '../models/Invoice.js';
import InventoryTransaction from '../models/InventoryTransaction.js';
import CheckoutInspection from '../models/CheckoutInspection.js';
import Booking from '../models/Booking.js';
import logger from '../utils/logger.js';

class InventoryBillingService {
  /**
   * Create invoice for inventory charges from checkout inspection
   */
  async createInventoryInvoice(checkoutInspectionId) {
    try {
      const inspection = await CheckoutInspection.findById(checkoutInspectionId)
        .populate('roomId')
        .populate('bookingId');

      if (!inspection) {
        throw new Error('Checkout inspection not found');
      }

      if (inspection.totalCharges <= 0) {
        logger.info('No charges to invoice for inspection', checkoutInspectionId);
        return null;
      }

      const booking = inspection.bookingId;
      
      // Calculate line items from inspection
      const lineItems = [];
      
      // Equipment damage charges
      inspection.checklistItems.forEach(item => {
        if (item.estimatedCost > 0 && item.status !== 'working' && item.status !== 'satisfactory') {
          lineItems.push({
            description: `${item.item} - ${item.status}`,
            quantity: 1,
            unitPrice: item.estimatedCost,
            totalPrice: item.estimatedCost,
            category: 'equipment_damage',
            itemDetails: {
              category: item.category,
              severity: item.severity,
              actionRequired: item.actionRequired,
              notes: item.notes
            }
          });
        }
      });

      // Inventory discrepancy charges
      inspection.inventoryVerification.forEach(item => {
        if (item.chargeGuest && item.chargeAmount > 0) {
          const quantity = item.discrepancy === 'missing' 
            ? (item.expectedQuantity - item.actualQuantity)
            : 1;
          
          lineItems.push({
            description: `${item.itemName} - ${item.discrepancy.replace('_', ' ')}`,
            quantity: quantity,
            unitPrice: item.chargeAmount / quantity,
            totalPrice: item.chargeAmount,
            category: 'inventory_charge',
            itemDetails: {
              itemId: item.itemId,
              expectedQuantity: item.expectedQuantity,
              actualQuantity: item.actualQuantity,
              condition: item.condition,
              discrepancy: item.discrepancy,
              location: item.location,
              notes: item.notes
            }
          });
        }
      });

      // Room damage charges
      inspection.damagesFound.forEach(damage => {
        if (damage.chargeGuest && damage.chargeAmount > 0) {
          lineItems.push({
            description: `Room damage: ${damage.description}`,
            quantity: damage.quantity,
            unitPrice: damage.chargeAmount / damage.quantity,
            totalPrice: damage.chargeAmount,
            category: 'room_damage',
            itemDetails: {
              type: damage.type,
              severity: damage.severity,
              location: damage.location,
              estimatedCost: damage.estimatedCost,
              chargeReason: damage.chargeReason
            }
          });
        }
      });

      const subtotal = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const tax = subtotal * 0.1; // 10% tax
      const total = subtotal + tax;

      // Create invoice
      const invoice = new Invoice({
        hotelId: inspection.hotelId,
        bookingId: booking._id,
        guestId: inspection.guestId,
        roomId: inspection.roomId._id,
        type: 'checkout_charges',
        status: 'pending',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Due in 24 hours
        lineItems: lineItems,
        subtotal: subtotal,
        taxAmount: tax,
        totalAmount: total,
        currency: 'USD',
        paymentTerms: 'Due on departure',
        notes: `Charges from checkout inspection of Room ${inspection.roomId.roomNumber}. Inspection completed on ${inspection.completedAt ? new Date(inspection.completedAt).toLocaleString() : 'N/A'}.`,
        metadata: {
          checkoutInspectionId: inspection._id,
          roomScore: inspection.roomConditionScore,
          inspectedBy: inspection.inspectedBy?.name,
          inspectionDuration: inspection.inspectionDuration
        },
        breakdown: {
          equipment: lineItems.filter(item => item.category === 'equipment_damage').reduce((sum, item) => sum + item.totalPrice, 0),
          inventory: lineItems.filter(item => item.category === 'inventory_charge').reduce((sum, item) => sum + item.totalPrice, 0),
          damages: lineItems.filter(item => item.category === 'room_damage').reduce((sum, item) => sum + item.totalPrice, 0),
          cleaning: 0,
          extras: 0
        }
      });

      await invoice.save();

      // Update checkout inspection with invoice reference
      inspection.invoiceId = invoice._id;
      inspection.inspectionStatus = 'pending_charges';
      await inspection.save();

      // Update booking with additional charges
      booking.additionalCharges = (booking.additionalCharges || 0) + total;
      booking.totalAmount = booking.baseAmount + booking.additionalCharges;
      await booking.save();

      logger.info(`Created inventory invoice ${invoice.invoiceNumber} for booking ${booking.bookingNumber}`);

      return invoice;
    } catch (error) {
      logger.error('Error creating inventory invoice:', error);
      throw error;
    }
  }

  /**
   * Create invoice for item replacement requests
   */
  async createReplacementInvoice(replacementRequestId, bookingId) {
    try {
      // Find all transactions related to this replacement request
      const transactions = await InventoryTransaction.find({
        replacementRequestId: replacementRequestId,
        status: 'approved',
        chargedToGuest: true
      }).populate('roomId').populate('bookingId');

      if (transactions.length === 0) {
        logger.info('No chargeable transactions found for replacement request', replacementRequestId);
        return null;
      }

      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      const lineItems = [];
      let subtotal = 0;

      transactions.forEach(transaction => {
        transaction.items.forEach(item => {
          if (item.isChargeable && item.totalCost > 0) {
            lineItems.push({
              description: `${item.name} replacement - ${item.reason}`,
              quantity: item.quantityChanged,
              unitPrice: item.unitPrice,
              totalPrice: item.totalCost,
              category: 'item_replacement',
              itemDetails: {
                itemId: item.itemId,
                category: item.category,
                condition: item.condition,
                chargeType: item.chargeType,
                location: item.location,
                notes: item.notes
              }
            });
            subtotal += item.totalCost;
          }
        });
      });

      if (lineItems.length === 0) {
        return null;
      }

      const tax = subtotal * 0.1; // 10% tax
      const total = subtotal + tax;

      const invoice = new Invoice({
        hotelId: booking.hotelId,
        bookingId: booking._id,
        guestId: booking.guestDetails._id,
        roomId: booking.roomId,
        type: 'replacement_charges',
        status: 'pending',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        lineItems: lineItems,
        subtotal: subtotal,
        taxAmount: tax,
        totalAmount: total,
        currency: 'USD',
        paymentTerms: 'Due on departure',
        notes: `Charges for item replacements during stay in Room ${transactions[0].roomId.roomNumber}.`,
        metadata: {
          replacementRequestId: replacementRequestId,
          transactionIds: transactions.map(t => t._id)
        },
        breakdown: {
          equipment: 0,
          inventory: lineItems.reduce((sum, item) => sum + item.totalPrice, 0),
          damages: 0,
          cleaning: 0,
          extras: 0
        }
      });

      await invoice.save();

      // Update transactions with invoice reference
      await InventoryTransaction.updateMany(
        { _id: { $in: transactions.map(t => t._id) } },
        { $set: { invoiceId: invoice._id } }
      );

      // Update booking with additional charges
      booking.additionalCharges = (booking.additionalCharges || 0) + total;
      booking.totalAmount = booking.baseAmount + booking.additionalCharges;
      await booking.save();

      logger.info(`Created replacement invoice ${invoice.invoiceNumber} for booking ${booking.bookingNumber}`);

      return invoice;
    } catch (error) {
      logger.error('Error creating replacement invoice:', error);
      throw error;
    }
  }

  /**
   * Process payment for inventory charges
   */
  async processInventoryPayment(invoiceId, paymentMethod, amount) {
    try {
      const invoice = await Invoice.findById(invoiceId)
        .populate('bookingId');

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.status !== 'pending') {
        throw new Error('Invoice is not in pending status');
      }

      if (amount !== invoice.totalAmount) {
        throw new Error('Payment amount does not match invoice total');
      }

      // Update invoice status
      invoice.status = 'paid';
      invoice.paidDate = new Date();
      invoice.paymentMethod = paymentMethod;
      invoice.paidAmount = amount;
      await invoice.save();

      // Update related checkout inspection if exists
      if (invoice.metadata?.checkoutInspectionId) {
        await CheckoutInspection.findByIdAndUpdate(
          invoice.metadata.checkoutInspectionId,
          {
            $set: {
              inspectionStatus: 'completed',
              canCheckout: true,
              checkoutBlocked: false
            }
          }
        );
      }

      // Update related transactions
      await InventoryTransaction.updateMany(
        { invoiceId: invoiceId },
        {
          $set: {
            status: 'completed',
            completedDate: new Date()
          }
        }
      );

      logger.info(`Processed payment for invoice ${invoice.invoiceNumber}: ${amount}`);

      return invoice;
    } catch (error) {
      logger.error('Error processing inventory payment:', error);
      throw error;
    }
  }

  /**
   * Generate billing summary for a booking
   */
  async getBookingInventoryCharges(bookingId) {
    try {
      const [transactions, inspections, invoices] = await Promise.all([
        InventoryTransaction.find({ 
          'bookingId._id': bookingId,
          chargedToGuest: true 
        }).sort({ createdAt: -1 }),
        CheckoutInspection.find({ 
          bookingId: bookingId 
        }).sort({ createdAt: -1 }),
        Invoice.find({ 
          bookingId: bookingId,
          type: { $in: ['checkout_charges', 'replacement_charges'] }
        }).sort({ createdAt: -1 })
      ]);

      const summary = {
        totalCharges: 0,
        replacementCharges: 0,
        damageCharges: 0,
        equipmentCharges: 0,
        cleaningCharges: 0,
        transactions: transactions.length,
        inspections: inspections.length,
        invoices: invoices.length,
        pendingAmount: 0,
        paidAmount: 0,
        details: {
          transactions: transactions.map(t => ({
            id: t._id,
            type: t.transactionType,
            amount: t.guestChargeAmount || 0,
            date: t.processedAt,
            status: t.status,
            items: t.items.filter(item => item.isChargeable).map(item => ({
              name: item.name,
              quantity: item.quantityChanged,
              cost: item.totalCost,
              reason: item.reason
            }))
          })),
          inspections: inspections.map(i => ({
            id: i._id,
            date: i.inspectionDate,
            score: i.roomConditionScore,
            charges: i.totalCharges,
            status: i.inspectionStatus,
            canCheckout: i.canCheckout
          })),
          invoices: invoices.map(i => ({
            id: i._id,
            number: i.invoiceNumber,
            type: i.type,
            amount: i.totalAmount,
            status: i.status,
            issueDate: i.issueDate,
            paidDate: i.paidDate
          }))
        }
      };

      // Calculate totals
      transactions.forEach(t => {
        const amount = t.guestChargeAmount || 0;
        summary.totalCharges += amount;
        
        switch (t.transactionType) {
          case 'replacement':
            summary.replacementCharges += amount;
            break;
          case 'damage':
            summary.damageCharges += amount;
            break;
          case 'extra_request':
            summary.equipmentCharges += amount;
            break;
          default:
            break;
        }
      });

      inspections.forEach(i => {
        summary.totalCharges += i.totalCharges || 0;
        summary.damageCharges += i.chargesSummary?.damages || 0;
        summary.equipmentCharges += i.chargesSummary?.missing || 0;
        summary.cleaningCharges += i.chargesSummary?.cleaning || 0;
      });

      invoices.forEach(i => {
        if (i.status === 'paid') {
          summary.paidAmount += i.totalAmount;
        } else {
          summary.pendingAmount += i.totalAmount;
        }
      });

      return summary;
    } catch (error) {
      logger.error('Error getting booking inventory charges:', error);
      throw error;
    }
  }

  /**
   * Auto-charge complimentary items that exceed limits
   */
  async processComplimentaryOverage(roomId, bookingId) {
    try {
      const transactions = await InventoryTransaction.find({
        'roomId._id': roomId,
        'bookingId._id': bookingId,
        transactionType: 'extra_request',
        status: 'approved'
      }).populate('items.itemId');

      const overageCharges = [];

      // Group transactions by item
      const itemUsage = new Map();
      
      transactions.forEach(transaction => {
        transaction.items.forEach(item => {
          const itemId = item.itemId._id.toString();
          if (!itemUsage.has(itemId)) {
            itemUsage.set(itemId, {
              itemId: item.itemId,
              totalRequested: 0,
              maxComplimentary: item.itemId.maxComplimentary,
              unitPrice: item.itemId.guestPrice || item.itemId.unitPrice,
              name: item.itemId.name
            });
          }
          itemUsage.get(itemId).totalRequested += item.quantityChanged;
        });
      });

      // Calculate overage charges
      for (const [itemId, usage] of itemUsage) {
        if (usage.totalRequested > usage.maxComplimentary) {
          const overageQuantity = usage.totalRequested - usage.maxComplimentary;
          const overageAmount = overageQuantity * usage.unitPrice;
          
          if (overageAmount > 0) {
            overageCharges.push({
              itemId: usage.itemId._id,
              itemName: usage.name,
              totalRequested: usage.totalRequested,
              complimentaryAllowed: usage.maxComplimentary,
              overageQuantity: overageQuantity,
              unitPrice: usage.unitPrice,
              totalCharge: overageAmount
            });
          }
        }
      }

      if (overageCharges.length > 0) {
        // Create overage invoice
        const booking = await Booking.findById(bookingId);
        const room = await InventoryTransaction.findOne({ 'roomId._id': roomId }).populate('roomId');
        
        const lineItems = overageCharges.map(charge => ({
          description: `${charge.itemName} overage (${charge.overageQuantity} above ${charge.complimentaryAllowed} complimentary)`,
          quantity: charge.overageQuantity,
          unitPrice: charge.unitPrice,
          totalPrice: charge.totalCharge,
          category: 'complimentary_overage',
          itemDetails: {
            itemId: charge.itemId,
            totalRequested: charge.totalRequested,
            complimentaryAllowed: charge.complimentaryAllowed
          }
        }));

        const subtotal = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
        const tax = subtotal * 0.1;
        const total = subtotal + tax;

        const invoice = new Invoice({
          hotelId: booking.hotelId,
          bookingId: booking._id,
          guestId: booking.guestDetails._id,
          roomId: roomId,
          type: 'overage_charges',
          status: 'pending',
          issueDate: new Date(),
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          lineItems: lineItems,
          subtotal: subtotal,
          taxAmount: tax,
          totalAmount: total,
          currency: 'USD',
          paymentTerms: 'Due on departure',
          notes: `Charges for complimentary item overages in Room ${room?.roomId?.roomNumber || 'N/A'}.`,
          metadata: {
            type: 'complimentary_overage',
            roomId: roomId
          },
          breakdown: {
            equipment: 0,
            inventory: 0,
            damages: 0,
            cleaning: 0,
            extras: total
          }
        });

        await invoice.save();

        // Update booking
        booking.additionalCharges = (booking.additionalCharges || 0) + total;
        booking.totalAmount = booking.baseAmount + booking.additionalCharges;
        await booking.save();

        logger.info(`Created overage invoice ${invoice.invoiceNumber} for booking ${booking.bookingNumber}`);

        return {
          invoice,
          overageCharges
        };
      }

      return null;
    } catch (error) {
      logger.error('Error processing complimentary overage:', error);
      throw error;
    }
  }
}

export default new InventoryBillingService();