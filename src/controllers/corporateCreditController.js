import CorporateCredit from '../models/CorporateCredit.js';
import CorporateCompany from '../models/CorporateCompany.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import APIFeatures from '../utils/apiFeatures.js';

/**
 * @swagger
 * tags:
 *   name: Corporate Credit
 *   description: Corporate credit transaction management
 */

/**
 * @swagger
 * /api/v1/corporate/credit/transactions:
 *   post:
 *     summary: Create a new credit transaction
 *     tags: [Corporate Credit]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CorporateCredit'
 *     responses:
 *       201:
 *         description: Credit transaction created successfully
 *       400:
 *         description: Invalid input data
 */
export const createCreditTransaction = catchAsync(async (req, res, next) => {
  // Verify corporate company exists
  const company = await CorporateCompany.findOne({
    _id: req.body.corporateCompanyId,
    hotelId: req.user.hotelId,
    isActive: true
  });
  
  if (!company) {
    return next(new ApplicationError('Corporate company not found or inactive', 404));
  }
  
  const transactionData = {
    ...req.body,
    hotelId: req.user.hotelId,
    'metadata.createdBy': req.user.id
  };
  
  const transaction = await CorporateCredit.create(transactionData);
  
  // Update company's available credit if transaction is processed
  if (transaction.status === 'processed') {
    const amount = transaction.transactionType === 'debit' ? 
      -Math.abs(transaction.amount) : Math.abs(transaction.amount);
    await company.updateAvailableCredit(amount);
  }
  
  res.status(201).json({
    status: 'success',
    data: {
      transaction
    }
  });
});

/**
 * @swagger
 * /api/v1/corporate/credit/transactions:
 *   get:
 *     summary: Get all credit transactions
 *     tags: [Corporate Credit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: corporateCompanyId
 *         schema:
 *           type: string
 *         description: Filter by corporate company
 *       - in: query
 *         name: transactionType
 *         schema:
 *           type: string
 *           enum: [debit, credit, adjustment, refund, payment]
 *         description: Filter by transaction type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected, processed, cancelled]
 *         description: Filter by transaction status
 *     responses:
 *       200:
 *         description: List of credit transactions
 */
export const getAllCreditTransactions = catchAsync(async (req, res, next) => {
  const filter = { hotelId: req.user.hotelId };
  
  const features = new APIFeatures(CorporateCredit.find(filter), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();
    
  const transactions = await features.query
    .populate('corporateCompanyId', 'name email')
    .populate('bookingId', 'bookingNumber status')
    .populate('invoiceId', 'invoiceNumber status')
    .populate('metadata.createdBy', 'name email');
  
  res.status(200).json({
    status: 'success',
    results: transactions.length,
    data: {
      transactions
    }
  });
});

/**
 * @swagger
 * /api/v1/corporate/credit/transactions/{id}:
 *   get:
 *     summary: Get a credit transaction by ID
 *     tags: [Corporate Credit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Credit transaction ID
 *     responses:
 *       200:
 *         description: Credit transaction details
 *       404:
 *         description: Transaction not found
 */
export const getCreditTransaction = catchAsync(async (req, res, next) => {
  const transaction = await CorporateCredit.findOne({
    _id: req.params.id,
    hotelId: req.user.hotelId
  })
  .populate('corporateCompanyId')
  .populate('bookingId')
  .populate('invoiceId')
  .populate('groupBookingId')
  .populate('metadata.createdBy', 'name email')
  .populate('approvalDetails.approvedBy', 'name email');
  
  if (!transaction) {
    return next(new ApplicationError('Credit transaction not found', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      transaction
    }
  });
});

/**
 * @swagger
 * /api/v1/corporate/credit/transactions/{id}/approve:
 *   patch:
 *     summary: Approve a credit transaction
 *     tags: [Corporate Credit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Credit transaction ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 description: Approval notes
 *     responses:
 *       200:
 *         description: Transaction approved successfully
 *       404:
 *         description: Transaction not found
 */
export const approveCreditTransaction = catchAsync(async (req, res, next) => {
  const transaction = await CorporateCredit.findOne({
    _id: req.params.id,
    hotelId: req.user.hotelId
  });
  
  if (!transaction) {
    return next(new ApplicationError('Credit transaction not found', 404));
  }
  
  if (transaction.status !== 'pending') {
    return next(new ApplicationError('Only pending transactions can be approved', 400));
  }
  
  await transaction.approve(req.user.id, req.body.notes);
  
  // Update company's available credit
  const company = await CorporateCompany.findById(transaction.corporateCompanyId);
  if (company) {
    const amount = transaction.transactionType === 'debit' ? 
      -Math.abs(transaction.amount) : Math.abs(transaction.amount);
    await company.updateAvailableCredit(amount);
    transaction.balance = company.availableCredit;
    await transaction.save();
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      transaction,
      message: 'Transaction approved successfully'
    }
  });
});

/**
 * @swagger
 * /api/v1/corporate/credit/transactions/{id}/reject:
 *   patch:
 *     summary: Reject a credit transaction
 *     tags: [Corporate Credit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Credit transaction ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Rejection reason
 *                 required: true
 *     responses:
 *       200:
 *         description: Transaction rejected successfully
 *       404:
 *         description: Transaction not found
 */
export const rejectCreditTransaction = catchAsync(async (req, res, next) => {
  const { reason } = req.body;
  
  if (!reason) {
    return next(new ApplicationError('Rejection reason is required', 400));
  }
  
  const transaction = await CorporateCredit.findOne({
    _id: req.params.id,
    hotelId: req.user.hotelId
  });
  
  if (!transaction) {
    return next(new ApplicationError('Credit transaction not found', 404));
  }
  
  if (transaction.status !== 'pending') {
    return next(new ApplicationError('Only pending transactions can be rejected', 400));
  }
  
  await transaction.reject(req.user.id, reason);
  
  res.status(200).json({
    status: 'success',
    data: {
      transaction,
      message: 'Transaction rejected successfully'
    }
  });
});

/**
 * @swagger
 * /api/v1/corporate/credit/overdue:
 *   get:
 *     summary: Get overdue credit transactions
 *     tags: [Corporate Credit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: daysOverdue
 *         schema:
 *           type: number
 *         description: Minimum days overdue (default: 0)
 *     responses:
 *       200:
 *         description: List of overdue transactions
 */
export const getOverdueTransactions = catchAsync(async (req, res, next) => {
  const daysOverdue = parseInt(req.query.daysOverdue) || 0;
  
  const overdueTransactions = await CorporateCredit.getOverdueTransactions(
    req.user.hotelId,
    daysOverdue
  );
  
  res.status(200).json({
    status: 'success',
    results: overdueTransactions.length,
    data: {
      transactions: overdueTransactions,
      daysOverdue
    }
  });
});

/**
 * @swagger
 * /api/v1/corporate/credit/monthly-report:
 *   get:
 *     summary: Get monthly credit report
 *     tags: [Corporate Credit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: number
 *         description: Year (default: current year)
 *       - in: query
 *         name: month
 *         schema:
 *           type: number
 *         description: Month (default: current month)
 *     responses:
 *       200:
 *         description: Monthly credit report
 */
export const getMonthlyCreditReport = catchAsync(async (req, res, next) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const month = parseInt(req.query.month) || new Date().getMonth() + 1;
  
  const report = await CorporateCredit.getMonthlyReport(req.user.hotelId, year, month);
  
  const summary = {
    totalDebits: report.reduce((sum, item) => sum + item.totalDebits, 0),
    totalCredits: report.reduce((sum, item) => sum + item.totalCredits, 0),
    totalCompanies: report.length,
    totalTransactions: report.reduce((sum, item) => sum + item.transactionCount, 0)
  };
  
  res.status(200).json({
    status: 'success',
    data: {
      period: { year, month },
      summary,
      companyBreakdown: report
    }
  });
});

/**
 * @swagger
 * /api/v1/corporate/credit/summary/{companyId}:
 *   get:
 *     summary: Get credit summary for a specific company
 *     tags: [Corporate Credit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema:
 *           type: string
 *         description: Corporate company ID
 *     responses:
 *       200:
 *         description: Company credit summary
 *       404:
 *         description: Company not found
 */
export const getCompanyCreditSummary = catchAsync(async (req, res, next) => {
  const company = await CorporateCompany.findOne({
    _id: req.params.companyId,
    hotelId: req.user.hotelId
  });
  
  if (!company) {
    return next(new ApplicationError('Corporate company not found', 404));
  }
  
  const creditSummary = await CorporateCredit.getCreditSummary(
    req.params.companyId,
    req.user.hotelId
  );
  
  // Get recent transactions
  const recentTransactions = await CorporateCredit.find({
    corporateCompanyId: req.params.companyId,
    hotelId: req.user.hotelId
  })
  .sort({ createdAt: -1 })
  .limit(10)
  .populate('bookingId', 'bookingNumber')
  .populate('invoiceId', 'invoiceNumber');
  
  // Calculate credit utilization percentage
  const creditUtilization = company.creditLimit > 0 ? 
    ((company.creditLimit - company.availableCredit) / company.creditLimit) * 100 : 0;
  
  res.status(200).json({
    status: 'success',
    data: {
      company: {
        id: company._id,
        name: company.name,
        creditLimit: company.creditLimit,
        availableCredit: company.availableCredit,
        creditUtilization: Math.round(creditUtilization * 100) / 100,
        paymentTerms: company.paymentTerms
      },
      creditSummary,
      recentTransactions
    }
  });
});

/**
 * @swagger
 * /api/v1/corporate/credit/bulk-approve:
 *   patch:
 *     summary: Bulk approve credit transactions
 *     tags: [Corporate Credit]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               transactionIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of transaction IDs to approve
 *               notes:
 *                 type: string
 *                 description: Approval notes
 *     responses:
 *       200:
 *         description: Transactions approved successfully
 *       400:
 *         description: Invalid input data
 */
export const bulkApproveCreditTransactions = catchAsync(async (req, res, next) => {
  const { transactionIds, notes } = req.body;
  
  if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
    return next(new ApplicationError('Transaction IDs array is required', 400));
  }
  
  const results = {
    approved: [],
    failed: []
  };
  
  for (const transactionId of transactionIds) {
    try {
      const transaction = await CorporateCredit.findOne({
        _id: transactionId,
        hotelId: req.user.hotelId,
        status: 'pending'
      });
      
      if (transaction) {
        await transaction.approve(req.user.id, notes);
        
        // Update company's available credit
        const company = await CorporateCompany.findById(transaction.corporateCompanyId);
        if (company) {
          const amount = transaction.transactionType === 'debit' ? 
            -Math.abs(transaction.amount) : Math.abs(transaction.amount);
          await company.updateAvailableCredit(amount);
        }
        
        results.approved.push(transactionId);
      } else {
        results.failed.push({
          transactionId,
          reason: 'Transaction not found or not pending'
        });
      }
    } catch (error) {
      results.failed.push({
        transactionId,
        reason: error.message
      });
    }
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      results,
      message: `${results.approved.length} transactions approved, ${results.failed.length} failed`
    }
  });
});
