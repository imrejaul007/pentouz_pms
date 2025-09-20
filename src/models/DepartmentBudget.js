import mongoose from 'mongoose';

const departmentBudgetSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true
  },
  department: {
    type: String,
    required: true,
    enum: ['housekeeping', 'maintenance', 'front_desk', 'food_beverage', 'spa', 'laundry', 'kitchen', 'bar', 'other']
  },
  budgetPeriod: {
    year: { type: Number, required: true },
    month: { type: Number }, // null for yearly budget
    quarter: { type: Number } // null for non-quarterly budget
  },
  allocations: {
    total: { type: Number, required: true },
    supply_requests: { type: Number, required: true },
    equipment: { type: Number, default: 0 },
    maintenance: { type: Number, default: 0 },
    other: { type: Number, default: 0 }
  },
  spent: {
    total: { type: Number, default: 0 },
    supply_requests: { type: Number, default: 0 },
    equipment: { type: Number, default: 0 },
    maintenance: { type: Number, default: 0 },
    other: { type: Number, default: 0 }
  },
  commitments: {
    pending_approvals: { type: Number, default: 0 },
    approved_orders: { type: Number, default: 0 }
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['active', 'closed', 'frozen'],
    default: 'active'
  },
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for performance
departmentBudgetSchema.index({ hotelId: 1, department: 1, 'budgetPeriod.year': 1, 'budgetPeriod.month': 1 });
departmentBudgetSchema.index({ hotelId: 1, status: 1 });
departmentBudgetSchema.index({ department: 1, 'budgetPeriod.year': 1 });

// Virtual fields
departmentBudgetSchema.virtual('utilizationPercentage').get(function() {
  if (this.allocations.supply_requests === 0) return 0;
  return Math.round((this.spent.supply_requests / this.allocations.supply_requests) * 100 * 100) / 100;
});

departmentBudgetSchema.virtual('remainingBudget').get(function() {
  return this.allocations.supply_requests - this.spent.supply_requests - this.commitments.pending_approvals;
});

departmentBudgetSchema.virtual('totalCommitments').get(function() {
  return this.commitments.pending_approvals + this.commitments.approved_orders;
});

departmentBudgetSchema.virtual('availableBudget').get(function() {
  return this.allocations.supply_requests - this.spent.supply_requests - this.totalCommitments;
});

// Ensure virtuals are included in JSON
departmentBudgetSchema.set('toJSON', { virtuals: true });
departmentBudgetSchema.set('toObject', { virtuals: true });

// Pre-save middleware to update totals
departmentBudgetSchema.pre('save', function(next) {
  // Update total allocations
  this.allocations.total = this.allocations.supply_requests + this.allocations.equipment +
                          this.allocations.maintenance + this.allocations.other;

  // Update total spent
  this.spent.total = this.spent.supply_requests + this.spent.equipment +
                    this.spent.maintenance + this.spent.other;

  next();
});

// Static method to get or create department budget
departmentBudgetSchema.statics.getOrCreateBudget = async function(hotelId, department, year, month = null) {
  const query = {
    hotelId,
    department,
    'budgetPeriod.year': year
  };

  if (month) {
    query['budgetPeriod.month'] = month;
  }

  let budget = await this.findOne(query);

  if (!budget) {
    // Create default budget based on department
    const defaultAllocations = this.getDefaultAllocation(department);

    budget = await this.create({
      hotelId,
      department,
      budgetPeriod: { year, month },
      allocations: {
        total: defaultAllocations.supply_requests,
        supply_requests: defaultAllocations.supply_requests,
        equipment: defaultAllocations.equipment || 0,
        maintenance: defaultAllocations.maintenance || 0,
        other: defaultAllocations.other || 0
      }
    });
  }

  return budget;
};

// Static method to get default allocation by department
departmentBudgetSchema.statics.getDefaultAllocation = function(department) {
  const defaultAllocations = {
    housekeeping: { supply_requests: 25000, equipment: 10000, maintenance: 5000 },
    maintenance: { supply_requests: 35000, equipment: 20000, maintenance: 15000 },
    front_desk: { supply_requests: 15000, equipment: 8000, maintenance: 2000 },
    food_beverage: { supply_requests: 40000, equipment: 15000, maintenance: 10000 },
    spa: { supply_requests: 20000, equipment: 12000, maintenance: 5000 },
    laundry: { supply_requests: 18000, equipment: 8000, maintenance: 7000 },
    kitchen: { supply_requests: 45000, equipment: 25000, maintenance: 15000 },
    bar: { supply_requests: 30000, equipment: 10000, maintenance: 5000 },
    other: { supply_requests: 10000, equipment: 5000, maintenance: 2000 }
  };

  return defaultAllocations[department] || { supply_requests: 20000, equipment: 5000, maintenance: 2000 };
};

// Method to update spending
departmentBudgetSchema.methods.updateSpending = async function(amount, category = 'supply_requests') {
  if (!this.spent[category]) {
    throw new Error(`Invalid spending category: ${category}`);
  }

  this.spent[category] += amount;
  await this.save();

  return this;
};

// Method to update commitments
departmentBudgetSchema.methods.updateCommitments = async function(amount, type = 'pending_approvals') {
  if (!this.commitments[type]) {
    throw new Error(`Invalid commitment type: ${type}`);
  }

  this.commitments[type] += amount;
  await this.save();

  return this;
};

// Method to move commitment from pending to approved
departmentBudgetSchema.methods.approveCommitment = async function(amount) {
  this.commitments.pending_approvals = Math.max(0, this.commitments.pending_approvals - amount);
  this.commitments.approved_orders += amount;
  await this.save();

  return this;
};

// Method to complete order (move from commitment to spent)
departmentBudgetSchema.methods.completeOrder = async function(approvedAmount, actualAmount) {
  this.commitments.approved_orders = Math.max(0, this.commitments.approved_orders - approvedAmount);
  this.spent.supply_requests += actualAmount;
  await this.save();

  return this;
};

// Method to check if budget allows spending
departmentBudgetSchema.methods.canSpend = function(amount, category = 'supply_requests') {
  const available = this.allocations[category] - this.spent[category] - this.totalCommitments;
  return available >= amount;
};

// Method to get budget alerts
departmentBudgetSchema.methods.getAlerts = function() {
  const alerts = [];
  const utilization = this.utilizationPercentage;

  if (utilization >= 95) {
    alerts.push({
      type: 'critical',
      severity: 'high',
      message: `${this.department} department has exceeded 95% of budget utilization (${utilization}%)`,
      threshold: 95,
      current: utilization
    });
  } else if (utilization >= 85) {
    alerts.push({
      type: 'warning',
      severity: 'medium',
      message: `${this.department} department has used ${utilization}% of allocated budget`,
      threshold: 85,
      current: utilization
    });
  }

  if (this.availableBudget < 1000) {
    alerts.push({
      type: 'low_budget',
      severity: 'medium',
      message: `${this.department} department has less than ₹1,000 available budget remaining`,
      availableAmount: this.availableBudget
    });
  }

  return alerts;
};

// Static method to get department budget summary
departmentBudgetSchema.statics.getDepartmentSummary = async function(hotelId, year, month = null) {
  const query = {
    hotelId,
    'budgetPeriod.year': year,
    status: 'active'
  };

  if (month) {
    query['budgetPeriod.month'] = month;
  }

  const budgets = await this.find(query);

  const summary = {
    totalAllocated: 0,
    totalSpent: 0,
    totalCommitments: 0,
    totalAvailable: 0,
    departments: []
  };

  budgets.forEach(budget => {
    summary.totalAllocated += budget.allocations.supply_requests;
    summary.totalSpent += budget.spent.supply_requests;
    summary.totalCommitments += budget.totalCommitments;
    summary.totalAvailable += budget.availableBudget;

    summary.departments.push({
      department: budget.department,
      allocated: budget.allocations.supply_requests,
      spent: budget.spent.supply_requests,
      utilization: budget.utilizationPercentage,
      available: budget.availableBudget,
      alerts: budget.getAlerts()
    });
  });

  summary.departments.sort((a, b) => b.utilization - a.utilization);

  return summary;
};

// Static method to analyze spending trends
departmentBudgetSchema.statics.getSpendingTrends = async function(hotelId, department, months = 6) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const trends = await this.aggregate([
    {
      $match: {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        department,
        'budgetPeriod.year': { $gte: startDate.getFullYear() }
      }
    },
    {
      $project: {
        year: '$budgetPeriod.year',
        month: '$budgetPeriod.month',
        spent: '$spent.supply_requests',
        allocated: '$allocations.supply_requests',
        utilization: '$utilizationPercentage'
      }
    },
    {
      $sort: { year: 1, month: 1 }
    }
  ]);

  return trends;
};

const DepartmentBudget = mongoose.model('DepartmentBudget', departmentBudgetSchema);

export default DepartmentBudget;
