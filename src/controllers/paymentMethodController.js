import paymentMethodService from '../services/paymentMethodService.js';
import { catchAsync } from '../utils/catchAsync.js';

// Create a new payment method
export const createPaymentMethod = catchAsync(async (req, res) => {
  const paymentMethodData = {
    ...req.body,
    hotelId: req.user.hotelId
  };

  const paymentMethod = await paymentMethodService.createPaymentMethod(paymentMethodData, req.user._id);

  res.status(201).json({
    success: true,
    message: 'Payment method created successfully',
    data: paymentMethod
  });
});

// Get all payment methods for a hotel
export const getPaymentMethods = catchAsync(async (req, res) => {
  const { 
    type,
    isActive,
    userRole,
    departmentId,
    includeOffline,
    page,
    limit,
    sortBy,
    sortOrder
  } = req.query;

  const options = {
    type,
    isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    userRole: userRole || req.user.role,
    departmentId,
    includeOffline: includeOffline === 'true',
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 50,
    sortBy,
    sortOrder
  };

  const result = await paymentMethodService.getPaymentMethodsByHotel(req.user.hotelId, options);

  res.json({
    success: true,
    data: result
  });
});

// Get payment method by ID
export const getPaymentMethodById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { populate, includeAnalytics } = req.query;

  const options = {
    populate: populate === 'true',
    includeAnalytics: includeAnalytics === 'true'
  };

  const paymentMethod = await paymentMethodService.getPaymentMethodById(id, options);

  res.json({
    success: true,
    data: paymentMethod
  });
});

// Update payment method
export const updatePaymentMethod = catchAsync(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const paymentMethod = await paymentMethodService.updatePaymentMethod(id, updateData, req.user._id);

  res.json({
    success: true,
    message: 'Payment method updated successfully',
    data: paymentMethod
  });
});

// Delete payment method
export const deletePaymentMethod = catchAsync(async (req, res) => {
  const { id } = req.params;

  await paymentMethodService.deletePaymentMethod(id, req.user._id);

  res.json({
    success: true,
    message: 'Payment method deleted successfully'
  });
});

// Get payment methods by type
export const getPaymentMethodsByType = catchAsync(async (req, res) => {
  const { type } = req.params;
  const { includeInactive } = req.query;

  const options = {
    includeInactive: includeInactive === 'true'
  };

  const paymentMethods = await paymentMethodService.getPaymentMethodsByType(req.user.hotelId, type, options);

  res.json({
    success: true,
    data: paymentMethods
  });
});

// Get available payment methods
export const getAvailablePaymentMethods = catchAsync(async (req, res) => {
  const { dateTime } = req.query;
  const checkTime = dateTime ? new Date(dateTime) : new Date();

  const paymentMethods = await paymentMethodService.getAvailablePaymentMethods(req.user.hotelId, checkTime);

  res.json({
    success: true,
    data: paymentMethods
  });
});

// Test gateway connection
export const testGatewayConnection = catchAsync(async (req, res) => {
  const { id } = req.params;

  const testResult = await paymentMethodService.testGatewayConnection(id);

  res.json({
    success: true,
    data: testResult
  });
});

// Update payment method analytics
export const updateAnalytics = catchAsync(async (req, res) => {
  const { id } = req.params;
  const transactionData = req.body;

  const paymentMethod = await paymentMethodService.updatePaymentMethodAnalytics(id, transactionData);

  res.json({
    success: true,
    message: 'Analytics updated successfully',
    data: paymentMethod
  });
});

// Get payment method analytics
export const getPaymentMethodAnalytics = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { period = '30d' } = req.query;

  const analytics = await paymentMethodService.getPaymentMethodAnalytics(id, period);

  res.json({
    success: true,
    data: analytics
  });
});

// Search payment methods
export const searchPaymentMethods = catchAsync(async (req, res) => {
  const { q: searchQuery } = req.query;

  if (!searchQuery) {
    return res.status(400).json({
      success: false,
      message: 'Search query is required'
    });
  }

  const { type, userRole, limit } = req.query;
  const options = { 
    type, 
    userRole: userRole || req.user.role, 
    limit: parseInt(limit) || 20 
  };

  const paymentMethods = await paymentMethodService.searchPaymentMethods(
    req.user.hotelId, 
    searchQuery, 
    options
  );

  res.json({
    success: true,
    data: paymentMethods
  });
});

// Bulk update payment methods
export const bulkUpdatePaymentMethods = catchAsync(async (req, res) => {
  const { updates } = req.body;

  if (!updates || !Array.isArray(updates)) {
    return res.status(400).json({
      success: false,
      message: 'Updates array is required'
    });
  }

  const results = await paymentMethodService.bulkUpdatePaymentMethods(
    req.user.hotelId, 
    updates, 
    req.user._id
  );

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;

  res.json({
    success: true,
    message: `Bulk update completed: ${successCount} successful, ${failureCount} failed`,
    data: results
  });
});

// Export payment methods
export const exportPaymentMethods = catchAsync(async (req, res) => {
  const { format = 'json' } = req.query;

  const data = await paymentMethodService.exportPaymentMethods(req.user.hotelId, format);

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="payment-methods.csv"');
    res.send(data);
  } else {
    res.json({
      success: true,
      data
    });
  }
});

// Get payment method statistics
export const getPaymentMethodStats = catchAsync(async (req, res) => {
  const stats = await paymentMethodService.getPaymentMethodStats(req.user.hotelId);

  res.json({
    success: true,
    data: stats
  });
});

// Calculate fees
export const calculateFees = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { amount, currency = 'USD' } = req.query;

  if (!amount || isNaN(amount)) {
    return res.status(400).json({
      success: false,
      message: 'Valid amount is required'
    });
  }

  const feeCalculation = await paymentMethodService.calculateFees(id, parseFloat(amount), currency);

  res.json({
    success: true,
    data: feeCalculation
  });
});

// Validate payment method usage
export const validatePaymentMethodUsage = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { amount, currency = 'USD', dateTime } = req.query;

  if (!amount || isNaN(amount)) {
    return res.status(400).json({
      success: false,
      message: 'Valid amount is required'
    });
  }

  const checkTime = dateTime ? new Date(dateTime) : new Date();
  const validation = await paymentMethodService.validatePaymentMethodUsage(
    id, 
    req.user._id, 
    parseFloat(amount), 
    currency, 
    checkTime
  );

  res.json({
    success: true,
    data: validation
  });
});

// Get payment method types (static list)
export const getPaymentMethodTypes = catchAsync(async (req, res) => {
  const types = [
    { 
      value: 'credit_card', 
      label: 'Credit Card', 
      description: 'Visa, Mastercard, Amex, etc.',
      icon: 'credit_card',
      requiresGateway: true 
    },
    { 
      value: 'debit_card', 
      label: 'Debit Card', 
      description: 'Bank debit cards',
      icon: 'payment',
      requiresGateway: true 
    },
    { 
      value: 'cash', 
      label: 'Cash', 
      description: 'Physical currency',
      icon: 'money',
      requiresGateway: false 
    },
    { 
      value: 'check', 
      label: 'Check', 
      description: 'Bank checks',
      icon: 'receipt',
      requiresGateway: false 
    },
    { 
      value: 'bank_transfer', 
      label: 'Bank Transfer', 
      description: 'Direct bank transfers',
      icon: 'account_balance',
      requiresGateway: true 
    },
    { 
      value: 'digital_wallet', 
      label: 'Digital Wallet', 
      description: 'PayPal, Apple Pay, Google Pay',
      icon: 'account_balance_wallet',
      requiresGateway: true 
    },
    { 
      value: 'cryptocurrency', 
      label: 'Cryptocurrency', 
      description: 'Bitcoin, Ethereum, etc.',
      icon: 'currency_bitcoin',
      requiresGateway: true 
    },
    { 
      value: 'gift_card', 
      label: 'Gift Card', 
      description: 'Hotel gift cards',
      icon: 'card_giftcard',
      requiresGateway: false 
    },
    { 
      value: 'voucher', 
      label: 'Voucher', 
      description: 'Travel vouchers, coupons',
      icon: 'local_offer',
      requiresGateway: false 
    },
    { 
      value: 'loyalty_points', 
      label: 'Loyalty Points', 
      description: 'Reward points redemption',
      icon: 'stars',
      requiresGateway: false 
    },
    { 
      value: 'corporate_account', 
      label: 'Corporate Account', 
      description: 'Business accounts',
      icon: 'business',
      requiresGateway: false 
    },
    { 
      value: 'invoice', 
      label: 'Invoice', 
      description: 'Bill later option',
      icon: 'description',
      requiresGateway: false 
    },
    { 
      value: 'other', 
      label: 'Other', 
      description: 'Other payment methods',
      icon: 'help_outline',
      requiresGateway: false 
    }
  ];

  res.json({
    success: true,
    data: types
  });
});

// Get gateway providers (static list)
export const getGatewayProviders = catchAsync(async (req, res) => {
  const providers = [
    { 
      value: 'stripe', 
      label: 'Stripe', 
      description: 'Popular online payment processor',
      features: ['refunds', 'recurring', 'tokenization', 'webhooks'],
      supportedTypes: ['credit_card', 'debit_card', 'digital_wallet']
    },
    { 
      value: 'paypal', 
      label: 'PayPal', 
      description: 'Digital wallet and payment processor',
      features: ['refunds', 'tokenization', 'webhooks'],
      supportedTypes: ['digital_wallet', 'credit_card']
    },
    { 
      value: 'square', 
      label: 'Square', 
      description: 'Point-of-sale payment processor',
      features: ['refunds', 'recurring', 'in_person'],
      supportedTypes: ['credit_card', 'debit_card']
    },
    { 
      value: 'authorize_net', 
      label: 'Authorize.Net', 
      description: 'Enterprise payment gateway',
      features: ['refunds', 'recurring', 'tokenization'],
      supportedTypes: ['credit_card', 'debit_card', 'bank_transfer']
    },
    { 
      value: 'braintree', 
      label: 'Braintree', 
      description: 'PayPal-owned payment processor',
      features: ['refunds', 'recurring', 'tokenization'],
      supportedTypes: ['credit_card', 'digital_wallet']
    },
    { 
      value: 'worldpay', 
      label: 'Worldpay', 
      description: 'Global payment processor',
      features: ['refunds', 'multi_currency', 'tokenization'],
      supportedTypes: ['credit_card', 'debit_card', 'digital_wallet']
    },
    { 
      value: 'adyen', 
      label: 'Adyen', 
      description: 'Global payment platform',
      features: ['refunds', 'multi_currency', 'tokenization'],
      supportedTypes: ['credit_card', 'debit_card', 'digital_wallet']
    },
    { 
      value: 'manual', 
      label: 'Manual', 
      description: 'Manual processing (no gateway)',
      features: [],
      supportedTypes: ['cash', 'check', 'gift_card', 'voucher', 'other']
    },
    { 
      value: 'internal', 
      label: 'Internal System', 
      description: 'Hotel internal payment system',
      features: ['refunds'],
      supportedTypes: ['corporate_account', 'loyalty_points', 'invoice']
    }
  ];

  res.json({
    success: true,
    data: providers
  });
});

// Clone payment method
export const clonePaymentMethod = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { newName, newCode } = req.body;

  if (!newName || !newCode) {
    return res.status(400).json({
      success: false,
      message: 'New name and code are required for cloning'
    });
  }

  const originalPaymentMethod = await paymentMethodService.getPaymentMethodById(id);
  
  if (!originalPaymentMethod) {
    return res.status(404).json({
      success: false,
      message: 'Original payment method not found'
    });
  }

  // Create new payment method data by copying from original
  const newPaymentMethodData = {
    ...originalPaymentMethod.toObject(),
    name: newName,
    code: newCode,
    // Reset analytics
    analytics: {
      totalTransactions: 0,
      totalAmount: 0,
      successfulTransactions: 0,
      failedTransactions: 0,
      refundedTransactions: 0,
      refundedAmount: 0,
      avgTransactionAmount: 0,
      avgProcessingTime: 0,
      popularityScore: 0,
      conversionRate: 0,
      lastCalculated: new Date()
    },
    auditLog: []
  };

  // Remove fields that shouldn't be cloned
  delete newPaymentMethodData._id;
  delete newPaymentMethodData.createdAt;
  delete newPaymentMethodData.updatedAt;
  delete newPaymentMethodData.__v;

  const clonedPaymentMethod = await paymentMethodService.createPaymentMethod(
    newPaymentMethodData, 
    req.user._id
  );

  res.status(201).json({
    success: true,
    message: 'Payment method cloned successfully',
    data: clonedPaymentMethod
  });
});

// Update payment method status
export const updatePaymentMethodStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { isActive, reason } = req.body;

  if (typeof isActive !== 'boolean') {
    return res.status(400).json({
      success: false,
      message: 'isActive must be a boolean value'
    });
  }

  const paymentMethod = await paymentMethodService.updatePaymentMethod(
    id, 
    { isActive }, 
    req.user._id
  );

  // Add audit entry for status change
  await paymentMethod.addAuditEntry(
    'status_changed',
    req.user._id,
    { newStatus: isActive, reason },
    req.ip,
    req.get('User-Agent')
  );

  res.json({
    success: true,
    message: `Payment method ${isActive ? 'activated' : 'deactivated'} successfully`,
    data: paymentMethod
  });
});

// Update display order
export const updateDisplayOrder = catchAsync(async (req, res) => {
  const { updates } = req.body;

  if (!updates || !Array.isArray(updates)) {
    return res.status(400).json({
      success: false,
      message: 'Updates array with order information is required'
    });
  }

  const results = [];
  
  for (const update of updates) {
    try {
      const paymentMethod = await paymentMethodService.updatePaymentMethod(
        update.id, 
        { 'display.order': update.order }, 
        req.user._id
      );
      results.push({ success: true, id: update.id, order: update.order });
    } catch (error) {
      results.push({ success: false, id: update.id, error: error.message });
    }
  }

  res.json({
    success: true,
    message: 'Display order updated',
    data: results
  });
});
