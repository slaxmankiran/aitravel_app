/**
 * ActivityRow.tsx
 *
 * Single activity row within a DayCard.
 * Shows time, name, location, cost, and transport icon.
 *
 * Performance: Memoized component for scroll/hover performance.
 */

import React from "react";
import {
  MapPin,
  Car,
  Bus,
  Train,
  Footprints,
  Camera,
  Utensils,
  BedDouble,
  Navigation,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type Activity,
  getActivityName,
  getLocationString,
  getActivityCost,
  hasCoordinates,
  formatDistance,
  getSmartTransportMode,
} from "./itinerary-adapters";
import { ActivityImage } from "./ActivityImage";

// ============================================================================
// TRANSPORT ICON MAPPING
// ============================================================================

function getTransportIcon(iconName: string) {
  switch (iconName) {
    case "walk": return Footprints;
    case "train": return Train;
    case "bus": return Bus;
    case "car": return Car;
    case "plane": return Navigation; // Using Navigation as plane icon
    default: return Car;
  }
}

function getTransportColor(iconName: string): string {
  switch (iconName) {
    case "walk": return "text-green-400";
    case "train": return "text-blue-400";
    case "bus": return "text-orange-400";
    case "car": return "text-yellow-400";
    case "plane": return "text-purple-400";
    default: return "text-white/40";
  }
}

// ============================================================================
// ACTIVITY TYPE ICON
// ============================================================================

function getActivityTypeIcon(type: Activity["type"]) {
  switch (type) {
    case "meal":
      return Utensils;
    case "lodging":
      return BedDouble;
    case "transport":
      return Navigation;
    default:
      return Camera;
  }
}

const TYPE_COLORS: Record<
  string,
  { bg: string; text: string; ring: string }
> = {
  activity: { bg: "bg-blue-500/10", text: "text-blue-300", ring: "ring-blue-400/30" },
  meal: { bg: "bg-amber-500/10", text: "text-amber-300", ring: "ring-amber-400/30" },
  transport: { bg: "bg-purple-500/10", text: "text-purple-300", ring: "ring-purple-400/30" },
  lodging: { bg: "bg-green-500/10", text: "text-green-300", ring: "ring-green-400/30" },
};

// ============================================================================
// COMPONENT
// ============================================================================

interface ActivityRowProps {
  activity: Activity;
  activityKey: string;
  currencySymbol: string;
  isActive: boolean;
  isHovered: boolean;
  showTransport: boolean;
  distanceFromPrevious?: number | null; // Distance in km from previous activity
  prevActivity?: Activity | null; // Previous activity for context
  showDistance?: boolean;
  /** Destination for activity image context */
  destination?: string;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function ActivityRowComponent({
  activity,
  activityKey,
  currencySymbol,
  isActive,
  isHovered,
  showTransport,
  distanceFromPrevious,
  prevActivity,
  showDistance = false,
  destination,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: ActivityRowProps) {
  const name = getActivityName(activity);
  const location = getLocationString(activity);
  const cost = getActivityCost(activity);
  const hasLocation = hasCoordinates(activity);
  const colors = TYPE_COLORS[activity.type] || TYPE_COLORS.activity;
  const TypeIcon = getActivityTypeIcon(activity.type);

  // Show image for main activity types (not transport)
  const showImage = destination && activity.type !== 'transport';

  // Get smart transport mode based on distance and context
  const smartTransport = getSmartTransportMode(
    distanceFromPrevious ?? null,
    activity,
    prevActivity ?? undefined
  );
  const TransportIcon = getTransportIcon(smartTransport.icon);
  const transportColor = getTransportColor(smartTransport.icon);

  // Show transport/distance when:
  // 1. showTransport is true (not first activity in slot)
  // 2. showDistance toggle is enabled
  // 3. We have distance or explicit transport mode
  const shouldShowTransport = showTransport && showDistance && (distanceFromPrevious !== null || activity.transportMode);

  return (
    <div className="relative">
      {/* Transport indicator + Distance - Smart mode */}
      {shouldShowTransport && (
        <div className="flex items-center gap-2 ml-[3.75rem] mb-1">
          <div className="w-px h-3 bg-white/10" />
          <TransportIcon className={cn("w-3.5 h-3.5", transportColor)} />
          <span className="text-[11px] text-white/40 capitalize">
            {smartTransport.mode}
          </span>
          {/* Distance and time badge */}
          {distanceFromPrevious !== null && distanceFromPrevious !== undefined && (
            <span className="text-[10px] bg-white/10 text-white/60 px-1.5 py-0.5 rounded-full">
              {formatDistance(distanceFromPrevious)}
              {smartTransport.time && ` • ${smartTransport.time}`}
            </span>
          )}
        </div>
      )}

      {/* Activity row */}
      <div
        data-activity-key={activityKey}
        className={cn(
          "group relative flex items-start gap-3 px-3 py-2.5 rounded-xl cursor-pointer",
          "transition-all duration-150",
          "bg-white/[0.02] hover:bg-white/[0.06]",
          "border border-transparent",
          isHovered && "bg-white/[0.06]",
          isActive &&
            "bg-white/[0.08] border-primary/40 ring-1 ring-primary/30"
        )}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {/* Active left accent */}
        <div
          className={cn(
            "absolute left-0 top-2 bottom-2 w-[2px] rounded-full transition-opacity",
            isActive ? "bg-primary opacity-100" : "opacity-0"
          )}
          aria-hidden="true"
        />

        {/* Time */}
        <div className="w-14 flex-shrink-0 pt-0.5">
          <span className="text-sm font-medium text-white/60">
            {activity.time}
          </span>
        </div>

        {/* Activity image or type icon */}
        {showImage ? (
          <ActivityImage
            activityName={name}
            destination={destination!}
            activityType={activity.type}
            size="sm"
            className="ring-1 ring-white/10"
          />
        ) : (
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
              colors.bg,
              "ring-1 ring-white/10"
            )}
          >
            <TypeIcon className={cn("w-4 h-4", colors.text)} />
          </div>
        )}

        {/* Content */}
        <div className="flex-grow min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {name}
              </p>

              {location && (
                <div className="flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-white/40 shrink-0" />
                  <span className="text-xs text-white/50 truncate">
                    {location}
                  </span>
                  {hasLocation && (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0"
                      title="On map"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Cost badge - no icon, just text */}
            {cost !== null && (
              <div
                className={cn(
                  "px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0",
                  cost === 0
                    ? "bg-green-500/15 text-green-300"
                    : "bg-white/10 text-white/70"
                )}
              >
                {cost === 0 ? "Free" : `${currencySymbol}${cost.toLocaleString()}`}
              </div>
            )}
          </div>

          {/* Booking tip */}
          {activity.bookingTip && (
            <p className="text-xs text-amber-400/90 mt-1 line-clamp-1">
              💡 {activity.bookingTip}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Memoize for scroll and hover performance
export const ActivityRow = React.memo(ActivityRowComponent);
