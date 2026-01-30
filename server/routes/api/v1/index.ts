/**
 * VoyageAI B2B API v1
 * RESTful API for travel partners and agencies
 */

import { Router, type Request, type Response } from 'express';
import { verifyApiKey, requirePermission, requireTier } from '../../../middleware/apiAuth';
import tripsRouter from './trips';
import feasibilityRouter from './feasibility';
import visaRouter from './visa';

const router = Router();

// Apply API key authentication to all v1 routes
router.use(verifyApiKey);

// Mount sub-routers
router.use('/trips', tripsRouter);
router.use('/feasibility', feasibilityRouter);
router.use('/visa', visaRouter);

/**
 * GET /api/v1
 * API info and capabilities
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'VoyageAI API',
    version: 'v1',
    documentation: 'https://docs.voyageai.com/api/v1',
    endpoints: {
      trips: {
        'POST /trips': 'Create a new trip',
        'GET /trips/:id': 'Get trip details',
        'GET /trips/:id/feasibility': 'Get feasibility report',
        'GET /trips/:id/itinerary/stream': 'Stream itinerary generation (SSE)',
      },
      feasibility: {
        'POST /feasibility/check': 'Quick feasibility check without creating a trip',
      },
      visa: {
        'GET /visa/lookup': 'Get visa requirements',
      },
    },
    tier: req.apiKey?.tier || 'unknown',
    rateLimit: {
      limit: req.apiKey?.rateLimit || 0,
      used: req.apiKey?.usageCount || 0,
      remaining: (req.apiKey?.rateLimit || 0) - (req.apiKey?.usageCount || 0),
    },
  });
});

/**
 * GET /api/v1/health
 * API health check
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    apiVersion: 'v1',
  });
});

export default router;
