/**
 * TripUpdateBanner.tsx
 *
 * Shows a subtle banner when user returns from edit flow.
 * Displays what changed and confirms feasibility was rechecked.
 *
 * - Auto-dismisses after 5 seconds
 * - Dismiss on X click
 * - Does not reappear on refresh (controlled by parent via URL params)
 *
 * Performance: Memoized to prevent page-wide cascades.
 */

import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle, X } from "lucide-react";

// Static dictionary mapping field keys to user-friendly labels
const CHANGE_LABELS: Record<string, string> = {
  destination: "Destination updated",
  dates: "Dates changed",
  groupSize: "Travelers updated",
  travelStyle: "Style adjusted",
  budget: "Budget adjusted",
  passport: "Passport changed",
  origin: "Origin updated",
};

interface TripUpdateBannerProps {
  changes: string[];
  onDismiss: () => void;
  autoDismissMs?: number;
}

function TripUpdateBannerComponent({
  changes,
  onDismiss,
  autoDismissMs = 5000,
}: TripUpdateBannerProps) {
  // Auto-dismiss after specified time
  useEffect(() => {
    const timer = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(timer);
  }, [onDismiss, autoDismissMs]);

  // Build display text: max 3 changes + feasibility
  const changeLabels = changes
    .slice(0, 3)
    .map((key) => CHANGE_LABELS[key] || `${key} updated`)
    .filter(Boolean);

  // Always include feasibility confirmation
  const displayParts = [
    "Trip updated",
    ...changeLabels,
    "Feasibility rechecked",
  ];

  // If no specific changes, just show base message
  const displayText =
    changeLabels.length > 0
      ? displayParts.join(" · ")
      : "Trip updated · Feasibility rechecked";

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="bg-slate-800/80 backdrop-blur-sm border-b border-emerald-500/30"
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-2.5">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Icon + Text */}
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-sm text-white/90 truncate">{displayText}</span>
          </div>

          {/* Right: Dismiss button */}
          <button
            onClick={onDismiss}
            className="p-1 hover:bg-white/10 rounded transition-colors shrink-0"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4 text-white/50 hover:text-white/80" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// Memoize to prevent page-wide rerenders
export const TripUpdateBanner = React.memo(TripUpdateBannerComponent);
