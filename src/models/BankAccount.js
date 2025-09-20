import mongoose from 'mongoose';

const bankTransactionSchema = new mongoose.Schema({
  transactionDate: {
    type: Date,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  referenceNumber: {
    type: String
  },
  debitAmount: {
    type: Number,
    default: 0
  },
  creditAmount: {
    type: Number,
    default: 0
  },
  balance: {
    type: Number,
    required: true
  },
  transactionType: {
    type: String,
    enum: ['Deposit', 'Withdrawal', 'Transfer', 'Fee', 'Interest', 'Adjustment']
  },
  isReconciled: {
    type: Boolean,
    default: false
  },
  reconciledDate: {
    type: Date
  },
  journalEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JournalEntry'
  }
});

const bankAccountSchema = new mongoose.Schema({
  accountName: {
    type: String,
    required: true,
    trim: true
  },
  accountNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  accountType: {
    type: String,
    required: true,
    enum: ['Checking', 'Savings', 'Credit Card', 'Cash', 'Loan', 'Investment']
  },
  bankName: {
    type: String,
    required: true
  },
  branchName: {
    type: String
  },
  branchAddress: {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String
  },
  ifscCode: {
    type: String
  },
  swiftCode: {
    type: String
  },
  routingNumber: {
    type: String
  },
  currency: {
    type: String,
    default: 'INR',
    required: true
  },
  openingBalance: {
    type: Number,
    default: 0,
    required: true
  },
  currentBalance: {
    type: Number,
    default: 0,
    required: true
  },
  availableBalance: {
    type: Number,
    default: 0
  },
  creditLimit: {
    type: Number,
    default: 0
  },
  interestRate: {
    type: Number,
    default: 0
  },
  overdraftLimit: {
    type: Number,
    default: 0
  },
  glAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChartOfAccounts',
    required: true
  },
  transactions: [bankTransactionSchema],
  lastReconciledDate: {
    type: Date
  },
  lastReconciledBalance: {
    type: Number,
    default: 0
  },
  lastStatementDate: {
    type: Date
  },
  lastStatementBalance: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isPrimary: {
    type: Boolean,
    default: false
  },
  signatories: [{
    name: String,
    designation: String,
    signatureUrl: String
  }],
  accountManager: {
    name: String,
    email: String,
    phone: String
  },
  notes: {
    type: String
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
  }
}, {
  timestamps: true
});

// Indexes for performance
bankAccountSchema.index({ hotelId: 1, accountNumber: 1 });
bankAccountSchema.index({ hotelId: 1, isActive: 1 });
bankAccountSchema.index({ glAccountId: 1 });

// Virtual for unreconciled transactions
bankAccountSchema.virtual('unreconciledTransactions').get(function() {
  return this.transactions.filter(t => !t.isReconciled);
});

// Virtual for reconciliation difference
bankAccountSchema.virtual('reconciliationDifference').get(function() {
  const unreconciledSum = this.unreconciledTransactions.reduce((sum, t) => {
    return sum + t.creditAmount - t.debitAmount;
  }, 0);
  return this.currentBalance - this.lastReconciledBalance - unreconciledSum;
});

// Method to add transaction
bankAccountSchema.methods.addTransaction = async function(transactionData) {
  const lastTransaction = this.transactions.length > 0 
    ? this.transactions[this.transactions.length - 1]
    : { balance: this.openingBalance };
  
  const newBalance = lastTransaction.balance + 
    (transactionData.creditAmount || 0) - 
    (transactionData.debitAmount || 0);
  
  const transaction = {
    ...transactionData,
    balance: newBalance
  };
  
  this.transactions.push(transaction);
  this.currentBalance = newBalance;
  
  // Create journal entry if not already created
  if (!transaction.journalEntryId) {
    const JournalEntry = mongoose.model('JournalEntry');
    const ChartOfAccounts = mongoose.model('ChartOfAccounts');
    
    // Determine the other account based on transaction type
    let otherAccountCode;
    switch (transaction.transactionType) {
      case 'Deposit':
        otherAccountCode = '4000'; // Revenue account
        break;
      case 'Withdrawal':
      case 'Fee':
        otherAccountCode = '5000'; // Expense account
        break;
      default:
        otherAccountCode = '1000'; // Default cash account
    }
    
    const otherAccount = await ChartOfAccounts.findOne({ 
      hotelId: this.hotelId, 
      accountCode: otherAccountCode 
    });
    
    if (otherAccount) {
      const journalEntry = new JournalEntry({
        entryDate: transaction.transactionDate,
        entryType: 'Automatic',
        description: transaction.description,
        lines: [
          {
            accountId: transaction.debitAmount > 0 ? this.glAccountId : otherAccount._id,
            description: transaction.description,
            debitAmount: transaction.debitAmount || transaction.creditAmount || 0,
            creditAmount: 0
          },
          {
            accountId: transaction.creditAmount > 0 ? this.glAccountId : otherAccount._id,
            description: transaction.description,
            debitAmount: 0,
            creditAmount: transaction.creditAmount || transaction.debitAmount || 0
          }
        ],
        referenceType: 'BankTransaction',
        referenceId: this.accountNumber,
        referenceNumber: transaction.referenceNumber,
        hotelId: this.hotelId,
        createdBy: this.updatedBy || this.createdBy
      });
      
      await journalEntry.save();
      await journalEntry.post(this.updatedBy || this.createdBy);
      
      transaction.journalEntryId = journalEntry._id;
    }
  }
  
  await this.save();
  return transaction;
};

// Method to reconcile account
bankAccountSchema.methods.reconcile = async function(statementBalance, statementDate, reconciledTransactionIds) {
  // Mark transactions as reconciled
  this.transactions.forEach(transaction => {
    if (reconciledTransactionIds.includes(transaction._id.toString())) {
      transaction.isReconciled = true;
      transaction.reconciledDate = new Date();
    }
  });
  
  // Update reconciliation info
  this.lastReconciledDate = new Date();
  this.lastReconciledBalance = statementBalance;
  this.lastStatementDate = statementDate;
  this.lastStatementBalance = statementBalance;
  
  await this.save();
  
  return {
    reconciledCount: reconciledTransactionIds.length,
    difference: this.reconciliationDifference
  };
};

// Method to import bank statement
bankAccountSchema.methods.importStatement = async function(statements) {
  const importedTransactions = [];
  
  for (const statement of statements) {
    // Check if transaction already exists
    const exists = this.transactions.some(t => 
      t.referenceNumber === statement.referenceNumber &&
      t.transactionDate.getTime() === new Date(statement.date).getTime()
    );
    
    if (!exists) {
      const transaction = await this.addTransaction({
        transactionDate: new Date(statement.date),
        description: statement.description,
        referenceNumber: statement.referenceNumber,
        debitAmount: statement.debit || 0,
        creditAmount: statement.credit || 0,
        transactionType: statement.type || 'Adjustment'
      });
      
      importedTransactions.push(transaction);
    }
  }
  
  return importedTransactions;
};

// Static method to get cash position
bankAccountSchema.statics.getCashPosition = async function(hotelId) {
  const accounts = await this.find({ hotelId, isActive: true });
  
  return accounts.reduce((position, account) => {
    const convertedBalance = account.currentBalance; // TODO: Apply exchange rate
    
    return {
      totalCash: position.totalCash + (account.accountType !== 'Credit Card' ? convertedBalance : 0),
      totalDebt: position.totalDebt + (account.accountType === 'Credit Card' || account.accountType === 'Loan' ? Math.abs(convertedBalance) : 0),
      byAccount: [...position.byAccount, {
        accountName: account.accountName,
        accountType: account.accountType,
        currency: account.currency,
        balance: account.currentBalance
      }],
      byCurrency: {
        ...position.byCurrency,
        [account.currency]: (position.byCurrency[account.currency] || 0) + convertedBalance
      }
    };
  }, {
    totalCash: 0,
    totalDebt: 0,
    byAccount: [],
    byCurrency: {}
  });
};

const BankAccount = mongoose.model('BankAccount', bankAccountSchema);

export default BankAccount;
