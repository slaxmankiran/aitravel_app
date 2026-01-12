/**
 * changePlan.ts
 *
 * Change Planner Agent - mounted at /api by routes.ts
 * POST /api/change-plan
 *
 * Now uses Agentic AI for intelligent recomputation:
 * 1. AI analyzes what changed and its impact
 * 2. AI calls tools (visa lookup, flight search, hotel search, etc.)
 * 3. AI synthesizes results into delta summary + natural language explanation
 * 4. Returns ChangePlannerResponse with updated data
 *
 * Set USE_AGENT=false to use deterministic fallback mode.
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
import {
  runChangePlannerAgent,
  initializeChangePlannerAgent,
  isAgentInitialized,
} from "../services/changePlannerAgent";

const router: Router = express.Router();

// Initialize agent with API key (done once at startup)
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
if (DEEPSEEK_API_KEY) {
  initializeChangePlannerAgent(DEEPSEEK_API_KEY, "https://api.deepseek.com", "deepseek-chat");
  console.log("[ChangePlan] Agentic AI mode enabled");
} else {
  console.log("[ChangePlan] No DEEPSEEK_API_KEY, using deterministic mode");
}

// Toggle for agent mode (can be overridden per-request or by env var)
const USE_AGENT_DEFAULT = process.env.USE_CHANGE_PLANNER_AGENT !== "false";

// ---------------------------------------------------------------------------
// Impact matrix (for deterministic fallback)
// ---------------------------------------------------------------------------
const IMPACT: Record<ChangeableField, RecomputableModule[]> = {
  dates: ["flights", "hotels", "itinerary", "certainty", "action_items"],
  budget: ["hotels", "itinerary", "certainty", "action_items"],
  origin: ["flights", "action_items"],
  destination: ["visa", "flights", "hotels", "itinerary", "certainty", "action_items"],
  passport: ["visa", "certainty", "action_items"],
  travelers: ["flights", "hotels", "certainty", "action_items"],
  preferences: ["hotels", "itinerary", "action_items"],
  constraints: ["flights", "hotels", "itinerary", "action_items"],
};

const MODULE_PRIORITY: Record<RecomputableModule, 1 | 2 | 3> = {
  visa: 1,
  certainty: 1,
  action_items: 1,
  flights: 2,
  hotels: 2,
  itinerary: 3,
};

// ---------------------------------------------------------------------------
// Deterministic helpers (fallback mode)
// ---------------------------------------------------------------------------
function deepEqual(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function detectChanges(prevInput: UserTripInput, nextInput: UserTripInput): DetectedChange[] {
  const fields: ChangeableField[] = [
    "dates", "budget", "origin", "destination", "passport", "travelers", "preferences", "constraints",
  ];

  const changes: DetectedChange[] = [];

  for (const field of fields) {
    const before = (prevInput as any)?.[field];
    const after = (nextInput as any)?.[field];
    if (deepEqual(before, after)) continue;

    const severity: ChangeSeverity =
      field === "destination" || field === "passport" ? "high" :
      field === "dates" ? "medium" : "low";

    changes.push({ field, before, after, impact: [...IMPACT[field]], severity });
  }

  return changes;
}

function computeModules(changes: DetectedChange[]): RecomputableModule[] {
  const set = new Set<RecomputableModule>();
  for (const c of changes) {
    c.impact.forEach((m) => set.add(m));
  }
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

function buildDeterministicResponse(
  tripId: number,
  prevInput: UserTripInput,
  nextInput: UserTripInput,
  currentResults: TripResponse
): ChangePlannerResponse {
  const detected = detectChanges(prevInput, nextInput);
  const modules = computeModules(detected);
  const changeId = makeChangeId(tripId, prevInput, nextInput);

  const currentCertainty = Number((currentResults.feasibilityReport as any)?.score) || 0;
  const currentCost = Number(
    (currentResults.itinerary as any)?.costBreakdown?.grandTotal ||
    (currentResults.itinerary as any)?.costBreakdown?.total
  ) || 0;

  // Simple heuristic for certainty
  const hasHighSeverity = detected.some((c) => c.severity === "high");
  const hasMediumSeverity = detected.some((c) => c.severity === "medium");
  let certaintyDelta = 0;
  let reason = "No significant certainty impact";

  if (hasHighSeverity) {
    certaintyDelta = -10;
    reason = "Major change detected (destination or passport)";
  } else if (hasMediumSeverity) {
    certaintyDelta = -3;
    reason = "Date change may affect availability";
  }

  const certaintyAfter = Math.max(0, Math.min(100, currentCertainty + certaintyDelta));

  // Blockers from visa
  const visa = (currentResults.feasibilityReport as any)?.visaDetails;
  const blockers = visa?.required && visa?.type !== "visa_free" ? 1 : 0;

  const banner = blockers === 0
    ? { tone: "green" as const, title: "Updated. No blockers found.", subtitle: "You're all set for planning." }
    : { tone: "amber" as const, title: `Updated. ${blockers} item${blockers !== 1 ? "s" : ""} need attention.` };

  const highlightSections: Array<"ActionItems" | "CostBreakdown" | "Itinerary" | "VisaCard"> = [];
  if (modules.includes("action_items")) highlightSections.push("ActionItems");
  if (modules.includes("hotels") || modules.includes("flights")) highlightSections.push("CostBreakdown");
  if (modules.includes("itinerary")) highlightSections.push("Itinerary");
  if (modules.includes("visa")) highlightSections.push("VisaCard");

  return {
    changeId,
    detectedChanges: detected,
    recomputePlan: {
      modulesToRecompute: modules,
      cacheKeysToInvalidate: [],
      apiCalls: modules.map((m) => ({
        name: `recompute_${m}`,
        endpointKey: m,
        priority: MODULE_PRIORITY[m],
      })),
    },
    deltaSummary: {
      certainty: { before: currentCertainty, after: certaintyAfter, reason },
      totalCost: { before: currentCost, after: currentCost, delta: 0, notes: [] },
      blockers: { before: blockers, after: blockers, resolved: [], new: [] },
      itinerary: {
        dayCountBefore: Number((currentResults.itinerary as any)?.days?.length ?? 0) || 0,
        dayCountAfter: Number((currentResults.itinerary as any)?.days?.length ?? 0) || 0,
        majorDiffs: [],
      },
    },
    uiInstructions: {
      banner,
      highlightSections,
      toasts: [{ tone: "success" as const, message: "Trip updated." }],
    },
    updatedData: { actionItems: [] },
    failures: undefined,
    fixOptions: undefined,
  };
}

// ---------------------------------------------------------------------------
// POST /change-plan (mounted at /api)
// ---------------------------------------------------------------------------
router.post("/change-plan", async (req: Request, res: Response) => {
  const startTime = performance.now();

  try {
    const { tripId, prevInput, nextInput, currentResults, source, useAgent } = req.body as {
      tripId: number;
      prevInput: UserTripInput;
      nextInput: UserTripInput;
      currentResults: TripResponse;
      source: "edit_trip" | "quick_chip" | "fix_blocker";
      useAgent?: boolean; // Optional override per-request
    };

    if (!tripId || !prevInput || !nextInput || !currentResults) {
      return res.status(400).json({ error: "Missing required payload" });
    }

    // Determine if we should use agent
    const shouldUseAgent = useAgent ?? (USE_AGENT_DEFAULT && isAgentInitialized());

    console.log(`[ChangePlan] Processing trip ${tripId}, source: ${source}, mode: ${shouldUseAgent ? "AGENT" : "DETERMINISTIC"}`);

    let response: ChangePlannerResponse;

    if (shouldUseAgent) {
      // Use Agentic AI
      try {
        response = await runChangePlannerAgent(tripId, prevInput, nextInput, currentResults, source);
        console.log(`[ChangePlan] Agent completed in ${Math.round(performance.now() - startTime)}ms`);
      } catch (agentError: any) {
        console.error("[ChangePlan] Agent failed, falling back to deterministic:", agentError.message);
        response = buildDeterministicResponse(tripId, prevInput, nextInput, currentResults);
        // Add warning toast about fallback
        response.uiInstructions.toasts = [
          { tone: "warning" as const, message: "Using simplified update (AI unavailable)." },
        ];
      }
    } else {
      // Use deterministic mode
      response = buildDeterministicResponse(tripId, prevInput, nextInput, currentResults);
    }

    const duration = Math.round(performance.now() - startTime);
    console.log(
      `[ChangePlan] Completed ${response.changeId} in ${duration}ms, ` +
      `certainty: ${response.deltaSummary.certainty.before} → ${response.deltaSummary.certainty.after}`
    );

    return res.json(response);
  } catch (error: any) {
    console.error("[ChangePlan] Error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /change-plan/status - Check agent status
// ---------------------------------------------------------------------------
router.get("/change-plan/status", (_req: Request, res: Response) => {
  res.json({
    agentInitialized: isAgentInitialized(),
    useAgentDefault: USE_AGENT_DEFAULT,
    mode: isAgentInitialized() && USE_AGENT_DEFAULT ? "agent" : "deterministic",
  });
});

export default router;
