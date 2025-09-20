import mongoose from 'mongoose';

const workflowActionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['checkin', 'checkout', 'housekeeping', 'maintenance', 'status_update'],
    required: true
  },
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true
  },
  roomIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  }],
  floorId: {
    type: Number,
    required: false
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'failed'],
    default: 'pending'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  completedAt: {
    type: Date,
    default: null
  },
  errorMessage: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for better performance
workflowActionSchema.index({ hotelId: 1, type: 1, status: 1 });
workflowActionSchema.index({ createdBy: 1, createdAt: -1 });
workflowActionSchema.index({ roomIds: 1 });

export default mongoose.model('WorkflowAction', workflowActionSchema);
