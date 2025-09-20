import mongoose from 'mongoose';

const requestTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  department: {
    type: String,
    required: true,
    enum: ['housekeeping', 'kitchen', 'maintenance', 'front_desk', 'office', 'security', 'laundry', 'restaurant', 'spa', 'gym']
  },
  category: {
    type: String,
    required: true,
    enum: ['cleaning', 'consumables', 'linens', 'kitchen', 'office', 'tools', 'electronics', 'safety', 'ingredients', 'stationery', 'electrical', 'chemicals', 'supplies']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent', 'emergency'],
    default: 'medium'
  },
  estimatedBudget: {
    type: Number,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  useCount: {
    type: Number,
    default: 0
  },
  tags: [{
    type: String,
    trim: true
  }],
  items: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    category: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unit: {
      type: String,
      required: true,
      trim: true
    },
    estimatedCost: {
      type: Number,
      required: true,
      min: 0
    },
    supplier: {
      type: String,
      trim: true
    }
  }],
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for better performance
requestTemplateSchema.index({ department: 1, isActive: 1 });
requestTemplateSchema.index({ category: 1, isActive: 1 });
requestTemplateSchema.index({ hotelId: 1, department: 1 });
requestTemplateSchema.index({ tags: 1 });

const RequestTemplate = mongoose.model('RequestTemplate', requestTemplateSchema);

export default RequestTemplate;
