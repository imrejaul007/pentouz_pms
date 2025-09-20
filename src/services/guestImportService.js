import User from '../models/User.js';
import Salutation from '../models/Salutation.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import csv from 'csv-parser';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

class GuestImportService {
  /**
   * Process CSV file for guest import
   */
  async processCSVFile(filePath, options = {}) {
    const {
      skipHeader = true,
      delimiter = ',',
      encoding = 'utf8'
    } = options;

    return new Promise((resolve, reject) => {
      const results = [];
      const errors = [];
      let lineNumber = skipHeader ? 1 : 0;

      fs.createReadStream(filePath, { encoding })
        .pipe(csv({ 
          separator: delimiter,
          skipEmptyLines: true,
          skipLinesWithError: false
        }))
        .on('data', (data) => {
          lineNumber++;
          try {
            const processedRow = this.processGuestRow(data, lineNumber);
            if (processedRow.errors.length > 0) {
              errors.push(...processedRow.errors);
            } else {
              results.push(processedRow.data);
            }
          } catch (error) {
            errors.push({
              line: lineNumber,
              error: error.message,
              data: data
            });
          }
        })
        .on('end', () => {
          resolve({ results, errors, totalRows: lineNumber });
        })
        .on('error', (error) => {
          reject(new ApplicationError(`CSV processing error: ${error.message}`, 400));
        });
    });
  }

  /**
   * Process Excel file for guest import
   */
  async processExcelFile(filePath, options = {}) {
    const {
      sheetName = 0,
      skipHeader = true
    } = options;

    try {
      const workbook = XLSX.readFile(filePath);
      const sheet = workbook.Sheets[workbook.SheetNames[sheetName]];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { 
        header: 1,
        defval: '',
        blankrows: false
      });

      if (jsonData.length === 0) {
        throw new ApplicationError('Excel file is empty', 400);
      }

      const results = [];
      const errors = [];
      let startRow = skipHeader ? 1 : 0;

      // Get headers from first row
      const headers = jsonData[0];
      const headerMap = this.createHeaderMap(headers);

      for (let i = startRow; i < jsonData.length; i++) {
        const row = jsonData[i];
        const lineNumber = i + 1;

        try {
          // Convert array row to object using headers
          const rowData = {};
          headers.forEach((header, index) => {
            if (header && row[index] !== undefined) {
              rowData[header] = row[index];
            }
          });

          const processedRow = this.processGuestRow(rowData, lineNumber, headerMap);
          if (processedRow.errors.length > 0) {
            errors.push(...processedRow.errors);
          } else {
            results.push(processedRow.data);
          }
        } catch (error) {
          errors.push({
            line: lineNumber,
            error: error.message,
            data: row
          });
        }
      }

      return { results, errors, totalRows: jsonData.length };
    } catch (error) {
      throw new ApplicationError(`Excel processing error: ${error.message}`, 400);
    }
  }

  /**
   * Process a single guest row
   */
  async processGuestRow(rowData, lineNumber, headerMap = null) {
    const errors = [];
    const data = {};

    // Map headers if provided
    if (headerMap) {
      const mappedData = {};
      Object.keys(rowData).forEach(key => {
        const mappedKey = headerMap[key.toLowerCase()] || key;
        mappedData[mappedKey] = rowData[key];
      });
      Object.assign(rowData, mappedData);
    }

    // Required fields validation
    if (!rowData.name && !rowData.fullname && !rowData.guestname) {
      errors.push({
        line: lineNumber,
        field: 'name',
        error: 'Name is required',
        value: rowData.name || rowData.fullname || rowData.guestname
      });
    }

    if (!rowData.email && !rowData.emailaddress) {
      errors.push({
        line: lineNumber,
        field: 'email',
        error: 'Email is required',
        value: rowData.email || rowData.emailaddress
      });
    }

    // Process and validate data
    data.name = this.cleanString(rowData.name || rowData.fullname || rowData.guestname);
    data.email = this.cleanString(rowData.email || rowData.emailaddress).toLowerCase();
    data.phone = this.cleanString(rowData.phone || rowData.phoneno || rowData.contact);
    data.guestType = this.cleanString(rowData.guesttype || rowData.type || 'normal');
    data.role = 'guest';

    // Validate email format
    if (data.email && !this.isValidEmail(data.email)) {
      errors.push({
        line: lineNumber,
        field: 'email',
        error: 'Invalid email format',
        value: data.email
      });
    }

    // Validate phone format
    if (data.phone && !this.isValidPhone(data.phone)) {
      errors.push({
        line: lineNumber,
        field: 'phone',
        error: 'Invalid phone format',
        value: data.phone
      });
    }

    // Process salutation
    if (rowData.salutation || rowData.title || rowData.prefix) {
      const salutationTitle = this.cleanString(rowData.salutation || rowData.title || rowData.prefix);
      const salutation = await this.findSalutation(salutationTitle);
      if (salutation) {
        data.salutationId = salutation._id;
      } else {
        errors.push({
          line: lineNumber,
          field: 'salutation',
          error: 'Salutation not found in system',
          value: salutationTitle
        });
      }
    }

    // Process loyalty information
    data.loyalty = {
      tier: this.cleanString(rowData.loyaltytier || rowData.tier || 'bronze'),
      points: this.parseNumber(rowData.loyaltypoints || rowData.points || 0)
    };

    // Validate loyalty tier
    const validTiers = ['bronze', 'silver', 'gold', 'platinum'];
    if (!validTiers.includes(data.loyalty.tier)) {
      data.loyalty.tier = 'bronze';
      errors.push({
        line: lineNumber,
        field: 'loyaltyTier',
        error: 'Invalid loyalty tier, defaulting to bronze',
        value: rowData.loyaltytier || rowData.tier
      });
    }

    // Process preferences
    data.preferences = {
      bedType: this.cleanString(rowData.bedtype || rowData.bed || ''),
      floor: this.cleanString(rowData.floor || rowData.preferredfloor || ''),
      smokingAllowed: this.parseBoolean(rowData.smoking || rowData.smokingallowed || false),
      other: this.cleanString(rowData.other || rowData.notes || rowData.preferences || '')
    };

    // Validate bed type
    const validBedTypes = ['', 'single', 'double', 'queen', 'king'];
    if (!validBedTypes.includes(data.preferences.bedType)) {
      data.preferences.bedType = '';
      errors.push({
        line: lineNumber,
        field: 'bedType',
        error: 'Invalid bed type, clearing preference',
        value: rowData.bedtype || rowData.bed
      });
    }

    return { data, errors };
  }

  /**
   * Create header mapping for flexible column names
   */
  createHeaderMap(headers) {
    const mapping = {};
    
    headers.forEach(header => {
      if (!header) return;
      
      const lowerHeader = header.toLowerCase().trim();
      
      // Name mappings
      if (['name', 'fullname', 'full name', 'guestname', 'guest name'].includes(lowerHeader)) {
        mapping[header] = 'name';
      }
      // Email mappings
      else if (['email', 'emailaddress', 'email address', 'e-mail'].includes(lowerHeader)) {
        mapping[header] = 'email';
      }
      // Phone mappings
      else if (['phone', 'phoneno', 'phone no', 'contact', 'mobile', 'telephone'].includes(lowerHeader)) {
        mapping[header] = 'phone';
      }
      // Salutation mappings
      else if (['salutation', 'title', 'prefix', 'mr/mrs'].includes(lowerHeader)) {
        mapping[header] = 'salutation';
      }
      // Guest type mappings
      else if (['guesttype', 'guest type', 'type', 'category'].includes(lowerHeader)) {
        mapping[header] = 'guestType';
      }
      // Loyalty mappings
      else if (['loyaltytier', 'loyalty tier', 'tier', 'level'].includes(lowerHeader)) {
        mapping[header] = 'loyaltyTier';
      }
      else if (['loyaltypoints', 'loyalty points', 'points'].includes(lowerHeader)) {
        mapping[header] = 'loyaltyPoints';
      }
      // Preference mappings
      else if (['bedtype', 'bed type', 'bed'].includes(lowerHeader)) {
        mapping[header] = 'bedType';
      }
      else if (['floor', 'preferredfloor', 'preferred floor'].includes(lowerHeader)) {
        mapping[header] = 'floor';
      }
      else if (['smoking', 'smokingallowed', 'smoking allowed'].includes(lowerHeader)) {
        mapping[header] = 'smoking';
      }
      else if (['other', 'notes', 'preferences', 'comments'].includes(lowerHeader)) {
        mapping[header] = 'other';
      }
    });

    return mapping;
  }

  /**
   * Validate and import guests
   */
  async validateAndImportGuests(guestData, hotelId, createdBy) {
    const results = {
      imported: 0,
      skipped: 0,
      errors: []
    };

    for (const guest of guestData) {
      try {
        // Check for existing guest by email
        const existingGuest = await User.findOne({
          email: guest.email,
          hotelId: hotelId
        });

        if (existingGuest) {
          results.skipped++;
          results.errors.push({
            email: guest.email,
            error: 'Guest already exists with this email'
          });
          continue;
        }

        // Create new guest
        const newGuest = await User.create({
          ...guest,
          hotelId,
          createdBy
        });

        results.imported++;
      } catch (error) {
        results.errors.push({
          email: guest.email,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Find salutation by title
   */
  async findSalutation(title) {
    if (!title) return null;
    
    const cleanTitle = title.trim().toLowerCase();
    return await Salutation.findOne({
      $or: [
        { title: { $regex: `^${cleanTitle}$`, $options: 'i' } },
        { fullForm: { $regex: `^${cleanTitle}$`, $options: 'i' } }
      ],
      isActive: true
    });
  }

  /**
   * Clean string data
   */
  cleanString(value) {
    if (!value) return '';
    return String(value).trim();
  }

  /**
   * Parse number from string
   */
  parseNumber(value) {
    if (!value) return 0;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Parse boolean from string
   */
  parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (!value) return false;
    
    const stringValue = String(value).toLowerCase().trim();
    return ['true', '1', 'yes', 'y', 'on'].includes(stringValue);
  }

  /**
   * Validate email format
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone format
   */
  isValidPhone(phone) {
    const phoneRegex = /^[\+]?[\d\s\-\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 7;
  }

  /**
   * Generate import template
   */
  generateImportTemplate() {
    const template = [
      {
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        salutation: 'Mr',
        guestType: 'normal',
        loyaltyTier: 'bronze',
        loyaltyPoints: 0,
        bedType: 'king',
        floor: '5-10',
        smoking: 'false',
        other: 'Vegetarian meals preferred'
      },
      {
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        phone: '+1987654321',
        salutation: 'Mrs',
        guestType: 'corporate',
        loyaltyTier: 'silver',
        loyaltyPoints: 500,
        bedType: 'queen',
        floor: 'high',
        smoking: 'false',
        other: 'Late checkout preferred'
      }
    ];

    return template;
  }

  /**
   * Get import statistics
   */
  async getImportStatistics(hotelId) {
    const stats = await User.aggregate([
      { $match: { role: 'guest', hotelId: new mongoose.Types.ObjectId(hotelId) } },
      {
        $group: {
          _id: null,
          totalGuests: { $sum: 1 },
          byMonth: {
            $push: {
              month: { $month: '$createdAt' },
              year: { $year: '$createdAt' }
            }
          },
          byGuestType: {
            $push: '$guestType'
          },
          byLoyaltyTier: {
            $push: '$loyalty.tier'
          }
        }
      }
    ]);

    if (stats.length === 0) {
      return {
        totalGuests: 0,
        monthlyImports: {},
        guestTypeDistribution: {},
        loyaltyTierDistribution: {}
      };
    }

    const result = stats[0];

    // Calculate monthly imports
    const monthlyImports = {};
    result.byMonth.forEach(item => {
      const key = `${item.year}-${item.month}`;
      monthlyImports[key] = (monthlyImports[key] || 0) + 1;
    });

    // Calculate guest type distribution
    const guestTypeDistribution = {};
    result.byGuestType.forEach(type => {
      guestTypeDistribution[type] = (guestTypeDistribution[type] || 0) + 1;
    });

    // Calculate loyalty tier distribution
    const loyaltyTierDistribution = {};
    result.byLoyaltyTier.forEach(tier => {
      loyaltyTierDistribution[tier] = (loyaltyTierDistribution[tier] || 0) + 1;
    });

    return {
      totalGuests: result.totalGuests,
      monthlyImports,
      guestTypeDistribution,
      loyaltyTierDistribution
    };
  }
}

export default new GuestImportService();
