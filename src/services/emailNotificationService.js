import emailService from './emailService.js';
import TravelAgent from '../models/TravelAgent.js';
import TravelAgentBooking from '../models/TravelAgentBooking.js';
import TravelAgentRates from '../models/TravelAgentRates.js';
import Hotel from '../models/Hotel.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';
import { ApplicationError } from '../middleware/errorHandler.js';

class EmailNotificationService {
  constructor() {
    this.templates = {
      commissionPayment: this.getCommissionPaymentTemplate.bind(this),
      bookingConfirmation: this.getBookingConfirmationTemplate.bind(this),
      monthlyStatement: this.getMonthlyStatementTemplate.bind(this),
      rateUpdate: this.getRateUpdateTemplate.bind(this),
      agentApproval: this.getAgentApprovalTemplate.bind(this),
      paymentReminder: this.getPaymentReminderTemplate.bind(this)
    };
  }

  /**
   * Send commission payment notification to travel agent
   * @param {Object} paymentData - Payment information
   * @param {Object} travelAgent - Travel agent details
   * @returns {Object} Email send result
   */
  async sendCommissionPaymentNotification(paymentData, travelAgent) {
    try {
      const template = await this.templates.commissionPayment(paymentData, travelAgent);

      const result = await emailService.sendEmail({
        to: travelAgent.email,
        subject: template.subject,
        html: template.html,
        text: template.text
      });

      if (result.success) {
        logger.info(`Commission payment notification sent to ${travelAgent.email}`);
      } else {
        logger.error(`Failed to send commission payment notification to ${travelAgent.email}:`, result.error);
      }

      return result;
    } catch (error) {
      logger.error('Error sending commission payment notification:', error);
      throw new ApplicationError('Failed to send commission payment notification', 500);
    }
  }

  /**
   * Send booking confirmation email to travel agent
   * @param {Object} booking - Booking details
   * @param {Object} travelAgent - Travel agent details
   * @returns {Object} Email send result
   */
  async sendBookingConfirmationEmail(booking, travelAgent) {
    try {
      const template = await this.templates.bookingConfirmation(booking, travelAgent);

      const result = await emailService.sendEmail({
        to: travelAgent.email,
        subject: template.subject,
        html: template.html,
        text: template.text
      });

      if (result.success) {
        logger.info(`Booking confirmation sent to ${travelAgent.email} for booking ${booking.bookingNumber}`);
      } else {
        logger.error(`Failed to send booking confirmation to ${travelAgent.email}:`, result.error);
      }

      return result;
    } catch (error) {
      logger.error('Error sending booking confirmation:', error);
      throw new ApplicationError('Failed to send booking confirmation', 500);
    }
  }

  /**
   * Send monthly statement email to travel agent
   * @param {string} travelAgentId - Travel agent ID
   * @param {Object} statementData - Monthly statement data
   * @returns {Object} Email send result
   */
  async sendMonthlyStatementEmail(travelAgentId, statementData) {
    try {
      const travelAgent = await TravelAgent.findById(travelAgentId);
      if (!travelAgent) {
        throw new ApplicationError('Travel agent not found', 404);
      }

      const template = await this.templates.monthlyStatement(statementData, travelAgent);

      const result = await emailService.sendEmail({
        to: travelAgent.email,
        subject: template.subject,
        html: template.html,
        text: template.text
      });

      if (result.success) {
        logger.info(`Monthly statement sent to ${travelAgent.email}`);
      } else {
        logger.error(`Failed to send monthly statement to ${travelAgent.email}:`, result.error);
      }

      return result;
    } catch (error) {
      logger.error('Error sending monthly statement:', error);
      throw new ApplicationError('Failed to send monthly statement', 500);
    }
  }

  /**
   * Send rate update notification to travel agents
   * @param {Object} rateUpdate - Rate update information
   * @param {Array} travelAgentIds - Array of travel agent IDs (optional, sends to all if not provided)
   * @returns {Object} Email send results
   */
  async sendRateUpdateNotification(rateUpdate, travelAgentIds = null) {
    try {
      let travelAgents;

      if (travelAgentIds) {
        travelAgents = await TravelAgent.find({
          _id: { $in: travelAgentIds },
          status: 'active',
          isActive: true
        });
      } else {
        travelAgents = await TravelAgent.find({
          status: 'active',
          isActive: true
        });
      }

      const results = [];

      for (const agent of travelAgents) {
        try {
          const template = await this.templates.rateUpdate(rateUpdate, agent);

          const result = await emailService.sendEmail({
            to: agent.email,
            subject: template.subject,
            html: template.html,
            text: template.text
          });

          results.push({
            agentId: agent._id,
            email: agent.email,
            success: result.success,
            error: result.error
          });

          if (result.success) {
            logger.info(`Rate update notification sent to ${agent.email}`);
          } else {
            logger.error(`Failed to send rate update to ${agent.email}:`, result.error);
          }
        } catch (error) {
          logger.error(`Error sending rate update to agent ${agent._id}:`, error);
          results.push({
            agentId: agent._id,
            email: agent.email,
            success: false,
            error: error.message
          });
        }
      }

      return {
        success: true,
        totalSent: results.filter(r => r.success).length,
        totalFailed: results.filter(r => !r.success).length,
        results
      };
    } catch (error) {
      logger.error('Error sending rate update notifications:', error);
      throw new ApplicationError('Failed to send rate update notifications', 500);
    }
  }

  /**
   * Send agent approval notification
   * @param {Object} travelAgent - Travel agent details
   * @param {string} status - Approval status ('approved' or 'rejected')
   * @param {string} reason - Reason for decision (optional)
   * @returns {Object} Email send result
   */
  async sendAgentApprovalNotification(travelAgent, status, reason = null) {
    try {
      const template = await this.templates.agentApproval(travelAgent, status, reason);

      const result = await emailService.sendEmail({
        to: travelAgent.email,
        subject: template.subject,
        html: template.html,
        text: template.text
      });

      if (result.success) {
        logger.info(`Agent approval notification sent to ${travelAgent.email} (${status})`);
      } else {
        logger.error(`Failed to send agent approval notification to ${travelAgent.email}:`, result.error);
      }

      return result;
    } catch (error) {
      logger.error('Error sending agent approval notification:', error);
      throw new ApplicationError('Failed to send agent approval notification', 500);
    }
  }

  /**
   * Send payment reminder to travel agent
   * @param {Object} paymentData - Outstanding payment information
   * @param {Object} travelAgent - Travel agent details
   * @returns {Object} Email send result
   */
  async sendPaymentReminder(paymentData, travelAgent) {
    try {
      const template = await this.templates.paymentReminder(paymentData, travelAgent);

      const result = await emailService.sendEmail({
        to: travelAgent.email,
        subject: template.subject,
        html: template.html,
        text: template.text
      });

      if (result.success) {
        logger.info(`Payment reminder sent to ${travelAgent.email}`);
      } else {
        logger.error(`Failed to send payment reminder to ${travelAgent.email}:`, result.error);
      }

      return result;
    } catch (error) {
      logger.error('Error sending payment reminder:', error);
      throw new ApplicationError('Failed to send payment reminder', 500);
    }
  }

  /**
   * Get commission payment email template
   * @param {Object} paymentData - Payment information
   * @param {Object} travelAgent - Travel agent details
   * @returns {Object} Email template
   */
  async getCommissionPaymentTemplate(paymentData, travelAgent) {
    const { amount, bookings, paymentMethod, transactionId, paymentDate } = paymentData;

    const subject = `Commission Payment Processed - $${amount.toFixed(2)}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #27ae60 0%, #229954 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">💰 Commission Payment Processed</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 18px;">$${amount.toFixed(2)} has been paid to your account</p>
        </div>

        <div style="background: white; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px; padding: 30px;">
          <p style="color: #333; font-size: 16px;">Dear ${travelAgent.contactPerson},</p>

          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            We're pleased to inform you that your commission payment has been processed successfully.
          </p>

          <div style="background: #f8f9fa; border-radius: 8px; padding: 25px; margin: 25px 0;">
            <h3 style="color: #333; margin-bottom: 20px; text-align: center;">Payment Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #555; border-bottom: 1px solid #eee;">Payment Amount:</td>
                <td style="padding: 10px 0; color: #27ae60; font-weight: bold; font-size: 18px; border-bottom: 1px solid #eee;">$${amount.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #555; border-bottom: 1px solid #eee;">Payment Method:</td>
                <td style="padding: 10px 0; color: #333; border-bottom: 1px solid #eee;">${paymentMethod || 'Bank Transfer'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #555; border-bottom: 1px solid #eee;">Transaction ID:</td>
                <td style="padding: 10px 0; color: #333; border-bottom: 1px solid #eee;">${transactionId || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #555;">Payment Date:</td>
                <td style="padding: 10px 0; color: #333;">${new Date(paymentDate).toLocaleDateString()}</td>
              </tr>
            </table>
          </div>

          ${bookings && bookings.length > 0 ? `
          <div style="margin: 25px 0;">
            <h3 style="color: #333; margin-bottom: 15px;">Bookings Included:</h3>
            <div style="background: #fff9f0; border-radius: 8px; padding: 20px;">
              ${bookings.map(booking => `
                <div style="border-bottom: 1px solid #f0f0f0; padding: 10px 0; margin-bottom: 10px;">
                  <strong>Booking ${booking.bookingNumber}</strong><br>
                  <span style="color: #666; font-size: 14px;">Commission: $${booking.commissionAmount?.toFixed(2) || '0.00'}</span>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/travel-agent/dashboard"
               style="background: linear-gradient(135deg, #27ae60 0%, #229954 100%);
                      color: white;
                      padding: 15px 30px;
                      text-decoration: none;
                      border-radius: 25px;
                      font-weight: bold;
                      font-size: 16px;
                      display: inline-block;">
              View Dashboard
            </a>
          </div>

          <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 25px;">
            If you have any questions about this payment, please contact us at
            <a href="mailto:finance@pentouz.com" style="color: #27ae60;">finance@pentouz.com</a>
            or call us at +91 8884449930.
          </p>

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
            <p style="color: #666; font-size: 12px; margin: 0;">
              The Pentouz Hotels & Resorts<br>
              Finance Department
            </p>
          </div>
        </div>
      </div>
    `;

    const text = `
Commission Payment Processed

Dear ${travelAgent.contactPerson},

We're pleased to inform you that your commission payment has been processed successfully.

Payment Details:
- Payment Amount: $${amount.toFixed(2)}
- Payment Method: ${paymentMethod || 'Bank Transfer'}
- Transaction ID: ${transactionId || 'N/A'}
- Payment Date: ${new Date(paymentDate).toLocaleDateString()}

${bookings && bookings.length > 0 ? `
Bookings Included:
${bookings.map(booking => `- Booking ${booking.bookingNumber}: $${booking.commissionAmount?.toFixed(2) || '0.00'}`).join('\n')}
` : ''}

View your dashboard: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/travel-agent/dashboard

If you have any questions, contact us at finance@pentouz.com or +91 8884449930.

Best regards,
The Pentouz Hotels & Resorts - Finance Department
    `;

    return { subject, html, text };
  }

  /**
   * Get booking confirmation email template
   * @param {Object} booking - Booking details
   * @param {Object} travelAgent - Travel agent details
   * @returns {Object} Email template
   */
  async getBookingConfirmationTemplate(booking, travelAgent) {
    const subject = `Booking Confirmed - ${booking.bookingNumber}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #3498db 0%, #2980b9 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">✅ Booking Confirmed</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 18px;">Booking #${booking.bookingNumber}</p>
        </div>

        <div style="background: white; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px; padding: 30px;">
          <p style="color: #333; font-size: 16px;">Dear ${travelAgent.contactPerson},</p>

          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Great news! The booking has been confirmed successfully. Here are the details:
          </p>

          <div style="background: #f8f9fa; border-radius: 8px; padding: 25px; margin: 25px 0;">
            <h3 style="color: #333; margin-bottom: 20px; text-align: center;">Booking Information</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #555; border-bottom: 1px solid #eee;">Booking Number:</td>
                <td style="padding: 10px 0; color: #333; border-bottom: 1px solid #eee;">${booking.bookingNumber}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #555; border-bottom: 1px solid #eee;">Guest Name:</td>
                <td style="padding: 10px 0; color: #333; border-bottom: 1px solid #eee;">${booking.guestDetails?.firstName || ''} ${booking.guestDetails?.lastName || ''}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #555; border-bottom: 1px solid #eee;">Check-in:</td>
                <td style="padding: 10px 0; color: #333; border-bottom: 1px solid #eee;">${new Date(booking.checkIn).toLocaleDateString()}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #555; border-bottom: 1px solid #eee;">Check-out:</td>
                <td style="padding: 10px 0; color: #333; border-bottom: 1px solid #eee;">${new Date(booking.checkOut).toLocaleDateString()}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #555; border-bottom: 1px solid #eee;">Total Amount:</td>
                <td style="padding: 10px 0; color: #333; border-bottom: 1px solid #eee;">$${booking.totalAmount?.toFixed(2) || '0.00'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #555;">Commission:</td>
                <td style="padding: 10px 0; color: #27ae60; font-weight: bold;">$${booking.commissionAmount?.toFixed(2) || '0.00'}</td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/travel-agent/bookings"
               style="background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
                      color: white;
                      padding: 15px 30px;
                      text-decoration: none;
                      border-radius: 25px;
                      font-weight: bold;
                      font-size: 16px;
                      display: inline-block;">
              View All Bookings
            </a>
          </div>

          <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 25px;">
            Your commission will be processed according to the payment terms in your agreement.
          </p>

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
            <p style="color: #666; font-size: 12px; margin: 0;">
              The Pentouz Hotels & Resorts<br>
              Reservations Department
            </p>
          </div>
        </div>
      </div>
    `;

    const text = `
Booking Confirmed

Dear ${travelAgent.contactPerson},

Great news! The booking has been confirmed successfully.

Booking Information:
- Booking Number: ${booking.bookingNumber}
- Guest Name: ${booking.guestDetails?.firstName || ''} ${booking.guestDetails?.lastName || ''}
- Check-in: ${new Date(booking.checkIn).toLocaleDateString()}
- Check-out: ${new Date(booking.checkOut).toLocaleDateString()}
- Total Amount: $${booking.totalAmount?.toFixed(2) || '0.00'}
- Commission: $${booking.commissionAmount?.toFixed(2) || '0.00'}

View all bookings: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/travel-agent/bookings

Your commission will be processed according to the payment terms in your agreement.

Best regards,
The Pentouz Hotels & Resorts - Reservations Department
    `;

    return { subject, html, text };
  }

  /**
   * Get monthly statement email template
   * @param {Object} statementData - Monthly statement data
   * @param {Object} travelAgent - Travel agent details
   * @returns {Object} Email template
   */
  async getMonthlyStatementTemplate(statementData, travelAgent) {
    const { month, year, totalBookings, totalRevenue, totalCommissions, bookings } = statementData;

    const subject = `Monthly Statement - ${month} ${year}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #8e44ad 0%, #7d3c98 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">📊 Monthly Statement</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 18px;">${month} ${year}</p>
        </div>

        <div style="background: white; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px; padding: 30px;">
          <p style="color: #333; font-size: 16px;">Dear ${travelAgent.contactPerson},</p>

          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Here's your monthly performance statement for ${month} ${year}.
          </p>

          <div style="background: #f8f9fa; border-radius: 8px; padding: 25px; margin: 25px 0;">
            <h3 style="color: #333; margin-bottom: 20px; text-align: center;">Monthly Summary</h3>
            <div style="display: flex; justify-content: space-around; text-align: center;">
              <div style="flex: 1; padding: 10px;">
                <div style="font-size: 24px; font-weight: bold; color: #3498db;">${totalBookings}</div>
                <div style="color: #666; font-size: 14px;">Total Bookings</div>
              </div>
              <div style="flex: 1; padding: 10px;">
                <div style="font-size: 24px; font-weight: bold; color: #e74c3c;">$${totalRevenue?.toFixed(2) || '0.00'}</div>
                <div style="color: #666; font-size: 14px;">Total Revenue</div>
              </div>
              <div style="flex: 1; padding: 10px;">
                <div style="font-size: 24px; font-weight: bold; color: #27ae60;">$${totalCommissions?.toFixed(2) || '0.00'}</div>
                <div style="color: #666; font-size: 14px;">Total Commissions</div>
              </div>
            </div>
          </div>

          ${bookings && bookings.length > 0 ? `
          <div style="margin: 25px 0;">
            <h3 style="color: #333; margin-bottom: 15px;">Booking Details:</h3>
            <div style="background: #fff9f0; border-radius: 8px; padding: 20px; max-height: 300px; overflow-y: auto;">
              ${bookings.map(booking => `
                <div style="border-bottom: 1px solid #f0f0f0; padding: 15px 0;">
                  <div style="font-weight: bold; color: #333;">${booking.bookingNumber}</div>
                  <div style="color: #666; font-size: 14px; margin: 5px 0;">
                    ${new Date(booking.checkIn).toLocaleDateString()} - ${new Date(booking.checkOut).toLocaleDateString()}
                  </div>
                  <div style="color: #27ae60; font-weight: bold;">Commission: $${booking.commissionAmount?.toFixed(2) || '0.00'}</div>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/travel-agent/statements"
               style="background: linear-gradient(135deg, #8e44ad 0%, #7d3c98 100%);
                      color: white;
                      padding: 15px 30px;
                      text-decoration: none;
                      border-radius: 25px;
                      font-weight: bold;
                      font-size: 16px;
                      display: inline-block;">
              View All Statements
            </a>
          </div>

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
            <p style="color: #666; font-size: 12px; margin: 0;">
              The Pentouz Hotels & Resorts<br>
              Finance Department
            </p>
          </div>
        </div>
      </div>
    `;

    const text = `
Monthly Statement - ${month} ${year}

Dear ${travelAgent.contactPerson},

Here's your monthly performance statement for ${month} ${year}.

Monthly Summary:
- Total Bookings: ${totalBookings}
- Total Revenue: $${totalRevenue?.toFixed(2) || '0.00'}
- Total Commissions: $${totalCommissions?.toFixed(2) || '0.00'}

${bookings && bookings.length > 0 ? `
Booking Details:
${bookings.map(booking => `- ${booking.bookingNumber}: $${booking.commissionAmount?.toFixed(2) || '0.00'}`).join('\n')}
` : ''}

View all statements: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/travel-agent/statements

Best regards,
The Pentouz Hotels & Resorts - Finance Department
    `;

    return { subject, html, text };
  }

  /**
   * Get rate update email template
   * @param {Object} rateUpdate - Rate update information
   * @param {Object} travelAgent - Travel agent details
   * @returns {Object} Email template
   */
  async getRateUpdateTemplate(rateUpdate, travelAgent) {
    const { effectiveDate, changes, reason } = rateUpdate;

    const subject = `Important: Rate Update Notification`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">📈 Rate Update Notification</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Effective ${new Date(effectiveDate).toLocaleDateString()}</p>
        </div>

        <div style="background: white; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px; padding: 30px;">
          <p style="color: #333; font-size: 16px;">Dear ${travelAgent.contactPerson},</p>

          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            We're writing to inform you about important updates to our rates and commission structure.
          </p>

          <div style="background: #fff9e6; border-left: 4px solid #f39c12; padding: 20px; margin: 25px 0;">
            <h3 style="color: #333; margin-bottom: 15px;">📅 Effective Date: ${new Date(effectiveDate).toLocaleDateString()}</h3>
            ${reason ? `<p style="color: #666; margin-bottom: 15px;"><strong>Reason:</strong> ${reason}</p>` : ''}
          </div>

          ${changes && changes.length > 0 ? `
          <div style="margin: 25px 0;">
            <h3 style="color: #333; margin-bottom: 15px;">Rate Changes:</h3>
            <div style="background: #f8f9fa; border-radius: 8px; padding: 20px;">
              ${changes.map(change => `
                <div style="border-bottom: 1px solid #e0e0e0; padding: 15px 0; margin-bottom: 15px;">
                  <div style="font-weight: bold; color: #333; margin-bottom: 8px;">${change.roomType || 'General'}</div>
                  ${change.oldRate ? `<div style="color: #e74c3c; font-size: 14px;">Previous: ${change.oldRate}%</div>` : ''}
                  <div style="color: #27ae60; font-weight: bold; font-size: 16px;">New Rate: ${change.newRate}%</div>
                  ${change.description ? `<div style="color: #666; font-size: 14px; margin-top: 5px;">${change.description}</div>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}

          <div style="background: #e8f4fd; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h4 style="color: #3498db; margin-bottom: 10px;">📋 What You Need to Do:</h4>
            <ul style="color: #333; line-height: 1.6; margin: 0; padding-left: 20px;">
              <li>Review the updated rates in your agent portal</li>
              <li>Update your pricing accordingly</li>
              <li>Contact us if you have any questions</li>
              <li>New rates will apply to all bookings made after the effective date</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/travel-agent/rates"
               style="background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%);
                      color: white;
                      padding: 15px 30px;
                      text-decoration: none;
                      border-radius: 25px;
                      font-weight: bold;
                      font-size: 16px;
                      display: inline-block;">
              View Updated Rates
            </a>
          </div>

          <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 25px;">
            If you have any questions about these changes, please contact us at
            <a href="mailto:rates@pentouz.com" style="color: #f39c12;">rates@pentouz.com</a>
            or call us at +91 8884449930.
          </p>

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
            <p style="color: #666; font-size: 12px; margin: 0;">
              The Pentouz Hotels & Resorts<br>
              Revenue Management Team
            </p>
          </div>
        </div>
      </div>
    `;

    const text = `
Rate Update Notification

Dear ${travelAgent.contactPerson},

We're writing to inform you about important updates to our rates and commission structure.

Effective Date: ${new Date(effectiveDate).toLocaleDateString()}
${reason ? `Reason: ${reason}` : ''}

${changes && changes.length > 0 ? `
Rate Changes:
${changes.map(change => `- ${change.roomType || 'General'}: ${change.newRate}%${change.description ? ` (${change.description})` : ''}`).join('\n')}
` : ''}

What You Need to Do:
- Review the updated rates in your agent portal
- Update your pricing accordingly
- Contact us if you have any questions
- New rates will apply to all bookings made after the effective date

View updated rates: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/travel-agent/rates

If you have any questions, contact us at rates@pentouz.com or +91 8884449930.

Best regards,
The Pentouz Hotels & Resorts - Revenue Management Team
    `;

    return { subject, html, text };
  }

  /**
   * Get agent approval email template
   * @param {Object} travelAgent - Travel agent details
   * @param {string} status - Approval status
   * @param {string} reason - Reason for decision
   * @returns {Object} Email template
   */
  async getAgentApprovalTemplate(travelAgent, status, reason) {
    const isApproved = status === 'approved';
    const subject = `Travel Agent Application ${isApproved ? 'Approved' : 'Update Required'}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, ${isApproved ? '#27ae60' : '#e74c3c'} 0%, ${isApproved ? '#229954' : '#c0392b'} 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">${isApproved ? '✅' : '❌'} Application ${isApproved ? 'Approved' : 'Update Required'}</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Travel Agent Partnership</p>
        </div>

        <div style="background: white; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px; padding: 30px;">
          <p style="color: #333; font-size: 16px;">Dear ${travelAgent.contactPerson},</p>

          ${isApproved ? `
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Congratulations! Your travel agent application has been approved. Welcome to The Pentouz partner network!
          </p>

          <div style="background: #f8fff8; border-radius: 8px; padding: 25px; margin: 25px 0;">
            <h3 style="color: #27ae60; margin-bottom: 20px;">🎉 Your Agent Details:</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #555; border-bottom: 1px solid #eee;">Agent Code:</td>
                <td style="padding: 10px 0; color: #333; border-bottom: 1px solid #eee;">${travelAgent.agentCode}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #555; border-bottom: 1px solid #eee;">Company:</td>
                <td style="padding: 10px 0; color: #333; border-bottom: 1px solid #eee;">${travelAgent.companyName}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #555;">Commission Rate:</td>
                <td style="padding: 10px 0; color: #27ae60; font-weight: bold;">${travelAgent.commissionStructure?.defaultRate || 0}%</td>
              </tr>
            </table>
          </div>

          <div style="background: #e8f4fd; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h4 style="color: #3498db; margin-bottom: 10px;">🚀 Next Steps:</h4>
            <ul style="color: #333; line-height: 1.6; margin: 0; padding-left: 20px;">
              <li>Log into your agent portal to start making bookings</li>
              <li>Review our current rates and availability</li>
              <li>Download marketing materials and booking guidelines</li>
              <li>Contact our partner support team for any assistance</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/travel-agent/dashboard"
               style="background: linear-gradient(135deg, #27ae60 0%, #229954 100%);
                      color: white;
                      padding: 15px 30px;
                      text-decoration: none;
                      border-radius: 25px;
                      font-weight: bold;
                      font-size: 16px;
                      display: inline-block;">
              Access Agent Portal
            </a>
          </div>
          ` : `
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Thank you for your interest in partnering with The Pentouz. Your application requires some updates before we can proceed with approval.
          </p>

          ${reason ? `
          <div style="background: #fff5f5; border-left: 4px solid #e74c3c; padding: 20px; margin: 25px 0;">
            <h4 style="color: #e74c3c; margin-bottom: 10px;">📋 Required Updates:</h4>
            <p style="color: #333; margin: 0;">${reason}</p>
          </div>
          ` : ''}

          <div style="background: #e8f4fd; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h4 style="color: #3498db; margin-bottom: 10px;">📞 Next Steps:</h4>
            <ul style="color: #333; line-height: 1.6; margin: 0; padding-left: 20px;">
              <li>Review the feedback provided above</li>
              <li>Update your application with the required information</li>
              <li>Contact our partner team for clarification if needed</li>
              <li>Resubmit your application for review</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/travel-agent/application"
               style="background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
                      color: white;
                      padding: 15px 30px;
                      text-decoration: none;
                      border-radius: 25px;
                      font-weight: bold;
                      font-size: 16px;
                      display: inline-block;">
              Update Application
            </a>
          </div>
          `}

          <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 25px;">
            If you have any questions, please contact our partner support team at
            <a href="mailto:partners@pentouz.com" style="color: ${isApproved ? '#27ae60' : '#3498db'};">partners@pentouz.com</a>
            or call us at +91 8884449930.
          </p>

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
            <p style="color: #666; font-size: 12px; margin: 0;">
              The Pentouz Hotels & Resorts<br>
              Partner Relations Team
            </p>
          </div>
        </div>
      </div>
    `;

    const text = `
Travel Agent Application ${isApproved ? 'Approved' : 'Update Required'}

Dear ${travelAgent.contactPerson},

${isApproved ? `
Congratulations! Your travel agent application has been approved. Welcome to The Pentouz partner network!

Your Agent Details:
- Agent Code: ${travelAgent.agentCode}
- Company: ${travelAgent.companyName}
- Commission Rate: ${travelAgent.commissionStructure?.defaultRate || 0}%

Next Steps:
- Log into your agent portal to start making bookings
- Review our current rates and availability
- Download marketing materials and booking guidelines
- Contact our partner support team for any assistance

Access Agent Portal: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/travel-agent/dashboard
` : `
Thank you for your interest in partnering with The Pentouz. Your application requires some updates before we can proceed with approval.

${reason ? `Required Updates: ${reason}` : ''}

Next Steps:
- Review the feedback provided above
- Update your application with the required information
- Contact our partner team for clarification if needed
- Resubmit your application for review

Update Application: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/travel-agent/application
`}

If you have any questions, contact us at partners@pentouz.com or +91 8884449930.

Best regards,
The Pentouz Hotels & Resorts - Partner Relations Team
    `;

    return { subject, html, text };
  }

  /**
   * Get payment reminder email template
   * @param {Object} paymentData - Outstanding payment information
   * @param {Object} travelAgent - Travel agent details
   * @returns {Object} Email template
   */
  async getPaymentReminderTemplate(paymentData, travelAgent) {
    const { outstandingAmount, dueDate, overdueBookings } = paymentData;

    const subject = `Payment Reminder - $${outstandingAmount.toFixed(2)} Outstanding`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">💳 Payment Reminder</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 18px;">$${outstandingAmount.toFixed(2)} Outstanding</p>
        </div>

        <div style="background: white; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px; padding: 30px;">
          <p style="color: #333; font-size: 16px;">Dear ${travelAgent.contactPerson},</p>

          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            This is a friendly reminder that you have an outstanding balance with The Pentouz Hotels.
          </p>

          <div style="background: #fff9e6; border-left: 4px solid #f39c12; padding: 20px; margin: 25px 0;">
            <h3 style="color: #f39c12; margin-bottom: 15px;">💰 Outstanding Balance: $${outstandingAmount.toFixed(2)}</h3>
            <p style="color: #666; margin: 0;">Due Date: ${new Date(dueDate).toLocaleDateString()}</p>
          </div>

          ${overdueBookings && overdueBookings.length > 0 ? `
          <div style="margin: 25px 0;">
            <h3 style="color: #333; margin-bottom: 15px;">Overdue Bookings:</h3>
            <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; max-height: 300px; overflow-y: auto;">
              ${overdueBookings.map(booking => `
                <div style="border-bottom: 1px solid #e0e0e0; padding: 15px 0;">
                  <div style="font-weight: bold; color: #333;">${booking.bookingNumber}</div>
                  <div style="color: #666; font-size: 14px; margin: 5px 0;">
                    Due: ${new Date(booking.dueDate).toLocaleDateString()}
                  </div>
                  <div style="color: #e74c3c; font-weight: bold;">Amount: $${booking.amount?.toFixed(2) || '0.00'}</div>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}

          <div style="background: #e8f4fd; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h4 style="color: #3498db; margin-bottom: 10px;">💳 Payment Options:</h4>
            <ul style="color: #333; line-height: 1.6; margin: 0; padding-left: 20px;">
              <li>Bank transfer to our account</li>
              <li>Online payment through your agent portal</li>
              <li>Contact our finance team for payment arrangements</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/travel-agent/payments"
               style="background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%);
                      color: white;
                      padding: 15px 30px;
                      text-decoration: none;
                      border-radius: 25px;
                      font-weight: bold;
                      font-size: 16px;
                      display: inline-block;">
              Make Payment
            </a>
          </div>

          <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 25px;">
            If you have already made this payment, please disregard this reminder. For payment assistance,
            contact our finance team at <a href="mailto:finance@pentouz.com" style="color: #f39c12;">finance@pentouz.com</a>
            or call us at +91 8884449930.
          </p>

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
            <p style="color: #666; font-size: 12px; margin: 0;">
              The Pentouz Hotels & Resorts<br>
              Finance Department
            </p>
          </div>
        </div>
      </div>
    `;

    const text = `
Payment Reminder

Dear ${travelAgent.contactPerson},

This is a friendly reminder that you have an outstanding balance with The Pentouz Hotels.

Outstanding Balance: $${outstandingAmount.toFixed(2)}
Due Date: ${new Date(dueDate).toLocaleDateString()}

${overdueBookings && overdueBookings.length > 0 ? `
Overdue Bookings:
${overdueBookings.map(booking => `- ${booking.bookingNumber}: $${booking.amount?.toFixed(2) || '0.00'} (Due: ${new Date(booking.dueDate).toLocaleDateString()})`).join('\n')}
` : ''}

Payment Options:
- Bank transfer to our account
- Online payment through your agent portal
- Contact our finance team for payment arrangements

Make Payment: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/travel-agent/payments

If you have already made this payment, please disregard this reminder.
For payment assistance, contact finance@pentouz.com or +91 8884449930.

Best regards,
The Pentouz Hotels & Resorts - Finance Department
    `;

    return { subject, html, text };
  }
}

export default new EmailNotificationService();