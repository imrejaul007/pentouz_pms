import FinancialService from '../services/financialService.js';
import ChartOfAccounts from '../models/ChartOfAccounts.js';
import GeneralLedger from '../models/GeneralLedger.js';
import JournalEntry from '../models/JournalEntry.js';
import BankAccount from '../models/BankAccount.js';
import Budget from '../models/Budget.js';
import Invoice from '../models/Invoice.js';

const financialService = new FinancialService();

class FinancialController {
  // Chart of Accounts Management
  async createAccount(req, res) {
    try {
      const account = new ChartOfAccounts(req.body);
      await account.save();
      res.status(201).json({ success: true, data: account });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getAccounts(req, res) {
    try {
      const { type, category, active } = req.query;
      const filter = {};
      if (type) filter.accountType = type;
      if (category) filter.category = category;
      if (active !== undefined) filter.isActive = active === 'true';

      const accounts = await ChartOfAccounts.find(filter)
        .populate('parentAccount', 'accountName accountCode')
        .sort({ accountCode: 1 });
      
      res.json({ success: true, data: accounts });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateAccount(req, res) {
    try {
      const account = await ChartOfAccounts.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );
      if (!account) {
        return res.status(404).json({ success: false, message: 'Account not found' });
      }
      res.json({ success: true, data: account });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async deleteAccount(req, res) {
    try {
      await ChartOfAccounts.findByIdAndUpdate(req.params.id, { isActive: false });
      res.json({ success: true, message: 'Account deactivated successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // General Ledger Management
  async createJournalEntry(req, res) {
    try {
      const entry = new GeneralLedger(req.body);
      entry.postedBy = req.user.id;
      await entry.save();

      // Update account balances
      await financialService.updateAccountBalances(entry.entries);

      res.status(201).json({ success: true, data: entry });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getJournalEntries(req, res) {
    try {
      const { startDate, endDate, account, journal, status } = req.query;
      const filter = {};
      
      if (startDate && endDate) {
        filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
      }
      if (account) filter['entries.account'] = account;
      if (journal) filter.journal = journal;
      if (status) filter.status = status;

      const entries = await GeneralLedger.find(filter)
        .populate('entries.account', 'accountName accountCode')
        .populate('postedBy', 'name email')
        .sort({ date: -1 });

      res.json({ success: true, data: entries });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async reverseJournalEntry(req, res) {
    try {
      const originalEntry = await GeneralLedger.findById(req.params.id);
      if (!originalEntry) {
        return res.status(404).json({ success: false, message: 'Journal entry not found' });
      }

      const reversalEntry = await financialService.createReversalEntry(originalEntry, req.user.id);
      res.json({ success: true, data: reversalEntry });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  // Invoice Management
  async createInvoice(req, res) {
    try {
      // const invoice = new FinancialInvoice(req.body);
      // await invoice.save();

      // // Create journal entry for the invoice
      // await financialService.createInvoiceJournalEntry(invoice);

      // res.status(201).json({ success: true, data: invoice });
      res.status(501).json({ success: false, message: 'FinancialInvoice model not available yet' });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getInvoices(req, res) {
    try {
      // const { status, type, customer, startDate, endDate } = req.query;
      // const filter = {};
      
      // if (status) filter.status = status;
      // if (type) filter.type = type;
      // if (customer) filter['customer.name'] = new RegExp(customer, 'i');
      // if (startDate && endDate) {
      //   filter.issueDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
      // }

      // const invoices = await FinancialInvoice.find(filter)
      //   .populate('bookingReference', 'bookingNumber guestName')
      //   .sort({ issueDate: -1 });

      // res.json({ success: true, data: invoices });
      res.json({ success: true, data: [] });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateInvoice(req, res) {
    try {
      // const invoice = await FinancialInvoice.findByIdAndUpdate(
      //   req.params.id,
      //   req.body,
      //   { new: true, runValidators: true }
      // );
      // if (!invoice) {
      //   return res.status(404).json({ success: false, message: 'Invoice not found' });
      // }
      // res.json({ success: true, data: invoice });
      res.status(501).json({ success: false, message: 'FinancialInvoice model not available yet' });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  // Payment Management
  async createPayment(req, res) {
    try {
      // const payment = new FinancialPayment(req.body);
      // await payment.save();

      // // Create journal entry and update invoice
      // if (payment.invoice) {
      //   await financialService.processInvoicePayment(payment);
      // }

      // res.status(201).json({ success: true, data: payment });
      res.status(501).json({ success: false, message: 'FinancialPayment model not available yet' });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getPayments(req, res) {
    try {
      // const { method, status, startDate, endDate } = req.query;
      // const filter = {};
      
      // if (method) filter.method = method;
      // if (status) filter.status = status;
      // if (startDate && endDate) {
      //   filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
      // }

      // const payments = await FinancialPayment.find(filter)
      //   .populate('invoice', 'invoice', 'invoiceNumber totalAmount')
      //   .populate('bankAccount', 'accountName bankName')
      //   .sort({ date: -1 });

      // res.json({ success: true, data: payments });
      res.json({ success: true, data: [] });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Bank Account Management
  async createBankAccount(req, res) {
    try {
      const bankAccount = new BankAccount(req.body);
      await bankAccount.save();
      res.status(201).json({ success: true, data: bankAccount });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getBankAccounts(req, res) {
    try {
      const { isActive, isPrimary } = req.query;
      const filter = {};
      if (isActive !== undefined) filter.isActive = isActive === 'true';
      if (isPrimary !== undefined) filter.isPrimary = isPrimary === 'true';

      const accounts = await BankAccount.find(filter).sort({ isPrimary: -1, accountName: 1 });
      res.json({ success: true, data: accounts });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateBankAccount(req, res) {
    try {
      const account = await BankAccount.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );
      if (!account) {
        return res.status(404).json({ success: false, message: 'Bank account not found' });
      }
      res.json({ success: true, data: account });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  // Tax Configuration
  async createTaxConfig(req, res) {
    try {
      const taxConfig = new TaxConfiguration(req.body);
      await taxConfig.save();
      res.status(201).json({ success: true, data: taxConfig });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getTaxConfigs(req, res) {
    try {
      const { taxType, isActive } = req.query;
      const filter = {};
      if (taxType) filter.taxType = taxType;
      if (isActive !== undefined) filter.isActive = isActive === 'true';

      const configs = await TaxConfiguration.find(filter)
        .populate('reportingAccount payableAccount', 'accountName accountCode')
        .sort({ taxCode: 1 });

      res.json({ success: true, data: configs });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Budget Management
  async createBudget(req, res) {
    try {
      const budget = new Budget(req.body);
      await budget.save();
      res.status(201).json({ success: true, data: budget });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getBudgets(req, res) {
    try {
      const { fiscalYear, status, department } = req.query;
      const filter = {};
      if (fiscalYear) filter.fiscalYear = fiscalYear;
      if (status) filter.status = status;
      if (department) filter.department = department;

      const budgets = await Budget.find(filter)
        .populate('budgetItems.account', 'accountName accountCode')
        .populate('approvedBy', 'name email')
        .sort({ fiscalYear: -1, name: 1 });

      res.json({ success: true, data: budgets });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateBudgetActuals(req, res) {
    try {
      const { budgetId } = req.params;
      await financialService.updateBudgetActuals(budgetId);
      res.json({ success: true, message: 'Budget actuals updated successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Financial Reports
  async generateReport(req, res) {
    try {
      const { reportType, startDate, endDate, accounts, currency = 'INR' } = req.body;
      let reportData;

      switch (reportType) {
        case 'profit_loss':
          reportData = await financialService.generateProfitLossReport(startDate, endDate, currency);
          break;
        case 'balance_sheet':
          reportData = await financialService.generateBalanceSheet(endDate, currency);
          break;
        case 'cash_flow':
          reportData = await financialService.generateCashFlowStatement(startDate, endDate, currency);
          break;
        case 'trial_balance':
          reportData = await financialService.generateTrialBalance(endDate);
          break;
        case 'aged_receivables':
          reportData = await financialService.generateAgedReceivablesReport(endDate);
          break;
        case 'budget_variance':
          reportData = await financialService.generateBudgetVarianceReport(startDate, endDate);
          break;
        default:
          return res.status(400).json({ success: false, message: 'Invalid report type' });
      }

      // Save report (temporarily commented out - FinancialReport model not available)
      // const report = new FinancialReport({
      //   reportType,
      //   name: `${reportType.replace('_', ' ').toUpperCase()} - ${new Date().toLocaleDateString()}`,
      //   period: { startDate, endDate },
      //   parameters: { accounts, currency },
      //   data: reportData,
      //   generatedBy: req.user.id
      // });
      // await report.save();

      res.json({ success: true, data: reportData, reportId: report._id });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getReports(req, res) {
    try {
      const { reportType, startDate, endDate } = req.query;
      const filter = {};
      if (reportType) filter.reportType = reportType;
      if (startDate && endDate) {
        filter.generatedDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
      }

      // const reports = await FinancialReport.find(filter)
      //   .populate('generatedBy', 'name email')
      //   .sort({ generatedDate: -1 });
      
      // Temporarily return empty array since FinancialReport model is not available
      const reports = [];

      res.json({ success: true, data: reports });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Cost Center Management
  async createCostCenter(req, res) {
    try {
      const costCenter = new CostCenter(req.body);
      await costCenter.save();
      res.status(201).json({ success: true, data: costCenter });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getCostCenters(req, res) {
    try {
      const { type, isActive } = req.query;
      const filter = {};
      if (type) filter.type = type;
      if (isActive !== undefined) filter.isActive = isActive === 'true';

      const costCenters = await CostCenter.find(filter)
        .populate('parentCostCenter', 'name code')
        .populate('manager', 'name email')
        .populate('accounts', 'accountName accountCode')
        .sort({ code: 1 });

      res.json({ success: true, data: costCenters });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Dashboard Analytics
  async getFinancialDashboard(req, res) {
    try {
      const { period = 'month' } = req.query;
      const dashboard = await financialService.generateFinancialDashboard(period);
      res.json({ success: true, data: dashboard });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Reconciliation
  async bankReconciliation(req, res) {
    try {
      const { bankAccountId, statementDate, transactions } = req.body;
      const result = await financialService.performBankReconciliation(bankAccountId, statementDate, transactions);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

export default new FinancialController();
