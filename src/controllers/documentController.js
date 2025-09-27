import path from 'path';
import fs from 'fs';
import { ApplicationError } from '../middleware/errorHandler.js';
import Document from '../models/Document.js';
import DocumentRequirement from '../models/DocumentRequirement.js';
import User from '../models/User.js';
import Department from '../models/Department.js';
import Booking from '../models/Booking.js';

class DocumentController {
  /**
   * Upload a single document
   */
  async uploadDocument(req, res) {
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

    // Validate required fields
    if (!category || !documentType) {
      throw new ApplicationError('Category and document type are required', 400);
    }

    // Validate document against requirements
    await this.validateDocumentAgainstRequirements(
      hotelId,
      actualUserType,
      category,
      documentType,
      { departmentId, bookingId }
    );

    // Get client metadata
    const uploadMetadata = this.extractUploadMetadata(req);

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
      ...uploadMetadata,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : []
    };

    // Add context-specific fields
    if (actualUserType === 'guest' && bookingId) {
      await this.validateBookingAccess(userId, bookingId);
      documentData.bookingId = bookingId;
    }

    if (actualUserType === 'staff') {
      const validDepartmentId = await this.validateDepartmentAccess(userId, departmentId);
      documentData.departmentId = validDepartmentId;
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
    }, uploadMetadata.ipAddress, uploadMetadata.deviceInfo.userAgent);

    await document.save();

    // Send notifications if required
    await this.sendUploadNotifications(document);

    // Remove sensitive data from response
    const responseDoc = document.toJSON();

    return {
      status: 'success',
      data: {
        document: responseDoc,
        message: 'Document uploaded successfully'
      }
    };
  }

  /**
   * Upload multiple documents in bulk
   */
  async bulkUploadDocuments(req, res) {
    const { metadata } = req.body;
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

    const uploadMetadata = this.extractUploadMetadata(req);
    const uploadedDocuments = [];
    const errors = [];

    // Process each uploaded file
    for (let i = 0; i < req.files.length; i++) {
      try {
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
          ...uploadMetadata
        };

        // Add context-specific fields
        if (role === 'staff') {
          const validDepartmentId = await this.validateDepartmentAccess(
            userId,
            fileMetadata.departmentId
          );
          documentData.departmentId = validDepartmentId;
        } else if (fileMetadata.bookingId) {
          await this.validateBookingAccess(userId, fileMetadata.bookingId);
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
        }, uploadMetadata.ipAddress, uploadMetadata.deviceInfo.userAgent);

        await document.save();
        uploadedDocuments.push(document.toJSON());
      } catch (error) {
        errors.push({
          fileIndex: i,
          filename: req.files[i]?.originalname || `File ${i}`,
          error: error.message
        });
      }
    }

    return {
      status: uploadedDocuments.length > 0 ? 'success' : 'error',
      data: {
        documents: uploadedDocuments,
        errors,
        message: `Successfully uploaded ${uploadedDocuments.length} document(s)${errors.length > 0 ? ` with ${errors.length} error(s)` : ''}`
      }
    };
  }

  /**
   * Get user's documents with filtering
   */
  async getUserDocuments(req, res) {
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

    return {
      status: 'success',
      results: documents.length,
      data: { documents }
    };
  }

  /**
   * Get specific document details
   */
  async getDocumentById(req, res) {
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

    return {
      status: 'success',
      data: { document }
    };
  }

  /**
   * Download document file
   */
  async downloadDocument(req, res) {
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

    return {
      filePath,
      contentType: contentTypeMap[ext] || 'application/octet-stream',
      originalName: document.originalName
    };
  }

  /**
   * Verify a document (Admin only)
   */
  async verifyDocument(req, res) {
    const { comments, confidenceLevel = 5 } = req.body;

    const document = await Document.findById(req.params.id);
    if (!document) {
      throw new ApplicationError('Document not found', 404);
    }

    if (document.status !== 'pending') {
      throw new ApplicationError('Only pending documents can be verified', 400);
    }

    await document.verify(req.user._id, comments, confidenceLevel);

    // Send verification notification
    await this.sendVerificationNotification(document, 'verified');

    return {
      status: 'success',
      data: {
        document,
        message: 'Document verified successfully'
      }
    };
  }

  /**
   * Reject a document (Admin only)
   */
  async rejectDocument(req, res) {
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

    // Send rejection notification
    await this.sendVerificationNotification(document, 'rejected');

    return {
      status: 'success',
      data: {
        document,
        message: 'Document rejected'
      }
    };
  }

  /**
   * Update document metadata
   */
  async updateDocument(req, res) {
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
    if (tags !== undefined) {
      document.tags = Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim());
    }
    if (category !== undefined && req.user.role === 'admin') document.category = category;
    if (documentType !== undefined && req.user.role === 'admin') document.documentType = documentType;
    if (expiryDate !== undefined && req.user.role === 'admin') {
      document.expiryDate = new Date(expiryDate);
    }

    document.updatedBy = req.user._id;

    // Add audit entry
    await document.addAuditEntry('update', req.user._id, {
      originalValues,
      newValues: { description, tags, category, documentType, expiryDate }
    }, req.ip, req.get('user-agent'));

    await document.save();

    return {
      status: 'success',
      data: {
        document,
        message: 'Document updated successfully'
      }
    };
  }

  /**
   * Delete a document (soft delete)
   */
  async deleteDocument(req, res) {
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

    return {
      status: 'success',
      message: 'Document deleted successfully'
    };
  }

  /**
   * Get staff member's documents (Admin only)
   */
  async getStaffDocuments(req, res) {
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

    return {
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
    };
  }

  /**
   * Get guest's documents (Admin only)
   */
  async getGuestDocuments(req, res) {
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

    return {
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
    };
  }

  /**
   * Get pending document verifications (Admin only)
   */
  async getPendingVerifications(req, res) {
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

    return {
      status: 'success',
      results: documents.length,
      data: { documents }
    };
  }

  /**
   * Get document requirements for user type
   */
  async getDocumentRequirements(req, res) {
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

    return {
      status: 'success',
      results: requirements.length,
      data: { requirements }
    };
  }

  /**
   * Get document compliance analytics (Admin only)
   */
  async getComplianceAnalytics(req, res) {
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

    // Get department-wise statistics if no specific department requested
    let departmentStats = [];
    if (!departmentId && userType === 'staff') {
      const departments = await Department.find({ hotelId: req.user.hotelId, status: 'active' });

      for (const dept of departments) {
        const deptStats = await Document.getComplianceStats(req.user.hotelId, {
          userType: 'staff',
          departmentId: dept._id,
          startDate,
          endDate
        });

        departmentStats.push({
          department: dept,
          stats: deptStats[0] || {}
        });
      }
    }

    return {
      status: 'success',
      data: {
        complianceStats: stats[0] || {},
        expiringDocuments,
        departmentStats,
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
    };
  }

  // Helper methods

  /**
   * Extract upload metadata from request
   */
  extractUploadMetadata(req) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const deviceInfo = {
      userAgent: req.get('user-agent'),
      platform: req.get('sec-ch-ua-platform'),
      browser: req.get('sec-ch-ua')
    };

    return { ipAddress, deviceInfo };
  }

  /**
   * Validate document against requirements
   */
  async validateDocumentAgainstRequirements(hotelId, userType, category, documentType, context) {
    const requirements = await DocumentRequirement.find({
      hotelId,
      userType,
      category,
      isActive: true
    });

    for (const requirement of requirements) {
      if (requirement.documentType === documentType ||
          requirement.alternativeTypes.includes(documentType)) {
        // Document matches requirement - could add additional validation here
        return true;
      }
    }

    // If no specific requirement found, allow upload but log it
    console.log(`No specific requirement found for ${userType} document: ${category}/${documentType}`);
    return true;
  }

  /**
   * Validate booking access for guest documents
   */
  async validateBookingAccess(userId, bookingId) {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new ApplicationError('Booking not found', 404);
    }

    if (booking.userId.toString() !== userId.toString()) {
      throw new ApplicationError('You can only upload documents for your own bookings', 403);
    }

    return booking;
  }

  /**
   * Validate department access for staff documents
   */
  async validateDepartmentAccess(userId, providedDepartmentId) {
    const user = await User.findById(userId);

    // Use provided department ID or user's default department
    const departmentId = providedDepartmentId || user.departmentId;

    if (!departmentId) {
      throw new ApplicationError('Department ID is required for staff documents', 400);
    }

    // Verify department exists
    const department = await Department.findById(departmentId);
    if (!department) {
      throw new ApplicationError('Department not found', 404);
    }

    // If a different department is provided, verify user has access
    if (providedDepartmentId && providedDepartmentId !== user.departmentId?.toString()) {
      if (user.role !== 'admin') {
        throw new ApplicationError('You can only upload documents to your own department', 403);
      }
    }

    return departmentId;
  }

  /**
   * Send upload notifications
   */
  async sendUploadNotifications(document) {
    // Implementation would depend on notification system
    // This could send emails, push notifications, etc.
    console.log(`Document uploaded notification for document ${document._id}`);
  }

  /**
   * Send verification notifications
   */
  async sendVerificationNotification(document, action) {
    // Implementation would depend on notification system
    console.log(`Document ${action} notification for document ${document._id}`);
  }
}

export default new DocumentController();