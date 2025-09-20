import ChartOfAccounts from '../models/ChartOfAccounts.js';
import GeneralLedger from '../models/GeneralLedger.js';
import { catchAsync } from '../utils/catchAsync.js';
import logger from '../utils/logger.js';

// Helper function to flatten account tree into a flat array
function flattenAccountTree(accounts) {
  let flattened = [];

  const flatten = (account) => {
    flattened.push(account);
    if (account.children && Array.isArray(account.children)) {
      account.children.forEach(flatten);
    }
  };

  if (Array.isArray(accounts)) {
    accounts.forEach(flatten);
  }

  return flattened;
}

// Get all accounts with optional filtering
export const getAccounts = catchAsync(async (req, res) => {
  // Temporarily bypass hotel filtering for testing
  // const { hotelId } = req.user;
  const { 
    accountType, 
    isActive = true, 
    parentAccount,
    searchTerm,
    includeBalances = false 
  } = req.query;

  let filter = {}; // Remove hotelId filter temporarily
  
  if (accountType) filter.accountType = accountType;
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (parentAccount) filter.parentAccount = parentAccount;
  
  if (searchTerm) {
    filter.$or = [
      { accountName: { $regex: searchTerm, $options: 'i' } },
      { accountCode: { $regex: searchTerm, $options: 'i' } }
    ];
  }

  let accounts = await ChartOfAccounts.find(filter)
    .populate('parentAccount', 'accountName accountCode')
    .populate('createdBy', 'name email')
    .sort({ accountCode: 1 });

  // Include current balances if requested
  if (includeBalances === 'true') {
    for (let account of accounts) {
      const balance = await GeneralLedger.getAccountBalance(account._id);
      account.currentBalance = balance;
    }
  }

  res.status(200).json({
    status: 'success',
    results: accounts.length,
    data: { accounts }
  });
});

// Get account tree structure
export const getAccountTree = catchAsync(async (req, res) => {
  // Temporarily bypass hotel filtering for testing
  // const { hotelId } = req.user;
  const tree = await ChartOfAccounts.getAccountTree(); // Remove hotelId parameter

  res.status(200).json({
    status: 'success',
    data: { accountTree: tree }
  });
});

// Get flattened accounts (tree flattening done on backend)
export const getFlattenedAccounts = catchAsync(async (req, res) => {
  try {
    // Get the tree structure first
    const tree = await ChartOfAccounts.getAccountTree();

    // Flatten the tree on backend
    const flattenedAccounts = flattenAccountTree(tree);

    console.log('📊 Backend-flattened accounts:', flattenedAccounts.length, 'accounts');

    res.status(200).json({
      status: 'success',
      results: flattenedAccounts.length,
      data: { accounts: flattenedAccounts }
    });
  } catch (error) {
    logger.error('Error getting flattened accounts:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get flattened accounts'
    });
  }
});

// Get single account with details
export const getAccount = catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { id } = req.params;
  const { includeTransactions, transactionLimit = 50 } = req.query;

  const account = await ChartOfAccounts.findOne({ _id: id, hotelId })
    .populate('parentAccount', 'accountName accountCode')
    .populate('createdBy updatedBy', 'name email');

  if (!account) {
    return res.status(404).json({
      status: 'error',
      message: 'Account not found'
    });
  }

  let responseData = { account };

  // Include recent transactions if requested
  if (includeTransactions === 'true') {
    const transactions = await GeneralLedger.find({
      accountId: account._id,
      status: 'Posted'
    })
    .sort({ transactionDate: -1 })
    .limit(parseInt(transactionLimit))
    .populate('journalEntryId', 'entryNumber description');

    responseData.recentTransactions = transactions;
  }

  // Get current balance
  const currentBalance = await GeneralLedger.getAccountBalance(account._id);
  responseData.currentBalance = currentBalance;

  res.status(200).json({
    status: 'success',
    data: responseData
  });
});

// Create new account
export const createAccount = catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;
  
  const accountData = {
    ...req.body,
    hotelId,
    createdBy: userId
  };

  // Validate parent account if provided
  if (accountData.parentAccount) {
    const parentAccount = await ChartOfAccounts.findOne({
      _id: accountData.parentAccount,
      hotelId
    });
    
    if (!parentAccount) {
      return res.status(400).json({
        status: 'error',
        message: 'Parent account not found'
      });
    }

    // Ensure parent is of compatible type
    if (parentAccount.accountType !== accountData.accountType) {
      return res.status(400).json({
        status: 'error',
        message: 'Parent account must be of the same type'
      });
    }
  }

  const account = await ChartOfAccounts.create(accountData);
  
  await account.populate('parentAccount', 'accountName accountCode');
  await account.populate('createdBy', 'name email');

  logger.info(`Chart of account created: ${account.accountCode} - ${account.accountName}`, {
    accountId: account._id,
    hotelId,
    userId
  });

  res.status(201).json({
    status: 'success',
    data: { account }
  });
});

// Update account
export const updateAccount = catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;
  const { id } = req.params;

  const account = await ChartOfAccounts.findOne({ _id: id, hotelId });
  
  if (!account) {
    return res.status(404).json({
      status: 'error',
      message: 'Account not found'
    });
  }

  // Prevent modification of system accounts
  if (account.isSystemAccount && req.body.isSystemAccount !== undefined) {
    return res.status(400).json({
      status: 'error',
      message: 'Cannot modify system account properties'
    });
  }

  // Validate parent account change
  if (req.body.parentAccount && req.body.parentAccount !== account.parentAccount?.toString()) {
    const parentAccount = await ChartOfAccounts.findOne({
      _id: req.body.parentAccount,
      hotelId
    });
    
    if (!parentAccount) {
      return res.status(400).json({
        status: 'error',
        message: 'Parent account not found'
      });
    }

    // Prevent circular reference
    const hierarchy = await parentAccount.getHierarchy();
    if (hierarchy.some(acc => acc._id.toString() === account._id.toString())) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot set parent account that would create circular reference'
      });
    }
  }

  const updatedAccount = await ChartOfAccounts.findByIdAndUpdate(
    id,
    { ...req.body, updatedBy: userId },
    { new: true, runValidators: true }
  ).populate('parentAccount createdBy updatedBy', 'accountName accountCode name email');

  logger.info(`Chart of account updated: ${updatedAccount.accountCode} - ${updatedAccount.accountName}`, {
    accountId: updatedAccount._id,
    hotelId,
    userId
  });

  res.status(200).json({
    status: 'success',
    data: { account: updatedAccount }
  });
});

// Delete account (soft delete by setting inactive)
export const deleteAccount = catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;
  const { id } = req.params;
  const { force = false } = req.query;

  const account = await ChartOfAccounts.findOne({ _id: id, hotelId });
  
  if (!account) {
    return res.status(404).json({
      status: 'error',
      message: 'Account not found'
    });
  }

  // Prevent deletion of system accounts
  if (account.isSystemAccount) {
    return res.status(400).json({
      status: 'error',
      message: 'Cannot delete system account'
    });
  }

  // Check if account has transactions
  const transactionCount = await GeneralLedger.countDocuments({
    accountId: account._id,
    status: 'Posted'
  });

  if (transactionCount > 0 && force !== 'true') {
    return res.status(400).json({
      status: 'error',
      message: 'Cannot delete account with existing transactions. Use force=true to deactivate instead.',
      transactionCount
    });
  }

  // Check if account has child accounts
  const childCount = await ChartOfAccounts.countDocuments({
    parentAccount: account._id,
    isActive: true
  });

  if (childCount > 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Cannot delete account with active child accounts',
      childCount
    });
  }

  // Soft delete by setting inactive
  account.isActive = false;
  account.updatedBy = userId;
  await account.save();

  logger.info(`Chart of account deactivated: ${account.accountCode} - ${account.accountName}`, {
    accountId: account._id,
    hotelId,
    userId
  });

  res.status(200).json({
    status: 'success',
    message: 'Account deactivated successfully'
  });
});

// Get account balance and activity
export const getAccountActivity = catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { id } = req.params;
  const { 
    startDate, 
    endDate = new Date().toISOString(),
    page = 1,
    limit = 50 
  } = req.query;

  const account = await ChartOfAccounts.findOne({ _id: id, hotelId });
  
  if (!account) {
    return res.status(404).json({
      status: 'error',
      message: 'Account not found'
    });
  }

  let filter = {
    accountId: account._id,
    status: 'Posted'
  };

  if (startDate) {
    filter.transactionDate = { 
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const [transactions, totalTransactions] = await Promise.all([
    GeneralLedger.find(filter)
      .sort({ transactionDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('journalEntryId', 'entryNumber description referenceNumber'),
    GeneralLedger.countDocuments(filter)
  ]);

  // Calculate period balance
  const periodBalance = transactions.reduce((balance, transaction) => {
    return balance + transaction.debitAmount - transaction.creditAmount;
  }, 0);

  const currentBalance = await GeneralLedger.getAccountBalance(account._id);

  res.status(200).json({
    status: 'success',
    data: {
      account: {
        _id: account._id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        accountType: account.accountType,
        currentBalance,
        periodBalance
      },
      transactions,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(totalTransactions / parseInt(limit)),
        total: totalTransactions,
        limit: parseInt(limit)
      }
    }
  });
});

// Bulk import accounts
export const bulkImportAccounts = catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;
  const { accounts } = req.body;

  if (!Array.isArray(accounts) || accounts.length === 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Accounts array is required'
    });
  }

  const results = {
    created: [],
    errors: [],
    duplicates: []
  };

  for (const accountData of accounts) {
    try {
      // Check for duplicates
      const existing = await ChartOfAccounts.findOne({
        hotelId,
        accountCode: accountData.accountCode
      });

      if (existing) {
        results.duplicates.push({
          accountCode: accountData.accountCode,
          reason: 'Account code already exists'
        });
        continue;
      }

      const account = await ChartOfAccounts.create({
        ...accountData,
        hotelId,
        createdBy: userId
      });

      results.created.push(account);

    } catch (error) {
      results.errors.push({
        accountCode: accountData.accountCode,
        error: error.message
      });
    }
  }

  logger.info(`Bulk account import completed`, {
    created: results.created.length,
    errors: results.errors.length,
    duplicates: results.duplicates.length,
    hotelId,
    userId
  });

  res.status(200).json({
    status: 'success',
    data: results
  });
});

export default {
  getAccounts,
  getAccountTree,
  getFlattenedAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  getAccountActivity,
  bulkImportAccounts
};
