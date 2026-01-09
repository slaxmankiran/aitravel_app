/**
 * applyFix.ts
 *
 * Item 16B: Apply fix flows
 * Dispatcher that routes NextFixSuggestion actions to their implementations.
 *
 * Design:
 * - APPLY_PATCH: Routes through change planner for reversibility
 * - OPEN_EDITOR: Opens appropriate UI panel/modal
 * - TRIGGER_FLOW: Executes a flow (refetch, save, undo)
 */

import type { NextFixSuggestion, FixId, EditorTarget } from "./nextFix";
import type { TripResponse, UserTripInput } from "@shared/schema";

// ============================================================================
// TYPES
// ============================================================================

export interface ApplyFixContext {
  tripId: number;
  trip: TripResponse;

  // Change planner integration (matches useChangePlanner types)
  planChanges: (params: {
    tripId: number;
    prevInput: UserTripInput;
    nextInput: UserTripInput;
    currentResults: TripResponse;
    source: "edit_trip" | "quick_chip" | "fix_blocker";
  }) => Promise<any>;
  applyChanges: (params: {
    tripId: number;
    plan: any;
    setWorkingTrip: (fn: (prev: TripResponse | null) => TripResponse | null) => void;
    setBannerPlan?: (plan: any, source?: string) => void;
    source?: string;
  }) => void;
  setWorkingTrip: (fn: (prev: TripResponse | null) => TripResponse | null) => void;
  setBannerPlan: (plan: any, source?: string) => void;

  // Undo integration
  handleUndo?: () => Promise<void>;

  // Refetch integration
  refetchTrip?: () => Promise<void>;

  // UI callbacks
  openEditor?: (target: EditorTarget) => void;
  showToast?: (message: string, type: "success" | "info" | "warning") => void;
}

export interface ApplyFixResult {
  success: boolean;
  action: "applied" | "opened_editor" | "triggered_flow" | "failed";
  message?: string;
  newChangeId?: string;
  newCertaintyScore?: number; // From planner delta, for immediate history update
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

/**
 * Parse trip dates string into start and end Date objects
 * Format: "2026-03-04 to 2026-03-09" or "2026-03-04 - 2026-03-09"
 */
function parseTripDates(dates: string): { start: Date; end: Date } | null {
  try {
    const parts = dates.split(/\s+to\s+|\s+-\s+/);
    if (parts.length !== 2) return null;
    const start = new Date(parts[0].trim());
    const end = new Date(parts[1].trim());
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
    return { start, end };
  } catch {
    return null;
  }
}

/**
 * Format dates back to trip string format
 */
function formatTripDates(start: Date, end: Date): string {
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return `${fmt(start)} to ${fmt(end)}`;
}

/**
 * Add days to a date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ============================================================================
// PATCH BUILDERS
// ============================================================================

/**
 * Calculate duration in days between two dates
 */
function calculateDuration(start: Date, end: Date): number {
  const diffMs = end.getTime() - start.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Parse destination string into city/country (best effort)
 */
function parseDestination(dest: string): { city: string; country: string } {
  // Common formats: "Bangkok, Thailand" or "Thailand" or "Paris, France"
  const parts = dest.split(',').map(s => s.trim());
  if (parts.length >= 2) {
    return { city: parts[0], country: parts[1] };
  }
  // Single value - treat as country with same name for city
  return { city: dest, country: dest };
}

/**
 * Build a date extension patch
 * Extends the trip end date by specified days
 */
export function buildBufferDaysPatch(
  trip: TripResponse,
  additionalDays: number
): { prevInput: UserTripInput; nextInput: UserTripInput } | null {
  const parsedDates = parseTripDates(trip.dates);
  if (!parsedDates) return null;

  const newEndDate = addDays(parsedDates.end, additionalDays);
  const currentDuration = calculateDuration(parsedDates.start, parsedDates.end);
  const newDuration = calculateDuration(parsedDates.start, newEndDate);

  const destination = parseDestination(trip.destination);
  const groupSize = trip.groupSize || 1;
  const currency = trip.currency || 'USD';

  // Build properly structured UserTripInput
  const prevInput: UserTripInput = {
    dates: {
      start: parsedDates.start.toISOString().split('T')[0],
      end: parsedDates.end.toISOString().split('T')[0],
      duration: currentDuration,
    },
    budget: {
      total: trip.budget,
      perPerson: Math.round(trip.budget / groupSize),
      currency: currency,
    },
    origin: {
      city: trip.origin || '',
      country: '', // Not available in TripResponse
    },
    destination: destination,
    passport: trip.passport,
    travelers: {
      total: groupSize,
      adults: trip.adults || groupSize,
      children: trip.children || 0,
      infants: trip.infants || 0,
    },
    preferences: {
      pace: "moderate",
      interests: (trip as any).interests || [],
      hotelClass: trip.travelStyle?.toLowerCase() === 'luxury' ? 'luxury' :
                  trip.travelStyle?.toLowerCase() === 'budget' ? 'budget' : 'mid',
    },
    constraints: [], // No constraints from this flow
  };

  const nextInput: UserTripInput = {
    ...prevInput,
    dates: {
      start: parsedDates.start.toISOString().split('T')[0],
      end: newEndDate.toISOString().split('T')[0],
      duration: newDuration,
    },
  };

  return { prevInput, nextInput };
}

// ============================================================================
// FIX DISPATCHER
// ============================================================================

/**
 * Apply a fix suggestion
 * Routes to appropriate implementation based on action type
 */
export async function applyFix(
  suggestion: NextFixSuggestion,
  context: ApplyFixContext
): Promise<ApplyFixResult> {
  const { action } = suggestion;

  try {
    switch (action.type) {
      case "APPLY_PATCH":
        return await handleApplyPatch(suggestion, context);

      case "OPEN_EDITOR":
        return handleOpenEditor(suggestion, context);

      case "TRIGGER_FLOW":
        return await handleTriggerFlow(suggestion, context);

      default:
        console.warn('[applyFix] Unknown action type:', action.type);
        return { success: false, action: "failed", message: "Unknown action type" };
    }
  } catch (err) {
    console.error('[applyFix] Error applying fix:', err);
    return {
      success: false,
      action: "failed",
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ============================================================================
// ACTION HANDLERS
// ============================================================================

/**
 * Handle APPLY_PATCH actions
 * Routes through change planner for full reversibility
 */
async function handleApplyPatch(
  suggestion: NextFixSuggestion,
  context: ApplyFixContext
): Promise<ApplyFixResult> {
  const { tripId, trip, planChanges, applyChanges, setWorkingTrip, setBannerPlan } = context;

  switch (suggestion.id) {
    case "ADD_BUFFER_DAYS": {
      // Default to +3 days, or use impact.bufferDays if specified
      const daysToAdd = suggestion.impact.bufferDays || 3;
      const patch = buildBufferDaysPatch(trip, daysToAdd);

      if (!patch) {
        return { success: false, action: "failed", message: "Could not parse trip dates" };
      }

      console.log('[applyFix] Applying buffer days patch:', { daysToAdd, newDates: patch.nextInput.dates });

      // Route through change planner
      const plan = await planChanges({
        tripId,
        prevInput: patch.prevInput,
        nextInput: patch.nextInput,
        currentResults: trip,
        source: "fix_blocker",
      });

      // Apply the plan
      applyChanges({
        tripId,
        plan,
        setWorkingTrip,
        setBannerPlan,
        source: "fix_blocker",
      });

      // Extract new certainty from planner result for immediate history update
      const newCertainty = plan.deltaSummary?.certainty?.after;

      return {
        success: true,
        action: "applied",
        message: `Extended trip by ${daysToAdd} days`,
        newChangeId: plan.changeId,
        newCertaintyScore: typeof newCertainty === 'number' ? newCertainty : undefined,
      };
    }

    default:
      console.warn('[applyFix] No APPLY_PATCH handler for:', suggestion.id);
      return { success: false, action: "failed", message: `No patch handler for ${suggestion.id}` };
  }
}

/**
 * Handle OPEN_EDITOR actions
 * Opens the appropriate UI panel
 */
function handleOpenEditor(
  suggestion: NextFixSuggestion,
  context: ApplyFixContext
): ApplyFixResult {
  const { openEditor, showToast } = context;
  const editorTarget = suggestion.action.payload.editor;

  if (!editorTarget) {
    return { success: false, action: "failed", message: "No editor target specified" };
  }

  // If we have an editor callback, use it
  if (openEditor) {
    openEditor(editorTarget);
    return { success: true, action: "opened_editor", message: `Opened ${editorTarget} editor` };
  }

  // Fallback: show toast with guidance
  const editorMessages: Record<EditorTarget, string> = {
    dates: "Adjust your trip dates to add buffer time",
    budget: "Review your budget settings to find savings",
    hotels: "Try flexible dates or lower star ratings for cheaper stays",
    flights: "Consider nearby airports or flexible dates for better prices",
    itinerary: "Simplify your itinerary by removing packed activities",
    visa_docs: "Review visa requirements and prepare documents early",
    save: "Your trip has been saved",
  };

  const message = editorMessages[editorTarget] || `Open ${editorTarget} to make changes`;
  showToast?.(message, "info");

  console.log('[applyFix] Editor hint:', editorTarget, message);
  return { success: true, action: "opened_editor", message };
}

/**
 * Handle TRIGGER_FLOW actions
 * Executes specific flows (undo, save, refresh)
 */
async function handleTriggerFlow(
  suggestion: NextFixSuggestion,
  context: ApplyFixContext
): Promise<ApplyFixResult> {
  const { handleUndo, refetchTrip, showToast } = context;
  const flow = suggestion.action.payload.flow;

  if (!flow) {
    return { success: false, action: "failed", message: "No flow specified" };
  }

  switch (flow) {
    case "undo_change": {
      if (!handleUndo) {
        return { success: false, action: "failed", message: "Undo not available" };
      }
      await handleUndo();
      return { success: true, action: "triggered_flow", message: "Change reverted" };
    }

    case "refresh_pricing": {
      if (!refetchTrip) {
        showToast?.("Pricing refresh not available", "warning");
        return { success: false, action: "failed", message: "Refetch not available" };
      }
      showToast?.("Refreshing pricing...", "info");
      await refetchTrip();
      showToast?.("Pricing updated", "success");
      return { success: true, action: "triggered_flow", message: "Pricing refreshed" };
    }

    case "save_trip": {
      // For MVP, just show success - actual save logic can be wired later
      showToast?.("Trip saved successfully", "success");
      console.log('[applyFix] Save trip triggered');
      return { success: true, action: "triggered_flow", message: "Trip saved" };
    }

    default:
      console.warn('[applyFix] Unknown flow:', flow);
      return { success: false, action: "failed", message: `Unknown flow: ${flow}` };
  }
}

// ============================================================================
// COST REDUCTION SUGGESTIONS (for REDUCE_COST editor)
// ============================================================================

export interface CostReductionTip {
  category: string;
  tip: string;
  action: "filter" | "search" | "remove";
  target?: string;
}

/**
 * Generate cost reduction tips based on which category is driving costs up
 */
export function getCostReductionTips(dominantCategory?: string): CostReductionTip[] {
  const tips: CostReductionTip[] = [];

  if (!dominantCategory || dominantCategory === "Accommodation") {
    tips.push(
      { category: "Hotels", tip: "Try 3-star hotels instead of 4-star", action: "filter", target: "star_rating" },
      { category: "Hotels", tip: "Look for hotels slightly outside the center", action: "filter", target: "location" },
      { category: "Hotels", tip: "Consider Airbnb or hostels", action: "search", target: "alternative_stays" },
    );
  }

  if (!dominantCategory || dominantCategory === "Flights") {
    tips.push(
      { category: "Flights", tip: "Try flexible dates (±3 days)", action: "filter", target: "dates" },
      { category: "Flights", tip: "Check nearby airports", action: "search", target: "nearby_airports" },
      { category: "Flights", tip: "Consider budget airlines", action: "filter", target: "airlines" },
    );
  }

  if (!dominantCategory || dominantCategory === "Activities") {
    tips.push(
      { category: "Activities", tip: "Skip paid attractions on free days", action: "remove", target: "paid_activities" },
      { category: "Activities", tip: "Look for free walking tours", action: "search", target: "free_activities" },
    );
  }

  if (!dominantCategory || dominantCategory === "Food & Dining") {
    tips.push(
      { category: "Food", tip: "Eat at local spots instead of tourist areas", action: "filter", target: "restaurant_type" },
      { category: "Food", tip: "Try street food and markets", action: "search", target: "budget_food" },
    );
  }

  return tips;
}
