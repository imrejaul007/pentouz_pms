import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';

// Import controllers
import * as chartOfAccountsController from '../controllers/chartOfAccountsController.js';
import * as generalLedgerController from '../controllers/generalLedgerController.js';
import * as journalEntryController from '../controllers/journalEntryController.js';
import * as bankAccountController from '../controllers/bankAccountController.js';
import * as budgetController from '../controllers/budgetController.js';
import * as financialReportsController from '../controllers/financialReportsController.js';
import FinancialService from '../services/financialService.js';

const router = express.Router();

// === TEST ENDPOINT (temporary, no auth required) ===
router.get('/test-dashboard', async (req, res) => {
  try {
    const financialService = new FinancialService();
    const dashboard = await financialService.generateFinancialDashboard('month');
    res.json({ success: true, data: dashboard });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// === DASHBOARD (temporarily no auth required for testing) ===
router.get('/dashboard', async (req, res) => {
  try {
    const financialService = new FinancialService();
    const period = req.query.period || 'month';
    
    // For now, get the first hotel's data for testing
    const Hotel = (await import('../models/Hotel.js')).default;
    const mongoose = (await import('mongoose')).default;
    
    const firstHotel = await Hotel.findOne();
    const hotelId = firstHotel ? new mongoose.Types.ObjectId(firstHotel._id) : null;
    
    console.log('🚀 Dashboard API called with:', { period, hotelId: hotelId?.toString() });
    
    const dashboard = await financialService.generateFinancialDashboard(period, hotelId);
    console.log('📊 Dashboard generated:', dashboard.summary);
    
    res.json({ success: true, data: dashboard });
  } catch (error) {
    console.error('❌ Dashboard API error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Temporarily bypass authentication for testing
// router.use(authenticate);
// router.use(authorize('admin', 'staff', 'manager'));-mana

// === CHART OF ACCOUNTS ROUTES ===
router.route('/chart-of-accounts')
  .get(chartOfAccountsController.getAccounts)
  .post(chartOfAccountsController.createAccount);

router.get('/chart-of-accounts/tree', chartOfAccountsController.getAccountTree);
router.get('/chart-of-accounts/flattened', chartOfAccountsController.getFlattenedAccounts);
router.post('/chart-of-accounts/bulk-import', chartOfAccountsController.bulkImportAccounts);

router.route('/chart-of-accounts/:id')
  .get(chartOfAccountsController.getAccount)
  .patch(chartOfAccountsController.updateAccount)
  .delete(chartOfAccountsController.deleteAccount);

router.get('/chart-of-accounts/:id/activity', chartOfAccountsController.getAccountActivity);

// === GENERAL LEDGER ROUTES ===
router.get('/general-ledger', generalLedgerController.getLedgerEntries);
router.get('/general-ledger/trial-balance', generalLedgerController.getTrialBalance);
router.get('/general-ledger/financial-statements', generalLedgerController.getFinancialStatements);
router.get('/general-ledger/aging-report', generalLedgerController.getAgingReport);
router.get('/general-ledger/export', generalLedgerController.exportLedger);
router.get('/general-ledger/account/:accountId', generalLedgerController.getAccountLedger);

// === JOURNAL ENTRY ROUTES ===
router.route('/journal-entries')
  .get(journalEntryController.getJournalEntries)
  .post(journalEntryController.createJournalEntry);

router.get('/journal-entries/templates', journalEntryController.getJournalTemplates);
router.post('/journal-entries/bulk-create', journalEntryController.bulkCreateJournalEntries);

router.route('/journal-entries/:id')
  .get(journalEntryController.getJournalEntry)
  .patch(journalEntryController.updateJournalEntry)
  .delete(journalEntryController.deleteJournalEntry);

router.post('/journal-entries/:id/post', journalEntryController.postJournalEntry);
router.post('/journal-entries/:id/reverse', journalEntryController.reverseJournalEntry);
router.post('/journal-entries/:id/approve', journalEntryController.approveJournalEntry);
router.post('/journal-entries/:id/reject', journalEntryController.rejectJournalEntry);

// === BANK ACCOUNT ROUTES ===
router.route('/bank-accounts')
  .get(bankAccountController.getBankAccounts)
  .post(bankAccountController.createBankAccount);

router.get('/bank-accounts/cash-position', bankAccountController.getCashPosition);
router.get('/bank-accounts/balances', bankAccountController.getAccountBalances);

router.route('/bank-accounts/:id')
  .get(bankAccountController.getBankAccount)
  .patch(bankAccountController.updateBankAccount)
  .delete(bankAccountController.deactivateBankAccount);

router.get('/bank-accounts/:id/transactions', bankAccountController.getTransactions);
router.post('/bank-accounts/:id/transactions', bankAccountController.addTransaction);
router.post('/bank-accounts/:id/reconcile', bankAccountController.reconcileAccount);
router.post('/bank-accounts/:id/import-statement', bankAccountController.importStatement);

// === BUDGET ROUTES ===
router.route('/budgets')
  .get(budgetController.getBudgets)
  .post(budgetController.createBudget);

router.get('/budgets/summary', budgetController.getBudgetSummary);
router.get('/budgets/statistics', budgetController.getBudgetStatistics);
router.get('/budgets/templates', budgetController.getBudgetTemplates);
router.get('/budgets/vs-actual', budgetController.getBudgetVsActual);
router.get('/budgets/forecast', budgetController.generateForecast);

router.route('/budgets/:id')
  .get(budgetController.getBudget)
  .patch(budgetController.updateBudget)
  .delete(budgetController.deleteBudget);

router.post('/budgets/:id/submit-review', budgetController.submitForReview);
router.post('/budgets/:id/approve', budgetController.approveBudget);
router.post('/budgets/:id/revise', budgetController.createRevision);

// === INVOICES ===
router.route('/invoices')
  .get(async (req, res) => {
    try {
      const FinancialInvoice = (await import('../models/FinancialInvoice.js')).default;
      const mongoose = (await import('mongoose')).default;
      // Temporarily bypass hotel filtering for testing
      // const hotelId = req.user?.hotelId ? new mongoose.Types.ObjectId(req.user.hotelId) : null;
      const invoices = await FinancialInvoice.find({})
        .populate('customer.guestId', 'name email')
        .populate('bookingReference', 'bookingNumber')
        .sort({ createdAt: -1 });
      
      res.status(200).json({
        status: 'success',
        data: {
          invoices
        }
      });
    } catch (error) {
      res.status(500).json({
        status: 'error', 
        message: error.message
      });
    }
  })
  .post(async (req, res) => {
    try {
      const FinancialInvoice = (await import('../models/FinancialInvoice.js')).default;
      const invoiceData = {
        ...req.body,
        hotelId: req.user?.hotelId,
        createdBy: req.user?.id,
        invoiceNumber: await FinancialInvoice.generateInvoiceNumber(req.user?.hotelId)
      };
      
      const invoice = new FinancialInvoice(invoiceData);
      await invoice.save();
      
      res.status(201).json({
        status: 'success',
        data: invoice
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message
      });
    }
  });

// Helper function for payment statistics calculation
async function calculatePaymentStatistics(FinancialPayment, query = {}) {
  try {
    const aggregationPipeline = [
      { $match: query },
      {
        $group: {
          _id: null,
          totalPayments: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          completedPayments: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          completedAmount: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0] }
          },
          pendingPayments: {
            $sum: { $cond: [{ $in: ['$status', ['pending', 'processing']] }, 1, 0] }
          },
          pendingAmount: {
            $sum: { $cond: [{ $in: ['$status', ['pending', 'processing']] }, '$amount', 0] }
          },
          failedPayments: {
            $sum: { $cond: [{ $in: ['$status', ['failed', 'cancelled']] }, 1, 0] }
          },
          failedAmount: {
            $sum: { $cond: [{ $in: ['$status', ['failed', 'cancelled']] }, '$amount', 0] }
          }
        }
      }
    ];

    const [stats] = await FinancialPayment.aggregate(aggregationPipeline);

    return stats || {
      totalPayments: 0,
      totalAmount: 0,
      completedPayments: 0,
      completedAmount: 0,
      pendingPayments: 0,
      pendingAmount: 0,
      failedPayments: 0,
      failedAmount: 0
    };
  } catch (error) {
    console.error('Error calculating payment statistics:', error);
    throw error;
  }
}

// === PAYMENTS ===
router.route('/payments')
  .get(async (req, res) => {
    try {
      const FinancialPayment = (await import('../models/FinancialPayment.js')).default;
      const mongoose = (await import('mongoose')).default;

      // Build query filters
      let query = {};
      if (req.query.status) query.status = req.query.status;
      if (req.query.method) query.method = req.query.method;
      if (req.query.type) query.type = req.query.type;

      // Date range filtering
      if (req.query.startDate || req.query.endDate) {
        query.date = {};
        if (req.query.startDate) query.date.$gte = new Date(req.query.startDate);
        if (req.query.endDate) query.date.$lte = new Date(req.query.endDate);
      }

      const payments = await FinancialPayment.find(query)
        .populate('customer.guestId', 'name email')
        .populate('invoice', 'invoiceNumber totalAmount')
        .populate('bankAccount', 'accountName')
        .sort({ createdAt: -1 });

      // Calculate statistics if requested
      let statistics = null;
      if (req.query.includeStats === 'true') {
        statistics = await calculatePaymentStatistics(FinancialPayment, query);
      }

      const response = { status: 'success', data: payments };
      if (statistics) response.statistics = statistics;

      res.status(200).json(response);
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  })
  .post(async (req, res) => {
    try {
      const FinancialPayment = (await import('../models/FinancialPayment.js')).default;
      const paymentData = {
        ...req.body,
        hotelId: req.user?.hotelId,
        createdBy: req.user?.id
      };
      
      const payment = new FinancialPayment(paymentData);
      await payment.save();
      
      // Process the payment
      const result = await payment.process(req.user?.id);
      
      res.status(201).json({
        status: 'success',
        data: payment,
        processing: result
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message
      });
    }
  });

// === PAYMENT STATISTICS ===
router.get('/payments/statistics', async (req, res) => {
  try {
    const FinancialPayment = (await import('../models/FinancialPayment.js')).default;

    // Build query filters (same logic as main payments endpoint)
    let query = {};
    if (req.query.status) query.status = req.query.status;
    if (req.query.method) query.method = req.query.method;
    if (req.query.type) query.type = req.query.type;

    // Date range filtering
    if (req.query.startDate || req.query.endDate) {
      query.date = {};
      if (req.query.startDate) query.date.$gte = new Date(req.query.startDate);
      if (req.query.endDate) query.date.$lte = new Date(req.query.endDate);
    }

    const statistics = await calculatePaymentStatistics(FinancialPayment, query);

    res.status(200).json({
      status: 'success',
      data: statistics
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// === FINANCIAL REPORTS ===
router.get('/reports/trial-balance', async (req, res) => {
  try {
    res.status(200).json({
      status: 'success',
      data: { accounts: [] }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// === FINANCIAL REPORTS ROUTES ===
router.get('/reports/income-statement', financialReportsController.getIncomeStatement);
router.get('/reports/balance-sheet', financialReportsController.getBalanceSheet);
router.get('/reports/cash-flow', financialReportsController.getCashFlowStatement);
router.get('/reports/financial-ratios', financialReportsController.getFinancialRatios);
router.get('/reports/comprehensive', financialReportsController.getComprehensiveFinancialStatement);

export default router;