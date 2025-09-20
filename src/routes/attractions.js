import express from 'express';
import LocalAttraction from '../models/LocalAttraction.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';

const router = express.Router();

/**
 * @swagger
 * /attractions:
 *   get:
 *     summary: Get local attractions
 *     tags: [Attractions]
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         schema:
 *           type: string
 *         description: Hotel ID to get attractions for
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [amenities, dining, attractions, shopping, transport, medical, entertainment]
 *         description: Filter by category
 *       - in: query
 *         name: maxDistance
 *         schema:
 *           type: number
 *         description: Maximum distance in miles (default 10)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of results to return (default 20)
 *     responses:
 *       200:
 *         description: List of local attractions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 results:
 *                   type: integer
 *                 data:
 *                   type: object
 *                   properties:
 *                     attractions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/LocalAttraction'
 */
router.get('/', catchAsync(async (req, res) => {
  const {
    hotelId,
    category,
    maxDistance = 10,
    limit = 20
  } = req.query;

  // Build query
  const query = {
    isActive: true
  };

  if (hotelId) {
    query.hotelId = hotelId;
  }

  if (category) {
    query.category = category;
  }

  if (maxDistance) {
    query.distance = { $lte: parseFloat(maxDistance) };
  }

  // Find attractions
  const attractions = await LocalAttraction.find(query)
    .sort({ distance: 1, rating: -1 }) // Sort by distance first, then rating
    .limit(parseInt(limit));

  res.json({
    status: 'success',
    results: attractions.length,
    data: {
      attractions
    }
  });
}));

/**
 * @swagger
 * /attractions/categories:
 *   get:
 *     summary: Get attractions grouped by category
 *     tags: [Attractions]
 *     parameters:
 *       - in: query
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *         description: Hotel ID to get attractions for
 *       - in: query
 *         name: maxDistance
 *         schema:
 *           type: number
 *         description: Maximum distance in miles (default 10)
 *     responses:
 *       200:
 *         description: Attractions grouped by category
 */
router.get('/categories', catchAsync(async (req, res) => {
  const { hotelId, maxDistance = 10 } = req.query;

  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }

  // Build query
  const query = {
    hotelId,
    distance: { $lte: parseFloat(maxDistance) },
    isActive: true
  };

  // Get attractions grouped by category
  const attractionsByCategory = await LocalAttraction.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$category',
        attractions: {
          $push: {
            _id: '$_id',
            name: '$name',
            description: '$description',
            distance: '$distance',
            distanceText: '$distanceText',
            rating: '$rating',
            address: '$address',
            imageUrl: '$imageUrl',
            website: '$website',
            phone: '$phone',
            coordinates: '$coordinates',
            openingHours: '$openingHours'
          }
        },
        count: { $sum: 1 },
        averageDistance: { $avg: '$distance' }
      }
    },
    {
      $project: {
        category: '$_id',
        attractions: {
          $slice: [
            {
              $sortArray: {
                input: '$attractions',
                sortBy: { distance: 1, rating: -1 }
              }
            },
            10 // Limit to top 10 per category
          ]
        },
        count: 1,
        averageDistance: { $round: ['$averageDistance', 1] }
      }
    },
    { $sort: { averageDistance: 1 } }
  ]);

  // Convert to object format for easier frontend consumption
  const categorizedAttractions = {};
  attractionsByCategory.forEach(categoryData => {
    categorizedAttractions[categoryData.category] = {
      attractions: categoryData.attractions,
      count: categoryData.count,
      averageDistance: categoryData.averageDistance
    };
  });

  res.json({
    status: 'success',
    data: {
      categories: categorizedAttractions,
      totalCategories: attractionsByCategory.length
    }
  });
}));

/**
 * @swagger
 * /attractions/{id}:
 *   get:
 *     summary: Get single attraction details
 *     tags: [Attractions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Attraction ID
 *     responses:
 *       200:
 *         description: Attraction details
 *       404:
 *         description: Attraction not found
 */
router.get('/:id', catchAsync(async (req, res) => {
  const attraction = await LocalAttraction.findById(req.params.id)
    .populate('hotelId', 'name address');

  if (!attraction) {
    throw new ApplicationError('Attraction not found', 404);
  }

  res.json({
    status: 'success',
    data: {
      attraction
    }
  });
}));

/**
 * @swagger
 * /attractions:
 *   post:
 *     summary: Create new attraction (Admin only)
 *     tags: [Attractions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - description
 *               - category
 *               - distance
 *               - address
 *               - coordinates
 *               - hotelId
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               distance:
 *                 type: number
 *               address:
 *                 type: string
 *               coordinates:
 *                 type: object
 *               hotelId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Attraction created successfully
 */
router.post('/', 
  authenticate, 
  authorize('admin'), 
  catchAsync(async (req, res) => {
    const {
      name,
      description,
      category,
      distance,
      address,
      coordinates,
      hotelId,
      rating,
      imageUrl,
      website,
      phone,
      openingHours
    } = req.body;

    // Generate distance text
    const distanceText = distance < 1 
      ? `${Math.round(distance * 5280)} feet away`
      : `${distance.toFixed(1)} mile${distance !== 1 ? 's' : ''} away`;

    const attraction = await LocalAttraction.create({
      name,
      description,
      category,
      distance,
      distanceText,
      address,
      coordinates,
      hotelId,
      rating,
      imageUrl,
      website,
      phone,
      openingHours
    });

    res.status(201).json({
      status: 'success',
      data: {
        attraction
      }
    });
  })
);

/**
 * @swagger
 * /attractions/{id}:
 *   patch:
 *     summary: Update attraction (Admin only)
 *     tags: [Attractions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Attraction updated successfully
 */
router.patch('/:id', 
  authenticate, 
  authorize('admin'), 
  catchAsync(async (req, res) => {
    const attraction = await LocalAttraction.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!attraction) {
      throw new ApplicationError('Attraction not found', 404);
    }

    res.json({
      status: 'success',
      data: {
        attraction
      }
    });
  })
);

/**
 * @swagger
 * /attractions/{id}:
 *   delete:
 *     summary: Delete attraction (Admin only)
 *     tags: [Attractions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Attraction deleted successfully
 */
router.delete('/:id', 
  authenticate, 
  authorize('admin'), 
  catchAsync(async (req, res) => {
    const attraction = await LocalAttraction.findByIdAndDelete(req.params.id);

    if (!attraction) {
      throw new ApplicationError('Attraction not found', 404);
    }

    res.status(204).json({
      status: 'success',
      data: null
    });
  })
);

export default router;