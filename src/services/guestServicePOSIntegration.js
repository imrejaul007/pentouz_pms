import POSOrder from '../models/POSOrder.js';
import POSOutlet from '../models/POSOutlet.js';
import posTaxCalculationService from './posTaxCalculationService.js';
import websocketService from './websocketService.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Guest Service to POS Integration Service
 * Handles automatic creation of POS orders from guest service requests
 */

class GuestServicePOSIntegrationService {

  /**
   * Create a POS order from guest service request
   * @param {Object} serviceRequest - The guest service request object
   * @param {Object} options - Additional options for order creation
   * @returns {Object} Created POS order or null if not applicable
   */
  async createPOSOrderFromServiceRequest(serviceRequest, options = {}) {
    try {
      // Only create POS orders for food-related service requests
      if (!this.isFoodServiceRequest(serviceRequest)) {
        console.log('Service request is not food-related, skipping POS order creation');
        return null;
      }

      // Find the appropriate outlet for the service request
      const outlet = await this.findAppropriateOutlet(serviceRequest);
      if (!outlet) {
        console.error('No appropriate outlet found for service request');
        return null;
      }

      // Prepare order data
      const orderData = await this.prepareOrderData(serviceRequest, outlet, options);

      // Calculate taxes and totals
      await this.calculateOrderTotals(orderData, outlet);

      // Generate order number
      orderData.orderNumber = await this.generateOrderNumber();

      // Create the POS order
      const posOrder = new POSOrder(orderData);
      await posOrder.save();

      // Populate order for response
      await posOrder.populate('outlet', 'name type');
      await posOrder.populate('customer.guest', 'name email');

      console.log(`POS order ${posOrder.orderNumber} created from service request ${serviceRequest._id}`);

      // Send real-time notification to kitchen/staff
      await this.notifyKitchenStaff(posOrder, outlet);

      return posOrder;

    } catch (error) {
      console.error('Error creating POS order from service request:', error);
      throw error;
    }
  }

  /**
   * Check if service request is food-related
   * @param {Object} serviceRequest - The service request to check
   * @returns {boolean} True if food-related
   */
  isFoodServiceRequest(serviceRequest) {
    const foodServiceTypes = ['room_service', 'food_order', 'dining'];
    const foodVariations = ['food_order', 'meal_delivery', 'dining_service', 'food & beverage delivery'];

    // Check service type
    if (foodServiceTypes.includes(serviceRequest.serviceType)) {
      return true;
    }

    // Check service variation
    if (serviceRequest.serviceVariation &&
        foodVariations.some(variation =>
          serviceRequest.serviceVariation.toLowerCase().includes(variation.toLowerCase())
        )) {
      return true;
    }

    // Check if items are present (indicates food order)
    if (serviceRequest.items && serviceRequest.items.length > 0) {
      return true;
    }

    // Check title/description for food-related keywords
    const foodKeywords = ['food', 'meal', 'dinner', 'lunch', 'breakfast', 'snack', 'beverage', 'drink', 'order'];
    const text = `${serviceRequest.title} ${serviceRequest.description}`.toLowerCase();

    return foodKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * Find appropriate outlet for the service request
   * @param {Object} serviceRequest - The service request
   * @returns {Object} POS outlet or null
   */
  async findAppropriateOutlet(serviceRequest) {
    try {
      // For room service, find room service outlet
      if (serviceRequest.serviceType === 'room_service') {
        const roomServiceOutlet = await POSOutlet.findOne({
          type: 'room_service',
          isActive: true
        });
        if (roomServiceOutlet) return roomServiceOutlet;
      }

      // Fallback to main restaurant
      const mainRestaurant = await POSOutlet.findOne({
        type: 'restaurant',
        isActive: true
      });
      if (mainRestaurant) return mainRestaurant;

      // Last resort - any active outlet
      const anyOutlet = await POSOutlet.findOne({ isActive: true });
      return anyOutlet;

    } catch (error) {
      console.error('Error finding appropriate outlet:', error);
      return null;
    }
  }

  /**
   * Prepare order data from service request
   * @param {Object} serviceRequest - The service request
   * @param {Object} outlet - The POS outlet
   * @param {Object} options - Additional options
   * @returns {Object} Prepared order data
   */
  async prepareOrderData(serviceRequest, outlet, options = {}) {
    const orderData = {
      orderId: uuidv4(),
      outlet: outlet._id,
      type: 'room_service',
      status: 'pending',

      // Customer information
      customer: {},

      // Items from service request
      items: this.formatItemsForPOS(serviceRequest.items || []),

      // Payment defaults for room service
      payment: {
        method: 'room_charge',
        status: 'pending'
      },

      // Special instructions
      specialRequests: serviceRequest.specialInstructions || serviceRequest.description,

      // Link to original service request
      serviceRequestId: serviceRequest._id,

      // Delivery details for room service
      deliveryDetails: {},

      // Default discounts array
      discounts: [],

      // Staff assignment
      staff: {
        server: serviceRequest.assignedTo
      }
    };

    // Set customer information
    if (serviceRequest.userId) {
      orderData.customer.guest = serviceRequest.userId._id || serviceRequest.userId;

      // Try to get room number from booking
      if (serviceRequest.bookingId && serviceRequest.bookingId.rooms && serviceRequest.bookingId.rooms.length > 0) {
        const room = serviceRequest.bookingId.rooms[0];
        if (room.roomId && room.roomId.roomNumber) {
          orderData.customer.roomNumber = room.roomId.roomNumber;
          orderData.deliveryDetails.address = `Room ${room.roomId.roomNumber}`;
        }
      }
    }

    return orderData;
  }

  /**
   * Format service request items for POS
   * @param {Array} items - Items from service request
   * @returns {Array} Formatted items for POS
   */
  formatItemsForPOS(items) {
    return items.map(item => ({
      itemId: item.itemId || item.id || uuidv4(),
      name: item.name,
      price: parseFloat(item.price) || 0,
      quantity: parseInt(item.quantity) || 1,
      modifiers: item.modifiers || [],
      specialInstructions: item.specialInstructions || item.notes || '',
      status: 'pending'
    }));
  }

  /**
   * Calculate order totals including taxes
   * @param {Object} orderData - The order data
   * @param {Object} outlet - The POS outlet
   */
  async calculateOrderTotals(orderData, outlet) {
    // Calculate subtotal
    let subtotal = 0;
    orderData.items.forEach(item => {
      let itemTotal = item.price * item.quantity;
      if (item.modifiers) {
        item.modifiers.forEach(mod => {
          itemTotal += (parseFloat(mod.price) || 0) * item.quantity;
        });
      }
      subtotal += itemTotal;
    });

    orderData.subtotal = subtotal;

    // Calculate taxes
    try {
      const taxResult = await posTaxCalculationService.calculateOrderTaxes(
        { items: orderData.items, subtotal },
        {
          hotelId: outlet.hotelId,
          outletId: outlet._id,
          customerType: orderData.customer.guest ? 'individual' : 'walk_in',
          applyExemptions: true,
          includeBreakdown: true
        }
      );

      orderData.taxes = {
        serviceTax: taxResult.taxBreakdown.find(t => t.taxType === 'SERVICE_TAX')?.taxAmount || 0,
        gst: taxResult.taxBreakdown.find(t => t.taxType === 'GST')?.taxAmount || 0,
        otherTaxes: taxResult.totalTax - (taxResult.taxBreakdown.find(t => t.taxType === 'SERVICE_TAX')?.taxAmount || 0) - (taxResult.taxBreakdown.find(t => t.taxType === 'GST')?.taxAmount || 0),
        totalTax: taxResult.totalTax,
        breakdown: taxResult.taxBreakdown,
        exemptedAmount: taxResult.exemptedAmount,
        taxableAmount: taxResult.taxableAmount,
        calculationTimestamp: taxResult.calculationTimestamp,
        appliedTaxes: taxResult.appliedTaxes
      };
    } catch (taxError) {
      console.warn('Tax calculation service failed, using outlet defaults:', taxError.message);

      const serviceTax = subtotal * ((outlet.taxSettings?.serviceTaxRate || 0) / 100);
      const gst = subtotal * ((outlet.taxSettings?.gstRate || 0) / 100);
      const totalTax = serviceTax + gst;

      orderData.taxes = {
        serviceTax,
        gst,
        otherTaxes: 0,
        totalTax,
        breakdown: [],
        exemptedAmount: 0,
        taxableAmount: subtotal,
        calculationTimestamp: new Date(),
        appliedTaxes: []
      };
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (orderData.discounts && orderData.discounts.length > 0) {
      orderData.discounts.forEach(discount => {
        if (discount.percentage) {
          discountAmount += subtotal * (discount.percentage / 100);
        } else {
          discountAmount += parseFloat(discount.amount) || 0;
        }
      });
    }

    // Calculate total amount
    orderData.totalAmount = subtotal + orderData.taxes.totalTax - discountAmount;
  }

  /**
   * Generate unique order number
   * @returns {string} Generated order number
   */
  async generateOrderNumber() {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await POSOrder.countDocuments({
      orderNumber: new RegExp(`^${dateStr}`)
    });
    return `${dateStr}${(count + 1).toString().padStart(4, '0')}`;
  }

  /**
   * Send notifications to kitchen staff
   * @param {Object} posOrder - The created POS order
   * @param {Object} outlet - The outlet
   */
  async notifyKitchenStaff(posOrder, outlet) {
    try {
      const notification = {
        type: 'new_food_order',
        title: 'New Food Order',
        message: `New room service order ${posOrder.orderNumber} for ${posOrder.customer.roomNumber || 'Guest'}`,
        data: {
          orderId: posOrder._id,
          orderNumber: posOrder.orderNumber,
          outlet: outlet.name,
          roomNumber: posOrder.customer.roomNumber,
          items: posOrder.items.map(item => `${item.quantity}x ${item.name}`),
          totalAmount: posOrder.totalAmount,
          specialRequests: posOrder.specialRequests
        },
        timestamp: new Date()
      };

      // Send to outlet staff
      if (outlet.staff && outlet.staff.length > 0) {
        for (const staffMember of outlet.staff) {
          await websocketService.sendToUser(staffMember._id || staffMember, notification);
        }
      }

      // Send to outlet manager
      if (outlet.manager) {
        await websocketService.sendToUser(outlet.manager._id || outlet.manager, notification);
      }

      // Send to hotel channel for general kitchen staff
      if (outlet.hotelId) {
        await websocketService.sendToHotel(outlet.hotelId, {
          ...notification,
          roles: ['staff', 'admin', 'manager']
        });
      }

    } catch (error) {
      console.error('Error sending kitchen staff notifications:', error);
      // Don't throw error as this shouldn't fail the order creation
    }
  }

  /**
   * Update service request with POS order link
   * @param {Object} serviceRequest - The service request to update
   * @param {Object} posOrder - The created POS order
   */
  async linkServiceRequestToPOSOrder(serviceRequest, posOrder) {
    try {
      // Add POS order reference to service request
      serviceRequest.posOrderId = posOrder._id;
      serviceRequest.posOrderNumber = posOrder.orderNumber;

      // Update billing status
      serviceRequest.billingStatus = 'pos_order_created';

      // Add notes about POS integration
      const integrationNote = `POS order ${posOrder.orderNumber} created automatically`;
      if (!serviceRequest.notes) {
        serviceRequest.notes = integrationNote;
      } else {
        serviceRequest.notes += `. ${integrationNote}`;
      }

      await serviceRequest.save();

      console.log(`Service request ${serviceRequest._id} linked to POS order ${posOrder.orderNumber}`);
    } catch (error) {
      console.error('Error linking service request to POS order:', error);
    }
  }
}

export default new GuestServicePOSIntegrationService();