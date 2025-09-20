import logger from '../utils/logger.js';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import CheckoutAutomationConfig from '../models/CheckoutAutomationConfig.js';
import CheckoutAutomationLog from '../models/CheckoutAutomationLog.js';

/**
 * Checkout Automation Service
 * 
 * Handles automatic processing of laundry, inventory, and housekeeping
 * when guests check out. This service coordinates between different
 * systems to ensure smooth automated checkout processing.
 */
class CheckoutAutomationService {
  constructor() {
    this.isProcessing = new Set(); // Track bookings currently being processed
  }

  /**
   * Main entry point for checkout automation
   * @param {string} bookingId - Booking ID to process
   * @param {Object} context - Processing context
   * @param {string} context.processedBy - User ID who triggered the automation
   * @param {boolean} context.forceProcessing - Force processing even if already processed
   */
  async processCheckout(bookingId, context = {}) {
    const { processedBy, forceProcessing = false } = context;
    
    // Prevent duplicate processing
    if (this.isProcessing.has(bookingId) && !forceProcessing) {
      logger.warn('Checkout automation already in progress', { bookingId });
      return { success: false, message: 'Automation already in progress' };
    }

    this.isProcessing.add(bookingId);
    
    try {
      logger.info('Starting checkout automation', { bookingId, processedBy });
      
      // Get booking details
      const booking = await Booking.findById(bookingId).populate('rooms.roomId');
      if (!booking) {
        throw new Error('Booking not found');
      }

      // Get automation configuration
      const config = await this.getAutomationConfig(booking.hotelId);
      if (!config.isEnabled) {
        logger.info('Checkout automation disabled for hotel', { 
          hotelId: booking.hotelId, 
          bookingId 
        });
        return { success: true, message: 'Automation disabled' };
      }

      // Create automation log entry
      const logEntry = await this.createLogEntry(bookingId, 'started', {
        processedBy,
        config: {
          laundryEnabled: config.isLaundryAutomationEnabled,
          inventoryEnabled: config.isInventoryAutomationEnabled,
          housekeepingEnabled: config.isHousekeepingAutomationEnabled
        }
      });

      const results = {
        laundry: null,
        inventory: null,
        housekeeping: null,
        roomStatus: null
      };

      // Process each automation type
      if (config.isLaundryAutomationEnabled) {
        try {
          results.laundry = await this.processLaundryAutomation(booking, config, processedBy);
          logger.info('Laundry automation completed', { bookingId, result: results.laundry });
        } catch (error) {
          logger.error('Laundry automation failed', { bookingId, error: error.message });
          results.laundry = { success: false, error: error.message };
        }
      }

      if (config.isInventoryAutomationEnabled) {
        try {
          results.inventory = await this.processInventoryAutomation(booking, config, processedBy);
          logger.info('Inventory automation completed', { bookingId, result: results.inventory });
        } catch (error) {
          logger.error('Inventory automation failed', { bookingId, error: error.message });
          results.inventory = { success: false, error: error.message };
        }
      }

      if (config.isHousekeepingAutomationEnabled) {
        try {
          results.housekeeping = await this.createHousekeepingTasks(booking, config, processedBy);
          logger.info('Housekeeping automation completed', { bookingId, result: results.housekeeping });
        } catch (error) {
          logger.error('Housekeeping automation failed', { bookingId, error: error.message });
          results.housekeeping = { success: false, error: error.message };
        }
      }

      // Update room status
      try {
        results.roomStatus = await this.updateRoomStatus(booking, processedBy);
        logger.info('Room status updated', { bookingId, result: results.roomStatus });
      } catch (error) {
        logger.error('Room status update failed', { bookingId, error: error.message });
        results.roomStatus = { success: false, error: error.message };
      }

      // Update automation log
      const overallSuccess = Object.values(results).every(result => 
        result && result.success !== false
      );

      await this.updateLogEntry(logEntry._id, overallSuccess ? 'completed' : 'partial_success', {
        results,
        completedAt: new Date()
      });

      // Update booking with automation status
      await this.updateBookingAutomationStatus(bookingId, overallSuccess ? 'completed' : 'partial_success', results);

      logger.info('Checkout automation completed', { 
        bookingId, 
        success: overallSuccess,
        results 
      });

      return {
        success: overallSuccess,
        message: overallSuccess ? 'Automation completed successfully' : 'Automation completed with some issues',
        results
      };

    } catch (error) {
      logger.error('Checkout automation failed', { 
        bookingId, 
        error: error.message,
        stack: error.stack 
      });

      // Update log entry with error
      await this.updateLogEntry(bookingId, 'failed', {
        error: error.message,
        stack: error.stack,
        completedAt: new Date()
      });

      // Update booking with failed status
      await this.updateBookingAutomationStatus(bookingId, 'failed', { error: error.message });

      return {
        success: false,
        message: 'Automation failed',
        error: error.message
      };

    } finally {
      this.isProcessing.delete(bookingId);
    }
  }

  /**
   * Get automation configuration for hotel
   * @param {string} hotelId - Hotel ID
   */
  async getAutomationConfig(hotelId) {
    let config = await CheckoutAutomationConfig.findOne({ hotelId });
    
    if (!config) {
      // Create default configuration
      config = await CheckoutAutomationConfig.create({
        hotelId,
        isEnabled: true,
        isLaundryAutomationEnabled: true,
        isInventoryAutomationEnabled: true,
        isHousekeepingAutomationEnabled: true,
        defaultLaundryReturnDays: 1,
        automaticTaskAssignment: true,
        settings: {
          laundryCategories: ['bedding', 'towels', 'bathrobes', 'curtains'],
          inventoryCheckCategories: ['toiletries', 'amenities', 'electronics'],
          housekeepingTaskTypes: ['checkout_clean', 'deep_clean']
        }
      });
      
      logger.info('Created default automation config', { hotelId });
    }

    return config;
  }

  /**
   * Process laundry automation using enhanced detection
   * @param {Object} booking - Booking object
   * @param {Object} config - Automation configuration
   * @param {string} processedBy - User ID
   */
  async processLaundryAutomation(booking, config, processedBy) {
    // Import laundry service dynamically to avoid circular dependencies
    const { default: laundryService } = await import('./laundryService.js');
    
    const results = [];
    
    for (const roomBooking of booking.rooms) {
      const roomId = roomBooking.roomId._id;
      
      try {
        // Use enhanced laundry processing
        const result = await laundryService.processCheckoutLaundry(
          booking._id,
          roomId,
          processedBy,
          {
            hotelId: booking.hotelId,
            bookingNumber: booking.bookingNumber,
            useEnhancedDetection: true
          }
        );
        
        results.push({
          roomId,
          success: true,
          transactions: result.transactions,
          totalItems: result.totalItems,
          totalCost: result.totalCost,
          expectedReturnDate: result.expectedReturnDate,
          detectionResult: result.detectionResult,
          processingTime: result.processingTime,
          method: 'enhanced'
        });
        
      } catch (error) {
        logger.error('Enhanced laundry automation failed for room', { 
          roomId, 
          bookingId: booking._id, 
          error: error.message 
        });
        
        // Fallback to basic laundry processing
        try {
          const fallbackResult = await this.processBasicLaundry(roomId, booking, config, processedBy);
          results.push({
            roomId,
            success: true,
            ...fallbackResult,
            method: 'fallback',
            fallbackReason: error.message
          });
        } catch (fallbackError) {
          logger.error('Fallback laundry automation also failed', {
            roomId,
            bookingId: booking._id,
            originalError: error.message,
            fallbackError: fallbackError.message
          });
          
          results.push({
            roomId,
            success: false,
            error: error.message,
            fallbackError: fallbackError.message,
            method: 'failed'
          });
        }
      }
    }
    
    return {
      success: results.every(r => r.success),
      results,
      summary: this.generateLaundrySummary(results)
    };
  }

  /**
   * Fallback basic laundry processing
   * @param {string} roomId - Room ID
   * @param {Object} booking - Booking object
   * @param {Object} config - Automation configuration
   * @param {string} processedBy - User ID
   */
  async processBasicLaundry(roomId, booking, config, processedBy) {
    // Import laundry service
    const { default: laundryService } = await import('./laundryService.js');
    
    // Get basic laundry items for this room
    const laundryItems = await this.getLaundryItemsForRoom(roomId, booking, config);
    
    if (laundryItems.length > 0) {
      // Calculate expected return date
      const expectedReturnDate = new Date();
      expectedReturnDate.setDate(expectedReturnDate.getDate() + config.defaultLaundryReturnDays);
      
      // Send items to laundry
      const result = await laundryService.sendItemsToLaundry({
        hotelId: booking.hotelId,
        roomId,
        items: laundryItems,
        processedBy,
        expectedReturnDate,
        notes: `Basic laundry processing for checkout - Booking ${booking.bookingNumber}`,
        source: 'checkout_automation_fallback'
      });
      
      return {
        transactions: result.transactions,
        totalItems: result.totalItems,
        totalCost: result.totalCost,
        expectedReturnDate
      };
    } else {
      return {
        transactions: [],
        totalItems: 0,
        totalCost: 0,
        message: 'No laundry items found'
      };
    }
  }

  /**
   * Generate summary of laundry processing results
   * @param {Array} results - Laundry processing results
   */
  generateLaundrySummary(results) {
    const successfulResults = results.filter(r => r.success);
    const enhancedResults = successfulResults.filter(r => r.method === 'enhanced');
    const fallbackResults = successfulResults.filter(r => r.method === 'fallback');
    
    const totalItems = successfulResults.reduce((sum, r) => sum + (r.totalItems || 0), 0);
    const totalCost = successfulResults.reduce((sum, r) => sum + (r.totalCost || 0), 0);
    const totalProcessingTime = successfulResults.reduce((sum, r) => sum + (r.processingTime || 0), 0);
    
    return {
      totalRooms: results.length,
      successfulRooms: successfulResults.length,
      failedRooms: results.length - successfulResults.length,
      enhancedProcessing: enhancedResults.length,
      fallbackProcessing: fallbackResults.length,
      totalItems,
      totalCost,
      totalProcessingTimeMinutes: totalProcessingTime,
      averageItemsPerRoom: successfulResults.length > 0 ? totalItems / successfulResults.length : 0,
      averageCostPerRoom: successfulResults.length > 0 ? totalCost / successfulResults.length : 0,
      successRate: results.length > 0 ? (successfulResults.length / results.length) * 100 : 0
    };
  }

  /**
   * Get laundry items for a room
   * @param {string} roomId - Room ID
   * @param {Object} booking - Booking object
   * @param {Object} config - Automation configuration
   */
  async getLaundryItemsForRoom(roomId, booking, config) {
    // Import room inventory service
    const { default: roomInventoryService } = await import('./roomInventoryService.js');
    
    // Get room inventory
    const roomInventory = await roomInventoryService.getRoomInventory(roomId);
    if (!roomInventory) {
      return [];
    }

    const laundryItems = [];
    
    // Check each item in room inventory
    for (const item of roomInventory.items) {
      // Check if item category requires laundry
      if (config.settings.laundryCategories.includes(item.itemId.category)) {
        // Determine quantity based on room type and guest count
        const quantity = this.calculateLaundryQuantity(
          item.itemId.category,
          booking.rooms.find(r => r.roomId._id.toString() === roomId.toString()).roomId.type,
          booking.guestDetails.adults + booking.guestDetails.children
        );
        
        if (quantity > 0) {
          laundryItems.push({
            itemId: item.itemId._id,
            quantity,
            notes: `Automatic checkout laundry - ${item.itemId.name}`,
            specialInstructions: 'Standard cleaning'
          });
        }
      }
    }
    
    return laundryItems;
  }

  /**
   * Calculate laundry quantity based on room type and guest count
   * @param {string} category - Item category
   * @param {string} roomType - Room type
   * @param {number} guestCount - Number of guests
   */
  calculateLaundryQuantity(category, roomType, guestCount) {
    const baseQuantities = {
      bedding: {
        standard: 2,
        deluxe: 3,
        suite: 4,
        presidential: 6
      },
      towels: {
        standard: 4,
        deluxe: 6,
        suite: 8,
        presidential: 12
      },
      bathrobes: {
        standard: 2,
        deluxe: 2,
        suite: 4,
        presidential: 6
      },
      curtains: {
        standard: 1,
        deluxe: 1,
        suite: 2,
        presidential: 3
      }
    };

    const baseQuantity = baseQuantities[category]?.[roomType] || 1;
    
    // Adjust for guest count (minimum 1, maximum base quantity * 2)
    const adjustedQuantity = Math.min(
      Math.max(1, Math.ceil(guestCount / 2)),
      baseQuantity * 2
    );
    
    return adjustedQuantity;
  }

  /**
   * Process inventory automation using enhanced service
   * @param {Object} booking - Booking object
   * @param {Object} config - Automation configuration
   * @param {string} processedBy - User ID
   */
  async processInventoryAutomation(booking, config, processedBy) {
    try {
      // Import inventory automation service
      const { default: inventoryAutomationService } = await import('./inventoryAutomationService.js');
      
      const results = [];
      
      for (const roomBooking of booking.rooms) {
        const roomId = roomBooking.roomId._id;
        
        try {
          // Process comprehensive inventory automation
          const result = await inventoryAutomationService.processCheckoutInventory(
            booking._id,
            roomId,
            processedBy,
            {
              hotelId: booking.hotelId,
              bookingNumber: booking.bookingNumber,
              useEnhancedDetection: true,
              isAdminBypass: false
            }
          );
          
          results.push({
            roomId,
            success: true,
            ...result,
            method: 'enhanced'
          });
          
        } catch (error) {
          logger.error('Enhanced inventory automation failed for room', { 
            roomId, 
            bookingId: booking._id, 
            error: error.message 
          });
          
          // Fallback to basic inventory processing
          try {
            const fallbackResult = await this.processBasicInventory(roomId, booking, config, processedBy);
            results.push({
              roomId,
              success: true,
              ...fallbackResult,
              method: 'fallback',
              fallbackReason: error.message
            });
          } catch (fallbackError) {
            logger.error('Fallback inventory automation also failed', {
              roomId,
              bookingId: booking._id,
              originalError: error.message,
              fallbackError: fallbackError.message
            });
            
            results.push({
              roomId,
              success: false,
              error: error.message,
              fallbackError: fallbackError.message,
              method: 'failed'
            });
          }
        }
      }
      
      return {
        success: results.every(r => r.success),
        results,
        summary: this.generateInventorySummary(results)
      };

    } catch (error) {
      logger.error('Inventory automation failed', {
        bookingId: booking._id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Fallback basic inventory processing
   * @param {string} roomId - Room ID
   * @param {Object} booking - Booking object
   * @param {Object} config - Automation configuration
   * @param {string} processedBy - User ID
   */
  async processBasicInventory(roomId, booking, config, processedBy) {
    try {
      // Basic inventory processing - create simple checkout inventory record
      const CheckoutInventory = (await import('../models/CheckoutInventory.js')).default;
      
      const basicItems = [
        {
          itemName: 'Room Assessment',
          category: 'other',
          quantity: 1,
          unitPrice: 0,
          totalPrice: 0,
          status: 'intact',
          notes: 'Basic inventory assessment completed'
        }
      ];

      const checkoutInventory = new CheckoutInventory({
        bookingId: booking._id,
        roomId,
        checkedBy: processedBy,
        items: basicItems,
        status: 'completed',
        notes: `Basic inventory processing for checkout - Booking ${booking.bookingNumber}`
      });

      await checkoutInventory.save();

      return {
        checkoutInventoryId: checkoutInventory._id,
        itemsProcessed: basicItems.length,
        totalCost: 0,
        method: 'basic'
      };

    } catch (error) {
      logger.error('Basic inventory processing failed', {
        roomId,
        bookingId: booking._id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate summary of inventory processing results
   * @param {Array} results - Inventory processing results
   */
  generateInventorySummary(results) {
    const successfulResults = results.filter(r => r.success);
    const enhancedResults = successfulResults.filter(r => r.method === 'enhanced');
    const fallbackResults = successfulResults.filter(r => r.method === 'fallback');
    
    const totalItems = successfulResults.reduce((sum, r) => sum + (r.summary?.totalSteps || 0), 0);
    const totalCost = successfulResults.reduce((sum, r) => sum + (r.replacement?.totalCost || 0), 0);
    
    return {
      totalRooms: results.length,
      successfulRooms: successfulResults.length,
      failedRooms: results.length - successfulResults.length,
      enhancedProcessing: enhancedResults.length,
      fallbackProcessing: fallbackResults.length,
      totalItems,
      totalCost,
      averageScore: successfulResults.length > 0 
        ? successfulResults.reduce((sum, r) => sum + (r.assessment?.summary?.overallConditionScore || 0), 0) / successfulResults.length 
        : 0,
      successRate: results.length > 0 ? (successfulResults.length / results.length) * 100 : 0
    };
  }

  /**
   * Create housekeeping tasks using enhanced service
   * @param {Object} booking - Booking object
   * @param {Object} config - Automation configuration
   * @param {string} processedBy - User ID
   */
  async createHousekeepingTasks(booking, config, processedBy) {
    try {
      // Import housekeeping automation service
      const { default: housekeepingAutomationService } = await import('./housekeepingAutomationService.js');
      
      const results = [];
      
      for (const roomBooking of booking.rooms) {
        const roomId = roomBooking.roomId._id;
        
        try {
          // Process comprehensive housekeeping automation
          const result = await housekeepingAutomationService.processCheckoutHousekeeping(
            booking._id,
            roomId,
            processedBy,
            {
              hotelId: booking.hotelId,
              bookingNumber: booking.bookingNumber,
              autoAssignTasks: config.automaticTaskAssignment,
              nextBookingDate: null, // Could be enhanced to check for next booking
              useEnhancedProcessing: true
            }
          );
          
          results.push({
            roomId,
            success: true,
            ...result,
            method: 'enhanced'
          });
          
        } catch (error) {
          logger.error('Enhanced housekeeping automation failed for room', { 
            roomId, 
            bookingId: booking._id, 
            error: error.message 
          });
          
          // Fallback to basic housekeeping task creation
          try {
            const fallbackResult = await this.createBasicHousekeepingTask(roomId, booking, config, processedBy);
            results.push({
              roomId,
              success: true,
              ...fallbackResult,
              method: 'fallback',
              fallbackReason: error.message
            });
          } catch (fallbackError) {
            logger.error('Fallback housekeeping automation also failed', {
              roomId,
              bookingId: booking._id,
              originalError: error.message,
              fallbackError: fallbackError.message
            });
            
            results.push({
              roomId,
              success: false,
              error: error.message,
              fallbackError: fallbackError.message,
              method: 'failed'
            });
          }
        }
      }
      
      return {
        success: results.every(r => r.success),
        results,
        summary: this.generateHousekeepingSummary(results)
      };

    } catch (error) {
      logger.error('Housekeeping automation failed', {
        bookingId: booking._id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Create basic housekeeping task as fallback
   * @param {string} roomId - Room ID
   * @param {Object} booking - Booking object
   * @param {Object} config - Automation configuration
   * @param {string} processedBy - User ID
   */
  async createBasicHousekeepingTask(roomId, booking, config, processedBy) {
    try {
      // Basic housekeeping task creation
      const Housekeeping = (await import('../models/Housekeeping.js')).default;
      
      const task = new Housekeeping({
        hotelId: booking.hotelId,
        roomId,
        taskType: 'checkout_clean',
        type: 'checkout_clean', // For backward compatibility
        title: `Checkout Cleaning - Room ${roomId} (Booking ${booking.bookingNumber})`,
        description: `Basic checkout cleaning task for booking ${booking.bookingNumber}`,
        priority: 'high',
        status: 'pending',
        estimatedDuration: 30,
        supplies: [
          { name: 'Cleaning supplies', quantity: 1, unit: 'set' }
        ],
        notes: `Basic housekeeping task created for checkout - Booking ${booking.bookingNumber}`,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        roomStatus: 'dirty'
      });

      await task.save();

      return {
        taskId: task._id,
        taskType: 'checkout_clean',
        success: true,
        priority: 'high',
        estimatedDuration: 30,
        status: 'pending',
        method: 'basic'
      };

    } catch (error) {
      logger.error('Basic housekeeping task creation failed', {
        roomId,
        bookingId: booking._id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate summary of housekeeping processing results
   * @param {Array} results - Housekeeping processing results
   */
  generateHousekeepingSummary(results) {
    const successfulResults = results.filter(r => r.success);
    const enhancedResults = successfulResults.filter(r => r.method === 'enhanced');
    const fallbackResults = successfulResults.filter(r => r.method === 'fallback');
    
    const totalTasks = successfulResults.reduce((sum, r) => sum + (r.tasks?.length || 0), 0);
    const totalDuration = successfulResults.reduce((sum, r) => sum + (r.summary?.totalEstimatedDuration || 0), 0);
    const assignedTasks = successfulResults.reduce((sum, r) => sum + (r.summary?.assignedTasks || 0), 0);
    
    return {
      totalRooms: results.length,
      successfulRooms: successfulResults.length,
      failedRooms: results.length - successfulResults.length,
      enhancedProcessing: enhancedResults.length,
      fallbackProcessing: fallbackResults.length,
      totalTasks,
      totalDuration,
      assignedTasks,
      averageTasksPerRoom: successfulResults.length > 0 ? totalTasks / successfulResults.length : 0,
      successRate: results.length > 0 ? (successfulResults.length / results.length) * 100 : 0
    };
  }

  /**
   * Update room status
   * @param {Object} booking - Booking object
   * @param {string} processedBy - User ID
   */
  async updateRoomStatus(booking, processedBy) {
    const results = [];
    
    for (const roomBooking of booking.rooms) {
      const roomId = roomBooking.roomId._id;
      
      try {
        // Update room status to dirty (needs cleaning)
        await Room.findByIdAndUpdate(roomId, {
          status: 'dirty',
          lastUpdated: new Date(),
          lastUpdatedBy: processedBy
        });
        
        results.push({
          roomId,
          success: true,
          newStatus: 'dirty'
        });
      } catch (error) {
        logger.error('Failed to update room status', { 
          roomId, 
          bookingId: booking._id, 
          error: error.message 
        });
        results.push({
          roomId,
          success: false,
          error: error.message
        });
      }
    }
    
    return {
      success: results.every(r => r.success),
      results
    };
  }

  /**
   * Create automation log entry
   * @param {string} bookingId - Booking ID
   * @param {string} status - Log status
   * @param {Object} details - Log details
   */
  async createLogEntry(bookingId, status, details) {
    return await CheckoutAutomationLog.create({
      bookingId,
      automationType: 'checkout_processing',
      status,
      details,
      processedAt: new Date()
    });
  }

  /**
   * Update automation log entry
   * @param {string} logId - Log entry ID
   * @param {string} status - New status
   * @param {Object} details - Additional details
   */
  async updateLogEntry(logId, status, details) {
    return await CheckoutAutomationLog.findByIdAndUpdate(logId, {
      status,
      $push: { details: details },
      completedAt: new Date()
    });
  }

  /**
   * Update booking automation status
   * @param {string} bookingId - Booking ID
   * @param {string} status - Automation status
   * @param {Object} results - Automation results
   */
  async updateBookingAutomationStatus(bookingId, status, results) {
    return await Booking.findByIdAndUpdate(bookingId, {
      automationStatus: status,
      automationResults: results,
      automationCompletedAt: new Date()
    });
  }

  /**
   * Get automation status for a booking
   * @param {string} bookingId - Booking ID
   */
  async getAutomationStatus(bookingId) {
    const booking = await Booking.findById(bookingId).select('automationStatus automationResults automationCompletedAt');
    const logs = await CheckoutAutomationLog.find({ bookingId }).sort({ processedAt: -1 });
    
    return {
      booking: booking,
      logs: logs
    };
  }

  /**
   * Retry failed automation
   * @param {string} bookingId - Booking ID
   * @param {Object} context - Retry context
   */
  async retryAutomation(bookingId, context = {}) {
    logger.info('Retrying checkout automation', { bookingId });
    return await this.processCheckout(bookingId, { ...context, forceProcessing: true });
  }
}

export default new CheckoutAutomationService();
