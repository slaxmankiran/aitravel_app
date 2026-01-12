/**
 * DayCardList.tsx
 *
 * Container component for all day cards.
 * Handles state coordination and analytics events.
 *
 * Performance: Memoized component, precomputed cities, throttled hover.
 */

import React, { useCallback, useRef, useEffect, useMemo } from "react";
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
  tripStartDate?: string; // Trip start date for calculating actual day dates
  activeDayIndex: number | null;
  activeActivityKey: string | null;
  allExpanded?: boolean;
  showDistances?: boolean;
  /** Destination for activity images */
  destination?: string;
  onDayClick: (dayIndex: number) => void;
  onActivityClick: (activityKey: string) => void;
  onActivityHover: (activityKey: string | null) => void;
  analyticsContext?: Record<string, any>;
}

// ============================================================================
// COMPONENT
// ============================================================================

function DayCardListComponent({
  tripId,
  itinerary,
  currency,
  tripStartDate,
  activeDayIndex,
  activeActivityKey,
  allExpanded = true,
  showDistances = false,
  destination,
  onDayClick,
  onActivityClick,
  onActivityHover,
  analyticsContext,
}: DayCardListProps) {
  // Hover state for visual feedback (separate from map sync)
  const hoveredRef = useRef<string | null>(null);

  // Memoize currency symbol to avoid recalculating
  const currencySymbol = useMemo(() => {
    return (
      itinerary.costBreakdown?.currencySymbol ||
      getCurrencySymbol(itinerary.costBreakdown?.currency || currency)
    );
  }, [itinerary.costBreakdown?.currencySymbol, itinerary.costBreakdown?.currency, currency]);

  // Precompute day cities once to avoid repeated extractCityFromTitle calls
  const dayCities = useMemo(() => {
    return itinerary.days.map(d => extractCityFromTitle(d.title));
  }, [itinerary.days]);

  // Calculate actual dates for each day based on trip start date
  const dayDates = useMemo(() => {
    if (!tripStartDate) return null;

    // Parse start date - handle multiple formats:
    // "2026-03-04 to 2026-03-09" or "Mar 4, 2026 - Mar 9, 2026" or just "2026-03-04"
    let startDateStr = tripStartDate.trim();

    // Try splitting by common separators
    if (startDateStr.includes(' to ')) {
      startDateStr = startDateStr.split(' to ')[0].trim();
    } else if (startDateStr.includes(' - ')) {
      startDateStr = startDateStr.split(' - ')[0].trim();
    }

    // Parse the date - use noon UTC to avoid timezone issues
    const startDate = new Date(startDateStr + 'T12:00:00Z');
    if (isNaN(startDate.getTime())) {
      // Fallback: try parsing without time suffix
      const fallbackDate = new Date(startDateStr);
      if (isNaN(fallbackDate.getTime())) return null;
      // Adjust for timezone by using local noon
      fallbackDate.setHours(12, 0, 0, 0);
      return itinerary.days.map((_, idx) => {
        const dayDate = new Date(fallbackDate);
        dayDate.setDate(fallbackDate.getDate() + idx);
        return dayDate.toISOString();
      });
    }

    return itinerary.days.map((_, idx) => {
      const dayDate = new Date(startDate);
      dayDate.setUTCDate(startDate.getUTCDate() + idx);
      return dayDate.toISOString();
    });
  }, [tripStartDate, itinerary.days.length]);

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
    // Parse from key format: "dayNum-activityNum" (both 1-based)
    // getSimpleActivityKey creates: `${dayNum}-${activityIndex + 1}`
    const [dayStr, activityStr] = activityKey.split('-');
    const dayIndex = parseInt(dayStr, 10) - 1; // Convert 1-based day to 0-based index
    const activityIdx = parseInt(activityStr, 10) - 1; // Convert 1-based to 0-based

    // Get activity details for analytics
    const day = itinerary.days[dayIndex];
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

    // Debounce hover changes and prevent redundant updates
    hoverTimeoutRef.current = setTimeout(() => {
      if (hoveredRef.current !== activityKey) {
        hoveredRef.current = activityKey;
        onActivityHover(activityKey);
      }
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
        // Use precomputed city from dayCities array
        const previousDayCity = idx > 0 ? dayCities[idx - 1] : undefined;
        // Use calculated date if available, fallback to AI-generated date
        const actualDate = dayDates?.[idx] || day.date;

        return (
          <DayCard
            key={day.day}
            day={day}
            dayIndex={idx}
            totalDays={totalDays}
            currencySymbol={currencySymbol}
            actualDate={actualDate}
            isActiveDay={activeDayIndex === idx}
            activeActivityKey={activeActivityKey}
            hoveredActivityKey={hoveredRef.current}
            previousDayCity={previousDayCity}
            forceExpanded={allExpanded}
            showDistances={showDistances}
            destination={destination}
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

// Memoize to prevent rerenders when unrelated state changes
export const DayCardList = React.memo(DayCardListComponent);

// ============================================================================
// EXPORTS
// ============================================================================

export { type Itinerary } from "./itinerary-adapters";
