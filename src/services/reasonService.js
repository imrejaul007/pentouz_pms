import Reason from '../models/Reason.js';
import mongoose from 'mongoose';

class ReasonService {
  
  // Create a new reason
  async createReason(reasonData, userId) {
    try {
      const reason = new Reason({
        ...reasonData,
        createdBy: userId
      });

      // Validate reason code uniqueness
      const existingReason = await Reason.findOne({ 
        code: reasonData.code,
        hotelId: reasonData.hotelId 
      });

      if (existingReason) {
        throw new Error('Reason code already exists for this hotel');
      }

      await reason.save();
      return await this.getReasonById(reason._id, { populate: true });
    } catch (error) {
      throw new Error(`Failed to create reason: ${error.message}`);
    }
  }

  // Get reason by ID
  async getReasonById(reasonId, options = {}) {
    try {
      const { populate = false, includeUsageLog = false } = options;

      let query = Reason.findById(reasonId);

      if (populate) {
        query = query
          .populate('applicableDepartments', 'name code')
          .populate('createdBy', 'name email')
          .populate('updatedBy', 'name email');
      }

      if (includeUsageLog) {
        query = query.populate('usageLog.usedBy', 'name email');
      }

      const reason = await query.exec();

      if (!reason) {
        throw new Error('Reason not found');
      }

      return reason;
    } catch (error) {
      throw new Error(`Failed to get reason: ${error.message}`);
    }
  }

  // Get all reasons for a hotel
  async getReasonsByHotel(hotelId, options = {}) {
    try {
      const {
        category,
        isActive,
        userRole,
        departmentId,
        page = 1,
        limit = 50,
        sortBy = 'name',
        sortOrder = 'asc'
      } = options;

      const filter = { hotelId };
      
      if (category) filter.category = category;
      if (typeof isActive === 'boolean') filter.isActive = isActive;

      // Role-based filtering
      if (userRole) {
        filter.$and = [
          {
            $or: [
              { allowedRoles: { $in: [userRole] } },
              { allowedRoles: { $size: 0 } }
            ]
          },
          { restrictedRoles: { $nin: [userRole] } }
        ];
      }

      // Department-based filtering
      if (departmentId) {
        filter.$or = [
          { applicableDepartments: { $in: [departmentId] } },
          { applicableDepartments: { $size: 0 } }
        ];
      }

      const skip = (page - 1) * limit;
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const [reasons, total] = await Promise.all([
        Reason.find(filter)
          .populate('applicableDepartments', 'name code')
          .sort(sortOptions)
          .skip(skip)
          .limit(limit),
        Reason.countDocuments(filter)
      ]);

      return {
        reasons,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new Error(`Failed to get reasons: ${error.message}`);
    }
  }

  // Update reason
  async updateReason(reasonId, updateData, userId) {
    try {
      const reason = await Reason.findById(reasonId);

      if (!reason) {
        throw new Error('Reason not found');
      }

      // Prevent modification of system reasons without proper permissions
      if (reason.isSystemReason && !updateData.allowSystemModification) {
        throw new Error('System reasons require special permissions to modify');
      }

      // Update fields
      Object.keys(updateData).forEach(key => {
        if (key !== '_id' && key !== 'createdBy' && key !== 'createdAt' && key !== 'allowSystemModification') {
          reason[key] = updateData[key];
        }
      });

      reason.updatedBy = userId;
      await reason.save();

      return await this.getReasonById(reasonId, { populate: true });
    } catch (error) {
      throw new Error(`Failed to update reason: ${error.message}`);
    }
  }

  // Delete reason
  async deleteReason(reasonId, userId) {
    try {
      const reason = await Reason.findById(reasonId);

      if (!reason) {
        throw new Error('Reason not found');
      }

      // Check if it's a system reason
      if (reason.isSystemReason) {
        throw new Error('Cannot delete system reason');
      }

      // Check usage in the last 30 days
      const recentUsage = reason.usageLog.filter(
        log => log.usedAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      );

      if (recentUsage.length > 0) {
        throw new Error('Cannot delete reason that has been used in the last 30 days');
      }

      await Reason.findByIdAndDelete(reasonId);
      return { message: 'Reason deleted successfully' };
    } catch (error) {
      throw new Error(`Failed to delete reason: ${error.message}`);
    }
  }

  // Get reasons by category
  async getReasonsByCategory(hotelId, category, options = {}) {
    try {
      return await Reason.findByCategory(hotelId, category, options);
    } catch (error) {
      throw new Error(`Failed to get reasons by category: ${error.message}`);
    }
  }

  // Get reasons by user role
  async getReasonsByRole(hotelId, userRole, options = {}) {
    try {
      return await Reason.findByRole(hotelId, userRole, options);
    } catch (error) {
      throw new Error(`Failed to get reasons by role: ${error.message}`);
    }
  }

  // Get most used reasons
  async getMostUsedReasons(hotelId, limit = 10) {
    try {
      return await Reason.getMostUsed(hotelId, limit);
    } catch (error) {
      throw new Error(`Failed to get most used reasons: ${error.message}`);
    }
  }

  // Log reason usage
  async logReasonUsage(reasonId, userId, context, entityId, entityType, options = {}) {
    try {
      const reason = await Reason.findById(reasonId);

      if (!reason) {
        throw new Error('Reason not found');
      }

      if (!reason.isActive) {
        throw new Error('Cannot use inactive reason');
      }

      await reason.logUsage(userId, context, entityId, entityType, options);
      return reason;
    } catch (error) {
      throw new Error(`Failed to log reason usage: ${error.message}`);
    }
  }

  // Search reasons
  async searchReasons(hotelId, searchQuery, options = {}) {
    try {
      const { category, userRole, limit = 20 } = options;

      const searchRegex = new RegExp(searchQuery, 'i');
      const filter = {
        hotelId,
        $or: [
          { name: searchRegex },
          { description: searchRegex },
          { code: searchRegex }
        ]
      };

      if (category) filter.category = category;

      // Role-based filtering
      if (userRole) {
        filter.$and = [
          {
            $or: [
              { allowedRoles: { $in: [userRole] } },
              { allowedRoles: { $size: 0 } }
            ]
          },
          { restrictedRoles: { $nin: [userRole] } }
        ];
      }

      const reasons = await Reason.find(filter)
        .populate('applicableDepartments', 'name code')
        .limit(limit)
        .sort({ 'usage.totalUsed': -1, name: 1 });

      return reasons;
    } catch (error) {
      throw new Error(`Failed to search reasons: ${error.message}`);
    }
  }

  // Bulk operations
  async bulkUpdateReasons(hotelId, updates, userId) {
    try {
      const results = [];

      for (const update of updates) {
        try {
          const result = await this.updateReason(update.reasonId, update.data, userId);
          results.push({ success: true, reasonId: update.reasonId, data: result });
        } catch (error) {
          results.push({ 
            success: false, 
            reasonId: update.reasonId, 
            error: error.message 
          });
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to perform bulk updates: ${error.message}`);
    }
  }

  async bulkCreateReasons(hotelId, reasonsData, userId) {
    try {
      const results = [];

      for (const reasonData of reasonsData) {
        try {
          const result = await this.createReason({ ...reasonData, hotelId }, userId);
          results.push({ success: true, data: result });
        } catch (error) {
          results.push({ 
            success: false, 
            reasonData: reasonData.name || reasonData.code || 'Unknown',
            error: error.message 
          });
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to perform bulk creation: ${error.message}`);
    }
  }

  // Export reasons
  async exportReasons(hotelId, format = 'json') {
    try {
      const reasons = await Reason.find({ hotelId })
        .populate('applicableDepartments', 'name code')
        .populate('createdBy', 'name email')
        .sort({ category: 1, name: 1 });

      if (format === 'csv') {
        return this.convertToCSV(reasons);
      }

      return reasons;
    } catch (error) {
      throw new Error(`Failed to export reasons: ${error.message}`);
    }
  }

  // Get reason statistics
  async getReasonStats(hotelId) {
    try {
      const [categoryStats, overallStats] = await Promise.all([
        Reason.getReasonStats(hotelId),
        this.getOverallStats(hotelId)
      ]);

      return {
        categoryBreakdown: categoryStats,
        overall: overallStats,
        generatedAt: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to get reason statistics: ${error.message}`);
    }
  }

  // Get reason usage analytics
  async getUsageAnalytics(hotelId, period = '30d') {
    try {
      const days = this.getPeriodInDays(period);
      const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const reasons = await Reason.find({ hotelId });
      
      const analytics = {
        period,
        totalReasons: reasons.length,
        activeReasons: reasons.filter(r => r.isActive).length,
        mostUsed: reasons
          .sort((a, b) => b.usage.totalUsed - a.usage.totalUsed)
          .slice(0, 10)
          .map(r => ({
            name: r.name,
            code: r.code,
            category: r.category,
            totalUsed: r.usage.totalUsed,
            lastUsed: r.usage.lastUsed,
            avgFinancialImpact: r.usage.avgFinancialImpact
          })),
        usageByCategory: {},
        trendsOverTime: []
      };

      // Calculate usage by category
      reasons.forEach(reason => {
        if (!analytics.usageByCategory[reason.category]) {
          analytics.usageByCategory[reason.category] = {
            count: 0,
            totalUsage: 0,
            avgFinancialImpact: 0
          };
        }
        
        analytics.usageByCategory[reason.category].count += 1;
        analytics.usageByCategory[reason.category].totalUsage += reason.usage.totalUsed;
        analytics.usageByCategory[reason.category].avgFinancialImpact += reason.usage.avgFinancialImpact;
      });

      return analytics;
    } catch (error) {
      throw new Error(`Failed to get usage analytics: ${error.message}`);
    }
  }

  // Helper methods
  async getOverallStats(hotelId) {
    const reasons = await Reason.find({ hotelId });
    
    return {
      total: reasons.length,
      active: reasons.filter(r => r.isActive).length,
      inactive: reasons.filter(r => !r.isActive).length,
      systemReasons: reasons.filter(r => r.isSystemReason).length,
      totalUsage: reasons.reduce((sum, r) => sum + r.usage.totalUsed, 0),
      avgUsagePerReason: reasons.length > 0 
        ? (reasons.reduce((sum, r) => sum + r.usage.totalUsed, 0) / reasons.length).toFixed(2)
        : 0,
      categoriesUsed: [...new Set(reasons.map(r => r.category))].length,
      lastActivity: Math.max(...reasons.map(r => r.usage.lastUsed || r.createdAt).map(d => new Date(d)))
    };
  }

  getPeriodInDays(period) {
    const periods = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365
    };
    return periods[period] || 30;
  }

  convertToCSV(reasons) {
    const headers = [
      'ID', 'Name', 'Code', 'Category', 'Subcategory', 'Description', 
      'Is Active', 'Requires Approval', 'Allows Refund', 'Max Refund %',
      'Allows Discount', 'Max Discount %', 'Total Used', 'Last Used',
      'Created At', 'Created By'
    ];

    const rows = reasons.map(reason => [
      reason._id,
      reason.name,
      reason.code,
      reason.category,
      reason.subcategory || '',
      reason.description || '',
      reason.isActive,
      reason.requiresApproval,
      reason.allowsRefund,
      reason.maxRefundPercentage,
      reason.allowsDiscount,
      reason.maxDiscountPercentage,
      reason.usage.totalUsed,
      reason.usage.lastUsed || '',
      reason.createdAt,
      reason.createdBy?.name || reason.createdBy
    ]);

    return [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
  }

  // Validate reason can be used
  async validateReasonUsage(reasonId, userId, context, options = {}) {
    try {
      const reason = await this.getReasonById(reasonId, { populate: true });
      const user = options.user;

      if (!reason.isActive) {
        return { valid: false, reason: 'Reason is inactive' };
      }

      if (user && !reason.canBeUsedBy(user)) {
        return { valid: false, reason: 'User not authorized to use this reason' };
      }

      const approvalRequired = reason.requiresApprovalFor(context, options.amount);
      
      return {
        valid: true,
        approvalRequired,
        requiresComments: reason.requiresComments,
        requiresDocumentation: reason.requiresDocumentation,
        allowsRefund: reason.allowsRefund,
        maxRefundPercentage: reason.maxRefundPercentage,
        allowsDiscount: reason.allowsDiscount,
        maxDiscountPercentage: reason.maxDiscountPercentage
      };
    } catch (error) {
      throw new Error(`Failed to validate reason usage: ${error.message}`);
    }
  }
}

export default new ReasonService();