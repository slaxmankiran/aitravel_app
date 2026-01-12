/**
 * changePlannerAgent.ts
 *
 * Agentic Change Planner - Uses AI with tool calling to intelligently
 * recompute trip modules when user makes changes.
 *
 * Flow:
 * 1. Receive change request (prev input → next input)
 * 2. AI analyzes what changed and decides which tools to call
 * 3. Execute tools (visa lookup, flight search, hotel search, etc.)
 * 4. AI synthesizes results into delta summary + natural language explanation
 * 5. Return structured response for UI
 */

import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionToolMessageParam,
} from "openai/resources/chat/completions";
import type {
  TripResponse,
  UserTripInput,
  ChangePlannerResponse,
  DetectedChange,
  ChangeableField,
  ChangeSeverity,
  RecomputableModule,
} from "@shared/schema";
import {
  CHANGE_PLANNER_TOOLS,
  executeToolCall,
  type ToolExecutionContext,
} from "./changePlannerTools";
import crypto from "crypto";

// ============================================================================
// CONFIGURATION
// ============================================================================

const MAX_ITERATIONS = 5; // Maximum tool-calling rounds
const MAX_TOOL_CALLS_PER_ROUND = 4; // Don't let AI go crazy with parallel calls

// Module priorities (1 = highest, computed first in deterministic fallback)
const MODULE_PRIORITY: Record<RecomputableModule, 1 | 2 | 3> = {
  visa: 1,
  certainty: 1,
  action_items: 1,
  flights: 2,
  hotels: 2,
  itinerary: 3,
};

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const CHANGE_PLANNER_SYSTEM_PROMPT = `You are the Change Planner Agent for VoyageAI, a travel planning application. Your job is to analyze changes a user makes to their trip and determine what needs to be recalculated.

## Your Responsibilities

1. **Analyze Changes**: Understand what the user changed (dates, budget, passport, destination, etc.)
2. **Determine Impact**: Decide which aspects of the trip are affected
3. **Gather Data**: Use tools to get updated information (visa requirements, flight prices, hotel costs, etc.)
4. **Synthesize Results**: Provide a clear summary of how the changes affect the trip

## Available Tools

You have access to these tools:
- \`get_visa_requirements\`: Check visa requirements for passport + destination
- \`search_flights\`: Get flight prices for origin/destination/dates
- \`search_hotels\`: Get hotel prices for destination/dates
- \`estimate_daily_costs\`: Estimate food, transport, activities costs
- \`assess_safety\`: Get safety assessment for a destination
- \`calculate_certainty_score\`: Calculate the overall trip certainty score
- \`regenerate_itinerary_days\`: Regenerate itinerary when needed

## Decision Guidelines

**When to call tools:**
- Passport OR destination changed → ALWAYS call \`get_visa_requirements\`
- Dates changed → Call \`search_flights\` and \`search_hotels\`
- Budget changed → Call \`estimate_daily_costs\` to check adequacy
- Destination changed → Call all cost tools + safety assessment
- After getting visa/budget/safety info → Call \`calculate_certainty_score\`

**When NOT to call tools:**
- Minor preference changes that don't affect core feasibility
- If you already have the data from a previous tool call in this session

## Response Format

After gathering data, provide your analysis in this exact JSON format:

\`\`\`json
{
  "analysis": {
    "changedFields": ["dates", "budget"],
    "impactSummary": "Brief description of what changed and why it matters",
    "modulesRecomputed": ["flights", "hotels", "certainty"]
  },
  "updatedData": {
    "visa": { ... },  // If visa was recomputed
    "flights": { ... },  // If flights were searched
    "hotels": { ... },  // If hotels were searched
    "dailyCosts": { ... },  // If daily costs were estimated
    "certainty": { "score": 85, "visaRisk": "low" }  // Always include if certainty was recalculated
  },
  "deltas": {
    "certaintyBefore": 75,
    "certaintyAfter": 85,
    "costBefore": 2500,
    "costAfter": 2800,
    "explanation": "Natural language explanation of what changed and why"
  },
  "recommendation": "Short recommendation for the user"
}
\`\`\`

## Important Rules

1. Always be concise - users want quick answers
2. Call tools in parallel when possible (e.g., flights and hotels together)
3. Don't over-explain - focus on what actually changed
4. If a tool fails, note it but continue with other tools
5. Always recalculate certainty score if ANY change could affect visa, budget, or safety
6. Express cost changes in the user's currency when possible

Now analyze the change request and gather the necessary data.`;

// ============================================================================
// AGENT IMPLEMENTATION
// ============================================================================

let openai: OpenAI | null = null;
let aiModel = "deepseek-chat";

/**
 * Initialize the agent with API credentials
 */
export function initializeChangePlannerAgent(apiKey: string, baseURL?: string, model?: string) {
  openai = new OpenAI({
    apiKey,
    baseURL: baseURL || "https://api.deepseek.com",
  });
  if (model) aiModel = model;
  console.log(`[ChangePlannerAgent] Initialized with model: ${aiModel}`);
}

/**
 * Format the change request for the AI
 */
function formatChangeRequest(
  tripId: number,
  prevInput: UserTripInput,
  nextInput: UserTripInput,
  currentTrip: TripResponse,
  source: string
): string {
  // Detect what changed at a high level
  const changes: string[] = [];

  if (prevInput.dates?.start !== nextInput.dates?.start || prevInput.dates?.end !== nextInput.dates?.end) {
    changes.push(`Dates: "${prevInput.dates?.start} to ${prevInput.dates?.end}" → "${nextInput.dates?.start} to ${nextInput.dates?.end}"`);
  }
  if (prevInput.budget !== nextInput.budget) {
    changes.push(`Budget: $${prevInput.budget} → $${nextInput.budget}`);
  }
  if (prevInput.passport !== nextInput.passport) {
    changes.push(`Passport: "${prevInput.passport}" → "${nextInput.passport}"`);
  }
  if (prevInput.destination !== nextInput.destination) {
    changes.push(`Destination: "${prevInput.destination}" → "${nextInput.destination}"`);
  }
  if (prevInput.origin !== nextInput.origin) {
    changes.push(`Origin: "${prevInput.origin}" → "${nextInput.origin}"`);
  }
  if (prevInput.travelers?.total !== nextInput.travelers?.total) {
    changes.push(`Travelers: ${prevInput.travelers?.total} → ${nextInput.travelers?.total}`);
  }

  const currentCertainty = (currentTrip.feasibilityReport as any)?.score || 0;
  const currentCost = (currentTrip.itinerary as any)?.costBreakdown?.grandTotal ||
    (currentTrip.itinerary as any)?.costBreakdown?.total || 0;

  return `## Change Request

**Trip ID:** ${tripId}
**Source:** ${source}

### What Changed
${changes.length > 0 ? changes.map(c => `- ${c}`).join('\n') : '- No significant changes detected'}

### Current Trip State
- **Destination:** ${currentTrip.destination}
- **Current Certainty Score:** ${currentCertainty}/100
- **Current Total Cost:** $${currentCost}
- **Visa Status:** ${(currentTrip.feasibilityReport as any)?.visaDetails?.type || 'unknown'}

### New Input Values
- **Passport:** ${nextInput.passport}
- **Destination:** ${nextInput.destination?.city}, ${nextInput.destination?.country}
- **Origin:** ${nextInput.origin?.city || 'Not specified'}
- **Dates:** ${nextInput.dates?.start} to ${nextInput.dates?.end}
- **Budget:** $${nextInput.budget?.total} ${nextInput.budget?.currency || 'USD'}
- **Travelers:** ${nextInput.travelers?.total} (${nextInput.travelers?.adults} adults, ${nextInput.travelers?.children || 0} children, ${nextInput.travelers?.infants || 0} infants)
- **Travel Style:** ${nextInput.preferences?.pace || 'moderate'}

Please analyze these changes and gather the necessary data to update the trip.`;
}

/**
 * Parse the agent's final response into structured data
 */
function parseAgentResponse(content: string): {
  analysis?: any;
  updatedData?: any;
  deltas?: any;
  recommendation?: string;
} {
  // Try to extract JSON from the response
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch (e) {
      console.warn("[ChangePlannerAgent] Failed to parse JSON from response");
    }
  }

  // Try to parse the whole content as JSON
  try {
    return JSON.parse(content);
  } catch (e) {
    // Return empty if we can't parse
    return {};
  }
}

/**
 * Deterministic change detection (fallback/supplement to AI)
 */
function detectChangesDeterministic(
  prevInput: UserTripInput,
  nextInput: UserTripInput
): DetectedChange[] {
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

  const changes: DetectedChange[] = [];

  const checkField = (field: ChangeableField, before: any, after: any) => {
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      const severity: ChangeSeverity =
        field === "destination" || field === "passport"
          ? "high"
          : field === "dates"
            ? "medium"
            : "low";
      changes.push({ field, before, after, impact: [...IMPACT[field]], severity });
    }
  };

  checkField("dates", prevInput.dates, nextInput.dates);
  checkField("budget", prevInput.budget, nextInput.budget);
  checkField("origin", prevInput.origin, nextInput.origin);
  checkField("destination", prevInput.destination, nextInput.destination);
  checkField("passport", prevInput.passport, nextInput.passport);
  checkField("travelers", prevInput.travelers, nextInput.travelers);
  checkField("preferences", prevInput.preferences, nextInput.preferences);
  checkField("constraints", prevInput.constraints, nextInput.constraints);

  return changes;
}

/**
 * Generate a unique change ID
 */
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

/**
 * Main agent execution function
 */
export async function runChangePlannerAgent(
  tripId: number,
  prevInput: UserTripInput,
  nextInput: UserTripInput,
  currentTrip: TripResponse,
  source: "edit_trip" | "quick_chip" | "fix_blocker"
): Promise<ChangePlannerResponse> {
  const startTime = performance.now();
  const changeId = makeChangeId(tripId, prevInput, nextInput);

  console.log(`[ChangePlannerAgent] Starting change planning for trip ${tripId}, changeId: ${changeId}`);

  // Deterministic change detection (always available)
  const detectedChanges = detectChangesDeterministic(prevInput, nextInput);
  const modulesToRecompute = Array.from(
    new Set(detectedChanges.flatMap((c) => c.impact))
  ).sort((a, b) => MODULE_PRIORITY[a] - MODULE_PRIORITY[b]);

  console.log(`[ChangePlannerAgent] Detected ${detectedChanges.length} changes, modules: ${modulesToRecompute.join(", ")}`);

  // If no OpenAI client or no changes, return fast deterministic response
  if (!openai || detectedChanges.length === 0) {
    console.log("[ChangePlannerAgent] Using deterministic fallback (no AI or no changes)");
    return buildDeterministicResponse(changeId, detectedChanges, modulesToRecompute, currentTrip);
  }

  // Prepare tool execution context
  const toolContext: ToolExecutionContext = {
    currentTrip,
    nextInput,
  };

  // Initialize conversation
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: CHANGE_PLANNER_SYSTEM_PROMPT },
    { role: "user", content: formatChangeRequest(tripId, prevInput, nextInput, currentTrip, source) },
  ];

  let iterations = 0;
  let lastAssistantContent = "";

  // Agent loop
  while (iterations < MAX_ITERATIONS) {
    iterations++;
    console.log(`[ChangePlannerAgent] Iteration ${iterations}/${MAX_ITERATIONS}`);

    try {
      const response = await openai.chat.completions.create({
        model: aiModel,
        messages,
        tools: CHANGE_PLANNER_TOOLS,
        tool_choice: iterations === MAX_ITERATIONS ? "none" : "auto", // Force completion on last iteration
        temperature: 0.3, // Lower temperature for more consistent tool use
        max_tokens: 2000,
      });

      const choice = response.choices[0];
      const message = choice.message;

      // Save assistant content if present
      if (message.content) {
        lastAssistantContent = message.content;
      }

      // If no tool calls, we're done
      if (!message.tool_calls || message.tool_calls.length === 0) {
        console.log("[ChangePlannerAgent] Agent finished (no more tool calls)");
        break;
      }

      // Add assistant message to history
      messages.push({
        role: "assistant",
        content: message.content || null,
        tool_calls: message.tool_calls,
      });

      // Execute tool calls (limit to prevent runaway)
      const toolCalls = message.tool_calls.slice(0, MAX_TOOL_CALLS_PER_ROUND);
      console.log(`[ChangePlannerAgent] Executing ${toolCalls.length} tool calls`);

      // Execute tools in parallel
      const toolResults = await Promise.all(
        toolCalls.map(async (toolCall) => {
          // Access function properties - OpenAI SDK types vary by version
          const fn = (toolCall as any).function;
          const args = JSON.parse(fn?.arguments || "{}");
          const result = await executeToolCall(fn?.name || "unknown", args, toolContext);
          return {
            id: toolCall.id,
            result,
          };
        })
      );

      // Add tool results to messages
      for (const { id, result } of toolResults) {
        const toolMessage: ChatCompletionToolMessageParam = {
          role: "tool",
          tool_call_id: id,
          content: result,
        };
        messages.push(toolMessage);
      }
    } catch (error: any) {
      console.error(`[ChangePlannerAgent] Error in iteration ${iterations}:`, error.message);
      // Continue with what we have
      break;
    }
  }

  // Parse the agent's final response
  const agentResult = parseAgentResponse(lastAssistantContent);

  // Build the final response
  const response = buildAgentResponse(
    changeId,
    detectedChanges,
    modulesToRecompute,
    currentTrip,
    agentResult,
    performance.now() - startTime
  );

  console.log(
    `[ChangePlannerAgent] Completed in ${Math.round(performance.now() - startTime)}ms, ` +
      `certainty: ${response.deltaSummary.certainty.before} → ${response.deltaSummary.certainty.after}`
  );

  return response;
}

/**
 * Build response from agent results
 */
function buildAgentResponse(
  changeId: string,
  detectedChanges: DetectedChange[],
  modulesToRecompute: RecomputableModule[],
  currentTrip: TripResponse,
  agentResult: any,
  durationMs: number
): ChangePlannerResponse {
  const currentCertainty = Number((currentTrip.feasibilityReport as any)?.score) || 0;
  const currentCost =
    Number(
      (currentTrip.itinerary as any)?.costBreakdown?.grandTotal ||
        (currentTrip.itinerary as any)?.costBreakdown?.total
    ) || 0;

  // Extract data from agent result
  const updatedData = agentResult.updatedData || {};
  const deltas = agentResult.deltas || {};

  // Certainty from agent or estimate
  const certaintyAfter = updatedData.certainty?.score ?? deltas.certaintyAfter ?? currentCertainty;
  const certaintyReason = deltas.explanation || agentResult.recommendation || "Trip updated based on changes";

  // Cost from agent or current
  const costAfter = deltas.costAfter ?? currentCost;

  // Blockers - derive from visa status
  const beforeVisa = (currentTrip.feasibilityReport as any)?.visaDetails;
  const afterVisa = updatedData.visa ?? beforeVisa;
  const beforeBlockers = beforeVisa?.required && beforeVisa?.type !== "visa_free" ? 1 : 0;
  const afterBlockers = afterVisa?.required && afterVisa?.type !== "visa_free" ? 1 : 0;

  const resolved: string[] = [];
  const newBlockers: string[] = [];
  if (beforeBlockers > 0 && afterBlockers === 0) {
    resolved.push("Visa no longer required");
  }
  if (beforeBlockers === 0 && afterBlockers > 0) {
    newBlockers.push("Visa now required");
  }

  // Build banner
  let banner: { tone: "green" | "amber" | "red"; title: string; subtitle?: string };
  if (afterBlockers === 0) {
    banner = {
      tone: "green",
      title: "Updated. No blockers found.",
      subtitle: agentResult.recommendation || "You're all set for planning.",
    };
  } else if (afterBlockers <= 2) {
    banner = {
      tone: "amber",
      title: `Updated. ${afterBlockers} item${afterBlockers !== 1 ? "s" : ""} need attention.`,
      subtitle: agentResult.recommendation,
    };
  } else {
    banner = {
      tone: "red",
      title: "Updated. This change introduced blockers.",
      subtitle: agentResult.recommendation,
    };
  }

  // Build highlight sections
  const highlightSections: Array<"ActionItems" | "CostBreakdown" | "Itinerary" | "VisaCard"> = [];
  if (modulesToRecompute.includes("action_items")) highlightSections.push("ActionItems");
  if (modulesToRecompute.includes("hotels") || modulesToRecompute.includes("flights"))
    highlightSections.push("CostBreakdown");
  if (modulesToRecompute.includes("itinerary")) highlightSections.push("Itinerary");
  if (modulesToRecompute.includes("visa")) highlightSections.push("VisaCard");

  return {
    changeId,
    detectedChanges,
    recomputePlan: {
      modulesToRecompute,
      cacheKeysToInvalidate: [],
      apiCalls: modulesToRecompute.map((m) => ({
        name: `recompute_${m}`,
        endpointKey: m,
        priority: MODULE_PRIORITY[m],
      })),
    },
    deltaSummary: {
      certainty: {
        before: currentCertainty,
        after: certaintyAfter,
        reason: certaintyReason,
      },
      totalCost: {
        before: currentCost,
        after: costAfter,
        delta: costAfter - currentCost,
        notes: costAfter !== currentCost ? ["Cost estimate updated based on changes"] : [],
      },
      blockers: {
        before: beforeBlockers,
        after: afterBlockers,
        resolved,
        new: newBlockers,
      },
      itinerary: {
        dayCountBefore: Number((currentTrip.itinerary as any)?.days?.length ?? 0) || 0,
        dayCountAfter: Number((currentTrip.itinerary as any)?.days?.length ?? 0) || 0,
        majorDiffs: [],
      },
    },
    uiInstructions: {
      banner,
      highlightSections,
      toasts: [
        {
          tone: "success" as const,
          message: "Trip updated successfully.",
        },
      ],
    },
    updatedData: {
      visa: updatedData.visa,
      flights: updatedData.flights,
      hotels: updatedData.hotels,
      actionItems: [], // Action items are derived client-side from visa status
      costBreakdown: updatedData.dailyCosts
        ? {
            ...((currentTrip.itinerary as any)?.costBreakdown || {}),
            dailyCosts: updatedData.dailyCosts,
          }
        : undefined,
    },
    failures: undefined,
    fixOptions: undefined,
  };
}

/**
 * Build deterministic response (fallback when AI unavailable)
 */
function buildDeterministicResponse(
  changeId: string,
  detectedChanges: DetectedChange[],
  modulesToRecompute: RecomputableModule[],
  currentTrip: TripResponse
): ChangePlannerResponse {
  const currentCertainty = Number((currentTrip.feasibilityReport as any)?.score) || 0;
  const currentCost =
    Number(
      (currentTrip.itinerary as any)?.costBreakdown?.grandTotal ||
        (currentTrip.itinerary as any)?.costBreakdown?.total
    ) || 0;

  // Simple heuristic for certainty change
  const hasHighSeverity = detectedChanges.some((c) => c.severity === "high");
  const hasMediumSeverity = detectedChanges.some((c) => c.severity === "medium");
  let certaintyDelta = 0;
  let reason = "No significant impact";

  if (hasHighSeverity) {
    certaintyDelta = -10;
    reason = "Major change detected (destination or passport)";
  } else if (hasMediumSeverity) {
    certaintyDelta = -3;
    reason = "Date change may affect availability";
  }

  const certaintyAfter = Math.max(0, Math.min(100, currentCertainty + certaintyDelta));

  // Blockers from current visa
  const visa = (currentTrip.feasibilityReport as any)?.visaDetails;
  const blockers = visa?.required && visa?.type !== "visa_free" ? 1 : 0;

  return {
    changeId,
    detectedChanges,
    recomputePlan: {
      modulesToRecompute,
      cacheKeysToInvalidate: [],
      apiCalls: modulesToRecompute.map((m) => ({
        name: `recompute_${m}`,
        endpointKey: m,
        priority: MODULE_PRIORITY[m],
      })),
    },
    deltaSummary: {
      certainty: {
        before: currentCertainty,
        after: certaintyAfter,
        reason,
      },
      totalCost: {
        before: currentCost,
        after: currentCost,
        delta: 0,
        notes: [],
      },
      blockers: {
        before: blockers,
        after: blockers,
        resolved: [],
        new: [],
      },
      itinerary: {
        dayCountBefore: Number((currentTrip.itinerary as any)?.days?.length ?? 0) || 0,
        dayCountAfter: Number((currentTrip.itinerary as any)?.days?.length ?? 0) || 0,
        majorDiffs: [],
      },
    },
    uiInstructions: {
      banner: {
        tone: blockers > 0 ? "amber" : "green",
        title: blockers > 0 ? "Updated. Some items need attention." : "Updated. No blockers found.",
        subtitle: "Refresh to see updated estimates.",
      },
      highlightSections: [],
      toasts: [{ tone: "success" as const, message: "Trip updated." }],
    },
    updatedData: { actionItems: [] },
    failures: undefined,
    fixOptions: undefined,
  };
}

/**
 * Check if agent is initialized
 */
export function isAgentInitialized(): boolean {
  return openai !== null;
}
