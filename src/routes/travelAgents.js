import express from 'express';
import {
  registerTravelAgent,
  getAllTravelAgents,
  getTravelAgentById,
  updateTravelAgent,
  updateTravelAgentStatus,
  getTravelAgentPerformance,
  getMyTravelAgentProfile,
  getMyBookings,
  validateAgentCode,
  exportBookings,
  generateCommissionReport,
  createBatchExport,
  getBookingTrends,
  getRevenueForecast,
  getPerformanceMetrics,
  downloadFile
} from '../controllers/travelAgentController.js';
import {
  createMultiBooking,
  getMultiBookingById,
  updateMultiBookingStatus,
  calculateBulkPricing,
  rollbackFailedBookings,
  getAgentMultiBookings,
  getMultiBookingAnalytics
} from '../controllers/multiBookingController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const registerTravelAgentSchema = Joi.object({
  userId: Joi.string().required(),
  agentCode: Joi.string().min(3).max(10).uppercase(),
  companyName: Joi.string().required().min(2).max(200),
  contactPerson: Joi.string().required().min(2).max(100),
  phone: Joi.string().required().pattern(/^\+?[\d\s-()]+$/),
  email: Joi.string().email().required(),
  address: Joi.object({
    street: Joi.string(),
    city: Joi.string(),
    state: Joi.string(),
    country: Joi.string(),
    zipCode: Joi.string()
  }),
  businessDetails: Joi.object({
    licenseNumber: Joi.string(),
    gstNumber: Joi.string(),
    establishedYear: Joi.number().min(1900).max(new Date().getFullYear()),
    businessType: Joi.string().valid('domestic', 'international', 'both')
  }),
  commissionStructure: Joi.object({
    defaultRate: Joi.number().min(0).max(50),
    roomTypeRates: Joi.array().items(Joi.object({
      roomTypeId: Joi.string(),
      commissionRate: Joi.number().min(0).max(50)
    })),
    seasonalRates: Joi.array().items(Joi.object({
      season: Joi.string().valid('peak', 'high', 'low', 'off'),
      commissionRate: Joi.number().min(0).max(50),
      validFrom: Joi.date(),
      validTo: Joi.date()
    }))
  }),
  bookingLimits: Joi.object({
    maxBookingsPerDay: Joi.number().min(1),
    maxRoomsPerBooking: Joi.number().min(1),
    maxAdvanceBookingDays: Joi.number().min(1)
  }),
  paymentTerms: Joi.object({
    creditLimit: Joi.number().min(0),
    paymentDueDays: Joi.number().min(1),
    preferredPaymentMethod: Joi.string().valid('bank_transfer', 'cheque', 'online', 'cash')
  }),
  hotelId: Joi.string()
});

const updateTravelAgentSchema = Joi.object({
  companyName: Joi.string().min(2).max(200),
  contactPerson: Joi.string().min(2).max(100),
  phone: Joi.string().pattern(/^\+?[\d\s-()]+$/),
  email: Joi.string().email(),
  address: Joi.object({
    street: Joi.string(),
    city: Joi.string(),
    state: Joi.string(),
    country: Joi.string(),
    zipCode: Joi.string()
  }),
  businessDetails: Joi.object({
    licenseNumber: Joi.string(),
    gstNumber: Joi.string(),
    establishedYear: Joi.number().min(1900).max(new Date().getFullYear()),
    businessType: Joi.string().valid('domestic', 'international', 'both')
  }),
  commissionStructure: Joi.object({
    defaultRate: Joi.number().min(0).max(50),
    roomTypeRates: Joi.array().items(Joi.object({
      roomTypeId: Joi.string(),
      commissionRate: Joi.number().min(0).max(50)
    })),
    seasonalRates: Joi.array().items(Joi.object({
      season: Joi.string().valid('peak', 'high', 'low', 'off'),
      commissionRate: Joi.number().min(0).max(50),
      validFrom: Joi.date(),
      validTo: Joi.date()
    }))
  }),
  bookingLimits: Joi.object({
    maxBookingsPerDay: Joi.number().min(1),
    maxRoomsPerBooking: Joi.number().min(1),
    maxAdvanceBookingDays: Joi.number().min(1)
  }),
  paymentTerms: Joi.object({
    creditLimit: Joi.number().min(0),
    paymentDueDays: Joi.number().min(1),
    preferredPaymentMethod: Joi.string().valid('bank_transfer', 'cheque', 'online', 'cash')
  }),
  notes: Joi.string().max(1000)
});

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'inactive', 'suspended', 'pending_approval').required(),
  reason: Joi.string().max(500)
});

// Public route for agent code validation (no auth required)
router.get('/validate-code/:code', validateAgentCode);

// Apply authentication to all other routes
router.use(authenticate);

// Travel agent specific routes
router.get('/me', getMyTravelAgentProfile);
router.get('/me/bookings', getMyBookings);

// Admin/Staff routes for managing travel agents
router.post('/',
  authorize('admin', 'manager'),
  validate(registerTravelAgentSchema),
  registerTravelAgent
);

router.get('/',
  authorize('admin', 'manager', 'staff'),
  getAllTravelAgents
);

router.get('/:id',
  authorize('admin', 'manager', 'staff', 'travel_agent'),
  getTravelAgentById
);

router.put('/:id',
  authorize('admin', 'manager', 'travel_agent'),
  validate(updateTravelAgentSchema),
  updateTravelAgent
);

router.patch('/:id/status',
  authorize('admin', 'manager'),
  validate(updateStatusSchema),
  updateTravelAgentStatus
);

router.get('/:id/performance',
  authorize('admin', 'manager', 'staff', 'travel_agent'),
  getTravelAgentPerformance
);

// Multi-booking routes
router.post('/multi-booking',
  authorize('admin', 'manager', 'travel_agent'),
  (req, res, next) => {
    // Custom validation for multi-booking
    const { error } = schemas.createMultiBooking.validate(req.body);
    
    if (error) {
      // For travel agents, don't require travelAgentId in request body
      if (req.user.role === 'travel_agent') {
        const filteredErrors = error.details.filter(detail => 
          !detail.path.includes('travelAgentId')
        );
        if (filteredErrors.length > 0) {
          const message = filteredErrors.map(detail => detail.message).join(', ');
          return next(new ApplicationError(message, 400));
        }
      } else {
        // For admin/manager, require travelAgentId
        const message = error.details.map(detail => detail.message).join(', ');
        return next(new ApplicationError(message, 400));
      }
    }
    
    next();
  },
  createMultiBooking
);

router.get('/multi-booking',
  authorize('admin', 'manager', 'staff', 'travel_agent'),
  getAgentMultiBookings
);

router.get('/multi-booking/analytics',
  authorize('admin', 'manager', 'staff'),
  getMultiBookingAnalytics
);

router.post('/multi-booking/calculate-pricing',
  authorize('admin', 'manager', 'travel_agent'),
  (req, res, next) => {
    // Custom validation for bulk pricing calculation
    const { error } = schemas.calculateBulkPricing.validate(req.body);
    
    if (error) {
      // For travel agents, don't require travelAgentId in request body
      if (req.user.role === 'travel_agent') {
        const filteredErrors = error.details.filter(detail => 
          !detail.path.includes('travelAgentId')
        );
        if (filteredErrors.length > 0) {
          const message = filteredErrors.map(detail => detail.message).join(', ');
          return next(new ApplicationError(message, 400));
        }
      } else {
        // For admin/manager, require travelAgentId
        const message = error.details.map(detail => detail.message).join(', ');
        return next(new ApplicationError(message, 400));
      }
    }
    
    next();
  },
  calculateBulkPricing
);

router.get('/multi-booking/:id',
  authorize('admin', 'manager', 'staff', 'travel_agent'),
  getMultiBookingById
);

router.patch('/multi-booking/:id/status',
  authorize('admin', 'manager'),
  validate(schemas.updateMultiBookingStatus),
  updateMultiBookingStatus
);

router.post('/multi-booking/:id/rollback',
  authorize('admin', 'manager'),
  validate(schemas.rollbackMultiBooking),
  rollbackFailedBookings
);

// Export routes
router.post('/export/bookings',
  authorize('admin', 'manager', 'staff', 'travel_agent'),
  exportBookings
);

router.post('/export/commission-report',
  authorize('admin', 'manager', 'staff', 'travel_agent'),
  generateCommissionReport
);

router.post('/export/batch',
  authorize('admin', 'manager', 'staff', 'travel_agent'),
  createBatchExport
);

// Analytics routes
router.get('/analytics/trends',
  authorize('admin', 'manager', 'staff', 'travel_agent'),
  getBookingTrends
);

router.get('/analytics/forecast',
  authorize('admin', 'manager', 'staff', 'travel_agent'),
  getRevenueForecast
);

router.get('/analytics/performance',
  authorize('admin', 'manager', 'staff', 'travel_agent'),
  getPerformanceMetrics
);

// Download route
router.get('/download/:filename',
  authorize('admin', 'manager', 'staff', 'travel_agent'),
  downloadFile
);

export default router;