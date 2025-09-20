import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      // Check if SMTP credentials are provided
      if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        logger.warn('SMTP credentials not provided. Email functionality will be disabled.');
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        tls: {
          rejectUnauthorized: false // Allow self-signed certificates for development
        }
      });

      logger.info('Email transporter initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize email transporter:', error);
    }
  }

  async verifyConnection() {
    if (!this.transporter) {
      throw new Error('Email transporter not initialized');
    }

    try {
      await this.transporter.verify();
      logger.info('SMTP connection verified successfully');
      return true;
    } catch (error) {
      logger.error('SMTP connection verification failed:', error);
      throw error;
    }
  }

  async sendEmail({ to, subject, text, html, from }) {
    if (!this.transporter) {
      logger.warn('Email transporter not available. Email not sent.');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const mailOptions = {
        from: from || `"The Pentouz Hotels" <${process.env.SMTP_USER}>`,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        text,
        html
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      logger.info(`Email sent successfully to ${to}`, {
        messageId: result.messageId,
        subject
      });

      return {
        success: true,
        messageId: result.messageId,
        response: result.response
      };
    } catch (error) {
      logger.error('Failed to send email:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async sendContactFormNotification(contactData, recipients) {
    const { name, email, phone, subject, message } = contactData;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0;">
          <h2 style="margin: 0; font-size: 24px;">New Contact Form Submission</h2>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">From The Pentouz Website</p>
        </div>
        
        <div style="background: white; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px; padding: 30px;">
          <div style="margin-bottom: 25px;">
            <h3 style="color: #333; margin-bottom: 15px; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">Guest Information</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555; width: 100px;">Name:</td>
                <td style="padding: 8px 0; color: #333;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Email:</td>
                <td style="padding: 8px 0;"><a href="mailto:${email}" style="color: #667eea; text-decoration: none;">${email}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Phone:</td>
                <td style="padding: 8px 0; color: #333;">${phone || 'Not provided'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Subject:</td>
                <td style="padding: 8px 0; color: #333;">${subject}</td>
              </tr>
            </table>
          </div>
          
          <div>
            <h3 style="color: #333; margin-bottom: 15px; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">Message</h3>
            <div style="background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; border-radius: 0 5px 5px 0; line-height: 1.6; color: #333;">
              ${message.replace(/\n/g, '<br>')}
            </div>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center;">
            <p style="color: #666; font-size: 14px; margin-bottom: 15px;">
              Please respond directly to the guest at: <strong>${email}</strong>
            </p>
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 5px; display: inline-block;">
              <strong>The Pentouz Contact Form</strong><br>
              <small>Automated notification system</small>
            </div>
          </div>
        </div>
      </div>
    `;

    const textContent = `
New contact form submission from The Pentouz website:

Name: ${name}
Email: ${email}
Phone: ${phone || 'Not provided'}
Subject: ${subject}

Message:
${message}

---
Please respond directly to the guest at: ${email}
This is an automated message from The Pentouz contact form.
    `.trim();

    const recipientEmails = recipients.map(recipient => recipient.email);

    return await this.sendEmail({
      to: recipientEmails,
      subject: `Contact Form: ${subject}`,
      text: textContent,
      html: htmlContent
    });
  }

  async sendWelcomeEmail(user) {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">Welcome to The Pentouz!</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Your luxury hospitality experience begins here</p>
        </div>
        
        <div style="background: white; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px; padding: 30px;">
          <p style="color: #333; font-size: 16px; line-height: 1.6;">Dear ${user.name},</p>
          
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Thank you for joining The Pentouz family! We're thrilled to have you as part of our exclusive community.
          </p>
          
          <div style="background: #f8f9fa; border-radius: 8px; padding: 25px; margin: 25px 0;">
            <h3 style="color: #333; margin-bottom: 15px;">Your Account Details:</h3>
            <p style="margin: 5px 0; color: #555;"><strong>Name:</strong> ${user.name}</p>
            <p style="margin: 5px 0; color: #555;"><strong>Email:</strong> ${user.email}</p>
            <p style="margin: 5px 0; color: #555;"><strong>Loyalty Tier:</strong> ${user.loyalty?.tier || 'Bronze'}</p>
            <p style="margin: 5px 0; color: #555;"><strong>Member Since:</strong> ${new Date().toLocaleDateString()}</p>
          </div>

          <div style="margin: 25px 0;">
            <h3 style="color: #333; margin-bottom: 15px;">Member Benefits:</h3>
            <ul style="color: #555; line-height: 1.8;">
              <li>Exclusive member rates and seasonal discounts</li>
              <li>Priority booking and complimentary room upgrades</li>
              <li>Loyalty points on every stay</li>
              <li>Access to member-only events and experiences</li>
              <li>24/7 concierge support</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="http://localhost:3000/login" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; 
                      padding: 12px 30px; 
                      text-decoration: none; 
                      border-radius: 25px; 
                      font-weight: bold;
                      display: inline-block;">
              Start Exploring
            </a>
          </div>

          <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 25px;">
            If you have any questions or need assistance, please don't hesitate to contact us at 
            <a href="mailto:sales@pentouz.com" style="color: #667eea;">sales@pentouz.com</a> 
            or call us at +91 8884449930.
          </p>

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
            <p style="color: #666; font-size: 12px; margin: 0;">
              The Pentouz Hotels & Resorts<br>
              46, 6th Cross, Lavelle Road, Bangalore - 560001, India
            </p>
          </div>
        </div>
      </div>
    `;

    const textContent = `
Welcome to The Pentouz!

Dear ${user.name},

Thank you for joining The Pentouz family! We're thrilled to have you as part of our exclusive community.

Your Account Details:
- Name: ${user.name}
- Email: ${user.email}
- Loyalty Tier: ${user.loyalty?.tier || 'Bronze'}
- Member Since: ${new Date().toLocaleDateString()}

Member Benefits:
- Exclusive member rates and seasonal discounts
- Priority booking and complimentary room upgrades
- Loyalty points on every stay
- Access to member-only events and experiences
- 24/7 concierge support

Visit our website to start exploring: http://localhost:3000/login

If you have any questions, contact us at sales@pentouz.com or +91 8884449930.

Best regards,
The Pentouz Hotels & Resorts
46, 6th Cross, Lavelle Road, Bangalore - 560001, India
    `;

    return await this.sendEmail({
      to: user.email,
      subject: 'Welcome to The Pentouz - Your Luxury Journey Begins!',
      text: textContent,
      html: htmlContent
    });
  }

  /**
   * Send inventory reorder alert notification
   * @param {Object} alertData - Alert information
   * @param {Object} itemData - Inventory item information
   * @param {Array} recipients - Array of recipient email addresses
   * @returns {Object} Email send result
   */
  async sendReorderAlertNotification(alertData, itemData, recipients) {
    const priorityColors = {
      critical: '#e74c3c',
      high: '#e67e22',
      medium: '#f39c12',
      low: '#3498db'
    };

    const priorityEmojis = {
      critical: '🚨',
      high: '⚠️',
      medium: '📋',
      low: 'ℹ️'
    };

    const priorityColor = priorityColors[alertData.priority] || '#3498db';
    const priorityEmoji = priorityEmojis[alertData.priority] || '📋';

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: ${priorityColor}; color: white; padding: 25px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 26px;">${priorityEmoji} Inventory Reorder Alert</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Priority: ${alertData.priority.toUpperCase()}</p>
        </div>

        <div style="background: white; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px; padding: 30px;">
          <h2 style="color: #333; margin-top: 0; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">
            ${itemData.name}
          </h2>

          <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #333; margin-bottom: 15px;">📊 Stock Information</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555; width: 140px;">Category:</td>
                <td style="padding: 8px 0; color: #333;">${itemData.category}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Current Stock:</td>
                <td style="padding: 8px 0; color: ${alertData.currentStock <= 0 ? '#e74c3c' : '#333'}; font-weight: ${alertData.currentStock <= 0 ? 'bold' : 'normal'};">
                  ${alertData.currentStock}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Reorder Point:</td>
                <td style="padding: 8px 0; color: #333;">${alertData.reorderPoint}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Suggested Quantity:</td>
                <td style="padding: 8px 0; color: #333;">${alertData.suggestedQuantity}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Estimated Cost:</td>
                <td style="padding: 8px 0; color: #333;">$${alertData.estimatedCost?.toFixed(2) || 'TBD'}</td>
              </tr>
            </table>
          </div>

          ${alertData.supplierInfo?.name ? `
          <div style="background: #e8f5e8; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #27ae60; margin-bottom: 15px;">🏢 Preferred Supplier</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555; width: 140px;">Name:</td>
                <td style="padding: 8px 0; color: #333;">${alertData.supplierInfo.name}</td>
              </tr>
              ${alertData.supplierInfo.contact ? `
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Contact:</td>
                <td style="padding: 8px 0; color: #333;">${alertData.supplierInfo.contact}</td>
              </tr>
              ` : ''}
              ${alertData.supplierInfo.email ? `
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Email:</td>
                <td style="padding: 8px 0;"><a href="mailto:${alertData.supplierInfo.email}" style="color: #27ae60; text-decoration: none;">${alertData.supplierInfo.email}</a></td>
              </tr>
              ` : ''}
              ${alertData.supplierInfo.leadTime ? `
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Lead Time:</td>
                <td style="padding: 8px 0; color: #333;">${alertData.supplierInfo.leadTime} days</td>
              </tr>
              ` : ''}
            </table>
          </div>
          ` : ''}

          ${alertData.priority === 'critical' ? `
          <div style="background: #fff5f5; border: 2px solid #fed7d7; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #e74c3c; margin-top: 0;">⚠️ URGENT ACTION REQUIRED</h3>
            <p style="color: #721c24; font-weight: bold; margin-bottom: 0;">
              This item is critically low and requires immediate attention to prevent stockout and potential service disruption.
            </p>
          </div>
          ` : ''}

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/inventory"
               style="background: ${priorityColor};
                      color: white;
                      padding: 15px 30px;
                      text-decoration: none;
                      border-radius: 25px;
                      font-weight: bold;
                      font-size: 16px;
                      display: inline-block;
                      box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
              Manage Inventory
            </a>
          </div>

          <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
            <h4 style="color: #333; margin-bottom: 10px;">Quick Actions</h4>
            <p style="color: #666; margin: 5px 0;">
              • Review current stock levels<br>
              • Place reorder with supplier<br>
              • Update reorder settings<br>
              • Monitor delivery status
            </p>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center;">
            <p style="color: #666; font-size: 14px; margin-bottom: 10px;">
              This alert was generated automatically by The Pentouz inventory management system.
            </p>
            <p style="color: #666; font-size: 12px; margin: 0;">
              Alert ID: ${alertData._id || 'N/A'} | Generated: ${new Date().toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    `;

    const textContent = `
INVENTORY REORDER ALERT
Priority: ${alertData.priority.toUpperCase()}

Item: ${itemData.name}
Category: ${itemData.category}
Current Stock: ${alertData.currentStock}
Reorder Point: ${alertData.reorderPoint}
Suggested Reorder Quantity: ${alertData.suggestedQuantity}
Estimated Cost: $${alertData.estimatedCost?.toFixed(2) || 'TBD'}

${alertData.supplierInfo?.name ? `
Preferred Supplier:
- Name: ${alertData.supplierInfo.name}
${alertData.supplierInfo.contact ? `- Contact: ${alertData.supplierInfo.contact}` : ''}
${alertData.supplierInfo.email ? `- Email: ${alertData.supplierInfo.email}` : ''}
${alertData.supplierInfo.leadTime ? `- Lead Time: ${alertData.supplierInfo.leadTime} days` : ''}
` : ''}

${alertData.priority === 'critical' ? `
⚠️ URGENT ACTION REQUIRED
This item is critically low and requires immediate attention to prevent stockout.
` : ''}

Quick Actions:
• Review current stock levels
• Place reorder with supplier
• Update reorder settings
• Monitor delivery status

Manage Inventory: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/inventory

---
This alert was generated automatically by The Pentouz inventory management system.
Alert ID: ${alertData._id || 'N/A'} | Generated: ${new Date().toLocaleString()}
    `;

    const subject = `${priorityEmoji} Reorder Alert: ${itemData.name} (${alertData.currentStock} remaining)`;

    return await this.sendEmail({
      to: recipients,
      subject,
      text: textContent,
      html: htmlContent
    });
  }

  /**
   * Send low stock reminder notification
   * @param {Array} lowStockItems - Array of low stock items
   * @param {Array} recipients - Array of recipient email addresses
   * @returns {Object} Email send result
   */
  async sendLowStockReminder(lowStockItems, recipients) {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%); color: white; padding: 25px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 26px;">📋 Weekly Stock Review</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">${lowStockItems.length} items need attention</p>
        </div>

        <div style="background: white; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px; padding: 30px;">
          <h2 style="color: #333; margin-top: 0;">Items Requiring Reorder</h2>

          ${lowStockItems.map(item => `
          <div style="background: #fff9e6; border-left: 4px solid #f39c12; padding: 15px; margin: 15px 0; border-radius: 0 5px 5px 0;">
            <h3 style="color: #333; margin: 0 0 10px 0;">${item.name}</h3>
            <p style="margin: 5px 0; color: #666;"><strong>Category:</strong> ${item.category}</p>
            <p style="margin: 5px 0; color: #666;"><strong>Current Stock:</strong> ${item.currentStock}</p>
            <p style="margin: 5px 0; color: #666;"><strong>Reorder Point:</strong> ${item.reorderSettings?.reorderPoint || 'Not set'}</p>
            <p style="margin: 5px 0; color: #666;"><strong>Status:</strong> ${item.currentStock <= 0 ? 'Out of Stock' : 'Low Stock'}</p>
          </div>
          `).join('')}

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/inventory"
               style="background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%);
                      color: white;
                      padding: 15px 30px;
                      text-decoration: none;
                      border-radius: 25px;
                      font-weight: bold;
                      font-size: 16px;
                      display: inline-block;">
              Review All Items
            </a>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center;">
            <p style="color: #666; font-size: 14px;">
              This is your weekly stock review from The Pentouz inventory management system.
            </p>
          </div>
        </div>
      </div>
    `;

    const textContent = `
WEEKLY STOCK REVIEW
${lowStockItems.length} items need attention

Items Requiring Reorder:

${lowStockItems.map(item => `
- ${item.name} (${item.category})
  Current Stock: ${item.currentStock}
  Reorder Point: ${item.reorderSettings?.reorderPoint || 'Not set'}
  Status: ${item.currentStock <= 0 ? 'Out of Stock' : 'Low Stock'}
`).join('\n')}

Review All Items: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/inventory

---
This is your weekly stock review from The Pentouz inventory management system.
    `;

    return await this.sendEmail({
      to: recipients,
      subject: `📋 Weekly Stock Review - ${lowStockItems.length} items need attention`,
      text: textContent,
      html: htmlContent
    });
  }

  /**
   * Send supplier reorder request notification
   * @param {Object} supplierInfo - Supplier information
   * @param {Array} orderItems - Array of items to order
   * @param {Object} hotelInfo - Hotel information
   * @returns {Object} Email send result
   */
  async sendSupplierReorderRequest(supplierInfo, orderItems, hotelInfo) {
    const totalEstimatedCost = orderItems.reduce((sum, item) => sum + (item.estimatedCost || 0), 0);

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #3498db 0%, #2980b9 100%); color: white; padding: 25px; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 26px;">📋 Reorder Request</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">From The Pentouz Hotels</p>
        </div>

        <div style="background: white; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px; padding: 30px;">
          <p style="color: #333; font-size: 16px;">Dear ${supplierInfo.name},</p>

          <p style="color: #333; font-size: 16px;">
            We would like to place a reorder for the following items:
          </p>

          <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #333; margin-bottom: 15px;">Order Details</h3>

            ${orderItems.map(item => `
            <div style="border-bottom: 1px solid #e0e0e0; padding: 15px 0;">
              <h4 style="color: #333; margin: 0 0 10px 0;">${item.name}</h4>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 5px 0; color: #666; width: 120px;">Category:</td>
                  <td style="padding: 5px 0; color: #333;">${item.category}</td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; color: #666;">Quantity:</td>
                  <td style="padding: 5px 0; color: #333; font-weight: bold;">${item.quantity}</td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; color: #666;">Est. Cost:</td>
                  <td style="padding: 5px 0; color: #333;">$${item.estimatedCost?.toFixed(2) || 'Please quote'}</td>
                </tr>
              </table>
            </div>
            `).join('')}

            <div style="text-align: right; margin-top: 20px; padding-top: 15px; border-top: 2px solid #3498db;">
              <h3 style="color: #333; margin: 0;">Total Estimated: $${totalEstimatedCost.toFixed(2)}</h3>
            </div>
          </div>

          <p style="color: #333; font-size: 16px;">
            Please confirm availability and provide a detailed quote with delivery timeline.
          </p>

          <div style="background: #e8f4fd; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h4 style="color: #3498db; margin-bottom: 10px;">Contact Information</h4>
            <p style="margin: 5px 0; color: #333;"><strong>Hotel:</strong> ${hotelInfo?.name || 'The Pentouz Hotel'}</p>
            <p style="margin: 5px 0; color: #333;"><strong>Contact:</strong> ${hotelInfo?.email || 'procurement@pentouz.com'}</p>
            <p style="margin: 5px 0; color: #333;"><strong>Phone:</strong> ${hotelInfo?.phone || '+91 8884449930'}</p>
          </div>

          <p style="color: #333; font-size: 16px;">
            Thank you for your continued service and partnership.
          </p>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center;">
            <p style="color: #666; font-size: 14px;">
              This is an automated reorder request from The Pentouz inventory management system.
            </p>
          </div>
        </div>
      </div>
    `;

    const textContent = `
REORDER REQUEST
From The Pentouz Hotels

Dear ${supplierInfo.name},

We would like to place a reorder for the following items:

${orderItems.map(item => `
${item.name} (${item.category})
- Quantity: ${item.quantity}
- Estimated Cost: $${item.estimatedCost?.toFixed(2) || 'Please quote'}
`).join('\n')}

Total Estimated: $${totalEstimatedCost.toFixed(2)}

Please confirm availability and provide a detailed quote with delivery timeline.

Contact Information:
- Hotel: ${hotelInfo?.name || 'The Pentouz Hotel'}
- Contact: ${hotelInfo?.email || 'procurement@pentouz.com'}
- Phone: ${hotelInfo?.phone || '+91 8884449930'}

Thank you for your continued service and partnership.

---
This is an automated reorder request from The Pentouz inventory management system.
    `;

    return await this.sendEmail({
      to: supplierInfo.email,
      subject: `Reorder Request - ${orderItems.length} items from The Pentouz`,
      text: textContent,
      html: htmlContent
    });
  }
}

export default new EmailService();