/**
 * useDirections - Fetch walking routes between itinerary activities
 *
 * Uses Mapbox Directions API to get actual walking routes instead of straight lines.
 * Caches results per day to avoid redundant API calls.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface Waypoint {
  lat: number;
  lng: number;
  name?: string;
}

export interface DirectionsLeg {
  duration: number;  // seconds
  distance: number;  // meters
  summary: string;
}

export interface DirectionsRoute {
  geometry: {
    type: 'LineString';
    coordinates: [number, number][]; // [lng, lat] pairs
  };
  duration: number;      // total seconds
  distance: number;      // total meters
  durationFormatted: string;
  distanceFormatted: string;
  legs: DirectionsLeg[];
}

export interface UseDirectionsResult {
  route: DirectionsRoute | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// In-memory cache for directions
const directionsCache = new Map<string, DirectionsRoute>();

function getCacheKey(waypoints: Waypoint[], mode: string): string {
  const coords = waypoints.map(w => `${w.lat.toFixed(4)},${w.lng.toFixed(4)}`).join('|');
  return `${mode}:${coords}`;
}

/**
 * Fetch directions for a set of waypoints
 */
export function useDirections(
  waypoints: Waypoint[],
  options: {
    mode?: 'walking' | 'cycling' | 'driving';
    enabled?: boolean;
  } = {}
): UseDirectionsResult {
  const { mode = 'walking', enabled = true } = options;
  const [route, setRoute] = useState<DirectionsRoute | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchDirections = useCallback(async () => {
    // Need at least 2 waypoints
    if (waypoints.length < 2) {
      setRoute(null);
      return;
    }

    // Check cache first
    const cacheKey = getCacheKey(waypoints, mode);
    const cached = directionsCache.get(cacheKey);
    if (cached) {
      setRoute(cached);
      return;
    }

    // Abort any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/mapbox/directions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waypoints, mode }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        if (response.status === 503) {
          // Mapbox not configured - silent fail
          setRoute(null);
          return;
        }
        throw new Error(`Directions request failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.route) {
        directionsCache.set(cacheKey, data.route);
        setRoute(data.route);
      } else {
        setRoute(null);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return; // Ignore abort errors
      }
      console.error('[useDirections] Error:', err);
      setError((err as Error).message);
      setRoute(null);
    } finally {
      setIsLoading(false);
    }
  }, [waypoints, mode]);

  // Fetch on waypoints change
  useEffect(() => {
    if (!enabled) {
      setRoute(null);
      return;
    }

    fetchDirections();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchDirections, enabled]);

  return {
    route,
    isLoading,
    error,
    refetch: fetchDirections,
  };
}

/**
 * Fetch directions for multiple days in parallel
 */
export function useMultiDayDirections(
  dayWaypoints: Waypoint[][],
  options: {
    mode?: 'walking' | 'cycling' | 'driving';
    enabled?: boolean;
  } = {}
): {
  routes: (DirectionsRoute | null)[];
  isLoading: boolean;
  errors: (string | null)[];
} {
  const { mode = 'walking', enabled = true } = options;
  const [routes, setRoutes] = useState<(DirectionsRoute | null)[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<(string | null)[]>([]);

  useEffect(() => {
    if (!enabled || dayWaypoints.length === 0) {
      setRoutes([]);
      setErrors([]);
      return;
    }

    const fetchAllDays = async () => {
      setIsLoading(true);

      const results = await Promise.all(
        dayWaypoints.map(async (waypoints, index) => {
          if (waypoints.length < 2) {
            return { route: null, error: null };
          }

          // Check cache
          const cacheKey = getCacheKey(waypoints, mode);
          const cached = directionsCache.get(cacheKey);
          if (cached) {
            return { route: cached, error: null };
          }

          try {
            const response = await fetch('/api/mapbox/directions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ waypoints, mode }),
            });

            if (!response.ok) {
              if (response.status === 503) {
                return { route: null, error: null };
              }
              return { route: null, error: `Day ${index + 1} directions failed` };
            }

            const data = await response.json();
            if (data.route) {
              directionsCache.set(cacheKey, data.route);
              return { route: data.route, error: null };
            }
            return { route: null, error: null };
          } catch (err) {
            return { route: null, error: (err as Error).message };
          }
        })
      );

      setRoutes(results.map(r => r.route));
      setErrors(results.map(r => r.error));
      setIsLoading(false);
    };

    fetchAllDays();
  }, [dayWaypoints, mode, enabled]);

  return { routes, isLoading, errors };
}

/**
 * Clear the directions cache (useful for testing or when routes might have changed)
 */
export function clearDirectionsCache(): void {
  directionsCache.clear();
}
