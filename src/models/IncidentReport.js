import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     IncidentReport:
 *       type: object
 *       required:
 *         - hotelId
 *         - title
 *         - type
 *         - severity
 *         - reportedBy
 *       properties:
 *         _id:
 *           type: string
 *         hotelId:
 *           type: string
 *           description: Hotel ID
 *         roomId:
 *           type: string
 *           description: Room ID (if room-related)
 *         guestId:
 *           type: string
 *           description: Guest user ID (if guest-related)
 *         bookingId:
 *           type: string
 *           description: Associated booking ID
 *         title:
 *           type: string
 *           description: Incident title
 *         description:
 *           type: string
 *           description: Detailed description
 *         type:
 *           type: string
 *           enum: [security, safety, medical, property_damage, guest_complaint, staff_issue, maintenance, fire, theft, accident, other]
 *           description: Type of incident
 *         severity:
 *           type: string
 *           enum: [low, medium, high, critical, emergency]
 *           description: Incident severity
 *         status:
 *           type: string
 *           enum: [reported, investigating, action_taken, resolved, closed]
 *           default: reported
 *         reportedBy:
 *           type: string
 *           description: Who reported the incident
 *         assignedTo:
 *           type: string
 *           description: Staff member handling the incident
 *         witnessCount:
 *           type: number
 *           default: 0
 *         witnesses:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               contact:
 *                 type: string
 *               statement:
 *                 type: string
 *         injuryInvolved:
 *           type: boolean
 *           default: false
 *         medicalAttentionRequired:
 *           type: boolean
 *           default: false
 *         policeNotified:
 *           type: boolean
 *           default: false
 *         insuranceNotified:
 *           type: boolean
 *           default: false
 *         location:
 *           type: string
 *           description: Specific location of incident
 *         timeOccurred:
 *           type: string
 *           format: date-time
 *         images:
 *           type: array
 *           items:
 *             type: string
 *         documents:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               url:
 *                 type: string
 *               type:
 *                 type: string
 *         actionsTaken:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *               takenBy:
 *                 type: string
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *               notes:
 *                 type: string
 *         followUpRequired:
 *           type: boolean
 *           default: false
 *         followUpDate:
 *           type: string
 *           format: date-time
 *         resolution:
 *           type: string
 *         preventiveMeasures:
 *           type: string
 *         cost:
 *           type: number
 *           default: 0
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const incidentReportSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required']
  },
  incidentNumber: {
    type: String,
    unique: true
  },
  roomId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Room'
  },
  guestId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  bookingId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Booking'
  },
  title: {
    type: String,
    required: [true, 'Incident title is required'],
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Incident description is required'],
    maxlength: [2000, 'Description cannot be more than 2000 characters']
  },
  type: {
    type: String,
    enum: {
      values: ['security', 'safety', 'medical', 'property_damage', 'guest_complaint', 'staff_issue', 'maintenance', 'fire', 'theft', 'accident', 'other'],
      message: 'Invalid incident type'
    },
    required: [true, 'Incident type is required']
  },
  severity: {
    type: String,
    enum: {
      values: ['low', 'medium', 'high', 'critical', 'emergency'],
      message: 'Invalid severity level'
    },
    required: [true, 'Severity is required']
  },
  status: {
    type: String,
    enum: {
      values: ['reported', 'investigating', 'action_taken', 'resolved', 'closed'],
      message: 'Invalid status'
    },
    default: 'reported'
  },
  reportedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Reporter is required']
  },
  assignedTo: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  timeOccurred: {
    type: Date,
    required: [true, 'Time of occurrence is required']
  },
  witnessCount: {
    type: Number,
    min: 0,
    default: 0
  },
  witnesses: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    contact: {
      type: String,
      trim: true
    },
    relationship: {
      type: String,
      enum: ['guest', 'staff', 'visitor', 'contractor', 'other'],
      default: 'other'
    },
    statement: {
      type: String,
      maxlength: [1000, 'Witness statement cannot be more than 1000 characters']
    }
  }],
  injuryInvolved: {
    type: Boolean,
    default: false
  },
  injuryDetails: {
    type: String,
    maxlength: [500, 'Injury details cannot be more than 500 characters']
  },
  medicalAttentionRequired: {
    type: Boolean,
    default: false
  },
  medicalProvider: {
    type: String,
    trim: true
  },
  policeNotified: {
    type: Boolean,
    default: false
  },
  policeReportNumber: {
    type: String,
    trim: true
  },
  insuranceNotified: {
    type: Boolean,
    default: false
  },
  insuranceClaimNumber: {
    type: String,
    trim: true
  },
  images: [{
    url: {
      type: String,
      match: [/^https?:\/\//, 'Image URL must be valid']
    },
    caption: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  documents: [{
    name: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true,
      match: [/^https?:\/\//, 'Document URL must be valid']
    },
    type: {
      type: String,
      enum: ['police_report', 'medical_report', 'insurance_form', 'witness_statement', 'other'],
      default: 'other'
    },
    uploadedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  actionsTaken: [{
    action: {
      type: String,
      required: true,
      maxlength: [500, 'Action description cannot be more than 500 characters']
    },
    takenBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    notes: {
      type: String,
      maxlength: [300, 'Notes cannot be more than 300 characters']
    },
    cost: {
      type: Number,
      min: 0,
      default: 0
    }
  }],
  followUpRequired: {
    type: Boolean,
    default: false
  },
  followUpDate: {
    type: Date
  },
  followUpNotes: {
    type: String,
    maxlength: [500, 'Follow-up notes cannot be more than 500 characters']
  },
  resolution: {
    type: String,
    maxlength: [1000, 'Resolution cannot be more than 1000 characters']
  },
  preventiveMeasures: {
    type: String,
    maxlength: [1000, 'Preventive measures cannot be more than 1000 characters']
  },
  totalCost: {
    type: Number,
    min: 0,
    default: 0
  },
  isConfidential: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true
  }],
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  departmentInvolved: [{
    type: String,
    enum: ['front_desk', 'housekeeping', 'maintenance', 'security', 'food_beverage', 'management', 'other']
  }],
  guestSatisfactionImpact: {
    type: String,
    enum: ['none', 'minor', 'moderate', 'significant', 'severe'],
    default: 'none'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
incidentReportSchema.index({ hotelId: 1, status: 1 });
incidentReportSchema.index({ type: 1, severity: 1 });
incidentReportSchema.index({ reportedBy: 1, createdAt: -1 });
incidentReportSchema.index({ assignedTo: 1, status: 1 });
incidentReportSchema.index({ timeOccurred: 1 });
incidentReportSchema.index({ guestId: 1 });

// Generate incident number before saving
incidentReportSchema.pre('save', function(next) {
  if (!this.incidentNumber) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.incidentNumber = `INC${date}${random}`;
  }
  next();
});

// Virtual for days since incident
incidentReportSchema.virtual('daysSinceIncident').get(function() {
  const now = new Date();
  const diffTime = Math.abs(now - this.timeOccurred);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for total action costs
incidentReportSchema.virtual('totalActionCost').get(function() {
  return (this.actionsTaken || []).reduce((total, action) => total + (action.cost || 0), 0);
});

// Instance method to add action
incidentReportSchema.methods.addAction = function(action, takenBy, notes = '', cost = 0) {
  this.actionsTaken.push({
    action,
    takenBy,
    notes,
    cost,
    timestamp: new Date()
  });
  
  // Update total cost
  this.totalCost += cost;
  
  return this.save();
};

// Instance method to update status
incidentReportSchema.methods.updateStatus = function(newStatus, notes = '') {
  const oldStatus = this.status;
  this.status = newStatus;
  
  // Add automatic action log
  this.actionsTaken.push({
    action: `Status changed from ${oldStatus} to ${newStatus}`,
    takenBy: this.assignedTo || this.reportedBy,
    notes,
    timestamp: new Date()
  });
  
  return this.save();
};

// Instance method to assign incident
incidentReportSchema.methods.assignIncident = function(userId) {
  this.assignedTo = userId;
  this.status = 'investigating';
  
  this.actionsTaken.push({
    action: 'Incident assigned for investigation',
    takenBy: userId,
    timestamp: new Date()
  });
  
  return this.save();
};

// Static method to get incident statistics
incidentReportSchema.statics.getIncidentStats = async function(hotelId, startDate, endDate) {
  const matchQuery = { hotelId };
  
  if (startDate && endDate) {
    matchQuery.timeOccurred = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  const pipeline = [
    { $match: matchQuery },
    {
      $group: {
        _id: {
          type: '$type',
          severity: '$severity'
        },
        count: { $sum: 1 },
        avgResolutionTime: { $avg: { $divide: [{ $subtract: ['$updatedAt', '$timeOccurred'] }, 1000 * 60 * 60] } },
        totalCost: { $sum: '$totalCost' }
      }
    },
    {
      $group: {
        _id: '$_id.type',
        stats: {
          $push: {
            severity: '$_id.severity',
            count: '$count',
            avgResolutionTime: '$avgResolutionTime',
            totalCost: '$totalCost'
          }
        },
        totalIncidents: { $sum: '$count' }
      }
    }
  ];

  return await this.aggregate(pipeline);
};

// Static method to get recent incidents
incidentReportSchema.statics.getRecentIncidents = async function(hotelId, limit = 10) {
  return await this.find({ hotelId })
    .populate('reportedBy', 'name')
    .populate('assignedTo', 'name')
    .populate('roomId', 'number type')
    .populate('guestId', 'name')
    .sort('-timeOccurred')
    .limit(limit)
    .select('incidentNumber title type severity status timeOccurred location');
};

// Static method to get critical incidents
incidentReportSchema.statics.getCriticalIncidents = async function(hotelId) {
  return await this.find({
    hotelId,
    $or: [
      { severity: { $in: ['critical', 'emergency'] } },
      { injuryInvolved: true },
      { policeNotified: true }
    ],
    status: { $ne: 'closed' }
  })
  .populate('reportedBy', 'name')
  .populate('assignedTo', 'name')
  .populate('roomId', 'number type')
  .sort('-timeOccurred');
};

// Static method for incident trends
incidentReportSchema.statics.getIncidentTrends = async function(hotelId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return await this.aggregate([
    {
      $match: {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        timeOccurred: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$timeOccurred' } },
          type: '$type'
        },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.date': 1 }
    }
  ]);
};

export default mongoose.model('IncidentReport', incidentReportSchema);
