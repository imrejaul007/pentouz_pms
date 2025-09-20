import mongoose from 'mongoose';

const bookingWidgetSchema = new mongoose.Schema({
  widgetId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['inline', 'popup', 'sidebar', 'floating', 'iframe'],
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  config: {
    theme: {
      primaryColor: { type: String, default: '#3b82f6' },
      secondaryColor: { type: String, default: '#f3f4f6' },
      textColor: { type: String, default: '#1f2937' },
      borderRadius: { type: String, default: '8px' },
      fontFamily: { type: String, default: 'Inter' }
    },
    layout: {
      showImages: { type: Boolean, default: true },
      showPrices: { type: Boolean, default: true },
      showAmenities: { type: Boolean, default: true },
      showReviews: { type: Boolean, default: true },
      columns: { type: Number, default: 1 },
      maxRooms: { type: Number, default: 10 }
    },
    behavior: {
      autoSearch: { type: Boolean, default: false },
      showAvailabilityCalendar: { type: Boolean, default: true },
      enableGuestSelection: { type: Boolean, default: true },
      minStayNights: { type: Number, default: 1 },
      maxStayNights: { type: Number, default: 30 },
      advanceBookingDays: { type: Number, default: 365 }
    },
    seo: {
      title: String,
      description: String,
      keywords: [String],
      canonicalUrl: String,
      structuredData: Boolean
    }
  },
  integrations: {
    googleAnalytics: String,
    facebookPixel: String,
    googleAds: String,
    hotjar: String
  },
  domains: [{
    domain: String,
    isActive: Boolean,
    sslEnabled: Boolean
  }],
  languages: [{
    code: String, // en, es, fr, etc.
    name: String,
    isDefault: Boolean,
    translations: {}
  }],
  currency: {
    primary: { type: String, default: 'INR' },
    supported: [{ type: String, default: ['INR', 'USD', 'EUR'] }],
    exchangeRates: {}
  },
  performance: {
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 },
    averageBookingValue: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

const promoCodeSchema = new mongoose.Schema({
  codeId: {
    type: String,
    required: true,
    unique: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  type: {
    type: String,
    enum: ['percentage', 'fixed_amount', 'free_night', 'upgrade'],
    required: true
  },
  discount: {
    value: { type: Number, required: true },
    maxAmount: Number, // for percentage discounts
    freeNights: Number, // for free night promotions
    upgradeRoomType: String // for upgrade promotions
  },
  conditions: {
    minBookingValue: Number,
    minNights: Number,
    maxNights: Number,
    applicableRoomTypes: [String],
    validDaysOfWeek: [Number], // 0=Sunday, 1=Monday, etc.
    blackoutDates: [Date],
    advanceBookingDays: Number,
    firstTimeGuests: Boolean,
    maxUsagePerGuest: { type: Number, default: 1 },
    combinableWithOtherOffers: Boolean
  },
  validity: {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    bookingWindow: {
      startDate: Date,
      endDate: Date
    }
  },
  usage: {
    totalUsageLimit: Number,
    currentUsage: { type: Number, default: 0 },
    usagePerDay: Number,
    dailyUsage: {}
  },
  targeting: {
    geolocations: [String], // country codes
    channels: [String],
    guestSegments: [String],
    membershipTiers: [String]
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const guestCRMSchema = new mongoose.Schema({
  guestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  profile: {
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    dateOfBirth: Date,
    gender: String,
    nationality: String,
    language: String,
    avatar: String
  },
  preferences: {
    roomType: String,
    bedType: String,
    floorLevel: String,
    smokingPreference: String,
    specialRequests: [String],
    dietaryRestrictions: [String],
    interests: [String],
    communicationPreferences: {
      email: Boolean,
      sms: Boolean,
      phone: Boolean,
      whatsapp: Boolean
    }
  },
  demographics: {
    ageGroup: String,
    incomeLevel: String,
    occupation: String,
    travelPurpose: [String], // business, leisure, family, etc.
    bookingBehavior: String // early_booker, last_minute, etc.
  },
  bookingHistory: {
    totalBookings: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    averageBookingValue: { type: Number, default: 0 },
    lastBookingDate: Date,
    favoriteRoomTypes: [String],
    seasonality: [String], // months they typically book
    leadTime: Number, // average days between booking and stay
    cancellationRate: { type: Number, default: 0 }
  },
  segmentation: {
    lifetimeValue: { type: Number, default: 0 },
    segment: {
      type: String,
      enum: ['vip', 'frequent', 'potential', 'at_risk', 'lost', 'new'],
      default: 'new'
    },
    loyaltyTier: String,
    tags: [String]
  },
  engagement: {
    emailEngagement: {
      opens: Number,
      clicks: Number,
      lastOpened: Date,
      unsubscribed: Boolean
    },
    websiteActivity: {
      visits: Number,
      pageViews: Number,
      lastVisit: Date,
      searchQueries: [String]
    },
    socialMedia: {
      platforms: [String],
      followers: Boolean
    }
  },
  feedback: {
    averageRating: Number,
    reviews: [{
      platform: String,
      rating: Number,
      comment: String,
      date: Date,
      response: String
    }],
    complaints: [{
      type: String,
      description: String,
      resolution: String,
      date: Date,
      resolved: Boolean
    }]
  }
}, {
  timestamps: true
});

const emailCampaignSchema = new mongoose.Schema({
  campaignId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['promotional', 'welcome', 'abandoned_booking', 'post_stay', 'newsletter', 'seasonal', 'birthday', 'anniversary'],
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'],
    default: 'draft'
  },
  content: {
    subject: { type: String, required: true },
    preheader: String,
    htmlContent: String,
    textContent: String,
    template: String,
    personalization: {
      useFirstName: Boolean,
      usePastBookings: Boolean,
      usePreferences: Boolean,
      dynamicContent: Boolean
    }
  },
  targeting: {
    segments: [String],
    criteria: {
      bookingHistory: String,
      lastBookingDays: Number,
      spentAmount: { min: Number, max: Number },
      location: [String],
      ageGroup: [String],
      interests: [String]
    },
    excludeUnsubscribed: { type: Boolean, default: true },
    excludeRecent: { type: Number, default: 7 } // days
  },
  scheduling: {
    sendImmediately: Boolean,
    scheduledDate: Date,
    timezone: String,
    recurring: {
      enabled: Boolean,
      frequency: String, // weekly, monthly, quarterly
      endDate: Date
    }
  },
  tracking: {
    opens: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    bounces: { type: Number, default: 0 },
    unsubscribes: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    sent: { type: Number, default: 0 }
  },
  abTesting: {
    enabled: Boolean,
    variants: [{
      name: String,
      subject: String,
      content: String,
      percentage: Number
    }],
    winningVariant: String
  },
  offers: [{
    type: String,
    promoCode: String,
    discount: Number,
    validUntil: Date
  }]
}, {
  timestamps: true
});

const loyaltyProgramSchema = new mongoose.Schema({
  programId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  isActive: {
    type: Boolean,
    default: true
  },
  tiers: [{
    name: String,
    minPoints: Number,
    maxPoints: Number,
    benefits: [{
      type: String,
      description: String,
      value: String
    }],
    perks: [String],
    color: String
  }],
  pointsRules: {
    earningRates: [{
      action: String, // booking, review, referral, birthday
      pointsPerDollar: Number,
      fixedPoints: Number,
      multiplier: Number
    }],
    redemptionRates: [{
      reward: String,
      pointsRequired: Number,
      cashValue: Number
    }],
    expiration: {
      enabled: Boolean,
      months: Number,
      warningDays: Number
    }
  },
  rewards: [{
    rewardId: String,
    name: String,
    description: String,
    type: String, // discount, free_night, upgrade, gift
    pointsRequired: Number,
    availability: Number,
    validityDays: Number,
    restrictions: String
  }],
  gamification: {
    badges: [{
      name: String,
      description: String,
      icon: String,
      criteria: String
    }],
    challenges: [{
      name: String,
      description: String,
      pointsReward: Number,
      validUntil: Date
    }]
  }
}, {
  timestamps: true
});

const landingPageSchema = new mongoose.Schema({
  pageId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  slug: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['campaign', 'seasonal', 'package', 'general'],
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  content: {
    title: String,
    subtitle: String,
    description: String,
    heroImage: String,
    gallery: [String],
    features: [String],
    testimonials: [{
      name: String,
      review: String,
      rating: Number,
      avatar: String
    }]
  },
  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String],
    canonicalUrl: String,
    ogImage: String,
    structuredData: {}
  },
  design: {
    template: String,
    customCss: String,
    layout: String,
    colors: {
      primary: String,
      secondary: String,
      accent: String
    }
  },
  targeting: {
    geolocations: [String],
    devices: [String],
    sources: [String], // google, facebook, direct, etc.
    campaigns: [String]
  },
  offers: [{
    promoCode: String,
    description: String,
    validUntil: Date
  }],
  analytics: {
    views: { type: Number, default: 0 },
    uniqueViews: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 },
    bounceRate: { type: Number, default: 0 },
    averageTimeOnPage: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

const reviewManagementSchema = new mongoose.Schema({
  reviewId: {
    type: String,
    required: true,
    unique: true
  },
  platform: {
    type: String,
    enum: ['google', 'tripadvisor', 'booking.com', 'expedia', 'facebook', 'yelp', 'direct'],
    required: true
  },
  platformReviewId: String,
  guest: {
    name: String,
    email: String,
    bookingReference: String,
    verified: Boolean
  },
  content: {
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: String,
    review: String,
    pros: [String],
    cons: [String],
    roomType: String,
    stayDate: Date,
    travelType: String // business, leisure, family
  },
  categories: {
    cleanliness: Number,
    comfort: Number,
    location: Number,
    facilities: Number,
    staff: Number,
    valueForMoney: Number,
    wifi: Number
  },
  sentiment: {
    score: Number, // -1 to 1
    label: String, // negative, neutral, positive
    confidence: Number
  },
  response: {
    content: String,
    respondedBy: String,
    respondedAt: Date,
    approved: Boolean
  },
  moderation: {
    status: String, // pending, approved, rejected, flagged
    moderatedBy: String,
    moderatedAt: Date,
    reason: String
  },
  visibility: {
    isPublic: { type: Boolean, default: true },
    isPromoted: Boolean,
    isHidden: Boolean
  },
  analytics: {
    helpfulVotes: Number,
    views: Number,
    shares: Number
  }
}, {
  timestamps: true
});

const BookingWidget = mongoose.model('BookingWidget', bookingWidgetSchema);
const PromoCode = mongoose.model('PromoCode', promoCodeSchema);
const GuestCRM = mongoose.model('GuestCRM', guestCRMSchema);
const EmailCampaign = mongoose.model('EmailCampaign', emailCampaignSchema);
const LoyaltyProgram = mongoose.model('LoyaltyProgram', loyaltyProgramSchema);
const LandingPage = mongoose.model('LandingPage', landingPageSchema);
const ReviewManagement = mongoose.model('ReviewManagement', reviewManagementSchema);

export {
  BookingWidget,
  PromoCode,
  GuestCRM,
  EmailCampaign,
  LoyaltyProgram,
  LandingPage,
  ReviewManagement
};
