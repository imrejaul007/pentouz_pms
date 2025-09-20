import WebhookEndpoint from '../models/WebhookEndpoint.js';
import apiMetricsService from './apiMetricsService.js';
import logger from '../utils/logger.js';
import axios from 'axios';
import { EventEmitter } from 'events';

class WebhookDeliveryService extends EventEmitter {
  constructor() {
    super();
    this.retryQueue = new Map(); // Store failed deliveries for retry
    this.processing = false;
    
    this.startRetryProcessor();
  }

  /**
   * Start the retry processor that handles failed webhook deliveries
   */
  startRetryProcessor() {
    // Process retry queue every 30 seconds
    setInterval(() => {
      if (!this.processing) {
        this.processRetryQueue();
      }
    }, 30000);

    // Clean up old retry entries every hour
    setInterval(() => {
      this.cleanupRetryQueue();
    }, 60 * 60 * 1000);

    logger.info('Webhook Delivery Service started');
  }

  /**
   * Deliver webhook event to all subscribed endpoints
   */
  async deliverEvent(hotelId, eventType, eventData, metadata = {}) {
    try {
      logger.info('Delivering webhook event', { 
        hotelId, 
        eventType, 
        dataKeys: Object.keys(eventData) 
      });

      // Find all active webhook endpoints for this hotel and event type
      const webhookEndpoints = await WebhookEndpoint.find({
        hotelId,
        isActive: true,
        events: eventType
      });

      if (webhookEndpoints.length === 0) {
        logger.debug(`No webhook endpoints found for event ${eventType} in hotel ${hotelId}`);
        return;
      }

      const deliveryPromises = webhookEndpoints.map(endpoint => 
        this.deliverToEndpoint(endpoint, eventType, eventData, metadata)
      );

      const results = await Promise.allSettled(deliveryPromises);
      
      // Log summary
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      logger.info('Webhook event delivery summary', {
        eventType,
        hotelId,
        total: webhookEndpoints.length,
        successful,
        failed
      });

      // Emit delivery event
      this.emit('eventDelivered', {
        eventType,
        hotelId,
        endpoints: webhookEndpoints.length,
        successful,
        failed
      });

    } catch (error) {
      logger.error('Error delivering webhook event:', error);
    }
  }

  /**
   * Deliver webhook to a specific endpoint
   */
  async deliverToEndpoint(endpoint, eventType, eventData, metadata = {}, attempt = 1) {
    const deliveryId = `${endpoint._id}_${eventType}_${Date.now()}`;
    const startTime = Date.now();
    
    try {
      // Check if this endpoint should receive this event
      if (!endpoint.shouldDeliverEvent(eventType, eventData)) {
        logger.debug(`Event filtered out by endpoint conditions`, {
          endpointId: endpoint._id,
          eventType
        });
        return;
      }

      // Prepare payload
      const timestamp = Math.floor(Date.now() / 1000);
      const payload = {
        id: deliveryId,
        event: eventType,
        data: eventData,
        timestamp,
        attempt,
        metadata: {
          ...metadata,
          hotelId: endpoint.hotelId
        }
      };

      // Create signature
      const signature = endpoint.createSignature(payload, timestamp);
      
      // Prepare headers
      const headers = {
        'Content-Type': endpoint.httpConfig.contentType || 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-Event': eventType,
        'X-Webhook-ID': deliveryId,
        'X-Webhook-Timestamp': timestamp.toString(),
        'User-Agent': 'HotelMS-Webhooks/1.0'
      };

      // Add custom headers
      if (endpoint.httpConfig.headers) {
        Object.entries(endpoint.httpConfig.headers).forEach(([key, value]) => {
          headers[key] = value;
        });
      }

      // Prepare request config
      const requestConfig = {
        method: endpoint.httpConfig.method || 'POST',
        url: endpoint.url,
        headers,
        timeout: endpoint.httpConfig.timeout || 30000,
        maxRedirects: 5,
        validateStatus: (status) => status < 500 // Consider 4xx as successful delivery
      };

      // Set payload based on content type
      if (endpoint.httpConfig.contentType === 'application/x-www-form-urlencoded') {
        requestConfig.data = new URLSearchParams(payload).toString();
      } else {
        requestConfig.data = payload;
      }

      logger.debug('Delivering webhook', {
        endpointId: endpoint._id,
        url: endpoint.url,
        event: eventType,
        attempt
      });

      // Make the request
      const response = await axios(requestConfig);
      const responseTime = Date.now() - startTime;
      const statusCode = response.status;
      const success = statusCode >= 200 && statusCode < 300;

      // Record delivery
      await endpoint.recordDelivery(success, statusCode, responseTime);

      // Record metrics
      await apiMetricsService.recordWebhookDelivery({
        hotelId: endpoint.hotelId,
        webhookId: endpoint._id,
        event: eventType,
        success,
        statusCode,
        responseTime,
        attempts: attempt
      });

      if (success) {
        logger.info('Webhook delivered successfully', {
          endpointId: endpoint._id,
          event: eventType,
          statusCode,
          responseTime
        });

        // Remove from retry queue if it was there
        this.removeFromRetryQueue(deliveryId);
      } else {
        logger.warn('Webhook delivery received non-success response', {
          endpointId: endpoint._id,
          event: eventType,
          statusCode,
          responseTime
        });

        // Add to retry queue if retries are enabled
        if (endpoint.retryPolicy.enabled && attempt <= endpoint.retryPolicy.maxRetries) {
          await this.addToRetryQueue(endpoint, eventType, eventData, metadata, attempt, {
            statusCode,
            message: `HTTP ${statusCode}`
          });
        }
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error.message;
      const statusCode = error.response?.status || 0;
      
      logger.error('Webhook delivery failed', {
        endpointId: endpoint._id,
        event: eventType,
        attempt,
        error: errorMessage,
        statusCode
      });

      // Record failed delivery
      await endpoint.recordDelivery(false, statusCode, responseTime, errorMessage);

      // Record metrics
      await apiMetricsService.recordWebhookDelivery({
        hotelId: endpoint.hotelId,
        webhookId: endpoint._id,
        event: eventType,
        success: false,
        statusCode,
        responseTime,
        attempts: attempt,
        error: errorMessage
      });

      // Check if we should retry
      if (endpoint.retryPolicy.enabled && 
          attempt <= endpoint.retryPolicy.maxRetries &&
          this.shouldRetry(error, endpoint.retryPolicy.retryOn)) {
        
        await this.addToRetryQueue(endpoint, eventType, eventData, metadata, attempt, {
          statusCode,
          message: errorMessage
        });
      }

      throw error;
    }
  }

  /**
   * Add failed delivery to retry queue
   */
  async addToRetryQueue(endpoint, eventType, eventData, metadata, attempt, error) {
    const retryId = `${endpoint._id}_${eventType}_${Date.now()}`;
    const nextDelay = this.calculateRetryDelay(attempt, endpoint.retryPolicy);
    const nextAttempt = new Date(Date.now() + nextDelay);

    const retryEntry = {
      id: retryId,
      endpointId: endpoint._id,
      eventType,
      eventData,
      metadata,
      attempt: attempt + 1,
      nextAttempt,
      error,
      createdAt: new Date(),
      maxRetries: endpoint.retryPolicy.maxRetries
    };

    this.retryQueue.set(retryId, retryEntry);

    logger.info('Added webhook to retry queue', {
      retryId,
      endpointId: endpoint._id,
      eventType,
      attempt: attempt + 1,
      nextAttempt,
      delay: nextDelay
    });
  }

  /**
   * Remove delivery from retry queue
   */
  removeFromRetryQueue(deliveryId) {
    // Find and remove entries that match this delivery
    for (const [key, entry] of this.retryQueue.entries()) {
      if (entry.id.startsWith(deliveryId.split('_').slice(0, -1).join('_'))) {
        this.retryQueue.delete(key);
      }
    }
  }

  /**
   * Process the retry queue
   */
  async processRetryQueue() {
    if (this.retryQueue.size === 0) return;

    this.processing = true;
    const now = new Date();
    const toRetry = [];

    // Find entries ready for retry
    for (const [key, entry] of this.retryQueue.entries()) {
      if (entry.nextAttempt <= now) {
        toRetry.push({ key, entry });
      }
    }

    if (toRetry.length === 0) {
      this.processing = false;
      return;
    }

    logger.info(`Processing ${toRetry.length} webhook retries`);

    for (const { key, entry } of toRetry) {
      try {
        // Remove from queue first
        this.retryQueue.delete(key);

        // Get fresh endpoint data
        const endpoint = await WebhookEndpoint.findById(entry.endpointId);
        if (!endpoint || !endpoint.isActive) {
          logger.info('Skipping retry for inactive webhook endpoint', {
            endpointId: entry.endpointId
          });
          continue;
        }

        // Retry delivery
        await this.deliverToEndpoint(
          endpoint,
          entry.eventType,
          entry.eventData,
          entry.metadata,
          entry.attempt
        );

      } catch (error) {
        logger.debug('Retry delivery failed', {
          retryId: entry.id,
          attempt: entry.attempt,
          error: error.message
        });
      }
    }

    this.processing = false;
  }

  /**
   * Clean up old retry queue entries
   */
  cleanupRetryQueue() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    let cleaned = 0;

    for (const [key, entry] of this.retryQueue.entries()) {
      if (entry.createdAt < cutoff) {
        this.retryQueue.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} old retry queue entries`);
    }
  }

  /**
   * Calculate retry delay based on retry policy
   */
  calculateRetryDelay(attempt, retryPolicy) {
    const baseDelay = retryPolicy.initialDelay || 1000;
    const multiplier = retryPolicy.backoffMultiplier || 2;
    const maxDelay = retryPolicy.maxDelay || 60000;
    
    const delay = Math.min(baseDelay * Math.pow(multiplier, attempt - 1), maxDelay);
    
    // Add some jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    
    return Math.floor(delay + jitter);
  }

  /**
   * Check if error should trigger a retry
   */
  shouldRetry(error, retryOn) {
    if (!retryOn || retryOn.length === 0) {
      retryOn = ['timeout', 'connection_error', '5xx'];
    }

    const statusCode = error.response?.status;
    const message = error.message.toLowerCase();

    for (const condition of retryOn) {
      switch (condition) {
        case 'timeout':
          if (message.includes('timeout') || error.code === 'ETIMEDOUT') return true;
          break;
        case 'connection_error':
          if (message.includes('connection') || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') return true;
          break;
        case '5xx':
          if (statusCode >= 500) return true;
          break;
        case '4xx':
          if (statusCode >= 400 && statusCode < 500) return true;
          break;
      }
    }

    return false;
  }

  /**
   * Test webhook endpoint
   */
  async testEndpoint(endpointId) {
    try {
      const endpoint = await WebhookEndpoint.findById(endpointId);
      if (!endpoint) {
        throw new Error('Webhook endpoint not found');
      }

      const testEvent = {
        test: true,
        message: 'This is a test webhook delivery',
        timestamp: new Date().toISOString(),
        endpoint: {
          id: endpoint._id,
          name: endpoint.name
        }
      };

      await this.deliverToEndpoint(endpoint, 'system.webhook_test', testEvent, {
        test: true
      });

      return { success: true, message: 'Test webhook delivered successfully' };

    } catch (error) {
      logger.error('Webhook endpoint test failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get retry queue status
   */
  getRetryQueueStatus() {
    const now = new Date();
    let pending = 0;
    let ready = 0;
    const byEndpoint = new Map();

    for (const entry of this.retryQueue.values()) {
      pending++;
      
      if (entry.nextAttempt <= now) {
        ready++;
      }

      const count = byEndpoint.get(entry.endpointId) || 0;
      byEndpoint.set(entry.endpointId, count + 1);
    }

    return {
      total: pending,
      ready,
      processing: this.processing,
      byEndpoint: Object.fromEntries(byEndpoint)
    };
  }
}

// Create singleton instance
const webhookDeliveryService = new WebhookDeliveryService();

export default webhookDeliveryService;