import InventoryItem from '../models/InventoryItem.js';
import Vendor from '../models/Vendor.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import InventoryTransaction from '../models/InventoryTransaction.js';
import User from '../models/User.js';
import SmartReorderService from './smartReorderService.js';
import mongoose from 'mongoose';
import cron from 'node-cron';

/**
 * Automated Inventory Workflow Engine
 * Handles intelligent automation rules and workflows for inventory management:
 * - Automatic reorder processing
 * - Approval workflow automation
 * - Consumption pattern analysis
 * - Integration with hotel operations
 * - Budget-aware automation
 * - Exception handling and escalation
 */
class InventoryWorkflowService {
  constructor() {
    this.logger = console; // Replace with proper logger in production
    this.smartReorderService = new SmartReorderService();

    // Workflow configuration
    this.config = {
      autoApprovalThresholds: {
        'cleaning': 5000,      // Auto-approve cleaning supplies up to ₹5,000
        'toiletries': 7500,    // Auto-approve toiletries up to ₹7,500
        'linens': 15000,       // Auto-approve linens up to ₹15,000
        'electronics': 25000,  // Auto-approve electronics up to ₹25,000
        'furniture': 50000,    // Auto-approve furniture up to ₹50,000
        'default': 10000       // Default auto-approval limit
      },
      urgencyMultipliers: {
        'critical': 2.0,       // Double the auto-approval threshold for critical items
        'high': 1.5,
        'medium': 1.0,
        'low': 0.8
      },
      consumptionTrackingPeriod: 30, // Days to look back for consumption patterns
      reorderCheckInterval: '0 8 * * *', // Daily at 8 AM
      budgetCheckInterval: '0 9 * * 1', // Weekly on Monday at 9 AM
      escalationRules: {
        overbudgetThreshold: 0.9, // 90% of budget triggers escalation
        highValueThreshold: 50000, // Orders above ₹50,000 need manager approval
        velocityThreshold: 5 // Items consumed 5x faster than normal
      }
    };

    // Initialize scheduled tasks
    this.initializeScheduledTasks();
  }

  /**
   * Initialize automated scheduled tasks
   */
  initializeScheduledTasks() {
    // Daily reorder check
    cron.schedule(this.config.reorderCheckInterval, async () => {
      this.logger.info('Running scheduled reorder check...');
      await this.processAutomaticReorders();
    });

    // Weekly budget analysis
    cron.schedule(this.config.budgetCheckInterval, async () => {
      this.logger.info('Running weekly budget analysis...');
      await this.performBudgetAnalysis();
    });

    // Hourly consumption tracking update
    cron.schedule('0 * * * *', async () => {
      await this.updateConsumptionPatterns();
    });
  }

  /**
   * Process automatic reorders for all hotels
   */
  async processAutomaticReorders() {
    try {
      // Get all active hotels
      const hotels = await this.getActiveHotels();

      for (const hotel of hotels) {
        try {
          await this.processHotelReorders(hotel._id);
        } catch (error) {
          this.logger.error(`Error processing reorders for hotel ${hotel._id}:`, error);
        }
      }

    } catch (error) {
      this.logger.error('Error in processAutomaticReorders:', error);
    }
  }

  /**
   * Process reorders for a specific hotel
   */
  async processHotelReorders(hotelId) {
    try {
      this.logger.info(`Processing reorders for hotel ${hotelId}`);

      // Get reorder recommendations
      const recommendations = await this.smartReorderService.analyzeReorderNeeds(hotelId, {
        urgencyThreshold: 0.25,
        prioritizePreferred: true,
        includeSeasonalFactors: true
      });

      if (!recommendations.success || recommendations.recommendations.length === 0) {
        this.logger.info(`No reorders needed for hotel ${hotelId}`);
        return;
      }

      // Filter recommendations for auto-approval
      const autoApprovableRecommendations = recommendations.recommendations.filter(rec =>
        this.canAutoApprove(rec)
      );

      const manualApprovalRecommendations = recommendations.recommendations.filter(rec =>
        !this.canAutoApprove(rec)
      );

      // Process auto-approvable reorders
      if (autoApprovableRecommendations.length > 0) {
        const autoResults = await this.smartReorderService.createPurchaseOrdersFromRecommendations(
          hotelId,
          autoApprovableRecommendations,
          await this.getSystemUserId(hotelId)
        );

        this.logger.info(`Auto-approved ${autoResults.successfulPOs} POs for hotel ${hotelId}`);

        // Send notification about auto-approved orders
        await this.sendAutoApprovalNotification(hotelId, autoResults);
      }

      // Create alerts for manual approval items
      if (manualApprovalRecommendations.length > 0) {
        await this.createReorderAlerts(hotelId, manualApprovalRecommendations);
        this.logger.info(`Created ${manualApprovalRecommendations.length} reorder alerts for manual approval`);
      }

    } catch (error) {
      this.logger.error(`Error processing hotel reorders for ${hotelId}:`, error);
      throw error;
    }
  }

  /**
   * Check if a recommendation can be auto-approved
   */
  canAutoApprove(recommendation) {
    const category = recommendation.category;
    const urgencyLevel = recommendation.urgencyLevel;
    const estimatedCost = recommendation.estimatedCost;

    // Get base auto-approval threshold for category
    const baseThreshold = this.config.autoApprovalThresholds[category] ||
                         this.config.autoApprovalThresholds.default;

    // Apply urgency multiplier
    const urgencyMultiplier = this.config.urgencyMultipliers[urgencyLevel] || 1.0;
    const adjustedThreshold = baseThreshold * urgencyMultiplier;

    // Check if cost is within threshold
    const withinThreshold = estimatedCost <= adjustedThreshold;

    // Additional checks
    const hasLowRisk = recommendation.riskFactors.length === 0 ||
                      recommendation.riskFactors.every(risk => risk.severity === 'low');

    const vendorReliable = recommendation.vendor.rating >= 4.0 &&
                          recommendation.vendor.onTimeDeliveryRate >= 85;

    return withinThreshold && hasLowRisk && vendorReliable;
  }

  /**
   * Integrate with housekeeping operations
   */
  async syncWithHousekeeping(hotelId, roomId, completedTasks) {
    try {
      this.logger.info(`Syncing inventory with housekeeping for room ${roomId}`);

      const consumedItems = [];

      // Map housekeeping tasks to inventory consumption
      for (const task of completedTasks) {
        const consumption = await this.mapTaskToInventoryConsumption(task);
        if (consumption && consumption.length > 0) {
          consumedItems.push(...consumption);
        }
      }

      if (consumedItems.length === 0) {
        return { success: true, movementsCreated: 0 };
      }

      // Create inventory movements for consumed items
      let movementsCreated = 0;
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        for (const consumed of consumedItems) {
          const item = await InventoryItem.findById(consumed.itemId).session(session);
          if (!item) continue;

          const previousStock = item.currentStock;
          const newStock = Math.max(0, previousStock - consumed.quantity);

          // Update stock
          await InventoryItem.findByIdAndUpdate(
            consumed.itemId,
            { currentStock: newStock },
            { session }
          );

          // Create transaction record
          const transaction = new InventoryTransaction({
            hotelId: new mongoose.Types.ObjectId(hotelId),
            inventoryItemId: consumed.itemId,
            itemName: item.name,
            movementType: 'OUT',
            quantity: -consumed.quantity,
            previousStock,
            newStock,
            unitPrice: item.unitPrice,
            totalValue: consumed.quantity * item.unitPrice,
            reason: `Housekeeping consumption - Room ${roomId}`,
            referenceType: 'housekeeping',
            referenceId: roomId,
            performedBy: await this.getSystemUserId(hotelId),
            location: `Room ${roomId}`,
            notes: `Auto-tracked: ${consumed.taskType}`,
            metadata: {
              source: 'housekeeping_integration',
              roomId,
              taskType: consumed.taskType,
              automated: true
            }
          });

          await transaction.save({ session });
          movementsCreated++;

          // Check if this triggers a reorder
          if (newStock <= item.stockThreshold) {
            await this.checkAndTriggerReorder(item, hotelId);
          }
        }

        await session.commitTransaction();

        this.logger.info(`Created ${movementsCreated} inventory movements for housekeeping sync`);

        return { success: true, movementsCreated };

      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }

    } catch (error) {
      this.logger.error('Error syncing with housekeeping:', error);
      throw new Error(`Housekeeping sync failed: ${error.message}`);
    }
  }

  /**
   * Integrate with maintenance operations
   */
  async syncWithMaintenance(hotelId, taskId, completedTask) {
    try {
      this.logger.info(`Syncing inventory with maintenance for task ${taskId}`);

      // Map maintenance task to supply consumption
      const usedSupplies = await this.mapMaintenanceToSupplyUsage(completedTask);

      if (usedSupplies.length === 0) {
        return { success: true, movementsCreated: 0 };
      }

      let movementsCreated = 0;
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        for (const supply of usedSupplies) {
          const item = await InventoryItem.findById(supply.itemId).session(session);
          if (!item) continue;

          const previousStock = item.currentStock;
          const newStock = Math.max(0, previousStock - supply.quantity);

          // Update stock
          await InventoryItem.findByIdAndUpdate(
            supply.itemId,
            { currentStock: newStock },
            { session }
          );

          // Create transaction record
          const transaction = new InventoryTransaction({
            hotelId: new mongoose.Types.ObjectId(hotelId),
            inventoryItemId: supply.itemId,
            itemName: item.name,
            movementType: 'OUT',
            quantity: -supply.quantity,
            previousStock,
            newStock,
            unitPrice: item.unitPrice,
            totalValue: supply.quantity * item.unitPrice,
            reason: `Maintenance usage - ${completedTask.type}`,
            referenceType: 'maintenance',
            referenceId: taskId,
            performedBy: completedTask.completedBy || await this.getSystemUserId(hotelId),
            location: completedTask.location || 'Hotel',
            notes: `Auto-tracked: ${completedTask.description}`,
            metadata: {
              source: 'maintenance_integration',
              taskId,
              taskType: completedTask.type,
              automated: true
            }
          });

          await transaction.save({ session });
          movementsCreated++;

          // Check if this triggers a reorder
          if (newStock <= item.stockThreshold) {
            await this.checkAndTriggerReorder(item, hotelId);
          }
        }

        await session.commitTransaction();

        this.logger.info(`Created ${movementsCreated} inventory movements for maintenance sync`);

        return { success: true, movementsCreated };

      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }

    } catch (error) {
      this.logger.error('Error syncing with maintenance:', error);
      throw new Error(`Maintenance sync failed: ${error.message}`);
    }
  }

  /**
   * Guest service consumption tracking
   */
  async trackGuestServiceConsumption(hotelId, guestId, serviceType, consumedItems) {
    try {
      this.logger.info(`Tracking guest service consumption for guest ${guestId}`);

      let movementsCreated = 0;
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        for (const consumed of consumedItems) {
          const item = await InventoryItem.findById(consumed.itemId).session(session);
          if (!item) continue;

          const previousStock = item.currentStock;
          const newStock = Math.max(0, previousStock - consumed.quantity);

          // Update stock
          await InventoryItem.findByIdAndUpdate(
            consumed.itemId,
            { currentStock: newStock },
            { session }
          );

          // Create transaction record
          const transaction = new InventoryTransaction({
            hotelId: new mongoose.Types.ObjectId(hotelId),
            inventoryItemId: consumed.itemId,
            itemName: item.name,
            movementType: 'OUT',
            quantity: -consumed.quantity,
            previousStock,
            newStock,
            unitPrice: item.unitPrice,
            totalValue: consumed.quantity * item.unitPrice,
            reason: `Guest service consumption - ${serviceType}`,
            referenceType: 'guest_service',
            referenceId: guestId,
            performedBy: await this.getSystemUserId(hotelId),
            location: 'Guest Service',
            notes: `Auto-tracked guest service: ${serviceType}`,
            metadata: {
              source: 'guest_service_integration',
              guestId,
              serviceType,
              automated: true,
              chargeable: consumed.chargeable || false
            }
          });

          await transaction.save({ session });
          movementsCreated++;

          // For chargeable items, you might want to create billing entries
          if (consumed.chargeable) {
            await this.createGuestBillingEntry(hotelId, guestId, consumed, transaction);
          }

          // Check if this triggers a reorder
          if (newStock <= item.stockThreshold) {
            await this.checkAndTriggerReorder(item, hotelId);
          }
        }

        await session.commitTransaction();

        return { success: true, movementsCreated };

      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }

    } catch (error) {
      this.logger.error('Error tracking guest service consumption:', error);
      throw error;
    }
  }

  /**
   * Update consumption patterns based on historical data
   */
  async updateConsumptionPatterns() {
    try {
      const hotels = await this.getActiveHotels();

      for (const hotel of hotels) {
        await this.updateHotelConsumptionPatterns(hotel._id);
      }

    } catch (error) {
      this.logger.error('Error updating consumption patterns:', error);
    }
  }

  /**
   * Update consumption patterns for a specific hotel
   */
  async updateHotelConsumptionPatterns(hotelId) {
    try {
      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - this.config.consumptionTrackingPeriod);

      // Analyze consumption patterns
      const consumptionData = await InventoryTransaction.aggregate([
        {
          $match: {
            hotelId: new mongoose.Types.ObjectId(hotelId),
            movementType: 'OUT',
            createdAt: { $gte: periodStart }
          }
        },
        {
          $group: {
            _id: '$inventoryItemId',
            totalConsumed: { $sum: { $abs: '$quantity' } },
            averageDaily: { $avg: { $abs: '$quantity' } },
            consumptionDays: { $addToSet: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } },
            maxDailyConsumption: { $max: { $abs: '$quantity' } },
            minDailyConsumption: { $min: { $abs: '$quantity' } }
          }
        },
        {
          $lookup: {
            from: 'inventoryitems',
            localField: '_id',
            foreignField: '_id',
            as: 'item'
          }
        },
        {
          $unwind: '$item'
        }
      ]);

      // Update consumption patterns for each item
      for (const data of consumptionData) {
        const velocityFactor = data.totalConsumed / this.config.consumptionTrackingPeriod;
        const variabilityFactor = data.maxDailyConsumption / (data.averageDaily || 1);

        // Check for unusual consumption patterns
        if (velocityFactor > this.config.escalationRules.velocityThreshold) {
          await this.createConsumptionAlert(hotelId, data.item, 'high_velocity', {
            currentVelocity: velocityFactor,
            threshold: this.config.escalationRules.velocityThreshold
          });
        }

        // Update item's consumption metadata
        await InventoryItem.findByIdAndUpdate(data._id, {
          $set: {
            'metadata.consumptionPattern': {
              averageDailyConsumption: data.averageDaily,
              totalPeriodConsumption: data.totalConsumed,
              velocityFactor,
              variabilityFactor,
              lastUpdated: new Date(),
              period: this.config.consumptionTrackingPeriod
            }
          }
        });
      }

    } catch (error) {
      this.logger.error(`Error updating consumption patterns for hotel ${hotelId}:`, error);
    }
  }

  /**
   * Perform weekly budget analysis
   */
  async performBudgetAnalysis() {
    try {
      const hotels = await this.getActiveHotels();

      for (const hotel of hotels) {
        try {
          await this.analyzeHotelBudget(hotel._id);
        } catch (error) {
          this.logger.error(`Error analyzing budget for hotel ${hotel._id}:`, error);
        }
      }

    } catch (error) {
      this.logger.error('Error in performBudgetAnalysis:', error);
    }
  }

  /**
   * Analyze budget for a specific hotel
   */
  async analyzeHotelBudget(hotelId) {
    try {
      const currentMonth = new Date();
      const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);

      // Calculate current month spending
      const monthlySpending = await PurchaseOrder.aggregate([
        {
          $match: {
            hotelId: new mongoose.Types.ObjectId(hotelId),
            orderDate: { $gte: monthStart },
            status: { $in: ['approved', 'sent_to_vendor', 'confirmed_by_vendor', 'completed'] }
          }
        },
        {
          $group: {
            _id: null,
            totalSpending: { $sum: '$totalAmount' },
            orderCount: { $sum: 1 }
          }
        }
      ]);

      const currentSpending = monthlySpending[0]?.totalSpending || 0;

      // Get hotel budget (this would come from hotel settings/configuration)
      const monthlyBudget = await this.getHotelMonthlyBudget(hotelId);

      if (!monthlyBudget) {
        this.logger.warn(`No budget configured for hotel ${hotelId}`);
        return;
      }

      const budgetUtilization = currentSpending / monthlyBudget;

      // Check if approaching budget limits
      if (budgetUtilization >= this.config.escalationRules.overbudgetThreshold) {
        await this.createBudgetAlert(hotelId, {
          currentSpending,
          monthlyBudget,
          utilizationPercentage: budgetUtilization * 100,
          remainingBudget: monthlyBudget - currentSpending
        });
      }

      // Predict month-end spending based on current trend
      const dayOfMonth = new Date().getDate();
      const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
      const projectedSpending = (currentSpending / dayOfMonth) * daysInMonth;

      if (projectedSpending > monthlyBudget) {
        await this.createBudgetProjectionAlert(hotelId, {
          currentSpending,
          projectedSpending,
          monthlyBudget,
          overageAmount: projectedSpending - monthlyBudget
        });
      }

    } catch (error) {
      this.logger.error(`Error analyzing budget for hotel ${hotelId}:`, error);
    }
  }

  // Helper methods

  async getActiveHotels() {
    // Mock implementation - replace with actual hotel query
    return [
      { _id: new mongoose.Types.ObjectId() }
    ];
  }

  async getSystemUserId(hotelId) {
    // Get or create system user for automated operations
    let systemUser = await User.findOne({
      email: 'system@hotel.com',
      role: 'system'
    });

    if (!systemUser) {
      // Create system user if it doesn't exist
      systemUser = await User.create({
        firstName: 'System',
        lastName: 'Automation',
        email: 'system@hotel.com',
        role: 'system',
        isActive: true,
        hotelId: hotelId
      });
    }

    return systemUser._id;
  }

  async mapTaskToInventoryConsumption(task) {
    // Map housekeeping tasks to inventory items
    const consumptionMap = {
      'room_cleaning': [
        { category: 'cleaning', estimatedConsumption: { 'cleaning_spray': 0.1, 'toilet_paper': 1, 'towels': 0.2 } },
        { category: 'toiletries', estimatedConsumption: { 'shampoo': 0.05, 'soap': 0.1 } }
      ],
      'bathroom_cleaning': [
        { category: 'cleaning', estimatedConsumption: { 'bathroom_cleaner': 0.2, 'toilet_paper': 2 } },
        { category: 'toiletries', estimatedConsumption: { 'toilet_paper': 2, 'towels': 0.5 } }
      ],
      'bed_making': [
        { category: 'linens', estimatedConsumption: { 'bed_sheets': 0.1, 'pillowcases': 0.1 } }
      ]
    };

    const mappings = consumptionMap[task.type] || [];
    const consumedItems = [];

    for (const mapping of mappings) {
      // Find items in the category and calculate consumption
      const items = await InventoryItem.find({
        category: mapping.category,
        isActive: true
      });

      for (const item of items) {
        const consumptionRate = mapping.estimatedConsumption[item.name.toLowerCase().replace(/\s+/g, '_')] || 0;
        if (consumptionRate > 0) {
          consumedItems.push({
            itemId: item._id,
            quantity: Math.ceil(consumptionRate * (task.roomCount || 1)),
            taskType: task.type
          });
        }
      }
    }

    return consumedItems;
  }

  async mapMaintenanceToSupplyUsage(task) {
    // Map maintenance tasks to supply usage
    const supplyMap = {
      'plumbing': ['pipe_fittings', 'plumbing_tools', 'sealants'],
      'electrical': ['electrical_parts', 'cables', 'switches'],
      'hvac': ['hvac_filters', 'refrigerant', 'hvac_parts'],
      'general_maintenance': ['screws', 'bolts', 'general_tools']
    };

    const supplies = supplyMap[task.type] || supplyMap['general_maintenance'];
    const usedSupplies = [];

    for (const supplyName of supplies) {
      const item = await InventoryItem.findOne({
        name: new RegExp(supplyName.replace('_', ' '), 'i'),
        isActive: true
      });

      if (item) {
        usedSupplies.push({
          itemId: item._id,
          quantity: 1, // Basic consumption - could be made more intelligent
          supplyType: supplyName
        });
      }
    }

    return usedSupplies;
  }

  async checkAndTriggerReorder(item, hotelId) {
    // Check if automatic reorder is enabled for this item
    if (!item.reorderSettings?.autoReorderEnabled) return;

    // Create reorder alert/recommendation
    const recommendation = await this.smartReorderService.generateItemRecommendation(item);

    if (recommendation.success) {
      if (this.canAutoApprove(recommendation)) {
        // Auto-create purchase order
        await this.smartReorderService.createPurchaseOrdersFromRecommendations(
          hotelId,
          [recommendation],
          await this.getSystemUserId(hotelId)
        );
      } else {
        // Create manual approval alert
        await this.createReorderAlerts(hotelId, [recommendation]);
      }
    }
  }

  async createReorderAlerts(hotelId, recommendations) {
    // Create alerts for manual approval - implementation depends on your alert system
    for (const rec of recommendations) {
      console.log(`Creating reorder alert for ${rec.itemName} in hotel ${hotelId}`);
      // Implementation would save to alerts collection or trigger notification
    }
  }

  async createConsumptionAlert(hotelId, item, type, data) {
    console.log(`Creating consumption alert for ${item.name}: ${type}`, data);
    // Implementation would create alert in your system
  }

  async createBudgetAlert(hotelId, budgetData) {
    console.log(`Creating budget alert for hotel ${hotelId}:`, budgetData);
    // Implementation would create budget alert
  }

  async createBudgetProjectionAlert(hotelId, projectionData) {
    console.log(`Creating budget projection alert for hotel ${hotelId}:`, projectionData);
    // Implementation would create projection alert
  }

  async getHotelMonthlyBudget(hotelId) {
    // Mock implementation - replace with actual budget lookup
    return 100000; // Default monthly budget
  }

  async sendAutoApprovalNotification(hotelId, results) {
    console.log(`Sending auto-approval notification for hotel ${hotelId}:`, results);
    // Implementation would send notification to hotel managers
  }

  async createGuestBillingEntry(hotelId, guestId, consumed, transaction) {
    console.log(`Creating guest billing entry for ${consumed.itemName}`);
    // Implementation would create billing entry for chargeable items
  }
}

export default InventoryWorkflowService;