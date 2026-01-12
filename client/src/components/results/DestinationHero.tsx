/**
 * DestinationHero.tsx
 *
 * Full-width hero banner with destination image, trip meta, and verdict.
 * Creates emotional anchor at the top of the results page.
 *
 * Features:
 * - Background image with lazy loading
 * - Dark gradient overlay for text readability
 * - Verdict badge with score
 * - Trip metadata
 * - Action buttons
 */

import React, { useState, useEffect, useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar,
  Users,
  Sparkles,
  Share2,
  Pencil,
  FileDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getDestinationImageUrl,
  fetchDestinationImage,
  getDestinationFallbackGradient,
} from '@/lib/destinationImages';
// ============================================================================
// TYPES
// ============================================================================

interface DestinationHeroProps {
  destination: string;
  dates?: string;
  travelers?: number;
  travelStyle?: string;
  onShare?: () => void;
  onEdit?: () => void;
  onExportPdf?: () => void;
  className?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function DestinationHeroComponent({
  destination,
  dates,
  travelers,
  travelStyle,
  onShare,
  onEdit,
  onExportPdf,
  className,
}: DestinationHeroProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Get cached state + fallback
  const cached = useMemo(
    () => getDestinationImageUrl(destination),
    [destination]
  );

  // Fetch image if not cached
  useEffect(() => {
    let cancelled = false;

    if (cached.url) {
      setImageUrl(cached.url);
      setIsLoading(false);
    } else {
      fetchDestinationImage(destination)
        .then((url) => {
          if (cancelled) return;
          if (url) {
            setImageUrl(url);
          }
          setIsLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setIsLoading(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [destination, cached.url]);

  // Format dates for display
  const formattedDates = useMemo(() => {
    if (!dates) return null;

    // Handle "YYYY-MM-DD to YYYY-MM-DD" format
    const parts = dates.split(' to ');
    if (parts.length === 2) {
      try {
        // Use noon UTC to avoid timezone issues (same as DayCardList)
        const start = new Date(parts[0].trim() + 'T12:00:00Z');
        const end = new Date(parts[1].trim() + 'T12:00:00Z');
        const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', timeZone: 'UTC' };
        const optionsWithYear: Intl.DateTimeFormatOptions = { ...options, year: 'numeric' };
        return `${start.toLocaleDateString('en-US', options)} – ${end.toLocaleDateString('en-US', optionsWithYear)}`;
      } catch {
        return dates;
      }
    }
    return dates;
  }, [dates]);

  // Travel style display
  const styleDisplay = travelStyle
    ? travelStyle.charAt(0).toUpperCase() + travelStyle.slice(1)
    : null;

  // Fallback gradient
  const fallbackGradient = getDestinationFallbackGradient(destination);

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-2xl',
        'min-h-[180px] md:min-h-[220px]',
        className
      )}
    >
      {/* Background image or gradient */}
      <div className="absolute inset-0">
        {imageUrl && !hasError ? (
          <motion.img
            initial={{ scale: 1.05, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8 }}
            src={imageUrl}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setHasError(true)}
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: fallbackGradient }}
          />
        )}

        {/* Shimmer effect while loading */}
        {isLoading && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
        )}
      </div>

      {/* Gradient overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-end p-4 md:p-6">
        {/* Action buttons (top right) */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {onShare && (
            <button
              onClick={onShare}
              className="p-2 rounded-lg bg-black/30 backdrop-blur-sm text-white/70 hover:text-white hover:bg-black/50 transition-colors"
              title="Share trip"
            >
              <Share2 className="w-4 h-4" />
            </button>
          )}
          {onExportPdf && (
            <button
              onClick={onExportPdf}
              className="p-2 rounded-lg bg-black/30 backdrop-blur-sm text-white/70 hover:text-white hover:bg-black/50 transition-colors"
              title="Export PDF"
            >
              <FileDown className="w-4 h-4" />
            </button>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-2 rounded-lg bg-black/30 backdrop-blur-sm text-white/70 hover:text-white hover:bg-black/50 transition-colors"
              title="Edit trip"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Destination name */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-2 drop-shadow-lg"
        >
          {destination}
        </motion.h1>

        {/* Trip metadata */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="flex flex-wrap items-center gap-2 md:gap-3 text-white/80 text-xs md:text-sm mb-3"
        >
          {formattedDates && (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              <span>{formattedDates}</span>
            </div>
          )}
          {travelers && (
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              <span>{travelers} traveler{travelers !== 1 ? 's' : ''}</span>
            </div>
          )}
          {styleDisplay && (
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span>{styleDisplay}</span>
            </div>
          )}
        </motion.div>

        {/* Verdict badge removed - DecisionStack is the single source of truth */}
      </div>
    </div>
  );
}

// Add shimmer keyframes via style tag (or add to globals.css)
const shimmerStyle = `
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
.animate-shimmer {
  animation: shimmer 1.5s infinite;
}
`;

// Inject shimmer style
if (typeof document !== 'undefined') {
  const styleEl = document.getElementById('destination-hero-styles') || document.createElement('style');
  styleEl.id = 'destination-hero-styles';
  styleEl.textContent = shimmerStyle;
  if (!document.getElementById('destination-hero-styles')) {
    document.head.appendChild(styleEl);
  }
}

export const DestinationHero = memo(DestinationHeroComponent);
