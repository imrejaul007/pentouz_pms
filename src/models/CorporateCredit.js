import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     CorporateCredit:
 *       type: object
 *       required:
 *         - hotelId
 *         - corporateCompanyId
 *         - transactionType
 *         - amount
 *       properties:
 *         _id:
 *           type: string
 *         hotelId:
 *           type: string
 *           description: Hotel ID
 *         corporateCompanyId:
 *           type: string
 *           description: Corporate company ID
 *         bookingId:
 *           type: string
 *           description: Associated booking ID (if applicable)
 *         invoiceId:
 *           type: string
 *           description: Associated invoice ID (if applicable)
 *         transactionType:
 *           type: string
 *           enum: [debit, credit, adjustment, refund]
 *           description: Type of credit transaction
 *         amount:
 *           type: number
 *           description: Transaction amount (positive for credit, negative for debit)
 *         balance:
 *           type: number
 *           description: Available credit balance after this transaction
 *         description:
 *           type: string
 *           description: Transaction description
 *         reference:
 *           type: string
 *           description: Reference number or ID
 *         status:
 *           type: string
 *           enum: [pending, approved, rejected, processed]
 *           default: pending
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const corporateCreditSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required']
  },
  corporateCompanyId: {
    type: mongoose.Schema.ObjectId,
    ref: 'CorporateCompany',
    required: [true, 'Corporate company ID is required']
  },
  bookingId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Booking'
  },
  invoiceId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Invoice'
  },
  groupBookingId: {
    type: mongoose.Schema.ObjectId,
    ref: 'GroupBooking'
  },
  transactionType: {
    type: String,
    enum: ['debit', 'credit', 'adjustment', 'refund', 'payment'],
    required: [true, 'Transaction type is required']
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required']
  },
  balance: {
    type: Number,
    min: [0, 'Balance cannot be negative']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  reference: {
    type: String,
    trim: true
  },
  transactionDate: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'processed', 'cancelled'],
    default: 'pending'
  },
  category: {
    type: String,
    enum: ['accommodation', 'services', 'extras', 'taxes', 'fees', 'adjustment'],
    default: 'accommodation'
  },
  paymentDetails: {
    paymentMethod: {
      type: String,
      enum: ['bank_transfer', 'cheque', 'cash', 'online', 'adjustment']
    },
    paymentReference: String,
    bankDetails: {
      bankName: String,
      accountNumber: String,
      transactionId: String
    }
  },
  approvalDetails: {
    approvedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    approvalNotes: String
  },
  metadata: {
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    lastModifiedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    source: {
      type: String,
      enum: ['booking', 'manual', 'system', 'import'],
      default: 'booking'
    },
    tags: [String],
    notes: String
  }
}, {
  timestamps: true
});

// Indexes
corporateCreditSchema.index({ hotelId: 1, corporateCompanyId: 1, transactionDate: -1 });
corporateCreditSchema.index({ status: 1, transactionDate: -1 });
corporateCreditSchema.index({ bookingId: 1 });
corporateCreditSchema.index({ invoiceId: 1 });
corporateCreditSchema.index({ transactionType: 1, status: 1 });

// Virtual to get formatted amount based on transaction type
corporateCreditSchema.virtual('formattedAmount').get(function() {
  const sign = this.transactionType === 'debit' ? '-' : '+';
  return `${sign}₹${Math.abs(this.amount).toLocaleString('en-IN')}`;
});

// Virtual to get transaction age in days
corporateCreditSchema.virtual('ageInDays').get(function() {
  return Math.floor((new Date() - this.transactionDate) / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to set due date
corporateCreditSchema.pre('save', async function(next) {
  if (this.isNew && this.transactionType === 'debit' && !this.dueDate) {
    try {
      const company = await mongoose.model('CorporateCompany').findById(this.corporateCompanyId);
      if (company) {
        const dueDate = new Date(this.transactionDate);
        dueDate.setDate(dueDate.getDate() + company.paymentTerms);
        this.dueDate = dueDate;
      }
    } catch (error) {
      console.error('Error setting due date:', error);
    }
  }
  next();
});

// Static method to get credit summary for a company
corporateCreditSchema.statics.getCreditSummary = async function(corporateCompanyId, hotelId) {
  const summary = await this.aggregate([
    {
      $match: {
        corporateCompanyId: new mongoose.Types.ObjectId(corporateCompanyId),
        hotelId: new mongoose.Types.ObjectId(hotelId),
        status: 'processed'
      }
    },
    {
      $group: {
        _id: '$transactionType',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);
  
  const result = {
    totalDebits: 0,
    totalCredits: 0,
    netBalance: 0,
    transactionCount: 0
  };
  
  summary.forEach(item => {
    if (item._id === 'debit') {
      result.totalDebits = Math.abs(item.totalAmount);
    } else if (item._id === 'credit') {
      result.totalCredits = item.totalAmount;
    }
    result.transactionCount += item.count;
  });
  
  result.netBalance = result.totalCredits - result.totalDebits;
  
  return result;
};

// Static method to get overdue transactions
corporateCreditSchema.statics.getOverdueTransactions = function(hotelId, daysOverdue = 0) {
  const overdueDate = new Date();
  overdueDate.setDate(overdueDate.getDate() - daysOverdue);
  
  return this.find({
    hotelId,
    transactionType: 'debit',
    status: 'processed',
    dueDate: { $lt: overdueDate }
  }).populate('corporateCompanyId', 'name email phone');
};

// Static method to get monthly credit report
corporateCreditSchema.statics.getMonthlyReport = async function(hotelId, year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  
  return this.aggregate([
    {
      $match: {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        transactionDate: { $gte: startDate, $lte: endDate },
        status: 'processed'
      }
    },
    {
      $lookup: {
        from: 'corporatecompanies',
        localField: 'corporateCompanyId',
        foreignField: '_id',
        as: 'company'
      }
    },
    {
      $unwind: '$company'
    },
    {
      $group: {
        _id: {
          companyId: '$corporateCompanyId',
          companyName: '$company.name'
        },
        totalDebits: {
          $sum: {
            $cond: [{ $eq: ['$transactionType', 'debit'] }, '$amount', 0]
          }
        },
        totalCredits: {
          $sum: {
            $cond: [{ $eq: ['$transactionType', 'credit'] }, '$amount', 0]
          }
        },
        transactionCount: { $sum: 1 }
      }
    },
    {
      $project: {
        companyId: '$_id.companyId',
        companyName: '$_id.companyName',
        totalDebits: 1,
        totalCredits: 1,
        netAmount: { $subtract: ['$totalCredits', '$totalDebits'] },
        transactionCount: 1
      }
    },
    {
      $sort: { totalDebits: -1 }
    }
  ]);
};

// Instance method to approve transaction
corporateCreditSchema.methods.approve = function(approvedBy, notes) {
  this.status = 'approved';
  this.approvalDetails = {
    approvedBy,
    approvedAt: new Date(),
    approvalNotes: notes
  };
  return this.save();
};

// Instance method to reject transaction
corporateCreditSchema.methods.reject = function(rejectedBy, reason) {
  this.status = 'rejected';
  this.approvalDetails = {
    approvedBy: rejectedBy,
    approvedAt: new Date(),
    approvalNotes: `Rejected: ${reason}`
  };
  return this.save();
};

export default mongoose.model('CorporateCredit', corporateCreditSchema);
