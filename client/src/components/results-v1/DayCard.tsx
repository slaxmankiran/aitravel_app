/**
 * DayCard.tsx
 *
 * Single day card with morning/afternoon/evening sections.
 * Renders activities grouped by time slot.
 *
 * Performance: Memoized component for scroll/hover performance.
 */

import React from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ActivityRow } from "./ActivityRow";
import {
  type DayPlan,
  type TimeSlot,
  bucketActivities,
  getSimpleActivityKey,
  TIME_SLOT_CONFIG,
  getDistanceBetweenActivities,
  extractCityFromTitle,
} from "./itinerary-adapters";
import { AnimatePresence, motion } from "framer-motion";

// ============================================================================
// PROPS
// ============================================================================

interface DayCardProps {
  day: DayPlan;
  dayIndex: number;
  totalDays: number;
  currencySymbol: string;
  actualDate?: string; // Calculated from trip start date (overrides day.date)
  isActiveDay: boolean;
  activeActivityKey: string | null;
  hoveredActivityKey: string | null;
  previousDayCity?: string | null; // For detecting city transitions
  forceExpanded?: boolean; // External control for expand/collapse all
  showDistances?: boolean; // Show distances between activities
  /** Destination for activity images */
  destination?: string;
  onDayClick: (dayIndex: number) => void;
  onActivityClick: (activityKey: string) => void;
  onActivityHover: (activityKey: string | null) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

function DayCardComponent({
  day,
  dayIndex,
  totalDays,
  currencySymbol,
  actualDate,
  isActiveDay,
  activeActivityKey,
  hoveredActivityKey,
  previousDayCity,
  forceExpanded,
  showDistances = false,
  destination,
  onDayClick,
  onActivityClick,
  onActivityHover,
}: DayCardProps) {
  // Track if user has manually toggled this card
  const [userOverride, setUserOverride] = useState<boolean | null>(null);

  // Priority: user override > forceExpanded > default (true)
  const isExpanded = userOverride !== null
    ? userOverride
    : (forceExpanded !== undefined ? forceExpanded : true);

  // When global expand changes, reset user override so global takes effect
  useEffect(() => {
    setUserOverride(null);
  }, [forceExpanded]);

  const toggleExpanded = () => {
    setUserOverride(prev => prev !== null ? !prev : !isExpanded);
  };

  // Bucket activities by time slot (also de-duplicates)
  const buckets = useMemo(() => bucketActivities(day.activities), [day.activities]);

  // Count de-duped activities
  const activityCount = useMemo(
    () => buckets.morning.length + buckets.afternoon.length + buckets.evening.length,
    [buckets]
  );

  // Phase detection
  const isFirstDay = dayIndex === 0;
  const isLastDay = dayIndex === totalDays - 1;
  const currentCity = extractCityFromTitle(day.title);
  // Only consider it a city transition if both cities are known and different
  const isCityTransition = !!(currentCity && previousDayCity && previousDayCity !== currentCity);

  // Only show phase labels for true milestones
  const phaseLabel = useMemo(() => {
    if (isFirstDay) return "Arrival";
    if (isLastDay) return "Departure";
    // Only show city transition if we successfully detected a DIFFERENT city
    if (isCityTransition && currentCity) return `→ ${currentCity}`;
    return null; // No label for regular days
  }, [isFirstDay, isLastDay, isCityTransition, currentCity]);

  // Format date for display - use actualDate (calculated from trip start) if provided
  const formattedDate = useMemo(() => {
    const dateToFormat = actualDate || day.date;
    try {
      // Use UTC timezone to match header dates and avoid timezone shifts
      return new Date(dateToFormat).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
    } catch {
      return dateToFormat;
    }
  }, [actualDate, day.date]);

  // Render a time slot section with cross-slot distance tracking
  const renderTimeSlot = (
    slot: TimeSlot,
    activities: typeof day.activities,
    lastActivityFromPreviousSlot: typeof day.activities[0] | null
  ) => {
    if (activities.length === 0) return null;

    const config = TIME_SLOT_CONFIG[slot];

    return (
      <div key={slot} className="mb-5 last:mb-0">
        {/* Slot header */}
        <div className="flex items-center gap-2 mb-2 px-3">
          <span className="text-sm">{config.icon}</span>
          <span className={cn("text-[11px] font-semibold uppercase tracking-wide", config.color)}>
            {config.label}
          </span>
          <div className="flex-grow h-px bg-white/10" />
        </div>

        {/* Activities */}
        <div className="space-y-1">
          {activities.map((activity, idx) => {
            const originalIndex = day.activities.findIndex((a) => a === activity);
            const activityKey = getSimpleActivityKey(day.day, originalIndex);

            // For first activity in slot, use last activity from previous slot
            // For subsequent activities, use previous activity in this slot
            const prevActivity = idx > 0
              ? activities[idx - 1]
              : lastActivityFromPreviousSlot;

            const distanceFromPrevious = prevActivity
              ? getDistanceBetweenActivities(prevActivity, activity)
              : null;

            // Show transport for all except the very first activity of the day
            const isVeryFirstActivity = idx === 0 && !lastActivityFromPreviousSlot;

            // Check if this is the last activity in the slot (for timeline rendering)
            const isLastInSlot = idx === activities.length - 1;

            return (
              <ActivityRow
                key={activityKey}
                activity={activity}
                activityKey={activityKey}
                currencySymbol={currencySymbol}
                isActive={activeActivityKey === activityKey}
                isHovered={hoveredActivityKey === activityKey}
                showTransport={!isVeryFirstActivity}
                distanceFromPrevious={distanceFromPrevious}
                prevActivity={prevActivity}
                showDistance={showDistances}
                destination={destination}
                isLastInSlot={isLastInSlot}
                onClick={() => onActivityClick(activityKey)}
                onMouseEnter={() => onActivityHover(activityKey)}
                onMouseLeave={() => onActivityHover(null)}
              />
            );
          })}
        </div>
      </div>
    );
  };

  // Get last activity from a bucket (for cross-slot distance calculation)
  const getLastActivity = (activities: typeof day.activities) =>
    activities.length > 0 ? activities[activities.length - 1] : null;

  return (
    <div
      className={cn(
        "relative rounded-xl overflow-hidden transition-all",
        // Glass design - matches DecisionStack/RightRail cards
        "bg-slate-900/50 backdrop-blur-xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
        "hover:border-white/[0.12]",
        isActiveDay && "border-primary/40 ring-1 ring-primary/20",
        // Subtle emphasis for milestone days
        (isFirstDay || isLastDay) && "border-white/[0.12]"
      )}
      data-active={isActiveDay ? "true" : "false"}
    >
      {/* Active left accent - stronger for milestone days */}
      <div
        className={cn(
          "absolute left-0 top-0 h-full w-[3px] transition-opacity",
          isActiveDay
            ? "bg-primary/80 opacity-100"
            : (isFirstDay || isLastDay)
              ? "bg-white/20 opacity-100"
              : "opacity-0"
        )}
        aria-hidden="true"
      />

      {/* Header */}
      <button
        type="button"
        className={cn(
          "w-full text-left flex items-center justify-between px-4 py-3.5",
          "cursor-pointer select-none",
          "border-b border-white/10",
          isActiveDay ? "bg-white/[0.06]" : "hover:bg-white/[0.04]",
          // Slightly stronger header for milestone days
          (isFirstDay || isLastDay) && !isActiveDay && "bg-white/[0.03]"
        )}
        onClick={() => {
          onDayClick(dayIndex);
          toggleExpanded();
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Day number badge */}
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0",
              isActiveDay
                ? "bg-primary text-white"
                : (isFirstDay || isLastDay)
                  ? "bg-white/15 text-white/90"
                  : "bg-white/10 text-white/70"
            )}
          >
            {day.day}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white leading-snug truncate">{day.title}</h3>
              {/* Phase label pill */}
              {phaseLabel && (
                <span
                  className={cn(
                    "shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide",
                    isFirstDay && "bg-emerald-500/20 text-emerald-400 font-semibold uppercase",
                    isLastDay && "bg-amber-500/20 text-amber-400 font-semibold uppercase",
                    isCityTransition && !isFirstDay && !isLastDay && "bg-indigo-500/20 text-indigo-400",
                    // Theme labels - subtle styling (not a milestone)
                    !isFirstDay && !isLastDay && !isCityTransition && "bg-white/10 text-white/60"
                  )}
                >
                  {phaseLabel}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[12px] text-white/60 mt-0.5">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{formattedDate}</span>
              <span className="text-white/20">•</span>
              <span className="truncate">{activityCount} activities</span>
            </div>
          </div>
        </div>

        {/* Chevron */}
        <button
          type="button"
          className="shrink-0 ml-3 p-2 rounded-xl hover:bg-white/5"
          onClick={(e) => {
            e.stopPropagation();
            toggleExpanded();
          }}
          aria-label={isExpanded ? "Collapse day" : "Expand day"}
        >
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.18 }}
          >
            <ChevronDown className="w-4 h-4 text-white/50" />
          </motion.div>
        </button>
      </button>

      {/* Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <div className="p-3.5">
              {renderTimeSlot("morning", buckets.morning, null)}
              {renderTimeSlot("afternoon", buckets.afternoon, getLastActivity(buckets.morning))}
              {renderTimeSlot("evening", buckets.evening, getLastActivity(buckets.afternoon) || getLastActivity(buckets.morning))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Memoize for scroll and hover performance
export const DayCard = React.memo(DayCardComponent);
