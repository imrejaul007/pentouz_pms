import User from '../models/User.js';
import NotificationPreference from '../models/NotificationPreference.js';
import NotificationAnalytics from '../models/NotificationAnalytics.js';

class NotificationRoutingService {
  constructor() {
    // Notification type to role mapping
    this.roleRoutingRules = {
      // Guest-specific notifications
      'booking_confirmation': ['guest'],
      'booking_reminder': ['guest'],
      'booking_cancellation': ['guest'],
      'payment_success': ['guest'],
      'payment_failed': ['guest', 'admin'], // Admin needs to know about payment failures
      'loyalty_points': ['guest'],
      'service_booking': ['guest'],
      'service_reminder': ['guest'],
      'promotional': ['guest'],
      'welcome': ['guest'],
      'check_in': ['guest', 'staff'],
      'check_out': ['guest', 'staff'],
      'review_request': ['guest'],
      'special_offer': ['guest'],

      // Staff-specific notifications
      'maintenance_alert': ['staff', 'admin'],
      'housekeeping_task': ['staff'],
      'inventory_alert': ['staff', 'admin'],
      'guest_request': ['staff'],
      'room_status_update': ['staff'],
      'shift_reminder': ['staff'],
      'task_assignment': ['staff'],
      'supply_request': ['staff', 'admin'],

      // Admin-specific notifications
      'system_alert': ['admin'],
      'security_alert': ['admin'],
      'financial_alert': ['admin'],
      'occupancy_alert': ['admin', 'staff'],
      'revenue_milestone': ['admin'],
      'staff_alert': ['admin'],
      'compliance_alert': ['admin'],
      'overbooking_alert': ['admin', 'staff'],

      // Multi-role notifications
      'emergency': ['admin', 'staff'],
      'system_maintenance': ['admin', 'staff'],
      'policy_update': ['admin', 'staff', 'guest']
    };

    // Department-specific routing
    this.departmentRouting = {
      'housekeeping': ['Housekeeping'],
      'maintenance': ['Maintenance'],
      'front_desk': ['Front Desk', 'Reception'],
      'food_beverage': ['Food & Beverage'],
      'security': ['Security'],
      'it_support': ['IT Support'],
      'management': ['Management']
    };

    // Priority-based routing preferences
    this.priorityRouting = {
      'urgent': {
        channels: ['push', 'sms', 'email', 'in_app'],
        requiresAcknowledgment: true,
        escalationDelay: 5 * 60 * 1000, // 5 minutes
        maxEscalationLevels: 3
      },
      'high': {
        channels: ['push', 'email', 'in_app'],
        requiresAcknowledgment: true,
        escalationDelay: 15 * 60 * 1000, // 15 minutes
        maxEscalationLevels: 2
      },
      'medium': {
        channels: ['email', 'in_app'],
        requiresAcknowledgment: false,
        escalationDelay: null,
        maxEscalationLevels: 0
      },
      'low': {
        channels: ['in_app'],
        requiresAcknowledgment: false,
        escalationDelay: null,
        maxEscalationLevels: 0
      }
    };
  }

  /**
   * Route notification to appropriate users based on type, priority, and context
   */
  async routeNotification(notificationData) {
    const {
      type,
      priority = 'medium',
      hotelId,
      metadata = {},
      excludeUsers = []
    } = notificationData;

    try {
      // Get target roles for this notification type
      const targetRoles = this.roleRoutingRules[type] || ['admin'];

      // Get all users who should receive this notification
      const recipients = await this.getTargetUsers({
        hotelId,
        roles: targetRoles,
        department: metadata.department,
        excludeUsers,
        metadata
      });

      // Filter recipients based on their preferences and availability
      const filteredRecipients = await this.filterRecipientsByPreferences(
        recipients,
        type,
        priority
      );

      // Determine delivery channels for each recipient
      const routingPlan = await this.createRoutingPlan(
        filteredRecipients,
        type,
        priority,
        metadata
      );

      return {
        recipients: routingPlan,
        totalRecipients: routingPlan.length,
        estimatedDeliveryTime: this.calculateEstimatedDeliveryTime(routingPlan)
      };

    } catch (error) {
      console.error('Error routing notification:', error);
      throw error;
    }
  }

  /**
   * Get target users based on roles, department, and other criteria
   */
  async getTargetUsers({ hotelId, roles, department, excludeUsers, metadata }) {
    const query = {
      hotelId,
      role: { $in: roles },
      isActive: true,
      _id: { $nin: excludeUsers }
    };

    // Add department filter if specified
    if (department && this.departmentRouting[department]) {
      query.department = { $in: this.departmentRouting[department] };
    }

    // Add shift-based filtering for staff
    if (roles.includes('staff') && metadata.shiftSensitive) {
      const currentHour = new Date().getHours();
      // This would need to be enhanced with actual shift data
      query.currentShift = this.getCurrentShiftType(currentHour);
    }

    const users = await User.find(query)
      .select('_id name email phone role department preferences')
      .lean();

    return users;
  }

  /**
   * Filter recipients based on their notification preferences
   */
  async filterRecipientsByPreferences(users, notificationType, priority) {
    const filteredUsers = [];

    for (const user of users) {
      try {
        // Get user's notification preferences
        const preferences = await NotificationPreference.findOne({ userId: user._id });

        if (!preferences) {
          // If no preferences set, use defaults based on role
          filteredUsers.push({
            ...user,
            preferences: this.getDefaultPreferences(user.role)
          });
          continue;
        }

        // Check if user has this notification type enabled
        const typeEnabled = this.isNotificationTypeEnabled(
          preferences,
          notificationType,
          user.role
        );

        if (!typeEnabled) {
          continue;
        }

        // Check quiet hours
        if (this.isInQuietHours(preferences)) {
          // Only urgent notifications override quiet hours
          if (priority !== 'urgent') {
            continue;
          }
        }

        // Check if user is currently available (for staff)
        if (user.role === 'staff') {
          const isAvailable = await this.checkStaffAvailability(user._id, preferences);
          if (!isAvailable && priority !== 'urgent') {
            continue;
          }
        }

        filteredUsers.push({
          ...user,
          preferences: preferences.notifications || {}
        });

      } catch (error) {
        console.error(`Error checking preferences for user ${user._id}:`, error);
        // Include user with default preferences on error
        filteredUsers.push({
          ...user,
          preferences: this.getDefaultPreferences(user.role)
        });
      }
    }

    return filteredUsers;
  }

  /**
   * Create routing plan with channels and timing for each recipient
   */
  async createRoutingPlan(recipients, notificationType, priority, metadata) {
    const routingPlan = [];
    const priorityConfig = this.priorityRouting[priority];

    for (const recipient of recipients) {
      // Determine available channels for this user
      const availableChannels = this.getUserAvailableChannels(
        recipient,
        priorityConfig.channels
      );

      // Select optimal channels based on user preferences and notification context
      const selectedChannels = this.selectOptimalChannels(
        availableChannels,
        recipient.preferences,
        notificationType,
        priority
      );

      // Calculate delivery timing
      const deliveryTiming = this.calculateDeliveryTiming(
        recipient,
        priority,
        metadata
      );

      routingPlan.push({
        userId: recipient._id,
        user: {
          name: recipient.name,
          email: recipient.email,
          phone: recipient.phone,
          role: recipient.role,
          department: recipient.department
        },
        channels: selectedChannels,
        timing: deliveryTiming,
        requiresAcknowledgment: priorityConfig.requiresAcknowledgment,
        escalationConfig: priority === 'urgent' || priority === 'high' ? {
          enabled: true,
          delay: priorityConfig.escalationDelay,
          maxLevels: priorityConfig.maxEscalationLevels
        } : null
      });
    }

    return routingPlan;
  }

  /**
   * Get user's available notification channels
   */
  getUserAvailableChannels(user, defaultChannels) {
    const available = [];

    for (const channel of defaultChannels) {
      switch (channel) {
        case 'email':
          if (user.email && user.preferences.email?.enabled !== false) {
            available.push(channel);
          }
          break;
        case 'sms':
          if (user.phone && user.preferences.sms?.enabled !== false) {
            available.push(channel);
          }
          break;
        case 'push':
        case 'in_app':
          if (user.preferences[channel]?.enabled !== false) {
            available.push(channel);
          }
          break;
      }
    }

    return available.length > 0 ? available : ['in_app']; // Always fallback to in-app
  }

  /**
   * Select optimal channels based on user preferences and context
   */
  selectOptimalChannels(availableChannels, userPreferences, notificationType, priority) {
    const selected = [];

    // Always include in-app for immediate visibility
    if (availableChannels.includes('in_app')) {
      selected.push({
        channel: 'in_app',
        delay: 0,
        fallback: false
      });
    }

    // Add additional channels based on priority
    if (priority === 'urgent') {
      // For urgent notifications, use all available channels
      availableChannels.forEach(channel => {
        if (channel !== 'in_app') {
          selected.push({
            channel,
            delay: 0,
            fallback: false
          });
        }
      });
    } else if (priority === 'high') {
      // For high priority, add push or email
      if (availableChannels.includes('push')) {
        selected.push({
          channel: 'push',
          delay: 0,
          fallback: false
        });
      } else if (availableChannels.includes('email')) {
        selected.push({
          channel: 'email',
          delay: 60000, // 1 minute delay
          fallback: true
        });
      }
    } else {
      // For medium/low priority, respect user's channel preferences
      const preferredChannel = userPreferences.preferredChannel;
      if (preferredChannel && availableChannels.includes(preferredChannel) && preferredChannel !== 'in_app') {
        selected.push({
          channel: preferredChannel,
          delay: 300000, // 5 minutes delay for non-urgent
          fallback: true
        });
      }
    }

    return selected;
  }

  /**
   * Calculate delivery timing based on user context
   */
  calculateDeliveryTiming(recipient, priority, metadata) {
    const now = new Date();
    let deliveryTime = now;

    // Immediate delivery for urgent notifications
    if (priority === 'urgent') {
      return {
        immediate: true,
        scheduledFor: deliveryTime,
        timezone: recipient.preferences.timezone || 'UTC'
      };
    }

    // Consider user's timezone and quiet hours
    const userTimezone = recipient.preferences.timezone || 'UTC';
    const quietHours = recipient.preferences.quietHours;

    if (quietHours && priority !== 'urgent') {
      const isInQuietHours = this.isTimeInQuietHours(deliveryTime, quietHours, userTimezone);

      if (isInQuietHours) {
        // Schedule for after quiet hours
        deliveryTime = this.getNextAvailableTime(quietHours, userTimezone);
      }
    }

    return {
      immediate: false,
      scheduledFor: deliveryTime,
      timezone: userTimezone,
      respectsQuietHours: true
    };
  }

  /**
   * Check if notification type is enabled for user
   */
  isNotificationTypeEnabled(preferences, notificationType, userRole) {
    const notifications = preferences.notifications || {};

    // Check specific type setting
    if (notifications.types && notifications.types[notificationType] !== undefined) {
      return notifications.types[notificationType];
    }

    // Check category setting
    const category = this.getNotificationCategory(notificationType);
    if (notifications.categories && notifications.categories[category] !== undefined) {
      return notifications.categories[category];
    }

    // Default based on role and notification type
    return this.getDefaultTypeEnabled(notificationType, userRole);
  }

  /**
   * Check if current time is in user's quiet hours
   */
  isInQuietHours(preferences) {
    if (!preferences.notifications?.quietHours?.enabled) {
      return false;
    }

    const quietHours = preferences.notifications.quietHours;
    const now = new Date();
    const currentHour = now.getHours();

    return currentHour >= quietHours.start || currentHour <= quietHours.end;
  }

  /**
   * Check staff availability
   */
  async checkStaffAvailability(userId, preferences) {
    // This would integrate with staff scheduling system
    // For now, return true if no specific unavailability is set
    const staffPrefs = preferences.staff || {};
    return staffPrefs.available !== false;
  }

  /**
   * Get default preferences for a role
   */
  getDefaultPreferences(role) {
    const defaults = {
      guest: {
        email: { enabled: true },
        sms: { enabled: false },
        push: { enabled: true },
        in_app: { enabled: true }
      },
      staff: {
        email: { enabled: true },
        sms: { enabled: true },
        push: { enabled: true },
        in_app: { enabled: true }
      },
      admin: {
        email: { enabled: true },
        sms: { enabled: true },
        push: { enabled: true },
        in_app: { enabled: true }
      }
    };

    return defaults[role] || defaults.guest;
  }

  /**
   * Get notification category for type
   */
  getNotificationCategory(notificationType) {
    const categoryMap = {
      booking_confirmation: 'bookings',
      booking_reminder: 'bookings',
      booking_cancellation: 'bookings',
      payment_success: 'payments',
      payment_failed: 'payments',
      loyalty_points: 'loyalty',
      service_booking: 'services',
      service_reminder: 'services',
      promotional: 'marketing',
      special_offer: 'marketing',
      maintenance_alert: 'operations',
      housekeeping_task: 'operations',
      inventory_alert: 'operations',
      system_alert: 'system',
      security_alert: 'security'
    };

    return categoryMap[notificationType] || 'general';
  }

  /**
   * Get default enabled status for notification type and role
   */
  getDefaultTypeEnabled(notificationType, userRole) {
    // Most notifications are enabled by default
    // This could be made more sophisticated based on business rules
    const alwaysEnabledTypes = ['emergency', 'system_maintenance', 'security_alert'];
    const optionalTypes = ['promotional', 'special_offer'];

    if (alwaysEnabledTypes.includes(notificationType)) {
      return true;
    }

    if (optionalTypes.includes(notificationType)) {
      return userRole === 'guest' ? false : true;
    }

    return true;
  }

  /**
   * Calculate estimated delivery time for routing plan
   */
  calculateEstimatedDeliveryTime(routingPlan) {
    if (routingPlan.length === 0) {
      return 0;
    }

    const deliveryTimes = routingPlan.map(plan => {
      const channelTimes = plan.channels.map(ch => ch.delay || 0);
      return Math.min(...channelTimes);
    });

    return Math.max(...deliveryTimes);
  }

  /**
   * Get current shift type based on hour
   */
  getCurrentShiftType(hour) {
    if (hour >= 6 && hour < 14) return 'morning';
    if (hour >= 14 && hour < 22) return 'afternoon';
    return 'night';
  }

  /**
   * Check if time is in quiet hours
   */
  isTimeInQuietHours(time, quietHours, timezone) {
    // This would need proper timezone handling
    // For now, simplified implementation
    const hour = time.getHours();
    return hour >= quietHours.start || hour <= quietHours.end;
  }

  /**
   * Get next available time after quiet hours
   */
  getNextAvailableTime(quietHours, timezone) {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(quietHours.end + 1, 0, 0, 0);
    return tomorrow;
  }

  /**
   * Track routing performance for analytics
   */
  async trackRoutingPerformance(notificationId, routingPlan, actualResults) {
    try {
      const performance = {
        notificationId,
        plannedRecipients: routingPlan.length,
        actualRecipients: actualResults.delivered.length,
        deliveryRate: actualResults.delivered.length / routingPlan.length,
        averageDeliveryTime: actualResults.averageDeliveryTime,
        channelPerformance: this.analyzeChannelPerformance(routingPlan, actualResults),
        routingAccuracy: this.calculateRoutingAccuracy(routingPlan, actualResults)
      };

      // This would be stored for analytics
      console.log('Routing performance:', performance);
      return performance;
    } catch (error) {
      console.error('Error tracking routing performance:', error);
    }
  }

  /**
   * Analyze channel performance
   */
  analyzeChannelPerformance(routingPlan, actualResults) {
    const channelStats = {};

    routingPlan.forEach(plan => {
      plan.channels.forEach(ch => {
        if (!channelStats[ch.channel]) {
          channelStats[ch.channel] = { attempted: 0, successful: 0 };
        }
        channelStats[ch.channel].attempted++;
      });
    });

    actualResults.delivered.forEach(result => {
      if (channelStats[result.channel]) {
        channelStats[result.channel].successful++;
      }
    });

    return channelStats;
  }

  /**
   * Calculate routing accuracy
   */
  calculateRoutingAccuracy(routingPlan, actualResults) {
    // This would measure how well the routing predicted actual delivery success
    const planned = routingPlan.length;
    const delivered = actualResults.delivered.length;

    return planned > 0 ? delivered / planned : 0;
  }
}

export default new NotificationRoutingService();