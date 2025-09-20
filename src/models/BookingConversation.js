import mongoose from 'mongoose';

/**
 * BookingConversation - Thread-based communication system for booking-related discussions
 * between guests and hotel staff
 */

const messageSchema = new mongoose.Schema({
  messageId: {
    type: String,
    unique: true,
    required: true
  },
  sender: {
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['guest', 'staff', 'admin', 'manager'],
      required: true
    },
    name: {
      type: String,
      required: true
    }
  },
  messageType: {
    type: String,
    enum: ['text', 'system', 'attachment', 'modification_request', 'modification_response'],
    default: 'text'
  },
  content: {
    type: String,
    required: true,
    maxlength: [2000, 'Message content cannot be more than 2000 characters']
  },
  attachments: [{
    name: String,
    url: String,
    type: {
      type: String,
      enum: ['image', 'document', 'pdf', 'other'],
      default: 'other'
    },
    size: Number
  }],
  relatedData: {
    modificationRequestId: String,
    bookingDetails: mongoose.Schema.Types.Mixed,
    systemAction: String
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  },
  readBy: [{
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  sentAt: {
    type: Date,
    default: Date.now
  },
  editedAt: Date,
  isEdited: {
    type: Boolean,
    default: false
  }
}, { _id: true });

const bookingConversationSchema = new mongoose.Schema({
  conversationId: {
    type: String,
    required: true
  },
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: true
  },
  bookingId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Booking',
    required: true
  },
  participants: [{
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['guest', 'staff', 'admin', 'manager'],
      required: true
    },
    name: {
      type: String,
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    lastSeenAt: {
      type: Date,
      default: Date.now
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  subject: {
    type: String,
    required: true,
    maxlength: [200, 'Subject cannot be more than 200 characters']
  },
  category: {
    type: String,
    enum: ['booking_modification', 'general_inquiry', 'complaint', 'compliment', 'special_request', 'billing_question', 'service_request'],
    default: 'general_inquiry'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  status: {
    type: String,
    enum: ['active', 'resolved', 'closed', 'escalated'],
    default: 'active'
  },
  tags: [String],
  messages: [messageSchema],
  metadata: {
    initiatedBy: {
      userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      role: String
    },
    assignedTo: {
      userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      assignedAt: Date,
      assignedBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      }
    },
    bookingSnapshot: {
      bookingNumber: String,
      checkIn: Date,
      checkOut: Date,
      roomType: String,
      totalAmount: Number,
      currency: String,
      guestDetails: mongoose.Schema.Types.Mixed
    },
    modificationRequests: [{
      requestId: String,
      type: String,
      status: String,
      requestedAt: Date,
      respondedAt: Date
    }]
  },
  statistics: {
    messageCount: {
      type: Number,
      default: 0
    },
    lastMessageAt: Date,
    averageResponseTime: Number, // in minutes
    resolutionTime: Number, // in minutes
    escalationCount: {
      type: Number,
      default: 0
    }
  },
  automations: {
    autoClose: {
      enabled: {
        type: Boolean,
        default: true
      },
      after: {
        type: Number,
        default: 72 // hours of inactivity
      }
    },
    autoAssign: {
      enabled: {
        type: Boolean,
        default: true
      },
      department: String
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
bookingConversationSchema.index({ conversationId: 1 }, { unique: true });
bookingConversationSchema.index({ hotelId: 1, bookingId: 1 });
bookingConversationSchema.index({ 'participants.userId': 1 });
bookingConversationSchema.index({ status: 1, priority: 1 });
bookingConversationSchema.index({ category: 1, createdAt: -1 });
bookingConversationSchema.index({ 'metadata.assignedTo.userId': 1 });

// Generate unique conversation ID before saving
bookingConversationSchema.pre('save', function(next) {
  if (!this.conversationId) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.conversationId = `CONV${date}${random}`;
  }

  // Generate message IDs for new messages
  this.messages.forEach((message) => {
    if (!message.messageId) {
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      message.messageId = `MSG${timestamp}${random}`;
    }
  });

  // Update statistics
  this.statistics.messageCount = this.messages.length;
  if (this.messages.length > 0) {
    this.statistics.lastMessageAt = this.messages[this.messages.length - 1].sentAt;
  }

  next();
});

// Virtual for unread message count per participant
bookingConversationSchema.virtual('unreadCounts').get(function() {
  const counts = {};
  this.participants.forEach(participant => {
    const userId = participant.userId.toString();
    const unreadCount = this.messages.filter(msg => {
      return !msg.readBy.some(read => read.userId.toString() === userId) &&
             msg.sender.userId.toString() !== userId;
    }).length;
    counts[userId] = unreadCount;
  });
  return counts;
});

// Virtual for latest message
bookingConversationSchema.virtual('latestMessage').get(function() {
  return this.messages.length > 0 ? this.messages[this.messages.length - 1] : null;
});

// Instance method to add a message
bookingConversationSchema.methods.addMessage = function(messageData) {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');

  const message = {
    messageId: `MSG${timestamp}${random}`,
    ...messageData,
    sentAt: new Date()
  };

  this.messages.push(message);
  this.statistics.lastMessageAt = new Date();
  this.statistics.messageCount = this.messages.length;

  // Update participant's last seen if they're the sender
  const participant = this.participants.find(p =>
    p.userId.toString() === messageData.sender.userId.toString()
  );
  if (participant) {
    participant.lastSeenAt = new Date();
  }

  return this.save();
};

// Instance method to mark messages as read
bookingConversationSchema.methods.markAsRead = function(userId, messageIds) {
  let updated = false;

  this.messages.forEach(message => {
    if (!messageIds || messageIds.includes(message.messageId)) {
      const alreadyRead = message.readBy.some(read =>
        read.userId.toString() === userId.toString()
      );

      if (!alreadyRead && message.sender.userId.toString() !== userId.toString()) {
        message.readBy.push({
          userId: userId,
          readAt: new Date()
        });
        updated = true;
      }
    }
  });

  // Update participant's last seen
  const participant = this.participants.find(p =>
    p.userId.toString() === userId.toString()
  );
  if (participant) {
    participant.lastSeenAt = new Date();
  }

  return updated ? this.save() : Promise.resolve(this);
};

// Instance method to assign to staff member
bookingConversationSchema.methods.assignTo = function(staffUserId, assignedBy) {
  this.metadata.assignedTo = {
    userId: staffUserId,
    assignedAt: new Date(),
    assignedBy: assignedBy
  };

  // Add staff to participants if not already there
  const isParticipant = this.participants.some(p =>
    p.userId.toString() === staffUserId.toString()
  );

  if (!isParticipant) {
    // This would need to be populated with actual user data in the route
    this.participants.push({
      userId: staffUserId,
      role: 'staff', // This should be determined from the actual user
      name: 'Staff Member', // This should be the actual staff name
      joinedAt: new Date()
    });
  }

  return this.save();
};

// Instance method to add system message
bookingConversationSchema.methods.addSystemMessage = function(content, relatedData = {}) {
  return this.addMessage({
    sender: {
      userId: new mongoose.Types.ObjectId(), // System user ID
      role: 'system',
      name: 'System'
    },
    messageType: 'system',
    content: content,
    relatedData: relatedData
  });
};

// Instance method to close conversation
bookingConversationSchema.methods.closeConversation = function(closedBy, reason) {
  this.status = 'closed';

  return this.addSystemMessage(
    `Conversation closed: ${reason}`,
    { systemAction: 'conversation_closed', closedBy: closedBy }
  );
};

// Instance method to escalate conversation
bookingConversationSchema.methods.escalate = function(escalatedBy, reason) {
  this.status = 'escalated';
  this.priority = 'high';
  this.statistics.escalationCount += 1;

  return this.addSystemMessage(
    `Conversation escalated: ${reason}`,
    { systemAction: 'conversation_escalated', escalatedBy: escalatedBy }
  );
};

// Static method to get conversations for a user
bookingConversationSchema.statics.getForUser = async function(userId, role, filters = {}) {
  let query = {};

  if (role === 'guest') {
    query['participants.userId'] = userId;
  } else if (role === 'staff') {
    query = {
      $or: [
        { 'participants.userId': userId },
        { 'metadata.assignedTo.userId': userId }
      ]
    };
  } else if (role === 'admin' || role === 'manager') {
    // Admin can see all conversations for their hotel
    if (filters.hotelId) {
      query.hotelId = filters.hotelId;
    }
  }

  // Apply additional filters
  if (filters.status) query.status = filters.status;
  if (filters.category) query.category = filters.category;
  if (filters.priority) query.priority = filters.priority;
  if (filters.bookingId) query.bookingId = filters.bookingId;

  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 20;
  const skip = (page - 1) * limit;

  const conversations = await this.find(query)
    .populate('bookingId', 'bookingNumber checkIn checkOut')
    .populate('participants.userId', 'name email role')
    .populate('metadata.assignedTo.userId', 'name email')
    .sort('-statistics.lastMessageAt')
    .skip(skip)
    .limit(limit);

  const total = await this.countDocuments(query);

  return {
    conversations,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Static method to get conversation statistics
bookingConversationSchema.statics.getStats = async function(hotelId, startDate, endDate) {
  const matchQuery = { hotelId };

  if (startDate && endDate) {
    matchQuery.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  const stats = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: {
          status: '$status',
          category: '$category'
        },
        count: { $sum: 1 },
        avgResolutionTime: { $avg: '$statistics.resolutionTime' },
        avgResponseTime: { $avg: '$statistics.averageResponseTime' },
        avgMessageCount: { $avg: '$statistics.messageCount' }
      }
    },
    {
      $group: {
        _id: '$_id.status',
        categories: {
          $push: {
            category: '$_id.category',
            count: '$count',
            avgResolutionTime: '$avgResolutionTime',
            avgResponseTime: '$avgResponseTime',
            avgMessageCount: '$avgMessageCount'
          }
        },
        totalCount: { $sum: '$count' }
      }
    }
  ]);

  return stats;
};

export default mongoose.model('BookingConversation', bookingConversationSchema);
