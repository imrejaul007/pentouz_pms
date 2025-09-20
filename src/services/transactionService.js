import StockMovement from '../models/StockMovement.js';
import Inventory from '../models/Inventory.js';
import mongoose from 'mongoose';

class TransactionService {
  /**
   * Log a stock movement transaction
   * @param {Object} transactionData - Transaction details
   * @returns {Promise<StockMovement>} Created transaction
   */
  static async logTransaction(transactionData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const {
        hotelId,
        inventoryItemId,
        transactionType,
        quantity,
        reason,
        reference,
        location,
        performedBy,
        approvedBy,
        supplier,
        metadata = {},
        unitCost = 0
      } = transactionData;

      // Get current inventory item to get previous quantity
      const inventoryItem = await Inventory.findById(inventoryItemId).session(session);
      if (!inventoryItem) {
        throw new Error('Inventory item not found');
      }

      // Validate hotel match
      if (inventoryItem.hotelId.toString() !== hotelId.toString()) {
        throw new Error('Inventory item does not belong to the specified hotel');
      }

      const previousQuantity = inventoryItem.stock || 0;
      const newQuantity = previousQuantity + quantity;

      // Validate sufficient stock for OUT/CONSUMPTION transactions
      if ((transactionType === 'OUT' || transactionType === 'CONSUMPTION') && newQuantity < 0) {
        throw new Error(`Insufficient stock. Available: ${previousQuantity}, Requested: ${Math.abs(quantity)}`);
      }

      // Create transaction record
      const transaction = new StockMovement({
        hotelId,
        inventoryItemId,
        transactionType,
        quantity,
        previousQuantity,
        newQuantity,
        unitCost,
        reason,
        reference,
        location,
        performedBy,
        approvedBy,
        supplier,
        metadata,
        status: 'completed',
        timestamps: {
          created: new Date(),
          updated: new Date(),
          completed: new Date()
        }
      });

      await transaction.save({ session });

      // Update inventory stock
      await Inventory.findByIdAndUpdate(
        inventoryItemId,
        {
          stock: newQuantity,
          $inc: { totalTransactions: 1 },
          lastUpdated: new Date(),
          lastTransactionAt: new Date()
        },
        { session }
      );

      // Update cost tracking for IN transactions
      if (transactionType === 'IN' || transactionType === 'REORDER') {
        const totalCost = (inventoryItem.totalCost || 0) + (unitCost * Math.abs(quantity));
        const totalStock = newQuantity;
        const averageCost = totalStock > 0 ? totalCost / totalStock : unitCost;

        await Inventory.findByIdAndUpdate(
          inventoryItemId,
          {
            totalCost,
            averageCost,
            lastPurchasePrice: unitCost,
            lastPurchaseDate: new Date()
          },
          { session }
        );
      }

      await session.commitTransaction();

      // Populate the transaction for return
      return await StockMovement.findById(transaction._id)
        .populate('inventoryItemId', 'name category stock')
        .populate('performedBy', 'name role')
        .populate('approvedBy', 'name role');

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get transaction history with filters
   * @param {Object} filters - Query filters
   * @returns {Promise<Object>} Paginated transaction history
   */
  static async getTransactionHistory(filters = {}) {
    const {
      hotelId,
      inventoryItemId,
      transactionType,
      performedBy,
      startDate,
      endDate,
      status,
      page = 1,
      limit = 50,
      sortBy = 'timestamps.created',
      sortOrder = -1
    } = filters;

    // Build query
    const query = { hotelId };

    if (inventoryItemId) query.inventoryItemId = inventoryItemId;
    if (transactionType) query.transactionType = transactionType;
    if (performedBy) query.performedBy = performedBy;
    if (status) query.status = status;

    if (startDate || endDate) {
      query['timestamps.created'] = {};
      if (startDate) query['timestamps.created'].$gte = new Date(startDate);
      if (endDate) query['timestamps.created'].$lte = new Date(endDate);
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder };

    // Get transactions
    const [transactions, totalCount] = await Promise.all([
      StockMovement.find(query)
        .populate('inventoryItemId', 'name category stock unit')
        .populate('performedBy', 'name role')
        .populate('approvedBy', 'name role')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      StockMovement.countDocuments(query)
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    };
  }

  /**
   * Get transactions for a specific inventory item
   * @param {String} itemId - Inventory item ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Item transactions
   */
  static async getItemTransactions(itemId, options = {}) {
    const {
      hotelId,
      startDate,
      endDate,
      limit = 100
    } = options;

    const query = { inventoryItemId: itemId };
    if (hotelId) query.hotelId = hotelId;

    if (startDate || endDate) {
      query['timestamps.created'] = {};
      if (startDate) query['timestamps.created'].$gte = new Date(startDate);
      if (endDate) query['timestamps.created'].$lte = new Date(endDate);
    }

    return await StockMovement.find(query)
      .populate('performedBy', 'name role')
      .populate('approvedBy', 'name role')
      .sort({ 'timestamps.created': -1 })
      .limit(limit);
  }

  /**
   * Get transaction summary analytics
   * @param {String} hotelId - Hotel ID
   * @param {Object} filters - Analytics filters
   * @returns {Promise<Object>} Transaction analytics
   */
  static async getTransactionSummary(hotelId, filters = {}) {
    const { startDate, endDate, category } = filters;

    // Build match stage
    const matchStage = { hotelId: mongoose.Types.ObjectId(hotelId), status: 'completed' };

    if (startDate || endDate) {
      matchStage['timestamps.created'] = {};
      if (startDate) matchStage['timestamps.created'].$gte = new Date(startDate);
      if (endDate) matchStage['timestamps.created'].$lte = new Date(endDate);
    }

    // Get basic transaction summary
    const basicSummary = await StockMovement.getTransactionSummary(hotelId, matchStage);

    // Get category breakdown
    const categoryPipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'inventories',
          localField: 'inventoryItemId',
          foreignField: '_id',
          as: 'item'
        }
      },
      { $unwind: '$item' },
      {
        $group: {
          _id: '$item.category',
          transactionCount: { $sum: 1 },
          totalQuantity: { $sum: { $abs: '$quantity' } },
          totalValue: { $sum: '$totalCost' },
          inQuantity: {
            $sum: {
              $cond: [{ $in: ['$transactionType', ['IN', 'REORDER']] }, '$quantity', 0]
            }
          },
          outQuantity: {
            $sum: {
              $cond: [{ $in: ['$transactionType', ['OUT', 'CONSUMPTION']] }, { $abs: '$quantity' }, 0]
            }
          }
        }
      },
      { $sort: { totalValue: -1 } }
    ];

    const categoryBreakdown = await StockMovement.aggregate(categoryPipeline);

    // Get top active items
    const topItemsPipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: '$inventoryItemId',
          transactionCount: { $sum: 1 },
          totalQuantity: { $sum: { $abs: '$quantity' } },
          totalValue: { $sum: '$totalCost' }
        }
      },
      {
        $lookup: {
          from: 'inventories',
          localField: '_id',
          foreignField: '_id',
          as: 'item'
        }
      },
      { $unwind: '$item' },
      {
        $project: {
          itemName: '$item.name',
          category: '$item.category',
          transactionCount: 1,
          totalQuantity: 1,
          totalValue: 1
        }
      },
      { $sort: { transactionCount: -1 } },
      { $limit: 10 }
    ];

    const topActiveItems = await StockMovement.aggregate(topItemsPipeline);

    // Get daily trends
    const trendsPipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$timestamps.created'
              }
            }
          },
          transactionCount: { $sum: 1 },
          totalValue: { $sum: '$totalCost' },
          inTransactions: {
            $sum: {
              $cond: [{ $in: ['$transactionType', ['IN', 'REORDER']] }, 1, 0]
            }
          },
          outTransactions: {
            $sum: {
              $cond: [{ $in: ['$transactionType', ['OUT', 'CONSUMPTION']] }, 1, 0]
            }
          }
        }
      },
      { $sort: { '_id.date': 1 } },
      { $limit: 30 }
    ];

    const dailyTrends = await StockMovement.aggregate(trendsPipeline);

    return {
      summary: basicSummary,
      categoryBreakdown,
      topActiveItems,
      dailyTrends
    };
  }

  /**
   * Reconcile inventory - compare physical vs system counts
   * @param {Object} reconciliationData - Reconciliation details
   * @returns {Promise<Object>} Reconciliation results
   */
  static async reconcileInventory(reconciliationData) {
    const {
      hotelId,
      itemCounts, // Array of { itemId, physicalCount }
      performedBy,
      notes = 'Inventory reconciliation'
    } = reconciliationData;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const reconciliationResults = [];
      const transactions = [];

      for (const itemCount of itemCounts) {
        const { itemId, physicalCount } = itemCount;

        // Get current system count
        const inventoryItem = await Inventory.findById(itemId).session(session);
        if (!inventoryItem) {
          continue; // Skip if item not found
        }

        const systemCount = inventoryItem.stock || 0;
        const variance = physicalCount - systemCount;

        // Only create transaction if there's a variance
        if (Math.abs(variance) > 0.001) {
          const transactionType = variance > 0 ? 'ADJUSTMENT' : 'ADJUSTMENT';

          const transaction = await this.logTransaction({
            hotelId,
            inventoryItemId: itemId,
            transactionType,
            quantity: variance,
            reason: `Reconciliation adjustment - Physical: ${physicalCount}, System: ${systemCount}`,
            reference: {
              type: 'reconciliation',
              description: notes
            },
            performedBy,
            metadata: {
              reconciliation: true,
              physicalCount,
              systemCount,
              variance
            }
          });

          transactions.push(transaction);
        }

        reconciliationResults.push({
          itemId,
          itemName: inventoryItem.name,
          systemCount,
          physicalCount,
          variance,
          variancePercentage: systemCount > 0 ? ((variance / systemCount) * 100).toFixed(2) : 0,
          adjusted: Math.abs(variance) > 0.001
        });
      }

      await session.commitTransaction();

      return {
        results: reconciliationResults,
        transactions,
        summary: {
          totalItems: reconciliationResults.length,
          itemsAdjusted: reconciliationResults.filter(r => r.adjusted).length,
          totalVariance: reconciliationResults.reduce((sum, r) => sum + Math.abs(r.variance), 0)
        }
      };

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Generate transaction report
   * @param {Object} reportParams - Report parameters
   * @returns {Promise<Object>} Generated report
   */
  static async generateTransactionReport(reportParams) {
    const {
      hotelId,
      startDate,
      endDate,
      reportType = 'summary', // summary, detailed, category, user
      format = 'json' // json, csv
    } = reportParams;

    const baseQuery = {
      hotelId: mongoose.Types.ObjectId(hotelId),
      status: 'completed'
    };

    if (startDate || endDate) {
      baseQuery['timestamps.created'] = {};
      if (startDate) baseQuery['timestamps.created'].$gte = new Date(startDate);
      if (endDate) baseQuery['timestamps.created'].$lte = new Date(endDate);
    }

    let reportData;

    switch (reportType) {
      case 'summary':
        reportData = await this.getTransactionSummary(hotelId, { startDate, endDate });
        break;

      case 'detailed':
        const detailedTransactions = await StockMovement.find(baseQuery)
          .populate('inventoryItemId', 'name category stock unit')
          .populate('performedBy', 'name role')
          .sort({ 'timestamps.created': -1 });

        reportData = {
          transactions: detailedTransactions,
          totalTransactions: detailedTransactions.length,
          totalValue: detailedTransactions.reduce((sum, t) => sum + t.totalCost, 0)
        };
        break;

      case 'category':
        const categoryPipeline = [
          { $match: baseQuery },
          {
            $lookup: {
              from: 'inventories',
              localField: 'inventoryItemId',
              foreignField: '_id',
              as: 'item'
            }
          },
          { $unwind: '$item' },
          {
            $group: {
              _id: {
                category: '$item.category',
                transactionType: '$transactionType'
              },
              count: { $sum: 1 },
              totalQuantity: { $sum: { $abs: '$quantity' } },
              totalValue: { $sum: '$totalCost' }
            }
          },
          { $sort: { '_id.category': 1, '_id.transactionType': 1 } }
        ];

        reportData = await StockMovement.aggregate(categoryPipeline);
        break;

      case 'user':
        const userPipeline = [
          { $match: baseQuery },
          {
            $group: {
              _id: '$performedBy',
              transactionCount: { $sum: 1 },
              totalValue: { $sum: '$totalCost' },
              transactionTypes: { $addToSet: '$transactionType' }
            }
          },
          {
            $lookup: {
              from: 'users',
              localField: '_id',
              foreignField: '_id',
              as: 'user'
            }
          },
          { $unwind: '$user' },
          {
            $project: {
              userName: '$user.name',
              userRole: '$user.role',
              transactionCount: 1,
              totalValue: 1,
              transactionTypes: 1
            }
          },
          { $sort: { transactionCount: -1 } }
        ];

        reportData = await StockMovement.aggregate(userPipeline);
        break;

      default:
        throw new Error('Invalid report type');
    }

    return {
      reportType,
      generatedAt: new Date(),
      parameters: reportParams,
      data: reportData
    };
  }

  /**
   * Bulk import transactions from CSV data
   * @param {Array} csvData - Array of transaction objects
   * @param {String} hotelId - Hotel ID
   * @param {String} performedBy - User performing the import
   * @returns {Promise<Object>} Import results
   */
  static async bulkTransactionImport(csvData, hotelId, performedBy) {
    const results = {
      successful: 0,
      failed: 0,
      errors: []
    };

    for (let i = 0; i < csvData.length; i++) {
      try {
        const row = csvData[i];

        // Validate required fields
        if (!row.inventoryItemId || !row.transactionType || !row.quantity) {
          throw new Error('Missing required fields');
        }

        await this.logTransaction({
          hotelId,
          inventoryItemId: row.inventoryItemId,
          transactionType: row.transactionType,
          quantity: parseFloat(row.quantity),
          reason: row.reason || 'Bulk import',
          unitCost: parseFloat(row.unitCost) || 0,
          performedBy,
          reference: {
            type: 'manual',
            description: 'Bulk CSV import'
          },
          metadata: {
            importRow: i + 1,
            originalData: row
          }
        });

        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          error: error.message,
          data: csvData[i]
        });
      }
    }

    return results;
  }

  /**
   * Validate transaction data
   * @param {Object} transactionData - Transaction data to validate
   * @returns {Object} Validation result
   */
  static validateTransaction(transactionData) {
    const errors = [];
    const {
      hotelId,
      inventoryItemId,
      transactionType,
      quantity,
      reason,
      performedBy
    } = transactionData;

    // Required field validation
    if (!hotelId) errors.push('Hotel ID is required');
    if (!inventoryItemId) errors.push('Inventory Item ID is required');
    if (!transactionType) errors.push('Transaction type is required');
    if (quantity === undefined || quantity === null) errors.push('Quantity is required');
    if (!reason) errors.push('Reason is required');
    if (!performedBy) errors.push('Performed by user is required');

    // Type validation
    const validTypes = ['IN', 'OUT', 'TRANSFER', 'ADJUSTMENT', 'REORDER', 'CONSUMPTION'];
    if (transactionType && !validTypes.includes(transactionType)) {
      errors.push('Invalid transaction type');
    }

    // Quantity validation
    if (typeof quantity !== 'number' || isNaN(quantity)) {
      errors.push('Quantity must be a valid number');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export default TransactionService;