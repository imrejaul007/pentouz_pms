import InventoryItem from '../models/InventoryItem.js';
import Vendor from '../models/Vendor.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import ReorderAlert from '../models/ReorderAlert.js';
import mongoose from 'mongoose';

class InventoryVendorIntegrationService {
  /**
   * Auto-generate purchase orders based on reorder alerts
   */
  async generateAutoPurchaseOrders(hotelId) {
    try {
      // Get active reorder alerts
      const reorderAlerts = await ReorderAlert.find({
        hotelId,
        status: 'active',
        acknowledged: false
      }).populate('inventoryItemId');

      if (reorderAlerts.length === 0) {
        return { message: 'No reorder alerts found', orders: [] };
      }

      // Group items by preferred vendor or category
      const vendorGroups = new Map();

      for (const alert of reorderAlerts) {
        const item = alert.inventoryItemId;
        if (!item) continue;

        // Find preferred vendor for this item's category
        const preferredVendor = await this.getPreferredVendorForCategory(
          hotelId,
          item.category
        );

        if (!preferredVendor) continue;

        const vendorId = preferredVendor._id.toString();

        if (!vendorGroups.has(vendorId)) {
          vendorGroups.set(vendorId, {
            vendor: preferredVendor,
            items: []
          });
        }

        vendorGroups.get(vendorId).items.push({
          inventoryItemId: item._id,
          itemName: item.name,
          itemCode: item.itemCode,
          unit: item.unit,
          quantityOrdered: alert.suggestedQuantity || item.reorderQuantity,
          unitPrice: item.averageCost || 0,
          urgency: alert.priority
        });
      }

      // Create purchase orders for each vendor group
      const createdOrders = [];

      for (const [vendorId, group] of vendorGroups) {
        if (group.items.length === 0) continue;

        // Determine department and category for the PO
        const department = this.determineDepartmentForItems(group.items);
        const category = this.determineCategoryForItems(group.items);

        const orderData = {
          hotelId,
          vendorId,
          department,
          category,
          items: group.items,
          requiredDate: this.calculateRequiredDate(group.items),
          expectedDeliveryDate: this.calculateExpectedDeliveryDate(
            group.vendor.deliveryInfo?.leadTimeDays || 7
          ),
          priority: this.determinePriority(group.items),
          notes: 'Auto-generated from reorder alerts',
          autoReorder: {
            enabled: true,
            frequency: 'monthly'
          }
        };

        try {
          const purchaseOrder = await this.createPurchaseOrderFromReorder(orderData);
          createdOrders.push(purchaseOrder);

          // Mark reorder alerts as acknowledged
          await this.acknowledgeReorderAlerts(group.items.map(item => item.inventoryItemId));
        } catch (error) {
          console.error(`Failed to create PO for vendor ${vendorId}:`, error);
        }
      }

      return {
        message: `Generated ${createdOrders.length} purchase orders`,
        orders: createdOrders
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get preferred vendor for a specific category
   */
  async getPreferredVendorForCategory(hotelId, category) {
    try {
      // First try to find preferred vendors
      let vendor = await Vendor.findOne({
        hotelId,
        status: 'preferred',
        categories: category
      }).sort({ 'performance.overallRating': -1 });

      // If no preferred vendor, find active vendor with best performance
      if (!vendor) {
        vendor = await Vendor.findOne({
          hotelId,
          status: 'active',
          categories: category
        }).sort({ 'performance.overallRating': -1 });
      }

      return vendor;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update inventory levels when purchase order items are received
   */
  async updateInventoryFromPO(purchaseOrderId) {
    try {
      const purchaseOrder = await PurchaseOrder.findById(purchaseOrderId)
        .populate('items.inventoryItemId');

      if (!purchaseOrder) {
        throw new Error('Purchase order not found');
      }

      const updates = [];

      for (const poItem of purchaseOrder.items) {
        if (poItem.quantityReceived > 0) {
          const inventoryItem = await InventoryItem.findById(poItem.inventoryItemId);

          if (inventoryItem) {
            // Update stock levels
            inventoryItem.currentStock += poItem.quantityReceived;
            inventoryItem.totalReceived = (inventoryItem.totalReceived || 0) + poItem.quantityReceived;
            inventoryItem.lastRestockDate = new Date();

            // Update average cost (weighted average)
            if (poItem.unitPrice > 0) {
              const totalValue = (inventoryItem.averageCost * inventoryItem.currentStock) +
                               (poItem.unitPrice * poItem.quantityReceived);
              const totalQuantity = inventoryItem.currentStock + poItem.quantityReceived;
              inventoryItem.averageCost = totalValue / totalQuantity;
            }

            await inventoryItem.save();
            updates.push({
              itemId: inventoryItem._id,
              itemName: inventoryItem.name,
              quantityAdded: poItem.quantityReceived,
              newStock: inventoryItem.currentStock
            });
          }
        }
      }

      return updates;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get vendor recommendations for inventory items
   */
  async getVendorRecommendations(hotelId, inventoryItemIds) {
    try {
      const recommendations = [];

      for (const itemId of inventoryItemIds) {
        const item = await InventoryItem.findById(itemId);
        if (!item) continue;

        // Find vendors for this item's category
        const vendors = await Vendor.find({
          hotelId,
          categories: item.category,
          status: { $in: ['active', 'preferred'] }
        }).sort({ 'performance.overallRating': -1 });

        // Calculate recommendation scores
        const vendorScores = await Promise.all(
          vendors.map(async (vendor) => {
            const score = await this.calculateVendorScore(vendor, item);
            return {
              vendor: vendor,
              score: score,
              reasons: this.getRecommendationReasons(vendor, item)
            };
          })
        );

        recommendations.push({
          item: item,
          vendors: vendorScores.sort((a, b) => b.score - a.score).slice(0, 3)
        });
      }

      return recommendations;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Analyze vendor performance for inventory categories
   */
  async analyzeVendorPerformanceForInventory(hotelId) {
    try {
      const analysis = await InventoryItem.aggregate([
        {
          $match: { hotelId: new mongoose.Types.ObjectId(hotelId) }
        },
        {
          $group: {
            _id: '$category',
            totalItems: { $sum: 1 },
            lowStockItems: {
              $sum: {
                $cond: [
                  { $lte: ['$currentStock', '$reorderLevel'] },
                  1,
                  0
                ]
              }
            },
            averageReorderFrequency: { $avg: '$reorderFrequency' },
            totalValue: { $sum: { $multiply: ['$currentStock', '$averageCost'] } }
          }
        }
      ]);

      // Get vendor performance for each category
      const categoryPerformance = await Promise.all(
        analysis.map(async (category) => {
          const vendors = await Vendor.find({
            hotelId,
            categories: category._id,
            status: { $in: ['active', 'preferred'] }
          });

          const vendorPerformance = vendors.map(vendor => ({
            vendorId: vendor._id,
            vendorName: vendor.name,
            overallRating: vendor.performance.overallRating,
            onTimeDeliveryPercentage: vendor.performance.totalOrders > 0
              ? (vendor.performance.onTimeDeliveries / vendor.performance.totalOrders) * 100
              : 0,
            totalOrders: vendor.performance.totalOrders,
            totalOrderValue: vendor.performance.totalOrderValue
          }));

          return {
            category: category._id,
            inventory: category,
            vendors: vendorPerformance.sort((a, b) => b.overallRating - a.overallRating)
          };
        })
      );

      return categoryPerformance;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Set preferred vendors for inventory categories
   */
  async setPreferredVendorsForCategories(hotelId, categoryVendorMappings) {
    try {
      const results = [];

      for (const mapping of categoryVendorMappings) {
        const { category, vendorId, reason } = mapping;

        // Update vendor status to preferred for this category
        const vendor = await Vendor.findOneAndUpdate(
          { _id: vendorId, hotelId },
          {
            status: 'preferred',
            $addToSet: { categories: category },
            preferredFor: category,
            preferredReason: reason,
            preferredDate: new Date()
          },
          { new: true }
        );

        if (vendor) {
          results.push({
            category,
            vendor: {
              id: vendor._id,
              name: vendor.name,
              status: vendor.status
            }
          });
        }
      }

      return results;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate inventory restocking report with vendor recommendations
   */
  async generateRestockingReport(hotelId) {
    try {
      // Get items that need restocking
      const lowStockItems = await InventoryItem.find({
        hotelId,
        $expr: { $lte: ['$currentStock', '$reorderLevel'] }
      });

      // Get vendor recommendations for each item
      const recommendations = await this.getVendorRecommendations(
        hotelId,
        lowStockItems.map(item => item._id)
      );

      // Calculate total restock value
      const totalValue = lowStockItems.reduce((sum, item) => {
        const reorderQuantity = item.reorderQuantity || (item.maxStock - item.currentStock);
        return sum + (reorderQuantity * (item.averageCost || 0));
      }, 0);

      // Group by vendor for potential bulk orders
      const vendorGroups = new Map();

      recommendations.forEach(rec => {
        if (rec.vendors.length > 0) {
          const topVendor = rec.vendors[0].vendor;
          const vendorId = topVendor._id.toString();

          if (!vendorGroups.has(vendorId)) {
            vendorGroups.set(vendorId, {
              vendor: topVendor,
              items: [],
              totalValue: 0
            });
          }

          const reorderQuantity = rec.item.reorderQuantity ||
                                (rec.item.maxStock - rec.item.currentStock);
          const itemValue = reorderQuantity * (rec.item.averageCost || 0);

          vendorGroups.get(vendorId).items.push({
            item: rec.item,
            reorderQuantity,
            estimatedCost: itemValue
          });
          vendorGroups.get(vendorId).totalValue += itemValue;
        }
      });

      return {
        summary: {
          itemsNeedingRestock: lowStockItems.length,
          totalEstimatedValue: totalValue,
          vendorsInvolved: vendorGroups.size
        },
        itemRecommendations: recommendations,
        vendorGroups: Array.from(vendorGroups.values()).sort((a, b) => b.totalValue - a.totalValue)
      };
    } catch (error) {
      throw error;
    }
  }

  // Helper methods

  async createPurchaseOrderFromReorder(orderData) {
    try {
      const PurchaseOrderModel = (await import('../models/PurchaseOrder.js')).default;
      const purchaseOrder = new PurchaseOrderModel(orderData);
      await purchaseOrder.save();
      return purchaseOrder;
    } catch (error) {
      throw error;
    }
  }

  async acknowledgeReorderAlerts(inventoryItemIds) {
    try {
      await ReorderAlert.updateMany(
        { inventoryItemId: { $in: inventoryItemIds } },
        {
          acknowledged: true,
          acknowledgedDate: new Date()
        }
      );
    } catch (error) {
      console.error('Failed to acknowledge reorder alerts:', error);
    }
  }

  calculateVendorScore(vendor, item) {
    let score = 0;

    // Performance rating (40% weight)
    score += vendor.performance.overallRating * 8;

    // Delivery performance (30% weight)
    const onTimePercentage = vendor.performance.totalOrders > 0
      ? (vendor.performance.onTimeDeliveries / vendor.performance.totalOrders) * 100
      : 50;
    score += (onTimePercentage / 100) * 6;

    // Price competitiveness (20% weight)
    if (vendor.performance.priceRating) {
      score += vendor.performance.priceRating * 4;
    } else {
      score += 3 * 4; // Neutral score
    }

    // Preferred status bonus (10% weight)
    if (vendor.status === 'preferred') {
      score += 2;
    }

    return Math.min(100, Math.max(0, score));
  }

  getRecommendationReasons(vendor, item) {
    const reasons = [];

    if (vendor.status === 'preferred') {
      reasons.push('Preferred vendor');
    }

    if (vendor.performance.overallRating >= 4.5) {
      reasons.push('Excellent performance rating');
    }

    const onTimePercentage = vendor.performance.totalOrders > 0
      ? (vendor.performance.onTimeDeliveries / vendor.performance.totalOrders) * 100
      : 0;

    if (onTimePercentage >= 95) {
      reasons.push('Reliable delivery');
    }

    if (vendor.deliveryInfo?.emergencyDelivery?.available) {
      reasons.push('Emergency delivery available');
    }

    if (vendor.performance.totalOrders >= 10) {
      reasons.push('Proven track record');
    }

    return reasons;
  }

  determineDepartmentForItems(items) {
    // Simple logic - can be enhanced based on item categories
    const departments = {
      'linens': 'housekeeping',
      'toiletries': 'housekeeping',
      'cleaning_supplies': 'housekeeping',
      'maintenance_supplies': 'maintenance',
      'food_beverage': 'kitchen',
      'office_supplies': 'admin',
      'laundry_supplies': 'laundry'
    };

    // Return most common department or default
    return 'admin'; // Default department
  }

  determineCategoryForItems(items) {
    // Return the most common category
    const categories = items.reduce((acc, item) => {
      const category = item.category || 'other';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    return Object.keys(categories).sort((a, b) => categories[b] - categories[a])[0] || 'other';
  }

  calculateRequiredDate(items) {
    // Calculate based on urgency and current stock levels
    const urgentItems = items.filter(item => item.urgency === 'urgent');

    if (urgentItems.length > 0) {
      // Urgent items need delivery within 3 days
      const date = new Date();
      date.setDate(date.getDate() + 3);
      return date;
    }

    // Regular items can wait a week
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date;
  }

  calculateExpectedDeliveryDate(leadTimeDays) {
    const date = new Date();
    date.setDate(date.getDate() + leadTimeDays);
    return date;
  }

  determinePriority(items) {
    const urgentItems = items.filter(item => item.urgency === 'urgent');
    const highItems = items.filter(item => item.urgency === 'high');

    if (urgentItems.length > 0) return 'urgent';
    if (highItems.length > 0) return 'high';
    if (items.length > 5) return 'medium';
    return 'low';
  }
}

export default new InventoryVendorIntegrationService();