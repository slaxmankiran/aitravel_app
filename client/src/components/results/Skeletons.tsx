/**
 * Skeletons.tsx
 *
 * Skeleton loading components for Trip Results V1.
 * Provides visual feedback during generation.
 */

import { motion } from "framer-motion";

// ============================================================================
// BASE SKELETON
// ============================================================================

interface SkeletonProps {
  className?: string;
}

function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-white/10 rounded ${className}`} />
  );
}

// ============================================================================
// DAY CARD SKELETON
// ============================================================================

export function DayCardSkeleton() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <div className="flex-1">
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-6 w-16 rounded" />
      </div>

      {/* Activities */}
      <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3 p-3">
            <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
            <div className="flex-1">
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// ITINERARY SKELETON
// ============================================================================

export function ItinerarySkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <DayCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ============================================================================
// MAP SKELETON
// ============================================================================

export function MapSkeleton() {
  return (
    <div className="aspect-[4/3] bg-slate-800 rounded-xl overflow-hidden relative">
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center"
        >
          <div className="w-8 h-8 rounded-full bg-primary/40" />
        </motion.div>
      </div>
      {/* Fake map grid */}
      <div className="absolute inset-0 opacity-10">
        <div className="grid grid-cols-4 grid-rows-3 h-full">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="border border-white/20" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// COST SKELETON
// ============================================================================

export function CostSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="w-7 h-7 rounded-md" />
          <div className="flex-1">
            <div className="flex justify-between mb-1">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-12" />
            </div>
            <Skeleton className="h-1 w-full rounded-full" />
          </div>
        </div>
      ))}
      <div className="border-t border-white/10 pt-3 mt-3">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-20" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PROCESSING STATE
// ============================================================================

interface ProcessingSkeletonProps {
  stage: 'analyzing' | 'generating' | 'finalizing';
  message?: string;
  detail?: string;
}

export function ProcessingSkeleton({ stage, message, detail }: ProcessingSkeletonProps) {
  const stages = [
    { key: 'analyzing', label: 'Analyzing trip' },
    { key: 'generating', label: 'Generating itinerary' },
    { key: 'finalizing', label: 'Finalizing details' },
  ];

  const currentIndex = stages.findIndex(s => s.key === stage);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        {/* Spinner */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full mx-auto mb-6"
        />

        {/* Message */}
        <h2 className="text-xl font-semibold text-white mb-2">
          {message || stages[currentIndex]?.label || 'Processing...'}
        </h2>

        {detail && (
          <p className="text-white/60 text-sm mb-6">{detail}</p>
        )}

        {/* Progress stages */}
        <div className="flex items-center justify-center gap-2 mt-6">
          {stages.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <motion.div
                className={`w-2.5 h-2.5 rounded-full ${
                  i < currentIndex
                    ? 'bg-emerald-500'
                    : i === currentIndex
                    ? 'bg-primary'
                    : 'bg-white/20'
                }`}
                animate={i === currentIndex ? { scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 1, repeat: Infinity }}
              />
              {i < stages.length - 1 && (
                <div className={`w-8 h-0.5 mx-1 ${
                  i < currentIndex ? 'bg-emerald-500/50' : 'bg-white/10'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Stage labels */}
        <div className="flex justify-between mt-2 text-xs text-white/40 max-w-[200px] mx-auto">
          {stages.map((s, i) => (
            <span
              key={s.key}
              className={i === currentIndex ? 'text-primary' : ''}
            >
              {i + 1}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// FULL PAGE SKELETON
// ============================================================================

export function TripResultsSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header skeleton */}
      <header className="bg-slate-900/95 border-b border-white/10 px-4 md:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="w-8 h-8 rounded" />
            <div>
              <Skeleton className="h-5 w-32 mb-2" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-16 rounded" />
            <Skeleton className="h-8 w-16 rounded" />
          </div>
        </div>
      </header>

      {/* Certainty bar skeleton */}
      <div className="bg-slate-800/95 border-b border-white/10 py-2.5">
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center gap-4">
          <Skeleton className="w-9 h-9 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-md" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Left column */}
          <div className="lg:col-span-2">
            <div className="mb-6">
              <Skeleton className="h-6 w-40 mb-2" />
              <Skeleton className="h-4 w-28" />
            </div>
            <ItinerarySkeleton />
          </div>

          {/* Right column */}
          <div className="lg:col-span-1 space-y-4">
            <MapSkeleton />
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Skeleton className="w-4 h-4 rounded" />
                <Skeleton className="h-4 w-20" />
              </div>
              <CostSkeleton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
