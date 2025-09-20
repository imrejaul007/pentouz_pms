import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

/**
 * WebSocket Service using Socket.IO
 * Handles real-time communication for the hotel management system
 */
class WebSocketService {
  constructor() {
    this.io = null;
    this.connections = new Map(); // userId -> socket
    this.hotelConnections = new Map(); // hotelId -> Set of userIds
    this.server = null;
  }

  /**
   * Initialize WebSocket server with HTTP server
   */
  initialize(server) {
    this.server = server;
    
    // Create Socket.IO server
    this.io = new Server(server, {
      cors: {
        origin: [
          "http://localhost:5173",
          "http://localhost:5174",
          "http://localhost:3000",
          "http://localhost:3001",
          "http://localhost:4000",
          "http://127.0.0.1:5173",
          "http://127.0.0.1:5174",
          "http://127.0.0.1:3000"
        ],
        credentials: true,
        methods: ["GET", "POST"]
      },
      path: '/ws/notifications',
      transports: ['websocket', 'polling'],
      allowEIO3: true
    });

    // Authentication middleware
    this.io.use((socket, next) => {
      try {
        const token = socket.handshake.auth.token ||
                     socket.handshake.query.token ||
                     socket.handshake.headers.authorization?.replace('Bearer ', '');

        logger.debug('WebSocket authentication attempt', {
          hasToken: !!token,
          tokenSource: token ? (socket.handshake.auth.token ? 'auth' :
                               socket.handshake.query.token ? 'query' : 'header') : 'none',
          userAgent: socket.handshake.headers['user-agent']
        });

        if (!token) {
          logger.warn('WebSocket authentication failed: no token provided');
          return next(new Error('Authentication token required'));
        }

        if (!process.env.JWT_SECRET) {
          logger.error('WebSocket authentication failed: JWT_SECRET not configured');
          return next(new Error('Server configuration error'));
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded.id) {
          logger.warn('WebSocket authentication failed: invalid token payload', { decoded });
          return next(new Error('Invalid token payload'));
        }

        socket.userId = decoded.id;
        socket.userRole = decoded.role || 'guest';
        socket.hotelId = decoded.hotelId;

        logger.info('WebSocket authentication successful', {
          userId: socket.userId,
          role: socket.userRole,
          hotelId: socket.hotelId,
          socketId: socket.id
        });

        next();
      } catch (error) {
        logger.warn('WebSocket authentication failed', {
          error: error.message,
          hasToken: !!(socket.handshake.auth.token || socket.handshake.query.token),
          hasJwtSecret: !!process.env.JWT_SECRET
        });
        next(new Error(`Authentication failed: ${error.message}`));
      }
    });

    // Connection handling
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    logger.info('WebSocket service initialized with Socket.IO');
    return this;
  }

  /**
   * Handle new socket connection
   */
  handleConnection(socket) {
    const { userId, userRole, hotelId } = socket;
    
    logger.info('New WebSocket connection', { 
      userId, 
      role: userRole, 
      hotelId,
      socketId: socket.id 
    });

    // Store connection
    this.connections.set(userId, socket);
    
    // Add to hotel connections if hotelId exists
    if (hotelId) {
      if (!this.hotelConnections.has(hotelId)) {
        this.hotelConnections.set(hotelId, new Set());
      }
      this.hotelConnections.get(hotelId).add(userId);
    }

    // Join user to their personal room
    socket.join(`user:${userId}`);
    
    // Join hotel room if applicable
    if (hotelId) {
      socket.join(`hotel:${hotelId}`);
    }

    // Join role-based room
    socket.join(`role:${userRole}`);

    // Handle subscription requests
    socket.on('subscribe', (data) => {
      this.handleSubscription(socket, data);
    });

    // Handle unsubscribe requests
    socket.on('unsubscribe', (data) => {
      this.handleUnsubscription(socket, data);
    });

    // Handle ping/pong for heartbeat
    socket.on('ping', () => {
      socket.emit('pong');
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      this.handleDisconnection(socket, reason);
    });

    // Send connection confirmation
    socket.emit('connected', {
      userId,
      role: userRole,
      hotelId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle subscription to specific events
   */
  handleSubscription(socket, data) {
    const { subscription } = data;
    
    if (subscription) {
      socket.join(subscription);
      socket.emit('subscribed', { subscription });
      
      logger.debug('Socket subscribed to channel', { 
        userId: socket.userId, 
        subscription 
      });
    }
  }

  /**
   * Handle unsubscription from events
   */
  handleUnsubscription(socket, data) {
    const { subscription } = data;
    
    if (subscription) {
      socket.leave(subscription);
      socket.emit('unsubscribed', { subscription });
      
      logger.debug('Socket unsubscribed from channel', { 
        userId: socket.userId, 
        subscription 
      });
    }
  }

  /**
   * Handle socket disconnection
   */
  handleDisconnection(socket, reason) {
    const { userId, hotelId } = socket;
    
    logger.info('WebSocket disconnection', { 
      userId, 
      hotelId, 
      reason,
      socketId: socket.id 
    });

    // Remove from connections
    this.connections.delete(userId);
    
    // Remove from hotel connections
    if (hotelId && this.hotelConnections.has(hotelId)) {
      this.hotelConnections.get(hotelId).delete(userId);
      
      // Clean up empty hotel connection sets
      if (this.hotelConnections.get(hotelId).size === 0) {
        this.hotelConnections.delete(hotelId);
      }
    }
  }

  /**
   * Broadcast message to all users of a specific hotel
   */
  async broadcastToHotel(hotelId, event, data) {
    try {
      if (!this.io) {
        logger.warn('WebSocket server not initialized');
        return false;
      }

      this.io.to(`hotel:${hotelId}`).emit('event', {
        type: 'event',
        data: {
          entity: event.split(':')[0] || 'general',
          action: event.split(':')[1] || 'updated',
          data,
          timestamp: new Date().toISOString(),
          hotelId
        }
      });

      logger.debug('Broadcasted to hotel', { hotelId, event, dataKeys: Object.keys(data || {}) });
      return true;
    } catch (error) {
      logger.error('Error broadcasting to hotel', { hotelId, event, error: error.message });
      return false;
    }
  }

  /**
   * Send message to specific user
   */
  async sendToUser(userId, event, data) {
    try {
      if (!this.io) {
        logger.warn('WebSocket server not initialized');
        return false;
      }

      this.io.to(`user:${userId}`).emit('event', {
        type: 'event',
        data: {
          entity: event.split(':')[0] || 'general',
          action: event.split(':')[1] || 'updated',
          data,
          timestamp: new Date().toISOString(),
          userId
        }
      });

      logger.debug('Sent to user', { userId, event, dataKeys: Object.keys(data || {}) });
      return true;
    } catch (error) {
      logger.error('Error sending to user', { userId, event, error: error.message });
      return false;
    }
  }

  /**
   * Broadcast to all connected clients
   */
  async broadcast(event, data) {
    try {
      if (!this.io) {
        logger.warn('WebSocket server not initialized');
        return false;
      }

      this.io.emit('event', {
        type: 'event',
        data: {
          entity: event.split(':')[0] || 'general',
          action: event.split(':')[1] || 'updated',
          data,
          timestamp: new Date().toISOString()
        }
      });

      logger.debug('Broadcasted to all', { event, dataKeys: Object.keys(data || {}) });
      return true;
    } catch (error) {
      logger.error('Error broadcasting to all', { event, error: error.message });
      return false;
    }
  }

  /**
   * Broadcast to users with specific role
   */
  async broadcastToRole(role, event, data) {
    try {
      if (!this.io) {
        logger.warn('WebSocket server not initialized');
        return false;
      }

      this.io.to(`role:${role}`).emit('event', {
        type: 'event',
        data: {
          entity: event.split(':')[0] || 'general',
          action: event.split(':')[1] || 'updated',
          data,
          timestamp: new Date().toISOString(),
          role
        }
      });

      logger.debug('Broadcasted to role', { role, event, dataKeys: Object.keys(data || {}) });
      return true;
    } catch (error) {
      logger.error('Error broadcasting to role', { role, event, error: error.message });
      return false;
    }
  }

  /**
   * Get connection statistics
   */
  getStats() {
    return {
      totalConnections: this.connections.size,
      hotelConnections: Object.fromEntries(
        Array.from(this.hotelConnections.entries()).map(([hotelId, userIds]) => [
          hotelId, 
          userIds.size
        ])
      ),
      isInitialized: !!this.io
    };
  }
}

export default new WebSocketService();