import mongoose from 'mongoose';

const journalEntryLineSchema = new mongoose.Schema({
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChartOfAccounts',
    required: true
  },
  description: {
    type: String,
    required: true
  },
  debitAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  creditAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  exchangeRate: {
    type: Number,
    default: 1
  },
  taxCode: {
    type: String
  },
  department: {
    type: String
  },
  project: {
    type: String
  },
  costCenter: {
    type: String
  }
});

const journalEntrySchema = new mongoose.Schema({
  entryNumber: {
    type: String,
    required: true,
    unique: true
  },
  entryDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  entryType: {
    type: String,
    enum: ['Manual', 'Automatic', 'Adjusting', 'Closing', 'Reversing', 'Opening'],
    default: 'Manual'
  },
  description: {
    type: String,
    required: true
  },
  lines: {
    type: [journalEntryLineSchema],
    required: true,
    validate: {
      validator: function(lines) {
        // Ensure at least 2 lines for double-entry
        if (lines.length < 2) return false;
        
        // Ensure debits equal credits
        const totalDebits = lines.reduce((sum, line) => sum + line.debitAmount, 0);
        const totalCredits = lines.reduce((sum, line) => sum + line.creditAmount, 0);
        
        return Math.abs(totalDebits - totalCredits) < 0.01; // Allow for small rounding differences
      },
      message: 'Journal entry must be balanced (debits must equal credits) and have at least 2 lines'
    }
  },
  totalDebit: {
    type: Number,
    required: true,
    min: 0
  },
  totalCredit: {
    type: Number,
    required: true,
    min: 0
  },
  referenceType: {
    type: String,
    enum: ['Invoice', 'Payment', 'Expense', 'BankTransaction', 'POS', 'Payroll', 'Manual', 'SystemGenerated'],
    required: true
  },
  referenceId: {
    type: String
  },
  referenceNumber: {
    type: String
  },
  status: {
    type: String,
    enum: ['Draft', 'Posted', 'Approved', 'Rejected', 'Void', 'Reversed'],
    default: 'Draft'
  },
  postedDate: {
    type: Date
  },
  fiscalYear: {
    type: Number,
    required: true
  },
  fiscalPeriod: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringFrequency: {
    type: String,
    enum: ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'],
    default: null
  },
  nextRecurringDate: {
    type: Date
  },
  reversalEntry: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JournalEntry'
  },
  originalEntry: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JournalEntry'
  },
  attachments: [{
    fileName: String,
    fileUrl: String,
    uploadedAt: Date
  }],
  notes: {
    type: String
  },
  tags: [{
    type: String
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
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectedAt: {
    type: Date
  },
  rejectionReason: {
    type: String
  },
  voidedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  voidedAt: {
    type: Date
  },
  voidReason: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for performance
journalEntrySchema.index({ hotelId: 1, entryDate: -1 });
journalEntrySchema.index({ hotelId: 1, entryNumber: 1 });
journalEntrySchema.index({ hotelId: 1, status: 1 });
journalEntrySchema.index({ hotelId: 1, fiscalYear: 1, fiscalPeriod: 1 });
journalEntrySchema.index({ referenceType: 1, referenceId: 1 });

// Pre-save middleware
journalEntrySchema.pre('save', function(next) {
  // Calculate totals
  this.totalDebit = this.lines.reduce((sum, line) => sum + line.debitAmount, 0);
  this.totalCredit = this.lines.reduce((sum, line) => sum + line.creditAmount, 0);
  
  // Set fiscal year and period
  const date = new Date(this.entryDate);
  this.fiscalYear = date.getFullYear();
  this.fiscalPeriod = date.getMonth() + 1;
  
  // Generate entry number if not provided
  if (!this.entryNumber && this.isNew) {
    const prefix = 'JE';
    const year = this.fiscalYear;
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.entryNumber = `${prefix}-${year}-${random}`;
  }
  
  next();
});

// Method to post journal entry
journalEntrySchema.methods.post = async function(userId) {
  if (this.status !== 'Draft' && this.status !== 'Approved') {
    throw new Error('Only draft or approved entries can be posted');
  }
  
  // Validate that debits equal credits
  if (Math.abs(this.totalDebit - this.totalCredit) >= 0.01) {
    throw new Error('Journal entry is not balanced');
  }
  
  // Create general ledger entries
  const GeneralLedger = mongoose.model('GeneralLedger');
  const ledgerEntries = [];
  
  for (const line of this.lines) {
    const ledgerEntry = new GeneralLedger({
      transactionId: `${this.entryNumber}-${line._id}`,
      journalEntryId: this._id,
      accountId: line.accountId,
      transactionDate: this.entryDate,
      description: line.description,
      debitAmount: line.debitAmount,
      creditAmount: line.creditAmount,
      currency: line.currency || 'INR',
      exchangeRate: line.exchangeRate || 1,
      baseCurrencyAmount: 0, // Will be calculated in pre-save
      referenceType: this.referenceType,
      referenceId: this.referenceId || this.entryNumber,
      fiscalYear: this.fiscalYear,
      fiscalPeriod: this.fiscalPeriod,
      status: 'Posted',
      hotelId: this.hotelId,
      createdBy: userId || this.createdBy
    });
    
    await ledgerEntry.calculateRunningBalance();
    ledgerEntries.push(ledgerEntry);
  }
  
  // Save all ledger entries
  await GeneralLedger.insertMany(ledgerEntries);
  
  // Update journal entry status
  this.status = 'Posted';
  this.postedDate = new Date();
  await this.save();
  
  // Update account balances
  const ChartOfAccounts = mongoose.model('ChartOfAccounts');
  for (const line of this.lines) {
    const balance = await GeneralLedger.getAccountBalance(line.accountId);
    await ChartOfAccounts.findByIdAndUpdate(line.accountId, { currentBalance: balance });
  }
  
  return this;
};

// Method to reverse journal entry
journalEntrySchema.methods.reverse = async function(userId, reason) {
  if (this.status !== 'Posted') {
    throw new Error('Only posted entries can be reversed');
  }
  
  // Create reversal entry
  const reversalEntry = new this.constructor({
    entryNumber: `${this.entryNumber}-REV`,
    entryDate: new Date(),
    entryType: 'Reversing',
    description: `Reversal of ${this.entryNumber}: ${reason}`,
    lines: this.lines.map(line => ({
      accountId: line.accountId,
      description: `Reversal: ${line.description}`,
      debitAmount: line.creditAmount, // Swap debits and credits
      creditAmount: line.debitAmount,
      currency: line.currency,
      exchangeRate: line.exchangeRate
    })),
    referenceType: this.referenceType,
    referenceId: this.referenceId,
    referenceNumber: `REV-${this.entryNumber}`,
    originalEntry: this._id,
    hotelId: this.hotelId,
    createdBy: userId
  });
  
  await reversalEntry.save();
  await reversalEntry.post(userId);
  
  // Update original entry
  this.reversalEntry = reversalEntry._id;
  this.status = 'Reversed';
  await this.save();
  
  return reversalEntry;
};

// Static method to generate next entry number
journalEntrySchema.statics.generateEntryNumber = async function(hotelId) {
  const lastEntry = await this.findOne({ hotelId })
    .sort({ createdAt: -1 })
    .select('entryNumber');
  
  const prefix = 'JE';
  const year = new Date().getFullYear();
  
  if (!lastEntry) {
    return `${prefix}-${year}-0001`;
  }
  
  const lastNumber = parseInt(lastEntry.entryNumber.split('-').pop()) || 0;
  const nextNumber = (lastNumber + 1).toString().padStart(4, '0');
  
  return `${prefix}-${year}-${nextNumber}`;
};

const JournalEntry = mongoose.model('JournalEntry', journalEntrySchema);

export default JournalEntry;
