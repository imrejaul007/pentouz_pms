import LaundryTransaction from '../models/LaundryTransaction.js';
import RoomInventory from '../models/RoomInventory.js';
import InventoryItem from '../models/InventoryItem.js';
import Room from '../models/Room.js';
import logger from '../utils/logger.js';

/**
 * Laundry Service - Handles all laundry-related business logic
 */
class LaundryService {
  constructor() {
    this.defaultLaundryCosts = {
      'bedding': 50,
      'towels': 25,
      'bathrobes': 75,
      'curtains': 100,
      'carpets': 200,
      'other': 30
    };
  }

  /**
   * Send items to laundry
   * @param {Object} params - Parameters for sending items to laundry
   * @param {string} params.hotelId - Hotel ID
   * @param {string} params.roomId - Room ID
   * @param {Array} params.items - Array of items to send to laundry
   * @param {string} params.processedBy - User ID who processed the transaction
   * @param {Date} params.expectedReturnDate - Expected return date
   * @param {string} params.notes - Additional notes
   * @param {string} params.specialInstructions - Special instructions
   * @param {boolean} params.isUrgent - Whether this is urgent
   * @param {string} params.source - Source of the request
   */
  async sendItemsToLaundry(params) {
    const {
      hotelId,
      roomId,
      items,
      processedBy,
      expectedReturnDate,
      notes = '',
      specialInstructions = '',
      isUrgent = false,
      source = 'daily_check'
    } = params;

    try {
      logger.info('Sending items to laundry', {
        hotelId,
        roomId,
        itemCount: items.length,
        processedBy
      });

      const transactions = [];
      const room = await Room.findById(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      for (const item of items) {
        // Get item details
        const inventoryItem = await InventoryItem.findById(item.itemId);
        if (!inventoryItem) {
          logger.warn('Inventory item not found', { itemId: item.itemId });
          continue;
        }

        // Calculate cost
        const cost = this.calculateLaundryCost(inventoryItem.category, item.quantity);

        // Create laundry transaction
        const transaction = new LaundryTransaction({
          hotelId,
          roomId,
          itemId: item.itemId,
          transactionType: 'send_to_laundry',
          quantity: item.quantity,
          status: 'pending',
          expectedReturnDate: new Date(expectedReturnDate),
          cost,
          notes: item.notes || notes,
          specialInstructions: item.specialInstructions || specialInstructions,
          processedBy,
          isUrgent,
          priority: isUrgent ? 'urgent' : 'medium',
          metadata: {
            createdBy: processedBy,
            source
          }
        });

        await transaction.save();
        transactions.push(transaction);

        // Update room inventory status
        await this.updateRoomInventoryStatus(roomId, item.itemId, 'sent_to_laundry', item.quantity);

        logger.info('Laundry transaction created', {
          transactionId: transaction._id,
          itemName: inventoryItem.name,
          quantity: item.quantity
        });
      }

      return {
        success: true,
        transactions,
        totalItems: items.length,
        totalCost: transactions.reduce((sum, t) => sum + t.totalCost, 0)
      };

    } catch (error) {
      logger.error('Error sending items to laundry', {
        error: error.message,
        hotelId,
        roomId,
        processedBy
      });
      throw error;
    }
  }

  /**
   * Mark items as in laundry
   * @param {string} transactionId - Transaction ID
   * @param {string} processedBy - User ID who processed
   */
  async markItemsAsInLaundry(transactionId, processedBy) {
    try {
      const transaction = await LaundryTransaction.findById(transactionId);
      if (!transaction) {
        throw new Error('Laundry transaction not found');
      }

      await transaction.markAsInLaundry(processedBy);
      
      logger.info('Items marked as in laundry', {
        transactionId,
        processedBy
      });

      return transaction;
    } catch (error) {
      logger.error('Error marking items as in laundry', {
        error: error.message,
        transactionId,
        processedBy
      });
      throw error;
    }
  }

  /**
   * Mark items as cleaning
   * @param {string} transactionId - Transaction ID
   * @param {string} processedBy - User ID who processed
   */
  async markItemsAsCleaning(transactionId, processedBy) {
    try {
      const transaction = await LaundryTransaction.findById(transactionId);
      if (!transaction) {
        throw new Error('Laundry transaction not found');
      }

      await transaction.markAsCleaning(processedBy);
      
      logger.info('Items marked as cleaning', {
        transactionId,
        processedBy
      });

      return transaction;
    } catch (error) {
      logger.error('Error marking items as cleaning', {
        error: error.message,
        transactionId,
        processedBy
      });
      throw error;
    }
  }

  /**
   * Mark items as ready for return
   * @param {string} transactionId - Transaction ID
   * @param {string} processedBy - User ID who processed
   */
  async markItemsAsReady(transactionId, processedBy) {
    try {
      const transaction = await LaundryTransaction.findById(transactionId);
      if (!transaction) {
        throw new Error('Laundry transaction not found');
      }

      await transaction.markAsReady(processedBy);
      
      logger.info('Items marked as ready', {
        transactionId,
        processedBy
      });

      return transaction;
    } catch (error) {
      logger.error('Error marking items as ready', {
        error: error.message,
        transactionId,
        processedBy
      });
      throw error;
    }
  }

  /**
   * Return items from laundry to inventory
   * @param {string} transactionId - Transaction ID
   * @param {string} returnedBy - User ID who returned items
   * @param {string} quality - Quality of returned items
   * @param {Array} issues - Any issues found
   * @param {Array} photos - Photos of issues
   */
  async returnItemsFromLaundry(transactionId, returnedBy, quality = 'good', issues = [], photos = []) {
    try {
      const transaction = await LaundryTransaction.findById(transactionId);
      if (!transaction) {
        throw new Error('Laundry transaction not found');
      }

      // Mark as returned
      await transaction.markAsReturned(returnedBy, quality);

      // Update quality check
      transaction.qualityCheck = {
        ...transaction.qualityCheck,
        quality,
        issues,
        photos,
        inspectionDate: new Date(),
        inspectedBy: returnedBy
      };

      await transaction.save();

      // Update room inventory status
      await this.updateRoomInventoryStatus(
        transaction.roomId,
        transaction.itemId,
        'returned_from_laundry',
        transaction.quantity
      );

      logger.info('Items returned from laundry', {
        transactionId,
        returnedBy,
        quality
      });

      return transaction;
    } catch (error) {
      logger.error('Error returning items from laundry', {
        error: error.message,
        transactionId,
        returnedBy
      });
      throw error;
    }
  }

  /**
   * Mark items as lost
   * @param {string} transactionId - Transaction ID
   * @param {string} processedBy - User ID who processed
   * @param {string} notes - Notes about the loss
   */
  async markItemsAsLost(transactionId, processedBy, notes) {
    try {
      const transaction = await LaundryTransaction.findById(transactionId);
      if (!transaction) {
        throw new Error('Laundry transaction not found');
      }

      await transaction.markAsLost(processedBy, notes);

      // Update room inventory status
      await this.updateRoomInventoryStatus(
        transaction.roomId,
        transaction.itemId,
        'lost',
        transaction.quantity
      );

      logger.info('Items marked as lost', {
        transactionId,
        processedBy,
        notes
      });

      return transaction;
    } catch (error) {
      logger.error('Error marking items as lost', {
        error: error.message,
        transactionId,
        processedBy
      });
      throw error;
    }
  }

  /**
   * Mark items as damaged
   * @param {string} transactionId - Transaction ID
   * @param {string} processedBy - User ID who processed
   * @param {string} notes - Notes about the damage
   */
  async markItemsAsDamaged(transactionId, processedBy, notes) {
    try {
      const transaction = await LaundryTransaction.findById(transactionId);
      if (!transaction) {
        throw new Error('Laundry transaction not found');
      }

      await transaction.markAsDamaged(processedBy, notes);

      // Update room inventory status
      await this.updateRoomInventoryStatus(
        transaction.roomId,
        transaction.itemId,
        'damaged',
        transaction.quantity
      );

      logger.info('Items marked as damaged', {
        transactionId,
        processedBy,
        notes
      });

      return transaction;
    } catch (error) {
      logger.error('Error marking items as damaged', {
        error: error.message,
        transactionId,
        processedBy
      });
      throw error;
    }
  }

  /**
   * Get laundry dashboard data
   * @param {string} hotelId - Hotel ID
   * @param {Object} filters - Filters for the dashboard
   */
  async getLaundryDashboard(hotelId, filters = {}) {
    try {
      const dashboardData = await LaundryTransaction.getLaundryDashboard(hotelId, filters);
      
      // Get additional statistics
      const totalTransactions = await LaundryTransaction.countDocuments({ hotelId });
      const totalCost = await LaundryTransaction.aggregate([
        { $match: { hotelId } },
        { $group: { _id: null, total: { $sum: '$totalCost' } } }
      ]);

      const averageProcessingTime = await this.calculateAverageProcessingTime(hotelId);

      return {
        ...dashboardData,
        statistics: {
          totalTransactions,
          totalCost: totalCost[0]?.total || 0,
          averageProcessingTime
        }
      };
    } catch (error) {
      logger.error('Error getting laundry dashboard', {
        error: error.message,
        hotelId
      });
      throw error;
    }
  }

  /**
   * Get laundry status for specific filters
   * @param {string} hotelId - Hotel ID
   * @param {Object} filters - Filters for the status
   */
  async getLaundryStatus(hotelId, filters = {}) {
    try {
      return await LaundryTransaction.getLaundryStatus(hotelId, filters);
    } catch (error) {
      logger.error('Error getting laundry status', {
        error: error.message,
        hotelId,
        filters
      });
      throw error;
    }
  }

  /**
   * Get overdue laundry items
   * @param {string} hotelId - Hotel ID
   */
  async getOverdueItems(hotelId) {
    try {
      const overdueItems = await LaundryTransaction.find({
        hotelId,
        status: { $in: ['pending', 'in_laundry', 'cleaning', 'ready'] },
        expectedReturnDate: { $lt: new Date() }
      })
        .populate('roomId', 'roomNumber type')
        .populate('itemId', 'name category')
        .populate('processedBy', 'name')
        .sort({ expectedReturnDate: 1 });

      return overdueItems;
    } catch (error) {
      logger.error('Error getting overdue items', {
        error: error.message,
        hotelId
      });
      throw error;
    }
  }

  /**
   * Calculate laundry cost based on item category
   * @param {string} category - Item category
   * @param {number} quantity - Quantity of items
   */
  calculateLaundryCost(category, quantity = 1) {
    const baseCost = this.defaultLaundryCosts[category] || this.defaultLaundryCosts['other'];
    return baseCost * quantity;
  }

  /**
   * Update room inventory status
   * @param {string} roomId - Room ID
   * @param {string} itemId - Item ID
   * @param {string} status - New status
   * @param {number} quantity - Quantity affected
   */
  async updateRoomInventoryStatus(roomId, itemId, status, quantity) {
    try {
      const roomInventory = await RoomInventory.findOne({ roomId });
      if (!roomInventory) {
        logger.warn('Room inventory not found', { roomId });
        return;
      }

      const item = roomInventory.items.find(i => i.itemId.toString() === itemId.toString());
      if (item) {
        // Update item status based on laundry status
        switch (status) {
          case 'sent_to_laundry':
            item.needsReplacement = true;
            item.replacementReason = 'laundry';
            break;
          case 'returned_from_laundry':
            item.needsReplacement = false;
            item.replacementReason = null;
            item.lastReplacedDate = new Date();
            break;
          case 'lost':
            item.needsReplacement = true;
            item.replacementReason = 'lost';
            break;
          case 'damaged':
            item.needsReplacement = true;
            item.replacementReason = 'damaged';
            break;
        }

        await roomInventory.save();
      }
    } catch (error) {
      logger.error('Error updating room inventory status', {
        error: error.message,
        roomId,
        itemId,
        status
      });
    }
  }

  /**
   * Calculate average processing time for laundry items
   * @param {string} hotelId - Hotel ID
   */
  async calculateAverageProcessingTime(hotelId) {
    try {
      const result = await LaundryTransaction.aggregate([
        {
          $match: {
            hotelId,
            status: 'returned',
            actualReturnDate: { $exists: true }
          }
        },
        {
          $project: {
            processingTime: {
              $divide: [
                { $subtract: ['$actualReturnDate', '$sentDate'] },
                1000 * 60 * 60 * 24 // Convert to days
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            averageTime: { $avg: '$processingTime' }
          }
        }
      ]);

      return result[0]?.averageTime || 0;
    } catch (error) {
      logger.error('Error calculating average processing time', {
        error: error.message,
        hotelId
      });
      return 0;
    }
  }

  /**
   * Get laundry statistics for reporting
   * @param {string} hotelId - Hotel ID
   * @param {Object} dateRange - Date range for statistics
   */
  async getLaundryStatistics(hotelId, dateRange = {}) {
    try {
      const matchQuery = { hotelId };
      
      if (dateRange.start && dateRange.end) {
        matchQuery.sentDate = {
          $gte: new Date(dateRange.start),
          $lte: new Date(dateRange.end)
        };
      }

      const pipeline = [
        { $match: matchQuery },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalQuantity: { $sum: '$quantity' },
            totalCost: { $sum: '$totalCost' },
            averageCost: { $avg: '$totalCost' }
          }
        }
      ];

      const statusStats = await LaundryTransaction.aggregate(pipeline);

      // Get category-wise statistics
      const categoryPipeline = [
        { $match: matchQuery },
        {
          $lookup: {
            from: 'inventoryitems',
            localField: 'itemId',
            foreignField: '_id',
            as: 'item'
          }
        },
        { $unwind: '$item' },
        {
          $group: {
            _id: '$item.category',
            count: { $sum: 1 },
            totalQuantity: { $sum: '$quantity' },
            totalCost: { $sum: '$totalCost' }
          }
        }
      ];

      const categoryStats = await LaundryTransaction.aggregate(categoryPipeline);

      return {
        statusStatistics: statusStats,
        categoryStatistics: categoryStats,
        dateRange
      };
    } catch (error) {
      logger.error('Error getting laundry statistics', {
        error: error.message,
        hotelId,
        dateRange
      });
      throw error;
    }
  }

  /**
   * Process checkout laundry using enhanced detection service
   * @param {string} bookingId - Booking ID
   * @param {string} roomId - Room ID
   * @param {string} processedBy - User ID who processed
   * @param {Object} options - Processing options
   */
  async processCheckoutLaundry(bookingId, roomId, processedBy, options = {}) {
    try {
      logger.info('Processing checkout laundry with enhanced detection', {
        bookingId,
        roomId,
        processedBy
      });

      // Import laundry detection service
      const { default: laundryDetectionService } = await import('./laundryDetectionService.js');
      
      // Detect laundry items using enhanced service
      const detectionResult = await laundryDetectionService.detectLaundryItems(bookingId, {
        roomId,
        ...options
      });

      if (!detectionResult.success) {
        throw new Error('Laundry detection failed');
      }

      // Find the result for the specific room
      const roomResult = detectionResult.results.find(r => r.roomId.toString() === roomId.toString());
      if (!roomResult || !roomResult.success) {
        throw new Error(`Laundry detection failed for room ${roomId}`);
      }

      // Process each detected item
      const transactions = [];
      const expectedReturnDate = new Date();
      expectedReturnDate.setDate(expectedReturnDate.getDate() + roomResult.timingAnalysis.recommendedReturnDays);

      for (const item of roomResult.items) {
        try {
          // Create laundry transaction
          const transaction = new LaundryTransaction({
            hotelId: options.hotelId,
            roomId,
            itemId: item.itemId,
            bookingId,
            transactionType: 'send_to_laundry',
            quantity: item.quantity,
            status: 'pending',
            expectedReturnDate,
            cost: item.costPerItem || 0,
            totalCost: item.estimatedCost || 0,
            notes: `Checkout laundry - ${item.itemName} (${item.category})`,
            specialInstructions: item.specialInstructions || '',
            processedBy,
            isUrgent: item.priority === 'urgent',
            priority: item.priority || 'medium',
            metadata: {
              createdBy: processedBy,
              source: 'checkout_automation_enhanced',
              detectionMethod: roomResult.detectionMethod,
              templateUsed: roomResult.templateUsed,
              guestCount: roomResult.guestCount,
              season: roomResult.season,
              roomCondition: roomResult.roomCondition
            }
          });

          await transaction.save();
          transactions.push(transaction);

          // Update room inventory status
          await this.updateRoomInventoryStatus(roomId, item.itemId, 'sent_to_laundry', item.quantity);

          logger.info('Enhanced laundry transaction created', {
            transactionId: transaction._id,
            itemName: item.itemName,
            category: item.category,
            quantity: item.quantity,
            priority: item.priority
          });

        } catch (error) {
          logger.error('Failed to create laundry transaction for item', {
            itemName: item.itemName,
            error: error.message
          });
          // Continue with other items even if one fails
        }
      }

      // Calculate total cost
      const totalCost = transactions.reduce((sum, t) => sum + t.totalCost, 0);

      logger.info('Checkout laundry processing completed', {
        bookingId,
        roomId,
        transactionsCreated: transactions.length,
        totalCost,
        expectedReturnDate
      });

      return {
        success: true,
        bookingId,
        roomId,
        transactions,
        totalItems: transactions.length,
        totalCost,
        expectedReturnDate,
        detectionResult: roomResult,
        processingTime: roomResult.timingAnalysis.estimatedProcessingMinutes
      };

    } catch (error) {
      logger.error('Enhanced checkout laundry processing failed', {
        bookingId,
        roomId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get enhanced laundry processing statistics
   * @param {string} hotelId - Hotel ID
   * @param {Object} dateRange - Date range for statistics
   */
  async getEnhancedStatistics(hotelId, dateRange = {}) {
    try {
      // Import laundry detection service
      const { default: laundryDetectionService } = await import('./laundryDetectionService.js');
      
      // Get detection statistics
      const detectionStats = await laundryDetectionService.getDetectionStatistics(hotelId, dateRange);
      
      // Get traditional laundry statistics
      const traditionalStats = await this.getLaundryStatistics(hotelId, dateRange);
      
      // Combine statistics
      return {
        detection: detectionStats,
        traditional: traditionalStats,
        enhanced: {
          totalTemplates: detectionStats.totalTemplates,
          averageTemplateUsage: detectionStats.averageUsage,
          mostUsedTemplate: detectionStats.mostUsedTemplate,
          templatesByRoomType: detectionStats.templatesByRoomType
        }
      };

    } catch (error) {
      logger.error('Error getting enhanced laundry statistics', {
        error: error.message,
        hotelId,
        dateRange
      });
      throw error;
    }
  }
}

export default new LaundryService();
