import Vendor from '../models/Vendor.js';
import VendorPerformance from '../models/VendorPerformance.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import mongoose from 'mongoose';

class VendorService {
  /**
   * Create a new vendor
   */
  async createVendor(vendorData, userId) {
    try {
      const vendor = new Vendor({
        ...vendorData,
        createdBy: userId,
        updatedBy: userId
      });

      await vendor.save();
      return vendor;
    } catch (error) {
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        throw new Error(`Vendor with this ${field} already exists`);
      }
      throw error;
    }
  }

  /**
   * Update vendor information
   */
  async updateVendorInfo(vendorId, updateData, userId) {
    try {
      const vendor = await Vendor.findById(vendorId);
      if (!vendor) {
        throw new Error('Vendor not found');
      }

      Object.assign(vendor, updateData);
      vendor.updatedBy = userId;

      await vendor.save();
      return vendor;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get vendor list with filters and pagination
   */
  async getVendorList(hotelId, filters = {}, options = {}) {
    try {
      const {
        status,
        category,
        categories,
        search,
        rating,
        preferred,
        active,
        contractExpiring,
        tags
      } = filters;

      const {
        page = 1,
        limit = 20,
        sortBy = 'name',
        sortOrder = 'asc',
        populate = true
      } = options;

      // Build query
      const query = { hotelId };

      // Status filter (new enum structure)
      if (status) {
        if (Array.isArray(status)) {
          query.status = { $in: status };
        } else {
          query.status = status;
        }
      }

      // Legacy active filter support
      if (active !== undefined) {
        if (active) {
          query.$or = [
            { isActive: true },
            { status: { $in: ['active', 'preferred'] } }
          ];
        } else {
          query.$or = [
            { isActive: false },
            { status: { $in: ['inactive', 'suspended', 'blacklisted'] } }
          ];
        }
      }

      // Category filter (support both old and new structure)
      if (category) {
        query.$or = [
          { category: category },
          { categories: category }
        ];
      }

      if (categories && Array.isArray(categories)) {
        query.categories = { $in: categories };
      }

      // Search filter
      if (search) {
        const searchRegex = new RegExp(search, 'i');
        query.$or = [
          { name: searchRegex },
          { vendorCode: searchRegex },
          { 'contactInfo.email': searchRegex },
          { 'contactInfo.primaryContact.name': searchRegex },
          // Legacy fields
          { email: searchRegex },
          { contactPerson: searchRegex }
        ];
      }

      // Rating filter
      if (rating) {
        if (typeof rating === 'object') {
          if (rating.min !== undefined) query['performance.overallRating'] = { $gte: rating.min };
          if (rating.max !== undefined) {
            query['performance.overallRating'] = {
              ...query['performance.overallRating'],
              $lte: rating.max
            };
          }
        } else {
          query['performance.overallRating'] = { $gte: rating };
        }
      }

      // Preferred vendors
      if (preferred !== undefined) {
        if (preferred) {
          query.$or = [
            { isPreferred: true },
            { status: 'preferred' }
          ];
        } else {
          query.isPreferred = false;
          query.status = { $ne: 'preferred' };
        }
      }

      // Contract expiring filter
      if (contractExpiring) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + (contractExpiring || 30));

        query.$or = [
          {
            'contractInfo.endDate': {
              $lte: expiryDate,
              $gte: new Date()
            }
          },
          {
            'contract.contractEndDate': {
              $lte: expiryDate,
              $gte: new Date()
            }
          }
        ];
      }

      // Tags filter
      if (tags && Array.isArray(tags)) {
        query.tags = { $in: tags };
      }

      // Build sort object
      const sort = {};
      if (sortBy === 'performance') {
        sort['performance.overallRating'] = sortOrder === 'desc' ? -1 : 1;
      } else if (sortBy === 'rating') {
        sort.rating = sortOrder === 'desc' ? -1 : 1;
      } else {
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
      }

      // Execute query
      const skip = (page - 1) * limit;

      let vendorQuery = Vendor.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit);

      if (populate) {
        vendorQuery = vendorQuery
          .populate('createdBy', 'name')
          .populate('updatedBy', 'name');
      }

      const [vendors, total] = await Promise.all([
        vendorQuery.exec(),
        Vendor.countDocuments(query)
      ]);

      return {
        vendors,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get detailed vendor information
   */
  async getVendorDetails(vendorId, hotelId) {
    try {
      const vendor = await Vendor.findOne({ _id: vendorId, hotelId })
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email');

      if (!vendor) {
        throw new Error('Vendor not found');
      }

      // Get recent performance data
      const recentPerformance = await VendorPerformance.findOne({
        vendorId,
        hotelId,
        'period.type': 'monthly'
      }).sort({ 'period.year': -1, 'period.month': -1 });

      // Get recent orders
      const recentOrders = await PurchaseOrder.find({
        vendorId,
        hotelId
      })
      .sort({ orderDate: -1 })
      .limit(10)
      .select('poNumber status orderDate grandTotal expectedDeliveryDate');

      // Calculate additional metrics
      const orderStats = await this.getVendorOrderStatistics(vendorId, hotelId);

      return {
        vendor,
        performance: recentPerformance,
        recentOrders,
        orderStatistics: orderStats
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Calculate vendor performance metrics
   */
  async calculateVendorPerformance(vendorId, hotelId, period = 'monthly') {
    try {
      const vendor = await Vendor.findOne({ _id: vendorId, hotelId });
      if (!vendor) {
        throw new Error('Vendor not found');
      }

      // Get date range for period
      const now = new Date();
      let startDate, endDate;

      switch (period) {
        case 'weekly':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
          endDate = now;
          break;
        case 'monthly':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case 'quarterly':
          const quarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), quarter * 3, 1);
          endDate = new Date(now.getFullYear(), quarter * 3 + 3, 0);
          break;
        case 'yearly':
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = new Date(now.getFullYear(), 11, 31);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }

      // Get orders for the period
      const orders = await PurchaseOrder.find({
        vendorId,
        hotelId,
        orderDate: { $gte: startDate, $lte: endDate }
      });

      // Calculate metrics
      const metrics = this.calculateMetricsFromOrders(orders);

      // Create or update performance record
      const performanceData = {
        hotelId,
        vendorId,
        period: {
          type: period,
          year: now.getFullYear(),
          month: period === 'monthly' ? now.getMonth() + 1 : undefined,
          quarter: period === 'quarterly' ? Math.floor(now.getMonth() / 3) + 1 : undefined,
          week: period === 'weekly' ? this.getWeekNumber(now) : undefined,
          startDate,
          endDate
        },
        ...metrics,
        reviewDate: now,
        reviewedBy: vendor.updatedBy || vendor.createdBy
      };

      const performance = await VendorPerformance.findOneAndUpdate(
        {
          hotelId,
          vendorId,
          'period.type': period,
          'period.year': now.getFullYear(),
          'period.month': period === 'monthly' ? now.getMonth() + 1 : undefined,
          'period.quarter': period === 'quarterly' ? Math.floor(now.getMonth() / 3) + 1 : undefined,
          'period.week': period === 'weekly' ? this.getWeekNumber(now) : undefined
        },
        performanceData,
        { new: true, upsert: true }
      );

      return performance;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get vendor analytics and insights
   */
  async getVendorAnalytics(hotelId, period = 'monthly', filters = {}) {
    try {
      const { category, status, dateRange } = filters;

      // Build match query for vendors
      const vendorMatch = { hotelId };
      if (category) vendorMatch.categories = category;
      if (status) vendorMatch.status = { $in: Array.isArray(status) ? status : [status] };

      // Get vendor performance summary
      const performanceQuery = { hotelId, 'period.type': period };
      if (dateRange) {
        performanceQuery['period.startDate'] = { $gte: new Date(dateRange.start) };
        performanceQuery['period.endDate'] = { $lte: new Date(dateRange.end) };
      }

      const [
        vendorCount,
        topPerformers,
        poorPerformers,
        categoryStats,
        performanceStats,
        trendData
      ] = await Promise.all([
        // Total vendor count
        Vendor.countDocuments(vendorMatch),

        // Top performers
        VendorPerformance.find(performanceQuery)
          .populate('vendorId', 'name categories')
          .sort({ overallScore: -1 })
          .limit(10),

        // Poor performers
        VendorPerformance.find({
          ...performanceQuery,
          overallScore: { $lt: 2.5 }
        })
        .populate('vendorId', 'name categories')
        .sort({ overallScore: 1 })
        .limit(10),

        // Category statistics
        this.getCategoryStatistics(hotelId, period),

        // Overall performance statistics
        this.getOverallPerformanceStats(hotelId, period),

        // Trend data
        this.getPerformanceTrends(hotelId, period, 6)
      ]);

      return {
        summary: {
          totalVendors: vendorCount,
          activeVendors: await Vendor.countDocuments({
            ...vendorMatch,
            status: { $in: ['active', 'preferred'] }
          }),
          preferredVendors: await Vendor.countDocuments({
            ...vendorMatch,
            status: 'preferred'
          })
        },
        topPerformers,
        poorPerformers,
        categoryStats,
        performanceStats,
        trends: trendData
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get preferred vendors for a hotel
   */
  async getPreferredVendors(hotelId, category = null) {
    try {
      const query = {
        hotelId,
        status: 'preferred'
      };

      if (category) {
        query.categories = category;
      }

      const vendors = await Vendor.find(query)
        .sort({ 'performance.overallRating': -1 })
        .populate('createdBy', 'name');

      return vendors;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Compare multiple vendors
   */
  async compareVendors(hotelId, vendorIds) {
    try {
      if (!Array.isArray(vendorIds) || vendorIds.length < 2) {
        throw new Error('At least 2 vendors required for comparison');
      }

      const vendors = await Vendor.find({
        _id: { $in: vendorIds },
        hotelId
      });

      if (vendors.length !== vendorIds.length) {
        throw new Error('Some vendors not found');
      }

      // Get performance data for all vendors
      const performanceData = await VendorPerformance.find({
        vendorId: { $in: vendorIds },
        hotelId,
        'period.type': 'monthly'
      })
      .sort({ 'period.year': -1, 'period.month': -1 })
      .limit(vendorIds.length);

      // Get order statistics
      const orderStats = await Promise.all(
        vendorIds.map(vendorId => this.getVendorOrderStatistics(vendorId, hotelId))
      );

      return {
        vendors,
        performance: performanceData,
        orderStatistics: orderStats,
        comparison: this.generateComparison(vendors, performanceData, orderStats)
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate comprehensive vendor report
   */
  async generateVendorReport(hotelId, options = {}) {
    try {
      const {
        period = 'monthly',
        category,
        vendorId,
        includePerformance = true,
        includeOrders = true,
        includeFinancials = true
      } = options;

      let vendors;
      if (vendorId) {
        vendors = await Vendor.find({ _id: vendorId, hotelId });
      } else {
        const query = { hotelId };
        if (category) query.categories = category;
        vendors = await Vendor.find(query);
      }

      const report = {
        generatedAt: new Date(),
        period,
        category,
        vendors: []
      };

      for (const vendor of vendors) {
        const vendorReport = {
          vendor: vendor.toObject(),
          summary: {}
        };

        if (includePerformance) {
          vendorReport.performance = await VendorPerformance.findOne({
            vendorId: vendor._id,
            hotelId,
            'period.type': period
          }).sort({ 'period.year': -1, 'period.month': -1 });
        }

        if (includeOrders) {
          vendorReport.orderStatistics = await this.getVendorOrderStatistics(vendor._id, hotelId);
        }

        if (includeFinancials) {
          vendorReport.financials = await this.getVendorFinancials(vendor._id, hotelId);
        }

        report.vendors.push(vendorReport);
      }

      return report;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update vendor status
   */
  async updateVendorStatus(vendorId, hotelId, status, userId, reason = '') {
    try {
      const vendor = await Vendor.findOne({ _id: vendorId, hotelId });
      if (!vendor) {
        throw new Error('Vendor not found');
      }

      const oldStatus = vendor.status;
      vendor.status = status;
      vendor.updatedBy = userId;

      // Handle blacklisting
      if (status === 'blacklisted') {
        vendor.blacklistReason = reason;
        vendor.blacklistDate = new Date();
      }

      // Handle reactivation
      if (oldStatus === 'blacklisted' && status === 'active') {
        vendor.reactivationDate = new Date();
        vendor.blacklistReason = '';
      }

      // Update legacy fields for compatibility
      vendor.isActive = ['active', 'preferred'].includes(status);
      vendor.isPreferred = status === 'preferred';

      await vendor.save();
      return vendor;
    } catch (error) {
      throw error;
    }
  }

  // Helper methods

  /**
   * Calculate metrics from orders
   */
  calculateMetricsFromOrders(orders) {
    const metrics = {
      deliveryMetrics: {
        totalOrders: orders.length,
        onTimeDeliveries: 0,
        lateDeliveries: 0,
        onTimeDeliveryPercentage: 0,
        averageDeliveryTime: 0
      },
      qualityMetrics: {
        totalItemsReceived: 0,
        defectiveItems: 0,
        defectRate: 0,
        qualityScore: 3
      },
      costMetrics: {
        totalOrderValue: 0,
        averageOrderValue: 0,
        competitivenessScore: 3
      },
      orderMetrics: {
        totalOrders: orders.length,
        completedOrders: 0,
        cancelledOrders: 0,
        orderFulfillmentRate: 0
      }
    };

    if (orders.length === 0) return metrics;

    let totalDeliveryTime = 0;
    let deliveryTimeCount = 0;

    orders.forEach(order => {
      // Delivery metrics
      if (order.actualDeliveryDate && order.expectedDeliveryDate) {
        deliveryTimeCount++;
        const deliveryTime = Math.ceil(
          (order.actualDeliveryDate - order.orderDate) / (1000 * 60 * 60 * 24)
        );
        totalDeliveryTime += deliveryTime;

        if (order.actualDeliveryDate <= order.expectedDeliveryDate) {
          metrics.deliveryMetrics.onTimeDeliveries++;
        } else {
          metrics.deliveryMetrics.lateDeliveries++;
        }
      }

      // Order metrics
      if (['completed', 'fully_received'].includes(order.status)) {
        metrics.orderMetrics.completedOrders++;
      } else if (order.status === 'cancelled') {
        metrics.orderMetrics.cancelledOrders++;
      }

      // Cost metrics
      metrics.costMetrics.totalOrderValue += order.grandTotal || 0;

      // Quality metrics (from order items if available)
      if (order.items) {
        order.items.forEach(item => {
          metrics.qualityMetrics.totalItemsReceived += item.quantityReceived || 0;
        });
      }
    });

    // Calculate percentages and averages
    if (deliveryTimeCount > 0) {
      metrics.deliveryMetrics.onTimeDeliveryPercentage =
        (metrics.deliveryMetrics.onTimeDeliveries / deliveryTimeCount) * 100;
      metrics.deliveryMetrics.averageDeliveryTime = totalDeliveryTime / deliveryTimeCount;
    }

    if (orders.length > 0) {
      metrics.costMetrics.averageOrderValue =
        metrics.costMetrics.totalOrderValue / orders.length;
      metrics.orderMetrics.orderFulfillmentRate =
        (metrics.orderMetrics.completedOrders / orders.length) * 100;
    }

    return metrics;
  }

  /**
   * Get vendor order statistics
   */
  async getVendorOrderStatistics(vendorId, hotelId) {
    try {
      const stats = await PurchaseOrder.aggregate([
        {
          $match: {
            vendorId: new mongoose.Types.ObjectId(vendorId),
            hotelId: new mongoose.Types.ObjectId(hotelId)
          }
        },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalValue: { $sum: '$grandTotal' },
            avgOrderValue: { $avg: '$grandTotal' },
            completedOrders: {
              $sum: {
                $cond: [
                  { $in: ['$status', ['completed', 'fully_received']] },
                  1, 0
                ]
              }
            },
            cancelledOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
            },
            pendingOrders: {
              $sum: {
                $cond: [
                  { $in: ['$status', ['approved', 'sent_to_vendor', 'confirmed_by_vendor', 'in_transit', 'partially_received']] },
                  1, 0
                ]
              }
            }
          }
        }
      ]);

      return stats[0] || {
        totalOrders: 0,
        totalValue: 0,
        avgOrderValue: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        pendingOrders: 0
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get vendor financial data
   */
  async getVendorFinancials(vendorId, hotelId) {
    try {
      const vendor = await Vendor.findOne({ _id: vendorId, hotelId });
      if (!vendor) return null;

      // Get payment statistics from purchase orders
      const paymentStats = await PurchaseOrder.aggregate([
        {
          $match: {
            vendorId: new mongoose.Types.ObjectId(vendorId),
            hotelId: new mongoose.Types.ObjectId(hotelId)
          }
        },
        {
          $group: {
            _id: '$paymentStatus',
            count: { $sum: 1 },
            totalAmount: { $sum: '$grandTotal' }
          }
        }
      ]);

      return {
        creditLimit: vendor.paymentTerms?.creditLimit || 0,
        outstandingAmount: vendor.financial?.outstandingAmount || 0,
        paymentHistory: vendor.financial?.paymentHistory || [],
        paymentStats
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get category statistics
   */
  async getCategoryStatistics(hotelId, period) {
    try {
      return await VendorPerformance.aggregate([
        {
          $match: {
            hotelId: new mongoose.Types.ObjectId(hotelId),
            'period.type': period
          }
        },
        {
          $lookup: {
            from: 'vendors',
            localField: 'vendorId',
            foreignField: '_id',
            as: 'vendor'
          }
        },
        { $unwind: '$vendor' },
        { $unwind: '$vendor.categories' },
        {
          $group: {
            _id: '$vendor.categories',
            vendorCount: { $sum: 1 },
            avgPerformance: { $avg: '$overallScore' },
            avgDeliveryPerformance: { $avg: '$deliveryMetrics.onTimeDeliveryPercentage' },
            totalOrderValue: { $sum: '$costMetrics.totalOrderValue' }
          }
        },
        { $sort: { vendorCount: -1 } }
      ]);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get overall performance statistics
   */
  async getOverallPerformanceStats(hotelId, period) {
    try {
      return await VendorPerformance.aggregate([
        {
          $match: {
            hotelId: new mongoose.Types.ObjectId(hotelId),
            'period.type': period
          }
        },
        {
          $group: {
            _id: null,
            avgOverallScore: { $avg: '$overallScore' },
            avgDeliveryPerformance: { $avg: '$deliveryMetrics.onTimeDeliveryPercentage' },
            avgQualityScore: { $avg: '$qualityMetrics.qualityScore' },
            avgServiceScore: { $avg: '$serviceMetrics.communicationScore' },
            totalVendors: { $sum: 1 },
            excellentPerformers: {
              $sum: { $cond: [{ $gte: ['$overallScore', 4.5] }, 1, 0] }
            },
            goodPerformers: {
              $sum: { $cond: [{ $and: [{ $gte: ['$overallScore', 3.5] }, { $lt: ['$overallScore', 4.5] }] }, 1, 0] }
            },
            poorPerformers: {
              $sum: { $cond: [{ $lt: ['$overallScore', 2.5] }, 1, 0] }
            }
          }
        }
      ]);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get performance trends
   */
  async getPerformanceTrends(hotelId, period, months = 6) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(endDate.getMonth() - months);

      return await VendorPerformance.aggregate([
        {
          $match: {
            hotelId: new mongoose.Types.ObjectId(hotelId),
            'period.type': period,
            'period.startDate': { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              year: '$period.year',
              month: '$period.month'
            },
            avgOverallScore: { $avg: '$overallScore' },
            avgDeliveryPerformance: { $avg: '$deliveryMetrics.onTimeDeliveryPercentage' },
            avgQualityScore: { $avg: '$qualityMetrics.qualityScore' },
            vendorCount: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate comparison data
   */
  generateComparison(vendors, performanceData, orderStats) {
    const comparison = {
      metrics: ['overallScore', 'deliveryPerformance', 'qualityScore', 'serviceScore', 'totalOrders', 'totalValue'],
      data: []
    };

    vendors.forEach((vendor, index) => {
      const performance = performanceData.find(p => p.vendorId.toString() === vendor._id.toString());
      const orders = orderStats[index];

      comparison.data.push({
        vendorId: vendor._id,
        vendorName: vendor.name,
        metrics: {
          overallScore: performance?.overallScore || 0,
          deliveryPerformance: performance?.deliveryMetrics?.onTimeDeliveryPercentage || 0,
          qualityScore: performance?.qualityMetrics?.qualityScore || 0,
          serviceScore: performance?.serviceMetrics?.communicationScore || 0,
          totalOrders: orders?.totalOrders || 0,
          totalValue: orders?.totalValue || 0
        }
      });
    });

    return comparison;
  }

  /**
   * Get week number of year
   */
  getWeekNumber(date) {
    const oneJan = new Date(date.getFullYear(), 0, 1);
    return Math.ceil((((date - oneJan) / 86400000) + oneJan.getDay() + 1) / 7);
  }
}

export default new VendorService();