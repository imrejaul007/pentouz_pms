import mongoose from 'mongoose';
import NotificationAutomationService from '../services/notificationAutomationService.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     GuestService:
 *       type: object
 *       required:
 *         - hotelId
 *         - userId
 *         - bookingId
 *         - serviceType
 *         - serviceVariation
 *       properties:
 *         _id:
 *           type: string
 *         hotelId:
 *           type: string
 *           description: Hotel ID
 *         userId:
 *           type: string
 *           description: Guest user ID
 *         bookingId:
 *           type: string
 *           description: Associated booking ID
 *         serviceType:
 *           type: string
 *           enum: [room_service, housekeeping, maintenance, concierge, transport, spa, laundry, other]
 *           description: Type of service requested
 *         title:
 *           type: string
 *           description: Brief title of the request (optional)
 *         description:
 *           type: string
 *           description: Detailed description of the request (optional)
 *         serviceVariation:
 *           type: string
 *           description: Primary service variation (for backward compatibility)
 *         serviceVariations:
 *           type: array
 *           items:
 *             type: string
 *           description: Multiple service variations/options selected by the guest
 *         completedServiceVariations:
 *           type: array
 *           items:
 *             type: string
 *           description: Service variations that have been completed by staff
 *         priority:
 *           type: string
 *           enum: [now, later, low, medium, high, urgent]
 *           default: now
 *           description: Priority level - 'now' for immediate, 'later' for scheduled
 *         status:
 *           type: string
 *           enum: [pending, assigned, in_progress, completed, cancelled]
 *           default: pending
 *         assignedTo:
 *           type: string
 *           description: Staff member assigned to handle the request
 *         scheduledTime:
 *           type: string
 *           format: date-time
 *         completedTime:
 *           type: string
 *           format: date-time
 *         estimatedCost:
 *           type: number
 *           default: 0
 *         actualCost:
 *           type: number
 *           default: 0
 *         notes:
 *           type: string
 *         attachments:
 *           type: array
 *           items:
 *             type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const guestServiceSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required']
  },
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  bookingId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Booking',
    required: [true, 'Booking ID is required']
  },
  serviceType: {
    type: String,
    enum: {
      values: ['room_service', 'housekeeping', 'maintenance', 'concierge', 'transport', 'spa', 'laundry', 'other'],
      message: 'Invalid service type'
    },
    required: [true, 'Service type is required']
  },
  title: {
    type: String,
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  serviceVariation: {
    type: String,
    required: [true, 'Service variation is required'],
    trim: true
  },
  serviceVariations: [{
    type: String,
    trim: true
  }],
  completedServiceVariations: [{
    type: String,
    trim: true
  }],
  priority: {
    type: String,
    enum: {
      values: ['now', 'later', 'low', 'medium', 'high', 'urgent'],
      message: 'Invalid priority level'
    },
    default: 'now'
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'],
      message: 'Invalid status'
    },
    default: 'pending'
  },
  assignedTo: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  relatedHotelService: {
    type: mongoose.Schema.ObjectId,
    ref: 'HotelService'
  },
  scheduledTime: {
    type: Date
  },
  completedTime: {
    type: Date
  },
  estimatedCost: {
    type: Number,
    min: [0, 'Estimated cost cannot be negative'],
    default: 0
  },
  actualCost: {
    type: Number,
    min: [0, 'Actual cost cannot be negative'],
    default: 0
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot be more than 500 characters']
  },
  attachments: [{
    type: String,
    match: [/^https?:\/\//, 'Attachment URL must be valid']
  }],
  items: [{
    name: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1
    },
    price: {
      type: Number,
      min: 0,
      default: 0
    }
  }],
  specialInstructions: {
    type: String,
    maxlength: [300, 'Special instructions cannot be more than 300 characters']
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  feedback: {
    type: String,
    maxlength: [500, 'Feedback cannot be more than 500 characters']
  },
  // Inventory Tracking Fields
  inventoryConsumed: [{
    inventoryItemId: {
      type: mongoose.Schema.ObjectId,
      ref: 'InventoryItem',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.01
    },
    unitCost: {
      type: Number,
      required: true,
      min: 0
    },
    totalCost: {
      type: Number,
      required: true,
      min: 0
    },
    chargeToGuest: {
      type: Boolean,
      default: false
    },
    guestChargeAmount: {
      type: Number,
      min: 0,
      default: 0
    },
    isComplimentary: {
      type: Boolean,
      default: false
    },
    isVIPBenefit: {
      type: Boolean,
      default: false
    },
    notes: String,
    recordedAt: {
      type: Date,
      default: Date.now
    }
  }],
  guestPreferences: {
    inventoryPreferences: [{
      inventoryItemId: {
        type: mongoose.Schema.ObjectId,
        ref: 'InventoryItem'
      },
      preferenceLevel: {
        type: String,
        enum: ['dislike', 'neutral', 'like', 'love'],
        default: 'neutral'
      },
      notes: String,
      lastUpdated: {
        type: Date,
        default: Date.now
      }
    }],
    dietaryRestrictions: [String],
    allergies: [String],
    specialRequests: [String]
  },
  vipServicesApplied: [{
    serviceType: {
      type: String,
      enum: ['complimentary_upgrade', 'discount_applied', 'special_amenity', 'priority_service']
    },
    description: String,
    value: Number,
    appliedAt: {
      type: Date,
      default: Date.now
    }
  }],
  billingItems: [{
    inventoryConsumptionId: {
      type: mongoose.Schema.ObjectId,
      ref: 'InventoryConsumption'
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    description: String,
    billed: {
      type: Boolean,
      default: false
    },
    billedAt: Date,
    invoiceId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Invoice'
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
guestServiceSchema.index({ hotelId: 1, status: 1 });
guestServiceSchema.index({ userId: 1, createdAt: -1 });
guestServiceSchema.index({ bookingId: 1 });
guestServiceSchema.index({ assignedTo: 1, status: 1 });
guestServiceSchema.index({ serviceType: 1, priority: 1 });

// Calculate total cost
guestServiceSchema.methods.calculateTotalCost = function() {
  const itemsTotal = (this.items || []).reduce((total, item) => total + ((item.price || 0) * (item.quantity || 0)), 0);
  const inventoryTotal = (this.inventoryConsumed || []).reduce((total, item) => total + (item.totalCost || 0), 0);
  const guestChargeTotal = (this.inventoryConsumed || []).reduce((total, item) =>
    total + (item.chargeToGuest ? (item.guestChargeAmount || 0) : 0), 0);

  return itemsTotal + inventoryTotal + guestChargeTotal + (this.actualCost || this.estimatedCost || 0);
};

// Update status with timestamp
guestServiceSchema.methods.updateStatus = function(newStatus) {
  this.status = newStatus;
  
  if (newStatus === 'completed') {
    this.completedTime = new Date();
  } else if (newStatus === 'in_progress' && !this.scheduledTime) {
    this.scheduledTime = new Date();
  }
};

// Check if service can be cancelled
guestServiceSchema.methods.canCancel = function() {
  return ['pending', 'assigned'].includes(this.status);
};

// Static method to get service statistics
guestServiceSchema.statics.getServiceStats = async function(hotelId, startDate, endDate) {
  const matchQuery = { hotelId };
  
  if (startDate && endDate) {
    matchQuery.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  const pipeline = [
    { $match: matchQuery },
    {
      $group: {
        _id: {
          serviceType: '$serviceType',
          status: '$status'
        },
        count: { $sum: 1 },
        avgCost: { $avg: '$actualCost' },
        totalRevenue: { $sum: '$actualCost' }
      }
    },
    {
      $group: {
        _id: '$_id.serviceType',
        stats: {
          $push: {
            status: '$_id.status',
            count: '$count',
            avgCost: '$avgCost',
            totalRevenue: '$totalRevenue'
          }
        },
        totalRequests: { $sum: '$count' }
      }
    }
  ];

  return await this.aggregate(pipeline);
};

// Static method to auto-assign service request to appropriate staff
guestServiceSchema.statics.autoAssignToStaff = async function(serviceRequest, hotelId) {
  const HotelService = mongoose.model('HotelService');

  // Try to find a matching hotel service based on service type
  const matchingHotelServices = await HotelService.find({
    hotelId,
    type: this.mapServiceTypeToHotelServiceType(serviceRequest.serviceType),
    isActive: true,
    'assignedStaff.isActive': true
  }).populate('assignedStaff.staffId', 'name email');

  if (matchingHotelServices.length > 0) {
    // Prefer services with auto-assignment enabled
    let targetService = matchingHotelServices.find(
      service => service.serviceSettings?.autoAssignRequests
    ) || matchingHotelServices[0];

    // Get available staff from the service
    const availableStaff = targetService.getActiveStaff();

    if (availableStaff.length > 0) {
      // Prefer primary contact, otherwise use least loaded staff
      let assignedStaff = availableStaff.find(staff => staff.primaryContact);

      if (!assignedStaff) {
        // Find staff member with least current assignments
        const staffWorkloads = await Promise.all(
          availableStaff.map(async (staff) => {
            const currentAssignments = await this.countDocuments({
              assignedTo: staff.staffId._id,
              status: { $in: ['assigned', 'in_progress'] }
            });
            return { staff, workload: currentAssignments };
          })
        );

        staffWorkloads.sort((a, b) => a.workload - b.workload);
        assignedStaff = staffWorkloads[0].staff;
      }

      if (assignedStaff) {
        serviceRequest.assignedTo = assignedStaff.staffId._id;
        serviceRequest.relatedHotelService = targetService._id;
        serviceRequest.status = 'assigned';
        return serviceRequest;
      }
    }
  }

  // Fallback to random staff assignment if no hotel service match
  const User = mongoose.model('User');
  const availableStaff = await User.find({
    hotelId,
    role: 'staff',
    isActive: true
  });

  if (availableStaff.length > 0) {
    const randomStaff = availableStaff[Math.floor(Math.random() * availableStaff.length)];
    serviceRequest.assignedTo = randomStaff._id;
    serviceRequest.status = 'assigned';
  }

  return serviceRequest;
};

// Helper method to map guest service types to hotel service types
guestServiceSchema.statics.mapServiceTypeToHotelServiceType = function(guestServiceType) {
  const mapping = {
    'room_service': 'dining',
    'housekeeping': 'wellness',
    'maintenance': 'business',
    'concierge': 'business',
    'transport': 'transport',
    'spa': 'spa',
    'laundry': 'wellness',
    'other': 'business'
  };

  return mapping[guestServiceType] || 'business';
};

// Instance methods for inventory tracking

// Add consumed inventory item
guestServiceSchema.methods.addInventoryConsumption = function(inventoryData) {
  const {
    inventoryItemId,
    quantity,
    unitCost,
    chargeToGuest = false,
    guestChargeAmount = 0,
    isComplimentary = false,
    isVIPBenefit = false,
    notes
  } = inventoryData;

  this.inventoryConsumed.push({
    inventoryItemId,
    quantity,
    unitCost,
    totalCost: quantity * unitCost,
    chargeToGuest,
    guestChargeAmount,
    isComplimentary,
    isVIPBenefit,
    notes,
    recordedAt: new Date()
  });

  return this.save();
};

// Update guest preferences
guestServiceSchema.methods.updateGuestPreferences = function(preferences) {
  this.guestPreferences = {
    ...this.guestPreferences,
    ...preferences
  };

  return this.save();
};

// Add VIP service applied
guestServiceSchema.methods.addVIPService = function(serviceData) {
  const { serviceType, description, value } = serviceData;

  this.vipServicesApplied.push({
    serviceType,
    description,
    value,
    appliedAt: new Date()
  });

  return this.save();
};

// Add billing item
guestServiceSchema.methods.addBillingItem = function(billingData) {
  const { inventoryConsumptionId, amount, description } = billingData;

  this.billingItems.push({
    inventoryConsumptionId,
    amount,
    description,
    billed: false
  });

  return this.save();
};

// Mark billing items as billed
guestServiceSchema.methods.markBillingItemsBilled = function(invoiceId) {
  this.billingItems.forEach(item => {
    if (!item.billed) {
      item.billed = true;
      item.billedAt = new Date();
      item.invoiceId = invoiceId;
    }
  });

  return this.save();
};

// Virtual for total inventory cost
guestServiceSchema.virtual('totalInventoryCost').get(function() {
  return (this.inventoryConsumed || []).reduce((total, item) => total + (item.totalCost || 0), 0);
});

// Virtual for total guest charges
guestServiceSchema.virtual('totalGuestCharges').get(function() {
  return (this.inventoryConsumed || []).reduce((total, item) =>
    total + (item.chargeToGuest ? (item.guestChargeAmount || 0) : 0), 0);
});

// Virtual for complimentary value
guestServiceSchema.virtual('complimentaryValue').get(function() {
  return (this.inventoryConsumed || []).reduce((total, item) =>
    total + (item.isComplimentary ? (item.totalCost || 0) : 0), 0);
});

// Virtual for VIP benefits value
guestServiceSchema.virtual('vipBenefitsValue').get(function() {
  const inventoryVIP = (this.inventoryConsumed || []).reduce((total, item) =>
    total + (item.isVIPBenefit ? (item.totalCost || 0) : 0), 0);
  const serviceVIP = (this.vipServicesApplied || []).reduce((total, service) => total + (service.value || 0), 0);
  return inventoryVIP + serviceVIP;
});

// Virtual for inventory items count
guestServiceSchema.virtual('inventoryItemsCount').get(function() {
  return (this.inventoryConsumed || []).length;
});

// Virtual for billing status
guestServiceSchema.virtual('billingStatus').get(function() {
  const billingItems = this.billingItems || [];
  if (billingItems.length === 0) return 'no_charges';

  const billedItems = billingItems.filter(item => item.billed).length;
  if (billedItems === billingItems.length) return 'fully_billed';
  if (billedItems > 0) return 'partially_billed';
  return 'pending_billing';
});

// NOTIFICATION AUTOMATION HOOKS
guestServiceSchema.post('save', async function(doc) {
  try {
    // Get room number from booking
    let roomNumber = 'Unknown';
    try {
      const booking = await mongoose.model('Booking').findById(doc.bookingId).populate('rooms.roomId');
      if (booking && booking.rooms && booking.rooms[0] && booking.rooms[0].roomId) {
        roomNumber = booking.rooms[0].roomId.roomNumber || 'Unknown';
      }
    } catch (error) {
      console.log('Could not fetch room number for guest service notification');
    }

    // Check if this is a VIP guest
    const user = await mongoose.model('User').findById(doc.userId);
    const isVipGuest = user && (user.loyaltyTier === 'platinum' || user.loyaltyTier === 'diamond');

    // 1. New guest service request created
    if (this.isNew) {
      let notificationType = 'guest_service_created';
      let priority = 'medium';

      // Check for urgent or VIP requests
      if (doc.priority === 'urgent' || doc.priority === 'now') {
        notificationType = 'guest_service_urgent';
        priority = 'urgent';
      } else if (isVipGuest) {
        notificationType = 'guest_service_vip';
        priority = 'high';
      }

      await NotificationAutomationService.triggerNotification(
        notificationType,
        {
          roomNumber,
          serviceType: doc.serviceType,
          serviceVariation: doc.serviceVariation,
          description: doc.description || doc.title,
          priority: doc.priority,
          requestId: doc._id,
          userId: doc.userId,
          isVip: isVipGuest
        },
        'auto',
        priority,
        doc.hotelId
      );
    }

    // 2. Service assigned to staff
    if (doc.isModified('assignedTo') && doc.assignedTo) {
      await NotificationAutomationService.triggerNotification(
        'guest_service_assigned',
        {
          roomNumber,
          serviceType: doc.serviceType,
          serviceVariation: doc.serviceVariation,
          description: doc.description || doc.title,
          requestId: doc._id,
          assignedTo: doc.assignedTo,
          priority: doc.priority,
          isVip: isVipGuest
        },
        [doc.assignedTo],
        isVipGuest ? 'high' : 'medium',
        doc.hotelId
      );
    }

    // 3. Service started (status changed to in_progress)
    if (doc.isModified('status') && doc.status === 'in_progress') {
      await NotificationAutomationService.triggerNotification(
        'guest_service_started',
        {
          roomNumber,
          serviceType: doc.serviceType,
          serviceVariation: doc.serviceVariation,
          requestId: doc._id,
          assignedTo: doc.assignedTo
        },
        [doc.userId, 'auto'], // Notify guest and admin
        'low',
        doc.hotelId
      );
    }

    // 4. Service completed
    if (doc.isModified('status') && doc.status === 'completed') {
      await NotificationAutomationService.triggerNotification(
        'guest_service_completed',
        {
          roomNumber,
          serviceType: doc.serviceType,
          serviceVariation: doc.serviceVariation,
          requestId: doc._id,
          completedTime: doc.completedTime,
          assignedTo: doc.assignedTo,
          actualCost: doc.actualCost
        },
        [doc.userId, 'auto'], // Notify guest and admin
        'medium',
        doc.hotelId
      );
    }

  } catch (error) {
    console.error('Error in GuestService notification hook:', error);
  }
});

export default mongoose.model('GuestService', guestServiceSchema);
