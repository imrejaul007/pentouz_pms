import mongoose from 'mongoose';

const vendorSchema = new mongoose.Schema({
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  vendorCode: {
    type: String,
    unique: true,
    required: true,
    uppercase: true,
    trim: true
  },
  contactInfo: {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      zipCode: { type: String, trim: true },
      country: { type: String, trim: true, default: 'India' },
      fullAddress: String // Combined address for display
    },
    website: { type: String, trim: true },
    primaryContact: {
      name: { type: String, trim: true },
      title: { type: String, trim: true },
      email: { type: String, lowercase: true, trim: true },
      phone: { type: String, trim: true }
    },
    alternateContact: {
      name: { type: String, trim: true },
      title: { type: String, trim: true },
      email: { type: String, lowercase: true, trim: true },
      phone: { type: String, trim: true }
    }
  },
  categories: [{
    type: String,
    enum: [
      'linens',
      'toiletries',
      'cleaning_supplies',
      'maintenance_supplies',
      'food_beverage',
      'electronics',
      'furniture',
      'hvac',
      'plumbing',
      'electrical',
      'safety_equipment',
      'office_supplies',
      'laundry_supplies',
      'guest_amenities',
      'kitchen_equipment',
      'other'
    ]
  }],
  paymentTerms: {
    paymentMethod: {
      type: String,
      enum: ['cash', 'check', 'bank_transfer', 'credit_card', 'digital_payment'],
      default: 'bank_transfer'
    },
    paymentDays: {
      type: Number,
      default: 30,
      min: 0,
      max: 365
    },
    discountTerms: { type: String, trim: true },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true
    },
    creditLimit: {
      type: Number,
      default: 0,
      min: 0
    },
    earlyPaymentDiscount: {
      percentage: { type: Number, min: 0, max: 100, default: 0 },
      days: { type: Number, min: 0, max: 30, default: 0 }
    }
  },
  deliveryInfo: {
    leadTimeDays: {
      type: Number,
      default: 7,
      min: 0,
      max: 365
    },
    deliverySchedule: { type: String, trim: true },
    deliveryAreas: [{ type: String, trim: true }],
    minimumOrderValue: {
      type: Number,
      default: 0,
      min: 0
    },
    shippingCost: {
      type: Number,
      default: 0,
      min: 0
    },
    freeShippingThreshold: {
      type: Number,
      default: 0,
      min: 0
    },
    deliveryDays: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }],
    emergencyDelivery: {
      available: { type: Boolean, default: false },
      additionalCost: { type: Number, default: 0, min: 0 },
      leadTimeHours: { type: Number, default: 24, min: 1 }
    }
  },
  contractInfo: {
    contractNumber: { type: String, trim: true },
    startDate: Date,
    endDate: Date,
    autoRenewal: { type: Boolean, default: false },
    discountTiers: [{
      minAmount: { type: Number, min: 0 },
      discountPercentage: { type: Number, min: 0, max: 100 }
    }],
    terms: { type: String, trim: true },
    warranty: { type: String, trim: true },
    returnPolicy: { type: String, trim: true }
  },
  // Legacy fields maintained for backward compatibility
  category: {
    type: String,
    enum: ['cleaning', 'general', 'food_beverage', 'maintenance', 'electronics', 'textiles', 'other']
  },
  contactPerson: { type: String, trim: true },
  email: { type: String, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  address: {
    street: String,
    city: String,
    state: String,
    country: { type: String, default: 'India' },
    zipCode: String,
    fullAddress: String
  },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  isPreferred: { type: Boolean, default: false },
  deliveryTime: { type: String, default: '3-5 days' },
  minOrderValue: { type: Number, default: 0 },
  specializations: [{ type: String, trim: true }],
  lastOrderDate: Date,
  totalOrderValue: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  // Enhanced Performance metrics
  performance: {
    overallRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 3
    },
    deliveryRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 3
    },
    qualityRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 3
    },
    serviceRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 3
    },
    priceRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 3
    },
    lastEvaluationDate: Date,
    totalOrders: {
      type: Number,
      default: 0,
      min: 0
    },
    onTimeDeliveries: {
      type: Number,
      default: 0,
      min: 0
    },
    totalOrderValue: {
      type: Number,
      default: 0,
      min: 0
    },
    averageOrderValue: {
      type: Number,
      default: 0,
      min: 0
    },
    defectRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    returnRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    responseTimeHours: {
      type: Number,
      default: 24,
      min: 0
    },
    // Legacy fields for backward compatibility
    onTimeDelivery: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    averageDeliveryTime: {
      type: Number,
      default: 0
    },
    orderCount: {
      type: Number,
      default: 0
    },
    completionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  },
  certifications: [{
    name: { type: String, trim: true },
    issuedBy: { type: String, trim: true },
    issuedDate: Date,
    expiryDate: Date,
    certificateNumber: { type: String, trim: true },
    verified: { type: Boolean, default: false }
  }],
  bankDetails: {
    accountName: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    bankName: { type: String, trim: true },
    ifscCode: { type: String, trim: true, uppercase: true },
    branchName: { type: String, trim: true }
  },
  taxInfo: {
    gstNumber: { type: String, trim: true, uppercase: true },
    panNumber: { type: String, trim: true, uppercase: true },
    taxExempt: { type: Boolean, default: false },
    taxCategory: {
      type: String,
      enum: ['regular', 'composition', 'exempt', 'unregistered'],
      default: 'regular'
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'blacklisted', 'preferred', 'pending_approval', 'suspended'],
    default: 'active'
  },
  tags: [{ type: String, trim: true, lowercase: true }],
  notes: { type: String, trim: true },
  internalNotes: { type: String, trim: true },
  emergencyContact: {
    available: { type: Boolean, default: false },
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    availableHours: { type: String, trim: true }
  },
  preferredItems: [{
    itemName: { type: String, trim: true },
    itemCode: { type: String, trim: true },
    preferredPrice: { type: Number, min: 0 },
    lastOrderDate: Date,
    specification: { type: String, trim: true }
  }],
  blacklistReason: { type: String, trim: true },
  blacklistDate: Date,
  reactivationDate: Date,
  lastContactDate: Date,
  nextReviewDate: Date,
  // Legacy contract information (maintained for backward compatibility)
  contract: {
    hasContract: { type: Boolean, default: false },
    contractStartDate: Date,
    contractEndDate: Date,
    contractValue: Number,
    renewalDate: Date
  },
  // Enhanced financial information
  financial: {
    creditLimit: { type: Number, default: 0 },
    outstandingAmount: { type: Number, default: 0 },
    paymentHistory: [{
      date: Date,
      amount: Number,
      method: String,
      status: {
        type: String,
        enum: ['paid', 'pending', 'overdue'],
        default: 'paid'
      }
    }]
  },
  // Enhanced documents management
  documents: [{
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['contract', 'certificate', 'invoice', 'agreement', 'compliance', 'license', 'insurance', 'tax_document', 'other'],
      required: true
    },
    url: { type: String, required: true, trim: true },
    uploadedDate: { type: Date, default: Date.now },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    expiryDate: Date,
    size: Number,
    verified: { type: Boolean, default: false },
    // Legacy field
    fileUrl: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  notes: { type: String, trim: true },
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
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Enhanced indexes for performance
vendorSchema.index({ hotelId: 1, status: 1 });
vendorSchema.index({ hotelId: 1, categories: 1 });
vendorSchema.index({ hotelId: 1, 'performance.overallRating': -1 });
vendorSchema.index({ vendorCode: 1 }, { unique: true });
vendorSchema.index({ 'contactInfo.email': 1 });
vendorSchema.index({ name: 1, hotelId: 1 });
// Legacy indexes maintained
vendorSchema.index({ hotelId: 1, isActive: 1 });
vendorSchema.index({ hotelId: 1, category: 1 });
vendorSchema.index({ hotelId: 1, isPreferred: 1 });
vendorSchema.index({ email: 1 });
vendorSchema.index({ 'performance.rating': -1 });

// Enhanced virtual fields
vendorSchema.virtual('performanceMetrics').get(function() {
  const { performance } = this;
  const onTimeDeliveryPercentage = performance.totalOrders > 0
    ? (performance.onTimeDeliveries / performance.totalOrders) * 100
    : 0;

  return {
    onTimeDeliveryPercentage,
    averageOrderValue: performance.averageOrderValue,
    totalBusinessValue: performance.totalOrderValue,
    reliabilityScore: (performance.deliveryRating + performance.qualityRating) / 2,
    costEffectiveness: performance.priceRating,
    overallPerformance: performance.overallRating
  };
});

vendorSchema.virtual('contractStatus').get(function() {
  // Check new contract structure first
  if (this.contractInfo && this.contractInfo.startDate && this.contractInfo.endDate) {
    const now = new Date();
    const endDate = new Date(this.contractInfo.endDate);
    const daysToExpiry = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

    if (daysToExpiry < 0) return 'expired';
    else if (daysToExpiry <= 30) return 'expiring_soon';
    else return 'active';
  }

  // Fall back to legacy contract structure
  if (!this.contract.hasContract) return 'no_contract';
  const now = new Date();
  const endDate = new Date(this.contract.contractEndDate);
  const daysToExpiry = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

  if (daysToExpiry < 0) return 'expired';
  else if (daysToExpiry <= 30) return 'expiring_soon';
  else return 'active';
});

// Legacy virtual fields maintained for backward compatibility
vendorSchema.virtual('averageOrderValue').get(function() {
  if (this.performance.orderCount === 0) return 0;
  return this.totalOrderValue / this.performance.orderCount;
});

vendorSchema.virtual('isContractActive').get(function() {
  return this.contractStatus === 'active';
});

vendorSchema.virtual('daysSinceLastOrder').get(function() {
  if (!this.lastOrderDate) return null;
  const now = new Date();
  const diffTime = Math.abs(now - this.lastOrderDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Enhanced pre-save middleware
vendorSchema.pre('save', async function(next) {
  // Generate vendor code if new document
  if (this.isNew && !this.vendorCode) {
    const count = await this.constructor.countDocuments({ hotelId: this.hotelId });
    this.vendorCode = `VEN${String(count + 1).padStart(6, '0')}`;
  }

  // Update full address (both new and legacy structures)
  if (this.contactInfo && this.contactInfo.address) {
    const addressParts = [
      this.contactInfo.address.street,
      this.contactInfo.address.city,
      this.contactInfo.address.state,
      this.contactInfo.address.country,
      this.contactInfo.address.zipCode
    ].filter(Boolean);
    this.contactInfo.address.fullAddress = addressParts.join(', ');
  }

  // Legacy address support
  if (this.address) {
    const addressParts = [
      this.address.street,
      this.address.city,
      this.address.state,
      this.address.country,
      this.address.zipCode
    ].filter(Boolean);
    this.address.fullAddress = addressParts.join(', ');
  }

  // Update legacy fields from new structure for backward compatibility
  if (this.contactInfo) {
    this.email = this.contactInfo.email;
    this.phone = this.contactInfo.phone;
    if (this.contactInfo.primaryContact) {
      this.contactPerson = this.contactInfo.primaryContact.name;
    }
  }

  // Update average order value and performance metrics
  if (this.performance.totalOrders > 0) {
    this.performance.averageOrderValue = this.performance.totalOrderValue / this.performance.totalOrders;

    // Sync legacy fields
    this.performance.orderCount = this.performance.totalOrders;
    this.totalOrderValue = this.performance.totalOrderValue;
  }

  // Update overall rating based on performance metrics
  if (this.performance.qualityRating > 0) {
    this.rating = this.performance.qualityRating;
  }

  // Update status based on new enum values
  if (this.isActive === false && this.status === 'active') {
    this.status = 'inactive';
  } else if (this.isActive === true && this.status === 'inactive') {
    this.status = 'active';
  }

  // Set preferred status from legacy field
  if (this.isPreferred && this.status === 'active') {
    this.status = 'preferred';
  }

  next();
});

// Enhanced instance methods
vendorSchema.methods.updatePerformanceRating = function(ratings) {
  const { delivery, quality, service, price } = ratings;

  // Update individual ratings
  if (delivery !== undefined) this.performance.deliveryRating = delivery;
  if (quality !== undefined) this.performance.qualityRating = quality;
  if (service !== undefined) this.performance.serviceRating = service;
  if (price !== undefined) this.performance.priceRating = price;

  // Calculate overall rating
  const totalRatings = [
    this.performance.deliveryRating,
    this.performance.qualityRating,
    this.performance.serviceRating,
    this.performance.priceRating
  ];

  this.performance.overallRating = totalRatings.reduce((sum, rating) => sum + rating, 0) / totalRatings.length;
  this.performance.lastEvaluationDate = new Date();

  return this.save();
};

vendorSchema.methods.addOrder = function(orderValue, isOnTime = true) {
  this.performance.totalOrders += 1;
  this.performance.totalOrderValue += orderValue;

  if (isOnTime) {
    this.performance.onTimeDeliveries += 1;
  }

  this.performance.averageOrderValue = this.performance.totalOrderValue / this.performance.totalOrders;
  this.lastContactDate = new Date();
  this.lastOrderDate = new Date();

  // Update legacy fields
  this.performance.orderCount = this.performance.totalOrders;
  this.totalOrderValue = this.performance.totalOrderValue;

  return this.save();
};

vendorSchema.methods.isContractExpiring = function(days = 30) {
  // Check new contract structure first
  if (this.contractInfo && this.contractInfo.endDate) {
    const expiryDate = new Date(this.contractInfo.endDate);
    const checkDate = new Date();
    checkDate.setDate(checkDate.getDate() + days);
    return expiryDate <= checkDate;
  }

  // Fall back to legacy contract structure
  if (!this.contract.hasContract || !this.contract.contractEndDate) return false;
  const expiryDate = new Date(this.contract.contractEndDate);
  const checkDate = new Date();
  checkDate.setDate(checkDate.getDate() + days);
  return expiryDate <= checkDate;
};

// Legacy method maintained for backward compatibility
vendorSchema.methods.updatePerformance = async function(orderData) {
  this.performance.orderCount += 1;
  this.performance.totalOrders += 1;
  this.totalOrderValue += orderData.amount;
  this.performance.totalOrderValue += orderData.amount;
  this.lastOrderDate = new Date();

  if (orderData.deliveredOnTime) {
    const currentOnTime = this.performance.onTimeDelivery;
    this.performance.onTimeDelivery = ((currentOnTime * (this.performance.orderCount - 1)) + 100) / this.performance.orderCount;
    this.performance.onTimeDeliveries += 1;
  } else {
    const currentOnTime = this.performance.onTimeDelivery;
    this.performance.onTimeDelivery = (currentOnTime * (this.performance.orderCount - 1)) / this.performance.orderCount;
  }

  if (orderData.deliveryTime) {
    const currentAvg = this.performance.averageDeliveryTime;
    this.performance.averageDeliveryTime = ((currentAvg * (this.performance.orderCount - 1)) + orderData.deliveryTime) / this.performance.orderCount;
  }

  if (orderData.qualityRating) {
    const currentRating = this.performance.qualityRating;
    this.performance.qualityRating = ((currentRating * (this.performance.orderCount - 1)) + orderData.qualityRating) / this.performance.orderCount;
  }

  await this.save();
  return this;
};

vendorSchema.methods.addPayment = async function(paymentData) {
  this.financial.paymentHistory.push(paymentData);

  if (paymentData.status === 'paid') {
    this.financial.outstandingAmount = Math.max(0, this.financial.outstandingAmount - paymentData.amount);
  }

  await this.save();
  return this;
};

vendorSchema.methods.calculateReliabilityScore = function() {
  const weights = {
    onTimeDelivery: 0.3,
    qualityRating: 0.25,
    completionRate: 0.2,
    paymentCompliance: 0.15,
    orderFrequency: 0.1
  };

  let score = 0;

  // On-time delivery score (0-100)
  score += (this.performance.onTimeDelivery / 100) * weights.onTimeDelivery * 100;

  // Quality rating score (0-5 normalized to 0-100)
  score += (this.performance.qualityRating / 5) * weights.qualityRating * 100;

  // Completion rate score (0-100)
  score += (this.performance.completionRate / 100) * weights.completionRate * 100;

  // Payment compliance (based on outstanding vs credit limit)
  const paymentCompliance = this.financial.creditLimit > 0
    ? Math.max(0, 100 - (this.financial.outstandingAmount / this.financial.creditLimit) * 100)
    : 100;
  score += (paymentCompliance / 100) * weights.paymentCompliance * 100;

  // Order frequency (orders per month, capped at 10)
  const monthsSinceFirst = this.daysSinceLastOrder ? Math.max(1, this.daysSinceLastOrder / 30) : 1;
  const ordersPerMonth = Math.min(10, this.performance.orderCount / monthsSinceFirst);
  score += (ordersPerMonth / 10) * weights.orderFrequency * 100;

  return Math.round(score);
};

// Enhanced static methods
vendorSchema.statics.getActiveVendors = function(hotelId) {
  return this.find({
    hotelId,
    status: { $in: ['active', 'preferred'] }
  }).sort({ 'performance.overallRating': -1 });
};

vendorSchema.statics.getPreferredVendors = function(hotelId) {
  return this.find({
    hotelId,
    status: 'preferred'
  }).sort({ 'performance.overallRating': -1 });
};

vendorSchema.statics.getVendorsByCategory = function(hotelId, category) {
  return this.find({
    hotelId,
    categories: category,
    status: { $in: ['active', 'preferred'] }
  }).sort({ 'performance.overallRating': -1 });
};

vendorSchema.statics.getTopPerformers = function(hotelId, limit = 10) {
  return this.find({
    hotelId,
    status: { $in: ['active', 'preferred'] },
    'performance.totalOrders': { $gte: 1 }
  })
  .sort({ 'performance.overallRating': -1 })
  .limit(limit);
};

// Legacy method enhanced
vendorSchema.statics.getTopPerformersLegacy = async function(hotelId, limit = 10) {
  return this.aggregate([
    {
      $match: {
        hotelId: new mongoose.Types.ObjectId(hotelId),
        $or: [
          { isActive: true },
          { status: { $in: ['active', 'preferred'] } }
        ],
        $or: [
          { 'performance.orderCount': { $gt: 0 } },
          { 'performance.totalOrders': { $gt: 0 } }
        ]
      }
    },
    {
      $addFields: {
        reliabilityScore: {
          $add: [
            { $multiply: [{ $divide: ['$performance.onTimeDelivery', 100] }, 30] },
            { $multiply: [{ $divide: ['$performance.qualityRating', 5] }, 25] },
            { $multiply: [{ $divide: ['$performance.completionRate', 100] }, 20] },
            { $multiply: [{ $divide: [{ $ifNull: ['$performance.orderCount', '$performance.totalOrders'] }, 50] }, 15] },
            { $multiply: [{ $divide: ['$rating', 5] }, 10] }
          ]
        }
      }
    },
    { $sort: { reliabilityScore: -1 } },
    { $limit: limit }
  ]);
};

// Legacy method with enhanced compatibility
vendorSchema.statics.getVendorsByCategoryLegacy = async function(hotelId, category) {
  return this.find({
    hotelId,
    $or: [
      { category: category },
      { categories: category }
    ],
    $or: [
      { isActive: true },
      { status: { $in: ['active', 'preferred'] } }
    ]
  }).sort({ rating: -1, 'performance.onTimeDelivery': -1 });
};

vendorSchema.statics.getExpiredContracts = async function(hotelId, daysAhead = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  return this.find({
    hotelId,
    'contract.hasContract': true,
    'contract.contractEndDate': { $lte: futureDate },
    isActive: true
  });
};

vendorSchema.statics.getVendorStatistics = async function(hotelId) {
  const stats = await this.aggregate([
    { $match: { hotelId: new mongoose.Types.ObjectId(hotelId) } },
    {
      $group: {
        _id: null,
        totalVendors: { $sum: 1 },
        activeVendors: { $sum: { $cond: ['$isActive', 1, 0] } },
        preferredVendors: { $sum: { $cond: ['$isPreferred', 1, 0] } },
        totalOrderValue: { $sum: '$totalOrderValue' },
        averageRating: { $avg: '$rating' },
        averageOnTimeDelivery: { $avg: '$performance.onTimeDelivery' }
      }
    }
  ]);

  const categoryStats = await this.aggregate([
    { $match: { hotelId: new mongoose.Types.ObjectId(hotelId), isActive: true } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        averageRating: { $avg: '$rating' },
        totalOrderValue: { $sum: '$totalOrderValue' }
      }
    },
    { $sort: { count: -1 } }
  ]);

  return {
    overall: stats[0] || {
      totalVendors: 0,
      activeVendors: 0,
      preferredVendors: 0,
      totalOrderValue: 0,
      averageRating: 0,
      averageOnTimeDelivery: 0
    },
    byCategory: categoryStats
  };
};

const Vendor = mongoose.model('Vendor', vendorSchema);

export default Vendor;
