import mongoose from 'mongoose';

const chartOfAccountsSchema = new mongoose.Schema({
  accountCode: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  accountName: {
    type: String,
    required: true,
    trim: true
  },
  accountType: {
    type: String,
    required: true,
    enum: ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'],
  },
  accountSubType: {
    type: String,
    required: true,
    enum: [
      // Asset subtypes
      'Current Asset', 'Fixed Asset', 'Other Asset',
      // Liability subtypes
      'Current Liability', 'Long-term Liability',
      // Equity subtypes
      'Owner Equity', 'Retained Earnings',
      // Revenue subtypes
      'Operating Revenue', 'Other Revenue',
      // Expense subtypes
      'Operating Expense', 'Cost of Goods Sold', 'Other Expense'
    ]
  },
  parentAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChartOfAccounts',
    default: null
  },
  description: {
    type: String,
    default: ''
  },
  normalBalance: {
    type: String,
    enum: ['Debit', 'Credit'],
    required: true
  },
  currentBalance: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isSystemAccount: {
    type: Boolean,
    default: false // System accounts can't be deleted
  },
  taxCode: {
    type: String,
    default: null
  },
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
  metadata: {
    bankAccountNumber: String,
    bankName: String,
    ifscCode: String,
    swiftCode: String,
    branchName: String
  }
}, {
  timestamps: true
});

// Indexes for performance
chartOfAccountsSchema.index({ hotelId: 1, accountCode: 1 }, { unique: true });
chartOfAccountsSchema.index({ hotelId: 1, accountName: 1 });
chartOfAccountsSchema.index({ hotelId: 1, accountType: 1 });
chartOfAccountsSchema.index({ hotelId: 1, accountSubType: 1 });
chartOfAccountsSchema.index({ hotelId: 1, isActive: 1 });
chartOfAccountsSchema.index({ parentAccount: 1 });
chartOfAccountsSchema.index({ hotelId: 1, normalBalance: 1 });
chartOfAccountsSchema.index({ hotelId: 1, accountType: 1, isActive: 1 });

// Virtual for full account path
chartOfAccountsSchema.virtual('fullAccountName').get(function() {
  return `${this.accountCode} - ${this.accountName}`;
});

// Method to get account hierarchy
chartOfAccountsSchema.methods.getHierarchy = async function() {
  const hierarchy = [];
  let currentAccount = this;
  
  while (currentAccount.parentAccount) {
    currentAccount = await this.constructor.findById(currentAccount.parentAccount);
    if (currentAccount) {
      hierarchy.unshift(currentAccount);
    } else {
      break;
    }
  }
  
  return hierarchy;
};

// Static method to get account tree
chartOfAccountsSchema.statics.getAccountTree = async function(hotelId) {
  // Temporarily bypass hotel filtering for testing
  const filter = hotelId ? { hotelId, isActive: true } : { isActive: true };
  const accounts = await this.find(filter).lean();
  
  const buildTree = (parentId = null) => {
    return accounts
      .filter(account => {
        if (parentId === null) {
          return !account.parentAccount;
        }
        return account.parentAccount && account.parentAccount.toString() === parentId.toString();
      })
      .map(account => ({
        ...account,
        children: buildTree(account._id)
      }));
  };
  
  return buildTree();
};

// Pre-save middleware to set normal balance based on account type
chartOfAccountsSchema.pre('save', function(next) {
  if (!this.normalBalance) {
    switch (this.accountType) {
      case 'Asset':
      case 'Expense':
        this.normalBalance = 'Debit';
        break;
      case 'Liability':
      case 'Equity':
      case 'Revenue':
        this.normalBalance = 'Credit';
        break;
    }
  }
  next();
});

const ChartOfAccounts = mongoose.model('ChartOfAccounts', chartOfAccountsSchema);

export default ChartOfAccounts;
