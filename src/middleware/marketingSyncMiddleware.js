import { BookingWidget, GuestCRM, ReviewManagement } from '../models/BookingEngine.js';

/**
 * Middleware to sync booking data with marketing collections
 * This ensures real-time updates when bookings are created/modified
 */

const updateWidgetPerformance = async (bookingData) => {
  try {
    // Find the widget that generated this booking (based on source or referrer)
    const widgetId = bookingData.source || 'main-booking-widget';

    await BookingWidget.findOneAndUpdate(
      { widgetId: widgetId },
      {
        $inc: {
          'performance.conversions': 1,
        },
        $set: {
          'performance.averageBookingValue': bookingData.totalAmount || 0,
          'performance.conversionRate': 0.31 // Will be recalculated
        }
      },
      { upsert: true }
    );

    console.log(`✅ Updated widget performance for ${widgetId}`);
  } catch (error) {
    console.error('❌ Error updating widget performance:', error);
  }
};

const createOrUpdateGuestCRM = async (userId, bookingData) => {
  try {
    // Check if CRM profile exists
    let guestProfile = await GuestCRM.findOne({ guestId: userId });

    if (!guestProfile) {
      // Create new CRM profile
      const User = (await import('../models/User.js')).default;
      const user = await User.findById(userId);

      if (user) {
        guestProfile = new GuestCRM({
          guestId: userId,
          profile: {
            firstName: user.name ? user.name.split(' ')[0] : 'Guest',
            lastName: user.name ? user.name.split(' ').slice(1).join(' ') : '',
            email: user.email,
            phone: user.phone
          },
          bookingHistory: {
            totalBookings: 1,
            totalSpent: bookingData.totalAmount || 0,
            averageBookingValue: bookingData.totalAmount || 0,
            lastBookingDate: new Date()
          },
          segmentation: {
            segment: 'new',
            lifetimeValue: bookingData.totalAmount || 0,
            loyaltyTier: 'bronze'
          }
        });

        await guestProfile.save();
        console.log(`✅ Created new CRM profile for user ${userId}`);
      }
    } else {
      // Update existing profile
      const newTotalBookings = (guestProfile.bookingHistory?.totalBookings || 0) + 1;
      const newTotalSpent = (guestProfile.bookingHistory?.totalSpent || 0) + (bookingData.totalAmount || 0);
      const newAverageBookingValue = newTotalSpent / newTotalBookings;

      // Determine new segment based on booking history
      let newSegment = 'new';
      if (newTotalBookings >= 5) newSegment = 'vip';
      else if (newTotalBookings >= 3) newSegment = 'frequent';
      else if (newTotalBookings >= 1) newSegment = 'potential';

      await GuestCRM.findByIdAndUpdate(guestProfile._id, {
        $set: {
          'bookingHistory.totalBookings': newTotalBookings,
          'bookingHistory.totalSpent': newTotalSpent,
          'bookingHistory.averageBookingValue': newAverageBookingValue,
          'bookingHistory.lastBookingDate': new Date(),
          'segmentation.segment': newSegment,
          'segmentation.lifetimeValue': newTotalSpent,
          'segmentation.loyaltyTier': newTotalSpent > 20000 ? 'gold' : newTotalSpent > 10000 ? 'silver' : 'bronze'
        }
      });

      console.log(`✅ Updated CRM profile for user ${userId} - Segment: ${newSegment}`);
    }
  } catch (error) {
    console.error('❌ Error updating guest CRM:', error);
  }
};

const trackBookingEvent = async (eventType, bookingData, userId) => {
  try {
    // Update marketing metrics based on booking events
    switch (eventType) {
      case 'booking_created':
        await updateWidgetPerformance(bookingData);
        await createOrUpdateGuestCRM(userId, bookingData);
        break;

      case 'booking_confirmed':
        // Track conversion completion
        console.log(`✅ Booking confirmed: ${bookingData.bookingNumber}`);
        break;

      case 'booking_cancelled':
        // Track cancellation for analysis
        console.log(`⚠️ Booking cancelled: ${bookingData.bookingNumber}`);
        break;

      default:
        console.log(`📊 Tracked booking event: ${eventType}`);
    }
  } catch (error) {
    console.error('❌ Error tracking booking event:', error);
  }
};

/**
 * Express middleware to automatically sync booking data with marketing
 */
const marketingSyncMiddleware = (eventType = 'booking_created') => {
  return async (req, res, next) => {
    // Store original res.json to intercept successful responses
    const originalJson = res.json;

    res.json = function(data) {
      // Only sync if the operation was successful and we have booking data
      if (res.statusCode >= 200 && res.statusCode < 300 && data) {
        // Extract booking and user information
        const bookingData = data.booking || data;
        const userId = bookingData.userId || req.user?.id;

        if (bookingData && userId) {
          // Async sync without blocking the response
          setImmediate(() => {
            trackBookingEvent(eventType, bookingData, userId);
          });
        }
      }

      // Call original json method
      return originalJson.call(this, data);
    };

    next();
  };
};

/**
 * Manual sync function for existing bookings
 */
const syncExistingBookings = async () => {
  try {
    console.log('🔄 Syncing existing bookings with marketing system...');

    const Booking = (await import('../models/Booking.js')).default;
    const bookings = await Booking.find({}).populate('userId');

    for (const booking of bookings) {
      if (booking.userId) {
        await trackBookingEvent('booking_created', {
          totalAmount: booking.totalAmount,
          bookingNumber: booking.bookingNumber,
          source: 'existing_sync'
        }, booking.userId._id);
      }
    }

    console.log(`✅ Synced ${bookings.length} existing bookings`);
  } catch (error) {
    console.error('❌ Error syncing existing bookings:', error);
  }
};

export {
  marketingSyncMiddleware,
  trackBookingEvent,
  syncExistingBookings
};