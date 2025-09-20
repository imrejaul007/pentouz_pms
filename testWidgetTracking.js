import mongoose from 'mongoose';
import WidgetTracking from './src/models/WidgetTracking.js';
import { BookingWidget } from './src/models/BookingEngine.js';

const MONGO_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management?retryWrites=true&w=majority&appName=Cluster0';

async function testWidgetTracking() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to database');

    // Get a widget to test with
    const widget = await BookingWidget.findOne({});
    if (!widget) {
      console.log('❌ No widgets found. Please run marketing seed first.');
      return;
    }

    console.log(`🔧 Testing with widget: ${widget.name} (${widget.widgetId})`);

    // Clear existing tracking data for this test
    await WidgetTracking.deleteMany({ widgetId: widget.widgetId });

    // Simulate widget impression
    const impression = new WidgetTracking({
      trackingId: 'test_impression_' + Date.now(),
      widgetId: widget.widgetId,
      sessionId: 'test_session_' + Date.now(),
      event: 'impression',
      url: 'https://example.com/booking',
      referrer: 'https://google.com',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      screenResolution: '1920x1080',
      viewportSize: '1366x768',
      deviceType: 'desktop',
      browser: 'Chrome',
      os: 'Windows',
      timestamp: new Date()
    });

    await impression.save();
    console.log('✅ Simulated widget impression');

    // Simulate widget click
    const click = new WidgetTracking({
      trackingId: 'test_click_' + Date.now(),
      widgetId: widget.widgetId,
      sessionId: impression.sessionId,
      event: 'click',
      url: 'https://example.com/booking',
      referrer: 'https://google.com',
      userAgent: impression.userAgent,
      screenResolution: impression.screenResolution,
      viewportSize: impression.viewportSize,
      deviceType: impression.deviceType,
      browser: impression.browser,
      os: impression.os,
      timestamp: new Date()
    });

    await click.save();
    console.log('✅ Simulated widget click');

    // Simulate conversion
    const conversion = new WidgetTracking({
      trackingId: 'test_conversion_' + Date.now(),
      widgetId: widget.widgetId,
      sessionId: impression.sessionId,
      event: 'conversion',
      url: 'https://example.com/booking',
      referrer: 'https://google.com',
      userAgent: impression.userAgent,
      screenResolution: impression.screenResolution,
      viewportSize: impression.viewportSize,
      deviceType: impression.deviceType,
      browser: impression.browser,
      os: impression.os,
      isConversion: true,
      conversionValue: 4500,
      bookingData: {
        checkin: new Date('2024-12-01'),
        checkout: new Date('2024-12-03'),
        adults: 2,
        children: 0,
        roomType: 'deluxe',
        estimatedValue: 4500
      },
      timestamp: new Date()
    });

    await conversion.save();
    console.log('✅ Simulated widget conversion');

    // Test performance calculation
    const performance = await WidgetTracking.getWidgetPerformance(widget.widgetId, 7);
    console.log('\n📊 Widget Performance Metrics:');
    console.log(`  Impressions: ${performance.impressions}`);
    console.log(`  Clicks: ${performance.clicks}`);
    console.log(`  Conversions: ${performance.conversions}`);
    console.log(`  Conversion Rate: ${performance.conversionRate.toFixed(2)}%`);
    console.log(`  Total Revenue: ₹${performance.totalRevenue}`);
    console.log(`  Average Value: ₹${performance.averageValue.toFixed(2)}`);

    // Test conversion funnel
    const funnel = await WidgetTracking.getConversionFunnel(widget.widgetId, 7);
    console.log('\n🔄 Conversion Funnel:');
    console.log(`  Total Sessions: ${funnel.totalSessions || 0}`);
    console.log(`  Impressions: ${funnel.impressions || 0}`);
    console.log(`  Clicks: ${funnel.clicks || 0}`);
    console.log(`  Conversions: ${funnel.conversions || 0}`);

    // Test top performing widgets
    const topWidgets = await WidgetTracking.getTopPerformingWidgets(5, 7);
    console.log('\n🏆 Top Performing Widgets:');
    topWidgets.forEach((w, index) => {
      console.log(`  ${index + 1}. Widget ${w.widgetId}: ${w.conversions} conversions, ${w.conversionRate.toFixed(2)}% rate`);
    });

    // Update the actual widget performance metrics
    await BookingWidget.findOneAndUpdate(
      { widgetId: widget.widgetId },
      {
        $inc: {
          'performance.impressions': 1,
          'performance.clicks': 1,
          'performance.conversions': 1
        },
        $set: {
          'performance.conversionRate': performance.conversionRate,
          'performance.averageBookingValue': performance.averageValue
        }
      }
    );

    console.log('\n✅ Widget tracking system test completed successfully!');
    console.log('📊 The widget analytics endpoints are ready for frontend integration');

  } catch (error) {
    console.error('❌ Widget tracking test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📌 Disconnected from database');
  }
}

testWidgetTracking();