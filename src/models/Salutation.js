import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     Salutation:
 *       type: object
 *       required:
 *         - title
 *         - category
 *         - isActive
 *       properties:
 *         _id:
 *           type: string
 *           description: Salutation ID
 *         title:
 *           type: string
 *           description: Salutation title (e.g., Mr, Mrs, Dr)
 *         fullForm:
 *           type: string
 *           description: Full form of the salutation (e.g., Mister, Mistress, Doctor)
 *         category:
 *           type: string
 *           enum: [personal, professional, religious, cultural, academic]
 *           description: Category of the salutation
 *         gender:
 *           type: string
 *           enum: [male, female, neutral, any]
 *           default: any
 *           description: Gender association
 *         language:
 *           type: string
 *           default: en
 *           description: Language code
 *         region:
 *           type: string
 *           description: Regional variant (e.g., US, UK, IN)
 *         sortOrder:
 *           type: number
 *           default: 0
 *           description: Display order
 *         isActive:
 *           type: boolean
 *           default: true
 *         hotelId:
 *           type: string
 *           description: Hotel ID (null for global salutations)
 *         createdBy:
 *           type: string
 *           description: User who created this salutation
 *         updatedBy:
 *           type: string
 *           description: User who last updated this salutation
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const salutationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Salutation title is required'],
    trim: true,
    maxlength: [20, 'Title cannot be more than 20 characters']
  },
  fullForm: {
    type: String,
    trim: true,
    maxlength: [50, 'Full form cannot be more than 50 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: ['personal', 'professional', 'religious', 'cultural', 'academic'],
      message: 'Invalid category'
    }
  },
  gender: {
    type: String,
    enum: {
      values: ['male', 'female', 'neutral', 'any'],
      message: 'Invalid gender'
    },
    default: 'any'
  },
  language: {
    type: String,
    default: 'en',
    maxlength: [5, 'Language code cannot be more than 5 characters']
  },
  region: {
    type: String,
    trim: true,
    maxlength: [10, 'Region cannot be more than 10 characters']
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    default: null // null for global salutations
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
salutationSchema.index({ hotelId: 1, isActive: 1, sortOrder: 1 });
salutationSchema.index({ category: 1, gender: 1 });
salutationSchema.index({ language: 1, region: 1 });

// Compound index for unique salutation per hotel
salutationSchema.index({ title: 1, hotelId: 1 }, { unique: true });

// Pre-save middleware to set updatedBy
salutationSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedBy = this.createdBy; // This will be updated by controller
  }
  next();
});

// Static method to get salutations by category
salutationSchema.statics.getByCategory = function(category, hotelId = null) {
  const query = { category, isActive: true };
  if (hotelId) {
    query.$or = [
      { hotelId: hotelId },
      { hotelId: null } // Include global salutations
    ];
  } else {
    query.hotelId = null; // Only global salutations
  }
  
  return this.find(query).sort({ sortOrder: 1, title: 1 });
};

// Static method to get salutations by gender
salutationSchema.statics.getByGender = function(gender, hotelId = null) {
  const query = { 
    $or: [
      { gender: gender },
      { gender: 'any' }
    ],
    isActive: true 
  };
  
  if (hotelId) {
    query.$or = [
      { hotelId: hotelId },
      { hotelId: null }
    ];
  } else {
    query.hotelId = null;
  }
  
  return this.find(query).sort({ sortOrder: 1, title: 1 });
};

// Static method to seed default salutations
salutationSchema.statics.seedDefaultSalutations = async function(createdBy) {
  const defaultSalutations = [
    // Personal
    { title: 'Mr', fullForm: 'Mister', category: 'personal', gender: 'male', sortOrder: 1 },
    { title: 'Mrs', fullForm: 'Mistress', category: 'personal', gender: 'female', sortOrder: 2 },
    { title: 'Miss', fullForm: 'Miss', category: 'personal', gender: 'female', sortOrder: 3 },
    { title: 'Ms', fullForm: 'Ms', category: 'personal', gender: 'female', sortOrder: 4 },
    
    // Professional
    { title: 'Dr', fullForm: 'Doctor', category: 'professional', gender: 'any', sortOrder: 5 },
    { title: 'Prof', fullForm: 'Professor', category: 'professional', gender: 'any', sortOrder: 6 },
    { title: 'Capt', fullForm: 'Captain', category: 'professional', gender: 'any', sortOrder: 7 },
    { title: 'Col', fullForm: 'Colonel', category: 'professional', gender: 'any', sortOrder: 8 },
    { title: 'Maj', fullForm: 'Major', category: 'professional', gender: 'any', sortOrder: 9 },
    { title: 'Lt', fullForm: 'Lieutenant', category: 'professional', gender: 'any', sortOrder: 10 },
    
    // Religious
    { title: 'Rev', fullForm: 'Reverend', category: 'religious', gender: 'any', sortOrder: 11 },
    { title: 'Fr', fullForm: 'Father', category: 'religious', gender: 'male', sortOrder: 12 },
    { title: 'Sr', fullForm: 'Sister', category: 'religious', gender: 'female', sortOrder: 13 },
    
    // Academic
    { title: 'Sir', fullForm: 'Sir', category: 'academic', gender: 'male', sortOrder: 14 },
    { title: 'Dame', fullForm: 'Dame', category: 'academic', gender: 'female', sortOrder: 15 },
    
    // Cultural (Indian)
    { title: 'Shri', fullForm: 'Shri', category: 'cultural', gender: 'male', region: 'IN', sortOrder: 16 },
    { title: 'Smt', fullForm: 'Smt', category: 'cultural', gender: 'female', region: 'IN', sortOrder: 17 },
    { title: 'Kumari', fullForm: 'Kumari', category: 'cultural', gender: 'female', region: 'IN', sortOrder: 18 },
    { title: 'Sri', fullForm: 'Sri', category: 'cultural', gender: 'male', region: 'IN', sortOrder: 19 }
  ];

  // Check if salutations already exist
  const existingCount = await this.countDocuments({ hotelId: null });
  if (existingCount > 0) {
    return { message: 'Default salutations already exist', count: existingCount };
  }

  // Add createdBy to all salutations
  const salutationsToCreate = defaultSalutations.map(sal => ({
    ...sal,
    createdBy,
    hotelId: null // Global salutations
  }));

  const createdSalutations = await this.insertMany(salutationsToCreate);
  return { message: 'Default salutations created successfully', count: createdSalutations.length };
};

export default mongoose.model('Salutation', salutationSchema);
