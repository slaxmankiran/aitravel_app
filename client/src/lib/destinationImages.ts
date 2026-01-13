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

// Static destination images from Unsplash (direct URLs that work reliably)
// Using high-quality landscape photos optimized for hero backgrounds
const STATIC_DESTINATION_IMAGES: Record<string, string> = {
  // Australia & Oceania
  'sydney': 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=1600&h=900&fit=crop',
  'melbourne': 'https://images.unsplash.com/photo-1514395462725-fb4566210144?w=1600&h=900&fit=crop',
  'brisbane': 'https://images.unsplash.com/photo-1566734904496-9309bb1798ae?w=1600&h=900&fit=crop',
  'perth': 'https://images.unsplash.com/photo-1573935448851-4e6c5d8f5c5e?w=1600&h=900&fit=crop',
  'hobart': 'https://images.unsplash.com/photo-1555424221-250de2a343ad?w=1600&h=900&fit=crop',
  'adelaide': 'https://images.unsplash.com/photo-1596178065701-9c8e68caa6f1?w=1600&h=900&fit=crop',
  'cairns': 'https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?w=1600&h=900&fit=crop',
  'gold coast': 'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=1600&h=900&fit=crop',
  'tasmania': 'https://images.unsplash.com/photo-1555424221-250de2a343ad?w=1600&h=900&fit=crop',
  'auckland': 'https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=1600&h=900&fit=crop',
  'queenstown': 'https://images.unsplash.com/photo-1589871973318-9ca1258faa5d?w=1600&h=900&fit=crop',
  'wellington': 'https://images.unsplash.com/photo-1589483232748-515c025575bc?w=1600&h=900&fit=crop',
  'fiji': 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1600&h=900&fit=crop',
  // Indian Ocean Islands
  'maldives': 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=1600&h=900&fit=crop',
  'male': 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=1600&h=900&fit=crop',
  'mauritius': 'https://images.unsplash.com/photo-1589979481223-deb893043163?w=1600&h=900&fit=crop',
  'seychelles': 'https://images.unsplash.com/photo-1589979481223-deb893043163?w=1600&h=900&fit=crop',
  'sri lanka': 'https://images.unsplash.com/photo-1586185187731-37f7b8c79b0b?w=1600&h=900&fit=crop',
  'colombo': 'https://images.unsplash.com/photo-1586185187731-37f7b8c79b0b?w=1600&h=900&fit=crop',
  // Asia - Japan
  'tokyo': 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1600&h=900&fit=crop',
  'kyoto': 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1600&h=900&fit=crop',
  'osaka': 'https://images.unsplash.com/photo-1590559899731-a382839e5549?w=1600&h=900&fit=crop',
  'japan': 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1600&h=900&fit=crop',
  // Asia - Southeast Asia
  'bangkok': 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=1600&h=900&fit=crop',
  'thailand': 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=1600&h=900&fit=crop',
  'phuket': 'https://images.unsplash.com/photo-1589394815804-964ed0be2eb5?w=1600&h=900&fit=crop',
  'chiang mai': 'https://images.unsplash.com/photo-1598935898639-81586f7d2129?w=1600&h=900&fit=crop',
  'singapore': 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=1600&h=900&fit=crop',
  'ho chi minh': 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=1600&h=900&fit=crop',
  'saigon': 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=1600&h=900&fit=crop',
  'hanoi': 'https://images.unsplash.com/photo-1509030450996-dd1a26dda07a?w=1600&h=900&fit=crop',
  'vietnam': 'https://images.unsplash.com/photo-1528127269322-539801943592?w=1600&h=900&fit=crop',
  'bali': 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1600&h=900&fit=crop',
  'indonesia': 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1600&h=900&fit=crop',
  'kuala lumpur': 'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=1600&h=900&fit=crop',
  'malaysia': 'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=1600&h=900&fit=crop',
  // Philippines - Manila skyline and landmarks (daytime images)
  'manila': 'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=1600&h=900&fit=crop',
  'philippines': 'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=1600&h=900&fit=crop',
  'cebu': 'https://images.unsplash.com/photo-1505881502353-a1986add3762?w=1600&h=900&fit=crop',
  'boracay': 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&h=900&fit=crop',
  'palawan': 'https://images.unsplash.com/photo-1501179691627-eeaa65ea017c?w=1600&h=900&fit=crop',
  'el nido': 'https://images.unsplash.com/photo-1501179691627-eeaa65ea017c?w=1600&h=900&fit=crop',
  'cambodia': 'https://images.unsplash.com/photo-1539367628448-4bc5c9d171c8?w=1600&h=900&fit=crop',
  // Asia - China
  'hong kong': 'https://images.unsplash.com/photo-1536599018102-9f803c140fc1?w=1600&h=900&fit=crop',
  'shanghai': 'https://images.unsplash.com/photo-1538428494232-9c0d8a3ab403?w=1600&h=900&fit=crop',
  'beijing': 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=1600&h=900&fit=crop',
  'china': 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=1600&h=900&fit=crop',
  'great wall': 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=1600&h=900&fit=crop',
  'taiwan': 'https://images.unsplash.com/photo-1470004914212-05527e49370b?w=1600&h=900&fit=crop',
  'taipei': 'https://images.unsplash.com/photo-1470004914212-05527e49370b?w=1600&h=900&fit=crop',
  // Asia - Korea
  'seoul': 'https://images.unsplash.com/photo-1538485399081-7191377e8241?w=1600&h=900&fit=crop',
  'korea': 'https://images.unsplash.com/photo-1538485399081-7191377e8241?w=1600&h=900&fit=crop',
  // Asia - India
  'bengaluru': 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=1600&h=900&fit=crop', // Bangalore Palace
  'bangalore': 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=1600&h=900&fit=crop',
  'mumbai': 'https://images.unsplash.com/photo-1529253355930-ddbe423a2ac7?w=1600&h=900&fit=crop',
  'delhi': 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=1600&h=900&fit=crop',
  'new delhi': 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=1600&h=900&fit=crop',
  'jaipur': 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=1600&h=900&fit=crop',
  'hyderabad': 'https://images.unsplash.com/photo-1741545979534-02f59c742730?w=1600&h=900&fit=crop', // Charminar
  'chennai': 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=1600&h=900&fit=crop', // Marina Beach
  'kolkata': 'https://images.unsplash.com/photo-1558431382-27e303142255?w=1600&h=900&fit=crop', // Victoria Memorial
  'ahmedabad': 'https://images.unsplash.com/photo-1595658658481-d53d3f999875?w=1600&h=900&fit=crop',
  'pune': 'https://images.unsplash.com/photo-1567157577867-05ccb1388e66?w=1600&h=900&fit=crop',
  'india': 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=1600&h=900&fit=crop', // Taj Mahal for generic India
  'goa': 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=1600&h=900&fit=crop',
  // Africa & Middle East
  'casablanca': 'https://images.unsplash.com/photo-1569383746724-6f1b882b8f46?w=1600&h=900&fit=crop', // Hassan II Mosque
  'morocco': 'https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?w=1600&h=900&fit=crop', // Marrakech
  'marrakech': 'https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?w=1600&h=900&fit=crop',
  'cairo': 'https://images.unsplash.com/photo-1572252009286-268acec5ca0a?w=1600&h=900&fit=crop',
  'egypt': 'https://images.unsplash.com/photo-1572252009286-268acec5ca0a?w=1600&h=900&fit=crop',
  // Europe
  'paris': 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1600&h=900&fit=crop',
  'london': 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1600&h=900&fit=crop',
  'rome': 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=1600&h=900&fit=crop',
  'barcelona': 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=1600&h=900&fit=crop',
  'amsterdam': 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=1600&h=900&fit=crop',
  'berlin': 'https://images.unsplash.com/photo-1560969184-10fe8719e047?w=1600&h=900&fit=crop',
  'prague': 'https://images.unsplash.com/photo-1541849546-216549ae216d?w=1600&h=900&fit=crop',
  'vienna': 'https://images.unsplash.com/photo-1516550893923-42d28e5677af?w=1600&h=900&fit=crop',
  'venice': 'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=1600&h=900&fit=crop',
  'lisbon': 'https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=1600&h=900&fit=crop',
  'athens': 'https://images.unsplash.com/photo-1555993539-1732b0258235?w=1600&h=900&fit=crop',
  'istanbul': 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=1600&h=900&fit=crop',
  'zurich': 'https://images.unsplash.com/photo-1515488764276-beab7607c1e6?w=1600&h=900&fit=crop',
  // Americas
  'new york': 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1600&h=900&fit=crop',
  'los angeles': 'https://images.unsplash.com/photo-1534190760961-74e8c1c5c3da?w=1600&h=900&fit=crop',
  'san francisco': 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1600&h=900&fit=crop',
  'miami': 'https://images.unsplash.com/photo-1506966953602-c20cc11f75e3?w=1600&h=900&fit=crop',
  'chicago': 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1600&h=900&fit=crop',
  'toronto': 'https://images.unsplash.com/photo-1517090504332-eac2e63340ef?w=1600&h=900&fit=crop',
  'vancouver': 'https://images.unsplash.com/photo-1559511260-66a68edb6311?w=1600&h=900&fit=crop',
  'rio de janeiro': 'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=1600&h=900&fit=crop',
  'buenos aires': 'https://images.unsplash.com/photo-1612294037637-ec328d0e075e?w=1600&h=900&fit=crop',
  'mexico city': 'https://images.unsplash.com/photo-1518659526054-190340b32735?w=1600&h=900&fit=crop',
  'cancun': 'https://images.unsplash.com/photo-1510097467424-192d713fd8b2?w=1600&h=900&fit=crop',
  // Middle East
  'dubai': 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1600&h=900&fit=crop',
  'abu dhabi': 'https://images.unsplash.com/photo-1558956397-7f6c1fc5c6df?w=1600&h=900&fit=crop',
  // Generic by type (fallback)
  'beach': 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&h=900&fit=crop',
  'mountain': 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1600&h=900&fit=crop',
  'city': 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1600&h=900&fit=crop',
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
 * Find a static image URL for a destination.
 * Only returns static image if we have a SPECIFIC match for the city.
 * Falls through to API for unknown cities (even if country is known).
 */
function findStaticImage(destination: string): string | null {
  const lower = destination.toLowerCase();

  // Extract city name (before comma) for specific matching
  const parts = destination.split(',');
  const cityName = parts[0].trim().toLowerCase();

  // First, try to find an exact match for the city name
  if (STATIC_DESTINATION_IMAGES[cityName]) {
    return STATIC_DESTINATION_IMAGES[cityName];
  }

  // Try variations (with spaces for multi-word cities like "San Francisco")
  const entries = Object.entries(STATIC_DESTINATION_IMAGES);
  for (const [key, url] of entries) {
    // Only match if the key is found in the city portion (before comma)
    // This prevents "India" matching for "Hyderabad, India"
    if (cityName.includes(key) || key.includes(cityName)) {
      return url;
    }
  }

  // Don't fall back to country matches - let API fetch specific city images
  // This ensures "Hyderabad, India" gets a Hyderabad image, not Taj Mahal
  return null;
}

/**
 * Get destination image URL with caching.
 * Now prioritizes static images for known destinations (more reliable than Unsplash API).
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
  const destType = getDestinationType(destination);

  // Check static images FIRST for known destinations (most reliable)
  const staticUrl = findStaticImage(destination);
  if (staticUrl) {
    // Update cache with static URL (overwrite any potentially stale cached URLs)
    saveToCache(cacheKey, staticUrl);
    return {
      url: staticUrl,
      fallbackGradient: FALLBACK_GRADIENTS[destType],
      isLoading: false,
    };
  }

  // For unknown destinations, fall back to cache
  const cachedUrl = getFromCache(cacheKey);

  return {
    url: cachedUrl,
    fallbackGradient: FALLBACK_GRADIENTS[destType],
    isLoading: !cachedUrl,
  };
}

/**
 * Fetch and cache destination image asynchronously.
 * Uses static images first, falls back to server API with Unsplash.
 *
 * @returns Promise resolving to the image URL or null
 */
export async function fetchDestinationImage(destination: string): Promise<string | null> {
  const cacheKey = getCacheKey(destination);

  // Check cache first
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  // Try static images first (most reliable, no API call needed)
  const staticUrl = findStaticImage(destination);
  if (staticUrl) {
    saveToCache(cacheKey, staticUrl);
    return staticUrl;
  }

  // Fetch from server API (uses Unsplash API with AI-suggested search terms)
  try {
    const response = await fetch(
      `/api/destination-image?destination=${encodeURIComponent(destination)}`
    );

    if (response.ok) {
      const data = await response.json();
      if (data.imageUrl) {
        saveToCache(cacheKey, data.imageUrl);
        return data.imageUrl;
      }
    }
  } catch (error) {
    console.debug('[DestinationImages] API fetch failed:', destination, error);
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

/**
 * Clear cached image for a specific destination.
 * Useful when images need to be refreshed after static list updates.
 */
export function clearDestinationCache(destination: string): void {
  const cacheKey = getCacheKey(destination);
  memoryCache.delete(cacheKey);
  try {
    localStorage.removeItem(cacheKey);
  } catch {
    // localStorage unavailable
  }
}

/**
 * Clear all destination image caches.
 * Call this after updating the static image list.
 */
export function clearAllDestinationCaches(): void {
  memoryCache.clear();
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch {
    // localStorage unavailable
  }
}
