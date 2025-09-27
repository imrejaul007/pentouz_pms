import XLSX from 'xlsx';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import TravelAgentBooking from '../models/TravelAgentBooking.js';
import TravelAgent from '../models/TravelAgent.js';
import Booking from '../models/Booking.js';
import Hotel from '../models/Hotel.js';
import logger from '../utils/logger.js';
import { ApplicationError } from '../middleware/errorHandler.js';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const access = promisify(fs.access);

class ExportService {
  constructor() {
    this.ensureExportDirectory();
  }

  async ensureExportDirectory() {
    const exportDir = path.join(process.cwd(), 'exports');
    try {
      await access(exportDir);
    } catch (error) {
      await mkdir(exportDir, { recursive: true });
    }
  }

  /**
   * Export bookings data to Excel format
   * @param {Object} filters - Filter criteria for bookings
   * @param {string} travelAgentId - Travel agent ID (optional)
   * @returns {Object} Export result with file path
   */
  async exportBookingsToExcel(filters = {}, travelAgentId = null) {
    try {
      const query = { isActive: true };

      if (travelAgentId) {
        query.travelAgentId = travelAgentId;
      }

      if (filters.startDate && filters.endDate) {
        query.createdAt = {
          $gte: new Date(filters.startDate),
          $lte: new Date(filters.endDate)
        };
      }

      if (filters.status) {
        query.bookingStatus = filters.status;
      }

      if (filters.hotelId) {
        query.hotelId = filters.hotelId;
      }

      const bookings = await TravelAgentBooking.find(query)
        .populate('bookingId', 'bookingNumber checkIn checkOut totalAmount status')
        .populate('travelAgentId', 'companyName agentCode contactPerson')
        .populate('hotelId', 'name')
        .sort({ createdAt: -1 });

      // Prepare data for Excel
      const excelData = bookings.map(booking => ({
        'Booking Number': booking.bookingId?.bookingNumber || 'N/A',
        'Agent Code': booking.travelAgentId?.agentCode || 'N/A',
        'Company Name': booking.travelAgentId?.companyName || 'N/A',
        'Contact Person': booking.travelAgentId?.contactPerson || 'N/A',
        'Hotel': booking.hotelId?.name || 'N/A',
        'Check-in': booking.bookingId?.checkIn ? new Date(booking.bookingId.checkIn).toLocaleDateString() : 'N/A',
        'Check-out': booking.bookingId?.checkOut ? new Date(booking.bookingId.checkOut).toLocaleDateString() : 'N/A',
        'Room Revenue': booking.roomRevenue?.toFixed(2) || '0.00',
        'Commission Rate (%)': booking.commissionRate?.toFixed(2) || '0.00',
        'Commission Amount': booking.commissionAmount?.toFixed(2) || '0.00',
        'Total Amount': booking.bookingId?.totalAmount?.toFixed(2) || '0.00',
        'Status': booking.bookingStatus || 'N/A',
        'Created Date': new Date(booking.createdAt).toLocaleDateString(),
        'Payment Status': booking.paymentStatus || 'pending'
      }));

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Bookings');

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `bookings_export_${timestamp}.xlsx`;
      const filepath = path.join(process.cwd(), 'exports', filename);

      // Write file
      XLSX.writeFile(workbook, filepath);

      logger.info(`Bookings exported to Excel: ${filename}`);

      return {
        success: true,
        filename,
        filepath,
        recordCount: excelData.length,
        fileSize: fs.statSync(filepath).size
      };

    } catch (error) {
      logger.error('Error exporting bookings to Excel:', error);
      throw new ApplicationError('Failed to export bookings to Excel', 500);
    }
  }

  /**
   * Export bookings data to CSV format
   * @param {Object} filters - Filter criteria for bookings
   * @param {string} travelAgentId - Travel agent ID (optional)
   * @returns {Object} Export result with file path
   */
  async exportBookingsToCSV(filters = {}, travelAgentId = null) {
    try {
      const query = { isActive: true };

      if (travelAgentId) {
        query.travelAgentId = travelAgentId;
      }

      if (filters.startDate && filters.endDate) {
        query.createdAt = {
          $gte: new Date(filters.startDate),
          $lte: new Date(filters.endDate)
        };
      }

      if (filters.status) {
        query.bookingStatus = filters.status;
      }

      if (filters.hotelId) {
        query.hotelId = filters.hotelId;
      }

      const bookings = await TravelAgentBooking.find(query)
        .populate('bookingId', 'bookingNumber checkIn checkOut totalAmount status')
        .populate('travelAgentId', 'companyName agentCode contactPerson')
        .populate('hotelId', 'name')
        .sort({ createdAt: -1 });

      // Prepare CSV header
      const headers = [
        'Booking Number',
        'Agent Code',
        'Company Name',
        'Contact Person',
        'Hotel',
        'Check-in',
        'Check-out',
        'Room Revenue',
        'Commission Rate (%)',
        'Commission Amount',
        'Total Amount',
        'Status',
        'Created Date',
        'Payment Status'
      ];

      // Prepare CSV data
      const csvRows = [headers.join(',')];

      bookings.forEach(booking => {
        const row = [
          booking.bookingId?.bookingNumber || 'N/A',
          booking.travelAgentId?.agentCode || 'N/A',
          `"${booking.travelAgentId?.companyName || 'N/A'}"`,
          `"${booking.travelAgentId?.contactPerson || 'N/A'}"`,
          `"${booking.hotelId?.name || 'N/A'}"`,
          booking.bookingId?.checkIn ? new Date(booking.bookingId.checkIn).toLocaleDateString() : 'N/A',
          booking.bookingId?.checkOut ? new Date(booking.bookingId.checkOut).toLocaleDateString() : 'N/A',
          booking.roomRevenue?.toFixed(2) || '0.00',
          booking.commissionRate?.toFixed(2) || '0.00',
          booking.commissionAmount?.toFixed(2) || '0.00',
          booking.bookingId?.totalAmount?.toFixed(2) || '0.00',
          booking.bookingStatus || 'N/A',
          new Date(booking.createdAt).toLocaleDateString(),
          booking.paymentStatus || 'pending'
        ];
        csvRows.push(row.join(','));
      });

      const csvContent = csvRows.join('\n');

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `bookings_export_${timestamp}.csv`;
      const filepath = path.join(process.cwd(), 'exports', filename);

      // Write file
      await writeFile(filepath, csvContent, 'utf8');

      logger.info(`Bookings exported to CSV: ${filename}`);

      return {
        success: true,
        filename,
        filepath,
        recordCount: bookings.length,
        fileSize: fs.statSync(filepath).size
      };

    } catch (error) {
      logger.error('Error exporting bookings to CSV:', error);
      throw new ApplicationError('Failed to export bookings to CSV', 500);
    }
  }

  /**
   * Generate commission report for travel agents
   * @param {Object} filters - Filter criteria
   * @returns {Object} Commission report data and file path
   */
  async generateCommissionReport(filters = {}) {
    try {
      const { startDate, endDate, travelAgentId, status = 'confirmed' } = filters;

      const matchCriteria = {
        isActive: true,
        bookingStatus: status
      };

      if (travelAgentId) {
        matchCriteria.travelAgentId = travelAgentId;
      }

      if (startDate && endDate) {
        matchCriteria.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      // Aggregate commission data by travel agent
      const commissionData = await TravelAgentBooking.aggregate([
        { $match: matchCriteria },
        {
          $lookup: {
            from: 'travelagents',
            localField: 'travelAgentId',
            foreignField: '_id',
            as: 'agent'
          }
        },
        {
          $lookup: {
            from: 'hotels',
            localField: 'hotelId',
            foreignField: '_id',
            as: 'hotel'
          }
        },
        { $unwind: '$agent' },
        { $unwind: '$hotel' },
        {
          $group: {
            _id: '$travelAgentId',
            agentCode: { $first: '$agent.agentCode' },
            companyName: { $first: '$agent.companyName' },
            contactPerson: { $first: '$agent.contactPerson' },
            email: { $first: '$agent.email' },
            phone: { $first: '$agent.phone' },
            totalBookings: { $sum: 1 },
            totalRoomRevenue: { $sum: '$roomRevenue' },
            totalCommissionAmount: { $sum: '$commissionAmount' },
            averageCommissionRate: { $avg: '$commissionRate' },
            bookings: {
              $push: {
                bookingId: '$bookingId',
                roomRevenue: '$roomRevenue',
                commissionAmount: '$commissionAmount',
                commissionRate: '$commissionRate',
                hotelName: '$hotel.name',
                createdAt: '$createdAt'
              }
            }
          }
        },
        { $sort: { totalCommissionAmount: -1 } }
      ]);

      // Create detailed Excel report
      const workbook = XLSX.utils.book_new();

      // Summary sheet
      const summaryData = commissionData.map(agent => ({
        'Agent Code': agent.agentCode,
        'Company Name': agent.companyName,
        'Contact Person': agent.contactPerson,
        'Email': agent.email,
        'Phone': agent.phone,
        'Total Bookings': agent.totalBookings,
        'Total Room Revenue': agent.totalRoomRevenue?.toFixed(2) || '0.00',
        'Total Commission': agent.totalCommissionAmount?.toFixed(2) || '0.00',
        'Average Commission Rate (%)': agent.averageCommissionRate?.toFixed(2) || '0.00'
      }));

      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Commission Summary');

      // Detailed sheet with all bookings
      const detailData = [];
      commissionData.forEach(agent => {
        agent.bookings.forEach(booking => {
          detailData.push({
            'Agent Code': agent.agentCode,
            'Company Name': agent.companyName,
            'Hotel': booking.hotelName,
            'Booking Date': new Date(booking.createdAt).toLocaleDateString(),
            'Room Revenue': booking.roomRevenue?.toFixed(2) || '0.00',
            'Commission Rate (%)': booking.commissionRate?.toFixed(2) || '0.00',
            'Commission Amount': booking.commissionAmount?.toFixed(2) || '0.00'
          });
        });
      });

      const detailSheet = XLSX.utils.json_to_sheet(detailData);
      XLSX.utils.book_append_sheet(workbook, detailSheet, 'Booking Details');

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `commission_report_${timestamp}.xlsx`;
      const filepath = path.join(process.cwd(), 'exports', filename);

      // Write file
      XLSX.writeFile(workbook, filepath);

      logger.info(`Commission report generated: ${filename}`);

      return {
        success: true,
        filename,
        filepath,
        data: commissionData,
        summary: {
          totalAgents: commissionData.length,
          totalBookings: commissionData.reduce((sum, agent) => sum + agent.totalBookings, 0),
          totalRevenue: commissionData.reduce((sum, agent) => sum + (agent.totalRoomRevenue || 0), 0),
          totalCommissions: commissionData.reduce((sum, agent) => sum + (agent.totalCommissionAmount || 0), 0)
        },
        fileSize: fs.statSync(filepath).size
      };

    } catch (error) {
      logger.error('Error generating commission report:', error);
      throw new ApplicationError('Failed to generate commission report', 500);
    }
  }

  /**
   * Create PDF invoice for a travel agent booking
   * @param {string} bookingId - Travel agent booking ID
   * @returns {Object} PDF creation result
   */
  async createPDFInvoice(bookingId) {
    try {
      // For now, we'll create a simple HTML-based invoice that can be converted to PDF
      // In a production environment, you might want to use libraries like puppeteer or jsPDF

      const booking = await TravelAgentBooking.findById(bookingId)
        .populate('bookingId', 'bookingNumber checkIn checkOut totalAmount guestDetails')
        .populate('travelAgentId', 'companyName agentCode contactPerson email phone address')
        .populate('hotelId', 'name address phone email');

      if (!booking) {
        throw new ApplicationError('Booking not found', 404);
      }

      const invoiceData = {
        invoiceNumber: `INV-${booking.bookingId?.bookingNumber || 'Unknown'}`,
        invoiceDate: new Date().toLocaleDateString(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(), // 30 days from now
        booking: booking,
        items: [
          {
            description: `Commission for Booking ${booking.bookingId?.bookingNumber}`,
            quantity: 1,
            rate: booking.commissionAmount,
            amount: booking.commissionAmount
          }
        ],
        subtotal: booking.commissionAmount,
        tax: 0, // Assuming no tax for now
        total: booking.commissionAmount
      };

      // Generate HTML invoice template
      const htmlTemplate = this.generateInvoiceHTML(invoiceData);

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `invoice_${booking.bookingId?.bookingNumber}_${timestamp}.html`;
      const filepath = path.join(process.cwd(), 'exports', filename);

      // Write HTML file (can be converted to PDF later)
      await writeFile(filepath, htmlTemplate, 'utf8');

      logger.info(`PDF invoice generated: ${filename}`);

      return {
        success: true,
        filename,
        filepath,
        invoiceData,
        fileSize: fs.statSync(filepath).size
      };

    } catch (error) {
      logger.error('Error creating PDF invoice:', error);
      throw new ApplicationError('Failed to create PDF invoice', 500);
    }
  }

  /**
   * Generate HTML template for invoice
   * @param {Object} data - Invoice data
   * @returns {string} HTML template
   */
  generateInvoiceHTML(data) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Invoice ${data.invoiceNumber}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .header { text-align: center; margin-bottom: 40px; }
            .hotel-info, .agent-info { width: 45%; display: inline-block; vertical-align: top; }
            .invoice-details { margin: 40px 0; }
            .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .items-table th, .items-table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            .items-table th { background-color: #f2f2f2; }
            .total-section { text-align: right; margin-top: 20px; }
            .total-row { margin: 5px 0; }
            .total-amount { font-weight: bold; font-size: 18px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>COMMISSION INVOICE</h1>
            <h2>${data.invoiceNumber}</h2>
        </div>

        <div class="invoice-info">
            <div class="hotel-info">
                <h3>From:</h3>
                <strong>${data.booking.hotelId?.name || 'Hotel Name'}</strong><br>
                ${data.booking.hotelId?.address || 'Hotel Address'}<br>
                Phone: ${data.booking.hotelId?.phone || 'N/A'}<br>
                Email: ${data.booking.hotelId?.email || 'N/A'}
            </div>

            <div class="agent-info">
                <h3>To:</h3>
                <strong>${data.booking.travelAgentId?.companyName || 'Travel Agent'}</strong><br>
                Agent Code: ${data.booking.travelAgentId?.agentCode || 'N/A'}<br>
                Contact: ${data.booking.travelAgentId?.contactPerson || 'N/A'}<br>
                Email: ${data.booking.travelAgentId?.email || 'N/A'}<br>
                Phone: ${data.booking.travelAgentId?.phone || 'N/A'}
            </div>
        </div>

        <div class="invoice-details">
            <table style="width: 100%;">
                <tr>
                    <td><strong>Invoice Date:</strong> ${data.invoiceDate}</td>
                    <td><strong>Due Date:</strong> ${data.dueDate}</td>
                </tr>
                <tr>
                    <td><strong>Booking Number:</strong> ${data.booking.bookingId?.bookingNumber || 'N/A'}</td>
                    <td><strong>Commission Rate:</strong> ${data.booking.commissionRate?.toFixed(2) || '0.00'}%</td>
                </tr>
            </table>
        </div>

        <table class="items-table">
            <thead>
                <tr>
                    <th>Description</th>
                    <th>Quantity</th>
                    <th>Rate</th>
                    <th>Amount</th>
                </tr>
            </thead>
            <tbody>
                ${data.items.map(item => `
                    <tr>
                        <td>${item.description}</td>
                        <td>${item.quantity}</td>
                        <td>$${item.rate?.toFixed(2) || '0.00'}</td>
                        <td>$${item.amount?.toFixed(2) || '0.00'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="total-section">
            <div class="total-row">Subtotal: $${data.subtotal?.toFixed(2) || '0.00'}</div>
            <div class="total-row">Tax: $${data.tax?.toFixed(2) || '0.00'}</div>
            <div class="total-row total-amount">Total: $${data.total?.toFixed(2) || '0.00'}</div>
        </div>

        <div style="margin-top: 40px; font-size: 12px; color: #666;">
            <p>This invoice is for commission payment due to travel agent for booking services.</p>
            <p>Payment terms: Net 30 days from invoice date.</p>
            <p>Generated on: ${new Date().toLocaleString()}</p>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Create batch export with multiple files compressed
   * @param {Object} exportOptions - Export configuration
   * @returns {Object} Batch export result
   */
  async createBatchExport(exportOptions) {
    try {
      const { formats, filters, includeInvoices = false } = exportOptions;
      const exports = [];
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const batchDir = path.join(process.cwd(), 'exports', `batch_${timestamp}`);

      // Create batch directory
      await mkdir(batchDir, { recursive: true });

      // Export in different formats
      if (formats.includes('excel')) {
        const excelResult = await this.exportBookingsToExcel(filters);
        const newPath = path.join(batchDir, excelResult.filename);
        fs.renameSync(excelResult.filepath, newPath);
        exports.push({ type: 'excel', filename: excelResult.filename, recordCount: excelResult.recordCount });
      }

      if (formats.includes('csv')) {
        const csvResult = await this.exportBookingsToCSV(filters);
        const newPath = path.join(batchDir, csvResult.filename);
        fs.renameSync(csvResult.filepath, newPath);
        exports.push({ type: 'csv', filename: csvResult.filename, recordCount: csvResult.recordCount });
      }

      if (formats.includes('commission')) {
        const commissionResult = await this.generateCommissionReport(filters);
        const newPath = path.join(batchDir, commissionResult.filename);
        fs.renameSync(commissionResult.filepath, newPath);
        exports.push({ type: 'commission', filename: commissionResult.filename, agentCount: commissionResult.data.length });
      }

      // Generate invoices if requested
      if (includeInvoices) {
        const bookings = await TravelAgentBooking.find({
          ...filters,
          isActive: true
        }).limit(50); // Limit to prevent too many files

        for (const booking of bookings) {
          try {
            const invoiceResult = await this.createPDFInvoice(booking._id);
            const newPath = path.join(batchDir, invoiceResult.filename);
            fs.renameSync(invoiceResult.filepath, newPath);
            exports.push({ type: 'invoice', filename: invoiceResult.filename });
          } catch (error) {
            logger.warn(`Failed to create invoice for booking ${booking._id}:`, error.message);
          }
        }
      }

      // Create ZIP archive
      const zipFilename = `batch_export_${timestamp}.zip`;
      const zipPath = path.join(process.cwd(), 'exports', zipFilename);

      await this.createZipArchive(batchDir, zipPath);

      // Clean up batch directory
      fs.rmSync(batchDir, { recursive: true });

      logger.info(`Batch export created: ${zipFilename}`);

      return {
        success: true,
        filename: zipFilename,
        filepath: zipPath,
        exports: exports,
        totalFiles: exports.length,
        fileSize: fs.statSync(zipPath).size
      };

    } catch (error) {
      logger.error('Error creating batch export:', error);
      throw new ApplicationError('Failed to create batch export', 500);
    }
  }

  /**
   * Create ZIP archive from directory
   * @param {string} sourceDir - Source directory path
   * @param {string} outputPath - Output ZIP file path
   * @returns {Promise} Compression promise
   */
  async createZipArchive(sourceDir, outputPath) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        logger.info(`Archive created: ${archive.pointer()} bytes`);
        resolve();
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  }

  /**
   * Clean up old export files
   * @param {number} daysOld - Days to keep files (default: 7)
   */
  async cleanupOldExports(daysOld = 7) {
    try {
      const exportDir = path.join(process.cwd(), 'exports');
      const files = fs.readdirSync(exportDir);
      const cutoffDate = Date.now() - (daysOld * 24 * 60 * 60 * 1000);

      let deletedCount = 0;

      files.forEach(file => {
        const filePath = path.join(exportDir, file);
        const stats = fs.statSync(filePath);

        if (stats.mtime.getTime() < cutoffDate) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      });

      logger.info(`Cleaned up ${deletedCount} old export files`);

      return { success: true, deletedCount };
    } catch (error) {
      logger.error('Error cleaning up old exports:', error);
      throw new ApplicationError('Failed to cleanup old exports', 500);
    }
  }
}

export default new ExportService();