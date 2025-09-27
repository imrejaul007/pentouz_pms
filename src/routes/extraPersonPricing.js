import express from 'express';
import ExtraPersonCharge from '../models/ExtraPersonCharge.js';
import extraPersonPricingEngine from '../services/extraPersonPricingEngine.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';

const router = express.Router();

/**
 * @swagger
 * /extra-person-pricing/rules:
 *   get:
 *     summary: Get extra person charge rules for hotel (Admin/Staff only)
 *     tags: [Extra Person Pricing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Extra person charge rules retrieved successfully
 *       403:
 *         description: Access denied - admin/staff only
 */
router.get('/rules',
  authenticate,
  authorize(['admin', 'staff']),
  catchAsync(async (req, res) => {
    const hotelId = req.user.hotelId;

    const chargeRules = await ExtraPersonCharge.find({ hotelId, isActive: true })
      .sort({ priority: -1, guestType: 1, 'ageRange.min': 1 });

    res.json({
      status: 'success',
      data: {
        chargeRules,
        totalRules: chargeRules.length
      }
    });
  })
);

/**
 * @swagger
 * /extra-person-pricing/rules:
 *   post:
 *     summary: Create extra person charge rule (Admin only)
 *     tags: [Extra Person Pricing]
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
 *               - chargeType
 *               - amount
 *               - guestType
 *             properties:
 *               name:
 *                 type: string
 *                 description: Rule name
 *               description:
 *                 type: string
 *                 description: Rule description
 *               chargeType:
 *                 type: string
 *                 enum: [fixed, percentage_of_room_rate, per_night]
 *                 description: Charge calculation type
 *               amount:
 *                 type: number
 *                 minimum: 0
 *                 description: Charge amount or percentage
 *               guestType:
 *                 type: string
 *                 enum: [adult, child]
 *                 description: Guest type
 *               applicableRoomTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Room types this rule applies to
 *               ageRange:
 *                 type: object
 *                 properties:
 *                   min:
 *                     type: number
 *                   max:
 *                     type: number
 *               maxExtraPersons:
 *                 type: number
 *                 minimum: 1
 *                 default: 4
 *               priority:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 100
 *                 default: 1
 *     responses:
 *       201:
 *         description: Extra person charge rule created successfully
 *       400:
 *         description: Invalid rule data
 *       403:
 *         description: Access denied - admin only
 */
router.post('/rules',
  authenticate,
  authorize(['admin']),
  catchAsync(async (req, res) => {
    const hotelId = req.user.hotelId;
    const ruleData = {
      ...req.body,
      hotelId,
      createdBy: req.user._id
    };

    const chargeRule = new ExtraPersonCharge(ruleData);
    await chargeRule.save();

    res.status(201).json({
      status: 'success',
      data: {
        chargeRule,
        message: 'Extra person charge rule created successfully'
      }
    });
  })
);

/**
 * @swagger
 * /extra-person-pricing/rules/{id}:
 *   put:
 *     summary: Update extra person charge rule (Admin only)
 *     tags: [Extra Person Pricing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Rule ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               amount:
 *                 type: number
 *               isActive:
 *                 type: boolean
 *               priority:
 *                 type: number
 *     responses:
 *       200:
 *         description: Rule updated successfully
 *       403:
 *         description: Access denied - admin only
 *       404:
 *         description: Rule not found
 */
router.put('/rules/:id',
  authenticate,
  authorize(['admin']),
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const hotelId = req.user.hotelId;

    const chargeRule = await ExtraPersonCharge.findOne({ _id: id, hotelId });
    if (!chargeRule) {
      throw new ApplicationError('Charge rule not found', 404);
    }

    Object.assign(chargeRule, req.body, { updatedBy: req.user._id });
    await chargeRule.save();

    res.json({
      status: 'success',
      data: {
        chargeRule,
        message: 'Extra person charge rule updated successfully'
      }
    });
  })
);

/**
 * @swagger
 * /extra-person-pricing/calculate:
 *   post:
 *     summary: Calculate extra person charges with dynamic pricing (Admin/Staff only)
 *     tags: [Extra Person Pricing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - extraPersons
 *               - baseBookingData
 *             properties:
 *               extraPersons:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     type:
 *                       type: string
 *                       enum: [adult, child]
 *                     age:
 *                       type: number
 *               baseBookingData:
 *                 type: object
 *                 properties:
 *                   roomType:
 *                     type: string
 *                   baseRoomRate:
 *                     type: number
 *                   checkIn:
 *                     type: string
 *                     format: date
 *                   checkOut:
 *                     type: string
 *                     format: date
 *                   nights:
 *                     type: number
 *                   source:
 *                     type: string
 *                   guestDetails:
 *                     type: object
 *                     properties:
 *                       adults:
 *                         type: number
 *                       children:
 *                         type: number
 *               guestProfile:
 *                 type: object
 *                 properties:
 *                   loyaltyTier:
 *                     type: string
 *                     enum: [bronze, silver, gold, platinum]
 *                   isVIP:
 *                     type: boolean
 *               useDynamicPricing:
 *                 type: boolean
 *                 default: true
 *                 description: Whether to use dynamic pricing engine
 *     responses:
 *       200:
 *         description: Extra person charges calculated successfully
 *       400:
 *         description: Invalid calculation data
 *       403:
 *         description: Access denied - admin/staff only
 */
router.post('/calculate',
  authenticate,
  authorize(['admin', 'staff']),
  catchAsync(async (req, res) => {
    const hotelId = req.user.hotelId;
    const { extraPersons, baseBookingData, guestProfile = {}, useDynamicPricing = true } = req.body;

    if (!extraPersons || !baseBookingData) {
      throw new ApplicationError('Extra persons and base booking data are required', 400);
    }

    let pricingResult;

    if (useDynamicPricing) {
      // Use dynamic pricing engine
      const pricingContext = {
        hotelId,
        extraPersons,
        baseBookingData,
        guestProfile,
        marketingSettings: {
          enableCompetitorPricing: true,
          enableDynamicDiscounts: true
        }
      };

      pricingResult = await extraPersonPricingEngine.calculateDynamicPricing(pricingContext);
    } else {
      // Use basic pricing from model
      const bookingData = {
        ...baseBookingData,
        extraPersons: extraPersons.map(person => ({
          id: person.id || new Date().getTime().toString(),
          name: person.name,
          type: person.type,
          age: person.age
        }))
      };

      const basicResult = await ExtraPersonCharge.calculateExtraPersonCharge(hotelId, bookingData);
      pricingResult = {
        success: true,
        pricingBreakdown: {
          chargeBreakdown: basicResult.chargeBreakdown,
          totalFinalAmount: basicResult.totalExtraCharge
        },
        totalExtraPersonCharge: basicResult.totalExtraCharge,
        currency: basicResult.currency,
        appliedStrategies: ['base_pricing_only']
      };
    }

    res.json({
      status: 'success',
      data: {
        ...pricingResult,
        calculationMethod: useDynamicPricing ? 'dynamic_pricing' : 'basic_pricing',
        message: 'Extra person charges calculated successfully'
      }
    });
  })
);

/**
 * @swagger
 * /extra-person-pricing/preview:
 *   post:
 *     summary: Get pricing preview without saving (Admin/Staff only)
 *     tags: [Extra Person Pricing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - extraPersons
 *               - baseBookingData
 *             properties:
 *               extraPersons:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     type:
 *                       type: string
 *                       enum: [adult, child]
 *                     age:
 *                       type: number
 *               baseBookingData:
 *                 type: object
 *               guestProfile:
 *                 type: object
 *                 properties:
 *                   loyaltyTier:
 *                     type: string
 *                   isVIP:
 *                     type: boolean
 *     responses:
 *       200:
 *         description: Pricing preview generated successfully
 *       403:
 *         description: Access denied - admin/staff only
 */
router.post('/preview',
  authenticate,
  authorize(['admin', 'staff']),
  catchAsync(async (req, res) => {
    const hotelId = req.user.hotelId;
    const previewData = {
      ...req.body,
      marketingSettings: {
        enableCompetitorPricing: true,
        enableDynamicDiscounts: true
      }
    };

    const pricingPreview = await extraPersonPricingEngine.getPricingPreview(hotelId, previewData);

    res.json({
      status: 'success',
      data: {
        ...pricingPreview,
        isPreview: true,
        message: 'Pricing preview generated successfully'
      }
    });
  })
);

/**
 * @swagger
 * /extra-person-pricing/strategies:
 *   get:
 *     summary: Get available pricing strategies (Admin only)
 *     tags: [Extra Person Pricing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Available pricing strategies
 *       403:
 *         description: Access denied - admin only
 */
router.get('/strategies',
  authenticate,
  authorize(['admin']),
  catchAsync(async (req, res) => {
    const strategies = [
      {
        name: 'group_booking',
        description: 'Group booking discounts based on total person count',
        type: 'discount',
        rules: [
          { condition: '10+ people', discount: '15%' },
          { condition: '6+ people', discount: '10%' },
          { condition: '4+ people', discount: '5%' }
        ]
      },
      {
        name: 'extended_stay',
        description: 'Extended stay discounts based on number of nights',
        type: 'discount',
        rules: [
          { condition: '30+ nights', discount: '25%' },
          { condition: '14+ nights', discount: '15%' },
          { condition: '7+ nights', discount: '10%' }
        ]
      },
      {
        name: 'family_discount',
        description: 'Family discounts for multiple children',
        type: 'discount',
        rules: [
          { condition: '3+ children', discount: '20%' },
          { condition: '2+ children', discount: '10%' }
        ]
      },
      {
        name: 'loyalty_program',
        description: 'Loyalty tier-based discounts',
        type: 'discount',
        rules: [
          { tier: 'Bronze', discount: '5%' },
          { tier: 'Silver', discount: '10%' },
          { tier: 'Gold', discount: '15%' },
          { tier: 'Platinum', discount: '20%' }
        ]
      },
      {
        name: 'demand_based',
        description: 'Dynamic pricing based on occupancy',
        type: 'variable',
        rules: [
          { condition: '90%+ occupancy', adjustment: '+25% surge' },
          { condition: 'under 50% occupancy', adjustment: '20% discount' }
        ]
      },
      {
        name: 'seasonal_adjustment',
        description: 'Seasonal rate variations',
        type: 'multiplier',
        rules: 'Based on hotel seasonal rate configuration'
      }
    ];

    res.json({
      status: 'success',
      data: {
        strategies,
        totalStrategies: strategies.length,
        message: 'Available pricing strategies retrieved successfully'
      }
    });
  })
);

export default router;