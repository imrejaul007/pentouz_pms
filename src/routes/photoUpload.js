import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, authorize } from '../middleware/auth.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads', 'inventory-photos');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and random string
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const fileName = `inventory-${uniqueSuffix}${fileExtension}`;
    cb(null, fileName);
  }
});

// File filter to only allow images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new ApplicationError('Only JPEG, JPG, PNG, and WebP images are allowed', 400));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 10 // Maximum 10 files per request
  },
  fileFilter: fileFilter
});

// All routes require authentication
router.use(authenticate);

/**
 * Upload single photo for inventory documentation
 */
router.post('/upload', 
  authorize('staff', 'admin'),
  upload.single('photo'),
  catchAsync(async (req, res) => {
    const { roomId, itemId, description } = req.body;
    const { _id: uploadedBy, hotelId } = req.user;

    if (!req.file) {
      return res.status(400).json({
        status: 'fail',
        message: 'No photo uploaded'
      });
    }

    const photo = {
      id: req.file.filename,
      filename: req.file.filename,
      originalName: req.file.originalname,
      url: `/uploads/inventory-photos/${req.file.filename}`,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadedAt: new Date(),
      uploadedBy: uploadedBy,
      description: description || '',
      metadata: {
        roomId,
        itemId,
        hotelId
      }
    };

    res.status(201).json({
      status: 'success',
      data: photo
    });
  })
);

/**
 * Upload multiple photos for inventory documentation
 * Used by staff for damage documentation, daily checks, etc.
 */
router.post('/inventory', 
  authorize('staff', 'admin'),
  upload.array('photos', 10), // Accept up to 10 photos
  catchAsync(async (req, res) => {
    const { roomId, checkId, inspectionId, itemId, description } = req.body;
    const { _id: uploadedBy, hotelId } = req.user;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'No photos uploaded'
      });
    }

    // Process uploaded files
    const photos = req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      url: `/uploads/inventory-photos/${file.filename}`,
      size: file.size,
      mimetype: file.mimetype,
      uploadedAt: new Date(),
      uploadedBy: uploadedBy,
      description: description || '',
      metadata: {
        roomId,
        checkId,
        inspectionId,
        itemId,
        hotelId
      }
    }));

    // TODO: Save photo records to database if needed
    // You might want to create a Photo model to track uploads
    
    res.status(201).json({
      status: 'success',
      data: {
        photos: photos.map(photo => ({
          id: photo.filename, // Using filename as temporary ID
          url: photo.url,
          originalName: photo.originalName,
          uploadedAt: photo.uploadedAt,
          uploadedBy: photo.uploadedBy,
          description: photo.description,
          size: photo.size
        })),
        message: `Successfully uploaded ${photos.length} photo(s)`
      }
    });
  })
);

/**
 * Get uploaded photo by filename
 */
router.get('/inventory/:filename', 
  authenticate, 
  catchAsync(async (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(uploadsDir, filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        status: 'fail',
        message: 'Photo not found'
      });
    }

    // Validate filename format for security
    const allowedPattern = /^inventory-\d+-\d+\.(jpeg|jpg|png|webp)$/i;
    if (!allowedPattern.test(filename)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid filename format'
      });
    }

    // Set appropriate headers
    const ext = path.extname(filename).toLowerCase();
    const contentTypeMap = {
      '.jpeg': 'image/jpeg',
      '.jpg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp'
    };

    res.setHeader('Content-Type', contentTypeMap[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  })
);

/**
 * Delete uploaded photo
 */
router.delete('/inventory/:filename',
  authorize('staff', 'admin'),
  catchAsync(async (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(uploadsDir, filename);

    // Validate filename format for security
    const allowedPattern = /^inventory-\d+-\d+\.(jpeg|jpg|png|webp)$/i;
    if (!allowedPattern.test(filename)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid filename format'
      });
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        status: 'fail',
        message: 'Photo not found'
      });
    }

    try {
      // Delete the file
      fs.unlinkSync(filePath);
      
      // TODO: Remove photo record from database if tracked
      
      res.status(200).json({
        status: 'success',
        message: 'Photo deleted successfully'
      });
    } catch (error) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to delete photo'
      });
    }
  })
);

/**
 * Update photo description or metadata
 */
router.patch('/inventory/:filename',
  authorize('staff', 'admin'),
  catchAsync(async (req, res) => {
    const { filename } = req.params;
    const { description } = req.body;
    const filePath = path.join(uploadsDir, filename);

    // Validate filename format for security
    const allowedPattern = /^inventory-\d+-\d+\.(jpeg|jpg|png|webp)$/i;
    if (!allowedPattern.test(filename)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid filename format'
      });
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        status: 'fail',
        message: 'Photo not found'
      });
    }

    // TODO: Update photo record in database with new description
    // For now, just return success
    
    res.status(200).json({
      status: 'success',
      message: 'Photo updated successfully',
      data: {
        filename,
        description: description || '',
        updatedAt: new Date()
      }
    });
  })
);

/**
 * Bulk upload for multiple inventory items
 */
router.post('/inventory/bulk',
  authorize('staff', 'admin'),
  upload.array('photos', 50), // Higher limit for bulk operations
  catchAsync(async (req, res) => {
    const { metadata } = req.body; // JSON string with file-specific metadata
    const { _id: uploadedBy, hotelId } = req.user;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'No photos uploaded'
      });
    }

    let parsedMetadata = {};
    try {
      parsedMetadata = JSON.parse(metadata || '{}');
    } catch (error) {
      console.warn('Invalid metadata JSON:', error);
    }

    // Process uploaded files with individual metadata
    const photos = req.files.map((file, index) => {
      const fileMetadata = parsedMetadata[index] || {};
      
      return {
        filename: file.filename,
        originalName: file.originalname,
        url: `/uploads/inventory-photos/${file.filename}`,
        size: file.size,
        mimetype: file.mimetype,
        uploadedAt: new Date(),
        uploadedBy: uploadedBy,
        description: fileMetadata.description || '',
        metadata: {
          ...fileMetadata,
          hotelId,
          uploadType: 'bulk'
        }
      };
    });

    res.status(201).json({
      status: 'success',
      data: {
        photos: photos.map(photo => ({
          id: photo.filename,
          url: photo.url,
          originalName: photo.originalName,
          uploadedAt: photo.uploadedAt,
          description: photo.description,
          size: photo.size
        })),
        message: `Successfully uploaded ${photos.length} photo(s) in bulk`
      }
    });
  })
);

export default router;