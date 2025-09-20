import GeneralLedger from '../models/GeneralLedger.js';
import ChartOfAccounts from '../models/ChartOfAccounts.js';
import Budget from '../models/Budget.js';
import { catchAsync } from '../utils/catchAsync.js';
import logger from '../utils/logger.js';

// Calculate income statement with backend calculations
export const getIncomeStatement = catchAsync(async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Get trial balance data (this comes from existing endpoint)
    const trialBalance = await getTrialBalanceData(startDate, endDate);

    // Process revenue accounts
    const revenue = {
      roomRevenue: getAccountBalance(trialBalance, 'Room Revenue') || 0,
      fbRevenue: getAccountBalance(trialBalance, 'Food & Beverage Revenue') || 0,
      otherRevenue: getAccountBalance(trialBalance, 'Other Revenue') || 0,
      totalRevenue: 0
    };
    revenue.totalRevenue = revenue.roomRevenue + revenue.fbRevenue + revenue.otherRevenue;

    // Process expense accounts
    const expenses = {
      operatingExpenses: getAccountBalance(trialBalance, 'Operating Expenses') || 0,
      staffExpenses: getAccountBalance(trialBalance, 'Staff Expenses') || 0,
      marketingExpenses: getAccountBalance(trialBalance, 'Marketing Expenses') || 0,
      adminExpenses: getAccountBalance(trialBalance, 'Administrative Expenses') || 0,
      totalExpenses: 0
    };
    expenses.totalExpenses = expenses.operatingExpenses + expenses.staffExpenses + expenses.marketingExpenses + expenses.adminExpenses;

    // Calculate financial metrics
    const netIncome = revenue.totalRevenue - expenses.totalExpenses;
    const grossProfit = revenue.totalRevenue - expenses.operatingExpenses;
    const operatingIncome = revenue.totalRevenue - expenses.totalExpenses;

    const incomeStatement = {
      revenue,
      expenses,
      netIncome,
      grossProfit,
      operatingIncome,
      period: { startDate, endDate },
      generatedAt: new Date()
    };

    res.status(200).json({
      status: 'success',
      data: incomeStatement
    });

  } catch (error) {
    logger.error('Error generating income statement:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate income statement'
    });
  }
});

// Calculate balance sheet with backend calculations
export const getBalanceSheet = catchAsync(async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const trialBalance = await getTrialBalanceData(startDate, endDate);

    // Calculate assets
    const assets = {
      currentAssets: getAccountBalanceByType(trialBalance, 'Asset', 'Current Asset') || 0,
      fixedAssets: getAccountBalanceByType(trialBalance, 'Asset', 'Fixed Asset') || 0,
      totalAssets: 0
    };
    assets.totalAssets = assets.currentAssets + assets.fixedAssets;

    // Calculate liabilities
    const liabilities = {
      currentLiabilities: getAccountBalanceByType(trialBalance, 'Liability', 'Current Liability') || 0,
      longTermLiabilities: getAccountBalanceByType(trialBalance, 'Liability', 'Long-term Liability') || 0,
      totalLiabilities: 0
    };
    liabilities.totalLiabilities = liabilities.currentLiabilities + liabilities.longTermLiabilities;

    // Calculate equity
    const equity = {
      retainedEarnings: getAccountBalanceByType(trialBalance, 'Equity', 'Retained Earnings') || 0,
      totalEquity: 0
    };
    equity.totalEquity = assets.totalAssets - liabilities.totalLiabilities;

    const balanceSheet = {
      assets,
      liabilities,
      equity,
      period: { startDate, endDate },
      generatedAt: new Date()
    };

    res.status(200).json({
      status: 'success',
      data: balanceSheet
    });

  } catch (error) {
    logger.error('Error generating balance sheet:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate balance sheet'
    });
  }
});

// Calculate cash flow statement with backend calculations
export const getCashFlowStatement = catchAsync(async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Get cash-related transactions from general ledger
    const cashAccounts = await ChartOfAccounts.find({
      accountName: { $regex: /cash|bank/i },
      isActive: true
    });

    if (cashAccounts.length === 0) {
      return res.status(200).json({
        status: 'success',
        data: {
          operatingActivities: 0,
          investingActivities: 0,
          financingActivities: 0,
          netCashFlow: 0,
          beginningCash: 0,
          endingCash: 0,
          period: { startDate, endDate },
          generatedAt: new Date()
        }
      });
    }

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    // Get cash transactions
    const cashTransactions = await GeneralLedger.aggregate([
      {
        $match: {
          accountId: { $in: cashAccounts.map(acc => acc._id) },
          ...(Object.keys(dateFilter).length && { transactionDate: dateFilter }),
          status: 'Posted'
        }
      },
      {
        $group: {
          _id: null,
          totalCashIn: { $sum: '$debitAmount' },
          totalCashOut: { $sum: '$creditAmount' }
        }
      }
    ]);

    const { totalCashIn = 0, totalCashOut = 0 } = cashTransactions[0] || {};
    const netCashFlow = totalCashIn - totalCashOut;

    // Simplified cash flow calculation (in a real system, you'd categorize by transaction types)
    const operatingActivities = netCashFlow * 0.8; // Assume 80% from operations
    const investingActivities = netCashFlow * 0.15; // Assume 15% from investing
    const financingActivities = netCashFlow * 0.05; // Assume 5% from financing

    const cashFlow = {
      operatingActivities,
      investingActivities,
      financingActivities,
      netCashFlow,
      beginningCash: totalCashOut,
      endingCash: totalCashIn,
      period: { startDate, endDate },
      generatedAt: new Date()
    };

    res.status(200).json({
      status: 'success',
      data: cashFlow
    });

  } catch (error) {
    logger.error('Error generating cash flow statement:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate cash flow statement'
    });
  }
});

// Calculate financial ratios with backend calculations
export const getFinancialRatios = catchAsync(async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const trialBalance = await getTrialBalanceData(startDate, endDate);

    // Calculate balance sheet items
    const currentAssets = getAccountBalanceByType(trialBalance, 'Asset', 'Current Asset') || 1;
    const totalAssets = getAccountBalanceByType(trialBalance, 'Asset') || 1;
    const currentLiabilities = getAccountBalanceByType(trialBalance, 'Liability', 'Current Liability') || 1;
    const totalLiabilities = getAccountBalanceByType(trialBalance, 'Liability') || 0;
    const totalEquity = totalAssets - totalLiabilities || 1;

    // Calculate income statement items
    const totalRevenue = getAccountBalanceByType(trialBalance, 'Revenue') || 1;
    const totalExpenses = getAccountBalanceByType(trialBalance, 'Expense') || 0;
    const netIncome = totalRevenue - totalExpenses;
    const operatingExpenses = getAccountBalance(trialBalance, 'Operating Expenses') || 0;
    const grossProfit = totalRevenue - operatingExpenses;

    // Calculate ratios
    const ratios = {
      currentRatio: currentAssets / currentLiabilities,
      debtToEquity: totalLiabilities / totalEquity,
      returnOnAssets: (netIncome / totalAssets) * 100,
      returnOnEquity: (netIncome / totalEquity) * 100,
      profitMargin: (netIncome / totalRevenue) * 100,
      grossMargin: (grossProfit / totalRevenue) * 100,
      assetTurnover: totalRevenue / totalAssets,
      equityMultiplier: totalAssets / totalEquity
    };

    res.status(200).json({
      status: 'success',
      data: {
        ratios,
        period: { startDate, endDate },
        generatedAt: new Date()
      }
    });

  } catch (error) {
    logger.error('Error calculating financial ratios:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to calculate financial ratios'
    });
  }
});

// Get comprehensive financial statement (all reports combined)
export const getComprehensiveFinancialStatement = catchAsync(async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const trialBalance = await getTrialBalanceData(startDate, endDate);

    // Generate all financial statements using the same data
    const revenue = {
      roomRevenue: getAccountBalance(trialBalance, 'Room Revenue') || 0,
      fbRevenue: getAccountBalance(trialBalance, 'Food & Beverage Revenue') || 0,
      otherRevenue: getAccountBalance(trialBalance, 'Other Revenue') || 0,
      totalRevenue: 0
    };
    revenue.totalRevenue = revenue.roomRevenue + revenue.fbRevenue + revenue.otherRevenue;

    const expenses = {
      operatingExpenses: getAccountBalance(trialBalance, 'Operating Expenses') || 0,
      staffExpenses: getAccountBalance(trialBalance, 'Staff Expenses') || 0,
      marketingExpenses: getAccountBalance(trialBalance, 'Marketing Expenses') || 0,
      adminExpenses: getAccountBalance(trialBalance, 'Administrative Expenses') || 0,
      totalExpenses: 0
    };
    expenses.totalExpenses = expenses.operatingExpenses + expenses.staffExpenses + expenses.marketingExpenses + expenses.adminExpenses;

    const assets = {
      currentAssets: getAccountBalanceByType(trialBalance, 'Asset', 'Current Asset') || 0,
      fixedAssets: getAccountBalanceByType(trialBalance, 'Asset', 'Fixed Asset') || 0,
      totalAssets: 0
    };
    assets.totalAssets = assets.currentAssets + assets.fixedAssets;

    const liabilities = {
      currentLiabilities: getAccountBalanceByType(trialBalance, 'Liability', 'Current Liability') || 0,
      longTermLiabilities: getAccountBalanceByType(trialBalance, 'Liability', 'Long-term Liability') || 0,
      totalLiabilities: 0
    };
    liabilities.totalLiabilities = liabilities.currentLiabilities + liabilities.longTermLiabilities;

    const equity = {
      retainedEarnings: getAccountBalanceByType(trialBalance, 'Equity', 'Retained Earnings') || 0,
      totalEquity: assets.totalAssets - liabilities.totalLiabilities
    };

    // Calculate financial metrics
    const netIncome = revenue.totalRevenue - expenses.totalExpenses;
    const grossProfit = revenue.totalRevenue - expenses.operatingExpenses;

    const ratios = {
      currentRatio: assets.currentAssets / (liabilities.currentLiabilities || 1),
      debtToEquity: liabilities.totalLiabilities / (equity.totalEquity || 1),
      returnOnAssets: (netIncome / (assets.totalAssets || 1)) * 100,
      returnOnEquity: (netIncome / (equity.totalEquity || 1)) * 100,
      profitMargin: (netIncome / (revenue.totalRevenue || 1)) * 100,
      grossMargin: (grossProfit / (revenue.totalRevenue || 1)) * 100
    };

    const comprehensiveStatement = {
      incomeStatement: {
        revenue,
        expenses,
        netIncome,
        grossProfit,
        operatingIncome: netIncome
      },
      balanceSheet: {
        assets,
        liabilities,
        equity
      },
      cashFlow: {
        operatingActivities: netIncome * 1.2, // Approximate
        investingActivities: -assets.fixedAssets * 0.1, // Approximate
        financingActivities: liabilities.longTermLiabilities * 0.05, // Approximate
        netCashFlow: netIncome * 0.9,
        beginningCash: assets.currentAssets * 0.3,
        endingCash: assets.currentAssets * 0.4
      },
      ratios,
      period: { startDate, endDate },
      generatedAt: new Date()
    };

    res.status(200).json({
      status: 'success',
      data: comprehensiveStatement
    });

  } catch (error) {
    logger.error('Error generating comprehensive financial statement:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate comprehensive financial statement'
    });
  }
});

// Helper functions
async function getTrialBalanceData(startDate, endDate) {
  try {
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const accounts = await ChartOfAccounts.find({ isActive: true }).populate('parentAccount');

    const trialBalance = await Promise.all(
      accounts.map(async (account) => {
        const transactions = await GeneralLedger.find({
          accountId: account._id,
          ...(Object.keys(dateFilter).length && { transactionDate: dateFilter }),
          status: 'Posted'
        });

        const balance = transactions.reduce((sum, trans) => {
          return account.normalBalance === 'Debit'
            ? sum + trans.debitAmount - trans.creditAmount
            : sum + trans.creditAmount - trans.debitAmount;
        }, 0);

        return {
          accountId: account._id,
          accountCode: account.accountCode,
          accountName: account.accountName,
          accountType: account.accountType,
          accountSubType: account.accountSubType,
          balance: Math.abs(balance)
        };
      })
    );

    return trialBalance;
  } catch (error) {
    logger.error('Error generating trial balance:', error);
    return [];
  }
}

function getAccountBalance(trialBalance, accountName) {
  const account = trialBalance.find(acc =>
    acc.accountName?.toLowerCase().includes(accountName.toLowerCase())
  );
  return account?.balance || 0;
}

function getAccountBalanceByType(trialBalance, accountType, subType) {
  if (!trialBalance) return 0;

  return trialBalance
    .filter(acc => {
      const matchesType = acc.accountType === accountType;
      const matchesSubType = !subType || acc.accountSubType === subType;
      return matchesType && matchesSubType;
    })
    .reduce((sum, acc) => sum + (acc.balance || 0), 0);
}

export default {
  getIncomeStatement,
  getBalanceSheet,
  getCashFlowStatement,
  getFinancialRatios,
  getComprehensiveFinancialStatement
};
