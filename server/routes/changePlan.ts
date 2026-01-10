/**
 * changePlan.ts
 *
 * Change Planner Agent - mounted at /api by routes.ts
 * POST /api/change-plan
 *
 * Change Planner Agent endpoint that:
 * 1. Diffs inputs (prev vs next)
 * 2. Uses impact matrix to compute which modules need recomputation
 * 3. Executes module recomputes in priority order
 * 4. Produces delta summary
 * 5. Returns ChangePlannerResponse with partial failures supported
 */

import type { Request, Response, Router } from "express";
import express from "express";
import crypto from "crypto";
import type {
  ChangeableField,
  RecomputableModule,
  ChangeSeverity,
  UserTripInput,
  DetectedChange,
  ChangePlannerResponse,
  TripResponse,
} from "@shared/schema";

const router: Router = express.Router();

// ---------------------------------------------------------------------------
// Impact matrix (from spec)
// ---------------------------------------------------------------------------
const IMPACT: Record<ChangeableField, RecomputableModule[]> = {
  dates: ["flights", "hotels", "itinerary", "certainty", "action_items"], // visa conditional
  budget: ["hotels", "itinerary", "certainty", "action_items"], // re-rank style
  origin: ["flights", "action_items"],
  destination: ["visa", "flights", "hotels", "itinerary", "certainty", "action_items"],
  passport: ["visa", "certainty", "action_items"],
  travelers: ["flights", "hotels", "certainty", "action_items"],
  preferences: ["hotels", "itinerary", "action_items"],
  constraints: ["flights", "hotels", "itinerary", "action_items"],
};

// Priorities per spec (1 = highest priority, computed first)
const MODULE_PRIORITY: Record<RecomputableModule, 1 | 2 | 3> = {
  visa: 1,
  certainty: 1,
  action_items: 1,
  flights: 2,
  hotels: 2,
  itinerary: 3,
};

// ---------------------------------------------------------------------------
// Diffing helpers (deterministic)
// ---------------------------------------------------------------------------
function deepEqual(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function detectChanges(prevInput: UserTripInput, nextInput: UserTripInput): DetectedChange[] {
  const fields: ChangeableField[] = [
    "dates",
    "budget",
    "origin",
    "destination",
    "passport",
    "travelers",
    "preferences",
    "constraints",
  ];

  const changes: DetectedChange[] = [];

  for (const field of fields) {
    const before = (prevInput as any)?.[field];
    const after = (nextInput as any)?.[field];
    if (deepEqual(before, after)) continue;

    const impact = [...IMPACT[field]];

    // Severity based on field type
    const severity: ChangeSeverity =
      field === "destination" || field === "passport"
        ? "high"
        : field === "dates"
          ? "medium"
          : "low";

    changes.push({ field, before, after, impact, severity });
  }

  return changes;
}

function computeModules(changes: DetectedChange[]): RecomputableModule[] {
  const set = new Set<RecomputableModule>();
  for (const c of changes) {
    c.impact.forEach((m) => set.add(m));
  }
  // Keep deterministic ordering by priority then alpha
  return Array.from(set).sort((a, b) => {
    const pa = MODULE_PRIORITY[a];
    const pb = MODULE_PRIORITY[b];
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b);
  });
}

function makeChangeId(tripId: number, prevInput: any, nextInput: any): string {
  const hash = crypto
    .createHash("sha1")
    .update(String(tripId))
    .update(JSON.stringify(prevInput))
    .update(JSON.stringify(nextInput))
    .digest("hex")
    .slice(0, 10);
  return `chg_${hash}`;
}

// ---------------------------------------------------------------------------
// Recompute stubs - Wire these to your real services
// ---------------------------------------------------------------------------
async function recomputeVisa(
  trip: TripResponse,
  nextInput: UserTripInput
): Promise<any> {
  // TODO: Call your visa data service (e.g., from feasibility analysis)
  // For now, return existing visa details with updated passport context
  const existing = (trip.feasibilityReport as any)?.visaDetails;
  return existing ?? { type: "unknown", required: true };
}

async function recomputeFlights(
  trip: TripResponse,
  nextInput: UserTripInput
): Promise<any> {
  // TODO: Call flight estimate service
  // For now, return existing flight data
  const existing = (trip.itinerary as any)?.costBreakdown?.flights;
  return existing ?? null;
}

async function recomputeHotels(
  trip: TripResponse,
  nextInput: UserTripInput
): Promise<any> {
  // TODO: Call hotel estimate service
  // For now, return existing hotel data
  const existing = (trip.itinerary as any)?.costBreakdown?.accommodation;
  return existing ?? null;
}

async function recomputeItinerary(
  trip: TripResponse,
  nextInput: UserTripInput
): Promise<any> {
  // TODO: Call itinerary generation/rerank service
  // For now, return existing itinerary
  return trip.itinerary ?? null;
}

function recomputeCertainty(
  currentTrip: TripResponse,
  updatedData: any,
  changes: DetectedChange[]
): { before: number; after: number; reason: string } {
  const before = Number((currentTrip.feasibilityReport as any)?.score) || 0;

  // Simple heuristic: high severity changes may reduce certainty
  const hasHighSeverity = changes.some((c) => c.severity === "high");
  const hasMediumSeverity = changes.some((c) => c.severity === "medium");

  let delta = 0;
  let reason = "No significant certainty impact";

  if (hasHighSeverity) {
    delta = -10;
    reason = "Major change detected (destination or passport)";
  } else if (hasMediumSeverity) {
    delta = -3;
    reason = "Date change may affect availability";
  }

  // Visa changes can further affect certainty
  if (updatedData?.visa?.required && !(currentTrip.feasibilityReport as any)?.visaDetails?.required) {
    delta -= 5;
    reason = "Visa now required";
  }

  const after = Math.max(0, Math.min(100, before + delta));
  return { before, after, reason };
}

function computeCostDelta(
  currentTrip: TripResponse,
  updatedData: any
): { before: number; after: number; delta: number; notes: string[] } {
  const costBreakdown = (currentTrip.itinerary as any)?.costBreakdown;
  const before = Number(costBreakdown?.grandTotal ?? costBreakdown?.total ?? 0) || 0;

  // If we have updated cost breakdown, use it
  const afterBreakdown = updatedData?.costBreakdown;
  const after = afterBreakdown
    ? Number(afterBreakdown?.grandTotal ?? afterBreakdown?.total ?? before) || before
    : before;

  return {
    before,
    after,
    delta: after - before,
    notes: after !== before ? ["Cost estimate updated based on changes"] : [],
  };
}

/**
 * Compute blockers delta based on visa requirements only.
 * This matches how ActionItems.tsx derives "required" items on the client.
 * Currently visa is the only real blocker source in production.
 */
function computeBlockersDelta(
  trip: TripResponse,
  updatedData: any,
  changes: DetectedChange[]
): { before: number; after: number; resolved: string[]; new: string[] } {
  const feasibility = trip.feasibilityReport as any;
  const resolved: string[] = [];
  const newBlockers: string[] = [];

  // Before: count visa blocker from current feasibility
  const beforeVisa = feasibility?.visaDetails;
  const beforeHasVisaBlocker = beforeVisa?.required && beforeVisa?.type !== "visa_free";
  const beforeCount = beforeHasVisaBlocker ? 1 : 0;

  // After: check if updated visa changes blocker status
  const afterVisa = updatedData?.visa ?? beforeVisa;
  const afterHasVisaBlocker = afterVisa?.required && afterVisa?.type !== "visa_free";
  const afterCount = afterHasVisaBlocker ? 1 : 0;

  // Track resolved/new blockers
  if (beforeHasVisaBlocker && !afterHasVisaBlocker) {
    resolved.push("Visa no longer required");
  }
  if (!beforeHasVisaBlocker && afterHasVisaBlocker) {
    newBlockers.push("Visa now required");
  }

  // If passport/destination changed but we couldn't recompute visa, note uncertainty
  const hasVisaImpactingChange = changes.some(
    (c) => c.field === "passport" || c.field === "destination"
  );
  if (hasVisaImpactingChange && !updatedData?.visa) {
    newBlockers.push("Visa requirements may have changed");
  }

  return {
    before: beforeCount,
    after: afterCount,
    resolved,
    new: newBlockers,
  };
}

function buildBanner(blockersAfter: number): {
  tone: "green" | "amber" | "red";
  title: string;
  subtitle?: string;
} {
  if (blockersAfter === 0) {
    return {
      tone: "green",
      title: "Updated. No blockers found.",
      subtitle: "You're all set for planning.",
    };
  }
  if (blockersAfter <= 2) {
    return {
      tone: "amber",
      title: `Updated. ${blockersAfter} item${blockersAfter !== 1 ? "s" : ""} need attention before your trip.`,
      subtitle: undefined,
    };
  }
  return {
    tone: "red",
    title: "Updated. This change introduced a blocker.",
    subtitle: undefined,
  };
}

function buildHighlightSections(
  modules: RecomputableModule[]
): Array<"ActionItems" | "CostBreakdown" | "Itinerary" | "VisaCard"> {
  const sections: Array<"ActionItems" | "CostBreakdown" | "Itinerary" | "VisaCard"> = [];
  if (modules.includes("action_items")) sections.push("ActionItems");
  if (modules.includes("hotels") || modules.includes("flights")) sections.push("CostBreakdown");
  if (modules.includes("itinerary")) sections.push("Itinerary");
  if (modules.includes("visa")) sections.push("VisaCard");
  return sections;
}

// ---------------------------------------------------------------------------
// POST /change-plan (mounted at /api)
// ---------------------------------------------------------------------------
router.post("/change-plan", async (req: Request, res: Response) => {
  try {
    const { tripId, prevInput, nextInput, currentResults, source } = req.body as {
      tripId: number;
      prevInput: UserTripInput;
      nextInput: UserTripInput;
      currentResults: TripResponse;
      source: "edit_trip" | "quick_chip" | "fix_blocker";
    };

    if (!tripId || !prevInput || !nextInput || !currentResults) {
      return res.status(400).json({ error: "Missing required payload" });
    }

    console.log(`[ChangePlan] Processing change for trip ${tripId}, source: ${source}`);

    const detected = detectChanges(prevInput, nextInput);
    const modules = computeModules(detected);
    const changeId = makeChangeId(tripId, prevInput, nextInput);

    console.log(`[ChangePlan] Detected ${detected.length} changes, modules to recompute:`, modules);

    const failures: ChangePlannerResponse["failures"] = [];
    const updatedData: any = {};

    // Execute recomputes by priority
    // Note: "action_items" module means UI should refresh checklist, but items are
    // derived client-side from visaDetails, so we don't output actionItems here.
    for (const module of modules) {
      try {
        if (module === "visa") {
          updatedData.visa = await recomputeVisa(currentResults, nextInput);
        }
        if (module === "flights") {
          updatedData.flights = await recomputeFlights(currentResults, nextInput);
        }
        if (module === "hotels") {
          updatedData.hotels = await recomputeHotels(currentResults, nextInput);
        }
        if (module === "itinerary") {
          updatedData.itinerary = await recomputeItinerary(currentResults, nextInput);
        }
        // "action_items" and "certainty" don't produce updatedData - they signal UI refresh
      } catch (e: any) {
        const msg = e?.message || String(e);
        console.error(`[ChangePlan] Failed to recompute ${module}:`, msg);
        failures.push({
          module: module as any,
          errorCode: e?.name || "Error",
          errorMessage: msg,
          retryable: true,
        });
      }
    }

    // Deltas and UI instructions are computed even if failures occurred
    const certainty = recomputeCertainty(currentResults, updatedData, detected);
    const totalCost = computeCostDelta(currentResults, updatedData);
    const blockers = computeBlockersDelta(currentResults, updatedData, detected);

    const response: ChangePlannerResponse = {
      changeId,
      detectedChanges: detected,
      recomputePlan: {
        modulesToRecompute: modules,
        cacheKeysToInvalidate: [], // TODO: implement cache key generation
        apiCalls: modules.map((m) => ({
          name: `recompute_${m}`,
          endpointKey: m,
          priority: MODULE_PRIORITY[m],
        })),
      },
      deltaSummary: {
        certainty,
        totalCost,
        blockers,
        itinerary: {
          dayCountBefore: Number((currentResults.itinerary as any)?.days?.length ?? 0) || 0,
          dayCountAfter:
            Number(
              (updatedData.itinerary as any)?.days?.length ??
                (currentResults.itinerary as any)?.days?.length ??
                0
            ) || 0,
          majorDiffs: [],
        },
      },
      uiInstructions: {
        banner: buildBanner(blockers.after),
        highlightSections: buildHighlightSections(modules),
        toasts: failures.length
          ? [{ tone: "warning" as const, message: "Some sections could not be refreshed. Showing last known data." }]
          : [{ tone: "success" as const, message: "Trip updated successfully." }],
      },
      updatedData,
      failures: failures.length ? failures : undefined,
      fixOptions: undefined, // TODO: implement smallest-fix algorithm
    };

    console.log(`[ChangePlan] Completed change ${changeId}, certainty: ${certainty.before} -> ${certainty.after}`);

    return res.json(response);
  } catch (error: any) {
    console.error("[ChangePlan] Error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
});

export default router;
