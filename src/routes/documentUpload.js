import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, authorize } from '../middleware/auth.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import Document from '../models/Document.js';
import DocumentRequirement from '../models/DocumentRequirement.js';
import User from '../models/User.js';
import Department from '../models/Department.js';

const router = express.Router();

// Ensure uploads directory exists
const createUploadDirectories = () => {
  const baseDir = path.join(process.cwd(), 'uploads', 'documents');
  const dirs = [
    'guests',
    'staff',
    'guests/temp',
    'staff/temp'
  ];

  dirs.forEach(dir => {
    const fullPath = path.join(baseDir, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  });
};

createUploadDirectories();

// Enhanced storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { userType } = req.body;
    const { user } = req;

    // Determine user type from request or authenticated user
    const actualUserType = userType || (user.role === 'staff' ? 'staff' : 'guest');

    const baseDir = path.join(process.cwd(), 'uploads', 'documents');
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');

    let uploadDir;
    if (actualUserType === 'staff') {
      uploadDir = path.join(baseDir, 'staff', String(year), month, user._id.toString());
    } else {
      uploadDir = path.join(baseDir, 'guests', String(year), month, user._id.toString());
    }

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate secure filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const sanitizedOriginalName = file.originalname
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_');

    const fileName = `doc-${uniqueSuffix}-${sanitizedOriginalName}${fileExtension}`;
    cb(null, fileName);
  }
});

// Enhanced file filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApplicationError(
      `File type ${file.mimetype} is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
      400
    ));
  }
};

// Multer configuration
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10 // Maximum 10 files per request
  },
  fileFilter: fileFilter
});

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/v1/documents/upload:
 *   post:
 *     summary: Upload a document
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               document:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *               documentType:
 *                 type: string
 *               description:
 *                 type: string
 *               userType:
 *                 type: string
 *                 enum: [guest, staff]
 *               bookingId:
 *                 type: string
 *               departmentId:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *               expiryDate:
 *                 type: string
 *                 format: date
 */
router.post('/upload',
  upload.single('document'),
  catchAsync(async (req, res) => {
    const {
      category,
      documentType,
      description,
      userType,
      bookingId,
      departmentId,
      priority = 'medium',
      expiryDate,
      tags
    } = req.body;

    const { _id: userId, hotelId, role } = req.user;

    if (!req.file) {
      throw new ApplicationError('No document uploaded', 400);
    }

    // Validate user type
    const actualUserType = userType || (role === 'staff' ? 'staff' : 'guest');

    // Validate category and document type are provided
    if (!category || !documentType) {
      throw new ApplicationError('Category and document type are required', 400);
    }

    // Get client IP and device info
    const ipAddress = req.ip || req.connection.remoteAddress;
    const deviceInfo = {
      userAgent: req.get('user-agent'),
      platform: req.get('sec-ch-ua-platform'),
      browser: req.get('sec-ch-ua')
    };

    // Create document record
    const documentData = {
      userId,
      userType: actualUserType,
      hotelId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      filePath: req.file.path,
      category,
      documentType,
      description: description || '',
      priority,
      uploadedBy: userId,
      uploadSource: 'web',
      ipAddress,
      deviceInfo,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : []
    };

    // Add context-specific fields
    if (actualUserType === 'guest' && bookingId) {
      documentData.bookingId = bookingId;
    }

    if (actualUserType === 'staff') {
      // Use user's department or provided department ID
      documentData.departmentId = departmentId || req.user.departmentId;
    }

    if (expiryDate) {
      documentData.expiryDate = new Date(expiryDate);
    }

    const document = new Document(documentData);

    // Add initial audit entry
    await document.addAuditEntry('upload', userId, {
      originalName: req.file.originalname,
      fileSize: req.file.size,
      category,
      documentType
    }, ipAddress, req.get('user-agent'));

    await document.save();

    // Remove sensitive data from response
    const responseDoc = document.toJSON();
    delete responseDoc.filePath;

    res.status(201).json({
      status: 'success',
      data: {
        document: responseDoc,
        message: 'Document uploaded successfully'
      }
    });
  })
);

/**
 * @swagger
 * /api/v1/documents/bulk-upload:
 *   post:
 *     summary: Upload multiple documents
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 */
router.post('/bulk-upload',
  upload.array('documents', 10),
  catchAsync(async (req, res) => {
    const { metadata } = req.body; // JSON string with file-specific metadata
    const { _id: userId, hotelId, role } = req.user;

    if (!req.files || req.files.length === 0) {
      throw new ApplicationError('No documents uploaded', 400);
    }

    let parsedMetadata = {};
    try {
      parsedMetadata = JSON.parse(metadata || '{}');
    } catch (error) {
      throw new ApplicationError('Invalid metadata format', 400);
    }

    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');
    const uploadedDocuments = [];

    // Process each uploaded file
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const fileMetadata = parsedMetadata[i] || {};

      const documentData = {
        userId,
        userType: role === 'staff' ? 'staff' : 'guest',
        hotelId,
        filename: file.filename,
        originalName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        filePath: file.path,
        category: fileMetadata.category || 'identity_proof',
        documentType: fileMetadata.documentType || 'General Document',
        description: fileMetadata.description || '',
        priority: fileMetadata.priority || 'medium',
        uploadedBy: userId,
        uploadSource: 'web',
        ipAddress,
        deviceInfo: { userAgent }
      };

      // Add context-specific fields
      if (role === 'staff') {
        documentData.departmentId = fileMetadata.departmentId || req.user.departmentId;
      } else if (fileMetadata.bookingId) {
        documentData.bookingId = fileMetadata.bookingId;
      }

      if (fileMetadata.expiryDate) {
        documentData.expiryDate = new Date(fileMetadata.expiryDate);
      }

      const document = new Document(documentData);
      await document.addAuditEntry('upload', userId, {
        originalName: file.originalname,
        bulkUpload: true,
        fileIndex: i
      }, ipAddress, userAgent);

      await document.save();
      uploadedDocuments.push(document.toJSON());
    }

    res.status(201).json({
      status: 'success',
      data: {
        documents: uploadedDocuments,
        message: `Successfully uploaded ${uploadedDocuments.length} document(s)`
      }
    });
  })
);

/**
 * @swagger
 * /api/v1/documents:
 *   get:
 *     summary: Get user's documents
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', catchAsync(async (req, res) => {
  const {
    status,
    category,
    userType,
    limit = 50,
    skip = 0,
    sortBy = '-createdAt'
  } = req.query;

  const documents = await Document.getDocumentsByUser(req.user._id, {
    status,
    category,
    userType,
    limit: parseInt(limit),
    skip: parseInt(skip),
    sortBy
  });

  res.json({
    status: 'success',
    results: documents.length,
    data: { documents }
  });
}));

/**
 * @swagger
 * /api/v1/documents/{id}:
 *   get:
 *     summary: Get specific document details
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', catchAsync(async (req, res) => {
  const document = await Document.findById(req.params.id)
    .populate('userId', 'name email role')
    .populate('uploadedBy', 'name email')
    .populate('verificationDetails.verifiedBy', 'name email')
    .populate('departmentId', 'name code')
    .populate('bookingId', 'bookingNumber checkIn checkOut');

  if (!document) {
    throw new ApplicationError('Document not found', 404);
  }

  // Check if user can view this document
  if (!document.canBeViewedBy(req.user, req.user.departmentId)) {
    throw new ApplicationError('You do not have permission to view this document', 403);
  }

  // Log access
  await document.addAuditEntry('view', req.user._id, {
    viewedBy: req.user.name
  }, req.ip, req.get('user-agent'));

  res.json({
    status: 'success',
    data: { document }
  });
}));

/**
 * @swagger
 * /api/v1/documents/{id}/download:
 *   get:
 *     summary: Download document file
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id/download', catchAsync(async (req, res) => {
  const document = await Document.findById(req.params.id).select('+filePath');

  if (!document) {
    throw new ApplicationError('Document not found', 404);
  }

  // Check if user can view this document
  if (!document.canBeViewedBy(req.user, req.user.departmentId)) {
    throw new ApplicationError('You do not have permission to download this document', 403);
  }

  const filePath = document.filePath;

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    throw new ApplicationError('Document file not found', 404);
  }

  // Log download
  await document.addAuditEntry('download', req.user._id, {
    downloadedBy: req.user.name
  }, req.ip, req.get('user-agent'));

  // Set appropriate headers
  const ext = path.extname(document.originalName).toLowerCase();
  const contentTypeMap = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp'
  };

  res.setHeader('Content-Type', contentTypeMap[ext] || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${document.originalName}"`);
  res.setHeader('Cache-Control', 'private, no-cache');

  // Stream the file
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
}));

/**
 * @swagger
 * /api/v1/documents/{id}/verify:
 *   patch:
 *     summary: Verify a document (Admin only)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id/verify',
  authorize('admin', 'manager'),
  catchAsync(async (req, res) => {
    const { comments, confidenceLevel = 5 } = req.body;

    const document = await Document.findById(req.params.id);
    if (!document) {
      throw new ApplicationError('Document not found', 404);
    }

    if (document.status !== 'pending') {
      throw new ApplicationError('Only pending documents can be verified', 400);
    }

    await document.verify(req.user._id, comments, confidenceLevel);

    res.json({
      status: 'success',
      data: {
        document,
        message: 'Document verified successfully'
      }
    });
  })
);

/**
 * @swagger
 * /api/v1/documents/{id}/reject:
 *   patch:
 *     summary: Reject a document (Admin only)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id/reject',
  authorize('admin', 'manager'),
  catchAsync(async (req, res) => {
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      throw new ApplicationError('Rejection reason is required', 400);
    }

    const document = await Document.findById(req.params.id);
    if (!document) {
      throw new ApplicationError('Document not found', 404);
    }

    if (document.status !== 'pending') {
      throw new ApplicationError('Only pending documents can be rejected', 400);
    }

    await document.reject(req.user._id, rejectionReason);

    res.json({
      status: 'success',
      data: {
        document,
        message: 'Document rejected'
      }
    });
  })
);

/**
 * @swagger
 * /api/v1/documents/{id}:
 *   patch:
 *     summary: Update document metadata
 *     tags: [Documents]
 */
router.patch('/:id', catchAsync(async (req, res) => {
  const { description, tags, category, documentType, expiryDate } = req.body;

  const document = await Document.findById(req.params.id);
  if (!document) {
    throw new ApplicationError('Document not found', 404);
  }

  // Users can only update their own documents unless they're admin
  if (req.user.role !== 'admin' && document.userId.toString() !== req.user._id.toString()) {
    throw new ApplicationError('You can only update your own documents', 403);
  }

  // Store original values for audit
  const originalValues = {
    description: document.description,
    tags: document.tags,
    category: document.category,
    documentType: document.documentType,
    expiryDate: document.expiryDate
  };

  // Update allowed fields
  if (description !== undefined) document.description = description;
  if (tags !== undefined) document.tags = Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim());
  if (category !== undefined && req.user.role === 'admin') document.category = category;
  if (documentType !== undefined && req.user.role === 'admin') document.documentType = documentType;
  if (expiryDate !== undefined && req.user.role === 'admin') document.expiryDate = new Date(expiryDate);

  document.updatedBy = req.user._id;

  // Add audit entry
  await document.addAuditEntry('update', req.user._id, {
    originalValues,
    newValues: { description, tags, category, documentType, expiryDate }
  }, req.ip, req.get('user-agent'));

  await document.save();

  res.json({
    status: 'success',
    data: {
      document,
      message: 'Document updated successfully'
    }
  });
}));

/**
 * @swagger
 * /api/v1/documents/{id}:
 *   delete:
 *     summary: Delete a document
 *     tags: [Documents]
 */
router.delete('/:id', catchAsync(async (req, res) => {
  const document = await Document.findById(req.params.id);
  if (!document) {
    throw new ApplicationError('Document not found', 404);
  }

  // Users can only delete their own documents unless they're admin
  if (req.user.role !== 'admin' && document.userId.toString() !== req.user._id.toString()) {
    throw new ApplicationError('You can only delete your own documents', 403);
  }

  // Soft delete
  document.isDeleted = true;
  document.deletedAt = new Date();
  document.deletedBy = req.user._id;
  document.isActive = false;

  await document.addAuditEntry('delete', req.user._id, {
    deletedBy: req.user.name
  }, req.ip, req.get('user-agent'));

  await document.save();

  res.json({
    status: 'success',
    message: 'Document deleted successfully'
  });
}));

/**
 * @swagger
 * /api/v1/documents/staff/{staffId}:
 *   get:
 *     summary: Get staff member's documents (Admin only)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 */
router.get('/staff/:staffId',
  authorize('admin', 'manager'),
  catchAsync(async (req, res) => {
    const { staffId } = req.params;
    const { status, category, limit = 50, skip = 0 } = req.query;

    // Verify the user is actually a staff member
    const staffUser = await User.findById(staffId);
    if (!staffUser || staffUser.role !== 'staff') {
      throw new ApplicationError('Staff member not found', 404);
    }

    const documents = await Document.getDocumentsByUser(staffId, {
      userType: 'staff',
      status,
      category,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });

    res.json({
      status: 'success',
      results: documents.length,
      data: {
        documents,
        staffMember: {
          _id: staffUser._id,
          name: staffUser.name,
          email: staffUser.email,
          departmentId: staffUser.departmentId
        }
      }
    });
  })
);

/**
 * @swagger
 * /api/v1/documents/guest/{guestId}:
 *   get:
 *     summary: Get guest's documents (Admin only)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 */
router.get('/guest/:guestId',
  authorize('admin', 'staff'),
  catchAsync(async (req, res) => {
    const { guestId } = req.params;
    const { status, category, bookingId, limit = 50, skip = 0 } = req.query;

    // Verify the user exists
    const guestUser = await User.findById(guestId);
    if (!guestUser) {
      throw new ApplicationError('Guest not found', 404);
    }

    let query = {
      userType: 'guest',
      status,
      category,
      limit: parseInt(limit),
      skip: parseInt(skip)
    };

    if (bookingId) {
      query.bookingId = bookingId;
    }

    const documents = await Document.getDocumentsByUser(guestId, query);

    res.json({
      status: 'success',
      results: documents.length,
      data: {
        documents,
        guest: {
          _id: guestUser._id,
          name: guestUser.name,
          email: guestUser.email
        }
      }
    });
  })
);

/**
 * @swagger
 * /api/v1/documents/pending-verifications:
 *   get:
 *     summary: Get pending document verifications (Admin only)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 */
router.get('/pending-verifications',
  authorize('admin', 'manager'),
  catchAsync(async (req, res) => {
    const {
      userType,
      departmentId,
      priority,
      limit = 100,
      skip = 0
    } = req.query;

    const documents = await Document.getPendingVerifications(req.user.hotelId, {
      userType,
      departmentId,
      priority,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });

    res.json({
      status: 'success',
      results: documents.length,
      data: { documents }
    });
  })
);

/**
 * @swagger
 * /api/v1/documents/requirements/{userType}:
 *   get:
 *     summary: Get document requirements for user type
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 */
router.get('/requirements/:userType', catchAsync(async (req, res) => {
  const { userType } = req.params;
  const { departmentId, bookingType, mandatory } = req.query;

  if (!['guest', 'staff'].includes(userType)) {
    throw new ApplicationError('Invalid user type. Must be guest or staff', 400);
  }

  const additionalContext = {
    departmentId,
    bookingType,
    employmentType: req.query.employmentType,
    jobRole: req.query.jobRole
  };

  let requirements = await DocumentRequirement.getRequirementsForUser(
    req.user.hotelId,
    userType,
    additionalContext
  );

  // Filter applicable requirements
  requirements = requirements.filter(req => req.isApplicableForUser(
    { role: userType, departmentId, ...req.user },
    additionalContext
  ));

  // Filter by mandatory if requested
  if (mandatory === 'true') {
    requirements = requirements.filter(req => req.isMandatory);
  }

  res.json({
    status: 'success',
    results: requirements.length,
    data: { requirements }
  });
}));

/**
 * @swagger
 * /api/v1/documents/analytics/compliance:
 *   get:
 *     summary: Get document compliance analytics (Admin only)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 */
router.get('/analytics/compliance',
  authorize('admin', 'manager'),
  catchAsync(async (req, res) => {
    const {
      userType,
      departmentId,
      startDate,
      endDate
    } = req.query;

    const stats = await Document.getComplianceStats(req.user.hotelId, {
      userType,
      departmentId,
      startDate,
      endDate
    });

    // Get expiring documents
    const expiringDocuments = await Document.getExpiringDocuments(req.user.hotelId, 30);

    res.json({
      status: 'success',
      data: {
        complianceStats: stats[0] || {},
        expiringDocuments,
        summary: {
          totalExpiring: expiringDocuments.length,
          analysisPeriod: {
            startDate,
            endDate,
            userType,
            departmentId
          }
        }
      }
    });
  })
);

export default router;