import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     CorporateCompany:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - gstNumber
 *         - hotelId
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *           description: Company name
 *         email:
 *           type: string
 *           format: email
 *           description: Primary company email
 *         phone:
 *           type: string
 *           description: Company phone number
 *         gstNumber:
 *           type: string
 *           description: GST registration number
 *         panNumber:
 *           type: string
 *           description: PAN card number
 *         address:
 *           type: object
 *           properties:
 *             street:
 *               type: string
 *             city:
 *               type: string
 *             state:
 *               type: string
 *             country:
 *               type: string
 *             zipCode:
 *               type: string
 *         creditLimit:
 *           type: number
 *           description: Maximum credit limit allowed
 *         availableCredit:
 *           type: number
 *           description: Currently available credit
 *         paymentTerms:
 *           type: number
 *           description: Payment terms in days (e.g., 30, 60, 90)
 *         hrContacts:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               designation:
 *                 type: string
 *               isPrimary:
 *                 type: boolean
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

const corporateCompanySchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required']
  },
  name: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    maxlength: [200, 'Company name cannot be more than 200 characters']
  },
  email: {
    type: String,
    required: [true, 'Company email is required'],
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    match: [/^\+?[\d\s-()]+$/, 'Please enter a valid phone number']
  },
  gstNumber: {
    type: String,
    required: [true, 'GST number is required'],
    unique: true,
    match: [/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Please enter a valid GST number']
  },
  panNumber: {
    type: String,
    match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Please enter a valid PAN number']
  },
  address: {
    street: {
      type: String,
      required: [true, 'Street address is required']
    },
    city: {
      type: String,
      required: [true, 'City is required']
    },
    state: {
      type: String,
      required: [true, 'State is required']
    },
    country: {
      type: String,
      default: 'India'
    },
    zipCode: {
      type: String,
      required: [true, 'ZIP code is required']
    }
  },
  creditLimit: {
    type: Number,
    default: 100000, // Default ₹1,00,000 credit limit
    min: [0, 'Credit limit cannot be negative']
  },
  availableCredit: {
    type: Number,
    default: function() { return this.creditLimit; },
    min: [0, 'Available credit cannot be negative']
  },
  paymentTerms: {
    type: Number,
    default: 30, // 30 days payment terms
    enum: [15, 30, 45, 60, 90],
    required: [true, 'Payment terms are required']
  },
  hrContacts: [{
    name: {
      type: String,
      required: [true, 'HR contact name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'HR contact email is required'],
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    phone: {
      type: String,
      match: [/^\+?[\d\s-()]+$/, 'Please enter a valid phone number']
    },
    designation: {
      type: String,
      trim: true
    },
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  contractDetails: {
    contractNumber: String,
    contractStartDate: Date,
    contractEndDate: Date,
    discountPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    specialTerms: String
  },
  billingCycle: {
    type: String,
    enum: ['immediate', 'weekly', 'monthly', 'quarterly'],
    default: 'monthly'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  metadata: {
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    lastModifiedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    notes: String,
    tags: [String]
  }
}, {
  timestamps: true
});

// Indexes
corporateCompanySchema.index({ hotelId: 1, name: 1 });
corporateCompanySchema.index({ gstNumber: 1 }, { unique: true });
corporateCompanySchema.index({ email: 1 });
corporateCompanySchema.index({ isActive: 1 });

// Pre-save middleware to ensure only one primary HR contact
corporateCompanySchema.pre('save', function(next) {
  if (this.hrContacts) {
    const primaryContacts = this.hrContacts.filter(contact => contact.isPrimary);
    if (primaryContacts.length > 1) {
      // If multiple primary contacts, make only the first one primary
      this.hrContacts.forEach((contact, index) => {
        contact.isPrimary = index === 0 && primaryContacts.includes(contact);
      });
    } else if (primaryContacts.length === 0 && this.hrContacts.length > 0) {
      // If no primary contact, make the first one primary
      this.hrContacts[0].isPrimary = true;
    }
  }
  next();
});

// Virtual to get primary HR contact
corporateCompanySchema.virtual('primaryHRContact').get(function() {
  return this.hrContacts.find(contact => contact.isPrimary) || this.hrContacts[0];
});

// Instance method to update available credit
corporateCompanySchema.methods.updateAvailableCredit = function(amount) {
  this.availableCredit = Math.max(0, this.availableCredit + amount);
  return this.save();
};

// Instance method to check credit availability
corporateCompanySchema.methods.hasAvailableCredit = function(amount) {
  return this.availableCredit >= amount;
};

// Static method to find companies with low credit
corporateCompanySchema.statics.findLowCreditCompanies = function(threshold = 10000) {
  return this.find({
    isActive: true,
    availableCredit: { $lt: threshold }
  });
};

export default mongoose.model('CorporateCompany', corporateCompanySchema);
