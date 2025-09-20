import OTAPayload from '../models/OTAPayload.js';
import AuditLog from '../models/AuditLog.js';
import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

class OTAPayloadService {
  constructor() {
    this.correlationMap = new Map(); // Track request/response pairs
    this.processingQueue = [];
  }

  /**
   * Store inbound OTA payload (webhook, API call received)
   */
  async storeInboundPayload(req, payloadData, metadata = {}) {
    try {
      // Generate correlation ID if not provided
      const correlationId = metadata.correlationId || this.generateCorrelationId();
      
      // Extract business context from payload
      const businessContext = this.extractBusinessContext(payloadData, metadata);
      
      // Parse key fields for indexing
      const parsedPayload = this.parsePayloadFields(payloadData);
      
      // Classify data sensitivity
      const classification = this.classifyPayload(payloadData);
      
      // Store the payload
      const payload = await OTAPayload.storeInboundPayload({
        channel: metadata.channel || this.detectChannel(req),
        channelId: metadata.channelId,
        url: req.originalUrl || req.url,
        method: req.method,
        path: req.path,
        query: req.query,
        headers: this.sanitizeHeaders(req.headers),
        payload: payloadData,
        parsedPayload,
        correlationId,
        traceId: metadata.traceId || req.headers['x-trace-id'],
        bookingId: parsedPayload.bookingId || metadata.bookingId,
        amendmentId: metadata.amendmentId,
        businessContext,
        authenticated: !!req.user,
        signature: req.headers['x-signature'] || req.headers['signature'],
        signatureValid: metadata.signatureValid,
        ipAddress: this.getClientIP(req),
        userAgent: req.headers['user-agent'],
        classification
      });

      // Create audit log entry
      await this.createAuditLogEntry(payload, 'inbound_payload_stored');

      // Store correlation mapping for response matching
      this.correlationMap.set(correlationId, {
        payloadId: payload.payloadId,
        timestamp: new Date(),
        channel: payload.channel
      });

      logger.info(`Inbound OTA payload stored`, {
        payloadId: payload.payloadId,
        channel: payload.channel,
        correlationId,
        size: payload.metrics.payloadSize
      });

      return payload;

    } catch (error) {
      logger.error('Failed to store inbound OTA payload:', error);
      throw error;
    }
  }

  /**
   * Store outbound OTA payload (API calls we make to OTAs)
   */
  async storeOutboundPayload(requestData, responseData, metadata = {}) {
    try {
      const correlationId = metadata.correlationId || this.generateCorrelationId();
      
      // Extract business context
      const businessContext = this.extractBusinessContext(requestData.payload, metadata);
      
      // Parse key fields
      const parsedPayload = this.parsePayloadFields(requestData.payload);
      
      // Store the payload
      const payload = await OTAPayload.storeOutboundPayload({
        channel: metadata.channel,
        channelId: metadata.channelId,
        url: requestData.url,
        method: requestData.method,
        path: new URL(requestData.url).pathname,
        query: new URL(requestData.url).searchParams,
        requestHeaders: this.sanitizeHeaders(requestData.headers),
        requestPayload: requestData.payload,
        responseStatus: responseData.status,
        responseHeaders: this.sanitizeHeaders(responseData.headers),
        responseBody: responseData.data,
        responseTime: metadata.responseTime,
        parsedPayload,
        correlationId,
        traceId: metadata.traceId,
        bookingId: parsedPayload.bookingId || metadata.bookingId,
        businessContext,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent
      });

      // Link to inbound payload if correlation exists
      const inboundPayload = this.correlationMap.get(correlationId);
      if (inboundPayload) {
        payload.parentPayloadId = inboundPayload.payloadId;
        await payload.save();
      }

      // Create audit log entry
      await this.createAuditLogEntry(payload, 'outbound_payload_stored');

      logger.info(`Outbound OTA payload stored`, {
        payloadId: payload.payloadId,
        channel: payload.channel,
        correlationId,
        responseStatus: responseData.status
      });

      return payload;

    } catch (error) {
      logger.error('Failed to store outbound OTA payload:', error);
      throw error;
    }
  }

  /**
   * Extract business context from payload
   */
  extractBusinessContext(payloadData, metadata) {
    const context = {
      operation: metadata.operation || 'unknown',
      priority: metadata.priority || 'medium',
      source: {
        system: 'hotel-management-system',
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      }
    };

    // Try to detect operation from payload structure
    if (payloadData) {
      if (payloadData.reservation_id || payloadData.booking_id) {
        if (payloadData.status === 'cancelled') {
          context.operation = 'booking_cancel';
        } else if (payloadData.modification_id || payloadData.amendment_id) {
          context.operation = 'amendment_request';
        } else {
          context.operation = 'booking_update';
        }
      } else if (payloadData.availability || payloadData.inventory) {
        context.operation = 'inventory_sync';
      } else if (payloadData.rates || payloadData.pricing) {
        context.operation = 'rate_update';
      }
    }

    return context;
  }

  /**
   * Parse key fields from payload for indexing
   */
  parsePayloadFields(payloadData) {
    const parsed = {};

    if (!payloadData) return parsed;

    // Common field mappings across different OTA formats
    const fieldMappings = {
      // Booking identifiers
      bookingId: ['booking_id', 'reservation_id', 'reservationId', 'id'],
      reservationId: ['reservation_id', 'reservationId', 'external_id'],
      hotelId: ['hotel_id', 'hotelId', 'property_id', 'propertyId'],
      
      // Room and guest info
      roomType: ['room_type', 'roomType', 'room_category'],
      guestName: ['guest_name', 'guestName', 'customer_name', 'customerName'],
      
      // Dates and pricing
      checkIn: ['check_in', 'checkIn', 'arrival_date', 'arrivalDate', 'start_date'],
      checkOut: ['check_out', 'checkOut', 'departure_date', 'departureDate', 'end_date'],
      totalAmount: ['total_amount', 'totalAmount', 'total_price', 'totalPrice', 'amount'],
      currency: ['currency', 'currency_code', 'currencyCode'],
      
      // Status and events
      status: ['status', 'booking_status', 'reservation_status'],
      eventType: ['event_type', 'eventType', 'event', 'action'],
      operation: ['operation', 'action', 'type']
    };

    // Extract fields using mappings
    Object.entries(fieldMappings).forEach(([targetField, sourceFields]) => {
      for (const sourceField of sourceFields) {
        const value = this.getNestedValue(payloadData, sourceField);
        if (value !== undefined && value !== null) {
          // Convert dates
          if (['checkIn', 'checkOut'].includes(targetField)) {
            try {
              parsed[targetField] = new Date(value);
            } catch (e) {
              // Skip invalid dates
            }
          } 
          // Convert numbers
          else if (targetField === 'totalAmount') {
            const num = parseFloat(value);
            if (!isNaN(num)) {
              parsed[targetField] = num;
            }
          } 
          // Store strings
          else {
            parsed[targetField] = String(value);
          }
          break; // Use first matching field
        }
      }
    });

    return parsed;
  }

  /**
   * Get nested value from object using dot notation
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  }

  /**
   * Classify payload data sensitivity
   */
  classifyPayload(payloadData) {
    const classification = {
      containsPII: false,
      containsPaymentData: false,
      dataLevel: 'internal'
    };

    if (!payloadData) return classification;

    const payloadString = JSON.stringify(payloadData).toLowerCase();

    // Check for PII
    const piiFields = ['email', 'phone', 'passport', 'ssn', 'national_id', 'credit_card', 'address'];
    classification.containsPII = piiFields.some(field => payloadString.includes(field));

    // Check for payment data
    const paymentFields = ['card_number', 'cvv', 'expiry', 'payment_method', 'bank_account'];
    classification.containsPaymentData = paymentFields.some(field => payloadString.includes(field));

    // Set data level
    if (classification.containsPaymentData) {
      classification.dataLevel = 'restricted';
    } else if (classification.containsPII) {
      classification.dataLevel = 'confidential';
    }

    return classification;
  }

  /**
   * Detect OTA channel from request
   */
  detectChannel(req) {
    const userAgent = req.headers['user-agent']?.toLowerCase() || '';
    const origin = req.headers['origin']?.toLowerCase() || '';
    const host = req.headers['host']?.toLowerCase() || '';

    if (userAgent.includes('booking') || origin.includes('booking')) return 'booking_com';
    if (userAgent.includes('expedia') || origin.includes('expedia')) return 'expedia';
    if (userAgent.includes('airbnb') || origin.includes('airbnb')) return 'airbnb';
    if (userAgent.includes('agoda') || origin.includes('agoda')) return 'agoda';

    return 'other';
  }

  /**
   * Sanitize headers (remove sensitive information)
   */
  sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    
    // Remove sensitive headers
    const sensitiveHeaders = [
      'authorization',
      'x-api-key',
      'x-secret',
      'cookie',
      'set-cookie',
      'x-real-ip',
      'x-forwarded-for'
    ];

    sensitiveHeaders.forEach(header => {
      delete sanitized[header];
    });

    return sanitized;
  }

  /**
   * Get client IP address
   */
  getClientIP(req) {
    return req.ip || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           req.headers['x-forwarded-for']?.split(',')[0] ||
           req.headers['x-real-ip'] ||
           'unknown';
  }

  /**
   * Generate correlation ID
   */
  generateCorrelationId() {
    return `corr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Create audit log entry for payload storage
   */
  async createAuditLogEntry(payload, action) {
    try {
      const auditLog = await AuditLog.logChange({
        hotelId: payload.parsedPayload.hotelId,
        tableName: 'OTAPayload',
        recordId: payload._id,
        changeType: 'create',
        source: 'api',
        sourceDetails: {
          apiEndpoint: payload.endpoint.url,
          channel: payload.channel
        },
        newValues: {
          payloadId: payload.payloadId,
          direction: payload.direction,
          channel: payload.channel,
          operation: payload.businessContext.operation
        },
        metadata: {
          correlationId: payload.correlationId,
          priority: payload.businessContext.priority,
          tags: ['ota_payload', action]
        }
      });

      // Link audit log to payload
      payload.auditLogId = auditLog._id;
      await payload.save();

    } catch (error) {
      logger.error('Failed to create audit log for payload:', error);
    }
  }

  /**
   * Find payloads for a booking with full audit trail
   */
  async getBookingPayloadHistory(bookingId, options = {}) {
    try {
      const payloads = await OTAPayload.findByBookingId(bookingId, options);
      
      // Enrich with decompressed data if requested
      if (options.includeData) {
        for (const payload of payloads) {
          payload.decompressedPayload = await payload.getDecompressedPayload();
          payload.decompressedResponse = await payload.getDecompressedResponse();
        }
      }

      return payloads;

    } catch (error) {
      logger.error('Failed to get booking payload history:', error);
      throw error;
    }
  }

  /**
   * Search payloads with advanced filters
   */
  async searchPayloads(filters = {}, options = {}) {
    try {
      const query = {};

      // Apply filters
      if (filters.channel) query.channel = filters.channel;
      if (filters.direction) query.direction = filters.direction;
      if (filters.operation) query['businessContext.operation'] = filters.operation;
      if (filters.status) query.processingStatus = filters.status;
      if (filters.bookingId) query.relatedBookingId = filters.bookingId;
      if (filters.correlationId) query.correlationId = filters.correlationId;
      if (filters.ipAddress) query['security.ipAddress'] = filters.ipAddress;

      // Date range
      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
        if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
      }

      // Text search in parsed payload
      if (filters.searchText) {
        query.$or = [
          { 'parsedPayload.guestName': { $regex: filters.searchText, $options: 'i' } },
          { 'parsedPayload.bookingId': { $regex: filters.searchText, $options: 'i' } },
          { 'parsedPayload.reservationId': { $regex: filters.searchText, $options: 'i' } }
        ];
      }

      const payloads = await OTAPayload.find(query)
        .sort({ createdAt: options.sortOrder === 'asc' ? 1 : -1 })
        .limit(options.limit || 100)
        .skip(options.offset || 0)
        .populate('auditLogId', 'logId userId changeType');

      return payloads;

    } catch (error) {
      logger.error('Failed to search payloads:', error);
      throw error;
    }
  }

  /**
   * Get payload statistics
   */
  async getPayloadStats(filters = {}) {
    try {
      return await OTAPayload.getStats(filters);
    } catch (error) {
      logger.error('Failed to get payload stats:', error);
      throw error;
    }
  }

  /**
   * Clean up old correlation mappings
   */
  cleanupCorrelations() {
    const cutoff = new Date(Date.now() - (24 * 60 * 60 * 1000)); // 24 hours ago
    
    for (const [correlationId, data] of this.correlationMap.entries()) {
      if (data.timestamp < cutoff) {
        this.correlationMap.delete(correlationId);
      }
    }
  }

  /**
   * Initialize periodic cleanup
   */
  startCleanup() {
    // Clean up correlation mappings every hour
    setInterval(() => {
      this.cleanupCorrelations();
    }, 60 * 60 * 1000);
  }

  /**
   * Process failed payloads for retry
   */
  async reprocessFailedPayloads(limit = 100) {
    try {
      const failedPayloads = await OTAPayload.find({
        processingStatus: 'failed',
        'processingError.timestamp': {
          $lt: new Date(Date.now() - (30 * 60 * 1000)) // Older than 30 minutes
        }
      })
      .limit(limit)
      .sort({ createdAt: 1 });

      const results = [];

      for (const payload of failedPayloads) {
        try {
          // Attempt to reprocess
          await payload.markProcessed('processing');
          
          // Add your reprocessing logic here
          // This would depend on the specific failure and business logic
          
          await payload.markProcessed('processed');
          
          results.push({
            payloadId: payload.payloadId,
            success: true
          });
          
        } catch (error) {
          await payload.markFailed(error);
          
          results.push({
            payloadId: payload.payloadId,
            success: false,
            error: error.message
          });
        }
      }

      return results;

    } catch (error) {
      logger.error('Failed to reprocess failed payloads:', error);
      throw error;
    }
  }
}

export default new OTAPayloadService();