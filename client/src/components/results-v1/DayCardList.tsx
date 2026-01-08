/**
 * DayCardList.tsx
 *
 * Container component for all day cards.
 * Handles state coordination and analytics events.
 */

import { useCallback, useRef, useEffect } from "react";
import { DayCard } from "./DayCard";
import { type Itinerary, getCurrencySymbol, extractCityFromTitle } from "./itinerary-adapters";
import { trackTripEvent } from "@/lib/analytics";
import { CheckCircle2, Sparkles } from "lucide-react";

// ============================================================================
// PROPS
// ============================================================================

interface DayCardListProps {
  tripId: number;
  itinerary: Itinerary;
  currency?: string;
  activeDayIndex: number | null;
  activeActivityKey: string | null;
  allExpanded?: boolean;
  showDistances?: boolean;
  onDayClick: (dayIndex: number) => void;
  onActivityClick: (activityKey: string) => void;
  onActivityHover: (activityKey: string | null) => void;
  analyticsContext?: Record<string, any>;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function DayCardList({
  tripId,
  itinerary,
  currency,
  activeDayIndex,
  activeActivityKey,
  allExpanded = true,
  showDistances = false,
  onDayClick,
  onActivityClick,
  onActivityHover,
  analyticsContext,
}: DayCardListProps) {
  // Hover state for visual feedback (separate from map sync)
  const hoveredRef = useRef<string | null>(null);

  // Get currency symbol
  const currencySymbol = itinerary.costBreakdown?.currencySymbol
    || getCurrencySymbol(itinerary.costBreakdown?.currency || currency);

  // Track day click
  const handleDayClick = useCallback((dayIndex: number) => {
    trackTripEvent(
      tripId,
      'day_clicked',
      { dayIndex },
      analyticsContext
    );
    onDayClick(dayIndex);
  }, [tripId, onDayClick, analyticsContext]);

  // Track activity click
  const handleActivityClick = useCallback((activityKey: string) => {
    // Parse dayIndex from key (format: "dayNum-activityIdx")
    const [dayStr] = activityKey.split('-');
    const dayIndex = parseInt(dayStr, 10) - 1;

    // Get time slot from the activity
    const day = itinerary.days[dayIndex];
    const activityIdx = parseInt(activityKey.split('-')[1], 10) - 1;
    const activity = day?.activities[activityIdx];

    trackTripEvent(
      tripId,
      'activity_clicked',
      {
        activityKey,
        dayIndex,
        timeSlot: activity?.time,
        activityType: activity?.type,
      },
      analyticsContext
    );

    onActivityClick(activityKey);
  }, [tripId, itinerary.days, onActivityClick, analyticsContext]);

  // Throttled hover handler (avoid spamming)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleActivityHover = useCallback((activityKey: string | null) => {
    // Clear pending timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    // Debounce hover changes
    hoverTimeoutRef.current = setTimeout(() => {
      hoveredRef.current = activityKey;
      onActivityHover(activityKey);
    }, 50);
  }, [onActivityHover]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  if (!itinerary.days?.length) {
    return (
      <div className="text-center py-12 bg-white/5 rounded-xl border border-dashed border-white/20">
        <p className="text-white/50">No itinerary days available.</p>
      </div>
    );
  }

  const totalDays = itinerary.days.length;

  return (
    <div className="space-y-4">
      {itinerary.days.map((day, idx) => {
        // Use shared city extraction - returns null if city can't be determined
        const previousDayCity = idx > 0 ? extractCityFromTitle(itinerary.days[idx - 1].title) : undefined;

        return (
          <DayCard
            key={day.day}
            day={day}
            dayIndex={idx}
            totalDays={totalDays}
            currencySymbol={currencySymbol}
            isActiveDay={activeDayIndex === idx}
            activeActivityKey={activeActivityKey}
            hoveredActivityKey={hoveredRef.current}
            previousDayCity={previousDayCity}
            forceExpanded={allExpanded}
            showDistances={showDistances}
            onDayClick={handleDayClick}
            onActivityClick={handleActivityClick}
            onActivityHover={handleActivityHover}
          />
        );
      })}

      {/* End of Journey Card - provides closure (compact) */}
      <div className="relative mt-4">
        {/* Subtle divider */}
        <div className="flex items-center gap-3 mb-2">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <Sparkles className="w-3 h-3 text-white/15" />
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        {/* Closure card - compact */}
        <div className="bg-gradient-to-br from-white/[0.02] to-transparent border border-white/8 rounded-xl px-4 py-3 text-center">
          <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500/10 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <h4 className="text-white/70 font-medium text-sm mb-1">End of Itinerary</h4>
          <p className="text-white/40 text-xs leading-relaxed max-w-[280px] mx-auto">
            Your {totalDays}-day journey is planned. Adjust days, swap activities, or review costs anytime.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export { type Itinerary } from "./itinerary-adapters";
