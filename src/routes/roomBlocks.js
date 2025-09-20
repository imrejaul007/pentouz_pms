import express from 'express';
import roomBlockController from '../controllers/roomBlockController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { body } from 'express-validator';

const router = express.Router();

// Validation middleware
const validateRoomBlock = [
  body('blockName')
    .notEmpty()
    .withMessage('Block name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Block name must be between 3 and 100 characters'),
  body('groupName')
    .notEmpty()
    .withMessage('Group name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Group name must be between 3 and 100 characters'),
  body('hotelId')
    .notEmpty()
    .withMessage('Hotel ID is required')
    .isMongoId()
    .withMessage('Invalid hotel ID'),
  body('eventType')
    .isIn(['conference', 'wedding', 'corporate_event', 'group_booking', 'convention', 'other'])
    .withMessage('Invalid event type'),
  body('startDate')
    .isISO8601()
    .withMessage('Invalid start date format'),
  body('endDate')
    .isISO8601()
    .withMessage('Invalid end date format'),
  body('roomIds')
    .isArray({ min: 1 })
    .withMessage('At least one room is required'),
  body('billingInstructions')
    .notEmpty()
    .withMessage('Billing instructions are required'),
  body('contactPerson.email')
    .optional()
    .isEmail()
    .withMessage('Invalid email format')
];

// Routes
router.post('/', 
  authenticate, 
  authorize(['admin', 'staff']), 
  validateRoomBlock, 
  roomBlockController.createRoomBlock
);

router.get('/', 
  authenticate, 
  authorize(['admin', 'staff']), 
  roomBlockController.getRoomBlocks
);

router.get('/stats', 
  authenticate, 
  authorize(['admin', 'staff']), 
  roomBlockController.getRoomBlockStats
);

router.get('/:id', 
  authenticate, 
  authorize(['admin', 'staff']), 
  roomBlockController.getRoomBlock
);

router.put('/:id', 
  authenticate, 
  authorize(['admin', 'staff']), 
  roomBlockController.updateRoomBlock
);

router.post('/:id/rooms/:roomId/release', 
  authenticate, 
  authorize(['admin', 'staff']), 
  roomBlockController.releaseRoom
);

router.post('/:id/rooms/:roomId/book', 
  authenticate, 
  authorize(['admin', 'staff']), 
  roomBlockController.bookRoom
);

router.post('/:id/notes', 
  authenticate, 
  authorize(['admin', 'staff']), 
  roomBlockController.addNote
);

export default router;