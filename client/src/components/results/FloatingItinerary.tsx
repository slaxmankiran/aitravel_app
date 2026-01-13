/**
 * FloatingItinerary Component
 *
 * Narrow left panel for itinerary with heavy glassmorphism.
 * Contains hero image + scrollable DayCardList.
 *
 * Design: Max-width 400px, semi-transparent, rounded corners.
 */

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, MapPin, Ruler } from 'lucide-react';
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
      // Try to extract city from day title or first activity
      const title = day.title || '';
      // Match patterns like "Bangkok - Temple Tour" or just use first word if it's a city
      const dashMatch = title.match(/^([^-–—]+)/);
      if (dashMatch) {
        const possibleCity = dashMatch[1].trim();
        if (possibleCity.length < 20) { // Likely a city name
          citySet.add(possibleCity);
        }
      }
    });

    const cities = Array.from(citySet).slice(0, 3);
    if (cities.length === 0) return `${days.length} days of adventure`;
    if (cities.length === 1) return `${days.length} days in ${cities[0]}`;
    return `${cities.slice(0, -1).join(', ')} & ${cities[cities.length - 1]}`;
  }, [days]);

  // Loading state
  if (isGenerating && days.length === 0) {
    return (
      <motion.aside
        initial={{ x: -50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={springTransition}
        className={`fixed left-4 top-24 bottom-6 z-20 w-full max-w-[400px] ${className}`}
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

  return (
    <motion.aside
      initial={{ x: -50, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={springTransition}
      className={`fixed left-4 top-24 bottom-6 z-20 w-full max-w-[400px] ${className}`}
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
