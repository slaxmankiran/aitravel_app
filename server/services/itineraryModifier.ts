/**
 * ItineraryModifierService - The "Director Agent"
 *
 * Architectural shift from "form-filler" to "surgical modification" engine.
 * Classifies user intent and routes to specialized handlers instead of regenerating entire trips.
 *
 * Three Core Handlers:
 * 1. OPTIMIZE_ROUTE - Traveling Salesman Problem solver using nearest-neighbor
 * 2. REDUCE_BUDGET - Identifies expensive items and swaps with cheaper alternatives
 * 3. SPECIFIC_EDIT - Surgical LLM edits for semantic changes
 */

import OpenAI from "openai";
import { distance } from "@turf/distance";
import { point } from "@turf/helpers";
import type { TripResponse } from "@shared/schema";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Classification of modification intents
 */
export type ModificationIntent =
  | "OPTIMIZE_ROUTE"   // Logistical: "Reorder to save walking time"
  | "REDUCE_BUDGET"    // Financial: "Save me $200", "Cheaper options"
  | "CHANGE_PACE"      // Temporal: "Make it more relaxing", "Faster pace"
  | "SPECIFIC_EDIT"    // Semantic: "Swap museum for park", "Add jazz club"
  | "ADD_ACTIVITY"     // Constructive: "Add a cooking class"
  | "REMOVE_ACTIVITY"  // Destructive: "Remove Day 3 museum"
  | "UNKNOWN";

/**
 * Result of a modification operation
 */
export interface ModificationResult {
  success: boolean;
  updatedItinerary: any;
  summary: string;          // Human-readable summary: "Reordered Day 3 to save 45 mins"
  reasoning: string[];      // Step-by-step explanation
  diff: ModificationDiff;
  metadata: {
    intent: ModificationIntent;
    processingTimeMs: number;
    affectedDays: number[];
  };
}

export interface ModificationDiff {
  removed: string[];    // Activity names that were removed
  added: string[];      // Activity names that were added
  modified: string[];   // Activities that were reordered/changed
  costDelta: number;    // Net change in trip cost
}

interface ExpensiveItem {
  day: number;
  activityIndex: number;
  name: string;
  cost: number;
  type: string;
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class ItineraryModifierService {
  private openai: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = "deepseek-chat") {
    this.openai = new OpenAI({
      apiKey,
      baseURL: model.includes("deepseek") ? "https://api.deepseek.com" : undefined,
    });
    this.model = model;
  }

  // ============================================================================
  // MAIN ENTRY POINT - The "Director"
  // ============================================================================

  /**
   * Analyzes user request, classifies intent, and routes to appropriate handler
   */
  async modifyItinerary(
    trip: TripResponse,
    userPrompt: string
  ): Promise<ModificationResult> {
    const startTime = Date.now();
    console.log(`[Modifier] Analyzing: "${userPrompt}"`);

    try {
      // Step 1: Intent Classification (The Router)
      const intent = await this.classifyIntent(userPrompt, trip);
      console.log(`[Modifier] Intent: ${intent}`);

      // Step 2: Route to specialized handler
      let result: ModificationResult;

      switch (intent) {
        case "OPTIMIZE_ROUTE":
          result = await this.handleRouteOptimization(trip);
          break;

        case "REDUCE_BUDGET":
          result = await this.handleBudgetSqueeze(trip, userPrompt);
          break;

        case "CHANGE_PACE":
          result = await this.handlePaceAdjustment(trip, userPrompt);
          break;

        case "SPECIFIC_EDIT":
        case "ADD_ACTIVITY":
        case "REMOVE_ACTIVITY":
          result = await this.handleGenerativeEdit(trip, userPrompt, intent);
          break;

        default:
          result = await this.handleGenerativeEdit(trip, userPrompt, "UNKNOWN");
      }

      // Add metadata
      result.metadata = {
        intent,
        processingTimeMs: Date.now() - startTime,
        affectedDays: this.getAffectedDays(result.diff),
      };

      console.log(`[Modifier] Complete: ${result.summary} (${result.metadata.processingTimeMs}ms)`);
      return result;

    } catch (error) {
      console.error(`[Modifier] Error:`, error);
      return {
        success: false,
        updatedItinerary: trip.itinerary,
        summary: "Failed to modify itinerary",
        reasoning: [`Error: ${error instanceof Error ? error.message : String(error)}`],
        diff: { removed: [], added: [], modified: [], costDelta: 0 },
        metadata: {
          intent: "UNKNOWN",
          processingTimeMs: Date.now() - startTime,
          affectedDays: [],
        },
      };
    }
  }

  // ============================================================================
  // INTENT CLASSIFIER - The "Router Brain"
  // ============================================================================

  private async classifyIntent(
    prompt: string,
    trip: TripResponse
  ): Promise<ModificationIntent> {
    try {
      const response = await this.openai.chat.completions.create({
        model: "deepseek-chat", // Fast and cheap for classification
        messages: [
          {
            role: "system",
            content: `You are an intent classifier for travel itinerary modifications.

Classify user requests into ONE of these intents:

OPTIMIZE_ROUTE - User wants to reorder activities for logistics/efficiency
  Examples: "optimize the route", "minimize walking", "reorder by location"

REDUCE_BUDGET - User wants to cut costs or find cheaper options
  Examples: "save money", "cheaper alternatives", "reduce cost", "budget-friendly"

CHANGE_PACE - User wants to adjust activity density or rhythm
  Examples: "more relaxing", "less rushed", "faster pace", "pack more in"

SPECIFIC_EDIT - User wants to swap/modify specific activities
  Examples: "swap the museum for a park", "change lunch to dinner", "replace X with Y"

ADD_ACTIVITY - User wants to add something new
  Examples: "add a cooking class", "include a jazz club", "visit the beach"

REMOVE_ACTIVITY - User wants to remove something
  Examples: "remove the museum", "skip Day 3 morning", "take out expensive activities"

UNKNOWN - Cannot determine intent

Respond with ONLY the intent name (e.g., "OPTIMIZE_ROUTE").`,
          },
          {
            role: "user",
            content: `User request: "${prompt}"\n\nCurrent trip: ${trip.destination}, ${
              (trip.itinerary as any)?.days?.length || 0
            } days`,
          },
        ],
        max_tokens: 20,
        temperature: 0.1,
      });

      const classification = response.choices[0].message.content?.trim().toUpperCase();

      // Validate classification
      const validIntents: ModificationIntent[] = [
        "OPTIMIZE_ROUTE",
        "REDUCE_BUDGET",
        "CHANGE_PACE",
        "SPECIFIC_EDIT",
        "ADD_ACTIVITY",
        "REMOVE_ACTIVITY",
        "UNKNOWN",
      ];

      return validIntents.includes(classification as ModificationIntent)
        ? (classification as ModificationIntent)
        : "UNKNOWN";
    } catch (error) {
      console.error(`[Modifier] Classification error:`, error);
      return "UNKNOWN";
    }
  }

  // ============================================================================
  // HANDLER 1: ROUTE OPTIMIZER - The "Logistical Engine"
  // ============================================================================

  /**
   * Reorders activities within each day using nearest-neighbor algorithm
   * to minimize travel distance (Traveling Salesman Problem approximation)
   */
  private async handleRouteOptimization(trip: TripResponse): Promise<ModificationResult> {
    const itinerary = JSON.parse(JSON.stringify(trip.itinerary)); // Deep clone
    const reasoning: string[] = [];
    const modified: string[] = [];
    let totalOptimizations = 0;

    if (!itinerary.days || !Array.isArray(itinerary.days)) {
      return {
        success: false,
        updatedItinerary: trip.itinerary,
        summary: "No itinerary to optimize",
        reasoning: ["Itinerary structure is invalid"],
        diff: { removed: [], added: [], modified: [], costDelta: 0 },
        metadata: { intent: "OPTIMIZE_ROUTE", processingTimeMs: 0, affectedDays: [] },
      };
    }

    itinerary.days.forEach((day: any) => {
      if (!day.activities || day.activities.length < 3) {
        // Need at least 3 activities to optimize
        return;
      }

      // Filter activities with valid coordinates
      const validActivities = day.activities.filter(
        (a: any) => a.coordinates?.lat && a.coordinates?.lng
      );

      if (validActivities.length < 3) {
        reasoning.push(`Day ${day.day}: Skipped (insufficient GPS data)`);
        return;
      }

      // Nearest Neighbor Algorithm
      const originalOrder = [...day.activities];
      const optimized: any[] = [];
      const unvisited = [...day.activities];

      // Anchor: Start with first activity (usually breakfast/hotel check-in)
      let current = unvisited.shift();
      optimized.push(current);

      // Build route by always picking nearest next activity
      while (unvisited.length > 0) {
        let nearestIdx = 0;
        let minDist = Infinity;

        unvisited.forEach((candidate, idx) => {
          const dist = this.calculateDistance(current, candidate);
          if (dist < minDist && dist !== Infinity) {
            minDist = dist;
            nearestIdx = idx;
          }
        });

        // If no valid distances found, just take next in line
        if (minDist === Infinity) {
          nearestIdx = 0;
        }

        current = unvisited.splice(nearestIdx, 1)[0];
        optimized.push(current);
      }

      // Calculate improvement
      const originalDistance = this.calculateTotalDistance(originalOrder);
      const optimizedDistance = this.calculateTotalDistance(optimized);
      const savedKm = originalDistance - optimizedDistance;
      const savedMinutes = Math.round(savedKm * 12); // Assume 12 min per km walking

      // Check if order actually changed
      const orderChanged =
        JSON.stringify(originalOrder.map((a) => a.name)) !==
        JSON.stringify(optimized.map((a) => a.name));

      if (orderChanged && savedKm > 0.1) {
        day.activities = optimized;
        totalOptimizations++;
        reasoning.push(
          `Day ${day.day}: Saved ${savedKm.toFixed(1)}km (≈${savedMinutes} min walking)`
        );
        modified.push(`Day ${day.day} reordered`);
      } else {
        reasoning.push(`Day ${day.day}: Already optimal`);
      }
    });

    const summary =
      totalOptimizations > 0
        ? `Optimized ${totalOptimizations} day(s) for route efficiency`
        : "Route is already optimal";

    return {
      success: true,
      updatedItinerary: itinerary,
      summary,
      reasoning,
      diff: {
        removed: [],
        added: [],
        modified,
        costDelta: 0,
      },
      metadata: { intent: "OPTIMIZE_ROUTE", processingTimeMs: 0, affectedDays: [] },
    };
  }

  // ============================================================================
  // HANDLER 2: BUDGET SQUEEZE - The "Financial Engine"
  // ============================================================================

  /**
   * Identifies expensive activities and uses AI to suggest cheaper alternatives
   * Only modifies high-cost items, preserving the rest of the trip
   */
  private async handleBudgetSqueeze(
    trip: TripResponse,
    prompt: string
  ): Promise<ModificationResult> {
    const itinerary = JSON.parse(JSON.stringify(trip.itinerary));
    const expensiveItems: ExpensiveItem[] = [];
    const EXPENSIVE_THRESHOLD = 50; // USD

    // Scan for expensive activities
    itinerary.days?.forEach((day: any) => {
      day.activities?.forEach((act: any, idx: number) => {
        if (
          act.estimatedCost > EXPENSIVE_THRESHOLD &&
          act.type !== "lodging" &&
          act.type !== "transport"
        ) {
          expensiveItems.push({
            day: day.day,
            activityIndex: idx,
            name: act.name,
            cost: act.estimatedCost,
            type: act.type,
          });
        }
      });
    });

    if (expensiveItems.length === 0) {
      return {
        success: true,
        updatedItinerary: trip.itinerary,
        summary: "Budget is already optimized - no expensive activities found",
        reasoning: ["All activities are under $50"],
        diff: { removed: [], added: [], modified: [], costDelta: 0 },
        metadata: { intent: "REDUCE_BUDGET", processingTimeMs: 0, affectedDays: [] },
      };
    }

    // Surgical AI replacement - only send expensive items for optimization
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: `You are a budget travel optimizer. Replace expensive activities with FREE or cheap alternatives (under $15).

Rules:
- Stay in the same city/neighborhood
- Match the activity type (e.g., museum → free museum, restaurant → street food)
- Include real place names and GPS coordinates
- Return valid JSON only

Return format:
{
  "replacements": [
    {
      "originalName": "Activity name",
      "replacement": {
        "name": "New activity name",
        "description": "Brief description",
        "estimatedCost": 0,
        "type": "activity|meal",
        "location": "Address",
        "coordinates": {"lat": 0.0, "lng": 0.0},
        "time": "HH:MM"
      },
      "savings": 150
    }
  ]
}`,
          },
          {
            role: "user",
            content: `Destination: ${trip.destination}

Expensive activities to replace:
${expensiveItems.map((item) => `- Day ${item.day}: ${item.name} ($${item.cost})`).join("\n")}

User request: "${prompt}"

Find budget-friendly alternatives for these activities.`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 2000,
      });

      const content = response.choices[0].message.content || "{}";
      const result = JSON.parse(content);
      const replacements = result.replacements || [];

      // Apply swaps
      const removed: string[] = [];
      const added: string[] = [];
      let totalSavings = 0;

      replacements.forEach((swap: any) => {
        const expensiveItem = expensiveItems.find((item) => item.name === swap.originalName);
        if (!expensiveItem) return;

        const day = itinerary.days.find((d: any) => d.day === expensiveItem.day);
        if (!day) return;

        const activity = day.activities[expensiveItem.activityIndex];
        if (!activity) return;

        // Swap the activity
        removed.push(activity.name);
        added.push(swap.replacement.name);
        totalSavings += swap.savings || 0;

        Object.assign(activity, swap.replacement);
      });

      const reasoning = replacements.map(
        (swap: any) => `Swapped "${swap.originalName}" → "${swap.replacement.name}" ($${swap.savings} saved)`
      );

      return {
        success: true,
        updatedItinerary: itinerary,
        summary: `Reduced budget by $${totalSavings} with ${replacements.length} swap(s)`,
        reasoning,
        diff: {
          removed,
          added,
          modified: [],
          costDelta: -totalSavings,
        },
        metadata: { intent: "REDUCE_BUDGET", processingTimeMs: 0, affectedDays: [] },
      };
    } catch (error) {
      console.error(`[Modifier] Budget squeeze error:`, error);
      return {
        success: false,
        updatedItinerary: trip.itinerary,
        summary: "Failed to optimize budget",
        reasoning: [`Error: ${error instanceof Error ? error.message : String(error)}`],
        diff: { removed: [], added: [], modified: [], costDelta: 0 },
        metadata: { intent: "REDUCE_BUDGET", processingTimeMs: 0, affectedDays: [] },
      };
    }
  }

  // ============================================================================
  // HANDLER 3: PACE ADJUSTMENT - The "Temporal Engine"
  // ============================================================================

  private async handlePaceAdjustment(
    trip: TripResponse,
    prompt: string
  ): Promise<ModificationResult> {
    const itinerary = JSON.parse(JSON.stringify(trip.itinerary));
    const reasoning: string[] = [];

    // Detect if user wants faster or slower pace
    const isSlowerPace = /relax|slow|easy|calm|chill/i.test(prompt);
    const isFasterPace = /fast|pack|busy|more|maximize/i.test(prompt);

    if (!isSlowerPace && !isFasterPace) {
      // Delegate to generative edit if unclear
      return this.handleGenerativeEdit(trip, prompt, "CHANGE_PACE");
    }

    const modified: string[] = [];

    itinerary.days?.forEach((day: any) => {
      if (!day.activities || day.activities.length === 0) return;

      if (isSlowerPace && day.activities.length > 3) {
        // Remove lowest priority activities (those with lower cost or generic names)
        const toRemove = day.activities.length - 3;
        const removed = day.activities.splice(-toRemove);
        modified.push(`Day ${day.day} reduced to 3 activities`);
        reasoning.push(`Day ${day.day}: Removed ${removed.map((a: any) => a.name).join(", ")}`);
      } else if (isFasterPace) {
        reasoning.push(`Day ${day.day}: Already optimized for fast pace`);
      } else {
        reasoning.push(`Day ${day.day}: Pace is already appropriate`);
      }
    });

    return {
      success: true,
      updatedItinerary: itinerary,
      summary: isSlowerPace ? "Simplified for relaxed pace" : "Maintained current pace",
      reasoning,
      diff: {
        removed: [],
        added: [],
        modified,
        costDelta: 0,
      },
      metadata: { intent: "CHANGE_PACE", processingTimeMs: 0, affectedDays: [] },
    };
  }

  // ============================================================================
  // HANDLER 4: GENERATIVE EDIT - The "Semantic Engine"
  // ============================================================================

  /**
   * Uses LLM for semantic changes that require understanding context
   * Examples: "Add more local food", "I like jazz", "Make it more romantic"
   */
  private async handleGenerativeEdit(
    trip: TripResponse,
    prompt: string,
    intent: ModificationIntent
  ): Promise<ModificationResult> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: `You are a surgical itinerary editor. Modify the itinerary JSON based on user request.

Rules:
- Make MINIMAL changes - only what user requested
- Preserve activity structure (time, coordinates, etc.)
- Keep existing good activities
- Return complete itinerary JSON with modifications applied
- Provide clear explanation of what changed

Return format:
{
  "itinerary": { /* full modified itinerary */ },
  "changes": {
    "removed": ["Activity names removed"],
    "added": ["Activity names added"],
    "modified": ["Description of modifications"]
  },
  "reasoning": ["Step 1: ...", "Step 2: ..."]
}`,
          },
          {
            role: "user",
            content: `Current itinerary for ${trip.destination}:
${JSON.stringify(trip.itinerary, null, 2)}

User request: "${prompt}"

Apply the requested changes surgically.`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 4000,
      });

      const content = response.choices[0].message.content || "{}";
      const result = JSON.parse(content);

      return {
        success: true,
        updatedItinerary: result.itinerary || trip.itinerary,
        summary: `Applied semantic edit: ${prompt}`,
        reasoning: result.reasoning || ["Modifications applied"],
        diff: {
          removed: result.changes?.removed || [],
          added: result.changes?.added || [],
          modified: result.changes?.modified || [],
          costDelta: 0,
        },
        metadata: { intent, processingTimeMs: 0, affectedDays: [] },
      };
    } catch (error) {
      console.error(`[Modifier] Generative edit error:`, error);
      return {
        success: false,
        updatedItinerary: trip.itinerary,
        summary: "Failed to apply edit",
        reasoning: [`Error: ${error instanceof Error ? error.message : String(error)}`],
        diff: { removed: [], added: [], modified: [], costDelta: 0 },
        metadata: { intent, processingTimeMs: 0, affectedDays: [] },
      };
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Calculate distance between two activities using Haversine formula
   */
  private calculateDistance(a: any, b: any): number {
    if (!a?.coordinates?.lat || !a?.coordinates?.lng || !b?.coordinates?.lat || !b?.coordinates?.lng) {
      return Infinity;
    }

    try {
      const from = point([a.coordinates.lng, a.coordinates.lat]);
      const to = point([b.coordinates.lng, b.coordinates.lat]);
      return distance(from, to, { units: "kilometers" });
    } catch (error) {
      return Infinity;
    }
  }

  /**
   * Calculate total distance for a sequence of activities
   */
  private calculateTotalDistance(activities: any[]): number {
    let total = 0;
    for (let i = 0; i < activities.length - 1; i++) {
      const dist = this.calculateDistance(activities[i], activities[i + 1]);
      if (dist !== Infinity) {
        total += dist;
      }
    }
    return total;
  }

  /**
   * Extract affected day numbers from diff
   */
  private getAffectedDays(diff: ModificationDiff): number[] {
    const days = new Set<number>();
    // This is a simple implementation - you could track day numbers more precisely
    if (diff.removed.length > 0 || diff.added.length > 0 || diff.modified.length > 0) {
      // For now, just mark all days as potentially affected
      // In a more sophisticated version, track day numbers during modifications
    }
    return Array.from(days);
  }
}
