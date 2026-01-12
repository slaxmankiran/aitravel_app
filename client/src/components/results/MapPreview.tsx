/**
 * MapPreview.tsx
 *
 * Compact map preview card for the right rail.
 * Shows a static preview with "View full map" CTA.
 * Reduces map dominance while keeping it accessible.
 */

import React, { memo, useState, useMemo } from 'react';
import { Map, Maximize2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MapPreviewProps {
  /** Number of days in itinerary */
  daysCount: number;
  /** Number of locations/activities */
  locationsCount: number;
  /** Destination name for display */
  destination: string;
  /** Currently selected day (for dropdown) */
  selectedDay?: number | null;
  /** Available days for filter */
  availableDays?: number[];
  /** Callback when user wants to expand to full map */
  onExpand: () => void;
  /** Callback when day filter changes */
  onDayChange?: (day: number | null) => void;
  /** Optional className */
  className?: string;
}

function MapPreviewComponent({
  daysCount,
  locationsCount,
  destination,
  selectedDay,
  availableDays = [],
  onExpand,
  onDayChange,
  className,
}: MapPreviewProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Generate day options for dropdown
  const dayOptions = useMemo(() => {
    if (availableDays.length > 0) {
      return availableDays;
    }
    return Array.from({ length: daysCount }, (_, i) => i + 1);
  }, [availableDays, daysCount]);

  return (
    <div
      className={cn(
        'relative bg-slate-800/50 border border-white/10 rounded-xl overflow-hidden',
        'transition-all duration-200',
        isHovered && 'border-white/20 bg-slate-800/70',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Preview content */}
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Map className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Route Map</h3>
              <p className="text-xs text-white/50">
                {locationsCount} locations across {daysCount} days
              </p>
            </div>
          </div>

          {/* Day filter dropdown */}
          {daysCount > 1 && onDayChange && (
            <div className="relative">
              <select
                value={selectedDay ?? 'all'}
                onChange={(e) => {
                  const val = e.target.value;
                  onDayChange(val === 'all' ? null : Number(val));
                }}
                className="appearance-none bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 pr-7 text-xs text-white/70 hover:bg-white/15 focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
              >
                <option value="all">All Days</option>
                {dayOptions.map((day) => (
                  <option key={day} value={day}>
                    Day {day}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/40 pointer-events-none" />
            </div>
          )}
        </div>

        {/* Mini map placeholder with gradient */}
        <div className="relative h-24 rounded-lg overflow-hidden bg-gradient-to-br from-slate-700 via-slate-600 to-slate-700 mb-3">
          {/* Decorative route line */}
          <svg
            className="absolute inset-0 w-full h-full opacity-30"
            viewBox="0 0 200 100"
            preserveAspectRatio="none"
          >
            <path
              d="M10,80 Q50,20 100,50 T190,30"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              className="text-primary"
              strokeDasharray="4 2"
            />
            {/* Dots for locations */}
            <circle cx="10" cy="80" r="4" className="fill-primary" />
            <circle cx="100" cy="50" r="4" className="fill-primary" />
            <circle cx="190" cy="30" r="4" className="fill-primary" />
          </svg>

          {/* Hover overlay */}
          <div
            className={cn(
              'absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-200',
              isHovered ? 'opacity-100' : 'opacity-0'
            )}
          >
            <span className="text-xs text-white/80 font-medium">Click to view full map</span>
          </div>
        </div>

        {/* Expand button */}
        <button
          onClick={onExpand}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/80 hover:text-white text-sm font-medium transition-colors"
        >
          <Maximize2 className="w-4 h-4" />
          View full map
        </button>
      </div>
    </div>
  );
}

export const MapPreview = memo(MapPreviewComponent);
