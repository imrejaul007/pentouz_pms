import mongoose from 'mongoose';

const housekeepingTaskSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  floorId: {
    type: Number,
    required: false
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  tasks: [{
    type: String,
    enum: ['cleaning', 'bed_making', 'bathroom', 'amenities', 'inspection'],
    required: true
  }],
  estimatedDuration: {
    type: Number, // in minutes
    required: true
  },
  actualDuration: {
    type: Number, // in minutes
    default: null
  },
  specialInstructions: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  startedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  qualityScore: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  notes: {
    type: String,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Inventory Tracking Fields
  inventoryConsumed: [{
    inventoryItemId: {
      type: mongoose.Schema.Types.ObjectId,
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
    replacementType: {
      type: String,
      enum: ['damaged', 'lost', 'wear_and_tear', 'theft', 'guest_request']
    },
    notes: String,
    recordedAt: {
      type: Date,
      default: Date.now
    }
  }],
  inventoryPredicted: [{
    inventoryItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: true
    },
    predictedQuantity: {
      type: Number,
      required: true,
      min: 0
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100
    },
    basedOnHistory: {
      type: Boolean,
      default: true
    }
  }],
  inventoryEfficiency: {
    overallScore: {
      type: Number,
      min: 0,
      max: 200,
      description: 'Overall efficiency percentage (predicted vs actual)'
    },
    itemsEfficiency: [{
      inventoryItemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'InventoryItem'
      },
      predictedQuantity: Number,
      actualQuantity: Number,
      efficiencyScore: Number
    }],
    lastCalculated: {
      type: Date,
      default: Date.now
    }
  },
  autoInventoryConsumed: {
    type: Boolean,
    default: false,
    description: 'Whether inventory was automatically consumed based on predictions'
  }
}, {
  timestamps: true
});

// Indexes for better performance
housekeepingTaskSchema.index({ hotelId: 1, status: 1 });
housekeepingTaskSchema.index({ roomId: 1, status: 1 });
housekeepingTaskSchema.index({ assignedTo: 1, status: 1 });
housekeepingTaskSchema.index({ floorId: 1, status: 1 });

// Instance methods for inventory tracking

// Add consumed inventory item
housekeepingTaskSchema.methods.addInventoryConsumption = function(inventoryData) {
  const { inventoryItemId, quantity, unitCost, replacementType, notes } = inventoryData;

  this.inventoryConsumed.push({
    inventoryItemId,
    quantity,
    unitCost,
    totalCost: quantity * unitCost,
    replacementType,
    notes,
    recordedAt: new Date()
  });

  return this.save();
};

// Add predicted inventory items
housekeepingTaskSchema.methods.addInventoryPredictions = function(predictions) {
  this.inventoryPredicted = predictions.map(pred => ({
    inventoryItemId: pred.inventoryItemId,
    predictedQuantity: pred.predictedQuantity,
    confidence: pred.confidence,
    basedOnHistory: pred.basedOnHistory !== false
  }));

  return this.save();
};

// Calculate and update inventory efficiency
housekeepingTaskSchema.methods.calculateInventoryEfficiency = function() {
  if (this.inventoryPredicted.length === 0 || this.inventoryConsumed.length === 0) {
    return;
  }

  const itemsEfficiency = [];
  let totalEfficiencyScore = 0;
  let itemCount = 0;

  for (const predicted of this.inventoryPredicted) {
    const consumed = this.inventoryConsumed.find(
      c => c.inventoryItemId.toString() === predicted.inventoryItemId.toString()
    );

    if (consumed) {
      const efficiencyScore = predicted.predictedQuantity > 0
        ? Math.round((predicted.predictedQuantity / consumed.quantity) * 100)
        : 0;

      itemsEfficiency.push({
        inventoryItemId: predicted.inventoryItemId,
        predictedQuantity: predicted.predictedQuantity,
        actualQuantity: consumed.quantity,
        efficiencyScore
      });

      totalEfficiencyScore += efficiencyScore;
      itemCount++;
    }
  }

  this.inventoryEfficiency = {
    overallScore: itemCount > 0 ? Math.round(totalEfficiencyScore / itemCount) : 0,
    itemsEfficiency,
    lastCalculated: new Date()
  };

  return this.save();
};

// Mark as auto-consumed
housekeepingTaskSchema.methods.markAutoInventoryConsumed = function() {
  this.autoInventoryConsumed = true;
  return this.save();
};

// Virtual for total inventory cost
housekeepingTaskSchema.virtual('totalInventoryCost').get(function() {
  return this.inventoryConsumed.reduce((total, item) => total + item.totalCost, 0);
});

// Virtual for inventory items count
housekeepingTaskSchema.virtual('inventoryItemsCount').get(function() {
  return this.inventoryConsumed.length;
});

// Virtual for efficiency status
housekeepingTaskSchema.virtual('efficiencyStatus').get(function() {
  if (!this.inventoryEfficiency?.overallScore) return 'unknown';

  const score = this.inventoryEfficiency.overallScore;
  if (score >= 95) return 'excellent';
  if (score >= 85) return 'good';
  if (score >= 75) return 'average';
  if (score >= 65) return 'below_average';
  return 'needs_improvement';
});

export default mongoose.model('HousekeepingTask', housekeepingTaskSchema);
