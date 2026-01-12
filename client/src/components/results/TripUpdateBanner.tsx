/**
 * TripUpdateBanner.tsx
 *
 * Shows a centered popup when user returns from edit flow.
 * Displays what changed and confirms feasibility was rechecked.
 *
 * - Auto-dismisses after 5 seconds
 * - Dismiss on X click or clicking outside
 * - Does not reappear on refresh (controlled by parent via URL params)
 *
 * Performance: Memoized to prevent page-wide cascades.
 */

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, X, RefreshCw } from "lucide-react";

// Static dictionary mapping field keys to user-friendly labels
const CHANGE_LABELS: Record<string, string> = {
  destination: "Destination",
  dates: "Travel dates",
  groupSize: "Travelers",
  travelStyle: "Travel style",
  budget: "Budget",
  passport: "Passport",
  origin: "Origin",
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

  // Build list of changed fields
  const changeLabels = changes
    .slice(0, 4)
    .map((key) => CHANGE_LABELS[key] || key)
    .filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onDismiss}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="relative bg-slate-800 border border-white/10 rounded-xl shadow-2xl max-w-sm w-full overflow-hidden"
      >
        {/* Close button */}
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 p-1.5 hover:bg-white/10 rounded-lg transition-colors z-10"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4 text-white/50 hover:text-white/80" />
        </button>

        {/* Content */}
        <div className="p-6 text-center">
          {/* Success icon */}
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <CheckCircle className="w-7 h-7 text-emerald-400" />
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-white mb-2">
            Trip Updated!
          </h3>

          {/* What changed */}
          {changeLabels.length > 0 && (
            <div className="mb-4">
              <p className="text-sm text-white/60 mb-2">Changes applied:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {changeLabels.map((label, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 text-xs bg-white/10 text-white/80 rounded-full"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Feasibility rechecked */}
          <div className="flex items-center justify-center gap-2 text-sm text-emerald-400">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Feasibility rechecked</span>
          </div>
        </div>

        {/* Progress bar for auto-dismiss */}
        <motion.div
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: autoDismissMs / 1000, ease: "linear" }}
          className="h-1 bg-emerald-500/50 origin-left"
        />
      </motion.div>
    </motion.div>
  );
}

// Memoize to prevent page-wide rerenders
export const TripUpdateBanner = React.memo(TripUpdateBannerComponent);
