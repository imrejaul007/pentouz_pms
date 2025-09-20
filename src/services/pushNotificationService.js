import webpush from 'web-push';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

// Configure web-push (these should be environment variables in production)
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || 'BMqSvZjJj5s_1V8nW8l8g2q2Q5rP5K5c4b2D1w7X4q2c',
  privateKey: process.env.VAPID_PRIVATE_KEY || 'example-private-key'
};

webpush.setVapidDetails(
  'mailto:admin@hotelmanagement.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

class PushNotificationService {
  /**
   * Subscribe user to push notifications
   */
  async subscribe(userId, subscription) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Store subscription in user profile
      user.pushSubscription = subscription;
      user.pushNotificationsEnabled = true;
      await user.save();

      console.log(`User ${user.email} subscribed to push notifications`);
      
      // Send welcome notification
      await this.sendNotification(userId, {
        title: 'Notifications Enabled!',
        body: 'You will now receive important updates and alerts.',
        icon: '/icons/icon-192x192.png',
        tag: 'welcome',
        requireInteraction: false
      });

      return { success: true, message: 'Successfully subscribed to push notifications' };
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe user from push notifications
   */
  async unsubscribe(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      user.pushSubscription = null;
      user.pushNotificationsEnabled = false;
      await user.save();

      console.log(`User ${user.email} unsubscribed from push notifications`);
      return { success: true, message: 'Successfully unsubscribed from push notifications' };
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      throw error;
    }
  }

  /**
   * Send push notification to a user
   */
  async sendNotification(userId, notificationData) {
    try {
      const user = await User.findById(userId);
      if (!user || !user.pushSubscription || !user.pushNotificationsEnabled) {
        console.log(`User ${userId} is not subscribed to push notifications`);
        return { success: false, message: 'User not subscribed' };
      }

      const payload = JSON.stringify({
        title: notificationData.title,
        body: notificationData.body,
        icon: notificationData.icon || '/icons/icon-192x192.png',
        badge: notificationData.badge || '/icons/badge-72x72.png',
        tag: notificationData.tag || 'default',
        requireInteraction: notificationData.requireInteraction || false,
        actions: notificationData.actions || [],
        data: {
          url: notificationData.url,
          userId: userId,
          timestamp: new Date().toISOString(),
          ...notificationData.data
        }
      });

      const result = await webpush.sendNotification(user.pushSubscription, payload);
      
      // Store notification in database
      await this.storeNotification(userId, notificationData);
      
      console.log(`Push notification sent to user ${user.email}`);
      return { success: true, result };
    } catch (error) {
      console.error('Error sending push notification:', error);
      
      // Handle expired subscriptions
      if (error.statusCode === 410) {
        console.log('Subscription expired, removing from user profile');
        await this.unsubscribe(userId);
      }
      
      throw error;
    }
  }

  /**
   * Send notification to multiple users
   */
  async sendBulkNotification(userIds, notificationData) {
    const results = [];
    
    for (const userId of userIds) {
      try {
        const result = await this.sendNotification(userId, notificationData);
        results.push({ userId, ...result });
      } catch (error) {
        results.push({ 
          userId, 
          success: false, 
          error: error.message 
        });
      }
    }
    
    return results;
  }

  /**
   * Send notification to users by role
   */
  async sendNotificationByRole(hotelId, roles, notificationData) {
    try {
      const users = await User.find({
        hotelId,
        role: { $in: roles },
        pushNotificationsEnabled: true,
        pushSubscription: { $ne: null }
      });

      const userIds = users.map(user => user._id.toString());
      return await this.sendBulkNotification(userIds, notificationData);
    } catch (error) {
      console.error('Error sending notification by role:', error);
      throw error;
    }
  }

  /**
   * Send housekeeping task notifications
   */
  async sendHousekeepingTaskNotification(hotelId, taskData) {
    const notificationData = {
      title: `New Housekeeping Task`,
      body: `Room ${taskData.roomNumber}: ${taskData.taskType}`,
      icon: '/icons/housekeeping-icon.png',
      tag: 'housekeeping',
      url: '/staff/housekeeping',
      requireInteraction: true,
      actions: [
        {
          action: 'view',
          title: 'View Task',
          icon: '/icons/view-icon.png'
        },
        {
          action: 'accept',
          title: 'Accept Task',
          icon: '/icons/accept-icon.png'
        }
      ],
      data: {
        type: 'housekeeping_task',
        taskId: taskData.taskId,
        roomNumber: taskData.roomNumber,
        priority: taskData.priority
      }
    };

    return await this.sendNotificationByRole(
      hotelId, 
      ['housekeeping', 'staff'], 
      notificationData
    );
  }

  /**
   * Send maintenance request notifications
   */
  async sendMaintenanceNotification(hotelId, maintenanceData) {
    const notificationData = {
      title: `${maintenanceData.priority.toUpperCase()} Maintenance Request`,
      body: `Room ${maintenanceData.roomNumber}: ${maintenanceData.description}`,
      icon: '/icons/maintenance-icon.png',
      tag: 'maintenance',
      url: '/staff/maintenance',
      requireInteraction: maintenanceData.priority === 'urgent',
      actions: [
        {
          action: 'view',
          title: 'View Request',
          icon: '/icons/view-icon.png'
        },
        {
          action: 'assign',
          title: 'Assign to Me',
          icon: '/icons/assign-icon.png'
        }
      ],
      data: {
        type: 'maintenance_request',
        requestId: maintenanceData.requestId,
        roomNumber: maintenanceData.roomNumber,
        priority: maintenanceData.priority
      }
    };

    return await this.sendNotificationByRole(
      hotelId, 
      ['maintenance', 'staff'], 
      notificationData
    );
  }

  /**
   * Send guest service request notifications
   */
  async sendGuestServiceNotification(hotelId, serviceData) {
    const notificationData = {
      title: 'Guest Service Request',
      body: `Room ${serviceData.roomNumber}: ${serviceData.serviceType}`,
      icon: '/icons/service-icon.png',
      tag: 'guest-service',
      url: '/staff/guest-services',
      requireInteraction: false,
      actions: [
        {
          action: 'view',
          title: 'View Request',
          icon: '/icons/view-icon.png'
        },
        {
          action: 'fulfill',
          title: 'Fulfill Request',
          icon: '/icons/fulfill-icon.png'
        }
      ],
      data: {
        type: 'guest_service',
        serviceId: serviceData.serviceId,
        roomNumber: serviceData.roomNumber,
        guestName: serviceData.guestName
      }
    };

    return await this.sendNotificationByRole(
      hotelId, 
      ['front_desk', 'staff'], 
      notificationData
    );
  }

  /**
   * Send booking notifications
   */
  async sendBookingNotification(hotelId, bookingData) {
    const notificationData = {
      title: 'New Booking',
      body: `${bookingData.guestName} - Room ${bookingData.roomNumber}`,
      icon: '/icons/booking-icon.png',
      tag: 'booking',
      url: '/admin/bookings',
      requireInteraction: false,
      data: {
        type: 'new_booking',
        bookingId: bookingData.bookingId,
        roomNumber: bookingData.roomNumber,
        guestName: bookingData.guestName,
        checkIn: bookingData.checkIn
      }
    };

    return await this.sendNotificationByRole(
      hotelId, 
      ['admin', 'front_desk'], 
      notificationData
    );
  }

  /**
   * Send check-in reminders
   */
  async sendCheckInReminders(hotelId) {
    try {
      // This would typically be called by a scheduled job
      const today = new Date();
      const bookings = await this.getBookingsForDate(hotelId, today);
      
      for (const booking of bookings) {
        const notificationData = {
          title: 'Check-in Reminder',
          body: `${booking.guestName} - Room ${booking.roomNumber} checking in today`,
          icon: '/icons/checkin-icon.png',
          tag: 'check-in-reminder',
          url: `/admin/bookings/${booking._id}`,
          data: {
            type: 'check_in_reminder',
            bookingId: booking._id,
            roomNumber: booking.roomNumber,
            guestName: booking.guestName
          }
        };

        await this.sendNotificationByRole(
          hotelId, 
          ['admin', 'front_desk'], 
          notificationData
        );
      }
    } catch (error) {
      console.error('Error sending check-in reminders:', error);
    }
  }

  /**
   * Send overdue task notifications
   */
  async sendOverdueTaskNotifications(hotelId) {
    try {
      const overdueTasks = await this.getOverdueTasks(hotelId);
      
      for (const task of overdueTasks) {
        const notificationData = {
          title: 'Overdue Task Alert',
          body: `Room ${task.roomNumber}: ${task.description} is overdue`,
          icon: '/icons/alert-icon.png',
          tag: 'overdue-task',
          url: '/staff/tasks',
          requireInteraction: true,
          data: {
            type: 'overdue_task',
            taskId: task._id,
            roomNumber: task.roomNumber,
            overdueDays: task.overdueDays
          }
        };

        // Send to assigned staff member
        if (task.assignedTo) {
          await this.sendNotification(task.assignedTo, notificationData);
        } else {
          // Send to all relevant staff
          await this.sendNotificationByRole(
            hotelId, 
            [task.department || 'staff'], 
            notificationData
          );
        }
      }
    } catch (error) {
      console.error('Error sending overdue task notifications:', error);
    }
  }

  /**
   * Send sync completion notifications (for offline users)
   */
  async sendSyncNotification(userId, syncData) {
    const notificationData = {
      title: 'Data Synchronized',
      body: `${syncData.itemCount} items successfully synced to server`,
      icon: '/icons/sync-icon.png',
      tag: 'sync-complete',
      requireInteraction: false,
      data: {
        type: 'sync_complete',
        itemCount: syncData.itemCount,
        syncTypes: syncData.syncTypes
      }
    };

    return await this.sendNotification(userId, notificationData);
  }

  /**
   * Store notification in database for history
   */
  async storeNotification(userId, notificationData) {
    try {
      const notification = new Notification({
        userId,
        title: notificationData.title,
        body: notificationData.body,
        type: notificationData.data?.type || 'general',
        tag: notificationData.tag,
        url: notificationData.url,
        data: notificationData.data,
        sentAt: new Date(),
        isRead: false
      });

      await notification.save();
      return notification;
    } catch (error) {
      console.error('Error storing notification:', error);
    }
  }

  /**
   * Get notification history for user
   */
  async getNotificationHistory(userId, limit = 50) {
    try {
      const notifications = await Notification.find({ userId })
        .sort({ sentAt: -1 })
        .limit(limit);
      
      return notifications;
    } catch (error) {
      console.error('Error fetching notification history:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(userId, notificationId) {
    try {
      await Notification.findOneAndUpdate(
        { _id: notificationId, userId },
        { isRead: true, readAt: new Date() }
      );
      
      return { success: true };
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId) {
    try {
      const count = await Notification.countDocuments({
        userId,
        isRead: false
      });
      
      return count;
    } catch (error) {
      console.error('Error getting unread count:', error);
      throw error;
    }
  }

  /**
   * Helper method to get bookings for a specific date
   */
  async getBookingsForDate(hotelId, date) {
    // This would be implemented based on your Booking model
    // Placeholder implementation
    const { default: Booking } = await import('../models/Booking.js');
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return await Booking.find({
      hotelId,
      checkIn: { $gte: startOfDay, $lte: endOfDay }
    }).populate('roomId');
  }

  /**
   * Helper method to get overdue tasks
   */
  async getOverdueTasks(hotelId) {
    // This would be implemented based on your Task/Housekeeping model
    const { default: Housekeeping } = await import('../models/Housekeeping.js');
    const now = new Date();

    return await Housekeeping.find({
      hotelId,
      status: { $ne: 'completed' },
      scheduledFor: { $lt: now }
    }).populate('roomId assignedTo');
  }

  /**
   * Test push notification (for debugging)
   */
  async sendTestNotification(userId) {
    const testData = {
      title: 'Test Notification',
      body: 'This is a test push notification from the Hotel Management System',
      icon: '/icons/icon-192x192.png',
      tag: 'test',
      requireInteraction: false,
      data: {
        type: 'test',
        timestamp: new Date().toISOString()
      }
    };

    return await this.sendNotification(userId, testData);
  }
}

export default new PushNotificationService();