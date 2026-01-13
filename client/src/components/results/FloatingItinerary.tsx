/**
 * FloatingItinerary Component
 *
 * Responsive itinerary panel:
 * - Desktop (md+): Narrow left side panel with glassmorphism
 * - Mobile (<md): Bottom sheet drawer that can be expanded/collapsed
 *
 * Design: Premium glass styling, spring animations.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo, useMotionValue, useTransform } from 'framer-motion';
import { ChevronDown, ChevronUp, MapPin, Ruler, GripHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DayCardList } from '@/components/results-v1/DayCardList';
import { DestinationHero } from '@/components/results/DestinationHero';
import { ItinerarySkeleton } from '@/components/results/ResultsSkeletons';
import type { TripResponse } from '@shared/schema';
import type { Itinerary } from '@/components/results-v1/itinerary-adapters';
import { springTransition } from '@/components/transitions';

interface FloatingItineraryProps {
  trip: TripResponse;
  isGenerating?: boolean;
  activeDayIndex?: number | null;
  activeActivityKey?: string | null;
  onActivityHover: (key: string | null) => void;
  onActivityClick: (key: string) => void;
  onDayClick: (dayIndex: number) => void;
  className?: string;
}

// ============================================================================
// MOBILE BOTTOM SHEET STATES
// ============================================================================

type SheetState = 'collapsed' | 'partial' | 'expanded';

const SHEET_HEIGHTS = {
  collapsed: 80,   // Just the handle + peek
  partial: 45,     // 45% of viewport
  expanded: 85,    // 85% of viewport
} as const;

// ============================================================================
// HOOKS
// ============================================================================

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

// ============================================================================
// COMPONENT
// ============================================================================

function FloatingItineraryComponent({
  trip,
  isGenerating = false,
  activeDayIndex = null,
  activeActivityKey = null,
  onActivityHover,
  onActivityClick,
  onDayClick,
  className = '',
}: FloatingItineraryProps) {
  const [allExpanded, setAllExpanded] = useState(true);
  const [showDistances, setShowDistances] = useState(false);
  const [sheetState, setSheetState] = useState<SheetState>('partial');

  const isMobile = useIsMobile();

  // Cast the itinerary to the expected type (runtime data matches the structure)
  const itinerary = trip.itinerary as unknown as Itinerary | undefined;
  const days = itinerary?.days || [];
  const currency = trip.currency || 'USD';
  const destination = trip.destination || 'Your Destination';

  // Extract city names for narrative
  const narrativeSubtitle = useMemo(() => {
    if (!days.length) return null;

    const citySet = new Set<string>();
    days.forEach(day => {
      const title = day.title || '';
      const dashMatch = title.match(/^([^-–—]+)/);
      if (dashMatch) {
        const possibleCity = dashMatch[1].trim();
        if (possibleCity.length < 20) {
          citySet.add(possibleCity);
        }
      }
    });

    const cities = Array.from(citySet).slice(0, 3);
    if (cities.length === 0) return `${days.length} days of adventure`;
    if (cities.length === 1) return `${days.length} days in ${cities[0]}`;
    return `${cities.slice(0, -1).join(', ')} & ${cities[cities.length - 1]}`;
  }, [days]);

  // Handle sheet drag
  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    const velocity = info.velocity.y;
    const offset = info.offset.y;

    // Determine next state based on drag direction and velocity
    if (velocity < -500 || (velocity < 0 && offset < -50)) {
      // Swiped up fast or dragged up
      setSheetState(prev => prev === 'collapsed' ? 'partial' : 'expanded');
    } else if (velocity > 500 || (velocity > 0 && offset > 50)) {
      // Swiped down fast or dragged down
      setSheetState(prev => prev === 'expanded' ? 'partial' : 'collapsed');
    }
  }, []);

  // Toggle between states on tap
  const cycleSheetState = useCallback(() => {
    setSheetState(prev => {
      if (prev === 'collapsed') return 'partial';
      if (prev === 'partial') return 'expanded';
      return 'partial';
    });
  }, []);

  // Get current height percentage
  const currentHeight = SHEET_HEIGHTS[sheetState];

  // Loading state (works for both mobile and desktop)
  if (isGenerating && days.length === 0) {
    if (isMobile) {
      return (
        <motion.aside
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          transition={springTransition}
          className="fixed inset-x-0 bottom-0 z-30"
          style={{ height: `${SHEET_HEIGHTS.partial}vh` }}
        >
          <div className="h-full bg-slate-900/90 backdrop-blur-2xl border-t border-white/[0.08] rounded-t-3xl shadow-[0_-8px_32px_rgba(0,0,0,0.5)]">
            <div className="flex justify-center py-3">
              <div className="w-12 h-1.5 bg-white/20 rounded-full" />
            </div>
            <div className="px-4 pb-4">
              <ItinerarySkeleton />
            </div>
          </div>
        </motion.aside>
      );
    }

    return (
      <motion.aside
        initial={{ x: -50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={springTransition}
        className={`hidden md:block fixed left-4 top-24 bottom-6 z-20 w-full max-w-[400px] ${className}`}
      >
        <div className="h-full bg-slate-900/60 backdrop-blur-2xl border border-white/[0.08] rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col">
          <div className="h-32 bg-slate-800/50 animate-pulse rounded-t-3xl" />
          <div className="flex-1 p-4">
            <ItinerarySkeleton />
          </div>
        </div>
      </motion.aside>
    );
  }

  // ============================================================================
  // MOBILE BOTTOM SHEET
  // ============================================================================
  if (isMobile) {
    return (
      <motion.aside
        initial={{ y: 100 }}
        animate={{
          y: 0,
          height: `${currentHeight}vh`,
        }}
        transition={springTransition}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        className="fixed inset-x-0 bottom-0 z-30 touch-none"
      >
        <div className="h-full bg-slate-900/95 backdrop-blur-2xl border-t border-x border-white/[0.08] rounded-t-3xl shadow-[0_-8px_32px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col">
          {/* Drag Handle */}
          <div
            className="flex flex-col items-center py-2 cursor-grab active:cursor-grabbing shrink-0"
            onClick={cycleSheetState}
          >
            <div className="w-12 h-1.5 bg-white/30 rounded-full mb-1" />
            <GripHorizontal className="w-5 h-5 text-white/20" />
          </div>

          {/* Collapsed Preview - show only when collapsed */}
          <AnimatePresence>
            {sheetState === 'collapsed' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="px-4 pb-3 shrink-0"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    <span className="text-white font-medium">{destination.split(',')[0]}</span>
                    <span className="text-white/50 text-sm">• {days.length} days</span>
                  </div>
                  <ChevronUp className="w-5 h-5 text-white/50" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Full Content - show when partial or expanded */}
          {sheetState !== 'collapsed' && (
            <>
              {/* Compact Header */}
              <div className="px-4 pb-2 shrink-0 border-b border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    <span className="text-white font-medium">{destination.split(',')[0]}</span>
                    <span className="text-white/50 text-sm">• {days.length} days</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); setAllExpanded(prev => !prev); }}
                      className="h-7 px-2 text-xs text-white/50 hover:text-white/80"
                    >
                      {allExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); setShowDistances(!showDistances); }}
                      className={`h-7 px-2 text-xs ${showDistances ? 'text-emerald-400' : 'text-white/50'}`}
                    >
                      <Ruler className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Scrollable Itinerary */}
              <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3">
                <DayCardList
                  tripId={trip.id}
                  itinerary={itinerary || { days: [] }}
                  currency={currency}
                  tripStartDate={trip.dates || undefined}
                  activeDayIndex={activeDayIndex}
                  activeActivityKey={activeActivityKey}
                  allExpanded={allExpanded}
                  showDistances={showDistances}
                  destination={destination}
                  onDayClick={onDayClick}
                  onActivityClick={onActivityClick}
                  onActivityHover={onActivityHover}
                />
              </div>

              {/* Streaming indicator */}
              {isGenerating && days.length > 0 && (
                <div className="px-4 py-2 border-t border-white/[0.06] shrink-0">
                  <div className="flex items-center gap-2 text-xs text-emerald-400">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    <span>Generating day {days.length + 1}...</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </motion.aside>
    );
  }

  // ============================================================================
  // DESKTOP SIDE PANEL
  // ============================================================================
  return (
    <motion.aside
      initial={{ x: -50, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={springTransition}
      className={`hidden md:block fixed left-4 top-24 bottom-6 z-20 w-full max-w-[400px] ${className}`}
    >
      <div className="h-full bg-slate-900/60 backdrop-blur-2xl border border-white/[0.08] rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col">
        {/* Compact Hero */}
        <div className="relative h-36 overflow-hidden rounded-t-3xl shrink-0">
          <DestinationHero
            destination={destination}
            className="absolute inset-0"
          />

          {/* Overlay with destination name */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent" />

          <div className="absolute bottom-3 left-4 right-4">
            <div className="flex items-center gap-2 text-white/70 text-xs mb-1">
              <MapPin className="w-3 h-3" />
              <span>{days.length} days</span>
              {narrativeSubtitle && (
                <>
                  <span className="text-white/30">•</span>
                  <span className="truncate">{narrativeSubtitle}</span>
                </>
              )}
            </div>
            <h2 className="text-lg font-semibold text-white truncate">
              {destination.split(',')[0]}
            </h2>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAllExpanded(prev => !prev)}
              className="h-7 px-2 text-xs text-white/50 hover:text-white/80 hover:bg-white/5"
            >
              {allExpanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5 mr-1" />
                  Collapse All
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5 mr-1" />
                  Expand All
                </>
              )}
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDistances(!showDistances)}
            className={`h-7 px-2 text-xs ${showDistances ? 'text-emerald-400 bg-emerald-500/10' : 'text-white/50 hover:text-white/80 hover:bg-white/5'}`}
          >
            <Ruler className="w-3.5 h-3.5 mr-1" />
            Distances
          </Button>
        </div>

        {/* Scrollable Itinerary */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3">
          <DayCardList
            tripId={trip.id}
            itinerary={itinerary || { days: [] }}
            currency={currency}
            tripStartDate={trip.dates || undefined}
            activeDayIndex={activeDayIndex}
            activeActivityKey={activeActivityKey}
            allExpanded={allExpanded}
            showDistances={showDistances}
            destination={destination}
            onDayClick={onDayClick}
            onActivityClick={onActivityClick}
            onActivityHover={onActivityHover}
          />
        </div>

        {/* Streaming indicator */}
        {isGenerating && days.length > 0 && (
          <div className="px-4 py-2 border-t border-white/[0.06] shrink-0">
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span>Generating day {days.length + 1}...</span>
            </div>
          </div>
        )}
      </div>
    </motion.aside>
  );
}

export const FloatingItinerary = React.memo(FloatingItineraryComponent);
