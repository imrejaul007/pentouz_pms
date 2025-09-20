import mongoose from 'mongoose';

const hotelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Hotel name is required'],
    trim: true,
    maxlength: [100, 'Hotel name cannot be more than 100 characters']
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  address: {
    street: String,
    city: {
      type: String,
      required: true
    },
    state: String,
    country: {
      type: String,
      required: true
    },
    zipCode: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  contact: {
    phone: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    website: String
  },
  amenities: [{
    type: String,
    trim: true
  }],
  images: [{
    type: String,
    match: [/^https?:\/\//, 'Image URL must be valid']
  }],
  policies: {
    checkInTime: {
      type: String,
      default: '15:00'
    },
    checkOutTime: {
      type: String,
      default: '11:00'
    },
    cancellationPolicy: {
      type: String,
      default: 'Free cancellation 24 hours before check-in'
    },
    petPolicy: String,
    smokingPolicy: String
  },
  settings: {
    currency: {
      type: String,
      default: 'INR'
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    language: {
      type: String,
      default: 'en'
    }
  },
  otaConnections: {
    bookingCom: {
      isEnabled: {
        type: Boolean,
        default: false
      },
      credentials: {
        clientId: String,
        clientSecret: String,
        hotelId: String
      },
      lastSync: Date
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  ownerId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  propertyGroupId: {
    type: mongoose.Schema.ObjectId,
    ref: 'PropertyGroup',
    index: true
  },
  
  // Multi-property specific settings
  groupSettings: {
    inheritSettings: {
      type: Boolean,
      default: true
    },
    lastSyncAt: Date,
    version: Date,
    overrides: {
      policies: mongoose.Schema.Types.Mixed,
      branding: mongoose.Schema.Types.Mixed,
      currencies: [String],
      languages: [String]
    }
  },
  
  // Property hierarchy
  hierarchy: {
    level: {
      type: String,
      enum: ['corporate', 'region', 'property'],
      default: 'property'
    },
    parentId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Hotel'
    },
    path: String // For hierarchical queries
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
hotelSchema.index({ ownerId: 1 });
hotelSchema.index({ 'address.city': 1, 'address.country': 1 });

// Virtual for rooms
hotelSchema.virtual('rooms', {
  ref: 'Room',
  localField: '_id',
  foreignField: 'hotelId'
});

export default mongoose.model('Hotel', hotelSchema);
