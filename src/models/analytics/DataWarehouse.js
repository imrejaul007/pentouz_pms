/**
 * Data Warehouse Schema Models for Advanced Analytics
 * Dimensional data model for hotel business intelligence
 */

import mongoose from 'mongoose';

// Fact Table: Booking Analytics
const factBookingsSchema = new mongoose.Schema({
  booking_key: { type: mongoose.Schema.Types.ObjectId, required: true },
  date_key: { type: Number, required: true, index: true },
  guest_key: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  room_key: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  hotel_key: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  
  // Measures
  revenue_amount: { type: Number, required: true, min: 0 },
  nights_stayed: { type: Number, required: true, min: 1 },
  advance_payment: { type: Number, default: 0, min: 0 },
  total_guests: { type: Number, required: true, min: 1 },
  
  // Calculated KPIs
  adr: { type: Number, required: true }, // Average Daily Rate
  revpar: { type: Number, required: true }, // Revenue Per Available Room
  
  // Booking characteristics
  booking_channel: { type: String, enum: ['direct', 'ota', 'phone', 'corporate'], required: true },
  booking_lead_days: { type: Number, required: true }, // Days between booking and arrival
  booking_status: { type: String, enum: ['confirmed', 'checked_in', 'checked_out', 'cancelled'], required: true },
  
  // Guest characteristics
  guest_type: { type: String, enum: ['new', 'returning', 'corporate', 'loyalty_member'], required: true },
  guest_segment: { type: String, enum: ['leisure', 'business', 'group', 'corporate'], required: true },
  
  // Time characteristics
  check_in_date: { type: Date, required: true },
  check_out_date: { type: Date, required: true },
  is_weekend: { type: Boolean, required: true },
  is_holiday: { type: Boolean, default: false },
  season: { type: String, enum: ['peak', 'off_peak', 'shoulder'], required: true },
  
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// Compound indexes for performance
factBookingsSchema.index({ date_key: 1, hotel_key: 1 });
factBookingsSchema.index({ guest_key: 1, check_in_date: -1 });
factBookingsSchema.index({ room_key: 1, date_key: 1 });
factBookingsSchema.index({ booking_channel: 1, date_key: 1 });

// Fact Table: Revenue Analytics
const factRevenueSchema = new mongoose.Schema({
  revenue_key: { type: mongoose.Schema.Types.ObjectId, auto: true },
  date_key: { type: Number, required: true, index: true },
  hotel_key: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  room_type_key: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  
  // Revenue measures
  gross_revenue: { type: Number, required: true, min: 0 },
  net_revenue: { type: Number, required: true, min: 0 },
  tax_amount: { type: Number, required: true, min: 0 },
  discount_amount: { type: Number, default: 0, min: 0 },
  ancillary_revenue: { type: Number, default: 0, min: 0 },
  
  // Operational measures
  rooms_sold: { type: Number, required: true, min: 0 },
  rooms_available: { type: Number, required: true, min: 1 },
  occupancy_rate: { type: Number, required: true, min: 0, max: 100 },
  
  // Calculated KPIs
  adr: { type: Number, required: true },
  revpar: { type: Number, required: true },
  profit_margin: { type: Number, required: true },
  
  created_at: { type: Date, default: Date.now }
});

factRevenueSchema.index({ date_key: 1, hotel_key: 1, room_type_key: 1 });
factRevenueSchema.index({ occupancy_rate: 1, date_key: 1 });

// Dimension Table: Date Dimension
const dimDateSchema = new mongoose.Schema({
  date_key: { type: Number, required: true, unique: true }, // Format: YYYYMMDD
  full_date: { type: Date, required: true, unique: true },
  
  // Calendar attributes
  year: { type: Number, required: true, index: true },
  quarter: { type: Number, required: true, min: 1, max: 4 },
  month: { type: Number, required: true, min: 1, max: 12, index: true },
  week: { type: Number, required: true, min: 1, max: 53 },
  day_of_year: { type: Number, required: true, min: 1, max: 366 },
  day_of_month: { type: Number, required: true, min: 1, max: 31 },
  day_of_week: { type: Number, required: true, min: 0, max: 6 }, // 0 = Sunday
  
  // String representations
  month_name: { type: String, required: true },
  day_name: { type: String, required: true },
  quarter_name: { type: String, required: true },
  
  // Business attributes
  is_weekend: { type: Boolean, required: true },
  is_holiday: { type: Boolean, default: false },
  is_business_day: { type: Boolean, required: true },
  
  // Hotel industry specific
  season: { 
    type: String, 
    enum: ['peak', 'off_peak', 'shoulder'], 
    required: true 
  },
  booking_period: {
    type: String,
    enum: ['advance', 'normal', 'last_minute'],
    required: true
  },
  
  created_at: { type: Date, default: Date.now }
});

dimDateSchema.index({ year: 1, month: 1 });
dimDateSchema.index({ is_weekend: 1, is_holiday: 1 });
dimDateSchema.index({ season: 1 });

// Dimension Table: Guest Dimension (SCD Type 2)
const dimGuestSchema = new mongoose.Schema({
  guest_key: { type: mongoose.Schema.Types.ObjectId, required: true },
  guest_id: { type: mongoose.Schema.Types.ObjectId, required: true }, // Original guest ID
  
  // Guest attributes
  guest_type: { type: String, enum: ['individual', 'corporate', 'group'], required: true },
  guest_segment: { type: String, enum: ['leisure', 'business', 'luxury', 'budget'], required: true },
  loyalty_tier: { type: String, enum: ['bronze', 'silver', 'gold', 'platinum', 'none'], default: 'none' },
  
  // Demographics
  age_group: { type: String, enum: ['18-25', '26-35', '36-45', '46-55', '56-65', '65+'] },
  country: { type: String, required: true },
  city: { type: String, required: true },
  
  // Behavioral attributes
  booking_frequency: { type: String, enum: ['first_time', 'occasional', 'frequent', 'very_frequent'], required: true },
  avg_booking_value: { type: Number, required: true, min: 0 },
  preferred_room_type: { type: String },
  preferred_amenities: [{ type: String }],
  
  // SCD Type 2 attributes
  effective_date: { type: Date, required: true },
  expiry_date: { type: Date, default: new Date('2099-12-31') },
  is_current: { type: Boolean, default: true },
  
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

dimGuestSchema.index({ guest_id: 1, is_current: 1 });
dimGuestSchema.index({ guest_segment: 1, loyalty_tier: 1 });
dimGuestSchema.index({ effective_date: 1, expiry_date: 1 });

// Aggregation Tables for Performance
const monthlyRevenueAggregateSchema = new mongoose.Schema({
  hotel_id: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  year: { type: Number, required: true, index: true },
  month: { type: Number, required: true, index: true },
  
  // Revenue metrics
  total_revenue: { type: Number, required: true, min: 0 },
  rooms_revenue: { type: Number, required: true, min: 0 },
  ancillary_revenue: { type: Number, default: 0, min: 0 },
  
  // Operational metrics
  total_bookings: { type: Number, required: true, min: 0 },
  total_nights: { type: Number, required: true, min: 0 },
  unique_guests: { type: Number, required: true, min: 0 },
  
  // KPIs
  avg_adr: { type: Number, required: true, min: 0 },
  avg_revpar: { type: Number, required: true, min: 0 },
  avg_occupancy: { type: Number, required: true, min: 0, max: 100 },
  avg_los: { type: Number, required: true, min: 0 }, // Length of Stay
  
  // Guest segmentation
  leisure_revenue: { type: Number, default: 0 },
  business_revenue: { type: Number, default: 0 },
  corporate_revenue: { type: Number, default: 0 },
  group_revenue: { type: Number, default: 0 },
  
  // Channel distribution
  direct_bookings: { type: Number, default: 0 },
  ota_bookings: { type: Number, default: 0 },
  corporate_bookings: { type: Number, default: 0 },
  phone_bookings: { type: Number, default: 0 },
  
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

monthlyRevenueAggregateSchema.index({ hotel_id: 1, year: -1, month: -1 }, { unique: true });

// Export models
export const FactBookings = mongoose.model('FactBookings', factBookingsSchema);
export const FactRevenue = mongoose.model('FactRevenue', factRevenueSchema);
export const DimDate = mongoose.model('DimDate', dimDateSchema);
export const DimGuest = mongoose.model('DimGuest', dimGuestSchema);
export const MonthlyRevenueAggregate = mongoose.model('MonthlyRevenueAggregate', monthlyRevenueAggregateSchema);

// Helper functions for data warehouse operations
export const DataWarehouseHelpers = {
  // Generate date key from date
  generateDateKey(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return parseInt(`${year}${month}${day}`);
  },
  
  // Calculate season based on date
  calculateSeason(date) {
    const month = new Date(date).getMonth() + 1;
    if (month >= 12 || month <= 2) return 'peak'; // Winter holidays
    if (month >= 6 && month <= 8) return 'peak'; // Summer
    if (month === 3 || month === 4 || month === 9 || month === 10) return 'shoulder';
    return 'off_peak';
  },
  
  // Determine guest segment based on booking patterns
  determineGuestSegment(bookingData) {
    const { purpose, advance_days, room_rate, amenities } = bookingData;
    
    if (purpose === 'business' || advance_days < 7) return 'business';
    if (room_rate > 200 || amenities.includes('spa')) return 'luxury';
    if (advance_days > 30) return 'leisure';
    return 'budget';
  },
  
  // Calculate booking frequency category
  calculateBookingFrequency(guestBookings) {
    const bookingCount = guestBookings.length;
    if (bookingCount === 1) return 'first_time';
    if (bookingCount <= 3) return 'occasional';
    if (bookingCount <= 6) return 'frequent';
    return 'very_frequent';
  }
};
