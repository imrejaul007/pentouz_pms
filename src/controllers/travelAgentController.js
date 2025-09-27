import TravelAgent from '../models/TravelAgent.js';
import TravelAgentRates from '../models/TravelAgentRates.js';
import TravelAgentBooking from '../models/TravelAgentBooking.js';
import User from '../models/User.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import exportService from '../services/exportService.js';
import analyticsService from '../services/analyticsService.js';
import emailNotificationService from '../services/emailNotificationService.js';

/**
 * @swagger
 * components:
 *   tags:
 *     name: TravelAgents
 *     description: Travel agent management endpoints
 */

/**
 * @swagger
 * /api/v1/travel-agents:
 *   post:
 *     summary: Register a new travel agent
 *     tags: [TravelAgents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - companyName
 *               - contactPerson
 *               - phone
 *               - email
 *             properties:
 *               userId:
 *                 type: string
 *               agentCode:
 *                 type: string
 *               companyName:
 *                 type: string
 *               contactPerson:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               address:
 *                 type: object
 *               businessDetails:
 *                 type: object
 *               commissionStructure:
 *                 type: object
 *     responses:
 *       201:
 *         description: Travel agent registered successfully
 *       400:
 *         description: Invalid input data
 */
export const registerTravelAgent = catchAsync(async (req, res) => {
  const {
    userId,
    agentCode,
    companyName,
    contactPerson,
    phone,
    email,
    address,
    businessDetails,
    commissionStructure,
    bookingLimits,
    paymentTerms
  } = req.body;

  // Verify user exists and has travel_agent role
  const user = await User.findById(userId);
  if (!user) {
    throw new ApplicationError('User not found', 404);
  }

  if (user.role !== 'travel_agent') {
    throw new ApplicationError('User must have travel_agent role', 400);
  }

  // Check if travel agent already exists for this user
  const existingAgent = await TravelAgent.findOne({ userId });
  if (existingAgent) {
    throw new ApplicationError('Travel agent profile already exists for this user', 400);
  }

  // Create travel agent profile
  const travelAgent = new TravelAgent({
    userId,
    agentCode,
    companyName,
    contactPerson,
    phone,
    email,
    address,
    businessDetails,
    commissionStructure: {
      defaultRate: commissionStructure?.defaultRate || 10,
      roomTypeRates: commissionStructure?.roomTypeRates || [],
      seasonalRates: commissionStructure?.seasonalRates || []
    },
    bookingLimits,
    paymentTerms,
    hotelId: req.user.hotelId || req.body.hotelId,
    status: 'pending_approval'
  });

  await travelAgent.save();

  // Update user with travel agent details
  await User.findByIdAndUpdate(userId, {
    'travelAgentDetails.travelAgentId': travelAgent._id,
    'travelAgentDetails.agentCode': travelAgent.agentCode,
    'travelAgentDetails.commissionRate': travelAgent.commissionStructure.defaultRate,
    'travelAgentDetails.status': 'pending_approval'
  });

  res.status(201).json({
    success: true,
    message: 'Travel agent registered successfully',
    data: {
      travelAgent
    }
  });
});

/**
 * @swagger
 * /api/v1/travel-agents:
 *   get:
 *     summary: Get all travel agents (Admin only)
 *     tags: [TravelAgents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, suspended, pending_approval]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of travel agents
 */
export const getAllTravelAgents = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, status, search } = req.query;
  const skip = (page - 1) * limit;

  let query = { isActive: true };

  // Filter by hotel if user is not super admin
  if (req.user.role !== 'super_admin' && req.user.hotelId) {
    query.hotelId = req.user.hotelId;
  }

  if (status) {
    query.status = status;
  }

  if (search) {
    query.$or = [
      { companyName: { $regex: search, $options: 'i' } },
      { contactPerson: { $regex: search, $options: 'i' } },
      { agentCode: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const travelAgents = await TravelAgent.find(query)
    .populate('userId', 'name email')
    .populate('hotelId', 'name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await TravelAgent.countDocuments(query);

  res.json({
    success: true,
    data: {
      travelAgents,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNext: skip + travelAgents.length < total,
        hasPrev: page > 1
      }
    }
  });
});

/**
 * @swagger
 * /api/v1/travel-agents/{id}:
 *   get:
 *     summary: Get travel agent by ID
 *     tags: [TravelAgents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Travel agent details
 *       404:
 *         description: Travel agent not found
 */
export const getTravelAgentById = catchAsync(async (req, res) => {
  const { id } = req.params;

  const travelAgent = await TravelAgent.findById(id)
    .populate('userId', 'name email phone')
    .populate('hotelId', 'name address');

  if (!travelAgent) {
    throw new ApplicationError('Travel agent not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'travel_agent' && travelAgent.userId.toString() !== req.user._id.toString()) {
    throw new ApplicationError('Access denied', 403);
  }

  res.json({
    success: true,
    data: {
      travelAgent
    }
  });
});

/**
 * @swagger
 * /api/v1/travel-agents/{id}:
 *   put:
 *     summary: Update travel agent
 *     tags: [TravelAgents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TravelAgent'
 *     responses:
 *       200:
 *         description: Travel agent updated successfully
 *       404:
 *         description: Travel agent not found
 */
export const updateTravelAgent = catchAsync(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const travelAgent = await TravelAgent.findById(id);
  if (!travelAgent) {
    throw new ApplicationError('Travel agent not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'travel_agent' && travelAgent.userId.toString() !== req.user._id.toString()) {
    throw new ApplicationError('Access denied', 403);
  }

  // Prevent travel agents from changing their own status or commission rates
  if (req.user.role === 'travel_agent') {
    delete updates.status;
    delete updates.commissionStructure;
    delete updates.isActive;
  }

  const updatedAgent = await TravelAgent.findByIdAndUpdate(
    id,
    updates,
    { new: true, runValidators: true }
  ).populate('userId', 'name email');

  // Update user's travel agent details if commission rate changed
  if (updates.commissionStructure?.defaultRate) {
    await User.findByIdAndUpdate(travelAgent.userId, {
      'travelAgentDetails.commissionRate': updates.commissionStructure.defaultRate
    });
  }

  res.json({
    success: true,
    message: 'Travel agent updated successfully',
    data: {
      travelAgent: updatedAgent
    }
  });
});

/**
 * @swagger
 * /api/v1/travel-agents/{id}/status:
 *   patch:
 *     summary: Update travel agent status (Admin only)
 *     tags: [TravelAgents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, inactive, suspended, pending_approval]
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Status updated successfully
 */
export const updateTravelAgentStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  const travelAgent = await TravelAgent.findByIdAndUpdate(
    id,
    { status },
    { new: true, runValidators: true }
  );

  if (!travelAgent) {
    throw new ApplicationError('Travel agent not found', 404);
  }

  // Update user's travel agent status
  await User.findByIdAndUpdate(travelAgent.userId, {
    'travelAgentDetails.status': status
  });

  res.json({
    success: true,
    message: `Travel agent status updated to ${status}`,
    data: {
      travelAgent,
      reason
    }
  });
});

/**
 * @swagger
 * /api/v1/travel-agents/{id}/performance:
 *   get:
 *     summary: Get travel agent performance metrics
 *     tags: [TravelAgents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Performance metrics
 */
export const getTravelAgentPerformance = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { startDate, endDate } = req.query;

  const travelAgent = await TravelAgent.findById(id);
  if (!travelAgent) {
    throw new ApplicationError('Travel agent not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'travel_agent' && travelAgent.userId.toString() !== req.user._id.toString()) {
    throw new ApplicationError('Access denied', 403);
  }

  const performance = await TravelAgentBooking.getAgentPerformance(id, startDate, endDate);
  const monthlyRevenue = await TravelAgentBooking.getMonthlyRevenue(id, new Date().getFullYear());

  res.json({
    success: true,
    data: {
      performance: performance[0] || {},
      monthlyRevenue,
      agentDetails: {
        companyName: travelAgent.companyName,
        agentCode: travelAgent.agentCode,
        status: travelAgent.status,
        commissionRate: travelAgent.commissionStructure.defaultRate
      }
    }
  });
});

/**
 * @swagger
 * /api/v1/travel-agents/me:
 *   get:
 *     summary: Get current travel agent profile
 *     tags: [TravelAgents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current travel agent profile
 *       404:
 *         description: Travel agent profile not found
 */
export const getMyTravelAgentProfile = catchAsync(async (req, res) => {
  if (req.user.role !== 'travel_agent') {
    throw new ApplicationError('Access denied. Travel agent role required.', 403);
  }

  const travelAgent = await TravelAgent.findOne({ userId: req.user._id })
    .populate('hotelId', 'name address');

  if (!travelAgent) {
    throw new ApplicationError('Travel agent profile not found', 404);
  }

  res.json({
    success: true,
    data: {
      travelAgent
    }
  });
});

/**
 * @swagger
 * /api/v1/travel-agents/me/bookings:
 *   get:
 *     summary: Get current travel agent's bookings
 *     tags: [TravelAgents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of bookings
 */
export const getMyBookings = catchAsync(async (req, res) => {
  if (req.user.role !== 'travel_agent') {
    throw new ApplicationError('Access denied. Travel agent role required.', 403);
  }

  const { page = 1, limit = 20, status } = req.query;
  const skip = (page - 1) * limit;

  const travelAgent = await TravelAgent.findOne({ userId: req.user._id });
  if (!travelAgent) {
    throw new ApplicationError('Travel agent profile not found', 404);
  }

  let query = { travelAgentId: travelAgent._id, isActive: true };

  if (status) {
    query.bookingStatus = status;
  }

  const bookings = await TravelAgentBooking.find(query)
    .populate('bookingId', 'bookingNumber status checkIn checkOut')
    .populate('hotelId', 'name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await TravelAgentBooking.countDocuments(query);

  res.json({
    success: true,
    data: {
      bookings,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNext: skip + bookings.length < total,
        hasPrev: page > 1
      }
    }
  });
});

/**
 * @swagger
 * /api/v1/travel-agents/validate-code/{code}:
 *   get:
 *     summary: Validate travel agent code
 *     tags: [TravelAgents]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Agent code validation result
 */
export const validateAgentCode = catchAsync(async (req, res) => {
  const { code } = req.params;

  const travelAgent = await TravelAgent.findByAgentCode(code);

  if (!travelAgent) {
    return res.json({
      success: false,
      valid: false,
      message: 'Invalid agent code'
    });
  }

  if (travelAgent.status !== 'active') {
    return res.json({
      success: false,
      valid: false,
      message: 'Agent account is not active'
    });
  }

  res.json({
    success: true,
    valid: true,
    data: {
      agentCode: travelAgent.agentCode,
      companyName: travelAgent.companyName,
      commissionRate: travelAgent.commissionStructure.defaultRate
    }
  });
});

/**
 * @swagger
 * /api/v1/travel-agents/export/bookings:
 *   post:
 *     summary: Export bookings data to Excel or CSV
 *     tags: [TravelAgents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               format:
 *                 type: string
 *                 enum: [excel, csv]
 *                 default: excel
 *               filters:
 *                 type: object
 *                 properties:
 *                   startDate:
 *                     type: string
 *                     format: date
 *                   endDate:
 *                     type: string
 *                     format: date
 *                   status:
 *                     type: string
 *                   hotelId:
 *                     type: string
 *     responses:
 *       200:
 *         description: Export file created successfully
 */
export const exportBookings = catchAsync(async (req, res) => {
  const { format = 'excel', filters = {} } = req.body;

  // If user is a travel agent, only allow exporting their own data
  let travelAgentId = null;
  if (req.user.role === 'travel_agent') {
    const travelAgent = await TravelAgent.findOne({ userId: req.user._id });
    if (!travelAgent) {
      throw new ApplicationError('Travel agent profile not found', 404);
    }
    travelAgentId = travelAgent._id;
  }

  let result;
  if (format === 'csv') {
    result = await exportService.exportBookingsToCSV(filters, travelAgentId);
  } else {
    result = await exportService.exportBookingsToExcel(filters, travelAgentId);
  }

  res.json({
    success: true,
    message: 'Export completed successfully',
    data: {
      filename: result.filename,
      recordCount: result.recordCount,
      fileSize: result.fileSize,
      downloadUrl: `/api/v1/travel-agents/download/${result.filename}`
    }
  });
});

/**
 * @swagger
 * /api/v1/travel-agents/export/commission-report:
 *   post:
 *     summary: Generate commission report
 *     tags: [TravelAgents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               filters:
 *                 type: object
 *                 properties:
 *                   startDate:
 *                     type: string
 *                     format: date
 *                   endDate:
 *                     type: string
 *                     format: date
 *                   travelAgentId:
 *                     type: string
 *                   status:
 *                     type: string
 *                     default: confirmed
 *     responses:
 *       200:
 *         description: Commission report generated successfully
 */
export const generateCommissionReport = catchAsync(async (req, res) => {
  const { filters = {} } = req.body;

  // If user is a travel agent, only allow generating report for themselves
  if (req.user.role === 'travel_agent') {
    const travelAgent = await TravelAgent.findOne({ userId: req.user._id });
    if (!travelAgent) {
      throw new ApplicationError('Travel agent profile not found', 404);
    }
    filters.travelAgentId = travelAgent._id;
  }

  const result = await exportService.generateCommissionReport(filters);

  res.json({
    success: true,
    message: 'Commission report generated successfully',
    data: {
      filename: result.filename,
      summary: result.summary,
      fileSize: result.fileSize,
      downloadUrl: `/api/v1/travel-agents/download/${result.filename}`
    }
  });
});

/**
 * @swagger
 * /api/v1/travel-agents/export/batch:
 *   post:
 *     summary: Create batch export with multiple formats
 *     tags: [TravelAgents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               formats:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [excel, csv, commission]
 *               filters:
 *                 type: object
 *               includeInvoices:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Batch export created successfully
 */
export const createBatchExport = catchAsync(async (req, res) => {
  const { formats = ['excel'], filters = {}, includeInvoices = false } = req.body;

  // If user is a travel agent, only allow exporting their own data
  if (req.user.role === 'travel_agent') {
    const travelAgent = await TravelAgent.findOne({ userId: req.user._id });
    if (!travelAgent) {
      throw new ApplicationError('Travel agent profile not found', 404);
    }
    filters.travelAgentId = travelAgent._id;
  }

  const exportOptions = {
    formats,
    filters,
    includeInvoices: includeInvoices && req.user.role !== 'travel_agent' // Only admins can include invoices
  };

  const result = await exportService.createBatchExport(exportOptions);

  res.json({
    success: true,
    message: 'Batch export created successfully',
    data: {
      filename: result.filename,
      exports: result.exports,
      totalFiles: result.totalFiles,
      fileSize: result.fileSize,
      downloadUrl: `/api/v1/travel-agents/download/${result.filename}`
    }
  });
});

/**
 * @swagger
 * /api/v1/travel-agents/analytics/trends:
 *   get:
 *     summary: Get booking trends analytics
 *     tags: [TravelAgents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: granularity
 *         schema:
 *           type: string
 *           enum: [day, week, month, quarter]
 *           default: month
 *     responses:
 *       200:
 *         description: Booking trends analytics
 */
export const getBookingTrends = catchAsync(async (req, res) => {
  const { startDate, endDate, granularity = 'month' } = req.query;

  const filters = { granularity };
  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;

  // If user is a travel agent, only show their own data
  if (req.user.role === 'travel_agent') {
    const travelAgent = await TravelAgent.findOne({ userId: req.user._id });
    if (!travelAgent) {
      throw new ApplicationError('Travel agent profile not found', 404);
    }
    filters.travelAgentId = travelAgent._id;
  }

  const analytics = await analyticsService.analyzeBookingTrends(filters);

  res.json({
    success: true,
    data: analytics
  });
});

/**
 * @swagger
 * /api/v1/travel-agents/analytics/forecast:
 *   get:
 *     summary: Get revenue forecast
 *     tags: [TravelAgents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: periodsAhead
 *         schema:
 *           type: integer
 *           default: 6
 *       - in: query
 *         name: granularity
 *         schema:
 *           type: string
 *           enum: [day, week, month, quarter]
 *           default: month
 *     responses:
 *       200:
 *         description: Revenue forecast
 */
export const getRevenueForecast = catchAsync(async (req, res) => {
  const { periodsAhead = 6, granularity = 'month' } = req.query;

  const filters = { granularity };

  // If user is a travel agent, only show their own forecast
  if (req.user.role === 'travel_agent') {
    const travelAgent = await TravelAgent.findOne({ userId: req.user._id });
    if (!travelAgent) {
      throw new ApplicationError('Travel agent profile not found', 404);
    }
    filters.travelAgentId = travelAgent._id;
  }

  const forecast = await analyticsService.forecastRevenue(filters, parseInt(periodsAhead));

  res.json({
    success: true,
    data: forecast
  });
});

/**
 * @swagger
 * /api/v1/travel-agents/analytics/performance:
 *   get:
 *     summary: Get performance metrics
 *     tags: [TravelAgents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Performance metrics
 */
export const getPerformanceMetrics = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;

  const filters = {};
  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;

  // If user is a travel agent, only show their own metrics
  if (req.user.role === 'travel_agent') {
    const travelAgent = await TravelAgent.findOne({ userId: req.user._id });
    if (!travelAgent) {
      throw new ApplicationError('Travel agent profile not found', 404);
    }
    filters.travelAgentId = travelAgent._id;
  }

  const metrics = await analyticsService.calculatePerformanceMetrics(filters);

  res.json({
    success: true,
    data: metrics
  });
});

/**
 * @swagger
 * /api/v1/travel-agents/download/{filename}:
 *   get:
 *     summary: Download exported file
 *     tags: [TravelAgents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File download
 */
export const downloadFile = catchAsync(async (req, res) => {
  const { filename } = req.params;
  const fs = await import('fs');
  const path = await import('path');

  const filepath = path.join(process.cwd(), 'exports', filename);

  // Check if file exists
  if (!fs.existsSync(filepath)) {
    throw new ApplicationError('File not found', 404);
  }

  // Set appropriate headers
  const ext = path.extname(filename).toLowerCase();
  let contentType = 'application/octet-stream';

  switch (ext) {
    case '.xlsx':
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      break;
    case '.csv':
      contentType = 'text/csv';
      break;
    case '.zip':
      contentType = 'application/zip';
      break;
    case '.html':
      contentType = 'text/html';
      break;
  }

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const fileStream = fs.createReadStream(filepath);
  fileStream.pipe(res);
});