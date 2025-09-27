import cron from 'node-cron';
import mongoose from 'mongoose';
import NotificationAutomationService from './notificationAutomationService.js';

/**
 * Notification Scheduler Service
 * Handles scheduled notifications and overdue detection
 */
class NotificationScheduler {

  static isInitialized = false;

  /**
   * Initialize all scheduled notification jobs
   */
  static initializeScheduledJobs() {
    if (this.isInitialized) {
      console.log('📅 Notification scheduler already initialized');
      return;
    }

    console.log('📅 Initializing notification scheduler...');

    // Every 30 minutes - Check for overdue daily checks
    cron.schedule('*/30 * * * *', () => {
      this.checkOverdueDailyRoutineChecks();
    });

    // Every hour - Check for overdue maintenance requests
    cron.schedule('0 * * * *', () => {
      this.checkOverdueMaintenanceRequests();
    });

    // Every hour - Check for overdue maintenance tasks
    cron.schedule('0 * * * *', () => {
      this.checkOverdueMaintenanceTasks();
    });

    // Every 2 hours - Check for overdue guest services
    cron.schedule('0 */2 * * *', () => {
      this.checkOverdueGuestServices();
    });

    // Every 4 hours - Check inventory levels during business hours
    cron.schedule('0 6-22/4 * * *', () => {
      this.checkInventoryLevels();
    });

    // Daily at 6 AM - Send daily operations summary
    cron.schedule('0 6 * * *', () => {
      this.sendDailyOperationsSummary();
    });

    // Daily at 8 PM - Send end-of-day summary
    cron.schedule('0 20 * * *', () => {
      this.sendEndOfDaySummary();
    });

    // Daily at 7 AM - Check for rooms due for deep cleaning
    cron.schedule('0 7 * * *', () => {
      this.checkDeepCleaningSchedule();
    });

    // Every 15 minutes during business hours - Send scheduled notifications
    cron.schedule('*/15 6-22 * * *', () => {
      this.processScheduledNotifications();
    });

    // Phase 6: Operational Intelligence Notifications
    // Every 2 hours during business hours - Check staff performance
    cron.schedule('0 8-20/2 * * *', () => {
      this.checkStaffPerformance();
    });

    // Every hour during business hours - Check revenue impact from out-of-order rooms
    cron.schedule('0 8-22 * * *', () => {
      this.checkRevenueImpact();
    });

    // Every 6 hours - Check guest satisfaction scores
    cron.schedule('0 */6 * * *', () => {
      this.checkGuestSatisfaction();
    });

    // Daily at 3 AM - Check equipment failure patterns
    cron.schedule('0 3 * * *', () => {
      this.checkEquipmentFailurePatterns();
    });

    this.isInitialized = true;
    console.log('✅ Notification scheduler initialized successfully');
  }

  /**
   * Check for overdue daily routine checks
   */
  static async checkOverdueDailyRoutineChecks() {
    try {
      console.log('🔍 Checking for overdue daily routine checks...');

      const DailyRoutineCheck = mongoose.model('DailyRoutineCheck');
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

      // Find daily checks that are overdue (pending/in_progress for more than 2 hours)
      const overdueChecks = await DailyRoutineCheck.find({
        status: { $in: ['pending', 'in_progress'] },
        checkDate: { $lt: twoHoursAgo }, // Check date was more than 2 hours ago
        createdAt: { $lt: twoHoursAgo } // Created more than 2 hours ago
      }).populate('roomId', 'roomNumber').populate('hotelId', '_id');

      console.log(`📋 Found ${overdueChecks.length} overdue daily checks`);

      for (const check of overdueChecks) {
        const now = new Date();
        const overdueHours = Math.floor((now - check.checkDate) / (1000 * 60 * 60));

        await NotificationAutomationService.triggerNotification(
          'daily_check_overdue',
          {
            roomNumber: check.roomId?.roomNumber || 'Unknown',
            checkId: check._id,
            assignedTo: check.checkedBy,
            overdueHours,
            checkDate: check.checkDate
          },
          'auto',
          'high',
          check.hotelId
        );

        // Update check status to overdue
        check.status = 'overdue';
        await check.save();
      }

    } catch (error) {
      console.error('❌ Error checking overdue daily routine checks:', error);
    }
  }

  /**
   * Check for overdue maintenance requests
   */
  static async checkOverdueMaintenanceRequests() {
    try {
      console.log('🔍 Checking for overdue maintenance requests...');

      const MaintenanceRequest = mongoose.model('MaintenanceRequest');
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      const urgentThreshold = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours for urgent

      // Find maintenance requests that are overdue
      const overdueMaintenanceRequests = await MaintenanceRequest.find({
        $or: [
          {
            status: { $in: ['pending', 'in_progress'] },
            priority: 'urgent',
            createdAt: { $lt: urgentThreshold }
          },
          {
            status: { $in: ['pending', 'in_progress'] },
            priority: { $ne: 'urgent' },
            createdAt: { $lt: oneDayAgo }
          },
          {
            status: { $in: ['pending', 'in_progress'] },
            scheduledDate: { $lt: new Date() } // Past scheduled date
          }
        ]
      }).populate('roomId', 'roomNumber');

      console.log(`🔧 Found ${overdueMaintenanceRequests.length} overdue maintenance requests`);

      for (const request of overdueMaintenanceRequests) {
        const now = new Date();
        const overdueHours = Math.floor((now - request.createdAt) / (1000 * 60 * 60));

        await NotificationAutomationService.triggerNotification(
          'maintenance_overdue',
          {
            roomNumber: request.roomId?.roomNumber || 'Unknown',
            requestId: request._id,
            issueType: request.issueType,
            description: request.description,
            priority: request.priority,
            assignedTo: request.assignedTo,
            overdueHours,
            createdAt: request.createdAt
          },
          'auto',
          request.priority === 'urgent' ? 'urgent' : 'high',
          request.hotelId
        );
      }

    } catch (error) {
      console.error('❌ Error checking overdue maintenance requests:', error);
    }
  }

  /**
   * Check for overdue maintenance tasks
   */
  static async checkOverdueMaintenanceTasks() {
    try {
      console.log('🔍 Checking for overdue maintenance tasks...');

      const MaintenanceTask = mongoose.model('MaintenanceTask');
      const now = new Date();

      // Find maintenance tasks that are overdue based on their dueDate
      const overdueTasks = await MaintenanceTask.find({
        dueDate: { $lt: now },
        status: { $in: ['pending', 'assigned', 'in_progress'] }
      }).populate('roomId', 'roomNumber');

      console.log(`🔧 Found ${overdueTasks.length} overdue maintenance tasks`);

      for (const task of overdueTasks) {
        const overdueHours = Math.floor((now - task.dueDate) / (1000 * 60 * 60));
        let roomNumber = 'General';
        if (task.roomId && task.roomId.roomNumber) {
          roomNumber = task.roomId.roomNumber;
        }

        await NotificationAutomationService.triggerNotification(
          'maintenance_overdue',
          {
            roomNumber,
            taskId: task._id,
            issueType: task.type,
            description: task.description || task.title,
            priority: task.priority,
            assignedTo: task.assignedTo,
            overdueHours,
            dueDate: task.dueDate,
            category: task.category
          },
          'auto',
          task.priority === 'emergency' ? 'urgent' : 'high',
          task.hotelId
        );

        // Log overdue task for monitoring
        console.log(`⚠️ Task ${task.title} (${task.type}) is ${overdueHours}h overdue in ${roomNumber}`);
      }

    } catch (error) {
      console.error('❌ Error checking overdue maintenance tasks:', error);
    }
  }

  /**
   * Check for overdue guest service requests
   */
  static async checkOverdueGuestServices() {
    try {
      console.log('🔍 Checking for overdue guest service requests...');

      const GuestService = mongoose.model('GuestService');
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      const urgentThreshold = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes for urgent

      const overdueServices = await GuestService.find({
        $or: [
          {
            status: { $in: ['pending', 'assigned', 'in_progress'] },
            priority: { $in: ['urgent', 'now'] },
            createdAt: { $lt: urgentThreshold }
          },
          {
            status: { $in: ['pending', 'assigned'] },
            priority: { $nin: ['urgent', 'now'] },
            createdAt: { $lt: twoHoursAgo }
          }
        ]
      }).populate('bookingId', 'rooms');

      console.log(`🛎️ Found ${overdueServices.length} overdue guest service requests`);

      for (const service of overdueServices) {
        // Get room number
        let roomNumber = 'Unknown';
        try {
          const booking = await mongoose.model('Booking').findById(service.bookingId).populate('rooms.roomId');
          if (booking && booking.rooms && booking.rooms[0]) {
            roomNumber = booking.rooms[0].roomId?.roomNumber || 'Unknown';
          }
        } catch (error) {
          console.log('Could not fetch room number for overdue service');
        }

        const now = new Date();
        const overdueMinutes = Math.floor((now - service.createdAt) / (1000 * 60));

        await NotificationAutomationService.triggerNotification(
          'guest_service_overdue',
          {
            roomNumber,
            serviceType: service.serviceType,
            serviceVariation: service.serviceVariation,
            requestId: service._id,
            assignedTo: service.assignedTo,
            overdueMinutes,
            priority: service.priority,
            createdAt: service.createdAt
          },
          'auto',
          service.priority === 'urgent' || service.priority === 'now' ? 'urgent' : 'high',
          service.hotelId
        );
      }

    } catch (error) {
      console.error('❌ Error checking overdue guest service requests:', error);
    }
  }

  /**
   * Check inventory levels and send low stock alerts
   */
  static async checkInventoryLevels() {
    try {
      console.log('🔍 Checking inventory levels...');

      const InventoryItem = mongoose.model('InventoryItem');

      // Get all hotels to check their inventory
      const Hotel = mongoose.model('Hotel');
      const hotels = await Hotel.find({ isActive: true }).select('_id');

      for (const hotel of hotels) {
        // Find items with low stock (using stockThreshold instead of reorderPoint)
        const lowStockItems = await InventoryItem.find({
          hotelId: hotel._id,
          $expr: { $lte: ['$currentStock', '$stockThreshold'] },
          currentStock: { $gt: 0 }, // Not completely out of stock
          isActive: true
        });

        // Find items that are out of stock
        const outOfStockItems = await InventoryItem.find({
          hotelId: hotel._id,
          currentStock: { $lte: 0 },
          isActive: true
        });

        // Find items that need reordering
        const reorderItems = await InventoryItem.find({
          hotelId: hotel._id,
          isActive: true,
          'reorderSettings.autoReorderEnabled': true,
          $expr: {
            $and: [
              { $ne: ['$reorderSettings.reorderPoint', null] },
              { $lte: ['$currentStock', '$reorderSettings.reorderPoint'] }
            ]
          }
        });

        console.log(`📦 Hotel ${hotel._id}: ${lowStockItems.length} low stock, ${outOfStockItems.length} out of stock, ${reorderItems.length} need reordering`);

        // Send low stock notifications (deduplicated - only if not in reorder list)
        for (const item of lowStockItems) {
          const needsReorder = reorderItems.some(r => r._id.toString() === item._id.toString());
          if (!needsReorder) {
            await NotificationAutomationService.triggerNotification(
              'inventory_low_stock',
              {
                itemName: item.name,
                category: item.category,
                currentStock: item.currentStock,
                stockThreshold: item.stockThreshold,
                itemId: item._id,
                supplier: item.supplier?.name || 'Unknown',
                estimatedCost: item.estimatedReorderCost || 0,
                daysUntilStockOut: item.reorderUrgency || 'Unknown'
              },
              'auto',
              item.currentStock <= (item.stockThreshold * 0.5) ? 'high' : 'medium',
              hotel._id
            );
          }
        }

        // Send out of stock notifications
        for (const item of outOfStockItems) {
          await NotificationAutomationService.triggerNotification(
            'inventory_out_of_stock',
            {
              itemName: item.name,
              category: item.category,
              itemId: item._id,
              lastKnownStock: item.stockThreshold || 0,
              supplier: item.supplier?.name || 'Unknown',
              urgentReorder: item.isUrgentReorder ? item.isUrgentReorder() : true
            },
            'auto',
            'urgent',
            hotel._id
          );
        }

        // Send reorder notifications
        for (const item of reorderItems) {
          const priority = item.isUrgentReorder ? item.isUrgentReorder() ? 'urgent' : 'high' : 'high';

          await NotificationAutomationService.triggerNotification(
            'inventory_reorder_needed',
            {
              itemName: item.name,
              category: item.category,
              currentStock: item.currentStock,
              reorderPoint: item.reorderSettings.reorderPoint,
              reorderQuantity: item.reorderSettings.reorderQuantity || 0,
              estimatedCost: item.estimatedReorderCost || 0,
              supplier: item.reorderSettings?.preferredSupplier?.name || item.supplier?.name || 'Unknown',
              supplierContact: item.reorderSettings?.preferredSupplier?.contact || item.supplier?.contact,
              leadTime: item.reorderSettings?.preferredSupplier?.leadTime || 'Unknown',
              itemId: item._id,
              urgent: item.isUrgentReorder ? item.isUrgentReorder() : false
            },
            'auto',
            priority,
            hotel._id
          );
        }
      }

    } catch (error) {
      console.error('❌ Error checking inventory levels:', error);
    }
  }

  /**
   * Send daily operations summary
   */
  static async sendDailyOperationsSummary() {
    try {
      console.log('📊 Generating daily operations summary...');

      // Get all active hotels
      const Hotel = mongoose.model('Hotel');
      const hotels = await Hotel.find({ isActive: true }).select('_id name');

      for (const hotel of hotels) {
        const summary = await this.generateDailyOperationsSummary(hotel._id);

        await NotificationAutomationService.triggerNotification(
          'daily_operations_summary',
          {
            hotelName: hotel.name,
            completedTasks: summary.completedTasks,
            pendingTasks: summary.pendingTasks,
            overdueItems: summary.overdueItems,
            maintenanceRequests: summary.maintenanceRequests,
            guestServices: summary.guestServices,
            roomsOutOfOrder: summary.roomsOutOfOrder,
            inventoryAlerts: summary.inventoryAlerts
          },
          'auto',
          'low',
          hotel._id
        );
      }

    } catch (error) {
      console.error('❌ Error sending daily operations summary:', error);
    }
  }

  /**
   * Generate daily operations summary data
   */
  static async generateDailyOperationsSummary(hotelId) {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    try {
      // Daily routine checks
      const DailyRoutineCheck = mongoose.model('DailyRoutineCheck');
      const completedChecks = await DailyRoutineCheck.countDocuments({
        hotelId,
        status: 'completed',
        checkDate: { $gte: startOfDay, $lte: endOfDay }
      });
      const pendingChecks = await DailyRoutineCheck.countDocuments({
        hotelId,
        status: { $in: ['pending', 'in_progress'] },
        checkDate: { $gte: startOfDay, $lte: endOfDay }
      });

      // Maintenance requests
      const MaintenanceRequest = mongoose.model('MaintenanceRequest');
      const completedMaintenance = await MaintenanceRequest.countDocuments({
        hotelId,
        status: 'completed',
        completedDate: { $gte: startOfDay, $lte: endOfDay }
      });
      const pendingMaintenance = await MaintenanceRequest.countDocuments({
        hotelId,
        status: { $in: ['pending', 'in_progress'] }
      });

      // Guest services
      const GuestService = mongoose.model('GuestService');
      const completedServices = await GuestService.countDocuments({
        hotelId,
        status: 'completed',
        completedTime: { $gte: startOfDay, $lte: endOfDay }
      });
      const pendingServices = await GuestService.countDocuments({
        hotelId,
        status: { $in: ['pending', 'assigned', 'in_progress'] }
      });

      // Room status
      const Room = mongoose.model('Room');
      const roomsOutOfOrder = await Room.countDocuments({
        hotelId,
        status: 'out_of_order'
      });

      // Inventory alerts (items below reorder point)
      const InventoryItem = mongoose.model('InventoryItem');
      const inventoryAlerts = await InventoryItem.countDocuments({
        hotelId,
        $expr: { $lte: ['$currentStock', '$reorderPoint'] }
      });

      return {
        completedTasks: completedChecks + completedMaintenance + completedServices,
        pendingTasks: pendingChecks + pendingServices,
        overdueItems: 0, // This would need specific overdue logic
        maintenanceRequests: {
          completed: completedMaintenance,
          pending: pendingMaintenance
        },
        guestServices: {
          completed: completedServices,
          pending: pendingServices
        },
        roomsOutOfOrder,
        inventoryAlerts
      };

    } catch (error) {
      console.error('Error generating daily summary:', error);
      return {
        completedTasks: 0,
        pendingTasks: 0,
        overdueItems: 0,
        maintenanceRequests: { completed: 0, pending: 0 },
        guestServices: { completed: 0, pending: 0 },
        roomsOutOfOrder: 0,
        inventoryAlerts: 0
      };
    }
  }

  /**
   * Send end-of-day summary
   */
  static async sendEndOfDaySummary() {
    try {
      console.log('🌅 Sending end-of-day summary...');

      const Hotel = mongoose.model('Hotel');
      const hotels = await Hotel.find({ isActive: true }).select('_id name');

      for (const hotel of hotels) {
        const summary = await this.generateEndOfDaySummary(hotel._id);

        // Only send if there are notable items to report
        if (summary.totalIssues > 0) {
          await NotificationAutomationService.triggerNotification(
            'daily_operations_summary',
            {
              hotelName: hotel.name,
              type: 'end-of-day',
              pendingMaintenance: summary.pendingMaintenance,
              pendingServices: summary.pendingServices,
              roomsNeedingAttention: summary.roomsNeedingAttention,
              totalIssues: summary.totalIssues
            },
            'auto',
            'low',
            hotel._id
          );
        }
      }

    } catch (error) {
      console.error('❌ Error sending end-of-day summary:', error);
    }
  }

  /**
   * Generate end-of-day summary data
   */
  static async generateEndOfDaySummary(hotelId) {
    try {
      const MaintenanceRequest = mongoose.model('MaintenanceRequest');
      const GuestService = mongoose.model('GuestService');
      const Room = mongoose.model('Room');

      const pendingMaintenance = await MaintenanceRequest.countDocuments({
        hotelId,
        status: { $in: ['pending', 'in_progress'] }
      });

      const pendingServices = await GuestService.countDocuments({
        hotelId,
        status: { $in: ['pending', 'assigned', 'in_progress'] }
      });

      const roomsNeedingAttention = await Room.countDocuments({
        hotelId,
        status: { $in: ['dirty', 'maintenance', 'out_of_order'] }
      });

      return {
        pendingMaintenance,
        pendingServices,
        roomsNeedingAttention,
        totalIssues: pendingMaintenance + pendingServices + roomsNeedingAttention
      };

    } catch (error) {
      console.error('Error generating end-of-day summary:', error);
      return {
        pendingMaintenance: 0,
        pendingServices: 0,
        roomsNeedingAttention: 0,
        totalIssues: 0
      };
    }
  }

  /**
   * Check for rooms due for deep cleaning
   */
  static async checkDeepCleaningSchedule() {
    try {
      console.log('🧽 Checking deep cleaning schedule...');

      const Room = mongoose.model('Room');
      const Housekeeping = mongoose.model('Housekeeping');
      const Hotel = mongoose.model('Hotel');

      // Get all active hotels
      const hotels = await Hotel.find({ isActive: true }).select('_id');

      for (const hotel of hotels) {
        // Define deep cleaning frequency (30 days default)
        const deepCleaningInterval = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
        const deepCleaningDueDate = new Date(Date.now() - deepCleaningInterval);

        // Find rooms that haven't had deep cleaning in the last 30 days
        const roomsDueForDeepCleaning = await Room.find({
          hotelId: hotel._id,
          isActive: true,
          $or: [
            { lastCleaned: { $lt: deepCleaningDueDate } },
            { lastCleaned: { $exists: false } } // Never been cleaned
          ]
        }).select('_id roomNumber');

        console.log(`🏨 Hotel ${hotel._id}: ${roomsDueForDeepCleaning.length} rooms due for deep cleaning`);

        for (const room of roomsDueForDeepCleaning) {
          // Check if there's already a pending deep cleaning task
          const existingDeepCleaningTask = await Housekeeping.findOne({
            hotelId: hotel._id,
            roomId: room._id,
            taskType: 'deep_clean',
            status: { $in: ['pending', 'assigned', 'in_progress'] }
          });

          // Only create notification if no pending deep cleaning task exists
          if (!existingDeepCleaningTask) {
            await NotificationAutomationService.triggerNotification(
              'deep_cleaning_due',
              {
                roomNumber: room.roomNumber,
                roomId: room._id,
                daysSinceLastCleaning: Math.floor((Date.now() - (room.lastCleaned || new Date(0))) / (24 * 60 * 60 * 1000)),
                recommendedAction: 'Schedule deep cleaning task'
              },
              'auto',
              'medium',
              hotel._id
            );

            console.log(`🧽 Deep cleaning due notification sent for Room ${room.roomNumber}`);
          }
        }
      }

    } catch (error) {
      console.error('❌ Error checking deep cleaning schedule:', error);
    }
  }

  /**
   * Process scheduled notifications that are due
   */
  static async processScheduledNotifications() {
    try {
      const Notification = mongoose.model('Notification');

      // Find notifications scheduled for now or in the past
      const dueNotifications = await Notification.find({
        status: 'pending',
        scheduledFor: { $lte: new Date() }
      });

      console.log(`📬 Processing ${dueNotifications.length} scheduled notifications`);

      for (const notification of dueNotifications) {
        try {
          // Mark as sent and update timestamp
          notification.status = 'sent';
          notification.sentAt = new Date();
          await notification.save();

          // Here you would integrate with your real-time notification system
          console.log(`📤 Sent scheduled notification: ${notification.title}`);

        } catch (error) {
          console.error('Error processing scheduled notification:', error);
        }
      }

    } catch (error) {
      console.error('❌ Error processing scheduled notifications:', error);
    }
  }

  // Phase 6: Operational Intelligence Notifications Methods

  /**
   * Check staff performance and send alerts for underperforming staff
   */
  static async checkStaffPerformance() {
    try {
      console.log('📊 Checking staff performance metrics...');

      const Hotel = mongoose.model('Hotel');
      const User = mongoose.model('User');
      const DailyRoutineCheck = mongoose.model('DailyRoutineCheck');
      const UserAnalytics = mongoose.model('UserAnalytics');

      const hotels = await Hotel.find({ isActive: true }).select('_id name');

      for (const hotel of hotels) {
        // Get staff members for this hotel
        const staffMembers = await User.find({
          hotelId: hotel._id,
          role: { $in: ['staff', 'housekeeping', 'maintenance'] },
          isActive: true
        });

        const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

        for (const staff of staffMembers) {
          // Get task completion metrics
          const assignedTasks = await DailyRoutineCheck.countDocuments({
            checkedBy: staff._id,
            createdAt: { $gte: last24Hours }
          });

          const completedTasks = await DailyRoutineCheck.countDocuments({
            checkedBy: staff._id,
            status: 'completed',
            createdAt: { $gte: last24Hours }
          });

          // Get user analytics if available
          const analytics = await UserAnalytics.findOne({
            userId: staff._id,
            date: { $gte: last24Hours }
          });

          const completionRate = assignedTasks > 0 ? (completedTasks / assignedTasks) * 100 : 100;
          const efficiencyScore = analytics?.performanceMetrics?.efficiencyScore || 75;

          // Trigger alerts for poor performance
          if (assignedTasks > 0 && (completionRate < 70 || efficiencyScore < 60)) {
            const priority = completionRate < 50 ? 'high' : 'medium';

            await NotificationAutomationService.triggerNotification(
              'staff_performance_alert',
              {
                staffName: `${staff.firstName} ${staff.lastName}`,
                staffId: staff._id,
                completionRate: Math.round(completionRate),
                efficiencyScore: Math.round(efficiencyScore),
                assignedTasks,
                completedTasks,
                metric: completionRate < 70 ? 'Low task completion rate' : 'Low efficiency score',
                timeFrame: '24 hours',
                recommendations: this.generatePerformanceRecommendations(completionRate, efficiencyScore)
              },
              'auto',
              priority,
              hotel._id
            );
          }
        }
      }

    } catch (error) {
      console.error('❌ Error checking staff performance:', error);
    }
  }

  /**
   * Check revenue impact from out-of-order rooms and operational issues
   */
  static async checkRevenueImpact() {
    try {
      console.log('💰 Checking revenue impact...');

      const Hotel = mongoose.model('Hotel');
      const Room = mongoose.model('Room');
      const RoomType = mongoose.model('RoomType');
      const MaintenanceRequest = mongoose.model('MaintenanceRequest');

      const hotels = await Hotel.find({ isActive: true }).select('_id name');

      for (const hotel of hotels) {
        // Get out-of-order rooms
        const outOfOrderRooms = await Room.find({
          hotelId: hotel._id,
          status: 'out_of_order'
        }).populate('roomTypeId', 'basePrice name');

        if (outOfOrderRooms.length > 0) {
          // Calculate potential revenue loss
          let totalDailyRevenueLoss = 0;
          let roomDetails = [];

          for (const room of outOfOrderRooms) {
            const dailyRate = room.roomTypeId?.basePrice || 100;
            totalDailyRevenueLoss += dailyRate;

            roomDetails.push({
              roomNumber: room.roomNumber,
              roomType: room.roomTypeId?.name || 'Standard',
              dailyRate,
              daysOutOfOrder: room.outOfOrderSince ?
                Math.floor((new Date() - new Date(room.outOfOrderSince)) / (1000 * 60 * 60 * 24)) : 1
            });
          }

          // Get related maintenance requests
          const maintenanceRequests = await MaintenanceRequest.countDocuments({
            hotelId: hotel._id,
            status: { $in: ['pending', 'in_progress'] },
            priority: { $in: ['high', 'urgent'] }
          });

          // Send alert if revenue impact is significant
          const priority = totalDailyRevenueLoss > 500 ? 'urgent' :
                          totalDailyRevenueLoss > 200 ? 'high' : 'medium';

          await NotificationAutomationService.triggerNotification(
            'revenue_impact_alert',
            {
              hotelName: hotel.name,
              outOfOrderRooms: outOfOrderRooms.length,
              dailyRevenueLoss: Math.round(totalDailyRevenueLoss),
              roomDetails,
              maintenanceRequests,
              totalRooms: await Room.countDocuments({ hotelId: hotel._id }),
              impactPercentage: Math.round((outOfOrderRooms.length / await Room.countDocuments({ hotelId: hotel._id })) * 100),
              urgentMaintenance: maintenanceRequests,
              estimatedWeeklyLoss: Math.round(totalDailyRevenueLoss * 7)
            },
            'auto',
            priority,
            hotel._id
          );
        }
      }

    } catch (error) {
      console.error('❌ Error checking revenue impact:', error);
    }
  }

  /**
   * Check guest satisfaction scores and send alerts for low ratings
   */
  static async checkGuestSatisfaction() {
    try {
      console.log('⭐ Checking guest satisfaction scores...');

      const Hotel = mongoose.model('Hotel');
      const Review = mongoose.model('Review');
      const Room = mongoose.model('Room');

      const hotels = await Hotel.find({ isActive: true }).select('_id name');

      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

      for (const hotel of hotels) {
        // Get recent low-rating reviews
        const lowRatingReviews = await Review.find({
          hotelId: hotel._id,
          rating: { $lte: 2 }, // 2 stars or less
          createdAt: { $gte: last24Hours }
        }).populate('userId', 'firstName lastName email').populate('bookingId', 'roomId');

        for (const review of lowRatingReviews) {
          let roomNumber = 'Unknown';
          if (review.bookingId?.roomId) {
            const room = await Room.findById(review.bookingId.roomId).select('roomNumber');
            roomNumber = room?.roomNumber || 'Unknown';
          }

          await NotificationAutomationService.triggerNotification(
            'guest_satisfaction_low',
            {
              guestName: `${review.userId?.firstName || ''} ${review.userId?.lastName || ''}`.trim() || 'Anonymous',
              guestEmail: review.userId?.email,
              roomNumber,
              rating: review.rating,
              reviewTitle: review.title,
              reviewContent: review.content,
              reviewId: review._id,
              categories: review.categories,
              issueAreas: this.identifyIssueAreas(review),
              urgency: review.rating === 1 ? 'Critical' : 'High',
              responseRequired: true
            },
            'auto',
            review.rating === 1 ? 'urgent' : 'high',
            hotel._id
          );
        }

        // Calculate overall satisfaction trends
        const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentReviews = await Review.find({
          hotelId: hotel._id,
          createdAt: { $gte: last7Days }
        });

        if (recentReviews.length >= 5) { // Only analyze if we have enough data
          const averageRating = recentReviews.reduce((sum, review) => sum + review.rating, 0) / recentReviews.length;

          if (averageRating < 3.5) {
            await NotificationAutomationService.triggerNotification(
              'guest_satisfaction_trend_low',
              {
                averageRating: Math.round(averageRating * 10) / 10,
                totalReviews: recentReviews.length,
                lowRatingCount: recentReviews.filter(r => r.rating <= 2).length,
                timeFrame: '7 days',
                trend: 'declining',
                actionRequired: 'Immediate attention needed for guest satisfaction'
              },
              'auto',
              'high',
              hotel._id
            );
          }
        }
      }

    } catch (error) {
      console.error('❌ Error checking guest satisfaction:', error);
    }
  }

  /**
   * Check equipment failure patterns from maintenance requests
   */
  static async checkEquipmentFailurePatterns() {
    try {
      console.log('🔧 Checking equipment failure patterns...');

      const Hotel = mongoose.model('Hotel');
      const MaintenanceRequest = mongoose.model('MaintenanceRequest');

      const hotels = await Hotel.find({ isActive: true }).select('_id name');

      const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      for (const hotel of hotels) {
        // Aggregate maintenance requests by equipment type
        const failurePatterns = await MaintenanceRequest.aggregate([
          {
            $match: {
              hotelId: hotel._id,
              createdAt: { $gte: last30Days },
              issueType: { $exists: true }
            }
          },
          {
            $group: {
              _id: '$issueType',
              count: { $sum: 1 },
              avgCost: { $avg: '$estimatedCost' },
              urgentCount: {
                $sum: { $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0] }
              },
              recentRequests: { $push: '$_id' }
            }
          },
          {
            $match: {
              count: { $gte: 3 } // At least 3 failures of the same type
            }
          },
          { $sort: { count: -1 } }
        ]);

        for (const pattern of failurePatterns) {
          const failureRate = (pattern.count / 30) * 100; // Failures per day as percentage
          const priority = pattern.urgentCount >= 2 ? 'urgent' :
                          pattern.count >= 5 ? 'high' : 'medium';

          await NotificationAutomationService.triggerNotification(
            'equipment_failure_pattern',
            {
              equipmentType: pattern._id,
              failureCount: pattern.count,
              timeFrame: '30 days',
              failureRate: Math.round(failureRate * 100) / 100,
              avgCost: Math.round(pattern.avgCost || 0),
              urgentFailures: pattern.urgentCount,
              totalCost: Math.round((pattern.avgCost || 0) * pattern.count),
              pattern: pattern.count >= 5 ? 'Critical pattern detected' : 'Concerning pattern detected',
              recommendation: this.generateMaintenanceRecommendation(pattern),
              preventiveMaintenance: pattern.count >= 4
            },
            'auto',
            priority,
            hotel._id
          );
        }
      }

    } catch (error) {
      console.error('❌ Error checking equipment failure patterns:', error);
    }
  }

  // Helper methods for operational intelligence

  /**
   * Generate performance improvement recommendations
   */
  static generatePerformanceRecommendations(completionRate, efficiencyScore) {
    const recommendations = [];

    if (completionRate < 70) {
      recommendations.push('Schedule one-on-one training session');
      recommendations.push('Review task prioritization methods');
    }

    if (efficiencyScore < 60) {
      recommendations.push('Provide additional tools or resources');
      recommendations.push('Consider workload redistribution');
    }

    recommendations.push('Monitor progress for next 48 hours');

    return recommendations;
  }

  /**
   * Identify issue areas from review categories
   */
  static identifyIssueAreas(review) {
    const issues = [];

    if (review.categories) {
      Object.entries(review.categories).forEach(([category, rating]) => {
        if (rating <= 2) {
          issues.push(category);
        }
      });
    }

    return issues.length > 0 ? issues : ['General satisfaction'];
  }

  /**
   * Generate maintenance recommendations based on failure patterns
   */
  static generateMaintenanceRecommendation(pattern) {
    if (pattern.count >= 5) {
      return `Consider replacing ${pattern._id} equipment - high failure rate indicates end of life`;
    } else if (pattern.urgentCount >= 2) {
      return `Schedule immediate inspection of all ${pattern._id} equipment`;
    } else {
      return `Implement preventive maintenance schedule for ${pattern._id} equipment`;
    }
  }

  /**
   * Stop all scheduled jobs (useful for testing)
   */
  static stopScheduledJobs() {
    cron.getTasks().forEach((task, name) => {
      task.stop();
      console.log(`🛑 Stopped scheduled job: ${name}`);
    });

    this.isInitialized = false;
    console.log('🛑 All notification scheduler jobs stopped');
  }

  /**
   * Get status of all scheduled jobs
   */
  static getSchedulerStatus() {
    const tasks = cron.getTasks();
    const status = {
      isInitialized: this.isInitialized,
      activeJobs: tasks.size,
      jobs: []
    };

    tasks.forEach((task, name) => {
      status.jobs.push({
        name,
        running: task.running,
        scheduled: !!task.scheduled
      });
    });

    return status;
  }
}

export default NotificationScheduler;