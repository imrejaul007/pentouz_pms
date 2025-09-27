/**
 * PLAN 1: Notification Categories by Role
 * Comprehensive notification configuration for Admin, Staff, and Guest roles
 */

// Admin Notifications - Complete operations oversight
export const adminNotificationTypes = {
  // Bookings & Revenue
  'new_booking': {
    priority: 'high',
    channels: ['in_app', 'email'],
    category: 'booking',
    description: 'New booking received'
  },
  'booking_cancelled': {
    priority: 'high',
    channels: ['in_app', 'email'],
    category: 'booking',
    description: 'Booking cancellation alert'
  },
  'large_booking': {
    priority: 'urgent',
    channels: ['in_app', 'email', 'sms'],
    category: 'booking',
    description: 'Large group booking notification'
  },
  'payment_received': {
    priority: 'medium',
    channels: ['in_app'],
    category: 'payment',
    description: 'Payment successfully received'
  },
  'payment_failed': {
    priority: 'high',
    channels: ['in_app', 'email'],
    category: 'payment',
    description: 'Payment processing failure'
  },

  // Operations
  'low_occupancy_alert': {
    priority: 'high',
    channels: ['in_app', 'email'],
    category: 'operations',
    description: 'Low occupancy warning'
  },
  'overbooking_risk': {
    priority: 'urgent',
    channels: ['in_app', 'email', 'sms'],
    category: 'operations',
    description: 'Overbooking situation alert'
  },
  'maintenance_required': {
    priority: 'high',
    channels: ['in_app'],
    category: 'maintenance',
    description: 'Maintenance attention required'
  },
  'inventory_low': {
    priority: 'medium',
    channels: ['in_app'],
    category: 'inventory',
    description: 'Low inventory levels'
  },
  'inventory_damaged': {
    priority: 'medium',
    channels: ['in_app', 'email'],
    category: 'inventory',
    description: 'Damaged inventory found during room check'
  },
  'inventory_missing': {
    priority: 'high',
    channels: ['in_app', 'email'],
    category: 'security',
    description: 'Missing inventory items detected'
  },
  'inventory_theft_suspected': {
    priority: 'urgent',
    channels: ['in_app', 'email', 'sms'],
    category: 'security',
    description: 'Suspected inventory theft detected'
  },

  // Staff & Security
  'staff_emergency': {
    priority: 'urgent',
    channels: ['in_app', 'sms'],
    category: 'emergency',
    description: 'Staff emergency situation'
  },
  'security_alert': {
    priority: 'urgent',
    channels: ['in_app', 'email', 'sms'],
    category: 'security',
    description: 'Security incident alert'
  },
  'system_error': {
    priority: 'high',
    channels: ['in_app', 'email'],
    category: 'system',
    description: 'System error notification'
  },

  // Analytics
  'daily_report_ready': {
    priority: 'low',
    channels: ['in_app', 'email'],
    category: 'analytics',
    description: 'Daily reports generated'
  },
  'revenue_milestone': {
    priority: 'medium',
    channels: ['in_app'],
    category: 'analytics',
    description: 'Revenue milestone achieved'
  },

  // Phase 6: Operational Intelligence (Already implemented)
  'daily_operations_summary': {
    priority: 'low',
    channels: ['in_app', 'email'],
    category: 'operations',
    description: 'Daily operations summary report'
  },
  'staff_performance_alert': {
    priority: 'medium',
    channels: ['in_app'],
    category: 'staff',
    description: 'Staff performance metrics alert'
  },
  'revenue_impact_alert': {
    priority: 'high',
    channels: ['in_app', 'email'],
    category: 'revenue',
    description: 'Revenue impact notification'
  },
  'guest_satisfaction_low': {
    priority: 'high',
    channels: ['in_app', 'email'],
    category: 'guest',
    description: 'Low guest satisfaction alert'
  },
  'equipment_failure_pattern': {
    priority: 'medium',
    channels: ['in_app'],
    category: 'maintenance',
    description: 'Equipment failure pattern detected'
  }
};

// Staff Notifications - Task-focused operations
export const staffNotificationTypes = {
  // Work Assignments
  'room_assigned': {
    priority: 'high',
    channels: ['in_app', 'push'],
    category: 'assignment',
    description: 'Room assignment notification'
  },
  'task_assigned': {
    priority: 'high',
    channels: ['in_app', 'push'],
    category: 'assignment',
    description: 'Task assignment notification'
  },
  'shift_reminder': {
    priority: 'medium',
    channels: ['in_app', 'push'],
    category: 'schedule',
    description: 'Shift timing reminder'
  },

  // Guest Services
  'guest_request': {
    priority: 'high',
    channels: ['in_app', 'push'],
    category: 'guest_service',
    description: 'Guest service request'
  },
  'vip_guest_arrival': {
    priority: 'urgent',
    channels: ['in_app', 'push'],
    category: 'guest_service',
    description: 'VIP guest arrival notification'
  },
  'complaint_received': {
    priority: 'high',
    channels: ['in_app'],
    category: 'guest_service',
    description: 'Guest complaint notification'
  },

  // Operations
  'inventory_request_approved': {
    priority: 'medium',
    channels: ['in_app'],
    category: 'inventory',
    description: 'Inventory request approval'
  },
  'schedule_change': {
    priority: 'high',
    channels: ['in_app', 'email'],
    category: 'schedule',
    description: 'Schedule modification alert'
  },
  'emergency_alert': {
    priority: 'urgent',
    channels: ['in_app', 'push', 'sms'],
    category: 'emergency',
    description: 'Emergency situation alert'
  },

  // Daily Operations (Already partially implemented)
  'daily_check_assigned': {
    priority: 'medium',
    channels: ['in_app', 'push'],
    category: 'daily_ops',
    description: 'Daily routine check assignment'
  },
  'maintenance_assigned': {
    priority: 'medium',
    channels: ['in_app', 'push'],
    category: 'maintenance',
    description: 'Maintenance task assignment'
  },
  'housekeeping_assigned': {
    priority: 'medium',
    channels: ['in_app', 'push'],
    category: 'housekeeping',
    description: 'Housekeeping task assignment'
  }
};

// Guest Notifications - Experience-focused
export const guestNotificationTypes = {
  // Booking
  'booking_confirmed': {
    priority: 'high',
    channels: ['in_app', 'email'],
    category: 'booking',
    description: 'Booking confirmation'
  },
  'check_in_reminder': {
    priority: 'medium',
    channels: ['in_app', 'email', 'sms'],
    category: 'booking',
    description: 'Check-in time reminder'
  },
  'check_out_reminder': {
    priority: 'medium',
    channels: ['in_app', 'push'],
    category: 'booking',
    description: 'Check-out time reminder'
  },
  'room_ready': {
    priority: 'high',
    channels: ['in_app', 'push', 'sms'],
    category: 'booking',
    description: 'Room ready notification'
  },

  // Services
  'service_confirmed': {
    priority: 'medium',
    channels: ['in_app', 'email'],
    category: 'service',
    description: 'Service booking confirmation'
  },
  'service_ready': {
    priority: 'high',
    channels: ['in_app', 'push'],
    category: 'service',
    description: 'Service ready notification'
  },
  'dining_reservation': {
    priority: 'medium',
    channels: ['in_app', 'email'],
    category: 'service',
    description: 'Dining reservation confirmation'
  },

  // Loyalty & Offers
  'loyalty_points_earned': {
    priority: 'low',
    channels: ['in_app'],
    category: 'loyalty',
    description: 'Loyalty points earned'
  },
  'special_offer': {
    priority: 'low',
    channels: ['in_app', 'email'],
    category: 'promotional',
    description: 'Special offer notification'
  },
  'upgrade_available': {
    priority: 'medium',
    channels: ['in_app', 'push'],
    category: 'service',
    description: 'Room upgrade available'
  },

  // Stay Experience
  'welcome_message': {
    priority: 'medium',
    channels: ['in_app', 'email'],
    category: 'experience',
    description: 'Welcome to hotel message'
  },
  'checkout_complete': {
    priority: 'medium',
    channels: ['in_app', 'email'],
    category: 'booking',
    description: 'Checkout completion confirmation'
  },
  'feedback_request': {
    priority: 'low',
    channels: ['in_app', 'email'],
    category: 'feedback',
    description: 'Feedback and review request'
  }
};

// Role-based notification configuration mapping
export const roleBasedNotifications = {
  admin: adminNotificationTypes,
  manager: { ...adminNotificationTypes }, // Managers get admin notifications
  staff: staffNotificationTypes,
  housekeeping: {
    ...staffNotificationTypes,
    // Additional housekeeping-specific notifications
    'room_cleaning_assigned': {
      priority: 'high',
      channels: ['in_app', 'push'],
      category: 'housekeeping',
      description: 'Room cleaning assignment'
    },
    'cleaning_priority_high': {
      priority: 'urgent',
      channels: ['in_app', 'push'],
      category: 'housekeeping',
      description: 'High priority cleaning required'
    }
  },
  maintenance: {
    ...staffNotificationTypes,
    // Additional maintenance-specific notifications
    'equipment_failure': {
      priority: 'urgent',
      channels: ['in_app', 'push', 'sms'],
      category: 'maintenance',
      description: 'Equipment failure alert'
    },
    'preventive_maintenance_due': {
      priority: 'medium',
      channels: ['in_app'],
      category: 'maintenance',
      description: 'Preventive maintenance due'
    }
  },
  guest: guestNotificationTypes,
  travel_agent: {
    // Travel agent specific notifications
    'booking_status_update': {
      priority: 'medium',
      channels: ['in_app', 'email'],
      category: 'booking',
      description: 'Client booking status update'
    },
    'commission_update': {
      priority: 'low',
      channels: ['in_app', 'email'],
      category: 'financial',
      description: 'Commission payment update'
    }
  }
};

// Notification categories for UI organization
export const notificationCategories = {
  booking: {
    name: 'Bookings',
    icon: 'calendar',
    color: 'blue',
    description: 'Booking and reservation related notifications'
  },
  payment: {
    name: 'Payments',
    icon: 'credit-card',
    color: 'green',
    description: 'Payment processing notifications'
  },
  operations: {
    name: 'Operations',
    icon: 'settings',
    color: 'purple',
    description: 'Hotel operations and management'
  },
  maintenance: {
    name: 'Maintenance',
    icon: 'tool',
    color: 'orange',
    description: 'Maintenance and repair notifications'
  },
  housekeeping: {
    name: 'Housekeeping',
    icon: 'home',
    color: 'pink',
    description: 'Housekeeping and cleaning tasks'
  },
  inventory: {
    name: 'Inventory',
    icon: 'package',
    color: 'brown',
    description: 'Inventory management alerts'
  },
  guest_service: {
    name: 'Guest Service',
    icon: 'user-check',
    color: 'teal',
    description: 'Guest service requests and updates'
  },
  emergency: {
    name: 'Emergency',
    icon: 'alert-triangle',
    color: 'red',
    description: 'Emergency and urgent alerts'
  },
  security: {
    name: 'Security',
    icon: 'shield',
    color: 'red',
    description: 'Security related notifications'
  },
  system: {
    name: 'System',
    icon: 'cpu',
    color: 'gray',
    description: 'System and technical notifications'
  },
  analytics: {
    name: 'Analytics',
    icon: 'bar-chart',
    color: 'indigo',
    description: 'Analytics and reporting notifications'
  },
  staff: {
    name: 'Staff',
    icon: 'users',
    color: 'cyan',
    description: 'Staff management and performance'
  },
  service: {
    name: 'Services',
    icon: 'bell',
    color: 'yellow',
    description: 'Hotel services and amenities'
  },
  loyalty: {
    name: 'Loyalty',
    icon: 'star',
    color: 'gold',
    description: 'Loyalty program notifications'
  },
  promotional: {
    name: 'Promotions',
    icon: 'gift',
    color: 'lime',
    description: 'Promotional offers and deals'
  },
  experience: {
    name: 'Experience',
    icon: 'heart',
    color: 'rose',
    description: 'Guest experience enhancements'
  },
  feedback: {
    name: 'Feedback',
    icon: 'message-square',
    color: 'slate',
    description: 'Feedback and review requests'
  },
  assignment: {
    name: 'Assignments',
    icon: 'clipboard',
    color: 'emerald',
    description: 'Task and room assignments'
  },
  schedule: {
    name: 'Schedule',
    icon: 'clock',
    color: 'violet',
    description: 'Schedule and timing notifications'
  },
  daily_ops: {
    name: 'Daily Operations',
    icon: 'check-circle',
    color: 'sky',
    description: 'Daily operational tasks'
  },
  revenue: {
    name: 'Revenue',
    icon: 'trending-up',
    color: 'green',
    description: 'Revenue and financial impact'
  },
  financial: {
    name: 'Financial',
    icon: 'dollar-sign',
    color: 'green',
    description: 'Financial transactions and updates'
  }
};

// Priority levels configuration
export const priorityLevels = {
  urgent: {
    name: 'Urgent',
    color: 'red',
    icon: 'alert-circle',
    sound: true,
    vibration: true,
    persistent: true,
    channels: ['in_app', 'push', 'sms', 'email']
  },
  high: {
    name: 'High',
    color: 'orange',
    icon: 'alert-triangle',
    sound: true,
    vibration: false,
    persistent: true,
    channels: ['in_app', 'push', 'email']
  },
  medium: {
    name: 'Medium',
    color: 'yellow',
    icon: 'info',
    sound: false,
    vibration: false,
    persistent: false,
    channels: ['in_app', 'push']
  },
  low: {
    name: 'Low',
    color: 'blue',
    icon: 'bell',
    sound: false,
    vibration: false,
    persistent: false,
    channels: ['in_app']
  }
};

// Get notifications for specific role
export function getNotificationsForRole(role) {
  return roleBasedNotifications[role] || {};
}

// Get all notification types
export function getAllNotificationTypes() {
  const allTypes = {};
  Object.values(roleBasedNotifications).forEach(roleNotifications => {
    Object.assign(allTypes, roleNotifications);
  });
  return allTypes;
}

// Get categories for role
export function getCategoriesForRole(role) {
  const roleNotifications = getNotificationsForRole(role);
  const categories = new Set();

  Object.values(roleNotifications).forEach(notification => {
    if (notification.category) {
      categories.add(notification.category);
    }
  });

  return Array.from(categories).map(categoryId => ({
    id: categoryId,
    ...notificationCategories[categoryId]
  }));
}

// Check if notification type is valid for role
export function isValidNotificationForRole(notificationType, role) {
  const roleNotifications = getNotificationsForRole(role);
  return notificationType in roleNotifications;
}

export default {
  adminNotificationTypes,
  staffNotificationTypes,
  guestNotificationTypes,
  roleBasedNotifications,
  notificationCategories,
  priorityLevels,
  getNotificationsForRole,
  getAllNotificationTypes,
  getCategoriesForRole,
  isValidNotificationForRole
};