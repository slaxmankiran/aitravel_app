/**
 * TripShareView.tsx
 *
 * Public, read-only view of a shared trip.
 * Phase 3.6 - Share & Validate
 *
 * Route: /share/:tripId
 *
 * Features:
 * - No auth required (public endpoint)
 * - Read-only (no edit buttons, no chat panel)
 * - Clear "Shared Trip" indicator
 * - Prominent CTA: "Plan your own trip"
 * - Works in incognito
 */

import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Eye,
  ArrowRight,
  Calendar,
  Users,
  Sparkles,
  MapPin,
  Share2,
  CheckCircle,
} from "lucide-react";

// Layout components (reused in read-only mode)
import { CertaintyBar } from "@/components/results/CertaintyBar";
import { ResultsBackground } from "@/components/results/ResultsBackground";

// Existing working components
import { ItineraryMap } from "@/components/ItineraryMap";

// DayCardList
import { DayCardList, type Itinerary } from "@/components/results-v1/DayCardList";

// Verdict system
import { computeVerdict, buildVerdictInput } from "@/lib/verdict";

// Skeletons
import {
  CertaintyBarSkeleton,
  ItinerarySkeleton,
  MapSkeleton,
} from "@/components/results/ResultsSkeletons";

import type { TripResponse } from "@shared/schema";

// ============================================================================
// TYPES
// ============================================================================

// ShareableTrip matches the server response from /api/share/:id
type ShareableTrip = Pick<
  TripResponse,
  | "id"
  | "destination"
  | "origin"
  | "dates"
  | "groupSize"
  | "adults"
  | "children"
  | "infants"
  | "travelStyle"
  | "budget"
  | "currency"
  | "passport"
  | "residence"
  | "feasibilityReport"
  | "itinerary"
  | "status"
  | "feasibilityStatus"
  | "createdAt"
>;

// ============================================================================
// HELPERS
// ============================================================================

function formatDateRange(dates: string | null): string {
  if (!dates) return "";
  // Parse "2026-02-15 to 2026-02-22" or "February 2026, 5 days" format
  const rangeMatch = dates.match(/(\d{4}-\d{2}-\d{2})\s*to\s*(\d{4}-\d{2}-\d{2})/);
  if (rangeMatch) {
    const startDate = new Date(rangeMatch[1]);
    const endDate = new Date(rangeMatch[2]);
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${startDate.toLocaleDateString("en-US", opts)} - ${endDate.toLocaleDateString("en-US", opts)}, ${endDate.getFullYear()}`;
  }
  // Return as-is for other formats
  return dates;
}

function getTravelersLabel(trip: ShareableTrip): string {
  const total = trip.groupSize || 1;
  return total === 1 ? "1 traveler" : `${total} travelers`;
}

function getTravelStyleLabel(style: string | null): string {
  if (!style) return "";
  const labels: Record<string, string> = {
    budget: "Budget",
    moderate: "Moderate",
    luxury: "Luxury",
    custom: "Custom",
  };
  return labels[style] || style;
}

/**
 * Convert ShareableTrip to a TripResponse-like object for components.
 * Fills in missing fields with defaults.
 */
function toTripResponse(trip: ShareableTrip): TripResponse {
  return {
    ...trip,
    // Fill in required fields that aren't in ShareableTrip
    userId: null,
    voyageUid: null,
    userNotes: null,
    createdFrom: null,
    updatedAt: null,
    checklistProgress: null,
  } as unknown as TripResponse;
}

// ============================================================================
// SHARE VIEW HEADER (Read-only variant)
// ============================================================================

function ShareViewHeader({
  onPlanOwn,
}: {
  onPlanOwn: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Logo + Shared indicator */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-emerald-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">V</span>
              </div>
              <span className="text-white font-semibold hidden sm:inline">VoyageAI</span>
            </div>

            {/* Shared Trip Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full">
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-medium text-amber-300">Shared Trip</span>
            </div>
          </div>

          {/* Center: intentionally empty - destination lives in hero */}
          <div className="flex-1" />

          {/* Right: CTA */}
          <button
            onClick={onPlanOwn}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg transition-colors"
          >
            <span className="hidden sm:inline">Plan your own trip</span>
            <span className="sm:hidden">Plan trip</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

// ============================================================================
// COST SUMMARY (Read-only, simplified)
// ============================================================================

function CostSummaryCard({ trip }: { trip: ShareableTrip }) {
  const itinerary = trip.itinerary as Itinerary | null;
  const costBreakdown = itinerary?.costBreakdown;

  if (!costBreakdown) return null;

  const currencySymbol =
    trip.currency === "USD" ? "$" : trip.currency === "EUR" ? "€" : trip.currency === "GBP" ? "£" : "$";

  return (
    <div className="bg-slate-800/50 rounded-xl border border-white/10 p-4">
      <h3 className="text-sm font-medium text-white/70 mb-3">Trip Cost Estimate</h3>

      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-3xl font-bold text-white">
          {currencySymbol}
          {costBreakdown.total?.toLocaleString() || "—"}
        </span>
        <span className="text-sm text-white/50">total</span>
      </div>

      {(trip.groupSize || 1) > 1 && (
        <p className="text-xs text-white/40">
          {currencySymbol}
          {Math.round((costBreakdown.total || 0) / (trip.groupSize || 1)).toLocaleString()} per person
        </p>
      )}
    </div>
  );
}

// ============================================================================
// PLAN YOUR OWN CTA (Bottom sticky)
// ============================================================================

function PlanOwnCTA({ onPlanOwn }: { onPlanOwn: () => void }) {
  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.5, duration: 0.4 }}
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
    >
      <div className="bg-slate-900/95 backdrop-blur border-t border-white/10 px-4 py-3">
        <button
          onClick={onPlanOwn}
          className="w-full flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl transition-colors"
        >
          <Sparkles className="w-5 h-5" />
          <span>Plan your own trip</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
}

// ============================================================================
// LOADING STATE
// ============================================================================

function ShareViewLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-700 rounded-lg animate-pulse" />
            <div className="w-24 h-5 bg-slate-700 rounded animate-pulse" />
          </div>
          <div className="w-32 h-10 bg-primary/30 rounded-lg animate-pulse" />
        </div>

        {/* Certainty bar skeleton */}
        <CertaintyBarSkeleton />

        {/* Two columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
          <div className="lg:col-span-7">
            <ItinerarySkeleton />
          </div>
          <div className="lg:col-span-5">
            <MapSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ERROR STATE
// ============================================================================

function ShareViewError({ message, onPlanOwn }: { message: string; onPlanOwn: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
          <Share2 className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Trip not found</h1>
        <p className="text-white/60 mb-6">
          {message || "This shared trip link may have expired or been removed."}
        </p>
        <button
          onClick={onPlanOwn}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl transition-colors"
        >
          <Sparkles className="w-5 h-5" />
          <span>Plan your own trip</span>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TripShareView() {
  const params = useParams<{ tripId: string }>();
  const tripId = Number(params.tripId);
  const [, setLocation] = useLocation();

  // State for day card interactions
  const [activeDayIndex, setActiveDayIndex] = useState<number | null>(null);
  const [highlightedLocation, setHighlightedLocation] = useState<string | null>(null);
  const [allDaysExpanded, setAllDaysExpanded] = useState(true);

  // Fetch trip from public endpoint
  const {
    data: trip,
    isLoading,
    error,
  } = useQuery<ShareableTrip>({
    queryKey: ["share", tripId],
    queryFn: async () => {
      const res = await fetch(`/api/share/${tripId}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to load trip");
      }
      return res.json();
    },
    enabled: !isNaN(tripId) && tripId > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Navigate to create page
  const handlePlanOwn = useCallback(() => {
    // Pre-fill destination if available
    if (trip?.destination) {
      setLocation(`/create?destination=${encodeURIComponent(trip.destination)}`);
    } else {
      setLocation("/create");
    }
  }, [trip?.destination, setLocation]);

  // Compute verdict
  const verdictResult = useMemo(() => {
    if (!trip) return null;
    const input = buildVerdictInput({
      feasibilityReport: trip.feasibilityReport as any,
      budget: trip.budget ?? undefined,
      dates: trip.dates ?? undefined,
    });
    return computeVerdict(input);
  }, [trip]);

  // Convert to TripResponse for components
  const tripResponse = useMemo(() => {
    if (!trip) return null;
    return toTripResponse(trip);
  }, [trip]);

  // Cast itinerary
  const itinerary = trip?.itinerary as Itinerary | null;

  // Map locations for activity sync
  const mapLocations = useMemo(() => {
    if (!itinerary?.days) return [];
    const locs: Array<{ id: string; name: string; lat: number; lng: number; type: string }> = [];
    itinerary.days.forEach((day, dayIdx) => {
      day.activities?.forEach((act, actIdx) => {
        if (act.coordinates?.lat && act.coordinates?.lng) {
          locs.push({
            id: `${dayIdx + 1}-${actIdx + 1}`,
            name: act.name || "Activity",
            lat: act.coordinates.lat,
            lng: act.coordinates.lng,
            type: act.type || "attraction",
          });
        }
      });
    });
    return locs;
  }, [itinerary]);

  // Handlers for DayCardList (read-only, no actual navigation)
  const handleDayClick = useCallback((dayIndex: number) => {
    setActiveDayIndex(prev => (prev === dayIndex ? null : dayIndex));
  }, []);

  const handleActivityClick = useCallback((activityKey: string) => {
    setHighlightedLocation(activityKey);
  }, []);

  const handleActivityHover = useCallback((activityKey: string | null) => {
    setHighlightedLocation(activityKey);
  }, []);

  // Set page title
  useEffect(() => {
    if (trip?.destination) {
      document.title = `${trip.destination} Trip | VoyageAI`;
    }
  }, [trip?.destination]);

  // Loading state
  if (isLoading) {
    return <ShareViewLoading />;
  }

  // Error state
  if (error || !trip || !tripResponse) {
    return (
      <ShareViewError
        message={error instanceof Error ? error.message : "Trip not found"}
        onPlanOwn={handlePlanOwn}
      />
    );
  }

  return (
    <ResultsBackground
      destination={trip.destination}
      theme="cinematic"
      verdictBias={
        verdictResult?.verdict === "GO"
          ? "go"
          : verdictResult?.verdict === "POSSIBLE"
            ? "possible"
            : "difficult"
      }
      showScrollProgress={false}
    >
      {/* Header */}
      <ShareViewHeader onPlanOwn={handlePlanOwn} />

      {/* Compact Hero for share view */}
      <div className="relative py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            {trip.destination}
          </h1>
          <div className="flex items-center gap-3 text-white/60 text-sm">
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              {trip.groupSize || 1} traveler{(trip.groupSize || 1) > 1 ? 's' : ''}
            </span>
            {trip.travelStyle && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  {getTravelStyleLabel(trip.travelStyle)}
                </span>
              </>
            )}
            {trip.dates && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {formatDateRange(trip.dates)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Certainty Bar */}
      <CertaintyBar trip={tripResponse} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 pb-24 md:pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Itinerary */}
          <div className="lg:col-span-7" data-section="day-card-list">
            {itinerary?.days && itinerary.days.length > 0 ? (
              <DayCardList
                tripId={tripId}
                itinerary={itinerary}
                currency={trip.currency || "USD"}
                tripStartDate={trip.dates || undefined}
                activeDayIndex={activeDayIndex}
                activeActivityKey={highlightedLocation}
                allExpanded={allDaysExpanded}
                showDistances={false}
                destination={trip.destination}
                onDayClick={handleDayClick}
                onActivityClick={handleActivityClick}
                onActivityHover={handleActivityHover}
              />
            ) : (
              <div className="bg-slate-800/50 rounded-xl border border-white/10 p-8 text-center">
                <p className="text-white/60">No itinerary available for this trip.</p>
              </div>
            )}
          </div>

          {/* Right Column: Map + Cost */}
          <div className="lg:col-span-5 space-y-4">
            {/* Map */}
            <div className="sticky top-[140px]">
              <div className="bg-slate-800/50 rounded-xl border border-white/10 overflow-hidden">
                <div className="h-[350px] relative">
                  {mapLocations.length > 0 ? (
                    <ItineraryMap
                      trip={tripResponse}
                      highlightedLocation={highlightedLocation}
                      activeDayIndex={activeDayIndex}
                      onLocationSelect={handleActivityClick}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                      <div className="text-center">
                        <MapPin className="w-8 h-8 text-white/30 mx-auto mb-2" />
                        <p className="text-sm text-white/40">Map unavailable</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Cost Summary */}
              <div className="mt-4">
                <CostSummaryCard trip={trip} />
              </div>

              {/* Share info */}
              <div className="mt-4 bg-slate-800/30 rounded-xl border border-white/5 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-white/80 font-medium">This is a shared trip</p>
                    <p className="text-xs text-white/50 mt-1">
                      Created with VoyageAI. Plan your own personalized trip with AI-powered
                      feasibility analysis.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile sticky CTA */}
      <PlanOwnCTA onPlanOwn={handlePlanOwn} />
    </ResultsBackground>
  );
}
