import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     LostFound:
 *       type: object
 *       required:
 *         - itemName
 *         - category
 *         - status
 *         - foundDate
 *         - foundBy
 *         - hotelId
 *       properties:
 *         _id:
 *           type: string
 *           description: Lost & Found item ID
 *         itemName:
 *           type: string
 *           description: Name of the lost/found item
 *         description:
 *           type: string
 *           description: Detailed description of the item
 *         category:
 *           type: string
 *           enum: [electronics, clothing, documents, valuables, personal_items, luggage, accessories, other]
 *           description: Item category
 *         subcategory:
 *           type: string
 *           description: Item subcategory
 *         status:
 *           type: string
 *           enum: [found, claimed, disposed, transferred, pending]
 *           description: Current status of the item
 *         priority:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *           default: medium
 *           description: Priority level
 *         location:
 *           type: object
 *           properties:
 *             foundLocation:
 *               type: string
 *               description: Where the item was found
 *             currentLocation:
 *               type: string
 *               description: Where the item is currently stored
 *             storageDetails:
 *               type: string
 *               description: Additional storage information
 *         dates:
 *           type: object
 *           properties:
 *             foundDate:
 *               type: string
 *               format: date-time
 *               description: When the item was found
 *             claimedDate:
 *               type: string
 *               format: date-time
 *               description: When the item was claimed
 *             disposalDate:
 *               type: string
 *               format: date-time
 *               description: When the item was disposed
 *             expiryDate:
 *               type: string
 *               format: date-time
 *               description: When the item expires from storage
 *         people:
 *           type: object
 *           properties:
 *             foundBy:
 *               type: string
 *               description: User who found the item
 *             claimedBy:
 *               type: string
 *               description: User who claimed the item
 *             reportedBy:
 *               type: string
 *               description: User who reported the item as lost
 *         guest:
 *           type: object
 *           properties:
 *             guestId:
 *               type: string
 *               description: Guest ID if associated with a guest
 *             guestName:
 *               type: string
 *               description: Guest name
 *             guestContact:
 *               type: string
 *               description: Guest contact information
 *             bookingId:
 *               type: string
 *               description: Associated booking ID
 *         value:
 *           type: object
 *           properties:
 *             estimatedValue:
 *               type: number
 *               description: Estimated value of the item
 *             currency:
 *               type: string
 *               description: Currency of the value
 *             isValuable:
 *               type: boolean
 *               description: Whether the item is considered valuable
 *         photos:
 *           type: array
 *           items:
 *             type: string
 *           description: URLs of item photos
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           description: Tags for categorization and search
 *         notes:
 *           type: string
 *           description: Additional notes about the item
 *         actions:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [found, moved, contacted_guest, claimed, disposed, transferred]
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *               performedBy:
 *                 type: string
 *               notes:
 *                 type: string
 *         hotelId:
 *           type: string
 *           description: Hotel ID this item belongs to
 *         createdBy:
 *           type: string
 *           description: User who created this record
 *         updatedBy:
 *           type: string
 *           description: User who last updated this record
 */

const lostFoundSchema = new mongoose.Schema({
  itemName: {
    type: String,
    required: [true, 'Item name is required'],
    trim: true,
    maxLength: [200, 'Item name cannot exceed 200 characters'],
    index: true
  },
  description: {
    type: String,
    maxLength: [1000, 'Description cannot exceed 1000 characters']
  },
  category: {
    type: String,
    required: [true, 'Item category is required'],
    enum: [
      'electronics', 'clothing', 'documents', 'valuables', 
      'personal_items', 'luggage', 'accessories', 'other'
    ],
    index: true
  },
  subcategory: {
    type: String,
    trim: true,
    maxLength: [100, 'Subcategory cannot exceed 100 characters']
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: ['found', 'claimed', 'disposed', 'transferred', 'pending'],
    default: 'found',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    index: true
  },
  location: {
    foundLocation: {
      type: String,
      required: [true, 'Found location is required'],
      trim: true,
      maxLength: [200, 'Found location cannot exceed 200 characters']
    },
    currentLocation: {
      type: String,
      required: [true, 'Current location is required'],
      trim: true,
      maxLength: [200, 'Current location cannot exceed 200 characters']
    },
    storageDetails: {
      type: String,
      maxLength: [500, 'Storage details cannot exceed 500 characters']
    }
  },
  dates: {
    foundDate: {
      type: Date,
      required: [true, 'Found date is required'],
      default: Date.now
    },
    claimedDate: {
      type: Date
    },
    disposalDate: {
      type: Date
    },
    expiryDate: {
      type: Date
    }
  },
  people: {
    foundBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Found by user is required']
    },
    claimedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    reportedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    }
  },
  guest: {
    guestId: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    guestName: {
      type: String,
      trim: true,
      maxLength: [100, 'Guest name cannot exceed 100 characters']
    },
    guestContact: {
      type: String,
      trim: true,
      maxLength: [200, 'Guest contact cannot exceed 200 characters']
    },
    bookingId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Booking'
    }
  },
  value: {
    estimatedValue: {
      type: Number,
      min: 0
    },
    currency: {
      type: String,
      uppercase: true,
      maxLength: 3,
      default: 'USD'
    },
    isValuable: {
      type: Boolean,
      default: false
    }
  },
  photos: [{
    type: String,
    trim: true
  }],
  tags: [{
    type: String,
    trim: true,
    maxLength: [50, 'Tag cannot exceed 50 characters']
  }],
  notes: {
    type: String,
    maxLength: [1000, 'Notes cannot exceed 1000 characters']
  },
  actions: [{
    action: {
      type: String,
      enum: ['found', 'moved', 'contacted_guest', 'claimed', 'disposed', 'transferred'],
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    performedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true
    },
    notes: {
      type: String,
      maxLength: [500, 'Action notes cannot exceed 500 characters']
    }
  }],
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
lostFoundSchema.index({ hotelId: 1, status: 1 });
lostFoundSchema.index({ hotelId: 1, category: 1 });
lostFoundSchema.index({ hotelId: 1, priority: 1 });
lostFoundSchema.index({ hotelId: 1, 'dates.foundDate': 1 });
lostFoundSchema.index({ hotelId: 1, 'guest.guestId': 1 });
lostFoundSchema.index({ hotelId: 1, tags: 1 });

// Text search index
lostFoundSchema.index({
  itemName: 'text',
  description: 'text',
  tags: 'text',
  'location.foundLocation': 'text',
  'location.currentLocation': 'text'
});

// Virtual for days since found
lostFoundSchema.virtual('daysSinceFound').get(function() {
  const now = new Date();
  const foundDate = new Date(this.dates.foundDate);
  const diffTime = Math.abs(now - foundDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for is expired
lostFoundSchema.virtual('isExpired').get(function() {
  if (!this.dates.expiryDate) return false;
  return new Date() > new Date(this.dates.expiryDate);
});

// Virtual for is valuable
lostFoundSchema.virtual('isValuableItem').get(function() {
  return this.value.isValuable || (this.value.estimatedValue && this.value.estimatedValue > 100);
});

// Instance methods
lostFoundSchema.methods.addAction = function(action, performedBy, notes = '') {
  this.actions.push({
    action,
    performedBy,
    notes,
    timestamp: new Date()
  });
  
  // Update status based on action
  if (action === 'claimed') {
    this.status = 'claimed';
    this.dates.claimedDate = new Date();
    this.people.claimedBy = performedBy;
  } else if (action === 'disposed') {
    this.status = 'disposed';
    this.dates.disposalDate = new Date();
  } else if (action === 'transferred') {
    this.status = 'transferred';
  }
  
  return this.save();
};

lostFoundSchema.methods.updateLocation = function(newLocation, performedBy, notes = '') {
  const oldLocation = this.location.currentLocation;
  this.location.currentLocation = newLocation;
  
  this.addAction('moved', performedBy, `Moved from ${oldLocation} to ${newLocation}. ${notes}`);
  
  return this.save();
};

lostFoundSchema.methods.contactGuest = function(performedBy, notes = '') {
  this.addAction('contacted_guest', performedBy, notes);
  return this.save();
};

lostFoundSchema.methods.claimItem = function(claimedBy, notes = '') {
  this.addAction('claimed', claimedBy, notes);
  return this.save();
};

lostFoundSchema.methods.disposeItem = function(performedBy, notes = '') {
  this.addAction('disposed', performedBy, notes);
  return this.save();
};

// Static methods
lostFoundSchema.statics.getByStatus = function(hotelId, status) {
  return this.find({ hotelId, status })
    .sort({ 'dates.foundDate': -1 })
    .populate('people.foundBy people.claimedBy people.reportedBy', 'name email')
    .populate('guest.guestId', 'name email phone');
};

lostFoundSchema.statics.getByCategory = function(hotelId, category) {
  return this.find({ hotelId, category })
    .sort({ 'dates.foundDate': -1 })
    .populate('people.foundBy people.claimedBy people.reportedBy', 'name email');
};

lostFoundSchema.statics.getValuableItems = function(hotelId) {
  return this.find({ 
    hotelId, 
    $or: [
      { 'value.isValuable': true },
      { 'value.estimatedValue': { $gt: 100 } }
    ]
  })
    .sort({ 'dates.foundDate': -1 })
    .populate('people.foundBy people.claimedBy people.reportedBy', 'name email');
};

lostFoundSchema.statics.getExpiredItems = function(hotelId) {
  return this.find({ 
    hotelId, 
    'dates.expiryDate': { $lt: new Date() },
    status: { $in: ['found', 'pending'] }
  })
    .sort({ 'dates.expiryDate': 1 })
    .populate('people.foundBy people.claimedBy people.reportedBy', 'name email');
};

lostFoundSchema.statics.searchItems = function(hotelId, searchTerm) {
  return this.find({
    hotelId,
    $text: { $search: searchTerm }
  })
    .sort({ score: { $meta: 'textScore' } })
    .populate('people.foundBy people.claimedBy people.reportedBy', 'name email');
};

lostFoundSchema.statics.getLostFoundAnalytics = function(hotelId, dateRange) {
  const pipeline = [
    { $match: { hotelId: new mongoose.Types.ObjectId(hotelId) } },
    {
      $group: {
        _id: '$category',
        totalItems: { $sum: 1 },
        foundItems: {
          $sum: { $cond: [{ $eq: ['$status', 'found'] }, 1, 0] }
        },
        claimedItems: {
          $sum: { $cond: [{ $eq: ['$status', 'claimed'] }, 1, 0] }
        },
        disposedItems: {
          $sum: { $cond: [{ $eq: ['$status', 'disposed'] }, 1, 0] }
        },
        avgValue: { $avg: '$value.estimatedValue' },
        valuableItems: {
          $sum: { $cond: ['$value.isValuable', 1, 0] }
        }
      }
    },
    { $sort: { _id: 1 } }
  ];

  return this.aggregate(pipeline);
};

// Pre-save middleware
lostFoundSchema.pre('save', function(next) {
  // Set expiry date if not set (default 90 days)
  if (!this.dates.expiryDate && this.status === 'found') {
    const expiryDate = new Date(this.dates.foundDate);
    expiryDate.setDate(expiryDate.getDate() + 90);
    this.dates.expiryDate = expiryDate;
  }

  // Update isValuable based on estimated value
  if (this.value.estimatedValue && this.value.estimatedValue > 100) {
    this.value.isValuable = true;
  }

  next();
});

const LostFound = mongoose.model('LostFound', lostFoundSchema);

export default LostFound;
