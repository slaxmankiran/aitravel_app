/**
 * FixBlockersController.tsx
 *
 * Always-mounted controller that manages the Fix Blockers modal.
 * Listens to openFixBlockersEvent and renders the modal when triggered.
 *
 * This separation allows the modal to open from anywhere (Certainty drawer,
 * ChangePlanBanner, ActionItems) without prop drilling.
 *
 * The CTA buttons just emit events; this controller handles the actual modal.
 */

import { useState, useCallback, useEffect } from "react";
import { Loader2, AlertTriangle, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChangePlanner } from "@/hooks/useChangePlanner";
import {
  tripToUserTripInput,
  mergeUserTripInput,
} from "@/lib/tripInput";
import { getVisaTimingDetails } from "@/lib/actionItems";
import { trackTripEvent } from "@/lib/analytics";
import { openFixBlockersEvent, type OpenFixBlockersPayload } from "@/lib/uiEvents";
import type { TripResponse, FixOption, FeasibilityReport, ChangePlannerResponse, UserTripInput } from "@shared/schema";

interface UndoContextParams {
  changeId: string;
  prevInput: UserTripInput;
  nextInput: UserTripInput;
  source: "edit_trip" | "quick_chip" | "fix_blocker";
}

interface CertaintyPointParams {
  id: string;
  score: number;
  at: string;
  label: string;
  source?: "edit_trip" | "fix_blocker" | "undo" | "initial";
}

interface FixBlockersControllerProps {
  trip: TripResponse;
  setWorkingTrip: (updater: (prev: TripResponse | null) => TripResponse | null) => void;
  setBannerPlan?: (plan: ChangePlannerResponse | null) => void;
  onFixApplied?: () => void;
  onSetUndoCtx?: (ctx: UndoContextParams) => void;
  onAddCertaintyPoint?: (point: CertaintyPointParams) => void;
}

export function FixBlockersController({
  trip,
  setWorkingTrip,
  setBannerPlan,
  onFixApplied,
  onSetUndoCtx,
  onAddCertaintyPoint,
}: FixBlockersControllerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<FixOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [applyingIndex, setApplyingIndex] = useState<number | null>(null);
  const [lastSource, setLastSource] = useState<OpenFixBlockersPayload["source"]>("other");

  const { planChanges, applyChanges } = useChangePlanner();

  const timingDetails = getVisaTimingDetails(trip.feasibilityReport as FeasibilityReport);

  // Fetch fix options from server
  // Accept trip as argument to avoid stale closures
  const fetchOptions = useCallback(async (tripArg: TripResponse, source: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const currentInput = tripToUserTripInput(tripArg);

      const res = await fetch("/api/fix-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: tripArg.id,
          currentInput,
          feasibilityReport: tripArg.feasibilityReport,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to fetch fix options");
      }

      const data = await res.json();
      setOptions(data.options || []);

      trackTripEvent(tripArg.id, "fix_options_viewed", {
        optionCount: data.options?.length || 0,
        source,
      });
    } catch (err: any) {
      console.error("[FixBlockersController] Error fetching options:", err);
      setError(err.message || "Failed to load options");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Listen for open events
  useEffect(() => {
    return openFixBlockersEvent.on((payload) => {
      // Prevent double-open spam
      if (isModalOpen || isLoading) return;

      setLastSource(payload.source);
      setIsModalOpen(true);
      // Fetch options when modal opens - pass current trip to avoid stale closures
      fetchOptions(trip, payload.source);

      trackTripEvent(trip.id, "fix_blockers_opened", {
        source: payload.source,
        reason: payload.reason,
      });
    });
  }, [trip, fetchOptions, isModalOpen, isLoading]);

  // Apply selected fix option
  const handleApplyOption = useCallback(
    async (option: FixOption, index: number) => {
      setApplyingIndex(index);

      try {
        const prevInput = tripToUserTripInput(trip);
        const nextInput = mergeUserTripInput(prevInput, option.changePatch);

        // Call Change Planner
        const plan = await planChanges({
          tripId: trip.id,
          prevInput,
          nextInput,
          currentResults: trip,
          source: "fix_blocker",
        });

        // Apply changes to update UI
        applyChanges({
          tripId: trip.id,
          plan,
          setWorkingTrip,
          setBannerPlan,
          source: "fix_blocker",
        });

        // Capture undo context for reverting this change
        onSetUndoCtx?.({
          changeId: plan.changeId || `fix-${Date.now()}`,
          prevInput,
          nextInput,
          source: "fix_blocker",
        });

        // Add certainty point to timeline
        const newScore = plan.deltaSummary?.certainty?.after;
        if (typeof newScore === 'number') {
          onAddCertaintyPoint?.({
            id: plan.changeId || `fix-${Date.now()}`,
            score: newScore,
            at: new Date().toISOString(),
            label: option.title || 'Fix applied',
            source: 'fix_blocker',
          });
        }

        trackTripEvent(trip.id, "fix_option_applied", {
          optionTitle: option.title,
          confidence: option.confidence,
          source: lastSource,
        });

        setIsModalOpen(false);
        onFixApplied?.();
      } catch (err: any) {
        console.error("[FixBlockersController] Error applying fix:", err);
        setError(err.message || "Failed to apply fix");
      } finally {
        setApplyingIndex(null);
      }
    },
    [trip, planChanges, applyChanges, setWorkingTrip, setBannerPlan, onFixApplied, onSetUndoCtx, onAddCertaintyPoint, lastSource]
  );

  // Don't render anything if modal is closed
  if (!isModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setIsModalOpen(false)}
      />

      {/* Modal content */}
      <div className="relative bg-slate-800 border border-white/10 rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div>
            <h3 className="text-lg font-semibold text-white">
              Fix blockers
            </h3>
            {timingDetails && (
              <p className="text-xs text-white/60 mt-0.5">
                {timingDetails.recommendation}
              </p>
            )}
          </div>
          <button
            onClick={() => setIsModalOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <span className="ml-2 text-white/60">Loading options...</span>
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-300">{error}</p>
                <button
                  onClick={() => fetchOptions(trip, lastSource)}
                  className="text-xs text-red-400 hover:text-red-300 mt-1"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* No options - show helpful message based on timing */}
          {!isLoading && !error && options.length === 0 && (
            <div className="text-center py-8">
              {timingDetails?.hasEnoughTime ? (
                <>
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Check className="w-6 h-6 text-emerald-400" />
                  </div>
                  <p className="text-white font-medium">No urgent blockers!</p>
                  <p className="text-sm text-white/60 mt-1">
                    You have enough time for visa processing.
                  </p>
                  <p className="text-xs text-white/40 mt-2">
                    {timingDetails.recommendation}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-white/50">No automatic fixes available.</p>
                  <p className="text-xs text-white/40 mt-1">
                    Try editing your trip dates manually.
                  </p>
                </>
              )}
            </div>
          )}

          {/* Options list */}
          {!isLoading && !error && options.length > 0 && (
            <div className="space-y-3">
              {options.map((option, index) => (
                <div
                  key={index}
                  className="p-3 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-white">
                        {option.title}
                      </h4>

                      {/* Expected outcome */}
                      <div className="flex items-center gap-3 mt-2 text-xs text-white/60">
                        <span className="flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-400" />
                          {option.expectedOutcome.blockersAfter === 0
                            ? "No blockers"
                            : `${option.expectedOutcome.blockersAfter} blocker${option.expectedOutcome.blockersAfter !== 1 ? "s" : ""}`}
                        </span>
                        {option.expectedOutcome.costDelta !== 0 && (
                          <span>
                            {option.expectedOutcome.costDelta > 0 ? "+" : ""}
                            ${option.expectedOutcome.costDelta}
                          </span>
                        )}
                      </div>

                      {/* Confidence badge */}
                      <div className="mt-2">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            option.confidence === "high"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : option.confidence === "medium"
                                ? "bg-amber-500/20 text-amber-400"
                                : "bg-slate-500/20 text-slate-400"
                          }`}
                        >
                          {option.confidence} confidence
                        </span>
                      </div>
                    </div>

                    {/* Apply button */}
                    <Button
                      size="sm"
                      onClick={() => handleApplyOption(option, index)}
                      disabled={applyingIndex !== null && applyingIndex !== index}
                      className="shrink-0"
                    >
                      {applyingIndex === index ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          Applying...
                        </>
                      ) : (
                        "Apply"
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-slate-800/50">
          <p className="text-[10px] text-white/40 text-center">
            Applying a fix will update your trip dates and regenerate the itinerary.
          </p>
        </div>
      </div>
    </div>
  );
}
