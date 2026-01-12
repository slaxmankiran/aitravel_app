/**
 * ComparePlansModal.tsx
 *
 * Item 15: Compare Plans MVP
 * Side-by-side comparison of original vs updated trip plans.
 *
 * Sections:
 * 1. Certainty & Visa Timeline
 * 2. Total Cost Breakdown
 * 3. Key Itinerary Changes
 * 4. Recommendation + Decision CTA
 */

import React, { useMemo, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { X, ArrowUp, ArrowDown, Minus, CheckCircle2, AlertTriangle, Shield, Sparkles, AlertCircle, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { TripResponse } from "@shared/schema";
import { comparePlans, type PlanComparison, type CostDelta } from "@/lib/comparePlans";
import { cn } from "@/lib/utils";

// ============================================================================
// PROPS
// ============================================================================

interface ComparePlansModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalTrip: TripResponse;
  updatedTrip: TripResponse;
  onKeepUpdated: () => void;
  onKeepOriginal: () => void;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function DeltaArrow({ direction, size = "sm" }: { direction: "up" | "down" | "same" | "unavailable"; size?: "sm" | "md" }) {
  const sizeClass = size === "md" ? "w-4 h-4" : "w-3 h-3";
  if (direction === "up") return <ArrowUp className={cn(sizeClass, "text-amber-400")} />;
  if (direction === "down") return <ArrowDown className={cn(sizeClass, "text-emerald-400")} />;
  if (direction === "unavailable") return <Minus className={cn(sizeClass, "text-white/20")} />;
  return <Minus className={cn(sizeClass, "text-white/40")} />;
}

function CertaintyDeltaArrow({ direction }: { direction: "improved" | "worsened" | "same" | "unavailable" }) {
  if (direction === "improved") return <ArrowUp className="w-4 h-4 text-emerald-400" />;
  if (direction === "worsened") return <ArrowDown className="w-4 h-4 text-red-400" />;
  if (direction === "unavailable") return <Minus className="w-4 h-4 text-white/20" />;
  return <Minus className="w-4 h-4 text-white/40" />;
}

function VisaRiskBadge({ risk }: { risk: string }) {
  const styles = {
    low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    high: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border", styles[risk as keyof typeof styles] || styles.medium)}>
      {risk.charAt(0).toUpperCase() + risk.slice(1)} Risk
    </span>
  );
}

/**
 * Generate a one-liner summary for the modal header
 */
function generateSummaryLine(
  certaintyDelta: PlanComparison["certaintyDelta"],
  totalCostDelta: PlanComparison["totalCostDelta"],
  recommendation: PlanComparison["recommendation"],
  currencySymbol: string
): string {
  const parts: string[] = [];

  // Certainty change (only if data available)
  if (certaintyDelta.delta !== null && certaintyDelta.delta !== 0) {
    const dir = certaintyDelta.delta > 0 ? "improves" : "reduces";
    parts.push(`${dir} certainty by ${certaintyDelta.delta > 0 ? "+" : ""}${certaintyDelta.delta}%`);
  }

  // Cost change (only if data available)
  if (totalCostDelta.delta !== null && totalCostDelta.delta !== 0) {
    const dir = totalCostDelta.delta > 0 ? "costs" : "saves";
    parts.push(`${dir} ${currencySymbol}${Math.abs(totalCostDelta.delta).toLocaleString()}`);
  }

  // Note missing data
  const missingParts: string[] = [];
  if (certaintyDelta.delta === null) missingParts.push("certainty");
  if (totalCostDelta.delta === null) missingParts.push("cost");

  // Build sentence
  let summary = parts.length > 0
    ? `Updated plan ${parts.join(" but ")}.`
    : missingParts.length > 0
      ? `Limited comparison available (${missingParts.join(" and ")} data unavailable).`
      : "No significant changes between plans.";

  // Add recommendation
  if (recommendation.preferred !== "neutral") {
    const planName = recommendation.preferred === "B" ? "Updated" : "Original";
    summary += ` Recommended: ${planName} (${recommendation.confidence} confidence).`;
  }

  return summary;
}

/**
 * Format money value - shows "Unavailable" for null
 */
function formatMoney(value: number | null, currencySymbol: string): string {
  if (value === null) return "Unavailable";
  return `${currencySymbol}${value.toLocaleString()}`;
}

function CostRow({ delta, currencySymbol = "$" }: { delta: CostDelta; currencySymbol?: string }) {
  // Skip if both values are null or zero
  if ((delta.before === null || delta.before === 0) && (delta.after === null || delta.after === 0)) {
    return null;
  }

  const beforeUnavailable = delta.before === null;
  const afterUnavailable = delta.after === null;

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
      <span className="text-white/70 text-sm">{delta.category}</span>
      <div className="flex items-center gap-3">
        <span className={cn("text-sm tabular-nums", beforeUnavailable ? "text-white/30 italic" : "text-white/50")}>
          {formatMoney(delta.before, currencySymbol)}
        </span>
        <span className="text-white/30">→</span>
        <span className={cn("text-sm tabular-nums font-medium", afterUnavailable ? "text-white/30 italic" : "text-white")}>
          {formatMoney(delta.after, currencySymbol)}
        </span>
        {delta.delta !== null && delta.delta !== 0 && (
          <span className={cn(
            "text-xs tabular-nums flex items-center gap-0.5",
            delta.direction === "down" ? "text-emerald-400" : "text-amber-400"
          )}>
            <DeltaArrow direction={delta.direction} />
            {currencySymbol}{Math.abs(delta.delta).toLocaleString()}
          </span>
        )}
        {delta.direction === "unavailable" && (
          <span className="text-xs text-white/30 italic">N/A</span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ComparePlansModal({
  isOpen,
  onClose,
  originalTrip,
  updatedTrip,
  onKeepUpdated,
  onKeepOriginal,
}: ComparePlansModalProps) {
  const [, setLocation] = useLocation();

  // Refs for focus trap
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Handler for exporting comparison as PDF
  const handleExportComparison = useCallback(() => {
    // Store both trips in sessionStorage for the export page
    sessionStorage.setItem("compareExport_planA", JSON.stringify(originalTrip));
    sessionStorage.setItem("compareExport_planB", JSON.stringify(updatedTrip));

    // Navigate to compare export page
    const tripId = updatedTrip.id;
    setLocation(`/trips/${tripId}/export/compare`);
    onClose();
  }, [originalTrip, updatedTrip, setLocation, onClose]);

  // Generate comparison (only when open to avoid wasted computation)
  const comparison = useMemo(() => {
    if (!isOpen) return null;
    return comparePlans(originalTrip, updatedTrip);
  }, [originalTrip, updatedTrip, isOpen]);

  // Key handler: ESC to close, Tab wrap for focus trap
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }

    // Minimal focus trap: wrap Tab key within modal
    if (e.key === "Tab" && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length === 0) return;

      const firstEl = focusableElements[0];
      const lastEl = focusableElements[focusableElements.length - 1];
      const activeEl = document.activeElement;

      // Shift+Tab on first element → wrap to last
      if (e.shiftKey && activeEl === firstEl) {
        e.preventDefault();
        lastEl.focus();
      }
      // Tab on last element → wrap to first
      else if (!e.shiftKey && activeEl === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
      // Focus the close button on open for accessibility
      requestAnimationFrame(() => closeButtonRef.current?.focus());
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  // Early return if not open or no comparison
  if (!isOpen || !comparison) {
    return null;
  }

  const { isComparable, incomparableReason, certaintyDelta, costDeltas, totalCostDelta, itineraryChanges, recommendation } = comparison;

  // Currency symbol from trip
  const currencySymbol = (updatedTrip.itinerary as any)?.costBreakdown?.currencySymbol || "$";

  // Generate summary one-liner
  const summaryLine = isComparable
    ? generateSummaryLine(certaintyDelta, totalCostDelta, recommendation, currencySymbol)
    : incomparableReason;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal - centered vertically and horizontally */}
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-3xl max-h-[80vh] bg-slate-900 border border-white/10 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="compare-plans-title"
            aria-describedby="compare-plans-summary"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
              <div>
                <h2 id="compare-plans-title" className="text-lg font-semibold text-white">Compare Plans</h2>
                <p className="text-sm text-white/50 mt-0.5">
                  {originalTrip.destination} • {updatedTrip.dates}
                </p>
              </div>
              <button
                ref={closeButtonRef}
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>

            {/* Summary one-liner */}
            <div
              id="compare-plans-summary"
              className={cn(
                "px-5 py-3 text-sm border-b",
                !isComparable
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-200"
                  : recommendation.preferred === "B"
                    ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-200"
                    : recommendation.preferred === "A"
                      ? "bg-amber-500/5 border-amber-500/10 text-amber-200"
                      : "bg-white/5 border-white/10 text-white/70"
              )}
            >
              {!isComparable && <AlertCircle className="w-4 h-4 inline mr-2" />}
              {summaryLine}
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
              {/* Not comparable warning */}
              {!isComparable && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
                  <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                  <p className="text-amber-200 font-medium">Plans Cannot Be Compared</p>
                  <p className="text-amber-200/70 text-sm mt-1">{incomparableReason}</p>
                  <p className="text-white/50 text-xs mt-3">
                    Comparison works best when destination, passport, and traveler count remain the same.
                  </p>
                </div>
              )}

              {/* Section 1: Certainty & Visa Timeline */}
              {isComparable && <section>
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Certainty & Visa</h3>
                </div>

                <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                  {/* Certainty Score Row */}
                  <div className="grid grid-cols-3 gap-4 p-4 border-b border-white/10">
                    <div className="text-white/60 text-sm">Certainty Score</div>
                    <div className="text-center">
                      {certaintyDelta.scoreBefore !== null ? (
                        <span className="text-2xl font-bold text-white/50">{certaintyDelta.scoreBefore}%</span>
                      ) : (
                        <span className="text-lg text-white/30 italic">Unavailable</span>
                      )}
                      <div className="text-xs text-white/40 mt-0.5">Original</div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {certaintyDelta.scoreAfter !== null ? (
                          <span className="text-2xl font-bold text-white">{certaintyDelta.scoreAfter}%</span>
                        ) : (
                          <span className="text-lg text-white/30 italic">Unavailable</span>
                        )}
                        {/* Only show arrow when there's an actual change */}
                        {certaintyDelta.direction !== "same" && certaintyDelta.direction !== "unavailable" && (
                          <CertaintyDeltaArrow direction={certaintyDelta.direction} />
                        )}
                      </div>
                      <div className="text-xs text-white/40 mt-0.5">
                        Updated
                        {certaintyDelta.delta !== null && certaintyDelta.delta !== 0 && (
                          <span className={cn(
                            "ml-1",
                            certaintyDelta.direction === "improved" ? "text-emerald-400" : "text-red-400"
                          )}>
                            ({certaintyDelta.delta > 0 ? "+" : ""}{certaintyDelta.delta})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Visa Risk Row */}
                  <div className="grid grid-cols-3 gap-4 p-4 border-b border-white/10">
                    <div className="text-white/60 text-sm">Visa Risk</div>
                    <div className="text-center">
                      <VisaRiskBadge risk={certaintyDelta.visaRiskBefore} />
                    </div>
                    <div className="text-center">
                      <VisaRiskBadge risk={certaintyDelta.visaRiskAfter} />
                    </div>
                  </div>

                  {/* Buffer Days Row */}
                  <div className="grid grid-cols-3 gap-4 p-4">
                    <div className="text-white/60 text-sm">Buffer Days</div>
                    <div className="text-center">
                      <span className="text-lg font-semibold text-white/50">{certaintyDelta.bufferDaysBefore}</span>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-lg font-semibold text-white">{certaintyDelta.bufferDaysAfter}</span>
                        {certaintyDelta.bufferDelta !== 0 && (
                          <span className={cn(
                            "text-xs",
                            certaintyDelta.bufferDelta > 0 ? "text-emerald-400" : "text-amber-400"
                          )}>
                            ({certaintyDelta.bufferDelta > 0 ? "+" : ""}{certaintyDelta.bufferDelta})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>}

              {/* Section 2: Cost Breakdown - only show when cost data is available */}
              {isComparable && totalCostDelta.direction !== "unavailable" && <section>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Cost Breakdown</h3>
                </div>

                <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                  {/* Category rows */}
                  <div className="space-y-0">
                    {costDeltas.map((delta) => (
                      <CostRow key={delta.category} delta={delta} currencySymbol={currencySymbol} />
                    ))}
                  </div>

                  {/* Total row */}
                  <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between">
                    <span className="text-white font-semibold">Total</span>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums text-white/50">
                        {formatMoney(totalCostDelta.before, currencySymbol)}
                      </span>
                      <span className="text-white/30">→</span>
                      <span className="font-bold tabular-nums text-lg text-white">
                        {formatMoney(totalCostDelta.after, currencySymbol)}
                      </span>
                      {totalCostDelta.delta !== null && totalCostDelta.delta !== 0 && (
                        <span className={cn(
                          "text-sm tabular-nums flex items-center gap-1 px-2 py-0.5 rounded-full",
                          totalCostDelta.direction === "down"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-amber-500/20 text-amber-400"
                        )}>
                          <DeltaArrow direction={totalCostDelta.direction} size="md" />
                          {currencySymbol}{Math.abs(totalCostDelta.delta).toLocaleString()}
                          {totalCostDelta.percentChange !== null && (
                            <span className="text-xs opacity-70">({totalCostDelta.percentChange > 0 ? "+" : ""}{totalCostDelta.percentChange}%)</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </section>}

              {/* Section 3: Itinerary Changes */}
              {isComparable && <section>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Itinerary Changes</h3>
                </div>

                <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                  {/* Day count */}
                  {itineraryChanges.dayCountBefore !== itineraryChanges.dayCountAfter && (
                    <div className="flex items-center justify-between py-2 border-b border-white/10">
                      <span className="text-white/70 text-sm">Trip Duration</span>
                      <span className="text-white">
                        {itineraryChanges.dayCountBefore} → {itineraryChanges.dayCountAfter} days
                        <span className={cn(
                          "ml-2 text-xs",
                          itineraryChanges.dayCountAfter > itineraryChanges.dayCountBefore ? "text-emerald-400" : "text-amber-400"
                        )}>
                          ({itineraryChanges.dayCountAfter > itineraryChanges.dayCountBefore ? "+" : ""}{itineraryChanges.dayCountAfter - itineraryChanges.dayCountBefore})
                        </span>
                      </span>
                    </div>
                  )}

                  {/* Added highlights */}
                  {itineraryChanges.addedHighlights.length > 0 && (
                    <div className="py-2 border-b border-white/10">
                      <div className="text-white/70 text-sm mb-2">Added Experiences</div>
                      <div className="flex flex-wrap gap-2">
                        {itineraryChanges.addedHighlights.slice(0, 5).map((h, i) => (
                          <span key={i} className="px-2 py-1 rounded-full text-xs bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                            + {h}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Removed highlights */}
                  {itineraryChanges.removedHighlights.length > 0 && (
                    <div className="py-2">
                      <div className="text-white/70 text-sm mb-2">Removed Experiences</div>
                      <div className="flex flex-wrap gap-2">
                        {itineraryChanges.removedHighlights.slice(0, 5).map((h, i) => (
                          <span key={i} className="px-2 py-1 rounded-full text-xs bg-red-500/15 text-red-300 border border-red-500/25">
                            − {h}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No changes fallback */}
                  {itineraryChanges.dayCountBefore === itineraryChanges.dayCountAfter &&
                   itineraryChanges.addedHighlights.length === 0 &&
                   itineraryChanges.removedHighlights.length === 0 && (
                    <div className="text-center py-4 text-white/50 text-sm">
                      No significant itinerary changes detected.
                    </div>
                  )}
                </div>
              </section>}

              {/* Section 4: Recommendation */}
              {isComparable && <section>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Recommendation</h3>
                </div>

                <div className={cn(
                  "rounded-xl border p-4",
                  recommendation.preferred === "B"
                    ? "bg-emerald-500/10 border-emerald-500/20"
                    : recommendation.preferred === "A"
                      ? "bg-amber-500/10 border-amber-500/20"
                      : "bg-white/5 border-white/10"
                )}>
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                      recommendation.preferred === "B"
                        ? "bg-emerald-500/20"
                        : recommendation.preferred === "A"
                          ? "bg-amber-500/20"
                          : "bg-white/10"
                    )}>
                      {recommendation.preferred === "B" ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : recommendation.preferred === "A" ? (
                        <CheckCircle2 className="w-5 h-5 text-amber-400" />
                      ) : (
                        <Minus className="w-5 h-5 text-white/50" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-white mb-1">
                        {recommendation.preferred === "B"
                          ? "Updated Plan Recommended"
                          : recommendation.preferred === "A"
                            ? "Original Plan Recommended"
                            : "Plans Are Comparable"}
                      </div>
                      <p className="text-sm text-white/70 mb-2">{recommendation.reason}</p>
                      <p className="text-xs text-white/50">{recommendation.tradeoffSummary}</p>
                      {recommendation.confidence !== "low" && (
                        <span className={cn(
                          "inline-block mt-2 px-2 py-0.5 rounded text-xs",
                          recommendation.confidence === "high"
                            ? "bg-white/10 text-white/70"
                            : "bg-white/5 text-white/50"
                        )}>
                          {recommendation.confidence === "high" ? "High" : "Medium"} confidence
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </section>}
            </div>

            {/* Footer - Sticky decision CTA */}
            <div className="shrink-0 px-5 py-4 border-t border-white/10 bg-slate-900/95 backdrop-blur-sm">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={onKeepUpdated}
                  className={cn(
                    "flex-1 px-4 py-3 rounded-xl font-semibold text-sm transition-all",
                    recommendation.preferred === "B"
                      ? "bg-primary text-white hover:bg-primary/90"
                      : "bg-white/10 text-white hover:bg-white/15"
                  )}
                >
                  Keep Updated Plan
                </button>
                <button
                  onClick={onKeepOriginal}
                  className={cn(
                    "flex-1 px-4 py-3 rounded-xl font-semibold text-sm transition-all",
                    recommendation.preferred === "A"
                      ? "bg-primary text-white hover:bg-primary/90"
                      : "bg-white/10 text-white hover:bg-white/15"
                  )}
                >
                  Keep Original
                </button>
                {/* Export Comparison button */}
                <button
                  onClick={handleExportComparison}
                  className="px-4 py-3 rounded-xl font-semibold text-sm transition-all bg-white/5 text-white/70 hover:bg-white/10 hover:text-white flex items-center justify-center gap-2"
                  title="Export comparison as PDF"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Export</span>
                </button>
              </div>
              {recommendation.preferred !== "neutral" && (
                <p className="text-center text-xs text-white/40 mt-2">
                  {recommendation.preferred === "B" ? "Updated" : "Original"} plan is highlighted based on your trip priorities.
                </p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default ComparePlansModal;
