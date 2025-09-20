import BankAccount from '../models/BankAccount.js';
import ChartOfAccounts from '../models/ChartOfAccounts.js';
import { catchAsync } from '../utils/catchAsync.js';
import logger from '../utils/logger.js';

// Get all bank accounts
export const getBankAccounts = catchAsync(async (req, res) => {
  console.log('🚀 getBankAccounts controller called');
  
  // Temporarily bypass hotel filtering for testing
  // const { hotelId } = req.user;
  const { 
    accountType,
    isActive,
    includeTransactions = false,
    transactionLimit = 10
  } = req.query;

  let filter = {}; // Remove hotelId filter temporarily
  
  if (accountType) filter.accountType = accountType;
  // Only apply isActive filter if explicitly provided, otherwise get all accounts
  if (isActive !== undefined && isActive !== '') {
    filter.isActive = isActive === 'true';
  }

  console.log('🔍 Filter being applied:', filter);
  console.log('📞 Calling BankAccount.find()...');

  let accounts = await BankAccount.find(filter)
    .populate('glAccountId', 'accountCode accountName')
    .populate('createdBy', 'name email')
    .sort({ isPrimary: -1, accountName: 1 });

  console.log('📊 Raw accounts found:', accounts.length);
  console.log('📊 First account sample:', accounts[0]);

  // Include recent transactions if requested
  if (includeTransactions === 'true') {
    accounts = accounts.map(account => ({
      ...account.toObject(),
      recentTransactions: account.transactions
        .sort((a, b) => b.transactionDate - a.transactionDate)
        .slice(0, parseInt(transactionLimit))
    }));
  }

  res.status(200).json({
    status: 'success',
    results: accounts.length,
    data: { accounts }
  });
});

// Get single bank account
export const getBankAccount = catchAsync(async (req, res) => {
  // Temporarily bypass hotel filtering for testing
  // const { hotelId } = req.user;
  const { id } = req.params;

  const account = await BankAccount.findOne({ _id: id })
    .populate('glAccountId', 'accountCode accountName accountType')
    .populate('createdBy updatedBy', 'name email');

  if (!account) {
    return res.status(404).json({
      status: 'error',
      message: 'Bank account not found'
    });
  }

  res.status(200).json({
    status: 'success',
    data: { account }
  });
});

// Create new bank account
export const createBankAccount = catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;
  
  // Check if GL account exists and is appropriate type
  if (req.body.glAccountId) {
    const glAccount = await ChartOfAccounts.findOne({
      _id: req.body.glAccountId,
      hotelId,
      accountType: 'Asset',
      isActive: true
    });

    if (!glAccount) {
      return res.status(400).json({
        status: 'error',
        message: 'General ledger account not found or not an asset account'
      });
    }
  }

  // If this is marked as primary, unset other primary accounts
  if (req.body.isPrimary) {
    await BankAccount.updateMany(
      { hotelId, isPrimary: true },
      { isPrimary: false }
    );
  }

  const accountData = {
    ...req.body,
    hotelId,
    createdBy: userId,
    currentBalance: req.body.openingBalance || 0
  };

  const account = await BankAccount.create(accountData);
  
  await account.populate('glAccountId', 'accountCode accountName');
  await account.populate('createdBy', 'name email');

  logger.info(`Bank account created: ${account.accountName} - ${account.accountNumber}`, {
    accountId: account._id,
    accountType: account.accountType,
    hotelId,
    userId
  });

  res.status(201).json({
    status: 'success',
    data: { account }
  });
});

// Update bank account
export const updateBankAccount = catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;
  const { id } = req.params;

  const account = await BankAccount.findOne({ _id: id, hotelId });
  
  if (!account) {
    return res.status(404).json({
      status: 'error',
      message: 'Bank account not found'
    });
  }

  // If setting as primary, unset other primary accounts
  if (req.body.isPrimary && !account.isPrimary) {
    await BankAccount.updateMany(
      { hotelId, isPrimary: true, _id: { $ne: id } },
      { isPrimary: false }
    );
  }

  // Validate GL account if being changed
  if (req.body.glAccountId && req.body.glAccountId !== account.glAccountId?.toString()) {
    const glAccount = await ChartOfAccounts.findOne({
      _id: req.body.glAccountId,
      hotelId,
      accountType: 'Asset',
      isActive: true
    });

    if (!glAccount) {
      return res.status(400).json({
        status: 'error',
        message: 'General ledger account not found or not an asset account'
      });
    }
  }

  const updatedAccount = await BankAccount.findByIdAndUpdate(
    id,
    { ...req.body, updatedBy: userId },
    { new: true, runValidators: true }
  ).populate('glAccountId createdBy updatedBy', 'accountCode accountName name email');

  logger.info(`Bank account updated: ${updatedAccount.accountName} - ${updatedAccount.accountNumber}`, {
    accountId: updatedAccount._id,
    hotelId,
    userId
  });

  res.status(200).json({
    status: 'success',
    data: { account: updatedAccount }
  });
});

// Deactivate bank account
export const deactivateBankAccount = catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;
  const { id } = req.params;

  const account = await BankAccount.findOne({ _id: id, hotelId });
  
  if (!account) {
    return res.status(404).json({
      status: 'error',
      message: 'Bank account not found'
    });
  }

  if (account.isPrimary) {
    return res.status(400).json({
      status: 'error',
      message: 'Cannot deactivate primary bank account. Set another account as primary first.'
    });
  }

  account.isActive = false;
  account.updatedBy = userId;
  await account.save();

  logger.info(`Bank account deactivated: ${account.accountName} - ${account.accountNumber}`, {
    accountId: account._id,
    hotelId,
    userId
  });

  res.status(200).json({
    status: 'success',
    message: 'Bank account deactivated successfully'
  });
});

// Add transaction to bank account
export const addTransaction = catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;
  const { id } = req.params;

  const account = await BankAccount.findOne({ _id: id, hotelId });
  
  if (!account) {
    return res.status(404).json({
      status: 'error',
      message: 'Bank account not found'
    });
  }

  if (!account.isActive) {
    return res.status(400).json({
      status: 'error',
      message: 'Cannot add transactions to inactive account'
    });
  }

  account.updatedBy = userId;
  const transaction = await account.addTransaction(req.body);

  logger.info(`Bank transaction added: ${account.accountName}`, {
    accountId: account._id,
    transactionType: transaction.transactionType,
    amount: transaction.debitAmount || transaction.creditAmount,
    hotelId,
    userId
  });

  res.status(201).json({
    status: 'success',
    data: { 
      transaction,
      currentBalance: account.currentBalance
    }
  });
});

// Get account transactions
export const getTransactions = catchAsync(async (req, res) => {
  console.log('🚀 getTransactions controller called');
  // Temporarily bypass hotel filtering for testing
  // const { hotelId } = req.user;
  const { id } = req.params;
  const {
    startDate,
    endDate = new Date().toISOString(),
    transactionType,
    isReconciled,
    page = 1,
    limit = 50
  } = req.query;

  console.log('🔍 Looking for account with ID:', id);
  const account = await BankAccount.findOne({ _id: id });
  
  if (!account) {
    console.log('❌ Bank account not found');
    return res.status(404).json({
      status: 'error',
      message: 'Bank account not found'
    });
  }

  console.log('✅ Found account:', account.accountName);
  console.log('💰 Account has transactions:', account.transactions?.length || 0);
  
  let transactions = account.transactions;

  // Apply filters
  if (startDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    transactions = transactions.filter(t => 
      t.transactionDate >= start && t.transactionDate <= end
    );
  }

  if (transactionType) {
    transactions = transactions.filter(t => t.transactionType === transactionType);
  }

  if (isReconciled !== undefined) {
    const reconciled = isReconciled === 'true';
    transactions = transactions.filter(t => t.isReconciled === reconciled);
  }

  // Sort by date (newest first)
  transactions.sort((a, b) => b.transactionDate - a.transactionDate);

  // Apply pagination
  const totalTransactions = transactions.length;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const paginatedTransactions = transactions.slice(skip, skip + parseInt(limit));

  res.status(200).json({
    status: 'success',
    data: {
      account: {
        _id: account._id,
        accountName: account.accountName,
        accountNumber: account.accountNumber,
        accountType: account.accountType,
        currentBalance: account.currentBalance
      },
      transactions: paginatedTransactions,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(totalTransactions / parseInt(limit)),
        total: totalTransactions,
        limit: parseInt(limit)
      }
    }
  });
});

// Reconcile bank account
export const reconcileAccount = catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;
  const { id } = req.params;
  const { 
    statementBalance, 
    statementDate, 
    reconciledTransactionIds = [] 
  } = req.body;

  if (statementBalance === undefined || !statementDate) {
    return res.status(400).json({
      status: 'error',
      message: 'Statement balance and date are required'
    });
  }

  const account = await BankAccount.findOne({ _id: id, hotelId });
  
  if (!account) {
    return res.status(404).json({
      status: 'error',
      message: 'Bank account not found'
    });
  }

  account.updatedBy = userId;
  const reconciliationResult = await account.reconcile(
    parseFloat(statementBalance),
    new Date(statementDate),
    reconciledTransactionIds
  );

  logger.info(`Bank account reconciled: ${account.accountName}`, {
    accountId: account._id,
    statementBalance,
    statementDate,
    reconciledCount: reconciliationResult.reconciledCount,
    hotelId,
    userId
  });

  res.status(200).json({
    status: 'success',
    message: 'Account reconciled successfully',
    data: {
      ...reconciliationResult,
      lastReconciledDate: account.lastReconciledDate,
      lastReconciledBalance: account.lastReconciledBalance
    }
  });
});

// Import bank statement
export const importStatement = catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;
  const { id } = req.params;
  const { statements } = req.body;

  if (!Array.isArray(statements) || statements.length === 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Statements array is required'
    });
  }

  const account = await BankAccount.findOne({ _id: id, hotelId });
  
  if (!account) {
    return res.status(404).json({
      status: 'error',
      message: 'Bank account not found'
    });
  }

  account.updatedBy = userId;
  const importedTransactions = await account.importStatement(statements);

  logger.info(`Bank statement imported: ${account.accountName}`, {
    accountId: account._id,
    importedCount: importedTransactions.length,
    hotelId,
    userId
  });

  res.status(200).json({
    status: 'success',
    message: `Imported ${importedTransactions.length} transactions`,
    data: {
      importedTransactions,
      currentBalance: account.currentBalance
    }
  });
});

// Get cash position summary
export const getCashPosition = catchAsync(async (req, res) => {
  const { hotelId } = req.user;

  const cashPosition = await BankAccount.getCashPosition(hotelId);

  res.status(200).json({
    status: 'success',
    data: { cashPosition }
  });
});

// Get account balances summary
export const getAccountBalances = catchAsync(async (req, res) => {
  const { hotelId } = req.user;

  const accounts = await BankAccount.find({ hotelId, isActive: true })
    .select('accountName accountNumber accountType currentBalance currency isPrimary')
    .sort({ isPrimary: -1, accountName: 1 });

  const totalBalance = accounts.reduce((sum, account) => sum + account.currentBalance, 0);
  
  const byType = accounts.reduce((acc, account) => {
    if (!acc[account.accountType]) {
      acc[account.accountType] = { count: 0, balance: 0, accounts: [] };
    }
    acc[account.accountType].count += 1;
    acc[account.accountType].balance += account.currentBalance;
    acc[account.accountType].accounts.push(account);
    return acc;
  }, {});

  res.status(200).json({
    status: 'success',
    data: {
      accounts,
      summary: {
        totalAccounts: accounts.length,
        totalBalance,
        byType
      }
    }
  });
});

export default {
  getBankAccounts,
  getBankAccount,
  createBankAccount,
  updateBankAccount,
  deactivateBankAccount,
  addTransaction,
  getTransactions,
  reconcileAccount,
  importStatement,
  getCashPosition,
  getAccountBalances
};
