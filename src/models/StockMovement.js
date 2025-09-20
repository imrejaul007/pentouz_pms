import mongoose from 'mongoose';

const StockMovementSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  inventoryItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    required: true,
    index: true
  },
  transactionType: {
    type: String,
    enum: ['IN', 'OUT', 'TRANSFER', 'ADJUSTMENT', 'REORDER', 'CONSUMPTION'],
    required: true,
    index: true
  },
  quantity: {
    type: Number,
    required: true
  },
  previousQuantity: {
    type: Number,
    required: true
  },
  newQuantity: {
    type: Number,
    required: true
  },
  unitCost: {
    type: Number,
    default: 0,
    min: 0
  },
  totalCost: {
    type: Number,
    default: 0
  },
  reason: {
    type: String,
    required: true,
    maxlength: 500
  },
  reference: {
    type: {
      type: String,
      enum: ['booking', 'request', 'delivery', 'manual', 'housekeeping', 'guest_service', 'supply_request', 'reconciliation']
    },
    id: {
      type: String
    },
    description: {
      type: String,
      maxlength: 300
    }
  },
  location: {
    from: {
      building: {
        type: String,
        maxlength: 100
      },
      floor: {
        type: String,
        maxlength: 50
      },
      room: {
        type: String,
        maxlength: 50
      },
      shelf: {
        type: String,
        maxlength: 50
      }
    },
    to: {
      building: {
        type: String,
        maxlength: 100
      },
      floor: {
        type: String,
        maxlength: 50
      },
      room: {
        type: String,
        maxlength: 50
      },
      shelf: {
        type: String,
        maxlength: 50
      }
    }
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  supplier: {
    name: {
      type: String,
      maxlength: 200
    },
    contact: {
      type: String,
      maxlength: 20
    },
    email: {
      type: String,
      maxlength: 100
    },
    invoiceNumber: {
      type: String,
      maxlength: 100
    }
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled'],
    default: 'completed',
    index: true
  },
  timestamps: {
    created: {
      type: Date,
      default: Date.now,
      index: true
    },
    updated: {
      type: Date,
      default: Date.now
    },
    completed: {
      type: Date
    }
  }
}, {
  timestamps: false // We use custom timestamps
});

// Compound indexes for efficient queries
StockMovementSchema.index({ hotelId: 1, inventoryItemId: 1, 'timestamps.created': -1 });
StockMovementSchema.index({ hotelId: 1, transactionType: 1, 'timestamps.created': -1 });
StockMovementSchema.index({ hotelId: 1, performedBy: 1, 'timestamps.created': -1 });
StockMovementSchema.index({ hotelId: 1, status: 1, 'timestamps.created': -1 });
StockMovementSchema.index({ 'reference.type': 1, 'reference.id': 1 });

// Virtual for formatted quantity display
StockMovementSchema.virtual('formattedQuantity').get(function() {
  const sign = this.quantity >= 0 ? '+' : '';
  return `${sign}${this.quantity}`;
});

// Virtual for transaction value
StockMovementSchema.virtual('transactionValue').get(function() {
  return Math.abs(this.quantity) * this.unitCost;
});

// Virtual for location display
StockMovementSchema.virtual('locationDisplay').get(function() {
  if (this.transactionType === 'TRANSFER' && this.location) {
    const from = this.location.from ?
      [this.location.from.building, this.location.from.floor, this.location.from.room, this.location.from.shelf]
        .filter(Boolean).join(' - ') : 'Unknown';
    const to = this.location.to ?
      [this.location.to.building, this.location.to.floor, this.location.to.room, this.location.to.shelf]
        .filter(Boolean).join(' - ') : 'Unknown';
    return `${from} → ${to}`;
  }
  return null;
});

// Pre-save middleware
StockMovementSchema.pre('save', function(next) {
  // Update timestamps
  this.timestamps.updated = new Date();

  // Set completed timestamp for completed transactions
  if (this.status === 'completed' && !this.timestamps.completed) {
    this.timestamps.completed = new Date();
  }

  // Calculate total cost
  if (this.quantity && this.unitCost) {
    this.totalCost = Math.abs(this.quantity) * this.unitCost;
  }

  // Validate quantity changes make sense
  if (this.transactionType === 'IN' && this.quantity <= 0) {
    return next(new Error('IN transactions must have positive quantity'));
  }
  if (this.transactionType === 'OUT' && this.quantity >= 0) {
    return next(new Error('OUT transactions must have negative quantity'));
  }
  if (this.transactionType === 'CONSUMPTION' && this.quantity >= 0) {
    return next(new Error('CONSUMPTION transactions must have negative quantity'));
  }

  // Validate new quantity calculation
  const expectedNewQuantity = this.previousQuantity + this.quantity;
  if (Math.abs(this.newQuantity - expectedNewQuantity) > 0.001) {
    return next(new Error('New quantity calculation is incorrect'));
  }

  next();
});

// Static methods for analytics
StockMovementSchema.statics.getTransactionSummary = async function(hotelId, filters = {}) {
  const matchStage = { hotelId: mongoose.Types.ObjectId(hotelId), ...filters };

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: '$transactionType',
        count: { $sum: 1 },
        totalQuantity: { $sum: '$quantity' },
        totalValue: { $sum: '$totalCost' },
        avgQuantity: { $avg: '$quantity' }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ];

  return await this.aggregate(pipeline);
};

StockMovementSchema.statics.getItemUsagePattern = async function(hotelId, itemId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const pipeline = [
    {
      $match: {
        hotelId: mongoose.Types.ObjectId(hotelId),
        inventoryItemId: mongoose.Types.ObjectId(itemId),
        'timestamps.created': { $gte: startDate },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$timestamps.created' },
          month: { $month: '$timestamps.created' },
          day: { $dayOfMonth: '$timestamps.created' }
        },
        totalIn: {
          $sum: {
            $cond: [{ $in: ['$transactionType', ['IN', 'REORDER']] }, '$quantity', 0]
          }
        },
        totalOut: {
          $sum: {
            $cond: [{ $in: ['$transactionType', ['OUT', 'CONSUMPTION']] }, { $abs: '$quantity' }, 0]
          }
        },
        transactionCount: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
    }
  ];

  return await this.aggregate(pipeline);
};

StockMovementSchema.statics.getUserActivitySummary = async function(hotelId, userId, startDate, endDate) {
  const pipeline = [
    {
      $match: {
        hotelId: mongoose.Types.ObjectId(hotelId),
        performedBy: mongoose.Types.ObjectId(userId),
        'timestamps.created': {
          $gte: startDate,
          $lte: endDate
        },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: '$transactionType',
        count: { $sum: 1 },
        totalQuantity: { $sum: { $abs: '$quantity' } },
        totalValue: { $sum: '$totalCost' }
      }
    }
  ];

  return await this.aggregate(pipeline);
};

StockMovementSchema.statics.getInventoryTrends = async function(hotelId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const pipeline = [
    {
      $match: {
        hotelId: mongoose.Types.ObjectId(hotelId),
        'timestamps.created': { $gte: startDate },
        status: 'completed'
      }
    },
    {
      $lookup: {
        from: 'inventories',
        localField: 'inventoryItemId',
        foreignField: '_id',
        as: 'item'
      }
    },
    {
      $unwind: '$item'
    },
    {
      $group: {
        _id: {
          category: '$item.category',
          date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$timestamps.created'
            }
          }
        },
        totalIn: {
          $sum: {
            $cond: [{ $in: ['$transactionType', ['IN', 'REORDER']] }, '$quantity', 0]
          }
        },
        totalOut: {
          $sum: {
            $cond: [{ $in: ['$transactionType', ['OUT', 'CONSUMPTION']] }, { $abs: '$quantity' }, 0]
          }
        },
        totalValue: { $sum: '$totalCost' }
      }
    },
    {
      $sort: { '_id.date': 1, '_id.category': 1 }
    }
  ];

  return await this.aggregate(pipeline);
};

const StockMovement = mongoose.model('StockMovement', StockMovementSchema);

export default StockMovement;
