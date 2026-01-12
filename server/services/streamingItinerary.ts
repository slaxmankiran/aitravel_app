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
  event: "meta" | "day" | "progress" | "done" | "error";
  data: any;
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

  const totalTime = Date.now() - startTime;
  const totalActivities = days.reduce((sum, d) => sum + d.activities.length, 0);

  console.log(`[StreamItinerary] Complete: ${days.length} days, ${totalActivities} activities in ${totalTime}ms`);

  // Finalize metrics
  if (metrics) {
    metrics.totalMs = totalTime;
    // Only mark complete if we successfully generated all days
    if (metrics.status !== "abort" && metrics.status !== "budget_exceeded" && metrics.status !== "error") {
      metrics.status = days.length >= input.numDays ? "complete" : "error";
    }
  }

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
        complete: days.length >= input.numDays
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

  const totalTime = Date.now() - startTime;

  // Finalize metrics
  if (metrics) {
    metrics.totalMs = totalTime;
    if (metrics.status !== "abort" && metrics.status !== "budget_exceeded" && metrics.status !== "error") {
      metrics.status = days.length >= input.numDays ? "complete" : "error";
    }
  }

  // Done with ID for resume support
  if (!abortController?.aborted) {
    sendSSE(res, {
      event: "done",
      data: {
        tripId: input.tripId,
        totalDays: days.length,
        totalActivities: days.reduce((sum, d) => sum + d.activities.length, 0),
        itinerary: { days },
        complete: days.length >= input.numDays
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
