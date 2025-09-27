import express from 'express';
import {
  getActiveWaitlist,
  createWaitlistEntry,
  processWaitlistMatches,
  getWaitlistAnalytics,
  handleMatchAction,
  addContactHistory,
  updateWaitlistEntry,
  findMatchCandidates,
  processExpiredEntries,
  getWaitlistEntry
} from '../controllers/waitlistController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateWaitlistEntry } from '../middleware/validation.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Public waitlist routes (guests can create entries)
router.post('/', validateWaitlistEntry, createWaitlistEntry);

// Staff-only routes
router.use(authorize('staff', 'manager', 'admin'));

// Get active waitlist with filtering and pagination
router.get('/', getActiveWaitlist);

// Get waitlist analytics
router.get('/analytics', getWaitlistAnalytics);

// Process matches for all waiting entries
router.post('/process-matches', processWaitlistMatches);

// Find match candidates for specific criteria
router.post('/find-candidates', findMatchCandidates);

// Process expired entries
router.post('/process-expired', processExpiredEntries);

// Get specific waitlist entry
router.get('/:id', getWaitlistEntry);

// Update waitlist entry status
router.patch('/:id', updateWaitlistEntry);

// Handle match actions (confirm, decline, contact)
router.post('/:id/match/:matchId/action', handleMatchAction);

// Add contact history
router.post('/:id/contact', addContactHistory);

export default router;