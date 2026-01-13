/**
 * useDestinationImage.ts
 *
 * Hook for fetching destination images dynamically.
 * Uses backend API with Unsplash integration, with localStorage caching.
 */

import { useState, useEffect } from 'react';

interface DestinationImageResult {
  imageUrl: string | null;
  isLoading: boolean;
  error: Error | null;
}

// In-memory cache for session
const memoryCache = new Map<string, string>();

// LocalStorage cache config
const CACHE_PREFIX = 'destImg:';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedEntry {
  url: string;
  timestamp: number;
}

function getCacheKey(destination: string): string {
  return CACHE_PREFIX + destination.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

function getFromCache(destination: string): string | null {
  const key = getCacheKey(destination);

  // Check memory cache first
  if (memoryCache.has(key)) {
    return memoryCache.get(key)!;
  }

  // Check localStorage
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const entry: CachedEntry = JSON.parse(stored);
      if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
        memoryCache.set(key, entry.url);
        return entry.url;
      }
      localStorage.removeItem(key);
    }
  } catch {
    // localStorage unavailable
  }

  return null;
}

function saveToCache(destination: string, url: string): void {
  const key = getCacheKey(destination);
  memoryCache.set(key, url);

  try {
    localStorage.setItem(key, JSON.stringify({ url, timestamp: Date.now() }));
  } catch {
    // localStorage full or unavailable
  }
}

/**
 * Fetch destination image from API.
 * Returns high-quality Unsplash image URL.
 */
async function fetchDestinationImage(destination: string): Promise<string | null> {
  try {
    const response = await fetch(
      `/api/destination-image?destination=${encodeURIComponent(destination)}`
    );

    if (!response.ok) {
      console.warn('[useDestinationImage] API error:', response.status);
      return null;
    }

    const data = await response.json();
    return data.imageUrl || null;
  } catch (error) {
    console.error('[useDestinationImage] Fetch error:', error);
    return null;
  }
}

/**
 * Hook to get destination image URL.
 * Uses stored URL if available, otherwise fetches from API with caching.
 *
 * @param destination - Destination string (e.g., "Paris, France")
 * @param storedImageUrl - Pre-stored image URL from database (optional)
 */
export function useDestinationImage(
  destination: string | null | undefined,
  storedImageUrl?: string | null
): DestinationImageResult {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!destination) {
      setImageUrl(null);
      return;
    }

    // Priority 1: Use stored image from database
    if (storedImageUrl) {
      setImageUrl(storedImageUrl);
      return;
    }

    // Priority 2: Check cache
    const cached = getFromCache(destination);
    if (cached) {
      setImageUrl(cached);
      return;
    }

    // Priority 3: Fetch from API
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchDestinationImage(destination)
      .then((url) => {
        if (cancelled) return;

        if (url) {
          saveToCache(destination, url);
          setImageUrl(url);
        } else {
          setImageUrl(null);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error('Failed to fetch image'));
        setImageUrl(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [destination, storedImageUrl]);

  return { imageUrl, isLoading, error };
}

/**
 * Batch fetch destination images for multiple trips.
 * More efficient than individual calls.
 */
export async function prefetchDestinationImages(destinations: string[]): Promise<void> {
  const uncached = destinations.filter((d) => !getFromCache(d));

  await Promise.all(
    uncached.map(async (destination) => {
      const url = await fetchDestinationImage(destination);
      if (url) {
        saveToCache(destination, url);
      }
    })
  );
}

/**
 * Clear all destination image caches.
 */
export function clearDestinationImageCache(): void {
  memoryCache.clear();
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // localStorage unavailable
  }
}

// Fallback gradients for when images fail to load
export const FALLBACK_GRADIENTS: Record<string, string> = {
  beach: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 50%, #0369a1 100%)',
  mountain: 'linear-gradient(135deg, #64748b 0%, #475569 50%, #334155 100%)',
  city: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #4338ca 100%)',
  default: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #020617 100%)',
};

/**
 * Get fallback gradient based on destination type.
 */
export function getDestinationGradient(destination: string): string {
  const lower = destination.toLowerCase();

  const beachKeywords = ['beach', 'island', 'maldives', 'bali', 'phuket', 'cancun', 'miami', 'fiji'];
  const mountainKeywords = ['mountain', 'alps', 'himalaya', 'swiss', 'nepal'];
  const cityKeywords = ['city', 'tokyo', 'london', 'paris', 'sydney', 'singapore', 'dubai', 'hong kong'];

  if (beachKeywords.some((k) => lower.includes(k))) return FALLBACK_GRADIENTS.beach;
  if (mountainKeywords.some((k) => lower.includes(k))) return FALLBACK_GRADIENTS.mountain;
  if (cityKeywords.some((k) => lower.includes(k))) return FALLBACK_GRADIENTS.city;

  return FALLBACK_GRADIENTS.default;
}
