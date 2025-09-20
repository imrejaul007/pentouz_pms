import express from 'express';
import QRCode from 'qrcode';
import DigitalKey from '../models/DigitalKey.js';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import User from '../models/User.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import { validate, schemas } from '../middleware/validation.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Get all digital keys for the authenticated user
router.get('/', catchAsync(async (req, res) => {
  const { page = 1, limit = 20, status, type } = req.query;
  const skip = (page - 1) * limit;
  
  const filter = { userId: req.user.id };
  if (status) filter.status = status;
  if (type) filter.type = type;
  
  const keys = await DigitalKey.find(filter)
    .populate('bookingId', 'bookingNumber checkIn checkOut')
    .populate('roomId', 'number type floor')
    .populate('hotelId', 'name address')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));
  
  const total = await DigitalKey.countDocuments(filter);
  
  res.json({
    success: true,
    data: {
      keys,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNext: skip + keys.length < total,
        hasPrev: page > 1
      }
    }
  });
}));

// Get shared keys for the authenticated user
router.get('/shared', catchAsync(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;
  
  const keys = await DigitalKey.getSharedKeysForUser(req.user.id)
    .skip(skip)
    .limit(parseInt(limit));
  
  const total = await DigitalKey.countDocuments({
    'sharedWith.userId': req.user.id,
    'sharedWith.isActive': true,
    status: 'active',
    validUntil: { $gt: new Date() }
  });
  
  res.json({
    success: true,
    data: {
      keys,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNext: skip + keys.length < total,
        hasPrev: page > 1
      }
    }
  });
}));

// Generate a new digital key for a booking
router.post('/generate', validate(schemas.generateDigitalKey), catchAsync(async (req, res) => {
  const { bookingId, type = 'primary', maxUses = -1, securitySettings = {} } = req.body;
  
  // Verify booking exists and belongs to user
  const booking = await Booking.findOne({ 
    _id: bookingId, 
    userId: req.user.id,
    status: { $in: ['confirmed', 'checked_in'] }
  }).populate('hotelId').populate('rooms.roomId');
  
  if (!booking) {
    throw new ApplicationError('Booking not found or not eligible for digital key', 404);
  }
  
  if (!booking.rooms || booking.rooms.length === 0) {
    throw new ApplicationError('Booking has no rooms assigned', 400);
  }
  
  // Check if key already exists for this booking
  const existingKey = await DigitalKey.findOne({ 
    bookingId, 
    userId: req.user.id,
    status: { $in: ['active', 'expired'] }
  });
  
  if (existingKey && type === 'primary') {
    throw new ApplicationError('A primary key already exists for this booking', 400);
  }
  
  // Use the first room (for multi-room bookings, we'll generate key for first room)
  const firstRoom = booking.rooms[0];
  
  // Generate QR code data (keep it minimal for QR code size limits)
  const keyCode = DigitalKey.generateKeyCode();
  const qrData = JSON.stringify({
    k: keyCode,                                    // key code
    b: booking._id.toString().slice(-8),           // last 8 chars of booking ID  
    r: firstRoom.roomId._id.toString().slice(-8),  // last 8 chars of room ID
    h: booking.hotelId._id.toString().slice(-8),   // last 8 chars of hotel ID
    t: type.charAt(0),                             // first letter of type
    ts: Math.floor(Date.now() / 1000)              // timestamp in seconds
  });
  
  const qrCode = await QRCode.toDataURL(qrData);
  
  // Create digital key
  const digitalKey = new DigitalKey({
    userId: req.user.id,
    bookingId: booking._id,
    roomId: firstRoom.roomId._id,
    hotelId: booking.hotelId._id,
    keyCode,
    qrCode,
    type,
    validFrom: new Date(),
    validUntil: booking.checkOut,
    maxUses: parseInt(maxUses),
    securitySettings: {
      requirePin: securitySettings.requirePin || false,
      pin: securitySettings.pin,
      allowSharing: securitySettings.allowSharing !== false,
      maxSharedUsers: securitySettings.maxSharedUsers || 5,
      requireApproval: securitySettings.requireApproval || false
    },
    metadata: {
      generatedBy: req.user.id,
      deviceInfo: {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip
      }
    }
  });
  
  await digitalKey.save();
  
  // Populate references for response
  await digitalKey.populate([
    { path: 'bookingId', select: 'bookingNumber checkIn checkOut' },
    { path: 'roomId', select: 'number type floor' },
    { path: 'hotelId', select: 'name address' }
  ]);
  
  res.status(201).json({
    success: true,
    message: 'Digital key generated successfully',
    data: digitalKey
  });
}));

// Admin Routes - System-wide digital key management (MUST be before /:keyId route)
// Get all digital keys (admin only)
router.get('/admin', authenticate, authorize(['admin']), catchAsync(async (req, res) => {
  const { page = 1, limit = 20, status, type, hotel, search } = req.query;
  const skip = (page - 1) * limit;
  
  const filter = {};
  if (status) filter.status = status;
  if (type) filter.type = type;
  if (hotel) filter.hotelId = hotel;
  
  // Add search functionality
  if (search) {
    filter.$or = [
      { keyCode: { $regex: search, $options: 'i' } },
      { 'bookingId.bookingNumber': { $regex: search, $options: 'i' } }
    ];
  }
  
  const keys = await DigitalKey.find(filter)
    .populate('userId', 'firstName lastName email')
    .populate('bookingId', 'bookingNumber checkIn checkOut')
    .populate('roomId', 'number type floor')
    .populate('hotelId', 'name address')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));
  
  const total = await DigitalKey.countDocuments(filter);
  
  res.json({
    success: true,
    data: {
      keys,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNext: skip + keys.length < total,
        hasPrev: page > 1
      }
    }
  });
}));

// Get admin analytics for digital keys
router.get('/admin/analytics', authenticate, authorize(['admin']), catchAsync(async (req, res) => {
  const { timeRange = '30d' } = req.query;
  
  // Calculate date range
  let startDate = new Date();
  switch (timeRange) {
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(startDate.getDate() - 90);
      break;
    case '1y':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    default:
      startDate.setDate(startDate.getDate() - 30);
  }
  
  const [
    totalKeys,
    activeKeys,
    expiredKeys,
    revokedKeys,
    totalUses,
    uniqueUsers,
    keysByType,
    keysByHotel,
    usageTrends,
    recentActivity,
    topUsers
  ] = await Promise.all([
    // Total keys count
    DigitalKey.countDocuments(),
    
    // Active keys count
    DigitalKey.countDocuments({ 
      status: 'active',
      validUntil: { $gt: new Date() }
    }),
    
    // Expired keys count
    DigitalKey.countDocuments({ 
      $or: [
        { status: 'expired' },
        { validUntil: { $lt: new Date() } }
      ]
    }),
    
    // Revoked keys count
    DigitalKey.countDocuments({ status: 'revoked' }),
    
    // Total usage count
    DigitalKey.aggregate([
      { $group: { _id: null, total: { $sum: '$currentUses' } } }
    ]),
    
    // Unique users count
    DigitalKey.distinct('userId').then(users => users.length),
    
    // Keys by type
    DigitalKey.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]),
    
    // Keys by hotel
    DigitalKey.aggregate([
      {
        $lookup: {
          from: 'hotels',
          localField: 'hotelId',
          foreignField: '_id',
          as: 'hotel'
        }
      },
      { $unwind: '$hotel' },
      { 
        $group: { 
          _id: '$hotelId',
          hotelName: { $first: '$hotel.name' },
          count: { $sum: 1 } 
        } 
      }
    ]),
    
    // Usage trends over time
    DigitalKey.aggregate([
      { 
        $match: { 
          createdAt: { $gte: startDate } 
        } 
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]),
    
    // Recent activity
    DigitalKey.aggregate([
      { $unwind: '$accessLogs' },
      { $sort: { 'accessLogs.timestamp': -1 } },
      { $limit: 20 },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $lookup: {
          from: 'hotels',
          localField: 'hotelId',
          foreignField: '_id',
          as: 'hotel'
        }
      },
      { $unwind: '$hotel' },
      { $project: {
        keyId: '$_id',
        action: '$accessLogs.action',
        timestamp: '$accessLogs.timestamp',
        user: {
          name: { $concat: ['$user.firstName', ' ', '$user.lastName'] },
          email: '$user.email'
        },
        hotel: '$hotel.name',
        deviceInfo: '$accessLogs.deviceInfo'
      }}
    ]),
    
    // Top users by key count
    DigitalKey.aggregate([
      {
        $group: {
          _id: '$userId',
          keyCount: { $sum: 1 },
          totalUses: { $sum: '$currentUses' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          name: { $concat: ['$user.firstName', ' ', '$user.lastName'] },
          email: '$user.email',
          keyCount: 1,
          totalUses: 1
        }
      },
      { $sort: { keyCount: -1 } },
      { $limit: 10 }
    ])
  ]);
  
  res.json({
    success: true,
    data: {
      overview: {
        totalKeys,
        activeKeys,
        expiredKeys,
        revokedKeys,
        totalUses: totalUses[0]?.total || 0,
        uniqueUsers
      },
      breakdowns: {
        byType: keysByType,
        byHotel: keysByHotel
      },
      trends: {
        usage: usageTrends,
        timeRange
      },
      activity: {
        recent: recentActivity,
        topUsers
      }
    }
  });
}));

// Get a specific digital key
router.get('/:keyId', catchAsync(async (req, res) => {
  const digitalKey = await DigitalKey.findOne({
    _id: req.params.keyId,
    $or: [
      { userId: req.user.id },
      { 'sharedWith.userId': req.user.id, 'sharedWith.isActive': true }
    ]
  })
  .populate('bookingId', 'bookingNumber checkIn checkOut')
  .populate('roomId', 'number type floor')
  .populate('hotelId', 'name address')
  .populate('sharedWith.userId', 'name email');
  
  if (!digitalKey) {
    throw new ApplicationError('Digital key not found', 404);
  }
  
  res.json({
    success: true,
    data: digitalKey
  });
}));

// Validate a digital key (for door access)
router.post('/validate/:keyCode', catchAsync(async (req, res) => {
  const { keyCode } = req.params;
  const { pin, deviceInfo = {} } = req.body;
  
  const digitalKey = await DigitalKey.findByKeyCode(keyCode);
  
  if (!digitalKey) {
    throw new ApplicationError('Invalid key code', 404);
  }
  
  if (!digitalKey.canBeUsed) {
    throw new ApplicationError('Key is not valid or has expired', 400);
  }
  
  // Check PIN if required
  if (digitalKey.securitySettings.requirePin) {
    if (!pin) {
      throw new ApplicationError('PIN is required', 400);
    }
    if (digitalKey.securitySettings.pin !== pin) {
      throw new ApplicationError('Invalid PIN', 400);
    }
  }
  
  // Use the key
  await digitalKey.useKey(req.user.id, {
    userAgent: req.get('User-Agent'),
    ipAddress: req.ip,
    ...deviceInfo
  });
  
  res.json({
    success: true,
    message: 'Key validated successfully',
    data: {
      keyId: digitalKey._id,
      roomNumber: digitalKey.roomId.number,
      hotelName: digitalKey.hotelId.name,
      remainingUses: digitalKey.remainingUses,
      validUntil: digitalKey.validUntil
    }
  });
}));

// Share a digital key
router.post('/:keyId/share', validate(schemas.shareDigitalKey), catchAsync(async (req, res) => {
  const { keyId } = req.params;
  const { email, name, expiresAt } = req.body;
  
  const digitalKey = await DigitalKey.findOne({
    _id: keyId,
    userId: req.user.id
  });
  
  if (!digitalKey) {
    throw new ApplicationError('Digital key not found', 404);
  }
  
  if (!digitalKey.canBeShared) {
    throw new ApplicationError('This key cannot be shared', 400);
  }
  
  // Find user by email if provided
  let sharedUserId = null;
  if (email) {
    const sharedUser = await User.findOne({ email });
    if (sharedUser) {
      sharedUserId = sharedUser._id;
    }
  }
  
  const shareData = {
    userId: sharedUserId,
    email,
    name,
    expiresAt: expiresAt ? new Date(expiresAt) : undefined
  };
  
  await digitalKey.shareWithUser(shareData);
  
  res.json({
    success: true,
    message: 'Key shared successfully',
    data: {
      keyId: digitalKey._id,
      sharedWith: shareData
    }
  });
}));

// Revoke a shared key
router.delete('/:keyId/share/:userIdOrEmail', catchAsync(async (req, res) => {
  const { keyId, userIdOrEmail } = req.params;
  
  const digitalKey = await DigitalKey.findOne({
    _id: keyId,
    userId: req.user.id
  });
  
  if (!digitalKey) {
    throw new ApplicationError('Digital key not found', 404);
  }
  
  await digitalKey.revokeShare(userIdOrEmail);
  
  res.json({
    success: true,
    message: 'Key access revoked successfully'
  });
}));

// Get access logs for a digital key
router.get('/:keyId/logs', catchAsync(async (req, res) => {
  const { keyId } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const skip = (page - 1) * limit;
  
  const digitalKey = await DigitalKey.findOne({
    _id: keyId,
    userId: req.user.id
  }).populate('accessLogs.userId', 'name email');
  
  if (!digitalKey) {
    throw new ApplicationError('Digital key not found', 404);
  }
  
  const logs = digitalKey.accessLogs
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(skip, skip + parseInt(limit));
  
  res.json({
    success: true,
    data: {
      logs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(digitalKey.accessLogs.length / limit),
        totalItems: digitalKey.accessLogs.length,
        hasNext: skip + logs.length < digitalKey.accessLogs.length,
        hasPrev: page > 1
      }
    }
  });
}));

// Revoke a digital key
router.delete('/:keyId', catchAsync(async (req, res) => {
  const { keyId } = req.params;
  
  const digitalKey = await DigitalKey.findOne({
    _id: keyId,
    userId: req.user.id
  });
  
  if (!digitalKey) {
    throw new ApplicationError('Digital key not found', 404);
  }
  
  await digitalKey.revokeKey();
  
  res.json({
    success: true,
    message: 'Digital key revoked successfully'
  });
}));

// Get key statistics
router.get('/stats/overview', catchAsync(async (req, res) => {
  const userId = req.user.id;
  
  const [
    totalKeys,
    activeKeys,
    expiredKeys,
    sharedKeys,
    totalUses,
    recentActivity
  ] = await Promise.all([
    DigitalKey.countDocuments({ userId }),
    DigitalKey.countDocuments({ 
      userId, 
      status: 'active',
      validUntil: { $gt: new Date() }
    }),
    DigitalKey.countDocuments({ 
      userId, 
      status: 'expired'
    }),
    DigitalKey.countDocuments({
      'sharedWith.userId': userId,
      'sharedWith.isActive': true,
      status: 'active',
      validUntil: { $gt: new Date() }
    }),
    DigitalKey.aggregate([
      { $match: { userId: req.user._id } },
      { $group: { _id: null, total: { $sum: '$currentUses' } } }
    ]),
    DigitalKey.aggregate([
      { $match: { userId: req.user._id } },
      { $unwind: '$accessLogs' },
      { $sort: { 'accessLogs.timestamp': -1 } },
      { $limit: 10 },
      { $project: {
        keyId: '$_id',
        action: '$accessLogs.action',
        timestamp: '$accessLogs.timestamp',
        deviceInfo: '$accessLogs.deviceInfo'
      }}
    ])
  ]);
  
  res.json({
    success: true,
    data: {
      totalKeys,
      activeKeys,
      expiredKeys,
      sharedKeys,
      totalUses: totalUses[0]?.total || 0,
      recentActivity
    }
  });
}));

// Get admin activity logs for all digital keys
router.get('/admin/activity-logs', authenticate, authorize(['admin']), catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 50,
    action,
    userId,
    timeRange = '30d'
  } = req.query;

  const skip = (page - 1) * limit;

  // Calculate date range
  let startDate = new Date();
  switch (timeRange) {
    case '1d':
      startDate.setDate(startDate.getDate() - 1);
      break;
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(startDate.getDate() - 90);
      break;
    default:
      startDate.setDate(startDate.getDate() - 30);
  }

  // Build match conditions for aggregation
  const matchConditions = {
    'accessLogs.timestamp': { $gte: startDate }
  };

  if (action) {
    matchConditions['accessLogs.action'] = action;
  }

  if (userId) {
    matchConditions['accessLogs.userId'] = new mongoose.Types.ObjectId(userId);
  }

  // Aggregate all access logs from all digital keys
  const pipeline = [
    { $unwind: '$accessLogs' },
    { $match: matchConditions },
    {
      $lookup: {
        from: 'users',
        localField: 'accessLogs.userId',
        foreignField: '_id',
        as: 'actorUser'
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'keyOwner'
      }
    },
    {
      $lookup: {
        from: 'rooms',
        localField: 'roomId',
        foreignField: '_id',
        as: 'room'
      }
    },
    {
      $lookup: {
        from: 'hotels',
        localField: 'hotelId',
        foreignField: '_id',
        as: 'hotel'
      }
    },
    {
      $project: {
        _id: '$accessLogs._id',
        keyId: '$_id',
        keyCode: '$keyCode',
        keyType: '$type',
        keyStatus: '$status',
        action: '$accessLogs.action',
        timestamp: '$accessLogs.timestamp',
        deviceInfo: '$accessLogs.deviceInfo',
        actor: {
          _id: { $arrayElemAt: ['$actorUser._id', 0] },
          name: { $arrayElemAt: ['$actorUser.name', 0] },
          email: { $arrayElemAt: ['$actorUser.email', 0] },
          role: { $arrayElemAt: ['$actorUser.role', 0] }
        },
        keyOwner: {
          _id: { $arrayElemAt: ['$keyOwner._id', 0] },
          name: { $arrayElemAt: ['$keyOwner.name', 0] },
          email: { $arrayElemAt: ['$keyOwner.email', 0] }
        },
        room: {
          _id: { $arrayElemAt: ['$room._id', 0] },
          roomNumber: { $arrayElemAt: ['$room.roomNumber', 0] },
          floor: { $arrayElemAt: ['$room.floor', 0] }
        },
        hotel: {
          _id: { $arrayElemAt: ['$hotel._id', 0] },
          name: { $arrayElemAt: ['$hotel.name', 0] }
        }
      }
    },
    { $sort: { timestamp: -1 } }
  ];

  // Get paginated results
  const [logs, total] = await Promise.all([
    DigitalKey.aggregate([
      ...pipeline,
      { $skip: skip },
      { $limit: parseInt(limit) }
    ]),
    DigitalKey.aggregate([
      ...pipeline,
      { $count: 'total' }
    ])
  ]);

  const totalCount = total[0]?.total || 0;

  res.json({
    success: true,
    data: {
      logs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        hasNext: skip + logs.length < totalCount,
        hasPrev: page > 1
      }
    }
  });
}));

// Export admin digital keys data
router.get('/admin/export', authenticate, authorize(['admin']), catchAsync(async (req, res) => {
  const {
    status,
    type,
    hotel,
    format = 'csv'
  } = req.query;

  // Build query filters
  const filters = {};
  if (status && status !== 'all') filters.status = status;
  if (type && type !== 'all') filters.type = type;
  if (hotel && hotel !== 'all') filters.hotelId = hotel;

  // Get all matching keys with populated data
  const keys = await DigitalKey.find(filters)
    .populate('userId', 'name email')
    .populate('roomId', 'roomNumber floor type')
    .populate('hotelId', 'name')
    .populate('bookingId', 'bookingNumber')
    .sort({ createdAt: -1 });

  // Prepare data for export
  const exportData = keys.map(key => ({
    'Key Code': key.keyCode,
    'Key Type': key.type,
    'Status': key.status,
    'Owner Name': key.userId?.name || 'N/A',
    'Owner Email': key.userId?.email || 'N/A',
    'Room Number': key.roomId?.roomNumber || 'N/A',
    'Floor': key.roomId?.floor || 'N/A',
    'Room Type': key.roomId?.type || 'N/A',
    'Hotel': key.hotelId?.name || 'N/A',
    'Booking Number': key.bookingId?.bookingNumber || 'N/A',
    'Valid From': key.validFrom ? key.validFrom.toISOString() : 'N/A',
    'Valid Until': key.validUntil ? key.validUntil.toISOString() : 'N/A',
    'Max Uses': key.maxUses === -1 ? 'Unlimited' : key.maxUses,
    'Current Uses': key.currentUses || 0,
    'Last Used': key.lastUsedAt ? key.lastUsedAt.toISOString() : 'Never',
    'Shared Count': key.sharedWith?.length || 0,
    'Access Logs Count': key.accessLogs?.length || 0,
    'Requires PIN': key.securitySettings?.requirePin ? 'Yes' : 'No',
    'Sharing Allowed': key.securitySettings?.allowSharing ? 'Yes' : 'No',
    'Created Date': key.createdAt.toISOString(),
    'Updated Date': key.updatedAt.toISOString()
  }));

  if (format === 'csv') {
    // Generate CSV
    const headers = Object.keys(exportData[0] || {});
    const csvContent = [
      headers.join(','),
      ...exportData.map(row =>
        headers.map(header => {
          const value = row[header];
          // Escape commas and quotes in CSV
          return typeof value === 'string' && (value.includes(',') || value.includes('"'))
            ? `"${value.replace(/"/g, '""')}"`
            : value;
        }).join(',')
      )
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="digital-keys-export-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
  } else {
    // For Excel format, we'll send JSON that can be processed client-side
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="digital-keys-export-${new Date().toISOString().split('T')[0]}.json"`);
    res.json({
      exportDate: new Date().toISOString(),
      totalRecords: exportData.length,
      filters: { status, type, hotel },
      data: exportData
    });
  }
}));

export default router;
