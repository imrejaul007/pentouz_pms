import mongoose from 'mongoose';

const housekeepingSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: true
  },
  roomId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Room',
    required: true
  },
  taskType: {
    type: String,
    enum: ['cleaning', 'maintenance', 'inspection', 'deep_clean', 'checkout_clean'],
    required: true
  },
  // Support both field names for backward compatibility
  type: {
    type: String,
    enum: ['cleaning', 'maintenance', 'inspection', 'deep_clean', 'checkout_clean']
  },
  title: {
    type: String,
    required: true
  },
  description: String,
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  // Support both field names for backward compatibility
  assignedToUserId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  assignedTo: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  estimatedDuration: {
    type: Number, // minutes
    default: 30
  },
  startedAt: Date,
  completedAt: Date,
  actualDuration: Number, // minutes
  notes: String,
  supplies: [{
    name: String,
    quantity: Number,
    unit: String
  }],
  beforeImages: [String],
  afterImages: [String],
  // Additional fields from seed data
  checkIn: Date,
  checkOut: Date,
  roomStatus: {
    type: String,
    enum: ['dirty', 'clean', 'inspected', 'maintenance_required']
  },
  timeSpent: Number // minutes
}, {
  timestamps: true
});

// Indexes
housekeepingSchema.index({ hotelId: 1, status: 1 });
housekeepingSchema.index({ roomId: 1, status: 1 });
housekeepingSchema.index({ assignedToUserId: 1, status: 1 });

// Handle field compatibility and calculate actual duration
housekeepingSchema.pre('save', function(next) {
  // Handle backward compatibility for field names
  if (this.type && !this.taskType) {
    this.taskType = this.type;
  }
  if (this.taskType && !this.type) {
    this.type = this.taskType;
  }
  
  if (this.assignedTo && !this.assignedToUserId) {
    this.assignedToUserId = this.assignedTo;
  }
  if (this.assignedToUserId && !this.assignedTo) {
    this.assignedTo = this.assignedToUserId;
  }

  // Calculate actual duration when completed
  if (this.isModified('completedAt') && this.startedAt && this.completedAt) {
    this.actualDuration = Math.round((this.completedAt - this.startedAt) / (1000 * 60));
  }
  
  // Use timeSpent as actualDuration if available
  if (this.timeSpent && !this.actualDuration) {
    this.actualDuration = this.timeSpent;
  }
  
  next();
});

export default mongoose.model('Housekeeping', housekeepingSchema);
