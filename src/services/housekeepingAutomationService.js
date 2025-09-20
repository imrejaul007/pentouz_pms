import logger from '../utils/logger.js';
import Housekeeping from '../models/Housekeeping.js';
import Room from '../models/Room.js';
import User from '../models/User.js';
import Booking from '../models/Booking.js';
import RoomInventory from '../models/RoomInventory.js';

/**
 * Housekeeping Automation Service
 * 
 * Handles automatic creation and management of housekeeping tasks
 * during checkout processing. This service creates appropriate tasks
 * based on room condition, guest stay duration, and special requirements.
 */
class HousekeepingAutomationService {
  constructor() {
    this.taskTypes = {
      checkout_clean: {
        baseDuration: 30,
        priority: 'high',
        description: 'Standard checkout cleaning'
      },
      deep_clean: {
        baseDuration: 60,
        priority: 'high',
        description: 'Deep cleaning for long stays or special conditions'
      },
      maintenance: {
        baseDuration: 45,
        priority: 'medium',
        description: 'Maintenance tasks identified during checkout'
      },
      inspection: {
        baseDuration: 15,
        priority: 'medium',
        description: 'Post-cleaning inspection'
      },
      setup: {
        baseDuration: 20,
        priority: 'medium',
        description: 'Room setup for next guest'
      }
    };

    this.cleaningSupplies = {
      standard: [
        { name: 'All-purpose cleaner', quantity: 1, unit: 'bottle' },
        { name: 'Disinfectant', quantity: 1, unit: 'bottle' },
        { name: 'Glass cleaner', quantity: 1, unit: 'bottle' },
        { name: 'Microfiber cloths', quantity: 5, unit: 'pieces' },
        { name: 'Vacuum cleaner', quantity: 1, unit: 'unit' },
        { name: 'Mop and bucket', quantity: 1, unit: 'set' }
      ],
      deep: [
        { name: 'All-purpose cleaner', quantity: 2, unit: 'bottles' },
        { name: 'Disinfectant', quantity: 2, unit: 'bottles' },
        { name: 'Glass cleaner', quantity: 1, unit: 'bottle' },
        { name: 'Carpet cleaner', quantity: 1, unit: 'bottle' },
        { name: 'Microfiber cloths', quantity: 10, unit: 'pieces' },
        { name: 'Vacuum cleaner', quantity: 1, unit: 'unit' },
        { name: 'Steam cleaner', quantity: 1, unit: 'unit' },
        { name: 'Mop and bucket', quantity: 1, unit: 'set' },
        { name: 'Scrub brushes', quantity: 3, unit: 'pieces' }
      ],
      maintenance: [
        { name: 'Tool kit', quantity: 1, unit: 'set' },
        { name: 'Replacement parts', quantity: 1, unit: 'as needed' },
        { name: 'Cleaning supplies', quantity: 1, unit: 'set' }
      ]
    };
  }

  /**
   * Process comprehensive housekeeping automation for checkout
   * @param {string} bookingId - Booking ID
   * @param {string} roomId - Room ID
   * @param {string} processedBy - User ID who processed
   * @param {Object} options - Processing options
   */
  async processCheckoutHousekeeping(bookingId, roomId, processedBy, options = {}) {
    try {
      logger.info('Starting housekeeping automation', {
        bookingId,
        roomId,
        processedBy
      });

      const results = {
        bookingId,
        roomId,
        processedBy,
        timestamp: new Date(),
        tasks: []
      };

      // Get booking and room details
      const booking = await Booking.findById(bookingId).populate('rooms.roomId');
      const room = await Room.findById(roomId);
      const roomInventory = await RoomInventory.findOne({ roomId });

      if (!booking || !room) {
        throw new Error('Booking or room not found');
      }

      // Step 1: Determine required task types
      const requiredTasks = await this.determineRequiredTasks(
        booking,
        room,
        roomInventory,
        options
      );
      results.steps = [{ step: 'task_determination', success: true, data: requiredTasks }];

      // Step 2: Create housekeeping tasks
      for (const taskType of requiredTasks) {
        try {
          const task = await this.createHousekeepingTask(
            roomId,
            taskType,
            booking,
            room,
            roomInventory,
            processedBy,
            options
          );
          results.tasks.push(task);
        } catch (error) {
          logger.error('Failed to create housekeeping task', {
            taskType,
            roomId,
            error: error.message
          });
          results.tasks.push({
            taskType,
            success: false,
            error: error.message
          });
        }
      }

      // Step 3: Auto-assign tasks if enabled
      if (options.autoAssignTasks !== false) {
        const assignmentResults = await this.autoAssignTasks(results.tasks, options);
        results.steps.push({ step: 'task_assignment', success: true, data: assignmentResults });
      }

      // Step 4: Generate task schedule
      const schedule = await this.generateTaskSchedule(results.tasks, options);
      results.steps.push({ step: 'schedule_generation', success: true, data: schedule });

      results.success = results.tasks.every(task => task.success);
      results.summary = this.generateHousekeepingSummary(results.tasks);

      logger.info('Housekeeping automation completed', {
        bookingId,
        roomId,
        tasksCreated: results.tasks.filter(t => t.success).length,
        summary: results.summary
      });

      return results;

    } catch (error) {
      logger.error('Housekeeping automation failed', {
        bookingId,
        roomId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Determine required housekeeping tasks based on booking and room conditions
   * @param {Object} booking - Booking object
   * @param {Object} room - Room object
   * @param {Object} roomInventory - Room inventory object
   * @param {Object} options - Processing options
   */
  async determineRequiredTasks(booking, room, roomInventory, options = {}) {
    const tasks = [];
    const stayLength = this.calculateStayLength(booking);
    const roomCondition = this.assessRoomCondition(roomInventory, options);

    // Always create checkout cleaning task
    tasks.push({
      type: 'checkout_clean',
      priority: 'high',
      estimatedDuration: this.taskTypes.checkout_clean.baseDuration,
      required: true
    });

    // Determine if deep cleaning is needed
    if (this.needsDeepCleaning(stayLength, roomCondition, booking, options)) {
      tasks.push({
        type: 'deep_clean',
        priority: 'high',
        estimatedDuration: this.taskTypes.deep_clean.baseDuration,
        required: true
      });
    }

    // Check if maintenance is needed
    if (this.needsMaintenance(roomInventory, options)) {
      tasks.push({
        type: 'maintenance',
        priority: 'medium',
        estimatedDuration: this.taskTypes.maintenance.baseDuration,
        required: true
      });
    }

    // Always create inspection task
    tasks.push({
      type: 'inspection',
      priority: 'medium',
      estimatedDuration: this.taskTypes.inspection.baseDuration,
      required: true
    });

    // Create setup task if room will be occupied soon
    if (this.needsSetup(booking, options)) {
      tasks.push({
        type: 'setup',
        priority: 'medium',
        estimatedDuration: this.taskTypes.setup.baseDuration,
        required: false
      });
    }

    return tasks;
  }

  /**
   * Calculate stay length in days
   * @param {Object} booking - Booking object
   */
  calculateStayLength(booking) {
    const checkIn = new Date(booking.checkIn);
    const checkOut = new Date(booking.checkOut);
    return Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
  }

  /**
   * Assess room condition based on inventory
   * @param {Object} roomInventory - Room inventory object
   * @param {Object} options - Processing options
   */
  assessRoomCondition(roomInventory, options = {}) {
    if (!roomInventory) {
      return 'unknown';
    }

    const conditionScore = roomInventory.conditionScore || 0;
    
    if (conditionScore >= 90) {
      return 'excellent';
    } else if (conditionScore >= 70) {
      return 'good';
    } else if (conditionScore >= 50) {
      return 'fair';
    } else if (conditionScore >= 30) {
      return 'poor';
    } else {
      return 'very_poor';
    }
  }

  /**
   * Determine if deep cleaning is needed
   * @param {number} stayLength - Length of stay in days
   * @param {string} roomCondition - Room condition assessment
   * @param {Object} booking - Booking object
   * @param {Object} options - Processing options
   */
  needsDeepCleaning(stayLength, roomCondition, booking, options = {}) {
    // Deep cleaning needed for long stays
    if (stayLength >= 7) {
      return true;
    }

    // Deep cleaning needed for poor room condition
    if (roomCondition === 'poor' || roomCondition === 'very_poor') {
      return true;
    }

    // Deep cleaning needed for special requests
    if (booking.guestDetails?.specialRequests) {
      const requests = booking.guestDetails.specialRequests.toLowerCase();
      if (requests.includes('allergy') || requests.includes('sensitive') || requests.includes('deep clean')) {
        return true;
      }
    }

    // Deep cleaning needed for smoking rooms
    if (options.roomWasSmoking || options.requiresDeepClean) {
      return true;
    }

    return false;
  }

  /**
   * Determine if maintenance is needed
   * @param {Object} roomInventory - Room inventory object
   * @param {Object} options - Processing options
   */
  needsMaintenance(roomInventory, options = {}) {
    if (!roomInventory) {
      return false;
    }

    // Maintenance needed if room inventory indicates issues
    if (roomInventory.maintenanceRequired) {
      return true;
    }

    // Maintenance needed if items are damaged
    const damagedItems = roomInventory.items?.filter(item => 
      item.condition === 'damaged' || item.needsReplacement
    );
    
    if (damagedItems && damagedItems.length > 0) {
      return true;
    }

    // Maintenance needed if explicitly requested
    if (options.requiresMaintenance) {
      return true;
    }

    return false;
  }

  /**
   * Determine if room setup is needed
   * @param {Object} booking - Booking object
   * @param {Object} options - Processing options
   */
  needsSetup(booking, options = {}) {
    // Setup needed if there's a next booking soon
    if (options.nextBookingDate) {
      const nextBooking = new Date(options.nextBookingDate);
      const now = new Date();
      const hoursUntilNext = (nextBooking - now) / (1000 * 60 * 60);
      
      if (hoursUntilNext <= 24) {
        return true;
      }
    }

    // Setup needed if explicitly requested
    if (options.requiresSetup) {
      return true;
    }

    return false;
  }

  /**
   * Create a housekeeping task
   * @param {string} roomId - Room ID
   * @param {Object} taskType - Task type configuration
   * @param {Object} booking - Booking object
   * @param {Object} room - Room object
   * @param {Object} roomInventory - Room inventory object
   * @param {string} processedBy - User ID
   * @param {Object} options - Processing options
   */
  async createHousekeepingTask(roomId, taskType, booking, room, roomInventory, processedBy, options = {}) {
    try {
      const task = new Housekeeping({
        hotelId: booking.hotelId,
        roomId,
        taskType: taskType.type,
        type: taskType.type, // For backward compatibility
        title: this.generateTaskTitle(taskType.type, room, booking),
        description: this.generateTaskDescription(taskType.type, booking, roomInventory, options),
        priority: taskType.priority,
        status: 'pending',
        estimatedDuration: taskType.estimatedDuration,
        supplies: this.getRequiredSupplies(taskType.type, options),
        notes: this.generateTaskNotes(taskType.type, booking, options),
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        roomStatus: this.determineInitialRoomStatus(taskType.type)
      });

      await task.save();

      logger.info('Housekeeping task created', {
        taskId: task._id,
        taskType: taskType.type,
        roomId,
        priority: taskType.priority,
        estimatedDuration: taskType.estimatedDuration
      });

      return {
        taskId: task._id,
        taskType: taskType.type,
        success: true,
        priority: taskType.priority,
        estimatedDuration: taskType.estimatedDuration,
        status: 'pending'
      };

    } catch (error) {
      logger.error('Failed to create housekeeping task', {
        taskType: taskType.type,
        roomId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate task title based on type and context
   * @param {string} taskType - Task type
   * @param {Object} room - Room object
   * @param {Object} booking - Booking object
   */
  generateTaskTitle(taskType, room, booking) {
    const roomInfo = `Room ${room.roomNumber}`;
    const bookingInfo = `(Booking ${booking.bookingNumber})`;

    switch (taskType) {
      case 'checkout_clean':
        return `Checkout Cleaning - ${roomInfo} ${bookingInfo}`;
      case 'deep_clean':
        return `Deep Cleaning - ${roomInfo} ${bookingInfo}`;
      case 'maintenance':
        return `Maintenance - ${roomInfo} ${bookingInfo}`;
      case 'inspection':
        return `Post-Cleaning Inspection - ${roomInfo} ${bookingInfo}`;
      case 'setup':
        return `Room Setup - ${roomInfo} ${bookingInfo}`;
      default:
        return `${taskType.charAt(0).toUpperCase() + taskType.slice(1)} - ${roomInfo} ${bookingInfo}`;
    }
  }

  /**
   * Generate task description based on type and context
   * @param {string} taskType - Task type
   * @param {Object} booking - Booking object
   * @param {Object} roomInventory - Room inventory object
   * @param {Object} options - Processing options
   */
  generateTaskDescription(taskType, booking, roomInventory, options = {}) {
    const stayLength = this.calculateStayLength(booking);
    const guestCount = booking.guestDetails?.adults + booking.guestDetails?.children || 1;

    let description = this.taskTypes[taskType]?.description || 'Housekeeping task';

    switch (taskType) {
      case 'checkout_clean':
        description += ` for ${stayLength}-day stay with ${guestCount} guest(s).`;
        if (booking.guestDetails?.specialRequests) {
          description += ` Special requests: ${booking.guestDetails.specialRequests}`;
        }
        break;

      case 'deep_clean':
        description += ` required due to ${stayLength}-day stay.`;
        if (options.roomWasSmoking) {
          description += ' Room requires smoke odor removal.';
        }
        if (booking.guestDetails?.specialRequests?.toLowerCase().includes('allergy')) {
          description += ' Guest has allergies - use hypoallergenic products.';
        }
        break;

      case 'maintenance':
        description += ' required based on room inventory assessment.';
        if (roomInventory?.maintenanceNotes) {
          description += ` Notes: ${roomInventory.maintenanceNotes}`;
        }
        break;

      case 'inspection':
        description += ' to verify cleaning quality and room readiness.';
        break;

      case 'setup':
        description += ' for next guest arrival.';
        break;
    }

    return description;
  }

  /**
   * Get required supplies for task type
   * @param {string} taskType - Task type
   * @param {Object} options - Processing options
   */
  getRequiredSupplies(taskType, options = {}) {
    switch (taskType) {
      case 'checkout_clean':
        return this.cleaningSupplies.standard;
      case 'deep_clean':
        return this.cleaningSupplies.deep;
      case 'maintenance':
        return this.cleaningSupplies.maintenance;
      case 'inspection':
        return [{ name: 'Inspection checklist', quantity: 1, unit: 'piece' }];
      case 'setup':
        return this.cleaningSupplies.standard;
      default:
        return this.cleaningSupplies.standard;
    }
  }

  /**
   * Generate task notes based on context
   * @param {string} taskType - Task type
   * @param {Object} booking - Booking object
   * @param {Object} options - Processing options
   */
  generateTaskNotes(taskType, booking, options = {}) {
    const notes = [];

    // Add guest information
    if (booking.guestDetails?.specialRequests) {
      notes.push(`Guest requests: ${booking.guestDetails.specialRequests}`);
    }

    // Add stay information
    const stayLength = this.calculateStayLength(booking);
    notes.push(`Stay duration: ${stayLength} day(s)`);

    // Add special conditions
    if (options.roomWasSmoking) {
      notes.push('Room was used for smoking - requires special cleaning');
    }

    if (options.requiresDeepClean) {
      notes.push('Deep cleaning specifically requested');
    }

    if (options.requiresMaintenance) {
      notes.push('Maintenance issues identified during checkout');
    }

    // Add timing information
    if (options.nextBookingDate) {
      const nextBooking = new Date(options.nextBookingDate);
      const hoursUntilNext = (nextBooking - new Date()) / (1000 * 60 * 60);
      notes.push(`Next guest arrives in ${Math.round(hoursUntilNext)} hours`);
    }

    return notes.join('; ');
  }

  /**
   * Determine initial room status based on task type
   * @param {string} taskType - Task type
   */
  determineInitialRoomStatus(taskType) {
    switch (taskType) {
      case 'checkout_clean':
      case 'deep_clean':
        return 'dirty';
      case 'maintenance':
        return 'maintenance_required';
      case 'inspection':
        return 'clean';
      case 'setup':
        return 'clean';
      default:
        return 'dirty';
    }
  }

  /**
   * Auto-assign tasks to available staff
   * @param {Array} tasks - Created tasks
   * @param {Object} options - Processing options
   */
  async autoAssignTasks(tasks, options = {}) {
    try {
      if (!options.autoAssignTasks) {
        return { assigned: 0, skipped: 0, reason: 'Auto-assignment disabled' };
      }

      // Get available housekeeping staff
      const availableStaff = await this.getAvailableHousekeepingStaff(options.hotelId);
      
      if (availableStaff.length === 0) {
        return { assigned: 0, skipped: tasks.length, reason: 'No available staff' };
      }

      let assignedCount = 0;
      let staffIndex = 0;

      for (const task of tasks) {
        if (task.success && task.taskId) {
          try {
            const staff = availableStaff[staffIndex % availableStaff.length];
            await this.assignTaskToStaff(task.taskId, staff._id);
            task.assignedTo = staff._id;
            task.assignedToName = staff.name;
            assignedCount++;
            staffIndex++;
          } catch (error) {
            logger.error('Failed to assign task to staff', {
              taskId: task.taskId,
              error: error.message
            });
          }
        }
      }

      return {
        assigned: assignedCount,
        skipped: tasks.length - assignedCount,
        availableStaff: availableStaff.length
      };

    } catch (error) {
      logger.error('Auto-assignment failed', {
        error: error.message
      });
      return { assigned: 0, skipped: tasks.length, reason: 'Assignment failed' };
    }
  }

  /**
   * Get available housekeeping staff
   * @param {string} hotelId - Hotel ID
   */
  async getAvailableHousekeepingStaff(hotelId) {
    try {
      const staff = await User.find({
        hotelId,
        role: { $in: ['housekeeping', 'staff'] },
        isActive: true
      }).select('_id name email role');

      // For now, return all active staff
      // In a more sophisticated system, this would check current workload
      return staff;

    } catch (error) {
      logger.error('Failed to get available staff', {
        hotelId,
        error: error.message
      });
      return [];
    }
  }

  /**
   * Assign task to specific staff member
   * @param {string} taskId - Task ID
   * @param {string} staffId - Staff member ID
   */
  async assignTaskToStaff(taskId, staffId) {
    try {
      const task = await Housekeeping.findById(taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      task.assignedTo = staffId;
      task.assignedToUserId = staffId; // For backward compatibility
      task.status = 'assigned';
      await task.save();

      logger.info('Task assigned to staff', {
        taskId,
        staffId
      });

    } catch (error) {
      logger.error('Failed to assign task to staff', {
        taskId,
        staffId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate task schedule
   * @param {Array} tasks - Created tasks
   * @param {Object} options - Processing options
   */
  async generateTaskSchedule(tasks, options = {}) {
    try {
      const schedule = {
        totalTasks: tasks.length,
        estimatedTotalDuration: 0,
        taskSequence: [],
        dependencies: [],
        estimatedCompletionTime: null
      };

      let currentTime = new Date();
      let totalDuration = 0;

      // Sort tasks by priority and dependencies
      const sortedTasks = this.sortTasksByPriority(tasks);

      for (const task of sortedTasks) {
        if (task.success) {
          const taskSchedule = {
            taskId: task.taskId,
            taskType: task.taskType,
            priority: task.priority,
            estimatedDuration: task.estimatedDuration,
            scheduledStartTime: new Date(currentTime),
            estimatedEndTime: new Date(currentTime.getTime() + task.estimatedDuration * 60 * 1000)
          };

          schedule.taskSequence.push(taskSchedule);
          totalDuration += task.estimatedDuration;
          
          // Update current time for next task
          currentTime = new Date(currentTime.getTime() + task.estimatedDuration * 60 * 1000);
        }
      }

      schedule.estimatedTotalDuration = totalDuration;
      schedule.estimatedCompletionTime = new Date(Date.now() + totalDuration * 60 * 1000);

      return schedule;

    } catch (error) {
      logger.error('Failed to generate task schedule', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Sort tasks by priority and dependencies
   * @param {Array} tasks - Tasks to sort
   */
  sortTasksByPriority(tasks) {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    const typeOrder = { maintenance: 0, deep_clean: 1, checkout_clean: 2, inspection: 3, setup: 4 };

    return tasks.sort((a, b) => {
      // First sort by priority
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Then sort by task type
      return typeOrder[a.taskType] - typeOrder[b.taskType];
    });
  }

  /**
   * Generate summary of housekeeping automation results
   * @param {Array} tasks - Created tasks
   */
  generateHousekeepingSummary(tasks) {
    const successfulTasks = tasks.filter(task => task.success);
    const failedTasks = tasks.filter(task => !task.success);

    const summary = {
      totalTasks: tasks.length,
      successfulTasks: successfulTasks.length,
      failedTasks: failedTasks.length,
      successRate: tasks.length > 0 ? (successfulTasks.length / tasks.length) * 100 : 0,
      totalEstimatedDuration: successfulTasks.reduce((sum, task) => sum + (task.estimatedDuration || 0), 0),
      tasksByType: {},
      tasksByPriority: {},
      assignedTasks: successfulTasks.filter(task => task.assignedTo).length
    };

    // Group by task type
    successfulTasks.forEach(task => {
      if (!summary.tasksByType[task.taskType]) {
        summary.tasksByType[task.taskType] = 0;
      }
      summary.tasksByType[task.taskType]++;
    });

    // Group by priority
    successfulTasks.forEach(task => {
      if (!summary.tasksByPriority[task.priority]) {
        summary.tasksByPriority[task.priority] = 0;
      }
      summary.tasksByPriority[task.priority]++;
    });

    return summary;
  }

  /**
   * Get housekeeping automation statistics for a hotel
   * @param {string} hotelId - Hotel ID
   * @param {Object} dateRange - Date range for statistics
   */
  async getHousekeepingStatistics(hotelId, dateRange = {}) {
    try {
      const startDate = dateRange.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = dateRange.endDate || new Date();

      const stats = await Housekeeping.aggregate([
        {
          $match: {
            hotelId: new mongoose.Types.ObjectId(hotelId),
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: null,
            totalTasks: { $sum: 1 },
            completedTasks: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            averageDuration: { $avg: '$actualDuration' },
            tasksByType: {
              $push: {
                type: '$taskType',
                duration: '$actualDuration',
                status: '$status'
              }
            }
          }
        }
      ]);

      const typeStats = await Housekeeping.aggregate([
        {
          $match: {
            hotelId: new mongoose.Types.ObjectId(hotelId),
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$taskType',
            count: { $sum: 1 },
            averageDuration: { $avg: '$actualDuration' },
            completedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            }
          }
        }
      ]);

      return {
        overall: stats[0] || {
          totalTasks: 0,
          completedTasks: 0,
          averageDuration: 0
        },
        byType: typeStats,
        dateRange: { startDate, endDate }
      };

    } catch (error) {
      logger.error('Failed to get housekeeping statistics', {
        hotelId,
        error: error.message
      });
      throw error;
    }
  }
}

export default new HousekeepingAutomationService();
