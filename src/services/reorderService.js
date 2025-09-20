import InventoryItem from '../models/InventoryItem.js';
import ReorderAlert from '../models/ReorderAlert.js';
import User from '../models/User.js';
import Hotel from '../models/Hotel.js';
import emailService from './emailService.js';
import logger from '../utils/logger.js';

class ReorderService {
  constructor() {
    this.isRunning = false;
  }

  /**
   * Check all reorder points for a specific hotel or all hotels
   * @param {string} hotelId - Optional hotel ID to check specific hotel
   * @returns {Object} Summary of reorder check results
   */
  async checkReorderPoints(hotelId = null) {
    try {
      logger.info('Starting reorder points check', { hotelId });

      const hotels = hotelId ? [{ _id: hotelId }] : await Hotel.find({ isActive: true }).select('_id name');
      let totalItemsChecked = 0;
      let totalAlertsCreated = 0;
      let totalNotificationsSent = 0;

      for (const hotel of hotels) {
        const result = await this.checkHotelReorderPoints(hotel._id);
        totalItemsChecked += result.itemsChecked;
        totalAlertsCreated += result.alertsCreated;
        totalNotificationsSent += result.notificationsSent;
      }

      const summary = {
        hotelsChecked: hotels.length,
        totalItemsChecked,
        totalAlertsCreated,
        totalNotificationsSent,
        checkTime: new Date()
      };

      logger.info('Reorder points check completed', summary);
      return summary;

    } catch (error) {
      logger.error('Error during reorder points check:', error);
      throw new Error(`Reorder points check failed: ${error.message}`);
    }
  }

  /**
   * Check reorder points for a specific hotel
   * @param {string} hotelId - Hotel ID
   * @returns {Object} Check results for the hotel
   */
  async checkHotelReorderPoints(hotelId) {
    try {
      // Get all items with auto-reorder enabled for this hotel
      const reorderEnabledItems = await InventoryItem.getReorderEnabledItems(hotelId);
      const itemsNeedingReorder = await InventoryItem.getItemsNeedingReorder(hotelId);

      let alertsCreated = 0;
      let notificationsSent = 0;

      for (const item of itemsNeedingReorder) {
        // Check if alert already exists for this item
        const existingAlert = await ReorderAlert.findOne({
          hotelId,
          inventoryItemId: item._id,
          status: { $in: ['active', 'acknowledged'] }
        });

        if (!existingAlert) {
          // Create new reorder alert
          const alertData = await this.generateReorderAlert(item);
          const alert = await ReorderAlert.create(alertData);
          alertsCreated++;

          // Send notification
          const notificationResult = await this.sendReorderNotification(alert, item);
          if (notificationResult.success) {
            notificationsSent++;
          }
        } else {
          // Update existing alert if stock has decreased further
          if (item.currentStock < existingAlert.currentStock) {
            existingAlert.currentStock = item.currentStock;
            existingAlert.urgencyScore = this.calculateUrgencyScore(item);
            await existingAlert.save();

            // Send escalation notification if critical
            if (item.isUrgentReorder()) {
              await this.sendEscalationNotification(existingAlert, item);
            }
          }
        }
      }

      return {
        itemsChecked: reorderEnabledItems.length,
        itemsNeedingReorder: itemsNeedingReorder.length,
        alertsCreated,
        notificationsSent
      };

    } catch (error) {
      logger.error('Error checking hotel reorder points:', { hotelId, error: error.message });
      throw error;
    }
  }

  /**
   * Generate reorder alert data for an inventory item
   * @param {Object} item - Inventory item object
   * @returns {Object} Alert data object
   */
  async generateReorderAlert(item) {
    const alertType = this.determineAlertType(item);
    const priority = this.determinePriority(item);
    const urgencyScore = this.calculateUrgencyScore(item);

    // Calculate expected delivery date
    const leadTime = item.reorderSettings?.preferredSupplier?.leadTime || 7; // Default 7 days
    const expectedDeliveryDate = new Date();
    expectedDeliveryDate.setDate(expectedDeliveryDate.getDate() + leadTime);

    return {
      hotelId: item.hotelId,
      inventoryItemId: item._id,
      alertType,
      priority,
      currentStock: item.currentStock,
      reorderPoint: item.reorderSettings.reorderPoint,
      suggestedQuantity: item.reorderSettings.reorderQuantity,
      estimatedCost: item.estimatedReorderCost,
      supplierInfo: item.reorderSettings.preferredSupplier,
      urgencyScore,
      expectedDeliveryDate
    };
  }

  /**
   * Determine alert type based on stock levels
   * @param {Object} item - Inventory item
   * @returns {string} Alert type
   */
  determineAlertType(item) {
    const criticalLevel = Math.floor(item.reorderSettings.reorderPoint * 0.25);

    if (item.currentStock <= 0) return 'critical_stock';
    if (item.currentStock <= criticalLevel) return 'critical_stock';
    if (item.currentStock <= item.reorderSettings.reorderPoint) return 'reorder_needed';
    return 'low_stock';
  }

  /**
   * Determine priority based on stock levels and item importance
   * @param {Object} item - Inventory item
   * @returns {string} Priority level
   */
  determinePriority(item) {
    const criticalLevel = Math.floor(item.reorderSettings.reorderPoint * 0.25);
    const lowLevel = Math.floor(item.reorderSettings.reorderPoint * 0.5);

    if (item.currentStock <= 0) return 'critical';
    if (item.currentStock <= criticalLevel) return 'critical';
    if (item.currentStock <= lowLevel) return 'high';
    if (item.currentStock <= item.reorderSettings.reorderPoint) return 'medium';
    return 'low';
  }

  /**
   * Calculate urgency score for an item
   * @param {Object} item - Inventory item
   * @returns {number} Urgency score (0-100)
   */
  calculateUrgencyScore(item) {
    const stockDeficit = Math.max(0, item.reorderSettings.reorderPoint - item.currentStock);
    const deficitPercentage = item.reorderSettings.reorderPoint > 0 ?
      (stockDeficit / item.reorderSettings.reorderPoint) * 100 : 0;

    let urgencyScore = Math.min(deficitPercentage, 100);

    // Adjust based on category importance
    const criticalCategories = ['electronics', 'cleaning'];
    if (criticalCategories.includes(item.category)) {
      urgencyScore = Math.min(urgencyScore + 10, 100);
    }

    return Math.round(urgencyScore);
  }

  /**
   * Send reorder notification to appropriate staff members
   * @param {Object} alert - Reorder alert object
   * @param {Object} item - Inventory item object
   * @returns {Object} Notification result
   */
  async sendReorderNotification(alert, item) {
    try {
      // Get hotel managers and admin users
      const recipients = await User.find({
        hotelId: alert.hotelId,
        role: { $in: ['admin', 'manager'] },
        isActive: true,
        email: { $exists: true, $ne: '' }
      }).select('name email role');

      if (recipients.length === 0) {
        logger.warn('No recipients found for reorder notification', {
          hotelId: alert.hotelId,
          itemId: item._id
        });
        return { success: false, error: 'No recipients found' };
      }

      // Prepare email content
      const emailSubject = this.generateEmailSubject(alert, item);
      const emailContent = await this.generateEmailContent(alert, item);

      // Send emails to all recipients
      const emailPromises = recipients.map(async (recipient) => {
        const result = await emailService.sendEmail({
          to: recipient.email,
          subject: emailSubject,
          html: emailContent.html,
          text: emailContent.text
        });

        if (result.success) {
          await alert.logEmailSent(recipient.email, 'alert');
        }

        return { recipient: recipient.email, success: result.success, error: result.error };
      });

      const emailResults = await Promise.all(emailPromises);
      const successCount = emailResults.filter(r => r.success).length;

      // Send supplier notification if configured
      if (item.reorderSettings?.preferredSupplier?.email) {
        await this.sendSupplierNotification(alert, item);
      }

      return {
        success: true,
        recipientCount: recipients.length,
        successCount,
        emailResults
      };

    } catch (error) {
      logger.error('Error sending reorder notification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send notification to supplier about reorder need
   * @param {Object} alert - Reorder alert object
   * @param {Object} item - Inventory item object
   */
  async sendSupplierNotification(alert, item) {
    try {
      const supplierEmail = item.reorderSettings.preferredSupplier.email;
      const subject = `Reorder Request: ${item.name}`;

      const content = {
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #e67e22;">Reorder Request</h2>
            <p>Dear ${item.reorderSettings.preferredSupplier.name || 'Supplier'},</p>

            <p>We would like to place a reorder for the following item:</p>

            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">${item.name}</h3>
              <p><strong>Category:</strong> ${item.category}</p>
              <p><strong>Current Stock:</strong> ${alert.currentStock}</p>
              <p><strong>Requested Quantity:</strong> ${alert.suggestedQuantity}</p>
              <p><strong>Estimated Total:</strong> $${alert.estimatedCost?.toFixed(2) || 'TBD'}</p>
            </div>

            <p>Please confirm availability and provide a quote for this order.</p>

            <p>Thank you for your service.</p>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
              <p style="color: #666; font-size: 12px;">
                This is an automated reorder request from The Pentouz Hotel Management System.
              </p>
            </div>
          </div>
        `,
        text: `
Reorder Request

Dear ${item.reorderSettings.preferredSupplier.name || 'Supplier'},

We would like to place a reorder for the following item:

Item: ${item.name}
Category: ${item.category}
Current Stock: ${alert.currentStock}
Requested Quantity: ${alert.suggestedQuantity}
Estimated Total: $${alert.estimatedCost?.toFixed(2) || 'TBD'}

Please confirm availability and provide a quote for this order.

Thank you for your service.

---
This is an automated reorder request from The Pentouz Hotel Management System.
        `
      };

      const result = await emailService.sendEmail({
        to: supplierEmail,
        subject,
        html: content.html,
        text: content.text
      });

      if (result.success) {
        await alert.logEmailSent(supplierEmail, 'supplier_notification');
        logger.info('Supplier notification sent successfully', {
          supplier: supplierEmail,
          item: item.name,
          alertId: alert._id
        });
      }

      return result;

    } catch (error) {
      logger.error('Error sending supplier notification:', error);
      throw error;
    }
  }

  /**
   * Send escalation notification for critical alerts
   * @param {Object} alert - Reorder alert object
   * @param {Object} item - Inventory item object
   */
  async sendEscalationNotification(alert, item) {
    try {
      // Get all admin users for escalation
      const admins = await User.find({
        hotelId: alert.hotelId,
        role: 'admin',
        isActive: true,
        email: { $exists: true, $ne: '' }
      }).select('name email');

      if (admins.length === 0) return;

      const subject = `🚨 CRITICAL: Stock Alert Escalation - ${item.name}`;
      const content = {
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #e74c3c; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0;">🚨 CRITICAL STOCK ALERT</h2>
              <p style="margin: 5px 0 0 0;">Immediate action required</p>
            </div>

            <div style="background: white; border: 1px solid #e0e0e0; padding: 20px; border-radius: 0 0 8px 8px;">
              <h3 style="color: #e74c3c; margin-top: 0;">${item.name}</h3>

              <div style="background: #fff5f5; border: 1px solid #fed7d7; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <p style="margin: 5px 0;"><strong>Current Stock:</strong> ${alert.currentStock}</p>
                <p style="margin: 5px 0;"><strong>Reorder Point:</strong> ${alert.reorderPoint}</p>
                <p style="margin: 5px 0;"><strong>Status:</strong> CRITICALLY LOW</p>
                <p style="margin: 5px 0;"><strong>Urgency Score:</strong> ${alert.urgencyScore}/100</p>
              </div>

              <p style="color: #721c24; font-weight: bold;">
                This item is critically low and requires immediate attention to prevent stockout.
              </p>

              <div style="text-align: center; margin: 20px 0;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/inventory"
                   style="background: #e74c3c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  Review Alert
                </a>
              </div>
            </div>
          </div>
        `,
        text: `
🚨 CRITICAL STOCK ALERT - IMMEDIATE ACTION REQUIRED

Item: ${item.name}
Current Stock: ${alert.currentStock}
Reorder Point: ${alert.reorderPoint}
Status: CRITICALLY LOW
Urgency Score: ${alert.urgencyScore}/100

This item is critically low and requires immediate attention to prevent stockout.

Please review the alert in the admin panel: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/inventory
        `
      };

      for (const admin of admins) {
        await emailService.sendEmail({
          to: admin.email,
          subject,
          html: content.html,
          text: content.text
        });

        await alert.logEmailSent(admin.email, 'escalation');
      }

      logger.info('Escalation notifications sent', {
        item: item.name,
        alertId: alert._id,
        recipientCount: admins.length
      });

    } catch (error) {
      logger.error('Error sending escalation notification:', error);
    }
  }

  /**
   * Generate email subject for reorder alerts
   * @param {Object} alert - Reorder alert object
   * @param {Object} item - Inventory item object
   * @returns {string} Email subject
   */
  generateEmailSubject(alert, item) {
    const priorityEmojis = {
      critical: '🚨',
      high: '⚠️',
      medium: '📋',
      low: 'ℹ️'
    };

    const emoji = priorityEmojis[alert.priority] || '📋';
    return `${emoji} Reorder Alert: ${item.name} (${alert.currentStock} remaining)`;
  }

  /**
   * Generate email content for reorder alerts
   * @param {Object} alert - Reorder alert object
   * @param {Object} item - Inventory item object
   * @returns {Object} Email content with HTML and text versions
   */
  async generateEmailContent(alert, item) {
    const priorityColors = {
      critical: '#e74c3c',
      high: '#e67e22',
      medium: '#f39c12',
      low: '#3498db'
    };

    const priorityColor = priorityColors[alert.priority] || '#3498db';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${priorityColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">Inventory Reorder Alert</h2>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Priority: ${alert.priority.toUpperCase()}</p>
        </div>

        <div style="background: white; border: 1px solid #e0e0e0; padding: 20px; border-radius: 0 0 8px 8px;">
          <h3 style="color: #333; margin-top: 0;">${item.name}</h3>

          <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <h4 style="margin-top: 0; color: #333;">Stock Information</h4>
            <p style="margin: 5px 0;"><strong>Category:</strong> ${item.category}</p>
            <p style="margin: 5px 0;"><strong>Current Stock:</strong> ${alert.currentStock}</p>
            <p style="margin: 5px 0;"><strong>Reorder Point:</strong> ${alert.reorderPoint}</p>
            <p style="margin: 5px 0;"><strong>Suggested Reorder Quantity:</strong> ${alert.suggestedQuantity}</p>
            <p style="margin: 5px 0;"><strong>Estimated Cost:</strong> $${alert.estimatedCost?.toFixed(2) || 'TBD'}</p>
          </div>

          ${alert.supplierInfo?.name ? `
          <div style="background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <h4 style="margin-top: 0; color: #333;">Preferred Supplier</h4>
            <p style="margin: 5px 0;"><strong>Name:</strong> ${alert.supplierInfo.name}</p>
            ${alert.supplierInfo.contact ? `<p style="margin: 5px 0;"><strong>Contact:</strong> ${alert.supplierInfo.contact}</p>` : ''}
            ${alert.supplierInfo.email ? `<p style="margin: 5px 0;"><strong>Email:</strong> ${alert.supplierInfo.email}</p>` : ''}
            ${alert.supplierInfo.leadTime ? `<p style="margin: 5px 0;"><strong>Lead Time:</strong> ${alert.supplierInfo.leadTime} days</p>` : ''}
          </div>
          ` : ''}

          <div style="text-align: center; margin: 20px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/inventory"
               style="background: ${priorityColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Manage Inventory
            </a>
          </div>

          <p style="color: #666; font-size: 14px; margin-top: 20px;">
            This alert was generated automatically by the inventory management system.
            Please review and take appropriate action to maintain adequate stock levels.
          </p>
        </div>
      </div>
    `;

    const text = `
INVENTORY REORDER ALERT
Priority: ${alert.priority.toUpperCase()}

Item: ${item.name}
Category: ${item.category}
Current Stock: ${alert.currentStock}
Reorder Point: ${alert.reorderPoint}
Suggested Reorder Quantity: ${alert.suggestedQuantity}
Estimated Cost: $${alert.estimatedCost?.toFixed(2) || 'TBD'}

${alert.supplierInfo?.name ? `
Preferred Supplier: ${alert.supplierInfo.name}
${alert.supplierInfo.contact ? `Contact: ${alert.supplierInfo.contact}` : ''}
${alert.supplierInfo.email ? `Email: ${alert.supplierInfo.email}` : ''}
${alert.supplierInfo.leadTime ? `Lead Time: ${alert.supplierInfo.leadTime} days` : ''}
` : ''}

Please review and take appropriate action to maintain adequate stock levels.

Manage Inventory: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/inventory

---
This alert was generated automatically by The Pentouz inventory management system.
    `;

    return { html, text };
  }

  /**
   * Create a reorder request from an alert
   * @param {string} alertId - Alert ID
   * @param {string} userId - User creating the request
   * @param {Object} requestData - Additional request data
   * @returns {Object} Created reorder request
   */
  async createReorderRequest(alertId, userId, requestData = {}) {
    try {
      const alert = await ReorderAlert.findById(alertId)
        .populate('inventoryItemId');

      if (!alert) {
        throw new Error('Alert not found');
      }

      if (alert.status !== 'active' && alert.status !== 'acknowledged') {
        throw new Error('Alert is not in a valid state for reorder request');
      }

      const item = alert.inventoryItemId;

      // Create reorder history entry
      const reorderData = {
        quantity: requestData.quantity || alert.suggestedQuantity,
        supplier: requestData.supplier || alert.supplierInfo?.name || 'TBD',
        estimatedCost: requestData.estimatedCost || alert.estimatedCost,
        status: 'pending',
        notes: requestData.notes,
        alertId: alert._id,
        orderDate: new Date(),
        expectedDeliveryDate: requestData.expectedDeliveryDate || alert.expectedDeliveryDate
      };

      // Add to item's reorder history
      await InventoryItem.addReorderHistoryEntry(item._id, reorderData);

      // Acknowledge the alert
      await alert.acknowledge(userId, 'Reorder request created');

      logger.info('Reorder request created successfully', {
        alertId,
        itemId: item._id,
        quantity: reorderData.quantity,
        userId
      });

      return {
        success: true,
        reorderData,
        alert,
        item
      };

    } catch (error) {
      logger.error('Error creating reorder request:', error);
      throw error;
    }
  }

  /**
   * Process reorder approval/rejection
   * @param {string} alertId - Alert ID
   * @param {string} userId - User processing the request
   * @param {string} action - 'approve' or 'reject'
   * @param {Object} data - Additional data
   * @returns {Object} Processing result
   */
  async processReorderRequest(alertId, userId, action, data = {}) {
    try {
      const alert = await ReorderAlert.findById(alertId)
        .populate('inventoryItemId');

      if (!alert) {
        throw new Error('Alert not found');
      }

      const item = alert.inventoryItemId;

      if (action === 'approve') {
        // Update the latest reorder history entry
        const latestReorder = item.reorderSettings.reorderHistory
          .filter(entry => entry.alertId?.toString() === alertId)
          .sort((a, b) => b.date - a.date)[0];

        if (latestReorder) {
          latestReorder.status = 'approved';
          latestReorder.approvedBy = userId;
          latestReorder.orderDate = new Date();
          if (data.actualCost) latestReorder.actualCost = data.actualCost;
          if (data.notes) latestReorder.notes = data.notes;

          await item.save();
        }

        // Resolve the alert
        await alert.resolve(userId, `Reorder approved: ${data.notes || ''}`);

        logger.info('Reorder request approved', { alertId, userId });

      } else if (action === 'reject') {
        // Update the latest reorder history entry
        const latestReorder = item.reorderSettings.reorderHistory
          .filter(entry => entry.alertId?.toString() === alertId)
          .sort((a, b) => b.date - a.date)[0];

        if (latestReorder) {
          latestReorder.status = 'rejected';
          latestReorder.notes = data.notes || 'Request rejected';

          await item.save();
        }

        // Dismiss the alert
        await alert.dismiss(userId, `Reorder rejected: ${data.notes || ''}`);

        logger.info('Reorder request rejected', { alertId, userId });
      }

      return {
        success: true,
        action,
        alert,
        item
      };

    } catch (error) {
      logger.error('Error processing reorder request:', error);
      throw error;
    }
  }

  /**
   * Get reorder history for an item or hotel
   * @param {Object} options - Query options
   * @returns {Array} Reorder history
   */
  async getReorderHistory(options = {}) {
    try {
      const { hotelId, itemId, status, startDate, endDate, limit = 50 } = options;

      let query = {};

      if (hotelId) query.hotelId = hotelId;
      if (itemId) query._id = itemId;

      const items = await InventoryItem.find(query)
        .select('name category reorderSettings.reorderHistory')
        .lean();

      let allHistory = [];

      items.forEach(item => {
        if (item.reorderSettings?.reorderHistory) {
          const history = item.reorderSettings.reorderHistory.map(entry => ({
            ...entry,
            itemId: item._id,
            itemName: item.name,
            itemCategory: item.category
          }));

          allHistory = allHistory.concat(history);
        }
      });

      // Filter by status if specified
      if (status) {
        allHistory = allHistory.filter(entry => entry.status === status);
      }

      // Filter by date range if specified
      if (startDate || endDate) {
        allHistory = allHistory.filter(entry => {
          const entryDate = new Date(entry.date);
          if (startDate && entryDate < new Date(startDate)) return false;
          if (endDate && entryDate > new Date(endDate)) return false;
          return true;
        });
      }

      // Sort by date (newest first) and limit
      allHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

      if (limit) {
        allHistory = allHistory.slice(0, limit);
      }

      return allHistory;

    } catch (error) {
      logger.error('Error getting reorder history:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive reorder statistics for a hotel
   * @param {string} hotelId - Hotel ID
   * @returns {Object} Reorder statistics
   */
  async getReorderStats(hotelId) {
    try {
      const [
        activeAlerts,
        totalItemsWithReorder,
        itemsNeedingReorder,
        recentHistory
      ] = await Promise.all([
        ReorderAlert.getActiveAlerts(hotelId),
        InventoryItem.countDocuments({
          hotelId,
          'reorderSettings.autoReorderEnabled': true,
          isActive: true
        }),
        InventoryItem.getItemsNeedingReorder(hotelId),
        this.getReorderHistory({ hotelId, limit: 10 })
      ]);

      const alertStats = await ReorderAlert.getAlertStats(hotelId);

      const statsByPriority = {
        critical: activeAlerts.filter(a => a.priority === 'critical').length,
        high: activeAlerts.filter(a => a.priority === 'high').length,
        medium: activeAlerts.filter(a => a.priority === 'medium').length,
        low: activeAlerts.filter(a => a.priority === 'low').length
      };

      return {
        activeAlerts: activeAlerts.length,
        totalItemsWithReorder,
        itemsNeedingReorder: itemsNeedingReorder.length,
        statsByPriority,
        alertStats,
        recentHistory: recentHistory.slice(0, 5), // Last 5 entries
        lastCheck: new Date()
      };

    } catch (error) {
      logger.error('Error getting reorder stats:', error);
      throw error;
    }
  }
}

export default new ReorderService();