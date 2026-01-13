/**
 * unsplashService.ts
 *
 * Dynamic destination image fetching using Unsplash API.
 * Fetches high-quality travel photos based on destination name.
 */

// In-memory cache for session performance (avoids redundant API calls)
const imageCache = new Map<string, { url: string; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface UnsplashPhoto {
  id: string;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  alt_description: string | null;
  description: string | null;
  user: {
    name: string;
    username: string;
  };
}

interface UnsplashSearchResponse {
  total: number;
  total_pages: number;
  results: UnsplashPhoto[];
}

/**
 * Extract city name from destination string.
 * "Hyderabad, India" -> "Hyderabad"
 * "San Francisco, USA" -> "San Francisco"
 */
function extractCityName(destination: string): string {
  // Split by comma and take first part (usually the city)
  const parts = destination.split(',');
  return parts[0].trim();
}

/**
 * Normalize destination for cache key.
 */
function getCacheKey(destination: string): string {
  return destination.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

/**
 * Check if cached entry is still valid.
 */
function isValidCache(entry: { url: string; timestamp: number }): boolean {
  return Date.now() - entry.timestamp < CACHE_TTL_MS;
}

/**
 * Fetch destination image from Unsplash API.
 * Returns optimized URL for hero/card backgrounds.
 *
 * @param destination - Full destination string (e.g., "Paris, France")
 * @param width - Desired image width (default 1600 for hero, 800 for cards)
 * @param height - Desired image height (default 900 for hero, 600 for cards)
 */
export async function fetchDestinationImage(
  destination: string,
  width: number = 1600,
  height: number = 900
): Promise<string | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;

  if (!accessKey) {
    console.warn('[Unsplash] No UNSPLASH_ACCESS_KEY configured');
    return null;
  }

  const cacheKey = getCacheKey(destination);

  // Check cache first
  const cached = imageCache.get(cacheKey);
  if (cached && isValidCache(cached)) {
    return cached.url;
  }

  try {
    // Extract city name for more accurate search
    const cityName = extractCityName(destination);

    // Search for travel/landmark photos of the destination
    const query = encodeURIComponent(`${cityName} city landmark travel`);
    const url = `https://api.unsplash.com/search/photos?query=${query}&per_page=1&orientation=landscape&content_filter=high`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Client-ID ${accessKey}`,
        'Accept-Version': 'v1',
      },
    });

    if (!response.ok) {
      console.error('[Unsplash] API error:', response.status, response.statusText);
      return null;
    }

    const data: UnsplashSearchResponse = await response.json();

    if (data.results.length === 0) {
      console.debug('[Unsplash] No results for:', destination);
      // Try broader search with just the city name
      return fetchFallbackImage(cityName, accessKey, width, height);
    }

    const photo = data.results[0];

    // Use raw URL with custom dimensions for optimal loading
    // Format: {raw_url}&w={width}&h={height}&fit=crop&q=80
    const optimizedUrl = `${photo.urls.raw}&w=${width}&h=${height}&fit=crop&q=80`;

    // Cache the result
    imageCache.set(cacheKey, { url: optimizedUrl, timestamp: Date.now() });

    console.debug(`[Unsplash] Found image for ${destination}: ${photo.alt_description || 'travel photo'}`);

    return optimizedUrl;
  } catch (error) {
    console.error('[Unsplash] Fetch error:', error);
    return null;
  }
}

/**
 * Fallback search with simpler query if initial search fails.
 */
async function fetchFallbackImage(
  cityName: string,
  accessKey: string,
  width: number,
  height: number
): Promise<string | null> {
  try {
    // Try simpler query
    const query = encodeURIComponent(`${cityName} travel`);
    const url = `https://api.unsplash.com/search/photos?query=${query}&per_page=1&orientation=landscape`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Client-ID ${accessKey}`,
        'Accept-Version': 'v1',
      },
    });

    if (!response.ok) return null;

    const data: UnsplashSearchResponse = await response.json();

    if (data.results.length === 0) {
      console.debug('[Unsplash] No fallback results for:', cityName);
      return null;
    }

    const photo = data.results[0];
    const optimizedUrl = `${photo.urls.raw}&w=${width}&h=${height}&fit=crop&q=80`;

    // Cache the fallback result too
    const cacheKey = getCacheKey(cityName);
    imageCache.set(cacheKey, { url: optimizedUrl, timestamp: Date.now() });

    return optimizedUrl;
  } catch {
    return null;
  }
}

/**
 * Get destination image with fallback to static images.
 * This is the main function to use - handles API, cache, and fallbacks.
 */
export async function getDestinationImageUrl(
  destination: string,
  width: number = 1600,
  height: number = 900
): Promise<string | null> {
  // First try the API
  const apiImage = await fetchDestinationImage(destination, width, height);
  if (apiImage) return apiImage;

  // Fallback to static images for common destinations
  const staticImage = getStaticDestinationImage(destination);
  if (staticImage) return staticImage;

  return null;
}

/**
 * Static fallback images for when API fails.
 * Only includes major cities to keep the list manageable.
 */
const STATIC_FALLBACKS: Record<string, string> = {
  // Major cities - these are the most reliable fallbacks
  'paris': 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1600&h=900&fit=crop',
  'london': 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1600&h=900&fit=crop',
  'tokyo': 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1600&h=900&fit=crop',
  'new york': 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1600&h=900&fit=crop',
  'dubai': 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1600&h=900&fit=crop',
  'singapore': 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=1600&h=900&fit=crop',
  'sydney': 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=1600&h=900&fit=crop',
  'rome': 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=1600&h=900&fit=crop',
  'barcelona': 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=1600&h=900&fit=crop',
  'bangkok': 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=1600&h=900&fit=crop',
  'bali': 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1600&h=900&fit=crop',
  'maldives': 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=1600&h=900&fit=crop',
};

function getStaticDestinationImage(destination: string): string | null {
  const lower = destination.toLowerCase();

  for (const [key, url] of Object.entries(STATIC_FALLBACKS)) {
    if (lower.includes(key)) {
      return url;
    }
  }

  return null;
}

/**
 * Clear the in-memory cache (useful for testing).
 */
export function clearImageCache(): void {
  imageCache.clear();
}
