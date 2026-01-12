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
// GENERATION TIMEOUT / LONG WAIT STATE
// ============================================================================

interface TimeoutProps {
  destination: string;
  dates?: string;
  durationDays?: number;
  travelStyle?: string;
  onRetry: () => void;
  onKeepWaiting?: () => void;
  isRetrying?: boolean;
  elapsedSeconds?: number;
}

/**
 * Get expected generation time message based on trip complexity
 */
function getExpectedTimeMessage(durationDays?: number, travelStyle?: string): string {
  if (!durationDays) return "This usually takes 1-2 minutes.";

  if (durationDays >= 14) {
    return `A ${durationDays}-day trip can take 2-4 minutes to generate.`;
  } else if (durationDays >= 7) {
    return `A ${durationDays}-day trip typically takes 1-3 minutes.`;
  } else {
    return "This usually takes 1-2 minutes.";
  }
}

/**
 * Format elapsed time in a friendly way
 */
function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

export function TimeoutState({
  destination,
  dates,
  durationDays,
  travelStyle,
  onRetry,
  onKeepWaiting,
  isRetrying = false,
  elapsedSeconds,
}: TimeoutProps) {
  // More positive framing - not "timeout", it's "still working"
  const isLongTrip = durationDays && durationDays >= 10;
  const expectedTimeMsg = getExpectedTimeMessage(durationDays, travelStyle);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg w-full"
      >
        <div className="bg-slate-800/50 border border-emerald-500/20 rounded-2xl p-8 backdrop-blur-sm">
          {/* Icon - spinning to show activity */}
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            >
              <RefreshCw className="w-8 h-8 text-emerald-400" />
            </motion.div>
          </div>

          {/* Title - more positive framing */}
          <h1 className="text-2xl font-display font-bold text-white text-center mb-2">
            {isLongTrip ? "Creating Your Epic Adventure" : "Still Working On It"}
          </h1>

          {/* Trip context - show dates and duration */}
          <div className="text-center mb-4">
            <p className="text-white/80">
              <MapPin className="w-4 h-4 inline mr-1" />
              {destination}
              {durationDays && (
                <span className="text-emerald-400 font-medium ml-2">
                  {durationDays} days
                </span>
              )}
            </p>
            {dates && (
              <p className="text-white/50 text-sm mt-1">{dates}</p>
            )}
          </div>

          {/* Progress indicator */}
          {elapsedSeconds && (
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-emerald-400"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
              <span className="text-emerald-400/80 text-sm">
                {formatElapsed(elapsedSeconds)} elapsed
              </span>
            </div>
          )}

          {/* Explanation - positive, informative */}
          <div className="bg-slate-700/30 rounded-xl p-4 mb-6">
            <p className="text-white/70 text-sm text-center">
              {expectedTimeMsg}
              <br />
              <span className="text-white/50 mt-1 block">
                Our AI is crafting a detailed day-by-day plan with local recommendations.
              </span>
            </p>
          </div>

          {/* Actions - Keep Waiting is primary, Retry is secondary */}
          <div className="flex flex-col gap-3">
            {onKeepWaiting && (
              <Button
                onClick={onKeepWaiting}
                className="w-full bg-emerald-600 text-white hover:bg-emerald-500"
              >
                <Clock className="w-4 h-4 mr-2" />
                Keep Waiting
              </Button>
            )}
            <Button
              onClick={onRetry}
              disabled={isRetrying}
              variant="outline"
              className="w-full border-white/30 text-white/90 hover:bg-white/10 hover:text-white"
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Restarting...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Start Over
                </>
              )}
            </Button>
          </div>

          {/* Reassurance */}
          <p className="text-white/40 text-xs text-center mt-4">
            Your trip data is saved. You won't lose anything.
          </p>
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
// GENERATING STATE (Positive Loading Experience)
// ============================================================================

interface GeneratingStateProps {
  destination: string;
  dates?: string;
  durationDays?: number;
  travelers?: number;
  travelStyle?: string;
  elapsedSeconds?: number;
  currentStep?: string;
  stepDetails?: string;
}

/**
 * Clean, focused generating state shown while itinerary is being created.
 * Replaces the scattered skeleton approach with a centered, informative UI.
 */
export function GeneratingState({
  destination,
  dates,
  durationDays,
  travelers,
  travelStyle,
  elapsedSeconds,
  currentStep,
  stepDetails,
}: GeneratingStateProps) {
  // Dynamic messaging based on elapsed time
  const getMessage = () => {
    if (!elapsedSeconds || elapsedSeconds < 15) {
      return "Gathering destination intel...";
    } else if (elapsedSeconds < 30) {
      return "Analyzing visa requirements & costs...";
    } else if (elapsedSeconds < 60) {
      return "Crafting your day-by-day itinerary...";
    } else if (elapsedSeconds < 90) {
      return "Adding local recommendations...";
    } else {
      return "Finalizing your perfect trip...";
    }
  };

  const progressSteps = [
    { label: "Destination", done: (elapsedSeconds || 0) > 5 },
    { label: "Feasibility", done: (elapsedSeconds || 0) > 20 },
    { label: "Itinerary", done: (elapsedSeconds || 0) > 60 },
    { label: "Details", done: (elapsedSeconds || 0) > 90 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className="bg-slate-800/60 border border-white/10 rounded-2xl p-8 backdrop-blur-sm text-center">
          {/* Animated globe/plane icon */}
          <div className="relative w-20 h-20 mx-auto mb-6">
            {/* Rotating outer ring */}
            <motion.div
              className="absolute inset-0 border-2 border-primary/30 rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            />
            {/* Inner pulsing circle */}
            <motion.div
              className="absolute inset-2 bg-primary/10 rounded-full flex items-center justify-center"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Plane className="w-8 h-8 text-primary" />
            </motion.div>
          </div>

          {/* Destination + trip details */}
          <h1 className="text-2xl font-display font-bold text-white mb-2">
            {destination}
          </h1>
          <div className="flex items-center justify-center gap-3 text-white/60 text-sm mb-6">
            {durationDays && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {durationDays} days
              </span>
            )}
            {travelers && (
              <span>{travelers} traveler{travelers !== 1 ? 's' : ''}</span>
            )}
            {travelStyle && (
              <span className="capitalize">{travelStyle}</span>
            )}
          </div>

          {/* Current step message */}
          <div className="bg-white/5 rounded-xl px-4 py-3 mb-6">
            <p className="text-white font-medium">
              {currentStep || getMessage()}
            </p>
            {stepDetails && (
              <p className="text-white/50 text-sm mt-1">{stepDetails}</p>
            )}
          </div>

          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-1 mb-4">
            {progressSteps.map((step, i) => (
              <div key={step.label} className="flex items-center">
                <div
                  className={`w-2 h-2 rounded-full transition-colors ${
                    step.done ? 'bg-primary' : 'bg-white/20'
                  }`}
                />
                {i < progressSteps.length - 1 && (
                  <div className={`w-8 h-0.5 ${step.done ? 'bg-primary/50' : 'bg-white/10'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Time elapsed */}
          {elapsedSeconds !== undefined && (
            <p className="text-white/40 text-xs">
              {formatElapsed(elapsedSeconds)} elapsed
              {durationDays && durationDays >= 7 && (
                <span className="block mt-1">
                  Longer trips take a bit more time to plan perfectly
                </span>
              )}
            </p>
          )}
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
