import logger from '../utils/logger.js';
import RoomInventory from '../models/RoomInventory.js';
import CheckoutInventory from '../models/CheckoutInventory.js';
import DailyRoutineCheck from '../models/DailyRoutineCheck.js';
import InventoryItem from '../models/InventoryItem.js';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import User from '../models/User.js';

/**
 * Inventory Automation Service
 * 
 * Handles automatic inventory assessment, replacement tracking, and
 * checkout inventory processing during guest checkout. This service
 * integrates with existing inventory systems to provide comprehensive
 * automated inventory management.
 */
class InventoryAutomationService {
  constructor() {
    this.inventoryCategories = {
      toiletries: ['soap', 'shampoo', 'conditioner', 'body_wash', 'toothpaste', 'toothbrush'],
      amenities: ['towels', 'bathrobes', 'slippers', 'bath_mat', 'shower_cap'],
      electronics: ['tv_remote', 'hairdryer', 'iron', 'phone', 'alarm_clock'],
      furniture: ['bed_linens', 'pillows', 'curtains', 'carpet', 'furniture'],
      cleaning: ['cleaning_supplies', 'vacuum', 'mop', 'broom'],
      other: ['magazines', 'brochures', 'stationery', 'safety_equipment']
    };
    
    this.conditionThresholds = {
      excellent: 100,
      good: 80,
      fair: 60,
      worn: 40,
      damaged: 20,
      missing: 0
    };
  }

  /**
   * Process comprehensive inventory automation for checkout
   * @param {string} bookingId - Booking ID
   * @param {string} roomId - Room ID
   * @param {string} processedBy - User ID who processed
   * @param {Object} options - Processing options
   */
  async processCheckoutInventory(bookingId, roomId, processedBy, options = {}) {
    try {
      logger.info('Starting comprehensive inventory automation', {
        bookingId,
        roomId,
        processedBy
      });

      const results = {
        bookingId,
        roomId,
        processedBy,
        timestamp: new Date(),
        steps: []
      };

      // Step 1: Assess current room inventory
      const inventoryAssessment = await this.assessRoomInventory(roomId, options);
      results.steps.push({
        step: 'inventory_assessment',
        success: true,
        data: inventoryAssessment,
        timestamp: new Date()
      });

      // Step 2: Create checkout inventory record
      const checkoutInventory = await this.createCheckoutInventoryRecord(
        bookingId,
        roomId,
        processedBy,
        inventoryAssessment,
        options
      );
      results.steps.push({
        step: 'checkout_inventory_creation',
        success: true,
        data: { checkoutInventoryId: checkoutInventory._id },
        timestamp: new Date()
      });

      // Step 3: Identify items needing replacement
      const replacementItems = await this.identifyReplacementItems(
        roomId,
        inventoryAssessment,
        options
      );
      results.steps.push({
        step: 'replacement_identification',
        success: true,
        data: replacementItems,
        timestamp: new Date()
      });

      // Step 4: Update room inventory status
      const inventoryUpdate = await this.updateRoomInventoryStatus(
        roomId,
        inventoryAssessment,
        replacementItems,
        processedBy
      );
      results.steps.push({
        step: 'inventory_status_update',
        success: true,
        data: inventoryUpdate,
        timestamp: new Date()
      });

      // Step 5: Create daily routine check if needed
      const routineCheck = await this.createDailyRoutineCheck(
        roomId,
        inventoryAssessment,
        processedBy,
        options
      );
      results.steps.push({
        step: 'daily_routine_check',
        success: true,
        data: routineCheck,
        timestamp: new Date()
      });

      // Step 6: Generate inventory report
      const inventoryReport = await this.generateInventoryReport(
        roomId,
        inventoryAssessment,
        replacementItems,
        options
      );
      results.steps.push({
        step: 'inventory_report',
        success: true,
        data: inventoryReport,
        timestamp: new Date()
      });

      results.success = true;
      results.summary = this.generateInventorySummary(results.steps);

      logger.info('Inventory automation completed successfully', {
        bookingId,
        roomId,
        summary: results.summary
      });

      return results;

    } catch (error) {
      logger.error('Inventory automation failed', {
        bookingId,
        roomId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Assess current room inventory condition
   * @param {string} roomId - Room ID
   * @param {Object} options - Assessment options
   */
  async assessRoomInventory(roomId, options = {}) {
    try {
      const roomInventory = await RoomInventory.findOne({ roomId })
        .populate('items.itemId', 'name category unitPrice replacementPrice')
        .populate('roomId', 'roomNumber type floor');

      if (!roomInventory) {
        throw new Error('Room inventory not found');
      }

      const assessment = {
        roomId,
        roomNumber: roomInventory.roomId.roomNumber,
        roomType: roomInventory.roomId.type,
        floor: roomInventory.roomId.floor,
        currentStatus: roomInventory.status,
        lastInspectionDate: roomInventory.lastInspectionDate,
        assessmentDate: new Date(),
        items: [],
        summary: {
          totalItems: roomInventory.items.length,
          itemsInGoodCondition: 0,
          itemsNeedingReplacement: 0,
          itemsMissing: 0,
          itemsDamaged: 0,
          overallConditionScore: 0,
          estimatedReplacementCost: 0
        }
      };

      let totalScore = 0;
      let replacementCost = 0;

      for (const item of roomInventory.items) {
        const itemAssessment = {
          itemId: item.itemId._id,
          itemName: item.itemId.name,
          category: item.itemId.category,
          currentQuantity: item.currentQuantity,
          expectedQuantity: item.expectedQuantity,
          condition: item.condition,
          conditionScore: this.conditionThresholds[item.condition] || 0,
          needsReplacement: item.needsReplacement,
          replacementReason: item.replacementReason,
          unitPrice: item.itemId.unitPrice,
          replacementPrice: item.itemId.replacementPrice,
          location: item.location,
          lastCheckedDate: item.lastCheckedDate,
          notes: item.notes,
          assessment: this.assessItemCondition(item)
        };

        assessment.items.push(itemAssessment);
        totalScore += itemAssessment.conditionScore;

        // Update summary counts
        if (item.condition === 'excellent' || item.condition === 'good') {
          assessment.summary.itemsInGoodCondition++;
        }
        if (item.needsReplacement || item.condition === 'damaged' || item.condition === 'missing') {
          assessment.summary.itemsNeedingReplacement++;
          replacementCost += (item.itemId.replacementPrice || item.itemId.unitPrice || 0);
        }
        if (item.condition === 'missing') {
          assessment.summary.itemsMissing++;
        }
        if (item.condition === 'damaged') {
          assessment.summary.itemsDamaged++;
        }
      }

      assessment.summary.overallConditionScore = assessment.items.length > 0 
        ? Math.round(totalScore / assessment.items.length) 
        : 0;
      assessment.summary.estimatedReplacementCost = replacementCost;

      // Add intelligent insights
      assessment.insights = this.generateInventoryInsights(assessment);

      return assessment;

    } catch (error) {
      logger.error('Room inventory assessment failed', {
        roomId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Assess individual item condition
   * @param {Object} item - Room inventory item
   */
  assessItemCondition(item) {
    const assessment = {
      status: 'good',
      priority: 'low',
      action: 'none',
      reason: null,
      estimatedCost: 0
    };

    // Check quantity discrepancies
    if (item.currentQuantity < item.expectedQuantity) {
      assessment.status = 'missing_items';
      assessment.priority = 'high';
      assessment.action = 'replenish';
      assessment.reason = `Missing ${item.expectedQuantity - item.currentQuantity} items`;
      assessment.estimatedCost = (item.expectedQuantity - item.currentQuantity) * (item.itemId?.unitPrice || 0);
    }

    // Check condition
    switch (item.condition) {
      case 'excellent':
        assessment.status = 'excellent';
        assessment.priority = 'low';
        assessment.action = 'none';
        break;
      case 'good':
        assessment.status = 'good';
        assessment.priority = 'low';
        assessment.action = 'monitor';
        break;
      case 'fair':
        assessment.status = 'fair';
        assessment.priority = 'medium';
        assessment.action = 'schedule_replacement';
        assessment.reason = 'Item showing signs of wear';
        assessment.estimatedCost = item.itemId?.replacementPrice || item.itemId?.unitPrice || 0;
        break;
      case 'worn':
        assessment.status = 'worn';
        assessment.priority = 'high';
        assessment.action = 'replace_soon';
        assessment.reason = 'Item is worn and needs replacement';
        assessment.estimatedCost = item.itemId?.replacementPrice || item.itemId?.unitPrice || 0;
        break;
      case 'damaged':
        assessment.status = 'damaged';
        assessment.priority = 'urgent';
        assessment.action = 'replace_immediately';
        assessment.reason = 'Item is damaged and needs immediate replacement';
        assessment.estimatedCost = item.itemId?.replacementPrice || item.itemId?.unitPrice || 0;
        break;
      case 'missing':
        assessment.status = 'missing';
        assessment.priority = 'urgent';
        assessment.action = 'replace_immediately';
        assessment.reason = 'Item is completely missing';
        assessment.estimatedCost = item.itemId?.replacementPrice || item.itemId?.unitPrice || 0;
        break;
    }

    // Check if already flagged for replacement
    if (item.needsReplacement) {
      assessment.priority = 'high';
      assessment.action = 'replace_immediately';
      assessment.reason = item.replacementReason || 'Previously flagged for replacement';
    }

    return assessment;
  }

  /**
   * Generate intelligent insights from inventory assessment
   * @param {Object} assessment - Inventory assessment
   */
  generateInventoryInsights(assessment) {
    const insights = [];

    // Overall condition insights
    if (assessment.summary.overallConditionScore >= 90) {
      insights.push({
        type: 'positive',
        message: 'Room inventory is in excellent condition',
        priority: 'low'
      });
    } else if (assessment.summary.overallConditionScore >= 70) {
      insights.push({
        type: 'neutral',
        message: 'Room inventory is in good condition with minor issues',
        priority: 'medium'
      });
    } else if (assessment.summary.overallConditionScore >= 50) {
      insights.push({
        type: 'warning',
        message: 'Room inventory needs attention - several items require replacement',
        priority: 'high'
      });
    } else {
      insights.push({
        type: 'critical',
        message: 'Room inventory is in poor condition - immediate action required',
        priority: 'urgent'
      });
    }

    // Missing items insights
    if (assessment.summary.itemsMissing > 0) {
      insights.push({
        type: 'warning',
        message: `${assessment.summary.itemsMissing} items are missing and need immediate replacement`,
        priority: 'high'
      });
    }

    // Damaged items insights
    if (assessment.summary.itemsDamaged > 0) {
      insights.push({
        type: 'warning',
        message: `${assessment.summary.itemsDamaged} items are damaged and need replacement`,
        priority: 'high'
      });
    }

    // Cost insights
    if (assessment.summary.estimatedReplacementCost > 1000) {
      insights.push({
        type: 'cost',
        message: `High replacement cost: ₹${assessment.summary.estimatedReplacementCost.toLocaleString()}`,
        priority: 'medium'
      });
    }

    // Category-specific insights
    const categoryIssues = {};
    assessment.items.forEach(item => {
      if (item.assessment.priority === 'high' || item.assessment.priority === 'urgent') {
        if (!categoryIssues[item.category]) {
          categoryIssues[item.category] = 0;
        }
        categoryIssues[item.category]++;
      }
    });

    Object.entries(categoryIssues).forEach(([category, count]) => {
      insights.push({
        type: 'category',
        message: `${count} items in ${category} category need attention`,
        priority: 'medium',
        category
      });
    });

    return insights;
  }

  /**
   * Create checkout inventory record
   * @param {string} bookingId - Booking ID
   * @param {string} roomId - Room ID
   * @param {string} processedBy - User ID
   * @param {Object} assessment - Inventory assessment
   * @param {Object} options - Processing options
   */
  async createCheckoutInventoryRecord(bookingId, roomId, processedBy, assessment, options = {}) {
    try {
      const items = assessment.items.map(item => ({
        itemName: item.itemName,
        category: item.category,
        quantity: item.currentQuantity,
        unitPrice: item.unitPrice || 0,
        totalPrice: (item.unitPrice || 0) * item.currentQuantity,
        status: this.mapConditionToStatus(item.condition),
        notes: item.assessment.reason || item.notes || ''
      }));

      const checkoutInventory = new CheckoutInventory({
        bookingId,
        roomId,
        checkedBy: processedBy,
        items,
        status: 'completed',
        notes: `Automatic checkout inventory assessment - Overall score: ${assessment.summary.overallConditionScore}/100`,
        isAdminBypass: options.isAdminBypass || false
      });

      await checkoutInventory.save();

      logger.info('Checkout inventory record created', {
        checkoutInventoryId: checkoutInventory._id,
        bookingId,
        roomId,
        itemCount: items.length
      });

      return checkoutInventory;

    } catch (error) {
      logger.error('Failed to create checkout inventory record', {
        bookingId,
        roomId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Map condition to checkout inventory status
   * @param {string} condition - Item condition
   */
  mapConditionToStatus(condition) {
    switch (condition) {
      case 'excellent':
      case 'good':
        return 'intact';
      case 'fair':
      case 'worn':
        return 'used';
      case 'damaged':
        return 'damaged';
      case 'missing':
        return 'missing';
      default:
        return 'intact';
    }
  }

  /**
   * Identify items needing replacement
   * @param {string} roomId - Room ID
   * @param {Object} assessment - Inventory assessment
   * @param {Object} options - Processing options
   */
  async identifyReplacementItems(roomId, assessment, options = {}) {
    try {
      const replacementItems = assessment.items.filter(item => 
        item.assessment.priority === 'high' || 
        item.assessment.priority === 'urgent' ||
        item.needsReplacement
      );

      const replacementPlan = {
        roomId,
        totalItems: replacementItems.length,
        totalCost: 0,
        items: [],
        priority: 'medium',
        estimatedDeliveryDays: 1,
        categories: {}
      };

      let totalCost = 0;
      let hasUrgentItems = false;

      for (const item of replacementItems) {
        const replacementItem = {
          itemId: item.itemId,
          itemName: item.itemName,
          category: item.category,
          currentCondition: item.condition,
          quantityNeeded: item.expectedQuantity - item.currentQuantity,
          unitPrice: item.replacementPrice || item.unitPrice,
          totalCost: (item.replacementPrice || item.unitPrice) * (item.expectedQuantity - item.currentQuantity),
          priority: item.assessment.priority,
          reason: item.assessment.reason,
          action: item.assessment.action,
          location: item.location
        };

        replacementPlan.items.push(replacementItem);
        totalCost += replacementItem.totalCost;

        if (item.assessment.priority === 'urgent') {
          hasUrgentItems = true;
        }

        // Group by category
        if (!replacementPlan.categories[item.category]) {
          replacementPlan.categories[item.category] = [];
        }
        replacementPlan.categories[item.category].push(replacementItem);
      }

      replacementPlan.totalCost = totalCost;
      replacementPlan.priority = hasUrgentItems ? 'urgent' : 'high';

      logger.info('Replacement items identified', {
        roomId,
        totalItems: replacementItems.length,
        totalCost,
        priority: replacementPlan.priority
      });

      return replacementPlan;

    } catch (error) {
      logger.error('Failed to identify replacement items', {
        roomId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update room inventory status
   * @param {string} roomId - Room ID
   * @param {Object} assessment - Inventory assessment
   * @param {Object} replacementItems - Replacement items plan
   * @param {string} processedBy - User ID
   */
  async updateRoomInventoryStatus(roomId, assessment, replacementItems, processedBy) {
    try {
      const roomInventory = await RoomInventory.findOne({ roomId });
      if (!roomInventory) {
        throw new Error('Room inventory not found');
      }

      const updates = {
        lastInspectionDate: new Date(),
        status: this.determineNewRoomStatus(assessment, replacementItems),
        maintenanceRequired: replacementItems.totalItems > 0,
        maintenanceNotes: replacementItems.totalItems > 0 
          ? `${replacementItems.totalItems} items need replacement (₹${replacementItems.totalCost.toLocaleString()})`
          : null
      };

      // Update individual items
      for (const item of assessment.items) {
        const inventoryItem = roomInventory.items.id(item.itemId);
        if (inventoryItem) {
          inventoryItem.lastCheckedDate = new Date();
          inventoryItem.checkedBy = processedBy;
          
          if (item.assessment.priority === 'high' || item.assessment.priority === 'urgent') {
            inventoryItem.needsReplacement = true;
            inventoryItem.replacementReason = item.assessment.reason || 'checkout_assessment';
            inventoryItem.replacementRequested = true;
            inventoryItem.replacementRequestedDate = new Date();
          }
        }
      }

      // Record inspection in history
      const inspectionRecord = {
        inspectedBy: processedBy,
        inspectionDate: new Date(),
        inspectionType: 'checkout_inspection',
        findings: replacementItems.items.map(item => ({
          itemId: item.itemId,
          issue: item.reason,
          severity: item.priority === 'urgent' ? 'critical' : 'moderate',
          action: 'replaced',
          cost: item.totalCost,
          chargedToGuest: false
        })),
        overallStatus: assessment.summary.overallConditionScore >= 70 ? 'passed' : 'needs_attention',
        score: assessment.summary.overallConditionScore,
        timeSpent: 15, // Estimated time for automated assessment
        notes: `Automated checkout inventory assessment. ${replacementItems.totalItems} items need replacement.`
      };

      roomInventory.inspectionHistory.push(inspectionRecord);

      // Apply updates
      Object.assign(roomInventory, updates);
      await roomInventory.save();

      logger.info('Room inventory status updated', {
        roomId,
        newStatus: updates.status,
        maintenanceRequired: updates.maintenanceRequired,
        itemsUpdated: assessment.items.length
      });

      return {
        roomId,
        newStatus: updates.status,
        maintenanceRequired: updates.maintenanceRequired,
        itemsUpdated: assessment.items.length,
        inspectionRecordId: inspectionRecord._id
      };

    } catch (error) {
      logger.error('Failed to update room inventory status', {
        roomId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Determine new room status based on assessment
   * @param {Object} assessment - Inventory assessment
   * @param {Object} replacementItems - Replacement items plan
   */
  determineNewRoomStatus(assessment, replacementItems) {
    if (replacementItems.totalItems === 0 && assessment.summary.overallConditionScore >= 90) {
      return 'clean';
    } else if (replacementItems.totalItems === 0 && assessment.summary.overallConditionScore >= 70) {
      return 'clean';
    } else if (replacementItems.totalItems > 0 && replacementItems.priority === 'urgent') {
      return 'maintenance';
    } else if (replacementItems.totalItems > 0) {
      return 'inspection_required';
    } else {
      return 'dirty';
    }
  }

  /**
   * Create daily routine check if needed
   * @param {string} roomId - Room ID
   * @param {Object} assessment - Inventory assessment
   * @param {string} processedBy - User ID
   * @param {Object} options - Processing options
   */
  async createDailyRoutineCheck(roomId, assessment, processedBy, options = {}) {
    try {
      // Only create routine check if there are issues or if forced
      if (assessment.summary.overallConditionScore >= 90 && !options.forceRoutineCheck) {
        return {
          created: false,
          reason: 'Room in excellent condition, no routine check needed'
        };
      }

      const routineCheck = new DailyRoutineCheck({
        hotelId: options.hotelId,
        roomId,
        checkedBy: processedBy,
        checkDate: new Date(),
        status: 'completed',
        estimatedDuration: 15,
        actualDuration: 15,
        startedAt: new Date(),
        completedAt: new Date(),
        items: assessment.items.map(item => ({
          itemId: item.itemId,
          itemName: item.itemName,
          category: item.category,
          inventoryType: 'fixed',
          action: item.assessment.action === 'replace_immediately' ? 'replace' : 'no_action',
          quantity: item.currentQuantity,
          unitPrice: item.unitPrice || 0,
          totalPrice: (item.unitPrice || 0) * item.currentQuantity,
          notes: item.assessment.reason,
          status: item.condition === 'missing' ? 'missing' : 'working'
        })),
        totalCost: assessment.summary.estimatedReplacementCost,
        notes: `Automated checkout routine check. Overall score: ${assessment.summary.overallConditionScore}/100`,
        qualityScore: Math.round(assessment.summary.overallConditionScore / 20), // Convert to 1-5 scale
        followUpRequired: replacementItems.totalItems > 0,
        followUpDate: replacementItems.totalItems > 0 ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
        followUpNotes: replacementItems.totalItems > 0 ? `${replacementItems.totalItems} items need replacement` : null
      });

      await routineCheck.save();

      logger.info('Daily routine check created', {
        routineCheckId: routineCheck._id,
        roomId,
        qualityScore: routineCheck.qualityScore,
        followUpRequired: routineCheck.followUpRequired
      });

      return {
        created: true,
        routineCheckId: routineCheck._id,
        qualityScore: routineCheck.qualityScore,
        followUpRequired: routineCheck.followUpRequired
      };

    } catch (error) {
      logger.error('Failed to create daily routine check', {
        roomId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate comprehensive inventory report
   * @param {string} roomId - Room ID
   * @param {Object} assessment - Inventory assessment
   * @param {Object} replacementItems - Replacement items plan
   * @param {Object} options - Processing options
   */
  async generateInventoryReport(roomId, assessment, replacementItems, options = {}) {
    try {
      const report = {
        roomId,
        roomNumber: assessment.roomNumber,
        roomType: assessment.roomType,
        reportDate: new Date(),
        assessment: {
          overallScore: assessment.summary.overallConditionScore,
          totalItems: assessment.summary.totalItems,
          itemsInGoodCondition: assessment.summary.itemsInGoodCondition,
          itemsNeedingReplacement: assessment.summary.itemsNeedingReplacement,
          itemsMissing: assessment.summary.itemsMissing,
          itemsDamaged: assessment.summary.itemsDamaged
        },
        replacement: {
          totalItems: replacementItems.totalItems,
          totalCost: replacementItems.totalCost,
          priority: replacementItems.priority,
          categories: replacementItems.categories
        },
        insights: assessment.insights,
        recommendations: this.generateRecommendations(assessment, replacementItems),
        nextActions: this.generateNextActions(assessment, replacementItems)
      };

      logger.info('Inventory report generated', {
        roomId,
        overallScore: report.assessment.overallScore,
        replacementCost: report.replacement.totalCost
      });

      return report;

    } catch (error) {
      logger.error('Failed to generate inventory report', {
        roomId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate recommendations based on assessment
   * @param {Object} assessment - Inventory assessment
   * @param {Object} replacementItems - Replacement items plan
   */
  generateRecommendations(assessment, replacementItems) {
    const recommendations = [];

    if (assessment.summary.overallConditionScore < 70) {
      recommendations.push({
        type: 'immediate',
        priority: 'high',
        action: 'Schedule deep cleaning and maintenance',
        reason: 'Room condition score is below acceptable threshold',
        estimatedCost: replacementItems.totalCost
      });
    }

    if (replacementItems.totalItems > 0) {
      recommendations.push({
        type: 'replacement',
        priority: replacementItems.priority,
        action: 'Order replacement items',
        reason: `${replacementItems.totalItems} items need replacement`,
        estimatedCost: replacementItems.totalCost,
        estimatedDeliveryDays: replacementItems.estimatedDeliveryDays
      });
    }

    if (assessment.summary.itemsMissing > 0) {
      recommendations.push({
        type: 'security',
        priority: 'high',
        action: 'Investigate missing items',
        reason: `${assessment.summary.itemsMissing} items are missing`,
        estimatedCost: 0
      });
    }

    // Category-specific recommendations
    Object.entries(replacementItems.categories).forEach(([category, items]) => {
      if (items.length > 2) {
        recommendations.push({
          type: 'category',
          priority: 'medium',
          action: `Bulk order for ${category} items`,
          reason: `Multiple ${category} items need replacement`,
          estimatedCost: items.reduce((sum, item) => sum + item.totalCost, 0),
          category
        });
      }
    });

    return recommendations;
  }

  /**
   * Generate next actions based on assessment
   * @param {Object} assessment - Inventory assessment
   * @param {Object} replacementItems - Replacement items plan
   */
  generateNextActions(assessment, replacementItems) {
    const actions = [];

    // Immediate actions
    if (replacementItems.priority === 'urgent') {
      actions.push({
        action: 'immediate_replacement',
        priority: 'urgent',
        description: 'Replace urgent items immediately',
        estimatedTime: '2-4 hours',
        assignedTo: 'housekeeping_manager'
      });
    }

    // Short-term actions (within 24 hours)
    if (replacementItems.totalItems > 0) {
      actions.push({
        action: 'order_replacements',
        priority: 'high',
        description: 'Order replacement items',
        estimatedTime: '1-2 hours',
        assignedTo: 'inventory_manager'
      });
    }

    // Medium-term actions (within 3 days)
    if (assessment.summary.overallConditionScore < 80) {
      actions.push({
        action: 'schedule_maintenance',
        priority: 'medium',
        description: 'Schedule room maintenance',
        estimatedTime: '30 minutes',
        assignedTo: 'maintenance_manager'
      });
    }

    // Long-term actions (within 1 week)
    if (assessment.summary.itemsMissing > 0) {
      actions.push({
        action: 'security_review',
        priority: 'medium',
        description: 'Review security measures for missing items',
        estimatedTime: '1 hour',
        assignedTo: 'security_manager'
      });
    }

    return actions;
  }

  /**
   * Generate summary of inventory automation results
   * @param {Array} steps - Automation steps
   */
  generateInventorySummary(steps) {
    const successfulSteps = steps.filter(step => step.success);
    const failedSteps = steps.filter(step => !step.success);

    return {
      totalSteps: steps.length,
      successfulSteps: successfulSteps.length,
      failedSteps: failedSteps.length,
      successRate: steps.length > 0 ? (successfulSteps.length / steps.length) * 100 : 0,
      processingTime: steps.length > 0 ? steps[steps.length - 1].timestamp - steps[0].timestamp : 0,
      overallStatus: failedSteps.length === 0 ? 'success' : 'partial_success'
    };
  }

  /**
   * Get inventory automation statistics for a hotel
   * @param {string} hotelId - Hotel ID
   * @param {Object} dateRange - Date range for statistics
   */
  async getInventoryStatistics(hotelId, dateRange = {}) {
    try {
      const startDate = dateRange.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = dateRange.endDate || new Date();

      // Get checkout inventory statistics
      const checkoutStats = await CheckoutInventory.aggregate([
        {
          $lookup: {
            from: 'bookings',
            localField: 'bookingId',
            foreignField: '_id',
            as: 'booking'
          }
        },
        {
          $match: {
            'booking.hotelId': new mongoose.Types.ObjectId(hotelId),
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: null,
            totalCheckouts: { $sum: 1 },
            totalItems: { $sum: { $size: '$items' } },
            totalCost: { $sum: '$totalAmount' },
            averageScore: { $avg: '$totalAmount' }
          }
        }
      ]);

      // Get room inventory statistics
      const roomStats = await RoomInventory.aggregate([
        {
          $match: {
            hotelId: new mongoose.Types.ObjectId(hotelId),
            isActive: true
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      return {
        checkoutInventory: checkoutStats[0] || {
          totalCheckouts: 0,
          totalItems: 0,
          totalCost: 0,
          averageScore: 0
        },
        roomStatuses: roomStats,
        dateRange: { startDate, endDate }
      };

    } catch (error) {
      logger.error('Failed to get inventory statistics', {
        hotelId,
        error: error.message
      });
      throw error;
    }
  }
}

export default new InventoryAutomationService();
