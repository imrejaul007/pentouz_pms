import multer from 'multer';
import path from 'path';
import fs from 'fs';
import guestImportService from '../services/guestImportService.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/guest-imports';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `guest-import-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  
  const allowedExtensions = ['.csv', '.xls', '.xlsx'];
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new ApplicationError('Only CSV and Excel files are allowed', 400), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Upload and validate file
export const uploadFile = catchAsync(async (req, res) => {
  if (!req.file) {
    throw new ApplicationError('No file uploaded', 400);
  }

  const filePath = req.file.path;
  const fileExtension = path.extname(req.file.originalname).toLowerCase();
  
  let results;
  
  try {
    if (fileExtension === '.csv') {
      results = await guestImportService.processCSVFile(filePath, {
        skipHeader: req.body.skipHeader !== 'false',
        delimiter: req.body.delimiter || ','
      });
    } else if (['.xls', '.xlsx'].includes(fileExtension)) {
      results = await guestImportService.processExcelFile(filePath, {
        skipHeader: req.body.skipHeader !== 'false',
        sheetName: req.body.sheetName || 0
      });
    } else {
      throw new ApplicationError('Unsupported file format', 400);
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({
      status: 'success',
      data: {
        totalRows: results.totalRows,
        validRows: results.results.length,
        errorRows: results.errors.length,
        preview: results.results.slice(0, 10), // First 10 rows for preview
        errors: results.errors.slice(0, 20), // First 20 errors
        hasMoreErrors: results.errors.length > 20
      }
    });
  } catch (error) {
    // Clean up uploaded file on error
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    throw error;
  }
});

// Process and import guests
export const importGuests = catchAsync(async (req, res) => {
  const { guestData, options = {} } = req.body;
  
  if (!Array.isArray(guestData) || guestData.length === 0) {
    throw new ApplicationError('Guest data is required', 400);
  }

  const results = await guestImportService.validateAndImportGuests(
    guestData,
    req.user.hotelId,
    req.user._id
  );

  res.json({
    status: 'success',
    data: {
      imported: results.imported,
      skipped: results.skipped,
      totalProcessed: guestData.length,
      errors: results.errors
    }
  });
});

// Get import template
export const getImportTemplate = catchAsync(async (req, res) => {
  const template = guestImportService.generateImportTemplate();
  
  res.json({
    status: 'success',
    data: { template }
  });
});

// Download import template as CSV
export const downloadTemplate = catchAsync(async (req, res) => {
  const template = guestImportService.generateImportTemplate();
  
  // Convert to CSV
  const headers = Object.keys(template[0]);
  const csvContent = [
    headers.join(','),
    ...template.map(row => headers.map(header => `"${row[header]}"`).join(','))
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=guest-import-template.csv');
  res.send(csvContent);
});

// Get import statistics
export const getImportStatistics = catchAsync(async (req, res) => {
  const { hotelId } = req.query;
  
  const stats = await guestImportService.getImportStatistics(hotelId || req.user.hotelId);
  
  res.json({
    status: 'success',
    data: stats
  });
});

// Validate guest data without importing
export const validateGuestData = catchAsync(async (req, res) => {
  const { guestData } = req.body;
  
  if (!Array.isArray(guestData) || guestData.length === 0) {
    throw new ApplicationError('Guest data is required', 400);
  }

  const results = {
    valid: [],
    invalid: [],
    duplicates: []
  };

  for (let i = 0; i < guestData.length; i++) {
    const guest = guestData[i];
    const lineNumber = i + 1;

    try {
      // Check for duplicates in the data
      const isDuplicate = results.valid.some(g => g.email === guest.email);
      if (isDuplicate) {
        results.duplicates.push({
          line: lineNumber,
          email: guest.email,
          error: 'Duplicate email in import data'
        });
        continue;
      }

      // Check for existing guest in database
      const User = (await import('../models/User.js')).default;
      const existingGuest = await User.findOne({
        email: guest.email,
        hotelId: req.user.hotelId
      });

      if (existingGuest) {
        results.duplicates.push({
          line: lineNumber,
          email: guest.email,
          error: 'Guest already exists in database'
        });
        continue;
      }

      // Validate guest data
      const processedRow = await guestImportService.processGuestRow(guest, lineNumber);
      
      if (processedRow.errors.length > 0) {
        results.invalid.push({
          line: lineNumber,
          data: guest,
          errors: processedRow.errors
        });
      } else {
        results.valid.push(processedRow.data);
      }
    } catch (error) {
      results.invalid.push({
        line: lineNumber,
        data: guest,
        errors: [{ error: error.message }]
      });
    }
  }

  res.json({
    status: 'success',
    data: {
      totalRows: guestData.length,
      validRows: results.valid.length,
      invalidRows: results.invalid.length,
      duplicateRows: results.duplicates.length,
      valid: results.valid.slice(0, 10), // Preview of valid data
      invalid: results.invalid.slice(0, 20), // Preview of invalid data
      duplicates: results.duplicates.slice(0, 20), // Preview of duplicates
      hasMoreInvalid: results.invalid.length > 20,
      hasMoreDuplicates: results.duplicates.length > 20
    }
  });
});

// Get supported file formats
export const getSupportedFormats = catchAsync(async (req, res) => {
  res.json({
    status: 'success',
    data: {
      supportedFormats: [
        {
          extension: '.csv',
          mimeType: 'text/csv',
          description: 'Comma Separated Values',
          maxSize: '10MB'
        },
        {
          extension: '.xlsx',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          description: 'Excel 2007+',
          maxSize: '10MB'
        },
        {
          extension: '.xls',
          mimeType: 'application/vnd.ms-excel',
          description: 'Excel 97-2003',
          maxSize: '10MB'
        }
      ],
      requiredFields: ['name', 'email'],
      optionalFields: [
        'phone', 'salutation', 'guestType', 'loyaltyTier', 
        'loyaltyPoints', 'bedType', 'floor', 'smoking', 'other'
      ],
      fieldMappings: {
        name: ['name', 'fullname', 'full name', 'guestname', 'guest name'],
        email: ['email', 'emailaddress', 'email address', 'e-mail'],
        phone: ['phone', 'phoneno', 'phone no', 'contact', 'mobile', 'telephone'],
        salutation: ['salutation', 'title', 'prefix', 'mr/mrs'],
        guestType: ['guesttype', 'guest type', 'type', 'category'],
        loyaltyTier: ['loyaltytier', 'loyalty tier', 'tier', 'level'],
        loyaltyPoints: ['loyaltypoints', 'loyalty points', 'points'],
        bedType: ['bedtype', 'bed type', 'bed'],
        floor: ['floor', 'preferredfloor', 'preferred floor'],
        smoking: ['smoking', 'smokingallowed', 'smoking allowed'],
        other: ['other', 'notes', 'preferences', 'comments']
      }
    }
  });
});

export default {
  upload,
  uploadFile,
  importGuests,
  getImportTemplate,
  downloadTemplate,
  getImportStatistics,
  validateGuestData,
  getSupportedFormats
};
