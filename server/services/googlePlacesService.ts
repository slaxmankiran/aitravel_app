/**
 * Google Places API Service
 * Fetches real opening hours, ratings, and place details for attractions
 */

import { BoundedMap } from '../utils/boundedMap';

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// Cache for place details (bounded to prevent memory leaks)
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const placeCache = new BoundedMap<string, { data: PlaceDetails; timestamp: number }>({ maxSize: 500, ttlMs: CACHE_TTL_MS });

export interface PlaceDetails {
  placeId: string;
  name: string;
  formattedAddress?: string;
  location?: {
    lat: number;
    lng: number;
  };
  openingHours?: {
    isOpen: boolean;
    weekdayText: string[];
    periods?: Array<{
      open: { day: number; time: string };
      close?: { day: number; time: string };
    }>;
  };
  rating?: number;
  userRatingsTotal?: number;
  priceLevel?: number; // 0-4
  types?: string[];
  photos?: Array<{
    photoReference: string;
    height: number;
    width: number;
  }>;
  website?: string;
  phoneNumber?: string;
  url?: string; // Google Maps URL
}

export interface PlaceSearchResult {
  placeId: string;
  name: string;
  formattedAddress?: string;
  location: {
    lat: number;
    lng: number;
  };
  rating?: number;
  types?: string[];
}

/**
 * Check if Google Places API is configured
 */
export function isGooglePlacesConfigured(): boolean {
  return !!GOOGLE_PLACES_API_KEY;
}

/**
 * Search for places by text query
 */
export async function searchPlaces(
  query: string,
  options?: {
    location?: { lat: number; lng: number };
    radius?: number; // meters
    type?: string; // e.g., 'tourist_attraction', 'restaurant', 'museum'
  }
): Promise<PlaceSearchResult[]> {
  if (!GOOGLE_PLACES_API_KEY) {
    console.warn('[GooglePlaces] API key not configured');
    return [];
  }

  try {
    const params = new URLSearchParams({
      query,
      key: GOOGLE_PLACES_API_KEY,
    });

    if (options?.location) {
      params.append('location', `${options.location.lat},${options.location.lng}`);
    }
    if (options?.radius) {
      params.append('radius', options.radius.toString());
    }
    if (options?.type) {
      params.append('type', options.type);
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`
    );

    if (!response.ok) {
      console.error('[GooglePlaces] Search failed:', response.status);
      return [];
    }

    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('[GooglePlaces] API error:', data.status, data.error_message);
      return [];
    }

    return (data.results || []).map((place: any) => ({
      placeId: place.place_id,
      name: place.name,
      formattedAddress: place.formatted_address,
      location: {
        lat: place.geometry?.location?.lat,
        lng: place.geometry?.location?.lng,
      },
      rating: place.rating,
      types: place.types,
    }));
  } catch (error) {
    console.error('[GooglePlaces] Search error:', error);
    return [];
  }
}

/**
 * Get detailed information about a place by place ID
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  if (!GOOGLE_PLACES_API_KEY) {
    console.warn('[GooglePlaces] API key not configured');
    return null;
  }

  // Check cache
  const cached = placeCache.get(placeId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const fields = [
      'place_id',
      'name',
      'formatted_address',
      'geometry',
      'opening_hours',
      'rating',
      'user_ratings_total',
      'price_level',
      'types',
      'photos',
      'website',
      'formatted_phone_number',
      'url',
    ].join(',');

    const params = new URLSearchParams({
      place_id: placeId,
      fields,
      key: GOOGLE_PLACES_API_KEY,
    });

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params}`
    );

    if (!response.ok) {
      console.error('[GooglePlaces] Details fetch failed:', response.status);
      return null;
    }

    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('[GooglePlaces] API error:', data.status, data.error_message);
      return null;
    }

    const place = data.result;
    const details: PlaceDetails = {
      placeId: place.place_id,
      name: place.name,
      formattedAddress: place.formatted_address,
      location: place.geometry?.location
        ? {
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng,
          }
        : undefined,
      openingHours: place.opening_hours
        ? {
            isOpen: place.opening_hours.open_now ?? false,
            weekdayText: place.opening_hours.weekday_text || [],
            periods: place.opening_hours.periods,
          }
        : undefined,
      rating: place.rating,
      userRatingsTotal: place.user_ratings_total,
      priceLevel: place.price_level,
      types: place.types,
      photos: place.photos?.slice(0, 3).map((photo: any) => ({
        photoReference: photo.photo_reference,
        height: photo.height,
        width: photo.width,
      })),
      website: place.website,
      phoneNumber: place.formatted_phone_number,
      url: place.url,
    };

    // Cache the result
    placeCache.set(placeId, { data: details, timestamp: Date.now() });

    return details;
  } catch (error) {
    console.error('[GooglePlaces] Details error:', error);
    return null;
  }
}

/**
 * Search for a place and get its details in one call
 */
export async function findPlaceWithDetails(
  query: string,
  location?: { lat: number; lng: number }
): Promise<PlaceDetails | null> {
  // First, search for the place
  const results = await searchPlaces(query, {
    location,
    radius: location ? 5000 : undefined, // 5km radius if location provided
  });

  if (results.length === 0) {
    return null;
  }

  // Get details for the first (best) match
  return getPlaceDetails(results[0].placeId);
}

/**
 * Get opening hours for a specific day
 */
export function getOpeningHoursForDay(
  openingHours: PlaceDetails['openingHours'],
  dayIndex: number // 0 = Sunday, 1 = Monday, etc.
): { open: string; close: string } | null {
  if (!openingHours?.periods) {
    return null;
  }

  const period = openingHours.periods.find((p) => p.open.day === dayIndex);
  if (!period) {
    return null; // Closed on this day
  }

  return {
    open: formatTime(period.open.time),
    close: period.close ? formatTime(period.close.time) : '24:00',
  };
}

/**
 * Format time from HHMM to HH:MM
 */
function formatTime(time: string): string {
  if (time.length !== 4) return time;
  return `${time.slice(0, 2)}:${time.slice(2)}`;
}

/**
 * Enrich an activity with real place data
 */
export async function enrichActivityWithPlaceData(
  activityName: string,
  destination: string,
  coordinates?: { lat: number; lng: number }
): Promise<{
  placeId?: string;
  openingHours?: PlaceDetails['openingHours'];
  rating?: number;
  priceLevel?: number;
  googleMapsUrl?: string;
} | null> {
  const query = `${activityName} ${destination}`;
  const details = await findPlaceWithDetails(query, coordinates);

  if (!details) {
    return null;
  }

  return {
    placeId: details.placeId,
    openingHours: details.openingHours,
    rating: details.rating,
    priceLevel: details.priceLevel,
    googleMapsUrl: details.url,
  };
}

/**
 * Batch enrich multiple activities (with rate limiting)
 */
export async function enrichActivitiesBatch(
  activities: Array<{
    name: string;
    destination: string;
    coordinates?: { lat: number; lng: number };
  }>,
  options?: {
    maxConcurrent?: number;
    delayMs?: number;
  }
): Promise<Map<string, Awaited<ReturnType<typeof enrichActivityWithPlaceData>>>> {
  const maxConcurrent = options?.maxConcurrent || 3;
  const delayMs = options?.delayMs || 200;

  const results = new Map<string, Awaited<ReturnType<typeof enrichActivityWithPlaceData>>>();
  const queue = [...activities];

  async function processOne() {
    const activity = queue.shift();
    if (!activity) return;

    const key = `${activity.name}-${activity.destination}`;
    const result = await enrichActivityWithPlaceData(
      activity.name,
      activity.destination,
      activity.coordinates
    );
    results.set(key, result);

    // Rate limiting delay
    if (queue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // Process in batches
  while (queue.length > 0) {
    const batch = Math.min(maxConcurrent, queue.length);
    await Promise.all(Array(batch).fill(null).map(() => processOne()));
  }

  return results;
}

/**
 * Get a photo URL for a place
 */
export function getPlacePhotoUrl(
  photoReference: string,
  maxWidth: number = 400
): string | null {
  if (!GOOGLE_PLACES_API_KEY) {
    return null;
  }

  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`;
}

/**
 * Clear the cache (for testing/maintenance)
 */
export function clearPlaceCache(): void {
  placeCache.clear();
}

/**
 * Get cache stats
 */
export function getPlaceCacheStats(): { size: number; oldestMs: number | null } {
  let oldest: number | null = null;

  const entries = Array.from(placeCache.values());
  for (const entry of entries) {
    if (oldest === null || entry.timestamp < oldest) {
      oldest = entry.timestamp;
    }
  }

  return {
    size: placeCache.size,
    oldestMs: oldest ? Date.now() - oldest : null,
  };
}
