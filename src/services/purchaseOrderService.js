import PurchaseOrder from '../models/PurchaseOrder.js';
import Vendor from '../models/Vendor.js';
import InventoryItem from '../models/InventoryItem.js';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';

class PurchaseOrderService {
  constructor() {
    // Initialize email transporter
    this.emailTransporter = nodemailer.createTransporter({
      // Configure based on your email service
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  /**
   * Create a new purchase order
   */
  async createPurchaseOrder(orderData, userId) {
    try {
      // Validate vendor exists
      const vendor = await Vendor.findOne({
        _id: orderData.vendorId,
        hotelId: orderData.hotelId
      });

      if (!vendor) {
        throw new Error('Vendor not found');
      }

      // Validate inventory items
      if (orderData.items && orderData.items.length > 0) {
        const itemIds = orderData.items.map(item => item.inventoryItemId);
        const inventoryItems = await InventoryItem.find({
          _id: { $in: itemIds },
          hotelId: orderData.hotelId
        });

        if (inventoryItems.length !== itemIds.length) {
          throw new Error('Some inventory items not found');
        }

        // Enrich items with inventory data
        orderData.items = orderData.items.map(orderItem => {
          const inventoryItem = inventoryItems.find(
            item => item._id.toString() === orderItem.inventoryItemId.toString()
          );

          return {
            ...orderItem,
            itemName: orderItem.itemName || inventoryItem.name,
            itemCode: orderItem.itemCode || inventoryItem.itemCode,
            unit: orderItem.unit || inventoryItem.unit || 'pieces'
          };
        });
      }

      // Set vendor info from vendor record
      orderData.vendorInfo = {
        name: vendor.name,
        email: vendor.contactInfo?.email || vendor.email,
        phone: vendor.contactInfo?.phone || vendor.phone,
        address: vendor.contactInfo?.address?.fullAddress || vendor.address?.fullAddress,
        contactPerson: vendor.contactInfo?.primaryContact?.name || vendor.contactPerson
      };

      // Set default dates if not provided
      if (!orderData.requiredDate) {
        const requiredDate = new Date();
        requiredDate.setDate(requiredDate.getDate() + 7); // Default 7 days
        orderData.requiredDate = requiredDate;
      }

      if (!orderData.expectedDeliveryDate) {
        const expectedDate = new Date(orderData.requiredDate);
        const leadTime = vendor.deliveryInfo?.leadTimeDays || vendor.deliveryTime?.match(/\d+/)?.[0] || 3;
        expectedDate.setDate(expectedDate.getDate() + parseInt(leadTime));
        orderData.expectedDeliveryDate = expectedDate;
      }

      // Set payment terms from vendor
      if (!orderData.paymentTerms && vendor.paymentTerms) {
        orderData.paymentTerms = {
          method: vendor.paymentTerms.paymentMethod || 'bank_transfer',
          days: vendor.paymentTerms.paymentDays || 30
        };
      }

      const purchaseOrder = new PurchaseOrder({
        ...orderData,
        createdBy: userId,
        updatedBy: userId
      });

      await purchaseOrder.save();

      // Update vendor order count
      await this.updateVendorOrderMetrics(vendor._id, purchaseOrder.grandTotal);

      return purchaseOrder;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update an existing purchase order
   */
  async updatePurchaseOrder(orderId, updateData, userId) {
    try {
      const purchaseOrder = await PurchaseOrder.findById(orderId);
      if (!purchaseOrder) {
        throw new Error('Purchase order not found');
      }

      // Check if order can be updated based on status
      const updatableStatuses = ['draft', 'pending_approval', 'approved'];
      if (!updatableStatuses.includes(purchaseOrder.status)) {
        throw new Error(`Cannot update purchase order in ${purchaseOrder.status} status`);
      }

      // Add revision history
      if (Object.keys(updateData).length > 0) {
        const changes = Object.keys(updateData).join(', ');
        purchaseOrder.addRevision(userId, `Updated: ${changes}`, 'Manual update');
      }

      Object.assign(purchaseOrder, updateData);
      purchaseOrder.updatedBy = userId;

      await purchaseOrder.save();
      return purchaseOrder;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Send purchase order to vendor via email
   */
  async sendPurchaseOrder(orderId, userId, emailOptions = {}) {
    try {
      const purchaseOrder = await PurchaseOrder.findById(orderId)
        .populate('vendorId', 'name contactInfo email')
        .populate('requestedBy', 'name email')
        .populate('hotelId', 'name address');

      if (!purchaseOrder) {
        throw new Error('Purchase order not found');
      }

      if (purchaseOrder.status !== 'approved') {
        throw new Error('Purchase order must be approved before sending to vendor');
      }

      // Update status
      await purchaseOrder.sendToVendor(userId);

      // Send email
      if (this.emailTransporter && purchaseOrder.vendorInfo.email) {
        const emailData = {
          to: purchaseOrder.vendorInfo.email,
          subject: `Purchase Order ${purchaseOrder.poNumber} - ${purchaseOrder.hotelId.name}`,
          html: this.generatePOEmailTemplate(purchaseOrder),
          attachments: emailOptions.attachments || []
        };

        await this.emailTransporter.sendMail(emailData);
      }

      return purchaseOrder;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Confirm purchase order by vendor
   */
  async confirmPurchaseOrder(orderId, confirmationData) {
    try {
      const purchaseOrder = await PurchaseOrder.findById(orderId);
      if (!purchaseOrder) {
        throw new Error('Purchase order not found');
      }

      if (purchaseOrder.status !== 'sent_to_vendor') {
        throw new Error('Purchase order must be sent to vendor before confirmation');
      }

      await purchaseOrder.confirmByVendor(confirmationData.vendorOrderNumber);

      // Update expected delivery date if provided
      if (confirmationData.expectedDeliveryDate) {
        purchaseOrder.expectedDeliveryDate = new Date(confirmationData.expectedDeliveryDate);
        await purchaseOrder.save();
      }

      return purchaseOrder;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Receive items for purchase order
   */
  async receivePurchaseOrder(orderId, receivingData, userId) {
    try {
      const purchaseOrder = await PurchaseOrder.findById(orderId);
      if (!purchaseOrder) {
        throw new Error('Purchase order not found');
      }

      const allowedStatuses = ['confirmed_by_vendor', 'in_transit', 'partially_received'];
      if (!allowedStatuses.includes(purchaseOrder.status)) {
        throw new Error(`Cannot receive items for order in ${purchaseOrder.status} status`);
      }

      // Process received items
      const { receivedItems, qualityCheck, notes } = receivingData;

      await purchaseOrder.receiveItems(receivedItems, userId);

      // Update quality check if provided
      if (qualityCheck) {
        purchaseOrder.qualityCheck = {
          performed: true,
          performedBy: userId,
          performedDate: new Date(),
          notes: qualityCheck.notes,
          approved: qualityCheck.approved,
          defectsFound: qualityCheck.defectsFound || []
        };
      }

      if (notes) {
        purchaseOrder.notes = notes;
      }

      await purchaseOrder.save();

      // Update inventory if fully received and quality approved
      if (purchaseOrder.status === 'fully_received' &&
          (!qualityCheck || qualityCheck.approved)) {
        await this.updateInventoryFromPO(purchaseOrder);
      }

      // Update vendor performance
      await this.updateVendorPerformanceFromPO(purchaseOrder);

      return purchaseOrder;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cancel purchase order
   */
  async cancelPurchaseOrder(orderId, userId, reason) {
    try {
      const purchaseOrder = await PurchaseOrder.findById(orderId);
      if (!purchaseOrder) {
        throw new Error('Purchase order not found');
      }

      const cancellableStatuses = ['draft', 'pending_approval', 'approved', 'sent_to_vendor'];
      if (!cancellableStatuses.includes(purchaseOrder.status)) {
        throw new Error(`Cannot cancel purchase order in ${purchaseOrder.status} status`);
      }

      await purchaseOrder.cancel(userId, reason);

      // Notify vendor if order was already sent
      if (['sent_to_vendor', 'confirmed_by_vendor'].includes(purchaseOrder.status)) {
        // Send cancellation email
        if (this.emailTransporter && purchaseOrder.vendorInfo.email) {
          const emailData = {
            to: purchaseOrder.vendorInfo.email,
            subject: `Purchase Order ${purchaseOrder.poNumber} - CANCELLED`,
            html: this.generateCancellationEmailTemplate(purchaseOrder, reason)
          };

          await this.emailTransporter.sendMail(emailData);
        }
      }

      return purchaseOrder;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get purchase order history with filters
   */
  async getPurchaseOrderHistory(hotelId, filters = {}, options = {}) {
    try {
      const {
        status,
        vendorId,
        department,
        category,
        dateRange,
        search,
        priority
      } = filters;

      const {
        page = 1,
        limit = 20,
        sortBy = 'orderDate',
        sortOrder = 'desc',
        populate = true
      } = options;

      // Build query
      const query = { hotelId };

      if (status) {
        if (Array.isArray(status)) {
          query.status = { $in: status };
        } else {
          query.status = status;
        }
      }

      if (vendorId) query.vendorId = vendorId;
      if (department) query.department = department;
      if (category) query.category = category;
      if (priority) query.priority = priority;

      if (dateRange) {
        query.orderDate = {
          $gte: new Date(dateRange.start),
          $lte: new Date(dateRange.end)
        };
      }

      if (search) {
        const searchRegex = new RegExp(search, 'i');
        query.$or = [
          { poNumber: searchRegex },
          { 'vendorInfo.name': searchRegex },
          { notes: searchRegex }
        ];
      }

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Execute query
      const skip = (page - 1) * limit;

      let poQuery = PurchaseOrder.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit);

      if (populate) {
        poQuery = poQuery
          .populate('vendorId', 'name status')
          .populate('requestedBy', 'name')
          .populate('approvedBy', 'name')
          .populate('receivedBy', 'name');
      }

      const [orders, total] = await Promise.all([
        poQuery.exec(),
        PurchaseOrder.countDocuments(query)
      ]);

      return {
        orders,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate purchase order analytics and reports
   */
  async generatePOReport(hotelId, options = {}) {
    try {
      const {
        period = 'month',
        vendorId,
        department,
        category
      } = options;

      // Get date range for period
      const now = new Date();
      let startDate, endDate;

      switch (period) {
        case 'week':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
          endDate = now;
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case 'quarter':
          const quarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), quarter * 3, 1);
          endDate = new Date(now.getFullYear(), quarter * 3 + 3, 0);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = new Date(now.getFullYear(), 11, 31);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }

      const matchQuery = {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        orderDate: { $gte: startDate, $lte: endDate }
      };

      if (vendorId) matchQuery.vendorId = new mongoose.Types.ObjectId(vendorId);
      if (department) matchQuery.department = department;
      if (category) matchQuery.category = category;

      const [
        overallStats,
        statusBreakdown,
        departmentStats,
        vendorStats,
        trendData
      ] = await Promise.all([
        this.getOverallPOStats(matchQuery),
        this.getStatusBreakdown(matchQuery),
        this.getDepartmentStats(matchQuery),
        this.getVendorStats(matchQuery),
        this.getPOTrendData(hotelId, period, 6)
      ]);

      return {
        period,
        dateRange: { startDate, endDate },
        overall: overallStats,
        statusBreakdown,
        departmentStats,
        vendorStats,
        trends: trendData
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Track pending orders and generate alerts
   */
  async trackPendingOrders(hotelId) {
    try {
      const now = new Date();

      // Get overdue orders
      const overdueOrders = await PurchaseOrder.find({
        hotelId,
        expectedDeliveryDate: { $lt: now },
        status: { $nin: ['completed', 'cancelled', 'fully_received'] }
      })
      .populate('vendorId', 'name contactInfo')
      .sort({ expectedDeliveryDate: 1 });

      // Get orders due soon (within 3 days)
      const soonDueDate = new Date();
      soonDueDate.setDate(soonDueDate.getDate() + 3);

      const ordersDueSoon = await PurchaseOrder.find({
        hotelId,
        expectedDeliveryDate: { $gte: now, $lte: soonDueDate },
        status: { $nin: ['completed', 'cancelled', 'fully_received'] }
      })
      .populate('vendorId', 'name contactInfo')
      .sort({ expectedDeliveryDate: 1 });

      // Get orders awaiting approval
      const awaitingApproval = await PurchaseOrder.find({
        hotelId,
        status: 'pending_approval'
      })
      .populate('requestedBy', 'name')
      .sort({ orderDate: 1 });

      return {
        overdue: overdueOrders,
        dueSoon: ordersDueSoon,
        awaitingApproval,
        summary: {
          overdueCount: overdueOrders.length,
          dueSoonCount: ordersDueSoon.length,
          awaitingApprovalCount: awaitingApproval.length
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Calculate purchase order metrics
   */
  async calculatePOMetrics(hotelId, period = 'month') {
    try {
      const dateRange = this.getDateRangeForPeriod(period);

      const metrics = await PurchaseOrder.aggregate([
        {
          $match: {
            hotelId: new mongoose.Types.ObjectId(hotelId),
            orderDate: { $gte: dateRange.start, $lte: dateRange.end }
          }
        },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalValue: { $sum: '$grandTotal' },
            avgOrderValue: { $avg: '$grandTotal' },
            completedOrders: {
              $sum: { $cond: [{ $in: ['$status', ['completed', 'fully_received']] }, 1, 0] }
            },
            cancelledOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
            },
            overdueOrders: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $lt: ['$expectedDeliveryDate', new Date()] },
                      { $nin: ['$status', ['completed', 'cancelled', 'fully_received']] }
                    ]
                  },
                  1, 0
                ]
              }
            }
          }
        }
      ]);

      const result = metrics[0] || {
        totalOrders: 0,
        totalValue: 0,
        avgOrderValue: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        overdueOrders: 0
      };

      // Calculate completion rate
      result.completionRate = result.totalOrders > 0
        ? (result.completedOrders / result.totalOrders) * 100
        : 0;

      // Calculate cancellation rate
      result.cancellationRate = result.totalOrders > 0
        ? (result.cancelledOrders / result.totalOrders) * 100
        : 0;

      return result;
    } catch (error) {
      throw error;
    }
  }

  // Helper methods

  /**
   * Update vendor order metrics
   */
  async updateVendorOrderMetrics(vendorId, orderValue) {
    try {
      await Vendor.findByIdAndUpdate(vendorId, {
        $inc: {
          'performance.totalOrders': 1,
          'performance.totalOrderValue': orderValue,
          // Legacy fields
          'performance.orderCount': 1,
          totalOrderValue: orderValue
        },
        $set: {
          lastOrderDate: new Date(),
          lastContactDate: new Date()
        }
      });
    } catch (error) {
      console.error('Error updating vendor metrics:', error);
    }
  }

  /**
   * Update inventory from completed purchase order
   */
  async updateInventoryFromPO(purchaseOrder) {
    try {
      for (const item of purchaseOrder.items) {
        if (item.quantityReceived > 0) {
          await InventoryItem.findByIdAndUpdate(
            item.inventoryItemId,
            {
              $inc: {
                currentStock: item.quantityReceived,
                totalReceived: item.quantityReceived
              },
              $set: {
                lastRestockDate: new Date(),
                updatedAt: new Date()
              }
            }
          );
        }
      }
    } catch (error) {
      console.error('Error updating inventory:', error);
    }
  }

  /**
   * Update vendor performance from purchase order
   */
  async updateVendorPerformanceFromPO(purchaseOrder) {
    try {
      if (purchaseOrder.status === 'fully_received' && purchaseOrder.actualDeliveryDate) {
        const onTime = purchaseOrder.actualDeliveryDate <= purchaseOrder.expectedDeliveryDate;
        await purchaseOrder.vendorId.addOrder(purchaseOrder.grandTotal, onTime);
      }
    } catch (error) {
      console.error('Error updating vendor performance:', error);
    }
  }

  /**
   * Generate purchase order email template
   */
  generatePOEmailTemplate(purchaseOrder) {
    return `
      <html>
        <body style="font-family: Arial, sans-serif;">
          <h2>Purchase Order ${purchaseOrder.poNumber}</h2>
          <p>Dear ${purchaseOrder.vendorInfo.contactPerson || 'Vendor'},</p>

          <p>Please find the details of our purchase order below:</p>

          <table border="1" style="border-collapse: collapse; width: 100%;">
            <tr>
              <td><strong>PO Number:</strong></td>
              <td>${purchaseOrder.poNumber}</td>
            </tr>
            <tr>
              <td><strong>Order Date:</strong></td>
              <td>${purchaseOrder.orderDate.toLocaleDateString()}</td>
            </tr>
            <tr>
              <td><strong>Required Date:</strong></td>
              <td>${purchaseOrder.requiredDate.toLocaleDateString()}</td>
            </tr>
            <tr>
              <td><strong>Total Amount:</strong></td>
              <td>${purchaseOrder.currency} ${purchaseOrder.grandTotal.toFixed(2)}</td>
            </tr>
          </table>

          <h3>Items:</h3>
          <table border="1" style="border-collapse: collapse; width: 100%;">
            <tr>
              <th>Item</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Total</th>
            </tr>
            ${purchaseOrder.items.map(item => `
              <tr>
                <td>${item.itemName}</td>
                <td>${item.quantityOrdered} ${item.unit}</td>
                <td>${purchaseOrder.currency} ${item.unitPrice.toFixed(2)}</td>
                <td>${purchaseOrder.currency} ${item.finalAmount.toFixed(2)}</td>
              </tr>
            `).join('')}
          </table>

          <p>Please confirm receipt of this purchase order and provide your expected delivery date.</p>

          <p>Thank you for your business.</p>

          <p>Best regards,<br>
          ${purchaseOrder.hotelId.name}<br>
          Purchase Department</p>
        </body>
      </html>
    `;
  }

  /**
   * Generate cancellation email template
   */
  generateCancellationEmailTemplate(purchaseOrder, reason) {
    return `
      <html>
        <body style="font-family: Arial, sans-serif;">
          <h2>Purchase Order Cancellation - ${purchaseOrder.poNumber}</h2>
          <p>Dear ${purchaseOrder.vendorInfo.contactPerson || 'Vendor'},</p>

          <p>We regret to inform you that we need to cancel the following purchase order:</p>

          <table border="1" style="border-collapse: collapse; width: 100%;">
            <tr>
              <td><strong>PO Number:</strong></td>
              <td>${purchaseOrder.poNumber}</td>
            </tr>
            <tr>
              <td><strong>Order Date:</strong></td>
              <td>${purchaseOrder.orderDate.toLocaleDateString()}</td>
            </tr>
            <tr>
              <td><strong>Total Amount:</strong></td>
              <td>${purchaseOrder.currency} ${purchaseOrder.grandTotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td><strong>Cancellation Reason:</strong></td>
              <td>${reason}</td>
            </tr>
          </table>

          <p>We apologize for any inconvenience caused and appreciate your understanding.</p>

          <p>Best regards,<br>
          ${purchaseOrder.hotelId.name}<br>
          Purchase Department</p>
        </body>
      </html>
    `;
  }

  /**
   * Get overall PO statistics
   */
  async getOverallPOStats(matchQuery) {
    const stats = await PurchaseOrder.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalValue: { $sum: '$grandTotal' },
          avgOrderValue: { $avg: '$grandTotal' },
          completedOrders: {
            $sum: { $cond: [{ $in: ['$status', ['completed', 'fully_received']] }, 1, 0] }
          }
        }
      }
    ]);

    return stats[0] || { totalOrders: 0, totalValue: 0, avgOrderValue: 0, completedOrders: 0 };
  }

  /**
   * Get status breakdown
   */
  async getStatusBreakdown(matchQuery) {
    return await PurchaseOrder.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { $sum: '$grandTotal' }
        }
      },
      { $sort: { count: -1 } }
    ]);
  }

  /**
   * Get department statistics
   */
  async getDepartmentStats(matchQuery) {
    return await PurchaseOrder.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$department',
          orders: { $sum: 1 },
          totalValue: { $sum: '$grandTotal' },
          avgOrderValue: { $avg: '$grandTotal' }
        }
      },
      { $sort: { totalValue: -1 } }
    ]);
  }

  /**
   * Get vendor statistics
   */
  async getVendorStats(matchQuery) {
    return await PurchaseOrder.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: 'vendors',
          localField: 'vendorId',
          foreignField: '_id',
          as: 'vendor'
        }
      },
      { $unwind: '$vendor' },
      {
        $group: {
          _id: '$vendorId',
          vendorName: { $first: '$vendor.name' },
          orders: { $sum: 1 },
          totalValue: { $sum: '$grandTotal' },
          avgOrderValue: { $avg: '$grandTotal' }
        }
      },
      { $sort: { totalValue: -1 } },
      { $limit: 10 }
    ]);
  }

  /**
   * Get PO trend data
   */
  async getPOTrendData(hotelId, period, periods) {
    const trends = [];
    const now = new Date();

    for (let i = periods - 1; i >= 0; i--) {
      let startDate, endDate;

      if (period === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      } else if (period === 'week') {
        startDate = new Date(now.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
        endDate = new Date(startDate.getTime() + (7 * 24 * 60 * 60 * 1000));
      }

      const stats = await this.getOverallPOStats({
        hotelId: new mongoose.Types.ObjectId(hotelId),
        orderDate: { $gte: startDate, $lte: endDate }
      });

      trends.push({
        period: startDate.toISOString().substring(0, 7), // YYYY-MM format
        ...stats
      });
    }

    return trends;
  }

  /**
   * Get date range for period
   */
  getDateRangeForPeriod(period) {
    const now = new Date();
    let start, end;

    switch (period) {
      case 'week':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        end = now;
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = new Date(now.getFullYear(), quarter * 3 + 3, 0);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    return { start, end };
  }
}

export default new PurchaseOrderService();