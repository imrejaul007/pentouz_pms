import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Endpoint Registry Service
 * Scans all route files and builds a comprehensive endpoint catalog
 */
class EndpointRegistryService {
  constructor() {
    this.endpoints = [];
    this.routesDir = path.join(__dirname, '../routes');
    this.cache = {
      endpoints: null,
      lastScan: null,
      ttl: 5 * 60 * 1000 // 5 minutes cache
    };
  }

  /**
   * Get cached endpoints if available and valid
   */
  getCachedEndpoints() {
    const now = Date.now();
    if (this.cache.endpoints &&
        this.cache.lastScan &&
        (now - this.cache.lastScan < this.cache.ttl)) {
      logger.info('Using cached endpoints');
      return this.cache.endpoints;
    }
    return null;
  }

  /**
   * Scan all route files and extract endpoint information (with caching)
   */
  async scanRoutes(forceRefresh = false) {
    try {
      // Return cached endpoints if available and not forcing refresh
      if (!forceRefresh) {
        const cached = this.getCachedEndpoints();
        if (cached) {
          this.endpoints = cached;
          return this.endpoints;
        }
      }

      logger.info('Starting endpoint registry scan...');

      // Clear existing endpoints
      this.endpoints = [];

      // Get all route files
      const routeFiles = fs.readdirSync(this.routesDir)
        .filter(file => file.endsWith('.js'))
        .filter(file => !file.includes('.test.') && !file.includes('.spec.'));

      logger.info(`Found ${routeFiles.length} route files to scan`);

      // Process each route file
      for (const file of routeFiles) {
        await this.processRouteFile(file);
      }

      // Cache the results
      this.cache.endpoints = [...this.endpoints];
      this.cache.lastScan = Date.now();

      logger.info(`Endpoint registry scan completed. Found ${this.endpoints.length} endpoints`);
      return this.endpoints;

    } catch (error) {
      logger.error('Error scanning routes:', error);
      throw error;
    }
  }

  /**
   * Process individual route file
   */
  async processRouteFile(filename) {
    try {
      const filePath = path.join(this.routesDir, filename);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Extract route definitions from file content
      const routes = this.extractRoutesFromContent(content, filename);

      // Add to endpoints array
      this.endpoints.push(...routes);

    } catch (error) {
      logger.warn(`Error processing route file ${filename}:`, error.message);
    }
  }

  /**
   * Extract route definitions from file content
   */
  extractRoutesFromContent(content, filename) {
    const routes = [];
    const category = this.getCategoryFromFilename(filename);

    // Common HTTP methods
    const methods = ['get', 'post', 'put', 'patch', 'delete'];

    // Extract router method calls
    methods.forEach(method => {
      const regex = new RegExp(`router\\.${method}\\(['"\`]([^'"\`]+)['"\`]`, 'g');
      let match;

      while ((match = regex.exec(content)) !== null) {
        const routePath = match[1];
        const fullPath = this.buildFullPath(category, routePath);

        // Extract additional information
        const routeInfo = this.extractRouteInfo(content, match.index, method, routePath);

        routes.push({
          id: this.generateEndpointId(method, fullPath),
          name: this.generateEndpointName(method, routePath, category),
          method: method.toUpperCase(),
          path: fullPath,
          originalPath: routePath,
          description: routeInfo.description,
          category: category,
          version: 'v1',
          status: routeInfo.status,
          authRequired: routeInfo.authRequired,
          rateLimit: routeInfo.rateLimit,
          parameters: routeInfo.parameters,
          responses: routeInfo.responses,
          tags: routeInfo.tags,
          deprecated: routeInfo.deprecated
        });
      }
    });

    return routes;
  }

  /**
   * Extract additional route information from content
   */
  extractRouteInfo(content, matchIndex, method, routePath) {
    // Look for Swagger/JSDoc comments before the route
    const beforeRoute = content.substring(Math.max(0, matchIndex - 2000), matchIndex);

    // Extract description from Swagger comment
    const descriptionMatch = beforeRoute.match(/\*\s+summary:\s*(.+)/i);
    const description = descriptionMatch ? descriptionMatch[1].trim() : this.generateDefaultDescription(method, routePath);

    // Determine if auth is required (look for auth middleware)
    const authRequired = /authenticate|authorize|auth\.|authRequired/i.test(beforeRoute) ||
                        /\.authenticate|\.authorize/i.test(beforeRoute);

    // Determine status (look for deprecated markers)
    const deprecated = /deprecated|@deprecated/i.test(beforeRoute);
    const status = deprecated ? 'deprecated' : 'active';

    // Look for rate limit info
    const rateLimitMatch = beforeRoute.match(/rateLimit[:\s]*(\d+)/i);
    const rateLimit = rateLimitMatch ? parseInt(rateLimitMatch[1]) : 1000;

    // Extract parameters (path parameters)
    const parameters = this.extractParameters(routePath);

    // Generate basic responses
    const responses = this.generateBasicResponses(method);

    // Extract tags
    const tagsMatch = beforeRoute.match(/\*\s+tags:\s*\[([^\]]+)\]/i);
    const tags = tagsMatch ? tagsMatch[1].split(',').map(tag => tag.trim().replace(/['"]/g, '')) : [this.getCategoryFromPath(routePath)];

    return {
      description,
      authRequired,
      status,
      rateLimit,
      parameters,
      responses,
      tags,
      deprecated
    };
  }

  /**
   * Extract parameters from route path
   */
  extractParameters(routePath) {
    const parameters = [];
    const paramMatches = routePath.match(/:(\w+)/g);

    if (paramMatches) {
      paramMatches.forEach(param => {
        const paramName = param.substring(1); // Remove ':'
        parameters.push({
          name: paramName,
          in: 'path',
          required: true,
          type: 'string',
          description: `${paramName} identifier`
        });
      });
    }

    return parameters;
  }

  /**
   * Generate basic responses for endpoint
   */
  generateBasicResponses(method) {
    const responses = {
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden' },
      '500': { description: 'Internal Server Error' }
    };

    switch (method.toLowerCase()) {
      case 'get':
        responses['200'] = { description: 'Success' };
        responses['404'] = { description: 'Resource not found' };
        break;
      case 'post':
        responses['201'] = { description: 'Created successfully' };
        responses['400'] = { description: 'Bad request' };
        break;
      case 'put':
      case 'patch':
        responses['200'] = { description: 'Updated successfully' };
        responses['400'] = { description: 'Bad request' };
        responses['404'] = { description: 'Resource not found' };
        break;
      case 'delete':
        responses['200'] = { description: 'Deleted successfully' };
        responses['404'] = { description: 'Resource not found' };
        break;
    }

    return responses;
  }

  /**
   * Utility methods
   */
  getCategoryFromFilename(filename) {
    const baseName = filename.replace('.js', '');

    // Map filenames to categories
    const categoryMap = {
      'auth': 'Authentication',
      'rooms': 'Rooms',
      'roomTypes': 'Room Types',
      'bookings': 'Bookings',
      'enhancedBookings': 'Enhanced Bookings',
      'guests': 'Guests',
      'guestServices': 'Guest Services',
      'payments': 'Payments',
      'admin': 'Administration',
      'adminDashboard': 'Admin Dashboard',
      'staff': 'Staff Management',
      'staffDashboard': 'Staff Dashboard',
      'housekeeping': 'Housekeeping',
      'inventory': 'Inventory',
      'maintenance': 'Maintenance',
      'reports': 'Reports',
      'analytics': 'Analytics',
      'pos': 'Point of Sale',
      'financial': 'Financial',
      'revenue': 'Revenue Management',
      'revenueManagement': 'Revenue Management',
      'channelManager': 'Channel Management',
      'bookingEngine': 'Booking Engine',
      'tapeChart': 'Tape Chart',
      'ota': 'OTA Integration',
      'webhooks': 'Webhooks',
      'notifications': 'Notifications',
      'apiManagement': 'API Management',
      'dashboard': 'Dashboard',
      'availability': 'Availability',
      'rateManagement': 'Rate Management'
    };

    return categoryMap[baseName] || this.formatCategoryName(baseName);
  }

  formatCategoryName(name) {
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  getCategoryFromPath(path) {
    if (path.includes('auth')) return 'Authentication';
    if (path.includes('room')) return 'Rooms';
    if (path.includes('booking')) return 'Bookings';
    if (path.includes('guest')) return 'Guests';
    if (path.includes('payment')) return 'Payments';
    if (path.includes('admin')) return 'Administration';
    if (path.includes('staff')) return 'Staff';
    if (path.includes('housekeeping')) return 'Housekeeping';
    if (path.includes('inventory')) return 'Inventory';
    if (path.includes('maintenance')) return 'Maintenance';
    if (path.includes('report')) return 'Reports';
    if (path.includes('pos')) return 'Point of Sale';
    if (path.includes('financial')) return 'Financial';
    if (path.includes('revenue')) return 'Revenue Management';
    return 'Other';
  }

  buildFullPath(category, routePath) {
    // Convert route path to full API path
    let fullPath = `/api/v1${routePath}`;

    // Handle relative paths that don't start with /
    if (!routePath.startsWith('/')) {
      const categoryPath = this.getCategoryPath(category);
      fullPath = `/api/v1/${categoryPath}/${routePath}`;
    }

    return fullPath;
  }

  getCategoryPath(category) {
    const pathMap = {
      'Authentication': 'auth',
      'Rooms': 'rooms',
      'Room Types': 'room-types',
      'Bookings': 'bookings',
      'Enhanced Bookings': 'enhanced-bookings',
      'Guests': 'guests',
      'Guest Services': 'guest-services',
      'Payments': 'payments',
      'Administration': 'admin',
      'Admin Dashboard': 'admin-dashboard',
      'Staff Management': 'staff',
      'Staff Dashboard': 'staff-dashboard',
      'Housekeeping': 'housekeeping',
      'Inventory': 'inventory',
      'Maintenance': 'maintenance',
      'Reports': 'reports',
      'Analytics': 'analytics',
      'Point of Sale': 'pos',
      'Financial': 'financial',
      'Revenue Management': 'revenue-management',
      'Channel Management': 'channel-management',
      'Booking Engine': 'booking-engine',
      'Tape Chart': 'tape-chart',
      'OTA Integration': 'ota',
      'Webhooks': 'webhooks',
      'Notifications': 'notifications',
      'API Management': 'api-management',
      'Dashboard': 'dashboard',
      'Availability': 'availability',
      'Rate Management': 'rate-management'
    };

    return pathMap[category] || category.toLowerCase().replace(/\s+/g, '-');
  }

  generateEndpointId(method, path) {
    return `${method.toLowerCase()}_${path.replace(/[^a-zA-Z0-9]/g, '_').replace(/__+/g, '_')}`;
  }

  generateEndpointName(method, routePath, category) {
    const action = method.toUpperCase();
    const resource = this.extractResourceFromPath(routePath);
    return `${action} ${resource}`;
  }

  extractResourceFromPath(routePath) {
    // Extract main resource from path
    const parts = routePath.split('/').filter(part => part && !part.startsWith(':'));
    const mainResource = parts[0] || 'Resource';

    return this.formatResourceName(mainResource);
  }

  formatResourceName(resource) {
    return resource
      .replace(/[-_]/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .toLowerCase()
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  generateDefaultDescription(method, routePath) {
    const action = this.getActionFromMethod(method);
    const resource = this.extractResourceFromPath(routePath);
    return `${action} ${resource.toLowerCase()}`;
  }

  getActionFromMethod(method) {
    const actionMap = {
      'get': 'Retrieve',
      'post': 'Create',
      'put': 'Update',
      'patch': 'Modify',
      'delete': 'Delete'
    };
    return actionMap[method.toLowerCase()] || 'Process';
  }

  /**
   * Get endpoints with usage statistics
   */
  async getEndpointsWithUsage(hotelId) {
    // This would be enhanced to include actual usage statistics from APIMetrics
    return this.endpoints.map(endpoint => ({
      ...endpoint,
      usage: {
        requests: Math.floor(Math.random() * 10000), // Placeholder - would be real data
        errors: Math.floor(Math.random() * 100),
        avgResponseTime: Math.floor(Math.random() * 500) + 50
      },
      lastUsed: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
    }));
  }

  /**
   * Get all endpoints
   */
  getAllEndpoints() {
    return this.endpoints;
  }

  /**
   * Get endpoints by category
   */
  getEndpointsByCategory(category) {
    return this.endpoints.filter(endpoint => endpoint.category === category);
  }

  /**
   * Search endpoints
   */
  searchEndpoints(query) {
    const lowerQuery = query.toLowerCase();
    return this.endpoints.filter(endpoint =>
      endpoint.name.toLowerCase().includes(lowerQuery) ||
      endpoint.path.toLowerCase().includes(lowerQuery) ||
      endpoint.description.toLowerCase().includes(lowerQuery) ||
      endpoint.category.toLowerCase().includes(lowerQuery)
    );
  }
}

// Create singleton instance
const endpointRegistryService = new EndpointRegistryService();

export default endpointRegistryService;