/**
 * StreamingItinerary.tsx
 *
 * Progressive itinerary rendering with SSE streaming.
 * Shows days as they arrive - Day 1 appears within 5-10 seconds.
 */

import React, { useEffect, useCallback, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertCircle, RefreshCw, CheckCircle2, Sparkles, Clock } from "lucide-react";
import { useItineraryStream, type ItineraryDay } from "@/hooks/useItineraryStream";
import { DayCardList } from "@/components/results-v1/DayCardList";
import { type DayPlan, type Itinerary, type Activity } from "@/components/results-v1/itinerary-adapters";
import { Button } from "@/components/ui/button";

// ============================================================================
// TYPE CONVERSION
// ============================================================================

/**
 * Convert ItineraryDay (from stream) to DayPlan (for DayCardList)
 * The types are nearly identical, just need to ensure activity types match
 */
function convertToDayPlan(day: ItineraryDay): DayPlan {
  return {
    day: day.day,
    date: day.date,
    title: day.title,
    activities: day.activities.map(a => ({
      time: a.time,
      name: a.name,
      description: a.description,
      type: a.type as Activity["type"],
      estimatedCost: a.estimatedCost,
      duration: a.duration,
      location: a.location,
      coordinates: a.coordinates,
      transportMode: a.transportMode
    })),
    localFood: day.localFood?.map(f => ({
      meal: "lunch" as const, // Default meal type
      name: f.name,
      cuisine: f.cuisine,
      priceRange: f.priceRange as "$" | "$$" | "$$$" | undefined,
      estimatedCost: f.estimatedCost
    }))
  };
}

/**
 * Convert array of ItineraryDay to Itinerary format
 */
function convertToItinerary(days: ItineraryDay[]): Itinerary {
  return {
    days: days.map(convertToDayPlan)
  };
}

// ============================================================================
// SKELETON COMPONENTS
// ============================================================================

/**
 * Skeleton for a day that hasn't arrived yet
 */
function DayCardSkeleton({ dayNumber, isGenerating }: { dayNumber: number; isGenerating: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-slate-700/50 bg-slate-800/30 backdrop-blur-sm overflow-hidden"
    >
      {/* Day header skeleton */}
      <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-700/50 animate-pulse flex items-center justify-center">
            <span className="text-xs text-slate-500">{dayNumber}</span>
          </div>
          <div className="space-y-1.5">
            <div className="h-4 w-32 bg-slate-700/50 rounded animate-pulse" />
            <div className="h-3 w-20 bg-slate-700/30 rounded animate-pulse" />
          </div>
        </div>
        {isGenerating && (
          <div className="flex items-center gap-2 text-xs text-amber-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Generating...</span>
          </div>
        )}
      </div>

      {/* Activities skeleton */}
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-12 h-4 bg-slate-700/30 rounded animate-pulse" />
            <div className="flex-1 h-4 bg-slate-700/40 rounded animate-pulse" />
            <div className="w-16 h-4 bg-slate-700/30 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/**
 * Progress indicator for streaming status
 */
function StreamingProgress({
  currentDay,
  totalDays,
  percent,
  message
}: {
  currentDay: number;
  totalDays: number;
  percent: number;
  message: string;
}) {
  return (
    <div className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/50 px-4 py-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-emerald-400">
          <Sparkles className="w-4 h-4" />
          <span>{message}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-400">
            {currentDay} / {totalDays} days
          </span>
          <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-emerald-500"
              initial={{ width: 0 }}
              animate={{ width: `${percent}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Error banner with retry option
 */
function StreamingError({
  error,
  onRetry,
  daysLoaded
}: {
  error: { message: string; recoverable: boolean };
  onRetry: () => void;
  daysLoaded: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 mb-4"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-amber-200 font-medium">
            {error.message}
          </p>
          {daysLoaded > 0 && (
            <p className="text-xs text-amber-200/70 mt-1">
              {daysLoaded} day{daysLoaded > 1 ? 's' : ''} loaded successfully
            </p>
          )}
        </div>
        {error.recoverable && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="shrink-0 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Retry
          </Button>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Completion banner
 */
function StreamingComplete({ totalDays, isCached }: { totalDays: number; isCached: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 mb-4"
    >
      <div className="flex items-center gap-2 text-sm text-emerald-400">
        <CheckCircle2 className="w-4 h-4" />
        <span>
          {isCached
            ? `Loaded ${totalDays}-day itinerary`
            : `Generated ${totalDays}-day itinerary`}
        </span>
        {isCached && (
          <span className="text-xs text-emerald-400/60 ml-2">(cached)</span>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface StreamingItineraryProps {
  tripId: number;
  destination: string;
  currency?: string;
  tripStartDate?: string;
  /** Existing itinerary (if any) - will skip streaming if complete */
  existingItinerary?: Itinerary | null;
  /** Total days expected */
  totalDays?: number;
  /** Auto-start streaming when component mounts */
  autoStart?: boolean;
  /** Callback when streaming completes */
  onComplete?: (itinerary: Itinerary) => void;
  /** Callback when a day is received */
  onDayReceived?: (day: DayPlan, allDays: DayPlan[]) => void;
  /** Day card interaction callbacks */
  activeDayIndex?: number | null;
  activeActivityKey?: string | null;
  onDayClick?: (dayIndex: number) => void;
  onActivityClick?: (activityKey: string) => void;
  onActivityHover?: (activityKey: string | null) => void;
}

export function StreamingItinerary({
  tripId,
  destination,
  currency,
  tripStartDate,
  existingItinerary,
  totalDays: expectedTotalDays,
  autoStart = true,
  onComplete,
  onDayReceived,
  activeDayIndex = null,
  activeActivityKey = null,
  onDayClick,
  onActivityClick,
  onActivityHover
}: StreamingItineraryProps) {
  const {
    status,
    days: streamedDays,
    meta,
    progress,
    error,
    isCached,
    startStream,
    retry
  } = useItineraryStream();

  const [showControls, setShowControls] = useState(true);

  // Convert streamed days to DayPlan format
  const convertedStreamedDays = useMemo(() => {
    return streamedDays.map(convertToDayPlan);
  }, [streamedDays]);

  // Determine which days to show: streamed or existing
  const displayDays: DayPlan[] = useMemo(() => {
    if (convertedStreamedDays.length > 0) {
      return convertedStreamedDays;
    }
    return existingItinerary?.days || [];
  }, [convertedStreamedDays, existingItinerary?.days]);

  const totalDays = meta?.totalDays || expectedTotalDays || displayDays.length || 7;

  // Check if we should auto-start streaming
  const shouldStream = useMemo(() => {
    if (!autoStart) return false;
    if (status !== "idle") return false;

    // If existing itinerary is complete, don't stream
    if (existingItinerary?.days && existingItinerary.days.length >= totalDays) {
      return false;
    }

    return true;
  }, [autoStart, status, existingItinerary?.days, totalDays]);

  // Auto-start streaming
  useEffect(() => {
    if (shouldStream) {
      startStream(tripId);
    }
  }, [shouldStream, tripId, startStream]);

  // Notify parent when days arrive
  useEffect(() => {
    if (convertedStreamedDays.length > 0 && onDayReceived) {
      const lastDay = convertedStreamedDays[convertedStreamedDays.length - 1];
      onDayReceived(lastDay, convertedStreamedDays);
    }
  }, [convertedStreamedDays, onDayReceived]);

  // Notify parent when complete
  useEffect(() => {
    if (status === "complete" && convertedStreamedDays.length > 0 && onComplete) {
      onComplete({ days: convertedStreamedDays });
    }
  }, [status, convertedStreamedDays, onComplete]);

  // Hide controls after completion
  useEffect(() => {
    if (status === "complete") {
      const timer = setTimeout(() => setShowControls(false), 3000);
      return () => clearTimeout(timer);
    } else {
      setShowControls(true);
    }
  }, [status]);

  // Default no-op callbacks
  const handleDayClick = onDayClick || (() => {});
  const handleActivityClick = onActivityClick || (() => {});
  const handleActivityHover = onActivityHover || (() => {});

  // Calculate remaining skeleton days
  const skeletonDays = useMemo(() => {
    const remaining = totalDays - displayDays.length;
    return Array.from({ length: Math.max(0, remaining) }, (_, i) => displayDays.length + i + 1);
  }, [totalDays, displayDays.length]);

  // If existing itinerary is complete and not streaming, just render it
  if (existingItinerary?.days?.length && existingItinerary.days.length >= totalDays && status === "idle") {
    return (
      <DayCardList
        tripId={tripId}
        itinerary={{ days: existingItinerary.days }}
        currency={currency}
        tripStartDate={tripStartDate}
        destination={destination}
        activeDayIndex={activeDayIndex}
        activeActivityKey={activeActivityKey}
        onDayClick={handleDayClick}
        onActivityClick={handleActivityClick}
        onActivityHover={handleActivityHover}
      />
    );
  }

  return (
    <div className="space-y-4" data-section="streaming-itinerary">
      {/* Progress indicator */}
      <AnimatePresence>
        {showControls && (status === "connecting" || status === "streaming") && progress && (
          <StreamingProgress
            currentDay={progress.currentDay}
            totalDays={progress.totalDays}
            percent={progress.percent}
            message={progress.message}
          />
        )}
      </AnimatePresence>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <StreamingError
            error={error}
            onRetry={retry}
            daysLoaded={displayDays.length}
          />
        )}
      </AnimatePresence>

      {/* Completion banner */}
      <AnimatePresence>
        {showControls && status === "complete" && (
          <StreamingComplete totalDays={displayDays.length} isCached={isCached} />
        )}
      </AnimatePresence>

      {/* Connecting state */}
      {status === "connecting" && displayDays.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center py-8"
        >
          <div className="flex items-center gap-3 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Connecting to itinerary generator...</span>
          </div>
        </motion.div>
      )}

      {/* Rendered days */}
      {displayDays.length > 0 && (
        <DayCardList
          tripId={tripId}
          itinerary={{ days: displayDays }}
          currency={currency}
          tripStartDate={tripStartDate}
          destination={destination}
          activeDayIndex={activeDayIndex}
          activeActivityKey={activeActivityKey}
          onDayClick={handleDayClick}
          onActivityClick={handleActivityClick}
          onActivityHover={handleActivityHover}
        />
      )}

      {/* Skeleton days for remaining */}
      <AnimatePresence>
        {skeletonDays.map((dayNum, idx) => (
          <DayCardSkeleton
            key={`skeleton-${dayNum}`}
            dayNumber={dayNum}
            isGenerating={status === "streaming" && idx === 0}
          />
        ))}
      </AnimatePresence>

      {/* Manual start button (if autoStart is false) */}
      {!autoStart && status === "idle" && displayDays.length === 0 && (
        <div className="flex justify-center py-8">
          <Button
            onClick={() => startStream(tripId)}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Itinerary
          </Button>
        </div>
      )}
    </div>
  );
}

export default StreamingItinerary;
