import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     LocalAttraction:
 *       type: object
 *       required:
 *         - name
 *         - category
 *         - distance
 *         - hotelId
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *           description: Name of the local attraction
 *         description:
 *           type: string
 *           description: Brief description of the attraction
 *         category:
 *           type: string
 *           enum: [amenities, dining, attractions, shopping, transport, medical, entertainment]
 *           description: Category of the attraction
 *         distance:
 *           type: number
 *           description: Distance from hotel in miles
 *         distanceText:
 *           type: string
 *           description: Human readable distance (e.g., "0.5 miles away")
 *         address:
 *           type: string
 *           description: Full address of the attraction
 *         coordinates:
 *           type: object
 *           properties:
 *             lat:
 *               type: number
 *             lng:
 *               type: number
 *         rating:
 *           type: number
 *           minimum: 1
 *           maximum: 5
 *           description: Rating out of 5 stars
 *         imageUrl:
 *           type: string
 *           description: URL to attraction image
 *         website:
 *           type: string
 *           description: Website URL
 *         phone:
 *           type: string
 *           description: Contact phone number
 *         openingHours:
 *           type: object
 *           properties:
 *             monday:
 *               type: string
 *             tuesday:
 *               type: string
 *             wednesday:
 *               type: string
 *             thursday:
 *               type: string
 *             friday:
 *               type: string
 *             saturday:
 *               type: string
 *             sunday:
 *               type: string
 *         hotelId:
 *           type: string
 *           description: Associated hotel ID
 *         isActive:
 *           type: boolean
 *           default: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const localAttractionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Attraction name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: ['amenities', 'dining', 'attractions', 'shopping', 'transport', 'medical', 'entertainment'],
      message: 'Invalid category'
    }
  },
  distance: {
    type: Number,
    required: [true, 'Distance is required'],
    min: [0, 'Distance cannot be negative'],
    max: [50, 'Distance cannot exceed 50 miles']
  },
  distanceText: {
    type: String,
    required: [true, 'Distance text is required'],
    trim: true
  },
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true
  },
  coordinates: {
    lat: {
      type: Number,
      required: [true, 'Latitude is required'],
      min: [-90, 'Invalid latitude'],
      max: [90, 'Invalid latitude']
    },
    lng: {
      type: Number,
      required: [true, 'Longitude is required'],
      min: [-180, 'Invalid longitude'],
      max: [180, 'Invalid longitude']
    }
  },
  rating: {
    type: Number,
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5'],
    default: 4.0
  },
  imageUrl: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'Invalid image URL'
    }
  },
  website: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'Invalid website URL'
    }
  },
  phone: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || /^\+?[\d\s-()]+$/.test(v);
      },
      message: 'Invalid phone number format'
    }
  },
  openingHours: {
    monday: { type: String, default: 'Closed' },
    tuesday: { type: String, default: 'Closed' },
    wednesday: { type: String, default: 'Closed' },
    thursday: { type: String, default: 'Closed' },
    friday: { type: String, default: 'Closed' },
    saturday: { type: String, default: 'Closed' },
    sunday: { type: String, default: 'Closed' }
  },
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
localAttractionSchema.index({ hotelId: 1, category: 1 });
localAttractionSchema.index({ hotelId: 1, distance: 1 });
localAttractionSchema.index({ hotelId: 1, isActive: 1 });
localAttractionSchema.index({ coordinates: '2dsphere' }); // For geo queries

// Virtual for formatted rating
localAttractionSchema.virtual('ratingStars').get(function() {
  return '⭐'.repeat(Math.floor(this.rating));
});

// Method to calculate walking time based on distance
localAttractionSchema.methods.getWalkingTime = function() {
  // Average walking speed: 3 mph
  const walkingTimeHours = this.distance / 3;
  const walkingTimeMinutes = Math.round(walkingTimeHours * 60);
  
  if (walkingTimeMinutes < 5) return '< 5 min walk';
  if (walkingTimeMinutes < 60) return `${walkingTimeMinutes} min walk`;
  
  const hours = Math.floor(walkingTimeMinutes / 60);
  const minutes = walkingTimeMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m walk` : `${hours}h walk`;
};

// Static method to get attractions by category
localAttractionSchema.statics.getByCategory = async function(hotelId, category) {
  return await this.find({ 
    hotelId, 
    category, 
    isActive: true 
  }).sort({ distance: 1 });
};

// Static method to get nearby attractions within distance
localAttractionSchema.statics.getNearby = async function(hotelId, maxDistance = 5) {
  return await this.find({
    hotelId,
    distance: { $lte: maxDistance },
    isActive: true
  }).sort({ distance: 1 });
};

export default mongoose.model('LocalAttraction', localAttractionSchema);
