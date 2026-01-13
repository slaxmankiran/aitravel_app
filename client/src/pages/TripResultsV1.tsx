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
import { motion } from "framer-motion";
import { Loader2, Calendar, Users, Sparkles, Flag } from "lucide-react";

// Layout components - Cinematic Layout
import { MapBackground } from "@/components/results/MapBackground";
import { FloatingPillHeader } from "@/components/results/FloatingPillHeader";
import { FloatingItinerary } from "@/components/results/FloatingItinerary";
import { LogisticsDrawer } from "@/components/results/LogisticsDrawer";

// Shared components
import { CertaintyExplanationDrawer } from "@/components/results/CertaintyExplanationDrawer";
import { FixBlockersController } from "@/components/results/FixBlockersController";

// Failure state components
import {
  NotFeasibleState,
  TimeoutState,
  ErrorState,
  InlineWarning,
  EmptyItineraryState,
  GeneratingState,
} from "@/components/results/FailureStates";


// Analytics
import { trackTripEvent, buildTripContext, type TripEventContext } from "@/lib/analytics";

// Verdict system
import { computeVerdict, buildVerdictInput, getVerdictDisplay, type VerdictResult } from "@/lib/verdict";


// Blocker deltas
import { getBlockerDeltaUI, type BlockerDeltaUI } from "@/lib/blockerDeltas";

// UI Events (for Fix Blockers modal)
import { openFixBlockersEvent } from "@/lib/uiEvents";

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
// HELPER: Convert country name/code to nationality adjective
// ============================================================================

// ISO 2-letter country codes to nationality adjective
const CODE_TO_NATIONALITY: Record<string, string> = {
  'IN': 'Indian',
  'US': 'American',
  'GB': 'British',
  'UK': 'British',
  'CA': 'Canadian',
  'AU': 'Australian',
  'DE': 'German',
  'FR': 'French',
  'IT': 'Italian',
  'ES': 'Spanish',
  'JP': 'Japanese',
  'CN': 'Chinese',
  'BR': 'Brazilian',
  'MX': 'Mexican',
  'SG': 'Singaporean',
  'MY': 'Malaysian',
  'TH': 'Thai',
  'ID': 'Indonesian',
  'PH': 'Filipino',
  'VN': 'Vietnamese',
  'KR': 'South Korean',
  'NL': 'Dutch',
  'CH': 'Swiss',
  'SE': 'Swedish',
  'NO': 'Norwegian',
  'DK': 'Danish',
  'FI': 'Finnish',
  'PL': 'Polish',
  'RU': 'Russian',
  'ZA': 'South African',
  'NZ': 'New Zealand',
  'IE': 'Irish',
  'PT': 'Portuguese',
  'GR': 'Greek',
  'TR': 'Turkish',
  'EG': 'Egyptian',
  'AE': 'Emirati',
  'SA': 'Saudi',
  'IL': 'Israeli',
  'AR': 'Argentine',
  'CL': 'Chilean',
  'CO': 'Colombian',
  'PE': 'Peruvian',
  'PK': 'Pakistani',
  'BD': 'Bangladeshi',
  'LK': 'Sri Lankan',
  'NP': 'Nepali',
  'BB': 'Barbadian',
  'AT': 'Austrian',
  'BE': 'Belgian',
  'HK': 'Hong Kong',
  'TW': 'Taiwanese',
  'NG': 'Nigerian',
  'KE': 'Kenyan',
  'GH': 'Ghanaian',
  'MA': 'Moroccan',
  'CZ': 'Czech',
  'HU': 'Hungarian',
  'RO': 'Romanian',
  'UA': 'Ukrainian',
};

// Full country names to nationality adjective
const NATIONALITY_MAP: Record<string, string> = {
  'India': 'Indian',
  'United States': 'American',
  'USA': 'American',
  'United Kingdom': 'British',
  'UK': 'British',
  'Canada': 'Canadian',
  'Australia': 'Australian',
  'Germany': 'German',
  'France': 'French',
  'Italy': 'Italian',
  'Spain': 'Spanish',
  'Japan': 'Japanese',
  'China': 'Chinese',
  'Brazil': 'Brazilian',
  'Mexico': 'Mexican',
  'Singapore': 'Singaporean',
  'Malaysia': 'Malaysian',
  'Thailand': 'Thai',
  'Indonesia': 'Indonesian',
  'Philippines': 'Filipino',
  'Vietnam': 'Vietnamese',
  'South Korea': 'South Korean',
  'Netherlands': 'Dutch',
  'Switzerland': 'Swiss',
  'Sweden': 'Swedish',
  'Norway': 'Norwegian',
  'Denmark': 'Danish',
  'Finland': 'Finnish',
  'Poland': 'Polish',
  'Russia': 'Russian',
  'South Africa': 'South African',
  'New Zealand': 'New Zealand',
  'Ireland': 'Irish',
  'Portugal': 'Portuguese',
  'Greece': 'Greek',
  'Turkey': 'Turkish',
  'Egypt': 'Egyptian',
  'UAE': 'Emirati',
  'United Arab Emirates': 'Emirati',
  'Saudi Arabia': 'Saudi',
  'Israel': 'Israeli',
  'Argentina': 'Argentine',
  'Chile': 'Chilean',
  'Colombia': 'Colombian',
  'Peru': 'Peruvian',
  'Pakistan': 'Pakistani',
  'Bangladesh': 'Bangladeshi',
  'Sri Lanka': 'Sri Lankan',
  'Nepal': 'Nepali',
  'Barbados': 'Barbadian',
  'Austria': 'Austrian',
  'Belgium': 'Belgian',
  'Hong Kong': 'Hong Kong',
  'Taiwan': 'Taiwanese',
  'Nigeria': 'Nigerian',
  'Kenya': 'Kenyan',
  'Ghana': 'Ghanaian',
  'Morocco': 'Moroccan',
  'Czech Republic': 'Czech',
  'Hungary': 'Hungarian',
  'Romania': 'Romanian',
  'Ukraine': 'Ukrainian',
};

function getNationalityAdjective(country: string): string {
  // Check if it's a 2-letter country code (uppercase)
  const upperCode = country.toUpperCase();
  if (upperCode.length === 2 && CODE_TO_NATIONALITY[upperCode]) {
    return CODE_TO_NATIONALITY[upperCode];
  }
  // Check exact match in country names
  if (NATIONALITY_MAP[country]) {
    return NATIONALITY_MAP[country];
  }
  // Check case-insensitive match
  const lowerCountry = country.toLowerCase();
  for (const [key, value] of Object.entries(NATIONALITY_MAP)) {
    if (key.toLowerCase() === lowerCountry) {
      return value;
    }
  }
  // Fallback: just return the country name as-is
  return country;
}

// ============================================================================
// CINEMATIC HERO OVERLAY (for cinematic theme)
// ============================================================================

/**
 * CinematicHeroOverlay - Clean hero with destination metadata only.
 * NO verdict/score here - that's shown in DecisionStack only.
 */
interface CinematicHeroOverlayProps {
  destination: string;
  dates?: string;
  travelers?: number;
  travelStyle?: string;
  passport?: string;
}

function CinematicHeroOverlay({
  destination,
  dates,
  travelers,
  travelStyle,
  passport,
}: CinematicHeroOverlayProps) {

  // Format dates
  const formattedDates = useMemo(() => {
    if (!dates) return null;
    const parts = dates.split(' to ');
    if (parts.length === 2) {
      try {
        const start = new Date(parts[0]);
        const end = new Date(parts[1]);
        const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
        return `${start.toLocaleDateString('en-US', options)} – ${end.toLocaleDateString('en-US', { ...options, year: 'numeric' })}`;
      } catch {
        return dates;
      }
    }
    return dates;
  }, [dates]);

  const styleDisplay = travelStyle
    ? travelStyle.charAt(0).toUpperCase() + travelStyle.slice(1)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="relative"
    >
      {/* Destination title - large and prominent */}
      <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-3 drop-shadow-xl">
        {destination}
      </h1>

      {/* Metadata row - NO verdict here, only destination facts */}
      <div className="flex flex-wrap items-center gap-3 md:gap-4 text-white/80 text-sm">
        {formattedDates && (
          <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1">
            <Calendar className="w-4 h-4" />
            <span>{formattedDates}</span>
          </div>
        )}
        {travelers && (
          <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1">
            <Users className="w-4 h-4" />
            <span>{travelers} traveler{travelers !== 1 ? 's' : ''}</span>
          </div>
        )}
        {styleDisplay && (
          <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1">
            <Sparkles className="w-4 h-4" />
            <span>{styleDisplay}</span>
          </div>
        )}
        {passport && (
          <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1">
            <Flag className="w-4 h-4" />
            <span>{getNationalityAdjective(passport)} Passport</span>
          </div>
        )}
      </div>
      {/* NOTE: Verdict/score is shown ONLY in DecisionStack (right rail) */}
    </motion.div>
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

  // Track whether we've already triggered generation to avoid duplicates
  const generationTriggeredRef = useRef(false);

  // Auto-trigger itinerary generation if trip is waiting for it
  // This handles the case where user navigates directly to results without going through feasibility page
  useEffect(() => {
    // Only trigger once per mount
    if (generationTriggeredRef.current) return;
    // Need progress data with needsGeneration flag
    if (!progress?.needsGeneration) return;
    // Need a valid trip ID
    if (!tripId) return;

    console.log(`[TripResultsV1] Auto-triggering itinerary generation for trip ${tripId}`);
    generationTriggeredRef.current = true;

    // Fire and forget - trigger the generation
    fetch(`/api/trips/${tripId}/generate-itinerary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).then(res => {
      if (!res.ok) {
        console.error('[TripResultsV1] Failed to trigger itinerary generation:', res.status);
        // Reset flag so we can retry on next poll
        generationTriggeredRef.current = false;
      } else {
        console.log('[TripResultsV1] Itinerary generation triggered successfully');
        // Invalidate progress query to get fresh status
        queryClient.invalidateQueries({ queryKey: ['trip-progress', tripId] });
      }
    }).catch(err => {
      console.error('[TripResultsV1] Error triggering itinerary generation:', err);
      generationTriggeredRef.current = false;
    });
  }, [progress?.needsGeneration, tripId, queryClient]);

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
    // Only calculate "over" if user specified a realistic budget (>= $100 per person)
    const minRealisticBudget = 100 * size;
    const hasBudgetSet = userBudget >= minRealisticBudget;

    const overByAmount = hasBudgetSet ? grand - userBudget : 0;
    const overByPercent = hasBudgetSet && userBudget > 0 ? (overByAmount / userBudget) * 100 : 0;

    // Budget status: under | near | over20 | over50
    // If no realistic budget set, always show "under" (neutral state)
    let budgetStatus: 'under' | 'near' | 'over20' | 'over50' = 'under';
    if (hasBudgetSet) {
      if (overByPercent >= 50) {
        budgetStatus = 'over50';
      } else if (overByPercent >= 20) {
        budgetStatus = 'over20';
      } else if (overByPercent > -10) {
        // Within 10% under budget = "near"
        budgetStatus = 'near';
      }
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
      hasBudgetSet,
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

  // Extract activity coordinates for MapBackground (must be before early returns)
  const activityCoordinates = useMemo(() => {
    const itineraryData = workingTrip?.itinerary as any;
    if (!itineraryData?.days) return [];
    const coords: Array<{
      id: string;
      lat: number;
      lng: number;
      name: string;
      day: number;
      time: string;
      type: 'activity' | 'meal' | 'transport' | 'lodging';
    }> = [];

    itineraryData.days.forEach((day: any) => {
      let activityIndex = 0;
      day.activities?.forEach((activity: any) => {
        activityIndex++;
        let lat: number | undefined;
        let lng: number | undefined;

        if (activity.coordinates?.lat && activity.coordinates?.lng) {
          lat = activity.coordinates.lat;
          lng = activity.coordinates.lng;
        } else if (typeof activity.location === 'object' && activity.location?.lat && activity.location?.lng) {
          lat = activity.location.lat;
          lng = activity.location.lng;
        }

        if (lat && lng) {
          coords.push({
            id: `${day.day}-${activityIndex}`,
            lat,
            lng,
            name: activity.name || activity.description || 'Unknown',
            day: day.day,
            time: activity.time || '',
            type: activity.type || 'activity',
          });
        }
      });
    });

    return coords;
  }, [workingTrip?.itinerary]);

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

  // Generating state - show clean centered loading UI before itinerary is ready
  // This replaces the scattered skeleton approach with a focused, premium experience
  if (isGenerating) {
    const itineraryData = workingTrip.itinerary as any;
    const hasItinerary = !!(itineraryData?.days?.length);

    // Show GeneratingState if we don't have an itinerary yet (initial generation)
    // Once we have partial itinerary data, we switch to inline streaming progress
    if (!hasItinerary) {
      const elapsedSeconds = Math.floor((Date.now() - generationStartTime) / 1000);
      return (
        <GeneratingState
          destination={workingTrip.destination || 'Your Destination'}
          dates={workingTrip.dates || undefined}
          durationDays={tripDurationDays}
          travelers={workingTrip.groupSize || undefined}
          travelStyle={workingTrip.travelStyle || undefined}
          elapsedSeconds={elapsedSeconds}
          currentStep={progress?.message}
          stepDetails={progress?.details}
        />
      );
    }
  }

  // Extract derived values for rendering (costs and narrativeSubtitle are already memoized above)
  const itinerary = workingTrip.itinerary as any;
  const currency = workingTrip.currency || 'USD';

  // ============================================================================
  // CINEMATIC LAYOUT
  // ============================================================================
  return (
    <div className="min-h-screen bg-slate-900 overflow-hidden">
        {/* Demo banner */}
        {isDemo && <DemoBanner />}

        {/* Map as full-screen background */}
        <MapBackground
          activities={activityCoordinates}
          hoveredActivityKey={highlightedLocation}
          onMarkerClick={handleMapMarkerClick}
        />

        {/* Floating Pill Header */}
        <FloatingPillHeader
          trip={workingTrip}
          isDemo={isDemo}
          onDetailsClick={() => setCertaintyDrawerOpen(true)}
        />

        {/* Floating Itinerary Panel (left side) */}
        <FloatingItinerary
          trip={workingTrip}
          isGenerating={isGenerating}
          onActivityHover={handleActivityHover}
          onActivityClick={handleActivityClick}
          onDayClick={handleDayClick}
        />

        {/* Logistics Drawer (bottom-right trigger) */}
        <LogisticsDrawer
          trip={workingTrip}
          costs={costs}
          verdictResult={verdictResult}
          onTripUpdate={handleTripUpdate}
          onChatOpen={handleChatOpen}
          onShowDetails={() => setCertaintyDrawerOpen(true)}
          onFixBlockers={() => openFixBlockersEvent.emit({ source: "other", reason: "unknown" })}
          hasLocalChanges={false}
          hasUndoableChange={!!undoCtx}
          onUndo={handleUndo}
          isDemo={isDemo}
          blockerDelta={blockerDeltaUI}
          onVersionRestore={() => {
            queryClient.invalidateQueries({ queryKey: [api.trips.get.path, tripId] });
          }}
          onVersionExport={(versionId) => {
            window.open(`/trips/${tripId}/export?version=${versionId}`, '_blank');
          }}
        />

        {/* Change Plan Banner - floats above map */}
        {changePlanBanner && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 w-full max-w-lg px-4">
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
              currency={currency}
            />
          </div>
        )}

        {/* Certainty Explanation Drawer */}
        <CertaintyExplanationDrawer
          open={certaintyDrawerOpen}
          onClose={() => setCertaintyDrawerOpen(false)}
          trip={workingTrip}
          changePlan={changePlanBanner}
        />

        {/* Fix Blockers Controller */}
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

        {/* Compare Plans Modal */}
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
              if (undoCtx) handleUndo();
              trackTripEvent(tripId, 'compare_keep_original', {
                changeId: changePlanBanner?.changeId,
              }, analyticsContext);
              closeCompareModal();
            }}
          />
        )}
      </div>
  );
}
