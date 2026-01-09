/**
 * ChangePlanBanner.tsx
 *
 * Banner that displays after a trip change is applied.
 * Shows delta summary (certainty, cost, blockers) with expand/collapse.
 * Tone-based styling: green (no blockers), amber (some blockers), red (new blocker).
 * Item 16: Also shows next fix suggestion with Apply/Why buttons.
 */

import React, { useMemo, useState, useCallback } from "react";
import { ChevronDown, ChevronUp, X, Undo2, Share2, Check, GitCompare, Lightbulb, HelpCircle, Loader2, BellOff } from "lucide-react";
import type { ChangePlannerResponse } from "@shared/schema";
import { openFixBlockersEvent } from "@/lib/uiEvents";
import type { BlockerDeltaUI } from "@/lib/blockerDeltas";
import type { NextFixSuggestion } from "@/lib/nextFix";

interface ChangePlanBannerProps {
  plan: ChangePlannerResponse;
  onDismiss?: () => void;
  autoDismissMs?: number;
  blockerDelta?: BlockerDeltaUI | null;
  canUndo?: boolean;
  onUndo?: () => void;
  isUndoing?: boolean;
  onShare?: (success: boolean) => void; // Callback when share is clicked (for analytics)
  isShared?: boolean; // True when URL already has this plan's ID (shared link opened)
  defaultOpen?: boolean; // Start with details expanded (for shared links)
  onCompare?: () => void; // Callback to open compare plans modal
  canCompare?: boolean; // True when original trip is available for comparison
  compareButtonRef?: React.RefObject<HTMLButtonElement>; // Ref for focus return after modal closes
  // Item 16: Next fix suggestion
  suggestion?: NextFixSuggestion | null;
  onApplySuggestion?: (suggestion: NextFixSuggestion) => void;
  onDismissSuggestion?: (suggestion: NextFixSuggestion) => void;
  onSnoozeSuggestion?: (suggestion: NextFixSuggestion) => void;
  isApplyingFix?: boolean;
}

function ChangePlanBannerComponent({
  plan,
  onDismiss,
  autoDismissMs = 10000,
  blockerDelta,
  canUndo,
  onUndo,
  isUndoing,
  onShare,
  isShared,
  defaultOpen = false,
  onCompare,
  canCompare = false,
  compareButtonRef,
  suggestion,
  onApplySuggestion,
  onDismissSuggestion,
  onSnoozeSuggestion,
  isApplyingFix = false,
}: ChangePlanBannerProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [showSuggestionReason, setShowSuggestionReason] = useState(false);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  // Handle share - copy URL to clipboard with graceful error handling
  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyState('copied');
      onShare?.(true);
      // Reset after 2 seconds
      setTimeout(() => setCopyState('idle'), 2000);
    } catch (err) {
      console.error('[ChangePlanBanner] Clipboard write failed:', err);
      setCopyState('failed');
      onShare?.(false);
      // Reset after 2 seconds
      setTimeout(() => setCopyState('idle'), 2000);
    }
  }, [onShare]);

  // Auto-dismiss after specified time (paused while details are open)
  React.useEffect(() => {
    if (!autoDismissMs || !onDismiss || isOpen) return;
    const timer = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(timer);
  }, [onDismiss, autoDismissMs, isOpen]);

  const tone = plan.uiInstructions?.banner?.tone ?? "green";
  const title = plan.uiInstructions?.banner?.title ?? "Trip updated.";
  const subtitle = plan.uiInstructions?.banner?.subtitle;

  const toneClasses = useMemo(() => {
    if (tone === "red") return "bg-red-500/10 border-red-500/20 text-red-200";
    if (tone === "amber") return "bg-amber-500/10 border-amber-500/20 text-amber-200";
    return "bg-emerald-500/10 border-emerald-500/20 text-emerald-200";
  }, [tone]);

  const iconColor = useMemo(() => {
    if (tone === "red") return "text-red-400";
    if (tone === "amber") return "text-amber-400";
    return "text-emerald-400";
  }, [tone]);

  const details = plan.deltaSummary;

  // Format currency
  const formatCost = (value: number) => {
    if (!value) return "$0";
    return `$${value.toLocaleString()}`;
  };

  // Format delta with sign
  const formatDelta = (value: number) => {
    if (value === 0) return "$0";
    const sign = value > 0 ? "+" : "";
    return `${sign}$${value.toLocaleString()}`;
  };

  return (
    <div className={`border rounded-xl px-4 py-3 mb-4 ${toneClasses}`}>
      <div className="flex items-start justify-between gap-3">
        {/* Title and subtitle */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{title}</span>
            {isShared && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/15 text-white/70 font-medium">
                Shared
              </span>
            )}
          </div>
          {subtitle && <div className="text-xs opacity-80 mt-0.5">{subtitle}</div>}

          {/* Item 16: Next fix suggestion */}
          {suggestion && !suggestionDismissed && (
            <div className="mt-2 pt-2 border-t border-white/10">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white/90 font-medium">
                    {suggestion.title}
                  </div>
                  {/* Impact chips */}
                  {(suggestion.impact.certaintyPoints || suggestion.impact.costDelta || suggestion.impact.bufferDays) && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {suggestion.impact.certaintyPoints && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                          +{suggestion.impact.certaintyPoints}% certainty
                        </span>
                      )}
                      {suggestion.impact.costDelta && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          suggestion.impact.costDelta < 0
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-amber-500/15 text-amber-300"
                        }`}>
                          {suggestion.impact.costDelta < 0 ? "-" : "+"}${Math.abs(suggestion.impact.costDelta).toLocaleString()}
                        </span>
                      )}
                      {suggestion.impact.bufferDays && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300">
                          +{suggestion.impact.bufferDays} days
                        </span>
                      )}
                    </div>
                  )}
                  {/* Why? expanded reason */}
                  {showSuggestionReason && (
                    <div className="text-[10px] text-white/60 mt-1.5 leading-relaxed">
                      {suggestion.reason}
                    </div>
                  )}
                  {/* Action buttons */}
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => onApplySuggestion?.(suggestion)}
                      disabled={isApplyingFix}
                      className="text-[11px] px-2.5 py-1 rounded-md bg-primary/80 hover:bg-primary text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                    >
                      {isApplyingFix && <Loader2 className="w-3 h-3 animate-spin" />}
                      {isApplyingFix ? "Applying..." : suggestion.ctaLabel}
                    </button>
                    <button
                      onClick={() => setShowSuggestionReason((v) => !v)}
                      className="text-[11px] px-2 py-1 rounded-md bg-white/10 hover:bg-white/15 text-white/70 transition-colors inline-flex items-center gap-1"
                    >
                      <HelpCircle className="w-3 h-3" />
                      {showSuggestionReason ? "Hide" : "Why?"}
                    </button>
                    {/* Snooze button - hides suggestion until next plan change */}
                    {onSnoozeSuggestion && (
                      <button
                        onClick={() => onSnoozeSuggestion(suggestion)}
                        className="text-[11px] px-1.5 py-1 rounded-md hover:bg-white/10 text-white/40 transition-colors inline-flex items-center gap-1"
                        title="Snooze until next change"
                        aria-label="Snooze suggestion"
                      >
                        <BellOff className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSuggestionDismissed(true);
                        onDismissSuggestion?.(suggestion);
                      }}
                      className="text-[11px] px-1.5 py-1 rounded-md hover:bg-white/10 text-white/40 transition-colors ml-auto"
                      aria-label="Dismiss suggestion"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Details toggle */}
          <button
            onClick={() => setIsOpen((v) => !v)}
            className="text-xs px-2 py-1 rounded-md bg-white/10 hover:bg-white/15 transition-colors"
          >
            <span className="inline-flex items-center gap-1">
              Details
              {isOpen ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </span>
          </button>

          {/* Undo button */}
          {canUndo && onUndo && (
            <button
              onClick={onUndo}
              disabled={isUndoing}
              className="text-xs px-2 py-1 rounded-md bg-white/10 hover:bg-white/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="inline-flex items-center gap-1">
                <Undo2 className={`w-3.5 h-3.5 ${isUndoing ? 'animate-spin' : ''}`} />
                {isUndoing ? 'Undoing...' : 'Undo'}
              </span>
            </button>
          )}

          {/* Compare button */}
          {canCompare && onCompare && (
            <button
              ref={compareButtonRef}
              type="button"
              onClick={onCompare}
              className="text-xs px-2 py-1 rounded-md bg-white/10 hover:bg-white/15 transition-colors"
              title="Compare original vs updated plan"
            >
              <span className="inline-flex items-center gap-1">
                <GitCompare className="w-3.5 h-3.5" />
                Compare
              </span>
            </button>
          )}

          {/* Share button */}
          <button
            onClick={handleShare}
            className="text-xs px-2 py-1 rounded-md bg-white/10 hover:bg-white/15 transition-colors"
            title="Copy link to this change"
          >
            <span className="inline-flex items-center gap-1">
              {copyState === 'copied' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : copyState === 'failed' ? (
                <>
                  <Share2 className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-red-400">Failed</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share</span>
                </>
              )}
            </span>
          </button>

          {/* Dismiss button */}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 rounded-md bg-white/10 hover:bg-white/15 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {isOpen && details && (
        <div className="mt-3 pt-3 border-t border-white/10 text-xs text-white/70 space-y-2">
          {/* Certainty delta */}
          <div className="flex items-center justify-between">
            <span>Certainty</span>
            <span className="text-white/90">
              {details.certainty.before} → {details.certainty.after}
              {details.certainty.before !== details.certainty.after && (
                <span className={details.certainty.after > details.certainty.before ? "text-emerald-400 ml-1" : "text-amber-400 ml-1"}>
                  ({details.certainty.after > details.certainty.before ? "+" : ""}{details.certainty.after - details.certainty.before})
                </span>
              )}
            </span>
          </div>
          {details.certainty.reason && (
            <div className="text-white/50 text-[10px] -mt-1 pl-2">
              {details.certainty.reason}
            </div>
          )}

          {/* Cost delta */}
          <div className="flex items-center justify-between">
            <span>Estimated Cost</span>
            <span className="text-white/90">
              {formatCost(details.totalCost.before)} → {formatCost(details.totalCost.after)}
              {details.totalCost.delta !== 0 && (
                <span className={details.totalCost.delta < 0 ? "text-emerald-400 ml-1" : "text-amber-400 ml-1"}>
                  ({formatDelta(details.totalCost.delta)})
                </span>
              )}
            </span>
          </div>

          {/* Blockers delta */}
          <div className="flex items-center justify-between">
            <span>Blockers</span>
            <span className="text-white/90">
              {details.blockers.before} → {details.blockers.after}
              {details.blockers.before !== details.blockers.after && (
                <span className={details.blockers.after < details.blockers.before ? "text-emerald-400 ml-1" : "text-red-400 ml-1"}>
                  ({details.blockers.after < details.blockers.before ? "-" : "+"}{Math.abs(details.blockers.after - details.blockers.before)})
                </span>
              )}
            </span>
          </div>

          {/* Blocker delta chips - show when we have delta data */}
          {blockerDelta && (blockerDelta.resolved.length > 0 || blockerDelta.added.length > 0) && (
            <div className="flex flex-wrap gap-2 mt-1">
              {blockerDelta.resolved.length > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-200">
                  Resolved: {blockerDelta.resolved.length}
                </span>
              )}
              {blockerDelta.added.length > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/25 text-red-200">
                  New: {blockerDelta.added.length}
                </span>
              )}
            </div>
          )}

          {/* Resolved blockers list */}
          {blockerDelta && blockerDelta.resolved.length > 0 && (
            <div className="text-emerald-400/80 text-[10px] pl-2">
              {blockerDelta.resolved.map((item, i) => (
                <div key={`resolved-${item}-${i}`}>✓ {item}</div>
              ))}
            </div>
          )}

          {/* New blockers list */}
          {blockerDelta && blockerDelta.added.length > 0 && (
            <div className="text-red-400/80 text-[10px] pl-2">
              {blockerDelta.added.map((item, i) => (
                <div key={`added-${item}-${i}`}>• {item}</div>
              ))}
            </div>
          )}

          {/* Fallback: Resolved blockers from plan (when no delta) */}
          {!blockerDelta && details.blockers.resolved.length > 0 && (
            <div className="text-emerald-400/80 text-[10px] pl-2">
              Resolved: {details.blockers.resolved.join(", ")}
            </div>
          )}

          {/* Fallback: New blockers from plan (when no delta) */}
          {!blockerDelta && details.blockers.new.length > 0 && (
            <div className="text-red-400/80 text-[10px] pl-2">
              New: {details.blockers.new.join(", ")}
            </div>
          )}

          {/* Fix blockers link - show when blockers remain */}
          {details.blockers.after > 0 && (
            <button
              onClick={() => openFixBlockersEvent.emit({ source: "change_banner", reason: "visa_timing" })}
              className="text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2 mt-1"
            >
              Fix blockers
            </button>
          )}

          {/* Itinerary changes */}
          {details.itinerary.dayCountBefore !== details.itinerary.dayCountAfter && (
            <div className="flex items-center justify-between">
              <span>Days</span>
              <span className="text-white/90">
                {details.itinerary.dayCountBefore} → {details.itinerary.dayCountAfter}
              </span>
            </div>
          )}

          {/* Major diffs */}
          {details.itinerary.majorDiffs.length > 0 && (
            <div className="text-white/50 text-[10px] pl-2">
              {details.itinerary.majorDiffs.map((diff, i) => (
                <div key={i}>• {diff}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Memoize to prevent unnecessary rerenders
export const ChangePlanBanner = React.memo(ChangePlanBannerComponent);
