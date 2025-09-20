import GeneralLedger from '../models/GeneralLedger.js';
import ChartOfAccounts from '../models/ChartOfAccounts.js';
import JournalEntry from '../models/JournalEntry.js';
import { catchAsync } from '../utils/catchAsync.js';
import logger from '../utils/logger.js';

// Get general ledger entries with filtering
export const getLedgerEntries = catchAsync(async (req, res) => {
  // Temporarily bypass hotel filtering for testing
  // const { hotelId } = req.user;
  const {
    accountId,
    startDate,
    endDate = new Date().toISOString(),
    status = 'Posted',
    referenceType,
    page = 1,
    limit = 100
  } = req.query;

  let filter = { status }; // Remove hotelId filter temporarily

  if (accountId) filter.accountId = accountId;
  if (referenceType) filter.referenceType = referenceType;
  
  if (startDate) {
    filter.transactionDate = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [entries, totalEntries] = await Promise.all([
    GeneralLedger.find(filter)
      .populate('accountId', 'accountCode accountName accountType')
      .populate('journalEntryId', 'entryNumber description')
      .populate('createdBy', 'name email')
      .sort({ transactionDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    GeneralLedger.countDocuments(filter)
  ]);

  res.status(200).json({
    status: 'success',
    results: entries.length,
    data: {
      entries,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(totalEntries / parseInt(limit)),
        total: totalEntries,
        limit: parseInt(limit)
      }
    }
  });
});

// Get trial balance
export const getTrialBalance = catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { date = new Date().toISOString() } = req.query;

  const trialBalance = await GeneralLedger.getTrialBalance(hotelId, new Date(date));
  
  // Calculate totals
  const totals = trialBalance.reduce((acc, account) => ({
    totalDebits: acc.totalDebits + account.debitBalance,
    totalCredits: acc.totalCredits + account.creditBalance
  }), { totalDebits: 0, totalCredits: 0 });

  // Group by account type
  const byAccountType = trialBalance.reduce((acc, account) => {
    if (!acc[account.accountType]) {
      acc[account.accountType] = {
        accounts: [],
        totalDebits: 0,
        totalCredits: 0
      };
    }
    
    acc[account.accountType].accounts.push(account);
    acc[account.accountType].totalDebits += account.debitBalance;
    acc[account.accountType].totalCredits += account.creditBalance;
    
    return acc;
  }, {});

  res.status(200).json({
    status: 'success',
    data: {
      trialBalance,
      byAccountType,
      totals,
      balanceCheck: Math.abs(totals.totalDebits - totals.totalCredits) < 0.01,
      asOfDate: new Date(date)
    }
  });
});

// Get account ledger (detailed view of an account)
export const getAccountLedger = catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { accountId } = req.params;
  const {
    startDate,
    endDate = new Date().toISOString(),
    includeRunningBalance = true,
    page = 1,
    limit = 100
  } = req.query;

  // Verify account exists and belongs to hotel
  const account = await ChartOfAccounts.findOne({ _id: accountId, hotelId });
  if (!account) {
    return res.status(404).json({
      status: 'error',
      message: 'Account not found'
    });
  }

  let filter = {
    accountId,
    status: 'Posted'
  };

  if (startDate) {
    filter.transactionDate = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Get opening balance if start date is provided
  let openingBalance = 0;
  if (startDate) {
    openingBalance = await GeneralLedger.getAccountBalance(accountId, new Date(startDate));
  }

  const [entries, totalEntries] = await Promise.all([
    GeneralLedger.find(filter)
      .populate('journalEntryId', 'entryNumber description referenceNumber')
      .sort({ transactionDate: 1, createdAt: 1 })
      .skip(skip)
      .limit(parseInt(limit)),
    GeneralLedger.countDocuments(filter)
  ]);

  // Calculate running balance if requested
  if (includeRunningBalance === 'true') {
    let runningBalance = openingBalance;
    
    entries.forEach(entry => {
      if (account.normalBalance === 'Debit') {
        runningBalance += entry.debitAmount - entry.creditAmount;
      } else {
        runningBalance += entry.creditAmount - entry.debitAmount;
      }
      entry.runningBalance = runningBalance;
    });
  }

  const currentBalance = await GeneralLedger.getAccountBalance(accountId);

  res.status(200).json({
    status: 'success',
    data: {
      account: {
        _id: account._id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        accountType: account.accountType,
        normalBalance: account.normalBalance
      },
      openingBalance,
      currentBalance,
      entries,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(totalEntries / parseInt(limit)),
        total: totalEntries,
        limit: parseInt(limit)
      }
    }
  });
});

// Get financial statements
export const getFinancialStatements = catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { 
    type = 'all', // 'all', 'balance_sheet', 'income_statement', 'cash_flow'
    startDate,
    endDate = new Date().toISOString(),
    compareWithPrevious = false
  } = req.query;

  const reportDate = new Date(endDate);
  const statements = {};

  if (type === 'all' || type === 'balance_sheet') {
    // Balance Sheet
    const balanceSheetData = await GeneralLedger.aggregate([
      {
        $match: {
          hotelId,
          transactionDate: { $lte: reportDate },
          status: 'Posted'
        }
      },
      {
        $lookup: {
          from: 'chartofaccounts',
          localField: 'accountId',
          foreignField: '_id',
          as: 'account'
        }
      },
      {
        $unwind: '$account'
      },
      {
        $match: {
          'account.accountType': { $in: ['Asset', 'Liability', 'Equity'] }
        }
      },
      {
        $group: {
          _id: {
            accountId: '$accountId',
            accountType: '$account.accountType',
            accountSubType: '$account.accountSubType',
            accountCode: '$account.accountCode',
            accountName: '$account.accountName',
            normalBalance: '$account.normalBalance'
          },
          totalDebits: { $sum: '$debitAmount' },
          totalCredits: { $sum: '$creditAmount' }
        }
      },
      {
        $addFields: {
          balance: {
            $cond: [
              { $eq: ['$_id.normalBalance', 'Debit'] },
              { $subtract: ['$totalDebits', '$totalCredits'] },
              { $subtract: ['$totalCredits', '$totalDebits'] }
            ]
          }
        }
      },
      {
        $group: {
          _id: '$_id.accountType',
          subTypes: {
            $push: {
              subType: '$_id.accountSubType',
              accounts: [{
                accountId: '$_id.accountId',
                accountCode: '$_id.accountCode',
                accountName: '$_id.accountName',
                balance: '$balance'
              }]
            }
          },
          totalBalance: { $sum: '$balance' }
        }
      }
    ]);

    statements.balanceSheet = balanceSheetData;
  }

  if (type === 'all' || type === 'income_statement') {
    // Income Statement
    const incomeStatementFilter = {
      hotelId,
      status: 'Posted'
    };
    
    if (startDate) {
      incomeStatementFilter.transactionDate = {
        $gte: new Date(startDate),
        $lte: reportDate
      };
    }

    const incomeStatementData = await GeneralLedger.aggregate([
      { $match: incomeStatementFilter },
      {
        $lookup: {
          from: 'chartofaccounts',
          localField: 'accountId',
          foreignField: '_id',
          as: 'account'
        }
      },
      {
        $unwind: '$account'
      },
      {
        $match: {
          'account.accountType': { $in: ['Revenue', 'Expense'] }
        }
      },
      {
        $group: {
          _id: {
            accountId: '$accountId',
            accountType: '$account.accountType',
            accountSubType: '$account.accountSubType',
            accountCode: '$account.accountCode',
            accountName: '$account.accountName',
            normalBalance: '$account.normalBalance'
          },
          totalDebits: { $sum: '$debitAmount' },
          totalCredits: { $sum: '$creditAmount' }
        }
      },
      {
        $addFields: {
          amount: {
            $cond: [
              { $eq: ['$_id.accountType', 'Revenue'] },
              { $subtract: ['$totalCredits', '$totalDebits'] },
              { $subtract: ['$totalDebits', '$totalCredits'] }
            ]
          }
        }
      },
      {
        $group: {
          _id: '$_id.accountType',
          accounts: {
            $push: {
              accountId: '$_id.accountId',
              accountCode: '$_id.accountCode',
              accountName: '$_id.accountName',
              amount: '$amount'
            }
          },
          total: { $sum: '$amount' }
        }
      }
    ]);

    const revenue = incomeStatementData.find(item => item._id === 'Revenue')?.total || 0;
    const expenses = incomeStatementData.find(item => item._id === 'Expense')?.total || 0;
    const netIncome = revenue - expenses;

    statements.incomeStatement = {
      data: incomeStatementData,
      summary: { revenue, expenses, netIncome }
    };
  }

  res.status(200).json({
    status: 'success',
    data: {
      statements,
      reportPeriod: {
        startDate: startDate ? new Date(startDate) : null,
        endDate: reportDate
      }
    }
  });
});

// Get aging report
export const getAgingReport = catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { 
    type = 'receivables', // 'receivables' or 'payables'
    asOfDate = new Date().toISOString()
  } = req.query;

  const reportDate = new Date(asOfDate);
  const accountTypes = type === 'receivables' 
    ? ['Asset'] 
    : ['Liability'];

  const agingData = await GeneralLedger.aggregate([
    {
      $match: {
        hotelId,
        transactionDate: { $lte: reportDate },
        status: 'Posted',
        $or: [
          { debitAmount: { $gt: 0 } },
          { creditAmount: { $gt: 0 } }
        ]
      }
    },
    {
      $lookup: {
        from: 'chartofaccounts',
        localField: 'accountId',
        foreignField: '_id',
        as: 'account'
      }
    },
    {
      $unwind: '$account'
    },
    {
      $match: {
        'account.accountType': { $in: accountTypes }
      }
    },
    {
      $addFields: {
        daysOld: {
          $divide: [
            { $subtract: [reportDate, '$transactionDate'] },
            1000 * 60 * 60 * 24
          ]
        },
        netAmount: {
          $subtract: ['$debitAmount', '$creditAmount']
        }
      }
    },
    {
      $addFields: {
        ageBucket: {
          $switch: {
            branches: [
              { case: { $lte: ['$daysOld', 30] }, then: 'current' },
              { case: { $lte: ['$daysOld', 60] }, then: '31-60' },
              { case: { $lte: ['$daysOld', 90] }, then: '61-90' },
              { case: { $lte: ['$daysOld', 120] }, then: '91-120' }
            ],
            default: '120+'
          }
        }
      }
    },
    {
      $group: {
        _id: {
          accountId: '$accountId',
          accountName: '$account.accountName',
          ageBucket: '$ageBucket'
        },
        amount: { $sum: '$netAmount' }
      }
    },
    {
      $group: {
        _id: {
          accountId: '$_id.accountId',
          accountName: '$_id.accountName'
        },
        agingBuckets: {
          $push: {
            bucket: '$_id.ageBucket',
            amount: '$amount'
          }
        },
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      agingReport: agingData,
      reportType: type,
      asOfDate: reportDate
    }
  });
});

// Export ledger to CSV/Excel
export const exportLedger = catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const {
    format = 'csv', // 'csv' or 'excel'
    accountId,
    startDate,
    endDate = new Date().toISOString()
  } = req.query;

  let filter = { hotelId, status: 'Posted' };
  
  if (accountId) filter.accountId = accountId;
  if (startDate) {
    filter.transactionDate = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  const entries = await GeneralLedger.find(filter)
    .populate('accountId', 'accountCode accountName')
    .populate('journalEntryId', 'entryNumber description')
    .sort({ transactionDate: 1, createdAt: 1 })
    .lean();

  // Format data for export
  const exportData = entries.map(entry => ({
    'Transaction Date': entry.transactionDate.toISOString().split('T')[0],
    'Account Code': entry.accountId?.accountCode || '',
    'Account Name': entry.accountId?.accountName || '',
    'Description': entry.description,
    'Journal Entry': entry.journalEntryId?.entryNumber || '',
    'Reference': entry.referenceId,
    'Debit Amount': entry.debitAmount,
    'Credit Amount': entry.creditAmount,
    'Balance': entry.runningBalance || 0,
    'Status': entry.status
  }));

  if (format === 'csv') {
    const csv = convertToCSV(exportData);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=general_ledger.csv');
    return res.send(csv);
  }

  // For now, return JSON data (Excel export would need a library like exceljs)
  res.status(200).json({
    status: 'success',
    message: 'Excel export not yet implemented',
    data: exportData
  });
});

// Helper function to convert JSON to CSV
function convertToCSV(data) {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => 
        typeof row[header] === 'string' 
          ? `"${row[header].replace(/"/g, '""')}"` 
          : row[header]
      ).join(',')
    )
  ].join('\n');
  
  return csvContent;
}

export default {
  getLedgerEntries,
  getTrialBalance,
  getAccountLedger,
  getFinancialStatements,
  getAgingReport,
  exportLedger
};
