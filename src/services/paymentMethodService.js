import PaymentMethod from '../models/PaymentMethod.js';
import mongoose from 'mongoose';

class PaymentMethodService {
  
  // Create a new payment method
  async createPaymentMethod(paymentMethodData, userId) {
    try {
      const paymentMethod = new PaymentMethod({
        ...paymentMethodData,
        createdBy: userId
      });

      // Validate payment method code uniqueness
      const existingPaymentMethod = await PaymentMethod.findOne({ 
        code: paymentMethodData.code,
        hotelId: paymentMethodData.hotelId 
      });

      if (existingPaymentMethod) {
        throw new Error('Payment method code already exists for this hotel');
      }

      // Validate gateway configuration for non-manual methods
      if (paymentMethodData.gateway && paymentMethodData.gateway.provider !== 'manual') {
        this.validateGatewayConfiguration(paymentMethodData.gateway);
      }

      await paymentMethod.save();
      
      // Add audit entry
      await paymentMethod.addAuditEntry(
        'payment_method_created',
        userId,
        { paymentMethodData },
        null,
        null
      );

      return await this.getPaymentMethodById(paymentMethod._id, { populate: true });
    } catch (error) {
      throw new Error(`Failed to create payment method: ${error.message}`);
    }
  }

  // Get payment method by ID
  async getPaymentMethodById(paymentMethodId, options = {}) {
    try {
      const { populate = false, includeAnalytics = false } = options;

      let query = PaymentMethod.findById(paymentMethodId);

      if (populate) {
        query = query
          .populate('applicableDepartments', 'name code')
          .populate('createdBy', 'name email')
          .populate('updatedBy', 'name email');
      }

      const paymentMethod = await query.exec();

      if (!paymentMethod) {
        throw new Error('Payment method not found');
      }

      if (includeAnalytics) {
        const analytics = await this.getPaymentMethodAnalytics(paymentMethodId);
        return {
          paymentMethod: paymentMethod.toObject(),
          analytics
        };
      }

      return paymentMethod;
    } catch (error) {
      throw new Error(`Failed to get payment method: ${error.message}`);
    }
  }

  // Get all payment methods for a hotel
  async getPaymentMethodsByHotel(hotelId, options = {}) {
    try {
      const {
        type,
        isActive,
        userRole,
        departmentId,
        includeOffline = true,
        page = 1,
        limit = 50,
        sortBy = 'display.order',
        sortOrder = 'asc'
      } = options;

      const filter = { hotelId };
      
      if (type) filter.type = type;
      if (typeof isActive === 'boolean') filter.isActive = isActive;
      if (!includeOffline) filter.isOnline = true;

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

      const [paymentMethods, total] = await Promise.all([
        PaymentMethod.find(filter)
          .populate('applicableDepartments', 'name code')
          .sort(sortOptions)
          .skip(skip)
          .limit(limit),
        PaymentMethod.countDocuments(filter)
      ]);

      return {
        paymentMethods,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new Error(`Failed to get payment methods: ${error.message}`);
    }
  }

  // Update payment method
  async updatePaymentMethod(paymentMethodId, updateData, userId) {
    try {
      const paymentMethod = await PaymentMethod.findById(paymentMethodId);

      if (!paymentMethod) {
        throw new Error('Payment method not found');
      }

      // Store original data for audit
      const originalData = paymentMethod.toObject();

      // Validate gateway configuration if being updated
      if (updateData.gateway && updateData.gateway.provider !== 'manual') {
        this.validateGatewayConfiguration(updateData.gateway);
      }

      // Update fields
      Object.keys(updateData).forEach(key => {
        if (key !== '_id' && key !== 'createdBy' && key !== 'createdAt') {
          if (key.includes('.')) {
            // Handle nested objects
            const keys = key.split('.');
            let current = paymentMethod;
            for (let i = 0; i < keys.length - 1; i++) {
              if (!current[keys[i]]) current[keys[i]] = {};
              current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = updateData[key];
          } else {
            paymentMethod[key] = updateData[key];
          }
        }
      });

      paymentMethod.updatedBy = userId;
      await paymentMethod.save();

      // Add audit entry
      await paymentMethod.addAuditEntry(
        'payment_method_updated',
        userId,
        {
          before: originalData,
          after: updateData
        },
        null,
        null
      );

      return await this.getPaymentMethodById(paymentMethodId, { populate: true });
    } catch (error) {
      throw new Error(`Failed to update payment method: ${error.message}`);
    }
  }

  // Delete payment method
  async deletePaymentMethod(paymentMethodId, userId) {
    try {
      const paymentMethod = await PaymentMethod.findById(paymentMethodId);

      if (!paymentMethod) {
        throw new Error('Payment method not found');
      }

      // Check if payment method has recent transactions
      if (paymentMethod.analytics.totalTransactions > 0) {
        const recentTransactionThreshold = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days
        if (paymentMethod.analytics.lastTransaction > recentTransactionThreshold) {
          throw new Error('Cannot delete payment method with recent transactions');
        }
      }

      // Add final audit entry
      await paymentMethod.addAuditEntry(
        'payment_method_deleted',
        userId,
        { paymentMethodName: paymentMethod.name, paymentMethodCode: paymentMethod.code },
        null,
        null
      );

      await PaymentMethod.findByIdAndDelete(paymentMethodId);
      return { message: 'Payment method deleted successfully' };
    } catch (error) {
      throw new Error(`Failed to delete payment method: ${error.message}`);
    }
  }

  // Get payment methods by type
  async getPaymentMethodsByType(hotelId, type, options = {}) {
    try {
      return await PaymentMethod.findByType(hotelId, type, options);
    } catch (error) {
      throw new Error(`Failed to get payment methods by type: ${error.message}`);
    }
  }

  // Get available payment methods at specific time
  async getAvailablePaymentMethods(hotelId, dateTime = new Date()) {
    try {
      return await PaymentMethod.findAvailableAt(hotelId, dateTime);
    } catch (error) {
      throw new Error(`Failed to get available payment methods: ${error.message}`);
    }
  }

  // Test gateway connection
  async testGatewayConnection(paymentMethodId) {
    try {
      const paymentMethod = await PaymentMethod.findById(paymentMethodId);
      
      if (!paymentMethod) {
        throw new Error('Payment method not found');
      }

      if (paymentMethod.gateway.provider === 'manual') {
        return { success: true, message: 'Manual payment method - no gateway test needed' };
      }

      // Implement gateway-specific test logic here
      // This would depend on the specific gateway implementations
      const testResult = await this.performGatewayTest(paymentMethod.gateway);
      
      return testResult;
    } catch (error) {
      throw new Error(`Failed to test gateway connection: ${error.message}`);
    }
  }

  // Update analytics for payment method
  async updatePaymentMethodAnalytics(paymentMethodId, transactionData) {
    try {
      const paymentMethod = await PaymentMethod.findById(paymentMethodId);
      
      if (!paymentMethod) {
        throw new Error('Payment method not found');
      }

      await paymentMethod.updateAnalytics(transactionData);
      return paymentMethod;
    } catch (error) {
      throw new Error(`Failed to update analytics: ${error.message}`);
    }
  }

  // Get payment method analytics
  async getPaymentMethodAnalytics(paymentMethodId, period = '30d') {
    try {
      const paymentMethod = await PaymentMethod.findById(paymentMethodId);
      
      if (!paymentMethod) {
        throw new Error('Payment method not found');
      }

      // Calculate additional analytics based on period
      const analytics = {
        basic: {
          totalTransactions: paymentMethod.analytics.totalTransactions,
          totalAmount: paymentMethod.analytics.totalAmount,
          successfulTransactions: paymentMethod.analytics.successfulTransactions,
          failedTransactions: paymentMethod.analytics.failedTransactions,
          successRate: paymentMethod.successRate,
          failureRate: paymentMethod.failureRate,
          refundRate: paymentMethod.refundRate,
          avgTransactionAmount: paymentMethod.analytics.avgTransactionAmount,
          avgProcessingTime: paymentMethod.analytics.avgProcessingTime
        },
        period,
        trends: {
          popularityScore: paymentMethod.analytics.popularityScore,
          conversionRate: paymentMethod.analytics.conversionRate,
          lastTransaction: paymentMethod.analytics.lastTransaction
        },
        financial: {
          totalRevenue: paymentMethod.analytics.totalAmount - paymentMethod.analytics.refundedAmount,
          refundedAmount: paymentMethod.analytics.refundedAmount,
          netAmount: paymentMethod.analytics.totalAmount - paymentMethod.analytics.refundedAmount
        }
      };

      return analytics;
    } catch (error) {
      throw new Error(`Failed to get payment method analytics: ${error.message}`);
    }
  }

  // Search payment methods
  async searchPaymentMethods(hotelId, searchQuery, options = {}) {
    try {
      const { type, userRole, limit = 20 } = options;

      const searchRegex = new RegExp(searchQuery, 'i');
      const filter = {
        hotelId,
        $or: [
          { name: searchRegex },
          { description: searchRegex },
          { code: searchRegex }
        ]
      };

      if (type) filter.type = type;

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

      const paymentMethods = await PaymentMethod.find(filter)
        .populate('applicableDepartments', 'name code')
        .limit(limit)
        .sort({ 'analytics.popularityScore': -1, name: 1 });

      return paymentMethods;
    } catch (error) {
      throw new Error(`Failed to search payment methods: ${error.message}`);
    }
  }

  // Bulk operations
  async bulkUpdatePaymentMethods(hotelId, updates, userId) {
    try {
      const results = [];

      for (const update of updates) {
        try {
          const result = await this.updatePaymentMethod(update.paymentMethodId, update.data, userId);
          results.push({ success: true, paymentMethodId: update.paymentMethodId, data: result });
        } catch (error) {
          results.push({ 
            success: false, 
            paymentMethodId: update.paymentMethodId, 
            error: error.message 
          });
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to perform bulk updates: ${error.message}`);
    }
  }

  // Export payment methods
  async exportPaymentMethods(hotelId, format = 'json') {
    try {
      const paymentMethods = await PaymentMethod.find({ hotelId })
        .populate('applicableDepartments', 'name code')
        .populate('createdBy', 'name email')
        .sort({ type: 1, name: 1 });

      if (format === 'csv') {
        return this.convertToCSV(paymentMethods);
      }

      return paymentMethods;
    } catch (error) {
      throw new Error(`Failed to export payment methods: ${error.message}`);
    }
  }

  // Get payment method statistics
  async getPaymentMethodStats(hotelId) {
    try {
      const [typeStats, overallStats] = await Promise.all([
        PaymentMethod.getPaymentStats(hotelId),
        this.getOverallStats(hotelId)
      ]);

      return {
        typeBreakdown: typeStats,
        overall: overallStats,
        generatedAt: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to get payment method statistics: ${error.message}`);
    }
  }

  // Calculate fees for amount
  async calculateFees(paymentMethodId, amount, currency = 'USD') {
    try {
      const paymentMethod = await PaymentMethod.findById(paymentMethodId);
      
      if (!paymentMethod) {
        throw new Error('Payment method not found');
      }

      if (!paymentMethod.supportsCurrency(currency)) {
        throw new Error(`Currency ${currency} not supported by this payment method`);
      }

      const fee = paymentMethod.calculateFee(amount);
      
      return {
        originalAmount: amount,
        fee,
        totalAmount: paymentMethod.fees.feeCalculation === 'add_to_total' ? amount + fee : amount,
        netAmount: paymentMethod.fees.feeCalculation === 'deduct_from_amount' ? amount - fee : amount,
        currency,
        feeCalculation: paymentMethod.fees.feeCalculation
      };
    } catch (error) {
      throw new Error(`Failed to calculate fees: ${error.message}`);
    }
  }

  // Validate payment method usage
  async validatePaymentMethodUsage(paymentMethodId, userId, amount, currency = 'USD', dateTime = new Date()) {
    try {
      const paymentMethod = await this.getPaymentMethodById(paymentMethodId, { populate: true });
      
      // Check if method is active and available
      if (!paymentMethod.isAvailableAt(dateTime)) {
        return { valid: false, reason: 'Payment method not available at this time' };
      }

      // Check amount validation
      const amountValidation = paymentMethod.validateAmount(amount);
      if (!amountValidation.valid) {
        return amountValidation;
      }

      // Check currency support
      if (!paymentMethod.supportsCurrency(currency)) {
        return { valid: false, reason: `Currency ${currency} not supported` };
      }

      // Additional user-based validation would go here
      // Check daily/monthly limits, etc.

      return {
        valid: true,
        fees: await this.calculateFees(paymentMethodId, amount, currency)
      };
    } catch (error) {
      throw new Error(`Failed to validate payment method usage: ${error.message}`);
    }
  }

  // Helper methods
  validateGatewayConfiguration(gateway) {
    const requiredFields = {
      stripe: ['apiKey', 'webhookSecret'],
      paypal: ['clientId', 'clientSecret'],
      square: ['applicationId', 'accessToken'],
      authorize_net: ['apiLoginId', 'transactionKey']
    };

    const required = requiredFields[gateway.provider];
    if (required) {
      for (const field of required) {
        if (!gateway.configuration[field]) {
          throw new Error(`Missing required field ${field} for ${gateway.provider} gateway`);
        }
      }
    }
  }

  async performGatewayTest(gateway) {
    // Mock implementation - would contain actual gateway test logic
    try {
      // Simulate gateway test
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        success: true,
        message: `Gateway ${gateway.provider} connection successful`,
        responseTime: 234,
        environment: gateway.configuration.environment
      };
    } catch (error) {
      return {
        success: false,
        message: `Gateway ${gateway.provider} connection failed: ${error.message}`
      };
    }
  }

  async getOverallStats(hotelId) {
    const paymentMethods = await PaymentMethod.find({ hotelId });
    
    return {
      total: paymentMethods.length,
      active: paymentMethods.filter(pm => pm.isActive).length,
      inactive: paymentMethods.filter(pm => !pm.isActive).length,
      online: paymentMethods.filter(pm => pm.isOnline).length,
      manual: paymentMethods.filter(pm => pm.isManual).length,
      totalTransactions: paymentMethods.reduce((sum, pm) => sum + pm.analytics.totalTransactions, 0),
      totalAmount: paymentMethods.reduce((sum, pm) => sum + pm.analytics.totalAmount, 0),
      avgSuccessRate: paymentMethods.length > 0 
        ? (paymentMethods.reduce((sum, pm) => sum + parseFloat(pm.successRate), 0) / paymentMethods.length).toFixed(2)
        : 0,
      typesUsed: [...new Set(paymentMethods.map(pm => pm.type))].length,
      lastActivity: Math.max(...paymentMethods.map(pm => pm.analytics.lastTransaction || pm.createdAt).map(d => new Date(d)))
    };
  }

  convertToCSV(paymentMethods) {
    const headers = [
      'ID', 'Name', 'Code', 'Type', 'Is Active', 'Is Online', 'Gateway Provider',
      'Total Transactions', 'Total Amount', 'Success Rate', 'Created At', 'Created By'
    ];

    const rows = paymentMethods.map(pm => [
      pm._id,
      pm.name,
      pm.code,
      pm.type,
      pm.isActive,
      pm.isOnline,
      pm.gateway?.provider || '',
      pm.analytics.totalTransactions,
      pm.analytics.totalAmount,
      pm.successRate,
      pm.createdAt,
      pm.createdBy?.name || pm.createdBy
    ]);

    return [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
  }
}

export default new PaymentMethodService();