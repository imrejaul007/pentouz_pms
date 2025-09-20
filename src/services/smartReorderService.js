import InventoryItem from '../models/InventoryItem.js';
import Vendor from '../models/Vendor.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import mongoose from 'mongoose';

/**
 * Smart Reorder Service with Vendor Optimization
 * Handles intelligent reordering decisions based on multiple factors:
 * - Vendor performance and reliability
 * - Cost optimization and bulk discounts
 * - Delivery time and lead time analysis
 * - Seasonal demand patterns
 * - Budget constraints and approval workflows
 */
class SmartReorderService {
  constructor() {
    this.logger = console; // Replace with proper logger in production
  }

  /**
   * Analyze items that need reordering and generate smart recommendations
   */
  async analyzeReorderNeeds(hotelId, options = {}) {
    try {
      const {
        category = null,
        urgencyThreshold = 0.25, // Items with stock below 25% of reorder point are urgent
        maxBudget = null,
        prioritizePreferred = true,
        includeSeasonalFactors = true
      } = options;

      // Get items that need reordering
      const filter = {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        isActive: true,
        'reorderSettings.autoReorderEnabled': true
      };

      if (category) {
        filter.category = category;
      }

      const itemsNeedingReorder = await InventoryItem.find({
        ...filter,
        $expr: {
          $and: [
            { $ne: ['$reorderSettings.reorderPoint', null] },
            { $lte: ['$currentStock', '$reorderSettings.reorderPoint'] }
          ]
        }
      }).sort({ currentStock: 1 }); // Sort by most urgent first

      if (itemsNeedingReorder.length === 0) {
        return {
          success: true,
          message: 'No items currently need reordering',
          recommendations: [],
          totalEstimatedCost: 0
        };
      }

      this.logger.info(`Found ${itemsNeedingReorder.length} items needing reorder for hotel ${hotelId}`);

      // Generate smart recommendations for each item
      const recommendations = await Promise.all(
        itemsNeedingReorder.map(item => this.generateItemRecommendation(item, {
          urgencyThreshold,
          prioritizePreferred,
          includeSeasonalFactors
        }))
      );

      // Filter out failed recommendations
      const validRecommendations = recommendations.filter(rec => rec.success);
      const totalEstimatedCost = validRecommendations.reduce((sum, rec) => sum + rec.estimatedCost, 0);

      // Apply budget constraints if specified
      let finalRecommendations = validRecommendations;
      if (maxBudget && totalEstimatedCost > maxBudget) {
        finalRecommendations = this.optimizeForBudget(validRecommendations, maxBudget);
      }

      // Group recommendations by vendor for bulk ordering
      const vendorGroups = this.groupRecommendationsByVendor(finalRecommendations);

      return {
        success: true,
        totalItems: itemsNeedingReorder.length,
        recommendations: finalRecommendations,
        vendorGroups,
        totalEstimatedCost: finalRecommendations.reduce((sum, rec) => sum + rec.estimatedCost, 0),
        budgetExceeded: maxBudget && totalEstimatedCost > maxBudget,
        originalEstimatedCost: totalEstimatedCost
      };

    } catch (error) {
      this.logger.error('Error analyzing reorder needs:', error);
      throw new Error(`Failed to analyze reorder needs: ${error.message}`);
    }
  }

  /**
   * Generate smart recommendation for a single item
   */
  async generateItemRecommendation(item, options = {}) {
    try {
      const {
        urgencyThreshold = 0.25,
        prioritizePreferred = true,
        includeSeasonalFactors = true
      } = options;

      // Calculate urgency level
      const urgencyLevel = this.calculateUrgencyLevel(item, urgencyThreshold);

      // Get suitable vendors for this item category
      const suitableVendors = await this.findSuitableVendors(item.hotelId, item.category, {
        prioritizePreferred
      });

      if (suitableVendors.length === 0) {
        return {
          success: false,
          itemId: item._id,
          itemName: item.name,
          error: 'No suitable vendors found for this item category'
        };
      }

      // Select optimal vendor based on multiple factors
      const optimalVendor = this.selectOptimalVendor(suitableVendors, item, urgencyLevel);

      // Calculate optimal quantity considering various factors
      const optimalQuantity = this.calculateOptimalQuantity(item, {
        urgencyLevel,
        vendorMinOrder: optimalVendor.deliveryInfo?.minimumOrderValue || 0,
        includeSeasonalFactors
      });

      // Calculate costs including potential bulk discounts
      const costCalculation = this.calculateCosts(item, optimalQuantity, optimalVendor);

      // Determine if auto-approval is possible
      const approvalRequired = this.requiresApproval(costCalculation.totalCost, urgencyLevel, item.category);

      return {
        success: true,
        itemId: item._id,
        itemName: item.name,
        category: item.category,
        currentStock: item.currentStock,
        reorderPoint: item.reorderSettings.reorderPoint,
        recommendedQuantity: optimalQuantity,
        urgencyLevel,
        vendor: {
          id: optimalVendor._id,
          name: optimalVendor.name,
          rating: optimalVendor.performance?.overallRating || 0,
          leadTimeDays: optimalVendor.deliveryInfo?.leadTimeDays || 7,
          onTimeDeliveryRate: this.calculateOnTimeDeliveryRate(optimalVendor)
        },
        costBreakdown: costCalculation,
        estimatedCost: costCalculation.totalCost,
        estimatedDeliveryDate: this.calculateEstimatedDeliveryDate(optimalVendor.deliveryInfo?.leadTimeDays || 7),
        autoApprovalPossible: !approvalRequired,
        approvalRequired,
        reasonForSelection: this.generateSelectionReason(optimalVendor, suitableVendors),
        riskFactors: this.identifyRiskFactors(item, optimalVendor, urgencyLevel)
      };

    } catch (error) {
      this.logger.error(`Error generating recommendation for item ${item.name}:`, error);
      return {
        success: false,
        itemId: item._id,
        itemName: item.name,
        error: error.message
      };
    }
  }

  /**
   * Calculate urgency level based on current stock vs thresholds
   */
  calculateUrgencyLevel(item, urgencyThreshold) {
    const reorderPoint = item.reorderSettings.reorderPoint;
    const currentStock = item.currentStock;
    const criticalLevel = Math.floor(reorderPoint * urgencyThreshold);

    if (currentStock <= 0) return 'critical';
    if (currentStock <= criticalLevel) return 'high';
    if (currentStock <= Math.floor(reorderPoint * 0.5)) return 'medium';
    return 'low';
  }

  /**
   * Find suitable vendors for a specific category
   */
  async findSuitableVendors(hotelId, category, options = {}) {
    const { prioritizePreferred = true } = options;

    try {
      // Map inventory categories to vendor categories
      const vendorCategories = this.mapInventoryToVendorCategory(category);

      const filter = {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        status: { $in: ['active', 'preferred'] },
        categories: { $in: vendorCategories }
      };

      const vendors = await Vendor.find(filter).sort({
        ...(prioritizePreferred && { status: -1 }), // Preferred vendors first
        'performance.overallRating': -1,
        'performance.onTimeDeliveryPercentage': -1
      });

      return vendors.filter(vendor => this.isVendorEligible(vendor));

    } catch (error) {
      this.logger.error(`Error finding suitable vendors for category ${category}:`, error);
      return [];
    }
  }

  /**
   * Select the optimal vendor based on multiple criteria
   */
  selectOptimalVendor(vendors, item, urgencyLevel) {
    if (vendors.length === 1) return vendors[0];

    // Scoring factors and weights
    const weights = {
      performance: 0.3,
      cost: 0.25,
      reliability: 0.25,
      speed: urgencyLevel === 'critical' || urgencyLevel === 'high' ? 0.2 : 0.1,
      relationship: 0.1
    };

    const scoredVendors = vendors.map(vendor => {
      const scores = {
        performance: (vendor.performance?.overallRating || 3) / 5, // Normalize to 0-1
        cost: this.calculateCostScore(vendor, item), // Lower cost = higher score
        reliability: this.calculateReliabilityScore(vendor),
        speed: this.calculateSpeedScore(vendor, urgencyLevel),
        relationship: this.calculateRelationshipScore(vendor, item)
      };

      const totalScore = Object.keys(weights).reduce((sum, factor) => {
        return sum + (scores[factor] * weights[factor]);
      }, 0);

      return {
        vendor,
        scores,
        totalScore
      };
    });

    // Sort by total score (highest first)
    scoredVendors.sort((a, b) => b.totalScore - a.totalScore);

    return scoredVendors[0].vendor;
  }

  /**
   * Calculate optimal quantity considering multiple factors
   */
  calculateOptimalQuantity(item, options = {}) {
    const {
      urgencyLevel = 'medium',
      vendorMinOrder = 0,
      includeSeasonalFactors = true
    } = options;

    const baseQuantity = item.reorderSettings.reorderQuantity || Math.max(
      item.reorderSettings.reorderPoint - item.currentStock,
      item.stockThreshold
    );

    let adjustedQuantity = baseQuantity;

    // Urgency adjustments
    const urgencyMultipliers = {
      'critical': 1.5, // Order more for critical items
      'high': 1.2,
      'medium': 1.0,
      'low': 0.8
    };
    adjustedQuantity = Math.ceil(adjustedQuantity * urgencyMultipliers[urgencyLevel]);

    // Seasonal factor adjustments (simplified - could be enhanced with ML)
    if (includeSeasonalFactors) {
      const seasonalMultiplier = this.getSeasonalMultiplier(item.category);
      adjustedQuantity = Math.ceil(adjustedQuantity * seasonalMultiplier);
    }

    // Economic order quantity consideration
    const ecoQuantity = this.calculateEconomicOrderQuantity(item);
    if (ecoQuantity > adjustedQuantity * 0.8) { // Within 80% of EOQ
      adjustedQuantity = Math.max(adjustedQuantity, Math.ceil(ecoQuantity * 0.8));
    }

    // Ensure minimum order requirements are met
    const estimatedUnitPrice = item.unitPrice || 0;
    const estimatedOrderValue = adjustedQuantity * estimatedUnitPrice;
    if (vendorMinOrder > estimatedOrderValue && estimatedUnitPrice > 0) {
      adjustedQuantity = Math.ceil(vendorMinOrder / estimatedUnitPrice);
    }

    return Math.max(adjustedQuantity, 1); // Ensure at least 1 unit
  }

  /**
   * Calculate comprehensive cost breakdown
   */
  calculateCosts(item, quantity, vendor) {
    const unitPrice = item.unitPrice || 0;
    const subtotal = quantity * unitPrice;

    // Apply bulk discount if applicable
    let discountPercentage = 0;
    if (vendor.contractInfo?.discountTiers) {
      const applicableDiscount = vendor.contractInfo.discountTiers
        .filter(tier => subtotal >= tier.minAmount)
        .sort((a, b) => b.discountPercentage - a.discountPercentage)[0];

      if (applicableDiscount) {
        discountPercentage = applicableDiscount.discountPercentage;
      }
    }

    const discountAmount = (subtotal * discountPercentage) / 100;
    const discountedSubtotal = subtotal - discountAmount;

    // Calculate shipping costs
    let shippingCost = vendor.deliveryInfo?.shippingCost || 0;
    if (vendor.deliveryInfo?.freeShippingThreshold &&
        discountedSubtotal >= vendor.deliveryInfo.freeShippingThreshold) {
      shippingCost = 0;
    }

    // Apply early payment discount if applicable
    let earlyPaymentDiscount = 0;
    if (vendor.paymentTerms?.earlyPaymentDiscount?.percentage) {
      earlyPaymentDiscount = (discountedSubtotal * vendor.paymentTerms.earlyPaymentDiscount.percentage) / 100;
    }

    const totalCost = discountedSubtotal + shippingCost - earlyPaymentDiscount;

    return {
      unitPrice,
      quantity,
      subtotal,
      discountPercentage,
      discountAmount,
      discountedSubtotal,
      shippingCost,
      earlyPaymentDiscount,
      totalCost: Math.max(totalCost, 0),
      costPerUnit: totalCost / quantity
    };
  }

  /**
   * Determine if manual approval is required
   */
  requiresApproval(totalCost, urgencyLevel, category) {
    // Define approval thresholds (can be configured per hotel)
    const thresholds = {
      'critical': 50000, // Higher threshold for critical items
      'high': 30000,
      'medium': 20000,
      'low': 15000
    };

    // Category-specific thresholds
    const categoryMultipliers = {
      'electronics': 1.5, // Higher threshold for expensive categories
      'furniture': 1.5,
      'cleaning': 0.8, // Lower threshold for routine categories
      'toiletries': 0.8
    };

    const baseThreshold = thresholds[urgencyLevel] || thresholds.medium;
    const multiplier = categoryMultipliers[category] || 1.0;
    const finalThreshold = baseThreshold * multiplier;

    return totalCost > finalThreshold;
  }

  /**
   * Generate human-readable reason for vendor selection
   */
  generateSelectionReason(selectedVendor, allVendors) {
    const reasons = [];

    if (selectedVendor.status === 'preferred') {
      reasons.push('Preferred vendor status');
    }

    const avgRating = allVendors.reduce((sum, v) => sum + (v.performance?.overallRating || 3), 0) / allVendors.length;
    if (selectedVendor.performance?.overallRating > avgRating) {
      reasons.push('Above average performance rating');
    }

    const onTimeRate = this.calculateOnTimeDeliveryRate(selectedVendor);
    if (onTimeRate >= 90) {
      reasons.push('Excellent delivery reliability (>90%)');
    }

    const leadTime = selectedVendor.deliveryInfo?.leadTimeDays || 7;
    const avgLeadTime = allVendors.reduce((sum, v) => sum + (v.deliveryInfo?.leadTimeDays || 7), 0) / allVendors.length;
    if (leadTime < avgLeadTime) {
      reasons.push('Faster delivery time');
    }

    if (selectedVendor.contractInfo?.discountTiers?.length > 0) {
      reasons.push('Bulk discount available');
    }

    return reasons.length > 0 ? reasons.join(', ') : 'Best overall match based on performance criteria';
  }

  /**
   * Identify potential risk factors
   */
  identifyRiskFactors(item, vendor, urgencyLevel) {
    const risks = [];

    const onTimeRate = this.calculateOnTimeDeliveryRate(vendor);
    if (onTimeRate < 80) {
      risks.push({
        type: 'delivery_reliability',
        severity: 'medium',
        description: `Vendor has ${onTimeRate}% on-time delivery rate`
      });
    }

    const leadTime = vendor.deliveryInfo?.leadTimeDays || 7;
    if (urgencyLevel === 'critical' && leadTime > 3) {
      risks.push({
        type: 'delivery_time',
        severity: 'high',
        description: `${leadTime} day lead time may be too slow for critical stock situation`
      });
    }

    if (vendor.performance?.totalOrders < 5) {
      risks.push({
        type: 'limited_history',
        severity: 'low',
        description: 'Limited order history with this vendor'
      });
    }

    const daysSinceLastOrder = vendor.daysSinceLastOrder;
    if (daysSinceLastOrder && daysSinceLastOrder > 90) {
      risks.push({
        type: 'inactive_relationship',
        severity: 'low',
        description: `No orders in the last ${daysSinceLastOrder} days`
      });
    }

    return risks;
  }

  /**
   * Create purchase orders from approved recommendations
   */
  async createPurchaseOrdersFromRecommendations(hotelId, approvedRecommendations, requestedBy) {
    try {
      const results = [];

      // Group recommendations by vendor
      const vendorGroups = this.groupRecommendationsByVendor(approvedRecommendations);

      for (const [vendorId, recommendations] of Object.entries(vendorGroups)) {
        try {
          const vendor = await Vendor.findById(vendorId);
          if (!vendor) {
            this.logger.error(`Vendor not found: ${vendorId}`);
            continue;
          }

          // Calculate expected delivery date
          const leadTimeDays = vendor.deliveryInfo?.leadTimeDays || 7;
          const expectedDeliveryDate = new Date();
          expectedDeliveryDate.setDate(expectedDeliveryDate.getDate() + leadTimeDays);

          // Prepare PO items
          const items = recommendations.map(rec => ({
            inventoryItemId: rec.itemId,
            itemName: rec.itemName,
            description: `Auto-reorder for ${rec.itemName}`,
            unit: 'pieces', // Default unit - should be from item data
            quantityOrdered: rec.recommendedQuantity,
            quantityReceived: 0,
            unitPrice: rec.costBreakdown.unitPrice,
            totalPrice: rec.costBreakdown.subtotal,
            taxRate: 18, // Default GST rate - should be configurable
            taxAmount: (rec.costBreakdown.subtotal * 18) / 100,
            finalAmount: rec.costBreakdown.totalCost,
            urgency: rec.urgencyLevel,
            notes: `Smart reorder - ${rec.reasonForSelection}`
          }));

          // Calculate totals
          const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
          const taxAmount = items.reduce((sum, item) => sum + item.taxAmount, 0);
          const totalAmount = items.reduce((sum, item) => sum + item.finalAmount, 0);

          // Determine department and category
          const primaryCategory = recommendations[0].category;
          const department = this.mapCategoryToDepartment(primaryCategory);

          // Create purchase order
          const poData = {
            hotelId,
            vendorId,
            vendorInfo: {
              name: vendor.name,
              email: vendor.contactInfo.email,
              phone: vendor.contactInfo.phone,
              address: vendor.contactInfo.address?.fullAddress || '',
              contactPerson: vendor.contactInfo.primaryContact?.name || ''
            },
            requestedBy,
            department,
            category: primaryCategory,
            items,
            requiredDate: new Date(Date.now() + (leadTimeDays - 1) * 24 * 60 * 60 * 1000), // 1 day before expected delivery
            expectedDeliveryDate,
            status: recommendations.some(r => r.autoApprovalPossible) ? 'approved' : 'pending_approval',
            priority: this.determinePOPriority(recommendations),
            subtotal,
            taxAmount,
            discountAmount: 0,
            totalAmount,
            notes: `Smart reorder for ${recommendations.length} item(s). Generated automatically based on reorder points and vendor optimization.`
          };

          const purchaseOrder = await PurchaseOrder.create(poData);

          // Update reorder history for each item
          for (const rec of recommendations) {
            await InventoryItem.findByIdAndUpdate(rec.itemId, {
              $push: {
                'reorderSettings.reorderHistory': {
                  quantity: rec.recommendedQuantity,
                  supplier: vendor.name,
                  estimatedCost: rec.estimatedCost,
                  status: 'pending',
                  orderDate: new Date(),
                  expectedDeliveryDate,
                  notes: `Smart reorder PO: ${purchaseOrder.poNumber}`,
                  alertId: null // Could link to reorder alert if exists
                }
              },
              'reorderSettings.lastReorderDate': new Date()
            });
          }

          results.push({
            success: true,
            vendorId,
            vendorName: vendor.name,
            purchaseOrderId: purchaseOrder._id,
            poNumber: purchaseOrder.poNumber,
            itemCount: recommendations.length,
            totalAmount: purchaseOrder.totalAmount,
            status: purchaseOrder.status,
            expectedDeliveryDate: purchaseOrder.expectedDeliveryDate
          });

        } catch (error) {
          this.logger.error(`Error creating PO for vendor ${vendorId}:`, error);
          results.push({
            success: false,
            vendorId,
            error: error.message,
            itemCount: recommendations.length
          });
        }
      }

      return {
        success: true,
        results,
        totalPOs: results.length,
        successfulPOs: results.filter(r => r.success).length,
        failedPOs: results.filter(r => !r.success).length
      };

    } catch (error) {
      this.logger.error('Error creating purchase orders from recommendations:', error);
      throw new Error(`Failed to create purchase orders: ${error.message}`);
    }
  }

  // Helper methods

  calculateOnTimeDeliveryRate(vendor) {
    if (!vendor.performance?.totalOrders || vendor.performance.totalOrders === 0) return 95; // Default assumption
    return Math.round((vendor.performance.onTimeDeliveries / vendor.performance.totalOrders) * 100);
  }

  calculateEstimatedDeliveryDate(leadTimeDays) {
    const date = new Date();
    date.setDate(date.getDate() + leadTimeDays);
    return date;
  }

  calculateCostScore(vendor, item) {
    // Higher score for lower cost vendors
    // This is a simplified implementation - could be enhanced with historical pricing data
    const baseScore = 0.7; // Default score

    if (vendor.performance?.averageOrderValue && item.unitPrice) {
      // Vendors with lower average pricing get higher scores
      const priceFactor = Math.max(0.1, Math.min(1.0, item.unitPrice / vendor.performance.averageOrderValue));
      return Math.max(0, 1 - priceFactor);
    }

    return baseScore;
  }

  calculateReliabilityScore(vendor) {
    const rating = vendor.performance?.overallRating || 3;
    const onTimeRate = this.calculateOnTimeDeliveryRate(vendor) / 100;
    const orderCount = vendor.performance?.totalOrders || 0;

    // Combine rating, on-time delivery, and experience
    const experienceFactor = Math.min(1, orderCount / 20); // Max factor at 20+ orders
    return ((rating / 5) * 0.4) + (onTimeRate * 0.4) + (experienceFactor * 0.2);
  }

  calculateSpeedScore(vendor, urgencyLevel) {
    const leadTime = vendor.deliveryInfo?.leadTimeDays || 7;
    const maxAcceptableLeadTime = {
      'critical': 2,
      'high': 3,
      'medium': 7,
      'low': 14
    }[urgencyLevel];

    return Math.max(0, Math.min(1, (maxAcceptableLeadTime - leadTime + 1) / maxAcceptableLeadTime));
  }

  calculateRelationshipScore(vendor, item) {
    let score = 0.5; // Base score

    // Preferred vendor bonus
    if (vendor.status === 'preferred') score += 0.3;

    // Recent order history bonus
    if (vendor.daysSinceLastOrder && vendor.daysSinceLastOrder < 30) score += 0.2;

    // Category specialization bonus
    if (vendor.categories.includes(item.category)) score += 0.2;

    return Math.min(1, score);
  }

  getSeasonalMultiplier(category) {
    const currentMonth = new Date().getMonth() + 1; // 1-12

    // Simplified seasonal factors - could be enhanced with historical data analysis
    const seasonalFactors = {
      'cleaning': currentMonth >= 3 && currentMonth <= 10 ? 1.2 : 0.9, // Higher in cleaning season
      'toiletries': currentMonth >= 11 || currentMonth <= 2 ? 1.1 : 1.0, // Winter months
      'linens': currentMonth >= 5 && currentMonth <= 9 ? 1.3 : 1.0, // Peak season
      'maintenance': currentMonth >= 3 && currentMonth <= 6 ? 1.2 : 1.0 // Pre-monsoon
    };

    return seasonalFactors[category] || 1.0;
  }

  calculateEconomicOrderQuantity(item) {
    // Simplified EOQ calculation - could be enhanced with more detailed cost analysis
    const demandRate = item.reorderSettings?.reorderQuantity || item.stockThreshold || 1;
    const orderingCost = 500; // Estimated cost per order
    const holdingCost = item.unitPrice * 0.25; // 25% of unit price annually

    if (holdingCost === 0) return demandRate;

    const eoq = Math.sqrt((2 * demandRate * orderingCost) / holdingCost);
    return Math.max(1, Math.round(eoq));
  }

  isVendorEligible(vendor) {
    // Check if vendor meets basic eligibility criteria
    if (vendor.status === 'blacklisted' || vendor.status === 'suspended') return false;

    // Could add more eligibility checks:
    // - Contract validity
    // - Credit limit availability
    // - Certification requirements
    // - Geographic delivery capability

    return true;
  }

  mapInventoryToVendorCategory(inventoryCategory) {
    const mapping = {
      'bedding': ['linens'],
      'toiletries': ['toiletries', 'guest_amenities'],
      'minibar': ['food_beverage'],
      'electronics': ['electronics'],
      'amenities': ['guest_amenities'],
      'cleaning': ['cleaning_supplies', 'laundry_supplies'],
      'furniture': ['furniture']
    };

    return mapping[inventoryCategory] || ['other'];
  }

  optimizeForBudget(recommendations, maxBudget) {
    // Sort by priority and cost-effectiveness
    const prioritized = recommendations.sort((a, b) => {
      // Priority order: critical > high > medium > low
      const priorityScores = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
      const aPriority = priorityScores[a.urgencyLevel] || 1;
      const bPriority = priorityScores[b.urgencyLevel] || 1;

      if (aPriority !== bPriority) return bPriority - aPriority;

      // Within same priority, prefer lower cost per unit
      return a.costBreakdown.costPerUnit - b.costBreakdown.costPerUnit;
    });

    // Select items within budget
    const selected = [];
    let currentCost = 0;

    for (const rec of prioritized) {
      if (currentCost + rec.estimatedCost <= maxBudget) {
        selected.push(rec);
        currentCost += rec.estimatedCost;
      }
    }

    return selected;
  }

  groupRecommendationsByVendor(recommendations) {
    const groups = {};

    for (const rec of recommendations) {
      const vendorId = rec.vendor.id;
      if (!groups[vendorId]) {
        groups[vendorId] = [];
      }
      groups[vendorId].push(rec);
    }

    return groups;
  }

  mapCategoryToDepartment(category) {
    const mapping = {
      'bedding': 'housekeeping',
      'toiletries': 'housekeeping',
      'cleaning': 'housekeeping',
      'maintenance': 'maintenance',
      'electronics': 'maintenance',
      'furniture': 'admin',
      'minibar': 'kitchen',
      'food_beverage': 'kitchen'
    };

    return mapping[category] || 'admin';
  }

  determinePOPriority(recommendations) {
    const urgencyLevels = recommendations.map(r => r.urgencyLevel);

    if (urgencyLevels.includes('critical')) return 'urgent';
    if (urgencyLevels.includes('high')) return 'high';
    if (urgencyLevels.includes('medium')) return 'medium';
    return 'low';
  }
}

export default SmartReorderService;