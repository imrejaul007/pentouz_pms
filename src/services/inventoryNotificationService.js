import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import websocketService from './websocketService.js';

/**
 * Inventory Notification Service
 * Handles creating and sending notifications for inventory-related events
 */
class InventoryNotificationService {
  
  /**
   * Notify admins when inventory items are damaged/missing during daily checks
   */
  async notifyInventoryIssues(dailyCheck) {
    const { hotelId, roomId, guestId, inventoryItems, housekeeperId, totalCharges } = dailyCheck;
    
    // Find all admin users for this hotel
    const admins = await User.find({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      role: 'admin',
      isActive: true
    });

    // Get room details
    const { default: Room } = await import('../models/Room.js');
    const room = await Room.findById(roomId).select('roomNumber');
    
    // Get housekeeper details
    const housekeeper = await User.findById(housekeeperId).select('name');
    
    // Get guest details if applicable
    let guest = null;
    if (guestId) {
      guest = await User.findById(guestId).select('name email');
    }

    // Find items with issues
    const damagedItems = inventoryItems.filter(item => 
      item.condition === 'damaged' || item.needsReplacement
    );
    const missingItems = inventoryItems.filter(item => 
      item.condition === 'missing'
    );
    const chargedItems = inventoryItems.filter(item => item.chargeGuest);

    const notifications = [];

    // Notification for damaged items
    if (damagedItems.length > 0) {
      const notification = {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        type: 'inventory_damage',
        title: `Inventory Damage - Room ${room.roomNumber}`,
        message: `${damagedItems.length} items damaged in Room ${room.roomNumber}. Reported by ${housekeeper.name}.${guest ? ` Guest: ${guest.name}` : ''}`,
        channels: ['in_app', 'email'],
        priority: 'high',
        metadata: {
          roomId: roomId.toString(),
          roomNumber: room.roomNumber,
          housekeeperId: housekeeperId.toString(),
          guestId: guestId?.toString(),
          dailyCheckId: dailyCheck._id.toString(),
          itemsCount: damagedItems.length,
          items: damagedItems.map(item => ({
            itemName: item.itemId?.name,
            condition: item.condition,
            reason: item.replacementReason
          }))
        }
      };

      // Create notification for each admin
      for (const admin of admins) {
        notifications.push({
          ...notification,
          userId: admin._id
        });
      }
    }

    // Notification for missing items
    if (missingItems.length > 0) {
      const notification = {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        type: 'inventory_missing',
        title: `Missing Items - Room ${room.roomNumber}`,
        message: `${missingItems.length} items missing from Room ${room.roomNumber}. Investigation required.`,
        channels: ['in_app', 'email'],
        priority: 'urgent',
        metadata: {
          roomId: roomId.toString(),
          roomNumber: room.roomNumber,
          housekeeperId: housekeeperId.toString(),
          guestId: guestId?.toString(),
          dailyCheckId: dailyCheck._id.toString(),
          itemsCount: missingItems.length,
          items: missingItems.map(item => ({
            itemName: item.itemId?.name,
            expectedQuantity: item.expectedQuantity,
            actualQuantity: item.actualQuantity
          }))
        }
      };

      for (const admin of admins) {
        notifications.push({
          ...notification,
          userId: admin._id
        });
      }
    }

    // Notification for guest charges
    if (chargedItems.length > 0 && totalCharges > 0) {
      const notification = {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        type: 'inventory_guest_charged',
        title: `Guest Charged - Room ${room.roomNumber}`,
        message: `Guest ${guest?.name || 'Unknown'} charged $${totalCharges.toFixed(2)} for ${chargedItems.length} damaged/missing items.`,
        channels: ['in_app'],
        priority: 'medium',
        metadata: {
          roomId: roomId.toString(),
          roomNumber: room.roomNumber,
          guestId: guestId?.toString(),
          guestName: guest?.name,
          totalCharges: totalCharges,
          itemsCount: chargedItems.length,
          items: chargedItems.map(item => ({
            itemName: item.itemId?.name,
            cost: item.replacementCost,
            reason: item.replacementReason
          }))
        }
      };

      for (const admin of admins) {
        notifications.push({
          ...notification,
          userId: admin._id
        });
      }
    }

    // Bulk create notifications
    if (notifications.length > 0) {
      const createdNotifications = await Notification.insertMany(notifications);
      console.log(`Created ${notifications.length} inventory notifications`);
      
      // Broadcast real-time notifications to admins
      if (createdNotifications.length > 0) {
        const sampleNotification = createdNotifications[0];
        websocketService.broadcastInventoryNotification(hotelId.toString(), {
          type: sampleNotification.type,
          title: sampleNotification.title,
          message: sampleNotification.message,
          priority: sampleNotification.priority,
          metadata: sampleNotification.metadata,
          count: createdNotifications.length,
          roomNumber: room.roomNumber,
          timestamp: new Date().toISOString()
        });
      }
    }

    return notifications.length;
  }

  /**
   * Notify admins when checkout inspection fails
   */
  async notifyCheckoutInspectionFailed(inspection) {
    const { hotelId, roomId, bookingId, guestId, totalCharges } = inspection;
    
    const admins = await User.find({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      role: 'admin',
      isActive: true
    });

    const { default: Room } = await import('../models/Room.js');
    const room = await Room.findById(roomId).select('roomNumber');
    const guest = await User.findById(guestId).select('name email');

    const notifications = [];
    
    if (totalCharges > 0) {
      const notification = {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        type: 'checkout_inspection_failed',
        title: `Checkout Issues - Room ${room.roomNumber}`,
        message: `Checkout inspection found issues in Room ${room.roomNumber}. Guest ${guest.name} charged $${totalCharges.toFixed(2)}.`,
        channels: ['in_app', 'email'],
        priority: 'high',
        metadata: {
          roomId: roomId.toString(),
          roomNumber: room.roomNumber,
          bookingId: bookingId.toString(),
          guestId: guestId.toString(),
          guestName: guest.name,
          totalCharges: totalCharges,
          inspectionId: inspection._id.toString()
        }
      };

      for (const admin of admins) {
        notifications.push({
          ...notification,
          userId: admin._id
        });
      }
    }

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    return notifications.length;
  }

  /**
   * Notify admins about low stock items
   */
  async notifyLowStock(hotelId, lowStockItems) {
    const admins = await User.find({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      role: 'admin',
      isActive: true
    });

    if (lowStockItems.length === 0) return 0;

    const notifications = [];
    const notification = {
      hotelId: new mongoose.Types.ObjectId(hotelId),
      type: 'inventory_low_stock',
      title: `Low Stock Alert`,
      message: `${lowStockItems.length} items are running low on stock. Immediate restocking required.`,
      channels: ['in_app', 'email'],
      priority: 'medium',
      metadata: {
        itemsCount: lowStockItems.length,
        items: lowStockItems.map(item => ({
          name: item.name,
          currentStock: item.currentStock,
          threshold: item.stockThreshold,
          category: item.category
        }))
      }
    };

    for (const admin of admins) {
      notifications.push({
        ...notification,
        userId: admin._id
      });
    }

    await Notification.insertMany(notifications);
    return notifications.length;
  }

  /**
   * Get inventory-related notifications for admin
   */
  async getInventoryNotifications(userId, hotelId, limit = 50) {
    const inventoryTypes = [
      'inventory_damage',
      'inventory_missing', 
      'inventory_replacement_needed',
      'inventory_guest_charged',
      'inventory_low_stock',
      'checkout_inspection_failed',
      'inventory_theft'
    ];

    return await Notification.find({
      userId: new mongoose.Types.ObjectId(userId),
      hotelId: new mongoose.Types.ObjectId(hotelId),
      type: { $in: inventoryTypes }
    })
    .sort({ createdAt: -1 })
    .limit(limit);
  }

  /**
   * Mark inventory notifications as read
   */
  async markInventoryNotificationsRead(userId, notificationIds) {
    return await Notification.updateMany(
      {
        _id: { $in: notificationIds.map(id => new mongoose.Types.ObjectId(id)) },
        userId: new mongoose.Types.ObjectId(userId)
      },
      { 
        status: 'read',
        readAt: new Date()
      }
    );
  }

  /**
   * Get unread inventory notification count
   */
  async getUnreadInventoryCount(userId, hotelId) {
    const inventoryTypes = [
      'inventory_damage',
      'inventory_missing', 
      'inventory_replacement_needed',
      'inventory_guest_charged',
      'inventory_low_stock',
      'checkout_inspection_failed',
      'inventory_theft'
    ];

    return await Notification.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
      hotelId: new mongoose.Types.ObjectId(hotelId),
      type: { $in: inventoryTypes },
      status: { $ne: 'read' }
    });
  }

  /**
   * Notify admins about daily inventory audit results
   */
  async notifyInventoryAuditResults(hotelId, auditResults) {
    const admins = await User.find({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      role: 'admin',
      isActive: true
    });

    if (admins.length === 0) return 0;

    const { lowStockCount, outOfStockCount } = auditResults;
    
    if (lowStockCount === 0 && outOfStockCount === 0) return 0;

    const priority = outOfStockCount > 0 ? 'high' : 'medium';
    const notifications = [];
    
    const notification = {
      hotelId: new mongoose.Types.ObjectId(hotelId),
      type: 'inventory_audit_alert',
      title: `Daily Inventory Audit Alert`,
      message: `Audit found ${lowStockCount} low stock items${outOfStockCount > 0 ? ` and ${outOfStockCount} out-of-stock items` : ''}. Review inventory status immediately.`,
      channels: ['in_app', 'email'],
      priority,
      metadata: {
        auditDate: new Date().toISOString().split('T')[0],
        lowStockCount,
        outOfStockCount,
        categories: auditResults.categories
      }
    };

    for (const admin of admins) {
      notifications.push({
        ...notification,
        userId: admin._id
      });
    }

    // Create notifications
    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
      console.log(`Created ${notifications.length} audit notifications`);
      
      // Broadcast real-time notification
      const sampleNotification = notifications[0];
      websocketService.broadcastInventoryNotification(hotelId.toString(), {
        type: 'inventory_audit_alert',
        title: sampleNotification.title,
        message: sampleNotification.message,
        priority: sampleNotification.priority,
        metadata: sampleNotification.metadata,
        count: notifications.length,
        timestamp: new Date().toISOString()
      });
    }

    return notifications.length;
  }

  /**
   * Notify admins about weekly inventory report
   */
  async notifyWeeklyInventoryReport(hotelId, reportData) {
    const admins = await User.find({
      hotelId: new mongoose.Types.ObjectId(hotelId),
      role: 'admin',
      isActive: true
    });

    if (admins.length === 0) return 0;

    const notifications = [];
    const notification = {
      hotelId: new mongoose.Types.ObjectId(hotelId),
      type: 'inventory_weekly_report',
      title: `Weekly Inventory Report`,
      message: `Weekly inventory report: ${reportData.totalItems} items, $${reportData.totalValue.toFixed(2)} total value, ${reportData.lowStockItems} items need restocking.`,
      channels: ['in_app', 'email'],
      priority: 'low',
      metadata: {
        reportWeek: new Date().toISOString().split('T')[0],
        ...reportData
      }
    };

    for (const admin of admins) {
      notifications.push({
        ...notification,
        userId: admin._id
      });
    }

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
      console.log(`Created ${notifications.length} weekly report notifications`);
    }

    return notifications.length;
  }
}

export default new InventoryNotificationService();