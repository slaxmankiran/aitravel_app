/**
 * TripResultsV1.tsx
 *
 * New Trip Results page with Mindtrip-style layout.
 * Clean two-column layout, no expanded sections, no view toggles.
 *
 * Route: /trips/:id/results-v1
 *
 * Layout:
 * - Sticky HeaderBar (logo, destination, meta, actions)
 * - Sticky CertaintyBar (visa, score, chips)
 * - Left column: Itinerary (Timeline for now, DayCards in Phase 2)
 * - Right column: Sticky Map + Accordion Panels
 */

import { useParams, useSearch } from "wouter";
import { useTrip } from "@/hooks/use-trips";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Loader2, X, ChevronDown, ChevronUp, Route } from "lucide-react";

// Layout components
import { HeaderBar } from "@/components/results/HeaderBar";
import { CertaintyBar } from "@/components/results/CertaintyBar";
import { RightRailPanels } from "@/components/results/RightRailPanels";
import { TripUpdateBanner } from "@/components/results/TripUpdateBanner";
import { CertaintyExplanationDrawer } from "@/components/results/CertaintyExplanationDrawer";
import { FixBlockersController } from "@/components/results/FixBlockersController";

// Failure state components
import {
  NotFeasibleState,
  TimeoutState,
  ErrorState,
  InlineWarning,
  EmptyItineraryState,
} from "@/components/results/FailureStates";

// Existing working components
import { ItineraryMap } from "@/components/ItineraryMap";

// New DayCardList (Phase 2)
import { DayCardList, type Itinerary } from "@/components/results-v1/DayCardList";

// Analytics
import { trackTripEvent, buildTripContext, type TripEventContext } from "@/lib/analytics";

// Verdict system
import { computeVerdict, buildVerdictInput } from "@/lib/verdict";
import { VerdictCard } from "@/components/results/VerdictCard";

// Streaming skeletons
import {
  CertaintyBarSkeleton,
  VerdictCardSkeleton,
  ItinerarySkeleton,
  MapSkeleton,
  RightRailSkeleton,
  StreamingProgress,
} from "@/components/results/ResultsSkeletons";

// Blocker deltas
import { getBlockerDeltaUI, type BlockerDeltaUI } from "@/lib/blockerDeltas";

// Change Planner
import { useChangePlanner } from "@/hooks/useChangePlanner";
import { ChangePlanBanner } from "@/components/results/ChangePlanBanner";
import { ComparePlansModal } from "@/components/results/ComparePlansModal";
import { comparePlans } from "@/lib/comparePlans";
import { suggestNextFix, getSuggestionAnalyticsData, type NextFixSuggestion } from "@/lib/nextFix";
import { applyFix, type ApplyFixContext, type ApplyFixResult } from "@/lib/applyFix";
import type { ChangePlannerResponse } from "@shared/schema";
import { api } from "@shared/routes";

// Version history
import { useTripVersions } from "@/hooks/useTripVersions";

import type { TripResponse, UserTripInput } from "@shared/schema";

// ============================================================================
// UNDO CONTEXT
// ============================================================================

/**
 * Context for undoing a recent change.
 * Stored in memory only - no persistence needed.
 */
type UndoContext = {
  changeId: string;
  prevInput: UserTripInput;
  nextInput: UserTripInput;
  appliedAt: string; // ISO timestamp
  source: "edit_trip" | "quick_chip" | "fix_blocker";
};

// ============================================================================
// CERTAINTY HISTORY
// ============================================================================

/**
 * A point in the certainty timeline.
 * Shows how certainty evolved across changes.
 */
export type CertaintyPoint = {
  id: string;                // changeId or "initial"
  score: number;
  at: string;                // ISO timestamp
  label: string;             // short label for tooltip
  source?: "edit_trip" | "fix_blocker" | "undo" | "initial";
};

// ============================================================================
// NARRATIVE HELPERS
// ============================================================================

// Known cities for narrative extraction (subset of most common)
const NARRATIVE_CITIES = [
  'Bangkok', 'Chiang Mai', 'Chiang Rai', 'Phuket', 'Krabi', 'Pattaya', 'Ayutthaya',
  'Koh Samui', 'Hua Hin', 'Pai', 'Tokyo', 'Kyoto', 'Osaka', 'Singapore',
  'Kuala Lumpur', 'Bali', 'Ubud', 'Ho Chi Minh', 'Hanoi', 'Da Nang', 'Hoi An',
  'Mumbai', 'Delhi', 'Jaipur', 'Goa', 'Paris', 'London', 'Rome', 'Barcelona',
  'New York', 'Dubai', 'Istanbul',
];

/**
 * Generate a concise editorial subtitle based on trip characteristics.
 */
function generateNarrativeSubtitle(trip: TripResponse, itinerary: any): string {
  // Extract actual city names (not day themes)
  const cities: string[] = [];
  itinerary?.days?.forEach((day: any) => {
    if (day.title) {
      for (const city of NARRATIVE_CITIES) {
        if (day.title.toLowerCase().includes(city.toLowerCase()) && !cities.includes(city)) {
          cities.push(city);
          break;
        }
      }
    }
  });

  // Build concise narrative
  const parts: string[] = [];

  // City journey
  if (cities.length === 1) {
    parts.push(`Discover ${cities[0]}`);
  } else if (cities.length === 2) {
    parts.push(`${cities[0]} to ${cities[1]}`);
  } else if (cities.length >= 3) {
    parts.push(`${cities[0]}, ${cities[1]} & more`);
  }

  // Travel style
  const styleMap: Record<string, string> = {
    'budget': 'budget-friendly',
    'standard': 'well-balanced',
    'comfort': 'comfortable',
    'luxury': 'luxury experience',
    'adventure': 'adventure-focused',
    'relaxation': 'relaxing getaway',
    'cultural': 'cultural immersion',
  };
  const style = styleMap[trip.travelStyle?.toLowerCase() || ''];
  if (style) parts.push(style);

  // Visa status (brief)
  const feasibility = trip.feasibilityReport as any;
  const visaType = feasibility?.visaDetails?.type;
  if (visaType === 'visa_free') {
    parts.push('visa-free');
  }

  if (parts.length === 0) {
    return 'Your personalized journey';
  }

  return parts.join(' • ');
}

// ============================================================================
// HOOKS
// ============================================================================

function useTripProgress(tripId: number, isProcessing: boolean) {
  return useQuery({
    queryKey: ['trip-progress', tripId],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/progress`);
      if (!res.ok) throw new Error("Failed to fetch progress");
      return res.json();
    },
    enabled: isProcessing && !!tripId,
    refetchInterval: isProcessing ? 500 : false,
  });
}

// ============================================================================
// INLINE PROGRESS INDICATOR
// ============================================================================

interface InlineProgressProps {
  message?: string;
  details?: string;
}

function InlineProgress({ message, details }: InlineProgressProps) {
  return (
    <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-lg px-4 py-3 mb-4">
      <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {message || 'Generating your itinerary...'}
        </p>
        {details && (
          <p className="text-xs text-white/60 truncate">{details}</p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// DEMO BANNER
// ============================================================================

function DemoBanner() {
  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-amber-500 to-orange-500 text-white text-center py-2 px-4 text-sm font-medium shadow-lg">
      <span className="mr-2">📍</span>
      Example trip — Your results will vary based on passport, dates, and budget
      <a
        href="/create"
        className="ml-3 underline underline-offset-2 hover:no-underline font-semibold"
      >
        Plan your own trip →
      </a>
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export interface TripResultsV1Props {
  tripIdOverride?: number;
  tripDataOverride?: any; // Full trip data for demo mode fallback
  isDemo?: boolean;
}

export default function TripResultsV1({ tripIdOverride, tripDataOverride, isDemo = false }: TripResultsV1Props & Record<string, unknown> = {}) {
  const { id } = useParams();
  const tripId = tripIdOverride ?? Number(id);

  // Parse URL params for "What Changed?" banner (from edit flow)
  const searchString = useSearch();
  const urlParams = useMemo(() => new URLSearchParams(searchString), [searchString]);
  const wasUpdated = urlParams.get("updated") === "1";
  const changesParam = urlParams.get("changes");
  const changes = useMemo(() => {
    if (!changesParam) return [];
    try {
      return JSON.parse(decodeURIComponent(changesParam)) as string[];
    } catch {
      return [];
    }
  }, [changesParam]);

  // State for update banner (only show once, dismiss on action or timeout)
  const [showUpdateBanner, setShowUpdateBanner] = useState(wasUpdated);

  // Change Planner hook + banner state
  const { isReplanning, planChanges, applyChanges } = useChangePlanner();
  const [changePlanBanner, setChangePlanBanner] = useState<ChangePlannerResponse | null>(null);

  // Version History hook - creates versions on plan apply
  const { createVersion } = useTripVersions(tripId);

  // Version creation callback for applyChanges
  const handleVersionCreate = useCallback(async (args: {
    source: "change_plan" | "next_fix" | "manual_save" | "system" | "restore";
    changeId: string;
    snapshot: any;
    summary: any;
  }) => {
    try {
      await createVersion(args);
    } catch (err) {
      console.error('[TripResultsV1] Failed to create version:', err);
    }
  }, [createVersion]);

  // Certainty Explanation Drawer state
  const [certaintyDrawerOpen, setCertaintyDrawerOpen] = useState(false);

  // Blocker delta UI state (for Resolved/New chips)
  const [blockerDeltaUI, setBlockerDeltaUI] = useState<BlockerDeltaUI | null>(null);

  // Undo context - stores inputs needed to reverse the last change
  const [undoCtx, setUndoCtx] = useState<UndoContext | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);

  // Certainty history - tracks score evolution across changes (max 5 points)
  const [certaintyHistory, setCertaintyHistory] = useState<CertaintyPoint[]>([]);

  // Helper to add a certainty point (keeps max 5)
  const addCertaintyPoint = useCallback((point: CertaintyPoint) => {
    setCertaintyHistory(prev => {
      const next = [...prev, point];
      // Keep only last 5 points
      return next.slice(-5);
    });
  }, []);

  // URL plan param management (for shareable links)
  const setPlanInUrl = useCallback((plan: ChangePlannerResponse, source?: string) => {
    const url = new URL(window.location.href);
    if (plan.changeId) {
      url.searchParams.set("plan", plan.changeId);
    }
    if (source) {
      url.searchParams.set("planSource", source);
    }
    window.history.replaceState({}, "", url.toString());
  }, []);

  const clearPlanFromUrl = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("plan");
    url.searchParams.delete("planSource");
    window.history.replaceState({}, "", url.toString());
  }, []);

  // Read plan param from URL (for shared links)
  const planParam = useMemo(() => urlParams.get("plan"), [urlParams]);

  // Check if current banner matches URL param (shared link opened)
  const isSharedLink = useMemo(() => {
    if (!planParam || !changePlanBanner?.changeId) return false;
    return planParam === changePlanBanner.changeId;
  }, [planParam, changePlanBanner?.changeId]);

  // Fire-and-forget persist of applied plan for shareable links
  const persistAppliedPlan = useCallback(async (
    currentTripId: number,
    plan: ChangePlannerResponse,
    source?: string
  ) => {
    try {
      const res = await fetch(`/api/trips/${currentTripId}/applied-plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changeId: plan.changeId,
          source: source || "edit_trip",
          planSummary: {
            detectedChanges: plan.detectedChanges || [],
            deltaSummary: plan.deltaSummary,
            failures: plan.failures,
            uiInstructions: plan.uiInstructions,
          },
        }),
      });
      if (res.ok) {
        trackTripEvent(currentTripId, "applied_plan_persisted", {
          changeId: plan.changeId,
          source: source || "unknown",
        });
      } else {
        trackTripEvent(currentTripId, "applied_plan_persist_failed", {
          changeId: plan.changeId,
          source: source || "unknown",
          status: res.status,
        });
      }
    } catch (err) {
      trackTripEvent(tripId, "applied_plan_persist_failed", {
        changeId: plan.changeId,
        source: source || "unknown",
        error: "network",
      });
    }
  }, [tripId]);

  // Wrapper that sets both banner and delta state together
  // Also updates URL for shareable links and persists to server
  const handleSetBannerPlan = useCallback((plan: ChangePlannerResponse | null, source?: string) => {
    setChangePlanBanner(plan);
    setBlockerDeltaUI(plan ? getBlockerDeltaUI(plan) : null);

    // Update URL for shareable links
    if (plan) {
      setPlanInUrl(plan, source);
      // Fire-and-forget persist to server (non-blocking)
      persistAppliedPlan(tripId, plan, source);
    } else {
      clearPlanFromUrl();
    }
  }, [setPlanInUrl, clearPlanFromUrl, persistAppliedPlan, tripId]);

  // Fetch trip data (skip if we have tripDataOverride)
  const { data: trip, isLoading, error } = useTrip(tripDataOverride ? -1 : tripId);

  // Use override data if provided, otherwise use fetched data
  const effectiveTrip = tripDataOverride || trip;

  const queryClient = useQueryClient();

  // Working trip state - for optimistic updates
  const [workingTrip, setWorkingTrip] = useState<TripResponse | null>(null);
  const [highlightedLocation, setHighlightedLocation] = useState<string | null>(null);
  const [activeDayIndex, setActiveDayIndex] = useState<number | null>(null);
  const [chatOpened, setChatOpened] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [allDaysExpanded, setAllDaysExpanded] = useState(true);
  const [showDistances, setShowDistances] = useState(false);

  // Original trip snapshot - for compare plans feature (Item 15)
  const originalTripRef = useRef<TripResponse | null>(null);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const compareButtonRef = useRef<HTMLButtonElement | null>(null);

  // Timeout and retry state
  const [generationStartTime] = useState(() => Date.now());
  const [showTimeout, setShowTimeout] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Calculate trip duration from dates for dynamic timeout
  const tripDurationDays = useMemo(() => {
    if (!workingTrip?.dates) return 7; // default
    const dates = workingTrip.dates;

    // Try to extract duration from various formats
    // "May 15, 2026 - May 31, 2026" or "2025-02-15 to 2025-02-22" or "7 days"
    const daysMatch = dates.match(/(\d+)\s*days?/i);
    if (daysMatch) return parseInt(daysMatch[1], 10);

    // Try to parse date range
    const parts = dates.split(/\s*(?:to|-|–)\s*/);
    if (parts.length === 2) {
      try {
        const start = new Date(parts[0].trim());
        const end = new Date(parts[1].trim());
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          const diffMs = end.getTime() - start.getTime();
          const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
          if (days > 0 && days < 100) return days;
        }
      } catch {
        // parsing failed, use default
      }
    }

    return 7; // default
  }, [workingTrip?.dates]);

  // Dynamic timeout threshold based on trip complexity
  // Base: 60s + 8s per day, min 90s, max 300s (5 min)
  const TIMEOUT_THRESHOLD_MS = useMemo(() => {
    const baseMs = 60000;
    const perDayMs = 8000;
    const calculated = baseMs + (tripDurationDays * perDayMs);
    return Math.min(Math.max(calculated, 90000), 300000);
  }, [tripDurationDays]);

  // Safe merge from server into working state
  useEffect(() => {
    if (!effectiveTrip) return;
    setWorkingTrip(prev => {
      if (!prev) return effectiveTrip;
      return {
        ...prev,
        feasibilityStatus: effectiveTrip.feasibilityStatus,
        feasibilityReport: effectiveTrip.feasibilityReport ?? prev.feasibilityReport,
        itinerary: effectiveTrip.itinerary ?? prev.itinerary,
        updatedAt: effectiveTrip.updatedAt,
      };
    });
  }, [effectiveTrip]);

  // Build analytics context once when trip loads
  const analyticsContext = useMemo(() => {
    if (!workingTrip) return undefined;
    return buildTripContext(workingTrip);
  }, [workingTrip?.id, workingTrip?.feasibilityReport]);

  // Compare modal handlers with focus management (placed after analyticsContext)
  const openCompareModal = useCallback(() => {
    setIsCompareModalOpen(true);
    trackTripEvent(tripId, 'compare_opened', {
      changeId: changePlanBanner?.changeId,
    }, analyticsContext);
  }, [tripId, changePlanBanner?.changeId, analyticsContext]);

  const closeCompareModal = useCallback(() => {
    setIsCompareModalOpen(false);
    trackTripEvent(tripId, 'compare_closed', {
      changeId: changePlanBanner?.changeId,
    }, analyticsContext);
    // Return focus to trigger button after modal unmount paints
    requestAnimationFrame(() => compareButtonRef.current?.focus());
  }, [tripId, changePlanBanner?.changeId, analyticsContext]);

  // Handle share analytics (placed after analyticsContext is defined)
  const handleShareClick = useCallback((success: boolean) => {
    // Track both click and copy result
    trackTripEvent(tripId, 'plan_share_clicked', {
      changeId: changePlanBanner?.changeId,
    }, analyticsContext);
    trackTripEvent(tripId, 'plan_share_copied', {
      changeId: changePlanBanner?.changeId,
      success,
    }, analyticsContext);
  }, [tripId, changePlanBanner?.changeId, analyticsContext]);

  // Check if still generating
  const isGenerating = useMemo(() => {
    if (!workingTrip) return true;
    const s = workingTrip.feasibilityStatus;
    const hasItinerary = !!(workingTrip.itinerary as any)?.days?.length;
    if (s === 'pending') return true;
    if ((s === 'yes' || s === 'warning') && !hasItinerary) return true;
    return false;
  }, [workingTrip]);

  // Capture original trip snapshot once generation completes (for compare feature)
  useEffect(() => {
    if (!workingTrip || isGenerating) return;
    // Only capture once - when we have a complete trip
    if (!originalTripRef.current) {
      // Deep clone to prevent mutations
      originalTripRef.current = JSON.parse(JSON.stringify(workingTrip));
    }
  }, [workingTrip, isGenerating]);

  // Fetch progress while generating
  const { data: progress } = useTripProgress(tripId, isGenerating);

  // Timeout detection - show timeout UI if generation takes too long
  useEffect(() => {
    if (!isGenerating) {
      setShowTimeout(false);
      return;
    }

    const checkTimeout = () => {
      const elapsed = Date.now() - generationStartTime;
      if (elapsed > TIMEOUT_THRESHOLD_MS && isGenerating) {
        setShowTimeout(true);
      }
    };

    const interval = setInterval(checkTimeout, 5000);
    return () => clearInterval(interval);
  }, [isGenerating, generationStartTime, TIMEOUT_THRESHOLD_MS]);

  // Retry handler - invalidate queries to refetch
  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    setShowTimeout(false);

    // Invalidate trip query to trigger refetch
    await queryClient.invalidateQueries({ queryKey: [api.trips.get.path, tripId] });

    // Reset retry state after a moment
    setTimeout(() => setIsRetrying(false), 2000);
  }, [queryClient, tripId]);

  // Keep waiting handler - dismiss popup and continue polling
  const handleKeepWaiting = useCallback(() => {
    setShowTimeout(false);
    // Give user another full timeout period before showing again
  }, []);

  // Track generation events
  useEffect(() => {
    if (workingTrip && isGenerating) {
      trackTripEvent(
        workingTrip.id,
        'itinerary_generate_started',
        { destination: workingTrip.destination, passport: workingTrip.passport },
        analyticsContext
      );
    }
  }, [workingTrip?.id, isGenerating, analyticsContext]);

  // Track feasibility_completed when feasibility analysis is done
  useEffect(() => {
    if (!workingTrip) return;
    const status = workingTrip.feasibilityStatus;
    // Fire when feasibility is complete (not pending)
    if (status && status !== 'pending') {
      const report = workingTrip.feasibilityReport as any;
      trackTripEvent(
        workingTrip.id,
        'feasibility_completed',
        {
          verdict: status,
          certaintyScore: report?.score,
          visaType: report?.visaDetails?.type,
        },
        analyticsContext
      );
    }
  }, [workingTrip?.id, workingTrip?.feasibilityStatus]);

  // Initialize certainty history with initial score (once per trip)
  useEffect(() => {
    if (!workingTrip) return;
    const report = workingTrip.feasibilityReport as any;
    const score = report?.score;
    if (typeof score !== 'number') return;

    // Only add initial point if history is empty
    setCertaintyHistory(prev => {
      if (prev.length > 0) return prev;
      // Convert createdAt to ISO string (handles Date or string)
      const createdAt = workingTrip.createdAt;
      const atString = createdAt instanceof Date
        ? createdAt.toISOString()
        : (typeof createdAt === 'string' ? createdAt : new Date().toISOString());
      return [{
        id: 'initial',
        score,
        at: atString,
        label: 'Initial',
        source: 'initial',
      }];
    });
  }, [workingTrip?.id, workingTrip?.feasibilityReport]);

  // Restore banner from URL param on page load (for shared links)
  // Only runs once on initial load - does not overwrite if user has applied a newer plan
  const [hasAttemptedRestore, setHasAttemptedRestore] = useState(false);

  useEffect(() => {
    if (!workingTrip?.id) return;
    if (!planParam) return;
    if (hasAttemptedRestore) return; // Only attempt once per page load

    // If user already has a banner (applied a plan in this session), don't overwrite
    // They are "ahead" of the shared link
    if (changePlanBanner) return;

    setHasAttemptedRestore(true);
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/trips/${workingTrip.id}/applied-plans/${planParam}`);
        if (!res.ok) {
          trackTripEvent(workingTrip.id, "shared_plan_load_failed", {
            changeId: planParam,
            status: res.status,
          });
          // 404 = plan not found, clear URL param gracefully
          if (res.status === 404) {
            clearPlanFromUrl();
          }
          return;
        }

        const data = await res.json();
        if (cancelled) return;

        // Construct a minimal ChangePlannerResponse for the banner
        // Cast to any since we only need changeId, deltaSummary, uiInstructions for display
        const restoredPlan = {
          changeId: data.changeId,
          detectedChanges: data.detectedChanges || [],
          deltaSummary: data.deltaSummary,
          uiInstructions: data.uiInstructions || {},
          failures: data.failures,
        } as ChangePlannerResponse;

        // Set banner directly (don't persist again since it's already stored)
        setChangePlanBanner(restoredPlan);
        setBlockerDeltaUI(getBlockerDeltaUI(restoredPlan));

        trackTripEvent(workingTrip.id, "shared_plan_loaded", {
          changeId: planParam,
          source: data.source || "unknown",
        });
      } catch (err) {
        trackTripEvent(workingTrip.id, "shared_plan_load_failed", {
          changeId: planParam,
          error: "network",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workingTrip?.id, planParam, changePlanBanner, hasAttemptedRestore, clearPlanFromUrl]);

  // Fire generate_completed exactly once when itinerary appears
  useEffect(() => {
    if (!workingTrip) return;
    const hasItinerary = !!(workingTrip.itinerary as any)?.days?.length;
    if (hasItinerary && !isGenerating) {
      trackTripEvent(
        workingTrip.id,
        'itinerary_generate_completed',
        {
          certaintyScore: (workingTrip.feasibilityReport as any)?.score,
          daysCount: (workingTrip.itinerary as any)?.days?.length,
        },
        analyticsContext
      );
    }
  }, [workingTrip, isGenerating, analyticsContext]);

  // Fire itinerary_viewed when page loads with itinerary (separate from generate)
  useEffect(() => {
    if (!workingTrip) return;
    const hasItinerary = !!(workingTrip.itinerary as any)?.days?.length;
    if (hasItinerary) {
      trackTripEvent(
        workingTrip.id,
        'itinerary_viewed',
        {
          daysCount: (workingTrip.itinerary as any)?.days?.length,
          isDemo,
        },
        analyticsContext,
        isDemo ? 'demo' : 'results_v1'
      );
    }
  }, [workingTrip?.id]); // Only fire once per trip load

  // Auto-clear blocker delta UI after 12 seconds (premium feel)
  useEffect(() => {
    if (!blockerDeltaUI) return;
    const timer = window.setTimeout(() => setBlockerDeltaUI(null), 12000);
    return () => window.clearTimeout(timer);
  }, [blockerDeltaUI]);

  // Auto-expire undo window after 60 seconds
  useEffect(() => {
    if (!undoCtx) return;
    const timer = window.setTimeout(() => setUndoCtx(null), 60_000);
    return () => window.clearTimeout(timer);
  }, [undoCtx]);

  // Day click handler
  const handleDayClick = useCallback((dayIndex: number) => {
    setActiveDayIndex(dayIndex);
  }, []);

  // Activity click handler (for DayCardList -> map sync)
  const handleActivityClick = useCallback((activityKey: string) => {
    setHighlightedLocation(activityKey);
    // Analytics is handled inside DayCardList
  }, []);

  // Activity hover handler (for DayCardList -> map sync)
  const handleActivityHover = useCallback((activityKey: string | null) => {
    setHighlightedLocation(activityKey);
  }, []);

  // Map marker click handler - also scrolls to activity in itinerary (throttled)
  const handleMapMarkerClick = useCallback((locationId: string) => {
    setHighlightedLocation(locationId);
    trackTripEvent(tripId, 'map_marker_clicked', { locationId }, analyticsContext);

    // Throttle scroll to avoid DOM query spam
    if (scrollTimeoutRef.current) {
      window.clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = window.setTimeout(() => {
      const el = document.querySelector(`[data-activity-key="${locationId}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  }, [tripId, analyticsContext]);

  // Chat handlers
  const handleChatOpen = useCallback(() => {
    if (!chatOpened) {
      setChatOpened(true);
      trackTripEvent(tripId, 'chat_opened', {}, analyticsContext);
    }
  }, [chatOpened, tripId, analyticsContext]);

  // Map expand toggle handler
  const handleMapExpandToggle = useCallback(() => {
    setIsMapExpanded(prev => !prev);
  }, []);

  // Ref for throttling map marker scroll
  const scrollTimeoutRef = useRef<number | null>(null);

  // Cleanup scroll timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const handleTripUpdate = useCallback((updatedData: { itinerary?: any; budgetBreakdown?: any }) => {
    setWorkingTrip(prev => {
      if (!prev) return prev;

      const next = { ...prev };

      if (updatedData.itinerary) {
        (next as any).itinerary = updatedData.itinerary;
      }

      if (updatedData.budgetBreakdown) {
        if ((next as any).itinerary) {
          (next as any).itinerary.costBreakdown = updatedData.budgetBreakdown;
        }
      }

      trackTripEvent(tripId, 'chat_change_applied', {}, analyticsContext);
      return next;
    });
  }, [tripId, analyticsContext]);

  // Handle undo - swap inputs and re-run Change Planner
  const handleUndo = useCallback(async () => {
    if (!undoCtx || !workingTrip || isUndoing) return;

    setIsUndoing(true);

    // Track undo click
    const elapsedSinceApply = Math.round(
      (Date.now() - new Date(undoCtx.appliedAt).getTime()) / 1000
    );
    trackTripEvent(tripId, 'trip_change_undo_clicked', {
      originalChangeId: undoCtx.changeId,
      source: undoCtx.source,
      elapsedSecondsSinceApply: elapsedSinceApply,
    }, analyticsContext);

    try {
      // Plan the reverse change (swap prevInput and nextInput)
      const plan = await planChanges({
        tripId,
        prevInput: undoCtx.nextInput,  // swap
        nextInput: undoCtx.prevInput,  // swap
        currentResults: workingTrip,
        source: "quick_chip",
      });

      // Apply reverse plan (with version creation)
      applyChanges({
        tripId,
        plan,
        setWorkingTrip,
        setBannerPlan: handleSetBannerPlan,
        source: "undo",
        onVersionCreate: handleVersionCreate,
      });

      // Add certainty point for undo
      const newScore = plan.deltaSummary?.certainty?.after;
      if (typeof newScore === 'number') {
        addCertaintyPoint({
          id: plan.changeId || `undo-${Date.now()}`,
          score: newScore,
          at: new Date().toISOString(),
          label: 'Undo',
          source: 'undo',
        });
      }

      // Track successful undo
      trackTripEvent(tripId, 'trip_change_undo_applied', {
        originalChangeId: undoCtx.changeId,
        source: undoCtx.source,
      }, analyticsContext);

      // Clear undo context after successful undo
      setUndoCtx(null);
    } catch (err) {
      console.error('[TripResultsV1] Undo failed:', err);
      // Could add toast here in future
    } finally {
      setIsUndoing(false);
    }
  }, [undoCtx, workingTrip, isUndoing, tripId, analyticsContext, planChanges, applyChanges, setWorkingTrip, handleSetBannerPlan, addCertaintyPoint, handleVersionCreate]);

  // ============================================================================
  // ITEM 16: NEXT FIX SUGGESTION
  // ============================================================================

  // Deduplication: track last shown suggestion to prevent event spam
  const lastShownSuggestionKeyRef = useRef<string | null>(null);

  // Snooze: hide suggestion until next plan change (session-only)
  const [snoozedSuggestionKey, setSnoozedSuggestionKey] = useState<string | null>(null);

  // Idempotency: prevent double-click on apply
  const [isApplyingFix, setIsApplyingFix] = useState(false);

  // Compute suggestion based on comparison (only when banner is shown)
  const nextFixSuggestion = useMemo((): NextFixSuggestion | null => {
    if (!changePlanBanner || !originalTripRef.current || !workingTrip) {
      return null;
    }
    const comparison = comparePlans(originalTripRef.current, workingTrip);
    return suggestNextFix(comparison, { trip: workingTrip });
  }, [changePlanBanner, workingTrip]);

  // Build unique key for suggestion deduplication
  const suggestionKey = useMemo(() => {
    if (!nextFixSuggestion || !changePlanBanner) return null;
    return `${tripId}:${changePlanBanner.changeId}:${nextFixSuggestion.id}`;
  }, [tripId, changePlanBanner?.changeId, nextFixSuggestion?.id]);

  // Check if suggestion is snoozed
  const isSuggestionSnoozed = suggestionKey === snoozedSuggestionKey;

  // Track when suggestion is shown (deduplicated)
  useEffect(() => {
    if (!nextFixSuggestion || !changePlanBanner || !suggestionKey) return;
    if (isSuggestionSnoozed) return; // Don't track snoozed suggestions

    // Dedupe: only fire if this is a new suggestion key
    if (lastShownSuggestionKeyRef.current === suggestionKey) return;
    lastShownSuggestionKeyRef.current = suggestionKey;

    trackTripEvent(tripId, 'next_fix_shown', {
      changeId: changePlanBanner.changeId,
      ...getSuggestionAnalyticsData(nextFixSuggestion),
    }, analyticsContext);
  }, [suggestionKey, nextFixSuggestion, changePlanBanner, tripId, analyticsContext, isSuggestionSnoozed]);

  // Reset snooze when plan changes (new changeId = new opportunity)
  useEffect(() => {
    if (changePlanBanner?.changeId) {
      setSnoozedSuggestionKey(null);
    }
  }, [changePlanBanner?.changeId]);

  // Handle apply suggestion (with idempotency guard)
  const handleApplySuggestion = useCallback(async (suggestion: NextFixSuggestion) => {
    // Idempotency: prevent double-clicks
    if (isApplyingFix || !workingTrip) return;
    setIsApplyingFix(true);

    try {
      trackTripEvent(tripId, 'next_fix_applied', {
        changeId: changePlanBanner?.changeId,
        ...getSuggestionAnalyticsData(suggestion),
      }, analyticsContext);

      // Build context for applyFix dispatcher
      const applyContext: ApplyFixContext = {
        tripId: tripId,
        trip: workingTrip,

        // Change planner integration
        planChanges,
        applyChanges,
        setWorkingTrip,
        setBannerPlan: handleSetBannerPlan,

        // Version creation integration
        onVersionCreate: handleVersionCreate,

        // Undo integration
        handleUndo: undoCtx ? handleUndo : undefined,

        // Refetch integration - use correct query key from use-trips.ts
        refetchTrip: async () => {
          await queryClient.invalidateQueries({ queryKey: [api.trips.get.path, tripId] });
        },

        // UI callbacks - minimal working implementations
        openEditor: (target) => {
          trackTripEvent(tripId, 'next_fix_editor_requested', {
            editor: target,
            changeId: changePlanBanner?.changeId,
          }, analyticsContext);

          // Scroll to relevant section based on target
          const sectionMap: Record<string, string> = {
            budget: 'cost-breakdown',
            hotels: 'cost-breakdown',
            flights: 'cost-breakdown',
            itinerary: 'day-card-list',
            dates: 'header-bar',
            visa_docs: 'action-items',
          };
          const sectionId = sectionMap[target];
          if (sectionId) {
            const el = document.getElementById(sectionId) || document.querySelector(`[data-section="${sectionId}"]`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        },
        showToast: (message, type) => {
          // Simple console + could wire to toast system later
          const icon = type === 'success' ? '✓' : type === 'warning' ? '⚠' : 'ℹ';
          console.log(`[Toast ${icon}] ${message}`);
        },
      };

      // Route through applyFix dispatcher
      const result: ApplyFixResult = await applyFix(suggestion, applyContext);

      // Track result
      trackTripEvent(tripId, 'next_fix_result', {
        changeId: changePlanBanner?.changeId,
        suggestionId: suggestion.id,
        success: result.success,
        action: result.action,
        message: result.message,
      }, analyticsContext);

      // If patch was applied, update certainty history from planner result (not stale trip)
      if (result.success && result.action === 'applied' && result.newChangeId && result.newCertaintyScore != null) {
        addCertaintyPoint({
          id: result.newChangeId,
          score: result.newCertaintyScore, // Use planner's result, not stale workingTrip
          at: new Date().toISOString(),
          label: suggestion.title.slice(0, 20),
          source: 'fix_blocker',
        });
      }
    } catch (err) {
      console.error('[handleApplySuggestion] Error:', err);
      trackTripEvent(tripId, 'next_fix_error', {
        changeId: changePlanBanner?.changeId,
        suggestionId: suggestion.id,
        error: err instanceof Error ? err.message : 'Unknown error',
      }, analyticsContext);
    } finally {
      setIsApplyingFix(false);
    }
  }, [tripId, changePlanBanner?.changeId, analyticsContext, undoCtx, handleUndo, isApplyingFix, workingTrip, planChanges, applyChanges, setWorkingTrip, handleSetBannerPlan, queryClient, addCertaintyPoint, handleVersionCreate]);

  // Handle snooze suggestion (hides until next plan change)
  const handleSnoozeSuggestion = useCallback((suggestion: NextFixSuggestion) => {
    if (!suggestionKey) return;
    setSnoozedSuggestionKey(suggestionKey);
    trackTripEvent(tripId, 'next_fix_snoozed', {
      changeId: changePlanBanner?.changeId,
      ...getSuggestionAnalyticsData(suggestion),
    }, analyticsContext);
  }, [tripId, changePlanBanner?.changeId, analyticsContext, suggestionKey]);

  // Handle dismiss suggestion (permanent for this suggestion instance)
  const handleDismissSuggestion = useCallback((suggestion: NextFixSuggestion) => {
    trackTripEvent(tripId, 'next_fix_dismissed', {
      changeId: changePlanBanner?.changeId,
      ...getSuggestionAnalyticsData(suggestion),
    }, analyticsContext);
  }, [tripId, changePlanBanner?.changeId, analyticsContext]);

  // Effective suggestion to show (null if snoozed)
  const effectiveSuggestion = isSuggestionSnoozed ? null : nextFixSuggestion;

  // Memoize costs with budget delta (must be before early returns for hook rules)
  const costs = useMemo(() => {
    if (!workingTrip) return null;
    const itinerary = workingTrip.itinerary as any;
    const costBreakdown = itinerary?.costBreakdown;
    if (!costBreakdown) return null;

    const grand = Number(costBreakdown.total ?? costBreakdown.grandTotal) || 0;
    const size = workingTrip.groupSize || 1;
    const currency = workingTrip.currency || 'USD';
    // Robust budget parsing: handle strings like "2000", "$2,000", "2000.50"
    const userBudget = typeof workingTrip.budget === 'number'
      ? workingTrip.budget
      : Number(String(workingTrip.budget || '').replace(/[^\d.]/g, '')) || 0;

    // Budget delta calculations
    const overByAmount = grand - userBudget;
    const overByPercent = userBudget > 0 ? (overByAmount / userBudget) * 100 : 0;

    // Budget status: under | near | over20 | over50
    let budgetStatus: 'under' | 'near' | 'over20' | 'over50' = 'under';
    if (overByPercent >= 50) {
      budgetStatus = 'over50';
    } else if (overByPercent >= 20) {
      budgetStatus = 'over20';
    } else if (overByPercent > -10) {
      // Within 10% under budget = "near"
      budgetStatus = 'near';
    }

    return {
      flights: Number(costBreakdown.flights) || 0,
      accommodation: Number(costBreakdown.accommodation) || 0,
      activities: Number(costBreakdown.activities) || 0,
      food: Number(costBreakdown.food) || 0,
      transport: Number(costBreakdown.localTransport ?? costBreakdown.transport) || 0,
      visa: Number(costBreakdown.visa) || 0,
      insurance: Number(costBreakdown.insurance) || 0,
      miscellaneous: Number(costBreakdown.miscellaneous ?? costBreakdown.misc) || 0,
      grandTotal: grand,
      perPerson: Math.round(grand / size) || 0,
      currency,
      // Budget delta
      userBudget,
      overByAmount,
      overByPercent,
      budgetStatus,
    };
  }, [workingTrip]);

  // Memoize narrative subtitle (must be before early returns)
  const narrativeSubtitle = useMemo(() => {
    if (!workingTrip) return null;
    if (isGenerating) return null;
    const itinerary = workingTrip.itinerary as any;
    if (!itinerary?.days?.length) return null;
    return generateNarrativeSubtitle(workingTrip, itinerary);
  }, [workingTrip, isGenerating]);

  // Memoize verdict computation (must be before early returns)
  const verdictResult = useMemo(() => {
    if (!workingTrip) return null;

    // Try to extract travel date from trip dates
    // Formats: "Dec 15-22, 2025", "2025-12-15 to 2025-12-22", "May 15, 2025 - May 22, 2025"
    let travelDate: Date | undefined;
    const dateStr = workingTrip.dates;

    if (dateStr) {
      // Strategy 1: Try ISO format first (most reliable)
      const isoMatch = dateStr.match(/(\d{4}-\d{2}-\d{2})/);
      if (isoMatch) {
        const parsed = new Date(isoMatch[1]);
        if (!isNaN(parsed.getTime())) {
          travelDate = parsed;
        }
      }

      // Strategy 2: "Dec 15-22, 2025" format - extract start day and year
      if (!travelDate) {
        const rangeMatch = dateStr.match(/^(\w+)\s+(\d+)(?:-\d+)?,?\s*(\d{4})$/);
        if (rangeMatch) {
          // Reconstruct as "Dec 15, 2025"
          const parsed = new Date(`${rangeMatch[1]} ${rangeMatch[2]}, ${rangeMatch[3]}`);
          if (!isNaN(parsed.getTime())) {
            travelDate = parsed;
          }
        }
      }

      // Strategy 3: "May 15, 2025 - May 22, 2025" - split on " - " or " to "
      if (!travelDate) {
        const parts = dateStr.split(/\s+(?:to|-|–)\s+/);
        if (parts.length >= 1) {
          const parsed = new Date(parts[0].trim());
          if (!isNaN(parsed.getTime())) {
            travelDate = parsed;
          }
        }
      }

      // Strategy 4: Last resort - try native parsing of whole string
      if (!travelDate) {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          travelDate = parsed;
        }
      }
    }

    // Build input and compute verdict
    const verdictInput = buildVerdictInput(
      {
        feasibilityReport: workingTrip.feasibilityReport as any,
        budget: workingTrip.budget,
        dates: workingTrip.dates,
      },
      travelDate
    );

    return computeVerdict(verdictInput);
  }, [workingTrip?.id, workingTrip?.feasibilityReport, workingTrip?.budget, workingTrip?.dates]);

  // Loading state (skip if we have tripDataOverride)
  if (!tripDataOverride && (isLoading || !workingTrip)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // Error state - use premium component (skip if we have tripDataOverride)
  if (!tripDataOverride && error) {
    return (
      <ErrorState
        title="Couldn't load your trip"
        message={error.message || "Something went wrong while loading your trip details."}
        errorCode={error.name}
        onRetry={handleRetry}
        isRetrying={isRetrying}
      />
    );
  }

  // For tripDataOverride, ensure workingTrip is set
  if (tripDataOverride && !workingTrip) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // At this point workingTrip is guaranteed to be non-null
  if (!workingTrip) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // Trip not feasible - show premium "not feasible" state
  if (workingTrip.feasibilityStatus === 'no') {
    const report = workingTrip.feasibilityReport as any;
    return (
      <NotFeasibleState
        destination={workingTrip.destination || 'Unknown'}
        passport={workingTrip.passport || undefined}
        reason={report?.summary || report?.breakdown?.visa?.reason}
        visaType={report?.visaDetails?.type}
        tripId={workingTrip.id}
      />
    );
  }

  // Timeout state - show retry UI if generation is taking too long
  if (showTimeout && isGenerating) {
    const elapsedSeconds = Math.floor((Date.now() - generationStartTime) / 1000);
    return (
      <TimeoutState
        destination={workingTrip.destination || 'your destination'}
        dates={workingTrip.dates}
        durationDays={tripDurationDays}
        travelStyle={workingTrip.travelStyle || undefined}
        onRetry={handleRetry}
        onKeepWaiting={handleKeepWaiting}
        isRetrying={isRetrying}
        elapsedSeconds={elapsedSeconds}
      />
    );
  }

  // Extract derived values for rendering (costs and narrativeSubtitle are already memoized above)
  const itinerary = workingTrip.itinerary as any;
  const currency = workingTrip.currency || 'USD';

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 ${isDemo ? 'pt-10' : ''}`}>
      {/* Demo banner */}
      {isDemo && <DemoBanner />}

      {/* Sticky headers */}
      <HeaderBar trip={workingTrip} />

      {/* Change Planner banner - shows delta after a trip change is applied */}
      {changePlanBanner && (
        <div className="max-w-7xl mx-auto px-4 md:px-6 pt-3">
          <ChangePlanBanner
            plan={changePlanBanner}
            onDismiss={() => handleSetBannerPlan(null)}
            blockerDelta={blockerDeltaUI}
            canUndo={!!undoCtx}
            onUndo={handleUndo}
            isUndoing={isUndoing}
            onShare={handleShareClick}
            isShared={isSharedLink}
            defaultOpen={isSharedLink}
            canCompare={!!originalTripRef.current}
            onCompare={openCompareModal}
            compareButtonRef={compareButtonRef}
            suggestion={effectiveSuggestion}
            onApplySuggestion={handleApplySuggestion}
            onDismissSuggestion={handleDismissSuggestion}
            onSnoozeSuggestion={handleSnoozeSuggestion}
            isApplyingFix={isApplyingFix}
          />
        </div>
      )}

      {/* "What Changed?" banner - shows after returning from edit flow */}
      {showUpdateBanner && (
        <TripUpdateBanner
          changes={changes}
          onDismiss={() => setShowUpdateBanner(false)}
        />
      )}

      {/* CertaintyBar - show skeleton until feasibility data is available */}
      {workingTrip.feasibilityReport ? (
        <CertaintyBar
          trip={workingTrip}
          onExplainCertainty={() => setCertaintyDrawerOpen(true)}
          certaintyHistory={certaintyHistory}
        />
      ) : (
        <CertaintyBarSkeleton />
      )}

      {/* Main content - two column layout */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left column: Itinerary - scrollable container */}
          <section className="lg:col-span-7 lg:max-h-[calc(100vh-80px)] lg:overflow-y-auto lg:overflow-x-hidden scrollbar-dark">
            {/* Sticky header within scrollable area - solid bg to prevent content showing through */}
            <div className="sticky top-0 z-10 bg-slate-900 pb-3 -mx-1 px-1">
              {/* Title row with controls */}
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-2xl font-display font-bold text-white tracking-tight">
                  {itinerary?.days?.length || '...'} Days in {workingTrip.destination}
                </h2>

                {/* Controls: Expand/Collapse All + Distance Toggle - compact */}
                {!isGenerating && itinerary?.days?.length > 0 && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setAllDaysExpanded(!allDaysExpanded)}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-white/10 text-white/60 hover:bg-white/15 hover:text-white transition-colors"
                      title={allDaysExpanded ? "Collapse all" : "Expand all"}
                    >
                      {allDaysExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      <span>{allDaysExpanded ? "Collapse" : "Expand"}</span>
                    </button>
                    <button
                      onClick={() => setShowDistances(!showDistances)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                        showDistances
                          ? "bg-primary/20 text-primary"
                          : "bg-white/10 text-white/60 hover:bg-white/15 hover:text-white"
                      }`}
                      title={showDistances ? "Hide distances" : "Show distances"}
                    >
                      <Route className="w-3 h-3" />
                      <span>Distances</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Narrative subtitle (memoized) */}
              {narrativeSubtitle && (
                <p className="text-sm text-white/50 mt-1.5 leading-relaxed line-clamp-2">
                  {narrativeSubtitle}
                </p>
              )}
            </div>

            {/* Verdict Card - Trip feasibility summary */}
            {verdictResult ? (
              <div className="mb-4">
                <VerdictCard
                  verdictResult={verdictResult}
                  onShowDetails={() => setCertaintyDrawerOpen(true)}
                />
              </div>
            ) : isGenerating ? (
              <VerdictCardSkeleton />
            ) : null}

            {/* Inline warnings for missing data */}
            {!isGenerating && itinerary?.days?.length > 0 && !costs && (
              <InlineWarning type="missing_costs" />
            )}
            {!isGenerating && itinerary?.days?.length > 0 && costs && costs.grandTotal === 0 && (
              <InlineWarning type="missing_costs" />
            )}

            {/* Streaming progress indicator - non-blocking */}
            {isGenerating && (
              <StreamingProgress
                step={progress?.message || 'Generating your itinerary...'}
                details={progress?.details}
              />
            )}

            {/* Itinerary content */}
            {isGenerating || !itinerary?.days?.length ? (
              <ItinerarySkeleton />
            ) : (
              <div data-section="day-card-list">
                <DayCardList
                  tripId={tripId}
                  itinerary={itinerary as Itinerary}
                  currency={currency}
                  tripStartDate={workingTrip.dates || undefined}
                  activeDayIndex={activeDayIndex}
                  activeActivityKey={highlightedLocation}
                  allExpanded={allDaysExpanded}
                  showDistances={showDistances}
                  onDayClick={handleDayClick}
                  onActivityClick={handleActivityClick}
                  onActivityHover={handleActivityHover}
                  analyticsContext={analyticsContext}
                />
              </div>
            )}
          </section>

          {/* Right column: Map + Panels */}
          <aside className="lg:col-span-5 space-y-4">
            {/* Sticky container for map */}
            <div className="lg:sticky lg:top-[140px]">
              {/* Map - Inline (non-expanded) */}
              <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden aspect-[4/3] mb-4">
                {isGenerating || !itinerary?.days?.length ? (
                  <MapSkeleton />
                ) : (
                  <ItineraryMap
                    trip={workingTrip}
                    onLocationSelect={handleMapMarkerClick}
                    highlightedLocation={highlightedLocation}
                    activeDayIndex={activeDayIndex}
                    isExpanded={false}
                    onExpandToggle={handleMapExpandToggle}
                  />
                )}
              </div>

              {/* Panels - show skeleton during initial generation */}
              {isGenerating && !costs ? (
                <RightRailSkeleton />
              ) : (
                <RightRailPanels
                  trip={workingTrip}
                  costs={costs}
                  onTripUpdate={handleTripUpdate}
                  onChatOpen={handleChatOpen}
                  hasLocalChanges={false}
                  hasUndoableChange={false}
                  onUndo={() => {}}
                  isDemo={isDemo}
                  blockerDelta={blockerDeltaUI}
                />
              )}
            </div>
          </aside>
        </div>
      </main>

      {/* Certainty Explanation Drawer */}
      <CertaintyExplanationDrawer
        open={certaintyDrawerOpen}
        onClose={() => setCertaintyDrawerOpen(false)}
        trip={workingTrip}
        changePlan={changePlanBanner}
      />

      {/* Fix Blockers Controller - always mounted to handle events from anywhere */}
      <FixBlockersController
        trip={workingTrip}
        setWorkingTrip={setWorkingTrip}
        setBannerPlan={handleSetBannerPlan}
        onSetUndoCtx={(ctx) => setUndoCtx({
          ...ctx,
          appliedAt: new Date().toISOString(),
        })}
        onAddCertaintyPoint={addCertaintyPoint}
      />

      {/* Fullscreen Map Modal */}
      {isMapExpanded && !isGenerating && itinerary?.days?.length > 0 && (
        <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm">
          {/* Header bar */}
          <div className="absolute top-0 left-0 right-0 h-14 bg-slate-900/80 backdrop-blur border-b border-white/10 flex items-center justify-between px-4 z-10">
            <div className="flex items-center gap-3">
              <span className="text-white font-semibold">{workingTrip.destination}</span>
              <span className="text-white/50 text-sm">
                {itinerary.days.length} days • {highlightedLocation ? `Location ${highlightedLocation}` : 'All locations'}
              </span>
            </div>
            <button
              onClick={handleMapExpandToggle}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/15 transition-colors text-white/70 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Fullscreen map */}
          <div className="absolute inset-0 pt-14">
            <ItineraryMap
              trip={workingTrip}
              onLocationSelect={handleMapMarkerClick}
              highlightedLocation={highlightedLocation}
              activeDayIndex={activeDayIndex}
              isExpanded={true}
              onExpandToggle={handleMapExpandToggle}
            />
          </div>
        </div>
      )}

      {/* Compare Plans Modal (Item 15) */}
      {originalTripRef.current && workingTrip && (
        <ComparePlansModal
          isOpen={isCompareModalOpen}
          onClose={closeCompareModal}
          originalTrip={originalTripRef.current}
          updatedTrip={workingTrip}
          onKeepUpdated={() => {
            trackTripEvent(tripId, 'compare_keep_updated', {
              changeId: changePlanBanner?.changeId,
            }, analyticsContext);
            closeCompareModal();
          }}
          onKeepOriginal={() => {
            // Revert to original by triggering undo if available
            if (undoCtx) {
              handleUndo();
            }
            trackTripEvent(tripId, 'compare_keep_original', {
              changeId: changePlanBanner?.changeId,
            }, analyticsContext);
            closeCompareModal();
          }}
        />
      )}

      {/* Dev indicator */}
      <div className="fixed bottom-4 right-4 bg-primary/90 text-white text-xs px-3 py-1.5 rounded-full shadow-lg z-50">
        V1 Preview
      </div>
    </div>
  );
}
