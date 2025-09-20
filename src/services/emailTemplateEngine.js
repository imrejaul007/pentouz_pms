import path from 'path';
import fs from 'fs/promises';
import handlebars from 'handlebars';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EmailTemplateEngine {
  constructor() {
    this.templates = new Map();
    this.helpers = new Map();
    this.partials = new Map();
    this.templateDir = path.join(__dirname, '../templates/email');

    this.registerDefaultHelpers();
  }

  async initialize() {
    try {
      // Ensure template directory exists
      await fs.mkdir(this.templateDir, { recursive: true });

      // Load existing templates
      await this.loadTemplates();

      console.log('📧 Email Template Engine initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Email Template Engine:', error);
    }
  }

  registerDefaultHelpers() {
    // Date formatting helper
    this.registerHelper('formatDate', (date, format = 'MMMM DD, YYYY') => {
      if (!date) return '';
      const d = new Date(date);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    });

    // Currency formatting helper
    this.registerHelper('formatCurrency', (amount, currency = 'USD') => {
      if (typeof amount !== 'number') return '$0.00';
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
      }).format(amount);
    });

    // Conditional helper
    this.registerHelper('ifEquals', function(arg1, arg2, options) {
      return (arg1 === arg2) ? options.fn(this) : options.inverse(this);
    });

    // Uppercase helper
    this.registerHelper('uppercase', (str) => {
      return str ? str.toString().toUpperCase() : '';
    });

    // Lowercase helper
    this.registerHelper('lowercase', (str) => {
      return str ? str.toString().toLowerCase() : '';
    });

    // Capitalize helper
    this.registerHelper('capitalize', (str) => {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    });

    // Truncate helper
    this.registerHelper('truncate', (str, length = 50, suffix = '...') => {
      if (!str || str.length <= length) return str || '';
      return str.substring(0, length) + suffix;
    });

    // Loyalty tier helper
    this.registerHelper('loyaltyBadge', (tier) => {
      const badges = {
        bronze: '🥉 Bronze',
        silver: '🥈 Silver',
        gold: '🥇 Gold',
        platinum: '💎 Platinum'
      };
      return badges[tier] || '';
    });

    // Booking status helper
    this.registerHelper('bookingStatusColor', (status) => {
      const colors = {
        confirmed: '#28a745',
        pending: '#ffc107',
        cancelled: '#dc3545',
        completed: '#007bff'
      };
      return colors[status] || '#6c757d';
    });

    // Room type icon helper
    this.registerHelper('roomTypeIcon', (roomType) => {
      const icons = {
        'standard': '🛏️',
        'deluxe': '🏨',
        'suite': '🏢',
        'presidential': '👑',
        'family': '👨‍👩‍👧‍👦',
        'business': '💼'
      };
      return icons[roomType?.toLowerCase()] || '🏨';
    });
  }

  registerHelper(name, helperFunction) {
    this.helpers.set(name, helperFunction);
    handlebars.registerHelper(name, helperFunction);
  }

  registerPartial(name, template) {
    this.partials.set(name, template);
    handlebars.registerPartial(name, template);
  }

  async loadTemplates() {
    try {
      const templateFiles = await fs.readdir(this.templateDir).catch(() => []);

      for (const file of templateFiles) {
        if (file.endsWith('.hbs') || file.endsWith('.handlebars')) {
          const templateName = path.parse(file).name;
          const templatePath = path.join(this.templateDir, file);
          const templateContent = await fs.readFile(templatePath, 'utf-8');

          this.templates.set(templateName, handlebars.compile(templateContent));
        }
      }

      // Load partials
      const partialsDir = path.join(this.templateDir, 'partials');
      try {
        const partialFiles = await fs.readdir(partialsDir);
        for (const file of partialFiles) {
          if (file.endsWith('.hbs') || file.endsWith('.handlebars')) {
            const partialName = path.parse(file).name;
            const partialPath = path.join(partialsDir, file);
            const partialContent = await fs.readFile(partialPath, 'utf-8');

            this.registerPartial(partialName, partialContent);
          }
        }
      } catch (error) {
        // Partials directory doesn't exist, that's okay
      }

      console.log(`📧 Loaded ${this.templates.size} email templates`);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  }

  async createTemplate(name, htmlContent, description = '') {
    try {
      const templatePath = path.join(this.templateDir, `${name}.hbs`);
      await fs.writeFile(templatePath, htmlContent, 'utf-8');

      // Compile and cache the template
      this.templates.set(name, handlebars.compile(htmlContent));

      console.log(`📧 Created email template: ${name}`);
      return true;
    } catch (error) {
      console.error(`Error creating template ${name}:`, error);
      return false;
    }
  }

  async updateTemplate(name, htmlContent) {
    try {
      const templatePath = path.join(this.templateDir, `${name}.hbs`);
      await fs.writeFile(templatePath, htmlContent, 'utf-8');

      // Recompile and cache the template
      this.templates.set(name, handlebars.compile(htmlContent));

      console.log(`📧 Updated email template: ${name}`);
      return true;
    } catch (error) {
      console.error(`Error updating template ${name}:`, error);
      return false;
    }
  }

  async deleteTemplate(name) {
    try {
      const templatePath = path.join(this.templateDir, `${name}.hbs`);
      await fs.unlink(templatePath);

      // Remove from cache
      this.templates.delete(name);

      console.log(`📧 Deleted email template: ${name}`);
      return true;
    } catch (error) {
      console.error(`Error deleting template ${name}:`, error);
      return false;
    }
  }

  compile(templateContent, data = {}) {
    try {
      const template = handlebars.compile(templateContent);
      return template(data);
    } catch (error) {
      console.error('Error compiling template:', error);
      return templateContent; // Return original if compilation fails
    }
  }

  render(templateName, data = {}) {
    try {
      const template = this.templates.get(templateName);
      if (!template) {
        throw new Error(`Template '${templateName}' not found`);
      }

      return template(data);
    } catch (error) {
      console.error(`Error rendering template ${templateName}:`, error);
      return `<p>Error rendering email template: ${error.message}</p>`;
    }
  }

  async renderWithPersonalization(templateName, user, campaignData = {}, additionalData = {}) {
    try {
      // Prepare personalized data
      const personalizedData = await this.preparePersonalizationData(user, campaignData, additionalData);

      // Render the template
      return this.render(templateName, personalizedData);
    } catch (error) {
      console.error('Error rendering personalized template:', error);
      return this.render('error', { error: error.message });
    }
  }

  async preparePersonalizationData(user, campaignData = {}, additionalData = {}) {
    // Base user data
    const userData = {
      firstName: user.name?.split(' ')[0] || 'Guest',
      lastName: user.name?.split(' ').slice(1).join(' ') || '',
      fullName: user.name || 'Guest',
      email: user.email || '',
      loyaltyTier: user.loyaltyProgram?.tier || 'bronze',
      loyaltyPoints: user.loyaltyProgram?.points || 0,
      totalBookings: user.totalBookings || 0,
      memberSince: user.createdAt ? new Date(user.createdAt) : new Date(),
      preferredLanguage: user.preferences?.language || 'en',
      timezone: user.preferences?.timezone || 'UTC'
    };

    // Recent booking data (if available)
    let recentBooking = null;
    if (user.recentBookings && user.recentBookings.length > 0) {
      const booking = user.recentBookings[0];
      recentBooking = {
        id: booking._id,
        checkIn: booking.checkInDate,
        checkOut: booking.checkOutDate,
        roomType: booking.roomType,
        totalAmount: booking.totalAmount,
        status: booking.status,
        guests: booking.guests
      };
    }

    // Hotel/Company data
    const companyData = {
      hotelName: 'THE PENTOUZ Hotels',
      hotelLogo: 'https://thepentouz.com/logo.png',
      hotelWebsite: 'https://thepentouz.com',
      supportEmail: 'support@thepentouz.com',
      supportPhone: '+1 (555) 123-4567',
      address: '123 Luxury Avenue, Hotel District, NY 10001'
    };

    // Current date and time
    const currentDate = new Date();
    const timeData = {
      currentDate,
      currentYear: currentDate.getFullYear(),
      currentMonth: currentDate.getMonth() + 1,
      currentDay: currentDate.getDate(),
      greeting: this.getTimeBasedGreeting(currentDate)
    };

    // Campaign-specific data
    const campaignMetadata = {
      campaignId: campaignData.id || '',
      campaignName: campaignData.name || '',
      trackingPixel: campaignData.id ? this.generateTrackingPixel(campaignData.id, user._id) : '',
      unsubscribeUrl: campaignData.id ? this.generateUnsubscribeUrl(campaignData.id, user._id) : ''
    };

    // Combine all data
    return {
      user: userData,
      booking: recentBooking,
      company: companyData,
      time: timeData,
      campaign: campaignMetadata,
      ...additionalData
    };
  }

  getTimeBasedGreeting(date = new Date()) {
    const hour = date.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  generateTrackingPixel(campaignId, userId) {
    const trackingId = Math.random().toString(36).substring(2, 15);
    return `<img src="${process.env.EMAIL_TRACKING_DOMAIN || 'http://localhost:4000'}/api/v1/email-campaigns/track/open/${campaignId}/${userId}/${trackingId}" width="1" height="1" style="display:none;" alt="">`;
  }

  generateUnsubscribeUrl(campaignId, userId) {
    return `${process.env.EMAIL_UNSUBSCRIBE_URL || 'http://localhost:3000'}/unsubscribe?campaign=${campaignId}&user=${userId}`;
  }

  wrapLinksForTracking(htmlContent, campaignId, userId) {
    // Replace all links with tracking links
    return htmlContent.replace(
      /<a\s+href="([^"]+)"([^>]*)>/gi,
      (match, url, attributes) => {
        if (url.startsWith('mailto:') || url.startsWith('tel:')) {
          return match; // Don't track mailto and tel links
        }

        const linkId = Math.random().toString(36).substring(2, 15);
        const trackingUrl = `${process.env.EMAIL_TRACKING_DOMAIN || 'http://localhost:4000'}/api/v1/email-campaigns/track/click/${campaignId}/${userId}/${linkId}?url=${encodeURIComponent(url)}`;

        return `<a href="${trackingUrl}"${attributes}>`;
      }
    );
  }

  async getDefaultTemplates() {
    return {
      welcome: await this.getWelcomeTemplate(),
      bookingConfirmation: await this.getBookingConfirmationTemplate(),
      newsletter: await this.getNewsletterTemplate(),
      promotion: await this.getPromotionTemplate(),
      passwordReset: await this.getPasswordResetTemplate(),
      loyaltyUpdate: await this.getLoyaltyUpdateTemplate(),
      error: await this.getErrorTemplate()
    };
  }

  async getWelcomeTemplate() {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Welcome to {{company.hotelName}}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 30px; border-radius: 10px 10px 0 0; }
        .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .btn { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
        .highlight { background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to {{company.hotelName}}!</h1>
            <p>{{time.greeting}}, {{user.firstName}}!</p>
        </div>
        <div class="content">
            <p>We're thrilled to have you join our family of travelers and hospitality enthusiasts.</p>

            <div class="highlight">
                <h3>Your membership includes:</h3>
                <ul>
                    <li>🏨 Exclusive member rates and discounts</li>
                    <li>🎁 Loyalty points with every stay</li>
                    <li>🌟 Priority booking and upgrades</li>
                    <li>📞 24/7 concierge support</li>
                </ul>
            </div>

            <p>You're starting as a {{loyaltyBadge user.loyaltyTier}} member with {{user.loyaltyPoints}} points!</p>

            <div style="text-align: center; margin: 30px 0;">
                <a href="{{company.hotelWebsite}}/profile" class="btn">Complete Your Profile</a>
                <a href="{{company.hotelWebsite}}/book" class="btn">Book Your First Stay</a>
            </div>

            <p>If you have any questions, our team is here to help at {{company.supportEmail}} or {{company.supportPhone}}.</p>
        </div>
        <div class="footer">
            <p>&copy; {{time.currentYear}} {{company.hotelName}}. All rights reserved.</p>
            <p><a href="{{campaign.unsubscribeUrl}}">Unsubscribe</a> | <a href="{{company.hotelWebsite}}/privacy">Privacy Policy</a></p>
        </div>
    </div>
    {{{campaign.trackingPixel}}}
</body>
</html>`;
  }

  async getBookingConfirmationTemplate() {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Booking Confirmed - {{company.hotelName}}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; text-align: center; padding: 30px; border-radius: 10px 10px 0 0; }
        .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .booking-details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 5px 0; border-bottom: 1px solid #dee2e6; }
        .btn { display: inline-block; background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Booking Confirmed!</h1>
            <p>{{time.greeting}}, {{user.firstName}}!</p>
        </div>
        <div class="content">
            <p>Great news! Your reservation has been confirmed. We can't wait to welcome you to {{company.hotelName}}.</p>

            {{#if booking}}
            <div class="booking-details">
                <h3>{{roomTypeIcon booking.roomType}} Booking Details</h3>
                <div class="detail-row">
                    <strong>Booking ID:</strong>
                    <span>{{booking.id}}</span>
                </div>
                <div class="detail-row">
                    <strong>Check-in:</strong>
                    <span>{{formatDate booking.checkIn}}</span>
                </div>
                <div class="detail-row">
                    <strong>Check-out:</strong>
                    <span>{{formatDate booking.checkOut}}</span>
                </div>
                <div class="detail-row">
                    <strong>Room Type:</strong>
                    <span>{{capitalize booking.roomType}}</span>
                </div>
                <div class="detail-row">
                    <strong>Guests:</strong>
                    <span>{{booking.guests}} {{#ifEquals booking.guests 1}}Guest{{else}}Guests{{/ifEquals}}</span>
                </div>
                <div class="detail-row">
                    <strong>Total Amount:</strong>
                    <span><strong>{{formatCurrency booking.totalAmount}}</strong></span>
                </div>
                <div class="detail-row">
                    <strong>Status:</strong>
                    <span style="color: {{bookingStatusColor booking.status}};">{{capitalize booking.status}}</span>
                </div>
            </div>
            {{/if}}

            <div style="text-align: center; margin: 30px 0;">
                <a href="{{company.hotelWebsite}}/bookings/{{booking.id}}" class="btn">View Booking</a>
                <a href="{{company.hotelWebsite}}/checkin" class="btn">Online Check-in</a>
            </div>

            <h3>What's Next?</h3>
            <ul>
                <li>📱 Download our mobile app for easy check-in</li>
                <li>🍽️ Explore our restaurant and spa services</li>
                <li>🚗 Arrange airport transportation</li>
                <li>📞 Contact our concierge for local recommendations</li>
            </ul>

            <p>For any changes or questions, please contact us at {{company.supportEmail}} or {{company.supportPhone}}.</p>
        </div>
        <div class="footer">
            <p>&copy; {{time.currentYear}} {{company.hotelName}}. All rights reserved.</p>
            <p><a href="{{campaign.unsubscribeUrl}}">Unsubscribe</a> | <a href="{{company.hotelWebsite}}/privacy">Privacy Policy</a></p>
        </div>
    </div>
    {{{campaign.trackingPixel}}}
</body>
</html>`;
  }

  async getNewsletterTemplate() {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{company.hotelName}} Newsletter</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 30px; border-radius: 10px 10px 0 0; }
        .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .article { margin: 25px 0; padding: 20px; border-left: 4px solid #667eea; background: #f8f9fa; }
        .btn { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .stats { background: #e9ecef; padding: 15px; border-radius: 6px; margin: 20px 0; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📰 {{company.hotelName}} Newsletter</h1>
            <p>{{time.greeting}}, {{user.firstName}}!</p>
        </div>
        <div class="content">
            <p>Welcome to your monthly update from {{company.hotelName}}! Here's what's happening in our world of hospitality.</p>

            {{#if user.loyaltyPoints}}
            <div class="stats">
                <h3>Your Membership Status</h3>
                <p>{{loyaltyBadge user.loyaltyTier}} Member | {{user.loyaltyPoints}} Points | {{user.totalBookings}} Stays</p>
            </div>
            {{/if}}

            <div class="article">
                <h3>🌟 Featured: Luxury Spa Packages</h3>
                <p>Indulge in our new wellness experiences designed to rejuvenate your mind, body, and soul. Book now and save 25% on all spa treatments.</p>
                <a href="{{company.hotelWebsite}}/spa" class="btn">Explore Spa Services</a>
            </div>

            <div class="article">
                <h3>🍽️ Culinary Excellence</h3>
                <p>Our head chef has crafted a new seasonal menu featuring locally-sourced ingredients and innovative flavors that celebrate the region's culinary heritage.</p>
                <a href="{{company.hotelWebsite}}/dining" class="btn">View Menu</a>
            </div>

            <div class="article">
                <h3>📅 Upcoming Events</h3>
                <p>Join us for wine tastings, cooking classes, and live music performances throughout the month. Limited seating available.</p>
                <a href="{{company.hotelWebsite}}/events" class="btn">See Events</a>
            </div>

            <div style="text-align: center; margin: 30px 0;">
                <a href="{{company.hotelWebsite}}/offers" class="btn">View All Offers</a>
                <a href="{{company.hotelWebsite}}/book" class="btn">Book Your Stay</a>
            </div>

            <p>Thank you for being a valued member of our community. We look forward to welcoming you back soon!</p>
        </div>
        <div class="footer">
            <p>&copy; {{time.currentYear}} {{company.hotelName}}. All rights reserved.</p>
            <p><a href="{{campaign.unsubscribeUrl}}">Unsubscribe</a> | <a href="{{company.hotelWebsite}}/privacy">Privacy Policy</a></p>
        </div>
    </div>
    {{{campaign.trackingPixel}}}
</body>
</html>`;
  }

  async getPromotionTemplate() {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Special Offer - {{company.hotelName}}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; text-align: center; padding: 30px; border-radius: 10px 10px 0 0; }
        .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .offer-box { background: linear-gradient(135deg, #ff9ff3 0%, #f368e0 100%); color: white; padding: 25px; border-radius: 10px; text-align: center; margin: 20px 0; }
        .btn { display: inline-block; background: #ee5a24; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; margin: 15px 0; font-size: 18px; font-weight: bold; }
        .urgency { background: #fff3cd; color: #856404; padding: 15px; border-radius: 6px; border-left: 4px solid #ffc107; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Exclusive Offer for You!</h1>
            <p>{{time.greeting}}, {{user.firstName}}!</p>
        </div>
        <div class="content">
            <p>As a {{loyaltyBadge user.loyaltyTier}} member, you have access to this exclusive limited-time offer!</p>

            <div class="offer-box">
                <h2>🏨 Save 40% on Your Next Stay</h2>
                <p style="font-size: 24px; margin: 10px 0;"><strong>USE CODE: SAVE40</strong></p>
                <p>Valid on all room types for bookings made before {{formatDate (addDays time.currentDate 7)}}</p>
            </div>

            <div class="urgency">
                <h3>⏰ Limited Time Offer</h3>
                <p>This exclusive discount expires in 7 days. Don't miss out on incredible savings on your favorite luxury accommodations!</p>
            </div>

            <h3>What's Included:</h3>
            <ul>
                <li>🛏️ Luxury accommodations in your preferred room type</li>
                <li>🍳 Complimentary breakfast for all guests</li>
                <li>🚗 Free valet parking</li>
                <li>📶 High-speed WiFi throughout the property</li>
                <li>🏋️ Access to fitness center and pool</li>
                {{#if user.loyaltyTier}}
                <li>⭐ Additional {{user.loyaltyTier}} member perks</li>
                {{/if}}
            </ul>

            <div style="text-align: center; margin: 30px 0;">
                <a href="{{company.hotelWebsite}}/book?promo=SAVE40" class="btn">Book Now & Save 40%</a>
            </div>

            <p><strong>Terms & Conditions:</strong> Offer valid for new bookings only. Cannot be combined with other offers. Subject to availability. Blackout dates may apply.</p>

            <p>Questions? Contact our reservations team at {{company.supportEmail}} or {{company.supportPhone}}.</p>
        </div>
        <div class="footer">
            <p>&copy; {{time.currentYear}} {{company.hotelName}}. All rights reserved.</p>
            <p><a href="{{campaign.unsubscribeUrl}}">Unsubscribe</a> | <a href="{{company.hotelWebsite}}/privacy">Privacy Policy</a></p>
        </div>
    </div>
    {{{campaign.trackingPixel}}}
</body>
</html>`;
  }

  async getPasswordResetTemplate() {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Password Reset - {{company.hotelName}}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #495057 0%, #343a40 100%); color: white; text-align: center; padding: 30px; border-radius: 10px 10px 0 0; }
        .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .btn { display: inline-block; background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-size: 16px; }
        .security-notice { background: #fff3cd; color: #856404; padding: 15px; border-radius: 6px; border-left: 4px solid #ffc107; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔒 Password Reset Request</h1>
            <p>{{time.greeting}}, {{user.firstName}}</p>
        </div>
        <div class="content">
            <p>We received a request to reset the password for your {{company.hotelName}} account.</p>

            <div style="text-align: center; margin: 30px 0;">
                <a href="{{resetUrl}}" class="btn">Reset Your Password</a>
            </div>

            <div class="security-notice">
                <h3>🛡️ Security Information</h3>
                <ul>
                    <li>This link will expire in 1 hour for your security</li>
                    <li>If you didn't request this reset, you can safely ignore this email</li>
                    <li>Your current password will remain unchanged until you create a new one</li>
                </ul>
            </div>

            <p>If you're having trouble with the button above, copy and paste this URL into your browser:</p>
            <p style="word-break: break-all; color: #007bff;">{{resetUrl}}</p>

            <p>For security questions or assistance, please contact us at {{company.supportEmail}} or {{company.supportPhone}}.</p>
        </div>
        <div class="footer">
            <p>&copy; {{time.currentYear}} {{company.hotelName}}. All rights reserved.</p>
            <p><a href="{{company.hotelWebsite}}/privacy">Privacy Policy</a> | <a href="{{company.hotelWebsite}}/security">Security Center</a></p>
        </div>
    </div>
    {{{campaign.trackingPixel}}}
</body>
</html>`;
  }

  async getLoyaltyUpdateTemplate() {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Loyalty Update - {{company.hotelName}}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; text-align: center; padding: 30px; border-radius: 10px 10px 0 0; }
        .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .points-display { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 10px; text-align: center; margin: 20px 0; }
        .tier-progress { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .progress-bar { background: #e9ecef; height: 10px; border-radius: 5px; overflow: hidden; margin: 10px 0; }
        .progress-fill { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); height: 100%; transition: width 0.3s ease; }
        .btn { display: inline-block; background: #f5576c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌟 Loyalty Program Update</h1>
            <p>{{time.greeting}}, {{user.firstName}}!</p>
        </div>
        <div class="content">
            <p>Exciting news about your {{company.hotelName}} loyalty status and rewards!</p>

            <div class="points-display">
                <h2>{{loyaltyBadge user.loyaltyTier}}</h2>
                <p style="font-size: 36px; margin: 10px 0;"><strong>{{user.loyaltyPoints}}</strong></p>
                <p>Total Loyalty Points</p>
            </div>

            <div class="tier-progress">
                <h3>Progress to Next Tier</h3>
                {{#ifEquals user.loyaltyTier "bronze"}}
                <p>You're {{subtract 500 user.loyaltyPoints}} points away from Silver status!</p>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: {{multiply (divide user.loyaltyPoints 500) 100}}%;"></div>
                </div>
                <p><small>Silver Tier: 500 points</small></p>
                {{/ifEquals}}
                {{#ifEquals user.loyaltyTier "silver"}}
                <p>You're {{subtract 1000 user.loyaltyPoints}} points away from Gold status!</p>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: {{multiply (divide (subtract user.loyaltyPoints 500) 500) 100}}%;"></div>
                </div>
                <p><small>Gold Tier: 1,000 points</small></p>
                {{/ifEquals}}
                {{#ifEquals user.loyaltyTier "gold"}}
                <p>You're {{subtract 2500 user.loyaltyPoints}} points away from Platinum status!</p>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: {{multiply (divide (subtract user.loyaltyPoints 1000) 1500) 100}}%;"></div>
                </div>
                <p><small>Platinum Tier: 2,500 points</small></p>
                {{/ifEquals}}
                {{#ifEquals user.loyaltyTier "platinum"}}
                <p>🎉 Congratulations! You've reached our highest tier!</p>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: 100%;"></div>
                </div>
                <p><small>You're enjoying all premium benefits!</small></p>
                {{/ifEquals}}
            </div>

            <h3>Your Current Benefits:</h3>
            <ul>
                {{#ifEquals user.loyaltyTier "bronze"}}
                <li>🎁 5% discount on all bookings</li>
                <li>📧 Exclusive member newsletters</li>
                <li>🎂 Birthday month special offers</li>
                {{/ifEquals}}
                {{#ifEquals user.loyaltyTier "silver"}}
                <li>🎁 10% discount on all bookings</li>
                <li>🏨 Room upgrade subject to availability</li>
                <li>🍳 Complimentary breakfast</li>
                <li>📧 Exclusive member newsletters</li>
                <li>🎂 Birthday month special offers</li>
                {{/ifEquals}}
                {{#ifEquals user.loyaltyTier "gold"}}
                <li>🎁 15% discount on all bookings</li>
                <li>🏨 Guaranteed room upgrades</li>
                <li>🍳 Complimentary breakfast</li>
                <li>📞 Priority customer service</li>
                <li>🎉 Welcome amenities</li>
                <li>📧 Exclusive member newsletters</li>
                <li>🎂 Birthday month special offers</li>
                {{/ifEquals}}
                {{#ifEquals user.loyaltyTier "platinum"}}
                <li>🎁 20% discount on all bookings</li>
                <li>🏨 Suite upgrades when available</li>
                <li>🍳 Complimentary breakfast</li>
                <li>📞 Dedicated concierge service</li>
                <li>🎉 Premium welcome amenities</li>
                <li>🚗 Complimentary airport transfers</li>
                <li>🌟 Early check-in/late check-out</li>
                <li>📧 Exclusive member newsletters</li>
                <li>🎂 Birthday month special offers</li>
                {{/ifEquals}}
            </ul>

            <div style="text-align: center; margin: 30px 0;">
                <a href="{{company.hotelWebsite}}/loyalty" class="btn">View Full Benefits</a>
                <a href="{{company.hotelWebsite}}/redeem" class="btn">Redeem Points</a>
            </div>

            <p>Keep earning points with every stay, and enjoy even more exclusive benefits as you climb the tiers!</p>
        </div>
        <div class="footer">
            <p>&copy; {{time.currentYear}} {{company.hotelName}}. All rights reserved.</p>
            <p><a href="{{campaign.unsubscribeUrl}}">Unsubscribe</a> | <a href="{{company.hotelWebsite}}/privacy">Privacy Policy</a></p>
        </div>
    </div>
    {{{campaign.trackingPixel}}}
</body>
</html>`;
  }

  async getErrorTemplate() {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Email Template Error</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .error { background: #f8d7da; color: #721c24; padding: 20px; border-radius: 8px; border: 1px solid #f5c6cb; }
    </style>
</head>
<body>
    <div class="container">
        <div class="error">
            <h2>⚠️ Email Template Error</h2>
            <p>There was an error rendering this email template.</p>
            {{#if error}}
            <p><strong>Error:</strong> {{error}}</p>
            {{/if}}
            <p>Please contact support if this issue persists.</p>
        </div>
    </div>
</body>
</html>`;
  }

  getAvailableTemplates() {
    return Array.from(this.templates.keys());
  }

  getTemplateInfo() {
    return {
      totalTemplates: this.templates.size,
      availableTemplates: this.getAvailableTemplates(),
      helpers: Array.from(this.helpers.keys()),
      partials: Array.from(this.partials.keys())
    };
  }
}

const emailTemplateEngine = new EmailTemplateEngine();

export { emailTemplateEngine };
export default EmailTemplateEngine;