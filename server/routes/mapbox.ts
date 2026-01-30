/**
 * Mapbox Routes - Proxy endpoints for Mapbox APIs
 *
 * Keeps API tokens server-side while providing:
 * - Public token for client map tiles
 * - Geocoding for destination search
 * - Directions for walking routes
 *
 * Rate limits:
 * - Token: 100/min per IP (cached, cheap)
 * - Geocoding: 60/min per IP
 * - Directions: 30/min per IP
 */

import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  getPublicToken,
  isMapboxConfigured,
  geocodePlace,
  reverseGeocode,
  getDirections,
  getWalkingTime,
  getWalkingTimesBetweenActivities,
  getDayWalkingRoute,
  getCacheStats,
  clearCache,
  formatDuration,
  formatDistance,
  type GeocodeOptions,
  type DirectionsMode,
} from "../services/mapboxService";

export const mapboxRouter = Router();

// ============================================================================
// RATE LIMITERS
// ============================================================================

/** Helper to get client IP */
function getClientIP(req: any): string {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

/** Token endpoint - very permissive since it's just returning a cached value */
const tokenRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: "Too many token requests", retryAfter: 60 },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req),
});

/** Geocoding - moderate limits */
const geocodingRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: "Too many geocoding requests. Please wait.", retryAfter: 60 },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req),
});

/** Directions - more restrictive (more expensive API call) */
const directionsRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Too many directions requests. Please wait.", retryAfter: 60 },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req),
});

// ============================================================================
// STATUS ENDPOINT
// ============================================================================

/**
 * GET /api/mapbox/status
 *
 * Check if Mapbox is configured and available
 */
mapboxRouter.get("/status", (req, res) => {
  const configured = isMapboxConfigured();
  res.json({
    configured,
    features: configured
      ? ["tiles", "geocoding", "directions"]
      : [],
  });
});

// ============================================================================
// TOKEN ENDPOINT
// ============================================================================

/**
 * GET /api/mapbox/token
 *
 * Returns the public Mapbox token for client-side map rendering.
 * Only returns public tokens (pk.xxx), never secret tokens.
 */
mapboxRouter.get("/token", tokenRateLimiter, (req, res) => {
  const token = getPublicToken();

  if (!token) {
    return res.status(503).json({
      error: "Mapbox not configured",
      message: "Map features are temporarily unavailable",
    });
  }

  res.json({ token });
});

// ============================================================================
// GEOCODING ENDPOINTS
// ============================================================================

/**
 * GET /api/mapbox/geocode
 *
 * Forward geocoding - convert place name to coordinates
 * Query params:
 * - q: search query (required)
 * - types: comma-separated place types (optional, default: place,locality,region)
 * - limit: max results (optional, default: 5)
 * - proximity: lat,lng for biasing results (optional)
 */
mapboxRouter.get("/geocode", geocodingRateLimiter, async (req, res) => {
  try {
    const { q, types, limit, proximity, language } = req.query;

    if (!q || typeof q !== "string") {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    if (q.length < 2) {
      return res.status(400).json({ error: "Query must be at least 2 characters" });
    }

    const options: GeocodeOptions = {};

    if (types && typeof types === "string") {
      options.types = types.split(",").map((t) => t.trim());
    }

    if (limit) {
      const parsed = parseInt(limit as string, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 10) {
        options.limit = parsed;
      }
    }

    if (proximity && typeof proximity === "string") {
      const [lat, lng] = proximity.split(",").map(Number);
      if (!isNaN(lat) && !isNaN(lng)) {
        options.proximity = { lat, lng };
      }
    }

    if (language && typeof language === "string") {
      options.language = language;
    }

    const results = await geocodePlace(q, options);

    res.json({
      query: q,
      features: results,
      count: results.length,
    });
  } catch (error) {
    console.error("[Mapbox] Geocode endpoint error:", error);
    res.status(500).json({ error: "Geocoding failed" });
  }
});

/**
 * GET /api/mapbox/reverse
 *
 * Reverse geocoding - convert coordinates to place name
 * Query params:
 * - lat: latitude (required)
 * - lng: longitude (required)
 */
mapboxRouter.get("/reverse", geocodingRateLimiter, async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: "lat and lng are required" });
    }

    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lng as string);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: "Invalid lat/lng values" });
    }

    const result = await reverseGeocode(latitude, longitude);

    if (!result) {
      return res.status(404).json({ error: "No results found" });
    }

    res.json(result);
  } catch (error) {
    console.error("[Mapbox] Reverse geocode endpoint error:", error);
    res.status(500).json({ error: "Reverse geocoding failed" });
  }
});

// ============================================================================
// DIRECTIONS ENDPOINT
// ============================================================================

/**
 * POST /api/mapbox/directions
 *
 * Get directions between multiple waypoints
 * Body:
 * - waypoints: Array of { lat, lng } (required, 2-25 points)
 * - mode: 'walking' | 'cycling' | 'driving' | 'driving-traffic' (optional, default: walking)
 */
mapboxRouter.post("/directions", directionsRateLimiter, async (req, res) => {
  try {
    const { waypoints, mode = "walking" } = req.body;

    if (!waypoints || !Array.isArray(waypoints)) {
      return res.status(400).json({ error: "waypoints array is required" });
    }

    if (waypoints.length < 2) {
      return res.status(400).json({ error: "At least 2 waypoints required" });
    }

    if (waypoints.length > 25) {
      return res.status(400).json({ error: "Maximum 25 waypoints allowed" });
    }

    // Validate waypoints
    const validWaypoints = waypoints.map((wp: any, i: number) => {
      if (typeof wp.lat !== "number" || typeof wp.lng !== "number") {
        throw new Error(`Invalid waypoint at index ${i}`);
      }
      return { lat: wp.lat, lng: wp.lng };
    });

    // Validate mode
    const validModes = ["walking", "cycling", "driving", "driving-traffic"];
    if (!validModes.includes(mode)) {
      return res.status(400).json({
        error: `Invalid mode. Must be one of: ${validModes.join(", ")}`,
      });
    }

    const route = await getDirections(validWaypoints, mode as DirectionsMode);

    if (!route) {
      return res.status(404).json({
        error: "No route found",
        message: "Could not find a route between the specified waypoints",
      });
    }

    res.json({
      mode,
      waypointCount: validWaypoints.length,
      route: {
        ...route,
        durationFormatted: formatDuration(route.duration),
        distanceFormatted: formatDistance(route.distance),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Invalid waypoint")) {
      return res.status(400).json({ error: error.message });
    }
    console.error("[Mapbox] Directions endpoint error:", error);
    res.status(500).json({ error: "Directions request failed" });
  }
});

// ============================================================================
// WALKING TIMES FOR ITINERARIES
// ============================================================================

/**
 * POST /api/mapbox/walking-times
 *
 * Get walking times between consecutive activity locations
 * Optimized for itinerary display - returns formatted times for each pair
 *
 * Body:
 * - activities: Array of { coordinates: { lat, lng } } (required, 2+ items)
 */
mapboxRouter.post("/walking-times", directionsRateLimiter, async (req, res) => {
  try {
    const { activities } = req.body;

    if (!activities || !Array.isArray(activities)) {
      return res.status(400).json({ error: "activities array is required" });
    }

    if (activities.length < 2) {
      return res.status(400).json({ error: "At least 2 activities required" });
    }

    // Get walking times between each consecutive pair
    const results = await getWalkingTimesBetweenActivities(activities);

    // Format response with activity indices
    const walkingTimes = results.map((result, index) => {
      if (!result) {
        return {
          fromIndex: index,
          toIndex: index + 1,
          available: false,
        };
      }

      return {
        fromIndex: index,
        toIndex: index + 1,
        available: true,
        distanceMeters: result.distanceMeters,
        durationSeconds: result.durationSeconds,
        walkable: result.walkable,
        formattedDistance: result.formattedDistance,
        formattedDuration: result.formattedDuration,
      };
    });

    res.json({
      activityCount: activities.length,
      segments: walkingTimes.length,
      walkingTimes,
    });
  } catch (error) {
    console.error("[Mapbox] Walking times endpoint error:", error);
    res.status(500).json({ error: "Walking times request failed" });
  }
});

/**
 * POST /api/mapbox/day-route
 *
 * Get optimized walking route for entire day's activities
 * Returns a single route through all locations
 *
 * Body:
 * - activities: Array of { coordinates: { lat, lng } } (required, 2+ items)
 */
mapboxRouter.post("/day-route", directionsRateLimiter, async (req, res) => {
  try {
    const { activities } = req.body;

    if (!activities || !Array.isArray(activities)) {
      return res.status(400).json({ error: "activities array is required" });
    }

    if (activities.length < 2) {
      return res.status(400).json({ error: "At least 2 activities required" });
    }

    const route = await getDayWalkingRoute(activities);

    if (!route) {
      return res.status(404).json({
        error: "No route found",
        message: "Could not find a walking route through all activities",
      });
    }

    res.json({
      activityCount: activities.length,
      route: {
        ...route,
        durationFormatted: formatDuration(route.duration),
        distanceFormatted: formatDistance(route.distance),
      },
    });
  } catch (error) {
    console.error("[Mapbox] Day route endpoint error:", error);
    res.status(500).json({ error: "Day route request failed" });
  }
});

// ============================================================================
// CACHE MANAGEMENT (Admin)
// ============================================================================

/**
 * GET /api/mapbox/cache/stats
 *
 * Get cache statistics (admin only in production)
 */
mapboxRouter.get("/cache/stats", (req, res) => {
  // Check for admin token in production
  if (process.env.NODE_ENV === "production") {
    const adminToken = req.headers["x-admin-token"];
    if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const stats = getCacheStats();
  res.json(stats);
});

/**
 * POST /api/mapbox/cache/clear
 *
 * Clear cache (admin only)
 */
mapboxRouter.post("/cache/clear", (req, res) => {
  // Check for admin token in production
  if (process.env.NODE_ENV === "production") {
    const adminToken = req.headers["x-admin-token"];
    if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  clearCache();
  res.json({ success: true, message: "Cache cleared" });
});
