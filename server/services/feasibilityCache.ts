/**
 * Feasibility Cache Service
 *
 * In-memory cache for feasibility reports to hit < 2s response times.
 * Key: `${passport}:${destination}` (normalized)
 *
 * Cache Strategy:
 * - TTL: 24 hours (visa rules don't change often)
 * - Max entries: 1000 (LRU eviction)
 * - Instant hit: ~0ms vs 5-8s AI call
 */

import { FeasibilityReport } from "@shared/schema";

// ============================================================================
// TYPES
// ============================================================================

interface CacheEntry {
  report: FeasibilityReport;
  timestamp: number;
  hitCount: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  avgHitTimeMs: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_ENTRIES = 1000;

// ============================================================================
// CACHE INSTANCE
// ============================================================================

const feasibilityCache = new Map<string, CacheEntry>();
const cacheStats: CacheStats = {
  hits: 0,
  misses: 0,
  evictions: 0,
  avgHitTimeMs: 0,
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Normalize cache key: lowercase, trim, extract country from destination
 * "India" + "Tokyo, Japan" → "india:japan"
 */
function normalizeCacheKey(passport: string, destination: string): string {
  const normalizedPassport = passport.toLowerCase().trim();

  // Extract country from destination (e.g., "Tokyo, Japan" → "japan")
  const destParts = destination.split(',');
  const country = destParts.length > 1
    ? destParts[destParts.length - 1].trim().toLowerCase()
    : destination.toLowerCase().trim();

  return `${normalizedPassport}:${country}`;
}

/**
 * LRU eviction when cache is full
 */
function evictOldestEntry(): void {
  let oldestKey: string | null = null;
  let oldestTime = Infinity;

  // Use Array.from for ES5 compatibility
  const entries = Array.from(feasibilityCache.entries());
  for (const [key, entry] of entries) {
    if (entry.timestamp < oldestTime) {
      oldestTime = entry.timestamp;
      oldestKey = key;
    }
  }

  if (oldestKey) {
    feasibilityCache.delete(oldestKey);
    cacheStats.evictions++;
    console.log(`[FeasibilityCache] Evicted: ${oldestKey}`);
  }
}

/**
 * Check if entry is expired
 */
function isExpired(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp > CACHE_TTL_MS;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get cached feasibility report
 * @returns FeasibilityReport or null if not cached/expired
 */
export function getCachedFeasibility(
  passport: string,
  destination: string
): FeasibilityReport | null {
  const key = normalizeCacheKey(passport, destination);
  const entry = feasibilityCache.get(key);

  if (!entry) {
    cacheStats.misses++;
    return null;
  }

  // Check expiration
  if (isExpired(entry)) {
    feasibilityCache.delete(key);
    cacheStats.misses++;
    console.log(`[FeasibilityCache] Expired: ${key}`);
    return null;
  }

  // Cache HIT!
  entry.hitCount++;
  cacheStats.hits++;
  console.log(`[FeasibilityCache] HIT: ${key} (hit #${entry.hitCount})`);

  return entry.report;
}

/**
 * Store feasibility report in cache
 */
export function cacheFeasibility(
  passport: string,
  destination: string,
  report: FeasibilityReport
): void {
  const key = normalizeCacheKey(passport, destination);

  // Evict if at capacity
  if (feasibilityCache.size >= MAX_ENTRIES && !feasibilityCache.has(key)) {
    evictOldestEntry();
  }

  feasibilityCache.set(key, {
    report,
    timestamp: Date.now(),
    hitCount: 0,
  });

  console.log(`[FeasibilityCache] Cached: ${key} (score: ${report.score})`);
}

/**
 * Get cache statistics for monitoring
 */
export function getCacheStats(): CacheStats & { size: number; hitRate: string } {
  const total = cacheStats.hits + cacheStats.misses;
  const hitRate = total > 0 ? ((cacheStats.hits / total) * 100).toFixed(1) + '%' : '0%';

  return {
    ...cacheStats,
    size: feasibilityCache.size,
    hitRate,
  };
}

/**
 * Clear entire cache (for testing/admin)
 */
export function clearFeasibilityCache(): void {
  feasibilityCache.clear();
  console.log('[FeasibilityCache] Cleared');
}

/**
 * Warm cache with common corridors (call on startup)
 */
export function warmCache(
  corridors: Array<{ passport: string; destination: string; report: FeasibilityReport }>
): void {
  for (const { passport, destination, report } of corridors) {
    cacheFeasibility(passport, destination, report);
  }
  console.log(`[FeasibilityCache] Warmed with ${corridors.length} entries`);
}
