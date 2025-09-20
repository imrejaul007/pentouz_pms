import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management?retryWrites=true&w=majority&appName=Cluster0';

async function verifyMarketingData() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to database');

    const db = mongoose.connection.db;

    console.log('=== Marketing Collections Status ===');
    const bookingwidgets = await db.collection('bookingwidgets').countDocuments();
    const emailcampaigns = await db.collection('emailcampaigns').countDocuments();
    const guestcrms = await db.collection('guestcrms').countDocuments();
    const reviewmanagements = await db.collection('reviewmanagements').countDocuments();

    console.log(`BookingWidget: ${bookingwidgets}`);
    console.log(`EmailCampaign: ${emailcampaigns}`);
    console.log(`GuestCRM: ${guestcrms}`);
    console.log(`ReviewManagement: ${reviewmanagements}`);

    console.log('\n=== Sample Data ===');
    const sampleWidget = await db.collection('bookingwidgets').findOne({});
    if (sampleWidget) {
      console.log(`Widget: ${sampleWidget.name}`);
      console.log(`Impressions: ${sampleWidget.performance?.impressions || 0}`);
      console.log(`Conversions: ${sampleWidget.performance?.conversions || 0}`);
    }

    const sampleCampaign = await db.collection('emailcampaigns').findOne({});
    if (sampleCampaign) {
      console.log(`Campaign: ${sampleCampaign.name}`);
      console.log(`Emails Sent: ${sampleCampaign.tracking?.sent || 0}`);
      console.log(`Opens: ${sampleCampaign.tracking?.opens || 0}`);
    }

    // Calculate totals for dashboard
    const widgets = await db.collection('bookingwidgets').find({}).toArray();
    const campaigns = await db.collection('emailcampaigns').find({}).toArray();

    const totalImpressions = widgets.reduce((sum, w) => sum + (w.performance?.impressions || 0), 0);
    const totalConversions = widgets.reduce((sum, w) => sum + (w.performance?.conversions || 0), 0);
    const totalEmailsSent = campaigns.reduce((sum, c) => sum + (c.tracking?.sent || 0), 0);
    const totalEmailOpens = campaigns.reduce((sum, c) => sum + (c.tracking?.opens || 0), 0);

    console.log('\n=== Dashboard Metrics ===');
    console.log(`Total Widget Impressions: ${totalImpressions.toLocaleString()}`);
    console.log(`Total Conversions: ${totalConversions}`);
    console.log(`Widget Conversion Rate: ${totalConversions > 0 ? ((totalConversions / totalImpressions) * 100).toFixed(2) + '%' : '0%'}`);
    console.log(`Total Emails Sent: ${totalEmailsSent.toLocaleString()}`);
    console.log(`Email Open Rate: ${totalEmailOpens > 0 ? ((totalEmailOpens / totalEmailsSent) * 100).toFixed(2) + '%' : '0%'}`);
    console.log(`Guest Segments: ${guestcrms}`);
    console.log(`Reviews: ${reviewmanagements}`);

    console.log('\n✅ Marketing dashboard should now show REAL DATA instead of zeros!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📌 Disconnected from database');
  }
}

verifyMarketingData();