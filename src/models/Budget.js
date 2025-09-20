import mongoose from 'mongoose';

const budgetLineSchema = new mongoose.Schema({
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChartOfAccounts',
    required: true
  },
  period1: { type: Number, default: 0 },
  period2: { type: Number, default: 0 },
  period3: { type: Number, default: 0 },
  period4: { type: Number, default: 0 },
  period5: { type: Number, default: 0 },
  period6: { type: Number, default: 0 },
  period7: { type: Number, default: 0 },
  period8: { type: Number, default: 0 },
  period9: { type: Number, default: 0 },
  period10: { type: Number, default: 0 },
  period11: { type: Number, default: 0 },
  period12: { type: Number, default: 0 },
  annualTotal: {
    type: Number,
    default: 0
  },
  quarterlyTotals: {
    q1: { type: Number, default: 0 },
    q2: { type: Number, default: 0 },
    q3: { type: Number, default: 0 },
    q4: { type: Number, default: 0 }
  },
  notes: String
});

const budgetSchema = new mongoose.Schema({
  budgetName: {
    type: String,
    required: true,
    trim: true
  },
  budgetType: {
    type: String,
    required: true,
    enum: ['Operating', 'Capital', 'Cash Flow', 'Project', 'Department', 'Master']
  },
  fiscalYear: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['Draft', 'Review', 'Approved', 'Active', 'Closed', 'Revised'],
    default: 'Draft'
  },
  version: {
    type: Number,
    default: 1
  },
  previousVersionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Budget'
  },
  department: {
    type: String
  },
  project: {
    type: String
  },
  currency: {
    type: String,
    default: 'INR'
  },
  budgetLines: [budgetLineSchema],
  assumptions: {
    occupancyRate: Number,
    averageDailyRate: Number,
    inflationRate: Number,
    exchangeRates: [{
      currency: String,
      rate: Number
    }],
    notes: String
  },
  totalRevenue: {
    type: Number,
    default: 0
  },
  totalExpenses: {
    type: Number,
    default: 0
  },
  netIncome: {
    type: Number,
    default: 0
  },
  approvalWorkflow: [{
    approverRole: String,
    approverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    comments: String,
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected']
    }
  }],
  actualComparison: {
    lastUpdated: Date,
    varianceThreshold: {
      type: Number,
      default: 10 // Percentage
    },
    alerts: [{
      accountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ChartOfAccounts'
      },
      period: Number,
      budgetAmount: Number,
      actualAmount: Number,
      variance: Number,
      variancePercentage: Number,
      alertDate: Date
    }]
  },
  notes: {
    type: String
  },
  attachments: [{
    fileName: String,
    fileUrl: String,
    uploadedAt: Date
  }],
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for performance
budgetSchema.index({ hotelId: 1, fiscalYear: 1, budgetType: 1 });
budgetSchema.index({ hotelId: 1, status: 1 });
budgetSchema.index({ hotelId: 1, department: 1 });
budgetSchema.index({ hotelId: 1, project: 1 });

// Pre-save middleware to calculate totals
budgetSchema.pre('save', function(next) {
  // Calculate line totals
  this.budgetLines.forEach(line => {
    line.annualTotal = line.period1 + line.period2 + line.period3 + line.period4 +
                       line.period5 + line.period6 + line.period7 + line.period8 +
                       line.period9 + line.period10 + line.period11 + line.period12;
    
    line.quarterlyTotals = {
      q1: line.period1 + line.period2 + line.period3,
      q2: line.period4 + line.period5 + line.period6,
      q3: line.period7 + line.period8 + line.period9,
      q4: line.period10 + line.period11 + line.period12
    };
  });
  
  // Calculate budget totals
  this.calculateTotals();
  
  next();
});

// Method to calculate totals
budgetSchema.methods.calculateTotals = async function() {
  const ChartOfAccounts = mongoose.model('ChartOfAccounts');
  
  let totalRevenue = 0;
  let totalExpenses = 0;
  
  for (const line of this.budgetLines) {
    const account = await ChartOfAccounts.findById(line.accountId);
    
    if (account) {
      if (account.accountType === 'Revenue') {
        totalRevenue += line.annualTotal;
      } else if (account.accountType === 'Expense') {
        totalExpenses += line.annualTotal;
      }
    }
  }
  
  this.totalRevenue = totalRevenue;
  this.totalExpenses = totalExpenses;
  this.netIncome = totalRevenue - totalExpenses;
  
  return {
    totalRevenue,
    totalExpenses,
    netIncome: this.netIncome
  };
};

// Method to compare with actuals
budgetSchema.methods.compareWithActuals = async function(period) {
  const GeneralLedger = mongoose.model('GeneralLedger');
  const comparison = [];
  
  const startDate = new Date(this.fiscalYear, period - 1, 1);
  const endDate = new Date(this.fiscalYear, period, 0);
  
  for (const line of this.budgetLines) {
    const actualData = await GeneralLedger.aggregate([
      {
        $match: {
          accountId: line.accountId,
          transactionDate: { $gte: startDate, $lte: endDate },
          status: 'Posted',
          hotelId: this.hotelId
        }
      },
      {
        $group: {
          _id: null,
          totalDebit: { $sum: '$debitAmount' },
          totalCredit: { $sum: '$creditAmount' }
        }
      }
    ]);
    
    const actual = actualData.length > 0 
      ? Math.abs(actualData[0].totalDebit - actualData[0].totalCredit)
      : 0;
    
    const budgetAmount = line[`period${period}`];
    const variance = actual - budgetAmount;
    const variancePercentage = budgetAmount !== 0 
      ? (variance / budgetAmount) * 100 
      : 0;
    
    comparison.push({
      accountId: line.accountId,
      budgetAmount,
      actualAmount: actual,
      variance,
      variancePercentage,
      isOverBudget: variance > 0 && Math.abs(variancePercentage) > this.actualComparison.varianceThreshold
    });
    
    // Add alert if over threshold
    if (Math.abs(variancePercentage) > this.actualComparison.varianceThreshold) {
      this.actualComparison.alerts.push({
        accountId: line.accountId,
        period,
        budgetAmount,
        actualAmount: actual,
        variance,
        variancePercentage,
        alertDate: new Date()
      });
    }
  }
  
  this.actualComparison.lastUpdated = new Date();
  await this.save();
  
  return comparison;
};

// Method to create revised budget
budgetSchema.methods.createRevision = async function(changes) {
  const revisedBudget = new this.constructor({
    ...this.toObject(),
    _id: undefined,
    version: this.version + 1,
    previousVersionId: this._id,
    status: 'Draft',
    createdAt: undefined,
    updatedAt: undefined,
    approvedBy: undefined,
    approvedAt: undefined,
    ...changes
  });
  
  await revisedBudget.save();
  
  // Update current budget status
  this.status = 'Revised';
  await this.save();
  
  return revisedBudget;
};

// Method to approve budget
budgetSchema.methods.approve = async function(userId) {
  if (this.status !== 'Review') {
    throw new Error('Only budgets in review can be approved');
  }
  
  this.status = 'Approved';
  this.approvedBy = userId;
  this.approvedAt = new Date();
  
  // Deactivate other active budgets of same type
  await this.constructor.updateMany(
    {
      hotelId: this.hotelId,
      fiscalYear: this.fiscalYear,
      budgetType: this.budgetType,
      status: 'Active',
      _id: { $ne: this._id }
    },
    { status: 'Closed' }
  );
  
  // Activate this budget
  this.status = 'Active';
  await this.save();
  
  return this;
};

// Static method to get budget vs actual summary
budgetSchema.statics.getBudgetVsActual = async function(hotelId, fiscalYear, period) {
  const budget = await this.findOne({
    hotelId,
    fiscalYear,
    status: 'Active',
    budgetType: 'Operating'
  }).populate('budgetLines.accountId');
  
  if (!budget) {
    throw new Error('No active budget found');
  }
  
  return budget.compareWithActuals(period);
};

// Static method to forecast based on trend
budgetSchema.statics.generateForecast = async function(hotelId, fiscalYear, basedOnMonths = 6) {
  const GeneralLedger = mongoose.model('GeneralLedger');
  const ChartOfAccounts = mongoose.model('ChartOfAccounts');
  
  const accounts = await ChartOfAccounts.find({
    hotelId,
    isActive: true,
    accountType: { $in: ['Revenue', 'Expense'] }
  });
  
  const forecast = [];
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - basedOnMonths);
  
  for (const account of accounts) {
    const historicalData = await GeneralLedger.aggregate([
      {
        $match: {
          accountId: account._id,
          transactionDate: { $gte: startDate, $lte: endDate },
          status: 'Posted'
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$transactionDate' },
            month: { $month: '$transactionDate' }
          },
          total: {
            $sum: {
              $cond: [
                { $eq: [account.normalBalance, 'Debit'] },
                { $subtract: ['$debitAmount', '$creditAmount'] },
                { $subtract: ['$creditAmount', '$debitAmount'] }
              ]
            }
          }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);
    
    if (historicalData.length > 0) {
      // Calculate average and trend
      const average = historicalData.reduce((sum, d) => sum + d.total, 0) / historicalData.length;
      
      // Simple linear trend
      const trend = historicalData.length > 1 
        ? (historicalData[historicalData.length - 1].total - historicalData[0].total) / historicalData.length
        : 0;
      
      // Generate forecast for next 12 months
      const monthlyForecast = [];
      for (let i = 1; i <= 12; i++) {
        monthlyForecast.push(Math.max(0, average + (trend * i)));
      }
      
      forecast.push({
        accountId: account._id,
        accountName: account.accountName,
        historicalAverage: average,
        trend,
        monthlyForecast
      });
    }
  }
  
  return forecast;
};

const Budget = mongoose.model('Budget', budgetSchema);

export default Budget;
