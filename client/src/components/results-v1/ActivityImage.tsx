/**
 * ActivityImage.tsx
 *
 * Lazy-loaded activity thumbnail with skeleton and fallback.
 * Uses Unsplash Source API via activityImages utility.
 *
 * Features:
 * - Lazy loading on mount
 * - Skeleton while loading
 * - Gradient + emoji fallback on error
 * - No layout shift (fixed dimensions)
 */

import React, { useState, useEffect, useMemo, memo } from 'react';
import { cn } from '@/lib/utils';
import {
  getActivityImageUrl,
  fetchActivityImage,
} from '@/lib/activityImages';

// ============================================================================
// TYPES
// ============================================================================

type ActivityType = 'activity' | 'meal' | 'transport' | 'lodging';

interface ActivityImageProps {
  activityName: string;
  destination: string;
  activityType?: ActivityType;
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md';
}

// ============================================================================
// COMPONENT
// ============================================================================

function ActivityImageComponent({
  activityName,
  destination,
  activityType = 'activity',
  className,
  size = 'sm',
}: ActivityImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Get cached state + placeholders in one call (memoized)
  const cached = useMemo(
    () => getActivityImageUrl(activityName, destination, activityType),
    [activityName, destination, activityType]
  );

  // Fetch image if not cached
  useEffect(() => {
    // Cancellation guard to prevent setState after unmount
    let cancelled = false;

    if (cached.url) {
      // Already cached, use immediately
      setImageUrl(cached.url);
      setIsLoading(false);
    } else {
      // Fetch async with cancellation check
      fetchActivityImage(activityName, destination)
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
  }, [activityName, destination, cached.url]);

  // Extract placeholder info from memoized result
  const { placeholder, emoji } = cached;

  // Size classes
  const sizeClasses = size === 'sm'
    ? 'w-10 h-10 rounded-lg text-base'
    : 'w-14 h-14 rounded-xl text-xl';

  // Skeleton state
  if (isLoading) {
    return (
      <div
        className={cn(
          sizeClasses,
          'bg-white/10 animate-pulse flex-shrink-0',
          className
        )}
      />
    );
  }

  // Image loaded successfully
  if (imageUrl && !hasError) {
    return (
      <div
        className={cn(
          sizeClasses,
          'flex-shrink-0 overflow-hidden bg-white/5',
          className
        )}
      >
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  // Fallback: gradient + emoji
  return (
    <div
      className={cn(
        sizeClasses,
        'flex-shrink-0 flex items-center justify-center',
        className
      )}
      style={{ background: placeholder }}
    >
      <span role="img" aria-hidden="true">{emoji}</span>
    </div>
  );
}

// Memoize to prevent unnecessary refetches
export const ActivityImage = memo(ActivityImageComponent);
