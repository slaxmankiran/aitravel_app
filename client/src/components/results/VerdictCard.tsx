/**
 * VerdictCard.tsx
 *
 * Phase 1 component: The primary verdict display.
 * Shows GO / POSSIBLE / DIFFICULT with reasons.
 *
 * Uses computeVerdict() as single source of truth.
 * Reuses styling patterns from CertaintyBar.
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Shield,
  Clock,
  DollarSign,
  AlertOctagon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VerdictResult, OverrideId } from "@/lib/verdict";
import { getVerdictDisplay } from "@/lib/verdict";

interface VerdictCardProps {
  verdictResult: VerdictResult;
  className?: string;
  /** If true, show compact inline version */
  compact?: boolean;
  /** Callback when user wants more details */
  onShowDetails?: () => void;
}

// Map override IDs to icons
function getOverrideIcon(id: OverrideId) {
  switch (id) {
    case 'VISA_TIMING_BLOCKER':
    case 'VISA_HIGH_RISK':
    case 'UNDER_7_DAYS_VISA_REQUIRED':
      return Clock;
    case 'OVER_BUDGET_20':
    case 'OVER_BUDGET_50':
      return DollarSign;
    case 'SAFETY_L3_PLUS':
      return AlertOctagon;
    default:
      return AlertTriangle;
  }
}

// Get verdict icon component
function getVerdictIcon(verdict: VerdictResult['verdict']) {
  switch (verdict) {
    case 'GO':
      return CheckCircle2;
    case 'POSSIBLE':
      return AlertTriangle;
    case 'DIFFICULT':
      return XCircle;
  }
}

function VerdictCardComponent({
  verdictResult,
  className = '',
  compact = false,
  onShowDetails,
}: VerdictCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const display = getVerdictDisplay(verdictResult.verdict);
  const VerdictIcon = getVerdictIcon(verdictResult.verdict);

  // Separate positive and negative reasons
  const positiveReasons = verdictResult.reasons.filter(r =>
    r.includes('passed') ||
    r.includes('Visa-free') ||
    r.includes('remaining') ||
    r.includes('Sufficient')
  );
  const negativeReasons = verdictResult.reasons.filter(r =>
    !positiveReasons.includes(r)
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPACT VERSION (for inline use in headers)
  // ═══════════════════════════════════════════════════════════════════════════

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${display.bgClass} ${display.borderClass} ${className}`}
      >
        <VerdictIcon className={`w-4 h-4 ${display.textClass}`} />
        <span className={`text-sm font-semibold ${display.textClass}`}>
          {verdictResult.verdict}
        </span>
        <span className="text-xs text-white/50">
          {verdictResult.score}%
        </span>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FULL VERSION
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className={`rounded-xl border ${display.borderClass} ${display.bgClass} overflow-hidden ${className}`}>
      {/* Main verdict section */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Verdict badge + headline */}
          <div className="flex items-start gap-4">
            {/* Large verdict icon */}
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${display.bgClass} border-2 ${display.borderClass}`}>
              <VerdictIcon className={`w-7 h-7 ${display.textClass}`} />
            </div>

            {/* Text content */}
            <div>
              {/* Verdict label */}
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-2xl font-bold ${display.textClass}`}>
                  {verdictResult.verdict}
                </span>
                <span className="text-sm text-white/40">
                  •
                </span>
                <span className="text-sm text-white/60">
                  {verdictResult.score}% certainty
                </span>
              </div>

              {/* Headline */}
              <p className="text-white font-medium">
                {display.headline}
              </p>

              {/* Subtext */}
              <p className="text-sm text-white/50 mt-0.5">
                {display.subtext}
              </p>
            </div>
          </div>

          {/* Right: Score circle */}
          <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 ${display.borderClass} ${display.bgClass}`}>
            <span className={`text-2xl font-bold ${display.textClass}`}>
              {verdictResult.score}
            </span>
          </div>
        </div>

        {/* Key reasons (always visible) */}
        <div className="mt-4 space-y-2">
          {/* Show first 3 reasons inline */}
          {verdictResult.reasons.slice(0, 3).map((reason, i) => {
            const isPositive = positiveReasons.includes(reason);
            return (
              <div
                key={i}
                className="flex items-start gap-2 text-sm"
              >
                {isPositive ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                )}
                <span className="text-white/70">{reason}</span>
              </div>
            );
          })}
        </div>

        {/* Expand button (if more than 3 reasons or has overrides) */}
        {(verdictResult.reasons.length > 3 || verdictResult.overridesApplied.length > 0) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-3 text-white/50 hover:text-white hover:bg-white/10 h-8 px-3"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4 mr-1" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-1" />
                Show all factors
              </>
            )}
          </Button>
        )}
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-white/10"
          >
            <div className="p-5 bg-black/20 space-y-4">
              {/* All reasons */}
              {verdictResult.reasons.length > 3 && (
                <div>
                  <h4 className="text-xs text-white/40 uppercase tracking-wider mb-2">
                    All Factors
                  </h4>
                  <div className="space-y-2">
                    {verdictResult.reasons.slice(3).map((reason, i) => {
                      const isPositive = positiveReasons.includes(reason);
                      return (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          {isPositive ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                          )}
                          <span className="text-white/70">{reason}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Override rules applied */}
              {verdictResult.overridesApplied.length > 0 && (
                <div>
                  <h4 className="text-xs text-white/40 uppercase tracking-wider mb-2">
                    Rules Applied
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {verdictResult.overridesApplied.map((override) => {
                      const Icon = getOverrideIcon(override);
                      return (
                        <span
                          key={override}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-white/5 text-white/60 border border-white/10"
                        >
                          <Icon className="w-3 h-3" />
                          {override.replace(/_/g, ' ')}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Risk flags summary */}
              <div>
                <h4 className="text-xs text-white/40 uppercase tracking-wider mb-2">
                  Risk Assessment
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <RiskFlag
                    label="Visa Timing"
                    isRisk={verdictResult.riskFlags.visaTimingBlocker}
                  />
                  <RiskFlag
                    label="Visa Risk"
                    isRisk={verdictResult.riskFlags.visaHighRisk}
                  />
                  <RiskFlag
                    label="Safety"
                    isRisk={verdictResult.riskFlags.safetyL3Plus}
                  />
                  <RiskFlag
                    label="Budget (>20%)"
                    isRisk={verdictResult.riskFlags.overBudget20}
                  />
                  <RiskFlag
                    label="Budget (>50%)"
                    isRisk={verdictResult.riskFlags.overBudget50}
                  />
                  <RiskFlag
                    label="Timeline"
                    isRisk={verdictResult.riskFlags.under7DaysVisaRequired}
                  />
                </div>
              </div>

              {/* Budget details */}
              {verdictResult.budgetDelta !== 0 && (
                <div className="pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/50">Budget Status</span>
                    <span className={verdictResult.budgetDelta > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                      {verdictResult.budgetDelta > 0
                        ? `$${Math.abs(verdictResult.budgetDelta).toLocaleString()} over`
                        : `$${Math.abs(verdictResult.budgetDelta).toLocaleString()} remaining`
                      }
                    </span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Optional: Show details CTA */}
      {onShowDetails && (
        <button
          onClick={onShowDetails}
          className="w-full py-3 text-sm text-center text-white/50 hover:text-white hover:bg-white/5 border-t border-white/10 transition-colors"
        >
          View full certainty breakdown →
        </button>
      )}
    </div>
  );
}

// Helper component for risk flag display
function RiskFlag({ label, isRisk }: { label: string; isRisk: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className={`w-2 h-2 rounded-full ${isRisk ? 'bg-red-500' : 'bg-emerald-500'}`} />
      <span className="text-white/60">{label}</span>
      <span className={isRisk ? 'text-red-400' : 'text-emerald-400'}>
        {isRisk ? 'Risk' : 'OK'}
      </span>
    </div>
  );
}

// Memoize to prevent page-wide rerenders
export const VerdictCard = React.memo(VerdictCardComponent);
