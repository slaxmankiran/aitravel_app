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

import { useParams } from "wouter";
import { useTrip } from "@/hooks/use-trips";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Loader2, X, ChevronDown, ChevronUp, Route } from "lucide-react";

// Layout components
import { HeaderBar } from "@/components/results/HeaderBar";
import { CertaintyBar } from "@/components/results/CertaintyBar";
import { RightRailPanels } from "@/components/results/RightRailPanels";

// Existing working components
import { ItineraryMap } from "@/components/ItineraryMap";

// New DayCardList (Phase 2)
import { DayCardList, type Itinerary } from "@/components/results-v1/DayCardList";

// Analytics
import { trackTripEvent, buildTripContext, type TripEventContext } from "@/lib/analytics";

import type { TripResponse } from "@shared/schema";

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
// MAIN PAGE COMPONENT
// ============================================================================

export default function TripResultsV1() {
  const { id } = useParams();
  const tripId = Number(id);

  // Fetch trip data
  const { data: trip, isLoading, error } = useTrip(tripId);

  // Working trip state - for optimistic updates
  const [workingTrip, setWorkingTrip] = useState<TripResponse | null>(null);
  const [highlightedLocation, setHighlightedLocation] = useState<string | null>(null);
  const [activeDayIndex, setActiveDayIndex] = useState<number | null>(null);
  const [chatOpened, setChatOpened] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [allDaysExpanded, setAllDaysExpanded] = useState(true);
  const [showDistances, setShowDistances] = useState(false);

  // Safe merge from server into working state
  useEffect(() => {
    if (!trip) return;
    setWorkingTrip(prev => {
      if (!prev) return trip;
      return {
        ...prev,
        feasibilityStatus: trip.feasibilityStatus,
        feasibilityReport: trip.feasibilityReport ?? prev.feasibilityReport,
        itinerary: trip.itinerary ?? prev.itinerary,
        updatedAt: trip.updatedAt,
      };
    });
  }, [trip]);

  // Build analytics context once when trip loads
  const analyticsContext = useMemo(() => {
    if (!workingTrip) return undefined;
    return buildTripContext(workingTrip);
  }, [workingTrip?.id, workingTrip?.feasibilityReport]);

  // Check if still generating
  const isGenerating = useMemo(() => {
    if (!workingTrip) return true;
    const s = workingTrip.feasibilityStatus;
    const hasItinerary = !!(workingTrip.itinerary as any)?.days?.length;
    if (s === 'pending') return true;
    if ((s === 'yes' || s === 'warning') && !hasItinerary) return true;
    return false;
  }, [workingTrip]);

  // Fetch progress while generating
  const { data: progress } = useTripProgress(tripId, isGenerating);

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

  // Map marker click handler - also scrolls to activity in itinerary
  const handleMapMarkerClick = useCallback((locationId: string) => {
    setHighlightedLocation(locationId);
    trackTripEvent(tripId, 'map_marker_clicked', { locationId }, analyticsContext);

    // Scroll to the activity in the itinerary
    // Small delay to ensure state update happens first
    setTimeout(() => {
      const activityEl = document.querySelector(`[data-activity-key="${locationId}"]`);
      if (activityEl) {
        activityEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
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

  // Loading state
  if (isLoading || !workingTrip) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/70">Failed to load trip</p>
          <p className="text-white/50 text-sm mt-1">{error.message}</p>
        </div>
      </div>
    );
  }

  // Calculate costs for panels
  const itinerary = workingTrip.itinerary as any;
  const costBreakdown = itinerary?.costBreakdown;
  const grandTotal = costBreakdown?.total ?? costBreakdown?.grandTotal ?? 0;
  const groupSize = workingTrip.groupSize || 1;
  const currency = workingTrip.currency || 'USD';

  const costs = costBreakdown ? {
    flights: Number(costBreakdown.flights) || 0,
    accommodation: Number(costBreakdown.accommodation) || 0,
    activities: Number(costBreakdown.activities) || 0,
    food: Number(costBreakdown.food) || 0,
    transport: Number(costBreakdown.localTransport ?? costBreakdown.transport) || 0,
    visa: Number(costBreakdown.visa) || 0,
    insurance: Number(costBreakdown.insurance) || 0,
    miscellaneous: Number(costBreakdown.miscellaneous ?? costBreakdown.misc) || 0,
    grandTotal: Number(grandTotal) || 0,
    perPerson: Math.round(Number(grandTotal) / groupSize) || 0,
    currency,
  } : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Sticky headers */}
      <HeaderBar trip={workingTrip} />
      <CertaintyBar trip={workingTrip} />

      {/* Main content - two column layout */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left column: Itinerary - scrollable container */}
          <section className="lg:col-span-7 lg:max-h-[calc(100vh-160px)] lg:overflow-y-auto lg:pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {/* Sticky header within scrollable area - solid bg to prevent content showing through */}
            <div className="sticky top-0 z-10 bg-slate-900 pb-3 -mx-1 px-1">
              {/* Title row with controls */}
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-2xl font-display font-bold text-white tracking-tight">
                  {itinerary?.days?.length || '—'} Days in {workingTrip.destination}
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

              {/* Narrative subtitle */}
              {!isGenerating && itinerary?.days?.length > 0 && (
                <p className="text-sm text-white/50 mt-1.5 leading-relaxed line-clamp-2">
                  {generateNarrativeSubtitle(workingTrip, itinerary)}
                </p>
              )}
            </div>

            {/* Inline progress - non-blocking */}
            {isGenerating && (
              <InlineProgress
                message={progress?.message}
                details={progress?.details}
              />
            )}

            {/* Itinerary content */}
            {isGenerating || !itinerary?.days?.length ? (
              <div className="space-y-4">
                {/* Skeleton cards */}
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-6 animate-pulse">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-white/10 rounded-lg" />
                      <div className="flex-1">
                        <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
                        <div className="h-3 bg-white/10 rounded w-1/4" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      {[1, 2, 3].map((j) => (
                        <div key={j} className="h-16 bg-white/5 rounded-lg" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <DayCardList
                tripId={tripId}
                itinerary={itinerary as Itinerary}
                currency={currency}
                activeDayIndex={activeDayIndex}
                activeActivityKey={highlightedLocation}
                allExpanded={allDaysExpanded}
                showDistances={showDistances}
                onDayClick={handleDayClick}
                onActivityClick={handleActivityClick}
                onActivityHover={handleActivityHover}
                analyticsContext={analyticsContext}
              />
            )}
          </section>

          {/* Right column: Map + Panels */}
          <aside className="lg:col-span-5 space-y-4">
            {/* Sticky container for map */}
            <div className="lg:sticky lg:top-[140px]">
              {/* Map - Inline (non-expanded) */}
              <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden aspect-[4/3] mb-4">
                {isGenerating || !itinerary?.days?.length ? (
                  <div className="w-full h-full bg-white/5 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-full bg-white/10 mx-auto mb-3 animate-pulse" />
                      <p className="text-sm text-white/40">Map loading...</p>
                    </div>
                  </div>
                ) : (
                  <ItineraryMap
                    trip={workingTrip}
                    onLocationSelect={handleMapMarkerClick}
                    highlightedLocation={highlightedLocation}
                    isExpanded={false}
                    onExpandToggle={handleMapExpandToggle}
                  />
                )}
              </div>

              {/* Panels */}
              <RightRailPanels
                trip={workingTrip}
                costs={costs}
                onTripUpdate={handleTripUpdate}
                onChatOpen={handleChatOpen}
                hasLocalChanges={false}
                hasUndoableChange={false}
                onUndo={() => {}}
              />
            </div>
          </aside>
        </div>
      </main>

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
              isExpanded={true}
              onExpandToggle={handleMapExpandToggle}
            />
          </div>
        </div>
      )}

      {/* Dev indicator */}
      <div className="fixed bottom-4 right-4 bg-primary/90 text-white text-xs px-3 py-1.5 rounded-full shadow-lg z-50">
        V1 Preview
      </div>
    </div>
  );
}
