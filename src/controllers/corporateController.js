import CorporateCompany from '../models/CorporateCompany.js';
import CorporateCredit from '../models/CorporateCredit.js';
import GroupBooking from '../models/GroupBooking.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import APIFeatures from '../utils/apiFeatures.js';
import creditMonitoringService from '../services/creditMonitoringService.js';

/**
 * @swagger
 * tags:
 *   name: Corporate
 *   description: Corporate booking and company management
 */

/**
 * @swagger
 * /api/v1/corporate/companies:
 *   post:
 *     summary: Create a new corporate company
 *     tags: [Corporate]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CorporateCompany'
 *     responses:
 *       201:
 *         description: Corporate company created successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 */
export const createCorporateCompany = catchAsync(async (req, res, next) => {
  // Add hotel ID and created by from authenticated user
  const companyData = {
    ...req.body,
    hotelId: req.user.hotelId,
    'metadata.createdBy': req.user.id
  };

  const company = await CorporateCompany.create(companyData);
  
  res.status(201).json({
    status: 'success',
    data: {
      company
    }
  });
});

/**
 * @swagger
 * /api/v1/corporate/companies:
 *   get:
 *     summary: Get all corporate companies
 *     tags: [Corporate]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of results per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Sort by field
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of corporate companies
 */
export const getAllCorporateCompanies = catchAsync(async (req, res, next) => {
  // Filter by hotel ID
  const filter = { hotelId: req.user.hotelId };
  
  const features = new APIFeatures(CorporateCompany.find(filter), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();
    
  const companies = await features.query;
  
  res.status(200).json({
    status: 'success',
    results: companies.length,
    data: {
      companies
    }
  });
});

/**
 * @swagger
 * /api/v1/corporate/companies/{id}:
 *   get:
 *     summary: Get a corporate company by ID
 *     tags: [Corporate]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Corporate company ID
 *     responses:
 *       200:
 *         description: Corporate company details
 *       404:
 *         description: Company not found
 */
export const getCorporateCompany = catchAsync(async (req, res, next) => {
  const company = await CorporateCompany.findOne({
    _id: req.params.id,
    hotelId: req.user.hotelId
  });
  
  if (!company) {
    return next(new ApplicationError('Corporate company not found', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      company
    }
  });
});

/**
 * @swagger
 * /api/v1/corporate/companies/{id}:
 *   patch:
 *     summary: Update a corporate company
 *     tags: [Corporate]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Corporate company ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CorporateCompany'
 *     responses:
 *       200:
 *         description: Company updated successfully
 *       404:
 *         description: Company not found
 */
export const updateCorporateCompany = catchAsync(async (req, res, next) => {
  // Add last modified by
  const updateData = {
    ...req.body,
    'metadata.lastModifiedBy': req.user.id
  };
  
  const company = await CorporateCompany.findOneAndUpdate(
    { _id: req.params.id, hotelId: req.user.hotelId },
    updateData,
    {
      new: true,
      runValidators: true
    }
  );
  
  if (!company) {
    return next(new ApplicationError('Corporate company not found', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      company
    }
  });
});

/**
 * @swagger
 * /api/v1/corporate/companies/{id}:
 *   delete:
 *     summary: Delete a corporate company (soft delete)
 *     tags: [Corporate]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Corporate company ID
 *     responses:
 *       204:
 *         description: Company deleted successfully
 *       404:
 *         description: Company not found
 */
export const deleteCorporateCompany = catchAsync(async (req, res, next) => {
  const company = await CorporateCompany.findOneAndUpdate(
    { _id: req.params.id, hotelId: req.user.hotelId },
    { isActive: false, 'metadata.lastModifiedBy': req.user.id },
    { new: true }
  );
  
  if (!company) {
    return next(new ApplicationError('Corporate company not found', 404));
  }
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

/**
 * @swagger
 * /api/v1/corporate/companies/{id}/toggle-status:
 *   patch:
 *     summary: Toggle active/inactive status of a corporate company
 *     tags: [Corporate]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Corporate company ID
 *     responses:
 *       200:
 *         description: Status toggled successfully
 *       400:
 *         description: Cannot deactivate company with active bookings
 *       404:
 *         description: Company not found
 */
export const toggleCorporateCompanyStatus = catchAsync(async (req, res, next) => {
  // First, find the company to get its current status
  const company = await CorporateCompany.findOne({
    _id: req.params.id,
    hotelId: req.user.hotelId
  });

  if (!company) {
    return next(new ApplicationError('Corporate company not found', 404));
  }

  // If activating, no checks needed
  if (!company.isActive) {
    company.isActive = true;
    company.metadata.lastModifiedBy = req.user.id;
    await company.save();

    return res.status(200).json({
      status: 'success',
      message: 'Company activated successfully',
      data: { company }
    });
  }

  // If deactivating, check for active bookings
  const Booking = (await import('../models/Booking.js')).default;
  const activeBookings = await Booking.countDocuments({
    'corporateBooking.corporateCompanyId': req.params.id,
    status: { $in: ['confirmed', 'checked_in'] }
  });

  if (activeBookings > 0) {
    return next(new ApplicationError(
      `Cannot deactivate company with ${activeBookings} active booking(s). Please resolve all bookings first.`,
      400
    ));
  }

  // Check for pending credit transactions
  const pendingCredits = await CorporateCredit.countDocuments({
    corporateCompanyId: req.params.id,
    status: 'pending'
  });

  if (pendingCredits > 0) {
    return next(new ApplicationError(
      `Cannot deactivate company with ${pendingCredits} pending credit transaction(s).`,
      400
    ));
  }

  // Safe to deactivate
  company.isActive = false;
  company.metadata.lastModifiedBy = req.user.id;
  await company.save();

  res.status(200).json({
    status: 'success',
    message: 'Company deactivated successfully',
    data: { company }
  });
});

/**
 * @swagger
 * /api/v1/corporate/companies/{id}/credit-summary:
 *   get:
 *     summary: Get credit summary for a corporate company
 *     tags: [Corporate]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Corporate company ID
 *     responses:
 *       200:
 *         description: Credit summary
 *       404:
 *         description: Company not found
 */
export const getCorporateCompanyCreditSummary = catchAsync(async (req, res, next) => {
  const company = await CorporateCompany.findOne({
    _id: req.params.id,
    hotelId: req.user.hotelId
  });
  
  if (!company) {
    return next(new ApplicationError('Corporate company not found', 404));
  }
  
  const creditSummary = await CorporateCredit.getCreditSummary(
    req.params.id,
    req.user.hotelId
  );
  
  res.status(200).json({
    status: 'success',
    data: {
      company: {
        name: company.name,
        creditLimit: company.creditLimit,
        availableCredit: company.availableCredit
      },
      creditSummary
    }
  });
});

/**
 * @swagger
 * /api/v1/corporate/companies/{id}/bookings:
 *   get:
 *     summary: Get all bookings for a corporate company
 *     tags: [Corporate]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Corporate company ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by booking status
 *     responses:
 *       200:
 *         description: List of company bookings
 */
export const getCorporateCompanyBookings = catchAsync(async (req, res, next) => {
  const company = await CorporateCompany.findOne({
    _id: req.params.id,
    hotelId: req.user.hotelId
  });
  
  if (!company) {
    return next(new ApplicationError('Corporate company not found', 404));
  }
  
  const filter = {
    hotelId: req.user.hotelId,
    corporateCompanyId: req.params.id
  };
  
  if (req.query.status) {
    filter.status = req.query.status;
  }
  
  const features = new APIFeatures(GroupBooking.find(filter), req.query)
    .sort()
    .limitFields()
    .paginate();
    
  const bookings = await features.query.populate('rooms.bookingId');
  
  res.status(200).json({
    status: 'success',
    results: bookings.length,
    data: {
      bookings
    }
  });
});

/**
 * @swagger
 * /api/v1/corporate/companies/low-credit:
 *   get:
 *     summary: Get companies with low credit
 *     tags: [Corporate]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: threshold
 *         schema:
 *           type: number
 *         description: Credit threshold amount
 *     responses:
 *       200:
 *         description: List of companies with low credit
 */
export const getLowCreditCompanies = catchAsync(async (req, res, next) => {
  const threshold = req.query.threshold || 10000;
  
  const companies = await CorporateCompany.find({
    hotelId: req.user.hotelId,
    isActive: true,
    availableCredit: { $lt: threshold }
  }).select('name email phone availableCredit creditLimit');
  
  res.status(200).json({
    status: 'success',
    results: companies.length,
    data: {
      companies,
      threshold
    }
  });
});

/**
 * @swagger
 * /api/v1/corporate/companies/{id}/update-credit:
 *   patch:
 *     summary: Update corporate company credit
 *     tags: [Corporate]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Corporate company ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Amount to add/subtract from available credit
 *               description:
 *                 type: string
 *                 description: Description of the credit adjustment
 *     responses:
 *       200:
 *         description: Credit updated successfully
 *       404:
 *         description: Company not found
 */
export const updateCorporateCredit = catchAsync(async (req, res, next) => {
  const { amount, description } = req.body;

  const company = await CorporateCompany.findOne({
    _id: req.params.id,
    hotelId: req.user.hotelId
  });

  if (!company) {
    return next(new ApplicationError('Corporate company not found', 404));
  }

  // Update available credit
  await company.updateAvailableCredit(amount);

  // Create credit transaction record
  await CorporateCredit.create({
    hotelId: req.user.hotelId,
    corporateCompanyId: req.params.id,
    transactionType: amount > 0 ? 'credit' : 'adjustment',
    amount: Math.abs(amount),
    balance: company.availableCredit,
    description: description || 'Manual credit adjustment',
    status: 'processed',
    metadata: {
      createdBy: req.user.id,
      source: 'manual'
    }
  });

  res.status(200).json({
    status: 'success',
    data: {
      company: {
        id: company._id,
        name: company.name,
        previousCredit: company.availableCredit - amount,
        newCredit: company.availableCredit,
        adjustment: amount
      }
    }
  });
});

/**
 * @swagger
 * /api/v1/corporate/dashboard/metrics:
 *   get:
 *     summary: Get corporate credit dashboard metrics
 *     tags: [Corporate]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard metrics
 */
export const getCorporateDashboardMetrics = catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;

  // Get all active companies
  const companies = await CorporateCompany.find({
    hotelId,
    isActive: true
  });

  // Calculate total credit exposure
  const totalCreditLimit = companies.reduce((sum, company) => sum + company.creditLimit, 0);
  const totalAvailableCredit = companies.reduce((sum, company) => sum + company.availableCredit, 0);
  const totalUsedCredit = totalCreditLimit - totalAvailableCredit;

  // Companies with active credit (used credit > 0)
  const companiesWithActiveCredit = companies.filter(company =>
    (company.creditLimit - company.availableCredit) > 0
  ).length;

  // Calculate average utilization
  let totalUtilization = 0;
  let companiesWithCredit = 0;

  companies.forEach(company => {
    if (company.creditLimit > 0) {
      const utilization = ((company.creditLimit - company.availableCredit) / company.creditLimit) * 100;
      totalUtilization += utilization;
      companiesWithCredit++;
    }
  });

  const averageUtilization = companiesWithCredit > 0 ? totalUtilization / companiesWithCredit : 0;

  // Low credit alerts (companies with less than 20% available credit)
  const lowCreditAlerts = companies.filter(company => {
    if (company.creditLimit === 0) return false;
    const availablePercentage = (company.availableCredit / company.creditLimit) * 100;
    return availablePercentage < 20;
  }).length;

  // Recent transactions (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentTransactions = await CorporateCredit.find({
    hotelId,
    createdAt: { $gte: thirtyDaysAgo }
  }).countDocuments();

  // Monthly credit usage trend (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const monthlyUsage = await CorporateCredit.aggregate([
    {
      $match: {
        hotelId,
        transactionDate: { $gte: sixMonthsAgo },
        transactionType: { $in: ['debit', 'booking'] }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$transactionDate' },
          month: { $month: '$transactionDate' }
        },
        totalAmount: { $sum: '$amount' },
        transactionCount: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 }
    }
  ]);

  // Company performance breakdown
  const companyPerformance = await CorporateCompany.aggregate([
    {
      $match: { hotelId, isActive: true }
    },
    {
      $addFields: {
        usedCredit: { $subtract: ['$creditLimit', '$availableCredit'] },
        utilizationRate: {
          $cond: {
            if: { $eq: ['$creditLimit', 0] },
            then: 0,
            else: {
              $multiply: [
                { $divide: [{ $subtract: ['$creditLimit', '$availableCredit'] }, '$creditLimit'] },
                100
              ]
            }
          }
        }
      }
    },
    {
      $project: {
        name: 1,
        creditLimit: 1,
        availableCredit: 1,
        usedCredit: 1,
        utilizationRate: 1
      }
    },
    {
      $sort: { utilizationRate: -1 }
    },
    {
      $limit: 10
    }
  ]);

  // Credit distribution by utilization ranges
  const utilizationDistribution = await CorporateCompany.aggregate([
    {
      $match: { hotelId, isActive: true }
    },
    {
      $addFields: {
        utilizationRate: {
          $cond: {
            if: { $eq: ['$creditLimit', 0] },
            then: 0,
            else: {
              $multiply: [
                { $divide: [{ $subtract: ['$creditLimit', '$availableCredit'] }, '$creditLimit'] },
                100
              ]
            }
          }
        }
      }
    },
    {
      $group: {
        _id: {
          $switch: {
            branches: [
              { case: { $lt: ['$utilizationRate', 25] }, then: '0-25%' },
              { case: { $lt: ['$utilizationRate', 50] }, then: '25-50%' },
              { case: { $lt: ['$utilizationRate', 75] }, then: '50-75%' },
              { case: { $lt: ['$utilizationRate', 90] }, then: '75-90%' }
            ],
            default: '90-100%'
          }
        },
        count: { $sum: 1 },
        totalCreditLimit: { $sum: '$creditLimit' },
        totalUsedCredit: { $sum: { $subtract: ['$creditLimit', '$availableCredit'] } }
      }
    },
    {
      $sort: { '_id': 1 }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      overview: {
        totalCompanies: companies.length,
        totalCreditLimit,
        totalUsedCredit,
        totalAvailableCredit,
        companiesWithActiveCredit,
        averageUtilization: Math.round(averageUtilization * 100) / 100,
        lowCreditAlerts,
        recentTransactions
      },
      monthlyUsage,
      companyPerformance,
      utilizationDistribution,
      lastUpdated: new Date()
    }
  });
});

/**
 * @swagger
 * /api/v1/corporate/monitoring/status:
 *   get:
 *     summary: Run credit monitoring check
 *     tags: [Corporate Credit Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Monitoring results
 */
export const runCreditMonitoring = catchAsync(async (req, res, next) => {
  const results = await creditMonitoringService.monitorCreditStatus(req.user.hotelId);

  res.status(200).json({
    status: 'success',
    data: results
  });
});

/**
 * @swagger
 * /api/v1/corporate/monitoring/summary:
 *   get:
 *     summary: Get credit monitoring summary
 *     tags: [Corporate Credit Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Monitoring summary
 */
export const getCreditMonitoringSummary = catchAsync(async (req, res, next) => {
  const summary = await creditMonitoringService.getCreditMonitoringSummary(req.user.hotelId);

  res.status(200).json({
    status: 'success',
    data: summary
  });
});

/**
 * @swagger
 * /api/v1/corporate/credit/validate:
 *   post:
 *     summary: Validate booking credit availability
 *     tags: [Corporate Credit Monitoring]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               companyId:
 *                 type: string
 *                 description: Corporate company ID
 *               amount:
 *                 type: number
 *                 description: Booking amount to validate
 *     responses:
 *       200:
 *         description: Credit validation result
 */
export const validateBookingCredit = catchAsync(async (req, res, next) => {
  const { companyId, amount } = req.body;

  if (!companyId || !amount || amount <= 0) {
    return next(new ApplicationError('Company ID and valid amount are required', 400));
  }

  const validation = await creditMonitoringService.validateBookingCredit(companyId, amount);

  res.status(200).json({
    status: 'success',
    data: validation
  });
});

/**
 * @swagger
 * /api/v1/corporate/credit/process-booking:
 *   post:
 *     summary: Process booking credit transaction
 *     tags: [Corporate Credit Monitoring]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               companyId:
 *                 type: string
 *                 description: Corporate company ID
 *               amount:
 *                 type: number
 *                 description: Booking amount
 *               bookingId:
 *                 type: string
 *                 description: Booking ID
 *     responses:
 *       200:
 *         description: Credit processing result
 */
export const processBookingCredit = catchAsync(async (req, res, next) => {
  const { companyId, amount, bookingId } = req.body;

  if (!companyId || !amount || !bookingId || amount <= 0) {
    return next(new ApplicationError('Company ID, booking ID, and valid amount are required', 400));
  }

  const result = await creditMonitoringService.processBookingCredit(
    companyId,
    amount,
    bookingId,
    req.user.id
  );

  if (!result.success) {
    return next(new ApplicationError(result.reason || 'Credit processing failed', 400));
  }

  res.status(200).json({
    status: 'success',
    data: result
  });
});

/**
 * @swagger
 * /api/v1/corporate/credit/request-limit-increase:
 *   post:
 *     summary: Request credit limit increase
 *     tags: [Corporate Credit Approval]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - companyId
 *               - requestedLimit
 *               - justification
 *             properties:
 *               companyId:
 *                 type: string
 *                 description: Corporate company ID
 *               requestedLimit:
 *                 type: number
 *                 description: Requested new credit limit
 *               justification:
 *                 type: string
 *                 description: Business justification for increase
 *     responses:
 *       200:
 *         description: Request submitted successfully
 *       400:
 *         description: Invalid request or pending request exists
 */
export const requestCreditLimitIncrease = catchAsync(async (req, res, next) => {
  const { companyId, requestedLimit, justification } = req.body;

  if (!companyId || !requestedLimit || !justification || requestedLimit <= 0) {
    return next(new ApplicationError('Company ID, requested limit, and justification are required', 400));
  }

  const result = await creditMonitoringService.requestCreditLimitIncrease(
    companyId,
    requestedLimit,
    req.user.id,
    justification
  );

  if (!result.success) {
    return next(new ApplicationError(result.reason || 'Failed to submit request', 400));
  }

  res.status(200).json({
    status: 'success',
    data: result
  });
});

/**
 * @swagger
 * /api/v1/corporate/credit/process-limit-request:
 *   post:
 *     summary: Approve or reject credit limit request
 *     tags: [Corporate Credit Approval]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - requestId
 *               - action
 *             properties:
 *               requestId:
 *                 type: string
 *                 description: Request ID to process
 *               action:
 *                 type: string
 *                 enum: [approve, reject]
 *                 description: Action to take
 *               comments:
 *                 type: string
 *                 description: Approval/rejection comments
 *     responses:
 *       200:
 *         description: Request processed successfully
 */
export const processCreditLimitRequest = catchAsync(async (req, res, next) => {
  const { requestId, action, comments } = req.body;

  if (!requestId || !action || !['approve', 'reject'].includes(action)) {
    return next(new ApplicationError('Request ID and valid action (approve/reject) are required', 400));
  }

  const result = await creditMonitoringService.processCreditLimitRequest(
    requestId,
    action,
    req.user.id,
    comments
  );

  if (!result.success) {
    return next(new ApplicationError(result.reason || 'Failed to process request', 400));
  }

  res.status(200).json({
    status: 'success',
    data: result
  });
});

/**
 * @swagger
 * /api/v1/corporate/credit/adjustment:
 *   post:
 *     summary: Process manual credit adjustment
 *     tags: [Corporate Credit Approval]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - companyId
 *               - adjustmentAmount
 *               - reason
 *             properties:
 *               companyId:
 *                 type: string
 *                 description: Corporate company ID
 *               adjustmentAmount:
 *                 type: number
 *                 description: Amount to adjust (positive or negative)
 *               reason:
 *                 type: string
 *                 description: Reason for adjustment
 *     responses:
 *       200:
 *         description: Adjustment processed successfully
 */
export const processCreditAdjustment = catchAsync(async (req, res, next) => {
  const { companyId, adjustmentAmount, reason } = req.body;

  if (!companyId || adjustmentAmount === undefined || !reason) {
    return next(new ApplicationError('Company ID, adjustment amount, and reason are required', 400));
  }

  const result = await creditMonitoringService.processCreditAdjustment(
    companyId,
    adjustmentAmount,
    reason,
    req.user.id
  );

  if (!result.success) {
    return next(new ApplicationError(result.reason || 'Failed to process adjustment', 400));
  }

  res.status(200).json({
    status: 'success',
    data: result
  });
});

/**
 * @swagger
 * /api/v1/corporate/credit/pending-requests:
 *   get:
 *     summary: Get pending credit requests
 *     tags: [Corporate Credit Approval]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pending requests retrieved successfully
 */
export const getPendingCreditRequests = catchAsync(async (req, res, next) => {
  const result = await creditMonitoringService.getPendingCreditRequests(req.user.hotelId);

  if (!result.success) {
    return next(new ApplicationError(result.error || 'Failed to get pending requests', 500));
  }

  res.status(200).json({
    status: 'success',
    data: result
  });
});

/**
 * @swagger
 * /api/v1/corporate/credit/transaction-timeline/{companyId}:
 *   get:
 *     summary: Get detailed transaction history timeline for a company
 *     tags: [Corporate Credit Timeline]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema:
 *           type: string
 *         description: Corporate company ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date filter
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date filter
 *       - in: query
 *         name: transactionTypes
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             enum: [debit, credit, adjustment, refund]
 *         description: Filter by transaction types
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of transactions to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of transactions to skip
 *       - in: query
 *         name: includeBalanceHistory
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include balance history data
 *       - in: query
 *         name: groupByPeriod
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *         description: Group transactions by time period
 *     responses:
 *       200:
 *         description: Transaction timeline retrieved successfully
 */
export const getTransactionHistoryTimeline = catchAsync(async (req, res, next) => {
  const { companyId } = req.params;
  const {
    startDate,
    endDate,
    transactionTypes,
    limit,
    offset,
    includeBalanceHistory,
    groupByPeriod
  } = req.query;

  if (!companyId) {
    return next(new ApplicationError('Company ID is required', 400));
  }

  // Parse transaction types if provided
  let parsedTransactionTypes;
  if (transactionTypes) {
    parsedTransactionTypes = Array.isArray(transactionTypes) ? transactionTypes : [transactionTypes];
  }

  const filters = {
    startDate,
    endDate,
    transactionTypes: parsedTransactionTypes,
    limit: limit ? parseInt(limit) : 50,
    offset: offset ? parseInt(offset) : 0,
    includeBalanceHistory: includeBalanceHistory !== 'false',
    groupByPeriod
  };

  const result = await creditMonitoringService.getTransactionHistoryTimeline(companyId, filters);

  if (!result.success) {
    return next(new ApplicationError(result.reason || 'Failed to get transaction timeline', 400));
  }

  res.status(200).json({
    status: 'success',
    data: result
  });
});

/**
 * @swagger
 * /api/v1/corporate/credit/transaction-analytics/{companyId}:
 *   get:
 *     summary: Get transaction analytics for a company
 *     tags: [Corporate Credit Timeline]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: companyId
 *         required: true
 *         schema:
 *           type: string
 *         description: Corporate company ID
 *       - in: query
 *         name: period
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Analysis period in days
 *       - in: query
 *         name: includeComparisons
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include previous period comparisons
 *     responses:
 *       200:
 *         description: Transaction analytics retrieved successfully
 */
export const getTransactionAnalytics = catchAsync(async (req, res, next) => {
  const { companyId } = req.params;
  const {
    period,
    includeComparisons,
    includeTrends,
    includePatterns
  } = req.query;

  if (!companyId) {
    return next(new ApplicationError('Company ID is required', 400));
  }

  const analyticsConfig = {
    period: period ? parseInt(period) : 30,
    includeComparisons: includeComparisons !== 'false',
    includeTrends: includeTrends !== 'false',
    includePatterns: includePatterns !== 'false'
  };

  const result = await creditMonitoringService.getTransactionAnalytics(companyId, analyticsConfig);

  if (!result.success) {
    return next(new ApplicationError(result.reason || 'Failed to get transaction analytics', 400));
  }

  res.status(200).json({
    status: 'success',
    data: result
  });
});

/**
 * @swagger
 * /api/v1/corporate/security/verify-transaction/{transactionId}:
 *   get:
 *     summary: Verify transaction integrity
 *     tags: [Corporate Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction ID to verify
 *     responses:
 *       200:
 *         description: Transaction integrity verification completed
 */
export const verifyTransactionIntegrity = catchAsync(async (req, res, next) => {
  const { transactionId } = req.params;

  if (!transactionId) {
    return next(new ApplicationError('Transaction ID is required', 400));
  }

  const auditContext = {
    userId: req.user.id,
    userAgent: req.get('User-Agent'),
    ipAddress: req.ip,
    sessionId: req.sessionID
  };

  const result = await creditMonitoringService.verifyTransactionIntegrity(transactionId, auditContext);

  res.status(200).json({
    status: 'success',
    data: result
  });
});

/**
 * @swagger
 * /api/v1/corporate/security/batch-verify:
 *   post:
 *     summary: Batch verify multiple transactions
 *     tags: [Corporate Security]
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
 *                 description: Array of transaction IDs to verify
 *             required:
 *               - transactionIds
 *     responses:
 *       200:
 *         description: Batch transaction integrity verification completed
 */
export const batchVerifyTransactions = catchAsync(async (req, res, next) => {
  const { transactionIds } = req.body;

  if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
    return next(new ApplicationError('Transaction IDs array is required', 400));
  }

  if (transactionIds.length > 100) {
    return next(new ApplicationError('Maximum 100 transactions can be verified at once', 400));
  }

  const auditContext = {
    userId: req.user.id,
    userAgent: req.get('User-Agent'),
    ipAddress: req.ip,
    sessionId: req.sessionID
  };

  const result = await creditMonitoringService.batchVerifyTransactionIntegrity(transactionIds, auditContext);

  res.status(200).json({
    status: 'success',
    data: result
  });
});

/**
 * @swagger
 * /api/v1/corporate/security/daily-audit:
 *   post:
 *     summary: Run daily transaction integrity audit
 *     tags: [Corporate Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Daily integrity audit completed
 */
export const runDailyIntegrityAudit = catchAsync(async (req, res, next) => {
  const hotelId = req.user.hotelId;

  if (!hotelId) {
    return next(new ApplicationError('Hotel ID is required', 400));
  }

  const auditContext = {
    userId: req.user.id,
    userAgent: req.get('User-Agent'),
    ipAddress: req.ip,
    sessionId: req.sessionID
  };

  const result = await creditMonitoringService.runDailyIntegrityAudit(hotelId, auditContext);

  if (!result.success) {
    return next(new ApplicationError(result.error || 'Failed to run daily audit', 500));
  }

  res.status(200).json({
    status: 'success',
    data: result,
    message: result.invalid > 0
      ? `Audit completed with ${result.invalid} integrity issues found`
      : 'All transactions passed integrity checks'
  });
});
