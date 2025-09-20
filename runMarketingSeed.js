import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management?retryWrites=true&w=majority&appName=Cluster0';

// Define User schema
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  role: { type: String, default: 'guest' }
}, { timestamps: true });

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function seedBasicMarketingData() {
  console.log('🚀 Starting Basic Marketing Data Seeding...');

  try {
    await connectDB();

    // Define schemas inline
    const bookingWidgetSchema = new mongoose.Schema({
      widgetId: { type: String, required: true, unique: true },
      name: { type: String, required: true },
      type: { type: String, enum: ['inline', 'popup', 'sidebar', 'floating', 'iframe'], required: true },
      isActive: { type: Boolean, default: true },
      performance: {
        impressions: { type: Number, default: 0 },
        clicks: { type: Number, default: 0 },
        conversions: { type: Number, default: 0 },
        conversionRate: { type: Number, default: 0 },
        averageBookingValue: { type: Number, default: 0 }
      }
    }, { timestamps: true });

    const emailCampaignSchema = new mongoose.Schema({
      campaignId: { type: String, required: true, unique: true },
      name: { type: String, required: true },
      type: { type: String, enum: ['promotional', 'welcome', 'abandoned_booking', 'post_stay', 'newsletter'], required: true },
      status: { type: String, enum: ['draft', 'scheduled', 'sending', 'sent', 'paused'], default: 'draft' },
      tracking: {
        opens: { type: Number, default: 0 },
        clicks: { type: Number, default: 0 },
        conversions: { type: Number, default: 0 },
        sent: { type: Number, default: 0 }
      }
    }, { timestamps: true });

    const guestCRMSchema = new mongoose.Schema({
      guestId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      profile: {
        firstName: String,
        lastName: String,
        email: String,
        phone: String
      },
      segmentation: {
        segment: { type: String, enum: ['vip', 'frequent', 'potential', 'at_risk', 'lost', 'new'], default: 'new' },
        lifetimeValue: { type: Number, default: 0 }
      }
    }, { timestamps: true });

    const reviewManagementSchema = new mongoose.Schema({
      reviewId: { type: String, required: true, unique: true },
      platform: { type: String, enum: ['google', 'tripadvisor', 'booking.com', 'direct'], required: true },
      content: {
        rating: { type: Number, required: true, min: 1, max: 5 },
        review: String
      },
      analytics: {
        views: { type: Number, default: 0 }
      }
    }, { timestamps: true });

    // Create models
    const User = mongoose.model('User', userSchema);
    const BookingWidget = mongoose.model('BookingWidget', bookingWidgetSchema);
    const EmailCampaign = mongoose.model('EmailCampaign', emailCampaignSchema);
    const GuestCRM = mongoose.model('GuestCRM', guestCRMSchema);
    const ReviewManagement = mongoose.model('ReviewManagement', reviewManagementSchema);

    console.log('📊 Checking current data...');
    const users = await User.find({}).limit(10);
    console.log(`Found ${users.length} users`);

    // Clear existing marketing data
    await BookingWidget.deleteMany({});
    await EmailCampaign.deleteMany({});
    await GuestCRM.deleteMany({});
    await ReviewManagement.deleteMany({});

    console.log('🔧 Seeding Booking Widgets...');
    const widgets = [
      {
        widgetId: 'main-booking-widget',
        name: 'Main Hotel Booking Widget',
        type: 'inline',
        isActive: true,
        performance: { impressions: 12500, clicks: 875, conversions: 52, conversionRate: 5.94, averageBookingValue: 4200 }
      },
      {
        widgetId: 'popup-promo-widget',
        name: 'Promotional Popup Widget',
        type: 'popup',
        isActive: true,
        performance: { impressions: 8750, clicks: 432, conversions: 18, conversionRate: 4.17, averageBookingValue: 3800 }
      },
      {
        widgetId: 'sidebar-mini-widget',
        name: 'Sidebar Mini Booking',
        type: 'sidebar',
        isActive: true,
        performance: { impressions: 5200, clicks: 234, conversions: 11, conversionRate: 4.70, averageBookingValue: 3600 }
      }
    ];
    await BookingWidget.insertMany(widgets);
    console.log(`✅ Created ${widgets.length} booking widgets`);

    console.log('📧 Seeding Email Campaigns...');
    const campaigns = [
      {
        campaignId: 'welcome-series-2024',
        name: 'Welcome Series 2024',
        type: 'welcome',
        status: 'sent',
        tracking: { sent: 1250, opens: 687, clicks: 123, conversions: 34 }
      },
      {
        campaignId: 'summer-promo-2024',
        name: 'Summer Special Promotion',
        type: 'promotional',
        status: 'sent',
        tracking: { sent: 2100, opens: 1134, clicks: 287, conversions: 89 }
      },
      {
        campaignId: 'abandoned-booking-recovery',
        name: 'Abandoned Booking Recovery',
        type: 'abandoned_booking',
        status: 'sent',
        tracking: { sent: 845, opens: 423, clicks: 156, conversions: 67 }
      }
    ];
    await EmailCampaign.insertMany(campaigns);
    console.log(`✅ Created ${campaigns.length} email campaigns`);

    console.log('👥 Seeding Guest CRM profiles...');
    const guestProfiles = [];
    for (let i = 0; i < Math.min(users.length, 8); i++) {
      const user = users[i];
      guestProfiles.push({
        guestId: user._id,
        profile: {
          firstName: user.name ? user.name.split(' ')[0] : 'Guest',
          lastName: user.name ? user.name.split(' ').slice(1).join(' ') : '',
          email: user.email,
          phone: user.phone || `+91${Math.floor(Math.random() * 9000000000) + 1000000000}`
        },
        segmentation: {
          segment: ['vip', 'frequent', 'potential', 'new'][Math.floor(Math.random() * 4)],
          lifetimeValue: Math.floor(Math.random() * 50000) + 5000
        }
      });
    }
    await GuestCRM.insertMany(guestProfiles);
    console.log(`✅ Created ${guestProfiles.length} guest CRM profiles`);

    console.log('⭐ Seeding Review Management...');
    const reviews = [];
    for (let i = 0; i < 12; i++) {
      reviews.push({
        reviewId: `review_${Date.now()}_${i}`,
        platform: ['google', 'tripadvisor', 'booking.com', 'direct'][Math.floor(Math.random() * 4)],
        content: {
          rating: Math.floor(Math.random() * 2) + 4, // 4-5 stars
          review: 'Great experience at the hotel. Excellent service and comfortable rooms.'
        },
        analytics: {
          views: Math.floor(Math.random() * 500) + 50
        }
      });
    }
    await ReviewManagement.insertMany(reviews);
    console.log(`✅ Created ${reviews.length} review management entries`);

    // Final verification
    console.log('📊 Verifying data...');
    const widgetCount = await BookingWidget.countDocuments();
    const campaignCount = await EmailCampaign.countDocuments();
    const crmCount = await GuestCRM.countDocuments();
    const reviewCount = await ReviewManagement.countDocuments();

    console.log('=====================================');
    console.log('✅ Marketing Data Seeding Completed!');
    console.log(`📊 Summary:`);
    console.log(`   Booking Widgets: ${widgetCount}`);
    console.log(`   Email Campaigns: ${campaignCount}`);
    console.log(`   Guest CRM Profiles: ${crmCount}`);
    console.log(`   Review Management: ${reviewCount}`);
    console.log('📊 Dashboard should now show real data instead of zeros');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📌 Database disconnected');
  }
}

seedBasicMarketingData();