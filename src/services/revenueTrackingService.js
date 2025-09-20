import RevenueAccount from '../models/RevenueAccount.js';
import RoomType from '../models/RoomType.js';
import logger from '../utils/logger.js';

/**
 * Revenue Tracking Service
 * Handles revenue calculation, allocation, and reporting
 */
class RevenueTrackingService {
  /**
   * Calculate revenue allocation for a booking
   * @param {Object} bookingData - Booking information
   * @param {string} bookingData.hotelId - Hotel ID
   * @param {string} bookingData.roomTypeId - Room Type ID
   * @param {number} bookingData.baseAmount - Base room amount
   * @param {number} bookingData.roomCount - Number of rooms
   * @param {number} bookingData.guestCount - Number of guests
   * @param {number} bookingData.stayNights - Number of nights
   * @param {string} bookingData.channel - Booking channel
   * @param {string} bookingData.rateType - Rate type
   * @param {Array} bookingData.additionalCharges - Additional charges
   * @returns {Object} Revenue allocation result
   */
  async calculateRevenueAllocation(bookingData) {
    try {
      const {
        hotelId,
        roomTypeId,
        baseAmount,
        roomCount = 1,
        guestCount = 1,
        stayNights = 1,
        channel = 'direct',
        rateType = 'standard',
        additionalCharges = []
      } = bookingData;

      if (!hotelId || !baseAmount) {
        throw new Error('Hotel ID and base amount are required for revenue allocation');
      }

      // Get applicable revenue accounts
      const applicableAccounts = await RevenueAccount.getApplicableAccounts(hotelId, {
        roomTypeId,
        channel,
        rateType
      });

      const revenueAllocation = [];
      let totalAllocatedRevenue = 0;

      // Process main room revenue
      const roomRevenueAccount = applicableAccounts.find(
        account => account.accountType === 'primary' && account.revenueCategory === 'room_revenue'
      );

      if (roomRevenueAccount) {
        const allocation = this.createRevenueAllocation(
          roomRevenueAccount,
          baseAmount,
          { roomCount, guestCount, stayNights, channel, rateType }
        );
        revenueAllocation.push(allocation);
        totalAllocatedRevenue += allocation.allocatedAmount;
      }

      // Process additional charges
      for (const charge of additionalCharges) {
        const chargeAccount = await this.findRevenueAccountForCharge(
          hotelId,
          charge,
          { roomTypeId, channel, rateType }
        );

        if (chargeAccount) {
          const allocation = this.createRevenueAllocation(
            chargeAccount,
            charge.amount,
            { roomCount, guestCount, stayNights, channel, rateType, chargeType: charge.type }
          );
          revenueAllocation.push(allocation);
          totalAllocatedRevenue += allocation.allocatedAmount;
        }
      }

      // Process auto-calculated revenue accounts
      const autoAccounts = applicableAccounts.filter(
        account => account.autoCalculation.isEnabled
      );

      for (const account of autoAccounts) {
        const autoAmount = account.calculateAutoRevenue(baseAmount, {
          nights: stayNights,
          guests: guestCount
        });

        if (autoAmount > 0) {
          const allocation = this.createRevenueAllocation(
            account,
            autoAmount,
            { roomCount, guestCount, stayNights, channel, rateType, isAutoCalculated: true }
          );
          revenueAllocation.push(allocation);
          totalAllocatedRevenue += allocation.allocatedAmount;
        }
      }

      return {
        totalBaseAmount: baseAmount,
        totalAllocatedRevenue: Math.round(totalAllocatedRevenue * 100) / 100,
        revenueAllocation,
        allocationSummary: this.generateAllocationSummary(revenueAllocation),
        applicableAccounts: applicableAccounts.map(account => ({
          id: account._id,
          code: account.accountCode,
          name: account.accountName,
          category: account.revenueCategory
        }))
      };

    } catch (error) {
      logger.error('Revenue allocation calculation failed:', {
        error: error.message,
        bookingData,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Create revenue allocation entry
   * @param {Object} account - Revenue account
   * @param {number} amount - Amount to allocate
   * @param {Object} criteria - Additional criteria
   * @returns {Object} Revenue allocation entry
   */
  createRevenueAllocation(account, amount, criteria = {}) {
    const allocatedAmount = criteria.isAutoCalculated 
      ? amount 
      : Math.round(amount * 100) / 100;

    return {
      accountId: account._id,
      accountCode: account.accountCode,
      accountName: account.accountName,
      revenueCategory: account.revenueCategory,
      accountType: account.accountType,
      allocatedAmount,
      glAccountCode: account.glAccountCode,
      reportingGroup: account.reportingGroup,
      baseAmount: criteria.isAutoCalculated ? criteria.baseAmount || amount : amount,
      calculationMethod: criteria.isAutoCalculated ? account.autoCalculation.calculationMethod : 'direct',
      isAutoCalculated: criteria.isAutoCalculated || false,
      criteria: {
        roomCount: criteria.roomCount || 1,
        guestCount: criteria.guestCount || 1,
        stayNights: criteria.stayNights || 1,
        channel: criteria.channel || 'direct',
        rateType: criteria.rateType || 'standard'
      }
    };
  }

  /**
   * Find revenue account for specific charge type
   * @param {string} hotelId - Hotel ID
   * @param {Object} charge - Charge object
   * @param {Object} criteria - Search criteria
   * @returns {Object} Revenue account
   */
  async findRevenueAccountForCharge(hotelId, charge, criteria = {}) {
    const chargeTypeMapping = {
      'upgrade': 'upgrade_revenue',
      'package': 'package_revenue',
      'addon': 'addon_revenue',
      'fee': 'fee_revenue',
      'penalty': 'penalty_revenue',
      'deposit': 'deposit_revenue'
    };

    const revenueCategory = chargeTypeMapping[charge.type] || 'other_revenue';

    const account = await RevenueAccount.findOne({
      hotelId,
      revenueCategory,
      isActive: true,
      validFrom: { $lte: new Date() },
      $or: [
        { validTo: { $exists: false } },
        { validTo: { $gte: new Date() } }
      ]
    }).populate('applicableRoomTypes');

    if (account && account.isApplicable(criteria)) {
      return account;
    }

    return null;
  }

  /**
   * Generate allocation summary
   * @param {Array} allocations - Revenue allocations
   * @returns {Object} Allocation summary
   */
  generateAllocationSummary(allocations) {
    const summary = {
      byCategory: {},
      byType: {},
      byReportingGroup: {},
      totalAmount: 0
    };

    allocations.forEach(allocation => {
      summary.totalAmount += allocation.allocatedAmount;

      // By category
      if (!summary.byCategory[allocation.revenueCategory]) {
        summary.byCategory[allocation.revenueCategory] = {
          category: allocation.revenueCategory,
          amount: 0,
          count: 0,
          accounts: []
        };
      }
      summary.byCategory[allocation.revenueCategory].amount += allocation.allocatedAmount;
      summary.byCategory[allocation.revenueCategory].count++;
      summary.byCategory[allocation.revenueCategory].accounts.push(allocation.accountCode);

      // By type
      if (!summary.byType[allocation.accountType]) {
        summary.byType[allocation.accountType] = {
          type: allocation.accountType,
          amount: 0,
          count: 0,
          accounts: []
        };
      }
      summary.byType[allocation.accountType].amount += allocation.allocatedAmount;
      summary.byType[allocation.accountType].count++;
      summary.byType[allocation.accountType].accounts.push(allocation.accountCode);

      // By reporting group
      if (!summary.byReportingGroup[allocation.reportingGroup]) {
        summary.byReportingGroup[allocation.reportingGroup] = {
          group: allocation.reportingGroup,
          amount: 0,
          count: 0,
          accounts: []
        };
      }
      summary.byReportingGroup[allocation.reportingGroup].amount += allocation.allocatedAmount;
      summary.byReportingGroup[allocation.reportingGroup].count++;
      summary.byReportingGroup[allocation.reportingGroup].accounts.push(allocation.accountCode);
    });

    // Round all amounts
    Object.values(summary.byCategory).forEach(cat => {
      cat.amount = Math.round(cat.amount * 100) / 100;
      cat.accounts = [...new Set(cat.accounts)]; // Remove duplicates
    });

    Object.values(summary.byType).forEach(type => {
      type.amount = Math.round(type.amount * 100) / 100;
      type.accounts = [...new Set(type.accounts)];
    });

    Object.values(summary.byReportingGroup).forEach(group => {
      group.amount = Math.round(group.amount * 100) / 100;
      group.accounts = [...new Set(group.accounts)];
    });

    summary.totalAmount = Math.round(summary.totalAmount * 100) / 100;

    return summary;
  }

  /**
   * Record revenue transaction
   * @param {Object} transactionData - Transaction data
   * @returns {Object} Transaction result
   */
  async recordRevenueTransaction(transactionData) {
    try {
      const {
        hotelId,
        bookingId,
        revenueAllocations,
        transactionDate = new Date(),
        transactionType = 'booking',
        referenceNumber
      } = transactionData;

      const transactionResults = [];

      for (const allocation of revenueAllocations) {
        // Update account audit info
        await RevenueAccount.findByIdAndUpdate(
          allocation.accountId,
          {
            $inc: {
              'auditInfo.totalRevenue': allocation.allocatedAmount,
              'auditInfo.transactionCount': 1
            },
            'auditInfo.lastRevenueDate': transactionDate
          }
        );

        transactionResults.push({
          accountId: allocation.accountId,
          accountCode: allocation.accountCode,
          amount: allocation.allocatedAmount,
          transactionDate,
          transactionType,
          referenceNumber,
          bookingId
        });
      }

      logger.info('Revenue transaction recorded:', {
        hotelId,
        bookingId,
        totalAllocations: revenueAllocations.length,
        totalAmount: revenueAllocations.reduce((sum, alloc) => sum + alloc.allocatedAmount, 0)
      });

      return {
        success: true,
        transactionResults,
        totalAmount: Math.round(revenueAllocations.reduce((sum, alloc) => sum + alloc.allocatedAmount, 0) * 100) / 100
      };

    } catch (error) {
      logger.error('Revenue transaction recording failed:', {
        error: error.message,
        transactionData,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Generate revenue report
   * @param {string} hotelId - Hotel ID
   * @param {Object} filters - Report filters
   * @returns {Object} Revenue report
   */
  async generateRevenueReport(hotelId, filters = {}) {
    try {
      const {
        startDate,
        endDate,
        revenueCategory,
        accountType,
        reportingGroup,
        groupBy = 'category'
      } = filters;

      const matchQuery = { hotelId };
      
      if (startDate || endDate) {
        matchQuery['auditInfo.lastRevenueDate'] = {};
        if (startDate) matchQuery['auditInfo.lastRevenueDate'].$gte = new Date(startDate);
        if (endDate) matchQuery['auditInfo.lastRevenueDate'].$lte = new Date(endDate);
      }

      if (revenueCategory) matchQuery.revenueCategory = revenueCategory;
      if (accountType) matchQuery.accountType = accountType;
      if (reportingGroup) matchQuery.reportingGroup = reportingGroup;

      const accounts = await RevenueAccount.find(matchQuery)
        .populate('parentAccount', 'accountCode accountName')
        .sort({ revenueCategory: 1, accountCode: 1 });

      const report = {
        reportDate: new Date().toISOString(),
        filters,
        summary: {
          totalAccounts: accounts.length,
          totalRevenue: 0,
          totalTransactions: 0,
          averageRevenuePerAccount: 0,
          averageRevenuePerTransaction: 0
        },
        groupedData: {},
        accountDetails: []
      };

      let totalRevenue = 0;
      let totalTransactions = 0;

      accounts.forEach(account => {
        const accountRevenue = account.auditInfo.totalRevenue || 0;
        const accountTransactions = account.auditInfo.transactionCount || 0;

        totalRevenue += accountRevenue;
        totalTransactions += accountTransactions;

        // Group data
        const groupKey = this.getGroupKey(account, groupBy);
        if (!report.groupedData[groupKey]) {
          report.groupedData[groupKey] = {
            groupName: groupKey,
            accountCount: 0,
            totalRevenue: 0,
            totalTransactions: 0,
            accounts: []
          };
        }

        report.groupedData[groupKey].accountCount++;
        report.groupedData[groupKey].totalRevenue += accountRevenue;
        report.groupedData[groupKey].totalTransactions += accountTransactions;
        report.groupedData[groupKey].accounts.push({
          code: account.accountCode,
          name: account.accountName,
          revenue: accountRevenue,
          transactions: accountTransactions
        });

        // Account details
        report.accountDetails.push({
          accountId: account._id,
          accountCode: account.accountCode,
          accountName: account.accountName,
          revenueCategory: account.revenueCategory,
          accountType: account.accountType,
          reportingGroup: account.reportingGroup,
          revenue: accountRevenue,
          transactions: accountTransactions,
          averagePerTransaction: accountTransactions > 0 ? accountRevenue / accountTransactions : 0,
          lastRevenueDate: account.auditInfo.lastRevenueDate,
          budgetVariance: accountRevenue - (account.budgetInfo.yearlyBudget || 0),
          parentAccount: account.parentAccount ? {
            code: account.parentAccount.accountCode,
            name: account.parentAccount.accountName
          } : null
        });
      });

      // Calculate summary
      report.summary.totalRevenue = Math.round(totalRevenue * 100) / 100;
      report.summary.totalTransactions = totalTransactions;
      report.summary.averageRevenuePerAccount = accounts.length > 0 
        ? Math.round((totalRevenue / accounts.length) * 100) / 100 
        : 0;
      report.summary.averageRevenuePerTransaction = totalTransactions > 0 
        ? Math.round((totalRevenue / totalTransactions) * 100) / 100 
        : 0;

      // Round grouped data
      Object.values(report.groupedData).forEach(group => {
        group.totalRevenue = Math.round(group.totalRevenue * 100) / 100;
        group.averageRevenuePerAccount = group.accountCount > 0 
          ? Math.round((group.totalRevenue / group.accountCount) * 100) / 100 
          : 0;
      });

      return report;

    } catch (error) {
      logger.error('Revenue report generation failed:', {
        error: error.message,
        hotelId,
        filters,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get group key for report grouping
   * @param {Object} account - Revenue account
   * @param {string} groupBy - Grouping method
   * @returns {string} Group key
   */
  getGroupKey(account, groupBy) {
    switch (groupBy) {
      case 'category':
        return account.revenueCategory;
      case 'type':
        return account.accountType;
      case 'reporting_group':
        return account.reportingGroup;
      case 'parent':
        return account.parentAccount 
          ? account.parentAccount.accountName 
          : 'Top Level';
      default:
        return account.revenueCategory;
    }
  }

  /**
   * Get budget vs actual analysis
   * @param {string} hotelId - Hotel ID
   * @param {Object} filters - Analysis filters
   * @returns {Object} Budget analysis
   */
  async getBudgetAnalysis(hotelId, filters = {}) {
    try {
      const { period = 'yearly', startDate, endDate } = filters;

      const matchQuery = { hotelId, isActive: true };

      const accounts = await RevenueAccount.find(matchQuery);

      const analysis = {
        period,
        totalBudget: 0,
        totalActual: 0,
        totalVariance: 0,
        variancePercentage: 0,
        accountAnalysis: [],
        categoryAnalysis: {},
        performanceMetrics: {
          overPerforming: 0,
          underPerforming: 0,
          onTarget: 0
        }
      };

      let totalBudget = 0;
      let totalActual = 0;
      const categoryData = {};

      accounts.forEach(account => {
        const budgetAmount = period === 'yearly' 
          ? account.budgetInfo.yearlyBudget 
          : account.budgetInfo.monthlyBudget * 12;
        const actualAmount = account.auditInfo.totalRevenue || 0;
        const variance = actualAmount - budgetAmount;
        const variancePercentage = budgetAmount > 0 ? (variance / budgetAmount) * 100 : 0;

        totalBudget += budgetAmount;
        totalActual += actualAmount;

        // Performance classification
        if (Math.abs(variancePercentage) <= 5) {
          analysis.performanceMetrics.onTarget++;
        } else if (variancePercentage > 5) {
          analysis.performanceMetrics.overPerforming++;
        } else {
          analysis.performanceMetrics.underPerforming++;
        }

        // Account analysis
        analysis.accountAnalysis.push({
          accountCode: account.accountCode,
          accountName: account.accountName,
          revenueCategory: account.revenueCategory,
          budget: budgetAmount,
          actual: actualAmount,
          variance,
          variancePercentage: Math.round(variancePercentage * 100) / 100,
          performance: this.getPerformanceRating(variancePercentage)
        });

        // Category analysis
        if (!categoryData[account.revenueCategory]) {
          categoryData[account.revenueCategory] = {
            budget: 0,
            actual: 0,
            accountCount: 0
          };
        }
        categoryData[account.revenueCategory].budget += budgetAmount;
        categoryData[account.revenueCategory].actual += actualAmount;
        categoryData[account.revenueCategory].accountCount++;
      });

      // Calculate totals and percentages
      analysis.totalBudget = Math.round(totalBudget * 100) / 100;
      analysis.totalActual = Math.round(totalActual * 100) / 100;
      analysis.totalVariance = Math.round((totalActual - totalBudget) * 100) / 100;
      analysis.variancePercentage = totalBudget > 0 
        ? Math.round(((totalActual - totalBudget) / totalBudget) * 10000) / 100 
        : 0;

      // Process category analysis
      Object.keys(categoryData).forEach(category => {
        const data = categoryData[category];
        const variance = data.actual - data.budget;
        const variancePercentage = data.budget > 0 ? (variance / data.budget) * 100 : 0;

        analysis.categoryAnalysis[category] = {
          category,
          budget: Math.round(data.budget * 100) / 100,
          actual: Math.round(data.actual * 100) / 100,
          variance: Math.round(variance * 100) / 100,
          variancePercentage: Math.round(variancePercentage * 100) / 100,
          accountCount: data.accountCount
        };
      });

      return analysis;

    } catch (error) {
      logger.error('Budget analysis failed:', {
        error: error.message,
        hotelId,
        filters,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get performance rating based on variance percentage
   * @param {number} variancePercentage - Variance percentage
   * @returns {string} Performance rating
   */
  getPerformanceRating(variancePercentage) {
    if (variancePercentage >= 10) return 'excellent';
    if (variancePercentage >= 5) return 'good';
    if (variancePercentage >= -5) return 'on_target';
    if (variancePercentage >= -10) return 'below_target';
    return 'poor';
  }

  /**
   * Update account audit information
   * @param {string} accountId - Account ID
   * @param {Object} auditData - Audit data
   * @returns {Object} Update result
   */
  async updateAccountAudit(accountId, auditData) {
    try {
      const updateData = {
        'auditInfo.lastAuditDate': new Date()
      };

      if (auditData.totalRevenue !== undefined) {
        updateData['auditInfo.totalRevenue'] = auditData.totalRevenue;
      }
      if (auditData.transactionCount !== undefined) {
        updateData['auditInfo.transactionCount'] = auditData.transactionCount;
      }
      if (auditData.lastRevenueDate) {
        updateData['auditInfo.lastRevenueDate'] = new Date(auditData.lastRevenueDate);
      }

      const account = await RevenueAccount.findByIdAndUpdate(
        accountId,
        updateData,
        { new: true }
      );

      return {
        success: true,
        account
      };

    } catch (error) {
      logger.error('Account audit update failed:', {
        error: error.message,
        accountId,
        auditData
      });
      throw error;
    }
  }
}

export default new RevenueTrackingService();