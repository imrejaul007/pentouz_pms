import express from 'express';
import IncidentReport from '../models/IncidentReport.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /incidents:
 *   post:
 *     summary: Create a new incident report
 *     tags: [Incidents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - type
 *               - severity
 *               - location
 *               - timeOccurred
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [security, safety, medical, property_damage, guest_complaint, staff_issue, maintenance, fire, theft, accident, other]
 *               severity:
 *                 type: string
 *                 enum: [low, medium, high, critical, emergency]
 *               location:
 *                 type: string
 *               timeOccurred:
 *                 type: string
 *                 format: date-time
 *               roomId:
 *                 type: string
 *               guestId:
 *                 type: string
 *               bookingId:
 *                 type: string
 *               injuryInvolved:
 *                 type: boolean
 *               injuryDetails:
 *                 type: string
 *               witnesses:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     contact:
 *                       type: string
 *                     statement:
 *                       type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Incident report created successfully
 */
router.post('/', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const incidentData = {
    ...req.body,
    hotelId: req.user.role === 'staff' ? req.user.hotelId : req.body.hotelId,
    reportedBy: req.user._id
  };

  // Validate hotel access for admin users
  if (req.user.role === 'admin' && !req.body.hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  // Set witness count
  if (incidentData.witnesses && incidentData.witnesses.length > 0) {
    incidentData.witnessCount = incidentData.witnesses.length;
  }

  const incident = await IncidentReport.create(incidentData);
  
  await incident.populate([
    { path: 'hotelId', select: 'name' },
    { path: 'roomId', select: 'number type' },
    { path: 'guestId', select: 'name email' },
    { path: 'reportedBy', select: 'name' }
  ]);

  res.status(201).json({
    status: 'success',
    data: { incident }
  });
}));

/**
 * @swagger
 * /incidents:
 *   get:
 *     summary: Get incident reports
 *     tags: [Incidents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *       - in: query
 *         name: assignedTo
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
 *         description: List of incident reports
 */
router.get('/', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    type,
    severity,
    assignedTo,
    startDate,
    endDate,
    critical
  } = req.query;

  const query = {};

  // Role-based filtering
  if (req.user.role === 'staff') {
    query.hotelId = req.user.hotelId;
  } else if (req.user.role === 'admin' && req.query.hotelId) {
    query.hotelId = req.query.hotelId;
  }

  // Apply filters
  if (status) query.status = status;
  if (type) query.type = type;
  if (severity) query.severity = severity;
  if (assignedTo) query.assignedTo = assignedTo;

  if (startDate || endDate) {
    query.timeOccurred = {};
    if (startDate) query.timeOccurred.$gte = new Date(startDate);
    if (endDate) query.timeOccurred.$lte = new Date(endDate);
  }

  // Filter critical incidents only
  if (critical === 'true') {
    query.$or = [
      { severity: { $in: ['critical', 'emergency'] } },
      { injuryInvolved: true },
      { policeNotified: true }
    ];
  }

  const skip = (page - 1) * limit;
  
  const [incidents, total] = await Promise.all([
    IncidentReport.find(query)
      .populate('hotelId', 'name')
      .populate('roomId', 'number type floor')
      .populate('guestId', 'name email')
      .populate('reportedBy', 'name')
      .populate('assignedTo', 'name')
      .sort('-timeOccurred')
      .skip(skip)
      .limit(parseInt(limit)),
    IncidentReport.countDocuments(query)
  ]);

  res.json({
    status: 'success',
    data: {
      incidents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

/**
 * @swagger
 * /incidents/{id}:
 *   get:
 *     summary: Get specific incident report
 *     tags: [Incidents]
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
 *         description: Incident report details
 */
router.get('/:id', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const incident = await IncidentReport.findById(req.params.id)
    .populate('hotelId', 'name contact')
    .populate('roomId', 'number type floor amenities')
    .populate('guestId', 'name email phone')
    .populate('bookingId', 'bookingNumber checkIn checkOut')
    .populate('reportedBy', 'name email role')
    .populate('assignedTo', 'name email role')
    .populate('actionsTaken.takenBy', 'name role')
    .populate('documents.uploadedBy', 'name');

  if (!incident) {
    throw new ApplicationError('Incident report not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'staff' && incident.hotelId._id.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only view incidents for your hotel', 403);
  }

  res.json({
    status: 'success',
    data: { incident }
  });
}));

/**
 * @swagger
 * /incidents/{id}:
 *   patch:
 *     summary: Update incident report
 *     tags: [Incidents]
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
 *             properties:
 *               status:
 *                 type: string
 *               assignedTo:
 *                 type: string
 *               resolution:
 *                 type: string
 *               preventiveMeasures:
 *                 type: string
 *               followUpRequired:
 *                 type: boolean
 *               followUpDate:
 *                 type: string
 *                 format: date-time
 *               policeNotified:
 *                 type: boolean
 *               policeReportNumber:
 *                 type: string
 *               insuranceNotified:
 *                 type: boolean
 *               insuranceClaimNumber:
 *                 type: string
 *     responses:
 *       200:
 *         description: Incident updated successfully
 */
router.patch('/:id', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const incident = await IncidentReport.findById(req.params.id);
  
  if (!incident) {
    throw new ApplicationError('Incident report not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'staff' && incident.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only update incidents for your hotel', 403);
  }

  const allowedUpdates = [
    'status', 'assignedTo', 'resolution', 'preventiveMeasures', 'followUpRequired',
    'followUpDate', 'followUpNotes', 'policeNotified', 'policeReportNumber',
    'insuranceNotified', 'insuranceClaimNumber', 'medicalProvider', 'priority',
    'tags', 'departmentInvolved', 'guestSatisfactionImpact'
  ];

  const updates = {};
  Object.keys(req.body).forEach(key => {
    if (allowedUpdates.includes(key)) {
      updates[key] = req.body[key];
    }
  });

  // If status is being updated, use the instance method
  if (updates.status && updates.status !== incident.status) {
    await incident.updateStatus(updates.status, req.body.statusNotes || '');
    delete updates.status;
  }

  Object.assign(incident, updates);
  await incident.save();

  await incident.populate([
    { path: 'assignedTo', select: 'name' },
    { path: 'actionsTaken.takenBy', select: 'name' }
  ]);

  res.json({
    status: 'success',
    data: { incident }
  });
}));

/**
 * @swagger
 * /incidents/{id}/assign:
 *   post:
 *     summary: Assign incident to staff member
 *     tags: [Incidents]
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
 *               - assignedTo
 *             properties:
 *               assignedTo:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Incident assigned successfully
 */
router.post('/:id/assign', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { assignedTo, notes } = req.body;
  
  const incident = await IncidentReport.findById(req.params.id);
  
  if (!incident) {
    throw new ApplicationError('Incident report not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'staff' && incident.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only assign incidents for your hotel', 403);
  }

  await incident.assignIncident(assignedTo);
  
  if (notes) {
    await incident.addAction(`Assignment notes: ${notes}`, req.user._id);
  }

  await incident.populate([
    { path: 'assignedTo', select: 'name email' }
  ]);

  res.json({
    status: 'success',
    message: 'Incident assigned successfully',
    data: { incident }
  });
}));

/**
 * @swagger
 * /incidents/{id}/actions:
 *   post:
 *     summary: Add action to incident
 *     tags: [Incidents]
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
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *               notes:
 *                 type: string
 *               cost:
 *                 type: number
 *     responses:
 *       200:
 *         description: Action added successfully
 */
router.post('/:id/actions', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { action, notes, cost } = req.body;
  
  const incident = await IncidentReport.findById(req.params.id);
  
  if (!incident) {
    throw new ApplicationError('Incident report not found', 404);
  }

  // Check access permissions
  if (req.user.role === 'staff' && incident.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError('You can only add actions to incidents for your hotel', 403);
  }

  await incident.addAction(action, req.user._id, notes || '', cost || 0);

  await incident.populate([
    { path: 'actionsTaken.takenBy', select: 'name' }
  ]);

  res.json({
    status: 'success',
    message: 'Action added successfully',
    data: { incident }
  });
}));

/**
 * @swagger
 * /incidents/stats:
 *   get:
 *     summary: Get incident statistics
 *     tags: [Incidents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
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
 *         description: Incident statistics
 */
router.get('/stats', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.query.hotelId;
  
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  const [stats, criticalIncidents, recentIncidents, trends] = await Promise.all([
    IncidentReport.getIncidentStats(hotelId, startDate, endDate),
    IncidentReport.getCriticalIncidents(hotelId),
    IncidentReport.getRecentIncidents(hotelId, 10),
    IncidentReport.getIncidentTrends(hotelId, 30)
  ]);

  // Get overall summary
  const matchQuery = {
    hotelId: new mongoose.Types.ObjectId(hotelId),
    ...(startDate && endDate ? {
      timeOccurred: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    } : {})
  };

  const overallStats = await IncidentReport.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalIncidents: { $sum: 1 },
        criticalCount: {
          $sum: { 
            $cond: [
              { $in: ['$severity', ['critical', 'emergency']] },
              1, 
              0 
            ] 
          }
        },
        injuryCount: {
          $sum: { $cond: ['$injuryInvolved', 1, 0] }
        },
        resolvedCount: {
          $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
        },
        avgResolutionTime: {
          $avg: { 
            $divide: [
              { $subtract: ['$updatedAt', '$timeOccurred'] }, 
              1000 * 60 * 60 * 24 // Convert to days
            ] 
          }
        },
        totalCost: { $sum: '$totalCost' }
      }
    }
  ]);

  res.json({
    status: 'success',
    data: {
      overall: overallStats[0] || {},
      byType: stats,
      critical: {
        count: criticalIncidents.length,
        incidents: criticalIncidents.slice(0, 5) // Show first 5
      },
      recent: recentIncidents,
      trends
    }
  });
}));

/**
 * @swagger
 * /incidents/critical:
 *   get:
 *     summary: Get critical incidents
 *     tags: [Incidents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Critical incidents
 */
router.get('/critical', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.query.hotelId;
  
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  const criticalIncidents = await IncidentReport.getCriticalIncidents(hotelId);

  res.json({
    status: 'success',
    data: {
      incidents: criticalIncidents,
      count: criticalIncidents.length
    }
  });
}));

/**
 * @swagger
 * /incidents/trends:
 *   get:
 *     summary: Get incident trends
 *     tags: [Incidents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *     responses:
 *       200:
 *         description: Incident trends
 */
router.get('/trends', authorize('staff', 'admin'), catchAsync(async (req, res) => {
  const { days = 30 } = req.query;
  const hotelId = req.user.role === 'staff' ? req.user.hotelId : req.query.hotelId;
  
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  const trends = await IncidentReport.getIncidentTrends(hotelId, parseInt(days));

  res.json({
    status: 'success',
    data: {
      trends,
      period: `${days} days`
    }
  });
}));

export default router;
