import mongoose from 'mongoose';

const dayUseBookingSchema = new mongoose.Schema({
  bookingId: {
    type: String,
    required: true,
    unique: true,
    default: () => `DU${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`
  },
  
  guestInfo: {
    primaryGuest: {
      guestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Guest' },
      firstName: { type: String, required: true, trim: true },
      lastName: { type: String, required: true, trim: true },
      email: { type: String, required: true, lowercase: true },
      phone: { type: String, required: true },
      identificationNumber: String,
      nationality: String
    },
    additionalGuests: [{
      firstName: { type: String, required: true, trim: true },
      lastName: { type: String, required: true, trim: true },
      age: { type: Number, min: 0, max: 120 },
      relationship: {
        type: String,
        enum: ['spouse', 'child', 'parent', 'sibling', 'friend', 'colleague', 'other']
      },
      identificationNumber: String
    }],
    totalGuests: { type: Number, required: true, min: 1, max: 20 },
    guestAges: [{ type: Number, min: 0, max: 120 }],
    specialRequests: [{
      type: { type: String, enum: ['dietary', 'accessibility', 'celebration', 'other'] },
      description: String,
      fulfilled: { type: Boolean, default: false }
    }]
  },
  
  bookingDetails: {
    slotId: { type: mongoose.Schema.Types.ObjectId, ref: 'DayUseSlot', required: true },
    bookingDate: { type: Date, required: true },
    timeSlot: {
      startTime: { type: String, required: true },
      endTime: { type: String, required: true },
      duration: { type: Number, required: true }
    },
    roomType: { type: String, required: true },
    roomNumber: String,
    assignedRooms: [{
      roomNumber: String,
      roomType: String,
      capacity: Number,
      assignedGuests: [String]
    }]
  },
  
  pricing: {
    basePrice: { type: Number, required: true, min: 0 },
    priceBreakdown: {
      slotPrice: { type: Number, required: true },
      guestCharges: { type: Number, default: 0 },
      seasonalAdjustment: { type: Number, default: 0 },
      specialPeriodAdjustment: { type: Number, default: 0 },
      addOnServices: { type: Number, default: 0 },
      taxes: { type: Number, default: 0 },
      discounts: { type: Number, default: 0 }
    },
    currency: { type: String, default: 'USD' },
    totalAmount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0 },
    refundableAmount: { type: Number, default: 0 }
  },
  
  addOnServices: [{
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'AddOnService' },
    serviceName: String,
    quantity: { type: Number, min: 1 },
    unitPrice: Number,
    totalPrice: Number,
    scheduledTime: String,
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'],
      default: 'pending'
    },
    notes: String
  }],
  
  inclusions: [{
    type: { type: String, enum: ['meal', 'beverage', 'amenity', 'service', 'access'] },
    name: String,
    description: String,
    value: Number,
    quantity: { type: Number, default: 1 },
    validFrom: String,
    validTo: String,
    used: { type: Boolean, default: false },
    usedAt: Date,
    restrictions: [String]
  }],
  
  status: {
    bookingStatus: {
      type: String,
      enum: ['draft', 'confirmed', 'checked_in', 'in_use', 'checked_out', 'no_show', 'cancelled'],
      default: 'draft'
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'partial', 'paid', 'refunded', 'failed'],
      default: 'pending'
    },
    roomStatus: {
      type: String,
      enum: ['unassigned', 'assigned', 'ready', 'occupied', 'maintenance'],
      default: 'unassigned'
    }
  },
  
  timeline: {
    bookedAt: { type: Date, default: Date.now },
    confirmedAt: Date,
    checkedInAt: Date,
    checkedOutAt: Date,
    cancelledAt: Date,
    modifiedAt: [{ type: Date }],
    lastStatusUpdate: { type: Date, default: Date.now }
  },
  
  payment: {
    paymentMethod: {
      type: String,
      enum: ['credit_card', 'debit_card', 'cash', 'bank_transfer', 'digital_wallet', 'voucher'],
      required: true
    },
    paymentReference: String,
    transactionId: String,
    paymentGateway: String,
    installments: [{
      amount: Number,
      dueDate: Date,
      paidDate: Date,
      status: { type: String, enum: ['pending', 'paid', 'overdue'], default: 'pending' }
    }],
    refunds: [{
      amount: Number,
      reason: String,
      processedDate: Date,
      refundReference: String,
      status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing' }
    }]
  },
  
  policies: {
    cancellationPolicy: {
      type: { type: String, enum: ['flexible', 'moderate', 'strict', 'non_refundable'] },
      cutoffHours: Number,
      penaltyPercentage: Number,
      minimumCharge: Number
    },
    modificationPolicy: {
      allowed: { type: Boolean, default: true },
      cutoffHours: Number,
      feeAmount: Number
    },
    noShowPolicy: {
      chargePercentage: { type: Number, default: 100 },
      gracePeriodMinutes: { type: Number, default: 30 }
    }
  },
  
  operational: {
    source: {
      type: String,
      enum: ['direct', 'website', 'mobile_app', 'phone', 'walk_in', 'ota', 'travel_agent'],
      required: true
    },
    channel: String,
    bookingAgent: {
      agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
      agentName: String,
      commission: Number
    },
    notifications: {
      confirmationSent: { type: Boolean, default: false },
      reminderSent: { type: Boolean, default: false },
      checkInNoticeSent: { type: Boolean, default: false },
      feedbackRequestSent: { type: Boolean, default: false }
    },
    housekeeping: {
      roomPrepRequired: { type: Boolean, default: true },
      specialSetup: [String],
      cleaningStatus: {
        type: String,
        enum: ['pending', 'in_progress', 'completed'],
        default: 'pending'
      },
      assignedStaff: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Staff' }]
    }
  },
  
  analytics: {
    leadTime: { type: Number }, // Days between booking and stay
    channelConversion: Boolean,
    upsellAccepted: [String],
    guestSatisfactionScore: { type: Number, min: 1, max: 5 },
    repeatGuest: { type: Boolean, default: false },
    revenue: {
      room: Number,
      addOns: Number,
      totalRevenue: Number,
      profitMargin: Number
    }
  },
  
  integration: {
    pmsBookingId: String,
    channelBookingId: String,
    externalReferences: [{
      system: String,
      referenceId: String,
      syncStatus: { type: String, enum: ['pending', 'synced', 'failed'], default: 'pending' }
    }],
    syncHistory: [{
      system: String,
      action: { type: String, enum: ['create', 'update', 'cancel', 'sync'] },
      timestamp: Date,
      status: { type: String, enum: ['success', 'failed', 'partial'] },
      errorMessage: String
    }]
  },
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  notes: [{
    note: String,
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    addedAt: { type: Date, default: Date.now },
    type: { type: String, enum: ['general', 'guest_request', 'operational', 'billing'] }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
dayUseBookingSchema.index({ bookingId: 1 }, { unique: true });
dayUseBookingSchema.index({ 'bookingDetails.bookingDate': 1, 'bookingDetails.slotId': 1 });
dayUseBookingSchema.index({ 'guestInfo.primaryGuest.email': 1 });
dayUseBookingSchema.index({ 'status.bookingStatus': 1, 'bookingDetails.bookingDate': 1 });
dayUseBookingSchema.index({ 'timeline.bookedAt': -1 });
dayUseBookingSchema.index({ 'operational.source': 1 });
dayUseBookingSchema.index({ createdAt: -1 });

// Virtual fields
dayUseBookingSchema.virtual('isToday').get(function() {
  const today = new Date();
  const bookingDate = new Date(this.bookingDetails.bookingDate);
  return bookingDate.toDateString() === today.toDateString();
});

dayUseBookingSchema.virtual('timeUntilCheckIn').get(function() {
  if (this.status.bookingStatus === 'checked_in') return 0;
  
  const now = new Date();
  const checkInTime = new Date(this.bookingDetails.bookingDate);
  const [hours, minutes] = this.bookingDetails.timeSlot.startTime.split(':');
  checkInTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  
  return Math.max(0, Math.floor((checkInTime - now) / (1000 * 60))); // Minutes
});

dayUseBookingSchema.virtual('canCancel').get(function() {
  if (['cancelled', 'checked_in', 'in_use', 'checked_out'].includes(this.status.bookingStatus)) {
    return false;
  }
  
  const now = new Date();
  const cutoffTime = new Date(this.bookingDetails.bookingDate);
  const [hours, minutes] = this.bookingDetails.timeSlot.startTime.split(':');
  cutoffTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  cutoffTime.setHours(cutoffTime.getHours() - (this.policies.cancellationPolicy.cutoffHours || 2));
  
  return now < cutoffTime;
});

dayUseBookingSchema.virtual('canModify').get(function() {
  if (!this.policies.modificationPolicy.allowed) return false;
  if (['cancelled', 'checked_in', 'in_use', 'checked_out'].includes(this.status.bookingStatus)) {
    return false;
  }
  
  const now = new Date();
  const cutoffTime = new Date(this.bookingDetails.bookingDate);
  const [hours, minutes] = this.bookingDetails.timeSlot.startTime.split(':');
  cutoffTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  cutoffTime.setHours(cutoffTime.getHours() - (this.policies.modificationPolicy.cutoffHours || 4));
  
  return now < cutoffTime;
});

dayUseBookingSchema.virtual('totalAddOnValue').get(function() {
  return this.addOnServices.reduce((sum, service) => sum + (service.totalPrice || 0), 0);
});

dayUseBookingSchema.virtual('outstandingBalance').get(function() {
  return Math.max(0, this.pricing.totalAmount - this.pricing.paidAmount);
});

// Instance methods
dayUseBookingSchema.methods.calculateRefund = function() {
  if (!this.canCancel) return 0;
  
  const policy = this.policies.cancellationPolicy;
  const totalAmount = this.pricing.totalAmount;
  
  if (policy.type === 'non_refundable') return 0;
  
  const refundAmount = totalAmount * (1 - (policy.penaltyPercentage || 0) / 100);
  return Math.max(refundAmount, policy.minimumCharge || 0);
};

dayUseBookingSchema.methods.processCheckIn = function() {
  this.status.bookingStatus = 'checked_in';
  this.timeline.checkedInAt = new Date();
  this.timeline.lastStatusUpdate = new Date();
  
  // Update room status
  this.status.roomStatus = 'occupied';
  
  return this.save();
};

dayUseBookingSchema.methods.processCheckOut = function() {
  this.status.bookingStatus = 'checked_out';
  this.timeline.checkedOutAt = new Date();
  this.timeline.lastStatusUpdate = new Date();
  
  // Update room status
  this.status.roomStatus = 'maintenance';
  
  return this.save();
};

dayUseBookingSchema.methods.addNote = function(note, staffId, type = 'general') {
  this.notes.push({
    note,
    addedBy: staffId,
    type
  });
  return this.save();
};

dayUseBookingSchema.methods.updateStatus = function(newStatus) {
  this.status.bookingStatus = newStatus;
  this.timeline.lastStatusUpdate = new Date();
  
  if (newStatus === 'cancelled') {
    this.timeline.cancelledAt = new Date();
  } else if (newStatus === 'confirmed') {
    this.timeline.confirmedAt = new Date();
  }
  
  return this.save();
};

dayUseBookingSchema.methods.addAddOnService = function(serviceData) {
  this.addOnServices.push(serviceData);
  this.pricing.priceBreakdown.addOnServices += serviceData.totalPrice;
  this.pricing.totalAmount = this.calculateTotalAmount();
  
  return this.save();
};

dayUseBookingSchema.methods.calculateTotalAmount = function() {
  const breakdown = this.pricing.priceBreakdown;
  return breakdown.slotPrice + 
         breakdown.guestCharges + 
         breakdown.seasonalAdjustment + 
         breakdown.specialPeriodAdjustment + 
         breakdown.addOnServices + 
         breakdown.taxes - 
         breakdown.discounts;
};

// Static methods
dayUseBookingSchema.statics.findByDateRange = function(startDate, endDate) {
  return this.find({
    'bookingDetails.bookingDate': {
      $gte: startDate,
      $lte: endDate
    }
  });
};

dayUseBookingSchema.statics.findByGuestEmail = function(email) {
  return this.find({
    'guestInfo.primaryGuest.email': email
  }).sort({ 'timeline.bookedAt': -1 });
};

dayUseBookingSchema.statics.getRevenueByDateRange = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        'bookingDetails.bookingDate': { $gte: startDate, $lte: endDate },
        'status.bookingStatus': { $nin: ['cancelled'] }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$bookingDetails.bookingDate' }
        },
        totalRevenue: { $sum: '$pricing.totalAmount' },
        totalBookings: { $sum: 1 },
        averageRevenue: { $avg: '$pricing.totalAmount' }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

dayUseBookingSchema.statics.getOccupancyBySlot = function(date) {
  return this.aggregate([
    {
      $match: {
        'bookingDetails.bookingDate': date,
        'status.bookingStatus': { $nin: ['cancelled', 'no_show'] }
      }
    },
    {
      $group: {
        _id: '$bookingDetails.slotId',
        bookingCount: { $sum: 1 },
        totalGuests: { $sum: '$guestInfo.totalGuests' },
        totalRevenue: { $sum: '$pricing.totalAmount' }
      }
    }
  ]);
};

// Pre-save middleware
dayUseBookingSchema.pre('save', function(next) {
  // Recalculate total amount if pricing breakdown changed
  const calculatedTotal = this.calculateTotalAmount();
  if (Math.abs(this.pricing.totalAmount - calculatedTotal) > 0.01) {
    this.pricing.totalAmount = calculatedTotal;
  }
  
  // Update analytics
  if (this.isNew) {
    const leadTime = Math.floor((this.bookingDetails.bookingDate - this.timeline.bookedAt) / (1000 * 60 * 60 * 24));
    this.analytics.leadTime = leadTime;
  }
  
  // Update modification history
  if (this.isModified() && !this.isNew) {
    this.timeline.modifiedAt.push(new Date());
  }
  
  next();
});

// Post-save middleware for notifications and integrations
dayUseBookingSchema.post('save', function(doc) {
  // Trigger notifications based on status changes
  if (doc.status.bookingStatus === 'confirmed' && !doc.operational.notifications.confirmationSent) {
    // Trigger confirmation email
    // Implementation would depend on your notification service
  }
  
  // Sync with external systems
  if (doc.integration.pmsBookingId) {
    // Trigger PMS sync
    // Implementation would depend on your PMS integration
  }
});

const DayUseBooking = mongoose.model('DayUseBooking', dayUseBookingSchema);

export default DayUseBooking;
