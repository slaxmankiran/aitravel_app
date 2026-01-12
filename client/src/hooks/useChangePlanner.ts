/**
 * useChangePlanner.ts
 *
 * Client hook for the Change Planner Agent.
 * - planChanges() calls /api/change-plan
 * - applyChanges() patches workingTrip + returns UI highlight instructions
 * - Tracks analytics: started, planned, applied, failed
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { trackTripEvent } from "@/lib/analytics";
import {
  buildSnapshotFromTrip,
  buildVersionSummary,
  type VersionSource,
} from "./useTripVersions";
import type {
  TripResponse,
  ChangeableField,
  RecomputableModule,
  ChangeSeverity,
  UserTripInput,
  ChangePlannerResponse,
} from "@shared/schema";

// Re-export types for convenience
export type {
  ChangeableField,
  RecomputableModule,
  ChangeSeverity,
  UserTripInput,
  ChangePlannerResponse,
};

type PlanChangesArgs = {
  tripId: number;
  prevInput: UserTripInput;
  nextInput: UserTripInput;
  currentResults: TripResponse;
  source: "edit_trip" | "quick_chip" | "fix_blocker";
  analyticsContext?: Record<string, any>;
};

type ApplyChangesArgs = {
  tripId: number;
  plan: ChangePlannerResponse;
  setWorkingTrip: (updater: (prev: TripResponse | null) => TripResponse | null) => void;
  setBannerPlan?: (plan: ChangePlannerResponse | null, source?: string) => void;
  source?: string; // For URL sharing: "fix_blocker", "edit_trip", "quick_chip"
  analyticsContext?: Record<string, any>;
  // Version creation callback - receives updated trip + version info
  onVersionCreate?: (args: {
    source: VersionSource;
    changeId: string;
    snapshot: ReturnType<typeof buildSnapshotFromTrip>;
    summary: ReturnType<typeof buildVersionSummary>;
  }) => Promise<void>;
};

type ApplyChangesResult = {
  highlightSections: Array<"ActionItems" | "CostBreakdown" | "Itinerary" | "VisaCard">;
  toasts: Array<{ tone: "success" | "warning" | "error"; message: string }>;
  banner: { tone: "green" | "amber" | "red"; title: string; subtitle?: string } | undefined;
};

export function useChangePlanner() {
  const [isReplanning, setIsReplanning] = useState(false);
  const [changePlan, setChangePlan] = useState<ChangePlannerResponse | null>(null);
  const lastPlanRef = useRef<ChangePlannerResponse | null>(null);

  const planChanges = useCallback(async (args: PlanChangesArgs): Promise<ChangePlannerResponse> => {
    const { tripId, prevInput, nextInput, currentResults, source, analyticsContext } = args;

    // Track change started
    trackTripEvent(
      tripId,
      "trip_change_started",
      {
        changeFields: Object.keys(nextInput ?? {}).join(","),
        source,
        currentCertainty: (currentResults.feasibilityReport as any)?.score,
      },
      analyticsContext
    );

    const start = performance.now();
    setIsReplanning(true);

    try {
      const res = await fetch("/api/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, prevInput, nextInput, currentResults, source }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `change-plan failed (${res.status})`);
      }

      const plan = (await res.json()) as ChangePlannerResponse;
      setChangePlan(plan);
      lastPlanRef.current = plan;

      // Track change planned
      trackTripEvent(
        tripId,
        "trip_change_planned",
        {
          modulesToRecompute: (plan.recomputePlan?.modulesToRecompute ?? []).join(","),
          severityMax: plan.detectedChanges?.reduce<ChangeSeverity>((acc, c) => {
            const rank = (v: ChangeSeverity) => (v === "high" ? 3 : v === "medium" ? 2 : 1);
            return rank(c.severity) > rank(acc) ? c.severity : acc;
          }, "low"),
          predictedBlockerDelta: plan.deltaSummary?.blockers
            ? plan.deltaSummary.blockers.after - plan.deltaSummary.blockers.before
            : undefined,
          predictedCostDelta: plan.deltaSummary?.totalCost?.delta,
          durationMs: Math.round(performance.now() - start),
        },
        analyticsContext
      );

      return plan;
    } catch (err: any) {
      // Track change failed
      trackTripEvent(
        tripId,
        "trip_change_failed",
        {
          moduleFailed: "change-plan",
          errorCode: err?.name || "Error",
          partialApplied: false,
        },
        analyticsContext
      );
      throw err;
    } finally {
      setIsReplanning(false);
    }
  }, []);

  const applyChanges = useCallback((args: ApplyChangesArgs): ApplyChangesResult => {
    const { tripId, plan, setWorkingTrip, setBannerPlan, source, analyticsContext, onVersionCreate } = args;

    const start = performance.now();

    // Show banner (with source for URL sharing)
    setBannerPlan?.(plan, source);

    // Track the updated trip for version creation
    let updatedTrip: TripResponse | null = null;

    // Patch data into workingTrip deterministically
    setWorkingTrip((prev) => {
      if (!prev) return prev;

      const next: any = { ...prev };

      // Patch itinerary + costBreakdown
      if (plan.updatedData?.itinerary) {
        next.itinerary = plan.updatedData.itinerary;
      }
      if (plan.updatedData?.costBreakdown) {
        next.itinerary = next.itinerary || {};
        next.itinerary.costBreakdown = plan.updatedData.costBreakdown;
      }

      // Patch visa details into feasibilityReport
      // ActionItems.tsx will re-derive required items from visaDetails automatically
      if (plan.updatedData?.visa) {
        next.feasibilityReport = next.feasibilityReport || {};
        next.feasibilityReport.visaDetails = plan.updatedData.visa;
      }

      // Patch certainty score if provided via deltaSummary
      if (plan.deltaSummary?.certainty?.after != null) {
        next.feasibilityReport = next.feasibilityReport || {};
        next.feasibilityReport.score = plan.deltaSummary.certainty.after;
      }

      updatedTrip = next as TripResponse;
      return updatedTrip;
    });

    // Track change applied
    trackTripEvent(
      tripId,
      "trip_change_applied",
      {
        certaintyBefore: plan.deltaSummary?.certainty?.before,
        certaintyAfter: plan.deltaSummary?.certainty?.after,
        blockersBefore: plan.deltaSummary?.blockers?.before,
        blockersAfter: plan.deltaSummary?.blockers?.after,
        costBefore: plan.deltaSummary?.totalCost?.before,
        costAfter: plan.deltaSummary?.totalCost?.after,
        durationMs: Math.round(performance.now() - start),
      },
      analyticsContext
    );

    // Create version if callback provided and we have updated trip
    if (onVersionCreate && updatedTrip) {
      const versionSource: VersionSource = source === "fix_blocker" ? "next_fix" : "change_plan";
      const changeId = `${versionSource}:${tripId}:${Date.now()}`;

      // Build change chips from detected changes
      const chips: string[] = [];
      if (plan.detectedChanges) {
        for (const change of plan.detectedChanges.slice(0, 3)) {
          // Use field and impact to create chip
          const fieldLabel = change.field.charAt(0).toUpperCase() + change.field.slice(1);
          chips.push(`${fieldLabel} changed`);
        }
      }
      if (chips.length === 0) {
        chips.push("Plan updated");
      }

      const snapshot = buildSnapshotFromTrip(updatedTrip);
      const summary = buildVersionSummary(snapshot, chips, versionSource);

      // Fire and forget - don't block UI
      onVersionCreate({
        source: versionSource,
        changeId,
        snapshot,
        summary,
      }).catch((err) => {
        console.error("[applyChanges] Failed to create version:", err);
      });
    }

    return {
      highlightSections: plan.uiInstructions?.highlightSections ?? [],
      toasts: plan.uiInstructions?.toasts ?? [],
      banner: plan.uiInstructions?.banner,
    };
  }, []);

  const resetPlan = useCallback(() => {
    setChangePlan(null);
    lastPlanRef.current = null;
  }, []);

  return useMemo(
    () => ({
      isReplanning,
      changePlan,
      lastPlan: lastPlanRef.current,
      planChanges,
      applyChanges,
      resetPlan,
    }),
    [isReplanning, changePlan, planChanges, applyChanges, resetPlan]
  );
}
