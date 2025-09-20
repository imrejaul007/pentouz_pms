import mongoose from 'mongoose';

const dailyRoutineCheckTemplateSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: true
  },
  roomType: {
    type: String,
    required: true,
    enum: ['single', 'double', 'suite', 'deluxe']
  },
  fixedInventory: [{
    name: {
      type: String,
      required: true
    },
    category: {
      type: String,
      required: true,
      enum: ['electronics', 'furniture', 'appliances', 'fixtures', 'other']
    },
    description: String,
    unitPrice: {
      type: Number,
      default: 0
    },
    standardQuantity: {
      type: Number,
      default: 1
    },
    checkInstructions: String,
    expectedCondition: {
      type: String,
      enum: ['working', 'clean', 'undamaged', 'functional'],
      default: 'working'
    }
  }],
  dailyInventory: [{
    name: {
      type: String,
      required: true
    },
    category: {
      type: String,
      required: true,
      enum: ['bathroom', 'bedroom', 'kitchen', 'amenities', 'other']
    },
    description: String,
    unitPrice: {
      type: Number,
      default: 0
    },
    standardQuantity: {
      type: Number,
      default: 1
    },
    checkInstructions: String,
    expectedCondition: {
      type: String,
      enum: ['clean', 'fresh', 'undamaged', 'adequate'],
      default: 'clean'
    }
  }],
  estimatedCheckDuration: {
    type: Number, // in minutes
    default: 15
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  lastUpdatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
dailyRoutineCheckTemplateSchema.index({ hotelId: 1, roomType: 1 });
dailyRoutineCheckTemplateSchema.index({ hotelId: 1, isActive: 1 });

// Static method to get template by room type
dailyRoutineCheckTemplateSchema.statics.getByRoomType = function(hotelId, roomType) {
  return this.findOne({
    hotelId: new mongoose.Types.ObjectId(hotelId),
    roomType: roomType,
    isActive: true
  });
};

// Static method to get all templates for a hotel
dailyRoutineCheckTemplateSchema.statics.getByHotel = function(hotelId) {
  return this.find({
    hotelId: new mongoose.Types.ObjectId(hotelId),
    isActive: true
  }).sort({ roomType: 1 });
};

export default mongoose.model('DailyRoutineCheckTemplate', dailyRoutineCheckTemplateSchema);
