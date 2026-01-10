/**
 * destinationImages.ts
 *
 * Destination hero image utility with localStorage caching.
 * Uses Unsplash Source API for high-quality destination photos.
 *
 * Cache Strategy:
 * - localStorage keyed by `destImage:${normalizedDestination}`
 * - 7-day TTL
 * - In-memory cache for session performance
 */

// ============================================================================
// TYPES
// ============================================================================

interface CachedImage {
  url: string;
  timestamp: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_PREFIX = 'destImage:';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// In-memory cache for session performance
const memoryCache = new Map<string, string>();

// Fallback gradients for when images fail to load
const FALLBACK_GRADIENTS: Record<string, string> = {
  beach: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 50%, #0369a1 100%)',
  mountain: 'linear-gradient(135deg, #64748b 0%, #475569 50%, #334155 100%)',
  city: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #4338ca 100%)',
  default: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #020617 100%)',
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Normalize destination for consistent cache keys.
 */
function normalizeDestination(destination: string): string {
  return destination
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 50);
}

/**
 * Generate cache key for a destination.
 */
function getCacheKey(destination: string): string {
  return `${CACHE_PREFIX}${normalizeDestination(destination)}`;
}

/**
 * Check if cached entry is still valid.
 */
function isValidCache(entry: CachedImage): boolean {
  return Date.now() - entry.timestamp < CACHE_TTL_MS;
}

/**
 * Detect destination type for fallback gradient and motion accents.
 * Exported for use by ResultsBackground for destination-aware effects.
 */
export function getDestinationType(destination: string): 'beach' | 'mountain' | 'city' | 'default' {
  const lower = destination.toLowerCase();

  const beachKeywords = ['beach', 'island', 'maldives', 'bali', 'caribbean', 'hawaii', 'phuket', 'cancun', 'miami'];
  const mountainKeywords = ['mountain', 'alps', 'himalaya', 'swiss', 'colorado', 'nepal', 'patagonia'];
  const cityKeywords = ['city', 'new york', 'tokyo', 'london', 'paris', 'sydney', 'singapore', 'dubai', 'hong kong'];

  if (beachKeywords.some(k => lower.includes(k))) return 'beach';
  if (mountainKeywords.some(k => lower.includes(k))) return 'mountain';
  if (cityKeywords.some(k => lower.includes(k))) return 'city';

  return 'default';
}

// ============================================================================
// CACHE OPERATIONS
// ============================================================================

/**
 * Get image URL from cache (memory or localStorage).
 */
function getFromCache(key: string): string | null {
  // Check memory cache first
  if (memoryCache.has(key)) {
    return memoryCache.get(key)!;
  }

  // Check localStorage
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const entry: CachedImage = JSON.parse(stored);
      if (isValidCache(entry)) {
        memoryCache.set(key, entry.url);
        return entry.url;
      } else {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // localStorage unavailable or parse error
  }

  return null;
}

/**
 * Save image URL to cache.
 */
function saveToCache(key: string, url: string): void {
  memoryCache.set(key, url);

  try {
    const entry: CachedImage = { url, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable
  }
}

// ============================================================================
// IMAGE FETCHING
// ============================================================================

/**
 * Build Unsplash Source URL for a destination.
 * Uses larger dimensions for hero images.
 */
function buildUnsplashUrl(destination: string): string {
  // Extract city/country name, remove common suffixes
  const cleanDest = destination
    .replace(/,\s*(australia|usa|uk|france|japan|italy|spain|germany|thailand|indonesia|india)/i, '')
    .trim();

  const query = encodeURIComponent(`${cleanDest} travel landmark`);
  return `https://source.unsplash.com/1600x900/?${query}`;
}

/**
 * Get destination image URL with caching.
 *
 * @param destination - Trip destination (e.g., "Sydney, Australia")
 * @returns Object with url (or null), fallbackGradient, and loading state
 */
export function getDestinationImageUrl(destination: string): {
  url: string | null;
  fallbackGradient: string;
  isLoading: boolean;
} {
  const cacheKey = getCacheKey(destination);
  const cachedUrl = getFromCache(cacheKey);
  const destType = getDestinationType(destination);

  return {
    url: cachedUrl,
    fallbackGradient: FALLBACK_GRADIENTS[destType],
    isLoading: !cachedUrl,
  };
}

/**
 * Fetch and cache destination image asynchronously.
 *
 * @returns Promise resolving to the image URL or null
 */
export async function fetchDestinationImage(destination: string): Promise<string | null> {
  const cacheKey = getCacheKey(destination);

  // Check cache first
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  try {
    const unsplashUrl = buildUnsplashUrl(destination);

    // Use HEAD request to get the final redirected URL
    const response = await fetch(unsplashUrl, {
      method: 'HEAD',
      redirect: 'follow',
    });

    if (response.ok && response.url && !response.url.includes('source.unsplash.com')) {
      // Got a real image URL
      saveToCache(cacheKey, response.url);
      return response.url;
    }
  } catch (error) {
    console.debug('[DestinationImages] Fetch failed:', destination, error);
  }

  return null;
}

/**
 * Get fallback gradient for a destination.
 */
export function getDestinationFallbackGradient(destination: string): string {
  const destType = getDestinationType(destination);
  return FALLBACK_GRADIENTS[destType];
}
