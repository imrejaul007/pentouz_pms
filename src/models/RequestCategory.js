import mongoose from 'mongoose';

const requestCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  department: {
    type: String,
    required: true,
    enum: ['housekeeping', 'kitchen', 'maintenance', 'front_desk', 'office', 'security', 'laundry', 'restaurant', 'spa', 'gym']
  },
  icon: {
    type: String,
    trim: true
  },
  color: {
    type: String,
    trim: true,
    default: '#6B7280'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  budgetAllocated: {
    type: Number,
    min: 0,
    default: 0
  },
  budgetUsed: {
    type: Number,
    min: 0,
    default: 0
  },
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
requestCategorySchema.index({ department: 1, isActive: 1 });
requestCategorySchema.index({ hotelId: 1, department: 1 });
requestCategorySchema.index({ sortOrder: 1 });

// Virtual for budget percentage used
requestCategorySchema.virtual('budgetPercentageUsed').get(function() {
  return this.budgetAllocated > 0 ? (this.budgetUsed / this.budgetAllocated) * 100 : 0;
});

requestCategorySchema.set('toJSON', { virtuals: true });

const RequestCategory = mongoose.model('RequestCategory', requestCategorySchema);

export default RequestCategory;
