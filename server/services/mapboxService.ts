/**
 * Mapbox Service - Geocoding, Directions, and Map Token Management
 *
 * Design Principles:
 * 1. SERVER-SIDE ONLY - Never expose secret tokens to client
 * 2. SMART CACHING - Cache geocoding and directions results
 * 3. GRACEFUL FALLBACKS - Return null on failures, let callers handle
 * 4. RATE LIMITING - Respect Mapbox API limits
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const MAPBOX_ACCESS_TOKEN = process.env.MAPBOX_ACCESS_TOKEN || '';

// Cache durations (in milliseconds)
const CACHE_DURATION = {
  geocoding: 7 * 24 * 60 * 60 * 1000,  // 1 week - locations don't move
  directions: 24 * 60 * 60 * 1000,      // 1 day - routes relatively stable
};

// In-memory cache
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();

function getCached<T>(key: string, maxAge: number): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < maxAge) {
    console.log(`[Mapbox] Cache HIT: ${key.substring(0, 50)}...`);
    return entry.data;
  }
  return null;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
  console.log(`[Mapbox] Cache SET: ${key.substring(0, 50)}...`);
}

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

/**
 * Check if Mapbox is configured
 */
export function isMapboxConfigured(): boolean {
  return !!MAPBOX_ACCESS_TOKEN && MAPBOX_ACCESS_TOKEN.startsWith('pk.');
}

/**
 * Get the public token for client-side map tiles
 * Only returns token if it's a public token (starts with pk.)
 */
export function getPublicToken(): string | null {
  if (!MAPBOX_ACCESS_TOKEN) {
    console.warn('[Mapbox] No access token configured');
    return null;
  }
  if (!MAPBOX_ACCESS_TOKEN.startsWith('pk.')) {
    console.warn('[Mapbox] Token is not a public token (should start with pk.)');
    return null;
  }
  return MAPBOX_ACCESS_TOKEN;
}

// ============================================================================
// GEOCODING API
// ============================================================================

export interface GeocodeResult {
  id: string;
  name: string;
  fullAddress: string;
  country: string;
  countryCode: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  placeType: string;
}

export interface GeocodeOptions {
  types?: string[];  // 'place', 'locality', 'address', 'poi'
  limit?: number;
  proximity?: { lat: number; lng: number };
  language?: string;
}

/**
 * Forward geocoding - convert place name to coordinates
 */
export async function geocodePlace(
  query: string,
  options: GeocodeOptions = {}
): Promise<GeocodeResult[]> {
  if (!MAPBOX_ACCESS_TOKEN) {
    console.warn('[Mapbox] Geocoding skipped - no access token');
    return [];
  }

  const cacheKey = `geocode:${query}:${JSON.stringify(options)}`;
  const cached = getCached<GeocodeResult[]>(cacheKey, CACHE_DURATION.geocoding);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      q: query,
      access_token: MAPBOX_ACCESS_TOKEN,
      limit: String(options.limit || 5),
    });

    if (options.types?.length) {
      params.set('types', options.types.join(','));
    } else {
      // Default to cities and localities for destination search
      params.set('types', 'place,locality,region');
    }

    if (options.proximity) {
      params.set('proximity', `${options.proximity.lng},${options.proximity.lat}`);
    }

    if (options.language) {
      params.set('language', options.language);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(
      `https://api.mapbox.com/search/geocode/v6/forward?${params}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`[Mapbox] Geocoding failed: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();

    const results: GeocodeResult[] = (data.features || []).map((feature: any) => ({
      id: feature.id || feature.properties?.mapbox_id || '',
      name: feature.properties?.name || '',
      fullAddress: feature.properties?.full_address || feature.properties?.name || '',
      country: feature.properties?.context?.country?.name || '',
      countryCode: feature.properties?.context?.country?.country_code?.toUpperCase() || '',
      coordinates: {
        lng: feature.geometry?.coordinates?.[0] || 0,
        lat: feature.geometry?.coordinates?.[1] || 0,
      },
      placeType: feature.properties?.feature_type || 'unknown',
    }));

    setCache(cacheKey, results);
    console.log(`[Mapbox] Geocoded "${query}" → ${results.length} results`);
    return results;
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.error('[Mapbox] Geocoding timeout');
    } else {
      console.error('[Mapbox] Geocoding error:', error);
    }
    return [];
  }
}

/**
 * Reverse geocoding - convert coordinates to place name
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<GeocodeResult | null> {
  if (!MAPBOX_ACCESS_TOKEN) {
    return null;
  }

  const cacheKey = `reverse:${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = getCached<GeocodeResult>(cacheKey, CACHE_DURATION.geocoding);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      access_token: MAPBOX_ACCESS_TOKEN,
      types: 'place,locality,address',
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${lng}&latitude=${lat}&${params}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json();
    const feature = data.features?.[0];

    if (!feature) return null;

    const result: GeocodeResult = {
      id: feature.id || '',
      name: feature.properties?.name || '',
      fullAddress: feature.properties?.full_address || '',
      country: feature.properties?.context?.country?.name || '',
      countryCode: feature.properties?.context?.country?.country_code?.toUpperCase() || '',
      coordinates: { lat, lng },
      placeType: feature.properties?.feature_type || 'unknown',
    };

    setCache(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

// ============================================================================
// DIRECTIONS API
// ============================================================================

export interface DirectionsWaypoint {
  lat: number;
  lng: number;
}

export interface DirectionsRoute {
  geometry: {
    type: 'LineString';
    coordinates: [number, number][]; // [lng, lat] pairs
  };
  duration: number;  // seconds
  distance: number;  // meters
  legs: DirectionsLeg[];
}

export interface DirectionsLeg {
  duration: number;
  distance: number;
  summary: string;
}

export type DirectionsMode = 'walking' | 'cycling' | 'driving' | 'driving-traffic';

/**
 * Get directions between multiple waypoints
 */
export async function getDirections(
  waypoints: DirectionsWaypoint[],
  mode: DirectionsMode = 'walking'
): Promise<DirectionsRoute | null> {
  if (!MAPBOX_ACCESS_TOKEN) {
    console.warn('[Mapbox] Directions skipped - no access token');
    return null;
  }

  if (waypoints.length < 2) {
    console.warn('[Mapbox] Directions requires at least 2 waypoints');
    return null;
  }

  // Mapbox limit: 25 waypoints max
  if (waypoints.length > 25) {
    console.warn('[Mapbox] Truncating to 25 waypoints (Mapbox limit)');
    waypoints = waypoints.slice(0, 25);
  }

  const coordsKey = waypoints.map(w => `${w.lng.toFixed(4)},${w.lat.toFixed(4)}`).join('|');
  const cacheKey = `directions:${mode}:${coordsKey}`;
  const cached = getCached<DirectionsRoute>(cacheKey, CACHE_DURATION.directions);
  if (cached) return cached;

  try {
    const coordinates = waypoints.map(w => `${w.lng},${w.lat}`).join(';');

    const params = new URLSearchParams({
      access_token: MAPBOX_ACCESS_TOKEN,
      geometries: 'geojson',
      overview: 'full',
      steps: 'false',
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s for complex routes

    const response = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/${mode}/${coordinates}?${params}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`[Mapbox] Directions failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const route = data.routes?.[0];

    if (!route) {
      console.warn('[Mapbox] No route found');
      return null;
    }

    const result: DirectionsRoute = {
      geometry: route.geometry,
      duration: route.duration,
      distance: route.distance,
      legs: (route.legs || []).map((leg: any) => ({
        duration: leg.duration,
        distance: leg.distance,
        summary: leg.summary || '',
      })),
    };

    setCache(cacheKey, result);
    console.log(`[Mapbox] Directions: ${waypoints.length} waypoints, ${Math.round(result.distance / 1000)}km, ${Math.round(result.duration / 60)}min`);
    return result;
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.error('[Mapbox] Directions timeout');
    } else {
      console.error('[Mapbox] Directions error:', error);
    }
    return null;
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Format duration in human-readable format
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Format distance in human-readable format
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}
