/**
 * DayCard.tsx
 *
 * Single day card with morning/afternoon/evening sections.
 * Renders activities grouped by time slot.
 */

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
  isActiveDay: boolean;
  activeActivityKey: string | null;
  hoveredActivityKey: string | null;
  previousDayCity?: string | null; // For detecting city transitions
  forceExpanded?: boolean; // External control for expand/collapse all
  showDistances?: boolean; // Show distances between activities
  onDayClick: (dayIndex: number) => void;
  onActivityClick: (activityKey: string) => void;
  onActivityHover: (activityKey: string | null) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function DayCard({
  day,
  dayIndex,
  totalDays,
  currencySymbol,
  isActiveDay,
  activeActivityKey,
  hoveredActivityKey,
  previousDayCity,
  forceExpanded,
  showDistances = false,
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

  // Bucket activities by time slot
  const buckets = useMemo(() => bucketActivities(day.activities), [day.activities]);

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

  // Format date for display
  const formattedDate = useMemo(() => {
    try {
      return new Date(day.date).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    } catch {
      return day.date;
    }
  }, [day.date]);

  // Render a time slot section
  const renderTimeSlot = (slot: TimeSlot, activities: typeof day.activities) => {
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
            const isFirst = idx === 0;

            // Calculate distance from previous activity
            const prevActivity = idx > 0 ? activities[idx - 1] : null;
            const distanceFromPrevious = prevActivity
              ? getDistanceBetweenActivities(prevActivity, activity)
              : null;

            return (
              <ActivityRow
                key={activityKey}
                activity={activity}
                activityKey={activityKey}
                currencySymbol={currencySymbol}
                isActive={activeActivityKey === activityKey}
                isHovered={hoveredActivityKey === activityKey}
                showTransport={!isFirst}
                distanceFromPrevious={distanceFromPrevious}
                prevActivity={prevActivity}
                showDistance={showDistances}
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

  return (
    <div
      className={cn(
        "relative rounded-2xl border overflow-hidden transition-all",
        "bg-white/5 border-white/10 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.8)]",
        "hover:border-white/15 hover:bg-white/6",
        isActiveDay && "border-primary/40 ring-1 ring-primary/20",
        // Subtle emphasis for milestone days
        (isFirstDay || isLastDay) && "border-white/15"
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
              <span className="truncate">{day.activities.length} activities</span>
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
              {renderTimeSlot("morning", buckets.morning)}
              {renderTimeSlot("afternoon", buckets.afternoon)}
              {renderTimeSlot("evening", buckets.evening)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
