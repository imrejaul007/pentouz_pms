import mongoose from 'mongoose';
import logger from './logger.js';

/**
 * Advanced Pagination Utility with Cursor-based and Offset-based Support
 */

/**
 * Cursor-based pagination (recommended for large datasets)
 * @param {mongoose.Model} Model - Mongoose model to paginate
 * @param {Object} query - Query filter object
 * @param {Object} options - Pagination options
 * @param {string} options.cursor - Cursor for pagination (usually _id or timestamp)
 * @param {number} options.limit - Number of items per page (default: 20, max: 100)
 * @param {string} options.sortField - Field to sort by (default: '_id')
 * @param {number} options.sortOrder - Sort order (1 for asc, -1 for desc, default: -1)
 * @param {Object} options.select - Fields to select
 * @param {Array} options.populate - Fields to populate
 */
export const cursorPaginate = async (Model, query = {}, options = {}) => {
  const {
    cursor,
    limit = 20,
    sortField = '_id',
    sortOrder = -1,
    select,
    populate = []
  } = options;

  // Validate and sanitize limit
  const sanitizedLimit = Math.min(Math.max(parseInt(limit), 1), 100);
  
  try {
    // Build the query
    let mongoQuery = Model.find(query);

    // Add cursor condition if provided
    if (cursor) {
      const cursorCondition = sortOrder === 1 
        ? { [sortField]: { $gt: cursor } }
        : { [sortField]: { $lt: cursor } };
      
      mongoQuery = mongoQuery.find(cursorCondition);
    }

    // Apply sorting
    mongoQuery = mongoQuery.sort({ [sortField]: sortOrder });

    // Apply limit (fetch one extra to check if there are more results)
    mongoQuery = mongoQuery.limit(sanitizedLimit + 1);

    // Apply field selection
    if (select) {
      mongoQuery = mongoQuery.select(select);
    }

    // Apply population
    if (populate.length > 0) {
      populate.forEach(pop => {
        mongoQuery = mongoQuery.populate(pop);
      });
    }

    // Execute query
    const results = await mongoQuery;
    
    // Check if there are more results
    const hasMore = results.length > sanitizedLimit;
    const data = hasMore ? results.slice(0, sanitizedLimit) : results;
    
    // Generate next cursor
    const nextCursor = data.length > 0 ? data[data.length - 1][sortField] : null;
    
    // Generate previous cursor (for bidirectional pagination)
    const prevCursor = data.length > 0 ? data[0][sortField] : null;

    return {
      data,
      pagination: {
        hasMore,
        nextCursor: hasMore ? nextCursor : null,
        prevCursor: cursor ? prevCursor : null,
        limit: sanitizedLimit,
        count: data.length
      },
      meta: {
        sortField,
        sortOrder,
        cursor
      }
    };

  } catch (error) {
    logger.error('Cursor pagination error:', error);
    throw new Error(`Pagination failed: ${error.message}`);
  }
};

/**
 * Offset-based pagination (for smaller datasets or when total count is needed)
 * @param {mongoose.Model} Model - Mongoose model to paginate
 * @param {Object} query - Query filter object
 * @param {Object} options - Pagination options
 * @param {number} options.page - Page number (1-based, default: 1)
 * @param {number} options.limit - Number of items per page (default: 20, max: 100)
 * @param {Object} options.sort - Sort object (default: { createdAt: -1 })
 * @param {Object} options.select - Fields to select
 * @param {Array} options.populate - Fields to populate
 * @param {boolean} options.lean - Use lean queries for better performance (default: false)
 */
export const offsetPaginate = async (Model, query = {}, options = {}) => {
  const {
    page = 1,
    limit = 20,
    sort = { createdAt: -1 },
    select,
    populate = [],
    lean = false
  } = options;

  // Validate and sanitize inputs
  const sanitizedPage = Math.max(parseInt(page), 1);
  const sanitizedLimit = Math.min(Math.max(parseInt(limit), 1), 100);
  const skip = (sanitizedPage - 1) * sanitizedLimit;

  try {
    // Build queries
    let dataQuery = Model.find(query);
    let countQuery = Model.countDocuments(query);

    // Apply sorting
    dataQuery = dataQuery.sort(sort);

    // Apply pagination
    dataQuery = dataQuery.skip(skip).limit(sanitizedLimit);

    // Apply field selection
    if (select) {
      dataQuery = dataQuery.select(select);
    }

    // Apply population
    if (populate.length > 0) {
      populate.forEach(pop => {
        dataQuery = dataQuery.populate(pop);
      });
    }

    // Apply lean if requested
    if (lean) {
      dataQuery = dataQuery.lean();
    }

    // Execute queries in parallel
    const [data, totalCount] = await Promise.all([
      dataQuery,
      countQuery
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / sanitizedLimit);
    const hasNextPage = sanitizedPage < totalPages;
    const hasPrevPage = sanitizedPage > 1;

    return {
      data,
      pagination: {
        currentPage: sanitizedPage,
        totalPages,
        totalCount,
        limit: sanitizedLimit,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? sanitizedPage + 1 : null,
        prevPage: hasPrevPage ? sanitizedPage - 1 : null,
        skip,
        count: data.length
      },
      meta: {
        sort,
        query: Object.keys(query).length > 0 ? query : null
      }
    };

  } catch (error) {
    logger.error('Offset pagination error:', error);
    throw new Error(`Pagination failed: ${error.message}`);
  }
};

/**
 * Aggregation pipeline pagination
 * @param {mongoose.Model} Model - Mongoose model to paginate
 * @param {Array} pipeline - Aggregation pipeline
 * @param {Object} options - Pagination options
 */
export const aggregatePaginate = async (Model, pipeline = [], options = {}) => {
  const {
    page = 1,
    limit = 20
  } = options;

  const sanitizedPage = Math.max(parseInt(page), 1);
  const sanitizedLimit = Math.min(Math.max(parseInt(limit), 1), 100);
  const skip = (sanitizedPage - 1) * sanitizedLimit;

  try {
    // Create pagination pipeline
    const paginationPipeline = [
      ...pipeline,
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: sanitizedLimit }
          ],
          count: [
            { $count: 'total' }
          ]
        }
      }
    ];

    // Execute aggregation
    const [result] = await Model.aggregate(paginationPipeline);
    
    const data = result.data || [];
    const totalCount = result.count[0]?.total || 0;
    const totalPages = Math.ceil(totalCount / sanitizedLimit);
    const hasNextPage = sanitizedPage < totalPages;
    const hasPrevPage = sanitizedPage > 1;

    return {
      data,
      pagination: {
        currentPage: sanitizedPage,
        totalPages,
        totalCount,
        limit: sanitizedLimit,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? sanitizedPage + 1 : null,
        prevPage: hasPrevPage ? sanitizedPage - 1 : null,
        skip,
        count: data.length
      }
    };

  } catch (error) {
    logger.error('Aggregation pagination error:', error);
    throw new Error(`Aggregation pagination failed: ${error.message}`);
  }
};

/**
 * Smart pagination - automatically chooses between cursor and offset based on dataset size
 * @param {mongoose.Model} Model - Mongoose model to paginate
 * @param {Object} query - Query filter object
 * @param {Object} options - Pagination options
 */
export const smartPaginate = async (Model, query = {}, options = {}) => {
  const { threshold = 10000 } = options;

  try {
    // Quick count estimation
    const estimatedCount = await Model.estimatedDocumentCount();
    
    // Use cursor pagination for large datasets, offset for smaller ones
    if (estimatedCount > threshold) {
      logger.info(`Using cursor pagination for large dataset (${estimatedCount} docs)`);
      return await cursorPaginate(Model, query, options);
    } else {
      logger.info(`Using offset pagination for smaller dataset (${estimatedCount} docs)`);
      return await offsetPaginate(Model, query, options);
    }
  } catch (error) {
    logger.error('Smart pagination error:', error);
    // Fallback to cursor pagination
    return await cursorPaginate(Model, query, options);
  }
};

/**
 * Search with pagination
 * @param {mongoose.Model} Model - Mongoose model to search
 * @param {string} searchTerm - Search term
 * @param {Array} searchFields - Fields to search in
 * @param {Object} options - Pagination and search options
 */
export const searchPaginate = async (Model, searchTerm, searchFields, options = {}) => {
  const { query = {}, ...paginationOptions } = options;

  try {
    // Build search query
    let searchQuery = { ...query };
    
    if (searchTerm && searchFields.length > 0) {
      const searchConditions = searchFields.map(field => ({
        [field]: { $regex: searchTerm, $options: 'i' }
      }));
      
      searchQuery = {
        ...query,
        $or: searchConditions
      };
    }

    // Use smart pagination with search query
    return await smartPaginate(Model, searchQuery, paginationOptions);

  } catch (error) {
    logger.error('Search pagination error:', error);
    throw new Error(`Search pagination failed: ${error.message}`);
  }
};

/**
 * Pagination middleware for Express routes
 */
export const paginationMiddleware = (req, res, next) => {
  // Parse pagination parameters from query
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const cursor = req.query.cursor;
  const sortField = req.query.sortField || 'createdAt';
  const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

  // Attach pagination options to request
  req.pagination = {
    page,
    limit,
    cursor,
    sortField,
    sortOrder,
    type: cursor ? 'cursor' : 'offset'
  };

  // Helper function to paginate
  req.paginate = async (Model, query = {}, options = {}) => {
    const paginationOptions = { ...req.pagination, ...options };
    
    if (paginationOptions.type === 'cursor') {
      return await cursorPaginate(Model, query, paginationOptions);
    } else {
      return await offsetPaginate(Model, query, paginationOptions);
    }
  };

  next();
};

/**
 * Generate pagination links for API responses
 */
export const generatePaginationLinks = (req, pagination, baseUrl = '') => {
  const protocol = req.protocol || 'http';
  const host = req.get('host') || 'localhost';
  const path = req.path || '';
  const fullBaseUrl = baseUrl || `${protocol}://${host}${path}`;

  const links = {
    self: `${fullBaseUrl}?page=${pagination.currentPage}&limit=${pagination.limit}`
  };

  if (pagination.hasNextPage) {
    links.next = `${fullBaseUrl}?page=${pagination.nextPage}&limit=${pagination.limit}`;
    links.last = `${fullBaseUrl}?page=${pagination.totalPages}&limit=${pagination.limit}`;
  }

  if (pagination.hasPrevPage) {
    links.prev = `${fullBaseUrl}?page=${pagination.prevPage}&limit=${pagination.limit}`;
    links.first = `${fullBaseUrl}?page=1&limit=${pagination.limit}`;
  }

  return links;
};

export default {
  cursorPaginate,
  offsetPaginate,
  aggregatePaginate,
  smartPaginate,
  searchPaginate,
  paginationMiddleware,
  generatePaginationLinks
};