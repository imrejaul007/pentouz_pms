import express from 'express';
import { body } from 'express-validator';
import waitingListController from '../controllers/waitingListController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Validation middleware for creating waiting list entry
const validateWaitingListEntry = [
  body('guestName')
    .notEmpty()
    .withMessage('Guest name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Guest name must be between 2 and 100 characters'),

  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),

  body('roomType')
    .notEmpty()
    .withMessage('Room type is required')
    .isIn(['Standard Room', 'Deluxe Room', 'Executive Room', 'Deluxe Suite', 'Presidential Suite'])
    .withMessage('Invalid room type'),

  body('preferredDates.checkIn')
    .isISO8601()
    .withMessage('Check-in date must be a valid date')
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error('Check-in date must be in the future');
      }
      return true;
    }),

  body('preferredDates.checkOut')
    .isISO8601()
    .withMessage('Check-out date must be a valid date')
    .custom((value, { req }) => {
      const checkIn = new Date(req.body.preferredDates.checkIn);
      const checkOut = new Date(value);
      if (checkOut <= checkIn) {
        throw new Error('Check-out date must be after check-in date');
      }
      return true;
    }),

  body('guests')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Number of guests must be between 1 and 10'),

  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Invalid priority level'),

  body('contactPreference')
    .optional()
    .isIn(['email', 'phone', 'sms'])
    .withMessage('Invalid contact preference'),

  body('maxRate')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Max rate must be a positive number'),

  body('source')
    .optional()
    .isIn(['direct', 'booking.com', 'expedia', 'agoda', 'website', 'phone', 'walk_in'])
    .withMessage('Invalid source')
];

const validateStatusUpdate = [
  body('status')
    .isIn(['active', 'contacted', 'confirmed', 'expired', 'cancelled'])
    .withMessage('Invalid status'),

  body('note')
    .optional()
    .isLength({ min: 1, max: 500 })
    .withMessage('Note must be between 1 and 500 characters')
];

const validatePriorityUpdate = [
  body('priority')
    .isIn(['low', 'medium', 'high'])
    .withMessage('Invalid priority level')
];

const validateNoteAdd = [
  body('content')
    .notEmpty()
    .withMessage('Note content is required')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Note must be between 1 and 1000 characters'),

  body('isInternal')
    .optional()
    .isBoolean()
    .withMessage('isInternal must be a boolean')
];

const validateContactRecord = [
  body('method')
    .isIn(['email', 'phone', 'sms', 'in_person'])
    .withMessage('Invalid contact method'),

  body('message')
    .notEmpty()
    .withMessage('Contact message is required')
    .isLength({ min: 1, max: 500 })
    .withMessage('Message must be between 1 and 500 characters')
];

// Apply authentication to all routes
router.use(authenticate);

// Get all waiting list entries with filters
router.get('/',
  authorize(['admin', 'manager', 'staff']),
  waitingListController.getWaitingList
);

// Get room availability
router.get('/room-availability',
  authorize(['admin', 'manager', 'staff']),
  waitingListController.getRoomAvailability
);

// Get waitlist statistics
router.get('/stats',
  authorize(['admin', 'manager', 'staff']),
  waitingListController.getWaitlistStats
);

// Get single waiting list entry
router.get('/:id',
  authorize(['admin', 'manager', 'staff']),
  waitingListController.getWaitingListEntry
);

// Create new waiting list entry
router.post('/',
  authorize(['admin', 'manager', 'staff']),
  validateWaitingListEntry,
  waitingListController.createWaitingListEntry
);

// Update waiting list entry
router.put('/:id',
  authorize(['admin', 'manager', 'staff']),
  validateWaitingListEntry,
  waitingListController.updateWaitingListEntry
);

// Update entry status
router.patch('/:id/status',
  authorize(['admin', 'manager', 'staff']),
  validateStatusUpdate,
  waitingListController.updateStatus
);

// Update entry priority
router.patch('/:id/priority',
  authorize(['admin', 'manager', 'staff']),
  validatePriorityUpdate,
  waitingListController.updatePriority
);

// Add note to entry
router.post('/:id/notes',
  authorize(['admin', 'manager', 'staff']),
  validateNoteAdd,
  waitingListController.addNote
);

// Record contact with guest
router.post('/:id/contact',
  authorize(['admin', 'manager', 'staff']),
  validateContactRecord,
  waitingListController.recordContact
);

// Send availability notification
router.post('/:id/notify',
  authorize(['admin', 'manager', 'staff']),
  body('message').optional().isLength({ min: 1, max: 500 }),
  waitingListController.sendAvailabilityNotification
);

// Delete waiting list entry
router.delete('/:id',
  authorize(['admin', 'manager']),
  waitingListController.deleteWaitingListEntry
);

export default router;