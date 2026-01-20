/**
 * useItineraryStream - React hook for streaming itinerary generation
 *
 * Connects to SSE endpoint and progressively renders days as they arrive.
 * Shows Day 1 within 5-10 seconds instead of waiting 60+ seconds.
 */

import { useState, useCallback, useRef, useEffect } from "react";

// ============================================================================
// TYPES
// ============================================================================

export interface ItineraryActivity {
  time: string;
  name: string;
  description: string;
  type: "activity" | "meal" | "transport" | "lodging";
  estimatedCost: number;
  duration: string;
  location: string;
  coordinates: { lat: number; lng: number };
  transportMode?: string;
}

export interface ItineraryDay {
  day: number;
  date: string;
  title: string;
  activities: ItineraryActivity[];
  localFood?: Array<{
    name: string;
    cuisine: string;
    priceRange: string;
    estimatedCost: number;
    mustTry: string;
    address?: string;
  }>;
}

export interface StreamMeta {
  tripId: number;
  destination: string;
  totalDays: number;
  startDate: string;
  cached?: boolean;
  resumedFrom?: number;
}

export interface StreamProgress {
  currentDay: number;
  totalDays: number;
  percent: number;
  message: string;
}

export interface StreamError {
  dayIndex?: number;
  message: string;
  recoverable: boolean;
}

/**
 * Validation event data from server
 */
export interface StreamValidation {
  iteration: number;
  status: "APPROVED" | "REJECTED" | "WARNING";
  budgetVerified: boolean;
  logisticsVerified: boolean;
  flaggedDays: number[];
  logs: string[];
}

/**
 * Refinement event data from server
 */
export interface StreamRefinement {
  iteration: number;
  daysToRefine: number[];
  budgetIssues: string[];
  logisticsIssues: string[];
}

/**
 * Validation metadata from done event
 */
export interface ValidationMetadata {
  budgetVerified: boolean;
  logisticsVerified: boolean;
  totalIterations: number;
  refinedDays: number[];
  logs: string[];
}

export type StreamStatus = "idle" | "connecting" | "streaming" | "validating" | "refining" | "complete" | "error";

export interface UseItineraryStreamResult {
  /** Current streaming status */
  status: StreamStatus;

  /** Days received so far */
  days: ItineraryDay[];

  /** Stream metadata (tripId, totalDays, etc.) */
  meta: StreamMeta | null;

  /** Current progress info */
  progress: StreamProgress | null;

  /** Error if status is "error" */
  error: StreamError | null;

  /** Whether the itinerary was served from cache */
  isCached: boolean;

  /** Current validation state */
  validation: StreamValidation | null;

  /** Current refinement state (when refining flagged days) */
  refinement: StreamRefinement | null;

  /** Final validation metadata after completion */
  validationResult: ValidationMetadata | null;

  /** Start streaming for a trip */
  startStream: (tripId: number) => void;

  /** Abort the current stream */
  abortStream: () => void;

  /** Retry after error */
  retry: () => void;
}

// ============================================================================
// HOOK
// ============================================================================

export function useItineraryStream(): UseItineraryStreamResult {
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [meta, setMeta] = useState<StreamMeta | null>(null);
  const [progress, setProgress] = useState<StreamProgress | null>(null);
  const [error, setError] = useState<StreamError | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [validation, setValidation] = useState<StreamValidation | null>(null);
  const [refinement, setRefinement] = useState<StreamRefinement | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationMetadata | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const currentTripIdRef = useRef<number | null>(null);

  /**
   * Clean up EventSource
   */
  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  /**
   * Start streaming itinerary for a trip
   */
  const startStream = useCallback((tripId: number) => {
    // Clean up any existing stream
    cleanup();

    // Reset state
    setStatus("connecting");
    setDays([]);
    setMeta(null);
    setProgress(null);
    setError(null);
    setIsCached(false);
    setValidation(null);
    setRefinement(null);
    setValidationResult(null);
    currentTripIdRef.current = tripId;

    const url = `/api/trips/${tripId}/itinerary/stream`;
    console.log(`[ItineraryStream] Connecting to ${url}`);

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    // Handle meta event
    eventSource.addEventListener("meta", (e) => {
      try {
        const data = JSON.parse(e.data);
        console.log(`[ItineraryStream] Meta:`, data);
        setMeta(data);
        setIsCached(data.cached === true);
        setStatus("streaming");
      } catch (err) {
        console.error("[ItineraryStream] Failed to parse meta:", err);
      }
    });

    // Handle day event - this is the key one for progressive rendering
    eventSource.addEventListener("day", (e) => {
      try {
        const data = JSON.parse(e.data);
        const { dayIndex, day, cached } = data;

        console.log(`[ItineraryStream] Day ${dayIndex + 1} received (${day.activities?.length || 0} activities)${cached ? ' [cached]' : ''}`);

        setDays((prev) => {
          // Update or append day
          const newDays = [...prev];
          newDays[dayIndex] = day;
          return newDays;
        });

        // Update progress
        setProgress((prev) => ({
          currentDay: dayIndex + 1,
          totalDays: prev?.totalDays || dayIndex + 1,
          percent: Math.round(((dayIndex + 1) / (prev?.totalDays || dayIndex + 1)) * 100),
          message: cached ? `Loading Day ${dayIndex + 1}...` : `Day ${dayIndex + 1} ready`
        }));
      } catch (err) {
        console.error("[ItineraryStream] Failed to parse day:", err);
      }
    });

    // Handle progress event
    eventSource.addEventListener("progress", (e) => {
      try {
        const data = JSON.parse(e.data);
        setProgress(data);
      } catch (err) {
        console.error("[ItineraryStream] Failed to parse progress:", err);
      }
    });

    // Handle validation event (Director pattern - budget/logistics check)
    eventSource.addEventListener("validation", (e) => {
      try {
        const data = JSON.parse(e.data) as StreamValidation;
        console.log(`[ItineraryStream] Validation iteration ${data.iteration}: ${data.status}`);
        setValidation(data);
        setStatus("validating");

        // Update progress to show validation phase
        setProgress((prev) => ({
          currentDay: prev?.totalDays || 0,
          totalDays: prev?.totalDays || 0,
          percent: 100,
          message: `Validating itinerary... (${data.status})`
        }));
      } catch (err) {
        console.error("[ItineraryStream] Failed to parse validation:", err);
      }
    });

    // Handle refinement event (Director pattern - fixing flagged days)
    eventSource.addEventListener("refinement", (e) => {
      try {
        const data = JSON.parse(e.data) as StreamRefinement;
        console.log(`[ItineraryStream] Refinement iteration ${data.iteration}: days ${data.daysToRefine.join(", ")}`);
        setRefinement(data);
        setStatus("refining");

        // Update progress to show refinement phase
        setProgress((prev) => ({
          currentDay: prev?.totalDays || 0,
          totalDays: prev?.totalDays || 0,
          percent: 100,
          message: `Refining Day${data.daysToRefine.length > 1 ? "s" : ""} ${data.daysToRefine.join(", ")}...`
        }));
      } catch (err) {
        console.error("[ItineraryStream] Failed to parse refinement:", err);
      }
    });

    // Handle done event
    eventSource.addEventListener("done", (e) => {
      try {
        const data = JSON.parse(e.data);
        console.log(`[ItineraryStream] Complete: ${data.totalDays} days, ${data.totalActivities} activities`);

        // Capture validation result from done event
        if (data.validation) {
          setValidationResult(data.validation as ValidationMetadata);
          console.log(`[ItineraryStream] Validation result: budget=${data.validation.budgetVerified}, logistics=${data.validation.logisticsVerified}, iterations=${data.validation.totalIterations}`);
        }

        setStatus("complete");
        setProgress({
          currentDay: data.totalDays,
          totalDays: data.totalDays,
          percent: 100,
          message: data.validation
            ? `Itinerary complete (${data.validation.budgetVerified && data.validation.logisticsVerified ? "verified" : "partial"})`
            : "Itinerary complete"
        });

        cleanup();
      } catch (err) {
        console.error("[ItineraryStream] Failed to parse done:", err);
        setStatus("complete");
        cleanup();
      }
    });

    // Handle error event from server
    eventSource.addEventListener("error", (e) => {
      // Check if it's a custom error event with data
      if (e instanceof MessageEvent && e.data) {
        try {
          const data = JSON.parse(e.data);
          console.error("[ItineraryStream] Server error:", data);

          if (data.recoverable) {
            // Recoverable error - keep streaming
            setError({ ...data, recoverable: true });
          } else {
            // Fatal error - stop streaming
            setStatus("error");
            setError(data);
            cleanup();
          }
        } catch (err) {
          // Not a JSON error, treat as connection error
          handleConnectionError();
        }
      } else {
        // Connection error
        handleConnectionError();
      }
    });

    const handleConnectionError = () => {
      // EventSource connection error
      if (eventSource.readyState === EventSource.CLOSED) {
        console.error("[ItineraryStream] Connection closed");

        // If we have some days, treat as partial success
        if (days.length > 0) {
          setStatus("complete");
          setProgress({
            currentDay: days.length,
            totalDays: meta?.totalDays || days.length,
            percent: Math.round((days.length / (meta?.totalDays || days.length)) * 100),
            message: "Partial itinerary loaded"
          });
        } else {
          setStatus("error");
          setError({
            message: "Connection lost. Please try again.",
            recoverable: true
          });
        }
        cleanup();
      }
    };

    // Handle native EventSource errors
    eventSource.onerror = () => {
      // Only handle if we haven't received a done event
      if (status !== "complete") {
        handleConnectionError();
      }
    };

  }, [cleanup, days.length, meta?.totalDays, status]);

  /**
   * Abort the current stream
   */
  const abortStream = useCallback(() => {
    console.log("[ItineraryStream] Aborting stream");
    cleanup();
    setStatus("idle");
  }, [cleanup]);

  /**
   * Retry streaming for the current trip
   */
  const retry = useCallback(() => {
    if (currentTripIdRef.current) {
      console.log(`[ItineraryStream] Retrying trip ${currentTripIdRef.current}`);
      startStream(currentTripIdRef.current);
    }
  }, [startStream]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    status,
    days,
    meta,
    progress,
    error,
    isCached,
    validation,
    refinement,
    validationResult,
    startStream,
    abortStream,
    retry
  };
}

// ============================================================================
// UTILITY: Merge streamed days into existing trip
// ============================================================================

/**
 * Merge streamed days into an existing trip's itinerary
 * Useful for updating trip state with progressive days
 */
export function mergeStreamedDays(
  existingItinerary: { days: ItineraryDay[] } | null | undefined,
  streamedDays: ItineraryDay[]
): { days: ItineraryDay[] } {
  if (!existingItinerary?.days) {
    return { days: streamedDays };
  }

  const merged = [...existingItinerary.days];

  for (const day of streamedDays) {
    const idx = day.day - 1;
    if (idx >= 0 && idx < merged.length) {
      merged[idx] = day;
    } else {
      merged.push(day);
    }
  }

  return { days: merged };
}
