/**
 * Google Places API Routes
 * Provides place search and details endpoints for enriching itinerary activities
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  isGooglePlacesConfigured,
  searchPlaces,
  getPlaceDetails,
  findPlaceWithDetails,
  getPlacePhotoUrl,
  getPlaceCacheStats,
  clearPlaceCache,
  type PlaceDetails,
  type PlaceSearchResult,
} from '../services/googlePlacesService';

const router = Router();

// Validation schemas
const searchSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radius: z.coerce.number().positive().optional(),
  type: z.string().optional(),
});

const detailsSchema = z.object({
  placeId: z.string().min(1, 'Place ID is required'),
});

const enrichSchema = z.object({
  activityName: z.string().min(1, 'Activity name is required'),
  destination: z.string().min(1, 'Destination is required'),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
});

/**
 * GET /api/places/status
 * Check if Google Places API is configured
 */
router.get('/status', (req: Request, res: Response) => {
  const configured = isGooglePlacesConfigured();
  const cacheStats = getPlaceCacheStats();

  res.json({
    configured,
    message: configured
      ? 'Google Places API is configured and ready'
      : 'Google Places API key not configured. Set GOOGLE_PLACES_API_KEY environment variable.',
    cache: {
      entries: cacheStats.size,
      oldestAgeMs: cacheStats.oldestMs,
    },
  });
});

/**
 * GET /api/places/search
 * Search for places by text query
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const validation = searchSchema.safeParse(req.query);

    if (!validation.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid query parameters',
        details: validation.error.errors,
      });
    }

    const { query, lat, lng, radius, type } = validation.data;

    if (!isGooglePlacesConfigured()) {
      return res.status(503).json({
        error: 'service_unavailable',
        message: 'Google Places API is not configured',
      });
    }

    const results = await searchPlaces(query, {
      location: lat !== undefined && lng !== undefined ? { lat, lng } : undefined,
      radius,
      type,
    });

    res.json({
      query,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error('[Places] Search error:', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to search places',
    });
  }
});

/**
 * GET /api/places/details/:placeId
 * Get detailed information about a place
 */
router.get('/details/:placeId', async (req: Request, res: Response) => {
  try {
    const { placeId } = req.params;

    if (!placeId) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Place ID is required',
      });
    }

    if (!isGooglePlacesConfigured()) {
      return res.status(503).json({
        error: 'service_unavailable',
        message: 'Google Places API is not configured',
      });
    }

    const details = await getPlaceDetails(placeId);

    if (!details) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Place not found',
      });
    }

    res.json(details);
  } catch (error) {
    console.error('[Places] Details error:', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to get place details',
    });
  }
});

/**
 * POST /api/places/enrich
 * Enrich an activity with real place data (opening hours, rating, etc.)
 */
router.post('/enrich', async (req: Request, res: Response) => {
  try {
    const validation = enrichSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid request body',
        details: validation.error.errors,
      });
    }

    const { activityName, destination, lat, lng } = validation.data;

    if (!isGooglePlacesConfigured()) {
      // Return graceful fallback when not configured
      return res.json({
        enriched: false,
        message: 'Google Places API not configured, returning original activity',
        activity: {
          name: activityName,
          destination,
        },
      });
    }

    const query = `${activityName} ${destination}`;
    const details = await findPlaceWithDetails(
      query,
      lat !== undefined && lng !== undefined ? { lat, lng } : undefined
    );

    if (!details) {
      return res.json({
        enriched: false,
        message: 'No matching place found',
        activity: {
          name: activityName,
          destination,
        },
      });
    }

    res.json({
      enriched: true,
      activity: {
        name: activityName,
        destination,
        placeId: details.placeId,
        formattedAddress: details.formattedAddress,
        location: details.location,
        openingHours: details.openingHours,
        rating: details.rating,
        userRatingsTotal: details.userRatingsTotal,
        priceLevel: details.priceLevel,
        googleMapsUrl: details.url,
        website: details.website,
        phoneNumber: details.phoneNumber,
      },
    });
  } catch (error) {
    console.error('[Places] Enrich error:', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to enrich activity',
    });
  }
});

/**
 * GET /api/places/photo
 * Get a place photo URL (proxied to avoid exposing API key)
 */
router.get('/photo', async (req: Request, res: Response) => {
  try {
    const photoReference = req.query.ref as string;
    const maxWidth = parseInt(req.query.maxWidth as string, 10) || 400;

    if (!photoReference) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Photo reference (ref) is required',
      });
    }

    if (!isGooglePlacesConfigured()) {
      return res.status(503).json({
        error: 'service_unavailable',
        message: 'Google Places API is not configured',
      });
    }

    const photoUrl = getPlacePhotoUrl(photoReference, maxWidth);

    if (!photoUrl) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Could not generate photo URL',
      });
    }

    // Redirect to the actual photo URL
    res.redirect(photoUrl);
  } catch (error) {
    console.error('[Places] Photo error:', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to get photo',
    });
  }
});

/**
 * POST /api/places/cache/clear
 * Clear the place cache (admin only)
 */
router.post('/cache/clear', async (req: Request, res: Response) => {
  // Check for admin token in production
  if (process.env.NODE_ENV === 'production') {
    const adminToken = req.headers['x-admin-token'];
    if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Admin token required',
      });
    }
  }

  const statsBefore = getPlaceCacheStats();
  clearPlaceCache();
  const statsAfter = getPlaceCacheStats();

  res.json({
    success: true,
    message: 'Cache cleared',
    before: { entries: statsBefore.size },
    after: { entries: statsAfter.size },
  });
});

export default router;
