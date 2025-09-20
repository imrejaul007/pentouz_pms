import Budget from '../models/Budget.js';
import ChartOfAccounts from '../models/ChartOfAccounts.js';
import GeneralLedger from '../models/GeneralLedger.js';
import { catchAsync } from '../utils/catchAsync.js';
import logger from '../utils/logger.js';

// Get budgets with filtering
export const getBudgets = catchAsync(async (req, res) => {
  // Temporarily bypass hotel filtering for testing
  // const { hotelId } = req.user;
  const {
    budgetType,
    fiscalYear,
    status,
    department,
    page = 1,
    limit = 20
  } = req.query;

  let filter = {}; // Remove hotelId filter temporarily
  
  if (budgetType) filter.budgetType = budgetType;
  if (fiscalYear) filter.fiscalYear = parseInt(fiscalYear);
  if (status) filter.status = status;
  if (department) filter.department = department;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [budgets, totalBudgets] = await Promise.all([
    Budget.find(filter)
      .populate('createdBy approvedBy', 'name email')
      .populate('budgetLines.accountId', 'accountCode accountName accountType')
      .sort({ fiscalYear: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Budget.countDocuments(filter)
  ]);

  // Calculate totals for each budget
  const budgetsWithTotals = budgets.map(budget => {
    const budgetObj = budget.toObject();

    let totalRevenue = 0;
    let totalExpenses = 0;

    budgetObj.budgetLines.forEach(line => {
      // Calculate annual total for this line
      const annualTotal = (line.period1 || 0) + (line.period2 || 0) + (line.period3 || 0) +
                         (line.period4 || 0) + (line.period5 || 0) + (line.period6 || 0) +
                         (line.period7 || 0) + (line.period8 || 0) + (line.period9 || 0) +
                         (line.period10 || 0) + (line.period11 || 0) + (line.period12 || 0);

      line.annualTotal = annualTotal;

      // Add to revenue or expense totals based on account type
      if (line.accountId && line.accountId.accountType === 'Revenue') {
        totalRevenue += annualTotal;
      } else if (line.accountId && line.accountId.accountType === 'Expense') {
        totalExpenses += annualTotal;
      }
    });

    budgetObj.totalRevenue = totalRevenue;
    budgetObj.totalExpenses = totalExpenses;
    budgetObj.netIncome = totalRevenue - totalExpenses;

    // Add fields that frontend expects
    budgetObj.totalBudgetedAmount = totalRevenue + totalExpenses; // Total budget (revenue target + expense budget)
    budgetObj.totalActualAmount = 0; // TODO: Calculate from actual transactions later

    return budgetObj;
  });

  res.status(200).json({
    status: 'success',
    results: budgetsWithTotals.length,
    data: {
      budgets: budgetsWithTotals,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(totalBudgets / parseInt(limit)),
        total: totalBudgets,
        limit: parseInt(limit)
      }
    }
  });
});

// Get single budget
export const getBudget = catchAsync(async (req, res) => {
  // Temporarily bypass hotel filtering for testing
  // const { hotelId } = req.user;
  const { id } = req.params;
  const { includeComparison = false } = req.query;

  const budget = await Budget.findOne({ _id: id })
    .populate('createdBy approvedBy', 'name email')
    .populate('budgetLines.accountId', 'accountCode accountName accountType')
    .populate('previousVersionId', 'budgetName version status');

  if (!budget) {
    return res.status(404).json({
      status: 'error',
      message: 'Budget not found'
    });
  }

  let responseData = { budget };

  // Include actual vs budget comparison if requested
  if (includeComparison === 'true' && budget.status === 'Active') {
    try {
      const currentPeriod = new Date().getMonth() + 1;
      const comparison = await budget.compareWithActuals(currentPeriod);
      responseData.actualComparison = comparison;
    } catch (error) {
      logger.warn(`Error generating budget comparison for budget ${budget._id}:`, error);
    }
  }

  res.status(200).json({
    status: 'success',
    data: responseData
  });
});

// Create new budget
export const createBudget = catchAsync(async (req, res) => {
  // Temporarily bypass hotel filtering for testing
  // const { hotelId, _id: userId } = req.user;
  const userId = 'temp-user-id'; // Temporary user ID for testing
  
  // Validate budget lines have valid accounts
  if (req.body.budgetLines?.length) {
    const accountIds = req.body.budgetLines.map(line => line.accountId);
    const accounts = await ChartOfAccounts.find({
      _id: { $in: accountIds },
      // hotelId, // Temporarily removed
      isActive: true
    });

    if (accounts.length !== accountIds.length) {
      return res.status(400).json({
        status: 'error',
        message: 'One or more accounts not found or inactive'
      });
    }
  }

  // Get first hotel ID for testing
  const Hotel = (await import('../models/Hotel.js')).default;
  const firstHotel = await Hotel.findOne();
  const hotelId = firstHotel ? firstHotel._id : null;

  const budgetData = {
    ...req.body,
    hotelId,
    createdBy: userId
  };

  const budget = await Budget.create(budgetData);
  
  await budget.populate('createdBy', 'name email');
  await budget.populate('budgetLines.accountId', 'accountCode accountName accountType');

  logger.info(`Budget created: ${budget.budgetName}`, {
    budgetId: budget._id,
    budgetType: budget.budgetType,
    fiscalYear: budget.fiscalYear,
    totalRevenue: budget.totalRevenue,
    totalExpenses: budget.totalExpenses,
    hotelId,
    userId
  });

  res.status(201).json({
    status: 'success',
    data: { budget }
  });
});

// Update budget
export const updateBudget = catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;
  const { id } = req.params;

  const budget = await Budget.findOne({ _id: id, hotelId });
  
  if (!budget) {
    return res.status(404).json({
      status: 'error',
      message: 'Budget not found'
    });
  }

  if (!['Draft', 'Review'].includes(budget.status)) {
    return res.status(400).json({
      status: 'error',
      message: 'Only draft or review budgets can be updated'
    });
  }

  // Validate budget lines if being updated
  if (req.body.budgetLines?.length) {
    const accountIds = req.body.budgetLines.map(line => line.accountId);
    const accounts = await ChartOfAccounts.find({
      _id: { $in: accountIds },
      hotelId,
      isActive: true
    });

    if (accounts.length !== accountIds.length) {
      return res.status(400).json({
        status: 'error',
        message: 'One or more accounts not found or inactive'
      });
    }
  }

  const updatedBudget = await Budget.findByIdAndUpdate(
    id,
    { ...req.body, updatedBy: userId },
    { new: true, runValidators: true }
  ).populate('budgetLines.accountId', 'accountCode accountName accountType');

  logger.info(`Budget updated: ${updatedBudget.budgetName}`, {
    budgetId: updatedBudget._id,
    hotelId,
    userId
  });

  res.status(200).json({
    status: 'success',
    data: { budget: updatedBudget }
  });
});

// Delete budget
export const deleteBudget = catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;
  const { id } = req.params;

  const budget = await Budget.findOne({ _id: id, hotelId });
  
  if (!budget) {
    return res.status(404).json({
      status: 'error',
      message: 'Budget not found'
    });
  }

  if (budget.status !== 'Draft') {
    return res.status(400).json({
      status: 'error',
      message: 'Only draft budgets can be deleted'
    });
  }

  await Budget.findByIdAndDelete(id);

  logger.info(`Budget deleted: ${budget.budgetName}`, {
    budgetId: budget._id,
    hotelId,
    userId
  });

  res.status(200).json({
    status: 'success',
    message: 'Budget deleted successfully'
  });
});

// Approve budget
export const approveBudget = catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;
  const { id } = req.params;

  const budget = await Budget.findOne({ _id: id, hotelId });
  
  if (!budget) {
    return res.status(404).json({
      status: 'error',
      message: 'Budget not found'
    });
  }

  try {
    const approvedBudget = await budget.approve(userId);
    
    await approvedBudget.populate('approvedBy', 'name email');

    logger.info(`Budget approved: ${approvedBudget.budgetName}`, {
      budgetId: approvedBudget._id,
      fiscalYear: approvedBudget.fiscalYear,
      budgetType: approvedBudget.budgetType,
      hotelId,
      userId
    });

    res.status(200).json({
      status: 'success',
      message: 'Budget approved and activated successfully',
      data: { budget: approvedBudget }
    });

  } catch (error) {
    logger.error(`Failed to approve budget: ${budget.budgetName}`, error);
    
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
});

// Submit budget for review
export const submitForReview = catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;
  const { id } = req.params;

  const budget = await Budget.findOne({ _id: id, hotelId });
  
  if (!budget) {
    return res.status(404).json({
      status: 'error',
      message: 'Budget not found'
    });
  }

  if (budget.status !== 'Draft') {
    return res.status(400).json({
      status: 'error',
      message: 'Only draft budgets can be submitted for review'
    });
  }

  budget.status = 'Review';
  budget.updatedBy = userId;
  await budget.save();

  logger.info(`Budget submitted for review: ${budget.budgetName}`, {
    budgetId: budget._id,
    hotelId,
    userId
  });

  res.status(200).json({
    status: 'success',
    message: 'Budget submitted for review',
    data: { budget }
  });
});

// Get budget vs actual comparison
export const getBudgetVsActual = catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { 
    fiscalYear = new Date().getFullYear(),
    period = new Date().getMonth() + 1,
    budgetType = 'Operating'
  } = req.query;

  try {
    const comparison = await Budget.getBudgetVsActual(
      hotelId,
      parseInt(fiscalYear),
      parseInt(period)
    );

    res.status(200).json({
      status: 'success',
      data: {
        comparison,
        fiscalYear: parseInt(fiscalYear),
        period: parseInt(period),
        budgetType
      }
    });

  } catch (error) {
    logger.error(`Error generating budget vs actual report:`, error);
    
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
});

// Generate budget forecast
export const generateForecast = catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { 
    fiscalYear = new Date().getFullYear(),
    basedOnMonths = 6
  } = req.query;

  try {
    const forecast = await Budget.generateForecast(
      hotelId,
      parseInt(fiscalYear),
      parseInt(basedOnMonths)
    );

    res.status(200).json({
      status: 'success',
      data: {
        forecast,
        fiscalYear: parseInt(fiscalYear),
        basedOnMonths: parseInt(basedOnMonths),
        generatedAt: new Date()
      }
    });

  } catch (error) {
    logger.error(`Error generating budget forecast:`, error);
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate forecast'
    });
  }
});

// Create budget revision
export const createRevision = catchAsync(async (req, res) => {
  const { hotelId, _id: userId } = req.user;
  const { id } = req.params;

  const budget = await Budget.findOne({ _id: id, hotelId });
  
  if (!budget) {
    return res.status(404).json({
      status: 'error',
      message: 'Budget not found'
    });
  }

  if (!['Approved', 'Active'].includes(budget.status)) {
    return res.status(400).json({
      status: 'error',
      message: 'Only approved or active budgets can be revised'
    });
  }

  try {
    const revisedBudget = await budget.createRevision({
      ...req.body,
      createdBy: userId
    });

    await revisedBudget.populate('createdBy', 'name email');
    await revisedBudget.populate('budgetLines.accountId', 'accountCode accountName accountType');

    logger.info(`Budget revision created: ${revisedBudget.budgetName}`, {
      originalBudgetId: budget._id,
      revisedBudgetId: revisedBudget._id,
      version: revisedBudget.version,
      hotelId,
      userId
    });

    res.status(201).json({
      status: 'success',
      message: 'Budget revision created successfully',
      data: { budget: revisedBudget }
    });

  } catch (error) {
    logger.error(`Failed to create budget revision:`, error);
    
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
});

// Get budget summary
export const getBudgetSummary = catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { fiscalYear = new Date().getFullYear() } = req.query;

  const budgets = await Budget.find({
    hotelId,
    fiscalYear: parseInt(fiscalYear)
  }).select('budgetName budgetType status totalRevenue totalExpenses netIncome');

  const summary = budgets.reduce((acc, budget) => {
    if (!acc[budget.budgetType]) {
      acc[budget.budgetType] = {
        count: 0,
        totalRevenue: 0,
        totalExpenses: 0,
        netIncome: 0,
        budgets: []
      };
    }

    acc[budget.budgetType].count += 1;
    acc[budget.budgetType].totalRevenue += budget.totalRevenue;
    acc[budget.budgetType].totalExpenses += budget.totalExpenses;
    acc[budget.budgetType].netIncome += budget.netIncome;
    acc[budget.budgetType].budgets.push(budget);

    return acc;
  }, {});

  const overallTotals = budgets.reduce((totals, budget) => ({
    totalRevenue: totals.totalRevenue + budget.totalRevenue,
    totalExpenses: totals.totalExpenses + budget.totalExpenses,
    netIncome: totals.netIncome + budget.netIncome
  }), { totalRevenue: 0, totalExpenses: 0, netIncome: 0 });

  res.status(200).json({
    status: 'success',
    data: {
      summary,
      overallTotals,
      fiscalYear: parseInt(fiscalYear),
      totalBudgets: budgets.length
    }
  });
});

// Get budget statistics
export const getBudgetStatistics = catchAsync(async (req, res) => {
  try {
    // Get basic counts and stats using simple operations
    const [totalCount, activeBudgets, draftBudgets, approvedBudgets] = await Promise.all([
      Budget.countDocuments(),
      Budget.countDocuments({ status: 'Active' }),
      Budget.countDocuments({ status: 'Draft' }),
      Budget.countDocuments({ status: 'Approved' })
    ]);

    // Get all budgets for calculations
    const budgets = await Budget.find().select('totalRevenue totalExpenses netIncome');

    const totalBudgetedRevenue = budgets.reduce((sum, budget) => sum + (budget.totalRevenue || 0), 0);
    const totalBudgetedExpenses = budgets.reduce((sum, budget) => sum + (budget.totalExpenses || 0), 0);
    const totalProjectedNetIncome = budgets.reduce((sum, budget) => sum + (budget.netIncome || 0), 0);

    const avgBudgetedRevenue = totalCount > 0 ? totalBudgetedRevenue / totalCount : 0;
    const avgNetIncomeMargin = totalBudgetedRevenue > 0 ? (totalProjectedNetIncome / totalBudgetedRevenue) * 100 : 0;

    const statistics = {
      totalBudgets: totalCount,
      totalBudgetedRevenue,
      totalBudgetedExpenses,
      totalProjectedNetIncome,
      activeBudgets,
      draftBudgets,
      approvedBudgets,
      avgBudgetedRevenue,
      avgNetIncomeMargin
    };

    res.status(200).json({
      status: 'success',
      data: { statistics }
    });

  } catch (error) {
    logger.error('Error calculating budget statistics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to calculate budget statistics'
    });
  }
});

// Get budget templates
export const getBudgetTemplates = catchAsync(async (req, res) => {
  const templates = [
    {
      name: 'Operating Budget Template',
      budgetType: 'Operating',
      description: 'Standard operating budget for hotel operations',
      categories: [
        {
          name: 'Revenue',
          accounts: ['Room Revenue', 'F&B Revenue', 'Other Revenue']
        },
        {
          name: 'Operating Expenses',
          accounts: ['Payroll', 'Utilities', 'Marketing', 'Maintenance']
        }
      ]
    },
    {
      name: 'Capital Budget Template',
      budgetType: 'Capital',
      description: 'Budget for capital expenditures and investments',
      categories: [
        {
          name: 'Capital Expenditures',
          accounts: ['Equipment Purchase', 'Building Improvements', 'Technology']
        }
      ]
    },
    {
      name: 'Department Budget Template',
      budgetType: 'Department',
      description: 'Budget template for individual departments',
      categories: [
        {
          name: 'Department Revenue',
          accounts: ['Department Sales', 'Service Revenue']
        },
        {
          name: 'Department Expenses',
          accounts: ['Department Payroll', 'Department Supplies', 'Department Utilities']
        }
      ]
    }
  ];

  res.status(200).json({
    status: 'success',
    data: { templates }
  });
});

export default {
  getBudgets,
  getBudget,
  createBudget,
  updateBudget,
  deleteBudget,
  approveBudget,
  submitForReview,
  getBudgetVsActual,
  generateForecast,
  createRevision,
  getBudgetSummary,
  getBudgetStatistics,
  getBudgetTemplates
};
