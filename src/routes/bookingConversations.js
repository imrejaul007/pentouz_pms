import express from 'express';
import mongoose from 'mongoose';
import BookingConversation from '../models/BookingConversation.js';
import Booking from '../models/Booking.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import websocketService from '../services/websocketService.js';

const router = express.Router();

/**
 * @swagger
 * /booking-conversations:
 *   post:
 *     summary: Create a new booking conversation
 *     tags: [Booking Conversations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bookingId
 *               - subject
 *               - initialMessage
 *             properties:
 *               bookingId:
 *                 type: string
 *               subject:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum: [booking_modification, general_inquiry, complaint, compliment, special_request, billing_question, service_request]
 *               priority:
 *                 type: string
 *                 enum: [low, normal, high, urgent]
 *               initialMessage:
 *                 type: string
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Conversation created successfully
 */
router.post('/', authenticate, catchAsync(async (req, res) => {
  const {
    bookingId,
    subject,
    category = 'general_inquiry',
    priority = 'normal',
    initialMessage,
    attachments = []
  } = req.body;

  // Verify booking exists and user has access
  const booking = await Booking.findById(bookingId).populate('hotelId userId');
  if (!booking) {
    throw new ApplicationError('Booking not found', 404);
  }

  // Check if user has permission to create conversation for this booking
  const canCreate =
    req.user.role === 'admin' ||
    (req.user.role === 'staff' && booking.hotelId._id.toString() === req.user.hotelId.toString()) ||
    (req.user.role === 'guest' && booking.userId._id.toString() === req.user._id.toString());

  if (!canCreate) {
    throw new ApplicationError('You do not have permission to create a conversation for this booking', 403);
  }

  // Create conversation with initial participants
  const participants = [
    {
      userId: req.user._id,
      role: req.user.role,
      name: req.user.name,
      joinedAt: new Date(),
      lastSeenAt: new Date(),
      isActive: true
    }
  ];

  // If guest is creating conversation, add hotel staff
  if (req.user.role === 'guest') {
    // Find available staff members for auto-assignment
    const User = mongoose.model('User');
    const staffMembers = await User.find({
      hotelId: booking.hotelId._id,
      role: 'staff',
      isActive: true
    }).select('_id name email').limit(1);

    if (staffMembers.length > 0) {
      participants.push({
        userId: staffMembers[0]._id,
        role: 'staff',
        name: staffMembers[0].name,
        joinedAt: new Date(),
        lastSeenAt: new Date(),
        isActive: true
      });
    }
  } else {
    // If staff/admin is creating, add the guest
    participants.push({
      userId: booking.userId._id,
      role: 'guest',
      name: booking.userId.name,
      joinedAt: new Date(),
      lastSeenAt: new Date(),
      isActive: true
    });
  }

  const conversation = await BookingConversation.create({
    hotelId: booking.hotelId._id,
    bookingId: booking._id,
    participants,
    subject,
    category,
    priority,
    status: 'active',
    metadata: {
      initiatedBy: {
        userId: req.user._id,
        role: req.user.role
      },
      bookingSnapshot: {
        bookingNumber: booking.bookingNumber,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        roomType: booking.roomType,
        totalAmount: booking.totalAmount,
        currency: booking.currency,
        guestDetails: booking.guestDetails
      }
    },
    messages: [{
      sender: {
        userId: req.user._id,
        role: req.user.role,
        name: req.user.name
      },
      messageType: 'text',
      content: initialMessage,
      attachments,
      status: 'sent',
      sentAt: new Date()
    }]
  });

  await conversation.populate([
    { path: 'bookingId', select: 'bookingNumber checkIn checkOut' },
    { path: 'participants.userId', select: 'name email role' }
  ]);

  // Send real-time notifications
  try {
    // Notify all participants except the sender
    participants.forEach(async (participant) => {
      if (participant.userId.toString() !== req.user._id.toString()) {
        await websocketService.sendToUser(participant.userId.toString(), 'conversation:created', {
          conversation,
          newMessage: conversation.messages[0]
        });
      }
    });

    // Notify hotel staff about new conversation
    await websocketService.broadcastToHotel(booking.hotelId._id, 'conversation:created', conversation);

  } catch (wsError) {
    console.warn('Failed to send real-time conversation notifications:', wsError.message);
  }

  res.status(201).json({
    status: 'success',
    data: { conversation }
  });
}));

/**
 * @swagger
 * /booking-conversations:
 *   get:
 *     summary: Get conversations for the authenticated user
 *     tags: [Booking Conversations]
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
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *       - in: query
 *         name: bookingId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of conversations
 */
router.get('/', authenticate, catchAsync(async (req, res) => {
  const filters = {
    ...req.query,
    hotelId: req.user.hotelId // For admin/staff users
  };

  const result = await BookingConversation.getForUser(req.user._id, req.user.role, filters);

  res.json({
    status: 'success',
    data: result
  });
}));

/**
 * @swagger
 * /booking-conversations/{id}:
 *   get:
 *     summary: Get a specific conversation
 *     tags: [Booking Conversations]
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
 *         description: Conversation details
 */
router.get('/:id', authenticate, catchAsync(async (req, res) => {
  const conversation = await BookingConversation.findById(req.params.id)
    .populate('bookingId', 'bookingNumber checkIn checkOut rooms totalAmount currency')
    .populate('participants.userId', 'name email role')
    .populate('metadata.assignedTo.userId', 'name email')
    .populate('metadata.assignedBy', 'name email');

  if (!conversation) {
    throw new ApplicationError('Conversation not found', 404);
  }

  // Check if user has access to this conversation
  const isParticipant = conversation.participants.some(p =>
    p.userId._id.toString() === req.user._id.toString()
  );

  const isAuthorized =
    isParticipant ||
    req.user.role === 'admin' ||
    (req.user.role === 'staff' && conversation.hotelId.toString() === req.user.hotelId.toString());

  if (!isAuthorized) {
    throw new ApplicationError('You do not have access to this conversation', 403);
  }

  res.json({
    status: 'success',
    data: { conversation }
  });
}));

/**
 * @swagger
 * /booking-conversations/{id}/messages:
 *   post:
 *     summary: Add a message to a conversation
 *     tags: [Booking Conversations]
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
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *               messageType:
 *                 type: string
 *                 enum: [text, attachment, modification_request, modification_response]
 *               attachments:
 *                 type: array
 *               relatedData:
 *                 type: object
 *     responses:
 *       201:
 *         description: Message added successfully
 */
router.post('/:id/messages', authenticate, catchAsync(async (req, res) => {
  const {
    content,
    messageType = 'text',
    attachments = [],
    relatedData = {}
  } = req.body;

  const conversation = await BookingConversation.findById(req.params.id)
    .populate('participants.userId', 'name email role');

  if (!conversation) {
    throw new ApplicationError('Conversation not found', 404);
  }

  // Check if user is a participant
  const isParticipant = conversation.participants.some(p =>
    p.userId._id.toString() === req.user._id.toString()
  );

  if (!isParticipant) {
    throw new ApplicationError('You are not a participant in this conversation', 403);
  }

  // Check if conversation is closed
  if (conversation.status === 'closed') {
    throw new ApplicationError('Cannot add messages to a closed conversation', 400);
  }

  // Add the message
  await conversation.addMessage({
    sender: {
      userId: req.user._id,
      role: req.user.role,
      name: req.user.name
    },
    messageType,
    content,
    attachments,
    relatedData
  });

  // Get the newly added message
  const newMessage = conversation.messages[conversation.messages.length - 1];

  // Send real-time notifications to other participants
  try {
    conversation.participants.forEach(async (participant) => {
      if (participant.userId._id.toString() !== req.user._id.toString()) {
        await websocketService.sendToUser(participant.userId._id.toString(), 'conversation:new_message', {
          conversationId: conversation._id,
          message: newMessage
        });
      }
    });

    // Notify hotel staff about new message
    await websocketService.broadcastToHotel(conversation.hotelId, 'conversation:new_message', {
      conversationId: conversation._id,
      message: newMessage
    });

  } catch (wsError) {
    console.warn('Failed to send real-time message notifications:', wsError.message);
  }

  res.status(201).json({
    status: 'success',
    data: {
      message: newMessage,
      conversationId: conversation._id
    }
  });
}));

/**
 * @swagger
 * /booking-conversations/{id}/read:
 *   patch:
 *     summary: Mark messages as read
 *     tags: [Booking Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               messageIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Messages marked as read
 */
router.patch('/:id/read', authenticate, catchAsync(async (req, res) => {
  const { messageIds } = req.body;

  const conversation = await BookingConversation.findById(req.params.id);

  if (!conversation) {
    throw new ApplicationError('Conversation not found', 404);
  }

  // Check if user is a participant
  const isParticipant = conversation.participants.some(p =>
    p.userId._id.toString() === req.user._id.toString()
  );

  if (!isParticipant) {
    throw new ApplicationError('You are not a participant in this conversation', 403);
  }

  await conversation.markAsRead(req.user._id, messageIds);

  res.json({
    status: 'success',
    message: 'Messages marked as read'
  });
}));

/**
 * @swagger
 * /booking-conversations/{id}/assign:
 *   patch:
 *     summary: Assign conversation to staff member
 *     tags: [Booking Conversations]
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
 *               - staffUserId
 *             properties:
 *               staffUserId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Conversation assigned successfully
 */
router.patch('/:id/assign', authenticate, authorize('staff', 'admin', 'manager'), catchAsync(async (req, res) => {
  const { staffUserId } = req.body;

  const conversation = await BookingConversation.findById(req.params.id);

  if (!conversation) {
    throw new ApplicationError('Conversation not found', 404);
  }

  // Verify staff user exists and belongs to the same hotel
  const User = mongoose.model('User');
  const staffUser = await User.findOne({
    _id: staffUserId,
    hotelId: conversation.hotelId,
    role: { $in: ['staff', 'admin', 'manager'] },
    isActive: true
  });

  if (!staffUser) {
    throw new ApplicationError('Staff member not found or not authorized', 404);
  }

  await conversation.assignTo(staffUserId, req.user._id);

  // Add system message about assignment
  await conversation.addSystemMessage(
    `Conversation assigned to ${staffUser.name}`,
    {
      systemAction: 'conversation_assigned',
      assignedTo: staffUserId,
      assignedBy: req.user._id
    }
  );

  // Notify the assigned staff member
  try {
    await websocketService.sendToUser(staffUserId.toString(), 'conversation:assigned', {
      conversationId: conversation._id,
      assignedBy: req.user.name
    });
  } catch (wsError) {
    console.warn('Failed to send assignment notification:', wsError.message);
  }

  res.json({
    status: 'success',
    message: 'Conversation assigned successfully'
  });
}));

/**
 * @swagger
 * /booking-conversations/{id}/status:
 *   patch:
 *     summary: Update conversation status
 *     tags: [Booking Conversations]
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, resolved, closed, escalated]
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Status updated successfully
 */
router.patch('/:id/status', authenticate, catchAsync(async (req, res) => {
  const { status, reason } = req.body;

  const conversation = await BookingConversation.findById(req.params.id);

  if (!conversation) {
    throw new ApplicationError('Conversation not found', 404);
  }

  // Check permissions
  const canUpdateStatus =
    req.user.role === 'admin' ||
    (req.user.role === 'staff' && conversation.hotelId.toString() === req.user.hotelId.toString()) ||
    (req.user.role === 'guest' && conversation.participants.some(p =>
      p.userId.toString() === req.user._id.toString()
    ) && status === 'closed');

  if (!canUpdateStatus) {
    throw new ApplicationError('You do not have permission to update this conversation status', 403);
  }

  const oldStatus = conversation.status;
  conversation.status = status;

  if (status === 'closed') {
    await conversation.closeConversation(req.user._id, reason || 'Conversation closed');
  } else if (status === 'escalated') {
    await conversation.escalate(req.user._id, reason || 'Conversation escalated');
  } else {
    await conversation.addSystemMessage(
      `Conversation status changed from ${oldStatus} to ${status}${reason ? `: ${reason}` : ''}`,
      {
        systemAction: 'status_changed',
        oldStatus,
        newStatus: status,
        changedBy: req.user._id
      }
    );
  }

  // Notify participants
  try {
    conversation.participants.forEach(async (participant) => {
      await websocketService.sendToUser(participant.userId.toString(), 'conversation:status_changed', {
        conversationId: conversation._id,
        oldStatus,
        newStatus: status,
        changedBy: req.user.name
      });
    });
  } catch (wsError) {
    console.warn('Failed to send status change notifications:', wsError.message);
  }

  res.json({
    status: 'success',
    message: 'Conversation status updated successfully'
  });
}));

/**
 * @swagger
 * /booking-conversations/stats:
 *   get:
 *     summary: Get conversation statistics
 *     tags: [Booking Conversations]
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
 *         description: Conversation statistics
 */
router.get('/stats', authenticate, authorize('staff', 'admin', 'manager'), catchAsync(async (req, res) => {
  const { hotelId, startDate, endDate } = req.query;

  let targetHotelId;
  if (req.user.role === 'staff') {
    targetHotelId = req.user.hotelId;
  } else {
    targetHotelId = hotelId || req.user.hotelId;
  }

  if (!targetHotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  const stats = await BookingConversation.getStats(targetHotelId, startDate, endDate);

  res.json({
    status: 'success',
    data: { stats }
  });
}));

export default router;
