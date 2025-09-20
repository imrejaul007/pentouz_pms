import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

async function testEmailConnection() {
  console.log('🧪 Testing Email Configuration...');
  console.log('=====================================');

  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log(`   SMTP_HOST: ${process.env.SMTP_HOST}`);
  console.log(`   SMTP_PORT: ${process.env.SMTP_PORT}`);
  console.log(`   SMTP_USER: ${process.env.SMTP_USER}`);
  console.log(`   SMTP_PASS: ${process.env.SMTP_PASS ? '***' + process.env.SMTP_PASS.slice(-4) : 'NOT SET'}`);
  console.log(`   FROM_EMAIL: ${process.env.FROM_EMAIL}`);

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('❌ Missing required SMTP credentials');
    return;
  }

  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    console.log('\n🔌 Testing SMTP Connection...');

    // Verify connection
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully');

    // Send test email
    console.log('\n📧 Sending test email...');

    const testEmail = {
      from: process.env.FROM_EMAIL || `"THE PENTOUZ Hotels" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER, // Send to self for testing
      subject: '🧪 THE PENTOUZ Email System Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">🏨 THE PENTOUZ</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Email System Test</p>
          </div>

          <div style="padding: 30px; background: white;">
            <h2 style="color: #1f2937; margin-top: 0;">✅ Email Configuration Successful!</h2>

            <p style="color: #4b5563; line-height: 1.6;">
              Congratulations! Your email infrastructure is now properly configured and ready for Phase 3 implementation.
            </p>

            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #166534; margin-top: 0;">📊 Test Details:</h3>
              <ul style="color: #166534; margin: 0;">
                <li><strong>SMTP Server:</strong> ${process.env.SMTP_HOST}</li>
                <li><strong>Port:</strong> ${process.env.SMTP_PORT}</li>
                <li><strong>Authentication:</strong> ✅ Verified</li>
                <li><strong>Test Time:</strong> ${new Date().toLocaleString()}</li>
              </ul>
            </div>

            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #1e40af; margin-top: 0;">🚀 Ready for Phase 3:</h3>
              <ul style="color: #1e40af; margin: 0;">
                <li>✅ Email campaigns can now be sent</li>
                <li>✅ Guest notifications are active</li>
                <li>✅ Booking confirmations will work</li>
                <li>✅ Marketing automation is ready</li>
              </ul>
            </div>

            <p style="color: #4b5563; line-height: 1.6;">
              You can now proceed with Phase 3 implementation. All email features are operational!
            </p>
          </div>

          <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; margin: 0; font-size: 14px;">
              This is an automated test email from THE PENTOUZ Hotel Management System
            </p>
          </div>
        </div>
      `,
      text: `
        THE PENTOUZ Email System Test

        ✅ Email Configuration Successful!

        Congratulations! Your email infrastructure is now properly configured and ready for Phase 3 implementation.

        Test Details:
        - SMTP Server: ${process.env.SMTP_HOST}
        - Port: ${process.env.SMTP_PORT}
        - Authentication: ✅ Verified
        - Test Time: ${new Date().toLocaleString()}

        Ready for Phase 3:
        ✅ Email campaigns can now be sent
        ✅ Guest notifications are active
        ✅ Booking confirmations will work
        ✅ Marketing automation is ready

        You can now proceed with Phase 3 implementation. All email features are operational!
      `
    };

    const info = await transporter.sendMail(testEmail);
    console.log('✅ Test email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Preview URL: ${nodemailer.getTestMessageUrl(info) || 'N/A'}`);

    console.log('\n🎉 Email Configuration Test Complete!');
    console.log('=====================================');
    console.log('✅ SMTP connection: Working');
    console.log('✅ Authentication: Successful');
    console.log('✅ Email sending: Operational');
    console.log('✅ Ready for Phase 3: YES');
    console.log('\n📧 Check your email inbox for the test message!');

  } catch (error) {
    console.error('\n❌ Email test failed:', error.message);

    if (error.code === 'EAUTH') {
      console.log('\n💡 Authentication Error Solutions:');
      console.log('   1. Enable 2-Factor Authentication on Gmail');
      console.log('   2. Generate App Password: https://myaccount.google.com/apppasswords');
      console.log('   3. Use App Password instead of regular password');
      console.log('   4. Enable "Less secure app access" (not recommended)');
    } else if (error.code === 'ENOTFOUND') {
      console.log('\n💡 Connection Error: Check your SMTP_HOST setting');
    } else if (error.code === 'ECONNECTION') {
      console.log('\n💡 Connection Error: Check your internet connection and firewall');
    }
  }
}

testEmailConnection();