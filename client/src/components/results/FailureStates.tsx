/**
 * FailureStates.tsx
 *
 * Premium failure state components for trip results.
 * Handles: not feasible, timeout, missing data, API errors.
 */

import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  ArrowLeft,
  MapPin,
  Plane,
  ShieldX,
  Wifi,
  HelpCircle,
  Edit3,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ============================================================================
// TRIP NOT FEASIBLE
// ============================================================================

interface NotFeasibleProps {
  destination: string;
  passport?: string;
  reason?: string;
  visaType?: string;
  tripId: number;
}

export function NotFeasibleState({
  destination,
  passport,
  reason,
  visaType,
  tripId,
}: NotFeasibleProps) {
  // Build edit URL with current trip data
  const editUrl = `/create?edit=1&destination=${encodeURIComponent(destination)}${passport ? `&passport=${encodeURIComponent(passport)}` : ''}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg w-full"
      >
        {/* Card */}
        <div className="bg-slate-800/50 border border-red-500/20 rounded-2xl p-8 backdrop-blur-sm">
          {/* Icon */}
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <ShieldX className="w-8 h-8 text-red-400" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-display font-bold text-white text-center mb-2">
            Trip Not Feasible
          </h1>

          {/* Destination */}
          <p className="text-white/60 text-center mb-6">
            <MapPin className="w-4 h-4 inline mr-1" />
            {destination}
            {passport && <span className="text-white/40"> • {passport} passport</span>}
          </p>

          {/* Reason */}
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-red-300 font-medium text-sm mb-1">Why this trip isn't possible:</p>
                <p className="text-white/70 text-sm">
                  {reason || (visaType === 'not_allowed'
                    ? 'Entry is restricted for your passport nationality.'
                    : 'This destination is currently not accessible with your travel requirements.'
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* What you can do */}
          <div className="space-y-3 mb-8">
            <p className="text-white/50 text-sm font-medium">What you can do:</p>
            <ul className="space-y-2 text-sm text-white/60">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Try a different destination
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Adjust your travel dates
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Check visa requirements for transit options
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href={editUrl} className="flex-1">
              <Button className="w-full bg-white text-slate-900 hover:bg-white/90">
                <Edit3 className="w-4 h-4 mr-2" />
                Modify Trip
              </Button>
            </Link>
            <Link href="/" className="flex-1">
              <Button variant="outline" className="w-full border-white/20 text-white hover:bg-white/10">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Start Over
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================================
// GENERATION TIMEOUT
// ============================================================================

interface TimeoutProps {
  destination: string;
  onRetry: () => void;
  isRetrying?: boolean;
  elapsedSeconds?: number;
}

export function TimeoutState({
  destination,
  onRetry,
  isRetrying = false,
  elapsedSeconds,
}: TimeoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg w-full"
      >
        <div className="bg-slate-800/50 border border-amber-500/20 rounded-2xl p-8 backdrop-blur-sm">
          {/* Icon */}
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-6">
            <Clock className="w-8 h-8 text-amber-400" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-display font-bold text-white text-center mb-2">
            Taking Longer Than Expected
          </h1>

          <p className="text-white/60 text-center mb-6">
            Your {destination} itinerary is taking a while to generate.
            {elapsedSeconds && elapsedSeconds > 60 && (
              <span className="block mt-1 text-amber-400/80 text-sm">
                ({Math.floor(elapsedSeconds / 60)}m {elapsedSeconds % 60}s elapsed)
              </span>
            )}
          </p>

          {/* Explanation */}
          <div className="bg-slate-700/30 rounded-xl p-4 mb-6">
            <p className="text-white/70 text-sm">
              This can happen when our AI is processing complex itineraries or experiencing high demand.
              Your trip data is safe.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Button
              onClick={onRetry}
              disabled={isRetrying}
              className="w-full bg-amber-500 text-slate-900 hover:bg-amber-400"
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </>
              )}
            </Button>
            <Link href="/">
              <Button variant="outline" className="w-full border-white/20 text-white hover:bg-white/10">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================================
// API / NETWORK ERROR
// ============================================================================

interface ErrorStateProps {
  title?: string;
  message?: string;
  errorCode?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  showHome?: boolean;
}

export function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load your trip. Please try again.",
  errorCode,
  onRetry,
  isRetrying = false,
  showHome = true,
}: ErrorStateProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg w-full"
      >
        <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
          {/* Icon */}
          <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6">
            <Wifi className="w-8 h-8 text-white/40" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-display font-bold text-white text-center mb-2">
            {title}
          </h1>

          <p className="text-white/60 text-center mb-6">{message}</p>

          {/* Error code */}
          {errorCode && (
            <div className="bg-slate-700/30 rounded-lg px-3 py-2 mb-6 text-center">
              <span className="text-white/40 text-xs font-mono">Error: {errorCode}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3">
            {onRetry && (
              <Button
                onClick={onRetry}
                disabled={isRetrying}
                className="w-full bg-white text-slate-900 hover:bg-white/90"
              >
                {isRetrying ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again
                  </>
                )}
              </Button>
            )}
            {showHome && (
              <Link href="/">
                <Button variant="outline" className="w-full border-white/20 text-white hover:bg-white/10">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================================
// INLINE WARNING BANNER
// ============================================================================

interface InlineWarningProps {
  type: 'missing_costs' | 'missing_map' | 'stale_data' | 'partial_data';
  onAction?: () => void;
  actionLabel?: string;
}

const WARNING_CONTENT = {
  missing_costs: {
    icon: HelpCircle,
    title: 'Cost estimates unavailable',
    message: 'We couldn\'t calculate costs for this trip. Prices shown may be incomplete.',
  },
  missing_map: {
    icon: MapPin,
    title: 'Map data unavailable',
    message: 'Some locations couldn\'t be mapped. The itinerary is still complete.',
  },
  stale_data: {
    icon: Clock,
    title: 'Data may be outdated',
    message: 'This trip was generated a while ago. Prices and availability may have changed.',
  },
  partial_data: {
    icon: AlertTriangle,
    title: 'Some details missing',
    message: 'We couldn\'t fetch all activity details. Your itinerary is still usable.',
  },
};

export function InlineWarning({ type, onAction, actionLabel }: InlineWarningProps) {
  const content = WARNING_CONTENT[type];
  const Icon = content.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-4"
    >
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-amber-300 font-medium text-sm">{content.title}</p>
          <p className="text-white/60 text-sm mt-0.5">{content.message}</p>
        </div>
        {onAction && actionLabel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onAction}
            className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 shrink-0"
          >
            {actionLabel}
          </Button>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// EMPTY STATE FOR ITINERARY
// ============================================================================

interface EmptyItineraryProps {
  destination: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function EmptyItineraryState({
  destination,
  onRetry,
  isRetrying = false,
}: EmptyItineraryProps) {
  return (
    <div className="bg-slate-800/30 border border-white/10 rounded-2xl p-8 text-center">
      <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
        <Plane className="w-7 h-7 text-white/30" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">No itinerary yet</h3>
      <p className="text-white/50 text-sm mb-6 max-w-sm mx-auto">
        We couldn't generate an itinerary for {destination}. This might be a temporary issue.
      </p>
      {onRetry && (
        <Button
          onClick={onRetry}
          disabled={isRetrying}
          variant="outline"
          className="border-white/20 text-white hover:bg-white/10"
        >
          {isRetrying ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Regenerating...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </>
          )}
        </Button>
      )}
    </div>
  );
}
