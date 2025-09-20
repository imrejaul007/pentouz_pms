import mongoose from 'mongoose';
import Inventory from '../models/Inventory.js';
import StockMovement from '../models/StockMovement.js';
import TransactionService from './transactionService.js';

class StockInventoryService {
  /**
   * Update stock with automatic transaction logging
   * @param {Object} updateData - Stock update parameters
   * @returns {Promise<Object>} Update result with transaction
   */
  static async updateStock(updateData) {
    const {
      hotelId,
      inventoryItemId,
      quantity,
      reason,
      performedBy,
      reference,
      unitCost = 0,
      approvedBy = null
    } = updateData;

    // Determine transaction type based on quantity
    let transactionType;
    if (quantity > 0) {
      transactionType = 'ADJUSTMENT';
    } else {
      transactionType = 'ADJUSTMENT';
    }

    // Log the transaction
    const transaction = await TransactionService.logTransaction({
      hotelId,
      inventoryItemId,
      transactionType,
      quantity,
      reason: reason || 'Manual stock adjustment',
      reference: reference || {
        type: 'manual',
        description: 'Manual stock update'
      },
      performedBy,
      approvedBy,
      unitCost,
      metadata: {
        operation: 'manual_update'
      }
    });

    return {
      transaction,
      updatedStock: transaction.newQuantity
    };
  }

  /**
   * Restock item with supplier information
   * @param {Object} restockData - Restock parameters
   * @returns {Promise<Object>} Restock result
   */
  static async restockItem(restockData) {
    const {
      hotelId,
      inventoryItemId,
      quantity,
      unitCost,
      supplier,
      invoiceNumber,
      deliveryDate,
      performedBy,
      notes = 'Item restocked'
    } = restockData;

    if (quantity <= 0) {
      throw new Error('Restock quantity must be positive');
    }

    const transaction = await TransactionService.logTransaction({
      hotelId,
      inventoryItemId,
      transactionType: 'REORDER',
      quantity,
      reason: notes,
      reference: {
        type: 'delivery',
        id: invoiceNumber,
        description: `Delivery from ${supplier?.name || 'Unknown supplier'}`
      },
      performedBy,
      unitCost,
      supplier: {
        name: supplier?.name,
        contact: supplier?.contact,
        email: supplier?.email,
        invoiceNumber
      },
      metadata: {
        deliveryDate,
        operation: 'restock'
      }
    });

    return {
      transaction,
      newStock: transaction.newQuantity,
      totalCost: quantity * unitCost
    };
  }

  /**
   * Consume items for housekeeping or guest services
   * @param {Object} consumptionData - Consumption parameters
   * @returns {Promise<Object>} Consumption result
   */
  static async consumeItem(consumptionData) {
    const {
      hotelId,
      inventoryItemId,
      quantity,
      reason,
      reference,
      location,
      performedBy,
      metadata = {}
    } = consumptionData;

    if (quantity <= 0) {
      throw new Error('Consumption quantity must be positive');
    }

    const transaction = await TransactionService.logTransaction({
      hotelId,
      inventoryItemId,
      transactionType: 'CONSUMPTION',
      quantity: -quantity, // Negative for consumption
      reason,
      reference,
      location,
      performedBy,
      metadata: {
        ...metadata,
        operation: 'consumption'
      }
    });

    return {
      transaction,
      remainingStock: transaction.newQuantity
    };
  }

  /**
   * Transfer items between locations
   * @param {Object} transferData - Transfer parameters
   * @returns {Promise<Object>} Transfer result
   */
  static async transferItem(transferData) {
    const {
      hotelId,
      inventoryItemId,
      quantity,
      fromLocation,
      toLocation,
      reason,
      performedBy,
      metadata = {}
    } = transferData;

    const transaction = await TransactionService.logTransaction({
      hotelId,
      inventoryItemId,
      transactionType: 'TRANSFER',
      quantity: 0, // No net change in stock for transfers
      reason: reason || 'Location transfer',
      reference: {
        type: 'manual',
        description: 'Item location transfer'
      },
      location: {
        from: fromLocation,
        to: toLocation
      },
      performedBy,
      metadata: {
        ...metadata,
        operation: 'transfer'
      }
    });

    return {
      transaction,
      transferredQuantity: quantity
    };
  }

  /**
   * Process incoming delivery
   * @param {Object} deliveryData - Delivery parameters
   * @returns {Promise<Array>} Array of transactions for delivered items
   */
  static async processDelivery(deliveryData) {
    const {
      hotelId,
      deliveryItems, // Array of { inventoryItemId, quantity, unitCost }
      supplier,
      invoiceNumber,
      deliveryDate,
      performedBy,
      notes = 'Delivery processed'
    } = deliveryData;

    const transactions = [];

    for (const item of deliveryItems) {
      const transaction = await this.restockItem({
        hotelId,
        inventoryItemId: item.inventoryItemId,
        quantity: item.quantity,
        unitCost: item.unitCost,
        supplier,
        invoiceNumber,
        deliveryDate,
        performedBy,
        notes: `${notes} - ${item.itemName || 'Item'}`
      });

      transactions.push(transaction);
    }

    return {
      transactions,
      totalItems: deliveryItems.length,
      totalCost: transactions.reduce((sum, t) => sum + t.totalCost, 0)
    };
  }

  /**
   * Bulk consumption for housekeeping tasks
   * @param {Object} housekeepingData - Housekeeping consumption data
   * @returns {Promise<Array>} Array of consumption transactions
   */
  static async processHousekeepingConsumption(housekeepingData) {
    const {
      hotelId,
      roomNumber,
      roomId,
      items, // Array of { inventoryItemId, quantity, reason }
      performedBy,
      taskId,
      checklistId
    } = housekeepingData;

    const transactions = [];

    for (const item of items) {
      if (item.quantity > 0) {
        const transaction = await this.consumeItem({
          hotelId,
          inventoryItemId: item.inventoryItemId,
          quantity: item.quantity,
          reason: item.reason || 'Housekeeping consumption',
          reference: {
            type: 'housekeeping',
            id: taskId || checklistId,
            description: `Room ${roomNumber} housekeeping`
          },
          location: {
            to: {
              room: roomNumber,
              building: 'Main',
              floor: 'Various'
            }
          },
          performedBy,
          metadata: {
            roomId,
            taskId,
            checklistId,
            operation: 'housekeeping'
          }
        });

        transactions.push(transaction);
      }
    }

    return {
      transactions,
      roomNumber,
      totalItemsConsumed: transactions.length
    };
  }

  /**
   * Process guest service consumption
   * @param {Object} guestServiceData - Guest service consumption data
   * @returns {Promise<Array>} Array of consumption transactions
   */
  static async processGuestServiceConsumption(guestServiceData) {
    const {
      hotelId,
      bookingId,
      roomNumber,
      items, // Array of { inventoryItemId, quantity, serviceName }
      performedBy,
      serviceRequestId
    } = guestServiceData;

    const transactions = [];

    for (const item of items) {
      if (item.quantity > 0) {
        const transaction = await this.consumeItem({
          hotelId,
          inventoryItemId: item.inventoryItemId,
          quantity: item.quantity,
          reason: `Guest service - ${item.serviceName || 'Service request'}`,
          reference: {
            type: 'guest_service',
            id: serviceRequestId,
            description: `Guest service for room ${roomNumber}`
          },
          location: {
            to: {
              room: roomNumber,
              building: 'Main'
            }
          },
          performedBy,
          metadata: {
            bookingId,
            serviceRequestId,
            serviceName: item.serviceName,
            operation: 'guest_service'
          }
        });

        transactions.push(transaction);
      }
    }

    return {
      transactions,
      bookingId,
      totalItemsUsed: transactions.length
    };
  }

  /**
   * Get low stock alerts with transaction context
   * @param {String} hotelId - Hotel ID
   * @param {Number} threshold - Stock threshold (default: 5)
   * @returns {Promise<Array>} Array of low stock items with usage patterns
   */
  static async getLowStockAlerts(hotelId, threshold = 5) {
    // Get items with low stock
    const lowStockItems = await Inventory.find({
      hotelId,
      stock: { $lte: threshold },
      isActive: true
    });

    const alerts = [];

    for (const item of lowStockItems) {
      // Get recent usage pattern
      const usagePattern = await StockMovement.getItemUsagePattern(
        hotelId,
        item._id,
        30 // Last 30 days
      );

      // Calculate average daily consumption
      const totalOutFlow = usagePattern.reduce((sum, day) => sum + day.totalOut, 0);
      const avgDailyConsumption = usagePattern.length > 0 ? totalOutFlow / usagePattern.length : 0;

      // Estimate days until stockout
      const daysUntilStockout = avgDailyConsumption > 0 ? Math.ceil(item.stock / avgDailyConsumption) : null;

      alerts.push({
        item: {
          id: item._id,
          name: item.name,
          category: item.category,
          currentStock: item.stock,
          minStock: item.minStock,
          unit: item.unit
        },
        alert: {
          severity: item.stock <= item.minStock ? 'critical' : 'warning',
          daysUntilStockout,
          avgDailyConsumption: avgDailyConsumption.toFixed(2),
          reorderSuggested: avgDailyConsumption > 0 ? Math.ceil(avgDailyConsumption * 7) : item.minStock
        },
        usage: usagePattern
      });
    }

    return alerts.sort((a, b) => {
      // Sort by severity and days until stockout
      if (a.alert.severity === 'critical' && b.alert.severity !== 'critical') return -1;
      if (b.alert.severity === 'critical' && a.alert.severity !== 'critical') return 1;

      if (a.alert.daysUntilStockout === null) return 1;
      if (b.alert.daysUntilStockout === null) return -1;

      return a.alert.daysUntilStockout - b.alert.daysUntilStockout;
    });
  }

  /**
   * Get comprehensive item statistics
   * @param {String} hotelId - Hotel ID
   * @param {String} itemId - Item ID
   * @param {Number} days - Number of days to analyze (default: 30)
   * @returns {Promise<Object>} Item statistics
   */
  static async getItemStatistics(hotelId, itemId, days = 30) {
    const [item, transactions, usagePattern] = await Promise.all([
      Inventory.findById(itemId),
      TransactionService.getItemTransactions(itemId, { hotelId, limit: 100 }),
      StockMovement.getItemUsagePattern(hotelId, itemId, days)
    ]);

    if (!item) {
      throw new Error('Item not found');
    }

    // Calculate statistics
    const totalTransactions = transactions.length;
    const totalInFlow = transactions
      .filter(t => ['IN', 'REORDER'].includes(t.transactionType))
      .reduce((sum, t) => sum + t.quantity, 0);
    const totalOutFlow = transactions
      .filter(t => ['OUT', 'CONSUMPTION'].includes(t.transactionType))
      .reduce((sum, t) => sum + Math.abs(t.quantity), 0);
    const totalCost = transactions.reduce((sum, t) => sum + (t.totalCost || 0), 0);

    // Usage by type
    const usageByType = transactions.reduce((acc, t) => {
      const type = t.transactionType;
      if (!acc[type]) {
        acc[type] = { count: 0, quantity: 0, cost: 0 };
      }
      acc[type].count++;
      acc[type].quantity += Math.abs(t.quantity);
      acc[type].cost += t.totalCost || 0;
      return acc;
    }, {});

    // Recent activity (last 7 days)
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 7);
    const recentTransactions = transactions.filter(
      t => new Date(t.timestamps.created) >= recentDate
    );

    return {
      item: {
        id: item._id,
        name: item.name,
        category: item.category,
        currentStock: item.stock,
        minStock: item.minStock,
        maxStock: item.maxStock,
        unit: item.unit,
        avgCost: item.averageCost || 0,
        lastUpdated: item.lastUpdated
      },
      statistics: {
        totalTransactions,
        totalInFlow,
        totalOutFlow,
        totalCost,
        netFlow: totalInFlow - totalOutFlow,
        avgTransactionValue: totalTransactions > 0 ? totalCost / totalTransactions : 0,
        turnoverRate: item.stock > 0 ? totalOutFlow / item.stock : 0
      },
      usage: {
        byType: usageByType,
        pattern: usagePattern,
        recentActivity: {
          transactions: recentTransactions.length,
          quantity: recentTransactions.reduce((sum, t) => sum + Math.abs(t.quantity), 0),
          cost: recentTransactions.reduce((sum, t) => sum + (t.totalCost || 0), 0)
        }
      },
      performance: {
        stockoutRisk: item.stock <= item.minStock ? 'high' : item.stock <= item.minStock * 1.5 ? 'medium' : 'low',
        reorderNeeded: item.stock <= item.minStock,
        suggestedReorderQuantity: Math.max(item.maxStock - item.stock, 0)
      }
    };
  }

  /**
   * Auto-reorder items based on usage patterns
   * @param {String} hotelId - Hotel ID
   * @param {Object} options - Reorder options
   * @returns {Promise<Array>} Array of auto-reorder suggestions
   */
  static async generateAutoReorderSuggestions(hotelId, options = {}) {
    const { includeScheduled = false, daysToAnalyze = 30 } = options;

    // Get items that need reordering
    const lowStockItems = await this.getLowStockAlerts(hotelId, 0); // All items at or below min stock

    const suggestions = [];

    for (const alert of lowStockItems) {
      const { item, alert: alertInfo } = alert;

      // Skip if already has a pending reorder (optional)
      if (!includeScheduled) {
        const pendingReorders = await StockMovement.find({
          hotelId,
          inventoryItemId: item.id,
          transactionType: 'REORDER',
          status: 'pending'
        });

        if (pendingReorders.length > 0) {
          continue;
        }
      }

      // Calculate suggested order quantity
      const avgDailyUsage = parseFloat(alertInfo.avgDailyConsumption);
      const leadTimeDays = 7; // Default lead time
      const safetyStock = avgDailyUsage * 3; // 3 days safety stock
      const targetStock = (avgDailyUsage * leadTimeDays) + safetyStock;
      const orderQuantity = Math.max(targetStock - item.currentStock, item.minStock);

      suggestions.push({
        item,
        currentStock: item.currentStock,
        minStock: item.minStock,
        maxStock: item.maxStock,
        avgDailyUsage,
        daysUntilStockout: alertInfo.daysUntilStockout,
        suggestedOrderQuantity: Math.ceil(orderQuantity),
        priority: alertInfo.severity,
        estimatedCost: orderQuantity * (item.avgCost || 0),
        reasoning: {
          leadTimeDays,
          safetyStock: Math.ceil(safetyStock),
          targetStock: Math.ceil(targetStock),
          urgency: alertInfo.daysUntilStockout ?
            alertInfo.daysUntilStockout <= 3 ? 'urgent' :
            alertInfo.daysUntilStockout <= 7 ? 'soon' : 'normal' : 'unknown'
        }
      });
    }

    return suggestions.sort((a, b) => {
      // Sort by priority and urgency
      if (a.priority === 'critical' && b.priority !== 'critical') return -1;
      if (b.priority === 'critical' && a.priority !== 'critical') return 1;

      if (a.reasoning.urgency === 'urgent' && b.reasoning.urgency !== 'urgent') return -1;
      if (b.reasoning.urgency === 'urgent' && a.reasoning.urgency !== 'urgent') return 1;

      return (a.daysUntilStockout || 999) - (b.daysUntilStockout || 999);
    });
  }
}

export default StockInventoryService;