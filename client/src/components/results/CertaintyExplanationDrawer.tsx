/**
 * CertaintyExplanationDrawer.tsx
 *
 * Slide-out drawer showing human-readable explanation of:
 * - Why the certainty score is what it is (current trip)
 * - What changed after a replan (Change Planner delta)
 * - Clear next actions (links to "Fix blockers" when relevant)
 *
 * Uses data from:
 * - trip.feasibilityReport (score, breakdown, visaDetails, summary)
 * - optional ChangePlannerResponse (deltaSummary, detectedChanges, failures)
 */

import { useMemo } from "react";
import { X, Info } from "lucide-react";
import type { TripResponse, ChangePlannerResponse } from "@shared/schema";
import { buildCertaintyExplanation } from "@/lib/certaintyExplain";
import { hasVisaBlocker, needsVisaTimingFix } from "@/lib/actionItems";
import { openFixBlockersEvent } from "@/lib/uiEvents";

function severityDot(sev?: "good" | "warn" | "bad") {
  if (sev === "good") return "bg-emerald-400/80";
  if (sev === "bad") return "bg-red-400/80";
  return "bg-amber-400/80";
}

interface CertaintyExplanationDrawerProps {
  open: boolean;
  onClose: () => void;
  trip: TripResponse;
  changePlan?: ChangePlannerResponse | null;
}

export function CertaintyExplanationDrawer({
  open,
  onClose,
  trip,
  changePlan,
}: CertaintyExplanationDrawerProps) {
  const model = useMemo(
    () => buildCertaintyExplanation(trip, changePlan),
    [trip, changePlan]
  );

  // Determine if Fix Blockers button should be shown
  const showFixBlockers = useMemo(() => {
    const feasibility = trip.feasibilityReport as any;
    return hasVisaBlocker(feasibility) || needsVisaTimingFix(feasibility);
  }, [trip.feasibilityReport]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel - slides in from right */}
      <div className="absolute right-0 top-0 h-full w-full sm:w-[520px] bg-slate-950 border-l border-white/10 shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                <Info className="w-4 h-4 text-white/70" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white/90">
                  Certainty score
                </div>
                <div className="text-xs text-white/50">
                  {model.deltaLine ? model.deltaLine : `Current score: ${model.score}`}
                </div>
              </div>
            </div>
            <div className="mt-2 text-sm text-white/80">{model.headline}</div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-white/70" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto h-[calc(100%-64px)]">
          {model.sections.map((sec) => (
            <div
              key={sec.title}
              className="rounded-xl border border-white/10 bg-white/5"
            >
              <div className="px-3 py-2 border-b border-white/10 text-xs font-semibold text-white/70">
                {sec.title}
              </div>
              <div className="p-3 space-y-2">
                {sec.items.length === 0 ? (
                  <div className="text-xs text-white/50">No details available.</div>
                ) : (
                  sec.items.map((it, idx) => (
                    <div key={`${it.title}-${idx}`} className="flex gap-2">
                      <div
                        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${severityDot(it.severity)}`}
                      />
                      <div className="min-w-0">
                        <div className="text-xs text-white/85">{it.title}</div>
                        {it.detail && (
                          <div className="text-[11px] text-white/50 mt-0.5 leading-relaxed">
                            {it.detail}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}

          {/* Fix Blockers CTA */}
          {showFixBlockers && (
            <button
              onClick={() => {
                onClose();
                openFixBlockersEvent.emit({
                  source: "certainty_drawer",
                  reason: "visa_timing",
                });
              }}
              className="w-full mt-1 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-200 text-sm hover:bg-amber-500/20 transition-colors"
            >
              Fix blockers
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
