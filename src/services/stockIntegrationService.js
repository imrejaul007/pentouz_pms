import StockInventoryService from './stockInventoryService.js';
import TransactionService from './transactionService.js';
import Inventory from '../models/Inventory.js';
import logger from '../utils/logger.js';

/**
 * Stock Integration Service
 * Integrates stock movement tracking with existing hotel operations
 */
class StockIntegrationService {

  /**
   * Integrate with housekeeping operations
   * Log consumption when housekeeping tasks are completed
   */
  static async integrateHousekeepingConsumption(housekeepingData) {
    try {
      const {
        hotelId,
        roomId,
        roomNumber,
        taskId,
        checklistId,
        cleaningType, // standard, deep, maintenance
        completedBy,
        items = [] // Optional: specific items used
      } = housekeepingData;

      logger.info('Processing housekeeping consumption integration', {
        hotelId,
        roomNumber,
        taskId,
        cleaningType
      });

      let consumptionItems = items;

      // If no specific items provided, use default consumption based on cleaning type
      if (consumptionItems.length === 0) {
        consumptionItems = await this.getDefaultHousekeepingConsumption(hotelId, cleaningType);
      }

      // Process consumption for each item
      const transactions = await StockInventoryService.processHousekeepingConsumption({
        hotelId,
        roomNumber,
        roomId,
        items: consumptionItems,
        performedBy: completedBy,
        taskId,
        checklistId
      });

      logger.info('Housekeeping consumption processed successfully', {
        roomNumber,
        itemsConsumed: transactions.totalItemsConsumed,
        transactionIds: transactions.transactions.map(t => t.transaction._id)
      });

      return {
        success: true,
        roomNumber,
        cleaningType,
        itemsConsumed: transactions.totalItemsConsumed,
        transactions: transactions.transactions,
        totalCost: transactions.transactions.reduce((sum, t) => sum + (t.transaction.totalCost || 0), 0)
      };

    } catch (error) {
      logger.error('Failed to process housekeeping consumption', {
        error: error.message,
        housekeepingData
      });
      throw error;
    }
  }

  /**
   * Integrate with guest service requests
   * Log consumption when guest services are provided
   */
  static async integrateGuestServiceConsumption(guestServiceData) {
    try {
      const {
        hotelId,
        bookingId,
        roomNumber,
        serviceType, // room_service, amenities, maintenance, etc.
        serviceItems = [], // Specific items requested/used
        performedBy,
        serviceRequestId,
        serviceName
      } = guestServiceData;

      logger.info('Processing guest service consumption integration', {
        hotelId,
        bookingId,
        roomNumber,
        serviceType,
        serviceRequestId
      });

      let consumptionItems = serviceItems;

      // If no specific items provided, use default consumption based on service type
      if (consumptionItems.length === 0) {
        consumptionItems = await this.getDefaultGuestServiceConsumption(hotelId, serviceType);
      }

      // Process consumption for each item
      const transactions = await StockInventoryService.processGuestServiceConsumption({
        hotelId,
        bookingId,
        roomNumber,
        items: consumptionItems.map(item => ({
          ...item,
          serviceName: serviceName || serviceType
        })),
        performedBy,
        serviceRequestId
      });

      logger.info('Guest service consumption processed successfully', {
        bookingId,
        roomNumber,
        serviceType,
        itemsUsed: transactions.totalItemsUsed
      });

      return {
        success: true,
        bookingId,
        roomNumber,
        serviceType,
        itemsUsed: transactions.totalItemsUsed,
        transactions: transactions.transactions,
        totalCost: transactions.transactions.reduce((sum, t) => sum + (t.transaction.totalCost || 0), 0)
      };

    } catch (error) {
      logger.error('Failed to process guest service consumption', {
        error: error.message,
        guestServiceData
      });
      throw error;
    }
  }

  /**
   * Integrate with supply request approvals
   * Create IN transactions when supply requests are approved
   */
  static async integrateSupplyRequestApproval(supplyRequestData) {
    try {
      const {
        hotelId,
        supplyRequestId,
        approvedItems, // Array of { inventoryItemId, approvedQuantity, unitCost }
        approvedBy,
        deliveryDate,
        supplier,
        notes
      } = supplyRequestData;

      logger.info('Processing supply request approval integration', {
        hotelId,
        supplyRequestId,
        itemCount: approvedItems.length
      });

      const transactions = [];

      for (const item of approvedItems) {
        if (item.approvedQuantity > 0) {
          const result = await StockInventoryService.restockItem({
            hotelId,
            inventoryItemId: item.inventoryItemId,
            quantity: item.approvedQuantity,
            unitCost: item.unitCost || 0,
            supplier,
            invoiceNumber: supplyRequestId,
            deliveryDate,
            performedBy: approvedBy,
            notes: notes || `Supply request approval - ${supplyRequestId}`
          });

          transactions.push(result);
        }
      }

      logger.info('Supply request approval processed successfully', {
        supplyRequestId,
        itemsRestocked: transactions.length,
        totalCost: transactions.reduce((sum, t) => sum + t.totalCost, 0)
      });

      return {
        success: true,
        supplyRequestId,
        itemsRestocked: transactions.length,
        transactions,
        totalCost: transactions.reduce((sum, t) => sum + t.totalCost, 0)
      };

    } catch (error) {
      logger.error('Failed to process supply request approval', {
        error: error.message,
        supplyRequestData
      });
      throw error;
    }
  }

  /**
   * Integrate with maintenance task completion
   * Log consumption of maintenance supplies and replacement parts
   */
  static async integrateMaintenanceConsumption(maintenanceData) {
    try {
      const {
        hotelId,
        taskId,
        roomId,
        roomNumber,
        maintenanceType, // repair, replacement, preventive
        itemsUsed = [], // Items consumed during maintenance
        completedBy,
        description
      } = maintenanceData;

      logger.info('Processing maintenance consumption integration', {
        hotelId,
        taskId,
        roomNumber,
        maintenanceType
      });

      let consumptionItems = itemsUsed;

      // If no specific items provided, use default consumption based on maintenance type
      if (consumptionItems.length === 0) {
        consumptionItems = await this.getDefaultMaintenanceConsumption(hotelId, maintenanceType);
      }

      const transactions = [];

      for (const item of consumptionItems) {
        if (item.quantity > 0) {
          const transaction = await StockInventoryService.consumeItem({
            hotelId,
            inventoryItemId: item.inventoryItemId,
            quantity: item.quantity,
            reason: `Maintenance - ${maintenanceType} - ${description || 'Task completion'}`,
            reference: {
              type: 'maintenance',
              id: taskId,
              description: `Maintenance task for room ${roomNumber}`
            },
            location: {
              to: {
                room: roomNumber,
                building: 'Main'
              }
            },
            performedBy: completedBy,
            metadata: {
              roomId,
              taskId,
              maintenanceType,
              operation: 'maintenance'
            }
          });

          transactions.push(transaction);
        }
      }

      logger.info('Maintenance consumption processed successfully', {
        taskId,
        roomNumber,
        itemsConsumed: transactions.length
      });

      return {
        success: true,
        taskId,
        roomNumber,
        maintenanceType,
        itemsConsumed: transactions.length,
        transactions,
        totalCost: transactions.reduce((sum, t) => sum + (t.transaction.totalCost || 0), 0)
      };

    } catch (error) {
      logger.error('Failed to process maintenance consumption', {
        error: error.message,
        maintenanceData
      });
      throw error;
    }
  }

  /**
   * Get default housekeeping consumption based on cleaning type
   */
  static async getDefaultHousekeepingConsumption(hotelId, cleaningType) {
    const defaultConsumption = {
      standard: [
        { category: 'cleaning', name: 'All-purpose cleaner', quantity: 0.5 },
        { category: 'cleaning', name: 'Disinfectant', quantity: 0.3 },
        { category: 'bedding', name: 'Bed sheets', quantity: 1 },
        { category: 'toiletries', name: 'Towels', quantity: 2 },
        { category: 'toiletries', name: 'Toilet paper', quantity: 2 },
        { category: 'toiletries', name: 'Shampoo', quantity: 1 },
        { category: 'amenities', name: 'Welcome kit', quantity: 1 }
      ],
      deep: [
        { category: 'cleaning', name: 'All-purpose cleaner', quantity: 1 },
        { category: 'cleaning', name: 'Disinfectant', quantity: 0.5 },
        { category: 'cleaning', name: 'Carpet cleaner', quantity: 0.3 },
        { category: 'bedding', name: 'Bed sheets', quantity: 1 },
        { category: 'bedding', name: 'Pillowcases', quantity: 2 },
        { category: 'toiletries', name: 'Towels', quantity: 4 },
        { category: 'toiletries', name: 'Toilet paper', quantity: 3 },
        { category: 'toiletries', name: 'Shampoo', quantity: 1 },
        { category: 'toiletries', name: 'Conditioner', quantity: 1 },
        { category: 'amenities', name: 'Welcome kit', quantity: 1 }
      ],
      maintenance: [
        { category: 'cleaning', name: 'All-purpose cleaner', quantity: 0.2 },
        { category: 'cleaning', name: 'Disinfectant', quantity: 0.2 }
      ]
    };

    const items = defaultConsumption[cleaningType] || defaultConsumption.standard;
    const inventoryItems = [];

    for (const item of items) {
      // Find inventory item by name and category
      const inventoryItem = await Inventory.findOne({
        hotelId,
        name: { $regex: item.name, $options: 'i' },
        category: item.category,
        isActive: true
      });

      if (inventoryItem) {
        inventoryItems.push({
          inventoryItemId: inventoryItem._id,
          quantity: item.quantity,
          reason: `Housekeeping consumption - ${cleaningType} cleaning`
        });
      }
    }

    return inventoryItems;
  }

  /**
   * Get default guest service consumption based on service type
   */
  static async getDefaultGuestServiceConsumption(hotelId, serviceType) {
    const defaultConsumption = {
      room_service: [
        { category: 'amenities', name: 'Napkins', quantity: 5 },
        { category: 'amenities', name: 'Utensils set', quantity: 1 }
      ],
      amenities: [
        { category: 'toiletries', name: 'Extra towels', quantity: 2 },
        { category: 'amenities', name: 'Slippers', quantity: 1 }
      ],
      welcome_package: [
        { category: 'amenities', name: 'Welcome kit', quantity: 1 },
        { category: 'minibar', name: 'Complimentary water', quantity: 2 }
      ],
      laundry: [
        { category: 'cleaning', name: 'Laundry detergent', quantity: 0.1 },
        { category: 'cleaning', name: 'Fabric softener', quantity: 0.05 }
      ]
    };

    const items = defaultConsumption[serviceType] || [];
    const inventoryItems = [];

    for (const item of items) {
      const inventoryItem = await Inventory.findOne({
        hotelId,
        name: { $regex: item.name, $options: 'i' },
        category: item.category,
        isActive: true
      });

      if (inventoryItem) {
        inventoryItems.push({
          inventoryItemId: inventoryItem._id,
          quantity: item.quantity,
          reason: `Guest service - ${serviceType}`
        });
      }
    }

    return inventoryItems;
  }

  /**
   * Get default maintenance consumption based on maintenance type
   */
  static async getDefaultMaintenanceConsumption(hotelId, maintenanceType) {
    const defaultConsumption = {
      plumbing: [
        { category: 'maintenance', name: 'Pipe sealant', quantity: 0.1 },
        { category: 'maintenance', name: 'Pipe cleaner', quantity: 0.2 }
      ],
      electrical: [
        { category: 'maintenance', name: 'Electrical tape', quantity: 0.1 },
        { category: 'maintenance', name: 'Wire nuts', quantity: 2 }
      ],
      hvac: [
        { category: 'maintenance', name: 'Air filter', quantity: 1 },
        { category: 'cleaning', name: 'HVAC cleaner', quantity: 0.2 }
      ],
      general: [
        { category: 'maintenance', name: 'Multi-tool', quantity: 0 }, // Tool usage, no consumption
        { category: 'cleaning', name: 'All-purpose cleaner', quantity: 0.1 }
      ]
    };

    const items = defaultConsumption[maintenanceType] || defaultConsumption.general;
    const inventoryItems = [];

    for (const item of items) {
      if (item.quantity > 0) { // Only include items with actual consumption
        const inventoryItem = await Inventory.findOne({
          hotelId,
          name: { $regex: item.name, $options: 'i' },
          category: item.category,
          isActive: true
        });

        if (inventoryItem) {
          inventoryItems.push({
            inventoryItemId: inventoryItem._id,
            quantity: item.quantity,
            reason: `Maintenance - ${maintenanceType}`
          });
        }
      }
    }

    return inventoryItems;
  }

  /**
   * Bulk process checkout inventory changes
   * Process multiple rooms' inventory changes at once
   */
  static async bulkProcessCheckoutInventory(checkoutData) {
    try {
      const {
        hotelId,
        checkouts, // Array of checkout data
        processedBy
      } = checkoutData;

      logger.info('Processing bulk checkout inventory changes', {
        hotelId,
        checkoutCount: checkouts.length
      });

      const results = [];

      for (const checkout of checkouts) {
        try {
          // Process housekeeping consumption
          if (checkout.housekeeping) {
            const housekeepingResult = await this.integrateHousekeepingConsumption({
              hotelId,
              roomId: checkout.roomId,
              roomNumber: checkout.roomNumber,
              taskId: checkout.housekeeping.taskId,
              cleaningType: checkout.housekeeping.cleaningType || 'standard',
              completedBy: processedBy,
              items: checkout.housekeeping.items || []
            });

            results.push({
              type: 'housekeeping',
              roomNumber: checkout.roomNumber,
              ...housekeepingResult
            });
          }

          // Process guest service consumption
          if (checkout.guestServices && checkout.guestServices.length > 0) {
            for (const service of checkout.guestServices) {
              const serviceResult = await this.integrateGuestServiceConsumption({
                hotelId,
                bookingId: checkout.bookingId,
                roomNumber: checkout.roomNumber,
                serviceType: service.serviceType,
                serviceItems: service.items || [],
                performedBy: processedBy,
                serviceRequestId: service.serviceRequestId,
                serviceName: service.serviceName
              });

              results.push({
                type: 'guest_service',
                roomNumber: checkout.roomNumber,
                ...serviceResult
              });
            }
          }

          // Process maintenance consumption
          if (checkout.maintenance) {
            const maintenanceResult = await this.integrateMaintenanceConsumption({
              hotelId,
              taskId: checkout.maintenance.taskId,
              roomId: checkout.roomId,
              roomNumber: checkout.roomNumber,
              maintenanceType: checkout.maintenance.maintenanceType,
              itemsUsed: checkout.maintenance.items || [],
              completedBy: processedBy,
              description: checkout.maintenance.description
            });

            results.push({
              type: 'maintenance',
              roomNumber: checkout.roomNumber,
              ...maintenanceResult
            });
          }

        } catch (error) {
          logger.error('Failed to process checkout for room', {
            roomNumber: checkout.roomNumber,
            error: error.message
          });

          results.push({
            roomNumber: checkout.roomNumber,
            success: false,
            error: error.message
          });
        }
      }

      const summary = {
        totalProcessed: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        totalCost: results
          .filter(r => r.success)
          .reduce((sum, r) => sum + (r.totalCost || 0), 0),
        byType: {
          housekeeping: results.filter(r => r.type === 'housekeeping').length,
          guestService: results.filter(r => r.type === 'guest_service').length,
          maintenance: results.filter(r => r.type === 'maintenance').length
        }
      };

      logger.info('Bulk checkout inventory processing completed', summary);

      return {
        success: true,
        results,
        summary
      };

    } catch (error) {
      logger.error('Failed to process bulk checkout inventory', {
        error: error.message,
        checkoutData
      });
      throw error;
    }
  }

  /**
   * Generate consumption report for a specific period
   */
  static async generateConsumptionReport(hotelId, startDate, endDate, options = {}) {
    try {
      const { groupBy = 'category', includeDetails = true } = options;

      // Get all consumption transactions in the period
      const filters = {
        hotelId,
        transactionType: 'CONSUMPTION',
        startDate,
        endDate
      };

      const transactionHistory = await TransactionService.getTransactionHistory(filters);
      const transactions = transactionHistory.transactions;

      // Group transactions by specified criteria
      const groupedData = this.groupTransactionData(transactions, groupBy);

      // Calculate summary statistics
      const summary = {
        totalTransactions: transactions.length,
        totalQuantityConsumed: transactions.reduce((sum, t) => sum + Math.abs(t.quantity), 0),
        totalCost: transactions.reduce((sum, t) => sum + (t.totalCost || 0), 0),
        period: { startDate, endDate },
        groupBy
      };

      // Get top consuming items
      const topItems = this.getTopConsumingItems(transactions, 10);

      // Get consumption by operation type
      const byOperation = this.groupByOperation(transactions);

      const report = {
        summary,
        groupedData,
        topItems,
        byOperation
      };

      if (includeDetails) {
        report.transactions = transactions;
      }

      return report;

    } catch (error) {
      logger.error('Failed to generate consumption report', {
        error: error.message,
        hotelId,
        startDate,
        endDate
      });
      throw error;
    }
  }

  /**
   * Helper method to group transaction data
   */
  static groupTransactionData(transactions, groupBy) {
    const grouped = {};

    transactions.forEach(transaction => {
      let key;

      switch (groupBy) {
        case 'category':
          key = transaction.inventoryItemId?.category || 'Unknown';
          break;
        case 'operation':
          key = transaction.metadata?.operation || 'Unknown';
          break;
        case 'date':
          key = new Date(transaction.timestamps.created).toISOString().split('T')[0];
          break;
        case 'user':
          key = transaction.performedBy?.name || 'Unknown';
          break;
        default:
          key = 'All';
      }

      if (!grouped[key]) {
        grouped[key] = {
          count: 0,
          quantity: 0,
          cost: 0,
          items: []
        };
      }

      grouped[key].count++;
      grouped[key].quantity += Math.abs(transaction.quantity);
      grouped[key].cost += transaction.totalCost || 0;
      grouped[key].items.push(transaction.inventoryItemId?.name || 'Unknown');
    });

    // Remove duplicate items and get unique count
    Object.keys(grouped).forEach(key => {
      grouped[key].uniqueItems = [...new Set(grouped[key].items)].length;
      delete grouped[key].items; // Remove items array to reduce response size
    });

    return grouped;
  }

  /**
   * Helper method to get top consuming items
   */
  static getTopConsumingItems(transactions, limit = 10) {
    const itemConsumption = {};

    transactions.forEach(transaction => {
      const itemId = transaction.inventoryItemId?._id || 'unknown';
      const itemName = transaction.inventoryItemId?.name || 'Unknown';

      if (!itemConsumption[itemId]) {
        itemConsumption[itemId] = {
          itemId,
          itemName,
          totalQuantity: 0,
          totalCost: 0,
          transactionCount: 0
        };
      }

      itemConsumption[itemId].totalQuantity += Math.abs(transaction.quantity);
      itemConsumption[itemId].totalCost += transaction.totalCost || 0;
      itemConsumption[itemId].transactionCount++;
    });

    return Object.values(itemConsumption)
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, limit);
  }

  /**
   * Helper method to group by operation type
   */
  static groupByOperation(transactions) {
    const operations = {};

    transactions.forEach(transaction => {
      const operation = transaction.metadata?.operation || 'unknown';

      if (!operations[operation]) {
        operations[operation] = {
          count: 0,
          quantity: 0,
          cost: 0
        };
      }

      operations[operation].count++;
      operations[operation].quantity += Math.abs(transaction.quantity);
      operations[operation].cost += transaction.totalCost || 0;
    });

    return operations;
  }
}

export default StockIntegrationService;