/**
 * B2B API v1 - Trips Routes
 * Trip creation and management for API partners
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../../../db';
import { trips, users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { requirePermission, requireTier } from '../../../middleware/apiAuth';
import { storage } from '../../../storage';

const router = Router();

// Validation schema for trip creation
const createTripSchema = z.object({
  origin: z.string().min(1, 'Origin is required'),
  destination: z.string().min(1, 'Destination is required'),
  passport: z.string().min(1, 'Passport/nationality is required'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  budget: z.number().positive('Budget must be positive'),
  currency: z.string().length(3).default('USD'),
  adults: z.number().int().min(1).default(1),
  children: z.number().int().min(0).default(0),
  infants: z.number().int().min(0).default(0),
  travelStyle: z.enum(['budget', 'moderate', 'luxury']).default('moderate'),
  interests: z.array(z.string()).optional(),
  notes: z.string().optional(),
  // API-specific fields
  clientReference: z.string().optional(), // Partner's reference ID
  webhookUrl: z.string().url().optional(), // Webhook for async updates
});

/**
 * POST /api/v1/trips
 * Create a new trip
 */
router.post('/', requirePermission('write'), async (req: Request, res: Response) => {
  try {
    const validation = createTripSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid request body',
        details: validation.error.errors,
      });
    }

    const data = validation.data;

    // Calculate group size
    const groupSize = data.adults + data.children + data.infants;

    // Create trip via storage layer (uses same logic as main app)
    const trip = await storage.createTrip({
      origin: data.origin,
      destination: data.destination,
      passport: data.passport,
      dates: `${data.startDate} - ${data.endDate}`,
      budget: data.budget,
      currency: data.currency,
      groupSize,
      adults: data.adults,
      children: data.children,
      infants: data.infants,
      travelStyle: data.travelStyle,
      interests: data.interests || [],
      // Store API context in voyage UID
      voyageUid: `api_${req.apiKey?.userId}_${Date.now()}`,
    });

    // Note: Feasibility analysis is triggered asynchronously
    // Partners can poll GET /trips/:id or use webhook

    res.status(201).json({
      id: trip.id,
      status: 'created',
      message: 'Trip created. Feasibility analysis will begin shortly.',
      trip: {
        id: trip.id,
        origin: trip.origin,
        destination: trip.destination,
        dates: trip.dates,
        groupSize: trip.groupSize,
        budget: trip.budget,
        currency: trip.currency,
        travelStyle: trip.travelStyle,
        feasibilityStatus: trip.feasibilityStatus,
        createdAt: trip.createdAt,
      },
      _links: {
        self: `/api/v1/trips/${trip.id}`,
        feasibility: `/api/v1/trips/${trip.id}/feasibility`,
        stream: `/api/v1/trips/${trip.id}/itinerary/stream`,
      },
    });
  } catch (error) {
    console.error('[API v1] Create trip error:', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to create trip',
    });
  }
});

/**
 * GET /api/v1/trips/:id
 * Get trip details
 */
router.get('/:id', requirePermission('read'), async (req: Request, res: Response) => {
  try {
    const tripId = parseInt(req.params.id, 10);

    if (isNaN(tripId)) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid trip ID',
      });
    }

    const trip = await storage.getTrip(tripId);

    if (!trip) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Trip not found',
      });
    }

    // Build response
    res.json({
      id: trip.id,
      origin: trip.origin,
      destination: trip.destination,
      passport: trip.passport,
      dates: trip.dates,
      groupSize: trip.groupSize,
      adults: trip.adults,
      children: trip.children,
      infants: trip.infants,
      budget: trip.budget,
      currency: trip.currency,
      travelStyle: trip.travelStyle,
      interests: trip.interests,

      // Status
      feasibilityStatus: trip.feasibilityStatus,

      // Feasibility report (if available)
      feasibility: trip.feasibilityReport ? {
        verdict: (trip.feasibilityReport as any).verdict,
        certaintyScore: (trip.feasibilityReport as any).certaintyScore,
        summary: (trip.feasibilityReport as any).summary,
        breakdown: (trip.feasibilityReport as any).breakdown,
      } : null,

      // Visa details (extracted from feasibility report)
      visa: (trip.feasibilityReport as any)?.visaDetails ? {
        type: (trip.feasibilityReport as any).visaDetails.type,
        timing: (trip.feasibilityReport as any).visaDetails.timing,
        processingDays: (trip.feasibilityReport as any).visaDetails.processingDays,
        cost: (trip.feasibilityReport as any).visaDetails.cost,
        documentsRequired: (trip.feasibilityReport as any).visaDetails.documentsRequired,
      } : null,

      // Cost breakdown (extracted from feasibility report)
      costs: (trip.feasibilityReport as any)?.trueCostBreakdown || null,

      // Itinerary (if available)
      itinerary: trip.itinerary ? {
        totalDays: (trip.itinerary as any).totalDays || (trip.itinerary as any).days?.length,
        days: (trip.itinerary as any).days,
      } : null,

      createdAt: trip.createdAt,
      updatedAt: trip.updatedAt,

      _links: {
        self: `/api/v1/trips/${trip.id}`,
        feasibility: `/api/v1/trips/${trip.id}/feasibility`,
        stream: `/api/v1/trips/${trip.id}/itinerary/stream`,
      },
    });
  } catch (error) {
    console.error('[API v1] Get trip error:', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to get trip',
    });
  }
});

/**
 * GET /api/v1/trips/:id/feasibility
 * Get detailed feasibility report
 */
router.get('/:id/feasibility', requirePermission('read'), async (req: Request, res: Response) => {
  try {
    const tripId = parseInt(req.params.id, 10);

    if (isNaN(tripId)) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid trip ID',
      });
    }

    const trip = await storage.getTrip(tripId);

    if (!trip) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Trip not found',
      });
    }

    // Check if feasibility analysis is complete
    if (trip.feasibilityStatus === 'pending') {
      return res.status(202).json({
        status: 'pending',
        message: 'Feasibility analysis is still in progress',
        estimatedCompletion: '10-30 seconds',
      });
    }

    const report = trip.feasibilityReport as any;

    res.json({
      tripId: trip.id,
      status: trip.feasibilityStatus,
      verdict: report?.verdict || 'unknown',
      certaintyScore: report?.certaintyScore || 0,
      summary: report?.summary,

      breakdown: {
        visa: {
          status: report?.breakdown?.visa?.status,
          score: report?.breakdown?.visa?.score,
          details: report?.visaDetails || null,
        },
        budget: {
          status: report?.breakdown?.budget?.status,
          score: report?.breakdown?.budget?.score,
          estimatedCost: report?.trueCostBreakdown || null,
        },
        safety: {
          status: report?.breakdown?.safety?.status,
          score: report?.breakdown?.safety?.score,
        },
        accessibility: {
          status: report?.breakdown?.accessibility?.status,
          score: report?.breakdown?.accessibility?.score,
        },
      },

      actionItems: report?.actionItems || [],

      _links: {
        trip: `/api/v1/trips/${trip.id}`,
        stream: `/api/v1/trips/${trip.id}/itinerary/stream`,
      },
    });
  } catch (error) {
    console.error('[API v1] Get feasibility error:', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to get feasibility report',
    });
  }
});

/**
 * GET /api/v1/trips/:id/itinerary/stream
 * Stream itinerary generation (SSE)
 * Note: This is a proxy to the existing streaming endpoint
 */
router.get('/:id/itinerary/stream', requirePermission('read'), async (req: Request, res: Response) => {
  // Forward to main streaming endpoint with API context
  // The main endpoint at /api/trips/:id/itinerary/stream handles SSE
  const tripId = req.params.id;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Redirect to main streaming endpoint
  // In production, you'd want to proxy the SSE stream
  res.write(`event: redirect\ndata: ${JSON.stringify({ url: `/api/trips/${tripId}/itinerary/stream` })}\n\n`);
  res.write(`event: info\ndata: ${JSON.stringify({ message: 'Use the main streaming endpoint for SSE: /api/trips/:id/itinerary/stream' })}\n\n`);
  res.end();
});

export default router;
