/**
 * ResultsSkeletons.tsx
 *
 * Section-level skeleton components for Trip Results streaming.
 * These provide instant visual feedback while data loads.
 *
 * Phase 1 requirement: User sees progress within 2-3 seconds
 */

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton for the CertaintyBar.
 * Shows placeholders for visa badge, certainty score, and chips.
 */
export function CertaintyBarSkeleton() {
  return (
    <div className="sticky top-[60px] z-30 bg-slate-900/95 backdrop-blur-sm border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Visa badge + chips */}
          <div className="flex items-center gap-3">
            {/* Visa type badge skeleton */}
            <Skeleton className="h-8 w-28 rounded-full bg-white/10" />
            {/* Processing time chip */}
            <Skeleton className="h-6 w-24 rounded-full bg-white/5" />
            {/* Apply by chip */}
            <Skeleton className="h-6 w-32 rounded-full bg-white/5 hidden md:block" />
          </div>

          {/* Right: Certainty score */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-20 rounded bg-white/10" />
            <Skeleton className="h-10 w-10 rounded-full bg-white/10" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for the VerdictCard.
 * Shows placeholder for verdict badge, score, and reasons.
 */
export function VerdictCardSkeleton() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden mb-4">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Icon + content */}
          <div className="flex items-start gap-4">
            <Skeleton className="w-14 h-14 rounded-full bg-white/10" />
            <div>
              <Skeleton className="h-7 w-32 rounded bg-white/10 mb-2" />
              <Skeleton className="h-4 w-48 rounded bg-white/5 mb-1" />
              <Skeleton className="h-3 w-36 rounded bg-white/5" />
            </div>
          </div>
          {/* Right: Score circle */}
          <Skeleton className="w-16 h-16 rounded-full bg-white/10" />
        </div>

        {/* Reasons skeleton */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="w-4 h-4 rounded-full bg-white/10" />
            <Skeleton className="h-4 w-56 rounded bg-white/5" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="w-4 h-4 rounded-full bg-white/10" />
            <Skeleton className="h-4 w-44 rounded bg-white/5" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for the True Cost panel.
 * Shows placeholder for cost breakdown categories.
 */
export function CostPanelSkeleton() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="w-5 h-5 rounded bg-white/10" />
        <Skeleton className="h-5 w-24 rounded bg-white/10" />
      </div>

      {/* Total */}
      <div className="mb-4 pb-4 border-b border-white/10">
        <Skeleton className="h-8 w-32 rounded bg-white/10 mb-1" />
        <Skeleton className="h-3 w-20 rounded bg-white/5" />
      </div>

      {/* Cost categories */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <Skeleton className="h-4 w-24 rounded bg-white/5" />
            <Skeleton className="h-4 w-16 rounded bg-white/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton for Action Items panel.
 * Shows placeholder for checklist items.
 */
export function ActionItemsSkeleton() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="w-5 h-5 rounded bg-white/10" />
        <Skeleton className="h-5 w-28 rounded bg-white/10" />
      </div>

      {/* Section: Required */}
      <div className="mb-4">
        <Skeleton className="h-4 w-20 rounded bg-white/5 mb-3" />
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="w-4 h-4 rounded bg-white/10 mt-0.5" />
              <div className="flex-1">
                <Skeleton className="h-4 w-full max-w-[200px] rounded bg-white/5 mb-1" />
                <Skeleton className="h-3 w-32 rounded bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section: Recommended */}
      <div>
        <Skeleton className="h-4 w-28 rounded bg-white/5 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="w-4 h-4 rounded bg-white/10 mt-0.5" />
              <Skeleton className="h-4 w-full max-w-[180px] rounded bg-white/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for a single Day Card in the itinerary.
 */
export function DayCardSkeleton() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6 animate-pulse">
      {/* Day header */}
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="w-10 h-10 rounded-lg bg-white/10" />
        <div className="flex-1">
          <Skeleton className="h-5 w-24 rounded bg-white/10 mb-2" />
          <Skeleton className="h-3 w-36 rounded bg-white/5" />
        </div>
      </div>

      {/* Activities */}
      <div className="space-y-3">
        {[1, 2, 3].map((j) => (
          <div key={j} className="h-16 bg-white/5 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton for the full itinerary section.
 * Shows 3 day card skeletons.
 */
export function ItinerarySkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <DayCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for the Map component.
 */
export function MapSkeleton() {
  return (
    <div className="w-full h-full bg-white/5 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-white/10 mx-auto mb-3 animate-pulse" />
        <p className="text-sm text-white/40">Loading map...</p>
      </div>
    </div>
  );
}

/**
 * Full right rail skeleton (for initial load).
 * Shows all panels in skeleton state.
 */
export function RightRailSkeleton() {
  return (
    <div className="space-y-4">
      <CostPanelSkeleton />
      <ActionItemsSkeleton />
    </div>
  );
}

/**
 * Progress indicator for streaming generation.
 * Shows current step with animated dots.
 */
interface StreamingProgressProps {
  step: string;
  progress?: number; // 0-100
  details?: string;
}

export function StreamingProgress({ step, progress, details }: StreamingProgressProps) {
  return (
    <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-3 mb-4">
      <div className="flex items-center gap-3">
        {/* Animated spinner */}
        <div className="relative w-5 h-5 shrink-0">
          <div className="absolute inset-0 border-2 border-primary/30 rounded-full" />
          <div className="absolute inset-0 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate">{step}</p>
          {details && (
            <p className="text-xs text-white/60 truncate">{details}</p>
          )}
        </div>

        {/* Progress percentage (optional) */}
        {progress !== undefined && (
          <span className="text-xs text-white/40 shrink-0">{progress}%</span>
        )}
      </div>

      {/* Progress bar (optional) */}
      {progress !== undefined && (
        <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}
