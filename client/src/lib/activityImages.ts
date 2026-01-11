/**
 * activityImages.ts
 *
 * Lightweight activity image utility with localStorage caching.
 * Uses Unsplash Source API for free images, falls back to type-based placeholders.
 *
 * Cache Strategy:
 * - localStorage keyed by `activityImage:${destination}:${normalizedName}`
 * - 7-day TTL to avoid stale images
 * - In-memory cache for session performance
 */

// ============================================================================
// TYPES
// ============================================================================

interface CachedImage {
  url: string;
  timestamp: number;
}

type ActivityType = 'activity' | 'meal' | 'transport' | 'lodging';

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_PREFIX = 'activityImage:';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// In-memory cache for session performance
const memoryCache = new Map<string, string>();

// Concurrency limiter to prevent burst requests
const MAX_CONCURRENT = 3;
let inFlight = 0;
const pendingQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (inFlight < MAX_CONCURRENT) {
    inFlight++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    pendingQueue.push(() => {
      inFlight++;
      resolve();
    });
  });
}

function releaseSlot(): void {
  inFlight--;
  const next = pendingQueue.shift();
  if (next) next();
}

// Type-based placeholder gradients (deterministic, no network)
const TYPE_PLACEHOLDERS: Record<ActivityType, string> = {
  activity: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', // Blue
  meal: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',     // Amber
  transport: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', // Purple
  lodging: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',   // Green
};

// Type-based emoji overlays for placeholders
const TYPE_EMOJIS: Record<ActivityType, string> = {
  activity: '🏛️',
  meal: '🍜',
  transport: '🚆',
  lodging: '🏨',
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Normalize activity name for consistent cache keys.
 * Removes special chars, lowercases, trims.
 */
function normalizeActivityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 50);
}

/**
 * Generate cache key for an activity.
 */
function getCacheKey(destination: string, activityName: string): string {
  const normDest = destination.toLowerCase().replace(/[^a-z]/g, '');
  const normName = normalizeActivityName(activityName);
  return `${CACHE_PREFIX}${normDest}:${normName}`;
}

/**
 * Check if cached entry is still valid.
 */
function isValidCache(entry: CachedImage): boolean {
  return Date.now() - entry.timestamp < CACHE_TTL_MS;
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
        // Expired, remove
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
 * Build Unsplash Source URL for an activity.
 * Uses the activity name + destination for relevant images.
 */
function buildUnsplashUrl(activityName: string, destination: string): string {
  // Extract key terms from activity name (skip common words)
  const skipWords = new Set(['the', 'a', 'an', 'at', 'in', 'to', 'of', 'and', 'or', 'for', 'with']);
  const terms = activityName
    .split(/\s+/)
    .filter(w => w.length > 2 && !skipWords.has(w.toLowerCase()))
    .slice(0, 3)
    .join(' ');

  const query = encodeURIComponent(`${terms} ${destination}`.trim());
  return `https://source.unsplash.com/400x300/?${query}`;
}

/**
 * Get activity image URL with caching.
 * Returns cached URL, fetches lazily if not cached.
 *
 * @param activityName - Name of the activity (e.g., "Visit Grand Palace")
 * @param destination - Trip destination for context (e.g., "Bangkok, Thailand")
 * @param activityType - Type for placeholder fallback
 * @returns Object with url (or null), placeholder, and loading state
 */
export function getActivityImageUrl(
  activityName: string,
  destination: string,
  activityType: ActivityType = 'activity'
): {
  url: string | null;
  placeholder: string;
  emoji: string;
  isLoading: boolean;
} {
  const cacheKey = getCacheKey(destination, activityName);
  const cachedUrl = getFromCache(cacheKey);

  return {
    url: cachedUrl,
    placeholder: TYPE_PLACEHOLDERS[activityType] || TYPE_PLACEHOLDERS.activity,
    emoji: TYPE_EMOJIS[activityType] || TYPE_EMOJIS.activity,
    isLoading: !cachedUrl,
  };
}

/**
 * Fetch and cache activity image asynchronously.
 * Call this when an ActivityRow mounts to lazy-load the image.
 *
 * Features:
 * - Concurrency limited to MAX_CONCURRENT requests
 * - Small random jitter to smooth burst requests
 *
 * @returns Promise resolving to the image URL or null
 */
export async function fetchActivityImage(
  activityName: string,
  destination: string
): Promise<string | null> {
  const cacheKey = getCacheKey(destination, activityName);

  // Check cache first
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  // Wait for available slot (concurrency limit)
  await acquireSlot();

  // Small random jitter (50-150ms) to smooth burst requests
  await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));

  try {
    const unsplashUrl = buildUnsplashUrl(activityName, destination);

    // Use HEAD request to get the final redirected URL
    const response = await fetch(unsplashUrl, {
      method: 'HEAD',
      redirect: 'follow',
    });

    if (response.ok && response.url && !response.url.includes('source.unsplash.com')) {
      // Got a real image URL
      saveToCache(cacheKey, response.url);
      releaseSlot();
      return response.url;
    }
  } catch (error) {
    // Network error, silently fail to placeholder
    console.debug('[ActivityImages] Fetch failed:', activityName, error);
  }

  releaseSlot();
  return null;
}

/**
 * Preload images for a list of activities.
 * Call this when DayCardList mounts to warm the cache.
 */
export function preloadActivityImages(
  activities: Array<{ name: string; type?: ActivityType }>,
  destination: string
): void {
  // Stagger requests to avoid rate limiting
  activities.forEach((activity, idx) => {
    setTimeout(() => {
      fetchActivityImage(activity.name, destination);
    }, idx * 200); // 200ms between each
  });
}

/**
 * Clear expired entries from localStorage.
 * Call periodically or on app startup.
 */
export function cleanupExpiredImages(): void {
  try {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) {
        const stored = localStorage.getItem(key);
        if (stored) {
          try {
            const entry: CachedImage = JSON.parse(stored);
            if (!isValidCache(entry)) {
              keysToRemove.push(key);
            }
          } catch {
            keysToRemove.push(key);
          }
        }
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));

    if (keysToRemove.length > 0) {
      console.debug(`[ActivityImages] Cleaned up ${keysToRemove.length} expired entries`);
    }
  } catch {
    // localStorage unavailable
  }
}
