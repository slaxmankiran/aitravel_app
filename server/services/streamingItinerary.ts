/**
 * Streaming Itinerary Service
 *
 * Generates itinerary day-by-day with SSE streaming for real-time UI updates.
 * This makes the app feel 5x faster by showing Day 1 within seconds.
 *
 * Production features:
 * - Abort on client disconnect (cost protection)
 * - Activity deduplication across days
 * - Atomic persistence support
 */

import OpenAI from "openai";
import type { Response, Request } from "express";
import {
  validateItinerary,
  buildRefinementPrompt,
  type CombinedValidationResult,
  type GroupProfile,
} from "./validators";
import {
  enhanceWithRagVerification,
  isRagVerificationAvailable,
  getVisaCostForTrip,
  type VisaCostVerificationResult,
} from "./ragCostVerifier";
import {
  isGooglePlacesConfigured,
  enrichActivitiesBatch,
  type PlaceDetails,
} from "./googlePlacesService";

// ============================================================================
// TYPES
// ============================================================================

export interface StreamingItineraryInput {
  tripId: number;
  destination: string;
  startDate: string; // ISO date
  numDays: number;
  travelStyle: string;
  budget: number;
  currency: string;
  groupSize: number;
  passport?: string;
  origin?: string;
  /** Group profile for logistics validation */
  groupProfile?: GroupProfile;
  /** Enable validation loop (default: true) */
  enableValidation?: boolean;
  /** Enable RAG cost verification (default: true) */
  enableRagVerification?: boolean;
  /** Enable Google Places enrichment (default: true if API key configured) */
  enablePlacesEnrichment?: boolean;
  /** Visa details for cost verification */
  visaDetails?: {
    type?: string;
    costs?: { total?: number };
  };
}

export interface ItineraryActivity {
  time: string;
  name: string;
  description: string;
  type: "activity" | "meal" | "transport" | "lodging";
  estimatedCost: number;
  duration: string;
  location: string;
  coordinates: { lat: number; lng: number };
  transportMode?: string;
  /** Dedupe key: slug(name) + destination + timeSlot */
  activityKey?: string;
  /** Cost verification metadata (Phase 3 - Trust Badges) */
  costVerification?: {
    source: "rag_knowledge" | "api_estimate" | "ai_estimate" | "user_input";
    confidence: "high" | "medium" | "low";
    lastVerified?: string;
    citation?: string;
    originalEstimate?: number;
  };
  /** Google Places enrichment (Phase 8 - Week 2) */
  placeDetails?: {
    placeId?: string;
    rating?: number;
    userRatingsTotal?: number;
    priceLevel?: number;
    googleMapsUrl?: string;
    website?: string;
    phoneNumber?: string;
    openingHours?: {
      isOpen?: boolean;
      weekdayText?: string[];
    };
  };
}

export interface ItineraryDay {
  day: number;
  date: string;
  title: string;
  activities: ItineraryActivity[];
  localFood?: Array<{
    name: string;
    cuisine: string;
    priceRange: string;
    estimatedCost: number;
    mustTry: string;
    address?: string;
  }>;
}

export interface StreamEvent {
  event: "meta" | "day" | "progress" | "done" | "error" | "validation" | "refinement";
  data: any;
}

/**
 * Validation result included in done event
 */
export interface ValidationMetadata {
  budgetVerified: boolean;
  logisticsVerified: boolean;
  totalIterations: number;
  refinedDays: number[];
  logs: string[];
  /** RAG cost verification stats (Phase 4) */
  ragVerification?: {
    enabled: boolean;
    activitiesVerified: number;
    activitiesUnverified: number;
    visaCostVerified?: boolean;
    visaCost?: number;
    visaCostSource?: string;
    visaCostCitation?: string;
  };
}

/**
 * Abort controller for stream cancellation
 */
export interface StreamAbortController {
  aborted: boolean;
  abort: () => void;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Environment flag to enable/disable streaming (default: enabled in dev) */
export const STREAMING_ENABLED = process.env.STREAMING_ITINERARY_ENABLED !== "false";

// ============================================================================
// GENERATION BUDGETS
// ============================================================================

/**
 * Hard limits to prevent runaway generation and control costs
 */
export const GENERATION_BUDGETS = {
  /** Maximum days allowed in a single itinerary */
  maxDays: 14,
  /** Maximum total generation time (5 minutes) */
  maxTotalMs: 5 * 60 * 1000,
  /** Maximum AI API calls per stream */
  maxAICalls: 20,
  /** Maximum retries per day before giving up */
  maxRetriesPerDay: 2,
};

// ============================================================================
// STREAM METRICS
// ============================================================================

/**
 * Metrics collected during stream generation for observability
 */
export interface StreamMetrics {
  tripId: number;
  lockOwner: string | null;
  status: "complete" | "abort" | "error" | "waiting" | "budget_exceeded";
  totalDays: number;
  generatedDays: number;
  cachedDays: number;
  timeToFirstDayMs: number | null;
  totalMs: number;
  aiCalls: number;
  recoverableErrors: number;
  lockWaitMs: number;
  budgetExceeded: {
    type: "days" | "time" | "calls" | null;
    limit: number | null;
    actual: number | null;
  };
  requestId: string;
  destination: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Create initial stream metrics
 */
export function createStreamMetrics(tripId: number, destination: string, lockOwner: string | null): StreamMetrics {
  return {
    tripId,
    lockOwner,
    status: "complete",
    totalDays: 0,
    generatedDays: 0,
    cachedDays: 0,
    timeToFirstDayMs: null,
    totalMs: 0,
    aiCalls: 0,
    recoverableErrors: 0,
    lockWaitMs: 0,
    budgetExceeded: { type: null, limit: null, actual: null },
    requestId: generateRequestId(),
    destination,
  };
}

/**
 * Generate a unique request ID for tracing
 */
function generateRequestId(): string {
  return `stream_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Check if any budget is exceeded
 */
export function checkBudgetExceeded(
  metrics: StreamMetrics,
  startTime: number,
  requestedDays: number
): { exceeded: boolean; type: "days" | "time" | "calls" | null; limit: number; actual: number } {
  // Check max days
  if (requestedDays > GENERATION_BUDGETS.maxDays) {
    return { exceeded: true, type: "days", limit: GENERATION_BUDGETS.maxDays, actual: requestedDays };
  }

  // Check max time
  const elapsedMs = Date.now() - startTime;
  if (elapsedMs > GENERATION_BUDGETS.maxTotalMs) {
    return { exceeded: true, type: "time", limit: GENERATION_BUDGETS.maxTotalMs, actual: elapsedMs };
  }

  // Check max AI calls
  if (metrics.aiCalls >= GENERATION_BUDGETS.maxAICalls) {
    return { exceeded: true, type: "calls", limit: GENERATION_BUDGETS.maxAICalls, actual: metrics.aiCalls };
  }

  return { exceeded: false, type: null, limit: 0, actual: 0 };
}

/**
 * Log structured stream summary (one line per stream)
 * This is the key observability output for debugging and monitoring
 */
export function logStreamSummary(metrics: StreamMetrics): void {
  const summary = {
    type: "stream_summary",
    ...metrics,
    timestamp: new Date().toISOString(),
  };

  // Log as structured JSON for easy parsing
  console.log(`[StreamSummary] ${JSON.stringify(summary)}`);
}

// ============================================================================
// SSE HELPERS
// ============================================================================

/** Heartbeat interval in milliseconds (15 seconds) */
const HEARTBEAT_INTERVAL_MS = 15000;

/**
 * SSE context with heartbeat management
 */
export interface SSEContext {
  res: Response;
  heartbeatInterval: NodeJS.Timeout | null;
  eventCounter: number;
}

/**
 * Send an SSE event to the client with optional event ID
 * @param ctx - SSE context
 * @param event - Event to send
 * @param eventId - Optional event ID for Last-Event-ID resume support
 */
export function sendSSE(res: Response, event: StreamEvent, eventId?: string): void {
  if (!res.writableEnded) {
    if (eventId) {
      res.write(`id: ${eventId}\n`);
    }
    res.write(`event: ${event.event}\n`);
    res.write(`data: ${JSON.stringify(event.data)}\n\n`);
  }
}

/**
 * Send an SSE event using context (with auto-incrementing event counter)
 */
export function sendSSEWithContext(ctx: SSEContext, event: StreamEvent, eventId?: string): void {
  const id = eventId || `evt-${++ctx.eventCounter}`;
  sendSSE(ctx.res, event, id);
}

/**
 * Send a heartbeat ping to keep connection alive
 * Uses SSE comment format (: comment) which clients ignore but proxies see as activity
 */
function sendHeartbeat(res: Response): void {
  if (!res.writableEnded) {
    res.write(`: ping ${Date.now()}\n\n`);
  }
}

/**
 * Setup SSE headers for streaming response
 */
export function setupSSEHeaders(res: Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
  res.flushHeaders();
}

/**
 * Create SSE context with heartbeat support
 * IMPORTANT: Call cleanupSSEContext when done to clear the heartbeat interval
 */
export function createSSEContext(res: Response): SSEContext {
  const ctx: SSEContext = {
    res,
    heartbeatInterval: null,
    eventCounter: 0,
  };

  // Start heartbeat to prevent proxy/CDN from killing idle connections
  ctx.heartbeatInterval = setInterval(() => {
    sendHeartbeat(res);
  }, HEARTBEAT_INTERVAL_MS);

  return ctx;
}

/**
 * Cleanup SSE context - clears heartbeat interval
 * Call this on stream completion, error, or client disconnect
 */
export function cleanupSSEContext(ctx: SSEContext): void {
  if (ctx.heartbeatInterval) {
    clearInterval(ctx.heartbeatInterval);
    ctx.heartbeatInterval = null;
  }
}

/**
 * Parse Last-Event-ID header to determine resume point
 * Returns the day index to resume from (0-indexed), or -1 if starting fresh
 */
export function parseLastEventId(req: Request): number {
  const lastEventId = req.headers["last-event-id"] as string | undefined;
  if (!lastEventId) return -1;

  // Event IDs are formatted as "day-{index}" for day events
  const match = lastEventId.match(/^day-(\d+)$/);
  if (match) {
    return parseInt(match[1], 10);
  }

  return -1;
}

/**
 * Create an abort controller that listens to request close
 */
export function createStreamAbortController(req: Request): StreamAbortController {
  const controller: StreamAbortController = {
    aborted: false,
    abort: () => {
      controller.aborted = true;
    }
  };

  req.on("close", () => {
    if (!controller.aborted) {
      console.log(`[StreamItinerary] Client disconnected, aborting generation`);
      controller.aborted = true;
    }
  });

  return controller;
}

// ============================================================================
// ACTIVITY DEDUPLICATION
// ============================================================================

/**
 * Generate a deterministic key for activity deduplication
 * Format: slug(name)-timeSlot
 */
export function generateActivityKey(activity: ItineraryActivity, destination: string): string {
  const slug = activity.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);

  const hour = parseInt(activity.time?.split(":")[0] || "12", 10);
  const timeSlot = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

  return `${slug}-${timeSlot}`;
}

/**
 * Filter out duplicate activities that appeared in previous days
 */
export function dedupeActivities(
  activities: ItineraryActivity[],
  usedKeys: Set<string>,
  destination: string
): { activities: ItineraryActivity[]; newKeys: string[] } {
  const filtered: ItineraryActivity[] = [];
  const newKeys: string[] = [];

  for (const activity of activities) {
    const key = generateActivityKey(activity, destination);
    activity.activityKey = key;

    if (!usedKeys.has(key)) {
      filtered.push(activity);
      newKeys.push(key);
    } else {
      console.log(`[Dedupe] Filtered duplicate activity: ${activity.name} (key: ${key})`);
    }
  }

  return { activities: filtered, newKeys };
}

// ============================================================================
// COST VERIFICATION (Phase 3 - Trust Badges)
// ============================================================================

export type CostVerificationSource = "rag_knowledge" | "api_estimate" | "ai_estimate" | "user_input";
export type CostConfidence = "high" | "medium" | "low";

export interface CostVerification {
  source: CostVerificationSource;
  confidence: CostConfidence;
  lastVerified?: string;
  citation?: string;
  originalEstimate?: number;
}

/**
 * Annotate activities with cost verification metadata based on validation results
 */
export function annotateWithVerification(
  days: ItineraryDay[],
  budgetVerified: boolean,
  logisticsVerified: boolean
): ItineraryDay[] {
  const confidence: CostConfidence = budgetVerified ? "medium" : "low";

  return days.map(day => ({
    ...day,
    activities: day.activities.map(activity => ({
      ...activity,
      costVerification: activity.costVerification || {
        source: "ai_estimate" as CostVerificationSource,
        confidence,
        lastVerified: new Date().toISOString(),
      },
    })),
  }));
}

// ============================================================================
// GOOGLE PLACES ENRICHMENT
// ============================================================================

/**
 * Enrich activities in a day with real Google Places data (opening hours, ratings, etc.)
 * This runs asynchronously and doesn't block itinerary generation.
 */
export async function enrichDayWithPlaceDetails(
  day: ItineraryDay,
  destination: string
): Promise<ItineraryDay> {
  if (!isGooglePlacesConfigured()) {
    console.log(`[PlacesEnrich] Google Places API not configured, skipping enrichment`);
    return day;
  }

  try {
    // Only enrich activity-type items (not transport or lodging)
    const enrichableActivities = day.activities.filter(
      a => a.type === 'activity' || a.type === 'meal'
    );

    if (enrichableActivities.length === 0) {
      return day;
    }

    // Build batch request
    const batchInput = enrichableActivities.map(activity => ({
      name: activity.name,
      destination,
      coordinates: activity.coordinates.lat !== 0 ? activity.coordinates : undefined,
    }));

    // Fetch place details in batch (with rate limiting built-in)
    const results = await enrichActivitiesBatch(batchInput, {
      maxConcurrent: 2, // Conservative to avoid rate limits
      delayMs: 300,
    });

    // Map results back to activities
    const enrichedActivities = day.activities.map(activity => {
      const key = `${activity.name}-${destination}`;
      const placeData = results.get(key);

      if (placeData) {
        return {
          ...activity,
          placeDetails: {
            placeId: placeData.placeId,
            rating: placeData.rating,
            priceLevel: placeData.priceLevel,
            googleMapsUrl: placeData.googleMapsUrl,
            openingHours: placeData.openingHours ? {
              isOpen: placeData.openingHours.isOpen,
              weekdayText: placeData.openingHours.weekdayText,
            } : undefined,
          },
        };
      }
      return activity;
    });

    console.log(`[PlacesEnrich] Day ${day.day}: Enriched ${results.size}/${enrichableActivities.length} activities with Google Places data`);

    return {
      ...day,
      activities: enrichedActivities,
    };
  } catch (error) {
    console.error(`[PlacesEnrich] Error enriching day ${day.day}:`, error);
    return day; // Return original day on error
  }
}

/**
 * Enrich all days with Google Places data
 * Runs in parallel for efficiency but with rate limiting
 */
export async function enrichAllDaysWithPlaceDetails(
  days: ItineraryDay[],
  destination: string
): Promise<ItineraryDay[]> {
  if (!isGooglePlacesConfigured()) {
    return days;
  }

  const startTime = Date.now();
  console.log(`[PlacesEnrich] Starting enrichment for ${days.length} days`);

  // Process days sequentially to respect rate limits
  const enrichedDays: ItineraryDay[] = [];
  for (const day of days) {
    const enrichedDay = await enrichDayWithPlaceDetails(day, destination);
    enrichedDays.push(enrichedDay);
  }

  const elapsed = Date.now() - startTime;
  console.log(`[PlacesEnrich] Completed enrichment in ${elapsed}ms`);

  return enrichedDays;
}

// ============================================================================
// VALIDATION LOOP CONFIGURATION
// ============================================================================

/**
 * Maximum refinement iterations before accepting imperfect result
 */
const MAX_REFINEMENT_ITERATIONS = 2;

/**
 * Validate itinerary and refine flagged days if needed
 *
 * This is the core of the Director pattern - the "self-healing loop"
 */
export async function validateAndRefineDays(
  res: Response,
  openai: OpenAI,
  model: string,
  input: StreamingItineraryInput,
  days: ItineraryDay[],
  usedActivityKeys: Set<string>,
  abortController?: StreamAbortController,
  onDayComplete?: (day: ItineraryDay, allDays: ItineraryDay[]) => Promise<void>,
  metrics?: StreamMetrics
): Promise<{ days: ItineraryDay[]; validation: CombinedValidationResult; iterations: number }> {
  let currentDays = [...days];
  let iteration = 0;
  let lastValidation: CombinedValidationResult | null = null;
  const allRefinedDays: number[] = [];

  // Build group profile from input
  const groupProfile: GroupProfile = input.groupProfile || {
    hasToddler: false,
    hasElderly: false,
    hasMobilityIssues: false,
    groupSize: input.groupSize || 2,
  };

  while (iteration < MAX_REFINEMENT_ITERATIONS) {
    iteration++;

    // Check abort
    if (abortController?.aborted) {
      console.log(`[Validation] Aborted during validation iteration ${iteration}`);
      break;
    }

    console.log(`[Validation] Running validation iteration ${iteration}...`);

    // Run validators
    const validationResult = await validateItinerary({
      itinerary: currentDays,
      totalBudget: input.budget,
      numDays: input.numDays,
      groupProfile,
    });

    lastValidation = validationResult;

    // Send validation event to client
    sendSSE(res, {
      event: "validation",
      data: {
        iteration,
        status: validationResult.status,
        budgetVerified: validationResult.metadata.budgetVerified,
        logisticsVerified: validationResult.metadata.logisticsVerified,
        flaggedDays: validationResult.flaggedDays,
        logs: validationResult.logs.slice(-5), // Last 5 log lines
      }
    }, `validation-${iteration}`);

    // If approved, we're done
    if (validationResult.status === "APPROVED") {
      console.log(`[Validation] APPROVED on iteration ${iteration}`);
      break;
    }

    // If this is the last iteration, accept the imperfect result
    if (iteration >= MAX_REFINEMENT_ITERATIONS) {
      console.log(`[Validation] Max iterations (${MAX_REFINEMENT_ITERATIONS}) reached, accepting ${validationResult.status}`);
      break;
    }

    // Build refinement prompt
    const refinementFeedback = buildRefinementPrompt(validationResult, iteration);
    const daysToRefine = validationResult.flaggedDays;

    if (daysToRefine.length === 0) {
      console.log(`[Validation] Status is ${validationResult.status} but no flagged days, breaking`);
      break;
    }

    console.log(`[Validation] Refining days: ${daysToRefine.join(", ")}`);
    allRefinedDays.push(...daysToRefine);

    // Send refinement event to client
    sendSSE(res, {
      event: "refinement",
      data: {
        iteration,
        daysToRefine,
        budgetIssues: validationResult.budget.suggestions,
        logisticsIssues: validationResult.logistics.suggestions,
      }
    }, `refinement-${iteration}`);

    // Regenerate flagged days with feedback
    for (const dayNum of daysToRefine) {
      if (abortController?.aborted) break;

      const dayIndex = dayNum - 1; // Day numbers are 1-indexed

      // Build context from other days
      const otherDays = currentDays.filter(d => d.day !== dayNum);
      const previousDaysSummary = otherDays.map(d => summarizeDay(d));

      // Generate refined day with feedback
      const refinedDay = await generateRefinedDay(
        openai,
        model,
        input,
        dayIndex,
        previousDaysSummary,
        usedActivityKeys,
        refinementFeedback,
        validationResult,
        abortController,
        metrics
      );

      if (refinedDay && !abortController?.aborted) {
        // Replace the day in our array
        const existingIndex = currentDays.findIndex(d => d.day === dayNum);
        if (existingIndex >= 0) {
          currentDays[existingIndex] = refinedDay;
        }

        // Persist refined day
        if (onDayComplete) {
          try {
            await onDayComplete(refinedDay, currentDays);
          } catch (e) {
            console.error(`[Validation] Failed to persist refined day ${dayNum}:`, e);
          }
        }

        // Send refined day to client
        sendSSE(res, {
          event: "day",
          data: {
            dayIndex,
            day: refinedDay,
            refined: true,
            iteration,
          }
        }, `day-${dayIndex}-r${iteration}`);
      }
    }
  }

  // Return final result
  return {
    days: currentDays,
    validation: lastValidation || await validateItinerary({
      itinerary: currentDays,
      totalBudget: input.budget,
      numDays: input.numDays,
      groupProfile,
    }),
    iterations: iteration,
  };
}

/**
 * Generate a refined day based on validation feedback
 */
async function generateRefinedDay(
  openai: OpenAI,
  model: string,
  input: StreamingItineraryInput,
  dayIndex: number,
  previousDaysSummary: string[],
  usedActivityKeys: Set<string>,
  refinementFeedback: string,
  validationResult: CombinedValidationResult,
  abortController?: StreamAbortController,
  metrics?: StreamMetrics
): Promise<ItineraryDay | null> {
  if (abortController?.aborted) return null;

  const dayDate = new Date(input.startDate);
  dayDate.setDate(dayDate.getDate() + dayIndex);
  const dateStr = dayDate.toISOString().split("T")[0];
  const dayNum = dayIndex + 1;

  // Find specific issues for this day
  const dayBudget = validationResult.budget.perDayBreakdown.find(d => d.day === dayNum);
  const dayLogistics = validationResult.logistics.perDayLogistics.find(d => d.day === dayNum);

  const budgetIssue = dayBudget?.status === "OVER_BUDGET"
    ? `Day ${dayNum} costs $${dayBudget.actual.toFixed(0)} but should be ≤$${dayBudget.allocated.toFixed(0)}. REDUCE costs by $${dayBudget.delta.toFixed(0)}.`
    : "";

  const logisticsIssues = dayLogistics?.conflicts
    .filter(c => c.severity === "error")
    .map(c => c.issue)
    .join(" ") || "";

  const previousContext = previousDaysSummary.length > 0
    ? `\nOTHER DAYS (DO NOT REPEAT):\n${previousDaysSummary.join("\n")}`
    : "";

  const prompt = `REFINEMENT REQUEST: Regenerate Day ${dayNum} fixing the issues below.

DATE: ${dateStr}
DESTINATION: ${input.destination}
STYLE: ${input.travelStyle || "standard"}
DAILY BUDGET: ~$${Math.round(input.budget / input.numDays)}
TRAVELERS: ${input.groupSize}
${previousContext}

ISSUES TO FIX:
${budgetIssue}
${logisticsIssues}

REFINEMENT INSTRUCTIONS:
${refinementFeedback}

REQUIREMENTS:
1. Fix ALL issues mentioned above
2. Keep activities realistic and properly spaced (minimum 1 hour between activities)
3. ALL costs must be realistic (use free alternatives if over budget)
4. Ensure morning activities are before afternoon, afternoon before evening
5. Include realistic transit time between locations

Return JSON ONLY:
{
  "day": ${dayNum},
  "date": "${dateStr}",
  "title": "Creative title",
  "activities": [
    {
      "time": "09:00",
      "name": "Specific Place",
      "description": "Brief description",
      "type": "activity|meal|transport|lodging",
      "estimatedCost": 20,
      "duration": "2 hours",
      "location": "Location",
      "coordinates": {"lat": 0.0, "lng": 0.0},
      "transportMode": "walk|metro|taxi|bus"
    }
  ],
  "localFood": []
}`;

  if (abortController?.aborted) return null;

  if (metrics) {
    metrics.aiCalls++;
  }

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: `You are a travel expert FIXING an itinerary based on validation feedback. The previous version had budget or logistics issues. Return valid JSON only.`
        },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3, // Lower temperature for more focused refinement
      max_tokens: 1500,
    });

    if (abortController?.aborted) return null;

    const content = response.choices[0].message.content || "{}";
    const parsed = JSON.parse(content);

    let activities: ItineraryActivity[] = (parsed.activities || []).map((a: any) => ({
      time: a.time || "09:00",
      name: a.name || "Activity",
      description: a.description || a.name || "Activity",
      type: a.type || "activity",
      estimatedCost: a.estimatedCost ?? 20,
      duration: a.duration || "2 hours",
      location: a.location || a.name,
      coordinates: {
        lat: a.coordinates?.lat || 0,
        lng: a.coordinates?.lng || 0
      },
      transportMode: a.transportMode
    }));

    // Deduplicate
    const { activities: dedupedActivities, newKeys } = dedupeActivities(
      activities,
      usedActivityKeys,
      input.destination
    );
    newKeys.forEach(key => usedActivityKeys.add(key));

    console.log(`[Validation] Refined Day ${dayNum}: ${dedupedActivities.length} activities, $${dedupedActivities.reduce((s, a) => s + (a.estimatedCost || 0), 0)} total`);

    return {
      day: parsed.day || dayNum,
      date: parsed.date || dateStr,
      title: parsed.title || `Day ${dayNum} (Refined)`,
      activities: dedupedActivities,
      localFood: parsed.localFood || []
    };
  } catch (e) {
    console.error(`[Validation] Error refining day ${dayNum}:`, e);
    if (metrics) {
      metrics.recoverableErrors++;
    }
    return null;
  }
}

// ============================================================================
// DAY GENERATION
// ============================================================================

/**
 * Generate a single day of the itinerary
 * Returns null if aborted
 */
export async function generateSingleDay(
  openai: OpenAI,
  model: string,
  input: StreamingItineraryInput,
  dayIndex: number,
  previousDaysSummary: string[],
  usedActivityKeys: Set<string>,
  abortController?: StreamAbortController,
  metrics?: StreamMetrics
): Promise<ItineraryDay | null> {
  // Check abort before starting
  if (abortController?.aborted) {
    console.log(`[StreamDay] Aborted before generating day ${dayIndex + 1}`);
    return null;
  }

  const isFirstDay = dayIndex === 0;
  const isLastDay = dayIndex === input.numDays - 1;

  const dayDate = new Date(input.startDate);
  dayDate.setDate(dayDate.getDate() + dayIndex);
  const dateStr = dayDate.toISOString().split("T")[0];

  // Build context from previous days to avoid repetition
  const previousContext = previousDaysSummary.length > 0
    ? `\nPREVIOUS DAYS (DO NOT REPEAT these activities):\n${previousDaysSummary.join("\n")}`
    : "";

  const dayType = isFirstDay
    ? "ARRIVAL DAY - lighter schedule, include hotel check-in, traveler is tired from journey"
    : isLastDay
    ? "DEPARTURE DAY - include hotel check-out, allow time for packing and airport transfer"
    : `MID-TRIP DAY ${dayIndex + 1} - full exploration, 3-4 activities`;

  const prompt = `Generate Day ${dayIndex + 1} of a ${input.numDays}-day ${input.destination} itinerary.

DATE: ${dateStr}
DAY TYPE: ${dayType}
STYLE: ${input.travelStyle || "standard"}
BUDGET: ${input.currency} ${input.budget} total trip (so daily ~${Math.round(input.budget / input.numDays)})
TRAVELERS: ${input.groupSize}
${previousContext}

REQUIREMENTS:
1. Use REAL place names, not generic descriptions
2. Include realistic GPS coordinates for ${input.destination}
3. estimatedCost in USD (NEVER 0 for paid attractions)
4. ${isFirstDay ? "Include lodging type activity for hotel check-in" : ""}
5. ${isLastDay ? "Include lodging type activity for hotel check-out" : ""}
6. 3-4 activities maximum - quality over quantity
7. Creative day title (e.g., "Habsburg Splendor", "Hidden Gems & Local Flavors")
8. DO NOT repeat any activity names from previous days

Return JSON ONLY:
{
  "day": ${dayIndex + 1},
  "date": "${dateStr}",
  "title": "Creative evocative title",
  "activities": [
    {
      "time": "09:00",
      "name": "Specific Place Name",
      "description": "Brief 2-5 word description",
      "type": "activity|meal|transport|lodging",
      "estimatedCost": 20,
      "duration": "2 hours",
      "location": "Specific location",
      "coordinates": {"lat": 0.0, "lng": 0.0},
      "transportMode": "walk|metro|taxi|bus"
    }
  ],
  "localFood": [
    {
      "name": "Restaurant Name",
      "cuisine": "Type of food",
      "priceRange": "$|$$|$$$",
      "estimatedCost": 15,
      "mustTry": "Signature dish"
    }
  ]
}`;

  // Check abort before AI call
  if (abortController?.aborted) {
    console.log(`[StreamDay] Aborted before AI call for day ${dayIndex + 1}`);
    return null;
  }

  // Increment AI call counter for metrics tracking
  if (metrics) {
    metrics.aiCalls++;
  }

  const response = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `You are a travel expert creating a day-by-day itinerary for ${input.destination}. Return valid JSON only, no markdown.`
      },
      { role: "user", content: prompt }
    ],
    response_format: { type: "json_object" },
    temperature: 0.4,
    max_tokens: 1500,
  });

  // Check abort after AI call
  if (abortController?.aborted) {
    console.log(`[StreamDay] Aborted after AI call for day ${dayIndex + 1}`);
    return null;
  }

  const content = response.choices[0].message.content || "{}";

  try {
    const parsed = JSON.parse(content);

    // Parse activities
    let activities: ItineraryActivity[] = (parsed.activities || []).map((a: any) => ({
      time: a.time || "09:00",
      name: a.name || "Activity",
      description: a.description || a.name || "Activity",
      type: a.type || "activity",
      estimatedCost: a.estimatedCost ?? 20,
      duration: a.duration || "2 hours",
      location: a.location || a.name,
      coordinates: {
        lat: a.coordinates?.lat || 0,
        lng: a.coordinates?.lng || 0
      },
      transportMode: a.transportMode
    }));

    // Deduplicate activities
    const { activities: dedupedActivities, newKeys } = dedupeActivities(
      activities,
      usedActivityKeys,
      input.destination
    );

    // Add new keys to the set
    newKeys.forEach(key => usedActivityKeys.add(key));

    // Ensure required fields
    return {
      day: parsed.day || dayIndex + 1,
      date: parsed.date || dateStr,
      title: parsed.title || `Day ${dayIndex + 1}`,
      activities: dedupedActivities,
      localFood: parsed.localFood || []
    };
  } catch (e) {
    console.error(`[StreamDay] Parse error for day ${dayIndex + 1}:`, e);
    // Return minimal valid day
    return {
      day: dayIndex + 1,
      date: dateStr,
      title: `Day ${dayIndex + 1}`,
      activities: [],
      localFood: []
    };
  }
}

/**
 * Summarize a day for context in subsequent days (prevents repetition)
 */
export function summarizeDay(day: ItineraryDay): string {
  const activities = day.activities.map(a => a.name).join(", ");
  return `Day ${day.day}: ${activities}`;
}

// ============================================================================
// STREAMING GENERATOR
// ============================================================================

/**
 * Stream itinerary generation day-by-day via SSE
 *
 * @param res Express response object (SSE stream)
 * @param openai OpenAI client instance
 * @param model Model to use (e.g., "deepseek-chat")
 * @param input Trip input parameters
 * @param abortController Optional controller to abort on disconnect
 * @param onDayComplete Optional callback when a day is completed (for DB persistence)
 * @param metrics Optional metrics object for observability tracking
 */
export async function streamItineraryGeneration(
  res: Response,
  openai: OpenAI,
  model: string,
  input: StreamingItineraryInput,
  abortController?: StreamAbortController,
  onDayComplete?: (day: ItineraryDay, allDays: ItineraryDay[]) => Promise<void>,
  metrics?: StreamMetrics
): Promise<ItineraryDay[]> {
  const startTime = Date.now();
  const days: ItineraryDay[] = [];
  const previousDaysSummary: string[] = [];
  const usedActivityKeys = new Set<string>();

  // Initialize metrics if provided
  if (metrics) {
    metrics.totalDays = input.numDays;
  }

  console.log(`[StreamItinerary] Starting ${input.numDays}-day generation for ${input.destination}`);

  // Check maxDays budget upfront
  const initialBudgetCheck = metrics
    ? checkBudgetExceeded(metrics, startTime, input.numDays)
    : { exceeded: false, type: null, limit: 0, actual: 0 };

  if (initialBudgetCheck.exceeded) {
    console.log(`[StreamItinerary] Budget exceeded before start: ${initialBudgetCheck.type} (${initialBudgetCheck.actual}/${initialBudgetCheck.limit})`);
    if (metrics) {
      metrics.status = "budget_exceeded";
      metrics.budgetExceeded = {
        type: initialBudgetCheck.type,
        limit: initialBudgetCheck.limit,
        actual: initialBudgetCheck.actual,
      };
      metrics.totalMs = Date.now() - startTime;
    }
    sendSSE(res, {
      event: "error",
      data: {
        message: `Generation budget exceeded: max ${GENERATION_BUDGETS.maxDays} days allowed`,
        recoverable: false,
        budgetType: initialBudgetCheck.type,
      }
    }, "error-0");
    return [];
  }

  // Send meta event with ID for resume support
  sendSSE(res, {
    event: "meta",
    data: {
      tripId: input.tripId,
      destination: input.destination,
      totalDays: input.numDays,
      startDate: input.startDate
    }
  }, "meta-0");

  // Generate each day
  for (let i = 0; i < input.numDays; i++) {
    // Check abort at start of each iteration
    if (abortController?.aborted) {
      console.log(`[StreamItinerary] Aborted at day ${i + 1}, stopping generation`);
      if (metrics) {
        metrics.status = "abort";
      }
      sendSSE(res, {
        event: "error",
        data: {
          message: "Generation cancelled - client disconnected",
          recoverable: true,
          partialDays: days.length
        }
      });
      break;
    }

    // Check time and calls budgets before each day
    if (metrics) {
      const budgetCheck = checkBudgetExceeded(metrics, startTime, input.numDays);
      if (budgetCheck.exceeded) {
        console.log(`[StreamItinerary] Budget exceeded at day ${i + 1}: ${budgetCheck.type} (${budgetCheck.actual}/${budgetCheck.limit})`);
        metrics.status = "budget_exceeded";
        metrics.budgetExceeded = {
          type: budgetCheck.type,
          limit: budgetCheck.limit,
          actual: budgetCheck.actual,
        };
        sendSSE(res, {
          event: "error",
          data: {
            message: `Generation budget exceeded: ${budgetCheck.type}`,
            recoverable: false,
            budgetType: budgetCheck.type,
            partialDays: days.length,
          }
        }, "error-budget");
        break;
      }
    }

    try {
      // Send progress (with ID for completeness, though less critical for resume)
      sendSSE(res, {
        event: "progress",
        data: {
          currentDay: i + 1,
          totalDays: input.numDays,
          percent: Math.round((i / input.numDays) * 100),
          message: `Generating Day ${i + 1}...`
        }
      }, `progress-${i}`);

      const dayStartTime = Date.now();

      // Generate single day (may return null if aborted)
      const day = await generateSingleDay(
        openai,
        model,
        input,
        i,
        previousDaysSummary,
        usedActivityKeys,
        abortController,
        metrics
      );

      // Check if aborted during generation
      if (!day || abortController?.aborted) {
        console.log(`[StreamItinerary] Day ${i + 1} generation cancelled`);
        break;
      }

      const dayGenTime = Date.now() - dayStartTime;
      console.log(`[StreamItinerary] Day ${i + 1} generated in ${dayGenTime}ms (${day.activities.length} activities)`);

      days.push(day);
      previousDaysSummary.push(summarizeDay(day));

      // Update metrics
      if (metrics) {
        metrics.generatedDays++;
        // Record time to first day
        if (i === 0 && metrics.timeToFirstDayMs === null) {
          metrics.timeToFirstDayMs = Date.now() - startTime;
        }
      }

      // Persist to DB FIRST (atomic) - only then emit event
      if (onDayComplete) {
        try {
          await onDayComplete(day, days);
        } catch (persistError) {
          console.error(`[StreamItinerary] Failed to persist day ${i + 1}:`, persistError);
          // Continue anyway - day was generated successfully
        }
      }

      // Send day event AFTER persistence (with ID for Last-Event-ID resume)
      sendSSE(res, {
        event: "day",
        data: {
          dayIndex: i,
          day
        }
      }, `day-${i}`);

    } catch (error) {
      console.error(`[StreamItinerary] Error generating day ${i + 1}:`, error);

      // Track recoverable errors
      if (metrics) {
        metrics.recoverableErrors++;
      }

      // Send error but continue with remaining days
      sendSSE(res, {
        event: "error",
        data: {
          dayIndex: i,
          message: `Failed to generate Day ${i + 1}`,
          recoverable: true
        }
      });
    }
  }

  let totalActivities = days.reduce((sum, d) => sum + d.activities.length, 0);
  console.log(`[StreamItinerary] Generation phase complete: ${days.length} days, ${totalActivities} activities`);

  // ============================================================================
  // VALIDATION LOOP (Director Pattern)
  // ============================================================================
  let validationResult: CombinedValidationResult | null = null;
  let validationIterations = 0;
  let refinedDays: number[] = [];

  // Run validation if enabled and we have days to validate
  const enableValidation = input.enableValidation !== false;
  if (enableValidation && days.length > 0 && !abortController?.aborted) {
    console.log(`[StreamItinerary] Starting validation loop...`);

    try {
      const validationStartTime = Date.now();

      const result = await validateAndRefineDays(
        res,
        openai,
        model,
        input,
        days,
        usedActivityKeys,
        abortController,
        onDayComplete,
        metrics
      );

      // Update days with refined versions
      days.length = 0;
      days.push(...result.days);
      validationResult = result.validation;
      validationIterations = result.iterations;

      // Track which days were refined
      if (result.validation.flaggedDays.length > 0 && result.iterations > 1) {
        refinedDays = result.validation.flaggedDays;
      }

      const validationTime = Date.now() - validationStartTime;
      console.log(`[StreamItinerary] Validation complete in ${validationTime}ms: ${validationResult.status}`);

      // Annotate activities with verification metadata (Phase 3 - Trust Badges)
      const annotatedDays = annotateWithVerification(
        days,
        validationResult.metadata.budgetVerified,
        validationResult.metadata.logisticsVerified
      );
      days.length = 0;
      days.push(...annotatedDays);
      console.log(`[StreamItinerary] Activities annotated with verification metadata (confidence: ${validationResult.metadata.budgetVerified ? 'medium' : 'low'})`);

    } catch (error) {
      console.error(`[StreamItinerary] Validation loop error:`, error);
      if (metrics) {
        metrics.recoverableErrors++;
      }
    }
  }

  // ============================================================================
  // RAG COST VERIFICATION (Phase 4 - Director Pattern Enhancement)
  // ============================================================================
  let ragVerificationStats: ValidationMetadata["ragVerification"] | undefined;
  let visaCostResult: VisaCostVerificationResult | undefined;

  const enableRagVerification = input.enableRagVerification !== false;
  if (enableRagVerification && days.length > 0 && !abortController?.aborted) {
    console.log(`[StreamItinerary] Starting RAG cost verification...`);

    try {
      // Check if RAG verification is available (has pricing data in knowledge base)
      const ragAvailable = await isRagVerificationAvailable();

      if (ragAvailable) {
        const ragStartTime = Date.now();

        // Enhance activities with RAG-verified costs
        const enhancedDays = await enhanceWithRagVerification(days, input.destination);

        // Count verification results
        let verified = 0;
        let unverified = 0;
        for (const day of enhancedDays) {
          for (const activity of day.activities) {
            if (activity.costVerification?.source === "rag_knowledge") {
              verified++;
            } else {
              unverified++;
            }
          }
        }

        // Update days with enhanced verification
        days.length = 0;
        days.push(...enhancedDays);

        const ragTime = Date.now() - ragStartTime;
        console.log(`[StreamItinerary] RAG verification complete in ${ragTime}ms: ${verified} verified, ${unverified} unverified`);

        ragVerificationStats = {
          enabled: true,
          activitiesVerified: verified,
          activitiesUnverified: unverified,
        };
      } else {
        console.log(`[StreamItinerary] RAG verification skipped - no pricing data in knowledge base`);
        ragVerificationStats = { enabled: false, activitiesVerified: 0, activitiesUnverified: 0 };
      }

      // Verify visa cost if passport is provided
      if (input.passport && input.destination) {
        console.log(`[StreamItinerary] Verifying visa cost for ${input.passport} → ${input.destination}...`);
        visaCostResult = await getVisaCostForTrip(
          input.passport,
          input.destination,
          input.visaDetails
        );

        if (ragVerificationStats) {
          ragVerificationStats.visaCostVerified = visaCostResult.confidence !== "low";
          ragVerificationStats.visaCost = visaCostResult.verifiedCost;
          ragVerificationStats.visaCostSource = visaCostResult.source;
          ragVerificationStats.visaCostCitation = visaCostResult.citation;
        }

        console.log(`[StreamItinerary] Visa cost: $${visaCostResult.verifiedCost} (${visaCostResult.confidence} confidence from ${visaCostResult.source})`);
      }

    } catch (error) {
      console.error(`[StreamItinerary] RAG verification error:`, error);
      ragVerificationStats = { enabled: false, activitiesVerified: 0, activitiesUnverified: 0 };
      if (metrics) {
        metrics.recoverableErrors++;
      }
    }
  }

  // Recalculate totals after potential refinement
  const totalTime = Date.now() - startTime;
  totalActivities = days.reduce((sum, d) => sum + d.activities.length, 0);

  console.log(`[StreamItinerary] Complete: ${days.length} days, ${totalActivities} activities in ${totalTime}ms`);

  // Finalize metrics
  if (metrics) {
    metrics.totalMs = totalTime;
    // Only mark complete if we successfully generated all days
    if (metrics.status !== "abort" && metrics.status !== "budget_exceeded" && metrics.status !== "error") {
      metrics.status = days.length >= input.numDays ? "complete" : "error";
    }
  }

  // Build validation metadata for done event
  const validationMetadata: ValidationMetadata | null = validationResult ? {
    budgetVerified: validationResult.metadata.budgetVerified,
    logisticsVerified: validationResult.metadata.logisticsVerified,
    totalIterations: validationIterations,
    refinedDays,
    logs: validationResult.logs.slice(-10), // Last 10 log entries
    ragVerification: ragVerificationStats,
  } : null;

  // Send done event (even if partial) with ID for resume support
  if (!abortController?.aborted) {
    sendSSE(res, {
      event: "done",
      data: {
        tripId: input.tripId,
        totalDays: days.length,
        totalActivities,
        generationTimeMs: totalTime,
        itinerary: { days },
        complete: days.length >= input.numDays,
        validation: validationMetadata,
      }
    }, "done-0");
  }

  return days;
}

// ============================================================================
// RESUME SUPPORT
// ============================================================================

/**
 * Resume streaming from partially generated itinerary
 * Emits already-generated days, then continues generating remaining
 */
export async function resumeItineraryStream(
  res: Response,
  openai: OpenAI,
  model: string,
  input: StreamingItineraryInput,
  existingDays: ItineraryDay[],
  abortController?: StreamAbortController,
  onDayComplete?: (day: ItineraryDay, allDays: ItineraryDay[]) => Promise<void>,
  metrics?: StreamMetrics
): Promise<ItineraryDay[]> {
  const startTime = Date.now();
  console.log(`[StreamItinerary] Resuming from day ${existingDays.length + 1}`);

  // Initialize metrics for resume
  if (metrics) {
    metrics.totalDays = input.numDays;
    metrics.cachedDays = existingDays.length;
  }

  // Build used activity keys from existing days
  const usedActivityKeys = new Set<string>();
  for (const day of existingDays) {
    for (const activity of day.activities) {
      const key = activity.activityKey || generateActivityKey(activity, input.destination);
      usedActivityKeys.add(key);
    }
  }

  // Send meta with ID for resume support
  sendSSE(res, {
    event: "meta",
    data: {
      tripId: input.tripId,
      destination: input.destination,
      totalDays: input.numDays,
      startDate: input.startDate,
      resumedFrom: existingDays.length
    }
  }, "meta-0");

  // Emit existing days immediately with IDs
  for (let i = 0; i < existingDays.length; i++) {
    sendSSE(res, {
      event: "day",
      data: {
        dayIndex: i,
        day: existingDays[i],
        cached: true
      }
    }, `day-${i}`);
  }

  // Build summary of existing days
  const previousDaysSummary = existingDays.map(summarizeDay);
  const days = [...existingDays];

  // Generate remaining days
  for (let i = existingDays.length; i < input.numDays; i++) {
    // Check abort
    if (abortController?.aborted) {
      console.log(`[StreamItinerary] Resume aborted at day ${i + 1}`);
      if (metrics) {
        metrics.status = "abort";
      }
      break;
    }

    // Check budgets
    if (metrics) {
      const budgetCheck = checkBudgetExceeded(metrics, startTime, input.numDays);
      if (budgetCheck.exceeded) {
        console.log(`[StreamItinerary] Budget exceeded at resumed day ${i + 1}: ${budgetCheck.type}`);
        metrics.status = "budget_exceeded";
        metrics.budgetExceeded = {
          type: budgetCheck.type,
          limit: budgetCheck.limit,
          actual: budgetCheck.actual,
        };
        sendSSE(res, {
          event: "error",
          data: {
            message: `Generation budget exceeded: ${budgetCheck.type}`,
            recoverable: false,
            budgetType: budgetCheck.type,
            partialDays: days.length,
          }
        }, "error-budget");
        break;
      }
    }

    try {
      sendSSE(res, {
        event: "progress",
        data: {
          currentDay: i + 1,
          totalDays: input.numDays,
          percent: Math.round((i / input.numDays) * 100),
          message: `Generating Day ${i + 1}...`
        }
      }, `progress-${i}`);

      const day = await generateSingleDay(
        openai,
        model,
        input,
        i,
        previousDaysSummary,
        usedActivityKeys,
        abortController,
        metrics
      );

      if (!day || abortController?.aborted) {
        break;
      }

      days.push(day);
      previousDaysSummary.push(summarizeDay(day));

      // Update metrics
      if (metrics) {
        metrics.generatedDays++;
        // Time to first day (after cache) is when we generate the first NEW day
        if (i === existingDays.length && metrics.timeToFirstDayMs === null) {
          metrics.timeToFirstDayMs = Date.now() - startTime;
        }
      }

      // Persist first
      if (onDayComplete) {
        try {
          await onDayComplete(day, days);
        } catch (e) {
          console.error(`[StreamItinerary] Failed to persist resumed day ${i + 1}:`, e);
        }
      }

      // Then emit with ID for Last-Event-ID resume support
      sendSSE(res, {
        event: "day",
        data: { dayIndex: i, day }
      }, `day-${i}`);

    } catch (error) {
      console.error(`[StreamItinerary] Resume error day ${i + 1}:`, error);
      if (metrics) {
        metrics.recoverableErrors++;
      }
      sendSSE(res, {
        event: "error",
        data: { dayIndex: i, message: `Failed to generate Day ${i + 1}`, recoverable: true }
      });
    }
  }

  // ============================================================================
  // VALIDATION LOOP (Director Pattern)
  // ============================================================================
  let validationResult: CombinedValidationResult | null = null;
  let validationIterations = 0;
  let refinedDays: number[] = [];

  // Run validation if enabled and we have days to validate
  const enableValidation = input.enableValidation !== false;
  if (enableValidation && days.length > 0 && !abortController?.aborted) {
    console.log(`[StreamItinerary] Resume: Starting validation loop...`);

    try {
      const validationStartTime = Date.now();

      const result = await validateAndRefineDays(
        res,
        openai,
        model,
        input,
        days,
        usedActivityKeys,
        abortController,
        onDayComplete,
        metrics
      );

      // Update days with refined versions
      days.length = 0;
      days.push(...result.days);
      validationResult = result.validation;
      validationIterations = result.iterations;

      // Track which days were refined
      if (result.validation.flaggedDays.length > 0 && result.iterations > 1) {
        refinedDays = result.validation.flaggedDays;
      }

      const validationTime = Date.now() - validationStartTime;
      console.log(`[StreamItinerary] Resume: Validation complete in ${validationTime}ms: ${validationResult.status}`);

      // Annotate activities with verification metadata (Phase 3 - Trust Badges)
      const annotatedDays = annotateWithVerification(
        days,
        validationResult.metadata.budgetVerified,
        validationResult.metadata.logisticsVerified
      );
      days.length = 0;
      days.push(...annotatedDays);

    } catch (error) {
      console.error(`[StreamItinerary] Resume: Validation loop error:`, error);
      if (metrics) {
        metrics.recoverableErrors++;
      }
    }
  }

  // ============================================================================
  // RAG COST VERIFICATION (Phase 4 - Resume)
  // ============================================================================
  let ragVerificationStats: ValidationMetadata["ragVerification"] | undefined;
  let visaCostResult: VisaCostVerificationResult | undefined;

  const enableRagVerification = input.enableRagVerification !== false;
  if (enableRagVerification && days.length > 0 && !abortController?.aborted) {
    console.log(`[StreamItinerary] Resume: Starting RAG cost verification...`);

    try {
      const ragAvailable = await isRagVerificationAvailable();

      if (ragAvailable) {
        const enhancedDays = await enhanceWithRagVerification(days, input.destination);

        let verified = 0;
        let unverified = 0;
        for (const day of enhancedDays) {
          for (const activity of day.activities) {
            if (activity.costVerification?.source === "rag_knowledge") {
              verified++;
            } else {
              unverified++;
            }
          }
        }

        days.length = 0;
        days.push(...enhancedDays);

        ragVerificationStats = {
          enabled: true,
          activitiesVerified: verified,
          activitiesUnverified: unverified,
        };
      } else {
        ragVerificationStats = { enabled: false, activitiesVerified: 0, activitiesUnverified: 0 };
      }

      // Verify visa cost if passport is provided
      if (input.passport && input.destination) {
        visaCostResult = await getVisaCostForTrip(
          input.passport,
          input.destination,
          input.visaDetails
        );

        if (ragVerificationStats) {
          ragVerificationStats.visaCostVerified = visaCostResult.confidence !== "low";
          ragVerificationStats.visaCost = visaCostResult.verifiedCost;
          ragVerificationStats.visaCostSource = visaCostResult.source;
          ragVerificationStats.visaCostCitation = visaCostResult.citation;
        }

        console.log(`[StreamItinerary] Resume: Visa cost: $${visaCostResult.verifiedCost} (${visaCostResult.source})`);
      }

    } catch (error) {
      console.error(`[StreamItinerary] Resume: RAG verification error:`, error);
      ragVerificationStats = { enabled: false, activitiesVerified: 0, activitiesUnverified: 0 };
    }
  }

  const totalTime = Date.now() - startTime;
  const totalActivities = days.reduce((sum, d) => sum + d.activities.length, 0);

  // Finalize metrics
  if (metrics) {
    metrics.totalMs = totalTime;
    if (metrics.status !== "abort" && metrics.status !== "budget_exceeded" && metrics.status !== "error") {
      metrics.status = days.length >= input.numDays ? "complete" : "error";
    }
  }

  // Build validation metadata for done event
  const validationMetadata: ValidationMetadata | null = validationResult ? {
    budgetVerified: validationResult.metadata.budgetVerified,
    logisticsVerified: validationResult.metadata.logisticsVerified,
    totalIterations: validationIterations,
    refinedDays,
    logs: validationResult.logs.slice(-10), // Last 10 log entries
    ragVerification: ragVerificationStats,
  } : null;

  // Done with ID for resume support
  if (!abortController?.aborted) {
    sendSSE(res, {
      event: "done",
      data: {
        tripId: input.tripId,
        totalDays: days.length,
        totalActivities,
        itinerary: { days },
        complete: days.length >= input.numDays,
        validation: validationMetadata,
      }
    }, "done-0");
  }

  return days;
}

// ============================================================================
// CHECK IF STREAMING IS ENABLED
// ============================================================================

/**
 * Check if streaming should be used for this request
 * Enabled by: ?stream=1 query param OR STREAMING_ITINERARY_ENABLED env var
 */
export function shouldUseStreaming(req: Request): boolean {
  // Query param override
  if (req.query.stream === "1") return true;
  if (req.query.stream === "0") return false;

  // Environment flag
  return STREAMING_ENABLED;
}
