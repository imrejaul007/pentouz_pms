import mongoose from 'mongoose';

const maintenanceRequestSchema = new mongoose.Schema({
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
  issueType: {
    type: String,
    enum: ['plumbing', 'electrical', 'hvac', 'furniture', 'appliance', 'other'],
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  description: {
    type: String,
    required: true
  },
  estimatedCost: {
    type: Number,
    default: null
  },
  actualCost: {
    type: Number,
    default: null
  },
  scheduledDate: {
    type: Date,
    default: null
  },
  completedDate: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    default: null
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  images: [{
    type: String, // URLs to images
    default: []
  }],
  notes: {
    type: String,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
maintenanceRequestSchema.index({ hotelId: 1, status: 1 });
maintenanceRequestSchema.index({ roomId: 1, status: 1 });
maintenanceRequestSchema.index({ issueType: 1, priority: 1 });
maintenanceRequestSchema.index({ vendorId: 1, status: 1 });
maintenanceRequestSchema.index({ floorId: 1, status: 1 });

export default mongoose.model('MaintenanceRequest', maintenanceRequestSchema);
